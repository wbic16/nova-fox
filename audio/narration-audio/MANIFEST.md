# Nova Phox narration audio — manifest

Recorded 2026-11-22 from `~/workspace/nova-fox/demo2/NARRATION.md`.
Re-recorded in part 2026-11-22 (dialog v5 pass, feedback #26): every
beat whose words changed was re-synthesized from the rewritten
`~/workspace/nova-fox/demo3/NARRATION.md` through the same route —
Aria (Emise's standing voice), speed 120%, English, MP3.
One file per beat ID; filenames match the beat IDs in NARRATION.md exactly.
The v3 build wires playback by beat ID from this table.

**Totals: 27 beats recorded, 0 failed, 181.6 s of audio, 1,454,055 bytes of MP3.**

## Guided opening

| Beat ID | File | Duration | First line |
|---|---|---|---|
| N-01 | N-01.mp3 | 11.09 s | Wake up, fox. |
| N-02 | N-02.mp3 | 13.68 s | Then the rifts opened — cracks where the dark gets in. |
| N-03 | N-03.mp3 | 8.78 s | Feet first. |
| N-04 | N-04.mp3 | 11.09 s | See the number keys along the top of your keyboard? |
| N-05 | N-05.mp3 | 13.94 s | Here is the first tune worth knowing: 1, 4, 9. |
| N-06 | N-06.mp3 | 16.61 s | Ash and red rock. |
| N-07 | N-07.mp3 | 14.21 s | One more trick before I leave you to it: press G, and down turns upside down. |
| N-08 | N-08.mp3 | 23.38 s | East of where you woke up, a hill rises over an old buried hall — the barrow. |
| N-09 | N-09.mp3 | 17.76 s | The hat is yours, and it's yours for good. |

## Event beats

| Beat ID | File | Duration | First line |
|---|---|---|---|
| BEAT-arrival | BEAT-arrival.mp3 | 3.31 s | Nova Prime. I'm Emise — my panel is at the bottom of your screen. |
| BEAT-cross-ashfall | BEAT-cross-ashfall.mp3 | 4.39 s | Ashfall Haven. The air tastes of cinders; the rock remembers fire. |
| BEAT-cross-nova | BEAT-cross-nova.mp3 | 3.14 s | Nova Prime. Home meadow, green under a kind sky. |
| BEAT-pocket | BEAT-pocket.mp3 | 2.04 s | The tune lands you in a far-off place. |
| BEAT-stay | BEAT-stay.mp3 | 3.19 s | That's this place's own tune — it hums, and you stay put. |
| BEAT-flip-up | BEAT-flip-up.mp3 | 2.16 s | Down is up. The place remembers. |
| BEAT-flip-down | BEAT-flip-down.mp3 | 2.28 s | Down is down. The place remembers. |
| BEAT-border-up | BEAT-border-up.mp3 | 1.94 s | Down is up here. The place says so. |
| BEAT-border-down | BEAT-border-down.mp3 | 1.56 s | Down is down again here. |
| BEAT-barrow | BEAT-barrow.mp3 | 5.45 s | The barrow hall. Something guards the deep room below. |
| BEAT-quest | BEAT-quest.mp3 | 3.82 s | The Deep Stone — and with it, a hat. It's yours for good. |
| BEAT-contact | BEAT-contact.mp3 | 1.58 s | It reaches you out of the dark. (RETIRED — kept on disk, never triggered) |
| BEAT-guardian-contact | BEAT-guardian-contact.mp3 | 3.24 s | The guardian reaches you. Strike it back — click, or F. |
| BEAT-strike-hold | BEAT-strike-hold.mp3 | 1.51 s | It holds. Strike again. |
| BEAT-strike-kill | BEAT-strike-kill.mp3 | 2.09 s | It's gone. And the scar stays. |
| BEAT-guardian-kill | BEAT-guardian-kill.mp3 | 2.69 s | The guardian is gone. The hall is quiet. |
| BEAT-death | BEAT-death.mp3 | 4.82 s | The dark takes its due — and you wake back at Arrival. |
| BEAT-fall | BEAT-fall.mp3 | 1.87 s | The world lost track of you for a moment. |

## Non-spoken material in NARRATION.md (not recorded)

- The header/delivery-notes block (stage directions for the recording session; no beat ID).
- "The two true things (the +1 phext XP, stated once, here only)" — design rationale explaining the two lessons the guided opening teaches by doing. It carries no beat ID and is explicitly not a spoken line ("the narration never lectures them"), so no audio was recorded for it.

## Retired beats

- **BEAT-contact** — retired from the spoken rotation 2026-11-22 (feedback #24: the repeated contact clip "should just be a noise"). The file is kept so the 27-beat set stays intact; the game never triggers it. Contact now cues with the damage flash and the hurt sound only.

## Recording notes

- Script text was synthesized verbatim — no words rewritten, added, or removed.
- The v5 rewrite also fixed a pre-existing mismatch: the shipped build's N-05 panel text (rift wording, from the playtest pass) had diverged from the recorded script; panel text and audio agree again.
- Pronunciation-sensitive spots, passed as written and **not ear-verified**: the chord in N-05 and N-06 is now written "1, 4, 9" (commas) so it reads as numbers; N-03 spells the keys "W A S D"; single-letter key references (G, F, M) appear in N-06, N-07, N-08, N-09, and BEAT-guardian-contact. Durations and byte sizes are in line with the surrounding lines, but if the letter names render oddly, those beats may need a respelled re-record — flagged here rather than silently edited.
