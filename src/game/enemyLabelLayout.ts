export interface EnemyLabelRequest {
  id: number;
  width: number;
  desiredX: number;
  boss: boolean;
  selected: boolean;
}
export interface EnemyLabelPlacement { id: number; x: number; y: number }

const EDGE = 18;
const GAP = 12;
const WIDTH = 1280;
const totalWidth = (items: readonly EnemyLabelRequest[]) => items.reduce((sum, item) => sum + item.width, 0) + Math.max(0, items.length - 1) * GAP;

/** Two existing label rails; the active encounter has at most six enemies and one Boss. */
export function layoutEnemyLabels(requests: readonly EnemyLabelRequest[], bossHud: boolean): EnemyLabelPlacement[] {
  const lower: EnemyLabelRequest[] = [], upper: EnemyLabelRequest[] = [];
  // Skill HUD occupies x38..320/y108..~200; Boss HUD occupies x420..860 on the upper rail.
  const upperLeft = bossHud ? 860 + GAP : 340 + GAP;
  const right = WIDTH - EDGE;
  const ordered = [...requests].sort((a, b) => Number(b.boss) - Number(a.boss) || Number(b.selected) - Number(a.selected));
  for (const request of ordered) {
    if (request.boss && totalWidth([...upper, request]) <= right - upperLeft) upper.push(request);
    else if (totalWidth([...lower, request]) <= right - EDGE) lower.push(request);
    else upper.push(request);
  }
  const pack = (items: readonly EnemyLabelRequest[], left: number, y: number): EnemyLabelPlacement[] => {
    const sorted = [...items].sort((a, b) => a.desiredX - b.desiredX || a.id - b.id);
    const positions = sorted.map(item => Math.max(left + item.width / 2, Math.min(right - item.width / 2, item.desiredX)));
    // Push neighbours apart, then recover any room to the left. The source enemy positions never move.
    for (let index = 1; index < sorted.length; index++) positions[index] = Math.max(positions[index], positions[index - 1] + (sorted[index - 1].width + sorted[index].width) / 2 + GAP);
    for (let index = sorted.length - 1; index >= 0; index--) {
      const limit = index === sorted.length - 1 ? right - sorted[index].width / 2
        : positions[index + 1] - (sorted[index + 1].width + sorted[index].width) / 2 - GAP;
      positions[index] = Math.min(positions[index], limit);
    }
    return sorted.map((item, index) => ({ id: item.id, x: positions[index], y }));
  };
  return [...pack(lower, EDGE, 292), ...pack(upper, upperLeft, 178)];
}
