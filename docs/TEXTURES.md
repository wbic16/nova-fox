# Nova Fox — Hand-Drawn Hi-Res Textures (demo3)

Will's direction (main chat, 2026-11-22 21:56 CST, verbatim): *"higher
resolution textures - draw them by hand using Omega Animator"*.
Task 17.5.6/5.5.8/4.5.7. Drawn route: deterministic renderer, Emise
design language (jittered strokes, overshoot kept, hatching in Will's
manner — Will->Emise touched), seed 20261122. Palette v4 LOCKED — no
color changes (see PALETTE-V4.md).

## Scope — from the build, not from assumption

demo3 has exactly **one texture**. Everything else that looks textured
is geometry + flat palette materials and has no texture to draw:

| Surface | What the code actually does | Texture? |
| --- | --- | --- |
| Block faces | `game3.js makeAtlas()` builds a canvas atlas at runtime: 6 cols × 3 rows, `TILE_PX = 32`, canvas 192×96, `THREE.CanvasTexture`, `magFilter`/`minFilter = NearestFilter`, `SRGBColorSpace`. UVs in `buildChunkMesh`: `u0=(idx%6)/6`, `v0=1-(floor(idx/6)+1)/3`, `du=1/6`, `dv=1/3` — each tile fills its cell exactly, no inset/padding. | **YES — the atlas (18 tiles)** |
| HUD portrait fox | `game3.js drawPortrait()`: flat shapes on a 72×72 canvas 2D element (`page3.html` `<canvas id="portrait" width="72" height="72">`). Not a texture, but a drawn asset — included as a bonus deliverable. | Asset (not a texture) |
| Monsters (wisp / surface / guardian) | `buildMonsterMesh()`: Box/Cylinder geometry + `MeshLambertMaterial` flat palette colors. | No |
| Rift / portal | `openRift()`: TorusGeometry ring (#00d9ff) + CircleGeometry disc (realm tint, 50% opacity). | No |
| Sky / background | `scene.background = Color(0x000000)` + Fog (#020814 / #030614). | No |
| Items (Star Lance, charms), swing arc | Geometry + flat materials. | No |
| UI chrome | CSS in page3.html; hearts are text glyphs. | No |

File-based textures: **none** — `demo3/assets/` holds only
`three.module.js`. The loader consumes a runtime canvas, so the
deliverable shape follows the code: image files in the exact atlas
layout the UV mapping expects, for the v5 build to load in place of the
procedural drawing (wiring note below).

## Target spec

- Atlas: same 6×3 layout, tile size 32 → **256 px** (8× per axis),
  atlas **1536×768 PNG**, RGB, tile order identical to `TILE` in
  game3.js (atlas slots are load-bearing).
- Per-tile: 256×256 PNG each, same order/names.
- Portrait: 72×72 → **288×288 PNG** (4×), RGBA, transparent background
  like the canvas original, hat included (the granted state PALETTE-V4
  describes).

## Inventory + verdicts

All 18 tiles drawn in full (the set is bounded — no pilot subset, no
remainder). QC by `qc_textures.py`, evidence in
`demo3/assets/textures/qc/` (qc-report.json, wrap-test.png,
stack-pale.png, scale-32.png, scale-96.png, side-by-side-atlas.png,
side-by-side-portrait.png; `qc/replica_original.py` is a faithful
transcription of the procedural originals used only as QC reference).

QC checks, applied to every tile:
(a) **Palette** — every pixel must be a palette-v4 color or a blend of
    exactly two palette-v4 colors (distance to nearest palette-pair
    segment ≤ 3.0). Palette set = PALETTE-V4.md values (retired v3
    hexes named in that doc excluded) + hexes the v4 build itself uses
    in game3.js. Result for the whole set: **0.0% pixels off-palette**,
    worst segment distance 2.74 (deepstone star-fleck blend).
(b) **Tiling** — left/right edge-band agreement ≤ 4.0 per channel on
    every tile (original replica: up to 10.8) — horizontal wrap is
    seamless. Vertical edges are non-continuous **by design in both
    versions**: the molded rim + top sheen make each block read as its
    own brick (replica top/bottom diff 2.4–25.0 on a 1-px band; the
    hand set shows the same brick groove in stack renders, no stray
    marks crossing any seam in the wrap test).
(c) **At-scale read** — every tile rendered at 32×32 (the original
    texel resolution): all 18 read and stay mutually distinguishable
    (studs, kelp mass, mortar, circuit crack, strata, sparkles all
    survive; dirt pebble arcs and the scar crack go subtle, matching
    the originals' at-scale read).
(d) **Identity** — side-by-side at 192×96 against the replica of the
    procedural atlas: same tile in every slot, same structure
    (studs, bands, grooves, mortar, cracks) — a resolution-and-hand
    upgrade, not a redesign.

| Idx | Tile | Before | After | Verdict |
| --- | --- | --- | --- | --- |
| 0 | grass-top | 32×32 | 256×256 | PASS |
| 1 | grass-side | 32×32 | 256×256 | PASS |
| 2 | dirt | 32×32 | 256×256 | PASS |
| 3 | stone | 32×32 | 256×256 | PASS |
| 4 | wood-side | 32×32 | 256×256 | PASS |
| 5 | wood-top | 32×32 | 256×256 | PASS |
| 6 | leaf (kelp) | 32×32 | 256×256 | PASS |
| 7 | ash-top (ice) | 32×32 | 256×256 | PASS |
| 8 | ash-side | 32×32 | 256×256 | PASS |
| 9 | redrock | 32×32 | 256×256 | PASS |
| 10 | basalt | 32×32 | 256×256 | PASS |
| 11 | ember | 32×32 | 256×256 | PASS (after 1 redraw — see below) |
| 12 | brick | 32×32 | 256×256 | PASS |
| 13 | deepstone | 32×32 | 256×256 | PASS (after 1 redraw — see below) |
| 14 | scar | 32×32 | 256×256 | PASS |
| 15 | crystal | 32×32 | 256×256 | PASS |
| 16 | vault | 32×32 | 256×256 | PASS |
| 17 | bedrock | 32×32 | 256×256 | PASS |
| — | portrait fox (asset) | 72×72 | 288×288 | PASS — color-share at 72×72 vs original: fur 50.0/41.1%, muzzle 13.7/15.4%, hat 30.5/29.1%, opaque 42.4/41.9%; same fox, same geometry (all coordinates ×4), glints added |

Redraws (one each, indictment attached, both passed on the second
attempt): **ember** — the first circuit crack exited the right edge at
y≈80 and re-entered the left at y≈150, breaking the wrap seam;
endpoints pulled interior (x 22→234 max), overshoot dropped. **deepstone**
— the procedural star-fleck positions sit under the studs and vanish at
scale; the same five star-flecks moved into the inter-stud gaps.

## Where things landed

`~/workspace/nova-fox/demo3/assets/textures/`
- `atlas-handdrawn-1536x768.png` — the deliverable atlas (sha256 cbec4cc3804827cd…)
- `tiles/tile-NN-name.png` — the 18 tiles individually
- `portrait-fox-288.png` — hi-res portrait asset (sha256 de88c4a2b9fb1836…)
- `draw_textures.py`, `draw_portrait.py` — the deterministic drawing scripts (seed 20261122)
- `qc_textures.py`, `qc/` — QC script + evidence

No game code was touched. The procedural originals remain in
`game3.js makeAtlas()` / `drawPortrait()`, untouched and recoverable —
deleting the new folder restores the exact prior state (the folder is
not a git repo).

## Handoff for the v5 build (code change — main chat's, not done here)

In `makeAtlas()`: load `assets/textures/atlas-handdrawn-1536x768.png`,
set `TILE_PX = 256`, and `drawImage` it onto the atlas canvas in place
of the procedural `tile()` calls (keep the `CanvasTexture` +
NearestFilter + SRGB lines as they are). One caution: at 256 px tiles,
NearestFilter sampling is unchanged, but the atlas is 64× the pixels —
fine for any GPU the game already runs on. Portrait: replace
`drawPortrait()`'s shape calls with a `drawImage` of
`portrait-fox-288.png` scaled to the 72×72 canvas (or widen the canvas
to 288 and let CSS size it).

## History archive

Not appended. The archive manifest's groups are fixed in
`scrolltown-history/history/build.py` (`burns`, `gates`, `intro`,
`live`) and its media paths must resolve inside the wbic16/scrolltown
repo; Nova Fox textures live in this repo-less folder, so a Games entry
would need a builder change plus a cross-repo media copy. Per the
brief, not forced.
