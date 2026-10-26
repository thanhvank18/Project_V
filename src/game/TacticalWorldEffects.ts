import type Phaser from 'phaser';

type Graphics = Phaser.GameObjects.Graphics;
export interface WorldPropVisual {
  id: number; kind: 'barrel' | 'gate' | 'healing-zone'; x: number; radius: number;
  state: 'idle' | 'active' | 'used' | 'open' | 'closed'; charges: number; progress: number;
}
export interface TelegraphVisual {
  kind: 'slam' | 'charge' | 'ranged' | 'summon'; x: number; targetX: number;
  from?: number; to?: number; radius: number; progress: number; phase: number;
}
export interface RoleVisual { role: 'melee' | 'shield' | 'ranged' | 'summoner'; x: number; height: number; direction: number; formationId?: number }
interface WorldBurst { x: number; kind: 'explosion' | 'heal' | 'gate' | 'summon'; at: number; radius: number }
const GROUND = 490;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const pixel = (g: Graphics, x: number, y: number, width: number, height: number, color: number, alpha = 1) =>
  g.fillStyle(color, alpha).fillRect(Math.round(x), Math.round(y), width, height);

/** Fixed world coordinates and two bounded drawing surfaces; no scene timers or hit decisions. */
export class TacticalWorldEffects {
  private ground: Graphics;
  private foreground: Graphics;
  private bursts: WorldBurst[] = [];
  constructor(scene: Phaser.Scene, world: Phaser.GameObjects.Container) {
    this.ground = scene.add.graphics().setDepth(4);
    this.foreground = scene.add.graphics().setDepth(18);
    world.add([this.ground, this.foreground]);
  }
  get burstCount(): number { return this.bursts.length; }
  reset(): void { this.bursts = []; this.ground.clear(); this.foreground.clear(); }
  emit(kind: WorldBurst['kind'], x: number, at: number, radius = 80): void {
    if (![x, at, radius].every(Number.isFinite)) return;
    this.bursts.push({ kind, x, at, radius: clamp(radius, 20, 420) });
    if (this.bursts.length > 16) this.bursts.shift();
  }
  render(clock: number, reduced: boolean, props: readonly WorldPropVisual[], telegraphs: readonly TelegraphVisual[],
    roles: readonly RoleVisual[], cameraX = 0, selectedId?: number): void {
    this.ground.clear(); this.foreground.clear();
    const visible = (x: number, radius = 80) => x + radius >= cameraX - 30 && x - radius <= cameraX + 1310;
    for (const prop of props) if (visible(prop.x, prop.radius)) this.prop(prop, selectedId === prop.id, clock, reduced);
    for (const telegraph of telegraphs) if (visible(telegraph.targetX, Math.max(telegraph.radius, Math.abs(telegraph.targetX - telegraph.x)))) this.telegraph(telegraph, reduced);
    for (const role of roles) if (role.role !== 'melee' && visible(role.x)) this.role(role, clock, reduced);
    this.bursts = this.bursts.filter(burst => {
      const age = clock - burst.at;
      if (age < 0 || age >= 650) return false;
      if (visible(burst.x, burst.radius)) this.burst(burst, age / 650, reduced);
      return true;
    });
  }
  private prop(prop: WorldPropVisual, selected: boolean, clock: number, reduced: boolean): void {
    const g = this.ground, f = this.foreground, x = prop.x;
    const used = prop.state === 'used' || prop.charges <= 0;
    if (prop.kind === 'healing-zone') {
      const radius = Math.max(30, prop.radius);
      const alpha = used ? .13 : .24;
      g.fillStyle(used ? 0x536d64 : 0x75d5ad, alpha).fillEllipse(x, GROUND + 8, radius * 2, 32);
      g.lineStyle(2, used ? 0x6b8980 : 0xa4f1ce, used ? .35 : .85).strokeEllipse(x, GROUND + 8, radius * 2, 32, 32);
      // A small first-aid sign reads as a place on the road, rather than a floating pickup.
      pixel(g, x - 3, GROUND - 46, 6, 51, 0x314c48);
      pixel(g, x - 18, GROUND - 55, 36, 28, used ? 0x314d46 : 0x285c4c);
      pixel(g, x - 3, GROUND - 51, 6, 20, used ? 0x75958a : 0xc4ffe2);
      pixel(g, x - 10, GROUND - 44, 20, 6, used ? 0x75958a : 0xc4ffe2);
      if (prop.state === 'active') {
        pixel(g, x - 30, GROUND + 27, 60, 3, 0x223e36);
        pixel(g, x - 30, GROUND + 27, 60 * clamp(prop.progress, 0, 1), 3, 0xb5f5ce);
        if (!reduced) for (let index = 0; index < 3; index++) {
          const rise = (clock / 30 + index * 19) % 48;
          pixel(f, x - 22 + index * 22, GROUND - 10 - rise, 3, 7, 0xb5f5ce, .5);
        }
      }
      return;
    }
    if (prop.kind === 'gate') {
      pixel(g, x - 27, GROUND - 76, 8, 82, 0x2a3d47);
      pixel(g, x + 19, GROUND - 76, 8, 82, 0x2a3d47);
      pixel(g, x - 28, GROUND - 82, 56, 9, 0x6c7972);
      const opened = prop.state === 'open';
      if (!opened) {
        for (let index = 0; index < 4; index++) pixel(g, x - 18 + index * 11, GROUND - 70, 4, 69, 0x6e8b8b);
        pixel(g, x - 22, GROUND - 58, 44, 5, 0xc49363);
        pixel(g, x - 22, GROUND - 20, 44, 5, 0xc49363);
        pixel(g, x - 7, GROUND - 44, 14, 17, 0xf1c27c);
        pixel(g, x - 2, GROUND - 39, 4, 7, 0x4a4846);
      } else {
        pixel(g, x - 25, GROUND - 70, 6, 70, 0x84b39e);
        pixel(g, x + 19, GROUND - 70, 6, 70, 0x84b39e);
        g.lineStyle(2, 0xa4e6ca, .7).lineBetween(x - 13, GROUND + 10, x + 13, GROUND + 10);
      }
      return;
    }
    if (used) {
      pixel(g, x - 23, GROUND - 5, 46, 8, 0x684637);
      pixel(g, x - 12, GROUND - 10, 8, 8, 0xa6754b);
      return;
    }
    g.fillStyle(0x081b23, .5).fillEllipse(x, GROUND + 6, 52, 15);
    pixel(g, x - 20, GROUND - 44, 40, 45, selected ? 0xa96e42 : 0x805139);
    pixel(g, x - 15, GROUND - 43, 7, 43, 0xb28050);
    for (const y of [-43, -27, -6]) pixel(g, x - 22, GROUND + y, 44, 5, 0x34474c);
    pixel(g, x - 8, GROUND - 24, 16, 14, 0xe7bd6d);
    // Angular hazard mark; no new texture or Unicode icon dependency.
    f.fillStyle(0x473c36, 1).fillTriangle(x, GROUND - 23, x - 6, GROUND - 12, x + 6, GROUND - 12);
    pixel(f, x - 1, GROUND - 20, 2, 5, 0xf1d08b);
    if (selected) {
      g.fillStyle(0xffcb8a, .07).fillEllipse(x, GROUND + 7, prop.radius * 2, 28);
      g.lineStyle(1.5, 0xffd17e, .65).strokeEllipse(x, GROUND + 7, prop.radius * 2, 28, 32);
      g.lineStyle(2, 0xffd17e, .85).strokeEllipse(x, GROUND + 7, 64, 18, 20);
    }
  }
  private telegraph(t: TelegraphVisual, reduced: boolean): void {
    const g = this.ground, f = this.foreground;
    const p = clamp(t.progress, 0, 1), color = t.phase >= 3 ? 0xff8f86 : t.phase === 2 ? 0xffb873 : 0xffd59b;
    if (t.kind === 'charge') {
      const from = t.from ?? t.x, to = t.to ?? t.targetX;
      const left = Math.min(from, to) - t.radius, width = Math.max(20, Math.abs(to - from) + t.radius * 2);
      const direction = to >= from ? 1 : -1;
      g.fillStyle(color, .09 + p * .1).fillRect(left, GROUND - 5, width, 28);
      g.lineStyle(2, color, .8).lineBetween(left, GROUND - 5, left + width, GROUND - 5);
      g.lineBetween(left, GROUND + 23, left + width, GROUND + 23);
      for (let index = 0; index < Math.min(12, Math.ceil(width / 65)); index++) {
        const x = from + direction * (20 + index * 65);
        if (Math.abs(x - from) > Math.abs(to - from)) break;
        const drift = reduced ? 0 : p * 8;
        g.lineStyle(2, color, .6).lineBetween(x + direction * drift, GROUND + 3, x + direction * (10 + drift), GROUND + 9);
        g.lineBetween(x + direction * (10 + drift), GROUND + 9, x + direction * drift, GROUND + 15);
      }
      const end = to + direction * t.radius;
      g.lineStyle(3, color, .95).lineBetween(end, GROUND - 15, end, GROUND + 30);
    } else if (t.kind === 'slam') {
      const radius = Math.max(20, t.radius);
      g.fillStyle(color, .1 + p * .12).fillEllipse(t.targetX, GROUND + 6, radius * 2, 34);
      g.lineStyle(p > .8 ? 3 : 2, color, .7 + p * .25).strokeEllipse(t.targetX, GROUND + 6, radius * 2, 34, 32);
      for (const side of [-1, 1]) g.lineBetween(t.targetX + side * radius, GROUND - 9, t.targetX + side * radius, GROUND + 24);
      pixel(g, t.targetX - radius, GROUND + 28, radius * 2 * p, 3, color, .85);
      const width = reduced ? 50 : 50 + (1 - p) * Math.max(0, radius * 2 - 50);
      g.lineStyle(1.5, 0xffead0, .75).strokeEllipse(t.targetX, GROUND + 6, width, 23, 24);
    } else if (t.kind === 'ranged') {
      const y = GROUND - 50;
      g.lineStyle(1.5, 0xdcb3f0, .25 + p * .35).lineBetween(t.x, y, t.targetX, y);
      g.lineStyle(2, 0xe5c0f5, .75).strokeEllipse(t.targetX, GROUND + 7, 60, 18, 20);
      // A locked aim marker remains legible in reduced motion, without tracking the player.
      f.lineStyle(2, 0xf0b9e3, .7).lineBetween(t.targetX - 10, y - 10, t.targetX + 10, y + 10);
      f.lineBetween(t.targetX - 10, y + 10, t.targetX + 10, y - 10);
    } else {
      g.lineStyle(2, 0xc3a5fb, .5 + p * .4).strokeEllipse(t.x, GROUND + 7, 82, 24, 24);
      for (const side of [-1, 1]) pixel(f, t.x + side * 28, GROUND - 28, 5, 16, 0xc3a5fb, .75);
    }
  }
  private role(role: RoleVisual, clock: number, reduced: boolean): void {
    const g = this.foreground, x = role.x, y = GROUND - Math.min(175, role.height) - 9;
    const color = role.role === 'ranged' ? 0xe2b7f1 : role.role === 'summoner' ? 0xc8b0ff : 0xacd9ef;
    const dy = reduced ? 0 : Math.sin(clock / 350) * 1.5;
    if (role.role === 'summoner') {
      for (const offset of [-9, 0, 9]) pixel(g, x + offset - 2, y + dy + (offset ? 0 : -4), 4, 8, color, .85);
    } else if (role.role === 'ranged') {
      g.lineStyle(2, color, .85).lineBetween(x - 9, y - 7 + dy, x + 8, y + 7 + dy);
      g.lineBetween(x - 9, y + 7 + dy, x + 8, y - 7 + dy);
      g.lineBetween(x - 11, y + dy, x + 11, y + dy);
    } else {
      g.lineStyle(2, color, .9).lineBetween(x - 8, y - 7, x + 8, y - 7);
      g.lineBetween(x - 8, y - 7, x - 6, y + 3); g.lineBetween(x + 8, y - 7, x + 6, y + 3);
      g.lineBetween(x - 6, y + 3, x, y + 9); g.lineBetween(x + 6, y + 3, x, y + 9);
    }
    if (role.formationId !== undefined) for (let i = 0; i < 2; i++) pixel(this.ground, x - 9 + i * 12, GROUND + 15, 6, 2, color, .65);
  }
  private burst(b: WorldBurst, p: number, reduced: boolean): void {
    const g = this.ground, f = this.foreground, fade = (1 - p) ** 1.2;
    const color = b.kind === 'explosion' ? 0xffbd76 : b.kind === 'summon' ? 0xc3a5fb : 0xa3ebc7;
    const radius = reduced ? 22 : 16 + (b.radius - 16) * (1 - (1 - p) ** 3);
    if (b.kind === 'explosion') g.lineStyle(1.5, color, fade * .25).strokeEllipse(b.x, GROUND + 4, b.radius * 2, 30, 32);
    g.lineStyle(reduced ? 2 : 3, color, fade * .85).strokeEllipse(b.x, GROUND + 4, radius * 2, Math.min(40, radius * .4), 24);
    const count = reduced ? 4 : 8;
    for (let index = 0; index < count; index++) {
      const angle = index * Math.PI * 2 / count;
      const x = b.x + Math.cos(angle) * radius * .65;
      const y = GROUND - 18 + Math.sin(angle) * radius * .4 - (reduced ? 0 : p * 22);
      pixel(f, x, y, 4, b.kind === 'heal' ? 9 : 4, color, fade);
    }
  }
}
