import type { HeroSkillVisualKind } from './heroSkills';

export type EnemyKind = 'normal' | 'runner' | 'armored' | 'tank';
export type ChallengeKind = 'scramble' | 'missing' | 'translate' | 'hint';
export type Phase = 'menu' | 'playing' | 'paused' | 'countdown' | 'over';
export type ItemKind = 'health' | 'freeze' | 'damage' | 'shield';
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'pronoun' | 'conjunction' | 'interjection' | 'determiner' | 'numeral' | 'prefix' | 'suffix' | 'abbreviation' | 'unspecified';
export type WordDifficulty = 1 | 2 | 3;
export type LearningLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export interface LearningProgress { level: LearningLevel; progress: number; step: 20; nextLevelAt: number | null }
export interface Word {
  id: string; answer: string; meaning: string; category: string;
  partOfSpeech: PartOfSpeech; difficulty: WordDifficulty; alternatives?: string[];
  /** Vocabulary grade; legacy banks fall back to difficulty 1→1, 2→4, 3→7. */
  learningLevel?: LearningLevel;
  sourceUrl?: string;
  translationHint?: string;
  /** Previous misspelled headwords: history migration only, never accepted answers. */
  historyAliases?: string[];
}
export interface Challenge {
  id: number; word: Word; kind: ChallengeKind; prompt: string; hint: string;
  credited: Set<number>; mistakes: number; assisted: boolean;
}
export interface Enemy {
  id: number; kind: EnemyKind; x: number; side: -1 | 1; speed: number;
  /** Cosmetic identity; optional for legacy fixtures and snapshots. */
  appearanceId?: string;
  freezeUntil?: number; slowUntil?: number; slowFactor?: number;
  hp: number; maxHp: number; challenge: Challenge;
  state: 'alive' | 'resolving'; stunUntil: number; immuneUntil: number;
  attackUntil: number; nextAttackAt: number; bossPhase: number; rage: number;
}
export interface WordResult {
  word: string; meaning: string; encounters: number; completed: number;
  mistakes: number; assisted: number; totalResponseMs: number;
}
export interface RunSummary {
  id: string; endedAt: number; score: number; kills: number; words: number;
  bestCombo: number; durationMs: number; accuracy: number; wpm: number;
  bossKills: number; results: WordResult[];
  reason?: 'defeat' | 'vocabulary-complete';
}
export interface Progress {
  highScore: number; runs: number; totalWords: number;
  words: Record<string, WordResult & { lastSeen: number; nextReview: number }>;
  seenWords?: Record<string, number>;
}
export interface Snapshot {
  phase: Phase; hp: number; playerX: number; score: number; combo: number; bestCombo: number;
  kills: number; words: number; elapsed: number; input: string; locked: boolean;
  jamRemaining: number; countdown: number; enemyCount: number;
  target: null | {
    id: number; kind: EnemyKind; prompt: string; hint: string; type: ChallengeKind; length: number;
    meaning: string; partOfSpeech: PartOfSpeech; difficulty: WordDifficulty; learningLevel?: LearningLevel;
    appearanceId?: string; name?: string; label?: string;
  };
  boss: null | { hp: number; maxHp: number; phase: number; rage: number; appearanceId?: string; name?: string; label?: string };
  inventory: Record<ItemKind, number>; freezeRemaining: number; boostRemaining: number;
  notice: string; summary: RunSummary | null;
  vocabulary: { remaining: number; total: number; bossReady: boolean };
  hero: { id: string; skillName: string; charge: number; threshold: number; activeRemaining: number };
  learning: LearningProgress;
}
export interface GameEvent {
  type: 'shot' | 'jam' | 'hit' | 'enemy-death' | 'armor-break' | 'player-hurt' | 'boss-warning' | 'boss-phase' | 'boss-defeat' | 'game-over' | 'vocabulary-complete' | 'pickup' | 'attack' | 'attack-impact' | 'hero-skill';
  enemyId?: number; x?: number; glyph?: string; duration?: number; effective?: boolean;
  shotId?: number; challengeId?: number; firedAt?: number; impactAt?: number; item?: ItemKind;
  enemyKind?: EnemyKind; bossPhase?: number; targetX?: number; sourceX?: number;
  hit?: boolean; damage?: number; radius?: number;
  heroId?: string; skillId?: string; visualKind?: HeroSkillVisualKind;
  targets?: { enemyId: number; x: number }[]; value?: number; skillPhase?: 'activate' | 'block';
}
/** Actual attack resolution, never a request for the renderer to apply damage. */
export interface AttackImpactEvent extends GameEvent {
  type: 'attack-impact'; enemyId: number; enemyKind: EnemyKind;
  x: number; targetX: number; hit: boolean; damage: number;
  radius?: number; bossPhase?: number;
}
export interface AttackTelegraphEvent extends GameEvent {
  type: 'attack'; enemyId: number; enemyKind: EnemyKind;
  x: number; targetX: number; duration: number;
  radius?: number; bossPhase?: number;
}
export interface HeroSkillEvent extends GameEvent {
  type: 'hero-skill'; heroId: string; skillId: string; visualKind: HeroSkillVisualKind;
  x: number; targetX: number; radius: number; duration: number;
  targets: { enemyId: number; x: number }[]; skillPhase: 'activate' | 'block';
}
export interface EnginePort {
  clock: number; playerX: number; enemies: Enemy[]; targetId: number | null;
  start(mode?: 'survival' | 'boss'): void;
  setHero(id?: string): void;
  setMovement(direction: -1 | 0 | 1): void;
  step(deltaMs: number): void;
  typeKey(key: string): void;
  cycleTarget(direction?: number): void;
  pause(): void;
  resume(): void;
  toMenu(): void;
  useItem(item: ItemKind): void;
  snapshot(): Snapshot;
  drainEvents(): GameEvent[];
}
