import type Phaser from 'phaser';
import { DISTRICTS, WORLD_WIDTH } from './worldLayout';
import { localizeText, type Language } from '../i18n';

/** One continuous road, with overlapping scenery rather than scene swaps. */
export function createWorldBackdrop(scene: Phaser.Scene, language: Language = 'vi', registerLabel?: (label: Phaser.GameObjects.Text, source: string) => void): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);
  for (let i = 0; i < 5; i++) {
    // Mirroring alternate panels makes both adjoining edge pixels identical.
    root.add(scene.add.image(i * 1280 + 640, 360, 'city').setDisplaySize(1280, 720).setFlipX(i % 2 === 1));
  }
  const g = scene.add.graphics();
  root.add(g);
  const rect = (x: number, y: number, width: number, height: number, color: number, alpha = 1) => {
    g.fillStyle(color, alpha).fillRect(Math.round(x), Math.round(y), width, height);
  };
  const line = (x0: number, y0: number, x1: number, y1: number, color: number, width = 3, alpha = 1) => {
    g.lineStyle(width, color, alpha).lineBetween(x0, y0, x1, y1);
  };
  const tree = (x: number, y: number, size = 1) => {
    const box = (dx: number, dy: number, w: number, h: number, c: number) => rect(x + dx * size, y + dy * size, w * size, h * size, c);
    box(-8, -160, 16, 160, 0x182d35);
    box(-2, -104, 6, 104, 0x345045);
    for (let dy = -246; dy < -122; dy += 6) {
      for (let dx = -90; dx < 90; dx += 6) {
        const edge = Math.min(((dx + 31) / 59) ** 2 + ((dy + 177) / 49) ** 2,
          ((dx - 32) / 55) ** 2 + ((dy + 172) / 47) ** 2,
          (dx / 49) ** 2 + ((dy + 211) / 37) ** 2);
        const noise = Math.abs(Math.sin((dx + x) * 0.71 + dy * 1.31));
        if (edge > 1 || edge > .88 && noise > .6) continue;
        const lit = dy < -190 && dx < 20;
        const colors = lit ? [0x264f44, 0x326052, 0x426c58] : [0x173d3b, 0x214a41, 0x2d5749];
        box(dx, dy, 6, 6, colors[Math.floor(noise * 2.99)]);
      }
    }
  };
  const lamp = (x: number, y = 477) => {
    rect(x - 4, y - 164, 8, 164, 0x101f2d);
    rect(x - 4, y - 167, 45, 6, 0x182c39);
    rect(x + 27, y - 162, 23, 6, 0xe6ae68);
    rect(x + 22, y - 157, 33, 8, 0xe6ae68, .12);
    rect(x - 9, y - 8, 18, 8, 0x223342);
  };
  const bench = (x: number) => {
    rect(x - 49, 434, 98, 7, 0x725e50);
    rect(x - 49, 444, 98, 6, 0x5a4c42);
    rect(x - 53, 455, 106, 8, 0x3b4547);
    rect(x - 43, 461, 7, 15, 0x172a34);
    rect(x + 36, 461, 7, 15, 0x172a34);
  };

  // Soft district colour bands overlap for 320px; there are no transition triggers.
  for (const district of DISTRICTS.slice(1)) {
    for (let x = district.start - 160; x < district.start + 1440; x += 16) {
      const edge = Math.max(0, Math.min(1, (x - district.start + 160) / 320, (district.start + 1440 - x) / 320));
      rect(x, 0, 16, 720, district.color, .13 * edge);
    }
  }

  // Overgrown park: foliage begins before the district boundary and trails out.
  for (const [x, scale] of [[1190, .75], [1390, .9], [1590, 1.05], [1880, 1.15], [2160, 1], [2430, .8], [2580, .6]]) {
    tree(x, 472, scale);
  }
  for (let x = 1320; x < 2480; x += 36) {
    rect(x, 437, 5, 38, 0x263f43);
    rect(x - 10, 445, 35, 4, 0x36514d);
  }
  bench(1720); bench(2280); lamp(1500); lamp(2380);
  for (let x = 1410; x < 2510; x += 79) {
    rect(x, 465, 20, 10, 0x305443);
    rect(x + 5, 460, 9, 6, 0x51735a);
    rect(x + 12, 459, 4, 4, 0xae9271);
  }

  // Station shelter and disused tram. Low-contrast structures sit behind labels.
  rect(2730, 302, 850, 154, 0x293b48, .9);
  rect(2745, 312, 820, 9, 0x5d6262);
  for (let x = 2770; x < 3520; x += 98) {
    rect(x, 333, 73, 61, 0x102838);
    rect(x + 6, 339, 29, 45, 0x53656a, .48);
    rect(x + 39, 338, 3, 55, 0x6c6e67);
  }
  rect(2730, 405, 850, 8, 0x977354, .6);
  for (const x of [2800, 2960, 3320, 3490]) {
    rect(x, 447, 42, 23, 0x10202b);
    rect(x + 9, 453, 24, 12, 0x37444b);
  }
  rect(2640, 264, 1030, 17, 0x1a2b35);
  rect(2640, 261, 1030, 4, 0x72716a);
  for (const x of [2670, 3180, 3620]) { rect(x, 278, 12, 196, 0x26343e); rect(x + 2, 279, 3, 196, 0x63706b); }
  line(2640, 263, 2830, 230, 0x35434b, 7);
  line(2830, 230, 3670, 263, 0x35434b, 7);
  lamp(3770);

  // River promenade and bridge silhouette; the sidewalk stays at exactly y=478.
  for (let y = 350; y < 449; y += 9) rect(3930, y, 1080, 9, y % 2 ? 0x244352 : 0x2a4957, .9);
  for (let i = 0; i < 48; i++) rect(3950 + (i * 127 % 1020), 356 + (i * 29 % 83), 20 + i % 4 * 9, 2, 0x7a9795, .25);
  line(4000, 323, 4980, 323, 0x162c3a, 11);
  for (let x = 4050; x < 4960; x += 130) {
    rect(x, 288, 9, 63, 0x1a3440);
    line(x, 292, x + 130, 320, 0x294652, 4);
  }
  for (let x = 3900; x < 5070; x += 46) rect(x, 425, 5, 50, 0x29424b);
  rect(3890, 426, 1190, 5, 0x607776);
  rect(3890, 446, 1190, 4, 0x344e55);
  bench(4120); bench(4850); lamp(3900); lamp(5030);

  // Industrial courtyard: brick, conduits, tall tanks and warm warning lamps.
  rect(5280, 252, 1000, 222, 0x2d3545);
  for (let y = 267; y < 474; y += 22) {
    rect(5280, y, 1000, 2, 0x4a4650, .55);
    for (let x = 5280 + (y % 44 ? 0 : 24); x < 6260; x += 48) rect(x, y, 2, 22, 0x4a4650, .45);
  }
  for (const x of [5300, 5480, 6020, 6200]) {
    rect(x, 280, 60, 94, 0x152635);
    rect(x + 5, 285, 50, 29, 0x9f765a, .45);
    rect(x + 28, 280, 4, 94, 0x4c545d);
    rect(x, 327, 60, 4, 0x4c545d);
  }
  for (const x of [5580, 5710]) {
    rect(x, 205, 92, 260, 0x3b4a56);
    rect(x + 8, 200, 76, 9, 0x72807e);
    rect(x + 14, 218, 12, 239, 0x54616a);
    for (let y = 237; y < 460; y += 62) rect(x - 4, y, 100, 8, 0x293c48);
  }
  line(5190, 423, 5540, 423, 0x53616b, 15);
  line(5190, 423, 5190, 340, 0x53616b, 15);
  rect(5880, 398, 90, 76, 0x765c43);
  line(5890, 404, 5959, 466, 0x493e34, 5);
  line(5890, 466, 5959, 404, 0x493e34, 5);
  lamp(5260); lamp(6100);

  // One pavement edge across the entire world unifies the five environments.
  rect(0, 476, WORLD_WIDTH, 4, 0x778286, .7);
  rect(0, 483, WORLD_WIDTH, 3, 0x142633, .7);
  for (let x = 0; x < WORLD_WIDTH; x += 80) rect(x, 478, 2, 15, 0x20333e, .65);
  for (const district of DISTRICTS.slice(1)) {
    rect(district.start + 52, 399, 6, 78, 0x283a42);
    rect(district.start + 21, 390, 160, 30, 0x162d38);
    rect(district.start + 21, 390, 160, 2, 0x6d8b8a);
    const label = scene.add.text(district.start + 101, 405, localizeText(district.name, language).toUpperCase(), {
      fontFamily: '"Be Vietnam Pro", Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#b9cdc6',
    }).setOrigin(.5);
    root.add(label);
    registerLabel?.(label, district.name);
  }
  return root;
}
