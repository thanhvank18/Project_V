import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { createWorldBackdrop } from './worldBackdrop';
import { VIEW_WIDTH, WORLD_WIDTH } from './worldLayout';

class Events {
  listeners = new Map<string, Set<() => void>>();
  on(event: string, callback: () => void): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback); return this;
  }
  once(event: string, callback: () => void): this {
    const listener = () => { this.off(event, listener); callback(); };
    return this.on(event, listener);
  }
  off(event: string, callback: () => void): this { this.listeners.get(event)?.delete(callback); return this; }
  emit(event: string): void { for (const callback of [...this.listeners.get(event) ?? []]) callback(); }
}
interface Box { x: number; y: number; width: number; height: number }
class Node extends Events {
  x = 0; y = 0; width = 0; height = 0; origin = .5; visible = true; destroyed = false; text = '';
  parent?: Node; list: Node[] = [];
  setDisplaySize(width: number, height: number): this { this.width = width; this.height = height; return this; }
  setFlipX(): this { return this; }
  setOrigin(origin: number): this { this.origin = origin; return this; }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  setText(text: string): this { this.text = text; return this; }
  add(node: Node): this { return this.addAt(node, this.list.length); }
  addAt(node: Node, index: number): this { this.list.splice(index, 0, node); node.parent = this; return this; }
  getBounds(output: Box = { x: 0, y: 0, width: 0, height: 0 }): Box {
    let x = this.x - this.width * this.origin, y = this.y - this.height * this.origin;
    for (let parent = this.parent; parent; parent = parent.parent) { x += parent.x; y += parent.y; }
    return Object.assign(output, { x, y, width: this.width, height: this.height });
  }
  destroy(): void { this.emit('destroy'); for (const child of this.list) child.destroy(); this.destroyed = true; }
}
class Graphics extends Node {
  inDisplayList = true; rectangles = 0;
  removeFromDisplayList(): this { this.inDisplayList = false; return this; }
  fillStyle(): this { return this; }
  fillRect(): this { this.rectangles++; return this; }
  lineStyle(): this { return this; }
  lineBetween(): this { return this; }
}
class Surface extends Node {
  renders = 0; clears = 0; source?: Graphics; offsetX = 0;
  clear(): this { this.clears++; return this; }
  draw(source: Graphics, x: number): this { this.source = source; this.offsetX = x; return this; }
  render(): this { this.renders++; return this; }
}
function harness() {
  const events = new Events(), renderer = new Events(), graphics = new Graphics();
  const surfaces: Surface[] = [], labels: Node[] = [];
  const scene = { events, game: { renderer }, cameras: { main: { scrollX: 0, scrollY: 0, width: VIEW_WIDTH, height: 720, zoom: 1 } }, add: {
    container: () => new Node(), graphics: () => graphics,
    image: (x: number, y: number) => Object.assign(new Node(), { x, y }),
    text: (x: number, y: number, text: string) => { const node = Object.assign(new Node(), { x, y, text }); labels.push(node); return node; },
    renderTexture: (x: number, y: number, width: number, height: number) => {
      const surface = Object.assign(new Surface(), { x, y, width, height }); surfaces.push(surface); return surface;
    },
  } };
  return { scene: scene as unknown as Phaser.Scene, events, renderer, graphics, surfaces, labels };
}

describe('cached world scenery', () => {
  it('bakes all scenery into bounded textures below live, localizable district labels', () => {
    const h = harness(), registered: Phaser.GameObjects.Text[] = [];
    const root = createWorldBackdrop(h.scene, 'vi', label => registered.push(label)) as unknown as Node;
    expect(h.surfaces).toHaveLength(WORLD_WIDTH / VIEW_WIDTH);
    expect(h.graphics.rectangles).toBeGreaterThan(4000);
    expect(h.graphics.inDisplayList).toBe(false);
    expect(root.list).not.toContain(h.graphics);
    for (const [index, surface] of h.surfaces.entries()) {
      expect([surface.x, surface.y, surface.width, surface.height, surface.origin]).toEqual([index * VIEW_WIDTH, 0, VIEW_WIDTH, 720, 0]);
      expect(surface.source).toBe(h.graphics);
      expect(surface.offsetX).toBe(-index * VIEW_WIDTH);
      expect(surface.renders).toBe(1);
    }
    expect(root.list.slice(5, 10)).toEqual(h.surfaces);
    expect(root.list.slice(10)).toEqual(h.labels);
    expect(registered).toHaveLength(4);
    registered[0].setText('PARK');
    expect(h.labels[0].text).toBe('PARK');
    for (let frame = 0; frame < 60; frame++) h.events.emit('prerender');
    expect(h.surfaces.map(surface => surface.renders)).toEqual([1, 1, 1, 1, 1]);
  });

  it('culls transformed chunks as their parent scrolls and reveals them again when returning', () => {
    const h = harness(), root = createWorldBackdrop(h.scene) as unknown as Node;
    root.x = -2700;
    h.events.emit('prerender');
    expect(h.surfaces.map(surface => surface.visible)).toEqual([false, false, true, true, false]);
    root.y = 800;
    h.events.emit('prerender');
    expect(h.surfaces.every(surface => !surface.visible)).toBe(true);
    root.x = root.y = 0;
    h.events.emit('prerender');
    expect(h.surfaces[0].visible).toBe(true);
    expect(h.surfaces[4].visible).toBe(false);
  });

  it('rebuilds lost pixels on WebGL restoration and releases source and callbacks on teardown', () => {
    const h = harness(), root = createWorldBackdrop(h.scene);
    h.renderer.emit('restorewebgl');
    expect(h.surfaces.map(surface => surface.renders)).toEqual([2, 2, 2, 2, 2]);
    root.destroy();
    expect(h.graphics.destroyed).toBe(true);
    expect(h.surfaces.every(surface => surface.destroyed)).toBe(true);
    expect(h.events.listeners.get('prerender')?.size).toBe(0);
    expect(h.renderer.listeners.get('restorewebgl')?.size).toBe(0);
    h.renderer.emit('restorewebgl');
    expect(h.surfaces.map(surface => surface.renders)).toEqual([2, 2, 2, 2, 2]);
  });
});
