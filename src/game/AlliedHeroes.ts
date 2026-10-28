import type Phaser from 'phaser';
import { animationDuration, SPRITE_BY_KEY, spriteFrame } from './assets';
import { characterShadow, heroAnimationKey, rangedShotTiming } from './characterAnimation';
import { getHeroCharacter, type CharacterDefinition } from './characterCatalog';
import type { GameEvent, PartyPlayer } from './types';
import { localizeText, type Language } from '../i18n';

interface AllyView {
  sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Ellipse; label: Phaser.GameObjects.Text;
  character: CharacterDefinition; x: number; facing: number; gait: number; deathAt: number | null; lastMoveAt: number;
  action: { key: string; start: number; until: number; offset: number } | null;
}
const COLORS = [0xa9ead2, 0xffd48a, 0xcbbaff, 0x99dfff];
export const partyColor = (players: readonly PartyPlayer[], id: string): number => COLORS[Math.max(0, players.findIndex(player => player.id === id)) % COLORS.length];
export const partyName = (player: PartyPlayer, language: Language = 'vi'): string => {
  const name = player.name?.replace(/[\u0000-\u001f]/g, '').trim();
  // Only system-generated names are translated; teammates' own names stay intact.
  return (name ? language === 'en' ? name.replace(/^Người chơi (\d+)$/, 'Player $1') : name
    : localizeText(getHeroCharacter(player.heroId).label, language)).slice(0, 24);
};

/** Only draws peers; authoritative movement, HP and target ownership stay in the room engine. */
export class AlliedHeroes {
  private views = new Map<string, AllyView>();
  constructor(private scene: Phaser.Scene, private world: Phaser.GameObjects.Container) {}
  get count(): number { return this.views.size; }
  reset(): void { for (const view of this.views.values()) this.destroy(view); this.views.clear(); }
  record(event: GameEvent, players: readonly PartyPlayer[], selfId: string, clock: number): void {
    if (!event.playerId || event.playerId === selfId) return;
    const view = this.views.get(event.playerId), player = players.find(candidate => candidate.id === event.playerId);
    if (!view || !player || player.hp <= 0) return;
    if (event.type === 'shot') {
      const key = view.character.actions.attack, timing = rangedShotTiming(SPRITE_BY_KEY.get(key));
      view.facing = (event.x ?? player.x + view.facing) >= (event.sourceX ?? player.x) ? 1 : -1;
      view.action = { key, start: clock, until: clock + timing.duration, offset: timing.offset };
    } else if (event.type === 'player-hurt') {
      const key = view.character.actions.hurt;
      view.action = { key, start: clock, until: clock + animationDuration(key), offset: 0 };
    }
  }
  render(players: readonly PartyPlayer[], selfId: string, clock: number, ground = 490, language: Language = 'vi'): void {
    const peers = players.filter(player => player.id !== selfId).slice(0, 3);
    const ids = new Set(peers.map(player => player.id));
    for (const [id, view] of this.views) if (!ids.has(id)) { this.destroy(view); this.views.delete(id); }
    for (const player of peers) {
      let view = this.views.get(player.id);
      const character = getHeroCharacter(player.heroId);
      if (view && view.character.id !== character.id) { this.destroy(view); this.views.delete(player.id); view = undefined; }
      if (!view) {
        const size = characterShadow(character);
        const sprite = this.scene.add.sprite(player.x, ground, character.actions.idle, 0).setDepth(9).setOrigin(character.originX, character.originY).setScale(character.displayScale);
        const shadow = this.scene.add.ellipse(player.x, ground + 3, size.width, size.height, 0x07131a, .5).setDepth(2);
        const label = this.scene.add.text(player.x, ground + 35, '', { fontFamily: '"Be Vietnam Pro", Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', stroke: '#132631', strokeThickness: 4, resolution: 2 }).setOrigin(.5).setDepth(22);
        this.world.add([shadow, sprite, label]);
        view = { character, sprite, shadow, label, x: player.x, facing: 1, gait: 0, deathAt: null, lastMoveAt: -1000, action: null };
        this.views.set(player.id, view);
      }
      const distance = Math.abs(player.x - view.x), changed = distance > .1;
      if (changed && player.hp > 0) { view.lastMoveAt = clock; view.facing = player.x >= view.x ? 1 : -1; view.gait = (view.gait + distance / 84) % 1; }
      // Server snapshots arrive less often than display frames; retain the gait between samples.
      const walking = player.hp > 0 && (changed || clock - view.lastMoveAt < 80);
      view.x = player.x;
      if (player.hp <= 0 && view.deathAt === null) view.deathAt = clock;
      if (player.hp > 0) view.deathAt = null;
      if (view.action && clock >= view.action.until) view.action = null;
      const key = view.deathAt !== null ? character.actions.death : heroAnimationKey(walking, view.action?.key, character.actions, view.action?.key === character.actions.hurt);
      const elapsed = view.deathAt !== null ? clock - view.deathAt : view.action ? clock - view.action.start + view.action.offset : walking ? view.gait * animationDuration(key) : clock;
      view.sprite.setTexture(key, spriteFrame(key, elapsed)).setOrigin(character.originX, character.originY).setScale(character.displayScale)
        .setPosition(player.x, ground).setFlipX(view.facing < 0).setAlpha(player.hp <= 0 ? .45 : player.connected === false ? .55 : 1);
      view.shadow.setPosition(player.x, ground + 3).setAlpha(player.hp <= 0 ? .2 : .5);
      const color = `#${partyColor(players, player.id).toString(16).padStart(6, '0')}`;
      if (view.label.style.color !== color) view.label.setColor(color);
      view.label.setPosition(player.x, ground + 35)
        .setText(`${partyName(player, language)} · ${player.hp <= 0 ? language === 'en' ? 'DOWN' : 'GỤC' : `${Math.ceil(player.hp)} HP`}`);
    }
  }
  private destroy(view: AllyView): void { view.sprite.destroy(); view.shadow.destroy(); view.label.destroy(); }
}
