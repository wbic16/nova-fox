// Nova Fox demo3 — headless playtest of the world module.
// Run: node test2.mjs   (uses the real nova_core.wasm from v1's core)
import { readFileSync } from "node:fs";
import {
  Subspace, genChunk, chunkBlock, baseBlockAt, heightAt, chordTarget,
  kernels, hashStringJS, genFoamJS, lifeStepJS,
  BLOCK, CHUNK, WORLD_H, LIFE_N, CEIL_Y, DUNGEON, BRIDGE_CHORD,
  ITEM_DEFS, computeScore, totalScore, dailyPocket, checkDaily,
  BRUSHES, brushBlocks,
  REALMS, REALM_PALETTES, HOME_PALETTE, paletteFor,
  realmCoord, subspaceDelta, subspaceDistance, riftRingGeometry,
} from "./world.js";
import {
  ECO_RATES, LANCE, newEconomyState, loadEconomyState, isGenerator,
  accrue, dailyPrizeDraw, convertTokens, weekKeyOf,
  makeGiftKey, isGiftKey, giftKeyHash, giftIssuedLine, giftRedeemedLine,
  parseEcoLedger, redeemGiftKey, applyGiftRedemption, buyGift,
  handdownLine, sendHanddown, applyHanddowns,
  verifyGumroadKey, applyGumroadVerification,
  purchaseClaimLine, parsePurchaseBoard, purchaseNumberFor,
  LADDER_RUNGS, LADDER_BEAT, rungById, ownsRung, buyRung, grantRung,
  ladderLampBonuses,
} from "./economy.js";
import {
  SCHEME_PREF_KEY, schemeFromPref, schemeFromLegacy, isScheme,
  otherScheme, prefForScheme, resolveScheme, schemeBeatId,
} from "./scheme.js";

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

// --- generation: neighbor pressure feeds GROWTH, gradually (v3) -------
{
  const mk = (neighborAlive) => {
    const s = new Subspace();
    const west = s.getScroll("nova", 0, 0);
    const here = s.getScroll("nova", 1, 0);
    const far = s.getScroll("nova", 2, 0);
    here.grid.fill(0); far.grid.fill(0);
    if (neighborAlive) {
      // Still-life blocks (2x2, stable forever under Life) packed
      // along the shared edge: the neighbor's edge line stays half
      // alive across all 80 ticks, so the pressure persists. (A
      // full grid dies in one step; a plain line erodes.)
      west.grid.fill(0);
      for (let ry = 0; ry < LIFE_N; ry += 4) {
        for (const cx of [LIFE_N - 2, LIFE_N - 1]) {
          west.grid[ry * LIFE_N + cx] = 1;
          west.grid[(ry + 1) * LIFE_N + cx] = 1;
        }
      }
    }
    return s;
  };
  const a = mk(true), b = mk(false);
  // Nothing pops (feedback #6): a freshly opened world has NO grown
  // crystal anywhere, however dense the pattern already is.
  check("fresh world: no crystal has popped into existence",
    countBlock(genChunk(b, "nova", 4, 0), BLOCK.CRYSTAL) === 0 &&
    countBlock(genChunk(a, "nova", 4, 0), BLOCK.CRYSTAL) === 0);
  // The accelerator: many ticks of pressure ramp the seam's growth.
  for (let i = 0; i < 80; i++) { a.tick(null); b.tick(null); }
  const seamCell = { gx: 32, gy: 16 }; // first cell column of scroll (1,0)
  check("growth ramps toward the pressure target, gradually",
    a.growthAt("nova", seamCell.gx, seamCell.gy) > 0.4 &&
    b.growthAt("nova", seamCell.gx, seamCell.gy) < 0.3,
    `a=${a.growthAt("nova", seamCell.gx, seamCell.gy)} b=${b.growthAt("nova", seamCell.gx, seamCell.gy)}`);
  const borderA = genChunk(a, "nova", 4, 0);
  const borderB = genChunk(b, "nova", 4, 0);
  check("grown crystal appears along your seam only after the ramp",
    countBlock(borderA, BLOCK.CRYSTAL) > countBlock(borderB, BLOCK.CRYSTAL),
    `A=${countBlock(borderA, BLOCK.CRYSTAL)} B=${countBlock(borderB, BLOCK.CRYSTAL)}`);
  check("far chunk untouched by the neighbor's state",
    bytesEqual(genChunk(a, "nova", 8, 0), genChunk(b, "nova", 8, 0)));
  // Growth is part of the state: two worlds ticked alike stay alike.
  const c1 = mk(true), c2 = mk(true);
  for (let i = 0; i < 40; i++) { c1.tick(null); c2.tick(null); }
  check("growth is deterministic (ticked-alike worlds generate alike)",
    bytesEqual(genChunk(c1, "nova", 4, 0), genChunk(c2, "nova", 4, 0)));
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

// --- the wisp: a training thing that waits and cannot hunt --------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  const w = s.spawnMonster("nova", 9, 6, "wisp");
  check("wisp has 2 hp and is always visible", w.hp === 2 && s.monsterVisible(w));
  const player = { realmId: "nova", bx: 40, bz: 40 };
  s.tick(player);
  check("wisp does not hunt (it waits where it was set)", w.gx === 9 && w.gy === 6);
  check("wisp holds one strike and falls to the second",
    s.strikeMonster(w) === false && w.alive && s.strikeMonster(w) === true && !w.alive);
}

// --- items: the Lance and the charms are placed, taken once ---------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  const kinds = s.items.map((i) => i.kind).sort();
  check("nova home scroll places lance + bright + ward",
    JSON.stringify(kinds) === JSON.stringify(["bright", "lance", "ward"]), kinds.join(","));
  s.getScroll("ashfall", 0, 0);
  check("ashfall home scroll places the swift charm",
    s.items.some((i) => i.kind === "swift"));
  const def = s.pickupItem("lance");
  check("the Star Lance is a weapon (range + damage beyond bare)",
    !!def && def.weapon === true && def.range > 4.4 && def.damage > 1);
  check("a taken thing cannot be taken twice", s.pickupItem("lance") === null);
  check("the taking is inscribed", s.wal.some((w) => w.op === "pickup"));
}

// --- the chisel: granular deformation, inscribed (feedback #10) -------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  const x = 24, z = 24, y = heightAt("nova", x, z) - 6; // deep enough to be stone
  check("target is stone", baseBlockAt(s, "nova", x, y, z) === BLOCK.STONE);
  const r1 = s.chiselBlock("nova", x, y, z);
  check("first stroke shapes (level 1)", r1.ok && r1.level === 1 && !r1.broke);
  check("the level is world truth", s.chiselLevel("nova", x, y, z) === 1);
  const r2 = s.chiselBlock("nova", x, y, z);
  check("second stroke shapes (level 2)", r2.ok && r2.level === 2);
  const r3 = s.chiselBlock("nova", x, y, z);
  check("third stroke breaks through", r3.ok && r3.broke);
  check("the break is an AIR inscription", s.getOverride("nova", x, y, z) === BLOCK.AIR);
  const chunk = genChunk(s, "nova", 1, 1);
  check("the broken block is air in the regenerated chunk",
    chunkBlock(chunk, x - 16, y, z - 16) === BLOCK.AIR);
  check("the bedrock refuses the chisel", s.chiselBlock("nova", x, 0, z).ok === false);
  check("chisel and break are in the log",
    s.wal.some((w) => w.op === "chisel") && s.wal.some((w) => w.op === "break"));
}

// --- scoring: the board counts what the log can prove -----------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  check("a fresh world scores 0", totalScore(s) === 0);
  s.pickupItem("lance");
  check("a pickup scores 40", totalScore(s) === 40);
  const m = s.spawnMonster("nova", 12, 12, "surface");
  s.strikeMonster(m);
  check("a scar scores 50 (90 total)", totalScore(s) === 90);
  const d = DUNGEON.deepStone;
  s.checkQuest(d.x, d.y, d.z);
  check("quest + grant score 750 (840 total)", totalScore(s) === 840,
    `score=${totalScore(s)}`);
}

// --- the daily pocket: one per day, the same for everyone -------------------
{
  const d1 = dailyPocket("2026-11-22");
  const d2 = dailyPocket("2026-11-22");
  check("the daily pocket is deterministic", JSON.stringify(d1) === JSON.stringify(d2));
  check("the daily chord is 3 distinct notes in 1..11",
    d1.chord.length === 3 && new Set(d1.chord).size === 3 &&
    d1.chord.every((n) => n >= 1 && n <= 11));
  const s = new Subspace();
  s.getScroll("nova", d1.sx, d1.sy);
  check("standing in the day's page claims the feat",
    checkDaily(s, "nova", d1.sx, d1.sy, "2026-11-22") === true);
  check("the feat claims exactly once",
    checkDaily(s, "nova", d1.sx, d1.sy, "2026-11-22") === false);
  check("the daily scores 300", computeScore(s).counts.daily === 1);
}

// --- v5: monsters despawn, and the dead are reaped (feedback #1) --------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  s.monsters.length = 0;
  const m = s.spawnMonster("nova", 12, 12, "surface");
  for (let i = 0; i < 160; i++) s.tick(null); // nobody watching
  check("a resting, unwatched monster sinks back (despawn)",
    !s.monsters.includes(m) && s.wal.some((w) => w.op === "fade"));
  const s2 = new Subspace();
  s2.getScroll("nova", 0, 0);
  s2.monsters.length = 0;
  const m2 = s2.spawnMonster("nova", 12, 12, "surface");
  const near = { realmId: "nova", bx: 25, bz: 25 }; // same scroll: watched
  for (let i = 0; i < 160; i++) s2.tick(near);
  check("a watched monster never despawns", s2.monsters.includes(m2));
  const s3 = new Subspace();
  s3.getScroll("nova", 0, 0);
  s3.monsters.length = 0;
  const m3 = s3.spawnMonster("nova", 12, 12, "surface");
  s3.strikeMonster(m3);
  const bx = 12 * 2 + 1, bz = 12 * 2 + 1, by = heightAt("nova", bx, bz) + 1;
  for (let i = 0; i < 95; i++) s3.tick(near);
  check("the dead are reaped, but the scar stays written",
    !s3.monsters.includes(m3) && s3.getOverride("nova", bx, by, bz) === BLOCK.SCAR);
}

// --- carrying: rifts move monsters between regions (Will, 2026-11-24) ---
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  s.getScroll("ashfall", 0, 0);
  s.monsters.length = 0;
  const m = s.spawnMonster("nova", 12, 12, "surface");
  check("a monster rises native to its region",
    m.nativeRealmId === "nova" && m.realmId === "nova");
  check("carrying moves a surface monster across the rift",
    s.carryMonster(m, "ashfall", 40, 41) === true);
  check("a carried monster lives where it landed",
    m.realmId === "ashfall" && m.gx === 40 && m.gy === 41 &&
    m.hx === 40 && m.hy === 41 && m.restTicks === 0);
  check("carrying never rewrites where a monster rose",
    m.nativeRealmId === "nova");
  check("the carrying is inscribed",
    s.wal.some((w) => w.op === "carry"));
  const w = s.spawnMonster("nova", 9, 6, "wisp");
  check("a wisp waits where it was set — it cannot be carried",
    s.carryMonster(w, "ashfall", 40, 41) === false && w.realmId === "nova");
  const g = s.spawnMonster("nova", 27, 19, "guardian");
  check("the guardian keeps its hall — it cannot be carried",
    s.carryMonster(g, "ashfall", 40, 41) === false && g.realmId === "nova");
  const d = s.spawnMonster("nova", 14, 14, "surface");
  s.strikeMonster(d);
  check("the dead cannot be carried",
    s.carryMonster(d, "ashfall", 40, 41) === false && d.realmId === "nova");
}

// --- v5: gravity is remembered per WORLD (feedback #25) ------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  s.flipGravity("nova", 0, 0);
  check("a flip in one page is the whole realm's down",
    s.gravityOf("nova", 3, -2) === -1 && s.gravityOf("ashfall", 0, 0) === 1);
  const far = genChunk(s, "nova", 4, 0); // a page the flip never named
  check("the vault generates realm-wide after one flip",
    countBlock(far, BLOCK.VAULT) > 0);
  s.flipGravity("nova", 2, 2);
  check("flipping back anywhere restores the realm", s.gravityOf("nova", 0, 0) === 1);
}

// --- v5: the chisel names its refusals (feedback #11) ----------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  check("bedrock refuses as bedrock",
    s.chiselBlock("nova", 24, 0, 24).reason === "bedrock");
  const d = DUNGEON.deepStone;
  check("the Deep Stone refuses as the quest stone",
    s.chiselBlock("nova", d.x, d.y, d.z).reason === "deepstone");
  check("open air refuses as air",
    s.chiselBlock("nova", 24, heightAt("nova", 24, 24) + 5, 24).reason === "air");
  const x = 28, z = 28, y = heightAt("nova", x, z) - 6;
  s.chiselBlock("nova", x, y, z); s.chiselBlock("nova", x, y, z); s.chiselBlock("nova", x, y, z);
  check("a broken-through block refuses as already gone",
    s.chiselBlock("nova", x, y, z).reason === "gone");
}

// --- v5: brushes shape a volume per stroke (feedback #4) -------------------
{
  const one = brushBlocks(BRUSHES[0], 10, 10, 10, { x: 0, y: -1, z: 0 });
  check("the single brush is the one block aimed at",
    one.length === 1 && one[0].join() === "10,10,10");
  const flat = brushBlocks(BRUSHES[1], 10, 10, 10, { x: 0, y: -1, z: 0 });
  check("2x2x3 aimed down is 12 cells, all at or below the face",
    flat.length === 12 && flat.every((c) => c[1] <= 10) &&
    new Set(flat.map((c) => c.join())).size === 12);
  const north = brushBlocks(BRUSHES[2], 10, 10, 10, { x: 0, y: 0, z: -1 });
  check("3x3x2 aimed north reaches north, 18 cells",
    north.length === 18 && north.every((c) => c[2] <= 10));
}

// --- v5: repeated digits are valid coordinates (feedback #9) ----------------
{
  const s = new Subspace();
  const t = chordTarget(s, "nova", 0, 0, [2, 2, 2], null);
  check("the tune 2-2-2 answers like any other (a pocket)",
    t.type === "pocket" && t.realmId === "nova");
  check("replaying 2-2-2 on its own page is a stay",
    chordTarget(s, "nova", t.sx, t.sy, [2, 2, 2], [2, 2, 2]).type === "stay");
}

// --- v5: block variation in generation (feedback #10) -----------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0); s.getScroll("ashfall", 0, 0);
  let moss = 0, sand = 0;
  for (const [cx, cz] of [[0, 0], [1, 0], [0, 1], [2, 2], [-1, 0], [3, -1]]) {
    for (let x = cx * 16; x < cx * 16 + 16; x += 3) {
      for (let z = cz * 16; z < cz * 16 + 16; z += 3) {
        const top = baseBlockAt(s, "nova", x, heightAt("nova", x, z), z);
        if (top === BLOCK.MOSS) moss++;
        if (top === BLOCK.SANDSTONE) sand++;
      }
    }
  }
  check("nova's meadow wears moss and sandstone patches", moss > 0 && sand > 0,
    `moss=${moss} sand=${sand}`);
  let shale = false;
  for (let x = 0; x < 64 && !shale; x++) {
    for (let z = 0; z < 64 && !shale; z++) {
      if (heightAt("ashfall", x, z) >= 18 &&
          baseBlockAt(s, "ashfall", x, 15, z) === BLOCK.SHALE) shale = true;
    }
  }
  check("ashfall's strata carry shale bands", shale);
}

// --- v5: the tick is local — far scrolls sleep, then catch up (#8) ----------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  const far = s.getScroll("nova", 5, 5);
  const frozen = new Uint8Array(far.grid);
  const player = { realmId: "nova", bx: 8, bz: 8 };
  for (let i = 0; i < 5; i++) s.tick(player);
  check("a far scroll sleeps while the player is elsewhere",
    bytesEqual(far.grid, frozen) && (far.missedTicks || 0) >= 5);
  const inside = { realmId: "nova", bx: 5 * 64 + 8, bz: 5 * 64 + 8 };
  s.tick(inside);
  check("entering the neighborhood wakes it (catch-up steps land)",
    !bytesEqual(far.grid, frozen) && (far.missedTicks || 0) === 0);
}

// --- feedback #27: ten realm palettes, data-driven -------------------------
{
  const keys = Object.keys(REALM_PALETTES);
  check("the palette table has exactly 10 entries", keys.length === 10,
    `got ${keys.length}`);
  const ranchIds = REALMS.filter((r) => r.id !== "nova").map((r) => r.id);
  check("the 10 entries are the 10 ranch-named realms",
    ranchIds.length === 10 && ranchIds.every((id) => keys.includes(id)),
    `realms=${ranchIds.join(",")} keys=${keys.join(",")}`);
  const FIELDS = ["void", "fog", "fogNear", "fogFar", "hemiSky", "hemiGround",
    "hemiI", "sun", "sunI", "accent", "accent2", "hue", "sat", "tint"];
  check("every palette carries every field",
    [...keys.map((k) => REALM_PALETTES[k]), HOME_PALETTE]
      .every((p) => FIELDS.every((f) => typeof p[f] === "number")));
  const all = [...keys.map((k) => REALM_PALETTES[k]), HOME_PALETTE];
  const distinct = (f) => new Set(all.map((p) => p[f])).size === all.length;
  check("all 11 fog colors are distinct", distinct("fog"));
  check("all 11 accents are distinct", distinct("accent"));
  check("every realm stays OLED-dark (void is pure black)",
    all.every((p) => p.void === 0x000000));
  check("home keeps the palette-v4 identity",
    HOME_PALETTE.fog === 0x020814 && HOME_PALETTE.accent === 0x00d9ff &&
    HOME_PALETTE.accent2 === 0x2979ff && HOME_PALETTE.hue === 0 &&
    HOME_PALETTE.sat === 1);
  check("paletteFor resolves home and every ranch realm",
    paletteFor("nova") === HOME_PALETTE &&
    keys.every((k) => paletteFor(k) === REALM_PALETTES[k]));
  check("paletteFor falls back to home for an unknown realm",
    paletteFor("no-such-realm") === HOME_PALETTE);
  // Departures are hue/saturation moves, not brightness steps: at
  // least 8 of the 10 shift the atlas hue or drain its saturation.
  const shifted = keys.filter((k) => {
    const p = REALM_PALETTES[k];
    return p.hue !== 0 || p.sat < 0.9;
  });
  check("the departures are hue moves, not brightness steps",
    shifted.length >= 8, `shifted=${shifted.length}`);
}

// --- subspace geometry: portal form from the shape of CYOA ------
// (Will, 2026-11-24 — Leg A. The realms' coordinates are derived
// from CYOA's skeleton: entry, the Mytheon corridor, its four
// named exits, then the anchors of its largest library clusters.)
{
  const COORDS = {
    nova: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    ashfall: [10, 10, 1, 1, 1, 1, 1, 10, 10],
    "ni-knight": [10, 10, 2, 1, 1, 1, 1, 10, 10],
    logos: [10, 10, 3, 1, 1, 1, 1, 10, 10],
    elven: [10, 1, 1, 1, 2, 1, 1, 10, 1],
    orchid: [1, 10, 1, 1, 2, 1, 1, 10, 1],
    halycon: [2, 10, 1, 1, 2, 1, 1, 10, 1],
    delta: [3, 10, 1, 1, 2, 1, 1, 10, 1],
    willow: [90, 1, 1, 1, 1, 1, 1, 1, 1],
    plain: [3, 1, 1, 1, 1, 1, 7, 7, 7],
    trust: [7, 1, 1, 1, 1, 1, 1, 1, 1],
  };
  check("every realm sits at a 9-component subspace coordinate",
    REALMS.every((r) => Array.isArray(r.coord) && r.coord.length === 9 &&
      r.coord.every((v) => Number.isInteger(v))));
  check("the coordinates are the CYOA-shape landmarks, in realm order",
    REALMS.every((r) => bytesEqual(realmCoord(r.id), COORDS[r.id])));
  check("realmCoord hands out copies — the map cannot be rewritten",
    (() => { const c = realmCoord("nova"); c[0] = 999;
      return realmCoord("nova")[0] === 1; })());
  check("the bridge jump's difference is the corridor minus the entry",
    bytesEqual(subspaceDelta("nova", "ashfall"), [9, 9, 0, 0, 0, 0, 0, 9, 9]) &&
    bytesEqual(subspaceDelta("ashfall", "nova"), [-9, -9, 0, 0, 0, 0, 0, -9, -9]));
  check("distance is the lattice's own: zero at home, symmetric",
    subspaceDistance("nova", "nova") === 0 &&
    subspaceDistance("elven", "trust") === subspaceDistance("trust", "elven"));
  check("the corridor's neighbors stand one step apart",
    subspaceDistance("ashfall", "ni-knight") === 1 &&
    subspaceDistance("orchid", "halycon") === 1);
  check("Nova to Ashfall spans exactly 18",
    subspaceDistance("nova", "ashfall") === 18);
  check("the widest jump the shape affords: Best Willow to Orchid Flow",
    Math.abs(subspaceDistance("willow", "orchid") - Math.sqrt(8084)) < 1e-9 &&
    subspaceDistance("nova", "willow") === 89);
  // The ring's geometry tracks the difference — it is computed
  // from the pair's coordinates, so ordering pairs by distance
  // must order their rings by size, pair by pair, no exceptions.
  const pairs = [];
  for (let i = 0; i < REALMS.length; i++)
    for (let j = i + 1; j < REALMS.length; j++)
      pairs.push([REALMS[i].id, REALMS[j].id]);
  const byDist = pairs.map(([a, b]) => [subspaceDistance(a, b), riftRingGeometry(a, b).radius])
    .sort((x, y) => x[0] - y[0]);
  check("ring radius grows with subspace distance across all 55 pairs",
    byDist.every((p, i) => {
      if (i === 0) return true;
      const q = byDist[i - 1];
      // (a 1e-9 slack: two pairs can share a true distance whose
      // computed lengths differ in the last ulp — their rings are
      // then identical, which is the function being faithful.)
      return p[0] - q[0] > 1e-9 ? p[1] > q[1] : p[1] === q[1];
    }));
  check("a near door stands smaller than the bridge door, a far one larger",
    riftRingGeometry("orchid", "halycon").radius < riftRingGeometry("nova", "ashfall").radius &&
    riftRingGeometry("nova", "ashfall").radius < riftRingGeometry("willow", "orchid").radius &&
    Math.abs(riftRingGeometry("nova", "ashfall").radius - 1.5571) < 0.001);
  check("the ring's facets count the axes the jump crosses",
    riftRingGeometry("nova", "nova").segments === 24 &&
    riftRingGeometry("nova", "ashfall").segments === 36 &&
    riftRingGeometry("logos", "willow").segments === 39);
  check("a within-realm hop is a zero jump: smallest ring, no axes crossed",
    (() => { const g = riftRingGeometry("ashfall", "ashfall");
      return g.distance === 0 && g.axes === 0 && g.radius === 1; })());
}

// --- the economy (demo4): entitlement, ledgers, faucets, the record --------
{
  const paidEco = () => {
    const e = newEconomyState();
    applyGumroadVerification(e, "AAAA-BBBB", { ok: true, saleRef: "sale-1" }, 1000);
    return e;
  };
  // Accrual: an hour of free play drips 20 flux and no credits (P1).
  {
    const e = newEconomyState();
    const m = accrue(e, 3600);
    check("eco: a free hour drips 20 flux, earns no credits",
      m.tokensMinted === 20 && m.creditsMinted === 0 && e.tokens === 20 && e.credits === 0);
  }
  // Accrual: an hour of generator play spews 100 and earns 10 credits (P2/P3/P4).
  {
    const e = paidEco();
    const m = accrue(e, 3600);
    check("eco: a generator hour spews 100 flux and earns 10 credits",
      m.tokensSpewed === 100 && m.creditsMinted === 10 && e.poolSpewed === 100 && e.credits === 10);
    check("eco: the generator still gets the free drip too", e.tokens === 20);
  }
  // Fractions carry: two half-hours equal the hour, nothing lost to ticking.
  {
    const e = paidEco();
    accrue(e, 1800); accrue(e, 1800);
    check("eco: fractional accrual carries across ticks",
      e.tokens === 20 && e.credits === 10 && e.poolSpewed === 100);
    const f = newEconomyState();
    accrue(f, 90); // 0.5 flux of drip — not yet a whole token
    check("eco: sub-token accrual mints nothing yet", f.tokens === 0);
    accrue(f, 90);
    check("eco: two 90-second drips make a whole token", f.tokens === 1);
  }
  // Conversion (Fork B): 50 : 1, bounded by the purse, week-accounted.
  {
    const e = newEconomyState();
    e.tokens = 120;
    const r = convertTokens(e, 5, new Date(2026, 10, 26));
    check("eco: conversion mints only what the purse affords",
      r.converted === 2 && r.spent === 100 && e.tokens === 20 && e.credits === 2);
    check("eco: conversion is counted in its week",
      e.conversionWeeks[weekKeyOf(new Date(2026, 10, 26))] === 2);
    check("eco: conversion with too little flux is a no-op",
      convertTokens(e, 1).converted === 0 && e.credits === 2);
  }
  // Daily prize: deterministic per (player, day), once per day, EV per P9.
  {
    const a = newEconomyState(), b = newEconomyState();
    const r1 = dailyPrizeDraw(a, "fox-1", "2026-11-26");
    const r2 = dailyPrizeDraw(b, "fox-1", "2026-11-26");
    check("eco: the daily prize draw is the same on every machine", r1.won === r2.won);
    const again = dailyPrizeDraw(a, "fox-1", "2026-11-26");
    check("eco: the daily prize cannot be drawn twice in a day",
      again.already === true && a.credits === (r1.won ? ECO_RATES.DAILY_PRIZE_CREDITS : 0));
    let wins = 0;
    const sim = newEconomyState();
    for (let d = 0; d < 3000; d++) {
      const date = `2027-${String(1 + (d % 12)).padStart(2, "0")}-${String(1 + (d % 28)).padStart(2, "0")}-${d}`;
      // distinct date strings per draw (the day counter rides along to keep them unique)
      if (dailyPrizeDraw(sim, "fox-ev", date).won) wins++;
    }
    const share = wins / 3000;
    check("eco: the prize win share matches P9's expectation (1 in 3)",
      share > 0.28 && share < 0.39, `share=${share.toFixed(3)}`);
  }
  // Gift keys: shape, hash commitment, the 100-credit price (P6).
  {
    let seed = 7;
    const rng = () => { seed = (seed * 1103515245 + 12345) & 0xff; return seed; };
    const key = makeGiftKey(rng);
    check("eco: a gift key has the NFG shape", isGiftKey(key), key);
    check("eco: the key hash is stable and key-shaped input matters",
      giftKeyHash(key) === giftKeyHash(key.toLowerCase()) && giftKeyHash(key) !== giftKeyHash(key + "X"));
    const poor = newEconomyState(); poor.credits = 99;
    check("eco: a gift at 99 credits is refused, purse untouched",
      buyGift(poor, rng, "fox-a", 1).ok === false && poor.credits === 99);
    const rich = newEconomyState(); rich.credits = 250;
    const g = buyGift(rich, rng, "fox-a", 1234);
    check("eco: a gift costs exactly 100 and issues its line",
      g.ok === true && rich.credits === 150 && g.line === giftIssuedLine(g.hash, "fox-a", 1234));
  }
  // Gift redemption against the shared ledger: one door, once.
  {
    let seed = 99;
    const rng = () => { seed = (seed * 48271) & 0xff; return seed; };
    const giver = newEconomyState(); giver.credits = 100;
    const g = buyGift(giver, rng, "fox-giver", 5000);
    const ledger = parseEcoLedger([g.line].join("\n"));
    const recip = newEconomyState();
    const res = redeemGiftKey(recip, g.key, ledger);
    check("eco: an issued gift key redeems", res.ok === true && res.hash === g.hash);
    applyGiftRedemption(recip, g.key, 6000);
    check("eco: redemption makes a generator of the gift source",
      isGenerator(recip) && recip.entitlement.source === "gift");
    const spentLedger = parseEcoLedger([g.line, giftRedeemedLine(g.hash, "fox-recip", 6000)].join("\n"));
    check("eco: a spent gift key does not redeem twice",
      redeemGiftKey(newEconomyState(), g.key, spentLedger).reason === "spent");
    check("eco: an unissued key is unknown to the ledger",
      redeemGiftKey(newEconomyState(), "NFG-AAAA-AAAA-AAAA-AAAA", ledger).reason === "unknown");
    check("eco: offline, a gift key waits — nothing granted on a guess",
      redeemGiftKey(newEconomyState(), g.key, null).pending === true);
    check("eco: a generator cannot redeem a second key",
      redeemGiftKey(recip, g.key, ledger).reason === "already");
    check("eco: a malformed key is a format refusal",
      redeemGiftKey(newEconomyState(), "not-a-key", ledger).reason === "format");
  }
  // Hand-downs: a transfer, not a faucet — debits here, credits there, once.
  {
    const a = newEconomyState(); a.credits = 40;
    const sent = sendHanddown(a, "hd-1", "fox-a", "fox-b", 15, 7000);
    check("eco: a hand-down debits the giver and writes its line",
      sent.ok === true && a.credits === 25 && sent.line === handdownLine("hd-1", "fox-a", "fox-b", 15, 7000));
    check("eco: a hand-down beyond the purse is refused",
      sendHanddown(a, "hd-2", "fox-a", "fox-b", 26, 7001).reason === "funds" && a.credits === 25);
    check("eco: a hand-down to yourself is refused",
      sendHanddown(a, "hd-3", "fox-a", "fox-a", 1, 7002).reason === "recipient");
    const ledger = parseEcoLedger(sent.line);
    const b = newEconomyState();
    check("eco: the recipient is credited on read-back",
      applyHanddowns(b, ledger, "fox-b") === 15 && b.credits === 15);
    check("eco: the same hand-down never lands twice",
      applyHanddowns(b, ledger, "fox-b") === 0 && b.credits === 15);
    check("eco: a hand-down addressed elsewhere does not land here",
      applyHanddowns(newEconomyState(), ledger, "fox-c") === 0);
  }
  // Gumroad verification: the API's shapes, with a mock fetch.
  {
    const mkFetch = (payload, throws = false) => async (url, opts) => {
      check("eco: verification posts to Gumroad's license door",
        url === ECO_RATES.GUMROAD_VERIFY_URL && opts.method === "POST");
      const body = new URLSearchParams(opts.body);
      check("eco: verification names the product and does not consume a use",
        body.get("product_permalink") === "nova-fox" && body.get("increment_uses_count") === "false");
      if (throws) throw new Error("no route");
      return { json: async () => payload };
    };
    const good = await verifyGumroadKey(
      mkFetch({ success: true, uses: 1, purchase: { sale_id: "sale-9", refunded: false } }), "KEY-1");
    check("eco: a good Gumroad key verifies with its sale ref",
      good.ok === true && good.saleRef === "sale-9");
    check("eco: a refunded purchase's key does not verify",
      (await verifyGumroadKey(mkFetch({ success: true, purchase: { refunded: true } }), "K")).reason === "refunded");
    check("eco: an unknown key is rejected, not pending",
      (await verifyGumroadKey(mkFetch({ success: false }), "K")).reason === "rejected");
    check("eco: no route to Gumroad means pending, never 'no'",
      (await verifyGumroadKey(mkFetch(null, true), "K")).pending === true);
  }
  // The written record: purchase order is arrival order, first claim wins.
  {
    const text = [
      purchaseClaimLine("fox-b", "gift", 200),
      purchaseClaimLine("fox-a", "gumroad", 100), // later line, earlier ts: arrival rules, not the clock
      purchaseClaimLine("fox-b", "gumroad", 300),  // a second claim by fox-b: ignored
      "garbage line",
      purchaseClaimLine("fox-c", "gift", 400),
    ].join("\n");
    const rows = parsePurchaseBoard(text);
    check("eco: the record numbers claims in arrival order",
      rows.length === 3 && rows[0].name === "fox-b" && rows[0].number === 1 &&
      rows[1].name === "fox-a" && rows[1].number === 2 && rows[2].number === 3);
    check("eco: purchaseNumberFor reads a standing back",
      purchaseNumberFor(rows, "fox-a") === 2 && purchaseNumberFor(rows, "fox-z") === null);
  }
  // State hygiene: load guards the ledgers; the Lance stays unruled data.
  {
    const s = loadEconomyState({ tokens: -5, credits: 12.9, entitlement: { status: "paid", source: "gift" } });
    check("eco: loaded ledgers are clamped to whole, non-negative units",
      s.tokens === 0 && s.credits === 12 && isGenerator(s));
    check("eco: garbage state loads as a fresh purse",
      loadEconomyState("junk").credits === 0 && !isGenerator(loadEconomyState(null)));
    check("eco: the Lance classification is unruled data, its tiers dormant",
      LANCE.classification === "unruled" && LANCE.tiersDormant === true);
  }
}

// --- the ladder shop (demo5): the finite sink, Beat 1 tiers -------------------
{
  const bandSum = (b) => LADDER_RUNGS.filter((r) => r.band === b && !r.granted)
    .reduce((a, r) => a + r.price, 0);
  // The catalogue against the docs: PLAN §2.14's tables, ECONOMY §4.1's sums.
  check("ladder: the catalogue carries 42 rungs (26 Beat 1 incl. the grant, 16 Beat 2)",
    LADDER_RUNGS.length === 42 &&
    LADDER_RUNGS.filter((r) => r.beat === 1).length === 26 &&
    LADDER_RUNGS.filter((r) => r.beat === 2).length === 16);
  check("ladder: rung ids are unique",
    new Set(LADDER_RUNGS.map((r) => r.id)).size === LADDER_RUNGS.length);
  check("ladder: Band 1 bought rungs sum to ECONOMY §4.1's 225", bandSum(1) === 225);
  check("ladder: Band 2 sums to §4.1's 875", bandSum(2) === 875);
  check("ladder: the Apex sums to §4.1's 18,000", bandSum(4) === 18000);
  check("ladder: Band 3's non-Lance rungs sum to 3,450 — §4.1's 4,350 with the dormant Lance tiers",
    bandSum(3) === 3450 && bandSum(1) + bandSum(2) + bandSum(3) + bandSum(4) + 300 + 600 === 23450);
  check("ladder: Beat 1's shelf is white/grey/green only; red and blue are Beat 2",
    LADDER_RUNGS.filter((r) => r.beat === 1).every((r) => r.tiers === "white/grey" || r.tiers === "green") &&
    LADDER_RUNGS.filter((r) => r.beat === 2).every((r) => r.tiers === "red" || r.tiers === "blue") &&
    LADDER_BEAT === 1);
  check("ladder: no Lance tier is a rung — the Lance stays dormant data beside the ladder",
    !rungById("keen-lance") && !rungById("war-lance") &&
    LANCE.tiers.find((t) => t.id === "war-lance").price === 600 && LANCE.tiersDormant === true);
  // Balance checks and exact-once charging.
  {
    const e = newEconomyState(); e.credits = 14;
    const before = JSON.stringify(e);
    check("ladder: a purchase beyond the purse is refused, purse and ladder untouched",
      buyRung(e, "lamp-of-small-hours", 100).reason === "funds" && JSON.stringify(e) === before);
    e.credits = 15;
    const r = buyRung(e, "lamp-of-small-hours", 100);
    check("ladder: a purchase charges exactly its price, once",
      r.ok === true && e.credits === 0 && e.lifetime.creditsSpent === 15 && e.lifetime.ladderSpent === 15);
    check("ladder: the bought rung is recorded with its time and its way in",
      e.ladder["lamp-of-small-hours"].ts === 100 && e.ladder["lamp-of-small-hours"].via === "bought");
    e.credits = 500;
    check("ladder: a rung is bought once, ever — the second buy is refused uncharged",
      buyRung(e, "lamp-of-small-hours", 200).reason === "owned" && e.credits === 500 &&
      e.ladder["lamp-of-small-hours"].ts === 100);
  }
  // Tier gating: Beat 2 is data on the page, never a sale in this build.
  {
    const e = newEconomyState(); e.credits = 100000;
    check("ladder: a red rung (Band 3) is refused as a later beat's, uncharged",
      buyRung(e, "dragonward-breastplate", 1).reason === "beat" && e.credits === 100000 && !ownsRung(e, "dragonward-breastplate"));
    check("ladder: a blue rung (Apex) is refused the same way",
      buyRung(e, "nameless-sheath", 1).reason === "beat" && e.credits === 100000);
    check("ladder: an unknown rung id is refused",
      buyRung(e, "no-such-rung", 1).reason === "unknown" && e.credits === 100000);
  }
  // Prerequisite gating: the chains §2.14 states (brushes, chisels, flute).
  {
    const e = newEconomyState(); e.credits = 1000;
    check("ladder: the second brush is refused before the first is owned",
      buyRung(e, "grand-brush-3x3x2", 1).reason === "requires" && e.credits === 1000);
    buyRung(e, "grand-brush-2x2x3", 2);
    check("ladder: with the first brush owned, the second buys",
      buyRung(e, "grand-brush-3x3x2", 3).ok === true && e.credits === 1000 - 40 - 70);
    check("ladder: the chisel chain gates the same way",
      buyRung(e, "chisel-fine-degree", 4).reason === "requires" &&
      buyRung(e, "chisel-second-degree", 4).reason === "requires");
    buyRung(e, "chisel-first-degree", 5); buyRung(e, "chisel-second-degree", 6);
    check("ladder: the fine degree buys once both degrees below it are owned",
      buyRung(e, "chisel-fine-degree", 7).ok === true);
    check("ladder: Flute Harmonics waits on the Reed of Small Rifts",
      buyRung(e, "flute-harmonics", 8).reason === "requires" &&
      buyRung(e, "reed-of-small-rifts", 9).ok === true &&
      buyRung(e, "flute-harmonics", 10).ok === true);
  }
  // The grant: given by the quest, never sold, given once.
  {
    const e = newEconomyState(); e.credits = 50;
    check("ladder: the Deep Stone Hat cannot be bought at any purse",
      buyRung(e, "deep-stone-hat", 1).reason === "granted" && e.credits === 50);
    check("ladder: the grant lands, costs nothing, and is marked granted",
      grantRung(e, "deep-stone-hat", 42) === true && e.credits === 50 &&
      e.ladder["deep-stone-hat"].via === "granted" && e.lifetime.ladderSpent === 0);
    check("ladder: granting twice changes nothing",
      grantRung(e, "deep-stone-hat", 43) === false && e.ladder["deep-stone-hat"].ts === 42);
    check("ladder: a bought rung cannot be granted",
      grantRung(e, "pocket-bell", 44) === false);
  }
  // Persistence: ownership rides the save's load path, clamped like the ledgers.
  {
    const e = newEconomyState(); e.credits = 300;
    buyRung(e, "keepsake-tune-pip", 11);
    buyRung(e, "portal-twine", 12);
    grantRung(e, "deep-stone-hat", 13);
    const back = loadEconomyState(JSON.parse(JSON.stringify(e)));
    check("ladder: bought and granted rungs survive a save/load round-trip",
      ownsRung(back, "keepsake-tune-pip") && ownsRung(back, "portal-twine") &&
      back.ladder["deep-stone-hat"].via === "granted" && back.lifetime.ladderSpent === 85);
    const dirty = loadEconomyState({ ladder: { "not-a-rung": { ts: 1, via: "bought" }, "pocket-bell": { ts: 5, via: "forged" } } });
    check("ladder: a loaded ladder drops unknown rungs and coerces the way in",
      !ownsRung(dirty, "not-a-rung") && dirty.ladder["pocket-bell"].via === "bought");
    check("ladder: a purse with no ladder in its save loads an empty ladder",
      Object.keys(loadEconomyState({ credits: 5 }).ladder).length === 0);
  }
  // The whole Beat 1 shelf, bought end to end: the finite sink's Beat 1 depth.
  {
    const e = newEconomyState(); e.credits = 1100;
    for (const r of LADDER_RUNGS.filter((x) => x.beat === 1 && !x.granted)) buyRung(e, r.id, 99);
    check("ladder: the whole Beat 1 shelf costs exactly 1,100 (225 + 875) and empties the purse",
      e.credits === 0 && e.lifetime.ladderSpent === 1100 &&
      LADDER_RUNGS.filter((x) => x.beat === 1 && !x.granted).every((x) => ownsRung(e, x.id)));
  }
  // The lamp bonuses: the one wired parameter pair, off by default.
  {
    const e = newEconomyState();
    check("ladder: an unladdered lamp gets no bonus",
      ladderLampBonuses(e).intensity === 0 && ladderLampBonuses(e).distance === 0 && ladderLampBonuses(e).angle === 0);
    e.credits = 100;
    buyRung(e, "lamp-of-small-hours", 1);
    check("ladder: Small Hours feeds the flame and stretches the throw",
      ladderLampBonuses(e).intensity === 1 && ladderLampBonuses(e).distance === 18 && ladderLampBonuses(e).angle === 0);
    buyRung(e, "bright-charm-second-knot", 2);
    check("ladder: the Second Knot widens the cone",
      ladderLampBonuses(e).angle === 0.15);
  }
}

// --- the ship stamp (2026-11-26): the version is an epoch -------------------
// Nova Fox versions derive from the Exocortical Epoch the build
// shipped within. The stamp token lives in exactly one place in
// the source (game3.js) and so stands exactly once in the built
// file, where the staging step rewrites its digits; the hover
// binding that speaks it rides along in the same file.
{
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const stamps = html.match(/NF_SHIP_EE:\d+/g) || [];
  check("versioning: the ship-stamp token stands exactly once in the built file",
    stamps.length === 1, `found ${stamps.length}`);
  check("versioning: the stamp names a positive epoch",
    stamps.length === 1 && Number(stamps[0].split(":")[1]) > 0);
  check("versioning: the hover tip and its binding ride in the built file",
    html.includes('id="vertip"') && html.includes('$("ver-line1")') &&
    html.includes("ver-on"));
  // The number standing (Will, 2026-11-26 14:56 CST): always show
  // the EE number — it helps with play testing. #ee-line is in the
  // title cluster, populated from the same stamp, and carries no
  // .opt class, so the extras toggle can never tuck it away.
  check("versioning: the standing EE line rides in the built file",
    html.includes('<div id="ee-line"></div>') && html.includes("#ee-line {") &&
    html.includes('id="titlerow"'));
  check("versioning: the standing EE line is populated from the stamp",
    html.includes('$("ee-line")') && html.includes("`EE ${SHIP_EE}`"));
  check("versioning: the standing EE line is not gated by the extras toggle",
    !/<div id="ee-line"[^>]*class="[^"]*\bopt\b/.test(html) &&
    !html.includes('id="ee-line" class'));
}

// --- control schemes: preference, flip, variants (demo19) ------------
// Will (2026-11-26 16:17): the game should give him AWEF on his own
// machine without asking twice. A page cannot read a browser account
// or a machine name, so the mechanism is a stored preference —
// resolution order, tested here at the pure seam (scheme.js):
// stored nf.scheme > the v5 controls record's scheme > the coin
// flip, with the flip's result stored by the glue so it happens at
// most once per browser.
{
  const flipTo = (s) => () => s;
  const noFlip = () => { throw new Error("flip must not be called"); };

  check("scheme: the preference key is nf.scheme",
    SCHEME_PREF_KEY === "nf.scheme");
  check("scheme: stored 'awef' beats a WASD flip",
    resolveScheme({ pref: "awef", legacy: null, flip: flipTo("WASD") }).scheme === "AWEF");
  check("scheme: stored 'wasd' beats an AWEF flip",
    resolveScheme({ pref: "wasd", legacy: null, flip: flipTo("AWEF") }).scheme === "WASD");
  check("scheme: a stored preference never reaches the flip",
    resolveScheme({ pref: "awef", legacy: "WASD", flip: noFlip }).source === "pref");
  check("scheme: the stored preference beats the legacy record too",
    resolveScheme({ pref: "wasd", legacy: "AWEF", flip: noFlip }).scheme === "WASD");
  check("scheme: the legacy record carries a prior choice over the flip",
    resolveScheme({ pref: null, legacy: "AWEF", flip: noFlip }).scheme === "AWEF" &&
    resolveScheme({ pref: null, legacy: "AWEF", flip: noFlip }).source === "legacy");
  check("scheme: with nothing stored, the flip decides",
    resolveScheme({ pref: null, legacy: null, flip: flipTo("AWEF") }).scheme === "AWEF" &&
    resolveScheme({ pref: null, legacy: null, flip: flipTo("AWEF") }).source === "flip" &&
    resolveScheme({ pref: undefined, legacy: undefined, flip: flipTo("WASD") }).scheme === "WASD");
  check("scheme: a corrupt preference falls back to the legacy record",
    resolveScheme({ pref: "banana", legacy: "AWEF", flip: noFlip }).scheme === "AWEF");
  check("scheme: corrupt values everywhere fall back to the flip, never crash",
    resolveScheme({ pref: "banana", legacy: "sideways", flip: flipTo("WASD") }).scheme === "WASD" &&
    resolveScheme({ pref: 42, legacy: {}, flip: flipTo("AWEF") }).scheme === "AWEF" &&
    resolveScheme({ pref: { scheme: "awef" }, legacy: [], flip: flipTo("WASD") }).scheme === "WASD");
  check("scheme: a broken flip resolves to WASD rather than crashing",
    resolveScheme({ pref: null, legacy: null, flip: () => "diagonal" }).scheme === "WASD" &&
    resolveScheme({ pref: null, legacy: null, flip: null }).scheme === "WASD");
  check("scheme: pref parsing is exact about the two names",
    schemeFromPref("awef") === "AWEF" && schemeFromPref("wasd") === "WASD" &&
    schemeFromPref("AWEF") === "AWEF" && schemeFromPref("") === null &&
    schemeFromPref("awef2") === null && schemeFromPref(null) === null);
  check("scheme: legacy parsing accepts only the game-dress names",
    schemeFromLegacy("WASD") === "WASD" && schemeFromLegacy("AWEF") === "AWEF" &&
    schemeFromLegacy("wasd") === null && schemeFromLegacy(null) === null);
  check("scheme: the write-back value round-trips through the parser",
    schemeFromPref(prefForScheme("AWEF")) === "AWEF" &&
    schemeFromPref(prefForScheme("WASD")) === "WASD" &&
    prefForScheme("AWEF") === "awef" && prefForScheme("WASD") === "wasd");
  check("scheme: the toggle's other side is always the other scheme",
    otherScheme("WASD") === "AWEF" && otherScheme("AWEF") === "WASD" &&
    isScheme("WASD") && isScheme("AWEF") && !isScheme("wasd"));
  check("scheme: the N-03 variant follows the scheme when the build carries it",
    schemeBeatId("AWEF", () => true) === "N-03-AWEF" &&
    schemeBeatId("WASD", () => true) === "N-03-WASD");
  check("scheme: without a variant recording, the shared N-03 speaks",
    schemeBeatId("AWEF", () => false) === "N-03" &&
    schemeBeatId("WASD", () => false) === "N-03" &&
    schemeBeatId("AWEF", null) === "N-03");

  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  check("scheme: the preference resolution rides in the built file",
    html.includes('"nf.scheme"') && html.includes("resolveScheme") &&
    html.includes("readSchemePref"));
  check("scheme: the title panel carries the Controls toggle",
    html.includes('id="btn-scheme-splash"') && html.includes("Controls:"));
  check("scheme: both N-03 variants are embedded in the built file",
    html.includes('"N-03-WASD"') && html.includes('"N-03-AWEF"'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
