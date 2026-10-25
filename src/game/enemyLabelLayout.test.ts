import { describe, expect, it } from 'vitest';
import { layoutEnemyLabels, type EnemyLabelRequest } from './enemyLabelLayout';

function check(requests: EnemyLabelRequest[], bossHud: boolean): void {
  const result = layoutEnemyLabels(requests, bossHud);
  expect(new Set(result.map(label => label.id)).size).toBe(requests.length);
  for (const label of result) {
    const request = requests.find(item => item.id === label.id)!;
    expect(label.x - request.width / 2).toBeGreaterThanOrEqual(18);
    expect(label.x + request.width / 2).toBeLessThanOrEqual(1262);
    expect(label.y - 53).toBeGreaterThanOrEqual(100);
    expect(label.y + 53).toBeLessThanOrEqual(540);
    if (label.y === 178) expect(label.x - request.width / 2).toBeGreaterThanOrEqual(bossHud ? 872 : 352);
    for (const other of result.filter(candidate => candidate.id !== label.id && candidate.y === label.y)) {
      const otherWidth = requests.find(item => item.id === other.id)!.width;
      expect(Math.abs(label.x - other.x)).toBeGreaterThanOrEqual((request.width + otherWidth) / 2 + 12);
    }
  }
  for (const selected of requests.filter(request => request.selected)) expect(result.some(label => label.id === selected.id)).toBe(true);
}

describe('enemy label rails', () => {
  it.each([false, true])('keeps six crowded left-edge labels out of the skill HUD and Boss HUD (boss=%s)', bossHud => {
    check(Array.from({ length: 6 }, (_, id) => ({ id, desiredX: 18 + id * 21, width: bossHud && id === 0 ? 260 : 238, boss: bossHud && id === 0, selected: id === 4 })), bossHud);
  });
  it.each([false, true])('packs six labels inside the right boundary without overlapping (boss=%s)', bossHud => {
    check(Array.from({ length: 6 }, (_, id) => ({ id, desiredX: 1280 - id * 16, width: bossHud && id === 0 ? 260 : 238, boss: bossHud && id === 0, selected: id === 0 })), bossHud);
  });
  it('preserves a selected offscreen callout instead of hiding it to recover space', () => {
    check(Array.from({ length: 6 }, (_, id) => ({ id, desiredX: id === 0 ? -500 : 640 + id * 30, width: 238, boss: false, selected: id === 0 })), false);
  });
  it('keeps all six labels bounded for mixed positions, priorities and Boss encounters', () => {
    for (let seed = 0; seed < 100; seed++) {
      const bossHud = seed % 2 === 0;
      check(Array.from({ length: 6 }, (_, id) => ({ id, desiredX: (seed * 107 + id * 313) % 1800 - 260,
        width: bossHud && id === 0 ? 260 : 238, boss: bossHud && id === 0, selected: id === seed % 6 })), bossHud);
    }
  });
});
