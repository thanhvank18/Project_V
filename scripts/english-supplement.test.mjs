import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prepareEnglishClue } from './import-english-definitions.mjs';

const supplement = JSON.parse(readFileSync(new URL('./data/english-supplement.json', import.meta.url), 'utf8'));
const posRepairs = JSON.parse(readFileSync(new URL('./data/english-pos-repairs.json', import.meta.url), 'utf8'));
const bank = JSON.parse(readFileSync(new URL('../public/vocabulary/en-vi.json', import.meta.url), 'utf8')).words;
const renames = new Map(supplement.excluded.filter(entry => entry.canonical).map(entry => [entry.answer, entry.canonical]));

describe('reviewed English dictionary supplement', () => {
  it('gives every newly introduced canonical word a complete paired definition', () => {
    const known = new Set(bank.map(word => word.answer));
    for (const entry of supplement.excluded.filter(entry => entry.canonical && !known.has(entry.canonical))) {
      expect(supplement.entries[entry.canonical], entry.canonical).toMatchObject({
        meaning: expect.any(String), vietnameseMeaning: expect.any(String), partOfSpeech: expect.any(String), sourceUrl: expect.any(String),
      });
    }
    expect(supplement.excluded.filter(entry => entry.canonicalAlreadyPresent === false).length).toBeGreaterThan(100);
  });

  it('contains readable, sourced and valid English clues paired with concise Vietnamese', () => {
    const parts = new Set(['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'determiner', 'numeral']);
    for (const [answer, entry] of Object.entries(supplement.entries)) {
      expect(answer).toMatch(/^[a-z]{3,18}$/);
      expect(parts.has(entry.partOfSpeech), answer).toBe(true);
      expect(entry.meaning.length, answer).toBeLessThanOrEqual(240);
      expect(entry.vietnameseMeaning.length, answer).toBeLessThanOrEqual(120);
      expect(entry.vietnameseMeaning.normalize('NFD'), answer).toMatch(/[\p{M}đ]/iu);
      expect(prepareEnglishClue(entry.meaning, answer), answer).not.toBeNull();
      expect(entry.sourceUrl).toMatch(/^https:\/\//);
      expect(entry.reason.length).toBeGreaterThan(20);
    }
  });

  it('has no duplicate retirements, rename chains or retired canonical targets', () => {
    const retired = new Set(supplement.excluded.map(entry => entry.answer));
    expect(retired.size).toBe(supplement.excluded.length);
    for (const entry of supplement.excluded) {
      expect(supplement.entries[entry.answer], entry.answer).toBeUndefined();
      expect(entry.before.meaning).toBeTruthy();
      expect(entry.sourceUrl).toMatch(/^https:\/\//);
      if (entry.canonical) {
        expect(entry.canonical, entry.answer).toMatch(/^[a-z]{3,18}$/);
        expect(retired.has(entry.canonical), entry.answer).toBe(false);
      }
    }
  });

  it('uses the CSV sense to disambiguate visually similar spelling candidates', () => {
    expect(renames.get('decamter')).toBe('decameter');
    expect(renames.get('commondo')).toBe('commode');
    expect(renames.get('contradication')).toBe('contraindication');
    expect(renames.get('itenerancy')).toBe('iterancy');
    expect(renames.get('envolop')).toBe('envelope');
    expect(renames.get('tweezere')).toBe('tweezers');
    for (const ambiguous of ['aclimate', 'trysin', 'untraned']) {
      expect(renames.has(ambiguous)).toBe(false);
      expect(supplement.deferred.some(entry => entry.answer === ambiguous)).toBe(true);
    }
  });

  it('retains regional and British spellings instead of collapsing them by similarity', () => {
    for (const answer of ['ablins', 'fatalise', 'dephosphorise', 'devirilise', 'outbade', 'iraki']) {
      expect(supplement.excluded.some(entry => entry.answer === answer), answer).toBe(false);
    }
    expect(supplement.deferred.find(entry => entry.answer === 'ablins').sourceUrl).toContain('/ablins');
  });

  it('records required punctuation explicitly instead of inventing an ASCII spelling', () => {
    const contractions = supplement.excluded.filter(entry => entry.classification === 'missing-punctuation');
    expect(contractions).toHaveLength(9);
    for (const entry of contractions) {
      expect(entry.writtenForm).toContain("'");
      expect(entry.writtenForm.replaceAll("'", '')).toBe(entry.answer);
      expect(entry.canonical).toBeUndefined();
    }
  });

  it('repairs verified word classes and mismatched meanings found during spelling review', () => {
    expect(supplement.entries.elementary.partOfSpeech).toBe('adjective');
    expect(supplement.entries.calculus.meaning).toContain('mathematics');
    expect(supplement.entries.mortgagee.meaning).toContain('lender');
    expect(supplement.entries.luncheonette.meaning).toContain('restaurant');
    expect(supplement.entries.diploblastic.vietnameseMeaning).toContain('lá phôi');
    expect(supplement.entries.vichyssoise.meaning).toContain('leek');
    expect(supplement.entries.iterancy.meaning).toContain('old-fashioned');
  });
});

describe('reviewed A-D word-class repairs', () => {
  it('keeps each new word class attested and its definitions complete', () => {
    expect(Object.keys(posRepairs.entries).length).toBeGreaterThan(100);
    for (const [answer, entry] of Object.entries(posRepairs.entries)) {
      expect(supplement.entries[answer], answer).toBeUndefined();
      expect(entry.sourcePartsOfSpeech, answer).toContain(entry.partOfSpeech);
      expect(entry.partOfSpeech, answer).not.toBe(entry.before.partOfSpeech);
      expect(entry.meaning.length, answer).toBeLessThanOrEqual(240);
      expect(entry.vietnameseMeaning.length, answer).toBeLessThanOrEqual(120);
      expect(prepareEnglishClue(entry.meaning, answer), answer).not.toBeNull();
      expect(entry.sourceUrl, answer).toMatch(/^https:\/\/en\.wiktionary\.org\/wiki\//);
    }
  });

  it('repairs misleading source senses instead of changing a label alone', () => {
    expect(posRepairs.entries.agronomics.partOfSpeech).toBe('noun');
    expect(posRepairs.entries.agronomics.before.partOfSpeech).toBe('numeral');
    expect(posRepairs.entries.autologous.vietnameseMeaning).toContain('chính cơ thể');
    expect(posRepairs.entries.aftertax.meaning).toContain('deducted');
    expect(posRepairs.entries.cobbler.partOfSpeech).toBe('noun');
    expect(posRepairs.entries.cobbler.meaning).toContain('repairing shoes');
    expect(posRepairs.entries.constantly.partOfSpeech).toBe('adverb');
    expect(posRepairs.entries.antiparasitic.vietnameseMeaning).toBe('chống ký sinh trùng');
    expect(posRepairs.entries.achromous.partOfSpeech).toBe('adjective');
    expect(posRepairs.entries.commotion.partOfSpeech).toBe('noun');
  });

  it('does not guess the expansion of ambiguous abbreviations or proper names', () => {
    for (const answer of ['adi', 'afe', 'aix', 'apl', 'asa', 'cal', 'dem', 'dos', 'cai']) {
      expect(posRepairs.entries[answer], answer).toBeUndefined();
    }
  });
});
