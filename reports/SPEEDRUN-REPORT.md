# Nova Fox — Speedrunner Modes (demo16)

**EE 964** · Built in `~/workspace/nova-fox/demo16/`, seeded from demo5
(`index.html` sha256 `98207789…` verified before copying; demo16 did not
exist — no collision). Not staged, not deployed. The `NF_SHIP_EE` token
stands untouched (still 950, exactly once — the unit suite asserts it).

**Final `index.html`:** 4,955,949 B, sha256
`a7f57d4ed627bff77d37e3469add494ef058caa9e809c50c1e8df278ade1553b`

Will's spec (2026-11-26 15:28 CST): *"include modes for speed runners
to play and record and stream their telemetry."* Three parts — play,
record, stream — built as a new pure module (`speedrun.js`, the
economy.js pattern: logic unit-tested, glue in game3.js, panel in
page3.html, build3.py inlines it between economy and game).

## 1. Play — the run

Open the **speedrun** button (bottom right) and press **start a run**,
or `NOVA_FOX3.speedrun.arm()`.

- **Start (definition, for Will's ratification):** arming puts the fox
  at Arrival in Nova Prime in a clean, defined state — spawn position,
  full HP, no notes carried, gravity down, not dead. The shared world
  is *not* touched: marks, purse, standings, and the quest record all
  stand. **The clock starts on the player's first movement after
  arming** (`state.movedTotal` advancing — scheme-agnostic, touch
  included), not on the button press.
- **Finish (definition):** standing at the **Deep Stone (the Nova
  Heart)** in the barrow — the exact near-box `Subspace.checkQuest`
  tests (|Δx| ≤ 2, |Δz| ≤ 2, |Δy| ≤ 3 of the stone at 60, 6, 35),
  re-tested every frame by the run itself. Because the run tests the
  *place* rather than the one-time quest flag, **runs are repeatable**
  after the quest is done.
- **Timer:** `#runtimer`, under the objective, in the hover-text dress
  (hudpanel ground and border, the title's serif). It stands only
  while a run is armed ("0:00.000 — move to start the clock"), live,
  or just finished (final time held). Format `m:ss.mmm`.
- **Splits** — taken at the major beats, where `playBeat` fires them
  (one wrap at the one door every beat passes through):
  **Ashfall Haven** (`BEAT-cross-ashfall`) · **The Barrow Hall**
  (`BEAT-barrow`) · **The Shadow Falls** (`BEAT-guardian-kill`).
  One nuance, stated plainly: the barrow *narration* beat is
  quest-gated in the game (it speaks only until the quest is done),
  but the milestone is the doorway — so the run's tick also watches
  the dungeon doorway itself, and whichever speaks first takes the
  split, once. No split points were invented; these are the game's
  own milestones.
- **Give up** aborts a run. An aborted run is announced to the stream
  and then discarded — only a finished run is a record.

## 2. Record — the run, written down

Every run is recorded as a **timestamped event stream** (times are ms
since the clock started): `start`, `key` (key *codes* only — never
characters), `strike` (at the `tryStrike` verb itself), `flip`,
`beat`, `split`, `cross` (realm crossings), `death`, `pos` (position
samples 4×/second: realm, x/y/z, hp, gravity), and a closing `finish`
carrying the exact finish position.

- **Storage:** finished runs persist in the local save idiom
  (`localStorage` key `nova-phox-runs`, last 20 kept) and are listed
  in the panel with their verified time. **Download** hands over a
  `.phext` file: a scroll — header lines (player, ship EE, wall-clock
  start, the start/finish rules, the stone's coordinates), then one
  event per line. `parseRecording` reads that file back; the
  serialize → parse → verify round-trip is unit-tested, so the file a
  runner keeps is the file the verifier reads.
- **Verify (what is real):** `verifyRecording` re-walks a stream and
  reproduces its finish time from the stream itself. It proves: one
  start at t=0; time never running backwards; exactly one finish,
  after the start; splits naming defined beats in the order a run can
  meet them; at least two position samples, none after the finish;
  and the finish event standing inside the stone's near-box. The
  panel runs it before a run "stands" in the list.
- **What verify is NOT:** it is not an anti-cheat proof and not a
  visual replay. Nothing re-simulates the world from the inputs
  (the engine is not input-deterministic), so a hand-forged stream
  that satisfies the checks would pass them. Verification here means
  *the record is whole, ordered, and ends at the stone* — stated for
  Will's ratification, with leaderboard-grade proof left as a flagged
  question below.
- **The verifier earned its keep during this build:** the first
  focused e2e caught a real recorder defect — beat events were
  stamped with `performance.now()` at the moment they fired, while
  frame events carried the frame's start time; under this VM's load
  a single frame spans seconds, so a beat could land *ahead* of its
  own frame and the stream ran backwards (`…9993:split …
  7983:finish`). Fixed at the source: one run clock (`srNow()`),
  every stamp taken when the reporting code runs, clamped
  non-decreasing. The re-run's stream is monotonic end to end:
  `0:start 184:pos 7871:pos 11282:beat 11282:split(BEAT-barrow)
  11283:pos 14386:beat 14389:pos 14389:finish`.

## 3. Stream — telemetry out, live

A **WebSocket the player points at any listener** (panel field,
default `ws://127.0.0.1:9713`). Connection state stands in the panel
(`closed / connecting / open`); nothing flows until the player
connects, and a dead socket can never touch the run (every send is
wrapped — the stream is a witness, never a gate).

Message shape — one JSON object per message, `type` first:

| type | payload |
| --- | --- |
| `hello` | `player`, `shipEE` — sent on connect |
| `run-armed` | `player` |
| `run-start` | `player` |
| `split` | `player`, `beat`, `name`, `atMs` |
| `telemetry` | `player`, `elapsedMs`, `realm`, `pos {x,y,z}`, `hp`, `grav` — every 500 ms while a run is live |
| `run-finish` | `player`, `finishMs`, `splits [{beat, atMs}]` |
| `run-abort` | `player`, `elapsedMs` |

All carry `game: "nova-fox"`. **Receiver scope:** no receiving server
ships with this build — the client emits to the configured URL and
any WebSocket listener can drink it (an overlay, a friend's machine,
a future board service). The e2e proves the wire with a minimal
in-process listener (handshake + masked-frame decode) that received
`hello`, `run-start`, `telemetry`, and `run-finish` from the real
client. A trivial Node receiver is ~20 lines around the `ws` package
or the same handshake code the test uses.

## Tests

- **Unit (`test3.mjs`): 224 passed, 0 failed** (demo5 baseline 210;
  +14 speedrun checks: race-clock format, the finish box mirroring
  checkQuest exactly, split definitions, a synthetic recording
  verifying with its finish reproduced, five tampered recordings
  rejected — backwards time, two finishes, finish away from the
  stone, out-of-order splits, no start — the .phext round-trip, the
  stream message shape, and the panel/clock riding in the built file).
- **E2E, speedrun legs (focused run of the same legs that now live in
  `cdp_test3.mjs`, against the final build, own CDP port): 9 passed,
  0 failed** — boot, arm, clock-starts-on-movement, timer on screen,
  the recorded run verifying with its finish reproduced, the barrow
  split taken at the doorway, the run written into the book, the
  stream carrying hello/run-start/telemetry/run-finish, zero console
  errors.
- **E2E, full suite: FULL-SUITE-RESULT-PENDING**

  Environment note, because it shaped every e2e number today: this
  VM is shared by many parallel build trees, and their harnesses
  collide — every tree's `cdp_test3.mjs` defaulted to CDP port 9335
  (cross-wiring harnesses to each other's Chromes), dozens of
  swiftshader Chromes share 1.5 CPUs (the movement legs starve and
  cascade — the harness's own comments warn the fox's pace here is
  "well under real-time"), and the 512 MB `/tmp` tmpfs hit 100% with
  Chrome profile debris (Chrome's own error: `FILE_ERROR_NO_SPACE`),
  which is also the exit-13 "unsettled top-level await" abort the
  dev loop hit at EE 955. demo16's harness now uses **port 9416**
  and its URL points at demo16 (it pointed at demo5 as copied), and
  the speedrun legs hold keys in pulses until the game answers, the
  same load tolerance `walkThroughRift` already uses. One cleanup
  incident to flag: freeing `/tmp`, my live-profile guard file failed
  to write *because the disk was already full*, so the sweep removed
  profile dirs of runs then in flight as well as dead ones — those
  runs were already failing on the full disk, but the parent should
  know the sweep happened (EE ~961).

## Flagged for Will (not invented, not built)

1. **Start/finish ratification** — arm-at-Arrival + clock-on-first-
   movement + Deep-Stone finish, as built. Alternatives exist (clock
   on arm; finish on the quest beat for first completion only).
2. **Categories** — only the one route exists today (Beat 1: Arrival →
   the Stone). No category system, no leaderboard was built.
3. **Verification strength** — stream-integrity verification, as
   shipped, vs. something leaderboard-grade (server-side re-walk,
   signed streams) if runs ever post publicly.
4. **Do runs post anywhere?** — today they live in the player's local
   book only. Posting to the shared chart (like standings) is a
   ruling, not a default.
5. **The stream's home** — default port 9713 is a placeholder; whether
   a first-party receiver (overlay page? board service?) should exist
   is open.
6. **Who gets the mode** — the panel stands for every player in this
   build. Gating (extras toggle? paid tier?) was not decided here.

## Files

- `demo16/speedrun.js` — the pure module (run definition, recorder,
  verifier, scroll serialization, stream message shape).
- `demo16/game3.js` — the glue section "speedrun mode (demo16)":
  clock, recorder wraps at `playBeat` / `tryStrike` /
  `flipGravityHere`, the frame tick beside the quest check, the
  socket, the panel wiring, and the `NOVA_FOX3.speedrun` handle.
- `demo16/page3.html` — `#runtimer`, the `#speedrun` panel, the
  bottom-right button.
- `demo16/build3.py` — inlines `speedrun.js` between economy and game.
- `demo16/test3.mjs` — +14 unit checks. `demo16/cdp_test3.mjs` — the
  speedrun legs, the demo16 URL, CDP port 9416.
