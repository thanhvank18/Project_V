import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseDictionary } from '../src/game/dictionary';
import { WordDeck } from '../src/game/wordDeck';
import { answersFor } from '../src/game/vocabulary';
import { buildCsvCatalog } from './import-csv-dictionary.mjs';
import { mergeCsvHistoryAliases } from './csv-history-migration.mjs';

const readJson = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const sourceBytes = () => readFileSync(new URL('../Dic/English - Vietnamese.csv', import.meta.url));
const baseWord = (answer, meaning = 'Nghĩa nguyên gốc CSV') => ({ id: `csv-${answer}`, answer, meaning,
  category: 'Từ điển CSV', partOfSpeech: 'noun', difficulty: 2 });

// Keep provenance/history assertions separate from the dictionary's actual translations.
const content = word => ({ id: word.id, answer: word.answer, meaning: word.meaning,
  category: word.category, partOfSpeech: word.partOfSpeech, difficulty: word.difficulty,
  learningLevel: word.learningLevel });

describe('shipped user CSV dictionary', () => {
  // This integration reads the full UTF-16 CSV and grades 70k+ words before validating the loader.
  it('accepts the freshly built CSV catalog and history migrations without source URLs or authored replacements', () => {
    const imported = buildCsvCatalog(sourceBytes());
    const editorial = readJson('../public/vocabulary/editorial-corrections.json');
    const words = mergeCsvHistoryAliases(imported.words, editorial);
    const catalog = parseDictionary({ ...imported, words });
    expect(catalog.words.length).toBeGreaterThan(0);
    expect(catalog.words.map(content)).toEqual(imported.words.map(content));
    expect(catalog.words.every(word => word.sourceUrl === undefined)).toBe(true);
  }, 20_000);
  it('ships every accepted CSV answer with its CSV meaning/POS and no prototype overlay or invented citation', () => {
    const bytes = sourceBytes(), imported = buildCsvCatalog(bytes);
    const data = readJson('../public/vocabulary/en-vi.json'), catalog = parseDictionary(data);
    expect(data.source.kind).toBe('local-csv');
    expect(data.source.localFile).toBe('Dic/English - Vietnamese.csv');
    expect(data.source.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(data.source.encoding).toBe('utf-16le');
    expect(Object.hasOwn(data.source, 'url')).toBe(false);
    expect(data.source.stats.words).toBe(data.words.length);
    expect(catalog.words.length).toBeGreaterThan(0);
    expect(catalog.words.map(content)).toEqual(imported.words.map(content));
    expect(new Set(catalog.words.map(word => word.answer)).size).toBe(catalog.words.length);
    expect(catalog.words.every(word => Number.isInteger(word.learningLevel) && word.learningLevel >= 1 && word.learningLevel <= 10)).toBe(true);
    expect(catalog.words.every(word => word.sourceUrl === undefined)).toBe(true);
    const water = catalog.words.find(word => word.answer === 'water');
    expect(water.meaning.toLowerCase()).toBe('nước');
    expect(water.partOfSpeech).toBe('noun');
    expect(catalog.words.find(word => word.answer === 'telescope').meaning.toLowerCase()).toBe('kính thiên văn');
    expect(catalog.words.find(word => word.answer === 'almost').partOfSpeech).toBe('adverb');
  });

  it('copies only relevant historical aliases and keeps legacy editorial translations outside the CSV bank', () => {
    const imported = buildCsvCatalog(sourceBytes());
    const editorial = readJson('../public/vocabulary/editorial-corrections.json');
    const expected = mergeCsvHistoryAliases(imported.words, editorial);
    const data = readJson('../public/vocabulary/en-vi.json');
    expect(data.words.map(word => [word.answer, word.historyAliases ?? []])).toEqual(expected.map(word => [word.answer, word.historyAliases ?? []]));
    const answers = new Set(data.words.map(word => word.answer)), owners = new Set();
    for (const word of data.words) for (const alias of word.historyAliases ?? []) {
      expect(answers.has(alias), alias).toBe(false);
      expect(owners.has(alias), alias).toBe(false);
      expect(answersFor(word), alias).not.toContain(alias);
      owners.add(alias);
    }
  });

  it('exhausts the shipped CSV bank after all its actual answers have been seen', () => {
    const catalog = parseDictionary(readJson('../public/vocabulary/en-vi.json'));
    const deck = new WordDeck(catalog.words);
    expect(deck.availability.total).toBe(catalog.words.length);
    deck.addSeen(catalog.words.map(word => word.answer));
    expect(deck.availability.remaining).toBe(0);
    expect(deck.reserve(1)).toBeUndefined();
  });
});

describe('CSV history migration without content edits', () => {
  it('keeps CSV translations intact, resolves old rename chains, and is idempotent', () => {
    const words = [baseWord('falsehood'), baseWord('apple', 'Nghĩa táo từ CSV')];
    const before = structuredClone(words);
    const editorial = { corrections: [
      { answer: 'falshood', after: { answer: 'falschood', meaning: 'Không được lấy nghĩa này' } },
      { answer: 'falschood', after: { answer: 'falsehood', partOfSpeech: 'adjective' } },
      { answer: 'apple', after: { answer: 'falsehood' } },
      { answer: 'notincsv', after: { answer: 'missingcanonical' } },
    ] };
    const migrated = mergeCsvHistoryAliases(words, editorial);
    expect(migrated[0]).toEqual({ ...words[0], historyAliases: ['falschood', 'falshood'] });
    expect(migrated[1]).toEqual(words[1]);
    expect(migrated.map(content)).toEqual(words.map(content));
    expect(words).toEqual(before);
    expect(mergeCsvHistoryAliases(migrated, editorial)).toEqual(migrated);
    const deck = new WordDeck(migrated);
    deck.addSeen(['falshood', 'apple']);
    expect(deck.availability.remaining).toBe(0);
  });

  it('drops ambiguous, cyclic, invalid, or current-word aliases rather than combining unrelated history', () => {
    const words = [baseWord('falsehood'), baseWord('apple')];
    const editorial = { corrections: [
      { answer: 'legacyword', after: { answer: 'falsehood' } },
      { answer: 'legacyword', after: { answer: 'apple' } },
      { answer: 'cycleone', after: { answer: 'cycletwo' } },
      { answer: 'cycletwo', after: { answer: 'cycleone' } },
      { answer: 'bad phrase', after: { answer: 'falsehood' } },
      { answer: 'apple', after: { answer: 'falsehood' } },
    ] };
    expect(mergeCsvHistoryAliases(words, editorial)).toEqual(words);
  });
});
