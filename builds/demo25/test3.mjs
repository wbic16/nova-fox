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
  gravityShiftLine, parseGravityScroll, latestGravityByRealm, gravityShiftAllowed,
  TRAIL_FLAVOR, trailWordsFrom, TrailFeed,
  inTheHall, foxVisionToggle, foxVisionReveals, FAMILIAR_RANGE_CELLS,
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
  FORM_LIMITS, FORM_EXAMPLES, FORM_EXAMPLE_MIXED,
  formByteLength, parseForm, formStanding, frameIndexAt, frameNeed,
  sanitizeSvg, svgNaturalSize,
  newFormState, loadFormState, applyForm, clearForm,
  formChartLine, formOffLine, parseFormChart,
  b64encodeUtf8, b64decodeUtf8,
} from "./forms.js";
import {
  IDEA_TITLE_MAX, IDEA_BODY_MAX, IDEA_LIMITS,
  validateIdea, makeIdeaId,
  serializeIdea, parseIdeaLine, serializeStatus, parseStatusLine,
  parseIdeas, parseIdeaScroll,
  ideaB64Encode, ideaB64Decode,
} from "./ideas.js";

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

// --- the loading trail (2026-11-26): the load panel's word trail -------------
// The trail consumes the words of the boot's real reads — mocked
// here as the gateway's select answers (board / purchase / ledger
// scroll text) plus inscription-log lines — and weaves flavor
// phrases through them. These checks pin the wiring contract: the
// words shown come from the read stream fed in, phrases interleave
// between read words, the feed drops rather than queues past its
// cap, and nothing player-facing ties the trail to its source.
{
  // A mocked read stream, in the shapes the gateway actually
  // answers: board rows, purchase claims, ledger lines, log lines.
  const mockReads = [
    "Zzqx|412|2026-11-26|1|1795720000000\nMiriam|388|2026-11-26|0|1795721000000",
    "claim Zzqx gumroad 1795720000000\nclaim Miriam gift 1795722000000",
    "gift-issued k7f2d9 Zzqx 100 1795723000000",
    "the chart — the world is loaded; the dark is counted, not empty",
    "Nova Prime 0,0 — a page of the chart opens (731 living cells)",
  ];
  const feed = new TrailFeed();
  for (const t of mockReads) feed.feedText(t);
  const shown = [];
  let tok;
  while ((tok = feed.next()) !== null) shown.push(tok);
  const flavorShown = shown.filter((t) => TRAIL_FLAVOR.includes(t));
  const wordsShown = shown.filter((t) => !TRAIL_FLAVOR.includes(t));
  check("trail: words shown come from the read stream fed in",
    wordsShown.includes("Zzqx") && wordsShown.includes("Miriam") &&
    wordsShown.includes("gumroad") && wordsShown.includes("chart") &&
    wordsShown.includes("living"),
    `shown: ${wordsShown.slice(0, 12).join(" ")}`);
  check("trail: nothing is shown that was never read or flavor",
    wordsShown.every((w) => trailWordsFrom(mockReads.join("\n")).includes(w)));
  check("trail: flavor phrases interleave the read words",
    flavorShown.length >= 2 &&
    shown.indexOf(flavorShown[0]) > 0 &&
    shown.indexOf(flavorShown[0]) < shown.length - 1,
    `flavor: ${flavorShown.join(" / ")}`);
  check("trail: Will's named phrases are in the flavor register",
    TRAIL_FLAVOR.includes("reticulating splines") &&
    TRAIL_FLAVOR.includes("charging batteries"));
  // The cap: a flood of reads drops words instead of queueing them.
  const flood = new TrailFeed(40);
  flood.feedText("word ".repeat(500));
  check("trail: the feed drops past its cap rather than queueing",
    flood.pending <= 40 && flood.dropped > 0 && flood.fed === 40,
    `pending ${flood.pending}, dropped ${flood.dropped}, fed ${flood.fed}`);
  // A stopped feed takes nothing in and shows nothing new.
  const stopped = new TrailFeed();
  stopped.stop();
  check("trail: a stopped feed stays silent",
    stopped.feedText("hello world") === 0 && stopped.next() === null);
  // The tokenizer: punctuation and lone characters fall away,
  // over-long tokens (hashes, keys) are clipped for display.
  check("trail: the tokenizer keeps words, drops noise, clips the long",
    JSON.stringify(trailWordsFrom("a bb, ccc! d | eeeeeeeeeeeeeeeeeeeeeeeeeeeeee")) ===
    JSON.stringify(["bb", "ccc", "eeeeeeeeeeeeeeeeeeeeeeee"]));
  // Never communicated: no flavor phrase names the source, and the
  // load panel's own markup carries no word for it either.
  check("trail: no flavor phrase names where the words come from",
    TRAIL_FLAVOR.every((p) => !/subspace/i.test(p)));
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const splash = html.slice(html.indexOf('<div id="splash">'),
    html.indexOf('<div id="stage">'));
  check("trail: the trail line rides in the built load panel",
    splash.includes('id="trail-line"') && html.includes("new TrailFeed()"));
  check("trail: the load panel never names the trail's source",
    !/subspace/i.test(splash));
  check("trail: the read taps ride in the built file (log + selects)",
    (html.match(/trailTap\(/g) || []).length >= 4 &&
    (html.match(/trail\.feedText\(/g) || []).length >= 2,
    `taps ${(html.match(/trailTap\(/g) || []).length}`);
}
// --- Fox Vision (demo11, Will 2026-11-26): the Hall sense -------------------
// Usable only inside The Unexpected Hall; night vision of all
// familiars within subspace range. The rules are world.js's; the
// view composes them (the e2e walks the composed behavior).
{
  // The Hall is a room, not a footprint: the hill above it shares
  // the footprint and is NOT inside.
  check("fox vision: the hall floor is inside the Hall",
    inTheHall(52.5, DUNGEON.floorY + 1.01, 35.5) === true);
  check("fox vision: the hill above the Hall is not inside it",
    inTheHall(52.5, heightAt("nova", 52, 35) + 1.01, 35.5) === false);
  check("fox vision: outside the footprint is outside at any depth",
    inTheHall(8.5, DUNGEON.floorY + 1.01, 8.5) === false);
  check("fox vision: the void below the world is not inside",
    inTheHall(52.5, -40, 35.5) === false);
  // The toggle: opens only inside; always closes.
  check("fox vision: the toggle opens inside the Hall",
    foxVisionToggle(false, true) === true);
  check("fox vision: the toggle cannot open outside the Hall",
    foxVisionToggle(false, false) === false);
  check("fox vision: the toggle always closes",
    foxVisionToggle(true, true) === false && foxVisionToggle(true, false) === false);
  // The reveal: range only, in every phase — the Keeper at its
  // home cell, seen from the deep room's door.
  const keeper = { alive: true, kind: "guardian", gx: DUNGEON.guardianCell.gx, gy: DUNGEON.guardianCell.gy, phase: 1 };
  check("fox vision: a familiar in range is revealed in a dark phase",
    foxVisionReveals(keeper, 26, 17) === true &&
    foxVisionReveals({ ...keeper, phase: 2 }, 26, 17) === true);
  check("fox vision: a familiar beyond subspace range stays dark",
    foxVisionReveals({ ...keeper, gx: 220, gy: 220 }, 26, 17) === false);
  check("fox vision: the dead are not revealed",
    foxVisionReveals({ ...keeper, alive: false }, 26, 17) === false);
  check("fox vision: its range is the world's haunt radius, one constant",
    FAMILIAR_RANGE_CELLS === 48);
  // The wiring rides in the built file: the key, the touch
  // button, and the view's one seen-word.
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  check("fox vision: the N key and the touch button ride in the built file",
    html.includes('case "KeyN": toggleFoxVision();') && html.includes('id="t-vision"'));
  check("fox vision: strike and contact read the same seen-word as the view",
    html.includes("!familiarSeen(m)") && html.includes("sub.monsterVisible(m) || visionReveals(m)"));
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

// --- gravity in subspace (demo10): the scroll is the realm's down ---------
// Will's ruling (2026-11-26): gravity is stored in subspace per
// realm — a real change — and one shift per player per realm per
// day. The mocked gateway below is a string with the gateway's two
// verbs (insert appends a line; select returns the scroll); the
// client flow under test is the game's own: judge the shift against
// the known records, append the record, read back, attune.
{
  const DAY = "2026-11-26", NEXT = "2026-11-27";
  // The record line round-trips through the parser untouched.
  const line = gravityShiftLine("ashfall", -1, "fox-one", DAY, 1795730000000);
  check("gravity: the shift line has the scroll's shape",
    line === "grav|ashfall|-1|fox-one|2026-11-26|1795730000000", line);
  const parsed = parseGravityScroll(line + "\n");
  check("gravity: a shift line parses back to its record",
    parsed.length === 1 && parsed[0].realmId === "ashfall" && parsed[0].dir === -1 &&
    parsed[0].player === "fox-one" && parsed[0].day === DAY && parsed[0].ts === 1795730000000);
  check("gravity: malformed lines are skipped, never misread",
    parseGravityScroll("grav|nova|2|fox|2026-11-26|1\ngrav|nova|1|fox|26-11-2026|1\n" +
      "board|nova|1|fox|2026-11-26|1\ngrav||1|fox|2026-11-26|1\n").length === 0 &&
    parseGravityScroll("").length === 0 && parseGravityScroll(null).length === 0);

  // The mocked gateway + the client flow, exactly as game3 runs it.
  const chart = { scroll: "" };
  const gwInsert = (l) => { chart.scroll += l + "\n"; };
  const gwSelect = () => parseGravityScroll(chart.scroll);
  const clientShift = (sub, realm, player, day, ts) => {
    const known = gwSelect();
    if (!gravityShiftAllowed(known, realm, player, day)) return "refused";
    const dir = sub.flipGravity(realm, 0, 0);
    gwInsert(gravityShiftLine(realm, dir, player, day, ts));
    return "shifted";
  };
  const clientAttune = (sub) => {
    for (const [realm, rec] of latestGravityByRealm(gwSelect()))
      sub.applyRealmGravity(realm, rec.dir);
  };

  const subG = new Subspace();
  check("gravity: a fresh realm's down is down",
    subG.gravityOf("ashfall", 0, 0) === 1);
  check("gravity: the first shift of the day is allowed and writes to the gateway",
    clientShift(subG, "ashfall", "fox-one", DAY, 1000) === "shifted" &&
    chart.scroll === "grav|ashfall|-1|fox-one|2026-11-26|1000\n", chart.scroll);
  check("gravity: a second same-day shift by the same player in the same realm is refused",
    clientShift(subG, "ashfall", "fox-one", DAY, 2000) === "refused" &&
    parseGravityScroll(chart.scroll).length === 1);
  check("gravity: another player may still shift the same realm the same day",
    clientShift(subG, "ashfall", "fox-two", DAY, 3000) === "shifted");
  check("gravity: the same player may shift a different realm the same day",
    clientShift(subG, "nova", "fox-one", DAY, 4000) === "shifted");
  check("gravity: the same player may shift the same realm on a different day",
    clientShift(subG, "ashfall", "fox-one", NEXT, 5000) === "shifted");

  // Read-back: a fresh view attunes to the scroll's word — the
  // latest record per realm is its down, realms independent.
  const subH = new Subspace();
  const ashScroll = subH.getScroll("ashfall", 3, 3); // born before the word arrives
  clientAttune(subH);
  check("gravity: read-back applies the stored orientation (latest record wins)",
    subH.gravityOf("ashfall", 0, 0) === -1 && subH.gravityOf("nova", 0, 0) === -1,
    `ashfall ${subH.gravityOf("ashfall", 0, 0)}, nova ${subH.gravityOf("nova", 0, 0)}`);
  check("gravity: a realm with no record keeps the default down",
    subH.gravityOf("orchid", 0, 0) === 1);
  check("gravity: attunement keeps the realm's existing scrolls in step",
    ashScroll.gravDir === -1);
  check("gravity: re-attuning to the same word reports no change",
    subH.applyRealmGravity("ashfall", -1) === false &&
    subH.applyRealmGravity("ashfall", 1) === true &&
    subH.gravityOf("ashfall", 0, 0) === 1);
  check("gravity: a local flip still turns the realm after attunement",
    subH.flipGravity("ashfall", 0, 0) === -1 && subH.gravityOf("ashfall", 5, 5) === -1);

  // The wooze (demo10): the degauss treatment rides the real
  // inversion only — sound synthesized, screen fuzzy, half speed
  // for five seconds — and a refused shift starts none of it.
  const builtHtml = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  check("gravity: the degauss treatment rides in the built game (veil + synthesized sound)",
    builtHtml.includes('id="degauss"') && builtHtml.includes("degauss()") &&
    builtHtml.includes("updateInvertFx(now)"));
  check("gravity: the inversion slows the player at half speed for five seconds",
    builtHtml.includes("INVERT_SLOW = 0.5") && builtHtml.includes("INVERT_FX_MS = 5000") &&
    builtHtml.includes("invertFxActive(performance.now()) ? INVERT_SLOW : 1"));
  check("gravity: a refused shift starts no wooze (the gate returns before the effect)",
    (() => {
      const i = builtHtml.indexOf("function flipGravityHere()");
      const seg = builtHtml.slice(i, i + 3000);
      return seg.indexOf("gravityShiftAllowed") >= 0 &&
        seg.indexOf("gravityShiftAllowed") < seg.indexOf("startInvertFx()") &&
        seg.indexOf("return;") < seg.indexOf("startInvertFx()");
    })());
}

// --- warp text (demo18): the inversion, announced -----------------------
// Will (2026-11-26): "GRAVITY INVERSION!!" as warp text on the
// announcement method — the intro card's presentation, the name at
// 2-4x, the text itself warped. It fires on experienced inversions
// (the fox's own shift; a read-back turn while standing in the
// realm), never on a refusal, never on realm entry.
{
  const builtHtml = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const cssRule = (sel) => {
    const i = builtHtml.indexOf(sel);
    return i < 0 ? "" : builtHtml.slice(i, builtHtml.indexOf("}", i));
  };
  check("warp: the announcement rides in the built game, exact words on the card",
    builtHtml.includes('id="warpcard"') &&
    builtHtml.includes('id="warp-name">GRAVITY INVERSION!!<'));
  check("warp: the name stands at 3x the announcement card's size (120px vs its 40px)",
    cssRule("#warp-name").includes("120px") && cssRule("#intro-name").includes("40px"));
  check("warp: the text itself warps (perspective swing + skew keyframes)",
    builtHtml.includes("@keyframes warpin") && builtHtml.includes("rotateX") &&
    builtHtml.includes("@keyframes warpname") && builtHtml.includes("skewX"));
  check("warp: it lands with the inversion and clears inside the wooze (2600ms of 5000)",
    builtHtml.includes("WARP_MS = 2600") && builtHtml.includes("INVERT_FX_MS = 5000"));
  check("warp: a refused shift announces nothing (the gate returns before the announcement)",
    (() => {
      const i = builtHtml.indexOf("function flipGravityHere()");
      const seg = builtHtml.slice(i, i + 3000);
      const gate = seg.indexOf("gravityShiftAllowed"), ret = seg.indexOf("return;", gate);
      const ann = seg.indexOf("showGravityWarp()");
      return gate >= 0 && ret > gate && ann > ret;
    })());
  check("warp: the fox's own inversion announces beside the wooze",
    (() => {
      const i = builtHtml.indexOf("function flipGravityHere()");
      const seg = builtHtml.slice(i, i + 3000);
      return seg.indexOf("startInvertFx()") >= 0 &&
        seg.indexOf("showGravityWarp()") > seg.indexOf("startInvertFx()");
    })());
  check("warp: a read-back turn announces from the reconcile seam, dwell-gated",
    (() => {
      const i = builtHtml.indexOf("function reconcileGravity()");
      const seg = builtHtml.slice(i, i + 1600);
      return seg.indexOf("applyRealmGravity") >= 0 &&
        seg.indexOf("warpAnnounceOk(performance.now())") >= 0 &&
        seg.indexOf("showGravityWarp()") > seg.indexOf("warpAnnounceOk(performance.now())");
    })());
  check("warp: entry stays quiet — entering a realm restarts the dwell",
    (() => {
      const i = builtHtml.indexOf("async function enterRealmGravity");
      return i >= 0 &&
        builtHtml.slice(i, i + 200).includes("state.realmSince = performance.now()");
    })());
  check("warp: Joy's flip beats are untouched by the announcement layer",
    builtHtml.includes('playBeat(dir > 0 ? "BEAT-flip-down" : "BEAT-flip-up")'));
}
// --- player forms (demo6): the phext a fox wears ------------------------------
// Will's ruling (2026-11-26): a form is a small phext — frames as
// scrolls in one coordinate neighborhood — inside 4 KB and a
// player-sized box, with the leeway Will asked for built as
// parameters: warn at the ruled lines, refuse only at the
// shipped experimental ceilings. Form SVG is picture, never
// program: the sanitizer tests below are the no-script rule.
{
  const L = FORM_LIMITS;
  const padFormTo = (target) => {
    const mk = (pad) => [
      "1.1.1/1.1.1/1.1.1", "name: Pad", "step: 240", "",
      "1.1.1/1.1.1/1.1.2", "type: svg",
      `<svg viewBox="0 0 120 360" xmlns="http://www.w3.org/2000/svg"><!--${"x".repeat(pad)}--><rect x="10" y="10" width="20" height="20" fill="#fff"/></svg>`,
    ].join("\n");
    return mk(target - formByteLength(mk(0)));
  };
  // the cap counts bytes of phext, not characters
  check("form: the byte meter counts UTF-8 bytes, not characters",
    formByteLength("fox") === 3 && formByteLength("f🦊x") === 6);
  check("form: a form at exactly the ruled 4 KB stands at the baseline",
    formStanding(padFormTo(L.capBaselineBytes)).cap === "baseline");
  check("form: past 4 KB but under the ceiling stands in the leeway, not refused",
    (() => { const s = formStanding(padFormTo(L.capBaselineBytes + 100));
      return s.cap === "leeway" && !s.refused && s.leeway; })());
  check("form: past the ceiling is refused — the loader's hard stop",
    formStanding(padFormTo(L.capCeilingBytes + 1)).refused === true);
  check("form: applyForm refuses an over-ceiling form and names the cap",
    (() => { const st = newFormState();
      const r = applyForm(st, padFormTo(L.capCeilingBytes + 1), 1);
      return !r.ok && r.reason === "cap" && st.text === null; })());
  check("form: the loader drops an over-ceiling form from a save, silently whole",
    loadFormState({ text: padFormTo(L.capCeilingBytes + 1) }).text === null);
  // parsing: coordinates, order, the neighborhood
  const shuffled = [
    "1.1.1/1.1.1/1.1.1", "name: Order", "step: 100", "",
    "1.1.1/1.1.1/1.1.4", "type: shapes", "circle 60 60 20 6", "",
    "1.1.1/1.1.1/1.1.2", "type: shapes", "circle 60 60 10 6",
  ].join("\n");
  check("form: frames step in coordinate order, not in writing order",
    (() => { const p = parseForm(shuffled);
      return p.ok && p.frames.length === 2 &&
        p.frames[0].coord === "1.1.1/1.1.1/1.1.2" && p.frames[1].coord === "1.1.1/1.1.1/1.1.4"; })());
  check("form: the head's name and step are read, the step clamped to its range",
    (() => { const p = parseForm(shuffled.replace("step: 100", "step: 99999"));
      return p.name === "Order" && p.stepMs === L.stepMaxMs; })());
  const stray = shuffled + "\n\n9.9.9/9.9.9/9.9.9\ntype: shapes\ncircle 1 1 1 1\n";
  check("form: a scroll outside the neighborhood is set aside with a warning, bytes still counted",
    (() => { const p = parseForm(stray);
      return p.ok && p.frames.length === 2 && p.stray === 1 && p.warnings.length === 1; })());
  check("form: no head scroll is a named parse failure",
    !parseForm("1.1.1/1.1.1/1.1.2\ntype: shapes\ncircle 1 1 1 1\n").ok);
  check("form: a form with no frames is a named parse failure",
    !parseForm("1.1.1/1.1.1/1.1.1\nname: Bare\n").ok);
  check("form: a frame that doesn't declare its type is a named parse failure",
    (() => { const p = parseForm("1.1.1/1.1.1/1.1.1\nname: X\n\n1.1.1/1.1.1/1.1.2\ncircle 1 1 1 1\n");
      return !p.ok && p.errors.some((e) => e.includes("type")); })());
  check("form: an unknown template type is refused, never guessed at",
    !parseForm("1.1.1/1.1.1/1.1.1\nname: X\n\n1.1.1/1.1.1/1.1.2\ntype: hologram\nboo\n").ok);
  check("form: empty text is no form at all",
    !parseForm("").ok && !parseForm("   \n").ok && !parseForm("hello").ok);
  // fit: a property of the render, per frame
  const svgFormOf = (vb) => [
    "1.1.1/1.1.1/1.1.1", "name: Fit", "",
    "1.1.1/1.1.1/1.1.2", "type: svg",
    `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="#fff"/></svg>`,
  ].join("\n");
  check("form: an svg frame drawn at the box fits the baseline exactly",
    (() => { const s = formStanding(svgFormOf("0 0 120 360"));
      return !s.refused && !s.leeway && frameNeed(s.parsed.frames[0]) === 1; })());
  check("form: an svg frame past the box but inside the leeway wears a warning, not a refusal",
    (() => { const s = formStanding(svgFormOf("0 0 150 360"));
      return !s.refused && s.leeway && !s.fit.frames[0].fitsBaseline && s.fit.frames[0].fitsCeiling; })());
  check("form: an oversize svg frame is refused at the leeway's edge",
    (() => { const s = formStanding(svgFormOf("0 0 240 360"));
      const st = newFormState(); const r = applyForm(st, svgFormOf("0 0 240 360"), 1);
      return s.refused && !r.ok && r.reason === "fit" && st.text === null; })());
  check("form: the loader drops an unfit form from a save",
    loadFormState({ text: svgFormOf("0 0 240 360") }).text === null);
  // the sanitizer: picture, never program
  const evil = `<svg viewBox="0 0 120 360" onload="steal()"><script>steal()</` + `script>` +
    `<circle r="5" onclick="steal()"/><a href="javascript:steal()"><rect width="9" height="9"/></a>` +
    `<use href="https://elsewhere.example/x.svg#p"/><use href="#local"/><foreignObject><body>hi</body></foreignObject></svg>`;
  check("form: a script-bearing svg is neutralized — no script, no handlers, no doors",
    (() => { const s = sanitizeSvg(evil);
      return !/<script/i.test(s) && !/onload|onclick/i.test(s) &&
        !/javascript:/i.test(s) && !/elsewhere\.example/.test(s) &&
        !/foreignObject/i.test(s) && s.includes('href="#local"') && s.includes("<circle"); })());
  check("form: a sanitized script-bearing svg still parses and fits as a picture",
    (() => { const text = ["1.1.1/1.1.1/1.1.1", "name: Evil", "",
        "1.1.1/1.1.1/1.1.2", "type: svg", evil].join("\n");
      const p = parseForm(text);
      return p.ok && !/<script/i.test(p.frames[0].svg); })());
  check("form: svg natural size reads width/height, else the viewBox, else the box",
    svgNaturalSize('<svg width="40" height="90"></svg>').w === 40 &&
    svgNaturalSize('<svg viewBox="0 0 24 48"></svg>').h === 48 &&
    svgNaturalSize("<svg></svg>").w === L.boxW);
  // per type: renders (compiles), fits, oversize refused
  for (const [kind, text] of Object.entries(FORM_EXAMPLES)) {
    const p = parseForm(text);
    check(`form/${kind}: the worked example parses with frames of its type`,
      p.ok && p.frames.length >= 2 && p.frames.every((f) => f.type === kind));
    check(`form/${kind}: the worked example fits inside the ruled lines`,
      (() => { const s = formStanding(text); return !s.refused && !s.leeway; })());
  }
  check("form/bitmap: a grid wider than the leeway is refused on fit, not on bytes",
    (() => { const wide = ["1.1.1/1.1.1/1.1.1", "name: Wide", "",
        "1.1.1/1.1.1/1.1.2", "type: bitmap", "3".repeat(24)].join("\n");
      return formStanding(wide).refused; })());
  check("form/bitmap: a row with a mark outside the palette is a named failure",
    !parseForm(["1.1.1/1.1.1/1.1.1", "name: B", "",
      "1.1.1/1.1.1/1.1.2", "type: bitmap", "33z33"].join("\n")).ok);
  check("form/turtle: an unknown command is a named failure, not a silent skip",
    !parseForm(["1.1.1/1.1.1/1.1.1", "name: T", "",
      "1.1.1/1.1.1/1.1.2", "type: turtle", "TELEPORT 9"].join("\n")).ok);
  check("form/turtle: a long walk that leaves the box is refused on fit",
    (() => { const far = ["1.1.1/1.1.1/1.1.1", "name: Far", "",
        "1.1.1/1.1.1/1.1.2", "type: turtle", "F 900"].join("\n");
      return formStanding(far).refused; })());
  check("form/shapes: a shape with no color is a named failure",
    !parseForm(["1.1.1/1.1.1/1.1.1", "name: S", "",
      "1.1.1/1.1.1/1.1.2", "type: shapes", "circle 60 60 20"].join("\n")).ok);
  check("form: a head palette override recolors the palette the bitmap draws with",
    (() => { const p = parseForm(["1.1.1/1.1.1/1.1.1", "name: P",
        "palette: 6=#123456", "", "1.1.1/1.1.1/1.1.2", "type: bitmap", "6"].join("\n"));
      return p.ok && p.palette[6] === "#123456"; })());
  // mixed types walk as one animation
  check("form: a mixed form (svg + bitmap + turtle) parses as one form",
    (() => { const p = parseForm(FORM_EXAMPLE_MIXED);
      return p.ok && p.frames.map((f) => f.type).join(",") === "svg,bitmap,turtle"; })());
  check("form: the animation steps through the mixed frames in order and loops",
    (() => { const p = parseForm(FORM_EXAMPLE_MIXED);
      return [0, 250, 500, 750, 1000].map((t) => frameIndexAt(p, t)).join(",") === "0,1,2,0,1"; })());
  // apply / persist round-trip
  check("form: apply then load round-trips the worn phext exactly",
    (() => { const st = newFormState();
      const r = applyForm(st, FORM_EXAMPLES.bitmap, 42);
      const back = loadFormState(JSON.parse(JSON.stringify(st)));
      return r.ok && back.text === FORM_EXAMPLES.bitmap && back.appliedAt === 42; })());
  check("form: malformed phext never applies and the state stays clean",
    (() => { const st = newFormState();
      const r = applyForm(st, "not a form at all", 1);
      return !r.ok && r.reason === "parse" && st.text === null; })());
  check("form: taking a form off clears the state whole",
    (() => { const st = newFormState();
      applyForm(st, FORM_EXAMPLES.svg, 7); clearForm(st);
      return st.text === null && st.appliedAt === 0; })());
  // the chart: a form is a fox's public shape
  check("form: the chart line round-trips through the base64 of the phext",
    b64decodeUtf8(b64encodeUtf8(FORM_EXAMPLES.turtle)) === FORM_EXAMPLES.turtle);
  check("form: the chart's latest wearing wins, and formoff takes it off",
    (() => { const chart = [formChartLine("Vex", FORM_EXAMPLES.bitmap, 10),
        formChartLine("Vex", FORM_EXAMPLES.svg, 20)].join("\n");
      const m1 = parseFormChart(chart);
      const m2 = parseFormChart(chart + "\n" + formOffLine("Vex", 30));
      return m1.get("Vex").text === FORM_EXAMPLES.svg && m2.get("Vex").text === null; })());
  check("form: an over-ceiling form arriving over the chart is marked refused, never worn",
    (() => { const chart = formChartLine("Big", padFormTo(L.capCeilingBytes + 5), 10);
      const e = parseFormChart(chart).get("Big");
      return e && e.refused === true; })());
  check("form: an unfit form arriving over the chart is marked refused, never worn",
    (() => { const chart = formChartLine("Wide", svgFormOf("0 0 999 360"), 10);
      const e = parseFormChart(chart).get("Wide");
      return e && e.refused === true; })());
}
// --- the strike hint (2026-11-26) -------------------------------------------
// While the encounter with the Shadow lasts, the strike binding
// stands bulging at the view's edge. The label is a pure function
// of the assignment — extracted from the game source and held to
// account here — and the page ships the cap empty: no glyph is
// lettered by hand anywhere.
{
  const game = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("./page3.html", import.meta.url), "utf8");
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const fnSrc = game.match(/function strikeBindingLabel\(scheme, touch\) \{[\s\S]*?\n\}/);
  check("strike hint: the binding label is a pure function of the assignment", !!fnSrc);
  const label = fnSrc ? eval(`(${fnSrc[0]})`) : () => null;
  check("strike hint: WASD assigns the strike to F",
    label("WASD", false) === "F");
  check("strike hint: AWEF assigns the strike to the click (F walks backward)",
    label("AWEF", false) === "CLICK");
  check("strike hint: touch assigns the strike to the strike button",
    label("WASD", true) === "STRIKE" && label("AWEF", true) === "STRIKE");
  check("strike hint: the cap rides in the built file, in the HUD's dress, and bulges",
    html.includes('id="striker"') && html.includes("#striker-cap {") &&
    html.includes("@keyframes strikerbulge"));
  check("strike hint: the page ships the cap empty — the glyph comes from the assignment",
    page.includes('<div id="striker-cap"></div>'));
  check("strike hint: the encounter latches at the guardian's touch and is kept per frame",
    game.includes('if (m.kind === "guardian") setGuardianEncounter(true);') &&
    game.includes("updateGuardianEncounter();") &&
    game.includes("GUARDIAN_LEASH"));
}

// --- player ideas (demo8): the telling door's chart lines ----------------------
// The door's line format (EE 953 design): IDEA and STATUS lines on
// one append-only scroll, title/body base64-UTF-8 so player text
// can hold anything, status resolved latest-wins with the shipped
// state carrying its ship EE, and caps refused — never truncated.
{
  // serialize/parse round-trip, incl. unicode + pipes + newlines
  const idea = {
    id: "mtk7x9ab12", name: "fox-1234", ts: 1795400000000,
    title: "a bridge of bells | over the dark",
    body: "line one\nline two | with a pipe\nand a fox 🦊 and café accents — ünïcode",
  };
  const line = serializeIdea(idea);
  check("idea: a telling serializes to one line, however wild its text",
    typeof line === "string" && !line.includes("\n") && line.startsWith("IDEA|v1|"));
  const back = parseIdeaLine(line);
  check("idea: serialize/parse round-trips unicode, pipes, and newlines exactly",
    back !== null && back.id === idea.id && back.name === idea.name && back.ts === idea.ts &&
    back.title === idea.title && back.body === idea.body);
  check("idea: the base64 helpers round-trip on their own",
    ideaB64Decode(ideaB64Encode("🦊|✓\n")) === "🦊|✓\n");
  check("idea: garbage lines parse to nothing, never to a telling",
    parseIdeaLine("IDEA|v0|x") === null && parseIdeaLine("hello") === null &&
    parseIdeaLine("") === null && parseStatusLine("STATUS|v1|x|bogus|1|-") === null);
  // ids: submit-ts base36 + 4 random base36 chars, randomness passed in
  check("idea: an id is the submit time in base36 plus 4 rolled chars",
    makeIdeaId(1795400000000, () => 0) === (1795400000000).toString(36) + "0000" &&
    makeIdeaId(1795400000000, () => 0.999) === (1795400000000).toString(36) + "zzzz" &&
    makeIdeaId(123, "wxyz") === (123).toString(36) + "wxyz");
  check("idea: different rolls give different ids for the same moment",
    makeIdeaId(999, () => 0) !== makeIdeaId(999, () => 0.5));
  // status resolution: latest STATUS wins; shipped carries its EE
  const scroll = [
    serializeIdea({ id: "a1", name: "fox-a", ts: 100, title: "first", body: "body one" }),
    serializeIdea({ id: "b2", name: "fox-b", ts: 200, title: "second", body: "body two" }),
    serializeStatus({ ideaId: "a1", status: "picked", ts: 300 }),
    serializeStatus({ ideaId: "a1", status: "shipped", ts: 400, shipEE: 953 }),
    serializeStatus({ ideaId: "b2", status: "picked", ts: 350 }),
    serializeStatus({ ideaId: "b2", status: "submitted", ts: 360 }),
    "a line that is neither kind",
  ].join("\n");
  const rows = parseIdeas(scroll);
  check("idea: the scroll resolves both tellings, in arrival order",
    rows.length === 2 && rows[0].id === "a1" && rows[1].id === "b2");
  check("idea: the latest STATUS wins — a1 was picked, then shipped",
    rows[0].status === "shipped" && rows[0].statusTs === 400);
  check("idea: a shipped telling carries its ship EE",
    rows[0].shipEE === 953);
  check("idea: the latest STATUS wins even when it steps back — b2 is told again",
    rows[1].status === "submitted" && rows[1].shipEE === null);
  check("idea: a telling with no STATUS stands as told (submitted)",
    (() => { const r = parseIdeaScroll(serializeIdea(
      { id: "c3", name: "fox-c", ts: 5, title: "t", body: "b" }));
      return r.length === 1 && r[0].status === "submitted" && r[0].shipEE === null; })());
  check("idea: a STATUS for an unknown id invents no telling",
    parseIdeas(serializeStatus({ ideaId: "zz", status: "picked", ts: 1 })).length === 0);
  check("idea: the first IDEA line for an id is the idea; a second is ignored",
    (() => { const two = [
        serializeIdea({ id: "d4", name: "fox-d", ts: 1, title: "kept", body: "b" }),
        serializeIdea({ id: "d4", name: "fox-e", ts: 2, title: "dropped", body: "b" }),
      ].join("\n");
      const r = parseIdeas(two);
      return r.length === 1 && r[0].title === "kept"; })());
  check("idea: a shipped STATUS without its EE cannot be written",
    serializeStatus({ ideaId: "a1", status: "shipped", ts: 1 }) === null &&
    parseStatusLine(serializeStatus({ ideaId: "a1", status: "picked", ts: 1 })).shipEE === null);
  // caps: refused past the cap, never truncated silently
  check("idea: the caps are the design's — title 80, body 1000",
    IDEA_TITLE_MAX === 80 && IDEA_BODY_MAX === 1000 &&
    IDEA_LIMITS.titleMax === 80 && IDEA_LIMITS.bodyMax === 1000);
  check("idea: a telling at exactly the caps is accepted whole",
    (() => { const t = "t".repeat(IDEA_TITLE_MAX), b = "b".repeat(IDEA_BODY_MAX);
      const l = serializeIdea({ id: "e5", name: "fox-e", ts: 1, title: t, body: b });
      const r = l && parseIdeaLine(l);
      return !!r && r.title === t && r.body === b; })());
  check("idea: one letter past the title cap is refused, not truncated",
    serializeIdea({ id: "e5", name: "fox-e", ts: 1,
      title: "t".repeat(IDEA_TITLE_MAX + 1), body: "b" }) === null &&
    validateIdea("t".repeat(IDEA_TITLE_MAX + 1), "b").reason === "title-cap");
  check("idea: one letter past the body cap is refused, not truncated",
    serializeIdea({ id: "e5", name: "fox-e", ts: 1,
      title: "t", body: "b".repeat(IDEA_BODY_MAX + 1) }) === null &&
    validateIdea("t", "b".repeat(IDEA_BODY_MAX + 1)).reason === "body-cap");
  check("idea: an empty title or telling is refused, plainly",
    validateIdea("", "b").reason === "title-empty" &&
    validateIdea("t", "  ").reason === "body-empty" &&
    serializeIdea({ id: "e5", name: "fox-e", ts: 1, title: "", body: "b" }) === null);
  check("idea: the cap counts letters, not bytes — a wide alphabet pays fairly",
    validateIdea("🦊".repeat(IDEA_TITLE_MAX), "b").ok === true &&
    validateIdea("🦊".repeat(IDEA_TITLE_MAX + 1), "b").ok === false);
  // the queue line IS the chart line (demo14, BUILD return): the
  // one line a submit queues is exactly what a later read-back
  // resolves — one line in, one telling out, standing as told.
  check("idea: one queued line resolves to exactly one read-back telling",
    (() => { const l = serializeIdea(
        { id: "f6", name: "fox-f", ts: 7, title: "queued", body: "waiting" });
      const r = parseIdeas(l);
      return r.length === 1 && r[0].id === "f6" &&
        r[0].title === "queued" && r[0].status === "submitted"; })());
  check("idea: an empty chart reads back as no tellings — the honest empty state",
    parseIdeas("").length === 0 && parseIdeas("\n\n").length === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
