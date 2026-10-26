import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { TacticalWorldEffects, type TelegraphVisual, type WorldPropVisual } from './TacticalWorldEffects';

interface Draw { kind: string; coordinates: number[]; color: number; alpha: number }
class Surface {
  depth = 0; draws: Draw[] = []; color = 0; alpha = 1;
  setDepth(depth: number): this { this.depth = depth; return this; }
  clear(): this { this.draws = []; return this; }
  fillStyle(color: number, alpha = 1): this { this.color = color; this.alpha = alpha; return this; }
  lineStyle(_width: number, color: number, alpha = 1): this { return this.fillStyle(color, alpha); }
  fillRect(...coordinates: number[]): this { return this.add('rect', coordinates); }
  fillTriangle(...coordinates: number[]): this { return this.add('triangle', coordinates); }
  lineBetween(...coordinates: number[]): this { return this.add('line', coordinates); }
  fillEllipse(...coordinates: number[]): this { return this.add('ellipse-fill', coordinates.slice(0, 4)); }
  strokeEllipse(...coordinates: number[]): this { return this.add('ellipse', coordinates.slice(0, 4)); }
  private add(kind: string, coordinates: number[]): this { this.draws.push({ kind, coordinates, color: this.color, alpha: this.alpha }); return this; }
}
function harness() {
  const surfaces: Surface[] = [];
  const scene = { add: { graphics: () => { const surface = new Surface(); surfaces.push(surface); return surface; } } };
  const effects = new TacticalWorldEffects(scene as unknown as Phaser.Scene, { add: () => undefined } as unknown as Phaser.GameObjects.Container);
  return { effects, all: () => surfaces.flatMap(surface => surface.draws), ground: () => surfaces[0].draws };
}
const geometry = (draws: Draw[]) => draws.map(({ kind, coordinates }) => ({ kind, coordinates }));
const slam: TelegraphVisual = { kind: 'slam', x: 600, targetX: 600, radius: 300, progress: .5, phase: 1 };
const prop = (kind: WorldPropVisual['kind'], x = 500): WorldPropVisual => ({ id: 1, kind, x, radius: 90, state: kind === 'barrel' ? 'idle' : 'active', charges: 3, progress: .5 });

describe('tactical world presentation', () => {
  it('pins slam footprint to the locked centre instead of following an attacker or player', () => {
    const h = harness();
    h.effects.render(1000, false, [], [slam], []); const first = geometry(h.all());
    h.effects.render(1000, false, [], [{ ...slam, x: 950 }], []);
    expect(geometry(h.all())).toEqual(first);
    expect(h.all().some(draw => draw.kind === 'ellipse' && draw.coordinates[0] === 600 && draw.coordinates[2] === 600)).toBe(true);
  });
  it.each([[400, 900], [900, 400]])('marks the whole %s→%s charge including its damage padding', (from, to) => {
    const h = harness();
    h.effects.render(1000, true, [], [{ kind: 'charge', x: from, targetX: to, from, to, radius: 70, progress: .4, phase: 2 }], []);
    expect(h.ground().some(draw => draw.kind === 'rect' && draw.coordinates[0] === 330 && draw.coordinates[2] === 640 && draw.coordinates[3] === 28)).toBe(true);
    expect(h.all().every(draw => draw.coordinates.every(Number.isFinite))).toBe(true);
  });
  it('holds all geometry at the same clock while paused, including active healing and summon cues', () => {
    const h = harness();
    h.effects.emit('summon', 500, 900);
    const objects = [prop('healing-zone'), prop('gate', 700), prop('barrel', 900)];
    h.effects.render(1000, false, objects, [slam], [{ role: 'summoner', x: 750, height: 120, direction: -1 }]);
    const first = structuredClone(h.all());
    h.effects.render(1000, false, objects, [slam], [{ role: 'summoner', x: 750, height: 120, direction: -1 }]);
    expect(h.all()).toEqual(first);
  });
  it('uses static reduced-motion geometry for bursts, while retaining fading feedback', () => {
    const h = harness(); h.effects.emit('explosion', 500, 0, 220);
    h.effects.render(40, true, [], [], []); const first = geometry(h.all()), earlyAlpha = h.all().reduce((sum, draw) => sum + draw.alpha, 0);
    h.effects.render(350, true, [], [], []);
    expect(geometry(h.all())).toEqual(first);
    expect(h.all().reduce((sum, draw) => sum + draw.alpha, 0)).toBeLessThan(earlyAlpha);
  });
  it('bounds effects, culls distant props, cleans expired/reset bursts and never revives them', () => {
    const h = harness();
    for (let index = 0; index < 1000; index++) h.effects.emit('heal', 500, 0);
    expect(h.effects.burstCount).toBe(16);
    h.effects.render(700, false, [prop('barrel', 5000)], [], []);
    expect(h.all()).toEqual([]); expect(h.effects.burstCount).toBe(0);
    h.effects.render(40, false, [], [], []); expect(h.all()).toEqual([]);
    h.effects.emit('gate', 500, 0); h.effects.reset();
    h.effects.render(40, false, [], [], []); expect(h.all()).toEqual([]);
  });
  it('distinguishes shield/ranged/summoner markers without changing source role/prop state', () => {
    const signatures = new Set<string>();
    for (const role of ['shield', 'ranged', 'summoner'] as const) {
      const h = harness(), objects = [prop('barrel')], original = structuredClone(objects);
      h.effects.render(0, true, objects, [], [{ role, x: 700, height: 120, direction: -1, formationId: 2 }]);
      signatures.add(JSON.stringify(h.all())); expect(objects).toEqual(original);
    }
    expect(signatures.size).toBe(3);
  });
});
