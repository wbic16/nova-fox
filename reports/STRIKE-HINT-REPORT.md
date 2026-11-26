# Nova Fox — Encounter Strike-Key Hint (demo12)

**Built:** EE 962 (2026-11-26, 16:13 CST)
**Tree:** `~/workspace/nova-fox/demo12/` — a fresh copy of demo5 (verified sha256
`98207789e35e62b1b3399d60180b03fea223d9c488311332c60f1e4cf15a8f40` before copying).
No other demo tree was edited.
**Spec (Will, 2026-11-26 15:23 CST):** "bulging currently-assigned key binding for
strike is shown while the encounter is in progress — automatically fades after the
player runs away or vanquishes the shadow". Companion line: Joy's guardian-contact
beat — "This guardian is confused, Fox. You must strike back. Strike, now!"

**New index.html:** 4,935,561 bytes, sha256
`e85d0fbbd9b02866d80e42bab8662fae31985c6cd6bcf9e18ef45f8ebc5933d1`
**NF_SHIP_EE:** token stands exactly once, value unchanged (`NF_SHIP_EE:950`).

## How the encounter state is detected

The hint rides the game's own contact machinery — no parallel detector:

- `game3.js` gains a latch, `state.guardianEncounter`, plus
  `setGuardianEncounter(on)`, `syncStrikeHint()`, and `updateGuardianEncounter()`.
- **Raise:** inside `checkMonsterContact()`, the branch that handles a familiar's
  touch, `if (m.kind === "guardian") setGuardianEncounter(true);` — the exact site
  whose contact can fire the `BEAT-guardian-contact` narration beat, so the cap
  appears in the same moment Joy speaks.
- **Keep/end:** `updateGuardianEncounter()` runs every frame in `animate()`,
  immediately after `checkMonsterContact()`. It ends the encounter when the
  guardian is gone or dead, the player is dead, or the horizontal distance to the
  guardian exceeds the leash (`GUARDIAN_LEASH = 16` blocks). While the encounter
  stands, it re-reads the binding label every frame, so a mid-fight scheme change
  re-letters the cap live.

## Where the binding is read from

Never hardcoded. A pure function `strikeBindingLabel(scheme, touch)` reads the
game's live control state — `state.scheme` (the same state the #btn-keys toggle
flips and persists to localStorage) plus the touch body-class:

- **WASD scheme → "F"** (the F key strikes; see the key handler).
- **AWEF scheme → "CLICK"** — in AWEF, F walks backward (key handler), so the
  strike genuinely lives on the mouse click; the cap says so.
- **Touch device → "STRIKE"** (the on-screen strike button is the binding; the
  word row under the cap hides in this case since the cap itself says STRIKE).

The page ships the cap element **empty** (`page3.html`); only the game letters it.

## Placement and treatment

- A new `#striker` overlay in `page3.html`, dressed in the HUD's existing register
  (the notepad / touch-button dress: `rgba(0,20,44,0.88)` ground, 2 px `#00c8ff`
  border, cyan glow) — a large key cap (`#striker-cap`, 30 px bold) over the word
  "strike".
- **Bulge:** `@keyframes strikerbulge` scales the cap 1 → 1.17 on a 0.92 s
  ease-in-out infinite pulse while the encounter stands.
- **Placement:** lower right (`right: 16px; bottom: 58px`), above the bottom-right
  button cluster — clear of the crosshair, the fox, the guardian, and the touch
  buttons. It is **not** extras/opt-gated: it is encounter furniture, so it shows
  for every player.

## Fade conditions

`setGuardianEncounter(false)` removes the `.on` class — the cap fades over
0.45 s (opacity transition) — then `display: none` lands after 480 ms. No manual
dismissal, no persistence past the encounter. The encounter ends, and the cap
fades, when:

- **the player runs away** — horizontal distance to the guardian passes the
  16-block leash (or the player leaves the realm / the guardian leaves the
  subspace), or
- **the Shadow is vanquished** — the guardian is dead/absent, or
- the player dies.

Re-entering the encounter raises it again (verified in the e2e leg).

## Generalization flag (not widened)

The latch is guardian-kind-specific by design. `checkMonsterContact()` handles
every familiar's touch through the same branch, so an analogous hint for ordinary
familiar contacts (e.g., the wisp fight the guide teaches) would be a small,
mechanical extension — one kind check and a label. **Flagged as an option for
Will's word; scope was not widened.**

## Tests

- **Unit (`node test3.mjs`): 217 passed, 0 failed** (demo5 baseline 210, plus 7
  new: the binding-label function's three cases — extracted from the built source
  and evaluated — the cap riding in the built file with its bulge keyframes, the
  page shipping the cap empty, and the latch/frame-keep/leash hooks present).
- **E2E, strike-hint leg (`node cdp_test3.mjs`, the leg also run standalone
  against a fresh boot): 27 passed, 0 failed** — the 17 boot checks plus all 10
  new strike-hint checks: quiet before the meeting; the touch raises the
  encounter; the cap stands lettered "F" (WASD); toggling the scheme re-letters
  it "CLICK" (AWEF) and back; fleeing ends the encounter and the cap fades on its
  own; re-entering raises it again; the Shadow falls to the fox's own strike
  (real `tryStrike()` loop); the vanquish ends the encounter and the cap fades.
- **E2E, full suite:** not completed in this window — see the environment note.
  A full run was stopped at 41 passed / 13 failed after ~25 minutes of wall time
  at 0.33–0.67 fps. Every one of the 13 failures is a frame-rate-coupled leg
  (walking distance, guide-beat advances, rift crossings, gravity landings), and
  **the untouched demo16 sibling suite, run the same hour on the same box,
  failed the identical legs** (its run closed with 32 failures of the same
  class) — the failures are the shared verify box collapsing under six parallel
  builds, not this change. The strike-hint leg itself was therefore verified
  standalone (above) and by direct CDP probes of the built page (latch, opacity
  reaching 1, re-lettering both ways, flee fade to `display: none`).

## Harness note

`demo12/cdp_test3.mjs` runs its Chrome on port **9342**, not the stock 9335:
every tree's suite defaults to 9335, and parallel builds' Chromes collide there
— one suite can end up driving another's browser. Worth fixing at the source
(per-tree ports) before the next parallel build wave.

## Ship-time reconciliation

demo12 is seeded from demo5 and predates the demo7 portal fix and any demo6 /
demo8 / demo9 / demo11 landings; reconcile at ship time per the dev loop. The
strike hint is not extras-gated and the NF_SHIP_EE token value is untouched.
Not staged, not deployed.
