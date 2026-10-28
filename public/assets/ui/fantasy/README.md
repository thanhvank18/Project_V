# FantasyUI assets

These assets are lossless crops of the user-provided `UI/FantasyUI/FantasyUI/fantasy.png` atlas (1024 × 1560). Original RGBA pixels and transparency are preserved; no recoloring or resampling was applied. `manifest.json` records exact source rectangles for every file. The supplied `__MACOSX` directory is intentionally excluded.

Each PNG also embeds its source path, original atlas dimensions, crop rectangle, and explicit non-generated origin using Impeccable's `embed-prompt` metadata. The local CLI stores this through `--prompt`; the text records provenance, not an AI generation prompt. Its scan confirms all 23 PNGs carry this metadata.

## Rendering

Use `image-rendering: pixelated` for icons and hearts. Use CSS `border-image` or Phaser `NineSlice` for scalable frames, retaining their corners. `nineSlice` in the manifest is a recommended inset, in source pixels, on all four sides. CSS border width is independent of this inset. Keep text padding inside the frame.

| Asset | Size | Slice | Suggested role |
| --- | --- | --- | --- |
| `panel-gold.png` | 76 × 93 | 20 | Main sections, dialogs, compact HUD |
| `panel-wide.png` | 112 × 78 | 20 | Wide HUD or popup |
| `panel-square.png`, `slot-gold.png` | 76 × 78 | 20 | Inventory and portrait slots |
| `panel-red.png`, `slot-selected.png` | 76 × 94 | 20 | Selected portrait or danger state |
| `panel-purple.png` | 76 × 94 | 20 | Magical / alternate selection |
| `panel-ornate.png`, `panel-ornate-purple.png` | 116 × 104 | 28 | Featured panel or result; keep the centered gem's proportions when stretching |
| `button-dark.png` | 92 × 36 | 6 | Plain dark button; contains no text |
| `button-wood.png` | 119 × 35 | 8 | Primary action |
| `button-wood-large.png` | 119 × 51 | 8 | Tall primary action |
| `panel-wood.png` | 68 × 86 | 12 | Wooden board / inset panel |
| `parchment.png` | 144 × 94 | 14 | Reading or creation sheet |
| `heart-full.png`, `heart-half.png`, `heart-empty.png` | 18 × 15 | — | Health icons with consistent bounds |
| `gem-amber.png`, `gem-blue.png`, `gem-green.png`, `gem-red.png`, `gem-purple.png` | 29 × 28 | — | Small decorative / status emblems |
| `leather-tile.png` | 32 × 32 | — | Interior texture crop; subtle repeating backdrop |

Example: `border: 18px solid transparent; border-image: url('/assets/ui/fantasy/panel-gold.png') 20 fill / 18px / 0 stretch;`.

The half heart contains both the filled left half and the empty right half from the original atlas. For continuous health feedback, place `heart-full.png` over `heart-empty.png` and clip its width. This preserves the exact health ratio without changing gameplay values.

## Provenance and license

The user supplied this pack for the project. No license or attribution text was included in the supplied folder, so this import does not assert a new license or public-domain status. Retain the pack's original license when distributing the project. The three `DragonHpBar*.png` files are not needed for this heart-based interface and have not been imported.
