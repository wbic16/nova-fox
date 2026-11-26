# Nova Fox — the sellable core: W2 entitlement + W3 economy (demo4)

**Built 2026-11-26, EE 946.** Base: `demo3/` copied whole to a new
tree `demo4/`; demo3 is untouched (its index.html still hashes to
`6c48e82c145b68324781fa8be87a966ae715b424761032c0f136dabe4c6babec`,
re-verified after this build). **Not staged, not deployed** —
staging to awsbox is a separate step, not taken here.

**Built file:** `~/workspace/nova-fox/demo4/index.html` —
4,908,220 bytes, sha256
`9d17326436d8289e46800bfba182488632dbae46edaaaa62ab51a5100cd24d85`.

**Governing rulings, as built:** D1 (paid tier: 2-week early
access to future features, the global leaderboard ordered by
purchase number, the credit generation skill as the first paid
interaction), D2 ((c) both doors, one key system, two issuers),
D12 = **Fork B** (Will, 2026-11-26 14:00 CST — "we're doing this
to make the Exocortex fun").

## What was built

A new pure-logic module, **`demo4/economy.js`** (no DOM, no
storage, no clock of its own — unit-tested directly, like
world.js), inlined by the build between world.js and game3.js,
plus glue in game3.js and two new sections on the board panel.

1. **Entitlement (W2).** One redemption field on the board
   panel takes either key; the key's shape routes it.
   - *Gumroad keys* verify against Gumroad's documented license
     door (POST `api.gumroad.com/v2/licenses/verify`,
     `product_permalink=nova-fox`, `increment_uses_count=false`).
     Success with a non-refunded, non-charged-back purchase
     entitles. No route to Gumroad = **pending, never "no"** —
     the game plays whole as free, and a key once verified on a
     machine stays verified (the entitlement is cached in the
     save), which is the downloadable build's offline posture
     under D2.
   - *Gift keys* (`NFG-…`, 128-bit random, base32) are bought
     in-game for **100 credits**. Only the key's FNV-1a-64 hash
     is inscribed on the shared chart; redemption re-hashes the
     presented key and checks the ledger: issued, and not yet
     redeemed. Entered offline, a gift key is kept as pending
     and verifies itself against the first ledger read that
     answers — nothing is granted on a guess.
   - Either issuer lands in the same entitlement state and
     fires the same purchase claim. There is one door.

2. **The written record — the leaderboard (D1).** A third
   scroll on the existing shared chart (`nova-phox-world` at
   phext.tech, coordinate `1.1.1/1.1.3/1.1.1`) carries purchase
   claims in arrival order. A player's **purchase number is
   their claim's position in the scroll as read back** — the
   client never picks its own number; first claim per name
   wins; until read-back, the game says "number not yet
   written". The board panel renders the record (№, name,
   source, date) above the purse. It rides the game's existing
   sync machinery throughout: the SQ REST pattern, the login
   token on writes, the 115/min insert budget, an economy
   outbox with the marks outbox's exact discipline.

3. **The credit economy (W3 core, Fork B).** Ledgers (flux and
   credits, whole units with fractional accrual carried) live
   in the local save and ride in save copies (format v3; v2
   copies still load). Accrual runs on the existing 5-second
   tick and only for **active** play (tab visible, input within
   30 s; a stalled tab grants no backlog):
   - the free **drip**: 20 flux / active hour, everyone;
   - the **generation skill** (paid): spew 100 flux / active
     hour, earning **10 credits / active hour** (1 per 10
     spewed); pooled spew is inscribed on the shared chart
     through the ordinary marks path once 100 accumulate;
   - **daily-prize credits**: on the day's first daily-pocket
     claim, a deterministic (player, date) draw — same answer
     on every machine, un-rerollable — pays 1 credit on 1 claim
     in 3 (see draft numbers);
   - **generator hand-downs**: any credit holder names a fox
     and an amount; the debit is local, the transfer rides a
     fourth scroll, the economy ledger (`1.1.1/1.1.4/1.1.1`),
     and the recipient's client credits it exactly once, by
     transfer id, on read-back. A transfer, not a faucet;
   - **conversion**: 50 flux destroyed → 1 credit, counted per
     ISO week in the ledger;
   - **gifting**: the 100-credit gift above — the renewable
     sink, and the second issuer of the one key.
   The purse shows on the HUD inventory line and in full on the
   board panel, with the four actions wired: redeem, gift,
   convert, hand down.

4. **The Lance.** Carried as data in economy.js:
   `LANCE.classification = "unruled"`, `tiersDormant = true`,
   the Keen/War Lance tiers listed (War Lance priced 600 from
   ECONOMY §4.1's cross-check; Keen Lance's price is not stated
   in ECONOMY §4, so it is `null`, not invented). Nothing in the
   build classifies the base Lance either way, and no tier is
   purchasable.

## Tests — real counts

- **Unit** (`cd demo4 && node test3.mjs`): **173 passed,
  0 failed** — the base tree's 127 world checks untouched and
  green, plus **46 new economy checks**: accrual rates and
  fraction carry, conversion bounds and week accounting, the
  prize draw's determinism/once-a-day/win-share, gift issue /
  redeem / double-redeem / unknown / offline-pending, hand-down
  debit/credit/exactly-once, Gumroad verify against a mock
  fetch (good, refunded, rejected, no-route), purchase-board
  ordering and dedupe, state-load clamping, the Lance flag.
- **E2E** (`node cdp_test3.mjs`, log
  `~/workspace/nova-fox/work-logs/cdp-demo4.log`): the harness
  Chromium **started** — the morning's WebGL-policy refusal has
  cleared. One necessary adaptation first: the suite's copy in
  demo4 pointed at demo3's file (line 25, hardcoded); it now
  points at demo4's, and the save-format check now asserts v3
  (the format advanced because the purse rides in it — the
  check asserts the folded queue *and* the purse are carried).
  Four economy checks were added (fresh fox is free; the record
  and purse render; an hour drips 20 flux; the purse shows on
  the inventory line) — **all four pass**, as does the v3 save
  check. Full result: **120 passed, 7 failed, zero page console
  errors.** All 7 failures are the touch-emulation legs (world
  drag, jump/flip buttons, draw arm, drawn triangle, flute
  drag) — the same group the clean-UI report documented as
  failing **in the harness** on the untouched base build (CDP
  touch emulation: hit-points landing a cell off, touchmove
  delivery), with the real-device fixes already in the base.
  Nothing in this pass touches the touch layer. The one known
  pre-existing failure — the monster-carry leg — **passed this
  run**; it is intermittent on the base tree and untouched by
  this work.

## Draft numbers relied on (all flagged in code at the constant)

From ECONOMY.md §1.1 / PLAN.md §2 — drafts, not rulings, and
each is a single constant in `ECO_RATES` when Will rules:

- Drip **20 flux/hr** (P1, modeling value in PLAN's range);
  spew **100/hr** (P2, a modeling assumption ECONOMY names the
  model's most sensitive number); earn ratio **1 credit per 10
  spewed** (P3 draft) → 10 credits/hr (P4).
- Gift price **100 credits** (P6 draft).
- Conversion **50 : 1** (P8 draft — the rate is in the D12
  ruling's own text). The draft's *weekly cap* has **no stated
  size**, so no cap is enforced; conversions are counted per
  week so a ruled cap can bind later without a migration.
- Daily prize: ECONOMY P9 states an *expected value* (≈10
  credits/month devoted, ≈3 casual), not a prize size — the
  prize shape is D6/D7, unruled. The implemented pair (1 credit,
  1-in-3 per daily claim) reproduces P9's expectation exactly;
  it is a derivation, marked as such in the module.
- **Untouched, per the brief:** token parameters **(n)**
  points→loot mapping and **(o)** draw timing (ECONOMY §2.3)
  keep their existing draft behavior — this build neither adds
  nor changes dragon-token sale/crack mechanics; they remain
  Will-unruled and are the token leg's open work.

## Named blocks and honest limits

- **The shared chart is not live yet.** phext.tech's `/api/v2/*`
  answers 404 today (verified 2026-11-22, recorded in the
  game's own comments) — so the written record, the economy
  ledger, and gift honouring **queue locally and land when the
  backend answers**, exactly like marks already do. Nothing in
  the panel presents a queued claim as written. This is
  platform state the build inherits, not a defect it adds.
- **Gumroad verification is built to the documented API shape
  and mock-tested; it has not yet been exercised against the
  live product** — the product is still a draft on Gumroad and
  no real license key exists to test with. The first real key
  (a test purchase) is the confirming run.
- **D14 (where spewed flux lands — pool / nearby / split) is
  unruled.** Spew is inscribed to the shared pool record; no
  cross-player drip lift is implemented, because which lift
  exists *is* D14.
- **The power-up ladder shop is not in this build.** Credits'
  built sinks are the gift (renewable) and, implicitly, the
  ladder to come; §2.14's rung prices exist in the docs and
  the ledger operations here are the foundation, but no rung
  is purchasable yet. Named so the gap is a gap on paper, not
  discovered in play.
- **Purchase-number simultaneity:** two claims in flight
  between reads are ordered by gateway arrival — the chart's
  own semantics, and the design's stated rule.
