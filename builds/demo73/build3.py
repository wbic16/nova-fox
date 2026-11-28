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

# The ship log (W-5): SHIPLOG.md is the source of record for the
# start screen's "Recent builds" panel — parsed fail-closed like
# the narration manifest above, and baked in as the SHIP_LOG block,
# so the log players see is the log that shipped them. The top row
# is the build being made: its EE reads "this" in the source and
# bakes as 0; the running game letters that row with its own stamp.
_ship_rows = []
for _row in re.finditer(r"\| (this|\d+) \| ([^|]+?) \| ([^|]+?) \|",
                        read("SHIPLOG.md")):
    _ship_rows.append({
        "ee": 0 if _row.group(1) == "this" else int(_row.group(1)),
        "name": _row.group(2).strip(),
        "note": _row.group(3).strip(),
    })
assert _ship_rows and _ship_rows[0]["ee"] == 0, \
    "SHIPLOG.md: the first row must be the build being made (EE 'this')"
assert all(a["ee"] > b["ee"] for a, b in
           zip(_ship_rows[1:], _ship_rows[2:])), \
    "SHIPLOG.md: ship epochs must descend, newest first"
shiplog_js = "const SHIP_LOG = " + json.dumps(_ship_rows) + ";\n"
print(f"ship log: {len(_ship_rows)} rows baked from SHIPLOG.md")
# The ship EE: from the stamp token in game3.js, overridable at ship
# time via NF_EE. The same value stamps both artifacts and names the
# Lite asset directory, so a Lite can only ever request its own EE's
# assets — skew is structurally impossible.
_game3 = read("game3.js")
_m = re.search(r"NF_SHIP_EE:(\d+)", _game3)
EE = os.environ.get("NF_EE") or (_m.group(1) if _m else "0")

# MW-1 (EE 1323 design section 1.4): the 12 re-tuned realm/state
# loops ship as OGG files under assets/<EE>/music/ with a sha256
# manifest, NOT embedded in the single file (the set would roughly
# double it). The source set lives at the repo root under
# audio/music/ (the narration sets' own neighbourhood). The baked
# MW-3 port addition: each entry also carries tempoBpm/loopSeconds
# (from the set's MANIFEST.md of record, ~/nova-fox-music) so
# music.barGrid() can read the playing track's grid from
# MUSIC_MANIFEST track data.
# MUSIC_MANIFEST const is the game's asset surface: base path, and
# per-track id / scope / bytes / sha256. A missing source set bakes
# a null manifest and the game stays silent — never a degraded or
# partial music set presented as the real thing.
MUSIC_DIR = HERE.parent.parent / "audio" / "music"
MUSIC_TRACKS = [
    ("01-nova-prime.ogg", "01-nova-prime", "realm:nova", 79, 48.6),
    ("02-ashfall-haven.ogg", "02-ashfall-haven", "realm:ashfall", 97, 49.5),
    ("03-ni-knight.ogg", "03-ni-knight", "realm:ni-knight", 85, 45.2),
    ("04-logos-prime.ogg", "04-logos-prime", "realm:logos", 82, 46.8),
    ("05-elven-path.ogg", "05-elven-path", "realm:elven", 76, 50.5),
    ("06-orchid-flow.ogg", "06-orchid-flow", "realm:orchid", 67, 43.0),
    ("07-halycon-vector.ogg", "07-halycon-vector", "realm:halycon", 64, 60.0),
    ("08-delta-wood.ogg", "08-delta-wood", "realm:delta", 76, 63.2),
    ("09-best-willow.ogg", "09-best-willow", "realm:willow", 82, 58.5),
    ("10-plain-view.ogg", "10-plain-view", "realm:plain", 62, 46.5),
    ("11-monster-fight.ogg", "11-monster-fight", "state:fight", 92, 52.2),
    ("12-rift-traversal.ogg", "12-rift-traversal", "state:transit", 60, 32.0),
]
music_files = {}
music_manifest = None
if MUSIC_DIR.is_dir():
    _mdir = HERE / "assets" / EE / "music"
    _mdir.mkdir(parents=True, exist_ok=True)
    _entries = []
    for _fname, _tid, _scope, _tempo, _loop in MUSIC_TRACKS:
        _data = (MUSIC_DIR / _fname).read_bytes()
        _sha = hashlib.sha256(_data).hexdigest()
        shutil.copyfile(MUSIC_DIR / _fname, _mdir / _fname)
        _entries.append({"file": _fname, "id": _tid, "scope": _scope,
                         "tempoBpm": _tempo, "loopSeconds": _loop,
                         "bytes": len(_data), "sha256": _sha})
        music_files[_fname] = {"bytes": len(_data), "sha256": _sha}
    music_manifest = {"ee": EE, "base": f"assets/{EE}/music/",
                      "totalBytes": sum(e["bytes"] for e in _entries),
                      "tracks": _entries}
    (_mdir / "manifest.json").write_text(
        json.dumps(music_manifest, indent=1) + "\n", encoding="utf-8")
    print(f"music: {len(_entries)} loops -> assets/{EE}/music/ "
          f"({music_manifest['totalBytes']} bytes, sha256 manifest)")
else:
    print("music: SOURCE SET MISSING at audio/music/ - "
          "MUSIC_MANIFEST bakes null, the realms stay silent")
music_js = "const MUSIC_MANIFEST = " + json.dumps(music_manifest) + ";\n"

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

# The intro film (feedback #14) is DROPPED: video dropped per
# Play 1, EE1232 — Will dropped the video hyperlink and the movie
# screen is the status board, so no surface in the build can play
# this film. The embed is gated off cleanly here: intro_js stays
# at its null assignment, so NOVA_FOX3.introVideoReady() (which
# reads !!window.__INTRO_VIDEO) is false in the built game. The
# media file media/video/phext-intro.mp4 STAYS in the repo tree
# untouched; only the embed stops. (_mp4/_poster are still named
# for the Lite raw-asset copy below, which is not an embed.)
VIDEO_DIR = HERE.parent.parent / "media" / "video"
intro_js = "window.__INTRO_VIDEO = null;\nwindow.__INTRO_POSTER = null;\n"
_mp4 = VIDEO_DIR / "phext-intro.mp4"
_poster = VIDEO_DIR / "phext-intro-poster.png"
print("intro film: NOT EMBEDDED — video dropped per Play 1, EE1232")

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
    "// ===== collectibles: the Homecoming chart logic (source: collectibles.js) =====",
    re.sub(r"^export ", "", read("collectibles.js"), flags=re.M),
    "// ===== the gravity dial: Morse, magnitude, frequency (source: gdial.js) =====",
    re.sub(r"^export ", "", read("gdial.js"), flags=re.M),
    "// ===== the feedback door: to the wiki, with the stamp (source: feedback.js) =====",
    re.sub(r"^export ", "", read("feedback.js"), flags=re.M),
    "// ===== the ship log: recent builds, as shipped (data: SHIPLOG.md baked; helpers: shiplog.js) =====",
    shiplog_js + re.sub(r"^export ", "", read("shiplog.js"), flags=re.M),
    "// ===== multiplayer presence: echolocation, strength in numbers, the healing pulse (source: mp.js) =====",
    re.sub(r"^export ", "", read("mp.js"), flags=re.M),
    "// ===== game (source: game3.js) =====",
    music_js + read("game3.js"),
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
    # Video dropped per Play 1, EE1232: Lite carries the same null
    # intro assignment as Full — no asset-path film reference, so
    # introVideoReady() is false in the Lite module too.
    lite_intro = intro_js
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
    # ---- T-3 (EE 1130, Will): Lite is a loader + a .phext.gz ----
    # The monolithic lite.html is retired. The Lite module survives
    # whole: it is carried as scrolls of one phext (below), and the
    # loader joins the module scrolls with newlines to rebuild the
    # exact bytes stripped and node-checked above. Fail closed on
    # any drift: per-part strips must reassemble into lite_module.
    lite_parts = list(parts)
    lite_parts[lite_parts.index(narration_js)] = lite_js
    lite_parts[lite_parts.index(intro_js)] = lite_intro
    stripped_parts = [strip_full_line_comments(t) for t in lite_parts]
    assert "\n".join(stripped_parts) == lite_module, \
        "per-part strip assembly differs from the whole-module strip"
    PART_NAMES = ["three", "wasm-core", "narration", "intro", "world",
                  "economy", "solver", "forms", "speedrun", "banter",
                  "scheme", "ideas", "gdial", "feedback", "shiplog", "mp", "game"]
    module_coords = []
    module_names = {}
    _ci = 0
    for _i, _t in enumerate(stripped_parts):
        _c = f"1.1.2/1.1.{_i + 1}/1.1.1"
        module_coords.append(_c)
        if _t:
            module_names[_c] = PART_NAMES[_ci]
            _ci += 1
        else:
            module_names[_c] = "join"
    assert _ci == len(PART_NAMES), f"expected {len(PART_NAMES)} content parts, got {_ci}"
    shell_text = stamp(read("page3.html"))
    assert "/*__BUILT_MODULE__*/" in shell_text

    # The asset directory: the same raw files Full embeds, plus the
    # film and poster, with a sha256 manifest (name -> bytes/sha256).
    adir = HERE / "assets" / EE
    adir.mkdir(parents=True, exist_ok=True)
    man_files = {}
    for beat, info in sorted(raw.items()):
        src = AUDIO_DIR / info["file"]
        shutil.copyfile(src, adir / info["file"])
        man_files[info["file"]] = {"bytes": info["bytes"], "sha256": info["sha256"]}
    for _mf, _mi in sorted(music_files.items()):
        man_files[f"music/{_mf}"] = _mi
    for extra in (_mp4, _poster):
        if extra.exists():
            data = extra.read_bytes()
            shutil.copyfile(extra, adir / extra.name)
            man_files[extra.name] = {"bytes": len(data),
                                     "sha256": hashlib.sha256(data).hexdigest()}
    # ---- T-3: assemble the phext, gzip it, emit the loader ----
    import gzip as _gzip
    PHEXT_LEVEL_BYTES = [0x01, 0x1F, 0x1E, 0x1D, 0x1C, 0x1A, 0x19, 0x18, 0x17]

    def _coord_key(c):
        return tuple(int(x) for x in c.replace("/", ".").split("."))

    def phext_implode(scrolls):
        state = [1] * 9
        out = []
        for coord in sorted(scrolls, key=_coord_key):
            target = _coord_key(coord)
            for lvl in range(9):
                while state[lvl] < target[lvl]:
                    out.append(chr(PHEXT_LEVEL_BYTES[lvl]))
                    state[lvl] += 1
                    for j in range(lvl + 1, 9):
                        state[j] = 1
            out.append(scrolls[coord])
        return "".join(out)

    def phext_explode(data):
        levels = {b: i for i, b in enumerate(PHEXT_LEVEL_BYTES)}
        coord = [1] * 9
        scrolls = {}
        start = 0

        def key():
            return (f"{coord[0]}.{coord[1]}.{coord[2]}/{coord[3]}.{coord[4]}.{coord[5]}"
                    f"/{coord[6]}.{coord[7]}.{coord[8]}")
        for i, b in enumerate(data):
            if b in levels:
                scrolls[key()] = data[start:i].decode("utf-8")
                lvl = levels[b]
                coord[lvl] += 1
                for j in range(lvl + 1, 9):
                    coord[j] = 1
                start = i + 1
        scrolls[key()] = data[start:].decode("utf-8")
        return scrolls

    SHELL_COORD = "1.1.1/1.1.2/1.1.1"
    ASSETS_COORD = "1.1.1/1.1.3/1.1.1"
    pkg_map = {"shell": SHELL_COORD, "modules": module_coords,
               "assets": ASSETS_COORD, "moduleNames": module_names}
    scrolls = {}
    for _c, _t in zip(module_coords, stripped_parts):
        scrolls[_c] = stamp(_t)
    scrolls[SHELL_COORD] = shell_text
    scrolls[ASSETS_COORD] = json.dumps({"files": man_files}, indent=1) + "\n"
    scrolls["1.1.1/1.1.1/1.1.1"] = "\n".join([
        "# Nova Fox \u2014 the Lite package",
        "",
        "One phext, gzipped: the whole nimble game, scroll by scroll.",
        "The shell scroll is the game page with its module mark; the",
        "module scrolls, joined with newlines in the map's order, are",
        "the exact module the monolithic Lite carried. The assets",
        "scroll carries the voice/film manifest; those files ride",
        "beside the package, fetched on demand as they always were.",
        "",
        "NF-MAP " + json.dumps(pkg_map),
        "",
    ])
    _stamp_count = sum(t.count("NF_SHIP_EE:") for t in scrolls.values())
    assert _stamp_count == 1, f"package carries NF_SHIP_EE x{_stamp_count}, expected exactly 1"
    phext_bytes = phext_implode(scrolls).encode("utf-8")
    assert phext_explode(phext_bytes) == scrolls, "phext round-trip mismatch"
    gz_bytes = _gzip.compress(phext_bytes, compresslevel=9, mtime=0)
    (adir / "nova-fox.phext").write_bytes(phext_bytes)
    (adir / "nova-fox.phext.gz").write_bytes(gz_bytes)
    phext_sha = hashlib.sha256(phext_bytes).hexdigest()
    man_files["nova-fox.phext"] = {"bytes": len(phext_bytes), "sha256": phext_sha}
    man_files["nova-fox.phext.gz"] = {"bytes": len(gz_bytes),
                                      "sha256": hashlib.sha256(gz_bytes).hexdigest()}
    print(f"package: phext {len(phext_bytes)} B -> gz {len(gz_bytes)} B "
          f"({len(gz_bytes) / len(phext_bytes):.3f}), {len(scrolls)} scrolls")

    loader_cfg = {"ee": EE, "packageUrl": f"assets/{EE}/nova-fox.phext.gz",
                  "packageBytes": len(gz_bytes), "phextBytes": len(phext_bytes),
                  "phextSha256": phext_sha, "scrollCount": len(scrolls),
                  "fullUrl": "index.html"}
    _flavor_m = re.search(r"TRAIL_FLAVOR = \[(.*?)\]", world, re.S)
    flavor = re.findall(r'"([^"]+)"', _flavor_m.group(1)) if _flavor_m else []
    loader = read("loader3.html")
    loader = loader.replace("/*__LOADER_CONFIG__*/", json.dumps(loader_cfg))
    loader = loader.replace("/*__TRAIL_FLAVOR__*/", json.dumps(flavor))
    loader = stamp(loader)
    assert loader.count("NF_SHIP_EE:") == 1, "loader must carry the ship stamp exactly once"
    assert len(loader) < 100_000, f"loader page too big: {len(loader)}"
    (HERE / "lite.html").write_text(loader, encoding="utf-8")
    print(f"lite.html (Lite loader): {len(loader)} bytes")

    man_doc = {"ee": EE, "files": man_files,
               "package": {"phextBytes": len(phext_bytes), "phextSha256": phext_sha,
                           "gzBytes": len(gz_bytes),
                           "ratio": round(len(gz_bytes) / len(phext_bytes), 4),
                           "moduleSha256": hashlib.sha256(lite_module.encode("utf-8")).hexdigest(),
                           "shell": SHELL_COORD, "modules": module_coords,
                           "moduleNames": module_names,
                           "scrolls": {c: {"bytes": len(t.encode("utf-8")),
                                           "sha256": hashlib.sha256(t.encode("utf-8")).hexdigest()}
                                       for c, t in sorted(scrolls.items())}}}
    (adir / "manifest.json").write_text(json.dumps(man_doc, indent=1) + "\n", encoding="utf-8")
    print(f"assets/{EE}/: {len(man_files)} files + manifest.json")
