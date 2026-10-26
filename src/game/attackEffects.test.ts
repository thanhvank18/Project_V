import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttackEffects } from './attackEffects';
import type { AttackImpactEvent, EnemyKind } from './types';

type Shape = 'line' | 'triangle' | 'rect' | 'ellipse';
interface Draw { shape: Shape; coordinates: number[]; alpha: number }

/** Only the drawing boundary is faked; AttackEffects timing and geometry run unchanged. */
class DrawCollector {
  depth = 0;
  draws: Draw[] = [];
  private fillAlpha = 1;
  private strokeAlpha = 1;

  setDepth(depth: number): this { this.depth = depth; return this; }
  clear(): this { this.draws = []; return this; }
  fillStyle(_color: number, alpha = 1): this { this.fillAlpha = alpha; return this; }
  lineStyle(_width: number, _color: number, alpha = 1): this { this.strokeAlpha = alpha; return this; }
  fillTriangle(...coordinates: number[]): this { return this.collect('triangle', coordinates, this.fillAlpha); }
  lineBetween(...coordinates: number[]): this { return this.collect('line', coordinates, this.strokeAlpha); }
  fillRect(...coordinates: number[]): this { return this.collect('rect', coordinates, this.fillAlpha); }
  strokeEllipse(...coordinates: number[]): this { return this.collect('ellipse', coordinates.slice(0, 4), this.strokeAlpha); }
  fillEllipse(...coordinates: number[]): this { return this.collect('ellipse', coordinates.slice(0, 4), this.fillAlpha); }

  private collect(shape: Shape, coordinates: number[], alpha: number): this {
    this.draws.push({ shape, coordinates, alpha });
    return this;
  }
}

function harness() {
  const surfaces: DrawCollector[] = [];
  const attached: DrawCollector[] = [];
  const scene = { add: { graphics: () => { const g = new DrawCollector(); surfaces.push(g); return g; } } };
  const world = { add: (objects: DrawCollector[]) => { attached.push(...objects); } };
  const effects = new AttackEffects(scene as unknown as Phaser.Scene, world as unknown as Phaser.GameObjects.Container);
  return {
    effects, surfaces,
    ground: attached.reduce((a, b) => a.depth < b.depth ? a : b),
    foreground: attached.reduce((a, b) => a.depth > b.depth ? a : b),
    all: () => surfaces.flatMap(surface => surface.draws),
  };
}

function impact(kind: EnemyKind, hit = true): AttackImpactEvent {
  return {
    type: 'attack-impact', enemyId: 7, enemyKind: kind, x: 400,
    targetX: 700, hit, damage: hit ? 12 : 0,
    ...(kind === 'tank' ? { radius: 300, bossPhase: 2 } : {}),
  };
}

const geometry = (draws: Draw[]) => draws.map(({ shape, coordinates }) => ({ shape, coordinates }));
const opacity = (draws: Draw[]) => draws.reduce((sum, draw) => sum + draw.alpha, 0);

describe('positional attack effects', () => {
  it('draws a locked charge trail without inventing player contact on a whiff', () => {
    const h = harness();
    h.effects.record({ ...impact('tank', false), attackKind: 'charge', laneFrom: 400, laneTo: 900, targetX: 900 }, 0);
    h.effects.render(40, true); const early = geometry(h.ground.draws);
    expect(h.foreground.draws).toEqual([]);
    expect(h.ground.draws.some(draw => draw.shape === 'line' && draw.coordinates[0] === 400 && draw.coordinates[2] === 900)).toBe(true);
    h.effects.render(160, true); expect(geometry(h.ground.draws)).toEqual(early);
  });
  it('places a ranged whiff at its locked point and uses no melee claw geometry', () => {
    const h = harness();
    h.effects.record({ ...impact('normal', false), attackKind: 'ranged', targetX: 930 }, 0);
    h.effects.render(40, false);
    expect(h.foreground.draws.some(draw => draw.shape === 'ellipse' && draw.coordinates[0] === 930)).toBe(true);
    expect(h.all().some(draw => draw.shape === 'triangle')).toBe(false);
  });
});

function intersectsPlayer(draw: Draw, x: number): boolean {
  if (draw.alpha <= 0) return false;
  const c = draw.coordinates;
  let left: number; let right: number; let top: number; let bottom: number;
  if (draw.shape === 'rect') {
    [left, top] = c; right = c[0] + c[2]; bottom = c[1] + c[3];
  } else if (draw.shape === 'ellipse') {
    left = c[0] - c[2] / 2; right = c[0] + c[2] / 2;
    top = c[1] - c[3] / 2; bottom = c[1] + c[3] / 2;
  } else {
    const xs = c.filter((_, index) => index % 2 === 0);
    const ys = c.filter((_, index) => index % 2 === 1);
    left = Math.min(...xs); right = Math.max(...xs); top = Math.min(...ys); bottom = Math.max(...ys);
  }
  return right >= x - 38 && left <= x + 38 && bottom >= 430 && top <= 490;
}

afterEach(() => vi.useRealTimers());

describe('attack effect presentation invariants', () => {
  it('places native hero contact feedback at its authored scaled chest point', () => {
    const baseline = harness();
    const native = harness();
    baseline.effects.record(impact('normal'), 0);
    native.effects.record(impact('normal'), 0, { x: 715, y: 390 });
    baseline.effects.render(40, false);
    native.effects.render(40, false);
    const original = baseline.foreground.draws;
    const moved = native.foreground.draws;
    expect(moved).toHaveLength(original.length);
    original.forEach((draw, index) => {
      expect(moved[index].shape).toBe(draw.shape);
      draw.coordinates.forEach((coordinate, position) => {
        const isSize = (draw.shape === 'rect' || draw.shape === 'ellipse') && position >= 2;
        expect(moved[index].coordinates[position]).toBeCloseTo(coordinate + (isSize ? 0 : position % 2 ? -35 : 15));
      });
    });
  });

  it.each<EnemyKind>(['normal', 'runner', 'armored', 'tank'])('keeps %s effects unchanged while the supplied clock is paused', kind => {
    vi.useFakeTimers();
    const h = harness();
    h.effects.record(impact(kind), 1000);
    h.effects.render(1040, false);
    const paused = structuredClone(h.all());
    expect(paused.length).toBeGreaterThan(0);
    vi.advanceTimersByTime(10_000);
    h.effects.render(1040, false);
    expect(h.all()).toEqual(paused);
    h.effects.render(1100, false);
    expect(geometry(h.all())).not.toEqual(geometry(paused));
  });

  it.each<EnemyKind>(['normal', 'runner', 'armored', 'tank'])('fades reduced-motion %s feedback without moving or expanding it', kind => {
    const h = harness();
    h.effects.record(impact(kind), 0);
    h.effects.render(20, true);
    const early = structuredClone(h.all());
    expect(early.length).toBeGreaterThan(0);
    h.effects.render(100, true);
    expect(geometry(h.all())).toEqual(geometry(early));
    expect(opacity(h.all())).toBeLessThan(opacity(early));
    expect(opacity(h.all())).toBeGreaterThan(0);
    expect(h.all().every(draw => draw.coordinates.every(Number.isFinite))).toBe(true);
  });

  it.each([false, true])('shows a Boss ground slam on a whiff, with no player contact burst (reduced=%s)', reduced => {
    const miss = harness();
    miss.effects.record(impact('tank', false), 0);
    miss.effects.render(50, reduced);
    expect(miss.ground.draws.some(draw => draw.alpha > 0)).toBe(true);
    expect(miss.foreground.draws.some(draw => intersectsPlayer(draw, 700))).toBe(false);

    const hit = harness();
    hit.effects.record(impact('tank', true), 0);
    hit.effects.render(50, reduced);
    expect(hit.foreground.draws.some(draw => intersectsPlayer(draw, 700))).toBe(true);
    expect(geometry(hit.ground.draws)).toEqual(geometry(miss.ground.draws));
  });

  it('clears effects immediately on reset and never revives an expired or reset impact', () => {
    const h = harness();
    h.effects.record(impact('tank'), 0);
    h.effects.render(40, false);
    expect(h.all().length).toBeGreaterThan(0);
    h.effects.reset();
    expect(h.all()).toEqual([]);
    h.effects.render(40, false);
    expect(h.all()).toEqual([]);

    h.effects.record(impact('runner'), 100);
    h.effects.render(140, false);
    expect(h.all().length).toBeGreaterThan(0);
    h.effects.render(5000, false);
    expect(h.all()).toEqual([]);
    h.effects.render(140, false);
    expect(h.all()).toEqual([]);
  });

  it('bounds the work and shared surfaces even during a very large impact burst', () => {
    const renderBurst = (count: number) => {
      const h = harness();
      const initialSurfaces = h.surfaces.length;
      for (let index = 0; index < count; index++) h.effects.record(impact('normal'), 0);
      h.effects.render(30, false);
      expect(h.surfaces.length).toBe(initialSurfaces);
      return h.all().length;
    };
    const one = renderBurst(1);
    const busy = renderBurst(64);
    const flood = renderBurst(4096);
    expect(one).toBeGreaterThan(0);
    expect(busy).toBeGreaterThan(one);
    expect(busy).toBeLessThan(one * 64);
    expect(flood).toBe(busy);
  });
});
