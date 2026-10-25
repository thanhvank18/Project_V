/** Import the user's local two-column EN–VI file. No translations or remote services. */
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mergeCsvHistoryAliases } from './csv-history-migration.mjs';
import { classifyWords, preferredBasicSourceSense } from './grade-csv-vocabulary.mjs';

export const CSV_LICENSE = 'Không kèm thông tin giấy phép trong file người dùng cung cấp';
const DEFAULT_INPUT = 'Dic/English - Vietnamese.csv';
const DEFAULT_OUTPUT = 'public/vocabulary/en-vi.json';
const DEFAULT_ARCHIVE = 'assets/dictionary-csv/full-entries.jsonl.gz';
const DEFAULT_GRADING_ARCHIVE = 'assets/dictionary-grading/word-grades.jsonl.gz';
const LABELS = { noun: 'Danh từ', verb: 'Động từ', adjective: 'Tính từ', adverb: 'Trạng từ', preposition: 'Giới từ', pronoun: 'Đại từ', conjunction: 'Liên từ', interjection: 'Thán từ', determiner: 'Từ hạn định', numeral: 'Số từ', prefix: 'Tiền tố', suffix: 'Hậu tố', abbreviation: 'Viết tắt', unspecified: 'Chưa rõ từ loại' };
const normalize = value => value.normalize('NFC').replace(/\s+/gu, ' ').trim();

export function decodeCsv(input) {
  if (typeof input === 'string') return { text: input.replace(/^\uFEFF/u, ''), encoding: 'unicode-string' };
  if (!(input instanceof Uint8Array)) throw new Error('Expected CSV bytes or text');
  const bytes = Buffer.from(input);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    if (bytes.length % 2) throw new Error('Truncated UTF-16LE source');
    return { text: bytes.subarray(2).toString('utf16le'), encoding: 'utf-16le' };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    if (bytes.length % 2) throw new Error('Truncated UTF-16BE source');
    return { text: bytes.subarray(2).swap16().toString('utf16le'), encoding: 'utf-16be' };
  }
  return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/u, ''), encoding: 'utf-8' };
}

function quotedField(row, start) {
  let value = '';
  for (let index = start + 1; index < row.length; index++) {
    if (row[index] !== '"') { value += row[index]; continue; }
    if (row[index + 1] === '"') { value += '"'; index++; continue; }
    return { value, end: index + 1 };
  }
  return { incomplete: true };
}

/** The actual file leaves meaning commas unquoted, and IPA can also contain commas. */
export function parseCsvRow(row) {
  const recovered = /^([a-z]+)\s*\[\s*\*\s*([^|]+)\|/u.exec(row.normalize('NFC'));
  if (recovered && partOfSpeechFromHeading(recovered[2])) return { english: recovered[1], fullMeaning: row.normalize('NFC').slice(row.normalize('NFC').indexOf('[') + 1), format: 'recovered-bracket-pos', syntaxRepair: 'POS/definitions embedded in malformed headword bracket' };
  let english; let end;
  if (row.startsWith('"')) {
    const field = quotedField(row, 0);
    if (field.incomplete) return field;
    english = field.value; end = field.end;
    while (/\s/u.test(row[end] ?? '') && end < row.length) end++;
    if (row[end] !== ',') return { error: 'malformed-csv' };
  } else {
    let depth = 0; end = -1;
    for (let index = 0; index < row.length; index++) {
      if (row[index] === '[') depth++;
      else if (row[index] === ']') depth = Math.max(0, depth - 1);
      else if (row[index] === ',' && depth === 0) { end = index; break; }
    }
    if (end < 0) return { error: 'malformed-csv' };
    english = row.slice(0, end);
  }
  const rest = row.slice(end + 1);
  const whitespace = rest.length - rest.trimStart().length;
  if (rest[whitespace] === '"') {
    const meaning = quotedField(rest, whitespace);
    if (meaning.incomplete) return meaning;
    if (rest.slice(meaning.end).trim()) return { error: 'malformed-csv' };
    return { english, fullMeaning: meaning.value, format: 'quoted' };
  }
  return { english, fullMeaning: rest, format: 'unquoted-meaning-commas' };
}

function isPronunciation(value) {
  // A bracketed English annotation such as [space trade - off model] is not IPA.
  const pronunciation = value.replace(/\((?:mỹ|anh|từ mỹ|tiếng mỹ)\)/giu, '').trim();
  return /[\u0250-\u02ff\u1d00-\u1dbfθðæ:]/u.test(pronunciation)
    || /^[a-zA-Z.'`,;]+(?:\s*[,;]\s*[a-zA-Z.'`]+)*$/u.test(pronunciation)
    || /^[a-zA-Z.'`,;]+(?:\s+-\s+[a-zA-Z.'`,;]+)+$/u.test(pronunciation);
}

export function normalizeHeadword(raw, fullMeaning = '') {
  let answer = normalize(raw);
  let pronunciationRecovery = false;
  const bracket = answer.match(/^(.*?)\s*\[([^\]]*)\]\s*$/u);
  if (bracket) {
    if (!isPronunciation(bracket[2])) {
      const firstSection = fullMeaning.normalize('NFC').split('|')[0];
      // Some source IPA characters became spaces. Recover only when explicit POS + a
      // definition marker establish a lexical entry; model annotations begin '#-' instead.
      const contextIsLexical = partOfSpeechFromHeading(firstSection) && /\|\s*-/u.test(fullMeaning);
      const fragments = bracket[2].replace(/\([^)]*\)/gu, '').trim();
      if (!contextIsLexical || !/^[a-zA-Z ,;.'`:-]+$/u.test(fragments)) return { reason: 'non-phonetic-annotation', answer };
      pronunciationRecovery = true;
    }
    answer = bracket[1].trim();
  }
  answer = answer.toLowerCase();
  if (/\s/u.test(answer)) return { reason: 'phrase', answer };
  if (!/^[a-z]+$/u.test(answer)) return { reason: 'unsupported-characters', answer };
  if (answer.length < 3 || answer.length > 18) return { reason: 'length', answer };
  return { answer, ...(pronunciationRecovery ? { pronunciationRecovery } : {}) };
}

/** Only explicit POS headings determine a POS. Plain definitions stay unspecified. */
export function partOfSpeechFromHeading(raw) {
  const text = normalize(raw).replace(/^\*+\s*/u, '').toLowerCase();
  if (/^[-=+!@]/u.test(text)) return null;
  const patterns = [
    ['noun', /danh động từ|danh từ/u], ['verb', /(?:ngoại |nội |trợ )?động từ/u],
    ['adjective', /tính từ/u], ['adverb', /phó từ|trạng từ/u], ['preposition', /giới từ/u],
    ['pronoun', /đại từ/u], ['conjunction', /liên từ/u], ['interjection', /thán từ/u],
    ['determiner', /mạo từ|quán từ|từ hạn định/u], ['numeral', /số từ|số đếm|số thứ tự/u],
    ['prefix', /tiền tố/u], ['suffix', /hậu tố/u], ['abbreviation', /viết tắt/u],
  ];
  const prefix = text.replace(/^(?:\([^)]*\)\s*)+/u, '');
  if (/^\((?:vt|viết tắt)(?:\s|\))/u.test(text)) return 'abbreviation';
  const found = patterns.flatMap(([pos, pattern]) => { const match = pattern.exec(prefix); return match?.index === 0 ? [{ pos, at: match.index }] : []; }).sort((a, b) => a.at - b.at);
  if (found.length) return found[0].pos;
  const short = /^(n|v|vt|vi|adj|adv|prep|pron|conj|interj|num|det|abbr)\.?\s*(?=$|[,;(])/u.exec(text)?.[1];
  return ({ n: 'noun', v: 'verb', vt: 'verb', vi: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition', pron: 'pronoun', conj: 'conjunction', interj: 'interjection', num: 'numeral', det: 'determiner', abbr: 'abbreviation' })[short] ?? null;
}

function withoutLabels(value) { return value.replace(/^(?:\([^)]*\)\s*)+/u, '').trim(); }
function isReference(value) {
  return /^(?:xem|như|vt|viết tắt|(?:dạng|số nhiều|quá khứ|phân từ) của|đồng nghĩa với)(?=$|[^\p{L}\p{N}_])/iu.test(withoutLabels(value))
    || /^(?:\([^)]*\)\s*)*\((?:như|xem)\)/iu.test(value)
    || /^\((?:vt|viết tắt) của [^)]*\)\s*$/iu.test(value)
    || /\((?:như|xem)\)/iu.test(value) && /^[a-z ,;.-]+$/iu.test(withoutLabels(value))
    || /^\(\(viết tắt\) của [^)]*\)\s*\p{L}*[!]$/iu.test(value)
    || /^\((?:viết tắt|vt)\)\s*của\s+[a-z ,;.-]+$/iu.test(value)
    || /^\((?:viết tắt|vt)\)\s*[,;]?\s*của\s+/iu.test(value) && !/[àáạảãâăèéẹẻẽêìíịỉĩòóọỏõôơùúụủũưỳýỵỷỹđ]/iu.test(withoutLabels(value).replace(/^[,;]?\s*của\s+/u, ''))
    || /^(?:giống như|có nghĩa như)\s+[a-z ,;.-]+$/iu.test(value);
}

function inlineHeadingMeaning(token) {
  if (/^\((?:viết tắt|vt)/iu.test(token)) return token;
  const match = /^(?:\*\s*)?(?:(?:ngoại|nội|trợ) động từ|danh động từ|danh từ|động từ|tính từ|phó từ|trạng từ|giới từ|đại từ|liên từ|thán từ|mạo từ|quán từ|số từ|tiền tố|hậu tố)\s*(.*)$/u.exec(token);
  const rest = match?.[1]?.trim();
  if (!rest || /^(?:[,;&]|số nhiều|số ít|&|adv\b|pl\b)/u.test(rest)) return null;
  if (!/[àáạảãâăèéẹẻẽêìíịỉĩòóọỏõôơùúụủũưỳýỵỷỹđ]/iu.test(rest.replace(/\([^)]*\)/gu, ''))) return null;
  return rest;
}

/** Split only at an authored punctuation boundary outside parentheses, never at a word limit. */
export function shortenMeaning(raw, maxLength = 120) {
  const meaning = normalize(raw).replace(/^[-•]+\s*/u, '').trim();
  if (!meaning || isReference(meaning) || !/[\p{L}\p{N}]/u.test(meaning)) return null;
  if (/^(?:\([^)]*\)\s*)+$/u.test(meaning)) {
    const labels = [...meaning.matchAll(/\(([^)]*)\)/gu)].map(match => match[1]);
    if (labels.every(label => partOfSpeechFromHeading(label) || /^[a-z ,;:+-]+$/iu.test(label)
      || /học$|^(?:số nhiều\b|số ít\b)|^(?:pháp lý|quân sự|y|động vật|thực vật|máy tính|tech|econ|nghĩa bóng|nghĩa đen|từ cổ(?:,\s*nghĩa cổ)?|thông tục|từ lóng|từ mỹ(?:,\s*nghĩa mỹ)?|nghĩa mỹ|tô pô|viết tắt|hàng hải|hàng không|âm nhạc|thơ ca|giải phẩu|đùa cợt|thể dục,\s*thể thao)$/iu.test(label))) return null;
  }
  if (meaning.length <= maxLength) return meaning;
  let depth = 0; const boundaries = [];
  for (let index = 0; index < meaning.length; index++) {
    if (meaning[index] === '(') depth++;
    else if (meaning[index] === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && /[;,]/u.test(meaning[index])) boundaries.push(index);
    else if (depth === 0 && /[.!?]/u.test(meaning[index]) && !/[.!?\d]/u.test(meaning[index - 1] ?? '') && /\s|$/u.test(meaning[index + 1] ?? '')) boundaries.push(index + 1);
  }
  const boundary = boundaries.filter(end => end <= maxLength).at(-1);
  if (boundary === undefined) return null;
  const selected = meaning.slice(0, boundary).replace(/[;,]+$/u, '').trim();
  return selected.length >= 2 && !isReference(selected) && withoutLabels(selected).length >= 2 ? selected : null;
}

export function extractSenses(fullMeaning) {
  const senses = []; let pos = 'unspecified'; let references = 0; let overlong = 0;
  for (const raw of fullMeaning.normalize('NFC').split('|')) {
    let token = normalize(raw);
    if (!token) continue;
    if (token.startsWith('@')) { pos = 'unspecified'; continue; }
    if (/^[=+!]/u.test(token)) continue;
    const heading = partOfSpeechFromHeading(token);
    if (heading) { pos = heading; const inline = inlineHeadingMeaning(token); if (!inline) continue; token = inline; }
    if (/^[=+!\/]/u.test(token) || /^#?\s*-?\s*[^\p{L}]*[a-z, :\u0250-\u02ff-]+\/\s*$/iu.test(token)) continue;
    token = token.replace(/^#-\s*/u, '');
    if (token.startsWith('*')) { pos = 'unspecified'; continue; }
    const meaning = token.replace(/^[-•]+\s*/u, '').trim();
    if (isReference(meaning)) { references++; continue; }
    if (pos === 'abbreviation' && /^[a-z ]+$/iu.test(meaning)) { references++; continue; }
    const selected = shortenMeaning(meaning);
    if (!selected) { if (meaning.length > 120) overlong++; continue; }
    // A naked alternate English spelling in an extra column is not a Vietnamese gloss.
    if (pos === 'unspecified' && !/^[-•]/u.test(token) && /^[a-z]+,\S/u.test(selected)) {
      senses.push({ ambiguous: true, fullMeaning: meaning, partOfSpeech: pos }); continue;
    }
    senses.push({ meaning: selected, fullMeaning: meaning, partOfSpeech: pos });
  }
  return { senses, references, overlong };
}

export function buildCsvCatalog(input, options = {}) {
  const { text, encoding } = decodeCsv(input);
  const lines = text.split(/\r\n|\n|\r/u);
  const header = parseCsvRow(lines[0]);
  if (normalize(header.english ?? '').toLowerCase() !== 'english' || normalize(header.fullMeaning ?? '').toLowerCase() !== 'vietnamese_analytics') throw new Error('Unexpected CSV header');
  const stats = { sourceRecords: 0, physicalLines: lines.length, blankRows: 0, eligibleRecords: 0, duplicateHeadwordRows: 0, duplicateAnswers: 0, words: 0, longWords: 0, missingPosRows: 0, shortenedMeanings: 0, referenceSenses: 0, syntaxRepairedRows: 0, recoveredPronunciationRows: 0, byPartOfSpeech: {}, byDifficulty: {}, exclusions: {} };
  const bank = new Map(); const seen = new Set(); const rows = []; const exclusionSamples = {}; const mappings = [];
  const reject = (reason, record) => {
    stats.exclusions[reason] = (stats.exclusions[reason] ?? 0) + 1;
    (exclusionSamples[reason] ??= []).length < 8 && exclusionSamples[reason].push({ row: record.row, english: record.english, fullMeaning: record.fullMeaning?.slice(0, 500) ?? record.rawRow });
    return { ...record, status: 'excluded', reason };
  };
  for (let index = 1; index < lines.length; index++) {
    let rawRow = lines[index];
    if (!rawRow.trim()) { stats.blankRows++; continue; }
    const row = index + 1; let parsed = parseCsvRow(rawRow);
    while (parsed.incomplete && index + 1 < lines.length) { rawRow += '\n' + lines[++index]; parsed = parseCsvRow(rawRow); }
    if (parsed.incomplete) throw new Error(`Unterminated quoted CSV field at row ${row}`);
    stats.sourceRecords++;
    if (parsed.syntaxRepair) stats.syntaxRepairedRows++;
    let record = { row, rawRow, ...parsed };
    if (parsed.error) record = reject(parsed.error, record);
    else {
      const headword = normalizeHeadword(parsed.english, parsed.fullMeaning);
      record.answer = headword.answer;
      if (headword.pronunciationRecovery) { stats.recoveredPronunciationRows++; record.pronunciationRecovery = true; }
      if (headword.reason) record = reject(headword.reason, record);
      else {
        stats.eligibleRecords++;
        if (seen.has(headword.answer)) stats.duplicateHeadwordRows++;
        seen.add(headword.answer);
        const extracted = extractSenses(parsed.fullMeaning);
        stats.referenceSenses += extracted.references;
        const firstSelected = extracted.senses.find(sense => sense.meaning);
        const preferred = preferredBasicSourceSense(headword.answer, extracted.senses);
        const selected = preferred ?? firstSelected;
        const sourceSenseSelection = preferred && preferred !== firstSelected ? {
          answer: headword.answer, sourceRow: row, reason: 'Existing CSV sense matches the authored basic-sense guard and an allowed explicit source POS',
          oldSelected: { meaning: firstSelected.meaning, partOfSpeech: firstSelected.partOfSpeech, fullMeaning: firstSelected.fullMeaning },
          newSelected: { meaning: selected.meaning, partOfSpeech: selected.partOfSpeech, fullMeaning: selected.fullMeaning },
        } : undefined;
        if (!selected) record = reject(extracted.senses.some(sense => sense.ambiguous) ? 'ambiguous-columns' : extracted.references ? 'reference-only' : extracted.overlong ? 'meaning-over-120-without-boundary' : 'no-usable-meaning', record);
        else {
          const word = { id: `csv-${headword.answer}`, answer: headword.answer, meaning: selected.meaning, category: LABELS[selected.partOfSpeech], partOfSpeech: selected.partOfSpeech, difficulty: headword.answer.length <= 5 ? 1 : headword.answer.length <= 8 ? 2 : 3 };
          const quality = (word.partOfSpeech === 'unspecified' ? 10 : word.partOfSpeech === 'abbreviation' ? 40 : 100) + (/\[[^\]]*\]\s*$/u.test(parsed.english) ? 5 : 0) + (preferred ? 20 : 0);
          const previous = bank.get(word.answer);
          if (previous && previous.quality >= quality) {
            stats.duplicateAnswers++; record = reject('duplicate-answer', { ...record, keptRow: previous.row });
          } else {
            if (previous) {
              stats.duplicateAnswers++;
              Object.assign(previous.record, reject('duplicate-answer', { ...previous.record, keptRow: row }));
            }
            record = { ...record, status: 'accepted', selected: word, selectedFullMeaning: selected.fullMeaning, ...(sourceSenseSelection ? { sourceSenseSelection } : {}) };
            bank.set(word.answer, { word, row, record, quality });
          }
        }
      }
    }
    if (options.includeRecords) rows.push(record);
  }
  const rawWords = [...bank.values()].map(value => value.word).sort((a, b) => a.answer.localeCompare(b.answer, 'en'));
  const grading = classifyWords(rawWords, {
    frequency: options.frequency,
    fullMeanings: new Map([...bank].map(([answer, entry]) => [answer, entry.record.selectedFullMeaning])),
    sourceRows: new Map([...bank].map(([answer, entry]) => [answer, entry.row])),
  });
  const words = grading.words;
  const gradesByAnswer = new Map(grading.grades.map(grade => [grade.answer, grade]));
  for (const word of words) {
    stats.words++; if (word.answer.length >= 7) stats.longWords++;
    const chosen = bank.get(word.answer);
    chosen.record.selected = word;
    chosen.record.classification = gradesByAnswer.get(word.answer);
    if (word.partOfSpeech === 'unspecified') stats.missingPosRows++;
    if (chosen.record.selectedFullMeaning !== word.meaning) stats.shortenedMeanings++;
    if (mappings.length < 20 || ['water', 'apple', 'run', 'hurtful', 'friendly', 'the', 'quickly', 'access', 'abbreviation', 'abalone', 'ant', 'its', 'shun', 'twill'].includes(word.answer)) mappings.push({ row: chosen.row, english: chosen.record.english, ...word });
    stats.byPartOfSpeech[word.partOfSpeech] = (stats.byPartOfSpeech[word.partOfSpeech] ?? 0) + 1;
    stats.byDifficulty[word.difficulty] = (stats.byDifficulty[word.difficulty] ?? 0) + 1;
  }
  stats.byLearningLevel = grading.stats.byLevel;
  const preferredSourceSenseSelections = [...bank.values()].flatMap(entry => entry.record.sourceSenseSelection ? [entry.record.sourceSenseSelection] : []);
  stats.preferredSourceSenseSelections = preferredSourceSenseSelections.length;
  const bytes = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const classification = { method: grading.method, frequencySource: grading.frequencySource, stats: grading.stats };
  const source = { kind: 'local-csv', name: 'English - Vietnamese.csv (người dùng cung cấp)', localFile: options.localFile ?? DEFAULT_INPUT, sha256, encoding, license: CSV_LICENSE, snapshot: `sha256:${sha256.slice(0, 12)}`, inputBytes: bytes.length, importerVersion: 'csv-3-preferred-senses', classification, stats };
  const report = { version: 1, source, stats, classification, preferredSourceSenseSelections, rules: { answer: 'Single lowercase ASCII word, 3–18 letters; verified pronunciation suffix removed', meaning: 'Prefer an existing CSV basic sense for the small authored starter set only when both sense and explicit source POS match its guard; otherwise first usable source sense. Each changed selection is audited. ≤120 characters at source punctuation boundaries.', duplicates: 'Prefer an explicit lexical POS over abbreviation or unspecified POS; prefer an existing guarded basic sense, then a complete pronunciation entry on equal POS quality; otherwise retain source order', unspecified: 'Source does not identify POS; no POS inferred from spelling', references: 'Reference-only senses are not copied across related headwords', quality: 'Structural import of user-provided source; no external translation or claim of full semantic review', difficulty: 'Frequency and source-sense estimated learningLevel 1–10; loot difficulty derived from bands 1–3, 4–6, 7–10. Not CEFR.' }, exclusionSamples, mappings };
  return { version: 1, source, words, report, grades: grading.grades, ...(options.includeRecords ? { records: rows } : {}) };
}

async function atomicWrite(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, content);
  await rename(temporary, path);
}

export async function importCsvDictionary(options = {}) {
  const inputPath = options.inputPath ?? DEFAULT_INPUT;
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT;
  const directory = dirname(outputPath);
  const archivePath = options.archivePath ?? DEFAULT_ARCHIVE;
  const gradingArchivePath = options.gradingArchivePath ?? (archivePath === DEFAULT_ARCHIVE ? DEFAULT_GRADING_ARCHIVE : join(dirname(archivePath), 'word-grades.jsonl.gz'));
  const gradesCsvPath = options.gradesCsvPath ?? join(directory, 'learning-levels.csv');
  const bytes = await readFile(inputPath);
  const result = buildCsvCatalog(bytes, { includeRecords: true, localFile: options.localFile ?? relative(process.cwd(), resolve(inputPath)).replaceAll('\\', '/') });
  if (options.expectedSha256 && result.source.sha256 !== options.expectedSha256) throw new Error('CSV source checksum mismatch');
  if (!result.words.length) throw new Error('No usable dictionary entries; refusing to replace catalog');
  const historyPath = options.historyPath ?? 'public/vocabulary/editorial-corrections.json';
  let editorial = options.editorial;
  if (editorial === undefined) { try { editorial = JSON.parse(await readFile(historyPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  const words = editorial ? mergeCsvHistoryAliases(result.words, editorial) : result.words;
  const source = { ...result.source, archive: archivePath.replaceAll('\\', '/'), importedAt: new Date().toISOString() };
  const catalog = { version: 1, source, words };
  const report = { ...result.report, source, historyAliasWords: words.filter(word => word.historyAliases?.length).length, archiveRows: result.records.length,
    classification: { ...result.report.classification, artifacts: { csv: gradesCsvPath.replaceAll('\\', '/'), audit: gradingArchivePath.replaceAll('\\', '/') } } };
  await atomicWrite(archivePath, gzipSync(result.records.map(record => JSON.stringify(record)).join('\n') + '\n'));
  await atomicWrite(gradingArchivePath, gzipSync(result.grades.map(grade => JSON.stringify(grade)).join('\n') + '\n'));
  const columns = ['learningLevel', 'partOfSpeech', 'answer', 'meaning', 'frequencyRank', 'frequencyCount', 'difficulty', 'baseLevel', 'reasons', 'sourceRow'];
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [columns.join(','), ...result.grades.map(grade => columns.map(column => quote(column === 'reasons' ? JSON.stringify(grade.reasons) : grade[column])).join(','))].join('\r\n');
  await atomicWrite(gradesCsvPath, '\uFEFF' + csv + '\r\n');
  await atomicWrite(outputPath, JSON.stringify(catalog) + '\n');
  await atomicWrite(options.reportPath ?? join(directory, 'csv-import-report.json'), JSON.stringify(report, null, 2) + '\n');
  await atomicWrite(join(directory, 'source-manifest.json'), JSON.stringify({ version: 1, ...source, outputBytes: (await stat(outputPath)).size, report: 'csv-import-report.json' }, null, 2) + '\n');
  return { ...catalog, report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2); const value = flag => { const at = args.indexOf(flag); return at < 0 ? undefined : args[at + 1]; };
  const result = await importCsvDictionary({ inputPath: value('--input'), outputPath: value('--output'), archivePath: value('--archive'), reportPath: value('--report'), historyPath: value('--history'), expectedSha256: value('--expected-sha256') });
  console.log(JSON.stringify({ words: result.words.length, ...result.report.stats, sha256: result.source.sha256, archive: result.source.archive }, null, 2));
}
