import { mkdir, copyFile, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [{ source: 'assets/mvp-v1/environment/city-background.png', destination: '/art/background.png' }];
for (const action of ['muzzle-flash', 'letter-impact', 'ground-dust']) files.push({
  source: `assets/mvp-v1/effects/${action}/${action}-sheet-64.png`, destination: `/art/effects/${action}.png`,
});
for (const [source, target] of [['health', 'health'], ['freeze', 'freeze'], ['damage', 'damage'], ['vocabulary-shield', 'shield']]) files.push({
  source: `assets/mvp-v1/pickups/${source}/base-right-64.png`, destination: `/art/items/${target}.png`,
});
const native = JSON.parse(await readFile(path.join(root, 'assets/native-catalog/manifest.json'), 'utf8'));
files.push(...native.files, { source: 'src/game/characterCatalog.generated.json', destination: '/art/characters/catalog.json' });
// Verify the complete retained pack before mutating any runtime copy.
for (const file of files) await access(path.join(root, file.source));
for (const file of files) {
  const destination = path.join(root, 'public', file.destination.replace(/^\/+/, ''));
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(root, file.source), destination);
}
console.log(`Prepared ${files.length} runtime files: 42 native characters, original strips/portraits, environment and effects. Sources retained in assets/.`);
