import { validateCustomDeck, type CustomDeck, type CustomDeckInput } from './customDeck';
import { compareLeaderboardEntries, LEADERBOARD_CATEGORY_LIMIT, parseLeaderboardEntry, type DeckLeaderboard } from './customDeckLeaderboard';

export class CustomDeckApiError extends Error {
  constructor(message: string, public code = 'unavailable', public errors: { row?: number; field: string; message: string }[] = []) { super(message); }
}

export function customDeckApiUrl(path = '', apiUrl = import.meta.env.VITE_API_URL, origin = location.origin): string {
  const url = new URL(apiUrl?.trim() || origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid custom deck API URL');
  url.pathname = `${apiUrl ? url.pathname.replace(/\/+$/, '') : ''}/api/custom-decks${path}`;
  return url.toString();
}

export function parseCustomDeckResponse(value: unknown): CustomDeck {
  const raw = value && typeof value === 'object' ? (value as { deck?: unknown }).deck : null;
  const result = validateCustomDeck(raw);
  const metadata = raw as Partial<CustomDeck> | null;
  if (!result.data || !metadata || typeof metadata.id !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(metadata.id)
    || !Number.isSafeInteger(metadata.createdAt) || !Number.isSafeInteger(metadata.expiresAt)
    || metadata.expiresAt! <= metadata.createdAt!) throw new CustomDeckApiError('Dữ liệu bộ câu hỏi chưa hợp lệ.', 'invalid-response');
  if (metadata.expiresAt! <= Date.now()) throw new CustomDeckApiError('Link bộ câu hỏi đã hết hạn.', 'deck-expired');
  return { ...result.data, id: metadata.id, createdAt: metadata.createdAt!, expiresAt: metadata.expiresAt! };
}

async function requestJson(path: string, data?: CustomDeckInput, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15000);
  try {
    const response = await fetch(customDeckApiUrl(path), {
      method: data ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit', signal: controller.signal,
      headers: { Accept: 'application/json', ...(data ? { 'Content-Type': 'application/json' } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const code = body?.code || (response.status === 410 ? 'deck-expired' : response.status === 404 ? 'not-found' : 'unavailable');
      throw new CustomDeckApiError(typeof body?.error === 'string' ? body.error : 'Chưa mở được bộ câu hỏi.', code, Array.isArray(body?.errors) ? body.errors : []);
    }
    return body;
  } catch (error) {
    if (error instanceof CustomDeckApiError || signal?.aborted) throw error;
    throw new CustomDeckApiError('Chưa kết nối được máy chủ bộ câu hỏi. Hãy thử lại.');
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

export const createCustomDeck = async (data: CustomDeckInput, signal?: AbortSignal) => parseCustomDeckResponse(await requestJson('', data, signal));
export const loadCustomDeck = (id: string, signal?: AbortSignal) => {
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(id)) return Promise.reject(new CustomDeckApiError('Link bộ câu hỏi không hợp lệ.', 'not-found'));
  return requestJson(`/${encodeURIComponent(id)}`, undefined, signal).then(parseCustomDeckResponse);
};

export function parseDeckLeaderboard(value: unknown, deckId: string): DeckLeaderboard {
  const data = value && typeof value === 'object' ? value as Partial<DeckLeaderboard> : null;
  if (!data || data.deckId !== deckId || !Number.isSafeInteger(data.expiresAt)
    || !Array.isArray(data.entries) || data.entries.length > LEADERBOARD_CATEGORY_LIMIT * 2) {
    throw new CustomDeckApiError('Dữ liệu bảng danh vọng chưa hợp lệ.', 'invalid-response');
  }
  if (data.expiresAt! <= Date.now()) throw new CustomDeckApiError('Link bộ câu hỏi đã hết hạn.', 'deck-expired');
  const entries = data.entries.map(parseLeaderboardEntry);
  if (entries.some(entry => !entry) || new Set(entries.map(entry => entry?.id)).size !== entries.length) {
    throw new CustomDeckApiError('Dữ liệu bảng danh vọng chưa hợp lệ.', 'invalid-response');
  }
  return { deckId, expiresAt: data.expiresAt!, entries: entries.filter(entry => entry !== null).sort(compareLeaderboardEntries) };
}

export async function loadDeckLeaderboard(id: string, signal?: AbortSignal): Promise<DeckLeaderboard> {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new CustomDeckApiError('Link bộ câu hỏi không hợp lệ.', 'not-found');
  return parseDeckLeaderboard(await requestJson(`/${id}/leaderboard`, undefined, signal), id);
}
