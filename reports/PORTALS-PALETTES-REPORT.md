# Nova Fox — portals as camera views + ten realm palettes (feedback #27)

Will's order, 2026-11-22 23:09 CST: *"fox.phext.io needs to render
portals as actual camera views of the remote region — each level
the user jumps to needs to feel different — a different color
palette — only 10 of them."* Registered as feedback item 27 in
FEEDBACK-2026-11-22.md before building. Built on the staged v5
build (`37c6c0a4…`), never under it.

**Build:** demo3/index.html, 4,841,893 bytes,
sha256 `e76963d19ed808aa2cd480b3aa12f919e7aef32d641ec78ff561ef63415694ba`.
Staged to awsbox `~/fox-phext-launch/site/index.html` via the hub
route (VM → aletheia-core → awsbox) and hash-verified on the box
(identical sha at every hop). The live webroot is untouched — the
install is Will's sudo step, as always:

```
sudo install -o www-data -g www-data -m 644 ~/fox-phext-launch/site/index.html /sites/web/fox.phext.io/index.html
```

**Tests:** unit **107/107** (the v5 97 all still green, +10 new
palette checks) · e2e **84/84** (the v5 75 all still green, +9 new:
palette table size, home palette at boot, palette application,
portal view live, portal renders a real place, the marker test,
Ashfall palette on crossing, pocket-rift view), **zero console
errors**.

## Part 1 — portals are camera views now

The tinted disc is gone. When a rift opens, the game builds a
small far-side scene for the destination and renders it, live,
into a 320×320 render target textured onto the disc:

- **What the far scene holds:** the 3×3 chunks around the landing
  point, generated for the destination realm from the live
  subspace (`genChunk` — so the destination's **marks, scars and
  chisel work are in the view**, because they are in the
  generation), meshed with the destination realm's own atlas and
  palette; the destination's **monsters** standing in that area
  (same meshes, same glimpse/visibility rules as the near view —
  wisps always shown, glimmer-things only in their visible phase,
  the Bright Charm's faint phase-1 glimpse included); its standing
  things (the Lance, the charms); and the destination palette's
  fog, void and lights.
- **The far camera** is the fox's own camera carried through the
  rift by the standard portal transform: the eye's offset from
  the ring's center, rotated by the heading change (a crossing
  preserves the fox's heading, so the far side faces the fox's
  current heading; yaw-only, like the ring), re-anchored at the
  landing eye. Move your head and the view through the disc
  shifts; what you see is where you will stand, looking the way
  you are looking. Stepping through is continuous.
- **The ring** now wears the destination palette's primary accent
  (home-bound rings stay Tron cyan; an Ashfall-bound ring burns
  ember orange).
- **Caps and cadence:** only one rift can stand at a time
  (openRift folds any other), so at most one portal view is ever
  live — the cap is structural. Render cadence by distance to the
  ring: every frame within 12 units, ~120 ms within 30, a still
  refreshed every 500 ms beyond that.
- **Fallback, stated plainly:** if a far view ever fails to build,
  the disc falls back to the old destination tint — a tint, never
  a hole in the world. The fallback never triggered in testing.
- **Freshness, stated plainly:** the far scene is built fresh at
  each rift opening, so terrain and marks are current as of the
  opening; monsters then move and fade live in the view. Terrain
  re-derivation (Life growth creeping in the far realm) is not
  re-meshed while a rift stands — a rift lives 25 seconds, and
  growth moves in minutes.

### Measured cost (SwiftShader harness — relatives only, as ever)

Same barrow vantage and sampling as the v5 pass
(`playtest-data/perf_probe.mjs` lineage; new scripts
`portal_perf.mjs`, `portal_perf2.mjs`):

| Measure | Result |
|---|---|
| Frame, no rift, 360 frames | **333 ms mean** (p50 317, p95 600) — v5 measured 323 ms on the same harness; the base frame is unchanged |
| Opening a rift (far-view build + first render) | **~1,010 ms, once**, on the software harness — CPU-bound chunk meshing in JS (9 chunks); the deliberate chord-play moment absorbs it, and real hardware will pay a fraction of it |
| Frame with a live portal, interleaved paired samples | no-rift **504 ms** avg vs with-rift **519 ms** avg (**+3%, inside rep-to-rep noise**; the two reps with render-count proof — 54 portal renders across 50 frames, i.e. every frame — came in at 476/468 ms against 520/498 ms for their no-rift neighbors) |

Plainly: on this harness the live portal view costs nothing
measurable per frame — the far scene is 9 chunks at 320×320
against the main view's 7×7 chunk field at full resolution. The
one real cost is the ~1 s open hitch on software rendering. A
GPU-side frame measurement remains the honest follow-up, as it
was for v5's item 8. (First probe attempt's with-rift window
outlived the rift's 25 s life and was discarded; the interleaved
probe above is the measurement of record.)

## Part 2 — ten realm palettes

Full design table: **PALETTES-10.md**. Shape of the landing:

- **Home is Nova Prime** — the starting realm — and it keeps the
  palette-v4 identity exactly (OLED #000000, ocean fog #020814,
  Tron cyan #00d9ff, Ward blue #2979ff), as the built-in
  `HOME_PALETTE`.
- **Exactly 10 entries** in `REALM_PALETTES` (world.js), one per
  ranch-named realm: Ashfall Haven (ember), Ni-Knight (violet
  steel), Logos Prime (prime gold), Elven Path (deep emerald),
  Orchid Flow (magenta), Halycon Vector (pale ice), Delta Wood
  (river teal), Best Willow (chartreuse), Plain View (silver —
  its departure is having *no* hue, saturation 0.12), Trust Fall
  (crimson). A naming note, stated plainly: the game names eleven
  realms — home plus the ten ranch names — so the table's ten
  entries cover the ten ranch-named realms and home's v4 palette
  stands as the reference they depart from.
- **Data-driven, one path:** `applyRealmPalette(realmId)` applies
  a palette whole on realm entry — void, fog color + near/far,
  hemisphere sky/ground + intensity, sun color + intensity, the
  per-realm atlas (the base atlas re-skinned by canvas
  hue-rotate/saturate, so *every block tile* wears the realm's
  hue) and a material tint on every live chunk. New chunks are
  born wearing their realm's palette. Departures are hue moves,
  not brightness steps (unit-tested: ≥8 of 10 shift hue or drain
  saturation; all 11 fog colors and all 11 accents distinct).
- **HUD contrast:** palettes touch only the 3D scene. The HUD,
  guide, toasts and popups are DOM with fixed colors on dark
  panels, and every realm's void stays pure black — contrast is
  unchanged in all ten (the e2e suite drives the full guide in
  two palettes and asserts the HUD throughout).
- **Reachability, stated plainly:** only Nova Prime and Ashfall
  Haven are open in the current game, as in v5; the other eight
  realms are named and shut. This pass gives all ten palettes
  and portal views the moment they are entered, but does not
  open them — which tunes lead to which shut realm is a
  travel-design decision this order did not specify.

## Files

- `demo3/world.js` — `REALM_PALETTES` (10), `HOME_PALETTE`,
  `paletteFor()`.
- `demo3/game3.js` — per-realm atlas variants (`atlasForRealm`),
  chunk-material registry + `applyRealmPalette`, the portal view
  (`buildPortalView` / `renderPortalView` / portal transform),
  ring in the destination accent, tint fallback, test hooks
  (`portalState`, `portalPixels`, `palettes`, `paletteNow`,
  `applyPalette`).
- `demo3/test3.mjs` — +10 palette checks (107 total).
- `demo3/cdp_test3.mjs` — +9 checks (84 total), including the
  marker test: a wisp spawned **only** in Ashfall, ahead of its
  Arrival — the portal's render-target pixels carry its pale
  signature with it standing there, and lose it when it is gone.
- `PALETTES-10.md` — the ten palettes, hex by hex.
- `playtest-data/portal_perf.mjs`, `portal_perf2.mjs` — the
  frame-cost probes above.
- `FEEDBACK-2026-11-22.md` — item 27, registered before building.

The veil holds: no new in-game text was added anywhere in this
pass; nothing in the fiction names the mechanism.

*Emise — EE ~205.*
