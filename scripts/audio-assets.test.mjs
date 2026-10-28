import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { inspectMp3, firstFrames } from './import-audio-assets.mjs';
import { MUSIC_TRACKS } from '../src/game/audioCatalog.ts';
import originalCatalog from '../src/game/audioCatalog.generated.json';

const AUDIO_CUES = originalCatalog.sfx;

const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(read('public/audio/audio-manifest.json'));
function frame(value = 0) {
  const bytes = Buffer.alloc(Math.floor(144 * 256000 / 44100), value);
  bytes.writeUInt32BE(0xfffbd0c4, 0); // MPEG1 Layer III, 256 kbps, 44.1 kHz mono.
  return bytes;
}

describe('MP3 source inspection', () => {
  it('counts actual frame samples and ignores ID3 when identifying duplicate streams', () => {
    const plain = Buffer.concat([frame(2), frame(3)]);
    const id3 = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 4, 1, 2, 3, 4]);
    const bare = inspectMp3(plain);
    const tagged = inspectMp3(Buffer.concat([id3, plain]));
    expect(bare.frameCount).toBe(2);
    expect(bare.duration).toBeCloseTo(2 * 1152 / 44100, 6);
    expect(bare.channels).toEqual([1]);
    expect(tagged.sha256).not.toBe(bare.sha256);
    expect(tagged.mpegSha256).toBe(bare.mpegSha256);
    expect(inspectMp3(Buffer.concat([frame(2), frame(4)])).mpegSha256).not.toBe(bare.mpegSha256);
  });

  it('rejects broken/truncated interior frames rather than reporting plausible file-size durations', () => {
    expect(() => inspectMp3(Buffer.concat([frame(), frame().subarray(0, 200)]))).toThrow('Truncated MPEG');
    const damaged = frame();
    damaged[0] = 0;
    expect(() => inspectMp3(Buffer.concat([frame(), damaged, frame()]))).toThrow('Invalid MPEG');
    expect(() => inspectMp3(Buffer.from('not audio'))).toThrow('No complete');
  });

  it('crops only whole beginning frames and retains a decodable frame sequence', () => {
    const bytes = Buffer.concat([frame(1), frame(2), frame(3), frame(4)]);
    const metadata = inspectMp3(bytes);
    const crop = firstFrames(bytes, metadata.frames, 0.06);
    expect(inspectMp3(crop.bytes).frameCount).toBe(2);
    expect(crop.bytes.equals(bytes.subarray(0, frame().length * 2))).toBe(true);
    expect(crop.duration).toBeCloseTo(2 * 1152 / 44100, 6);
  });
});

describe('published local audio', () => {
  it('audits all twelve original MP3 files and keeps hashes, exact frame counts, and source provenance', () => {
    const names = readdirSync(new URL('../Sound', import.meta.url)).filter(name => name.endsWith('.mp3')).sort();
    expect(names).toHaveLength(12);
    expect(manifest.sources.map(source => source.localFile)).toEqual(names.map(name => `Sound/${name}`));
    for (const source of manifest.sources) {
      const bytes = read(source.localFile);
      const current = inspectMp3(bytes);
      expect(current.sha256, source.localFile).toBe(source.sha256);
      expect(current.mpegSha256, source.localFile).toBe(source.mpegSha256);
      expect(current.frameCount, source.localFile).toBe(source.frameCount);
      expect(current.duration, source.localFile).toBe(source.duration);
      expect(current.sampleRates).toEqual([44100]);
      expect(current.bitrates).toEqual([256000]);
      expect(current.leadingBytes + current.trailingBytes).toBe(0);
      expect(source.metadata.tags).toBe('no-ID3-tags');
      expect(source.license).toContain('Không kèm thông tin giấy phép');
    }
    expect(manifest.byteDuplicateGroups).toEqual([]);
    expect(manifest.mpegDuplicateGroups).toEqual([]);
    // Equal lengths are insufficient evidence to drop Song 27.
    const a = manifest.sources.find(source => source.localFile.includes('song-12-'));
    const b = manifest.sources.find(source => source.localFile.includes('song-27-'));
    expect(a.bytes).toBe(b.bytes);
    expect(a.mpegSha256).not.toBe(b.mpegSha256);
  }, 20_000);

  it('publishes all six distinct songs and only short verified-name SFX without modifying source bytes', () => {
    expect(MUSIC_TRACKS).toEqual(manifest.music);
    expect(MUSIC_TRACKS).toHaveLength(6);
    expect(AUDIO_CUES).toEqual(manifest.sfx);
    expect(Object.keys(AUDIO_CUES).sort()).toEqual(['boss-slam', 'game-over', 'kill']);
    for (const selected of manifest.sources.filter(source => source.url)) {
      expect(sha256(read(`public${selected.url}`)), selected.url).toBe(selected.sha256);
    }
    for (const sample of Object.values(AUDIO_CUES)) {
      const info = inspectMp3(read(`public${sample.url}`));
      expect(info.duration).toBe(sample.duration);
      expect(info.duration).toBeLessThan(3);
      expect(sample.volume).toBeGreaterThan(0);
      expect(sample.volume).toBeLessThanOrEqual(1);
    }
  }, 20_000);

  it('can concatenate bounded whole-frame previews without depending on ignored review artifacts', () => {
    const ordered = [
      ...MUSIC_TRACKS.map(track => manifest.sources.find(source => source.id === track.id)),
      ...manifest.sources.filter(source => source.status !== 'music'),
    ];
    expect(ordered).toHaveLength(12);
    const clips = ordered.map((source, index) => {
      const bytes = read(source.localFile);
      const clip = firstFrames(bytes, inspectMp3(bytes).frames, index < 6 ? 4 : 2);
      expect(clip.duration).toBeLessThanOrEqual(index < 6 ? 4 : 2);
      return clip;
    });
    const info = inspectMp3(Buffer.concat(clips.map(clip => clip.bytes)));
    expect(info.duration).toBeCloseTo(clips.reduce((sum, clip) => sum + clip.duration, 0), 5);
    expect(info.duration).toBeGreaterThan(30);
    expect(info.duration).toBeLessThan(35);
  });
});
