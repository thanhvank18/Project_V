import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const round = value => Math.round(value * 1_000_000) / 1_000_000;
const synchsafe = (bytes, at) => ((bytes[at] & 127) << 21) | ((bytes[at + 1] & 127) << 14)
  | ((bytes[at + 2] & 127) << 7) | (bytes[at + 3] & 127);

/** Read complete Layer III frames without decoding, recompressing, or guessing from file size. */
export function inspectMp3(bytes) {
  let start = 0;
  let id3v2 = false;
  if (bytes.subarray(0, 3).toString('ascii') === 'ID3') {
    if (bytes.length < 10) throw new Error('Truncated ID3 header');
    id3v2 = true;
    start = 10 + synchsafe(bytes, 6) + (bytes[3] === 4 && (bytes[5] & 16) ? 10 : 0);
  }
  const id3v1 = bytes.length >= 128 && bytes.subarray(-128, -125).toString('ascii') === 'TAG';
  const end = bytes.length - (id3v1 ? 128 : 0);
  const frames = [];
  const stream = createHash('sha256');
  let cursor = start;
  let duration = 0;
  const rates = new Set();
  const channels = new Set();
  const bitrates = new Set();
  while (cursor + 4 <= end) {
    const h = bytes.readUInt32BE(cursor);
    const versionBits = (h >>> 19) & 3;
    const layerBits = (h >>> 17) & 3;
    const bitrateIndex = (h >>> 12) & 15;
    const rateIndex = (h >>> 10) & 3;
    if ((h >>> 21) !== 0x7ff || versionBits === 1 || layerBits !== 1
      || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) {
      // Leading/trailing container bytes are not music frames; interior corruption is an error.
      if (frames.length && bytes.subarray(cursor, end).some(byte => byte !== 0)) {
        throw new Error(`Invalid MPEG frame at byte ${cursor}`);
      }
      if (frames.length) break;
      cursor += 1;
      continue;
    }
    const mpeg1 = versionBits === 3;
    const rate = [44100, 48000, 32000][rateIndex] / (mpeg1 ? 1 : versionBits === 2 ? 2 : 4);
    const kbps = (mpeg1
      ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
      : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[bitrateIndex];
    const length = Math.floor((mpeg1 ? 144 : 72) * kbps * 1000 / rate) + ((h >>> 9) & 1);
    if (cursor + length > end) throw new Error(`Truncated MPEG frame at byte ${cursor}`);
    const seconds = (mpeg1 ? 1152 : 576) / rate;
    frames.push({ offset: cursor, length, duration: seconds });
    stream.update(bytes.subarray(cursor, cursor + length));
    duration += seconds;
    rates.add(rate);
    channels.add(((h >>> 6) & 3) === 3 ? 1 : 2);
    bitrates.add(kbps * 1000);
    cursor += length;
  }
  if (!frames.length) throw new Error('No complete MPEG Layer III frames');
  return {
    codec: 'MPEG Layer III', duration: round(duration), durationMethod: 'sum-of-complete-mpeg-frame-samples',
    sampleRates: [...rates], channels: [...channels], bitrates: [...bitrates],
    frameCount: frames.length, sha256: hash(bytes), mpegSha256: stream.digest('hex'),
    id3v1, id3v2, leadingBytes: frames[0].offset, trailingBytes: end - cursor, frames,
  };
}

/** Whole frames from the beginning preserve each source's bit reservoir dependencies. */
export function firstFrames(bytes, frames, maxSeconds) {
  let duration = 0;
  const chunks = [];
  for (const frame of frames) {
    if (duration + frame.duration > maxSeconds && chunks.length) break;
    chunks.push(bytes.subarray(frame.offset, frame.offset + frame.length));
    duration += frame.duration;
  }
  return { bytes: Buffer.concat(chunks), duration: round(duration) };
}

const MUSIC = [
  ['pixel-song-03', 'Pixel Song 3', 'freesound_community-pixel-song-3-72687.mp3'],
  ['pixel-song-07', 'Pixel Song 7', 'freesound_community-pixel-song-7-72685.mp3'],
  ['pixel-song-12', 'Pixel Song 12', 'freesound_community-pixel-song-12-72532.mp3'],
  ['pixel-song-16', 'Pixel Song 16', 'freesound_community-pixel-song-16-31697.mp3'],
  ['pixel-song-21', 'Pixel Song 21', 'freesound_community-pixel-song-21-72593.mp3'],
  ['pixel-song-27', 'Pixel Song 27', 'freesound_community-pixel-song-27-72476.mp3'],
];
const SAMPLES = [
  ['kill', 'pixel-death', 'freesound_community-pixel-death-66829.mp3', 0.38],
  ['boss-slam', 'pixel-explosion', 'lumora_studios-pixel-explosion-319166.mp3', 0.55],
  ['game-over', 'pixel-game-over', 'lumora_studios-pixel-game-over-319170.mp3', 0.6],
];

export async function importAudioAssets(root = ROOT) {
  const sourceDir = path.join(root, 'Sound');
  const targetDir = path.join(root, 'public', 'audio');
  const previewDir = path.join(root, '.impeccable', 'review');
  const names = (await fs.readdir(sourceDir)).filter(name => /\.mp3$/i.test(name)).sort();
  const all = new Map();
  for (const name of names) {
    const bytes = await fs.readFile(path.join(sourceDir, name));
    all.set(name, { bytes, info: inspectMp3(bytes) });
  }
  await fs.mkdir(path.join(targetDir, 'music'), { recursive: true });
  await fs.mkdir(path.join(targetDir, 'sfx'), { recursive: true });
  await fs.mkdir(previewDir, { recursive: true });
  const music = [];
  const seenStreams = new Map();
  const selections = new Map();
  for (const [id, title, name] of MUSIC) {
    const source = all.get(name);
    if (!source) throw new Error(`Missing source ${name}`);
    const duplicateOf = seenStreams.get(source.info.mpegSha256);
    if (duplicateOf) {
      selections.set(name, { status: 'duplicate-mpeg-stream', duplicateOf });
      continue;
    }
    seenStreams.set(source.info.mpegSha256, id);
    const url = `/audio/music/${id}.mp3`;
    await fs.writeFile(path.join(root, 'public', url.slice(1)), source.bytes);
    music.push({ id, title, url, duration: source.info.duration });
    selections.set(name, { status: 'music', id, url });
  }
  const sfx = {};
  for (const [cue, id, name, volume] of SAMPLES) {
    const source = all.get(name);
    if (!source) throw new Error(`Missing source ${name}`);
    const url = `/audio/sfx/${id}.mp3`;
    await fs.writeFile(path.join(root, 'public', url.slice(1)), source.bytes);
    sfx[cue] = { url, volume, duration: source.info.duration };
    selections.set(name, { status: 'sfx', cue, url, rationale: 'Tentative mapping from supplied filename; no auditory review.' });
  }
  const catalog = { music, sfx };
  const sources = names.map(name => {
    const { frames, ...info } = all.get(name).info;
    return { localFile: `Sound/${name}`, bytes: all.get(name).bytes.length, ...info,
      metadata: { title: null, artist: null, sourceUrl: null, tags: info.id3v1 || info.id3v2 ? 'present-not-interpreted' : 'no-ID3-tags' },
      license: 'Không kèm thông tin giấy phép trong thư mục người dùng cung cấp',
      ...(selections.get(name) ?? { status: 'unselected', rationale: 'Unverified generic effect or alternate game-over; source retained.' }) };
  });
  const manifest = {
    version: 1, sourceDirectory: 'Sound', sourceCount: names.length,
    inspection: 'MPEG frame/header inspection; not an auditory review. No decoding, normalization, or recompression.',
    durationCaveat: 'Frame-sample duration includes possible encoder delay/padding.',
    ...catalog, sources,
    byteDuplicateGroups: duplicateGroups(sources, 'sha256'),
    mpegDuplicateGroups: duplicateGroups(sources, 'mpegSha256'),
    omittedCues: ['letter', 'jam', 'impact', 'player-hurt', 'pickup', 'skill', 'victory'],
  };
  await fs.writeFile(path.join(targetDir, 'audio-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(root, 'src', 'game', 'audioCatalog.generated.json'), `${JSON.stringify(catalog, null, 2)}\n`);

  // Review-only montage: complete source frames, no re-encoding. Frame boundaries are recorded exactly.
  const preview = [];
  const segments = [];
  let at = 0;
  for (const name of [...MUSIC.map(entry => entry[2]), ...names.filter(name => !MUSIC.some(entry => entry[2] === name))]) {
    const source = all.get(name);
    const clip = firstFrames(source.bytes, source.info.frames, /pixel-song-/.test(name) ? 4 : 2);
    preview.push(clip.bytes);
    segments.push({ localFile: `Sound/${name}`, start: round(at), end: round(at + clip.duration), duration: clip.duration });
    at += clip.duration;
  }
  await fs.writeFile(path.join(previewDir, 'audio-preview.mp3'), Buffer.concat(preview));
  await fs.writeFile(path.join(previewDir, 'audio-preview.json'), `${JSON.stringify({
    method: 'Concatenated whole MPEG frames from each source beginning; no fade/gaps/re-encoding. Decoder may buffer at channel-mode changes.',
    duration: round(at), segments,
  }, null, 2)}\n`);
  return manifest;
}

function duplicateGroups(sources, key) {
  const groups = new Map();
  for (const source of sources) {
    const group = groups.get(source[key]) ?? [];
    group.push(source.localFile);
    groups.set(source[key], group);
  }
  return [...groups.values()].filter(group => group.length > 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await importAudioAssets();
  console.log(JSON.stringify({ sources: result.sourceCount, tracks: result.music.length,
    cues: Object.keys(result.sfx), byteDuplicateGroups: result.byteDuplicateGroups,
    mpegDuplicateGroups: result.mpegDuplicateGroups }, null, 2));
}
