import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mergeEnglishDefinitions, vocabularyForLanguage } from '../src/game/englishDictionary';
import { parseDictionary } from '../src/game/dictionary';
import { WordDeck } from '../src/game/wordDeck';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const raw = read('../public/vocabulary/en-vi.json');
const edition = read('../public/vocabulary/english-definitions.json');
const report = read('../public/vocabulary/english-definition-report.json');
const reviewed = mergeEnglishDefinitions(raw.words, edition);
const catalog = parseDictionary({ ...raw, words: reviewed });

describe('published bilingual dictionary integration', () => {
  it('accounts for every original entry and serves one complete bilingual pool', () => {
    const active = new Set(catalog.words.map(word => word.answer));
    const excluded = new Set(edition.excluded.map(item => item.answer));
    const quarantined = new Set(edition.quarantined.map(item => item.answer));
    expect(raw.words.filter(word => Number(active.has(word.answer)) + Number(excluded.has(word.answer)) + Number(quarantined.has(word.answer)) !== 1).map(word => word.answer)).toEqual([]);
    expect(catalog.words.length).toBe(Object.keys(edition.entries).length);
    expect(catalog.words.length).toBe(report.covered);
    expect(catalog.words.filter(word => !word.meaning || !word.englishMeaning || !word.partOfSpeech).map(word => word.answer)).toEqual([]);
    const vi = vocabularyForLanguage(catalog.words, 'vi');
    const en = vocabularyForLanguage(catalog.words, 'en');
    expect(vi.map(word => word.answer)).toEqual(en.map(word => word.answer));
    expect(en.filter(word => word.meaning !== edition.entries[word.answer].meaning).map(word => word.answer)).toEqual([]);
    expect(mergeEnglishDefinitions(reviewed, edition)).toEqual(reviewed);
  });

  it('migrates retired spellings and their aliases without repeating already encountered words', () => {
    const active = new Map(catalog.words.map(word => [word.answer, word]));
    const migrations = edition.excluded.filter(item => item.canonical && active.has(item.canonical));
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations.filter(item => !active.get(item.canonical).historyAliases?.includes(item.answer))).toEqual([]);
    const migrated = [...new Set(migrations.map(item => active.get(item.canonical)))];
    const deck = new WordDeck(vocabularyForLanguage(migrated, 'en'));
    deck.addSeen(migrations.map(item => item.answer));
    expect(deck.availability.remaining).toBe(0);
  });

  it('ships the repaired meanings instead of the obsolete source errors', () => {
    const byAnswer = new Map(catalog.words.map(word => [word.answer, word]));
    expect(byAnswer.get('working')).toMatchObject({ partOfSpeech: 'verb', meaning: expect.stringContaining('đang làm việc') });
    expect(byAnswer.get('lamarckism').englishMeaning).toContain('inherited');
    expect(byAnswer.get('woodlice').meaning).not.toContain('mối');
    expect(byAnswer.get('microscope').historyAliases).toContain('microsope');
    expect(byAnswer.has('microsope')).toBe(false);
  });
});
