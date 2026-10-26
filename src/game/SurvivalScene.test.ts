import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { animationDuration, SPRITE_BY_KEY } from './assets';
import { AttackEffects } from './attackEffects';
import { attackAnticipationFrame, attackContactFrame, characterHitPoint, projectileOrigin, rangedShotTiming } from './characterAnimation';
import { ENEMY_CHARACTERS, HERO_CHARACTERS, getHeroCharacter, type CharacterDefinition } from './characterCatalog';
import { GameEngine } from './engine';
import { getHeroSkill, HERO_SKILLS } from './heroSkills';
import { createChallenge, WORDS } from './vocabulary';
import type { Enemy, Snapshot } from './types';

vi.mock('phaser', () => ({ default: {
  Scene: class {},
  Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)), Linear: (a: number, b: number, t: number) => a + (b - a) * t },
} }));

import { SurvivalScene } from './SurvivalScene';

/** Only Phaser's drawing boundary is replaced; Scene action selection and timing run unchanged. */
class DrawNode {
  x = 0; y = 0; angle = 0; scaleX = 1; scaleY = 1; originX = 0.5; originY = 0.5;
  alpha = 1; tint = 0xffffff; flipX = false; visible = true; destroyed = false;
  width = 0; height = 0; text = ''; texture = { key: '' }; frame = { name: '0' };
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  setX(x: number): this { this.x = x; return this; }
  setDepth(): this { return this; }
  setOrigin(x: number, y = x): this { this.originX = x; this.originY = y; return this; }
  setScale(x: number, y = x): this { this.scaleX = x; this.scaleY = y; return this; }
  setDisplaySize(width: number, height: number): this { this.width = width; this.height = height; return this; }
  setFlipX(flip: boolean): this { this.flipX = flip; return this; }
  setAlpha(alpha: number): this { this.alpha = alpha; return this; }
  setAngle(angle: number): this { this.angle = angle; return this; }
  setTint(tint: number): this { this.tint = tint; return this; }
  clearTint(): this { return this.setTint(0xffffff); }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  setTexture(key: string, frame = 0): this { this.texture.key = key; return this.setFrame(frame); }
  setFrame(frame: number): this { this.frame.name = String(frame); return this; }
  setText(text: string): this { this.text = text; return this; }
  setFontSize(): this { return this; }
  setStrokeStyle(): this { return this; }
  setColor(): this { return this; }
  add(): this { return this; }
  clear(): this { return this; }
  lineStyle(): this { return this; }
  fillStyle(): this { return this; }
  beginPath(): this { return this; }
  closePath(): this { return this; }
  moveTo(): this { return this; }
  lineTo(): this { return this; }
  lineBetween(): this { return this; }
  fillTriangle(): this { return this; }
  fillRect(): this { return this; }
  fillEllipse(): this { return this; }
  strokeEllipse(): this { return this; }
  fillPath(): this { return this; }
  strokePath(): this { return this; }
  destroy(): void { this.destroyed = true; }
}

const sprite = (x = 0, y = 0, key = '', frame = 0) => new DrawNode().setPosition(x, y).setTexture(key, frame);

function harness(heroId = 'soldier') {
  const engine = new GameEngine(() => 0.5);
  const scene = new SurvivalScene(engine, () => undefined, { reducedMotion: true, muted: true, heroId });
  const world = new DrawNode();
  Object.assign(scene, { add: {
    sprite, text: (x: number, y: number, text: string) => sprite(x, y).setText(text),
    ellipse: sprite, rectangle: sprite, container: sprite, graphics: () => new DrawNode(),
  } });
  scene['world'] = world as unknown as Phaser.GameObjects.Container;
  scene['hero'] = sprite(640, 490) as unknown as Phaser.GameObjects.Sprite;
  scene['heroShadow'] = sprite() as unknown as Phaser.GameObjects.Ellipse;
  scene['jamLight'] = sprite() as unknown as Phaser.GameObjects.Arc;
  for (const key of ['lines', 'reticle', 'shields', 'hazards', 'bulletFx', 'impactFx'] as const) scene[key] = new DrawNode() as unknown as Phaser.GameObjects.Graphics;
  scene['offscreenTarget'] = sprite() as unknown as Phaser.GameObjects.Text;
  scene['attackEffects'] = new AttackEffects(scene, scene['world']);
  scene['visualClock'] = 1000;
  const snapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({ ...engine.snapshot(), phase: 'playing', ...overrides });
  const addEnemy = (character: CharacterDefinition) => {
    const enemy: Enemy = {
      id: 1, appearanceId: character.id, kind: character.enemyKind ?? 'normal', x: 800, side: 1,
      speed: 14, hp: 2, maxHp: 2, state: 'alive', stunUntil: 0, immuneUntil: 0,
      attackUntil: 0, nextAttackAt: 0, bossPhase: 1, rage: 0,
      challenge: createChallenge(WORDS[0], 'hint', 1, () => 0.5),
    };
    engine.enemies = [enemy];
    const view = scene['createEnemy'](enemy);
    scene['enemies'].set(enemy.id, view);
    return { enemy, view, actor: view.sprite as unknown as DrawNode };
  };
  return { engine, scene, snapshot, addEnemy, hero: scene['hero'] as unknown as DrawNode };
}

describe('tactical and co-op Scene handoff', () => {
  it('updates cached labels and world captions when language changes without resetting combat', () => {
    const { scene, engine, snapshot, addEnemy } = harness();
    const { enemy, view } = addEnemy(ENEMY_CHARACTERS.find(character => character.enemyKind === 'armored')!);
    enemy.role = 'shield';
    engine.worldObjects = [{ id: 77, kind: 'gate', x: 900, radius: 40, state: 'closed', charges: 1, progress: 0 }];
    const state = snapshot();
    scene['renderEnemies'](state);
    expect(view.descriptor.text).toContain('HỘ VỆ');
    expect(scene['worldViews'].get(77)!.caption.text).toBe('Cổng đóng');
    const challenge = enemy.challenge, originalHp = enemy.hp, originalClock = engine.clock;

    scene.setOptions({ ...scene.options, language: 'en' });
    scene['renderEnemies'](state);
    expect(view.descriptor.text).toContain('GUARD');
    expect(view.descriptor.text).toContain('ARMOR');
    expect(scene['worldViews'].get(77)!.caption.text).toBe('Gate closed');
    expect(enemy.challenge).toBe(challenge);
    expect(enemy.hp).toBe(originalHp);
    expect(engine.clock).toBe(originalClock);

    scene.setOptions({ ...scene.options, language: 'vi' });
    scene['renderEnemies'](state);
    expect(view.descriptor.text).toContain('HỘ VỆ');
  });
  it('renders English peer reservations and combat feedback while preserving a teammate name', () => {
    const { scene, snapshot, addEnemy } = harness();
    const { enemy, view } = addEnemy(ENEMY_CHARACTERS.find(character => character.enemyKind === 'normal')!);
    scene.setOptions({ ...scene.options, language: 'en' });
    scene['renderEnemies'](snapshot({ party: { selfId: 'self', players: [
      { id: 'self', heroId: 'soldier', x: 640, hp: 100, targetId: null },
      { id: 'peer', name: 'Bạn B', heroId: 'wizard', x: 950, hp: 80, targetId: enemy.id },
    ] } }));
    expect(view.protectedLabel.text).toBe('Claimed by Bạn B');
    scene['handleEvent']({ type: 'hero-skill', heroId: 'knight', skillPhase: 'block', x: 640 });
    expect(scene['floats'].at(-1)?.text.text).toBe('BLOCKED!');
  });
  it('lands a barrel letter on the prop, and removes that exact shot on authoritative world impact', () => {
    const { scene, engine } = harness();
    engine.worldObjects = [{ id: 77, kind: 'barrel', x: 900, radius: 220, state: 'idle', charges: 1, progress: 0 }];
    scene['handleEvent']({ type: 'shot', worldObjectId: 77, shotId: 91, x: 900, glyph: 'a', firedAt: 0, impactAt: 200 });
    expect(scene['letters'][0]).toMatchObject({ worldObjectId: 77, x1: 900, y1: 464 });
    engine.clock = 200;
    scene['handleEvent']({ type: 'world-hit', worldObjectId: 77, shotId: 91, x: 900, glyph: 'a' });
    expect(scene['letters']).toHaveLength(0);
    expect(scene['impacts'][0]).toMatchObject({ x: 900, y: 464 });
  });
  it('draws a peer shot from the peer hero and source without changing the local action/facing or hurt feedback', () => {
    const { scene, engine, snapshot } = harness();
    const state = snapshot({ party: { selfId: 'self', players: [
      { id: 'self', heroId: 'soldier', x: 640, hp: 100, targetId: null },
      { id: 'peer', heroId: 'wizard', x: 1000, hp: 80, targetId: null },
    ] } });
    vi.spyOn(engine, 'snapshot').mockReturnValue(state);
    scene['handleEvent']({ type: 'shot', playerId: 'peer', sourceX: 1000, x: 800, glyph: 'a', shotId: 32, firedAt: 0, impactAt: 200 });
    const character = getHeroCharacter('wizard'), asset = SPRITE_BY_KEY.get(character.actions.attack);
    expect(scene['letters'][0]).toMatchObject({ heroId: 'wizard', playerId: 'peer', x0: projectileOrigin(1000, 490, -1, character.displayScale, asset?.projectileOffset).x });
    expect(scene['heroAction']).toBeNull(); expect(scene['heroFacing']).toBe(1);
    scene['handleEvent']({ type: 'player-hurt', playerId: 'peer', x: 1000, sourceX: 1100, damage: 4 });
    expect(scene['heroAction']).toBeNull(); expect(scene['shakeStart']).toBe(-1000);
  });
  it('marks a teammate claim separately from an enemy shield', () => {
    const { scene, snapshot, addEnemy } = harness();
    const { enemy, view } = addEnemy(ENEMY_CHARACTERS.find(character => character.enemyKind === 'normal')!);
    const shield = vi.spyOn(scene as unknown as { drawProtectedShield: () => void }, 'drawProtectedShield');
    scene['renderEnemies'](snapshot({ party: { selfId: 'self', players: [
      { id: 'self', heroId: 'soldier', x: 640, hp: 100, targetId: null },
      { id: 'peer', name: 'Bạn B', heroId: 'wizard', x: 950, hp: 80, targetId: enemy.id },
    ] } }));
    expect((view.protectedLabel as unknown as DrawNode).visible).toBe(true);
    expect((view.protectedLabel as unknown as DrawNode).text).toContain('Bạn B');
    expect(shield).not.toHaveBeenCalled();
    expect((view.sprite as unknown as DrawNode).flipX).toBe(false);
  });
  it('recoils a nonboss away from the actual peer projectile instead of away from the local player', () => {
    const { scene, engine, snapshot, addEnemy } = harness();
    const { enemy, actor } = addEnemy(ENEMY_CHARACTERS.find(character => character.enemyKind === 'normal')!);
    const state = snapshot({ party: { selfId: 'self', players: [
      { id: 'self', heroId: 'soldier', x: 640, hp: 100, targetId: null },
      { id: 'peer', heroId: 'wizard', x: 1000, hp: 80, targetId: enemy.id },
    ] } });
    vi.spyOn(engine, 'snapshot').mockReturnValue(state);
    scene.options.reducedMotion = false;
    scene['handleEvent']({ type: 'shot', playerId: 'peer', enemyId: enemy.id, sourceX: 1000, x: enemy.x, glyph: 'a', shotId: 44, firedAt: 0, impactAt: 100 });
    scene['handleEvent']({ type: 'hit', playerId: 'peer', enemyId: enemy.id, x: enemy.x, glyph: 'a', shotId: 44, duration: 300, impactAt: 100 });
    engine.clock = 180; enemy.stunUntil = 400;
    scene['renderEnemies'](state);
    expect(actor.x).toBeLessThan(enemy.x);
  });
  it('keeps an aggregate Boss impact from claiming the local hero was hit or shaking their view', () => {
    const { scene, engine, snapshot } = harness();
    const state = snapshot({ party: { selfId: 'self', players: [
      { id: 'self', heroId: 'soldier', x: 640, hp: 100, targetId: null },
      { id: 'peer', heroId: 'wizard', x: 900, hp: 60, targetId: null },
    ] } });
    vi.spyOn(engine, 'snapshot').mockReturnValue(state);
    const ground = vi.spyOn(scene['attackEffects'], 'record');
    const contact = vi.spyOn(scene['attackEffects'], 'recordContact');
    scene['handleEvent']({ type: 'attack-impact', enemyKind: 'tank', attackKind: 'slam', x: 900, targetX: 900, radius: 300, hit: true, damage: 12 });
    expect(ground.mock.calls[0][0].hit).toBe(false);
    expect(scene['slamShakeStart']).toBe(-1000);
    scene['handleEvent']({ type: 'player-hurt', playerId: 'peer', enemyKind: 'tank', x: 900, sourceX: 1000, damage: 12 });
    expect(contact).toHaveBeenCalledOnce();
    expect(contact.mock.calls[0][2].x).toBeCloseTo(characterHitPoint(900, 490, getHeroCharacter('wizard'), 1).x);
    expect(scene['shakeStart']).toBe(-1000);
  });
  it('keeps the selected barrel puzzle on a readable label rail', () => {
    const { scene, engine, snapshot } = harness();
    engine.worldObjects = [{ id: 77, kind: 'barrel', x: 900, radius: 220, state: 'idle', charges: 1, progress: 0 }];
    scene['renderEnemies'](snapshot({ target: { id: -77, kind: 'barrel', worldObjectId: 77, prompt: 'a _ _', hint: 'a _ _', type: 'missing', length: 3, meaning: 'Một từ', partOfSpeech: 'noun', difficulty: 1 } }));
    const view = scene['worldViews'].get(77)!;
    expect((view.label as unknown as DrawNode).visible).toBe(true);
    expect(view.label.x).toBeGreaterThanOrEqual(137); expect(view.label.x).toBeLessThanOrEqual(1143);
    expect([178, 292]).toContain(view.label.y);
  });
  it('holds the local downed hero death pose while the party is still fighting', () => {
    const { scene, snapshot, hero } = harness();
    const state = snapshot({ hp: 0, party: { selfId: 'self', players: [{ id: 'self', heroId: 'soldier', x: 640, hp: 0, targetId: null }] } });
    scene['renderHero'](state); scene['visualClock'] = 2500; scene['renderHero'](state);
    expect(hero.texture.key).toBe(getHeroCharacter('soldier').actions.death);
    expect(scene['heroAction']?.hold).toBe(true);
  });
});

describe('native Scene hero integration', () => {
  it.each(HERO_CHARACTERS)('fires immediately and uses $name release, anchor and scale', character => {
    const h = harness(character.id);
    const target = h.addEnemy(ENEMY_CHARACTERS[0]);
    const asset = SPRITE_BY_KEY.get(character.actions.attack)!;
    h.scene['handleEvent']({ type: 'shot', enemyId: 1, x: 800, glyph: 'a', shotId: 1, firedAt: 0, impactAt: 220 });
    const shot = h.scene['letters'][0];
    const origin = projectileOrigin(640, 490, 1, character.displayScale, asset.projectileOffset);
    expect(h.engine.clock).toBe(0);
    expect(shot.object.x).toBeCloseTo(origin.x);
    expect(shot.object.y).toBeCloseTo(origin.y);
    expect(shot.targetCharacter.id).toBe(target.view.character.id);
    const release = rangedShotTiming(asset);
    expect(h.scene['heroAction']).toMatchObject({ key: character.actions.attack, offset: release.offset, until: 1000 + release.duration });
    h.scene['renderHero'](h.snapshot());
    expect(h.hero.texture.key).toBe(character.actions.attack);
    expect(Number(h.hero.frame.name)).toBe(asset.releaseFrame ?? asset.attackContactFrame ?? 0);
    expect(h.hero.originX).toBe(character.originX);
    expect(h.hero.originY).toBe(character.originY);
    expect(h.hero.scaleX).toBe(character.displayScale);

    h.engine.playerX += 20;
    h.scene['renderHero'](h.snapshot());
    expect(h.hero.texture.key).toBe(character.actions.move);
    h.scene['handleEvent']({ type: 'player-hurt', sourceX: 800, x: 660, damage: 12 });
    h.scene['renderHero'](h.snapshot());
    expect(h.hero.texture.key).toBe(character.actions.hurt);
    h.scene['handleEvent']({ type: 'game-over' });
    h.scene['visualClock'] += animationDuration(character.actions.death) + 1000;
    h.scene['renderHero'](h.snapshot({ phase: 'over' }));
    expect(h.hero.texture.key).toBe(character.actions.death);
  });

  it('refreshes the menu hero and clears facing, gait and an old action on selection', () => {
    const h = harness();
    h.scene['heroFacing'] = -1;
    h.scene['heroGaitPhase'] = 0.75;
    h.scene['heroWalking'] = true;
    h.scene['handleEvent']({ type: 'jam' });
    h.scene.options.heroId = 'wizard';
    h.scene['syncHeroSelection']();
    h.scene['renderHero'](h.snapshot({ phase: 'menu' }));
    const selected = getHeroCharacter('wizard');
    expect(h.hero.texture.key).toBe(selected.actions.idle);
    expect(h.hero.scaleX).toBe(selected.displayScale);
    expect(h.hero.originY).toBe(selected.originY);
    expect(h.hero.flipX).toBe(false);
    expect(h.scene['heroAction']).toBeNull();
    expect(h.scene['heroGaitPhase']).toBe(0);
  });

  it.each(HERO_SKILLS)('hands $heroId weapon visuals the same letter flight without delaying gameplay', skill => {
    const h = harness(skill.heroId);
    h.addEnemy(ENEMY_CHARACTERS[0]);
    const draw = vi.spyOn(h.scene['heroAttackEffects'], 'drawProjectile').mockImplementation(() => undefined);
    const skills = vi.spyOn(h.scene['heroAttackEffects'], 'drawSkills').mockImplementation(() => undefined);
    h.scene['handleEvent']({ type: 'shot', enemyId: 1, x: 800, glyph: 'a', shotId: 7, firedAt: 0, impactAt: 220 });
    h.engine.clock = 110;
    h.scene['renderLetters']();
    expect(h.scene['letters']).toHaveLength(1);
    const shot = h.scene['letters'][0];
    expect(shot.object.text).toBe('a');
    expect(draw).toHaveBeenCalledWith(h.scene['bulletFx'], expect.objectContaining({
      heroId: skill.heroId, progress: 0.5, reducedMotion: true,
      point: { x: shot.object.x, y: shot.object.y },
    }));
    expect(skills).toHaveBeenLastCalledWith(h.scene['bulletFx'], 1000, true);
    h.engine.clock = 220;
    h.scene['renderLetters']();
    expect(h.scene['letters']).toHaveLength(0);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it.each(HERO_SKILLS)('maps $name activation to native hero and target geometry, then resets the burst', skill => {
    const h = harness(skill.heroId);
    const { view } = h.addEnemy(ENEMY_CHARACTERS[0]);
    const emit = vi.spyOn(h.scene['heroAttackEffects'], 'emitSkill');
    h.scene['handleEvent']({
      type: 'hero-skill', heroId: skill.heroId, skillId: skill.id, visualKind: skill.visualKind,
      skillPhase: 'activate', x: 640, targetX: 800, radius: 150, duration: 1000,
      targets: [{ enemyId: 1, x: 800 }],
    });
    const hero = getHeroCharacter(skill.heroId);
    const target = characterHitPoint(800, 490, view.character, -1);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      heroId: hero.id, x: 640, y: 490, at: 1000, direction: 1,
      visualKind: skill.visualKind, height: hero.bodyHeight * hero.displayScale,
      targets: [{ enemyId: 1, x: target.x, y: target.y }],
    }));
    expect(h.scene['heroAttackEffects'].activeSkillCount).toBe(1);
    expect(h.engine.clock).toBe(0);
    h.scene['resetVisuals']();
    expect(h.scene['heroAttackEffects'].activeSkillCount).toBe(0);
  });

  it('shows Knight block feedback without introducing a hurt animation or changing health', () => {
    const h = harness('knight');
    const skill = getHeroSkill('knight');
    h.scene['handleEvent']({ type: 'hero-skill', heroId: 'knight', skillId: skill.id, visualKind: 'guard',
      x: 640, targetX: 800, skillPhase: 'block', value: 12 });
    expect(h.scene['heroAction']).toBeNull();
    expect(h.scene['floats'][0].text.text).toBe('CHẶN ĐÒN!');
    expect(h.engine.snapshot().hp).toBe(100);
  });
});

describe('native Scene enemy integration', () => {
  it('places clustered labels outside the skill HUD while preserving the selected target cue', () => {
    const h = harness();
    const character = ENEMY_CHARACTERS.find(candidate => candidate.enemyKind === 'normal')!;
    const first = h.addEnemy(character);
    const base = first.enemy;
    const enemies = Array.from({ length: 6 }, (_, index) => ({ ...base, id: index + 1, x: 30 + index * 24 }));
    h.engine.enemies = enemies;
    h.engine.targetId = 3;
    h.scene['renderEnemies'](h.snapshot());
    const views = enemies.map(enemy => h.scene['enemies'].get(enemy.id)!);
    expect(views[2].label.visible).toBe(true);
    for (const view of views) {
      expect(view.label.visible).toBe(true);
      expect(view.label.x - view.labelWidth / 2).toBeGreaterThanOrEqual(view.label.y === 178 ? 352 : 18);
      for (const other of views.filter(candidate => candidate !== view && candidate.label.y === view.label.y)) {
        expect(Math.abs(view.label.x - other.label.x)).toBeGreaterThanOrEqual((view.labelWidth + other.labelWidth) / 2 + 12);
      }
    }
  });
  it('renders an unselected CSV translation hint without a remote source link', () => {
    const h = harness();
    const { enemy, view } = h.addEnemy(ENEMY_CHARACTERS[0]);
    enemy.challenge = createChallenge({ ...WORDS[0], sourceUrl: undefined }, 'translate', 1);
    h.engine.targetId = null;
    h.scene['renderEnemies'](h.snapshot({ target: null }));
    expect((view.hint as unknown as DrawNode).text).toBe('a _ _ _ e');
  });

  it.each(ENEMY_CHARACTERS)('keeps $name identity, contact pose and scale through attack, freeze and death', character => {
    const h = harness();
    const { enemy, view, actor } = h.addEnemy(character);
    enemy.attackUntil = 500;
    h.scene['handleEvent']({ type: 'attack', enemyId: 1, x: 800, enemyKind: enemy.kind, duration: 500 });
    h.engine.clock = 250;
    h.scene['visualClock'] = 1250;
    h.scene['renderEnemies'](h.snapshot());
    const asset = SPRITE_BY_KEY.get(character.actions.attack)!;
    expect(actor.texture.key).toBe(character.actions.attack);
    expect(Number(actor.frame.name)).toBe(attackAnticipationFrame(0.5, asset));
    expect(actor.originX).toBe(character.originX);
    expect(actor.originY).toBe(character.originY);
    expect(actor.scaleX).toBe(character.displayScale);
    enemy.attackUntil = 0;
    h.scene['handleEvent']({ type: 'attack-impact', enemyId: 1, x: 800, targetX: 640, enemyKind: enemy.kind, hit: true, damage: 12 });
    expect(actor.texture.key).toBe(character.actions.attack);
    expect(Number(actor.frame.name)).toBe(attackContactFrame(asset));
    h.scene['renderEnemies'](h.snapshot({ freezeRemaining: 3000 }));
    const frozen = actor.frame.name;
    h.scene['visualClock'] += 160;
    h.engine.clock += 160;
    h.scene['renderEnemies'](h.snapshot({ freezeRemaining: 2840 }));
    if (enemy.kind !== 'tank') expect(actor.frame.name).toBe(frozen);

    // Removal cannot make death fall back to another character or inherit a recoil transform.
    actor.setAngle(9).setScale(99).setTint(0xff0000).setAlpha(0.66).setPosition(803, 478);
    h.engine.enemies = [];
    h.scene['handleEvent']({ type: 'enemy-death', enemyId: 1, x: 800 });
    h.scene['renderEnemies'](h.snapshot());
    expect(actor.texture.key).toBe(character.actions.death);
    expect(actor).toMatchObject({ x: 800, y: 490, angle: 0, scaleX: character.displayScale, scaleY: character.displayScale, alpha: 1, tint: 0xffffff });
    expect(view.character.id).toBe(character.id);
    h.scene['visualClock'] += animationDuration(character.actions.death) + 79;
    h.scene['renderEnemies'](h.snapshot());
    expect(actor.destroyed).toBe(false);
    expect(actor.alpha).toBe(1);
    h.scene['visualClock'] += 241;
    h.scene['renderEnemies'](h.snapshot());
    expect(actor.destroyed).toBe(true);
    expect(h.scene['enemies'].has(1)).toBe(false);
  });

  it('retains the actual target chest position when a delayed hit arrives after removal', () => {
    const h = harness();
    const character = ENEMY_CHARACTERS.find(candidate => candidate.enemyKind === 'tank')!;
    h.addEnemy(character);
    h.scene['handleEvent']({ type: 'shot', enemyId: 1, x: 800, glyph: 'a', shotId: 17 });
    h.engine.enemies = [];
    h.scene['enemies'].clear();
    h.scene['handleEvent']({ type: 'hit', enemyId: 1, x: 800, glyph: 'a', shotId: 17 });
    const contact = characterHitPoint(800, 490, character, -1);
    expect(h.scene['letters']).toHaveLength(0);
    expect(h.scene['impacts'][0]).toMatchObject(contact);
  });

  it('holds an already-stunned native pose throughout freeze instead of animating and snapping back', () => {
    const h = harness();
    const character = ENEMY_CHARACTERS.find(candidate => candidate.enemyKind === 'normal')!;
    const { enemy, actor } = h.addEnemy(character);
    enemy.stunUntil = 300;
    h.scene['handleEvent']({ type: 'hit', enemyId: 1, x: 800, glyph: 'a', duration: 300, impactAt: 0 });
    h.scene['renderEnemies'](h.snapshot());
    expect(actor.texture.key).toBe(character.actions.hurt);
    h.scene['renderEnemies'](h.snapshot({ freezeRemaining: 3000 }));
    const frozen = { key: actor.texture.key, frame: actor.frame.name };
    for (const age of [80, 150, 250, 310, 1000]) {
      h.engine.clock = age;
      h.scene['visualClock'] = 1000 + age;
      h.scene['renderEnemies'](h.snapshot({ freezeRemaining: 3000 - age }));
      expect({ key: actor.texture.key, frame: actor.frame.name }).toEqual(frozen);
      expect(Number(actor.frame.name)).toBeLessThan(SPRITE_BY_KEY.get(actor.texture.key)!.durations.length);
    }
    h.scene['renderEnemies'](h.snapshot());
    expect(actor.texture.key).toBe(character.actions.move);
  });

  it.each(['normal', 'tank'] as const)('applies Wizard local freeze to %s with the same Boss immunity as gameplay', kind => {
    const h = harness('wizard');
    const character = ENEMY_CHARACTERS.find(candidate => candidate.enemyKind === kind)!;
    const { enemy, view, actor } = h.addEnemy(character);
    actor.setFrame(3);
    enemy.freezeUntil = 1000;
    h.scene['renderEnemies'](h.snapshot({ freezeRemaining: 0 }));
    expect(view.freezeFrame !== null).toBe(kind !== 'tank');
    const frozenFrame = actor.frame.name;
    h.engine.clock = 400;
    h.scene['visualClock'] = 1400;
    h.scene['renderEnemies'](h.snapshot({ freezeRemaining: 0 }));
    if (kind !== 'tank') {
      expect(actor.frame.name).toBe(frozenFrame);
      expect(actor.tint).toBe(0xc6f2fa);
    }
    enemy.freezeUntil = 0;
    h.scene['renderEnemies'](h.snapshot({ freezeRemaining: 0 }));
    expect(view.freezeFrame).toBeNull();
    expect(Number(actor.frame.name)).toBeLessThan(SPRITE_BY_KEY.get(actor.texture.key)!.durations.length);
  });
});
