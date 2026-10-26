import type { PartOfSpeech, Word } from './types';

const parts = new Set<PartOfSpeech>(['noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun', 'conjunction', 'interjection', 'determiner', 'numeral', 'prefix', 'suffix', 'abbreviation', 'unspecified']);
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const validText = (value: unknown, limit: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= limit && !/[\u0000-\u001f\u007f]/u.test(value);

/** Merge a reproducible, separately attributed review layer without rewriting the supplied CSV. */
export function mergeEnglishDefinitions(words: readonly Word[], value: unknown): Word[] {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.source) || !validText(value.source.name, 300)
    || !validText(value.source.license, 1000) || !validText(value.source.snapshot, 300) || !isRecord(value.entries)) {
    throw new Error('Unsupported English dictionary format');
  }
  const entries = new Map<string, { meaning: string; partOfSpeech: PartOfSpeech; vietnameseMeaning?: string }>();
  for (const [answer, entry] of Object.entries(value.entries)) {
    if (!/^[a-z]{3,18}$/.test(answer) || !isRecord(entry) || !validText(entry.meaning, 240)
      || !parts.has(entry.partOfSpeech as PartOfSpeech)
      || (entry.vietnameseMeaning !== undefined && !validText(entry.vietnameseMeaning, 120))) {
      throw new Error('Invalid English dictionary entry');
    }
    entries.set(answer, entry as { meaning: string; partOfSpeech: PartOfSpeech; vietnameseMeaning?: string });
  }
  const excluded = new Set<string>();
  const renames = new Map<string, string>();
  const quarantined = new Set<string>();
  if (value.excluded !== undefined) {
    if (!Array.isArray(value.excluded)) throw new Error('Invalid dictionary exclusions');
    for (const item of value.excluded) {
      if (!isRecord(item) || typeof item.answer !== 'string' || !/^[a-z]{3,18}$/.test(item.answer)
        || !validText(item.reason, 500) || entries.has(item.answer)
        || (item.canonical !== undefined && (typeof item.canonical !== 'string' || !/^[a-z]{3,18}$/.test(item.canonical) || item.canonical === item.answer))) throw new Error('Invalid dictionary exclusions');
      excluded.add(item.answer);
      if (typeof item.canonical === 'string') renames.set(item.answer, item.canonical);
    }
  }
  if (value.quarantined !== undefined) {
    if (!Array.isArray(value.quarantined)) throw new Error('Invalid dictionary quarantine');
    for (const item of value.quarantined) {
      if (!isRecord(item) || typeof item.answer !== 'string' || !/^[a-z]{3,18}$/.test(item.answer)
        || !validText(item.reason, 500) || entries.has(item.answer) || excluded.has(item.answer)) throw new Error('Invalid dictionary quarantine');
      quarantined.add(item.answer);
    }
  }
  const original = new Map(words.map(word => [word.answer, word]));
  const reviewed = new Map(words.filter(word => !excluded.has(word.answer) && !quarantined.has(word.answer)).map(word => [word.answer, { ...word }]));
  for (const [from, to] of renames) {
    if (excluded.has(to)) throw new Error('Chained dictionary rename is not supported');
    if (quarantined.has(to)) continue;
    const retired = original.get(from);
    // Already merged API catalogs do not contain the retired headword.
    if (!retired) continue;
    const existing = reviewed.get(to);
    if (!existing && !entries.get(to)?.vietnameseMeaning) throw new Error(`Missing corrected dictionary entry: ${to}`);
    reviewed.set(to, { ...(existing ?? { ...retired, answer: to }),
      historyAliases: [...new Set([...(existing?.historyAliases ?? []), ...(retired.historyAliases ?? []), from])].filter(alias => alias !== to) });
  }
  return [...reviewed.values()].map(word => {
    const entry = entries.get(word.answer);
    if (!entry) {
      if (value.quarantined !== undefined) throw new Error(`Incomplete bilingual dictionary: ${word.answer}`);
      return { ...word };
    }
    // A POS change must be accompanied by the corrected Vietnamese sense, not applied silently.
    if (word.partOfSpeech !== entry.partOfSpeech && !entry.vietnameseMeaning) throw new Error(`Definition part of speech mismatch: ${word.answer}`);
    return { ...word, englishMeaning: entry.meaning, partOfSpeech: entry.partOfSpeech,
      ...(entry.vietnameseMeaning ? { meaning: entry.vietnameseMeaning, translationHint: undefined } : {}) };
  });
}

/** Both modes retain the same canonical history keys. Never serve untranslated clues in English. */
export function vocabularyForLanguage(words: readonly Word[], language: 'vi' | 'en'): Word[] {
  const bank = words.filter(word => language === 'vi' || word.englishMeaning).map(word => ({ ...word,
    meaning: language === 'en' ? word.englishMeaning! : word.meaning, translationHint: undefined as string | undefined }));
  const groups = new Map<string, Word[]>();
  for (const word of bank) {
    const key = `${word.meaning.toLowerCase().trim().replace(/[.,;:!?]+$/, '')}|${word.partOfSpeech}|${word.answer.length}|${word.answer[0]}|${word.answer.at(-1)}`;
    const group = groups.get(key) ?? []; group.push(word); groups.set(key, group);
  }
  for (const group of groups.values()) if (group.length > 1) for (const word of group) {
    const visible = new Set([0, word.answer.length - 1]);
    for (const other of group) if (other !== word && ![...visible].some(index => word.answer[index] !== other.answer[index])) {
      const difference = [...word.answer].findIndex((letter, index) => letter !== other.answer[index]);
      if (difference >= 0) visible.add(difference);
    }
    word.translationHint = [...word.answer].map((letter, index) => visible.has(index) ? letter : '_').join(' ');
  }
  return bank;
}
