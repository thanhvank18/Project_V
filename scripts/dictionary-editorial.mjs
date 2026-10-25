/** Reproducible editorial patches, separate from the upstream extraction filter. */
import { createHash } from 'node:crypto';

const CATEGORIES = { noun: 'Danh từ', verb: 'Động từ', adjective: 'Tính từ',
  adverb: 'Trạng từ', preposition: 'Giới từ', pronoun: 'Đại từ', conjunction: 'Liên từ',
  interjection: 'Thán từ', determiner: 'Từ hạn định', numeral: 'Số từ', prefix: 'Tiền tố', suffix: 'Hậu tố', abbreviation: 'Viết tắt' };
const ANSWER = /^[a-z]{3,18}$/;

export function dictionaryStats(words, previous = {}) {
  const stats = { ...previous, words: words.length, longWords: 0, byPartOfSpeech: {}, byDifficulty: {} };
  for (const word of words) {
    if (word.answer.length >= 7) stats.longWords++;
    stats.byPartOfSpeech[word.partOfSpeech] = (stats.byPartOfSpeech[word.partOfSpeech] ?? 0) + 1;
    stats.byDifficulty[word.difficulty] = (stats.byDifficulty[word.difficulty] ?? 0) + 1;
  }
  return stats;
}

export function applyEditorialCorrections(data, edition) {
  if (edition?.version !== 1 || !Array.isArray(edition.corrections)
    || typeof edition.revision !== 'string' || edition.sourceSha256 !== data.source.sha256) {
    throw new Error('Editorial edition does not match the dictionary source');
  }
  const original = new Map(data.words.map(word => [word.answer, word]));
  const bank = new Map(data.words.map(word => [word.answer, structuredClone(word)]));
  const patched = new Set();
  const excluded = new Set();
  if (edition.exclusions !== undefined && !Array.isArray(edition.exclusions)) throw new Error('Invalid editorial exclusions');
  for (const item of edition.exclusions ?? []) {
    const before = original.get(item.answer);
    if (!before || excluded.has(item.answer) || !item.reason?.trim()
      || before.meaning !== item.before?.meaning || before.partOfSpeech !== item.before?.partOfSpeech
      || !Array.isArray(item.references) || !item.references.length
      || item.references.some(reference => typeof reference !== 'string' || !reference.startsWith('https://'))) {
      throw new Error(`Invalid or stale editorial exclusion: ${item.answer}`);
    }
    excluded.add(item.answer);
  }
  // Validate every patch against the unchanged source before applying any of them.
  for (const patch of edition.corrections) {
    const before = original.get(patch.answer);
    const after = patch.after;
    if (!before || patched.has(patch.answer) || excluded.has(patch.answer) || excluded.has(after?.answer) || !patch.reason?.trim()
      || before.meaning !== patch.before?.meaning || before.partOfSpeech !== patch.before?.partOfSpeech
      || !after || Object.keys(after).some(key => !['answer', 'meaning', 'partOfSpeech'].includes(key))
      || (after.answer !== undefined && (!ANSWER.test(after.answer) || after.answer === patch.answer))
      || (after.meaning !== undefined && (typeof after.meaning !== 'string' || !after.meaning.trim()
        || after.meaning.length > 120 || after.meaning !== after.meaning.normalize('NFC') || /[<>\[\]{}]/u.test(after.meaning)))
      || (after.partOfSpeech !== undefined && !Object.hasOwn(CATEGORIES, after.partOfSpeech))
      || !Object.keys(after).some(key => after[key] !== before[key])) {
      throw new Error(`Invalid or stale editorial correction: ${patch.answer}`);
    }
    patched.add(patch.answer);
  }
  // Chains/cycles of renamed headwords require an explicit, flattened migration.
  const renamed = new Set(edition.corrections.filter(patch => patch.after.answer).map(patch => patch.answer));
  // Two reviewed spellings that merge must agree; patch order must not choose a definition.
  const finalEdits = new Map();
  for (const patch of edition.corrections) {
    const target = patch.after.answer ?? patch.answer;
    const edits = finalEdits.get(target) ?? {};
    for (const key of ['meaning', 'partOfSpeech']) {
      if (patch.after[key] === undefined) continue;
      if (edits[key] !== undefined && edits[key] !== patch.after[key]) {
        throw new Error(`Conflicting merged editorial ${key}: ${target}`);
      }
      edits[key] = patch.after[key];
    }
    finalEdits.set(target, edits);
  }
  for (const answer of excluded) bank.delete(answer);
  for (const patch of edition.corrections) {
    if (renamed.has(patch.after.answer)) throw new Error(`Chained headword correction: ${patch.answer}`);
    if (patch.after.answer) continue;
    const word = bank.get(patch.answer);
    Object.assign(word, patch.after);
    word.category = CATEGORIES[word.partOfSpeech];
  }
  let mergedHeadwords = 0;
  for (const patch of edition.corrections.filter(patch => patch.after.answer)) {
    const old = bank.get(patch.answer);
    const answer = patch.after.answer;
    const existing = bank.get(answer);
    // A spelling merge keeps the canonical entry's definition unless explicitly edited.
    const word = { ...(existing ?? old), ...patch.after, answer, id: existing?.id ?? `dict-${answer}` };
    word.category = CATEGORIES[word.partOfSpeech];
    word.difficulty = answer.length <= 5 ? 1 : answer.length <= 8 ? 2 : 3;
    word.historyAliases = [...new Set([...(existing?.historyAliases ?? []), ...(old.historyAliases ?? []), old.answer])];
    bank.delete(old.answer);
    bank.set(answer, word);
    if (existing) mergedHeadwords++;
  }
  const words = [...bank.values()].sort((a, b) => a.answer.localeCompare(b.answer, 'en'));
  const editorial = {
    revision: edition.revision,
    corrections: edition.corrections.length,
    renamedHeadwords: renamed.size,
    mergedHeadwords,
    excludedEntries: excluded.size,
    review: edition.review,
    patchesSha256: createHash('sha256').update(JSON.stringify(edition)).digest('hex'),
    patchUrl: '/vocabulary/editorial-corrections.json',
  };
  return { ...data, words, source: { ...data.source,
    stats: dictionaryStats(words, data.source.stats), editorial,
    changes: `${data.source.changes} Editorial corrections of Vietnamese definitions, parts of speech and headword spelling are recorded separately with their review coverage; see editorial-corrections.json.`,
  } };
}
