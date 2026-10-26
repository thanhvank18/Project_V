/** Enrich the pinned WordNet subset with sense-aware English Wiktionary data. */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { createGunzip, gunzipSync, gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { buildEnglishDefinitions, prepareEnglishClue, readWordnetArchive, WORDNET_SOURCE } from './import-english-definitions.mjs';
import { applySourceRepairs, applyVietnameseCorrections, auditVietnameseDictionary, isMetadataOnly } from './audit-vietnamese-dictionary.mjs';

export const WIKTIONARY_SOURCE = {
  name: 'English Wiktionary via Kaikki / Wiktextract',
  url: 'https://kaikki.org/dictionary/English/',
  downloadUrl: 'https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz',
  snapshot: '2026-10-21 extraction; 2026-10-01 enwiktionary dump',
  license: 'CC-BY-SA-4.0',
  sha256: 'cabb3a13b7179d5f8c5909e06b1dcd2e2ae6465d05f35de56509a5b4e2bf0a49',
};
const RAW = '.cache/english-wordnet/kaikki-english-20261021.jsonl.gz';
const LEAN = '.cache/english-wordnet/kaikki-game-senses.json';
const POS = { noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition', pron: 'pronoun', conj: 'conjunction', intj: 'interjection', num: 'numeral', det: 'determiner', article: 'determiner', prefix: 'prefix', suffix: 'suffix', name: 'noun' };
const clean = value => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
const VALID_POS = new Set([...Object.values(POS), 'abbreviation']);

async function readFrozenSource(name) {
  try { return JSON.parse(gunzipSync(await readFile(`scripts/data/${name}.json.gz`)).toString('utf8')); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

export function sourceReference(gloss) {
  return gloss.match(/^(?:Synonym of\s+)?([\p{L}'’-]+)[.!]?$/u)?.[1]
    ?? gloss.match(/^(?:(?:American|British|Canadian|Australian|Dated|Obsolete) )?(?:standard )?spelling of ([\p{L}'’ -]+)[.!]?$/iu)?.[1]?.replace(/[.!]$/u, '');
}

export function compactWiktionaryRow(row) {
  if (row.lang_code !== 'en' || typeof row.word !== 'string' || !row.word.trim() || row.word.length > 100 || !POS[row.pos]) return undefined;
  return {
    word: row.word, partOfSpeech: POS[row.pos], sourcePartOfSpeech: row.pos,
    senses: (row.senses ?? []).map(sense => ({
      glosses: (sense.glosses ?? []).map(clean),
      tags: [...new Set([...(row.tags ?? []), ...(sense.tags ?? [])])],
      ...(sense.id ? { id: sense.id } : {}),
      ...(sense.form_of ? { formOf: sense.form_of.map(value => value.word) } : {}),
      ...(sense.alt_of ? { altOf: sense.alt_of.map(value => value.word) } : {}),
      translations: (sense.translations ?? []).filter(value => value.lang_code === 'vi' || value.code === 'vi').map(value => clean(value.word)),
    })),
  };
}

/** Keep a second, bounded set of referenced lemmas, including accented words and phrases. */
export async function loadReferenceIndex(index) {
  const wanted = new Set();
  for (const rows of Object.values(index.entries)) for (const row of rows) for (const sense of row.senses) {
    const references = [...(sense.altOf ?? []), ...(sense.formOf ?? [])];
    for (const gloss of sense.glosses) {
      const synonym = sourceReference(gloss);
      if (synonym) references.push(synonym);
    }
    for (const reference of references) {
      const key = reference.toLowerCase();
      if (reference.length <= 100 && !Object.hasOwn(index.entries, key)) wanted.add(key);
    }
  }
  const key = createHash('sha256').update([...wanted].sort().join('\n')).digest('hex');
  const path = '.cache/english-wordnet/kaikki-reference-senses.json';
  try { const cache = JSON.parse(await readFile(path, 'utf8')); if (cache.key === key && cache.sha256 === WIKTIONARY_SOURCE.sha256) return cache; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const frozen = await readFrozenSource('kaikki-reference-senses-20261021');
  if (frozen?.key === key && frozen.sha256 === WIKTIONARY_SOURCE.sha256) return frozen;
  const entries = Object.create(null), compressed = createReadStream(RAW), checksum = createHash('sha256');
  compressed.on('data', chunk => checksum.update(chunk));
  const uncompressed = compressed.pipe(createGunzip());
  compressed.on('error', error => uncompressed.destroy(error));
  for await (const line of createInterface({ input: uncompressed, crlfDelay: Infinity })) {
    let raw;
    try { raw = JSON.parse(line); } catch { continue; }
    if (!wanted.has(String(raw.word).toLowerCase())) continue;
    const row = compactWiktionaryRow(raw);
    if (row) (entries[row.word.toLowerCase()] ??= []).push(row);
  }
  if (checksum.digest('hex') !== WIKTIONARY_SOURCE.sha256) throw new Error('Kaikki source checksum mismatch');
  const result = { key, sha256: WIKTIONARY_SOURCE.sha256, requestedLemmas: wanted.size, matchedLemmas: Object.keys(entries).length, entries };
  await writeFile(path, JSON.stringify(result));
  return result;
}

export async function loadWiktionaryIndex(words, { refresh = false } = {}) {
  const key = createHash('sha256').update(words.map(word => word.answer).sort().join('\n')).digest('hex');
  if (!refresh) {
    try { const cached = JSON.parse(await readFile(LEAN, 'utf8')); if (cached.key === key && cached.source.sha256 === WIKTIONARY_SOURCE.sha256) return cached; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const frozen = await readFrozenSource('kaikki-game-senses-20261021');
    if (frozen?.key === key && frozen.source.sha256 === WIKTIONARY_SOURCE.sha256) return frozen;
  }
  const wanted = new Set(words.map(word => word.answer));
  const entries = Object.create(null);
  const compressed = createReadStream(RAW), checksum = createHash('sha256');
  compressed.on('data', chunk => checksum.update(chunk));
  const uncompressed = compressed.pipe(createGunzip());
  compressed.on('error', error => uncompressed.destroy(error));
  let totalRows = 0, retainedRows = 0, malformedRows = 0;
  const malformedSamples = [];
  for await (const line of createInterface({ input: uncompressed, crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    totalRows++;
    let raw;
    try { raw = JSON.parse(line); }
    catch {
      // A source quotation occasionally contains a raw line break. Do not repair or use that record.
      malformedRows++;
      if (malformedSamples.length < 20) malformedSamples.push({ line: totalRows, word: line.match(/"word":\s*"([a-z]+)"/iu)?.[1] ?? null });
      continue;
    }
    if (!wanted.has(String(raw.word).toLowerCase())) continue;
    const row = compactWiktionaryRow(raw);
    if (!row) continue;
    (entries[row.word.toLowerCase()] ??= []).push(row); retainedRows++;
  }
  if (checksum.digest('hex') !== WIKTIONARY_SOURCE.sha256) throw new Error('Kaikki source checksum mismatch; audit the new snapshot before importing it.');
  const result = { key, source: WIKTIONARY_SOURCE, totalRows, retainedRows, malformedRows, malformedSamples, entries };
  await writeFile(LEAN, JSON.stringify(result));
  return result;
}

function translationMatches(meaning, translations) {
  const source = clean(meaning).toLowerCase().replace(/\([^)]*\)/gu, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return translations.some(value => {
    const term = clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    return term.length > 2 && (` ${source} `).includes(` ${term} `);
  });
}

/** Resolve inflections/alternative spellings to an actual base meaning, not a bare reference. */
export function wiktionaryCandidates(word, index, visited = new Set(), fallback = {}) {
  if (visited.has(word.answer) || visited.size >= 4) return [];
  const nextVisited = new Set([...visited, word.answer]), candidates = [];
  for (const row of Object.hasOwn(index, word.answer) ? index[word.answer] : []) {
    if (row.partOfSpeech !== word.partOfSpeech) continue;
    for (const [senseIndex, sense] of row.senses.entries()) {
      if (sense.tags.some(tag => ['misspelling', 'error-unrecognized-form', 'no-gloss'].includes(tag))) continue;
      const sourceUrl = `https://en.wiktionary.org/wiki/${encodeURIComponent(row.word)}#English`;
      const matchingTranslation = translationMatches(word.meaning, sense.translations);
      if (row.sourcePartOfSpeech === 'name' && !matchingTranslation
        && !/(?:địa lý|thành phố|thủ đô|thị trấn|thần thoại|nữ thần|tên (?:riêng|người|của người)|tháng (?:một|hai|ba|tư|năm|sáu|bảy|tám|chín|mười)|châu (?:á|âu|phi|mỹ)|lễ (?:giáng sinh|nô.?en)|đạo |tôn giáo)/iu.test(word.meaning)) continue;
      const penalty = sense.tags.filter(tag => ['obsolete', 'archaic', 'rare', 'nonstandard', 'dialectal'].includes(tag)).length * 15;
      const score = Number(matchingTranslation) * 100 + Number(row.word === word.answer) * 3 - penalty - senseIndex / 100;
      const clueAnswer = word.clueAnswer ?? word.answer;
      const referenceGloss = sourceReference(sense.glosses.at(-1) ?? '');
      // Wiktextract occasionally reads ordinary "contraction of ..." as an
      // abbreviation template. Preserve the real definition unless its text
      // actually describes a lexical cross-reference.
      const altOf = /^(?:alternative|synonym|abbreviation|initialism|acronym|clipping|obsolete|dated|(?:American|British|Canadian|Australian) spelling)\b/iu.test(sense.glosses.at(-1) ?? '') ? sense.altOf : undefined;
      const embedded = sense.glosses.at(-1)?.match(/^Synonym of .+?\([“"](.+)[”"]\)[.;]?$/u)?.[1];
      const agentMeaning = sense.glosses.at(-1)?.match(/^Agent noun of [^;]+;\s*(.+)$/iu)?.[1];
      if (embedded || agentMeaning) {
        const meaning = prepareEnglishClue(embedded ?? agentMeaning, clueAnswer);
        if (meaning) { candidates.push({ meaning, partOfSpeech: word.partOfSpeech, sourceUrl, source: 'wiktionary', senseId: sense.id, matchingTranslation, score }); continue; }
      }
      if (sense.formOf?.length || altOf?.length || referenceGloss) {
        const isForm = !!sense.formOf?.length;
        const previousCandidates = candidates.length;
        for (const base of sense.formOf ?? altOf ?? [referenceGloss]) {
          if (!base || base.length > 100 || base.toLowerCase() === word.answer) continue;
          const resolvedCandidates = wiktionaryCandidates({ ...word, answer: base.toLowerCase(), clueAnswer }, index, nextVisited, fallback);
          const baseFallback = Object.hasOwn(fallback, base.toLowerCase()) ? fallback[base.toLowerCase()] : undefined;
          if (!resolvedCandidates.length && baseFallback?.partOfSpeech === word.partOfSpeech) resolvedCandidates.push(baseFallback);
          for (const resolved of resolvedCandidates) {
            const form = sense.tags.includes('plural') ? 'Plural form' : sense.tags.includes('past') ? 'Past form'
              : sense.tags.includes('comparative') ? 'Comparative form' : sense.tags.includes('superlative') ? 'Superlative form'
              : sense.tags.includes('present-participle') ? 'Present participle' : isForm ? 'Inflected form' : 'Alternative spelling';
            const prefix = referenceGloss && !sense.formOf?.length && !altOf?.length ? '' : `${form}: `;
            const meaning = prepareEnglishClue(`${prefix}${resolved.meaning}`, clueAnswer);
            if (meaning) candidates.push({ meaning, partOfSpeech: word.partOfSpeech, sourceUrl, source: 'wiktionary', senseId: sense.id, resolvedFrom: base, matchingTranslation, score: score - 5 });
          }
        }
        if (candidates.length > previousCandidates || sense.formOf?.length || altOf?.length || /^(?:Synonym of|(?:(?:American|British|Canadian|Australian|Dated|Obsolete) )?(?:standard )?spelling of)\b/iu.test(sense.glosses.at(-1) ?? '')) continue;
      }
      // A nested sense contains parent then child glosses. Use the most specific complete gloss.
      for (const gloss of [...sense.glosses].reverse()) {
        if (/^(?:terms relating to|plural of|simple past|past participle|present participle|alternative|synonym of|abbreviation of|initialism of|clipping of|obsolete form of)\b/iu.test(gloss)) continue;
        const meaning = prepareEnglishClue(gloss, clueAnswer);
        if (meaning) { candidates.push({ meaning, partOfSpeech: word.partOfSpeech, sourceUrl, source: 'wiktionary', senseId: sense.id, matchingTranslation, score }); break; }
      }
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

export function enrichDefinitions(words, baseCatalog, wiktionary, corrections = {}) {
  const entries = Object.assign(Object.create(null), baseCatalog.entries), unresolved = [], verifiedPosCorrections = [], stats = { wordnet: 0, wiktionary: 0, authoredCorrections: 0, translationMatches: 0, resolvedForms: 0, verifiedPosCorrections: 0 };
  for (const word of words) {
    const correction = Object.hasOwn(corrections, word.answer) ? corrections[word.answer] : undefined;
    if (correction?.englishMeaning) {
      const meaning = prepareEnglishClue(correction.englishMeaning, word.answer);
      if (!meaning) throw new Error(`Invalid authored English meaning: ${word.answer}`);
      entries[word.answer] = { meaning, partOfSpeech: word.partOfSpeech, source: 'authored-correction', vietnameseMeaning: word.meaning };
      stats.authoredCorrections++; continue;
    }
    let candidates = wiktionaryCandidates(word, wiktionary.entries, new Set(), baseCatalog.entries);
    if (!entries[word.answer] && !candidates.length) {
      const rows = Object.hasOwn(wiktionary.entries, word.answer) ? wiktionary.entries[word.answer] : [];
      const partsOfSpeech = [...new Set(rows.filter(row => row.sourcePartOfSpeech !== 'name').map(row => row.partOfSpeech))];
      const alternatives = partsOfSpeech.flatMap(partOfSpeech => wiktionaryCandidates({ ...word, partOfSpeech }, wiktionary.entries, new Set(), baseCatalog.entries));
      const translationMatches = alternatives.filter(value => value.matchingTranslation);
      const matchedParts = [...new Set(translationMatches.map(value => value.partOfSpeech))];
      const safe = word.partOfSpeech === 'unspecified' && partsOfSpeech.length === 1 ? alternatives
        : matchedParts.length === 1 ? translationMatches : [];
      if (safe.length) {
        candidates = safe;
        const rationale = word.partOfSpeech === 'unspecified' && partsOfSpeech.length === 1
          ? 'Previously unspecified part of speech; one supported lexical part of speech in Wiktionary.'
          : 'Part of speech corrected using a source sense with a Vietnamese translation matching the current meaning.';
        verifiedPosCorrections.push({ answer: word.answer, before: word.partOfSpeech, after: candidates[0].partOfSpeech, meaning: word.meaning, reason: rationale, sourceUrl: candidates[0].sourceUrl });
      }
    }
    if (candidates.length && (!entries[word.answer] || candidates[0].matchingTranslation)) {
      const { score, matchingTranslation, ...entry } = candidates[0];
      entries[word.answer] = entry;
      if (entry.partOfSpeech !== word.partOfSpeech) { entries[word.answer].vietnameseMeaning = word.meaning; stats.verifiedPosCorrections++; }
      stats.wiktionary++; if (matchingTranslation) stats.translationMatches++;
      if (entry.resolvedFrom) stats.resolvedForms++;
    } else if (entries[word.answer]) stats.wordnet++;
    else {
      const rows = Object.hasOwn(wiktionary.entries, word.answer) ? wiktionary.entries[word.answer] : [];
      const matching = rows.filter(row => row.partOfSpeech === word.partOfSpeech);
      const tags = [...new Set(rows.flatMap(row => row.senses.flatMap(sense => sense.tags)))];
      unresolved.push({ answer: word.answer, meaning: word.meaning, partOfSpeech: word.partOfSpeech, learningLevel: word.learningLevel,
        reason: !rows.length ? 'No exact lemma in either source' : !matching.length ? 'Part of speech needs editorial review' : 'Only references, long definitions or unusable senses',
        sourcePartsOfSpeech: [...new Set(rows.map(row => row.partOfSpeech))], tags,
        sourceGlosses: rows.flatMap(row => row.senses.flatMap(sense => sense.glosses)).slice(0, 4),
      });
    }
    if (correction && entries[word.answer]) entries[word.answer].vietnameseMeaning = word.meaning;
  }
  const byAnswer = new Map(words.map(word => [word.answer, word]));
  const recoveredVietnameseForms = [];
  for (const word of words) {
    const entry = entries[word.answer];
    if (!entry?.resolvedFrom || !/^(?:\([^)]*\)\s*)*(?:số nhiều(?:\s|$)|(?:thời\s+)?quá khứ|động tính từ|phân từ)/iu.test(word.meaning)) continue;
    const base = byAnswer.get(entry.resolvedFrom.toLowerCase());
    if (!base || base.partOfSpeech !== entry.partOfSpeech || isMetadataOnly(base.meaning)
      || /^(?:\([^)]*\)\s*)*(?:số nhiều(?:\s|$)|(?:thời\s+)?quá khứ|động tính từ|phân từ|xem\s)/iu.test(base.meaning)) continue;
    const rows = Object.hasOwn(wiktionary.entries, word.answer) ? wiktionary.entries[word.answer] : [];
    const sense = rows.flatMap(row => row.senses).find(sense => sense.id === entry.senseId);
    if (!sense?.formOf?.includes(entry.resolvedFrom)) continue;
    const label = sense.tags.includes('plural') ? 'số nhiều' : sense.tags.includes('past') ? 'dạng quá khứ' : undefined;
    if (!label) continue;
    const meaning = `${base.meaning} (${label})`;
    if (meaning.length > 120 || /[<>]/u.test(meaning)) continue;
    entry.vietnameseMeaning = meaning;
    recoveredVietnameseForms.push({ answer: word.answer, base: base.answer, before: word.meaning, meaning, partOfSpeech: entry.partOfSpeech, sourceUrl: entry.sourceUrl,
      reason: 'Source explicitly identifies this grammatical form of the base word; reuse the base CSV lexical meaning with the verified form label.' });
  }
  return { catalog: { version: 1, source: { name: 'Open English WordNet + English Wiktionary', url: WIKTIONARY_SOURCE.url,
    license: 'OEWN: CC-BY-4.0; Wiktionary adaptations: CC-BY-SA-4.0', snapshot: '2025 + 2026-10' }, sources: [baseCatalog.source, wiktionary.source], entries },
  report: { total: words.length, covered: Object.keys(entries).length, statistics: stats, verifiedPosCorrections, recoveredVietnameseForms, unresolved } };
}

export function applyEnglishSupplements(catalog, words, editions, originalWords = words) {
  const entries = Object.assign(Object.create(null), catalog.entries), byAnswer = new Map(words.map(word => [word.answer, word]));
  const originals = new Map(originalWords.map(word => [word.answer, word]));
  const excluded = new Map(), applied = [];
  for (const edition of editions) {
    if (edition.version !== 1 || !edition.entries || Array.isArray(edition.entries)) throw new Error('Invalid English supplement');
    for (const [answer, item] of Object.entries(edition.entries)) {
      const meaning = prepareEnglishClue(item.meaning, answer);
      if (!meaning || !VALID_POS.has(item.partOfSpeech) || !item.reason?.trim()
        || (item.sourceUrl !== undefined && !/^https:\/\//u.test(item.sourceUrl))) throw new Error(`Invalid English supplement: ${answer}`);
      const word = byAnswer.get(answer), original = originals.get(answer);
      const before = item.before;
      if (before && ![word, original].some(value => value && (before.meaning === undefined || before.meaning === value.meaning)
        && (before.partOfSpeech === undefined || before.partOfSpeech === value.partOfSpeech))) throw new Error(`Stale English supplement: ${answer}`);
      if ((!word || word.partOfSpeech !== item.partOfSpeech) && !item.vietnameseMeaning) throw new Error(`Missing paired Vietnamese meaning: ${answer}`);
      if (item.vietnameseMeaning !== undefined && (!item.vietnameseMeaning.trim() || item.vietnameseMeaning.length > 120 || isMetadataOnly(item.vietnameseMeaning))) throw new Error(`Invalid paired Vietnamese meaning: ${answer}`);
      entries[answer] = { meaning, partOfSpeech: item.partOfSpeech, source: 'editorial-supplement',
        ...(item.vietnameseMeaning ? { vietnameseMeaning: item.vietnameseMeaning } : {}),
        ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}) };
      applied.push({ answer, reason: item.reason, sourceUrl: item.sourceUrl });
    }
    for (const item of edition.excluded ?? []) {
      if (!originals.has(item.answer) || !item.reason?.trim() || (item.canonical !== undefined && !/^[a-z]{3,18}$/u.test(item.canonical))) throw new Error(`Invalid source exclusion: ${item.answer}`);
      excluded.set(item.answer, item); delete entries[item.answer];
    }
  }
  return { catalog: { ...catalog, entries, excluded: [...excluded.values()] }, applied };
}

export function applyBilingualQualityGate(catalog, words, unresolved) {
  const entries = Object.assign(Object.create(null), catalog.entries), byAnswer = new Map(words.map(word => [word.answer, word]));
  const excluded = new Set((catalog.excluded ?? []).map(item => item.answer));
  const quarantine = new Map(unresolved.filter(item => !Object.hasOwn(entries, item.answer) && !excluded.has(item.answer)).map(item => [item.answer, { answer: item.answer, reason: item.reason }]));
  const candidates = Object.entries(entries).map(([answer, entry]) => ({ ...(byAnswer.get(answer) ?? {}), answer, partOfSpeech: entry.partOfSpeech, meaning: entry.vietnameseMeaning ?? byAnswer.get(answer)?.meaning ?? '' }));
  const audit = auditVietnameseDictionary({ words: candidates });
  for (const finding of audit.findings) {
    quarantine.set(finding.answer, { answer: finding.answer, reason: `Vietnamese clue needs review: ${finding.reasons.join(', ')}` });
    delete entries[finding.answer];
  }
  return { catalog: { ...catalog, entries, quarantined: [...quarantine.values()] }, vietnameseAudit: audit };
}

const FROZEN_INPUTS = [
  ['kaikki-game-senses.json', 'kaikki-game-senses-20261021'],
  ['kaikki-reference-senses.json', 'kaikki-reference-senses-20261021'],
  ['supplement-canonical-senses.json', 'kaikki-supplement-canonical-20261021'],
];
const EDITIONS = ['vietnamese-corrections', 'vietnamese-source-repairs', 'english-long-clues', 'english-variant-clues', 'english-pos-repairs', 'english-supplement'];

export async function enrichEnglishDefinitions({ download = false, freezeSources = false } = {}) {
  try { await stat(RAW); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (download) {
      await mkdir(dirname(RAW), { recursive: true });
      const response = await fetch(WIKTIONARY_SOURCE.downloadUrl, { signal: AbortSignal.timeout(20 * 60_000) });
      if (!response.ok || !response.body) throw new Error(`Kaikki download failed (${response.status})`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(RAW));
    }
  }
  const bank = JSON.parse(await readFile('public/vocabulary/en-vi.json', 'utf8'));
  let correctionEdition;
  try { correctionEdition = JSON.parse(await readFile('scripts/data/vietnamese-corrections.json', 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let sourceRepairEdition;
  try { sourceRepairEdition = JSON.parse(await readFile('scripts/data/vietnamese-source-repairs.json', 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const corrections = { ...(sourceRepairEdition?.entries ?? {}), ...(correctionEdition?.entries ?? {}) };
  const corrected = correctionEdition ? applyVietnameseCorrections(bank, correctionEdition) : bank;
  const words = (sourceRepairEdition ? applySourceRepairs(corrected, sourceRepairEdition) : corrected).words;
  const archive = await readFile('.cache/english-wordnet/english-wordnet-2025-json.zip');
  if (createHash('sha256').update(archive).digest('hex') !== WORDNET_SOURCE.sha256) throw new Error('WordNet archive checksum mismatch');
  const base = buildEnglishDefinitions(words, readWordnetArchive(archive));
  const wiktionary = await loadWiktionaryIndex(words);
  const references = await loadReferenceIndex(wiktionary);
  if (freezeSources) for (const [cache, name] of FROZEN_INPUTS) {
    const input = await readFile(`.cache/english-wordnet/${cache}`);
    await writeFile(`scripts/data/${name}.json.gz`, gzipSync(input, { level: 9 }));
  }
  Object.assign(wiktionary.entries, references.entries);
  let { catalog, report } = enrichDefinitions(words, base.catalog, wiktionary, corrections);
  const supplements = [];
  for (const path of ['scripts/data/english-long-clues.json', 'scripts/data/english-variant-clues.json', 'scripts/data/english-pos-repairs.json', 'scripts/data/english-supplement.json']) {
    try { supplements.push(JSON.parse(await readFile(path, 'utf8'))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const supplemented = applyEnglishSupplements(catalog, words, supplements, bank.words);
  const gated = applyBilingualQualityGate(supplemented.catalog, words, report.unresolved);
  catalog = gated.catalog;
  const originalAnswers = new Set(bank.words.map(word => word.answer));
  report.originalCovered = Object.keys(catalog.entries).filter(answer => originalAnswers.has(answer)).length;
  report.newCanonicalWords = Object.keys(catalog.entries).filter(answer => !originalAnswers.has(answer));
  report.coveredBeforeQualityGate = Object.keys(supplemented.catalog.entries).length;
  report.covered = Object.keys(catalog.entries).length;
  report.quarantined = catalog.quarantined;
  report.excluded = catalog.excluded;
  report.editorialSupplements = supplemented.applied;
  report.finalSourceCounts = Object.values(catalog.entries).reduce((counts, entry) => {
    const name = entry.synset ? 'wordnet' : entry.source;
    counts[name] = (counts[name] ?? 0) + 1;
    return counts;
  }, {});
  report.vietnameseQualityFindings = gated.vietnameseAudit;
  report.unresolved = report.unresolved.filter(item => catalog.quarantined.some(value => value.answer === item.answer));
  const contents = JSON.stringify(catalog) + '\n';
  report.outputSha256 = createHash('sha256').update(contents).digest('hex');
  report.outputBytes = Buffer.byteLength(contents); report.sources = catalog.sources;
  report.vietnameseSourceRepairs = Object.keys(sourceRepairEdition?.entries ?? {}).length;
  report.extraction = { totalRows: wiktionary.totalRows, retainedRows: wiktionary.retainedRows, malformedRows: wiktionary.malformedRows, malformedSamples: wiktionary.malformedSamples,
    additionalReferenceLemmas: references.matchedLemmas, requestedReferenceLemmas: references.requestedLemmas };
  await writeFile('public/vocabulary/english-definitions.json', contents);
  await writeFile('public/vocabulary/english-definition-report.json', JSON.stringify(report, null, 2) + '\n');
  const sourceFiles = [];
  for (const [, name] of FROZEN_INPUTS) {
    const path = `scripts/data/${name}.json.gz`, bytes = await readFile(path);
    sourceFiles.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), license: WIKTIONARY_SOURCE.license, sourceSha256: WIKTIONARY_SOURCE.sha256 });
  }
  const editions = [];
  for (const name of EDITIONS) {
    const path = `scripts/data/${name}.json`, bytes = await readFile(path), edition = JSON.parse(bytes.toString('utf8'));
    editions.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), entries: Object.keys(edition.entries).length, exclusions: edition.excluded?.length ?? 0 });
  }
  await writeFile('public/vocabulary/english-source-manifest.json', JSON.stringify({ version: 1,
    sourceCatalog: { path: 'public/vocabulary/en-vi.json', entries: bank.words.length, sha256: createHash('sha256').update(await readFile('public/vocabulary/en-vi.json')).digest('hex'), originalCsvSha256: bank.source.sha256 },
    sources: catalog.sources, frozenSources: sourceFiles, editions, extraction: report.extraction,
    output: { path: 'public/vocabulary/english-definitions.json', entries: report.covered, bytes: report.outputBytes, sha256: report.outputSha256 },
  }, null, 2) + '\n');
  console.log(JSON.stringify({ total: report.total, covered: report.covered, unresolved: report.unresolved.length, statistics: report.statistics, bytes: report.outputBytes }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await enrichEnglishDefinitions({ download: process.argv.includes('--download'), freezeSources: process.argv.includes('--freeze-sources') });
