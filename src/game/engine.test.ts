import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOSS_SLAM_RANGE, canTargetEnemy, ENEMY_SPEED, GameEngine, JAM_MS, PLAYER_BOUNDS, PLAYER_SPEED, PLAYER_X, STUN_MS, WORLD_WIDTH } from './engine';
import { answersFor, createChallenge, lootChanceFor, PART_OF_SPEECH_LABELS, WORDS } from './vocabulary';
import type { Enemy, Progress, RunSummary, Word, WordDifficulty } from './types';
import { parseDictionary } from './dictionary';

function playing(mode: 'survival' | 'boss' = 'survival') {
  const engine = new GameEngine(() => .13);
  engine.start(mode);
  engine.drainEvents();
  return engine;
}
function target(engine: GameEngine): Enemy { return engine.enemies.find((enemy) => enemy.id === engine.targetId)!; }
function solve(engine: GameEngine, enemy = target(engine)) {
  engine.targetId = enemy.id;
  const prefix = engine.snapshot().input;
  const answer = answersFor(enemy.challenge.word).find((word) => word.startsWith(prefix))!;
  for (const letter of answer.slice(prefix.length)) engine.typeKey(letter);
}

function progressWithOnlyUnseen(answers: string[]): Progress {
  const remaining = new Set(answers);
  return { highScore: 0, runs: 0, totalWords: 0, words: {},
    seenWords: Object.fromEntries(WORDS.filter((word) => !remaining.has(word.answer))
      .flatMap((word) => answersFor(word).map((answer) => [answer, 1]))) };
}

describe('typing and targeting', () => {
  it('locks after the first correct letter, ignores invalid input, unlocks with Backspace', () => {
    const engine = playing();
    const first = engine.targetId;
    engine.typeKey('Shift');
    engine.typeKey('!');
    expect(engine.snapshot().input).toBe('');
    engine.typeKey(target(engine).challenge.word.answer[0].toUpperCase());
    engine.cycleTarget();
    expect(engine.targetId).toBe(first);
    expect(engine.snapshot().locked).toBe(true);
    engine.typeKey('Backspace');
    engine.cycleTarget();
    expect(engine.targetId).not.toBe(first);
  });

  it('jams for exactly 300ms, preserves the correct prefix, and does not queue or count ignored keys', () => {
    const engine = playing();
    const enemy = target(engine);
    engine.typeKey(enemy.challenge.word.answer[0]);
    const bad = enemy.challenge.word.answer[1] === 'z' ? 'x' : 'z';
    engine.typeKey(bad);
    engine.typeKey(bad);
    engine.step(JAM_MS - 1);
    expect(engine.snapshot().jamRemaining).toBe(1);
    engine.typeKey(enemy.challenge.word.answer[1]);
    expect(engine.snapshot().input).toHaveLength(1);
    expect(enemy.challenge.mistakes).toBe(1);
    engine.step(1);
    engine.typeKey(enemy.challenge.word.answer[1]);
    expect(engine.snapshot().input).toHaveLength(2);
  });

  it('supports all valid alternative prefixes rather than prematurely selecting one answer', () => {
    const engine = playing();
    const enemy = target(engine);
    enemy.challenge.word = { id: 'gray', answer: 'gray', alternatives: ['grey'], meaning: 'Màu xám', category: 'Màu', partOfSpeech: 'adjective', difficulty: 2 };
    for (const letter of 'grey') engine.typeKey(letter);
    expect(engine.snapshot().words).toBe(1);
    expect(enemy.challenge.mistakes).toBe(0);
    expect(enemy.state).toBe('resolving');
  });

  it('switches immediately on completing a word, before the finisher arrives', () => {
    const engine = playing();
    const enemy = target(engine);
    solve(engine);
    expect(engine.snapshot().words).toBe(1);
    expect(engine.targetId).not.toBe(enemy.id);
    expect(engine.enemies).toContain(enemy);
    expect(enemy.state).toBe('resolving');
    engine.step(400);
    expect(engine.enemies).not.toContain(enemy);
    expect(engine.snapshot().kills).toBe(1);
  });

  it('does not give a retyped position another damaging or stunning hit', () => {
    const engine = playing();
    const enemy = target(engine);
    engine.typeKey(enemy.challenge.word.answer[0]);
    engine.step(400);
    expect(engine.drainEvents().filter((event) => event.type === 'hit')).toHaveLength(1);
    engine.typeKey('Backspace');
    engine.typeKey(enemy.challenge.word.answer[0]);
    engine.step(400);
    expect(engine.drainEvents().filter((event) => event.type === 'hit')).toHaveLength(0);
    expect(enemy.challenge.credited.size).toBe(1);
  });

  it('gives every shot a unique identity and matches effective hits on the simulation clock', () => {
    const engine = playing();
    const enemy = target(engine);
    const challengeId = enemy.challenge.id;
    engine.typeKey(enemy.challenge.word.answer[0]);
    const shot = engine.drainEvents().find((event) => event.type === 'shot')!;
    expect(shot.shotId).toBe(1);
    expect(shot.challengeId).toBe(challengeId);
    expect(shot.firedAt).toBe(0);
    expect(shot.impactAt! - shot.firedAt!).toBe(shot.duration);
    engine.step(400);
    const hit = engine.drainEvents().find((event) => event.type === 'hit')!;
    expect(hit.shotId).toBe(shot.shotId);
    expect(hit.challengeId).toBe(challengeId);
    expect(hit.firedAt).toBe(shot.firedAt);
    expect(hit.impactAt).toBeGreaterThanOrEqual(shot.impactAt!);
    expect(hit.duration).toBe(300);
    engine.typeKey('Backspace');
    engine.typeKey(enemy.challenge.word.answer[0]);
    const cosmetic = engine.drainEvents().find((event) => event.type === 'shot')!;
    expect(cosmetic.shotId).toBe(2);
    expect(cosmetic.effective).toBe(false);
    engine.step(400);
    expect(engine.drainEvents().some((event) => event.type === 'hit')).toBe(false);
    engine.start();
    engine.typeKey(target(engine).challenge.word.answer[0]);
    expect(engine.drainEvents().find((event) => event.type === 'shot')?.shotId).toBe(1);
  });
});

describe('combat invariants', () => {
  it('refreshes a 300ms stun on every effective hit without additive stacking or immunity', () => {
    const engine = playing();
    const enemy = target(engine);
    engine.typeKey(enemy.challenge.word.answer[0]);
    engine.typeKey(enemy.challenge.word.answer[1]);
    engine.step(300);
    const hits = engine.drainEvents().filter((event) => event.type === 'hit');
    expect(hits).toHaveLength(2);
    expect(hits.map((hit) => hit.duration)).toEqual([300, 300]);
    expect(enemy.immuneUntil).toBe(0);
    expect(enemy.stunUntil).toBeGreaterThan(0);
    expect(enemy.stunUntil).toBeLessThanOrEqual(300 + STUN_MS.normal);
  });

  it.each(['normal', 'runner', 'armored'] as const)('stops %s for exactly 300ms at impact', (kind) => {
    const engine = playing();
    const enemy = target(engine);
    enemy.kind = kind;
    engine.typeKey(enemy.challenge.word.answer[0]);
    engine.step(250);
    expect(enemy.stunUntil).toBe(0);
    engine.step(10);
    expect(enemy.stunUntil - engine.clock).toBe(300);
    expect(enemy.immuneUntil).toBe(0);
    const position = enemy.x;
    engine.step(290);
    expect(enemy.x).toBe(position);
    engine.step(10);
    expect(enemy.x).not.toBe(position);
  });

  it('never stuns a Boss and freezing supplies do not stop Boss movement or rage', () => {
    const engine = playing('boss');
    const enemy = target(engine);
    const initialX = enemy.x;
    engine.useItem('freeze');
    engine.typeKey(enemy.challenge.word.answer[0]);
    engine.step(400);
    expect(enemy.stunUntil).toBe(0);
    expect(enemy.immuneUntil).toBe(0);
    expect(enemy.x).toBeLessThan(initialX);
    expect(enemy.rage).toBeGreaterThan(0);
    expect(engine.drainEvents().find((event) => event.type === 'hit')?.duration).toBe(0);
  });

  it('holds a pending attack telegraph during the 300ms stun without extending on simultaneous hits', () => {
    const engine = playing();
    const enemy = target(engine);
    enemy.x = PLAYER_X + enemy.side * 92;
    enemy.attackUntil = 500;
    engine.typeKey(enemy.challenge.word.answer[0]);
    engine.typeKey(enemy.challenge.word.answer[1]);
    engine.step(180);
    expect(enemy.attackUntil).toBe(800);
    engine.step(610);
    expect(engine.snapshot().hp).toBe(100);
    engine.step(10);
    expect(engine.snapshot().hp).toBe(85);
  });

  it('holds a pending attack cooldown while stunned', () => {
    const engine = playing();
    const enemy = target(engine);
    enemy.x = PLAYER_X + enemy.side * 92;
    enemy.nextAttackAt = 500;
    engine.typeKey(enemy.challenge.word.answer[0]);
    engine.step(180);
    expect(enemy.nextAttackAt).toBe(800);
    engine.step(610);
    expect(enemy.attackUntil).toBe(0);
    engine.step(10);
    expect(enemy.attackUntil).toBe(1300);
    expect(engine.snapshot().hp).toBe(100);
  });

  it('refreshes stagger immediately on a later hit with no immune interval', () => {
    const engine = playing();
    const enemy = target(engine);
    engine.typeKey(enemy.challenge.word.answer[0]);
    engine.step(260);
    const originalEnd = enemy.stunUntil;
    engine.typeKey(enemy.challenge.word.answer[1]);
    engine.step(260);
    expect(enemy.stunUntil).toBeGreaterThan(originalEnd);
    expect(enemy.stunUntil - engine.clock).toBe(300);
    expect(enemy.immuneUntil).toBe(0);
    expect(engine.drainEvents().filter((event) => event.type === 'hit').map((event) => event.duration)).toEqual([300, 300]);
  });

  it('preserves the remaining attack telegraph when a zombie is frozen', () => {
    const engine = playing();
    const enemy = target(engine);
    enemy.x = PLAYER_X + enemy.side * 92;
    enemy.attackUntil = 500;
    engine.useItem('freeze');
    engine.step(3490);
    expect(engine.snapshot().hp).toBe(100);
    engine.step(10);
    expect(engine.snapshot().hp).toBe(85);
  });

  it('breaks armor once and gives its next layer a new challenge identity', () => {
    const engine = playing();
    const enemy = target(engine);
    enemy.kind = 'armored';
    enemy.hp = enemy.maxHp = 2;
    const oldId = enemy.challenge.id;
    solve(engine);
    engine.step(400);
    expect(enemy.hp).toBe(1);
    expect(enemy.challenge.id).not.toBe(oldId);
    expect(enemy.state).toBe('alive');
    engine.step(400);
    expect(enemy.hp).toBe(1);
  });

  it('does not allow a resolving zombie to hurt the player', () => {
    const engine = playing();
    const enemy = target(engine);
    enemy.x = PLAYER_X + enemy.side * 92;
    enemy.attackUntil = 1;
    solve(engine);
    engine.step(400);
    expect(engine.snapshot().hp).toBe(100);
  });

  it('runs three Tank phases, preserves Final Strike under damage boost, then continues survival', () => {
    const engine = playing('boss');
    const boss = target(engine);
    engine.useItem('damage');
    const observed = new Set([boss.bossPhase]);
    for (let attempts = 0; attempts < 9 && engine.enemies.includes(boss) && boss.hp > 1; attempts++) {
      solve(engine, boss);
      engine.step(400);
      observed.add(boss.bossPhase);
    }
    expect(boss.hp).toBe(1);
    expect(observed).toEqual(new Set([1, 2, 3]));
    expect(boss.challenge.kind).toBe('translate');
    expect(engine.snapshot().notice).toContain('FINAL STRIKE');
    solve(engine, boss);
    engine.step(400);
    expect(engine.snapshot().boss).toBeNull();
    expect(engine.snapshot().phase).toBe('playing');
    expect(engine.drainEvents().some((event) => event.type === 'boss-defeat')).toBe(true);
    engine.step(7000);
    expect(engine.enemies.length).toBeGreaterThan(0);
  });
});

describe('attack presentation events', () => {
  function contactEnemy(kind: 'normal' | 'runner' | 'armored' = 'normal') {
    const engine = playing();
    const enemy = target(engine);
    engine.enemies = [enemy];
    enemy.kind = kind;
    enemy.x = PLAYER_X - 92;
    enemy.speed = 0;
    enemy.attackUntil = 0;
    enemy.nextAttackAt = 0;
    return { engine, enemy };
  }

  it.each([['normal', 15], ['runner', 12], ['armored', 18]] as const)(
    'emits one %s impact at resolution with actual damage and directional hurt metadata', (kind, damage) => {
      const { engine, enemy } = contactEnemy(kind);
      const origin = enemy.x;
      engine.step(10);
      const windup = engine.drainEvents();
      expect(windup.find((event) => event.type === 'attack')).toMatchObject({
        enemyId: enemy.id, enemyKind: kind, x: origin, targetX: PLAYER_X, duration: 500,
      });
      expect(windup.some((event) => event.type === 'attack-impact')).toBe(false);
      engine.step(499);
      expect(engine.drainEvents().some((event) => event.type === 'attack-impact')).toBe(false);
      engine.step(1);
      const events = engine.drainEvents();
      expect(events.filter((event) => event.type === 'attack-impact')).toEqual([expect.objectContaining({
        enemyId: enemy.id, enemyKind: kind, x: origin, targetX: PLAYER_X, hit: true, damage,
      })]);
      expect(events.find((event) => event.type === 'player-hurt')).toMatchObject({
        enemyId: enemy.id, enemyKind: kind, sourceX: origin, x: PLAYER_X, damage,
      });
      expect(enemy.x).toBe(origin - 105); // Event origin is captured before knockback.
      expect(engine.snapshot().hp).toBe(100 - damage);
      engine.step(500);
      expect(engine.drainEvents().some((event) => event.type === 'attack-impact')).toBe(false);
    });

  it.each([[1, 1500, 12], [3, 1100, 16]] as const)(
    'emits phase %i Boss slam events for hits and misses using the existing range', (phase, duration, damage) => {
      for (const inside of [true, false]) {
        const engine = playing('boss');
        const boss = target(engine);
        boss.bossPhase = phase;
        boss.speed = 0;
        boss.x = PLAYER_X + BOSS_SLAM_RANGE + (inside ? 0 : 1);
        boss.nextAttackAt = 0;
        engine.step(10);
        const windup = engine.drainEvents().find((event) => event.type === 'attack');
        expect(windup).toMatchObject({ enemyId: boss.id, enemyKind: 'tank', bossPhase: phase,
          x: boss.x, targetX: PLAYER_X, radius: BOSS_SLAM_RANGE, duration });
        engine.step(duration - 1);
        expect(engine.drainEvents().some((event) => event.type === 'attack-impact')).toBe(false);
        engine.step(1);
        const events = engine.drainEvents();
        expect(events.filter((event) => event.type === 'attack-impact')).toEqual([expect.objectContaining({
          enemyId: boss.id, enemyKind: 'tank', x: boss.x, targetX: PLAYER_X,
          radius: BOSS_SLAM_RANGE, bossPhase: phase, hit: inside, damage: inside ? damage : 0,
        })]);
        expect(events.filter((event) => event.type === 'player-hurt')).toHaveLength(inside ? 1 : 0);
      }
    });

  it('captures the player position at impact after movement rather than reusing the windup target', () => {
    const engine = playing('boss');
    const boss = target(engine);
    boss.x = 1000;
    boss.speed = 0;
    boss.nextAttackAt = 0;
    engine.step(10);
    const windup = engine.drainEvents().find((event) => event.type === 'attack')!;
    engine.setMovement(1);
    engine.step(1500);
    const impact = engine.drainEvents().find((event) => event.type === 'attack-impact')!;
    expect(windup.targetX).toBe(640);
    expect(impact.targetX).toBe(engine.playerX);
    expect(impact.targetX).toBe(820);
    expect(impact.hit).toBe(true);
  });

  it('reports zero damage for an impact blocked by the existing player invulnerability', () => {
    const { engine, enemy } = contactEnemy();
    const other: Enemy = { ...enemy, id: 100, kind: 'runner', x: PLAYER_X + 92,
      challenge: createChallenge(WORDS[1], 'translate', 100) };
    engine.enemies.push(other);
    engine.step(510);
    const events = engine.drainEvents();
    const impacts = events.filter((event) => event.type === 'attack-impact');
    expect(impacts).toHaveLength(2);
    expect(impacts[0]).toMatchObject({ enemyId: enemy.id, hit: true, damage: 15 });
    expect(impacts[1]).toMatchObject({ enemyId: other.id, enemyKind: 'runner', hit: false, damage: 0 });
    expect(events.filter((event) => event.type === 'player-hurt')).toHaveLength(1);
  });

  it('reports only remaining HP as the damage of a lethal Boss slam', () => {
    const engine = playing('boss');
    const boss = target(engine);
    boss.speed = 0;
    boss.bossPhase = 3;
    boss.x = PLAYER_X + 250;
    for (let attack = 0; attack < 6; attack++) {
      boss.nextAttackAt = 0;
      boss.attackUntil = engine.clock + 10;
      engine.step(10);
      engine.step(650);
    }
    expect(engine.snapshot().hp).toBe(4);
    engine.drainEvents();
    boss.nextAttackAt = 0;
    boss.attackUntil = engine.clock + 10;
    engine.step(10);
    const events = engine.drainEvents();
    expect(events.find((event) => event.type === 'attack-impact')).toMatchObject({ hit: true, damage: 4 });
    expect(events.find((event) => event.type === 'player-hurt')).toMatchObject({ damage: 4,
      sourceX: boss.x, x: PLAYER_X, enemyId: boss.id, enemyKind: 'tank' });
    expect(engine.snapshot().phase).toBe('over');
  });

  it('does not emit another actor impact after a fatal contact attack ends the same tick', () => {
    const engine = playing('boss');
    const boss = target(engine);
    boss.speed = 0;
    boss.bossPhase = 3;
    boss.x = PLAYER_X + 250;
    for (let attack = 0; attack < 6; attack++) {
      boss.nextAttackAt = 0;
      boss.attackUntil = engine.clock + 10;
      engine.step(10);
      engine.step(650);
    }
    expect(engine.snapshot().hp).toBe(4);
    const normal: Enemy = { ...boss, id: 100, kind: 'normal', x: PLAYER_X - 92,
      attackUntil: engine.clock + 10, nextAttackAt: 0,
      challenge: createChallenge(WORDS[0], 'translate', 100) };
    boss.attackUntil = engine.clock + 10;
    boss.nextAttackAt = 0;
    engine.enemies = [normal, boss];
    engine.drainEvents();
    engine.step(10);
    const impacts = engine.drainEvents().filter((event) => event.type === 'attack-impact');
    expect(impacts).toHaveLength(1);
    expect(impacts[0]).toMatchObject({ enemyId: normal.id, enemyKind: 'normal', hit: true, damage: 4 });
  });

  it('does not emit an impact for a canceled contact attack after the player retreats', () => {
    const { engine } = contactEnemy();
    engine.step(10);
    engine.drainEvents();
    engine.setMovement(1);
    engine.step(1000);
    const events = engine.drainEvents();
    expect(events.some((event) => event.type === 'attack-impact' || event.type === 'player-hurt')).toBe(false);
  });

  it.each(['normal', 'tank'] as const)('does not emit a pending %s impact after the enemy is killed', (kind) => {
    const engine = playing(kind === 'tank' ? 'boss' : 'survival');
    const enemy = target(engine);
    engine.enemies = [enemy];
    enemy.hp = 1;
    enemy.speed = 0;
    enemy.x = PLAYER_X + (kind === 'tank' ? 250 : 92);
    enemy.nextAttackAt = 0;
    engine.step(10);
    engine.drainEvents();
    solve(engine, enemy);
    engine.step(1500);
    const events = engine.drainEvents();
    expect(events.some((event) => event.type === 'enemy-death' && event.enemyId === enemy.id)).toBe(true);
    expect(events.some((event) => event.type === 'attack-impact' && event.enemyId === enemy.id)).toBe(false);
    expect(events.some((event) => event.type === 'player-hurt')).toBe(false);
  });

  it('holds a frozen attack impact until the preserved telegraph actually finishes', () => {
    const { engine } = contactEnemy();
    engine.step(10);
    engine.drainEvents();
    engine.useItem('freeze');
    engine.step(3499);
    expect(engine.drainEvents().some((event) => event.type === 'attack-impact')).toBe(false);
    engine.step(1);
    expect(engine.drainEvents().filter((event) => event.type === 'attack-impact')).toHaveLength(1);
  });

  it('does not resolve impacts during pause/countdown or retain old attacks after restarting', () => {
    const { engine } = contactEnemy();
    engine.step(10);
    engine.drainEvents();
    engine.pause();
    engine.step(5000);
    expect(engine.drainEvents()).toHaveLength(0);
    engine.resume();
    engine.step(2000);
    expect(engine.drainEvents()).toHaveLength(0);
    engine.step(500);
    expect(engine.drainEvents().filter((event) => event.type === 'attack-impact')).toHaveLength(1);
    engine.start();
    engine.step(500);
    expect(engine.drainEvents().some((event) => event.type === 'attack-impact')).toBe(false);
  });
});

describe('Tank shielding and enemy roles', () => {
  function shieldedScene() {
    const engine = playing('boss');
    const tank = target(engine);
    tank.x = 950;
    tank.speed = 0;
    const behind: Enemy = { ...tank, id: 100, kind: 'normal', x: 1150, hp: 1, maxHp: 1,
      challenge: createChallenge(WORDS[0], 'translate', 100) };
    const front: Enemy = { ...behind, id: 101, x: 800, challenge: createChallenge(WORDS[1], 'translate', 101) };
    const otherSide: Enemy = { ...behind, id: 102, x: 160, side: -1,
      challenge: createChallenge(WORDS[2], 'translate', 102) };
    engine.enemies = [behind, tank, front, otherSide];
    return { engine, tank, behind, front, otherSide };
  }

  it('prevents auto selection, Tab and typing from targeting enemies behind the nearer Tank', () => {
    const { engine, tank, behind, front, otherSide } = shieldedScene();
    expect(canTargetEnemy(engine.enemies, behind)).toBe(false);
    expect(canTargetEnemy(engine.enemies, front)).toBe(true);
    expect(canTargetEnemy(engine.enemies, otherSide)).toBe(true);
    engine.targetId = null;
    engine.step(10);
    expect(engine.targetId).not.toBe(behind.id);
    for (let index = 0; index < 8; index++) {
      engine.cycleTarget();
      expect(engine.targetId).not.toBe(behind.id);
    }
    engine.targetId = behind.id;
    engine.typeKey(behind.challenge.word.answer[0]);
    expect(engine.targetId).toBe(tank.id);
    expect(behind.challenge.credited.size).toBe(0);
  });

  it('unblocks targets only after actual Tank death, while a resolving Tank still shields them', () => {
    const { engine, tank, behind } = shieldedScene();
    tank.hp = 1;
    solve(engine, tank);
    expect(tank.state).toBe('resolving');
    expect(canTargetEnemy(engine.enemies, behind)).toBe(false);
    engine.step(400);
    expect(engine.enemies).not.toContain(tank);
    expect(canTargetEnemy(engine.enemies, behind)).toBe(true);
    for (let index = 0; index < 6 && engine.targetId !== behind.id; index++) engine.cycleTarget();
    expect(engine.targetId).toBe(behind.id);
  });

  it('lets an inner Tank shield an outer Tank and uses the current player position', () => {
    const { engine, tank, behind } = shieldedScene();
    const outer: Enemy = { ...tank, id: 200, x: 1080,
      challenge: createChallenge(WORDS.find((word) => word.id === 'elephant')!, 'translate', 200) };
    engine.enemies.push(outer);
    expect(canTargetEnemy(engine.enemies, tank)).toBe(true);
    expect(canTargetEnemy(engine.enemies, outer)).toBe(false);
    expect(canTargetEnemy(engine.enemies, behind)).toBe(false);
    expect(canTargetEnemy(engine.enemies, behind, 1250)).toBe(true);
  });

  it('clears a newly shielded lock but lets already launched letters hit their original target', () => {
    const { engine, tank, behind } = shieldedScene();
    tank.x = 1250; // Initially behind the normal zombie, so the zombie is exposed.
    engine.targetId = behind.id;
    engine.typeKey(behind.challenge.word.answer[0]);
    expect(engine.snapshot().locked).toBe(true);
    const credited = behind.challenge.credited.size;
    tank.x = 950;
    engine.step(10);
    expect(engine.targetId).toBe(tank.id);
    expect(engine.snapshot().input).toBe('');
    expect(engine.snapshot().locked).toBe(false);
    expect(engine.snapshot().notice).toContain('che chắn');
    engine.step(400);
    expect(engine.drainEvents().some((event) => event.type === 'hit' && event.enemyId === behind.id)).toBe(true);
    expect(behind.challenge.credited.size).toBe(credited);
  });

  it('uses distinct long words in every Tank phase, including an unseen long Final Strike', () => {
    const engine = playing('boss');
    const boss = target(engine);
    const seen = new Set<string>();
    for (let step = 0; step < 8; step++) {
      expect(boss.challenge.word.answer.length).toBeGreaterThanOrEqual(7);
      seen.add(boss.challenge.word.answer);
      solve(engine, boss);
      engine.step(400);
    }
    expect(boss.hp).toBe(1);
    expect(boss.challenge.word.answer.length).toBeGreaterThanOrEqual(7);
    expect(seen.has(boss.challenge.word.answer)).toBe(false);
  });

  it('spawns Runner at 33px/s, 1.5 times its previous 22px/s speed', () => {
    let random = .13;
    const engine = new GameEngine(() => random);
    engine.start();
    solve(engine);
    engine.step(400);
    solve(engine);
    engine.step(400);
    random = .7;
    engine.step(1200);
    const runner = engine.enemies.find((enemy) => enemy.kind === 'runner');
    expect(runner?.speed).toBe(33);
    expect(ENEMY_SPEED.runner / 22).toBe(1.5);
  });
});

describe('player movement and local world spawning', () => {
  it('moves at 160px/s, stops on key release, and respects both long-world bounds', () => {
    const engine = playing();
    engine.enemies = [];
    engine.setMovement(1);
    engine.step(1000);
    expect(engine.playerX).toBeCloseTo(PLAYER_X + PLAYER_SPEED);
    engine.setMovement(0);
    engine.step(1000);
    expect(engine.playerX).toBeCloseTo(800);
    engine.playerX = WORLD_WIDTH - 250;
    engine.setMovement(1);
    engine.step(100);
    expect(engine.playerX).toBe(PLAYER_BOUNDS.max);
    engine.playerX = PLAYER_BOUNDS.min + 8;
    engine.setMovement(-1);
    engine.step(100);
    expect(engine.playerX).toBe(PLAYER_BOUNDS.min);
    expect(engine.snapshot().playerX).toBe(engine.playerX);
  });

  it.each(['normal', 'tank'] as const)('cannot walk through a live %s', (kind) => {
    const engine = playing(kind === 'tank' ? 'boss' : 'survival');
    const enemy = target(engine);
    engine.enemies = [enemy];
    enemy.x = 1000;
    enemy.speed = 0;
    enemy.nextAttackAt = 100_000;
    engine.setMovement(1);
    engine.step(3000);
    expect(engine.playerX).toBe(kind === 'tank' ? 820 : 908);
  });

  it.each(['normal', 'armored', 'tank'] as const)('keeps a resolving %s solid until its actual death', (kind) => {
    const engine = playing(kind === 'tank' ? 'boss' : 'survival');
    const enemy = target(engine);
    engine.enemies = [enemy];
    enemy.kind = kind;
    enemy.hp = enemy.maxHp = kind === 'tank' ? 9 : kind === 'armored' ? 2 : 1;
    enemy.speed = 0;
    enemy.nextAttackAt = 100_000;
    enemy.x = 1000;
    const contact = kind === 'tank' ? 180 : 92;
    engine.playerX = enemy.x - contact;
    const position = engine.playerX;
    solve(engine, enemy);
    expect(enemy.state).toBe('resolving');
    engine.setMovement(1);
    engine.step(100);
    expect(engine.playerX).toBe(position);
    engine.step(300);
    if (kind === 'normal') {
      expect(engine.enemies).not.toContain(enemy);
      expect(engine.playerX).toBeGreaterThan(position);
    } else {
      expect(enemy.hp).toBeGreaterThan(0);
      expect(engine.playerX).toBe(position);
    }
  });

  it('cannot gradually walk through a Tank while completing successive armor layers', () => {
    const engine = playing('boss');
    const boss = target(engine);
    boss.x = 1000;
    boss.speed = 0;
    boss.nextAttackAt = 100_000;
    engine.playerX = 820;
    engine.setMovement(1);
    for (let layer = 0; layer < 7; layer++) {
      solve(engine, boss);
      engine.step(400);
      expect(engine.playerX).toBe(820);
      expect(boss.x - engine.playerX).toBe(180);
    }
  });

  it('clears movement when paused and on menu/start transitions', () => {
    const engine = playing();
    engine.enemies = [];
    engine.setMovement(1);
    engine.step(100);
    const position = engine.playerX;
    engine.pause();
    engine.step(1000);
    expect(engine.playerX).toBe(position);
    engine.resume();
    engine.step(2500);
    expect(engine.playerX).toBe(position);
    engine.toMenu();
    engine.setMovement(1);
    engine.step(1000);
    expect(engine.playerX).toBe(position);
    engine.start();
    expect(engine.playerX).toBe(PLAYER_X);
    engine.step(100);
    expect(engine.playerX).toBe(PLAYER_X);
  });

  it('cancels a normal attack when the player retreats beyond its contact margin', () => {
    const engine = playing();
    const enemy = target(engine);
    engine.enemies = [enemy];
    enemy.x = PLAYER_X - 92;
    enemy.attackUntil = 500;
    engine.setMovement(1);
    engine.step(1000);
    expect(enemy.attackUntil).toBe(0);
    expect(engine.snapshot().hp).toBe(100);
  });

  it('approaches the current player position rather than the original spawn side', () => {
    const engine = playing();
    const enemy = target(engine);
    engine.enemies = [enemy];
    enemy.side = -1;
    enemy.x = 1000;
    engine.step(1000);
    expect(enemy.x).toBeCloseTo(986);
    engine.playerX = 1200;
    engine.step(1000);
    expect(enemy.x).toBeCloseTo(1000);
  });

  it('spawns both flanks near the player after traveling to another part of the world', () => {
    const engine = playing();
    engine.enemies = [];
    engine.playerX = 3500;
    engine.step(6500);
    expect(engine.enemies).toHaveLength(1);
    expect(Math.abs(engine.enemies[0].x - engine.playerX)).toBeCloseTo(720);
    engine.step(6500);
    expect(engine.enemies.some((enemy) => enemy.x < engine.playerX)).toBe(true);
    expect(engine.enemies.some((enemy) => enemy.x > engine.playerX)).toBe(true);
    expect(engine.enemies.every((enemy) => Math.abs(enemy.x - engine.playerX) <= 720)).toBe(true);
  });

  it('only takes Tank slam damage inside its 300px telegraphed range', () => {
    const engine = playing('boss');
    const boss = target(engine);
    boss.speed = 0;
    boss.x = PLAYER_X + 400;
    boss.nextAttackAt = 0;
    boss.attackUntil = 100;
    engine.step(100);
    expect(engine.snapshot().hp).toBe(100);
    boss.x = PLAYER_X + 250;
    boss.nextAttackAt = 0;
    boss.attackUntil = engine.clock + 100;
    engine.step(100);
    expect(engine.snapshot().hp).toBe(88);
  });

  it('recycles a distant offscreen nonboss without losing its word, damage or awarding loot', () => {
    const engine = playing();
    const enemy = target(engine);
    engine.enemies = [enemy];
    enemy.kind = 'armored';
    enemy.hp = 1;
    enemy.maxHp = 2;
    enemy.speed = 0;
    enemy.x = 1000;
    engine.playerX = 4000;
    const challenge = enemy.challenge;
    const inventory = engine.snapshot().inventory;
    engine.step(10);
    expect(enemy.x).toBe(3240);
    expect(enemy.challenge).toBe(challenge);
    expect(enemy.hp).toBe(1);
    expect(engine.snapshot().inventory).toEqual(inventory);
    expect(engine.snapshot().kills).toBe(0);
    expect(engine.drainEvents().some((event) => ['enemy-death', 'pickup'].includes(event.type))).toBe(false);
  });

  it('does not recycle a locked target or a target with a projectile still in flight', () => {
    const engine = playing();
    const enemy = target(engine);
    enemy.speed = 0;
    engine.enemies = [enemy];
    engine.typeKey(enemy.challenge.word.answer[0]);
    engine.typeKey('Backspace');
    engine.playerX = 4000;
    const previous = enemy.x;
    engine.step(10);
    expect(enemy.x).toBe(previous); // Outstanding projectile, despite an empty input.
    engine.typeKey(enemy.challenge.word.answer[0]); // Retype locks without another effective hit.
    engine.step(400);
    expect(enemy.x).toBe(previous); // Projectile is resolved but the target remains locked.
    engine.typeKey('Backspace');
    engine.step(10);
    expect(enemy.x).toBe(3240);
    expect(enemy.challenge.credited.size).toBe(1);
  });

  it('never recycles a distant Tank and never moves a visible nonboss', () => {
    const engine = playing('boss');
    const boss = target(engine);
    boss.speed = 0;
    boss.x = 1000;
    engine.playerX = 4000;
    engine.step(10);
    expect(boss.x).toBe(1000);
    const normal: Enemy = { ...boss, id: 200, kind: 'normal', x: 4500, hp: 1, maxHp: 1,
      challenge: createChallenge(WORDS[0], 'translate', 200) };
    engine.enemies = [normal];
    engine.targetId = null;
    engine.step(10);
    expect(normal.x).toBe(4500);
  });

  it('keeps recycled enemies beyond the camera edge when the player is near a world boundary', () => {
    const engine = playing();
    const enemy = target(engine);
    engine.enemies = [enemy];
    enemy.speed = 0;
    enemy.x = 3000;
    engine.playerX = 240;
    engine.step(10);
    expect(enemy.x).toBeGreaterThanOrEqual(1280 + 60);
    expect(enemy.x).toBeLessThanOrEqual(WORLD_WIDTH + 60);
  });
});

describe('simulation, supplies, and game over', () => {
  it('freezes every gameplay timer while paused and during the resume countdown', () => {
    const engine = playing();
    engine.typeKey('z');
    engine.useItem('freeze');
    engine.pause();
    const before = engine.snapshot();
    const positions = engine.enemies.map((enemy) => enemy.x);
    engine.step(5000);
    expect(engine.clock).toBe(0);
    expect(engine.snapshot().jamRemaining).toBe(before.jamRemaining);
    engine.resume();
    engine.step(1999);
    expect(engine.snapshot().phase).toBe('countdown');
    expect(engine.enemies.map((enemy) => enemy.x)).toEqual(positions);
    engine.pause();
    engine.step(5000);
    expect(engine.snapshot().phase).toBe('paused');
    expect(engine.clock).toBe(0);
    engine.resume();
    engine.step(1999);
    engine.step(1);
    expect(engine.snapshot().phase).toBe('playing');
    expect(engine.clock).toBe(0);
    engine.step(10);
    expect(engine.clock).toBe(10);
  });

  it('marks hint assistance and does not waste health at full HP', () => {
    const engine = playing();
    engine.useItem('health');
    expect(engine.snapshot().inventory.health).toBe(1);
    engine.useItem('shield');
    expect(engine.snapshot().inventory.shield).toBe(0);
    expect(target(engine).challenge.assisted).toBe(true);
    expect(engine.snapshot().target?.hint).not.toBe('');
    expect(engine.drainEvents().some((event) => event.type === 'pickup')).toBe(false);
  });

  it('excludes refreshed learning history from later runs without recreating the engine', () => {
    const engine = new GameEngine(() => 0);
    engine.start();
    expect(engine.enemies[0].challenge.word.answer).toBe('apple');
    engine.setProgress({ highScore: 200, runs: 1, totalWords: 1, words: {
      doctor: { word: 'doctor', meaning: 'Bác sĩ', encounters: 1, completed: 0, mistakes: 1,
        assisted: 0, totalResponseMs: 0, lastSeen: 100, nextReview: 100 },
    } });
    engine.start();
    expect(engine.enemies.every((enemy) => !['apple', 'bread', 'doctor'].includes(enemy.challenge.word.answer))).toBe(true);
  });

  it('limits concurrent labels and produces real run statistics on death', () => {
    const engine = playing();
    let peak = 0;
    for (let index = 0; index < 6000 && engine.snapshot().phase === 'playing'; index++) {
      engine.step(50);
      peak = Math.max(peak, engine.enemies.length);
      expect(engine.enemies.filter((enemy) => enemy.side === -1).length).toBeLessThanOrEqual(3);
      expect(engine.enemies.filter((enemy) => enemy.side === 1).length).toBeLessThanOrEqual(3);
    }
    expect(peak).toBeLessThanOrEqual(6);
    const result = engine.snapshot();
    expect(result.phase).toBe('over');
    expect(result.hp).toBe(0);
    expect(result.summary?.durationMs).toBeGreaterThan(0);
    expect(result.summary?.words).toBe(0);
    expect(result.summary?.results.length).toBeGreaterThan(0);
  });

  it('reports accuracy as a percentage of accepted correct and incorrect letter attempts', () => {
    const engine = playing();
    const length = target(engine).challenge.word.answer.length;
    engine.typeKey('z');
    engine.typeKey('z'); // Ignored during the jam, so it is not a second mistake.
    engine.step(JAM_MS);
    solve(engine);
    engine.step(180_000);
    expect(engine.snapshot().summary?.accuracy).toBeCloseTo(length / (length + 1) * 100);
    expect(engine.snapshot().summary?.words).toBe(1);
  });
});

describe('strict nonrepeating vocabulary', () => {
  it('supports an injected 70,000-word bank with cached snapshots and exact persisted exhaustion', () => {
    const letters = (number: number) => {
      let encoded = '';
      do { encoded = String.fromCharCode(97 + number % 26) + encoded; number = Math.floor(number / 26); } while (number);
      return encoded;
    };
    const entries: Word[] = Array.from({ length: 70_000 }, (_, index) => ({
      id: `entry-${index}`, answer: `testing${letters(index)}`, meaning: `Mục thử ${index}`,
      category: 'Test only', partOfSpeech: 'noun', difficulty: 2,
    }));
    let bankReads = 0;
    const bank = new Proxy(entries, { get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) bankReads++;
      return Reflect.get(target, key, receiver);
    } });
    const progress: Progress = { highScore: 0, runs: 0, totalWords: 0, words: {},
      seenWords: Object.fromEntries(entries.slice(0, -2).map((word) => [word.answer, 1])) };
    const shown: string[] = [];
    const engine = new GameEngine(() => .99, progress, (word) => shown.push(word.answer), bank);
    expect(engine.snapshot().vocabulary).toEqual({ remaining: 2, total: 70_000, bossReady: false });
    engine.setProgress(progress);
    engine.start();
    bankReads = 0;
    for (let count = 0; count < 1000; count++) {
      expect(engine.snapshot().vocabulary).toEqual({ remaining: 0, total: 70_000, bossReady: false });
    }
    expect(bankReads).toBe(0);
    expect(shown).toHaveLength(2);
    expect(new Set(shown).size).toBe(2);
    solve(engine);
    engine.step(400);
    solve(engine);
    engine.step(400);
    expect(engine.snapshot().summary).toMatchObject({ reason: 'vocabulary-complete', words: 2, kills: 2 });
    expect(bankReads).toBe(0);
  });

  it.each([undefined, 'https://example.org/dictionary/apple'])('shows translation hints independently of source link %s', sourceUrl => {
    const imported: Word = { ...WORDS[0], sourceUrl };
    const engine = new GameEngine(() => 0, undefined, undefined, [imported, WORDS[1]]);
    engine.start();
    const selected = target(engine);
    selected.challenge.kind = 'translate';
    expect(engine.snapshot().target?.hint).toBe(selected.challenge.hint);
    const authored = new GameEngine(() => 0, undefined, undefined, [WORDS[0], WORDS[1]]);
    authored.start();
    target(authored).challenge.kind = 'translate';
    expect(authored.snapshot().target?.hint).toBe(target(authored).challenge.hint);
  });

  it('keeps distinguishing translation letters for ambiguous CSV words without source URLs', () => {
    const { words } = parseDictionary({ version: 1,
      source: { name: 'User CSV', kind: 'local-csv', localFile: 'Dic/English - Vietnamese.csv',
        license: 'Not specified by source', snapshot: 'local' },
      words: ['adviser', 'advisor'].map(answer => ({ id: `csv-${answer}`, answer,
        meaning: 'Người cố vấn', category: 'Danh từ', partOfSpeech: 'noun', difficulty: 2 })) });
    const engine = new GameEngine(() => 0, undefined, undefined, words);
    engine.start();
    const hints: string[] = [];
    for (const enemy of engine.enemies) {
      enemy.challenge = createChallenge(enemy.challenge.word, 'translate', enemy.challenge.id);
      engine.targetId = enemy.id;
      expect(enemy.challenge.word.sourceUrl).toBeUndefined();
      const hint = engine.snapshot().target!.hint;
      expect(hint).toBe(enemy.challenge.word.translationHint);
      expect(hint).toMatch(/^a _ _ _ _ [eo] r$/);
      hints.push(hint);
    }
    expect(new Set(hints).size).toBe(2);
  });

  it('reports remaining unseen entries including unshown reservations and next-run Boss readiness', () => {
    const longWords = WORDS.filter((word) => word.answer.length >= 7).slice(0, 9).map((word) => word.answer);
    const engine = new GameEngine(() => 0, progressWithOnlyUnseen([...longWords, 'cat']));
    expect(engine.snapshot().vocabulary).toEqual({ total: WORDS.length, remaining: 10, bossReady: true });
    engine.start('boss');
    expect(engine.snapshot().vocabulary).toEqual({ total: WORDS.length, remaining: 9, bossReady: false });
    engine.toMenu();
    expect(engine.snapshot().vocabulary.remaining).toBe(9);
    expect(engine.snapshot().vocabulary.bossReady).toBe(false);
  });

  it('never injects a weak historical word or repeats any shown answer, even through an entire biased-RNG run', () => {
    const exposed: string[] = [];
    const progress: Progress = { highScore: 0, runs: 1, totalWords: 1, words: {
      water: { word: 'water', meaning: 'Nước uống', encounters: 99, completed: 1, mistakes: 999,
        assisted: 0, totalResponseMs: 0, lastSeen: 1, nextReview: 0 },
    } };
    const engine = new GameEngine(() => .13, progress, (word) => exposed.push(word.answer));
    engine.start();
    for (let iteration = 0; iteration < WORDS.length * 5 && engine.snapshot().phase === 'playing'; iteration++) {
      for (const enemy of engine.enemies) { enemy.speed = 0; enemy.nextAttackAt = 1e9; }
      const selected = engine.enemies.find((enemy) => enemy.id === engine.targetId && enemy.state === 'alive');
      if (selected) { solve(engine, selected); engine.step(400); }
      else engine.step(1200);
    }
    expect(engine.snapshot().phase).toBe('over');
    expect(engine.snapshot().summary?.reason).toBe('vocabulary-complete');
    expect(exposed).not.toContain('water');
    expect(new Set(exposed).size).toBe(exposed.length);
    expect(exposed).toHaveLength(WORDS.length - 1);
    expect(engine.snapshot().summary?.results.every((result) => result.encounters === 1)).toBe(true);
  });

  it('keeps abandoned and unfinished shown words excluded across restarts and loads normalized seen history', () => {
    const exposed: string[] = [];
    const engine = new GameEngine(() => 0, { ...progressWithOnlyUnseen(WORDS.map((word) => word.answer)),
      seenWords: { ' WATER ': 10 } }, (word) => exposed.push(word.answer));
    engine.start();
    const first = engine.enemies.map((enemy) => enemy.challenge.word.answer);
    engine.typeKey(target(engine).challenge.word.answer[0]);
    engine.toMenu();
    engine.start();
    expect(engine.enemies.every((enemy) => !first.includes(enemy.challenge.word.answer))).toBe(true);
    expect(exposed).not.toContain('water');
    expect(new Set(exposed).size).toBe(exposed.length);
  });

  it('marks only visible challenges and releases unseen reserved Tank words on a new run', () => {
    const longWords = WORDS.filter((word) => word.answer.length >= 7).slice(0, 9);
    const exposed: string[] = [];
    const engine = new GameEngine(() => 0, progressWithOnlyUnseen(longWords.map((word) => word.answer)),
      (word) => exposed.push(word.answer));
    engine.start('boss');
    expect(exposed).toHaveLength(1);
    expect(engine.snapshot().boss).not.toBeNull();
    const abandoned = exposed[0];
    engine.start();
    expect(engine.enemies).toHaveLength(2);
    expect(exposed).toHaveLength(3);
    expect(exposed.filter((word) => word === abandoned)).toHaveLength(1);
    expect(new Set(exposed).size).toBe(3);
  });

  it('reserves enough unique Tank layers so other spawns cannot steal its new Final Strike', () => {
    const longWords = WORDS.filter((word) => word.answer.length >= 7).slice(0, 9);
    const exposed: string[] = [];
    const engine = new GameEngine(() => .99,
      progressWithOnlyUnseen([...longWords.map((word) => word.answer), 'cat']), (word) => exposed.push(word.answer));
    engine.start('boss');
    const boss = target(engine);
    boss.speed = 0;
    boss.nextAttackAt = 1e9;
    engine.step(6500);
    expect(engine.enemies.find((enemy) => enemy.kind !== 'tank')?.challenge.word.answer).toBe('cat');
    const tankWords = new Set<string>();
    for (let phase = 0; phase < 9; phase++) {
      expect(boss.challenge.word.answer.length).toBeGreaterThanOrEqual(7);
      expect(tankWords.has(boss.challenge.word.answer)).toBe(false);
      tankWords.add(boss.challenge.word.answer);
      solve(engine, boss);
      engine.step(400);
    }
    expect(engine.snapshot().boss).toBeNull();
    expect(tankWords.size).toBe(9);
    expect(new Set(exposed).size).toBe(exposed.length);
  });

  it('refuses Tank when fewer than nine new long words remain without awarding a fake Boss kill', () => {
    const remaining = WORDS.filter((word) => word.answer.length >= 7).slice(0, 8).map((word) => word.answer);
    const engine = new GameEngine(() => .99, progressWithOnlyUnseen(remaining));
    engine.start('boss');
    expect(engine.snapshot().boss).toBeNull();
    expect(engine.enemies.every((enemy) => enemy.kind === 'normal')).toBe(true);
    expect(engine.snapshot().kills).toBe(0);
    expect(engine.snapshot().score).toBe(0);
    expect(engine.drainEvents().some((event) => ['boss-defeat', 'enemy-death', 'pickup'].includes(event.type))).toBe(false);
  });

  it('falls back from Armored to Normal when only one unallocated word remains', () => {
    const engine = new GameEngine(() => .99, progressWithOnlyUnseen(['apple', 'bread', 'water', 'milk', 'rice']));
    engine.start();
    for (let count = 0; count < 4; count++) {
      if (!engine.targetId) engine.step(1200);
      solve(engine);
      engine.step(400);
    }
    if (!engine.targetId) engine.step(1200);
    expect(engine.enemies).toHaveLength(1);
    expect(target(engine).kind).toBe('normal');
    expect(target(engine).maxHp).toBe(1);
  });

  it('waits for the final projectile, then completes an exhausted bank once without death or phantom rewards', () => {
    const engine = new GameEngine(() => .99, progressWithOnlyUnseen(['apple']));
    engine.start();
    expect(engine.enemies).toHaveLength(1);
    solve(engine);
    engine.step(250);
    expect(engine.snapshot().phase).toBe('playing');
    engine.step(10);
    expect(engine.snapshot().phase).toBe('over');
    expect(engine.snapshot().hp).toBe(100);
    expect(engine.snapshot().summary).toMatchObject({ reason: 'vocabulary-complete', kills: 1, words: 1, bossKills: 0 });
    const events = engine.drainEvents();
    expect(events.filter((event) => event.type === 'vocabulary-complete')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'enemy-death')).toHaveLength(1);
    expect(events.some((event) => event.type === 'game-over' || event.type === 'pickup')).toBe(false);
    engine.step(5000);
    expect(engine.drainEvents()).toHaveLength(0);
    engine.start();
    expect(engine.snapshot().summary).toMatchObject({ reason: 'vocabulary-complete', kills: 0, words: 0 });
  });

  it('retires an invalidated multilayer actor without falsely killing or dropping loot', () => {
    const engine = new GameEngine(() => .99, progressWithOnlyUnseen(['apple']));
    engine.start();
    const enemy = target(engine);
    enemy.kind = 'tank';
    enemy.hp = enemy.maxHp = 9;
    const inventory = engine.snapshot().inventory;
    solve(engine, enemy);
    engine.step(400);
    expect(engine.snapshot().summary).toMatchObject({ reason: 'vocabulary-complete', kills: 0, bossKills: 0 });
    expect(engine.snapshot().inventory).toEqual(inventory);
    expect(engine.drainEvents().some((event) => ['enemy-death', 'boss-defeat', 'pickup'].includes(event.type))).toBe(false);
  });

  it('clears old pending callbacks on restart while retaining their already shown answers', () => {
    const engine = new GameEngine(() => 0);
    engine.start();
    const old = target(engine).challenge.word.answer;
    solve(engine);
    engine.start();
    expect(engine.enemies.every((enemy) => enemy.challenge.word.answer !== old)).toBe(true);
    engine.step(400);
    expect(engine.snapshot().kills).toBe(0);
    expect(engine.drainEvents().some((event) => event.type === 'hit' || event.type === 'enemy-death')).toBe(false);
  });
});

describe('kill-based loot', () => {
  it.each([1, 2, 3] as WordDifficulty[])('uses the exact probability boundary for difficulty %i', (difficulty) => {
    const chance = lootChanceFor({ ...WORDS[0], difficulty });
    for (const [roll, drops] of [[chance - .000001, 1], [chance, 0]] as const) {
      let random = .99;
      const engine = new GameEngine(() => random);
      engine.start();
      const enemy = target(engine);
      enemy.challenge.word = { ...enemy.challenge.word, difficulty };
      const originalInventory = engine.snapshot().inventory;
      solve(engine);
      expect(engine.snapshot().inventory).toEqual(originalInventory);
      expect(engine.snapshot().kills).toBe(0);
      random = roll;
      engine.step(400);
      const pickups = engine.drainEvents().filter((event) => event.type === 'pickup');
      expect(pickups).toHaveLength(drops);
      if (drops) {
        expect(pickups[0].enemyId).toBe(enemy.id);
        expect(pickups[0].x).toBe(enemy.x);
        expect(pickups[0].item).toBeDefined();
        expect(engine.snapshot().inventory[pickups[0].item!]).toBe(originalInventory[pickups[0].item!] + 1);
      }
      engine.step(400);
      expect(engine.drainEvents().some((event) => event.type === 'pickup')).toBe(false);
    }
  });

  it('does not roll a drop on an armor break or on partial letters', () => {
    const engine = new GameEngine(() => 0);
    engine.start();
    const enemy = target(engine);
    enemy.kind = 'armored';
    enemy.hp = enemy.maxHp = 2;
    const originalInventory = engine.snapshot().inventory;
    engine.typeKey(enemy.challenge.word.answer[0]);
    engine.step(400);
    expect(engine.snapshot().inventory).toEqual(originalInventory);
    solve(engine, enemy);
    engine.step(400);
    expect(enemy.hp).toBe(1);
    expect(engine.snapshot().kills).toBe(0);
    expect(engine.snapshot().inventory).toEqual(originalInventory);
    expect(engine.drainEvents().some((event) => event.type === 'pickup')).toBe(false);
  });

  it('uses the same chance for Tank and keeps fixed score/HP rewards without guaranteed inventory', () => {
    let random = .99;
    const engine = new GameEngine(() => random);
    engine.start('boss');
    const boss = target(engine);
    boss.hp = 1;
    const before = engine.snapshot().inventory;
    solve(engine, boss);
    random = .99;
    engine.step(400);
    expect(engine.snapshot().inventory).toEqual(before);
    expect(engine.snapshot().score).toBeGreaterThanOrEqual(1000);
    expect(engine.drainEvents().some((event) => event.type === 'pickup')).toBe(false);

    engine.start('boss');
    const next = target(engine);
    next.hp = 1;
    solve(engine, next);
    random = 0;
    engine.step(400);
    expect(engine.drainEvents().filter((event) => event.type === 'pickup')).toHaveLength(1);
    expect(Object.values(engine.snapshot().inventory).reduce((total, amount) => total + amount, 0)).toBe(5);
  });

  it('chooses only items below the cap and never emits a false pickup when all are full', () => {
    const engine = new GameEngine(() => 0);
    engine.start();
    const template = target(engine);
    // Feed real one-word kills while keeping this test independent of spawn timing.
    for (let kill = 0; kill < 17; kill++) {
      const enemy: Enemy = { ...template, id: 1000 + kill, hp: 1, maxHp: 1, state: 'alive',
        x: 200, stunUntil: 0, immuneUntil: 0, attackUntil: 0,
        challenge: createChallenge(WORDS[kill % WORDS.length], 'translate', 1000 + kill, () => 0) };
      engine.enemies = [enemy];
      engine.targetId = enemy.id;
      engine.drainEvents();
      solve(engine, enemy);
      engine.step(400);
      const pickup = engine.drainEvents().filter((event) => event.type === 'pickup');
      expect(pickup).toHaveLength(kill < 16 ? 1 : 0);
      expect(Object.values(engine.snapshot().inventory).every((count) => count <= 5)).toBe(true);
    }
    expect(engine.snapshot().inventory).toEqual({ health: 5, freeze: 5, damage: 5, shield: 5 });
    expect(engine.snapshot().kills).toBe(17);
  });

  it('increases loot chance monotonically with authored word difficulty', () => {
    const chances = ([1, 2, 3] as WordDifficulty[]).map((difficulty) => lootChanceFor({ ...WORDS[0], difficulty }));
    expect(chances).toEqual([.15, .30, .45]);
    expect(chances[0]).toBeLessThan(chances[1]);
    expect(chances[1]).toBeLessThan(chances[2]);
  });
});

describe('local progress persistence', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

  function sampleRun(id = 'test-run'): RunSummary {
    return { id, endedAt: 100_000, score: 250, kills: 1, words: 1, bestCombo: 1,
      durationMs: 60_000, accuracy: 90, wpm: 10, bossKills: 0,
      results: [{ word: 'apple', meaning: 'Quả táo', encounters: 1, completed: 1,
        mistakes: 1, assisted: 0, totalResponseMs: 4200 }] };
  }

  function localFallback() {
    const values = new Map<string, string>();
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    return values;
  }

  it('uses a persistent fallback, reports it, deduplicates saves and merges review history', async () => {
    const values = localFallback();
    vi.resetModules();
    let storage = await import('./storage');
    const first = await storage.saveRun(sampleRun());
    expect(first.highScore).toBe(250);
    expect(first.runs).toBe(1);
    expect(first.words.apple.nextReview).toBe(700_000);
    expect(storage.getStorageWarning()).toContain('dự phòng');
    expect((await storage.saveRun(sampleRun())).runs).toBe(1);
    expect(values.size).toBe(1);
    // Reimport models a page reload; the fallback must retain real counters.
    vi.resetModules();
    storage = await import('./storage');
    expect((await storage.loadProgress()).words.apple.mistakes).toBe(1);
    await Promise.all([storage.saveRun(sampleRun('second')), storage.saveRun(sampleRun('third'))]);
    const all = await storage.loadProgress();
    expect(all.runs).toBe(3);
    expect(all.words.apple.completed).toBe(3);
  });

  it('keeps gameplay results in memory and warns if both storage mechanisms are denied', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); },
    });
    vi.resetModules();
    const storage = await import('./storage');
    await storage.saveRun(sampleRun());
    expect(storage.getStorageWarning()).toContain('đóng trang');
    expect((await storage.loadProgress()).runs).toBe(1);
  });

  it('schedules an unfinished repeated encounter for early review even when the first was clean', async () => {
    localFallback();
    vi.resetModules();
    const storage = await import('./storage');
    const run = sampleRun();
    run.results[0] = { ...run.results[0], encounters: 2, completed: 1, mistakes: 0 };
    const progress = await storage.saveRun(run);
    expect(progress.words.apple.encounters).toBe(2);
    expect(progress.words.apple.nextReview).toBe(run.endedAt + 10 * 60_000);
  });

  it('times out an IndexedDB open request that never completes instead of hanging the menu', async () => {
    localFallback();
    vi.useFakeTimers();
    vi.stubGlobal('indexedDB', { open: () => ({}) });
    vi.resetModules();
    const storage = await import('./storage');
    const loaded = storage.loadProgress();
    await vi.advanceTimersByTimeAsync(2001);
    expect((await loaded).runs).toBe(0);
    expect(storage.getStorageWarning()).toContain('dự phòng');
  });

  it('rejects malformed fallback data without crashing', async () => {
    const values = localFallback();
    values.set('zvs-progress-v1', '{invalid');
    vi.resetModules();
    const storage = await import('./storage');
    expect((await storage.loadProgress()).runs).toBe(0);
    expect(storage.getStorageWarning()).toContain('Không đọc');
  });
});

describe('curated vocabulary', () => {
  it('has unique, valid single-word answers and generates solvable prompts in every mode', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(240);
    expect(new Set(WORDS.map((word) => word.answer)).size).toBe(WORDS.length);
    for (const word of WORDS) {
      expect(word.answer).toMatch(/^[a-z]+$/);
      expect([1, 2, 3]).toContain(word.difficulty);
      expect(PART_OF_SPEECH_LABELS[word.partOfSpeech]).toBeTruthy();
      if (word.category === 'Màu sắc') expect(word.partOfSpeech).toBe('adjective');
      if (word.category === 'Động từ') expect(word.partOfSpeech).toBe('verb');
      for (const kind of ['scramble', 'missing', 'translate', 'hint'] as const) {
        const challenge = createChallenge(word, kind, 1, () => .5);
        expect(challenge.prompt.length).toBeGreaterThan(0);
        if (kind === 'scramble') {
          expect(challenge.prompt.replaceAll(' / ', '').split('').sort()).toEqual(word.answer.split('').sort());
          expect(challenge.prompt.replaceAll(' / ', '')).not.toBe(word.answer);
        }
        if (kind === 'hint') expect(challenge.hint.split(' ')).toHaveLength(word.answer.length);
      }
    }
  });

  it('exposes the same meaning and grammatical metadata in the selected target snapshot', () => {
    const engine = playing();
    const word = target(engine).challenge.word;
    expect(engine.snapshot().target).toMatchObject({ meaning: word.meaning,
      partOfSpeech: word.partOfSpeech, difficulty: word.difficulty });
  });
});
