import type { LearningLevel, LearningProgress, Word } from './types';

export const MAX_LEARNING_LEVEL = 10;
export const WORDS_PER_LEARNING_LEVEL = 20;
export const LEARNING_LEVEL_LABELS: Readonly<Record<LearningLevel, string>> = {
  1: 'Cơ bản', 2: 'Dễ', 3: 'Quen thuộc', 4: 'Mở rộng', 5: 'Trung bình',
  6: 'Nâng cao', 7: 'Khó', 8: 'Rất khó', 9: 'Chuyên sâu', 10: 'Thử thách cao nhất',
};

/** Legacy authored banks map their three loot tiers to the start of each grading band. */
export function getWordLearningLevel(word: Pick<Word, 'learningLevel' | 'difficulty'>): LearningLevel {
  if (Number.isInteger(word.learningLevel) && word.learningLevel! >= 1 && word.learningLevel! <= MAX_LEARNING_LEVEL) return word.learningLevel!;
  return ({ 1: 1, 2: 4, 3: 7 } as const)[word.difficulty];
}

/** Run-local learning progression uses completed words, never kills, letters or historical totals. */
export function getLearningProgress(completedWords: number): LearningProgress {
  const completed = Number.isFinite(completedWords) ? Math.max(0, Math.floor(completedWords)) : 0;
  const level = Math.min(MAX_LEARNING_LEVEL, 1 + Math.floor(completed / WORDS_PER_LEARNING_LEVEL)) as LearningLevel;
  return { level, progress: level === MAX_LEARNING_LEVEL ? WORDS_PER_LEARNING_LEVEL : completed % WORDS_PER_LEARNING_LEVEL,
    step: WORDS_PER_LEARNING_LEVEL, nextLevelAt: level === MAX_LEARNING_LEVEL ? null : level * WORDS_PER_LEARNING_LEVEL };
}

/** Prefer the current band, then nearest lower bands, then the next higher bands. */
export function learningLevelOrder(level: LearningLevel): LearningLevel[] {
  return [level, ...Array.from({ length: level - 1 }, (_, index) => level - 1 - index),
    ...Array.from({ length: MAX_LEARNING_LEVEL - level }, (_, index) => level + 1 + index)] as LearningLevel[];
}
