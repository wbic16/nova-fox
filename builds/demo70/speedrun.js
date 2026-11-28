// Nova Fox — speedrun mode: the pure logic (demo16).
//
// Will's spec (2026-11-26 15:28 CST): "include modes for speed
// runners to play and record and stream their telemetry." Three
// parts — play, record, stream — and this module is the part that
// can be decided without a browser: what a run IS, what its
// recording says, and how a recording is checked. The game glue in
// game3.js owns the clock, the DOM, and the socket; everything here
// is pure and unit-tested (test3.mjs).
//
// THE RUN, in the world's own terms (stated for Will's ratification
// in SPEEDRUN-REPORT.md):
//   START  — a run is armed at Arrival in Nova Prime, the player
//            standing at spawn in a clean state; the clock starts
//            on the player's first movement after arming.
//   FINISH — standing at the Deep Stone (the Nova Heart) in the
//            barrow: the same near-box Subspace.checkQuest tests,
//            re-tested here so a run can be repeated after the
//            quest itself is done (questDone never un-fires).
//   SPLITS — the major beats, taken where playBeat fires them:
//            crossing to Ashfall, entering the barrow, the
//            guardian's fall. The quest beat, when it fires, is
//            recorded too — but the position test is the finish,
//            because it fires every run.
//
// A recording is an event stream: inputs, position samples, realm
// crossings, strikes, beats, splits. Verification re-walks the
// stream and reproduces the finish time from it — it proves the
// stream is whole, ordered, and ends standing at the stone. It is
// NOT an anti-cheat proof (nothing here re-simulates the world),
// and the report says so plainly.

export const RUN_KIND = "nova-fox-run";
export const RUN_VERSION = 1;

export const RUN_START_RULE =
  "clock starts on first movement after arming at Arrival, Nova Prime";
export const RUN_FINISH_RULE =
  "reach the Deep Stone (the Nova Heart) in the barrow — the checkQuest near-box";

// Split beats, in the order a run can meet them. BEAT-quest is the
// finish beat when it fires (first completion only).
export const RUN_SPLITS = [
  { beat: "BEAT-cross-ashfall", name: "Ashfall Haven" },
  { beat: "BEAT-barrow", name: "The Barrow Hall" },
  { beat: "BEAT-guardian-kill", name: "The Shadow Falls" },
];
export const RUN_FINISH_BEAT = "BEAT-quest";

export function splitForBeat(beat) {
  return RUN_SPLITS.find((s) => s.beat === beat) || null;
}

// The finish test, mirroring Subspace.checkQuest (world.js) exactly:
// block coords within 2 / 2 of the stone in x / z, 3 in y.
export function deepStoneNear(bx, by, bz, stone) {
  return (
    Math.abs(bx - stone.x) <= 2 &&
    Math.abs(bz - stone.z) <= 2 &&
    Math.abs(by - stone.y) <= 3
  );
}

// m:ss.mmm — the race clock's face. Negative and non-finite times
// read as zero rather than lying about a sign.
export function formatRunTime(ms) {
  if (!isFinite(ms) || ms < 0) ms = 0;
  ms = Math.floor(ms);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(r).padStart(3, "0")}`;
}

export function newRunRecording(meta = {}) {
  return {
    kind: RUN_KIND,
    version: RUN_VERSION,
    player: meta.player || "fox",
    shipEE: meta.shipEE || "",
    startedAt: meta.startedAt || "",
    startRule: RUN_START_RULE,
    finishRule: RUN_FINISH_RULE,
    stone: meta.stone ? { x: meta.stone.x, y: meta.stone.y, z: meta.stone.z } : null,
    events: [],
  };
}

// Append one event. Times are milliseconds since the clock started
// (the start event itself stands at t=0), rounded and clamped so a
// stream can never run backwards at the seam.
export function recEvent(rec, t, kind, data = {}) {
  const ev = { t: Math.max(0, Math.round(t)), k: kind, ...data };
  rec.events.push(ev);
  return ev;
}

// ---------- verification -------------------------------------------------
// Re-walk a recording's event stream and reproduce its result.
// Returns { ok, finishMs, splits: [{beat, name, atMs}], errors }.
// finishMs is read off the stream's own finish event — the check is
// that the stream, as written, supports exactly that number and no
// other: one start at t=0, time never running backwards, exactly
// one finish after it, splits in their defined order, enough
// position samples to re-walk the path, and the finish event
// standing inside the stone's near-box.
export function verifyRecording(rec) {
  const errors = [];
  const splits = [];
  if (!rec || typeof rec !== "object") {
    return { ok: false, finishMs: null, splits, errors: ["not a recording object"] };
  }
  if (rec.kind !== RUN_KIND) errors.push(`kind is ${JSON.stringify(rec.kind)}, not ${RUN_KIND}`);
  const evs = Array.isArray(rec.events) ? rec.events : [];
  if (!evs.length) errors.push("the stream is empty");

  for (let i = 1; i < evs.length; i++) {
    if (evs[i].t < evs[i - 1].t) {
      errors.push(`event ${i} (${evs[i].k}) goes backwards in time`);
      break;
    }
  }
  const starts = evs.filter((e) => e.k === "start");
  if (starts.length !== 1) errors.push(`expected exactly one start event, found ${starts.length}`);
  else if (starts[0].t !== 0) errors.push("the start event is not at t=0");

  const finishes = evs.filter((e) => e.k === "finish");
  if (finishes.length !== 1) errors.push(`expected exactly one finish event, found ${finishes.length}`);
  const finishMs = finishes.length === 1 ? finishes[0].t : null;
  if (finishMs !== null && !(finishMs > 0)) errors.push("the finish is not after the start");

  // Splits: each split event names a defined split beat, and they
  // arrive in the order the run can meet them.
  let lastSplitIdx = -1;
  for (const e of evs) {
    if (e.k !== "split") continue;
    const idx = RUN_SPLITS.findIndex((s) => s.beat === e.beat);
    if (idx === -1) { errors.push(`split names an unknown beat: ${e.beat}`); continue; }
    if (idx < lastSplitIdx) errors.push(`split ${e.beat} arrives out of order`);
    lastSplitIdx = idx;
    splits.push({ beat: e.beat, name: RUN_SPLITS[idx].name, atMs: e.t });
  }

  const pos = evs.filter((e) => e.k === "pos");
  if (pos.length < 2) errors.push("fewer than two position samples — the path cannot be re-walked");
  if (finishMs !== null && pos.some((p) => p.t > finishMs)) {
    errors.push("a position sample lands after the finish");
  }

  // The finish is earned standing at the stone: the finish event
  // carries the exact position, tested against the same near-box
  // the game itself uses.
  if (finishes.length === 1) {
    const f = finishes[0];
    if (!rec.stone) errors.push("the recording does not name its stone");
    else if (typeof f.x !== "number" || typeof f.y !== "number" || typeof f.z !== "number") {
      errors.push("the finish event carries no position");
    } else if (!deepStoneNear(Math.floor(f.x), Math.floor(f.y), Math.floor(f.z), rec.stone)) {
      errors.push("the finish position is not at the Deep Stone");
    }
  }

  return { ok: errors.length === 0, finishMs, splits, errors };
}

// ---------- the recording as a scroll ------------------------------------
// A recording saved as phext-shaped text: a header of named lines,
// then one event per line, t first. This is the file the download
// button hands over, and parseRecording reads it back — the round
// trip is unit-tested, so the file a runner keeps is the file the
// verifier reads.
const EVENT_FIELDS = {
  start: ["realm"],
  pos: ["realm", "x", "y", "z", "hp", "grav"],
  key: ["code"],
  strike: [],
  flip: ["dir"],
  beat: ["id"],
  split: ["beat"],
  cross: ["from", "to"],
  death: [],
  finish: ["x", "y", "z"],
  abort: [],
};
const NUM_FIELDS = new Set(["x", "y", "z", "hp", "grav", "dir"]);

function fmtNum(v) {
  return typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v);
}

export function serializeRecording(rec) {
  const lines = [
    `${RUN_KIND} v${rec.version}`,
    `player: ${rec.player}`,
    `ship-ee: ${rec.shipEE}`,
    `started-at: ${rec.startedAt}`,
    `start-rule: ${rec.startRule}`,
    `finish-rule: ${rec.finishRule}`,
  ];
  if (rec.stone) lines.push(`stone: ${rec.stone.x},${rec.stone.y},${rec.stone.z}`);
  lines.push("---");
  for (const e of rec.events) {
    const fields = EVENT_FIELDS[e.k] || [];
    const parts = [`t=${e.t}`, `k=${e.k}`];
    for (const f of fields) {
      if (e[f] === undefined) continue;
      parts.push(`${f}=${NUM_FIELDS.has(f) ? fmtNum(e[f]) : e[f]}`);
    }
    lines.push(parts.join(" "));
  }
  return lines.join("\n") + "\n";
}

export function parseRecording(text) {
  const rec = newRunRecording();
  const lines = String(text).split(/\r?\n/);
  let inEvents = false;
  for (const line of lines) {
    if (!inEvents) {
      if (line === "---") { inEvents = true; continue; }
      const m = line.match(/^([\w-]+):\s*(.*)$/);
      if (m) {
        if (m[1] === "player") rec.player = m[2];
        else if (m[1] === "ship-ee") rec.shipEE = m[2];
        else if (m[1] === "started-at") rec.startedAt = m[2];
        else if (m[1] === "start-rule") rec.startRule = m[2];
        else if (m[1] === "finish-rule") rec.finishRule = m[2];
        else if (m[1] === "stone") {
          const [x, y, z] = m[2].split(",").map(Number);
          rec.stone = { x, y, z };
        }
      } else if (line.startsWith(RUN_KIND)) {
        const v = line.match(/v(\d+)/);
        if (v) rec.version = Number(v[1]);
      }
      continue;
    }
    if (!line.trim()) continue;
    const ev = {};
    for (const tok of line.trim().split(/\s+/)) {
      const eq = tok.indexOf("=");
      if (eq === -1) continue;
      const key = tok.slice(0, eq);
      const raw = tok.slice(eq + 1);
      if (key === "t") ev.t = Number(raw);
      else if (key === "k") ev.k = raw;
      else ev[key] = NUM_FIELDS.has(key) ? Number(raw) : raw;
    }
    if (typeof ev.t === "number" && ev.k) rec.events.push(ev);
  }
  return rec;
}

// ---------- the stream ----------------------------------------------------
// One telemetry message, as it goes on the wire: a JSON object with
// a type, the game's name, and the caller's payload. Pure so the
// shape is unit-tested; the socket itself is the glue's business.
export function telemetryMessage(type, payload = {}) {
  return JSON.stringify({ type, game: "nova-fox", ...payload });
}
