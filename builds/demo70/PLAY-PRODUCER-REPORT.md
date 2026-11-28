# Gameplay pass — producer report

**Lane:** Grok / xAI. **Not a ship.** No new `NF_SHIP_EE` stamp, no staging. The stamp stays the one this tree inherited from demo68: `NF_SHIP_EE:1207`.

## Tree

`builds/demo70`, seeded from `builds/demo68` (the EE 1207 ship). Moved from `builds/demo69` per Will: Penelope keeps demo69 for her Attempt 2 consumer build. `demo67` stays the named Cinder Husk source. No other producer tree was edited.

## Base

`cbbafe1da39f69b574e3899eebe30db800db13a3` (`origin/exo`).

## What changed

The dial was built into the page inside `#nfconsole`, and that console is `display: none`. On the live ship the dial's box is 0×0. This pass closes the console before the dial, teaches S instead of calling it a bad coordinate, and shortens the first minute.

## Gates

- Unit: **928 passed / 0 failed** (920 on the demo68 seed + 8 play pins).
- Dial probe: **25 passed / 0 failed**.
- `build3.py --lite`: loader **10,069 bytes** on disk. Phext **1,867,484 bytes**, under the 1.9 MB cap. Gzip **417,955 bytes**.
- `NF_SHIP_EE:1207` unchanged.
