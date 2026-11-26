# Nova Fox launch blocker #2 — phext.tech /api/v2 backend: diagnosis & verification

**Stamped EE 948 (2026-11-26).** Scope: diagnose why phext.tech
`/api/v2/*` was recorded as 404 (so the shared chart — leaderboard
claims, gift ledgers, shared-world marks — queued locally and never
synced), fix what is fixable without Will's interactive awsbox sudo,
and verify end-to-end.

## Verdict

**The backend is live and has been since 2026-11-23. Blocker #2 is a
stale record, not a live fault.** No fix was needed and no production
change was made: no service restarted, no webroot touched, no DNS
changed. The full client call path (public reads, token-gated
insert, read-back) was verified end-to-end today, EE 948.

## Root cause of the original 404

- phext.tech's front app (phext-edit, nginx `location /`) has no
  `/api/v2` routes of its own — any `/api/v2/*` request that reaches
  it 404s. That was the state **verified on 2026-11-22** and written
  into the game client's comments (`demo4/game3.js`, the BACKEND
  block) and later repeated in ECONOMY-BUILD-REPORT.md's named-block
  section without re-verification.
- The intended server was never SQ on the ranch or the standing
  port-18999 host: it is a dedicated stack on **awsbox** (the
  production contact box), built for this game —
  `~/workspace/nova-fox/backend/gateway.py` (the nova-phox gateway:
  public reads, login-token writes, 120 inserts/min/IP) in front of
  a dedicated SQ host holding the single phext `nova-phox-world`,
  wired into phext.tech by two nginx proxy locations
  (`/api/v2/` and `= /api/game-login` → 127.0.0.1:18942).
- That stack was deployed the evening of 2026-11-22 (CST) — after
  the 404 verification was recorded. Evidence on awsbox:
  - user services `nova-phox-sq.service` (SQ on 127.0.0.1:18941,
    data `~/nova-phox/data/nova-phox-world.phext`) and
    `nova-phox-api.service` (gateway on 127.0.0.1:18942), both
    `active (running)` continuously since **2026-11-23 00:13 UTC**;
  - `/etc/nginx/sites-available/phext.tech` contains both
    `proxy_pass http://127.0.0.1:18942;` blocks (lines 77, 86), and
    the pre-patch backup `phext.tech.bak-nova-phox-20261123005446`
    dates the wiring to **2026-11-23 00:54 UTC**.
- So the 404 was real for roughly a day (2026-11-22, before the
  wiring), and every later statement of it — including today's
  launch-blocker list — inherited the stale verification.

## Verification (EE 948, all against the public https://phext.tech route)

- `GET /api/v2/version` → **200**, body `0.6.0`.
- `GET /api/v2/health` → **200**, `{"ok": true, "service":
  "nova-phox-gateway", "phext": "nova-phox-world", "sq": true}`.
- `GET /api/v2/toc?p=nova-phox-world` → **200**; the chart's
  inscription-log scroll `1.1.1/1.1.1/1.1.1` carries the 2026-11-23
  deployment round-trip line.
- `GET /api/v2/select` → **200** for the board scroll
  (`1.1.1/1.1.2/1.1.1`), the purchase-record scroll
  (`1.1.1/1.1.3/1.1.1`), and the economy-ledger scroll
  (`1.1.1/1.1.4/1.1.1`) — all currently empty, as expected before
  launch.
- `POST /api/v2/insert` with no token → **401** `login required to
  save to the shared chart` (the login rule is enforced).
- CORS preflight from `Origin: https://fox.phext.io` → **204** with
  `Access-Control-Allow-Origin: https://fox.phext.io`, methods
  GET/POST/OPTIONS, headers Authorization/Content-Type.
- `GET /api/game-login?back=https://fox.phext.io/` signed out →
  **302** (hand-off to phext.tech sign-in, as designed).
- **Authenticated round-trip on the leaderboard coordinate**
  (`1.1.1/1.1.3/1.1.1`), run on awsbox with a gateway token minted
  in-memory from the on-box secret (never printed or copied off the
  box): prior select 200 / 0 bytes → insert **200** → select 200 /
  57 bytes with the test line present → scroll restored to its
  prior content via the local SQ update endpoint (200) → final
  select 200 / 0 bytes, identical to prior. **PASS.**

## Test residue

- The purchase-record scroll itself: **none** — restored to its
  exact prior content (empty) and re-verified.
- One log line remains in the gateway's journal on awsbox
  (`insert 1.1.1/1.1.3/1.1.1 by emise-backend-verify`), which is
  where it belongs; the verify script was deleted from awsbox,
  the hub, and this VM.

## What this does NOT close (named, for Will / follow-ups)

1. **The stale record in the client.** demo4's `game3.js` comment
   still says "/api/v2/* answers 404 today" (the 2026-11-22
   verification). It is comment-only — the client probes the
   backend at runtime and will find it online — but the comment
   should be corrected in the next build pass so the record stops
   regenerating this blocker.
2. **The real player login flow is unverified by this pass.** The
   signed-out 302 and token-minted writes are proven; a genuine
   phext.tech sign-in → game-login → token-in-fragment → in-game
   insert, in a real browser under a real session, has not been
   run (it needs Will's signed-in browser). This is the same
   "first real key" class of check as the Gumroad verification:
   the launch QC pass should run it once.
3. **demo4 is still not the live build** at fox.phext.io (separate
   blocker — staging + Will's sudo install). The backend being
   live means the economy build will sync the moment it is
   deployed; the currently hosted older build also speaks this
   same API for its marks/board path.
4. **Security note (no action taken):** the SQ key appears in the
   `nova-phox-sq.service` command line, so it is visible in the
   unit and process list on awsbox. It is loopback-only and the
   gateway never exposes it, but moving it into a key file (SQ
   supports one; the gateway already reads its own keys from
   0600 files) would match the estate's usual posture. Left for
   Will's word — changing it means a service restart, which was
   out of this pass's scope.
