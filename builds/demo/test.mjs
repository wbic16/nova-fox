// Nova Fox demo — headless playtest of the subspace module.
// Run: node test.mjs   (uses the real dungeon.phext + nova_core.wasm)
import { readFileSync } from "node:fs";
import {
  Doc, coordStr, gridFromText, textFromGrid, cellAt, isStandable, settle,
  stepEntity, lifeStepRoom, openPocket, monsterStep, monsterSpeed,
  viewSeedFor, kernels, hashStringJS, genFoamJS, lifeStepJS, FLUX62,
} from "./subspace.js";

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}

// --- kernels: WASM vs JS must agree bit for bit ----------------------
const wasmBytes = readFileSync(new URL("./nova_core.wasm", import.meta.url));
check("wasm instantiates", await kernels.init(wasmBytes), "");
check("kernels report wasm", kernels.usingWasm === true);
for (const s of ["", "1.1.1/1.1.1/1.1.1|3,7,11", "pocket", "x".repeat(500)]) {
  const enc = new TextEncoder().encode(s);
  const inp = new Uint8Array(kernels._mem.buffer, kernels._ex.in_ptr(), enc.length);
  inp.set(enc);
  check(`hash wasm==js ${JSON.stringify(s.slice(0, 18))}`,
    (kernels._ex.hash_bytes(enc.length) >>> 0) === hashStringJS(s));
}
{
  const enc = new TextEncoder().encode("seed");
  const inp = new Uint8Array(kernels._mem.buffer, kernels._ex.in_ptr(), 4);
  inp.set(enc);
  kernels._ex.gen_foam(424242, 20, 13);
  const wasmFoam = String.fromCharCode(
    ...new Uint8Array(kernels._mem.buffer, kernels._ex.out_ptr(), 260));
  check("foam wasm==js", wasmFoam === genFoamJS(424242, 20, 13));
  const layer = new Uint8Array(260);
  for (let i = 0; i < 260; i++) layer[i] = (i * 7919) % 5 === 0 ? 1 : 0;
  const inp2 = new Uint8Array(kernels._mem.buffer, kernels._ex.in_ptr(), 260);
  inp2.set(layer);
  kernels._ex.life_step(20, 13);
  const wasmLife = new Uint8Array(
    new Uint8Array(kernels._mem.buffer, kernels._ex.out_ptr(), 260));
  check("life wasm==js",
    Buffer.from(wasmLife).equals(Buffer.from(lifeStepJS(layer, 20, 13))));
}

// --- the document: a real phext --------------------------------------
const text = readFileSync(new URL("./dungeon.phext", import.meta.url), "utf8");
const doc = new Doc(text);
check("doc parses 4 scrolls", doc.scrollCount === 4);
check("serialize round-trips", doc.serialize() === text);
check("room 1 has spawn", doc.get("1.1.1/1.1.1/1.1.1").includes("/"));
check("genesis is WAL segment 1", doc.wal.length === 1 && doc.wal[0].op === "genesis");

// --- reachability in authored rooms (gravity-down BFS) ---------------
function reachableTargets(gridText, targets) {
  const g = gridFromText(gridText);
  let spawn = null;
  const wanted = new Map();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = g.rows[y][x];
    if (c === "/") spawn = { x, y };
    if (targets.includes(c)) wanted.set(`${x},${y}`, c);
  }
  const start = settle(g, spawn, +1).pos;
  const seen = new Set(), visitedCells = new Set(), queue = [start];
  while (queue.length) {
    const p = queue.shift();
    const key = `${p.x},${p.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    visitedCells.add(key);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const s = stepEntity(g, p, dx, dy, +1);
      if (s.fellOut) continue;
      for (const c of s.path) visitedCells.add(`${c.x},${c.y}`);
      queue.push(s.pos);
    }
  }
  const found = {};
  for (const [k, c] of wanted) if (visitedCells.has(k)) found[c] = true;
  return found;
}
const r1 = reachableTargets(doc.get("1.1.1/1.1.1/1.1.1"), ["_", "*", "!"]);
check("room1: portal reachable", !!r1["_"]);
check("room1: powerup reachable", !!r1["*"]);
const r2 = reachableTargets(doc.get("1.1.1/1.1.1/1.1.2"), ["&", "+", "%"]);
check("room2: section portal reachable", !!r2["&"]);
check("room2: life reachable", !!r2["+"]);
const r3 = reachableTargets(doc.get("1.1.1/1.1.1/1.1.3"), ["_", "$", "?", "#"]);
check("room3: portal+treasure+save+guide reachable",
  !!r3["_"] && !!r3["$"] && !!r3["?"] && !!r3["#"]);

// --- chord -> pocket opens; same tune reopens the same pocket --------
const before = doc.scrollCount;
const p1 = openPocket(doc, "1.1.1/1.1.1/1.1.1", [3, 7, 11]);
check("pocket inscribed as new scroll", doc.scrollCount === before + 1);
check("pocket has gate+spawn+powerup",
  ["^", "/", "*"].every((c) => doc.get(p1.coord).includes(c)));
const p1again = openPocket(doc, "1.1.1/1.1.1/1.1.1", [3, 7, 11]);
check("same tune reopens same pocket",
  p1again.reopened && p1again.coord === p1.coord && doc.scrollCount === before + 1);
const p2 = openPocket(doc, "1.1.1/1.1.1/1.1.1", [1, 2, 4]);
const p3 = openPocket(doc, "1.1.1/1.1.1/1.1.1", [5, 9, 10]);
check("three chords -> three distinct pockets",
  new Set([p1.coord, p2.coord, p3.coord]).size === 3);
check("three pockets -> visibly different data",
  new Set([doc.get(p1.coord), doc.get(p2.coord), doc.get(p3.coord)]).size === 3);
const pk = reachableTargets(doc.get(p1.coord), ["^"]);
check("pocket: gate reachable from spawn", !!pk["^"]);
check("tune segments in WAL",
  doc.wal.filter((s) => s.op === "tune").length === 3);
check("pocket deterministic across worlds", (() => {
  const d2 = new Doc(text);
  const q = openPocket(d2, "1.1.1/1.1.1/1.1.1", [3, 7, 11]);
  return d2.get(q.coord) === doc.get(p1.coord);
})());

// --- inscription persists across re-derivation -----------------------
{
  const coord = "1.1.1/1.1.1/1.1.3";
  const g = gridFromText(doc.get(coord));
  g.rows[11][15] = "."; // a scar where the monster fell
  doc.inscribe(coord, textFromGrid(g), "scar", "monster fell at 15,11");
  const snapshot = doc.serialize();
  const s1 = viewSeedFor(coord, 1), s2 = viewSeedFor(coord, 2);
  check("re-derive re-rolls the view seed", s1 !== s2);
  check("inscribed scar survives re-derivation",
    doc.serialize() === snapshot && doc.get(coord).includes("."));
  check("scar segment in WAL", doc.wal.at(-1).op === "scar");
}

// --- monster: steps toward player along largest gap; falls ----------
{
  const g = gridFromText(doc.get("1.1.1/1.1.1/1.1.1"));
  let m = { x: 15, y: 11 };
  const player = { x: 3, y: 11 };
  const m2 = monsterStep(g, m, player);
  check("monster steps toward player", m2.x === 14 && m2.y === 11);
  const s = settle(g, { x: 9, y: 2 }, +1);
  check("settle falls to a standable cell", !s.fellOut && isStandable(g, s.pos.x, s.pos.y));
  const sUp = settle(g, { x: 9, y: 10 }, -1);
  check("settle works with gravity up", !sUp.fellOut && sUp.pos.y <= 10);
}

// --- Life: authored rooms keep their glyphs; pockets evolve ----------
{
  const g = gridFromText(doc.get("1.1.1/1.1.1/1.1.4")); // the flux room
  const after = lifeStepRoom(g, "flux", 7);
  const glyphs = (gr) => gr.rows.flat().filter((c) => "_/*!".includes(c)).length;
  check("flux life preserves authored glyphs", glyphs(after) === glyphs(g));
  const pg = gridFromText(doc.get(p1.coord));
  const pAfter = lifeStepRoom(pg, "earth", 1);
  check("pocket earth evolves under Life",
    textFromGrid(pAfter) !== textFromGrid(pg));
}

// --- escalation: speed follows world size ----------------------------
check("monster speed 1 at start size", monsterSpeed(doc) === 1);
{
  const d3 = new Doc(text);
  for (let i = 0; i < 4; i++) openPocket(d3, "1.1.1/1.1.1/1.1.1", [1, 2, 3 + i]);
  check("monster speed 2 once the world doubles", monsterSpeed(d3) === 2);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
