import type { Enemy, WorldObject } from './types';
export const MAX_ENEMIES = 6;
export const CHARGE_RADIUS = 70;
export const RANGED_RADIUS = 62;
export const BARREL_RADIUS = 220;
export const HEAL_DWELL_MS = 2000;
export const MOMENTUM_LIFETIME = 15_000;

export function createWorldObjects(): WorldObject[] {
  return [
    ...[1050, 2330, 3610, 4890, 5900].map((x, index): WorldObject => ({ id: index + 1, kind: 'barrel', x, radius: BARREL_RADIUS, state: 'idle', charges: 1, progress: 0 })),
    ...[1550, 3450, 5350].map((x, index): WorldObject => ({ id: index + 11, kind: 'gate', x, radius: 100, state: 'open', charges: 0, progress: 0 })),
    ...[2050, 4200].map((x, index): WorldObject => ({ id: index + 21, kind: 'healing-zone', x, radius: 90, state: 'active', charges: 3, progress: 0 })),
  ];
}

export const insideLane = (x: number, from: number, to: number, radius: number): boolean =>
  x >= Math.min(from, to) - radius && x <= Math.max(from, to) + radius;

/** Closed gates obstruct enemies in either direction; the player can still toggle/pass through them. */
export function clipAtGate(from: number, to: number, objects: readonly WorldObject[]): number {
  let result = to;
  for (const object of objects) {
    if (object.kind !== 'gate' || object.state !== 'closed' || from === object.x) continue;
    if (from < object.x && result >= object.x) result = object.x - 4;
    if (from > object.x && result <= object.x) result = object.x + 4;
  }
  return result;
}

export function shieldsFollowers(enemy: Enemy): boolean {
  return enemy.kind === 'tank' || enemy.role === 'shield' && enemy.hp > 1;
}
