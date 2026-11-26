# Nova Fox — Multiversal Upgrade: Design Brief

Direction: Will Bickford, 2026-11-22. Design only — no build yet.
Original spec: `white-rabbit-spec.txt` (phext.io/white-rabbit.html).

## Prime directive (Will, 2026-11-22 17:09 CST, verbatim)

> "above all else, this thing has to be fun to play and result in +1 phext XP for the gamer"

Fun outranks every other value in this document — the thesis, the physics, the teaching, the technology. Any mechanic, law, or lesson that costs fun is cut or buried deeper under the veil, however true it is. And every player who plays leaves with **+1 phext XP**: one real increment of phext understanding, absorbed by playing rather than by being told, guaranteed by design — that is the game's real score and the teaching layer's acceptance test. A session that was fun but taught nothing failed the second clause; a session that taught but wasn't fun failed the first, and the first is named first.

## Thesis

> **"the fun arrives when you explore a slice of a reality you can't comprehend"** — Will

The player explores a 3-of-11 slice of an 11D reality they cannot fully
comprehend. Every mechanic exists to feed one experience: inferring a larger
reality from partial slices. Any element that makes the whole reality legible
at once — a global map, an omniscient minimap, a solved coordinate readout —
works against the thesis and is cut, however convenient it would be.

## The key

> **"the key is the mutability, every action changes subspace"** — Will

Subspace is writable. Every player action mutates the phext itself,
persistently, per phext semantics. **The state of the game IS the state of
the document** — there is no side database, no shadow save file. What this
means concretely:

- **Movement** inscribes the player's passage: the coordinate you stand on
  records that you stood there (a trail written into the scroll, in phext's
  own terms — the document remembers being read by feet).
- **Gravity warp** rewrites the room's gravity designation in the document;
  the next visitor — or the next projection — falls the new way.
- **Pocket opening** is an inscription: choosing dimensions writes new level
  data into subspace at that coordinate. The pocket didn't exist, then you
  chose, and now it does — in the document, not in a cache.
- **Portal traversal** moves you exactly where the corresponding phext break
  moves a reader, and the crossing is recorded at both ends.
- **Powerup use** consumes the glyph: the `*` you took is gone from the
  document, and what it did is written where it acted.

Consequence for the stack: phext-lattice is a *mutable* substrate, so game
state lives in the lattice. The WASM core reads and writes subspace through
phext-lattice; it keeps no state of its own worth saving.

**Consequences bind back** (Will's ruling, 2026-11-22): "consequences
matter back in subspace." The rendered world is a derived view (below),
but nothing that happens in it is merely cosmetic: events and outcomes in
the view — a fall, a defeat, a warped room, a scar — inscribe real changes
in the substrate. This closes the round trip: **derived going out, binding
coming back.** A consequence that stayed in the view and never reached
subspace would be a lie the document doesn't keep; the design does not
permit it.

**One shared open world** (Will's ruling, 2026-11-22): "one shared open
world, hyperspace coordinates" — there is one dungeon-phext, and every
player writes into the same document. The pocket you open is there for
the next player; the monster you wake is awake for everyone; the gravity
you warp stays warped. Shared world means shared consequences: the world
persists between visits and evolves — by Life, by monsters, by other
players' inscriptions — while any given player is away. (Guidance G9,
resolved.)

### Persistence — RAM, WAL, and the fold

How the shared world is held (Will's ruling, 2026-11-22): **"we'll load
into RAM and store WAL segments at runtime."**

- **Resident in RAM**: the world phext loads into memory as the working
  set. Reads and inscriptions happen against the resident copy, through
  the span index — never by re-reading or re-writing the whole document
  per action. (Sizing: see Processing limits — a 500 MB world measures
  ~1.1–2.4× its file size resident.)
- **WAL segments**: every runtime mutation appends a segment to a
  write-ahead log instead of re-serializing the document. An action's
  inscription is a ~1 KB append, not a 500 MB rewrite — this is what
  makes "every action changes subspace" affordable at world scale.
- **Recovery = snapshot + replay**: the document on disk is the last
  snapshot; the WAL segments after it replay on top. A crash loses
  nothing already appended.
- **Compaction is a player verb, and it is lossless** (Will's ruling,
  2026-11-22): "players can compact using multiversal phext, no state
  ever truly lost." Compacting is something players *do* in the world,
  not only an ops chore — and it never deletes: it folds state into the
  multiversal phext, where prior states stay addressable in the wider
  coordinate space. The invariant, plainly: **no state ever truly
  lost.** Compaction cost is therefore a fold/reorganization cost, and
  the WAL's history survives it. What stays open is policy — cadence,
  triggers, who may compact a shared region — Guidance G28.

### The reload law

> **"because only subspace is durable in this world"** — Will

On reload or re-entry, a view is re-derived from subspace, and it comes
back **similar but never quite the exact match — lots of derived detail
is lost, "and that's the point and mystery"** (Will). The seam is
architectural, and it is exact:

- **What was inscribed into subspace is durable**: it persists exactly —
  the snapshot, the WAL, the lossless fold keep it. Scars, tunes played,
  pockets opened, gravity warped: these come back as they were.
- **What existed only in the derived view was never stored**: the view's
  surface detail — the richness the derivation invented on the way out —
  is re-rolled on re-derivation. It drifts.

Both rulings hold at once: *no state ever truly lost* governs what was
inscribed; the reload law governs what was only ever derived. View detail
was never state, so its loss is not state loss. **Immutable =
inscribed; drifting = merely derived.**

In-fiction, *why* some things hold and others drift is unexplained — a
standing mystery for the civilization, kin to the dark matter problem,
and under the veil the game never explains it. The design consequence is
gameplay: players learn empirically which classes of things persist and
which shimmer, and that learnable seam — what to inscribe, what to let
drift — is itself a skill the game teaches by feel.

## Governing principles

1. **"Subspace reacts as you'd expect"** — Will. The substrate's native phext
   behavior IS the game physics. Portals bound and nest the way phext breaks
   bound and nest; coordinates address the way phext addresses. Nothing in the
   game contradicts how the substrate itself behaves. Where a mechanic's
   behavior is unspecified, the default is whatever phext itself would do.
2. **"Use simple rules for gravity, time, etc in subspace"** — Will. Every
   physics system is one sentence (see Simple Rules). The depth comes from
   the 11D structure and the projection choices, never from physics
   complexity.
3. **"The player is not told that subspace exists"** — Will. The veil:
   nothing in the game — UI, text, tutorial, naming — says that subspace,
   phext, or 11 dimensions exist. The player experiences slices, pockets,
   warps, the instrument, and monsters as the world's own facts, and any
   understanding of the deeper reality is earned through play. Mechanics
   must be learnable by feel and experiment; wherever a design element
   relied on explaining the substrate, it is rewritten to teach by
   experience. (The veil binds the game, not this brief — here we name
   subspace freely.)

## What Nova Fox already is

From the OG white-rabbit spec (phext.io):

- Levels are **text**: Base-88 encoded geometry and cartridges, **1 KB of
  uncompressed text per room**, authored in a text editor.
- **9 portal types**, one per phext structural break, each with a color:
  `_` scroll (red) · `&` section (green) · `@` chapter (blue) · `{` book
  (cyan) · `}` volume (magenta) · `|` collection (yellow) · `[` shelf
  (white) · `]` series (black) · `^` jump gate / library break (void).
- Glyph tables — Land: `=` earth, `~` water, ` ` air, `.` lava, `:` path.
  Stuff: `(` shield, `)` tool, `*` powerup, `+` life, `,` armor, `-` weapon.
  Interaction: `!` clue, `#` guide, `$` treasure, `%` chance.
  Gameplay: `?` save, `/` spawn.
- **Generative geometry**: neighboring cells fill in the blanks.
- **Flux (62 tokens)**: pseudo-random entropy — "background noise" filling
  most rooms, essentially incompressible.

The lineage behind the spec (from the todo.phext audit, 2026-11-08):

- **phorge** (wbic16/phorge, Mar 2024, partial build): a Rust CLI that
  transmutes a log of player activity through 24 SHA-512 hash dimensions
  into 1 KB of verifiable white noise plus a phext coordinate — the flux has
  a deterministic source, designed "to drive world geometry in a
  deterministic fashion" for Nova Fox.
- **Nova Phox** (wbic16/phext-inc business plan, Feb 2024): the planet-scale
  sibling — a hidden room inside a very large address space, a daily
  challenge for the whole human race.
- **Phext-Native MUD** (wbic16/phext-dot-io-v2, spec, by Lumen): rooms,
  entities, player state, and event logs all as phext coordinates.

## MOST — identified

Will: "MOST and that game need a major upgrade." **MOST = Magic Octopus
Standard Technology** (wbic16/platformer, private): a 2D isometric
multi-dimensional game, 5,714 LOC C#/WPF, last commit 2023-02-26. Its
MagicCoordinate is already 4D (W/X/Y/Z — mana drains by the Euclidean norm of
position; each axis generates a musical note via ChipTunes); progression runs
along Magic / Standard / Technology; quests are OQL state machines. Its `.t`
data files are proto-phext — they parse under the reference parser.

A modernization is already designed (2026-11-16, task 26.5.9/6.5.11/4.4.8,
`~/workspace/most-modernize/DESIGN.md`): Three.js iso renderer, Rust → WASM
core, and a full 9D maze. The multiversal upgrade in this brief is the same
direction at 11D, and the two games share one substrate and one stack. MOST's
own maze work is governed by its design doc; this brief governs Nova Fox and
the shared mechanics. Whether the Nova Fox MVP builds on MOST's scaffold is
Guidance G3.

## The upgrade in one paragraph

The dungeon is no longer a set of authored rooms. **The dungeon is the 11D
phext subspace itself** — one real phext, its scrolls the rooms, its
coordinates the addresses. The player never sees 11D. They choose **3 of the
11 dimensions** — C(11,3) = **165 possible projections** — and the chosen
slice renders as an explorable place. The other 8 dimensions don't vanish:
they press in as flux, as pockets, as falls in directions the slice can't
show. Endless exploration isn't a bigger map; it's the same incomprehensible
reality, sliced 165 ways, each slice writable.

Dimensions, in phext's own names (libphext): the nine structural axes —
**library, series, shelf, collection, volume, book, chapter, section,
scroll** — plus **line** and **column** inside the scroll. A projection
chooses any 3 of the 11.

### How many realities? — 165 vs ~10

Will's evaluation request (2026-11-22): "evaluate if we really need 165
parallel realities... maybe just like 10 lol." Honest answer: **no —
~10, and the design is better for it.** What 165 live realities would
actually cost:

- **State sprawl in the one shared document.** Every opened pocket is
  inscribed and persists for everyone. 165 realities multiply the
  pocket-space players can open into the same document — and under the
  escalation law, monster danger feeds on total subspace size. 165
  realities' worth of exploration inflates the danger commons for every
  player, everywhere, permanently. The math admits it; the game pays
  for it.
- **Learnability.** A projection is a 3-note chord. 165 chords is not a
  repertoire — nobody learns 165 tunes, so nobody builds the ear the
  thesis runs on ("comprehension by ear, earned"). The veil needs
  realities a player can *almost* learn: familiar enough to navigate,
  strange enough to stay incomprehensible. 165 is past almost.
- **Contrast.** Ten realities can each have a character — a feel, a
  gravity habit, a monster temper — that players learn to tell apart by
  ear and by eye. 165 curated contrasts is not authoring, it's noise;
  they'd blur into one undifferentiated many.

What ~10 buys: a learnable set of tunes; bounded, designable shared
state; realities with identities. **Working scope, per Will's lean: ~10
curated dimension-triples are THE realities of the world canon.** The
substrate still admits all 165 mathematically — that stays true, and
stays unspoken in-game (the veil): the game curates; subspace doesn't
mind. The exact number and which triples are Guidance G31.

## Storyline

> "the storyline is that they've conquered the galaxy but still can't
> figure out dark matter" — Will · "and then they discover rifts" — Will

The fiction: a civilization that has conquered the galaxy. Their ships,
their charts, their addresses all run on **hyperspace coordinates** — the
addressing frame the fiction itself uses for everywhere there is. And one
problem the conquest never solved: **dark matter**. Most of reality does
not answer to their instruments; it outweighs everything they can render,
and it stays dark. The thesis at the fiction's scale: they hold a slice —
the visible galaxy — of a reality they can't comprehend, and dark matter
is their name for the rest.

**And then they discover rifts**: places where the dark bulk touches the
visible — where things arrive that the charts say shouldn't exist, and
openings appear into places hyperspace coordinates shouldn't reach. The
rift is the first crack in the visible universe, and it is the anomaly
the game turns on: the player is one of the people sent in.

The mapping to the mechanics is one-to-one, with no new machinery. What
the fiction calls dark matter is the bulk of reality no slice shows —
the unchosen dimensions, pressing in as flux. A **rift** is where that
bulk touches a slice: a pocket opens along a rift; a monster crosses
into visibility through one (its blinking in and out *is* rift-crossing,
in the fiction's terms); and the instrument's chords find rifts and ride
them — a jump is a rift taken deliberately. Portals, in-fiction, are the
civilization's own charted structure; rifts are what the charts missed.
What rifts *are* — features waiting to be found, things Life grows, or
tears the instrument itself makes — is Guidance G27.

The veil holds throughout. **Hyperspace, hyperspace coordinates, dark
matter, and rift are the fiction's own words** — the civilization's
physics, spoken in-game freely. What is never spoken is the truth under
the fiction: subspace, phext, the 11 dimensions. The player lives the
civilization's ignorance from inside — the same words, the same charts,
the same dark.

## MVP — the smallest playable slice of the thesis

**Platform: web only** (Will's ruling). A static page in the phext.io /
apertureshift.com family; no native or client scope.

### Stack

- **Three.js** — renders the projected slice in the browser: the one slice
  of reality you're allowed to see, in 3D.
- **WASM core** — the game and subspace logic, compiled to WebAssembly; it
  owns the verbs (choose, move, warp, traverse, inscribe) and no rendering.
- **phext-lattice, optimized** — the substrate layer: the game reads and
  writes subspace through the lattice, and optimizing that read/write path
  is part of the work, not a later chore. Game state lives here (see The
  Key), nowhere else.

### What the player sees

- **A world is a view into subspace, derived from it, not literally 1:1**
  (Will's ruling, 2026-11-22). The rendered world is an interpretation
  generated from the phext — the view may be richer than the literal
  scroll contents (true 3D rooms and 3D characters built from what the
  scroll holds, not a transcription of its text grid) — but it is still
  derived *from* subspace: the document is the source of truth, and the
  view invents nothing the document doesn't ground. What this relaxes:
  fidelity to the literal glyph layout. What it does not: derivation —
  change the document and the view changes; the view never free-runs.
- A 3D room, so derived: the current slice of one scroll of the
  dungeon-phext, glyphs per the original tables as the view's ground,
  portal colors per the spec.
- Where they are, shown the world's way: the room's glyphs, the marks left
  in it, and the instrument's sounding notes. Never an address readout,
  never a dimension name — the veil (principle 3) binds every label.
- One arrow: which way is down. (Down is a fact about the slice, not about
  the world — see gravity.)
- Flux at the edges: noise where the unchosen dimensions leak in. It is not
  decoration; it is the other 8 dimensions, visible exactly as much as a
  slice lets them be.

### What the player presses

- **Move** — step along any of the 3 chosen axes (forward/back on each).
- **Play the instrument** — sound 3 notes; the chord is your next slice
  (see The Instrument). This is a move, not a menu: it happens in the
  world, it costs the turn, and it changes the world. The player is never
  told the notes "are" dimensions — they learn that tunes take them
  places.
- **Warp gravity** — flip down to up (MVP: flip only).
- **Enter portal** — step onto a portal glyph and cross.
- **Take / use** — step onto a Stuff glyph to take it; use is immediate.

### What happens

- **Choose 3 of 11 → a pocket opens** (in play: a chord on the instrument).
  "Whenever you choose dimensions, a pocket opens with new level data" —
  Will. Choosing is a *generative* act, not a re-render: the pocket
  contains level data that was not in the previous slice — generated
  deterministically from the coordinate and the chosen triple, phorge-style
  (hash the coordinate + triple → the room's foam), Life-evolved before you
  first enter (see Evolution), and **inscribed into the phext** the moment
  it opens. Re-choosing
  the same triple at the same coordinate reopens the same pocket, because
  it's written down now — and in the shared world, someone else may have
  written it down first: you can arrive at a pocket another player opened. This composes with the original spec directly:
  generative geometry fills the pocket's blanks from its neighbors, and the
  flux tokens are what the *unchosen* dimensions contribute to it.
- **Move** — you step within the slice; your passage is inscribed (The Key).
- **Warp gravity** — down flips. Everything loose in the slice — including
  you, mid-air — falls the new way. Metal Storm's verb, at 11D: in 2D there
  was one axis to flip; here down is one designated axis of the slice, and
  flipping it is the MVP form. (Re-axis — pointing down along a different
  chosen axis — is after the MVP.)
- **Portal** — crossing a portal moves you the way its phext break moves a
  reader: a scroll portal `_` takes you to the next scroll; the jump gate
  `^` (library break) is the way out — in the MVP, the goal.
- **Goal** — reach the jump gate `^` in the opened pocket and cross it. One
  dungeon-phext — the shared world — a handful of scrolls to start; a run
  is a visit: spawn `/`, explore, choose, warp, cross, and leave the world
  changed for whoever comes next. That is the whole MVP loop.

### Simple rules (each system, one sentence)

- **Gravity**: everything falls along one designated axis of the slice, in
  one direction, until it lands; warp flips the direction.
- **Time**: one action is one tick; the world changes only on ticks.
- **Generation**: a pocket's contents are fixed by the hash of its
  coordinate and chosen triple — the same choice always opens the same
  pocket, and once opened it is inscribed and stays.
- **Portals**: a portal moves you exactly where the corresponding phext
  break would put a reader — the start of the next unit at that level.
- **Stuff**: a taken glyph is consumed from the document and its effect is
  immediate; there is no inventory.
- **Flux**: flux is noise from the unchosen dimensions — it never hides a
  required path, a required object, or a rule.
- **Evolution**: after every tick, the room takes one step of Conway's
  Life (B3/S23) — what was inscribed is what evolves.
- **Monsters**: one step per tick toward you, along the axis with the
  largest gap; they fall like everything else, and their speed is set by
  the size of subspace.

### Powerups — limited subspace rights

Will's rule (2026-11-22): **"certain power ups grant limited subspace
rights."** A class of powerups grants not a stat but a *permission*: a
scoped right to act on subspace itself, beyond the player's normal
verbs. Scopes, simplest first:

- **By extent** — the right holds over one pocket, or one coordinate
  range, and nowhere else.
- **By count** — the right holds for N inscriptions, then lapses.
- **By kind** — the right is one verb the player otherwise lacks (e.g.
  compact, or inscribe a portal), usable where the player stands.

The principle, in Will's terms: **the game's deepest currency is rights
over the substrate — granted limited, never total.** A rights-powerup is
the strongest thing the world hands out, and it is always bounded.
**MVP default**: exactly one rights-granting powerup kind — extent-bound
(inscription rights over the pocket you found it in). The alternatives,
and how such a powerup is *presented* under the veil — the player is
never told they hold "subspace rights," so what they understand
themselves to have gained is a fiction-side question — are Guidance G30.
(Which Stuff ships at all remains G6; the rights class rides on that
ruling.)

## The instrument — jumping between worlds

Will: "design a multi-note harp or flute for jumping to other worlds." The
instrument is how the player chooses dimensions — played, never explained
(the veil).

- **Notes are dimensions**: the instrument has 11 notes, one per dimension,
  and a chord of 3 notes states a projection.
- **Playing the chord is the jump**: the chord opens the pocket at your
  coordinate (the pocket rule) and you are standing in the new slice.
- **Playing inscribes**: the chord is written at your coordinate — the
  document records the tune that opened each pocket, and re-playing the
  same tune at the same coordinate reopens the same pocket.
- **Portals vs the instrument**: a portal moves you through the document's
  structure; the instrument changes which slice of the document you are
  standing in. Portals are placed by the world; the instrument is carried
  by the player.
- **Cost**: none in the MVP beyond the tick — and the tick is not nothing:
  monsters step and Life evolves while you play.
- **Edges, as subspace would have them**: a chord is exactly 3 distinct
  notes; any other playing is just music. Re-playing your current slice's
  chord is no jump — that pocket is already open. You may play mid-fall;
  the tick still lands you where gravity puts you.
- **Web input**: tap the strings (or holes), or use 11 keyboard keys in a
  row; the chord sounds on the third distinct note.

MOST's ChipTunes turned position into music; the instrument turns music
into position.

## Monster mechanics

What a monster is, in subspace terms: **a monster is text in the document
that rewrites its own position** — an inscription with a tick rule. No lore,
no AI system; the rules below are the whole of it.

- **Appearance**: a monster is visible exactly when its coordinate agrees
  with your slice on all 8 unchosen dimensions. So monsters blink in and
  out as they step along axes you aren't slicing — the most dangerous
  thing about a monster is the part of its motion you cannot see.
- **Movement**: each tick, a monster takes one step toward the player's
  coordinate along the axis where the gap is largest. It moves in the full
  space, not in your slice — it does not know your slice exists (subspace
  reacts as you'd expect; whether it also *acts* while off-slice is G15).
- **Gravity**: monsters fall under the same gravity as everything else, so
  warping gravity is a way to fight — flip down and the monster falls: onto
  lava, or out of the room. A monster that falls out of the room is gone
  from the scroll, and the scroll records the loss.
- **Portals**: a portal is structure, not a door — anything standing on it
  crosses, monster or player.
- **Contact**: a monster that reaches your coordinate ends the run where
  you stand; what death inscribes is G21. (Direct attack — whether there
  is a strike verb at all — is G16; the MVP verbs warp, re-play, and cross
  are already fights.)
- **Defeat**: a defeated monster is struck from the scroll like taken
  Stuff — consumed — and the coordinate where it fell keeps the scar.
- **Danger**: a monster's danger is its speed — how many steps it takes
  per tick.

### The escalation law

> **"the monsters get more dangerous the larger subspace becomes"** — Will

It composes with mutability into the game's engine of stakes: every action
inscribes, pockets add scrolls, trails add text, Life grows structure —
**play itself — everyone's play, in one shared world — enlarges the
document, and the enlargement is what the monsters feed on.** There is no safe grinding; opening a pocket to escape
raises the danger you escape into. In the MVP: subspace size is the
dungeon-phext's **scroll count** (the exact measure is G17), and monster
speed steps from 1 step per tick to 2 when the scroll count doubles its
starting value. MVP needs exactly **one monster kind** — step-toward,
falls, blinks — with speed as its only variable; a second kind is one
changed rule (it steps along unchosen axes first, so it blinks more and
arrives from nowhere), and the count is G14.

## Evolution — subspace grows by Life

Will: "use conway's game of life to evolve subspace naturally." The rule,
in one sentence: **a live cell with 2 or 3 live neighbors survives, a dead
cell with exactly 3 live neighbors is born, and everything else dies or
stays dead** (B3/S23). Life is the simple-rules exemplar — three clauses, no
exceptions, endless structure — the depth-over-complexity ruling in its
purest form. The world grows by Life, not by authored placement.

- **Order, per tick**: the player's action inscribes first, monsters step
  second, Life steps third — the player writes, then the world evolves
  what was written.
- **Pockets**: a pocket's foam is seeded by its hash, then Life runs over
  the seed before the player first enters — pockets arrive already grown,
  not placed.
- **The monster law**: Life-driven growth enlarges subspace, which raises
  monster danger; Life also erodes, and danger follows the current size,
  up or down. In the shared world this is collective: the document Life
  grows is the one everyone plays in, so danger is a commons — it rises
  and falls with the world's total size, whoever grew it.
- **MVP scope — the smallest Life that visibly evolves**: Life runs over
  the current room's grid, one step per tick, a cell alive = earth (`=`).
  Rooms change between ticks and between visits; nothing is placed by
  hand. What a cell is at the structural level, which neighborhood Life
  runs over, and the cadence are G22–G24.

### Thesis check, element by element

- Projection choice — **serves it**: you only ever hold a slice.
- Pockets — **serves it**: the unchosen 8 dimensions hold real data you
  cannot see until you choose them; choosing creates what you then explore.
- Gravity warp — **serves it**: even *down* is a local convention of your
  slice; the reality underneath doesn't share it.
- Portals — **serves it**: every room is a fragment of a structure bigger
  than any slice of it.
- Flux — **serves it, on a leash**: it is the incomprehensible made visible.
  The moment flux becomes a puzzle system or a crafting input, it stops
  serving the thesis and starts being homework — kept as noise, per the
  original spec.
- Powerups — **flagged**: shield/tool/life/armor/weapon risk becoming
  ordinary progression that masters the reality for you. MVP keeps Stuff
  minimal and immediate (rule above) — whether Stuff belongs in the MVP at
  all is Guidance G6.
- The instrument — **serves it**: you never pick dimensions from a list of
  truths; you play tunes and learn where they take you. Comprehension by
  ear, earned.
- Monsters — **serves it**: their danger lives mostly off-slice, in motion
  you cannot see; you infer the monster from its appearances.
- Life — **serves it**: the world changes by a rule too simple to argue
  with and too rich to predict. You infer; you never master.
- The veil — **the audit**: no in-game word names subspace, dimensions,
  projections, or phext. There is no "choose dimensions" screen — there is
  an instrument, rooms, falls, and tunes. Anything the player understands
  about the deeper reality, they understood by playing.
- Coordinate display — **flagged and tightened by the veil**: an address
  readout would both break the veil and hand over the whole map. MVP shows
  no address at all — only the room, its marks, and the sounding notes;
  whether an address ever surfaces, and how, is Guidance G7.

### Complexity drift — caught and simplified under the simple-rules ruling

- Gravity re-axis + flip combinations → MVP is flip only.
- A browser over all 165 projections → cut; you choose by naming dimensions
  in the world, and the choice opens a pocket. No catalogue.
- Flux as a system (interactions, crafting, % chance tables) → cut; flux is
  noise, full stop.
- Inventory / equipment state → cut; Stuff is immediate or absent.
- MOST's mana-by-Euclidean-norm and M/S/T progression → not imported into
  the MVP; Nova Fox's verbs are choose / move / warp / traverse.
- Monster AI (pathfinding, behavior states, factions) → cut; one step rule
  and a speed.
- Life as a player-steered puzzle (draw a pattern, win a prize) → not in
  the MVP; Life is the world's weather — the player writes in it, the
  world evolves it.

## Processing limits at a 500 MB world

Will's question (2026-11-22): are there real processing limits with the
current architecture and a **500 MB initial world, built through
iteration**? Measured, not guessed: synthetic phexts of 100 / 250 /
500 MB (room-sized ~1 KB scrolls; the 500 MB file = 524,288,525 bytes,
511,501 scrolls) were generated and measured on plain-view (48 GB ranch
node) against **libphext-rs 0.6.6**, the reference implementation.
Numbers below are **MEASURED** unless marked **DERIVED** (arithmetic
from measured rates, assumptions stated). Raw run:
`bench/results-plain-view.txt`; bench source: `bench/`. Verdict per
layer:

- **Cold load (snapshot → resident)** — no limit. MEASURED at 500 MB:
  read 0.20 s + span-index build 0.34 s ≈ **0.55 s** to a fully indexed
  resident world. Recovery adds WAL replay (below).
- **RAM sizing (the RAM-resident ruling)** — no limit. MEASURED peak
  RSS at 500 MB: **~1.1× file size** (raw buffer + span index, 558 MB)
  to **~2.4×** (a fully exploded coordinate→scroll map, 1.23 GB).
  Budget **~2.5× worst case → a 500 MB world wants ≈ 1.25 GB** — an
  order of magnitude inside the fleet's smallest 16 GB bin.
- **Lattice read (one scroll by coordinate)** — no limit *with the
  index*; a real limit without it. MEASURED: slicing one scroll from
  the resident buffer via the span index ≈ **0.6 µs**. But libphext's
  naive `offset()` rescans the whole document per call — **0.58 s** at
  500 MB. The architecture must read through a built index (spans /
  phext-lattice's LatticeIndex over mmap — the same shape), never
  through per-call scans. This answers G12's read half by measurement.
- **Lattice write / mutability** — **the one real limit, and the
  RAM+WAL ruling dissolves it.** MEASURED naive path: libphext
  `replace()` re-serializes the whole document per inscription —
  0.53 s CPU + 0.25 s disk write ≈ **0.78 s per action** at 500 MB,
  i.e. ~1 action/sec for the entire shared world. Unusable — and not
  the design: under the ruled architecture an action is a **WAL
  append**, MEASURED at **12.5 µs** per ~1 KB segment (1,000 appends,
  buffered); with an fsync per action it stays sub-ms to ~1 ms class
  (DERIVED from the node's measured disk rates). Three orders of
  magnitude cheaper. The write path carries *consequences*, not just
  positions (per the consequences-bind-back ruling) — a consequence is
  still one segment per inscription, so the cost shape is unchanged.
- **Derived views (the view ruling)** — no limit. A view is derived
  per slice from ~1 KB of scroll; derivation cost is bounded by the
  room, not the world (DERIVED: even 100× amplification of 1 KB into
  geometry is ms-class). Nothing in the design ever derives — or ships —
  the whole world to make one room.
- **Client (Three.js + WASM)** — not the bottleneck. The world never
  loads into the browser: per-slice payload is ~1 KB of text plus
  derived geometry, against a wasm32 linear-memory ceiling of 4 GB per
  tab that only a whole-world client would approach. One room of
  instanced glyph geometry is 60 fps class by construction (DERIVED
  from room size; standard practice, not benchmarked here). One
  architectural consequence the numbers do force: the resident shared
  world and its single WAL writer live **server-side** (the lattice
  host); the browser WASM core works per-slice over coordinate-range
  reads. A solo tab could physically hold 1.25 GB, but the shared-world
  ruling forecloses a per-tab world anyway.
- **Life evolution** — no limit at the brief's scope. MEASURED
  **~1.1–1.3×10⁸ cells/sec** (single thread, naive implementation).
  One step over a room grid (32×32) ≈ 8 µs; pre-evolving a pocket
  (100 generations over its room) ≈ 0.8 ms — invisible inside a tick.
  The only heavy form is a *whole-world* Life step: at 1 byte/cell a
  500 MB world is 5×10⁸ cells ≈ **4 s per generation** (MEASURED at
  that scale) — which is why Life stays scoped per room/pocket, as the
  brief already rules. Not a limit; a boundary the design already
  respects.
- **World generation by iteration (building the 500 MB)** — no limit.
  DERIVED from the measured Life rate: 511,501 rooms × 100 generations
  × 1,024 cells ≈ 5.2×10¹⁰ cell-updates ≈ **~7 minutes single-thread,
  ~30 s across the node's 16 cores**. One-time, offline, parallel —
  "built through iteration" is cheap.
- **WAL growth & snapshot cadence** — a policy question, not a limit.
  DERIVED: at ~1 KB per action, a sustained 1 action/sec across the
  whole shared world grows the WAL ~86 MB/day (10/sec ≈ 0.86 GB/day).
  A snapshot + lossless fold costs ~1 s class per 500 MB (DERIVED from
  the measured load + write rates), so cadence can be frequent; the
  choice is G28, and durability strictness is G29.
- **Replay after crash** — no limit. DERIVED: snapshot load 0.55 s
  (MEASURED components) + segment replay at in-RAM splice rates;
  10,000 segments ≈ seconds.
- **Shared-world write contention** — no throughput limit. A single
  WAL writer serializes all players' inscriptions at ≥1,000
  actions/sec even fsyncing per action (DERIVED) — ≥10× any plausible
  tick load (100 concurrent players × 1 action/sec = 100/sec).
  Contention becomes an ordering question, and ordering is the WAL's
  job by construction.
- **House tooling caveat** — MEASURED: the Python dead-reckoning
  parser takes **21.7 s** over the 500 MB file (~40× the Rust path).
  Fine for offline tooling; it must never sit in a game or serving
  path at this scale.

**Bottom line: the 500 MB world fits the current architecture.** The
substrate at this scale is fast (sub-second loads, µs indexed reads,
10⁸ cells/sec of Life) and small (≈1.25 GB resident worst case). The
single real limit — whole-document re-serialization per write — is
exactly the path the RAM + WAL ruling removes; what remains open is
policy (G28, G29), not capacity.

## Daily challenges and prizes

Will (2026-11-22): "I want to include daily challenges and prizes —
swag and hats in-game for clearing challenges." This is the Nova Phox
seed (hidden room, daily challenge) arriving as a system:

- **The challenge**: one pocket per day, seeded deterministically from
  the date (phorge-style), opened in the shared world for everyone. A
  clear condition in the game's own verbs — reach its `^` gate, strike
  its monster, clear it inside a tick budget. Same day, same pocket,
  for every player; tomorrow it is a different coordinate.
- **The prize**: swag and hats, in-game — cosmetic inscriptions granted
  on a clear. Under the durability law this is the perfect prize
  economy: a hat is *inscribed*, so it persists exactly while derived
  detail drifts around it. The reward for playing is one of the
  immutable things.
- **Scope**: the first live-ops layer after the MVP, not in the MVP
  loop. The seed of it — a date-seeded daily pocket — needs no new
  machinery beyond the pocket generator the MVP already builds.

## The daily cycle — the map is saved, the world is regenerated

Will (2026-11-22): "At the end of each day, the full subspace map for
the day is saved and a new one is generated. People can learn how to
build their own tooling for it using docs.phext.io."

- **The day is the world's epoch.** Play happens in one shared map for
  one day. At day's end the full map — every inscription, scar, and
  grant the day accumulated — is saved whole (the multiversal fold at
  day scale: snapshot, archive, nothing lost), and a new map is
  generated for the next day. Yesterday's world stops being playable
  and becomes *history*: a saved artifact that can be revisited,
  studied, and tooled against.
- **New instances arrive at midnight CST, on EE time, on schedule**
  (Will, 2026-11-22): the save-and-generate runs as scheduled epoch
  work anchored to local midnight (America/Chicago). The arithmetic
  is pretty: a day is 205 5/7 epochs, so midnight walks the epoch
  grid by 5 minutes a day and lands exactly on a boundary every
  seventh day — 7 days is exactly 1,440 epochs. (DST days run 23/25
  hours; the cycle follows the local clock.)
- **The daily challenge lives in the day's map** — the challenge
  pocket is part of each day's generation, which is why it is the same
  for everyone and gone tomorrow.
- **Old worlds stay explorable** (Will, 2026-11-22): "players can
  explore the old worlds at any time." The archive is a library, not
  a vault — every saved day remains a place you can go. The galaxy of
  yesterdays grows by one world a day, forever.
- **Old worlds are still living** (Will, 2026-11-22): "old worlds are
  still living, of course." Life keeps stepping and monsters keep
  moving in every saved world; migration doesn't freeze anything. So
  the saved map is a world's *spawn state* — the record of the day as
  it began — and the living world evolves onward from it. The record
  and the place part ways, which is the reload law at world scale.
- **Each spawn is a migration** (Will, 2026-11-22): "migrate the data
  to a new phext with each spawn." A day's world is a phext; spawning
  the new day creates a new phext and migrates the durable data into
  it. The old phext is left whole — it IS the saved world, readable
  and explorable with the same tooling as the live one.
- **The docs teach the tooling — unlinked.** The substrate the game
  runs on is real and documented: docs.phext.io is where people learn
  to build their own tooling for it — readers, mappers, analyzers of
  the saved maps. But (Will, 2026-11-22) "we won't directly link the
  two — just if people are paying attention": the game never points
  at the docs, the docs never point at the game. Both are simply true
  in public, side by side, unannounced. Whoever notices that the
  world they played in is a real phext — and that the tooling they
  just learned fits it exactly — found the connection the way it was
  meant to be found: by paying attention.

## Review 1 — the playable shape (Will, 2026-11-22, after playing the demo)

Full text: REVIEW-1.md. The rulings that reshape the build:

- **View**: immersive first-person 3D in the Descent/Doom register;
  voxel graphics in the Minecraft register; the world is an infinite
  region of spacetime, chunked and streaming — never boxed in.
- **Generation architecture** (supersedes the demo's literal
  view-derivation): the physics engine operates *entirely in
  subspace* — Life, gravity, the monster law, and non-local coupling
  in which nearby scrolls act on the player's scroll. The 3D world is
  *procedurally generated from the subspace state at the scroll the
  player is exploring*. The view has no physics of its own.
- **Physics design brief** (Will, 2026-11-22): "develop physics that
  make sense for this game — not realistic — designed to educate
  about phext specifically." The laws are phext's own truths taught
  as game feel, never named (the veil holds): addressing is movement,
  inscription is permanence, the lattice is connected (non-local
  effects), dimensions press in from outside the slice, text edits
  itself and is edited. Full development: PHYSICS.md.
- **Movement**: the player can jump; bob + weave are part of the
  movement vocabulary.
- **Legibility**: a guide carries the first few minutes; hit points
  are unmistakably readable (HUD + damage feedback); the numbers
  teleport — the instrument is numbered, number keys play the notes,
  a played chord is the jump; sound effects are real and audible.
  The manual "re-derive view" verb is gone — generation is the
  engine's job, not a button.
- **Focus**: exploration and dungeon quests.
- **Narration**: Emise narrates the storyline (and voices the guide).
- **Realms**: the player drops into **Nova Prime**. The other realms
  take the names of the first 10 ranch nodes (wiring.phext record
  order): Ni-Knight · Ashfall Haven · Logos Prime · Elven Path ·
  Orchid Flow · Halycon Vector · Delta Wood · Best Willow ·
  Plain View · Trust Fall. (This names G31's canon of 10.)

## After the MVP (brief, in no order)

Gravity re-axis and warp combinations · all 9 portal types live · the `?`
save glyph as in-document save · authored Base-88 cartridges (1 KB rooms,
text-editor level design) alongside generated pockets · Nova Phox's hidden
room as a shared hunt (the shared world itself is now the MVP premise —
G9 resolved; the hunt is the after-MVP content) · Phext-Native MUD-lineage
depth on the shared world (persistent identities, event logs as
coordinates, SQ-queried state) · MOST's 9D→11D maze on the shared stack ·
ChipTunes-style position-as-music · native clients · apertureshift.com
Roads to the Future crossover · more monster kinds · Life running over the
scroll lattice itself, not just room grids.

## GUIDANCE — decisions for Will

1. **G1 · The dungeon-phext**: (a) incipit.phext, (b) a small purpose-built
   cartridge phext written for the MVP, (c) one scroll-bearing phext from
   the human corpus. Under G9's shared-world ruling, whichever phext this
   is, it is *the* shared world — the one document every player writes
   into.
2. **G2 · Choosing dimensions**: Will's instrument design (see The
   Instrument) supersedes the menu forms of this choice; the remaining
   open part is the note mapping, G19.
3. **G3 · Relation to MOST's scaffold**: (a) Nova Fox MVP builds on the
   MOST modernization scaffold (shared Three.js/WASM core), (b) Nova Fox
   stands alone and the cores merge later, (c) MOST first, Nova Fox as its
   second game.
4. **G4 · MVP portal set**: (a) scroll `_` + jump gate `^` only, (b) scroll,
   section, and jump gate, (c) all 9 from the start.
5. **G5 · Gravity warp scope in MVP**: (a) flip only, (b) flip + re-axis
   among the 3 chosen axes.
6. **G6 · Stuff in the MVP**: (a) none — verbs only, (b) `+` life and `*`
   powerup only, immediate-effect, (c) the full Stuff table.
7. **G7 · The coordinate display**: (a) slice coordinate only, (b) full 11D
   address always visible, (c) full address revealed only at portals.
8. **G8 · Where it lives**: (a) phext.io, as the white-rabbit page's
   successor, (b) apertureshift.com alongside Roads to the Future,
   (c) both — playable on phext.io, listed among the games on
   apertureshift.com.
9. **G9 · Mutability scope — RESOLVED** (Will, 2026-11-22): "one shared
   open world, hyperspace coordinates: the storyline is that they've
   conquered the galaxy but still can't figure out dark matter" — option
   (b): one shared subspace; every player's inscriptions are in the same
   document for everyone. Per-player copies are off the table; the
   consequences are designed into The Key, the MVP, and Evolution above.
10. **G10 · History and undo — LARGELY ANSWERED** by the RAM+WAL ruling
    (Will, 2026-11-22: "we'll load into RAM and store WAL segments at
    runtime"): history *is* the snapshot + WAL segments, kept lossless by
    the compaction ruling — nothing inscribed is ever destroyed. The
    residue is only the undo verb: (a) no undo verb — the WAL is the
    record and the world moves forward, (b) an undo verb that itself
    inscribes (a counter-inscription, never a deletion), (c) out of
    scope until after the MVP.
11. **G11 · Stack — the WASM core's language**: (a) Rust (per the MOST
    modernization ruling: "rust rewrite"), (b) another language you name.
12. **G12 · Stack — phext-lattice optimization target**: (a) optimize the
    read path first (slice rendering reads constantly), (b) optimize the
    write path first (every action inscribes), (c) both are the MVP's
    lattice work, sequenced by profiling.
13. **G13 · Rendering the slice — RESOLVED** (Will, 2026-11-22): "3D
    characters, worlds that are views into subspace, derived from it, not
    literally 1:1, and consequences matter back in subspace" — true 3D:
    characters are 3D, and the world is a derived view of subspace rather
    than a 1:1 transcription of the glyph grid (see What the player sees).
    The glyph tables and portal colors remain the view's ground; the
    isometric and glyphs-as-textures options are off the table.
14. **G14 · Monster kinds in the MVP**: (a) one kind — step-toward, falls,
    blinks; speed is its only variable (simplest), (b) two — adding the
    kind that steps along unchosen axes first, (c) three or more.
15. **G15 · Do monsters act while off-slice**: (a) yes — they move in the
    full space every tick whether you can see them or not (simplest, and
    what "subspace reacts as you'd expect" implies), (b) they act only
    while visible in your slice, (c) they act off-slice at a slower
    cadence.
16. **G16 · Is there a direct attack verb**: (a) no — warp, re-play, and
    portal-crossing are the fights (simplest), (b) step-into is a strike
    (bump combat), (c) the `-` weapon glyph is required to strike.
17. **G17 · "Size of subspace" — the escalation measure**: (a) scroll count
    of the dungeon-phext (simplest), (b) total inscribed bytes,
    (c) scrolls + opened pockets.
18. **G18 · The instrument's form**: (a) harp — 11 strings, (b) flute — 11
    stops, (c) one mechanic, both skins.
19. **G19 · Note mapping**: (a) 11 notes in phext axis order, library
    lowest to column highest (simplest), (b) notes ordered by the player's
    discovery, (c) an MVP subset — only the axes the MVP dungeon uses get
    notes. *Cross-reference G31: if the canon is ~10 curated triples, the
    notes that matter are the ones those triples use — mapping and canon
    are one decision seen from two sides.*
20. **G20 · Jump cost**: (a) none beyond the tick (simplest — the design
    above assumes this), (b) a chord spends a `*` powerup charge,
    (c) cost grows with the distance between the old and new triples.
21. **G21 · What death inscribes**: (a) everything persists — your marks
    stay in the document and you respawn at `/` (simplest), (b) death
    closes the pocket you died in, (c) death resets a per-run copy of the
    phext — **superseded by G9's shared-world ruling** (no per-run copies
    exist).
22. **G22 · Life — what a cell is**: (a) a grid position in the current
    room, alive = earth (simplest — the MVP above assumes this), (b) a
    scroll, alive = exists and non-empty, across the dungeon-phext,
    (c) both layers at different cadences.
23. **G23 · Life — the neighborhood it runs over**: (a) the current
    projection's grid only (simplest), (b) the slice plus one unchosen
    axis, (c) the full 11D neighborhood.
24. **G24 · Life — cadence**: (a) one Life step per game tick (simplest),
    (b) one step per player action, current room only, (c) one step per
    N ticks.
25. **G25 · The shared world — persistence and moderation**: (a)
    inscriptions are permanent and unmoderated — the document is the
    record, scars and all (simplest, and what mutability implies),
    (b) inscriptions are permanent but the world is pruned or reset on a
    stated cadence, (c) some inscriptions (trails, tunes) fade while
    structural ones (pockets, scars) persist. *Annotated by the
    compaction ruling (Will, 2026-11-22: "players can compact using
    multiversal phext, no state ever truly lost"): option (b)'s prune /
    reset can no longer mean destruction — under lossless compaction a
    "reset" could only ever be a fold into the multiversal phext, with
    the prior state still addressable. The moderation question itself
    stays open and Will's.
26. **G26 · Where the storyline surfaces in-game**: (a) a short premise
    text at entry — galaxy conquered, dark matter unsolved, rifts found —
    and nothing more (simplest), (b) the premise plus in-world fragments
    (chart notes; `!` clues and `#` guides carry the fiction), (c) no
    text in-game at all — the premise lives outside the game (page copy)
    and play is pure experience.
27. **G27 · Rifts — what they are in the world's terms**: (a) placed —
    rifts are features of the dungeon-phext waiting to be found, and the
    instrument only finds them, (b) emergent — Life's evolution grows
    them; they appear where the world has grown, (c) player-opened — the
    instrument tears them; a chord doesn't find a rift, it makes one (the
    pocket rule already reads this way).
28. **G28 · Snapshot & compaction — cadence and authority** (opened by
    the RAM+WAL and compaction rulings; capacity is not the constraint —
    see Processing limits): (a) snapshot on a stated cadence (e.g. daily)
    plus player compaction whenever a player invokes it (simplest),
    (b) snapshot triggered by WAL size (e.g. segments reach a stated
    fraction of the world), compaction player-invoked only, (c) either
    trigger, and compaction of a shared region requires the region's
    opener or a rights-powerup. Who may compact shared regions rides on
    this choice.
29. **G29 · WAL durability policy**: (a) fsync every segment before the
    action resolves — strongest durability, ~sub-ms to ~1 ms per action
    at measured disk rates (simplest to reason about), (b) batched
    fsync (every N segments or every tick) — a crash can lose the last
    partial batch of inscriptions, (c) OS-buffered appends with periodic
    sync — fastest, weakest.
30. **G30 · Rights-powerups — how they are felt in-fiction**: a powerup
    granting limited subspace rights can never be *named* as such (the
    veil: subspace is unspoken). What does the player understand
    themselves to have gained? (a) a place-bound deepening — in this
    pocket, the world answers your hands more fully (writing, compacting)
    — felt as the place being *theirs* in a way other places aren't
    (simplest; pairs with the MVP's extent-bound default), (b) a
    carried charge — a visible count of *deep* acts the player can spend
    anywhere, (c) a named in-fiction instrument upgrade — the harp/flute
    gains a string or stop, and the new note is the right.
31. **G31 · The reality canon — how many, and which** (Will's lean,
    2026-11-22: "maybe just like 10 lol" — for him to confirm; and
    16:11 the same day: "we can always expand them later too" — the
    canon is a starting curation, never a cap): (a)
    **~10 curated triples** as the world canon — a learnable repertoire
    of tunes, bounded shared state, each reality given a designed
    character (the evaluation above argues this), (b) a different exact
    count he names, with the triples chosen for maximum contrast,
    (c) all 165 admitted in play — the substrate allows it; the costs
    (state sprawl feeding the escalation law, an unlearnable chord
    space, contrast blur) are stated in the evaluation. If (a): which
    10 triples is the follow-on choice, made with G19's note mapping in
    the same pass.
32. **G32 · Daily challenge shape** (Will, 2026-11-22 — challenges and
    prizes are in; the shape is his to rule): (a) everyone who clears
    the day's pocket earns the prize (cooperative commons), (b) first
    clear takes the prize, later clears earn a lesser mark (race),
    (c) both — a first-clear relic plus a clear mark for all. Also his:
    whether challenges are purely date-seeded or sometimes authored.
33. **G33 · What a prize is, mechanically**: (a) pure cosmetic
    inscription (a hat is worn in the view, granted in subspace —
    simplest, and the durability law makes it feel magical), (b)
    cosmetics that are also limited subspace rights in disguise (ties
    into G30), (c) a mix by rarity — daily swag cosmetic, rare prizes
    carrying a right.
34. **G34 · The migration set** (mechanism RESOLVED by Will,
    2026-11-22: each spawn migrates the data to a new phext; what
    remains is which data is *in* the set): (a) grants only — hats,
    swag, rights migrate; geography, pockets, and monster state are
    born fresh with the new phext, (b) grants plus players' own
    inscriptions (what you wrote into the world follows you),
    (c) grants, inscriptions, and authored places (a persistent core
    migrates; only the generated wilds are new).
35. **G35 · Escalation across days**: the monster law keys danger to
    subspace size — (a) size means the live day's map (danger resets
    each dawn; the day's arc is the difficulty curve), (b) size means
    the whole archive (every saved day makes all future days more
    dangerous — the galaxy gets worse forever), (c) the live map plus
    a slow archive term.
36. **G36 · Where the saved maps live — RESOLVED** (Will, 2026-11-22):
    old worlds are explorable in play at any time, and they are still
    living — Life and monsters keep running; the saved map is the
    spawn state, not a freeze. Will's note on the whole mechanism:
    "thanks to multi-versal phext, it's 'not even hard'" — a day is a
    universe, migration is a delta between universes, and a living
    old world is just a universe nobody stopped writing to. Still
    open, minor: whether the map files are also published as artifacts
    for outside tooling (per the no-link ruling, unannounced either
    way).
