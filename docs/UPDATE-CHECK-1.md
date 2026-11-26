# Nova Fox — Update Check 1

**Date:** 2026-11-22, after Will's 21:51 CST live screenshot and 21:52 CST correction
**Build examined:** `demo3/index.html`, sha256 `646497e434c29fbcc26e8c8241e6baa8f733d1d82b7b47131c37b7f6cf7bc584`
**Sources:** `demo3/game3.js`, `demo3/world.js`, `backend/gateway.py`, `backend/fox-launch/patch-phext-tech.py`, `demo3/PLAN.md`

## Symptom 1 — Giant blue fox head at spawn

**Status: closed — confirmed monster appearance, not a defect.**

Will corrected the premise at 21:52 CST: the large blue fox-like head in the screenshot is simply what one of the game's monsters looks like. It is not a statue, player avatar, companion, or scale/placement defect.

**Fix applied:** none.
**Tests/rebuild/staging:** none; no Symptom 1 code was edited.

## Symptom 2 — “500 marks queued on this machine” / shared chart does not update

### Verdict

**Defect in queue retention and flush capacity — not a display bug, and not an unwired backend.**

The HUD number is computed from the real retained outbox. However, **500 is also the hard cap**. Once the cap is reached, the client silently deletes the oldest queued marks to make room for new ones. Therefore “500 marks queued” means “500 marks are currently retained”; it does **not** mean only 500 were ever produced, and some older marks may already have been permanently dropped before login.

The login-to-SQ path is wired in the shipped client, nginx patch, gateway, and SQ contract. In Will's screenshot it had not activated because the browser had **no game token**: the label shown is exactly the client's online-but-not-logged-in branch. There is also a second, independent problem: even after login, the gateway's insert rate limit cannot accept a 500-mark backlog in one flush. It will stop the client after 120 accepted inserts in a minute, so a full backlog can only drain in batches if the page remains open long enough.

### (a) Is 500 a real count, a cap, or a display bug?

**It is both the current retained count and the cap. It is not a hardcoded display value.**

Evidence:

- `world.js:314-316` appends every inscription segment to the in-session WAL with a sequence number.
- `game3.js:465` loads the persistent outbox from `localStorage` key `nova-phox-outbox`.
- `game3.js:471-478` wraps `Subspace.log`: every WAL segment is copied into `outbox`, then:

  ```js
  if (outbox.length > 500) outbox.splice(0, outbox.length - 500);
  LS.set("nova-phox-outbox", outbox);
  ```

  That is a FIFO cap of 500. The elements removed by `splice` are the oldest marks, and there is no counter or HUD warning for how many were discarded.
- `game3.js:555-568` builds the HUD text directly from `outbox.length`. The screenshot's exact sentence comes from `game3.js:565-567`, the branch used when the backend is online but `gameToken()` is absent:

  ```js
  `the chart-line is open — log in to save your marks to it · ${queued} on this machine`
  ```

- The shipped `demo3/index.html` contains the same `nova-phox-outbox` and `outbox.length > 500` code, so this is not source/build drift.

**Consequence:** the board copy at `game3.js:2137`, “your marks are queued, not lost,” is not true once the queue reaches the cap. At Will's displayed 500, the retained queue is full; any earlier overflow has already been lost locally and cannot later be flushed.

Routine play can fill the queue without 500 deliberate “marks” in the everyday sense: the wrapper queues every WAL inscription, including world/scroll openings and game events, not only manual saves.

### (b) What happens on login, and is the path wired end to end?

**The path is wired, but Will's screenshot shows it had not been entered.**

The shipped flow is:

1. **No token in the screenshot.** `updateSyncLabel` chooses the “log in to save your marks” text only when `BACKEND.online` is true and `gameToken()` is false (`game3.js:555-568`). “Chart-line is open” also means the version probe succeeded; this was not a backend-offline state.
2. **Start the hand-off.** The save/login button at `game3.js:2426-2430` sends the browser to `loginUrl()`. `game3.js:460-463` defines that as `https://phext.tech/api/game-login?back=https://fox.phext.io/`.
3. **Reach the gateway.** `backend/fox-launch/patch-phext-tech.py:32-48` proxies both `/api/v2/` and `/api/game-login` on phext.tech to the gateway at `127.0.0.1:18942`.
4. **Exchange the phext.tech session for a game token.** `gateway.py:306-320` asks phext-edit's session endpoint who is signed in. If signed in, it mints the 30-day HMAC game token and redirects back to fox.phext.io with `#np_token=…`; if signed out, it redirects through phext.tech sign-in with a return path.
5. **Store the token.** On return, `game3.js:449-459` extracts `np_token` from the URL fragment, stores it as `nova-phox-token` in localStorage, and scrubs the fragment from the address bar.
6. **Probe and flush automatically.** At boot, `game3.js:2570-2572` runs `backendProbe()` then `backendFlush()`, and repeats that pair every 20 seconds. `backendProbe` (`game3.js:481-492`) checks `GET https://phext.tech/api/v2/version`.
7. **Send each retained mark to SQ.** With a token, `backendFlush` (`game3.js:494-519`) loops oldest-first and sends one HTTP POST per mark to:

   ```text
   POST https://phext.tech/api/v2/insert?p=nova-phox-world&c=1.1.1/1.1.1/1.1.1
   Authorization: Bearer <game token>
   ```

   The shared phext and log coordinate are defined at `game3.js:431-437`. Only after a successful response does the client `shift()` that mark off the outbox and persist the shortened queue (`game3.js:517-519`). A 401 clears the stored token and stops; any other failure stops without discarding the current mark.
8. **Gateway-to-SQ leg.** `gateway.py:277-304` restricts inserts to `nova-phox-world` and a valid coordinate, verifies the game token, then forwards the body to SQ using the server-side SQ key and ensures the line ends with a newline. Thus accepted client inserts are appends to the `nova-phox-world` log scroll, not merely browser-local state.
9. **Standing/board follow-up.** After the log flush, `game3.js:520-553` posts a changed score to board coordinate `1.1.1/1.1.2/1.1.1` and reads the board back.

#### Flush blocker: rate-limit mismatch

The gateway allows only **120 inserts per minute** (`gateway.py:171-185`). Its POST handler checks that limit before forwarding to SQ (`gateway.py:285-289`) and returns HTTP 429 when exceeded. The client treats any non-OK response as a stop condition and marks the backend offline for the remainder of that cycle (`game3.js:508-516`).

For a 500-mark backlog:

- at most 120 marks can be accepted in the first minute;
- the 121st receives 429 and stops that flush with about 380 retained marks still queued;
- the 20-second retry can probe “online” again, but inserts remain 429 until enough timestamps leave the gateway's trailing 60-second window;
- the queue can therefore drain only in batches over several minutes, and only while the game page remains open or is visited again later.

There is an additional topology mismatch: the gateway keys the limiter with `self.client_address[0]` (`gateway.py:285`), while the nginx patch sends requests onward from the same host and supplies the real client in `X-Forwarded-For` (`patch-phext-tech.py:32-39`). The gateway never reads that header. Behind nginx, the gateway sees its immediate local proxy peer, so the intended per-player limit is effectively a **shared 120-insert/minute budget for the gateway**, not 120 per player.

**Bottom line for (b):** login is required and the complete client → phext.tech nginx → gateway → SQ path exists. But a capped 500-mark backlog cannot be flushed promptly or in one pass under the current one-POST-per-mark client and 120/minute gateway limit. The path is wired; its backlog capacity is defective.

Also note: being signed in to phext.tech in the browser is not by itself sufficient. The browser must complete the game's `/api/game-login` hand-off so fox.phext.io receives and stores the game-scoped token. Will's screenshot proves that token was absent in that browser at that moment.

### (c) Do queued marks persist across reload?

**Yes — the retained queue persists across reload in the same browser/origin, unless browser storage is cleared or unavailable.**

Evidence:

- The outbox is loaded from localStorage at startup (`game3.js:465`).
- It is re-saved after **every** appended inscription (`game3.js:471-478`).
- During a flush, it is re-saved after **every successfully accepted** mark is removed (`game3.js:517-519`), so a reload mid-flush preserves the unaccepted remainder.
- The local-copy save format also includes the outbox (`game3.js:2178-2184`), and loading such a copy restores it to localStorage (`game3.js:2190-2208`).

Boundaries:

- Persistence is per browser profile and per origin (fox.phext.io); it does not automatically follow the player to another browser/device.
- Clearing site data removes it.
- The storage helper catches localStorage failures, including private-mode/quota failures, and continues silently (`game3.js:401-419`), so persistence is not guaranteed where localStorage writes fail.
- Persistence applies only to the **retained latest 500**; marks already evicted by the cap are not recoverable from the queue or from a later local save.

## Why this matches Will's “doesn't seem to be getting updates at all”

The game build itself was current, and the screenshot's “chart-line is open” shows the read/probe side was reachable. But the shared chart could not receive Will's marks in that session because there was no game token. His accumulated local queue had also reached its 500-mark ceiling, which means the local backlog was saturated and older inscriptions were already being discarded. Even after a successful game-login hand-off, the present rate limit prevents that full backlog from landing at once.

## Fix applied

**None in this pass.** The revised instruction was to diagnose Symptom 2 and not edit for the corrected Symptom 1. No source files were changed, so no unit/e2e run, rebuild, staging, or new sha was produced.

## Recommended next fix (not applied)

1. Remove or raise the silent 500 FIFO loss, or replace it with an explicit overflow record/counter so the HUD never says “not lost” after discarding marks.
2. Make backlog flushing compatible with the gateway limit: batch multiple inscriptions per insert, raise the authenticated backlog limit, or make the client handle 429 as a timed retry without flipping the backend state to offline.
3. Key the gateway limiter using the forwarded client address only as supplied by the trusted local nginx proxy, rather than the proxy's own peer address.
4. Show separate counts for retained, flushed, and discarded marks so the queue state is auditable.
