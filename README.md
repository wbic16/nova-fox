# Nova Fox

The canonical home for all Nova Fox game design, materials, engine, and
documentation — established EE 966 (2026-11-26, Will's direction:
"keep all game design, materials, engines, and documentation here").

Nova Fox is the story of the player rescuing an entire world from
destruction, by collecting pieces of its heart that have been strewn
across the multiverse. Live build: fox.phext.io. Sold only via Gumroad
($6): phext.gumroad.com/l/nova-fox.

## Layout

- `docs/` — game design and programme documentation: PLAN, LAUNCH,
  ECONOMY, SOLVER, SCALE, STORYBOARD, DESIGN-PROGRAM, DEV-LOOP
  (+ DEV-LOOP-LOG), AUDIT, PLAYTEST, GRAVITY-DIAL, INTRO-VIDEO,
  playtest evidence, and the design/material notes from the build
  tree (DESIGN, PHYSICS, TEXTURES, palettes, dialog).
  - `docs/PLAN.md` §2.12 is held off-repo by design — see the keeper
    of the secrets build.
  - `docs/win-state-sealer.py` — the offline win-state sealer tool
    (embeds no seed, phrase, or state; see GITHUB-HOME-REPORT
    inventory for the inclusion test applied).
- `engine/` — the rolling integration tree (`integration/`), the
  gateway backend (`backend/`), the REST/MCP test client
  (`testclient/`), and benchmark tooling (`bench/`).
- `builds/` — the demo build trees, demo through demo19. Each is a
  self-contained single-file build with its sources and tests.
  demo4 is the build live at fox.phext.io (ship EE 948) at the time
  of this snapshot.
- `audio/` — narration recordings: `narration-audio/` (first set) and
  `narration-audio-joy/` (the canonical Joy set, recorded EE 960).
- `reports/` — build, diagnosis, and verification reports.
- `media/` — the intro video and its prepass work (`video/`), and
  playtest data (`playtest-data/`).
- `art/` — cover and thumbnail art (PNG/JPG plus the WebP originals).
- `work-logs/` — build work logs.
- `BUILD-QUEUE.md` — the integration protocol: one rolling tree,
  feature trees merge in order as their reports land.
- `JOY-BANTER.md` — Joy's hundred banter lines, canon (the draft it
  superseded is `JOY-BANTER-DRAFT-EMISE.md`).

## Snapshot note

This first push (EE 966) snapshots the working trees as they stood on
2026-11-26 ~16:40 CST. Trees mid-flight at snapshot time — demo7,
demo13, demo16, demo17, demo19, and the test client — land in a
follow-up push when their build reports arrive. The secrets build is
never part of this repo.
