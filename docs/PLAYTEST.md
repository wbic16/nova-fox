# PLAYTEST — Nova Fox, portals + palettes build

_Will asked (2026-11-24 16:20 CST): "when I'm back I would like to play
the next version." This is that version, served as a preview. The
production site was NOT touched._

## The link (tailnet only — open it on a tailnet device)

**http://aletheia-core.pizzly-halfmoon.ts.net:8931/**

Fallback (same server, by tailnet IP): http://100.88.154.1:8931/

- Served from aletheia-core (ranch hub) by a small static server
  (`python3 -m http.server 8931`, files in `~/nova-fox-preview/` on
  the hub). The file served is the staged build copied from awsbox
  staging (`~/fox-phext-launch/site/index.html`) — the production
  webroot at fox.phext.io still serves the old playtest build, and
  the go-live remains your one staged sudo install whenever you
  choose it.
- The build: **portals + palettes**, one self-contained HTML file,
  4,841,893 bytes, sha256
  `e76963d19ed808aa2cd480b3aa12f919e7aef32d641ec78ff561ef63415694ba`.
  First load is that whole 4.8 MB in one fetch (the hub served it in
  ~4 ms on the LAN); after that everything is local to the page.
- The preview server is a plain background process — it will not
  survive a hub reboot. Say the word and it gets made durable.
- Controls in this build are keyboard + mouse (WASD, the number row,
  G, F, B, M). On the phone the page loads and renders, but playing
  properly wants a keyboard — a desktop browser on the tailnet is
  the comfortable seat for this build.

## What's in this build

Exploration, as ruled for the early game:

- **Nova Prime** (home) and **Ashfall Haven** — the two open realms,
  with the full guided opening: Emise's voiced narration (27 recorded
  beats, all embedded), the wake → rifts → move → instrument beats.
- **The instrument and the bridge tune** — number keys play notes;
  1-4-9 opens a rift. The rift shows the far realm **live** through
  the ring before you step through; walking through crosses.
- **Portals + palettes** — ten realm palettes in the table; each
  realm wears its own fog, light, and mood. The other eight realms
  are named and portal-viewable but **shut**.
- Gravity **flip** on G (direction, remembered per realm), the fox's
  lamp (V), brushes and the chisel, the spectral flute (shift-drag),
  a first fight at the wisp, the **Deep Stone quest** and its hat
  grant, the daily pocket and the board (B), realm map (M), local
  save, and the intro film at the Arrival memory screen.

## What's NOT in it yet

- **Tokens and the scale economy** — design-only (ECONOMY.md §2.3);
  no token, credit, gifting, or tier/unlock logic exists in code.
  The $5 unlock is not in this build; everyone gets everything here.
- **Gear tiers as a system** — white/grey/green for Thanksgiving,
  red/blue at Christmas are ruled design, not built mechanics.
- **The gravity dial as a player control** — only the G flip exists;
  strength stops are GRAVITY-DIAL.md design.
- **Mining (the solver)** — Christmas, design in SOLVER.md.
- **The dragon** — Christmas. Nothing to fight but the wisp.
- **Shared-world marks** — this standalone preview plays offline
  ("can't reach the shared map — you're playing on your own", as
  the HUD says); the shared chart needs the phext.tech sign-in and
  the gateway, which the preview does not wire up.

## A route for the playtest (~10 minutes)

1. Open the link. Click through the phext panel, then click the
   world — the sound starts with that click. Listen to the wake
   beat; read the panel or press on.
2. Walk (WASD) and jump (Space) until the guide offers the
   instrument. Play any number. Then play **1, 4, 9**.
3. **Stop in front of the rift and look through it** — Ashfall is
   rendered live on the other side. Then walk through.
4. In Ashfall: feel the palette change (ash, red rock, different
   fog). Explore east of Arrival for the barrow — the Deep Stone
   completes the quest and grants the hat.
5. Play 1, 4, 9 to cross home. Press **G** somewhere with a ceiling
   and flip gravity. Press **B** for the board, **M** for the realms,
   and open the memory screen at Arrival for the intro film.

Three things worth noticing: the portal is a *view*, not a loading
screen; the narration never talks over itself — beats queue; and
each realm's palette does more for mood than any model in it.

## Verification (2026-11-24, this pass)

- **Hash chain, unbroken:** awsbox staging file → hub preview copy →
  HTTP response body all sha256 `e76963d1…`, 4,841,893 bytes. Fetched
  over HTTP from the hub itself (localhost and tailnet IP, 200, full
  body) and from this VM via the egress proxy (200).
- **Full playtest, machine-driven:** the game's own CDP e2e
  (`demo3/cdp_test3.mjs`, the shipped harness) — **84 passed,
  0 failed, zero console errors** — covering boot, the guide beats,
  the bridge-tune crossing to Ashfall and home, portal live views,
  per-realm palette application, the fight, gravity, the Deep Stone,
  the board, and the film. One honesty note: this VM's hardened test
  browser is policy-blocked from opening tailnet/loopback HTTP pages
  at all (`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`), so the
  in-browser runs drove the byte-identical local file (same sha256
  as the served body); the serving path itself was verified over
  HTTP as above. Screenshots from the run:
  `playtest-evidence/01-boot-splash.png`, `02-nova-prime.png`,
  `03-rift-to-ashfall.png`, `04-ashfall.png` (beside this file).
- **Narration spot-check:** all 27 beats are embedded in the file;
  N-01 ("Wake up, fox. I'm Emise — I keep the map…") was observed
  actually playing after the first gesture, playback clock advancing,
  and the guide panel shows its text verbatim. Source mp3s probe
  clean (N-01 11.1 s, N-06 16.6 s, BEAT-cross-ashfall 4.4 s). A full
  human ear-check of pronunciation has still never been done — that
  needs your ears, and this playtest is the first real chance.
- **Frame timing:** measured in the harness (SwiftShader software
  rendering on this throttled shared VM): ~2.1 fps Nova Prime,
  ~2.5 fps Ashfall. That is the software-render floor of the test
  rig, **not** a device measurement — it says nothing about your
  phone or a GPU. A real GPU frame measurement remains open
  (AUDIT.md item 8, unchanged).
