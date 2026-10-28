import { describe, expect, it } from 'vitest';
import { compareLeaderboardEntries, normalizePlayerName, parseLeaderboardEntry, type DeckLeaderboardEntry } from './customDeckLeaderboard';

const entry: DeckLeaderboardEntry = { id: '12345678-1234-1234-1234-123456789abc', players: ['Thanh Vân'], score: 800,
  words: 4, accuracy: 95, durationMs: 20000, endedAt: 100000, reason: 'vocabulary-complete' };

describe('custom pack public names and rankings', () => {
  it('normalizes Vietnamese names and bounds Unicode names without silently truncating them', () => {
    expect(normalizePlayerName('  Thanh   Va\u0302n  ')).toBe('Thanh Vân');
    expect(normalizePlayerName('😀'.repeat(24))).toBe('😀'.repeat(24));
    for (const value of ['', '   ', 'x'.repeat(25), '\u200b', 'Tên\nkhác', 'ab\u202ec', null, {}]) expect(normalizePlayerName(value)).toBeNull();
  });
  it('rejects malformed ranking records and strips nonpublic fields', () => {
    expect(parseLeaderboardEntry({ ...entry, token: 'private' })).toEqual(entry);
    for (const patch of [{ score: NaN }, { words: -1 }, { accuracy: 101 }, { players: [] }, { players: [''] },
      { id: '../bad' }, { durationMs: 86_400_001 }, { reason: 'invented' }]) expect(parseLeaderboardEntry({ ...entry, ...patch })).toBeNull();
  });
  it('uses deterministic score, words, accuracy, duration and completion tie breakers', () => {
    for (const patch of [{ score: 801 }, { words: 5 }, { accuracy: 96 }, { durationMs: 19999 }, { endedAt: 99999 }]) {
      expect(compareLeaderboardEntries({ ...entry, ...patch }, entry)).toBeLessThan(0);
    }
  });
});
