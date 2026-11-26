# Nova Fox demo v2 — Emise's narration script

Every spoken line in the demo, in order, written for later voice
recording (Aria, Emise's standing voice; voice notes at 120% speed).
Lines are keyed by beat ID — the same IDs the game uses
(`GUIDE` in game2.js, plus the `BEAT` lines fired by events). Record
one file per ID: `narration/<id>.mp3`.

Delivery notes: Emise is the chart-keeper — unhurried, dry warmth,
a cartographer's precision. She never explains the machinery. She
says what is true in the world and trusts the player's hands to
learn the rest. Pauses live where the line breaks are.

The veil binds every line: the world is named in-fiction only —
chart, rift, tune, page, the dark. Nothing here names the substrate.

---

## The guided opening (first minutes, in order)

### N-01 · wake
> Wake up, fox. I'm Emise — I keep the map, and I'll walk with you a while.
>
> The galaxy is ours: every star named, every shore explored. But most of everything is still dark — and nobody ever learned what the dark is hiding.

### N-02 · rifts
> Then the rifts opened — cracks where the dark gets in. Things turn up that shouldn't exist. Places appear that nobody built.
>
> You're standing in one now: Nova Prime. Click the world to take control — the sound starts with that click, so listen as you go.

### N-03 · move
> Feet first. Walk with W A S D — the arrows work too. Look with the mouse, and jump with Space. Walk as far as you like: there is no fence, no edge, no end.

### N-04 · numbers
> See the number keys along the top of your keyboard? They're an instrument. The letter row under them works too. Press any number and listen.
>
> Three different notes together make a tune. And a tune, fox, is a place.

### N-05 · bridge
> Here is the first tune worth knowing: 1, 4, 9. Play the three notes in any order, close together.
>
> That's the bridge tune. It opens a rift to Ashfall Haven, a few steps in front of you — walk through it to cross. From Ashfall, the same tune opens the way home.

### N-06 · ashfall
> Ash and red rock. Every place on the map has its own weather, its own ground, its own mood.
>
> Things move in the dark here, same as at home. Most of the time you'll only catch a glimpse of them — and that's your moment. Strike when one shows itself: click, or press F.
>
> Play 1, 4, 9 when you're ready to head back.

### N-07 · gravity
> One more trick before I leave you to it: press G, and down turns upside down. Down isn't a law here — each place keeps its own down, and it remembers what you set.
>
> Try it. Flip down up, and a dark ceiling appears over this place to catch you — it wasn't there before you flipped.

### N-08 · quest
> East of where you woke up, a hill rises over an old buried hall — the barrow. Deep inside it lies the Deep Stone, and something is guarding it.
>
> Reach the stone, and the prize is yours for good. The grass, the light, even the day will change around it — what you've earned stays earned.
>
> Climb the hill and go down the shaft in its top. Fight with click or F. And watch your hearts — when they're gone, you're carried back to where you started.

### N-09 · done
> The hat is yours, and it's yours for good. You know the two true things now, even if you'd never say them my way: a tune is a place, and a mark you make stays — even when everything around it changes.
>
> The rest of the map is yours. Ten more realms are marked on it, quiet for now — press M to see their names. I'll be here when you need me.

---

## Event beats (fire when they happen)

### BEAT-arrival · on spawn
> Nova Prime. I'm Emise — my panel is at the bottom of your screen.

### BEAT-cross-ashfall · first crossing to Ashfall Haven
> Ashfall Haven. The air tastes of cinders; the rock remembers fire.

### BEAT-cross-nova · crossing home
> Nova Prime. Home meadow, green under a kind sky.

### BEAT-pocket · a tune lands you in a far-off place
> The tune lands you in a far-off place.

### BEAT-stay · the tune you play belongs to the place you stand in
> That's this place's own tune — it hums, and you stay put.

### BEAT-flip-up · down turns up
> Down is up. The place remembers.

### BEAT-flip-down · down restored
> Down is down. The place remembers.

### BEAT-border-up · walking into a place where down is up
> Down is up here. The place says so.

### BEAT-border-down · walking back into ordinary down
> Down is down again here.

### BEAT-barrow · first entering the barrow hall
> The barrow hall. Something guards the deep room below — watch for its glimpses, and strike when it shows itself.

### BEAT-quest · the Deep Stone reached
> The Deep Stone — and with it, a hat. It's yours for good.

### BEAT-contact · RETIRED from the spoken rotation (feedback #24)
> It reaches you out of the dark.

Retired 2026-11-22 (dialog v5 pass): Will ruled the repeated contact
clip should just be a noise. An ordinary thing's landed hit now cues
with the damage flash and the hurt sound only — no voice, no toast.
The recording is kept on disk (and in the build's manifest) so the
27-beat set stays intact; the game never triggers this beat.

### BEAT-guardian-contact · the guardian reaches you
> The guardian reaches you. Strike it back — click, or F.

### BEAT-strike-hold · a strike lands, the thing holds
> It holds. Strike again.

### BEAT-strike-kill · a dark thing is struck down
> It's gone. And the scar stays.

### BEAT-guardian-kill · the guardian falls
> The guardian is gone. The hall is quiet.

### BEAT-death · carried back to Arrival
> The dark takes its due — and you wake back at Arrival. Everything you earned is still yours.

### BEAT-fall · the world loses track of you (safety net)
> The world lost track of you for a moment.

---

## The two true things (the +1 phext XP, stated once, here only)

The guided opening is engineered so a fresh player cannot finish
it without having **done** both of these — the narration never
lectures them:

1. **Movement is addressing.** The player plays a chord of three
   numbers (N-05) and is carried somewhere (BEAT-cross-ashfall),
   then plays the same chord and is carried home. A tune is a place
   because their hands made it one.
2. **Written outlasts shown.** The player strikes a thing out of
   the world and the scar stays in the regenerated ground
   (BEAT-strike-kill); they earn a hat that is *written down*
   (N-08, BEAT-quest) while the world around it is re-derived —
   and if they fall, everything written stays written (BEAT-death).
