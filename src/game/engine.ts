import type {
  AttackImpactEvent, AttackTelegraphEvent, Challenge, ChallengeKind, Enemy, EnemyKind, EnginePort, GameEvent, HeroSkillEvent, ItemKind, Phase,
  Progress, RunSummary, Snapshot, Word, WordResult,
} from './types';
import { answersFor, createChallenge, lootChanceFor, WORDS } from './vocabulary';
import { cameraTarget, VIEW_WIDTH, WORLD_WIDTH } from './worldLayout';
import { WordDeck } from './wordDeck';
import { getEnemyCharacter, getEnemyCharacters, getHeroCharacter } from './characterCatalog';
import { getHeroSkill, type HeroSkillDefinition } from './heroSkills';
import { getLearningProgress, getWordLearningLevel } from './learningProgression';
export { WORLD_WIDTH } from './worldLayout';

export const PLAYER_X = 640;
export const PLAYER_SPEED = 160;
export const PLAYER_BOUNDS = { min: 240, max: WORLD_WIDTH - 240 };
export const BOSS_SLAM_RANGE = 300;
export const JAM_MS = 300;
export const STUN_MS: Record<EnemyKind, number> = { normal: 300, runner: 300, armored: 300, tank: 0 };
export const ENEMY_SPEED: Record<EnemyKind, number> = { normal: 14, runner: 33, armored: 10, tank: 7 };
const KINDS: ChallengeKind[] = ['scramble', 'missing', 'translate', 'hint'];
interface Projectile { shotId: number; enemyId: number; challengeId: number; index: number; firedAt: number; due: number; final: boolean; glyph: string; effective: boolean }

/** A nearer Tank shields everything farther away on its side, including other Tanks. */
export function canTargetEnemy(enemies: Enemy[], candidate: Enemy, playerX = PLAYER_X): boolean {
  return candidate.state === 'alive' && !enemies.some((enemy) => enemy.kind === 'tank'
    && enemy.id !== candidate.id && Math.sign(enemy.x - playerX) === Math.sign(candidate.x - playerX)
    && Math.abs(enemy.x - playerX) < Math.abs(candidate.x - playerX));
}

/** The single source of gameplay state. All durations advance on the simulation clock. */
export class GameEngine implements EnginePort {
  clock = 0;
  playerX = PLAYER_X;
  enemies: Enemy[] = [];
  targetId: number | null = null;
  private phase: Phase = 'menu';
  private movement: -1 | 0 | 1 = 0;
  private hp = 100;
  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private kills = 0;
  private words = 0;
  private bossKills = 0;
  private input = '';
  private jamUntil = 0;
  private countdown = 0;
  private freezeUntil = 0;
  private boostUntil = 0;
  private heroId = 'soldier';
  private heroCharge = 0;
  private heroActiveUntil = 0;
  private heroGuardUntil = 0;
  private heroWardUntil = 0;
  private nextSpawn = 0;
  private nextBoss = 90_000;
  private inventory: Record<ItemKind, number> = { health: 1, freeze: 1, damage: 1, shield: 1 };
  private notice = '';
  private noticeUntil = 0;
  private summary: RunSummary | null = null;
  private events: GameEvent[] = [];
  private projectiles: Projectile[] = [];
  private results = new Map<string, WordResult>();
  private bornAt = new Map<number, number>();
  private revealed = new Map<number, string>();
  private finalUntil = new Map<number, number>();
  private deck: WordDeck;
  private reservations = new Map<number, Word[]>();
  private lastSeenSource?: Progress['seenWords'];
  private lastResultsSource?: Progress['words'];
  private correctLetters = 0;
  private correctKeys = 0;
  private wrongKeys = 0;
  private enemySequence = 0;
  // Independent of gameplay RNG and retained across retries so every skin gets its turn.
  private appearanceSequence: Record<EnemyKind, number> = { normal: 0, runner: 0, armored: 0, tank: 0 };
  private challengeSequence = 0;
  private shotSequence = 0;
  private runSequence = 0;
  private lastPlayerHurt = -Infinity;

  constructor(private random: () => number = Math.random, progress?: Progress,
    private onWordSeen?: (word: Word) => void, bank: readonly Word[] = WORDS) {
    this.deck = new WordDeck(bank, random);
    if (progress) this.setProgress(progress);
  }

  /** Refresh persisted learning history before the next run without recreating the renderer. */
  setProgress(progress: Progress): void {
    // Progress snapshots are immutable; repeated references need no dictionary or history scan.
    if (progress.words !== this.lastResultsSource) {
      this.deck.addSeen(Object.keys(progress.words));
      this.lastResultsSource = progress.words;
    }
    if (progress.seenWords !== this.lastSeenSource) {
      this.deck.addSeen(Object.keys(progress.seenWords ?? {}));
      this.lastSeenSource = progress.seenWords;
    }
  }

  /** Hero selection is a menu action; switching mid-run cannot refresh or stack skill charges. */
  setHero(id?: string): void {
    if (this.phase !== 'menu' && this.phase !== 'over') return;
    const next = getHeroCharacter(id).id;
    if (next === this.heroId) return;
    this.heroId = next;
    this.resetHeroSkill();
  }

  private resetHeroSkill(): void {
    this.heroCharge = 0;
    this.heroActiveUntil = this.heroGuardUntil = this.heroWardUntil = 0;
  }

  start(mode: 'survival' | 'boss' = 'survival'): void {
    this.runSequence++;
    this.clock = 0;
    this.playerX = PLAYER_X;
    this.movement = 0;
    this.phase = 'playing';
    this.hp = 100;
    this.score = this.combo = this.bestCombo = this.kills = this.words = this.bossKills = 0;
    this.correctLetters = this.correctKeys = this.wrongKeys = 0;
    this.shotSequence = 0;
    this.input = '';
    this.resetHeroSkill();
    this.targetId = null;
    this.jamUntil = this.freezeUntil = this.boostUntil = this.countdown = 0;
    this.inventory = { health: 1, freeze: 1, damage: 1, shield: 1 };
    this.enemies = [];
    this.projectiles = [];
    this.events = [];
    this.results.clear();
    this.bornAt.clear();
    this.revealed.clear();
    this.finalUntil.clear();
    this.deck.clearReservations();
    this.reservations.clear();
    this.summary = null;
    this.lastPlayerHurt = -Infinity;
    this.nextSpawn = 6500;
    this.nextBoss = mode === 'boss' ? 180_000 : 90_000;
    const bossSpawned = mode === 'boss' && this.spawn('tank', 1);
    if (!bossSpawned) {
      this.spawn('normal', -1, 160);
      this.spawn('normal', 1, 1120);
    }
    this.selectUrgent();
    this.inform(bossSpawned ? 'Tập Boss dùng 9 từ dài; có thể cao hơn bậc hiện tại. Hoàn thành từ để phá giáp!'
      : mode === 'boss' ? 'Chưa đủ 9 từ dài mới cho Tank. Tiếp tục với zombie thường.'
        : 'Gõ trọn từ tiếng Anh. Tab để chọn mục tiêu.', 5500);
    this.checkVocabularyComplete();
  }

  step(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    let remaining = deltaMs;
    if (this.phase === 'countdown') {
      const elapsed = Math.min(remaining, this.countdown);
      this.countdown -= elapsed;
      remaining -= elapsed;
      if (this.countdown <= 0) this.phase = 'playing';
    }
    if (this.phase !== 'playing') return;
    // Fixed-size slices make collision, stun and telegraph timing independent of render FPS.
    while (remaining > 0 && this.phase === 'playing') {
      const slice = Math.min(10, remaining);
      this.tick(slice);
      remaining -= slice;
    }
  }

  private tick(delta: number): void {
    this.clock += delta;
    this.movePlayer(delta);
    this.resolveProjectiles();
    this.recycleDistantEnemies();
    for (const enemy of [...this.enemies]) {
      if (this.phase !== 'playing') return;
      if (enemy.kind === 'tank') this.updateBoss(enemy, delta);
      if (this.phase !== 'playing') return;
      const contact = enemy.kind === 'tank' ? 180 : 92;
      const distance = Math.abs(enemy.x - this.playerX);
      const side = enemy.x >= this.playerX ? 1 : -1;
      if (enemy.kind !== 'tank' && enemy.attackUntil && distance > contact + 8) enemy.attackUntil = 0;
      if (enemy.kind !== 'tank' && (enemy.state === 'resolving' || this.clock < enemy.stunUntil || this.clock < this.freezeUntil || this.clock < (enemy.freezeUntil ?? 0))) continue;
      const rageBoost = enemy.kind === 'tank' ? 1 + enemy.rage / 250 : 1;
      const slow = enemy.kind !== 'tank' && this.clock < (enemy.slowUntil ?? 0) ? enemy.slowFactor ?? 1 : 1;
      if (distance > contact) {
        enemy.x -= side * enemy.speed * rageBoost * slow * delta / 1000;
        if (Math.abs(enemy.x - this.playerX) < contact) enemy.x = this.playerX + side * contact;
      }
      if (enemy.kind !== 'tank' && enemy.state === 'alive' && Math.abs(enemy.x - this.playerX) <= contact && this.clock >= enemy.nextAttackAt) {
        if (!enemy.attackUntil) {
          enemy.attackUntil = this.clock + 500;
          this.events.push({ type: 'attack', enemyId: enemy.id, enemyKind: enemy.kind,
            x: enemy.x, targetX: this.playerX, duration: 500 } satisfies AttackTelegraphEvent);
        } else if (this.clock >= enemy.attackUntil) {
          const damage = this.hurt(enemy.kind === 'runner' ? 12 : enemy.kind === 'armored' ? 18 : 15, enemy);
          this.events.push({ type: 'attack-impact', enemyId: enemy.id, enemyKind: enemy.kind,
            x: enemy.x, targetX: this.playerX, hit: damage > 0, damage } satisfies AttackImpactEvent);
          enemy.x += side * 105;
          enemy.nextAttackAt = this.clock + 1800;
          enemy.attackUntil = 0;
        }
      }
    }
    if (this.phase !== 'playing') return;
    const boss = this.enemies.find((enemy) => enemy.kind === 'tank');
    if (!boss && this.clock >= this.nextBoss) {
      if (this.enemies.length <= 3) {
        // Survival Bosses wait for nine long words within the run's current or lower bands.
        if (this.spawn('tank', this.countSide(-1) > this.countSide(1) ? 1 : -1, undefined, false)) {
          this.nextBoss = Infinity;
          this.inform('CẢNH BÁO: Tank Bảo Hộ! Boss không khựng khi trúng chữ.', 5000);
        } else this.nextBoss = this.clock + 30_000;
      }
    }
    if (this.clock >= this.nextSpawn) {
      const cap = boss ? 3 : Math.min(6, 4 + Math.floor(this.words / 20));
      if (this.enemies.length < cap) {
        const roll = this.rand();
        const kind: EnemyKind = this.words >= 4 && roll > .82 ? 'armored' : this.words >= 2 && roll > .55 ? 'runner' : 'normal';
        const side: -1 | 1 = this.countSide(-1) < this.countSide(1) ? -1 : this.countSide(1) < this.countSide(-1) ? 1 : this.rand() < .5 ? -1 : 1;
        this.spawn(kind, side);
      }
      // Only spawn frequency ramps. Speed and visible-enemy caps stay bounded.
      this.nextSpawn = this.clock + Math.max(4000, 6500 - this.words * 35);
    }
    this.enforceTargetVisibility();
    if (!this.getTarget()) this.selectUrgent();
    this.checkVocabularyComplete();
  }

  setMovement(direction: -1 | 0 | 1): void {
    this.movement = this.phase === 'playing' ? direction : 0;
  }

  private movePlayer(delta: number): void {
    if (!this.movement) return;
    let next = Math.max(PLAYER_BOUNDS.min, Math.min(PLAYER_BOUNDS.max,
      this.playerX + this.movement * PLAYER_SPEED * delta / 1000));
    for (const enemy of this.enemies) {
      // A completed word is only a pending hit: the body stays solid until actual death.
      if (enemy.hp <= 0) continue;
      const radius = enemy.kind === 'tank' ? 180 : 92;
      if (this.movement > 0 && enemy.x >= this.playerX) {
        next = Math.min(next, Math.max(this.playerX, enemy.x - radius));
      } else if (this.movement < 0 && enemy.x <= this.playerX) {
        next = Math.max(next, Math.min(this.playerX, enemy.x + radius));
      }
    }
    this.playerX = next;
  }

  private flankPosition(side: -1 | 1, distance: number): number {
    const viewLeft = cameraTarget(this.playerX);
    const desired = this.playerX + side * distance;
    // At a world boundary the player is off-center; use the camera edge to avoid visible pop-in.
    const outsideView = side < 0 ? Math.min(desired, viewLeft - 60)
      : Math.max(desired, viewLeft + VIEW_WIDTH + 60);
    return Math.max(-60, Math.min(WORLD_WIDTH + 60, outsideView));
  }

  private recycleDistantEnemies(): void {
    const viewLeft = cameraTarget(this.playerX);
    const viewRight = viewLeft + VIEW_WIDTH;
    for (const enemy of this.enemies) {
      if (enemy.kind === 'tank' || Math.abs(enemy.x - this.playerX) <= 1100) continue;
      if (enemy.x >= viewLeft - 100 && enemy.x <= viewRight + 100) continue;
      if (enemy.id === this.targetId && this.input.length > 0) continue;
      if (this.projectiles.some((shot) => shot.enemyId === enemy.id)) continue;
      const side = enemy.x >= this.playerX ? 1 : -1;
      enemy.x = this.flankPosition(side, 760);
    }
  }

  typeKey(rawKey: string): void {
    if (this.phase !== 'playing') return;
    this.enforceTargetVisibility();
    if (rawKey === 'Backspace') {
      this.input = this.input.slice(0, -1);
      return;
    }
    if (!/^[a-z]$/i.test(rawKey) || this.clock < this.jamUntil) return;
    const target = this.getTarget();
    if (!target) return;
    const key = rawKey.toLowerCase();
    const next = this.input + key;
    const possibilities = answersFor(target.challenge.word).filter((answer) => answer.startsWith(next));
    if (!possibilities.length) {
      this.wrongKeys++;
      target.challenge.mistakes++;
      this.resultFor(target.challenge.word).mistakes++;
      this.combo = 0;
      this.jamUntil = this.clock + JAM_MS;
      if (target.kind === 'tank') target.rage = Math.min(100, target.rage + 6);
      this.events.push({ type: 'jam', enemyId: target.id, glyph: key, duration: JAM_MS });
      this.inform('Kẹt đạn! Giữ bình tĩnh, phần đúng vẫn còn.', 1300);
      return;
    }
    this.input = next;
    this.correctKeys++;
    const index = next.length - 1;
    const effective = !target.challenge.credited.has(index);
    const shotId = ++this.shotSequence;
    const final = possibilities.includes(next);
    const baseDuration = Math.round(160 + Math.abs(target.x - this.playerX) / 5);
    // The finisher resolves after every earlier letter, even while the target is approaching.
    const finalDue = Math.max(this.clock + baseDuration, ...this.projectiles
      .filter((shot) => shot.enemyId === target.id && shot.challengeId === target.challenge.id).map((shot) => shot.due));
    const duration = final ? finalDue - this.clock : baseDuration;
    if (effective) {
      target.challenge.credited.add(index);
      this.correctLetters++;
      this.projectiles.push({ shotId, enemyId: target.id, challengeId: target.challenge.id, index,
        firedAt: this.clock, due: this.clock + duration, final, glyph: key, effective: true });
    }
    this.events.push({ type: 'shot', shotId, challengeId: target.challenge.id, enemyId: target.id,
      x: target.x, glyph: key, duration, effective, firedAt: this.clock, impactAt: this.clock + duration });
    if (effective) this.chargeHeroSkill(target);
    if (final) {
      // A short alternative may finish on a position already credited by a longer alternative.
      if (!effective) this.projectiles.push({ shotId, enemyId: target.id, challengeId: target.challenge.id,
        index, firedAt: this.clock, due: this.clock + duration, final: true, glyph: key, effective: false });
      this.finishWord(target);
      target.state = 'resolving';
      this.input = '';
      this.targetId = null;
      this.selectUrgent();
    }
  }

  cycleTarget(direction = 1): void {
    if (this.phase !== 'playing') return;
    this.enforceTargetVisibility();
    if (this.input.length > 0) return;
    const alive = this.enemies.filter((enemy) => canTargetEnemy(this.enemies, enemy, this.playerX)).sort((left, right) => left.x - right.x);
    if (!alive.length) return;
    const previous = alive.findIndex((enemy) => enemy.id === this.targetId);
    this.targetId = alive[(previous + (direction < 0 ? -1 : 1) + alive.length) % alive.length].id;
  }

  private chargeHeroSkill(target: Enemy): void {
    if (this.phase !== 'playing') return;
    const skill = getHeroSkill(this.heroId);
    this.heroCharge++;
    if (this.heroCharge < skill.threshold) return;
    this.heroCharge -= skill.threshold;
    this.activateHeroSkill(skill, target);
  }

  /** Preserve attack warnings when a local skill extends an existing stun/freeze interval. */
  private blockEnemy(enemy: Enemy, kind: 'stun' | 'freeze', duration: number): void {
    const previous = Math.max(this.clock, this.freezeUntil, enemy.stunUntil, enemy.freezeUntil ?? 0);
    if (kind === 'stun') enemy.stunUntil = Math.max(enemy.stunUntil, this.clock + duration);
    else enemy.freezeUntil = Math.max(enemy.freezeUntil ?? 0, this.clock + duration);
    const next = Math.max(previous, enemy.stunUntil, enemy.freezeUntil ?? 0);
    this.holdAttack(enemy, next - previous);
  }

  /** Move outward without crossing another body, a shielding Boss, the player or world bounds. */
  private pushEnemies(enemies: Enemy[], distance: number): Enemy[] {
    const affected: Enemy[] = [];
    const ordered = [...enemies].sort((a, b) => Math.abs(b.x - this.playerX) - Math.abs(a.x - this.playerX));
    for (const enemy of ordered) {
      const side = Math.sign(enemy.x - this.playerX) || enemy.side;
      const away = Math.abs(enemy.x - this.playerX);
      let limit = side > 0 ? WORLD_WIDTH + 60 - enemy.x : enemy.x + 60;
      for (const other of this.enemies) {
        if (other.id === enemy.id || other.hp <= 0 || (Math.sign(other.x - this.playerX) || other.side) !== side) continue;
        const otherDistance = Math.abs(other.x - this.playerX);
        if (otherDistance >= away) limit = Math.min(limit, Math.max(0, otherDistance - away - 1));
      }
      const pushed = Math.max(0, Math.min(distance, limit));
      if (pushed <= 0) continue;
      enemy.x += side * pushed;
      affected.push(enemy);
    }
    return affected;
  }

  private activateHeroSkill(skill: HeroSkillDefinition, target: Enemy): void {
    // Read the live target before a finishing letter switches selection or kills its word.
    const targetX = target.x;
    const eligible = this.enemies.filter(enemy => enemy.kind !== 'tank' && canTargetEnemy(this.enemies, enemy, this.playerX));
    const effect = skill.effect;
    let affected: Enemy[] = [], duration = 500, radius = 0, value: number | undefined;
    switch (effect.kind) {
      case 'push-target':
        affected = this.pushEnemies(eligible.filter(enemy => enemy.id === target.id), effect.distance);
        break;
      case 'stun-area':
        radius = effect.radius; duration = effect.duration;
        affected = eligible.filter(enemy => Math.abs(enemy.x - targetX) <= radius);
        for (const enemy of affected) this.blockEnemy(enemy, 'stun', duration);
        break;
      case 'guard':
        duration = effect.duration;
        this.heroGuardUntil = this.clock + duration;
        break;
      case 'ward':
        duration = effect.duration;
        this.heroWardUntil = this.clock + duration;
        break;
      case 'push-line': {
        const side = Math.sign(targetX - this.playerX) || target.side;
        const reach = Math.abs(targetX - this.playerX);
        affected = this.pushEnemies(eligible.filter(enemy => (Math.sign(enemy.x - this.playerX) || enemy.side) === side
          && Math.abs(enemy.x - this.playerX) <= reach), effect.distance);
        break;
      }
      case 'heal':
        value = Math.min(effect.amount, 100 - this.hp);
        this.hp += value;
        break;
      case 'slow':
        duration = effect.duration;
        affected = eligible.filter(enemy => enemy.id === target.id);
        for (const enemy of affected) {
          enemy.slowUntil = Math.max(enemy.slowUntil ?? 0, this.clock + duration);
          enemy.slowFactor = effect.factor;
        }
        break;
      case 'repel':
        radius = effect.radius;
        affected = this.pushEnemies(eligible.filter(enemy => Math.abs(enemy.x - this.playerX) <= radius), effect.distance);
        break;
      case 'freeze-area':
        radius = effect.radius; duration = effect.duration;
        affected = eligible.filter(enemy => Math.abs(enemy.x - targetX) <= radius);
        for (const enemy of affected) this.blockEnemy(enemy, 'freeze', duration);
        break;
    }
    const defensive = effect.kind === 'guard' || effect.kind === 'ward' || effect.kind === 'heal';
    this.heroActiveUntil = defensive || affected.length ? this.clock + duration : 0;
    this.events.push({ type: 'hero-skill', heroId: this.heroId, skillId: skill.id, visualKind: skill.visualKind,
      x: this.playerX, targetX, radius, duration, targets: affected.map(enemy => ({ enemyId: enemy.id, x: enemy.x })),
      value, skillPhase: 'activate' } satisfies HeroSkillEvent);
  }

  pause(): void {
    if (this.phase === 'playing' || this.phase === 'countdown') { this.phase = 'paused'; this.countdown = 0; this.movement = 0; }
  }

  resume(): void {
    if (this.phase === 'paused') { this.phase = 'countdown'; this.countdown = 2000; }
  }

  toMenu(): void { this.phase = 'menu'; this.movement = 0; this.projectiles = []; this.events = []; this.resetHeroSkill(); }

  useItem(item: ItemKind): void {
    if (this.phase !== 'playing' || !this.inventory[item]) return;
    if (item === 'health') {
      if (this.hp >= 100) { this.inform('HP đang đầy. Túi cứu thương được giữ lại.'); return; }
      this.hp = Math.min(100, this.hp + 25);
      this.inform('+25 HP');
    } else if (item === 'freeze') {
      const previousFreeze = this.freezeUntil;
      this.freezeUntil = this.clock + 3000;
      for (const enemy of this.enemies) {
        if (enemy.kind === 'tank') continue;
        const previousBlock = Math.max(this.clock, previousFreeze, enemy.stunUntil, enemy.freezeUntil ?? 0);
        const extension = Math.max(previousBlock, this.freezeUntil) - previousBlock;
        // Preserve the remaining attack warning instead of striking instantly on thaw.
        this.holdAttack(enemy, extension);
      }
      this.inform('Đóng băng zombie 3 giây. Boss được miễn nhiễm.');
    } else if (item === 'damage') {
      this.boostUntil = this.clock + 6000;
      this.inform('Đạn mạnh: x2 sát thương mỗi từ trong 6 giây.');
    } else {
      const target = this.getTarget();
      if (!target) return;
      if (!target.challenge.assisted) {
        target.challenge.assisted = true;
        this.resultFor(target.challenge.word).assisted++;
      }
      const answer = answersFor(target.challenge.word).find((word) => word.startsWith(this.input))!;
      const distinguishing = target.challenge.word.translationHint?.split(' ');
      this.revealed.set(target.challenge.id, [...answer].map((letter, index) => index === 0 || index === answer.length - 1
        || index === this.input.length || distinguishing?.[index] === letter ? letter : '_').join(' '));
      this.inform('Đã hiện gợi ý. Lượt này được ghi là có hỗ trợ.');
    }
    this.inventory[item]--;
  }

  snapshot(): Snapshot {
    const target = this.getTarget();
    const boss = this.enemies.find((enemy) => enemy.kind === 'tank');
    const targetCharacter = target ? getEnemyCharacter(target.appearanceId, target.kind) : undefined;
    const bossCharacter = boss ? getEnemyCharacter(boss.appearanceId, boss.kind) : undefined;
    const heroSkill = getHeroSkill(this.heroId);
    return {
      phase: this.phase, hp: this.hp, playerX: this.playerX, score: this.score, combo: this.combo, bestCombo: this.bestCombo,
      kills: this.kills, words: this.words, elapsed: this.clock, input: this.input, locked: this.input.length > 0,
      jamRemaining: Math.max(0, this.jamUntil - this.clock), countdown: this.countdown, enemyCount: this.enemies.length,
      target: target ? { id: target.id, kind: target.kind, prompt: target.challenge.prompt,
        appearanceId: targetCharacter!.id, name: targetCharacter!.name, label: targetCharacter!.label,
        hint: this.revealed.get(target.challenge.id) ?? (target.challenge.kind === 'hint'
          || target.challenge.kind === 'translate' ? target.challenge.hint : ''),
        type: target.challenge.kind, length: target.challenge.word.answer.length,
        meaning: target.challenge.word.meaning, partOfSpeech: target.challenge.word.partOfSpeech,
        difficulty: target.challenge.word.difficulty, learningLevel: getWordLearningLevel(target.challenge.word) } : null,
      boss: boss ? { hp: boss.hp, maxHp: boss.maxHp, phase: boss.bossPhase, rage: boss.rage,
        appearanceId: bossCharacter!.id, name: bossCharacter!.name, label: bossCharacter!.label } : null,
      inventory: { ...this.inventory }, freezeRemaining: Math.max(0, this.freezeUntil - this.clock),
      boostRemaining: Math.max(0, this.boostUntil - this.clock),
      vocabulary: this.vocabularyAvailability(),
      learning: getLearningProgress(this.words),
      hero: { id: this.heroId, skillName: heroSkill.name, charge: this.heroCharge, threshold: heroSkill.threshold,
        activeRemaining: Math.max(0, this.heroActiveUntil - this.clock) },
      notice: this.clock < this.noticeUntil ? this.notice : '', summary: this.summary,
    };
  }

  drainEvents(): GameEvent[] { const events = this.events; this.events = []; return events; }

  private getTarget(): Enemy | undefined { return this.enemies.find((enemy) => enemy.id === this.targetId && canTargetEnemy(this.enemies, enemy, this.playerX)); }

  private enforceTargetVisibility(): void {
    const selected = this.enemies.find((enemy) => enemy.id === this.targetId && enemy.state === 'alive');
    if (!selected || canTargetEnemy(this.enemies, selected, this.playerX)) return;
    const blocker = this.enemies.filter((enemy) => enemy.kind === 'tank'
      && Math.sign(enemy.x - this.playerX) === Math.sign(selected.x - this.playerX)
      && Math.abs(enemy.x - this.playerX) < Math.abs(selected.x - this.playerX))
      .sort((a, b) => Math.abs(a.x - this.playerX) - Math.abs(b.x - this.playerX))[0];
    this.input = '';
    this.targetId = blocker && canTargetEnemy(this.enemies, blocker, this.playerX) ? blocker.id : null;
    if (!this.targetId) this.selectUrgent();
    this.inform('Mục tiêu được Tank che chắn. Hãy phá Tank trước!', 3000);
  }

  private selectUrgent(): void {
    if (this.input.length && this.getTarget()) return;
    const enemy = this.enemies.filter((entry) => canTargetEnemy(this.enemies, entry, this.playerX)).sort((a, b) => {
      const time = (entry: Enemy) => Math.max(0, Math.abs(entry.x - this.playerX) - (entry.kind === 'tank' ? 180 : 92)) / entry.speed;
      return time(a) - time(b);
    })[0];
    this.targetId = enemy?.id ?? null;
  }

  private rand(): number { return Math.max(0, Math.min(.999999, this.random())); }
  private countSide(side: -1 | 1): number { return this.enemies.filter((enemy) => (enemy.x >= this.playerX ? 1 : -1) === side).length; }

  private vocabularyAvailability(): { remaining: number; total: number; bossReady: boolean } {
    return { ...this.deck.availability };
  }

  private allocateWords(count: number, minimumLength = 1, allowHigherLevels = true): Word[] | undefined {
    return this.deck.reserve(count, minimumLength >= 7, getLearningProgress(this.words).level, allowHigherLevels);
  }

  private nextReservedWord(enemy: Enemy): Word | undefined {
    const words = this.reservations.get(enemy.id) ?? [];
    while (words.length) {
      const word = words.shift()!;
      if (this.deck.isUnseen(word)) return word;
      this.deck.release([word]);
    }
    // If external history invalidates a held layer, never silently replace it with a harder survival word.
    return this.allocateWords(1, enemy.kind === 'tank' ? 7 : 1, enemy.kind !== 'tank')?.[0];
  }

  private challenge(word: Word, forcedKind?: ChallengeKind): Challenge {
    const id = ++this.challengeSequence;
    const challenge = createChallenge(word, forcedKind ?? KINDS[(id - 1) % KINDS.length], id, this.random);
    this.deck.markShown(word);
    try { this.onWordSeen?.(word); }
    catch { this.inform('Chưa lưu được lịch sử từ. Phiên này vẫn không lặp từ.'); }
    this.bornAt.set(id, this.clock);
    this.resultFor(word).encounters++;
    return challenge;
  }

  private spawn(kind: EnemyKind, side: -1 | 1, x?: number, allowHigherLevels = true): boolean {
    if (this.countSide(side) >= 3) return false;
    let planned = this.allocateWords(kind === 'tank' ? 9 : kind === 'armored' ? 2 : 1, kind === 'tank' ? 7 : 1, allowHigherLevels);
    if (!planned && kind === 'armored') { kind = 'normal'; planned = this.allocateWords(1); }
    if (!planned) return false;
    const word = planned.shift()!;
    const hp = kind === 'tank' ? 9 : kind === 'armored' ? 2 : 1;
    const speed = ENEMY_SPEED[kind];
    const spawnX = this.flankPosition(side, 720);
    const appearances = getEnemyCharacters(kind);
    const appearanceId = appearances[this.appearanceSequence[kind] % appearances.length].id;
    const enemy: Enemy = { id: ++this.enemySequence, kind, side, x: x ?? spawnX, speed,
      appearanceId,
      hp, maxHp: hp, challenge: this.challenge(word), state: 'alive', stunUntil: 0, immuneUntil: 0,
      attackUntil: 0, nextAttackAt: this.clock + (kind === 'tank' ? 8000 : 0), bossPhase: 1, rage: 0 };
    this.enemies.push(enemy);
    this.appearanceSequence[kind]++;
    this.reservations.set(enemy.id, planned);
    if (kind === 'tank') this.events.push({ type: 'boss-warning', enemyId: enemy.id, x: enemy.x });
    return true;
  }

  private resultFor(word: Word): WordResult {
    let result = this.results.get(word.answer);
    if (!result) {
      result = { word: word.answer, meaning: word.meaning, encounters: 0, completed: 0, mistakes: 0, assisted: 0, totalResponseMs: 0 };
      this.results.set(word.answer, result);
    }
    return result;
  }

  private finishWord(enemy: Enemy): void {
    const challenge = enemy.challenge;
    const result = this.resultFor(challenge.word);
    result.completed++;
    result.totalResponseMs += Math.max(0, this.clock - (this.bornAt.get(challenge.id) ?? this.clock));
    this.words++;
    if (!challenge.mistakes) this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += 100 + Math.min(10, this.combo) * 10;
    if (enemy.kind === 'tank') enemy.rage = Math.max(0, enemy.rage - 8);
  }

  private resolveProjectiles(): void {
    const arrived = this.projectiles.filter((shot) => shot.due <= this.clock);
    this.projectiles = this.projectiles.filter((shot) => shot.due > this.clock);
    for (const shot of arrived) {
      const enemy = this.enemies.find((entry) => entry.id === shot.enemyId && entry.challenge.id === shot.challengeId);
      if (!enemy) continue;
      let appliedStun = 0;
      if (shot.effective && enemy.kind !== 'tank') {
        const previousBlock = Math.max(this.clock, enemy.stunUntil, this.freezeUntil, enemy.freezeUntil ?? 0);
        enemy.stunUntil = Math.max(enemy.stunUntil, this.clock + STUN_MS[enemy.kind]);
        enemy.immuneUntil = 0;
        appliedStun = STUN_MS[enemy.kind];
        this.holdAttack(enemy, Math.max(previousBlock, enemy.stunUntil) - previousBlock);
      }
      if (shot.effective) this.events.push({ type: 'hit', shotId: shot.shotId, challengeId: shot.challengeId,
        enemyId: enemy.id, x: enemy.x, glyph: shot.glyph, effective: true,
        duration: appliedStun, firedAt: shot.firedAt, impactAt: this.clock });
      if (!shot.final) continue;
      const damage = this.clock < this.boostUntil ? 2 : 1;
      // A boosted word may break two layers, but it may never skip the Boss Final Strike.
      enemy.hp = enemy.kind === 'tank' && enemy.hp > 1
        ? Math.max(1, enemy.hp - damage) : Math.max(0, enemy.hp - damage);
      if (!enemy.hp) { this.kill(enemy); continue; }
      const previousPhase = enemy.bossPhase;
      if (enemy.kind === 'tank') enemy.bossPhase = enemy.hp > 6 ? 1 : enemy.hp > 3 ? 2 : 3;
      const final = enemy.kind === 'tank' && enemy.hp === 1;
      const next = this.nextReservedWord(enemy);
      if (!next) {
        // A concurrent history refresh can invalidate reserved words. Retire without a fake kill or loot.
        this.enemies = this.enemies.filter((entry) => entry.id !== enemy.id);
        this.deck.release(this.reservations.get(enemy.id) ?? []);
        this.reservations.delete(enemy.id);
        this.bornAt.delete(enemy.challenge.id);
        this.revealed.delete(enemy.challenge.id);
        this.finalUntil.delete(enemy.id);
        if (this.targetId === enemy.id) { this.targetId = null; this.input = ''; }
        this.inform('Không còn từ mới phù hợp cho lớp giáp tiếp theo.');
        continue;
      }
      this.bornAt.delete(enemy.challenge.id);
      this.revealed.delete(enemy.challenge.id);
      enemy.challenge = this.challenge(next, final ? 'translate' : undefined);
      enemy.state = 'alive';
      this.events.push({ type: 'armor-break', enemyId: enemy.id, x: enemy.x });
      if (previousPhase !== enemy.bossPhase) {
        this.events.push({ type: 'boss-phase', enemyId: enemy.id, x: enemy.x });
        this.inform(`Tank chuyển phase ${enemy.bossPhase}! Quan sát đòn đập đất.`, 3500);
      }
      if (final) {
        this.finalUntil.set(enemy.id, this.clock + 16_000);
        this.inform('FINAL STRIKE · Hoàn thành từ mới trong 16 giây!', 7000);
      }
    }
  }

  private updateBoss(enemy: Enemy, delta: number): void {
    enemy.rage = Math.min(100, enemy.rage + delta * .0018);
    if (enemy.state === 'alive' && this.finalUntil.has(enemy.id) && this.clock >= this.finalUntil.get(enemy.id)!) {
      this.hurt(18, enemy);
      this.finalUntil.set(enemy.id, this.clock + 16_000);
      this.inform('Final Strike quá giờ! Boss phản công. Tiếp tục hoàn thành từ.');
    }
    if (this.phase !== 'playing') return;
    if (enemy.rage >= 100 && !enemy.attackUntil) enemy.nextAttackAt = Math.min(enemy.nextAttackAt, this.clock);
    if (this.clock < enemy.nextAttackAt) return;
    if (!enemy.attackUntil) {
      enemy.attackUntil = this.clock + (enemy.bossPhase === 3 ? 1100 : 1500);
      this.events.push({ type: 'attack', enemyId: enemy.id, enemyKind: enemy.kind, x: enemy.x,
        targetX: this.playerX, duration: enemy.attackUntil - this.clock,
        radius: BOSS_SLAM_RANGE, bossPhase: enemy.bossPhase } satisfies AttackTelegraphEvent);
      this.inform('Tank giơ tay — sắp đập đất!', 1500);
    } else if (this.clock >= enemy.attackUntil) {
      const damage = enemy.state === 'alive' && Math.abs(enemy.x - this.playerX) <= BOSS_SLAM_RANGE
        ? this.hurt(enemy.bossPhase === 3 ? 16 : 12, enemy) : 0;
      this.events.push({ type: 'attack-impact', enemyId: enemy.id, enemyKind: enemy.kind,
        x: enemy.x, targetX: this.playerX, hit: damage > 0, damage,
        radius: BOSS_SLAM_RANGE, bossPhase: enemy.bossPhase } satisfies AttackImpactEvent);
      enemy.attackUntil = 0;
      enemy.rage = Math.max(0, enemy.rage - 30);
      enemy.nextAttackAt = this.clock + (enemy.bossPhase === 3 ? 7000 : 10_000);
    }
  }

  private kill(enemy: Enemy): void {
    // Ignore stale or duplicate death callbacks before awarding score or rolling for loot.
    if (!this.enemies.some((entry) => entry.id === enemy.id)) return;
    this.enemies = this.enemies.filter((entry) => entry.id !== enemy.id);
    this.deck.release(this.reservations.get(enemy.id) ?? []);
    this.reservations.delete(enemy.id);
    this.kills++;
    this.bornAt.delete(enemy.challenge.id);
    this.revealed.delete(enemy.challenge.id);
    this.finalUntil.delete(enemy.id);
    this.events.push({ type: 'enemy-death', enemyId: enemy.id, x: enemy.x });
    // Replenish a cleared flank promptly rather than leaving a long empty timer after a kill.
    this.nextSpawn = Math.min(this.nextSpawn, this.clock + 1200);
    if (enemy.kind === 'tank') {
      this.bossKills++;
      this.score += 1000;
      this.hp = Math.min(100, this.hp + 20);
      this.nextBoss = this.clock + 180_000;
      this.events.push({ type: 'boss-defeat', enemyId: enemy.id, x: enemy.x });
      this.inform('Tank đã bị hạ! +20 HP · +1000 điểm. Sinh tồn tiếp tục!', 6000);
    }
    const available = (['health', 'freeze', 'damage', 'shield'] as ItemKind[]).filter((item) => this.inventory[item] < 5);
    if (available.length && this.rand() < lootChanceFor(enemy.challenge.word)) {
      const item = available[Math.floor(this.rand() * available.length)];
      this.inventory[item]++;
      this.events.push({ type: 'pickup', item, enemyId: enemy.id, x: enemy.x });
      this.inform('Nhặt được tiếp tế! Dùng phím 1–4 khi cần.');
    }
    if (this.targetId === enemy.id) { this.targetId = null; this.input = ''; }
    if (!this.getTarget()) this.selectUrgent();
  }

  private holdAttack(enemy: Enemy, duration: number): void {
    if (duration <= 0) return;
    if (enemy.attackUntil > this.clock) enemy.attackUntil += duration;
    enemy.nextAttackAt = Math.max(this.clock, enemy.nextAttackAt) + duration;
  }

  private hurt(amount: number, source: Enemy): number {
    if (this.phase !== 'playing' || this.clock - this.lastPlayerHurt < 650) return 0;
    this.lastPlayerHurt = this.clock;
    if (this.clock < this.heroGuardUntil) {
      const skill = getHeroSkill(this.heroId);
      this.heroGuardUntil = this.heroActiveUntil = 0;
      this.events.push({ type: 'hero-skill', heroId: this.heroId, skillId: skill.id, visualKind: skill.visualKind,
        x: this.playerX, targetX: source.x, radius: 0, duration: 500, value: amount,
        targets: [{ enemyId: source.id, x: source.x }], skillPhase: 'block' } satisfies HeroSkillEvent);
      return 0;
    }
    if (this.clock < this.heroWardUntil) {
      const effect = getHeroSkill(this.heroId).effect;
      if (effect.kind === 'ward') amount = Math.round(amount * (1 - effect.reduction) * 100) / 100;
    }
    const before = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    const damage = before - this.hp;
    this.events.push({ type: 'player-hurt', duration: 400, enemyId: source.id,
      enemyKind: source.kind, sourceX: source.x, x: this.playerX, damage });
    if (this.hp === 0) this.finishRun('defeat');
    return damage;
  }

  private checkVocabularyComplete(): void {
    if (this.phase !== 'playing' || this.enemies.length || this.projectiles.length) return;
    if (this.deck.availability.remaining > 0) return;
    this.finishRun('vocabulary-complete');
  }

  private finishRun(reason: 'defeat' | 'vocabulary-complete'): void {
    if (this.phase !== 'playing') return;
    this.phase = 'over';
    this.movement = 0;
    this.projectiles = [];
    const minutes = this.clock / 60_000;
    this.summary = { id: `${Date.now()}-${this.runSequence}-${Math.round(this.random() * 1e9)}`,
      endedAt: Date.now(), score: this.score, kills: this.kills, words: this.words, bestCombo: this.bestCombo,
      durationMs: this.clock, accuracy: this.correctKeys + this.wrongKeys ? this.correctKeys / (this.correctKeys + this.wrongKeys) * 100 : 0,
      wpm: minutes > 0 ? this.correctLetters / 5 / minutes : 0, bossKills: this.bossKills,
      results: [...this.results.values()].map((result) => ({ ...result })), reason };
    this.events.push({ type: reason === 'defeat' ? 'game-over' : 'vocabulary-complete' });
    if (reason === 'vocabulary-complete') this.inform('Đã khám phá hết bộ từ mới. Hoàn thành!', 60_000);
  }

  private inform(message: string, duration = 3000): void { this.notice = message; this.noticeUntil = this.clock + duration; }
}
