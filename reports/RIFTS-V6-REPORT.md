# Nova Fox — Rifts v6 Build Report

_Built 2026-11-24, EE 572. Task: build Will's three portal/monster rulings
(2026-11-24 18:14 CST, PLAN.md §2.16) into the game — code, not documents._

## Builds

| | sha256 | size |
|---|---|---|
| Previous staged build (portals + palettes) | `e76963d19ed808aa2cd480b3aa12f919e7aef32d641ec78ff561ef63415694ba` | 4,841,893 B |
| **New build (rifts v6)** | **`afa761237ab508266dc68e8a7beb6fc9af4a54cfeab622b6bf51b15d4a0e5af6`** | **4,850,908 B** |

- New build shipped to the playtest preview only: `~/nova-fox-preview/index.html`
  on aletheia-core, served at http://aletheia-core.pizzly-halfmoon.ts.net:8931/
  (fallback http://100.88.154.1:8931/). Verified: hub file hash, HTTP body via
  127.0.0.1:8931, and HTTP body via the tailnet name all equal `afa76123…`.
- The previous build stays intact and identifiable: awsbox staging untouched,
  and the outgoing preview copy preserved on the hub as
  `~/nova-fox-preview/index.prev-e76963d1.html` (hash-verified `e76963d1…`).
- Production webroot (fox.phext.io) untouched; go-live remains Will's step.
- Gameplay verification: the game's own CDP e2e ran the full fresh-player
  path against the byte-identical local build (93/93, zero console errors) —
  the established pattern, since this VM's test browser is policy-blocked
  from tailnet HTTP and the hub has no browser; HTTP hash equality closes
  the chain to the served copy.

## Leg A — portal geometry from subspace distance: STOPPED, not built

Per Will's correction (2026-11-24 18:19 CST): "everything in this world is
derived from subspace, not simply 'inspired' by it" — no invented distances,
no hand-made table. A genuine search found **no realm coordinates anywhere**:

- `demo3/world.js` + `game3.js` (current source): REALMS = 11 entries
  `{id, name, seed, open}`; seeds are strings ("nova-prime", "ashfall-haven", …).
  Everything derives from `kernels.hash()` of seed strings. No coordinates,
  no positions.
- `demo/subspace.js` (v1): the 11 phext axes; pockets addressed at
  9-component coords `[1,1,1,1,1,1,1,2,pocketIndex]` — pocket addressing in
  the old room demo, not realm positions.
- `DESIGN.md` + `PHYSICS.md`: every place is an 11-component phext
  coordinate; realities are curated **dimension-triples** chosen from the
  11 axes (165 possible). **G31 explicitly records that WHICH triples
  constitute the canon is an open guidance item reserved for Will** — the
  design deliberately does not assign realms triples/coordinates.
- `~/workspace/phext/wiring.phext` (sha256 `4bdc4e5f…`, 14 scrolls): ranch
  nodes carry grid coordinates in row scrolls at 1.1.1/1.1.1/2.\<row\>.1 —
  but that is the ranch network map, not the game's subspace, and Nova
  Prime (home — one end of the only open portal pair) has no entry at all.
  Using it would conflate the ranch map with game subspace and still
  leave home unplaced.
- `nova-phox-world.phext` on awsbox (`~/nova-phox/data/`): 114 bytes,
  exactly one scroll — a deployment verify line at 1.1.1/1.1.1/1.1.1.
  No realm data.
- `~/workspace/nova-fox-restructure/*.md`: no realm coordinates.

**What is missing:** realm coordinates/triples exist nowhere in source,
design data, or world data. The one place they would live — the G31 canon
triples — is deliberately unchosen and is Will's reserved decision.
**Leg A cannot be built without inventing, which the correction forbids.
The ring therefore keeps its one fixed form in this build** (documented
here, not redesigned). D53 (geometry mapping) remains open behind the
same missing piece. When Will rules the canon triples (G31), Leg A
becomes mechanical: pairwise distance = coordinate distance in the
triple space, ring geometry from the coordinate difference.

## Leg B — portals persist in range, traversable both ways: BUILT

`demo3/game3.js`, rift section rewritten around a **link** model:

- `openRift(target)` now plants BOTH ends at once and records
  `state.riftLink = {id, target, a, b, crosses}`. Each end (`riftEnd()`)
  stores its landing ground (landX/landZ) and its ring position.
  The near ring stands 3.4 blocks ahead of the opener (unchanged);
  **the far ring stands 3.4 blocks BEHIND the landing** — a door you
  step out of is at your back. (First e2e run caught why this matters:
  with the far ring ahead of the landing, a player holding forward
  walked straight back through it and bounced home inside one walk —
  5 checks failed; behind-placement fixed all 5 with no test weakened.)
- `showRiftEnd(which)` renders the local end: ring in the far realm's
  palette accent, live portal view through to the other end's landing
  (new `portalDestInfo` type `"point"` for the return view).
- `riftStep()` — the ~25 s timer and consume-on-cross are GONE.
  Persistence is range: the link folds only when the player is more
  than **RIFT_RANGE = 30 blocks** from the local end — the world's own
  terms (30 is the outer band the portal view's presence cadence
  already used). Crossing (`crossThroughRift()`) does NOT consume the
  link; after landing, the far end becomes the local end. A re-arm
  rule (no new crossing until the player has stepped 2+ blocks clear
  of the ring he stepped out of) prevents hair-trigger re-crossing.
- `doCross(target, opts)` gained a `viaLink` landing: through a
  standing door you step out at the far end's ground and the door
  stays standing (the non-link path still uses `respawnAtArrival()`,
  which folds any rift — death and void respawns unchanged).
  Same-realm returns (pocket links) land at the opening ground and
  clear pocket state. One link at a time, as before: playing a new
  tune folds the standing link.
- Test hooks: `portalState()` now also returns `linkId`, `crosses`,
  and `end` ("a"/"b"), so tests can prove the SAME door was crossed
  both ways.

## Leg C — monsters native at spawn, carried across by rifts: BUILT

`demo3/world.js` (subspace layer):

- `spawnMonster` stamps `nativeRealmId` — where it rose; carrying
  never rewrites it.
- New `Subspace.carryMonster(m, toRealmId, gx, gy)`: moves the
  monster's realm and cell, moves its haunt/rest home with it (so it
  thereafter LIVES in the destination — steps, rests, despawns as a
  resident), resets rest ticks, and inscribes a `"carry"` WAL entry.
  Refuses the dead, wisps (they wait where they were set), and the
  guardian (it keeps its hall). Only `surface` monsters are carriable.

`demo3/game3.js` (view layer hooks):

- **Carried with the player:** on a crossing, live surface monsters
  within **RIFT_CARRY_RANGE = 6 blocks** of the ring cross with the
  player (`carryMonsterThrough`), emerging around the far ring at
  their relative offset, never closer than 2.4 blocks to it.
- **Wander-through:** in `riftStep`, a surface monster whose position
  enters the standing ring's trigger radius crosses on its own, with
  a 4-second per-monster cooldown against ping-ponging. (Monsters in
  the far realm don't step while the player is away — the subspace's
  existing simulation rule — so wandering happens at the local end.)

## Verification

- Unit (`test3.mjs`): **115 passed, 0 failed** — the prior 107 plus 8
  new carrying checks (nativeness stamped at spawn; carry moves
  realm/cell/home and preserves `nativeRealmId`; the carry is
  inscribed; wisp, guardian, and dead refusals).
- E2E (`cdp_test3.mjs`): **93 passed, 0 failed, zero console errors** —
  the prior 84 plus 9 new checks: the rift opens as a standing link;
  **it outlives the old 25-second fold** (a real 26 s in-range wait);
  crossing reaches Ashfall with the same link standing at end "b";
  a monster stood near the ring now lives in Ashfall with
  `nativeRealmId = "nova"`; a far monster stayed home; **the same
  door takes you home with no tune replayed** (one link, two
  crossings); out-of-range teleport folds the rift.
- No prior test was weakened: the only test-side change besides the
  new sections is a half-turn (`yaw += π`) before the return walk —
  the honest interaction with a door at your back.

## Open items this build does NOT settle

- **Leg A / D53** — blocked on realm coordinates (the G31 canon
  triples), Will's reserved decision. Nothing invented.
- D54 (range definition/edge cases) — this build rules by
  implementation: 30-block leash from the local end, documented in
  code; Will can overrule the number with one word.
- D55 (carrying mechanism) — implemented as ruled above (near-ring
  carry on cross + wander-through); D56 (establishment across
  generations) untouched, as designed.
