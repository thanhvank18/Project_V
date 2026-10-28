import { validateCustomDeck, type CustomDeck, type CustomDeckInput } from './customDeck';

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

async function requestDeck(path: string, data?: CustomDeckInput, signal?: AbortSignal): Promise<CustomDeck> {
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
    return parseCustomDeckResponse(body);
  } catch (error) {
    if (error instanceof CustomDeckApiError || signal?.aborted) throw error;
    throw new CustomDeckApiError('Chưa kết nối được máy chủ bộ câu hỏi. Hãy thử lại.');
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

export const createCustomDeck = (data: CustomDeckInput, signal?: AbortSignal) => requestDeck('', data, signal);
export const loadCustomDeck = (id: string, signal?: AbortSignal) => {
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(id)) return Promise.reject(new CustomDeckApiError('Link bộ câu hỏi không hợp lệ.', 'not-found'));
  return requestDeck(`/${encodeURIComponent(id)}`, undefined, signal);
};
