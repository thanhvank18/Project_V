import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { HeroAttackEffects, type HeroProjectileVisual } from './HeroAttackEffects';

const heroes = ['archer', 'soldier', 'armored-axeman', 'knight', 'knight-templar', 'lancer', 'priest', 'swordsman', 'wizard'];
interface Draw { shape: string; coordinates: number[]; color: number; alpha: number }
class GraphicsCollector {
  draws: Draw[] = [];
  private fill = { color: 0, alpha: 1 };
  private stroke = { color: 0, alpha: 1 };
  clear(): this { this.draws = []; return this; }
  fillStyle(color: number, alpha = 1): this { this.fill = { color, alpha }; return this; }
  lineStyle(_width: number, color: number, alpha = 1): this { this.stroke = { color, alpha }; return this; }
  fillRect(...coordinates: number[]): this { return this.collect('rect', coordinates, this.fill); }
  fillTriangle(...coordinates: number[]): this { return this.collect('triangle', coordinates, this.fill); }
  lineBetween(...coordinates: number[]): this { return this.collect('line', coordinates, this.stroke); }
  strokeCircle(...coordinates: number[]): this { return this.collect('circle', coordinates.slice(0, 3), this.stroke); }
  strokeEllipse(...coordinates: number[]): this { return this.collect('ellipse', coordinates.slice(0, 4), this.stroke); }
  private collect(shape: string, coordinates: number[], style: { color: number; alpha: number }): this {
    this.draws.push({ shape, coordinates, ...style }); return this;
  }
}
const graphics = (g: GraphicsCollector) => g as unknown as Phaser.GameObjects.Graphics;
const geometry = (g: GraphicsCollector) => g.draws.map(({ shape, coordinates }) => ({ shape, coordinates }));
const opacity = (g: GraphicsCollector) => g.draws.reduce((sum, draw) => sum + draw.alpha, 0);
const shot = (heroId: string): HeroProjectileVisual => ({ heroId, from: { x: 300, y: 400 }, point: { x: 500, y: 405 },
  previous: { x: 490, y: 405 }, target: { x: 700, y: 405 }, progress: .4, scale: 1.4, reducedMotion: false });

describe('hero weapon and skill presentation', () => {
  it('gives all nine heroes a distinct weapon signature with finite, bounded projectile geometry', () => {
    const effects = new HeroAttackEffects(), signatures = new Set<string>();
    for (const hero of heroes) {
      const g = new GraphicsCollector(); effects.drawProjectile(graphics(g), shot(hero));
      expect(g.draws.length, hero).toBeGreaterThan(0);
      expect(g.draws.every(draw => draw.coordinates.every(Number.isFinite)), hero).toBe(true);
      // Ornaments remain local to the letter; they never draw a beam across its whole path.
      expect(g.draws.every(draw => draw.coordinates.every((coordinate, index) => draw.shape === 'rect' && index >= 2
        ? coordinate >= 0 && coordinate < 90 : Math.abs(coordinate - (index % 2 ? 405 : 500)) < 90)), hero).toBe(true);
      signatures.add(JSON.stringify(g.draws));
    }
    expect(signatures.size).toBe(heroes.length);
  });

  it.each(heroes)('keeps %s activation frozen while the simulation clock is unchanged', heroId => {
    const effects = new HeroAttackEffects(), g = new GraphicsCollector();
    effects.emitSkill({ heroId, x: 500, y: 490, at: 1000, height: 140 });
    effects.drawSkills(graphics(g), 1080, false); const paused = structuredClone(g.draws);
    g.clear(); effects.drawSkills(graphics(g), 1080, false);
    expect(g.draws).toEqual(paused);
    expect(g.draws.length).toBeGreaterThan(0);
  });

  it.each([false, true])('distinguishes the Soldier volley from a single Archer arrow by geometry (reduced=%s)', reducedMotion => {
    const effects = new HeroAttackEffects(), archer = new GraphicsCollector(), soldier = new GraphicsCollector();
    effects.drawProjectile(graphics(archer), { ...shot('archer'), reducedMotion });
    effects.drawProjectile(graphics(soldier), { ...shot('soldier'), reducedMotion });
    expect(geometry(soldier)).not.toEqual(geometry(archer));
    expect(soldier.draws.length).toBeGreaterThan(archer.draws.length);
  });

  it.each(heroes)('keeps reduced-motion %s geometry static while it fades', heroId => {
    const effects = new HeroAttackEffects(), g = new GraphicsCollector();
    effects.emitSkill({ heroId, x: 500, y: 490, at: 0, height: 140 });
    effects.drawSkills(graphics(g), 30, true); const early = geometry(g), earlyOpacity = opacity(g);
    g.clear(); effects.drawSkills(graphics(g), 400, true);
    expect(geometry(g)).toEqual(early);
    expect(opacity(g)).toBeLessThan(earlyOpacity);
    expect(opacity(g)).toBeGreaterThan(0);
  });

  it('bounds queued activations and copied target lists, and rejects duplicate event ids', () => {
    const effects = new HeroAttackEffects(), g = new GraphicsCollector();
    const targets = Array.from({ length: 200 }, (_, index) => ({ x: 700 + index }));
    for (let id = 0; id < 1000; id++) effects.emitSkill({ heroId: 'soldier', x: 500, y: 490, at: 0, id, targets });
    expect(effects.activeSkillCount).toBeLessThanOrEqual(12);
    const count = effects.activeSkillCount;
    effects.emitSkill({ heroId: 'soldier', x: 500, y: 490, at: 0, id: 999, targets });
    expect(effects.activeSkillCount).toBe(count);
    targets[0].x = NaN;
    effects.drawSkills(graphics(g), 80, false);
    expect(g.draws.length).toBeLessThan(300);
    expect(g.draws.every(draw => draw.coordinates.every(Number.isFinite))).toBe(true);
  });

  it('never revives expired or reset activations when an old clock is rendered again', () => {
    const effects = new HeroAttackEffects(), g = new GraphicsCollector();
    effects.emitSkill({ heroId: 'wizard', x: 500, y: 490, at: 0 });
    effects.drawSkills(graphics(g), 40, false); expect(g.draws.length).toBeGreaterThan(0);
    g.clear(); effects.drawSkills(graphics(g), 751, false); expect(effects.activeSkillCount).toBe(0);
    effects.drawSkills(graphics(g), 40, false); expect(g.draws).toEqual([]);
    effects.emitSkill({ heroId: 'knight', x: 500, y: 490, at: 0 });
    effects.reset(); effects.drawSkills(graphics(g), 40, false); expect(g.draws).toEqual([]);
  });

  it('stops projectile ornaments at impact and ignores invalid coordinates', () => {
    const effects = new HeroAttackEffects(), g = new GraphicsCollector();
    effects.drawProjectile(graphics(g), { ...shot('archer'), progress: 1 });
    effects.drawProjectile(graphics(g), { ...shot('wizard'), target: { x: NaN, y: 0 } });
    expect(g.draws).toEqual([]);
  });

  it.each(['wizard', 'armored-axeman'])('centres %s area feedback on the actual target and shows its radius', heroId => {
    const effects = new HeroAttackEffects(), g = new GraphicsCollector();
    effects.emitSkill({ heroId, x: 500, targetX: 900, y: 490, radius: 150, at: 0 });
    effects.drawSkills(graphics(g), 40, true);
    expect(g.draws.some(draw => draw.shape === 'ellipse' && draw.coordinates[0] === 900 && draw.coordinates[2] === 300)).toBe(true);
    expect(g.draws.every(draw => draw.coordinates[0] > 700)).toBe(true);
  });
  it('keeps a self-area around its caster and does not pin an immune target when the engine supplied no victims', () => {
    const effects = new HeroAttackEffects(), g = new GraphicsCollector();
    effects.emitSkill({ heroId: 'swordsman', x: 500, targetX: 900, y: 490, radius: 160, at: 0 });
    effects.drawSkills(graphics(g), 40, true);
    expect(g.draws.some(draw => draw.shape === 'ellipse' && draw.coordinates[0] === 500 && draw.coordinates[2] === 320)).toBe(true);
    effects.reset(); g.clear();
    effects.emitSkill({ heroId: 'soldier', x: 500, targetX: 900, y: 490, at: 0, targets: [] });
    effects.drawSkills(graphics(g), 40, false);
    expect(g.draws.some(draw => draw.shape === 'circle' && draw.coordinates[0] === 900)).toBe(false);
  });
});
