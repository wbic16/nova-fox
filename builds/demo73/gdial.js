// ---------- the gravity dial (build 42, Grok/xAI lane) --------------------
// Will: the dial is a microcosm of subspace. Players key Morse to
// choose their next coordinate. Magnitude and frequency both move
// once the dial's full range is unlocked. The unlock is the flight
// gate's own rule — a paid Gumroad license (entitlement, the
// purchase scroll 1.1.1/1.1.3/1.1.1) or the dragon-kill flag.
// S.O.S (... --- ...) brings the fox home.
//
// This file is pure: no DOM, no localStorage, no clock of its own.
// The game glue owns persistence, the scroll, and the sound. Tests
// drive the functions directly, the way they drive world.js.
//
// The shared chart stays append-only. Direction shifts keep the
// grav| line on 1.1.1/1.1.5/1.1.1. The dial's own instrument
// (magnitude stop, frequency stop) appends gdial| lines to that
// same scroll — gravity's scroll, gravity's owner. A gdial line
// never changes a realm's shared down. Latest line per player per
// realm is that fox's instrument. Free foxes do not write one.

export const GRAV_BASE = 23; // the shipped pull, units/s^2
export const TERM_BASE = 26; // the shipped terminal speed
export const FREQ_RIPPLE = 0.08; // the hum breathes the pull by this much
export const FREE_MAG = 2; // Standard — the free dial's only magnitude
export const FREE_FREQ = 0; // Still — the free dial's only frequency
export const WRITE_GAP_MS = 12000; // gateway discipline once the daily cap lifts
export const LETTER_GAP_MS = 700;
export const TAP_DASH_MS = 360; // at or above this, a tap is a dash
export const JOY_CUE_GAP_MS = 20000;
export const MORSE_LS_KEY = "nova-phox-morse-deck";
export const DIAL_LS_KEY = "nova-phox-dial";
export const SOS_PATTERN = "... --- ...";
export const HOME_REALM = "nova";
export const HOME_ARRIVAL = { x: 8, z: 8 };

// Five named stops. Free play sits on Standard and does not leave
// it. Paid (or the dragon) may set any stop. Terminal speed scales
// with magnitude so a light world also lands softly.
export const MAG_STOPS = Object.freeze([
  Object.freeze({ id: "float", name: "Float", mul: 0.25 }),
  Object.freeze({ id: "light", name: "Light", mul: 0.5 }),
  Object.freeze({ id: "standard", name: "Standard", mul: 1 }),
  Object.freeze({ id: "heavy", name: "Heavy", mul: 1.5 }),
  Object.freeze({ id: "crushing", name: "Crushing", mul: 2 }),
]);
// Frequency is the hum of the pull, and the dial's pitch band.
// Still is silent — no ripple. The others breathe GRAV_BASE.
export const FREQ_STOPS = Object.freeze([
  Object.freeze({ id: "still", name: "Still", hz: 0 }),
  Object.freeze({ id: "slow", name: "Slow", hz: 0.5 }),
  Object.freeze({ id: "pulse", name: "Pulse", hz: 1 }),
  Object.freeze({ id: "bright", name: "Bright", hz: 2 }),
  Object.freeze({ id: "keen", name: "Keen", hz: 4 }),
]);

// The eleven realms, copied from world.js REALMS so this module
// stays free of imports (the build concatenates sources). Tests
// pin these coordinates against world.js so the two cannot drift.
// `call` is the one-letter Morse address. O is not a call: O is
// the middle of S.O.S, and Orchid answers to R.
export const DIAL_REALMS = Object.freeze([
  Object.freeze({ id: "nova", name: "Nova Prime", call: "N", coord: Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1]) }),
  Object.freeze({ id: "ashfall", name: "Ashfall Haven", call: "A", coord: Object.freeze([10, 10, 1, 1, 1, 1, 1, 10, 10]) }),
  Object.freeze({ id: "ni-knight", name: "Ni-Knight", call: "K", coord: Object.freeze([10, 10, 2, 1, 1, 1, 1, 10, 10]) }),
  Object.freeze({ id: "logos", name: "Logos Prime", call: "L", coord: Object.freeze([10, 10, 3, 1, 1, 1, 1, 10, 10]) }),
  Object.freeze({ id: "elven", name: "Elven Path", call: "E", coord: Object.freeze([10, 1, 1, 1, 2, 1, 1, 10, 1]) }),
  Object.freeze({ id: "orchid", name: "Orchid Flow", call: "R", coord: Object.freeze([1, 10, 1, 1, 2, 1, 1, 10, 1]) }),
  Object.freeze({ id: "halycon", name: "Halycon Vector", call: "H", coord: Object.freeze([2, 10, 1, 1, 2, 1, 1, 10, 1]) }),
  Object.freeze({ id: "delta", name: "Delta Wood", call: "D", coord: Object.freeze([3, 10, 1, 1, 2, 1, 1, 10, 1]) }),
  Object.freeze({ id: "willow", name: "Best Willow", call: "W", coord: Object.freeze([90, 1, 1, 1, 1, 1, 1, 1, 1]) }),
  Object.freeze({ id: "plain", name: "Plain View", call: "P", coord: Object.freeze([3, 1, 1, 1, 1, 1, 7, 7, 7]) }),
  Object.freeze({ id: "trust", name: "Trust Fall", call: "T", coord: Object.freeze([7, 1, 1, 1, 1, 1, 1, 1, 1]) }),
]);

const CALL_BY_LETTER = new Map(DIAL_REALMS.map((r) => [r.call, r]));

// ---------- International Morse, A–Z and 0–9 (ITU) ------------------------

export const MORSE = Object.freeze({
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
  G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
  M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
  S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-",
  5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
});

// Curriculum order: S and O first (they spell home), then the rest
// of the alphabet, then the digits. All 36 live in the deck.
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
export const MORSE_ORDER = Object.freeze([
  "S", "O",
  ...[...LETTERS].filter((c) => c !== "S" && c !== "O"),
  ...[...DIGITS],
]);
export const MORSE_COUNT = MORSE_ORDER.length;

const PATTERN_TO_SYMBOL = new Map();
for (const sym of MORSE_ORDER) PATTERN_TO_SYMBOL.set(MORSE[sym], sym);

export function encodeMorse(text) {
  const symbols = [...String(text).toUpperCase()].filter((ch) => ch !== " ");
  if (!symbols.length) return null;
  const parts = [];
  for (const ch of symbols) {
    const pat = MORSE[ch];
    if (!pat) return null;
    parts.push(pat);
  }
  return parts.join(" ");
}

export function encodeCoord(coord) {
  if (!Array.isArray(coord) || !coord.length) return null;
  const words = [];
  for (const n of coord) {
    if (!Number.isInteger(n) || n < 0) return null;
    const w = encodeMorse(String(n));
    if (!w) return null;
    words.push(w);
  }
  return words.join(" / ");
}

// pattern: letters separated by a single space, words by " / ".
// Unknown marks fail the whole read — the dial never guesses.
export function decodeMorse(pattern) {
  if (pattern == null) return null;
  const raw = String(pattern).trim();
  if (!raw) return null;
  const words = raw.split(/\s+\/\s+/);
  const letters = [];
  const wordTexts = [];
  for (const word of words) {
    const parts = word.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return null;
    let built = "";
    for (const p of parts) {
      if (!/^[.\-]+$/.test(p)) return null;
      const sym = PATTERN_TO_SYMBOL.get(p);
      if (!sym) return null;
      letters.push(sym);
      built += sym;
    }
    wordTexts.push(built);
  }
  return { text: wordTexts.join(""), words: wordTexts, letters };
}

export function isSos(pattern) {
  const d = decodeMorse(pattern);
  return !!(d && d.words.length === 1 && d.words[0] === "SOS");
}

export function classifyTap(downMs) {
  if (!(downMs >= 0) || !Number.isFinite(downMs)) return null;
  return downMs >= TAP_DASH_MS ? "-" : ".";
}

export function appendElement(pattern, el) {
  if (el !== "." && el !== "-") return String(pattern || "");
  return String(pattern || "") + el;
}

export function appendLetterGap(pattern) {
  const p = String(pattern || "");
  if (!p || /[\s/]$/.test(p)) return p;
  return p + " ";
}

export function appendWordGap(pattern) {
  const p = String(pattern || "").replace(/[\s/]+$/, "");
  if (!p) return "";
  return p + " / ";
}

// A pause between taps, longer than a letter, opens the letter gap
// before the new mark lands. The first mark of a pattern never gaps.
export function applyTap(pattern, el, sinceLastMs, letterGapMs = LETTER_GAP_MS) {
  let p = String(pattern || "");
  if (p && sinceLastMs >= letterGapMs) p = appendLetterGap(p);
  return appendElement(p, el);
}

function realmByCoord(coord) {
  return DIAL_REALMS.find((r) => r.coord.length === coord.length && r.coord.every((v, i) => v === coord[i])) || null;
}

// What a locked pattern means.
//   home  — the word SOS. Nova Prime, the arrival pad.
//   realm — one call letter.
//   coord — nine number-words matching a realm's subspace coordinate.
//   mag   — Q and a digit 1–5 (Float … Crushing).
//   freq  — Y and a digit 1–5 (Still … Keen).
export function interpretLock(pattern) {
  const decoded = decodeMorse(pattern);
  if (!decoded) return { ok: false, reason: pattern && String(pattern).trim() ? "garbled" : "empty" };
  const word = decoded.words.length === 1 ? decoded.words[0] : null;
  if (word === "SOS") {
    const home = DIAL_REALMS[0];
    return {
      ok: true, kind: "home", realmId: HOME_REALM, name: home.name,
      coord: [...home.coord], arrival: { ...HOME_ARRIVAL }, text: "SOS",
    };
  }
  if (word && word.length === 1 && CALL_BY_LETTER.has(word)) {
    const r = CALL_BY_LETTER.get(word);
    return {
      ok: true, kind: "realm", realmId: r.id, name: r.name, call: r.call,
      coord: [...r.coord], arrival: { ...HOME_ARRIVAL }, text: word,
    };
  }
  if (word && /^Q[1-5]$/.test(word)) {
    return { ok: true, kind: "mag", index: Number(word[1]) - 1, text: word };
  }
  if (word && /^Y[1-5]$/.test(word)) {
    return { ok: true, kind: "freq", index: Number(word[1]) - 1, text: word };
  }
  if (decoded.words.length === 9 && decoded.words.every((w) => /^\d+$/.test(w))) {
    const coord = decoded.words.map((w) => Number(w));
    const r = realmByCoord(coord);
    if (!r) return { ok: false, reason: "unknown-coord", coord, text: decoded.text };
    return {
      ok: true, kind: "coord", realmId: r.id, name: r.name,
      coord: [...r.coord], arrival: { ...HOME_ARRIVAL }, text: decoded.text,
    };
  }
  return { ok: false, reason: "unknown", text: decoded.text };
}

// ---------- magnitude, frequency, the gate, the scroll --------------------

export function clampStop(i) {
  const n = Number(i);
  if (!Number.isInteger(n) || n < 0 || n > 4) return null;
  return n;
}

// The flight gate's truth table, named for the dial. Paid wins when
// both are true, exactly as flightUnlocked does. The game passes
// isGenerator(eco) and sub.dragonKilled — the purchase scroll is
// what makes a fox paid, the world's flag is the dragon.
export function dialRangeUnlocked(paid, dragonKilled) {
  if (paid) return { ok: true, via: "paid" };
  if (dragonKilled) return { ok: true, via: "dragon" };
  return { ok: false, via: null };
}

export function proposeDial(magIndex, freqIndex, unlocked) {
  const mag = clampStop(magIndex);
  const freq = clampStop(freqIndex);
  if (mag === null || freq === null) return { ok: false, reason: "bad" };
  if (!unlocked && (mag !== FREE_MAG || freq !== FREE_FREQ)) {
    return { ok: false, reason: "locked", mag: FREE_MAG, freq: FREE_FREQ };
  }
  return { ok: true, mag, freq };
}

// perSec is what the shipped line subtracts from vel.y each second:
// `vel.y -= perSec * dt`. At Standard + Still it is exactly 23*gravDir.
export function gravityStep(magIndex, freqIndex, gravDir, tSec) {
  const mag = MAG_STOPS[clampStop(magIndex) ?? FREE_MAG].mul;
  const hz = FREQ_STOPS[clampStop(freqIndex) ?? FREE_FREQ].hz;
  const t = Number.isFinite(+tSec) ? +tSec : 0;
  const ripple = hz > 0 ? 1 + FREQ_RIPPLE * Math.sin(2 * Math.PI * hz * t) : 1;
  const dir = gravDir < 0 ? -1 : 1;
  return {
    perSec: GRAV_BASE * mag * ripple * dir,
    terminal: TERM_BASE * mag,
    ripple,
    mag,
    hz,
  };
}

export function dialLine(realmId, magIndex, freqIndex, player, day, ts) {
  const mag = clampStop(magIndex);
  const freq = clampStop(freqIndex);
  if (mag === null || freq === null) return null;
  if (!realmId || !player || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(+ts)) return null;
  return `gdial|${realmId}|${mag}|${freq}|${player}|${day}|${Math.floor(+ts)}`;
}

export function parseDialScroll(text) {
  if (!text) return [];
  const out = [];
  for (const ln of String(text).split("\n")) {
    const parts = ln.split("|");
    if (parts.length !== 7 || parts[0] !== "gdial") continue;
    const [, realmId, magRaw, freqRaw, player, day, tsRaw] = parts;
    const mag = clampStop(Number(magRaw));
    const freq = clampStop(Number(freqRaw));
    const ts = Number(tsRaw);
    if (!realmId || !player || mag === null || freq === null) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(ts)) continue;
    out.push({ realmId, mag, freq, player, day, ts });
  }
  return out;
}

// Latest gdial line per player+realm. Order is scroll order; the
// caller merges queued lines so the newest act stands last.
export function latestDialByPlayerRealm(records) {
  const by = new Map();
  for (const r of records || []) by.set(`${r.player}|${r.realmId}`, r);
  return by;
}

export function writeGapOpen(records, player, realmId, now, gap = WRITE_GAP_MS) {
  let last = null;
  for (const r of records || []) {
    if (!r || r.player !== player || r.realmId !== realmId) continue;
    if (last === null || r.ts > last) last = r.ts;
  }
  if (last === null) return true;
  return now - last >= gap;
}

// Daily cap, judged only on direction records (they carry dir).
// A gdial line must not spend the day's flip.
export function dailyShiftOpen(records, realmId, player, day) {
  for (const r of records || []) {
    if (!r || (r.dir !== 1 && r.dir !== -1)) continue;
    if (r.realmId === realmId && r.player === player && r.day === day) return false;
  }
  return true;
}

// The combined gate the dial's flip uses once the range is open:
// the daily cap holds for a free fox; an unlocked fox may shift
// again, but never inside the write gap.
export function shiftGate(records, realmId, player, day, unlocked, now) {
  if (!writeGapOpen(records, player, realmId, now)) return { ok: false, reason: "rate" };
  if (!dailyShiftOpen(records, realmId, player, day) && !unlocked) {
    return { ok: false, reason: "daily" };
  }
  return { ok: true, reason: null };
}

export function newDialInstrument() {
  return { v: 1, byRealm: {} };
}

export function saveDialInstrument(inst) {
  const byRealm = {};
  for (const [id, rec] of Object.entries(inst && inst.byRealm || {})) byRealm[id] = { mag: rec.mag, freq: rec.freq };
  return { v: 1, byRealm };
}

export function loadDialInstrument(raw) {
  const inst = newDialInstrument();
  if (!raw || raw.v !== 1 || !raw.byRealm || typeof raw.byRealm !== "object") return inst;
  for (const [id, rec] of Object.entries(raw.byRealm)) {
    if (!DIAL_REALMS.some((r) => r.id === id) || !rec) continue;
    const mag = clampStop(rec.mag);
    const freq = clampStop(rec.freq);
    if (mag === null || freq === null) continue;
    inst.byRealm[id] = { mag, freq };
  }
  return inst;
}

export function rememberDial(inst, realmId, mag, freq) {
  inst.byRealm[realmId] = { mag, freq };
  return inst;
}

export function dialReading(inst, realmId, unlocked) {
  const rec = inst && inst.byRealm && inst.byRealm[realmId];
  if (!unlocked) return { mag: FREE_MAG, freq: FREE_FREQ, locked: true };
  if (!rec) return { mag: FREE_MAG, freq: FREE_FREQ, locked: false };
  return { mag: rec.mag, freq: rec.freq, locked: false };
}

// Scroll wins for this fox, and only when the range is open —
// a free fox is not handed Crushing by somebody else's line,
// nor by a line of their own from a paid season they no longer
// hold. Other players' lines never apply.
export function applyDialRecords(inst, records, player, unlocked) {
  if (!unlocked) return inst;
  const latest = new Map();
  for (const r of records || []) {
    if (!r || r.player !== player) continue;
    latest.set(r.realmId, r);
  }
  for (const [realmId, r] of latest) {
    if (!DIAL_REALMS.some((d) => d.id === realmId)) continue;
    const proposed = proposeDial(r.mag, r.freq, true);
    if (proposed.ok) inst.byRealm[realmId] = { mag: proposed.mag, freq: proposed.freq };
  }
  return inst;
}

// ---------- pitches: pentatonic, overtones, the S.O.S cadence -------------
// C D E G A, rooted at C. Pure functions — the glue plays them
// through the existing WebAudio voice. No samples.

export const PENTA_STEPS = Object.freeze([0, 2, 4, 7, 9]);

export function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function symbolPitch(symbol) {
  const i = MORSE_ORDER.indexOf(symbol);
  if (i < 0) return null;
  const degree = i % 5;
  const octave = Math.floor(i / 5) % 3;
  const midi = 60 + PENTA_STEPS[degree] + 12 * octave;
  return { midi, hz: midiToHz(midi), degree, octave };
}

export function dialPitch(magIndex, freqIndex) {
  const mag = clampStop(magIndex);
  const freq = clampStop(freqIndex);
  if (mag === null || freq === null) return null;
  const midi = 48 + 12 * mag + PENTA_STEPS[freq];
  return { midi, hz: midiToHz(midi), mag, freq };
}

export function coordPitch(coord) {
  if (!Array.isArray(coord) || !coord.length) return null;
  let sum = 0;
  for (let i = 0; i < coord.length; i++) sum += Math.abs(Number(coord[i]) || 0) * (i + 1);
  const degree = sum % 5;
  const octave = sum % 3;
  const midi = 60 + PENTA_STEPS[degree] + 12 * octave;
  return { midi, hz: midiToHz(midi) };
}

export function tapPitch(el, freqIndex) {
  const band = dialPitch(FREE_MAG, clampStop(freqIndex) ?? FREE_FREQ);
  if (!band) return null;
  return el === "-" ? band.hz * 0.5 : band.hz;
}

export function tonePartials(hz) {
  const h = Number(hz);
  if (!(h > 0)) return [];
  const gains = [1, 0.45, 0.22, 0.1];
  return gains.map((gain, i) => ({ n: i + 1, hz: h * (i + 1), gain }));
}

export function confirmChord(symbol) {
  const root = symbolPitch(symbol);
  if (!root) return null;
  return [0, 4, 7].map((semi) => ({
    midi: root.midi + semi,
    hz: midiToHz(root.midi + semi),
  }));
}

// A low, slow, rising major arpeggio — warmer and longer than a
// sidetone. C3 E3 G3 C4.
export function sosCadence() {
  return [48, 52, 55, 60].map((midi, i) => ({
    midi, hz: midiToHz(midi), hold: 0.28 + i * 0.04,
  }));
}

export function spectrumColor(hz) {
  const h = Number(hz);
  if (!(h > 0)) return { hue: 188, css: "hsl(188, 85%, 62%)" };
  const t = Math.max(0, Math.min(1,
    (Math.log2(h) - Math.log2(98)) / (Math.log2(1568) - Math.log2(98))));
  const hue = Math.round(188 + t * 132);
  return { hue, css: `hsl(${hue}, 85%, 62%)` };
}

// ---------- the Morse primer: a Leitner deck, local only ------------------
// Boxes 1..5. A miss returns to box 1, due again now. A clean key
// promotes one box and the interval stretches. Nothing here touches
// the gateway — the glue stores the deck under MORSE_LS_KEY.

export const LEITNER_INTERVALS_MS = Object.freeze([
  0,
  0, // box 1: due immediately
  45000,
  180000,
  600000,
  1800000,
]);

export function newMorseDeck(now = 0) {
  return {
    v: 1,
    introduced: 2,
    sosCued: false,
    cards: MORSE_ORDER.map((symbol, i) => ({
      symbol,
      box: 1,
      due: i < 2 ? now : 0,
      correct: 0,
      wrong: 0,
      introduced: i < 2,
    })),
  };
}

export function cardBySymbol(deck, symbol) {
  if (!deck || !Array.isArray(deck.cards)) return null;
  return deck.cards.find((c) => c.symbol === symbol) || null;
}

export function reviewCard(deck, symbol, correct, now) {
  const card = cardBySymbol(deck, symbol);
  if (!card || !card.introduced) return { ok: false, reason: "unintroduced" };
  if (correct) {
    card.correct += 1;
    card.box = Math.min(5, card.box + 1);
  } else {
    card.wrong += 1;
    card.box = 1;
  }
  card.due = now + LEITNER_INTERVALS_MS[card.box];
  return { ok: true, box: card.box, due: card.due, correct: card.correct, wrong: card.wrong };
}

export function dueCard(deck, now) {
  const playable = (deck.cards || []).filter((c) => c.introduced && c.due <= now);
  playable.sort((a, b) => a.due - b.due
    || MORSE_ORDER.indexOf(a.symbol) - MORSE_ORDER.indexOf(b.symbol));
  return playable[0] || null;
}

export function introduceNext(deck, now) {
  if (!deck || deck.introduced >= MORSE_COUNT) return null;
  const card = deck.cards[deck.introduced];
  card.introduced = true;
  card.box = 1;
  card.due = now;
  deck.introduced += 1;
  return card.symbol;
}

export function sosReady(deck) {
  const s = cardBySymbol(deck, "S");
  const o = cardBySymbol(deck, "O");
  return !!(s && o && s.correct >= 1 && o.correct >= 1);
}

export function saveMorseDeck(deck) {
  return {
    v: 1,
    introduced: deck.introduced,
    sosCued: !!deck.sosCued,
    cards: deck.cards.map((c) => ({
      symbol: c.symbol,
      box: c.box,
      due: c.due,
      correct: c.correct,
      wrong: c.wrong,
      introduced: !!c.introduced,
    })),
  };
}

export function loadMorseDeck(raw, now = 0) {
  const deck = newMorseDeck(now);
  if (!raw || raw.v !== 1 || !Array.isArray(raw.cards)) return deck;
  const by = new Map();
  for (const c of raw.cards) {
    if (c && typeof c.symbol === "string") by.set(c.symbol, c);
  }
  let n = Number(raw.introduced);
  if (!Number.isInteger(n) || n < 2 || n > MORSE_COUNT) n = 2;
  deck.introduced = n;
  deck.sosCued = !!raw.sosCued;
  for (let i = 0; i < deck.cards.length; i++) {
    const card = deck.cards[i];
    card.introduced = i < n;
    const src = by.get(card.symbol);
    if (!src) continue;
    const box = Number(src.box);
    card.box = Number.isInteger(box) && box >= 1 && box <= 5 ? box : 1;
    card.due = Number.isFinite(+src.due) ? +src.due : 0;
    card.correct = Number.isFinite(+src.correct) && +src.correct > 0 ? Math.floor(+src.correct) : 0;
    card.wrong = Number.isFinite(+src.wrong) && +src.wrong > 0 ? Math.floor(+src.wrong) : 0;
  }
  return deck;
}

export function morseChart() {
  return MORSE_ORDER.map((symbol, i) => ({ symbol, pattern: MORSE[symbol], index: i }));
}

function joyPrompt(symbol, fresh) {
  const pat = encodeMorse(symbol);
  if (symbol === "S") {
    return `Joy — the dial speaks Morse. S is ${pat} — three short taps. Key it back when you're ready.`;
  }
  if (symbol === "O") {
    return `Joy — O is ${pat} — three long holds. With S, that is how you call home.`;
  }
  if (fresh) return `Joy — a new mark, as you walk: ${symbol} is ${pat}.`;
  return `Joy — ${symbol} again, when you can: ${pat}.`;
}

// Joy's cue. Text only — no recorded take. The glue shows it as a
// toast and plays the sidetone itself. Quiet inside the gap, so a
// walk does not nag. A practice answer is never held back by the gap.
// ctx: { event, lastCueAt, prompted, keyedOk, sosCued }
export function joyMorseCue(deck, now, ctx) {
  const c = ctx || {};
  if (c.event === "practice") {
    const symbol = c.prompted;
    if (!symbol) return { kind: "quiet", text: "", speak: false };
    if (c.keyedOk) {
      const text = symbol === "SOS"
        ? "Joy — S.O.S, clean. Home is listening."
        : `Joy — ${symbol}, clean. That one will stay with you a while.`;
      return { kind: "celebrate", symbol, text, speak: true };
    }
    const pat = symbol === "SOS" ? SOS_PATTERN : encodeMorse(symbol);
    return {
      kind: "retry", symbol, speak: true,
      text: `Joy — not quite. ${symbol} is ${pat}. Try it once more.`,
    };
  }
  if (c.lastCueAt && now - c.lastCueAt < JOY_CUE_GAP_MS) {
    return { kind: "quiet", text: "", speak: false };
  }
  if (!deck.sosCued && sosReady(deck)) {
    deck.sosCued = true;
    return {
      kind: "sos", symbol: "SOS", speak: true,
      text: "Joy — S.O.S is ... --- ... — three short, three long, three short. Key that on the dial and it brings you home.",
    };
  }
  const due = dueCard(deck, now);
  if (due) {
    return { kind: "prompt", symbol: due.symbol, text: joyPrompt(due.symbol, false), speak: true };
  }
  if (c.event === "explore" || c.event === "enter") {
    const sym = introduceNext(deck, now);
    if (sym) {
      return { kind: "prompt", symbol: sym, text: joyPrompt(sym, true), speak: true, introduced: sym };
    }
  }
  return { kind: "quiet", text: "", speak: false };
}
