# GRAVITY DIAL — design note

**DRAFT — for Will's review. Nothing here is settled.**
Program task: 27.7.6/9.8.9/7.8.13 · 2026-11-24.
Will's ask (2026-11-24 12:01 CST): "reasons for a gravity dial."

## What exists today (verified in the code)

- Gravity is **direction only**: +1 (down) or −1 (up), flipped with
  the **G** key (`flipGravityHere()` in game3.js).
- Direction is a **per-realm fact, remembered**: `realmGravity`
  (world.js) — a flip anywhere in a realm is that realm's down
  everywhere in it, from then on (v5 item 25, Will's ruling). The
  guide teaches it (beat N-07): *"each place keeps its own down,
  and it remembers what you set."*
- **Strength is a hard-coded constant**: the player falls at
  `23 × direction` units/s² with terminal velocity ±26
  (game3.js player physics). Nothing in the game lets a player
  change how *hard* down pulls — only which way.
- Generation obeys direction: where a realm's down is up, the
  riftstone vault ceiling generates overhead to catch the player.
- One open record item: PHYSICS.md Law 3 frames gravity as
  per-room; the per-realm implementation follows Will's later
  ruling, and the law's text is his to amend (V5-REPORT §Item 25).
  The dial is designed on the ruling, not the law's old text.

## The dial

A player-facing control — a dial on the instrument — that sets
**how strong down pulls**, per realm, remembered the same way
direction is. Direction stays the realm's fact (G still flips it);
the dial is the player's hand on the strength.

### Reasons (Will asked for reasons; his seeds, expanded)

1. **The realms already differ — make it playable, not hidden.**
   Eleven realms with eleven palettes and one identical pull is a
   fact the game states nowhere. A dial makes gravity a property
   players *feel* per place: heavy realms, light realms, and a
   hand on the difference.
2. **Exploration tuning.** Long floaty jumps for crossing a new
   realm's gaps; full weight for careful descents into the barrow.
   The same world, two gaits — exploration stops being one-speed.
3. **Combat feel and self-set difficulty.** A heavy world makes
   fights grounded and committal; a light one makes them aerial.
   Players tune their own challenge without a settings menu's
   easy/hard lie — the dial is in the fiction, so tuning it is
   playing, not configuring.
4. **Gravity as a puzzle tool.** Some reaches want a float and a
   drift; some drops want weight. The dial turns down into a verb
   the player aims, alongside the chisel and the chord — a third
   way to solve a place.
5. **Accessibility and comfort.** Fall speed is a comfort setting
   in disguise: gentler falls for players who find fast drops
   hard to track or hard to stomach. The dial gives it to them
   inside the game, where it belongs.
6. **A daily-challenge modifier.** The day's pocket can be seeded
   with a stated gravity ("today, down pulls double") — a fresh
   challenge from an old place, for free, out of one number.
7. **Story fit.** Near the rifts, the dark presses in — and where
   it presses, down wavers (STORYBOARD Scene 7). The civilization
   that charted the galaxy would build a regulator into the
   instrument its people carry into the crack. The dial is that
   regulator: the fiction's reason the control exists at all.

### Mechanics (PROPOSAL)

- **Range and stops:** strength multiplier on today's 23 u/s² —
  five named stops: **Float ¼× · Light ½× · Standard 1× · Heavy
  1½× · Crushing 2×**, with terminal velocity scaling to match.
  Stops, not a continuous sweep: readable at a glance, friendly
  to keys and touch, and each stop is a word a player can say.
  (Alternative for Will: a continuous dial −2×…+2× whose sweep
  *through* zero flips direction and retires the G key. One
  control instead of two; riskier to teach.)
- **Per-realm memory:** the dial setting is remembered per realm,
  in the same breath as direction — the realm record becomes
  {direction, strength}. Entering a realm restores its pair; the
  border beats already fire when a realm's down differs, and they
  name strength too ("Down is up here, and light.").
- **What the dial may change:** the player's own fall, jump, and
  landing. It is a property of the fox's instrument, not of the
  world — which is what keeps it honest in a shared world.
- **What it may not change:** the realm's remembered direction
  (the place's fact, set by the flip, shared by everyone in it);
  world generation (the vault ceiling answers direction, not
  strength); other players' bodies; and the score's honesty —
  draft: daily-board lines and challenge clears carry the gravity
  they were earned at (the board line already carries a daily
  flag; a gravity mark joins it), so a Float clear and a Crushing
  clear are both honored and never confused.
- **Save interaction:** the setting persists with the realm's
  gravity in the save (current format v2; a v1 save loads at
  Standard everywhere — nothing breaks, nothing is lost).
- **Teaching:** the flip is taught in the opening (N-07). The
  dial gets one short extension beat the first time it matters —
  draft line, for Will's ear: *"That dial sets how hard down
  pulls. Light for the long jumps. Heavy when you want your feet
  to mean it."* New narration records through the existing Aria
  pipeline, like every beat before it.
- **The tier line (from PLAN §3):** PROPOSAL — free play keeps
  the flip and Standard; the dial's other stops are a paid-tier
  advantage, and the dial sits visible in free play, stopping at
  the flip points, so the advantage is obvious before it's bought.

### Implementation shape (for the build leg, not this note)

Small and contained: parameterize the one constant (23) and the
terminal clamp (±26) by the realm's strength; extend the realm
gravity record; add the dial control beside the keys button;
extend the border/flip toasts; one guide beat; unit + e2e checks
mirroring item 25's. Nothing in generation, Life, or the shared
world changes.

*Draft by Emise, 2026-11-24. Current-state claims verified in
demo3/world.js and demo3/game3.js this pass; everything under
"Mechanics" is proposal.*
