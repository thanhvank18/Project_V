import type Phaser from 'phaser';
import characterCatalog from './characterCatalog.generated.json';
import skyCatalog from './skyCatalog.generated.json';

export interface SpriteAsset {
  key: string;
  path: string;
  size: number;
  durations: number[];
  loop?: boolean;
  /** First contact pose of an attack, indexed from zero; prior poses are anticipation. */
  attackContactFrame?: number;
  /** Native sprite anchor in frame coordinates, normalized to 0..1. */
  originX?: number;
  originY?: number;
  /** Unscaled pixel offset from the actor anchor to the projectile release point, facing right. */
  projectileOffset?: { x: number; y: number };
  releaseFrame?: number;
  displayScale?: number;
}

const sheet = (owner: string, action: string, size: number, durations: number[], loop = false): SpriteAsset => ({
  key: `${owner}-${action}`, path: `/art/${owner}/${action}.png`, size, durations, loop,
});

/** All 42 characters use their original 100px PNG strips and authored Aseprite timing. */
export const SPRITES: SpriteAsset[] = [
  ...characterCatalog.sprites,
  sheet('effects', 'muzzle-flash', 64, [35, 35, 45, 45]),
  sheet('effects', 'letter-impact', 64, [35, 45, 50, 60]),
  sheet('effects', 'ground-dust', 64, [60, 70, 80, 100]),
];

export const SPRITE_BY_KEY = new Map(SPRITES.map(asset => [asset.key, asset]));

export function preloadArt(scene: Phaser.Scene): void {
  scene.load.image('city', skyCatalog.foreground.url);
  for (const asset of SPRITES) {
    scene.load.spritesheet(asset.key, asset.path, { frameWidth: asset.size, frameHeight: asset.size });
  }
  for (const item of ['health', 'freeze', 'damage', 'shield']) scene.load.image(`item-${item}`, `/art/items/${item}.png`);
}

/** Time-based atlas playback keeps paused/reduced-motion gameplay on exactly the same clock. */
export function spriteFrame(key: string, elapsedMs: number): number {
  const asset = SPRITE_BY_KEY.get(key);
  if (!asset) return 0;
  const total = asset.durations.reduce((sum, duration) => sum + duration, 0);
  let elapsed = asset.loop ? Math.max(0, elapsedMs) % total : Math.min(Math.max(0, elapsedMs), total - 1);
  for (let frame = 0; frame < asset.durations.length; frame += 1) {
    if (elapsed < asset.durations[frame]) return frame;
    elapsed -= asset.durations[frame];
  }
  return asset.durations.length - 1;
}

export const animationDuration = (key: string): number => SPRITE_BY_KEY.get(key)?.durations.reduce((sum, duration) => sum + duration, 0) ?? 400;
