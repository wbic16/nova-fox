// ---------- multiplayer presence: echolocation over websockets (MP-1) ------
// Will (EE ~1151): "multiplayer on launch day if we can make it happen
// with echolocation and web sockets." And EE ~1153: "players get
// stronger together." And EE ~1154: "echolocation heals your friends."
// And EE ~1157: "every device on your local Wi-Fi makes you stronger" —
// household foxes (same connection egress, as the relay sees it)
// count as together and heal at any distance, even across realms.
//
// The shape: a fox ANNOUNCES itself to its realm's room at the
// gateway and LISTENS — the answer is the echo: the room's roster,
// then a relay of every fox's state as it moves. Presence is
// discovered the way echolocation discovers a room: send a signal,
// hear what answers. This file is the pure half — the wire codec,
// the roster, the interpolation, and the two gifts co-presence
// carries:
//
//   STRENGTH IN NUMBERS — each OTHER fox within MP_TOGETHER_RADIUS
//   cells lifts the fox's strike by MP_BONUS_PER_FOX, capped at five
//   foxes (+50%): you and five is the raid-group shape. Solo is
//   never penalized; the bonus only ever adds.
//
//   THE PULSE HEALS — a fox's echolocation pulse restores every
//   OTHER fox in the radius by MP_PULSE_HEAL (one heart-step: the
//   heart bar steps at 2 hp, hp 20 is ten hearts). The pulsing fox
//   never heals itself; your ping heals your friends, theirs heals
//   you. A per-source cooldown is judged on the RECEIVING side as
//   well as the sending side, so the heal rate is bounded no matter
//   what a client sends.
//
// The count is of FOXES, not humans — when the raid layer lands,
// agents standing in the room count toward togetherness exactly as
// players do, because the room cannot tell them apart and should
// not try.
//
// Honesty class (v1, named): positions are client-reported; the
// server is a relay, not an authority. Each receiving client is
// authoritative over its OWN fox — its own damage bonus, its own
// healing — computed here from the room state it was given. The
// game glue (game3.js) owns the socket, the meshes, and the HUD;
// tests drive these functions directly, the way they drive
// world.js and gdial.js.

export const MP_TOGETHER_RADIUS = 12; // cells, horizontal (state.pos units)
export const MP_BONUS_PER_FOX = 0.10; // +10% strike per nearby fox
export const MP_BONUS_MAX_FOXES = 5; // five nearby foxes = the full bonus
export const MP_BONUS_CAP = 0.50;
export const MP_PULSE_HEAL = 2; // one heart-step (hearts step at 2 hp)
export const MP_PULSE_COOLDOWN_MS = 10000; // per source, both sides judge it
export const MP_MAX_REMOTES = 40; // the raid size: 8 foxes x 5, or 40 and you
export const MP_STATE_MS = 100; // state rides at ~10 Hz
export const MP_RENDER_DELAY_MS = 100; // interpolation looks this far back
export const MP_STALE_MS = 3000; // a silent fox stops counting and fades
export const MP_LS_KEY = "nova-phox-mp";

// ---------- the wire codec ---------------------------------------------------
// One JSON object per websocket text frame. t names the kind:
//   hello  c->s  {t, token, realm}        the announce
//   welcome s->c {t, id, roster:[...]}    the echo: who is here
//   join   s->c  {t, id, name}            a fox enters the room
//   part   s->c  {t, id}                  a fox leaves the room
//   room   c->s  {t, realm}               the fox changed realms
//   s      both  {t, seq, p:[x,y,z], h, a}  state, relayed by the room
//   pulse  both  {t, p:[x,y,z]}           the echolocation pulse
//   ping/pong    heartbeat, both ways
// The server stamps id (and name, on join/pulse) from the login
// token; a client never speaks for another fox.

function mpIsNum(n) { return typeof n === "number" && Number.isFinite(n); }
function mpIsPos(p) {
  return Array.isArray(p) && p.length === 3 && p.every(mpIsNum);
}
function mpIsRealm(r) {
  return typeof r === "string" && /^[a-z0-9][a-z0-9-]{0,31}$/.test(r);
}

export function mpEncodeHello(token, realm) {
  return JSON.stringify({ t: "hello", token: String(token || ""), realm });
}
export function mpEncodeState(seq, p, h, a) {
  return JSON.stringify({ t: "s", seq, p, h, a: a || "" });
}
export function mpEncodePulse(p) {
  return JSON.stringify({ t: "pulse", p });
}
export function mpEncodeRoom(realm) {
  return JSON.stringify({ t: "room", realm });
}
export function mpEncodePing() {
  return JSON.stringify({ t: "ping" });
}

// Parse one frame. Returns a judged object, or null for anything
// malformed — a bad frame is dropped, never trusted, never fatal.
export function mpDecode(text) {
  let m;
  try { m = JSON.parse(text); } catch (e) { return null; }
  if (!m || typeof m !== "object" || typeof m.t !== "string") return null;
  switch (m.t) {
    case "hello":
      if (typeof m.token !== "string" || !m.token || !mpIsRealm(m.realm)) return null;
      return { t: "hello", token: m.token, realm: m.realm };
    case "welcome":
      if (typeof m.id !== "string" || !Array.isArray(m.roster)) return null;
      return { t: "welcome", id: m.id,
               roster: m.roster.filter((r) => r && typeof r.id === "string") };
    case "join":
      if (typeof m.id !== "string") return null;
      return { t: "join", id: m.id, name: String(m.name || m.id) };
    case "part":
      if (typeof m.id !== "string") return null;
      return { t: "part", id: m.id };
    case "house":
      if (!Array.isArray(m.roster)) return null;
      return { t: "house",
               roster: m.roster.filter((r) => r && typeof r.id === "string") };
    case "room":
      if (!mpIsRealm(m.realm)) return null;
      return { t: "room", realm: m.realm };
    case "s":
      if (!mpIsPos(m.p) || !mpIsNum(m.h)) return null;
      return { t: "s", id: typeof m.id === "string" ? m.id : null,
               seq: mpIsNum(m.seq) ? m.seq : 0, p: m.p, h: m.h,
               a: typeof m.a === "string" ? m.a : "" };
    case "pulse":
      if (!mpIsPos(m.p)) return null;
      return { t: "pulse", id: typeof m.id === "string" ? m.id : null,
               name: String(m.name || ""), p: m.p };
    case "ping": return { t: "ping" };
    case "pong": return { t: "pong" };
    case "full": return { t: "full" };
    default: return null;
  }
}

// ---------- the roster -------------------------------------------------------
// id -> { id, name, samples: [{at, p, h, a}], lastSeen }
// Samples are the fox's relayed states, newest last, a short tail —
// enough to interpolate between, never a history.

export function mpNewRoster() { return new Map(); }

function mpEntry(roster, id, name) {
  let e = roster.get(id);
  if (!e) {
    e = { id, name: name || id, samples: [], lastSeen: 0 };
    roster.set(id, e);
  }
  if (name) e.name = name;
  return e;
}

// Apply one judged message to the roster. Returns the events the
// glue acts on: {joined:[ids], parted:[ids]} (pulses are judged by
// mpPulseJudge at the glue, against the fox's own state — the
// roster only remembers who is here and where they stand).
export function mpRosterApply(roster, msg, selfId, now) {
  const ev = { joined: [], parted: [] };
  if (!msg) return ev;
  if (msg.t === "welcome") {
    roster.clear();
    for (const r of msg.roster) {
      if (r.id === selfId) continue;
      const e = mpEntry(roster, r.id, r.name);
      if (mpIsPos(r.p)) {
        e.samples.push({ at: now, p: r.p, h: mpIsNum(r.h) ? r.h : 0, a: "" });
        e.lastSeen = now;
      }
    }
    ev.joined = [...roster.keys()];
    return ev;
  }
  if (msg.t === "join") {
    if (msg.id !== selfId && !roster.has(msg.id)) {
      mpEntry(roster, msg.id, msg.name);
      ev.joined.push(msg.id);
    }
    return ev;
  }
  if (msg.t === "part") {
    if (roster.delete(msg.id)) ev.parted.push(msg.id);
    return ev;
  }
  if (msg.t === "s" && msg.id && msg.id !== selfId) {
    // The roster is the ROOM: a state seats nobody. A fox outside
    // the room — a household fox standing in another realm, whose
    // state the relay also carries — is the household's business
    // (mpHouseNote), never a ghost in this realm's roster.
    const e = roster.get(msg.id);
    if (!e) return ev;
    e.samples.push({ at: now, p: msg.p, h: msg.h, a: msg.a });
    if (e.samples.length > 4) e.samples.splice(0, e.samples.length - 4);
    e.lastSeen = now;
    return ev;
  }
  return ev;
}

// ---------- the household ------------------------------------------------------
// id -> { id, name, realm, lastSeen }
// The relay's co-location signal, carried: foxes whose connections
// arrive from the same egress (one household's Wi-Fi, one login's
// agent seats) are household, across realms. The server is the
// authority on membership — a "house" message replaces the set —
// and relayed state keeps members fresh between syncs. A household
// fox counts as together at any distance, and its pulses land at
// any distance: your house is your party. (Will, EE ~1157.)

export function mpNewHouse() { return new Map(); }

export function mpHouseApply(house, msg, selfId, now) {
  if (!msg || msg.t !== "house") return house;
  const keep = new Set();
  for (const r of msg.roster) {
    if (r.id === selfId) continue;
    keep.add(r.id);
    let e = house.get(r.id);
    if (!e) { e = { id: r.id, name: r.id, realm: null, lastSeen: 0 }; house.set(r.id, e); }
    if (r.name) e.name = r.name;
    if (typeof r.realm === "string") e.realm = r.realm;
    e.lastSeen = now;
  }
  for (const id of [...house.keys()]) if (!keep.has(id)) house.delete(id);
  return house;
}

// Any word from a household fox — its state, its pulse, relayed
// across realms — proves it is still here.
export function mpHouseNote(house, msg, now) {
  if (!msg || (msg.t !== "s" && msg.t !== "pulse")) return;
  const e = msg.id ? house.get(msg.id) : null;
  if (e) e.lastSeen = now;
}

// Where a fox stands, rendered: look MP_RENDER_DELAY_MS into the
// past and step between the two samples that bracket that moment.
// Past the newest sample, hold it — v1 does not extrapolate a fox
// it can no longer hear. Null when there is nothing to render.
export function mpSampleAt(entry, now) {
  const s = entry.samples;
  if (!s.length) return null;
  const rt = now - MP_RENDER_DELAY_MS;
  if (rt <= s[0].at) return { p: s[0].p, h: s[0].h, a: s[0].a };
  for (let i = s.length - 1; i > 0; i--) {
    if (s[i - 1].at <= rt && rt <= s[i].at) {
      const a = s[i - 1], b = s[i];
      const span = Math.max(1, b.at - a.at);
      const f = Math.max(0, Math.min(1, (rt - a.at) / span));
      return {
        p: [a.p[0] + (b.p[0] - a.p[0]) * f,
            a.p[1] + (b.p[1] - a.p[1]) * f,
            a.p[2] + (b.p[2] - a.p[2]) * f],
        h: a.h + (b.h - a.h) * f, a: b.a,
      };
    }
  }
  const last = s[s.length - 1];
  return { p: last.p, h: last.h, a: last.a };
}

function mpDistXZ(a, b) {
  const dx = a[0] - b[0], dz = a[2] - b[2];
  return Math.hypot(dx, dz);
}

// ---------- strength in numbers ----------------------------------------------
// The bonus curve, pinned: 0 nearby -> +0%, 1 -> +10%, 5 -> +50%,
// 8 -> still +50%. The cap is the raid shape: you and five.

export function mpBonusFor(count) {
  if (!(count > 0)) return 0;
  return Math.min(MP_BONUS_CAP, Math.min(count, MP_BONUS_MAX_FOXES) * MP_BONUS_PER_FOX);
}

// Who stands with this fox: roster foxes whose latest word is
// fresh and whose ground distance is inside the radius — plus
// every fresh household fox, at any distance, in any realm. A fox
// that qualifies both ways counts once. Returns the count and the
// bonus it earns. Solo is 0 and +0% — stronger together, never
// weaker alone.
export function mpTogether(roster, house, selfPos, now) {
  const ids = new Set();
  for (const e of roster.values()) {
    if (!e.samples.length || now - e.lastSeen > MP_STALE_MS) continue;
    const last = e.samples[e.samples.length - 1];
    if (mpDistXZ(last.p, selfPos) <= MP_TOGETHER_RADIUS) ids.add(e.id);
  }
  if (house) {
    for (const e of house.values()) {
      if (now - e.lastSeen <= MP_STALE_MS) ids.add(e.id);
    }
  }
  return { count: ids.size, bonus: mpBonusFor(ids.size) };
}

// Damage is counted in whole hits, so a percentage bonus rides as
// a fraction pool: each landed blow banks landed*bonus, and whole
// points leave the pool as extra hits. Over any run of blows the
// fox deals exactly the bonus the curve promises — at damage 1 and
// +10%, every tenth blow lands twice. A blow that lands nothing
// (a shuttered Heart) banks nothing.
export function mpBonusLanded(landed, bonus, pool) {
  if (!(landed > 0) || !(bonus > 0)) return { landed, pool };
  pool += landed * bonus;
  const extra = Math.floor(pool + 1e-9);
  return { landed: landed + extra, pool: pool - extra };
}

// ---------- the pulse ----------------------------------------------------------
// Sender side: a fox may pulse again only once its own cooldown
// has run. Receiver side: each fox judges every pulse it hears —
// the source is never itself, the source's last ACCEPTED pulse is
// at least a cooldown old, and the pulse's origin stands inside
// the radius. Judged here, applied by the glue to the fox's own
// health: the receiver is the authority over its own heart.

export function mpPulseReady(lastSentAt, now) {
  return now - (lastSentAt || 0) >= MP_PULSE_COOLDOWN_MS;
}

export function mpPulseJudge(selfId, selfPos, msg, lastBySource, now, house) {
  if (!msg || msg.t !== "pulse") return { ok: false, reason: "not-a-pulse" };
  if (!msg.id || msg.id === selfId) return { ok: false, reason: "own-pulse" };
  const last = lastBySource.get(msg.id) || 0;
  if (now - last < MP_PULSE_COOLDOWN_MS) return { ok: false, reason: "cooldown" };
  // A household fox's pulse lands from anywhere — its coordinates
  // may belong to another realm entirely and mean nothing here.
  const ofTheHouse = !!(house && typeof house.has === "function" && house.has(msg.id));
  if (!ofTheHouse && mpDistXZ(msg.p, selfPos) > MP_TOGETHER_RADIUS)
    return { ok: false, reason: "too-far" };
  return { ok: true, heal: MP_PULSE_HEAL, from: msg.id, name: msg.name || msg.id };
}
