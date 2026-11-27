# Nova Fox — demo v3

A playable slice built from Will's feedback on v2 (2026-11-22 17:46
CST, ten items, all addressed below) plus two rulings that arrived
during the build: a **global leaderboard**, and **phext.tech as the
backend for world state**. v2 lives untouched in `../demo2/`;
everything here is new in `demo3/`.

**Play it:** open `index.html` in a browser (double-click works — it
is a single self-contained file, **3,419,173 bytes**, no server, no
network required). The size is v2's 1.37 MB plus Emise's recorded
narration (27 MP3s, ~1.5 MB of audio, ~2 MB embedded base64).
Click the world to take the helm. Emise guides the first minutes —
in her recorded voice now, with the text panel riding along.

**Prime directive (Will, 2026-11-22):** above all else, this thing
has to be fun to play and result in +1 phext XP for the gamer. The
guide still forces the two first-session experiences, in order:
(1) play a chord, get taken somewhere; (2) make one mark that stays
while the world shifts. The veil holds: no in-game text names the
substrate; "phext.tech" appears only on a credits line in the help
text, as a brand.

## The ten feedback items — what changed

1. **Too confusing → staged, one system at a time.** The guide now
   runs eleven short beats, each teaching exactly one verb with one
   objective line: wake → rifts → move → **fight** → numbers →
   bridge → ashfall → gravity → **gesture** → quest → done. The
   demo readout (machinery panel) is hidden by default (L opens it).
   Nothing new is introduced while another system is still new.
2. **Not clear how to fight → a taught fight, and a visible blow.**
   A new guide beat before any danger: a pale **training wisp** in
   the spawn meadow (it cannot hurt you, never hunts, waits in the
   light) that the guide sends you to strike twice. The strike now
   has a swept arc rendered in the view, a hit flash, a damage popup
   ("−1 · it holds" / "struck out"), distinct hit/kill sounds, and
   the recorded beats BEAT-strike-hold / BEAT-strike-kill.
3. **Audio narration → recorded and wired.** All 27 beats from
   `NARRATION.md` (Aria, 120%, recorded 2026-11-22; manifest in
   `../narration-audio/MANIFEST.md`) are embedded in the file and
   played by beat ID: guide steps speak N-01…N-09 as they open;
   events speak their BEAT-* lines (crossings, flips, contact,
   strikes, the quest, death). Text panels always accompany, so a
   beat that cannot play loses nothing. The two v3-only guide beats
   (fight, gesture) have **no recorded lines yet** — they are
   text-only, flagged here rather than silently voiced by anyone
   else. **Carried flag from the recording pass:** the chord
   notation "1 · 4 · 9" (N-05/N-06) and spelled-out key names
   (W A S D in N-03; G/F/M in N-06…N-09) were synthesized verbatim
   and are **not ear-verified**. Duration check run at build time:
   all 27 files sit at a uniform ~8,002 bytes/second of stated
   duration (MP3 bitrate), with no duration outliers against their
   script lengths — no anomaly found, but ears have not confirmed
   pronunciation.
4. **Invulnerability for the starting area and the first jump.**
   Arrival's ward: no damage within 14 blocks of any realm's
   Arrival point, and no damage at all until your first jump has
   landed. The HUD states the ward while it holds ("🛡 warded —
   until your first jump lands" / "🛡 Arrival's ward"). The
   training wisp sits inside the ward; the first real danger is
   met only after both halves lift.
5. **Mouse gesture teleport → a second instrument.** Hold the
   **right mouse button** and draw: a **triangle** plays the bridge
   tune (cross / cross home), a **circle** carries you home to
   Arrival from anywhere, a **diamond** opens a far page (a chord
   drawn deterministically from the stroke itself). The guide
   teaches it after gravity. Classification is closedness + corner
   count on the normalized path, deliberately coarse. The chord
   keys still work — this is an addition, not a replacement.
6. **Subspace as accelerator, not switch → growth ramps.** Derived
   features no longer pop: every Life cell carries a **growth
   level** that leans ~7% per physics tick toward what local
   density and neighbor pressure would support (targets recalibrated
   to what Life actually sustains: density (d−3)/4, pressure ≥0.45).
   Generation reads the level — bloom at >0.25, crystal spines at
   >0.45 growing 1→3 blocks as the level matures — so features
   creep in over ~30+ ticks (≈20 s) and ebb the same way. Monsters
   **fade** through their glimpse cycle (opacity ramps) instead of
   blinking. Inscriptions remain the opposite — instant and
   permanent — because that distinction *is* the physics (Law 8).
7. **Space Lego aesthetics.** The texture atlas is rebuilt as
   bricks: clean plastic colors (bright green, red, azure, safety
   orange), a molded rim on every tile so each block reads as its
   own brick, and four studs on top faces. Monsters are brick-built
   too (block body, studs, brick legs). Same voxel/chunk machinery
   underneath; the visual language is what changed.
8. **Monster introductions → featured, anime-style.** The first
   time each kind shows itself within 30 blocks: the light dims
   around it (spotlight), a name card sweeps in — **THE TRAINING
   WISP** ("pale, patient, harmless"), **THE GLIMMER** ("a thing
   that lives between glimpses"), **THE KEEPER OF THE DEEP ROOM**
   — and the thing is *presented, not hunting*: monsters hold
   during the card and cannot harm you until a second after it
   clears. Once per kind, remembered across sessions.
9. **Weapons and powerups.** **The Star Lance** (a real weapon:
   range 7.5 vs the bare strike's 4.4, damage 2 vs 1, wider sweep)
   gleams in Nova Prime's spawn scroll, placed so the fight beat
   sends you past it. Three charms, one per first-session place:
   **Swift** (Ashfall Arrival; +35% stride), **Ward** (the barrow
   hall; turns one blow aside), **Bright** (Nova Prime meadow;
   glimpses stretch — phase-1 things show as faint shapes, so the
   dark gives up its shapes sooner). Pickups are inscribed.
10. **Granular deformation → the chisel.** Aim at a block and press
    **C**: each stroke shapes it down a level (the mesh draws it
    shrunk toward its center — visible, granular, sub-block); the
    third stroke breaks it through, and the break is an inscription
    (an AIR override the generator honors forever). Bedrock and the
    Deep Stone refuse the chisel. Shape levels live in the world
    truth (world.js), not the view.

## The leaderboard (Will, 2026-11-22 17:47)

**Scoring rule — one arithmetic, stated once, applied everywhere**
(world.js `SCORE_WEIGHTS`; the board counts only what the
inscription log can prove):

| inscription | points |
|---|---|
| cross (a realm crossing) | 100 |
| tune to a pocket page (distinct pages) | 25 |
| scar (a thing struck out) | 50 |
| pickup (weapon or charm taken) | 40 |
| break (a block shaped through) | 10 |
| daily pocket reached | 300 |
| quest (the Deep Stone reached) | 500 |
| grant (the hat, written down) | 250 |

- **UI:** press **B** (or the board button) — two views: **All time**
  and **Today's page**. Your own row is always shown, marked "(you)".
- **Daily board:** DESIGN.md's daily cycle — one pocket per day,
  date-seeded (phorge-style), same chord and page for everyone
  (`dailyPocket(date)` in world.js). Playing today's chord from the
  home meadow goes to today's page; standing there claims the feat
  (300 pts, once, inscribed). The daily board ranks claimants.
- **Local persistence:** your standings (best score, daily results)
  persist in `localStorage` alongside the inscription outbox — your
  record is itself kept as inscriptions queued for the shared chart.
- **No fabricated players:** global rows are only ever rows actually
  read back from the shared chart. When none have been read, the
  board says "no other foxes on the chart yet." There are no seed
  or demo entries.

## The backend: phext.tech + fox.phext.io (Will, 2026-11-22 17:48; built 18:05–18:40)

**The ruling (Will, 2026-11-22 18:05):** "require login to save
your game, or allow the user to save a copy locally — update
phext.tech to ensure nova phox has access from fox.phext.io."
fox.phext.io DNS was added by Will the same evening (verified
from awsbox: fox.phext.io → 44.248.235.76).

**As built — the surface (awsbox, wbic16 user services, LIVE):**

- `nova-phox-sq.service` — SQ v0.6.0 hosting the phext
  `nova-phox-world` (data: `~/nova-phox/data/` on awsbox), keyed,
  on port 18941 (SQ binds 0.0.0.0; the key is the gate).
- `nova-phox-api.service` — a small gateway (stdlib Python,
  source `../backend/gateway.py`) bound to **127.0.0.1:18942
  only**. It exposes exactly the SQ REST contract the client
  speaks, restricted to `nova-phox-world`, and adds the auth
  rule below. nginx proxies `https://phext.tech/api/v2/` and
  `https://phext.tech/api/game-login` to it (vhost patch staged
  in `~/fox-phext-launch/install.sh` — see "Staged" below).
- Reads are **public**: `GET /api/v2/version` (the client's
  capability probe), `/api/v2/toc`, `/api/v2/select`.
- Writes **require login**: `POST /api/v2/insert` demands a game
  token (`Authorization: Bearer npt1.…`), an HMAC-signed token
  (30-day) the gateway mints only after checking the caller's
  phext.tech session — `GET https://phext.tech/api/game-login
  ?back=https://fox.phext.io/` forwards the browser's cookies to
  phext-edit's own `/api/session`; signed in → 302 back to the
  game with `#np_token=…` (the client stores it and scrubs the
  fragment); signed out → 302 to phext.tech's sign-in with
  `?next=` returning here. No parallel account system: the token
  *is* phext.tech's sign-in, carried. CORS admits exactly
  `Origin: https://fox.phext.io`, Bearer only (no credentials).

**Contract (what the client speaks):**

- `GET  /api/v2/version` — capability probe.
- `POST /api/v2/insert?p=nova-phox-world&c=1.1.1/1.1.1/1.1.1` —
  append one inscription segment (`#seq op @ where — detail [by]`).
- `POST /api/v2/insert?p=nova-phox-world&c=1.1.1/1.1.2/1.1.1` —
  append a standing line (`name|score|date|daily|ts`).
- `GET  /api/v2/select?p=nova-phox-world&c=1.1.1/1.1.2/1.1.1` —
  read the board scroll.

**The save policy (Will's two doors, in the board panel):**
(a) **Log in to save your game** — the button rides the
game-login hand-off above; with a token, the outbox flushes to
the shared chart and standings post. (b) **Save a copy locally**
— downloads a `nova-phox-save` JSON (name, standings, outbox,
posted record) and can load one back; the localStorage game
persists either way. A logged-out player is never blocked from
playing or from the local save; without a token the outbox
simply stays queued and the HUD says so. Scope, stated plainly:
`world.js` state is not wal-replayable (its log is append-only;
overrides/claims/hat/quest state are applied by action methods),
so the local copy carries identity + standings + queue exactly
and does **not** resurrect a session's world edits — full
run-restore is a v4 item.

**Verified (2026-11-22 evening):** on awsbox — health, version,
toc, select, a real token insert + select read-back on the log
scroll, 401 without/with a bad token, game-login 302s (signed
out; forged cookie), open-redirect guard, CORS preflight. From a
**real browser at origin https://fox.phext.io** (local mirror of
the identical gateway+SQ; transport intercepted at the CDP Fetch
domain because Chrome's Local Network Access checks forbid a
public name resolving to a local address — the one leg production
nginx provides): 16/16 — probe online, write refused without a
token and absent from the shared log, token flush lands the
mark, standing posts and reads back on the board, token intake
from `#np_token=` + fragment scrub, zero console errors. The
real **board** scroll was deliberately not test-written on
awsbox (append-only: a fake standing would pollute it forever);
the board insert is the identical handler, proven in the
mirror. One leg is verified by construction only: phext.tech's
post-login `?next=` return — no live login was performed
(creating accounts is out of bounds for this work).

**Staged for Will (the only root step):** `~/fox-phext-launch/
install.sh` on awsbox — installs the fox.phext.io webroot +
game, bootstrap vhost → certbot → HTTPS vhost, and the
phext.tech vhost patch above (backup-first, marker-idempotent —
pre-validated against a copy of the live vhost; `nginx -t`
gated with rollback), then smoke-checks all of it. Until it
runs, phext.tech/api/v2 still answers 404 from the internet and
fox.phext.io has no vhost; the backend itself is live on the
box behind those two nginx doors.

**Cache/sync model (the offline rule, non-negotiable):** the game
boots and plays from `file://` with the backend unreachable —
proven by the e2e, which runs entirely from `file://`. World state
lives locally first; **every inscription joins a persistent outbox
(`localStorage`) the moment it is written**; a 20-second cycle
re-probes and flushes the outbox oldest-first, stopping at the
first refusal and saying so. Standings post when the score moves;
the board re-reads after each flush. The HUD carries the state
plainly at all times ("the chart-line is quiet — playing from your
own chart · N marks queued"). This matches the physics: derived
detail may drift; inscriptions persist — queued locally, they land
when the backend returns.

**Conflict handling:** the shared scrolls are **append-only**, and
appends commute — two foxes inscribing simultaneously cannot
overwrite each other; shared order is arrival order, and each
segment carries its author and local sequence. Standings are
read-merged by taking each name's highest posted score. Nothing
is ever deleted from the shared chart.

**What remains to light the global layer up:** run
`~/fox-phext-launch/install.sh` on awsbox (Will, sudo) — the
backend and client are done and verified; only the two nginx
doors (fox vhost + phext.tech API locations) wait on that one
command.

## Controls

| Input | Effect |
|---|---|
| Click the world | take the helm (pointer lock + sound wakes) |
| Mouse | look · **hold right button + draw** triangle / circle / diamond |
| W A S D / arrows | walk (←/→ turn) · Shift runs |
| Space | jump |
| 1–9 0 − · Q W E R T Y U I O P [ | the eleven notes — three together travel |
| G | turn down itself |
| Click / F | strike (the Lance, once taken, reaches farther and lands harder) |
| C / X | chisel — shape the aimed block down by degrees |
| B | the board of foxes |
| M / Tab | the chart of realms |
| L | the written record (readout; hidden by default in v3) |
| Esc | release the mouse |

One overlap, carried from v2: **W is both walk and note 2** (a quick
tap under ~200 ms sounds it; the number row always plays cleanly).

## Playtest record (honest)

Run 2026-11-22, this machine (headless Chrome, SwiftShader software
rendering, throttled shared CPU — ~4 fps in the harness; a property
of the test rig, not a frame-rate claim about real hardware).

- **Node unit tests — `test3.mjs`: 78 passed, 0 failed.** Everything
  v2 proved (WASM ≡ JS kernels, generation determinism, dungeon
  contents, coupled Life, neighbor-caused edge birth, chord mapping,
  gravity → vault + inscription, press-in logging, strike → scar in
  regenerated ground, guardian's three strikes, quest + hat once,
  escalation) **plus the v3 laws**: a fresh world grows NO crystal
  (nothing pops); still-life pressure along a seam ramps growth
  >0.4 over 80 ticks while the unpressured world stays <0.3; grown
  crystal then appears along the seam only; growth is deterministic
  (ticked-alike worlds generate alike); the wisp waits, is always
  visible, holds one strike and falls to the second; items are
  placed per home scroll and taken exactly once, inscribed; the
  chisel shapes levels 1→2 as world truth, breaks on the third into
  an AIR inscription that regeneration honors, and refuses bedrock;
  scoring is the log's arithmetic (pickup 40, scar 50, quest+grant
  750, daily 300, fresh world 0); the daily pocket is deterministic
  with a valid 3-note chord and claims exactly once.
- **Headless-Chrome e2e — `cdp_test3.mjs`: 48 passed, 0 failed,
  zero console errors.** Real key and mouse events through the
  page's own handlers, along the scripted fresh-player path: boot
  (WASM live, ward up and labeled, all 27 narration beats embedded
  and ready, chart-line state labeled, score in HUD) → guide
  buttons → walk + jump (first jump lands, ward's second half
  lifts) → **fight beat: the wisp is featured (intro card fired),
  F strikes it twice — holds, then written out with a scar in the
  log** → the Star Lance taken (inscribed) → one number → bridge
  tune by number keys → Ashfall → Swift Charm taken → same tune
  home → G (falls up, lands on the vault) → G back → **gesture
  beat: a right-mouse triangle drawn with real mouse events crosses
  to Ashfall**; keys cross home → **C chisels the ground (a level
  in the world truth)** → a surface monster's contact drops HP and
  the HUD number with it, its kind already featured → the Deep
  Stone completes the quest, the hat is granted and inscribed →
  **B opens the board: your row present, the shared chart's status
  stated plainly, score ≥1000 by the stated arithmetic** → the
  guide retires. **Kernel in the shipped page: WASM live.**
- **Bugs found by the playtests and fixed during the build:**
  (1) the daily-chord derivation used signed shifts and produced
  notes outside 1–11 → unsigned throughout, unit-asserted;
  (2) a full Life grid dies in one step and a plain edge line
  erodes — the growth test's pressure source is now still-life
  blocks, and the growth targets were recalibrated to densities
  Life actually sustains (the v2 instant thresholds were
  unreachable gradually — a real physics bug the tests caught);
  (3) the gesture classifier starved on sparse mouse samples and
  miscounted a triangle's corners (the closing segment is a corner
  too) → first point seeded at press, minimum sample lowered,
  closing segment counted with a refractory;
  (4) the board/realms toggles misread their initial CSS-hidden
  state and could never open on the first keypress → fixed;
  (5) `localStorage` was read unguarded at boot (some browsers
  throw on `file://`) → guarded.
- **XP check (prime directive): did the scripted fresh-player path
  force both experiences? YES — with evidence.**
  1. *Movement is addressing:* the guide cannot be completed
     without playing a chord of three numbers and being carried
     somewhere — the 'bridge' beat completes only when the realm
     actually becomes Ashfall Haven, the 'ashfall' beat only when
     the same tune carries the player home — and v3 adds a second
     forcing: the 'gesture' beat completes only when a *drawn*
     triangle crosses the realm again. E2E asserts all crossings,
     by keys and by mouse, in order.
  2. *Written outlasts shown:* the fight beat now forces the mark
     earlier and explicitly — the wisp must be **struck out**
     (scar asserted in the log) before the guide will teach the
     numbers at all; the path still ends at the Deep Stone, where
     the prize is an *inscription* (grant segment + hat asserted).
     Chisel breaks and item pickups add two more inscribed marks
     along the way, both asserted in the e2e.
- **Backend honesty check:** the e2e runs from `file://`; the
  probe's outcome (404 → quiet) is the state the HUD and board
  showed, and no global rows were presented. The sync *success*
  path is verified separately — against the live awsbox backend
  from the box, and from a real browser at the fox origin
  against an identical local gateway+SQ mirror (16/16; see the
  backend section). It becomes internet-visible when
  `~/fox-phext-launch/install.sh` runs on awsbox.

### NOT verified

- **Human feel** — movement, bob/weave, strike timing, gesture
  drawing with a real hand, and mouse look under real pointer lock
  on a real display. The e2e drives keys and synthetic mouse paths,
  not a hand. **This is the standing risk: automated green is not a
  fun verdict.** v2's human verdict was "too confusing"; v3's
  staging is the answer on paper, and only Will's hands confirm it.
- **Narration pronunciation** — beats play by ID and are embedded
  and ready (asserted), but audibility/mix on real speakers and
  the ear-verification of "1 · 4 · 9" and the spelled key names
  (N-03, N-05, N-06) remain open, as flagged by the recording pass.
- **Physical-GPU performance** — all rendering evidence is
  SwiftShader under a throttled shared CPU.
- **Gesture circle and diamond by drawn events** — the triangle is
  e2e-verified end-to-end; circle/diamond share the classifier
  (unit-inspected thresholds) but were not drawn in the browser
  path.
- **The shaft descent on foot** — as in v2: dungeon geometry is
  unit-verified; the e2e enters the deep room via the debug handle.
  The guardian fight in-browser is untested (guardian strikes and
  its intro are unit-/mechanism-verified).
- **Backend sync success path** — verified against the live
  backend (box-side) and from a browser origin (mirror), per the
  backend section. Not yet verified *over the public internet*:
  that needs the staged install (fox vhost + phext.tech API
  locations) and, for the full login leg, a real phext.tech
  sign-in, which this work did not perform.
- **Long sessions** — chunk-store churn, growth-map growth, and
  memory over hours of wandering are unmeasured.

## Simplifications (named plainly)

Carried from v2, still true unless noted:

- **Monster visibility:** v2's 3-phase glimpse is now a fade
  through that cycle (Bright Charm stretches it) — still not the
  design's full 8-axis slice agreement.
- **Two realms are open; nine are names.** Unchanged.
- **The dungeon is one generated pocket** at a fixed footprint —
  authored constants, not a procedural dungeon system. Unchanged.
- **Gravity is per-scroll**, flipped for the scroll you stand in.
  Unchanged.
- **Pocket addresses are a hash of the chord**; only the bridge
  tune and the daily tune are curated. Unchanged.
- **The inscription log is in-memory for the session** — but v3
  adds the persistent local outbox and standings (localStorage):
  marks now survive a page reload *on this machine* and queue for
  the shared chart. The durable shared world exists now (the
  nova-phox backend, above); a session's *world edits* are still
  session-scoped — the local save carries standings/queue, not a
  world snapshot (v4 item, named in the backend section).
- **Escalation** (monster speed doubles when the living world
  doubles) is implemented and unit-tested, rarely felt in a short
  session. Unchanged.
- **No fall damage.** The swing has an arc visual now; there is
  still no full melee animation rig.
- **New in v3:** one weapon (the Lance) and three charms — a
  first-session set, not an arsenal; the chisel shapes in 3 levels
  on whole-block positions (true sub-block *placement* is not in
  this slice); gestures are 3 shapes; monster intros are once per
  kind, not per individual; the daily pocket is a scroll target,
  not a generated bespoke pocket.

## Files

- `index.html` — the game. Single self-contained file (3,419,173
  bytes; narration embedded), opens from `file://`.
- `world.js` — subspace + generator + growth + items + chisel +
  scoring/daily math (the world truth; no DOM, no Three).
- `game3.js` — the view: Three.js client, input (keys + gestures),
  HUD, guide, narration playback, backend client, board.
- `page3.html` + `build3.py` — the shell and the assembler
  (`python3 build3.py` → `index.html` + `_built_module3.mjs`;
  build3 also embeds `../narration-audio/*.mp3` by beat ID).
- `test3.mjs` — Node unit tests (`node test3.mjs`).
- `cdp_test3.mjs` — headless-Chrome e2e (`node cdp_test3.mjs`).
- `NARRATION.md` — Emise's narration script, by beat ID (unchanged
  from v2; the audio in `../narration-audio/` was recorded from it).
- `core.rs`, `nova_core.wasm`, `nova_core_b64.js`, `assets/` —
  the WASM core and vendored Three.js, carried from v1 unchanged.
