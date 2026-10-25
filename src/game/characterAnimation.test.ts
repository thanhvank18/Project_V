import { describe, expect, it } from 'vitest';
import { actionElapsedMs, attackAnticipationFrame, attackContactFrame, attackRecoveryFrame, bossPhaseTint, characterHitPoint, characterShadow, characterVisualHeight, deathVisuals, gaitPhaseAfterDistance, heldRecoveryStart, heroAnimationKey, projectileOrigin, rangedShotTiming, resetDeathPose } from './characterAnimation';
import type { AttackTiming, CharacterActions } from './characterAnimation';

const soldierActions: CharacterActions = { idle: 'soldier-idle', move: 'soldier-move', attack: 'soldier-attack', hurt: 'soldier-hurt', death: 'soldier-death' };

describe('native boss presentation', () => {
  it('distinguishes phases through tint without needing armor-shedding clips', () => {
    expect(bossPhaseTint(1)).toBe(0xffffff);
    expect(bossPhaseTint(2)).toBe(0xffdfc7);
    expect(bossPhaseTint(3)).toBe(0xffb2a3);
    expect(bossPhaseTint(4)).toBe(bossPhaseTint(3));
  });
});

describe('native bow release presentation', () => {
  const bow = { durations: Array(9).fill(100), releaseFrame: 7 };

  it('starts at release immediately and plays only the authored follow-through', () => {
    const timing = rangedShotTiming(bow);
    expect(timing).toEqual({ offset: 700, duration: 200 });
    expect(actionElapsedMs(0, 900, timing.duration, timing.offset)).toBe(700);
    expect(actionElapsedMs(100, 900, timing.duration, timing.offset)).toBe(800);
    expect(actionElapsedMs(200, 900, timing.duration, timing.offset)).toBe(900);
    expect(actionElapsedMs(-10, 900, timing.duration, timing.offset)).toBe(700);
  });

  it('keeps variable native release timings and clamps a malformed release index', () => {
    expect(rangedShotTiming({ durations: [40, 60, 80, 100], releaseFrame: 2 })).toEqual({ offset: 100, duration: 180 });
    expect(rangedShotTiming({ durations: [40, 60], releaseFrame: 99 })).toEqual({ offset: 40, duration: 60 });
    expect(rangedShotTiming({ durations: [40, 60], releaseFrame: -1 })).toEqual({ offset: 0, duration: 100 });
    expect(rangedShotTiming({ durations: [] })).toEqual({ offset: 0, duration: 200 });
    expect(actionElapsedMs(150, 300, 300)).toBe(150);
  });

  it('mirrors the authored bow tip around the actor anchor while preserving ground height', () => {
    const offset = { x: 8, y: -10 };
    expect(projectileOrigin(640, 490, 1, 6, offset)).toEqual({ x: 688, y: 430 });
    expect(projectileOrigin(640, 490, -1, 6, offset)).toEqual({ x: 592, y: 430 });
    expect(projectileOrigin(1000, 490, 1, 6, offset).x - projectileOrigin(640, 490, 1, 6, offset).x).toBe(360);
    expect(projectileOrigin(640, 490, 1, 5, offset)).toEqual({ x: 680, y: 440 });
  });

  it('uses a melee contact pose for immediate magic-letter follow-through', () => {
    const timing = rangedShotTiming({ durations: [40, 60, 80, 100, 120], attackContactFrame: 3 });
    expect(timing).toEqual({ offset: 180, duration: 220 });
    expect(actionElapsedMs(0, 400, timing.duration, timing.offset)).toBe(180);
    expect(rangedShotTiming({ durations: [40, 60, 80], attackContactFrame: 1, releaseFrame: 2 })).toEqual({ offset: 100, duration: 80 });
  });
});

describe('per-character geometry', () => {
  const small = { displayScale: 5, bodyHeight: 20, bodyWidth: 12, hitOffset: { x: 2, y: -12 } };
  const boss = { displayScale: 10, bodyHeight: 19, bodyWidth: 24, hitOffset: { x: -1, y: -9 } };

  it('uses each native actor scale for labels, impact anchors and shadows', () => {
    expect(characterVisualHeight(small)).toBe(100);
    expect(characterVisualHeight(boss)).toBe(190);
    expect(characterHitPoint(400, 490, small)).toEqual({ x: 410, y: 430 });
    expect(characterHitPoint(400, 490, small, -1)).toEqual({ x: 390, y: 430 });
    expect(characterHitPoint(400, 490, boss)).toEqual({ x: 390, y: 400 });
    expect(characterShadow(small)).toEqual({ width: 45, height: 9 });
    expect(characterShadow(boss)).toEqual({ width: 180, height: 25 });
  });

});

describe('movement and action presentation', () => {
  it('advances a full 84px stride or half of it by actual distance in either direction', () => {
    expect(gaitPhaseAfterDistance(0, 84, 84, true)).toBe(0);
    expect(gaitPhaseAfterDistance(0, 42, 84, true)).toBe(0.5);
    expect(gaitPhaseAfterDistance(0, -42, 84, true)).toBe(0.5);
    expect(gaitPhaseAfterDistance(0.75, 42, 84, true)).toBe(0.25);
  });

  it('preserves the gait phase while stationary or paused, even if position was corrected', () => {
    expect(gaitPhaseAfterDistance(0.375, 0, 84, true)).toBe(0.375);
    expect(gaitPhaseAfterDistance(0.375, 100, 84, false)).toBe(0.375);
    expect(gaitPhaseAfterDistance(0.375, 0, 84, false)).toBe(0.375);
    expect(gaitPhaseAfterDistance(0.25, 0.5, 0, true)).toBe(0.75);
  });

  it.each([undefined, null, soldierActions.attack, soldierActions.idle])('retains walking poses over action %s', action => {
    expect(heroAnimationKey(true, action, soldierActions)).toBe(soldierActions.move);
  });

  it.each([soldierActions.hurt, soldierActions.death])('lets %s interrupt the walking pose', action => {
    expect(heroAnimationKey(true, action, soldierActions)).toBe(action);
  });

  it('uses idle or the current action when stopped', () => {
    expect(heroAnimationKey(false, undefined, soldierActions)).toBe(soldierActions.idle);
    expect(heroAnimationKey(false, null, soldierActions)).toBe(soldierActions.idle);
    expect(heroAnimationKey(false, soldierActions.attack, soldierActions)).toBe(soldierActions.attack);
    expect(heroAnimationKey(true, soldierActions.idle, soldierActions, true)).toBe(soldierActions.idle);
  });

  it('resolves priorities from a different hero without mixing Soldier artwork', () => {
    const mage: CharacterActions = { idle: 'mage-idle', move: 'mage-move', attack: 'mage-attack', hurt: 'mage-hurt', death: 'mage-death' };
    expect(heroAnimationKey(false, undefined, mage)).toBe(mage.idle);
    expect(heroAnimationKey(true, mage.attack, mage)).toBe(mage.move);
    expect(heroAnimationKey(true, mage.hurt, mage)).toBe(mage.hurt);
    expect(heroAnimationKey(true, mage.death, mage)).toBe(mage.death);
  });
});

describe('held attack recovery', () => {
  it('holds the contact pose through freeze/stun, then resumes the remaining recovery', () => {
    let start = 1000;
    expect(attackRecoveryFrame(1040 - start)).toBe(4);
    start = heldRecoveryStart(start, 1040, 1140, true);
    expect(1140 - start).toBe(40);
    expect(attackRecoveryFrame(1140 - start)).toBe(4);
    start = heldRecoveryStart(start, 1140, 1340, true);
    expect(1340 - start).toBe(40);
    expect(attackRecoveryFrame(1340 - start)).toBe(4);
    start = heldRecoveryStart(start, 1340, 1365, false);
    expect(attackRecoveryFrame(1365 - start)).toBe(5);
    expect(attackRecoveryFrame(1425 - start)).toBe(6);
    expect(attackRecoveryFrame(1490 - start)).toBe(7);
    expect(1559 - start).toBe(259);
    expect(1560 - start).toBe(260);
  });

  it('leaves the recovery origin unchanged when pause stops the supplied clock', () => {
    const start = heldRecoveryStart(1000, 1040, 1040, true);
    expect(start).toBe(1000);
    expect(attackRecoveryFrame(1040 - start)).toBe(4);
  });

  it('does not revive an inactive recovery or shift an unblocked or rewound clock', () => {
    expect(heldRecoveryStart(-1000, 100, 300, true)).toBe(-1000);
    expect(heldRecoveryStart(0, 100, 300, false)).toBe(0);
    expect(heldRecoveryStart(1000, 1200, 1100, true)).toBe(1000);
    expect(heldRecoveryStart(0, 100, 300, true)).toBe(200);
  });
});

describe('character animation timing', () => {
  it.each([600, 900, 1030])('keeps the complete %ims death strip and final hold before fading', duration => {
    for (const age of [-10, 0, duration - 1, duration, duration + 79, duration + 80]) {
      expect(deathVisuals(duration, age)).toEqual({ alpha: 1, shadowAlpha: 0.5, done: false });
    }
    expect(deathVisuals(duration, duration + 200)).toEqual({ alpha: 0.5, shadowAlpha: 0.25, done: false });
    const beforeEnd = deathVisuals(duration, duration + 319);
    expect(beforeEnd.alpha).toBeGreaterThan(0);
    expect(beforeEnd.done).toBe(false);
    expect(deathVisuals(duration, duration + 320)).toEqual({ alpha: 0, shadowAlpha: 0, done: true });
    expect(deathVisuals(duration, duration + 5000)).toEqual({ alpha: 0, shadowAlpha: 0, done: true });
  });

  it('clamps a negative death duration without removing the final hold or fade', () => {
    expect(deathVisuals(-100, -10)).toEqual({ alpha: 1, shadowAlpha: 0.5, done: false });
    expect(deathVisuals(-100, 200)).toEqual({ alpha: 0.5, shadowAlpha: 0.25, done: false });
    expect(deathVisuals(-100, 320).done).toBe(true);
  });

  it.each([
    [-1, 0], [0, 0], [0.2499, 0], [0.25, 1], [0.4999, 1],
    [0.5, 2], [0.7499, 2], [0.75, 3], [1, 3], [10, 3],
  ])('maps windup progress %s to anticipation frame %s', (progress, frame) => {
    expect(attackAnticipationFrame(progress)).toBe(frame);
  });

  it.each([
    [-100, 4], [0, 4], [64.999, 4], [65, 5], [124.999, 5],
    [125, 6], [189.999, 6], [190, 7], [259.999, 7], [260, 7], [10_000, 7],
  ])('maps impact age %sms to recovery frame %s', (age, frame) => {
    expect(attackRecoveryFrame(age)).toBe(frame);
  });

  it('scales contact and settling timing with the supplied recovery duration', () => {
    expect(attackRecoveryFrame(129, 520)).toBe(4);
    expect(attackRecoveryFrame(130, 520)).toBe(5);
    expect(attackRecoveryFrame(249, 520)).toBe(5);
    expect(attackRecoveryFrame(250, 520)).toBe(6);
    expect(attackRecoveryFrame(380, 520)).toBe(7);
    expect(attackRecoveryFrame(520, 520)).toBe(7);
  });

  it('reaches all eight attack poses without advancing contact during windup', () => {
    const frames = [0, 0.25, 0.5, 0.75].map(progress => attackAnticipationFrame(progress));
    frames.push(...[0, 65, 125, 190].map(age => attackRecoveryFrame(age)));
    expect(frames).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('native attack clip timing', () => {
  it('uses the designated contact in a six-frame native clip with uneven durations', () => {
    const clip: AttackTiming = { durations: [30, 90, 20, 40, 60, 80], attackContactFrame: 2 };
    expect(attackContactFrame(clip)).toBe(2);
    expect(attackAnticipationFrame(0.249, clip)).toBe(0);
    expect(attackAnticipationFrame(0.25, clip)).toBe(1);
    expect(attackAnticipationFrame(1, clip)).toBe(1);
    expect(attackRecoveryFrame(0, 200, clip)).toBe(2);
    expect(attackRecoveryFrame(19.999, 200, clip)).toBe(2);
    expect(attackRecoveryFrame(20, 200, clip)).toBe(3);
    expect(attackRecoveryFrame(60, 200, clip)).toBe(4);
    expect(attackRecoveryFrame(120, 200, clip)).toBe(5);
    expect(attackRecoveryFrame(200, 200, clip)).toBe(5);
  });

  it('supports a ten-frame clip whose contact is beyond the midpoint', () => {
    const clip: AttackTiming = { durations: [10, 10, 10, 10, 10, 10, 60, 10, 20, 70], attackContactFrame: 7 };
    expect(attackContactFrame(clip)).toBe(7);
    expect(attackAnticipationFrame(0.49, clip)).toBe(5);
    expect(attackAnticipationFrame(0.5, clip)).toBe(6);
    expect(attackAnticipationFrame(1, clip)).toBe(6);
    expect(attackRecoveryFrame(0, 200, clip)).toBe(7);
    expect(attackRecoveryFrame(20, 200, clip)).toBe(8);
    expect(attackRecoveryFrame(60, 200, clip)).toBe(9);
  });

  it.each(Array.from({ length: 12 }, (_, index) => index + 1))('keeps a %i-frame clip in range and separates windup from impact', count => {
    const clip = { durations: Array.from({ length: count }, (_, index) => (index + 1) * 20) };
    const contact = attackContactFrame(clip);
    expect(contact).toBe(Math.floor(count / 2));
    expect(attackRecoveryFrame(0, 260, clip)).toBe(contact);
    for (const progress of [-10, 0, 0.01, 0.25, 0.5, 0.75, 0.99, 1, 10, NaN]) {
      const frame = attackAnticipationFrame(progress, clip);
      expect(Number.isInteger(frame)).toBe(true);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThanOrEqual(Math.max(0, contact - 1));
    }
    for (const age of [-10, 0, 1, 65, 125, 190, 260, 10000, NaN]) {
      const frame = attackRecoveryFrame(age, 260, clip);
      expect(Number.isInteger(frame)).toBe(true);
      expect(frame).toBeGreaterThanOrEqual(contact);
      expect(frame).toBeLessThan(count);
    }
  });

  it('clamps contact metadata and keeps malformed or empty clips on a valid frame', () => {
    expect(attackContactFrame()).toBe(4);
    expect(attackContactFrame({ durations: [10, 10, 10], attackContactFrame: -4 })).toBe(0);
    expect(attackContactFrame({ durations: [10, 10, 10], attackContactFrame: 99 })).toBe(2);
    expect(attackContactFrame({ durations: [10, 10, 10], attackContactFrame: 1.9 })).toBe(1);
    for (const clip of [{ durations: [] }, { durations: [NaN, 0, -20, Infinity], attackContactFrame: NaN }]) {
      const count = Math.max(1, clip.durations.length);
      for (const progress of [NaN, -Infinity, 0, 0.5, 1, Infinity]) {
        const frame = attackAnticipationFrame(progress, clip);
        expect(Number.isInteger(frame)).toBe(true);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(count);
      }
      for (const age of [NaN, -Infinity, 0, 130, 260, Infinity]) {
        const frame = attackRecoveryFrame(age, NaN, clip);
        expect(Number.isInteger(frame)).toBe(true);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(count);
      }
    }
  });

});

describe('character death pose', () => {
  it.each([
    ['small-native', 5], ['medium-native', 6.5], ['large-native', 10],
  ] as const)('restores %s from recoil to its catalog-scaled grounded pose', (_name, scale) => {
    const sprite = {
      x: 402, y: 420, angle: 9, scaleX: 1.4, scaleY: 0.8, tint: 0xffe1b0, alpha: 0.66,
      setPosition(x: number, y: number): void { this.x = x; this.y = y; },
      setAngle(angle: number): void { this.angle = angle; },
      setScale(value: number): void { this.scaleX = value; this.scaleY = value; },
      setTint(tint: number): void { this.tint = tint; },
      setAlpha(alpha: number): void { this.alpha = alpha; },
    };
    const shadow = {
      x: 395, y: 497, alpha: 0.2,
      setPosition(x: number, y: number): void { this.x = x; this.y = y; },
      setAlpha(alpha: number): void { this.alpha = alpha; },
    };
    resetDeathPose(sprite, shadow, 400, 490, scale);
    expect(sprite).toMatchObject({ x: 400, y: 490, angle: 0, scaleX: scale, scaleY: scale, tint: 0xffffff, alpha: 1 });
    expect(shadow).toMatchObject({ x: 400, y: 493, alpha: 0.5 });
  });
});
