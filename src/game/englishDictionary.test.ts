import { describe, expect, it } from 'vitest';
import { mergeEnglishDefinitions, vocabularyForLanguage } from './englishDictionary';
import { getWordMeaning } from './localization';
import { createChallenge } from './vocabulary';
import { WordDeck } from './wordDeck';
import type { Word } from './types';

const apple: Word = { id: 'csv-apple', answer: 'apple', meaning: 'quả táo', category: 'CSV', partOfSpeech: 'noun', difficulty: 1 };
const pack = (entries: Record<string, unknown>, excluded?: unknown[]) => ({ version: 1,
  source: { name: 'Test definitions', license: 'CC BY 4.0', snapshot: 'test' }, entries, ...(excluded ? { excluded } : {}) });
const definition = { meaning: 'A round fruit with firm flesh and red or green skin.', partOfSpeech: 'noun' };

describe('reviewed bilingual vocabulary', () => {
  it('keeps Vietnamese definitions and enriches English without changing canonical history', () => {
    const original = { ...apple, historyAliases: ['appple'] };
    const [word] = mergeEnglishDefinitions([original], pack({ apple: definition }));
    expect(original).not.toHaveProperty('englishMeaning');
    expect(word).toMatchObject({ meaning: 'quả táo', englishMeaning: definition.meaning, historyAliases: ['appple'] });
    expect(getWordMeaning(word, 'vi')).toBe('quả táo');
    expect(getWordMeaning(word, 'en')).toBe(definition.meaning);
    const english = vocabularyForLanguage([word], 'en');
    for (const kind of ['translate', 'hint'] as const) expect(createChallenge(english[0], kind, 1).prompt).toBe(definition.meaning);
    const deck = new WordDeck(english); deck.addSeen(['appple']);
    expect(deck.availability.remaining).toBe(0);
  });
  it('does not invent English definitions or admit untranslated words into an English game', () => {
    expect(getWordMeaning(apple, 'en')).toBe('No English definition available.');
    expect(vocabularyForLanguage([apple], 'en')).toEqual([]);
    expect(vocabularyForLanguage([apple], 'vi')).toEqual([apple]);
  });
  it('requires the matching Vietnamese correction when repairing an incorrect part of speech', () => {
    const wrong: Word = { ...apple, id: 'could', answer: 'could', meaning: 'cái hộp', partOfSpeech: 'noun' };
    expect(() => mergeEnglishDefinitions([wrong], pack({ could: { meaning: 'Was able to.', partOfSpeech: 'verb' } }))).toThrow('part of speech mismatch');
    expect(mergeEnglishDefinitions([wrong], pack({ could: { meaning: 'Was able to.', partOfSpeech: 'verb', vietnameseMeaning: 'đã có thể' } }))[0])
      .toMatchObject({ answer: 'could', meaning: 'đã có thể', partOfSpeech: 'verb', englishMeaning: 'Was able to.' });
  });
  it('repairs proven misspellings without repeating a word from historical misspelled exposure', () => {
    const typo = { ...apple, id: 'csv-appple', answer: 'appple', historyAliases: ['apppple'] };
    const catalog = pack({ apple: definition }, [{ answer: 'appple', canonical: 'apple', reason: 'Verified misspelling' }]);
    const words = mergeEnglishDefinitions([apple, typo], catalog);
    expect(words).toHaveLength(1);
    expect(words[0].historyAliases).toEqual(['apppple', 'appple']);
    expect(mergeEnglishDefinitions(words, catalog)).toEqual(words);
    const deck = new WordDeck(vocabularyForLanguage(words, 'en')); deck.addSeen(['appple']);
    expect(deck.availability.remaining).toBe(0);
  });
  it('can recover a corrected headword absent from the source only with a paired definition', () => {
    const typo = { ...apple, id: 'csv-appple', answer: 'appple' };
    const excluded = [{ answer: 'appple', canonical: 'apple', reason: 'Verified misspelling' }];
    expect(() => mergeEnglishDefinitions([typo], pack({ apple: definition }, excluded))).toThrow('Missing corrected');
    expect(mergeEnglishDefinitions([typo], pack({ apple: { ...definition, vietnameseMeaning: 'quả táo' } }, excluded))[0])
      .toMatchObject({ id: 'csv-appple', answer: 'apple', englishMeaning: definition.meaning, historyAliases: ['appple'] });
  });
  it('applies documented exclusions and rejects contradictory or malformed reviews', () => {
    expect(mergeEnglishDefinitions([apple], pack({}, [{ answer: 'apple', reason: 'Fixture exclusion' }]))).toEqual([]);
    expect(() => mergeEnglishDefinitions([apple], pack({ apple: definition }, [{ answer: 'apple', reason: 'Conflict' }]))).toThrow('exclusions');
    for (const entry of [{ ...definition, meaning: '' }, { ...definition, meaning: 'x'.repeat(241) }, { ...definition, partOfSpeech: 'unknown' },
      { ...definition, vietnameseMeaning: '' }, { ...definition, meaning: 'bad\u0000text' }]) {
      expect(() => mergeEnglishDefinitions([apple], pack({ apple: entry }))).toThrow('Invalid English');
    }
    expect(() => mergeEnglishDefinitions([apple], { version: 1, entries: {} })).toThrow('Unsupported English');
  });
  it('keeps unresolved entries out of both modes without deleting the source and rejects gaps in a gated edition', () => {
    const uncertain = { ...apple, id: 'uncertain', answer: 'uncertain', meaning: 'xem anotherword' };
    const edition = { ...pack({ apple: definition }), quarantined: [{ answer: 'uncertain', reason: 'Vietnamese cross-reference needs review' }] };
    const reviewed = mergeEnglishDefinitions([apple, uncertain], edition);
    expect(vocabularyForLanguage(reviewed, 'vi').map(word => word.answer)).toEqual(['apple']);
    expect(vocabularyForLanguage(reviewed, 'en').map(word => word.answer)).toEqual(['apple']);
    expect(uncertain.meaning).toBe('xem anotherword');
    expect(() => mergeEnglishDefinitions([apple, uncertain], { ...edition, quarantined: [] })).toThrow('Incomplete bilingual');
    expect(() => mergeEnglishDefinitions([apple], { ...edition, quarantined: [{ answer: 'apple', reason: 'Conflicting entry' }] })).toThrow('quarantine');
  });
  it('regenerates differentiating hints for English synonyms instead of reusing Vietnamese clues', () => {
    const words = ['adviser', 'advisor'].map(answer => ({ ...apple, id: answer, answer, englishMeaning: 'Someone who gives advice.', translationHint: 'old' }));
    const english = vocabularyForLanguage(words, 'en');
    expect(english[0].translationHint).not.toBe(english[1].translationHint);
    expect(english[0].translationHint).toContain('e');
    expect(english[1].translationHint).toContain('o');
    expect(words[0].translationHint).toBe('old');
  });

  it('gives Vietnamese online variants distinct clues after applying reviewed meanings', () => {
    const words = ['adviser', 'advisor'].map(answer => ({ ...apple, id: answer, answer, meaning: 'người khuyên bảo, người chỉ bảo, cố vấn' }));
    const bank = vocabularyForLanguage(words, 'vi');
    const challenges = bank.map((word, index) => createChallenge(word, 'translate', index));
    expect(challenges[0].prompt).toBe(challenges[1].prompt);
    expect(challenges[0].hint).toBe('a _ _ _ _ e r');
    expect(challenges[1].hint).toBe('a _ _ _ _ o r');
    expect(words.every(word => !('translationHint' in word))).toBe(true);
  });
});
