import { describe, expect, it } from 'vitest';
import { getLearningProgress, getWordLearningLevel, learningLevelOrder } from './learningProgression';
import type { LearningLevel } from './types';

describe('completed-word learning progression', () => {
  it.each([
    [0, 1, 0, 20], [19, 1, 19, 20], [20, 2, 0, 40], [39, 2, 19, 40],
    [40, 3, 0, 60], [179, 9, 19, 180], [180, 10, 20, null], [70_000, 10, 20, null],
  ])('at %i completed words reports level %i', (words, level, progress, nextLevelAt) => {
    expect(getLearningProgress(words!)).toEqual({ level, progress, step: 20, nextLevelAt });
  });

  it('maps legacy loot difficulty to the first level of its band without overriding explicit grades', () => {
    expect([1, 2, 3].map(difficulty => getWordLearningLevel({ difficulty: difficulty as 1 | 2 | 3 }))).toEqual([1, 4, 7]);
    expect(getWordLearningLevel({ difficulty: 3, learningLevel: 2 })).toBe(2);
    expect(getWordLearningLevel({ difficulty: 1, learningLevel: 10 })).toBe(10);
  });

  it('orders all ten levels without skipping lower unseen words or wrapping at the cap', () => {
    expect(learningLevelOrder(4)).toEqual([4, 3, 2, 1, 5, 6, 7, 8, 9, 10]);
    expect(learningLevelOrder(10)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    for (let level = 1; level <= 10; level++) expect(new Set(learningLevelOrder(level as LearningLevel)).size).toBe(10);
  });
});
