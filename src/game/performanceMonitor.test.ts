import { describe, expect, it } from 'vitest';
import { summarizeFrames } from './performanceMonitor';

describe('frame measurements', () => {
  it('reports steady 60 Hz without hiding a slow rendering frame', () => {
    const frames = Array.from({ length: 60 }, () => ({ interval: 1000 / 60, cpu: 2 }));
    expect(summarizeFrames(frames).fps).toBeCloseTo(60);
    frames[0] = { interval: 100, cpu: 80 };
    const result = summarizeFrames(frames);
    expect(result.fps).toBeLessThan(60);
    expect(result.slowFrames).toBe(1);
    expect(result.cpuMean).toBeGreaterThan(2);
    expect(result.frameP95).toBeCloseTo(1000 / 60);
  });
  it('handles an empty sampling window after backgrounding', () => {
    expect(summarizeFrames([])).toEqual({ fps: 0, frameP95: 0, cpuMean: 0, cpuP95: 0, slowFrames: 0, samples: 0 });
  });
});
