# Nova Fox — Scroll Registry

**The planner of record for every scroll coordinate on the shared chart.**
One phext is shared: `nova-phox-world` at phext.tech, written through the
gateway (`POST /api/v2/insert`, token-flushed outbox) and read back with
`GET /api/v2/select`. Every write in the game is an insert — all scrolls
below are **append-only**; no `/api/v2/update` writer exists anywhere in
the tree. The gateway enforces the phext name, coordinate format, and an
insert rate (~115/min held under its 120/min cap) — it has **no**
per-coordinate allowlist, so this registry is the only allocation
authority. Role created by Will, 2026-11-26 17:30 CST: *"have all nova
fox scroll claims audited and managed by one planner."*

## The table

| Coordinate | Owner | Constant | Writers | Readers | Semantics | Status |
|---|---|---|---|---|---|---|
| 1.1.1/1.1.1/1.1.1 | Inscription log (core backend, demo4) | `BACKEND.logCoord` | Game: backendFlush log segment (all builds demo4+). Ops: deploy smoke insert, engine/backend/fox-launch/install.sh | Loading trail (raw-text read); gateway round-trip checks | Append-only | **Live** (demo4 at fox.phext.io) |
| 1.1.1/1.1.2/1.1.1 | Leaderboard — purchase-number board, marks, standings (demo4) | `BACKEND.boardCoord` | Game: backendFlush board segment | backendFlush read-back; loading trail; install.sh health check | Append-only | **Live** |
| 1.1.1/1.1.3/1.1.1 | Purchase record — claims in order (D1) (demo4) | `BACKEND.purchaseCoord` | Game: ecoOutbox via queueEcoLine | backendFlush read-back (first-claim order) | Append-only | **Live** |
| 1.1.1/1.1.4/1.1.1 | Economy ledger — gift issues/redeems, hand-downs (D12) (demo4/demo5) | `BACKEND.ecoCoord` | Game: ecoOutbox via queueEcoLine | backendFlush read-back; loading trail | Append-only | **Live** |
| 1.1.1/1.1.5/1.1.1 | **Gravity** — one line per shift; a realm's latest line is its down (demo10) | `BACKEND.gravityCoord` | Game: queueEcoLine gravity lines (demo10, demo18) | select read-back at boot + flush (demo10 game3.js) | Append-only; latest line per realm wins | **Built** — in the merged ship tree |
| 1.1.1/1.1.6/1.1.1 | **Player forms** — the shapes foxes wear (demo6) | `BACKEND.formCoord` | Game: queueEcoLine `form\|` / `formoff\|` lines | select read-back → `parseFormChart` (forms.js) | Append-only | **Staged** — coordinate applied in the merged ship tree (see Ratification) |
| 1.1.1/1.1.7/1.1.1 | **Player ideas** — tellings at the idea door (demo8) | `BACKEND.ideaCoord` | Game: ideaOutbox (idea-door builds) | select read-back → `BACKEND.ideaRows`; dev-loop harvest | Append-only | **Allocated** (planner, this registry) — code adoption pending, see C2 note |
| 1.1.1/1.1.8/1.1.1 | **Wormholes** — tunnels a player crafts between two realms; shared across all players, permanent (demo34, EE 1034 batch) | `BACKEND.tunnelCoord` | Game: ecoOutbox via queueEcoLine `tun\|` (craft) / `tunx\|` (retire) lines | select read-back → `parseTunnelScroll` / `resolveTunnels` (world.js) | Append-only; reads resolve the standing set — one tunnel per (crafter, realm-pair): a new craft between the same pair retires that crafter's old one (`tunx` written before the replacement `tun`) | **Built** — in the demo34 ship tree |

## Allocation rule

1. **Registry first.** A new shared scroll exists only when this file
   names it. The registry entry lands in the same commit as — or before —
   the first code that writes the coordinate.
2. **Unregistered writes are defects.** Any code path inserting to a
   coordinate not in the table above is a build defect, on the same
   footing as a failing test: it blocks the merge that carries it.
3. **One owner per coordinate.** A coordinate has exactly one owning
   feature. A second feature that needs shared space takes its own
   coordinate from the free ranges; it never shares, namespaces inside,
   or prefixes its way into another owner's scroll.
4. **Coordinates are never reused.** A retired scroll's coordinate stays
   retired. History on the chart is append-only; reuse would corrupt
   every reader's parse of the old lines.
5. **Builder briefs cite this registry.** Every build that touches the
   backend names the coordinates it writes and reads, from this table
   (see BUILD-QUEUE.md, "Scroll claims").

## Free ranges

The established row is `1.1.1/1.1.N/1.1.1`, allocated sequentially:

- N = 1 log · 2 board · 3 purchase · 4 economy · 5 gravity · 6 forms ·
  7 ideas (allocated, unadopted) · 8 wormholes (demo34)
- **Next free: N = 9** — `1.1.1/1.1.9/1.1.1`, then 10, 11, … in order.
- Allocate sequentially; do not skip numbers to "save" them, and do not
  squat a coordinate in code before its registry entry lands.

Out of scope (not shared-chart claims, not allocated here): coordinates
inside a form's own phext document (forms.js frame addressing), world.js
realm coordinates (world-internal subspace addressing), and local
per-player storage. They never touch `nova-phox-world`.

## Ratification — gravity / forms, 2026-11-26

The integration merge found demo6 (forms) and demo10 (gravity) both
claiming `1.1.1/1.1.5/1.1.1` — each feature's docs claiming the scroll,
discovered only at merge time. **Will ratified the resolution on
2026-11-26 (17:30 CST): gravity keeps `1.1.1/1.1.5/1.1.1`; forms move to
`1.1.1/1.1.6/1.1.1`.** The forms move is applied in the merged ship tree
(single-constant change to `BACKEND.formCoord`, commented in place).

**Planner's C2 note (consequence of the ratification):** `1.1.1/1.1.6/1.1.1`
was already claimed by the idea door (`ideaCoord` in the demo8 lineage —
demo14/demo20/demo21 — allocated by the dev loop as the next free
coordinate while forms still held 1.1.5). To keep one-owner-per-coordinate
true after Will's ruling, the planner allocates **ideas →
`1.1.1/1.1.7/1.1.1`** (table above). Idea-door code still writes 1.1.6
today; it must adopt 1.1.7 before the idea door merges into any
forms-carrying tree. Until adoption, 1.1.6 has exactly one live writer
in any single tree lineage — forms in the ship lineage, ideas in the
dev-loop lineage — and the two lineages must not merge until the move
lands. Full evidence: SCROLL-AUDIT-REPORT (2026-11-26), collision C2.

## History

- 2026-11-27 — Wormholes allocated `1.1.1/1.1.8/1.1.1` (EE 1034
  feedback batch, demo34): crafted tunnels are shared subspace records
  under gravity's append-only discipline — `tun|` crafts, `tunx|`
  retires; replacement is per-crafter, per realm-pair (Will's ruling,
  2026-11-27 00:58 CST). Registry entry lands in the same commit as
  the first writer, per the allocation rule.
- 2026-11-26 — Registry created by the Scroll Planner (audit of the full
  repo: every coordinate literal censused, every BACKEND block read,
  every writer/reader call site grepped). Base four verified single-owner
  in all builds demo4+. Collisions C1 (forms/gravity at 1.1.5, ratified),
  C2 (ideas/forms at 1.1.6, ideas reallocated to 1.1.7), C3 (stale
  gravity claim embedded in builds/demo9/index.html, a superseded built
  artifact — its game3.js carries no gravity writer) recorded in the
  audit report.
