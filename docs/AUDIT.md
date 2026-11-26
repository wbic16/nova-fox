# AUDIT — Mytheon Arena → Nova Fox restructure

Program task: **27.7.6/9.8.9/7.8.13** · Opened 2026-11-24 (Will's directives,
main chat, 12:00–12:05 CST) · This audit verified against the files on
2026-11-24; every claim names its source.

## 1. The game build — current state

- **Current build is the portals + palettes build**, on top of v5:
  `~/workspace/nova-fox/demo3/index.html`, **4,841,893 bytes, sha256
  `e76963d19ed808aa2cd480b3aa12f919e7aef32d641ec78ff561ef63415694ba`**
  (verified locally this pass). Source reports:
  `~/workspace/nova-fox/PORTALS-PALETTES-REPORT.md` (build, EE ~205) and
  `~/workspace/nova-fox/V5-REPORT.md` (the v5 base, build `37c6c0a4…`,
  EE 194).
- **Tests at that build:** unit **107/107**, e2e **84/84**, zero console
  errors (per PORTALS-PALETTES-REPORT).
- **Staging:** the identical file sits on awsbox at
  `~/fox-phext-launch/site/index.html` — **re-verified from awsbox in
  this pass**: sha256 `e76963d1…`, 4,841,893 bytes. The live webroot is
  untouched; fox.phext.io still serves a pre-v5 playtest build.
- **Go-live is one sudo step, Will's hands only** (unchanged since v5):

  ```
  sudo install -o www-data -g www-data -m 644 ~/fox-phext-launch/site/index.html /sites/web/fox.phext.io/index.html
  ```

- The game is a single self-contained HTML file (intro film and poster
  embedded by `demo3/build3.py`). A backend exists for the shared world:
  `~/workspace/nova-fox/backend/gateway.py` + the fox-launch runbook
  (phext.tech game-login → 30-day token → marks posted to the shared
  world; gateway cap 120 inserts/min, keyed on the proxy IP — see
  UPDATE-CHECK-1.md; a mass-market surge would share that cap across
  players, a real scaling note for the plan).

## 2. What "unlock" means in the game today: nothing

There is **no paywall, entitlement check, license key, or tier logic
anywhere in the game**. Grep of `demo3/game3.js`, `demo3/world.js`,
`demo3/page3.html` for purchase/stripe/gumroad/subscription/premium
returns nothing commercial. The only `unlock()` in the code is the
narration **audio** unlock (the browser's gesture-before-sound rule).
Anyone who loads the page gets everything the game has. The tier line
the restructure draws is drawn from zero.

## 3. What the game currently gives away — mapped to the tier line

Will's ruling (12:02 CST): free tier always free; paid tier ($5,
one-time, for life) with obvious advantages. Everything below is free
today; the right column is this program's draft mapping for Will's
pick (full proposals in PLAN.md — nothing here is settled).

| In the game today | Draft side |
|---|---|
| Nova Prime (home realm) + Ashfall Haven — the only two open realms; the guide's crossing lesson (N-06) teaches Ashfall in the first minutes | **Free** — the taught world must stay whole or the tutorial breaks |
| The full guided opening (N-01…N-09), the instrument, rift chords, teleport-by-numbers | Free |
| The Deep Stone quest + its hat grant (see §5) | Free (proposal: the first prize stays free so the prize system is tangible before purchase) |
| Gravity flip (G key), per-realm remembered direction | Free |
| Single brush + standard chisel | Free |
| Local save (v2 format) + daily pocket play + daily board | Free |
| Intro film at the memory screen | Free |
| The other **eight realms** (Ni-Knight, Logos Prime, Elven Path, Orchid Flow, Halycon Vector, Delta Wood, Best Willow, Plain View, Trust Fall) — named, paletted, portal-viewable, but **shut** | Paid candidate |
| Gravity **dial** (strength, not just direction) — does not exist yet; design in GRAVITY-DIAL.md | Paid candidate (full range) |
| Daily-challenge **prizes** (hats/swag) — designed, shape unruled (DESIGN G32/G33) | Paid candidate |
| Grand brushes 2x2x3 / 3x3x2 / 4x4x2 | Power-up class — credits under the 12:05 ruling (see §5) |
| Shared-world presence: marks posted via the outbox, board ranking under your name (needs phext.tech sign-in today) | Paid candidate |
| Save download / multiple saves | Weak candidate (it exists free today; taking away is worse than never giving — flagged honestly in PLAN) |
| **Generator status + credits income** | **Paid — the headline advantage (ruled 12:04 CST)** |

## 4. Open items on the game (verified)

From `~/workspace/nova-fox/FEEDBACK-2026-11-22.md`, V5-REPORT,
PORTALS-PALETTES-REPORT, TEXTURES.md, DESIGN.md, and the Scroll Town
chat's open-items list (2026-11-23, updated by the later reports):

1. **Hand-drawn textures not wired.** The drawn atlas (18 tiles at
   256 px: `demo3/assets/textures/atlas-handdrawn-1536x768.png`) and
   portrait (`portrait-fox-288.png`) are QC-passed (EE 190), but
   `makeAtlas()` in the current build still draws the procedural
   "space lego" canvas. The exact wiring change is specced in
   TEXTURES.md ("Handoff for the v5 build") and was explicitly left
   undone there. Small, well-specified build leg.
2. **Item 17, second half — 1/8-size blocks: unbuilt, needs Will's
   ruling.** The block edge is the physics unit; halving it needs
   either a coordinate migration of existing inscriptions or a
   clean-world ruling (V5-REPORT §Item 17). A clean world is cheaper
   before strangers arrive — this interacts with the launch.
3. **Items 21 + 22 (time stream, WAL-rewind viewing): deferred to
   Wavelet 5 by Will's ruling** (2026-11-22 21:58 CST). Not blocked,
   not built.
4. **Eight realms shut.** Palettes and portal views are ready; which
   tunes lead to which shut realm is a travel-design decision no
   order has specified (PORTALS-PALETTES-REPORT, "Reachability").
5. **Daily cycle (world saved at midnight, new world generated) —
   designed, not built** (DESIGN.md "The daily cycle"). The daily
   *pocket* is built: `dailyPocket(dateStr)` in world.js, one seeded
   pocket per day, 300 pts, daily board ranks claimants.
6. **Daily prizes unruled:** DESIGN G32 (challenge shape: commons /
   race / both) and G33 (what a prize is mechanically) are Will's
   open questions. One prize grant *is* built — the quest hat (§5).
7. **Audio:** feedback #18 (glitchy audio) was addressed by the
   dialog pass + v5 (beats re-recorded, contact line replaced by
   synthesized noise), but pronunciation was **not ear-verified** —
   no listening pass has ever been possible in this pipeline.
8. **Frame rate on real hardware unmeasured.** Both perf passes used
   a software-rendered harness; the tick cost fell 64% and portal
   views cost ~nothing per frame, but a GPU-side frame measurement
   remains the honest follow-up (V5-REPORT §Performance).
9. **PHYSICS Law 3 tension:** the law's text frames gravity as
   per-room; v5 implements Will's per-realm ruling. The law's text
   is Will's to amend (V5-REPORT §Item 25). The gravity dial design
   (GRAVITY-DIAL.md) builds on the per-realm ruling.
10. **Storyline surfacing unruled:** DESIGN G26 — premise text at
    entry / in-world fragments / page-copy only. Bears directly on
    the listing and the first minutes.
11. **G27 (what rifts are)** and the G-series generally remain open
    guidance questions; none blocks the launch except where PLAN.md
    flags them.

## 5. Power-up inventory (for the credits ruling)

Will's ruling (12:05 CST): **every in-game power-up needs credits.**
Nothing in the game costs anything today; these are the existing
power-up-like items the credit pricing draft starts from (v5 record):

| Item | What it does | How it's got today |
|---|---|---|
| **The Lance** | The weapon — strikes monsters | Guide sequence places it after the first fight lesson (quest-critical) |
| **The fox's lamp** | Flashlight on V; lights the dark | Given in v5 (feedback #12) |
| **Bright Charm** | Stretches the lamp's throw; also grants a faint glimpse of hidden things in portal views | A held charm, found in the world |
| **Grand brushes** (2x2x3, 3x3x2, 4x4x2) | Shape whole volumes per stroke (up to 32 blocks in 3 presses) | Free; `,`/`.` cycle, choice persists |
| **Chisel degrees** | Shape a block down by degrees before it breaks | Free (the C/X/click chisel) |
| **Spectral flute** | Shift-drag plays the instrument by gesture; dragged tunes open rifts like keyed ones | Free (feedback #6) |
| **Chip-tune melodies** | The melody voice: pickup lift, the day's tune played back, the Deep Stone fanfare | Free (feedback #13) — borderline: presentation, not power |
| **The hat** | Cosmetic inscription granted at the Deep Stone ("a hat is granted, and written down: it stays", 250 pts) | Quest prize — the game's one built grant |

Drafting note for PLAN: which of these count as "power-ups" under
the ruling vs core verbs every player needs (the Lance is the only
weapon; the free tier's quest is unfinishable without it) is a
decision the plan puts to Will with options — the ruling prices the
category, the inventory defines its members.

## 6. Mytheon Arena — what exists to restructure

- **Stripe only.** One product ("Mytheon Arena"), one $5/month
  recurring price, one payment link — verified in today's Stripe
  inventory (parent chat). **Zero sales, ever**: the account's
  all-time successful charges are 0. No subscriptions exist to
  migrate or cancel.
- **No separate Arena codebase exists** in the record or the tree.
  The name also lives as fiction inside CYOA (the Mytheon Arena
  scrolls, 10.10.1–10.10.3/1.1.1/1.10.10 — the traversal-doctrine
  material), which is story content, not a product artifact.
  "Restructure into Nova Fox" therefore means: the commercial
  offering becomes Nova Fox; the Stripe objects are retired or
  replaced (listed in PLAN.md for Will's approval — **nothing in
  Stripe has been changed by this program**).
- **Gumroad account state: unknown.** No Gumroad record exists in
  memory, notes, or the Revenue chat. Whether an account exists is
  a flagged question for Will in PLAN.md.

*Audit by Emise, 2026-11-24. Sources read this pass: V5-REPORT.md,
PORTALS-PALETTES-REPORT.md, FEEDBACK-2026-11-22.md, REVIEW-1.md,
DESIGN.md, TEXTURES.md, UPDATE-CHECK-1.md (via record), demo3 code
(grep + targeted reads), video/ (ffprobe), awsbox staged file
(sha256 re-verified via the hub route).*
