// Nova Fox demo — view + input + game loop.
//
// Three.js renders the derived view of one room; this file owns input,
// the tick order (player inscribes -> monsters step -> Life steps),
// glyph interactions, and Will's readout panel. All document truth
// lives in subspace.js (the Doc); this file keeps none of its own.
//
// The veil binds everything in the game column: fiction words only
// (rift, tune, chart, the dark). The readout panel is demo
// instrumentation for Will and is labelled as such — it may name the
// machinery the fiction never mentions.

// ---------- boot ------------------------------------------------------

const wasmBytes = Uint8Array.from(atob(NOVA_CORE_WASM_B64), (c) =>
  c.charCodeAt(0)
);
await kernels.init(wasmBytes);

const doc = new Doc(DUNGEON_TEXT);
const WORLD_START = "1.1.1/1.1.1/1.1.1";
const POCKET_SECTION = "1.2.";

// Authored portal links (demo table; in the full build a portal's
// destination follows the phext break it stands for — brief G4).
const LINKS = {
  "1.1.1/1.1.1/1.1.1": { _: "1.1.1/1.1.1/1.1.2" },
  "1.1.1/1.1.1/1.1.2": { _: "1.1.1/1.1.1/1.1.1", "&": "1.1.1/1.1.1/1.1.3" },
  "1.1.1/1.1.1/1.1.3": { "&": "1.1.1/1.1.1/1.1.2", _: "1.1.1/1.1.1/1.1.4" },
  "1.1.1/1.1.1/1.1.4": { _: "1.1.1/1.1.1/1.1.1" },
};
const ROOM_NAMES = {
  "1.1.1/1.1.1/1.1.1": "Arrival",
  "1.1.1/1.1.1/1.1.2": "The Long Shelf",
  "1.1.1/1.1.1/1.1.3": "Chart Vault",
  "1.1.1/1.1.1/1.1.4": "The Quiet Deep",
};
const CLUES = [
  "A chart-note: the dark is not empty. It is uncounted.",
  "A chart-note: some tunes are doors. Your hands already know one.",
  "A chart-note: what is written stays. What is only seen, shimmers.",
  "A chart-note: when the room turns, the burning things fall too.",
];

const state = {
  room: null, // coordStr
  grid: null, // working grid of the current room
  player: { x: 2, y: 11 },
  hearts: 3,
  salvage: 0,
  crossings: 0,
  tick: 0,
  gdir: 1,
  roomGrav: new Map(), // coord -> gdir (warp is inscribed per room)
  viewEpoch: new Map(), // coord -> derivation epoch
  monsters: new Map(), // coord -> {x, y, phase, alive, start}
  deepening: new Set(), // coords where a '*' was taken (rights held)
  notes: [], // notes collected toward a chord
  notesTimer: null,
  invuln: 0,
  clueIdx: 0,
  lastTriple: null,
  msg: "",
};

// ---------- small helpers ----------------------------------------------

const $ = (id) => document.getElementById(id);
function isPocket(coord) {
  return coord.split("/")[2].startsWith(POCKET_SECTION);
}
function lifeMode() {
  return isPocket(state.room) ? "earth" : "flux";
}
function roomLabel(coord) {
  return ROOM_NAMES[coord] || "a rift pocket";
}
function findGlyph(g, ch) {
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) if (g.rows[y][x] === ch) return { x, y };
  return null;
}
function say(text) {
  state.msg = text;
  $("msg").textContent = text;
}

// ---------- audio (the instrument sounds) -------------------------------

let audioCtx = null;
const SCALE = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17];
function pluck(noteIdx, when = 0, vol = 0.16) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 220 * Math.pow(2, SCALE[noteIdx] / 12);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 1);
  } catch (e) {
    /* audio is dressing; silence is acceptable */
  }
}

// ---------- room entry / exit -------------------------------------------

function ensureMonster(coord) {
  if (state.monsters.has(coord)) return;
  if (coord === "1.1.1/1.1.1/1.1.3" || isPocket(coord)) {
    state.monsters.set(coord, {
      x: 15, y: 11, phase: 1, alive: true, start: { x: 15, y: 11 },
    });
  }
}

function enterRoom(coord, useSpawn = true) {
  state.room = coord;
  state.grid = gridFromText(doc.get(coord));
  state.gdir = state.roomGrav.get(coord) || 1;
  ensureMonster(coord);
  const spawn = findGlyph(state.grid, "/") || { x: 2, y: 11 };
  if (useSpawn) {
    const s = settle(state.grid, spawn, state.gdir);
    state.player = s.pos;
  }
  if (!state.viewEpoch.has(coord)) state.viewEpoch.set(coord, 0);
  buildView();
  syncHud();
  updateReadout();
}

// Inscribe the working grid back into the document.
function writeGrid(op, detail) {
  doc.inscribe(state.room, textFromGrid(state.grid), op, detail);
}

// ---------- glyph interactions -------------------------------------------
// Fired for cells the player ENTERS (including mid-fall). Returns true
// when the interaction moved the player to another room (stop the tick).

function interact(cell, prevPos) {
  const g = state.grid;
  const ch = cellAt(g, cell.x, cell.y);
  const at = `${cell.x},${cell.y}`;
  if (ch === ".") {
    // Burning ground: it holds you, and crossing costs. (A monster
    // that falls here dies — see monsterTurn. The asymmetry is the
    // weapon the chart-notes point at.)
    hurt("The burning ground sears you.");
    return false;
  }
  if (ch === "*" || ch === "+" || ch === "$" || ch === "?" || ch === "%") {
    if (ch === "*") {
      state.deepening.add(state.room);
      doc.log("rights", state.room,
        "a deepening taken — inscription rights over this place");
      say("Something deepens. In this place, your hands remember more. [X] sets a stone beneath you.");
    } else if (ch === "+") {
      state.hearts = Math.min(5, state.hearts + 1);
      say("Warmth. The dark recedes a little.");
    } else if (ch === "$") {
      state.salvage++;
      say("Salvage, written into the chart.");
    } else if (ch === "?") {
      doc.log("save", state.room, `chart snapshot held (${doc.serialize().length} bytes)`);
      say("The chart remembers this moment.");
    } else if (ch === "%") {
      if (kernels.hash(`${state.room}|${state.tick}|chance`) % 2 === 0) {
        state.hearts = Math.min(5, state.hearts + 1);
        say("The rift is kind.");
      } else {
        burstAt(cell);
        say("The rift shivers — and gives nothing.");
      }
    }
    g.rows[cell.y][cell.x] = ":";
    writeGrid("take", `${ch} at ${at}`);
    return false;
  }
  if (ch === "!") {
    say(CLUES[state.clueIdx++ % CLUES.length]);
    return false;
  }
  if (ch === "#") {
    say("The guide hums the controls: arrows walk, G turns the room, three notes travel, X sets stone where the deepening holds.");
    return false;
  }
  if ((ch === "_" || ch === "&") && LINKS[state.room]?.[ch]) {
    const dest = LINKS[state.room][ch];
    doc.log("cross", state.room, `portal ${ch} -> ${dest}`);
    doc.log("cross", dest, `portal ${ch} <- ${state.room}`);
    say("The chart turns a page.");
    enterRoom(dest);
    return true;
  }
  if (ch === "^") {
    state.crossings++;
    doc.log("cross-gate", state.room, "the way out, taken");
    say("You cross. The dark keeps what it keeps.");
    enterRoom(WORLD_START);
    return true;
  }
  return false;
}

function hurt(why) {
  if (state.invuln > 0) return;
  state.hearts--;
  state.invuln = 3;
  if (state.hearts <= 0) {
    doc.log("return", state.room, "carried back to Arrival; the marks remain");
    state.hearts = 3;
    say("The dark takes its due — and returns you to Arrival. Everything written stayed written.");
    enterRoom(WORLD_START);
  } else {
    say(why);
  }
}

// ---------- the tick ------------------------------------------------------
// Order, per the brief: the player inscribes, monsters step, Life steps.

function doTick(action) {
  state.tick++;
  if (state.invuln > 0) state.invuln--;
  const roomAtStart = state.room;
  const moved = action(); // may change rooms
  if (!moved && state.room === roomAtStart) {
    monsterPhase();
    settlePlayer();
    if (state.room === roomAtStart) monsterTurn();
    if (state.room === roomAtStart) lifeTurn();
    if (state.room === roomAtStart) trailMark();
  }
  syncEntities();
  syncHud();
  updateReadout();
}

function settlePlayer() {
  const s = settle(state.grid, state.player, state.gdir);
  if (s.fellOut) {
    hurt("You fall out of the charted world.");
    return;
  }
  state.player = s.pos;
  const roomHere = state.room;
  for (let i = 1; i < s.path.length; i++) {
    if (interact(s.path[i], s.path[i - 1])) break;
    if (state.room !== roomHere) break; // hurt() may carry you home
  }
}

function trailMark() {
  const { x, y } = state.player;
  if (state.grid.rows[y][x] === " ") {
    state.grid.rows[y][x] = ":";
    writeGrid("trail", `passage inscribed at ${x},${y}`);
    buildView();
  }
}

function monsterPhase() {
  const m = state.monsters.get(state.room);
  if (!m || !m.alive) return;
  const drift = 1 + (kernels.hash(`${state.room}|${state.tick}|phase`) % 2);
  m.phase = (m.phase + drift) % 3;
}

function monsterTurn() {
  const m = state.monsters.get(state.room);
  if (!m || !m.alive) return;
  const speed = monsterSpeed(doc);
  for (let i = 0; i < speed; i++) {
    const next = monsterStep(state.grid, m, state.player);
    m.x = next.x;
    m.y = next.y;
    const s = settle(state.grid, m, state.gdir);
    if (s.fellOut) {
      killMonster(m, "it fell out of the world");
      return;
    }
    m.x = s.pos.x;
    m.y = s.pos.y;
    if (cellAt(state.grid, m.x, m.y) === ".") {
      killMonster(m, "it fell on burning ground");
      return;
    }
    if (m.phase === 0 && m.x === state.player.x && m.y === state.player.y) {
      doc.log("contact", state.room, `the dark thing reached you at ${m.x},${m.y}`);
      m.x = m.start.x;
      m.y = m.start.y;
      hurt("It reaches you out of the dark.");
      return;
    }
  }
}

function killMonster(m, how) {
  m.alive = false;
  if (m.x >= 0 && m.y >= 0 && m.y < state.grid.h && m.x < state.grid.w) {
    if (state.grid.rows[m.y][m.x] !== ".") state.grid.rows[m.y][m.x] = ".";
  }
  writeGrid("scar", `a scar where the dark thing fell (${how})`);
  doc.log("defeat", state.room, how);
  say("The dark thing falls. The place keeps the scar.");
  buildView();
}

function lifeTurn() {
  const before = textFromGrid(state.grid);
  let next = lifeStepRoom(state.grid, lifeMode(), state.tick);
  if (lifeMode() === "earth") {
    for (let x = 0; x < next.w; x++) {
      next.rows[0][x] = "=";
      next.rows[next.h - 1][x] = "=";
    }
    for (let y = 0; y < next.h; y++) {
      next.rows[y][0] = "=";
      next.rows[y][next.w - 1] = "=";
    }
  }
  // Life does not grow stone through a standing body.
  const m0 = state.monsters.get(state.room);
  const keep = [[state.player.x, state.player.y]];
  if (m0 && m0.alive) keep.push([m0.x, m0.y]);
  for (const [kx, ky] of keep) {
    if (next.rows[ky][kx] === "=") next.rows[ky][kx] = state.grid.rows[ky][kx];
  }
  const after = textFromGrid(next);
  if (after !== before) {
    state.grid = next;
    writeGrid("life", "the world evolves what was written");
    buildView();
    // Ground may have moved under both feet.
    const ps = settle(state.grid, state.player, state.gdir);
    if (!ps.fellOut) state.player = ps.pos;
    const m = state.monsters.get(state.room);
    if (m && m.alive) {
      const ms = settle(state.grid, m, state.gdir);
      if (ms.fellOut) killMonster(m, "the ground gave way under it");
      else { m.x = ms.pos.x; m.y = ms.pos.y; }
    }
  }
}

// ---------- player actions -------------------------------------------------

function actMove(dx, dy) {
  doTick(() => {
    const r = stepEntity(state.grid, state.player, dx, dy, state.gdir);
    if (r.fellOut) {
      hurt("You fall out of the charted world.");
      return false;
    }
    state.player = r.pos;
    const roomHere = state.room;
    for (let i = 1; i < r.path.length; i++) {
      if (interact(r.path[i], r.path[i - 1])) return true;
      if (state.room !== roomHere) return true; // hurt() carried you home
    }
    return false;
  });
}

function actWait() {
  doTick(() => false);
}

function actWarp() {
  doTick(() => {
    state.gdir = -state.gdir;
    state.roomGrav.set(state.room, state.gdir);
    doc.log("warp", state.room,
      `down is now ${state.gdir > 0 ? "down" : "up"} in this place`);
    say(state.gdir > 0 ? "The room turns. Down is down." : "The room turns. Down is up.");
    buildView();
    return false;
  });
}

function actInscribeEarth() {
  doTick(() => {
    if (!state.deepening.has(state.room)) {
      say("Your hands are ordinary here.");
      return false;
    }
    const tx = state.player.x, ty = state.player.y + state.gdir;
    if (ty < 0 || ty >= state.grid.h) return false;
    const c = state.grid.rows[ty][tx];
    if (c === " " || FLUX62.includes(c)) {
      state.grid.rows[ty][tx] = "=";
      writeGrid("inscribe-earth", `stone set at ${tx},${ty}`);
      say("Stone, where there was none. Written.");
      buildView();
    }
    return false;
  });
}

function playNote(idx) {
  pluck(idx);
  if (!state.notes.includes(idx)) state.notes.push(idx);
  clearTimeout(state.notesTimer);
  state.notesTimer = setTimeout(() => {
    state.notes = [];
    syncHud();
  }, 1600);
  if (state.notes.length === 3) {
    const triple = [...state.notes].sort((a, b) => a - b).map((n) => n + 1);
    state.notes = [];
    clearTimeout(state.notesTimer);
    chord(triple);
  }
  syncHud();
}

function chord(triple) {
  state.lastTriple = triple;
  triple.forEach((n, i) => pluck(n - 1, 0.12 + i * 0.02, 0.1));
  doTick(() => {
    const res = openPocket(doc, state.room, triple);
    if (res.reopened && res.coord === state.room) {
      say("The tune settles. You are already here.");
      return false;
    }
    say(res.reopened
      ? "The tune finds the pocket as it was left."
      : "A rift opens where the tune lands.");
    enterRoom(res.coord);
    return true;
  });
}

// ---------- Three.js view ---------------------------------------------------
// The room is a view, derived from the scroll — extruded, lit, dressed
// with detail the document never stored. Derivation seed = coordinate +
// epoch: re-derive and the dressing re-rolls while every inscribed
// glyph comes back exactly.

let scene, camera, renderer, roomGroup, fox, monsterMesh, playerLight;
let fluxMeshes = [], portalMeshes = [], starPoints = null;
const GEO = {};
const MAT = {};
let viewSeed = 0;

function initThree() {
  const holder = $("stage");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090f);
  camera = new THREE.PerspectiveCamera(
    46, holder.clientWidth / holder.clientHeight, 0.1, 300);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(holder.clientWidth, holder.clientHeight);
  holder.appendChild(renderer.domElement);
  scene.add(new THREE.AmbientLight(0xbfd0ff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.1);
  sun.position.set(6, 12, 9);
  scene.add(sun);
  playerLight = new THREE.PointLight(0xffd9a0, 30, 11, 1.6);
  scene.add(playerLight);
  GEO.box = new THREE.BoxGeometry(1, 1, 1);
  GEO.octa = new THREE.OctahedronGeometry(0.17);
  GEO.torus = new THREE.TorusGeometry(0.4, 0.07, 10, 28);
  GEO.ico = new THREE.IcosahedronGeometry(0.3, 0);
  GEO.coin = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 20);
  GEO.cone = new THREE.ConeGeometry(0.16, 0.34, 6);
  GEO.sphere = new THREE.SphereGeometry(0.16, 12, 10);
  const std = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  MAT.earth = [std(0x6b5844), std(0x75604a), std(0x5d4c3a)];
  MAT.path = std(0x44598a, { emissive: 0x101d38 });
  MAT.lava = std(0x3a0d00, { emissive: 0xff5a1f, emissiveIntensity: 1.7 });
  MAT.water = std(0x2e6fb7, { transparent: true, opacity: 0.55, roughness: 0.3 });
  MAT.gold = std(0xd9a441, { emissive: 0x6b4a00, emissiveIntensity: 0.7 });
  MAT.life = std(0x51cf66, { emissive: 0x14551f, emissiveIntensity: 0.8 });
  MAT.violet = std(0x9775fa, { emissive: 0x3b1d8f, emissiveIntensity: 0.9 });
  MAT.amber = std(0xffb84d, { emissive: 0x6b4200, emissiveIntensity: 0.8 });
  MAT.teal = std(0x3bc9db, { emissive: 0x0d4a55, emissiveIntensity: 0.8 });
  MAT.magenta = std(0xda77f2, { emissive: 0x571e66, emissiveIntensity: 0.8 });
  MAT.spawn = std(0xc5f6fa, { emissive: 0x2b6a72, emissiveIntensity: 1.0 });
  MAT.flux = new THREE.MeshStandardMaterial({
    color: 0x8899bb, emissive: 0x334466, emissiveIntensity: 0.9, roughness: 0.4,
  });
  fox = buildFox();
  scene.add(fox);
  monsterMesh = buildMonster();
  scene.add(monsterMesh);
  window.addEventListener("resize", onResize);
  onResize();
  renderer.setAnimationLoop(animate);
}

function buildFox() {
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xe07b39, roughness: 0.7 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf5e6d3, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.9 });
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    g.add(m);
    return m;
  };
  add(GEO.box, orange, 0, 0, 0, 0.62, 0.42, 0.4); // body
  add(GEO.box, orange, 0.42, 0.14, 0, 0.38, 0.36, 0.36); // head
  add(GEO.box, cream, 0.66, 0.06, 0, 0.2, 0.16, 0.2); // snout
  add(GEO.cone, orange, 0.34, 0.42, 0.11, 0.9, 1.1, 0.9); // ear
  add(GEO.cone, orange, 0.34, 0.42, -0.11, 0.9, 1.1, 0.9); // ear
  const tail = add(GEO.cone, orange, -0.48, 0.18, 0, 1, 1.5, 1);
  tail.rotation.z = 2.2;
  const tip = add(GEO.cone, cream, -0.62, 0.34, 0, 0.7, 0.9, 0.7);
  tip.rotation.z = 2.2;
  for (const [lx, lz] of [[0.2, 0.13], [0.2, -0.13], [-0.2, 0.13], [-0.2, -0.13]]) {
    add(GEO.box, dark, lx, -0.3, lz, 0.1, 0.2, 0.1); // legs
  }
  return g;
}

function buildMonster() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({
      color: 0x1a1426, emissive: 0x30184a, emissiveIntensity: 0.7,
      roughness: 0.35, flatShading: true,
    })
  );
  g.add(body);
  for (let i = 0; i < 6; i++) {
    const spike = new THREE.Mesh(GEO.cone,
      new THREE.MeshStandardMaterial({ color: 0x241a38, roughness: 0.4 }));
    const a = (i / 6) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0);
    spike.rotation.z = a - Math.PI / 2;
    g.add(spike);
  }
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x330000, emissive: 0xff2222, emissiveIntensity: 2.2,
  });
  for (const dz of [0.14, -0.14]) {
    const eye = new THREE.Mesh(GEO.sphere, eyeMat);
    eye.position.set(0.34, 0.08, dz);
    eye.scale.setScalar(0.55);
    g.add(eye);
  }
  return g;
}

function cellWorld(x, y) {
  return {
    x: x - (ROOM_W - 1) / 2,
    y: (ROOM_H - 1) / 2 - y,
  };
}

function buildView() {
  if (roomGroup) {
    scene.remove(roomGroup);
    roomGroup.traverse((o) => {
      if (o.material && o.material._own) o.material.dispose();
    });
  }
  roomGroup = new THREE.Group();
  fluxMeshes = [];
  portalMeshes = [];
  const epoch = state.viewEpoch.get(state.room) || 0;
  viewSeed = viewSeedFor(state.room, epoch);
  const g = state.grid;
  const hcell = (x, y, salt) =>
    kernels.hash(`${state.room}|${x},${y}|${salt}|${viewSeed}`) % 100;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const ch = g.rows[y][x];
      const { x: wx, y: wy } = cellWorld(x, y);
      const put = (mesh, z = 0) => {
        mesh.position.set(wx, wy, z);
        roomGroup.add(mesh);
        return mesh;
      };
      if (ch === "=") {
        const depth = 1.15 + hcell(x, y, "d") / 100 * 1.15;
        const m = new THREE.Mesh(GEO.box, MAT.earth[hcell(x, y, "s") % 3]);
        m.scale.set(1.02, 1.02, depth);
        put(m, 0);
        if (hcell(x, y, "r") % 7 === 0) {
          const rubble = new THREE.Mesh(GEO.box, MAT.earth[hcell(x, y, "s2") % 3]);
          rubble.scale.setScalar(0.22 + hcell(x, y, "r2") / 100 * 0.2);
          rubble.position.set(wx + 0.25, wy + 0.55, 0.4);
          rubble.rotation.set(0.4, 0.3, 0.2);
          roomGroup.add(rubble);
        }
      } else if (ch === ":") {
        const m = new THREE.Mesh(GEO.box, MAT.path);
        m.scale.set(1, 1, 0.16);
        put(m, -0.55);
      } else if (ch === ".") {
        const m = new THREE.Mesh(GEO.box, MAT.lava);
        m.scale.set(1, 1, 0.3);
        put(m, -0.45);
      } else if (ch === "~") {
        const m = new THREE.Mesh(GEO.box, MAT.water);
        m.scale.set(1, 1, 0.24);
        put(m, -0.48);
      } else if (PORTAL_GLYPHS.includes(ch)) {
        const mat = new THREE.MeshStandardMaterial({
          color: PORTAL_COLORS[ch], roughness: 0.35,
          emissive: PORTAL_COLORS[ch], emissiveIntensity: ch === "^" ? 0.25 : 0.8,
        });
        mat._own = true;
        const m = new THREE.Mesh(GEO.torus, mat);
        if (ch === "^") m.scale.setScalar(1.35);
        put(m, 0.15);
        portalMeshes.push(m);
      } else if (ch === "*") {
        put(new THREE.Mesh(GEO.ico, MAT.gold), 0.1);
      } else if (ch === "+") {
        const grp = new THREE.Group();
        const a = new THREE.Mesh(GEO.box, MAT.life);
        a.scale.set(0.55, 0.18, 0.18);
        const b = new THREE.Mesh(GEO.box, MAT.life);
        b.scale.set(0.18, 0.55, 0.18);
        grp.add(a, b);
        put(grp, 0.1);
      } else if (ch === "$") {
        const m = new THREE.Mesh(GEO.coin, MAT.gold);
        m.rotation.x = Math.PI / 2.4;
        put(m, 0.1);
      } else if (ch === "?") {
        put(new THREE.Mesh(GEO.box, MAT.violet), 0.1).scale.setScalar(0.42);
      } else if (ch === "!") {
        put(new THREE.Mesh(GEO.cone, MAT.amber), 0.1);
      } else if (ch === "#") {
        put(new THREE.Mesh(GEO.box, MAT.teal), 0.1).scale.set(0.4, 0.4, 0.4);
      } else if (ch === "%") {
        put(new THREE.Mesh(GEO.sphere, MAT.magenta), 0.1).scale.setScalar(1.3);
      } else if (ch === "/") {
        const m = new THREE.Mesh(GEO.torus, MAT.spawn);
        m.rotation.x = Math.PI / 2;
        m.scale.setScalar(0.8);
        put(m, -0.4);
      } else if (isFlux(ch)) {
        const m = new THREE.Mesh(GEO.octa, MAT.flux);
        const j = (hcell(x, y, "f") - 50) / 160;
        m.position.set(wx + j, wy + ((hcell(x, y, "f2") % 40) - 20) / 100, 0.35);
        m.userData.phase = hcell(x, y, "fp") / 100 * Math.PI * 2;
        roomGroup.add(m);
        fluxMeshes.push(m);
      }
    }
  }
  // The sky is derived too: a new derivation re-rolls the stars.
  if (starPoints) {
    scene.remove(starPoints);
    starPoints.geometry.dispose();
  }
  const starGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(360 * 3);
  for (let i = 0; i < 360; i++) {
    const a = kernels.hash(`star${i}|${viewSeed}`) % 628 / 100;
    const r = 40 + (kernels.hash(`starr${i}|${viewSeed}`) % 60);
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.sin(a) * r * 0.7;
    pos[i * 3 + 2] = -30 - (kernels.hash(`starz${i}|${viewSeed}`) % 40);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  starPoints = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0x93a7cc, size: 0.55, sizeAttenuation: true, fog: false,
  }));
  scene.add(starPoints);
  // Gravity arrow: down is a fact about this place, drawn at its edge.
  const arrow = new THREE.Group();
  const shaft = new THREE.Mesh(GEO.box, MAT.spawn);
  shaft.scale.set(0.09, 0.5, 0.09);
  const head = new THREE.Mesh(GEO.cone, MAT.spawn);
  head.position.y = -0.4;
  head.rotation.x = Math.PI;
  arrow.add(shaft, head);
  arrow.position.set(ROOM_W / 2 + 1.2, (ROOM_H / 2 - 1) * (state.gdir > 0 ? 1 : -1), 0);
  arrow.rotation.z = state.gdir > 0 ? 0 : Math.PI;
  roomGroup.add(arrow);
  scene.add(roomGroup);
  syncEntities(true);
}

function burstAt(cell) {
  // A shimmer of flux where the rift shivered (pure view dressing).
  const { x, y } = cellWorld(cell.x, cell.y);
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(GEO.octa, MAT.magenta);
    m.position.set(x, y, 0.4);
    m.userData.phase = i;
    roomGroup.add(m);
    fluxMeshes.push(m);
  }
}

// ---------- per-frame sync ---------------------------------------------------

const _entTarget = { fox: null, monster: null };
function syncEntities(snap = false) {
  const pw = cellWorld(state.player.x, state.player.y);
  _entTarget.fox = new THREE.Vector3(pw.x, pw.y, 0.55);
  if (snap) fox.position.copy(_entTarget.fox);
  const m = state.monsters.get(state.room);
  const show = m && m.alive && m.phase === 0;
  monsterMesh.visible = !!show;
  if (show) {
    const mw = cellWorld(m.x, m.y);
    _entTarget.monster = new THREE.Vector3(mw.x, mw.y, 0.55);
    if (snap) monsterMesh.position.copy(_entTarget.monster);
  }
  fox.rotation.z = state.gdir > 0 ? 0 : Math.PI;
}

let lastT = 0;
function animate(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (_entTarget.fox) {
    fox.position.lerp(_entTarget.fox, 1 - Math.pow(0.0001, dt));
    playerLight.position.copy(fox.position).add(new THREE.Vector3(0, 0, 2.2));
  }
  if (monsterMesh.visible && _entTarget.monster) {
    monsterMesh.position.lerp(_entTarget.monster, 1 - Math.pow(0.0001, dt));
    const s = 1 + Math.sin(t / 280) * 0.07;
    monsterMesh.scale.setScalar(s);
  }
  for (const f of fluxMeshes) {
    f.position.y += Math.sin(t / 700 + f.userData.phase) * 0.0006;
    f.rotation.y += dt * 0.8;
  }
  for (const p of portalMeshes) p.rotation.z += dt * 0.7;
  renderer.render(scene, camera);
}

function onResize() {
  const holder = $("stage");
  const w = holder.clientWidth, h = holder.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.position.set(0, 0.4, camera.aspect < 1.55 ? 27 * (1.55 / camera.aspect) : 27);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ---------- HUD + readout ------------------------------------------------------

function syncHud() {
  $("hearts").textContent = "♥".repeat(state.hearts) + "♡".repeat(5 - state.hearts);
  $("salvage").textContent = state.salvage;
  $("crossings").textContent = state.crossings;
  $("garrow").textContent = state.gdir > 0 ? "↓" : "↑";
  $("roomname").textContent = roomLabel(state.room);
  $("pips").innerHTML = state.notes
    .map(() => '<span class="pip on"></span>')
    .join("") + Array.from({ length: 3 - state.notes.length },
      () => '<span class="pip"></span>').join("");
  document.querySelectorAll(".notepad").forEach((el, i) => {
    el.classList.toggle("held", state.notes.includes(i));
  });
}

function updateReadout() {
  const m = state.monsters.get(state.room);
  const epoch = state.viewEpoch.get(state.room) || 0;
  $("ro-kernel").textContent = kernels.usingWasm
    ? "WASM core live (hash / foam / Life in nova_core.wasm)"
    : "JS fallback kernels (WASM did not instantiate)";
  $("ro-room").textContent =
    `${state.room}  ·  view derivation #${epoch} (seed ${viewSeed.toString(16)})`;
  $("ro-world").textContent =
    `${doc.scrollCount} scrolls (began ${doc.startScrollCount}) · monster speed ${monsterSpeed(doc)} step/tick · tick ${state.tick}`;
  $("ro-last").textContent = state.lastTriple
    ? `last tune: notes ${state.lastTriple.join("+")} -> axes ${state.lastTriple.map((n) => AXES[n - 1]).join(", ")}`
    : "no tune played yet";
  $("ro-monster").textContent = m
    ? (m.alive
      ? `at ${m.x},${m.y} in this room · off-slice phase ${m.phase} (${m.phase === 0 ? "VISIBLE" : "hidden in the unchosen axes"})`
      : "struck from this room; the scar is in the scroll")
    : "none in this room";
  $("ro-wal").innerHTML = doc.wal.slice(-6)
    .map((s) => `#${s.seq} ${s.op} @ ${s.coord} — ${s.detail}`)
    .join("<br>");
  $("ro-walcount").textContent = doc.wal.length;
  $("ro-scroll").textContent = doc.get(state.room);
}

// ---------- input ----------------------------------------------------------------

const NOTE_KEYS = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "["];
document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault();
  if (e.repeat) return;
  const ni = NOTE_KEYS.indexOf(k);
  if (ni >= 0) return playNote(ni);
  switch (e.key) {
    case "ArrowLeft": return actMove(-1, 0);
    case "ArrowRight": return actMove(1, 0);
    case "ArrowUp": return actMove(0, -1);
    case "ArrowDown": return actMove(0, 1);
    case " ": return actWait();
  }
  switch (k) {
    case "g": return actWarp();
    case "x": return actInscribeEarth();
    case "v": {
      // Re-derive the view: dressing re-rolls, inscriptions persist.
      const ep = (state.viewEpoch.get(state.room) || 0) + 1;
      state.viewEpoch.set(state.room, ep);
      buildView();
      updateReadout();
      return;
    }
  }
});
document.querySelectorAll(".notepad").forEach((el, i) => {
  el.addEventListener("click", () => playNote(i));
});
$("btn-warp").addEventListener("click", actWarp);
$("btn-wait").addEventListener("click", actWait);
$("btn-derive").addEventListener("click", () => {
  const ep = (state.viewEpoch.get(state.room) || 0) + 1;
  state.viewEpoch.set(state.room, ep);
  buildView();
  updateReadout();
});
$("btn-earth").addEventListener("click", actInscribeEarth);
document.querySelectorAll("[data-move]").forEach((el) => {
  el.addEventListener("click", () => {
    const [dx, dy] = el.dataset.move.split(",").map(Number);
    actMove(dx, dy);
  });
});

// ---------- go ---------------------------------------------------------------------

initThree();
enterRoom(WORLD_START);
say("The rifts are open. Walk with the arrows; three notes travel; G turns the room.");

// Demo instrumentation: a handle for headless playtests (and for Will's
// own poking in devtools). Not part of the fiction.
window.NOVA_FOX = {
  state, doc, kernels,
  actMove, actWarp, actWait, actInscribeEarth, playNote,
  enterRoom,
  derive() {
    const ep = (state.viewEpoch.get(state.room) || 0) + 1;
    state.viewEpoch.set(state.room, ep);
    buildView();
    updateReadout();
  },
};
