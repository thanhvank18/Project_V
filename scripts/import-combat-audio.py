"""Build the selected Helton Yan combat cues (Python 3 + NumPy).

Run from any directory. Sources stay untouched; only listed runtime WAVs and
their provenance manifests are written. BGM and the original audio importer
remain independent. Selection is based on supplied cue names, not listening.
"""
from pathlib import Path
import hashlib
import json
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Sound" / "Helton Yan's Pixel Combat - Single Files"
RATE = 48000

# cue, stem, variants, gain, maximum tail in seconds
SELECTIONS = [
    ("attack-sword", "DSGNMisc_MELEE-Sword Slash", [1, 2], .23, .65),
    ("attack-sword", "DSGNMisc_MELEE-Bit Sword", [1, 2], .22, .65),
    ("attack-axe", "DSGNImpt_MELEE-Homerunner", [1, 2], .26, .75),
    ("attack-arrow", "DSGNMisc_PROJECTILE-High Whoosh", [1, 2, 3], .23, .45),
    ("attack-magic", "DSGNMisc_PROJECTILE-Water Bolt", [1, 2, 3], .19, .70),
    ("guard", "DSGNMisc_MELEE-Sword Parry", [1, 2], .35, .90),
    ("guard", "DSGNMisc_MELEE-Sword Deflect", [1, 2], .35, .90),
    ("heal", "MAGAngl_BUFF-Simple Heal", [1], .34, 2.50),
    ("heal", "MAGAngl_BUFF-Healing Gusts", [1], .30, 2.50),
    ("frost", "DSGNMisc_SKILL IMPACT-Glassy Sprites", [1, 2], .32, 1.40),
    ("volley", "DSGNMisc_SKILL RELEASE-Thousand Needles", [1, 2], .30, 1.20),
    ("player-hurt", "FGHTImpt_HIT-Smack", [1, 2], .42, .65),
    ("player-hurt", "FGHTImpt_HIT-Strong Smack", [1, 2], .40, .65),
    ("boss-slam", "DSGNImpt_EXPLOSION-Bass Hit", [1, 2], .46, 1.60),
    ("boss-slam", "DSGNImpt_EXPLOSION-Thud", [1, 2], .42, 1.60),
    ("jam", "UIMisc_INTERFACE-Denied", [1, 2], .25, .65),
]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_pcm24(path):
    with wave.open(str(path), "rb") as wav:
        if (wav.getsampwidth(), wav.getnchannels(), wav.getframerate()) != (3, 2, 96000):
            raise ValueError(f"Unexpected source PCM format: {path.name}")
        data = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.uint8).reshape(-1, 3)
    packed = (data[:, 0].astype(np.int32) | (data[:, 1].astype(np.int32) << 8)
              | (data[:, 2].astype(np.int32) << 16))
    signed = (packed ^ 0x800000) - 0x800000
    return signed.reshape(-1, 2).astype(np.float64) / 8388608


def prepare(samples, maximum):
    # Preserve the short initial attack, omit source silence and long padding.
    active = np.flatnonzero(np.max(np.abs(samples), axis=1) > 10 ** (-50 / 20))
    if not len(active):
        raise ValueError("Silent source")
    start = max(0, int(active[0]) - 960)  # 10 ms pre-roll
    end = min(len(samples), int(active[-1]) + 1 + 2880, start + round(maximum * 96000))
    mono = samples[start:end].mean(axis=1)
    # 255-tap windowed-sinc anti-alias filter before 2:1 decimation. Its 22.08kHz
    # cutoff preserves combat transients while suppressing >24kHz source content.
    axis = np.arange(255) - 127
    fir = .46 * np.sinc(.46 * axis) * np.kaiser(255, 8.6)
    fir /= fir.sum()
    audio = np.convolve(mono, fir, mode="same")[::2]
    peak = float(np.max(np.abs(audio)))
    audio *= min(1, 10 ** (-3 / 20) / max(peak, 1e-12))
    fade_in = min(48, len(audio))
    fade_out = min(1440, len(audio))
    audio[:fade_in] *= np.linspace(0, 1, fade_in)
    audio[-fade_out:] *= np.linspace(1, 0, fade_out)
    pcm = np.rint(audio * 32767).astype("<i2")
    return pcm, start / 96000, end / 96000


def build():
    target = ROOT / "public" / "audio" / "combat"
    target.mkdir(parents=True, exist_ok=True)
    sfx, sources = {}, []
    for cue, stem, variants, gain, maximum in SELECTIONS:
        for variant in variants:
            path = SOURCE / f"{stem}_HY_PC-{variant:03}.wav"
            pcm, start, end = prepare(read_pcm24(path), maximum)
            name = f"{cue}-{len(sfx.get(cue, [])) + 1:02}.wav"
            output = target / name
            with wave.open(str(output), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(RATE)
                wav.writeframes(pcm.tobytes())
            sample = {"url": f"/audio/combat/{name}", "volume": gain,
                      "duration": round(len(pcm) / RATE, 6)}
            sfx.setdefault(cue, []).append(sample)
            sources.append({"cue": cue, "localFile": path.relative_to(ROOT).as_posix(),
                            "sourceSha256": sha256(path), "sourceBytes": path.stat().st_size,
                            "trimStart": round(start, 6), "trimEnd": round(end, 6),
                            **sample, "sha256": sha256(output), "bytes": output.stat().st_size})
    # Reuse the two short Smacks quietly for hits on monsters; no extra download.
    sfx["impact"] = [{**sample, "volume": .14} for sample in sfx["player-hurt"][:2]]
    catalog = {"sfx": sfx}
    manifest = {
        "version": 1, "sourceDirectory": SOURCE.relative_to(ROOT).as_posix(),
        "selection": "Accepted combat categories only; supplied names and PCM inspection, no auditory review.",
        "processing": "96kHz stereo PCM24 to 48kHz mono PCM16; 255-tap anti-alias FIR; silence trim; bounded tails; 1ms/30ms fades; peak ceiling -3dBFS.",
        "music": "Existing six-track playlist unchanged.",
        "sourceCount": len(sources), "bytes": sum(item["bytes"] for item in sources),
        **catalog, "sources": sources,
    }
    for path, content in [(ROOT / "src/game/combatAudioCatalog.generated.json", catalog),
                          (ROOT / "public/audio/combat-manifest.json", manifest)]:
        path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"samples": len(sources), "bytes": manifest["bytes"],
                      "cues": list(sfx)}, ensure_ascii=False))


if __name__ == "__main__":
    build()
