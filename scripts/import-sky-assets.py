"""Prepare the supplied CraftPix skies and a separate city foreground.

Run with Python + Pillow from the repository root. Source packs stay in sky/;
only the eight runtime PNGs, foreground and provenance manifest are shipped.
"""
from pathlib import Path
from collections import deque
import hashlib
import json

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/art/sky"
SELECTION = [
    ("ember-clouds", 2, 2),
    ("violet-dusk", 4, 2),
    ("midnight", 1, 1),
    ("moonlit-clouds", 1, 3),
    ("soft-dawn", 4, 1),
    ("day-clouds", 2, 1),
    ("blue-sky", 3, 3),
    ("overcast", 4, 3),
]

# Hand-reviewed skyline matte in the ORIGINAL 1672 x 941 city coordinates.
# The skyline is pixel-stepped deliberately: no feathering or rectangular crop
# across buildings. City pixels and the full road below this contour are retained.
# Keeping the coordinates here makes the derived foreground reproducible.
SKYLINE = [
    (0, 170), (10, 170), (10, 159), (27, 159), (27, 174), (39, 174),
    (39, 181), (69, 181), (69, 200), (112, 200), (112, 181), (154, 181),
    (154, 194), (160, 194), (160, 181), (202, 181), (202, 215), (209, 215),
    (209, 238), (221, 238), (221, 244), (237, 244), (237, 119), (289, 119),
    (289, 100), (302, 100), (302, 114), (314, 114), (314, 128), (327, 128),
    (327, 136), (337, 136), (337, 145), (344, 145), (344, 251), (355, 251),
    (355, 230), (372, 230), (372, 246), (378, 246), (378, 194), (400, 194),
    (400, 183), (424, 183), (424, 174), (438, 174), (438, 182), (471, 182),
    (471, 280), (488, 280), (488, 239), (499, 239), (499, 187), (506, 187),
    (506, 231), (519, 231), (519, 236), (553, 236), (553, 225), (559, 225),
    (559, 236), (607, 236), (607, 216), (615, 216), (615, 238), (624, 238),
    (624, 301), (633, 301), (633, 296), (640, 296), (640, 284), (664, 284),
    (664, 279), (672, 279), (672, 282), (688, 282), (688, 319), (700, 319),
    (700, 307), (709, 307), (709, 255), (722, 255), (722, 245), (730, 245),
    (730, 239), (738, 239), (738, 246), (753, 246), (753, 254), (764, 254),
    (764, 288), (777, 288), (777, 280), (786, 280), (786, 207), (795, 207),
    (795, 199), (808, 199), (808, 205), (817, 205), (817, 198), (828, 198),
    (828, 213), (845, 213), (845, 219), (873, 219), (873, 226), (899, 226),
    (899, 303), (909, 303), (909, 311), (919, 311), (919, 289), (931, 289),
    (931, 278), (941, 278), (941, 290), (953, 290), (953, 314), (963, 314),
    (963, 304), (978, 304), (978, 314), (995, 314), (995, 285), (1007, 285),
    (1007, 277), (1018, 277), (1018, 279), (1047, 279), (1047, 332),
    (1057, 332), (1057, 318), (1074, 318), (1074, 315), (1097, 315),
    (1097, 339), (1113, 339), (1113, 343), (1130, 343), (1130, 332),
    (1155, 332), (1155, 315), (1175, 315), (1175, 286), (1191, 286),
    (1191, 280), (1204, 280), (1204, 286), (1217, 286), (1217, 278),
    (1224, 278), (1224, 284), (1238, 284), (1238, 279), (1246, 279),
    (1246, 286), (1267, 286), (1267, 254), (1274, 254), (1274, 282),
    (1280, 282), (1280, 303), (1295, 303), (1295, 205), (1306, 205),
    (1306, 190), (1322, 190), (1322, 151), (1338, 151), (1338, 142),
    (1345, 142), (1345, 151), (1374, 151), (1374, 173), (1392, 173),
    (1392, 153), (1398, 153), (1398, 172), (1416, 172), (1416, 197),
    (1429, 197), (1429, 248), (1441, 248), (1441, 237), (1454, 237),
    (1454, 225), (1465, 225), (1465, 243), (1472, 243), (1472, 211),
    (1490, 211), (1490, 194), (1508, 194), (1508, 181), (1512, 181),
    (1512, 170), (1525, 170), (1525, 181), (1520, 181), (1520, 194),
    (1538, 194), (1538, 186), (1549, 186), (1549, 204), (1558, 204),
    (1558, 190), (1583, 190), (1583, 167), (1597, 167), (1597, 157),
    (1612, 157), (1612, 166), (1620, 166), (1620, 186), (1642, 186),
    (1642, 135), (1672, 135),
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    skies = []
    for name, part, number in SELECTION:
        source = ROOT / f"sky/New free backgrounds part{part}/background {number}/orig.png"
        image = Image.open(source).convert("RGB")
        assert image.size == (576, 324), f"Unexpected sky dimensions: {source}"
        destination = OUTPUT / f"{name}.png"
        image.save(destination, optimize=True)
        skies.append({
            "id": name, "key": f"sky-{name}", "url": f"/art/sky/{name}.png",
            "width": image.width, "height": image.height,
            "source": source.relative_to(ROOT).as_posix(), "sourceSha256": digest(source),
            "bytes": destination.stat().st_size,
        })

    source = ROOT / "public/art/background.png"
    foreground = Image.open(source).convert("RGBA")
    assert foreground.size == (1672, 941), "Review the skyline matte if the original city changes"
    mask = Image.new("L", foreground.size, 255)
    ImageDraw.Draw(mask).polygon([(0, 0), (1672, 0), *reversed(SKYLINE)], fill=0)
    # Snap the reviewed contour to the source's cyan building pixels inside a
    # narrow band. This removes warm sunset fringes without feathered halos.
    pixels = foreground.load()
    alpha = mask.load()
    for px in range(foreground.width):
        boundary = next((py for py in range(380) if alpha[px, py]), 380)
        low, high = max(0, boundary - 7), min(380, boundary + 12)
        for py in range(low, high):
            samples = [pixels[px, py + delta] for delta in range(3)]
            if all(green > red + 9 and blue > green for red, green, blue, _ in samples):
                for cut in range(low, high):
                    alpha[px, cut] = 0 if cut < py else 255
                break
        for py in range(low, min(380, boundary + 18)):
            red, green, blue, _ = pixels[px, py]
            if red > green * 1.04 and red > 65:
                alpha[px, py] = 0
    # Follow connected warm sky around stepped roof edges; isolated lit windows
    # and street lamps remain opaque. This also clears the narrow building gaps.
    warm = set()
    for py in range(380):
        for px in range(foreground.width):
            red, green, blue, _ = pixels[px, py]
            if red > green * 1.04 and red > 65:
                warm.add((px, py))
    queue = deque(point for point in warm if alpha[point] == 0)
    for point in queue:
        warm.remove(point)
    while queue:
        px, py = queue.popleft()
        for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
            adjacent = (px + dx, py + dy)
            if adjacent in warm:
                warm.remove(adjacent)
                alpha[adjacent] = 0
                queue.append(adjacent)
    # Open windows in the distant ruined towers reveal the old orange sky.
    # Preserve every foreground window/lamp by limiting these holes to towers.
    for x, y, width, height in [(553, 254, 65, 29), (551, 293, 67, 23), (789, 233, 104, 65), (1293, 205, 39, 89)]:
        for py in range(y, y + height):
            for px in range(x, x + width):
                red, green, blue, _ = pixels[px, py]
                if red > green * 1.12 and red > 110:
                    alpha[px, py] = 0
    foreground.putalpha(mask)
    foreground.save(OUTPUT / "city-foreground.png", optimize=True)
    manifest = {
        "source": "User-provided CraftPix New free backgrounds packs",
        "license": "https://craftpix.net/file-licenses/",
        "licenseSection": "2. FREEBIE PRODUCTS",
        "intervalMs": 20000, "transitionMs": 1800, "skies": skies,
        "foreground": {
            "url": "/art/sky/city-foreground.png", "source": "public/art/background.png",
            "sourceSha256": digest(source), "width": 1672, "height": 941,
        },
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (ROOT / "src/game/skyCatalog.generated.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "LICENSE.txt").write_text(
        "Sky artwork: CraftPix.net, supplied by the project owner.\n"
        "Original pack license files link to https://craftpix.net/file-licenses/\n"
        "Section 2: FREEBIE PRODUCTS. Assets are included as part of this game.\n"
        "No standalone asset redistribution or artwork export is provided.\n"
        "Selected source paths and hashes: manifest.json.\n", encoding="utf-8")
    print(f"Prepared {len(skies)} sky textures ({sum(item['bytes'] for item in skies):,} bytes) and city foreground.")


if __name__ == "__main__":
    main()
