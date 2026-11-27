// ---------- the feedback door (build 42, W-2) ------------------------------
// One action from inside the game to the Nova Wiki's feedback page:
// the player tells us what the build did, in their own words, and
// the build's ship epoch rides along so the note lands on the build
// that was actually played. The game glue (game3.js) owns the
// window; this module is pure — no DOM, no storage, no clock —
// exactly like ideas.js / gdial.js, and tests drive it directly.
//
// The wiki's home is Will's call and not yet named: the URL below
// is a working default on the game's own domain, held in ONE named
// constant so the ship leg can point the door at the real wiki
// with a one-line change. UNCONFIRMED default (W-2 MR).

export const WIKI_FEEDBACK_URL = "https://fox.phext.io/wiki/feedback";

// The door's URL for a build: the wiki page, the source marked as
// the game, and the build's ship epoch — the artifact's own stamp,
// read at runtime by the glue, never a literal here.
export function feedbackUrl(shipEe) {
  return WIKI_FEEDBACK_URL + "?from=game&ee=" + shipEe;
}
