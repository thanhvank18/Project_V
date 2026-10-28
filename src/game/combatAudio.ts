import type { AudioCue } from './GameAudio';
import { getHeroSkill, type HeroAttackStyle, type HeroSkillVisualKind } from './heroSkills';
import type { GameEvent } from './types';

const ATTACK_CUES: Record<HeroAttackStyle, AudioCue> = {
  arrow: 'attack-arrow', axe: 'attack-axe', sword: 'attack-sword',
  'holy-spear': 'attack-sword', spear: 'attack-sword', 'holy-light': 'attack-magic',
  volley: 'attack-arrow', blade: 'attack-sword', arcane: 'attack-magic',
};
const SKILL_CUES: Record<HeroSkillVisualKind, AudioCue> = {
  // A skill is emitted immediately after its charging shot, so it needs a separate cooldown.
  pierce: 'skill', shockwave: 'skill', guard: 'guard', sanctuary: 'heal',
  lance: 'skill', heal: 'heal', volley: 'volley', repel: 'skill', frost: 'frost',
};

/** Audio follows resolved simulation events, never animation frames or damage guesses. */
export function audioCueForEvent(event: GameEvent, fallbackHeroId?: string): AudioCue | null {
  const heroId = event.heroId ?? fallbackHeroId;
  switch (event.type) {
    case 'shot': return heroId ? ATTACK_CUES[getHeroSkill(heroId).attackStyle] : 'letter';
    case 'jam': return 'jam';
    case 'hit':
    case 'armor-break': return 'impact';
    case 'enemy-death': return 'kill';
    case 'player-hurt': return 'player-hurt';
    case 'boss-defeat':
    case 'boss-phase': return 'skill';
    case 'hero-skill': {
      if (event.skillPhase === 'block') return 'guard';
      const visualKind = event.visualKind ?? (heroId ? getHeroSkill(heroId).visualKind : undefined);
      return visualKind ? SKILL_CUES[visualKind] : 'skill';
    }
    // A missed ground slam still strikes the ground; ordinary misses are silent.
    case 'attack-impact': return event.enemyKind === 'tank' ? 'boss-slam' : null;
    case 'pickup': return event.item ? 'pickup' : null;
    case 'game-over': return 'game-over';
    case 'vocabulary-complete': return 'victory';
    default: return null;
  }
}
