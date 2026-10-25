/** Import the two provided full Tiny RPG packs without repainting, resizing, or synthesizing frames. */
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, copyFile, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let sharp;
for (const module of ['sharp', process.env.SHARP_MODULE_PATH, path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')].filter(Boolean)) {
  try { sharp = require(module); break; } catch { /* Try the next configured runtime. */ }
}
if (!sharp) throw new Error('Install sharp or set SHARP_MODULE_PATH.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const retainedRoot = path.join(root, 'assets/native-catalog');
const overrides = JSON.parse(await readFile(path.join(root, 'scripts/character-catalog-overrides.json'), 'utf8'));
const exists = async file => { try { await access(file); return true; } catch { return false; } };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const choices = {
  'Archer': { contact: 6, projectile: [9, -8] },
  'Armored Axeman': { contact: 4, projectile: [14, -8] },
  'Armored Orc': { contact: 4 }, 'Armored Skeleton': { contact: 4 }, 'Bat': { contact: 3 },
  'Elite Orc': { contact: 3 }, 'Greatsword Skeleton': { contact: 3 },
  'Knight': { contact: 3, projectile: [14, -9] },
  'Knight Templar': { contact: 4, projectile: [18, -9] },
  'Lancer': { contact: 3, projectile: [20, -9] },
  'Necromancer': { contact: 5 }, 'Orc': { contact: 3 }, 'Orc rider': { contact: 4 },
  'Priest': { contact: 4, projectile: [13, -12] }, 'Skeleton': { contact: 3 },
  'Skeleton Archer': { contact: 6 }, 'Slime': { contact: 3 },
  'Soldier': { tag: 'Attack03', contact: 7, projectile: [8, -10] },
  'Swordsman': { contact: 3, projectile: [14, -9] }, 'Werebear': { contact: 5 }, 'Werewolf': { contact: 5 },
  'Wizard': { contact: 2, projectile: [12, -12] },
  'Black Knight_A': { contact: 5 }, 'Black Knight_B': { contact: 4 }, 'Black Knight_C': { contact: 5 },
  'Blood Monster_A': { contact: 4 }, 'Blood Monster_B': { contact: 3 },
  'Demon_A': { tag: 'Attack02', contact: 3 }, 'Demon_B': { contact: 6 }, 'Demon_C': { contact: 3 },
  'Demon_D': { contact: 7 }, 'Demon_E': { contact: 5 }, 'Demoness_A': { contact: 5 }, 'Demoness_B': { contact: 5 },
  'Eyeball Monster': { contact: 6 }, 'Flame Golem': { contact: 6 }, 'Ghostfire': { contact: 3 },
  'Hellbat': { contact: 3 }, 'Hellhound': { contact: 5 }, 'Lava Slime': { contact: 3 }, 'Minotaur': { contact: 5 },
  'Warlock': { contact: 4 },
};

function asepriteMetadata(bytes) {
  if (bytes.readUInt16LE(4) !== 0xa5e0 || bytes.readUInt32LE(0) !== bytes.length || bytes.readUInt16LE(8) !== 100 || bytes.readUInt16LE(10) !== 100) throw new Error('Expected an intact 100 × 100 Aseprite source.');
  const durations = [], tags = [];
  for (let offset = 128, frame = 0; frame < bytes.readUInt16LE(6); frame++) {
    const end = offset + bytes.readUInt32LE(offset);
    if (end > bytes.length || bytes.readUInt16LE(offset + 4) !== 0xf1fa) throw new Error('Invalid Aseprite frame.');
    durations.push(bytes.readUInt16LE(offset + 8));
    for (let chunk = offset + 16; chunk < end; chunk += bytes.readUInt32LE(chunk)) {
      if (bytes.readUInt32LE(chunk) < 6 || chunk + bytes.readUInt32LE(chunk) > end) throw new Error('Invalid Aseprite chunk.');
      if (bytes.readUInt16LE(chunk + 4) !== 0x2018) continue;
      const start = chunk + 6; let tag = start + 10;
      for (let index = 0; index < bytes.readUInt16LE(start); index++) {
        const length = bytes.readUInt16LE(tag + 17);
        tags.push({ name: bytes.subarray(tag + 19, tag + 19 + length).toString('utf8'), from: bytes.readUInt16LE(tag), to: bytes.readUInt16LE(tag + 2), direction: bytes[tag + 4] });
        tag += 19 + length;
      }
    }
    offset = end;
  }
  if (durations.some(ms => ms <= 0)) throw new Error('Native frame durations must be positive.');
  return { tags, durations };
}

function alphaBounds(data, width, height, leftOffset = 0, scanWidth = width) {
  let left = scanWidth, top = height, right = -1, bottom = -1, pixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < scanWidth; x++) if (data[(y * width + x + leftOffset) * 4 + 3]) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); pixels++;
  }
  if (!pixels) return { left: 0, top: 0, right: -1, bottom: -1, width: 0, height: 0, pixels: 0, authoredEmpty: true };
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, pixels };
}

await mkdir(retainedRoot, { recursive: true });
const suppliedRoot = path.join(root, 'new_asset'), sources = [];
if (!process.argv.includes('--retained') && await exists(suppliedRoot)) for (const outer of await readdir(suppliedRoot, { withFileTypes: true })) {
  if (!outer.isDirectory() || !outer.name.includes('Full')) continue;
  const outerPath = path.join(suppliedRoot, outer.name);
  const nested = (await readdir(outerPath, { withFileTypes: true })).find(item => item.isDirectory());
  if (!nested) continue;
  const packRoot = path.join(outerPath, nested.name), splitRoot = path.join(packRoot, 'Characters(100x100 split)');
  for (const sourceName of await readdir(splitRoot)) {
    const override = overrides[sourceName];
    if (!override) throw new Error(`Character classification missing: ${sourceName}`);
    const destination = path.join(retainedRoot, override.id, 'source');
    const noShadow = path.join(splitRoot, sourceName, sourceName);
    await mkdir(destination, { recursive: true });
    for (const file of await readdir(noShadow)) if (file.endsWith('.png')) await copyFile(path.join(noShadow, file), path.join(destination, file));
    let aseprite = path.join(packRoot, 'Aseprite file', `${sourceName}.aseprite`);
    if (!await exists(aseprite)) aseprite = path.join(splitRoot, sourceName, `${sourceName}.aseprite`);
    await copyFile(aseprite, path.join(destination, `${sourceName}.aseprite`));
    sources.push({ name: sourceName, id: override.id, pack: nested.name });
  }
}
if (!sources.length) sources.push(...JSON.parse(await readFile(path.join(retainedRoot, 'source-index.json'), 'utf8')));
sources.sort((a, b) => a.id.localeCompare(b.id));
if (sources.length !== 42 || new Set(sources.map(source => source.id)).size !== 42 || Object.keys(overrides).length !== 42) throw new Error('Expected exactly 42 unique characters and classifications.');
await writeFile(path.join(retainedRoot, 'source-index.json'), JSON.stringify(sources, null, 2) + '\n');

const catalog = { version: 1, sourcePacks: [...new Set(sources.map(source => source.pack))], characters: [], sprites: [] };
const manifest = { version: 1, files: [], characters: [], decodedSpriteBytes: 0 };
for (const source of sources) {
  const override = overrides[source.name], choice = choices[source.name];
  if (!choice) throw new Error(`Animation contact review missing: ${source.name}`);
  const directory = path.join(retainedRoot, source.id), sourceDirectory = path.join(directory, 'source');
  const aseBytes = await readFile(path.join(sourceDirectory, `${source.name}.aseprite`)), ase = asepriteMetadata(aseBytes);
  const files = await readdir(sourceDirectory);
  const findTag = (...names) => names.map(name => ase.tags.find(tag => tag.name.toLowerCase() === name.toLowerCase())).find(Boolean);
  const idle = findTag('Idle', 'Flying'), move = findTag('Walk', 'Walk01', 'Flying') ?? idle;
  const attack = findTag(choice.tag ?? 'Attack01', 'Attack', 'Attack02');
  const selected = { idle, move, attack, hurt: findTag('Hurt') ?? idle, death: findTag('Death') ?? findTag('Hurt') ?? idle };
  if (Object.values(selected).some(tag => !tag)) throw new Error(`Missing primary animation for ${source.name}`);
  if (choice.contact < 0 || choice.contact > attack.to - attack.from) throw new Error(`Invalid reviewed contact for ${source.name}`);
  const clips = {}, actions = {};
  let idleBounds, bodyWidth, bodyHeight, footEdge;
  for (const [action, tag] of Object.entries(selected)) {
    if (tag.direction !== 0) throw new Error(`Non-forward native tag requires explicit playback: ${source.name}/${tag.name}`);
    const sourceFile = files.find(file => file.toLowerCase() === `${source.name}_${tag.name}.png`.toLowerCase());
    if (!sourceFile) throw new Error(`Native no-shadow strip missing: ${source.name}/${tag.name}`);
    // Buffer input also supports supplied Windows paths longer than the imaging library's path limit.
    const bytes = await readFile(path.join(sourceDirectory, sourceFile)), meta = await sharp(bytes).metadata();
    const frameCount = tag.to - tag.from + 1, durations = ase.durations.slice(tag.from, tag.to + 1);
    if (!meta.hasAlpha || meta.height !== 100 || meta.width !== frameCount * 100 || durations.length !== frameCount) throw new Error(`Native dimensions/tag mismatch: ${source.name}/${tag.name}`);
    const pixels = await sharp(bytes).ensureAlpha().raw().toBuffer(), frames = [];
    for (let frame = 0; frame < frameCount; frame++) {
      const body = alphaBounds(pixels, meta.width, 100, frame * 100, 100);
      if (body.pixels === 10000 || (!body.pixels && action !== 'death' && action !== 'attack')) throw new Error(`Invalid alpha: ${source.name}/${tag.name}/${frame}`);
      frames.push(body);
    }
    if (action === 'idle') {
      idleBounds = frames[0]; bodyWidth = idleBounds.width; bodyHeight = idleBounds.height;
      footEdge = tag.name === 'Flying' ? 60 : Math.max(...frames.map(frame => frame.bottom)) + 1;
    }
    const runtime = `/art/characters/${source.id}/${action}.png`, output = path.join(directory, `${action}.png`);
    // Native PNG bytes are copied verbatim: no crop, resize, alpha cleanup, palette change or frame synthesis.
    await writeFile(output, bytes);
    await mkdir(path.join(root, 'public/art/characters', source.id), { recursive: true });
    await writeFile(path.join(root, 'public', runtime), bytes);
    const key = `${source.id}-${action}`; actions[action] = key;
    const sprite = { key, path: runtime, size: 100, durations, loop: action === 'idle' || action === 'move', originX: 0.5, originY: footEdge / 100,
      ...(action === 'attack' ? { attackContactFrame: choice.contact, releaseFrame: choice.contact,
        ...(choice.projectile ? { projectileOffset: { x: choice.projectile[0], y: choice.projectile[1] } } : {}) } : {}) };
    catalog.sprites.push(sprite);
    clips[action] = { key, source: `source/${sourceFile}`, sourceSha256: hash(bytes), tag, frameCount, durations, runtime,
      fallback: action === 'hurt' && tag.name.toLowerCase() !== 'hurt' || action === 'death' && tag.name.toLowerCase() !== 'death' ? tag.name : undefined,
      authoredEmptyFrames: frames.flatMap((frame, index) => frame.authoredEmpty ? [index] : []), frames };
    manifest.files.push({ source: `assets/native-catalog/${source.id}/${action}.png`, destination: runtime });
    manifest.decodedSpriteBytes += meta.width * meta.height * 4;
  }
  const scale = override.faction === 'hero' ? clamp(138 / bodyHeight, 5.5, 7)
    : override.enemyKind === 'tank' ? clamp(210 / bodyHeight, 8, 12)
      : override.enemyKind === 'armored' ? clamp(125 / bodyHeight, 5, 7)
        : override.enemyKind === 'runner' ? clamp(110 / bodyHeight, 5, 7) : clamp(110 / bodyHeight, 4.8, 7);
  const displayScale = Math.round(scale * 100) / 100;
  const portrait = `/art/characters/${source.id}/portrait.png`;
  const idleBytes = await readFile(path.join(directory, 'idle.png'));
  const rect = { left: Math.max(0, idleBounds.left - 2), top: Math.max(0, idleBounds.top - 2),
    width: Math.min(100, idleBounds.right + 3) - Math.max(0, idleBounds.left - 2), height: Math.min(100, idleBounds.bottom + 3) - Math.max(0, idleBounds.top - 2) };
  const portraitBytes = await sharp(idleBytes).extract(rect).png().toBuffer();
  await writeFile(path.join(directory, 'portrait.png'), portraitBytes);
  await writeFile(path.join(root, 'public', portrait), portraitBytes);
  manifest.files.push({ source: `assets/native-catalog/${source.id}/portrait.png`, destination: portrait });
  const character = { id: source.id, name: source.name, label: override.label, faction: override.faction,
    ...(override.enemyKind ? { enemyKind: override.enemyKind } : {}), portrait, displayScale, originX: 0.5, originY: footEdge / 100,
    bodyHeight, bodyWidth, hitOffset: { x: Math.round(clamp((idleBounds.left + idleBounds.right) / 2 - 50, -3, 3)),
      y: Math.round(idleBounds.bottom - clamp(bodyHeight, 12, 24) * 0.5 - footEdge) }, actions };
  catalog.characters.push(character);
  const metadata = { ...character, pack: source.pack, originalFrameSize: 100, runtimeFrameSize: 100, resample: 'none', perFrameScale: false, facing: 'right',
    registration: 'Original 100px source canvas; x=50; grounded feet share the native Idle sole, Flying keeps a 60px ground anchor.',
    asepriteSha256: hash(aseBytes), originalTags: ase.tags, clips, portraitCrop: rect };
  await writeFile(path.join(directory, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
  manifest.characters.push({ id: source.id, metadata: `assets/native-catalog/${source.id}/metadata.json` });
  console.log(`${source.id}: ${Object.entries(clips).map(([action, clip]) => `${action}${clip.frameCount}`).join('/')} scale${displayScale} contact${choice.contact}`);
}
if (catalog.characters.filter(character => character.faction === 'hero').length !== 9 || catalog.characters.filter(character => character.faction === 'enemy').length !== 33) throw new Error('Expected 9 heroes and 33 enemies.');
if (new Set(catalog.sprites.map(sprite => sprite.key)).size !== catalog.sprites.length) throw new Error('Duplicate native sprite key.');
await writeFile(path.join(root, 'src/game/characterCatalog.generated.json'), JSON.stringify(catalog, null, 2) + '\n');
await writeFile(path.join(root, 'public/art/characters/catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
await writeFile(path.join(retainedRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ characters: catalog.characters.length, heroes: 9, enemies: 33, sprites: catalog.sprites.length,
  decodedSpriteMiB: Math.round(manifest.decodedSpriteBytes / 1024 / 1024 * 100) / 100, runtimeFiles: manifest.files.length }));
