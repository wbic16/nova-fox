// Nova Fox — gravity dial probe (build 42, Grok/xAI lane).
// A headless scenario, not a browser pass: the dial's decisions are
// pure (gdial.js), and this script walks one fox through them.
//   free fox kept at Standard / Still, daily flip refused
//   paid fox opens Crushing + Keen, write gap holds, scroll appends
//   dragon-slayer opens the same range
//   S.O.S (... --- ...) resolves home
//   a realm call and a digit coordinate resolve
//   Joy teaches S, then O, then S.O.S, and a miss demotes
//   all 36 symbols sit in the deck and on the pentatonic
// Run: node probe-gdial.mjs
import {
  SOS_PATTERN, FREE_MAG, FREE_FREQ, WRITE_GAP_MS, MORSE_ORDER, MORSE_COUNT,
  encodeMorse, encodeCoord, interpretLock, isSos,
  dialRangeUnlocked, proposeDial, gravityStep, shiftGate,
  dialLine, parseDialScroll,
  newDialInstrument, applyDialRecords, dialReading,
  newMorseDeck, reviewCard, joyMorseCue, loadMorseDeck, saveMorseDeck,
  cardBySymbol, symbolPitch, sosCadence, confirmChord, spectrumColor,
} from "./gdial.js";

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}

const DAY = "2026-11-27";
const fox = "probe-gdial";

// Free fox. The pull is the shipped 23. A second shift the same day
// is refused. Nothing is written for a magnitude the gate holds shut.
{
  check("free: the gate is shut", dialRangeUnlocked(false, false).ok === false);
  check("free: Crushing is refused and Standard stands",
    proposeDial(4, 4, false).reason === "locked" &&
    proposeDial(FREE_MAG, FREE_FREQ, false).ok === true);
  const pull = gravityStep(FREE_MAG, FREE_FREQ, 1, 12);
  check("free: the pull is the shipped 23, terminal 26",
    pull.perSec === 23 && pull.terminal === 26 && pull.ripple === 1);
  const spent = [{ realmId: "nova", dir: 1, player: fox, day: DAY, ts: 10 }];
  check("free: the day's flip is spent",
    shiftGate(spent, "nova", fox, DAY, false, 10 + WRITE_GAP_MS).reason === "daily");
}

// Paid fox. Full range, then the write gap, then an appended line.
// The scroll keeps both lines; the latest is the instrument.
{
  check("paid: the gate names paid", dialRangeUnlocked(true, false).via === "paid");
  const set = proposeDial(4, 4, true);
  check("paid: Crushing and Keen are accepted", set.ok && set.mag === 4 && set.freq === 4);
  const pull = gravityStep(set.mag, set.freq, 1, 0);
  check("paid: Crushing doubles the pull", pull.perSec === 46 && pull.terminal === 52);
  const first = dialLine("nova", 4, 4, fox, DAY, 1000);
  const second = dialLine("nova", 1, 2, fox, DAY, 1000 + WRITE_GAP_MS);
  const scroll = `${first}\n${second}\n`;
  check("paid: the gap refuses a line that lands too soon",
    shiftGate([{ realmId: "nova", player: fox, day: DAY, ts: 1000, dir: 1 }],
      "nova", fox, DAY, true, 1000 + 1000).reason === "rate");
  const rows = parseDialScroll(scroll);
  const inst = applyDialRecords(newDialInstrument(), rows, fox, true);
  check("paid: two appends, latest wins, the first line remains",
    rows.length === 2 && inst.byRealm.nova.mag === 1 && inst.byRealm.nova.freq === 2 &&
    scroll.split("\n").filter(Boolean).length === 2);
  check("paid: another fox's line is not this fox's pull",
    !applyDialRecords(newDialInstrument(), rows, "someone-else", true).byRealm.nova);
}

// The dragon opens the same range, and paid still wins the name
// when both are true.
{
  check("dragon: the gate names dragon", dialRangeUnlocked(false, true).via === "dragon");
  check("dragon: Keen is open", proposeDial(2, 4, true).ok === true);
  check("both: paid is the name", dialRangeUnlocked(true, true).via === "paid");
  const reading = dialReading({ byRealm: { nova: { mag: 0, freq: 3 } } }, "nova", true);
  check("dragon: a stored Float reading is what the fox feels",
    reading.mag === 0 && reading.freq === 3 && reading.locked === false);
}

// Morse. S.O.S home. A call. A coordinate. The primer.
{
  check("sos: the pattern is the home lock",
    isSos(SOS_PATTERN) && interpretLock(SOS_PATTERN).kind === "home" &&
    interpretLock(SOS_PATTERN).realmId === "nova");
  check("call: A is Ashfall",
    interpretLock(encodeMorse("A")).realmId === "ashfall");
  const ash = [10, 10, 1, 1, 1, 1, 1, 10, 10];
  check("coord: Ashfall's digits lock Ashfall",
    interpretLock(encodeCoord(ash)).kind === "coord" &&
    interpretLock(encodeCoord(ash)).realmId === "ashfall");

  const deck = newMorseDeck(0);
  let cue = joyMorseCue(deck, 0, { event: "enter", lastCueAt: 0 });
  check("primer: Joy asks S first", cue.symbol === "S");
  check("primer: keying S promotes it", reviewCard(deck, "S", true, 10).box === 2);
  cue = joyMorseCue(deck, 30000, { event: "explore", lastCueAt: 0 });
  check("primer: Joy asks O next", cue.symbol === "O");
  reviewCard(deck, "O", false, 30000);
  check("primer: a miss on O leaves it in box 1, due now",
    cardBySymbol(deck, "O").box === 1 && cardBySymbol(deck, "O").due === 30000);
  reviewCard(deck, "O", true, 30000);
  cue = joyMorseCue(deck, 60000, { event: "enter", lastCueAt: 0 });
  check("primer: Joy teaches S.O.S once both marks have landed",
    cue.kind === "sos" && cue.text.includes("... --- ..."));
  const back = loadMorseDeck(JSON.parse(JSON.stringify(saveMorseDeck(deck))), 60000);
  check("primer: the deck persists, all 36 still in it",
    back.sosCued === true && back.cards.length === MORSE_COUNT &&
    cardBySymbol(back, "S").correct === 1 && cardBySymbol(back, "O").wrong === 1);
  const pitched = MORSE_ORDER.every((s) => {
    const p = symbolPitch(s);
    return p && p.hz > 0;
  });
  check("primer: all 36 symbols have a pitch", pitched && MORSE_ORDER.length === 36);
  const home = sosCadence();
  const lock = confirmChord("S");
  check("primer: S.O.S has its own cadence and a lock confirms in harmony",
    home.length === 4 && home[0].midi < symbolPitch("S").midi &&
    lock.length === 3 && lock[2].midi - lock[0].midi === 7 &&
    spectrumColor(home[0].hz).css.startsWith("hsl("));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
