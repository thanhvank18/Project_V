import generated from './characterCatalog.generated.json';
import type { EnemyKind } from './types';

export interface CharacterDefinition {
  id: string;
  name: string;
  label: string;
  faction: 'hero' | 'enemy';
  enemyKind?: EnemyKind;
  portrait: string;
  displayScale: number;
  originX: number;
  originY: number;
  /** Opaque standing-body size in native source pixels, excluding cell padding. */
  bodyHeight: number;
  bodyWidth: number;
  hitOffset: { x: number; y: number };
  actions: { idle: string; move: string; attack: string; hurt: string; death: string };
}

/** Visual identities only. Combat stats continue to belong to the four gameplay enemy kinds. */
export const CHARACTER_DISPLAY_MULTIPLIER = 0.85;
export const CHARACTERS: readonly CharacterDefinition[] = generated.characters.map(character => ({
  ...character, displayScale: character.displayScale * CHARACTER_DISPLAY_MULTIPLIER,
})) as CharacterDefinition[];
export const HERO_CHARACTERS: readonly CharacterDefinition[] = CHARACTERS.filter(character => character.faction === 'hero');
export const ENEMY_CHARACTERS: readonly CharacterDefinition[] = CHARACTERS.filter(character => character.faction === 'enemy');
const byId = new Map(CHARACTERS.map(character => [character.id, character]));
const defaultHero = HERO_CHARACTERS.find(character => character.id === 'soldier') ?? HERO_CHARACTERS[0];
const enemyPools: Record<EnemyKind, readonly CharacterDefinition[]> = {
  normal: ENEMY_CHARACTERS.filter(character => character.enemyKind === 'normal'),
  runner: ENEMY_CHARACTERS.filter(character => character.enemyKind === 'runner'),
  armored: ENEMY_CHARACTERS.filter(character => character.enemyKind === 'armored'),
  tank: ENEMY_CHARACTERS.filter(character => character.enemyKind === 'tank'),
};

export function getHeroCharacter(id?: string): CharacterDefinition {
  const character = id ? byId.get(id) : undefined;
  return character?.faction === 'hero' ? character : defaultHero;
}

export function getEnemyCharacters(kind: EnemyKind): readonly CharacterDefinition[] {
  return enemyPools[kind];
}

/** Missing/retired appearance IDs use a valid skin for that enemy kind, including old saved fixtures. */
export function getEnemyCharacter(id?: string, kind?: EnemyKind): CharacterDefinition {
  const character = id ? byId.get(id) : undefined;
  if (character?.faction === 'enemy' && (!kind || character.enemyKind === kind)) return character;
  return enemyPools[kind ?? 'normal'][0];
}
