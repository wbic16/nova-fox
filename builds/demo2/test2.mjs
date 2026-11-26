// Nova Fox demo2 — headless playtest of the world module.
// Run: node test2.mjs   (uses the real nova_core.wasm from v1's core)
import { readFileSync } from "node:fs";
import {
  Subspace, genChunk, chunkBlock, baseBlockAt, heightAt, chordTarget,
  kernels, hashStringJS, genFoamJS, lifeStepJS,
  BLOCK, CHUNK, WORLD_H, LIFE_N, CEIL_Y, DUNGEON, BRIDGE_CHORD,
} from "./world.js";

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const bytesEqual = (a, b) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
function countBlock(data, b) {
  let n = 0;
  for (let i = 0; i < data.length; i++) if (data[i] === b) n++;
  return n;
}

// --- kernels: WASM vs JS must agree bit for bit ----------------------
const wasmBytes = readFileSync(new URL("./nova_core.wasm", import.meta.url));
check("wasm instantiates", await kernels.init(wasmBytes));
check("kernels report wasm", kernels.usingWasm === true);
for (const s of ["", "nova-prime|scroll|0,0", "1,4,9", "x".repeat(300)]) {
  const enc = new TextEncoder().encode(s);
  const inp = new Uint8Array(kernels._mem.buffer, kernels._ex.in_ptr(), enc.length);
  inp.set(enc);
  check(`hash wasm==js ${JSON.stringify(s.slice(0, 16))}`,
    (kernels._ex.hash_bytes(enc.length) >>> 0) === hashStringJS(s));
}
{
  const layer = new Uint8Array(LIFE_N * LIFE_N);
  for (let i = 0; i < layer.length; i++) layer[i] = (i * 7919) % 5 === 0 ? 1 : 0;
  const inp = new Uint8Array(kernels._mem.buffer, kernels._ex.in_ptr(), layer.length);
  inp.set(layer);
  kernels._ex.life_step(LIFE_N, LIFE_N);
  const wasmLife = new Uint8Array(
    new Uint8Array(kernels._mem.buffer, kernels._ex.out_ptr(), layer.length));
  check("life wasm==js", Buffer.from(wasmLife).equals(Buffer.from(lifeStepJS(layer, LIFE_N, LIFE_N))));
  check("foam wasm==js", kernels.foam(777, 20, 13) === genFoamJS(777, 20, 13));
}

// --- generation determinism: same subspace state -> same chunk -------
{
  const mk = () => {
    const s = new Subspace();
    s.getScroll("nova", 0, 0); s.getScroll("nova", 1, 0); s.getScroll("nova", 0, 1);
    s.getScroll("ashfall", 0, 0);
    return s;
  };
  const a = mk(), b = mk();
  for (const [realm, cx, cz] of [["nova", 0, 0], ["nova", 3, 0], ["nova", 4, 1],
                                 ["nova", -1, 2], ["ashfall", 0, 0], ["ashfall", 2, -1]]) {
    check(`genChunk deterministic (${realm} ${cx},${cz})`,
      bytesEqual(genChunk(a, realm, cx, cz), genChunk(b, realm, cx, cz)));
  }
  // And a different realm/state really is a different world.
  check("nova and ashfall chunks differ",
    !bytesEqual(genChunk(a, "nova", 0, 0), genChunk(a, "ashfall", 0, 0)));
}

// --- the dungeon is in the generation --------------------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  const chunk = genChunk(s, "nova", 3, 2); // x 48..63, z 32..47 — hall country
  const at = (x, y, z) => chunkBlock(chunk, x - 48, y, z - 32);
  check("deep stone block generated", at(DUNGEON.deepStone.x, DUNGEON.deepStone.y, DUNGEON.deepStone.z) === BLOCK.DEEPSTONE);
  check("hall floor is brick", at(50, DUNGEON.floorY, 35) === BLOCK.BRICK);
  check("hall interior is open", at(50, DUNGEON.floorY + 2, 35) === BLOCK.AIR);
  check("hall wall is brick", baseBlockAt(s, "nova", DUNGEON.x0, DUNGEON.floorY + 2, 35) === BLOCK.BRICK);
  check("shaft is carved at the mouth level",
    baseBlockAt(s, "nova", DUNGEON.shaftX + 1, DUNGEON.ceilY + 4, DUNGEON.shaftZ + 1) !== BLOCK.STONE ||
    baseBlockAt(s, "nova", DUNGEON.shaftX + 1, DUNGEON.ceilY + 4, DUNGEON.shaftZ + 1) === BLOCK.BRICK);
}

// --- physics: coupled Life == kernel Life when isolated --------------
{
  const s = new Subspace();
  const sc = s.getScroll("nova", 0, 0);
  const before = new Uint8Array(sc.grid);
  s.tick(null);
  check("isolated scroll step == kernel life step",
    bytesEqual(sc.grid, lifeStepJS(before, LIFE_N, LIFE_N)));
}

// --- physics: a birth caused by the NEIGHBOR scroll -------------------
{
  const mk = (neighborHelps) => {
    const s = new Subspace();
    const A = s.getScroll("nova", 0, 0);
    const B = s.getScroll("nova", 1, 0);
    A.grid.fill(0); B.grid.fill(0);
    // Two live cells in A beside the shared border...
    A.grid[11 * LIFE_N + 31] = 1;
    A.grid[11 * LIFE_N + 30] = 1;
    // ...and the third neighbor lives in B, across the border.
    if (neighborHelps) B.grid[11 * LIFE_N + 0] = 1;
    s.tick(null);
    return A.grid[12 * LIFE_N + 31];
  };
  check("birth on the edge caused by the neighbor scroll", mk(true) === 1);
  check("no birth without the neighbor's cell", mk(false) === 0);
}

// --- generation: neighbor pressure changes YOUR border chunk ---------
{
  const mk = (neighborAlive) => {
    const s = new Subspace();
    const west = s.getScroll("nova", 0, 0);
    const here = s.getScroll("nova", 1, 0);
    const far = s.getScroll("nova", 2, 0);
    here.grid.fill(0); far.grid.fill(0);
    west.grid.fill(neighborAlive ? 1 : 0);
    return s;
  };
  const a = mk(true), b = mk(false);
  const borderA = genChunk(a, "nova", 4, 0); // first chunk of scroll (1,0)
  const borderB = genChunk(b, "nova", 4, 0);
  check("neighbor pressure grows crystal along your seam",
    countBlock(borderA, BLOCK.CRYSTAL) > countBlock(borderB, BLOCK.CRYSTAL),
    `A=${countBlock(borderA, BLOCK.CRYSTAL)} B=${countBlock(borderB, BLOCK.CRYSTAL)}`);
  check("far chunk untouched by the neighbor's state",
    bytesEqual(genChunk(a, "nova", 8, 0), genChunk(b, "nova", 8, 0)));
}

// --- chords: the numbers are the teleport ------------------------------
{
  const s = new Subspace();
  check("bridge chord crosses nova -> ashfall",
    chordTarget(s, "nova", 0, 0, [9, 1, 4], null).realmId === "ashfall");
  check("bridge chord crosses ashfall -> nova",
    chordTarget(s, "ashfall", 0, 0, BRIDGE_CHORD, null).realmId === "nova");
  const p1 = chordTarget(s, "nova", 0, 0, [2, 5, 11], null);
  const p2 = chordTarget(s, "nova", 0, 0, [11, 2, 5], null);
  check("other chords open a pocket of the same realm",
    p1.type === "pocket" && p1.realmId === "nova");
  check("pocket target is deterministic (order-free)",
    p1.sx === p2.sx && p1.sy === p2.sy);
  check("replaying the pocket's own tune is a stay",
    chordTarget(s, "nova", p1.sx, p1.sy, [2, 5, 11], p1.chord).type === "stay");
}

// --- gravity: a subspace fact the generator obeys ----------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  const before = genChunk(s, "nova", 0, 0);
  check("no vault while down is down", countBlock(before, BLOCK.VAULT) === 0);
  const walBefore = s.wal.length;
  s.flipGravity("nova", 0, 0);
  check("flip is inscribed", s.wal.length > walBefore && s.wal.at(-1).op === "warp");
  const after = genChunk(s, "nova", 0, 0);
  check("vault appears when down is up", countBlock(after, BLOCK.VAULT) > 100,
    `vault=${countBlock(after, BLOCK.VAULT)}`);
  check("vault sits at the ceiling", (() => {
    for (let i = 0; i < after.length; i++) {
      if (after[i] === BLOCK.VAULT) {
        const y = Math.floor(i / (CHUNK * CHUNK));
        return y === CEIL_Y || y === CEIL_Y + 1;
      }
    }
    return false;
  })());
}

// --- monsters: press-in across a scroll border --------------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0); s.getScroll("nova", 1, 0);
  s.monsters.length = 0; // test drives its own cast
  // Find a row where the surface lets the thing walk west.
  let gy = -1;
  for (let cand = 4; cand < 28 && gy < 0; cand++) {
    const hHere = heightAt("nova", 32 * 2 + 1, cand * 2 + 1);
    const hThere = heightAt("nova", 31 * 2 + 1, cand * 2 + 1);
    if (Math.abs(hHere - hThere) <= 3) gy = cand;
  }
  check("found a walkable border row", gy > 0);
  const m = s.spawnMonster("nova", 32, gy, "surface"); // west edge of scroll (1,0)
  const player = { realmId: "nova", bx: 10, bz: gy * 2 + 1 };
  const walBefore = s.wal.length;
  s.tick(player);
  check("monster stepped west toward the player", m.gx === 31, `gx=${m.gx}`);
  check("crossing into the player's scroll is a press-in (logged)",
    s.wal.slice(walBefore).some((w) => w.op === "press-in"));
}

// --- striking a monster: edited out, scar persists in generation --------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  s.monsters.length = 0;
  const m = s.spawnMonster("nova", 10, 10, "surface");
  const bx = 10 * 2 + 1, bz = 10 * 2 + 1;
  const by = heightAt("nova", bx, bz) + 1;
  check("one strike edits a surface thing out", s.strikeMonster(m) === true && !m.alive);
  check("scar override recorded", s.getOverride("nova", bx, by, bz) === BLOCK.SCAR);
  const chunk = genChunk(s, "nova", 1, 1);
  check("scar is in the regenerated chunk",
    chunkBlock(chunk, bx - 16, by, bz - 16) === BLOCK.SCAR);
  const g = s.spawnMonster("nova", 27, 19, "guardian");
  check("guardian holds through two strikes",
    s.strikeMonster(g) === false && s.strikeMonster(g) === false && g.alive);
  check("guardian falls to the third", s.strikeMonster(g) === true && !g.alive);
}

// --- the quest: reaching the deep stone grants the hat -------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  check("quest not done from afar",
    s.checkQuest(8, heightAt("nova", 8, 8) + 1, 8) === false);
  const d = DUNGEON.deepStone;
  check("reaching the deep stone completes the quest",
    s.checkQuest(d.x, d.y, d.z) === true);
  check("hat granted, once", s.hatGranted === true && s.checkQuest(d.x, d.y, d.z) === false);
  check("grant is in the inscription log",
    s.wal.some((w) => w.op === "grant"));
}

// --- escalation: speed follows the living size of the world --------------
{
  const s = new Subspace();
  for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) s.getScroll("nova", sx, sy);
  check("genesis baseline recorded", s.genesisLife !== null && s.genesisLife > 0);
  check("speed 1 at genesis size", s.monsterSpeed() === 1);
  for (const sc of s.scrolls.values()) sc.grid.fill(1);
  check("speed 2 when the living world doubles", s.monsterSpeed() === 2);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
