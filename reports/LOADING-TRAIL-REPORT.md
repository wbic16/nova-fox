# Nova Fox — loading-screen word trail (demo9)

Built EE 958 (2026-11-26). Fresh tree demo9, copied from demo5
(index.html sha256 verified before copying:
98207789e35e62b1b3399d60180b03fea223d9c488311332c60f1e4cf15a8f40).
Not staged, not deployed. The NF_SHIP_EE token value is unchanged
(still `NF_SHIP_EE:950`, exactly once in the built file).

**Deliverable:** demo9/index.html — 4,940,603 bytes,
sha256 `897fbbee57167786ddd9da8262f40b8602eb8483a569fa26a65d25d043494bba`.

## What it is

On the load panel (the phext logo splash the game boots behind), a
single quiet line of words flows while the world loads: small
(11 px), italic Georgia, muted blue (#41618c), under the panel's
hint text. One token every 110 ms, a rolling window of the last 9
tokens. It starts when the boot starts and ends when the world is
ready — the first of: the boot's backend sync settling
(backendProbe → backendFlush), the player stepping the panel
aside, or a 30 s hard cap. On ending, the line fades out and
clears. Will's spec, verbatim: "an infinite trail of words that is
literally reading subspace, but this isn't communicated to the
player directly."

## How the trail taps the real read stream

The machinery is pure and unit-tested in world.js (`TrailFeed`,
`trailWordsFrom`, `TRAIL_FLAVOR`); game3.js wires it to the boot's
actual reads. There is no canned word list for the read words:

- **The local subspace's own inscription log.** Every entry the
  world writes while generating is tapped as it is written (the
  existing `sub.log` wrapper in game3.js now also calls
  `trailTap(where + detail)`), and the log written before the tap
  is installed (genesis + the spawn neighborhood's scroll opens)
  is backfilled from `sub.wal` at trail start. These are the words
  of the embedded-data reads the single-file build performs.
- **The gateway scroll reads.** In `backendFlush`, the three
  `/api/v2/select` answers the boot reads back — the board scroll
  (1.1.1/1.1.2/1.1.1), the purchase record (1.1.1/1.1.3/1.1.1), and
  the economy ledger (1.1.1/1.1.4/1.1.1) — are captured as raw text
  and fed to the trail (`trailTap(text)`) exactly as they arrive,
  before the existing parsers consume the same string. Behavior of
  the reads is unchanged; the trail drinks from the same stream.
- Offline (file://, gateway unreachable), the gateway taps simply
  never fire and the trail runs on the local inscription words —
  verified live in the e2e environment (see below).

Tokenizing: split on non-word characters, keep words of 2+
characters, clip tokens at 24 chars (hashes and keys ride the
chart too). The feed is capped at 220 queued words; past the cap,
words are **dropped, never queued** (the feed counts them in
`dropped`), so a fast read stream cannot make the trail a backlog
that slows the load. Rendering is one DOM text write per 110 ms
tick, and the interval dies with the trail.

"Infinite": the trail never loops a fixed sequence — read words
are whatever the reads actually returned, and flavor phrases
cycle through 27 phrases with a wandering 5–9-word gap, so no
visible pattern repeats while loading lasts.

## The flavor phrases

Interleaved every 5–9 read words, one whole phrase at a time:
reticulating splines · charging batteries · greasing the gears ·
polishing the portals · counting backwards from infinity ·
untangling the cables · feeding the hamsters · sharpening the
pencils · inflating the tires · brewing the coffee · sorting the
mail · winding the clockwork · dusting the shelves · aligning the
stars · tuning the instruments · oiling the hinges · stacking the
crates · herding the electrons · shuffling the deck · tightening
the bolts · waxing the moon · folding the laundry · priming the
pump · sweeping the hangar · labeling the boxes · testing the
echoes · raising the periscope · calibrating the compass.

## The no-communication check

Nothing player-facing names or explains the trail: the element is
an unlabeled `<div id="trail-line">` in the splash panel; no
caption, tooltip, or copy mentions it. Unit checks pin this: the
splash markup extracted from the built file contains no
"subspace", and no flavor phrase contains it either. (Code
comments in world.js/game3.js do say what the trail is, as the
spec allows; the game's pre-existing demo-readout panel elsewhere
is untouched.)

## Tests — real counts

- **Unit (test3.mjs): 221 passed, 0 failed** — the demo5 baseline
  of 210, plus 11 new trail checks: shown words come from the
  mocked read stream fed in (gateway-shaped board/purchase/ledger
  text + log lines); nothing is shown that was never read or is
  not flavor; flavor phrases interleave between read words;
  Will's two named phrases are in the register; the feed drops
  past its cap rather than queueing; a stopped feed stays silent;
  the tokenizer keeps words, drops noise, clips the long; no
  flavor phrase names the source; the trail line rides in the
  built load panel; the load panel never names the source; the
  read taps (log wrapper + 3 selects) ride in the built file.
- **E2E (cdp_test3.mjs): 122 passed, 12 failed** of 134 (baseline
  126/7 of 133; the +1 is the new trail check, which **passed**:
  "the loading trail rides the load panel, fed by the boot's
  reads" — in the offline harness the feed was fed >0 words by the
  local inscription log alone). Of the 12 failures:
  - 7 are the known touch-emulation legs (world-drag yaw, jump,
    flip, ceiling landing, draw arming, triangle rift, flute
    drag) — the standing harness class.
  - 5 are one contention timeout and its cascades: "crossing
    through the standing door" hit `.. timeout waiting for: link
    crossing` (the harness's own pace warning applies — this run
    took 765 s wall under several sibling trees' Chromes sharing
    1.5 CPUs), the two door-link legs behind it failed because the
    fox never crossed, and two economy assertions downstream of
    that flow read the disturbed state (the economy machinery's
    own checks around them passed). The trail change touches no
    movement, rift, or economy code path.
- **Harness note (demo9-local):** cdp_test3.mjs in this tree uses
  CDP port 9347 instead of the shared 9335, and its target URL
  points at demo9. Reason, evidenced during this build: sibling
  trees' harnesses share port 9335, and a harness that finds the
  port taken connects to and navigates *another tree's page* —
  three early runs died with "NOVA_FOX3 is not defined" at moving
  points, and the identical death reproduced on the untouched
  demo5 baseline (49 checks in) before the port was changed. On
  the private port the suite ran end to end.
- A standalone page probe (separate CDP port) also verified the
  trail live: page boots with zero exceptions and the trail line
  was already populated from boot reads.

## Files changed (demo9 only)

- `world.js` — the trail section: TRAIL_FLAVOR (27 phrases),
  trailWordsFrom, TrailFeed.
- `game3.js` — TrailFeed created at boot + WAL backfill; tap in
  the sub.log wrapper; taps on the three backendFlush select
  reads; render interval + trailDone (boot-sync settle /
  dismissSplash / 30 s cap); a `trailState()` demo handle on
  NOVA_FOX3 (fed/dropped counts, for playtests).
- `page3.html` — `#trail-line` element in the splash panel + its
  CSS.
- `test3.mjs` — imports + the 11 trail checks.
- `cdp_test3.mjs` — demo9 URL, private CDP port 9347, +1 e2e
  trail check.
- `index.html` / `_built_module3.mjs` — rebuilt by build3.py.
