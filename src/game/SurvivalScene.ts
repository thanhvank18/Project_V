import Phaser from 'phaser';
import { animationDuration, preloadArt, SPRITE_BY_KEY, spriteFrame } from './assets';
import { AttackEffects } from './attackEffects';
import { flightPoint, glyphScaleForDistance, lowHealthVisuals } from './combatVisuals';
import { actionElapsedMs, attackAnticipationFrame, attackContactFrame, attackRecoveryFrame, bossPhaseTint, characterHitPoint, characterShadow, characterVisualHeight, deathVisuals, gaitPhaseAfterDistance, heldRecoveryStart, heroAnimationKey, projectileOrigin, rangedShotTiming, resetDeathPose } from './characterAnimation';
import { getEnemyCharacter, getHeroCharacter, type CharacterDefinition } from './characterCatalog';
import { layoutEnemyLabels, type EnemyLabelRequest } from './enemyLabelLayout';
import { HeroAttackEffects } from './HeroAttackEffects';
import { TacticalWorldEffects, type TelegraphVisual, type RoleVisual } from './TacticalWorldEffects';
import { AlliedHeroes, partyColor, partyName } from './AlliedHeroes';
import { getHeroSkill } from './heroSkills';
import { GameAudio, type AudioState } from './GameAudio';
import { audioCueForEvent } from './combatAudio';
import { BOSS_SLAM_RANGE, canTargetEnemy, WORLD_WIDTH } from './engine';
import { createWorldBackdrop } from './worldBackdrop';
import { CHARGE_RADIUS, RANGED_RADIUS } from './tacticalRules';
import { PART_OF_SPEECH_LABELS } from './vocabulary';
import type { Enemy, EnginePort, GameEvent, ItemKind, Snapshot, WorldObject } from './types';

export interface RenderOptions { reducedMotion: boolean; muted: boolean; heroId?: string; musicVolume?: number; sfxVolume?: number }
interface Action { key: string; start: number; until: number; offset: number; priority: boolean; hold: boolean }
interface EnemyView {
  character: CharacterDefinition;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Rectangle;
  descriptor: Phaser.GameObjects.Text;
  prompt: Phaser.GameObjects.Text;
  meaning: Phaser.GameObjects.Text;
  hint: Phaser.GameObjects.Text;
  protectedLabel: Phaser.GameObjects.Text;
  slamLabel: Phaser.GameObjects.Text;
  action: Action | null;
  born: number;
  dyingAt: number | null;
  lastX: number;
  gaitPhase: number;
  lastKind: Enemy['kind'];
  labelWidth: number;
  lastText: string;
  flashUntil: number;
  staggerStart: number;
  staggerDuration: number;
  staggerDirection: number;
  freezeFrame: { key: string; frame: number } | null;
  attackImpactStart: number;
  recoveryLastClock: number;
  attackDirection: number;
  attackOrigin: number;
  attackDuration: number;
}
interface Letter {
  heroId: string;
  targetCharacter: CharacterDefinition;
  object: Phaser.GameObjects.Text;
  ghosts: Phaser.GameObjects.Text[];
  shotId?: number;
  enemyId: number;
  worldObjectId?: number;
  momentum: number;
  playerId?: string;
  start: number;
  impactAt: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  effective: boolean;
}
interface Effect { sprite: Phaser.GameObjects.Sprite; key: string; start: number; duration: number }
interface FloatText { text: Phaser.GameObjects.Text; start: number; x: number; y: number; duration: number }
interface Impact { x: number; y: number; start: number; seed: number; power: number }
interface Pickup {
  icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; item: ItemKind;
  x: number; y: number; start: number;
}
type WorldView = Pick<EnemyView, 'label' | 'plate' | 'descriptor' | 'prompt' | 'meaning' | 'hint' | 'lastText'> & { caption: Phaser.GameObjects.Text };

const PLAYER_X = 640;
const GROUND = 490;
const FONT = '"Be Vietnam Pro", Arial, sans-serif';
const KIND_COLORS = { normal: 0x94bd97, runner: 0xf8b86b, armored: 0xa5b1dc, tank: 0xff9f7b };
const ITEM_NAMES: Record<ItemKind, string> = { health: 'Túi cứu thương', freeze: 'Đóng băng', damage: 'Cường hóa', shield: 'Gợi ý' };
const ITEM_INDEX: Record<ItemKind, number> = { health: 0, freeze: 1, damage: 2, shield: 3 };
// World distance per full two-step cycle, tuned to the game's deliberately slow approach speeds.
const GAIT_STRIDE: Record<Enemy['kind'], number> = { normal: 14, runner: 22, armored: 12, tank: 10 };

export class SurvivalScene extends Phaser.Scene {
  private readonly engine: EnginePort;
  private readonly notify: (snapshot: Snapshot) => void;
  options: RenderOptions;
  private hero!: Phaser.GameObjects.Sprite;
  private heroCharacter: CharacterDefinition;
  private world!: Phaser.GameObjects.Container;
  private dizziness!: Phaser.GameObjects.Graphics;
  private shields!: Phaser.GameObjects.Graphics;
  private hazards!: Phaser.GameObjects.Graphics;
  private shakeStart = -1000;
  private slamShakeStart = -1000;
  private slamShakeStrength = 0;
  private heroHurtStart = -1000;
  private heroHurtDirection = 1;
  private attackEffects!: AttackEffects;
  private heroAttackEffects = new HeroAttackEffects();
  private tacticalEffects?: TacticalWorldEffects;
  private worldViews = new Map<number, WorldView>();
  private allies?: AlliedHeroes;
  private skillSequence = 0;
  private cameraX = 0;
  private lastPlayerX = 640;
  private heroAction: Action | null = null;
  private heroFacing = 1;
  private heroGaitPhase = 0;
  private heroWalking = false;
  private heroLastMoveClock = -1000;
  private heroShotFacing = 1;
  private heroKickStart = -1000;
  private enemies = new Map<number, EnemyView>();
  private letters: Letter[] = [];
  private effects: Effect[] = [];
  private floats: FloatText[] = [];
  private impacts: Impact[] = [];
  private pickups: Pickup[] = [];
  private decoration: Phaser.GameObjects.Sprite[] = [];
  private lines!: Phaser.GameObjects.Graphics;
  private reticle!: Phaser.GameObjects.Graphics;
  private bulletFx!: Phaser.GameObjects.Graphics;
  private impactFx!: Phaser.GameObjects.Graphics;
  private heroShadow!: Phaser.GameObjects.Ellipse;
  private jamLight!: Phaser.GameObjects.Arc;
  private offscreenTarget!: Phaser.GameObjects.Text;
  private visualClock = 0;
  private notifyElapsed = 100;
  private lastEngineClock = 0;
  private lastPhase = '';
  private lastNotice = '';
  private gameAudio: GameAudio | null = null;
  readonly loadErrors: string[] = [];
  onPrepared: () => void = () => undefined;

  constructor(engine: EnginePort, notify: (snapshot: Snapshot) => void, options: RenderOptions, private readonly onAudioState?: (state: AudioState) => void) {
    super({ key: 'survival' });
    this.engine = engine;
    this.notify = notify;
    this.options = options;
    this.heroCharacter = getHeroCharacter(options.heroId);
  }

  preload(): void {
    // Scene plugin properties (including events) are injected during boot, not construction.
    this.events.once(Phaser.Scenes.Events.CREATE, () => this.onPrepared());
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.loadErrors.push(file.key);
    });
    preloadArt(this);
  }

  create(): void {
    if (this.loadErrors.length) return;
    this.gameAudio = new GameAudio(this.onAudioState);
    this.gameAudio.configure(this.options);
    this.gameAudio.setPhase(this.engine.snapshot().phase);
    this.world = this.add.container(0, 0).setDepth(0);
    this.inWorld(createWorldBackdrop(this).setDepth(-3));
    // A quiet vignette reserves contrast for the upper HUD and lower typing area.
    this.inWorld(this.add.rectangle(WORLD_WIDTH / 2, 360, WORLD_WIDTH, 720, 0x0b1922, 0.12).setDepth(-2));
    this.inWorld(this.add.rectangle(WORLD_WIDTH / 2, 57, WORLD_WIDTH, 114, 0x101c25, 0.28).setDepth(-1));
    this.inWorld(this.add.rectangle(WORLD_WIDTH / 2, 640, WORLD_WIDTH, 160, 0x101c25, 0.63).setDepth(-1));
    const heroShadow = characterShadow(this.heroCharacter);
    this.heroShadow = this.inWorld(this.add.ellipse(this.engine.playerX, GROUND + 3, heroShadow.width, heroShadow.height, 0x07131a, 0.6).setDepth(2));
    this.hero = this.inWorld(this.add.sprite(this.engine.playerX, GROUND, this.heroCharacter.actions.idle, 0).setOrigin(this.heroCharacter.originX, this.heroCharacter.originY).setScale(this.heroCharacter.displayScale).setDepth(10));
    this.jamLight = this.inWorld(this.add.circle(this.engine.playerX + 25, GROUND - 115, 5, 0xff7975).setDepth(19).setVisible(false));
    this.lines = this.add.graphics().setDepth(15);
    this.reticle = this.inWorld(this.add.graphics().setDepth(16));
    this.bulletFx = this.inWorld(this.add.graphics().setDepth(17));
    this.impactFx = this.inWorld(this.add.graphics().setDepth(19));
    this.shields = this.inWorld(this.add.graphics().setDepth(13));
    this.hazards = this.inWorld(this.add.graphics().setDepth(1));
    this.attackEffects = new AttackEffects(this, this.world);
    this.tacticalEffects = new TacticalWorldEffects(this, this.world);
    this.allies = new AlliedHeroes(this, this.world);
    this.dizziness = this.add.graphics().setDepth(13);
    this.offscreenTarget = this.add.text(0, 382, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#f6d79d', stroke: '#172b36', strokeThickness: 4, resolution: 2 }).setOrigin(0.5).setDepth(21).setVisible(false);
    this.inWorld(this.add.rectangle(PLAYER_X, GROUND + 26, 2, 10, 0xf6c372, 0.8).setDepth(2));
    this.inWorld(this.add.rectangle(PLAYER_X - 18, GROUND + 26, 8, 2, 0xf6c372, 0.4).setDepth(2));
    this.inWorld(this.add.rectangle(PLAYER_X + 18, GROUND + 26, 8, 2, 0xf6c372, 0.4).setDepth(2));
    for (const [x, kind, flip] of [[185, 'normal', false], [1085, 'runner', true]] as const) {
      const character = getEnemyCharacter(undefined, kind);
      const sprite = this.inWorld(this.add.sprite(x, GROUND, character.actions.idle, 0).setOrigin(character.originX, character.originY).setScale(character.displayScale).setFlipX(flip).setAlpha(0.42).setDepth(3));
      this.decoration.push(sprite);
    }
    const unlock = () => this.gameAudio?.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    const cleanAudio = () => {
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('pointerdown', unlock);
      this.gameAudio?.destroy();
      this.gameAudio = null;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanAudio);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanAudio);
    this.notify(this.engine.snapshot());
  }

  setOptions(options: RenderOptions): void {
    this.options = options;
    this.gameAudio?.configure(options);
  }

  nextTrack(): void {
    this.gameAudio?.nextTrack();
  }

  update(_time: number, delta: number): void {
    const before = this.engine.snapshot();
    const dt = Math.min(Math.max(delta, 0), 50);
    this.engine.step(dt);
    const snapshot = this.engine.snapshot();
    this.gameAudio?.setPhase(snapshot.phase);
    this.notifyElapsed += dt;
    if (this.engine.clock < this.lastEngineClock || (snapshot.phase === 'playing' && before.phase === 'menu') || (snapshot.phase === 'menu' && this.lastPhase !== 'menu')) this.resetVisuals();
    if (snapshot.phase === 'menu') this.syncHeroSelection();
    this.lastEngineClock = this.engine.clock;
    if (snapshot.phase === 'playing' || snapshot.party && snapshot.phase === 'paused') {
      const desiredCamera = Phaser.Math.Clamp(this.engine.playerX - 640, 0, WORLD_WIDTH - 1280);
      this.cameraX += (desiredCamera - this.cameraX) * (1 - Math.exp(-dt / 160));
    }
    if (snapshot.party || snapshot.phase !== 'paused' && snapshot.phase !== 'countdown') this.visualClock += dt;
    this.allies?.render(snapshot.party?.players ?? [], snapshot.party?.selfId ?? '', this.engine.clock);
    for (const event of this.engine.drainEvents()) this.handleEvent(event);
    this.renderHero(snapshot);
    this.renderEnemies(snapshot);
    this.renderTactics(snapshot);
    this.renderLetters();
    this.renderEffects();
    this.attackEffects.render(this.visualClock, this.options.reducedMotion);
    this.renderWorldEffects(snapshot);
    this.world.sort('depth');
    const menu = snapshot.phase === 'menu';
    for (const sprite of this.decoration) {
      sprite.setVisible(menu);
      if (menu) sprite.setFrame(spriteFrame(sprite.texture.key, this.visualClock));
    }
    if (this.notifyElapsed >= 100 || snapshot.phase !== this.lastPhase || snapshot.notice !== this.lastNotice) {
      this.notifyElapsed = 0;
      this.lastPhase = snapshot.phase;
      this.lastNotice = snapshot.notice;
      this.notify(snapshot);
    }
  }

  private resetVisuals(): void {
    for (const view of this.enemies.values()) this.destroyEnemy(view);
    this.enemies.clear();
    for (const letter of this.letters) this.destroyLetter(letter);
    for (const effect of this.effects) effect.sprite.destroy();
    for (const floater of this.floats) floater.text.destroy();
    for (const pickup of this.pickups) { pickup.icon.destroy(); pickup.label.destroy(); }
    this.letters = []; this.effects = []; this.floats = []; this.heroAction = null;
    this.impacts = []; this.pickups = []; this.heroFacing = this.heroShotFacing = 1; this.heroGaitPhase = 0; this.heroWalking = false; this.heroKickStart = -1000; this.shakeStart = -1000;
    this.heroLastMoveClock = -1000;
    this.slamShakeStart = this.heroHurtStart = -1000;
    this.slamShakeStrength = 0;
    this.attackEffects.reset();
    this.heroAttackEffects.reset();
    this.tacticalEffects?.reset();
    this.allies?.reset();
    for (const view of this.worldViews.values()) { view.label.destroy(true); view.caption.destroy(); }
    this.worldViews.clear();
    this.skillSequence = 0;
    this.cameraX = Phaser.Math.Clamp(this.engine.playerX - 640, 0, WORLD_WIDTH - 1280);
    this.lastPlayerX = this.engine.playerX;
    this.bulletFx.clear(); this.impactFx.clear();
    this.heroCharacter = getHeroCharacter(this.options.heroId);
    this.hero.clearTint().setAlpha(1).setAngle(0).setScale(this.heroCharacter.displayScale).setFlipX(false);
    const shadow = characterShadow(this.heroCharacter);
    this.heroShadow.setDisplaySize(shadow.width, shadow.height);
  }

  private syncHeroSelection(): void {
    const character = getHeroCharacter(this.options.heroId);
    if (character.id === this.heroCharacter.id) return;
    this.heroCharacter = character;
    this.heroAction = null;
    this.heroGaitPhase = 0;
    this.heroWalking = false;
    this.heroFacing = this.heroShotFacing = 1;
    this.heroKickStart = this.heroHurtStart = -1000;
    const shadow = characterShadow(character);
    this.heroShadow.setDisplaySize(shadow.width, shadow.height);
  }

  private action(key: string, duration = animationDuration(key), offset = 0, priority = false, hold = false): Action {
    return { key, start: this.visualClock, until: this.visualClock + duration, offset, priority, hold };
  }

  private inWorld<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.world.add(object);
    return object;
  }

  private screenX(worldX: number): number { return worldX - this.cameraX; }

  private paintSprite(sprite: Phaser.GameObjects.Sprite, key: string, elapsed: number, character: CharacterDefinition): void {
    this.setSpritePose(sprite, key, spriteFrame(key, elapsed), character);
  }

  private setSpritePose(sprite: Phaser.GameObjects.Sprite, key: string, frame: number, character: CharacterDefinition): void {
    if (sprite.texture.key !== key) sprite.setTexture(key, frame);
    else if (sprite.frame.name !== String(frame)) sprite.setFrame(frame);
    sprite.setOrigin(character.originX, character.originY);
  }

  private renderHero(snapshot: Snapshot): void {
    if (snapshot.party && this.heroCharacter.id !== snapshot.hero.id) {
      this.heroCharacter = getHeroCharacter(snapshot.hero.id);
      this.heroAction = null;
      const shadow = characterShadow(this.heroCharacter);
      this.heroShadow.setDisplaySize(shadow.width, shadow.height);
    }
    if (snapshot.party && snapshot.hp <= 0 && this.heroAction?.key !== this.heroCharacter.actions.death) this.heroAction = this.action(this.heroCharacter.actions.death, undefined, 0, true, true);
    const travelled = Math.abs(this.engine.playerX - this.lastPlayerX);
    const positionChanged = travelled > .1;
    if (positionChanged) this.heroLastMoveClock = this.engine.clock;
    const moving = snapshot.phase === 'playing' && (positionChanged || Boolean(snapshot.party) && this.engine.clock - this.heroLastMoveClock < 80);
    if (snapshot.party || snapshot.phase !== 'paused' && snapshot.phase !== 'countdown') this.heroWalking = moving;
    if (moving && positionChanged) {
      this.heroFacing = this.engine.playerX < this.lastPlayerX ? -1 : 1;
    }
    this.heroGaitPhase = gaitPhaseAfterDistance(this.heroGaitPhase, travelled, 84, moving);
    this.hero.setFlipX(this.heroFacing < 0);
    const kick = this.options.reducedMotion ? 0 : Math.max(0, 1 - (this.visualClock - this.heroKickStart) / 65);
    const hurtAge = this.visualClock - this.heroHurtStart;
    const hurt = snapshot.phase !== 'menu' && hurtAge >= 0 && hurtAge < 280 ? Math.sin(Math.PI * Math.min(1, hurtAge / 280)) : 0;
    const recoil = this.options.reducedMotion ? 0 : hurt;
    this.hero.x = this.engine.playerX - this.heroShotFacing * kick * 3 + this.heroHurtDirection * recoil * 9;
    this.hero.y = GROUND - recoil * 3;
    const scale = this.heroCharacter.displayScale;
    this.hero.setAngle(this.heroHurtDirection * recoil * 6).setScale(scale * (1 + recoil * 0.035), scale * (1 - recoil * 0.035));
    this.heroShadow.x = this.engine.playerX;
    this.jamLight.x = this.engine.playerX + (this.hero.flipX ? -25 : 25);
    this.lastPlayerX = this.engine.playerX;
    if (this.heroAction && this.visualClock >= this.heroAction.until && !this.heroAction.hold) this.heroAction = null;
    const action = this.heroAction;
    const key = heroAnimationKey(this.heroWalking, action?.key, this.heroCharacter.actions, action?.priority);
    const elapsed = key === this.heroCharacter.actions.move ? this.heroGaitPhase * animationDuration(key)
      : action ? this.actionElapsed(action) : this.visualClock;
    this.paintSprite(this.hero, key, elapsed, this.heroCharacter);
    this.hero.setTint(hurt > 0 && hurtAge < 130 ? 0xffb2a1 : snapshot.freezeRemaining > 0 ? 0xcefbff : 0xffffff);
    this.jamLight.setVisible(snapshot.jamRemaining > 0).setAlpha(0.7 + Math.sin(this.visualClock / 35) * 0.3);
    this.heroShadow.setAlpha(snapshot.phase === 'menu' ? 0.4 : 0.6);
  }

  private createEnemy(enemy: Enemy): EnemyView {
    const isBoss = enemy.kind === 'tank';
    const character = getEnemyCharacter(enemy.appearanceId, enemy.kind);
    const size = characterShadow(character);
    const shadow = this.inWorld(this.add.ellipse(enemy.x, GROUND + 3, size.width, size.height, 0x07131a, 0.56).setDepth(3));
    const sprite = this.inWorld(this.add.sprite(enemy.x, GROUND, character.actions.move, 0).setOrigin(character.originX, character.originY).setScale(character.displayScale).setDepth(8).setFlipX(enemy.x > this.engine.playerX));
    const width = isBoss ? 260 : 238;
    const plate = this.add.rectangle(0, 0, width, 106, 0x12252f, 0.97).setStrokeStyle(1, 0x6e8490, 0.65);
    const descriptor = this.add.text(-width / 2 + 13, -43, '', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#a5b8bd', resolution: 2 });
    const prompt = this.add.text(0, -16, '', { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#f4f1df', align: 'center', wordWrap: { width: width - 24 }, resolution: 2 }).setOrigin(0.5);
    const meaning = this.add.text(0, 12, '', { fontFamily: FONT, fontSize: '13px', color: '#d1ded2', align: 'center', wordWrap: { width: width - 24 }, resolution: 2 }).setOrigin(0.5);
    const hint = this.add.text(0, 35, '', { fontFamily: FONT, fontSize: '12px', color: '#9ed6c2', align: 'center', resolution: 2 }).setOrigin(0.5);
    const label = this.add.container(enemy.x, 290, [plate, descriptor, prompt, meaning, hint]).setDepth(20);
    const protectedLabel = this.add.text(enemy.x, GROUND - (isBoss ? 207 : 128), '◆ Được Tank che chắn', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#b8def3', stroke: '#172b3b', strokeThickness: 4, resolution: 2 }).setOrigin(0.5).setDepth(21).setVisible(false);
    const slamLabel = this.add.text(enemy.x, GROUND + 46, 'VÙNG ĐẬP ĐẤT · NÉ SANG BÊN', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#ffd1a4', stroke: '#33242a', strokeThickness: 4, resolution: 2 }).setOrigin(0.5).setDepth(22).setVisible(false);
    return { character, sprite, shadow, label, plate, descriptor, prompt, meaning, hint, protectedLabel, slamLabel, action: null, born: this.visualClock, dyingAt: null, lastX: enemy.x, gaitPhase: (enemy.id * 0.381966) % 1, lastKind: enemy.kind, labelWidth: width, lastText: '', flashUntil: 0, staggerStart: 0, staggerDuration: 0, staggerDirection: 1, freezeFrame: null, attackImpactStart: -1000, recoveryLastClock: this.visualClock, attackDirection: 1, attackOrigin: enemy.x, attackDuration: isBoss ? 1500 : 500 };
  }

  private beginDeath(view: EnemyView): void {
    if (view.dyingAt !== null) return;
    view.dyingAt = this.visualClock;
    view.action = this.action(view.character.actions.death);
    view.freezeFrame = null;
    resetDeathPose(view.sprite, view.shadow, view.lastX, GROUND, view.character.displayScale);
    view.label.setVisible(false);
    view.protectedLabel.setVisible(false);
    view.slamLabel.setVisible(false);
  }

  private reactToBossLayer(view: EnemyView, event: 'armor-break' | 'boss-phase'): void {
    view.flashUntil = this.visualClock + 180;
    if (event === 'boss-phase' && !this.options.reducedMotion) this.addEffect('effects-ground-dust', view.lastX, GROUND - 7, 1.5);
  }

  private renderEnemies(snapshot: Snapshot): void {
    this.lines.clear(); this.reticle.clear(); this.shields.clear(); this.hazards.clear(); this.offscreenTarget.setVisible(false);
    if (snapshot.phase === 'menu') return;
    const ids = new Set(this.engine.enemies.map(enemy => enemy.id));
    for (const [id, view] of this.enemies) {
      if (!ids.has(id) && view.dyingAt === null) {
        this.beginDeath(view);
      }
      if (view.dyingAt !== null) {
        const age = this.visualClock - view.dyingAt;
        const key = view.character.actions.death;
        const death = deathVisuals(animationDuration(key), age);
        this.paintSprite(view.sprite, key, age, view.character);
        view.sprite.setAlpha(death.alpha);
        view.shadow.setAlpha(death.shadowAlpha);
        if (death.done) { this.destroyEnemy(view); this.enemies.delete(id); }
      }
    }
    const labelRequests: EnemyLabelRequest[] = [];
    // Place the target first, so it always keeps a nearby, readable callout.
    const ordered = [...this.engine.enemies].sort((a, b) => Number(b.id === this.engine.targetId) - Number(a.id === this.engine.targetId) || Math.abs(a.x - this.engine.playerX) - Math.abs(b.x - this.engine.playerX));
    for (const enemy of ordered) {
      let view = this.enemies.get(enemy.id);
      if (!view) { view = this.createEnemy(enemy); this.enemies.set(enemy.id, view); }
      if (view.dyingAt !== null) continue;
      const travelled = Math.abs(enemy.x - view.lastX);
      view.lastX = enemy.x;
      view.sprite.x = enemy.x;
      view.sprite.y = GROUND;
      const living = snapshot.party?.players.filter(player => player.hp > 0);
      const aggroX = living?.length ? living.reduce((nearest, player) => Math.abs(player.x - enemy.x) < Math.abs(nearest.x - enemy.x) ? player : nearest).x : this.engine.playerX;
      view.sprite.setFlipX(enemy.x > aggroX);
      view.shadow.x = enemy.x;
      const stunned = enemy.kind !== 'tank' && enemy.stunUntil > this.engine.clock;
      const target = enemy.id === this.engine.targetId;
      const isBoss = enemy.kind === 'tank';
      const character = view.character;
      const height = characterVisualHeight(character);
      const frozen = !isBoss && (snapshot.freezeRemaining > 0 || (enemy.freezeUntil ?? 0) > this.engine.clock);
      const slowed = !isBoss && (enemy.slowUntil ?? 0) > this.engine.clock;
      const protectedByTank = enemy.state === 'alive' && !canTargetEnemy(this.engine.enemies, enemy, this.engine.playerX);
      const screenEnemyX = this.screenX(enemy.x);
      const onscreen = screenEnemyX > -70 && screenEnemyX < 1350;
      view.protectedLabel.setVisible(protectedByTank && onscreen).setPosition(Phaser.Math.Clamp(screenEnemyX, 95, 1185), GROUND - height - 18);
      if (view.action && this.visualClock >= view.action.until) view.action = null;
      const defaultKey = character.actions.move;
      const attackKey = character.actions.attack;
      const attackTiming = SPRITE_BY_KEY.get(attackKey);
      const attackActive = enemy.state === 'alive' || isBoss;
      const preparingAttack = attackActive && enemy.attackUntil > this.engine.clock;
      view.attackImpactStart = heldRecoveryStart(view.attackImpactStart, view.recoveryLastClock, this.visualClock, stunned || frozen);
      view.recoveryLastClock = this.visualClock;
      const impactAge = this.visualClock - view.attackImpactStart;
      const recoveringAttack = attackActive && impactAge >= 0 && impactAge < 260;
      if (preparingAttack && (enemy.attackKind === 'charge' || enemy.attackKind === 'ranged')) view.sprite.setFlipX((enemy.attackTargetX ?? this.engine.playerX) < (enemy.attackStartX ?? enemy.x));
      else if (recoveringAttack) view.sprite.setFlipX(view.attackDirection < 0);
      if (view.action?.key === attackKey && !preparingAttack && !recoveringAttack) view.action = null;
      const action = view.action;
      // Advance only for genuine locomotion. Knockback, attacks and stun must not spin the feet.
      if ((snapshot.phase === 'playing' || snapshot.party) && (enemy.state === 'alive' || isBoss) && !action && !stunned && !frozen && !preparingAttack && !recoveringAttack) {
        view.gaitPhase = (view.gaitPhase + travelled / GAIT_STRIDE[enemy.kind]) % 1;
      }
      if (!frozen) view.freezeFrame = null;
      else if (view.freezeFrame === null) view.freezeFrame = { key: view.sprite.texture.key, frame: Number(view.sprite.frame.name) || 0 };
      const holdingHurt = stunned && view.staggerDuration > 0 && action?.key === character.actions.hurt;
      const windupDuration = view.attackDuration;
      const windup = Phaser.Math.Clamp(1 - (enemy.attackUntil - this.engine.clock) / windupDuration, 0, 1);
      if (frozen && view.freezeFrame) this.setSpritePose(view.sprite, view.freezeFrame.key, view.freezeFrame.frame, character);
      else if (holdingHurt) {
        const hurtKey = character.actions.hurt;
        const hurtProgress = Phaser.Math.Clamp((this.engine.clock - view.staggerStart) / Math.max(1, view.staggerDuration), 0, 1);
        this.paintSprite(view.sprite, hurtKey, hurtProgress * animationDuration(hurtKey), character);
      }
      else if (recoveringAttack && !stunned) this.setSpritePose(view.sprite, attackKey, attackRecoveryFrame(impactAge, 260, attackTiming), character);
      else if (preparingAttack && !stunned) this.setSpritePose(view.sprite, attackKey, attackAnticipationFrame(windup, attackTiming), character);
      else this.paintSprite(view.sprite, action?.key ?? defaultKey, action ? this.actionElapsed(action) : view.gaitPhase * animationDuration(defaultKey), character);
      view.sprite.setTint(stunned || view.flashUntil > this.visualClock ? 0xffe1b0 : frozen ? 0xc6f2fa : slowed ? 0xe5d5ad : isBoss ? bossPhaseTint(enemy.bossPhase) : 0xffffff);
      const baseScale = character.displayScale;
      const staggerProgress = (this.engine.clock - view.staggerStart) / Math.max(1, view.staggerDuration);
      const recoil = !isBoss && stunned && !this.options.reducedMotion ? Math.sin(Math.min(1, staggerProgress * 4) * Math.PI / 2) * (1 - Math.max(0, staggerProgress - 0.7) / 0.3) : 0;
      const outward = enemy.x >= (enemy.attackTargetX ?? aggroX) ? 1 : -1;
      view.sprite.x += view.staggerDirection * recoil * 4;
      view.sprite.setScale(baseScale * (1 + recoil * 0.035), baseScale * (1 - recoil * 0.025)).setAngle(view.staggerDirection * recoil * 2.5);
      if (!stunned && !frozen && !this.options.reducedMotion) {
        if (recoveringAttack) {
          const settle = (1 - impactAge / 260) ** 2;
          view.sprite.x = Phaser.Math.Linear(view.attackOrigin, enemy.x, 1 - settle);
          view.sprite.x += view.attackDirection * settle * (isBoss ? 5 : enemy.kind === 'runner' ? 18 : 12);
          view.shadow.x = view.sprite.x;
          view.sprite.setScale(baseScale * (1 + settle * (isBoss ? 0.11 : 0.05)), baseScale * (1 - settle * (isBoss ? 0.12 : 0.04)));
          view.sprite.setAngle(isBoss ? 0 : view.attackDirection * settle * 9);
        } else if (preparingAttack) {
          const lift = Math.sin(windup * Math.PI / 2);
          view.sprite.x += outward * (isBoss ? 2 : 5) * lift;
          view.sprite.y -= isBoss ? lift * 8 : 0;
          view.sprite.setAngle(outward * lift * (isBoss ? 3 : 7));
          view.sprite.setScale(baseScale * (1 - lift * 0.025), baseScale * (1 + lift * 0.035));
        }
      }
      // Recoil changes the drawn sprite only; simulation, callouts and boss motion stay stable.
      view.sprite.setAlpha(protectedByTank ? 0.66 : enemy.state === 'resolving' ? 0.85 : 1);
      view.label.setVisible(enemy.state === 'alive' && (onscreen || target));
      const word = enemy.challenge.word;
      const visibleHint = target ? snapshot.target?.hint ?? ''
        : enemy.challenge.kind === 'hint' || enemy.challenge.kind === 'translate' ? enemy.challenge.hint : '';
      const owner = snapshot.party?.players.find(player => player.id !== snapshot.party!.selfId && player.hp > 0 && player.connected !== false && player.targetId === enemy.id);
      if (owner) view.protectedLabel.setVisible(onscreen).setText(`${partyName(owner)} đang khóa`).setColor(`#${partyColor(snapshot.party!.players, owner.id).toString(16).padStart(6, '0')}`);
      else view.protectedLabel.setText('Được khiên che chắn').setColor('#b8def3');
      const content = `${enemy.challenge.prompt}|${visibleHint}|${word.meaning}|${word.partOfSpeech}|${enemy.hp}|${target}|${enemy.bossPhase}|${enemy.role}|${owner?.id}`;
      if (content !== view.lastText) {
        view.lastText = content;
        const role = enemy.role === 'shield' ? 'HỘ VỆ' : enemy.role === 'ranged' ? 'XẠ THỦ' : enemy.role === 'summoner' ? 'TRIỆU HỒI' : '';
        view.descriptor.setText(`${PART_OF_SPEECH_LABELS[word.partOfSpeech]}${role ? ` · ${role}` : ''}${enemy.kind === 'armored' ? ` · GIÁP ${enemy.hp}/${enemy.maxHp}` : isBoss ? ` · PHASE ${enemy.bossPhase}` : ''}`);
        const isMeaningPrompt = enemy.challenge.prompt.trim().toLocaleLowerCase('vi') === word.meaning.trim().toLocaleLowerCase('vi');
        // Above-head labels stay compact; the selected dock retains the full dictionary definition.
        const shortMeaning = word.meaning.length > 46 ? `${word.meaning.slice(0, 43).replace(/\s+\S*$/, '')}…` : word.meaning;
        let prompt = enemy.challenge.prompt.replace(/\s*\/\s*/g, word.answer.length > 10 ? '' : ' · ');
        if (word.answer.length > 12 && enemy.challenge.kind === 'missing') prompt = prompt.replace(/ /g, '');
        view.prompt.setFontSize(isMeaningPrompt || word.answer.length > 12 ? 16 : 19);
        view.prompt.setText(isMeaningPrompt ? shortMeaning : prompt);
        view.meaning.setText(isMeaningPrompt ? '' : shortMeaning);
        view.hint.setText(word.answer.length > 12 ? visibleHint.replace(/ /g, '') : visibleHint);
        view.prompt.y = isMeaningPrompt ? -5 : -20;
        view.meaning.y = 12;
        view.hint.y = isMeaningPrompt ? 28 : 35;
        view.plate.setStrokeStyle(target || owner ? 2 : 1, target ? 0xf6c372 : owner ? partyColor(snapshot.party!.players, owner.id) : KIND_COLORS[enemy.kind], target || owner ? 1 : 0.5);
        view.descriptor.setColor(target ? '#f6c372' : '#a5b8bd');
      }
      if (isBoss || enemy.role === 'shield' && enemy.hp > 1) this.drawTankShield(enemy, character);
      else if (protectedByTank) this.drawProtectedShield(enemy, character);
      const preparingSlam = isBoss && enemy.attackUntil > this.engine.clock;
      view.slamLabel.setVisible(false);
      if (preparingSlam) {
        const duration = view.attackDuration;
        const remaining = enemy.attackUntil - this.engine.clock;
        if (!this.tacticalEffects) this.drawSlamTelegraph(enemy, Phaser.Math.Clamp(1 - remaining / duration, 0, 1));
        view.slamLabel.setText(enemy.attackKind === 'charge' ? 'XUNG PHONG · RA NGOÀI LÀN' : 'ĐẬP ĐẤT · VÙNG ĐÃ KHÓA');
        view.slamLabel.setVisible(onscreen && (remaining > duration - 450 || remaining < 280)).setX(Phaser.Math.Clamp(this.screenX(enemy.attackTargetX ?? enemy.x), 160, 1120));
      }
      if (!onscreen && !target) continue;
      if (!onscreen && target) {
        this.offscreenTarget.setVisible(true).setX(screenEnemyX < 0 ? 151 : 1129).setText(screenEnemyX < 0 ? '← Mục tiêu ở bên trái' : 'Mục tiêu ở bên phải →');
      }
      labelRequests.push({ id: enemy.id, width: view.labelWidth, desiredX: screenEnemyX, boss: isBoss, selected: target });
      if (target) {
        this.reticle.lineStyle(2, 0xf6c372, 1);
        this.reticle.strokeEllipse(enemy.x, GROUND + 7, isBoss ? 165 : 85, 21);
        this.reticle.fillStyle(0xf6c372, 1);
        this.reticle.fillTriangle(enemy.x - 6, GROUND + 34, enemy.x + 6, GROUND + 34, enemy.x, GROUND + 24);
        this.reticle.fillStyle(0xf6c372, 0.13);
        this.reticle.fillEllipse(enemy.x, GROUND + 7, isBoss ? 165 : 85, 21);
      }
      if (stunned) {
        this.reticle.lineStyle(2, 0xffddb0, 0.8);
        this.reticle.lineBetween(enemy.x - 14, GROUND - height - 4, enemy.x - 9, GROUND - height - 11);
        this.reticle.lineBetween(enemy.x + 8, GROUND - height - 8, enemy.x + 13, GROUND - height - 3);
      }
    }
    this.prepareWorldLabels(snapshot, labelRequests);
    const included = labelRequests.sort((a, b) => Number(b.selected) - Number(a.selected) || Number(b.boss) - Number(a.boss)).slice(0, 6);
    const labelIds = new Set(included.map(request => request.id));
    for (const [id, view] of this.enemies) if (!labelIds.has(id)) view.label.setVisible(false);
    for (const placement of layoutEnemyLabels(included, !!snapshot.boss)) {
      if (placement.id < 0) {
        this.worldViews.get(-placement.id)?.label.setPosition(placement.x, placement.y);
        const object = this.engine.worldObjects?.find(candidate => candidate.id === -placement.id);
        if (object) this.lines.lineStyle(2, 0xf6c372, .7).lineBetween(placement.x, placement.y + 53, this.screenX(object.x), GROUND - 48);
        continue;
      }
      const view = this.enemies.get(placement.id)!;
      const enemy = this.engine.enemies.find(candidate => candidate.id === placement.id)!;
      view.label.setPosition(placement.x, placement.y);
      if (enemy.state === 'alive') {
        const target = enemy.id === this.engine.targetId;
        this.lines.lineStyle(target ? 2 : 1, target ? 0xf6c372 : 0x9ab0b6, target ? 0.65 : 0.22);
        this.lines.beginPath(); this.lines.moveTo(placement.x, placement.y + 53);
        this.lines.lineTo(Phaser.Math.Clamp(this.screenX(enemy.x), 12, 1268), GROUND - characterVisualHeight(view.character) - 4);
        this.lines.strokePath();
      }
    }
  }

  private createWorldView(object: WorldObject): WorldView {
    const width = 238;
    const plate = this.add.rectangle(0, 0, width, 106, 0x12252f, .97).setStrokeStyle(2, 0xf6c372, .9);
    const descriptor = this.add.text(-width / 2 + 13, -43, '', { fontFamily: FONT, fontSize: '11px', color: '#f6c372', resolution: 2 });
    const prompt = this.add.text(0, -20, '', { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#f4f1df', align: 'center', wordWrap: { width: width - 24 }, resolution: 2 }).setOrigin(.5);
    const meaning = this.add.text(0, 12, '', { fontFamily: FONT, fontSize: '13px', color: '#d1ded2', align: 'center', wordWrap: { width: width - 24 }, resolution: 2 }).setOrigin(.5);
    const hint = this.add.text(0, 35, '', { fontFamily: FONT, fontSize: '12px', color: '#9ed6c2', resolution: 2 }).setOrigin(.5);
    const label = this.add.container(0, 292, [plate, descriptor, prompt, meaning, hint]).setDepth(20).setVisible(false);
    const caption = this.inWorld(this.add.text(object.x, GROUND + 34, '', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#d7e5ce', stroke: '#172b36', strokeThickness: 4, resolution: 2 }).setOrigin(.5).setDepth(21));
    return { label, plate, descriptor, prompt, meaning, hint, caption, lastText: '' };
  }

  private prepareWorldLabels(snapshot: Snapshot, requests: EnemyLabelRequest[]): void {
    const objects = this.engine.worldObjects ?? [];
    for (const [id, view] of this.worldViews) if (!objects.some(object => object.id === id)) {
      view.label.destroy(true); view.caption.destroy(); this.worldViews.delete(id);
    }
    for (const object of objects) {
      let view = this.worldViews.get(object.id);
      if (!view) { view = this.createWorldView(object); this.worldViews.set(object.id, view); }
      const selected = snapshot.target?.worldObjectId === object.id && snapshot.target.kind === 'barrel';
      const sx = this.screenX(object.x), nearby = snapshot.world?.nearby?.id === object.id;
      const usable = object.kind !== 'barrel' || object.state !== 'used';
      view.caption.setVisible(sx > 0 && sx < 1280 && !selected && usable);
      const name = object.kind === 'barrel' ? (object.state === 'active' ? 'Thùng nổ · Tab để chọn' : 'Thùng nổ · chưa sẵn sàng') : object.kind === 'gate' ? (object.state === 'closed' ? 'Cổng đóng' : 'Cổng mở') : `Trạm hồi phục · ${object.charges} lượt`;
      view.caption.setText(`${name}${nearby && object.kind === 'gate' ? ' · Enter' : ''}`);
      view.label.setVisible(selected);
      if (!selected || !snapshot.target) continue;
      const target = snapshot.target;
      const isMeaning = target.prompt.trim().toLocaleLowerCase('vi') === target.meaning.trim().toLocaleLowerCase('vi');
      const shortMeaning = target.meaning.length > 46 ? `${target.meaning.slice(0, 43).replace(/\s+\S*$/, '')}…` : target.meaning;
      view.descriptor.setText(`${PART_OF_SPEECH_LABELS[target.partOfSpeech]} · THÙNG NỔ`);
      view.prompt.setText(isMeaning ? shortMeaning : target.prompt);
      view.prompt.setFontSize(isMeaning || target.length > 12 ? 16 : 19);
      view.meaning.setText(isMeaning ? '' : shortMeaning);
      view.hint.setText(target.hint);
      requests.push({ id: -object.id, width: 238, desiredX: sx, boss: false, selected: true });
    }
  }

  private renderTactics(snapshot: Snapshot): void {
    const telegraphs: TelegraphVisual[] = [];
    const roles: RoleVisual[] = [];
    for (const enemy of this.engine.enemies) {
      if (enemy.state !== 'alive') continue;
      const view = this.enemies.get(enemy.id);
      roles.push({ x: enemy.x, role: enemy.role ?? 'melee', height: characterVisualHeight(view?.character ?? getEnemyCharacter(enemy.appearanceId, enemy.kind)), direction: enemy.x >= this.engine.playerX ? -1 : 1, formationId: enemy.formationId });
      const kind = enemy.attackKind ?? (enemy.kind === 'tank' ? 'slam' : 'melee');
      if (enemy.attackUntil <= this.engine.clock || kind === 'melee') continue;
      telegraphs.push({ kind, x: enemy.attackStartX ?? enemy.x, targetX: enemy.attackTargetX ?? enemy.x,
        from: enemy.attackStartX ?? enemy.x, to: enemy.attackTargetX ?? enemy.x,
        radius: kind === 'charge' ? CHARGE_RADIUS : kind === 'ranged' ? RANGED_RADIUS : BOSS_SLAM_RANGE,
        phase: enemy.bossPhase, progress: Phaser.Math.Clamp(1 - (enemy.attackUntil - this.engine.clock) / (view?.attackDuration ?? 1500), 0, 1) });
    }
    this.tacticalEffects?.render(this.visualClock, this.options.reducedMotion, snapshot.phase === 'menu' ? [] : this.engine.worldObjects ?? [],
      snapshot.phase === 'menu' ? [] : telegraphs, snapshot.phase === 'menu' ? [] : roles, this.cameraX, snapshot.target?.worldObjectId);
  }

  private handleEvent(event: GameEvent): void {
    const snapshot = this.engine.snapshot();
    const actor = event.playerId ? snapshot.party?.players.find(player => player.id === event.playerId) : undefined;
    const ownEvent = !snapshot.party || !event.playerId || event.playerId === snapshot.party.selfId;
    if (snapshot.party) this.allies?.record(event, snapshot.party.players, snapshot.party.selfId, this.engine.clock);
    const enemy = this.engine.enemies.find(item => item.id === event.enemyId);
    const view = event.enemyId !== undefined ? this.enemies.get(event.enemyId) : undefined;
    const x = event.x ?? enemy?.x ?? view?.lastX ?? this.engine.playerX;
    const cue = audioCueForEvent(event);
    const soundX = event.type === 'shot' ? event.sourceX ?? actor?.x ?? this.engine.playerX : x;
    if (cue) this.gameAudio?.play(cue, { pan: Phaser.Math.Clamp((soundX - this.engine.playerX) / 640, -0.7, 0.7), momentum: ownEvent ? snapshot.momentum?.level ?? 0 : 0 });
    if (event.type === 'shot') {
      const momentum = ownEvent ? snapshot.momentum?.level ?? 0 : 0;
      const firingCharacter = ownEvent ? this.heroCharacter : getHeroCharacter(event.heroId ?? actor?.heroId);
      const sourceX = event.sourceX ?? actor?.x ?? this.engine.playerX;
      const sign = x < sourceX ? -1 : 1;
      if (ownEvent && Math.abs(this.engine.playerX - this.lastPlayerX) <= 0.1) this.heroFacing = sign;
      const shootKey = firingCharacter.actions.attack;
      const shootAsset = SPRITE_BY_KEY.get(shootKey);
      const shootTiming = rangedShotTiming(shootAsset);
      if (ownEvent && this.visualClock - this.heroHurtStart >= 180) this.heroAction = this.action(shootKey, shootTiming.duration, shootTiming.offset);
      if (ownEvent) { this.heroShotFacing = sign; this.heroKickStart = this.visualClock; }
      const glyphStyle = { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: event.effective === false ? '#bdd1c4' : momentum >= 3 ? '#ffe197' : '#fff3be', stroke: '#1b3033', strokeThickness: 4, resolution: 2 };
      const origin = projectileOrigin(sourceX, GROUND, sign, firingCharacter.displayScale, shootAsset?.projectileOffset);
      const glyph = this.inWorld(this.add.text(origin.x, origin.y, event.glyph ?? '', glyphStyle).setOrigin(0.5).setDepth(18));
      const ghosts = [0.2, 0.09].map(alpha => this.inWorld(this.add.text(glyph.x, glyph.y, event.glyph ?? '', glyphStyle).setOrigin(0.5).setDepth(17).setAlpha(alpha)));
      const firedAt = event.firedAt ?? this.engine.clock;
      const targetCharacter = view?.character ?? getEnemyCharacter(enemy?.appearanceId, enemy?.kind ?? 'normal');
      const contact = event.worldObjectId !== undefined ? { x, y: GROUND - 26 } : characterHitPoint(x, GROUND, targetCharacter, -sign);
      this.letters.push({ heroId: firingCharacter.id, playerId: event.playerId, targetCharacter, object: glyph, ghosts, shotId: event.shotId, enemyId: event.enemyId ?? -1, worldObjectId: event.worldObjectId, momentum, start: firedAt, impactAt: event.impactAt ?? firedAt + (event.duration ?? 220), x0: glyph.x, y0: glyph.y, x1: contact.x, y1: contact.y, effective: event.effective !== false });
      this.addEffect('effects-letter-impact', glyph.x, glyph.y, 0.25, sign < 0);
    } else if (event.type === 'jam') {
      if (ownEvent) { this.heroAction = this.action(this.heroCharacter.actions.idle, 300, 0, true); this.float('CẠCH!', this.engine.playerX + (this.hero.flipX ? -80 : 80), GROUND - 95, '#ff9b88', 500); }
    } else if (event.type === 'hit' || event.type === 'world-hit') {
      // Resolve the matching projectile on the authoritative engine hit, never by animation callback.
      const shot = this.letters.find(letter => (!event.playerId || letter.playerId === event.playerId) && (event.shotId !== undefined ? letter.shotId === event.shotId : letter.enemyId === event.enemyId && letter.object.text === event.glyph));
      const character = shot?.targetCharacter ?? view?.character ?? getEnemyCharacter(enemy?.appearanceId, enemy?.kind ?? 'normal');
      const contact = event.worldObjectId !== undefined ? { x, y: GROUND - 26 } : characterHitPoint(x, GROUND, character, x > (shot?.x0 ?? actor?.x ?? this.engine.playerX) ? -1 : 1);
      if (shot) {
        shot.object.setPosition(contact.x, contact.y);
        this.destroyLetter(shot);
        this.letters = this.letters.filter(letter => letter !== shot);
      }
      const distance = shot ? Math.hypot(contact.x - shot.x0, contact.y - shot.y0) : 0;
      this.impacts.push({ x: contact.x, y: contact.y, start: this.visualClock, seed: event.shotId ?? 0, power: glyphScaleForDistance(distance, shot?.momentum ?? 0) });
      if (this.impacts.length > 32) this.impacts.shift();
      if (view) view.flashUntil = this.visualClock + 60;
      if (view && (enemy?.kind ?? view.lastKind) !== 'tank' && (event.duration ?? 0) > 0) {
        view.staggerStart = event.impactAt ?? this.engine.clock;
        view.staggerDuration = event.duration!;
        view.staggerDirection = x >= (shot?.x0 ?? actor?.x ?? this.engine.playerX) ? 1 : -1;
        view.action = this.action(view.character.actions.hurt, Math.max(1, (enemy?.stunUntil ?? this.engine.clock + event.duration!) - this.engine.clock));
      }
    } else if (event.type === 'enemy-death' || event.type === 'boss-defeat') {
      if (view) {
        this.beginDeath(view);
        if (!this.options.reducedMotion) this.addEffect('effects-ground-dust', x, GROUND - 7, characterVisualHeight(view.character) / 90);
      }
      this.float(event.type === 'boss-defeat' ? 'BOSS ĐÃ HẠ!' : 'CHÍNH XÁC!', x, GROUND - (event.type === 'boss-defeat' ? 205 : 130), '#a9ead2', 800);
      if (event.type === 'boss-defeat') this.heroAction = this.action(this.heroCharacter.actions.idle);
    } else if (event.type === 'armor-break') {
      if (view?.lastKind === 'tank') this.reactToBossLayer(view, event.type);
      else if (view) view.action = this.action(view.character.actions.hurt);
      this.float(view?.lastKind === 'tank' ? 'PHÁ LỚP' : 'VỠ GIÁP', x, GROUND - 155, '#c4c5f6', 650);
    } else if (event.type === 'player-hurt') {
      if (ownEvent) { this.heroAction = this.action(this.heroCharacter.actions.hurt, undefined, 0, true); this.shakeStart = this.visualClock; this.heroHurtStart = this.visualClock; this.heroHurtDirection = (event.x ?? this.engine.playerX) >= (event.sourceX ?? this.engine.playerX - 1) ? 1 : -1; }
      this.attackEffects.recordContact(event, this.visualClock, characterHitPoint(event.x ?? actor?.x ?? this.engine.playerX, GROUND, ownEvent ? this.heroCharacter : getHeroCharacter(actor?.heroId), this.heroFacing));
      this.float(event.damage !== undefined ? `−${event.damage} HP` : '− HP', event.x ?? this.engine.playerX, GROUND - 150, '#ff9c8e', 650);
    } else if (event.type === 'boss-phase') {
      if (view) this.reactToBossLayer(view, event.type);
      this.float('CUỒNG NỘ!', x, GROUND - 240, '#ffa58d', 900);
    } else if (event.type === 'hero-skill') {
      const character = getHeroCharacter(event.heroId ?? this.heroCharacter.id);
      const skill = getHeroSkill(character.id);
      const targets = event.targets?.map(target => {
        const actor = this.engine.enemies.find(candidate => candidate.id === target.enemyId);
        const targetCharacter = this.enemies.get(target.enemyId)?.character
          ?? this.letters.find(letter => letter.enemyId === target.enemyId)?.targetCharacter
          ?? getEnemyCharacter(actor?.appearanceId, actor?.kind ?? 'normal');
        const point = characterHitPoint(target.x, GROUND, targetCharacter, target.x > x ? -1 : 1);
        return { enemyId: target.enemyId, x: point.x, y: point.y };
      });
      this.heroAttackEffects.emitSkill({
        heroId: character.id, x, y: GROUND, at: this.visualClock, id: ++this.skillSequence,
        direction: (event.targetX ?? x + this.heroFacing) >= x ? 1 : -1,
        height: characterVisualHeight(character), visualKind: event.visualKind ?? skill.visualKind,
        targetX: event.targetX, radius: event.radius, duration: event.duration, targets,
      });
      this.float(event.skillPhase === 'block' ? 'CHẶN ĐÒN!' : skill.name, x, GROUND - characterVisualHeight(character) - 22, skill.color, 850);
    } else if (event.type === 'attack') {
      if (view) {
        view.attackDuration = event.duration ?? 500;
        view.action = this.action(view.character.actions.attack, view.attackDuration);
      }
      if (view?.lastKind === 'tank') this.float('CẨN THẬN!', x, GROUND - 235, '#ffa58d', 550);
    } else if (event.type === 'attack-impact') {
      const heroContact = characterHitPoint(event.targetX ?? this.engine.playerX, GROUND, ownEvent ? this.heroCharacter : getHeroCharacter(actor?.heroId), this.heroFacing);
      this.attackEffects.record(snapshot.party || event.attackKind ? { ...event, hit: false } : event, this.visualClock, heroContact);
      if (view) {
        view.attackImpactStart = this.visualClock;
        view.recoveryLastClock = this.visualClock;
        view.attackOrigin = event.attackKind === 'charge' ? enemy?.x ?? x : x;
        view.attackDirection = (event.targetX ?? this.engine.playerX) >= x ? 1 : -1;
        const attackKey = view.character.actions.attack;
        view.action = this.action(attackKey, 260);
        this.setSpritePose(view.sprite, attackKey, attackContactFrame(SPRITE_BY_KEY.get(attackKey)), view.character);
      }
      if (event.enemyKind === 'tank' && !snapshot.party) {
        this.slamShakeStrength = Phaser.Math.Clamp(1 - Math.abs(x - this.engine.playerX) / 800, 0, 1);
        this.slamShakeStart = this.visualClock;
      }
    } else if (event.type === 'world-explosion') {
      this.tacticalEffects?.emit('explosion', x, this.visualClock, event.radius ?? 220);
      this.gameAudio?.play('boss-slam');
      this.float('THÙNG NỔ!', x, GROUND - 85, '#ffcb8d', 700);
    } else if (event.type === 'world-interact') {
      this.tacticalEffects?.emit(event.worldKind === 'healing-zone' ? 'heal' : 'gate', x, this.visualClock, event.radius ?? 80);
      this.gameAudio?.play('pickup');
    } else if (event.type === 'formation') {
      this.tacticalEffects?.emit('summon', x, this.visualClock, 75);
    } else if (event.type === 'momentum') {
      if ((event.value ?? 0) > 0) { this.float(`HOÀN HẢO · NHỊP ${event.value}`, actor?.x ?? this.engine.playerX, GROUND - characterVisualHeight(getHeroCharacter(actor?.heroId ?? this.heroCharacter.id)) - 20, '#ffe19d', 850); this.gameAudio?.play('skill'); }
    } else if (event.type === 'game-over') {
      this.heroAction = this.action(this.heroCharacter.actions.death, undefined, 0, true, true);
    } else if (event.type === 'vocabulary-complete') {
      this.heroAction = this.action(this.heroCharacter.actions.idle);
    } else if (event.type === 'pickup') {
      if (event.item) this.addPickup(event.item, x);
    }
  }

  private renderLetters(): void {
    this.bulletFx.clear();
    this.letters = this.letters.filter(letter => {
      const p = Phaser.Math.Clamp((this.engine.clock - letter.start) / Math.max(1, letter.impactAt - letter.start), 0, 1);
      const object = letter.worldObjectId !== undefined ? this.engine.worldObjects?.find(candidate => candidate.id === letter.worldObjectId) : undefined;
      const target = letter.worldObjectId === undefined ? this.engine.enemies.find(enemy => enemy.id === letter.enemyId) : undefined;
      if (object) { letter.x1 = object.x; letter.y1 = GROUND - 26; }
      if (target) {
        const contact = characterHitPoint(target.x, GROUND, letter.targetCharacter, target.x > letter.x0 ? -1 : 1);
        letter.x1 = contact.x;
        letter.y1 = contact.y;
      }
      if (p >= 1) { this.destroyLetter(letter); return false; }
      const point = flightPoint(letter, p, this.options.reducedMotion);
      const scale = glyphScaleForDistance(Math.hypot(point.x - letter.x0, point.y - letter.y0), letter.momentum ?? 0);
      letter.object.setPosition(point.x, point.y).setScale(scale);
      for (let index = 0; index < letter.ghosts.length; index++) {
        const ghost = letter.ghosts[index];
        ghost.setVisible(!this.options.reducedMotion && p > 0.05);
        if (this.options.reducedMotion) continue;
        const previous = flightPoint(letter, Math.max(0, p - (index + 1) * 0.065), false);
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const distance = Math.hypot(dx, dy) || 1;
        const tailLength = Math.min(distance, 15 + index * 11);
        ghost.setPosition(point.x - dx / distance * tailLength, point.y - dy / distance * tailLength).setScale(scale * (0.78 - index * 0.12));
      }
      this.heroAttackEffects.drawProjectile(this.bulletFx, {
        heroId: letter.heroId, from: { x: letter.x0, y: letter.y0 }, point,
        previous: flightPoint(letter, Math.max(0, p - 0.06), this.options.reducedMotion),
        target: { x: letter.x1, y: letter.y1 }, progress: p, scale, reducedMotion: this.options.reducedMotion,
      });
      return true;
    });
    this.heroAttackEffects.drawSkills(this.bulletFx, this.visualClock, this.options.reducedMotion);
  }

  private destroyLetter(letter: Letter): void {
    letter.object.destroy();
    for (const ghost of letter.ghosts) ghost.destroy();
  }

  private addPickup(item: ItemKind, x: number): void {
    if (this.pickups.length >= 6) {
      const oldest = this.pickups.shift()!;
      oldest.icon.destroy(); oldest.label.destroy();
    }
    const spawnX = Phaser.Math.Clamp(x, 58, WORLD_WIDTH - 58);
    const icon = this.add.image(this.screenX(spawnX), GROUND - 74, `item-${item}`).setDisplaySize(34, 34).setDepth(24);
    const label = this.add.text(this.screenX(spawnX), GROUND - 107, `+ ${ITEM_NAMES[item]}`, { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#c1f1d7', stroke: '#12252f', strokeThickness: 4, resolution: 2 }).setOrigin(0.5).setDepth(24);
    this.pickups.push({ icon, label, item, x: spawnX, y: GROUND - 74, start: this.visualClock });
  }

  private drawTankShield(enemy: Enemy, character: CharacterDefinition): void {
    const inward = this.engine.playerX >= enemy.x ? 1 : -1;
    const height = characterVisualHeight(character);
    const halfHeight = height * 0.42;
    const x = enemy.x + inward * Math.max(45, (character.bodyWidth ?? 16) * character.displayScale * 0.45);
    const y = GROUND - height * 0.5;
    this.shields.fillStyle(0x8ac5e8, 0.12).lineStyle(2, 0xb2dbef, 0.78);
    this.shields.beginPath();
    this.shields.moveTo(x - inward * 7, y - halfHeight);
    this.shields.lineTo(x + inward * 10, y - halfHeight * 0.75);
    this.shields.lineTo(x + inward * 18, y);
    this.shields.lineTo(x + inward * 10, y + halfHeight * 0.75);
    this.shields.lineTo(x - inward * 7, y + halfHeight);
    this.shields.closePath(); this.shields.fillPath(); this.shields.strokePath();
    for (const offset of [-halfHeight * 0.48, 0, halfHeight * 0.48]) {
      this.shields.lineStyle(1, 0xb7def2, 0.35).lineBetween(x - inward * 4, y + offset, x + inward * 13, y + offset);
    }
  }

  private drawProtectedShield(enemy: Enemy, character: CharacterDefinition): void {
    const x = enemy.x + (character.bodyWidth ?? 14) * character.displayScale * 0.4;
    const y = characterHitPoint(enemy.x, GROUND, character).y;
    this.shields.fillStyle(0x345c77, 0.8).lineStyle(1.5, 0xb2dbef, 0.85);
    this.shields.beginPath(); this.shields.moveTo(x - 7, y - 8);
    this.shields.lineTo(x + 7, y - 8); this.shields.lineTo(x + 6, y + 2);
    this.shields.lineTo(x, y + 8); this.shields.lineTo(x - 6, y + 2);
    this.shields.closePath(); this.shields.fillPath(); this.shields.strokePath();
  }

  private drawSlamTelegraph(enemy: Enemy, progress: number): void {
    const left = enemy.x - BOSS_SLAM_RANGE;
    const width = BOSS_SLAM_RANGE * 2;
    this.hazards.fillStyle(0xf38d65, 0.09 + progress * 0.1).fillEllipse(enemy.x, GROUND + 5, width, 28);
    this.hazards.lineStyle(1.5, 0xffbc83, 0.55 + progress * 0.3).strokeEllipse(enemy.x, GROUND + 5, width, 28);
    this.hazards.lineStyle(2, 0xffb477, 0.9);
    this.hazards.lineBetween(left, GROUND - 3, left, GROUND + 16);
    this.hazards.lineBetween(enemy.x + BOSS_SLAM_RANGE, GROUND - 3, enemy.x + BOSS_SLAM_RANGE, GROUND + 16);
    this.hazards.fillStyle(0xffbd83, 0.7).fillRect(left, GROUND + 20, width * progress, 2);
    const innerWidth = this.options.reducedMotion ? 90 : 90 + (1 - progress) * (width - 90);
    this.hazards.lineStyle(progress > 0.8 ? 3 : 2, 0xffddb0, 0.35 + progress * 0.5).strokeEllipse(enemy.x, GROUND + 5, innerWidth, 22);
    for (const side of [-1, 1]) {
      const edgeX = enemy.x + side * BOSS_SLAM_RANGE;
      this.hazards.fillStyle(0xffbd83, 0.5 + progress * 0.35);
      this.hazards.fillTriangle(edgeX, GROUND - 12, edgeX - side * 11, GROUND - 20, edgeX - side * 11, GROUND - 4);
    }
    for (let offset = 25; offset < width; offset += 50) {
      this.hazards.lineStyle(1, 0xffcaa1, 0.22).lineBetween(left + offset, GROUND + 1, left + offset + 9, GROUND + 8);
    }
  }

  private renderWorldEffects(snapshot: Snapshot): void {
    this.dizziness.clear();
    const inRun = snapshot.phase !== 'menu';
    const moving = snapshot.phase === 'playing' && !this.options.reducedMotion;
    const t = this.visualClock;
    const dizziness = lowHealthVisuals(inRun ? snapshot.hp : 100, t, moving);
    const severity = dizziness.severity;
    const shakeP = (t - this.shakeStart) / 190;
    const shake = moving && shakeP >= 0 && shakeP < 1 ? (1 - shakeP) ** 2 : 0;
    const slamP = (t - this.slamShakeStart) / 330;
    const slam = moving && slamP >= 0 && slamP < 1 ? (1 - slamP) ** 2 * this.slamShakeStrength : 0;
    const dx = dizziness.dx + Phaser.Math.Clamp(Math.sin((t - this.shakeStart) * 0.15) * shake * 6 + Math.sin(slamP * 48) * slam * 7, -10, 10);
    const dy = dizziness.dy + Phaser.Math.Clamp(Math.cos((t - this.shakeStart) * 0.19) * shake * 3.5 + Math.cos(slamP * 53) * slam * 6, -8, 8);
    const angle = dizziness.angle;
    // Rotate around the view centre while leaving callouts and DOM UI entirely still.
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    this.world.setPosition(640 - 640 * cos + 360 * sin + dx - this.cameraX * cos, 360 - 640 * sin - 360 * cos + dy - this.cameraX * sin).setRotation(angle);
    if (!severity) return;
    for (let band = 0; band < 12; band++) {
      const inset = band * 10;
      const alpha = dizziness.outerAlpha * (1 - band / 12) ** 2;
      this.dizziness.fillStyle(band < 5 ? 0x9a3342 : 0x170f20, alpha);
      this.dizziness.fillRect(inset, inset, 1280 - inset * 2, 10);
      this.dizziness.fillRect(inset, 720 - inset - 10, 1280 - inset * 2, 10);
      this.dizziness.fillRect(inset, inset + 10, 10, 720 - inset * 2 - 20);
      this.dizziness.fillRect(1280 - inset - 10, inset + 10, 10, 720 - inset * 2 - 20);
    }
  }

  private actionElapsed(action: Action): number {
    return actionElapsedMs(this.visualClock - action.start, animationDuration(action.key), action.until - action.start, action.offset);
  }

  private addEffect(key: string, x: number, y: number, scale = 1, flip = false): void {
    if (this.options.reducedMotion) return;
    const sprite = this.inWorld(this.add.sprite(x, y, key, 0).setScale(scale).setFlipX(flip).setDepth(17).setAlpha(this.options.reducedMotion ? 0.45 : 0.9));
    this.effects.push({ sprite, key, start: this.visualClock, duration: animationDuration(key) });
  }

  private float(value: string, x: number, y: number, color: string, duration: number): void {
    if (x < this.cameraX - 80 || x > this.cameraX + 1360) return;
    if (this.floats.length >= 24) this.floats.shift()!.text.destroy();
    const text = this.add.text(Phaser.Math.Clamp(this.screenX(x), 115, 1165), y, value, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color, stroke: '#10212a', strokeThickness: 4, resolution: 2 }).setOrigin(0.5).setDepth(23);
    this.floats.push({ text, start: this.visualClock, x, y, duration });
  }

  private renderEffects(): void {
    this.impactFx.clear();
    this.impacts = this.impacts.filter(impact => {
      const duration = this.options.reducedMotion ? 115 : 210;
      const p = (this.visualClock - impact.start) / duration;
      if (p >= 1) return false;
      const eased = 1 - (1 - p) * (1 - p);
      if (this.options.reducedMotion) {
        this.impactFx.fillStyle(0xffe7ad, (1 - p) * 0.9).fillRect(impact.x - 2, impact.y - 2, 4, 4);
        this.impactFx.lineStyle(1, 0xb5a0f2, 1 - p).lineBetween(impact.x - 6, impact.y + 5, impact.x + 6, impact.y - 5);
        return true;
      }
      const radius = (5 + eased * 10) * Math.min(1.5, impact.power);
      const seedAngle = (impact.seed % 11) * 0.23;
      // A small broken geometric seal and fine energy cracks: angular, readable, pixel-compatible.
      this.impactFx.lineStyle(1.3, 0x99edff, (1 - p) * 0.75);
      for (let index = 0; index < 6; index++) {
        const angle = seedAngle + index * Math.PI / 3;
        const next = angle + Math.PI / 3 * 0.68;
        this.impactFx.lineBetween(impact.x + Math.cos(angle) * radius, impact.y + Math.sin(angle) * radius, impact.x + Math.cos(next) * radius, impact.y + Math.sin(next) * radius);
      }
      this.impactFx.fillStyle(0xfff4de, Math.max(0, 1 - p * 4) * 0.95).fillRect(impact.x - 3, impact.y - 3, 6, 6);
      const palette = [0x99eaff, 0xb49aff, 0xffd38a];
      for (let index = 0; index < 6; index++) {
        const angle = seedAngle + index * Math.PI / 3;
        const travel = 7 + eased * (index % 2 ? 23 : 16) * Math.min(1.35, impact.power);
        const shardX = impact.x + Math.cos(angle) * travel;
        const shardY = impact.y + Math.sin(angle) * travel + p * p * 5;
        const tangentX = -Math.sin(angle) * 2;
        const tangentY = Math.cos(angle) * 2;
        this.impactFx.fillStyle(palette[index % 3], (1 - p) * 0.9);
        this.impactFx.fillTriangle(shardX + Math.cos(angle) * 4, shardY + Math.sin(angle) * 4, shardX + tangentX, shardY + tangentY, shardX - tangentX, shardY - tangentY);
        if (index % 2 === 0 && p < 0.65) {
          this.impactFx.lineStyle(1, palette[index % 3], (1 - p / 0.65) * 0.7);
          const bendX = impact.x + Math.cos(angle + 0.22) * radius * 0.6;
          const bendY = impact.y + Math.sin(angle + 0.22) * radius * 0.6;
          this.impactFx.lineBetween(impact.x, impact.y, bendX, bendY);
          this.impactFx.lineBetween(bendX, bendY, shardX, shardY);
        }
      }
      return true;
    });
    this.effects = this.effects.filter(effect => {
      const age = this.visualClock - effect.start;
      if (age >= effect.duration) { effect.sprite.destroy(); return false; }
      effect.sprite.setFrame(spriteFrame(effect.key, age));
      return true;
    });
    this.floats = this.floats.filter(floater => {
      const p = (this.visualClock - floater.start) / floater.duration;
      if (p >= 1) { floater.text.destroy(); return false; }
      floater.text.setPosition(Phaser.Math.Clamp(this.screenX(floater.x), 115, 1165), floater.y - (this.options.reducedMotion ? 0 : p * 24)).setAlpha(p > 0.65 ? (1 - p) / 0.35 : 1);
      return true;
    });
    this.pickups = this.pickups.filter(pickup => {
      const age = this.visualClock - pickup.start;
      if (age >= 1000) { pickup.icon.destroy(); pickup.label.destroy(); return false; }
      const pop = Math.min(1, age / 240);
      const travel = Math.max(0, Math.min(1, (age - 420) / 580));
      const eased = travel * travel * (3 - 2 * travel);
      const targetX = 68 + ITEM_INDEX[pickup.item] * 64;
      const startY = pickup.y - (this.options.reducedMotion ? 0 : (1 - (1 - pop) ** 3) * 24);
      pickup.icon.setPosition(
        this.options.reducedMotion ? this.screenX(pickup.x) : Phaser.Math.Linear(this.screenX(pickup.x), targetX, eased),
        this.options.reducedMotion ? pickup.y : Phaser.Math.Linear(startY, 652, eased),
      );
      pickup.icon.setScale((34 / 64) * (this.options.reducedMotion ? 1 : (0.8 + 0.2 * pop) * (1 - travel * 0.32)));
      pickup.icon.setAlpha(this.options.reducedMotion ? Math.min(1, (1000 - age) / 220) : 1);
      pickup.label.setPosition(Phaser.Math.Clamp(this.screenX(pickup.x), 100, 1180), pickup.y - 32 - (this.options.reducedMotion ? 0 : pop * 15)).setAlpha(Math.max(0, 1 - Math.max(0, age - 420) / 300));
      return true;
    });
  }

  private destroyEnemy(view: EnemyView): void {
    view.sprite.destroy(); view.shadow.destroy(); view.label.destroy(true); view.protectedLabel.destroy(); view.slamLabel.destroy();
  }
}

export async function createGame(parent: HTMLElement, engine: EnginePort, onSnapshot: (snapshot: Snapshot) => void, options: RenderOptions, onAudioState?: (state: AudioState) => void): Promise<{ game: Phaser.Game; setOptions: (options: RenderOptions) => void; nextTrack: () => void }> {
  const scene = new SurvivalScene(engine, onSnapshot, options, onAudioState);
  let game: Phaser.Game;
  const ready = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      game?.destroy(true);
      reject(new Error('Không thể khởi động cảnh game. Hãy tải lại trang.'));
    }, 45_000);
    scene.onPrepared = () => {
      window.clearTimeout(timeout);
      if (scene.loadErrors.length) {
        reject(new Error(`Không tải được asset: ${scene.loadErrors.join(', ')}. Hãy tải lại trang.`));
        game.destroy(true);
      } else resolve();
    };
  });
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#12212b',
    banner: false,
    pixelArt: true,
    roundPixels: true,
    autoFocus: false,
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
    scene: [scene],
    audio: { noAudio: true },
  });
  await ready;
  game.canvas.setAttribute('aria-hidden', 'true');
  return { game, setOptions: next => scene.setOptions(next), nextTrack: () => scene.nextTrack() };
}
