import { describe, expect, it } from 'vitest';
import { audioCueForEvent } from './combatAudio';

describe('combat audio event routing', () => {
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
