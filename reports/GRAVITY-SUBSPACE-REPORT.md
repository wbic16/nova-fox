# Nova Fox — gravity in subspace, per realm, one shift a day — and the inversion wooze

EE 959 (built EE 954–959, 2026-11-26) · Will's rulings: 15:13 CST (gravity stored in
subspace, per realm, once per day per realm) and 15:38 CST (the inversion wooze).
Tree: **demo10** — see the tree note at the end. Not staged, not deployed.

## Where gravity lives now

In subspace, on the shared chart phext the game already plays on — **nova-phox-world**
at phext.tech — on a new scroll, **gravity coordinate `1.1.1/1.1.5/1.1.1`**, beside the
chart's existing scrolls (log `1.1.1/1.1.1/1.1.1`, board `1.1.1/1.1.2/1.1.1`, purchase
`1.1.1/1.1.3/1.1.1`, eco `1.1.1/1.1.4/1.1.1`). Gravity is a property **of the realm**,
shared by every player: the scroll is append-only, and a realm's current down is its
**latest** record. One player's shift turns the realm for everyone, and the turn is
in the phext — not in anyone's localStorage.

Mechanism, in demo10:

- **Write** — a shift queues its record into the game's existing economy outbox
  (token-headed, budget-paced, retried, merged into the periodic flush), the same
  write path the gift keys and purchases already ride. Nothing new touches the wire.
- **Read** — the flush's read-back (boot, then every 20 s) now also selects the
  gravity scroll; entering a realm reconciles from cache at once and refreshes from
  the scroll when online. Reconciliation is a silent attunement: the realm's gravity
  becomes the stored word, the realm's chunk-scrolls are kept in step, and if the
  realm you are standing in turns, the chunks around you regenerate so the world
  matches its gravity and you fall the new down. The sync label keeps reporting
  queued marks, so a pending record is visible, never silent.
- **Local mirror** — the per-realm gravity map the physics already reads stays as
  the mirror; the scroll is the source of truth, applied on realm entry and on
  every read-back.

## The shift record

One line per shift, riding the chart's append-only idiom:

```
grav|<realmId>|<dir>|<player>|<day>|<ts>
```

`dir` is the realm's new down (+1 / −1); `day` is the player's local YYYY-MM-DD;
`ts` is epoch milliseconds. The record **is** the rate-limit ledger: the once-a-day
rule is enforced against the stored state — a shift is allowed only when no record
exists for (this player, this realm, today) among the known records. Malformed
lines in the scroll are skipped on parse, never fatal.

## The once-a-day rule, and the refusal

The gate is checked **before** anything turns. A refused shift: no flip, no record,
no flip-counter increment — and a toast in the game's existing style:

> "This realm's gravity has already been shifted today — one shift per realm per day."

**⚠ That line is PLACEHOLDER copy, flagged for Will's wording** — it is a plain
statement of the rule in the toast idiom, not narration; no Joy line was invented.

A different realm is a different budget; a different day reopens the same realm;
another player's shift does not spend yours (but it does turn the realm — the
orientation is shared, the budget is personal).

## Offline behavior — stated exactly

- Offline or signed out, a shift still happens locally and its record queues in the
  record outbox; it **counts as spent from the moment it is made**, because the
  known-records set the gate reads includes this fox's own still-queued records.
- On realm entry and on every read-back the scroll is the truth and the local
  mirror attunes to it. If the subspace word differs from what you carry (another
  fox shifted the realm while you were away), the realm turns to the stored word.
- Nothing crashes: every fetch is timeout-guarded, failures keep the last honest
  state, and the sync label already says when marks are queued unsent.

## The inversion wooze (Will, 15:38 CST)

On a real inversion — the player's own successful shift, the moment the realm
actually turns — the fox is woozy for **5 seconds**:

- **Slow factor: 0.5** — movement speed is halved for the five seconds (walk 4.4 → 2.2,
  run 6.8 → 3.4, charm multiplier untouched). Falling is gravity's business, not the
  walk speed's, so landings are unaffected.
- **Visual: a CRT degauss treatment.** The canvas takes a blur (up to 4.5 px),
  a hue swing (±70°) and a saturation bloom, with a ~2.2 Hz wobble in position and
  scale — all on a damped envelope that starts at full strength at the thunk and
  settles to zero at five seconds — under a rainbow-shimmer veil (a six-stop
  spectral gradient, screen-blended, opacity following the same envelope). At five
  seconds every style is cleared; nothing lingers.
- **Sound: the degauss thunk-buzz, synthesized** in the game's WebAudio idiom —
  a 64 Hz thunk with a lowpass noise thump, then the coil's hum: a sagging
  twice-mains sawtooth buzz (118 Hz with its 236 Hz harmonic and a 59 Hz square
  under it) ringing down over ~1.5 s. No external asset, no download — built from
  the same tone/noise kit as every other sound in the game.
- **Refused shift: no wooze at all.** The effect starts only past the once-a-day
  gate, on the success path; a refused attempt inverts nothing and gets nothing
  beyond the refusal toast above. *Flagged, not invented:* if a refused attempt
  deserves a lesser cue of its own, that is Will's call — none was added.
- Scope note: the wooze rides the local player's own shift. When a realm turns
  because **another** fox shifted it (read back on entry or on the 20 s cycle),
  your gravity still turns — silently, as attunement — without the wooze. The
  ruling's words tie the effect to "the player's daily shift"; if Will wants the
  full treatment on remote turns too, it is a one-line change at the reconcile
  seam, deliberately not assumed here.

## Tests

- **Unit (node test3.mjs): 227 passed, 0 failed** — the demo5 baseline 210, plus 17
  new: the record line round-trips; malformed lines are skipped; against a mocked
  gateway a shift writes and reads back; a second same-day same-realm shift by the
  same player is refused; a different player, a different realm, or a different day
  is allowed; entering a realm applies the stored orientation; attunement keeps the
  realm's chunk-scrolls in step; the degauss treatment rides in the built file; the
  slow factor and duration are the stated constants in the speed computation; and
  the refusal gate provably returns before the effect can start.
- **E2E (node cdp_test3.mjs), full run: 123 passed, 12 failed, 0 console errors.**
  All three gravity legs pass — "G flips the realm's gravity", "G again is refused —
  one shift per realm per day (demo10)", and "another fox's shift, read back,
  restores down — and the fox lands". The 12 failures, classified:
  - 1× the drawn-rift crossing — the known portal trigger-geometry defect
    (PORTAL-DIAGNOSIS.md; demo7's fix is its home; it fails in demo5 here too).
  - 2× economy legs asserting an exactly-empty / exactly-20-flux purse — the free
    drip accrues on wall-clock (20/hr, 5 s tick) and this run's wall time stretched
    ~4× under load, so the purse no longer read exactly 0 / 20 when asserted. A
    pristine demo5 baseline run in the same environment fared worse (43 passed /
    14 failed, aborted early on renderer death) and never reached those legs, so
    no cleaner same-environment baseline exists; the mechanism fits the drip's
    own arithmetic.
  - 9× the touch cluster, one root: the touch section's bridge-tune crossing to
    Ashfall missed the rift trigger (the same portal defect), so the touch legs ran
    in the wrong realm — seven of them are the known touch-emulation set from the
    demo5 report (drag-look yaw, jump, flip, ceiling landing, draw arming, drawn
    triangle, flute); the other two are this build's own crossing leg and touch
    refusal leg, both downstream of the missed crossing. Notably, in the wrong
    realm the refusal logic still demonstrably held (the day's Nova shift spent,
    the second refused). With demo7's portal fix merged forward at ship time, the
    crossing lands and the touch legs run in Ashfall as written.
- **Wooze probe (focused, the built file driven through its own handle):
  9 passed, 0 failed** — no wooze before any inversion; the flip turns the realm;
  the wooze clock starts at the flip and reports active; the veil is on screen and
  the canvas carries the blur; the shift is recorded and spent; a second shift is
  refused with no flip and no new record. (A full-suite re-run with the wooze leg
  was attempted; the run degraded to 32/5 and aborted on the same renderer death
  the pristine baseline hit — environment contention, not the build. The wooze
  leg stands in the suite for the ship-time run.)
- **index.html (demo10, final): 4,942,745 bytes,
  sha256 `6ab734a0ce9f173818d92990d485af5cc97a0a10c85d029a901764341237139a`.**
  The NF_SHIP_EE token is unchanged (`NF_SHIP_EE:950`, exactly once).

## Tree note

The task named demo8; demo8 and demo9 already existed when the work began (the dev
loop's forms/idea-door tree, and another builder's trail tree), so the build was
made in **demo10**, a verified clean copy of demo5 (index.html sha256
`98207789e35e62b1b3399d60180b03fea223d9c488311332c60f1e4cf15a8f40` before edits —
demo5 itself still hashes to exactly that). demo5/demo6/demo7/demo8/demo9 were not
edited by this build (three stray edits that briefly landed in demo9 early on were
fully reverted and verified absent). Reconciliation with demo6 (forms), demo7
(portal fix) and demo8 (idea door) happens at ship time, as with the other trees.
