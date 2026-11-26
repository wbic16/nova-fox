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
> Wake up, fox. The galaxy is conquered — every star charted, every shore named. I am Emise; I keep the chart-line, and I'll walk with you a while.
>
> One thing the conquest never solved: the dark. Most of everything is dark, and it outweighs everything we can see.

### N-02 · rifts
> And then the rifts opened — places where the dark touches the chart. Things arrive that shouldn't exist. Pages appear that no one wrote.
>
> You are standing on one. Nova Prime. Click the world to take the helm — sound wakes with the click, so listen as you go.

### N-03 · move
> Feet first. Walk with W A S D (the arrows work too), look with the mouse, and jump with Space. The world is wide and it does not end at the fence — there is no fence.

### N-04 · numbers
> Now — the numbers along the top of your keyboard are an instrument. So is the letter row beneath them. Press any number and listen.
>
> Three different notes together make a tune. And a tune, fox, is a place.

### N-05 · bridge
> Here is the first tune worth knowing: 1 · 4 · 9. Play the three numbers, in any order, close together.
>
> It is the bridge tune. It will carry you to Ashfall Haven — and from there, the same tune carries you home.

### N-06 · ashfall
> Ash and red rock. Every page of the chart has its own weather, its own ground, its own temper.
>
> Things move in the dark here, as they do at home. Some of them you will only see in glimpses — watch for the glimpse, and strike then (click, or F).
>
> Play 1 · 4 · 9 when you're ready to go back.

### N-07 · gravity
> One more verb before I leave you to it: G turns down itself. Down is not a law of the world — it is a habit of the place you stand in, and the place remembers what you tell it.
>
> Try it. (If you turn down up, look for the dark ceiling the rift provides — it was not there before you spoke.)

### N-08 · quest
> East of where you first woke, a hill rises over an old hall — the barrow. In its deep room lies the Deep Stone, and something keeps it.
>
> Reach the stone. What you earn there is written down, and what is written down stays — while the grass and the light and the day itself are re-drawn around it.
>
> Go down the shaft in the hill's top. Strike with click or F. Mind your hearts — they are your whole story, told plainly.

### N-09 · done
> The hat is yours, and it is written where writing lasts. You know the two true things now, even if you'd never say them my way: a tune is a place, and what is written outlasts what is merely shown.
>
> The rest of the chart is yours — ten more realms are named on it, quiet for now. Press M to see their names. I'll be on the line when you need me.

---

## Event beats (fire when they happen)

### BEAT-arrival · on spawn
> Nova Prime. Emise is on the chart-line — her panel is below.

### BEAT-cross-ashfall · first crossing to Ashfall Haven
> Ashfall Haven. The air tastes of cinders; the rock remembers fire.

### BEAT-cross-nova · crossing home
> Nova Prime. Home meadow, green under a kind sky.

### BEAT-pocket · a tune lands you on a far page
> The tune lands you on a far page of the chart.

### BEAT-stay · the tune you play is the page you stand on
> That tune is the page you are standing on. It hums, and holds.

### BEAT-flip-up · down turns up
> Down is up. The place remembers.

### BEAT-flip-down · down restored
> Down is down. The place remembers.

### BEAT-border-up · walking into a place where down is up
> Down is up here. The place says so.

### BEAT-border-down · walking back into ordinary down
> Down is down again here.

### BEAT-barrow · first entering the barrow hall
> The barrow hall. Something keeps the deep room — watch for its glimpses.

### BEAT-quest · the Deep Stone reached
> The Deep Stone. And with it — a hat, written down where writing lasts.

### BEAT-contact · a dark thing reaches you
> It reaches you out of the dark.

### BEAT-guardian-contact · the guardian reaches you
> The guardian reaches you. Strike it back — click, or F.

### BEAT-strike-hold · a strike lands, the thing holds
> It holds. Strike again.

### BEAT-strike-kill · a dark thing is struck out
> Struck out of the world. The place keeps the scar.

### BEAT-guardian-kill · the guardian falls
> The guardian is struck out of the world. The hall is quiet.

### BEAT-death · carried back to Arrival
> The dark takes its due — and returns you to Arrival. Everything written stayed written.

### BEAT-fall · the chart loses your place (safety net)
> The chart loses your place for a moment.

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
