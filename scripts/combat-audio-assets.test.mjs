import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import combat from '../src/game/combatAudioCatalog.generated.json';

const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url));
const manifest = JSON.parse(read('public/audio/combat-manifest.json'));

describe('selected combat samples', () => {
  it('publishes bounded, trimmed PCM with click-free edges and verified provenance', () => {
    expect(manifest.sourceCount).toBe(32);
    expect(manifest.sources).toHaveLength(32);
    expect(manifest.bytes).toBeLessThan(3 * 1024 * 1024);
    for (const source of manifest.sources) {
      const bytes = read(`public${source.url}`);
      expect(createHash('sha256').update(bytes).digest('hex'), source.url).toBe(source.sha256);
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
      expect(bytes.readUInt16LE(20)).toBe(1); // PCM
      expect(bytes.readUInt16LE(22)).toBe(1); // Mono
      expect(bytes.readUInt32LE(24)).toBe(48_000);
      expect(bytes.readUInt16LE(34)).toBe(16);
      const pcm = bytes.subarray(44);
      expect(pcm.length / 96_000).toBeCloseTo(source.duration, 5);
      expect(source.duration).toBeGreaterThan(.05);
      expect(source.duration).toBeLessThanOrEqual(2.5);
      expect(bytes.length).toBe(source.bytes);
      expect(bytes.length).toBeLessThan(source.sourceBytes / 4);
      expect(source.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(pcm.readInt16LE(0)).toBe(0);
      expect(pcm.readInt16LE(pcm.length - 2)).toBe(0);
      let peak = 0;
      for (let at = 0; at < pcm.length; at += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(at)));
      expect(peak).toBeGreaterThan(100);
      expect(peak).toBeLessThanOrEqual(23198); // -3dBFS ceiling, rounding tolerance
    }
  });

  it('contains only the accepted combat categories with variants, and reuses hit samples', () => {
    expect(combat.sfx).toEqual(manifest.sfx);
    expect(Object.keys(combat.sfx).sort()).toEqual([
      'attack-sword', 'attack-axe', 'attack-arrow', 'attack-magic', 'guard', 'heal',
      'frost', 'volley', 'player-hurt', 'boss-slam', 'jam', 'impact',
    ].sort());
    const urls = new Set(manifest.sources.map(source => source.url));
    for (const variants of Object.values(combat.sfx)) {
      expect(variants.length).toBeGreaterThanOrEqual(2);
      for (const sample of variants) {
        expect(urls.has(sample.url), sample.url).toBe(true);
        expect(sample.volume).toBeGreaterThan(0);
        expect(sample.volume).toBeLessThanOrEqual(.5);
      }
    }
    expect(combat.sfx.impact.map(sample => sample.url)).toEqual(combat.sfx['player-hurt'].slice(0, 2).map(sample => sample.url));
  });
});
