# Nova Fox — the Esc menu (demo13)

Built EE 955–EE 9xx, 2026-11-26 · Tree: `~/workspace/nova-fox/demo13/`
(fresh copy of demo5, seed verified before copying: demo5/index.html
sha256 `98207789e35e62b1b3399d60180b03fea223d9c488311332c60f1e4cf15a8f40` ✓)

**demo13/index.html sha256: `04e6143f5de6ccef379bc24a20b26fa34d0ae0e2e4a960b8013fea0d3a548817`** (4,963,688 bytes)
Not staged, not deployed. The NF_SHIP_EE token is untouched.

Will's spec (15:23 CST, extended 15:24 CST): a menu on Esc with
**Start a New Game · Open to LAN · Save the world to .phext · Merge
the local game to fox.phext.io · Key bindings · Video settings ·
Audio settings · Quit**. All eight rows are built.

## The menu itself

- Esc opens the menu; Esc (or the "back to the world" row) closes
  it. Sub-panels (bindings / video / audio) Esc back to the menu.
  A "menu (Esc)" ghost button in the bottom-right cluster opens it
  by mouse/touch, in the existing panel-button pattern — needed
  because while the pointer is locked, the browser spends Esc on
  leaving the lock and the page never sees it (true of every panel
  in this game, not just this one).
- Dress: the game's own — `.overlay.hudpanel` panels centered like
  the realms map, the board's headings and ghost/act buttons.
- **Pause behavior: the world does not pause.** No panel in this
  game pauses it — the board and the map open over a running world
  — so the menu follows the game's own behavior rather than
  inventing a pause the rest of the game doesn't have. While a
  menu panel is up, the keyboard works the menu instead of the fox
  (arrow keys move a selection, Enter works the row, Left/Right
  adjust settings) — a menu you cannot type through.
- Keyboard navigation throughout; every row and control is a real
  button/input, so mouse and touch work by the existing patterns.

## Start a New Game

- The row arms a confirmation row first (nothing is wiped by the
  row itself); only the confirm button acts, "Keep playing"
  disarms. **The confirm copy is placeholder** — plain and
  functional ("Start a new game? This erases your record, your
  purse, and every mark still waiting on this machine, and the
  world starts over. Your sign-in, key bindings, and settings
  stay.") — **flagged for Will's wording.**
- The reset is the game's own save model, cleared: exactly the
  keys a save copy carries — `nova-phox-name`, `nova-phox-standings`,
  `nova-phox-introduced`, `nova-phox-outbox`, `nova-phox-outbox-folded`,
  `nova-phox-outbox-dropped`, `nova-phox-posted`, `nova-phox-economy`,
  `nova-phox-eco-outbox` — then `location.reload()`, so the new
  game boots through the same door a brand-new player's does
  (fresh name, fresh purse, genesis subspace, guide at the wake
  beat). What stays is what a save copy never carried either: the
  phext.tech sign-in token, the control prefs, and the new
  bindings/settings stores — machine keepings, not game progress.

## Open to LAN — the machinery finding

**There is no LAN machinery in demo5. None.** No WebSocket, no
RTC, no socket, no peer code anywhere in game3.js, world.js,
economy.js, or page3.html (the only WebSocket in the tree is the
test harness talking to Chrome DevTools). D2 rules peer-to-peer
LAN multiplayer for the download build; that transport has not
been built yet in any form.

So the item is wired to a real state object (`LAN` in game3.js)
whose only truthful state today is *closed, and cannot open*: the
menu shows "closed" beside the row, choosing it answers plainly —
"this build has no LAN transport yet, so nothing was opened" —
and `lanState()` reports `{ open: false, available: false }`.
Nothing anywhere displays a false "open". When a transport lands,
`LAN.openToLan()` is the one place it plugs in.

## Save the world to .phext

Real phext serialization of the actual subspace, not a stub
format. `worldToPhext(sub, meta)` + `phextImplode(scrolls)` in
world.js implement the estate's own implode (the same state
machine as `~/workspace/phext/build_artifacts_phext.py`): 9
components, 1-indexed, scrolls in sorted coordinate order, the
nine level bytes library..scroll. **Verified byte-identical to
the Python implode** on a five-scroll multi-level case, and
unit-tested against a hand-computed byte sequence.

Contents: a home scroll (player, export time, score, counts, and
the coordinate map, documented in the scroll itself); the
inscription log entire (every WAL entry, quest/hat state, claimed
days); per realm with any state — a realm scroll, a marks scroll
(every override and chisel mark), a monsters-and-things scroll,
and one scroll per opened page carrying its full 32×32 living
grid (`#`/`.`). Download is the game's own Blob pattern
(`nova-fox-world-<date>.phext`); the menu reports the real scroll
count and byte size it wrote.

## Merge the local game to fox.phext.io

What a merge can mean here is what the shared chart at
phext.tech actually holds, and that part is **real and wired**:
the inscription queues (marks), the standing, and the economy
ledger — all append-only, all already carried by `backendFlush`,
the same machinery the game's 20-second cycle runs. The menu row
runs it on demand and reports the observed numbers (entries
merged / still waiting), never more than it saw.

Judgement on the confirm gate: **merge has none, because it can
overwrite nothing** — the chart is append-only on both ends. Its
one gate is the platform's own: writing needs a phext.tech
sign-in, and going to sign in is a second, deliberate click from
the menu (the first click explains and arms; nothing navigates
away uninvited).

**Where the real merge ends:** the local subspace itself — this
session's opened pages and their life — does not merge, because
the shared chart holds no such thing. The chart takes the written
record of the world (inscriptions, standings, the ledger), not
the world. A fuller D2 void-merge of subspace state would need a
gateway protocol that does not exist yet; nothing in the menu
claims it happened.

## Key bindings

One obvious store: `BIND` in game3.js (persisted at
`nova-phox-bindings`, the LS discipline of the other prefs), read
by the keydown dispatch for every remappable verb — jump, strike,
chisel, flip gravity, lamp, brush smaller/larger, the board, the
map of realms, the log. Other builds read the same store through
`NOVA_FOX3.bindings()` / `bindingFor("strike")` — the strike
hint's "currently-assigned binding" is `BIND.strike`.

The panel lists each action with its current key; choosing one
captures the next key pressed. Taking a key another action holds
**swaps** the two bindings (never doubled, never lost). Keys that
already have a job are refused with the reason shown: the
instrument's note rows, the scheme's walking keys, Esc/Tab/Enter/
arrows/Shift/modifiers. "Reset to defaults" restores the shipped
bindings.

Scoping, stated plainly: **walking is not per-key remapped.** It
stays governed by the WASD/AWEF scheme (the panel carries the
scheme as a row that works the existing keys button), because the
scheme is load-bearing machinery — the W tap-note, AWEF's E-walk,
AWEF's F-walk suppressing the F strike all key off it — and
per-key walking remaps would collide with the note rows. The one
interaction is preserved: while the strike is bound to F, AWEF
still walks it instead (the strike lives on the click there, as
before); remap the strike elsewhere and it works in AWEF too.

## Video settings — only real ones

- **Render scale** (50% / 75% / 100%): multiplies the renderer's
  pixel ratio, applied the moment it's chosen.
- **View distance** (near 2 / standard 3 / far 4): the chunk
  radius the world keeps around the fox — `RENDER_R` now reads
  the setting and is re-read by chunk maintenance every frame.
- **Fullscreen**: the real fullscreen toggle.

Not offered: antialiasing — the renderer is created with it off
and it cannot change after creation; a toggle for it would be
decorative, so there isn't one. Persisted at `nova-phox-settings`.

## Audio settings — the game's actual audio

The audio system has exactly two buses, and the panel controls
both, really: **master volume** (the gain node every synthesized
sound runs through — the sound button's 0.9 is now this setting,
and the button's mute still zeroes it) and **narration volume**
(the level of every narration element, applied to the cache and
to elements created later). Plus the game's one mute, shared with
the sound button — not a second one. There is no separate music
bus in this game, so there is no music slider.

## Quit

`window.close()` is attempted (browsers honor it only for
script-opened windows) and the session lands on the title — the
phext logo panel the game booted behind — with narration stopped
and the pointer released. Both the hosted and download builds are
this same single file, so both get the title-screen close-out;
the session's world is not destroyed by quitting — stepping past
the title resumes it. Reported plainly: in a browser tab the user
didn't script-open, no page can do more than this.

## Tests

- **Unit (`node test3.mjs`): 225 passed, 0 failed** — the 210
  baseline plus 15 new: the implode byte-exact (hand-computed and
  cross-checked against the estate's Python implode), a full
  world export of a 9-page subspace (genesis inscription present,
  all coordinate components ≥ 1, an explode by level-byte runs
  finds every scroll, byte count is the UTF-8 length), and
  built-file presence checks for the menu, the binding store, the
  settings wiring, the reset keys, and the honest LAN state.
- **E2E (`node cdp_test3.mjs`): E2E_COUNTS_PLACEHOLDER**
- A targeted probe (boot → splash → scheme toggle → V lamp → Esc
  open/close → LAN state/note → quit-to-title) passes end to end
  against the built file.
- New e2e legs cover: Esc opens/closes; arrow-key selection;
  Enter working a row; LAN never claiming a session; binding
  capture, persistence, swap, note-row refusal, and reset; render
  scale reaching the renderer's pixel ratio; view distance moving
  the chunk radius; master volume reaching the master gain and the
  shared mute; merge never navigating uninvited and claiming
  nothing without a sign-in; the .phext save reporting its scrolls;
  quit landing on the title; and the new-game gate (armed ≠ wiped,
  "keep playing" disarms intact, confirm wipes the record and name
  while bindings/settings/controls survive, fresh game at the wake
  beat).

## Files

- `demo13/` — the whole build (page3.html, game3.js, world.js,
  test3.mjs, cdp_test3.mjs carry the work; cdp_test3.mjs's target
  URL points at demo13). demo5–demo12 untouched.
- This report.
