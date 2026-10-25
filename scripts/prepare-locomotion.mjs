/** Repack generated 4 x 3 source sheets. No drawing, synthesized frames, or per-pose fitting. */
import { createRequire } from 'node:module';
import { mkdir, copyFile, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
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
  { kind: 'normal', action: 'walk', size: 128, baseline: 120, delay: 90, file: 'exec-1e5a0d32-2e21-4d6c-97b8-52cff6ebe0ef.png' },
  { kind: 'runner', action: 'run', size: 128, baseline: 120, delay: 65, file: 'exec-c66275b0-908e-48ae-a3b3-bddbd64d61de.png',
    frameOrder: [8, 0, 9, 1, 2, 10, 3, 11, 4, 5, 6, 7] },
  { kind: 'armored', action: 'walk', size: 128, baseline: 120, delay: 110, file: 'exec-8f4f7141-e6e7-43d9-99f9-bab320787c36.png' },
  { kind: 'tank', action: 'walk', size: 256, baseline: 241, delay: 130, file: 'exec-7ac623c6-7e87-430e-94f5-51c30a2be529.png' },
];
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

function contentRows(data, width, height) {
  const bands = [];
  let start = -1;
  for (let y = 0; y < height; y++) {
    let occupied = false;
    for (let x = 0; x < width && !occupied; x++) occupied = data[(y * width + x) * 4 + 3] > 16;
    if (occupied && start < 0) start = y;
    if (!occupied && start >= 0) { bands.push([start, y - 1]); start = -1; }
  }
  if (start >= 0) bands.push([start, height - 1]);
  if (bands.length !== 3) throw new Error(`Expected three separated content rows, found ${bands.length}; inspect source before cropping.`);
  const cuts = [0, Math.floor((bands[0][1] + bands[1][0]) / 2), Math.floor((bands[1][1] + bands[2][0]) / 2), height];
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
  if (bands.length !== 4) throw new Error(`Expected four separated poses in row, found ${bands.length}; inspect source before cropping.`);
  return { bands, cuts: [0, ...bands.slice(0, -1).map((band, i) => Math.floor((band[1] + bands[i + 1][0]) / 2)), width] };
}

/** Clothing colour in a torso-only window avoids arm/foot extensions moving the registration point. */
function torsoAnchor(kind, data, width, bbox) {
  const x0 = Math.floor(bbox.left + bbox.width * .18), x1 = Math.ceil(bbox.left + bbox.width * .78);
  const y0 = Math.floor(bbox.top + bbox.height * .36), y1 = Math.ceil(bbox.top + bbox.height * .73);
  let weight = 0, sumX = 0, sumY = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = (y * width + x) * 4, [r, g, b, a] = data.subarray(p, p + 4);
    const clothing = kind === 'normal' ? r > g * 1.35 && b > g * 1.2 && r > 55
      : kind === 'runner' ? r > g * 1.25 && b > g * 1.25 && b > 45
        : kind === 'armored' ? b > r * 1.12 && b > g * .98 && b > 35
          : r > g * 1.2 && g > b * 1.3 && r > 90;
    if (a < 128 || !clothing) continue;
    sumX += x * a; sumY += y * a; weight += a;
  }
  if (weight < 128 * 8) return { x: (bbox.left + bbox.right) / 2, y: bbox.top + bbox.height * .55, method: 'torso-window-fallback' };
  return { x: sumX / weight, y: sumY / weight, method: 'clothing-centroid' };
}

async function rawFrame(source, rect, kind) {
  const { data, info } = await sharp(source).extract(rect).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const body = bounds(data, info.width, info.height);
  // The generated sheets contain isolated alpha 1-16 speckles far from the sprite.
  // Keep a small untouched fringe around the visible body rather than fitting that noise.
  const left = Math.max(0, body.left - 3), top = Math.max(0, body.top - 3);
  const right = Math.min(info.width - 1, body.right + 3), bottom = Math.min(info.height - 1, body.bottom + 3);
  return { data, width: info.width, height: info.height, rect, body,
    crop: { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 },
    anchor: torsoAnchor(kind, data, info.width, body) };
}

async function prepare(spec) {
  const directory = path.join(root, 'assets/locomotion-v2', spec.kind);
  await mkdir(directory, { recursive: true });
  const source = path.join(directory, 'source.png');
  if (!await exists(source)) await copyFile(path.join(sourceDirectory, spec.file), source);
  const sourceBytes = await readFile(source), meta = await sharp(source).metadata();
  if (!meta.hasAlpha) throw new Error(`${spec.kind}: source needs a real alpha channel`);
  const raw = await sharp(source).ensureAlpha().raw().toBuffer();
  const rows = contentRows(raw, meta.width, meta.height);
  const columns = rows.bands.map(band => contentColumns(raw, meta.width, band));
  const extracted = [];
  for (let index = 0; index < 12; index++) {
    const column = index % 4, row = Math.floor(index / 4);
    const left = columns[row].cuts[column], right = columns[row].cuts[column + 1];
    extracted.push(await rawFrame(source, { left, top: rows.cuts[row], width: right - left,
      height: rows.cuts[row + 1] - rows.cuts[row] }, spec.kind));
  }
  const frameOrder = spec.frameOrder ?? Array.from({ length: 12 }, (_, i) => i);
  if (frameOrder.length !== 12 || new Set(frameOrder).size !== 12 || frameOrder.some(i => !Number.isInteger(i) || i < 0 || i >= 12)) {
    throw new Error(`${spec.kind}: frameOrder must be a permutation of 0..11`);
  }
  const sourceFrames = frameOrder.map(index => extracted[index]);
  const reference = path.join(root, 'public/art', spec.kind, `${spec.action}.png`);
  const oldFrames = await Promise.all(Array.from({ length: 4 }, (_, i) => rawFrame(reference,
    { left: i * spec.size, top: 0, width: spec.size, height: spec.size }, spec.kind)));
  let scale = median(oldFrames.map(f => f.body.height)) / median(sourceFrames.map(f => f.body.height));
  const leftReach = Math.max(...sourceFrames.map(f => f.anchor.x - f.crop.left));
  const rightReach = Math.max(...sourceFrames.map(f => f.crop.right - f.anchor.x));
  scale = Math.min(scale, (spec.size - 8) / (leftReach + rightReach), (spec.baseline - 4) / Math.max(...sourceFrames.map(f => f.crop.height)));
  const targetAnchorX = clamp(median(oldFrames.map(f => f.anchor.x)), 4 + leftReach * scale, spec.size - 4 - rightReach * scale);
  const runnerAnchorY = spec.baseline - Math.max(...sourceFrames.map(f => f.body.bottom - f.anchor.y)) * scale;
  const frames = [], frameMetadata = [];
  for (const [index, frame] of sourceFrames.entries()) {
    const crop = frame.crop;
    const width = Math.max(1, Math.round(crop.width * scale)), height = Math.max(1, Math.round(crop.height * scale));
    const pixels = await sharp(frame.data, { raw: { width: frame.width, height: frame.height, channels: 4 } })
      .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
      .resize(width, height, { kernel: 'nearest' }).png().toBuffer();
    const left = Math.round(targetAnchorX - (frame.anchor.x - crop.left) * scale);
    const top = spec.kind === 'runner' ? Math.round(runnerAnchorY - (frame.anchor.y - crop.top) * scale)
      : spec.baseline - Math.round((frame.body.bottom - crop.top) * scale);
    if (left < 2 || top < 2 || left + width > spec.size - 2 || top + height > spec.size - 2) {
      throw new Error(`${spec.kind} frame ${index}: unsafe placement ${JSON.stringify({ left, top, width, height })}`);
    }
    const buffer = await sharp({ create: { width: spec.size, height: spec.size, channels: 4, background: '#00000000' } })
      .composite([{ input: pixels, left, top }]).png().toBuffer();
    const output = await sharp(buffer).raw().toBuffer(), body = bounds(output, spec.size, spec.size);
    if (!body.zeroAlpha || body.visiblePixels < 100 || Math.min(body.left, body.top, spec.size - 1 - body.right, spec.size - 1 - body.bottom) < 2) {
      throw new Error(`${spec.kind} frame ${index}: failed alpha, occupancy or padding validation`);
    }
    frames.push(buffer);
    frameMetadata.push({ index, sourceIndex: frameOrder[index], sourceRect: frame.rect, sourceBody: frame.body, sourceAnchor: frame.anchor,
      placement: { left, top, width, height }, body, footClearance: spec.baseline - body.bottom, rgbaSha256: hash(output) });
  }
  if (new Set(frameMetadata.map(f => f.rgbaSha256)).size !== 12) throw new Error(`${spec.kind}: duplicate output frames`);
  const sheetName = `${spec.action}-sheet-${spec.size}.png`, sheetPath = path.join(directory, sheetName);
  await sharp({ create: { width: spec.size * 12, height: spec.size, channels: 4, background: '#00000000' } })
    .composite(frames.map((input, i) => ({ input, left: i * spec.size, top: 0 }))).png().toFile(sheetPath);
  const destination = path.join(root, 'public/art', spec.kind, `${spec.action}-v2.png`);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(sheetPath, destination);
  const contactWidth = spec.size * 4, contactHeight = (spec.size + 22) * 3;
  const guides = Array.from({ length: 12 }, (_, i) => {
    const x = i % 4 * spec.size, y = Math.floor(i / 4) * (spec.size + 22);
    return `<rect x="${x}" y="${y}" width="${spec.size}" height="${spec.size}" fill="${i % 2 ? '#253b46' : '#20333e'}"/><path d="M${x},${y + spec.baseline}h${spec.size}" stroke="#6ba18b" opacity=".65"/><path d="M${x + targetAnchorX},${y}v${spec.size}" stroke="#cfa767" opacity=".35"/><text x="${x + 5}" y="${y + spec.size + 16}" fill="#dfece7" font-size="12" font-family="Arial">${i + 1} · gap ${frameMetadata[i].footClearance}px</text>`;
  }).join('');
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${contactWidth}" height="${contactHeight}"><rect width="100%" height="100%" fill="#14242d"/>${guides}</svg>`);
  await sharp(svg).composite(frames.map((input, i) => ({ input, left: i % 4 * spec.size,
    top: Math.floor(i / 4) * (spec.size + 22) }))).png().toFile(path.join(directory, 'contact-sheet.png'));
  const stacked = await sharp({ create: { width: spec.size, height: spec.size * 12, channels: 4, background: '#20333e' } })
    .composite(frames.map((input, i) => ({ input, left: 0, top: i * spec.size }))).raw().toBuffer();
  const gifPath = path.join(directory, 'preview.gif');
  await sharp(stacked, { raw: { width: spec.size, height: spec.size * 12, channels: 4, pageHeight: spec.size } })
    .gif({ loop: 0, delay: Array(12).fill(Math.round(spec.delay / 10) * 10), effort: 7, colours: 256, dither: 0 }).toFile(gifPath);
  const gif = await sharp(gifPath, { animated: true }).metadata();
  if (gif.pages !== 12 || gif.pageHeight !== spec.size || gif.delay?.length !== 12 || gif.delay.some(ms => ms <= 0)) {
    throw new Error(`${spec.kind}: GIF must contain 12 pages with positive frame durations`);
  }
  const metadata = { version: 2, kind: spec.kind, action: spec.action, source: 'source.png', sourceGeneratorFile: spec.file,
    sourceSha256: hash(sourceBytes), frameOrder,
    sourceDimensions: { width: meta.width, height: meta.height }, sourceContentRows: rows.bands,
    sourceContentColumns: columns.map(row => row.bands),
    frameCount: 12, frameSize: spec.size, sheet: sheetName, runtime: path.relative(root, destination).replaceAll('\\', '/'),
    baseline: spec.baseline, registration: 'torso clothing centroid in restricted window; grounded walk aligned by sole; runner retains leg clearance',
    scale, perFrameScale: false, resample: 'nearest', targetAnchorX, reference: path.relative(root, reference).replaceAll('\\', '/'),
    referenceMedianBody: { width: median(oldFrames.map(f => f.body.width)), height: median(oldFrames.map(f => f.body.height)) },
    preview: { file: 'preview.gif', frames: gif.pages, delays: gif.delay, loop: gif.loop,
      note: 'Presentation cadence only; runtime may advance frames by distance.' }, frames: frameMetadata };
  await writeFile(path.join(directory, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  return { kind: spec.kind, frames: 12, sheet: path.relative(root, sheetPath), size: `${spec.size * 12}x${spec.size}`,
    scale, bodyHeightRange: [Math.min(...frameMetadata.map(f => f.body.height)), Math.max(...frameMetadata.map(f => f.body.height))],
    footClearance: frameMetadata.map(f => f.footClearance), gifFrames: gif.pages };
}

for (const spec of specs) console.log(JSON.stringify(await prepare(spec)));
