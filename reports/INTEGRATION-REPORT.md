# Nova Fox — Integration Tree Setup Report

**EE 958** (EE 1 = unix 1795327200; stamped 2026-11-26 21:40 UTC / 15:40 CST)
Charter: ~/workspace/nova-fox/BUILD-QUEUE.md (Will, 2026-11-26 15:39 CST)

## Base

- Integration tree: `~/workspace/nova-fox/integration/`
- Seeded as a byte-copy of **demo5** (the sellable-core + ladder + versioning line).
- demo5/index.html verified before copying: sha256
  `98207789e35e62b1b3399d60180b03fea223d9c488311332c60f1e4cf15a8f40` ✓
- integration/index.html after copying: sha256
  `98207789e35e62b1b3399d60180b03fea223d9c488311332c60f1e4cf15a8f40` ✓ (identical)

## demo14 fold-in: SKIPPED — tree not quiescent

demo14 (the dev loop's forms+ideas integration tree) was **not** folded in:

- Its e2e suite is **live right now**: PID 25055, `node cdp_test3.mjs` run from
  `~/workspace/nova-fox/demo14` under `timeout 1500`, started 21:31 UTC and
  still running at report time (elapsed 09:02 at 21:40 UTC).
- Its files were being written minutes before the check (index.html and
  _built_module3.mjs at 21:31:08 UTC, test3.mjs 21:30:55, cdp_test3.mjs 21:30:48).
- A tree with a live test process on it is a moving tree; merging it would
  import an unverified mid-run state. Per the setup brief and per
  BUILD-QUEUE.md itself, demo14 folds in **at its ship step**, under the dev
  loop's own rules — not in this setup pass.

## Baseline test counts (integration tree, as seeded)

- Unit suite (`node test3.mjs`, headless): **210 passed, 0 failed** — matches
  demo5's known baseline (210/210). Wall-clock for the suite: 21 s.
- E2E (cdp_test3.mjs) not run in this pass: the baseline that governs merges is
  the unit suite per BUILD-QUEUE.md tiered verification (builder runs affected
  checks + unit; the FULL suite runs once per integration merge). The e2e
  baseline will be established at the first merge.

## Merge order as pending reports land (per BUILD-QUEUE.md)

1. Portal fix (demo7) — PORTAL-FIX-REPORT.md
2. Gravity subspace + wooziness (demo8) — GRAVITY-SUBSPACE-REPORT.md
3. Loading trail (demo9) — LOADING-TRAIL-REPORT.md
4. Form editor (demo6, only after its verification report) — FORM-EDITOR-REPORT.md
5. Fox Vision (demo11) — FOX-VISION-REPORT.md
6. Strike hint (demo12) — STRIKE-HINT-REPORT.md
7. Esc menu (demo13) — ESC-MENU-REPORT.md
8. Console (demo15) — CONSOLE-REPORT.md
9. Speedrun (demo16) — SPEEDRUN-REPORT.md
- demo14 (forms+ideas, dev loop) folds in at its ship step, superseding per
  the dev loop's own rules.

One merge at a time, in this order, full suite after each merge batch. No
merge happens before its report lands.

## Setup wall-clock (measured)

- First command (charter read + base hash verify): unix 1795729197.
- Integration copy complete + baseline suite green: 55 s later (copy itself
  <1 s; unit suite 21 s of that window).
- This report written at unix 1795729252 — total setup ≈ **1 minute** from
  go to a verified, baseline-tested integration tree.

## Standing state

- The integration tree is NOT staged and NOT deployed. It only moves forward
  from here, one green merge at a time.
- No demoN tree was edited. demo14 was read (listing/process state) only.
