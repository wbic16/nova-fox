# Nova Fox — Palette V4

Will's art direction, 2026-11-22 19:48 CST, verbatim: *"fox.phext.io color
scheme is all wrong - blue, oceans of probability, music of the primes,
tron, OLED backlit"*.

Applied to the v3 build as a palette-only pass: colors, materials,
lighting, fog, and UI chrome. No gameplay, physics, narration,
leaderboard, save/login, or world-generation changes. Edits were made in
the sources of record (`demo3/game3.js`, `demo3/page3.html`) and
`demo3/index.html` was rebuilt with `demo3/build3.py`, so source and
shipped file stay in step.

## The palette

| Role | Value | Where |
| --- | --- | --- |
| OLED background black | `#000000` | Scene background in **both** realms; page body background. Pure black — unlit space emits nothing, OLED-style. |
| Ocean fog — Nova Prime | `#020814` | Fog (34–110): the world dissolves into deep-ocean blue-black with distance — the "oceans of probability" depth cue. |
| Ocean fog — Ashfall Haven | `#030614` | Fog (30–95): a shade more indigo than Nova Prime, so the realms still read apart. |
| Tron cyan (primary emissive) | `#00d9ff` | Hearts, chord-note underlines, intro-card rules, ember-tile circuit cracks, Swift Charm. |
| Bright cyan | `#00c8ff` / `#00e5ff` | Held instrument pads, Star Lance shaft, Swift Charm glow. |
| Neon blue (primary UI) | `#00a3ff` | Primary buttons, portrait hat, Lance/beam family. |
| Electric blue | `#2979ff` | Ward Charm. |
| Sky light blue | `#8fd0ff` hemisphere / `#bfe3ff` sun | Both realms' key light — moonlit-ocean light instead of daylight. |
| Ashfall light | `#7fb2ff` hemisphere / `#6fb7ff` sun | Cooler, dimmer-feeling blue (intensities unchanged from v3). |
| Ice highlight | `#aee6ff` / `#eafcff` / `#d8f4ff` | Damage popups, intro epithet, Lance tip, Bright Charm, deepstone star-flecks. |
| Pale wisp blue | `#d6ecff` body, `#33baff` emissive | The training wisp stays pale and gentle against the dark. |
| Sea-glass teal | `#5fe8d8` | Inventory line — the one green-family survivor, pulled into the ocean register. |
| Tron orange (sole warm accent) | `#ff7a00` / `#ff9500` eyes, `#ff9d5c` strike popups | Antagonist eyes (surface things, the Keeper) and strike feedback only — the Tron program-vs-antagonist contrast. The damage vignette keeps its red: it is a wound signal, not décor. |

## The world tiles (texture atlas)

Every Lego-atlas tile moved into the blue register; studs, molded rims,
and fleck structure are unchanged, only their colors:

- Surface growth: deep ocean blue `#0e4d8f` with `#1565c0 / #1e88e5 / #00b0ff` flecks; sides `#0b3f78`; the soil beneath is seabed `#0a2a4a`.
- Wood is drowned timber: `#14406e` sides, `#1a4f86` tops.
- Leaf canopy is kelp: `#04506e` with `#0a6d94` flecks.
- Ashfall's pale cap is ice: `#cfe6f5` tops, `#a9c6dc` sides; its red rock is now deep indigo `#3b2f7a`.
- Stone, brick, basalt, bedrock: blue-grays `#5f748c`, `#46586e`, `#1c2531`, `#3d4a5c`.
- Ember blocks are near-black `#0a0f1a` veined with glowing Tron-cyan circuit cracks (`#00d9ff`, `#7fefff`) — they are in the emissive bucket, so the cracks genuinely glow.
- Deepstone deepened to `#0033cc` with ice flecks; crystal brightened to `#33ccff`; vault to `#0b4fa8`; scar to blue-black `#05060d`.

## Things and creatures

- Monsters: dark Tron bodies `#0a1230` with blue emissive `#0033aa` (studs `#0044cc`); eyes — wisp pale cyan, surface things Tron orange, the Keeper amber-orange.
- Star Lance: cyan shaft, ice tip, blue light-beam. Charms: Swift cyan, Ward electric blue, Bright ice — three blues, still tellable apart at a glance.
- The portrait fox is a blue fox now: `#2f7fe0` fur, ice muzzle, cyan hat.
- Swing arc: pale cyan `#9fe8ff`.

## UI chrome (page3.html)

Gold is gone from the interface: accents, guide panel, board headings,
realm names, objectives, and score lines are ice/cyan blues; HUD panels
sit on near-black `rgba(0, 8, 20, 0.82)` with a neon-blue border
`rgba(0, 140, 255, 0.55)`; the chord flash is a cyan-white bloom instead
of lavender. Text colors that were already blue-white are unchanged.

The thematic accents ride along without new mechanics or text: the
probability-ocean is the fog and the depth-graded blues; the primes'
music is left to the eleven-note instrument itself — no copy was added
anywhere, and no in-game text changed (the veil holds).

## Verification

- Unit suite (`demo3/test3.mjs`): **78/78 passed** (baseline 78/78).
- E2E suite (`demo3/cdp_test3.mjs`, the shipped file in headless Chrome):
  **48/48 passed**, including "no page console errors" — zero console
  errors (baseline 48/48).
- No test asserted an old palette value, so no assertions were updated.
- Grep of the sources confirms no v3 palette values remain (gold
  `#ffd9a0`/`#d9a441`, grass greens, warm sky `#7fb2dd`, ashfall rust
  `#584038`, purple monster emissive `#40186a`: all zero hits).

## The build

- File: `demo3/index.html` — 3,425,645 bytes
- sha256: `19ab81ace6ad694a36c2f61a6507de938752b068594003e3946b67cc7c5623e5`
- (v3 was 3,425,649 bytes, sha256 `4e31b733…`.)

## Staging note

There is **no local staged copy** of the site build under
`~/workspace/nova-fox/` — `backend/fox-launch/` holds only the installer
machinery (nginx vhosts, install.sh, runbook), and install.sh reads the
game from `$LAUNCH/site/index.html` on awsbox. The new build must be
re-staged to `~/fox-phext-launch/site/index.html` on awsbox before
install.sh runs (or the webroot copy refreshed if it already ran). That
box step belongs to the parent agent; awsbox was not touched here.
