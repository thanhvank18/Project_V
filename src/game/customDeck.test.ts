import { describe, expect, it } from 'vitest';
import { customDeckCsvTemplate, customDeckWords, CUSTOM_DECK_CSV_TEMPLATE, parseCustomDeckCsv, validateCustomDeck, type CustomDeckEntry, type CustomDeckInput } from './customDeck';
import { GameEngine } from './engine';
import { vocabularyForLanguage } from './englishDictionary';
import { compactFillPrompt } from './enemyLabelLayout';
import { localizeSnapshot } from './localization';
import { createChallenge } from './vocabulary';

const entry = (overrides: Partial<CustomDeckEntry> = {}): CustomDeckEntry => ({ answer: 'apple', meaning: 'Quả táo', partOfSpeech: 'noun', level: 1, type: 'mixed', ...overrides });
const deck = (entries = [entry()]): CustomDeckInput => ({ title: 'Fruit lesson', language: 'vi', entries });

describe('Create Mode authoring validation', () => {
  it('normalizes title and answers without substituting authored meanings', () => {
    const result = validateCustomDeck({ ...deck(), title: '  My lesson  ', entries: [entry({ answer: ' Apple ', meaning: '  A fruit, chosen by the host.  ' })] });
    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({ title: 'My lesson', entries: [{ answer: 'apple', meaning: 'A fruit, chosen by the host.' }] });
  });
  it('rejects case-insensitive duplicates with row-specific errors and no partial deck', () => {
    const result = validateCustomDeck(deck([entry(), entry({ answer: 'APPLE' })]));
    expect(result.data).toBeUndefined();
    expect(result.errors).toContainEqual({ row: 2, field: 'answer', message: 'Duplicate answer; first used in row 1.' });
  });
  it.each(['ice cream', 'mother-in-law', 'café', '<script>', 'abcdefghijklmnopqrs', '=SUM(A1)', ''])('rejects untypable answer %s', answer => {
    expect(validateCustomDeck(deck([entry({ answer })])).errors.some(error => error.field === 'answer')).toBe(true);
  });
  it('accepts one-letter answers and the maximum length', () => {
    expect(validateCustomDeck(deck([entry({ answer: 'i' }), entry({ answer: 'abcdefghijklmnopqr' })])).errors).toEqual([]);
  });
  it('checks all input dimensions and does not crash on malformed API payloads', () => {
    for (const value of [null, [], 7, 'deck']) expect(validateCustomDeck(value).data).toBeUndefined();
    const result = validateCustomDeck({ title: 'x'.repeat(81), language: 'fr', entries: [{ answer: 'apple', meaning: 'x'.repeat(401), partOfSpeech: 'thing', level: 1.5, type: 'unknown', sentence: 's'.repeat(301) }] });
    expect(new Set(result.errors.map(error => error.field))).toEqual(new Set(['title', 'language', 'meaning', 'partOfSpeech', 'level', 'type', 'sentence']));
  });
  it.each([0, 501])('rejects %i entries rather than truncating the pack', count => {
    expect(validateCustomDeck(deck(Array.from({ length: count }, () => entry()))).errors).toContainEqual({ field: 'entries', message: 'Use between 1 and 500 questions.' });
  });
  it.each(['I drink water.', 'I ___ ___ daily.', 'I ____ daily.', '___'])('rejects ambiguous fill placeholder %s', sentence => {
    expect(validateCustomDeck(deck([entry({ type: 'fill', sentence })])).errors.some(error => error.field === 'sentence')).toBe(true);
  });
  it('uses the authored sentence as the clue when a fill question has no extra meaning', () => {
    const result = validateCustomDeck(deck([entry({ answer: 'water', type: 'fill', sentence: 'I drink ___ daily.', meaning: '' })]));
    expect(result.data?.entries[0]).toMatchObject({ meaning: 'I drink ___ daily.', sentence: 'I drink ___ daily.' });
    expect(validateCustomDeck(deck([entry({ meaning: '' })])).data).toBeUndefined();
  });
});

describe('Create Mode CSV', () => {
  it('round-trips both safe downloadable templates', () => {
    expect(customDeckCsvTemplate('vi')).toBe(CUSTOM_DECK_CSV_TEMPLATE);
    for (const language of ['vi', 'en'] as const) {
      const parsed = parseCustomDeckCsv(customDeckCsvTemplate(language));
      expect(parsed.errors).toEqual([]); expect(parsed.entries).toHaveLength(5);
      expect(parsed.entries.map(item => item.type)).toEqual(['mixed', 'translate', 'fill', 'missing', 'scramble']);
      for (const line of customDeckCsvTemplate(language).split('\r\n')) for (const cell of line.split(',')) expect(cell).not.toMatch(/^[=+@-]/);
    }
    expect(parseCustomDeckCsv(customDeckCsvTemplate('en')).entries[0].meaning).toMatch(/^A round fruit/);
  });
  it('preserves BOM, CRLF, escaped quotes, commas and multiline definitions', () => {
    const parsed = parseCustomDeckCsv('\uFEFFanswer,meaning,part_of_speech,level,type,sentence\r\napple,"A round, edible fruit.\r\nAlso called ""pome"".",noun,2,translate,\r\n');
    expect(parsed.errors).toEqual([]);
    expect(parsed.entries[0]).toEqual(entry({ meaning: 'A round, edible fruit.\r\nAlso called "pome".', level: 2, type: 'translate' }));
  });
  it('defaults optional columns and ignores only entirely empty rows', () => {
    const parsed = parseCustomDeckCsv('answer,meaning\n\nCAT,A small animal\n,,');
    expect(parsed.errors).toEqual([]);
    expect(parsed.entries).toEqual([entry({ answer: 'cat', meaning: 'A small animal', partOfSpeech: 'unspecified' })]);
  });
  it('reports the physical CSV line for an invalid entry after a multiline cell', () => {
    const result = parseCustomDeckCsv('answer,meaning\napple,"A fruit\nwith seeds"\nnot-valid,No\n');
    expect(result.entries).toEqual([]);
    expect(result.errors).toContainEqual(expect.objectContaining({ row: 4, field: 'answer' }));
  });
  it.each(['answer,meaning\napple,A fruit,unquoted comma', 'answer,meaning\napple,"Unclosed', 'answer,meaning\napple,A "quote"', 'answer,meaning\napple,"Closed"oops', 'answer,meaning,extra\napple,A fruit,ignored', 'answer,answer\napple,apple', 'meaning\nA fruit'])('rejects malformed CSV atomically: %s', source => {
    const result = parseCustomDeckCsv(source);
    expect(result.entries).toEqual([]); expect(result.errors.length).toBeGreaterThan(0);
  });
  it('rejects oversized input before parsing', () => {
    expect(parseCustomDeckCsv('a'.repeat(1_000_001)).errors[0].field).toBe('csv');
  });
});

describe('authored question gameplay', () => {
  it.each(['translate', 'scramble', 'missing', 'fill'] as const)('honors %s instead of the normal rotating challenge kind', type => {
    const word = customDeckWords(deck([entry({ type, sentence: 'I eat an ___ daily.' })]))[0];
    const challenge = createChallenge(word, 'hint', 99, () => 0.2);
    expect(challenge.kind).toBe(type);
    if (type === 'fill') expect(challenge.prompt).toBe('I eat an ___ daily.');
    if (type === 'translate') expect(challenge.prompt).toBe('Quả táo');
    if (type === 'missing') expect(challenge.prompt).toBe('a _ p _ e');
    if (type === 'scramble') expect(challenge.prompt.replace(/ \/ /g, '')).not.toBe('apple');
  });
  it('keeps mixed question rotation and retains the authored clue under either UI language', () => {
    const words = customDeckWords(deck());
    for (const language of ['vi', 'en'] as const) {
      const localized = vocabularyForLanguage(words, language);
      expect(localized).toHaveLength(1); expect(localized[0].meaning).toBe('Quả táo');
      expect(createChallenge(localized[0], 'missing', 1).kind).toBe('missing');
    }
  });
  it('completes a one-letter, one-question pack without requiring built-in vocabulary or a Boss', () => {
    const engine = new GameEngine(() => 0.5, undefined, undefined, customDeckWords(deck([entry({ answer: 'i', type: 'fill', sentence: '___ am here.', meaning: '' })])));
    engine.start();
    for (let frame = 0; frame < 200 && !engine.enemies.length; frame++) engine.step(50);
    expect(engine.enemies).toHaveLength(1);
    expect(engine.snapshot().target).toMatchObject({ type: 'fill', prompt: '___ am here.', length: 1 });
    expect(localizeSnapshot(engine.snapshot(), 'en').target?.prompt).toBe('___ am here.');
    engine.typeKey('i');
    for (let frame = 0; frame < 200 && engine.snapshot().phase !== 'over'; frame++) engine.step(50);
    expect(engine.snapshot().summary).toMatchObject({ words: 1, reason: 'vocabulary-complete' });
  });
  it('bounds long fill previews around the blank while preserving the full prompt', () => {
    for (const sentence of ['___ ' + 'long context '.repeat(20), 'long context '.repeat(20) + ' ___', 'long context '.repeat(8) + '___ ' + 'more context '.repeat(8)]) {
      const preview = compactFillPrompt(sentence);
      expect(preview.length).toBeLessThanOrEqual(42); expect(preview).toContain('___');
      const word = customDeckWords(deck([entry({ type: 'fill', sentence })]))[0];
      expect(createChallenge(word, 'translate', 1).prompt).toBe(sentence);
    }
  });
});
