import type { AudioCue } from './GameAudio';
import type { GameEvent } from './types';

/** Audio follows resolved simulation events, never animation frames or damage guesses. */
export function audioCueForEvent(event: GameEvent): AudioCue | null {
  switch (event.type) {
    case 'shot': return 'letter';
    case 'jam': return 'jam';
    case 'hit':
    case 'armor-break': return 'impact';
    case 'enemy-death': return 'kill';
    case 'player-hurt': return 'player-hurt';
    case 'boss-defeat':
    case 'boss-phase':
    case 'hero-skill': return 'skill';
    // A missed ground slam still strikes the ground; ordinary misses are silent.
    case 'attack-impact': return event.enemyKind === 'tank' ? 'boss-slam' : null;
    case 'pickup': return event.item ? 'pickup' : null;
    case 'game-over': return 'game-over';
    case 'vocabulary-complete': return 'victory';
    default: return null;
  }
}
