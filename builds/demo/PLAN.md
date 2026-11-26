# Nova Fox — concrete plan + playable demo

**Task: 24.5.10/8.7.14/5.4.7** — minted from Will's words (2026-11-22 16:11 CST):
"give me the concrete plan and playable demo, we'll revise from there"
Design of record: `~/workspace/nova-fox/DESIGN.md` · OG glyph spec: `~/workspace/nova-fox/white-rabbit-spec.txt`
Status: **Step 1 (the demo) is built and playtested.** Nothing published — local files only, for Will's revision.

---

## How to open the demo

Open `index.html` in any browser. It is a single self-contained file
(Three.js r160 vendored in, the WASM core embedded as base64, the world
embedded as text) — no server, no network, works from `file://`.

Rebuild after touching sources: `python3 build.py` (concatenates
`assets/three.module.js` + `dungeon.js` + `nova_core_b64.js` +
`subspace.js` + `game.js` into `index.html` from the `page.html` shell).

## Controls

| Input | Verb |
|---|---|
| Arrow keys | walk (gravity settles you after every step; one-cell step-up onto ledges) |
| Q W E R T Y U I O P [ | the eleven notes — any **three distinct notes** = a chord = a jump: a pocket opens |
| G | turn the room (gravity flips; the dark thing falls too) |
| Space | wait a tick |
| X | set stone beneath you — only in a room where you took a `*` deepening |
| V | re-derive the view (watch what shimmers, what stays) |
| mouse | on-screen pads, d-pad, and buttons mirror every key |

## What to look for (the loop, in order)

1. **Arrival.** Walk the entrance shelf east and drop down the fall shaft
   onto the `*`. The readout's inscription log grows — taking the
   deepening is *written down*. Now X works in this room.
2. **The veil holds.** Nothing in the fiction says how the world works —
   only rifts, tunes, charts, the dark. The panel on the right is demo
   instrumentation for you, labelled as such; it is not in-fiction.
3. **Play three notes** (try Q·E·T). A pocket opens: foam seeded from
   where-you-stand + the tune, Life-evolved before you enter, then
   inscribed as a new scroll. The world grew by one scroll, permanently,
   in the log. Play the same tune in the same place again later — you
   return to the *same* pocket, scars and all.
4. **The dark thing.** One monster kind. It steps toward you every tick
   but is only *there* — visible, dangerous — one phase in three (the
   slice agreeing with it). It falls under the same gravity: flip the
   room (G) and it drops; drop it on burning ground and it dies, and the
   room's scroll keeps the scar (`.`), in the document, in the log.
5. **Burning ground costs a heart to cross** — it does not refuse you.
   For the monster it is death. That asymmetry is a weapon.
6. **Life ticks** every turn: in pockets the earth itself evolves;
   in authored rooms only the flux ecology moves — authored glyphs and
   earth are never rewritten by Life.
7. **Press V (re-derive).** The dressing — earth depth, rubble, motes,
   the whole starfield — re-rolls: similar, never identical. The scroll
   text in the readout does not change by one byte. Inscribed = exact;
   merely derived = drifts. That contrast is the reload law, playable.
8. **Death is not erasure.** At zero hearts you are carried back to
   Arrival. Every mark you made is still written.

Premise, one line at entry (guidance point G26 is open — this line is
a placeholder for your revision, kept to exactly one line):
*"The galaxy is conquered. The dark still outweighs it. Then the rifts opened."*

---

## Playtest record (honest)

Run 2026-11-22, against the shipped files:

- **Node module suite — `node test.mjs`: 35 passed, 0 failed.**
  WASM kernels bit-identical to the JS fallbacks (hash / foam / Life);
  the document round-trips byte-exact; authored-room reachability proven
  with the game's own step/settle rules; chord → pocket inscribed as a
  new scroll; same tune reopens the same pocket; three chords → three
  distinct pockets; pocket generation deterministic across worlds; an
  inscribed scar survives re-derivation while the view seed re-rolls;
  monster steps toward the player; Life preserves authored glyphs in
  flux mode and evolves pocket earth; monster speed goes 1 → 2 when the
  world doubles.
- **Browser end-to-end — `node cdp_test.mjs`: 22 passed, 0 failed.**
  The shipped `index.html` driven in headless Chrome (SwiftShader WebGL)
  with real keyboard events: page boots with the WASM core live; shelf
  walk + shaft fall delivers the player onto the deepening and the WAL
  grows; Q·E·T opens a pocket (5 scrolls, tune segment logged, monster
  live); gravity flips and the warp is inscribed; the pocket road is
  walked end to end — across the burning cell, flip-pair mid-road —
  and the gate is crossed; re-derive leaves `doc.serialize()`
  byte-identical while the derivation epoch advances; the same tune
  reopens the same pocket; zero page console errors.
- **Found and fixed during playtest:** burning ground originally
  *refused* the step and bounced the player back — which made pocket
  roads impassable (a 1-cell burn walled the road) and let the monster
  farm a pinned player to death. Changed to the rule above (crossing
  costs; monsters die on it). The Node reachability audit and the game
  now agree.
- **Not verified:** no human has played it yet — feel, difficulty, and
  readability of the 3D view are unjudged (that's your pass). WebGL was
  exercised via SwiftShader in headless Chrome, not on a physical GPU.
  Audio (the pluck synth) is wrapped to fail silent and was not
  verified audible headlessly.

## Stack truth (WASM)

Real, not claimed: `core.rs` → `nova_core.wasm` (**1,496 bytes**, no_std,
`rustc --target wasm32-unknown-unknown`, build line in the source header)
carries the three deterministic kernels — seed hash, pocket foam, Life
step — and the page runs them (the readout says "WASM core live"; the
Node suite proves WASM ≡ JS bit-for-bit). The rest of the subspace logic
(parse, projection, inscription log, monster step) is JS in
`subspace.js`, deliberately structured as one separable module mirroring
the WASM core's job — at MVP step 2 it moves behind phext-lattice as the
resident world + WAL writer, per the brief's stack. The demo's WAL is an
in-memory segment log (shown in the readout); on-disk WAL segments,
snapshotting, and replay are step 3. Three.js is vendored for the demo
build only so the file opens anywhere.

---

## The plan — demo → MVP → beyond

**Step 1 — Playable demo (DONE, this build).**
Proves: the brief's core loop is playable end to end in a browser — a
real phext world, derived 3D views, gravity + flip, the instrument
opening Life-evolved pockets, one monster under the escalation law,
inscription with a visible log, and the reload law as an experience.

**Step 2 — The world moves server-side (phext-lattice resident world).**
The Doc + single WAL writer run resident against phext-lattice (the
capacity verdict's shape: ~0.55 s cold load of a 500 MB world, ~0.6 µs
indexed reads, WAL append per action — never whole-document rewrites);
the browser works per-slice. *Proves: the measured capacity verdict in
production shape, and that the demo's module boundary was drawn right.*

**Step 3 — Durability: WAL segments on disk, snapshot + replay, compaction.**
Inscriptions append as runtime WAL segments; recovery is snapshot +
replay; players compact with multiversal phext — a lossless fold, never
deletion. *Proves: "no state ever truly lost" as a running system, and
settles G28/G29 (cadence, fsync policy) with measurements.*

**Step 4 — One shared open world, multiplayer.**
Concurrent players inscribe into the same document; monsters and Life
are shared state; moderation can only fold, never prune (G25).
*Proves: the storyline's premise — one galaxy, many foxes, one dark.*

**Step 5 — The instrument, ruled.**
The curated canon of ~10 reality triples (G31 — expandable, never a
substrate cap), the note→axis mapping settled (G19), a jump cost (G20),
harp vs flute decided (G18). *Proves: navigation by tune as the world's
real geography, not a demo shortcut.*

**Step 6 — Rifts and storyline, ruled.**
What rifts are (G27: placed / Life-emergent / instrument-torn), how the
premise surfaces beyond one line (G26), coordinate display in-fiction
(G7), where it lives (G8). *Proves: the fiction layer carries the
mechanics without breaking the veil.*

**Beyond (post-MVP).** The full C(11,3) = 165-triple substrate under the
canon; rights powerups scoped by count and by kind, not only by extent;
further monster kinds (G14) and off-slice monster action (G15); an
attack verb if the flip-and-burn grammar proves insufficient (G16);
MOST scaffold convergence (G3) on the shared Three.js + Rust/WASM +
libphext stack; the 1 KB-room / Base-88 heritage formats as import
paths for OG Nova Fox content (G1).

---

## Revision points — where the brief was silent and the demo chose

Named, not hidden. Each is a default awaiting your ruling:

1. **Portal destinations** come from a small authored LINKS table in
   the demo, not from the phext break each portal stands for (G4).
2. **Monster visibility** is a 3-phase cycle (hash-drifted), visible
   only at phase 0 — one reading of "crosses the player's slice."
3. **Life runs in two modes** (pockets: earth evolves in-document;
   authored rooms: flux only) — a demo scoping of G22–G24.
4. **Burning ground**: crossing costs a heart, no refusal; monsters die
   on it. (Changed in playtest — see the record above.)
5. **Contact**: costs a heart; the monster recoils to its start;
   three ticks of grace follow any hurt.
6. **Death**: return to Arrival at 3 hearts; all inscriptions kept.
7. **The `*` deepening** grants extent-bound, kind-specific rights
   (set stone, this room only) — the brief's MVP default scope.
8. **Any** three distinct notes open a pocket in the demo; the ~10
   curated triples are the world's canon (G31), not a demo restriction.
9. **Entry spawns** at the room's `/` glyph (pockets and Arrival) or
   the first door glyph — doors are topological, not positional.
10. **Standable rule**: glyph surfaces hold you; earth holds the cell
    above it; horizontal steps auto-step one cell up onto a ledge.
11. **The premise** is exactly one line, at entry only (G26 open).
12. **The demo world is one page, one player.** "One shared open
    world" is honored as one shared *document*; multi-user sharing is
    step 4, by design.

## Files

| File | What it is |
|---|---|
| `index.html` | the playable demo (self-contained build output) |
| `page.html` + `build.py` | the shell + the builder that produces `index.html` |
| `game.js` | view (Three.js), input, tick loop, glyph interactions, readout |
| `subspace.js` | the separable subspace module: Doc, WAL log, pockets, Life, gravity, monster |
| `core.rs` / `nova_core.wasm` / `nova_core_b64.js` | the WASM kernels + their embedded form |
| `gen_dungeon.py` | generates the world (coordinate-exact glyph placement) |
| `dungeon.phext` / `dungeon.js` | the world itself — a real phext, 4 scrolls, and its embedded copy |
| `assets/three.module.js` | Three.js r160, vendored for the self-contained build |
| `test.mjs` | Node playtest of the module + WASM (35 checks) |
| `cdp_test.mjs` | headless-Chrome playtest of the shipped page (22 checks) |
| `PLAN.md` | this file |
