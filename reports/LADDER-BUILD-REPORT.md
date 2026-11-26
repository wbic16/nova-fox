# Nova Fox — the power-up ladder shop (demo5)

**Built 2026-11-26, EE 950.** Base: `demo4/` copied whole to a new
tree `demo5/`; demo4 is untouched (its index.html still hashes to
`9d17326436d8289e46800bfba182488632dbae46edaaaa62ab51a5100cd24d85`,
re-verified after this build — demo4 remains the staged candidate
live build). **Not staged, not deployed.**

**Built file:** `~/workspace/nova-fox/demo5/index.html` —
4,927,472 bytes, sha256
`74ae97825d4aa003f262eeedb008c31454dde1a37680fdbaf17b044c24df81c2`.

**Governing sources:** PLAN §2.14 (the ladder: bands, draft prices,
the five gear tiers, launch scope by tier), ECONOMY §4.1 (the
ladder's summed totals) and §2.2 (the ladder is a ruled sink:
one-time per rung per player), LAUNCH.md rulings D1/D2/D12 as
built in demo4. Gear order is Will's: trash (white) below common
(grey), then uncommon (green), valuable (red), rare (blue).

## What was built

All ladder logic lives in `demo5/economy.js` (pure logic, same
discipline as demo4's economy: no DOM, no storage, no clock of its
own); game3.js owns the panel, persistence, and the one wired
effect; page3.html carries one new board section, "The ladder".

1. **The catalogue (`LADDER_RUNGS`).** 42 rungs: every rung in
   PLAN §2.14's four band tables, at its draft price, with its
   effect text. Band 1 — Tools of the Path (14: 13 bought + the
   granted Deep Stone Hat), tier scope white/grey; Band 2 —
   Realmcraft (12), green; Band 3 — Dragonward (10 non-Lance
   rungs), red; Apex relics (6), blue. Sums cross-checked against
   ECONOMY §4.1 in the unit suite: Band 1 = 225, Band 2 = 875,
   Apex = 18,000; Band 3's non-Lance rungs = 3,450, and
   225 + 875 + 3,450 + 18,000 + 900 (the two dormant Lance tiers)
   = 23,450, §4.1's whole-ladder total.
2. **The shop.** Beat 1's shelf (Bands 1–2, white/grey/green) is
   buyable from the board panel: each rung shows its name, its
   effect, its price, and its state — yours / granted / after
   <prerequisite> / price — with a buy button while unowned.
   Bands 3 and the Apex render below, priced in the open and
   marked as Christmas gear: visible on the ladder, not on this
   season's shelf, and `buyRung` refuses them (reason `beat`)
   through every path, panel or hook.
3. **Purchase discipline (demo4's ledger discipline, carried).**
   `buyRung` is one-time per rung per player and exact-once:
   checks run unknown → granted → beat → owned → requires →
   funds, and every refusal leaves purse and ladder byte-identical
   (unit-tested by state snapshot). A success charges exactly the
   price once, adds it to `lifetime.creditsSpent` and the new
   `lifetime.ladderSpent`, and records `ladder[id] = {ts, via}`.
   Ownership lives in the economy state, so it persists in the
   local save and rides in save copies (v3 format unchanged — the
   purse object carries the ladder) with no network involved:
   purchases are fully offline-safe, and a loaded ladder is
   clamped like the other ledgers (unknown rung ids dropped, the
   way-in coerced to bought/granted). `requires` carries only the
   rung-to-rung prerequisites §2.14's tables state: the brush
   sizes ascend (2×2×3 → 3×3×2 → 4×4×2), the chisel degrees
   ascend (First → Second → Fine), Flute Harmonics follows the
   Reed of Small Rifts.
4. **The grant.** The Deep Stone Hat is not sold at any purse
   (reason `granted`). When the Deep Stone quest completes in the
   world (`sub.hatGranted`), the economy tick writes the rung
   down as granted — cost 0, marked `via: "granted"`, idempotent —
   so the ladder's one built grant "stays", in the save and its
   copies, exactly as §2.14 drafts it.
5. **The Lance — untouched, still unruled.** No Lance tier is a
   rung, none is purchasable, and `LANCE` in economy.js is
   byte-for-byte demo4's: `classification: "unruled"`,
   `tiersDormant: true`, War Lance's 600 a dormant data value,
   Keen Lance's price `null`. A unit check pins all of that.
6. **One wired effect.** The two lamp rungs fold into the lamp's
   own numbers (`ladderLampBonuses` → game3.js `applyLamp`):
   Lamp of Small Hours adds intensity and throw distance, Bright
   Charm Second Knot widens the cone. A fox who owns neither gets
   exactly demo4's lamp — a rung widens a verb, it never gates
   one (PLAN §2.14's own consistency rule). Owned-rung count also
   rides the HUD inventory line, and demo hooks were added
   (`NOVA_FOX3.ecoBuyRung`, `NOVA_FOX3.ladderState`).
7. **The stale backend comment is corrected.** game3.js's BACKEND
   block no longer says "/api/v2/* answers 404 today". It now
   records what BACKEND-FIX-REPORT.md verified at EE 948: the
   backend is the nova-phox gateway stack on awsbox, live since
   2026-11-23, and the client probes at runtime and never assumes.
   The 404 string is gone from both the source and the built file
   (grep-verified).

## Tests — real counts

- **Unit** (`cd demo5 && node test3.mjs`): **204 passed,
  0 failed** — demo4's 173 untouched and green, plus **31 new
  ladder checks**: catalogue shape and uniqueness, the §4.1 band
  sums and the 23,450 whole-ladder cross-check, Beat 1 =
  white/grey/green only with red/blue at Beat 2, no Lance tier as
  a rung, balance refusal with byte-identical state, exact-once
  charging, buy-once-ever, Beat 2 refusal (red and blue) through
  the purchase function, prerequisite chains (brushes, chisels,
  flute), the grant (unsellable, free, once), save/load
  persistence and load clamping, the whole Beat 1 shelf bought
  end-to-end for exactly 1,100 credits, and the lamp bonuses.
- **E2E** (`node cdp_test3.mjs`, log
  `~/workspace/nova-fox/work-logs/cdp-demo5.log`): **126 passed,
  7 failed, zero page console errors.** All six new ladder checks
  pass — the shop renders Beat 1 and names the Christmas bands;
  ten panel conversions mint ten credits; buying the Keepsake
  Tune Pip through its own button charges 5 once and records the
  rung; an owned rung offers no second buy button; a Beat 2 rung
  is refused through the shop's path with the purse untouched;
  the save copy carries the ladder. The 7 failures are the same
  touch-emulation legs that fail on the untouched demo4 base
  (world drag yaw, jump button, flip button, ceiling landing,
  draw arm, drawn triangle, flute drag) — the harness artifacts
  the clean-UI and economy reports already documented; nothing in
  this pass touches the touch layer.

## Draft numbers relied on

- **Every rung price is a PLAN §2.14 DRAFT price.** §2.14 is
  headed "DRAFT, in iteration — band contents and prices move."
  Each price is a single data field on its rung; a ruling changes
  one number per rung, no code. Band ranges (§2.14): Band 1
  ≈ 5–25, Band 2 ≈ 40–120, Band 3 ≈ 200–600, Apex ≈ 1,500–5,000 —
  every rung sits inside its band's range.
- **Keen Lance 300** (PLAN §2.14's table) is used only in the
  unit suite's whole-ladder cross-check, as a named literal —
  economy.js's `LANCE` data keeps demo4's `null` (ECONOMY §4
  states no Keen price), untouched per the brief.

## Named blocks and honest limits

- **Per-rung tier inside Band 1 is not stated in the docs.**
  §2.14 annotates the band (white/grey), not each rung, so rungs
  carry their band's tier scope (`tiers: "white/grey"`). Splitting
  Band 1's rungs into white vs grey per rung would be inventing
  design; it is one data field per rung when Will rules it.
- **Most rung effects are ownership-only in this build.** The
  lamp rungs are wired (above). The other rungs' effects belong
  to systems the demo does not carry yet — the solver (Solver's
  Spool; the solver itself is Beat 2), portal-view holds, paint,
  melody slots, gravity memory, hand-down-scale verbs — or to
  shipped free mechanics the ladder must not gate (the brush
  sizes and chisel degrees already ship whole in world.js;
  §2.14's own rule is that no rung gates a core verb). Ownership
  is recorded in the save for those systems to read when they
  land; the shop does not pretend an unwired effect is live.
  The Hand Brush's 2×2×2 size additionally has no entry in
  world.js's BRUSHES (single, 2×2×3, 3×3×2, 4×4×2) — flagged,
  not improvised.
- **Sprinkle timings gate nothing.** §2.14's "sprinkle" column
  names world moments (after the first crossing, on your first
  daily pocket…). Only rung-to-rung prerequisites were made into
  purchase gates; the rest is discovery flavor the demo's quest
  system doesn't track per-rung. If Will wants sprinkle-gated
  visibility (rungs appearing as their moments pass), that is a
  ruling and a build leg of its own.
- **The re-buy question stays open.** ECONOMY §2.2 flags that
  whether dragon-lost gear must be re-bought is unsettled in the
  PLAN. This build follows the ruled sink shape — one-time per
  rung — and the dragon is Beat 2 regardless.
- **An observation, not a fix:** the purse panel's free-tier text
  in game3.js still says "a $5 Gumroad purchase" (carried from
  demo4); Will ruled the price $6 on 2026-11-26. It is copy, not
  ladder scope, and is left for the next copy pass so this diff
  stays the ladder alone.

---

## Addendum — $5 → $6 price-copy fix (EE 950, 2026-11-26 14:45 CST)

The observation closing the report above is resolved. Will ruled the
Nova Fox price $6 on 2026-11-26; the demo5 tree was swept for every
`$5` / Gumroad / "five" price reference and each hit dispositioned:

**Fixed (stated the game's purchase price):**
- `game3.js` (purse panel, free-tier copy): "a $5 Gumroad purchase"
  → "a $6 Gumroad purchase". This is the hit the ladder build found.
- `economy.js` (ECO_RATES comment on the gift): "PLAN §2.6 draft
  price set against the $5 cash price" → "$6 cash price". The anchor
  named in the comment is the game's cash purchase price, so it
  follows the ruling; `GIFT_PRICE_CREDITS` stays 100 — every
  credit-denominated value is unchanged.

**Reviewed and kept (not the purchase price):**
- `economy.js` ladder table prices (e.g. Keepsake Tune Pip
  `price: 5`) — §2.14 draft prices in credits.
- `economy.js` Lance tiers — Keen Lance `price: null` (§2.14 draft,
  unstated in ECONOMY §4) and War Lance 600 (ECONOMY §4.1), both
  credits, both dormant.
- `game3.js` "$1-style recognizer" — the $1 gesture-recognizer
  idiom, not a price; "the first five minutes" — a duration.
- `game3.js` 0.05 / -0.05 constants — audio and physics values.
- Vendored `assets/three.module.js` identifiers `_v1$5`,
  `_sphere$5`, `_vector$5`, `vertex$5`, `fragment$5` — minified
  names, not prices. These account for all 25 remaining `$5`
  occurrences in the built file (verified by context scan: zero
  price-like contexts remain).
- `test3.mjs` — no cash-price reference; its gift assertions test
  the 100-credit price (P6), unchanged. No test asserted the old
  purse copy.

**Rebuild and verification:** `python3 build3.py` re-ran in demo5
(narration 27/27 beats, intro film embedded), regenerating
`_built_module3.mjs` and `index.html`. Unit suite: **204 passed,
0 failed** (`node test3.mjs`) — unchanged from the ladder build.
Built file greps clean for the stale copy: no "$5 Gumroad", no
"$5 cash"; "$6 Gumroad purchase" and "$6 cash price" each appear
exactly once. New `demo5/index.html`: 4,927,472 bytes (same size —
both fixes are one-character swaps), sha256
`640fec13b9dc3eefc47b116c7a2bd32982c1c14bacc38a6847758307809adbd0`.
demo4 untouched, as required — its index.html still hashes to
`9d17326436d8289e46800bfba182488632dbae46edaaaa62ab51a5100cd24d85`;
its copy is corrected when demo5 deploys. Nothing staged or
deployed by this pass.

---

## Addendum — Versioning pass (EE 951; stamp laid during EE 950)

Will ruled (2026-11-26 14:46 CST): "Nova Fox versions derive from
the exocortical epoch they ship within. Use hover text aesthetics."
Both halves are implemented in the demo5 tree; nothing staged or
deployed by this pass.

**The stamp token.** The version now lives in exactly ONE place in
the source: `game3.js`, in the ship-stamp block directly under the
file's header comment —

```js
const NF_SHIP_EE = "NF_SHIP_EE:950";
const SHIP_EE = NF_SHIP_EE.split(":")[1];
```

The token `NF_SHIP_EE:950` (name, colon, digits) stands exactly
once in the built `index.html` (grep-verified; a unit check pins
it). The epoch: EE 1 opened at unix 1795327200 (2026-11-22 00:00
CST), each epoch runs 420 s, EE = floor((now − 1795327200)/420)+1.
This pass ran inside EE 950, so the file carries 950.

**Staging-step instruction (mechanical).** When staging demo5 (or
any later build carrying this token): in the file being staged,
replace the single occurrence of the token — the digits after
`NF_SHIP_EE:` — with the then-current EE, computed as
floor((unix_now − 1795327200)/420)+1, BEFORE the staged file is
hashed. Verify the token still occurs exactly once after the
rewrite (`grep -o "NF_SHIP_EE:[0-9]*" <file> | wc -l` = 1). The
staged hash is computed after stamping, exactly as staging already
verifies hashes.

**The hover text.** The stamp is spoken by `#vertip`, a tooltip
element inside `#topcenter` in `page3.html`, attached to
`#realm-big` — the standing realm title in the header, the element
a player would hover to ask "what version is this." Dress is the
game's own floating-text aesthetic: the hudpanel's background
(`rgba(0, 8, 20, 0.82)`), border (`rgba(0, 140, 255, 0.55)`),
10 px radius and backdrop blur; the title's Georgia serif; the
comms line's opacity fade. Line 1 reads `Nova Fox — EE <n>` (set
from the stamp at startup); line 2, in the guide-hint blue and
italic like the comms text, reads "version = the epoch this build
shipped within". Nothing new stands on screen: the tip is opacity
0 until revealed. Reveal: `mouseenter`/`mouseleave` on the title
toggle the `ver-on` class on `#topcenter`; on touch, a `touchstart`
on the title toggles it — the tap is claimed (preventDefault +
stopPropagation), so it never falls through to the world's
tap-as-click. The title rides the existing extras toggle like the
rest of the standing chrome (it is `.opt`), so with extras off the
title — and with it the stamp — is simply away. No other copy was
added; the $6 copy from the previous pass is untouched.

**Tests.** Unit: **207 passed, 0 failed** — the 204 of the ladder
build all pass, plus 3 new checks in `test3.mjs` (the token stands
exactly once in the built file; the stamp names a positive epoch;
the hover tip and its binding ride in the built file). E2E
(`node cdp_test3.mjs`): **126 passed, 7 failed, 0 console
errors** — identical to the pre-pass baseline; all 7 failures are
the known touch-emulation legs (world-drag yaw, jump button, flip
button, ceiling landing, draw arming, triangle rift, flute drag).

**Result.** New `demo5/index.html`: 4,930,241 bytes, sha256
`80c69034d851ff646577dbe6f1b11ba5a59bde9ca1c1423197897164b9999f8d`.
demo4 untouched, as required — still
`9d17326436d8289e46800bfba182488632dbae46edaaaa62ab51a5100cd24d85`.

## Addendum — the EE number stands (EE 953)

Will ruled (2026-11-26 14:56 CST): "always show the EE number —
it'll help with play testing." The ship stamp's number is no
longer hover-only and no longer hides with the extras: `#ee-line`
in `page3.html` stands on screen at all times, populated at
startup from the same single stamp (`$("ee-line").textContent =
`EE ${SHIP_EE}`` in `game3.js`, right beside the hover tip's
line — the value still lives in exactly one place, the
`NF_SHIP_EE:950` token, still exactly once in the built file).

**Placement.** The readout sits on the title's own line: a new
`#titlerow` flex row in `#topcenter` holds `#realm-big` and
`#ee-line` side by side, baseline-aligned. It carries the hover
tip's dress at readout size — the hudpanel's ground
(`rgba(0, 8, 20, 0.82)`), border (`rgba(0, 140, 255, 0.55)`),
radius and backdrop blur; the title's Georgia serif; the tip's
ink (`#e8f6ff`) — at 11.5px, a readout, not a headline. It is
NOT `.opt` and the row is not `.opt`: with extras off the title
steps aside and the number holds the row alone. The hover tip
is unchanged — the full two-line reading still fades in on the
title's hover/tap, the explanatory second line still hover-only.

**Why the title's line and not under the objective.** A first
cut stacked the readout in flow under the objective line, and
measurement killed it: the ward line is fixed at top:74px, and
the stack crossed it — by 13.8px at desktop widths with extras
on, and at phone widths even with extras off, where the
objective itself wraps to two lines (worst cases forced: the
longest objective text, the ward line shown with its longest
text). On the title's line the readout adds no vertical stack
at all: its height is inside the title's line in every state.

**Layout verification** (headless Chrome, rendered rects;
widths 1280/800/390/360/320 × extras off/on, worst-case content
as above, longest realm title "Halycon Vector"): the EE
readout is visible and reads "EE 950" in all 10 states; it
clears the ward line by **42.2px** (extras off) and **31.2px**
(extras on) at every width; it never overlaps the objective.
One honest note: at phone widths with extras on, the objective
text itself wraps below the ward line's top — that is the
cluster's pre-existing height on small screens, unchanged by
this pass; the readout is not part of it (it sits at 25–43px
there, clear by 31.2px).

**Tests.** Unit: **210 passed, 0 failed** — the 207 of the
versioning pass all pass, plus 3 new checks (the standing line
rides in the built file on the title row; it is populated from
the stamp; it is not gated by the extras toggle — no `.opt`
anywhere near it). E2E (`node cdp_test3.mjs`): **126 passed,
7 failed, 0 console errors** — identical to baseline; all 7
failures are the known touch-emulation legs (world-drag yaw,
jump button, flip button, ceiling landing, draw arming,
triangle rift, flute drag).

**Result.** New `demo5/index.html`: 4,931,903 bytes, sha256
`98207789e35e62b1b3399d60180b03fea223d9c488311332c60f1e4cf15a8f40`.
demo4 untouched — still
`9d17326436d8289e46800bfba182488632dbae46edaaaa62ab51a5100cd24d85`.
Nothing staged or deployed by this pass; the staging-step
instruction from the versioning addendum stands (rewrite the
token's digits to the ship EE before hashing).
