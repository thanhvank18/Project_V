// Motion reference for image generation, not a runtime game asset.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
const require = createRequire(import.meta.url);
const sharp = require(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const out = path.resolve('assets/animation-v3');
await mkdir(out, { recursive: true });
const rad = degrees => degrees * Math.PI / 180;
const point = (origin, length, angle) => [origin[0] + length * Math.sin(rad(angle)), origin[1] + length * Math.cos(rad(angle))];
const leg = (hip, phase, gait) => {
  const stance = phase < .5;
  const t = stance ? phase * 2 : (phase - .5) * 2;
  const reach = gait === 'run' ? 36 : 26;
  const lift = gait === 'run' ? 31 : 16;
  const ankle = [hip[0] + (stance ? reach - 2 * reach * t : -reach + 2 * reach * t), 229 - (stance ? 0 : lift * Math.sin(t * Math.PI))];
  const dx = ankle[0] - hip[0], dy = ankle[1] - hip[1];
  const distance = Math.hypot(dx, dy), length = 37;
  const bend = Math.sqrt(Math.max(0, length * length - distance * distance / 4));
  const knee = [(hip[0] + ankle[0]) / 2 + dy / distance * bend, (hip[1] + ankle[1]) / 2 - dx / distance * bend];
  return [hip, knee, ankle, [ankle[0] + 16, ankle[1] + 3]];
};
const line = (points, color, width) => `<polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
for (const gait of ['run', 'walk']) {
let drawing = '';
for (let i = 0; i < 12; i++) {
  const phase = i / 12, bounce = -2 * Math.cos(phase * 4 * Math.PI);
  const shoulder = [125, 130 + bounce], hip = [114, 178 + bounce];
  const angle = -(gait === 'run' ? 65 : 38) * Math.cos(phase * 2 * Math.PI);
  const arm = a => { const elbow = point(shoulder, 31, a); return [shoulder, elbow, point(elbow, 28, a + (gait === 'run' ? 72 : 32))]; };
  drawing += `<g transform="translate(${i % 4 * 256},${Math.floor(i / 4) * 256})">`;
  drawing += `<path d="M25 233H231" stroke="#cad4d9" stroke-width="1"/>`;
  drawing += line(leg(hip, (phase + .5) % 1, gait), '#2685c7', 11) + line(arm(-angle), '#2685c7', 12);
  drawing += line([hip, shoulder, [136, 101 + bounce]], '#405563', 23);
  drawing += `<circle cx="139" cy="73" r="34" fill="#e1e6e9" stroke="#405563" stroke-width="3"/><path d="M165 70l13 9-14 6" fill="#405563"/>`;
  drawing += line(leg(hip, phase, gait), '#dc583d', 13) + line(arm(angle), '#dc583d', 14);
  drawing += `<circle cx="${shoulder[0]}" cy="${shoulder[1]}" r="5" fill="#f6cb61"/><text x="20" y="24" fill="#45535e" font-size="15">${i + 1}</text></g>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="100%" height="100%" fill="#f3f5f6"/>${drawing}</svg>`;
await writeFile(path.join(out, `${gait}-pose-guide.svg`), svg);
await sharp(Buffer.from(svg)).png().toFile(path.join(out, `${gait}-pose-guide.png`));
}
console.log('Saved 12-pose run/walk guides: red near limbs, blue far limbs, opposing arm/leg swing.');
