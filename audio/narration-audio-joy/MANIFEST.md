# Nova Fox narration audio — the Joy set (manifest)

Recorded 2026-11-26 from the final script, `engine/integration/NARRATION.md`
(sha256 4892580ffd152f0a7c28a7b7902c4413f8853d1a23abb323bb7a66e536930be8) —
Will's full review pass, 2026-11-26 15:00–15:43 CST. The speaker is
**Joy**, the player's aperture shift. Voice 1 (`avocado_v2:vdc_11859`),
speed 100, English, MP3. Script text was synthesized verbatim.
One file per beat; N-03 was recorded in both control-scheme variants
(WASD and AWEF) — the game plays the variant matching the player's
resolved scheme. Filenames are lowercase; the build (demo22's
build3.py) maps them to the beat IDs below.

**Totals: 25 script beats recorded, 0 failed, 249.8 s of audio, 2,471,694 bytes of MP3.**
Plus the ten banter takes (416,940 bytes), carried in this set
but not embedded by the demo22 build — see "Banter takes" below.

## Guided opening

| Beat ID | File | Duration | Line |
|---|---|---|---|
| N-01 | n-01.mp3 | 12.43 s | Wake up, Fox! The rifts have opened. I'm Joy, your aperture shift. Ten realms have appeared, each one unexpected. Let's go exploring! |
| N-02 | n-02.mp3 | 13.32 s | Nova Prime — that's here! The first realm, and you're standing in the rift that opened it. Click the world to take hold of it. The sound starts with your click, so listen as you go! |
| N-03-WASD | n-03-wasd.mp3 | 15.00 s | Feet first, Fox! W A S D to walk — the arrows work too. Mouse to look, Space to jump. There's no fence, no edge, no end. Run as far as you like! |
| N-03-AWEF | n-03-awef.mp3 | 24.60 s | Feet first, Fox — and your hands get the other layout. F walks forwards, A walks backwards, W strafes left, E strafes right. Mouse to look, Space to jump. Cartoon hands make do with four fingers. Sentients ship with five, so your thumb gets the Space bar all to itself. There's no fence, no edge, no end. Run as far as you like! |
| N-04 | n-04.mp3 | 7.37 s | See the numbers along the top? They're an inky! Press three in a row - together they make a tune...and a tune? That's a place. |
| N-05 | n-05.mp3 | 19.15 s | Here's your first tune: 1, 4, 9. Any order, close together. That's the bridge tune — it opens a rift to Ashfall Haven, right in front of you. Step through! From Ashfall, the same tune brings you home. |
| N-06 | n-06.mp3 | 22.75 s | Ashfall Haven! Ash, red rock, cinders on the wind. Every realm has its own weather, its own ground, its own mood. Things move in the dark here — you'll glimpse them, just barely. Strike in the glimpse: click, or F. Ready to head back? 1, 4, 9. |
| N-07 | n-07.mp3 | 24.77 s | One more surprise...press G to invert gravity self. Down and up are suggestions here, ones that you can swap daily. You'll feel a little woozy after a gravity inversion, that's normal. Just remember, each realm can only swap gravity once a day! |
| N-08 | n-08.mp3 | 21.41 s | East of Home Base, where you woke up, rises the Unexpected Hall. Deep inside lies a piece of Nova Prime's Heart. Whenever you find a hall, you should explore it to collect another piece of the planet's heart. The journey will be dangerous, but Nova Prime will reward you every time. |
| N-09 | n-09.mp3 | 13.61 s | Good, Fox: you've found another piece of Nova Heart. You've unlocked a Bundle. Return to Home Base and help rebuild Nova Prime! Press M to view available realms. |

## Event beats

| Beat ID | File | Duration | Line |
|---|---|---|---|
| BEAT-arrival | beat-arrival.mp3 | 4.99 s | Nova Prime! Welcome Home, Fox. Your items are on the left. |
| BEAT-cross-ashfall | beat-cross-ashfall.mp3 | 6.00 s | Ashfall Haven...the rock here remembers the fire that forged the cinders. |
| BEAT-cross-nova | beat-cross-nova.mp3 | 5.64 s | Nova Prime! Home Base and safety. The monsters cannot find you here. |
| BEAT-pocket | beat-pocket.mp3 | 5.88 s | Whoa, Fox! This place is entirely new! That tune was powerful. |
| BEAT-stay | beat-stay.mp3 | 1.44 s | This is ours. |
| BEAT-flip-up | beat-flip-up.mp3 | 5.47 s | Gravity inversion in progress. Reality has shifted, permanently. |
| BEAT-flip-down | beat-flip-down.mp3 | 1.15 s | Gravity restored. |
| BEAT-border-up | beat-border-up.mp3 | 2.28 s | Inverted Gravity Detected. |
| BEAT-barrow | beat-barrow.mp3 | 7.51 s | The Unexpected Hall, Fox. Find the Shadow, strike at the Heart. Your vision alone can fix it. |
| BEAT-quest | beat-quest.mp3 | 8.88 s | This ... is the (gasp) Nova Heart, Fox! You've earned this - take the hat. It's yours, for good! |
| BEAT-guardian-contact | beat-guardian-contact.mp3 | 5.81 s | This guardian is confused, Fox. You must strike back. Strike, now! |
| BEAT-strike-kill | beat-strike-kill.mp3 | 1.99 s | It is done. |
| BEAT-guardian-kill | beat-guardian-kill.mp3 | 11.28 s | (Winds of Change) The ... shadow is ... gone, Fox! You've done it! The hall is quiet, Nova Prime calls to you. Another piece of Nova Heart is near. |
| BEAT-death | beat-death.mp3 | 5.11 s | Oh no!! Fox, hold on. I'm getting you out of here. Stay with me...please. |
| BEAT-fall | beat-fall.mp3 | 1.92 s | Fall home, fox. |

## Not recorded under this script (by the script's own ruling)

- **BEAT-border-down** — SILENT: no line fires in the normal case.
- **BEAT-strike-hold** — NO DIALOGUE: the sound of the hit does the talking.
- **BEAT-contact** — RETIRED from the spoken rotation (feedback #24);
  its line stays in NARRATION.md only and the game never triggers it.

## Banter takes — carried, unhooked

Joy's ten ★ takes (JOY-BANTER.md lines 1, 3, 4, 7, 20, 29, 36, 51, 70,
81) are recorded and kept in this set. They attach per line ID through
demo17's banter audio hook, which is **not in the demo22 lineage** —
so in demo22 they are carried but unhooked: present here, not embedded
in the build, never triggered. They join when demo17's wiring merges.

| File | Duration | Line |
|---|---|---|
| banter-01.mp3 | 2.52 s | Joy banter line 1 (JOY-BANTER.md) |
| banter-03.mp3 | 3.67 s | Joy banter line 3 (JOY-BANTER.md) |
| banter-04.mp3 | 3.84 s | Joy banter line 4 (JOY-BANTER.md) |
| banter-07.mp3 | 2.81 s | Joy banter line 7 (JOY-BANTER.md) |
| banter-20.mp3 | 1.20 s | Joy banter line 20 (JOY-BANTER.md) |
| banter-29.mp3 | 0.84 s | Joy banter line 29 (JOY-BANTER.md) |
| banter-36.mp3 | 3.79 s | Joy banter line 36 (JOY-BANTER.md) |
| banter-51.mp3 | 3.41 s | Joy banter line 51 (JOY-BANTER.md) |
| banter-70.mp3 | 2.83 s | Joy banter line 70 (JOY-BANTER.md) |
| banter-81.mp3 | 3.53 s | Joy banter line 81 (JOY-BANTER.md) |
