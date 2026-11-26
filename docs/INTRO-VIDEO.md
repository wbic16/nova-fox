# INTRO VIDEO — state of the film, and what mass market needs

Program task: 27.7.6/9.8.9/7.8.13 · 2026-11-24.
Verified this pass against the artifact itself (ffprobe + sha256),
not only the reports.

## The film as it stands

- **File:** `~/workspace/nova-fox/video/phext-intro.mp4` —
  **1,018,136 bytes, sha256
  `fccd46bbbab4e39e21580663b3c488c0c9628520f9cd173c9d1b2ee4727c3b39`**
  (computed this pass).
- **Specs (ffprobe):** H.264, **854×480, 24 fps, exactly 15.0 s,
  silent** (no audio stream). Poster:
  `video/phext-intro-poster.png` (47,290 bytes).
- **Provenance (V5-REPORT §Item 14):** the intro of record is the
  phext intro prepass — a downloads.phext RECORD-ONLY pin (sha256
  `e831f544…`, ~68 MB assembled original; the media bytes were
  never in any repo). The shipped web film was **reassembled from
  the prepass's own 360 frames** (854×480 @ 24 fps, seed 20261122;
  all 360 frames verified present this pass in
  `video/intro-prepass-work/frames/`) with ffmpeg, plus the poster
  frame. It is the same video, re-encoded for the web — not a
  substitute and not a placeholder.
- **In the game:** embedded in the single-file build by
  `demo3/build3.py`. It plays through a **standing stone memory
  screen west of Arrival, facing the waking fox** — poster on its
  face; click within reach and the film opens in a viewer:
  poster-first, `preload="none"`, click-to-play, closable any time
  (button, backdrop, Esc). E2E-verified in both the v5 and portals
  builds. Because the prepass is silent, nothing autoplays with
  sound — there is no sound to autoplay.
- **What it is:** an **emblem film** — the phext lattice mark,
  drawn and lit. It is *not* a story film: Scenes 1–3 of
  STORYBOARD.md (conquest, the dark, the first rift) are not in
  it, and it shows no gameplay.

## What mass-market readiness needs beyond it

1. **A listing trailer (the real gap).** Gumroad buyers decide
   from the product page. The 15-second emblem film can serve as
   the page's cover video today — it is small, loopable, and
   honest — but it sells a mark, not a game. Draft plan: cut a
   30–45 s trailer from **gameplay capture** (waking at Arrival,
   the crossing through a live portal view, a gravity flip, the
   Deep Room) with the emblem film as its head and tail. The
   storyboard is the shot list (Scenes 4–8 are all in the game).
2. **Resolution honesty.** The film is 854×480 because its frames
   are. A "1080p" version would be an upscale, and would be
   labelled as such or not made (the false-demo rule). A native
   re-render means re-running the prepass at higher resolution —
   a ranch render job, scoped if Will wants it.
3. **Sound.** The film is silent by inheritance. Options, Will's
   pick: keep it silent in-game (it is a memory screen; silence
   is defensible and shipped); for the trailer, the game's own
   chip-tune voice + Emise's narration beats exist and can score
   the cut without new recording.
4. **Captions.** Nothing is spoken in the film, so there is
   nothing to caption in it. Any narrated trailer inherits the
   narration script as its caption track — cheap, and should be
   done when the trailer is cut.
5. **The poster already works.** The poster frame is the natural
   Gumroad cover image and the in-game screen's face; no new
   still is needed for launch.
6. **No change needed in-game.** The memory-screen placement,
   click-to-play, and closability are the right shape for a
   mass-market build (nothing autoplays, nothing traps). The
   film's in-game job — a relic of the civilization that sent
   you, found in its first clearing — is already the fiction's
   own framing.

*State verified by Emise, 2026-11-24: file present, hash and
specs measured, frames counted, in-game wiring per V5-REPORT and
PORTALS-PALETTES-REPORT e2e records.*
