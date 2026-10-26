/** Guarded human-authored corrections and mechanical audit; never guesses a translation. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeCsv, parseCsvRow, normalizeHeadword, extractSenses, shortenMeaning } from './import-csv-dictionary.mjs';

const CATEGORIES = { noun: 'Danh từ', verb: 'Động từ', adjective: 'Tính từ', adverb: 'Trạng từ', preposition: 'Giới từ', pronoun: 'Đại từ', conjunction: 'Liên từ', interjection: 'Thán từ', determiner: 'Từ hạn định', numeral: 'Số từ', prefix: 'Tiền tố', suffix: 'Hậu tố', abbreviation: 'Viết tắt', unspecified: 'Chưa rõ từ loại' };
const normalize = value => value.normalize('NFC').replace(/\s+/gu, ' ').trim();
const grammarNote = /^(?:\([^)]*\)\s*)*(?:(?:thời\s+)?quá khứ|động tính từ (?:quá khứ|hiện tại)?|(?:cấp |bậc )?so sánh|số nhiều|phân từ(?: quá khứ| hiện tại)?)(?=\s|$)/iu;
const referenceOnly = /^(?:\([^)]*\)\s*)*(?:xem|như|cách viết khác\s*:|đồng nghĩa với|dạng (?:viết tắt|khác) của)\s+[a-z][a-z ,;:-]*$/iu;
const DOMAIN_LABELS = { 'động': 'động vật học', 'phẫu': 'giải phẫu', 'hóa': 'hóa học', 'văn': 'văn học', 'khngu': 'khẩu ngữ', 'y': 'y học', 'tin': 'tin học', 'mỹ': 'Mỹ', 'ngôn': 'ngôn ngữ học', 'pháp': 'pháp luật', 'nhạc': 'âm nhạc', 'địa': 'địa chất', 'thgt': 'thông tục', 'snh': 'số nhiều', 'thể': 'thể thao', 'tchính': 'tài chính', 'thực': 'thực vật học', 'chtrị': 'chính trị', 'ngân hàng': 'ngân hàng', 'bóng': 'nghĩa bóng', 'tôn': 'tôn giáo', 'vt': 'viết tắt', 'thvăn': 'thiên văn học', 'khcổ': 'khảo cổ học', 'toán': 'toán học', 'ktrúc': 'kiến trúc', 'sử': 'lịch sử', 'lý': 'vật lý', 'khoáng': 'khoáng vật học', 'hải': 'hàng hải', 'qsự': 'quân sự', 'rađiô': 'vô tuyến', 'thương': 'thương mại', 'tlý': 'tâm lý học', 'triết': 'triết học', 'sinh': 'sinh học', 'đen&bóng': 'nghĩa đen và nghĩa bóng', 'in': 'in ấn', 'mỹ,lóng,xấu': 'Mỹ, tiếng lóng, nghĩa xấu', 'kỹ': 'kỹ thuật', 'điện': 'điện học', 'dược học': 'dược học', 'lóng': 'tiếng lóng', 'đùa': 'đùa', 'nghĩa đen': 'nghĩa đen', 'điện ảnh': 'điện ảnh', 'ngôn ngữ nhà trường': 'ngôn ngữ nhà trường', 'mỹ,thgt': 'Mỹ, thông tục', 'phật': 'Phật giáo' };

/** Expand only known source labels; preserve unknown tags and all lexical wording. */
export function cleanSourceMarkup(meaning) {
  return normalize(meaning.replace(/<([^>]+)>/gu, (tag, label) => Object.hasOwn(DOMAIN_LABELS, label) ? `(${DOMAIN_LABELS[label]}) ` : tag)
    .replace(/\s*\[tq\]\s*,?/giu, '').replace(/\s+([,;.])/gu, '$1').replace(/[,;]+$/u, ''));
}

/** A usage/domain label alone does not explain a word. Parenthesized real definitions remain valid. */
export function isMetadataOnly(meaning) {
  const labels = new Set([...Object.values(DOMAIN_LABELS), 'thường', 'từ cổ', 'nghĩa cổ'].map(label => label.toLocaleLowerCase('vi')));
  return !cleanSourceMarkup(meaning).replace(/\(([^)]*)\)/gu, (whole, label) => labels.has(label.trim().toLocaleLowerCase('vi')) ? '' : whole).trim();
}

export function applyVietnameseCorrections(data, edition) {
  if (edition?.version !== 1 || edition.sourceSha256 !== data.source?.sha256 || !edition.entries || Array.isArray(edition.entries)) throw new Error('Vietnamese correction source mismatch');
  const bank = new Map(data.words.map(word => [word.answer, word]));
  const patches = new Map(Object.entries(edition.entries));
  // Validate every correction before producing any changed entries. Existing IDs/history survive.
  for (const [answer, correction] of Object.entries(edition.entries)) {
    const word = bank.get(answer);
    if (!word || !/^[a-z]{3,18}$/.test(answer) || !correction.reason?.trim()
      || !correction.meaning?.trim() || correction.meaning.length > 120 || correction.meaning !== normalize(correction.meaning)
      || !Object.hasOwn(CATEGORIES, correction.partOfSpeech) || correction.partOfSpeech === 'unspecified'
      || !correction.englishMeaning?.trim() || correction.englishMeaning.length > 240
      || !Array.isArray(correction.references) || !correction.references.length || correction.references.some(reference => !/^https:\/\//.test(reference))) throw new Error(`Invalid Vietnamese correction: ${answer}`);
    const matchesBefore = word.meaning === correction.before?.meaning && word.partOfSpeech === correction.before?.partOfSpeech;
    const alreadyApplied = word.meaning === correction.meaning && word.partOfSpeech === correction.partOfSpeech;
    if (!matchesBefore && !alreadyApplied) throw new Error(`Stale Vietnamese correction: ${answer}`);
  }
  return { ...data, words: data.words.map(word => {
    const correction = patches.get(word.answer);
    return correction ? { ...word, meaning: correction.meaning, partOfSpeech: correction.partOfSpeech, category: CATEGORIES[correction.partOfSpeech] } : word;
  }) };
}

export function sourceIndex(csvBytes) {
  const lines = decodeCsv(csvBytes).text.split(/\r\n|\n|\r/u), index = new Map();
  for (let line = 1; line < lines.length; line++) {
    if (!lines[line].trim()) continue;
    const rowNumber = line + 1;
    let raw = lines[line], parsed = parseCsvRow(raw);
    while (parsed.incomplete && line + 1 < lines.length) { raw += '\n' + lines[++line]; parsed = parseCsvRow(raw); }
    if (!parsed.english || !parsed.fullMeaning) continue;
    const head = normalizeHeadword(parsed.english, parsed.fullMeaning);
    if (head.reason) continue;
    const rows = index.get(head.answer) ?? [];
    rows.push({ row: rowNumber, sourceHeadword: normalize(parsed.english), text: normalize(parsed.fullMeaning) });
    index.set(head.answer, rows);
  }
  return index;
}

function mismatchedDelimiters(text) {
  const stack = [], close = { ')': '(', ']': '[', '}': '{' };
  for (const char of text) {
    if ('([{'.includes(char)) stack.push(char);
    else if (Object.hasOwn(close, char) && stack.pop() !== close[char]) return true;
  }
  return stack.length > 0;
}

/** Flags are review candidates, not proof that a word or sense is wrong. */
export function auditVietnameseDictionary(data, sources = new Map()) {
  const findings = [], counts = {}, seen = new Set();
  for (const word of data.words) {
    const reasons = [], meaning = String(word.meaning ?? '');
    if (!/^[a-z]{3,18}$/.test(word.answer)) reasons.push('malformed-headword');
    if (seen.has(word.answer)) reasons.push('duplicate-headword');
    seen.add(word.answer);
    if (!meaning.trim()) reasons.push('empty-meaning');
    else if (isMetadataOnly(meaning)) reasons.push('usage-label-instead-of-definition');
    if (!Object.hasOwn(CATEGORIES, word.partOfSpeech) || word.partOfSpeech === 'unspecified') reasons.push('missing-part-of-speech');
    if (grammarNote.test(meaning)) reasons.push('grammar-note-instead-of-definition');
    if (referenceOnly.test(meaning)) reasons.push('unresolved-cross-reference');
    if (/[<>]|\ufffd|[|]|(?:^|\s)[@](?:\s|$)/u.test(meaning)) reasons.push('source-markup');
    if (mismatchedDelimiters(meaning)) reasons.push('unbalanced-delimiters');
    if (/\[(?:tq|n|v|adj|adv)\]/iu.test(meaning)) reasons.push('editorial-code-in-definition');
    if (meaning !== normalize(meaning)) reasons.push('non-normalized-definition');
    if (reasons.length) {
      for (const reason of reasons) counts[reason] = (counts[reason] ?? 0) + 1;
      findings.push({ answer: word.answer, meaning, partOfSpeech: word.partOfSpeech, learningLevel: word.learningLevel,
        reasons, sourceRows: (sources.get(word.answer) ?? []).map(source => source.row) });
    }
  }
  return { inspectedEntries: data.words.length, flaggedEntries: findings.length, counts, findings };
}

/** Recover source-authored senses after grammatical metadata; normalize only known markup. */
export function suggestSourceSenseRecoveries(data, sources) {
  const proposals = [];
  for (const word of data.words) {
    if (!grammarNote.test(word.meaning) || word.partOfSpeech === 'unspecified') continue;
    for (const source of sources.get(word.answer) ?? []) {
      // A different headword marker could introduce a copied or unrelated entry.
      if ([...source.text.matchAll(/(?:^|\|)\s*@([a-z]+)/gu)].some(match => match[1] !== word.answer)) continue;
      const selected = extractSenses(source.text).senses.map(sense => ({ ...sense, meaning: shortenMeaning(cleanSourceMarkup(sense.meaning)) })).find(sense => sense.meaning && sense.partOfSpeech === word.partOfSpeech
        && !grammarNote.test(sense.meaning) && !referenceOnly.test(sense.meaning)
        && !isMetadataOnly(sense.meaning)
        && !/[<>|\ufffd]/u.test(sense.meaning) && !mismatchedDelimiters(sense.meaning));
      if (!selected) continue;
      proposals.push({ answer: word.answer, before: { meaning: word.meaning, partOfSpeech: word.partOfSpeech },
        after: { meaning: selected.meaning, partOfSpeech: selected.partOfSpeech }, sourceRow: source.row,
        reason: 'The selected clue contains grammatical metadata; this later definition occurs under the same POS in the same CSV headword, with known domain labels normalized. The proposal is applied only through the guarded repair layer.' });
      break;
    }
  }
  return proposals;
}

export function buildSourceRepairs(data, authored, sources) {
  const entries = Object.create(null);
  for (const proposal of suggestSourceSenseRecoveries(data, sources)) {
    if (Object.hasOwn(authored.entries, proposal.answer)) continue;
    // The source sometimes expands a zoology abbreviation to the unrelated phrase
    // "động từ". Leave these conflicting source labels for lexical review.
    if (/\((?:động từ|tính từ|danh từ)\)/u.test(proposal.after.meaning)) continue;
    entries[proposal.answer] = { before: proposal.before, meaning: proposal.after.meaning, partOfSpeech: proposal.after.partOfSpeech,
      kind: 'source-sense-recovery', sourceRows: [proposal.sourceRow],
      reason: 'Replace a grammar-only clue with the later concrete definition recorded under the same headword and POS in the original CSV. No invented translation.' };
  }
  for (const word of data.words) {
    if (Object.hasOwn(authored.entries, word.answer)) continue;
    const current = entries[word.answer]?.meaning ?? word.meaning;
    const cleaned = cleanSourceMarkup(current);
    if (cleaned === current) continue;
    const meaning = shortenMeaning(cleaned);
    if (!meaning || isMetadataOnly(meaning) || /[<>]/u.test(meaning) || grammarNote.test(meaning) || mismatchedDelimiters(meaning)) continue;
    const existing = entries[word.answer];
    entries[word.answer] = { before: existing?.before ?? { meaning: word.meaning, partOfSpeech: word.partOfSpeech }, meaning,
      partOfSpeech: word.partOfSpeech, kind: existing ? 'source-sense-and-markup' : 'source-markup',
      sourceRows: existing?.sourceRows ?? (sources.get(word.answer) ?? []).map(row => row.row),
      reason: existing ? `${existing.reason} Expand known source domain labels and remove the nonlexical [tq] code.` : 'Expand known source domain labels, normalize source punctuation, and remove the nonlexical [tq] code; retain lexical wording and POS.' };
  }
  return { version: 1, sourceSha256: data.source.sha256, revision: '2026-10-26-source-recovery', method: 'Auditable structural/source recovery, not independent semantic validation of every recovered technical term.',
    entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, 'en'))) };
}

export function applySourceRepairs(data, edition) {
  if (edition?.version !== 1 || edition.sourceSha256 !== data.source?.sha256 || !edition.entries || Array.isArray(edition.entries)) throw new Error('Source repair edition mismatch');
  const patches = new Map(Object.entries(edition.entries)), bank = new Map(data.words.map(word => [word.answer, word]));
  for (const [answer, patch] of patches) {
    const word = bank.get(answer);
    if (!word || !patch.reason?.trim() || !['source-sense-recovery', 'source-markup', 'source-sense-and-markup'].includes(patch.kind)
      || !Array.isArray(patch.sourceRows) || !patch.sourceRows.length || patch.sourceRows.some(row => !Number.isInteger(row) || row < 2)
      || patch.partOfSpeech !== patch.before?.partOfSpeech || !Object.hasOwn(CATEGORIES, patch.partOfSpeech)
      || !patch.meaning?.trim() || isMetadataOnly(patch.meaning) || patch.meaning.length > 120 || patch.meaning !== normalize(patch.meaning)) throw new Error(`Invalid source repair: ${answer}`);
    if (!(word.meaning === patch.before.meaning && word.partOfSpeech === patch.before.partOfSpeech)
      && !(word.meaning === patch.meaning && word.partOfSpeech === patch.partOfSpeech)) throw new Error(`Stale source repair: ${answer}`);
    if (patch.kind.startsWith('source-sense') && !grammarNote.test(patch.before.meaning)) throw new Error(`Source recovery would overwrite a lexical meaning: ${answer}`);
    if (patch.kind === 'source-markup' && patch.meaning !== shortenMeaning(cleanSourceMarkup(patch.before.meaning))) throw new Error(`Source markup repair would change lexical wording: ${answer}`);
  }
  return { ...data, words: data.words.map(word => {
    const patch = patches.get(word.answer);
    return patch ? { ...word, meaning: patch.meaning } : word;
  }) };
}

export async function runAudit({ input = 'public/vocabulary/en-vi.json', corrections = 'scripts/data/vietnamese-corrections.json', csv = 'Dic/English - Vietnamese.csv', output = 'assets/dictionary-audit/vietnamese-audit.json', sourceRepairsOutput } = {}) {
  const [raw, editionRaw, sourceRaw] = await Promise.all([readFile(input), readFile(corrections, 'utf8'), readFile(csv)]);
  const data = JSON.parse(raw), edition = JSON.parse(editionRaw);
  if (createHash('sha256').update(sourceRaw).digest('hex') !== data.source.sha256) throw new Error('Audit CSV checksum does not match dictionary source');
  const sources = sourceIndex(sourceRaw);
  const corrected = applyVietnameseCorrections(data, edition);
  const sourceRepairs = buildSourceRepairs(corrected, edition, sources);
  if (sourceRepairsOutput) {
    await mkdir(dirname(sourceRepairsOutput), { recursive: true });
    await writeFile(sourceRepairsOutput, `${JSON.stringify(sourceRepairs, null, 2)}\n`);
  }
  const repaired = applySourceRepairs(corrected, sourceRepairs);
  const before = auditVietnameseDictionary(data, sources), after = auditVietnameseDictionary(corrected, sources);
  const report = {
    version: 1, sourceSha256: data.source.sha256, runtimeSha256: createHash('sha256').update(raw).digest('hex'),
    method: 'Mechanical review of every runtime row plus explicitly authored, before-value-guarded corrections. Flags do not certify semantic errors; unflagged rows are not semantically verified.',
    semanticReview: { correctedEntries: Object.keys(edition.entries).length, fullDictionarySemanticallyVerified: false, correctionFile: corrections },
    before: { inspectedEntries: before.inspectedEntries, flaggedEntries: before.flaggedEntries, counts: before.counts },
    after,
    afterSourceRepairs: auditVietnameseDictionary(repaired, sources),
    sourceRepairCount: Object.keys(sourceRepairs.entries).length,
    sourceSenseProposals: suggestSourceSenseRecoveries(corrected, sources),
    corrections: Object.entries(edition.entries).map(([answer, item]) => ({ answer, ...item, sourceRows: (sources.get(answer) ?? []).map(row => row.row) })),
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await runAudit();
  console.log(JSON.stringify({ inspected: report.after.inspectedEntries, corrections: report.semanticReview.correctedEntries, unresolvedCandidates: report.after.flaggedEntries, counts: report.after.counts }));
}
