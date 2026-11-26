# Nova Fox — warp text: "GRAVITY INVERSION!!"

EE 963 (built EE 961–963, 2026-11-26) · Will's feature, verbatim (15:55 CST):
'"GRAVITY INVERSION!!" 2-4x WARP TEXT {feat: warp text uses the announcement
method — big, prominent, and helpful}'.
Tree: **demo18**, a copy of demo10 (the completed gravity-in-subspace build).
Not staged, not deployed. demo10 and demo5 verified untouched at the end
(demo10 index.html sha256 `6ab734a0…` as the gravity report left it;
demo5 `98207789…`).

## The announcement method used

The game's announcement method is the **intro card** (`#introcard`, driven by
`startIntro` in game3.js): how the world presents a big event — a centered
Georgia-serif name between two cyan rules, shown with a held animation
(`introin`, 2.1 s), the world dimming around it. It announces the monster
first-appearances ("THE KEEPER OF THE DEEP ROOM"). The alternatives are not
announcements: `toast()` is a small comms line at the panel's edge, and
`damagePopup` is a 26 px combat floater.

The warp text is a dedicated card, `#warpcard`, built exactly on that method —
same structure (rule / name / rule), same typography, same show-and-hold
presentation — rather than the `#introcard` element itself, because
`startIntro` owns that element's timer and its spotlight dim; a gravity
inversion landing mid-introduction would corrupt both. The method is the
announcement method; the instance is its own so the two never fight.

## The announcement

- **Text:** `GRAVITY INVERSION!!` — exact, standing in the markup, thrown by
  `showGravityWarp()` (game3.js).
- **Scale: 3×** — `#warp-name` is **120 px** against the intro card's 40 px
  name, bold, with a cyan glow over the card's black shadow. The size is
  fluid-capped at 8.5 vw so the line never clips: at 1,280 px wide it renders
  ~109 px (2.7×), at ≥1,412 px the full 120 px (3×), and in the small
  headless test window (~780 px) ~66 px. Always inside Will's 2–4× band on
  any real play surface.
- **Warp treatment:** the card swings in through perspective — `warpin`
  keyframes: rotateX 42° → −10° → 5° → −2° → 0 with a skewX sweep
  (−8° → 3.5° → −2° → 0) and a scale overshoot (0.84 → 1.07 → 1.0), a damped
  ring-down that settles by 42% of the run — while the name itself
  counter-warps (`warpname`: skewX −14° → 7° → −3.5° → 0 with a scaleX
  breathe). The text warps; it is not merely big.
- **Position:** centered horizontally, top 32% — in the player's view, above
  the crosshair's working area, z-index above the intro card.
- **Duration: 2.6 s** (`WARP_MS = 2600`) — it lands at the moment of the
  inversion, holds through the degauss thunk, and clears well inside the
  5-second wooze; nothing of it outlives the wooze.

## When it fires — and when it does not

- **The fox's own inversion:** `flipGravityHere`, past the once-a-day gate,
  calls `showGravityWarp()` immediately beside `startInvertFx()` — the
  announcement and the wooze ride the same real inversion.
- **A refused shift:** no inversion, no announcement. The gate returns before
  the call (unit-proven by ordering check, e2e-proven by counter). The
  placeholder refusal toast remains exactly as demo10 left it.
- **⚠ FLAGGED CHOICE — remote-caused turns ANNOUNCE.** When the chart's word
  turns the realm the fox is standing in (another fox's shift, read back),
  `reconcileGravity` fires the announcement too — down changed under the fox,
  and the big text is the helpful word for why the world just turned (it
  complements the border beat/toast the physics already speaks there). The
  distinction was easy in the code: `applyRealmGravity` returns whether the
  realm actually changed, and the current-realm branch of `reconcileGravity`
  is the one seam every read-back turn passes through. **This choice is
  Will's to ratify or strike** — striking it is deleting one guarded call.
  The remote turn still carries no wooze (demo10's scoping, unchanged).
- **Arrival is not an inversion:** the announcement is dwell-gated
  (`warpAnnounceOk`: splash dismissed **and** ≥ 4 s standing in the realm).
  Realm entry restarts the dwell (`enterRealmGravity` stamps
  `state.realmSince`, as does spawn), so entering — or booting into — a realm
  whose stored down is up attunes quietly, as before; the border beat speaks
  for the place. Only a turn that arrives while the fox is truly standing
  there announces.
- The fox's own record read back later cannot double-announce: the mirror
  already carries the flip, so `applyRealmGravity` reports no change.
- **Joy's lines untouched:** BEAT-flip-up / BEAT-flip-down play exactly as
  before (unit-checked); the warp card is a visual layer, not narration.

## Tests

- **Unit (node test3.mjs): 236 passed, 0 failed** — demo10's 227 baseline
  plus 9 new warp checks: exact words on the built card; 120 px vs the card's
  40 px (3×); warp keyframes present (rotateX + skewX, card and name);
  2,600 ms inside the wooze's 5,000; the refusal gate provably returns before
  the announcement call; the own-flip call sits beside `startInvertFx()`;
  the reconcile seam announces dwell-gated; realm entry restarts the dwell;
  Joy's flip beats untouched.
- **E2E (node cdp_test3.mjs): all three new warp legs pass** —
  "the inversion is announced: GRAVITY INVERSION!! warp text",
  "a refused shift announces nothing — no warp text", and
  "a read-back turn is announced too — the warp text fires again" — and the
  demo10 gravity legs pass with them (G flips; the wooze on screen; G again
  refused). The run reached 48 passed / 14 failed before dying at the gesture
  section with the known harness signature (exit 13, unsettled top-level
  await — environment contention, the same death demo10's degraded re-run
  and the dev loop's runs hit). The 14 failures are the contention timing
  cluster (movement/guide/rift-crossing legs, several in the known portal
  trigger-geometry family) plus the two gravity landing legs on their 20 s
  windows (ceiling: y = 29.15 of > 40; read-back landing: y = 27.40 of < 26 —
  the turns themselves demonstrably happened; the fox was still settling).
- **Focused probe (the built file through its own handle, 90 s windows):**
  both landing legs pass; refusal holds; read-back announces. 9/10 on the
  first pass — the one miss was the probe's own compound check racing the
  2.6 s window across four separate CDP evals under load; an atomic
  single-eval re-probe sampling everything at the flip returned
  shown = 1, active = true, display = block, show class on, DOM text exact,
  card visible — **PASS**. The legs stand in the suite for the ship-time run.
- **Harness note:** demo10's harness hardcoded its page URL to demo10's
  index.html, and the copied harness inherited that — the first demo18 e2e
  attempt unknowingly drove demo10's build (its gravity legs passed; the
  warp handle was absent, which is how the misdirection showed itself). The
  URL now names demo18, the port is demo18-private (9349), and the results
  above are from the corrected run. That first run is not evidence about
  demo18 and is recorded here only so the log is honest.

## Build

- **demo18/index.html: 4,948,936 bytes,
  sha256 `4fead589b7c37dd0b7e6e514edc4e92625acae5eb95e6290f175fca170ee6f1e`.**
  The NF_SHIP_EE token is unchanged (`NF_SHIP_EE:950`, exactly once).
- Files changed vs demo10: `page3.html` (warp card markup + CSS),
  `game3.js` (the warp section, the two hooks, `realmSince` stamps, the
  `NOVA_FOX3.warpText()` playtest handle), `test3.mjs` (+9 unit checks),
  `cdp_test3.mjs` (+3 legs, own URL, private port). Nothing else.

## Open for Will

1. **The remote-turn announcement** (above) — ratify, or strike the one
   guarded call in `reconcileGravity`.
2. Reconciliation of demo18 with the other trees happens at ship time, as
   with demo10; the warp layer is additive and touches no shared state
   beyond the two new `state` fields.
