// Nova Fox demo3 — headless playtest of the world module.
// Run: node test2.mjs   (uses the real nova_core.wasm from v1's core)
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  Subspace, genChunk, chunkBlock, baseBlockAt, heightAt, chordTarget,
  kernels, hashStringJS, genFoamJS, lifeStepJS,
  BLOCK, CHUNK, WORLD_H, LIFE_N, CEIL_Y, DUNGEON, BRIDGE_CHORD,
  ITEM_DEFS, computeScore, totalScore, dailyPocket, checkDaily,
  BRUSHES, brushBlocks,
  REALMS, REALM_PALETTES, HOME_PALETTE, paletteFor,
  REALM_TERRAIN, deltaRiver, ITEM_SPOTS, ARRIVAL,
  realmCoord, subspaceDelta, subspaceDistance, riftRingGeometry,
  gravityShiftLine, parseGravityScroll, latestGravityByRealm, gravityShiftAllowed, gravityCorrection, GRAVITY_CORRECTION_MS,
  TUNNEL_LEN, tunnelBlockFor, tunnelEndAt, makeTunnel, tunnelLine, tunnelRetireLine,
  parseTunnelScroll, resolveTunnels, tunnelKey, tunnelBlockAt, tunnelProgress, tunnelServes, tunnelServesLink,
  geometryLine, parseGeometryScroll, resolveGeometry, geoEditRefusal,
  SHAPE_STRIKE_CD_MS, SHAPE_STRIKE_WINDOW_MS, SHAPE_STRIKE_WINDOW_MAX, shapeStrikeAllowed,
  FEINT_GRAV_SCALE, FEINT_BIAS, feintAccel,
  SNARE_TICKS, SNARE_FACTOR, snareStepSplit, snaredSteps,
  chiselYield,
  REALM_GEN, realmGenParams, realmGenKey, realmGenLine, parseRealmGenScroll,
  resolveRealmGen, realmGenAgrees, strataBand, hallPathWear, patchField,
  clusterField, realmFingerprint, realmRouteCheck,
  AGGRO_TICKS, TRAVERSAL_GROWTH_FLOOR, TRAVERSAL_CELLS,
  SEARCH_TICKS, PACK_SHARE_CELLS, RISE_MIN_CELLS, REALM_SURFACE_CAP,
  guardianPhase, guardianStrikeDamage,
  TRAIL_FLAVOR, trailWordsFrom, TrailFeed,
  inTheHall, foxVisionToggle, foxVisionReveals, FAMILIAR_RANGE_CELLS,
  PHEXT_LEVEL_BYTES, phextImplode, worldToPhext,
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
  GEAR_TIERS, TIER_MARKER_SHAPES, gearTier, tierMarkerSVG, tierMarkersForScope, rungTierMarkers, bandTierMarkers,
  MATERIAL_DEFS, materialDef, materialCount, addMaterial, heldMaterials, sellMaterial,
  flightUnlocked,
  ladderLampBonuses,
} from "./economy.js";
import {
  SOLVER_CLASS, SOLVER_RATES, SOLVER_GOVERNOR, solverCompute, solverFoamGrid,
  solverSeedString, solverUnitId, solverUnitNumber, solverIsCanary,
  solverSeedUnitFor, solverInputHash, solverClaimHash, solverClaimLine,
  solverResultLine, solverCreditLine, parseSolverScroll, resolveSolver,
  solverCreditExists, solverDayKey, solverFirstDay, solverCapTwelfths,
  solverStanding, solverGrantTwelfths, solverGrantFor, nextSolverUnit,
  applySolverTwelfths, buildSolverWorkerSource, solverLifeStep,
} from "./solver.js";
import {
  FORM_LIMITS, FORM_EXAMPLES, FORM_EXAMPLE_MIXED,
  formByteLength, parseForm, formStanding, frameIndexAt, frameNeed,
  sanitizeSvg, svgNaturalSize, svgContentBounds,
  newFormState, loadFormState, applyForm, clearForm,
  formChartLine, formOffLine, parseFormChart,
  b64encodeUtf8, b64decodeUtf8,
} from "./forms.js";
import {
  RUN_KIND, RUN_SPLITS, RUN_FINISH_BEAT, splitForBeat, deepStoneNear,
  formatRunTime, newRunRecording, recEvent, verifyRecording,
  serializeRecording, parseRecording, telemetryMessage,
} from "./speedrun.js";
import {
  BANTER_LINES, BANTER_BY_N, BANTER_TUNABLES,
  createBanter, banterEvent, banterSnapshot,
} from "./banter.js";
import {
  SCHEME_PREF_KEY, schemeFromPref, schemeFromLegacy, isScheme,
  otherScheme, prefForScheme, resolveScheme, schemeBeatId,
} from "./scheme.js";
import {
  GRAV_BASE, TERM_BASE, FREQ_RIPPLE, FREE_MAG, FREE_FREQ, WRITE_GAP_MS,
  SOS_PATTERN, HOME_REALM, HOME_ARRIVAL, MAG_STOPS, FREQ_STOPS, DIAL_REALMS,
  MORSE, MORSE_ORDER, MORSE_COUNT, MORSE_LS_KEY, DIAL_LS_KEY,
  encodeMorse, encodeCoord, decodeMorse, isSos, classifyTap, applyTap,
  interpretLock, clampStop, dialRangeUnlocked, proposeDial, gravityStep,
  dialLine, parseDialScroll, latestDialByPlayerRealm, writeGapOpen,
  dailyShiftOpen, shiftGate, newDialInstrument, saveDialInstrument,
  loadDialInstrument, rememberDial, dialReading, applyDialRecords,
  PENTA_STEPS, midiToHz, symbolPitch, dialPitch, coordPitch, tapPitch,
  tonePartials, confirmChord, sosCadence, spectrumColor,
  LEITNER_INTERVALS_MS, newMorseDeck, reviewCard, dueCard, introduceNext,
  sosReady, saveMorseDeck, loadMorseDeck, morseChart, joyMorseCue, cardBySymbol,
} from "./gdial.js";
import {
  IDEA_TITLE_MAX, IDEA_BODY_MAX, IDEA_LIMITS,
  validateIdea, makeIdeaId,
  serializeIdea, parseIdeaLine, serializeStatus, parseStatusLine,
  parseIdeas, parseIdeaScroll, roadmapSplit,
  ROADMAP_UPCOMING_MAX, ROADMAP_SHIPPED_MAX,
  ideaB64Encode, ideaB64Decode,
} from "./ideas.js";
import {
  SHIPLOG_MAX, shipLogRows, shipLogHeadline, shipLogLine,
} from "./shiplog.js";
import {
  WIKI_FEEDBACK_URL, feedbackUrl,
} from "./feedback.js";

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
  check("EE 1034: a surface thing holds through one strike (hp 2)",
    s.strikeMonster(m) === false && m.alive);
  check("the second strike edits a surface thing out", s.strikeMonster(m) === true && !m.alive);
  check("scar override recorded", s.getOverride("nova", bx, by, bz) === BLOCK.SCAR);
  const chunk = genChunk(s, "nova", 1, 1);
  check("scar is in the regenerated chunk",
    chunkBlock(chunk, bx - 16, by, bz - 16) === BLOCK.SCAR);
  const g = s.spawnMonster("nova", 27, 19, "guardian");
  // EE 1037 (item 3): the Shadow's heart is deep — six strikes of
  // raw subspace damage (the view's gate is a separate pin, below).
  check("guardian holds through five strikes",
    s.strikeMonster(g) === false && s.strikeMonster(g) === false &&
    s.strikeMonster(g) === false && s.strikeMonster(g) === false &&
    s.strikeMonster(g) === false && g.alive);
  check("guardian falls to the sixth", s.strikeMonster(g) === true && !g.alive);
}

// --- EE 1037 (item 3): the Shadow's gate and phases -------------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  s.monsters.length = 0;
  const g = s.spawnMonster("nova", 27, 19, "guardian");
  check("the Shadow wakes with 6 hp and a shuttered heart (gate 0)",
    g.hp === 6 && guardianStrikeDamage(g, { damage: 1, charged: false }) === 0);
  check("a charged blow cracks the shutter for exactly 1",
    guardianStrikeDamage(g, { damage: 2, charged: true }) === 1);
  check("phases follow the heart's depth (6/4/2)",
    guardianPhase(g) === 1 && (g.hp = 4, guardianPhase(g) === 2) &&
    (g.hp = 2, guardianPhase(g) === 3) && (g.hp = 6, guardianPhase(g) === 1));
  g.boss = { state: "exposed", ticksLeft: 3, slamTick: 0, slamCell: null,
             rushDir: null, afterRush: false, engaged: true };
  check("in the exposure the gate pays the damage, +1 charged",
    guardianStrikeDamage(g, { damage: 1, charged: false }) === 1 &&
    guardianStrikeDamage(g, { damage: 1, charged: true }) === 2 &&
    guardianStrikeDamage(g, { damage: 2, charged: false }) === 2);
  const m = s.spawnMonster("nova", 10, 10, "surface");
  check("the gate is the guardian's alone (others take the damage)",
    guardianStrikeDamage(m, { damage: 2, charged: false }) === 2 &&
    guardianPhase(m) === 0);
}

// --- EE 1037 (item 3): the Shadow's state machine, ticked -------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  s.monsters.length = 0;
  const g = s.spawnMonster("nova", 27, 19, "guardian");
  const far = { realmId: "nova", bx: 10, bz: 10 }; // cell (5,5): far off
  s.tick(far); s.tick(far);
  check("unwoken, the Shadow keeps its post",
    g.boss && g.boss.state === "guard" && g.gx === 27 && g.gy === 19,
    `state=${g.boss && g.boss.state} at ${g.gx},${g.gy}`);
  // The fox steps to the next cell: the fight must come — stalk,
  // the telegraph, the fall, the exposure — in that order.
  const near = { realmId: "nova", bx: 26 * 2 + 1, bz: 19 * 2 + 1 };
  const seen = [];
  for (let i = 0; i < 10 && !(g.boss && g.boss.slamTick > 0); i++) {
    s.tick(near);
    if (g.boss) seen.push(g.boss.state);
  }
  check("the Shadow wakes and stalks when the fox closes",
    seen.includes("stalk") || seen.includes("telegraph"), `seen=${seen.join(",")}`);
  check("the telegraph precedes the fall (never a slam from nowhere)",
    seen.includes("telegraph") && g.boss.slamTick > 0, `seen=${seen.join(",")}`);
  for (let i = 0; i < 3 && g.boss.state !== "exposed"; i++) s.tick(near);
  check("the fall leaves the Heart exposed",
    g.boss.state === "exposed", `state=${g.boss.state}`);
  check("the slam marks the Shadow's own ground, beside the fox it read",
    g.boss.slamCell && Math.abs(g.boss.slamCell.gx - 26) <= 1 &&
    Math.abs(g.boss.slamCell.gy - 19) <= 1,
    `slamCell=${JSON.stringify(g.boss.slamCell)}`);
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
  check("nova home scroll places sword + lance + bright + ward",
    JSON.stringify(kinds) === JSON.stringify(["bright", "lance", "sword", "ward"]), kinds.join(","));
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
  check("EE 1023: a single stroke carves through", r1.ok && r1.broke && r1.level === 3);
  check("EE 1023: no degree is left behind", s.chiselLevel("nova", x, y, z) === 0);
  check("the break is an AIR inscription", s.getOverride("nova", x, y, z) === BLOCK.AIR);
  const chunk = genChunk(s, "nova", 1, 1);
  check("the broken block is air in the regenerated chunk",
    chunkBlock(chunk, x - 16, y, z - 16) === BLOCK.AIR);
  check("the bedrock refuses the chisel", s.chiselBlock("nova", x, 0, z).ok === false);
  check("the break is in the log",
    s.wal.some((w) => w.op === "break"));
}

// --- scoring: the board counts what the log can prove -----------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  check("a fresh world scores 0", totalScore(s) === 0);
  s.pickupItem("lance");
  check("a pickup scores 40", totalScore(s) === 40);
  const m = s.spawnMonster("nova", 12, 12, "surface");
  s.strikeMonster(m); s.strikeMonster(m); // EE 1034: surface hp 2
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
  s3.strikeMonster(m3); s3.strikeMonster(m3); // EE 1034: surface hp 2
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
  s.strikeMonster(d); s.strikeMonster(d); // EE 1034: surface hp 2
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
  s.chiselBlock("nova", x, y, z); // EE 1023: one stroke breaks it through
  check("a broken-through block refuses as already gone",
    s.chiselBlock("nova", x, y, z).reason === "gone");
}

// --- EE 1023 (item 2): banter cadence — more frequent random dialogue -------
{
  check("EE 1023: banter global gap is 20 s (was 45 s)",
    BANTER_TUNABLES.globalGapMs === 20000);
  check("EE 1023: banter group gap is 40 s (was 90 s)",
    BANTER_TUNABLES.groupGapMs === 40000);
  check("EE 1023: banter opening grace is 12 s (was 20 s)",
    BANTER_TUNABLES.startGraceMs === 12000);
}

// --- EE 1023 (item 3): a struck thing aggroes --------------------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0); s.getScroll("nova", 1, 0); s.getScroll("nova", 2, 0);
  s.monsters.length = 0;
  const m = s.spawnMonster("nova", 70, 12, "surface");
  m.hp = 3; // a tough hide, so the thing lives to hold a grudge
  check("the strike lands and the thing holds", s.strikeMonster(m) === false && m.alive);
  check("EE 1023: being struck aggroes it", m.aggro === true && m.aggroTicks === AGGRO_TICKS);
  check("EE 1023: aggro engages it (phase pinned, present)", m.engaged === true && m.phase === 0);
  const player = { realmId: "nova", bx: 25, bz: 25, pace: 0 }; // cell (12,12): 58 cells west — outside the haunt
  const gx0 = m.gx;
  s.tick(player);
  check("EE 1023: an aggroed thing hunts from beyond its haunt", m.gx < gx0, `gx ${gx0} -> ${m.gx}`);
  m.aggroTicks = 2;
  s.tick(player); s.tick(player);
  check("EE 1023: the grudge cools", m.aggro === false);
  const w = s.spawnMonster("nova", 9, 6, "wisp");
  s.strikeMonster(w);
  check("EE 1023: the training wisp never aggroes (it waits, for learning on)",
    w.alive && !w.aggro);
}

// --- EE 1023 (item 7): traversal lends the walked country growth ------------
{
  const mk = () => { const s = new Subspace(); s.getScroll("nova", 0, 0); return s; };
  const a = mk(), b = mk();
  const walker = { realmId: "nova", bx: 24, bz: 24, pace: 3 };
  const stander = { realmId: "nova", bx: 24, bz: 24, pace: 0 };
  for (let i = 0; i < 60; i++) { a.tick(walker); b.tick(stander); }
  check("EE 1023: the walked country's growth rises to bloom level",
    a.growthAt("nova", 12, 12) > 0.25, `a=${a.growthAt("nova", 12, 12)}`);
  check("EE 1023: standing still lends nothing (the walker's growth leads)",
    a.growthAt("nova", 12, 12) > b.growthAt("nova", 12, 12),
    `a=${a.growthAt("nova", 12, 12)} b=${b.growthAt("nova", 12, 12)}`);
  const c = mk();
  for (let i = 0; i < 3; i++) c.tick(walker);
  check("EE 1023: the lend ramps gradually — three ticks in, still only a creep",
    c.growthAt("nova", 12, 12) > 0 && c.growthAt("nova", 12, 12) < TRAVERSAL_GROWTH_FLOOR * 0.5,
    `c=${c.growthAt("nova", 12, 12)} floor=${TRAVERSAL_GROWTH_FLOOR}`);
}

// --- EE 1023 (item 1): a standing rift stitches its far end into the tick ---
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  const far = s.getScroll("ashfall", 5, 5);
  const player = { realmId: "nova", bx: 24, bz: 24, pace: 0 };
  for (let i = 0; i < 3; i++) s.tick(player);
  check("an unstitched far scroll sleeps (missed ticks accrue)",
    (far.missedTicks || 0) >= 3, `missed=${far.missedTicks}`);
  s.noteRiftLink(7, { realmId: "nova", landX: 10, landZ: 10 },
    { realmId: "ashfall", landX: 330, landZ: 330 });
  check("EE 1023: the link registers with both ends' scrolls precomputed",
    s.riftLinks.get(7).aRealm === "nova" && s.riftLinks.get(7).bsx === 5 &&
    s.riftLinks.get(7).bsy === 5);
  s.tick(player);
  check("EE 1023: while the rift stands, its far end steps with the tick",
    (far.missedTicks || 0) === 0, `missed=${far.missedTicks}`);
  s.clearRiftLink(7);
  s.tick(player); s.tick(player);
  check("EE 1023: a folded rift's far end sleeps again",
    (far.missedTicks || 0) >= 2, `missed=${far.missedTicks}`);
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
    // G1 fixture note: the drawing fills its whole canvas, so
    // the declared-size fit checks below judge the same extent
    // now that fit is measured on the rendered content.
    (() => { const [vx, vy, vw, vh] = vb.split(/\s+/).map(Number);
      return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg"><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#fff"/></svg>`; })(),
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
  // G1 (EE 1059 design): svg fit is judged on the rendered
  // content's bounds, not on the declared canvas.
  const svgContentFormOf = (vb, inner) => [
    "1.1.1/1.1.1/1.1.1", "name: Content", "",
    "1.1.1/1.1.1/1.1.2", "type: svg",
    `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`,
  ].join("\n");
  check("form: G1 a wide canvas with a small central drawing fits at baseline (content bounds, not canvas)",
    (() => { const s = formStanding(svgContentFormOf("0 0 240 360",
        '<rect x="60" y="10" width="120" height="340" fill="#fff"/>'));
      const b = s.parsed.frames[0].bounds;
      return s.parsed.ok && !s.refused && !s.leeway &&
        b.x === 60 && b.w === 120 && b.h === 340 &&
        frameNeed(s.parsed.frames[0]) === 1; })());
  check("form: G1 a narrow canvas with a spilling drawing is judged by its spill",
    (() => { const s = formStanding(svgContentFormOf("0 0 120 360",
        '<rect x="0" y="0" width="200" height="100" fill="#fff"/>'));
      const b = s.parsed.frames[0].bounds;
      return b.w === 200 && b.h === 100 && s.refused &&
        s.fit.frames[0].need > L.boxScaleCeiling; })());
  check("form: G1 an unmeasurable element falls back to the declared size, never a silent pass",
    (() => { const inner = '<rect x="0" y="0" width="10" height="10" fill="#fff"/><use href="#elsewhere"/>';
      const s = formStanding(svgContentFormOf("0 0 240 360", inner));
      const b = s.parsed.frames[0].bounds;
      return svgContentBounds(`<svg viewBox="0 0 240 360">${inner}</svg>`) === null &&
        b.x === 0 && b.y === 0 && b.w === 240 && b.h === 360 && s.refused; })());
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
  check("strike hint: AWEF assigns the strike to the click (F walks forward)",
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

// =====================================================================
// AWEF IS CANONICAL AS AUTHORED (Will, 2026-11-26 19:25 CST: "F is
// for forward"). His N-03 AWEF text — A backwards, F forwards,
// W left, E right — is the ruling; the code's old table (W forward,
// F back) was the defect demo19 flagged and the everything ship
// carried unfixed. These pins hold every AWEF direction table in
// the game (movement and the touch stick) to the authored mapping,
// letter by letter, and pin the old table absent from source and
// build alike.
// =====================================================================
{
  const game = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const tables = [...game.matchAll(/scheme === "AWEF"\s*\?\s*\{ f: "(Key\w+)", b: "(Key\w+)", l: "(Key\w+)", r: "(Key\w+)" \}/g)]
    .map((m) => m.slice(1).join("/"));
  check("awef: both direction tables (movement + touch stick) carry the scheme",
    tables.length === 2);
  check("awef: F forwards, A backwards, W left, E right — the authored mapping",
    tables.every((t) => t === "KeyF/KeyA/KeyW/KeyE"));
  check("awef: the old W-forward/F-back table is absent from source and build",
    !game.includes('{ f: "KeyW", b: "KeyF", l: "KeyA", r: "KeyE" }') &&
    !html.includes('{ f: "KeyW", b: "KeyF", l: "KeyA", r: "KeyE" }'));
  check("awef: WASD is untouched in both tables",
    (game.match(/\{ f: "KeyW", b: "KeyS", l: "KeyA", r: "KeyD" \}/g) || []).length === 2);
  check("awef: the scheme toasts name F as the forward key, never backward",
    (game.match(/F walks forward in this scheme/g) || []).length === 2 &&
    !game.includes("F walks backward"));
  check("awef: the rift walk probe presses the scheme's own forward key",
    game.includes('state.scheme === "AWEF" ? "KeyF" : "KeyW"'));
}

// =====================================================================
// THE ESC MENU (demo13, 2026-11-26): the .phext export is real phext
// (the estate implode), and the built file carries the menu, the
// binding store, and the settings store.
{
  console.log("\n== esc menu: the .phext export ==");
  // The implode, byte for byte: three scrolls, hand-computed from
  // the state machine (start 1.1.1/1.1.1/1.1.1; the second scroll
  // costs one scroll byte 0x17; the third differs at the section
  // component, so one section byte 0x1A, which also resets the
  // scroll component to 1 on the way).
  const imp = phextImplode(new Map([
    ["1.1.1/1.1.1/1.1.1", "A"],
    ["1.1.1/1.1.1/1.1.2", "B"],
    ["1.1.1/1.1.2/1.1.1", "C"],
  ]));
  check("phext: implode emits the level bytes in order",
    imp === "A\x17B\x1AC", JSON.stringify(imp));
  check("phext: the level byte table is the estate's",
    PHEXT_LEVEL_BYTES.length === 9 && PHEXT_LEVEL_BYTES[0] === 0x01 &&
    PHEXT_LEVEL_BYTES[8] === 0x17);

  const sub = new Subspace(); // kernels were initialized at the top of this file
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    sub.getScroll("nova", dx, dy, true);
  }
  const out = worldToPhext(sub, { player: "unit-fox", score: 7, exportedAt: "2026-11-26" });
  check("phext: the export carries the whole opened world",
    out.scrolls >= 13, `${out.scrolls} scrolls`); // home+log+realm+things+9 pages
  check("phext: the log scroll carries the genesis inscription",
    out.text.includes("the world is loaded"));
  check("phext: the home scroll names the player and the score",
    out.text.includes("Player: unit-fox") && out.text.includes("Score: 7"));
  check("phext: every coordinate component is >= 1",
    out.coords.every((k) => k.replace(/\//g, ".").split(".").every((n) => Number(n) >= 1)));
  // Explode by delimiter runs: each scroll after the first follows
  // exactly one run of level bytes (the export's texts are plain —
  // no level byte appears inside one).
  const levelSet = new Set(PHEXT_LEVEL_BYTES);
  let runs = 0, inRun = false;
  for (const ch of out.text) {
    const isLevel = levelSet.has(ch.charCodeAt(0));
    if (isLevel && !inRun) runs++;
    inRun = isLevel;
  }
  check("phext: an explode by level-byte runs finds every scroll",
    runs + 1 === out.scrolls, `${runs + 1} vs ${out.scrolls}`);
  check("phext: the byte count is the UTF-8 length of the text",
    out.bytes === new TextEncoder().encode(out.text).length);
}
{
  console.log("\n== esc menu: the built file ==");
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  check("menu: the built file carries the menu and its three sub-panels",
    html.includes('id="menu"') && html.includes('id="bindings-panel"') &&
    html.includes('id="video-panel"') && html.includes('id="audio-panel"'));
  check("menu: all eight rows are in the built file",
    ["menu-newgame", "menu-lan", "menu-savephext", "menu-merge",
     "menu-keys", "menu-video", "menu-audio", "menu-quit"]
      .every((id) => html.includes(`id="${id}"`)));
  check("menu: the binding store is the one obvious place",
    html.includes('LS.get("nova-phox-bindings"') &&
    html.includes("function setBinding") && html.includes("BIND.strike"));
  check("menu: the settings store is real and wired to the engine",
    html.includes('LS.get("nova-phox-settings"') &&
    html.includes("RENDER_R = SETTINGS.viewDistance") &&
    html.includes("SETTINGS.renderScale") && html.includes("SETTINGS.master"));
  check("menu: the new-game reset names the save model's keys",
    html.includes('"nova-phox-outbox"') && html.includes('"nova-phox-economy"') &&
    html.includes("function startNewGame"));
  check("menu: the LAN state is honest in the built file",
    html.includes("transport: null") && html.includes("no LAN transport"));
  check("menu: the .phext download takes worldToPhext's output",
    html.includes("worldToPhext(sub") && html.includes(".phext"));
}

// --- narration wiring (demo22): Joy's script, in text and voice -------
// Will's final script (NARRATION.md) is the game's only dialog now.
// These checks pin the wiring: every one of the script's 25 spoken
// texts stands verbatim in the built file; the speaker is Joy, the
// aperture shift; the old dialog is gone; and the embedded voice is
// the Joy set — 25 takes by beat ID, N-03 carried in both schemes,
// no take for the silent beats (border-down, strike-hold) or the
// retired one (contact), and no banter take (carried, unhooked).
{
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const md = readFileSync(new URL("./NARRATION.md", import.meta.url), "utf8");
  const texts = {};
  for (const sec of md.split(/^### /m).slice(1)) {
    const head = sec.split("\n")[0];
    const m = head.match(/^(N-\d+|BEAT-[\w-]+) ·/);
    if (!m) continue;
    const q = sec.split("\n").filter((l) => l.startsWith("> "))
      .map((l) => l.slice(2));
    if (!q.length) continue;
    const key = m[1] === "N-03"
      ? (head.includes("(WASD variant)") ? "N-03-WASD" : "N-03-AWEF")
      : m[1];
    texts[key] = q[0];
  }
  const spoken = Object.keys(texts).filter((k) => k !== "BEAT-contact");
  check("narration: the script parses to its 25 spoken texts (+ retired BEAT-contact)",
    spoken.length === 25 &&
    texts["BEAT-contact"] === "It reaches you out of the dark.",
    Object.keys(texts).join(","));
  check("narration: every script text stands verbatim in the built file",
    spoken.every((k) => html.includes(texts[k])),
    spoken.filter((k) => !html.includes(texts[k])).join(", "));
  check("narration: the speaker is Joy, the aperture shift",
    html.includes("aperture shift") &&
    html.includes("Joy — your aperture shift"));
  const OLD_DIALOG = [
    "Wake up, fox. I'm Emise — I keep the map, and I'll walk with you a while.",
    "The galaxy is ours: every star named, every shore explored. But most of everything is still dark — and nobody ever learned what the dark is hiding.",
    "Then the rifts opened — cracks where the dark gets in. Things turn up that shouldn't exist. Places appear that nobody built.",
    "You're standing in one now: Nova Prime. Click the world to take control — the sound starts with that click, so listen as you go.",
    "Feet first. Walk with W A S D — the arrows work too. Look with the mouse, and jump with Space. Walk as far as you like: there is no fence, no edge, no end.",
    "See the number keys along the top of your keyboard? They're an instrument. The letter row under them works too. Press any number and listen.",
    "Three different notes together make a tune. And a tune, fox, is a place.",
    "Here is the first tune worth knowing: 1, 4, 9. Play the three notes in any order, close together.",
    "That's the bridge tune. It opens a rift to Ashfall Haven, a few steps in front of you — walk through it to cross. From Ashfall, the same tune opens the way home.",
    "Ash and red rock. Every place on the map has its own weather, its own ground, its own mood.",
    "Things move in the dark here, same as at home. Most of the time you'll only catch a glimpse of them — and that's your moment. Strike when one shows itself: click, or press F.",
    "Play 1, 4, 9 when you're ready to head back.",
    "One more trick before I leave you to it: press G, and down turns upside down. Down isn't a law here — each place keeps its own down, and it remembers what you set.",
    "Try it. Flip down up, and a dark ceiling appears over this place to catch you — it wasn't there before you flipped.",
    "East of where you woke up, a hill rises over an old buried hall — the barrow. Deep inside it lies the Deep Stone, and something is guarding it.",
    "Reach the stone, and the prize is yours for good. The grass, the light, even the day will change around it — what you've earned stays earned.",
    "Climb the hill and go down the shaft in its top. Fight with click or F. And watch your hearts — when they're gone, you're carried back to where you started.",
    "The hat is yours, and it's yours for good. You know the two true things now, even if you'd never say them my way: a tune is a place, and a mark you make stays — even when everything around it changes.",
    "The rest of the map is yours. Ten more realms are marked on it, quiet for now — press M to see their names. I'll be here when you need me.",
    "Down is down again here.",
    "Down is up here. The place says so.",
    "The world lost track of you for a moment.",
    "The dark takes its due — and you wake back at Arrival. Everything you earned is still yours.",
    "The guardian is gone. The hall is quiet.",
    "It's gone. And the scar stays.",
    "It holds. Strike again.",
    "That's this place's own tune — it hums, and you stay put.",
    "Ashfall Haven. The air tastes of cinders; the rock remembers fire.",
    "Nova Prime. Home meadow, green under a kind sky.",
    "The tune lands you in a far-off place.",
    "Down is down. The place remembers.",
    "Down is up. The place remembers.",
    "The barrow hall. Something guards the deep room below — watch for its glimpses, and strike when it shows itself.",
    "The Deep Stone — and with it, a hat. It's yours for good.",
    "Nova Prime. I'm Emise — my panel is at the bottom of your screen.",
    "Emise — your guide",
    "listen to Emise"
  ];
  check("narration: the old dialog is gone from the built file",
    OLD_DIALOG.every((s) => !html.includes(s)),
    OLD_DIALOG.filter((s) => html.includes(s)).join(" | "));
  const keyReady = (id) => html.includes(`"${id}": "data:audio/mpeg;base64,`);
  check("narration: the Joy voice is embedded — all 25 takes, by beat ID",
    spoken.every(keyReady),
    spoken.filter((k) => !keyReady(k)).join(", "));
  check("narration: no bare N-03 take — the scheme variants carry it",
    !keyReady("N-03") && keyReady("N-03-WASD") && keyReady("N-03-AWEF"));
  check("narration: the silent and retired beats have no take",
    !keyReady("BEAT-border-down") && !keyReady("BEAT-strike-hold") &&
    !keyReady("BEAT-contact"));
  check("narration: the banter takes are embedded under their JOY-### line IDs (demo17 hook)",
    html.includes('"JOY-001"') && html.includes('"JOY-081"'));
  // S-1 (EE 1100): the four fight beats carry demo35's directed
  // re-records (EE 1037 item 5) — pinned BY HASH, because this exact
  // regression shipped once: demo35 replaced the takes in its area
  // only, demo41/42 were rebuilt from the repo audio set that never
  // received them, and the game silently spoke the original takes
  // again (S1-PRODUCER-REPORT.md, Finding 1).
  const FIGHT_TAKES = {
    "BEAT-guardian-contact": "1dabd88935fcdc6c0e860bcdf7a234eda234d53984dd7bb98780ce327c7d9234",
    "BEAT-strike-kill": "8f6c8ce5962da32c31db33fff327c29a5c5a5af41587b79cf1b65455e925f357",
    "BEAT-guardian-kill": "958f42d2093099c9fca9a28973b286f1dd21172f3339746832670d322a695dc5",
    "BEAT-death": "c19e17739f72b6ba3dd7bc4994c26a1062fb2da87e936955d4ebc338618d68e3",
  };
  const takeHash = (id) => {
    const m = html.match(new RegExp(`"${id}": "data:audio/mpeg;base64,([A-Za-z0-9+/=]+)"`));
    return m ? createHash("sha256").update(Buffer.from(m[1], "base64")).digest("hex") : null;
  };
  check("narration: the fight beats are demo35's re-recorded takes (hash-pinned, S-1)",
    Object.entries(FIGHT_TAKES).every(([id, h]) => takeHash(id) === h),
    Object.keys(FIGHT_TAKES).filter((id) => takeHash(id) !== FIGHT_TAKES[id]).join(", "));
  check("narration: (Winds of Change) is atmosphere, not speech — the swell stands at both guardian-kill sites (EE 1100)",
    html.includes("windsOfChange()") &&
    (html.match(/sfx\.windsOfChange\(\)/g) || []).length === 2);
  check("narration: BEAT-guardian-contact shows its line like every other beat (S-1)",
    html.includes('toast(BEAT_LINES["BEAT-guardian-contact"])'));
  check("narration: the move step resolves its text and beat by scheme",
    html.includes("MOVE_LINES[state.scheme]") &&
    html.includes('state.scheme === "AWEF" ? "N-03-AWEF" : "N-03-WASD"'));
}
// --- speedrun mode (demo16): the run, its recording, its stream -----------
// The pure half of Will's speedrunner spec: what a run is, what its
// recording says, and how the recording is checked. The finish test
// must mirror Subspace.checkQuest exactly, and a recording's own
// event stream must reproduce its finish time under verification.
{
  check("speedrun: the race clock reads m:ss.mmm",
    formatRunTime(0) === "0:00.000" && formatRunTime(7250) === "0:07.250" &&
    formatRunTime(754567) === "12:34.567" && formatRunTime(-5) === "0:00.000");
  const stone = DUNGEON.deepStone;
  check("speedrun: the finish test is checkQuest's near-box, no wider",
    deepStoneNear(stone.x, stone.y, stone.z, stone) &&
    deepStoneNear(stone.x + 2, stone.y + 3, stone.z - 2, stone) &&
    !deepStoneNear(stone.x + 3, stone.y, stone.z, stone) &&
    !deepStoneNear(stone.x, stone.y + 4, stone.z, stone));
  check("speedrun: splits are the named beats, in the order a run meets them",
    RUN_SPLITS.length === 3 &&
    splitForBeat("BEAT-barrow")?.name === "The Barrow Hall" &&
    splitForBeat("BEAT-nope") === null && RUN_FINISH_BEAT === "BEAT-quest");

  // A synthetic run, written the way the game's recorder writes it.
  const rec = newRunRecording({
    player: "fox-test", shipEE: "950",
    startedAt: "2026-11-26T21:30:00.000Z", stone,
  });
  recEvent(rec, 0, "start", { realm: "nova" });
  recEvent(rec, 250, "pos", { realm: "nova", x: 8.5, y: 21.01, z: 8.5, hp: 20, grav: 1 });
  recEvent(rec, 900, "key", { code: "KeyW" });
  recEvent(rec, 5000, "strike", {});
  recEvent(rec, 30000, "split", { beat: "BEAT-barrow" });
  recEvent(rec, 60000, "pos", { realm: "nova", x: 45.5, y: 5.01, z: 30.5, hp: 14, grav: 1 });
  recEvent(rec, 75432, "finish", { x: stone.x + 0.5, y: stone.y + 1.01, z: stone.z + 0.5 });

  const v = verifyRecording(rec);
  check("speedrun: a whole recording verifies, and its stream reproduces its finish time",
    v.ok && v.finishMs === 75432, JSON.stringify(v.errors));
  check("speedrun: verification reads the splits back off the stream",
    v.splits.length === 1 && v.splits[0].beat === "BEAT-barrow" && v.splits[0].atMs === 30000);

  const backwards = structuredClone(rec);
  backwards.events[3].t = 100; // the strike lands before the key that swung it
  check("speedrun: a stream that runs backwards in time does not verify",
    !verifyRecording(backwards).ok);
  const twoFinishes = structuredClone(rec);
  recEvent(twoFinishes, 76000, "finish", { x: stone.x, y: stone.y, z: stone.z });
  check("speedrun: two finishes do not verify", !verifyRecording(twoFinishes).ok);
  const wrongStone = structuredClone(rec);
  const fe = wrongStone.events.find((e) => e.k === "finish");
  fe.x = stone.x + 40;
  check("speedrun: a finish away from the stone does not verify",
    !verifyRecording(wrongStone).ok);
  const outOfOrder = structuredClone(rec);
  outOfOrder.events.splice(5, 0, { t: 29000, k: "split", beat: "BEAT-guardian-kill" });
  check("speedrun: splits out of order do not verify", !verifyRecording(outOfOrder).ok);
  const noStart = structuredClone(rec);
  noStart.events = noStart.events.filter((e) => e.k !== "start");
  check("speedrun: a stream with no start does not verify", !verifyRecording(noStart).ok);

  const text = serializeRecording(rec);
  const back = parseRecording(text);
  const vb = verifyRecording(back);
  check("speedrun: the .phext scroll round-trips — parse, then verify, same finish",
    back.kind === RUN_KIND && back.events.length === rec.events.length &&
    vb.ok && vb.finishMs === 75432, JSON.stringify(vb.errors));
  check("speedrun: the scroll names its player, its epoch, and its stone",
    text.includes("player: fox-test") && text.includes("ship-ee: 950") &&
    text.includes(`stone: ${stone.x},${stone.y},${stone.z}`));

  const msg = JSON.parse(telemetryMessage("telemetry", { elapsedMs: 1234, realm: "nova" }));
  check("speedrun: a stream message is one JSON object, typed and named",
    msg.type === "telemetry" && msg.game === "nova-fox" && msg.elapsedMs === 1234);

  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  check("speedrun: the race clock and the panel ride in the built file",
    html.includes('id="runtimer"') && html.includes('id="speedrun"') &&
    html.includes('id="btn-speedrun"') && html.includes("function speedrunTick"));
}
// --- banter: Joy's hundred and the trigger engine (demo17) -------
// The lines are Joy's own (JOY-BANTER.md); the engine is banter.js.
// Every check drives the engine with constructed events and an
// injected clock — conditions fire, conditions don't, and the
// discipline (grace, gaps, pool lock, the protected quiet) holds.
{
  const T0 = 1_000_000;
  const obs = (over = {}) => ({
    type: "observe", x: 8.5, y: 21, z: 8.5, realm: "nova", yaw: 0,
    onGround: true, hSpeed: 0, idleMs: 0, gravDir: 1,
    startVisible: false, atView: false, lookTowardStart: false,
    groundAheadDelta: 0, inHall: false, ambienceCinders: false, ...over,
  });
  const chord = (bs, at, seq = [1, 4, 9], targetKey = "realm:ashfall", targetRealm = "ashfall") =>
    banterEvent(bs, { type: "chord", seq, targetKey, targetRealm, inHall: false, leavesRealm: true }, at);

  // the table itself: a hundred lines, Joy's numbers, her words
  check("banter: the table holds exactly 100 lines", BANTER_LINES.length === 100);
  check("banter: ids run JOY-001..JOY-100 in order",
    BANTER_LINES.every((l, i) => l.id === "JOY-" + String(i + 1).padStart(3, "0") && l.n === i + 1));
  check("banter: spot texts are verbatim (#1, #36, #81, #100)",
    BANTER_BY_N.get(1).text === "I love this part. The not-knowing part." &&
    BANTER_BY_N.get(36).text === "Look how far away our morning is." &&
    BANTER_BY_N.get(81).text === "Oh, I know that handwriting. Hi, earlier Fox." &&
    BANTER_BY_N.get(100).text === "I saved you a quiet, Fox.");
  check("banter: spot texts are verbatim (#29, #70)",
    BANTER_BY_N.get(29).text === "There you are." &&
    BANTER_BY_N.get(70).text === "I knew where you meant by the way you played the first note.");

  // the opening's grace: a first crossing inside it is silent
  {
    const bs = createBanter(null, T0);
    check("banter: grace — a crossing in the first 20 s speaks nothing",
      banterEvent(bs, { type: "cross", from: "nova", to: "elven", ambience: [] }, T0 + 5000) === null);
    const line = banterEvent(bs, { type: "cross", from: "elven", to: "orchid", ambience: [] }, T0 + 21000);
    check("banter: first realm after the grace — #3 new realm smell",
      line && line.n === 3, line && line.text);
  }
  // the global gap lets a moment go; the seam still compares across
  {
    const bs = createBanter(null, T0);
    banterEvent(bs, { type: "cross", from: "nova", to: "elven", ambience: [] }, T0 + 21000);
    check("banter: global gap — a rich moment 10 s later is let go",
      banterEvent(bs, { type: "cross", from: "elven", to: "ashfall", ambience: ["cinders"] }, T0 + 31000) === null);
    const line = banterEvent(bs, {
      type: "cross", from: "ashfall", to: "nova",
      ambience: [], fromAmbience: ["cinders", "wet"],
    }, T0 + 67000);
    check("banter: crossing out of the cinders — #49, the rain stops",
      line && line.n === 49, line && line.text);
    const bs2 = createBanter(null, T0);
    const first = banterEvent(bs2, { type: "cross", from: "nova", to: "ashfall", ambience: ["cinders", "wet"] }, T0 + 21000);
    check("banter: first cinder entry — #8, Ashfall saying hello",
      first && first.n === 8, first && first.text);
  }
  // the group gap: wonder is spent, but another group may speak
  {
    const bs = createBanter(null, T0);
    banterEvent(bs, { type: "cross", from: "nova", to: "ashfall", ambience: ["cinders"] }, T0 + 21000); // #8, wonder
    const line = banterEvent(bs, { type: "pocket" }, T0 + 21000 + 50000);
    check("banter: group gap — the pocket speaks #50 (rifts), not a wonder line",
      line && line.n === 50, line && line.text);
  }
  // #29: the long absence only; #30: the handover bookend, once
  {
    const bs = createBanter(null, T0);
    const line = banterEvent(bs, { type: "sessionStart", awayMs: 9 * 3600 * 1000 }, T0 + 1000);
    check("banter: #29 — a nine-hour absence earns 'There you are.'",
      line && line.n === 29, line && line.text);
    const bs2 = createBanter(null, T0);
    check("banter: #29 — an hour away is not a long absence",
      banterEvent(bs2, { type: "sessionStart", awayMs: 3600 * 1000 }, T0 + 1000) === null);
    const bs3 = createBanter(null, T0);
    const hello = banterEvent(bs3, { type: "handover" }, T0 + 1000);
    check("banter: #30 — the handover speaks the bookend inside the grace",
      hello && hello.n === 30, hello && hello.text);
    check("banter: #30 — and only once",
      banterEvent(bs3, { type: "handover" }, T0 + 100000) === null);
  }
  // #36 (named): crest a ridge with the morning still visible
  {
    const climb = (bs, startVisible) => {
      chord(bs, T0 + 1000); // a tune early: #6 stays out of the way
      let out = null;
      const ys = [21, 22, 23, 24, 25, 26, 25.4, 24.4];
      ys.forEach((y, i) => {
        const r = banterEvent(bs, obs({
          x: 8.5 + i, y, hSpeed: 2, startVisible,
        }), T0 + 21000 + i * 250);
        if (r) out = r;
      });
      return out;
    };
    const seen = climb(createBanter(null, T0), true);
    check("banter: #36 — cresting with the start in view",
      seen && seen.n === 36, seen && seen.text);
    const unseen = climb(createBanter(null, T0), false);
    check("banter: crest without the start in view — #12, not #36",
      unseen && unseen.n === 12, unseen && unseen.text);
  }
  // #70 (named): the first note toward a place visited often
  {
    const bs = createBanter(null, T0);
    chord(bs, T0 + 1000); chord(bs, T0 + 2000); chord(bs, T0 + 3000);
    const line = banterEvent(bs, { type: "note", n: 1, seqIndex: 1, firstNote: 1, gapMs: 0 }, T0 + 30000);
    check("banter: #70 — three journeys to Ashfall teach her the first note",
      line && line.n === 70, line && line.text);
    const bs2 = createBanter(null, T0);
    chord(bs2, T0 + 1000); chord(bs2, T0 + 2000);
    check("banter: #70 — twice is not 'often' yet",
      banterEvent(bs2, { type: "note", n: 1, seqIndex: 1, firstNote: 1, gapMs: 0 }, T0 + 30000) === null);
  }
  // #41 / #47: the seam compares, and a revisited patch of sun
  {
    const bs = createBanter(null, T0);
    const x = (from, to, ambience, fromAmbience, at) =>
      banterEvent(bs, { type: "cross", from, to, ambience, fromAmbience }, at);
    x("nova", "halycon", ["bright"], [], T0 + 21000);            // #3
    x("halycon", "logos", ["strong"], ["bright"], T0 + 111000);  // #9 (group gap honored)
    const seam = x("logos", "delta", ["dark"], ["strong"], T0 + 157000);
    check("banter: #41 — the seam line, once the louder lines are spent",
      seam && seam.n === 41, seam && seam.text);
    const bs2 = createBanter(null, T0);
    const y = (from, to, ambience, fromAmbience, at) =>
      banterEvent(bs2, { type: "cross", from, to, ambience, fromAmbience }, at);
    y("nova", "halycon", ["bright"], [], T0 + 21000);            // #3
    y("halycon", "nova", [], ["bright"], T0 + 67000);            // #41
    const sun = y("nova", "halycon", ["bright"], [], T0 + 157000); // group gap honored
    check("banter: #47 — back in the bright realm, a patch of sun",
      sun && sun.n === 47, sun && sun.text);
  }
  // #32: the long walk that ends in front of a very good rock
  {
    const bs = createBanter(null, T0);
    chord(bs, T0 + 1000);
    let x = 8.5;
    banterEvent(bs, obs({ x }), T0 + 21000);
    for (let i = 1; i <= 30; i++) {
      x += 2.5;
      const stopped = i % 10 === 0;
      banterEvent(bs, obs({ x, hSpeed: stopped ? 0 : 2 }), T0 + 21000 + i * 1000);
    }
    const line = banterEvent(bs, obs({ x, idleMs: 4500, lookPrize: true }), T0 + 21000 + 31000);
    check("banter: #32 — seventy-five blocks, then a very good rock",
      line && line.n === 32, line && line.text);
  }
  // #81 (named): your own old mark, met from an unfamiliar approach
  {
    const markAt = (bs) => banterEvent(bs, {
      type: "mark", key: "nova:10,20,10", x: 10, y: 20, z: 10, realm: "nova",
      yaw: 0, broke: false, level: 1, dist: 2, inHall: false,
    }, T0 + 21000);
    const bs = createBanter(null, T0);
    markAt(bs);
    banterEvent(bs, obs({ x: 100, y: 21, z: 100 }), T0 + 21000 + 11 * 60000);
    const line = banterEvent(bs, obs({ x: 12, y: 21, z: 12, yaw: Math.PI }), T0 + 21000 + 11 * 60000 + 46000);
    check("banter: #81 — the old mark, approached from the far side",
      line && line.n === 81, line && line.text);
    const bs2 = createBanter(null, T0);
    markAt(bs2);
    banterEvent(bs2, obs({ x: 100, y: 21, z: 100 }), T0 + 21000 + 11 * 60000);
    const ctrl = banterEvent(bs2, obs({ x: 12, y: 21, z: 12, yaw: 0.2 }), T0 + 21000 + 11 * 60000 + 46000);
    check("banter: #81 — the familiar approach earns #85 (crooked) instead",
      ctrl && ctrl.n === 85, ctrl && ctrl.text);
  }
  // #100: the saved quiet — and the silence protected after it
  {
    const bs = createBanter(null, T0);
    chord(bs, T0 + 1000);
    banterEvent(bs, obs({}), T0 + 21000);
    const line = banterEvent(bs, obs({ idleMs: 19000, atView: true }), T0 + 22000);
    check("banter: #100 — a long chosen pause beside a view",
      line && line.n === 100, line && line.text);
    check("banter: #100 — the quiet is protected (a crossing inside it is silent)",
      banterEvent(bs, { type: "cross", from: "nova", to: "elven", ambience: [] }, T0 + 22000 + 60000) === null);
    const after = banterEvent(bs, { type: "cross", from: "elven", to: "orchid", ambience: [] }, T0 + 22000 + 181000 + 46000);
    check("banter: #100 — after the quiet, she speaks again",
      after && after.n === 3, after && after.text);
  }
  // a pause that is not beside a view: the soft set stays distinct
  {
    const bs = createBanter(null, T0);
    chord(bs, T0 + 1000);
    banterEvent(bs, obs({}), T0 + 21000);
    const line = banterEvent(bs, obs({ idleMs: 26000, atView: false }), T0 + 22000);
    check("banter: #91 — a long plain pause watches the cloud instead",
      line && line.n === 91, line && line.text);
  }
  // the pool lock: a line does not come back until the pool is used
  {
    const bs = createBanter(null, T0);
    const g = (id, at) => banterEvent(bs, {
      type: "glimpse", monsterId: id, kind: "surface", realm: "nova",
      dist: 20, bearingDeg: 10, secondVisible: false, afterStillMs: 0,
      playerMoving: true, turnedRecently: false, longDarkMs: 0,
    }, at);
    const first = g("m1", T0 + 21000);
    check("banter: first glimpse of the session — #4, they watch us",
      first && first.n === 4, first && first.text);
    const second = g("m2", T0 + 21000 + 46000);
    check("banter: the next glimpse speaks another line (#51), never #4 again",
      second && second.n === 51, second && second.text);
  }
  // the blink: a glimpse that ends before she can finish blinking
  {
    const bs = createBanter(null, T0);
    const line = banterEvent(bs, { type: "glimpseEnd", monsterId: "m1", durationMs: 800, struck: false }, T0 + 21000);
    check("banter: #53 — a sub-second glimpse, unstruck",
      line && line.n === 53, line && line.text);
  }
  // gravity: down's long tenure earns #20; a quick flip earns #71
  {
    const bs = createBanter(null, T0);
    const line = banterEvent(bs, { type: "flip", toUp: true }, T0 + 6 * 60000);
    check("banter: #20 — down had its chance (six minutes of down first)",
      line && line.n === 20, line && line.text);
    const bs2 = createBanter(null, T0);
    const quick = banterEvent(bs2, { type: "flip", toUp: true }, T0 + 21000);
    check("banter: #71 — a quick flip is just 'Oh, that up.'",
      quick && quick.n === 71, quick && quick.text);
  }
  // landings: the mid-air flip is the clever one; a first inverted
  // landing looks at the tops of doors
  {
    const bs = createBanter(null, T0);
    const line = banterEvent(bs, {
      type: "land", airMs: 2000, inverted: false, flipMidAir: true, descent: 3, horizDist: 2,
    }, T0 + 21000);
    check("banter: #77 — flipped mid-air, ears caught up",
      line && line.n === 77, line && line.text);
    const bs2 = createBanter(null, T0);
    const inv = banterEvent(bs2, {
      type: "land", airMs: 1000, inverted: true, flipMidAir: false, descent: 3, horizDist: 2,
    }, T0 + 21000);
    check("banter: #74 — the first inverted landing",
      inv && inv.n === 74, inv && inv.text);
  }
  // muted: while the guide owns the fox she remembers but never speaks
  {
    const bs = createBanter(null, T0);
    bs.muted = true;
    check("banter: muted — a first crossing is remembered, not spoken",
      banterEvent(bs, { type: "cross", from: "nova", to: "elven", ambience: [] }, T0 + 21000) === null &&
      bs.plays === 0 && bs.visitedRealms.has("elven"));
    bs.muted = false;
    const line = banterEvent(bs, { type: "cross", from: "elven", to: "orchid", ambience: [] }, T0 + 22000);
    check("banter: unmuted — the next new realm speaks",
      line && line.n === 3, line && line.text);
  }
  // persistence: the snapshot carries her memory across sessions
  {
    const bs = createBanter(null, T0);
    banterEvent(bs, {
      type: "mark", key: "nova:10,20,10", x: 10, y: 20, z: 10, realm: "nova",
      yaw: 0, broke: false, level: 1, dist: 2, inHall: false,
    }, T0 + 21000);
    const snap = banterSnapshot(bs, T0 + 30000);
    const bs2 = createBanter(snap, T0 + 40000);
    check("banter: snapshot — the mark registry survives the session",
      bs2.marks.has("nova:10,20,10") && bs2.marksMade === 1);
    check("banter: snapshot — lastSeenAt is stamped for the absence clock",
      snap.lastSeenAt === T0 + 30000);
  }
  // the built file carries the banter: lines, engine, and the surface
  {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
    check("banter: the built file carries the hundred and the line surface",
      html.includes("createBanter") && html.includes("I saved you a quiet, Fox.") &&
      html.includes('id="banter-line"') && html.includes("banterEvent"));
  }
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
  // --- the road ahead (Item #3, EE 1068 design): the roadmap split ------------
  const rmRow = (id, status, ts, statusTs, shipEE = null) =>
    ({ id, name: "fox-" + id, ts, title: "idea " + id, body: "b",
       status, statusTs, shipEE });
  check("roadmap: submitted and picked land in upcoming, oldest told first",
    (() => { const s = roadmapSplit([
        rmRow("b", "picked", 200, 300), rmRow("a", "submitted", 100, 100),
        rmRow("c", "submitted", 300, 300)]);
      return s.upcoming.map((r) => r.id).join(",") === "a,b,c" &&
        s.shipped.length === 0; })());
  check("roadmap: shipped lands in shipped, newest ship first, EE carried",
    (() => { const s = roadmapSplit([
        rmRow("x", "shipped", 100, 500, 901), rmRow("y", "shipped", 90, 700, 902)]);
      return s.shipped.map((r) => r.id).join(",") === "y,x" &&
        s.shipped[0].shipEE === 902 && s.upcoming.length === 0; })());
  check("roadmap: caps hold — 12 upcoming, 8 shipped",
    (() => { const many = [];
        for (let i = 0; i < 15; i++) many.push(rmRow("u" + i, "submitted", i, i));
        for (let i = 0; i < 11; i++) many.push(rmRow("s" + i, "shipped", 100 + i, 100 + i, 900 + i));
        const s = roadmapSplit(many);
        return ROADMAP_UPCOMING_MAX === 12 && ROADMAP_SHIPPED_MAX === 8 &&
          s.upcoming.length === 12 && s.shipped.length === 8 &&
          s.upcoming[0].id === "u0" && s.shipped[0].id === "s10"; })());
  check("roadmap: an unknown status is excluded from both groups",
    (() => { const s = roadmapSplit([
        rmRow("z", "vanished", 1, 1), rmRow("a", "submitted", 2, 2)]);
      return s.upcoming.length === 1 && s.shipped.length === 0; })());
  check("roadmap: empty input gives two empty groups",
    (() => { const s = roadmapSplit([]);
      return s.upcoming.length === 0 && s.shipped.length === 0; })());
}


// --- EE 995 feedback batch (demo29): the eleven items, pinned ---------------
{
  // Item 7 — ROYGBIV: every realm on its band of the rainbow.
  const BANDS = { trust: 150, ashfall: 180, logos: 205, willow: 230, elven: 270,
    delta: 325, halycon: 10, "ni-knight": 45, orchid: 75, plain: 0 };
  check("ROYGBIV: every realm's atlas hue sits on its rainbow band",
    Object.entries(BANDS).every(([id, hue]) => REALM_PALETTES[id].hue === hue));
  check("ROYGBIV: the accents are the band colors",
    REALM_PALETTES.trust.accent === 0xff2e2e && REALM_PALETTES.logos.accent === 0xffd21f &&
    REALM_PALETTES.elven.accent === 0x2eff7a && REALM_PALETTES.halycon.accent === 0x3fa9ff &&
    REALM_PALETTES["ni-knight"].accent === 0x6a5cff && REALM_PALETTES.orchid.accent === 0xb45cff &&
    REALM_PALETTES.plain.accent === 0xe8e8e8);
  // Item 4's ground: the portals must go somewhere.
  check("all eleven realms are open (the ten portals go somewhere)",
    REALMS.every((r) => r.open));
  check("every realm has an Arrival (a portal landing)",
    REALMS.every((r) => !!ARRIVAL[r.id]));

  // Item 3 — distinct worlds, not coordinate relabels.
  check("terrain: Nova's profile IS the historical formula (base 11, amp 7/2.5)",
    REALM_TERRAIN.nova.mode === "roll" && REALM_TERRAIN.nova.base === 11 &&
    REALM_TERRAIN.nova.amp === 7 && REALM_TERRAIN.nova.amp2 === 2.5 &&
    REALM_TERRAIN.ashfall.mode === "ridge" && REALM_TERRAIN.ashfall.base === 9 &&
    REALM_TERRAIN.ashfall.amp === 13);
  check("terrain: Ni-Knight rises in terraces (heights quantized to its step)",
    (() => { for (let x = 300; x < 400; x += 3) for (let z = 300; z < 400; z += 3)
      if ((heightAt("ni-knight", x, z) - 12) % 3 !== 0) return false; return true; })());
  check("terrain: Plain View is nearly flat (range <= 3 over a wide sample)",
    (() => { let lo = 1e9, hi = -1e9;
      for (let x = 300; x < 420; x += 2) for (let z = 300; z < 420; z += 2) {
        const h = heightAt("plain", x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      return hi - lo <= 3; })());
  check("terrain: Trust Fall's ridges tower (peaks above 20)",
    (() => { let hi = -1e9;
      for (let x = 300; x < 420; x += 2) for (let z = 300; z < 420; z += 2)
        hi = Math.max(hi, heightAt("trust", x, z)); return hi > 20; })());
  check("terrain: Delta Wood carves a river channel (columns cut below the banks)",
    (() => { let lo = 1e9;
      for (let x = 300; x < 460; x++) for (let z = 300; z < 460; z++)
        lo = Math.min(lo, heightAt("delta", x, z)); return lo <= 10; })());
  const subT = new Subspace();
  const topAt = (realm, x, z) => baseBlockAt(subT, realm, x, heightAt(realm, x, z), z);
  check("surfaces: Logos wears sandstone, Halycon sandstone dusted with shale (P-5), Trust Fall red rock",
    [310, 330, 350, 370].every((x) => topAt("logos", x, 320) === BLOCK.SANDSTONE) &&
    [310, 330, 350, 370].every((x) => topAt("halycon", x, 320) === BLOCK.SANDSTONE ||
      topAt("halycon", x, 320) === BLOCK.SHALE) &&
    [310, 330, 350, 370].every((x) => topAt("trust", x, 320) === BLOCK.REDROCK));
  check("surfaces: Ni-Knight is stone-flagged (stone, brick at the seams)",
    [310, 330, 350, 370, 390].every((x) =>
      topAt("ni-knight", x, 320) === BLOCK.STONE || topAt("ni-knight", x, 320) === BLOCK.BRICK));
  check("surfaces: Elven shade is moss-dominant (more moss than Nova, same columns)",
    (() => { let e = 0, n = 0;
      for (let x = 300; x < 420; x += 2) for (let z = 300; z < 420; z += 2) {
        if (topAt("elven", x, z) === BLOCK.MOSS) e++;
        if (topAt("nova", x, z) === BLOCK.MOSS) n++; }
      return e > n; })());
  check("surfaces: Delta's river bed is sandstone",
    (() => { for (let x = 300; x < 460; x++) for (let z = 300; z < 460; z++)
        if (deltaRiver("delta", x, z) > 0.5) return topAt("delta", x, z) === BLOCK.SANDSTONE;
      return false; })());
  check("trees: Halycon stands bare (no wood in a whole chunk)",
    (() => { const d = genChunk(subT, "halycon", 10, 10);
      for (let i = 0; i < d.length; i++) if (d[i] === BLOCK.WOOD) return false; return true; })());
  check("trees: Ni-Knight raises brick-capped pillars",
    (() => { const d = genChunk(subT, "ni-knight", 20, 20);
      for (let lx = 0; lx < 32; lx++) for (let lz = 0; lz < 32; lz++) {
        const h = heightAt("ni-knight", 320 + lx, 320 + lz);
        for (let y = h + 2; y < h + 10; y++) if (chunkBlock(d, lx, y, lz) === BLOCK.BRICK) return true; }
      return false; })());

  // Items 5+6 — the wormhole's pocket: a vault corridor while set.
  {
    const sub2 = new Subspace();
    sub2.transitPocket = { realmId: "nova", sx: 512, sy: 512,
      x0: 32774, x1: 32804, z0: 32797, z1: 32803, floorY: 19, ceilY: 25 };
    const d = genChunk(sub2, "nova", 2048, 2049); // CHUNK is 16: the pocket's chunks
    check("the passage: vault floor, walls and ceiling in the pocket scroll",
      chunkBlock(d, 12, 19, 13) === BLOCK.VAULT &&
      chunkBlock(d, 12, 21, 12) === BLOCK.VAULT &&
      chunkBlock(d, 12, 25, 13) === BLOCK.VAULT &&
      chunkBlock(d, 6, 21, 13) === BLOCK.VAULT);
    check("the passage: its bore is open air",
      chunkBlock(d, 12, 21, 13) === BLOCK.AIR && chunkBlock(d, 14, 22, 13) === BLOCK.AIR);
    sub2.transitPocket = null;
    const d2 = genChunk(sub2, "nova", 2048, 2049);
    check("the passage: unsetting the pocket restores ordinary generation",
      !d.every((b, i) => b === d2[i]));
  }

  // Item 11 — the small sword by the spawn.
  check("the Small Sword is a weapon between bare paw and Star Lance",
    ITEM_DEFS.sword.weapon === true && ITEM_DEFS.sword.range > 4.4 &&
    ITEM_DEFS.sword.range < ITEM_DEFS.lance.range && ITEM_DEFS.sword.damage >= 1);
  check("the sword waits a few steps from the Arrival",
    ITEM_SPOTS.sword.realmId === "nova" &&
    Math.hypot(ITEM_SPOTS.sword.bx - ARRIVAL.nova.x, ITEM_SPOTS.sword.bz - ARRIVAL.nova.z) <= 6);

  // Item 9 — engagement: entered the sphere means staying.
  {
    const s = new Subspace();
    s.getScroll("nova", 0, 0);
    s.monsters.length = 0;
    const m = s.spawnMonster("nova", 12, 12, "surface");
    const near = { realmId: "nova", bx: 25, bz: 25 };
    s.tick(near);
    check("engaged: entering the player's sphere latches, phase pinned",
      m.engaged === true && m.phase === 0);
    let vis = true;
    for (let i = 0; i < 30; i++) { s.tick(near); if (!s.monsterVisible(m)) vis = false; }
    check("engaged: it does not fade — visible every tick", vis && m.phase === 0);
    for (let i = 0; i < 300; i++) s.tick(null);
    check("engaged: the reaper never sinks it, watched or not",
      s.monsters.includes(m) && s.monsterVisible(m));
    const s2 = new Subspace();
    s2.getScroll("nova", 0, 0);
    s2.monsters.length = 0;
    for (let i = 0; i < 500; i++) s2.tick(near);
    check("things of the dark rise at random intervals (the rise is written)",
      s2.wal.some((w) => w.op === "rise") &&
      s2.monsters.some((mm) => mm.alive && mm.kind === "surface"));
  }

  // The view-side items, pinned at the source (their behavior is
  // exercised by the Jenkins e2e legs).
  const g = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  const pg = readFileSync(new URL("./page3.html", import.meta.url), "utf8");
  check("intro once per game: the guide's place is kept and restored",
    g.includes('localStorage.setItem("nova-phox-guide"') && g.includes("restoreGuide();"));
  check("Esc: the pointer-unlock opens the menu; the menu's exit re-locks",
    g.includes("wasLocked && !pointerLocked") && g.includes("closeMenu(); lockPointer();"));
  check("portal panel: choosing a realm brings up its portal where you stand",
    g.includes("data-portal") && g.includes("openRift({ type: \"realm\", realmId: row.dataset.portal })"));
  check("the rift is walked: stepping in begins the warp transit (EE 1023: in the world, not a pocket)",
    g.includes("function beginTransit()") && g.includes("crossThroughRift(T.carried)") &&
    !g.includes("kaleidoTexture") && !g.includes("TRANSIT_SCROLL"));
  check("Joy is present: a visible companion, built and stepped every frame",
    g.includes("function buildJoy()") && g.includes("stepJoy(now, dt)"));
  check("powerups announce: a sound and a center-screen card",
    g.includes("sfx.powerup();") && g.includes("showPowerup(def.name)") && pg.includes('id="powercard"'));
  check("the sword strikes at its own reach in the fox's hand",
    g.includes('state.weapon === "sword" ? ITEM_DEFS.sword : null'));

  // EE 1023 view-side pins (items 1, 3, 4, 5, 6, 7, 8).
  check("EE 1034: the warp is gone — the frame renders straight, the tunnel is geometry",
    g.includes("function renderFrame(now, dt)") && !g.includes("uWarp") &&
    !g.includes("buildStreaks()") && !g.includes("WARP_TRANSIT_MS") &&
    g.includes("tunnelCoord") && g.includes("ensureTunnelsForLink"));
  check("subspace accommodates the rift: the link registers at birth and clears at death",
    g.includes("sub.noteRiftLink(state.riftLink.id, a, b)") && g.includes("sub.clearRiftLink(state.riftLink.id)"));
  check("monsters turn red when attacked, and charm when nothing is wrong",
    g.includes("monsterHitAt") && g.includes("RED_HOT") && g.includes("function cuteMotion("));
  check("the opening lines run ~40% faster, with no gap after them",
    g.includes("OPENING_RATE: 1.4") && g.includes('id.startsWith("N-") ? 0 : undefined'));
  check("the sword equips: a binding, an equip verb, ownership, and a held blade",
    g.includes('id: "equip"') && g.includes('"KeyZ"') && g.includes("function equipWeapon()") &&
    g.includes("function buildSwordInto(") && g.includes("swordView"));
  check("waypoints to the hall: a beacon in the world and a diamond on the screen",
    g.includes("function buildHallBeacon()") && g.includes("function stepWaypoint(now)") &&
    pg.includes('id="waypoint"'));
  check("the tick carries the fox's pace (item 7's view half)",
    g.includes("lastTickPos") && g.includes("pace,"));
  check("one stroke carves: the guide teaches the single stroke now",
    g.includes("One stroke carves it through"));
}


// =====================================================================
// PHONE PLAYABILITY (demo28, 2026-11-26): Will's phone playtest —
// "couldn't cancel the console", "couldn't get back to anything
// useful, couldn't type a rift code" — and the 20:27 ruling: the
// world stays playable after a gravity inversion (the once-a-day
// rule itself untouched — its pins stand elsewhere in this suite).
// The pure pins hold baseBlockAt's vault; the source pins hold the
// wiring the headless modules cannot reach.
// =====================================================================
{
  console.log("\n== phone playability: the vault, the console, the rift ==");
  const game = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("./page3.html", import.meta.url), "utf8");
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const world = readFileSync(new URL("./world.js", import.meta.url), "utf8");

  // The vault, pure (IP-3): under normal gravity there is no vault
  // anywhere — the shaft column is carve at vault height, open
  // country is air. Inverted, the vault lies at CEIL_Y/CEIL_Y+1
  // over open country AND over the barrow shaft: no hole.
  const subUp = new Subspace();
  check("vault: normal gravity — the shaft column is carve at vault height",
    baseBlockAt(subUp, "nova", 45, CEIL_Y, 31) === -1);
  check("vault: normal gravity — open country is air at vault height",
    baseBlockAt(subUp, "nova", 20, CEIL_Y, 20) === BLOCK.AIR);
  const subInv = new Subspace();
  subInv.flipGravity("nova", 0, 0);
  check("vault: inverted — open country wears the vault at CEIL_Y and CEIL_Y + 1",
    baseBlockAt(subInv, "nova", 20, CEIL_Y, 20) === BLOCK.VAULT &&
    baseBlockAt(subInv, "nova", 20, CEIL_Y + 1, 20) === BLOCK.VAULT);
  check("vault: inverted — the vault caps the barrow shaft too (no hole over the shaft)",
    baseBlockAt(subInv, "nova", 45, CEIL_Y, 31) === BLOCK.VAULT &&
    baseBlockAt(subInv, "nova", 45, CEIL_Y + 1, 31) === BLOCK.VAULT);
  check("vault: the cap is judged before the dungeon carve in baseBlockAt",
    world.indexOf("The vault caps every column alike") > -1 &&
    world.indexOf("The vault caps every column alike") <
      world.indexOf("The dungeon is carved into Nova Prime"));

  // The console's class joins the touch exemptions (defect 1): a
  // panel's touches are the panel's, never the world's — without
  // this the world-touch handler preventDefaults every tap on the
  // console and its close button's click never exists.
  check("touch: TOUCH_UI exempts the console and the panels of its class",
    game.includes("#nfconsole, #speedrun, #menu") &&
    game.includes('#audio-panel, #ideas";'));
  // The console's controls answer touch first (tBtn idiom); the
  // stop control exists in the page and the build.
  check("touch: the console's close, toggle, and stop answer touchstart",
    game.includes('tBtn("nfconsole-close", () => nfConsoleToggle(false));') &&
    game.includes('tBtn("btn-console", () => nfConsoleToggle());') &&
    game.includes('tBtn("nfconsole-stop"'));
  check("touch: the stop control stands in the console row, page and build alike",
    page.includes('id="nfconsole-stop"') && html.includes('id="nfconsole-stop"'));
  // Cancellation: closing the console cancels; the walk probe
  // honors the flag; runall stops between legs; each leg names
  // the outcome; the stop control shows exactly while busy.
  check("console: closing the console cancels a running probe",
    game.includes("if (!want && nfCon.busy) nfCon.cancel = true;"));
  check("console: the walk probe honors the cancel flag",
    game.includes("if (nfCon.cancel) { finish({ cancelled: true }); return; }"));
  check("console: runall stops between legs when cancelled",
    game.includes('if (!nfCon.cancel) results.push(["rift-veer", await nfLegVeer(20)]);') &&
    game.includes('if (!nfCon.cancel) results.push(["rift-slope", await nfLegSlope()]);'));
  check("console: every leg reports a cancellation as its own outcome",
    (game.match(/STOPPED  the walk was cancelled from the console\./g) || []).length === 3);
  check("console: the stop control shows while a probe runs and hides after",
    game.includes('$("nfconsole-stop").style.display = "";') &&
    game.includes('$("nfconsole-stop").style.display = "none";'));
  // The pads answer a touch directly: the same playNote call the
  // click makes, wired a second time for touchstart.
  check("touch: the note pads play through touchstart as well as click",
    (game.match(/playNote\(Number\(el\.dataset\.note\) \+ 1\)/g) || []).length === 2 &&
    game.includes('el.addEventListener("touchstart", (e) => {'));

  // Rifts stand on the gravity surface (IP-1): standFeetY /
  // surfaceStandY decide by the realm's own gravity; both link
  // landings step out through surfaceStandY; the ring hangs
  // toward the fox's body on either surface.
  check("rift: standFeetY names the vault plane for an inverted realm",
    game.includes("return CEIL_Y - 1;") &&
    game.includes("? feetY : standFeetY(realmId, x, z),"));
  check("rift: surfaceStandY lands a step-out on the vault, not the ground",
    game.includes("return CEIL_Y - 0.01;") &&
    (game.match(/surfaceStandY\(/g) || []).length === 3);
  check("rift: the ring's center rides toward the fox's body on either surface",
    game.includes("const ringY = end.feetY + 1 + 0.65 *"));

  // The Deep Stone's reach is the body's span (IP-2), at the quest
  // check and the speedrun finish alike.
  check("quest: reach is judged against the body's span, quest and speedrun alike",
    (game.match(/state\.gravDir \* PHEIGHT/g) || []).length === 2);

  // Small-screen layout: the media query stands in page and build.
  check("layout: the small-screen corrections stand in page and build",
    page.includes("@media (max-width: 680px)") && html.includes("@media (max-width: 680px)") &&
    page.includes("#nfconsole { left: 6px; right: 6px; width: auto; top: 6px; z-index: 40; }"));
}

// --- EE 1034: wormhole tunnels — records, resolver, geometry --------------
{
  const endA = { realmId: "nova", mx: 20, mz: 8, dx: 1, dz: 0, floorY: 12, gdir: 1 };
  const endB = { realmId: "ashfall", mx: 30, mz: 40, dx: 0, dz: -1, floorY: 9, gdir: 1 };
  const t1 = makeTunnel("fox-one", endA, endB, 1000);
  const parsed = parseTunnelScroll(tunnelLine(t1));
  check("a craft line parses back to its tunnel",
    parsed.length === 1 && parsed[0].kind === "tun" &&
    parsed[0].tunnel.crafter === "fox-one" && parsed[0].tunnel.ends.a.mx === 20 &&
    parsed[0].tunnel.ends.b.realmId === "ashfall" && parsed[0].ts === 1000);
  const t2 = makeTunnel("fox-one", { ...endA, mx: 44 }, endB, 2000);
  const t3 = makeTunnel("fox-two", endA, endB, 1500);
  const records = [...parseTunnelScroll(tunnelLine(t1)),
                   ...parseTunnelScroll(tunnelLine(t3)),
                   ...parseTunnelScroll(tunnelLine(t2))];
  const standing = resolveTunnels(records);
  check("craft A->B twice: only the second stands for that crafter",
    standing.filter((t) => t.crafter === "fox-one").length === 1 &&
    standing.find((t) => t.crafter === "fox-one").ends.a.mx === 44);
  check("another crafter's A->B stands alongside",
    standing.some((t) => t.crafter === "fox-two" && t.ends.a.mx === 20));
  const retired = resolveTunnels([...records,
    ...parseTunnelScroll(tunnelRetireLine("fox-one", "nova", "ashfall", 3000))]);
  check("a retirement record removes only the crafter's own tunnel",
    retired.filter((t) => t.crafter === "fox-one").length === 0 &&
    retired.some((t) => t.crafter === "fox-two"));
  check("a standing tunnel serves a ring planted at its mouth",
    standing.some((t) => t.crafter === "fox-two" && tunnelServes(t, "nova", "ashfall", 20.5, 8.5)));
  check("no tunnel serves a ring far from every standing mouth",
    !standing.some((t) => tunnelServes(t, "nova", "ashfall", 90.5, 90.5)));

  // EE 1119: serving a LINK requires BOTH ends to match. A tunnel
  // whose only one end matches is not served to the link.
  const linkA = { realmId: "nova", x: 20.5, z: 8.5 };
  const linkB = { realmId: "ashfall", x: 30.5, z: 40.5 };
  check("EE 1119: a tunnel matching BOTH link ends is served to the link",
    tunnelServesLink(t1, linkA, linkB) === true);
  check("EE 1119: a tunnel whose only ONE end matches is NOT served to the link",
    tunnelServes(t1, "nova", "ashfall", 20.5, 8.5) === true &&
    tunnelServesLink(t1, linkA, { realmId: "ashfall", x: 90.5, z: 90.5 }) === false &&
    tunnelServesLink(t1, { realmId: "nova", x: 90.5, z: 90.5 }, linkB) === false);
  // The slope/Arrival coincidence: the slope link's Ashfall end
  // (8.5, 11.9) sits within two blocks of the Arrival tunnel's
  // Ashfall mouth (8, 11) (dist^2 0.16), but the Arrival tunnel's
  // Nova end (8, 5) is far from the slope ring (10.5, 26.1), so
  // the coincidence must resolve to the slope link's own tunnel
  // (Nova mouth (10, 26), floorY 16), never the Arrival tunnel.
  const arrivalTun = makeTunnel("fox-arrival",
    { realmId: "ashfall", mx: 8, mz: 11, dx: 0, dz: 1, floorY: 17, gdir: 1 },
    { realmId: "nova", mx: 8, mz: 5, dx: 0, dz: 1, floorY: 17, gdir: 1 }, 4000);
  const slopeTun = makeTunnel("fox-slope",
    { realmId: "ashfall", mx: 8, mz: 11, dx: 0, dz: 1, floorY: 16, gdir: 1 },
    { realmId: "nova", mx: 10, mz: 26, dx: 0, dz: 1, floorY: 16, gdir: 1 }, 5000);
  const slopeA = { realmId: "ashfall", x: 8.5, z: 11.9 };
  const slopeB = { realmId: "nova", x: 10.5, z: 26.1 };
  check("EE 1119: the Arrival tunnel single-end-matches the slope link's Ashfall end",
    tunnelServes(arrivalTun, "ashfall", "nova", slopeA.x, slopeA.z) === true);
  check("EE 1119: the Arrival tunnel is NOT served to the slope link (Nova ends far apart)",
    tunnelServesLink(arrivalTun, slopeA, slopeB) === false);
  check("EE 1119: the slope/Arrival coincidence resolves to the link's own tunnel",
    tunnelServesLink(slopeTun, slopeA, slopeB) === true &&
    [arrivalTun, slopeTun].find((t) => tunnelServesLink(t, slopeA, slopeB)) === slopeTun);
  const gameSrc1119 = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  check("EE 1119: game serving uses tunnelServesLink at both call sites, no either-end OR remains",
    (gameSrc1119.match(/tunnelServesLink\(t, link\.a, link\.b\)/g) || []).length === 2 &&
    !gameSrc1119.includes("tunnelServes(t, link.a.realmId") &&
    !gameSrc1119.includes("tunnelServes(t, a.realmId, b.realmId, link.a.x"));

  // The bore in generation: real blocks, the home realm's lining.
  const s = new Subspace();
  s.getScroll("nova", 1, 0);
  const changed = s.applyTunnels([t1]);
  check("applyTunnels reports the new bore", changed.includes(t1.key));
  check("applying the same standing set again changes nothing",
    s.applyTunnels([t1]).length === 0);
  const chunk = genChunk(s, "nova", 1, 0);
  const at = (x, y, z) => chunkBlock(chunk, x - 16, y, z);
  check("the bore's floor is lining, at the mouth's ground",
    at(22, 12, 8) === BLOCK.STONE);
  check("the bore's interior is air the fox walks",
    at(22, 13, 8) === BLOCK.AIR && at(22, 14, 8) === BLOCK.AIR);
  check("the bore's wall stands at its side", at(22, 13, 10) === BLOCK.STONE);
  check("a crystal course rings the bore every five blocks",
    at(25, 13, 10) === BLOCK.CRYSTAL);
  check("past the bore's end the world is its own again",
    tunnelBlockAt(t1, "nova", 20 + TUNNEL_LEN + 2, 13, 8) === null);
  // Permanence: build -> record -> reload equivalence.
  const scrollText = [...s.tunnels.values()].map(tunnelLine).join("\n");
  const s2 = new Subspace();
  s2.getScroll("nova", 1, 0);
  s2.applyTunnels(resolveTunnels(parseTunnelScroll(scrollText)));
  check("build -> record -> reload: the same tunnel stands",
    s2.tunnels.size === 1 && [...s2.tunnels.values()][0].key === t1.key);
  const prog = tunnelProgress(t1.ends.a, 20 + TUNNEL_LEN - 2 + 0.5, 8.5);
  check("progress reads the walk: far along, on the line",
    !!prog && prog.along === TUNNEL_LEN - 2 && prog.lat === 0);
  // Inverted: the bore hangs from the vault (surface course at
  // floorY + 1 — feet rest at feetY + 1 on either surface).
  const tInv = makeTunnel("fox-one",
    { realmId: "nova", mx: 20, mz: 8, dx: 1, dz: 0, floorY: 30, gdir: -1 }, endB, 5000);
  check("an inverted bore's surface course rides the vault",
    tunnelBlockAt(tInv, "nova", 22, 31, 8) === BLOCK.STONE);
  check("an inverted bore's interior opens away from the vault",
    tunnelBlockAt(tInv, "nova", 22, 30, 8) === BLOCK.AIR &&
    tunnelBlockAt(tInv, "nova", 22, 29, 8) === BLOCK.AIR);
}

// --- EE 1034: monsters with intent -----------------------------------------
{
  const s = new Subspace();
  s.getScroll("nova", 0, 0);
  s.monsters.length = 0;
  const m = s.spawnMonster("nova", 12, 12, "surface");
  const pal = s.spawnMonster("nova", 15, 12, "surface");
  check("EE 1034: a surface thing has hp 2", m.hp === 2);
  check("the first strike wounds, wakes it, and calls the pack",
    s.strikeMonster(m) === false && m.alive && m.engaged === true &&
    pal.aggro === true);
  check("the second strike kills", s.strikeMonster(m) === true && !m.alive);

  // Roles: some surface things rise as stalkers.
  const sR = new Subspace();
  sR.getScroll("nova", 0, 0); sR.getScroll("nova", 1, 0);
  sR.monsters.length = 0;
  let stalker = null, hunter = null;
  for (let i = 0; i < 24 && !(stalker && hunter); i++) {
    const c = sR.spawnMonster("nova", 4 + (i % 12), 4 + Math.floor(i / 12), "surface");
    if (c.role === "stalker" && !stalker) stalker = c;
    if (c.role !== "stalker" && !hunter) hunter = c;
  }
  check("some surface things rise as stalkers", !!stalker && !!hunter);
  // A stalker beyond 6 cells closes one step more than a hunter.
  const place = (c, gx, gy) => { c.gx = gx; c.gy = gy; c.hx = gx; c.hy = gy; c.aggro = false; c.engaged = false; };
  place(stalker, 14, 10); place(hunter, 14, 14);
  sR.monsters = [stalker, hunter];
  sR.tick({ realmId: "nova", bx: 49, bz: 29 }); // the fox at cell (24, 14)... stalker's row first
  check("a stalker beyond reach closes two cells at a step",
    stalker.gx === 16, `gx=${stalker.gx}`);
  const sH = new Subspace();
  sH.getScroll("nova", 0, 0); sH.getScroll("nova", 1, 0);
  sH.monsters.length = 0;
  const h2 = sH.spawnMonster("nova", 14, 14, "surface");
  h2.role = "hunter"; h2.aggro = false; h2.engaged = false;
  sH.tick({ realmId: "nova", bx: 49, bz: 29 });
  check("a hunter at the same distance closes one",
    h2.gx === 15, `gx=${h2.gx}`);

  // Intercept: an aggroed thing runs to where the fox is GOING —
  // it overshoots the fox's current cell toward his next one.
  const mk = (lastCell) => {
    const sx = new Subspace();
    sx.getScroll("nova", 0, 0); sx.getScroll("nova", 1, 0);
    sx.monsters.length = 0;
    const h = sx.spawnMonster("nova", 20, 10, "surface");
    h.aggro = true; h.aggroTicks = 9999;
    sx._playerCell = { x: lastCell, y: 10 };
    sx.tick({ realmId: "nova", bx: 43, bz: 21 }); // the fox at cell (21, 10)
    return h.gx;
  };
  check("a running fox is intercepted: the hunter overshoots his cell",
    mk(19) === 22, `gx=${mk(19)}`);
  check("a standing fox is simply reached",
    mk(21) === 21, `gx=${mk(21)}`);
}


// --- EE 1088 (P-3): monsters, second pass --------------------------------------
// Behavior only: the pack paths over the world AS EDITED, remembers
// the fox's last known place and searches it, and the realm's spawns
// keep their hygiene. No stat moves — hp and damage stand as shipped.
{
  console.log("\n== EE 1088 (P-3): monsters — edited ground, pack memory, hygiene ==");
  check("P-3: stats stand as shipped (surface 2, wisp 2, guardian 6)",
    (() => {
      const s = new Subspace();
      return s.spawnMonster("nova", 5, 5, "surface").hp === 2 &&
        s.spawnMonster("nova", 5, 6, "wisp").hp === 2 &&
        s.spawnMonster("nova", 27, 19, "guardian").hp === 6;
    })());

  // The ground a monster reads.
  {
    const s = new Subspace();
    check("P-3: the unedited ground reads as generation",
      s.groundHeightAt("nova", 21, 21) === heightAt("nova", 21, 21) &&
      s.groundHeightAt("ashfall", 21, 21) === heightAt("ashfall", 21, 21));
    const bx = 21, bz = 21, h = heightAt("nova", bx, bz);
    let carved = true;
    for (let y = h; y > h - 5; y--) {
      if (!s.chiselBlock("nova", bx, y, bz).ok) carved = false;
    }
    check("P-3: a carve lowers the ground a monster reads",
      carved && s.groundHeightAt("nova", bx, bz) === h - 5,
      `ground=${s.groundHeightAt("nova", bx, bz)} h=${h}`);
    const s2 = new Subspace();
    for (let y = h + 1; y <= h + 4; y++) s2.setOverride("nova", bx, y, bz, BLOCK.STONE);
    check("P-3: placed blocks raise the ground a monster reads",
      s2.groundHeightAt("nova", bx, bz) === h + 4,
      `ground=${s2.groundHeightAt("nova", bx, bz)} h=${h}`);
    // P-1's layer, composed: the geometry record under the overrides,
    // exactly genChunk's order — installed by hand in P-1's resolved
    // shape (realm -> Map "x,y,z" -> block).
    const s3 = new Subspace();
    const gx81 = 81, gz81 = 81, h81 = heightAt("nova", gx81, gz81);
    s3.geo = new Map([["nova", new Map([[`${gx81},${h81},${gz81}`, BLOCK.AIR]])]]);
    check("P-3: the geometry record is read (a recorded carve lowers the ground)",
      s3.groundHeightAt("nova", gx81, gz81) === h81 - 1,
      `ground=${s3.groundHeightAt("nova", gx81, gz81)} h=${h81}`);
    s3.setOverride("nova", gx81, h81, gz81, BLOCK.STONE);
    check("P-3: a local override stands over the record (genChunk's order)",
      s3.groundHeightAt("nova", gx81, gz81) === h81);
  }

  // Pathing over edited ground: find a level run in the Rolling
  // Plains (plain: base 12, amp ~1.8 — the realm is nearly flat).
  const findRun = (s) => {
    for (let gy = 30; gy < 90; gy++) {
      for (let gx = 30; gx < 84; gx++) {
        const h = s.groundHeightAt("plain", gx * 2 + 1, gy * 2 + 1);
        if (h < 9) continue;
        let ok = true;
        for (let k = 0; k < 7 && ok; k++) {
          if (s.groundHeightAt("plain", (gx + k) * 2 + 1, gy * 2 + 1) !== h) ok = false;
        }
        for (const dz of [-1, 1]) {
          const ht = s.groundHeightAt("plain", (gx + 2) * 2 + 1, (gy + dz) * 2 + 1);
          if (Math.abs(ht - h) > 1) ok = false;
        }
        if (ok) return { gx, gy, h };
      }
    }
    return null;
  };
  const carveCell = (s, realm, cgx, cgy, depth) => {
    const bx = cgx * 2 + 1, bz = cgy * 2 + 1;
    const top = s.groundHeightAt(realm, bx, bz);
    let okAll = true;
    for (let y = top; y > top - depth; y--) {
      if (!s.chiselBlock(realm, bx, y, bz).ok) okAll = false;
    }
    return okAll;
  };
  {
    const s = new Subspace();
    const run = findRun(s);
    check("P-3: found a level run in the plains", !!run);
    if (run) {
      const { gx, gy } = run;
      const m = s.spawnMonster("plain", gx, gy, "surface");
      m.role = "hunter";
      let dug = true;
      for (const dz of [-1, 0, 1]) {
        if (!carveCell(s, "plain", gx + 2, gy + dz, 6)) dug = false;
      }
      check("P-3: the trench is dug (three cells, six deep)", dug);
      const player = { realmId: "plain", bx: (gx + 6) * 2 + 1, bz: gy * 2 + 1 };
      for (let i = 0; i < 12; i++) s.tick(player);
      check("P-3: a dug trench stops a pursuing monster",
        m.gx === gx + 1, `gx=${m.gx} want=${gx + 1}`);
      // Bridge it: fill the middle trench cell back to its own top.
      const bx = (gx + 2) * 2 + 1, bz = gy * 2 + 1;
      const top = heightAt("plain", bx, bz);
      for (let y = top - 6; y <= top; y++) s.setOverride("plain", bx, y, bz, BLOCK.STONE);
      check("P-3: the bridged cell reads as ground again",
        s.groundHeightAt("plain", bx, bz) === top);
      for (let i = 0; i < 16 && m.gx < gx + 3; i++) s.tick(player);
      check("P-3: a placed bridge admits the pack again",
        m.gx >= gx + 3, `gx=${m.gx}`);
    }
  }
  {
    // A single dug pit on the direct row is a trap the same way.
    const s = new Subspace();
    const run = findRun(s);
    check("P-3: found a level run for the pit", !!run);
    if (run) {
      const { gx, gy } = run;
      const m = s.spawnMonster("plain", gx, gy, "surface");
      m.role = "hunter";
      carveCell(s, "plain", gx + 2, gy, 5);
      const player = { realmId: "plain", bx: (gx + 6) * 2 + 1, bz: gy * 2 + 1 };
      for (let i = 0; i < 10; i++) s.tick(player);
      check("P-3: a dug pit traps the direct pursuit",
        m.gx === gx + 1, `gx=${m.gx} want=${gx + 1}`);
    }
  }

  // Pack memory: contact is shared; losing the fox starts a search.
  {
    const s = new Subspace();
    s.getScroll("nova", 0, 0); s.getScroll("nova", 1, 0);
    s.monsters.length = 0;
    // The share is only observable beyond the sphere (inside it,
    // every packmate has its own contact), so the hunter's contact
    // is a grudge: an aggroed thing hunts from ANY range (EE 1023).
    // The fox is 80 cells west; the packmate stands 7 cells behind
    // the hunter's post-step position — inside the pack radius,
    // outside the strike-aggro radius that would wake it directly.
    const m2 = s.spawnMonster("nova", 11, 10, "surface"); // no contact of its own
    const m1 = s.spawnMonster("nova", 19, 10, "surface"); // aggroed: contact at any range
    m1.role = "hunter"; m2.role = "hunter";
    m1.aggro = true; m1.aggroTicks = 9999;
    s.tick({ realmId: "nova", bx: -121, bz: 21 }); // the fox at cell (-61, 10)
    check("P-3: contact writes the hunter's last known place",
      m1.mode === "hunt" && m1.lastKnown && m1.lastKnown.x === -61 && m1.lastKnown.y === 10,
      `mode=${m1.mode} lk=${JSON.stringify(m1.lastKnown)}`);
    check("P-3: the pack is told — a packmate beyond the sphere shares the place",
      m2.mode === "hunt" && m2.lastKnown && m2.lastKnown.x === -61,
      `mode=${m2.mode} lk=${JSON.stringify(m2.lastKnown)}`);
    m1.aggro = false; m1.aggroTicks = 0; // the grudge cools (EE 1023's own pin idiom)
    const far = { realmId: "nova", bx: 401, bz: 21 }; // the fox at cell (200, 10): gone
    s.tick(far);
    check("P-3: a lost pack searches the last known place",
      m1.mode === "search" && m2.mode === "search" &&
      s.wal.some((w) => w.op === "search"),
      `m1=${m1.mode} m2=${m2.mode}`);
    for (let i = 0; i < SEARCH_TICKS + 60; i++) s.tick(far);
    check("P-3: the search gives up — memory clears, the dispersal is written",
      m1.mode === null && m1.lastKnown === null &&
      s.wal.some((w) => w.op === "give-up"),
      `mode=${m1.mode}`);
    for (let i = 0; i < 200; i++) s.tick(far);
    check("P-3: after giving up, the thing walks home to where it rose",
      m1.gx === m1.hx && m1.gy === m1.hy, `at=${m1.gx},${m1.gy} home=${m1.hx},${m1.hy}`);
  }

  // Hygiene: rises land beyond sight; the realm's bound caps them.
  {
    const s = new Subspace();
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) s.getScroll("nova", sx, sy);
    s.monsters.length = 0;
    const near = { realmId: "nova", bx: 25, bz: 25 }; // the fox at cell (12, 12)
    let risen = null, walBefore = 0;
    for (let i = 0; i < 600 && !risen; i++) {
      walBefore = s.wal.length;
      const idsBefore = new Set(s.monsters.map((m) => m.id));
      s.tick(near);
      const rose = s.wal.slice(walBefore).some((w) => w.op === "rise");
      if (rose) risen = s.monsters.find((m) => !idsBefore.has(m.id)) || null;
    }
    check("P-3: a rise lands beyond the farthest sight (34–44 cells)",
      !!risen && (() => {
        const d = Math.hypot(risen.gx - 12, risen.gy - 12);
        return d >= RISE_MIN_CELLS - 1 && d <= 45;
      })(),
      risen ? `at=${risen.gx},${risen.gy}` : "no rise in 600 ticks");
    const s2 = new Subspace();
    s2.getScroll("nova", 0, 0);
    s2.monsters.length = 0;
    for (let i = 0; i < REALM_SURFACE_CAP; i++) {
      const mm = s2.spawnMonster("nova", 200, 200, "surface");
      mm.engaged = true; // engaged things never sink (EE 995) — the realm stays full
    }
    for (let i = 0; i < 400; i++) s2.tick(near);
    check("P-3: the realm's standing bound caps the rise (no accumulation)",
      !s2.wal.some((w) => w.op === "rise") && s2.monsters.length === REALM_SURFACE_CAP,
      `monsters=${s2.monsters.length}`);
  }
}

// --- EE 1034: the flight gate ------------------------------------------------
{
  const free = newEconomyState();
  const paid = newEconomyState();
  paid.entitlement.status = "paid";
  check("flight: a free fox is refused", flightUnlocked(free, false).ok === false);
  check("flight: a paid fox flies, via paid", flightUnlocked(paid, false).via === "paid");
  check("flight: a dragon-slayer flies, via dragon", flightUnlocked(free, true).via === "dragon");
  check("flight: paid names it when both are true", flightUnlocked(paid, true).via === "paid");
  const s = new Subspace();
  check("the dragon flag starts unraised", s.dragonKilled === false);
  s.setDragonKilled(true);
  check("raising the dragon flag is written in the log",
    s.dragonKilled === true && s.wal.some((w) => w.op === "dragon"));
}

// --- EE 1034: item purpose + view-side wiring ----------------------------------
{
  for (const kind of ["sword", "lance", "swift", "bright", "ward"]) {
    check(`item purpose: the ${kind} carries a use line`,
      typeof ITEM_DEFS[kind].use === "string" && ITEM_DEFS[kind].use.length > 10);
  }
  check("the sword's use names the swing and its two-swing kill", ITEM_DEFS.sword.use.includes("Swung") && ITEM_DEFS.sword.use.includes("two landed swings"));
  const game = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("./page3.html", import.meta.url), "utf8");
  check("the view composes the how from live bindings",
    game.includes("function itemUseLine(def)") && game.includes("keyName(BIND.equip)"));
  check("the field guide stands in the board",
    game.includes("renderFieldGuide()") && page.includes('id="board-guide"'));
  check("the purse stands in the page and minting is seen",
    page.includes('id="purse"') && game.includes("coinFloater") && game.includes("pursefill"));
  check("battle cues are wired from the sfx kit",
    game.includes("battleIn()") && game.includes("battleDrone") && game.includes("function battleStep(now)"));
  check("flight is a remappable binding, default H",
    game.includes('{ id: "fly", label: "Fly", def: "KeyH" }'));
  check("EE 1037: the dash is a remappable binding, default J",
    game.includes('{ id: "dash", label: "Dash", def: "KeyJ" }'));
  check("EE 1037: the Heart is drawn once, braided, from Will's material",
    game.includes("function heartCanvas()") && game.includes("#a14a56") &&
    game.includes("#f9dd74") && game.includes("heartArtProfile"));
  check("EE 1037: the strike answers to the Heart's gate",
    game.includes("guardianStrikeDamage(best, { damage, charged })"));
  check("EE 1037: the skills stand on the HUD and in the guide",
    page.includes('id="skills"') && game.includes("function updateSkillsLine") &&
    game.includes("The Ward, turned outward"));
  check("EE 1037: the Shadow's slam lands in the view",
    game.includes("function stepGuardianSlam") && game.includes("slam()"));
  check("the tunnel transit is walked, and the warp is gone",
    game.includes("tunnelProgress") && game.includes("ensureTunnelsForLink") &&
    !game.includes("buildWarpPass") && !game.includes("uWarp"));
}


// --- P-1: mutable subspace geometry — records, resolver, refusals --------
{
  // The grammar round-trips: a carve line and a raise line.
  const carve = geometryLine("ashfall", 30, 12, 30, BLOCK.AIR, "fox-one", 1234);
  check("P-1: a geometry line is one append-only record per cell",
    carve === "geo|ashfall|30,12,30|0|fox-one|1234");
  const parsed = parseGeometryScroll(carve + "\n" +
    geometryLine("ashfall", 30, 16, 30, BLOCK.STONE, "fox-two", 2000));
  check("P-1: carve and raise lines parse back to their records",
    parsed.length === 2 && parsed[0].block === BLOCK.AIR &&
    parsed[0].crafter === "fox-one" && parsed[1].block === BLOCK.STONE &&
    parsed[1].ts === 2000);
  // The defensive parse: junk never becomes geometry.
  const junk = parseGeometryScroll([
    "geo|bogus|1,2,3|0|fox|1",          // unknown realm
    "geo|ashfall|1,64,3|0|fox|1",       // y at the world's ceiling
    "geo|ashfall|1,2,3|99|fox|1",       // unknown block id
    "geo|ashfall|1,2,3|0||1",           // no crafter
    "geo|ashfall|1,2,3|0|fox|later",    // no timestamp
    "geo|ashfall|1,2|0|fox|1",          // a cell is three numbers
    "tun|fox|1|a|b",                    // another scroll's line
  ].join("\n"));
  check("P-1: malformed lines never parse into geometry", junk.length === 0);

  // Replay: last record in scroll order is the cell's truth.
  const res = resolveGeometry([
    ...parseGeometryScroll(geometryLine("ashfall", 30, 12, 30, BLOCK.AIR, "fox-one", 100)),
    ...parseGeometryScroll(geometryLine("ashfall", 30, 12, 30, BLOCK.STONE, "fox-one", 200)),
    ...parseGeometryScroll(geometryLine("ashfall", 31, 12, 30, BLOCK.AIR, "fox-two", 150)),
  ]);
  check("P-1: a crafter's later edit supersedes their earlier one",
    res.get("ashfall").get("30,12,30") === BLOCK.STONE);
  check("P-1: another crafter's cell stands alongside in the same realm",
    res.get("ashfall").get("31,12,30") === BLOCK.AIR);
  const order = resolveGeometry([
    ...parseGeometryScroll(geometryLine("nova", 5, 10, 5, BLOCK.AIR, "fox-two", 300)),
    ...parseGeometryScroll(geometryLine("nova", 5, 10, 5, BLOCK.STONE, "fox-one", 100)),
  ]);
  check("P-1: cross-player conflicts resolve by record order, not by clock",
    order.get("nova").get("5,10,5") === BLOCK.STONE);

  // The record in generation: base world + replayed edits.
  const s = new Subspace();
  s.getScroll("ashfall", 0, 0);
  const h = heightAt("ashfall", 30, 30);
  const before = genChunk(s, "ashfall", 1, 1);
  const at = (data, x, y, z) => chunkBlock(data, x - 16, y, z - 16);
  check("P-1: the probe cell starts as standing ground",
    at(before, 30, h, 30) !== BLOCK.AIR && at(before, 30, h + 4, 30) === BLOCK.AIR);
  const changed = s.applyGeometry(resolveGeometry(parseGeometryScroll(
    geometryLine("ashfall", 30, h, 30, BLOCK.AIR, "fox-one", 100) + "\n" +
    geometryLine("ashfall", 30, h + 4, 30, BLOCK.STONE, "fox-two", 200))));
  check("P-1: applyGeometry reports the changed cells",
    changed.includes(`ashfall|30,${h},30`) && changed.includes(`ashfall|30,${h + 4},30`));
  check("P-1: applying the same record again changes nothing",
    s.applyGeometry(resolveGeometry(parseGeometryScroll(
      geometryLine("ashfall", 30, h, 30, BLOCK.AIR, "fox-one", 100) + "\n" +
      geometryLine("ashfall", 30, h + 4, 30, BLOCK.STONE, "fox-two", 200)))).length === 0);
  const after = genChunk(s, "ashfall", 1, 1);
  check("P-1: a carved cell renders as air in a fresh generation",
    at(after, 30, h, 30) === BLOCK.AIR);
  check("P-1: a raised cell renders as its block in a fresh generation",
    at(after, 30, h + 4, 30) === BLOCK.STONE);
  // Permanence: edit -> record -> reload equivalence.
  const s2 = new Subspace();
  s2.getScroll("ashfall", 0, 0);
  s2.applyGeometry(resolveGeometry(parseGeometryScroll(
    geometryLine("ashfall", 30, h, 30, BLOCK.AIR, "fox-one", 100))));
  check("P-1: edit -> record -> reload: the same carve stands",
    at(genChunk(s2, "ashfall", 1, 1), 30, h, 30) === BLOCK.AIR);

  // The write-time playability check: refusals name themselves.
  const d = DUNGEON;
  check("P-1: the Deep Stone will not shape",
    geoEditRefusal("nova", d.deepStone.x, d.deepStone.y, d.deepStone.z, BLOCK.AIR) === "deepstone");
  check("P-1: the Deep Stone's pedestal will not shape",
    geoEditRefusal("nova", d.deepStone.x, d.deepStone.y - 1, d.deepStone.z, BLOCK.AIR) === "deepstone");
  check("P-1: the Hall's structure will not shape",
    geoEditRefusal("nova", d.x0 + 4, d.floorY, d.z0 + 4, BLOCK.AIR) === "hall");
  check("P-1: the Hall's interior air will not fill",
    geoEditRefusal("nova", d.x0 + 4, d.floorY + 3, d.z0 + 4, BLOCK.STONE) === "hall");
  check("P-1: a solid fill in the entrance shaft is a sealing, refused by name",
    geoEditRefusal("nova", d.shaftX, d.ceilY + 3, d.shaftZ, BLOCK.STONE) === "sealed-route");
  check("P-1: carving the shaft's walls seals nothing and stands",
    geoEditRefusal("nova", d.shaftX + 1, d.ceilY + 3, d.shaftZ, BLOCK.AIR) === null);
  const ah = heightAt("ashfall", ARRIVAL.ashfall.x, ARRIVAL.ashfall.z);
  check("P-1: the arrival ground will not shape",
    geoEditRefusal("ashfall", ARRIVAL.ashfall.x, ah, ARRIVAL.ashfall.z, BLOCK.AIR) === "spawn" &&
    geoEditRefusal("ashfall", ARRIVAL.ashfall.x, ah + 1, ARRIVAL.ashfall.z, BLOCK.STONE) === "spawn");
  check("P-1: ordinary ground far from every protection shapes freely",
    geoEditRefusal("ashfall", 30, heightAt("ashfall", 30, 30), 30, BLOCK.AIR) === null &&
    geoEditRefusal("nova", 100, heightAt("nova", 100, 100), 100, BLOCK.AIR) === null);
}


// --- P-2: digging with a point — material, yield, sale ----------------------
{
  // Every type the chisel can break has a material; the two types
  // that refuse by name (bedrock, deepstone) and the override-only
  // scar have none.
  const breakable = [BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.WOOD,
    BLOCK.LEAF, BLOCK.ASH, BLOCK.REDROCK, BLOCK.BASALT, BLOCK.EMBER,
    BLOCK.BRICK, BLOCK.CRYSTAL, BLOCK.VAULT, BLOCK.SANDSTONE,
    BLOCK.MOSS, BLOCK.SHALE];
  check("P-2: every breakable block type is a material",
    breakable.every((b) => materialDef(b) && materialDef(b).flux > 0));
  check("P-2: bedrock, deepstone and scar are not materials",
    !materialDef(BLOCK.BEDROCK) && !materialDef(BLOCK.DEEPSTONE) &&
    !materialDef(BLOCK.SCAR));
  check("P-2: rates are whole flux, richest is crystal at 20",
    Object.values(MATERIAL_DEFS).every((d) => Number.isInteger(d.flux) && d.flux >= 1) &&
    MATERIAL_DEFS[BLOCK.CRYSTAL].flux === 20 &&
    Math.max(...Object.values(MATERIAL_DEFS).map((d) => d.flux)) === 20);

  // The yield: counts rise by type; unknown types never land.
  const eco = newEconomyState();
  addMaterial(eco, BLOCK.STONE, 3);
  addMaterial(eco, BLOCK.WOOD, 1);
  addMaterial(eco, BLOCK.BEDROCK, 5); // refused type: no yield
  check("P-2: the yield lands by type, refused types never land",
    materialCount(eco, BLOCK.STONE) === 3 &&
    materialCount(eco, BLOCK.WOOD) === 1 &&
    materialCount(eco, BLOCK.BEDROCK) === 0);
  check("P-2: heldMaterials reads the pack in def order",
    heldMaterials(eco).map((m) => m.block).join(",") ===
    [BLOCK.STONE, BLOCK.WOOD].join(","));

  // The sale: exact flux at the recorded rate, count -> flux once.
  const before = eco.tokens;
  const sale = sellMaterial(eco, BLOCK.STONE, 2);
  check("P-2: a sale pays count x the recorded rate, exactly once",
    sale.ok && sale.gained === 2 * MATERIAL_DEFS[BLOCK.STONE].flux &&
    eco.tokens === before + sale.gained &&
    materialCount(eco, BLOCK.STONE) === 1 &&
    eco.lifetime.materialsSold === 2);
  const sellAll = sellMaterial(eco, BLOCK.WOOD, "all");
  check("P-2: sell-all drains the type and pays in full",
    sellAll.ok && sellAll.count === 1 && materialCount(eco, BLOCK.WOOD) === 0 &&
    !("4" in eco.materials));
  check("P-2: a sale with nothing held is refused, purse untouched",
    !sellMaterial(eco, BLOCK.CRYSTAL, 1).ok &&
    !sellMaterial(eco, BLOCK.STONE, 0).ok && eco.tokens === before + sale.gained + sellAll.gained);

  // Persistence: the pack rides with the purse's state, sanitised.
  addMaterial(eco, BLOCK.BRICK, 7);
  const back = loadEconomyState(JSON.parse(JSON.stringify(eco)));
  check("P-2: the pack survives the purse's save/load round-trip",
    materialCount(back, BLOCK.BRICK) === 7 &&
    back.lifetime.materialsSold === eco.lifetime.materialsSold);
  const dirty = loadEconomyState({ materials: { 3: 4, 99: 9, 4: -2, 5: 0.5 } });
  check("P-2: a loaded pack drops unknown types and bad counts",
    materialCount(dirty, BLOCK.STONE) === 4 &&
    Object.keys(dirty.materials).length === 1);

  // Placing speaks Feature 1's grammar: a place line resolves in
  // the geometry replay, and a later carve line takes the cell back.
  const placed = resolveGeometry(parseGeometryScroll(
    geometryLine("ashfall", 40, 20, 40, BLOCK.STONE, "fox-one", 100)));
  check("P-2: a place line is a geometry record like any other",
    placed.get("ashfall").get("40,20,40") === BLOCK.STONE);
  const carvedBack = resolveGeometry(parseGeometryScroll(
    geometryLine("ashfall", 40, 20, 40, BLOCK.STONE, "fox-one", 100) + "\n" +
    geometryLine("ashfall", 40, 20, 40, BLOCK.AIR, "fox-two", 200)));
  check("P-2: a later carve line takes a placed cell back",
    carvedBack.get("ashfall").get("40,20,40") === BLOCK.AIR);

  // The yield judge (EE 1101 fix): what you see break is what you
  // carry, judged by the block that STANDS at the cell — the
  // geometry record's placed block wins over the base buried
  // under it; silence (or a recorded carve) leaves the base judge.
  const sj = new Subspace();
  sj.getScroll("ashfall", 0, 0);
  const jh = heightAt("ashfall", 30, 30);
  const jBase = baseBlockAt(sj, "ashfall", 30, jh, 30);
  check("P-2: with no record, the yield judge names the base block",
    (() => { const j = chiselYield(sj, "ashfall", 30, jh, 30);
      return !j.placed && j.block === jBase && jBase !== BLOCK.AIR; })());
  sj.applyGeometry(resolveGeometry(parseGeometryScroll(
    geometryLine("ashfall", 30, jh, 30, BLOCK.CRYSTAL, "fox-one", 100) + "\n" +
    geometryLine("ashfall", 30, jh + 4, 30, BLOCK.BRICK, "fox-one", 110))));
  check("P-2: a placed block over base-solid ground yields the placed type",
    (() => { const j = chiselYield(sj, "ashfall", 30, jh, 30);
      return j.placed && j.block === BLOCK.CRYSTAL && jBase !== BLOCK.CRYSTAL; })());
  check("P-2: a placed block over base air yields the placed type",
    (() => { const j = chiselYield(sj, "ashfall", 30, jh + 4, 30);
      return j.placed && j.block === BLOCK.BRICK &&
        baseBlockAt(sj, "ashfall", 30, jh + 4, 30) === BLOCK.AIR; })());
  sj.applyGeometry(resolveGeometry(parseGeometryScroll(
    geometryLine("ashfall", 30, jh, 30, BLOCK.AIR, "fox-two", 200))));
  check("P-2: a carved-away cell falls back to the base judge",
    (() => { const j = chiselYield(sj, "ashfall", 30, jh, 30);
      return !j.placed && j.block === jBase; })());
  // Record and pack agree after a carve-back: the replayed record
  // stands AIR at the cell, and the pack holds exactly the placed
  // type the judge named — never the buried base type.
  const sj2 = new Subspace();
  sj2.getScroll("ashfall", 0, 0);
  sj2.applyGeometry(resolveGeometry(parseGeometryScroll(
    geometryLine("ashfall", 30, jh, 30, BLOCK.CRYSTAL, "fox-one", 100))));
  const ecoJ = newEconomyState();
  const j2 = chiselYield(sj2, "ashfall", 30, jh, 30);
  if (j2.placed) addMaterial(ecoJ, j2.block, 1);
  const afterBack = resolveGeometry(parseGeometryScroll(
    geometryLine("ashfall", 30, jh, 30, BLOCK.CRYSTAL, "fox-one", 100) + "\n" +
    geometryLine("ashfall", 30, jh, 30, BLOCK.AIR, "fox-one", 200)));
  check("P-2: after a carve-back the record stands AIR and the pack holds the placed type",
    afterBack.get("ashfall").get(`30,${jh},30`) === BLOCK.AIR &&
    materialCount(ecoJ, BLOCK.CRYSTAL) === 1 && materialCount(ecoJ, jBase) === 0);
}
// =====================================================================
// P-4 — FIGHT SKILLS, TIER 2 (EE 1087 batch, Feature 4). Tier 1 drew
// on the fox; tier 2 draws each skill from a world system. The pure
// arithmetic is world.js's and is pinned here as numbers; the
// disciplines that are not numbers (the feint writes NOTHING; the
// Shadow is never snared; the strike writes through P-1's path) are
// pinned against the view's source, in the strike-hint idiom.
// =====================================================================
{
  // --- the shaping strike's gate, at its edges ----------------------
  check("P-4: the shaping strike answers at once, the first time",
    shapeStrikeAllowed(100000, 0, 0, 0) === true);
  check("P-4: inside the gather, the shaping strike waits",
    shapeStrikeAllowed(100000 + SHAPE_STRIKE_CD_MS - 1, 100000, 0, 0) === false);
  check("P-4: at the gather's end, the shaping strike answers",
    shapeStrikeAllowed(100000 + SHAPE_STRIKE_CD_MS, 100000, 0, 0) === true);
  check("P-4: the window's cap holds inside the window",
    shapeStrikeAllowed(100000 + SHAPE_STRIKE_CD_MS, 100000, 99000,
      SHAPE_STRIKE_WINDOW_MAX) === false);
  check("P-4: a spent window frees the strike again",
    shapeStrikeAllowed(99000 + SHAPE_STRIKE_WINDOW_MS, 0, 99000,
      SHAPE_STRIKE_WINDOW_MAX) === true);
  check("P-4: the strike's whole window is a small share of the gateway's minute",
    SHAPE_STRIKE_WINDOW_MAX < 115 && SHAPE_STRIKE_CD_MS >= 1000);

  // --- the feint's pull: both gravities, both states -----------------
  const down = feintAccel(1, 0.6, -0.8, false);
  check("P-4: unfeinted, gravity is the standing term and nothing leans",
    down.ax === 0 && down.az === 0 && down.ay === -23);
  const fDown = feintAccel(1, 0.6, -0.8, true);
  check("P-4: the feint quarters the pull and lends it sideways, toward the dodge",
    fDown.ay === -23 * FEINT_GRAV_SCALE &&
    fDown.ax === 0.6 * FEINT_BIAS && fDown.az === -0.8 * FEINT_BIAS);
  const fUp = feintAccel(-1, 0.6, -0.8, true);
  check("P-4: inverted, the feint hangs toward the ceiling — the bias follows the realm's down",
    fUp.ay === 23 * FEINT_GRAV_SCALE && fUp.ax === fDown.ax && fUp.az === fDown.az);
  check("P-4: a still feint leans nowhere, but still hangs",
    feintAccel(1, 0, 0, true).ax === 0 &&
    feintAccel(1, 0, 0, true).ay === -23 * FEINT_GRAV_SCALE);

  // --- the feint writes NOTHING --------------------------------------
  {
    const s = new Subspace();
    s.getScroll("ashfall", 0, 0, true);
    const walBefore = s.wal.length, scrollsBefore = s.scrolls.size;
    let acc = 0;
    for (let i = 0; i < 1000; i++) {
      feintAccel(i % 2 ? 1 : -1, 0.3, -0.4, i % 3 !== 0);
      shapeStrikeAllowed(i * 1000, 0, 0, i % 40);
      const [, a] = snareStepSplit(acc, 2); acc = a;
    }
    check("P-4: a thousand feints write nothing — the wal and the scroll set stand as they were",
      s.wal.length === walBefore && s.scrolls.size === scrollsBefore);
    const game = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
    const feintBody = game.match(/function tryFeint\(\) \{[\s\S]*?\n\}/);
    check("P-4: the feint's verb stands in the source", !!feintBody);
    check("P-4: no write stands in the feint's body — no queue, no line, no log, no shift",
      !!feintBody && !/queueEcoLine|geometryLine|gravityShiftLine|queueIdeaLine|sub\.log\(/.test(feintBody[0]));
    check("P-4: the tier-2 bindings stand in the one store, and the dispatch consults them",
      game.includes('{ id: "feint", label: "Gravity feint", def: "KeyK" }') &&
      game.includes('{ id: "shapeStrike", label: "Shaping strike", def: "BracketRight" }') &&
      game.includes("e.code === BIND.feint") && game.includes("e.code === BIND.shapeStrike"));
    check("P-4: the shaping strike writes through the geometry path — one line, the record's own shape",
      game.includes("geometryLine(state.realm, bx, by, bz, BLOCK.AIR, playerName, Date.now())"));
    const snareBody = game.match(/function fluteSnare\(\) \{[\s\S]*?\n\}/);
    check("P-4: the flute never snares the Shadow — the skip stands in the snare's body",
      !!snareBody && snareBody[0].includes('m.kind === "guardian"'));
  }

  // --- the snare's split: exact halves, no rounding debt -------------
  let acc = 0; const seq = [];
  for (let i = 0; i < 4; i++) { const [w, a] = snareStepSplit(acc, 1); seq.push(w); acc = a; }
  check("P-4: snared, speed 1 alternates 0,1,0,1 — half rate, nothing lost to rounding",
    seq.join(",") === "0,1,0,1", seq.join(","));
  acc = 0; const seq2 = [];
  for (let i = 0; i < 3; i++) { const [w, a] = snareStepSplit(acc, 2); seq2.push(w); acc = a; }
  check("P-4: snared, speed 2 takes one step every tick", seq2.join(",") === "1,1,1", seq2.join(","));
  acc = 0; let total = 0;
  for (let i = 0; i < 20; i++) { const [w, a] = snareStepSplit(acc, 3); total += w; acc = a; }
  check("P-4: snared, speed 3 averages exactly half over twenty ticks", total === 30, `${total}`);
  check("P-4: the snare lasts a few seconds of ticks, no more",
    SNARE_TICKS >= 4 && SNARE_TICKS <= 8 && SNARE_FACTOR === 0.5);

  // --- the snare in the tick: a hunted fox is reached later ----------
  const stage = (snareTicks) => {
    const s = new Subspace();
    s.getScroll("nova", 0, 0); s.getScroll("nova", 1, 0);
    s.monsters.length = 0;
    const m = s.spawnMonster("nova", 30, 10, "surface");
    m.role = "hunter"; m.aggro = false; m.engaged = false;
    m.hx = m.gx; m.hy = m.gy;
    if (snareTicks) m.snareTicks = snareTicks;
    for (let i = 0; i < 12; i++) s.tick({ realmId: "nova", bx: 21, bz: 21 }); // the fox at cell (10, 10)
    return m.gx;
  };
  check("P-4: an unsnared hunter closes twelve cells in twelve ticks",
    stage(0) === 18, `gx=${stage(0)}`);
  check("P-4: a held snare halves the closing — six cells in twelve ticks",
    stage(999) === 24, `gx=${stage(999)}`);
  check("P-4: the snare lifts — six slowed ticks, then full speed (nine in twelve)",
    stage(SNARE_TICKS) === 21, `gx=${stage(SNARE_TICKS)}`);
}
// --- P-5: realms with character — the recorded parameters, the organic
//     dress, determinism measured, and the route proof ----------------------
{
  // The record itself: one per realm, and REALM_TERRAIN is its slice.
  check("P-5: every realm carries a generation record",
    REALMS.every((r) => REALM_GEN[r.id] && realmGenParams(r.id) === REALM_GEN[r.id]));
  check("P-5: REALM_TERRAIN is REALM_GEN's verticality slice",
    REALMS.every((r) => {
      const t = REALM_TERRAIN[r.id], g = REALM_GEN[r.id];
      return t.mode === g.mode && t.base === g.base && t.amp === g.amp &&
        t.amp2 === g.amp2 && t.s1 === g.s1 && t.s2 === g.s2 && t.step === g.step;
    }));
  check("P-5: the recorded character is the designed one (spot goldens)",
    REALM_GEN.trust.strataPeriod === 9 && REALM_GEN.ashfall.strataPeriod === 11 &&
    REALM_GEN.halycon.mix === "pale" && REALM_GEN.nova.density === 0.011 &&
    REALM_GEN.plain.amp === 1.2 && REALM_GEN.trust.amp === 17);

  // The goldens: captured from demo46 before any P-5 edit (the
  // producer report carries the table). Heights move for NO realm;
  // full columns stand for the two played realms.
  const GOLDEN_HEIGHTS = {
    nova: "97a61ca0", ashfall: "f33fa565", "ni-knight": "61daf789",
    logos: "027f0665", elven: "226f274d", orchid: "96ba9b0e",
    halycon: "0105c0b2", delta: "7e7ee111", willow: "153a093c",
    plain: "03ed7b09", trust: "79f81cf1",
  };
  const FP = Object.fromEntries(REALMS.map((r) => [r.id, realmFingerprint(r.id)]));
  check("P-5: no realm's heights move — every height fingerprint is its golden",
    REALMS.every((r) => FP[r.id].heights === GOLDEN_HEIGHTS[r.id]),
    JSON.stringify(REALMS.map((r) => [r.id, FP[r.id].heights])));
  check("P-5: Ashfall's surface stands exactly as played",
    FP.ashfall.surface === "3c9a9dc5", FP.ashfall.surface);
  const fnv = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  const columnHash = (realmId) => {
    const s = new Subspace();
    let cs = "";
    for (let z = 0; z < 32; z++) for (let x = 0; x < 32; x++) {
      const h = heightAt(realmId, x, z);
      cs += h + ":";
      for (let y = 0; y <= h + 2; y++) cs += baseBlockAt(s, realmId, x, y, z, h) + ",";
      cs += ";";
    }
    return fnv(cs);
  };
  const columnHashExclSurface = (realmId) => {
    const s = new Subspace();
    let cs = "";
    for (let z = 0; z < 32; z++) for (let x = 0; x < 32; x++) {
      const h = heightAt(realmId, x, z);
      cs += h + ":";
      for (let y = 0; y <= h + 2; y++) {
        if (y === h) continue;
        cs += baseBlockAt(s, realmId, x, y, z, h) + ",";
      }
      cs += ";";
    }
    return fnv(cs);
  };
  check("P-5: Ashfall's full columns are byte-identical to the golden; Nova's stand below and above the worn surface",
    columnHash("ashfall") === "36221ca0" && columnHashExclSurface("nova") === "38d5355c",
    `${columnHash("ashfall")} / ${columnHashExclSurface("nova")}`);

  // Character, measured: the realms part company.
  check("P-5: the eleven realms' fingerprints are pairwise distinct",
    new Set(REALMS.map((r) => `${FP[r.id].heights}/${FP[r.id].surface}`)).size === REALMS.length);
  check("P-5: Logos and Halycon surfaces have parted (the golden had them identical)",
    FP.logos.surface !== FP.halycon.surface && (FP.halycon.mix[BLOCK.SHALE] || 0) > 0,
    `logos=${FP.logos.surface} halycon=${FP.halycon.surface}`);

  // Strata: Ashfall's bands are history; Trust's are its own.
  check("P-5: Ashfall's strata bands are its historical rows, unmoved",
    Array.from({ length: 22 }, (_, y) => y).every((y) =>
      strataBand("ashfall", y) === (y % 11 === 4 || y % 11 === 5)));
  check("P-5: Trust Fall's strata run on their own period-9 phase",
    Array.from({ length: 18 }, (_, y) => y).every((y) =>
      strataBand("trust", y) === strataBand("trust", y + 9)) &&
    Array.from({ length: 22 }, (_, y) => y).some((y) =>
      strataBand("trust", y) !== strataBand("ashfall", y)));
  {
    const s = new Subspace();
    let capStands = true, strataMoved = false;
    for (let z = 0; z < 32 && capStands; z++) for (let x = 0; x < 32; x++) {
      const h = heightAt("trust", x, z);
      if (baseBlockAt(s, "trust", x, h, z, h) !== BLOCK.REDROCK ||
          baseBlockAt(s, "trust", x, h - 1, z, h) !== BLOCK.REDROCK ||
          baseBlockAt(s, "trust", x, h - 2, z, h) !== BLOCK.REDROCK) capStands = false;
      for (let y = 0; y <= h - 3; y++) {
        if (strataBand("trust", y) && !(y % 11 === 4 || y % 11 === 5) &&
            baseBlockAt(s, "trust", x, y, z, h) === BLOCK.SHALE) strataMoved = true;
      }
    }
    check("P-5: Trust's red cap stands while its deep strata move to its own phase",
      capStands && strataMoved && columnHash("trust") !== "427aec8e");
  }

  // The worn path (nova): real, confined to its corridor.
  check("P-5: the worn path runs pad-to-shaft and stops at the Hall's ground",
    hallPathWear(26, 20) && !hallPathWear(8, 40) && !hallPathWear(50, 35));
  {
    const s = new Subspace();
    let dirt = 0, offPath = 0;
    for (let z = 0; z < 64; z++) for (let x = 0; x < 64; x++) {
      const h = heightAt("nova", x, z);
      if (baseBlockAt(s, "nova", x, h, z, h) === BLOCK.DIRT) {
        dirt++;
        if (!hallPathWear(x, z)) offPath++;
      }
    }
    check("P-5: Nova's surface wears DIRT only along the worn path",
      dirt >= 25 && offPath === 0, `dirt=${dirt} offPath=${offPath}`);
  }

  // Clustering, measured against the fields themselves.
  {
    const s = new Subspace();
    let mossP = 0, mossN = 0, grassP = 0, grassN = 0, sandP = 0, sandN = 0;
    for (let z = 0; z < 64; z++) for (let x = 0; x < 64; x++) {
      const h = heightAt("elven", x, z);
      const b = baseBlockAt(s, "elven", x, h, z, h);
      const p = patchField("elven", x, z);
      if (b === BLOCK.MOSS) { mossP += p; mossN++; }
      if (b === BLOCK.GRASS) { grassP += p; grassN++; }
      if (b === BLOCK.SANDSTONE) { sandP += p; sandN++; }
    }
    check("P-5: moss gathers in the patch field's low ground, dry flats on its high ground",
      mossN > 0 && grassN > 0 && sandN > 0 &&
      mossP / mossN < grassP / grassN && sandP / sandN > grassP / grassN,
      `moss=${mossN ? (mossP / mossN).toFixed(3) : "-"} grass=${grassN ? (grassP / grassN).toFixed(3) : "-"} sand=${sandN ? (sandP / sandN).toFixed(3) : "-"}`);
  }
  {
    const s = new Subspace();
    let boulders = 0, offField = 0;
    for (let cz = 0; cz < 2; cz++) for (let cx = 0; cx < 2; cx++) {
      const data = genChunk(s, "elven", cx, cz);
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const x = cx * 16 + lx, z = cz * 16 + lz;
        const h = heightAt("elven", x, z);
        const b1 = chunkBlock(data, lx, h + 1, lz);
        if (b1 !== BLOCK.STONE && b1 !== BLOCK.SHALE) continue;
        if (chunkBlock(data, lx, h + 4, lz) === BLOCK.SANDSTONE) continue; // a standing stone, not a boulder
        boulders++;
        if (clusterField("elven", x, z) <= 0.42) offField++;
      }
    }
    check("P-5: boulders exist, and every one stands on the cluster field's ridges",
      boulders > 0 && offField === 0, `boulders=${boulders} offField=${offField}`);
  }

  // Determinism: two independent generations, byte for byte.
  check("P-5: two independent generations are byte-identical, every realm",
    REALMS.every((r) => {
      const a = genChunk(new Subspace(), r.id, 0, 0);
      const b = genChunk(new Subspace(), r.id, 0, 0);
      const c = genChunk(new Subspace(), r.id, 3, 2);
      const d = genChunk(new Subspace(), r.id, 3, 2);
      return a.every((v, i) => v === b[i]) && c.every((v, i) => v === d[i]);
    }));

  // Player edits layer over generation — and survive it.
  {
    const h = heightAt("elven", 20, 20);
    const plain = genChunk(new Subspace(), "elven", 1, 1);
    const recs = resolveGeometry(parseGeometryScroll(
      geometryLine("elven", 20, h, 20, BLOCK.AIR, "fox-p5", 10) + "\n" +
      geometryLine("elven", 20, h + 3, 20, BLOCK.BRICK, "fox-p5", 11)));
    const s1 = new Subspace(); s1.applyGeometry(recs);
    const c1 = genChunk(s1, "elven", 1, 1);
    const s2 = new Subspace(); s2.applyGeometry(recs);
    const c2 = genChunk(s2, "elven", 1, 1);
    check("P-5: geometry edits layer over generation and survive regeneration",
      chunkBlock(plain, 4, h, 4) !== BLOCK.AIR &&
      chunkBlock(c1, 4, h, 4) === BLOCK.AIR &&
      chunkBlock(c1, 4, h + 3, 4) === BLOCK.BRICK &&
      c1.every((v, i) => v === c2[i]));
  }

  // The world record: grammar, agreement, self-defence.
  {
    const lines = REALMS.map((r) => realmGenLine(r.id, "fox-p5", 100));
    const recs = parseRealmGenScroll(lines.join("\n"));
    check("P-5: a realmgen line per realm parses back, and the record agrees with itself",
      recs.length === REALMS.length && realmGenAgrees(recs));
    check("P-5: every realmgen line carries its realm's recorded key",
      recs.every((rec) => rec.key === realmGenKey(realmGenParams(rec.realmId))));
    const tampered = [...lines];
    tampered[0] = tampered[0].replace("|roll|", "|ridge|");
    check("P-5: a tampered record line breaks agreement — the record is verifiable",
      !realmGenAgrees(parseRealmGenScroll(tampered.join("\n"))));
    const junk = [
      "rgen|nowhere|roll|11|7|2.5|11|62|66|0|oak|fox|1",
      "rgen|nova|spin|11|7|2.5|11|62|66|0|oak|fox|1",
      "rgen|nova|roll|11|x|2.5|11|62|66|0|oak|fox|1",
      "rgen|nova|roll|11|7|2.5|11|62|66|0|oak||1",
      "rgen|nova|roll|11|7", "geo|nova|1,2,3|0|fox|1", "",
    ].join("\n");
    check("P-5: the realmgen parse is defensive — junk never becomes a record",
      parseRealmGenScroll(junk).length === 0);
    const twice = parseRealmGenScroll(
      realmGenLine("nova", "fox-a", 1) + "\n" +
      realmGenLine("nova", "fox-b", 2).replace("|roll|", "|ridge|"));
    check("P-5: realmgen resolves last-line-per-realm",
      resolveRealmGen(twice).get("nova").crafter === "fox-b");
  }

  // The route proof, all realms — and the Hall's own route in Nova.
  check("P-5: every realm's route proof passes — arrival stands, anchor reached",
    REALMS.every((r) => realmRouteCheck(r.id).ok),
    JSON.stringify(REALMS.map((r) => [r.id, realmRouteCheck(r.id)])));
  check("P-5: Nova's hall route runs shaft-to-stone in the generated world",
    realmRouteCheck("nova").hall === true);
}

// =====================================================================
// S-2 (EE 1100): the console gate — rift-straight is a traversal
// test in a shared world, so it stands behind the login token (the
// same token that gates saving to the shared chart); the read-only
// diagnostics stay open. Source pins, the established glue pattern;
// the behavior itself is exercised live by probe-s2.mjs.
{
  console.log("\n== console gate (S-2): rift-straight behind the login token ==");
  const game = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  check("S-2b gate: the three rift commands are gated, and only they",
    (game.match(/gated: true/g) || []).length === 3 &&
    /"rift-straight": \{[^}]*gated: true/.test(game) &&
    /"rift-veer": \{[^}]*gated: true/.test(game) &&
    /"rift-slope": \{[^}]*gated: true/.test(game));
  check("S-2 gate: the runner refuses a gated command when no login token stands",
    game.includes("if (cmd.gated && !gameToken())") &&
    game.includes("runs only when you are signed in"));
  check("S-2 gate: the refusal names the shared chart's token as the key",
    game.includes("the same login token that saves to the shared chart"));
  check("S-2 gate: the gate is checked before the busy check, so a refusal never starts a walk",
    game.indexOf("if (cmd.gated && !gameToken())") > -1 &&
    game.indexOf("if (cmd.gated && !gameToken())") <
      game.indexOf("if (cmd.probe && nfCon.busy)"));
  check("S-2 gate: the diagnostics carry no gate — where, purse, gravity, version stay open",
    !/"where": \{[^}]*gated/.test(game) && !/"purse": \{[^}]*gated/.test(game) &&
    !/"gravity": \{[^}]*gated/.test(game) && !/"version": \{[^}]*gated/.test(game) &&
    !/"portal": \{[^}]*gated/.test(game) && !/"geometry": \{[^}]*gated/.test(game) &&
    !/"bridge": \{[^}]*gated/.test(game) && !/"runall": \{[^}]*gated/.test(game));
}

// =====================================================================
// S-2b (EE 1105): the gate at the LEG level. S-2's command-level
// gate covered the rift-straight command only; runall reaches
// the legs internally and veer/slope carried no gate. Now each
// leg refuses in itself, before its header, its rift, or any
// step — so every path that walks the fox through a rift
// (the three commands, runall's reach) meets the same refusal.
// The behavior is exercised live by probe-s2b.mjs.
{
  console.log("\n== console gate (S-2b): the legs refuse in themselves ==");
  const game = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  check("S-2b gate: the leg gate checks the same login token",
    game.includes("function nfLegGate(name)") &&
    game.includes("if (gameToken()) return true;"));
  check("S-2b gate: the leg refusal names the leg and the shared chart's token",
    game.includes("${name} runs only when you are signed in") &&
    game.includes("the same login token that saves to the shared chart"));
  check("S-2b gate: straight refuses in the leg, as its first act",
    game.includes('async function nfLegStraight() {\n  if (!nfLegGate("rift-straight")) return "notrun";'));
  check("S-2b gate: veer refuses in the leg, as its first act",
    game.includes('async function nfLegVeer(deg) {\n  if (!nfLegGate("rift-veer")) return "notrun";'));
  check("S-2b gate: slope refuses in the leg, as its first act",
    game.includes('async function nfLegSlope() {\n  if (!nfLegGate("rift-slope")) return "notrun";'));
  check("S-2b gate: runall reaches the legs through the same gated functions",
    game.includes('results.push(["rift-straight", await nfLegStraight()])') &&
    game.includes('results.push(["rift-veer", await nfLegVeer(20)])'));
}

// ================= P-6: the solver =================
{
  // The kernel: deterministic, seed-sensitive, foam at the class density.
  const r1 = solverCompute(7, 64, 64, 120);
  const r2 = solverCompute(7, 64, 64, 120);
  const r3 = solverCompute(8, 64, 64, 120);
  check("P-6: the work is deterministic — same input, same result hash",
    r1.outputHash === r2.outputHash && r1.population === r2.population);
  check("P-6: a different seed does different work",
    r1.outputHash !== r3.outputHash);
  const foam = solverFoamGrid(solverSeedString(3), 128, 128);
  let foamPop = 0; for (const v of foam) foamPop += v;
  check("P-6: the foam seeds near the class density (30%)",
    foamPop / foam.length > 0.25 && foamPop / foam.length < 0.35);
  check("P-6: the foam's border is alive, as the core's is",
    foam[0] === 1 && foam[127] === 1 && foam[128 * 127] === 1);

  // Unit derivation: the canary re-issues an earlier input exactly.
  check("P-6: every 50th unit is a canary re-issue of the unit 49 back",
    solverIsCanary(49) && solverSeedUnitFor(49) === 0 &&
    !solverIsCanary(50) && solverSeedUnitFor(50) === 50 &&
    solverInputHash(49) === solverInputHash(0));
  check("P-6: unit ids round-trip",
    solverUnitNumber(solverUnitId(123)) === 123 && solverUnitNumber("junk") === -1);

  // The rate math — the ruled numbers, pinned exactly.
  check("P-6: an honest hour nets the ruled 2.45 credits",
    Math.abs(SOLVER_RATES.UNITS_PER_HOUR_REF * SOLVER_RATES.TWELFTHS_PER_UNIT *
      (1 - 1 / SOLVER_CLASS.CANARY_EVERY) / SOLVER_RATES.TWELFTHS_PER_CREDIT - 2.45) < 1e-9);
  check("P-6: a 100-credit gift is ~41 contributed hours at the ruled rate",
    Math.ceil(100 / 2.45) === 41);
  check("P-6: caps — 15 cr paid, 8 cr free, the new-account ramp over both",
    solverCapTwelfths(true, 40) === 180 && solverCapTwelfths(false, 40) === 96 &&
    solverCapTwelfths(true, 0) === 45 && solverCapTwelfths(true, 10) === 90 &&
    solverCapTwelfths(false, 3) === 24);
  check("P-6: the grant — full rate, half past the 4th hour, cap binds, canary pays 0",
    solverGrantTwelfths({ canary: false, contribMsBefore: 0, dayTwelfths: 0, capTwelfths: 180 }) === 2 &&
    solverGrantTwelfths({ canary: false, contribMsBefore: SOLVER_RATES.DIMINISH_AFTER_MS, dayTwelfths: 0, capTwelfths: 180 }) === 1 &&
    solverGrantTwelfths({ canary: false, contribMsBefore: 0, dayTwelfths: 179, capTwelfths: 180 }) === 1 &&
    solverGrantTwelfths({ canary: false, contribMsBefore: 0, dayTwelfths: 180, capTwelfths: 180 }) === 0 &&
    solverGrantTwelfths({ canary: true, contribMsBefore: 0, dayTwelfths: 0, capTwelfths: 180 }) === 0);

  // The scroll grammar round-trips.
  const ih = solverInputHash(0);
  const lines = [
    solverClaimLine("sol1-0", ih, "fox-a", "nonce-a", 1000),
    solverResultLine("sol1-0", "deadbeefdeadbeef", "fox-a", "nonce-a", 2000),
    solverCreditLine("sol1-0", "fox-a", 2, "2026-11-27", 3000),
  ].join("\n");
  const rows = parseSolverScroll(lines);
  check("P-6: claim/result/credit lines parse back with their fields",
    rows.length === 3 && rows[0].kind === "claim" && rows[0].claimHash ===
      solverClaimHash("sol1-0", ih, "fox-a", "nonce-a") &&
    rows[1].kind === "result" && rows[2].kind === "credit" && rows[2].twelfths === 2);

  // Resolution: two early claims, agreeing results -> a credited pair.
  const twoFox = (outB) => parseSolverScroll([
    solverClaimLine("sol1-0", ih, "fox-a", "na", 1000),
    solverClaimLine("sol1-0", ih, "fox-b", "nb", 1100),
    solverResultLine("sol1-0", "hash-x", "fox-a", "na", 5000),
    solverResultLine("sol1-0", outB, "fox-b", "nb", 6000),
  ].join("\n"));
  check("P-6: two agreeing eligible results form the credited pair",
    resolveSolver(twoFox("hash-x")).pairs.length === 1 &&
    resolveSolver(twoFox("hash-x")).pairs[0].pair.join() === "fox-a,fox-b");
  check("P-6: disagreement is evidence, not credit — no pair forms",
    resolveSolver(twoFox("hash-y")).pairs.length === 0);

  // The anti-copy rule: a claim that lands after the first result
  // can never be eligible, even with the right answer.
  const copyRows = parseSolverScroll([
    solverClaimLine("sol1-0", ih, "fox-a", "na", 1000),
    solverResultLine("sol1-0", "hash-x", "fox-a", "na", 5000),
    solverClaimLine("sol1-0", ih, "fox-copy", "nc", 6000),
    solverResultLine("sol1-0", "hash-x", "fox-copy", "nc", 7000),
  ].join("\n"));
  check("P-6: a copier who claims after the first result earns nothing",
    resolveSolver(copyRows).pairs.length === 0 &&
    solverGrantFor(copyRows, "fox-copy", "sol1-0", false, 8000) === null);

  // The lease: a late result is not creditable.
  const lateRows = parseSolverScroll([
    solverClaimLine("sol1-0", ih, "fox-a", "na", 1000),
    solverClaimLine("sol1-0", ih, "fox-b", "nb", 1100),
    solverResultLine("sol1-0", "hash-x", "fox-a", "na", 5000),
    solverResultLine("sol1-0", "hash-x", "fox-b", "nb", 1100 + SOLVER_CLASS.LEASE_MS + 1),
  ].join("\n"));
  check("P-6: a result past its lease is not creditable",
    resolveSolver(lateRows).pairs.length === 0);

  // The mint: exactly once — after the credit line stands, no grant.
  const mintRows = twoFox("hash-x");
  const grantA = solverGrantFor(mintRows, "fox-a", "sol1-0", false, 10000);
  check("P-6: a verified unit grants at full rate inside the day's cap",
    grantA === 2);
  const withCredit = mintRows.concat(parseSolverScroll(
    solverCreditLine("sol1-0", "fox-a", grantA, solverDayKey(10000), 11000)));
  check("P-6: once the credit line stands, the same unit never grants twice",
    solverCreditExists(withCredit, "fox-a", "sol1-0") &&
    solverGrantFor(withCredit, "fox-a", "sol1-0", false, 12000) === null);

  // Twelfths fold into whole credits exactly.
  const eco6 = newEconomyState();
  const whole = applySolverTwelfths(eco6, 30);
  check("P-6: twelfths fold into whole credits, the fraction carries",
    whole === 2 && eco6.credits === 2 && eco6.solver.fracTwelfths === 6 &&
    eco6.lifetime.creditsEarned === 2);
  const back6 = loadEconomyState(JSON.parse(JSON.stringify(eco6)));
  check("P-6: the solver state survives the purse's save/load round-trip",
    back6.solver.fracTwelfths === 6 && back6.solver.creditedUnits.length === 0);
  const dirty6 = loadEconomyState({ solver: { fracTwelfths: 99, creditedUnits: [1, "sol1-2"], firstDay: "junk", lifetimeUnits: -3 } });
  check("P-6: a loaded solver state is sanitised (remainder clamped, junk dropped)",
    dirty6.solver.fracTwelfths === 11 && dirty6.solver.creditedUnits.join() === "sol1-2" &&
    dirty6.solver.firstDay === null && dirty6.solver.lifetimeUnits === 0);

  // The queue discipline.
  check("P-6: the next claimable unit on an empty scroll is unit 0",
    nextSolverUnit([], "fox-a", 1000) === 0);
  const claimed0 = parseSolverScroll(solverClaimLine("sol1-0", ih, "fox-a", "na", 1000));
  check("P-6: my claimed unit is not offered to me again, but stands open for a second fox",
    nextSolverUnit(claimed0, "fox-a", 2000) === 1 && nextSolverUnit(claimed0, "fox-b", 2000) === 0);
  check("P-6: a closed unit is offered to no one",
    nextSolverUnit(twoFox("hash-x"), "fox-c", 9000) === 1);

  // Standing: completed over the last claims, honestly counted.
  const stand = solverStanding(twoFox("hash-x"), "fox-a");
  check("P-6: standing counts a finished claim as completed",
    stand.accepted === 1 && stand.completed === 1 && stand.ratio === 1);
  check("P-6: the first solver day reads off the scroll",
    solverFirstDay(twoFox("hash-x"), "fox-a") === solverDayKey(1000));

  // The worker source IS the pinned kernel — text parity — and it
  // actually computes the pinned result when driven.
  const src = buildSolverWorkerSource();
  check("P-6: the worker source carries the kernel functions verbatim",
    src.includes(solverLifeStep.toString()) && src.includes("onmessage"));
  let workerOk = false;
  try {
    const posted = [];
    const drive = new Function("postMessage", "performance", "setTimeout",
      src + "\nreturn onmessage;");
    const onmsg = drive((m) => posted.push(m), performance, setTimeout);
    onmsg({ data: { type: "start", seedN: 7, w: 32, h: 32, gens: 40, duty: 1 } });
    const want = solverCompute(7, 32, 32, 40);
    const got = posted.find((m) => m.type === "result");
    workerOk = !!got && got.outputHash === want.outputHash && got.population === want.population;
  } catch (e) { workerOk = false; }
  check("P-6: the shipped worker text computes the pinned result", workerOk);

  const gameSrc = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  check("P-6: the backend flush is single-flight (one drain at a time — no queued line posts twice)",
    gameSrc.includes("let backendFlushing = false") && gameSrc.includes("await backendFlushPass()"));

  // The governor's numbers: duty under the cap line, slice at 100 ms.
  check("P-6: the governor's duty target rides under the 30% cap",
    SOLVER_GOVERNOR.DUTY < SOLVER_GOVERNOR.CAP && SOLVER_GOVERNOR.CAP === 0.30 &&
    SOLVER_GOVERNOR.SLICE_MS === 100);
}
// --- the gravity dial: Morse, magnitude, frequency, the primer --------
// Will: the dial is a microcosm of subspace. Morse chooses the next
// coordinate. S.O.S brings you home. Full range (magnitude and
// frequency, and no once-a-day cap) opens for a paid license or the
// dragon — the flight gate's rule. Joy teaches all 36 marks by
// spaced repetition, on this machine, as the fox explores.
{
  check("dial: the alphabet and the digits are 36 symbols",
    MORSE_COUNT === 36 && MORSE_ORDER.length === 36 &&
    new Set(MORSE_ORDER).size === 36);
  check("dial: the deck starts S, then O, then the rest",
    MORSE_ORDER[0] === "S" && MORSE_ORDER[1] === "O" &&
    MORSE_ORDER.includes("A") && MORSE_ORDER.includes("Z") &&
    MORSE_ORDER.includes("0") && MORSE_ORDER.includes("9"));
  const patterns = new Set();
  let round = true;
  for (const sym of MORSE_ORDER) {
    const enc = encodeMorse(sym);
    const dec = decodeMorse(enc);
    if (!enc || !MORSE[sym] || enc !== MORSE[sym] || !dec || dec.text !== sym || dec.letters[0] !== sym) {
      round = false;
    }
    patterns.add(enc);
  }
  check("dial: all 36 symbols encode and decode cleanly", round && patterns.size === 36);

  check("dial: S.O.S is the three-letter word, dots dashes dots",
    encodeMorse("SOS") === SOS_PATTERN && SOS_PATTERN === "... --- ..." &&
    isSos(SOS_PATTERN) && decodeMorse(SOS_PATTERN).text === "SOS" &&
    decodeMorse(SOS_PATTERN).letters.join("") === "SOS");
  check("dial: a garbled pattern is not a coordinate",
    decodeMorse("........") === null && decodeMorse("") === null &&
    decodeMorse(null) === null && interpretLock("........").ok === false);

  const home = interpretLock(SOS_PATTERN);
  check("dial: S.O.S locks home — Nova Prime, the arrival pad",
    home.ok && home.kind === "home" && home.realmId === HOME_REALM &&
    home.realmId === "nova" && home.arrival.x === HOME_ARRIVAL.x &&
    home.arrival.z === ARRIVAL.nova.z &&
    home.coord.join(",") === realmCoord("nova").join(","));

  let callsOk = DIAL_REALMS.length === REALMS.length;
  for (const r of DIAL_REALMS) {
    const w = REALMS.find((x) => x.id === r.id);
    if (!w || w.name !== r.name || w.coord.join(",") !== r.coord.join(",")) callsOk = false;
    const hit = interpretLock(encodeMorse(r.call));
    if (!hit.ok || hit.kind !== "realm" || hit.realmId !== r.id) callsOk = false;
  }
  check("dial: each realm's call letter and coordinate match the chart", callsOk);
  check("dial: O is not Orchid — R is, so S.O.S stays home",
    interpretLock(encodeMorse("R")).realmId === "orchid" &&
    interpretLock(encodeMorse("O")).kind !== "realm" &&
    interpretLock(encodeMorse("O")).kind !== "home");

  const ash = DIAL_REALMS.find((r) => r.id === "ashfall");
  const ashLock = interpretLock(encodeCoord(ash.coord));
  check("dial: a nine-word digit coordinate locks that realm",
    ashLock.ok && ashLock.kind === "coord" && ashLock.realmId === "ashfall");
  const novaLock = interpretLock(encodeCoord(realmCoord("nova")));
  check("dial: Nova's own coordinate locks Nova, and it is not the S.O.S kind",
    novaLock.ok && novaLock.kind === "coord" && novaLock.realmId === "nova");
  check("dial: an unknown nine-word coordinate is refused",
    interpretLock(encodeCoord([9, 9, 9, 9, 9, 9, 9, 9, 9])).reason === "unknown-coord");

  check("dial: Q1–Q5 set magnitude, Y1–Y5 set frequency",
    interpretLock(encodeMorse("Q1")).index === 0 && interpretLock(encodeMorse("Q1")).kind === "mag" &&
    interpretLock(encodeMorse("Q5")).index === 4 &&
    interpretLock(encodeMorse("Y1")).kind === "freq" && interpretLock(encodeMorse("Y5")).index === 4);

  const std = gravityStep(FREE_MAG, FREE_FREQ, 1, 0);
  check("dial: Standard and Still are the shipped pull, exactly",
    FREE_MAG === 2 && FREE_FREQ === 0 && MAG_STOPS[2].mul === 1 && FREQ_STOPS[0].hz === 0 &&
    std.perSec === GRAV_BASE && std.terminal === TERM_BASE && std.ripple === 1);
  check("dial: inverted Standard pulls the other way at the same strength",
    gravityStep(2, 0, -1, 1.7).perSec === -GRAV_BASE);
  check("dial: Float is a quarter, Crushing is double, terminal follows",
    gravityStep(0, 0, 1, 0).perSec === GRAV_BASE * 0.25 &&
    gravityStep(4, 0, 1, 0).perSec === GRAV_BASE * 2 &&
    gravityStep(4, 0, 1, 0).terminal === TERM_BASE * 2 &&
    gravityStep(1, 0, 1, 0).terminal === TERM_BASE * 0.5);
  const hum = gravityStep(2, 2, 1, 0.25); // Pulse is 1 Hz; quarter period is the crest
  check("dial: frequency breathes the pull and rests at the zero crossing",
    FREQ_STOPS[2].hz === 1 &&
    Math.abs(hum.ripple - (1 + FREQ_RIPPLE)) < 1e-9 &&
    Math.abs(hum.perSec - GRAV_BASE * (1 + FREQ_RIPPLE)) < 1e-9 &&
    gravityStep(2, 2, 1, 0).ripple === 1);

  const freeEco = newEconomyState();
  const paidEco = newEconomyState();
  paidEco.entitlement.status = "paid";
  const cases = [[false, false], [true, false], [false, true], [true, true]];
  check("dial: the range gate matches the flight gate on every case",
    cases.every(([paid, dragon]) => {
      const eco = paid ? paidEco : freeEco;
      const f = flightUnlocked(eco, dragon);
      const d = dialRangeUnlocked(isGenerator(eco), dragon);
      return f.ok === d.ok && f.via === d.via;
    }));
  check("dial: a free fox is refused off Standard and off Still",
    proposeDial(4, 4, false).reason === "locked" &&
    proposeDial(2, 1, false).reason === "locked" &&
    proposeDial(2, 0, false).ok === true);
  check("dial: a paid fox and a dragon-slayer may set Crushing and Keen",
    proposeDial(4, 4, dialRangeUnlocked(true, false).ok).ok === true &&
    proposeDial(0, 3, dialRangeUnlocked(false, true).ok).ok === true &&
    proposeDial(9, 0, true).reason === "bad");

  const DAY = "2026-11-27";
  const grav = [
    { realmId: "nova", dir: -1, player: "fox-one", day: DAY, ts: 1000 },
  ];
  check("dial: a free fox's second same-day shift is the daily refusal",
    shiftGate(grav, "nova", "fox-one", DAY, false, 50000).reason === "daily" &&
    gravityShiftAllowed(grav, "nova", "fox-one", DAY) === false);
  check("dial: an unlocked fox may shift again, once the write gap has passed",
    shiftGate(grav, "nova", "fox-one", DAY, true, 1000 + WRITE_GAP_MS).ok === true &&
    shiftGate(grav, "nova", "fox-one", DAY, true, 1000 + WRITE_GAP_MS - 1).reason === "rate");
  check("dial: the write gap is per fox — another player's shift does not close it",
    writeGapOpen(grav, "fox-two", "nova", 1001) === true);
  check("dial: a gdial line does not spend the day's flip",
    dailyShiftOpen([{ realmId: "nova", mag: 4, freq: 4, player: "fox-one", day: DAY, ts: 5 }],
      "nova", "fox-one", DAY) === true);

  const line = dialLine("nova", 4, 3, "fox-one", DAY, 4242);
  check("dial: a gdial line has the scroll's shape",
    line === "gdial|nova|4|3|fox-one|2026-11-27|4242");
  const mixed = line + "\n" + gravityShiftLine("nova", -1, "fox-one", DAY, 1000) + "\n" +
    "gdial|nova|9|0|fox|2026-11-27|1\ngdial|nova|1|x|fox|2026-11-27|1\n";
  const dials = parseDialScroll(mixed);
  const gravs = parseGravityScroll(mixed);
  check("dial: each parser keeps its own lines and drops the malformed",
    dials.length === 1 && dials[0].mag === 4 && dials[0].freq === 3 &&
    gravs.length === 1 && gravs[0].dir === -1);
  const again = dialLine("nova", 0, 1, "fox-one", DAY, 9000);
  const latest = latestDialByPlayerRealm(parseDialScroll(line + "\n" + again));
  check("dial: the latest gdial line per fox per realm wins, and the earlier line is still in the scroll",
    latest.get("fox-one|nova").mag === 0 && latest.get("fox-one|nova").freq === 1 &&
    parseDialScroll(line + "\n" + again).length === 2);

  const inst = newDialInstrument();
  rememberDial(inst, "nova", 4, 4);
  check("dial: a free reading stays Standard and Still even if Crushing was stored",
    dialReading(inst, "nova", false).mag === FREE_MAG &&
    dialReading(inst, "nova", false).freq === FREE_FREQ &&
    dialReading(inst, "nova", false).locked === true);
  check("dial: an unlocked reading keeps what was stored",
    dialReading(inst, "nova", true).mag === 4 && dialReading(inst, "nova", true).freq === 4);
  const records = parseDialScroll(
    dialLine("ashfall", 1, 2, "fox-one", DAY, 10) + "\n" +
    dialLine("ashfall", 3, 1, "fox-two", DAY, 11) + "\n" +
    dialLine("ashfall", 0, 4, "fox-one", DAY, 12));
  const applied = applyDialRecords(newDialInstrument(), records, "fox-one", true);
  check("dial: read-back applies this fox's latest line and not another fox's",
    applied.byRealm.ashfall.mag === 0 && applied.byRealm.ashfall.freq === 4 &&
    !applied.byRealm.nova);
  const untouched = applyDialRecords(newDialInstrument(), records, "fox-one", false);
  check("dial: a free fox does not take a paid reading off the scroll",
    Object.keys(untouched.byRealm).length === 0);
  const saved = loadDialInstrument(JSON.parse(JSON.stringify(saveDialInstrument(applied))));
  const dirtyInst = loadDialInstrument({ v: 1, byRealm: { nova: { mag: 4, freq: 1 }, nope: { mag: 1, freq: 1 }, ashfall: { mag: 9, freq: 0 } } });
  check("dial: the instrument survives a save round-trip and drops bad realms",
    saved.byRealm.ashfall.freq === 4 && dirtyInst.byRealm.nova.mag === 4 &&
    !dirtyInst.byRealm.nope && !dirtyInst.byRealm.ashfall);

  check("dial: a short tap is a dot and a long hold is a dash",
    classifyTap(0) === "." && classifyTap(359) === "." &&
    classifyTap(360) === "-" && classifyTap(-1) === null);
  check("dial: a pause opens a letter gap before the next mark",
    applyTap(".", "-", 800) === ". -" && applyTap(".", "-", 100) === ".-" &&
    applyTap("", ".", 5000) === ".");

  const deck = newMorseDeck(0);
  check("dial: a new deck holds all 36, with S and O introduced and due",
    deck.cards.length === 36 && deck.introduced === 2 &&
    deck.cards.every((c) => MORSE_ORDER.includes(c.symbol)) &&
    cardBySymbol(deck, "S").introduced && cardBySymbol(deck, "O").introduced &&
    !cardBySymbol(deck, "A").introduced &&
    dueCard(deck, 0).symbol === "S");
  const promoted = reviewCard(deck, "S", true, 1000);
  check("dial: a clean key promotes a box and spaces the next due time",
    promoted.ok && promoted.box === 2 && cardBySymbol(deck, "S").correct === 1 &&
    cardBySymbol(deck, "S").due === 1000 + LEITNER_INTERVALS_MS[2]);
  reviewCard(deck, "S", true, 2000);
  reviewCard(deck, "S", true, 3000);
  const demoted = reviewCard(deck, "S", false, 4000);
  check("dial: a miss demotes to box 1 and is due again now",
    demoted.ok && demoted.box === 1 && cardBySymbol(deck, "S").wrong === 1 &&
    cardBySymbol(deck, "S").due === 4000 && cardBySymbol(deck, "S").correct === 3);
  check("dial: an unintroduced mark cannot be reviewed",
    reviewCard(deck, "A", true, 4000).reason === "unintroduced" &&
    reviewCard(deck, "Z", false, 4000).ok === false);
  check("dial: the next introduced mark is A, in curriculum order",
    introduceNext(deck, 5000) === "A" && cardBySymbol(deck, "A").introduced &&
    deck.introduced === 3);
  const persisted = loadMorseDeck(JSON.parse(JSON.stringify(saveMorseDeck(deck))), 5000);
  check("dial: the deck persists — box, counts, and how far Joy has gone",
    cardBySymbol(persisted, "S").box === 1 && cardBySymbol(persisted, "S").correct === 3 &&
    cardBySymbol(persisted, "S").wrong === 1 && persisted.introduced === 3 &&
    cardBySymbol(persisted, "A").introduced && !cardBySymbol(persisted, "B").introduced);
  const filthy = loadMorseDeck({
    v: 1, introduced: 99, sosCued: true,
    cards: [
      { symbol: "S", box: 9, correct: -3, wrong: 2.8, due: "no" },
      { symbol: "NOPE", box: 3, correct: 4 },
    ],
  }, 0);
  check("dial: a dirty deck drops unknown symbols, clamps boxes, and keeps all 36",
    filthy.cards.length === 36 && filthy.introduced === 2 &&
    cardBySymbol(filthy, "S").box === 1 && cardBySymbol(filthy, "S").correct === 0 &&
    cardBySymbol(filthy, "S").wrong === 2 && cardBySymbol(filthy, "S").due === 0 &&
    !filthy.cards.some((c) => c.symbol === "NOPE") && filthy.sosCued === true);
  check("dial: the storage keys are the machine's, not a scroll",
    MORSE_LS_KEY === "nova-phox-morse-deck" && DIAL_LS_KEY === "nova-phox-dial");

  const fresh = newMorseDeck(0);
  const first = joyMorseCue(fresh, 0, { event: "enter", lastCueAt: 0 });
  check("dial: Joy's first cue is S, as text, with no recorded take required",
    first.kind === "prompt" && first.symbol === "S" && first.speak &&
    first.text.startsWith("Joy —") && first.text.includes(encodeMorse("S")));
  const nag = joyMorseCue(fresh, 1000, { event: "explore", lastCueAt: 500 });
  check("dial: Joy stays quiet inside the gap",
    nag.kind === "quiet" && nag.speak === false);
  reviewCard(fresh, "S", true, 0);
  const second = joyMorseCue(fresh, 30000, { event: "explore", lastCueAt: 0 });
  check("dial: once S has landed, Joy asks for O",
    second.symbol === "O" && second.kind === "prompt" && second.text.includes(encodeMorse("O")));
  reviewCard(fresh, "O", true, 0);
  const sosCue = joyMorseCue(fresh, 60000, { event: "enter", lastCueAt: 0 });
  check("dial: with S and O in hand, Joy teaches S.O.S home",
    sosReady(fresh) && sosCue.kind === "sos" && sosCue.symbol === "SOS" &&
    sosCue.text.includes("... --- ...") && fresh.sosCued === true);
  cardBySymbol(fresh, "S").due = 1e15;
  cardBySymbol(fresh, "O").due = 1e15;
  const againSos = joyMorseCue(fresh, 90000, { event: "explore", lastCueAt: 0 });
  check("dial: S.O.S is taught once, then the walk introduces the next mark",
    againSos.kind !== "sos" && againSos.introduced === "A");
  const cheer = joyMorseCue(fresh, 1000, { event: "practice", lastCueAt: 90000, prompted: "A", keyedOk: true });
  const miss = joyMorseCue(fresh, 1000, { event: "practice", lastCueAt: 90000, prompted: "A", keyedOk: false });
  check("dial: a clean key is celebrated at once, and a miss comes back with the pattern",
    cheer.kind === "celebrate" && cheer.speak && cheer.text.includes("A") &&
    miss.kind === "retry" && miss.text.includes(encodeMorse("A")));
  let walked = fresh;
  // finish the curriculum so every symbol has been offered
  for (let i = 0; i < 40; i++) introduceNext(walked, 100000 + i);
  check("dial: the whole alphabet and every digit join the deck, and then it stops",
    walked.introduced === 36 && walked.cards.every((c) => c.introduced) &&
    introduceNext(walked, 200000) === null &&
    morseChart().length === 36);

  const pcs = new Set(PENTA_STEPS);
  let pitchesOk = true;
  for (const sym of MORSE_ORDER) {
    const p = symbolPitch(sym);
    if (!p || !(p.hz > 0) || !Number.isFinite(p.hz) || !pcs.has((p.midi - 60) % 12)) pitchesOk = false;
  }
  check("dial: every symbol sits on the pentatonic, at a real pitch", pitchesOk);
  const low = dialPitch(0, 0), high = dialPitch(4, 4);
  check("dial: magnitude lifts the octave and frequency picks the degree",
    low.midi === 48 && high.midi === 48 + 12 * 4 + PENTA_STEPS[4] && high.hz > low.hz);
  const novaHz = coordPitch(realmCoord("nova"));
  check("dial: a coordinate's pitch is stable, and a dash sits an octave under its dot",
    novaHz.hz === coordPitch(realmCoord("nova")).hz &&
    tapPitch("-", 0) === tapPitch(".", 0) * 0.5);
  const chord = confirmChord("S");
  check("dial: a locked symbol confirms as a major triad",
    chord.length === 3 && chord[1].midi === chord[0].midi + 4 &&
    chord[2].midi === chord[0].midi + 7);
  const cadence = sosCadence();
  check("dial: S.O.S is a low rising cadence, warmer than a sidetone",
    cadence.length === 4 && cadence[0].midi === 48 &&
    cadence[3].midi === 60 && cadence.every((n, i) => i === 0 || n.midi > cadence[i - 1].midi) &&
    cadence[0].midi < symbolPitch("S").midi && cadence.every((n) => n.hold >= 0.28));
  const parts = tonePartials(220);
  check("dial: the voice is four harmonic partials, no sample",
    parts.length === 4 && parts[1].hz === 440 && parts[0].gain === 1 &&
    parts.every((p, i) => i === 0 || p.gain < parts[i - 1].gain));
  const tintA = spectrumColor(110), tintB = spectrumColor(880);
  check("dial: pitch maps to a spectrum color, higher pitches warmer",
    /^hsl\(\d+, 85%, 62%\)$/.test(tintA.css) && tintB.hue > tintA.hue);

  const page = readFileSync(new URL("./page3.html", import.meta.url), "utf8");
  const game = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  check("dial: the panel, the chart, and the field-guide primer are in the page",
    page.includes('id="gdial"') && page.includes('id="gdial-dot"') &&
    page.includes('id="gdial-dash"') && page.includes('id="board-morse"') &&
    page.includes("S.O.S"));
  check("dial: the game judges the range with the flight gate's own inputs",
    game.includes("dialRangeUnlocked(isGenerator(eco), !!sub.dragonKilled)") &&
    game.includes("MORSE_LS_KEY") && game.includes("gravityCoord") &&
    game.includes('id="gdial"') === false);
  check("dial: a refused daily shift still returns before the wooze",
    (() => {
      const i = game.indexOf("function flipGravityHere()");
      const seg = game.slice(i, i + 1800);
      return seg.includes("gravityShiftAllowed") &&
        seg.indexOf("gravityShiftAllowed") < seg.indexOf("return;") &&
        seg.indexOf("return;") < seg.indexOf("startInvertFx()") &&
        seg.includes("writeGapOpen");
    })());
}


// ---------- T-3: Lite is a loader + a .phext.gz package ----------
{
  const lite = readFileSync(new URL("./lite.html", import.meta.url), "utf8");
  check("T-3: lite.html is the loader, not the monolith",
    lite.length < 100_000 && lite.includes('id="nf-load-fill"') &&
    lite.includes("nova-fox.phext.gz") && lite.includes('DecompressionStream("gzip")'));
  check("T-3: the loader fetches nothing from a CDN or any external origin",
    !/https?:\/\//.test(lite));
  const eeM = lite.match(/"ee":\s*"?(\d+)"?/);
  const ee = eeM && eeM[1];
  check("T-3: the loader names its ship EE", !!ee);
  const man = JSON.parse(readFileSync(new URL(`./assets/${ee}/manifest.json`, import.meta.url), "utf8"));
  const gzBytes = readFileSync(new URL(`./assets/${ee}/nova-fox.phext.gz`, import.meta.url));
  const phextBytes = readFileSync(new URL(`./assets/${ee}/nova-fox.phext`, import.meta.url));
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  check("T-3: the package is gzip (magic bytes) and matches the manifest",
    gzBytes[0] === 0x1f && gzBytes[1] === 0x8b &&
    man.files["nova-fox.phext.gz"].sha256 === sha(gzBytes) &&
    man.files["nova-fox.phext.gz"].bytes === gzBytes.length);
  check("T-3: gunzip(package) is the phext, byte for byte",
    gunzipSync(gzBytes).equals(phextBytes) &&
    man.files["nova-fox.phext"].sha256 === sha(phextBytes));
  const levels = new Map(PHEXT_LEVEL_BYTES.map((b, i) => [b, i]));
  const coord = [1, 1, 1, 1, 1, 1, 1, 1, 1];
  const scrolls = new Map();
  let start = 0;
  const keyOf = () => `${coord[0]}.${coord[1]}.${coord[2]}/${coord[3]}.${coord[4]}.${coord[5]}/${coord[6]}.${coord[7]}.${coord[8]}`;
  for (let i = 0; i < phextBytes.length; i++) {
    const lvl = levels.get(phextBytes[i]);
    if (lvl !== undefined) {
      scrolls.set(keyOf(), phextBytes.toString("utf8", start, i));
      coord[lvl]++;
      for (let j = lvl + 1; j < 9; j++) coord[j] = 1;
      start = i + 1;
    }
  }
  scrolls.set(keyOf(), phextBytes.toString("utf8", start));
  const home = scrolls.get("1.1.1/1.1.1/1.1.1") || "";
  const mapLine = home.split("\n").find((l) => l.startsWith("NF-MAP "));
  check("T-3: the phext's home scroll carries the map", !!mapLine);
  const pkgMap = JSON.parse(mapLine.slice(7));
  check("T-3: the manifest's scroll table matches the phext",
    Object.keys(man.package.scrolls).length === scrolls.size &&
    pkgMap.modules.length === man.package.modules.length);
  const module = pkgMap.modules.map((k) => scrolls.get(k)).join("\n");
  check("T-3: the module scrolls reassemble into the Lite module (hash)",
    sha(Buffer.from(module, "utf8")) === man.package.moduleSha256);
  const shell = scrolls.get(pkgMap.shell) || "";
  const page = shell.replace("/*__BUILT_MODULE__*/", module);
  check("T-3: the assembled page is the game (one stamp, boot handle inside)",
    (page.match(/NF_SHIP_EE:/g) || []).length === 1 && page.includes("NOVA_FOX3"));
}


// ---------- W-5: the ship log on the start screen ----------
{
  const fx = (ee, name, note) => ({ ee, name, note });
  check("shiplog: rows order newest first, the build being made at the head",
    (() => { const rows = shipLogRows([
        fx(1032, "demo30", "a"), fx(0, "build 42", "b"), fx(1081, "demo41", "c")]);
      return rows.map((r) => r.name).join(",") === "build 42,demo41,demo30"; })());
  check("shiplog: malformed rows never reach the panel",
    (() => { const rows = shipLogRows([
        fx(1081, "demo41", "a"), { ee: -1, name: "x", note: "y" },
        { ee: 5, name: "", note: "y" }, { ee: 5, name: "x" }, null, "junk"]);
      return rows.length === 1 && rows[0].name === "demo41"; })());
  check("shiplog: the headline caps at SHIPLOG_MAX, the newest kept",
    (() => { const many = [];
        for (let i = 0; i < 12; i++) many.push(fx(1000 + i, "d" + i, "n"));
        const head = shipLogHeadline(many);
        return SHIPLOG_MAX === 8 && head.length === 8 &&
          head[0].ee === 1011 && head[7].ee === 1004; })());
  check("shiplog: a shipped row letters as its epoch, name, line",
    shipLogLine(fx(1081, "demo41", "The roadmap panel."), 1149) ===
      "EE 1081 \u00b7 demo41 \u00b7 The roadmap panel.");
  check("shiplog: the build being made letters with the running build's own stamp",
    shipLogLine(fx(0, "build 42", "The sell-ready build."), 1149) ===
      "EE 1149 \u00b7 build 42 \u00b7 The sell-ready build." &&
    shipLogLine(fx(0, "build 42", "The sell-ready build."), 0) ===
      "this build \u00b7 build 42 \u00b7 The sell-ready build.");

  // The source of record: SHIPLOG.md, parsed as build3.py parses it.
  const src = readFileSync(new URL("./SHIPLOG.md", import.meta.url), "utf8");
  const srcRows = [...src.matchAll(/\| (this|\d+) \| ([^|]+?) \| ([^|]+?) \|/g)]
    .map((m) => ({ ee: m[1] === "this" ? 0 : Number(m[1]),
                   name: m[2].trim(), note: m[3].trim() }));
  check("shiplog: the source seeds the real ship history, newest first",
    srcRows.map((r) => r.ee).join(",") === "0,1081,1073,1046,1037,1034,1032,1023" &&
    srcRows.map((r) => r.name).join(",") ===
      "build 42,demo41,demo35,demo34,demo32,demo31,demo30,demo29");
  check("shiplog: the headline of the seeded log is the whole seed, in order",
    shipLogHeadline(srcRows).map((r) => r.name).join(",") ===
      "build 42,demo41,demo35,demo34,demo32,demo31,demo30,demo29");

  // The bake: the built Full carries exactly the source's rows.
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const baked = JSON.parse(html.match(/const SHIP_LOG = (\[.*?\]);/s)[1]);
  check("shiplog: the built panel's log is the source's log, row for row",
    JSON.stringify(baked) === JSON.stringify(srcRows));
  const page = readFileSync(new URL("./page3.html", import.meta.url), "utf8");
  const game = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  check("shiplog: the panel stands on the start screen; the version row stands as it was",
    page.includes('id="shiplog"') && page.includes('id="shiplog-rows"') &&
    html.includes('id="shiplog-rows"') &&
    game.includes("renderShipLog()") &&
    game.includes("Nova Fox \u2014 EE ${SHIP_EE}") &&
    html.includes('id="ver-line1"'));

  // The Lite boot: the package's shiplog scroll carries the same
  // rows, its shell carries the panel, its game scroll the render.
  const lite = readFileSync(new URL("./lite.html", import.meta.url), "utf8");
  const ee = (lite.match(/"ee":\s*"?(\d+)"?/) || [])[1];
  const phextBytes = gunzipSync(readFileSync(
    new URL(`./assets/${ee}/nova-fox.phext.gz`, import.meta.url)));
  const levels = new Map(PHEXT_LEVEL_BYTES.map((b, i) => [b, i]));
  const coord = [1, 1, 1, 1, 1, 1, 1, 1, 1];
  const scrolls = new Map();
  let start = 0;
  const keyOf = () => `${coord[0]}.${coord[1]}.${coord[2]}/${coord[3]}.${coord[4]}.${coord[5]}/${coord[6]}.${coord[7]}.${coord[8]}`;
  for (let i = 0; i < phextBytes.length; i++) {
    const lvl = levels.get(phextBytes[i]);
    if (lvl !== undefined) {
      scrolls.set(keyOf(), phextBytes.toString("utf8", start, i));
      coord[lvl]++;
      for (let j = lvl + 1; j < 9; j++) coord[j] = 1;
      start = i + 1;
    }
  }
  scrolls.set(keyOf(), phextBytes.toString("utf8", start));
  const home = scrolls.get("1.1.1/1.1.1/1.1.1") || "";
  const pkgMap = JSON.parse(home.split("\n").find((l) => l.startsWith("NF-MAP ")).slice(7));
  const shipCoord = Object.keys(pkgMap.moduleNames)
    .find((c) => pkgMap.moduleNames[c] === "shiplog");
  const gameCoord = Object.keys(pkgMap.moduleNames)
    .find((c) => pkgMap.moduleNames[c] === "game");
  const shipScroll = scrolls.get(shipCoord) || "";
  const liteBaked = JSON.parse(shipScroll.match(/const SHIP_LOG = (\[.*?\]);/s)[1]);
  check("shiplog: the Lite package's log is the source's log, row for row",
    JSON.stringify(liteBaked) === JSON.stringify(srcRows) &&
    (scrolls.get(pkgMap.shell) || "").includes('id="shiplog-rows"') &&
    (scrolls.get(gameCoord) || "").includes("renderShipLog"));
}


// F-2 (EE 1129): the gravity correction window — a flip back to
// the direction that stood before your own shift, inside the
// window, is a correction of that shift, not a new one.
{
  const DAY = "2026-11-27", NOW = 1000000;
  const mine = { realmId: "nova", dir: -1, player: "fox-f", day: DAY, ts: NOW - 30000 };
  const before = { realmId: "nova", dir: 1, player: "fox-other", day: "2026-11-26", ts: NOW - 900000 };
  check("F-2 correction: own fresh shift, realm's latest, correctable",
    gravityCorrection([before, mine], "nova", "fox-f", DAY, NOW) === mine);
  check("F-2 correction: window edge still corrects",
    gravityCorrection([mine], "nova", "fox-f", DAY, mine.ts + GRAVITY_CORRECTION_MS) === mine);
  check("F-2 correction: past the window the day stands spent",
    gravityCorrection([mine], "nova", "fox-f", DAY, mine.ts + GRAVITY_CORRECTION_MS + 1) === null);
  check("F-2 correction: another fox's later line closes it",
    gravityCorrection([mine, { realmId: "nova", dir: 1, player: "fox-g", day: DAY, ts: NOW - 5000 }],
      "nova", "fox-f", DAY, NOW) === null);
  check("F-2 correction: yesterday's shift is not correctable",
    gravityCorrection([{ realmId: "nova", dir: -1, player: "fox-f", day: "2026-11-26", ts: NOW - 30000 }],
      "nova", "fox-f", DAY, NOW) === null);
  check("F-2 correction: a corrected shift cannot be re-corrected (no toggle loop)",
    gravityCorrection([mine, { realmId: "nova", dir: 1, player: "fox-f", day: DAY, ts: NOW - 1000 }],
      "nova", "fox-f", DAY, NOW) === null);
  check("F-2 correction: another realm's record does not speak here",
    gravityCorrection([{ realmId: "ashfall", dir: -1, player: "fox-f", day: DAY, ts: NOW - 30000 }],
      "nova", "fox-f", DAY, NOW) === null);
  const game = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("./page3.html", import.meta.url), "utf8");
  check("F-1/F-2 shape: the view wires the correction, the skip and the unstick",
    game.includes("gravityCorrection(known, state.realm, playerName, day, Date.now())") &&
    game.includes("&& !correction") &&
    game.includes("syncToGuide") && game.includes("skipLine()") &&
    game.includes("unstickToArrival") && game.includes('id="menu-unstick"') === false);
  check("F-2 shape: the Esc menu carries the unstick item",
    page.includes('id="menu-unstick"'));
  check("F-2 correction: the daily gate itself is unchanged by the window",
    gravityShiftAllowed([mine], "nova", "fox-f", DAY) === false &&
    gravityShiftAllowed([], "nova", "fox-f", DAY) === true);
}

// ---------- W-4: gear tier markers (colorblind-safe tiers) ----------
{
  check("W-4: the five gear tiers stand in Will's canon order (white below grey, then green, red, blue)",
    GEAR_TIERS.map((t) => t.id).join(",") === "white,grey,green,red,blue");
  const shapes = GEAR_TIERS.map((t) => TIER_MARKER_SHAPES[t.id]);
  check("W-4: the tier->marker mapping is injective — five tiers, five distinct markers",
    new Set(shapes).size === 5 && shapes.join(",") === "circle,square,triangle,diamond,hexagon");
  const svgs = GEAR_TIERS.map((t) => tierMarkerSVG(t.id));
  check("W-4: every tier's marker SVG is distinct and names its tier and shape",
    new Set(svgs).size === 5 &&
    GEAR_TIERS.every((t, i) => svgs[i].includes(`data-tier="${t.id}"`) && svgs[i].includes(`data-shape="${t.shape}"`)));
  check("W-4: an unknown tier draws nothing",
    tierMarkerSVG("plaid") === "" && gearTier("plaid") === null);
  const markCount = (m) => (m.match(/class="tiermark"/g) || []).length;
  check("W-4: a Band 1 rung wears white AND grey, in canon order (the band's stated scope, no invented split)",
    (() => { const m = rungTierMarkers(rungById("keepsake-tune-pip"));
      return markCount(m) === 2 && m.indexOf('data-tier="white"') >= 0 &&
        m.indexOf('data-tier="grey"') > m.indexOf('data-tier="white"'); })());
  check("W-4: green, red, and blue rungs each wear exactly their own marker",
    markCount(rungTierMarkers(rungById("grand-brush-2x2x3"))) === 1 && rungTierMarkers(rungById("grand-brush-2x2x3")).includes('data-tier="green"') &&
    markCount(rungTierMarkers(rungById("dragonward-helm"))) === 1 && rungTierMarkers(rungById("dragonward-helm")).includes('data-tier="red"') &&
    markCount(rungTierMarkers(rungById("nameless-sheath"))) === 1 && rungTierMarkers(rungById("nameless-sheath")).includes('data-tier="blue"'));
  check("W-4: every rung on the ladder wears exactly its tier scope's markers",
    LADDER_RUNGS.every((r) => { const m = rungTierMarkers(r); const scope = r.tiers.split("/");
      return markCount(m) === scope.length && scope.every((id) => m.includes(`data-tier="${id}"`)); }));
  check("W-4: band markers match each band's tier scope",
    markCount(bandTierMarkers(1)) === 2 && bandTierMarkers(1).includes('data-tier="white"') && bandTierMarkers(1).includes('data-tier="grey"') &&
    markCount(bandTierMarkers(2)) === 1 && bandTierMarkers(2).includes('data-tier="green"') &&
    markCount(bandTierMarkers(3)) === 1 && bandTierMarkers(3).includes('data-tier="red"') &&
    markCount(bandTierMarkers(4)) === 1 && bandTierMarkers(4).includes('data-tier="blue"'));
  // The sites route through the helper — the view hand-draws no
  // marker of its own, so the shapes cannot drift per site.
  const g3 = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  const shopBody = g3.slice(g3.indexOf("function renderShop()"), g3.indexOf("function buyRungFromPanel"));
  const guideBody = g3.slice(g3.indexOf("function renderFieldGuide()"), g3.indexOf("function renderMaterials()"));
  check("W-4: the shop routes its band titles and rung rows through the shared helper",
    shopBody.includes("bandTierMarkers(band)") && shopBody.includes("rungTierMarkers(r)"));
  check("W-4: the field guide routes its rung rows through the shared helper",
    guideBody.includes("rungTierMarkers(r)"));
  check("W-4: the view contains no hand-drawn marker (no <svg>, no tiermark literal in game3.js)",
    !g3.includes("<svg") && !g3.includes("tiermark"));
  // Built bytes: the Full artifact and the Lite package both carry
  // the helper — every tier's table entry and drawn shape body.
  const SHAPE_SIG = { white: '<circle cx="6" cy="6" r="4"', grey: '<rect x="2.2" y="2.2"',
    green: 'M6 1.8 L10.6 9.8', red: 'M6 1.4 L10.4 6', blue: 'M6 1.2 L10.2 3.6' };
  const full = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  check("W-4: the built Full carries all five tier markers",
    GEAR_TIERS.every((t) => full.includes(`id: "${t.id}"`) && full.includes(SHAPE_SIG[t.id])));
  const eeM = full.match(/NF_SHIP_EE:(\d+)/);
  const pkgText = gunzipSync(readFileSync(new URL(`./assets/${eeM[1]}/nova-fox.phext.gz`, import.meta.url))).toString("utf8");
  check("W-4: the Lite package carries all five tier markers",
    GEAR_TIERS.every((t) => pkgText.includes(`id: "${t.id}"`) && pkgText.includes(SHAPE_SIG[t.id])));
}
// --- W-2: the feedback door (build 42) --------------------------------------
// One action from the Esc menu to the Nova Wiki's feedback page,
// the build's ship epoch attached. The URL is one named constant
// in a pure module; the epoch is the artifact's own runtime
// stamp, never a literal — these pins hold both halves.
{
  check("W-2: the wiki feedback URL is the named constant",
    WIKI_FEEDBACK_URL === "https://fox.phext.io/wiki/feedback");
  check("W-2: feedbackUrl attaches source and epoch",
    feedbackUrl("1081") === "https://fox.phext.io/wiki/feedback?from=game&ee=1081");
  const fbSrc = readFileSync(new URL("./feedback.js", import.meta.url), "utf8");
  check("W-2: feedback.js carries no ship-stamp token at all",
    !fbSrc.includes("NF_SHIP_EE"));
  const game = readFileSync(new URL("./game3.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("./page3.html", import.meta.url), "utf8");
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  check("W-2: the door passes the runtime stamp, never a literal",
    game.includes('window.open(feedbackUrl(SHIP_EE), "_blank", "noopener")'));
  check("W-2: the menu row stands in the page, before Quit",
    page.includes('id="menu-feedback"') && page.includes("Send feedback / playtest notes") &&
    page.indexOf('id="menu-feedback"') < page.indexOf('id="menu-quit"'));
  const focusList = game.slice(game.indexOf('"menu-newgame"'), game.indexOf('"menu-close"'));
  check("W-2: the focus order reaches the door before Quit",
    focusList.includes('"menu-feedback"') &&
    focusList.indexOf('"menu-feedback"') < focusList.indexOf('"menu-quit"'));
  const stamps = html.match(/NF_SHIP_EE:\d+/g) || [];
  check("W-2: the built file still carries exactly one stamp",
    stamps.length === 1, `found ${stamps.length}`);
  check("W-2: the built door attaches the artifact's own stamp",
    stamps.length === 1 && html.includes('id="menu-feedback"') &&
    feedbackUrl(stamps[0].split(":")[1]) ===
      WIKI_FEEDBACK_URL + "?from=game&ee=" + stamps[0].split(":")[1]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
