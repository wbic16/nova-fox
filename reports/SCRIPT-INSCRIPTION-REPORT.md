# Script inscription report — Nova Fox final narration (EE 959)

**Done:** the final reviewed script is inscribed at
`~/workspace/nova-fox/integration/NARRATION.md`, replacing the old
Emise chart-keeper script in the integration tree.
sha256: `4892580ffd152f0a7c28a7b7902c4413f8853d1a23abb323bb7a66e536930be8`
(8,414 B; was 6,554 B).

## Line counts

- **Guided opening:** 10 spoken entries — N-01…N-09, with N-03
  carried in both control-scheme variants (WASD + AWEF,
  coin-flip assignment per player).
  - Will-authored: N-01, N-04, N-07, N-08, N-09 (5)
  - Approved rewords: N-02, N-03 (both variants), N-05, N-06 (4 IDs, 5 texts)
- **Event beats:** 18 IDs — 15 spoken, 2 silent, 1 retired.
  - Spoken, all Will-authored: BEAT-arrival, BEAT-cross-ashfall,
    BEAT-cross-nova, BEAT-pocket, BEAT-stay, BEAT-flip-up,
    BEAT-flip-down, BEAT-border-up, BEAT-barrow, BEAT-quest,
    BEAT-guardian-contact, BEAT-strike-kill, BEAT-guardian-kill,
    BEAT-death, BEAT-fall
  - Silent (marked, with Will's ruling and date): BEAT-border-down
    (no line in the normal case), BEAT-strike-hold (no dialogue)
  - Retired, recording kept, note carried over unchanged:
    BEAT-contact
- **Total spoken texts to record: 25** (10 opening + 15 beats).
  No audio was recorded — Joy's voice is Will's pending decision.

## Verbatim verification

22 of the 25 spoken texts were machine-checked character-for-
character against `~/memory/2026-11-26.md`: all present in both
the note and the inscribed file, 0 mismatches. Header and context
notes were rewritten for Joy (the aperture shift) and the final
world facts: the barrow → the Unexpected Hall; the Deep Stone → a
piece of Nova Prime's Heart (the Nova Heart, in pieces across the
multiverse); the guardian → the Shadow, weak point the Heart;
finding a piece unlocks a Bundle; pieces return to Home Base to
rebuild Nova Prime; gravity per-realm, one swap per day.

## Ambiguities flagged (not guessed)

1. **N-02, N-03 WASD, N-03 AWEF — provenance.** The dated note
   records these only as "approved as reworded" / by design
   description; it does not quote them. Their verbatim texts were
   recovered from the main-chat record (the 15:04 CST reword
   message, seq 285401, and the 15:06 CST AWEF variant, seq
   285443) and inscribed from there. If Will wants the note to be
   the sole source, those three texts should be quoted into it.
2. **BEAT-guardian-kill's "(Winds of Change)"** sits inside Will's
   verbatim line in the note. It reads like a sound/stage cue but
   is inscribed as part of the line exactly as recorded; the
   recording pass will need Will's word on whether it is spoken.
3. **N-03 file naming.** Both variants share the beat ID `N-03`
   under the one-file-per-ID convention (`narration/<id>.mp3`).
   The recording/build pass will need a variant suffix or two IDs;
   not decided here.
4. **Spaced hyphens preserved.** N-04 and BEAT-quest use " - "
   where other lines use "—"; kept exactly as Will wrote them,
   per the note-wins rule.

## Build / test status

`NARRATION.md` is **not a build input**: `build3.py` embeds audio
from `../narration-audio/*.mp3` (the 2026-11-22 recordings of the
superseded script), never the .md. The inscription therefore
cannot break the build; the tree's unit suite was run anyway and
passes at baseline: **210 passed, 0 failed** (`node test3.mjs`,
integration tree, after the write). Nothing staged or deployed.
