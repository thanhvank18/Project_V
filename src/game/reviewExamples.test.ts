import { describe, expect, it } from 'vitest';
import { exampleForWord } from './reviewExamples';
import type { Word } from './types';

const word: Word = { id: 'run', answer: 'run', meaning: 'sự chạy', partOfSpeech: 'noun', category: 'Danh từ', difficulty: 1 };
describe('review examples keep the encountered sense', () => {
  it('uses an original sentence with the correct noun sense', () => {
    expect(exampleForWord(word)).toEqual({ english: 'I went for a run this morning.', vietnamese: 'Tôi đi chạy bộ sáng nay.', source: 'authored' });
  });
  it('does not attach a noun sentence to a different meaning or verb', () => {
    expect(exampleForWord({ ...word, meaning: 'điều hành', partOfSpeech: 'verb' })).toBeUndefined();
    expect(exampleForWord({ ...word, meaning: 'chuyến đi' })).toBeUndefined();
  });
  it('does not invent sentences for unknown words', () => {
    expect(exampleForWord({ ...word, answer: 'notaword' })).toBeUndefined();
  });
});
