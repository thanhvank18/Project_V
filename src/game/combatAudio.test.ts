import { describe, expect, it } from 'vitest';
import { audioCueForEvent } from './combatAudio';

describe('combat audio event routing', () => {
  it.each([
    ['swordsman', 'attack-sword'], ['knight', 'attack-sword'], ['knight-templar', 'attack-sword'],
    ['lancer', 'attack-sword'], ['armored-axeman', 'attack-axe'], ['archer', 'attack-arrow'],
    ['soldier', 'attack-arrow'], ['wizard', 'attack-magic'], ['priest', 'attack-magic'],
  ] as const)('uses the actual %s weapon for letter attacks', (heroId, cue) => {
    expect(audioCueForEvent({ type: 'shot', heroId })).toBe(cue);
    expect(audioCueForEvent({ type: 'shot' }, heroId)).toBe(cue);
  });

  it('uses a remote event hero before the local fallback and keeps legacy events playable', () => {
    expect(audioCueForEvent({ type: 'shot', heroId: 'wizard' }, 'swordsman')).toBe('attack-magic');
    expect(audioCueForEvent({ type: 'shot' })).toBe('letter');
  });

  it('distinguishes guard impacts, healing, frost and volleys from basic attacks', () => {
    expect(audioCueForEvent({ type: 'hero-skill', heroId: 'knight', skillPhase: 'block' })).toBe('guard');
    expect(audioCueForEvent({ type: 'hero-skill', heroId: 'priest', skillPhase: 'activate' })).toBe('heal');
    expect(audioCueForEvent({ type: 'hero-skill', heroId: 'knight-templar', visualKind: 'sanctuary' })).toBe('heal');
    expect(audioCueForEvent({ type: 'hero-skill', heroId: 'wizard', visualKind: 'frost' })).toBe('frost');
    expect(audioCueForEvent({ type: 'hero-skill', heroId: 'soldier', visualKind: 'volley' })).toBe('volley');
    expect(audioCueForEvent({ type: 'hero-skill', heroId: 'armored-axeman', visualKind: 'shockwave' })).toBe('skill');
    expect(audioCueForEvent({ type: 'hero-skill' })).toBe('skill');
  });

  it('does not play impacts for telegraphs or ordinary missed attacks', () => {
    expect(audioCueForEvent({ type: 'attack', enemyKind: 'tank' })).toBeNull();
    expect(audioCueForEvent({ type: 'attack-impact', enemyKind: 'runner', hit: false, damage: 0 })).toBeNull();
    expect(audioCueForEvent({ type: 'attack-impact', enemyKind: 'runner', hit: true, damage: 12 })).toBeNull();
    expect(audioCueForEvent({ type: 'player-hurt', damage: 12 })).toBe('player-hurt');
  });

  it('plays the ground impact even when the player dodges a boss slam', () => {
    expect(audioCueForEvent({ type: 'attack-impact', enemyKind: 'tank', hit: false, damage: 0 })).toBe('boss-slam');
  });

  it('distinguishes defeat, dictionary victory, boss death and earned pickups', () => {
    expect(audioCueForEvent({ type: 'game-over' })).toBe('game-over');
    expect(audioCueForEvent({ type: 'vocabulary-complete' })).toBe('victory');
    expect(audioCueForEvent({ type: 'boss-defeat' })).toBe('skill');
    expect(audioCueForEvent({ type: 'enemy-death' })).toBe('kill');
    expect(audioCueForEvent({ type: 'pickup' })).toBeNull();
    expect(audioCueForEvent({ type: 'pickup', item: 'health' })).toBe('pickup');
  });
});
