export const PLAYER_NAME_MAX_LENGTH = 24;
export const LEADERBOARD_CATEGORY_LIMIT = 50;

export interface DeckLeaderboardEntry {
  id: string;
  players: string[];
  score: number;
  words: number;
  accuracy: number;
  durationMs: number;
  endedAt: number;
  reason: 'defeat' | 'vocabulary-complete';
}

export interface DeckLeaderboard {
  deckId: string;
  expiresAt: number;
  entries: DeckLeaderboardEntry[];
}

export interface DeckResultStatus {
  runId: string;
  status: 'saving' | 'saved' | 'failed' | 'unranked';
}

/** Display names are public labels, not accounts or unique identities. */
export function normalizePlayerName(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 200 || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  const name = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const length = [...name].length;
  return length >= 1 && length <= PLAYER_NAME_MAX_LENGTH ? name : null;
}

export function compareLeaderboardEntries(a: DeckLeaderboardEntry, b: DeckLeaderboardEntry): number {
  return b.score - a.score || b.words - a.words || b.accuracy - a.accuracy
    || a.durationMs - b.durationMs || a.endedAt - b.endedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Validate both persisted records and responses before displaying their contents. */
export function parseLeaderboardEntry(value: unknown): DeckLeaderboardEntry | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(row.id)
    || !Array.isArray(row.players) || row.players.length < 1 || row.players.length > 4) return null;
  const players = row.players.map(normalizePlayerName);
  if (players.some(name => !name)) return null;
  if (typeof row.score !== 'number' || !Number.isSafeInteger(row.score) || row.score < 0
    || typeof row.words !== 'number' || !Number.isSafeInteger(row.words) || row.words < 0
    || typeof row.accuracy !== 'number' || !Number.isFinite(row.accuracy) || row.accuracy < 0 || row.accuracy > 100
    || typeof row.durationMs !== 'number' || !Number.isFinite(row.durationMs) || row.durationMs < 0 || row.durationMs > 86_400_000
    || typeof row.endedAt !== 'number' || !Number.isSafeInteger(row.endedAt) || row.endedAt <= 0
    || !['defeat', 'vocabulary-complete'].includes(String(row.reason))) return null;
  return { id: row.id, players: players as string[], score: row.score, words: row.words, accuracy: row.accuracy,
    durationMs: row.durationMs, endedAt: row.endedAt, reason: row.reason as DeckLeaderboardEntry['reason'] };
}
