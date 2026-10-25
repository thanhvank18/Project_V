import { describe, expect, it } from 'vitest';
import generated from './characterCatalog.generated.json';
import { CHARACTERS, CHARACTER_DISPLAY_MULTIPLIER, ENEMY_CHARACTERS, HERO_CHARACTERS, getEnemyCharacter, getEnemyCharacters, getHeroCharacter } from './characterCatalog';
import { characterHitPoint, characterVisualHeight, projectileOrigin } from './characterAnimation';
import type { EnemyKind } from './types';

const kinds: EnemyKind[] = ['normal', 'runner', 'armored', 'tank'];

describe('native character catalog', () => {
  it('reduces every hero and enemy by fifteen percent while retaining native anchors and shared effect geometry', () => {
    expect(CHARACTER_DISPLAY_MULTIPLIER).toBe(0.85);
    for (const character of CHARACTERS) {
      const original = generated.characters.find(source => source.id === character.id)!;
      expect(character.displayScale).toBeCloseTo(original.displayScale * .85);
      expect(character.originX).toBe(original.originX);
      expect(character.originY).toBe(original.originY);
      expect(character.actions).toEqual(original.actions);
      expect(characterVisualHeight(character)).toBeCloseTo(characterVisualHeight(original) * .85);
      for (const direction of [-1, 1]) {
        const before = characterHitPoint(640, 490, original, direction), after = characterHitPoint(640, 490, character, direction);
        expect(after.x - 640).toBeCloseTo((before.x - 640) * .85);
        expect(after.y - 490).toBeCloseTo((before.y - 490) * .85);
        const attack = generated.sprites.find(sprite => sprite.key === character.actions.attack);
        const offset = attack && 'projectileOffset' in attack ? attack.projectileOffset : undefined;
        const oldOrigin = projectileOrigin(640, 490, direction, original.displayScale, offset);
        const newOrigin = projectileOrigin(640, 490, direction, character.displayScale, offset);
        expect(newOrigin.x - 640).toBeCloseTo((oldOrigin.x - 640) * .85);
        expect(newOrigin.y - 490).toBeCloseTo((oldOrigin.y - 490) * .85);
      }
    }
  });
  it('includes all 42 source characters, exactly the nine selected heroes, and 33 enemies', () => {
    expect(CHARACTERS).toHaveLength(42);
    expect(new Set(CHARACTERS.map(character => character.id)).size).toBe(42);
    expect(HERO_CHARACTERS.map(character => character.name).sort()).toEqual([
      'Archer', 'Armored Axeman', 'Knight', 'Knight Templar', 'Lancer', 'Priest', 'Soldier', 'Swordsman', 'Wizard',
    ]);
    expect(ENEMY_CHARACTERS).toHaveLength(33);
    expect(getEnemyCharacter('necromancer').faction).toBe('enemy');
    expect(getEnemyCharacter('werewolf').faction).toBe('enemy');
    expect(getEnemyCharacter('werebear').faction).toBe('enemy');
  });

  it('has a nonempty disjoint spawn pool for each gameplay kind, covering every enemy', () => {
    const all = kinds.flatMap(kind => {
      const pool = getEnemyCharacters(kind);
      expect(pool.length).toBeGreaterThan(0);
      expect(pool.every(character => character.faction === 'enemy' && character.enemyKind === kind)).toBe(true);
      return pool.map(character => character.id);
    });
    expect(new Set(all).size).toBe(33);
    expect(all.sort()).toEqual(ENEMY_CHARACTERS.map(character => character.id).sort());
  });

  it('keeps each character identity through every action and resolves only registered native clips', () => {
    const spriteKeys = new Set(generated.sprites.map(sprite => sprite.key));
    for (const character of CHARACTERS) {
      expect(character.label.trim().length).toBeGreaterThan(0);
      expect(character.portrait).toMatch(/^\//);
      expect(character.displayScale).toBeGreaterThan(0);
      expect(character.bodyHeight).toBeGreaterThan(0);
      expect(character.bodyWidth).toBeGreaterThan(0);
      expect(Number.isFinite(character.hitOffset.x) && Number.isFinite(character.hitOffset.y)).toBe(true);
      expect(character.originX).toBeGreaterThanOrEqual(0);
      expect(character.originX).toBeLessThanOrEqual(1);
      expect(character.originY).toBeGreaterThanOrEqual(0);
      expect(character.originY).toBeLessThanOrEqual(1);
      for (const action of ['idle', 'move', 'attack', 'hurt', 'death'] as const) {
        const key = character.actions[action];
        expect(key.startsWith(`${character.id}-`)).toBe(true);
        expect(spriteKeys.has(key)).toBe(true);
      }
    }
  });

  it('uses Soldier for absent or invalid hero IDs and never crosses hero/enemy factions', () => {
    expect(getHeroCharacter().id).toBe('soldier');
    expect(getHeroCharacter('retired-skin').id).toBe('soldier');
    expect(getHeroCharacter('necromancer').id).toBe('soldier');
    expect(getHeroCharacter('wizard').id).toBe('wizard');
    expect(getEnemyCharacter('soldier', 'runner')).toBe(getEnemyCharacters('runner')[0]);
    expect(getEnemyCharacter('retired-skin', 'tank')).toBe(getEnemyCharacters('tank')[0]);
    expect(getEnemyCharacter()).toBe(getEnemyCharacters('normal')[0]);
    expect(getEnemyCharacter('blood-monster-a').enemyKind).toBe('tank');
    expect(getEnemyCharacter('blood-monster-a', 'normal')).toBe(getEnemyCharacters('normal')[0]);
  });
});
