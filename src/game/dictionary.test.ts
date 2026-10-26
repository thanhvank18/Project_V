import { afterEach, describe, expect, it, vi } from 'vitest';
import { dictionaryRequestUrl, loadDictionary, parseDictionary } from './dictionary';
import { createChallenge, WORDS } from './vocabulary';
import { answersFor } from './vocabulary';
import { WordDeck } from './wordDeck';

const entry = { id: 'dict-telescope', answer: 'telescope', meaning: 'Kính thiên văn', category: 'Từ điển',
  partOfSpeech: 'noun', difficulty: 3, sourceUrl: 'https://vi.wiktionary.org/wiki/telescope' };
const pack = (words: unknown[] = [entry]) => ({ version: 1,
  source: { name: 'Wiktionary', url: 'https://kaikki.org/', license: 'CC-BY-SA-4.0', snapshot: '2026-10-02' }, words });
const csvEntry = { id: 'csv-apple', answer: 'apple', meaning: 'Nghĩa quả táo do CSV cung cấp', category: 'Từ điển CSV', partOfSpeech: 'noun', difficulty: 1 };
const csvPack = (words: unknown[] = [csvEntry]) => ({ version: 1,
  source: { kind: 'local-csv', name: 'English - Vietnamese.csv', localFile: 'Dic/English - Vietnamese.csv',
    license: 'Không kèm thông tin giấy phép', snapshot: 'sha256-local-source' }, words });
const englishPack = { version: 1, source: { name: 'English definitions', license: 'CC BY 4.0', snapshot: 'test' }, entries: {
  telescope: { meaning: 'An optical instrument used to view distant objects.', partOfSpeech: 'noun' },
  apple: { meaning: 'A round fruit with firm flesh.', partOfSpeech: 'noun' },
} };

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('local dictionary loading', () => {
  it('uses the CSV bank exactly without injecting prototype words, meanings, or invented URLs', () => {
    const data = csvPack();
    const catalog = parseDictionary(data);
    expect(catalog.words).toHaveLength(1);
    expect(catalog.words[0]).toEqual(csvEntry);
    expect(catalog.source).toEqual(data.source);
    expect(catalog.words[0].meaning).not.toBe(WORDS.find(word => word.answer === 'apple')?.meaning);
    expect(Object.hasOwn(catalog.words[0], 'sourceUrl')).toBe(false);
    expect(Object.hasOwn(catalog.source, 'url')).toBe(false);
  });
  it('accepts an optional genuine HTTPS citation without requiring Wiktionary and rejects unsafe links', () => {
    const url = 'https://dictionary.example/word/apple';
    expect(parseDictionary(csvPack([{ ...csvEntry, sourceUrl: url }])).words[0].sourceUrl).toBe(url);
    for (const sourceUrl of ['', null, 'javascript:alert(1)', 'http://dictionary.example/apple', 'https://user:password@dictionary.example/apple']) {
      expect(() => parseDictionary(csvPack([{ ...csvEntry, sourceUrl }]))).toThrow();
    }
    expect(() => parseDictionary({ ...csvPack(), source: { ...csvPack().source, url: 'javascript:alert(1)' } })).toThrow();
  });
  it('preserves the graded vocabulary level and rejects malformed levels before game startup', () => {
    for (const learningLevel of [1, 5, 10]) {
      const word = parseDictionary(csvPack([{ ...csvEntry, learningLevel }])).words[0];
      expect(word.learningLevel).toBe(learningLevel);
      expect(word.meaning).toBe(csvEntry.meaning);
    }
    for (const learningLevel of [0, 11, 2.5, '1', null, NaN, [1]]) {
      expect(() => parseDictionary(csvPack([{ ...csvEntry, learningLevel }]))).toThrow('Invalid dictionary entry');
    }
  });
  it('validates CSV provenance, canonical answers, POS, meaning limits and a nonempty bank', () => {
    for (const data of [csvPack([]), csvPack([{ ...csvEntry, answer: 'to go' }]), csvPack([{ ...csvEntry, answer: 'go' }]),
      csvPack([{ ...csvEntry, answer: 'a'.repeat(19) }]), csvPack([{ ...csvEntry, partOfSpeech: 'unknown' }]),
      csvPack([{ ...csvEntry, partOfSpeech: ['noun'] }]),
      csvPack([{ ...csvEntry, meaning: 'a'.repeat(121) }]), csvPack([csvEntry, csvEntry]),
      { ...csvPack(), source: { ...csvPack().source, localFile: undefined } },
      { ...csvPack(), source: { ...csvPack().source, kind: 'unrecognized' } }]) {
      expect(() => parseDictionary(data)).toThrow();
    }
  });
  it('keeps CSV history migrations separate from valid answers and preserves direct seen words', () => {
    const catalog = parseDictionary(csvPack([{ ...csvEntry, answer: 'falsehood', historyAliases: ['falschood'] },
      { ...csvEntry, id: 'csv-water', answer: 'water', meaning: 'Nước theo CSV' }]));
    const corrected = catalog.words.find(word => word.answer === 'falsehood')!;
    expect(answersFor(corrected)).toEqual(['falsehood']);
    const deck = new WordDeck(catalog.words);
    deck.addSeen(['falschood', 'water']);
    expect(deck.availability).toMatchObject({ total: 2, remaining: 0 });
    expect(deck.reserve(1)).toBeUndefined();
    expect(() => parseDictionary(csvPack([{ ...csvEntry, historyAliases: ['water'] },
      { ...csvEntry, id: 'csv-water', answer: 'water' }]))).toThrow('Conflicting dictionary history alias');
  });
  it('exhausts the actual CSV bank without reserving unseen prototype additions', () => {
    const catalog = parseDictionary(csvPack([csvEntry, { ...csvEntry, id: 'csv-bread', answer: 'bread', meaning: 'Bánh mì từ CSV' }]));
    const deck = new WordDeck(catalog.words, () => 0);
    const shown = [];
    while (deck.availability.remaining) {
      const [word] = deck.reserve(1)!; shown.push(word.answer); deck.markShown(word);
    }
    expect(shown.sort()).toEqual(['apple', 'bread']);
    expect(deck.availability.total).toBe(2);
    expect(deck.reserve(1)).toBeUndefined();
  });
  it('keeps misspelling migrations out of accepted answers and avoids repeating corrected historical words', () => {
    const catalog = parseDictionary(pack([{ ...entry, answer: 'falsehood', historyAliases: ['falschood'] }]));
    const corrected = catalog.words.find(word => word.answer === 'falsehood')!;
    expect(answersFor(corrected)).toEqual(['falsehood']);
    const deck = new WordDeck([corrected]);
    deck.addSeen(['falschood']);
    expect(deck.availability.remaining).toBe(0);
    expect(deck.reserve(1)).toBeUndefined();
  });
  it('preserves history aliases through authored overrides and rejects conflicting aliases', () => {
    const catalog = parseDictionary(pack([{ ...entry, answer: 'apple', historyAliases: ['appple'] }]));
    expect(catalog.words.find(word => word.answer === 'apple')).toMatchObject({ meaning: 'Quả táo', historyAliases: ['appple'] });
    for (const historyAliases of [['telescope'], ['apple'], ['wrong space'], ['typo', 'typo'], 'typo']) {
      expect(() => parseDictionary(pack([{ ...entry, historyAliases }]))).toThrow();
    }
  });
  it('renders corrected parts of speech beyond the original three-category source filter', () => {
    const catalog = parseDictionary(pack([{ ...entry, answer: 'almost', partOfSpeech: 'adverb', meaning: 'Hầu như, gần như.' }]));
    expect(catalog.words.find(word => word.answer === 'almost')?.partOfSpeech).toBe('adverb');
  });
  it('keeps a clear CSV meaning when its part of speech is explicitly unspecified', () => {
    const catalog = parseDictionary(csvPack([{ ...csvEntry, partOfSpeech: 'unspecified' }]));
    expect(catalog.words[0]).toMatchObject({ meaning: csvEntry.meaning, partOfSpeech: 'unspecified' });
  });
  it('merges by answer without changing approved meanings or historical keys', () => {
    const apple = WORDS.find(word => word.answer === 'apple')!;
    const catalog = parseDictionary(pack([entry, { ...apple, meaning: 'Imported meaning',
      sourceUrl: 'https://vi.wiktionary.org/wiki/apple' }]));
    expect(catalog.words.find(word => word.answer === 'apple')).toEqual(apple);
    expect(catalog.words.find(word => word.answer === 'telescope')?.sourceUrl).toBe(entry.sourceUrl);
    expect(new Set(catalog.words.map(word => word.answer)).size).toBe(catalog.words.length);
    expect(catalog.words.length).toBeGreaterThanOrEqual(WORDS.length);
  });
  it('rejects corrupt, unsupported or duplicate entries instead of quietly shrinking the victory target', () => {
    for (const data of [null, pack([]), pack([entry, entry]), pack([{ ...entry, meaning: '' }]),
      pack([{ ...entry, answer: 'bad phrase' }]), pack([{ ...entry, partOfSpeech: 'unknown' }]),
      pack([{ ...entry, sourceUrl: 'javascript:alert(1)' }])]) {
      expect(() => parseDictionary(data)).toThrow();
    }
  });
  it('reveals a distinguishing letter when valid spellings share a translation and ordinary hint', () => {
    const catalog = parseDictionary(pack(['adviser', 'advisor'].map(answer => ({ ...entry,
      id: `dict-${answer}`, answer, meaning: 'Người cố vấn', sourceUrl: `https://vi.wiktionary.org/wiki/${answer}` }))));
    const adviser = catalog.words.find(word => word.answer === 'adviser')!;
    const advisor = catalog.words.find(word => word.answer === 'advisor')!;
    expect(adviser.translationHint).toBe('a _ _ _ _ e r');
    expect(advisor.translationHint).toBe('a _ _ _ _ o r');
    expect(adviser.translationHint).not.toBe(advisor.translationHint);
    expect(createChallenge(adviser, 'missing', 1).prompt).toBe('a _ v _ s e r');
    expect(createChallenge(advisor, 'missing', 2).prompt).toBe('a _ v _ s o r');
  });
  it('also distinguishes CSV translations when no per-entry external URL exists', () => {
    const catalog = parseDictionary(csvPack(['adviser', 'advisor'].map(answer => ({ ...csvEntry, id: `csv-${answer}`, answer, meaning: 'Người cố vấn' }))));
    expect(catalog.words[0].translationHint).not.toBe(catalog.words[1].translationHint);
    expect(catalog.words.every(word => word.translationHint && !word.sourceUrl)).toBe(true);
  });
  it('fetches the bundled file once and fails explicitly when it cannot load', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => pack() }).mockResolvedValueOnce({ ok: true, json: async () => englishPack });
    vi.stubGlobal('fetch', fetcher);
    expect((await loadDictionary()).words.some(word => word.answer === 'telescope')).toBe(true);
    expect(fetcher).toHaveBeenNthCalledWith(1, '/vocabulary/en-vi.json', { signal: expect.any(AbortSignal) });
    expect(fetcher).toHaveBeenNthCalledWith(2, '/vocabulary/english-definitions.json', { signal: expect.any(AbortSignal) });
    fetcher.mockResolvedValue({ ok: false, status: 404 });
    await expect(loadDictionary()).rejects.toThrow('Dictionary unavailable');
  });

  it('loads the configured API using the same validation and preserves the CSV source without fallback', async () => {
    vi.stubEnv('VITE_API_URL', 'https://project-v.up.railway.app/');
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => csvPack() }).mockResolvedValueOnce({ ok: true, json: async () => englishPack });
    vi.stubGlobal('fetch', fetcher);
    expect((await loadDictionary()).words).toEqual([{ ...csvEntry, englishMeaning: englishPack.entries.apple.meaning }]);
    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://project-v.up.railway.app/api/vocabulary', { signal: expect.any(AbortSignal) });
    expect(fetcher).toHaveBeenNthCalledWith(2, '/vocabulary/english-definitions.json', { signal: expect.any(AbortSignal) });
    fetcher.mockClear().mockResolvedValue({ ok: false, status: 503 });
    await expect(loadDictionary()).rejects.toThrow('Dictionary unavailable (503)');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).not.toBe('/vocabulary/en-vi.json');
    fetcher.mockResolvedValue({ ok: true, json: async () => csvPack([]) });
    await expect(loadDictionary()).rejects.toThrow('Unsupported dictionary format');
  });

  it('normalizes API bases and rejects malformed credentials/query configuration before requesting', () => {
    expect(dictionaryRequestUrl('')).toBe('/vocabulary/en-vi.json');
    expect(dictionaryRequestUrl('  ')).toBe('/vocabulary/en-vi.json');
    expect(dictionaryRequestUrl('http://127.0.0.1:3001')).toBe('http://127.0.0.1:3001/api/vocabulary');
    expect(dictionaryRequestUrl('https://example.com/backend///')).toBe('https://example.com/backend/api/vocabulary');
    for (const value of ['railway.app', '/api', 'ftp://example.com', 'https://user:password@example.com', 'https://example.com?token=secret', 'https://example.com#data']) {
      expect(() => dictionaryRequestUrl(value)).toThrow('Invalid dictionary API URL');
    }
  });

  it('aborts a stalled dictionary request rather than leaving startup pending forever', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', fetcher);
    const result = expect(loadDictionary('https://example.com')).rejects.toThrow('Dictionary request timed out');
    await vi.advanceTimersByTimeAsync(30_000);
    await result;
    expect(fetcher.mock.calls[0][1].signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
