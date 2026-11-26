# Fox Vision — build report (demo11)

**Completed EE 963** (2026-11-26). Spec (Will, 2026-11-26 15:20 CST, verbatim): "introduce Fox Vision, usable when inside The Unexpected Hall — it provides night vision of all familiars within subspace range."

Built in a fresh tree: `~/workspace/nova-fox/demo11/`, copied from demo5 after verifying demo5's index.html at sha256 `98207789e35e62b1b3399d60180b03fea223d9c488311332c60f1e4cf15a8f40`. demo5–demo10 were not edited. Not staged, not deployed. The `NF_SHIP_EE` token value is unchanged (`NF_SHIP_EE:950`, exactly once in the built file).

## What was built

- **Activation — the N key, toggle.** KeyV was already taken (it is the lamp), so Fox Vision sits on **KeyN**, verified free before binding (not in the letter/number key sets, not in the keydown switch). Press N inside the Hall to raise the sense, N again to put it down. A touch button (`vision`, beside the lamp button) does the same for touch players, and the help line now reads "… · N fox vision in the Hall". Leaving the Hall — walking out or crossing realms — puts the sense down automatically.
- **The Hall test.** "Inside The Unexpected Hall" is the barrow's footprint **and** its vertical band: below the barrow ceiling and above its floor. The band matters — the open surface above the buried hall measures 20–24 blocks high against the hall's ceiling at 10, so standing on the grass over the barrow does **not** count as inside it, while the hall floor (feet ≈ 5) does, cleanly.
- **Visual treatment.** The familiars' existing glimpse register, held open: a revealed familiar renders at **full opacity in every subspace phase** (the phase gate that normally shows it only in glimpses is pinned open for it) with its **emissive intensity raised ×2.4** — the dark shape stands lit in the dark, eyes bright, in the same materials the game already uses. Nothing new was drawn.
- **Range.** 48 cells (96 blocks) — the world's existing familiar detection distance, the haunt radius the subspace tick already used. It is now one named constant (`FAMILIAR_RANGE_CELLS`) read by both the haunt logic and Fox Vision, so the two can never drift apart. The Hall is 12×10 cells, so the sense covers the Hall entirely while remaining a real bound: a familiar beyond 48 cells stays dark (verified live).
- **Outside the Hall.** Pressing N outside the Hall is a **quiet non-response** — the sense does not rise, and there is no error text, no sound, and no narration line. Feedback for a successful raising is the sight itself; no toast or copy was added (see open questions).

## One design decision to surface: the vision cuts both ways

While Fox Vision reveals a familiar, that familiar **can be struck and can strike back** — the strike and contact gates now accept "seen by vision" alongside "seen by glimpse." This is deliberate: Joy's barrow line — "Find the Shadow, strike at the Heart. **Your vision alone can fix it**" — only works if a vision-revealed Shadow can be fought in its dark phases. The one glimpse left untouched is the remote view through a portal rift, which still shows familiars by phase alone.

## The guardian and the Heart

The Shadow (the Hall's guardian) is a familiar for this purpose and is revealed like any other. **Finding:** the existing guardian model exposes **no distinct Heart part** — its mesh is body, studs, legs, and emissive eyes only — so Fox Vision reveals the Keeper whole; there was no Heart sub-part to light separately. If a Heart part is modeled later, the reveal path will carry it automatically (the treatment is per-material across the whole mesh).

## Tests

- **Unit: 223 passed, 0 failed** (demo5 baseline 210, plus 13 new Fox Vision checks: the Hall test inside/on-the-surface-overhead/above-the-ceiling/outside-the-footprint; the toggle opening only inside and always closing; reveals in range regardless of phase, none out of range, none dead; the range constant pinned at the haunt radius; built-file wiring for the key binding, help line, and touch button).
- **E2E, Fox Vision legs: 12 passed, 0 failed** — run against the real built page in headless Chrome with real key events: boot with no console errors; Arrival is not the Hall; N outside switches nothing on; the deep room is the Hall; out of phase the Keeper is not seen the ordinary way; N inside wakes the sense; the Keeper stands revealed in a dark phase and lights up (lit flag set, opacity > 0.9); a familiar spawned beyond range stays dark; putting the sense down restores the glimpses; leaving the Hall puts the sense down on its own.
- **Full e2e suite: attempted three times, never completed — environment, stated plainly.** The cell was heavily oversubscribed throughout (load average 12–36 on 1.5 shared CPUs, ~60 Chrome processes from the sibling demo6–demo10 builds running their own suites). Attempt 1 died when its CDP transport dropped; attempt 2 died at the boot wait; attempt 3 reached **115 checks ok** before its driver process was killed (SIGKILL), with its failures concentrated in wall-clock-sensitive movement legs starved of CPU (the fox covering 5.7 blocks in a window sized for 7.5+) and the known touch-emulation legs — no Fox Vision leg was reached in any full-suite attempt, and no failure observed in any attempt is attributable to this feature. The Fox Vision legs were therefore verified by the focused probe above instead. The legs are also committed into demo11's `cdp_test3.mjs`, so the next full-suite run in a quiet cell covers them.
- **Harness finding worth knowing:** every demo's e2e suite hardcodes the same Chrome debug port (9335), so sibling suites running concurrently attach to and cross-drive each other's browsers — that collision is what killed attempts 1–2. demo11's suite was moved to a private port (9342). Two frame-dependent waits in the new legs were also widened (5 s → 30 s) after the starved cell produced multi-second frame droughts; both flakes were in the test's timing, not the feature (the state-level assertions passed in every run).

## Build facts

- demo11/index.html: **4,937,836 B, sha256 `da6effae1b446e833588b7902175c4baa2fdd6ab1fcccbcc8937e1c03ab51f1c`**
- Changed sources: `world.js` (Hall test, vision toggle/reveal, shared range constant), `game3.js` (sense state, lit rendering, strike/contact gates, N binding, auto-off, touch wiring, test handles), `page3.html` (help line, touch button), `test3.mjs` (+13 checks), `cdp_test3.mjs` (Fox Vision legs, private debug port, demo11 path).

## Open questions flagged (nothing invented)

1. **Cost / cooldown:** none was added — the sense is costless and instant, per the brief's instruction not to invent one. If Will wants a price on it (flux, a daily charge like gravity, a strain timer), it is a small, contained change at the toggle.
2. **A narration line for the first raising** is Will's to write — Joy's BEAT-barrow line already foreshadows the feature ("Your vision alone can fix it"), so no copy was added here.
3. **The Heart:** if the Shadow is meant to show a distinct Heart under Fox Vision, the guardian model needs a Heart part first (see the finding above).
