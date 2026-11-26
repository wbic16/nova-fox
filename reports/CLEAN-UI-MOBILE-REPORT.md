# Nova Fox — clean UI, mobile play, and the unwatched tab (2026-11-26)

Will's three directions, given 2026-11-26 08:51 CST, built the same
morning into the demo3 line:

1. "audio should stop when the tab isn't active"
2. "mobile needs a way to play"
3. "the ui needs to be clean, move all of the distractions to
   optional components"

Built file: `demo3/index.html`, 4,871,559 bytes,
sha256 `6c48e82c145b68324781fa8be87a966ae715b424761032c0f136dabe4c6babec`.
**Not deployed anywhere** — no awsbox staging, no go-live; the
build and this report are the whole output, per the brief.

## Where the tree stood before this pass

The shipped portals + palettes build (see PORTALS-PALETTES-REPORT.md)
is 4,841,893 B, sha256 `e76963d1…`, unit 107/107, e2e 84/84. The
working tree has moved since (the Rifts legs): before this pass it
built byte-for-byte to sha256 `36f106da…` with **unit 127/127** and
**e2e 96/97** — the one e2e failure pre-existing on the untouched
tree, named here so it is not laid at this pass's door:

- FAIL "the near monster crossed and now lives in Ashfall,
  Nova-born" (the monster-carry leg of the Rifts door section).

## 1. The unwatched tab — audio stops

Every sound the game makes stops when the tab is hidden — stopped,
not muted-while-playing:

- **The voice holds.** `narration.hold()` pauses the speaking
  element, rewinds it, and returns its beat **whole to the head of
  the queue** — the same rule the queue already keeps for a beat
  the browser refuses (see THE LOCK in game3.js). On return,
  `release()` pumps the queue and the beat speaks **from its
  start, never mid-line**. Its original trigger time rides along,
  so an event beat that went stale while the tab was dark is still
  let go by the pump's age filter; the guide's spine never expires,
  as ever. Beats triggered while held simply queue, like beats
  before the first gesture.
- **The engine's clock freezes.** `sfx.ctx.suspend()` halts the
  WebAudio clock — the wind loop, its LFO, and every scheduled tone
  stop where they stand. On return the context resumes, but only
  if this hold was what suspended it (`sfx.heldSuspend`).
- **The Arrival film pauses**, and resumes on return only if the
  hold was what paused it (`filmHeldPause`) — a film the player
  paused themselves stays paused.

The triggers are `visibilitychange` plus `pagehide`/`pageshow`,
both idempotent. The render loop already halts in a hidden tab
(rAF) and its `dt` is clamped, so game time needed no change.

## 2. Mobile — a complete way to play

Every required input was inventoried from the code first. The
keyboard/mouse own: two movement schemes (WASD / AWEF) + arrow
walk and step-turns, pointer-lock mouse look, Space jump, Shift
run, the strike (click / F), the chisel (click-fallback / C / X),
brush size (, / .), gravity flip (G), lamp (V), the instrument
(11 note pads — already tappable DOM), the mouse gestures
(right-drag shapes), the spectral flute (Shift+drag), the panels
(B / M / L — buttons already exist for board, realms, Emise and
the keys/sound toggles), the guide's own buttons, and Escape for
the film viewer (which has its own close button). The touch layer
covers all of it, in the game's own idioms:

- **The stick walks.** A virtual stick (lower left) presses the
  active scheme's own key codes into the same `keys` set the
  keyboard fills, so both schemes, the physics, and the guide's
  `until()` conditions work untouched.
- **A drag on the world looks**, with the mouse path's own math
  (gravity-signed, same pitch clamp) at a touch's shorter throw.
- **A tap on the world is the click**: the memory screen if that
  is what you face, a strike if a dark thing is in reach, the
  chisel otherwise — the mousedown path's rule, shared verb for
  verb (`doJump()` was likewise lifted out of the Space case so
  keyboard and button are one verb).
- **Round buttons** (lower right) carry jump, strike, chisel,
  flip, run (hold), lamp, brush − / +.
- **DRAW arms the second instrument**: the next drag on the world
  is a stroke, classified by the same recognizer and resolved by
  the same path as right-mouse drawing (`resolveGestureShape()`,
  extracted from the mouseup handler so a shape means the same
  thing however it was drawn).
- **FLUTE arms the spectral flute**: the next vertical drag sounds
  the notes it crosses, through `playNote`, using the mouse
  flute's own band arithmetic.
- **A log button** joins the bottom-right row, giving the L
  readout a touch path like the other panels.

The layer shows only on touch devices — a coarse pointer
(`@media (pointer: coarse)`) or `body.touch` once a real touch is
felt — and no handler touches a mouse or keyboard event, so
desktop play is undisturbed. World touches are claimed by
exception (anything outside the interactive subtrees — the touch
layer, the bars and panels) rather than by naming the canvas, so
the drag surface is the whole screen on real devices.

## 3. Clean UI — distractions become optional components

The default view now keeps only what play requires: the crosshair,
hearts + HP + realm name, the objective line, the chord display
and inventory line, comms, the guide panel, the instrument, the
bottom-right toggles, and the transient elements (damage vignette,
portal flash, hat brim, ward line, damage numbers, the realm
crossing card).

Behind one toggle — **extras**, in the bottom-right row, off by
default and persisted in the existing `nova-phox-controls`
preferences — sit the optional components: the key wall (#help),
the portrait, the standing realm title (#realm-big), and the
quest, score and sync lines. **Nothing was deleted**; it all moved
behind the toggle, and the harness's text reads of those lines are
unaffected (it reads `textContent`, not visibility).

## Tests

- **Unit** (`node test3.mjs`, world.js + the WASM core):
  127/127 before, **127/127 after** — on the final built tree.
- **E2E** (`node cdp_test3.mjs`, headless Chromium, SwiftShader):
  26 checks added — 7 clean-UI, 8 unwatched-tab, 11 touch —
  for 123 total. No existing check was edited or removed; the
  only change to an existing flow is a drain-wait added before
  the new visibility section (below).

**Verification state — read this plainly.** The full suite ran
green-adjacent once against this pass's first build
(sha256 `cc67d3b8…`): **112 passed, 11 failed, zero console
errors**, with every pre-existing check behaving exactly as in
the untouched-tree baseline (including the same single
pre-existing monster-carry failure). Of the new checks: clean UI
passed 7/7; the unwatched tab's engine and film legs passed
(ctx suspended on hide, running on return; film paused on hide).
Two groups failed **in the harness**:

- The narration legs: the test beat did not begin speaking inside
  its 10 s window (the suite's road leaves beats queued ahead of
  it; the film-resume leg then failed downstream, the 15 s film
  ending during the burned waits). Fix applied: the test now
  drains the voice to rest (up to 90 s) before the hold sequence.
- Most touch legs: the stick walk and the flute-arm tap passed;
  canvas drags and several button taps did not take effect under
  CDP touch emulation (the tap pattern is consistent with
  hit-points landing one button-cell off under emulation, and
  touchmove delivery differing from real devices). Fixes applied
  in response, all genuine real-device improvements regardless:
  world touches claimed by exception instead of by canvas
  identity, and `touch-action: none` on the canvas itself.

**The re-run that would settle both groups is blocked, and the
block is named, not smoothed over:** from ~15:05 UTC the
harness Chromium refuses to start at all —
`Hatch WebGL domain policy is required for browser startup` —
for the suite's exact spawn and for minimal spawns alike, across
15+ attempts over ~35 minutes (the baseline and the pass above
ran on the same build hours earlier). The final built file
(`6c48e82c…`) therefore carries the fixes **unverified by the
e2e suite**; its unit suite is green. To finish the verification
when the browser policy is back:

```
cd ~/workspace/nova-fox/demo3 && node cdp_test3.mjs
```

Expected when healthy: 123 checks, the only failure the
pre-existing monster-carry one named above. The probe scripts
used during diagnosis are kept in `~/workspace/nova-fox/work-logs/`
(`probe1.mjs`, `probe2.mjs`, run logs `cdp-baseline.log`,
`cdp-pass2.log`).

## Design forks, flagged per the brief

- **Guide and narration text stays keyboard-worded on touch**
  ("Walk with W A S D", "press G"). The text panel and the
  recorded voice are one beat in two forms; rewriting the text
  without re-recording the voice would split them. The touch
  buttons carry the verbs instead; the wording question is
  Will's to settle.
- **Touch draw/flute are tap-to-arm, one-drag verbs**, where the
  desktop holds a modifier (right mouse, Shift) through the drag.
  One finger cannot hold and drag at once; arming is the faithful
  one-finger form of the same verbs, and the armed button lights
  while it waits.
- **The interrupted beat replays from its start** rather than
  resuming mid-line — the game's own narration model (the
  refused-beat rule) pointed that way, per the brief's direction
  to follow the existing design.
