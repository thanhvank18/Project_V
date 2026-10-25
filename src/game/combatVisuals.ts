export interface FlightPath { x0: number; y0: number; x1: number; y1: number }

/** A fast, accelerating typographic bullet, with exact endpoints and no overshoot. */
export function flightPoint(path: FlightPath, progress: number, reducedMotion: boolean): { x: number; y: number } {
  const p = Math.max(0, Math.min(1, progress));
  const eased = 0.36 * p + 0.64 * p * p;
  return {
    x: path.x0 + (path.x1 - path.x0) * eased,
    y: path.y0 + (path.y1 - path.y0) * eased - (reducedMotion ? 0 : Math.sin(p * Math.PI) * 5),
  };
}

/** Contact coordinates match the visible torso, including the taller Tank sprite. */
export const bodyY = (boss: boolean): number => 490 - (boss ? 120 : 64);

/** Growth follows distance actually travelled, so short-range shots stay compact. */
export const glyphScaleForDistance = (distance: number): number => 1 + Math.max(0, Math.min(450, distance)) / 450 * 0.82;

export function hurtFrame(elapsed: number, duration: number): number {
  const p = elapsed / Math.max(1, duration);
  return p < 0.16 ? 0 : p < 0.8 ? 1 : p < 0.93 ? 2 : 3;
}

export function lowHealthVisuals(hp: number, clock: number, animate: boolean): { severity: number; dx: number; dy: number; angle: number; outerAlpha: number } {
  const severity = hp < 30 ? 0.2 + (30 - Math.max(0, hp)) / 30 * 0.8 : 0;
  const pulse = animate ? (Math.sin(clock * 0.0048) + 1) * 0.5 : 0.5;
  return {
    severity,
    dx: animate ? Math.sin(clock * 0.0017) * severity * 3.5 : 0,
    dy: animate ? Math.cos(clock * 0.0013) * severity * 1.1 : 0,
    angle: animate ? Math.sin(clock * 0.0011) * severity * 0.006 : 0,
    outerAlpha: severity * (0.11 + pulse * 0.05),
  };
}
