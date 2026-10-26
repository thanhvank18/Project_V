import type { Word, WordResult } from './types';

export const FAVORITES_STORAGE_KEY = 'zvs-word-favorites-v1';
type FavoriteStorage = Pick<Storage, 'getItem' | 'setItem'>;
const validAnswer = (value: unknown): value is string => typeof value === 'string' && /^[a-z]{1,64}$/.test(value);

/** Favorites are separate from seen-word history and never change the playable deck. */
export function readWordFavorites(storage?: FavoriteStorage): { words: Set<string>; available: boolean } {
  try {
    const raw: unknown = JSON.parse((storage ?? localStorage).getItem(FAVORITES_STORAGE_KEY) ?? '[]');
    return { words: new Set(Array.isArray(raw) ? raw.filter(validAnswer) : []), available: true };
  } catch { return { words: new Set(), available: false }; }
}

export function saveWordFavorites(words: ReadonlySet<string>, storage?: FavoriteStorage): boolean {
  try {
    (storage ?? localStorage).setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...words].filter(validAnswer).sort()));
    return true;
  } catch { return false; }
}

export interface LearningReviewEntry { word: Word; result: WordResult }

/** Review only words actually seen in this run, preserving the encountered sense. */
export function selectRunReview(
  results: readonly WordResult[], wordBank: readonly Word[], hasExample: (word: Word) => boolean, limit = 3,
): LearningReviewEntry[] {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  const encountered = new Map(results.map(result => [`${result.word}\0${result.meaning}`, result]));
  const entries: LearningReviewEntry[] = [];
  const included = new Set<string>();
  for (const word of wordBank) {
    const result = encountered.get(`${word.answer}\0${word.meaning}`);
    if (!result || included.has(word.answer)) continue;
    included.add(word.answer);
    entries.push({ word, result });
  }
  const needsReview = (entry: LearningReviewEntry) => entry.result.mistakes > 0 || entry.result.completed < entry.result.encounters;
  return entries.sort((a, b) => Number(hasExample(b.word)) - Number(hasExample(a.word))
    || Number(needsReview(b)) - Number(needsReview(a))
    || b.result.mistakes - a.result.mistakes
    || a.word.answer.localeCompare(b.word.answer)).slice(0, Math.floor(limit));
}
