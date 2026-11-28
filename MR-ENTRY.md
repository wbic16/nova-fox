# MR — Nova Fox LEG B: X-FACTOR GAME SURFACES (EE 1351)

- **Item:** X factor — the game-surface halves of the WELCOME and
  CREDIT-FLAG legs (X-FACTOR-DESIGN.md §7 legs 3+4, game-tree
  halves only; the gateway halves landed EE 1340).
- **Base:** c51efdd (branch `encounter`; unit baseline 1238/0,
  re-verified in this worktree at EE 1350).
- **Branch / worktree:** `x-surfaces` in ~/nf-xsurfaces (hub).
- **Producer stance:** merge-ready delta only. NOT staged, NOT
  stamped (NF_SHIP_EE token untouched — index.html still carries
  exactly one `NF_SHIP_EE:1333`, its base value), NOT pushed. No
  e2e run — Jenkins is the consumer's gate.

## Unit

- Before: **1238 passed, 0 failed** (base c51efdd, verified in
  this worktree before any edit, EE 1350).
- After: **1266 passed, 0 failed** (`node test3.mjs`,
  builds/demo73, hub-side) — +28 pins, all `xfactor:`.
- No re-pins: no existing pin was touched, weakened, or removed.
- Mutation check (EE 1351, scratch copy, not committed): removing
  the accrual multiplier and inverting the welcome beat condition
  failed 7 of the new pins — the pins are live, not tautologies.

## What was built

- **New pure module `builds/demo73/xfactor.js`** (collectibles.js
  discipline: no DOM, no storage, no clock, no network; inlined by
  build3.py after collectibles.js):
  - `parseXFactorAnswer` — the gateway's session read-back
    (POST /api/v2/xfactor answer, gateway.py EE 1339 shape),
    parsed defensively: a malformed answer parses to null and
    folds nothing.
  - `applyXFactorAnswer` — folds one answer into the session view
    and returns what the surface must render NOW. The welcome
    beat is handed back EXACTLY ONCE: only when the read-back's
    welcome state is `"beat"` (the gateway's fresh-grant word —
    not merely "has a grant") and this boot has not rendered it.
    A `"standing"` answer (every later granted login) hands back
    no beat; the copy line stands as state.
  - The multiplier is READ from the read-back's
    `credit_multiplier` field, never computed from `og`, the
    registry, or anything client-side (pinned both directions:
    og true + field 1 reads 1; og false + field 2 reads 2).
    Unknown-era answers (og `"unknown-era"`, D-3) fold as
    multiplier 1, og false, halo false — the tier stays
    unresolved, exactly as the gateway sends it.
  - `xGameSurfaceStrings` — every string the game surface renders
    from the X-factor state. The halo flag contributes NOTHING
    (see Halo below).
- **WELCOME glue (game3.js, `X-SURFACES-BEGIN/END` block):**
  `xFactorLogin()` runs on the boot chain after
  `presentLicenseKey()` and on the 20 s cadence until an answer
  lands (once per boot thereafter). It POSTs to
  `${BACKEND.base}/api/v2/xfactor` under the game token, folds the
  answer, and toasts the beat text the READ-BACK carries (the
  §4 DRAFT text as written — Joy's arrival lines; OG answers
  carry the one additional OG line in their beat_text). The
  status board (`statusBoardText`) appends the copy line
  "Yours — a gift of the wavefront." as standing state for
  granted players. Non-grant sessions (no-match, not-grantable,
  signed-out, gateway silent) render NO beat and NO copy line —
  the entitlement is not advertised to the excluded (§2 step 7).
  The word DRAFT is never rendered (pinned across all granted
  states).
- **ECONOMY READ POINTS (economy.js + game3.js):**
  `accrue(eco, seconds, creditMultiplier)` and
  `dailyPrizeDraw(eco, playerName, dateStr, creditMultiplier)`
  take the session multiplier as a parameter; the glue passes
  `xCreditMultiplier()` at exactly the named surfaces: the
  ecoTick accrual, both `ecoAccrue` debug handles, and the daily
  prize claim. The multiplier touches ONLY minted credits — flux
  drip and spew are unchanged (pinned: spew 100 at both
  multipliers; credits 10 vs 20 per active hour). A free fox at
  multiplier 2 mints nothing (pinned).
- **HALO (data-only):** the flag folds into the view
  (`xfState.halo`, exposed on the `__nf.xFactor()` debug handle)
  and renders NOTHING — no string, ring, or mark in the game
  surface. Pinned: two states differing only in halo render
  identical surface strings; a halo-true standing state renders
  only the copy line. (The OG beat's own mandated sentence
  mentions the wiki halo — that is the §4 copy the gateway
  sends, not a surface the flag produces.)

## Negative pins (D-5 — the multiplier goes nowhere else)

- `convertTokens` outcomes identical at equal purses, and its
  source carries no multiplier (an exchange is not a bonus).
- `sendHanddown` / `applyHanddowns` move the named amount on
  both sides of a transfer; their sources carry no multiplier
  (a transfer is not a bonus).
- A wiring pin counts the glue's multiplier read points:
  exactly the accrual tick, the two accrual handles, and the
  daily prize — wiring it anywhere else fails the suite.

## Fixture movements (producer evidence ONLY)

Played-path PASS verdicts belong to the consumer gate +
independent verification at ship; nothing below claims one.

- **F-GAME-17** — stays PARTIAL. Game-surface half now built and
  unit-pinned: granting login → beat once + copy line; second
  login (standing) → no beat, copy line stands.
- **F-GAME-18** — stays PARTIAL. No-match login renders nothing
  (unit-pinned at module and mock-gateway level).
- **F-GAME-19** — stays PARTIAL. Already-bought answer folds the
  OG markers (multiplier 2, halo true) with no beat and no grant
  action client-side (unit-pinned).
- **F-GAME-20** — PASS at the backend surface (EE 1340), unchanged
  by this leg; no game-surface half exists for it.
- **F-GAME-21** — stays PARTIAL. Nothing client-side changes: the
  handle learning is the gateway's; the client presents its
  token identity and the gateway judges (see Gap 1).
- **F-GAME-22** — stays PARTIAL. OG answer folds multiplier 2 +
  halo true (unit-pinned); the wiki halo itself is F-GAME-25.
- **F-GAME-23** — stays PARTIAL. Non-OG mutual answer folds
  multiplier 1 + halo false + the plain beat (unit-pinned).
- **F-GAME-24** — stays PARTIAL → its game-tree half is now
  built: generator accrual and daily prize read the multiplier
  in-game (unit-pinned 2× at both, hand-down NOT doubled,
  negative-pinned). The played-path comparison on the test
  surface is the consumer gate's.
- **F-GAME-25** — PARKED, untouched (no wiki profile surface
  exists; this leg renders nothing for halo, by design).

## Design gaps flagged (recorded, not smoothed)

1. **Identity assertion path.** Design §2 step 2 has the gateway
   receive the X identity asserted server-side by the SSO-X
   session; the shipped endpoint instead takes `account_id` +
   `handle` from the request body, and the only identity the
   client holds is its game token's payload (`sub` + `name` from
   the phext.tech session). The client presents exactly what the
   token carries (a numeric sub as account_id, else the payload
   name/sub as handle) and the gateway remains the judge — a
   presentation matching nothing answers no-match and nothing
   renders. If phext.tech's `sub` is not the X identity, matching
   fails safe (no grant, no beat, no copy line) until the gateway
   reads the identity from the session itself. No client-side
   registry lookup or local matching was invented.
2. **Brief vs gateway naming.** The leg brief says "the
   license-session read-back carries the x-factor state"; in the
   gateway of record the x-factor state rides the
   POST /api/v2/xfactor answer (the design's own "session
   read-back", §6 F-GAME-22/23), while /api/v2/license-session
   answers paid/source only. The client reads the xfactor
   answer; no license-session field was assumed or invented.
3. **Fresh vs standing is sufficient** — recorded as a
   NON-gap: the read-back's `welcome.state` ("beat" vs
   "standing") plus the `beat` flag distinguishes a fresh grant
   from an already-granted login, so the exactly-once welcome
   needs no client-side login memory and none was built.
4. **Halo wording tension, resolved as pinned:** the mandated
   OG beat text itself contains the sentence "The halo is lit
   for you on the wiki." — the halo FLAG still renders nothing;
   the pins hold flag-invariance of the rendered surface rather
   than pretending the copy is halo-free.

## Footprint

7 files in builds/demo73: `xfactor.js` (new), `economy.js`,
`game3.js`, `build3.py`, `test3.mjs`, `_built_module3.mjs`,
`index.html` (both regenerated by build3.py; narration 35 beats
embedded, NF_SHIP_EE token at its base value 1333). Plus this
MR-ENTRY.md at the repo root.
