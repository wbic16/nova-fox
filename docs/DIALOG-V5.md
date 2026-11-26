# Nova Fox — Dialog v5 (feedback #26: "the dialog is total gibberish — do better")

Will's ruling, 2026-11-22 21:56 CST. Every player-facing string in the
shipped build (demo3) was rewritten in plain, one-read English. The
veil holds throughout: no "phext", "subspace", "coordinate", "scroll",
or "WAL" appears in any player-facing line — and the old lines that
named phext.tech in the HUD are gone. Every line keeps its exact game
function and trigger; the guide sequence, the F3 mark beat, and all
mechanics are untouched. Palette untouched.

**Totals: 83 lines changed or removed** — guide beats 29 · event beats
10 · HUD 12 · board & save 17 · start/help/realms/misc 15.

**Audio: 18 of 27 beats re-recorded** (same route as the originals:
Aria, speed 120%, MP3 24 kHz mono — format verified identical), so
panel text and voice agree again. **Audio gaps: none.** One
pre-existing mismatch was found and fixed: the shipped N-05 panel text
had been edited for the rift change without re-recording, so the
panel and the voice disagreed; both now carry the new line.
Pronunciation is not ear-verified (no listening pass was possible);
the letter-name spots stay flagged in MANIFEST.md, as before.

**Build:** demo3/index.html, 3,375,965 bytes,
sha256 `cc25a0322e420c35b894bc49dab7c2e28d1e9057711fd7e8a9cb8c8c9f4c1a8c`,
staged to awsbox `~/fox-phext-launch/site/index.html`, hash-verified
on the box. Live webroot untouched (Will's sudo step).
**Tests:** unit 78/78 · e2e 58/58 · zero console errors. One e2e
assertion followed the dialog: the syncline check pinned the literal
words "chart-line"; it now checks the label mentions "marks" — the
check's intent (sync state always labeled, never silent) is
preserved, and no check was deleted.

---

## Guide beats (spoken beats: panel text == recorded script)

| # | Before | After |
|---|---|---|
| N-01 | Wake up, fox. The galaxy is conquered — every star charted, every shore named. I am Emise; I keep the chart-line, and I'll walk with you a while. | Wake up, fox. I'm Emise — I keep the map, and I'll walk with you a while. |
| N-01 | One thing the conquest never solved: the dark. Most of everything is dark, and it outweighs everything we can see. | The galaxy is ours: every star named, every shore explored. But most of everything is still dark — and nobody ever learned what the dark is hiding. |
| N-02 | And then the rifts opened — places where the dark touches the chart. Things arrive that shouldn't exist. Pages appear that no one wrote. | Then the rifts opened — cracks where the dark gets in. Things turn up that shouldn't exist. Places appear that nobody built. |
| N-02 | You are standing on one. Nova Prime. Click the world to take the helm — sound wakes with the click, so listen as you go. | You're standing in one now: Nova Prime. Click the world to take control — the sound starts with that click, so listen as you go. |
| N-02 button | Take the helm | Take control |
| N-03 | Feet first. Walk with W A S D (the arrows work too), look with the mouse, and jump with Space. The world is wide and it does not end at the fence — there is no fence. | Feet first. Walk with W A S D — the arrows work too. Look with the mouse, and jump with Space. Walk as far as you like: there is no fence, no edge, no end. |
| fight | Before the dark tests you, practice. A pale wisp waits in the meadow, east of where you woke — it cannot hurt you, and the ward still holds. | Before the dark tests you, let's practice. A pale wisp is waiting in the meadow, east of where you woke. It can't hurt you — and you're still safe here. |
| fight | Face it, walk close, and strike: click, or press F. Watch the arc of the swing and the mark where the blow lands. Two strikes write it out. | Walk up to it, face it, and strike: click, or press F. Watch your swing, and watch where the blow lands. Two hits will finish it. |
| fight | Then take up the Star Lance where it gleams nearby — a longer arm, and a heavier word, for the real dark. | Then pick up the Star Lance gleaming nearby. It reaches farther and hits harder — you'll want it for the real dark. |
| mark | Look at the ground where the wisp fell. The scar is still there — the place keeps what is written in it, whatever the light does next. | Look at the ground where the wisp fell. See the dark scar? It's still there. This place remembers every mark made in it. |
| mark | Now make a mark of your own. Aim at any block and press C — the chisel. Three strokes shape a block down and break it through, and the breaking is written where writing lasts. | Now make one of your own. Aim at any block and press C — that's your chisel. Three strokes shape a block down and break it through — and that break stays, too. |
| N-04 | Now — the numbers along the top of your keyboard are an instrument. So is the letter row beneath them. Press any number and listen. | See the number keys along the top of your keyboard? They're an instrument. The letter row under them works too. Press any number and listen. |
| N-05 | Here is the first tune worth knowing: 1 · 4 · 9. Play the three numbers, in any order, close together. | Here is the first tune worth knowing: 1, 4, 9. Play the three notes in any order, close together. |
| N-05 | It is the bridge tune. Playing it opens a rift to Ashfall Haven, a few steps ahead of you — walk through it. From there, the same tune opens the way home. *(panel; the recording still had the older "It will carry you to Ashfall Haven" wording — the found mismatch)* | That's the bridge tune. It opens a rift to Ashfall Haven, a few steps in front of you — walk through it to cross. From Ashfall, the same tune opens the way home. |
| N-06 | Ash and red rock. Every page of the chart has its own weather, its own ground, its own temper. | Ash and red rock. Every place on the map has its own weather, its own ground, its own mood. |
| N-06 | Things move in the dark here, as they do at home. Some of them you will only see in glimpses — watch for the glimpse, and strike then (click, or F). | Things move in the dark here, same as at home. Most of the time you'll only catch a glimpse of them — and that's your moment. Strike when one shows itself: click, or press F. |
| N-06 | Play 1 · 4 · 9 when you're ready to go back. | Play 1, 4, 9 when you're ready to head back. |
| N-07 | One more verb before I leave you to it: G turns down itself. Down is not a law of the world — it is a habit of the place you stand in, and the place remembers what you tell it. | One more trick before I leave you to it: press G, and down turns upside down. Down isn't a law here — each place keeps its own down, and it remembers what you set. |
| N-07 | Try it. (If you turn down up, look for the dark ceiling the rift provides — it was not there before you spoke.) | Try it. Flip down up, and a dark ceiling appears over this place to catch you — it wasn't there before you flipped. |
| gesture | One more way to travel, for the hand on the mouse: hold the RIGHT mouse button and draw a triangle in the air, then let go. The bridge tune, drawn instead of played. | One more way to travel, using the mouse: hold the right mouse button, draw a triangle in the air, and let go. That's the bridge tune, drawn instead of played. |
| gesture | A circle drawn the same way carries you home to Arrival. A diamond opens a far page. The keys still work — this is a second instrument, not a replacement. | Draw a circle the same way to go home to Arrival. Draw a diamond to open a rift to a far-off place. The number keys still work — this is just a second way to play. |
| N-08 | East of where you first woke, a hill rises over an old hall — the barrow. In its deep room lies the Deep Stone, and something keeps it. | East of where you woke up, a hill rises over an old buried hall — the barrow. Deep inside it lies the Deep Stone, and something is guarding it. |
| N-08 | Reach the stone. What you earn there is written down, and what is written down stays — while the grass and the light and the day itself are re-drawn around it. | Reach the stone, and the prize is yours for good. The grass, the light, even the day will change around it — what you've earned stays earned. |
| N-08 | Go down the shaft in the hill's top. Strike with click or F. Mind your hearts — they are your whole story, told plainly. | Climb the hill and go down the shaft in its top. Fight with click or F. And watch your hearts — when they're gone, you're carried back to where you started. |
| N-09 | The hat is yours, and it is written where writing lasts. You know the two true things now, even if you'd never say them my way: a tune is a place, and what is written outlasts what is merely shown. | The hat is yours, and it's yours for good. You know the two true things now, even if you'd never say them my way: a tune is a place, and a mark you make stays — even when everything around it changes. |
| N-09 | The rest of the chart is yours — ten more realms are named on it, quiet for now. Press M to see their names. I'll be on the line when you need me. | The rest of the map is yours. Ten more realms are marked on it, quiet for now — press M to see their names. I'll be here when you need me. |
| hint (bridge) | Play 1 · 4 · 9. | Play 1, 4, 9. |
| hint (ashfall) | Play 1 · 4 · 9 to cross home. | Play 1, 4, 9 to cross home. |
| panel header | Emise — on the chart-line | Emise — your guide |

Kept as-is (already plain): N-04's second line ("Three different notes
together make a tune. And a tune, fox, is a place."), the move/fight/
mark/numbers/gravity/gesture/quest hints not listed above, "And
then?", "Explore", "let me explore on my own".

## Event beats (spoken; each toast twin changed identically)

| Beat | Before | After |
|---|---|---|
| BEAT-arrival | Nova Prime. Emise is on the chart-line — her panel is below. | Nova Prime. I'm Emise — my panel is at the bottom of your screen. |
| BEAT-pocket | The tune lands you on a far page of the chart. | The tune lands you in a far-off place. |
| BEAT-stay | That tune is the page you are standing on. It hums, and holds. | That's this place's own tune — it hums, and you stay put. |
| BEAT-barrow | The barrow hall. Something keeps the deep room — watch for its glimpses. | The barrow hall. Something guards the deep room below — watch for its glimpses, and strike when it shows itself. |
| BEAT-quest | The Deep Stone. And with it — a hat, written down where writing lasts. | The Deep Stone — and with it, a hat. It's yours for good. |
| BEAT-strike-kill | Struck out of the world. The place keeps the scar. | It's gone. And the scar stays. |
| BEAT-guardian-kill | The guardian is struck out of the world. The hall is quiet. | The guardian is gone. The hall is quiet. |
| BEAT-death | The dark takes its due — and returns you to Arrival. Everything written stayed written. | The dark takes its due — and you wake back at Arrival. Everything you earned is still yours. |
| BEAT-fall | The chart loses your place for a moment. | The world lost track of you for a moment. |
| BEAT-contact | It reaches you out of the dark. | **Removed** from the spoken rotation and from the contact toast (feedback #24). A landed hit from an ordinary thing now cues with the damage flash + hurt sound only. The recording stays on disk so the 27-beat manifest stays intact; the game never triggers it. The guardian keeps its own spoken line. |

Kept as-is (already plain, audio untouched): BEAT-cross-ashfall,
BEAT-cross-nova, BEAT-flip-up, BEAT-flip-down, BEAT-border-up,
BEAT-border-down, BEAT-guardian-contact, BEAT-strike-hold.

## HUD

| Surface | Before | After |
|---|---|---|
| syncline, offline | the chart-line is quiet — playing from your own chart · N marks queued | can't reach the shared map — you're playing on your own · N marks waiting on this machine |
| syncline, signed in, queued | the chart-line is open — logged in · N marks queued landing | signed in — your marks are saving to the shared map · N marks waiting |
| syncline, signed in, empty | the chart-line is open — logged in · your marks land on the shared chart | signed in — your marks save to the shared map as you make them |
| syncline, not signed in | the chart-line is open — log in to save your marks to it · N marks queued on this machine | sign in to save your marks to the shared map · N marks waiting on this machine |
| ward line | 🛡 warded — until your first jump lands | 🛡 safe — nothing can hurt you until your first jump lands |
| ward line | 🛡 Arrival's ward — you cannot be hurt here | 🛡 safe here — nothing can hurt you at Arrival |
| ward toast | Arrival's ward holds — nothing can hurt you here. | You're safe here — nothing can hurt you at Arrival. |
| objective, quest done | The chart is yours. Explore. | The map is yours now. Explore. |
| objective, bridge | play the bridge tune: 1 · 4 · 9 | play the bridge tune: 1, 4, 9 |
| objective, ashfall | play 1 · 4 · 9 to cross home | play 1, 4, 9 to cross home |
| objective, gravity | press G — turn down itself | press G — flip down upside down |
| quest line, done | The Deep Stone — reached. The hat is written. | The Deep Stone — reached. The hat is yours. |

## Board & save

| Surface | Before | After |
|---|---|---|
| board intro | Ranked by what the written record can prove: crossings, pockets, strikes, marks, the day's page, the Deep Stone. | Ranked by what's on the record: crossings, strikes, marks, the place of the day, and the Deep Stone. |
| board heading | Today's page | Place of the day |
| board note, offline | the shared chart has not answered this session — global rows wait; your marks are queued, not lost | the shared map hasn't answered yet this session — no global scores to show. Your marks wait on this machine; only the newest 500 are kept |
| board note, online | read from the shared chart just now | read from the shared map just now |
| board, empty | no other foxes on the chart yet | no other foxes on the map yet |
| daily row | today's page · tune 1 · 4 · 9 from the home meadow | the place of the day · tune 1, 4, 9 from the home meadow |
| daily, empty | nobody has claimed today's page yet | nobody has found the place of the day yet |
| daily, mine | today's page claimed ✓ / today's page not yet claimed | place of the day found ✓ / place of the day not found yet |
| daily marker | · today's page ✓ | · place of the day ✓ |
| save state, offline | the chart-line is quiet: your record and queued marks live on this machine. A local copy is the save no dark line can take. | No connection right now: your record and your waiting marks live on this machine. Saving a copy locally keeps them safe. |
| save button, offline | log in to save your game (needs the line) | log in to save your game (needs a connection) |
| save state, signed in | you are logged in: your marks land on the shared chart at phext.tech as you make them. | You're signed in: your marks save to the shared map as you make them. |
| save button, signed in | logged in — saving to phext.tech | signed in — saving is on |
| save state, not signed in | you are not logged in: your marks queue on this machine. Log in to land them on the shared chart — or keep a copy locally. | You're not signed in: your marks are waiting on this machine — only the newest 500 are kept. Sign in to save them to the shared map, or save a copy locally. |
| save note, copy saved | a copy is yours — it holds your name, your record, and every queued mark. Load it from this panel on any machine. | Saved. The copy holds your name, your record, and every waiting mark. You can load it from this panel on any machine. |
| save note, already in | you are logged in — your marks land on the shared chart as you make them. | you're signed in — your marks save to the shared map as you make them. |
| save note, signing in | taking you to phext.tech to sign in — your record and queued marks stay on this machine and land when you return. | taking you to sign in — your record and waiting marks stay on this machine and save when you get back. |

The offline board note and the not-signed-in save state now state the
500-mark cap plainly — the old "your marks are queued, not lost" was
false past the cap (UPDATE-CHECK-1) and is gone.

## Start screen / help / realms / misc

| Surface | Before | After |
|---|---|---|
| help, gestures | …or diamond (far page) | …or diamond (far-off place) |
| help, keys | G turn down · click / F strike · C chisel (shape the world by degrees) · B the board · M the chart of realms · L the written record | G flip down · click / F strike · C chisel (shape a block) · B the board · M the map of realms · L your log |
| help, footer | the shared chart is kept at phext.tech — saving there takes a phext.tech login, or save a copy locally from the board (B); offline, your marks queue on this machine | your marks can save to a map all foxes share — sign in from the board (B) to save there, or save a copy on this machine from the same panel; offline, your marks wait here |
| realms title | The chart of realms | The map of realms |
| realms intro | Eleven pages are named. Two are open. The bridge tune — 1 · 4 · 9 — walks between the open ones. | Eleven realms are named. Two are open. The bridge tune — 1, 4, 9 — travels between the open ones. |
| realm status, open | open — the bridge tune knows it | open — the bridge tune goes there |
| realm status, shut | named, and quiet — not yet open | named, but not open yet |
| guardian intro | it has kept the stone a long time — strikes write it out | it has guarded the stone a long time — strike it down |
| daily toast | The day's page is reached — the daily board remembers. | You found the place of the day — it's on the board. |
| rift toast | A rift opens — a far page of this world. Walk through. | A rift opens — a far-off place in this world. Walk through. |
| gesture toast | The drawn bridge. Your hand played 1 · 4 · 9. | You drew the bridge tune: 1, 4, 9. |
| gesture toast | The drawn diamond. A far page answers. | You drew a diamond — a far-off place answers. |
| wisp kill toast | Written out. That is the whole of fighting: be close, be faced, strike when it shows. | That's fighting, start to finish: get close, face it, strike when it shows itself. |
| chisel popup | broken through — and written | broken through — for good |
| Star Lance blurb | a longer arm, and a heavier word | it reaches farther and hits harder |

## Re-record list (18 beats, all re-synthesized and verified by format)

N-01 (11.09 s) · N-02 (13.68 s) · N-03 (8.78 s) · N-04 (11.09 s) ·
N-05 (13.94 s) · N-06 (16.61 s) · N-07 (14.21 s) · N-08 (23.38 s) ·
N-09 (17.76 s) · BEAT-arrival (3.31 s) · BEAT-pocket (2.04 s) ·
BEAT-stay (3.19 s) · BEAT-barrow (5.45 s) · BEAT-quest (3.82 s) ·
BEAT-strike-kill (2.09 s) · BEAT-guardian-kill (2.69 s) ·
BEAT-death (4.82 s) · BEAT-fall (1.87 s).
New totals: 27 beats, 181.6 s, 1,454,055 bytes (MANIFEST.md updated).
Original recordings backed up before replacement (session /tmp only).

## Audio gaps

**None.** Every changed spoken line was re-recorded through the
original pipeline, so no shipped line's text and audio disagree. The
fight, mark, and gesture guide steps remain text-only, exactly as
before (they never had recordings).

## Out of scope, deliberately untouched

- The demo readout panel (L) — Will's instrumentation, labeled
  "not in-fiction" on its face; its log strings are not player dialog.
- Code comments and backend configuration (URLs, the shared-world
  name) — functional machinery, never displayed.
- 8 event beats whose lines were already plain English.
