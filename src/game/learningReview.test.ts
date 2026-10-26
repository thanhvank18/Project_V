import { describe, expect, it } from 'vitest';
import { FAVORITES_STORAGE_KEY, readWordFavorites, saveWordFavorites, selectRunReview } from './learningReview';
import type { Word, WordResult } from './types';

const word = (answer: string, meaning = answer): Word => ({ id: answer, answer, meaning, category: 'test', partOfSpeech: 'noun', difficulty: 1 });
const result = (answer: string, overrides: Partial<WordResult> = {}): WordResult => ({ word: answer, meaning: answer, encounters: 1, completed: 1, mistakes: 0, assisted: 0, totalResponseMs: 1500, ...overrides });

describe('run learning review', () => {
  it('uses only encountered words and never substitutes another meaning', () => {
    const bank = [word('apple'), word('bank', 'river bank'), word('bird')];
    expect(selectRunReview([result('apple'), result('bank', { meaning: 'financial bank' })], bank, () => true).map(entry => entry.word.answer)).toEqual(['apple']);
  });
  it('prioritizes source examples then mistakes and limits the panel to three actual words', () => {
    const bank = ['apple', 'book', 'chair', 'door', 'egg'].map(answer => word(answer));
    const results = bank.map(entry => result(entry.answer, { mistakes: entry.answer === 'door' ? 3 : entry.answer === 'book' ? 1 : 0 }));
    expect(selectRunReview(results, bank, entry => entry.answer !== 'door').map(entry => entry.word.answer)).toEqual(['book', 'apple', 'chair']);
  });
  it('includes missed words and deduplicates identical entries without mutating inputs', () => {
    const bank = [word('apple'), word('apple'), word('book')];
    const results = [result('apple', { completed: 0 }), result('book')];
    expect(selectRunReview(results, bank, () => false).map(entry => entry.word.answer)).toEqual(['apple', 'book']);
    expect(bank).toHaveLength(3);
    expect(results[0].completed).toBe(0);
  });
  it('handles no encounters and invalid review limits', () => {
    expect(selectRunReview([], [word('apple')], () => true)).toEqual([]);
    expect(selectRunReview([result('apple')], [word('apple')], () => true, NaN)).toEqual([]);
    expect(selectRunReview([result('apple')], [word('apple')], () => true, -1)).toEqual([]);
  });
});

describe('word favorites persistence', () => {
  it('roundtrips only valid normalized headwords in a separate key', () => {
    const values = new Map<string, string>([['zvs-history-v1', 'untouched']]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(saveWordFavorites(new Set(['book', 'apple', '<script>', 'APPLE']), storage)).toBe(true);
    expect([...readWordFavorites(storage).words]).toEqual(['apple', 'book']);
    expect(values.get('zvs-history-v1')).toBe('untouched');
    expect(values.get(FAVORITES_STORAGE_KEY)).toBe('["apple","book"]');
  });
  it('ignores corrupted shapes and mixed data without treating objects as words', () => {
    const storage = { getItem: () => '["apple",4,null,{},"","book","apple"]', setItem() {} };
    expect([...readWordFavorites(storage).words]).toEqual(['apple', 'book']);
    expect(readWordFavorites({ ...storage, getItem: () => '{"apple":true}' }).words.size).toBe(0);
  });
  it('returns useful failure states when storage is denied or malformed', () => {
    const storage = { getItem: () => { throw new Error('Denied'); }, setItem: () => { throw new Error('Quota'); } };
    expect(readWordFavorites(storage)).toEqual({ words: new Set(), available: false });
    expect(saveWordFavorites(new Set(['apple']), storage)).toBe(false);
    expect(readWordFavorites({ ...storage, getItem: () => 'bad json' }).available).toBe(false);
  });
});
