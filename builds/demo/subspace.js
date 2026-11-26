// Nova Fox demo — the subspace module.
//
// Everything that touches the document lives here, separable from the
// rendering: phext parse/serialize, the inscription log (the demo's
// stand-in for runtime WAL segments), pocket generation, Life, gravity
// settle, and the monster step rule. The deterministic kernels (seed
// hash, pocket foam, Life step) run in the WASM core (core.rs) when it
// instantiates, and fall back to identical JS implementations when it
// doesn't — same algorithms, same outputs, either way.
//
// In the brief's stack this module is the WASM core's job description:
// at MVP step it moves behind phext-lattice as the resident world +
// WAL writer. Here it is one shared document in memory — which is also
// what makes "one shared open world" true inside a single demo page.

export const AXES = [
  "library", "series", "shelf", "collection", "volume", "book",
  "chapter", "section", "scroll", "line", "column",
];
export const NOTE_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
export const FLUX62 =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const SCROLL_BREAK = "\x17";
export const ROOM_W = 20;
export const ROOM_H = 13;

export const PORTAL_COLORS = {
  _: "#e5484d", "&": "#46a758", "@": "#3e63dd", "{": "#12a594",
  "}": "#bf4ec9", "|": "#f5d90a", "[": "#e8e8e8", "]": "#666677",
  "^": "#2a1a3e",
};
export const PORTAL_GLYPHS = "_&@{ }|[]^".replace(" ", "");

// ---------- deterministic kernels (JS fallbacks, bit-identical) ----

function scramble(h) {
  h = (h ^ (h << 13)) >>> 0;
  h = (h ^ (h >>> 17)) >>> 0;
  h = (h ^ (h << 5)) >>> 0;
  return h >>> 0;
}

function xorshift(s) {
  s = (s ^ (s << 13)) >>> 0;
  s = (s ^ (s >>> 17)) >>> 0;
  s = (s ^ (s << 5)) >>> 0;
  return s >>> 0;
}

const _enc = new TextEncoder();

export function hashStringJS(str) {
  let h = 2166136261 >>> 0;
  for (const b of _enc.encode(str)) {
    h = Math.imul(h ^ b, 16777619) >>> 0;
  }
  return scramble(h);
}

export function genFoamJS(seed, w, h) {
  let s = scramble((seed ^ 0x9e3779b9) >>> 0);
  if (s === 0) s = 0x2545f491;
  const out = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) out[i] = "=";
      else {
        s = xorshift(s);
        out[i] = s % 100 < 30 ? "=" : " ";
      }
    }
  }
  return out.join("");
}

export function lifeStepJS(layer, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && layer[ny * w + nx]) n++;
        }
      }
      const alive = layer[y * w + x] !== 0;
      out[y * w + x] = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
    }
  }
  return out;
}

// ---------- kernel set: WASM when available, JS otherwise ----------

export const kernels = {
  usingWasm: false,
  _ex: null,
  _mem: null,
  async init(wasmBytes) {
    if (wasmBytes) {
      try {
        const { instance } = await WebAssembly.instantiate(wasmBytes, {});
        this._ex = instance.exports;
        this._mem = this._ex.memory;
        this.usingWasm = true;
        return true;
      } catch (e) {
        this.usingWasm = false;
      }
    }
    return false;
  },
  _in(n) {
    return new Uint8Array(this._mem.buffer, this._ex.in_ptr(), n);
  },
  _out(n) {
    return new Uint8Array(this._mem.buffer, this._ex.out_ptr(), n);
  },
  hash(str) {
    if (this.usingWasm) {
      const bytes = _enc.encode(str);
      this._in(bytes.length).set(bytes);
      return this._ex.hash_bytes(bytes.length) >>> 0;
    }
    return hashStringJS(str);
  },
  foam(seed, w, h) {
    if (this.usingWasm) {
      this._ex.gen_foam(seed >>> 0, w, h);
      return String.fromCharCode(...this._out(w * h));
    }
    return genFoamJS(seed, w, h);
  },
  life(layer, w, h) {
    if (this.usingWasm) {
      this._in(layer.length).set(layer);
      this._ex.life_step(w, h);
      return new Uint8Array(this._out(w * h));
    }
    return lifeStepJS(layer, w, h);
  },
};

// ---------- the document (one shared world) + inscription log ------

export function coordStr(c) {
  return (
    `${c[0]}.${c[1]}.${c[2]}/${c[3]}.${c[4]}.${c[5]}/${c[6]}.${c[7]}.${c[8]}`
  );
}

export class Doc {
  constructor(text) {
    this.scrolls = new Map(); // coordStr -> text
    this.pockets = new Map(); // seedStr -> coordStr (tunes inscribed)
    this.wal = []; // inscription segments, in order
    this.seq = 0;
    const parts = text.split(SCROLL_BREAK);
    parts.forEach((t, i) => {
      const c = [1, 1, 1, 1, 1, 1, 1, 1, i + 1];
      this.scrolls.set(coordStr(c), t);
    });
    this.startScrollCount = this.scrolls.size;
    this.log("genesis", coordStr([1, 1, 1, 1, 1, 1, 1, 1, 1]),
      `${this.scrolls.size} scrolls loaded into RAM`);
  }
  log(op, coord, detail) {
    this.wal.push({ seq: ++this.seq, op, coord, detail });
  }
  get(coord) {
    return this.scrolls.get(coord);
  }
  has(coord) {
    return this.scrolls.has(coord);
  }
  get scrollCount() {
    return this.scrolls.size;
  }
  inscribe(coord, text, op, detail) {
    this.scrolls.set(coord, text);
    this.log(op, coord, detail);
  }
  addScroll(coordArr, text, op, detail) {
    const key = coordStr(coordArr);
    this.scrolls.set(key, text);
    this.log(op, key, detail);
    return key;
  }
  serialize() {
    return [...this.scrolls.values()].join(SCROLL_BREAK);
  }
}

// ---------- room grids ----------------------------------------------

export function gridFromText(text) {
  const lines = text.split("\n");
  const w = Math.max(...lines.map((l) => l.length));
  const rows = lines.map((l) => l.padEnd(w, " ").split(""));
  return { w, h: rows.length, rows };
}

export function textFromGrid(g) {
  return g.rows.map((r) => r.join("")).join("\n");
}

export function cellAt(g, x, y) {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return "=";
  return g.rows[y][x];
}

export function isFlux(ch) {
  return FLUX62.includes(ch);
}

// Glyph surfaces hold you up (roads, portals, stuff, marks). Air and
// flux do not — you fall through them until something holds you.
const SURFACES = ":_&@{ }|[]^?*+,$%!#~./".replace(" ", "");
export function isStandable(g, x, y) {
  const c = cellAt(g, x, y);
  if (c === "=") return false;
  if (SURFACES.includes(c)) return true;
  return cellAt(g, x, y + 1) === "=";
}

// Fall one cell at a time along gravity until standable. Returns the
// resting position, whether the entity fell out of the room, and every
// cell passed through (so glyphs on the way still count as entered).
export function settle(g, pos, gdir) {
  let { x, y } = pos;
  const path = [{ x, y }];
  while (!isStandable(g, x, y)) {
    y += gdir;
    if (y < 0 || y >= g.h) return { pos: { x, y }, fellOut: true, path };
    path.push({ x, y });
  }
  return { pos: { x, y }, fellOut: false, path };
}

// One attempted step (one tick of movement), then gravity settles.
// Horizontal steps auto-step up one cell onto a solid whose top is
// free (the platformer rule); pure up is a hop that gravity answers.
// Returns the resting position, fellOut, and every cell entered.
export function stepEntity(g, pos, dx, dy, gdir) {
  let { x, y } = pos;
  const path = [{ x, y }];
  if (dx !== 0) {
    if (cellAt(g, x + dx, y) !== "=") {
      x += dx;
    } else if (
      cellAt(g, x + dx, y - 1) !== "=" &&
      cellAt(g, x, y - 1) !== "="
    ) {
      x += dx;
      y -= 1;
    }
    path.push({ x, y });
  }
  if (dy !== 0 && cellAt(g, x, y + dy) !== "=") {
    y += dy;
    path.push({ x, y });
  }
  const s = settle(g, { x, y }, gdir);
  for (const c of s.path.slice(1)) path.push(c);
  return { pos: s.pos, fellOut: s.fellOut, path };
}

// ---------- Life over a room ----------------------------------------

// mode 'earth' (pockets): the earth layer itself evolves in-document.
// mode 'flux' (authored rooms): the flux ecology evolves in-document;
//   structural earth and glyphs are untouched, so authored rooms stay
//   authored while their noise lives. (Demo scoping — brief G22-G24.)
export function lifeStepRoom(g, mode, salt) {
  const layer = new Uint8Array(g.w * g.h);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.rows[y][x];
      layer[y * g.w + x] =
        mode === "earth" ? (c === "=" ? 1 : 0) : isFlux(c) ? 1 : 0;
    }
  }
  const next = kernels.life(layer, g.w, g.h);
  const out = { w: g.w, h: g.h, rows: g.rows.map((r) => [...r]) };
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = out.rows[y][x];
      const alive = next[y * g.w + x] === 1;
      if (mode === "earth") {
        if (c === "=" || c === " ") out.rows[y][x] = alive ? "=" : " ";
      } else {
        if (isFlux(c) || c === " ") {
          out.rows[y][x] = alive
            ? FLUX62[kernels.hash(`${x},${y},${salt}`) % 62]
            : " ";
        }
      }
    }
  }
  return out;
}

// ---------- pockets --------------------------------------------------

// A chord at a coordinate opens a pocket: foam from the seed hash of
// coordinate+tune, Life-evolved before entry, carved so its road runs
// spawn -> gate, then inscribed into the document as a new scroll.
// Re-playing the same tune at the same coordinate reopens the same
// pocket — it is written down now (doc.pockets), scars and all.
export function openPocket(doc, originCoord, triple) {
  const seedStr = `${originCoord}|${triple.join(",")}`;
  if (doc.pockets.has(seedStr)) {
    return { coord: doc.pockets.get(seedStr), reopened: true };
  }
  const seed = kernels.hash(seedStr);
  const w = ROOM_W, h = ROOM_H;
  const foam = kernels.foam(seed, w, h);
  let g = gridFromText(
    Array.from({ length: h }, (_, y) => foam.slice(y * w, y * w + w)).join("\n")
  );
  // Life-evolve the foam before entry, border pinned.
  for (let i = 0; i < 14; i++) {
    g = lifeStepRoom(g, "earth", i);
    for (let x = 0; x < w; x++) {
      g.rows[0][x] = "=";
      g.rows[h - 1][x] = "=";
    }
    for (let y = 0; y < h; y++) {
      g.rows[y][0] = "=";
      g.rows[y][w - 1] = "=";
    }
  }
  // A pocket rng, from the same seed — placement is deterministic too.
  let rngState = scramble((seed ^ 0x51ab) >>> 0) || 1;
  const rng = () => {
    rngState = xorshift(rngState);
    return rngState;
  };
  const road = h - 2;
  for (let x = 1; x < w - 1; x++) g.rows[road][x] = ":";
  g.rows[road][2] = "/";
  g.rows[road][17] = "^";
  g.rows[road][12] = "*";
  g.rows[road][8] = ".";
  // A lava strip under the ceiling: flipping gravity here is a weapon.
  const strip = 4 + (rng() % 9);
  for (let x = strip; x < strip + 3; x++) {
    if (g.rows[1][x] === " ") g.rows[1][x] = ".";
  }
  // Flux: the unchosen dimensions, leaking in.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (g.rows[y][x] === " " && rng() % 100 < 16) {
        g.rows[y][x] = FLUX62[rng() % 62];
      }
    }
  }
  const pocketIndex =
    [...doc.scrolls.keys()].filter((k) => k.split("/")[2].startsWith("1.2."))
      .length + 1;
  const coordArr = [1, 1, 1, 1, 1, 1, 1, 2, pocketIndex];
  const key = doc.addScroll(coordArr, textFromGrid(g), "pocket",
    `tune ${triple.join("+")} at ${originCoord}`);
  doc.pockets.set(seedStr, key);
  doc.log("tune", originCoord, `notes ${triple.join("+")} opened ${key}`);
  return { coord: key, reopened: false, monsterStart: { x: 15, y: road } };
}

// ---------- derived views --------------------------------------------

// A view is derived from a scroll, never stored: its detail seed comes
// from the coordinate and a derivation epoch. Re-derive (new epoch) and
// the detail re-rolls — similar, never identical — while everything
// inscribed in the document comes back exactly. (The reload law.)
export function viewSeedFor(coord, epoch) {
  return kernels.hash(`${coord}#view${epoch}`);
}

// ---------- monsters --------------------------------------------------

// One step toward the player along the axis with the largest gap
// (the brief's whole monster brain). Solid cells block; try the other
// axis, else stay.
export function monsterStep(g, m, player) {
  const dx = player.x - m.x;
  const dy = player.y - m.y;
  const axes =
    Math.abs(dx) >= Math.abs(dy)
      ? [{ x: Math.sign(dx), y: 0 }, { x: 0, y: Math.sign(dy) }]
      : [{ x: 0, y: Math.sign(dy) }, { x: Math.sign(dx), y: 0 }];
  for (const a of axes) {
    if (a.x === 0 && a.y === 0) continue;
    const nx = m.x + a.x, ny = m.y + a.y;
    if (cellAt(g, nx, ny) !== "=") return { x: nx, y: ny };
  }
  return { x: m.x, y: m.y };
}

// The escalation law: danger follows the size of the world.
// MVP measure: scroll count; speed doubles when the world doubles.
export function monsterSpeed(doc) {
  return doc.scrollCount >= doc.startScrollCount * 2 ? 2 : 1;
}
