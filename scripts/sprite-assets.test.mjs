import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { animationDuration, SPRITES, SPRITE_BY_KEY, spriteFrame } from '../src/game/assets.ts';
import { CHARACTERS } from '../src/game/characterCatalog.ts';

describe('sprite sheet playback', () => {
  it('registers every physical PNG frame with a positive display duration', () => {
    for (const asset of SPRITES) {
      const png = readFileSync(new URL(`../public${asset.path}`, import.meta.url));
      expect(png.subarray(1, 4).toString(), asset.key).toBe('PNG');
      expect(png.readUInt32BE(16), asset.key).toBe(asset.size * asset.durations.length);
      expect(png.readUInt32BE(20), asset.key).toBe(asset.size);
      expect(asset.durations.every(duration => duration > 0), asset.key).toBe(true);
    }
  }, 20_000); // Cold Windows reads of all 213 sheets can exceed Vitest's 5s default.

  it('reaches every authored looping pose before wrapping, including native Flying clips', () => {
    for (const asset of SPRITES.filter(sprite => sprite.loop)) {
      let elapsed = 0;
      asset.durations.forEach((duration, frame) => {
        expect(spriteFrame(asset.key, elapsed + duration / 2), `${asset.key} frame ${frame}`).toBe(frame);
        elapsed += duration;
      });
      expect(spriteFrame(asset.key, elapsed - 0.01)).toBe(asset.durations.length - 1);
      expect(spriteFrame(asset.key, elapsed)).toBe(0);
      expect(spriteFrame(asset.key, -1)).toBe(0);
    }
  });

  it('uses a valid native contact pose for every attack and reaches the entire recovery', () => {
    for (const character of CHARACTERS) {
      const asset = SPRITE_BY_KEY.get(character.actions.attack);
      expect(Number.isInteger(asset.attackContactFrame), character.id).toBe(true);
      expect(asset.attackContactFrame).toBeGreaterThanOrEqual(0);
      expect(asset.attackContactFrame).toBeLessThan(asset.durations.length);
      expect(asset.loop).toBe(false);
      let elapsed = 0;
      asset.durations.forEach((duration, frame) => {
        expect(spriteFrame(asset.key, elapsed + duration / 2), `${asset.key} frame ${frame}`).toBe(frame);
        elapsed += duration;
      });
      expect(spriteFrame(asset.key, asset.durations.slice(0, asset.attackContactFrame).reduce((a, b) => a + b, 0))).toBe(asset.attackContactFrame);
      expect(spriteFrame(asset.key, elapsed + 1)).toBe(asset.durations.length - 1);
    }
  });

  it('publishes original native pixels and Aseprite timings for all five actions of every character', () => {
    for (const character of CHARACTERS) {
      const directory = new URL(`../assets/native-catalog/${character.id}/`, import.meta.url);
      const metadata = JSON.parse(readFileSync(new URL('metadata.json', directory), 'utf8'));
      for (const [action, key] of Object.entries(character.actions)) {
        const asset = SPRITE_BY_KEY.get(key), clip = metadata.clips[action];
        expect(asset.size, key).toBe(100);
        expect(asset.path, key).toMatch(/^\/art\/characters\//);
        expect(asset.durations, key).toEqual(clip.durations);
        expect(asset.durations.length, key).toBe(clip.frameCount);
        expect(clip.tag.to - clip.tag.from + 1, key).toBe(clip.frameCount);
        const native = readFileSync(new URL(clip.source, directory));
        const published = readFileSync(new URL(`../public${asset.path}`, import.meta.url));
        expect(createHash('sha256').update(native).digest('hex'), key).toBe(clip.sourceSha256);
        expect(published.equals(native), key).toBe(true);
        expect(asset.originX, key).toBe(character.originX);
        expect(asset.originY, key).toBe(character.originY);
      }
      const portrait = readFileSync(new URL(`../public${character.portrait}`, import.meta.url));
      expect(portrait.subarray(1, 4).toString(), character.id).toBe('PNG');
    }
  }, 20_000);

  it('loads only the full native catalog and shared effects, with unique texture keys', () => {
    const characterKeys = new Set(CHARACTERS.flatMap(character => Object.values(character.actions)));
    expect(SPRITES.filter(asset => !asset.key.startsWith('effects-')).map(asset => asset.key).sort()).toEqual([...characterKeys].sort());
    expect(new Set(SPRITES.map(asset => asset.key)).size).toBe(SPRITES.length);
  });

  it('keeps finished combat actions on their final pose', () => {
    for (const asset of SPRITES.filter(sprite => !sprite.loop)) {
      expect(spriteFrame(asset.key, animationDuration(asset.key) + 10_000)).toBe(asset.durations.length - 1);
    }
  });
});
