# Nova Fox — Playtest 1

**When:** 2026-11-22, ~20:37–21:25 CST (EE ~178–186). **Order (Will, 20:33):** "take it through some game design play-testing, it just isn't fun yet."
**Directive (DESIGN.md, Will 17:09):** above all else the game must be fun to play and result in +1 phext XP — the guide must force two experiences in order: (1) play a 3-number chord and get taken somewhere; (2) make one mark that stays while the world shifts.
**Method:** scripted player over CDP (real keyboard/mouse events, fresh profile per session), plus source reading. Harness rendering is SwiftShader (software): absolute FPS (1–5) is a floor artifact of the harness, not the game on real hardware — but wall-clock events, WAL records, HP/death counts, and *relative* trends are real evidence. Harness assists (debug teleports) are counted and disclosed per session; the play itself never used them except where a leg timed out.
**Builds:** diagnosis ran on the narration build `2c4e81fc…`; the narration-glitch build landed mid-pass (`0f0eb3a9…`, re-verified before any edit: unit 78/78, e2e 54/54). Phase 2 fixes were applied on top of it. Final build: **`646497e4…`** (see §7).

## Steering record (verbatim, Will 2026-11-22)

20:35:
- "there's way too much to learn, not enough exploration"
- "more like Mario 64 than Minecraft, but still expansive"
- "full use of multiversal time travel"
- "focus on the time stream in addition to teleportation rifts"
- "render ports for the rifts, don't just jump - actually render the rift and let the player walk through"

20:53 (evidence item):
- 'avoid repeated audio clips - "it reaches you out of the dark" should just be a noise'

20:54 (design correction):
- "gravity should be remembered per world - don't select worlds with 3 coordinates, just draw the portal with the mouse"

## 1. Session timelines

### Session A — the first five minutes, guide followed in order (build 2c4e81fc)

| t (s) | Event |
|---|---|
| 4.1 | Boot interactive; spawn Nova Prime (8.5, 18, 8.5), HP 20 |
| 7.8 | Move beat starts — **0.8 s of clicking through two text beats before movement is even taught** |
| 8.6 | First movement |
| 11.5 | First jump |
| 14.8 | Move beat done (moved 7.6, jumped 1) |
| 17.0 | First monster encounter (training wisp, found by walking east) |
| 19.5 | **First fight won.** WAL gains `scar` — silently; nothing in the game points at it |
| 21.5 | First note (numbers beat) |
| 23.2 | **First chord travel** — 1·4·9 pressed as dictation; crossing is a full-screen flash + instant realm swap, 1.6 s from first key |
| 29.9 | Crossed home (same tune, same jump-cut) |
| 31.2 | First gravity flip; landed on the ceiling (y=42.4), restored cleanly |
| 44.8 | First gesture travel (drawn triangle) |
| 47.2 | **Guide complete** (quest beat reached). All 11 beats done in ~45 s of compliant play |
| 47–137 | Quest leg: walking to the barrow (45.5, 31.5) **timed out at 90 s**, walker at (12.2, 10.9) — assist #1 (teleport) |
| 145–240 | Descent reached y=11.3, then repeated deaths: WAL ends with **38 `contact` ops and 6 `return` (death) ops**; quest never completed; HP 4, score 490 |

### Probe P — can a walking player reach the first quest objective? (build 2c4e81fc)

- Flat-ground pace under harness load: **0.75 units/s** effective (game-time runs at ~30% of wall time at harness FPS — see leak L6; design speed is 4.4 u/s walk / 6.8 Shift-run, and *the guide never mentions Shift*).
- Trek to the barrow with jump-when-stuck (what a human does): **failed after 151 s**, ending at (22.3, 17) — barely halfway — with HP drained 20 → 4 by monster contacts en route.

### Session B — systems (build 0f0eb3a9)

- **Chisel pacing:** 3 strokes per block, ~0.8 s/stroke at harness cadence; a 2×2 patch = 12 strokes in 11.4 s. Works exactly as designed — and the design is a grind for anything larger than a hole (Will's #4, directionally confirmed by measurement).
- **Monster watch — 7 minutes of pure flight, never fighting:** monsters alive 17 → 24 as scrolls grew 18 → 25; **the alive count never decreased once; dead records 0 throughout** (nothing died; nothing ever leaves). The fleeing player **died at t≈52 s and t≈184 s** and spent most of the watch at 2–6 HP. Flight does not shake pursuit.
- **Variation:** Session B's Ashfall leg did not execute (harness design gap — the snapshot ran in Nova; stated plainly). Realm-variation evidence therefore rests on Session A + screenshots + source: Nova and Ashfall arrivals are near-identical compositions — same dark terraced voxel geometry, palette-nudge difference; the "ash and red rock" of the narration is not what the render shows (screenshots A-01/A-03).
- **Performance:** B held 3–5 fps (SwiftShader floor) over 7.5 min at 25 scrolls; A degraded 5 → 1–2 fps over 4 min (dungeon + cross-realm chunk building in play). Inconclusive as an absolute; the growth coupling in L6 is the structural point.

### Audio repetition evidence (Will, 20:53 — recorded, not fixed; narration is a separate pipe)

- In Session A the spoken contact line ("It reaches you out of the dark.") was triggered **38 times** — once per landed hit — concentrated in the death-loop phase: roughly one trigger every ~2.5 s for over a minute and a half, on top of 6 death returns.
- Source-level aggravator (game3.js, pre-fix): `playBeat(BEAT-contact)` fired on **every contact attempt**, including attempts the invulnerability window or the ward turned aside — the trigger design invites the repetition Will heard. Phase 2 fixed the *gameplay* side of this (F2: the beat now fires only when a hit lands, and a turned-aside monster still recoils instead of camping and re-triggering). The line-to-noise change itself is a narration-pipe decision and was **not** implemented here, per instructions.

## 2. The ranked fun leaks

Ranked by (fun damage × fix confidence). "Fixed" = addressed in Phase 2 (§5).

**L1 — Exploration is punished, not rewarded. (Severe · high confidence · FIXED, F1+F2)**
Monsters homed on the player with **no range limit** (world.js tick: every alive monster in the realm steps toward the player every 650 ms), spawned on ~70% of newly created scrolls, and **never despawned** — so every step of exploration permanently enlarged a converging horde. Evidence: B's watch (2 deaths under pure flight; alive count monotonic 17→24, never down); A's quest phase (38 contacts, 6 deaths); the probe (HP 20→4 just walking to the quest). Mario 64's worlds are safe to wander; this one taxed wandering with death. Will's feedback #1 ("monsters don't despawn") is the same leak seen from the player's side.

**L2 — The guide is a conveyor: instruction is 100% of the opening, exploration 0%. (Severe · high confidence · partially fixed, F3)**
Measured: a compliant player finishes all 11 beats in **~45 seconds**, having been taught **nine mechanics** (move, fight, lance, numbers, chord, realm-crossing, gravity, gesture, quest) and read **~750 words** of guide text — before one second of self-directed play. The screen agrees: in the spawn screenshot the 3D world occupies roughly a sixth of the frame; HUD, comms panel, guide panel, help strip and the 11-key instrument bar own the rest. Will's steering line is exact: too much to learn, not enough exploration. The beats are individually good; the *sequencing* is a lecture. (What Phase 2 could honestly do in one pass: add the missing mark beat — F3. Re-sequencing the guide so discovery teaches — cross first, fight/gravity/gesture just-in-time — is scoped in §6.)

**L3 — The directive's second experience was never staged. (Severe for the XP clause · high confidence · FIXED, F3)**
The mark-that-stays moment — half the prime directive — happened at 19.5 s in Session A *where nobody was looking*: the wisp's scar was written to the WAL silently, the guide never names it, never asks the player to look at it, and the chisel (the deliberate mark-making tool) **was never taught anywhere in the guide** — its only mention is one line in the bottom help strip. A player could finish the guide having never made a mark on purpose.

**L4 — Crossing was a jump-cut, not a rift. (Severe per steering · high confidence · FIXED, F4)**
"Rift" existed only as narration text. `playChord` ran a 0.9 s full-screen flash and swapped realms instantly — the game's supposed peak moment (movement is addressing!) read as a loading screen. Distance from the steering when measured: **total** — no rendered rift object existed anywhere in the build. Smallest real step: §4.

**L5 — The first expedition collapses. (Severe · medium-high confidence · NOT fixed — now the biggest remaining leak, §8)**
The guide's payoff is "go east to the barrow" — and a walking player cannot reasonably get there: two independent 90 s walk timeouts (A, A2), a 151 s probe failure, and a deep-room phase that became a respawn loop (A: 6 deaths; A2: 5 deaths, ~40 contacts, quest still uncompleted by the scripted player in both sessions). Causes stack: world scale vs pace, terrain friction, and a vertical difficulty spike at the guardian. The e2e suite completes the quest only via debug teleport — the honest walking route is unproven by any test.

**L6 — Frame-time coupling: below ~10 fps the world outruns the fox. (Medium · high confidence · diagnosed, not rewired)**
Player physics integrates `dt` clamped to 0.1 s (game3.js animate), while monsters/Life tick on a 650 ms **wall-clock** interval. At 60 fps both clocks agree; at harness FPS the player moves at ~30% speed while the world ticks at full rate (probe: 0.75 u/s effective). On real hardware this mostly hides — but any jank (Will's #8, "hyper optimize performance") is paid for in *relative monster speed*, the worst currency. Rewiring both onto one clock is an architecture call, not a playtest fix; scoped in §6.

**L7 — Realms read as the same place in a different tint; shaping is a grind. (Medium · medium confidence · proposal only)**
Screenshots A-01/A-03 + B: same terraced geometry everywhere; per-realm difference is palette and weather text. Chisel: 3 strokes/block measured (§1B) makes "shaping" a chore past a single hole — Will's #4/#16. Both are generation/content work, held with the feedback list.

## 3. Instruction vs exploration — the first five minutes, measured

Session A, compliant play: **0:00–0:47 — 100% instruction execution** (9 mechanics, ~750 words presented, every action dictated by the current beat). 0:47 onward: the first self-directed act the game asks for is the quest walk — which failed (L5). **Exploration in the first five minutes: effectively zero seconds** — not because the player refused, but because the design never leaves a gap for it, and its first expedition is unreachable. After Phase 2 the ratio is unchanged in shape (the mark beat adds ~2 s of *doing*, not reading) — the re-sequence in §6 is the real fix and is deliberately a proposal, not a smuggled change.

## 4. Rifts — distance, and the smallest real step (implemented)

**Before:** no rift object existed; chord/gesture → flash → instant swap.
**Now (F4):** a played tune — number keys *or a drawn gesture* (both route through `playChord`, which is exactly Will's "just draw the portal with the mouse" correction) — **opens a rendered rift 3.4 units ahead of the fox**: a Tron-cyan ring (palette v4 colour, no palette change) standing in the world, its disc tinted with the destination realm's colour, slowly turning, pulsing. The toast names the destination ("A rift opens — Ashfall Haven. Walk through."). **The crossing happens when the fox walks through the ring** (proximity + height check in the frame loop → the existing crossing logic, moved intact into `doCross`). Uncrossed rifts fold shut after 25 s. Evidence it works: e2e checks "the bridge tune opens a rift — it does not jump-cut" and "walking through the rift crosses" pass for keys *and* for the drawn triangle; Session A2 crossed both ways through rifts; screenshot RIFT-02 shows the ring standing in the meadow.
**Still missing, stated plainly:** the disc is a *tint*, not a see-through view into the destination. True portal rendering (render-target of the arrival neighbourhood — the generation machinery, `ensureNeighborhood`, already exists) is the next step, scoped in §6. Also observed: at the bridge beat, the guide panel covers the centre of the screen, so the rift's first-ever opening is half-hidden behind the panel teaching it (screenshot RIFT-01) — the panel should minimise while a rift stands; named, not implemented.

## 5. Fixes implemented (Phase 2, on the glitch build 0f0eb3a9)

- **F1 — Monsters haunt ground; they no longer hunt globally** (world.js `tick`). Within a 48-cell haunt (~1.5 scrolls) a monster steps toward the player as before; beyond it, the monster drifts back to where it rose and rests there. Nothing is removed (Law 11 holds); dead-record reaping was *not* added (named in §6). The radius was set by evidence both ways: 24 cells broke two unit tests (a monster a full scroll away is established to still be coming — the press-in test), 48 passes 78/78. *Feedback-list overlap: item #1 (monsters don't despawn) — the felt half (endless convergence) is fixed; the record half is named, not done.*
- **F2 — The contact line is for hits that land** (game3.js `checkMonsterContact`). The spoken beat and the WAL `contact` op now fire only when HP actually drops; a turned-aside monster (ward/invulnerability) still recoils 3 steps instead of camping on the fox and re-triggering every frame. Directly cuts the repetition counted in §1 from the gameplay side. *The audio change itself (line → noise) was explicitly out of scope and not made.*
- **F3 — The guide now stages the mark** (game3.js `GUIDE`). New beat `mark` between `fight` and `numbers`: "Look at the ground where the wisp fell. The scar is still there…" then teaches the chisel (C, three strokes) and completes only when a `break` op is written — the player *makes* a mark that stays, on purpose, as the directive orders. Session A2: `first_mark` at 21.7 s.
- **F4 — Rendered walk-through rifts** (game3.js: `openRift`/`closeRift`/`riftStep`/`doCross`; bridge beat text updated). See §4. Gestures inherit it (triangle/diamond route through `playChord`); the circle (home to Arrival, same page) still carries instantly — it is not world selection. *Feedback-list overlap: none numbered — this is the 20:35/20:54 steering, implemented as directed.*
- **Tests updated to the new intended behaviour** (cdp_test3.mjs): mark-beat + chisel-break checks; rift-open checks (keys and drawn triangle); walk-through steps after every tune. No check was deleted; four were added.

**Deliberately NOT implemented:** the rest of the 18-item feedback list (held for the others' feedback round, per Will 20:27) — including brush-size shaping (#4's full ask), click-to-chisel (#3), control remapping (#5), flashlight (#12), textures (#2), box size (#17). Per-world gravity and time travel: scoped below, not built.

## 6. Scoped, not built

**Time stream — the smallest playable slice.** The physics already holds the machinery: Law 9 (time is a sequence of states), Law 11 (nothing is ever lost); world state derives from snapshot + WAL segments, and chunks already re-derive when generation signatures drift. Smallest slice: **WAL-rewind viewing on the current scroll** — hold a key (suggestion: T) and the place you're standing in re-derives at an earlier WAL cursor: your scars, breaks and inscriptions vanish in reverse order as you scrub back, Life replays from the segment state, and releasing the key returns you to "now" — nothing written while viewing. That is playable in the existing engine (view derivation is already a function of state + cursor), teaches the deepest phext idea in the game (the written record *is* the world's past), and needs no new world model. The full multiversal version — yesterday-shelf worlds as visitable, still-living places (Law 9's own proposal; G40 still open), and rifts *in time* drawn with the same gesture as rifts in space, tinted by era — is the design proposal that follows from it.

**Gravity per world (Will, 20:54).** Current state, verified in code: gravity is remembered **per scroll** (each scroll's inscribed `gravDir` persists; the player adopts the local scroll's law on entry — `updatePlayer` sync). The correction asks for **per-world** memory: a flip should be the *world's* remembered down, coherent across the realm and restored on return visits. Named tension: PHYSICS.md Law 3 currently frames gravity designation as *per-room arithmetic* — the correction and the law disagree, and the law should be amended with the ruling, not silently. Not implemented here: it is a world-state model change (world.js `gravityOf`/`flipGravity` keying) with a physics-law conflict attached; it wants Will's eye on the Law 3 wording.

**Guide re-sequence (the L2 fix).** Proposal: teach *crossing first* (wake → move → numbers → bridge: the directive's moment 1 inside the first minute), hand the game over ("explore — I'll speak when there's something worth saying"), and teach fight, mark, gravity and gesture just-in-time at their first natural occasion (first monster glimpse, first return to the scar, first ceiling). Target: instruction ≤ 25% of the first five minutes, exploration ≥ 50%.

**Also named, not built:** Life/growth tick cost grows with every scroll ever created (all realms tick every 650 ms forever) — Law 9's lazy catch-up (tick the active neighbourhood; distant scrolls catch up on entry) is the principled fix and pairs with F1's locality. Dead monster records accumulate in the array forever (memory hygiene; safe to reap once folded into the scroll's text — needs a design word, since monsters are rewrites). Guide panel should minimise while a rift stands (§4). Quest route needs a reachability pass (pace vs distance vs the guardian spike — L5).

## 7. Verification

- **Gate (before edits, on glitch build 0f0eb3a9):** unit 78/78 · e2e 54/54 · 0 console errors.
- **After fixes:** unit **78/78** · e2e **58/58** · 0 console errors (both suites, final build).
- **Session A re-run (A2)** — before/after:

| Milestone | Before | After |
|---|---|---|
| boot interactive | 4.1 s | 4.2 s |
| first movement | 8.6 s | 10.1 s |
| first jump | 11.5 s | 12.6 s |
| first monster encounter | 17.0 s | 16.7 s |
| first fight won | 19.5 s | 19.3 s |
| **first mark made (taught, deliberate)** | **never** | **21.7 s** |
| first note | 21.5 s | 23.7 s |
| first chord travel | 23.2 s (jump-cut) | 31.7 s — **rift open 1.7 s after first key; crossed by walking through, 8.0 s key-to-crossed** |
| crossed home | 29.9 s | 44.0 s (rift walk) |
| first gravity flip | 31.2 s | 44.9 s |
| first gesture travel | 44.8 s (jump-cut) | 81.5 s (drawn rift + walk; includes a 20 s ceiling-landing timeout that session — the same landing passes in e2e on this build; flagged as variance, not explained away) |
| guide complete | 47.2 s | 90.0 s |
| quest | failed (1 assist, 6 deaths) | failed (2 assists, 5 deaths) — **still the open wound, L5** |

- **Build:** demo3/index.html sha256 **`646497e434c29fbcc26e8c8241e6baa8f733d1d82b7b47131c37b7f6cf7bc584`** (3,437,109 B), from game3.js `bccc2022…`, world.js `b41a92ee…`.
- **Staged:** awsbox `~/fox-phext-launch/site/index.html` via the hub route (VM → aletheia-core → awsbox); **sha256 verified on the box: `646497e4…` — match.** The live webroot was not touched; Will's sudo install carries it, as with prior builds.
- Evidence files: `playtest-data/sessionA.json`, `sessionA2.json`, `sessionB.json`, `probe.json`, screenshots `A-01…A-05`, `A2-01…`, `B-01/B-02`, `RIFT-01-open.png`, `RIFT-02-open.png`; scripts `playtest_a.mjs`, `playtest_a2.mjs`, `playtest_b.mjs`, `playtest_probe.mjs`, `rift_shot.mjs`.

## 8. Verdict — is it fun yet?

**Not yet — but the two moments the game exists for are now real.** Before this pass, neither of the directive's experiences actually happened to a player: the chord was a loading flash, and the mark was a silent log entry. Now a new player *makes a mark that stays* at ~22 seconds, on purpose, knowing what it is — and at ~32 seconds *walks through a standing rift* into another world. Those are the game's two best seconds, and they finally exist.

What still isn't fun is everything around them: a lecture where the exploration should be, and a first expedition that collapses before it starts. **The single biggest remaining leak is L5 — the barrow quest, the game's first "go explore" payoff, is effectively unreachable on foot** (two sessions, two walk timeouts, death loops at the stone). The guide now ends by pointing east at a promise the world doesn't keep. Fix that route — pace, terrain, and the guardian spike as one reachability pass — and re-sequence the guide (§6), and the game Will described at 20:35 starts to exist: authored spaces, safe to wander, dangerous where they should be, with rifts you walk through and a past you can revisit.

*Playtest 1 — completed EE 186.*
