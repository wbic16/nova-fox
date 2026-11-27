// ---------- player ideas (demo8): the telling door's shared chart ------------
// The in-game idea door (DEV-LOOP-LOG, EE 953 DESIGN — Item #1).
// A player writes a title and a short telling at the door; the
// telling rides the shared chart as one append-only line, and its
// state — told, taken up, in the world — is read back from the
// same chart, never asserted by the client.
//
// This module is pure logic: no DOM, no storage, no clock of its
// own — exactly like economy.js / forms.js. The game glue
// (game3.js) owns persistence, the network, and the panel; tests
// drive this file directly. Randomness for ids is passed in, so
// id generation is deterministic under test.

// ---------- caps ----------------------------------------------------------------
// Refused past the cap, never truncated silently (EE 953 design).
export const IDEA_TITLE_MAX = 80;
export const IDEA_BODY_MAX = 1000;
export const IDEA_LIMITS = { titleMax: IDEA_TITLE_MAX, bodyMax: IDEA_BODY_MAX };

// The chart coordinate the door writes to lives in BACKEND
// (game3.js); the line format below is this module's whole law.

// ---------- base64 (for the chart lines; no dependencies) -----------------------
// Title and body ride base64-UTF-8 (the forms chart-line pattern),
// so player text can hold pipes, newlines, and any alphabet
// without breaking the line format. Names are kept distinct from
// forms.js helpers: build3.py inlines every module into one scope.
const IDEA_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const _ideaEnc = new TextEncoder();
export function ideaB64Encode(text) {
  const bytes = _ideaEnc.encode(String(text));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] || 0, c = bytes[i + 2] || 0;
    out += IDEA_B64[a >> 2] + IDEA_B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? IDEA_B64[((b & 15) << 2) | (c >> 6)] : "=";
    out += i + 2 < bytes.length ? IDEA_B64[c & 63] : "=";
  }
  return out;
}
export function ideaB64Decode(b64) {
  const clean = String(b64).replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const a = IDEA_B64.indexOf(clean[i]), b = IDEA_B64.indexOf(clean[i + 1]);
    const c = IDEA_B64.indexOf(clean[i + 2]), d = IDEA_B64.indexOf(clean[i + 3]);
    if (a < 0 || b < 0) break;
    bytes.push((a << 2) | (b >> 4));
    if (c >= 0) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d >= 0 && c >= 0) bytes.push(((c & 3) << 6) | d);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// ---------- validation ------------------------------------------------------------
const charCount = (s) => [...String(s)].length;
export function validateIdea(title, body) {
  if (typeof title !== "string" || title.trim() === "") {
    return { ok: false, reason: "title-empty" };
  }
  if (typeof body !== "string" || body.trim() === "") {
    return { ok: false, reason: "body-empty" };
  }
  if (charCount(title) > IDEA_TITLE_MAX) {
    return { ok: false, reason: "title-cap", limit: IDEA_TITLE_MAX, count: charCount(title) };
  }
  if (charCount(body) > IDEA_BODY_MAX) {
    return { ok: false, reason: "body-cap", limit: IDEA_BODY_MAX, count: charCount(body) };
  }
  return { ok: true };
}

// ---------- ids ---------------------------------------------------------------------
// Submit-ts in base36 + 4 random base36 chars. The randomness is
// passed in: a function returning [0, 1) per call (Math.random's
// shape), or a string whose first 4 base36 chars are used — so a
// test can name the id it expects. Collision against read-back
// rows is the caller's check (the glue retries with fresh rolls).
const IDEA_ID_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";
export function makeIdeaId(ts, rng) {
  const stamp = Math.max(0, Math.floor(+ts) || 0).toString(36);
  let suffix = "";
  if (typeof rng === "string") {
    suffix = [...rng.toLowerCase()].filter((c) => IDEA_ID_CHARS.includes(c)).slice(0, 4).join("");
  } else if (typeof rng === "function") {
    for (let i = 0; i < 4; i++) {
      const v = rng();
      const f = Number.isFinite(+v) ? Math.min(0.999999, Math.max(0, +v)) : 0;
      suffix += IDEA_ID_CHARS[Math.floor(f * 36)];
    }
  }
  while (suffix.length < 4) suffix += "0";
  return stamp + suffix;
}

// ---------- the lines -----------------------------------------------------------------
// IDEA|v1|<id>|<fox name>|<submitted ts ms>|<title b64>|<body b64>
// STATUS|v1|<idea id>|<submitted|picked|shipped>|<ts ms>|<ship EE or ->
export function serializeIdea(idea) {
  if (!idea || typeof idea !== "object") return null;
  const { id, name, ts } = idea;
  const title = typeof idea.title === "string" ? idea.title : "";
  const body = typeof idea.body === "string" ? idea.body : "";
  if (!id || /[|\r\n]/.test(String(id))) return null;
  if (!name || /[|\r\n]/.test(String(name))) return null;
  if (!Number.isFinite(+ts) || +ts < 0) return null;
  if (!validateIdea(title, body).ok) return null;
  return ["IDEA", "v1", String(id), String(name), String(Math.floor(+ts)),
    ideaB64Encode(title), ideaB64Encode(body)].join("|");
}
export function parseIdeaLine(line) {
  const p = String(line ?? "").split("|");
  if (p.length !== 7 || p[0] !== "IDEA" || p[1] !== "v1") return null;
  const [, , id, name, ts, titleB64, bodyB64] = p;
  if (!id || !name || !Number.isFinite(+ts)) return null;
  let title, body;
  try { title = ideaB64Decode(titleB64); body = ideaB64Decode(bodyB64); }
  catch (e) { return null; }
  return { id, name, ts: +ts, title, body };
}

export const IDEA_STATUSES = ["submitted", "picked", "shipped"];
export function serializeStatus(st) {
  if (!st || typeof st !== "object") return null;
  const { ideaId, status, ts } = st;
  if (!ideaId || /[|\r\n]/.test(String(ideaId))) return null;
  if (!IDEA_STATUSES.includes(status)) return null;
  if (!Number.isFinite(+ts) || +ts < 0) return null;
  const ee = status === "shipped" && Number.isInteger(+st.shipEE) && +st.shipEE > 0
    ? String(+st.shipEE) : "-";
  if (status === "shipped" && ee === "-") return null; // shipped carries its EE, always
  return ["STATUS", "v1", String(ideaId), status, String(Math.floor(+ts)), ee].join("|");
}
export function parseStatusLine(line) {
  const p = String(line ?? "").split("|");
  if (p.length !== 6 || p[0] !== "STATUS" || p[1] !== "v1") return null;
  const [, , ideaId, status, ts, ee] = p;
  if (!ideaId || !IDEA_STATUSES.includes(status) || !Number.isFinite(+ts)) return null;
  return {
    ideaId, status, ts: +ts,
    shipEE: status === "shipped" && Number.isInteger(+ee) && +ee > 0 ? +ee : null,
  };
}

// ---------- the scroll, resolved -------------------------------------------------------
// One append-only scroll, two line kinds. An IDEA with no STATUS
// is "submitted"; the latest STATUS line for an id (in scroll
// order — arrival order, the chart's own semantics) wins, and a
// shipped idea carries its ship EE. The first IDEA line for an
// id is the idea; a second is ignored, like the purchase record.
// Returns resolved ideas in scroll (arrival) order.
export function parseIdeas(text) {
  const byId = new Map();
  const order = [];
  const statuses = [];
  for (const ln of String(text || "").split("\n")) {
    const idea = parseIdeaLine(ln);
    if (idea) {
      if (!byId.has(idea.id)) { byId.set(idea.id, idea); order.push(idea.id); }
      continue;
    }
    const st = parseStatusLine(ln);
    if (st) statuses.push(st);
  }
  const latest = new Map();
  for (const st of statuses) latest.set(st.ideaId, st);
  return order.map((id) => {
    const idea = byId.get(id);
    const st = latest.get(id) || null;
    return {
      ...idea,
      status: st ? st.status : "submitted",
      statusTs: st ? st.ts : idea.ts,
      shipEE: st && st.status === "shipped" ? st.shipEE : null,
    };
  });
}
// The same resolution, named for the chart it reads.
export const parseIdeaScroll = parseIdeas;

// ---------- the road ahead: the roadmap split (Item #3, EE 1068 design) --------
// The board's roadmap is a read-only view of this same chart:
// what is on the way (told or taken up, oldest told first — the
// pipeline's own order) and what is already in the world (newest
// ship first, carrying its EE via the resolved row). Pure like
// the rest of this module: no DOM, no storage, no clock. Rows
// with an unknown status are excluded — never rendered as
// shipped, never guessed at.
export const ROADMAP_UPCOMING_MAX = 12;
export const ROADMAP_SHIPPED_MAX = 8;
export function roadmapSplit(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const upcoming = list
    .filter((r) => r && (r.status === "submitted" || r.status === "picked"))
    .sort((a, b) => (+a.ts || 0) - (+b.ts || 0))
    .slice(0, ROADMAP_UPCOMING_MAX);
  const shipped = list
    .filter((r) => r && r.status === "shipped")
    .sort((a, b) => (+b.statusTs || 0) - (+a.statusTs || 0))
    .slice(0, ROADMAP_SHIPPED_MAX);
  return { upcoming, shipped };
}
