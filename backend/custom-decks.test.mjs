import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CustomDeckStore, CUSTOM_DECK_TTL } from './custom-decks.mjs';

const input = { title: 'Classroom practice', language: 'en', entries: [
  { answer: 'water', meaning: 'A clear liquid.', partOfSpeech: 'noun', level: 1, type: 'fill', sentence: 'I drink ___.' },
] };
const directories = [], stores = [];
const result = (now, overrides = {}) => ({ id: randomUUID(), players: ['Thanh Vân'], score: 100, words: 1,
  accuracy: 95, durationMs: 1000, endedAt: now, reason: 'vocabulary-complete', ...overrides });
async function fixture(options = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'project-v-custom-decks-')); directories.push(directory);
  const store = await new CustomDeckStore(directory, options).init(); stores.push(store);
  return { directory, store };
}
afterEach(async () => {
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) {
    const relative = path.relative(path.resolve(tmpdir()), path.resolve(directory));
    if (!relative.startsWith('project-v-custom-decks-') || relative.includes(path.sep)) throw new Error('Unsafe test cleanup');
    await rm(directory, { recursive: true, force: true });
  }
});

describe('durable expiring custom word packs', () => {
  it('validates the whole pack and assigns unguessable identity and exactly 24 hours on the server', async () => {
    const now = Date.now(), { store, directory } = await fixture({ now: () => now });
    await expect(store.create({ ...input, entries: [{ ...input.entries[0], answer: '../../etc' }] })).rejects.toMatchObject({ status: 422, code: 'validation' });
    const first = await store.create({ ...input, id: '../user-path', createdAt: 0, expiresAt: Infinity });
    const second = await store.create(input);
    expect(first.id).toMatch(/^[a-f0-9]{32}$/); expect(first.id).not.toBe(second.id);
    expect(first.createdAt).toBe(now); expect(first.expiresAt).toBe(now + CUSTOM_DECK_TTL);
    expect(JSON.parse(await readFile(path.join(directory, `${first.id}.json`), 'utf8'))).toEqual(first);
    expect(await readdir(directory)).toHaveLength(2);
    first.entries[0].meaning = 'Mutated caller';
    expect(store.get(first.id).entries[0].meaning).toBe(input.entries[0].meaning);
    expect(() => store.get('../escape')).toThrow('Không tìm thấy');
  });

  it('recovers an active link after restart and physically removes it at startup after expiry', async () => {
    let now = Date.now(); const { store, directory } = await fixture({ now: () => now });
    const deck = await store.create(input); store.close();
    now += 60_000;
    const restored = await new CustomDeckStore(directory, { now: () => now }).init(); stores.push(restored);
    expect(restored.get(deck.id)).toEqual(deck); restored.close();
    now = deck.expiresAt;
    const expired = await new CustomDeckStore(directory, { now: () => now }).init(); stores.push(expired);
    expect(() => expired.get(deck.id)).toThrow('Không tìm thấy');
    expect(await readdir(directory)).toEqual([]);
  });

  it('rejects reads at the exact expiry boundary and cleanup frees storage without a page visit', async () => {
    let now = Date.now(); const { store, directory } = await fixture({ now: () => now });
    const a = await store.create(input), b = await store.create(input);
    now = a.expiresAt;
    expect(() => store.get(a.id)).toThrow('hết hạn');
    await store.cleanup();
    expect(() => store.get(b.id)).toThrow();
    expect(store.bytes).toBe(0);
    // The read-triggered unlink is async; cleanup also waits for the other file.
    await new Promise(resolve => setImmediate(resolve));
    expect(await readdir(directory)).toEqual([]);
  });

  it('serializes simultaneous writes under quota and recovers capacity after expiry', async () => {
    let now = Date.now(); const { store } = await fixture({ now: () => now, maxDecks: 1 });
    const results = await Promise.allSettled([store.create(input), store.create(input)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected').reason).toMatchObject({ code: 'capacity', status: 503 });
    now += CUSTOM_DECK_TTL;
    await expect(store.create(input)).resolves.toMatchObject({ title: input.title });
  });

  it('does not trust edited or malformed persisted metadata', async () => {
    const { store, directory } = await fixture(); const deck = await store.create(input); store.close();
    await writeFile(path.join(directory, `${deck.id}.json`), JSON.stringify({ ...deck, expiresAt: deck.expiresAt + 1 }));
    const restored = await new CustomDeckStore(directory).init(); stores.push(restored);
    expect(() => restored.get(deck.id)).toThrow('Không tìm thấy');
  });

  it('persists one-hit rules and upgrades an older pack without a mode to health', async () => {
    const { store, directory } = await fixture();
    const oneHit = await store.create({ ...input, damageMode: 'one-hit' });
    const old = await store.create(input); store.close();
    const { damageMode: _omitted, ...legacy } = old;
    await writeFile(path.join(directory, `${old.id}.json`), JSON.stringify(legacy));
    const restored = await new CustomDeckStore(directory).init(); stores.push(restored);
    expect(restored.get(oneHit.id).damageMode).toBe('one-hit');
    expect(restored.get(old.id).damageMode).toBe('health');
    await expect(restored.create({ ...input, damageMode: 'invincible' })).rejects.toMatchObject({ status: 422, code: 'validation' });
  });

  it('persists server results with the deck, isolates links and deduplicates a match across restart', async () => {
    const now = Date.now(), { store, directory } = await fixture({ now: () => now });
    const deck = await store.create(input), other = await store.create(input), run = result(now);
    expect(store.getLeaderboard(deck.id)).toEqual({ deckId: deck.id, expiresAt: deck.expiresAt, entries: [] });
    await store.recordRun(deck.id, run);
    expect(store.getLeaderboard(other.id).entries).toEqual([]);
    const cloned = store.getLeaderboard(deck.id); cloned.entries[0].players[0] = 'Changed';
    expect(store.getLeaderboard(deck.id).entries[0].players).toEqual(['Thanh Vân']);
    expect(store.get(deck.id)).toEqual(deck);
    store.close();
    const restored = await new CustomDeckStore(directory, { now: () => now }).init(); stores.push(restored);
    await restored.recordRun(deck.id, { ...run, score: 999 });
    expect(restored.getLeaderboard(deck.id).entries).toEqual([run]);
    expect(restored.bytes).toBe((await Promise.all((await readdir(directory)).map(name => readFile(path.join(directory, name))))).reduce((sum, body) => sum + body.length, 0));
  });

  it('keeps at most 50 solo and 50 co-op results in deterministic score order', async () => {
    const now = Date.now(), { store } = await fixture({ now: () => now });
    const deck = await store.create(input);
    const runs = Array.from({ length: 110 }, (_, index) => result(now, { score: index % 55,
      players: index < 55 ? ['Solo'] : ['One', 'Two'] }));
    await Promise.all(runs.map(run => store.recordRun(deck.id, run)));
    const board = store.getLeaderboard(deck.id).entries;
    expect(board).toHaveLength(100);
    expect(board.filter(run => run.players.length === 1)).toHaveLength(50);
    expect(board.filter(run => run.players.length === 2)).toHaveLength(50);
    expect(Math.min(...board.map(run => run.score))).toBe(5);
    expect(board[0].score).toBe(54); expect(board.at(-1).score).toBe(5);
    const better = result(now, { score: 54, words: 2 });
    await store.recordRun(deck.id, better);
    expect(store.getLeaderboard(deck.id).entries[0]).toEqual(better);
  });

  it('rejects unsafe result metadata and recovers the deck when stored rankings are corrupted', async () => {
    const now = Date.now(), { store, directory } = await fixture({ now: () => now });
    const deck = await store.create(input), run = result(now);
    for (const invalid of [
      { ...run, score: Infinity }, { ...run, score: -1 }, { ...run, words: 0.5 }, { ...run, accuracy: 101 },
      { ...run, id: '../run' }, { ...run, players: [''] }, { ...run, players: ['zero\u200bwidth'] },
      { ...run, players: ['One', 'Two', 'Three', 'Four', 'Five'] }, { ...run, endedAt: now - 1 },
      { ...run, endedAt: now + 1 }, { ...run, durationMs: CUSTOM_DECK_TTL + 1 },
    ]) await expect(store.recordRun(deck.id, invalid)).rejects.toMatchObject({ code: 'validation', status: 422 });
    expect(store.getLeaderboard(deck.id).entries).toEqual([]);
    store.close();
    await writeFile(path.join(directory, `${deck.id}.json`), JSON.stringify({ ...deck,
      leaderboard: [run, { ...run, id: 'invalid' }, { ...run, id: randomUUID(), endedAt: deck.expiresAt }, run] }));
    const restored = await new CustomDeckStore(directory, { now: () => now }).init(); stores.push(restored);
    expect(restored.get(deck.id)).toEqual(deck);
    expect(restored.getLeaderboard(deck.id).entries).toEqual([run]);
  });

  it('enforces total storage quota without losing a previous ranking on a failed write', async () => {
    const now = Date.now(), { store, directory } = await fixture({ now: () => now });
    const deck = await store.create(input), run = result(now);
    const original = await readFile(path.join(directory, `${deck.id}.json`), 'utf8'), bytes = store.bytes;
    store.maxBytes = bytes;
    await expect(store.recordRun(deck.id, run)).rejects.toMatchObject({ code: 'capacity', status: 503 });
    expect(store.getLeaderboard(deck.id).entries).toEqual([]); expect(store.bytes).toBe(bytes);
    expect(await readFile(path.join(directory, `${deck.id}.json`), 'utf8')).toBe(original);
    store.maxBytes += 2000;
    await store.recordRun(deck.id, run);
    expect(store.getLeaderboard(deck.id).entries).toEqual([run]);
  });

  it('cannot resurrect a deck when it expires during an atomic result write', async () => {
    let now = Date.now(); const { store, directory } = await fixture({ now: () => now });
    const deck = await store.create(input), run = result(now);
    const persist = store.persist.bind(store);
    store.persist = async (...args) => {
      await persist(...args);
      now = deck.expiresAt;
      expect(() => store.getLeaderboard(deck.id)).toThrow('hết hạn');
    };
    await expect(store.recordRun(deck.id, run)).rejects.toMatchObject({ code: 'deck-expired', status: 410 });
    await store.cleanup();
    expect(store.bytes).toBe(0); expect(await readdir(directory)).toEqual([]);
    expect(() => store.getLeaderboard(deck.id)).toThrow('Không tìm thấy');
  });
});
