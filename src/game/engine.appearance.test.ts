import { describe, expect, it, vi } from 'vitest';
import { ENEMY_SPEED, GameEngine } from './engine';
import { getEnemyCharacter, getEnemyCharacters } from './characterCatalog';
import type { EnemyKind, Word } from './types';

const kinds: EnemyKind[] = ['normal', 'runner', 'armored', 'tank'];
const bank: Word[] = Array.from({ length: 512 }, (_, index) => {
  const answer = `catalog${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`;
  return { id: answer, answer, meaning: 'Từ kiểm thử', category: 'test', partOfSpeech: 'noun', difficulty: 3 };
});
type SpawnControl = { spawn(kind: EnemyKind, side: -1 | 1, x?: number): boolean; appearanceSequence: Record<EnemyKind, number> };
const control = (engine: GameEngine) => engine as unknown as SpawnControl;
const engineWith = (words: readonly Word[] = bank, random = () => .13) => new GameEngine(random, undefined, undefined, words);

describe('cosmetic enemy appearances', () => {
  it.each(kinds)('visits every %s appearance before repeating while preserving gameplay stats', kind => {
    const engine = engineWith(), pool = getEnemyCharacters(kind), seen: string[] = [];
    for (let index = 0; index < pool.length * 2; index++) {
      engine.enemies = [];
      expect(control(engine).spawn(kind, 1, 1100)).toBe(true);
      const enemy = engine.enemies[0];
      seen.push(enemy.appearanceId!);
      expect(enemy.appearanceId).toBe(pool[index % pool.length].id);
      expect(enemy.kind).toBe(kind);
      expect(enemy.speed).toBe(ENEMY_SPEED[kind]);
      expect(enemy.hp).toBe(kind === 'tank' ? 9 : kind === 'armored' ? 2 : 1);
    }
    expect(new Set(seen).size).toBe(pool.length);
  });

  it('does not skip appearances when a spawn is blocked by the flank cap', () => {
    const random = vi.fn(() => .13), engine = engineWith(bank, random);
    for (let index = 0; index < 3; index++) expect(control(engine).spawn('normal', -1)).toBe(true);
    const calls = random.mock.calls.length;
    expect(control(engine).spawn('normal', -1)).toBe(false);
    expect(random).toHaveBeenCalledTimes(calls);
    engine.enemies = [];
    expect(control(engine).spawn('normal', -1)).toBe(true);
    expect(engine.enemies[0].appearanceId).toBe(getEnemyCharacters('normal')[3].id);
  });

  it('advances only the final successful kind after an armored spawn falls back to normal', () => {
    const engine = engineWith(bank.slice(0, 1));
    expect(control(engine).spawn('armored', 1)).toBe(true);
    expect(engine.enemies[0].kind).toBe('normal');
    expect(engine.enemies[0].appearanceId).toBe(getEnemyCharacters('normal')[0].id);
    expect(control(engine).appearanceSequence.armored).toBe(0);
    expect(control(engine).appearanceSequence.normal).toBe(1);
    engine.enemies = [];
    expect(control(engine).spawn('normal', 1)).toBe(false);
    expect(control(engine).appearanceSequence.normal).toBe(1);
  });

  it('keeps appearance rotation across retries without consuming gameplay randomness', () => {
    const randomA = vi.fn(() => .13), randomB = vi.fn(() => .13);
    const first = engineWith(bank, randomA), shifted = engineWith(bank, randomB);
    control(shifted).appearanceSequence.normal = 7;
    first.start(); shifted.start();
    expect(first.enemies.map(enemy => enemy.appearanceId)).not.toEqual(shifted.enemies.map(enemy => enemy.appearanceId));
    expect(first.enemies.map(({ appearanceId: _, ...enemy }) => enemy)).toEqual(shifted.enemies.map(({ appearanceId: _, ...enemy }) => enemy));
    expect(randomA.mock.calls.length).toBe(randomB.mock.calls.length);
    first.toMenu(); first.start();
    expect(first.enemies[0].appearanceId).toBe(getEnemyCharacters('normal')[2].id);
  });

  it('publishes the selected target and Boss identity and supports legacy enemies without an appearance ID', () => {
    const engine = engineWith();
    engine.start('boss');
    const enemy = engine.enemies[0], character = getEnemyCharacter(enemy.appearanceId, 'tank');
    expect(engine.snapshot().target).toMatchObject({ appearanceId: character.id, name: character.name, label: character.label });
    expect(engine.snapshot().boss).toMatchObject({ appearanceId: character.id, name: character.name, label: character.label });
    delete enemy.appearanceId;
    expect(engine.snapshot().boss?.appearanceId).toBe(getEnemyCharacters('tank')[0].id);
  });
});
