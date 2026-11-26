# Nova Fox — Feature Status Tracker

**Will's standard (2026-11-26): "features aren't done until they actually ship and are playable live."**
A feature's status advances only on live evidence. Every ship event updates this tracker in the same commit series, naming the probe or check that earned the grade.
Grades: **SHIPPED-LIVE-PLAYABLE** / **SHIPPED-LIVE-UNVERIFIED** / **BUILT-NOT-SHIPPED** / **IN-FLIGHT** / **FAILED**.

Last full audit: EE 976–978, 2026-11-26 — `docs/FEATURE-AUDIT.md`. Live build at audit: EE 974, sha256 `5fbe7106f5cba2ae46b6dc3b6ea996955a502887d415742b22821c94d166ab40` (live bytes hash-identical to `builds/demo20/index.html`).

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
| Esc menu | demo13 | BUILT-NOT-SHIPPED | Unit 225/225, menu e2e 34/34; markers absent from shipped build |
| Speedrun modes | demo16 | BUILT-NOT-SHIPPED | Unit 224/224, e2e 9/9; absent from shipped build |
| Joy banter wiring | demo17 | BUILT-NOT-SHIPPED | Unit 249/249, e2e 123/10; absent from shipped build |
| AWEF scheme preference | demo19 | BUILT-NOT-SHIPPED | Unit 229/229 (run by the EE 976 audit — **no builder report exists**); `nf.scheme` absent from shipped build |
| Idea door (dev-loop Item #1) | demo21 | BUILT-NOT-SHIPPED | Unit 273/273; TEST failed twice (EE 955, EE 972). Blocker: `ideaCoord` must move 1.1.6 → 1.1.7 (scroll registry) before merge |
| Narration script + Joy Voice 1 audio | demo22 | IN-FLIGHT | Wiring build in flight; live game still speaks the old dialog (`aperture shift` ×0 in live bytes) |
| Test client (tooling) | engine/testclient | BUILT-NOT-SHIPPED | Tooling, not a game feature; verified portal/gravity/vision on demo7/10/11 trees |

## Update protocol

- On every ship: re-grep the new shipped file for each shipped feature's markers, re-fetch the live URL and hash-compare, and exercise what can be exercised live. Update the affected rows in the same commit series as the ship.
- A row may move to SHIPPED-LIVE-PLAYABLE only with the live probe named (command, session, or playtest) — never on tree tests alone.
- A feature whose live check fails is FAILED with the failure stated; silence is not a grade.
