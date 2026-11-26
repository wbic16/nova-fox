# DESIGN PROGRAM — Nova Fox, continued design

**Charter.** Authorized by Will, 2026-11-24 14:12 CST (EE 534):
"continue game design from here, spend eons on it from a human
perspective." This program continues the Nova Fox design from
PLAN.md's current state — slowly, at human depth, with no
rushing and no thinning. Each tranche is finished when it is
*good*, not when it is fast. The program produces design
documentation only: no code ships, nothing is published, no
decision is taken that is Will's to take.

Program task: **27.7.6/9.8.9/7.8.13** (the Nova Fox restructure).
Tree: `~/workspace/nova-fox-restructure/` — PLAN.md (the plan of
record), AUDIT.md, STORYBOARD.md, GRAVITY-DIAL.md,
INTRO-VIDEO.md, this charter.

## Standing disciplines (absolute)

1. **§2.12 of PLAN.md is NEVER-PUBLISH material.** Anything
   touching the hidden win, the phrase, the seal, the sword's
   source or function, capture-and-test internals, or the
   lexicons stays in §2.12 only. Public design (§2 and every
   other document in this tree) must never name how the sword
   is obtained or what it does; the power-up ladder's apex
   stops at the Nameless Sheath. After every tranche that
   touches PLAN.md, re-grep the public documents for leaks
   (sword mechanics, the win's terms, seal/pad/lexicon
   internals) and record the result in this file.
2. **Reserved decisions are Will's.** Every D-item in PLAN §6
   (D1–D47) belongs to Will. This program prepares options,
   analyses, simulations, and recommendations — it never
   rules. Prepared material is marked **PREPARED FOR WILL**
   and names the decision it serves.
3. **Player-facing copy stays under the veil:** plain English,
   the fiction's own words (rifts, the dark, flux), never
   phext/subspace/Exocortex jargon.
4. **Draft documentation only.** No code, no external
   messages, no purchases, nothing leaves this workspace
   tree. Numbers inherited from PLAN.md are drafts and are
   labelled as such wherever they are used.

## Ground the design stands on (from PLAN.md / AUDIT.md)

- **The offer:** free tier always free (Nova Prime + Ashfall
  Haven, the taught world, whole); paid tier $5 one-time for
  life on Gumroad; headline paid advantage is generator status.
- **Currencies:** tokens (draft name "flux") and credits.
  Credits have exactly two sinks (RULED): power-ups and
  gifting the game. Gift price draft: **100 credits**. Paid
  spew draft ratio: **1 credit per 10 tokens spewed**.
- **The game's verbs:** build (chisel degrees, grand brushes,
  1/8-blocks pending D8), gravity (flip; the dial's stops —
  Float ¼×, Light ½×, Standard 1×, Heavy 1½×, Crushing 2×),
  portals (chords and tunes open rifts), paint (palettes,
  brushes), music (the instrument, spectral flute, chip
  melodies), voice (yelling at the dragon), the dragon (find,
  engage, survive, slay; 40 friends in full armor and weapons;
  2 minutes from engaging; failure loses all equipped items
  to the hoard; winner take all daily), the solver (cycles at
  30% load earn credits), the realms (11 total: Nova Prime
  and Ashfall Haven taught; Ni-Knight, Logos Prime, Elven
  Path, Orchid Flow, Halycon Vector, Delta Wood, Best Willow,
  Plain View, Trust Fall shut), the daily pocket (solo,
  seeded, 300 points).
- **Audited power-up seeds (AUDIT §5):** the Lance, the fox's
  lamp, the Bright Charm, grand brushes (2x2x3 / 3x3x2 /
  4x4x2), chisel degrees, the spectral flute, chip-tune
  melodies, the Deep Stone hat (the game's one built grant).
- **Ladder price scale (§2.14, draft):** Band 1 ≈ 5–25,
  Band 2 ≈ 40–120, Band 3 ≈ 200–600, Apex ≈ 1,500–5,000
  credits; the gift at 100 sits between Bands 2 and 3.

## Tranches

### Tranche 1 — The power-up ladder, complete
Flesh PLAN §2.14 to the full set: 40+ power-ups across all
four bands, each with name, in-world effect tied to the
game's actual verbs, draft credit price on the established
scale, and sprinkle placement. Consistency pass against the
audited inventory and internally (no duplicates, no dead
items; the armor/weapon sets for the 40 complete and
coherent).
**Status: COMPLETE (2026-11-24)** — §2.14 now carries 44
power-ups (Band 1: 14, Band 2: 12, Band 3: 12, Apex: 6),
each with effect, draft price, and sprinkle placement.
Full armor defined as six pieces (2,250 credits); full kit
2,850 per fighter; company of 40 = 114,000 credits. Base
Lance and base lamp unpriced (D12 preserved); weapon tiers
carry the D12 conditional caveat. Leak grep: new §2.14
clean; §2.12 untouched (verified 463 lines, position only
shifted). One pre-existing item flagged to Will via the
coordinator's report: §2.8's public bullet names the dragon
lexicon's existence and size (recorded there by an earlier
ruling, before this program) — flagged, not altered.

### Tranche 2 — Economy model
Simulate the token/credit economy on paper: free generation,
paid spew, solver earn-rate candidates, the 100-credit gift,
the ladder's prices; flows, sinks, and inflation pressure
under several population scenarios. Output: ECONOMY.md with
assumptions stated; D12 and D44 prepared as options with
numbers.
**Status: COMPLETE (2026-11-24)** — ECONOMY.md (600 lines):
archetypes and stated assumptions, faucet/sink inventory,
three population scenarios × paid-share variants, gift-loop
compounding, and the derived numbers (time-to-gift 10
generator-hours; full kit 285 generator-hours; ladder sink
ceiling 23,450 credits/player; devoted-generator sink
exhaustion ≈ month 26 in the middle scenario). D12
prepared with a Fork B recommendation (marked as
recommendation only); D44 prepared with three rate
candidates and a middle recommendation (5 credits per
verified hour). PLAN.md untouched (§2.12 verified still
463 lines); ECONOMY.md leak-grepped clean.

### Tranche 3 — Solver protocol design
SOLVER.md: work-unit shape, assignment, the 30% load cap
(measurement and enforcement), result verification
(redundancy + spot-check design with the math), anti-farm
measures, client behavior (pause on battery/activity);
D42–D47 each prepared as options.
**Status: COMPLETE (2026-11-24)** — SOLVER.md (1,041
lines): work-unit shape and work classes, assignment with
leases, the 30% cap (recommended: 30% of total CPU as a
rolling 5-minute duty-cycled average; enforcement stated
honestly as economic, not technical), verification with
the math (recommended k=2 redundancy + 2% canaries + k=3
dispute escalation; fabrication-acceptance and
canary-detection tables), Sybil arithmetic, client
behaviour rules, and D42–D47 each prepared with a marked
recommendation. Cross-document consequence: verification
overhead ≈ 51% of contributed compute, so an honest hour
nets 2.45 credits at the middle D44 rate — ECONOMY.md §7.5
carries a reconciliation note doubling its solver
timelines (free solver-earner full kit ≈ 19.4 months).
PLAN.md untouched.

### Tranche 4 — Dragon systems, deepened
PLAN §2.8/§2.9/§2.11 deepened, public layer only: the daily
boss loop end to end; the three discovery shapes prepared as
a comparative analysis for Will's pick; the engagement
lockout as a state machine; help-for-small-groups mechanics
with the capability-average formula drafted; MVK terms; the
achievements master list fleshed to a full table. Anything
touching the hidden win stays out of the public text
entirely and is flagged to the coordinator, never written
into §2.
**Status: COMPLETE (2026-11-24)** — PLAN.md additions,
public layer only, no ruled text rewritten: §2.8 gained
the day-of-the-dragon loop, the discovery comparison
(PREPARED FOR WILL — D18; recommendation: Shape 1, sign in
the world), and the engagement-lockout state machine
(D18 clock-start and D21 re-engagement as named switches);
§2.11 gained the help formula (c_i = equipped-kit
fraction, C = group mean, draft M = 30 full-kit
equivalents, n_help = ceil((M − Σc_i)/C)) with two worked
examples; §2.9's list became a 35-row achievements master
table. §2.12 verified still exactly 463 lines; leak grep
clean (the two "lexicon" hits are the pre-existing ruled
§2.8 bullet, flagged in the tranche report).

### Tranche 5 — Launch-facing design
D1 prepared as three concrete tier-line options honoring the
Ashfall-free constraint; D2 (Gumroad deliverable) prepared
as options; STORYBOARD.md tightened into a shootable trailer
shot list.
**Status: COMPLETE (2026-11-24)** — LAUNCH.md: D1
prepared as three named tier-line options (A "The
Generator Alone", B "The Wider World", C "Everything
That Is Ready"; recommendation: B), D2 prepared as three
deliverable options (recommendation: (c) both, one key
path); STORYBOARD.md gained an appended trailer shot
list (8 shots, 38 s, every shot capturable in today's
staged build; existing scenes byte-identical, verified
by hash). PLAN.md untouched by this tranche.

### Tranche 6 — Scale: the decade ladder
Extend the design for exponential growth under Will's
ruling (2026-11-24 14:35 CST): complexity grows with the
userbase across decade events (10 → 10B); plus two ruled
amendments — sentients fill the void at the top of the
ladder, literally (14:38 CST), and Nova Fox tracks the
transition, with the global record as its instrument
(14:39 CST). Output: SCALE.md (the decade ladder entry by
entry; growth as an economic mechanism; the steady-state
branches; the base model's honest breaks, including
machine-speed time), a summary folded into ECONOMY.md
(§8), and the ruled principle recorded in PLAN.md §2.15.
Decisions prepared: D48–D52.
**Status: COMPLETE (2026-11-24)** — SCALE.md written
(header carries all three ruled premises verbatim);
ECONOMY.md §8 added; PLAN.md §2.15 inserted before §2.12
(position-only surgery — §2.12 span re-verified at
exactly 463 lines); leak greps clean across SCALE.md,
the ECONOMY.md addition, and §2.15.

## Program log

- 2026-11-24 (EE 534): program chartered by Will's directive;
  this file created record-first, before any tranche work.
- 2026-11-24: Tranche 1 complete — §2.14 fleshed to the full
  44-item ladder; verification: section read back, §2.12
  length confirmed unchanged at 463 lines, leak grep clean
  for the new material. Tranche 2 dispatched.
- 2026-11-24: Tranche 2 complete — ECONOMY.md written and
  verified (structure read back, ladder sums traced to
  §2.14, §2.12 length re-confirmed, leak grep clean).
  Tranche 3 dispatched.
- 2026-11-24: Tranche 3 complete — SOLVER.md written and
  verified (structure read back, §2.12 length re-confirmed,
  veil scan clean). ECONOMY.md §7.5 reconciliation note
  added by the coordinator for the verification-overhead
  correction. Tranche 4 dispatched.
- 2026-11-24: Tranche 4 complete — dragon systems deepened
  in §2.8/§2.9/§2.11; verification: formula read back,
  §2.12 span re-measured at 463 lines, leak grep clean.
  Tranche 5 dispatched.
- 2026-11-24: Tranche 5 complete — LAUNCH.md written,
  STORYBOARD.md appended (hash-verified append-only),
  final §2.12 check: 463 lines, unchanged. **Program
  complete: all five tranches landed and verified.**
  Decisions prepared for Will: D1, D2, D12, D18, D42–D47
  (each with a marked recommendation), plus D30/D31/D33/
  D34 formula variants and D19/D21/D22 switches drafted
  without picks. One flagged item stands from Tranche 1:
  §2.8's public bullet naming the dragon lexicon's
  existence and size — Will's earlier deliberate recording,
  flagged for his judgment, never altered by this program.
- 2026-11-24: Tranche 6 complete — SCALE.md (decade ladder
  under three ruled premises: decade complexity, sentients
  fill the void, Nova Fox tracks the transition),
  ECONOMY.md §8 summary, PLAN.md §2.15 principle recorded.
  Decisions prepared: D48–D52. §2.12 verified still
  exactly 463 lines; leak greps clean.
- 2026-11-24: Two-beat launch ruled by Will (15:41 CST) —
  "the dragon doesn't launch until Christmas." Thanksgiving
  (2026-11-26) ships the world; the dragon layer (boss,
  discovery, lockout, help/MVK, dragon achievements,
  hidden-win pipeline) lands at Christmas (2026-12-25).
  Re-scoped: PLAN §2.8 carries the launch-date note at its
  head; PLAN §6 gating annotated — launch-blocking is now
  D1–D5 + D12 (Lance inside D12), and D17–D22, D26,
  D29–D41 are Christmas-gated; LAUNCH.md gained the
  two-beat structure and its launch-blocking chain was
  re-scoped to match. The trailer needs no dragon footage
  (the shot list already has none).
- 2026-11-24: Early-game ruling (Will, 15:41 CST) —
  "early game is all exploration." The launch-phase loop
  is discovery and traversal: portals, palettes, the
  gravity dial; no combat pressure, no boss gating; the
  Lance is the guide's tool. Recorded in LAUNCH.md (Beat 1
  identity; D1 options A/B/C annotated exploration-shaped
  or not), PLAN §2.9 (the global board leads with
  exploration firsts; the dragon rows join at Christmas),
  and ECONOMY.md (launch flow hangs on exploration verbs,
  not kills).
- 2026-11-24: Shard-sales ruling (Will, 15:43 CST) —
  "shard the dragons lexicon into pieces small enough to
  chew. we'll sell them at $1 ea." Recorded in PLAN §2.8
  (the hoard, sold in shards; all shards equal citizens;
  moon-phase release scheme noted as still to be designed,
  Will's to direct) and ECONOMY.md §2.3 (new revenue note
  beside the $5 unlock; shard size filed as a new open
  decision — 1,000 / 10,000 / 100,000 phrases per shard,
  full-set gross $55,000 / $5,500 / $550 at $1 ea,
  arithmetic verified — with no recommendation; ranch
  sharding evidence is coming). §2.12 untouched through
  all three rulings — span re-verified at exactly 463
  lines after the edits; leak greps clean.
