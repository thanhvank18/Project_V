import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { AlliedHeroes, partyName } from './AlliedHeroes';
import { getHeroCharacter } from './characterCatalog';
import { projectileOrigin, rangedShotTiming } from './characterAnimation';
import { SPRITE_BY_KEY } from './assets';
import type { PartyPlayer } from './types';

class Node {
  x = 0; y = 0; flipX = false; alpha = 1; text = ''; color = ''; key = ''; frame = 0; destroyed = false; scale = 1;
  setDepth(): this { return this; } setOrigin(): this { return this; }
  setScale(scale: number): this { this.scale = scale; return this; }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  setTexture(key: string, frame: number): this { this.key = key; this.frame = frame; return this; }
  setFlipX(flip: boolean): this { this.flipX = flip; return this; }
  setAlpha(alpha: number): this { this.alpha = alpha; return this; }
  setText(text: string): this { this.text = text; return this; }
  setColor(color: string): this { this.color = color; return this; }
  destroy(): void { this.destroyed = true; }
}
function harness() {
  const sprites: Node[] = [], labels: Node[] = [], nodes: Node[] = [];
  const scene = { add: {
    sprite: () => { const node = new Node(); sprites.push(node); nodes.push(node); return node; },
    ellipse: () => { const node = new Node(); nodes.push(node); return node; },
    text: () => { const node = new Node(); labels.push(node); nodes.push(node); return node; },
  } };
  return { effects: new AlliedHeroes(scene as unknown as Phaser.Scene, { add: () => undefined } as unknown as Phaser.GameObjects.Container), sprites, labels, nodes };
}
const players = (): PartyPlayer[] => [{ id: 'self', heroId: 'soldier', x: 600, hp: 100, targetId: null }, { id: 'peer', name: 'Bạn B', heroId: 'wizard', x: 900, hp: 80, targetId: 3 }];

describe('allied native actors', () => {
  it('uses peer native metadata and a separate name color, never creates the local actor twice', () => {
    const h = harness(); h.effects.render(players(), 'self', 1000);
    expect(h.effects.count).toBe(1); expect(h.sprites).toHaveLength(1);
    expect(h.sprites[0].key).toBe(getHeroCharacter('wizard').actions.idle);
    expect(h.sprites[0].scale).toBe(getHeroCharacter('wizard').displayScale);
    expect(h.labels[0].text).toBe('Bạn B · 80 HP'); expect(h.labels[0].color).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('faces actual movement and retains direction after stopping', () => {
    const h = harness(), party = players(); h.effects.render(party, 'self', 1000);
    party[1].x = 880; h.effects.render(party, 'self', 1025);
    expect(h.sprites[0].flipX).toBe(true);
    h.effects.render(party, 'self', 1050); expect(h.sprites[0].flipX).toBe(true);
    expect(h.sprites[0].key).toBe(getHeroCharacter('wizard').actions.move);
    h.effects.render(party, 'self', 1125); expect(h.sprites[0].key).toBe(getHeroCharacter('wizard').actions.idle);
  });
  it('plays a peer shot from its release pose without affecting a local event, and freezes at a held clock', () => {
    const h = harness(), party = players(); h.effects.render(party, 'self', 1000);
    h.effects.record({ type: 'shot', playerId: 'self', x: 1200 }, party, 'self', 1000);
    h.effects.render(party, 'self', 1000); expect(h.sprites[0].key).toBe(getHeroCharacter('wizard').actions.idle);
    h.effects.record({ type: 'shot', playerId: 'peer', sourceX: 900, x: 700 }, party, 'self', 1000);
    h.effects.render(party, 'self', 1010); const frame = h.sprites[0].frame;
    expect(h.sprites[0].key).toBe(getHeroCharacter('wizard').actions.attack);
    expect(h.sprites[0].flipX).toBe(true);
    h.effects.render(party, 'self', 1010); expect(h.sprites[0].frame).toBe(frame);
    expect(rangedShotTiming(SPRITE_BY_KEY.get(h.sprites[0].key)).duration).toBeGreaterThan(0);
    expect(projectileOrigin(900, 490, -1, getHeroCharacter('wizard').displayScale).x).toBeLessThan(900);
  });
  it('holds a downed peer on the death strip, and destroys peers that leave or reset', () => {
    const h = harness(), party = players(); h.effects.render(party, 'self', 1000);
    party[1].hp = 0; h.effects.render(party, 'self', 1100); h.effects.render(party, 'self', 5000);
    expect(h.sprites[0].key).toBe(getHeroCharacter('wizard').actions.death);
    expect(h.labels[0].text).toContain('GỤC'); expect(h.sprites[0].alpha).toBeLessThan(1);
    h.effects.render([party[0]], 'self', 5100); expect(h.effects.count).toBe(0); expect(h.nodes.every(node => node.destroyed)).toBe(true);
    h.effects.render(party, 'self', 5200); h.effects.reset(); expect(h.effects.count).toBe(0);
  });
  it('caps peers to three and keeps user text finite and bounded', () => {
    const h = harness(), party = Array.from({ length: 20 }, (_, index) => ({ ...players()[1], id: `p${index}` }));
    h.effects.render(party, 'self', 0); expect(h.effects.count).toBe(3);
    expect(partyName({ ...players()[1], name: '\u0000' + 'r'.repeat(1000) })).toHaveLength(24);
  });
});
