# DEV-LOOP-LOG — Nova Fox dev loop pipeline state

_Persisted pipeline state for the epoch dev loop (DEV-LOOP.md).
Each tick advances the mid-pipeline item by exactly one stage:
harvest → choose → design → build → test → ship → close.
Streams rotate player-idea → monster → engine; player ideas
oldest unshipped first._

> **Scroll claims:** coordinates named in this log are historical as
> written. The planner of record is `docs/SCROLL-REGISTRY.md` — gravity
> `1.1.1/1.1.5/1.1.1`, forms `1.1.1/1.1.6/1.1.1` (Will, ratified
> 2026-11-26), ideas allocated `1.1.1/1.1.7/1.1.1` (planner —
> `ideaCoord` still at 1.1.6 in code must move before the idea door
> merges into a forms-carrying tree).

## EE 952 — 2026-11-26 14:56 CST — HARVEST + CHOOSE (loop start)

- **Log created.** No prior DEV-LOOP-LOG existed; no item was
  mid-pipeline. This is the loop's first recorded tick.
- **Harvest — ideas scroll (phext.tech /api/v2 gateway,
  nova-phox-world):** TOC lists exactly one scroll,
  1.1.1/1.1.1/1.1.1 ("#0 verify — backend round-trip verified
  at deployment [emise-deploy]"). Selects of the board
  (1.1.1/1.1.2/1.1.1) and ledger (1.1.1/1.1.4/1.1.1)
  coordinates returned HTTP 200 with empty bodies — those
  scrolls hold no content yet. **No ideas scroll exists and
  no player ideas have been submitted** — expected state:
  the in-game idea door is not built, so there is no channel
  by which a player idea could have arrived.
- **Harvest — day's dated note (~/memory/2026-11-26.md):**
  no player ideas dropped in chat; the day's Nova Fox intake
  is Will's rulings (D1, D2, D12 Fork B, ship-EE versioning,
  customizable player forms, in-game roadmap — all inscribed
  in LAUNCH.md) and the queued items in DEV-LOOP.md.
- **Standing first task check:** the idea door is NOT built
  in the current build — grep of demo6 sources (game3.js,
  world.js, economy.js) finds no idea-submission code (only
  guideAdvance / Euclidean false positives). Current build
  tree: demo6; live build is EE 948 per LAUNCH.md.
- **CHOOSE:** Item #1 = **the in-game idea door** (stream:
  player-idea; standing first task). An in-world affordance
  that posts player ideas to the ideas scroll through the
  gateway's login-token write path (POST /api/v2/insert,
  ~115/min budget), with submitted / picked / shipped states
  visible to players. Behind it in queue: customizable
  player forms, then the in-game product roadmap panel
  (DEV-LOOP.md, Queued from Will).
- **Next tick:** DESIGN stage for Item #1 — design notes
  for the idea door written before any code.

## EE 953 — 2026-11-26 15:04 CST — DESIGN — Item #1: the in-game idea door

- **Stage advanced:** DESIGN (previous tick EE 952: HARVEST +
  CHOOSE picked Item #1, the idea door). No code written this
  tick. Next tick: BUILD.
- **Grounded in the current build (demo6, read this tick):**
  `BACKEND` in game3.js — base `https://phext.tech`, phext
  `nova-phox-world`, scrolls: log `1.1.1/1.1.1/1.1.1`, board
  `1.1.1/1.1.2/1.1.1`, purchase record `1.1.1/1.1.3/1.1.1`,
  economy ledger `1.1.1/1.1.4/1.1.1`, forms `1.1.1/1.1.5/1.1.1`.
  Writes are `POST /api/v2/insert?p=nova-phox-world&c=<coord>`
  with the game login token as Bearer (token from
  `/api/game-login`, kept in localStorage; reads are public
  `GET /api/v2/select`). All inserts share `insertBudget()` —
  115/min held under the gateway's 120/min. Queues follow the
  marks/eco outbox discipline: persisted locally the moment
  they happen, flushed oldest-first under token + budget,
  401 drops the token and keeps the queue, 429 sets a 25 s
  retry clock, and nothing is shown as landed until it is
  actually read back.

### Design — the door in the world's terms

- **What it is:** a standing door in Nova Prime on the taught
  path near Arrival — fixed scenery, not a rift (rifts are
  player-opened travel links, one at a time; this door never
  moves and carries nobody anywhere). A door frame with a
  warm light and hover text in the game's hover idiom:
  *"the telling door — leave an idea for the world."*
  Walking up to it offers the prompt; the same panel also
  opens with the **I** key and from a "leave an idea" button
  in the board panel (B), so mobile and far-from-the-door
  players reach it too. Player-facing copy stays under the
  veil throughout: no phext / gateway / token words in-game.
- **What the player does:** writes a title and a short
  telling (what they wish the world had), sees it leave with
  their fox name on it, and can come back to watch its state
  change: **told → taken up → in the world**, the last with
  its ship-EE number shown (EE is always visible per the
  2026-11-26 14:56 ruling). If they are not signed in, the
  idea waits on their machine under a plain label and the
  panel offers the same sign-in door the board uses; it is
  never shown as told until the shared chart reads it back.
- **What it teaches:** that the world listens and answers by
  changing — the loop made visible at the exact spot a new
  player already walks. No new narration beat in v1 (keeps
  the build off the recording pipeline); hover text + a
  first-approach toast carry the teaching.

### Design — the build shape (for the BUILD tick)

- **New scroll:** ideas at **`1.1.1/1.1.6/1.1.1`** in
  `nova-phox-world` — the next free coordinate in the
  established row (…1.1.3 purchase, 1.1.4 ledger, 1.1.5
  forms). Added to `BACKEND` as `ideaCoord`, with
  `BACKEND.ideaRows` holding only rows actually read back.
- **New pure module `ideas.js`** (same discipline as
  economy.js / forms.js: no DOM, no storage, no clock —
  unit-testable): line format, parse, status resolution,
  caps. One append-only scroll, two line kinds:
  - `IDEA|v1|<id>|<fox name>|<submitted ts ms>|<title b64>|<body b64>`
    — title/body base64-UTF-8 (the forms chart-line pattern)
    so player text can hold pipes, newlines, and any
    alphabet without breaking the line format.
  - `STATUS|v1|<idea id>|<submitted|picked|shipped>|<ts ms>|<ship EE or ->`
    — submitted is implicit in the IDEA line; picked and
    shipped are appended STATUS lines; the latest STATUS
    for an id wins. The loop's CLOSE stage marks a shipped
    idea by appending its STATUS line (ship EE included)
    through the same write path — no scroll is ever edited.
  - **ID:** submit-ts in base36 + 4 random base36 chars,
    checked against read-back rows for collision.
  - **Caps (module constants, refused past the cap, never
    truncated silently):** title ≤ 80 chars, body ≤ 1,000
    chars. Idea text is data only — rendered via text
    nodes / escaped text, never as HTML; no script surface.
- **Queue:** a dedicated persisted idea outbox
  (`nova-phox-idea-outbox` in localStorage) mirroring the
  eco outbox: queued at submit, flushed inside
  `backendFlush()` under the shared `insertBudget()`,
  token-gated, oldest first, honest stop at first refusal.
  One submit = one insert; a short client cooldown keeps a
  double-tap from spending two.
- **Panel:** `#ideas` overlay in the board panel's idiom
  (hudpanel): a title field, a body field, a "tell the
  world" button, then two lists — *your ideas* (waiting /
  told / taken up / in the world + EE, waiting ones labelled
  as on-this-machine) and *lately told* (latest 20 read-back
  ideas with suggester name + state). This is deliberately
  NOT the queued roadmap panel: the door shows idea states;
  the roadmap item (behind forms in the queue) reuses this
  scroll's data beside the leaderboard when its turn comes.
- **Untouched by this item (rulings preserved):** the Lance
  stays unruled/dormant, token parameters (n)/(o) keep draft
  behavior, price stays $6 via Gumroad only, no tier gating
  — launch-day features are everyone's, so the door is open
  to free and paid foxes alike (sign-in is the gateway's
  requirement for any shared write, not a paywall).
- **BUILD acceptance (next stages):** build in a fresh
  **demo7** tree copied from demo6 (demo6 is never edited
  once staged). TEST must cover: serialize/parse round-trip
  incl. unicode + pipes/newlines in body text, status
  resolution (latest wins; shipped carries its EE), caps
  enforced, offline submit queues and flushes exactly one
  insert to `1.1.1/1.1.6/1.1.1` on sign-in, read-back renders
  state honestly — with the existing unit suite fully green
  and e2e real counts, per DEV-LOOP.md.
- **Next tick:** BUILD — dispatch a builder subagent with a
  self-contained brief against this design, landing in
  demo7.

## EE 955 — 2026-11-26 15:20 CST — BUILD — Item #1: the in-game idea door

- **Stage advanced:** BUILD (previous tick EE 953: DESIGN). Builder
  subagent dispatched with a self-contained brief against the
  EE 953 design; build landed, not staged, not shipped. Next
  tick: TEST.
- **Tree deviation, recorded:** the design named demo7, but
  demo7 already existed with older pre-forms content (no
  forms.js, no formCoord in its game3.js) — not a fresh demo6
  copy and not safe to overwrite. The build instead landed in
  a fresh **demo8** copied from demo6 (`cp -a`); demo6 and
  demo7 were not edited by the builder.
- **Built (demo8):** new pure module `ideas.js` (IDEA/STATUS
  line formats exactly as designed, base64-UTF-8 title/body,
  latest-STATUS-wins resolution, shipped carries its EE,
  `makeIdeaId` ts-base36 + 4 random base36, caps
  title ≤ 80 / body ≤ 1,000 refused never truncated);
  `build3.py` inlines ideas.js like forms.js; `game3.js` gains
  BACKEND.ideaCoord `1.1.1/1.1.6/1.1.1` + read-back into
  BACKEND.ideaRows, the persisted `nova-phox-idea-outbox`
  flushed inside backendFlush() under the shared insertBudget
  (token-gated, oldest-first, 401 keeps queue, 429 sets the
  25 s retry clock, 3 s submit cooldown, id collision re-roll);
  `page3.html` gains the `#ideas` hudpanel (title/body fields,
  cap counter, "tell the world", your-ideas and lately-told
  lists, all player text via textContent — no innerHTML),
  the `#doorline` hover overlay, help entry for I, and the
  board panel's "leave an idea" button. The telling door is
  fixed scenery at blocks (13, 10) in Nova Prime east of
  Arrival on the taught path: wooden frame, warm pane + light,
  hover text as designed, first-approach teaching toast once
  per machine, panel opens on approach / I key / click-tap /
  board button. Signed-out submits queue locally under the
  plain on-this-machine label with the board's sign-in
  affordance. Rulings untouched: Lance dormant, token (n)/(o)
  draft behavior, Gumroad/price code, no tier gating.
- **Builder's own checks (not the TEST verdict):** build3.py
  assembled index.html (5,017,909 bytes at builder's run;
  5,018,996 bytes at coordinator spot-check EE 955);
  `node --check` clean on ideas.js, game3.js, economy.js,
  forms.js, world.js, test3.mjs and the built module;
  builder's test3.mjs run: 271 passed, 0 failed, including
  the 20 new idea checks. Coordinator spot-check: ideas.js
  present and syntax-clean, ideaCoord present in game3.js,
  exactly one NF_SHIP_EE token in built index.html.
- **Deviations named by the builder:** (1) demo8 for demo7,
  above. (2) KeyI conflict: I is note 8 on the instrument's
  letter row — per the binding design, KeyI now opens/closes
  the panel (intercepted before the letter-note path); note 8
  remains playable via Digit8; typing in the idea fields is
  guarded so letters fire no game verbs.
- **Builder observation:** demo6/demo7 mtimes (~21:13 UTC)
  postdate the builder's ~21:12 UTC copy — concurrent activity
  by another process touched those trees; the builder wrote
  only to demo8, which is a faithful copy of demo6 as of the
  copy moment. Flagged for the TEST tick to keep in mind.
- **Next tick:** TEST — full unit suite must be fully green
  and e2e run with real counts against demo8 (builder exposed
  NOVA_FOX3.ideaState/ideaSubmit/ideaToggle/doorPos/doorAimed
  handles for it); any new failure is named and the item
  returns to BUILD or is parked with the reason recorded.

## EE 955 — 2026-11-26 15:24 CST — TEST — Item #1: the in-game idea door — NOT GREEN, returns to BUILD

- **Stage advanced:** TEST (previous tick EE 955: BUILD in
  demo8). Verdict: **NOT GREEN — item does not proceed to
  SHIP; it returns to BUILD** with the failures below named,
  per DEV-LOOP.md (a new failure is named, never absorbed).
  This is the item's first failed TEST stage.
- **Unit suite (demo8, `node test3.mjs`): fully green —
  271 passed, 0 failed**, exit 0, including all 20 new
  `idea:` checks and the exactly-once ship-stamp token check.
  Idea coverage confirmed by test name: serialize/parse
  round-trip incl. unicode + pipes/newlines; status
  resolution latest-STATUS-wins with shipped carrying its
  EE; caps title ≤ 80 / body ≤ 1,000 refused past the cap,
  never truncated.
- **E2E (`node cdp_test3.mjs` against demo8): FAILED TO
  COMPLETE, twice** — exit code 13 both runs, no pass/fail
  summary ever printed, no console-error count reported.
  Failure mode: CDP `Runtime.evaluate` promise never settles
  (Node "unsettled top-level await" at cdp_test3.mjs:161 run
  1 — after 1 ok, "page boots, NOVA_FOX3 handle present" —
  and at :155 run 2, 0 ok). Chrome binary present
  (157.0.8103.81), harness syntax clean. Evidence does not
  attribute this to game code, but e2e is unambiguously not
  green; it needs investigation / a re-run in a clean
  environment before any ship decision.
- **Harness fix made this tick (demo8 only, allowed):**
  cdp_test3.mjs URL corrected demo6 → demo8 — as inherited
  it would have tested the wrong tree. No game code touched.
- **Acceptance items covered by NEITHER suite (named gap):**
  (1) offline submit queues in the idea outbox; (2) flush =
  exactly one insert to `1.1.1/1.1.6/1.1.1` on sign-in;
  (3) read-back renders state honestly (BACKEND.ideaRows /
  panel rendering). Also: e2e has zero idea-door checks —
  `grep -i idea cdp_test3.mjs` = 0 hits; the exposed
  ideaState/ideaSubmit/ideaToggle/doorPos/doorAimed handles
  are unused by the harness.
- **Ship-token check:** exactly one stamped token in built
  index.html, `NF_SHIP_EE:950` (pre-ship value from demo6
  lineage; re-stamped only at SHIP). ideas.js inlined and
  `ideaCoord: "1.1.1/1.1.6/1.1.1"` present in the built file.
- **Next tick:** BUILD (return) — investigate the e2e CDP
  unsettled-await abort and add the missing coverage:
  idea-door e2e using the exposed handles, plus unit/e2e
  coverage for offline queue, single-insert flush on
  sign-in, and read-back state rendering. Item ships
  nothing this tick — a skipped ship, recorded.

## EE 961 — 2026-11-26 16:00 CST — BUILD (return) — Item #1: the in-game idea door

- **Stage advanced:** BUILD return (previous tick EE 955: TEST
  NOT GREEN, returned to BUILD). Builder subagent dispatched
  with a self-contained brief; build landed in a fresh tree,
  not staged, not shipped. Next tick: TEST (second attempt).
- **Tree:** fresh **demo14** copied (`cp -a`) from demo8;
  demo8 and demo9–demo13 untouched (verified: `diff -rq`
  demo8 vs demo14 shows ONLY cdp_test3.mjs and test3.mjs
  differ; game sources and rebuilt index.html /
  _built_module3.mjs byte-identical to demo8). No game-code
  changes were needed and no test seam was needed — the
  fault was entirely in the harness; `window.fetch` is the
  stub point and backendFlush / ideaState / ideaSubmit /
  ideaToggle were already exposed.
- **Root cause of the e2e CDP unsettled-await abort —
  HARNESS, not game code:** (1) the harness hard-coded CDP
  port 9335, shared by every sibling tree; concurrent
  sibling harnesses/ Chromes collide on it — a second
  harness's wsUrl() takes the first page on the shared port
  (another tree's Chrome) and its navigate/shutdown steals
  or kills this run's page mid-evaluate (sibling trees
  already carried private ports for exactly this: demo9
  9347, demo10 9341, with comments naming the collision).
  (2) `send()` had no timeout and no websocket-close
  handling, so a response that never arrives leaves the
  promise pending forever → Node exit 13 "unsettled
  top-level await", no summary — exactly TEST's failures
  at cdp_test3.mjs:155/:161. (3) `evalJs` assumed
  `m.result` always exists; a CDP error response crashed
  it and masked the real error.
- **Fixes (demo14/cdp_test3.mjs only):** URL → demo14;
  port 9335 → **9353** (private, reason commented);
  `send()` bounded 30 s wait that rejects NAMING the method
  + message id (fails the awaiting check by name, swallows
  nothing); CDP `m.error` responses reject with their text;
  `ws.onclose` rejects every pending call by name; `evalJs`
  guards a missing result and names the expression.
- **New coverage (demo14):** 15 new e2e `idea door:` checks
  — door at blocks (13,10) (doorPos 13.5/10.5), doorAimed
  live, panel toggles, ideaCoord 1.1.1/1.1.6/1.1.1; with a
  fake chart stubbed at the fetch level (insert appends,
  select reads back; the game's own probe/flush/read-back
  code does the work): signed-out submit via the real panel
  button queues exactly one `nova-phox-idea-outbox` entry
  with zero inserts while signed out, labelled "waiting on
  this machine"; sign-in flush = exactly one insert to
  1.1.1/1.1.6/1.1.1 (a single IDEA|v1| line), queue drained;
  read-back renders told → taken up → in the world · EE 999
  honestly in #idea-yours / #idea-lately as stub STATUS
  lines land. Plus 2 new unit `idea:` checks (one queued
  line resolves to exactly one read-back telling; empty
  chart reads back as zero tellings). Builder's own harness
  bug found + fixed during runs: the sign-in token must be
  set JSON-encoded (the game's LS wrapper JSON-parses it).
- **Builder's own checks (not the TEST verdict):**
  `node --check` clean on cdp_test3.mjs, test3.mjs,
  game3.js, ideas.js. **Unit: 273 passed, 0 failed**
  (271 prior + 2 new), exit 0. **Full e2e: NOT GREEN,
  reported plainly** — two full runs wrecked by host
  contention (load avg 28.9 on this 1.5-CPU shared cell,
  multiple sibling e2e/Chrome runs active): Run A
  (20.6 min) 119 passed / 36 failed, exit 1 — the suite now
  COMPLETES with a summary (previously impossible);
  failures were timing cascades (walking/guide/crossing
  timeouts, eco purse drift over the 20-min runtime) plus
  the idea-flush cascade from the since-fixed token bug
  (8 of 13 idea checks passed in-run). Run B (4.8 min,
  after the token fix) 41 passed / 17 failed, exit 1 —
  Chrome's CDP connection closed mid-run at the gesture
  section, now NAMED by the new hardening ("CDP connection
  closed while waiting for Input.dispatchMouseEvent",
  summary printed); never reached the idea section.
  **Focused idea-door probe** (the harness's idea section
  run standalone against demo14's built page,
  /tmp/idea_probe.mjs): **14 passed, 0 failed** — door,
  panel, offline queue = 1, sign-in flush = exactly 1
  insert to 1.1.1/1.1.6/1.1.1, read-back states + EE,
  panel close.
- **Build:** `python3 build3.py` rebuilt demo14 index.html,
  5,018,996 bytes, byte-identical to demo8's build;
  NF_SHIP_EE:950 stands exactly once — token unchanged.
- **Next tick:** TEST (second attempt) against demo14 —
  full unit suite must be fully green and full e2e must
  complete green with real counts; the TEST tick should
  run e2e when sibling e2e jobs are not saturating the
  host, since both BUILD-return full runs were defeated
  by contention / a Chrome death, not by the (now fixed)
  CDP abort. If TEST fails a second time, that triggers
  the loop's report-to-Will condition (same item fails
  TEST twice). Item ships nothing this tick — a skipped
  ship, recorded.

## EE 961 — 2026-11-26 16:03 CST — TEST (second attempt, partial) — Item #1: the in-game idea door — UNIT GREEN, E2E DEFERRED (not a failure)

- **Stage advanced:** TEST (previous tick EE 961: BUILD return
  in demo14). Verdict this tick: **INCONCLUSIVE — item stays
  at TEST**; this does NOT count as a second TEST failure.
  Item ships nothing this tick.
- **Unit suite (demo14, `node test3.mjs`): fully green —
  273 passed, 0 failed**, exit 0, including all 22 `idea:`
  checks (20 prior + 2 new from the BUILD return: one queued
  line resolves to exactly one read-back telling; empty chart
  reads back as zero tellings).
- **E2E: NOT RUN — deferred on host contention, per the
  BUILD-return tick's own guidance** ("run e2e when sibling
  e2e jobs are not saturating the host"). At TEST time the
  host (1.5-CPU shared cell) carried THREE concurrent sibling
  e2e suites — demo11 (started ~21:58 UTC), demo13 (~22:00
  UTC), demo18 (~22:01 UTC) — load average 17.07 at tick
  start, 11.79 at deferral. Both prior full e2e runs in the
  BUILD return were defeated by exactly this contention /
  a Chrome death, not by game code, and the focused idea-door
  probe there passed 14/0. Adding a fourth concurrent suite
  would manufacture a timing-cascade result, not evidence.
- **Next tick:** TEST continues — run full e2e
  (`node cdp_test3.mjs`, demo14, private port 9353) once
  sibling e2e suites have drained; full e2e must complete
  green with real counts before SHIP. If that e2e run fails
  on its merits, that is the item's second TEST failure and
  triggers the report-to-Will condition.

## EE 962 — 2026-11-26 16:08 CST — TEST (continued) — Item #1: the in-game idea door — UNIT GREEN, E2E DEFERRED AGAIN (not a failure)

- **Stage advanced:** TEST continues (previous tick EE 961:
  TEST partial, e2e deferred on contention). Verdict this
  tick: **INCONCLUSIVE — item stays at TEST**; this does NOT
  count as a second TEST failure. Item ships nothing.
- **Unit suite (demo14, `node test3.mjs`): fully green —
  273 passed, 0 failed**, exit 0, re-confirmed this tick
  including all 22 `idea:` checks.
- **E2E: NOT RUN — deferred again on host contention, worse
  than last tick.** At tick start load average 15.78 with
  sibling e2e suites active (demo11 run3 from 21:58 UTC,
  demo18, plus unnamed suites started 22:04–22:05 UTC);
  by 22:08 UTC load average had risen to **26.34** with
  **6 concurrent `node cdp_test3` processes** on this
  1.5-CPU shared cell. Running a fourth-plus full e2e now
  would manufacture timing-cascade failures, not evidence
  — the same contention that defeated both BUILD-return
  full runs. The focused idea-door probe from the BUILD
  return (14 passed, 0 failed) remains the latest e2e-level
  evidence for the door itself.
- **Next tick:** TEST continues — run full e2e
  (`node cdp_test3.mjs`, demo14, private port 9353) once
  sibling e2e suites have drained and load has fallen;
  full e2e must complete green with real counts before
  SHIP. If that e2e run fails on its merits, that is the
  item's second TEST failure and triggers the
  report-to-Will condition.

## EE 963 — 2026-11-26 16:13 CST — TEST (continued) — Item #1: the in-game idea door — UNIT GREEN, E2E DEFERRED AGAIN (not a failure)

- **Stage advanced:** TEST continues (previous tick EE 962:
  TEST continued, e2e deferred on contention). Verdict this
  tick: **INCONCLUSIVE — item stays at TEST**; this does NOT
  count as a second TEST failure. Item ships nothing.
- **Unit suite (demo14, `node test3.mjs`): fully green —
  273 passed, 0 failed**, exit 0, re-confirmed this tick
  including all 22 `idea:` checks.
- **E2E: NOT RUN — deferred again on host contention.**
  At tick start load average 1-min had fallen to 1.48 but
  5/15-min averages remained 10.94/13.41 with sibling e2e
  work still active (demo17 `cdp_test3.mjs` from 22:10 UTC,
  demo13 menu probe, fox-vision probe against demo11);
  during this tick's unit run load rose again to **15.37**
  on this 1.5-CPU shared cell, with a sibling
  `node cdp_test3.mjs` still running at tick end. Running
  the full e2e now would manufacture timing-cascade
  results, not evidence — the same contention that defeated
  both BUILD-return full runs. The focused idea-door probe
  from the BUILD return (14 passed, 0 failed) remains the
  latest e2e-level evidence for the door itself.
- **Next tick:** TEST continues — run full e2e
  (`node cdp_test3.mjs`, demo14, private port 9353) once
  sibling e2e suites have drained and load has fallen;
  full e2e must complete green with real counts before
  SHIP. If that e2e run fails on its merits, that is the
  item's second TEST failure and triggers the
  report-to-Will condition.

## EE 964 — 2026-11-26 16:20 CST — TEST (continued) — Item #1: the in-game idea door — UNIT GREEN, E2E DEFERRED AGAIN (not a failure)

- **Stage advanced:** TEST continues (previous tick EE 963:
  TEST continued, e2e deferred on contention). Verdict this
  tick: **INCONCLUSIVE — item stays at TEST**; this does NOT
  count as a second TEST failure. Item ships nothing.
- **Unit suite (demo14, `node test3.mjs`): fully green —
  273 passed, 0 failed**, exit 0, re-confirmed this tick
  including all 22 `idea:` checks.
- **E2E: NOT RUN — deferred again on host contention.**
  At tick start load average 6.57 / 16.81 / 16.25 on this
  1.5-CPU shared cell with sibling e2e suites active; at
  deferral two sibling `node cdp_test3.mjs` suites were
  still running (elapsed 07:40 and 06:39) and the 5-min
  load average remained 14.11 despite the 1-min average
  falling to 3.03. Adding a third concurrent full suite
  would manufacture timing-cascade results, not evidence
  — the same contention that defeated both BUILD-return
  full runs. The focused idea-door probe from the BUILD
  return (14 passed, 0 failed) remains the latest
  e2e-level evidence for the door itself.
- **Next tick:** TEST continues — run full e2e
  (`node cdp_test3.mjs`, demo14, private port 9353) once
  sibling e2e suites have drained and load has fallen;
  full e2e must complete green with real counts before
  SHIP. If that e2e run fails on its merits, that is the
  item's second TEST failure and triggers the
  report-to-Will condition.

## EE 965 — 2026-11-26 16:27 CST — TEST (continued) — Item #1: the in-game idea door — UNIT GREEN, E2E DEFERRED AGAIN (not a failure)

- **Stage advanced:** TEST continues (previous tick EE 964:
  TEST continued, e2e deferred on contention). Verdict this
  tick: **INCONCLUSIVE — item stays at TEST**; this does NOT
  count as a second TEST failure. Item ships nothing.
- **Unit suite (demo14, `node test3.mjs`): fully green —
  273 passed, 0 failed**, exit 0, re-confirmed this tick
  including all 22 `idea:` checks.
- **E2E: NOT RUN — deferred again on host contention.**
  At tick start load average 19.67 / 22.40 / 18.78 on this
  1.5-CPU shared cell, with sibling e2e suites running for
  demo7, demo16, and demo17 (`node cdp_test3.mjs`) plus a
  demo13 menu e2e probe; at deferral the 1-min average had
  fallen to 4.73 but 5/15-min averages remained
  16.34 / 17.01 and sibling `cdp_test3` processes were
  still active. Adding another full suite now would
  manufacture timing-cascade results, not evidence — the
  same contention that defeated both BUILD-return full
  runs. The focused idea-door probe from the BUILD return
  (14 passed, 0 failed) remains the latest e2e-level
  evidence for the door itself.
- **Next tick:** TEST continues — run full e2e
  (`node cdp_test3.mjs`, demo14, private port 9353) once
  sibling e2e suites have drained and load has fallen;
  full e2e must complete green with real counts before
  SHIP. If that e2e run fails on its merits, that is the
  item's second TEST failure and triggers the
  report-to-Will condition.

## EE 966 — 2026-11-26 16:36 CST — TEST (continued) — Item #1: the in-game idea door — UNIT GREEN, E2E DEFERRED AGAIN (not a failure)

- **Stage advanced:** TEST continues (previous tick EE 965:
  TEST continued, e2e deferred on contention). Verdict this
  tick: **INCONCLUSIVE — item stays at TEST**; this does NOT
  count as a second TEST failure. Item ships nothing.
- **Unit suite (demo14, `node test3.mjs`): fully green —
  273 passed, 0 failed**, exit 0, re-confirmed this tick
  including all 22 `idea:` checks.
- **E2E: NOT RUN — deferred again on host contention.**
  At tick start load average 32.20 / 23.95 / 19.66 on this
  1.5-CPU shared cell; at deferral (16:36 CST) the 1-min
  average had fallen to 8.35 but 5/15-min averages remained
  18.54 / 18.20, with sibling `node cdp_test3.mjs` suites
  still running (demo16 at ~10 min elapsed, demo19 at
  ~5 min, plus a demo13 menu e2e harness). Adding another
  full suite now would manufacture timing-cascade
  results, not evidence — the same contention that defeated
  both BUILD-return full runs. The focused idea-door probe
  from the BUILD return (14 passed, 0 failed) remains the
  latest e2e-level evidence for the door itself.
- **Next tick:** TEST continues — run full e2e
  (`node cdp_test3.mjs`, demo14, private port 9353) once
  sibling e2e suites have drained and load has fallen;
  full e2e must complete green with real counts before
  SHIP. If that e2e run fails on its merits, that is the
  item's second TEST failure and triggers the
  report-to-Will condition.

## EE 974 — 2026-11-26 — SCROLL PLANNER (registry entry, not a loop tick)

- `docs/SCROLL-REGISTRY.md` created: the single planner of record for
  `nova-phox-world` scroll claims (full-repo audit, EE 974).
- Ratified by Will 2026-11-26 17:30 CST: gravity keeps
  `1.1.1/1.1.5/1.1.1`; forms move to `1.1.1/1.1.6/1.1.1` (applied in
  the merged ship tree).
- **Consequence for Item #1 (idea door):** `ideaCoord` at
  `1.1.1/1.1.6/1.1.1` now collides with the ratified forms allocation.
  Planner allocation: **ideas -> `1.1.1/1.1.7/1.1.1`**. The idea
  door's next BUILD step must move `BACKEND.ideaCoord` to 1.1.7 before
  this item can merge into any forms-carrying tree. No game code was
  changed by the planner in this pass.

## EE 1207 — gameplay pass (Grok/xAI) — MR, not a ship

- **Item:** the first minutes, and the gravity dial a new fox can actually see.
- **Playtest:** headless Chrome against https://fox.phext.io/ (EE 1207) and local `builds/demo68`. On the live page, `#gdial`'s parent is `#nfconsole` (`display: none`); after clicking dial the box is 0×0. Three dots then lock says "That coordinate isn't on the chart." A short walk (about 2.7) plus one jump does not finish "walk, and jump once." Objective opens as "listen to Joy."
- **Tree:** `builds/demo70`, seeded from `builds/demo68`. Moved from `builds/demo69` per Will (Penelope keeps demo69 for Attempt 2). No other `builds/demoNN` edited. `NF_SHIP_EE:1207` inherited, not restamped. Not staged.
- **Gates:** unit 928/0, probe-gdial 25/0, Lite phext 1,867,484 B under 1.9 MB.
- **Stack:** producer delta on exo `cbbafe1`. Merge is the consumer's.
