import type Phaser from 'phaser';
import type { AttackKind, EnemyKind, GameEvent } from './types';

const GROUND = 490;
const MAX_IMPACTS = 24;
interface AttackImpact {
  kind: EnemyKind; x: number; targetX: number; contactX: number; contactY: number; hit: boolean; radius: number;
  phase: number; start: number; seed: number;
  attackKind?: AttackKind; laneFrom?: number; laneTo?: number;
  contactOnly?: boolean;
}

/** Two shared drawing surfaces, bounded bursts, and no timers independent of the game clock. */
export class AttackEffects {
  private ground: Phaser.GameObjects.Graphics;
  private foreground: Phaser.GameObjects.Graphics;
  private impacts: AttackImpact[] = [];

  constructor(scene: Phaser.Scene, world: Phaser.GameObjects.Container) {
    this.ground = scene.add.graphics().setDepth(4);
    this.foreground = scene.add.graphics().setDepth(18);
    world.add([this.ground, this.foreground]);
  }

  reset(): void {
    this.impacts = [];
    this.ground.clear();
    this.foreground.clear();
  }

  record(event: GameEvent, clock: number, targetPoint?: { x: number; y: number }): void {
    if (event.type !== 'attack-impact' || !event.enemyKind || event.x === undefined) return;
    this.impacts.push({ kind: event.enemyKind, x: event.x, targetX: event.targetX ?? event.x,
      contactX: targetPoint?.x ?? event.targetX ?? event.x, contactY: targetPoint?.y ?? GROUND - 65,
      hit: event.hit === true, radius: event.radius ?? 0, phase: event.bossPhase ?? 1,
      start: clock, seed: event.enemyId ?? 0, attackKind: event.attackKind, laneFrom: event.laneFrom, laneTo: event.laneTo });
    if (this.impacts.length > MAX_IMPACTS) this.impacts.shift();
  }

  /** Multiplayer AoE reports victims individually; the aggregate slam must not invent a victim. */
  recordContact(event: GameEvent, clock: number, point: { x: number; y: number }): void {
    if (event.type !== 'player-hurt') return;
    this.impacts.push({ kind: event.enemyKind ?? 'normal', x: event.sourceX ?? point.x, targetX: point.x,
      contactX: point.x, contactY: point.y, hit: true, radius: 0, phase: event.bossPhase ?? 1,
      start: clock, seed: event.enemyId ?? 0, contactOnly: true });
    if (this.impacts.length > MAX_IMPACTS) this.impacts.shift();
  }

  render(clock: number, reduced: boolean): void {
    this.ground.clear();
    this.foreground.clear();
    this.impacts = this.impacts.filter(impact => {
      const age = clock - impact.start;
      const lifetime = impact.contactOnly ? reduced ? 180 : 280 : reduced ? 240 : impact.kind === 'tank' ? 820 : 320;
      if (age < 0 || age >= lifetime) return false;
      if (impact.contactOnly) { this.contact(impact, age, reduced); return true; }
      if (impact.attackKind === 'charge') this.charge(impact, age, reduced);
      else if (impact.attackKind === 'ranged' || impact.attackKind === 'summon') this.spell(impact, age, reduced);
      else if (impact.kind === 'tank') this.slam(impact, age, reduced);
      else this.swipe(impact, age, reduced);
      if (impact.hit && age < (reduced ? 180 : 280)) this.contact(impact, age, reduced);
      return true;
    });
  }

  private charge(impact: AttackImpact, age: number, reduced: boolean): void {
    const g = this.ground;
    const from = impact.laneFrom ?? impact.x, to = impact.laneTo ?? impact.targetX;
    const direction = to >= from ? 1 : -1, p = Math.min(1, age / 520), fade = (1 - p) ** 1.5;
    const width = Math.abs(to - from);
    g.lineStyle(reduced ? 2 : 4, impact.phase >= 3 ? 0xffa095 : 0xffcc89, fade * .8);
    for (const dy of [-4, 8, 20]) g.lineBetween(from, GROUND + dy, to, GROUND + dy);
    if (!reduced) for (let i = 0; i < Math.min(14, Math.ceil(width / 35)); i++) {
      const x = from + direction * Math.min(width, i * 35);
      g.fillStyle(0xf3c18c, fade * .6).fillRect(x, GROUND + 13 - p * 16, 5, 4);
    }
  }

  private spell(impact: AttackImpact, age: number, reduced: boolean): void {
    const g = this.foreground, p = Math.min(1, age / 320), fade = (1 - p) ** 1.4;
    const x = impact.attackKind === 'summon' ? impact.x : impact.targetX;
    const y = impact.attackKind === 'summon' ? GROUND - 12 : GROUND - 50;
    const r = reduced ? 9 : 9 + p * 20;
    g.lineStyle(2, 0xe5b9f1, fade * .8).strokeEllipse(x, y, r * 2, r, 20);
    for (const side of [-1, 1]) g.fillStyle(0xc6a1ef, fade).fillRect(x + side * r, y - r * .3, 3, 7);
  }

  private swipe(impact: AttackImpact, age: number, reduced: boolean): void {
    const g = this.foreground;
    const p = age / (reduced ? 240 : 320);
    const direction = impact.targetX >= impact.x ? 1 : -1;
    const x = impact.contactX - direction * 19;
    const y = impact.contactY;
    const alpha = (1 - p) * (impact.hit ? 0.95 : 0.4);
    const travel = reduced ? 0 : Math.min(1, p * 2.7) * 15;
    const length = impact.kind === 'runner' ? 48 : impact.kind === 'armored' ? 34 : 28;
    // Three tapered, angular claw strokes read at pixel-art scale without covering the word label.
    for (let index = 0; index < 3; index++) {
      const sx = x + direction * (index * 9 - 20 + travel);
      const sy = y + index * 8 - 16;
      g.fillStyle(0x602c3a, alpha * 0.8);
      g.fillTriangle(sx - direction * 5, sy - 8, sx + direction * (length + 3), sy + 12, sx, sy + 3);
      g.fillStyle(impact.kind === 'armored' ? 0xffd6a0 : 0xffad86, alpha);
      g.fillTriangle(sx, sy - 5, sx + direction * length, sy + 11, sx, sy);
      g.lineStyle(1.5, 0xfff1cf, alpha).lineBetween(sx + direction * 3, sy - 3, sx + direction * (length - 5), sy + 8);
    }
    if (!reduced && impact.kind === 'runner') {
      g.lineStyle(2, 0xf7c887, alpha * 0.45);
      g.lineBetween(impact.x - direction * 30, y + 14, x - direction * 10, y + 14);
    }
  }

  private contact(impact: AttackImpact, age: number, reduced: boolean): void {
    const g = this.foreground;
    const p = Math.min(1, age / (reduced ? 180 : 280));
    const x = impact.contactX;
    const y = impact.kind === 'tank' ? GROUND - 27 : impact.contactY;
    const radius = reduced ? 10 : 10 + Math.sin(Math.min(1, p * 2) * Math.PI / 2) * 17;
    const alpha = (1 - p) ** 1.4;
    g.fillStyle(0xfff1c4, alpha * 0.95).fillRect(x - 5, y - 5, 10, 10);
    for (let ray = 0; ray < (reduced ? 4 : 7); ray++) {
      const angle = ray * Math.PI * 2 / (reduced ? 4 : 7) + 0.25;
      const dx = Math.cos(angle); const dy = Math.sin(angle);
      g.fillStyle(ray % 2 ? 0xffbd8a : 0xfff2cc, alpha);
      g.fillTriangle(x + dx * radius, y + dy * radius,
        x - dy * 3 + dx * 7, y + dx * 3 + dy * 7,
        x + dy * 3 + dx * 7, y - dx * 3 + dy * 7);
      if (!reduced) {
        const distance = 18 + p * (ray % 2 ? 37 : 27);
        g.fillStyle(0xffc497, alpha * 0.8).fillRect(Math.round(x + dx * distance), Math.round(y + dy * distance + p * p * 15), 3, 3);
      }
    }
  }

  private slam(impact: AttackImpact, age: number, reduced: boolean): void {
    const g = this.ground;
    const f = this.foreground;
    const p = age / (reduced ? 240 : 820);
    const fade = (1 - p) ** 1.2;
    const radius = Math.max(0, impact.radius);
    const x = impact.x;
    const color = impact.phase === 3 ? 0xff8e73 : 0xffc780;
    // Cracks stay inside the same radius as the authoritative slam damage.
    for (const side of [-1, 1]) {
      for (let branch = 0; branch < 3; branch++) {
        let lastX = x; let lastY = GROUND + 5;
        const length = radius * (0.58 + branch * 0.16);
        for (let part = 1; part <= 4; part++) {
          const nextX = x + side * length * part / 4;
          const nextY = GROUND + 5 + (branch - 1) * part * 5 + (part % 2 ? 5 : -2);
          g.lineStyle(reduced ? 3 : 5, 0x1b242a, fade * 0.9).lineBetween(lastX, lastY, nextX, nextY);
          g.lineStyle(reduced ? 1 : 2, color, fade * 0.8).lineBetween(lastX, lastY - 1, nextX, nextY - 1);
          lastX = nextX; lastY = nextY;
        }
      }
    }
    if (reduced) {
      g.lineStyle(2, color, fade * 0.65).strokeEllipse(x, GROUND + 5, radius * 2, 32, 32);
      g.fillStyle(color, fade * 0.16).fillEllipse(x, GROUND + 5, 90, 18, 20);
      return;
    }
    const front = Math.min(1, age / 410);
    const spread = radius * (1 - (1 - front) ** 2);
    const waveAlpha = Math.max(0, 1 - age / 560);
    g.lineStyle(7, 0x302e35, waveAlpha * 0.8).strokeEllipse(x, GROUND + 6, Math.max(8, spread * 2), 20 + front * 35, 40);
    g.lineStyle(3, color, waveAlpha).strokeEllipse(x, GROUND + 3, Math.max(8, spread * 2), 18 + front * 35, 40);
    g.lineStyle(1.5, 0xfff0c2, waveAlpha * 0.9).strokeEllipse(x, GROUND + 3, Math.max(5, spread * 1.8), 12 + front * 24, 40);
    // A short central impact crown, then low rolling dust and ballistic pixel debris.
    const crown = Math.max(0, 1 - age / 230);
    for (let index = -2; index <= 2; index++) {
      f.fillStyle(index % 2 ? color : 0xffe8bc, crown * 0.9);
      f.fillTriangle(x + index * 15 - 10, GROUND, x + index * 20, GROUND - crown * (index === 0 ? 74 : 45), x + index * 15 + 10, GROUND);
    }
    for (const side of [-1, 1]) {
      for (let index = 0; index < 5; index++) {
        const travel = Math.min(radius - 16, 28 + p * (150 + index * 24));
        const dustX = Math.round(x + side * travel);
        const size = 11 + index * 3 + p * 10;
        const dustY = GROUND - Math.sin(Math.min(1, p * 1.4) * Math.PI) * (7 + index * 3);
        f.fillStyle(index % 2 ? 0xa89582 : 0x796e69, fade * 0.26);
        f.fillRect(dustX - size, Math.round(dustY - size / 2), size * 2, size * 0.7);
        f.fillRect(dustX - size * 0.7, Math.round(dustY - size * 0.8), size * 1.4, size * 0.6);
      }
    }
    for (let index = 0; index < 12; index++) {
      const side = index % 2 ? 1 : -1;
      const drift = side * (18 + p * (65 + (index % 6) * 28));
      const height = Math.sin(Math.min(1, p * 1.25) * Math.PI) * (26 + ((index + impact.seed) % 5) * 12);
      const size = index % 3 === 0 ? 6 : 4;
      f.fillStyle(index % 3 === 0 ? 0xffd39a : 0xa6a097, fade * 0.85);
      f.fillRect(Math.round(x + drift), Math.round(GROUND - height), size, size);
      f.fillStyle(0x3c4144, fade * 0.7).fillRect(Math.round(x + drift), Math.round(GROUND - height + size), size, 2);
    }
  }
}
