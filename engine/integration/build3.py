#!/usr/bin/env python3
"""Assemble demo3/index.html — the self-contained playable demo v3.

Same assembly as v2, plus the narration: every MP3 in
../narration-audio/ is embedded base64 as NARRATION_AUDIO (beat ID
-> data URI) with NARRATION_MANIFEST parsed from its MANIFEST.md,
so the single file carries Emise's recorded voice and still opens
from file:// with no network. (~1.5 MB of MP3 -> ~2 MB embedded;
the whole file lands near 3.4 MB, which PLAN.md states plainly.)
"""
import base64
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUDIO_DIR = HERE.parent / "narration-audio"


def read(p):
    return (HERE / p).read_text(encoding="utf-8")


three = read("assets/three.module.js")
m = re.search(r"export\s*\{(.*)\};\s*$", three, re.S)
assert m, "three export block not found"
entries = []
for item in m.group(1).split(","):
    item = item.strip()
    if not item:
        continue
    if " as " in item:
        local, alias = [s.strip() for s in item.split(" as ")]
        entries.append(f"{alias}: {local}")
    else:
        entries.append(item)
three = three[: m.start()] + "const THREE = {\n" + ",\n".join(entries) + "\n};\n"

world = re.sub(r"^export ", "", read("world.js"), flags=re.M)
economy = re.sub(r"^export ", "", read("economy.js"), flags=re.M)

# Narration audio: embed every beat, keyed by beat ID.
audio = {}
manifest = {}
if AUDIO_DIR.is_dir():
    man = (AUDIO_DIR / "MANIFEST.md").read_text(encoding="utf-8")
    for row in re.finditer(r"\| (BEAT-[\w-]+|N-\d+) \| ([\w.-]+\.mp3) \| ([\d.]+) s \|", man):
        manifest[row.group(1)] = {"file": row.group(2), "seconds": float(row.group(3))}
    for mp3 in sorted(AUDIO_DIR.glob("*.mp3")):
        beat = mp3.stem
        audio[beat] = "data:audio/mpeg;base64," + base64.b64encode(mp3.read_bytes()).decode()
    missing = [b for b in manifest if b not in audio]
    assert not missing, f"manifest beats without audio files: {missing}"
narration_js = (
    "const NARRATION_AUDIO = " + json.dumps(audio) + ";\n"
    "const NARRATION_MANIFEST = " + json.dumps(manifest) + ";\n"
)
print(f"narration: {len(audio)} beats embedded, {len(manifest)} in manifest")

# The intro film (feedback #14): the phext intro, played in-world
# through the memory screen at Arrival. The asset of record is the
# intro prepass (downloads.phext pin, sha256 e831f544…); the web
# copy here was reassembled from the prepass's own frames, kept in
# ../video/ (360 frames, 24 fps, 854x480, ~1 MB). Embedded like the
# narration so the single-file build and its one-step install hold.
VIDEO_DIR = HERE.parent / "video"
intro_js = "window.__INTRO_VIDEO = null;\nwindow.__INTRO_POSTER = null;\n"
_mp4 = VIDEO_DIR / "phext-intro.mp4"
_poster = VIDEO_DIR / "phext-intro-poster.png"
if _mp4.exists():
    intro_js = (
        'window.__INTRO_VIDEO = "data:video/mp4;base64,'
        + base64.b64encode(_mp4.read_bytes()).decode() + '";\n'
    )
    if _poster.exists():
        intro_js += (
            'window.__INTRO_POSTER = "data:image/png;base64,'
            + base64.b64encode(_poster.read_bytes()).decode() + '";\n'
        )
    print(f"intro film: {_mp4.stat().st_size} bytes embedded")
else:
    print("intro film: NOT FOUND — the Arrival screen will stand dark")

parts = [
    "// ===== three.js r160 (vendored; export block -> THREE namespace) =====",
    three,
    "// ===== the WASM core (embedded base64) =====",
    read("nova_core_b64.js"),
    "// ===== narration audio (embedded base64, by beat ID) =====",
    narration_js,
    "// ===== the intro film (embedded base64) =====",
    intro_js,
    "// ===== subspace + generator (source: world.js) =====",
    world,
    "// ===== the economy: entitlement, ledgers, faucets (source: economy.js) =====",
    economy,
    "// ===== player forms: the phext a fox wears (source: forms.js) =====",
    re.sub(r"^export ", "", read("forms.js"), flags=re.M),
    "// ===== game (source: game3.js) =====",
    read("game3.js"),
]
module = "\n".join(parts)
assert "</script" not in module.lower(), "module contains </script"
(HERE / "_built_module3.mjs").write_text(module, encoding="utf-8")

page = read("page3.html")
assert "/*__BUILT_MODULE__*/" in page
page = page.replace("/*__BUILT_MODULE__*/", module)
(HERE / "index.html").write_text(page, encoding="utf-8")
print(f"index.html: {len(page)} bytes (module {len(module)} bytes)")
