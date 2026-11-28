# The ship log — recent builds, as shipped

This file is the source of record for the "Recent builds" panel on
the start screen (W-5). build3.py parses the table below fail-closed
and bakes it into the build as the SHIP_LOG block, so the log
players see is the log that shipped them. Newest first. One row per
ship: the epoch it shipped within, the build's name, and one plain
line on what changed — the record's own words, no marketing voice.

The top row is the build being made: its EE reads `this` until the
consumer stamps the ship, when the row takes the ship's real EE
(the consumer refreshes this row at stamp time; in the running
game the row already shows the build's own stamp, the same number
the title's version row shows).

| EE | Build | What changed |
| --- | --- | --- |
| this | build 42 | The sell-ready build: mutable geometry and digging with a point, monsters that search, fight skills tier two, realms with character, the Solver, the gravity dial. |
| 1081 | demo41 | The roadmap panel stands in the game: what is on the way, and what already landed with its epoch on it. |
| 1073 | demo35 | The EE 1037 batch: the Heart drawn as a heart; the Shadow behind the Heart's gate, six hits and real phases; dash, charged strike, and ward; Joy's fight lines re-recorded. |
| 1046 | demo34 | The EE 1034 batch: wormhole tunnels bored through the world's own geometry, permanent and shared by every fox; item uses written plainly; monsters hunt in packs; the purse shows your coins; flight for paid foxes and dragon-slayers. |
| 1037 | demo32 | Two downloads from one build: the Full build, and the nimble Lite under its cap, its assets riding by manifest. |
| 1034 | demo31 | The EE 1023 batch: rift transit woven into the world itself; monsters aggro and flash red; opening lines at 1.4x; the sword equips and shows on the swing; waypoints to the hall; single-click carve. |
| 1032 | demo30 | The phone fix: gravity made reversible under the ruling, the console closable on touch, phone controls repaired. |
| 1023 | demo29 | The EE 995 batch: the intro plays once; realms take their own colours of the rainbow; the portal panel and the walk-through wormhole; Joy rides visible as the aperture wisp; the Small Sword at spawn. |
