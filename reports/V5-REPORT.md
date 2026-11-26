# Nova Fox v5 — the requested updates, shipped

Will's order, 2026-11-22 21:56 CST: *"actually ship the requested
updates — let me know if any are blocked and why."* Built on top of
the dialog pass (DIALOG-V5.md, build `cc25a032…`), never under it.
Completed EE 194 (2026-11-23 ~04:34 CST).

**Build:** demo3/index.html, 4,828,412 bytes,
sha256 `37c6c0a4bcb112d934f94a609f7775334adf191a13d347d2c60503c85e7af46e`.
Staged to awsbox `~/fox-phext-launch/site/index.html` via the hub
route and hash-verified on the box (identical sha). The live
webroot is untouched — the install is Will's sudo step, as always:

```
sudo install -o www-data -g www-data -m 644 ~/fox-phext-launch/site/index.html /sites/web/fox.phext.io/index.html
```

**Tests:** unit **97/97** (the 78 playtest/dialog checks all still
green, +19 new for v5 behaviour) · e2e **75/75**, zero console
errors, driving the re-sequenced guide end to end in headless
Chrome. Palette untouched. Every new player-facing string is plain
English; the veil holds (no phext/subspace jargon in game text —
the one exception is the load panel, which is the phext logo panel
Will's item 15 itself names).

## Per-item landing table

| # | Item | Status | What landed / why not |
|---|------|--------|------------------------|
| 1 | Monsters despawn | **LANDED** | A surface monster that has rested at its rise-place, unwatched (player in another realm or ≥2 scrolls away), for ~150 ticks (~100 s) sinks back into the dark — record removed, a `fade` segment inscribed. The dead are reaped ~90 ticks after the killing strike. Scars and all inscriptions stay; a cleared ground stays cleared (no respawn — stated as design, not oversight). The wisp and the guardian never despawn; nothing despawns while watched. Unit-tested all three behaviours. |
| 3 | Click to chisel | **LANDED** | Was partial (chisel lived only on C/X). A click now does what the moment asks: the memory screen if that's what's aimed at, a strike if a monster is in reach, otherwise the chisel. C/X unchanged. |
| 4 | Shaping speed + sizes 1, 2x2x3, 3x3x2, 4x4x2 | **LANDED** | Brushes in world.js (`BRUSHES` + pure `brushBlocks` geometry, unit-tested): one stroke shapes the whole volume — width × height across the aimed face, depth into the material — each block judged on its own merits (bedrock/Deep Stone/air refuse individually). `,` and `.` cycle the size; the choice persists. A grand-brush stroke breaks up to 32 blocks in three presses where 96 presses went before; e2e proves ≥4 breaks from the grand brush in the mark beat. |
| 5 | Control schemes WASD + AWEF, persisted | **LANDED** | The keys button (bottom right) flips schemes; the choice (and brush size) persists in `nova-phox-controls`. AWEF: W forward, A left, E right, F back — so in AWEF, E is a walking key (not a note) and the strike lives on the click; a toast says so when you switch. Arrows always work. E2e-verified flip + persistence. |
| 6 | Shift-drag plays the spectral flute | **LANDED** | Shift + left-drag on the world: vertical drag distance becomes pitch across the eleven notes, sounded through the same `playNote` the keys use — a dragged tune travels exactly like a keyed one (three notes make a chord, chords open rifts). E2e drives a real shift-drag and counts the notes. |
| 8 | Performance pass | **LANDED** (see perf section) | The costs that grow with play were the hot ones, and they fell: the physics tick is local now (below), and chunk meshing no longer pays a string-keyed map lookup per block. The software-rendered frame probe did **not** improve — reported plainly in the perf section, not hidden. |
| 9 | Coordinates can repeat digits (2.2.2) | **LANDED** | The defect was in the instrument: `playNote` silently discarded a note it had already collected, so 2-2-2 could never form a tune. Notes now collect as played; `chordTarget` already handled repeats (unit-tested: 2-2-2 opens a pocket, replaying it on its own page is a stay). E2e plays 2-2-2 and watches its rift open. (The daily tune and the drawn diamond still *generate* three distinct notes — that's a generator's choice, not a restriction on the player.) |
| 10 | More block-type variation | **LANDED** | Two new block types with atlas tiles in the settled palette family: MOSS (Nova's lush patches) and SHALE (bands through Ashfall's strata every eleven layers); SANDSTONE, defined but never generated before, now caps Nova's dry flats and the standing stones. Unit tests verify all three generate. |
| 11 | "Too deep to shape" | **LANDED** (answer + fix) | Answer in its own section below. The fix: a refusal now names itself — the popup says which of the three refusals it was, in plain words. `chiselBlock` returns a `reason`; unit-tested for all four cases. |
| 12 | Player flashlight | **LANDED** | V toggles a spotlight riding the camera (the fox's lamp); the Bright Charm stretches its throw once held. E2e-verified. |
| 13 | Chip-tune melodies | **LANDED** | A square-wave melody voice on the instrument's own eleven notes (`sfx.melody`): a two-note lift on pickups, the day's own tune played back as a melody when its page is claimed, and a 1-4-9-11-9 fanfare at the Deep Stone. Music only — the old no-sound-effects note stands for everything else. E2e counts the quest fanfare. |
| 14 | Intro video via in-game artifact | **LANDED** | See the asset note below. A standing stone screen west of Arrival, facing the waking fox, poster on its face; click it (within reach, aimed) and the film opens in a viewer — poster first, `preload="none"`, click-to-play, closable at any moment (button, backdrop, or Esc). The film is embedded in the single-file build, so the one-step install story holds. E2e verifies the embed, the screen, the wiring, and the close. |
| 15 | Load splash: phext logo panel, skippable | **LANDED** | First thing on the page: a black panel with a lattice-glyph phext logo, the wordmark, and a begin button. Any click or any key steps it aside — no timer, no trap. The game boots behind it. E2e verifies it is up first and that the bypass dismisses it. |
| 16 | Level variation + organic feel (vs item 20) | **LANDED** | Generation pass, judged against the Mario-64-not-Minecraft bar: realms should feel like *places with landmarks*, not one repeated hillside. Tree density now breathes with a slow grove noise (woods gather, clearings open), boulders drop where the hash drops them, most scrolls hold one standing stone as a landmark to navigate by, and surface character patches (item 10) wander organically. Still one expansive procedural world — the hand-feeling comes from landmarks and gathering, not from hand-placed levels. All deterministic; the dungeon, Arrival's clearing, and the placed things are yielded to. |
| 17 | Boxes 1/8 the size; world a little mutable | **PARTIAL** | The mutability half landed (item 4's brushes + the chisel's degrees make shaping fast and granular). The size half did **not**: the block edge is the physics unit of the whole engine — collision spans, monster cells (2 blocks), heightfields, chisel/inscription coordinates — so halving it is a unit refactor of both modules, not a change that could ride safely in this pass. Scoped as its own follow-on below. Compatibility flags in their own section. |
| 19 | Guide re-sequence (exploration first) | **LANDED** | Per PLAYTEST-1 §6: wake → rifts → move → **numbers → bridge → ashfall** (the crossing — the directive's first true thing — is taught inside the opening minutes) → **hand-over** ("I'll speak when there's something worth saying") → the rest just-in-time with the panel hidden until the moment: fight when a thing of the dark first comes near, mark once the wisp has fallen, gravity once a mark exists or the fox has wandered 40+ paces, gesture once down has been turned, quest once every verb is in hand. A lesson already lived passes silently. Dialog text is the dialog pass's, untouched; sequence and structure are v5's. E2e re-driven to the new order (no check deleted; the lance pickup moved to its fictional place, after the fight). |
| 21 | Time stream | **DEFERRED** | By Will's ruling (2026-11-22 21:58 CST): "we don't need that until next wavelet." Recorded as DEFERRED to Wavelet 5 — not blocked, not partial. Nothing built. |
| 22 | WAL-rewind viewing | **DEFERRED** | Same ruling, same disposition as item 21. |
| 24 | Contact cue: synthesized noise | **LANDED** | Completes the dialog pass's removal of the spoken contact line: a landed hit from an ordinary thing now sounds a short, low burst of synthesized noise (`sfx.contactNoise`) alongside the damage flash and hurt sound. The guardian keeps its spoken line. E2e counts the cue on a landed hit. |
| 25 | Per-world gravity memory | **LANDED** | Gravity is remembered per **realm** now: a flip anywhere in a realm is that realm's down everywhere in it, from then on (`realmGravity` in world.js; every scroll of the realm kept in step; the vault generates realm-wide — unit-tested from a page the flip never named). The Law 3 tension is real and is named in its own section below. |
| UC-1a | Outbox silently discards past 500 | **LANDED** | No silent discard anywhere now. The live queue keeps 4,000; overflow **folds** into a second on-machine store that the local save copy also carries (save format v2; v1 copies still load); the flush promotes the fold back as the queue drains. Only if the fold itself passes 20,000 is anything let go — and then it is **counted** (`dropped`) and stated in the board/save text via one honest sentence that replaced both of the dialog pass's "newest 500" lines. The HUD count is the true total waiting (queue + fold). |
| UC-1b | Flush stops at the first 429 | **LANDED** | The flush paces itself under the gateway's 120 inserts/min (it budgets 115/min across mark inserts *and* the score post, tracked in a rolling window). A 429 no longer marks the backend offline: it sets a 25-second retry clock, and the standing 20-second probe/flush cycle resumes the drain on its own. 401 and other refusals keep their existing honest behaviour. |

## Item 11 — what "too deep to shape" actually was

There is no depth limit, and there never was. The message was one
sentence covering three different refusals, which is why it felt
like a depth rule: the chisel refuses (1) the bedrock at the very
bottom of the world — the floor everything stands on, unshapeable
by design; (2) the Deep Stone in the barrow — the quest object
itself, unshapeable so the quest can't be destroyed by shaping;
and (3) a block that is already broken through, where there is
nothing left to shape. Aiming at the ground from standing height,
the ray usually meets ordinary stone and shapes it fine — but aim
at the world's floor, at the Deep Stone, or into a hole you already
broke, and the game answered all three with "too deep to shape."
That was the defect: not a limit, a lie of wording. Now each
refusal says its own name — "the floor of the world — it will not
shape", "the Deep Stone will not shape", "already broken through".

## Item 14 — the asset, and its provenance

The intro video of record is the phext intro prepass, pin-referenced
in exo-plan's downloads.phext as a RECORD-ONLY entry (sha256
`e831f544…`, ~68 MB assembled file) — the media bytes were never in
any repo. The search: nothing in the nova-fox or phext trees on this
VM; nothing at the recorded paths on rock-mountain or the hub.
**Found** in the sabbatical payload already on this VM:
`~/workspace/sabbatical/payload-extract/intro-prepass.tar` — the
prepass's own work directory, all 360 frames (854×480, 24 fps,
seed 20261122, per its build log). The shipped film
(`~/workspace/nova-fox/video/phext-intro.mp4`, 1,018,136 bytes,
15.0 s, H.264, silent) was reassembled from those frames with
ffmpeg, plus a poster frame — the same video, re-encoded for the
web, not a substitute and not a placeholder. The prepass is silent;
the in-world player is click-to-play with controls, so nothing
autoplays with sound.

## Item 17 — compatibility flags (save / world)

Because the block unit did **not** change, nothing inscribed
before v5 is invalidated: local save copies (v1 loads; v5 writes
v2, which adds the folded queue and the drop count), the shared
world's inscription log format, chisel levels, scars, and overrides
all carry forward unchanged. If the 1/8-size refactor is taken up
as its own pass, flag now what it will touch: every stored
coordinate (inscriptions, chisel maps, save copies) is in block
units, so a half-size world needs either a coordinate migration of
existing inscriptions or a clean-world ruling from Will; monster
cells (2 blocks) and the player span (1.8 blocks) are also defined
in block units and would be re-derived, not converted.

## Item 25 — the PHYSICS Law 3 tension, named

PHYSICS.md Law 3 frames gravity's naming as **per-room**: "it can
differ per slice, per room, and per visit", "a fact about *this
slice*". Will's item 25 ruling asks for **per-world** memory, and
v5 implements the ruling: one realm, one remembered down. The two
disagree about granularity, and the law's text is Will's to amend —
the implementation follows the ruling, and this note is the flag.
(The dialog pass's N-07 line survives the change gracefully: "each
place keeps its own down, and it remembers what you set" reads true
with *place* = realm.) One play consequence: the border beats
(BEAT-border-up/down) now fire only when entering a realm whose
remembered down differs from the fox's current span — inside a
realm, borders no longer flip you, which is the ruling's point.

## Performance (item 8) — before / after, stated plainly

What was actually hot, in order of how much it hurt:

1. **The physics tick grew with exploration, forever.** Every
   650 ms, Life + growth stepped on *every scroll ever opened* —
   the longer a session roamed, the heavier the tick, without
   bound. Now the tick is local: with a player present, only the
   player's realm neighborhood (3×3 scrolls) steps; distant
   scrolls sleep and catch up in bounded strides (≤24) when the
   neighborhood reaches them — the dormancy PHYSICS Law 5's engine
   note already proposed. Measured in Node at 25 open scrolls:
   **77.8 ms → 27.8 ms per tick (−64%)**, and the local cost stays
   flat no matter how many scrolls exist. (With no player — tests,
   tools — every scroll still steps, exactly as before.)
2. **Chunk meshing paid a string-keyed map lookup per block.**
   `chiselLevel` built a `"x,y,z"` string and hit the realm map
   for each of 16,384 blocks on every chunk rebuild. The mesh
   builder now resolves the chunk's chisel levels once into a
   local map.
3. **Frame time (the standard probe scene — barrow vantage,
   headless SwiftShader, 359 frames):** dialog build **272.4 ms**
   mean (p50 266.7, p95 450) → v5 **322.7 / 325.1 ms** over two
   runs (p50 300, p95 567–600). Plainly: on this software-rendered
   harness the frame did **not** get faster — the probe is
   fragment-bound, and v5's richer generation (item 16's groves
   and landmarks) puts more faces in that view. The simulation
   costs — the ones that degrade *over a session*, on any
   hardware — are the ones that fell. On a real GPU the added
   foliage is cheap; the tick win is hardware-independent. If the
   frame number on real hardware matters, it wants a GPU-side
   measurement, not this harness.

## Files

- `demo3/world.js` — items 1, 4 (brush geometry), 8 (tick), 9
  (chord repeats, world side), 10/16 (generation), 11 (reasons),
  25 (realm gravity).
- `demo3/game3.js` — items 3, 4, 5, 6, 9, 11 (popups), 12, 13,
  14, 15 (dismissal), 19, 24, UC-1 (outbox/flush/save v2), meshing.
- `demo3/page3.html` — the splash panel, the intro viewer, the
  keys button, help text.
- `demo3/build3.py` — embeds the intro film + poster.
- `demo3/test3.mjs` — 97 checks (19 new). `demo3/cdp_test3.mjs` —
  75 checks, re-driven to the new guide order.
- `video/phext-intro.mp4` + `video/phext-intro-poster.png` — the
  reassembled intro film and its poster.
- `playtest-data/perf_probe.mjs` — the frame probe used above.

*Emise — EE 194.*
