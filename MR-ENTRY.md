# MR — G-12 Portraits (Producer Leg 4, BUILD)

- **Item:** G-12 portrait art leg — roster of 6 portraits per `PORTRAITS-DESIGN.md` (design leg EE 1339). Will ruled EE 1338, verbatim: "portraits for sure".
- **Base:** b63fb54 (portal-codes tip)
- **Branch / worktree:** portraits-g12 at ~/nf-portraits (hub), from ~/nf-repo. Never staged/stamped/pushed by this leg.
- **Commits:**
  - 14940eb — demo73 G-12 portraits (build; unit 1206/0)
  - (this MR entry is committed as the following docs commit on the same branch)
- **Stack note:** stacks on portal-codes; fourth of the EE 1338 ruling legs (stack: exo 0cd784f → f12-contracts → flight-gate → portal-codes → portraits-g12).

## What was built (per character)

- **The Fox (existing, re-specified only):** the shipped `drawPortrait()` body moved verbatim into `_drawFoxPortrait(g)`; `drawPortrait()` now delegates as `drawPortraitFor("fox", $("portrait"))` with every call site unchanged. A unit pin proves the wrapper and the direct call produce identical canvas-op streams. Hat (iff `sub.hatGranted`) and worn-form mode (frame fitted on the kept `#0d1526` plate, bottom-aligned) unchanged; HUD plate `#000a18` (canvas CSS) unchanged; 72×72 HUD display unchanged.
- **Joy (NEW):** the aperture-wisp transcription — `#fff3c4` diamond core with a `#ffffff` heart diamond inside a `#00d9ff` elliptical ring (rx 26, ry 11). Speaking state (same `narration.speakingId` signal `stepJoy()` uses): ring opens to rx 28 / ry 15, core goes `#ffffff`. Fight-flare (same signals as `stepJoy()`: `state.guardianEncounter` / `battleOn`): guardian → core `#f9dd74`, ring `#2fae94`; lesser fight → core gold, ring stays cyan; speaking overrides core to white. Shown at 56px in the guide panel (left of `#guide-lines`, aligned with the `.who` label; refreshed in `renderGuide()` and on state change from `stepJoy()` via `refreshJoyPortraits`) and as a 28px mini in `#banter-line` (shown in `banterSay`, hidden when the line's timer clears it; line text moved to a `#banter-text` span so the canvas is not wiped by `textContent`).
- **Training Wisp (`wisp`, NEW):** `#d6ecff` rounded body, four `#f2faff` studs (2×2 read), `#bfe8ff` eyes — no warm color.
- **The Glimmer (`surface`, NEW):** `#0a1230` body stroked `#0033aa`, studs `#101c44`/`#0044cc`, `#ff7a00` eyes.
- **The Keeper / Shadow (`guardian`, NEW):** Glimmer body at Keeper scale (x 10→62, y 16→64), `#ff9500` eyes, and the Heart on the chest drawn by reusing the game's own `heartCanvas()` (never redrawn), fitted 20×20 at center (36,53), at the `syncGuardianHeart()` opacities — 0.16 shuttered (the intro-card state) / 1.0 exposed via `opts.heartOpacity`. No third state.
- **Cinder Husk (`husk`, NEW):** `#0b0908` body stroked `#7a2800`, ember studs `#2a1408`/`#ff6a00`, three `#ff5500` crack seams at the design coordinates, banked `#ff5a00` eyes.
- Monsters display at 96px on the existing `#introcard`, centered above `#intro-name`, drawn once per introduction in `startIntro()` beside the name/epithet fill (kind passed through `introKindKey`, so `who` values are the world.js kind strings). The card's existing 2.1s timing, dim, and input behavior are untouched.

## API / palette discipline

- `drawPortraitFor(who, canvas, opts)` — `who` ∈ "fox" | "joy" | "wisp" | "surface" | "guardian" | "husk"; unknown `who` returns false (no dragon portrait — never presented in any source; no collectibles — ENCOUNTER is a later leg; no remote foxes). All portraits authored in the 72×72 logical box; display size is a surface (CSS) property only. State arrives via `opts` (`{speaking, fight, heartOpacity, realm}`); Joy's live signals are composed by `joyPortraitOpts()` from the same signals `stepJoy()` uses — no new globals for state.
- Character shapes use character-fixed identity colors only (never `paletteFor()`). The only realm-derived elements are the new surfaces' background plate (`paletteFor(currentRealm).fog`) and 2px frame (`.accent`). No new asset files — code-drawn only; `portrait-fox-288.png` remains unwired (pinned).

## Transcription note (design §7, flag 3)

The monster "front" is the eye side (+x) of `buildMonsterMesh()` — a named transcription choice in the design page, not a discovered fact; §4.3–4.6 were built that way.

## bb9ee49 / 0cd784f drawPortrait() diff result

The design page was read from a checkout at bb9ee49 while the stamp commit is 0cd784f. `drawPortrait()` was extracted from b63fb54 (this leg's base), bb9ee49, and 0cd784f and compared: **byte-identical in all three** (sha256 prefix f9f67617efc3 for each extraction). No difference to record; this leg is on the stamp lineage and the design transcription (§4.1) matches the base exactly.

## Footprint

5 files, +630 / −23 (build commit 14940eb):
- builds/demo73/game3.js (+163/−9 area: PORTRAITS-G12 block, banterSay mini wiring, startIntro draw, stepJoy refresh, renderGuide refresh)
- builds/demo73/page3.html (guide/banter/intro canvases + display-size CSS)
- builds/demo73/test3.mjs (+128: 27 G-12 pins)
- builds/demo73/_built_module3.mjs, builds/demo73/index.html (regenerated by build3.py)

## Unit evidence (hub-side, node test3.mjs)

- Baseline on base b63fb54: **1179 passed, 0 failed**.
- After build: **1206 passed, 0 failed** (+27 G-12 pins, 0 regressions). The pins execute the real extracted portrait block on a recording mock canvas: every roster `who` renders without error; fox hat on/off, worn-form mode, and drawPortrait()/drawPortraitFor op-stream equivalence; Joy quiet/speaking/both flare states + signal composition; Keeper Heart at 0.16 and 1.0; per-monster color/geometry reads; plate/frame palette discipline; surface sizes; wiring; no-new-assets.
- No e2e run (consumer's Jenkins gate). Surfaces stay reachable in normal play exactly as today: guide panel, banter line, intro card — the separate verifier's rendered/played screenshot pass against PORTRAITS-DESIGN.md §8 is the closing gate for this leg.

— Producer Leg 4 (BUILD), EE 1342.
