export interface CharacterActions {
  idle: string; move: string; attack: string; hurt: string; death: string;
}

export interface CharacterPose {
  displayScale: number;
  bodyHeight?: number;
  bodyWidth?: number;
  hitOffset?: { x: number; y: number };
}

export interface AttackTiming {
  durations: readonly number[];
  attackContactFrame?: number;
}

interface RangedTiming {
  durations: readonly number[];
  releaseFrame?: number;
  attackContactFrame?: number;
}

const DEFAULT_ATTACK_DURATIONS = [100, 100, 100, 100, 65, 60, 65, 70] as const;

interface DeathSprite {
  setPosition(x: number, y: number): unknown;
  setAngle(angle: number): unknown;
  setScale(scale: number): unknown;
  setTint(tint: number): unknown;
  setAlpha(alpha: number): unknown;
}

interface DeathShadow {
  setPosition(x: number, y: number): unknown;
  setAlpha(alpha: number): unknown;
}

export function characterVisualHeight(character: CharacterPose): number {
  return (character.bodyHeight ?? 20) * character.displayScale;
}

export function characterHitPoint(x: number, ground: number, character: CharacterPose, facing = 1): { x: number; y: number } {
  const offset = character.hitOffset ?? { x: 0, y: -(character.bodyHeight ?? 20) * 0.45 };
  return projectileOrigin(x, ground, facing, character.displayScale, offset);
}

export function characterShadow(character: CharacterPose): { width: number; height: number } {
  const width = Math.max(30, Math.min(190, (character.bodyWidth ?? 14) * character.displayScale * 0.75));
  return { width, height: Math.max(9, Math.min(25, width * 0.14)) };
}

/** Boss phases change intensity while retaining the chosen native character. */
export function bossPhaseTint(phase: number): number {
  return phase >= 3 ? 0xffb2a3 : phase >= 2 ? 0xffdfc7 : 0xffffff;
}

/** Gameplay fires immediately; ranged/melee playback begins at its release/contact pose. */
export function rangedShotTiming(clip?: RangedTiming): { offset: number; duration: number } {
  const durations = clip?.durations.length ? clip.durations : [200];
  const authoredRelease = clip?.releaseFrame ?? clip?.attackContactFrame ?? 0;
  const release = Number.isFinite(authoredRelease) ? Math.min(durations.length - 1, Math.max(0, Math.floor(authoredRelease))) : 0;
  let offset = 0;
  let duration = 0;
  for (let frame = 0; frame < durations.length; frame++) {
    if (frame < release) offset += durationWeight(durations[frame]);
    else duration += durationWeight(durations[frame]);
  }
  return { offset, duration };
}

export function actionElapsedMs(age: number, total: number, duration: number, offset = 0): number {
  return offset + Math.max(0, age) * Math.max(0, total - offset) / Math.max(1, duration);
}

/** Offsets are authored relative to the common actor anchor, then mirrored with aim. */
export function projectileOrigin(x: number, ground: number, direction: number, scale: number, offset = { x: 10, y: -12 }): { x: number; y: number } {
  return { x: x + (direction < 0 ? -1 : 1) * offset.x * scale, y: ground + offset.y * scale };
}

export function gaitPhaseAfterDistance(phase: number, distance: number, stride: number, moving: boolean): number {
  return moving ? (phase + Math.abs(distance) / Math.max(1, stride)) % 1 : phase;
}

export function heroAnimationKey(walking: boolean, actionKey: string | null | undefined, actions: CharacterActions, priority = false): string {
  const priorityAction = priority || actionKey === actions.hurt || actionKey === actions.death;
  return walking && !priorityAction ? actions.move : actionKey ?? actions.idle;
}

/** Shift an active impact's origin when its visual recovery is held by freeze/stun. */
export function heldRecoveryStart(start: number, lastClock: number, clock: number, blocked: boolean): number {
  return start >= 0 && blocked ? start + Math.max(0, clock - lastClock) : start;
}

/** Keep every death pose visible before fading the finished strip. */
export function deathVisuals(animationDurationMs: number, ageMs: number): { alpha: number; shadowAlpha: number; done: boolean } {
  const age = Math.max(0, ageMs);
  const fadeStart = Math.max(0, animationDurationMs) + 80;
  const alpha = 1 - Math.min(1, Math.max(0, (age - fadeStart) / 240));
  return { alpha, shadowAlpha: alpha * 0.5, done: age >= fadeStart + 240 };
}

function attackDurations(clip?: AttackTiming): readonly number[] {
  if (clip === undefined) return DEFAULT_ATTACK_DURATIONS;
  return Array.isArray(clip?.durations) && clip.durations.length ? clip.durations : [1];
}

function durationWeight(duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

export function attackContactFrame(clip?: AttackTiming): number {
  const count = attackDurations(clip).length;
  const contact = clip?.attackContactFrame;
  return Number.isFinite(contact) ? Math.min(count - 1, Math.max(0, Math.floor(contact!))) : Math.floor(count / 2);
}

function weightedFrame(durations: readonly number[], first: number, last: number, progress: number): number {
  const fraction = Number.isNaN(progress) ? 0 : Math.min(1, Math.max(0, progress));
  let total = 0;
  for (let frame = first; frame <= last; frame++) total += durationWeight(durations[frame]);
  let end = 0;
  for (let frame = first; frame < last; frame++) {
    end += durationWeight(durations[frame]);
    if (fraction < end / total) return frame;
  }
  return last;
}

/** Windup only visits pre-contact poses, using the clip's own timing weights. */
export function attackAnticipationFrame(progress: number, clip?: AttackTiming): number {
  const contact = attackContactFrame(clip);
  return contact === 0 ? 0 : weightedFrame(attackDurations(clip), 0, contact - 1, progress);
}

/** Impact starts exactly at the clip's contact pose, followed by weighted settling. */
export function attackRecoveryFrame(ageMs: number, recoveryMs = 260, clip?: AttackTiming): number {
  const duration = Number.isFinite(recoveryMs) ? Math.max(1, recoveryMs) : 260;
  const durations = attackDurations(clip);
  return weightedFrame(durations, attackContactFrame(clip), durations.length - 1, ageMs / duration);
}

/** Remove any live recoil/windup transform before drawing a death strip. */
export function resetDeathPose(sprite: DeathSprite, shadow: DeathShadow, x: number, ground: number, scale: number): void {
  sprite.setPosition(x, ground);
  sprite.setAngle(0);
  sprite.setScale(scale);
  sprite.setTint(0xffffff);
  sprite.setAlpha(1);
  shadow.setPosition(x, ground + 3);
  shadow.setAlpha(0.5);
}
