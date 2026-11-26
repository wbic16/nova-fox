// Nova Fox demo2 — the world module: subspace physics + generation.
//
// Two halves, one rule (Will's clarification, REVIEW-1 #4):
//
//   * PHYSICS lives entirely in subspace. Per-scroll Life grids step
//     here; monsters step here; gravity is a per-scroll fact stored
//     here; nearby scrolls act on yours non-locally — the Life step
//     reads across scroll borders, and monsters cross them.
//   * The 3D world is GENERATED from that state: genChunk() is a pure
//     function of (realm seed, the scroll states it touches, chunk
//     coordinates). Same state in -> same blocks out. The view layer
//     (game2.js) holds no world truth of its own; it meshes what this
//     module generates and reports events back for inscription.
//
// The deterministic kernels (seed hash, foam, Life step) run in the
// WASM core (core.rs, carried over from demo v1) when it instantiates,
// with bit-identical JS fallbacks — same algorithms either way.
//
// The inscription log is the demo's stand-in for runtime WAL segments:
// every consequential event appends a segment, in order, and nothing
// inscribed is ever removed. (On-disk WAL + snapshot/replay and the
// phext-lattice resident world are MVP steps 2-3, as in v1's plan.)

// ---------- constants -------------------------------------------------

export const WORLD_H = 64; // block columns are y in [0, WORLD_H)
export const CHUNK = 16; // chunk edge, in blocks
export const SCROLL = 64; // scroll edge, in blocks (4x4 chunks)
export const LIFE_N = 32; // Life grid edge, in cells (1 cell = 2 blocks)
export const CEIL_Y = 46; // riftstone vault underside when gravity flips

export const BLOCK = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WOOD: 4, LEAF: 5,
  ASH: 6, REDROCK: 7, BASALT: 8, EMBER: 9, BRICK: 10,
  DEEPSTONE: 11, SCAR: 12, CRYSTAL: 13, VAULT: 14, BEDROCK: 15,
  SANDSTONE: 16,
};
const SOLID = new Set(Object.values(BLOCK).filter((v) => v !== 0));
export function isSolid(b) {
  return SOLID.has(b);
}

// ---------- realms ------------------------------------------------------
// Nova Prime is home. The other ten take the names of the first ten
// ranch nodes (wiring.phext record order) — REVIEW-1 #12. Only the
// first two are open in this demo slice; the rest are named and shut.

export const REALMS = [
  { id: "nova", name: "Nova Prime", seed: "nova-prime", open: true },
  { id: "ashfall", name: "Ashfall Haven", seed: "ashfall-haven", open: true },
  { id: "ni-knight", name: "Ni-Knight", seed: "ni-knight", open: false },
  { id: "logos", name: "Logos Prime", seed: "logos-prime", open: false },
  { id: "elven", name: "Elven Path", seed: "elven-path", open: false },
  { id: "orchid", name: "Orchid Flow", seed: "orchid-flow", open: false },
  { id: "halycon", name: "Halycon Vector", seed: "halycon-vector", open: false },
  { id: "delta", name: "Delta Wood", seed: "delta-wood", open: false },
  { id: "willow", name: "Best Willow", seed: "best-willow", open: false },
  { id: "plain", name: "Plain View", seed: "plain-view", open: false },
  { id: "trust", name: "Trust Fall", seed: "trust-fall", open: false },
];
export function realmById(id) {
  return REALMS.find((r) => r.id === id);
}
// Where a crossing lands you in each open realm (block x, z).
export const ARRIVAL = { nova: { x: 8, z: 8 }, ashfall: { x: 8, z: 8 } };

// The bridge tune: the one chord the guide teaches. In Nova Prime it
// crosses to Ashfall Haven; in Ashfall Haven it crosses home.
export const BRIDGE_CHORD = [1, 4, 9];

// ---------- the quest (Nova Prime): the Deep Stone ----------------------
// A generated dungeon pocket inside scroll (0,0) of Nova Prime:
// a hall under the hill, a glowing deep stone at its far end, and a
// guardian the subspace keeps there.

export const DUNGEON = {
  realm: "nova",
  x0: 40, x1: 63, z0: 26, z1: 45, // footprint (blocks, inclusive)
  floorY: 4, ceilY: 10, // hall interior: floor top at floorY+1
  shaftX: 44, shaftZ: 30, // entrance shaft (3x3), from the surface down
  deepStone: { x: 60, y: 6, z: 35 }, // the goal block (on a pedestal)
  guardianCell: { gx: 27, gy: 19 }, // global Life-cell coords of the guardian
};
export function inDungeon(x, z) {
  return x >= DUNGEON.x0 && x <= DUNGEON.x1 && z >= DUNGEON.z0 && z <= DUNGEON.z1;
}

// ---------- deterministic kernels (JS fallbacks, bit-identical) --------

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
  for ( let y = 0; y < h; y++) {
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

// ---------- small deterministic noise (terrain) --------------------------

// Lattice value noise over block coords, from the seed hash. Pure.
function latticeHash(seedStr, x, z) {
  return kernels.hash(`${seedStr}|${x},${z}`) / 4294967296;
}
function vnoise(seedStr, x, z, cell) {
  const gx = Math.floor(x / cell), gz = Math.floor(z / cell);
  const fx = x / cell - gx, fz = z / cell - gz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = latticeHash(seedStr, gx, gz), b = latticeHash(seedStr, gx + 1, gz);
  const c = latticeHash(seedStr, gx, gz + 1), d = latticeHash(seedStr, gx + 1, gz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

// Surface height of a column, from the realm seed alone (Life never
// moves the ground itself — it grows features on it; see genChunk).
export function heightAt(realmId, x, z) {
  const r = realmById(realmId);
  const n1 = vnoise(`${r.seed}|h1`, x, z, 18);
  const n2 = vnoise(`${r.seed}|h2`, x, z, 5);
  if (realmId === "ashfall") {
    // Sharper, more rugged: ridged noise.
    const ridge = 1 - Math.abs(2 * n1 - 1);
    return Math.max(4, Math.floor(9 + ridge * ridge * 13 + n2 * 3));
  }
  let h = Math.floor(11 + n1 * 7 + n2 * 2.5);
  // The Deep Stone barrow: a raised hill over the dungeon footprint,
  // so the hall always has rock above its ceiling.
  if (x >= DUNGEON.x0 - 2 && x <= DUNGEON.x1 + 2 &&
      z >= DUNGEON.z0 - 2 && z <= DUNGEON.z1 + 2) {
    h += 7;
  }
  return h;
}

// ---------- scroll coordinates -------------------------------------------
// Blocks -> scrolls -> Life cells, all in "global" per-realm coords.

export function scrollOfBlock(b) {
  return Math.floor(b / SCROLL);
}
export function cellOfBlock(b) {
  return Math.floor(b / 2);
}
function scrollKey(realmId, sx, sy) {
  return `${realmId}|${sx},${sy}`;
}

// ---------- the subspace ---------------------------------------------------
// One Subspace holds every realm's live scroll states, the monsters,
// the block overrides (scars), and the inscription log. The game view
// reads generation inputs from here and reports events back here.

export class Subspace {
  constructor() {
    this.scrolls = new Map(); // scrollKey -> ScrollState
    this.monsters = []; // monster records (see spawnMonster)
    this.overrides = new Map(); // realmId -> Map("x,y,z" -> block)
    this.wal = []; // inscription segments, in order
    this.seq = 0;
    this.tickCount = 0;
    this.hatGranted = false;
    this.questDone = false;
    this.genesisLife = null; // total alive cells when the first scrolls opened
    this._monsterSeq = 0;
    this.log("genesis", "the chart", "the world is loaded; the dark is counted, not empty");
  }

  log(op, where, detail) {
    this.wal.push({ seq: ++this.seq, op, where, detail });
  }

  // --- scrolls ---------------------------------------------------------

  getScroll(realmId, sx, sy, create = true) {
    const key = scrollKey(realmId, sx, sy);
    let s = this.scrolls.get(key);
    if (!s && create) s = this._createScroll(realmId, sx, sy);
    return s || null;
  }

  _createScroll(realmId, sx, sy) {
    const r = realmById(realmId);
    const seed = kernels.hash(`${r.seed}|scroll|${sx},${sy}`);
    const foam = kernels.foam(seed, LIFE_N, LIFE_N);
    let grid = new Uint8Array(LIFE_N * LIFE_N);
    for (let i = 0; i < foam.length; i++) grid[i] = foam[i] === "=" ? 1 : 0;
    // Pockets arrive already grown: evolve before anyone enters.
    for (let i = 0; i < 12; i++) grid = kernels.life(grid, LIFE_N, LIFE_N);
    const s = {
      realmId, sx, sy, seed,
      grid, // Uint8Array LIFE_N*LIFE_N — the scroll's living state
      gravDir: 1, // +1: down is -y. -1: down is +y (the place remembers)
      born: this.tickCount,
    };
    this.scrolls.set(scrollKey(realmId, sx, sy), s);
    this.log("scroll", `${r.name} ${sx},${sy}`,
      `a page of the chart opens (${this.lifeOf(s)} living cells)`);
    if (this.genesisLife === null) {
      // Baseline for the escalation law, taken once the spawn
      // neighborhood exists (the game ensures 3x3 at boot).
      let total = 0;
      for (const sc of this.scrolls.values()) total += this.lifeOf(sc);
      if (this.scrolls.size >= 9) this.genesisLife = total;
    }
    // Monsters live in subspace from the start: most scrolls hold one.
    if (kernels.hash(`${r.seed}|mon|${sx},${sy}`) % 100 < 70) {
      const gx = sx * LIFE_N + 6 + (kernels.hash(`${r.seed}|mx|${sx},${sy}`) % 20);
      const gy = sy * LIFE_N + 6 + (kernels.hash(`${r.seed}|my|${sx},${sy}`) % 20);
      this.spawnMonster(realmId, gx, gy, "surface");
    }
    if (realmId === DUNGEON.realm && sx === 0 && sy === 0) {
      this.spawnMonster(realmId, DUNGEON.guardianCell.gx, DUNGEON.guardianCell.gy,
        "guardian");
    }
    return s;
  }

  lifeOf(scroll) {
    let n = 0;
    for (let i = 0; i < scroll.grid.length; i++) n += scroll.grid[i];
    return n;
  }
  totalLife() {
    let n = 0;
    for (const s of this.scrolls.values()) n += this.lifeOf(s);
    return n;
  }
  // The escalation law, demo measure: monster speed follows the size
  // of the living world — Life-cell total across opened scrolls.
  monsterSpeed() {
    if (this.genesisLife === null) return 1;
    return this.totalLife() >= this.genesisLife * 2 ? 2 : 1;
  }

  // Read one Life cell in GLOBAL cell coords (crosses scroll borders
  // transparently — this is what makes the physics non-local).
  cellAlive(realmId, gx, gy, create = false) {
    const sx = Math.floor(gx / LIFE_N), sy = Math.floor(gy / LIFE_N);
    const s = this.getScroll(realmId, sx, sy, create);
    if (!s) return 0;
    const lx = gx - sx * LIFE_N, ly = gy - sy * LIFE_N;
    return s.grid[ly * LIFE_N + lx];
  }
  // Density of living cells in the 3x3 neighborhood of a global cell.
  cellDensity(realmId, gx, gy) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        n += this.cellAlive(realmId, gx + dx, gy + dy, false);
    return n;
  }

  // --- physics tick ------------------------------------------------------
  // One tick of the world's own physics, all of it in subspace:
  //   1. Life steps on every live scroll, with neighbor counts read
  //      across scroll borders (non-local coupling — a birth on your
  //      edge can be caused by cells in the next scroll).
  //   2. Monsters step toward the player (largest-gap axis), in cell
  //      space; crossing a scroll border is a press-in, and is logged.
  //   3. Visibility phases advance (a monster is *there* — visible and
  //      dangerous — one phase in three: its slice agreeing with yours).
  // player: {realmId, bx, bz} in block coords, or null.
  tick(player) {
    this.tickCount++;
    const live = [...this.scrolls.values()];
    // Life, coupled. Snapshot all grids first so every scroll steps
    // from the same instant.
    const snaps = new Map();
    for (const s of live) snaps.set(scrollKey(s.realmId, s.sx, s.sy), s.grid);
    const aliveIn = (realmId, gx, gy) => {
      const sx = Math.floor(gx / LIFE_N), sy = Math.floor(gy / LIFE_N);
      const g = snaps.get(scrollKey(realmId, sx, sy));
      if (!g) return 0;
      return g[(gy - sy * LIFE_N) * LIFE_N + (gx - sx * LIFE_N)];
    };
    for (const s of live) {
      const next = new Uint8Array(LIFE_N * LIFE_N);
      const ox = s.sx * LIFE_N, oy = s.sy * LIFE_N;
      for (let ly = 0; ly < LIFE_N; ly++) {
        for (let lx = 0; lx < LIFE_N; lx++) {
          const gx = ox + lx, gy = oy + ly;
          let n = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              n += aliveIn(s.realmId, gx + dx, gy + dy);
            }
          const alive = s.grid[ly * LIFE_N + lx] !== 0;
          next[ly * LIFE_N + lx] = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
        }
      }
      s.grid = next;
    }
    // Monsters.
    const speed = this.monsterSpeed();
    for (const m of this.monsters) {
      if (!m.alive) continue;
      m.phase = (m.phase + 1) % 3;
      if (!player || player.realmId !== m.realmId) continue;
      const pcx = cellOfBlock(player.bx), pcy = cellOfBlock(player.bz);
      for (let step = 0; step < speed; step++) this._monsterStep(m, pcx, pcy);
    }
  }

  _monsterStep(m, pcx, pcy) {
    const dx = pcx - m.gx, dy = pcy - m.gy;
    if (dx === 0 && dy === 0) return;
    const axes =
      Math.abs(dx) >= Math.abs(dy)
        ? [{ x: Math.sign(dx), y: 0 }, { x: 0, y: Math.sign(dy) }]
        : [{ x: 0, y: Math.sign(dy) }, { x: Math.sign(dx), y: 0 }];
    const fromScroll = `${Math.floor(m.gx / LIFE_N)},${Math.floor(m.gy / LIFE_N)}`;
    for (const a of axes) {
      if (a.x === 0 && a.y === 0) continue;
      const nx = m.gx + a.x, ny = m.gy + a.y;
      if (!this._monsterPassable(m, nx, ny)) continue;
      m.gx = nx;
      m.gy = ny;
      const toScroll = `${Math.floor(m.gx / LIFE_N)},${Math.floor(m.gy / LIFE_N)}`;
      if (toScroll !== fromScroll) {
        this.log("press-in", `${realmById(m.realmId).name} ${toScroll}`,
          "the dark thing crosses from the next page, unfelt until seen");
      }
      return;
    }
  }

  // Recoil after contact: step away from the player, in subspace.
  _monsterStepBack(m, away) {
    const tries = [
      { x: away.x, y: 0 }, { x: 0, y: away.y }, { x: away.x, y: away.y },
    ];
    for (const a of tries) {
      if (a.x === 0 && a.y === 0) continue;
      const nx = m.gx + a.x, ny = m.gy + a.y;
      if (this._monsterPassable(m, nx, ny)) {
        m.gx = nx;
        m.gy = ny;
        return;
      }
    }
  }

  _monsterPassable(m, gx, gy) {
    const bx = gx * 2 + 1, bz = gy * 2 + 1;
    if (m.kind === "guardian") {
      // The guardian keeps the hall.
      return bx >= DUNGEON.x0 + 1 && bx <= DUNGEON.x1 - 1 &&
        bz >= DUNGEON.z0 + 1 && bz <= DUNGEON.z1 - 1;
    }
    // Surface things walk the surface: a step is fine if the ground
    // doesn't jump by more than a body-height.
    const cur = heightAt(m.realmId, m.gx * 2 + 1, m.gy * 2 + 1);
    const nxt = heightAt(m.realmId, bx, bz);
    return Math.abs(nxt - cur) <= 3;
  }

  // --- monsters ------------------------------------------------------------

  spawnMonster(realmId, gx, gy, kind) {
    const m = {
      id: ++this._monsterSeq, realmId, gx, gy, kind,
      phase: 1 + (kernels.hash(`phase|${this._monsterSeq}`) % 2),
      alive: true,
      hp: kind === "guardian" ? 3 : 1,
    };
    this.monsters.push(m);
    return m;
  }
  monsterVisible(m) {
    return m.alive && m.phase === 0;
  }
  // A strike that lands: the thing is edited out of the world, and
  // the place keeps the scar — an override the generator will honor
  // on every future derivation of that chunk.
  strikeMonster(m) {
    if (!m.alive) return false;
    m.hp--;
    if (m.hp > 0) {
      this.log("strike", realmById(m.realmId).name,
        `the ${m.kind === "guardian" ? "guardian" : "dark thing"} is struck and holds (${m.hp} left)`);
      return false;
    }
    m.alive = false;
    const bx = m.gx * 2 + 1, bz = m.gy * 2 + 1;
    const by = m.kind === "guardian" ? DUNGEON.floorY + 1 : heightAt(m.realmId, bx, bz) + 1;
    this.setOverride(m.realmId, bx, by, bz, BLOCK.SCAR);
    this.log("scar", `${realmById(m.realmId).name} ${bx},${bz}`,
      "struck out of the world; the place keeps the scar");
    return true;
  }

  // --- gravity ---------------------------------------------------------------

  gravityOf(realmId, sx, sy) {
    const s = this.getScroll(realmId, sx, sy, false);
    return s ? s.gravDir : 1;
  }
  flipGravity(realmId, sx, sy) {
    const s = this.getScroll(realmId, sx, sy, true);
    s.gravDir = -s.gravDir;
    this.log("warp", `${realmById(realmId).name} ${sx},${sy}`,
      `down is now ${s.gravDir > 0 ? "down" : "up"} in this place — the place remembers`);
    return s.gravDir;
  }

  // --- overrides (scars and other inscribed block edits) ----------------------

  setOverride(realmId, x, y, z, block) {
    if (!this.overrides.has(realmId)) this.overrides.set(realmId, new Map());
    this.overrides.get(realmId).set(`${x},${y},${z}`, block);
  }
  getOverride(realmId, x, y, z) {
    const m = this.overrides.get(realmId);
    return m ? m.get(`${x},${y},${z}`) : undefined;
  }

  // --- the quest ----------------------------------------------------------------

  // Returns true exactly once: the moment the player first reaches
  // the deep stone. The prize is an inscription — a hat, granted in
  // the log, worn in the view.
  checkQuest(bx, by, bz) {
    if (this.questDone) return false;
    const d = DUNGEON.deepStone;
    const near =
      Math.abs(bx - d.x) <= 2 && Math.abs(bz - d.z) <= 2 && Math.abs(by - d.y) <= 3;
    if (!near) return false;
    this.questDone = true;
    this.hatGranted = true;
    this.log("quest", "the Deep Stone",
      "the deep stone is reached — the chart itself bows");
    this.log("grant", "the Deep Stone",
      "a hat is granted, and written down: it stays");
    return true;
  }
}

// ---------- chords: the instrument is the teleport -------------------------

// Given the player's realm, the realm-scroll they stand in, and a
// played chord (3 distinct note numbers, any order), where does the
// tune take them? Pure and deterministic.
//   -> {type:'realm', realmId}          the bridge tune, realm-crossing
//   -> {type:'pocket', realmId, sx, sy} a page of the same realm
//   -> {type:'stay'}                    the tune of the page you are on
export function chordTarget(sub, realmId, sx, sy, chord, currentChord) {
  const sorted = [...chord].sort((a, b) => a - b);
  const isBridge =
    sorted.length === BRIDGE_CHORD.length &&
    sorted.every((n, i) => n === BRIDGE_CHORD[i]);
  if (isBridge) {
    if (realmId === "nova") return { type: "realm", realmId: "ashfall" };
    if (realmId === "ashfall") return { type: "realm", realmId: "nova" };
  }
  if (currentChord &&
      sorted.length === currentChord.length &&
      sorted.every((n, i) => n === currentChord[i])) {
    return { type: "stay" };
  }
  const h = kernels.hash(`${realmId}|chord|${sorted.join(",")}`);
  let dx = (h % 5) - 2;
  let dy = ((h >> 3) % 5) - 2;
  if (dx === 0 && dy === 0) dx = 1;
  return { type: "pocket", realmId, sx: sx + dx, sy: sy + dy, chord: sorted };
}

// ---------- generation: subspace state -> voxel chunks ----------------------

// Block at a world position from the BASE generation only (terrain +
// dungeon + vault), without Life features or overrides. Used by the
// generator itself and by view-layer collision fallback. Callers
// generating whole columns pass the column height `h` in — heightAt
// is the expensive call and must run once per column, not per block.
export function baseBlockAt(sub, realmId, x, y, z, h = heightAt(realmId, x, z)) {
  if (y < 0 || y >= WORLD_H) return BLOCK.AIR;
  if (y === 0) return BLOCK.BEDROCK;
  // The dungeon is carved into Nova Prime's hill country.
  if (realmId === DUNGEON.realm && inDungeon(x, z)) {
    const db = dungeonBlockAt(x, y, z, h);
    if (db !== null) return db;
  }
  if (y > h) {
    // The riftstone vault: generated only where the place's gravity
    // is turned — the ceiling exists because subspace says down is up.
    const sx = scrollOfBlock(x), sy = scrollOfBlock(z);
    if (sub.gravityOf(realmId, sx, sy) < 0 && (y === CEIL_Y || y === CEIL_Y + 1)) {
      return BLOCK.VAULT;
    }
    return BLOCK.AIR;
  }
  if (realmId === "ashfall") {
    if (y === h) return BLOCK.ASH;
    if (y >= h - 2) return BLOCK.REDROCK;
    return y % 7 < 3 ? BLOCK.BASALT : BLOCK.STONE;
  }
  if (y === h) return BLOCK.GRASS;
  if (y >= h - 3) return BLOCK.DIRT;
  return BLOCK.STONE;
}

// The dungeon overlay. Returns a block, or null for "carve air here"
// handled by the caller via the CARVE sentinel: we return -1 for air
// that must override terrain.
const CARVE = -1;
function dungeonBlockAt(x, y, z, surfaceH) {
  const D = DUNGEON;
  const inShaft =
    x >= D.shaftX && x < D.shaftX + 3 && z >= D.shaftZ && z < D.shaftZ + 3;
  const inHall = x > D.x0 && x < D.x1 && z > D.z0 && z < D.z1;
  if (inShaft && y > D.ceilY) {
    // The way down: open air, with one foothold brick per level
    // walking the shaft's perimeter — a spiral you can climb back up,
    // one jump at a time. The center stays open for the drop.
    if (y >= surfaceH) return CARVE;
    const href = heightAt(DUNGEON.realm, D.shaftX + 1, D.shaftZ + 1);
    const PERIM = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]];
    const pi = (((href - y) % 8) + 8) % 8;
    const [px, pz] = PERIM[pi];
    if (x - D.shaftX === px && z - D.shaftZ === pz) return BLOCK.BRICK;
    return CARVE;
  }
  if (x === D.x0 || x === D.x1 || z === D.z0 || z === D.z1) {
    if (y > D.floorY && y <= D.ceilY + 1) return BLOCK.BRICK; // hall walls
    return null;
  }
  if (inHall) {
    if (y === D.floorY) return BLOCK.BRICK; // hall floor
    if (y === D.ceilY + 1) return BLOCK.BRICK; // hall ceiling (rock above)
    if (y > D.floorY && y <= D.ceilY) {
      // The deep stone on its pedestal.
      if (x === D.deepStone.x && z === D.deepStone.z) {
        if (y === D.deepStone.y - 1) return BLOCK.STONE;
        if (y === D.deepStone.y) return BLOCK.DEEPSTONE;
      }
      // A few pillars, deterministic.
      if ((x - D.x0) % 8 === 4 && (z - D.z0) % 9 === 5) return BLOCK.BRICK;
      return CARVE;
    }
  }
  return null;
}

// How hard the neighbor across the nearest border is pressing in:
// the alive fraction of the neighbor scroll's edge line adjacent to
// this cell's scroll, when the cell is within 2 cells of that border.
const _edgeCol = (scroll, col) => {
  let n = 0;
  for (let i = 0; i < LIFE_N; i++) n += scroll.grid[i * LIFE_N + col];
  return n / LIFE_N;
};
const _edgeRow = (scroll, row) => {
  let n = 0;
  for (let i = 0; i < LIFE_N; i++) n += scroll.grid[row * LIFE_N + i];
  return n / LIFE_N;
};
export function borderPressure(sub, realmId, gx, gy, cache) {
  const sx = Math.floor(gx / LIFE_N), sy = Math.floor(gy / LIFE_N);
  const lx = gx - sx * LIFE_N, ly = gy - sy * LIFE_N;
  let pressure = 0;
  const get = (nsx, nsy, side, fn) => {
    const key = `${nsx},${nsy},${side}`;
    if (cache && cache.has(key)) return cache.get(key);
    const nb = sub.getScroll(realmId, nsx, nsy, false);
    const v = nb ? fn(nb) : 0;
    if (cache) cache.set(key, v);
    return v;
  };
  if (lx <= 1) pressure = Math.max(pressure, get(sx - 1, sy, "e", (s) => _edgeCol(s, LIFE_N - 1)));
  if (lx >= LIFE_N - 2) pressure = Math.max(pressure, get(sx + 1, sy, "w", (s) => _edgeCol(s, 0)));
  if (ly <= 1) pressure = Math.max(pressure, get(sx, sy - 1, "s", (s) => _edgeRow(s, LIFE_N - 1)));
  if (ly >= LIFE_N - 2) pressure = Math.max(pressure, get(sx, sy + 1, "n", (s) => _edgeRow(s, 0)));
  return pressure;
}

// Full chunk generation: base + Life-grown features + inscribed
// overrides. Pure in (subspace state, chunk coords): the same state
// always generates the same chunk, byte for byte.
export function genChunk(sub, realmId, cx, cz) {
  const data = new Uint8Array(CHUNK * CHUNK * WORLD_H);
  const pressureCache = new Map();
  const idx = (lx, y, lz) => (y * CHUNK + lz) * CHUNK + lx;
  const put = (lx, y, lz, b) => {
    if (lx < 0 || lz < 0 || lx >= CHUNK || lz >= CHUNK || y < 0 || y >= WORLD_H) return;
    data[idx(lx, y, lz)] = b;
  };
  const x0 = cx * CHUNK, z0 = cz * CHUNK;

  for (let lz = 0; lz < CHUNK; lz++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = x0 + lx, z = z0 + lz;
      const h = heightAt(realmId, x, z);
      for (let y = 0; y < WORLD_H; y++) {
        let b = baseBlockAt(sub, realmId, x, y, z, h);
        if (b === CARVE) b = BLOCK.AIR;
        if (b !== BLOCK.AIR) put(lx, y, lz, b);
      }
      // Life-grown features: where the living pattern runs dense, the
      // world grows rift crystal on the surface. Density is read in
      // global cell coords, so growth near a border is fed by the
      // NEIGHBOR scroll's cells too — the non-local effect, visible.
      const gx = cellOfBlock(x), gy = cellOfBlock(z);
      const density = sub.cellDensity(realmId, gx, gy);
      const isCellCenter = x % 2 === 0 && z % 2 === 0;
      if (density >= 6 && isCellCenter) {
        const top = h + 1;
        // Never grow through the dungeon or the vault.
        if (!(realmId === DUNGEON.realm && inDungeon(x, z))) {
          const grow = Math.min(density - 5, 4);
          for (let i = 0; i < grow; i++) {
            const y = top + i;
            if (y < CEIL_Y - 1) put(lx, y, lz, BLOCK.CRYSTAL);
          }
        }
      } else if (density === 5 && isCellCenter &&
                 kernels.hash(`${realmId}|bloom|${x},${z}`) % 4 === 0) {
        if (!(realmId === DUNGEON.realm && inDungeon(x, z)) && h + 1 < CEIL_Y - 1) {
          put(lx, h + 1, lz, realmId === "ashfall" ? BLOCK.EMBER : BLOCK.CRYSTAL);
        }
      }
      // Border pressure: within 2 cells of a scroll border, the
      // NEIGHBOR scroll's living edge presses in through the physics
      // coupling — crystal grows along the seam on YOUR side, fed by
      // cells that are not in your scroll at all. (The second
      // non-local effect; the first is in the Life step itself.)
      if (isCellCenter && !(realmId === DUNGEON.realm && inDungeon(x, z))) {
        const pressure = borderPressure(sub, realmId, gx, gy, pressureCache);
        if (pressure >= 0.45 && h + 1 < CEIL_Y - 1) {
          const grow = 1 + Math.floor(pressure * 3);
          for (let i = 0; i < grow; i++) put(lx, h + 1 + i, lz, BLOCK.CRYSTAL);
        }
      }
    }
  }

  // Trees (Nova Prime) / dead snags (Ashfall): placed per column from
  // the seed hash, with a 2-block margin pass so canopies cross chunk
  // borders seamlessly.
  const treeP = realmId === "ashfall" ? 0.004 : 0.011;
  for (let z = z0 - 2; z < z0 + CHUNK + 2; z++) {
    for (let x = x0 - 2; x < x0 + CHUNK + 2; x++) {
      if (realmId === DUNGEON.realm && inDungeon(x, z)) continue;
      const r = realmById(realmId);
      const roll = kernels.hash(`${r.seed}|tree|${x},${z}`) % 1000 / 1000;
      if (roll >= treeP) continue;
      const h = heightAt(realmId, x, z);
      // No trees on steep ground.
      if (Math.abs(heightAt(realmId, x + 1, z) - h) > 1) continue;
      const trunk = 3 + (kernels.hash(`${r.seed}|th|${x},${z}`) % 3);
      for (let i = 1; i <= trunk; i++) {
        put(x - x0, h + i, z - z0, BLOCK.WOOD);
      }
      if (realmId === "nova") {
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            for (let dz = -1; dz <= 1; dz++) {
              if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;
              const px = x + dx, py = h + trunk + dy, pz = z + dz;
              if (baseBlockAt(sub, realmId, px, py, pz) === BLOCK.AIR) {
                put(px - x0, py, pz - z0, BLOCK.LEAF);
              }
            }
      }
    }
  }

  // Inscribed overrides last: what was written, stays.
  const ov = sub.overrides.get(realmId);
  if (ov) {
    for (const [key, b] of ov) {
      const [x, y, z] = key.split(",").map(Number);
      const lx = x - x0, lz = z - z0;
      if (lx >= 0 && lz >= 0 && lx < CHUNK && lz < CHUNK && y >= 0 && y < WORLD_H) {
        data[idx(lx, y, lz)] = b;
      }
    }
  }
  return data;
}

export function chunkBlock(data, lx, y, lz) {
  if (lx < 0 || lz < 0 || lx >= CHUNK || lz >= CHUNK || y < 0 || y >= WORLD_H) {
    return BLOCK.AIR;
  }
  return data[(y * CHUNK + lz) * CHUNK + lx];
}
