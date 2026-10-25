import { describe, expect, it } from 'vitest';
import { flightPoint, glyphScaleForDistance, hurtFrame, lowHealthVisuals } from './combatVisuals';

describe('combat visual timing', () => {
  it('arrives at the current contact point at the same moment in both motion settings', () => {
    const path = { x0: 695, y0: 418, x1: 1000, y1: 426 };
    for (const reduced of [false, true]) {
      expect(flightPoint(path, 0, reduced)).toEqual({ x: 695, y: 418 });
      expect(flightPoint(path, 1, reduced).x).toBe(1000);
      expect(flightPoint(path, 1, reduced).y).toBeCloseTo(426);
      expect(flightPoint({ ...path, x1: 950 }, 1, reduced).x).toBe(950);
      expect(flightPoint(path, 2, reduced).x).toBe(1000);
    }
  });

  it('accelerates without reversing or floating above a five pixel arc', () => {
    const path = { x0: 600, y0: 420, x1: 200, y1: 420 };
    let previous = 600;
    for (let index = 0; index <= 100; index++) {
      const point = flightPoint(path, index / 100, false);
      expect(point.x).toBeLessThanOrEqual(previous);
      expect(point.y).toBeGreaterThanOrEqual(415);
      previous = point.x;
    }
    const early = 600 - flightPoint(path, 0.1, false).x;
    const late = flightPoint(path, 0.9, false).x - 200;
    expect(late).toBeGreaterThan(early);
  });

  it('holds the hurt pose through the actual stagger and releases by its end', () => {
    expect(hurtFrame(0, 300)).toBe(0);
    expect(hurtFrame(60, 300)).toBe(1);
    expect(hurtFrame(230, 300)).toBe(1);
    expect(hurtFrame(260, 300)).toBe(2);
    expect(hurtFrame(299, 300)).toBe(3);
  });

  it('grows letters with travelled distance and caps them at about forty pixels', () => {
    expect(glyphScaleForDistance(0)).toBe(1);
    expect(glyphScaleForDistance(80)).toBeLessThan(glyphScaleForDistance(400));
    expect(glyphScaleForDistance(450) * 22).toBeCloseTo(40.04);
    expect(glyphScaleForDistance(900)).toBe(glyphScaleForDistance(450));
  });

  it('stops dizziness at thirty HP and keeps reduced-motion feedback completely static', () => {
    expect(lowHealthVisuals(30, 1000, true).severity).toBe(0);
    expect(lowHealthVisuals(100, 1000, true).outerAlpha).toBe(0);
    expect(lowHealthVisuals(4, 0, false)).toEqual(lowHealthVisuals(4, 20_000, false));
    expect(lowHealthVisuals(4, 1000, false)).toMatchObject({ dx: 0, dy: 0, angle: 0 });
  });

  it('bounds critical-health motion and raises the outer vignette without tinting the centre', () => {
    for (let clock = 0; clock < 20_000; clock += 100) {
      const effect = lowHealthVisuals(0, clock, true);
      expect(Math.abs(effect.dx)).toBeLessThanOrEqual(3.5);
      expect(Math.abs(effect.angle)).toBeLessThanOrEqual(0.006);
      expect(effect.outerAlpha).toBeGreaterThanOrEqual(0.11);
      expect(effect.outerAlpha).toBeLessThanOrEqual(0.16);
    }
  });
});
