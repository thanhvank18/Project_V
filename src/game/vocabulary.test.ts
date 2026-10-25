import { describe, expect, it } from 'vitest';
import { answersFor, PART_OF_SPEECH_LABELS, WORDS } from './vocabulary';
import { ADDITIONAL_WORDS } from './wordBank';

describe('authored vocabulary bank', () => {
  it('provides 240 distinct entries without aliases colliding across words', () => {
    expect(WORDS).toHaveLength(240);
    expect(ADDITIONAL_WORDS).toHaveLength(180);
    expect(new Set(WORDS.map(word => word.id)).size).toBe(WORDS.length);

    const acceptedBy = new Map<string, string>();
    for (const word of WORDS) {
      const authoredAnswers = [word.answer, ...(word.alternatives ?? [])];
      expect(new Set(authoredAnswers).size, `Repeated alias inside ${word.id}`).toBe(authoredAnswers.length);
      for (const answer of answersFor(word)) {
        expect(acceptedBy.has(answer), `${answer} belongs to both ${acceptedBy.get(answer)} and ${word.id}`).toBe(false);
        acceptedBy.set(answer, word.id);
      }
    }
  });

  it('contains only typable lowercase words and complete display metadata', () => {
    for (const word of WORDS) {
      expect(word.id, `Invalid ID for ${word.answer}`).toMatch(/^[a-z]+$/);
      for (const answer of [word.answer, ...(word.alternatives ?? [])]) {
        expect(answer, `Untypable answer in ${word.id}`).toMatch(/^[a-z]+$/);
      }
      expect(word.meaning.trim(), `Missing meaning for ${word.id}`).not.toBe('');
      expect(word.category.trim(), `Missing category for ${word.id}`).not.toBe('');
      expect(word.meaning, `Placeholder meaning for ${word.id}`).not.toMatch(/TODO|TBD|\[.*\]|<.*>/i);
      expect(word.meaning.toLowerCase(), `Untranslated meaning for ${word.id}`).not.toBe(word.answer);
      expect(['noun', 'verb', 'adjective'], `Unsupported part of speech in ${word.id}`).toContain(word.partOfSpeech);
      expect(PART_OF_SPEECH_LABELS[word.partOfSpeech], `Missing label for ${word.id}`).toBeTruthy();
      expect([1, 2, 3], `Invalid game difficulty in ${word.id}`).toContain(word.difficulty);
    }
  });

  it('keeps enough distinct long words for repeated Tank encounters', () => {
    const tankEligible = WORDS.filter(word => answersFor(word).every(answer => answer.length >= 7));
    const addedLongWords = ADDITIONAL_WORDS.filter(word => word.answer.length >= 7);
    expect(tankEligible.length).toBeGreaterThanOrEqual(80);
    expect(addedLongWords.length).toBeGreaterThanOrEqual(70);
    for (const partOfSpeech of ['noun', 'verb', 'adjective']) {
      expect(tankEligible.some(word => word.partOfSpeech === partOfSpeech), `No long ${partOfSpeech} words`).toBe(true);
    }
  });
});
