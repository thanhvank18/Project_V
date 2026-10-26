import { describe, it, expect } from 'vitest';
import { examplesForSense, buildReviewExamples } from './import-review-examples.mjs';

const word = { answer: 'run', meaning: 'sự chạy', partOfSpeech: 'noun' };
describe('sense-bound CSV review examples', () => {
  it('keeps an example only under the selected noun sense', () => {
    const raw = 'danh từ|- sự chạy|=I went for a run|+ Tôi đi chạy bộ|- chuyến đi|=It is a long run|+ Đó là chuyến đi dài|* động từ|- chạy|=I run every morning|+ Tôi chạy mỗi sáng';
    expect(examplesForSense(raw, word)).toEqual([{ english: 'I went for a run', vietnamese: 'Tôi đi chạy bộ' }]);
  });
  it('does not carry a sense over idiom or dictionary section boundaries', () => {
    expect(examplesForSense('danh từ|- sự chạy|!on the run|=He is on the run|+ Anh ta đang chạy trốn', word)).toEqual([]);
  });
  it('requires the headword, translation, readable length and no markup', () => {
    expect(examplesForSense('danh từ|- sự chạy|=I went for exercise|+ Tôi đi tập thể dục|=a run|+ chạy bộ|=I went for a run|+ |=<b>I went for a run</b>|+ Tôi đi chạy', word)).toEqual([]);
  });
  it('imports quoted CSV and rejects unrelated spellings and unspecified senses', () => {
    const csv = 'english, vietnamese_analytics\n"run","danh từ|- sự chạy|=I went for a run|+ Tôi đi chạy bộ"\n"runner","danh từ|- sự chạy|=I went for a run|+ Tôi đi chạy bộ"';
    expect(Object.keys(buildReviewExamples(csv, [word]))).toEqual(['run']);
    expect(buildReviewExamples(csv, [{ ...word, partOfSpeech: 'unspecified' }])).toEqual({});
  });
});
