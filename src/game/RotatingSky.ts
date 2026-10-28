import type Phaser from 'phaser';
import { SKY_TEXTURES, skyFrameAt } from './skyCycle';

export function preloadSky(scene: Phaser.Scene): void {
  for (const sky of SKY_TEXTURES) scene.load.image(sky.key, sky.url);
}

/** Two static quads; no new texture, timer or render target per fade. */
export class RotatingSky {
  private readonly base: Phaser.GameObjects.Image;
  private readonly overlay: Phaser.GameObjects.Image;
  private baseIndex = 0;
  private overlayIndex = 0;

  constructor(scene: Phaser.Scene) {
    const makeLayer = (depth: number) => scene.add.image(640, 360, SKY_TEXTURES[0].key)
      .setDisplaySize(1328, 768).setDepth(depth).setTint(0xa6b6cd);
    this.base = makeLayer(-5);
    this.overlay = makeLayer(-4).setAlpha(0).setVisible(false);
  }

  render(clock: number, reducedMotion: boolean): void {
    const frame = skyFrameAt(clock, reducedMotion);
    if (frame.baseIndex !== this.baseIndex) {
      this.baseIndex = frame.baseIndex;
      this.base.setTexture(SKY_TEXTURES[this.baseIndex].key);
    }
    if (frame.overlayIndex !== this.overlayIndex) {
      this.overlayIndex = frame.overlayIndex;
      this.overlay.setTexture(SKY_TEXTURES[this.overlayIndex].key);
    }
    this.overlay.setAlpha(frame.overlayAlpha).setVisible(frame.overlayAlpha > 0);
  }
}
