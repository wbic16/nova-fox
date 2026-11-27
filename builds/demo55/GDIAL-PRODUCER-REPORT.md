# Gravity dial — producer report

**Lane:** Grok / xAI. **Not a ship.** No `NF_SHIP_EE` stamp, no staging, webroot and Gumroad untouched. `NF_SHIP_EE:1081` stands as the seeded tree carried it.

## Item

The gravity dial, a microcosm of subspace.

- Morse chooses the next coordinate. A short tap is a dot, a long hold is a dash (the `/` key while the dial is open, or the dot and dash buttons). Enter locks.
- **S.O.S (`... --- ...`) brings the fox home** — Nova Prime, the arrival pad — with its own low rising cadence.
- Realm call letters and a nine-word digit coordinate lock a realm's subspace address. O is not a call (it is the middle of S.O.S); Orchid answers to R.
- Magnitude (Float ¼× through Crushing 2×) and frequency (Still through Keen, a hum of ±8% on the pull) both move when the range is open. Standard + Still is exactly the shipped `23` / `26`.
- **Full range** uses the flight gate: a paid license (`isGenerator`, the purchase scroll `1.1.1/1.1.3/1.1.1`) or `sub.dragonKilled`. Paid wins the name when both are true. Free play keeps the G flip, once per realm per day, on `grav|` lines at `1.1.1/1.1.5/1.1.1`. Unlocked shifts drop the daily cap and keep a 12s write gap. `gdial|` lines are the same owner's instrument (latest per player per realm) and never change a realm's shared down. Free foxes do not write them.
- Joy teaches Morse as the fox explores: text toasts only, no new recorded takes. S, then O, then S.O.S, then the rest of A–Z and 0–9 (all 36). A Leitner deck on this machine (`nova-phox-morse-deck`) — a miss returns to box 1, a clean key spaces out. Zero gateway traffic for the deck.
- Sidetone, confirmation, and the S.O.S cadence are WebAudio partials on a pentatonic. The dial's bar takes its color from the pitch. No new binary assets.

## Tree

`builds/demo54`, seeded from `builds/demo53`. No other producer tree was edited.

## Base commit

`29f0c06bc890d4cc0242684844347ccc0db2048c` (`demo53`, S-1).

## Delta footprint

Against the seeded tree:

- **new** `gdial.js` — pure module (Morse, gate, scroll lines, Leitner, pitches)
- **new** `probe-gdial.mjs` — headless scenario
- **edited** `game3.js`, `page3.html`, `build3.py`, `test3.mjs`
- **rebuilt** `index.html`, `lite.html`, `_built_module3.mjs`
- **registry** `docs/SCROLL-REGISTRY.md` — `gdial|` documented on the gravity scroll. No new coordinate. Next free remains `1.1.1/1.1.11/1.1.1`.

## Gates

- Unit: **667 passed / 0 failed** (609 stack baseline + 58 dial pins). `node --check` clean on `gdial.js`, `game3.js`, `test3.mjs`, `probe-gdial.mjs`.
- Probe: **25 passed / 0 failed** (`node probe-gdial.mjs`).
- Lite: **1,772,152 bytes** on disk, under the 1.9 MB cap. `NF_SHIP_EE:1081` once, unchanged.

## Stack position

After **S-1** (demo53), on the build-42 producer stack:

P-1 → P-2 → P-3 → P-4 → P-5 → S-1 → **gravity dial (demo54)**

Penelope's consumer can merge this tree onto demo53. The dial does not rewrite another producer's sources.
