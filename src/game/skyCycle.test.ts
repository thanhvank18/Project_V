import { describe, expect, it } from 'vitest';
import { SKY_INTERVAL_MS, SKY_TEXTURES, SKY_TRANSITION_MS, skyFrameAt } from './skyCycle';

describe('gameplay sky cycle', () => {
  it('holds the first sky for 20 seconds, then dissolves into the second', () => {
    expect(skyFrameAt(0)).toEqual({ baseIndex: 0, overlayIndex: 0, overlayAlpha: 0 });
    expect(skyFrameAt(SKY_INTERVAL_MS - 1)).toEqual(skyFrameAt(0));
    expect(skyFrameAt(SKY_INTERVAL_MS)).toEqual({ baseIndex: 0, overlayIndex: 1, overlayAlpha: 0 });
    expect(skyFrameAt(SKY_INTERVAL_MS + SKY_TRANSITION_MS / 2)).toEqual({ baseIndex: 0, overlayIndex: 1, overlayAlpha: .5 });
    expect(skyFrameAt(SKY_INTERVAL_MS + SKY_TRANSITION_MS)).toEqual({ baseIndex: 1, overlayIndex: 1, overlayAlpha: 0 });
  });

  it('wraps all eight skies without a blank frame or accumulating timer drift', () => {
    const wrap = SKY_INTERVAL_MS * SKY_TEXTURES.length;
    expect(SKY_TEXTURES).toHaveLength(8);
    expect(skyFrameAt(wrap)).toEqual({ baseIndex: 7, overlayIndex: 0, overlayAlpha: 0 });
    expect(skyFrameAt(wrap + SKY_TRANSITION_MS / 2).overlayAlpha).toBe(.5);
    expect(skyFrameAt(wrap + SKY_TRANSITION_MS).baseIndex).toBe(0);
    expect(skyFrameAt(37 * SKY_INTERVAL_MS + SKY_TRANSITION_MS).baseIndex).toBe(37 % SKY_TEXTURES.length);
  });

  it('uses only supplied simulation time, so a pause holds the fade and a new run resets', () => {
    const pausedClock = SKY_INTERVAL_MS + 435;
    const paused = skyFrameAt(pausedClock);
    for (let browserFrame = 0; browserFrame < 120; browserFrame++) expect(skyFrameAt(pausedClock)).toEqual(paused);
    expect(skyFrameAt(pausedClock + 300).overlayAlpha).toBeGreaterThan(paused.overlayAlpha);
    expect(skyFrameAt(0)).toEqual({ baseIndex: 0, overlayIndex: 0, overlayAlpha: 0 });
  });

  it('avoids animated fades with reduced motion while keeping the same 20 second cadence', () => {
    expect(skyFrameAt(SKY_INTERVAL_MS - 1, true).baseIndex).toBe(0);
    expect(skyFrameAt(SKY_INTERVAL_MS, true)).toEqual({ baseIndex: 1, overlayIndex: 1, overlayAlpha: 0 });
    expect(skyFrameAt(3 * SKY_INTERVAL_MS + 500, true)).toEqual({ baseIndex: 3, overlayIndex: 3, overlayAlpha: 0 });
  });

  it('safely handles invalid and pre-start clocks and a single available sky', () => {
    expect(skyFrameAt(-500)).toEqual(skyFrameAt(0));
    expect(skyFrameAt(Number.NaN)).toEqual(skyFrameAt(0));
    expect(skyFrameAt(Number.POSITIVE_INFINITY)).toEqual(skyFrameAt(0));
    expect(skyFrameAt(20_800, false, 1)).toEqual({ baseIndex: 0, overlayIndex: 0, overlayAlpha: 0 });
  });
});
