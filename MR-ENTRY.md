# MR — Nova Fox LEG A: COLLECTIBLES ENCOUNTER (EE 1350)

- **Item:** Collectibles — the Homecoming, ENCOUNTER + SURFACE legs
  (COLLECTIBLES-DESIGN.md §5 legs 3+4), played-path halves of
  F-GAME-12/13/14/16 and the client surface of F-GAME-15.
- **Base:** 46cad88 (branch portraits-g12; unit baseline 1206/0).
- **Branch / worktree:** `encounter` in ~/nf-encounter (hub).
- **Producer stance:** merge-ready delta only. NOT staged, NOT
  stamped (NF_SHIP_EE token untouched, stands exactly once at its
  base value), NOT pushed. No e2e run — Jenkins is the consumer's
  gate.

## Unit

- Before: **1206 passed, 0 failed** (base 46cad88, re-verified in
  this worktree at EE 1348).
- After: **1238 passed, 0 failed** (`node test3.mjs`,
  builds/demo73, hub-side) — +32 pins, all `collect:`.
- One re-pin, named: `rift: surfaceStandY…` call-site count 5 → 6,
  following the A2-GRAV fixture-fix precedent — the encounter adds
  exactly one gravity-aware call site (the standing figures stand
  through surfaceStandY); the assertion's intent is unchanged and
  its comment in test3.mjs says so.

## What was built

- **New pure module `collectibles.js`** (ideas.js discipline: no
  DOM, no storage, no clock, no network; inlined by build3.py):
  registry index + record parsing (the exact shapes written by
  backend/import_collectibles_registry_v2.py), collection-scroll
  parsing with the gateway's header rule, the per-user collection
  coordinate derived byte-for-byte as gateway.py derives it
  (pinned against the computed fox-one vector
  3.207.16/173.174.7/137.184.52), placement, the meeting distance
  rule, beat text, the client state machine (queue in the
  gateway's accepted shape `{"character": id, "queued": true}`;
  answer folding where `already-home` reconciles to the server's
  original EE), the board line, and the book model.
- **Placement (stated deterministic rule):** a character's start
  cell is their registry id's FNV-1a-64 hash mod the 9216-cell
  grid over [-16, 80)² (the muffin table's ground); within a
  realm, entries in registry order probe forward by a fixed
  stride of 613 cells until the cell is free and clear of the
  Arrival clearing. Same registry in, same ground out, every
  visit. Standing height is the game's own surfaceStandY over
  the generated terrain (gravity-aware) — nobody floats or sinks.
- **The figures** follow the gummy bears' rendering idiom:
  block-built people whose colors derive from the realm's
  coordinate palette (paletteFor accent lerped toward accent2 by
  the id hash) — presentation from the realm coordinate per
  design §2 / F-GAME-7; no per-character art assets exist or were
  invented.
- **The meeting:** edge-triggered approach (entering
  COLLECT_MEET_RANGE fires; standing inside does not re-fire).
  The beat is templated ONLY from fields the record carries
  (name, epithet, realm, aliases) plus the design's own closing
  line. A first meeting posts to POST /api/v2/collect with the
  session token. `already-home` (from read-back or from a retry)
  plays the returning-friend variant and posts nothing — the
  character stays in the world either way; collecting is a
  meeting, not a removal.
- **Offline / queued:** no session, no connection, or a lost
  response queues the meeting locally (persisted, gateway queued
  shape) and the book shows "met — coming home"; the queue posts
  oldest-first on reconnect inside the backend cycle, and the
  landing EE is the gateway's.
- **Exactly-once client discipline:** an in-flight guard (two
  simultaneous posts issue exactly one gateway call — pinned), no
  post when the grant is already in the view, and read-back
  REPLACES the view with the server scroll's answer (a scroll
  headed by another identity is never trusted — pinned). Local
  state is a cached view only; the server scroll is the truth.
- **Surfaces:** statusBoardText carries "Brought home: N of T"
  with both numbers from read-back (registry header total +
  grant view; a pin proves the total is the caller's, and a
  source pin proves no roster literal stands in the block). The
  Homecoming book is a new Esc-menu panel (`collect-panel`): per
  realm, collected by name with the EE they arrived, queued by
  name as "met, coming home", and the unmet ONLY as realm hints
  ("N more wait in <realm>") — a pin asserts an unmet name does
  not appear. The book is the player's own book; no keeper
  character is named anywhere (the §3 keeper proposal is
  superseded; Joy is collectible and stands in Nova Prime like
  everyone else). Records for already-collected characters are
  read back wherever they stand, so the book names them before
  their realm is revisited.

## Footprint

7 files, +~1880/−10 in builds/demo73/:
collectibles.js (new), game3.js (encounter block between
COLLECT-ENC markers + 5 small hooks: backend cycle read-back/
flush, frame-loop mesh sync + tick, status board line, menu
panel wiring), page3.html (menu item + book panel + its CSS),
build3.py (inline the module), test3.mjs (+32 pins, 1 named
re-pin), _built_module3.mjs + index.html (regenerated by
build3.py; narration 35 beats embedded — not the degraded build).

## Fixture movements (producer evidence only)

Unit pins are producer evidence. The played-path PASS verdicts
belong to the consumer gate + independent verification at ship —
nothing below claims them.

- **F-GAME-12 — stays PARTIAL.** Gateway half PASS stands
  (EE 1340). Played-path half: producer evidence now exists for
  the client half of exactly-once — approach fires once
  (edge-triggered, standing does not re-post), the post carries
  the right character id, a lost response queues and its retry
  meets `already-home` and reconciles to the original EE with
  the count unmoved, and a simultaneous double-post issues one
  call. Consumer still owes the played meet → leave → return.
- **F-GAME-13 — stays PARTIAL.** No new played evidence claimed.
  Producer-side support pinned: the per-user scroll coordinate
  derivation matches the gateway's byte-for-byte, and a scroll
  headed by another identity is refused by the client parser —
  the second account's independence rests on those derivations
  plus the EE 1326/1340 gateway evidence.
- **F-GAME-14 — stays PARTIAL.** Registry half PASS stands
  (609, none zero). Placement half: producer evidence for the
  placement rule itself — deterministic, unique cells per realm,
  in-grid, Arrival-clear (60-character synthetic realm pinned);
  standing height is surfaceStandY in the glue. The played
  one-placement-per-realm visit is the consumer's.
- **F-GAME-15 — OPEN → PARTIAL (producer evidence).** The client
  surface now exists and is unit-pinned on its real surfaces:
  board count and book agree with the read-back view by
  construction (both render from it), collected show name + EE,
  uncollected show as realm hints only (unmet-name-absence
  pinned). Played-path agreement against the live server scroll
  is the consumer gate's verdict to give.
- **F-GAME-16 — stays PARTIAL.** Gateway half PASS stands. The
  client grants itself nothing by construction: grants enter the
  view only by folding a gateway `ok` answer or by read-back of
  the identity-headed scroll; the tamper path on the played
  surface remains the consumer's to exercise.

## Design gaps flagged (recorded, never smoothed)

1. **No beat/dialogue field in the registry records.** Records
   carry id, name, realm, aliases, provenance, section — no
   authored line. The meeting beat is therefore a template over
   those fields plus the design's closing line; no biography was
   invented. Authored beats (§3's "one authored beat in their
   own recorded voice") need a record field the registry does
   not carry today.
2. **The index carries realm NAMES, not realm ids.** The client
   maps name → id through REALMS' names. A realm renamed in
   either source would silently unplace its cast (entries for an
   unmatched name never render). Fail-visible in the book (realm
   sections come from the index itself), but the mapping is a
   string join the registry could retire by carrying the id.
3. **Coordinate overlap, inherited (not introduced here):** the
   registry INDEX lives at 1.1.1/1.1.6/1.1.1 (gateway
   REGISTRY_COORD; EE 1340 read-back), which is also the game's
   BACKEND.formCoord. Both readers are line-shape gated so
   neither misreads the other's lines, but one scroll cannot
   hold both contents; the EE 1340 read-back shows it holding
   the registry. The consumer should know the forms read-back
   and the registry read-back name the same coordinate.
4. **No per-character presentation fields.** Presentation
   derives from the realm coordinate + id hash per design §2 —
   there is nothing per-character in the record to derive from.
5. **Queued names in the book** come from records read back for
   the current realm (where the meeting happened); a queued
   character met in a realm not visited since cannot be named
   in the book until that realm is revisited — they count into
   their realm's hint meanwhile, never named from thin air.
