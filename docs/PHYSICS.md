# Nova Fox — Physics

Design development for `DESIGN.md` (cross-referenced throughout; this
document does not restate the brief, it builds the physics layer the
brief and Review 1 call for).

Brief (Will, 2026-11-22): **"develop physics that make sense for this
game — not realistic — designed to educate about phext specifically."**

## What "physics" means here

The physics engine operates **entirely in subspace** (Review 1,
clarified by Will): Life, gravity, the monster law, and the coupling
between scrolls all run on the phext state, and the 3D world is
procedurally generated from the subspace state at the scroll the
player is exploring. The view has no physics of its own. So this
document is not about how voxels move — it is about the laws the
substrate obeys, stated so that playing under them teaches phext.

The curriculum, in the order a player absorbs it:

1. **Every place has an address, and an address can be spoken**
   (coordinate addressing).
2. **The world is one structure nested at nine scales** (the break
   levels: scroll, section, chapter, book, volume, collection, shelf,
   series, library — with line and column inside the scroll), and the
   nesting is self-similar: the same containment shape at every scale.
3. **The axes are symmetric; orientation is a written convention**
   (the 11 dimensions; down is inscribed, not given).
4. **The substrate is a medium, not storage** — under one local rule
   it grows and erodes on its own (Life).
5. **Text can rewrite itself** (monsters), and the document's size is
   a physical variable of the world.
6. **What a slice discards does not stop existing** (projection; the
   unchosen 8 dimensions leak back in as flux).
7. **The lattice is connected** — a scroll's neighbors in every axis
   are real, and they lean on it (non-locality).
8. **Writing outlasts showing** (inscription vs derivation
   durability).
9. **Time is a sequence of states**, not a flow (ticks; the daily
   cycle; the epoch schedule).
10. **Permission is content** — rights over the substrate are
    inscribed, scoped, and bounded like everything else in it.
11. **Nothing is ever unwritten** (multiversal persistence,
    migration, conservation).

## How to read this document

Each law gets: the **law** in one sentence, as the engine implements
it (Will's simple-rules law binds this document first); the **phext
truth** it teaches; how it **feels in play**, in the first-person
voxel register Review 1 set (Descent/Doom immersion, Minecraft
playability); the **veil note** — how the player learns it without
being told, with in-fiction naming only; and **engine notes** — state,
tick order, coupling, and cost, bounded per DESIGN.md's Processing
limits (per-room/per-scroll scoping; a whole-world step is never
taken).

Status markers, used plainly: **Ruled** = Will has decided this, in
DESIGN.md, REVIEW-1.md, or the session rulings they record.
**Proposal** = this document extends beyond the rulings; the
extension is marked where it stands and collected as G-points at the
end. Nothing here silently upgrades a proposal into a ruling.

---

## Law 1 — Movement is addressing

**Law: to go somewhere, you speak its address — three numbered notes
name three axes, and the chord sets you down in the slice where those
axes are the ground under your feet.**

**Phext truth.** Every place in phext is an 11-component coordinate,
and a coordinate can be produced from anywhere: addressing is random
access, not traversal. The instrument teaches this in the hands — a
place is not reached by walking the space between, it is *named*, and
naming is sufficient. It also teaches that an address is an artifact:
the chord you play is text, and playing it writes it down (DESIGN.md,
The Instrument: playing inscribes the tune at your coordinate).

**In play.** The instrument is numbered 1–11 (Review 1 #14: "I can't
use the numbers to teleport" — now the numbers *are* the teleport).
Three distinct number keys sound a chord; on the third note the world
re-forms around the new slice. The first-minutes guide teaches two or
three tunes by ear; the realm canon (~10 triples, DESIGN.md G31,
named in Review 1) is a repertoire, not a menu. There is no map
screen and no address readout — comprehension by ear, earned
(DESIGN.md thesis check).

**Veil.** In-fiction the instrument is the civilization's own
technology and the tunes are *hyperspace coordinates* — the fiction's
words, spoken freely. Nobody says "dimension" or "projection"; a
tune "takes you" the way a course takes a ship.

**Engine.** State: the player's current coordinate and current
triple, inscribed in the world phext (The Key: passage is inscribed).
Resolution of a chord at coordinate *c* with triple *t*: look up
(*c*, *t*) in the pocket index — an indexed read, ≈0.6 µs class
(measured, DESIGN.md). If a pocket is inscribed there, it is the
place (yours, or another player's — the world is shared). If not,
generate it (Law 6/Law 7 govern the inputs), inscribe it, and the
chord with it — one WAL segment per inscription, 12.5 µs buffered
(measured). A chord of anything but 3 distinct notes is just music
and costs nothing; a played chord costs the tick (Law 9), which is
the price that matters: monsters step and Life turns while you tune.
Re-playing the current slice's chord is no jump — that pocket is
already open (ruled). Status: **Ruled.**

## Law 2 — Breaks are stairs between scales

**Law: a portal does not move you across space, it moves you up or
down the world's nesting — cross a break and you stand at the start
of the next unit of that size.**

**Phext truth.** Phext is one structure nested at nine break levels —
scroll ⊂ section ⊂ chapter ⊂ book ⊂ volume ⊂ collection ⊂ shelf ⊂
series ⊂ library, with line and column inside the scroll — and the
containment shape is the same at every scale: a unit is a run of
smaller units ended by its break. This is the self-similar scale
structure of phext, taught by walking it: the section you cross into
*contains* rooms the size of the one you left, and the player who has
crossed a `{` book portal and a `_` scroll portal has felt the
difference between a step and a zoom in their legs. The portal colors
are the scale ladder made visible: `_` red (scroll, smallest) through
`&` green, `@` blue, `{` cyan, `}` magenta, `|` yellow, `[` white,
`]` black, to `^` void — the library break, the largest container
there is, which is why crossing it feels like leaving the world.

**In play.** Portals are Doom-style thresholds with zoom semantics.
A scroll portal is a door to the next room; a book portal is a
district change; the `^` gate is the way out (the MVP goal, ruled).
Anything standing on a portal crosses — player or monster (ruled) —
so a portal at your back is never a wall, it is a liability.

**Veil.** Portals are the civilization's *charted structure* — the
part of hyperspace their maps got right (DESIGN.md, Storyline).
In-fiction they are gates and thresholds with names of size, never
"breaks," and the nesting is something charts show, not something
anyone explains.

**Engine.** Traversal is coordinate arithmetic, not search: crossing
a break of level *L* sets every component below *L* to its start and
advances the *L* component by one — exactly where the break would put
a reader (ruled, DESIGN.md Simple Rules). The crossing is recorded at
both ends (one WAL segment carrying both endpoints). Cost: two
indexed reads and an append. Generation of the destination follows
the same path as Law 1's pocket resolution when the destination
scroll is uninscribed. Status: **Ruled.** (One edge is genuinely
open — landing on a portal, and portal chains — see Law 2's
collision note in *Where the laws collide* and G44.)

## Law 3 — Down is written, not given

**Law: everything in a room falls along the one axis the room names
as down, in the direction the room names, until it lands — and the
naming is itself written in the room, so it can be rewritten.**

**Phext truth.** The 11 axes of phext are symmetric: the substrate
has no up. "Down" is a designation *inscribed at a coordinate* — a
fact stored in the document, not a property of reality — which is why
it can differ per slice, per room, and per visit, and why rewriting
it is an edit like any other. The player learns the deepest version
of the thesis here: even gravity is local convention layered on
text. The MVP teaches the flip (down reverses along the same axis);
re-axis — naming a *different* one of the slice's three axes as down
— is the same law with the training wheels off, already queued after
the MVP (DESIGN.md).

**In play.** Metal Storm's verb in first person: flip, and the
ceiling becomes the floor, loose monsters fall into lava or out of
the room, and the one arrow in the HUD — which way is down — is a
fact about *this slice*, re-read every time it changes. Jump
(Review 1 #2) lives under this law: a jump is a brief, spent defiance
of the room's naming, and bob + weave (Review 1 #3) is the body's
language in the view while it happens. The view animates the body;
the landing is what inscribes.

**Veil.** In-fiction, rooms have "gravity habits" and old places are
known for them ("Ashfall Haven falls sideways near the rifts"). A
warp is a thing the world lets you do to a place, never a "rewrite
of an axis designation."

**Engine.** State: the gravity designation is part of the scroll's
inscribed state; warp = one WAL segment rewriting it. Per tick, each
entity in an active scroll (player, monsters) moves one cell along
the down axis unless the cell below (in the room's grid) is earth
(`=`) or a floor the generation derived from it. Falls resolve in
the monster phase for monsters and immediately for the player's own
move (Law 9's order). All of it is per-room arithmetic over a ~1 KB
scroll's grid — no continuous integration, no velocity vectors
persist between ticks. Jump's exact subspace form (a short upward
counter the gravity rule then spends) is **Proposal**, G41. Whether
inscribed *earth* falls when down flips is genuinely undecided —
G42. Status: **Ruled** (flip, designation-in-the-room); jump form
proposed.

## Law 4 — The world metabolizes

**Law: every tick, the world's earth takes one step of Conway's Life
— a live cell with two or three live neighbors survives, a dead cell
with exactly three is born, everything else dies or stays dead — and
the world grows and erodes by nothing else.**

**Phext truth.** A document under a simple local rule stops being
storage and becomes a process. Life teaches that phext is a *medium*:
structure in it is not placed, it *develops*, and the development is
deterministic — same state, same rule, same future, until a player
writes. Three clauses, no exceptions (DESIGN.md, Evolution): the
player can hold the whole of this physics in their head and still
never predict a grown room, which is the thesis in miniature — a
reality simple at the rule and incomprehensible at the whole.

**In play.** Rooms change between ticks and between visits; a pocket
arrives already grown (its hash-seeded foam is Life-evolved before
first entry), corridors open and earth bridges dissolve while you
watch, and a room you "solved" an hour ago is a different room now.
Life is the world's weather (DESIGN.md): never a puzzle to steer in
the MVP, always a fact to read.

**Veil.** In-fiction this is just how the rifted places behave — "the
ground here grows." Nobody names an automaton. The civilization's
charts mark grown regions the way sailors mark currents.

**Engine.** State: the room grid of the active scroll; alive = earth
(`=`), per the MVP scope (what a cell is at the structural level is
G22; the neighborhood, G23). Order: Life steps **third** each tick,
after the player's inscription and the monsters' step (ruled) — the
player writes, then the world evolves what was written. Cost:
measured ≈8 µs for one step over a 32×32 room at ~1.1–1.3×10⁸
cells/s; pre-evolving a fresh pocket 100 generations ≈0.8 ms. The
one forbidden operation is a whole-world step (≈4 s at 500 MB,
measured) — Life is scoped to the active scroll and, at generation
time, its neighborhood (Law 7), never wider. Status: **Ruled.**

## Law 5 — Text rewrites itself

**Law: a monster is a line of the world that moves its own address —
one step per tick toward yours along its longest gap — and the
larger the world grows, the faster it writes.**

**Phext truth.** Two truths in one body. First: an inscription is not
passive — text in phext can carry a rule and execute it, so a
document can contain *agents* made of nothing but text editing
itself. A monster's position is a value stored in its own text;
moving *is* rewriting itself, and defeating it is striking it from
the scroll like any other edit. Second: the escalation law (Will:
"the monsters get more dangerous the larger subspace becomes") makes
the document's *size* a physical variable — the world's total extent
of writing is a force every player feels and every player feeds.

**In play.** The monster is visible exactly when its coordinate
agrees with your slice on all 8 unchosen dimensions (ruled) — so the
experience is blinking: a shape that is *there*, gone, there again
closer, its approach mostly inference. It falls like everything else
(Law 3 makes gravity a weapon), it crosses portals like everything
else (Law 2), and contact ends the run where you stand. Danger is
speed only: steps per tick, stepping from 1 to 2 when the scroll
count doubles its starting value (MVP form, ruled; the exact measure
of "size" is G17).

**Veil.** In-fiction the blinking is rift-crossing: things from the
dark bulk step into the visible and out again (DESIGN.md,
Storyline). Nobody says "unchosen dimensions"; the fiction says the
rifts are full of things that are only sometimes *here*.

**Engine.** State: a monster is an inscribed entity whose scroll
holds its 11-component coordinate; a step = strike + re-inscribe at
the new coordinate (one WAL segment), executed in the monster phase
of the tick. Visibility is computed at generation/derivation time
from the coordinate and the viewer's triple — never stored. The
simulation scope is the active scroll plus its coupling neighborhood
(Law 7): a monster in your scroll steps every tick whether or not
your slice can see it (it does not know your slice exists); monsters
in far scrolls are dormant until their scroll enters a neighborhood.
Dormancy is an engine necessity, stated as **Proposal** — it touches
G15, which asks the off-slice question, not the off-scroll one.
Status: **Ruled** (step rule, visibility, escalation, defeat-as-edit);
dormancy scoping proposed.

## Law 6 — The unchosen leak in

**Law: the dimensions you did not choose fill your room with weather
— flux is their noise, it thickens as the bulk behind your slice
grows denser, and it never hides anything you need.**

**Phext truth.** A projection discards; phext does not. Choosing 3 of
11 axes throws away nothing — the other 8 axes still hold their full
content, and what a slice cannot show as *place* it shows as
*entropy*: the 62 flux tokens of the OG spec, "background noise"
that is background *reality*, incompressible because it is a real
signal from somewhere the slice can't resolve. This is the
mathematics of projection taught as atmosphere: every view is lossy,
and the loss is visible if you know how to look at it.

**In play.** Flux is the static at the edges of rooms, the grain in
the air of deep places — thicker in old, much-written regions, thin
in fresh ones. It is never a puzzle and never an obstacle (ruled,
OG spec + DESIGN.md: flux never hides a required path, object, or
rule); it is how a player *feels* the weight of the 8/11 of reality
they are not standing in. In the fiction's terms, flux is the dark
bulk showing through the slice — the closest thing the game has to
looking at dark matter.

**Veil.** In-fiction: vacuum noise, rift-static, "the hum." Charts
mark high-flux regions as *loud*. No one explains it; everyone who
travels learns to read loudness as *something is there*.

**Engine.** Generation places required content first — land, stuff,
portals, the path — and flux fills only the cells generation leaves
blank (the OG spec's generative geometry, run in the safe order).
Flux content is deterministic: hash of (coordinate, triple, cell) —
re-derivation reproduces the same noise for the same state, so flux
is *not* part of the reload law's drift (Law 8); what drifts is
derived surface detail, not the substrate's noise floor. The density
term — flux ∝ inscribed density along the unchosen axes, read from
the Law 7 pressure vector — is **Proposal** (G39): the ruled part is
that flux is the unchosen dimensions' contribution; the gauge wiring
is this document's extension. Cost: part of generation, bounded by
the room. Status: **Ruled** in kind; density coupling proposed.

## Law 7 — Neighbors lean on you

**Law: what is written in the scrolls beside yours leans on your
scroll — a crowded neighborhood presses its weight into your room's
ground, its noise, and its dangers, so you can feel places you cannot
see.**

**Phext truth.** The lattice is connected: a scroll's neighbors along
every one of the 11 axes exist and are adjacent in fact, whether or
not any slice shows them. Phext coordinates are not a filing system
of isolated documents — they are one lattice, and locality in it is
11-dimensional. This is the non-locality at the heart of the design
(Will, Review 1 clarification: "non-local effects from nearby
scrolls due to the physics engine, which operates entirely in
subspace only"): in our own physics, action at a distance is spooky;
in phext, *adjacency you cannot see* is ordinary, and the engine
treats it as ordinary. The player learns that "nearby" is a bigger
word than their slice admits — which is, verbatim, the game's
thesis, arriving as physics.

**In play.** This is the dark-matter feel, mechanized. A room beside
a monster-dense scroll generates harder and *feels* hunted before
anything crosses. A scroll grown thick with Life next door seeds your
room's edges and bulges its terrain. Playing a chord into a quiet
pocket beside a loud neighborhood does not give you a quiet pocket.
Veterans navigate by this pressure the way sailors read swell: the
place you are in is partly made of the places around it.

**Veil.** In-fiction this needs no new word at all — it *is* dark
matter: mass you cannot see, bending the visible. The civilization
has a century of instruments that fail to explain why some regions
are heavy. Players rediscover the explanation with their feet.

**Engine.** This is the one law whose *existence* is ruled and whose
mechanism is this document's design — **Proposal**, stated
concretely so it can be ruled on (G37, G38). For the active scroll
*S*, the engine computes a **pressure vector**: for each axis, an
aggregate over the scroll(s) adjacent to *S* along that axis —
inscribed bytes, live Life mass, monster count. It is computed from
indexed reads only (at most 22 neighbor scrolls; ≈13 µs total at
measured read rates), cached for the tick, and recomputed when any
scroll in the neighborhood is inscribed. Pressure enters play three
ways: (a) **generation bias** — the pocket/room generation hash takes
(scroll state, triple, pressure vector) as input, so a crowded
neighborhood literally changes your terrain; (b) **flux density**
along unchosen axes (Law 6); (c) **crossing** — monsters stepping
along any axis, chosen or not, can step *into* S from a neighbor
(Law 5 already moves them in the full space; pressure is how the
player feels the traffic before it arrives). Life edge-seeding —
S's room-grid Life reading its border cells from the neighbor in the
slice's axes at generation — is the cell-level form of the OG spec's
"neighboring cells fill in the blanks," lifted one scale; included
in the proposal. Nothing here ever scans beyond the neighborhood:
the whole-world pass is as forbidden here as in Law 4. Status:
existence **Ruled**; mechanism **Proposal**.

## Law 8 — Written outlasts shown

**Law: what you write into the world stays exactly as written; what
the world merely shows you is imagined fresh each time you look —
so learn which is which, because only the written survives.**

**Phext truth.** The reload law (DESIGN.md), which is phext's core
durability fact stated as physics: the document is the only durable
layer, and every view of it is a *function* of the document — and
functions do not persist their outputs. Inscription is forever and
exact (the snapshot, the WAL, and the lossless fold keep it);
derivation is free and faithless (the surface richness the generator
invents on the way out was never stored, and is re-rolled on
re-derivation). "Because only subspace is durable in this world"
(Will). The corollary the player learns with their hands: **taking
is editing** — a taken glyph is struck from the document and its
effect written where it acted (ruled, The Key); there is no
inventory because there is no second place to keep things.

**In play.** Scars stay. Tunes stay. The hat you were granted stays
— exactly, while the room around it shimmers (DESIGN.md, Daily
challenges). Landmarks you merely *remember* drift; landmarks you
*inscribe* hold. Skilled play is partly inscription discipline:
marking the path with real writes, spending rights (Law 10) where
permanence matters, letting decoration drift because drift is free.
Why some things hold and others shimmer is never explained in-fiction
— it is one of the civilization's standing mysteries, kin to their
dark matter (ruled).

**Veil.** The fiction has a folk vocabulary for this — places are
"fast" or "loose," old travelers "write their names deep." The
guide's first minutes quietly teach one inscription and let the
player watch it outlast a re-entry; the lesson lands without a word
of mechanism.

**Engine.** Generation/derivation is a pure function of (scroll
state, triple, pressure vector): it writes nothing back. The only
writes are inscription verbs — move-trails, chord records, portal
crossings, takes, warps, scars, grants, compaction folds — each one
WAL segment, appended in tick order. This asymmetry *is* the engine's
storage design: reads and derivations are unbounded and free;
writes are few, small, and forever. Cost per inscription 12.5 µs
buffered, sub-ms–1 ms with fsync (measured/derived, DESIGN.md).
Status: **Ruled.**

## Law 9 — Time is a sequence of states

**Law: the world changes only on the tick — one action, one step of
everything — and above the tick the days turn over whole worlds at
midnight, each new day a fresh document that inherits what was
granted.**

**Phext truth.** A document has no clock. What it has is *order*:
a snapshot and the WAL segments after it — a sequence of states,
each one inscription away from the last. Time, in phext, is not a
river the document floats in; it is the document's own history,
kept. The game teaches this at two scales: the tick (nothing moves
unless somebody acts — the world waits for a writer) and the day
(the whole map is saved whole and a new phext spawned at midnight
CST, on EE schedule — DESIGN.md, The daily cycle). The epoch grid
touches play exactly once a day, at the fold: a day is 205 5⁄7
epochs, midnight walks the grid five minutes a day, and every
seventh midnight lands exactly on a boundary (7 days = 1,440
epochs, exactly).

**In play.** Turn-pressure is the felt form: tuning a chord while a
monster steps is a decision *about time*. At the large scale, the
day is a world with a lifespan — the daily challenge lives in the
day's map and dies with it, and midnight is an event players plan
around the way MMO players plan around a reset, except that nothing
here is deleted (Law 11): the day *retires* to the shelf of living
yesterdays.

**Veil.** In-fiction: hyperspace runs on ship-time and the charts
turn over at midnight; the epoch grid is not an in-fiction concept
at all and never needs to be. The tick is invisible as a mechanism —
it reads as the world's courtesy of moving when you move.

**Engine.** Tick order is fixed and ruled: **(1)** player actions
inscribe, in WAL order; **(2)** monsters step; **(3)** Life steps.
Falls resolve inside the phases that cause them (Law 3). One action
by any player advances one tick of simulation for the active
neighborhood (their scroll + its Law 7 neighborhood) — simulation
is scoped to where writers are. Old worlds are still living
(ruled), so their ticks must come from somewhere: **Proposal** —
an archived world advances by lazy catch-up when a player enters
it (Life and monster steps for the rooms entered, capped per
entry), rather than by a global ambient clock; the alternative
(a slow ambient cadence, e.g. one tick per epoch) is G40. The day
rollover is scheduled epoch work: snapshot + lossless fold of the
day's phext, spawn the new phext, migrate the grant set (whose
contents are G34). Cost: rollover is a fold — ≈1 s class per
500 MB (derived, DESIGN.md); ticks are bounded by Laws 3–5.
Status: tick order and daily cycle **Ruled**; old-world tick
driver proposed.

## Law 10 — Rights are physics

**Law: some places let you write more deeply than others — a right
is a bounded permission inscribed in the world itself, holding by
extent, by count, or by kind, and lapsing exactly as written.**

**Phext truth.** In phext, permission is not a table outside the
document — it can be *content*: a right is an inscription that names
a coordinate extent, a number of uses, or a single verb, and the
substrate honors it the way it honors any other text. This teaches
the player that access in this universe is *scoped addressing*:
power is always "over this range, this many times, this one act" —
never total (DESIGN.md: "the game's deepest currency is rights over
the substrate — granted limited, never total"). The MVP ships
exactly one rights-granting powerup kind: extent-bound inscription
rights over the pocket it was found in (ruled).

**In play.** A rights powerup is felt, never named (G30 is Will's:
the fiction-side presentation is his to choose). Under any of its
presentations the *physics* is the same: in this pocket your hands
do more — you can write where others can only walk, or compact
(Law 11) where others can only read — and outside the pocket, or
after the count runs out, the world stops answering. The boundary
of a right is as learnable as a wall.

**Veil.** The player understands they have gained something
place-bound and precious — a deepening, a charge, a new string on
the instrument (G30's options). "Subspace rights" is a phrase that
exists only in design documents.

**Engine.** State: a grant is an inscription in the world phext
(scope: extent/count/kind; holder; lapse condition), checked at
inscription time by the WASM core — a coordinate-range test against
the grant's extent, a decrement for count-bound grants. Grants are
part of the migration set at the daily spawn in every G34 option —
a hat and a right cross midnight the same way, because both are
simply inscriptions marked durable-by-grant. Cost: a range check
per inscription; negligible beside the append it guards.
Status: **Ruled** (the rights classes and the MVP default);
presentation open at G30.

## Law 11 — Nothing is ever lost

**Law: nothing the world has ever held is destroyed — compaction
folds it into wider coordinates, migration carries it into the next
world, and every yesterday stays on the shelf, still living.**

**Phext truth.** Multiversal persistence: in a multiversal phext,
"gone" is not an operation the substrate offers. Folding state into
the wider coordinate space keeps every prior state *addressable* —
the archive is not a copy of the world, it is the world at other
coordinates. This is the conservation law the whole design runs on
(Will: "players can compact using multiversal phext, no state ever
truly lost"), and it completes the curriculum: the player who has
absorbed Laws 1–10 already believes it before they ever compact
anything, because they have watched inscriptions outlast worlds
(Law 8) and days retire without dying (Law 9).

**In play.** Compaction is a player verb (ruled): folding a region
feels like *deepening* it — the place gets older, denser, more
itself — never like deleting it. Old worlds are explorable at any
time and still living (ruled): the galaxy of yesterdays grows by
one world a day, forever, and a player can walk into last Tuesday
and find its Life still stepping and its monsters still writing
themselves across it. Prizes cross the day boundary because they
were never *in* the day's geography — they are grants (Law 10),
and grants migrate.

**Veil.** In-fiction, the civilization keeps its yesterdays the way
it keeps its charts: nothing is thrown away because hyperspace has
room. Compaction's in-fiction face — a rite, a tool, a deepening —
rides on the same presentation question as rights (G30/G28).

**Engine.** Compaction = a fold operation over a region into the
multiversal phext; the WAL's history survives it (ruled), and
recovery stays snapshot + replay at every scale. Migration at spawn
= create the new phext, copy the migration set in, leave the old
phext whole — it *is* the saved world, explorable with the same
tooling as the live one (ruled). One adjacency question the
mechanism raises and this document flags rather than settles: if
days are universes in one multiversal space, is *yesterday* a
neighbor of today under Law 7 — does the archive lean on the live
world? **Proposal** to name it; the ruling is G47. Cost: folds are
≈1 s class per 500 MB (derived); nothing in conservation runs per
tick. Status: **Ruled**; cross-day adjacency proposed.

---

## What we deliberately do not simulate

Realism rejected on purpose, per the brief. Each exclusion is a
teaching decision: anything on this list would spend the player's
attention on *our* universe's physics instead of phext's.

- **No momentum, inertia, or friction.** Nothing in subspace has a
  velocity that persists; entities move in tick steps and stop when
  the rule stops them. Continuous dynamics would be a second physics
  living in the view — and the view has none.
- **No ballistic arcs.** Jump is a ruled counter under Law 3, not an
  integrated parabola; the view may *draw* an arc, the substrate
  counts steps.
- **No fluid simulation.** `~` water and `.` lava are glyph classes
  with at most one rule each (lava: what lands in it is struck from
  the scroll — the gravity-kill the brief already uses), never a
  Navier–Stokes hobby. Water's one rule is open, G43.
- **No light, shadow, or acoustics simulation.** Rendering and sound
  are presentation (narration, SFX, the guide); neither feeds back
  into subspace state.
- **No thermodynamics, no chemistry, no weather systems, no
  day/night cycle inside a world.** The only calendar is Law 9's:
  ticks, and the midnight turnover of whole worlds.
- **No relativistic anything.** The fiction says "spacetime"; the
  engine says ticks. No time dilation, no light-speed, no simultaneity
  puzzles — the WAL's order *is* the order of events.
- **No continuous collision geometry.** Occupancy is coordinate and
  cell based: two things cannot hold one address, and that is the
  whole of collision.
- **No monster minds.** No pathfinding, behavior states, factions, or
  learning (DESIGN.md, Complexity drift). One step rule and a speed;
  the menace is in the blinking, not in brains.
- **No economy or population simulation.** Tokens, markets, and NPC
  societies are fiction dressing; the substrate simulates text,
  Life, and the things text does.

## Where the laws collide

The interesting play lives at the intersections. Each collision is
stated with its current resolution or its open G-point.

- **Gravity × Monsters (3 × 5).** The flip is a weapon: a monster
  falls onto lava (struck), out of the room (the scroll records the
  loss), or onto the player's level. Resolved by the tick order —
  the warp inscribes in phase 1, the monster falls in phase 2.
- **Chords × Monsters (1 × 5).** A jump is not an escape from time:
  playing costs the tick, and the monster steps while you tune.
  Arriving in a new slice does not freeze the old one — it goes on
  stepping for whoever is still there (shared world).
- **Chords × Portals (1 × 2).** Addressing vs traversal: the chord
  names a place from anywhere; a portal walks the structure one unit
  at a time. Landing *on* a portal cell after a chord — does the
  crossing fire the same tick? Proposed cap: one traversal per tick,
  crossing resolves after landing. G44.
- **Life × Gravity (4 × 3).** Life's grid is read against the room's
  current down. Flip down and yesterday's floor-grown structures are
  overhangs. Whether inscribed earth itself falls is G42; until
  ruled, entities fall and earth stays.
- **Life × Escalation (4 × 5).** Life grows the document; growth is
  danger. Erosion shrinks it; danger follows the current size, up or
  down (ruled). Danger is a commons — your quiet farming of a grown
  region raises everyone's monsters.
- **Pressure × Escalation (7 × 5).** Danger is partly *imported*: a
  calm scroll beside a monster-dense neighborhood generates under
  pressure and receives crossers. "Safe" is a local and temporary
  property.
- **Pressure × Flux (7 × 6).** Flux density is the visible gauge of
  invisible pressure — the one place the engine lets a player *see*
  Law 7 working, if the density coupling is adopted (G39).
- **Inscription × Drift (8 × 6/8).** The skilled player's core loop:
  decide what to write (it stays) and what to let the generator
  re-imagine (it drifts). Hats sit on the written side of the line;
  the room's décor sits on the shown side.
- **Rights × Compaction (10 × 11).** Folding a shared region may
  require a right over it — who may compact the commons is policy
  (G28), and Law 10 is the mechanism that would enforce it.
- **Portals × Pressure (2 × 7).** Crossing a big break replaces your
  whole neighborhood at once: pressure is recomputed wholesale on
  the far side, which is why a `}` volume crossing feels like a
  climate change. The `^` gate exits the neighborhood graph
  entirely — the library contains worlds, not scrolls.
- **Conservation × the Day (11 × 9).** Migration defines what "you"
  are across midnights: the migration set (G34) is the physics of
  personal identity in this universe — you are the inscriptions
  marked to migrate.
- **Archive × Pressure (11 × 7).** If days are universes in one
  multiversal phext, yesterday is *somewhere* relative to today.
  Whether it leans is G47.

## GUIDANCE — new questions for Will (continuing DESIGN.md's numbering)

37. **G37 · Pressure — the neighborhood's shape** (Law 7's mechanism
    is proposed; its shape is his): (a) immediate neighbors along
    each axis only — at most 22 scrolls, read per tick for the
    active scroll (simplest, and the costing in Law 7 assumes it),
    (b) neighbors plus their Life mass two steps out along the
    slice's chosen axes, (c) pressure from the *containing units*
    (the section, the book…) instead of adjacent scrolls — scale
    pressure instead of adjacency pressure.
38. **G38 · Pressure — what it is allowed to do**: (a) generation
    bias only (terrain and flux; crossers arrive by Law 5's own
    motion), (b) generation bias plus seeding (Life edge-seeding at
    generation), (c) also direct effects — a sufficiently dense axis
    can tilt a fresh pocket's inscribed down toward the weight
    (gravity as pressure's symptom; the wildest option, listed for
    completeness).
39. **G39 · Flux density — its source**: (a) pressure-coupled —
    flux ∝ inscribed density along the unchosen axes (Law 6's
    proposal; makes flux a readable gauge), (b) pocket-fixed — flux
    density is a property of the pocket's hash alone, uniform across
    visits, (c) both: a hash baseline the pressure term modulates.
40. **G40 · Old worlds — what drives their ticks** (Law 9's
    proposal needs its ruling): (a) lazy catch-up on entry, capped
    per entry (simplest; a world nobody visits simply waits),
    (b) a slow ambient cadence — one tick per epoch — for every
    archived world, (c) catch-up on entry *plus* ambient ticks for
    worlds visited within the last day.
41. **G41 · Jump — its subspace form**: (a) a short upward counter
    the gravity rule spends, one cell per tick (this document's
    proposal; keeps jump inside Law 3), (b) a one-tick gravity
    exemption for the player only, (c) jump is view-only — the arc
    is drawn, and only the landing cell ever inscribes.
42. **G42 · Earth under a flipped down**: (a) earth never falls —
    only entities do (the MVP's silent assumption, made explicit),
    (b) unsupported earth falls in the Life phase, so flips remodel
    rooms permanently, (c) earth falls in pockets only; authored
    scrolls hold.
43. **G43 · Water's one rule**: (a) water fills low cells at
    generation via generative geometry and is otherwise inert,
    (b) water is pass-through — falling into it is a slow fall, one
    cell per two ticks, (c) water is a pure glyph class in the MVP
    with no rule at all (lava carries the material physics alone).
44. **G44 · Portal chains**: (a) at most one traversal per tick —
    a landing on a portal crosses at the *next* tick's start
    (simplest; prevents chain-teleport accidents), (b) crossings
    chain until the entity rests on a non-portal cell, (c) portals
    fire only on a deliberate step onto them, never on a chord
    landing.
45. **G45 · Can pressure be *read*?** (veil-sensitive): (a) no
    instrument — pressure is felt through terrain, flux, and
    arrivals only (purest veil), (b) the instrument rings differently
    under pressure — a note's tone bends near a heavy axis, and the
    ear learns it (comprehension by ear, again), (c) flux color
    shifts with pressure, a visual gauge in the noise itself.
46. **G46 · Realm physics accents**: Nova Prime plus the ten named
    realms (Review 1) — (a) one physics accent each (a gravity
    habit, a Life cadence, a pressure temperament), so realms are
    distinguished by *feel* and not only by palette, (b) uniform
    physics everywhere; realms differ in generation and naming only,
    (c) accents arrive later, realm by realm, as each is designed.
47. **G47 · Is yesterday a neighbor?** (Law 7 across the multiverse):
    (a) no — each day's phext is its own lattice; pressure never
    crosses the fold, (b) the previous day is the new day's neighbor
    along the library axis — migration makes them adjacent, and the
    archive leans faintly on the live world, (c) all archived days
    press, weighted by recency — the galaxy's whole history is its
    dark bulk.

---

*Status of this document: design development under Will's
2026-11-22 physics brief. Everything marked Ruled traces to
DESIGN.md, REVIEW-1.md, or the OG spec; everything marked Proposal
is Emise's extension, awaiting the G-points above. The veil binds
the game, not this document — subspace is named freely here so it
never has to be named there.*
