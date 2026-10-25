/** Preserve the provided Soldier's native pixels, frame order and Aseprite timing. */
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, copyFile, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let sharp;
for (const module of ['sharp', process.env.SHARP_MODULE_PATH, path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')].filter(Boolean)) {
  try { sharp = require(module); break; } catch { /* Next configured runtime. */ }
}
if (!sharp) throw new Error('Install sharp or set SHARP_MODULE_PATH.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'assets/native-soldier');
const retained = path.join(output, 'source');
const exists = async file => { try { await access(file); return true; } catch { return false; } };
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
await mkdir(retained, { recursive: true });
if (!await exists(path.join(retained, 'Soldier.aseprite'))) {
  const supplied = process.argv.includes('--source-dir') ? process.argv[process.argv.indexOf('--source-dir') + 1]
    : path.join(root, 'new_asset', (await readdir(path.join(root, 'new_asset'))).find(name => name.startsWith('Tiny RPG Character Asset Pack 01') && !name.endsWith('.zip')),
      'Tiny RPG Character Asset Pack 01 v2.0 -Free Soldier&Orc');
  const split = path.join(supplied, 'Characters(100x100 split)/Soldier/Soldier');
  for (const file of await readdir(split)) if (file.endsWith('.png')) await copyFile(path.join(split, file), path.join(retained, file));
  await copyFile(path.join(supplied, 'Aseprite file/Soldier.aseprite'), path.join(retained, 'Soldier.aseprite'));
}
const ase = await readFile(path.join(retained, 'Soldier.aseprite'));
if (ase.readUInt16LE(4) !== 0xa5e0 || ase.readUInt16LE(8) !== 100 || ase.readUInt16LE(10) !== 100) throw new Error('Unexpected Soldier Aseprite canvas.');
const timing = [], tags = [];
for (let offset = 128, frame = 0; frame < ase.readUInt16LE(6); frame++) {
  const end = offset + ase.readUInt32LE(offset); timing.push(ase.readUInt16LE(offset + 8));
  for (let chunk = offset + 16; chunk < end; chunk += ase.readUInt32LE(chunk)) {
    if (ase.readUInt32LE(chunk) < 6 || chunk + ase.readUInt32LE(chunk) > end) throw new Error('Invalid Aseprite chunk.');
    if (ase.readUInt16LE(chunk + 4) !== 0x2018) continue;
    const start = chunk + 6; let tag = start + 10;
    for (let i = 0; i < ase.readUInt16LE(start); i++) {
      const length = ase.readUInt16LE(tag + 17);
      tags.push({ name: ase.subarray(tag + 19, tag + 19 + length).toString('utf8'), from: ase.readUInt16LE(tag), to: ase.readUInt16LE(tag + 2), direction: ase[tag + 4] });
      tag += 19 + length;
    }
  }
  offset = end;
}
const specs = [['idle', 'Idle'], ['walk', 'Walk'], ['shoot', 'Attack03'], ['hurt', 'Hurt'], ['death', 'Death']];
const size = 256, scale = 5, anchor = { x: 116, y: 240 }, sourceAnchor = { x: 50, y: 60 };
const framesByAction = new Map();
const union = { left: 100, top: 100, right: -1, bottom: -1 };
function bounds(data, width, height) {
  let left = width, top = height, right = -1, bottom = -1, pixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3]) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); pixels++;
  }
  if (!pixels) throw new Error('Empty Soldier frame.');
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, pixels };
}
for (const [action, tagName] of specs) {
  const source = path.join(retained, `Soldier_${tagName}.png`), tag = tags.find(t => t.name === tagName), meta = await sharp(source).metadata();
  if (!tag || tag.direction !== 0 || !meta.hasAlpha || meta.height !== 100 || meta.width !== (tag.to - tag.from + 1) * 100) throw new Error(`Invalid source ${tagName}.`);
  const frames = [];
  for (let index = 0; index <= tag.to - tag.from; index++) {
    const { data } = await sharp(source).extract({ left: index * 100, top: 0, width: 100, height: 100 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const body = bounds(data, 100, 100);
    union.left = Math.min(union.left, body.left); union.top = Math.min(union.top, body.top);
    union.right = Math.max(union.right, body.right); union.bottom = Math.max(union.bottom, body.bottom);
    frames.push({ data, body });
  }
  framesByAction.set(action, { frames, source, tag, durations: timing.slice(tag.from, tag.to + 1) });
}
const crop = { left: union.left - 1, top: union.top - 1, width: union.right - union.left + 3, height: union.bottom - union.top + 3 };
const placement = { left: anchor.x - (sourceAnchor.x - crop.left) * scale, top: anchor.y - (sourceAnchor.y - crop.top) * scale,
  width: crop.width * scale, height: crop.height * scale };
if (placement.left < 0 || placement.top < 0 || placement.left + placement.width > size || placement.top + placement.height > size) throw new Error('Shared Soldier crop does not fit. Increase canvas, never shrink individual actions.');
await mkdir(path.join(root, 'public/art/survivor'), { recursive: true });
const assets = [];
for (const [action] of specs) {
  const { frames: sourceFrames, source, tag, durations } = framesByAction.get(action), frames = [], frameMetadata = [];
  for (const [index, sourceFrame] of sourceFrames.entries()) {
    const pixels = await sharp(sourceFrame.data, { raw: { width: 100, height: 100, channels: 4 } }).extract(crop)
      .resize(placement.width, placement.height, { kernel: 'nearest' }).png().toBuffer();
    const frame = await sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } })
      .composite([{ input: pixels, left: placement.left, top: placement.top }]).png().toBuffer();
    const data = await sharp(frame).ensureAlpha().raw().toBuffer(), body = bounds(data, size, size);
    if (Math.min(body.left, body.top, size - 1 - body.right, size - 1 - body.bottom) < 2) throw new Error(`${action}/${index} lacks safe padding.`);
    frames.push(frame); frameMetadata.push({ index, sourceIndex: tag.from + index, sourceBody: sourceFrame.body, body, rgbaSha256: sha(data) });
  }
  const sheet = `${action}-sheet-${size}.png`, runtime = `/art/survivor/${action}-soldier.png`;
  await sharp({ create: { width: size * frames.length, height: size, channels: 4, background: '#00000000' } })
    .composite(frames.map((input, index) => ({ input, left: index * size, top: 0 }))).png().toFile(path.join(output, sheet));
  await copyFile(path.join(output, sheet), path.join(root, 'public', runtime));
  const contactColumns = Math.min(4, frames.length), contactRows = Math.ceil(frames.length / contactColumns);
  const guide = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size * contactColumns}" height="${(size + 22) * contactRows}"><rect width="100%" height="100%" fill="#20333e"/>${frames.map((_, index) => `<path d="M${index % contactColumns * size},${Math.floor(index / contactColumns) * (size + 22) + anchor.y}h${size}" stroke="#6ba18b" opacity=".6"/><text x="${index % contactColumns * size + 8}" y="${Math.floor(index / contactColumns) * (size + 22) + size + 16}" fill="#f5eedc" font-size="14">${index + 1} · ${durations[index]} ms</text>`).join('')}</svg>`);
  const contact = `${action}-contact-sheet.png`;
  await sharp(guide).composite(frames.map((input, index) => ({ input, left: index % contactColumns * size, top: Math.floor(index / contactColumns) * (size + 22) }))).png().toFile(path.join(output, contact));
  await copyFile(path.join(output, contact), path.join(root, `public/art/survivor/${action}-soldier-contact.png`));
  const stacked = await sharp({ create: { width: size, height: size * frames.length, channels: 4, background: '#20333e' } })
    .composite(frames.map((input, index) => ({ input, left: 0, top: index * size }))).raw().toBuffer();
  const preview = `${action}-preview.gif`;
  await sharp(stacked, { raw: { width: size, height: size * frames.length, channels: 4, pageHeight: size } })
    .gif({ delay: durations, loop: 0, keepDuplicateFrames: true, dither: 0, effort: 7 }).toFile(path.join(output, preview));
  const gif = await sharp(path.join(output, preview), { animated: true }).metadata();
  if (gif.pages !== frames.length || gif.delay?.length !== frames.length || gif.delay.some(ms => ms <= 0)) throw new Error(`Invalid ${action} preview timing.`);
  const asset = { key: `survivor-${action}`, path: runtime, size, durations, loop: ['idle', 'walk'].includes(action), originX: anchor.x / size, originY: anchor.y / size,
    ...(action === 'shoot' ? { releaseFrame: 7, projectileOffset: { x: 40, y: -50 } } : {}) };
  assets.push(asset);
  const metadata = { version: 1, character: 'Soldier', action, source: `source/Soldier_${tag.name}.png`, sourceSha256: sha(await readFile(source)), asepriteSha256: sha(ase),
    tag, frameCount: frames.length, durations, frameSize: size, scale, perFrameScale: false, resample: 'nearest', facing: 'right', sharedSourceCrop: crop, sourceAnchor, anchor,
    placement, runtime, sheet, preview: { file: preview, frames: gif.pages, durations: gif.delay }, asset, frames: frameMetadata };
  await writeFile(path.join(output, `${action}-metadata.json`), JSON.stringify(metadata, null, 2) + '\n');
  console.log(JSON.stringify({ action, frames: frames.length, size, scale, durations, runtime }));
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ character: 'Soldier archer', tags, originalFrames: timing.length, assets }, null, 2) + '\n');
const galleryPath = path.join(root, 'public/animation-review-data.json');
const gallery = await exists(galleryPath) ? JSON.parse(await readFile(galleryPath, 'utf8')) : { states: [] };
gallery.states = gallery.states.filter(state => !state.id.startsWith('soldier/'));
for (const asset of assets) {
  const action = asset.key.replace('survivor-', ''), oldSize = action === 'walk' ? 128 : 128;
  const oldDurations = action === 'walk' ? Array(12).fill(70) : action === 'idle' ? [220, 220, 220, 220]
    : action === 'shoot' ? [45, 45, 60, 70] : action === 'hurt' ? [70, 70, 80, 100] : [140, 160, 200, 350];
  gallery.states.push({ id: `soldier/${action}`, kind: 'soldier', action, size, baseline: anchor.y,
    old: { path: `/art/survivor/${action}${action === 'walk' ? '-v3' : ''}.png`, size: oldSize, baseline: 120, durations: oldDurations },
    next: { path: asset.path, durations: asset.durations }, frameOrder: framesByAction.get(action).frames.map((_, index) => index + framesByAction.get(action).tag.from),
    phases: asset.releaseFrame !== undefined ? { anticipation: [0, 1, 2, 3, 4, 5, 6], contact: [7], recovery: [8] } : null,
    contactSheet: `/art/survivor/${action}-soldier-contact.png` });
}
gallery.expected = gallery.states.length;
await writeFile(galleryPath, JSON.stringify(gallery, null, 2) + '\n');
