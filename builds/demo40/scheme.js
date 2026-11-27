// ---------- control schemes: WASD / AWEF (demo19) -------------------
// Pure scheme logic, unit-tested in test3.mjs: which scheme a player
// gets, and which N-03 narration variant speaks for it. The browser
// glue (localStorage reads/writes, the toggle buttons) lives in
// game3.js; everything decidable lives here.
//
// Resolution order (Will, 2026-11-26 16:17 CST — a stored preference
// the player can set, so the game gives him his scheme on his own
// machine every time):
//   1. the stored preference: localStorage "nf.scheme" = 'wasd'|'awef'
//   2. the scheme already recorded on this machine by the v5 controls
//      record (nova-phox-controls) — a choice made there carries over
//      instead of being re-flipped away
//   3. the coin flip Will ruled for first play (2026-11-26 15:07):
//      half of all players walk WASD, half AWEF
// Whatever resolves is written back to both stores by the glue, so
// the flip happens at most once per browser and the scheme is stable
// across sessions on that browser. A corrupt stored value is not an
// error: it falls through to the next source and is overwritten by
// the resolved scheme.

export const SCHEME_PREF_KEY = "nf.scheme";

// The stored preference's shape: 'wasd' | 'awef'. Returns the game's
// scheme name ("WASD" | "AWEF"), or null for anything else — missing,
// corrupt, or not a string at all.
export function schemeFromPref(raw) {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "wasd") return "WASD";
  if (v === "awef") return "AWEF";
  return null;
}

// The v5 controls record stores the scheme in game dress already;
// anything that is not exactly one of the two names is not a scheme.
export function schemeFromLegacy(raw) {
  return raw === "WASD" || raw === "AWEF" ? raw : null;
}

export function isScheme(s) {
  return s === "WASD" || s === "AWEF";
}

export function otherScheme(s) {
  return s === "AWEF" ? "WASD" : "AWEF";
}

// What gets written back to nf.scheme for a resolved scheme.
export function prefForScheme(s) {
  return s === "AWEF" ? "awef" : "wasd";
}

// resolveScheme({ pref, legacy, flip }) -> { scheme, source }
//   pref:   the raw nf.scheme value (anything; validated here)
//   legacy: the v5 controls record's scheme field (anything)
//   flip:   () -> "WASD" | "AWEF", the coin flip; called only when
//           neither stored source yields a scheme. A flip that
//           returns garbage resolves to WASD rather than crashing.
export function resolveScheme({ pref, legacy, flip }) {
  const fromPref = schemeFromPref(pref);
  if (fromPref) return { scheme: fromPref, source: "pref" };
  const fromLegacy = schemeFromLegacy(legacy);
  if (fromLegacy) return { scheme: fromLegacy, source: "legacy" };
  const flipped = typeof flip === "function" ? flip() : null;
  return { scheme: isScheme(flipped) ? flipped : "WASD", source: "flip" };
}

// The N-03 variant that speaks for a scheme: the per-scheme
// recordings (N-03-WASD / N-03-AWEF — Joy's takes, embedded by
// build3.py from the Joy set) when the build carries them, the
// single shared N-03 otherwise.
export function schemeBeatId(scheme, has) {
  const variant = scheme === "AWEF" ? "N-03-AWEF" : "N-03-WASD";
  return typeof has === "function" && has(variant) ? variant : "N-03";
}
