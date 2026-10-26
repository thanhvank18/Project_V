import type Phaser from 'phaser';

export interface EffectPoint { x: number; y: number }
export interface HeroProjectileVisual {
  heroId: string;
  from: EffectPoint;
  point: EffectPoint;
  previous: EffectPoint;
  target: EffectPoint;
  progress: number;
  /** Scale of the readable letter, not the native actor's display scale. */
  scale: number;
  reducedMotion: boolean;
}
export interface HeroSkillVisual {
  heroId: string;
  /** World-space actor anchor (feet), using the authoritative simulation clock. */
  x: number; y: number; at: number;
  direction?: number;
  id?: number;
  height?: number;
  visualKind?: 'pierce' | 'shockwave' | 'guard' | 'sanctuary' | 'lance' | 'heal' | 'volley' | 'repel' | 'frost';
  targetX?: number;
  radius?: number;
  duration?: number;
  targets?: { enemyId?: number; x: number; y?: number }[];
}

type Graphics = Phaser.GameObjects.Graphics;
type Weapon = 'arrow' | 'volley' | 'axe' | 'sword' | 'spear' | 'holy-spear' | 'holy-light' | 'blade' | 'arcane';
const MAX_BURSTS = 12;
const SKILL_LIFETIME = 750;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const weaponByHero: Record<string, Weapon> = {
  archer: 'arrow', soldier: 'volley', 'armored-axeman': 'axe', knight: 'sword', 'knight-templar': 'holy-spear',
  lancer: 'spear', priest: 'holy-light', swordsman: 'blade', wizard: 'arcane',
};
const colors = { silver: 0xd7eff7, gold: 0xffd17e, blue: 0x8ed3ff, green: 0xa6efc5, purple: 0xbda0ff };

function stroke(g: Graphics, color: number, alpha: number, width: number, a: EffectPoint, b: EffectPoint): void {
  g.lineStyle(width, color, clamp(alpha, 0, 1)).lineBetween(a.x, a.y, b.x, b.y);
}
function diamond(g: Graphics, x: number, y: number, radius: number, color: number, alpha: number): void {
  g.fillStyle(color, clamp(alpha, 0, 1));
  g.fillTriangle(x - radius, y, x, y - radius, x + radius, y);
  g.fillTriangle(x - radius, y, x, y + radius, x + radius, y);
}
function cross(g: Graphics, x: number, y: number, radius: number, color: number, alpha: number): void {
  g.fillStyle(color, clamp(alpha, 0, 1)).fillRect(x - radius * .22, y - radius, radius * .44, radius * 2);
  g.fillRect(x - radius, y - radius * .22, radius * 2, radius * .44);
}
function crescent(g: Graphics, x: number, y: number, radius: number, direction: number, color: number, alpha: number): void {
  // Angular ribbons fit the native pixel art and leave the glyph's central 24px clear.
  g.fillStyle(color, clamp(alpha, 0, 1));
  g.fillTriangle(x - direction * radius * .6, y - radius, x + direction * radius * .65, y, x - direction * radius * .2, y - radius * .3);
  g.fillTriangle(x + direction * radius * .65, y, x - direction * radius * .6, y + radius, x - direction * radius * .2, y + radius * .3);
}
function arrow(g: Graphics, point: EffectPoint, dx: number, dy: number, size: number, color: number, alpha: number): void {
  const at = (along: number, perpendicular = 0): EffectPoint => ({ x: point.x + dx * along - dy * perpendicular, y: point.y + dy * along + dx * perpendicular });
  stroke(g, color, alpha, 2, at(-34 * size), at(-14 * size));
  stroke(g, color, alpha, 2, at(14 * size), at(25 * size));
  const tip = at(29 * size), a = at(20 * size, 4 * size), b = at(20 * size, -4 * size);
  g.fillStyle(color, alpha).fillTriangle(tip.x, tip.y, a.x, a.y, b.x, b.y);
  stroke(g, color, alpha * .8, 2, at(-34 * size, -5 * size), at(-26 * size));
  stroke(g, color, alpha * .8, 2, at(-34 * size, 5 * size), at(-26 * size));
}

/** Stateless projectile ornaments and a bounded activation queue; no scene timers or independent tweens. */
export class HeroAttackEffects {
  private bursts: HeroSkillVisual[] = [];

  get activeSkillCount(): number { return this.bursts.length; }

  reset(): void { this.bursts = []; }

  emitSkill(skill: HeroSkillVisual): void {
    if (![skill.x, skill.y, skill.at].every(Number.isFinite)) return;
    if (skill.id !== undefined && this.bursts.some(burst => burst.id === skill.id)) return;
    this.bursts.push({ ...skill, height: Number.isFinite(skill.height) ? skill.height : undefined,
      direction: Number.isFinite(skill.direction) ? skill.direction : undefined,
      targetX: Number.isFinite(skill.targetX) ? skill.targetX : undefined,
      targets: skill.targets?.filter(target => Number.isFinite(target.x) && (target.y === undefined || Number.isFinite(target.y))).slice(0, 6).map(target => ({ ...target })) });
    if (this.bursts.length > MAX_BURSTS) this.bursts.splice(0, this.bursts.length - MAX_BURSTS);
  }

  /** Caller clears its shared surface once per frame; this helper never clears another effect's commands. */
  drawProjectile(g: Graphics, shot: HeroProjectileVisual): void {
    if (shot.progress < 0 || shot.progress >= 1 || ![shot.progress, shot.point.x, shot.point.y, shot.from.x, shot.from.y,
      shot.previous.x, shot.previous.y, shot.target.x, shot.target.y, shot.scale].every(Number.isFinite)) return;
    const vx = shot.point.x - shot.previous.x, vy = shot.point.y - shot.previous.y;
    const fallbackX = shot.target.x - shot.from.x, fallbackY = shot.target.y - shot.from.y;
    const length = Math.hypot(vx, vy), fallbackLength = Math.hypot(fallbackX, fallbackY) || 1;
    const dx = length > .001 ? vx / length : fallbackX / fallbackLength;
    const dy = length > .001 ? vy / length : fallbackY / fallbackLength;
    const direction = dx < 0 ? -1 : 1;
    const size = clamp(shot.scale, .75, 2);
    const { x, y } = shot.point, weapon = weaponByHero[shot.heroId] ?? 'arcane';
    const alpha = shot.reducedMotion ? .48 : .78;
    // Reduced motion keeps one compact weapon mark; the letter's own flight/size remains authoritative.
    if (shot.reducedMotion) {
      if (weapon === 'arrow' || weapon === 'volley' || weapon === 'spear' || weapon === 'holy-spear') {
        stroke(g, weapon === 'holy-spear' ? colors.gold : colors.silver, alpha, 2,
          { x: x - dx * 24 * size, y: y - dy * 24 * size }, { x: x - dx * 14 * size, y: y - dy * 14 * size });
        if (weapon === 'volley') for (const side of [-1, 1]) stroke(g, colors.blue, alpha * .7, 1.5,
          { x: x - dx * 28 * size - dy * side * 6 * size, y: y - dy * 28 * size + dx * side * 6 * size },
          { x: x - dx * 18 * size - dy * side * 6 * size, y: y - dy * 18 * size + dx * side * 6 * size });
      } else diamond(g, x - direction * 18 * size, y + 12 * size, 3 * size, weapon === 'holy-light' ? colors.gold : colors.purple, alpha);
      return;
    }
    if (weapon === 'arrow' || weapon === 'volley') {
      arrow(g, shot.point, dx, dy, size, weapon === 'volley' ? colors.blue : colors.gold, alpha);
      if (weapon === 'volley') for (const side of [-1, 1]) arrow(g,
        { x: x - dx * 12 * size - dy * side * 17 * size, y: y - dy * 12 * size + dx * side * 17 * size },
        dx, dy, size * .45, colors.blue, alpha * .6);
    } else if (weapon === 'spear' || weapon === 'holy-spear') {
      const color = weapon === 'holy-spear' ? colors.gold : colors.silver;
      stroke(g, color, alpha * .75, 2, { x: x - dx * 45 * size, y: y - dy * 45 * size }, { x: x - dx * 15 * size, y: y - dy * 15 * size });
      const front = { x: x + dx * 21 * size, y: y + dy * 21 * size };
      diamond(g, front.x, front.y, 6 * size, color, alpha);
      if (weapon === 'holy-spear') cross(g, x - direction * 26 * size, y - 11 * size, 4 * size, colors.gold, .55);
    } else if (weapon === 'axe') {
      const backX = x - direction * 25 * size;
      stroke(g, colors.gold, .6, 3, { x: backX - direction * 12 * size, y: y + 14 * size }, { x: backX, y: y - 13 * size });
      crescent(g, backX, y, 14 * size, direction, colors.gold, .7);
    } else if (weapon === 'sword' || weapon === 'blade') {
      crescent(g, x - direction * 25 * size, y, 16 * size, direction, weapon === 'blade' ? colors.blue : colors.silver, .6);
      if (weapon === 'blade') stroke(g, colors.blue, .4, 2, { x: x - direction * 39 * size, y: y + 14 * size }, { x: x - direction * 15 * size, y: y + 9 * size });
    } else if (weapon === 'holy-light') {
      cross(g, x - direction * 23 * size, y, 6 * size, colors.gold, .75);
      diamond(g, x, y - 18 * size, 3 * size, colors.green, .7);
    } else {
      const phase = shot.progress * Math.PI * 5;
      for (const side of [-1, 1]) diamond(g, x + Math.cos(phase) * 19 * size * side, y + Math.sin(phase) * 19 * size * side,
        3 * size, side < 0 ? colors.blue : colors.purple, .75);
      stroke(g, colors.purple, .4, 2, { x: x - direction * 39 * size, y: y - 3 }, { x: x - direction * 15 * size, y: y - 3 });
    }
  }

  drawSkills(g: Graphics, clock: number, reducedMotion: boolean): void {
    this.bursts = this.bursts.filter(skill => {
      const age = clock - skill.at;
      if (age < 0 || age >= SKILL_LIFETIME) return false;
      this.drawSkill(g, skill, age / SKILL_LIFETIME, reducedMotion);
      return true;
    });
  }

  private drawSkill(g: Graphics, skill: HeroSkillVisual, progress: number, reduced: boolean): void {
    const size = clamp((skill.height ?? 136) / 136, .65, 1.6);
    const direction = skill.direction === undefined ? (skill.targetX ?? skill.x + 1) >= skill.x ? 1 : -1 : skill.direction < 0 ? -1 : 1;
    const areaAtTarget = skill.heroId === 'wizard' || skill.heroId === 'armored-axeman';
    const x = areaAtTarget ? skill.targetX ?? skill.x : skill.x;
    const ground = skill.y, y = ground - clamp(skill.height ?? 136, 90, 220) * .5;
    const radius = Number.isFinite(skill.radius) ? clamp(skill.radius!, 0, 380) : 0;
    const fade = (1 - progress) ** 1.3;
    const motion = reduced ? 0 : Math.sin(Math.min(1, progress * 1.4) * Math.PI / 2);
    const spread = (26 + motion * 36) * size;
    const color = skill.heroId === 'wizard' ? colors.blue : skill.heroId === 'priest' ? colors.green
      : skill.heroId === 'soldier' ? colors.blue : colors.gold;
    const alpha = fade * (reduced ? .5 : .75);
    if ((areaAtTarget || skill.heroId === 'swordsman' || skill.heroId === 'knight-templar') && radius > 0) g.lineStyle(1.5, color, alpha * .7).strokeEllipse(x, ground + 4, radius * 2, 28, 32);
    // The reduced version keeps the same emblem fixed in space and only fades its alpha.
    if (reduced) {
      g.lineStyle(2, color, alpha).strokeEllipse(x, ground - 4, 90 * size, 22 * size, 24);
      if (skill.heroId === 'priest' || skill.heroId === 'knight-templar') cross(g, x, y, 13 * size, color, alpha);
      else if (skill.heroId === 'wizard') for (let ray = 0; ray < 3; ray++) {
        const angle = ray * Math.PI / 3;
        stroke(g, color, alpha, 2, { x: x - Math.cos(angle) * 15 * size, y: y - Math.sin(angle) * 15 * size }, { x: x + Math.cos(angle) * 15 * size, y: y + Math.sin(angle) * 15 * size });
      } else if (skill.heroId === 'knight') this.shield(g, x, y, 20 * size, direction, color, alpha);
      else if (skill.heroId === 'archer' || skill.heroId === 'soldier') arrow(g, { x, y }, direction, 0, .7 * size, color, alpha);
      else if (skill.heroId === 'lancer') {
        stroke(g, colors.silver, alpha, 2, { x: x + direction * 8 * size, y }, { x: x + direction * 45 * size, y });
        diamond(g, x + direction * 45 * size, y, 5 * size, colors.silver, alpha);
      }
      else crescent(g, x + direction * 22 * size, y, 22 * size, direction, color, alpha);
      return;
    }
    switch (skill.heroId) {
      case 'archer':
        for (let ray = -1; ray <= 1; ray++) arrow(g, { x: x + ((skill.targetX ?? x + direction * 180) - x) * Math.min(1, progress * 2.4), y: y + ray * 18 * size }, direction, ray * .08, .85 * size, colors.gold, alpha);
        break;
      case 'soldier': {
        const targets = skill.targets ?? [{ x: skill.targetX ?? x + direction * 115 * size, y }];
        for (const target of targets) {
          const ty = target.y ?? ground - 65;
          g.lineStyle(2, colors.blue, alpha).strokeCircle(target.x, ty, (12 + motion * 8) * size);
          cross(g, target.x, ty, 5 * size, colors.blue, alpha);
          stroke(g, colors.blue, alpha * .3, 1, { x: x + direction * 28 * size, y }, { x: target.x - direction * 16 * size, y: ty });
        }
        break;
      }
      case 'armored-axeman':
        crescent(g, x + direction * spread, y + 12 * size, (34 + motion * 22) * size, direction, colors.gold, alpha);
        g.lineStyle(3, colors.gold, alpha * .6).strokeEllipse(x + direction * 25 * size, ground, spread * 3, spread * .55, 28);
        for (let index = 0; index < 5; index++) diamond(g, x + direction * (16 + index * 17 + motion * 20) * size, ground - (index % 2 ? 14 : 6) * size, 3 * size, colors.gold, alpha);
        break;
      case 'knight':
        this.shield(g, x + direction * 8 * size, y, (31 + motion * 7) * size, direction, colors.silver, alpha);
        g.lineStyle(2, colors.blue, alpha * .65).strokeEllipse(x, ground - 3, (80 + motion * 25) * size, 22 * size, 28);
        break;
      case 'knight-templar':
        this.shield(g, x + direction * 8 * size, y, 33 * size, direction, colors.gold, alpha);
        cross(g, x + direction * 8 * size, y - 2 * size, 15 * size, colors.gold, alpha * .8);
        g.lineStyle(2, colors.gold, alpha * .7).strokeEllipse(x, ground - 3, (110 + motion * 45) * size, 30 * size, 32);
        break;
      case 'lancer':
        for (let ray = -1; ray <= 1; ray++) {
          const sy = y + ray * 12 * size;
          const reach = clamp(Math.abs((skill.targetX ?? x + direction * 205 * size) - x), 70 * size, 700);
          const endX = x + direction * (30 * size + motion * (reach - 30 * size));
          stroke(g, colors.silver, alpha * (ray ? .45 : 1), ray ? 1.5 : 3, { x: x + direction * 20 * size, y: sy }, { x: endX, y: sy });
          diamond(g, endX, sy, (ray ? 3 : 7) * size, colors.silver, alpha);
        }
        break;
      case 'priest':
        g.lineStyle(2, colors.green, alpha * .65).strokeEllipse(x, ground - 3, (85 + motion * 65) * size, 28 * size, 32);
        for (let petal = 0; petal < 5; petal++) {
          const angle = petal * Math.PI * 2 / 5 + motion * .4;
          const px = x + Math.cos(angle) * spread, py = y + Math.sin(angle) * spread * .7 - motion * 13 * size;
          cross(g, px, py, 6 * size, petal % 2 ? colors.green : colors.gold, alpha);
        }
        break;
      case 'swordsman':
        crescent(g, x + direction * spread, y - 15 * size, 35 * size, direction, colors.blue, alpha);
        crescent(g, x + direction * (spread + 12 * size), y + 18 * size, 30 * size, direction, colors.silver, alpha * .7);
        g.lineStyle(2, colors.blue, alpha * .45).strokeEllipse(x, ground, spread * 3, spread * .5, 28);
        break;
      default:
        g.lineStyle(2, colors.blue, alpha * .65).strokeEllipse(x, ground - 2, (100 + motion * 95) * size, 30 * size, 32);
        for (let ray = 0; ray < 6; ray++) {
          const angle = ray * Math.PI / 3 + motion * .35;
          const px = x + Math.cos(angle) * spread, py = y + Math.sin(angle) * spread;
          diamond(g, px, py, 5 * size, ray % 2 ? colors.blue : colors.purple, alpha);
          stroke(g, colors.blue, alpha * .6, 1.5, { x: px, y: py }, { x: x + Math.cos(angle) * spread * .6, y: y + Math.sin(angle) * spread * .6 });
        }
    }
  }

  private shield(g: Graphics, x: number, y: number, radius: number, direction: number, color: number, alpha: number): void {
    const points = [{ x: x - direction * radius * .5, y: y - radius }, { x: x + direction * radius * .65, y: y - radius * .7 },
      { x: x + direction * radius * .7, y: y + radius * .35 }, { x, y: y + radius }, { x: x - direction * radius * .5, y: y + radius * .3 }];
    for (let index = 0; index < points.length; index++) stroke(g, color, alpha, 2.5, points[index], points[(index + 1) % points.length]);
  }
}
