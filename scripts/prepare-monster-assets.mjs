/** Import authored Tiny RPG monster animations. Never redraw or fit individual poses. */
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let sharp;
for (const module of ['sharp', process.env.SHARP_MODULE_PATH,
  path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')].filter(Boolean)) {
  try { sharp = require(module); break; } catch { /* Try the next available runtime. */ }
}
if (!sharp) throw new Error('Install sharp or set SHARP_MODULE_PATH.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'new_asset/monsters-pack02/Tiny RPG Character Asset Pack 02 -Free Demon_A&Blood Monster_A');
const specs = [
  { name: 'Demon_A', slug: 'demon', role: 'runner', ground: 56, displayScale: 1.15, contact: { Attack01: 4, Attack02: 3 } },
  { name: 'Blood Monster_A', slug: 'blood-monster', role: 'tank', ground: 56, displayScale: 2.5, contact: { Attack01: 4, Attack02: 5 } },
];
const actions = ['Idle', 'Walk', 'Attack01', 'Attack02', 'Hurt', 'Death'];
const frameSize = 384, scale = 5, baseline = 361, sourceRootX = 52;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = async file => { try { await access(file); return true; } catch { return false; } };
const retain = async (source, destination) => { if (path.resolve(source) !== path.resolve(destination)) await copyFile(source, destination); };

function asepriteMetadata(bytes) {
  if (bytes.readUInt16LE(4) !== 0xa5e0 || bytes.readUInt32LE(0) !== bytes.length) throw new Error('Invalid Aseprite header');
  const result = { width: bytes.readUInt16LE(8), height: bytes.readUInt16LE(10), frames: [], tags: [] };
  let offset = 128;
  for (let index = 0; index < bytes.readUInt16LE(6); index++) {
    const length = bytes.readUInt32LE(offset), count = bytes.readUInt32LE(offset + 12) || bytes.readUInt16LE(offset + 6);
    if (bytes.readUInt16LE(offset + 4) !== 0xf1fa || offset + length > bytes.length) throw new Error('Invalid Aseprite frame');
    result.frames.push({ duration: bytes.readUInt16LE(offset + 8) });
    let chunk = offset + 16;
    for (let c = 0; c < count; c++) {
      const size = bytes.readUInt32LE(chunk), type = bytes.readUInt16LE(chunk + 4), p = chunk + 6;
      if (size < 6 || chunk + size > offset + length) throw new Error('Invalid Aseprite chunk');
      if (type === 0x2018) {
        let tag = p + 10;
        for (let t = 0; t < bytes.readUInt16LE(p); t++) {
          const length = bytes.readUInt16LE(tag + 17);
          result.tags.push({ from: bytes.readUInt16LE(tag), to: bytes.readUInt16LE(tag + 2), direction: bytes[tag + 4],
            name: bytes.subarray(tag + 19, tag + 19 + length).toString('utf8') });
          tag += 19 + length;
        }
      }
      chunk += size;
    }
    offset += length;
  }
  return result;
}

function bounds(data, width, height) {
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!data[(y * width + x) * 4 + 3]) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < 0) return null;
  return { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1 };
}

async function inspect(spec) {
  const original = path.join(sourceRoot, 'Characters(100x100 split)', spec.name);
  const retained = path.join(root, 'assets/native-monsters', spec.slug, 'source');
  const sourceAvailable = await exists(path.join(original, `${spec.name}.aseprite`));
  const asepritePath = path.join(sourceAvailable ? original : retained, `${spec.name}.aseprite`);
  const aseprite = await readFile(asepritePath), metadata = asepriteMetadata(aseprite);
  const directory = sourceAvailable ? path.join(original, spec.name) : retained;
  const clips = [];
  for (const action of actions) {
    const source = path.join(directory, `${spec.name}_${action}.png`), bytes = await readFile(source);
    const png = await sharp(bytes).metadata();
    if (png.height !== 100 || png.width % 100 !== 0 || !png.hasAlpha) throw new Error(`Invalid native strip: ${source}`);
    const frames = [];
    for (let i = 0; i < png.width / 100; i++) {
      const pixels = await sharp(bytes).extract({ left: i * 100, top: 0, width: 100, height: 100 }).ensureAlpha().raw().toBuffer();
      frames.push({ pixels, bounds: bounds(pixels, 100, 100) });
    }
    const tag = metadata.tags.find(tag => tag.name === action);
    if (!tag || tag.direction !== 0 || tag.to - tag.from + 1 !== frames.length) throw new Error(`Native tag/PNG mismatch: ${spec.name}/${action}`);
    const durations = metadata.frames.slice(tag.from, tag.to + 1).map(frame => frame.duration);
    if (durations.some(duration => !Number.isFinite(duration) || duration <= 0)) throw new Error('Invalid source frame duration');
    clips.push({ action, source, bytes, frames, tag, durations });
  }
  return { spec, asepritePath, aseprite, metadata, clips };
}

async function exportMonster(monster) {
  const { spec, clips } = monster;
  const directory = path.join(root, 'assets/native-monsters', spec.slug), sources = path.join(directory, 'source');
  const runtimeDirectory = path.join(root, 'public/art/native-monsters', spec.slug);
  await mkdir(sources, { recursive: true });
  await mkdir(runtimeDirectory, { recursive: true });
  await retain(monster.asepritePath, path.join(sources, `${spec.name}.aseprite`));
  const allBounds = clips.flatMap(clip => clip.frames.map(frame => frame.bounds)).filter(Boolean);
  const left = Math.max(0, Math.min(...allBounds.map(b => b.left)) - 1);
  const top = Math.max(0, Math.min(...allBounds.map(b => b.top)) - 1);
  const right = Math.min(99, Math.max(...allBounds.map(b => b.right)) + 1);
  const bottom = Math.min(99, Math.max(...allBounds.map(b => b.bottom)) + 1);
  const crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
  // One global crop and one registration point preserve authored movement and death height.
  const placement = { left: frameSize / 2 - (sourceRootX - crop.left) * scale,
    top: baseline - ((spec.ground - crop.top + 1) * scale - 1), width: crop.width * scale, height: crop.height * scale };
  if (placement.left < 0 || placement.top < 0 || placement.left + placement.width > frameSize || placement.top + placement.height > frameSize) {
    throw new Error(`${spec.name}: global native registration does not fit; never shrink individual poses`);
  }
  const result = { name: spec.name, slug: spec.slug, role: spec.role, frameSize, scale, displayScale: spec.displayScale,
    originX: 0.5, originY: 0.9414, baseline, sourceRoot: { x: sourceRootX, y: spec.ground }, crop, placement,
    sourceAseprite: `source/${spec.name}.aseprite`, sourceSha256: sha256(monster.aseprite),
    note: 'Original no-shadow PNG pixels; one integer scale, global crop and source registration for every action; no generated or redrawn frames.', clips: [] };
  for (const clip of clips) {
    const slug = clip.action.toLowerCase(), file = `${slug}.png`;
    await retain(clip.source, path.join(sources, path.basename(clip.source)));
    const rendered = [], frameMetadata = [];
    for (const [index, frame] of clip.frames.entries()) {
      const input = await sharp(frame.pixels, { raw: { width: 100, height: 100, channels: 4 } }).extract(crop)
        .resize(placement.width, placement.height, { kernel: 'nearest' }).png().toBuffer();
      const buffer = await sharp({ create: { width: frameSize, height: frameSize, channels: 4, background: '#00000000' } })
        .composite([{ input, left: placement.left, top: placement.top }]).png().toBuffer();
      const raw = await sharp(buffer).ensureAlpha().raw().toBuffer(), body = bounds(raw, frameSize, frameSize);
      if (!body || body.left < 2 || body.top < 2 || body.right >= frameSize - 2 || body.bottom >= frameSize - 2) throw new Error(`${spec.name}/${clip.action}/${index}: clipped visible art`);
      rendered.push(buffer);
      frameMetadata.push({ sourceFrame: clip.tag.from + index, sourceBounds: frame.bounds, outputBounds: body, rgbaSha256: sha256(raw) });
    }
    const packed = await sharp({ create: { width: frameSize * rendered.length, height: frameSize, channels: 4, background: '#00000000' } })
      .composite(rendered.map((input, i) => ({ input, left: i * frameSize, top: 0 }))).png().toBuffer();
    await writeFile(path.join(directory, file), packed);
    await writeFile(path.join(runtimeDirectory, file), packed);
    const contactWidth = frameSize * 4, contactHeight = (frameSize + 24) * Math.ceil(rendered.length / 4);
    const guides = rendered.map((_, i) => { const x = i % 4 * frameSize, y = Math.floor(i / 4) * (frameSize + 24);
      return `<path d="M${x},${y + baseline}h${frameSize}" stroke="#719887"/><path d="M${x + frameSize / 2},${y}v${frameSize}" stroke="#b99666" opacity=".35"/><text x="${x + 12}" y="${y + frameSize + 17}" fill="#e9e5d5" font-family="Arial" font-size="14">${i} · ${clip.durations[i]} ms${spec.contact[clip.action] === i ? ' · CONTACT' : ''}</text>`; }).join('');
    const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${contactWidth}" height="${contactHeight}"><rect width="100%" height="100%" fill="#20333e"/>${guides}</svg>`);
    await sharp(background).composite(rendered.map((input, i) => ({ input, left: i % 4 * frameSize, top: Math.floor(i / 4) * (frameSize + 24) })))
      .png().toFile(path.join(directory, `${slug}-contact.png`));
    const stacked = await sharp({ create: { width: frameSize, height: frameSize * rendered.length, channels: 4, background: '#20333e' } })
      .composite(rendered.map((input, i) => ({ input, left: 0, top: i * frameSize }))).raw().toBuffer();
    await sharp(stacked, { raw: { width: frameSize, height: frameSize * rendered.length, channels: 4, pageHeight: frameSize } })
      .gif({ delay: clip.durations, loop: 0, keepDuplicateFrames: true, colours: 256, dither: 0, effort: 7 }).toFile(path.join(directory, `${slug}-preview.gif`));
    const gif = await sharp(path.join(directory, `${slug}-preview.gif`), { animated: true }).metadata();
    if (gif.pages !== rendered.length || gif.delay?.some((delay, index) => delay !== clip.durations[index])) throw new Error('GIF preview timing drift');
    result.clips.push({ action: clip.action, file, path: `/art/native-monsters/${spec.slug}/${file}`, size: frameSize, frameCount: rendered.length,
      durations: clip.durations, loop: clip.action === 'Idle' || clip.action === 'Walk', attackContactFrame: spec.contact[clip.action],
      source: `source/${path.basename(clip.source)}`, sourceSha256: sha256(clip.bytes), sourceTag: clip.tag, frames: frameMetadata });
  }
  await writeFile(path.join(directory, 'metadata.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

const results = [];
for (const spec of specs) {
  const monster = await inspect(spec);
  if (process.argv.includes('--inspect')) {
    console.log(JSON.stringify({ name: spec.name, metadata: monster.metadata, clips: monster.clips.map(clip => ({ action: clip.action, bounds: clip.frames.map(frame => frame.bounds) })) }));
  } else {
    const result = await exportMonster(monster);
    results.push(result);
    console.log(JSON.stringify({ role: spec.role, name: spec.name, frameSize, scale, displayScale: spec.displayScale, clips: result.clips.map(clip => ({ action: clip.action, frames: clip.frameCount, contact: clip.attackContactFrame })) }));
  }
}
if (results.length) {
  const aliases = {
    runner: { run: 'Walk', hurt: 'Hurt', attack: 'Attack02', death: 'Death' },
    tank: { entrance: 'Idle', walk: 'Walk', 'phase2-walk': 'Walk', 'rage-walk': 'Walk', attack: 'Attack01', 'phase2-attack': 'Attack01',
      'rage-attack': 'Attack01', 'phase-transition': 'Hurt', 'final-strike': 'Hurt', death: 'Death' },
  };
  const sprites = results.flatMap(monster => Object.entries(aliases[monster.role]).map(([action, sourceAction]) => {
    const clip = monster.clips.find(clip => clip.action === sourceAction);
    return { key: `${monster.role}-${action}`, path: clip.path, size: clip.size, durations: clip.durations,
      loop: action === 'run' || action.endsWith('walk'), attackContactFrame: clip.attackContactFrame,
      originX: monster.originX, originY: monster.originY, displayScale: monster.displayScale };
  }));
  await writeFile(path.join(root, 'assets/native-monsters/manifest.json'), JSON.stringify({ version: 1,
    sourcePack: 'Tiny RPG Character Asset Pack 02 v1.01-Free Demon_A&Blood Monster_A', sprites,
    monsters: results.map(({ clips, ...monster }) => ({ ...monster, clips: clips.map(({ frames, ...clip }) => clip) })) }, null, 2) + '\n');
}
