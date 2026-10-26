import { describe, expect, it } from 'vitest';
import { GameEngine, canTargetEnemy, PLAYER_X } from './engine';
import { getHeroSkill } from './heroSkills';
import { createWorldObjects, clipAtGate } from './tacticalRules';
import type { Enemy, Word } from './types';

const bank: Word[] = Array.from({ length: 90 }, (_, index) => ({ id: `word-${index}`,
  answer: `training${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`,
  meaning: 'Từ kiểm thử', category: 'test', partOfSpeech: 'noun', difficulty: 1, learningLevel: 1 }));
type Setup = { hp: number; words: number; nextSpawn: number; nextBoss: number; nextFormationAt: number };
const state = (engine: GameEngine) => engine as unknown as Setup;
function game(hero = 'soldier', boss = false) {
  const engine = new GameEngine(() => .13, undefined, undefined, bank);
  engine.setHero(hero); engine.start(boss ? 'boss' : 'survival');
  state(engine).nextSpawn = state(engine).nextBoss = 1e9;
  for (const enemy of engine.enemies) { enemy.speed = 0; enemy.nextAttackAt = 1e9; }
  engine.drainEvents();
  return engine;
}
function solve(engine: GameEngine, enemy = engine.enemies[0]) {
  engine.targetId = enemy.id;
  for (const letter of enemy.challenge.word.answer) engine.typeKey(letter);
}
function charge(engine: GameEngine, target = engine.enemies[0]) {
  target.challenge.word = { ...bank[0], answer: 'abcdefghijklmnopqrstuvwx' };
  engine.targetId = target.id;
  for (const letter of target.challenge.word.answer.slice(0, getHeroSkill(engine.snapshot().hero.id).threshold)) engine.typeKey(letter);
}

describe('position-dependent hero tactics', () => {
  it('rewards Archer range, Axeman proximity and Lancer aligned reach', () => {
    const archer = game('archer'); archer.enemies = [archer.enemies[0]];
    archer.enemies[0].x = PLAYER_X + 400; charge(archer);
    expect(archer.enemies[0].x).toBe(PLAYER_X + 456);
    const axe = game('armored-axeman'); axe.enemies = [axe.enemies[0]];
    axe.enemies[0].x = PLAYER_X + 130; charge(axe);
    expect(axe.enemies[0].stunUntil).toBe(900);
    const lance = game('lancer'); lance.enemies = [lance.enemies[0]];
    lance.enemies[0].x = PLAYER_X + 450; charge(lance);
    expect(lance.enemies[0].x).toBe(PLAYER_X + 540);
  });
  it('gives Knight protected approach speed and Swordsman an actual escape burst', () => {
    const knight = game('knight'); knight.enemies = [knight.enemies[0]]; knight.enemies[0].x = 1100;
    charge(knight); knight.setMovement(1); knight.step(100);
    expect(knight.playerX).toBeCloseTo(PLAYER_X + 20);
    const sword = game('swordsman'); sword.enemies = [sword.enemies[0]]; sword.enemies[0].x = PLAYER_X + 120;
    charge(sword); sword.setMovement(-1); sword.step(100);
    expect(sword.playerX).toBeCloseTo(PLAYER_X - 22.4);
  });
  it('anchors Templar protection, rewards Priest stillness, Soldier retreat and Wizard distance', () => {
    const templar = game('knight-templar'); charge(templar); templar.playerX += 200;
    const hurt = templar as unknown as { hurt(amount: number, source: Enemy): number };
    expect(hurt.hurt(20, templar.enemies[0])).toBe(20);
    const priest = game('priest'); priest.step(1000); state(priest).hp = 60; charge(priest);
    expect(priest.snapshot().hp).toBe(68);
    const soldier = game(); soldier.enemies = [soldier.enemies[0]]; soldier.enemies[0].x = 1000;
    soldier.setMovement(-1); charge(soldier); expect(soldier.enemies[0].slowUntil).toBe(3000);
    const wizard = game('wizard'); wizard.enemies = [wizard.enemies[0]]; wizard.enemies[0].x = 1100;
    charge(wizard); expect(wizard.enemies[0].freezeUntil).toBe(1200);
  });
});

describe('locked warnings, formations and support roles', () => {
  it('alternates phase-two slam and charge, preserves a locked lane, and allows a real escape', () => {
    const engine = game('archer', true), boss = engine.enemies[0];
    boss.x = PLAYER_X + 180; boss.bossPhase = 2; boss.nextAttackAt = 0;
    engine.step(10); expect(boss.attackKind).toBe('slam'); engine.step(1500);
    boss.nextAttackAt = engine.clock; engine.step(10);
    const warning = engine.drainEvents().filter(event => event.type === 'attack').at(-1)!;
    expect(warning).toMatchObject({ attackKind: 'charge', laneTo: PLAYER_X });
    const before = engine.snapshot().hp;
    engine.setMovement(-1); engine.step(1500);
    const impact = engine.drainEvents().find(event => event.type === 'attack-impact')!;
    expect(impact).toMatchObject({ attackKind: 'charge', targetX: warning.targetX, hit: false });
    expect(engine.snapshot().hp).toBe(before);
    expect(boss.stunUntil).toBe(0);
  });
  it('ranged attacks lock their endpoint, preserve windup through freeze, and miss a player who retreats', () => {
    const engine = game(), enemy = engine.enemies[0]; engine.enemies = [enemy];
    enemy.role = 'ranged'; enemy.x = 1000; enemy.nextAttackAt = 0;
    engine.step(10); expect(enemy.attackTargetX).toBe(PLAYER_X);
    engine.useItem('freeze'); engine.step(3000);
    expect(engine.drainEvents().some(event => event.type === 'attack-impact')).toBe(false);
    engine.setMovement(-1); engine.step(1300);
    expect(engine.drainEvents().find(event => event.type === 'attack-impact')).toMatchObject({ attackKind: 'ranged', hit: false, targetX: PLAYER_X });
  });
  it('creates a shield/support formation, and a broken shield exposes followers before its word is finished', () => {
    const engine = game(); engine.enemies = []; state(engine).words = 4;
    state(engine).nextFormationAt = 0; state(engine).nextSpawn = 0;
    engine.step(10);
    const shield = engine.enemies.find(enemy => enemy.role === 'shield')!;
    const follower = engine.enemies.find(enemy => enemy.role === 'ranged')!;
    expect(shield).toBeDefined(); expect(follower).toBeDefined();
    expect(canTargetEnemy(engine.enemies, follower, engine.playerX)).toBe(false);
    shield.hp = 1;
    expect(canTargetEnemy(engine.enemies, follower, engine.playerX)).toBe(true);
    expect(engine.enemies.length).toBeLessThanOrEqual(6);
  });
  it('summons at most two children with reserved unique words and then becomes a ranged actor', () => {
    const engine = game(), enemy = engine.enemies[0]; engine.enemies = [enemy];
    enemy.x = 1000; enemy.role = 'summoner';
    for (let count = 0; count < 2; count++) { enemy.nextAttackAt = engine.clock; engine.step(1810); }
    expect(enemy.summons).toBe(2); expect(enemy.role).toBe('ranged');
    expect(engine.enemies).toHaveLength(3);
    expect(new Set(engine.enemies.map(actor => actor.challenge.word.answer)).size).toBe(3);
    expect(engine.snapshot().words).toBe(0); expect(engine.snapshot().kills).toBe(0);
  });
});

describe('interactive map and perfect-word momentum', () => {
  it('gates toggle only nearby on an empty input and obstruct enemy travel from either side', () => {
    const objects = createWorldObjects(), gate = objects.find(object => object.kind === 'gate')!;
    gate.state = 'closed';
    expect(clipAtGate(gate.x - 20, gate.x + 20, objects)).toBe(gate.x - 4);
    expect(clipAtGate(gate.x + 20, gate.x - 20, objects)).toBe(gate.x + 4);
    const engine = game(); engine.playerX = gate.x; engine.interactWorld();
    expect(engine.worldObjects.find(object => object.id === gate.id)?.state).toBe('closed');
    engine.typeKey(engine.enemies.find(enemy => enemy.id === engine.targetId)!.challenge.word.answer[0]);
    engine.interactWorld(); expect(engine.worldObjects.find(object => object.id === gate.id)?.state).toBe('closed');
  });
  it('healing requires uninterrupted dwell, pauses with the game and has finite charges', () => {
    const engine = game(), zone = engine.worldObjects.find(object => object.kind === 'healing-zone')!;
    engine.playerX = zone.x; state(engine).hp = 20;
    engine.step(1990); expect(engine.snapshot().hp).toBe(20);
    engine.pause(); engine.step(9000); expect(zone.progress).toBeCloseTo(.995);
    engine.resume(); engine.step(2010); expect(engine.snapshot().hp).toBe(35);
    engine.step(4000); expect(engine.snapshot().hp).toBe(65); expect(zone.charges).toBe(0);
    engine.step(5000); expect(engine.snapshot().hp).toBe(65);
  });
  it('barrels use fresh deck words and break armor without solving, replacing, killing or looting that enemy', () => {
    const engine = game(); state(engine).words = 6;
    const object = engine.worldObjects.find(entry => entry.kind === 'barrel')!;
    engine.playerX = object.x - 100; engine.step(10);
    expect(object.challenge).toBeDefined();
    const enemy = engine.enemies[0]; engine.enemies = [enemy];
    enemy.x = object.x + 50; enemy.kind = 'armored'; enemy.hp = enemy.maxHp = 2;
    const answer = enemy.challenge.word.answer;
    expect(object.challenge!.word.answer).not.toBe(answer);
    engine.targetId = -object.id;
    for (const letter of object.challenge!.word.answer) engine.typeKey(letter);
    engine.step(500);
    expect(object.state).toBe('used'); expect(enemy.hp).toBe(1);
    expect(enemy.challenge.word.answer).toBe(answer); expect(enemy.challenge.credited.size).toBe(0);
    expect(engine.snapshot().words).toBe(7); expect(engine.snapshot().kills).toBe(0);
    expect(engine.drainEvents().some(event => event.type === 'pickup' || event.type === 'enemy-death')).toBe(false);
  });
  it('perfect words build bounded momentum, errors soften it, retyping cannot farm it and timers pause', () => {
    const engine = game(); solve(engine); engine.step(400);
    expect(engine.snapshot().momentum?.level).toBe(1);
    solve(engine, engine.enemies[0]); engine.step(400);
    expect(engine.snapshot().momentum?.level).toBe(2);
    engine.step(1200); const target = engine.enemies.find(enemy => enemy.id === engine.targetId)!;
    engine.typeKey(target.challenge.word.answer[0]); engine.typeKey('Backspace'); engine.typeKey(target.challenge.word.answer[0]);
    expect(engine.snapshot().momentum?.level).toBe(2);
    engine.typeKey('z'); expect(engine.snapshot().momentum?.level).toBe(1);
    const time = engine.snapshot().momentum!.remaining;
    engine.pause(); engine.step(20000); expect(engine.snapshot().momentum!.remaining).toBe(time);
  });
});
