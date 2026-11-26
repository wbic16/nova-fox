# Nova Fox — demo v2

A playable slice built from Will's Review 1 of the v1 demo. v1 lives
untouched in `../demo/`; everything here is new in `demo2/`.

**Play it:** open `index.html` in a browser (double-click works — it
is a single self-contained file, 1.37 MB, no server, no network).
Click the world to take the helm. Emise guides the first minutes.

**Prime directive (Will, 2026-11-22):** above all else, this thing
has to be fun to play and result in +1 phext XP for the gamer. Where
a lesson and the fun traded against each other, the fun won and the
lesson went deeper under the veil.

## What v2 is

- **Engine:** Three.js first-person voxel world — blocky textured
  cubes in the Minecraft register (procedural canvas texture atlas,
  original tiles), chunked 16×16 columns, streamed infinitely around
  the player (radius 3 chunks, no box, no fence). Pointer-lock mouse
  look, with keyboard turning as a fallback.
- **Generation architecture (Will's clarification, honored as
  built):** the physics engine operates *entirely in subspace* —
  per-scroll Conway's Life (B3/S23) stepped with neighbor counts read
  **across scroll borders**, monsters stepping in cell space, gravity
  direction per scroll — and the 3D world is *procedurally generated
  from the subspace state* of the scroll being explored, with
  non-local effects from nearby scrolls: Life density grows rift
  crystal on the surface, and a neighbor scroll pressing in along a
  seam grows crystal along that seam in *your* chunk. Monsters press
  in across borders (logged). Generation is deterministic: same
  subspace state + chunk coords → same chunk, byte for byte.
- **Movement:** WASD + Space jump with real gravity, one-block step
  assist so meadow ground flows, head-bob on the stride, strafe lean
  (bob + weave in the camera). **G** turns down itself — down is a
  property of the scroll, inscribed, and the place provides a
  riftstone ceiling when down is up.
- **Instrument / teleport:** the 11 notes live on the number row
  (1 2 3 4 5 6 7 8 9 0 − = notes 1–11) *and* the QWERTY row
  (Q W E R T Y U I O P [), and on clickable pads. The HUD shows the
  chord being built **as numbers**. Any 3 distinct notes = a chord =
  teleport: the taught bridge tune **1 · 4 · 9** crosses between the
  two open realms; any other chord addresses a deterministic pocket
  page in the current realm; replaying the pocket's own tune holds
  you there.
- **Realms:** Nova Prime (spawn; green meadow) and Ashfall Haven
  (ash, red rock, basalt — ridged terrain, different temper),
  reachable by the bridge tune. The realms panel (M) lists all 11
  names — Nova Prime, Ni-Knight, Ashfall Haven, Logos Prime, Elven
  Path, Orchid Flow, Halycon Vector, Delta Wood, Best Willow, Plain
  View, Trust Fall — with the unopened nine marked as named and
  quiet, not yet open.
- **Combat / HP:** things move in the dark and are visible only in
  glimpses (see Simplifications). Contact costs 2 HP with knockback,
  a red vignette, and a hit sound. HP is unmistakable: hearts **and**
  a numeric `HP n / 20` in the HUD at all times. Striking (click or
  F) edits a monster out of the world — and the scar persists in the
  regenerated ground and in the inscription log.
- **Sound:** all WebAudio-synthesized, no samples: distinct plucked
  pitch per note, footsteps, jump/land, hit taken, monster hit and
  death, portal swell on teleport, quest chime, a quiet wind loop.
  Audio unlocks on the first click; the guide says so.
- **Guide + narration:** Emise narrates the first minutes in
  dismissable panels — the storyline (galaxy conquered, dark matter
  unsolved, the rifts) then the verbs in order: move/jump → the
  numbers are an instrument → the bridge tune → gravity → the quest.
  Full script in `NARRATION.md`, keyed by beat ID for voice
  recording. All in-game text obeys the veil: the world is named
  in-fiction only (chart, rift, tune, page, the dark).
- **One dungeon quest:** east of Arrival in Nova Prime, a hill rises
  over a brick barrow hall — a 3×3 shaft with a spiral of foothold
  bricks, a pillared hall, a guardian (3 strikes), and the Deep
  Stone. Reaching the stone inscribes the prize: **a hat** — visible
  as a brim on the view and on the HUD portrait, with the
  inscription-log line to prove it was written, not just shown.
- **Kept from v1:** the WASM core (`nova_core.wasm` — hash, foam,
  Life — actually running in the page; the readout names which
  kernel is live), the hearts system, and the collapsible
  inscription-log readout (L), labelled as demo instrumentation,
  not in-fiction.

## Controls

| Input | Effect |
|---|---|
| Click the world | take the helm (pointer lock + sound wakes) |
| Mouse | look |
| W A S D / arrows | walk (←/→ turn) · Shift runs |
| Space | jump |
| 1–9 0 − · Q W E R T Y U I O P [ | the eleven notes — three together travel |
| G | turn down itself (the place remembers) |
| Click / F | strike |
| M / Tab | the chart of realms |
| L | the written record (inscription log readout) |
| Esc | release the mouse |

One overlap, stated plainly: **W is both walk and note 2.** Holding
W walks; a quick tap of W (under ~200 ms) also sounds note 2. The
number row always plays cleanly.

## Playtest record (honest)

Run 2026-11-22, this machine (headless Chrome, SwiftShader software
rendering, throttled shared CPU — ~4 fps in the harness; that is a
property of the test rig, not a frame-rate claim about real
hardware).

- **Node unit tests — `test2.mjs`: 49 passed, 0 failed.**
  WASM ≡ JS kernels (hash / foam / Life bit-identical); generator
  determinism (same subspace state → identical chunk bytes at 6
  coords in both realms; realms differ from each other); dungeon
  contents generated (deep stone, floor, walls, shaft); coupled Life
  on an isolated scroll equals the kernel's own Life step; a birth
  on a scroll edge caused by the neighbor's cells (and no birth
  without the neighbor); border-pressure crystal growth on your seam
  while the far chunk stays byte-identical; chord mapping (bridge
  both ways, deterministic pocket, stay-on-replay); gravity flip →
  vault appears at the ceiling line and "warp" is inscribed; a
  monster pressing in across a border is logged; strike → scar
  override → the scar is present in the regenerated chunk; the
  guardian holds two strikes and falls to the third; quest + hat
  grant exactly once, both logged; escalation (monster speed 1 → 2
  when the living world doubles).
- **Headless-Chrome e2e — `cdp_test2.mjs`: 34 passed, 0 failed,
  zero console errors.** Real key events through the page's own
  handlers, along the scripted fresh-player path: boot with the
  WASM core live → guide buttons → walk (step assist over the
  meadow) → jump → one number → bridge tune **by number keys** →
  Ashfall Haven → same tune home → G (the fox falls *up* and lands
  on the new ceiling) → G back → a monster's contact drops HP and
  the HUD's numeric HP drops with it → the Deep Stone completes the
  quest → the hat is granted, inscribed, and visible → the guide
  retires. **Kernel in the shipped page: WASM live** (the JS
  fallback exists and is unit-verified identical, but did not
  engage).
- **XP check (prime directive): did the scripted fresh-player path
  force both experiences? YES — with evidence.**
  1. *Movement is addressing:* the guide cannot be completed
     without playing a chord of three numbers and being carried
     somewhere — the 'bridge' beat completes only when the realm
     actually becomes Ashfall Haven, and the 'ashfall' beat only
     when the same tune carries the player home. E2E asserts both
     crossings, by number keys, in order.
  2. *Written outlasts shown:* the path ends at the Deep Stone,
     where the prize is an *inscription* — the e2e asserts the
     `grant` segment in the log and the hat on the view. The
     companion half (strike a thing out; the scar persists in
     regenerated ground) is unit-verified (strike → scar override
     → scar present after regeneration). The e2e stages monster
     contact and HP loss but does not land a killing strike — that
     half is covered by unit tests, not by the browser path.
- **Bugs found by the playtests and fixed during the build:**
  (1) invalidating every chunk on every physics tick caused a
  regeneration storm that starved the frame rate → chunks now
  re-derive only when a cheap signature of their generation inputs
  (Life density, seam pressure, gravity) actually changes;
  (2) flipping gravity left the player's body box overlapping the
  ground, and the collision clamp ratcheted the fox through the
  floor → a gravity change now shifts the feet across the body's
  (unchanged) span before the new down applies;
  (3) terrain height was recomputed for every block instead of every
  column (64× redundant) → hoisted;
  (4) notes noodled during the guide's early beats bled into the
  taught bridge chord and turned it into a different teleport →
  when Emise teaches a tune, the slate is wiped clean;
  (5) standard PBR materials were unusable on the software
  renderer → Lambert materials with baked face shading.

### NOT verified

- **Human feel** — movement, bob/weave, strike timing, and mouse
  look with a real mouse under real pointer lock on a real display.
  The e2e drives keys, not a hand.
- **Real-speaker audio** — every sound is synthesized code that
  executes without error headlessly; audibility and mix balance on
  real speakers are unjudged.
- **Physical-GPU performance** — all rendering evidence is
  SwiftShader under a throttled shared CPU. Nothing here measures a
  real GPU.
- **The shaft descent on foot** — the dungeon's geometry (spiral
  footholds, hall, deep room) is unit-verified as generated; the
  e2e enters the deep room via the debug handle rather than
  climbing down, and the guardian fight in-browser is untested
  (guardian strikes are unit-verified).
- **Long sessions** — chunk-store churn and memory over hours of
  wandering are unmeasured.

## Simplifications (named plainly)

- **Monster visibility:** the design's rule is agreement with the
  player's slice on all 8 unchosen axes. The demo simplifies this
  to a 3-phase cycle — a monster is there (visible, dangerous) one
  tick in three. The fiction calls them glimpses; the readout says
  what the rule is here.
- **Two realms are open; nine are names.** The unopened realms are
  listed, not generated.
- **The dungeon is one generated pocket** at a fixed footprint in
  Nova Prime's spawn scroll — deterministic, from the same
  generator, but its layout is authored constants, not a procedural
  dungeon system.
- **Gravity is per-scroll** (64×64 blocks), flipped for the scroll
  you stand in — not a global or per-room verb.
- **Pocket addresses are a hash of the chord** (deterministic), not
  a curated address book; only the bridge tune 1 · 4 · 9 is
  curated.
- **The inscription log is an in-memory stand-in** for the durable
  log of the full design: it survives everything in-session
  (including death) but not a page reload. Daily world cycles,
  midnight regeneration, and visiting old worlds (DESIGN.md) are
  not in this slice.
- **Escalation** (monster speed doubles when the living world
  doubles) is implemented and unit-tested, but a short session will
  rarely grow the world enough to feel it.
- **No fall damage; no melee animation** beyond the swing sound;
  textures are original procedural tiles in the Minecraft register,
  not Mojang's.

## Files

- `index.html` — the game. Single self-contained file (1,371,090
  bytes), opens from `file://`.
- `world.js` — subspace + generator (the physics and the world
  truth; no DOM, no Three).
- `game2.js` — the view: Three.js client, input, HUD, guide, audio.
- `page2.html` + `build2.py` — the shell and the assembler
  (`python3 build2.py` → `index.html` + `_built_module2.mjs`).
- `test2.mjs` — Node unit tests (`node test2.mjs`).
- `cdp_test2.mjs` — headless-Chrome e2e (`node cdp_test2.mjs`).
- `NARRATION.md` — Emise's full narration script, by beat ID.
- `core.rs`, `nova_core.wasm`, `nova_core_b64.js`, `assets/` —
  the WASM core and vendored Three.js, carried from v1 unchanged.
