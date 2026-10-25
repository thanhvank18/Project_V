import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Progress, RunSummary, Word } from './types';

const JOURNAL = 'zvs-seen-words-v1';
const BUCKET = 'zvs-seen-words-v2:';
const FALLBACK = 'zvs-progress-v1';
const persistedSeen = (values: Map<string, string>) => Object.assign({}, ...[...values]
  .filter(([key]) => key.startsWith(BUCKET)).map(([, value]) => JSON.parse(value).seenWords));
const word = (answer: string): Word => ({ id: answer, answer, meaning: answer, category: 'Test', partOfSpeech: 'noun', difficulty: 1 });
const progress = (): Progress => ({ highScore: 0, runs: 0, totalWords: 0, words: {} });
const record = (value: Progress, savedAt = 1) => ({ version: 1, progress: value, savedRuns: [], savedAt });
const run = (): RunSummary => ({ id: 'run', endedAt: 5000, score: 100, kills: 1, words: 1, bestCombo: 1,
  durationMs: 1000, accuracy: 100, wpm: 60, bossKills: 0,
  results: [{ word: 'apple', meaning: 'Quả táo', encounters: 1, completed: 1, mistakes: 0, assisted: 0, totalResponseMs: 900 }] });

function localStore() {
  const values = new Map<string, string>();
  vi.stubGlobal('indexedDB', undefined);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  return values;
}

/** Minimal asynchronous IDB harness: a write captures data before a later word is seen. */
function primaryStore(initial: unknown, holdWrites = false) {
  let data = structuredClone(initial);
  const pending: (() => void)[] = [];
  const database = {
    close: () => undefined,
    transaction: () => {
      const transaction = {
        oncomplete: undefined as (() => void) | undefined,
        abort: () => undefined,
        objectStore: () => ({
          get: () => {
            const request = { result: undefined as unknown, onsuccess: undefined as (() => void) | undefined };
            queueMicrotask(() => { request.result = structuredClone(data); request.onsuccess?.(); });
            return request;
          },
          put: (value: unknown) => {
            const captured = structuredClone(value);
            const finish = () => { data = captured; transaction.oncomplete?.(); };
            if (holdWrites) pending.push(finish); else queueMicrotask(finish);
          },
        }),
      };
      return transaction;
    },
  };
  vi.stubGlobal('indexedDB', {
    open: () => {
      const request = { result: database, onsuccess: undefined as (() => void) | undefined };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  });
  return { pending, finishWrite: () => pending.shift()?.(), read: () => structuredClone(data) };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('immediate seen-word history', () => {
  it('persists canonical and old headword keys together without erasing other progress', async () => {
    const values = localStore();
    const storage = await import('./storage');
    storage.markWordSeen({ ...word('falsehood'), historyAliases: ['falschood'] });
    expect(persistedSeen(values)).toMatchObject({ falsehood: expect.any(Number), falschood: expect.any(Number) });
    vi.resetModules();
    const reloaded = await import('./storage');
    expect((await reloaded.loadProgress()).seenWords).toMatchObject({ falsehood: expect.any(Number), falschood: expect.any(Number) });
  });
  it('survives a reload mid-run without inventing any completed run or encounter counters', async () => {
    const values = localStore();
    vi.resetModules();
    let storage = await import('./storage');
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    storage.markWordSeen(word('apple'));
    expect(persistedSeen(values)).toEqual({ apple: 1000 });
    vi.resetModules();
    storage = await import('./storage');
    const loaded = await storage.loadProgress();
    expect(loaded.seenWords).toEqual({ apple: 1000 });
    expect(loaded.runs).toBe(0);
    expect(loaded.totalWords).toBe(0);
    expect(loaded.words).toEqual({});
  });

  it('keeps first-seen time and unions a journal written by another module instance', async () => {
    const values = localStore();
    vi.resetModules();
    const storage = await import('./storage');
    const time = vi.spyOn(Date, 'now').mockReturnValue(1000);
    storage.markWordSeen(word('apple'));
    values.set(BUCKET + 'ap', JSON.stringify({ version: 2, seenWords: { apple: 900, apricot: 1500 } }));
    time.mockReturnValue(2000);
    storage.markWordSeen(word('apple'));
    storage.markWordSeen(word('water'));
    expect(persistedSeen(values)).toEqual({ apple: 900, apricot: 1500, water: 2000 });
    expect((await storage.loadProgress()).seenWords).toEqual({ apple: 900, apricot: 1500, water: 2000 });
  });

  it('persists normalized canonical and alternative answers with their earliest times across reload', async () => {
    const values = localStore();
    vi.resetModules();
    const storage = await import('./storage');
    const time = vi.spyOn(Date, 'now').mockReturnValue(1000);
    storage.markWordSeen({ ...word(' GRAY '), alternatives: [' GREY ', 'Gray'] });
    expect(persistedSeen(values)).toEqual({ gray: 1000, grey: 1000 });
    time.mockReturnValue(2000);
    storage.markWordSeen({ ...word('gray'), alternatives: ['grey', 'silver'] });
    vi.resetModules();
    const loaded = await (await import('./storage')).loadProgress();
    expect(loaded.seenWords).toEqual({ gray: 1000, grey: 1000, silver: 2000 });
    expect(loaded.runs).toBe(0);
    expect(loaded.totalWords).toBe(0);
    expect(loaded.words).toEqual({});
  });

  it('migrates legacy word history into seen answers without altering its statistics', async () => {
    const values = localStore();
    const legacy = progress();
    legacy.runs = 2;
    legacy.words.bread = { word: 'bread', meaning: 'Bánh mì', encounters: 2, completed: 0, mistakes: 1,
      assisted: 0, totalResponseMs: 0, lastSeen: 700, nextReview: 900 };
    values.set(FALLBACK, JSON.stringify(record(legacy)));
    vi.resetModules();
    const storage = await import('./storage');
    const loaded = await storage.loadProgress();
    expect(loaded.seenWords).toEqual({ bread: 700 });
    expect(loaded.runs).toBe(2);
    expect(loaded.words).toEqual(legacy.words);
  });

  it('unions older primary, newer fallback and journal instead of dropping old seen history', async () => {
    const values = localStore();
    const primary = { ...progress(), seenWords: { apple: 100 } };
    const fallback = { ...progress(), runs: 1, seenWords: { bread: 200 } };
    primaryStore(record(primary, 10));
    values.set(FALLBACK, JSON.stringify(record(fallback, 20)));
    values.set(JOURNAL, JSON.stringify({ version: 1, seenWords: { carrot: 300 } }));
    vi.resetModules();
    const loaded = await (await import('./storage')).loadProgress();
    expect(loaded.runs).toBe(1);
    expect(loaded.seenWords).toEqual({ apple: 100, bread: 200, carrot: 300 });
  });

  it('a late run save cannot clobber words journaled during its pending IDB write', async () => {
    const values = localStore();
    const primary = primaryStore(undefined, true);
    vi.resetModules();
    const storage = await import('./storage');
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    storage.markWordSeen(word('apple'));
    const saved = storage.saveRun(run());
    await vi.waitFor(() => expect(primary.pending).toHaveLength(1));
    storage.markWordSeen(word('bread'));
    primary.finishWrite();
    expect((await saved).seenWords).toEqual({ apple: 1000, bread: 1000 });
    expect(persistedSeen(values)).toEqual({ apple: 1000, bread: 1000 });
    vi.resetModules();
    const reloaded = await (await import('./storage')).loadProgress();
    expect(reloaded.seenWords).toEqual({ apple: 1000, bread: 1000 });
    expect(reloaded.runs).toBe(1);
    expect(reloaded.words.apple.encounters).toBe(1);
    expect(reloaded.words.bread).toBeUndefined();
  });

  it('recovers valid saved history when the journal JSON is malformed', async () => {
    const values = localStore();
    values.set(FALLBACK, JSON.stringify(record({ ...progress(), seenWords: { apple: 100 } })));
    values.set(JOURNAL, '{broken');
    vi.resetModules();
    const storage = await import('./storage');
    expect((await storage.loadProgress()).seenWords).toEqual({ apple: 100 });
    expect(storage.getStorageWarning()).toContain('danh sách từ đã gặp');
    storage.markWordSeen(word('bread'));
    expect((await storage.loadProgress()).seenWords).toEqual({ apple: 100, bread: expect.any(Number) });
  });

  it('filters invalid journal timestamps and answers rather than trusting malformed entries', async () => {
    const values = localStore();
    values.set(JOURNAL, JSON.stringify({ version: 1, seenWords: { apple: 100, bread: -1, water: 'yesterday', 'two words': 10, carrot: null } }));
    vi.resetModules();
    const storage = await import('./storage');
    expect((await storage.loadProgress()).seenWords).toEqual({ apple: 100 });
    expect(storage.getStorageWarning()).toContain('không hợp lệ');
  });

  it('keeps seen words in memory and warns when browser storage is denied', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    vi.resetModules();
    const storage = await import('./storage');
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    expect(() => storage.markWordSeen(word('apple'))).not.toThrow();
    expect(storage.getStorageWarning()).toContain('Tải lại giữa trận');
    expect((await storage.loadProgress()).seenWords).toEqual({ apple: 1000 });
    expect(storage.getStorageWarning()).toContain('phiên này');
  });

  it('a successful primary save retains the immediate-journal warning when localStorage is blocked', async () => {
    primaryStore(undefined);
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    vi.resetModules();
    const storage = await import('./storage');
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    storage.markWordSeen(word('bread'));
    expect((await storage.saveRun(run())).seenWords).toEqual({ bread: 1000, apple: 5000 });
    expect(storage.getStorageWarning()).toContain('Tải lại giữa trận');
    vi.resetModules();
    expect((await (await import('./storage')).loadProgress()).seenWords).toEqual({ bread: 1000, apple: 5000 });
  });

  it('migrates a v1 journal to durable buckets before removing it and preserves older bucket timestamps', async () => {
    const values = localStore();
    values.set(JOURNAL, JSON.stringify({ version: 1, seenWords: { apple: 200, bread: 300 } }));
    values.set(BUCKET + 'ap', JSON.stringify({ version: 2, seenWords: { apple: 100, apricot: 400 } }));
    vi.resetModules();
    const loaded = await (await import('./storage')).loadProgress();
    expect(loaded.seenWords).toEqual({ apple: 100, bread: 300, apricot: 400 });
    expect(persistedSeen(values)).toEqual(loaded.seenWords);
    expect(values.has(JOURNAL)).toBe(false);
    vi.resetModules();
    expect((await (await import('./storage')).loadProgress()).seenWords).toEqual(loaded.seenWords);
  });

  it('retains the entire old journal when any migration bucket cannot be written', async () => {
    const values = localStore();
    const legacy = JSON.stringify({ version: 1, seenWords: { apple: 100, bread: 200 } });
    values.set(JOURNAL, legacy);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === BUCKET + 'br') throw new Error('quota');
      values.set(key, value);
    });
    vi.resetModules();
    const storage = await import('./storage');
    expect((await storage.loadProgress()).seenWords).toEqual({ apple: 100, bread: 200 });
    expect(values.get(JOURNAL)).toBe(legacy);
    expect(storage.getStorageWarning()).toContain('lịch sử cũ vẫn được giữ');
    setItem.mockRestore();
    vi.resetModules();
    expect((await (await import('./storage')).loadProgress()).seenWords).toEqual({ apple: 100, bread: 200 });
    expect(values.has(JOURNAL)).toBe(false);
  });

  it('keeps the warning for an unsaved bucket after a different bucket writes successfully', async () => {
    const values = localStore();
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === BUCKET + 'ap') throw new Error('quota');
      values.set(key, value);
    });
    vi.resetModules();
    const storage = await import('./storage');
    storage.markWordSeen(word('apple'));
    storage.markWordSeen(word('bread'));
    expect(storage.getStorageWarning()).toContain('Tải lại giữa trận');
    expect(persistedSeen(values).apple).toBeUndefined();
    setItem.mockRestore();
    storage.markWordSeen(word('apricot'));
    expect(storage.getStorageWarning()).toBe('');
    expect(persistedSeen(values).apple).toBeGreaterThan(0);
  });

  it('recovers valid buckets when another bucket is malformed and rejects entries in the wrong bucket', async () => {
    const values = localStore();
    values.set(BUCKET + 'ap', JSON.stringify({ version: 2, seenWords: { apple: 100, bread: 200 } }));
    values.set(BUCKET + 'br', '{broken');
    vi.resetModules();
    const storage = await import('./storage');
    expect((await storage.loadProgress()).seenWords).toEqual({ apple: 100 });
    expect(storage.getStorageWarning()).toContain('danh sách từ đã gặp');
  });

  it('reads and writes only the affected small bucket while playing with 70000 seen words', async () => {
    const values = localStore();
    const buckets = new Map<string, Record<string, number>>();
    for (let index = 0; index < 70000; index++) {
      let number = index;
      const answer = Array.from({ length: 5 }, () => {
        const letter = String.fromCharCode(97 + number % 26); number = Math.floor(number / 26); return letter;
      }).join('');
      const prefix = answer.slice(0, 2);
      if (!buckets.has(prefix)) buckets.set(prefix, {});
      buckets.get(prefix)![answer] = 100;
    }
    for (const [prefix, seenWords] of buckets) values.set(BUCKET + prefix, JSON.stringify({ version: 2, seenWords }));
    vi.resetModules();
    const storage = await import('./storage');
    expect(Object.keys((await storage.loadProgress()).seenWords!)).toHaveLength(70000);
    const reads = vi.spyOn(localStorage, 'getItem');
    const writes = vi.spyOn(localStorage, 'setItem');
    storage.markWordSeen(word('apple'));
    expect(reads.mock.calls).toEqual([[BUCKET + 'ap']]);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(writes.mock.calls[0][0]).toBe(BUCKET + 'ap');
    expect(writes.mock.calls[0][1].length).toBeLessThan(5000);
    expect(persistedSeen(values).apple).toBeGreaterThan(100);
  });

  it('does not fill localStorage with a large optional statistics mirror after a successful primary save', async () => {
    const values = localStore();
    const large = progress();
    large.words.apple = { ...run().results[0], meaning: 'Nghĩa '.repeat(100000), lastSeen: 100, nextReview: 100 };
    const primary = primaryStore(record(large));
    values.set(FALLBACK, JSON.stringify(record(progress())));
    vi.resetModules();
    await (await import('./storage')).saveRun({ ...run(), results: [], words: 0 });
    expect(values.has(FALLBACK)).toBe(false);
    expect((primary.read() as { progress: Progress }).progress.words.apple.meaning).toBe(large.words.apple.meaning);
  });
});
