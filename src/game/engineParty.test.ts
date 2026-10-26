import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { HERO_CHARACTERS } from './characterCatalog';
import type { Enemy, Word } from './types';

const bank: Word[] = Array.from({ length: 150 }, (_, index) => ({ id: `coop-${index}`,
  answer: `training${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`,
  meaning: 'Từ kiểm thử đội', category: 'test', partOfSpeech: 'noun', difficulty: 1, learningLevel: 1 }));
type Control = { hp: number; input: string; nextBoss: number; nextSpawn: number; hurt(amount: number, enemy: Enemy): number };
const control = (engine: GameEngine) => engine as unknown as Control;
function party(count = 2, boss = false) {
  const engine = new GameEngine(() => .13, undefined, undefined, bank);
  engine.configureParty(Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}`, heroId: HERO_CHARACTERS[index].id })));
  engine.start(boss ? 'boss' : 'survival');
  control(engine).nextBoss = control(engine).nextSpawn = 1e9;
  for (const enemy of engine.enemies) { enemy.speed = 0; enemy.nextAttackAt = 1e9; }
  engine.drainEvents();
  return engine;
}
function selected(engine: GameEngine, id: string) { return engine.enemies.find(enemy => enemy.id === engine.snapshotFor(id).target?.id)!; }
function solveAs(engine: GameEngine, id: string) {
  const enemy = selected(engine, id);
  engine.commandAs(id, () => { for (const letter of enemy.challenge.word.answer) engine.typeKey(letter); });
}

describe('one authoritative cooperative simulation', () => {
  it('validates unique actors/heroes, offers four distinct starting targets, and advances the shared clock once', () => {
    const engine = party(4);
    expect(engine.enemies).toHaveLength(4);
    expect(new Set(engine.players.map(player => player.targetId)).size).toBe(4);
    expect(engine.snapshotFor('p3').party).toMatchObject({ selfId: 'p3', players: expect.arrayContaining([expect.objectContaining({ id: 'p1', name: 'Player 1' })]) });
    engine.commandAs('p1', () => engine.setMovement(-1));
    const positions = engine.players.map(player => player.x);
    engine.step(100);
    expect(engine.clock).toBe(100);
    expect(engine.snapshotFor('p1').playerX).toBeCloseTo(positions[0] - 16);
    expect(engine.snapshotFor('p2').playerX).toBe(positions[1]);
    expect(() => engine.configureParty([{ id: 'new', heroId: 'archer' }])).toThrow('before a match');
    const blank = new GameEngine();
    for (const members of [[], [{ id: 'a', heroId: 'archer' }, { id: 'a', heroId: 'wizard' }],
      [{ id: 'a', heroId: 'archer' }, { id: 'b', heroId: 'archer' }], [{ id: 'a', heroId: 'invalid' }]]) {
      expect(() => blank.configureParty(members)).toThrow();
    }
  });

  it('claims at selection before any letter and releases input, movement and claims on disconnect', () => {
    const engine = party(), first = engine.snapshotFor('p1').target!.id;
    engine.commandAs('p2', () => engine.cycleTarget());
    expect(engine.snapshotFor('p2').target!.id).not.toBe(first);
    engine.commandAs('p1', () => { engine.typeKey(selected(engine, 'p1').challenge.word.answer[0]); engine.setMovement(-1); });
    engine.setPartyConnected('p1', false);
    expect(engine.snapshotFor('p1')).toMatchObject({ input: '', target: null, hp: 100 });
    const x = engine.snapshotFor('p1').playerX;
    engine.commandAs('p2', () => engine.cycleTarget());
    expect(engine.snapshotFor('p2').target?.id).toBe(first);
    expect(engine.commandAs('p1', () => engine.typeKey('z'))).toBeUndefined();
    engine.step(100); expect(engine.snapshotFor('p1').playerX).toBe(x);
    engine.setPartyConnected('p1', true); engine.step(10);
    expect(engine.snapshotFor('p1').target?.id).not.toBe(engine.snapshotFor('p2').target?.id);
  });

  it('keeps input/jam, HP, inventory and hero charge local while team word totals are shared', () => {
    const engine = party();
    engine.commandAs('p1', () => { const enemy = selected(engine, 'p1'); engine.typeKey(enemy.challenge.word.answer[0]); engine.typeKey('z'); });
    engine.commandAs('p2', () => engine.typeKey(selected(engine, 'p2').challenge.word.answer[0]));
    expect(engine.snapshotFor('p1').jamRemaining).toBe(300);
    expect(engine.snapshotFor('p2').jamRemaining).toBe(0);
    expect(engine.snapshotFor('p2').hero.charge).toBe(1);
    engine.commandAs('p2', () => { control(engine).hp = 60; engine.useItem('health'); });
    expect(engine.snapshotFor('p2').hp).toBe(85);
    expect(engine.snapshotFor('p1').hp).toBe(100);
    expect(engine.snapshotFor('p1').inventory.health).toBe(1);
    expect(engine.snapshotFor('p2').inventory.health).toBe(0);
  });

  it('resolves each projectile under its owner so one actor cannot borrow another actor’s damage boost', () => {
    const engine = party(), a = selected(engine, 'p1'), b = selected(engine, 'p2');
    for (const enemy of [a, b]) { enemy.kind = 'armored'; enemy.hp = enemy.maxHp = 2; }
    engine.commandAs('p1', () => engine.useItem('damage'));
    solveAs(engine, 'p1'); solveAs(engine, 'p2');
    const shots = engine.drainEvents().filter(event => event.type === 'shot');
    expect(new Set(shots.map(event => event.playerId))).toEqual(new Set(['p1', 'p2']));
    expect(shots.every(event => event.sourceX !== undefined)).toBe(true);
    engine.step(600);
    expect(engine.enemies.some(enemy => enemy.id === a.id)).toBe(false);
    expect(engine.enemies.find(enemy => enemy.id === b.id)?.hp).toBe(1);
    expect(engine.snapshotFor('p1').words).toBe(2);
    expect(engine.snapshotFor('p2').words).toBe(2);
    expect(engine.snapshotFor('p2').boostRemaining).toBe(0);
  });

  it('Boss AoE damages every living actor inside the locked zone and emits directional hurt events for each recipient', () => {
    const engine = party(2, true), boss = engine.enemies[0];
    boss.x = 900; boss.nextAttackAt = 0;
    engine.step(1510);
    expect(engine.snapshotFor('p1').hp).toBe(88);
    expect(engine.snapshotFor('p2').hp).toBe(88);
    const events = engine.drainEvents();
    expect(events.filter(event => event.type === 'player-hurt').map(event => event.playerId).sort()).toEqual(['p1', 'p2']);
    expect(events.filter(event => event.type === 'attack-impact')).toMatchObject([{ attackKind: 'slam', damage: 24, hit: true }]);
  });

  it('keeps a charge lane locked to its original player while another ally may still stand in it', () => {
    const engine = party(2, true), boss = engine.enemies[0];
    engine.commandAs('p1', () => { engine.playerX = 640; });
    engine.commandAs('p2', () => { engine.playerX = 680; });
    boss.x = 900; boss.bossPhase = 3; boss.attackSequence = 1; boss.nextAttackAt = 0;
    engine.step(10); expect(boss.attackTargetPlayerId).toBe('p2');
    expect(boss.attackTargetX).toBe(680);
    engine.commandAs('p2', () => engine.setMovement(-1)); engine.step(1100);
    expect(engine.snapshotFor('p1').hp).toBe(84);
    expect(engine.snapshotFor('p2').hp).toBe(100);
    expect(boss.attackTargetX).toBe(680);
    for (const player of engine.players) expect(Math.abs(player.x - boss.x)).toBeGreaterThanOrEqual(180);
  });

  it('does not grant disconnected actors invulnerability, and only ends when the whole team is down', () => {
    const engine = party(), source = engine.enemies[0];
    engine.setPartyConnected('p1', false);
    // Damage is simulation work, not a command: disconnected bodies remain vulnerable.
    const context = engine as unknown as { asActor<T>(id: string, callback: () => T): T };
    context.asActor('p1', () => control(engine).hurt(100, source));
    expect(engine.snapshotFor('p1')).toMatchObject({ hp: 0, phase: 'playing', target: null });
    expect(engine.commandAs('p1', () => engine.useItem('health'))).toBeUndefined();
    context.asActor('p2', () => control(engine).hurt(100, source));
    expect(engine.snapshotFor('p2').phase).toBe('over');
    expect(engine.drainEvents().filter(event => event.type === 'game-over')).toHaveLength(1);
  });

  it('preserves genuinely launched shots after departure without retaining the actor or leaving a word resolving forever', () => {
    const engine = party(), victim = selected(engine, 'p1');
    solveAs(engine, 'p1'); engine.removePartyPlayer('p1');
    expect(engine.players.map(player => player.id)).toEqual(['p2']);
    expect(() => engine.snapshotFor('p1')).toThrow('Unknown party player');
    engine.step(600);
    expect(engine.enemies.some(enemy => enemy.id === victim.id)).toBe(false);
    expect(engine.snapshotFor('p2').kills).toBe(1);
    expect(engine.snapshotFor('p2').phase).toBe('playing');
  });

  it('tracks healing dwell separately so standing together does not accelerate the two-second timer', () => {
    const engine = party(), zone = engine.worldObjects.find(object => object.kind === 'healing-zone')!;
    for (const id of ['p1', 'p2']) engine.commandAs(id, () => { engine.playerX = zone.x; control(engine).hp = 40; });
    engine.step(1000);
    expect(engine.snapshotFor('p1').hp).toBe(40); expect(engine.snapshotFor('p2').hp).toBe(40);
    expect(zone.charges).toBe(3);
    engine.step(1000);
    expect(engine.snapshotFor('p1').hp).toBe(55); expect(engine.snapshotFor('p2').hp).toBe(55);
    expect(zone.charges).toBe(1);
  });

  it('uses nearest living-player aggro and never recycles an enemy still visible to a distant teammate', () => {
    const engine = party(), enemy = engine.enemies[0]; engine.enemies = [enemy];
    engine.commandAs('p1', () => { engine.playerX = 400; });
    engine.commandAs('p2', () => { engine.playerX = 4000; });
    enemy.x = 3500; enemy.speed = 14;
    engine.step(100);
    expect(enemy.x).toBeCloseTo(3501.4);
    expect(engine.snapshotFor('p1').target).toBeNull();
    expect(engine.snapshotFor('p2').target?.id).toBe(enemy.id);
  });

  it('rejects asynchronous commands and cannot pause every teammate through a player command', () => {
    const engine = party();
    expect(() => engine.commandAs('p1', async () => engine.typeKey('z'))).toThrow('synchronous');
    engine.commandAs('p1', () => engine.pause()); engine.step(100);
    expect(engine.clock).toBe(100); expect(engine.snapshotFor('p2').phase).toBe('playing');
  });
});
