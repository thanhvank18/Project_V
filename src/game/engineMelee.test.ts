import { describe, expect, it } from 'vitest';
import { GameEngine, PLAYER_X } from './engine';
import { attackReach, getHeroCombat, MELEE_LETTER_INTERVAL } from './heroCombat';
import { HERO_CHARACTERS } from './characterCatalog';
import { getHeroSkill } from './heroSkills';
import type { Enemy, Word } from './types';

const bank: Word[] = Array.from({ length: 120 }, (_, index) => ({ id: `melee-${index}`,
  answer: `training${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`,
  meaning: 'Từ thử', category: 'test', partOfSpeech: 'noun', difficulty: 1, learningLevel: 1 }));
type Control = { hp: number; words: number; nextSpawn: number; nextBoss: number; hurt(amount: number, enemy: Enemy): number; kill(enemy: Enemy): void };
const control = (engine: GameEngine) => engine as unknown as Control;
function prepare(hero = 'knight', boss = false) {
  const engine = new GameEngine(() => .13, undefined, undefined, bank);
  engine.setHero(hero); engine.start(boss ? 'boss' : 'survival');
  control(engine).nextSpawn = control(engine).nextBoss = 1e9;
  const target = engine.enemies[0]; engine.enemies = [target]; engine.targetId = target.id;
  target.x = 1000; target.speed = 0; target.nextAttackAt = 1e9;
  target.challenge.word = { ...bank[0], answer: 'planet' };
  engine.drainEvents();
  return { engine, target };
}
function type(engine: GameEngine, word: string) { for (const letter of word) engine.typeKey(letter); }
function shots(engine: GameEngine) { return engine.drainEvents().filter(event => event.type === 'shot'); }

describe('melee range, buffered letters and automatic approach', () => {
  it('assigns five melee heroes more health and appropriate sword/spear reach', () => {
    const melee = HERO_CHARACTERS.filter(hero => getHeroCombat(hero.id).class === 'melee');
    expect(melee.map(hero => hero.id).sort()).toEqual(['armored-axeman', 'knight', 'knight-templar', 'lancer', 'swordsman']);
    for (const hero of HERO_CHARACTERS) {
      const engine = prepare(hero.id).engine;
      expect(engine.snapshot().hp).toBe(getHeroCombat(hero.id).maxHp);
      expect(engine.snapshot().maxHp).toBe(getHeroCombat(hero.id).maxHp);
    }
    expect(attackReach('knight', 'normal')).toBe(120);
    expect(attackReach('lancer', 'normal')).toBe(160);
    expect(attackReach('knight', 'tank')).toBeGreaterThan(180);
  });

  it('buffers a whole word remotely without score, skill charge or shots, then releases distinct letters at melee range', () => {
    const { engine, target } = prepare(); type(engine, 'planet');
    expect(engine.snapshot()).toMatchObject({ words: 0, score: 0, input: 'planet', hero: { charge: 0 }, combat: { queued: 6, approaching: true, inRange: false } });
    expect(target.challenge.credited.size).toBe(0); expect(shots(engine)).toHaveLength(0);
    engine.step(1490); expect(shots(engine)).toHaveLength(0);
    engine.step(10);
    const first = shots(engine); expect(first).toHaveLength(1);
    expect(Math.abs(first[0].x! - first[0].sourceX!)).toBeLessThanOrEqual(120.001);
    expect(engine.snapshot().words).toBe(0);
    engine.step(MELEE_LETTER_INTERVAL * 5);
    const rest = shots(engine);
    expect(rest.map(event => event.glyph).join('')).toBe('lanet');
    const all = [...first, ...rest];
    expect(new Set(all.map(event => event.shotId)).size).toBe(6);
    for (let i = 1; i < all.length; i++) expect(all[i].firedAt! - all[i - 1].firedAt!).toBe(MELEE_LETTER_INTERVAL);
    expect(engine.snapshot()).toMatchObject({ words: 1, kills: 0, input: '', combat: { queued: 0 } });
    engine.step(250); expect(engine.snapshot().kills).toBe(1);
  });

  it('retains ranged immediate firing from a distance', () => {
    const { engine } = prepare('soldier'); type(engine, 'planet');
    expect(shots(engine)).toHaveLength(6);
    expect(engine.snapshot()).toMatchObject({ words: 1, maxHp: 100, combat: { class: 'ranged', queued: 0 } });
    expect(engine.playerX).toBe(PLAYER_X);
  });

  it.each(['armored-axeman', 'knight', 'knight-templar', 'lancer', 'swordsman'])('%s charges its skill from actual in-range launches', hero => {
    const { engine, target } = prepare(hero);
    target.challenge.word = { ...bank[0], answer: 'abcdefghijklmnopqrstuvwx' };
    const threshold = getHeroSkill(hero).threshold;
    type(engine, target.challenge.word.answer.slice(0, threshold));
    expect(engine.snapshot().hero.charge).toBe(0);
    target.x = engine.playerX + 100;
    engine.step(10 + (threshold - 1) * MELEE_LETTER_INTERVAL);
    const events = engine.drainEvents();
    expect(events.filter(event => event.type === 'shot')).toHaveLength(threshold);
    expect(events.filter(event => event.type === 'hero-skill')).toMatchObject([{ heroId: hero, skillPhase: 'activate' }]);
    expect(engine.snapshot()).toMatchObject({ words: 0, hero: { charge: 0 }, combat: { queued: 0 } });
  });

  it('manual movement cancels approach immediately, preserves input, wins over typing, and full-buffer typing can resume', () => {
    const { engine } = prepare(); type(engine, 'plan'); engine.step(100);
    const x = engine.playerX;
    engine.setMovement(-1); type(engine, 'et'); engine.step(100);
    expect(engine.playerX).toBeCloseTo(x - 16);
    expect(engine.snapshot()).toMatchObject({ input: 'planet', combat: { approaching: false, queued: 6 } });
    engine.setMovement(0); engine.step(100);
    expect(engine.playerX).toBeCloseTo(x - 16); expect(shots(engine)).toHaveLength(0);
    engine.typeKey('x');
    expect(engine.snapshot()).toMatchObject({ input: 'planet', jamRemaining: 0, combat: { approaching: true, queued: 6 } });
    engine.step(100); expect(engine.playerX).toBeCloseTo(x);
  });

  it('allows manual re-entry into range to release saved attacks without rearming approach', () => {
    const { engine } = prepare(); type(engine, 'pla'); engine.setMovement(1);
    engine.step(1500);
    expect(shots(engine)).toHaveLength(1);
    expect(engine.snapshot().combat).toMatchObject({ approaching: false, queued: 2 });
  });

  it('Backspace cancels unsent positions and retyping launched letters cannot farm shots or skill charge', () => {
    const { engine, target } = prepare(); type(engine, 'pla'); engine.typeKey('Backspace');
    expect(engine.snapshot().combat?.queued).toBe(2);
    engine.playerX = 880; engine.step(10);
    expect(shots(engine).map(event => event.glyph)).toEqual(['p']);
    engine.typeKey('Backspace'); engine.typeKey('Backspace');
    expect(engine.snapshot().combat?.queued).toBe(0);
    type(engine, 'pla'); engine.step(140);
    expect(shots(engine).map(event => event.glyph)).toEqual(['l', 'a']);
    expect(engine.snapshot().hero.charge).toBe(3);
    expect(target.challenge.credited.size).toBe(3);
    expect(engine.snapshot().words).toBe(0);
  });

  it('keeps wrong-key jam and does not release a queued letter until jam expires', () => {
    const { engine } = prepare(); type(engine, 'p'); engine.typeKey('z'); engine.playerX = 880;
    engine.step(299); expect(shots(engine)).toHaveLength(0);
    expect(engine.snapshot()).toMatchObject({ input: 'p', jamRemaining: 1 });
    engine.step(1); expect(shots(engine)).toHaveLength(1);
  });

  it.each(['shield', 'missing', 'challenge'] as const)('invalidates a buffered target safely: %s', reason => {
    const { engine, target } = prepare(); type(engine, 'planet');
    if (reason === 'shield') engine.enemies.push({ ...target, id: 900, x: 820, kind: 'tank', hp: 9, maxHp: 9, challenge: { ...target.challenge, id: 900 } });
    if (reason === 'missing') engine.enemies = [];
    if (reason === 'challenge') target.challenge = { ...target.challenge, id: 900, credited: new Set() };
    engine.step(10);
    expect(engine.snapshot()).toMatchObject({ input: '', words: 0, combat: { approaching: false, queued: 0 } });
    expect(engine.playerX).toBe(PLAYER_X); expect(shots(engine)).toHaveLength(0);
  });

  it('pause suspends queued combat until a new typing action, and menu/restart clears it', () => {
    const { engine } = prepare(); type(engine, 'planet'); engine.pause(); engine.step(2000);
    engine.resume(); engine.step(3000);
    expect(engine.playerX).toBe(PLAYER_X); expect(shots(engine)).toHaveLength(0);
    engine.typeKey('x'); engine.step(100); expect(engine.playerX).toBeGreaterThan(PLAYER_X);
    engine.toMenu(); expect(engine.snapshot().combat?.queued).toBe(0);
    engine.start(); expect(engine.snapshot()).toMatchObject({ hp: 150, input: '', combat: { queued: 0, approaching: false } });
  });

  it('melee attacks barrels only after reaching them', () => {
    const { engine } = prepare(); engine.enemies = []; control(engine).words = 6;
    engine.playerX = 800; engine.step(10);
    const barrel = engine.worldObjects.find(object => object.kind === 'barrel' && object.state === 'active')!;
    expect(barrel.challenge).toBeDefined(); engine.targetId = -barrel.id;
    type(engine, barrel.challenge!.word.answer);
    expect(shots(engine)).toHaveLength(0); expect(barrel.resolving).toBeFalsy();
    engine.step(2200);
    expect(barrel.state).toBe('used'); expect(engine.snapshot().words).toBe(7);
  });

  it('reaches a Boss outside its solid body and cannot cross it in either direction', () => {
    const { engine, target } = prepare('knight', true); type(engine, 'planet'); engine.step(875);
    expect(shots(engine)).toHaveLength(1); expect(engine.playerX).toBeCloseTo(780);
    engine.setMovement(1); engine.step(4000);
    expect(engine.playerX).toBeCloseTo(820);
    engine.playerX = 1300; engine.setMovement(-1); engine.step(4000);
    expect(engine.playerX).toBeCloseTo(target.x + 180);
  });

  it('caps medical kits, healing zones and Boss rewards at the selected hero maximum', () => {
    const { engine, target } = prepare(); control(engine).hp = 140; engine.useItem('health');
    expect(engine.snapshot().hp).toBe(150);
    const zone = engine.worldObjects.find(object => object.kind === 'healing-zone')!;
    engine.playerX = zone.x; control(engine).hp = 145; engine.step(2000);
    expect(engine.snapshot().hp).toBe(150);
    control(engine).hp = 148; target.kind = 'tank'; target.hp = 0; control(engine).kill(target);
    expect(engine.snapshot().hp).toBe(150);
  });

  it('resets healing-zone standing time when autoapproach moves, even with no movement key held', () => {
    const { engine, target } = prepare();
    const zone = engine.worldObjects.find(object => object.kind === 'healing-zone')!;
    engine.playerX = zone.x; target.x = zone.x + 400; control(engine).hp = 140;
    engine.step(1990); expect(zone.progress).toBeCloseTo(.995);
    engine.typeKey('p'); engine.step(10);
    expect(engine.playerX).toBeGreaterThan(zone.x);
    expect(engine.snapshot().hp).toBe(140); expect(zone.progress).toBe(0);
  });

  it('isolates melee queues/health from a ranged teammate and discards unfired attacks on disconnect/death', () => {
    const engine = new GameEngine(() => .13, undefined, undefined, bank);
    engine.configureParty([{ id: 'melee', heroId: 'knight' }, { id: 'ranged', heroId: 'soldier' }]); engine.start();
    control(engine).nextSpawn = control(engine).nextBoss = 1e9;
    for (const enemy of engine.enemies) { enemy.speed = 0; enemy.nextAttackAt = 1e9; }
    const targets = ['melee', 'ranged'].map(id => engine.enemies.find(enemy => enemy.id === engine.snapshotFor(id).target?.id)!);
    engine.commandAs('melee', () => type(engine, targets[0].challenge.word.answer.slice(0, 3)));
    engine.commandAs('ranged', () => type(engine, targets[1].challenge.word.answer.slice(0, 3)));
    expect(engine.snapshotFor('melee')).toMatchObject({ hp: 150, maxHp: 150, hero: { charge: 0 }, combat: { queued: 3 } });
    expect(engine.snapshotFor('ranged')).toMatchObject({ hp: 100, maxHp: 100, hero: { charge: 3 }, combat: { queued: 0 } });
    expect(shots(engine).map(event => event.playerId)).toEqual(['ranged', 'ranged', 'ranged']);
    engine.setPartyConnected('melee', false); engine.step(4000);
    expect(engine.snapshotFor('melee')).toMatchObject({ input: '', combat: { queued: 0, approaching: false } });
    expect(shots(engine)).toHaveLength(0);
    engine.setPartyConnected('melee', true); engine.step(10);
    engine.commandAs('melee', () => { type(engine, targets[0].challenge.word.answer.slice(0, 2)); control(engine).hurt(200, targets[0]); });
    expect(engine.snapshotFor('melee')).toMatchObject({ hp: 0, combat: { queued: 0, approaching: false } });
    expect(engine.snapshotFor('ranged').phase).toBe('playing');
  });
});
