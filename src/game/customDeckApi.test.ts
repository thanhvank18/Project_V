import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCustomDeck, customDeckApiUrl, loadCustomDeck, parseCustomDeckResponse } from './customDeckApi';
import { CUSTOM_DECK_TTL_MS, type CustomDeckInput } from './customDeck';

const input: CustomDeckInput = { title: 'My class', language: 'en', entries: [{ answer: 'water', meaning: 'A clear liquid', partOfSpeech: 'noun', level: 1, type: 'fill', sentence: 'I drink ___.' }] };
const response = () => ({ deck: { ...input, id: 'abcde12345ABCDE67890', createdAt: Date.now(), expiresAt: Date.now() + CUSTOM_DECK_TTL_MS } });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('custom deck API boundary', () => {
  it('uses the API host in production and the local proxy in development', () => {
    expect(customDeckApiUrl('', 'https://api.example.com/', 'http://localhost:5174')).toBe('https://api.example.com/api/custom-decks');
    expect(customDeckApiUrl('/id', '', 'http://localhost:5174')).toBe('http://localhost:5174/api/custom-decks/id');
    expect(() => customDeckApiUrl('', 'https://u:p@api.example.com', 'http://localhost')).toThrow();
  });
  it('rejects malformed metadata and expired payloads instead of starting the default game', () => {
    expect(parseCustomDeckResponse(response()).entries[0].sentence).toBe('I drink ___.');
    expect(() => parseCustomDeckResponse({ deck: { ...response().deck, id: '../bad' } })).toThrow();
    expect(() => parseCustomDeckResponse({ deck: { ...response().deck, createdAt: 1, expiresAt: 2 } })).toThrow('hết hạn');
  });
  it('keeps the authored survival rule and defaults old shared links to normal health', () => {
    expect(parseCustomDeckResponse(response()).damageMode).toBe('health');
    expect(parseCustomDeckResponse({ deck: { ...response().deck, damageMode: 'one-hit' } }).damageMode).toBe('one-hit');
    expect(() => parseCustomDeckResponse({ deck: { ...response().deck, damageMode: 'invincible' } })).toThrow();
  });
  it('posts only the validated author content and reads the deck envelope', async () => {
    vi.stubGlobal('location', { origin: 'http://localhost:5174' });
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response()), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    const deck = await createCustomDeck(input);
    expect(deck.title).toBe('My class');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'omit', cache: 'no-store', body: JSON.stringify(input) });
  });
  it('preserves server validation details for the editor', async () => {
    vi.stubGlobal('location', { origin: 'http://localhost:5174' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Invalid', code: 'validation', errors: [{ row: 2, field: 'answer', message: 'Duplicate' }] }), { status: 400 })));
    await expect(createCustomDeck(input)).rejects.toMatchObject({ code: 'validation', errors: [{ row: 2, field: 'answer', message: 'Duplicate' }] });
  });
  it('preserves missing/expired codes and never fetches an invalid ID', async () => {
    vi.stubGlobal('location', { origin: 'http://localhost:5174' });
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'deck-missing' }), { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadCustomDeck('../oops')).rejects.toMatchObject({ code: 'not-found' });
    expect(fetcher).not.toHaveBeenCalled();
    await expect(loadCustomDeck(response().deck.id)).rejects.toMatchObject({ code: 'deck-missing' });
  });
});
