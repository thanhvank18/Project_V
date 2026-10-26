/// <reference types="vite/client" />
import type { Word } from './types';
import { PART_OF_SPEECH_LABELS, WORDS } from './vocabulary';
import { mergeEnglishDefinitions } from './englishDictionary';

export interface DictionarySource {
  name: string;
  /** Older bundled Wiktionary catalogs omitted kind. */
  kind?: 'local-csv' | 'wiktionary';
  url?: string;
  localFile?: string;
  license: string;
  snapshot: string;
}
export interface DictionaryCatalog { words: Word[]; source: DictionarySource }

function safeHttps(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}

/** Validate a locally bundled dictionary before any of its entries can reach combat. */
export function parseDictionary(value: unknown): DictionaryCatalog {
  if (!value || typeof value !== 'object') throw new Error('Missing dictionary');
  const data = value as Record<string, unknown>;
  const source = data.source as DictionaryCatalog['source'] | undefined;
  if (data.version !== 1 || !Array.isArray(data.words) || data.words.length === 0
    || !source || typeof source.name !== 'string' || !source.name.trim()
    || typeof source.license !== 'string' || !source.license.trim()
    || typeof source.snapshot !== 'string' || !source.snapshot.trim()
    || (source.kind !== undefined && source.kind !== 'local-csv' && source.kind !== 'wiktionary')
    || (source.url !== undefined && !safeHttps(source.url))
    || (source.kind === 'local-csv' ? typeof source.localFile !== 'string' || !source.localFile.trim() : !safeHttps(source.url))) {
    throw new Error('Unsupported dictionary format');
  }
  const bank = new Map<string, Word>();
  for (const raw of data.words) {
    const word = raw as Word | null;
    if (!word || typeof word.id !== 'string' || !word.id.trim() || typeof word.answer !== 'string'
      || !/^[a-z]{3,18}$/.test(word.answer) || typeof word.meaning !== 'string'
      || !word.meaning.trim() || word.meaning.length > 120 || typeof word.category !== 'string' || !word.category.trim()
      || (word.englishMeaning !== undefined && (typeof word.englishMeaning !== 'string' || !word.englishMeaning.trim() || word.englishMeaning.length > 240))
      || typeof word.partOfSpeech !== 'string' || !Object.hasOwn(PART_OF_SPEECH_LABELS, word.partOfSpeech)
      || ![1, 2, 3].includes(word.difficulty)
      || (word.learningLevel !== undefined && (!Number.isInteger(word.learningLevel) || word.learningLevel < 1 || word.learningLevel > 10))
      || (word.historyAliases !== undefined && (!Array.isArray(word.historyAliases)
        || word.historyAliases.some(alias => typeof alias !== 'string' || !/^[a-z]{3,18}$/.test(alias) || alias === word.answer)
        || new Set(word.historyAliases).size !== word.historyAliases.length))
      || (word.sourceUrl !== undefined && !safeHttps(word.sourceUrl))
      || bank.has(word.answer)) {
      throw new Error('Invalid dictionary entry');
    }
    bank.set(word.answer, { id: word.id, answer: word.answer, meaning: word.meaning,
      category: word.category, partOfSpeech: word.partOfSpeech, difficulty: word.difficulty,
      ...(word.englishMeaning ? { englishMeaning: word.englishMeaning } : {}),
      ...(word.learningLevel !== undefined ? { learningLevel: word.learningLevel } : {}),
      ...(word.sourceUrl !== undefined ? { sourceUrl: word.sourceUrl } : {}),
      ...(word.historyAliases?.length ? { historyAliases: [...word.historyAliases] } : {}) });
  }
  // Legacy Wiktionary catalogs keep their prototype overrides. CSV is the complete source of truth.
  if (source.kind !== 'local-csv') {
    for (const word of WORDS) {
      const historyAliases = bank.get(word.answer)?.historyAliases;
      bank.set(word.answer, historyAliases ? { ...word, historyAliases } : { ...word });
    }
  }
  const words = [...bank.values()];
  const historicalOwners = new Map<string, string>();
  for (const word of words) for (const alias of word.historyAliases ?? []) {
    if (bank.has(alias) || historicalOwners.has(alias)) throw new Error('Conflicting dictionary history alias');
    historicalOwners.set(alias, word.answer);
  }
  const ambiguous = new Map<string, Word[]>();
  for (const word of words) {
    const key = `${word.meaning.trim().toLowerCase().replace(/[.,;:!?]+$/, '')}|${word.partOfSpeech}|${word.answer.length}|${word.answer[0]}|${word.answer.at(-1)}`;
    const group = ambiguous.get(key);
    if (group) group.push(word); else ambiguous.set(key, [word]);
  }
  for (const group of ambiguous.values()) {
    if (group.length < 2) continue;
    for (const word of group) {
      const visible = new Set([0, word.answer.length - 1]);
      for (const other of group) {
        if (other === word || [...visible].some(index => word.answer[index] !== other.answer[index])) continue;
        const difference = [...word.answer].findIndex((letter, index) => letter !== other.answer[index]);
        if (difference >= 0) visible.add(difference);
      }
      word.translationHint = [...word.answer].map((letter, index) => visible.has(index) ? letter : '_').join(' ');
    }
  }
  return { words, source };
}

/** A configured backend is authoritative; a failed deployment must not quietly replace its bank. */
export function dictionaryRequestUrl(apiUrl = import.meta.env.VITE_API_URL): string {
  if (!apiUrl?.trim()) return '/vocabulary/en-vi.json';
  let base: URL;
  try { base = new URL(apiUrl.trim()); }
  catch { throw new Error('Invalid dictionary API URL'); }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Invalid dictionary API URL');
  }
  base.pathname = `${base.pathname.replace(/\/+$/, '')}/api/vocabulary`;
  return base.toString();
}

export async function loadDictionary(apiUrl?: string): Promise<DictionaryCatalog> {
  const url = dictionaryRequestUrl(apiUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Dictionary unavailable (${response.status})`);
    const catalog = parseDictionary(await response.json());
    const definitions = await fetch('/vocabulary/english-definitions.json', { signal: controller.signal });
    if (!definitions.ok) throw new Error(`English dictionary unavailable (${definitions.status})`);
    // Parse again after reviewed POS/meaning corrections to regenerate unambiguous clue hints.
    const result = parseDictionary({ version: 1, source: catalog.source, words: mergeEnglishDefinitions(catalog.words, await definitions.json()) });
    if (!result.words.some(word => word.englishMeaning)) throw new Error('English dictionary contains no playable definitions');
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Dictionary request timed out');
    throw error;
  } finally { clearTimeout(timeout); }
}
