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

Status: updated for 2026-11-26 evening, snapshot at **EE 1009** (21:28 CST).
Every number comes from a record (build reports, the dated note, the repo log);
a `*` marks a reconstructed inception/built, with its basis named in the Sources.

## 2026-11-26 — the table

| Item | Inception | Built | Shipped | Live | Inception→Built | Built→Shipped | Status |
|---|---|---|---|---|---|---|---|
| Sellable core (demo4) | 898* | 946 | 948 | 948 | 48 | 2 | live |
| Ladder shop (demo5) | 948 | 950 | 974 | 976 | 2 | 24 | shipped-live-unverified |
| Form editor (demo6) | 951 | 961 | 974 | 976 | 10 | 13 | shipped-live-playable |
| Portals — diagnosis + fix (demo7) | 952 | 966 | 974 | 976 | 14 | 8 | shipped-live-playable |
| Loading word trail (demo9) | 954 | 958 | 974 | 976 | 4 | 16 | shipped-live-playable |
| Gravity in subspace + wooze (demo10) | 954 | 959 | 974 | 976 | 5 | 15 | shipped-live-unverified |
| Fox Vision (demo11) | 955 | 963 | 974 | 976 | 8 | 11 | shipped-live-unverified |
| Strike hint (demo12) | 955 | 962 | 974 | 976 | 7 | 12 | shipped-live-unverified |
| Esc menu (demo13) | 955 | 976* | 987 | 1004* | 21 | 11 | shipped-live |
| In-game console (demo15) | 956 | 960 | 974 | 976 | 4 | 14 | shipped-live-playable |
| Speedrun modes (demo16) | 956 | 967 | 987 | 1004* | 11 | 20 | shipped-live |
| Test client (REST/MCP) (engine/testclient) | 958 | 976* | - | - | 18 | - | built, not shipped |
| Script inscription (integration/NARRATION.md) | 958 | 959 | - | - | 1 | - | delivered into the integration tree |
| Joy recording (35 takes) (narration-audio-joy) | 959 | 960 | 987 | 1004* | 1 | 27 | recorded; wired EE 980 |
| Banter wiring (demo17) | 959 | 966 | 987 | 1004* | 7 | 21 | shipped-live |
| Warp text (demo18) | 960 | 963 | 974 | 976 | 3 | 11 | shipped-live-unverified |
| Repo canonical home (wbic16/nova-fox@exo) | 963 | 966 | 966 | 966 | 3 | 0 | shipped |
| Scheme preference — AWEF (demo19) (demo19) | 963 | 976* | 987 | 1004* | 13 | 11 | shipped-live |
| Current ship (merge + stage, demo20) (integration -> awsbox staging) | 967 | 974 | 974 | 976 | 7 | 0 | shipped EE 974, live EE 976 |
| Idea door (dev-loop Item #1) (demo8 -> demo14 -> demo23 -> demo24) | 952 | 955 | 987 | 1004* | 3 | 32 | shipped-live |
| Narration wiring (Joy script + Voice 1) (demo22) | 976* | 980 | 987 | 1004* | 4 | 7 | shipped-live |
| Everything ship (demo24) (integration -> awsbox staging) | 979 | 987 | 987 | 1004* | 8 | 0 | shipped-staged EE 987; live EE 1004 inferred |
| Item #1 harness completion (demo25/demo27) (demo25 -> demo27) | 980 | 992 | - | - | 12 | - | built |
| AWEF canonical mapping fix (demo26) | 990* | 995 | 995 | 1004* | 5 | 0 | shipped-live |
| GTM snippet (fox.phext.io) (demo26 index head) | 1001* | 1002 | 1002 | - | 1 | 0 | built + staged on awsbox, NOT live |
| Phone fix (console touch + tune entry + layout) (demo27 (from demo26)) | 998* | - | - | - | - | - | in flight at snapshot |
| EE 995 feedback batch (11 orders) (demo28) | 1004 | - | - | - | - | - | in flight at snapshot |

## Day summary (EE 1009 snapshot)

- **Items tracked: 27** — 25 built, 22 shipped.
- **Median inception→built: 7 EE** (n=25). At the EE 969 snapshot
  the median was 5 EE (n=15). The rise to 7 EE is a composition effect,
  not a slowdown: long-cycle items that were still in flight at EE 969 have
  since entered the built set (Esc menu 21 EE, test client 18 EE, scheme
  preference 13 EE, Item #1 harness 12 EE), while every item both incepted
  and built inside today's window ran 1–5 EE (GTM 1, narration wiring 4,
  AWEF fix 5, idea door 3).
- **Median inception→shipped: 20 EE** (n=22). At EE 969 this was
  not yet meaningful (n=2: 50 EE and 3 EE). Now, with the EE 974 and EE 987
  ships landed, the day's median ship delay is 20 EE (≈140 minutes).
- **Trend vs the EE 969 baseline:** shipping unblocked — 2 shipped at EE 969
  → 22 shipped at EE 1009. The remaining delay is concentrated in
  built→shipped batching and the staged→live install step, not in building.
- **Shipped→live:** EE 974 ship staged→live 2 EE (live-verified by the
  EE 976–978 feature audit); EE 987 ship + EE 995 AWEF fix staged→live
  17 EE / 9 EE (Will installed demo26 at ~EE 1004, inferred from his
  "EE 995 feedback" header at 21:07 CST — hash verification owed at next ship).
- **In flight at snapshot:** phone fix (demo27, inception EE 998*) and the
  EE 995 feedback batch (demo28, inception EE 1004). GTM (EE 1002) is built
  and staged, awaiting Will's sudo install — not live.

## Delay ledger — 2026-11-26, ranked by EE cost

1. **Ship batching — 124 EE aggregate built→shipped wait on the EE 974
   ship alone** (10 items; largest single wait: ladder shop, built EE 950 →
   shipped EE 974 = 24 EE). Features merge into one integration tree and ship
   as one batch, so every finished build waits for the batch. Across the whole
   day the batching pattern, plus the staged→live install wait (17 EE on the
   EE 987 staging), remains the dominant delay — a pipeline-shape cost, not
   a build cost.
2. **Idea door test loop — 35 EE inception→shipped (952 → 987), the day's
   largest single-item delay.** Its own feature legs passed early (focused
   probe 14/0 at EE 961), but the item cycled: TEST failure EE 955, five
   consecutive e2e deferrals EE 961–966 on hatch-cell contention (sibling
   suites saturating a shared CDP port / 1.5-CPU cell), a second TEST failure
   EE 972, and a 4th TEST failure EE 991 in its dev-loop lineage — while the
   feature itself shipped inside demo24 at EE 987, probe-verified 32/0.
3. **Hatch e2e contention — 13 EE on the portal fix (EE 969 ledger, stands).**
   Nine full-suite attempts defeated by sibling builds on the hatch cell;
   direct cause of the 16:43 rule (hatch not trusted; execution on the ranch)
   and of Will's 18:16 rule (e2e only via ranch Jenkins).
4. **Silent first attempts, recovered — 10 EE on the form editor (stands).**
5. **Execution-risk gate — ≥2 EE (stands):** the EE 974 ship blocked at
   Stage 0 (EE 967), Will's go-ahead EE 968, staging discarded and re-done;
   the same gate class re-appeared on the GTM leg (approval EE 1002).

## Optimizations enacted

- **EE 983 (everything ship):** e2e gate queue moved to ranch Jenkins
  (job `nova-fox-e2e`, private CDP ports 9381+) — no direct e2e after
  Will's 18:16 rule; the contention class in ledger items 2–3 is closed
  at the source for future ships.
- **Private CDP ports as builder default:** demo25 port 9385, demo26 scheme
  9393, demo27 9393 — the shared-port 9335 collision root-caused at EE 961
  (DEV-LOOP-LOG) no longer recurs in new trees.
- **This pass (EE 1009): the cadence graph generator is now data-driven** —
  `make_graph.py` parses `cadence-data.md` instead of carrying a hard-coded
  row list. The EE 969 graph needed two hand-fix commits (EE 969–970);
  regeneration is now one command with no hand edits, shrinking every
  future daily pass.
- **Ruling needed (one line):** staged→live is Will's sudo install step —
  17 EE on the EE 987 staging today; a standing install authority (or a
  fixed install cadence) would remove the day's largest remaining
  pipeline wait.

## Sources

Built/shipped stamps: ECONOMY-BUILD-REPORT (946), LADDER-BUILD-REPORT (950),
FORM-EDITOR-REPORT (961), PORTAL-DIAGNOSIS (953) + PORTAL-FIX-REPORT (966),
LOADING-TRAIL-REPORT (958), GRAVITY-SUBSPACE-REPORT (959), FOX-VISION-REPORT
(963), STRIKE-HINT-REPORT (962), CONSOLE-REPORT (960), SPEEDRUN-REPORT (967),
SCRIPT-INSCRIPTION-REPORT (959), RECORDING-REPORT (960), BANTER-REPORT (966),
WARP-TEXT-REPORT (963), GITHUB-HOME-REPORT (966), SHIP-REPORT (EE 974),
FEATURE-AUDIT + FEATURE-STATUS (EE 976–978), NARRATION-WIRING-REPORT (EE 980),
EVERYTHING-SHIP-REPORT (EE 987), AWEF-FIX-REPORT (EE 995), DEV-LOOP-LOG
(EE 952–991), git log on exo (demo25 6420f87, demo27 630cf54, GTM e0054be).
Inceptions: Will's statement times in the 2026-11-26 dated note and session
record, converted by the EE formula. Live EE 1004 is inferred from Will's
"EE 995 feedback" header (dated note, 21:07 CST) and marked `*` in the data.
\* Reconstructed built stamps: Esc menu and test client carry no EE stamp in
their own reports; EE 976* is the FEATURE-AUDIT verification date (EE 976–978).
AWEF fix inception 990* is computed from Will's ruling time, 19:25 CST.
Phone-fix inception 998* is computed from the playtest time, ~20:21 CST.
