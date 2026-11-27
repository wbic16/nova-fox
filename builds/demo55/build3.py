#!/usr/bin/env python3
"""Assemble demo22/index.html — the self-contained playable build.

Narration (demo22): the build carries JOY's recorded voice — the
final script (NARRATION.md, Will's review 2026-11-26) read by
Voice 1 — embedded base64 as NARRATION_AUDIO (beat ID -> data URI)
with NARRATION_MANIFEST parsed from the set's MANIFEST.md, so the
single file still opens from file:// with no network. The Joy set
lives in the repo at audio/narration-audio-joy/; its files are
named in lowercase (n-01.mp3, beat-arrival.mp3) and N-03 exists in
both control-scheme variants (n-03-wasd.mp3 / n-03-awef.mp3), so
filenames are mapped to beat IDs below. The ten banter takes ride
in the set CARRIED BUT UNHOOKED: demo17's per-line audio hook is
not in this lineage, so they are not embedded. (~2.5 MB of MP3 ->
~3.3 MB embedded.)
"""
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

# demo30: --lite emits, in the same run, the Full artifact (index.html,
# exactly the construction below) AND lite.html + assets/<EE>/ — the
# nimble core with media as raw files (see ASSET-LOADING-EVALUATION.md).
LITE = "--lite" in sys.argv

HERE = Path(__file__).resolve().parent
# Repo layout: this tree is builds/demo22, the audio sets live at
# the repo root under audio/, the film under media/.
AUDIO_DIR = HERE.parent.parent / "audio" / "narration-audio-joy"


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
solver = re.sub(r"^export ", "", read("solver.js"), flags=re.M)
speedrun = re.sub(r"^export ", "", read("speedrun.js"), flags=re.M)
banter = re.sub(r"^export ", "", read("banter.js"), flags=re.M)
scheme = re.sub(r"^export ", "", read("scheme.js"), flags=re.M)

# Narration audio: embed every script beat, keyed by beat ID.
# Joy filenames -> beat IDs: n-01.mp3 -> N-01, n-03-wasd.mp3 ->
# N-03-WASD, beat-arrival.mp3 -> BEAT-arrival. Anything else in the
# set (the banter takes) is carried in the repo set but NOT hooked
# into this build — demo17's audio hook is not in this lineage.
def beat_id_for(stem):
    if stem.startswith("n-"):
        return "N-" + stem[2:].upper()
    if stem.startswith("beat-"):
        return "BEAT-" + stem[5:]
    if stem.startswith("banter-"):
        # Joy's banter takes attach to demo17's line IDs (JOY-001..):
        # the audio hook merged in the everything ship (EE 985+).
        return "JOY-" + stem[7:].zfill(3)
    return None


EXPECTED_BEATS = [
    "N-01", "N-02", "N-03-WASD", "N-03-AWEF", "N-04", "N-05", "N-06",
    "N-07", "N-08", "N-09",
    "BEAT-arrival", "BEAT-cross-ashfall", "BEAT-cross-nova",
    "BEAT-pocket", "BEAT-stay", "BEAT-flip-up", "BEAT-flip-down",
    "BEAT-border-up", "BEAT-barrow", "BEAT-quest",
    "BEAT-guardian-contact", "BEAT-strike-kill", "BEAT-guardian-kill",
    "BEAT-death", "BEAT-fall",
]
audio = {}
raw = {}
manifest = {}
carried = []
if AUDIO_DIR.is_dir():
    man = (AUDIO_DIR / "MANIFEST.md").read_text(encoding="utf-8")
    for row in re.finditer(r"\| (BEAT-[\w-]+|N-\d+(?:-WASD|-AWEF)?) \| ([\w.-]+\.mp3) \| ([\d.]+) s \|", man):
        manifest[row.group(1)] = {"file": row.group(2), "seconds": float(row.group(3))}
    for mp3 in sorted(AUDIO_DIR.glob("*.mp3")):
        beat = beat_id_for(mp3.stem)
        if beat is None:
            carried.append(mp3.name)  # unrecognized stem: carried, unhooked
            continue
        data = mp3.read_bytes()
        audio[beat] = "data:audio/mpeg;base64," + base64.b64encode(data).decode()
        raw[beat] = {"file": mp3.name, "bytes": len(data),
                     "sha256": hashlib.sha256(data).hexdigest()}
    missing = [b for b in manifest if b not in audio]
    assert not missing, f"manifest beats without audio files: {missing}"
    assert sorted(k for k in audio if not k.startswith("JOY-")) == sorted(EXPECTED_BEATS), \
        f"embedded beats differ from the script's 25: {sorted(audio)}"
narration_js = (
    "const NARRATION_AUDIO = " + json.dumps(audio) + ";\n"
    "const NARRATION_MANIFEST = " + json.dumps(manifest) + ";\n"
)
# The ship EE: from the stamp token in game3.js, overridable at ship
# time via NF_EE. The same value stamps both artifacts and names the
# Lite asset directory, so a Lite can only ever request its own EE's
# assets — skew is structurally impossible.
_game3 = read("game3.js")
_m = re.search(r"NF_SHIP_EE:(\d+)", _game3)
EE = os.environ.get("NF_EE") or (_m.group(1) if _m else "0")


def strip_full_line_comments(src):
    """Remove lines that are solely a // comment (leading whitespace
    allowed). Every other byte is preserved. The tokenizer tracks
    line/block comments, single/double strings, template literals
    with ${ } nesting, and regex literals, so a // inside any of
    them is never mistaken for a comment line. The program is
    unchanged; only its commentary is left at home — the Lite
    distribution's answer to the 1.9 MB hard cap (EE 1034)."""
    out = []
    i, n = 0, len(src)
    state = "code"   # code | line | block | sq | dq | tpl | regex
    tpl_stack = []   # brace depths of open ${ } interpolations
    regex_class = False
    prev_sig = ""    # last significant code char (regex heuristic)
    line_start = True  # only whitespace since the last newline
    drop_line = False  # the current // comment is a full-line one
    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ""
        if state == "code":
            if c == "/" and nxt == "/":
                drop_line = line_start
                state = "line"
                if not drop_line:
                    out.append(c); out.append(nxt)
                i += 2
                continue
            if c == "/" and nxt == "*":
                state = "block"; out.append(c); out.append(nxt); i += 2
                line_start = False; continue
            if c == "'":
                state = "sq"; out.append(c); i += 1; line_start = False; continue
            if c == '"':
                state = "dq"; out.append(c); i += 1; line_start = False; continue
            if c == "`":
                state = "tpl"; out.append(c); i += 1; line_start = False; continue
            if c == "/" and (prev_sig == "" or prev_sig in "(,=:[!&|?{};+-*%~^"):
                state = "regex"; regex_class = False
                out.append(c); i += 1; line_start = False; continue
            if tpl_stack and c == "{":
                tpl_stack[-1] += 1
            elif tpl_stack and c == "}":
                if tpl_stack[-1] == 0:
                    tpl_stack.pop(); state = "tpl"
                    out.append(c); i += 1; line_start = False; continue
                tpl_stack[-1] -= 1
            out.append(c)
            if c == "\n":
                line_start = True
            elif c not in " \t\r":
                line_start = False
                prev_sig = c
            i += 1
            continue
        if state == "line":
            if c == "\n":
                state = "code"
                out.append(c); line_start = True; i += 1; continue
            if not drop_line:
                out.append(c)
            i += 1
            continue
        if state == "block":
            out.append(c)
            if c == "*" and nxt == "/":
                out.append(nxt); i += 2; state = "code"; line_start = False; continue
            if c == "\n":
                line_start = True
            elif c not in " \t\r":
                line_start = False
            i += 1
            continue
        if state in ("sq", "dq"):
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(src[i + 1]); i += 2; continue
            if (state == "sq" and c == "'") or (state == "dq" and c == '"'):
                state = "code"; prev_sig = c
            i += 1
            continue
        if state == "tpl":
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(src[i + 1]); i += 2; continue
            if c == "`":
                state = "code"; prev_sig = "`"
            elif c == "$" and nxt == "{":
                out.append(nxt); i += 2; tpl_stack.append(0); state = "code"; continue
            i += 1
            continue
        if state == "regex":
            if c == "\n":  # a regex cannot span lines: we misread a division
                state = "code"; line_start = True; out.append(c); i += 1; continue
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(src[i + 1]); i += 2; continue
            if c == "[":
                regex_class = True
            elif c == "]":
                regex_class = False
            elif c == "/" and not regex_class:
                state = "code"; prev_sig = "/"
            i += 1
            continue
    return "".join(out)

lite_js = None
if LITE:
    lite_files = dict(raw)
    lite_js = (
        "const NARRATION_AUDIO = {};\n"
        "const NARRATION_MANIFEST = " + json.dumps(manifest) + ";\n"
        "const NF_LITE = " + json.dumps(
            {"ee": EE, "base": f"assets/{EE}/", "files": lite_files}) + ";\n"
    )
    print(f"lite: {len(lite_files)} voice files as raw assets under assets/{EE}/")

print(f"narration: {len(audio)} beats embedded, {len(manifest)} in manifest, "
      f"{sum(1 for k in audio if k.startswith('JOY-'))} banter takes hooked as JOY-###, "
      f"{len(carried)} unrecognized carried unhooked: {carried}")

# The intro film (feedback #14): the phext intro, played in-world
# through the memory screen at Arrival. The asset of record is the
# intro prepass (downloads.phext pin, sha256 e831f544…); the web
# copy here was reassembled from the prepass's own frames, kept in
# ../video/ (360 frames, 24 fps, 854x480, ~1 MB). Embedded like the
# narration so the single-file build and its one-step install hold.
VIDEO_DIR = HERE.parent.parent / "media" / "video"
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
    "// ===== the solver: contribute cycles, earn credits (source: solver.js) =====",
    solver,
    "// ===== player forms: the phext a fox wears (source: forms.js) =====",
    re.sub(r"^export ", "", read("forms.js"), flags=re.M),
    "// ===== speedrun mode: the run, its recording, its stream (source: speedrun.js) =====",
    speedrun,
    "// ===== Joy's banter: the hundred lines + trigger engine (source: banter.js) =====",
    banter,
    "// ===== control schemes: preference, flip, N-03 variants (source: scheme.js) =====",
    scheme,
    "// ===== player ideas: the telling door's chart lines (source: ideas.js) =====",
    re.sub(r"^export ", "", read("ideas.js"), flags=re.M),
    "// ===== game (source: game3.js) =====",
    read("game3.js"),
]
module = "\n".join(parts)
assert "</script" not in module.lower(), "module contains </script"
(HERE / "_built_module3.mjs").write_text(module, encoding="utf-8")

def stamp(text):
    return re.sub(r"NF_SHIP_EE:\d+", f"NF_SHIP_EE:{EE}", text)


page = read("page3.html")
assert "/*__BUILT_MODULE__*/" in page
page = page.replace("/*__BUILT_MODULE__*/", module)
(HERE / "index.html").write_text(stamp(page), encoding="utf-8")
print(f"index.html (Full): {len(page)} bytes (module {len(module)} bytes)")

if LITE:
    lite_intro = (
        f'window.__INTRO_VIDEO = "assets/{EE}/phext-intro.mp4";\n'
        f'window.__INTRO_POSTER = "assets/{EE}/phext-intro-poster.png";\n'
    )
    lite_module = module.replace(narration_js, lite_js).replace(intro_js, lite_intro)
    assert lite_module != module and "NF_LITE" in lite_module
    # EE 1034: the Lite copy leaves its full-line // commentary at
    # home (see strip_full_line_comments). Fail closed: the stripped
    # module must still parse as a module, or there is no Lite.
    _pre_strip = len(lite_module)
    lite_module = strip_full_line_comments(lite_module)
    _tmp = HERE / ".lite-module-check.mjs"
    _tmp.write_text(lite_module, encoding="utf-8")
    _chk = subprocess.run(["node", "--check", str(_tmp)],
                          capture_output=True, text=True)
    _tmp.unlink()
    assert _chk.returncode == 0, f"lite module fails node --check after comment strip:\n{_chk.stderr[:800]}"
    print(f"lite: comment strip freed {_pre_strip - len(lite_module)} bytes")
    lite_page = stamp(page.replace(module, lite_module))
    (HERE / "lite.html").write_text(lite_page, encoding="utf-8")
    print(f"lite.html (Lite): {len(lite_page)} bytes (module {len(lite_module)} bytes)")
    assert len(lite_page) <= 1_900_000, f"Lite over the 1.9 MB hard cap: {len(lite_page)}"

    # The asset directory: the same raw files Full embeds, plus the
    # film and poster, with a sha256 manifest (name -> bytes/sha256).
    adir = HERE / "assets" / EE
    adir.mkdir(parents=True, exist_ok=True)
    man_files = {}
    for beat, info in sorted(raw.items()):
        src = AUDIO_DIR / info["file"]
        shutil.copyfile(src, adir / info["file"])
        man_files[info["file"]] = {"bytes": info["bytes"], "sha256": info["sha256"]}
    for extra in (_mp4, _poster):
        if extra.exists():
            data = extra.read_bytes()
            shutil.copyfile(extra, adir / extra.name)
            man_files[extra.name] = {"bytes": len(data),
                                     "sha256": hashlib.sha256(data).hexdigest()}
    man_doc = {"ee": EE, "files": man_files}
    (adir / "manifest.json").write_text(json.dumps(man_doc, indent=1) + "\n", encoding="utf-8")
    print(f"assets/{EE}/: {len(man_files)} files + manifest.json")
