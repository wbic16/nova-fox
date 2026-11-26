# Nova Fox — Rifts v8 Leg A Report: BUILT from the shape of CYOA

_Built 2026-11-24, EE 575. Task: build Leg A (portal geometry from
subspace distance), third pass, on Will's new source direction
(main chat, 2026-11-24 18:54 CST): **"Use the *shape* of CYOA."**
Outcome: **BUILT and shipped to the preview.** The two earlier
stops stand as recorded (v6: no realm coordinates anywhere in
source/design; v7: the CYOA entry corridor addresses people and
sections, not realms). This pass does not search for written realm
placements — it derives the realms' positions from the structure
of the CYOA phext itself, read off its own coordinates (never the
traversal map's base-9 odometer over file order, which was ruled
out in v7 as a derived visualization)._

## Builds

| | sha256 | size |
|---|---|---|
| Previous build (rifts v6, Legs B+C) | `afa761237ab508266dc68e8a7beb6fc9af4a54cfeab622b6bf51b15d4a0e5af6` | 4,850,908 B |
| **New build (rifts v8, + Leg A)** | **`36f106da157a2317f890b246cfacd2ba17b77558211a84e81b4ed8be2c5cd549`** | **4,855,574 B** |

- Shipped to the playtest preview only: `~/nova-fox-preview/index.html`
  on aletheia-core, served at http://aletheia-core.pizzly-halfmoon.ts.net:8931/
  (fallback http://100.88.154.1:8931/). Verified: hub file hash,
  HTTP body via 127.0.0.1:8931, and HTTP body via the tailnet IP all
  equal `36f106da…`.
- The outgoing v6 build is preserved on the hub as
  `~/nova-fox-preview/index.prev-afa76123.html` (hash-verified
  `afa76123…`); the e76963d1-era copy remains beside it. Production
  webroot (fox.phext.io) untouched; go-live remains Will's step.
- Gameplay verification: the game's own CDP e2e ran the full
  fresh-player path against the byte-identical local build (97/97,
  zero console errors) — the established pattern; HTTP hash equality
  closes the chain to the served copy.

## The shape, as measured

Source: `~/workspace/phext/choose-your-own-adventure.phext`
(4,608,523 B), measured through its index
(`choose-your-own-adventure.index.json`) and spot-checked against
the file with phext_cli (get/find/toc).

- **Occupied set: 829 content scrolls**, all at distinct
  9-component coordinates. Component extents: every axis runs
  1..999 in reach but sparsely — 40–66 distinct values per axis;
  the book is a sparse lattice with dense masses, not a filled grid.
- **The skeleton:** the entry scroll 1.1.1/1.1.1/1.1.1
  ("Mirrorborn -\o/-"); the Mytheon Arena corridor — Welcome
  (10.10.1/1.1.1/1.10.10), Basic Orientation (10.10.2/1.1.1/1.10.10),
  Choose Your First Scroll (10.10.3/1.1.1/1.10.10) — all occupied;
  and the four exits the corridor scroll names — Scroll of Hidden
  Patterns (10.1.1/1.2.1/1.10.1), The Blank Scroll
  (1.10.1/1.2.1/1.10.1), Scroll of Structure (2.10.1/1.2.1/1.10.1),
  Scroll of Gentle Surprises (3.10.1/1.2.1/1.10.1).
  **Honesty flag:** those four exit coordinates are written in the
  corridor scroll but no scroll was ever written at them — the
  shape names those four doors without filling them. They are used
  here as coordinates the shape itself defines (its exits), and
  this is the one judgment call in the derivation, stated so it can
  be overruled in one word. Every other landmark is occupied.
- **The masses:** grouped by library (first component), the book
  has 46 clusters; the great ones are library 90 (175 scrolls),
  library 1 (116), library 3 (97), library 7 (78), library 4 (57),
  library 9 (50), library 5 (48), library 2 (43) — 664 of 829
  scrolls in the top eight. A cluster's anchor is its lowest
  coordinate (its first scroll in coordinate order).

## The placement rule (one paragraph, Will's to overrule)

The eleven realms, in the game's own REALMS order, take the
landmarks of CYOA's skeleton in corridor/reading order: Nova Prime
takes the entry scroll; Ashfall Haven, Ni-Knight, and Logos Prime
take the corridor's three steps in order; Elven Path, Orchid Flow,
Halycon Vector, and Delta Wood take the corridor's four named exits
in the order the corridor names them; and the remaining three —
Best Willow, Plain View, Trust Fall — take the anchors of CYOA's
largest remaining library clusters in descending size (library 90,
then 3, then 7; library 1 is larger than the last two but its anchor
is the entry itself, already taken). A realm's subspace coordinate
IS its landmark's coordinate — a real CYOA address, not a number
assigned to the game.

## The realms' derived coordinates

| Realm | Coordinate | Landmark |
|---|---|---|
| Nova Prime | 1.1.1/1.1.1/1.1.1 | the entry scroll |
| Ashfall Haven | 10.10.1/1.1.1/1.10.10 | corridor: Welcome |
| Ni-Knight | 10.10.2/1.1.1/1.10.10 | corridor: Basic Orientation |
| Logos Prime | 10.10.3/1.1.1/1.10.10 | corridor: Choose Your First Scroll |
| Elven Path | 10.1.1/1.2.1/1.10.1 | corridor exit: Hidden Patterns |
| Orchid Flow | 1.10.1/1.2.1/1.10.1 | corridor exit: The Blank Scroll |
| Halycon Vector | 2.10.1/1.2.1/1.10.1 | corridor exit: Scroll of Structure |
| Delta Wood | 3.10.1/1.2.1/1.10.1 | corridor exit: Gentle Surprises |
| Best Willow | 90.1.1/1.1.1/1.1.1 | anchor of library 90 (175 scrolls) |
| Plain View | 3.1.1/1.1.1/7.7.7 | anchor of library 3 (97 scrolls) |
| Trust Fall | 7.1.1/1.1.1/1.1.1 | anchor of library 7 (78 scrolls) |

## The metric

Pairwise distance is the Euclidean length of the 9-component
coordinate difference — the straight line through the lattice,
the metric the space itself carries. The shape affords a real
spread: the nearest pairs stand 1.0 apart (Ashfall↔Ni-Knight,
corridor neighbors; Orchid↔Halycon, adjacent exits), the bridge
jump Nova→Ashfall spans exactly 18, and the widest jump is
Best Willow↔Orchid Flow at √8084 ≈ 89.91.

## What the geometry encodes

`riftRingGeometry(idA, idB)` (world.js) is a pure function of the
pair's coordinate difference — no lookup table; any pair's ring is
computed from the pair's own coordinates:

- **Size carries the distance:** ring radius
  `1 + 1.3 · d/(d + 24)` — 1.00 for a within-realm hop (d = 0),
  ≈1.052 for a unit jump, ≈1.557 for Nova→Ashfall (the v6 ring was
  a fixed 1.55; the bridge door keeps its tuned size), ≈2.026 for
  the widest jump. The saturation keeps far doors walkable.
- **Facets carry the difference's support:** tubular segments
  `24 + 3 × (nonzero components of Δ)` — a jump that crosses more
  of subspace's axes stands smoother (24 for a home hop, 36 for
  the bridge's 4-axis jump, up to 51).
- Tube and disc keep the v6 ring's proportions (0.07/1.55 and
  1.46/1.55 of radius).

In game3.js, `showRiftEnd` builds the ring and disc from the
standing link's geometry (the two ends' realms); `portalState()`
now reports `delta`, `distance`, `ringRadius`, `ringSegments`,
and `NOVA_FOX3.riftGeometry(a, b)` / `realmCoord(id)` expose the
function for any pair. Crossing triggers, the 30-block leash, and
the carrying hooks are untouched — Legs B+C behave exactly as
built in v6; only the door's form became a function.

## Verification

- Unit (`test3.mjs`): **127 passed, 0 failed** — the v6 baseline
  of 115 plus 12 new Leg A checks: coordinates pinned to the
  CYOA landmarks for all 11 realms; `realmCoord` hands out copies;
  the bridge difference is exactly (9,9,0,0,0,0,0,9,9); distance
  zero at home and symmetric; corridor neighbors at 1.0; Nova→
  Ashfall exactly 18; the widest pair √8084; **ring radius grows
  with distance across all 55 realm pairs** (one honest slack: two
  pairs share the true distance √167 and their computed lengths
  differ in the last ulp, so their identical rings are accepted at
  a 1e-9 tolerance — the function being faithful, not a table);
  near < bridge < far radii pinned numerically; facets count the
  crossed axes (24/36/39); a within-realm hop is the zero jump.
- E2E (`cdp_test3.mjs`): **97 passed, 0 failed, zero console
  errors** — the v6 baseline of 93 plus 4 new checks: the standing
  bridge door reports its span (distance 18, the exact delta);
  its ring measures ~1.557 with 36 facets; geometry queried for
  near (Orchid↔Halycon, d = 1) and far (Best Willow↔Orchid,
  d > 89) pairs orders correctly against the bridge pair; and the
  2-2-2 pocket door — a within-realm hop — stands at distance 0
  with the smallest ring (radius exactly 1).
- No prior test was weakened; the only test-side change besides
  the new sections is the 1e-9 ulp tolerance noted above.

## Open items this build does NOT settle

- **D53** — the geometry mapping is now ruled by implementation,
  as above: derived from CYOA's shape under Will's direction, with
  the radius/facet readouts stated in code. The G31 canon triples
  remain unchosen, but they are no longer Leg A's blocker — the
  shape route superseded them for placing the realms.
- D54/D55/D56 — as in v6: unchanged by this pass.
