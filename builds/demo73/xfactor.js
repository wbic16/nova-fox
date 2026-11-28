// ---------- the X factor (EE 1350): the game-surface half ------------
// X-FACTOR-DESIGN.md sections 4 + 5.4(c), as ruled at EE ~1333
// (recorded EE 1339): activation = all 520 placed people including
// exiles (D-1); OG = strict mutual with first_contact prior to 2025
// (D-2, OG = 443); 2x ONLY at generator accrual + the daily prize
// (D-5 stands); X-login only (D-6 stands); unknown-era rows receive
// the grant with the tier unresolved — their multiplier reads 1
// (D-3 carried open, never invented past).
//
// The gateway half is LIVE (EE 1340): POST /api/v2/xfactor performs
// the check-and-set grant and its answer IS the session read-back
// for the X factor — status, og, halo, credit_multiplier, and the
// welcome state. This module is the client half: pure logic, no
// DOM, no storage, no clock, no network — exactly like economy.js /
// collectibles.js. The game glue (game3.js) owns the fetch, the
// toast, and the board; tests drive this file directly.
//
// The multiplier is READ from the read-back's credit_multiplier
// field, never computed here from og, the registry, or any other
// data: the gateway is the tier judge, the client is its reader.

// ---------- the welcome copy (design section 4, DRAFT — D-8) -----------
// The gateway carries this text in every answer that carries a
// welcome (marked DRAFT in the gateway's own record — a record
// annotation, never player copy: nothing in this module or on the
// game surface ever renders the word DRAFT to the player). These
// constants are the of-record text the read-back carries, kept so
// the pins can hold the surface to the gateway's exact words; the
// surface renders the READ-BACK's text, not these literals.
export const XF_COPY_LINE = "Yours — a gift of the wavefront.";
export const XF_BEAT_TEXT = "There you are. You were in the sky before there was a game — the fox kept your place. Nova Fox is yours. It always was.";
export const XF_BEAT_TEXT_OG = "There you are. You were in the sky before there was a game — the fox kept your place. Nova Fox is yours. It always was. And you answered back when it was only noise. The halo is lit for you on the wiki.";

// ---------- the session read-back ---------------------------------------
// The gateway's xfactor answer (gateway.py, EE 1339):
//   { ok: true, status: "granted" | "already-granted" |
//     "already-bought" | "no-match" | "not-grantable",
//     og: true | false | "unknown-era", halo: bool,
//     credit_multiplier: 2 | 1,
//     welcome: null | { state: "beat", beat: true, beat_text,
//                       copy_line, text_status }
//                    | { state: "standing", beat: false, copy_line,
//                        text_status },
//     sales_count, sales_revenue, granted_count, ... }
// welcome.state is the fresh-grant distinction: "beat" ONLY on the
// granting login; "standing" on every later granted login. That is
// what makes the welcome exactly-once without any client-side
// memory of past logins — the client trusts the gateway's state,
// never a local "has a grant" guess.
export function parseXFactorAnswer(data) {
  if (!data || typeof data !== "object" || data.ok !== true) return null;
  if (typeof data.status !== "string" || !data.status) return null;
  let welcome = null;
  const w = data.welcome;
  if (w && typeof w === "object" && (w.state === "beat" || w.state === "standing")) {
    welcome = {
      state: w.state,
      beat: w.beat === true,
      beatText: typeof w.beat_text === "string" ? w.beat_text : "",
      copyLine: typeof w.copy_line === "string" ? w.copy_line : "",
    };
  }
  return {
    status: data.status,
    // og rides as true | false | "unknown-era"; only strict true is
    // the OG tier here — unknown-era is unresolved, not OG (D-3).
    og: data.og === true,
    ogRaw: data.og,
    halo: data.halo === true,
    // The multiplier is the read-back's own field. Anything that is
    // not the gateway's 2 reads 1 — including a missing field.
    creditMultiplier: data.credit_multiplier === 2 ? 2 : 1,
    welcome,
  };
}

// ---------- the client state ---------------------------------------------
// The cached view of the session's X-factor state. Before any
// answer lands (signed out, free play, gateway silent) the state
// is the no-grant state: multiplier 1, no welcome, no copy line —
// the design does not advertise the entitlement to the excluded
// (design section 2 step 7), and a silent gateway grants nothing.
export function newXFactorState() {
  return {
    status: null,          // the gateway's status word, once answered
    og: false,
    halo: false,
    creditMultiplier: 1,
    welcome: null,         // { state, beat, beatText, copyLine }
    beatPlayed: false,     // this boot has rendered the beat
  };
}

// Fold one gateway answer into the view. Returns what the surface
// must do NOW: { beatText, copyLine } — beatText is the welcome
// beat to render, non-null EXACTLY ONCE per granting login: only
// when the answer's welcome state is "beat" (the gateway's fresh-
// grant word) and this boot has not already rendered it. A
// "standing" answer, a replayed "beat" answer in the same boot, a
// no-match, and a malformed answer all render no beat. An answer
// that does not parse leaves the view untouched.
export function applyXFactorAnswer(state, data) {
  const parsed = parseXFactorAnswer(data);
  if (!parsed) return { beatText: null, copyLine: xWelcomeCopyLine(state) };
  state.status = parsed.status;
  state.og = parsed.og;
  state.halo = parsed.halo;
  state.creditMultiplier = parsed.creditMultiplier;
  state.welcome = parsed.welcome;
  let beatText = null;
  if (parsed.welcome && parsed.welcome.state === "beat" &&
      parsed.welcome.beat && parsed.welcome.beatText && !state.beatPlayed) {
    beatText = parsed.welcome.beatText;
    state.beatPlayed = true;
  }
  return { beatText, copyLine: xWelcomeCopyLine(state) };
}

// The status board's copy line, as standing state: present for a
// granted player (fresh grant and every later login alike), absent
// for everyone else — no-match, not-grantable, signed-out, and
// not-yet-answered sessions all read "".
export function xWelcomeCopyLine(state) {
  if (!state || !state.welcome || !state.welcome.copyLine) return "";
  return state.welcome.copyLine;
}

// Every string the game surface renders from the X-factor state —
// the board copy line, plus the welcome beat while it stands
// unplayed. The halo flag contributes NOTHING: there is no wiki
// profile surface in the game and the game renders no mark, ring,
// or line for halo (design section 5.4(b) — the flag is data-only
// in this leg; the wiki halo is F-GAME-25, parked). Two states
// differing only in halo render identically; the pins hold that.
export function xGameSurfaceStrings(state) {
  const out = [];
  if (!state) return out;
  if (state.welcome && state.welcome.state === "beat" &&
      state.welcome.beat && state.welcome.beatText && !state.beatPlayed) {
    out.push(state.welcome.beatText);
  }
  const line = xWelcomeCopyLine(state);
  if (line) out.push(line);
  return out;
}
