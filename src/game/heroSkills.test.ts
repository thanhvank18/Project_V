import { describe, expect, it } from 'vitest';
import { HERO_CHARACTERS } from './characterCatalog';
import { GameEngine, PLAYER_X, WORLD_WIDTH } from './engine';
import { getHeroSkill, HERO_SKILLS } from './heroSkills';
import { getHeroCombat } from './heroCombat';
import type { Enemy, EnemyKind, Word } from './types';

const bank: Word[] = Array.from({ length: 80 }, (_, index) => {
  const answer = `training${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`;
  return { id: answer, answer, meaning: 'Từ kiểm thử', category: 'test', partOfSpeech: 'noun', difficulty: 3 };
});
const longWord: Word = { id: 'long', answer: 'abcdefghijklmnopqrstuvwx', meaning: 'Kiểm thử kỹ năng', category: 'test', partOfSpeech: 'noun', difficulty: 3 };
type DamageControl = { hp: number; hurt(amount: number, source: Enemy): number };
const damageControl = (engine: GameEngine) => engine as unknown as DamageControl;

function prepare(hero: string, kind: EnemyKind = 'normal') {
  const engine = new GameEngine(() => .13, undefined, undefined, bank);
  engine.setHero(hero);
  engine.start();
  const target = engine.enemies[0];
  target.kind = kind; target.side = 1; target.x = PLAYER_X + 260;
  target.hp = target.maxHp = kind === 'tank' ? 9 : kind === 'armored' ? 2 : 1;
  target.challenge.word = longWord;
  engine.enemies = [target]; engine.targetId = target.id;
  engine.drainEvents();
  return { engine, target };
}
function freshLetters(engine: GameEngine, count: number) {
  const target = engine.enemies.find(enemy => enemy.id === engine.targetId)!;
  const start = engine.snapshot().input.length;
  for (const letter of target.challenge.word.answer.slice(start, start + count)) engine.typeKey(letter);
}
function activate(engine: GameEngine) {
  const hero = engine.snapshot().hero.id;
  if (getHeroCombat(hero).class === 'melee') {
    // Effect tests isolate the activation instant; engineMelee verifies travel/letter timing.
    const target = engine.enemies.find(enemy => enemy.id === engine.targetId)!;
    const activation = engine as unknown as { chargeHeroSkill(target: Enemy): void };
    for (let index = 0; index < getHeroSkill(hero).threshold; index++) activation.chargeHeroSkill(target);
  } else freshLetters(engine, getHeroSkill(hero).threshold);
}
function clone(base: Enemy, id: number, x: number, kind: EnemyKind = 'normal'): Enemy {
  return { ...base, id, x, kind, side: x >= PLAYER_X ? 1 : -1, hp: kind === 'tank' ? 9 : 1, maxHp: kind === 'tank' ? 9 : 1,
    stunUntil: 0, freezeUntil: undefined, slowUntil: undefined, attackUntil: 0,
    challenge: { ...base.challenge, id: id + 100, credited: new Set() } };
}

describe('hero skill metadata and charge', () => {
  it('assigns nine distinct skills to the nine heroes with explicit 6–12 letter thresholds', () => {
    expect(HERO_SKILLS.map(skill => skill.heroId).sort()).toEqual(HERO_CHARACTERS.map(hero => hero.id).sort());
    expect(new Set(HERO_SKILLS.map(skill => skill.id)).size).toBe(9);
    expect(new Set(HERO_SKILLS.map(skill => skill.effect.kind)).size).toBe(9);
    for (const skill of HERO_SKILLS) {
      expect(skill.threshold).toBeGreaterThanOrEqual(6);
      expect(skill.threshold).toBeLessThanOrEqual(12);
    }
    expect(getHeroSkill('unknown').heroId).toBe('soldier');
  });

  it('charges only a newly credited correct index, never repeats, wrong/jammed keys or paused input', () => {
    const { engine } = prepare('archer');
    engine.typeKey('a'); engine.typeKey('Backspace'); engine.typeKey('a');
    expect(engine.snapshot().hero.charge).toBe(1);
    engine.typeKey('z'); engine.typeKey('b');
    expect(engine.snapshot().hero.charge).toBe(1);
    engine.step(300); engine.typeKey('b');
    expect(engine.snapshot().hero.charge).toBe(2);
    engine.pause(); engine.typeKey('c'); engine.resume(); engine.step(1999); engine.typeKey('c');
    expect(engine.snapshot().hero.charge).toBe(2);
    engine.step(1); engine.typeKey('c');
    expect(engine.snapshot().hero.charge).toBe(3);
  });

  it.each(HERO_SKILLS)('$heroId skill does not damage an enemy, solve a word or award a kill', skill => {
    const { engine, target } = prepare(skill.heroId);
    activate(engine);
    expect(engine.snapshot().hero.charge).toBe(0);
    expect(engine.snapshot().words).toBe(0);
    expect(engine.snapshot().kills).toBe(0);
    expect(target.hp).toBe(1);
    expect(target.state).toBe('alive');
    expect(engine.drainEvents().filter(event => event.type === 'hero-skill')).toMatchObject([
      { heroId: skill.heroId, skillId: skill.id, visualKind: skill.visualKind, skillPhase: 'activate' },
    ]);
  });

  it('captures the finishing-letter target before selection changes and leaves damage to its projectile', () => {
    const { engine, target } = prepare('archer');
    target.challenge.word = { ...longWord, id: 'planet', answer: 'planet' };
    const originalX = target.x;
    activate(engine);
    const skill = engine.drainEvents().find(event => event.type === 'hero-skill')!;
    expect(skill.targetX).toBe(originalX);
    expect(skill.targets).toEqual([{ enemyId: target.id, x: originalX + 28 }]);
    expect(engine.targetId).toBeNull();
    expect(target.hp).toBe(1);
    expect(target.state).toBe('resolving');
    engine.step(600);
    expect(engine.snapshot().kills).toBe(1);
  });
});

describe('nine distinct hero effects', () => {
  it('Archer pushes 28px while preserving shielding order and world bounds', () => {
    const { engine, target } = prepare('archer');
    const boss = clone(target, 90, target.x + 10, 'tank');
    const covered = clone(target, 91, boss.x + 15);
    engine.enemies.push(boss, covered);
    const bossX = boss.x, coveredX = covered.x;
    activate(engine);
    expect(target.x).toBe(bossX - 1);
    expect(boss.x).toBe(bossX); expect(covered.x).toBe(coveredX);
    const edge = prepare('archer');
    edge.target.x = WORLD_WIDTH + 55;
    activate(edge.engine);
    expect(edge.target.x).toBe(WORLD_WIDTH + 60);
  });

  it('Axeman stuns eligible neighbors for 600ms and later ordinary hits do not shorten it', () => {
    const { engine, target } = prepare('armored-axeman');
    const near = clone(target, 90, target.x + 120), far = clone(target, 91, target.x + 151);
    engine.enemies.push(near, far);
    activate(engine);
    expect(target.stunUntil).toBe(600); expect(near.stunUntil).toBe(600); expect(far.stunUntil).toBe(0);
    engine.step(220);
    expect(target.stunUntil).toBe(600);
  });

  it('Knight blocks one hit with a separate block event, no player-hurt, and no stacking', () => {
    const { engine, target } = prepare('knight');
    activate(engine); activate(engine); engine.drainEvents();
    expect(damageControl(engine).hurt(20, target)).toBe(0);
    expect(engine.snapshot().hp).toBe(150);
    const events = engine.drainEvents();
    expect(events.some(event => event.type === 'player-hurt')).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: 'hero-skill', skillPhase: 'block', value: 20 }));
    expect(engine.snapshot().hero.activeRemaining).toBe(0);
    engine.step(650);
    expect(damageControl(engine).hurt(20, target)).toBe(20);
  });

  it('Templar reduces incoming damage by 35% for exactly 3 seconds', () => {
    const { engine, target } = prepare('knight-templar');
    activate(engine);
    expect(damageControl(engine).hurt(20, target)).toBe(13);
    engine.step(3000);
    expect(engine.snapshot().hero.activeRemaining).toBe(0);
    expect(damageControl(engine).hurt(20, target)).toBe(20);
  });

  it('Lancer pushes the line to its target, excluding farther and opposite-side enemies', () => {
    const { engine, target } = prepare('lancer');
    target.x = PLAYER_X + 150;
    const front = clone(target, 90, PLAYER_X + 80), far = clone(target, 91, PLAYER_X + 250), left = clone(target, 92, PLAYER_X - 120);
    engine.enemies.push(front, far, left);
    activate(engine);
    expect(target.x).toBe(PLAYER_X + 240); expect(front.x).toBe(PLAYER_X + 170);
    expect(far.x).toBe(PLAYER_X + 250); expect(left.x).toBe(PLAYER_X - 120);
  });

  it('Priest restores 5HP without exceeding 100 and reports the actual restored amount', () => {
    const { engine } = prepare('priest');
    damageControl(engine).hp = 70; activate(engine);
    expect(engine.snapshot().hp).toBe(75);
    const capped = prepare('priest'); damageControl(capped.engine).hp = 98; activate(capped.engine);
    expect(capped.engine.snapshot().hp).toBe(100);
    expect(capped.engine.drainEvents().find(event => event.type === 'hero-skill')?.value).toBe(2);
  });

  it('Soldier slows only the target to 45% movement for 2 seconds, then restores base speed', () => {
    const { engine, target } = prepare('soldier');
    const neighbor = clone(target, 90, target.x + 120); engine.enemies.push(neighbor);
    activate(engine);
    expect(target.slowUntil).toBe(2000); expect(target.slowFactor).toBe(.45); expect(neighbor.slowUntil).toBeUndefined();
    engine.step(700);
    const slowX = target.x; engine.step(100);
    expect(slowX - target.x).toBeCloseTo(target.speed * .45 * .1);
    engine.step(1300);
    const normalX = target.x; engine.step(100);
    expect(normalX - target.x).toBeCloseTo(target.speed * .1);
  });

  it('Swordsman repels nearby enemies on both sides while distant enemies stay put', () => {
    const { engine, target } = prepare('swordsman'); target.x = PLAYER_X + 120;
    const left = clone(target, 90, PLAYER_X - 130), far = clone(target, 91, PLAYER_X + 400);
    engine.enemies.push(left, far); activate(engine);
    expect(target.x).toBe(PLAYER_X + 162); expect(left.x).toBe(PLAYER_X - 172); expect(far.x).toBe(PLAYER_X + 400);
  });

  it('Wizard freezes eligible neighbors, respects the Boss shield, and preserves attack warnings across overlap', () => {
    const { engine, target } = prepare('wizard'); target.x = PLAYER_X + 92; target.attackUntil = 400;
    const near = clone(target, 90, target.x + 30), boss = clone(target, 91, target.x + 60, 'tank'), covered = clone(target, 92, target.x + 90);
    engine.enemies.push(near, boss, covered); activate(engine);
    expect(target.freezeUntil).toBe(1000); expect(near.freezeUntil).toBe(1000);
    expect(boss.freezeUntil).toBeUndefined(); expect(covered.freezeUntil).toBeUndefined();
    expect(target.attackUntil).toBe(1400);
    engine.useItem('freeze');
    expect(target.attackUntil).toBe(3400);
    engine.step(500);
    expect(target.x).toBe(PLAYER_X + 92);
    expect(target.attackUntil).toBe(3400);
  });
});

describe('skill lifecycle and Boss immunity', () => {
  it.each(['archer', 'armored-axeman', 'lancer', 'soldier', 'swordsman', 'wizard'])('%s never moves, stuns, slows or freezes a Boss', hero => {
    const { engine, target } = prepare(hero, 'tank'), beforeX = target.x;
    activate(engine);
    expect(target.x).toBe(beforeX); expect(target.stunUntil).toBe(0);
    expect(target.freezeUntil).toBeUndefined(); expect(target.slowUntil).toBeUndefined(); expect(target.hp).toBe(9);
    expect(engine.drainEvents().find(event => event.type === 'hero-skill')?.targets).toEqual([]);
  });

  it('holds skill timers through pause/countdown and clears charges/effects on retry or hero change', () => {
    const { engine, target } = prepare('wizard'); activate(engine);
    engine.pause(); engine.step(5000); engine.setHero('priest');
    expect(engine.snapshot().hero).toMatchObject({ id: 'wizard', activeRemaining: 1000 });
    expect(target.freezeUntil).toBe(1000);
    engine.resume(); engine.step(2000);
    expect(engine.snapshot().hero.activeRemaining).toBe(1000);
    engine.step(500);
    expect(engine.snapshot().hero.activeRemaining).toBe(500);
    freshLetters(engine, 1); expect(engine.snapshot().hero.charge).toBe(1);
    engine.start();
    expect(engine.snapshot().hero).toMatchObject({ id: 'wizard', charge: 0, activeRemaining: 0 });
    expect(engine.enemies.every(enemy => !enemy.freezeUntil && !enemy.slowUntil)).toBe(true);
    engine.toMenu(); engine.setHero('priest'); engine.start();
    expect(engine.snapshot().hero).toMatchObject({ id: 'priest', charge: 0, activeRemaining: 0 });
  });
});
