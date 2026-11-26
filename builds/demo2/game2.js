// Nova Fox demo2 — view + input + game loop.
//
// Three.js renders a first-person voxel world GENERATED from subspace
// state (world.js). This file holds no world truth: terrain, features,
// gravity, monsters, and the quest all live in the Subspace; the view
// meshes what genChunk() derives, reports events back for inscription,
// and obeys the gravity the current scroll declares.
//
// The veil binds everything in-fiction: chart, rift, tune, page, the
// dark. The readout panel is demo instrumentation for Will, labelled
// as such — it may name machinery the fiction never mentions.

// ---------- boot ------------------------------------------------------

const wasmBytes = Uint8Array.from(atob(NOVA_CORE_WASM_B64), (c) =>
  c.charCodeAt(0)
);
await kernels.init(wasmBytes);

const sub = new Subspace();

const state = {
  realm: "nova",
  pos: new THREE.Vector3(8.5, 20, 8.5), // feet
  vel: new THREE.Vector3(),
  yaw: Math.PI * 0.75, // face the meadow, the barrow hill beyond
  pitch: -0.05,
  onGround: false,
  gravDir: 1,
  hp: 20, maxHp: 20,
  invulnUntil: 0,
  notes: [], // note numbers collected toward a chord
  notesTimer: null,
  pocketChord: null, // the tune of the pocket page we stand in, if any
  pocketScroll: null, // {sx, sy} of that pocket page
  lastScrollKey: "",
  movedTotal: 0,
  jumped: 0,
  notesPlayed: 0,
  flips: 0,
  guideStep: 0,
  guideDone: false,
  bobPhase: 0,
  dead: false,
};

// Spawn: Nova Prime, on the surface of the arrival column.
state.pos.set(ARRIVAL.nova.x + 0.5, heightAt("nova", ARRIVAL.nova.x, ARRIVAL.nova.z) + 1.01, ARRIVAL.nova.z + 0.5);
ensureNeighborhood(state.realm, 0, 0);

function playerScroll() {
  return {
    sx: scrollOfBlock(Math.floor(state.pos.x)),
    sy: scrollOfBlock(Math.floor(state.pos.z)),
  };
}
function ensureNeighborhood(realmId, sx, sy) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) sub.getScroll(realmId, sx + dx, sy + dy, true);
}

// ---------- small helpers ----------------------------------------------

const $ = (id) => document.getElementById(id);
function toast(text, ms = 6500) {
  const el = $("comms");
  el.textContent = text;
  el.style.opacity = "1";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.opacity = "0"; }, ms);
}
function realmName(id) {
  return realmById(id).name;
}

// ---------- audio (all synthesized; the world speaks) --------------------

const NOTE_SCALE = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17]; // semitones
const sfx = {
  ctx: null, master: null, windGain: null, stepAlt: false, muted: false,
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      // Ambient wind: looped noise through a low filter, barely there.
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        d[i] = last * 3.2;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass"; filt.frequency.value = 420;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.05;
      src.connect(filt).connect(this.windGain).connect(this.master);
      src.start();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.07; lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain).connect(this.windGain.gain);
      lfo.start();
    } catch (e) {
      this.ctx = null; // audio failed; the game goes on
    }
  },
  env(gain, t, peak, decay) {
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  },
  tone(freq, { type = "triangle", peak = 0.3, decay = 0.6, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + decay);
    this.env(g, t, peak, decay);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + decay + 0.05);
  },
  noise({ peak = 0.2, decay = 0.15, freq = 800, type = "bandpass", delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, (decay + 0.05) * this.ctx.sampleRate);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = peak;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  },
  pluck(noteIdx) {
    // The instrument: a plucked string, bright attack, long ring.
    const f = 196 * Math.pow(2, NOTE_SCALE[noteIdx] / 12);
    this.tone(f, { type: "triangle", peak: 0.5, decay: 0.9 });
    this.tone(f * 2, { type: "sine", peak: 0.18, decay: 0.45 });
  },
  step() {
    this.stepAlt = !this.stepAlt;
    this.noise({ peak: 0.10, decay: 0.07, freq: this.stepAlt ? 500 : 380 });
  },
  jump() { this.tone(300, { type: "sine", peak: 0.15, decay: 0.18, slide: 160 }); },
  land() { this.noise({ peak: 0.16, decay: 0.1, freq: 220, type: "lowpass" }); },
  hurt() {
    this.tone(140, { type: "sawtooth", peak: 0.3, decay: 0.25, slide: -60 });
    this.noise({ peak: 0.22, decay: 0.18, freq: 300, type: "lowpass" });
  },
  strikeHit() { this.noise({ peak: 0.3, decay: 0.12, freq: 1400 }); },
  strikeKill() {
    this.tone(520, { type: "square", peak: 0.22, decay: 0.5, slide: -380 });
    this.noise({ peak: 0.2, decay: 0.3, freq: 700 });
  },
  flip() {
    this.tone(180, { type: "sine", peak: 0.25, decay: 0.5, slide: 240 });
    this.tone(270, { type: "sine", peak: 0.15, decay: 0.5, slide: 360, delay: 0.06 });
  },
  portal() {
    [0, 4, 7, 11].forEach((st, i) =>
      this.tone(220 * Math.pow(2, st / 12), { peak: 0.22, decay: 0.8, delay: i * 0.07 }));
    this.noise({ peak: 0.12, decay: 0.7, freq: 1200, type: "highpass" });
  },
  chime() {
    [0, 4, 7, 12].forEach((st, i) =>
      this.tone(523 * Math.pow(2, st / 12), { type: "sine", peak: 0.25, decay: 0.9, delay: i * 0.09 }));
  },
};

// ---------- textures: a small hand-drawn atlas ----------------------------

const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, WOOD_SIDE: 4, WOOD_TOP: 5,
  LEAF: 6, ASH_TOP: 7, ASH_SIDE: 8, REDROCK: 9, BASALT: 10, EMBER: 11,
  BRICK: 12, DEEPSTONE: 13, SCAR: 14, CRYSTAL: 15, VAULT: 16, BEDROCK: 17,
};
const ATLAS_COLS = 6, ATLAS_ROWS = 3, TILE_PX = 32;
let atlasTexture = null;

function makeAtlas() {
  const cv = document.createElement("canvas");
  cv.width = ATLAS_COLS * TILE_PX;
  cv.height = ATLAS_ROWS * TILE_PX;
  const g = cv.getContext("2d");
  let rngState = 1234567;
  const rnd = () => {
    rngState = (Math.imul(rngState, 1103515245) + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };
  const tile = (idx, base, flecks, n = 90, size = 3) => {
    const ox = (idx % ATLAS_COLS) * TILE_PX, oy = Math.floor(idx / ATLAS_COLS) * TILE_PX;
    g.fillStyle = base; g.fillRect(ox, oy, TILE_PX, TILE_PX);
    for (let i = 0; i < n; i++) {
      g.fillStyle = flecks[Math.floor(rnd() * flecks.length)];
      g.fillRect(ox + Math.floor(rnd() * (TILE_PX - size)), oy + Math.floor(rnd() * (TILE_PX - size)),
        1 + Math.floor(rnd() * size), 1 + Math.floor(rnd() * size));
    }
    return [ox, oy];
  };
  tile(TILE.GRASS_TOP, "#5da83c", ["#4c9230", "#6fbc4a", "#7cc75a"]);
  {
    const [ox, oy] = tile(TILE.GRASS_SIDE, "#8a6844", ["#75552f", "#9c7a52", "#6b4c2a"]);
    g.fillStyle = "#5da83c"; g.fillRect(ox, oy, TILE_PX, 9);
    g.fillStyle = "#4c9230";
    for (let x = 0; x < TILE_PX; x += 4) g.fillRect(ox + x, oy + 9, 3, 2 + (x % 3));
  }
  tile(TILE.DIRT, "#8a6844", ["#75552f", "#9c7a52", "#654626"]);
  tile(TILE.STONE, "#7d7d84", ["#6a6a70", "#909096", "#5d5d63"]);
  {
    const [ox, oy] = tile(TILE.WOOD_SIDE, "#6b5133", ["#59422a", "#7d6040"]);
    g.fillStyle = "#59422a";
    for (let x = 3; x < TILE_PX; x += 8) g.fillRect(ox + x, oy, 2, TILE_PX);
  }
  {
    const [ox, oy] = tile(TILE.WOOD_TOP, "#a0824f", ["#8f7143", "#b08f58"]);
    g.strokeStyle = "#8f7143";
    for (let r = 4; r < 16; r += 4) { g.beginPath(); g.arc(ox + 16, oy + 16, r, 0, 7); g.stroke(); }
  }
  tile(TILE.LEAF, "#3e7d2a", ["#2f6620", "#4c9230", "#27591a"], 130, 4);
  tile(TILE.ASH_TOP, "#b8ab9c", ["#a29685", "#c9bda9", "#8f8474"]);
  tile(TILE.ASH_SIDE, "#9c8a76", ["#87755f", "#ab9a83", "#77664f"]);
  tile(TILE.REDROCK, "#a34a30", ["#8f3d27", "#b85a3a", "#7c3320"]);
  tile(TILE.BASALT, "#3d3a40", ["#2f2c33", "#4c4852", "#262329"]);
  {
    const [ox, oy] = tile(TILE.EMBER, "#2b2320", ["#3a2d26", "#1f1917"]);
    g.strokeStyle = "#ff7a2a"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(ox + 2, oy + 22); g.lineTo(ox + 12, oy + 14);
    g.lineTo(ox + 20, oy + 20); g.lineTo(ox + 30, oy + 10); g.stroke();
    g.strokeStyle = "#ffb84d";
    g.beginPath(); g.moveTo(ox + 6, oy + 28); g.lineTo(ox + 16, oy + 24); g.stroke();
  }
  {
    const [ox, oy] = tile(TILE.BRICK, "#6e6259", ["#5d534b", "#7d7166"]);
    g.fillStyle = "#4c443d";
    for (let y = 0; y < TILE_PX; y += 8) g.fillRect(ox, oy + y, TILE_PX, 2);
    for (let y = 0; y < TILE_PX; y += 16) {
      g.fillRect(ox + 8, oy + y, 2, 8); g.fillRect(ox + 24, oy + y + 8, 2, 8);
    }
  }
  {
    const [ox, oy] = tile(TILE.DEEPSTONE, "#4a3410", ["#5d4216", "#3a2a0c"]);
    g.fillStyle = "#ffd76a";
    for (const [dx, dy] of [[8, 8], [22, 12], [14, 22], [26, 26], [6, 26]]) {
      g.fillRect(ox + dx, oy + dy, 3, 3);
    }
    g.strokeStyle = "#ffd76a"; g.lineWidth = 2;
    g.strokeRect(ox + 4, oy + 4, TILE_PX - 8, TILE_PX - 8);
  }
  tile(TILE.SCAR, "#17151a", ["#232028", "#0d0c10", "#2e2a33"], 70);
  {
    const [ox, oy] = tile(TILE.CRYSTAL, "#8f7fd9", ["#a794e8", "#7765c4", "#c0b2f2"], 60, 4);
    g.fillStyle = "#e6defc";
    for (const [dx, dy] of [[6, 6], [20, 10], [12, 22]]) g.fillRect(ox + dx, oy + dy, 4, 4);
  }
  {
    const [ox, oy] = tile(TILE.VAULT, "#2c3140", ["#232833", "#363c4e"]);
    g.strokeStyle = "#4a5878"; g.lineWidth = 1;
    g.strokeRect(ox + 1, oy + 1, TILE_PX - 2, TILE_PX - 2);
    g.beginPath(); g.moveTo(ox + 16, oy); g.lineTo(ox + 16, oy + TILE_PX); g.stroke();
  }
  tile(TILE.BEDROCK, "#4a4a52", ["#3a3a42", "#5a5a64", "#2e2e35"], 110, 5);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// block -> [top, side, bottom] tiles
const BLOCK_TILES = {
  [BLOCK.GRASS]: [TILE.GRASS_TOP, TILE.GRASS_SIDE, TILE.DIRT],
  [BLOCK.DIRT]: [TILE.DIRT, TILE.DIRT, TILE.DIRT],
  [BLOCK.STONE]: [TILE.STONE, TILE.STONE, TILE.STONE],
  [BLOCK.WOOD]: [TILE.WOOD_TOP, TILE.WOOD_SIDE, TILE.WOOD_TOP],
  [BLOCK.LEAF]: [TILE.LEAF, TILE.LEAF, TILE.LEAF],
  [BLOCK.ASH]: [TILE.ASH_TOP, TILE.ASH_SIDE, TILE.REDROCK],
  [BLOCK.REDROCK]: [TILE.REDROCK, TILE.REDROCK, TILE.REDROCK],
  [BLOCK.BASALT]: [TILE.BASALT, TILE.BASALT, TILE.BASALT],
  [BLOCK.EMBER]: [TILE.EMBER, TILE.EMBER, TILE.EMBER],
  [BLOCK.BRICK]: [TILE.BRICK, TILE.BRICK, TILE.BRICK],
  [BLOCK.DEEPSTONE]: [TILE.DEEPSTONE, TILE.DEEPSTONE, TILE.DEEPSTONE],
  [BLOCK.SCAR]: [TILE.SCAR, TILE.SCAR, TILE.SCAR],
  [BLOCK.CRYSTAL]: [TILE.CRYSTAL, TILE.CRYSTAL, TILE.CRYSTAL],
  [BLOCK.VAULT]: [TILE.VAULT, TILE.VAULT, TILE.VAULT],
  [BLOCK.BEDROCK]: [TILE.BEDROCK, TILE.BEDROCK, TILE.BEDROCK],
  [BLOCK.SANDSTONE]: [TILE.ASH_SIDE, TILE.ASH_SIDE, TILE.ASH_SIDE],
};
const GLOW_BLOCKS = new Set([BLOCK.EMBER, BLOCK.DEEPSTONE, BLOCK.CRYSTAL]);

// ---------- three.js scene -------------------------------------------------

let scene, camera, renderer, hemi, sun;
const chunkStore = new Map(); // "realm|cx,cz" -> {data, group, meshKey}
const dirtyChunks = new Set();
const RENDER_R = 3;

function initThree() {
  const holder = $("stage");
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(74, 1, 0.1, 400);
  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  holder.appendChild(renderer.domElement);
  hemi = new THREE.HemisphereLight(0xcfe5ff, 0x54503a, 0.95);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
  sun.position.set(40, 80, 25);
  scene.add(sun);
  atlasTexture = makeAtlas();
  applyRealmSky();
  window.addEventListener("resize", onResize);
  onResize();
  renderer.setAnimationLoop(animate);
}

function applyRealmSky() {
  if (state.realm === "ashfall") {
    scene.background = new THREE.Color(0x584038);
    scene.fog = new THREE.Fog(0x584038, 30, 95);
    hemi.color.set(0xffd9b0); hemi.groundColor.set(0x4a2c1c); hemi.intensity = 0.75;
    sun.color.set(0xffb36b); sun.intensity = 1.15;
  } else {
    scene.background = new THREE.Color(0x7fb2dd);
    scene.fog = new THREE.Fog(0x7fb2dd, 34, 110);
    hemi.color.set(0xcfe5ff); hemi.groundColor.set(0x54503a); hemi.intensity = 0.95;
    sun.color.set(0xfff2dd); sun.intensity = 1.6;
  }
}

function onResize() {
  const holder = $("stage");
  const w = holder.clientWidth, h = holder.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ---------- chunk store: generate, mesh, rebuild ---------------------------

function chunkKey(cx, cz) {
  return `${state.realm}|${cx},${cz}`;
}
function getBlockWorld(x, y, z) {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  const e = chunkStore.get(chunkKey(cx, cz));
  if (e) return chunkBlock(e.data, x - cx * CHUNK, y, z - cz * CHUNK);
  return baseBlockAt(sub, state.realm, x, y, z);
}
function solidAt(x, y, z) {
  return isSolid(getBlockWorld(x, y, z));
}

const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], tile: 1 },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], tile: 1 },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], tile: 0 },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], tile: 2 },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], tile: 1 },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], tile: 1 },
];
const FACE_SHADE = [0.82, 0.82, 1.0, 0.62, 0.7, 0.7];

function buildChunkMesh(cx, cz, data) {
  const group = new THREE.Group();
  const buckets = { opaque: [], glow: [] };
  const geo = {
    opaque: { pos: [], norm: [], uv: [], col: [], idx: [] },
    glow: { pos: [], norm: [], uv: [], col: [], idx: [] },
  };
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  const blockAt = (x, y, z) => {
    if (x >= x0 && x < x0 + CHUNK && z >= z0 && z < z0 + CHUNK) {
      return chunkBlock(data, x - x0, y, z - z0);
    }
    return getBlockWorld(x, y, z);
  };
  for (let y = 0; y < WORLD_H; y++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const b = chunkBlock(data, lx, y, lz);
        if (b === BLOCK.AIR) continue;
        const wx = x0 + lx, wz = z0 + lz;
        const tiles = BLOCK_TILES[b] || BLOCK_TILES[BLOCK.STONE];
        const bucket = GLOW_BLOCKS.has(b) ? geo.glow : geo.opaque;
        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nb = blockAt(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
          // Every block is solid: a face shows only where it meets air.
          if (nb !== BLOCK.AIR) continue;
          const tileIdx = tiles[face.tile];
          const u0 = (tileIdx % ATLAS_COLS) / ATLAS_COLS;
          const v0 = 1 - (Math.floor(tileIdx / ATLAS_COLS) + 1) / ATLAS_ROWS;
          const du = 1 / ATLAS_COLS, dv = 1 / ATLAS_ROWS;
          const base = bucket.pos.length / 3;
          const shade = FACE_SHADE[f];
          for (const c of face.corners) {
            bucket.pos.push(wx + c[0], y + c[1], wz + c[2]);
            bucket.norm.push(...face.dir);
            bucket.col.push(shade, shade, shade);
          }
          bucket.uv.push(u0, v0 + dv, u0 + du, v0 + dv, u0 + du, v0, u0, v0);
          bucket.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }
  for (const kind of ["opaque", "glow"]) {
    const bk = geo[kind];
    if (!bk.idx.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(bk.pos, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(bk.norm, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(bk.uv, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(bk.col, 3));
    geometry.setIndex(bk.idx);
    const mat = kind === "glow"
      ? new THREE.MeshLambertMaterial({
          map: atlasTexture, vertexColors: true,
          emissive: 0xffffff, emissiveMap: atlasTexture, emissiveIntensity: 0.55,
        })
      : new THREE.MeshLambertMaterial({
          map: atlasTexture, vertexColors: true,
        });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    buckets[kind] = mesh;
  }
  return group;
}

// A chunk's generated form depends on: its scroll's gravity, the
// Life density of its cells (crystal growth), and the pressure along
// its seams (neighbor-scroll growth). Signature those inputs cheaply;
// regenerate only when they actually change. (Regenerating on every
// tick regardless was a storm that starved the frame rate.)
function chunkSignature(cx, cz) {
  const gx0 = cx * (CHUNK / 2), gz0 = cz * (CHUNK / 2); // cells are 2 blocks
  let density = 0;
  for (let gy = gz0; gy < gz0 + CHUNK / 2; gy++)
    for (let gx = gx0; gx < gx0 + CHUNK / 2; gx++)
      density += sub.cellDensity(state.realm, gx, gy);
  const mid = CHUNK / 4;
  const pressure =
    borderPressure(sub, state.realm, gx0 + mid, gz0, null) +
    borderPressure(sub, state.realm, gx0 + mid, gz0 + CHUNK / 2 - 1, null) +
    borderPressure(sub, state.realm, gx0, gz0 + mid, null) +
    borderPressure(sub, state.realm, gx0 + CHUNK / 2 - 1, gz0 + mid, null);
  const { sx, sy } = {
    sx: scrollOfBlock(cx * CHUNK), sy: scrollOfBlock(cz * CHUNK),
  };
  const grav = sub.gravityOf(state.realm, sx, sy);
  return `${density}|${pressure.toFixed(2)}|${grav}`;
}

function ensureChunk(cx, cz, remeshOnly = false) {
  const key = chunkKey(cx, cz);
  let e = chunkStore.get(key);
  if (!e) {
    const data = genChunk(sub, state.realm, cx, cz);
    const group = buildChunkMesh(cx, cz, data);
    scene.add(group);
    chunkStore.set(key, { data, group, sig: chunkSignature(cx, cz) });
    // Neighbors are NOT invalidated: a face of ours that should have
    // been culled by a neighbor's late-arriving feature ends up
    // embedded inside that feature — invisible. (Invalidating them
    // caused a boot-time rebuild storm.)
    return true;
  }
  if (remeshOnly) {
    const group = buildChunkMesh(cx, cz, e.data);
    scene.remove(e.group);
    disposeGroup(e.group);
    e.group = group;
    scene.add(group);
  }
  return false;
}

function regenerateChunk(cx, cz) {
  const key = chunkKey(cx, cz);
  const e = chunkStore.get(key);
  if (!e) return ensureChunk(cx, cz);
  e.data = genChunk(sub, state.realm, cx, cz);
  e.sig = chunkSignature(cx, cz);
  const group = buildChunkMesh(cx, cz, e.data);
  scene.remove(e.group);
  disposeGroup(e.group);
  e.group = group;
  scene.add(group);
}

function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

function markScrollChunksDirty(realmId, sx, sy) {
  if (realmId !== state.realm) return;
  for (let cx = sx * (SCROLL / CHUNK); cx < (sx + 1) * (SCROLL / CHUNK); cx++) {
    for (let cz = sy * (SCROLL / CHUNK); cz < (sy + 1) * (SCROLL / CHUNK); cz++) {
      const key = chunkKey(cx, cz);
      if (chunkStore.has(key)) dirtyChunks.add(key);
    }
  }
}

function chunkMaintenance() {
  const pcx = Math.floor(state.pos.x / CHUNK), pcz = Math.floor(state.pos.z / CHUNK);
  // Generate missing chunks near the player (a few per frame).
  let made = 0;
  for (let r = 0; r <= RENDER_R && made < 3; r++) {
    for (let dx = -r; dx <= r && made < 3; dx++) {
      for (let dz = -r; dz <= r && made < 3; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (ensureChunk(pcx + dx, pcz + dz)) made++;
      }
    }
  }
  // Rebuild a few explicitly-dirtied chunks (scars, new neighbors).
  let rebuilt = 0;
  for (const key of dirtyChunks) {
    if (rebuilt >= 2) break;
    dirtyChunks.delete(key);
    const [, rest] = key.split("|");
    const [cx, cz] = rest.split(",").map(Number);
    if (Math.abs(cx - pcx) <= RENDER_R + 1 && Math.abs(cz - pcz) <= RENDER_R + 1) {
      regenerateChunk(cx, cz);
      rebuilt++;
    }
  }
  // Signature sweep: Life moved somewhere — find the loaded chunks
  // whose generation inputs drifted and re-derive just those.
  if (rebuilt === 0) {
    let checked = 0;
    for (const [key, e] of chunkStore) {
      if (checked >= 10) break;
      const [realm, rest] = key.split("|");
      if (realm !== state.realm) continue;
      const [cx, cz] = rest.split(",").map(Number);
      if (Math.abs(cx - pcx) > RENDER_R + 1 || Math.abs(cz - pcz) > RENDER_R + 1) continue;
      checked++;
      if (chunkSignature(cx, cz) !== e.sig) {
        regenerateChunk(cx, cz);
        break; // one per frame is plenty; the world breathes slowly
      }
    }
  }
  // Drop far chunks.
  for (const [key, e] of chunkStore) {
    const [realm, rest] = key.split("|");
    const [cx, cz] = rest.split(",").map(Number);
    if (realm !== state.realm ||
        Math.abs(cx - pcx) > RENDER_R + 2 || Math.abs(cz - pcz) > RENDER_R + 2) {
      scene.remove(e.group);
      disposeGroup(e.group);
      chunkStore.delete(key);
    }
  }
}

// ---------- monsters in the view -------------------------------------------

const monsterMeshes = new Map(); // monster id -> THREE.Group
function buildMonsterMesh(guardian) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 0),
    new THREE.MeshLambertMaterial({
      color: 0x1a1426, emissive: 0x40186a, emissiveIntensity: 0.9,
      flatShading: true,
    })
  );
  body.position.y = 0.95;
  g.add(body);
  const spikeMat = new THREE.MeshLambertMaterial({ color: 0x241a38 });
  for (let i = 0; i < 6; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 5), spikeMat);
    const a = (i / 6) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.52, 0.95 + Math.sin(a) * 0.4, Math.sin(a) * 0.52 * 0 + (i % 2 ? 0.3 : -0.3));
    spike.rotation.z = a - Math.PI / 2;
    g.add(spike);
  }
  const eyeMat = new THREE.MeshLambertMaterial({
    color: 0x330000, emissive: guardian ? 0xffaa22 : 0xff2222, emissiveIntensity: 2.4,
  });
  for (const dz of [0.17, -0.17]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), eyeMat);
    eye.position.set(0.44, 1.05, dz);
    g.add(eye);
  }
  if (guardian) g.scale.setScalar(1.7);
  return g;
}
function monsterWorldPos(m) {
  const bx = m.gx * 2 + 1, bz = m.gy * 2 + 1;
  const y = m.kind === "guardian"
    ? DUNGEON.floorY + 1
    : heightAt(m.realmId, bx, bz) + 1;
  return { x: bx + 0.5, y, z: bz + 0.5 };
}
function syncMonsterMeshes(dt) {
  const seen = new Set();
  for (const m of sub.monsters) {
    if (!m.alive || m.realmId !== state.realm) continue;
    seen.add(m.id);
    let mesh = monsterMeshes.get(m.id);
    if (!mesh) {
      mesh = buildMonsterMesh(m.kind === "guardian");
      monsterMeshes.set(m.id, mesh);
      scene.add(mesh);
      const p = monsterWorldPos(m);
      mesh.position.set(p.x, p.y, p.z);
    }
    const visible = sub.monsterVisible(m);
    mesh.visible = visible;
    if (visible) {
      const p = monsterWorldPos(m);
      const target = new THREE.Vector3(p.x, p.y, p.z);
      mesh.position.lerp(target, 1 - Math.pow(0.001, dt));
      mesh.rotation.y += dt * 0.7;
      const s = (m.kind === "guardian" ? 1.7 : 1) * (1 + Math.sin(performance.now() / 260) * 0.05);
      mesh.scale.setScalar(s);
      // Face the player.
      mesh.rotation.y = Math.atan2(state.pos.x - p.x, state.pos.z - p.z) - Math.PI / 2;
    }
  }
  for (const [id, mesh] of monsterMeshes) {
    if (!seen.has(id)) {
      scene.remove(mesh);
      monsterMeshes.delete(id);
    }
  }
}

// ---------- player physics (the view obeys subspace gravity) ----------------

const HALF = 0.3, PHEIGHT = 1.8;
function playerBox() {
  const minY = state.gravDir > 0 ? state.pos.y : state.pos.y - PHEIGHT;
  return {
    minX: state.pos.x - HALF, maxX: state.pos.x + HALF,
    minY, maxY: minY + PHEIGHT,
    minZ: state.pos.z - HALF, maxZ: state.pos.z + HALF,
  };
}
function collides() {
  const b = playerBox();
  const x0 = Math.floor(b.minX), x1 = Math.floor(b.maxX - 1e-7);
  const y0 = Math.floor(b.minY), y1 = Math.floor(b.maxY - 1e-7);
  const z0 = Math.floor(b.minZ), z1 = Math.floor(b.maxZ - 1e-7);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++)
        if (solidAt(x, y, z)) return true;
  return false;
}
function moveAxis(axis, delta) {
  if (delta === 0) return false;
  // Substep so a fast fall can never tunnel through a 1-block floor.
  if (axis === "y" && Math.abs(delta) > 0.4) {
    const steps = Math.ceil(Math.abs(delta) / 0.4);
    let hit = false;
    for (let i = 0; i < steps; i++) {
      if (moveAxis("y", delta / steps)) { hit = true; break; }
    }
    return hit;
  }
  state.pos[axis] += delta;
  if (!collides()) return false;
  // Clamp back to the boundary of the block we hit.
  const b = playerBox();
  if (axis === "x") {
    state.pos.x = delta > 0
      ? Math.floor(b.maxX) - HALF - 1e-4
      : Math.floor(b.minX) + 1 + HALF + 1e-4;
  } else if (axis === "z") {
    state.pos.z = delta > 0
      ? Math.floor(b.maxZ) - HALF - 1e-4
      : Math.floor(b.minZ) + 1 + HALF + 1e-4;
  } else {
    if (state.gravDir > 0) {
      state.pos.y = delta > 0
        ? Math.floor(b.maxY) - PHEIGHT - 1e-4
        : Math.floor(b.minY) + 1 + 1e-4;
    } else {
      // Feet are the TOP of the box when down is up.
      state.pos.y = delta > 0
        ? Math.floor(b.maxY) - 1e-4 + 0 // moving up, feet stop at block bottom
        : Math.floor(b.minY) + 1 + PHEIGHT + 1e-4;
      if (delta > 0) state.pos.y = Math.floor(b.maxY) - 1e-4;
    }
  }
  // If still colliding (corner case), revert the move entirely.
  if (collides()) state.pos[axis] -= delta;
  return true;
}

// Horizontal move with a one-block step assist: meadow ground rises
// and falls a block at a time, and a fox should flow over it, not
// snag. (Stepping is toward away-from-ground, so it works on a
// ceiling too.)
function moveHorizontal(axis, delta) {
  const startA = state.pos[axis], startY = state.pos.y;
  if (!moveAxis(axis, delta)) return false;
  if (!state.onGround) return true;
  state.pos[axis] = startA;
  state.pos.y = startY + 1.02 * state.gravDir;
  if (collides()) {
    state.pos.y = startY;
    moveAxis(axis, delta);
    return true;
  }
  if (moveAxis(axis, delta)) {
    state.pos[axis] = startA;
    state.pos.y = startY;
    moveAxis(axis, delta);
    return true;
  }
  return false; // stepped up and moved; gravity settles us
}

const keys = new Set();
function updatePlayer(dt) {
  const { sx, sy } = playerScroll();
  const g = sub.gravityOf(state.realm, sx, sy);
  if (g !== state.gravDir) {
    // Down changed under the fox: keep the body's span exactly where
    // it is and move only the feet to the span's other end. (Without
    // this, the flipped box extends into the ground it stood on and
    // the collision clamp ratchets the player through the floor.)
    state.pos.y -= PHEIGHT * g;
    state.vel.y = 0;
    state.gravDir = g;
    toast(g > 0 ? "Down is down again here." : "Down is up here. The place says so.");
  }
  // Input direction in heading space. When down is up, your right
  // hand points the other way — the strafe sign follows gravity.
  let fwd = 0, strafe = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) fwd += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) fwd -= 1;
  if (keys.has("KeyD")) strafe += 1;
  if (keys.has("KeyA")) strafe -= 1;
  strafe *= state.gravDir;
  const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
  const wishX = (-sin * fwd + cos * strafe);
  const wishZ = (-cos * fwd - sin * strafe);
  const wishLen = Math.hypot(wishX, wishZ) || 1;
  const run = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const speed = run ? 6.8 : 4.4;
  const accel = state.onGround ? 42 : 12;
  state.vel.x += (wishX / wishLen) * (fwd || strafe ? accel : 0) * dt;
  state.vel.z += (wishZ / wishLen) * (fwd || strafe ? accel : 0) * dt;
  // Friction / clamp horizontal speed.
  const hSpeed = Math.hypot(state.vel.x, state.vel.z);
  const maxH = (fwd || strafe) ? speed : 0;
  if (state.onGround && !(fwd || strafe)) {
    const damp = Math.max(0, 1 - 14 * dt);
    state.vel.x *= damp; state.vel.z *= damp;
  } else if (hSpeed > speed) {
    state.vel.x *= speed / hSpeed; state.vel.z *= speed / hSpeed;
  }
  // Gravity — the scroll's word, not the view's.
  state.vel.y -= 23 * state.gravDir * dt;
  if (state.vel.y > 26) state.vel.y = 26;
  if (state.vel.y < -26) state.vel.y = -26;
  const wasGround = state.onGround;
  const prevVy = state.vel.y;
  const hitX = moveHorizontal("x", state.vel.x * dt);
  const hitZ = moveHorizontal("z", state.vel.z * dt);
  if (hitX) state.vel.x = 0;
  if (hitZ) state.vel.z = 0;
  const falling = Math.sign(state.vel.y) === -state.gravDir && state.vel.y !== 0;
  const hitY = moveAxis("y", state.vel.y * dt);
  state.onGround = hitY && falling;
  if (hitY) {
    if (!wasGround && Math.abs(prevVy) > 9) sfx.land();
    state.vel.y = 0;
  }
  // Head-bob + weave: the camera rides the stride; strafing leans.
  const moving = Math.hypot(state.vel.x, state.vel.z);
  if (state.onGround && moving > 0.6) {
    const prevPhase = state.bobPhase;
    state.bobPhase += dt * moving * 1.9;
    if (Math.sin(prevPhase) > 0 && Math.sin(state.bobPhase) <= 0) sfx.step();
    state.movedTotal += moving * dt;
  }
  state._lean = THREE.MathUtils.lerp(state._lean || 0, -strafe * 0.02, 1 - Math.pow(0.001, dt));
  // Fell out of the world entirely (should not happen; bedrock/vault).
  if (state.pos.y < -12 || state.pos.y > WORLD_H + 14) {
    hurtPlayer(2, null, "The chart loses your place for a moment.");
    respawnAtArrival();
  }
  // Scroll crossing: your passage is written where pages change.
  const key = `${state.realm}|${sx},${sy}`;
  if (state.lastScrollKey && key !== state.lastScrollKey) {
    sub.log("trail", `${realmName(state.realm)} ${sx},${sy}`,
      "your passage crosses into a new page");
    ensureNeighborhood(state.realm, sx, sy);
    // Leaving the pocket page behind: its tune no longer holds us.
    if (state.pocketScroll &&
        (state.pocketScroll.sx !== sx || state.pocketScroll.sy !== sy)) {
      state.pocketChord = null;
      state.pocketScroll = null;
    }
  }
  state.lastScrollKey = key;
}

function respawnAtArrival() {
  const a = ARRIVAL[state.realm];
  state.pos.set(a.x + 0.5, heightAt(state.realm, a.x, a.z) + 1.01, a.z + 0.5);
  state.vel.set(0, 0, 0);
  ensureNeighborhood(state.realm, 0, 0);
}

// ---------- damage, death, combat ---------------------------------------------

function flashDamage() {
  const el = $("dmg");
  el.style.transition = "none";
  el.style.opacity = "0.55";
  requestAnimationFrame(() => {
    el.style.transition = "opacity 0.7s";
    el.style.opacity = "0";
  });
}
function hurtPlayer(amount, fromPos, why) {
  const now = performance.now();
  if (now < state.invulnUntil || state.dead) return;
  state.hp -= amount;
  state.invulnUntil = now + 1200;
  sfx.hurt();
  flashDamage();
  if (fromPos) {
    const dx = state.pos.x - fromPos.x, dz = state.pos.z - fromPos.z;
    const len = Math.hypot(dx, dz) || 1;
    state.vel.x += (dx / len) * 7;
    state.vel.z += (dz / len) * 7;
    state.vel.y += 3.5 * state.gravDir;
  }
  if (state.hp <= 0) {
    state.dead = true;
    sub.log("return", realmName(state.realm),
      "carried back to Arrival; everything written stayed written");
    toast("The dark takes its due — and returns you to Arrival. Everything written stayed written.", 8000);
    setTimeout(() => {
      state.hp = 10;
      state.dead = false;
      respawnAtArrival();
      syncHud();
    }, 900);
  } else if (why) {
    toast(why);
  }
  syncHud();
}

function checkMonsterContact() {
  if (state.dead) return;
  for (const m of sub.monsters) {
    if (!m.alive || m.realmId !== state.realm || !sub.monsterVisible(m)) continue;
    const p = monsterWorldPos(m);
    const dx = state.pos.x - p.x, dz = state.pos.z - p.z;
    const dy = (state.pos.y + 0.9) - (p.y + 0.9);
    if (dx * dx + dz * dz < 1.5 && Math.abs(dy) < 2.1) {
      const before = state.hp;
      hurtPlayer(2, p, m.kind === "guardian"
        ? "The guardian reaches you. Strike it back — click, or F."
        : "It reaches you out of the dark.");
      if (state.hp < before) {
        sub.log("contact", realmName(state.realm),
          `the ${m.kind === "guardian" ? "guardian" : "dark thing"} reached you`);
        // It recoils to a distance — in subspace, where it lives.
        const away = { x: Math.sign(m.gx - cellOfBlock(Math.floor(state.pos.x))) || 1,
                       y: Math.sign(m.gy - cellOfBlock(Math.floor(state.pos.z))) || 0 };
        for (let i = 0; i < 3; i++) sub._monsterStepBack(m, away);
      }
    }
  }
}

function tryStrike() {
  if (state.dead) return;
  sfx.noise({ peak: 0.08, decay: 0.08, freq: 2000 }); // the swing itself
  const dir = new THREE.Vector3(0, 0, -1)
    .applyEuler(new THREE.Euler(state.pitch, state.yaw, 0, "YXZ"));
  const eye = eyePos();
  let best = null, bestT = 4.4;
  for (const m of sub.monsters) {
    if (!m.alive || m.realmId !== state.realm || !sub.monsterVisible(m)) continue;
    const p = monsterWorldPos(m);
    const center = new THREE.Vector3(p.x, p.y + 0.95, p.z);
    const to = center.clone().sub(eye);
    const t = to.dot(dir);
    if (t < 0 || t > bestT) continue;
    const closest = eye.clone().add(dir.clone().multiplyScalar(t));
    if (closest.distanceTo(center) < 1.15) { best = m; bestT = t; }
  }
  if (!best) return;
  const killed = sub.strikeMonster(best);
  if (killed) {
    sfx.strikeKill();
    const p = monsterWorldPos(best);
    const cx = Math.floor(p.x / CHUNK), cz = Math.floor(p.z / CHUNK);
    dirtyChunks.add(chunkKey(cx, cz));
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      dirtyChunks.add(chunkKey(cx + dx, cz + dz));
    }
    toast(best.kind === "guardian"
      ? "The guardian is struck out of the world. The hall is quiet."
      : "Struck out of the world. The place keeps the scar.");
  } else {
    sfx.strikeHit();
    toast("It holds. Strike again.");
  }
  syncReadout();
}

// ---------- the instrument: numbers are the teleport ----------------------------

const NUMBER_KEYS = {
  Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, Digit6: 6,
  Digit7: 7, Digit8: 8, Digit9: 9, Digit0: 10, Minus: 11,
};
const LETTER_KEYS = ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft"];

function playNote(n) {
  sfx.unlock();
  sfx.pluck(n - 1);
  state.notesPlayed++;
  if (!state.notes.includes(n)) state.notes.push(n);
  clearTimeout(state.notesTimer);
  state.notesTimer = setTimeout(() => { state.notes = []; syncHud(); }, 4000);
  if (state.notes.length === 3) {
    const chord = [...state.notes].sort((a, b) => a - b);
    state.notes = [];
    clearTimeout(state.notesTimer);
    playChord(chord);
  }
  syncHud();
  guideNotify("note");
}

function playChord(chord) {
  const { sx, sy } = playerScroll();
  const target = chordTarget(sub, state.realm, sx, sy, chord, state.pocketChord);
  sub.log("tune", `${realmName(state.realm)} ${sx},${sy}`,
    `notes ${chord.join("+")} — a tune is played, and written`);
  if (target.type === "stay") {
    toast("That tune is the page you are standing on. It hums, and holds.");
    return;
  }
  sfx.portal();
  flashPortal();
  if (target.type === "realm") {
    const from = state.realm;
    state.realm = target.realmId;
    sub.log("cross", realmName(state.realm),
      `the bridge tune carries you from ${realmName(from)}`);
    state.pocketChord = null;
    state.pocketScroll = null;
    respawnAtArrival();
    applyRealmSky();
    for (const [, mesh] of monsterMeshes) scene.remove(mesh);
    monsterMeshes.clear();
    toast(state.realm === "ashfall"
      ? "Ashfall Haven. The air tastes of cinders; the rock remembers fire."
      : "Nova Prime. Home meadow, green under a kind sky.", 8000);
    guideNotify("realm");
  } else {
    sub.getScroll(state.realm, target.sx, target.sy, true);
    state.pocketChord = target.chord;
    state.pocketScroll = { sx: target.sx, sy: target.sy };
    const cx = target.sx * SCROLL + SCROLL / 2, cz = target.sy * SCROLL + SCROLL / 2;
    state.pos.set(cx + 0.5, heightAt(state.realm, cx, cz) + 1.01, cz + 0.5);
    state.vel.set(0, 0, 0);
    ensureNeighborhood(state.realm, target.sx, target.sy);
    toast("The tune lands you on a far page of the chart.", 6000);
    guideNotify("pocket");
  }
  syncHud();
  syncReadout();
}

function flashPortal() {
  const el = $("flash");
  el.style.transition = "none";
  el.style.opacity = "0.85";
  requestAnimationFrame(() => {
    el.style.transition = "opacity 0.9s";
    el.style.opacity = "0";
  });
}

function flipGravityHere() {
  const { sx, sy } = playerScroll();
  const dir = sub.flipGravity(state.realm, sx, sy);
  state.flips++;
  sfx.flip();
  // The vault (or its absence) is generation: rebuild nearby NOW so
  // the new down has somewhere to land you.
  const pcx = Math.floor(state.pos.x / CHUNK), pcz = Math.floor(state.pos.z / CHUNK);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) regenerateChunk(pcx + dx, pcz + dz);
  markScrollChunksDirty(state.realm, sx, sy);
  toast(dir > 0 ? "Down is down. The place remembers." : "Down is up. The place remembers.", 5000);
  guideNotify("flip");
  syncReadout();
}

// ---------- the guide (Emise narrates; the guide guarantees the XP) --------------
// The first minutes are engineered so a fresh player cannot finish
// them without having DONE the two things that teach the world:
//   1. played a chord of three numbers and been carried somewhere
//      (movement is addressing), and
//   2. made a mark that stayed (the quest's hat is an inscription).
// The guide never explains either. It just makes sure they happen.

const GUIDE = [
  {
    id: "wake",
    lines: [
      "Wake up, fox. The galaxy is conquered — every star charted, every shore named. I am Emise; I keep the chart-line, and I'll walk with you a while.",
      "One thing the conquest never solved: the dark. Most of everything is dark, and it outweighs everything we can see.",
    ],
    button: "And then?",
  },
  {
    id: "rifts",
    lines: [
      "And then the rifts opened — places where the dark touches the chart. Things arrive that shouldn't exist. Pages appear that no one wrote.",
      "You are standing on one. Nova Prime. Click the world to take the helm — sound wakes with the click, so listen as you go.",
    ],
    button: "Take the helm",
    action: "helm",
  },
  {
    id: "move",
    lines: [
      "Feet first. Walk with W A S D (the arrows work too), look with the mouse, and jump with Space. The world is wide and it does not end at the fence — there is no fence.",
    ],
    until: () => state.movedTotal > 7 && state.jumped >= 1,
    hint: "Walk a little. Jump once.",
  },
  {
    id: "numbers",
    lines: [
      "Now — the numbers along the top of your keyboard are an instrument. So is the letter row beneath them. Press any number and listen.",
      "Three different notes together make a tune. And a tune, fox, is a place.",
    ],
    until: () => state.notesPlayed >= 1,
    hint: "Press a number key. Any one.",
  },
  {
    id: "bridge",
    lines: [
      "Here is the first tune worth knowing: 1 · 4 · 9. Play the three numbers, in any order, close together.",
      "It is the bridge tune. It will carry you to Ashfall Haven — and from there, the same tune carries you home.",
    ],
    until: () => state.realm === "ashfall",
    hint: "Play 1 · 4 · 9.",
  },
  {
    id: "ashfall",
    lines: [
      "Ash and red rock. Every page of the chart has its own weather, its own ground, its own temper.",
      "Things move in the dark here, as they do at home. Some of them you will only see in glimpses — watch for the glimpse, and strike then (click, or F).",
      "Play 1 · 4 · 9 when you're ready to go back.",
    ],
    until: () => state.realm === "nova",
    hint: "Play 1 · 4 · 9 to cross home.",
  },
  {
    id: "gravity",
    lines: [
      "One more verb before I leave you to it: G turns down itself. Down is not a law of the world — it is a habit of the place you stand in, and the place remembers what you tell it.",
      "Try it. (If you turn down up, look for the dark ceiling the rift provides — it was not there before you spoke.)",
    ],
    until: () => state.flips >= 1,
    hint: "Press G.",
  },
  {
    id: "quest",
    lines: [
      "East of where you first woke, a hill rises over an old hall — the barrow. In its deep room lies the Deep Stone, and something keeps it.",
      "Reach the stone. What you earn there is written down, and what is written down stays — while the grass and the light and the day itself are re-drawn around it.",
      "Go down the shaft in the hill's top. Strike with click or F. Mind your hearts — they are your whole story, told plainly.",
    ],
    until: () => sub.questDone,
    hint: "East, to the barrow. Reach the Deep Stone.",
  },
  {
    id: "done",
    lines: [
      "The hat is yours, and it is written where writing lasts. You know the two true things now, even if you'd never say them my way: a tune is a place, and what is written outlasts what is merely shown.",
      "The rest of the chart is yours — ten more realms are named on it, quiet for now. Press M to see their names. I'll be on the line when you need me.",
    ],
    button: "Explore",
  },
];

function guideCurrent() {
  return GUIDE[state.guideStep] || null;
}
function renderGuide() {
  const step = guideCurrent();
  const panel = $("guide");
  if (!step || state.guideDone) {
    panel.style.display = "none";
    return;
  }
  // When Emise teaches a tune, the slate is clean: notes noodled
  // during the earlier beats must not bleed into the taught chord
  // (a stray note would turn the bridge into some other place, and
  // the guided crossing — the thing the first minutes guarantee —
  // would silently not happen).
  if (step.id === "bridge" || step.id === "ashfall") {
    state.notes = [];
    clearTimeout(state.notesTimer);
    syncHud();
  }
  panel.style.display = "block";
  $("guide-lines").innerHTML = step.lines.map((l) => `<p>${l}</p>`).join("");
  const btn = $("guide-btn");
  if (step.button) {
    btn.style.display = "inline-block";
    btn.textContent = step.button;
  } else {
    btn.style.display = "none";
  }
  $("guide-hint").textContent = step.hint || "";
  updateObjective();
}
function guideAdvance() {
  state.guideStep++;
  if (state.guideStep >= GUIDE.length) state.guideDone = true;
  renderGuide();
  syncHud();
}
function guideNotify(kind) {
  // Movement/jump are polled in the frame loop; discrete events land here.
  const step = guideCurrent();
  if (!step || !step.until) return;
  if (step.until()) guideAdvance();
}
function updateObjective() {
  const el = $("objective");
  if (sub.questDone) {
    el.textContent = "The chart is yours. Explore.";
    return;
  }
  const step = guideCurrent();
  if (state.guideDone || !step) {
    el.textContent = "Objective: the Deep Stone, east of Arrival";
    return;
  }
  el.textContent = "Objective: " + (
    step.id === "move" ? "walk, and jump once" :
    step.id === "numbers" ? "press a number — the instrument" :
    step.id === "bridge" ? "play the bridge tune: 1 · 4 · 9" :
    step.id === "ashfall" ? "play 1 · 4 · 9 to cross home" :
    step.id === "gravity" ? "press G — turn down itself" :
    step.id === "quest" ? "the Deep Stone, east of Arrival" :
    "listen to Emise");
}

// ---------- HUD -------------------------------------------------------------------

function drawPortrait() {
  const cv = $("portrait");
  const g = cv.getContext("2d");
  g.clearRect(0, 0, 72, 72);
  // Fox face.
  g.fillStyle = "#e07b39";
  g.beginPath(); g.moveTo(14, 30); g.lineTo(24, 8); g.lineTo(34, 26); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(58, 30); g.lineTo(48, 8); g.lineTo(38, 26); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(36, 42, 22, 19, 0, 0, 7); g.fill();
  g.fillStyle = "#f5e6d3";
  g.beginPath(); g.ellipse(36, 52, 12, 9, 0, 0, 7); g.fill();
  g.fillStyle = "#241a12";
  g.beginPath(); g.ellipse(27, 40, 3, 4, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(45, 40, 3, 4, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(36, 50, 3.4, 2.6, 0, 0, 7); g.fill();
  if (sub.hatGranted) {
    g.fillStyle = "#d9a441";
    g.fillRect(12, 20, 48, 6); // brim
    g.fillRect(22, 4, 28, 17); // crown
    g.fillStyle = "#8a5f14";
    g.fillRect(22, 16, 28, 5); // band
  }
}
function syncHud() {
  // Hearts AND numbers: hit points, unmistakable.
  const heartsEl = $("hearts");
  let heartsHtml = "";
  for (let i = 0; i < 10; i++) {
    const v = state.hp - i * 2;
    heartsHtml += `<span class="heart ${v >= 2 ? "full" : v === 1 ? "half" : "empty"}">♥</span>`;
  }
  heartsEl.innerHTML = heartsHtml;
  $("hpnum").textContent = `HP ${Math.max(0, state.hp)} / ${state.maxHp}`;
  $("realmname").textContent = realmName(state.realm);
  $("realm-big").textContent = realmName(state.realm);
  $("chord").innerHTML =
    [0, 1, 2].map((i) =>
      `<span class="chordnote ${state.notes[i] ? "on" : ""}">${state.notes[i] ?? "·"}</span>`).join(" ");
  document.querySelectorAll(".notepad").forEach((el) => {
    const n = Number(el.dataset.note) + 1;
    el.classList.toggle("held", state.notes.includes(n));
  });
  $("hatbrim").style.display = sub.hatGranted ? "block" : "none";
  $("questline").textContent = sub.questDone
    ? "The Deep Stone — reached. The hat is written."
    : "The Deep Stone waits in the barrow, east of Arrival.";
  drawPortrait();
  updateObjective();
}

// ---------- readout (demo instrumentation, not in-fiction) -------------------------

function syncReadout() {
  const { sx, sy } = playerScroll();
  const bx = Math.floor(state.pos.x), bz = Math.floor(state.pos.z);
  const density = sub.cellDensity(state.realm, cellOfBlock(bx), cellOfBlock(bz));
  const pressure = borderPressure(sub, state.realm,
    cellOfBlock(bx), cellOfBlock(bz), null);
  $("ro-kernel").textContent = kernels.usingWasm
    ? "WASM core live (hash / foam / Life in nova_core.wasm)"
    : "JS fallback kernels (WASM did not instantiate)";
  $("ro-where").textContent =
    `${state.realm} · scroll ${sx},${sy} · block ${bx},${Math.floor(state.pos.y)},${bz} · gravity ${state.gravDir > 0 ? "down" : "UP (inscribed)"}`;
  $("ro-phys").textContent =
    `tick ${sub.tickCount} · living cells here ${sub.totalLife()} (genesis ${sub.genesisLife ?? "—"}) · monster speed ${sub.monsterSpeed()} · Life density at feet ${density}/9 · neighbor pressure ${pressure.toFixed(2)}`;
  $("ro-wal").innerHTML = sub.wal.slice(-8)
    .map((s) => `#${s.seq} ${s.op} @ ${s.where} — ${s.detail}`)
    .join("<br>");
  $("ro-walcount").textContent = sub.wal.length;
}

// ---------- realms panel -----------------------------------------------------------------

function renderRealms() {
  $("realms-list").innerHTML = REALMS.map((r) => {
    const here = r.id === state.realm;
    const status = here ? "you are here" : r.open ? "open — the bridge tune knows it" : "named, and quiet — not yet open";
    return `<div class="realmrow ${here ? "here" : ""} ${r.open ? "" : "shut"}">
      <span class="realmname2">${r.name}</span><span class="realmstatus">${status}</span></div>`;
  }).join("");
}
function toggleRealms(force) {
  const el = $("realms");
  const show = force !== undefined ? force : el.style.display === "none";
  el.style.display = show ? "block" : "none";
  if (show) renderRealms();
}

// ---------- input ---------------------------------------------------------------------------

let pointerLocked = false;
function lockPointer() {
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (e) { /* pointer lock unavailable (headless); keys still play */ }
}
document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});
document.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;
  state.yaw -= e.movementX * 0.0023 * state.gravDir;
  state.pitch -= e.movementY * 0.0023 * state.gravDir;
  state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch));
});
document.addEventListener("mousedown", (e) => {
  sfx.unlock();
  if (e.target === renderer.domElement) {
    if (!pointerLocked) {
      lockPointer();
    } else if (e.button === 0) {
      tryStrike();
    }
  }
});
document.addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) {
    e.preventDefault();
  }
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === "ArrowLeft") state.yaw += 0.32 * state.gravDir;
  if (e.code === "ArrowRight") state.yaw -= 0.32 * state.gravDir;
  if (e.code in NUMBER_KEYS) return playNote(NUMBER_KEYS[e.code]);
  if (e.code === "KeyW") {
    // W walks. It is also note 2 on the letter row — a quick TAP
    // (not a stride) sounds it; see the keyup handler.
    wTap = { t: performance.now(), x: state.pos.x, z: state.pos.z };
    return;
  }
  const li = LETTER_KEYS.indexOf(e.code);
  if (li >= 0) return playNote(li + 1);
  switch (e.code) {
    case "Space":
      if (state.onGround && !state.dead) {
        state.vel.y = 8.8 * state.gravDir;
        state.onGround = false;
        state.jumped++;
        sfx.jump();
        guideNotify("jump");
      }
      break;
    case "KeyG": flipGravityHere(); break;
    case "KeyF": tryStrike(); break;
    case "KeyM": case "Tab": toggleRealms(); break;
    case "KeyL": {
      const el = $("readout");
      el.style.display = el.style.display === "none" ? "block" : "none";
      break;
    }
  }
});
let wTap = null;
document.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "KeyW" && wTap) {
    const held = performance.now() - wTap.t;
    const dist = Math.hypot(state.pos.x - wTap.x, state.pos.z - wTap.z);
    wTap = null;
    if (held < 200 && dist < 0.5) playNote(2);
  }
});
document.querySelectorAll(".notepad").forEach((el) => {
  el.addEventListener("click", () => playNote(Number(el.dataset.note) + 1));
});
$("btn-realms").addEventListener("click", () => toggleRealms());
$("btn-guide").addEventListener("click", () => {
  if (state.guideDone) { state.guideDone = false; state.guideStep = GUIDE.length - 2; }
  renderGuide();
});
$("btn-sound").addEventListener("click", (e) => {
  sfx.muted = !sfx.muted;
  if (sfx.master) sfx.master.gain.value = sfx.muted ? 0 : 0.9;
  e.target.textContent = sfx.muted ? "sound: off" : "sound: on";
});
$("guide-btn").addEventListener("click", () => {
  const step = guideCurrent();
  if (step && step.action === "helm") {
    sfx.unlock();
    lockPointer();
  }
  if (step && step.button) guideAdvance();
});
$("guide-dismiss").addEventListener("click", () => {
  state.guideDone = true;
  renderGuide();
  syncHud();
});

// ---------- the frame loop ---------------------------------------------------------------------

function eyePos() {
  const up = state.gravDir > 0 ? 1 : -1;
  return new THREE.Vector3(state.pos.x, state.pos.y + up * 1.62, state.pos.z);
}

let lastT = performance.now();
let questWasDone = false;
let inDungeonBefore = false;
function animate() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (!state.dead) updatePlayer(dt);
  chunkMaintenance();
  syncMonsterMeshes(dt);
  checkMonsterContact();
  // The quest: reaching the stone is checked against the subspace.
  if (!sub.questDone) {
    const bx = Math.floor(state.pos.x), bz = Math.floor(state.pos.z);
    if (inDungeon(bx, bz) && !inDungeonBefore) {
      toast("The barrow hall. Something keeps the deep room — watch for its glimpses.", 7000);
    }
    inDungeonBefore = inDungeon(bx, bz);
    if (sub.checkQuest(bx, Math.floor(state.pos.y), bz)) {
      sfx.chime();
      flashPortal();
      toast("The Deep Stone. And with it — a hat, written down where writing lasts.", 9000);
      guideNotify("quest");
      syncHud();
      syncReadout();
    }
  }
  questWasDone = sub.questDone;
  // Camera: eye + stride bob + strafe weave + the gravity roll.
  const eye = eyePos();
  const bobY = state.onGround ? Math.abs(Math.sin(state.bobPhase)) * 0.055 : 0;
  eye.y += bobY * state.gravDir;
  camera.position.copy(eye);
  const roll = (state._lean || 0) + Math.sin(state.bobPhase) * 0.004 +
    (state.gravDir < 0 ? Math.PI : 0);
  camera.quaternion.setFromEuler(new THREE.Euler(
    state.pitch, state.yaw, roll, "YXZ"));
  // Guide steps that poll (movement, jump) advance here.
  const step = guideCurrent();
  if (step && step.until && step.until()) guideAdvance();
  renderer.render(scene, camera);
}

// ---------- subspace physics tick -------------------------------------------------------------

setInterval(() => {
  sub.tick({
    realmId: state.realm,
    bx: Math.floor(state.pos.x),
    bz: Math.floor(state.pos.z),
  });
  // Life moved: the chunk signature sweep in the frame loop notices
  // which loaded chunks' inputs drifted and re-derives only those.
  syncReadout();
}, 650);

// ---------- go ---------------------------------------------------------------------------------------

initThree();
// Pre-generate the arrival neighborhood so the first frames are whole.
{
  const pcx = Math.floor(state.pos.x / CHUNK), pcz = Math.floor(state.pos.z / CHUNK);
  for (let dx = -RENDER_R; dx <= RENDER_R; dx++)
    for (let dz = -RENDER_R; dz <= RENDER_R; dz++) ensureChunk(pcx + dx, pcz + dz);
}
renderGuide();
syncHud();
syncReadout();
toast("Nova Prime. Emise is on the chart-line — her panel is below.", 6000);

// Demo instrumentation: a handle for headless playtests (and for
// Will's own poking in devtools). Not part of the fiction.
window.NOVA_FOX2 = {
  state, sub, kernels,
  playNote, playChord, flipGravityHere, tryStrike, hurtPlayer,
  guideAdvance, guideCurrent: () => GUIDE[state.guideStep] || null,
  teleportTo(x, z) {
    state.pos.set(x + 0.5, heightAt(state.realm, x, z) + 1.01, z + 0.5);
    state.vel.set(0, 0, 0);
    const { sx, sy } = playerScroll();
    ensureNeighborhood(state.realm, sx, sy);
  },
  surfaceY(x, z) { return heightAt(state.realm, x, z) + 1; },
};
