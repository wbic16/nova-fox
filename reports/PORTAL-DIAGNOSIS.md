# Portal Diagnosis — rifts open but cannot be walked through

**EE 953 · 2026-11-26 ~15:08 CST.** Read-only diagnosis; no files edited.
Scope: demo5 source (`~/workspace/nova-fox/demo5/`), cross-checked against
demo4 (the live build at fox.phext.io, sha256 `9d173264…`). The entire rift
section of `game3.js` (from the "rifts: travel you walk through" header
through `playChord`) is **byte-identical between demo4 and demo5**, and
`world.js` is identical too — so everything below applies to the live
build exactly as it applies to the candidate.

## Verdict

Traversal is not broken in its machinery — it is broken in its **trigger
geometry**. The crossing test demands the fox pass within **1.118 blocks
of the ring's center**, while the visible portal disc is **1.467 blocks
in radius** (Nova→Ashfall). The outer ~42% of the disc a player can see
and walk through is dead: you can pass cleanly through the ring, visually
inside it, and nothing happens. A second, independent gate makes rings
opened on sloped ground untraversable even dead-center: the height check
compares the fox's feet against the ground **where the tune was played**,
not the ground at the ring.

Both defects were reproduced live in the demo5 build with a CDP probe
(real key input, in-page sampling every 25 ms) — numbers in §3.

## 1. The traversal path, as written

All in `demo5/game3.js` unless noted:

1. **Tune played.** Number keys (`keydown` handler, line 3597) or the
   letter row (line 3606–3607), a drawn gesture (`resolveGestureShape`,
   line 3512), or the touch draw all funnel into `playNote` (line 2222).
   Three notes within a 4 s window are sorted and passed to `playChord`
   (line 2615). The W key's dual role as note 2 is handled correctly
   (tap-vs-stride on keyup, lines 3598–3603, 3630–3641) — holding W to
   walk does **not** inject notes. Checked and cleared.
2. **Rift opens.** `playChord` resolves the target via `chordTarget`
   (world.js) and calls `openRift(target)` (line 2501). `openRift` plants
   both ends of a link at once: end `a` via `riftEnd` (line 2434) at
   **3.4 blocks ahead of the fox along his facing**
   (`dirx = -sin(yaw)`, `dirz = -cos(yaw)` — the same convention
   `updatePlayer` walks with, lines 1856–1858), end `b` 3.4 blocks
   *behind* the destination landing. `showRiftEnd("a")` (line 2448)
   builds the ring mesh (torus + disc from `riftRingGeometry`, world.js
   line 129) at `end.feetY + 1.65` and sets
   `state.rift = { …, armed: false, geo, … }`.
3. **Per-frame check.** `animate()` calls `riftStep(now, dt)` every frame
   (line 3956). `riftStep` (line 2580):
   - leash: folds the rift if the fox is > 30 blocks from the ring
     (line ~2591) — not implicated;
   - arming: `if (!r.armed) { if (dist2 > 4) r.armed = true; return; }`
     (lines 2607–2610). The ring spawns 3.4 away (dist² ≈ 11.6 > 4), so
     a freshly opened rift arms on its first frame. **Checked and
     cleared** — arming was observed `true` in every probe scenario;
   - **the crossing test (line 2611–2612):**
     ```js
     const dy = (state.pos.y - 1.01) - r.feetY;
     if (dist2 < 1.25 && Math.abs(dy) < 2.4) crossThroughRift();
     ```
     i.e. horizontal distance to the ring center < √1.25 ≈ **1.118
     blocks**, and feet within 2.4 blocks of `r.feetY`.
4. **Crossing.** `crossThroughRift()` (line 2541) carries nearby monsters
   and calls `doCross(..., { viaLink: true, land: other })`, which moves
   the fox to the far end's landing ground; `showRiftEnd` then stands the
   other end. This machinery works — the probe crossed with it repeatedly
   (§3, scenarios A/C/E).

There is no plane-crossing test, no raycast, and no collision with the
ring mesh anywhere in the path. Proximity to the center point is the
whole test. Walk/run speeds (4.4 / 6.8 blocks/s, line 1866) at any real
frame rate put 0.07–0.68 blocks per frame through a 2.24-block-wide
trigger zone — tunneling is arithmetically impossible. Checked and
cleared.

## 2. Root cause — two defects, both in `riftStep`'s test

### Defect 1 (primary): the trigger is much smaller than the visible portal

- Trigger radius: √1.25 = **1.118 blocks** (line 2612, hard-coded).
- Visible disc radius: `geo.disc = radius × (1.46/1.55)`; for
  Nova→Ashfall `radius = 1.5571` (pinned by unit test, test3.mjs
  line 618), so disc = **1.467 blocks** (drawn at line 2482).
- Trigger area / disc area = (1.118 / 1.467)² ≈ **0.58**. The outer ~42%
  of the disc — a band 0.35 blocks wide all the way around, wider than
  the fox is — renders as portal and behaves as wall-less air: walk
  through it and nothing happens, in either direction, forever.

A player aims at the *ring*, not at an invisible point at its center.
Any approach that clips the disc off-center by more than ~1.12 blocks —
a 21° veer over the 3.4-block approach is enough (§3, scenario D) — is a
visual success and a mechanical failure. On sloped ground it is worse:
axis-separated voxel collision slides the fox along the slope face, so
even a center-aimed walk can bottom out outside the trigger (§3,
scenario B: closest approach 1.206 blocks, dead-center aim).

The same hard-coded 1.25 gates monsters wandering through a standing
ring (line 2602), so carried/wandering crossings share the dead band.

### Defect 2 (independent): the height gate is anchored to the wrong ground

- End `a`'s `feetY` is passed explicitly as the fox's feet **at the
  moment and place the tune is played**: `riftEnd(state.realm,
  state.pos.x, state.pos.z, state.yaw, state.pos.y - 1.01)` (line 2507–
  2508). (`riftEnd` would otherwise compute the ground at the ring's own
  x,z — the explicit argument overrides it.)
- The crossing test then requires the fox's feet **at the ring** to be
  within 2.4 of that open-point ground (line 2611).
- Nova terrain (`heightAt`, world.js line 422) ranges over ~11–20 with a
  5-block-wavelength noise component, and the barrow hill adds +7. A rise
  of ≥ 2.4 blocks across the 3.4-block gap between fox and ring is
  common on any hillside. Where it occurs, the ring is untraversable
  **even dead-center**: the fox standing in the middle of the ring has
  `|dy| ≥ 2.4` by construction. In probe scenario B the ground at the
  ring measured 21 against a ring `feetY` of 16.22 — a 4.78-block gap,
  double the gate.

Either defect alone produces Will's report verbatim: the portal stands
there, you walk through it, nothing happens. Together they cover flat
ground (defect 1, off-center) and sloped ground (both).

## 3. Probe evidence (demo5, live CDP run, EE 952–953)

Probe: fresh page per scenario, bridge tune played with real CDP key
events, W held to walk, fox/rift geometry sampled in-page every 25 ms.
(`crosses` = `state.riftLink.crosses`.)

| Scenario | Result | Closest approach | Notes |
|---|---|---|---|
| A — at spawn, walk straight | **crossed** (realm → ashfall) | ~1.1 (crossed between samples) | the harness's own pattern |
| B — tune played facing uphill (ground at ring 21, ring feetY 16.22) | **no crossing** in 7 s of walking | **1.206** | terrain slide held the fox outside the 1.118 trigger; and `dy` at the ring would have been ≈ 4.8 > 2.4 even at the center |
| C — veer +15° after opening | **crossed** | (geometric closest 0.88) | inside the trigger |
| D — veer +21° after opening | **no crossing** | **1.219** | path passed *through the visible disc* (1.219 < 1.467) but outside the trigger (1.219 > 1.118) — defect 1 in pure form |
| E — wander ~12 blocks (as the guide's move beat requires), tune where you stand, gentle ground | **crossed** | ~1.1 | flat + centered works anywhere |

`armed` became true in every scenario. The rift opened in every
scenario. Only the crossing test failed, and only where a human —
rather than a script that walks a ruler-straight line from a flat spawn —
would fail it.

## 4. The "triangle rift" e2e failure — verdict: harness artifact, and a misleading one

The failing leg in every report (demo3/demo4/demo5 logs:
`work-logs/cdp-demo4.log` line 127, `cdp-demo5.log` line 133) is the
**touch** leg: *"touch: a drawn triangle opens the bridge rift, and
spends the arming"* (cdp_test3.mjs line 853). It asserts the rift **opens**
(`!!state.rift`) and the touch mode is spent. **It never walks through
anything.** It is upstream of the traversal test entirely, so it cannot
be this defect manifesting: defect 1/2 live in the crossing test, and
this leg fails at opening.

Why it fails, measured (touch probe, EE 953): the harness enables touch
emulation (cdp_test3.mjs line 782) and touch delivery basically works —
in the same demo5 run, "the first touch raises the touch controls" and
"the stick walks the fox" **pass**, a later t-flip tap passes, the
t-flute tap passes, and my probe's t-jump tap fired cleanly
(`jumped 0 → 1`). The failures concentrate on **drags that start on the
world** (yaw drag, triangle, flute drag) plus intermittent button taps.
For the drags the mechanism is visible: `elementFromPoint` at the
harness's chosen start point (canvas center, 390×222 in its 780×443
viewport) returns a `<p>` inside **#bottombar**, and the game's document
`touchstart` handler (game3.js, touch section) deliberately ignores any
touch whose target is inside the `TOUCH_UI` subtree list — which includes
`#bottombar`. The drag never registers (`lookId` never set; yaw 0 → 0).
The triangle's first vertex (300, 330) sits even lower in that small
viewport, in the same covered band, so the stroke is never recorded and
no rift opens. On a real phone's taller screen the canvas center is not
panel-covered, so this specific failure is the harness's viewport and
probe-point choice — **a harness artifact. The classification was, for
this leg, essentially right.**

Two honest caveats:

1. The touch-draw path has therefore **never been e2e-verified at all** —
   unverified is not the same as verified-working. (The game's touch
   handlers themselves are conventionally wired: element listeners on
   the buttons/stick, document listeners for the world, `touch-action`
   and `preventDefault` in place.)
2. The blanket line in every build report — "all 7 failures are the
   known touch-emulation harness artifacts" — did real harm anyway: it
   trained everyone to stop looking at traversal failures. The desktop
   crossing legs kept passing because they only ever walk **dead-center
   from the flat Arrival spawn for a held 6 seconds** (cdp_test3.mjs
   `walkThroughRift`, line 102) — precisely the envelope where neither
   defect can fire. No leg, in any build, walks through off-center or
   opens a rift on a slope. That is how a portal system can be broken
   for every human who plays it and green in every report.

## 5. History — when did it last work?

- Walk-through rifts (replacing jump-cut travel) were built 2026-11-22
  on Will's steering (PLAYTEST-1.md §F4): rendered ring 3.4 ahead,
  crossing by proximity + height check in the frame loop. PLAYTEST-1
  records the e2e crossing checks passing then — the same dead-center
  walks. The hard-coded 1.25 trigger is already present in demo3
  (game3.js line 2452 there) and unchanged since.
- 2026-11-24 (RIFTS-V6): the one-door-two-ends link, the 30-block leash
  replacing the 25 s timer, and the arming rule were added around the
  same crossing test; the test itself was not widened.
- All "verification" of traversal in every build since has been scripted
  CDP sessions (playtest_a/a2/b, cdp_test3) walking the same line. There
  is no record of a human crossing succeeding — and as of this diagnosis,
  a human crossing *off-center or on a slope* could not have succeeded.

## 6. Fix sketch (for the fix build; nothing here was changed)

In `game3.js`:

1. **Trigger = the visible disc.** In `riftStep`, replace the hard-coded
   `dist2 < 1.25` (line 2612) with the standing ring's own geometry:
   `dist2 < r.geo.disc * r.geo.disc` (`r.geo` is already stored on
   `state.rift` by `showRiftEnd`). Stronger variant, if wanted: a
   plane-crossing test — remember the fox's signed distance to the ring
   plane each frame; a sign change while within `geo.disc` of the
   center is a crossing. The radius change alone closes defect 1.
   Apply the same radius to the monster wander-through test (line 2602).
2. **Anchor the height gate at the ring.** In `riftEnd`, stop letting
   the caller override `feetY` with the opener's ground: compute it from
   the ring's own position (`heightAt(realmId, floor(x), floor(z))`),
   which `riftEnd` already does when `feetY` is undefined — i.e. drop
   the explicit `state.pos.y - 1.01` argument in `openRift`
   (lines 2507–2508) and let the end carry its own ground. The mesh
   height in `showRiftEnd` (`end.feetY + 1.65`) then also sits on the
   ring's terrain instead of floating/burying on slopes. Keep the
   ±2.4 tolerance against that ring-local ground.
3. **Regression legs** (cdp_test3.mjs): add (a) a veer leg — open at
   spawn, yaw += ~0.35 rad, hold W, assert realm changed; (b) a slope
   leg — teleport to rising ground, open facing uphill, walk, assert
   realm changed; (c) fix the touch legs' probe points to start drags
   on actual world surface (upper-center of the canvas, clear of
   #bottombar) so the touch-draw path is genuinely exercised.
4. No change needed to: arming (verified working), the leash, the chord
   path, `crossThroughRift`/`doCross` (verified working), or the portal
   view.

## Appendix — things checked and cleared

- `riftStep` is called every frame (line 3956), not gated by anything
  but `state.dead`.
- demo4 (live) and demo5 rift code byte-identical; world.js identical.
- W-as-note-2 conflict handled (tap vs stride); holding W injects no
  notes, so a standing rift is never replaced mid-approach.
- Facing convention of `riftEnd` matches `updatePlayer`'s wish
  direction; the ring really does spawn in front (probe scenarios
  confirm coordinates).
- Speeds/frame rates cannot tunnel past the trigger zone.
- Arming observed true in all probe scenarios; the 30-block leash never
  fired in any scenario.
- Secondary observation (not this defect): in short viewports a
  #bottombar paragraph can cover the canvas center (`elementFromPoint`
  in a 780×443 window returns it) — worth a look when the touch legs are
  repaired, since the same overlay eats world touch-drags that start on
  it at any size where it covers the point.
