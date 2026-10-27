import type { EnemyKind } from './types';

export interface HeroCombatProfile { class: 'melee' | 'ranged'; maxHp: number; range: number }
const MELEE = new Set(['armored-axeman', 'knight', 'knight-templar', 'lancer', 'swordsman']);
const SPEARS = new Set(['knight-templar', 'lancer']);

/** Ranged heroes retain their existing visible-target reach; finite values survive room JSON. */
export function getHeroCombat(heroId?: string): HeroCombatProfile {
  return MELEE.has(heroId ?? '')
    ? { class: 'melee', maxHp: 150, range: SPEARS.has(heroId ?? '') ? 160 : 120 }
    : { class: 'ranged', maxHp: 100, range: 10_000 };
}

/** Boss sprites have a larger solid body, so melee can hit without crossing that body. */
export function attackReach(heroId: string, targetKind?: EnemyKind | 'barrel'): number {
  const profile = getHeroCombat(heroId);
  return profile.range + (profile.class === 'melee' && targetKind === 'tank' ? 100 : 0);
}

export const MELEE_LETTER_INTERVAL = 70;
