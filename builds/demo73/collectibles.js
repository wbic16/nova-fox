// ---------- collectibles (EE 1348): the Homecoming chart logic ------------
// The Homecoming (COLLECTIBLES-DESIGN.md, as amended by Will's
// EE 1316 and EE ~1333 rulings): every character declared in the
// registry stands in their realm, is met exactly once, and the
// meeting lands server-side through the gateway's check-and-set
// (POST /api/v2/collect). The registry in nova-phox-world is the
// truth — index scroll at 1.1.1/1.1.6/1.1.1, one record scroll per
// character at 1.1.1/1.2.1/<k> — and the per-user collection scroll
// is the truth about who has come home. The client holds a cached
// view only (design section 3).
//
// This module is pure logic: no DOM, no storage, no clock, no
// network — exactly like economy.js / forms.js / ideas.js. The
// game glue (game3.js) owns persistence, the network, the meshes,
// and the panels; tests drive this file directly.

// ---------- coordinates ---------------------------------------------------
export const COLLECT_REGISTRY_COORD = "1.1.1/1.1.6/1.1.1"; // registry INDEX
export function collectRecordCoord(k) { return `1.1.1/1.2.1/${k}`; }

// ---------- the house hash --------------------------------------------------
// FNV-1a 64-bit over the UTF-8 bytes — the same hash the gateway
// uses (gateway.py fnv1a64_bytes), computed with BigInt so the
// 64-bit wrap is exact.
const _collectEnc = new TextEncoder();
export function collectFnv1a64(text) {
  let h = 0xcbf29ce484222325n;
  for (const b of _collectEnc.encode(String(text))) {
    h ^= BigInt(b);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h;
}

// The per-user collection scroll coordinate, derived exactly as
// the gateway derives it (gateway.py collection_coord): the hash
// as 8 big-endian bytes, each byte + 1, under a leading volume 3.
export function collectionCoordFor(sub) {
  const h = collectFnv1a64(sub || "");
  const parts = [3];
  for (let i = 7; i >= 0; i--) parts.push(Number((h >> BigInt(i * 8)) & 0xffn) + 1);
  return `${parts[0]}.${parts[1]}.${parts[2]}/${parts[3]}.${parts[4]}.${parts[5]}/${parts[6]}.${parts[7]}.${parts[8]}`;
}

// ---------- registry parsing --------------------------------------------------
// INDEX scroll shape (import_collectibles_registry_v2.py):
//   line 1:  collectibles-registry|<total>|ee<EE>
//   entries: entry|<k>|<character id>|<record coordinate>|<realm name>
export function parseCollectRegistryIndex(text) {
  const out = { total: 0, entries: [] };
  for (const ln of String(text || "").split("\n")) {
    const p = ln.split("|");
    if (p[0] === "collectibles-registry" && p.length >= 2) {
      const n = Number(p[1]);
      if (Number.isFinite(n)) out.total = n;
    } else if (p[0] === "entry" && p.length >= 5 && p[2]) {
      out.entries.push({ k: Number(p[1]), id: p[2], coord: p[3], realm: p[4] });
    }
  }
  if (!out.total) out.total = out.entries.length;
  return out;
}

// Record scroll shape (record_body in the registry import):
//   collectible|<id>|<name>|<realm name>
//   aliases|<a>|<b>            (optional)
//   home-coordinate|<coord>    (optional)
//   provenance|<source pointer>
//   section|<derivation tag>
export function parseCollectRecord(text) {
  let rec = null;
  for (const ln of String(text || "").split("\n")) {
    const p = ln.split("|");
    if (p[0] === "collectible" && p.length >= 4 && p[1]) {
      rec = { id: p[1], name: p[2], realm: p[3], aliases: [], provenance: "", home: null, section: "" };
    } else if (rec && p[0] === "aliases") {
      rec.aliases = p.slice(1).filter((a) => a !== "");
    } else if (rec && p[0] === "provenance") {
      rec.provenance = p.slice(1).join("|");
    } else if (rec && p[0] === "home-coordinate") {
      rec.home = p[1] || null;
    } else if (rec && p[0] === "section") {
      rec.section = p[1] || "";
    }
  }
  return rec;
}

// The name a record carries, split into display name and epithet:
// roster names ride as "Name — Epithet" (design section 1). Both
// halves come from the record; nothing is invented here.
export function collectNameParts(name) {
  const s = String(name || "");
  const i = s.indexOf(" — ");
  if (i < 0) return { name: s, epithet: "" };
  return { name: s.slice(0, i), epithet: s.slice(i + 3) };
}

// ---------- the collection scroll (the server's truth, read back) ------------
// Shape (gateway.py parse_collection):
//   line 1:  collection-of|<sub>
//   grants:  collected|<character id>|<realm name>|<EE at landing>
// headerOk is false when a non-empty scroll's first line is not
// this identity's header — such a scroll is never trusted.
export function parseCollectionScroll(text, sub) {
  const lines = String(text || "").split("\n").filter((ln) => ln !== "");
  if (!lines.length) return { grants: {}, headerOk: true };
  if (lines[0] !== "collection-of|" + sub) return { grants: {}, headerOk: false };
  const grants = {};
  for (const ln of lines.slice(1)) {
    const p = ln.split("|");
    if (p[0] === "collected" && p.length >= 4 && p[1]) {
      const ee = Number(p[3]);
      grants[p[1]] = Number.isFinite(ee) ? ee : p[3];
    }
  }
  return { grants, headerOk: true };
}

// ---------- placement ---------------------------------------------------------
// The stated deterministic rule (design section 2 + the encounter
// leg): placements live on the muffin table's ground — block
// columns in [-16, 80) x [-16, 80) around Arrival. A character's
// start cell is their registry id's hash taken mod the 9216-cell
// grid; within a realm, entries in registry order probe forward
// by a fixed stride (613 cells) until the cell is free and clear
// of the Arrival clearing (every realm's Arrival is (8, 8) in
// world.js, clearing radius 7 by Chebyshev distance — the muffin
// gate's own rule). Same registry in, same placements out, every
// visit. The standing height is NOT decided here: the glue stands
// each character on the realm's generated ground through the
// game's surfaceStandY, so nobody floats or sinks.
export const COLLECT_GRID_MIN = -16;
export const COLLECT_GRID_N = 96; // 96 x 96 cells in [-16, 80)^2
export const COLLECT_STRIDE = 613;
export function collectCellFor(id) {
  const start = Number(collectFnv1a64(id) % 9216n);
  return { bx: COLLECT_GRID_MIN + (start % COLLECT_GRID_N), bz: COLLECT_GRID_MIN + Math.floor(start / COLLECT_GRID_N), start };
}
function collectClearOfArrival(bx, bz) {
  return Math.max(Math.abs(bx - 8), Math.abs(bz - 8)) > 7;
}
export function placementsForRealm(entries) {
  const taken = new Set();
  const out = [];
  const sorted = [...entries].sort((a, b) => a.k - b.k);
  for (const e of sorted) {
    let { start } = collectCellFor(e.id);
    for (let probe = 0; probe < 9216; probe++) {
      const cell = (start + probe * COLLECT_STRIDE) % 9216;
      const bx = COLLECT_GRID_MIN + (cell % COLLECT_GRID_N);
      const bz = COLLECT_GRID_MIN + Math.floor(cell / COLLECT_GRID_N);
      const key = bx + "," + bz;
      if (taken.has(key) || !collectClearOfArrival(bx, bz)) continue;
      taken.add(key);
      out.push({ id: e.id, k: e.k, realm: e.realm, bx, bz });
      break;
    }
  }
  return out;
}

// ---------- the meeting -------------------------------------------------------
export const COLLECT_MEET_RANGE = 3.2; // blocks, fox to character
// The nearest standing meeting to a position, or null. Pure: the
// glue passes the current realm's placements and the fox's
// position; the trigger is this distance rule and nothing else.
export function nearestMeeting(placements, x, z) {
  let best = null, bestD = Infinity;
  for (const p of placements || []) {
    const d = Math.hypot(p.bx + 0.5 - x, p.bz + 0.5 - z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best && bestD <= COLLECT_MEET_RANGE ? { placement: best, dist: bestD } : null;
}

// The meeting beat, templated ONLY from fields the record carries
// (name, epithet, realm, aliases) plus the design's own closing
// line (design section 3: "You have brought <name> home."). The
// registry carries no dialogue lines — no biography is invented
// here; that gap is flagged in the leg's MR entry.
//   variant "first":     the meeting that lands the collection
//   variant "returning": already home — a friend, not a removal
//   variant "queued":    met, not yet landed — "met — coming home"
export function collectBeatText(record, variant, ee) {
  if (!record) return "";
  const parts = collectNameParts(record.name);
  const who = parts.epithet ? `${parts.name}, ${parts.epithet}` : parts.name;
  if (variant === "returning") {
    return `${who} is already home — you brought them home at EE ${ee}. They stay in ${record.realm}, as a friend.`;
  }
  if (variant === "queued") {
    return `You have met ${who}, of ${record.realm} — met, and coming home.`;
  }
  const aka = record.aliases && record.aliases.length
    ? ` Also known as ${record.aliases.join(", ")}.` : "";
  return `You have found ${who}, in ${record.realm}.${aka} You have brought ${parts.name} home.`;
}

// ---------- the client state machine -------------------------------------------
// The client's cached view. grants mirror the server scroll as
// read back or as answered by the gateway; queue holds unlanded
// meetings in the gateway's accepted queued shape, exactly:
//   {"character": <id>, "queued": true}
export function newCollectState() { return { grants: {}, queue: [] }; }
export function collectQueuedEntry(id) { return { character: id, queued: true }; }
export function collectIsQueued(state, id) {
  return state.queue.some((q) => q && q.character === id);
}
export function collectVariantFor(state, id) {
  if (state.grants[id] != null) return "returning";
  if (collectIsQueued(state, id)) return "queued";
  return "first";
}
// Queue a meeting that could not land. Refused when the character
// is already granted or already queued — a meeting queues once.
export function queueCollect(state, id) {
  if (!id || state.grants[id] != null || collectIsQueued(state, id)) return false;
  state.queue.push(collectQueuedEntry(id));
  return true;
}
// The request body the gateway accepts: the character id, and the
// queued flag only for a meeting that waited (design section 3).
export function collectRequestBody(id, queued) {
  return queued ? { character: id, queued: true } : { character: id };
}
// Fold a gateway answer into the cached view. "collected" lands
// the grant at the answer's EE; "already-home" RECONCILES to the
// server's original EE — the count does not move, because the
// grant was already the server's truth (a retry after a lost
// response meets exactly this). Either answer clears the queue
// entry: the meeting has landed, once.
export function applyCollectAnswer(state, id, answer) {
  if (!answer || answer.ok !== true) return null;
  if (answer.status !== "collected" && answer.status !== "already-home") return null;
  state.grants[id] = answer.ee;
  state.queue = state.queue.filter((q) => !(q && q.character === id));
  return answer.status;
}

// ---------- the surfaces -------------------------------------------------------
// The status board's line (design section 3). Both numbers come
// from the caller — the grant count from the read-back view, the
// total from the registry read-back. Nothing is hardcoded here.
export function collectBoardLine(state, total) {
  if (!total) return "";
  return `Brought home: ${Object.keys(state.grants).length} of ${total}`;
}
// The Homecoming book (design section 3): per realm, the collected
// stand by name with the EE they arrived; the met-but-unlanded
// stand by name as "met — coming home"; the unmet appear ONLY as
// a realm hint — a count, never a name. Names come from the
// records the glue has read back (recordsById); a collected
// character whose record has not been read yet is counted in the
// realm's hint until their record lands, never named from thin air.
export function collectBookLines(entries, recordsById, state) {
  const byRealm = new Map();
  for (const e of entries || []) {
    if (!byRealm.has(e.realm)) byRealm.set(e.realm, []);
    byRealm.get(e.realm).push(e);
  }
  const lines = [];
  for (const [realm, list] of byRealm) {
    const home = [], coming = [];
    let waiting = 0;
    for (const e of list) {
      const rec = recordsById ? recordsById[e.id] : null;
      if (state.grants[e.id] != null && rec) home.push({ name: rec.name, ee: state.grants[e.id] });
      else if (collectIsQueued(state, e.id) && rec) coming.push({ name: rec.name });
      else waiting++;
    }
    home.sort((a, b) => a.name.localeCompare(b.name));
    coming.sort((a, b) => a.name.localeCompare(b.name));
    lines.push(`${realm} — ${home.length + coming.length} of ${list.length} home`);
    for (const h of home) lines.push(`  ${h.name} — came home at EE ${h.ee}`);
    for (const c of coming) lines.push(`  ${c.name} — met, coming home`);
    if (waiting === 1) lines.push(`  1 more waits in ${realm}`);
    else if (waiting > 1) lines.push(`  ${waiting} more wait in ${realm}`);
  }
  return lines;
}
