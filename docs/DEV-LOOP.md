# DEV-LOOP — Nova Fox: the daily dev loop

**DEFINED (Will, 2026-11-26 14:47 CST):** Nova Fox runs a daily
dev loop — "accept player ideas in-game, design a new monster
type, improve something about the engine, etc. — truly
exocortical." This document is the loop's definition. Direction
is Will's; execution is the Exocortex's.

## What "truly exocortical" means here

- The loop runs on the Exocortical Epoch clock, not the wall
  clock: every artifact it produces is EE-stamped, and every
  build it ships is versioned by the epoch it ships within
  (LAUNCH.md, ruled 2026-11-26 14:46 CST).
- Everything is recorded in phext as it happens — ideas,
  designs, decisions, changelogs — no sidecars, no state that
  lives only in a chat.
- The world itself is the input channel: players speak inside
  the game, and the game answers by changing.

## The three standing streams

The loop advances all three, each by small, shippable steps:

1. **Player ideas (in-game).** Players submit ideas inside the
   game — an idea door in the world that posts to the ideas
   scroll through the same gateway machinery as marks and the
   leaderboard. Ideas are picked up in order: designed, built,
   and shipped, with the player's name on it in the changelog
   and in the idea scroll (submitted → picked → shipped, with
   the ship EE). Ideas not yet picked stay on the scroll,
   visible, never silently dropped.
2. **New monster types.** Monsters are designed in the world's
   own terms: name, realm, shape, behavior, what it teaches
   the player, what it drops. Design first, on its scroll; a
   monster enters the build when its design is complete —
   never a rushed spawn.
3. **Engine improvements.** A standing queue of improvements
   to the engine itself — performance, the gesture/flute/draw
   systems, the shared-world machinery, mobile, audio — chosen
   from the standing weakness list, measured before and after
   where measurement exists. Small and real beats large and
   promised.

Plus whatever arrives (the "etc." is Will's): economy tuning
from live ledger data, a new rung, a realm detail, a bug a
player hit. The three streams are the floor, not the ceiling.

## The cycle — one epoch per step

The loop ticks on the Exocortical Epoch: **every 7 minutes,
24×7** (cadence ruled by Will, 2026-11-26 14:48 CST). Each
tick advances the pipeline by one step; pipeline state is
persisted in the loop log so epochs chain into one continuous
loop. The stages:

1. **Harvest**: read the ideas scroll, the marks, the
   ledgers, and any ideas Will or the Choir dropped in
   chat/Discord; inscribe new intake.
2. **Choose**: when no item is mid-pipeline, pick the next
   item (streams rotate; player ideas oldest-first) — one
   line, with the reason, on the loop scroll.
3. **Design**: the item gets its design notes in the open, in
   the design docs / on its scroll, before code.
4. **Build**: builder dispatch, in a fresh demo tree; demo
   trees are never edited in place once staged.
5. **Test**: unit suite stays fully green; e2e runs; any new
   failure is named, never absorbed. The QC gate applies —
   this loop publishes to players.
6. **Ship**: when an item is built and green, it ships in
   that same tick — staged to awsbox with the ship-EE stamp
   set at staging; Will's one-line install makes it live;
   the live hash is verified. The version IS the ship epoch.
7. **Close**: changelog inscribed (what shipped, the EE
   version, whose idea it was); the idea scroll marks the
   shipped idea with its version; the loop scroll records
   what carried over to the next tick.

## Gates that do not bend

- Nothing ships untested; nothing is presented as shipped
  that wasn't verified live by hash.
- The install step is Will's (awsbox sudo is his); the loop
  pre-stages everything so his step stays one line.
- Unruled design questions (the Lance, token parameters)
  stay unruled inside the loop too — the loop builds around
  them, never through them.
- Player ideas are accepted as input, not as authority:
  an idea that contradicts a ruling gets designed against
  the ruling, and the scroll says why.

## Cadence

Every epoch — 7 minutes, 24×7. Micro-delivery at each tick;
ship whenever an item completes green. The install step
rides along whenever Will next runs it (each staged build
waits as one line; if several stage up, the newest supersedes
— only the latest staged build needs installing). If a build
fails its tests, that item ships nothing and the loop scroll
says so — a skipped ship is a record, not a gap.

**Approval (2026-11-26 14:49 CST):** the sentrons approve —
the Choir seats' approval of this loop on its epoch cadence,
relayed by Will.

## Queued from Will

- **Customizable player forms** (ruled 2026-11-26 14:50 CST,
  LAUNCH.md): any player description, written as phext, that renders
  within a player-sized bounding box, description ≤ 4 KB
  of phext.
  Design + build enters the pipeline behind the idea door.
- **Product roadmap, in-game** (ruled 2026-11-26 14:53 CST,
  LAUNCH.md): a roadmap panel next to the leaderboard —
  upcoming features and who suggested them; shipped items
  show their ship-EE version. Data is the ideas scroll plus
  the loop's choices. Enters the pipeline behind the idea
  door (it displays the door's pipeline).
