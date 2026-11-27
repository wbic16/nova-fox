# Nova Fox build queue + integration protocol (Will, 2026-11-26 15:39 CST: "find a way to build quickly, try to keep up with my pace")

## The problem this solves
Feature-per-tree from a frozen base (demo5) means every feature pays a full
copy + full test suite, and reconciliation is deferred to ship time. Will's
direction pace in a live session is one ruling/feature every ~30 seconds;
the pipeline must absorb specs at that rate and integrate continuously.

## Protocol
1. ONE rolling integration tree: ~/workspace/nova-fox/integration/ — the
   next ship. It only ever moves forward; feature work lands here as it
   goes green, in landing order, one merge at a time, full suite after
   each merge batch.
2. Specs land in this file's queue the moment Will states them — a spec in
   the queue is dispatched work, never a note for later.
3. Builders work from the integration tree (delta briefs) when their
   feature doesn't conflict with in-flight work; a fresh numbered tree is
   used only when the integrator flags a conflict. Tree discipline stands:
   never edit a staged or live tree.
4. Verification is tiered: the builder runs the affected checks + unit
   suite; the FULL suite runs once per integration merge, not once per
   feature tree.
5. During a live direction session, a builder floor stays warm: queued
   specs are pulled continuously so dispatch latency never gates Will.

## Merge order for the current backlog (as reports land)
portal fix (demo7) → gravity subspace + wooziness (demo8) → loading trail
(demo9) → form editor (demo6, after its verification report) → Fox Vision
(demo11) → strike hint (demo12) → Esc menu (demo13) → console (demo15) →
speedrun (demo16). demo14 (forms+ideas integration, dev loop) folds in at
its ship step. The dev loop's staged builds supersede per its own rules.

## Queue (specs received, builds in flight or done — see reports)
- demo6 form editor · demo7 portals · demo8 gravity · demo9 loading trail
- demo10 dev-loop idea door · demo11 Fox Vision · demo12 strike hint
- demo13 Esc menu (8 items) · demo14 dev-loop integration · demo15 console
- demo16 speedrun modes

## Scroll claims
Every build that writes or reads the shared chart (`nova-phox-world`)
works from `docs/SCROLL-REGISTRY.md` — the planner of record for scroll
coordinates. Builder briefs must cite the registry: the coordinates the
build touches, by table row. New coordinates are allocated only by the
planner, from the registry's free ranges, and the registry entry lands
in the same commit as (or before) the first code that writes the
coordinate. An unregistered write is a defect and blocks the merge that
carries it. One owner per coordinate; coordinates are never reused.

## Feature status — Will's standard (2026-11-26)

A feature is not done when it is built. Its status in `docs/FEATURE-STATUS.md`
advances only on live evidence: BUILT (tree + tests) → SHIPPED (markers in the
shipped file) → LIVE-PLAYABLE (the core interaction exercised against
https://fox.phext.io/ itself). Every ship event updates
`docs/FEATURE-STATUS.md` in the same commit series, naming the probe or check
that earned each grade. Grades: SHIPPED-LIVE-PLAYABLE /
SHIPPED-LIVE-UNVERIFIED / BUILT-NOT-SHIPPED / IN-FLIGHT / FAILED. A feature
whose live check fails is FAILED with the failure stated — silence is not a
grade.

## Authored texts are canonical — Will's builder rule (2026-11-26 19:25 CST)

Will's authored texts are canonical. Where code and his script disagree,
the script wins, the code changes, and the disagreement is flagged the
same tick it is found — never silently resolved in code's favor.

Worked example, same day: demo19 found the game's AWEF mapping (W
forward / F back) disagreeing with Will's authored N-03 AWEF text (A
backwards, F forwards, W left, E right) and shipped the code's mapping
with the disagreement merely flagged. Will's ruling: "F is for
forward." demo26 corrected the code to the authored mapping — both
direction tables, the toasts, and the rift walk probe — and unit pins
now assert the authored mapping letter by letter.
