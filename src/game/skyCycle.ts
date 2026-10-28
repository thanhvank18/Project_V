import catalog from './skyCatalog.generated.json';

export const SKY_TEXTURES = catalog.skies;
export const SKY_INTERVAL_MS = catalog.intervalMs;
export const SKY_TRANSITION_MS = catalog.transitionMs;

export interface SkyFrame {
  baseIndex: number;
  overlayIndex: number;
  overlayAlpha: number;
}

/** Shared simulation time keeps solo pauses, restarts and co-op skies in sync. */
export function skyFrameAt(elapsedMs: number, reducedMotion = false, count = SKY_TEXTURES.length): SkyFrame {
  const length = Math.max(1, Math.floor(count));
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const cycle = Math.floor(elapsed / SKY_INTERVAL_MS);
  const current = cycle % length;
  const withinCycle = elapsed % SKY_INTERVAL_MS;
  if (cycle === 0 || reducedMotion || withinCycle >= SKY_TRANSITION_MS || length === 1) {
    return { baseIndex: current, overlayIndex: current, overlayAlpha: 0 };
  }
  const progress = withinCycle / SKY_TRANSITION_MS;
  // The opaque base stays at alpha 1: fades never expose a black frame.
  return {
    baseIndex: (current + length - 1) % length,
    overlayIndex: current,
    overlayAlpha: progress * progress * (3 - 2 * progress),
  };
}
