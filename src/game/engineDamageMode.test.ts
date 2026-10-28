import { describe, expect, it } from 'vitest';
import { GameEngine, PLAYER_X } from './engine';
import { HERO_CHARACTERS } from './characterCatalog';
import { getHeroCombat } from './heroCombat';
import { getHeroSkill, type HeroSkillDefinition } from './heroSkills';
import type { Enemy } from './types';
import { WORDS } from './vocabulary';

type Control = { hp: number; hurt(amount: number, source: Enemy): number; kill(enemy: Enemy): void; activateHeroSkill(skill: HeroSkillDefinition, target: Enemy): void };
const control = (engine: GameEngine) => engine as unknown as Control;
const oneHit = () => new GameEngine(() => .25, undefined, undefined, WORDS, { damageMode: 'one-hit' });

function contact(engine: GameEngine, x = engine.playerX) {
  const enemy = engine.enemies[0]; engine.enemies = [enemy];
  enemy.x = x - 92; enemy.speed = 0; enemy.attackUntil = 0; enemy.nextAttackAt = 0;
  return enemy;
}

describe('Create Mode one-hit rules', () => {
  it('gives every hero one HP before play, after selection and on restart without changing normal profiles', () => {
    for (const hero of HERO_CHARACTERS) {
      const engine = oneHit();
      expect(engine.snapshot()).toMatchObject({ hp: 1, maxHp: 1 });
      engine.setHero(hero.id); expect(engine.snapshot()).toMatchObject({ hp: 1, maxHp: 1 });
      engine.start(); expect(engine.snapshot()).toMatchObject({ hp: 1, maxHp: 1 });
      engine.toMenu(); engine.start(); expect(engine.snapshot()).toMatchObject({ hp: 1, maxHp: 1 });

      const normal = new GameEngine(() => .25, undefined, undefined, WORDS, { damageMode: 'health' });
      normal.setHero(hero.id); normal.start();
      expect(normal.snapshot()).toMatchObject({ hp: getHeroCombat(hero.id).maxHp, maxHp: getHeroCombat(hero.id).maxHp });
    }
    expect(new GameEngine().snapshot()).toMatchObject({ hp: 100, maxHp: 100 });
  });

  it.each(['normal', 'runner', 'armored'] as const)('ends a solo run on one successful %s contact after the full warning', kind => {
    const engine = oneHit(); engine.setHero('swordsman'); engine.start();
    const enemy = contact(engine); enemy.kind = kind;
    engine.step(10); expect(engine.snapshot()).toMatchObject({ hp: 1, phase: 'playing' });
    engine.step(499); expect(engine.snapshot().hp).toBe(1);
    engine.step(1);
    expect(engine.snapshot()).toMatchObject({ hp: 0, maxHp: 1, phase: 'over', summary: { reason: 'defeat' } });
    expect(engine.drainEvents().find(event => event.type === 'attack-impact')).toMatchObject({ hit: true, damage: 1 });
    engine.useItem('health'); expect(engine.snapshot().hp).toBe(0);
  });

  it('lets missed Boss slams be dodged, then makes a successful slam fatal', () => {
    const engine = oneHit(); engine.start('boss');
    const boss = engine.enemies[0]; boss.x = PLAYER_X + 301; boss.speed = 0; boss.nextAttackAt = 0;
    engine.step(1510);
    expect(engine.snapshot()).toMatchObject({ hp: 1, phase: 'playing' });
    expect(engine.drainEvents().find(event => event.type === 'attack-impact')).toMatchObject({ hit: false, damage: 0 });
    boss.x = PLAYER_X + 250; boss.nextAttackAt = 0; engine.step(1510);
    expect(engine.snapshot()).toMatchObject({ hp: 0, phase: 'over' });
    expect(engine.drainEvents().find(event => event.type === 'attack-impact')).toMatchObject({ hit: true, damage: 1 });
  });

  it('preserves a complete Knight block but reduced nonzero damage still kills', () => {
    const knight = oneHit(); knight.setHero('knight'); knight.start();
    const enemy = contact(knight);
    control(knight).activateHeroSkill(getHeroSkill('knight'), enemy);
    expect(control(knight).hurt(15, enemy)).toBe(0);
    expect(knight.snapshot().hp).toBe(1);
    knight.clock += 650;
    expect(control(knight).hurt(15, enemy)).toBe(1);
    expect(knight.snapshot().phase).toBe('over');

    const templar = oneHit(); templar.setHero('knight-templar'); templar.start();
    const source = contact(templar);
    control(templar).activateHeroSkill(getHeroSkill('knight-templar'), source);
    expect(control(templar).hurt(.5, source)).toBe(1);
    expect(templar.snapshot()).toMatchObject({ hp: 0, phase: 'over' });
  });

  it('never grants extra HP from medical kits, Priest skills, world healing or a Boss reward', () => {
    const engine = oneHit(); engine.setHero('priest'); engine.start();
    for (const enemy of engine.enemies) { enemy.speed = 0; enemy.nextAttackAt = Infinity; }
    const kit = engine.snapshot().inventory.health;
    engine.useItem('health'); expect(engine.snapshot()).toMatchObject({ hp: 1, inventory: { health: kit } });
    control(engine).activateHeroSkill(getHeroSkill('priest'), engine.enemies[0]);
    expect(engine.snapshot().hp).toBe(1);
    const zone = engine.worldObjects.find(object => object.kind === 'healing-zone')!, charges = zone.charges;
    engine.playerX = zone.x; engine.step(2100);
    expect(engine.snapshot().hp).toBe(1); expect(zone.charges).toBe(charges);
    const boss = engine.enemies[0]; boss.kind = 'tank'; control(engine).kill(boss);
    expect(engine.snapshot()).toMatchObject({ hp: 1, maxHp: 1 });
  });

  it('isolates party deaths, blocks dead-player healing and restarts all heroes at one HP', () => {
    const engine = oneHit();
    engine.configureParty([{ id: 'melee', heroId: 'swordsman' }, { id: 'ranged', heroId: 'priest' }]);
    expect(engine.players.map(player => [player.hp, player.maxHp])).toEqual([[1, 1], [1, 1]]);
    engine.start();
    engine.commandAs('ranged', () => { engine.playerX = 1100; });
    const enemy = contact(engine, engine.snapshotFor('melee').playerX);
    engine.step(510);
    expect(engine.snapshotFor('melee')).toMatchObject({ hp: 0, maxHp: 1, phase: 'playing' });
    expect(engine.snapshotFor('ranged')).toMatchObject({ hp: 1, maxHp: 1, phase: 'playing' });
    let ran = false;
    engine.commandAs('melee', () => { ran = true; engine.useItem('health'); });
    expect(ran).toBe(false); expect(engine.snapshotFor('melee').hp).toBe(0);
    enemy.x = 1100 - 92; enemy.attackUntil = 0; enemy.nextAttackAt = 0;
    engine.step(510);
    expect(engine.snapshotFor('ranged')).toMatchObject({ hp: 0, maxHp: 1, phase: 'over' });
    engine.toMenu(); engine.start();
    expect(engine.players.map(player => [player.hp, player.maxHp])).toEqual([[1, 1], [1, 1]]);
  });

  it('kills all party members inside one Boss slam and records actual damage per player', () => {
    const engine = oneHit();
    engine.configureParty([{ id: 'melee', heroId: 'knight' }, { id: 'ranged', heroId: 'soldier' }]); engine.start('boss');
    const boss = engine.enemies[0]; boss.x = PLAYER_X + 230; boss.speed = 0; boss.nextAttackAt = 0;
    engine.step(1510);
    expect(engine.players.map(player => player.hp)).toEqual([0, 0]);
    expect(engine.snapshot().phase).toBe('over');
    const damage = engine.drainEvents().filter(event => event.type === 'player-hurt');
    expect(damage).toHaveLength(2);
    expect(damage.map(event => event.damage)).toEqual([1, 1]);
    expect(new Set(damage.map(event => event.playerId))).toEqual(new Set(['melee', 'ranged']));
  });
});
