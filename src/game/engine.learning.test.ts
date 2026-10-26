import { describe, expect, it } from 'vitest';
import { GameEngine, JAM_MS } from './engine';
import type { Challenge, Enemy, LearningLevel, Progress, Word, WorldObject } from './types';

function gradedBank(level: LearningLevel, count = 60, long = false): Word[] {
  return Array.from({ length: count }, (_, index) => {
    const answer = `${long ? 'testing' : 'w'}${String.fromCharCode(96 + level)}${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`;
    return { id: answer, answer, meaning: `Từ thử ${level} ${index}`, category: 'Test', partOfSpeech: 'noun', difficulty: 1, learningLevel: level };
  });
}

type PlayableTarget = Enemy | (Omit<WorldObject, 'kind' | 'challenge'> & { kind: 'barrel'; challenge: Challenge });

function waitForTarget(engine: GameEngine): PlayableTarget {
  for (let count = 0; count < 30; count++) {
    for (const enemy of engine.enemies) { enemy.speed = 0; enemy.nextAttackAt = 1e9; }
    const selected = engine.enemies.find(enemy => enemy.id === engine.targetId && enemy.state === 'alive');
    if (selected) return selected;
    const barrel = engine.worldObjects.find(object => object.kind === 'barrel' && -object.id === engine.targetId
      && object.state === 'active' && !object.resolving && object.challenge);
    if (barrel) return barrel as PlayableTarget;
    engine.step(500);
  }
  throw new Error('No playable target spawned');
}

function solve(engine: GameEngine, enemy = waitForTarget(engine)): void {
  engine.targetId = enemy.kind === 'barrel' ? -enemy.id : enemy.id;
  for (const letter of enemy.challenge.word.answer.slice(engine.snapshot().input.length)) engine.typeKey(letter);
}

describe('run-local learning progression in the engine', () => {
  it('advances at completed words 20/40, grades subsequent spawns, and resets to fresh easy words on retry', () => {
    const exposed: { answer: string; completed: number; level: number }[] = [];
    const engine = new GameEngine(() => 0, undefined, word => exposed.push({
      answer: word.answer, completed: engine.snapshot().words, level: word.learningLevel!,
    }), [...gradedBank(3), ...gradedBank(2), ...gradedBank(1)]);
    engine.start();
    expect(engine.snapshot().learning).toEqual({ level: 1, progress: 0, step: 20, nextLevelAt: 20 });
    for (let completed = 1; completed <= 41; completed++) {
      const enemy = waitForTarget(engine);
      expect(engine.snapshot().target?.learningLevel).toBe(enemy.challenge.word.learningLevel);
      solve(engine, enemy);
      expect(engine.snapshot().words).toBe(completed);
      expect(engine.snapshot().learning).toEqual({ level: 1 + Math.floor(completed / 20),
        progress: completed % 20, step: 20, nextLevelAt: (1 + Math.floor(completed / 20)) * 20 });
      // Completion counts before its final projectile kills the enemy.
      if (enemy.kind === 'barrel') expect(enemy.resolving).toBe(true);
      else expect(enemy.state).toBe('resolving');
      engine.step(400);
    }
    expect(exposed.filter(entry => entry.completed < 20).every(entry => entry.level === 1)).toBe(true);
    expect(exposed.filter(entry => entry.completed >= 20 && entry.completed < 40).every(entry => entry.level === 2)).toBe(true);
    expect(exposed.some(entry => entry.completed >= 40 && entry.level === 3)).toBe(true);
    const beforeRetry = new Set(exposed.map(entry => entry.answer));
    engine.toMenu();
    engine.start();
    expect(engine.snapshot().learning).toEqual({ level: 1, progress: 0, step: 20, nextLevelAt: 20 });
    expect(engine.enemies.every(enemy => enemy.challenge.word.learningLevel === 1 && !beforeRetry.has(enemy.challenge.word.answer))).toBe(true);
    expect(new Set(exposed.map(entry => entry.answer)).size).toBe(exposed.length);
  });

  it('ignores partial typing, repeated positions, jammed input and pause time when counting completed words', () => {
    const engine = new GameEngine(() => 0, undefined, undefined, gradedBank(1));
    engine.start();
    const selected = waitForTarget(engine);
    const answer = selected.challenge.word.answer;
    engine.typeKey(answer[0]);
    engine.typeKey('Backspace');
    engine.typeKey(answer[0]);
    engine.typeKey('z');
    engine.typeKey(answer[1]);
    expect(engine.snapshot().learning.progress).toBe(0);
    engine.pause();
    engine.step(100_000);
    expect(engine.snapshot().learning.progress).toBe(0);
    engine.resume();
    engine.step(3000 + JAM_MS);
    solve(engine, selected);
    expect(engine.snapshot().learning.progress).toBe(1);
    engine.step(400);
    expect(engine.snapshot().kills).toBe(1);
    expect(engine.snapshot().learning.progress).toBe(1);
  });

  it('starts at level one despite historical completion and exposes the actual fallback grade', () => {
    const easy = gradedBank(1, 3);
    const progress: Progress = { highScore: 1000, runs: 8, totalWords: 2000, words: {},
      seenWords: Object.fromEntries(easy.map(word => [word.answer, 1])) };
    const engine = new GameEngine(() => 0, progress, undefined, [...easy, ...gradedBank(4, 3), ...gradedBank(7, 3)]);
    engine.start();
    expect(engine.snapshot().learning.level).toBe(1);
    expect(engine.snapshot().target?.learningLevel).toBe(4);
    expect(engine.enemies.every(enemy => enemy.challenge.word.learningLevel === 4)).toBe(true);
  });

  it('caps at level ten after word 180 and continues playing without resetting the learning band', () => {
    const bank = Array.from({ length: 10 }, (_, index) => gradedBank((index + 1) as LearningLevel, 25)).flat();
    const engine = new GameEngine(() => 0, undefined, undefined, bank);
    engine.start();
    for (let completed = 1; completed <= 181; completed++) {
      solve(engine);
      if (completed === 179) expect(engine.snapshot().learning).toEqual({ level: 9, progress: 19, step: 20, nextLevelAt: 180 });
      if (completed >= 180) expect(engine.snapshot().learning).toEqual({ level: 10, progress: 20, step: 20, nextLevelAt: null });
      engine.step(400);
    }
    waitForTarget(engine);
    expect(engine.snapshot().target?.learningLevel).toBe(10);
    expect(engine.snapshot().phase).toBe('playing');
  });

  it('defers a Survival Boss instead of forcing higher-level long words while easy words remain', () => {
    const engine = new GameEngine(() => 0, undefined, undefined, [...gradedBank(1), ...gradedBank(8, 9, true)]);
    engine.start();
    for (const enemy of engine.enemies) enemy.speed = 0;
    engine.clock = 89_990;
    engine.step(10);
    expect(engine.snapshot().boss).toBeNull();
    expect(engine.snapshot().vocabulary.bossReady).toBe(true); // Global practice availability is separate.
    expect(engine.enemies.every(enemy => enemy.challenge.word.learningLevel === 1)).toBe(true);
    expect(engine.snapshot().phase).toBe('playing');
  });

  it('allows a Survival Boss when nine long words in the current band can be held', () => {
    const engine = new GameEngine(() => 0, undefined, undefined, [...gradedBank(1, 20, true), ...gradedBank(8, 9, true)]);
    engine.start();
    for (const enemy of engine.enemies) enemy.speed = 0;
    engine.clock = 89_990;
    engine.step(10);
    const boss = engine.enemies.find(enemy => enemy.kind === 'tank')!;
    expect(boss).toBeDefined();
    expect(boss.challenge.word.learningLevel).toBe(1);
    boss.speed = 0;
    boss.nextAttackAt = 1e9;
    for (let layer = 0; layer < 9; layer++) {
      expect(boss.challenge.word.learningLevel).toBe(1);
      expect(boss.challenge.word.answer.length).toBeGreaterThanOrEqual(7);
      solve(engine, boss);
      engine.step(400);
    }
    expect(engine.snapshot().boss).toBeNull();
    expect(engine.snapshot().words).toBe(9);
  });

  it('announces the Boss-practice exception and does not declare victory while later words are held', () => {
    const exposed: string[] = [];
    const engine = new GameEngine(() => 0, undefined, word => exposed.push(word.answer), gradedBank(8, 9, true));
    engine.start('boss');
    const boss = waitForTarget(engine);
    expect(engine.snapshot().notice).toContain('có thể cao hơn bậc hiện tại');
    expect(engine.snapshot().learning.level).toBe(1);
    expect(engine.snapshot().target?.learningLevel).toBe(8);
    expect(engine.snapshot().vocabulary.remaining).toBe(8);
    engine.step(6500); // Ordinary spawns cannot consume any of the eight held words.
    expect(engine.enemies).toHaveLength(1);
    expect(engine.snapshot().phase).toBe('playing');
    for (let layer = 0; layer < 9; layer++) {
      solve(engine, boss);
      engine.step(400);
    }
    expect(new Set(exposed).size).toBe(9);
    expect(engine.snapshot().summary).toMatchObject({ reason: 'vocabulary-complete', words: 9, bossKills: 1 });
  });
});
