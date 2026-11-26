# Nova Fox — the in-game test console (demo15)

**EE 960 · 2026-11-26 ~15:58 CST.** Will's directive (15:26 CST, verbatim):
"Build the e2e testing into the game itself — give me a console I can work
with." Built in a fresh tree, `~/workspace/nova-fox/demo15/`, seeded from
demo5 (`index.html` sha256 `98207789…` verified before copying; demo5 and
demo6–demo14 untouched — demo5 re-verified at `98207789…` after the build).
Nothing staged, nothing deployed. The `NF_SHIP_EE` token still reads
`NF_SHIP_EE:950`, exactly as seeded.

**Result: `index.html` 4,952,620 B, sha256
`dbf59e460e2f014097b6ae8738294b67c2f7cecb2a07df1d288dabd03f8c1c70`.**
Unit suite **210/210 green** (the demo5 baseline, unchanged). Focused
in-client console verification: **22/22**. Full external e2e: see
"Test counts" — the harness starves on this box right now for every tree,
including the pristine seed; the numbers are reported as measured, with
the control run beside them.

## The console

- **Toggle: Backquote ( ` )** — checked free before choosing it: no case
  in the game's keydown switch, not in `LETTER_KEYS` or `NUMBER_KEYS`,
  unused by the touch layer. Also a `console (`)` ghost button in the
  bottom-right row (mouse/touch), an Esc key, and a close button.
- The panel wears the game's own dress (`.hudpanel`, Georgia headings,
  the board's input styling) at the left edge under the portrait panel,
  with a monospace output pane — what it prints is measurements, not
  fiction. It is labeled a test console, plainly, like the readout's
  "(not in-fiction)".
- While it is open, capture-phase key handlers keep **every keystroke
  out of the game** (verified: typing `where` — whose letters are
  instrument notes and a walking key — changed neither `notesPlayed`
  nor the fox's position), the fox's held keys are cleared so opening
  it mid-stride stops him, and pointer lock is released. Closing it
  hands the keys back: a held W moves the fox again (verified).
  Enter runs a command; ↑/↓ walk the command history.
- Probes refuse to stack (one walking at a time) and refuse to run on
  a downed fox; a probe's failure is printed, never absorbed.

## Commands — what each really does

| Command | What it does |
|---|---|
| `help` | Lists the commands below (generated from the command table itself). |
| `where` | Realm name + id, position, scroll, block, facing, key scheme — read off live `state`. |
| `gravity` | The player's `gravDir` and the subspace value under him: `sub.gravityOf(realm, scroll)` for the scroll he stands on, and whether the two agree. |
| `purse` | Flux, credits, tier/source/purchase number, lifetime earned — read off the live `eco` ledgers. |
| `version` | The build's ship EE from the `NF_SHIP_EE` stamp (950 in this tree). |
| `state` | `where` + `gravity` + `purse`. |
| `portal` | The standing rift: link id, end, target, crosses, ring position/feetY, armed, view status, ring geometry — and, when the live portal view is up, a real pixel sample off the render target (pale-cool / non-fog counts, the CDP suite's own measure). With no rift standing it says so. |
| `geometry` | Calls the live `riftRingGeometry("nova","ashfall")`, prints radius/disc/segments, checks them against the unit suite's pin (radius 1.5571 ±0.001, 36 segments), and measures this build's dead band: trigger radius √1.25 ≈ 1.118 against the disc — the outer ~42% of the visible portal. |
| `bridge` | Resolves the bridge tune (1, 4, 9) through the live `chordTarget` from where the fox stands; passes when it names the other open realm. |
| `rift-straight` | Plays the bridge tune through the real instrument path (`playNote` → `playChord` → `openRift`; the pending-note buffer is cleared first, and the fact is printed), then walks the fox dead-center — the control leg, the old harness's own pattern. |
| `rift-veer [deg]` | Opens the bridge rift, turns (default 20°), walks. The approach a player actually makes. |
| `rift-slope` | Scans 36 directions off live `heightAt` for the steepest rise across one rift's reach from where the fox stands; if none rises the 2.4 blocks the height gate cares about it reports NOT RUN with the measured maximum and asks for a hillside. Otherwise it faces uphill, opens, walks dead-center, and prints both gates measured (distance vs trigger, \|dy\| vs 2.4). |
| `runall` | Geometry, bridge, and all three traversal legs, in order, then a summary line of real counts (passed / failed / not run). |
| `clear` | Empties the pane. |

How a probe walks: it puts the forward key into the same `keys` set
`updatePlayer` reads, so the real physics, voxel collision and
`riftStep` do the walking and the crossing. Distance to the ring's
center is sampled on the game's own animation frames (plus a slow
backstop), so the printed closest approach is the closest `riftStep`
itself ever saw — the quantity that decides crossing. Probes time out
at 12 s of walking.

## Measured in this client (focused verification, EE 959–960)

Run against the shipped demo15 file in headless Chrome, driving the
real input path (Backquote key, typed commands) and the console's own
`NOVA_FOX3.nfConsole` handle — the same handle added for headless
playtests, exposing exactly the surface the keyboard gets. 22/22:

- Open/close, typed-command execution, no key leakage, all readouts,
  geometry PASS (radius 1.5571 measured live), bridge PASS, portal
  honesty with no rift standing: all pass. Zero page console errors.
- **rift-straight, flat meadow near Arrival: PASS** — crossed to
  Ashfall Haven; closest observed approach 1.220 (see the sampling
  note below).
- **rift-veer 20°: FAIL, as diagnosed** — no crossing; closest approach
  measured 1.544 in one run, 1.863 in another (frame steps grow in
  this box's slow-motion rendering; the verdict is stable, the number
  is each run's frame-sampled truth). The geometric miss for 20° over
  the 3.4-block approach is ~1.16, against a 1.118 trigger.
- **rift-slope: FAIL, as diagnosed, both gates named** — steepest rise
  at hand 5.00 blocks (ground 13 → 18); ring feetY 13.00, anchored to
  the tune's ground while the ring's own ground is 18; closest
  approach 1.220 — *inside* the visible disc (1.467), so the console
  printed "he passed through the visible portal and it did not take
  him"; \|dy\| at closest 3.99 vs the 2.4 gate — NOT met, both gates
  printed as NOT met.
- **runall** from the hillside the slope leg ended on: geometry pass,
  bridge pass, straight fail, veer fail, slope not-run (no qualifying
  rise from that exact stance) — position-dependent truth, which is
  the point of running the checks where you stand.

Sampling note, stated plainly: on a leg that crosses, the crossing
frame teleports the fox before the sampler can record that frame's
pre-crossing distance, so a PASS leg's printed closest approach can
read slightly above the trigger radius (1.220 observed). The verdict
comes from the realm change / link cross counter, not from the
sampler; the sampler's number is the closest approach *observed
standing in the start realm*.

## Ported / not ported

**Ported** (each runs the real system in-client): the ring-geometry
pin and dead-band measure (from `test3.mjs`'s pinned geometry); the
bridge-tune resolution (the CDP suite's rift-opening premise, resolved
live instead of assumed); traversal legs — straight (the harness's
`walkThroughRift` pattern), veer (the diagnosis's scenario D, which
the external suite never had), slope (diagnosis scenario B, also
never in the external suite — it is new coverage, born in-client);
the portal state + pixel measures (from the `NOVA_FOX3.portalState` /
`portalPixels` CDP checks); and the state readouts the CDP suite used
to pull out through `evalJs`, now printable by the person playing.

**Not ported, and why:** the rest of `test3.mjs` — WASM-vs-JS kernel
bit-agreement, chunk generation, subspace determinism, and the
economy suite (ledgers, gift keys, purchase board, ladder, save/load
round-trips). Those are headless Node checks against `world.js` /
`economy.js`; they need no browser, they still run (210/210), and
several need fresh subspace/economy state that would disturb a live
game if run inside it. The CDP legs that inject OS-level input, the
touch-emulation legs, viewport/DOM-layout probes, and network/gateway
legs verify the browser-and-harness boundary itself; a client cannot
test its own harness from inside, and none of their results are
simulated here — they remain the external suite's job, on a box with
the cycles to run it.

## Test counts

- **Unit (`node test3.mjs`): 210 passed, 0 failed** — identical to the
  untouched demo5 baseline run at the start of this build. (The suite
  imports `world.js`/`economy.js`, which this build did not touch.)
- **Focused console verification: 22 passed, 0 failed** (described
  above; its checks also live in demo15's `cdp_test3.mjs` as the
  console section, for the next full run).
- **Full external e2e (`node cdp_test3.mjs`, pointed at demo15): no
  clean count exists in this environment, and none is claimed.**
  Attempt 1: 42 passed / 13 failed, aborted at the gravity-beat leg by
  a page-evaluation failure (`NOVA_FOX3 is not defined`) before
  reaching the touch legs or the console section. Attempt 2: 40
  passed before the harness process itself died (exit 13, the CDP
  abort class), same story. **Control:** the *unmodified* demo5 suite
  under the same box load scored 33 passed / 4 failed, aborting even
  earlier (bridge beat) with the identical harness error and the
  identical first failure ("walking covers ground", movedTotal 3.94 —
  demo15's run managed 4.38). Every failure in both demo15 attempts is
  in the timing-starved family (walk pace, guide-beat timeouts,
  crossing timeouts) that the control run shares; the box was running
  many builds at once throughout. The recorded demo5 baseline from a
  quieter hour (126 passed / 7 known touch-emulation failures) could
  not be reproduced for *either* tree today, so "no new failures
  beyond the 7" is **unverified by the full suite** — it is supported
  instead by the control comparison above and by the console section
  passing 22/22 in the focused run. Re-running the full suite on an
  unloaded box remains the closing step.

## The access question — Will's decision, flagged, not made here

The console ships in this build **open to anyone who presses ` ` `** —
ungated, undisguised, per the brief. Before a tree carrying it is
staged, someone (Will) should decide who gets it in a shipped build:
everyone (it is, arguably, a playtesting feature — the EE line already
stands on screen for the same reason), the paid tier, or behind a dev
flag. The build takes no position; the toggle is one `if` away from
any of the three.

## Files changed in demo15

- `page3.html` — the `#nfconsole` panel + its CSS in the hudpanel
  dress, the `console (`)` button, one help-line entry.
- `game3.js` — the console section (toggle + capture-phase key
  handling, readouts, checks, probes, command table) before the
  `NOVA_FOX3` handle, and `NOVA_FOX3.nfConsole` after it. One
  deliberate coupling to know about: the constant `NF_TRIGGER2`
  mirrors `riftStep`'s hard-coded 1.25 in this build, with a comment
  saying the traversal fix must change both together — the geometry
  command exists to catch that drift when demo7's fix reconciles in.
- `cdp_test3.mjs` — the target URL (demo5 → demo15, as each tree's
  harness copy carries its own) and the console test section.
- `build3.py`, `world.js`, `economy.js` — untouched. Rebuilt with the
  tree's own `build3.py`; the `NF_SHIP_EE` value was not changed.
