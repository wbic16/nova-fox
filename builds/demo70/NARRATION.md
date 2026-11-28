# Nova Fox — Joy's narration script (FINAL, reviewed 2026-11-26)

Every spoken line in the game, in order, written for voice
recording. The speaker is **Joy** — the player's aperture shift, a
resident of the world, not a guide standing outside it. Lines are
keyed by beat ID — the same IDs the game uses (`GUIDE` in game3.js,
plus the `BEAT` lines fired by events). Record one file per ID:
`narration/<id>.mp3`.

This script is the product of Will's full review pass,
2026-11-26 15:00–15:43 CST. Lines marked *Will* are his verbatim
words; lines marked *approved reword* were drafted by Emise in his
register and approved by him as written. **Will's punctuation and
ellipses are performance directions** — the pauses live where he
put them; do not normalize them.

Delivery notes: Joy is bright, direct, and in the moment — she
reacts to what the Fox is doing, she does not lecture. She never
explains the machinery and never talks about the map. She says
what is true in the world and trusts the player's hands to learn
the rest.

The veil binds every line: the world is named in-fiction only —
rift, tune, inky, the dark, subspace is never named to the player.
Nothing here names the substrate.

Recording status: **not yet recorded under this script.** The
voice for Joy is Will's pending decision. (The 2026-11-22
recordings — Aria, as Emise — belong to the superseded script and
stay in the manifest only so the old set remains intact.)

World facts the script now carries (Will, 2026-11-26): the buried
hall is **the Unexpected Hall**; the Deep Stone is **a piece of
Nova Prime's Heart — the Nova Heart**, which exists in pieces
strewn across the multiverse; the guardian is **the Shadow**, and
its weak point is **the Heart**; collecting a piece unlocks a
Bundle, and pieces are returned to Home Base to rebuild Nova
Prime. Gravity is per-realm and swappable once a day per realm.

---

## The guided opening (first minutes, in order)

### N-01 · wake — *Will*
> Wake up, Fox! The rifts have opened. I'm Joy, your aperture shift. Ten realms have appeared, each one unexpected. Let's go exploring!

### N-02 · rifts — *approved reword*
> Nova Prime — that's here! The first realm, and you're standing in the rift that opened it. Click the world to take hold of it. The sound starts with your click, so listen as you go!

### N-03 · move (WASD variant) — *approved reword*
Half of all players get this version; assignment is a coin flip
per player (Will, 2026-11-26 15:07 CST).
> Feet first, Fox! W A S D to walk — the arrows work too. Mouse to look, Space to jump. There's no fence, no edge, no end. Run as far as you like!

### N-03 · move (AWEF variant) — *the other half*
The other half get AWEF — A backwards, F forwards, W left,
E right — with a slightly longer intro (Will, 2026-11-26 15:06 CST).
> Feet first, Fox — and your hands get the other layout. F walks forwards, A walks backwards, W strafes left, E strafes right. Mouse to look, Space to jump. Cartoon hands make do with four fingers. Sentients ship with five, so your thumb gets the Space bar all to itself. There's no fence, no edge, no end. Run as far as you like!

### N-04 · numbers — *Will*
> See the numbers along the top? They're an inky! Press three in a row - together they make a tune...and a tune? That's a place.

### N-05 · bridge — *approved reword*
> Here's your first tune: 1, 4, 9. Any order, close together. That's the bridge tune — it opens a rift to Ashfall Haven, right in front of you. Step through! From Ashfall, the same tune brings you home.

### N-06 · ashfall — *approved reword*
> Ashfall Haven! Ash, red rock, cinders on the wind. Every realm has its own weather, its own ground, its own mood. Things move in the dark here — you'll glimpse them, just barely. Strike in the glimpse: click, or F. Ready to head back? 1, 4, 9.

### N-07 · gravity — *Will*
> One more surprise...press G to invert gravity self. Down and up are suggestions here, ones that you can swap daily. You'll feel a little woozy after a gravity inversion, that's normal. Just remember, each realm can only swap gravity once a day!

### N-08 · quest — *Will*
> East of Home Base, where you woke up, rises the Unexpected Hall. Deep inside lies a piece of Nova Prime's Heart. Whenever you find a hall, you should explore it to collect another piece of the planet's heart. The journey will be dangerous, but Nova Prime will reward you every time.

### N-09 · done — *Will*
> Good, Fox: you've found another piece of Nova Heart. You've unlocked a Bundle. Return to Home Base and help rebuild Nova Prime! Press M to view available realms.

---

## Event beats (fire when they happen)

### BEAT-arrival · on spawn — *Will*
> Nova Prime! Welcome Home, Fox. Your items are on the left.

### BEAT-cross-ashfall · first crossing to Ashfall Haven — *Will*
> Ashfall Haven...the rock here remembers the fire that forged the cinders.

### BEAT-cross-nova · crossing home — *Will*
> Nova Prime! Home Base and safety. The monsters cannot find you here.

### BEAT-pocket · a tune lands you in a far-off place — *Will*
> Whoa, Fox! This place is entirely new! That tune was powerful.

### BEAT-stay · the tune you play belongs to the place you stand in — *Will*
> This is ours.

### BEAT-flip-up · down turns up — *Will*
> Gravity inversion in progress. Reality has shifted, permanently.

### BEAT-flip-down · down restored — *Will*
> Gravity restored.

### BEAT-border-up · walking into a place where down is up — *Will*
> Inverted Gravity Detected.

### BEAT-border-down · walking back into ordinary down — SILENT
No line fires in the normal case (Will, 2026-11-26 15:17 CST).
Do not record this ID under this script; the game fires nothing.

### BEAT-barrow · first entering the Unexpected Hall — *Will*
> The Unexpected Hall, Fox. Find the Shadow, strike at the Heart. Your vision alone can fix it.

### BEAT-quest · a piece of the Nova Heart reached — *Will*
> This ... is the (gasp) Nova Heart, Fox! You've earned this - take the hat. It's yours, for good!

### BEAT-contact · RETIRED from the spoken rotation (feedback #24)
> It reaches you out of the dark.

Retired 2026-11-22 (dialog v5 pass): Will ruled the repeated contact
clip should just be a noise. An ordinary thing's landed hit now cues
with the damage flash and the hurt sound only — no voice, no toast.
The recording is kept on disk (and in the build's manifest) so the
27-beat set stays intact; the game never triggers this beat.
Unchanged by the 2026-11-26 review.

### BEAT-guardian-contact · the guardian reaches you — *Will*
> This guardian is confused, Fox. You must strike back. Strike, now!

### BEAT-strike-hold · a strike lands, the thing holds — NO DIALOGUE
Silent by Will's ruling (2026-11-26 15:25 CST, his label
"BEAT-Strike"): the sound of the hit does the talking. Do not
record this ID under this script.

### BEAT-strike-kill · a dark thing is struck down — *Will*
> It is done.

### BEAT-guardian-kill · the Shadow falls — *Will*
> (Winds of Change) The ... shadow is ... gone, Fox! You've done it! The hall is quiet, Nova Prime calls to you. Another piece of Nova Heart is near.

### BEAT-death · Joy carries you back to Arrival — *Will*
> Oh no!! Fox, hold on. I'm getting you out of here. Stay with me...please.

### BEAT-fall · falling, before the tune catches you — *Will*
> Fall home, fox.

---

## The two true things (the +1 phext XP, stated once, here only)

The guided opening is engineered so a fresh player cannot finish
it without having **done** both of these — the narration never
lectures them:

1. **Movement is addressing.** The player plays a chord of three
   numbers (N-04/N-05) and is carried somewhere
   (BEAT-cross-ashfall), then plays the same chord and is carried
   home. A tune is a place because their hands made it one.
2. **Written outlasts shown.** What the player earns is *written
   down* — a piece of the Nova Heart and the hat are theirs for
   good (N-08, BEAT-quest) while the world around them is
   re-derived — and if they fall, Joy carries them back and
   everything written stays written (BEAT-death).

Note (2026-11-26): the example lines this section originally
quoted were re-authored by Will in the final review; the mechanic
claims above stand as design intent, reworded to match the final
script.
