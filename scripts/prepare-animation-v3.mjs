/** Repack generated v3 source poses without drawing or per-pose fitting. */
import { createRequire } from 'node:module';
import { mkdir, copyFile, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let sharp;
for (const module of ['sharp', process.env.SHARP_MODULE_PATH,
  path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')].filter(Boolean)) {
  try { sharp = require(module); break; } catch { /* Try the next explicitly configured runtime. */ }
}
if (!sharp) throw new Error('Install sharp or set SHARP_MODULE_PATH to its module directory.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const option = flag => process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined;
const sourceDirectory = option('--source-dir') ?? path.join(homedir(), '.codex/generated_images/01a16131-c295-7c43-89cc-eb0b4c5d4cbf');
const specs = [
  { kind: 'normal', action: 'walk', native: true, tag: 'Run', frameCount: 8 },
  { kind: 'normal', action: 'hurt', native: true, tag: 'Idle', frameCount: 8 },
  { kind: 'normal', action: 'attack', native: true, tag: 'Attack', frameCount: 7 },
  { kind: 'normal', action: 'death', native: true, tag: 'Death', frameCount: 8 },
  { kind: 'runner', action: 'run', file: 'exec-02633e09-5eaf-4b70-a0bf-22c56480c1a1.png' },
  { kind: 'armored', action: 'walk', file: 'exec-a19b3fec-ddef-4117-b086-699fe23efff9.png' },
  { kind: 'tank', action: 'walk', file: 'exec-638890fd-ff91-45dd-8dba-a720bbf78b64.png' },
  { kind: 'tank', action: 'phase2-walk', file: 'exec-77722cd4-c220-4b69-83d5-09f5b013846e.png' },
  { kind: 'tank', action: 'rage-walk', file: 'exec-81ba1a3c-32a8-4ecb-825c-9a85fc2e7543.png' },
  { kind: 'survivor', action: 'walk', file: 'exec-baaf003f-8bbe-4e9b-a69a-361a23572b54.png', referenceAction: 'idle' },
  { kind: 'runner', action: 'attack', file: 'exec-c773f1a6-1403-43f8-b137-b846288d4061.png' },
  { kind: 'armored', action: 'attack', file: 'exec-7a84781c-4b63-4e6f-a7d0-9307c512ba4c.png' },
  { kind: 'tank', action: 'attack', file: 'exec-e85f7723-2557-4446-9866-1ab7f430c299.png' },
  { kind: 'tank', action: 'phase2-attack', file: 'exec-02640a47-702a-4ab2-b7f9-84f452e78b44.png' },
  { kind: 'tank', action: 'rage-attack', file: 'exec-989baf78-b91b-4a4f-9f53-b70743a209e7.png' },
].map(spec => ({ ...spec, size: spec.kind === 'tank' ? spec.action.endsWith('attack') ? 384 : 256 : spec.kind === 'runner' && spec.action === 'attack' ? 192 : 128,
  referenceSize: spec.kind === 'tank' ? 256 : 128,
  baseline: spec.kind === 'tank' ? spec.action.endsWith('attack') ? 361 : 241 : spec.kind === 'runner' && spec.action === 'attack' ? 181 : 120,
  frameCount: spec.frameCount ?? (spec.action.endsWith('attack') ? 8 : 12),
  delay: spec.kind === 'runner' ? 70 : spec.kind === 'tank' ? 120 : spec.kind === 'armored' ? 110 : 90 }));
const selection = option('--only')?.split(',');
const selectedSpecs = specs.filter(spec => !selection || selection.includes(`${spec.kind}/${spec.action}`));
if (!selectedSpecs.length) throw new Error('No matching kind/action selected.');
const exists = async p => { try { await access(p); return true; } catch { return false; } };
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function bounds(data, width, height, threshold = 16) {
  let left = width, top = height, right = -1, bottom = -1, visiblePixels = 0, zeroAlpha = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = data[(y * width + x) * 4 + 3];
    if (!alpha) zeroAlpha++;
    if (alpha <= threshold) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); visiblePixels++;
  }
  if (!visiblePixels) throw new Error('Empty animation frame');
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, visiblePixels, zeroAlpha };
}

function contentRows(data, width, height, expectedRows) {
  const bands = [];
  let start = -1;
  for (let y = 0; y < height; y++) {
    let occupied = false;
    for (let x = 0; x < width && !occupied; x++) occupied = data[(y * width + x) * 4 + 3] > 16;
    if (occupied && start < 0) start = y;
    if (!occupied && start >= 0) { bands.push([start, y - 1]); start = -1; }
  }
  if (start >= 0) bands.push([start, height - 1]);
  if (bands.length !== expectedRows) throw new Error(`Expected ${expectedRows} separated content rows, found ${bands.length}; inspect source before cropping.`);
  const cuts = [0, ...bands.slice(0, -1).map((band, i) => Math.floor((band[1] + bands[i + 1][0]) / 2)), height];
  return { bands, cuts };
}

function contentColumns(data, width, [top, bottom]) {
  const bands = [];
  let start = -1;
  for (let x = 0; x < width; x++) {
    let occupied = false;
    for (let y = top; y <= bottom && !occupied; y++) occupied = data[(y * width + x) * 4 + 3] > 16;
    if (occupied && start < 0) start = x;
    if (!occupied && start >= 0) { bands.push([start, x - 1]); start = -1; }
  }
  if (start >= 0) bands.push([start, width - 1]);
  if (bands.length !== 4) {
    // A forward claw can overlap the next pose's x-range without touching it.
    // Separate the original alpha islands rather than cutting a limb at a grid line.
    const height = bottom - top + 1, labels = new Int32Array(width * height), components = [];
    for (let p = 0; p < labels.length; p++) {
      if (labels[p] || data[((Math.floor(p / width) + top) * width + p % width) * 4 + 3] <= 16) continue;
      const pixels = [p], id = components.length + 1; labels[p] = id;
      let left = width, right = 0, y0 = height, y1 = 0;
      for (let i = 0; i < pixels.length; i++) {
        const q = pixels[i], x = q % width, y = Math.floor(q / width);
        left = Math.min(left, x); right = Math.max(right, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const a = x + dx, b = y + dy, k = b * width + a;
          if (a < 0 || b < 0 || a >= width || b >= height || labels[k] || data[((b + top) * width + a) * 4 + 3] <= 16) continue;
          labels[k] = id; pixels.push(k);
        }
      }
      components.push({ id, count: pixels.length, left, right, top: y0 + top, bottom: y1 + top });
    }
    const regions = components.filter(c => c.count > 1000).sort((a, b) => a.left - b.left);
    if (regions.length !== 4) throw new Error(`Expected four isolated poses, found ${regions.length}.`);
    return { bands: regions.map(r => [r.left, r.right]), regions, labels, rowTop: top, rowHeight: height };
  }
  return { bands, cuts: [0, ...bands.slice(0, -1).map((band, i) => Math.floor((band[1] + bands[i + 1][0]) / 2)), width] };
}

/** Clothing colour in a torso-only window avoids arm/foot extensions moving the registration point. */
function torsoAnchor(kind, data, width, bbox, action = '') {
  const x0 = Math.floor(bbox.left + bbox.width * .18), x1 = Math.ceil(bbox.left + bbox.width * .78);
  const y0 = Math.floor(bbox.top + bbox.height * .36), y1 = Math.ceil(bbox.top + bbox.height * .73);
  let weight = 0, sumX = 0, sumY = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = (y * width + x) * 4, [r, g, b, a] = data.subarray(p, p + 4);
    const clothing = kind === 'normal' ? r > g * 1.35 && b > g * 1.2 && r > 55
      : kind === 'runner' ? r > g * 1.25 && b > g * 1.25 && b > 45
        : kind === 'armored' ? b > r * 1.12 && b > g * .98 && b > 35
          : kind === 'tank' && (action === 'phase2-walk' || action === 'rage-walk') ? g > r * 1.05 && g > b * 1.15 && g > 50
            : r > g * 1.2 && g > b * 1.3 && r > 90;
    if (a < 128 || !clothing) continue;
    sumX += x * a; sumY += y * a; weight += a;
  }
  if (weight < 128 * 8) return { x: (bbox.left + bbox.right) / 2, y: bbox.top + bbox.height * .55, method: 'torso-window-fallback' };
  return { x: sumX / weight, y: sumY / weight, method: 'clothing-centroid' };
}

async function rawFrame(source, rect, kind, action) {
  const { data, info } = await sharp(source).extract(rect).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const body = bounds(data, info.width, info.height);
  // The generated sheets contain isolated alpha 1-16 speckles far from the sprite.
  // Keep a small untouched fringe around the visible body rather than fitting that noise.
  const left = Math.max(0, body.left - 3), top = Math.max(0, body.top - 3);
  const right = Math.min(info.width - 1, body.right + 3), bottom = Math.min(info.height - 1, body.bottom + 3);
  return { data, width: info.width, height: info.height, rect, body,
    crop: { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 },
    anchor: torsoAnchor(kind, data, info.width, body, action) };
}

let nativeCache;
async function nativeZombie() {
  if (nativeCache) return nativeCache;
  const directory = path.join(root, 'assets/animation-v3/normal/native');
  await mkdir(directory, { recursive: true });
  for (const file of ['Zombie.aseprite', 'Zombie.png', 'Zombie.gif', 'Zombie5x.gif']) {
    const retained = path.join(directory, file);
    if (!await exists(retained)) await copyFile(path.join(root, 'zoombie1', file), retained);
  }
  const source = path.join(directory, 'Zombie.aseprite'), bytes = await readFile(source);
  if (bytes.readUInt16LE(4) !== 0xa5e0 || bytes.readUInt16LE(12) !== 32 || bytes.readUInt32LE(0) !== bytes.length) throw new Error('Unsupported/corrupt native Aseprite source');
  const width = bytes.readUInt16LE(8), height = bytes.readUInt16LE(10), layers = [], tags = [], frames = [];
  let offset = 128;
  for (let frame = 0; frame < bytes.readUInt16LE(6); frame++) {
    const length = bytes.readUInt32LE(offset), count = bytes.readUInt32LE(offset + 12) || bytes.readUInt16LE(offset + 6);
    const cels = new Map(); let chunk = offset + 16;
    for (let i = 0; i < count; i++) {
      const size = bytes.readUInt32LE(chunk), type = bytes.readUInt16LE(chunk + 4), p = chunk + 6;
      if (size < 6 || chunk + size > offset + length) throw new Error('Invalid native chunk bounds');
      if (type === 0x2004) {
        const layer = { flags: bytes.readUInt16LE(p), type: bytes.readUInt16LE(p + 2), blend: bytes.readUInt16LE(p + 10), opacity: bytes[p + 12] };
        if (layer.type !== 0 || layer.blend !== 0) throw new Error('Native importer supports normal RGBA layers only');
        layers.push(layer);
      } else if (type === 0x2018) {
        let tag = p + 10;
        for (let t = 0; t < bytes.readUInt16LE(p); t++) {
          const nameLength = bytes.readUInt16LE(tag + 17);
          tags.push({ from: bytes.readUInt16LE(tag), to: bytes.readUInt16LE(tag + 2), direction: bytes[tag + 4],
            name: bytes.subarray(tag + 19, tag + 19 + nameLength).toString('utf8') });
          tag += 19 + nameLength;
        }
      } else if (type === 0x2005) {
        const cel = { layer: bytes.readUInt16LE(p), x: bytes.readInt16LE(p + 2), y: bytes.readInt16LE(p + 4), opacity: bytes[p + 6], type: bytes.readUInt16LE(p + 7) };
        if (bytes.readInt16LE(p + 9) !== 0) throw new Error('Native cel z-index requires explicit rendering support');
        if (cel.type === 1) cel.link = bytes.readUInt16LE(p + 16);
        else if (cel.type === 0 || cel.type === 2) {
          cel.width = bytes.readUInt16LE(p + 16); cel.height = bytes.readUInt16LE(p + 18);
          const data = bytes.subarray(p + 20, chunk + size);
          cel.pixels = cel.type === 2 ? inflateSync(data) : Buffer.from(data);
          if (cel.pixels.length !== cel.width * cel.height * 4) throw new Error('Invalid native cel pixels');
        } else throw new Error(`Unsupported native cel type ${cel.type}`);
        cels.set(cel.layer, cel);
      }
      chunk += size;
    }
    frames.push({ duration: bytes.readUInt16LE(offset + 8), cels }); offset += length;
  }
  const resolveCel = (frame, layer, visited = new Set()) => {
    if (visited.has(frame)) throw new Error('Cyclic native linked cel');
    visited.add(frame);
    const cel = frames[frame]?.cels.get(layer);
    if (!cel) throw new Error('Missing native linked cel');
    return cel.type === 1 ? { ...resolveCel(cel.link, layer, visited), ...cel } : cel;
  };
  const images = [];
  for (let frame = 0; frame < frames.length; frame++) {
    const composite = [];
    for (const [index, layer] of layers.entries()) {
      if (!(layer.flags & 1) || !frames[frame].cels.has(index)) continue;
      const cel = resolveCel(frame, index), pixels = Buffer.from(cel.pixels);
      if (cel.opacity !== 255 || layer.opacity !== 255) for (let a = 3; a < pixels.length; a += 4) pixels[a] = Math.round(pixels[a] * cel.opacity / 255 * layer.opacity / 255);
      composite.push({ input: await sharp(pixels, { raw: { width: cel.width, height: cel.height, channels: 4 } }).png().toBuffer(), left: cel.x, top: cel.y });
    }
    images.push(await sharp({ create: { width, height, channels: 4, background: '#00000000' } }).composite(composite).png().toBuffer());
  }
  nativeCache = { source, bytes, width, height, tags, frames, images };
  return nativeCache;
}

async function prepare(spec) {
  const directory = path.join(root, 'assets/animation-v3', spec.kind);
  await mkdir(directory, { recursive: true });
  const native = spec.native ? await nativeZombie() : null;
  const source = native?.source ?? path.join(directory, `${spec.action}-source.png`);
  if (!native && !await exists(source)) {
    if (!spec.file) throw new Error(`Pending generated source: ${spec.kind}/${spec.action}`);
    await copyFile(path.join(sourceDirectory, spec.file), source);
  }
  const sourceBytes = native?.bytes ?? await readFile(source), meta = native ? { width: native.width, height: native.height, hasAlpha: true } : await sharp(source).metadata();
  if (!meta.hasAlpha) throw new Error(`${spec.kind}: source needs a real alpha channel`);
  const raw = native ? null : await sharp(source).ensureAlpha().raw().toBuffer();
  const rows = native ? { bands: [] } : contentRows(raw, meta.width, meta.height, spec.frameCount / 4);
  const columns = native ? [] : rows.bands.map(band => contentColumns(raw, meta.width, band));
  const nativeTag = native?.tags.find(tag => tag.name === spec.tag);
  if (native && (!nativeTag || nativeTag.direction !== 0 || nativeTag.to - nativeTag.from + 1 !== spec.frameCount)) throw new Error(`Unexpected native tag ${spec.tag}`);
  const extracted = [];
  for (let index = 0; index < spec.frameCount; index++) {
    if (native) {
      const frame = await rawFrame(native.images[nativeTag.from + index], { left: 0, top: 0, width: native.width, height: native.height }, spec.kind, spec.action);
      frame.crop = { left: 0, top: 0, right: native.width - 1, bottom: native.height - 1, width: native.width, height: native.height };
      frame.anchor = { x: native.width / 2, y: native.height / 2, method: 'native-canvas-origin' };
      extracted.push(frame); continue;
    }
    const column = index % 4, row = Math.floor(index / 4);
    if (columns[row].regions) {
      const { regions, labels, rowTop, rowHeight } = columns[row], region = regions[column];
      const rect = { left: Math.max(0, region.left - 3), top: Math.max(0, region.top - 3),
        width: Math.min(meta.width - 1, region.right + 3) - Math.max(0, region.left - 3) + 1,
        height: Math.min(meta.height - 1, region.bottom + 3) - Math.max(0, region.top - 3) + 1 };
      const isolated = Buffer.alloc(rect.width * rect.height * 4);
      for (let y = 0; y < rect.height; y++) for (let x = 0; x < rect.width; x++) {
        const gx = rect.left + x, gy = rect.top + y, rowY = gy - rowTop;
        let belongs = rowY >= 0 && rowY < rowHeight && labels[rowY * meta.width + gx] === region.id;
        if (!belongs) for (let dy = -3; dy <= 3 && !belongs; dy++) for (let dx = -3; dx <= 3 && !belongs; dx++) {
          const nx = gx + dx, ny = rowY + dy;
          belongs = nx >= 0 && nx < meta.width && ny >= 0 && ny < rowHeight && labels[ny * meta.width + nx] === region.id;
        }
        if (belongs) raw.copy(isolated, (y * rect.width + x) * 4, (gy * meta.width + gx) * 4, (gy * meta.width + gx) * 4 + 4);
      }
      const png = await sharp(isolated, { raw: { width: rect.width, height: rect.height, channels: 4 } }).png().toBuffer();
      const frame = await rawFrame(png, { left: 0, top: 0, width: rect.width, height: rect.height }, spec.kind, spec.action);
      frame.rect = rect; extracted.push(frame); continue;
    }
    const left = columns[row].cuts[column], right = columns[row].cuts[column + 1];
    extracted.push(await rawFrame(source, { left, top: rows.cuts[row], width: right - left,
      height: rows.cuts[row + 1] - rows.cuts[row] }, spec.kind, spec.action));
  }
  const frameOrder = spec.frameOrder ?? Array.from({ length: spec.frameCount }, (_, i) => i);
  if (frameOrder.length !== spec.frameCount || new Set(frameOrder).size !== spec.frameCount || frameOrder.some(i => !Number.isInteger(i) || i < 0 || i >= spec.frameCount)) {
    throw new Error(`${spec.kind}: frameOrder must be a permutation of the source frame indices`);
  }
  const sourceFrames = frameOrder.map(index => extracted[index]);
  const referenceAction = spec.action.endsWith('attack') ? 'attack' : spec.referenceAction ?? spec.action;
  const reference = path.join(root, 'public/art', spec.kind, `${referenceAction}.png`);
  const oldFrames = await Promise.all(Array.from({ length: 4 }, (_, i) => rawFrame(reference,
    { left: i * spec.referenceSize, top: 0, width: spec.referenceSize, height: spec.referenceSize }, spec.kind, spec.action)));
  // Attacks are calibrated on their neutral opening pose, never on a collapsed/contact pose.
  let scale = native ? 3.75 : spec.action.endsWith('attack') ? oldFrames[0].body.height / sourceFrames[0].body.height
    : median(oldFrames.map(f => f.body.height)) / median(sourceFrames.map(f => f.body.height));
  const requestedScale = scale;
  const leftReach = Math.max(...sourceFrames.map(f => f.anchor.x - f.crop.left));
  const rightReach = Math.max(...sourceFrames.map(f => f.crop.right - f.anchor.x));
  if (!native) scale = Math.min(scale, (spec.size - 8) / (leftReach + rightReach), (spec.baseline - 4) / Math.max(...sourceFrames.map(f => f.crop.height)));
  const targetAnchorX = clamp(median(oldFrames.map(f => f.anchor.x)) + (spec.size - spec.referenceSize) / 2, 4 + leftReach * scale, spec.size - 4 - rightReach * scale);
  const runnerAnchorY = spec.baseline - Math.max(...sourceFrames.map(f => f.body.bottom - f.anchor.y)) * scale;
  const frames = [], frameMetadata = [];
  for (const [index, frame] of sourceFrames.entries()) {
    const crop = frame.crop;
    const width = Math.max(1, Math.round(crop.width * scale)), height = Math.max(1, Math.round(crop.height * scale));
    const pixels = await sharp(frame.data, { raw: { width: frame.width, height: frame.height, channels: 4 } })
      .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
      .resize(width, height, { kernel: 'nearest' }).png().toBuffer();
    const left = native ? 4 : Math.round(targetAnchorX - (frame.anchor.x - crop.left) * scale);
    const top = native ? 1 : spec.kind === 'runner' && spec.action === 'run' ? Math.round(runnerAnchorY - (frame.anchor.y - crop.top) * scale)
      : spec.baseline - Math.round((frame.body.bottom - crop.top) * scale);
    const canvasInset = native ? 0 : 2;
    if (left < canvasInset || top < canvasInset || left + width > spec.size - canvasInset || top + height > spec.size - canvasInset) {
      throw new Error(`${spec.kind} frame ${index}: unsafe placement ${JSON.stringify({ left, top, width, height })}`);
    }
    const buffer = await sharp({ create: { width: spec.size, height: spec.size, channels: 4, background: '#00000000' } })
      .composite([{ input: pixels, left, top }]).png().toBuffer();
    const output = await sharp(buffer).raw().toBuffer(), body = bounds(output, spec.size, spec.size);
    if (!body.zeroAlpha || body.visiblePixels < 100 || Math.min(body.left, body.top, spec.size - 1 - body.right, spec.size - 1 - body.bottom) < 2) {
      throw new Error(`${spec.kind} frame ${index}: failed alpha, occupancy or padding validation`);
    }
    frames.push(buffer);
    frameMetadata.push({ index, sourceIndex: native ? nativeTag.from + frameOrder[index] : frameOrder[index], sourceRect: frame.rect, sourceBody: frame.body, sourceAnchor: frame.anchor,
      placement: { left, top, width, height }, body, footClearance: spec.baseline - body.bottom, rgbaSha256: hash(output) });
  }
  if (!native && new Set(frameMetadata.map(f => f.rgbaSha256)).size !== spec.frameCount) throw new Error(`${spec.kind}: duplicate output frames`);
  const sheetName = `${spec.action}-sheet-${spec.size}.png`, sheetPath = path.join(directory, sheetName);
  await sharp({ create: { width: spec.size * spec.frameCount, height: spec.size, channels: 4, background: '#00000000' } })
    .composite(frames.map((input, i) => ({ input, left: i * spec.size, top: 0 }))).png().toFile(sheetPath);
  const destination = path.join(root, 'public/art', spec.kind, `${spec.action}-v3.png`);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(sheetPath, destination);
  const contactWidth = spec.size * 4, contactHeight = (spec.size + 22) * Math.ceil(spec.frameCount / 4);
  const guides = Array.from({ length: spec.frameCount }, (_, i) => {
    const x = i % 4 * spec.size, y = Math.floor(i / 4) * (spec.size + 22);
    return `<rect x="${x}" y="${y}" width="${spec.size}" height="${spec.size}" fill="${i % 2 ? '#253b46' : '#20333e'}"/><path d="M${x},${y + spec.baseline}h${spec.size}" stroke="#6ba18b" opacity=".65"/><path d="M${x + targetAnchorX},${y}v${spec.size}" stroke="#cfa767" opacity=".35"/><text x="${x + 5}" y="${y + spec.size + 16}" fill="#dfece7" font-size="12" font-family="Arial">${i + 1} · gap ${frameMetadata[i].footClearance}px</text>`;
  }).join('');
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${contactWidth}" height="${contactHeight}"><rect width="100%" height="100%" fill="#14242d"/>${guides}</svg>`);
  await sharp(svg).composite(frames.map((input, i) => ({ input, left: i % 4 * spec.size,
    top: Math.floor(i / 4) * (spec.size + 22) }))).png().toFile(path.join(directory, `${spec.action}-contact-sheet.png`));
  const stacked = await sharp({ create: { width: spec.size, height: spec.size * spec.frameCount, channels: 4, background: '#20333e' } })
    .composite(frames.map((input, i) => ({ input, left: 0, top: i * spec.size }))).raw().toBuffer();
  const gifPath = path.join(directory, `${spec.action}-preview.gif`);
  const durations = native ? native.frames.slice(nativeTag.from, nativeTag.to + 1).map(frame => frame.duration)
    : spec.action.endsWith('attack') ? [100, 100, 100, 100, 65, 60, 65, 70] : Array(spec.frameCount).fill(spec.delay);
  await sharp(stacked, { raw: { width: spec.size, height: spec.size * spec.frameCount, channels: 4, pageHeight: spec.size } })
    .gif({ loop: 0, delay: durations.map(ms => Math.round(ms / 10) * 10), keepDuplicateFrames: true, effort: 7, colours: 256, dither: 0 }).toFile(gifPath);
  const gif = await sharp(gifPath, { animated: true }).metadata();
  if (gif.pages !== spec.frameCount || gif.pageHeight !== spec.size || gif.delay?.length !== spec.frameCount || gif.delay.some(ms => ms <= 0)) {
    throw new Error(`${spec.kind}: GIF must contain ${spec.frameCount} pages with positive frame durations`);
  }
  const contactFrame = spec.action.endsWith('attack') ? native ? 3 : 4 : undefined;
  const metadata = { version: 3, kind: spec.kind, action: spec.action, source: native ? 'native/Zombie.aseprite' : `${spec.action}-source.png`, sourceGeneratorFile: spec.file,
    native: native ? { tag: nativeTag, tags: native.tags, totalFrames: native.frames.length, fallback: spec.action === 'hurt' ? 'No Hurt tag; Idle pixels with runtime tint/recoil.' : undefined,
      formatReference: 'https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md' } : undefined,
    sourceSha256: hash(sourceBytes), frameOrder: native ? frameOrder.map(i => i + nativeTag.from) : frameOrder,
    sourceDimensions: { width: meta.width, height: meta.height }, sourceContentRows: rows.bands,
    sourceContentColumns: columns.map(row => row.bands),
    frameCount: spec.frameCount, frameSize: spec.size, durations, sheet: sheetName, runtime: path.relative(root, destination).replaceAll('\\', '/'),
    attackContactFrame: contactFrame,
    attackPhases: contactFrame !== undefined ? { anticipation: Array.from({ length: contactFrame }, (_, i) => i), contact: [contactFrame], recovery: Array.from({ length: spec.frameCount - contactFrame - 1 }, (_, i) => i + contactFrame + 1) } : undefined,
    baseline: spec.baseline, registration: native ? 'Original 32px canvas registration retained at one fixed scale and offset for all tags.'
      : 'torso clothing centroid in restricted window; grounded walk aligned by sole; runner retains leg clearance',
    scale, requestedScale, safetyLimitedScale: scale < requestedScale, perFrameScale: false, resample: 'nearest', targetAnchorX,
    reference: path.relative(root, reference).replaceAll('\\', '/'),
    referenceMedianBody: { width: median(oldFrames.map(f => f.body.width)), height: median(oldFrames.map(f => f.body.height)) },
    preview: { file: `${spec.action}-preview.gif`, frames: gif.pages, delays: gif.delay, loop: gif.loop,
      note: 'Presentation cadence only; runtime may advance frames by distance.' }, frames: frameMetadata };
  await writeFile(path.join(directory, `${spec.action}-metadata.json`), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  return { kind: spec.kind, action: spec.action, frames: spec.frameCount, sheet: path.relative(root, sheetPath), size: `${spec.size * spec.frameCount}x${spec.size}`,
    scale, bodyHeightRange: [Math.min(...frameMetadata.map(f => f.body.height)), Math.max(...frameMetadata.map(f => f.body.height))],
    footClearance: frameMetadata.map(f => f.footClearance), gifFrames: gif.pages };
}

for (const spec of selectedSpecs) console.log(JSON.stringify(await prepare(spec)));

// Only expose completed packs in the review tool; no missing PNG is referenced while art is arriving.
const reviewStates = [];
for (const spec of specs) {
  const metadataPath = path.join(root, 'assets/animation-v3', spec.kind, `${spec.action}-metadata.json`);
  if (!await exists(metadataPath)) continue;
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  const attack = spec.action.endsWith('attack');
  const oldAction = spec.kind === 'survivor' ? 'idle' : spec.kind === 'runner' ? 'run' : 'walk';
  const oldPath = attack ? `/art/${spec.kind}/attack.png` : ['hurt', 'death'].includes(spec.action) ? `/art/${spec.kind}/${spec.action}.png`
    : spec.kind === 'survivor' ? '/art/survivor/idle.png' : `/art/${spec.kind}/${oldAction}-v2.png`;
  const oldDurations = attack ? spec.kind === 'tank' ? [150, 200, 100, 250] : [110, 100, 100, 150]
    : spec.action === 'hurt' ? [45, 45, 50, 60] : spec.action === 'death' ? [100, 120, 160, 220]
    : spec.kind === 'survivor' ? [220, 220, 220, 220]
      : Array(12).fill((spec.kind === 'runner' ? 660 : spec.kind === 'armored' ? 1200 : spec.kind === 'tank' ? 1440 : 1000) / 12);
  reviewStates.push({ id: `${spec.kind}/${spec.action}`, kind: spec.kind, action: spec.action, size: spec.size,
    baseline: spec.baseline, old: { path: oldPath, size: spec.referenceSize, baseline: spec.kind === 'tank' ? 241 : 120, durations: oldDurations },
    next: { path: '/' + metadata.runtime.replace(/^public\//, ''), durations: metadata.durations },
    frameOrder: metadata.frameOrder, phases: metadata.attackPhases ?? null,
    contactSheet: `/art/${spec.kind}/${spec.action}-v3-contact.png` });
  await copyFile(path.join(root, 'assets/animation-v3', spec.kind, `${spec.action}-contact-sheet.png`),
    path.join(root, 'public/art', spec.kind, `${spec.action}-v3-contact.png`));
}
await writeFile(path.join(root, 'public/animation-review-data.json'), `${JSON.stringify({ expected: specs.length, states: reviewStates }, null, 2)}\n`, 'utf8');
