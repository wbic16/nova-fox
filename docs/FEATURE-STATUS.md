# Nova Fox — Feature Status Tracker

**Will's standard (2026-11-26): "features aren't done until they actually ship and are playable live."**
A feature's status advances only on live evidence. Every ship event updates this tracker in the same commit series, naming the probe or check that earned the grade.
Grades: **SHIPPED-LIVE-PLAYABLE** / **SHIPPED-LIVE-UNVERIFIED** / **SHIPPED-STAGED** / **BUILT-NOT-SHIPPED** / **IN-FLIGHT** / **FAILED**.

Last full audit: EE 976–978, 2026-11-26 — `docs/FEATURE-AUDIT.md`. Live build at audit: EE 974, sha256 `5fbe7106f5cba2ae46b6dc3b6ea996955a502887d415742b22821c94d166ab40` (live bytes hash-identical to `builds/demo20/index.html`).

Everything ship: EE 987 — `builds/demo24`, sha256 `12d499546670d9a59fd47c3cd7de5786e93b30b8c4eb5d1281c7fc7fe07e3aef`, staged on awsbox at `~/fox-phext-launch/site/index.html` (hash-verified), awaiting Will's install. Full record: `reports/EVERYTHING-SHIP-REPORT.md`. SHIPPED-STAGED rows advance to live grades only after the playable verification pass on the installed build.

| Feature | Tree | Status | Evidence / gap |
|---|---|---|---|
| Sellable core (key redemption, leaderboard, Fork B economy) | demo4 | SHIPPED-LIVE-UNVERIFIED | Live: redemption input, purse, leaderboard render + shared-chart read verified. Gap: no real key redeemed; accrual unobserved |
| Ladder shop (42 rungs) | demo5 | SHIPPED-LIVE-UNVERIFIED | Live: shelves + 25 rung buttons render; buy path refusals correct (`beat`, `funds`). Gap: no funded buy exercised |
| Portal fix | demo7 | SHIPPED-LIVE-PLAYABLE | Live console `rift-straight`: "PASS crossed to Ashfall Haven in 0.6s" |
| Gravity in subspace + wooziness | demo10 | SHIPPED-LIVE-UNVERIFIED | Live: `gravity` read + subspace agreement; `gravityState` answers. Gap: shift not exercised (shared-world side effect) |
| Warp text | demo18 | SHIPPED-LIVE-UNVERIFIED | Markers live; rides real inversions only — none caused during audit |
| Loading trail | demo9 | SHIPPED-LIVE-PLAYABLE | `trailState()` after live load: fed 108 words, dropped 0 |
| Form editor | demo6 | SHIPPED-LIVE-PLAYABLE | Live edit re-metered 1,960 → 1,975 B and re-validated on the board |
| Fox Vision | demo11 | SHIPPED-LIVE-UNVERIFIED | Live: N at spawn correctly refuses outside the Hall. Gap: Hall-interior reveal not driven live |
| Strike hint | demo12 | SHIPPED-LIVE-UNVERIFIED | Markers live; no live probe short of the Shadow encounter |
| In-game console | demo15 | SHIPPED-LIVE-PLAYABLE | Five commands answered live (version/where/purse/gravity/rift-straight); zero page errors |
| Esc menu | demo13 | SHIPPED-STAGED | Merged in demo24 (EE 987). Jenkins nova-fox-e2e #4: menu e2e 33/0 in the merged tree |
| Speedrun modes | demo16 | SHIPPED-STAGED | Merged in demo24 (EE 987). Jenkins nova-fox-e2e #10 probe: arm / clock-start / race timer / abort legs pass |
| Joy banter wiring | demo17 | SHIPPED-STAGED | Merged in demo24 (EE 987); the 10 recorded takes hooked as JOY-### (35 takes embedded). Jenkins #10 probe: line surfaces after the lesson, engine counts the play |
| AWEF scheme preference | demo19 | SHIPPED-STAGED | Merged in demo24 (EE 987). Jenkins nova-fox-e2e #7: cdp_scheme_test 30/0 (one check amended to Joy's inscribed N-03 wording at merge). Mapping corrected to Will's canonical AWEF in demo26 (EE 995): F forward / A back / W left / E right (ruling 2026-11-26 19:25 CST); unit pins assert the authored mapping (435/435); Jenkins nova-fox-e2e-demo26-scheme #1 30/0 SUCCESS; full suite 79/8 = demo24 baseline set |
| Idea door (dev-loop Item #1) | demo23 (rebase of demo21) | SHIPPED-STAGED | Merged in demo24 (EE 987) with `ideaCoord` at the registry coordinate 1.1.1/1.1.7/1.1.1. Jenkins #10 probe: full telling round trip passes (queue → exactly one insert → read-backs; STATUS picked/shipped). Its full-suite sections sit behind the harness-environment portal abort (baseline-attributed, #5/#6/#8) |
| Narration script + Joy Voice 1 audio | demo22 | SHIPPED-STAGED | Merged first in demo24 (EE 987): 25 beats + both N-03 scheme variants embedded, silent beats takeless. Jenkins #6 covered-range legs + #10 capstone pass. The live-dialog check belongs to the playable pass |
| Test client (tooling) | engine/testclient | BUILT-NOT-SHIPPED | Tooling, not a game feature; verified portal/gravity/vision on demo7/10/11 trees |

## Update protocol

- On every ship: re-grep the new shipped file for each shipped feature's markers, re-fetch the live URL and hash-compare, and exercise what can be exercised live. Update the affected rows in the same commit series as the ship.
- A row may move to SHIPPED-LIVE-PLAYABLE only with the live probe named (command, session, or playtest) — never on tree tests alone.
- A feature whose live check fails is FAILED with the failure stated; silence is not a grade.
