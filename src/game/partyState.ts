import type { ItemKind, PartyMember } from './types';

/** Only actor-local state is switched; clock, dictionary, combatants and world remain shared. */
export interface ActorState {
  playerX: number; targetId: number | null; hp: number; movement: -1 | 0 | 1; input: string;
  jamUntil: number; boostUntil: number; heroId: string; heroCharge: number; heroActiveUntil: number;
  heroGuardUntil: number; heroWardUntil: number; lastPlayerHurt: number; lastMovedAt: number;
  dashUntil: number; wardX: number; inventory: Record<ItemKind, number>;
  momentum: number; momentumStreak: number; momentumUntil: number;
  healingProgress: Map<number, number>;
}
export interface PartyActor { member: PartyMember; connected: boolean; state: ActorState }

export function createActorState(heroId: string, x: number): ActorState {
  return { playerX: x, targetId: null, hp: 100, movement: 0, input: '', jamUntil: 0, boostUntil: 0,
    heroId, heroCharge: 0, heroActiveUntil: 0, heroGuardUntil: 0, heroWardUntil: 0,
    lastPlayerHurt: -Infinity, lastMovedAt: 0, dashUntil: 0, wardX: x,
    inventory: { health: 1, freeze: 1, damage: 1, shield: 1 },
    momentum: 0, momentumStreak: 0, momentumUntil: 0, healingProgress: new Map() };
}
