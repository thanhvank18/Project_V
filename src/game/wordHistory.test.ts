import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Progress, RunSummary, Word } from './types';
import { wordHistoryFor } from './wordHistory';

const corrected: Word = { id: 'dict-falsehood', answer: 'falsehood', meaning: 'Điều giả dối.',
  category: 'Danh từ', partOfSpeech: 'noun', difficulty: 3, historyAliases: ['falschood', 'falsehhood'] };
const result = (word: string, counters: Partial<Progress['words'][string]> = {}): Progress['words'][string] => ({
  word, meaning: 'Nghĩa cũ', encounters: 1, completed: 1, mistakes: 0, assisted: 0,
  totalResponseMs: 100, lastSeen: 1000, nextReview: 5000, ...counters,
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('corrected word history', () => {
  it('combines all historical records without losing counters or changing stored records on repeated reads', () => {
    const history = {
      falsehood: result('falsehood', { encounters: 2, completed: 1, mistakes: 1, assisted: 1, totalResponseMs: 800 }),
      falschood: result('falschood', { encounters: 3, completed: 2, mistakes: 4, assisted: 1, totalResponseMs: 2000,
        lastSeen: 2000, nextReview: 4000 }),
      falsehhood: result('falsehhood', { completed: 0, mistakes: 2, totalResponseMs: 300, lastSeen: 1500, nextReview: 6000 }),
      unrelated: result('unrelated', { completed: 100 }),
    };
    const before = structuredClone(history);
    const combined = wordHistoryFor(corrected, history);
    expect(combined).toEqual({ word: 'falsehood', meaning: 'Điều giả dối.', encounters: 6, completed: 3,
      mistakes: 7, assisted: 2, totalResponseMs: 3100, lastSeen: 2000, nextReview: 4000 });
    expect(wordHistoryFor(corrected, history)).toEqual(combined);
    expect(history).toEqual(before);
    expect(wordHistoryFor(corrected, {})).toBeUndefined();
  });

  it('keeps totals idempotent across new canonical completions, duplicate run saves and reloads', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    const words = { falsehood: result('falsehood', { completed: 2, encounters: 2 }),
      falschood: result('falschood', { completed: 3, encounters: 3, mistakes: 4 }) };
    values.set('zvs-progress-v1', JSON.stringify({ version: 1, savedRuns: [], savedAt: 1,
      progress: { highScore: 0, runs: 2, totalWords: 5, words } }));
    vi.resetModules();
    const storage = await import('./storage');
    const loaded = await storage.loadProgress();
    expect(wordHistoryFor(corrected, loaded.words)).toMatchObject({ completed: 5, encounters: 5, mistakes: 4 });
    const summary: RunSummary = { id: 'canonical-after-correction', endedAt: 3000, score: 100, kills: 1, words: 1,
      bestCombo: 1, durationMs: 1000, accuracy: 100, wpm: 60, bossKills: 0,
      results: [{ word: corrected.answer, meaning: corrected.meaning, encounters: 1, completed: 1,
        mistakes: 1, assisted: 0, totalResponseMs: 500 }] };
    const saved = await storage.saveRun(summary);
    expect(saved.words.falschood).toEqual(words.falschood);
    expect(saved.words.falsehood).toMatchObject({ completed: 3, encounters: 3, mistakes: 1 });
    const expected = { completed: 6, encounters: 6, mistakes: 5, totalResponseMs: 700, lastSeen: 3000 };
    expect(wordHistoryFor(corrected, saved.words)).toMatchObject(expected);
    expect(wordHistoryFor(corrected, (await storage.saveRun(summary)).words)).toMatchObject(expected);
    vi.resetModules();
    const reloaded = await (await import('./storage')).loadProgress();
    expect(wordHistoryFor(corrected, reloaded.words)).toMatchObject(expected);
    expect(reloaded.totalWords).toBe(6);
  });
});
