# Nova Fox — Delivery Cadence Tracker

Per idea/task: **inception → built → shipped**, measured in Exocortical Epochs
(EE = floor((unix − 1795327200)/420)+1; 1 EE = 7 minutes).

- **Inception** — the EE Will stated the idea, or it entered the pipeline.
- **Built** — the EE its build report landed with tests green.
- **Shipped** — the EE it was staged for install (or, for the repo, pushed).
- **Live** — the EE Will's install step put it in front of players.
- Delays: inception→built is our build delay; built→shipped is our pipeline
  delay; shipped→live is Will's install step — measured, never counted as ours.

Machine-readable twin: `cadence-data.md` (one record per item, append-only).
Graph: `cadence-2026-11-26.png`.

Status: backfill complete for 2026-11-26, snapshot at **EE 969** (16:58 CST).
Every number comes from a record (build reports, the dated note, the repo log);
a `*` marks a reconstructed inception, with its basis named in the Sources column.

## 2026-11-26 — the table

| Item | Inception | Built | Shipped | Live | Inception→Built | Built→Shipped | Status |
|---|---|---|---|---|---|---|---|
| Sellable core (demo4) | 898* | 946 | 948 | 948 | 48 | 2 | **Live** (fox.phext.io) |
| Ladder shop (demo5) | 948 | 950 | — | — | 2 | open, 19 at EE 969 | Built, unshipped |
| Form editor (demo6) | 951 | 961 | — | — | 10 | open, 8 | Built, unshipped (recovery pass) |
| Portals — diagnosis + fix (demo7) | 952 | 966 | — | — | 14 | open, 3 | Built, unshipped (diagnosis done EE 953) |
| Loading word trail (demo9) | 954 | 958 | — | — | 4 | open, 11 | Built, unshipped |
| Gravity in subspace + wooze (demo10) | 954 | 959 | — | — | 5 | open, 10 | Built, unshipped |
| Fox Vision (demo11) | 955 | 963 | — | — | 8 | open, 6 | Built, unshipped |
| Strike hint (demo12) | 955 | 962 | — | — | 7 | open, 7 | Built, unshipped |
| Esc menu (demo13) | 955 | — | — | — | — | — | In flight — age 14 EE at EE 969 |
| In-game console (demo15) | 956 | 960 | — | — | 4 | open, 9 | Built, unshipped |
| Speedrun modes (demo16) | 956 | 967 | — | — | 11 | open, 2 | Built, unshipped |
| Test client (REST/MCP) | 958 | — | — | — | — | — | In flight — age 11 EE at EE 969 |
| Script inscription | 958 | 959 | — | — | 1 | — | Delivered into the integration tree |
| Joy recording (35 takes) | 959 | 960 | — | — | 1 | — | Recorded; not yet wired into a build |
| Banter wiring (demo17) | 959 | 966 | — | — | 7 | open, 3 | Built, unshipped |
| Warp text (demo18) | 960 | 963 | — | — | 3 | open, 6 | Built, unshipped |
| Repo canonical home | 963 | 966 | 966 | 966 | 3 | 0 | **Shipped** (push to exo is the delivery) |
| Scheme preference — AWEF (demo19) | 963 | — | — | — | — | — | In flight — age 6 EE at EE 969 |
| Current ship (merge + stage) | 967 | — | — | — | — | — | In flight — age 2 EE at EE 969 |

## Day summary (EE 969 snapshot)

- **Items tracked: 19** — 15 built, 2 shipped, 1 live, 4 in flight.
- **Median inception→built: 5 EE** (n=15; ≈35 minutes). Without the sellable
  core — whose inception is the whole sale-day morning — the median is 4.5 EE.
- **Median inception→shipped: not yet meaningful** — only 2 items have shipped
  (sellable core 50 EE, repo home 3 EE). The day's story is in that gap:
  building is fast; shipping is batched.
- **Shipped→live: 0 EE** on the one install (demo4 staged and live inside EE 948).
- **Open built→shipped backlog: 78 EE aggregate** across 10 built-but-unshipped
  items, still growing until the current ship lands.

## Delay ledger — 2026-11-26, ranked by EE cost

1. **Ship batching — 78 EE aggregate and open.** Features merge into one
   integration tree and ship as one batch, so every finished build waits for
   the batch. Largest single wait: the ladder shop, built EE 950, still
   unshipped at EE 969 (19 EE). The ship itself only incepted at EE 967, when
   Will ordered the deploy. This is the day's dominant delay by an order of
   magnitude — and it is a pipeline-shape cost, not a build cost.
2. **Hatch e2e contention — 13 EE on the portal fix alone.** The fix leg
   (diagnosis EE 953 → built EE 966) burned nine full-suite e2e attempts over
   ~90 minutes, defeated by sibling builds saturating the hatch cell
   (PORTAL-FIX-REPORT). The same contention kept full e2e from ever completing
   on demo6 (5 attempts), demo11 (3 attempts), and demo3's confirmation re-run
   (~35 min ≈ 5 EE, harness Chromium refused to start). Direct cause of the
   16:43 standing rule: hatch is not trusted; execution moves to the ranch.
3. **Silent first attempts, recovered — 10 EE on the form editor.** The
   original demo6 builder ended without a result; the recovery pass is what
   landed it (FORM-EDITOR-REPORT, EE 961; inception→built 10 EE). The repo
   migration lost its first attempt the same way and still delivered in 3 EE —
   the recovery discipline works, but the first attempt's time is gone.
4. **VM replacements — ≥2 EE, folded into other legs.** This hatch instance
   was replaced twice inside the build window (boots ~13:07 and ~14:55 CST).
   demo16's full suite was lost once to a replacement (SPEEDRUN-REPORT);
   speedrun's 11 EE inception→built carries contention + replacement cost
   together (reconstructed from its report).
5. **Execution-risk gate — ≥2 EE and counting.** The ship was blocked at
   Stage 0 at EE 967 by a platform execution-risk check on the hub repo;
   Will's go-ahead came at EE 968; the first attempt's staging work was
   discarded and the ship re-dispatched. Still open at EE 969.

## Sources

Built/shipped stamps: ECONOMY-BUILD-REPORT (946), LADDER-BUILD-REPORT (950),
FORM-EDITOR-REPORT (961), PORTAL-DIAGNOSIS (953) + PORTAL-FIX-REPORT (966),
LOADING-TRAIL-REPORT (958), GRAVITY-SUBSPACE-REPORT (959), FOX-VISION-REPORT
(963), STRIKE-HINT-REPORT (962), CONSOLE-REPORT (960), SPEEDRUN-REPORT (967),
SCRIPT-INSCRIPTION-REPORT (959), RECORDING-REPORT (960), BANTER-REPORT (966),
WARP-TEXT-REPORT (963), GITHUB-HOME-REPORT (966), SHIP-REPORT (gate, EE 967).
Inceptions: Will's statement times in the 2026-11-26 dated note and session
record, converted by the EE formula (spot-verified: 14:35 CST = EE 948,
16:51 CST = EE 968 per the watchdog log). In-flight status at snapshot:
watchdog EE 968 (Esc menu, test client, demo19 still advancing).
\* Sellable core inception is reconstructed: the build dispatch is not
separately stamped in today's record; EE 898 is the D1 sale-day ruling
(08:40 CST) that defined the sellable core's scope.
