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
// v3 physics note (Will's feedback #6): the world below does not
// switch, it ACCELERATES. Life density and neighbor pressure feed a
// per-cell GROWTH level that ramps toward its target a few percent
// per tick; generation reads the growth level, so crystal and bloom
// creep in over many ticks and ebb the same way. Nothing derived
// pops in or out of existence. Inscriptions (overrides, scars,
// chisel work, the log itself) are the opposite: instant, permanent,
// exactly as written — Law 8.
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
  // v5 (feedback #10): two more faces for the world to wear. MOSS
  // caps Nova Prime's lush patches; SHALE bands Ashfall's strata.
  MOSS: 17, SHALE: 18,
};
const SOLID = new Set(Object.values(BLOCK).filter((v) => v !== 0));
export function isSolid(b) {
  return SOLID.has(b);
}

// ---------- realms ------------------------------------------------------
// Nova Prime is home. The other ten take the names of the first ten
// ranch nodes (wiring.phext record order) — REVIEW-1 #12. Only the
// first two are open in this demo slice; the rest are named and shut.

// ---------- realms ------------------------------------------------------
// Nova Prime is home. The other ten take the names of the first ten
// ranch nodes (wiring.phext record order) — REVIEW-1 #12. Only the
// first two are open in this demo slice; the rest are named and shut.
//
// Each realm also carries a subspace coordinate — WHERE it sits in
// the 9-component phext space (Will, 2026-11-24: "everything in
// this world is derived from subspace, not simply 'inspired' by
// it"). No written source places the realms, so the positions are
// derived from the SHAPE of CYOA (choose-your-own-adventure.phext,
// 829 content scrolls) itself, by one mechanical rule: the realms,
// in the order above, take the landmarks of CYOA's skeleton in
// corridor/reading order — the entry scroll (1.1.1/1.1.1/1.1.1),
// the Mytheon Arena corridor (Welcome, Basic Orientation, Choose
// Your First Scroll), the four exits the corridor names — and then,
// for the remaining realms, the anchors (lowest coordinate) of
// CYOA's largest remaining library clusters (library 90, 175
// scrolls; library 3, 97; library 7, 78 — library 1's anchor is the
// entry itself, already taken). One honesty flag: the corridor's
// four exit coordinates are written in the corridor scroll but no
// scroll was ever written AT them — the shape names those doors
// without filling them. Every other landmark is an occupied scroll.
// Distances are the lattice's own: the Euclidean length of the
// coordinate difference. The portal ring's geometry is a function
// of that difference (riftRingGeometry, below; game3.js renders it).

export const REALMS = [
  { id: "nova", name: "Nova Prime", seed: "nova-prime", open: true, coord: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { id: "ashfall", name: "Ashfall Haven", seed: "ashfall-haven", open: true, coord: [10, 10, 1, 1, 1, 1, 1, 10, 10] },
  { id: "ni-knight", name: "Ni-Knight", seed: "ni-knight", open: true, coord: [10, 10, 2, 1, 1, 1, 1, 10, 10] },
  { id: "logos", name: "Logos Prime", seed: "logos-prime", open: true, coord: [10, 10, 3, 1, 1, 1, 1, 10, 10] },
  { id: "elven", name: "Elven Path", seed: "elven-path", open: true, coord: [10, 1, 1, 1, 2, 1, 1, 10, 1] },
  { id: "orchid", name: "Orchid Flow", seed: "orchid-flow", open: true, coord: [1, 10, 1, 1, 2, 1, 1, 10, 1] },
  { id: "halycon", name: "Halycon Vector", seed: "halycon-vector", open: true, coord: [2, 10, 1, 1, 2, 1, 1, 10, 1] },
  { id: "delta", name: "Delta Wood", seed: "delta-wood", open: true, coord: [3, 10, 1, 1, 2, 1, 1, 10, 1] },
  { id: "willow", name: "Best Willow", seed: "best-willow", open: true, coord: [90, 1, 1, 1, 1, 1, 1, 1, 1] },
  { id: "plain", name: "Plain View", seed: "plain-view", open: true, coord: [3, 1, 1, 1, 1, 1, 7, 7, 7] },
  { id: "trust", name: "Trust Fall", seed: "trust-fall", open: true, coord: [7, 1, 1, 1, 1, 1, 1, 1, 1] },
];
export function realmById(id) {
  return REALMS.find((r) => r.id === id);
}
// A realm's subspace coordinate (a copy — callers may not rewrite
// the map), or null for an unknown id.
export function realmCoord(id) {
  const r = realmById(id);
  return r ? [...r.coord] : null;
}
// The coordinate difference B − A in the 9-component space: the
// jump a rift between the two realms actually spans.
export function subspaceDelta(idA, idB) {
  const a = realmCoord(idA), b = realmCoord(idB);
  return b.map((v, i) => v - a[i]);
}
// The subspace distance between two realms: the Euclidean length
// of their coordinate difference — the straight line through the
// lattice, the metric the space itself carries.
export function subspaceDistance(idA, idB) {
  return Math.hypot(...subspaceDelta(idA, idB));
}
// The geometry of a rift ring between two realms, as a pure
// function of their coordinate difference — no table: any pair's
// ring is computed from the pair's own coordinates. The ring's
// SIZE carries the distance (radius grows with the jump and
// saturates, so the farthest doors stay walkable: 1.00 for a
// within-realm hop, ~1.56 for Nova→Ashfall, ~2.03 for the widest
// jump the shape affords); its FACETS carry the difference's
// support (one step of smoothness per axis the jump crosses);
// tube and disc keep the proportions of the ring as built.
export function riftRingGeometry(idA, idB) {
  const delta = subspaceDelta(idA, idB);
  const distance = Math.hypot(...delta);
  const axes = delta.filter((v) => v !== 0).length;
  const radius = 1 + 1.3 * (distance / (distance + 24));
  return {
    delta, distance, axes, radius,
    tube: radius * (0.07 / 1.55),
    disc: radius * (1.46 / 1.55),
    segments: 24 + 3 * axes,
  };
}
// Where a crossing lands you in each open realm (block x, z).
export const ARRIVAL = {
  nova: { x: 8, z: 8 }, ashfall: { x: 8, z: 8 }, "ni-knight": { x: 8, z: 8 },
  logos: { x: 8, z: 8 }, elven: { x: 8, z: 8 }, orchid: { x: 8, z: 8 },
  halycon: { x: 8, z: 8 }, delta: { x: 8, z: 8 }, willow: { x: 8, z: 8 },
  plain: { x: 8, z: 8 }, trust: { x: 8, z: 8 },
};

// The bridge tune: the one chord the guide teaches. In Nova Prime it
// crosses to Ashfall Haven; in Ashfall Haven it crosses home.
export const BRIDGE_CHORD = [1, 4, 9];

// ---------- realm palettes (feedback #27) --------------------------------
// Will, 2026-11-22 23:09: "each level the user jumps to needs to
// feel different — a different color palette — only 10 of them."
// EE 995 feedback (Will, 2026-11-26): the ten are ROYGBIV-coded —
// each realm sits on its band of the rainbow (Trust Fall red through
// Orchid Flow violet; Plain View is white, all bands at once, its
// no-hue identity kept). The atlas hue rotation = band - 210 (the
// tiles' blue register); accents, fog and light sit on the band too.
// Exactly ten entries, one per ranch-named realm. Nova Prime is
// home — the starting realm — and keeps the palette-v4 identity
// (PALETTE-V4.md) as the built-in HOME_PALETTE below; paletteFor()
// resolves any realm id to its palette, home included. The view
// applies a palette whole on realm entry: void + fog (the sky a
// player sees — the engine has no gradient skybox), hemisphere and
// sun light, the atlas hue/sat re-skin of every block tile, a
// material tint, and two accents (the primary also colors a rift
// ring that leads there). Departures are hue changes, never mere
// brightness steps; every realm stays OLED-dark so the HUD keeps
// its contrast. See PALETTES-10.md for the design table.
export const HOME_PALETTE = {
  void: 0x000000, fog: 0x020814, fogNear: 34, fogFar: 110,
  hemiSky: 0x8fd0ff, hemiGround: 0x0a1a33, hemiI: 0.95,
  sun: 0xbfe3ff, sunI: 1.6,
  accent: 0x00d9ff, accent2: 0x2979ff,
  hue: 0, sat: 1.0, tint: 0xffffff,
};
export const REALM_PALETTES = {
  ashfall: {
    void: 0x000000, fog: 0x140301, fogNear: 26, fogFar: 88,
    hemiSky: 0xc97a4e, hemiGround: 0x180602, hemiI: 0.7,
    sun: 0xff9a5c, sunI: 1.25,
    accent: 0xff7a00, accent2: 0xffb03f,
    hue: 180, sat: 1.05, tint: 0xffe3cf,
  },
  "ni-knight": {
    void: 0x000000, fog: 0x05030f, fogNear: 30, fogFar: 100,
    hemiSky: 0x7a6ad6, hemiGround: 0x090618, hemiI: 0.8,
    sun: 0x9a8fff, sunI: 1.35,
    accent: 0x6a5cff, accent2: 0xb3a7ff,
    hue: 45, sat: 1.0, tint: 0xe0dcff,
  },
  logos: {
    void: 0x000000, fog: 0x0f0c00, fogNear: 32, fogFar: 105,
    hemiSky: 0xd6c25e, hemiGround: 0x171402, hemiI: 0.85,
    sun: 0xffe97a, sunI: 1.55,
    accent: 0xffd21f, accent2: 0xffe97a,
    hue: 205, sat: 1.0, tint: 0xfff6c2,
  },
  elven: {
    void: 0x000000, fog: 0x02100a, fogNear: 30, fogFar: 100,
    hemiSky: 0x5ec98d, hemiGround: 0x04150a, hemiI: 0.8,
    sun: 0x8fffca, sunI: 1.3,
    accent: 0x2eff7a, accent2: 0xa8ffbe,
    hue: 270, sat: 1.05, tint: 0xd2ffe6,
  },
  orchid: {
    void: 0x000000, fog: 0x0d0312, fogNear: 30, fogFar: 98,
    hemiSky: 0xb45ed6, hemiGround: 0x120418, hemiI: 0.8,
    sun: 0xd68fff, sunI: 1.35,
    accent: 0xb45cff, accent2: 0xdfa8ff,
    hue: 75, sat: 1.05, tint: 0xf3d9ff,
  },
  halycon: {
    void: 0x000000, fog: 0x030a18, fogNear: 36, fogFar: 120,
    hemiSky: 0x7ab8e6, hemiGround: 0x0a1420, hemiI: 1.1,
    sun: 0xcfe6ff, sunI: 1.7,
    accent: 0x3fa9ff, accent2: 0xaed6ff,
    hue: 10, sat: 0.9, tint: 0xeaf4ff,
  },
  delta: {
    void: 0x000000, fog: 0x02100e, fogNear: 30, fogFar: 102,
    hemiSky: 0x4ec9bb, hemiGround: 0x03120e, hemiI: 0.85,
    sun: 0x9ffce8, sunI: 1.4,
    accent: 0x00ffd0, accent2: 0x8ffcf0,
    hue: 325, sat: 1.1, tint: 0xd8fff4,
  },
  willow: {
    void: 0x000000, fog: 0x080c02, fogNear: 30, fogFar: 100,
    hemiSky: 0xa4d65e, hemiGround: 0x101602, hemiI: 0.85,
    sun: 0xd9ff8f, sunI: 1.45,
    accent: 0xb6ff2e, accent2: 0xe2ffa8,
    hue: 230, sat: 1.0, tint: 0xf0ffd2,
  },
  plain: {
    void: 0x000000, fog: 0x050505, fogNear: 32, fogFar: 108,
    hemiSky: 0xcfd8dc, hemiGround: 0x0c0e10, hemiI: 0.95,
    sun: 0xf2f2f2, sunI: 1.7,
    accent: 0xe8e8e8, accent2: 0x9fb6c9,
    hue: 0, sat: 0.12, tint: 0xf5f5f5,
  },
  trust: {
    void: 0x000000, fog: 0x120202, fogNear: 28, fogFar: 92,
    hemiSky: 0xd65e5e, hemiGround: 0x170303, hemiI: 0.75,
    sun: 0xff6a5c, sunI: 1.3,
    accent: 0xff2e2e, accent2: 0xff8f8f,
    hue: 150, sat: 1.05, tint: 0xffd9d9,
  },
};
export function paletteFor(realmId) {
  return REALM_PALETTES[realmId] || HOME_PALETTE;
}

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

// ---------- Fox Vision (Will, 2026-11-26) -------------------------------
// "Introduce Fox Vision, usable when inside The Unexpected Hall —
// it provides night vision of all familiars within subspace range."
// Joy's barrow line sets it up: "Find the Shadow, strike at the
// Heart. Your vision alone can fix it." Fox Vision is that vision.
// Inside the Hall the fox's sight agrees with every familiar's
// slice at once, out to the range at which subspace itself keeps
// a familiar engaged with the fox — its haunt radius. (The words
// "subspace range" live in these comments and the view's only;
// nothing player-facing names the mechanism.)

// The familiar's subspace range, in Life cells: the haunt radius
// the physics tick hunts within (see tick()). One constant, two
// readers — the hunt and the Vision can never drift apart.
export const FAMILIAR_RANGE_CELLS = 48;
export const AGGRO_TICKS = 300; // EE 1023: a struck familiar's grudge, in physics ticks (~3 min)
// EE 1088 (P-3): monsters, second pass — the pack remembers, and the
// ground it hunts over is the ground as edited.
export const SEARCH_TICKS = 120; // the pack's brief search at the last known place
export const PACK_SHARE_CELLS = 8; // the pack radius — the strike-aggro radius (EE 1034)
export const RISE_MIN_CELLS = 34; // a rise lands beyond the farthest sight (4 chunks = 32 cells)
export const REALM_SURFACE_CAP = 32; // a realm's standing surface population bound
export const TRAVERSAL_GROWTH_FLOOR = 0.34; // EE 1023: growth lent to cells around a moving fox
export const TRAVERSAL_CELLS = 10; // EE 1023: the traversal lend's reach, in Life cells

// EE 1037 (item 3): the Shadow's phase, from its wounds alone —
// phase 1 unwounded-ish (hp 5–6), phase 2 at hp <= 4 (it learns
// the rush), phase 3 at hp <= 2 (shorter tells, shorter mercy).
export function guardianPhase(m) {
  if (!m || m.kind !== "guardian") return 0;
  return m.hp <= 2 ? 3 : m.hp <= 4 ? 2 : 1;
}

// EE 1037 (item 3): what a strike against the Shadow is WORTH, in
// hit points of damage — the Heart gate, pure so the suite pins it
// and the view quotes it. Exposed Heart: the weapon's damage, +1
// for a charged blow (item 4). Shuttered Heart: a charged blow
// cracks the shutter for 1; anything else glances — 0. Non-guardian
// things are not gated: the weapon's damage stands.

// ---------- Attempt 2 (A2-MONSTER): the fight clock ---------------------
// Will (Play 1): "monster fights are no fun — write RPG-style actions
// for the enemies that apply on timer ticks, have them morph and grow
// more dangerous." The fight clock lives here, in subspace, beside
// the hunt: while a thing is ENGAGED (or aggroed) with the fox in its
// realm, its fight ticks accrue; on its action interval it performs
// the next action in its kind's repertoire (a deterministic cycle —
// every client reads the same fight); at its kind's thresholds it
// MORPHS — a visible stage change the view renders larger and hotter
// — and grows more dangerous: action damage rises with the stage,
// the action interval shortens, and at the final stage its pursuit
// gains a step. The wisp is exempt from all of it: it cannot hurt
// you, learns no actions, and never morphs. The husk never summons
// and never calls a pack — it is solitary (Item #6) — and no kind
// summons here at all: a struck glimmer's pack already answers
// through the strike share, and a second caller would double it.
export const FIGHT_STAGE_TICKS = {
  surface: [4, 14], // F-GROK-9: Glimmer: Kindled at 4, Unbound at 14 (was 10/24 — a fought glimmer died at about tick 7, before Kindled could ever show)
  husk: [12, 28],    // Cinder Husk: Cracked at 12, Molten at 28 — slower, like its pace
  guardian: [10, 24], // Keeper: Woken at 10, Heart-Bared at 24
  wisp: [],
};
export const FIGHT_STAGE_NAMES = {
  surface: ["Glimpse-true", "Kindled", "Unbound"],
  husk: ["Banked", "Cracked", "Molten"],
  guardian: ["Keeper", "Woken", "Heart-Bared"],
  wisp: ["Pale"],
};
export const MONSTER_ACTIONS = {
  surface: ["lunge", "spit", "guard"],
  husk: ["spit", "lunge", "brace"],
  guardian: ["shadow-spit", "roar"],
  wisp: [],
};
export const FIGHT_ACTION_BASE_TICKS = { surface: 5, husk: 7, guardian: 6, wisp: 0 };
export const RECOIL_TICKS = 2; // a landed strike flinches the thing for two ticks
export function monsterFightStage(kind, fightTicks) {
  const th = FIGHT_STAGE_TICKS[kind] || [];
  let s = 0;
  for (const t of th) if ((fightTicks || 0) >= t) s++;
  return s;
}
export function monsterActionDamage(m, base) {
  const stage = typeof m === "object" && m ? (m.fightStage || 0) : 0;
  return base + stage; // the morph is the menace: every stage lands harder
}
export function monsterActionInterval(kind, stage) {
  const b = FIGHT_ACTION_BASE_TICKS[kind] || 0;
  if (!b) return 0;
  return Math.max(3, b - (stage || 0));
}
// Low-HP white-out (Play 1): below a quarter of full health the
// screen starts to go white, deepening as the fox fades. Pure, so
// the suite pins the curve the view (syncHud) renders verbatim.
export const LOW_HP_FRAC = 0.25;
export function lowHpWhite(hp, maxHp) {
  if (!maxHp || maxHp <= 0) return { on: false, opacity: 0 };
  const frac = Math.max(0, hp) / maxHp;
  if (frac >= LOW_HP_FRAC) return { on: false, opacity: 0 };
  const k = (LOW_HP_FRAC - frac) / LOW_HP_FRAC; // 0 at the threshold, 1 at empty
  return { on: true, opacity: Math.min(0.88, k * 0.88) };
}

export function guardianStrikeDamage(m, opts = {}) {
  const base = opts.damage ?? 1;
  if (!m || m.kind !== "guardian") return base;
  const exposed = !!(m.boss && m.boss.state === "exposed");
  if (exposed) return base + (opts.charged ? 1 : 0);
  return opts.charged ? 1 : 0;
}

// Inside The Unexpected Hall: within the footprint AND down in
// the hall's own air. The hill above the hall shares the
// footprint (its surface stands at 20-24, far above the ceiling
// line) — standing on the hill is not inside; standing on the
// hall floor is, and so is standing flipped against the ceiling's
// underside, still below ceilY. The lower bound keeps the void
// below the world (the safety-net fall) from counting as inside.
// x, z are world positions; y is the fox's feet height.
export function inTheHall(x, y, z) {
  return inDungeon(Math.floor(x), Math.floor(z)) &&
    y < DUNGEON.ceilY && y > DUNGEON.floorY - 2;
}

// The toggle rule, pure so the suite can pin it: Fox Vision can
// only be switched ON inside the Hall. Switching off is always
// allowed — a sense you cannot put down would be a trap. An ON
// press outside the Hall is a quiet non-response: nothing changes.
export function foxVisionToggle(on, insideHall) {
  if (on) return false;
  return !!insideHall;
}

// Does Fox Vision reveal this familiar to a fox standing at Life
// cell (pcx, pcy)? Range only — phase is the whole point: the
// Vision sees a familiar in EVERY phase, which is what "night
// vision of all familiars" means. The dead are not revealed;
// they are already only a scar and a memory.
export function foxVisionReveals(m, pcx, pcy) {
  if (!m || !m.alive) return false;
  const dx = m.gx - pcx, dy = m.gy - pcy;
  return dx * dx + dy * dy <= FAMILIAR_RANGE_CELLS * FAMILIAR_RANGE_CELLS;
}

// ---------- things placed in the world: a weapon, three charms --------
// Feedback #9: a real weapon beyond the bare strike, and powerups
// with visible effects, placed so a first session meets both. The
// Star Lance waits in Nova Prime's spawn scroll, in plain sight of
// Arrival; the charms sit one per place a first session visits.
// Placement is deterministic (seed hashes), like everything else.

export const ITEM_DEFS = {
  sword: {
    kind: "sword", name: "the Small Sword", weapon: true,
    range: 5.2, damage: 1,
    blurb: "a small sword, bright and ready — it reaches a little farther than your bare paw",
    use: "A weapon. Swung, it hits for 1 at 5.2 blocks — three landed swings fell a glimmer.",
  },
  lance: {
    kind: "lance", name: "the Star Lance", weapon: true,
    range: 7.5, damage: 2,
    blurb: "it reaches farther and hits harder",
    use: "A weapon. Swung, it hits for 2 at 7.5 blocks — two landed swings fell even a glimmer.",
  },
  swift: {
    kind: "swift", name: "the Swift Charm", weapon: false,
    blurb: "your stride lengthens — the meadow goes by quicker",
    use: "Worn, it works on its own — no key, no keeping: your stride is a third longer, everywhere.",
  },
  ward: {
    kind: "ward", name: "the Ward Charm", weapon: false,
    blurb: "it will turn one blow aside for you",
    use: "Worn, it works on its own: the next blow that would land on you is turned aside, once.",
  },
  bright: {
    kind: "bright", name: "the Bright Charm", weapon: false,
    blurb: "the glimpses last longer; the dark gives up its shapes sooner",
    use: "Worn, it works on its own: dark things hold their visible phase longer, so you see them coming.",
  },
};
// Where each item stands: {realmId, bx, bz} in block coords. The
// view computes the standing height; the hall charm sits on the
// barrow floor (fixed y handled there too).
export const ITEM_SPOTS = {
  sword: { realmId: "nova", bx: 11, bz: 10 },
  lance: { realmId: "nova", bx: 15, bz: 12 },
  bright: { realmId: "nova", bx: 24, bz: 6 },
  swift: { realmId: "ashfall", bx: 13, bz: 11 },
  ward: { realmId: "nova", bx: 52, bz: 35, y: DUNGEON.floorY + 1 },
};

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
// EE 995 feedback (Will, 2026-11-26): "all of the worlds are
// identical — still using coordinates." Each realm now has its own
// landform language, not just its own noise seed: a terrain profile
// (mode + measures) read by heightAt, baseBlockAt and genChunk.
// Nova Prime and Ashfall Haven keep their exact historical formulas
// (their profiles encode them) — the played world does not move.
// P-5 (EE 1087 batch, Feature 5): one generation record per realm —
// REALM_GEN. Verticality (mode + measures), feature density and
// tree form, and the block-mix character, in ONE table keyed by
// realm identity, read by heightAt, baseBlockAt and genChunk. The
// measures below are the EE 995 values verbatim — Nova Prime and
// Ashfall Haven keep their exact historical formulas (their records
// encode them) and no realm's heights move; what P-5 adds is the
// record itself, the world-record scroll that carries it (the
// realmgen section below), and the organic dressing in baseBlockAt
// and genChunk. REALM_TERRAIN stays exported as REALM_GEN's
// verticality slice, so its existing readers never move.
export const REALM_GEN = {
  nova:      { mode: "roll",    base: 11, amp: 7,   amp2: 2.5, s1: 18, s2: 5, density: 0.011, trunk: 3, canopy: "oak",    mix: "meadow", lushT: 0.62, dryT: 0.66 },
  ashfall:   { mode: "ridge",   base: 9,  amp: 13,  amp2: 3,   s1: 18, s2: 5, density: 0.004, trunk: 3, canopy: "none",   mix: "strata", strataPeriod: 11 },
  "ni-knight": { mode: "terrace", base: 12, amp: 9, amp2: 2,   s1: 22, s2: 6, step: 3, density: 0.006, trunk: 0, canopy: "pillar", mix: "flags" },
  logos:     { mode: "terrace", base: 11, amp: 8,  amp2: 2,   s1: 30, s2: 8, step: 2, density: 0.004, trunk: 3, canopy: "none", mix: "sand" },
  elven:     { mode: "roll",    base: 11, amp: 6,  amp2: 2.5, s1: 16, s2: 5, density: 0.02,  trunk: 4, canopy: "oak",    mix: "meadow", lushT: 0.45, dryT: 0.66 },
  orchid:    { mode: "roll",    base: 11, amp: 3,  amp2: 1.5, s1: 20, s2: 6, density: 0.005, trunk: 3, canopy: "oak",    mix: "meadow", lushT: 0.75, dryT: 0.66 },
  halycon:   { mode: "roll",    base: 12, amp: 2,  amp2: 1,   s1: 34, s2: 10, density: 0,     trunk: 3, canopy: "none",   mix: "pale" },
  delta:     { mode: "channel", base: 11, amp: 6,  amp2: 2.5, s1: 18, s2: 5, density: 0.009, trunk: 3, canopy: "oak",    mix: "meadow", lushT: 0.62, dryT: 0.66 },
  willow:    { mode: "roll",    base: 11, amp: 8,  amp2: 3,   s1: 20, s2: 6, density: 0.011, trunk: 4, canopy: "willow", mix: "meadow", lushT: 0.55, dryT: 0.66 },
  plain:     { mode: "roll",    base: 12, amp: 1.2, amp2: 0.6, s1: 40, s2: 12, density: 0.003, trunk: 3, canopy: "oak",   mix: "meadow", lushT: 0.62, dryT: 0.80 },
  trust:     { mode: "ridge",   base: 8,  amp: 17,  amp2: 3.5, s1: 16, s2: 5, density: 0.004, trunk: 3, canopy: "none",   mix: "strata", strataPeriod: 9 },
};
export function realmGenParams(realmId) {
  return REALM_GEN[realmId] || REALM_GEN.nova;
}
export const REALM_TERRAIN = Object.fromEntries(Object.entries(REALM_GEN)
  .map(([id, g]) => {
    const t = { mode: g.mode, base: g.base, amp: g.amp, amp2: g.amp2, s1: g.s1, s2: g.s2 };
    if (g.step) t.step = g.step;
    return [id, t];
  }));
export function terrainFor(realmId) {
  return REALM_TERRAIN[realmId] || REALM_TERRAIN.nova;
}
// A strata realm's shale bands: the period is the realm's recorded
// character (REALM_GEN.strataPeriod); the phase is derived from the
// realm's seed — except Ashfall's, whose bands are historical
// (period 11, rows 4–5) and pinned exactly where they always were.
// Trust Fall wore Ashfall's bands verbatim until P-5; its period 9
// and seed-derived phase are its own geology now.
export function strataBand(realmId, y) {
  const g = realmGenParams(realmId);
  const period = g.strataPeriod || 11;
  const phase = realmId === "ashfall" ? 4
    : kernels.hash(`${realmById(realmId).seed}|strata`) % period;
  const m = ((y % period) + period) % period;
  return m === phase || m === (phase + 1) % period;
}
// The two slow fields P-5's organic dressing reads (exported so
// the suite can pin the dressing against the fields themselves):
// the patch field (cell 26) that clusters the meadow mix and
// Halycon's dusting, and the cluster field (cell 17) that gathers
// the boulders. Pure functions of the realm's seed, as all
// generation inputs are.
export function patchField(realmId, x, z) {
  return vnoise(`${realmById(realmId).seed}|patch`, x, z, 26);
}
export function clusterField(realmId, x, z) {
  return vnoise(`${realmById(realmId).seed}|cluster`, x, z, 17);
}
// The worn path (nova, P-5): the walked way from the arrival pad
// to the Hall's shaft mouth, worn into the surface dress — a pure
// function of the two endpoints. Dress only: it never moves a
// height, and it stops at the dungeon's edge (the Hall's own
// ground is built, not worn).
export function hallPathWear(x, z) {
  if (inDungeon(x, z)) return false;
  const ax = ARRIVAL.nova.x, az = ARRIVAL.nova.z;
  const bx = DUNGEON.shaftX + 1, bz = DUNGEON.shaftZ + 1;
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1,
    ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  const px = ax + t * dx, pz = az + t * dz;
  return Math.hypot(x - px, z - pz) <= 1.6;
}
// Delta Wood's river: the same noise read by heightAt (which carves
// the channel) and baseBlockAt (which dresses its bed).
export function deltaRiver(realmId, x, z) {
  if (realmId !== "delta") return 0;
  const v = vnoise(`${realmById(realmId).seed}|river`, x, z, 26);
  if (v <= 0.60 || v >= 0.68) return 0;
  return Math.sin(((v - 0.60) / 0.08) * Math.PI); // 0 at the banks, 1 mid-stream
}
export function heightAt(realmId, x, z) {
  const r = realmById(realmId);
  const t = terrainFor(realmId);
  const n1 = vnoise(`${r.seed}|h1`, x, z, t.s1);
  const n2 = vnoise(`${r.seed}|h2`, x, z, t.s2);
  let h;
  if (t.mode === "ridge") {
    // Sharper, more rugged: ridged noise.
    const ridge = 1 - Math.abs(2 * n1 - 1);
    h = Math.max(4, Math.floor(t.base + ridge * ridge * t.amp + n2 * t.amp2));
    // Ashfall's historical formula returned here — the Deep Stone
    // barrow below never raised Ashfall's ground. (Trust Fall,
    // the other ridge realm, is new: the barrow rule is the
    // generic one, as it is for every other realm.)
    if (realmId === "ashfall") return h;
  } else if (t.mode === "terrace") {
    h = t.base + Math.floor((n1 * t.amp + n2 * t.amp2) / t.step) * t.step;
  } else if (t.mode === "channel") {
    h = Math.floor(t.base + n1 * t.amp + n2 * t.amp2) -
      Math.round(3 * deltaRiver(realmId, x, z));
  } else {
    h = Math.floor(t.base + n1 * t.amp + n2 * t.amp2);
  }
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
    this.growth = new Map(); // "realm|gx,gy" -> 0..1 growth level (ramps, never snaps)
    this.chisel = new Map(); // realmId -> Map("x,y,z" -> 1|2) sub-block shaping
    this.items = []; // placed things (weapon + charms), see ITEM_DEFS
    this.dailyClaimed = new Set(); // date strings whose daily pocket was reached
    this.realmGravity = new Map(); // realmId -> +1|-1: down, remembered per WORLD (v5, feedback #25)
    this._itemsPlaced = new Set(); // realmIds whose (0,0)-scroll items exist
    this.genesisLife = null; // total alive cells when the first scrolls opened
    this._monsterSeq = 0;
    this.fightEvents = []; // A2-MONSTER: actions/morphs the view applies (hurt, cues)
    this._nextSpawnTick = 0; // EE 995: the random-rise clock (item 9)
    this.transitPocket = null; // EE 995: the wormhole's room (items 5+6) — set by beginTransit (restored, Attempt 2)
    this.riftLinks = new Map(); // EE 1023: standing rift links, registered by the view (item 1)
    this.tunnels = new Map(); // EE 1034: standing wormholes, key -> record (the chart's resolved set)
    this.geo = new Map(); // P-1: resolved shared geometry, realmId -> Map("x,y,z" -> block) (the chart's record, replayed)
    this.dragonKilled = false; // EE 1034: flight's second gate (Beat 2 sets it; nothing here does yet)
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
    // EE 1088 (P-3): the realm's standing bound — a scroll opens its
    // monster only while the realm holds fewer than the cap.
    if (kernels.hash(`${r.seed}|mon|${sx},${sy}`) % 100 < 70 &&
        this._realmSurfaceCount(realmId) < REALM_SURFACE_CAP) {
      const gx = sx * LIFE_N + 6 + (kernels.hash(`${r.seed}|mx|${sx},${sy}`) % 20);
      const gy = sy * LIFE_N + 6 + (kernels.hash(`${r.seed}|my|${sx},${sy}`) % 20);
      // Item #6 (THE CINDER HUSK): an Ashfall scroll that would rise
      // a surface thing rises a husk instead when the scroll's own
      // hash says so (one in four — see huskRises).
      const riseKind = realmId === "ashfall" && huskRises(r.seed, sx, sy)
        ? "husk" : "surface";
      this.spawnMonster(realmId, gx, gy, riseKind);
    }
    if (realmId === DUNGEON.realm && sx === 0 && sy === 0) {
      this.spawnMonster(realmId, DUNGEON.guardianCell.gx, DUNGEON.guardianCell.gy,
        "guardian");
    }
    if (sx === 0 && sy === 0 && !this._itemsPlaced.has(realmId)) {
      this._itemsPlaced.add(realmId);
      for (const def of Object.values(ITEM_DEFS)) {
        const spot = ITEM_SPOTS[def.kind];
        if (spot.realmId !== realmId) continue;
        this.items.push({
          id: def.kind, kind: def.kind, realmId,
          bx: spot.bx, bz: spot.bz, y: spot.y ?? null, taken: false,
        });
      }
    }
    return s;
  }

  // Take a placed thing. Returns the def exactly once; after that the
  // thing is yours and the place no longer holds it. The taking is
  // inscribed — written outlasts shown, for gear as for scars.
  pickupItem(id) {
    const it = this.items.find((i) => i.id === id && !i.taken);
    if (!it) return null;
    it.taken = true;
    const def = ITEM_DEFS[it.kind];
    this.log("pickup", realmById(it.realmId).name,
      `${def.name} is taken up — ${def.blurb}`);
    return def;
  }
  itemAt(realmId, bx, bz, radius = 1.6) {
    for (const it of this.items) {
      if (it.taken || it.realmId !== realmId) continue;
      if (Math.abs(it.bx + 0.5 - bx) <= radius && Math.abs(it.bz + 0.5 - bz) <= radius) {
        return it;
      }
    }
    return null;
  }

  // The growth level of one global cell (0 when nothing grows there).
  growthAt(realmId, gx, gy) {
    return this.growth.get(`${realmId}|${gx},${gy}`) || 0;
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
  //
  // v5 (feedback #8): the tick is LOCAL. With a player present, only
  // the scrolls in the player's neighborhood (their realm, within one
  // scroll in every direction) step Life and growth; scrolls farther
  // off sleep, and catch up in bounded steps when the neighborhood
  // reaches them again — the dormancy PHYSICS Law 5's engine note
  // already proposed for monsters, applied to the whole physics.
  // With no player (tests, tools), every scroll steps, as before.
  tick(player) {
    this.tickCount++;
    let live = [...this.scrolls.values()];
    if (player) {
      const psx = scrollOfBlock(player.bx), psy = scrollOfBlock(player.bz);
      const active = [];
      for (const s of live) {
        let near = s.realmId === player.realmId &&
          Math.abs(s.sx - psx) <= 1 && Math.abs(s.sy - psy) <= 1;
        if (!near && this.riftLinks.size) {
          // EE 1023 (item 1): a stitched scroll — an end of a
          // standing rift — steps too, though it is nowhere near
          // the fox. The door keeps both its ends alive.
          for (const L of this.riftLinks.values()) {
            if ((s.realmId === L.aRealm && s.sx === L.asx && s.sy === L.asy) ||
                (s.realmId === L.bRealm && s.sx === L.bsx && s.sy === L.bsy)) {
              near = true;
              break;
            }
          }
        }
        if (near) {
          // Catch-up: a scroll that slept steps its own Life forward
          // in bounded strides (its borders read as they are now —
          // an approximation the growth ramp forgives), then rejoins
          // the coupled step below.
          const missed = s.missedTicks || 0;
          if (missed > 0) {
            const strides = Math.min(missed, 24);
            for (let i = 0; i < strides; i++) {
              s.grid = kernels.life(s.grid, LIFE_N, LIFE_N);
            }
            s.missedTicks = 0;
          }
          active.push(s);
        } else {
          s.missedTicks = (s.missedTicks || 0) + 1;
        }
      }
      live = active;
    }
    // Life, coupled. Snapshot the stepping grids first so every
    // active scroll steps from the same instant; a sleeping
    // neighbor's border reads its last state.
    const snaps = new Map();
    for (const s of live) snaps.set(scrollKey(s.realmId, s.sx, s.sy), s.grid);
    const aliveIn = (realmId, gx, gy) => {
      const sx = Math.floor(gx / LIFE_N), sy = Math.floor(gy / LIFE_N);
      const g = snaps.get(scrollKey(realmId, sx, sy)) ||
        (this.getScroll(realmId, sx, sy, false) || {}).grid;
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
    const pcxG = player ? cellOfBlock(player.bx) : 0;
    const pcyG = player ? cellOfBlock(player.bz) : 0;
    // Growth: the accelerator, not the switch (feedback #6). Every
    // living cell carries a growth level that leans a few percent
    // per tick toward what the local pattern would support — dense
    // Life and hard neighbor pressure raise the target; a thinning
    // pattern lowers it, and the growth ebbs just as gradually.
    // Generation reads the level, so features creep and recede over
    // ~half a minute of ticks instead of popping.
    for (const s of live) {
      const ox = s.sx * LIFE_N, oy = s.sy * LIFE_N;
      const pcache = new Map();
      for (let ly = 0; ly < LIFE_N; ly++) {
        for (let lx = 0; lx < LIFE_N; lx++) {
          const gx = ox + lx, gy = oy + ly;
          const density = this.cellDensity(s.realmId, gx, gy);
          let target = Math.max(0, (density - 3) / 4);
          const pressure = borderPressure(this, s.realmId, gx, gy, pcache);
          if (pressure >= 0.45) target = Math.max(target, pressure);
          // EE 1023 (item 7): the overworld's geometry shifts
          // subtly as the fox TRAVERSES it. A moving fox lends the
          // cells around his path a growth floor — bloom and
          // crystal creep up along the walked country through this
          // same ramp and the same mesher, and ebb once he has
          // passed. Standing still lends nothing.
          if (player && player.pace > 0 && s.realmId === player.realmId &&
              Math.max(Math.abs(gx - pcxG), Math.abs(gy - pcyG)) <= TRAVERSAL_CELLS) {
            const lend = TRAVERSAL_GROWTH_FLOOR * Math.min(1, player.pace / 3);
            if (lend > target) target = lend;
          }
          const key = `${s.realmId}|${gx},${gy}`;
          const cur = this.growth.get(key) || 0;
          if (target === 0 && cur === 0) continue;
          const next = cur + (target - cur) * 0.07;
          if (next < 0.01 && target === 0) this.growth.delete(key);
          else this.growth.set(key, next);
        }
      }
    }
    // Monsters. A thing of the dark hunts the ground it haunts —
    // and only that ground. (Playtest 1, 2026-11-22: homing had no
    // range limit and nothing ever despawned, so every scroll a
    // player ever visited converged on the fox — a fleeing,
    // non-fighting player died twice in a 7-minute watch, and
    // exploration itself was the punishment. Mario's worlds are
    // safe to wander; the threat must be local.) Within its haunt
    // a monster steps toward the player; beyond it, the
    // monster drifts back to where it rose and rests there. The
    // haunt radius is FAMILIAR_RANGE_CELLS (48 cells, a scroll and
    // a half): the unit suite convicts anything smaller — a
    // monster a full scroll away is established to still be coming
    // (press-in test). Fox Vision reads the same constant: the
    // range a familiar can hunt the fox over is the range the
    // fox's Vision returns the gaze across.
    //
    // v5 (feedback #1): and things DO leave. A monster that has
    // rested at its rise-place, unwatched, for a long while sinks
    // back into the dark it came from — the record goes, the place
    // keeps only what was written in it (scars stay; a cleared
    // ground stays cleared). The dead are reaped on the same
    // schedule: a struck-out record lingers ~a minute so the view
    // can finish with it, then it is gone from the roll. Neither
    // ever happens near the player: "unwatched" means the player
    // is in another realm or at least two scrolls away.
    const speed = this.monsterSpeed();
    // EE 1034 (item 3): the fox's travel this tick, for intercepts.
    if (player) {
      const pvx = cellOfBlock(player.bx), pvy = cellOfBlock(player.bz);
      this._playerVel = this._playerCell
        ? { x: pvx - this._playerCell.x, y: pvy - this._playerCell.y }
        : { x: 0, y: 0 };
      this._playerCell = { x: pvx, y: pvy };
    }
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (m.kind === "wisp") continue; // it waits where it was set; it is for learning on
      if (m.aggro && m.aggroTicks !== undefined && --m.aggroTicks <= 0) m.aggro = false;
      // P-4: the flute snare counts down in ticks, beside the
      // aggro grudge; `snared` is this tick's truth, read before
      // the count falls so a fresh snare slows its first tick.
      const snared = m.kind !== "husk" && (m.snareTicks || 0) > 0; // Item #6: the husk is deaf — a stamped snare field never slows it
      if (snared) m.snareTicks--;
      if (!m.engaged) m.phase = (m.phase + 1) % 3; // engaged things hold their phase: they are THERE
      if (!player || player.realmId !== m.realmId) continue;
      if (m.hx === undefined) { m.hx = m.gx; m.hy = m.gy; }
      const pcx = cellOfBlock(player.bx), pcy = cellOfBlock(player.bz);
      const ddx = pcx - m.gx, ddy = pcy - m.gy;
      // EE 1037 (item 3): the Shadow keeps its own counsel — while
      // the fox is in its realm its fight is the state machine
      // below, not the generic hunt. (When the tick presents no
      // player — a featured introduction — the loop has already
      // continued above, so the fight holds its breath like
      // everything else.)
      if ((m.recoilTicks || 0) > 0) m.recoilTicks--; // A2-MONSTER: the flinch counts down for every kind
      if (m.kind === "guardian") { if (m.engaged || m.aggro) this._fightTick(m, pcx, pcy); this._guardianTick(m, pcx, pcy); continue; }
      // EE 995 (item 9): entering the player's sphere ENGAGES a
      // surface thing of the dark, permanently — its phase pins to
      // visible, the strike can always find it, and the reaper
      // below will never sink it back. What has found you stays.
      if ((m.kind === "surface" || m.kind === "husk") && !m.engaged &&
          ddx * ddx + ddy * ddy <= FAMILIAR_RANGE_CELLS * FAMILIAR_RANGE_CELLS) {
        m.engaged = true;
        m.phase = 0;
        this.log("engage", `${realmById(m.realmId).name} ${m.gx * 2 + 1},${m.gy * 2 + 1}`,
          "the dark thing has entered the fox's sphere — it will not fade now");
      }
      // EE 1023 (item 3): an aggroed thing hunts from ANY range —
      // the haunt radius is for the unprovoked — and steps faster.
      if (ddx * ddx + ddy * ddy <= FAMILIAR_RANGE_CELLS * FAMILIAR_RANGE_CELLS || m.aggro) {
        // EE 1034 (item 3): an engaged or aggroed thing INTERCEPTS —
        // it aims at where the fox is going (his cell plus his last
        // tick's travel), not only where he stands. A STALKER also
        // runs while the fox is far (one step more beyond 6 cells),
        // to arrive on the intercept line; close in, it walks.
        let tx = pcx, ty = pcy;
        if (m.engaged || m.aggro) {
          const pv = this._playerVel || { x: 0, y: 0 };
          tx += pv.x; ty += pv.y;
        }
        let steps = speed + (m.aggro ? 1 : 0) + ((m.fightStage || 0) >= 2 ? 1 : 0); // A2-MONSTER: an Unbound/Molten/Heart-Bared thing pursues a step faster
        if (m.role === "stalker" && ddx * ddx + ddy * ddy > 36) steps += 1;
        // P-4: a snared thing takes only its split share of the
        // steps — pursuit here and the drift home below alike, so
        // any movement this tick drives (a coming search of the
        // last-known ground included) is slowed by the same
        // field: the snare sits in the shared step computation,
        // not in any one behaviour.
        if (m.kind === "husk") steps = huskSteps(m, steps); // Item #6: slow by nature — the step-split discipline as its pace, not a status
        else if (snared) steps = snaredSteps(m, steps);
        for (let step = 0; step < steps; step++) this._monsterStep(m, tx, ty);
        // EE 1088 (P-3): contact is remembered — the fox's cell is
        // the pack's last known place, shared with the pack.
        if (m.kind === "surface") this._noteSeen(m, pcx, pcy);
      } else if (m.kind === "surface" && m.lastKnown &&
                 (m.mode === "hunt" || m.mode === "search")) {
        // EE 1088 (P-3): the trail has gone cold — search the last
        // known place briefly, then give up and go home.
        this._monsterSearch(m, snared ? snaredSteps(m, speed) : speed); // consumer composition (P-3 x P-4): a snared pack searches slower
      } else if (m.gx !== m.hx || m.gy !== m.hy) {
        const homeSteps = m.kind === "husk" ? huskSteps(m, speed)
          : snared ? snaredSteps(m, speed) : speed;
        for (let step = 0; step < homeSteps; step++) this._monsterStep(m, m.hx, m.hy);
      }
      // A2-MONSTER: the fight clock — an engaged or aggroed thing
      // with the fox in its realm accrues its fight, morphs, and
      // acts on its ticks. (A recoiling thing still accrues: the
      // flinch costs it movement above, not time.)
      if (m.engaged || m.aggro) this._fightTick(m, pcx, pcy);
    }
    // EE 995 (item 9): things of the dark also RISE at random
    // intervals while the fox walks a realm — not only when a
    // scroll is first opened. The wait is drawn fresh each time
    // from the tick's own hash (45–149 ticks, irregular by
    // construction); a rise lands at the sphere's approach
    // (34–44 cells out since EE 1088 (P-3) — beyond the farthest sight); the local hunt is capped at five so a
    // realm stays wanderable.
    if (player && !this.transitPocket) {
      if (!this._nextSpawnTick || this._nextSpawnTick < this.tickCount) {
        this._nextSpawnTick = this.tickCount + 45 +
          (kernels.hash(`spawnwait|${this.tickCount}|${this._monsterSeq}`) % 105);
      }
      if (this.tickCount >= this._nextSpawnTick) {
        this._nextSpawnTick = this.tickCount + 45 +
          (kernels.hash(`spawnwait|${this.tickCount}|${this._monsterSeq}`) % 105);
        const pcx = cellOfBlock(player.bx), pcy = cellOfBlock(player.bz);
        let local = 0;
        for (const m of this.monsters) {
          if (!m.alive || (m.kind !== "surface" && m.kind !== "husk") || m.realmId !== player.realmId) continue;
          const dx = m.gx - pcx, dy = m.gy - pcy;
          if (dx * dx + dy * dy <= FAMILIAR_RANGE_CELLS * FAMILIAR_RANGE_CELLS) local++;
        }
        // EE 1088 (P-3): a rise lands beyond the farthest sight —
        // never in plain view of the fox it will hunt — and the
        // realm's standing bound caps the rise as it caps the
        // scroll-open spawn.
        if (local < 5 && this._realmSurfaceCount(player.realmId) < REALM_SURFACE_CAP) {
          const hsh = kernels.hash(`rise|${this.tickCount}|${this._monsterSeq}`);
          const ang = (hsh % 628) / 100, dist = RISE_MIN_CELLS + ((hsh >> 3) % 11);
          const gx = pcx + Math.round(Math.cos(ang) * dist);
          const gy = pcy + Math.round(Math.sin(ang) * dist);
          this.spawnMonster(player.realmId, gx, gy, "surface");
          this.log("rise", `${realmById(player.realmId).name} ${gx * 2 + 1},${gy * 2 + 1}`,
            "unbidden, the dark sends another — it rose at a random hour");
        }
      }
    }
    // Despawn and reaping (v5, feedback #1).
    if (this.monsters.length) {
      const psx = player ? scrollOfBlock(player.bx) : 0;
      const psy = player ? scrollOfBlock(player.bz) : 0;
      const kept = [];
      for (const m of this.monsters) {
        if (!m.alive) {
          // Reap the dead once the view has had its minute.
          if (this.tickCount - (m.diedAt ?? this.tickCount) > 90) continue;
          kept.push(m);
          continue;
        }
        if (m.kind === "surface" || m.kind === "husk") {
          if (m.hx === undefined) { m.hx = m.gx; m.hy = m.gy; }
          const atHome = m.gx === m.hx && m.gy === m.hy;
          const msx = Math.floor(m.gx / LIFE_N), msy = Math.floor(m.gy / LIFE_N);
          const unwatched = !player || player.realmId !== m.realmId ||
            Math.max(Math.abs(msx - psx), Math.abs(msy - psy)) >= 2;
          if (atHome && unwatched && !m.engaged) {
            m.restTicks = (m.restTicks || 0) + 1;
            if (m.restTicks > 150) {
              this.log("fade", `${realmById(m.realmId).name} ${m.gx * 2 + 1},${m.gy * 2 + 1}`,
                "unwatched, the dark thing sinks back into the dark");
              continue; // it is gone
            }
          } else {
            m.restTicks = 0;
          }
        }
        kept.push(m);
      }
      this.monsters = kept;
    }
  }

  _monsterStep(m, pcx, pcy) {
    const dx = pcx - m.gx, dy = pcy - m.gy;
    if (dx === 0 && dy === 0) return;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    // EE 1034 (item 3): the greedy axes first, then the diagonal
    // (cutting the corner is cutting the fox off), then wall-slides
    // — steps along the obstacle that do not give ground. A thing
    // that used to freeze against a rise now works around it.
    const axes =
      Math.abs(dx) >= Math.abs(dy)
        ? [{ x: sx, y: 0 }, { x: 0, y: sy }]
        : [{ x: 0, y: sy }, { x: sx, y: 0 }];
    axes.push({ x: sx, y: sy }, { x: 0, y: -sy }, { x: -sx, y: 0 });
    const dist = (x, y) => Math.abs(pcx - x) + Math.abs(pcy - y);
    const fromScroll = `${Math.floor(m.gx / LIFE_N)},${Math.floor(m.gy / LIFE_N)}`;
    for (const a of axes) {
      if (a.x === 0 && a.y === 0) continue;
      const nx = m.gx + a.x, ny = m.gy + a.y;
      // Only the diagonal may hold its ground; every other step
      // must close distance or keep it — never retreat.
      const diagonal = a.x !== 0 && a.y !== 0;
      if (!diagonal && dist(nx, ny) > dist(m.gx, m.gy)) continue;
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
    // Surface things walk the surface AS EDITED: a step is fine if
    // the ground — the replayed record's ground, not generation's
    // ghost — doesn't jump by more than a body-height (EE 1088, P-3).
    const cur = this.groundHeightAt(m.realmId, m.gx * 2 + 1, m.gy * 2 + 1);
    const nxt = this.groundHeightAt(m.realmId, bx, bz);
    return Math.abs(nxt - cur) <= 3;
  }

  // EE 1088 (P-3): the surface height of one block column in the
  // world AS EDITED — the ground a monster stands on is the ground
  // the player shaped. Layers resolve exactly as genChunk stamps
  // them: local overrides over the geometry record (P-1's resolved
  // layer, when this Subspace carries one) over base generation. A
  // realm carrying neither edits nor a record returns heightAt
  // untouched, so the unedited world paths exactly as shipped.
  groundHeightAt(realmId, bx, bz) {
    const h = heightAt(realmId, bx, bz);
    const ov = this.overrides.get(realmId);
    const geo = this.geo ? this.geo.get(realmId) : null;
    if ((!ov || ov.size === 0) && (!geo || geo.size === 0)) return h;
    for (let y = WORLD_H - 1; y >= 0; y--) {
      const key = `${bx},${y},${bz}`;
      let b;
      if (ov && ov.has(key)) b = ov.get(key);
      else if (geo && geo.has(key)) b = geo.get(key);
      else if (y > h) continue; // open air above the generated surface
      else {
        b = baseBlockAt(this, realmId, bx, y, bz, h);
        if (b === CARVE) b = BLOCK.AIR;
      }
      if (b !== BLOCK.AIR) return y;
    }
    return 0; // a column carved to the bedrock: the bedrock holds
  }

  // EE 1088 (P-3): how many living surface things a realm holds —
  // the standing bound both automatic sources consult.
  _realmSurfaceCount(realmId) {
    let n = 0;
    for (const m of this.monsters) {
      if (m.alive && (m.kind === "surface" || m.kind === "husk") && m.realmId === realmId) n++; // Item #6: husks count toward the cap exactly as surface things do
    }
    return n;
  }

  // EE 1088 (P-3): contact, remembered and shared. The fox's cell
  // becomes the pack's last known place: packmates within the
  // strike-aggro radius (the pack is the group that already answers
  // a blow together) are told, so when the trail dies the whole
  // pack — not just the one who saw him — searches the same ground.
  _noteSeen(m, pcx, pcy) {
    m.mode = "hunt";
    m.lastKnown = { x: pcx, y: pcy };
    m.searchTicks = 0;
    for (const o of this.monsters) {
      if (o === m || !o.alive || o.kind !== "surface" ||
          o.realmId !== m.realmId) continue;
      const dx = o.gx - m.gx, dy = o.gy - m.gy;
      if (dx * dx + dy * dy > PACK_SHARE_CELLS * PACK_SHARE_CELLS) continue;
      o.lastKnown = { x: pcx, y: pcy };
      if (o.mode === "search") o.searchTicks = SEARCH_TICKS; // fresh trail: full clock
      else if (!o.mode) o.mode = "hunt"; // at rest: it joins the pack's hunt
    }
  }

  // EE 1088 (P-3): the search. The pack has lost the fox; it goes to
  // where he was last known and works the ground briefly — a ring of
  // waypoints around the place, time-sliced so one unreachable point
  // (a trench the player dug is a wall to the searcher too) never
  // eats the whole search — then gives up: the memory clears and the
  // shipped drift home resumes. Written in the log at both ends.
  _monsterSearch(m, speed) {
    if (m.mode === "hunt") {
      m.mode = "search";
      m.searchTicks = SEARCH_TICKS;
      this.log("search", `${realmById(m.realmId).name} ${m.lastKnown.x * 2 + 1},${m.lastKnown.y * 2 + 1}`,
        "the pack has lost the fox — it searches where he was last known");
    }
    if (--m.searchTicks <= 0) {
      m.mode = null;
      m.lastKnown = null;
      m.searchTicks = 0;
      this.log("give-up", `${realmById(m.realmId).name} ${m.gx * 2 + 1},${m.gy * 2 + 1}`,
        "the search cools — the pack disperses, each to where it rose");
      return;
    }
    const lk = m.lastKnown;
    let tx = lk.x, ty = lk.y;
    if (m.gx === lk.x && m.gy === lk.y) {
      // At the place: work the ring. The slice turns every 15 ticks.
      const RING = [[2, 0], [0, 2], [-2, 0], [0, -2],
                    [2, 2], [-2, 2], [2, -2], [-2, -2]];
      const idx = Math.floor((SEARCH_TICKS - m.searchTicks) / 15) % RING.length;
      tx = lk.x + RING[idx][0];
      ty = lk.y + RING[idx][1];
      if (m.gx === tx && m.gy === ty) return; // holding this waypoint
    }
    for (let step = 0; step < speed; step++) this._monsterStep(m, tx, ty);
  }

  // --- monsters ------------------------------------------------------------

  spawnMonster(realmId, gx, gy, kind) {
    const m = {
      id: ++this._monsterSeq, realmId, gx, gy, kind,
      nativeRealmId: realmId, // where it rose; carrying never rewrites this
      hx: gx, hy: gy, // where it rose; where it rests (v5 despawn)
      restTicks: 0,
      // EE 1088 (P-3): the pack's memory — where the fox was last
      // known, and what the thing is doing about it.
      mode: null, lastKnown: null, searchTicks: 0,
      engaged: false, // EE 995: latched forever once it enters the fox's sphere
      // A2-MONSTER: the fight clock — ticks in this fight, the morph
      // stage they have earned, the action cycle, brace and recoil.
      fightTicks: 0, fightStage: 0, nextActionTick: 0, actionSeq: 0,
      guardTicks: 0, recoilTicks: 0, hurtSeq: 0,
      phase: 1 + (kernels.hash(`phase|${this._monsterSeq}`) % 2),
      alive: true,
      // EE 1034 (item 3): a surface thing takes TWO hits now — a
      // fight, not a swat. F-GROK-9: a glimmer takes THREE now —
      // the sword and the bare paw take three landed strikes, the
      // Lance (damage 2) two — so a fought glimmer lives past its
      // Kindled morph (fight tick 4) and is seen larger before it
      // dies. The wisp keeps two; it is for learning on.
      // EE 1037 (item 3): the Shadow takes SIX true strikes now —
      // but see the gate below: most strikes are not true. The
      // number is not the difficulty; the shuttered Heart is.
      hp: kind === "guardian" ? 6 : kind === "husk" ? 4 : kind === "surface" ? 3 : 2, // Item #6: the husk is hard — four true strikes (the Lance's damage 2 fells it in two); F-GROK-9: the glimmer's 3 is above
      boss: null, // EE 1037 (item 3): the Shadow's fight state (guardians only)
      // EE 1034 (item 3): one surface thing in three is a STALKER —
      // it runs to cut the fox off; the rest are hunters.
      role: kind === "surface"
        ? (kernels.hash(`role|${this._monsterSeq}`) % 3 === 0 ? "stalker" : "hunter")
        : kind === "husk" ? "hunter" // Item #6: always a hunter, never a stalker — it comes straight at the fox
        : kind,
    };
    this.monsters.push(m);
    return m;
  }
  // Carrying (Will, 2026-11-24): "monsters start out native to
  // different regions of subspace, but can be carried across by
  // the rifts players open." A carried thing thereafter LIVES in
  // the region it was carried to: its haunt (hx, hy) moves with
  // it, so the step and despawn logic treats it as a resident of
  // the new ground — it hunts there, drifts home there, and rests
  // and fades there like anything that rose there. Nativeness
  // does not move: nativeRealmId still names where it rose, and
  // carrying never rewrites it. 'surface' things and cinder husks
  // (Item #6) are carriable — wisps wait where they were set, and
  // the guardian keeps its hall.
  carryMonster(m, toRealmId, gx, gy) {
    if (!m || !m.alive) return false;
    if (m.kind === "wisp" || m.kind === "guardian") return false;
    const nativeId = m.nativeRealmId ?? m.realmId;
    m.realmId = toRealmId;
    m.gx = gx;
    m.gy = gy;
    m.hx = gx;
    m.hy = gy;
    m.restTicks = 0;
    m.mode = null; // EE 1088 (P-3): carried through a rift, the trail is cold
    m.lastKnown = null;
    m.searchTicks = 0;
    this.log("carry", `${realmById(toRealmId).name} ${gx * 2 + 1},${gy * 2 + 1}`,
      `the dark thing is carried through a rift from ${realmById(nativeId).name}, where it rose, to ${realmById(toRealmId).name}, where it now lives`);
    return true;
  }
  monsterVisible(m) {
    if (!m.alive) return false;
    if (m.kind === "wisp") return true; // the training thing stays in the light
    if (m.engaged) return true; // EE 995: engaged things do not fade
    // Item #6: the husk does not phase-dance — it stays shown for
    // two phases of three (the Bright Charm's longer glimpse is
    // its natural state, inside this same visibility mechanism).
    if (m.kind === "husk") return m.phase !== 2;
    return m.phase === 0;
  }
  // A strike that lands: the thing is edited out of the world, and
  // the place keeps the scar — an override the generator will honor
  // on every future derivation of that chunk.
  strikeMonster(m) {
    if (!m.alive) return false;
    // A2-MONSTER: a braced thing turns the blow — the guard/brace
    // action's whole worth. The glance spends the brace, deals
    // nothing, and does not count as a landed strike (no recoil).
    if ((m.guardTicks || 0) > 0) {
      m.guardTicks = 0;
      this.log("guard", realmById(m.realmId).name,
        `the ${m.kind === "husk" ? "cinder husk" : "dark thing"} braces — the strike glances off`);
      return false;
    }
    m.hp--;
    // A2-MONSTER: every landed strike recoils the thing — the view
    // flinches its mesh on recoilTicks (the countdown lives
    // here; movement does not — the hunt's discipline is pinned). hurtSeq lets the view sound
    // the hurt noise exactly when a strike truly landed.
    m.recoilTicks = RECOIL_TICKS;
    m.hurtSeq = (m.hurtSeq || 0) + 1;
    if (m.hp > 0) {
      // EE 1023 (item 3): a struck thing AGGROES. It engages —
      // phase pinned, there to be struck at — and hunts the fox
      // past its haunt until the grudge cools (the monster step
      // keeps the clock). The training wisp is exempt: it waits
      // where it was set, for learning on.
      if (m.kind !== "wisp") {
        m.aggro = true;
        m.aggroTicks = AGGRO_TICKS;
        if (!m.engaged) { m.engaged = true; m.phase = 0; }
        // EE 1034 (item 3): the pack answers a blow. Surface things
        // near a struck thing share its grudge — striking one of a
        // group is striking the group. Item #6: the husk is
        // solitary — its blow calls no pack (and, its kind not
        // being "surface", a pack call never reaches it either).
        if (m.kind === "surface") for (const o of this.monsters) {
          if (o === m || !o.alive || o.kind !== "surface" ||
              o.realmId !== m.realmId) continue;
          const pdx = o.gx - m.gx, pdy = o.gy - m.gy;
          if (pdx * pdx + pdy * pdy > 64) continue;
          o.aggro = true;
          o.aggroTicks = Math.max(o.aggroTicks || 0, AGGRO_TICKS);
          if (!o.engaged) { o.engaged = true; o.phase = 0; }
        }
      }
      this.log("strike", realmById(m.realmId).name,
        `the ${m.kind === "guardian" ? "guardian" : m.kind === "husk" ? "cinder husk" : "dark thing"} is struck and holds (${m.hp} left)`);
      return false;
    }
    m.alive = false;
    // F-GROK-9 (d): the dead thing's queued fight events die with
    // it — a status word ("it braces") must never outlive its creature.
    this.fightEvents = this.fightEvents.filter((ev) => ev.monsterId !== m.id);
    m.diedAt = this.tickCount; // the reaper's clock (v5, feedback #1)
    const bx = m.gx * 2 + 1, bz = m.gy * 2 + 1;
    const by = m.kind === "guardian" ? DUNGEON.floorY + 1 : heightAt(m.realmId, bx, bz) + 1;
    this.setOverride(m.realmId, bx, by, bz, BLOCK.SCAR);
    this.log("scar", `${realmById(m.realmId).name} ${bx},${bz}`,
      m.kind === "husk" && m.nativeRealmId && m.nativeRealmId !== m.realmId
        ? `struck out of the world; the place keeps the scar — the cinder husk rose in ${realmById(m.nativeRealmId).name}`
        : "struck out of the world; the place keeps the scar");
    return true;
  }

  // A2-MONSTER: one tick of the fight clock for one engaged thing.
  // Runs after its movement (the stage a tick earns never moves the
  // thing on that same tick). Fires the next repertoire action when
  // the schedule comes due; the action's world half happens here
  // (a brace raises guardTicks), and its view half —
  // hurt for the fox, sounds, words — is queued as a fight event
  // the view drains (the boss.slamTick idiom, generalized).
  _fightTick(m, pcx, pcy) {
    const rep = MONSTER_ACTIONS[m.kind] || [];
    if (!rep.length) return; // the wisp learns nothing
    if ((m.guardTicks || 0) > 0) m.guardTicks--;
    m.fightTicks = (m.fightTicks || 0) + 1;
    const stage = monsterFightStage(m.kind, m.fightTicks);
    if (stage !== (m.fightStage || 0)) {
      m.fightStage = stage;
      this.fightEvents.push({ type: "monsterAction", action: "morph",
        monsterId: m.id, kind: m.kind, damage: 0, stage,
        gx: m.gx, gy: m.gy, realmId: m.realmId, tick: this.tickCount });
      this.log("morph", realmById(m.realmId).name,
        `the ${m.kind === "husk" ? "cinder husk" : m.kind === "guardian" ? "guardian" : "dark thing"} morphs — ${FIGHT_STAGE_NAMES[m.kind][stage]} (stage ${stage})`);
    }
    if (!m.nextActionTick) m.nextActionTick = this.tickCount + monsterActionInterval(m.kind, stage) - 1; // first action lands ON the interval-th fight tick
    if (this.tickCount < m.nextActionTick) return;
    m.nextActionTick = this.tickCount + monsterActionInterval(m.kind, stage);
    const action = rep[(m.actionSeq || 0) % rep.length];
    m.actionSeq = (m.actionSeq || 0) + 1;
    const dx = pcx - m.gx, dy = pcy - m.gy;
    const dist = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev, the hunt's own measure
    const ev = { type: "monsterAction", action, monsterId: m.id, kind: m.kind,
      damage: 0, stage, gx: m.gx, gy: m.gy, realmId: m.realmId, tick: this.tickCount };
    if (action === "lunge") {
      // A strike-range action: it connects within two cells. It does
      // NOT step the thing in subspace — monster movement has one
      // discipline (the hunt's steps, the snare's split, the husk's
      // pace), pinned exactly by the suite, and an action that
      // smuggled extra steps would break all three. The view
      // carries the lunge's motion (the mesh darts on the event).
      if (dist <= 2) ev.damage = monsterActionDamage(m, 1);
      this.fightEvents.push(ev);
    } else if (action === "spit" || action === "shadow-spit") {
      const range = m.kind === "guardian" ? 12 : m.kind === "husk" ? 9 : 11;
      if (dist <= range) {
        ev.damage = monsterActionDamage(m, m.kind === "guardian" ? 2 : 1);
        this.fightEvents.push(ev);
      }
    } else if (action === "guard" || action === "brace") {
      m.guardTicks = 3; // braced for the next three ticks; one glance spends it
      this.fightEvents.push(ev);
    } else if (action === "roar") {
      this.fightEvents.push(ev); // no damage: the sound of growing bolder
    }
  }
  drainFightEvents() {
    const evs = this.fightEvents;
    this.fightEvents = [];
    return evs;
  }

  // --- the Shadow (EE 1037, item 3) ------------------------------------------
  // The Unexpected Hall's guardian becomes a real fight. In the
  // world's terms: the Shadow bears the Heart at its chest, and the
  // Heart is its weak point (canon — Joy's barrow line: "Find the
  // Shadow, strike at the Heart"). Most of the time the Heart is
  // SHUTTERED — guarded, dim, and strikes glance off it. The fight
  // is a wheel the fox learns to read:
  //   guard    — it keeps its post by the stone, asleep to the fox.
  //   stalk    — woken, it comes at the fox (intercept, like the
  //              hunters) until it stands in slam reach.
  //   telegraph — it REARS for 2 ticks (1 tick in phase 3): held
  //              still, eyes flaring. The tell is long on purpose:
  //              the lesson is *move*.
  //   slam     — one tick: it falls on its own cell and the cells
  //              beside it. game3 reads slamTick and applies the
  //              hurt (game3 owns all player hurt); a fox who
  //              moved a cell, jumped, or dashed is not there.
  //   exposed  — the slam spends it: 3 ticks (2 in phase 3) with
  //              the chest-Heart flared full. Strikes land true.
  //   wind/rush (phase 2+) — after an exposure it lowers, locks its
  //              line on the fox's cell, and rushes up to 4 cells
  //              along it; then it is exposed again, briefly.
  // Phases derive from hp (guardianPhase): the fight tightens as
  // the Shadow loses it. If the fox leaves the hall's reach the
  // wheel sleeps back to guard; the wounds persist.
  _guardianTick(m, pcx, pcy) {
    if (!m.boss) m.boss = { state: "guard", t: 0, slamTick: -1, slamCell: null, rushDir: null };
    const b = m.boss;
    const phase = guardianPhase(m);
    const distC = Math.max(Math.abs(pcx - m.gx), Math.abs(pcy - m.gy));
    if (b.state === "guard") {
      if (distC <= 6) {
        b.state = "stalk"; b.t = 0;
        m.engaged = true; m.phase = 0;
        this.log("boss", `${realmById(m.realmId).name} ${m.gx * 2 + 1},${m.gy * 2 + 1}`,
          "the Shadow wakes — the fight for the Heart begins");
      } else if (m.gx !== m.hx || m.gy !== m.hy) {
        this._monsterStep(m, m.hx, m.hy); // drift back to its post
      }
      return;
    }
    if (distC > 8 && b.state === "stalk") {
      b.state = "guard"; b.t = 0; // the fox is gone from the hall's reach
      return;
    }
    b.t++;
    if (b.state === "stalk") {
      const pv = this._playerVel || { x: 0, y: 0 };
      const steps = phase === 3 ? 2 : 1;
      for (let s = 0; s < steps; s++) this._monsterStep(m, pcx + pv.x, pcy + pv.y);
      const nd = Math.max(Math.abs(pcx - m.gx), Math.abs(pcy - m.gy));
      if (nd <= 1) {
        b.state = "telegraph"; b.t = 0;
        this.log("boss", `${realmById(m.realmId).name} ${m.gx * 2 + 1},${m.gy * 2 + 1}`,
          "the Shadow rears — its slam is coming");
      }
    } else if (b.state === "telegraph") {
      if (b.t >= (phase === 3 ? 1 : 2)) {
        b.state = "slam"; b.t = 0;
        b.slamTick = this.tickCount;
        b.slamCell = { gx: m.gx, gy: m.gy };
        this.log("boss", `${realmById(m.realmId).name} ${m.gx * 2 + 1},${m.gy * 2 + 1}`,
          "the Shadow falls — the slam lands");
      }
    } else if (b.state === "slam") {
      b.state = "exposed"; b.t = 0;
    } else if (b.state === "exposed") {
      if (b.t >= (phase === 3 ? 2 : 3)) {
        // The wheel alternates its spends: a slam's exposure is
        // followed (phase 2+) by the rush; a rush's exposure is
        // followed by the stalk, so the slam always comes round
        // again — neither attack is the whole fight.
        if (phase >= 2 && !b.afterRush) { b.state = "wind"; b.t = 0; }
        else { b.state = "stalk"; b.t = 0; b.afterRush = false; }
      }
    } else if (b.state === "wind") {
      b.rushDir = { x: Math.sign(pcx - m.gx), y: Math.sign(pcy - m.gy) };
      if (b.t >= 1) { b.state = "rush"; b.t = 0; }
    } else if (b.state === "rush") {
      const d = b.rushDir || { x: 0, y: 0 };
      for (let s = 0; s < 4; s++) {
        const nx = m.gx + d.x, ny = m.gy + d.y;
        if (!this._monsterPassable(m, nx, ny)) break;
        m.gx = nx; m.gy = ny;
      }
      this.log("boss", `${realmById(m.realmId).name} ${m.gx * 2 + 1},${m.gy * 2 + 1}`,
        "the Shadow rushes — and spends itself");
      b.state = "exposed"; b.t = 0; b.afterRush = true;
    }
  }

  // --- gravity ---------------------------------------------------------------
  // v5 (feedback #25): down is remembered per WORLD, not per page.
  // A flip anywhere in a realm is the realm's down everywhere in
  // it, from then on — the memory lives on the realm, and every
  // scroll of the realm is kept in step with it. (PHYSICS Law 3
  // frames the naming as per-room; the per-world ruling is the
  // wider memory, and the law's text is Will's to amend — see
  // V5-REPORT.md.) Scrolls created before any flip still carry
  // their own gravDir, which gravityOf honors until the realm's
  // first flip sets the realm memory.

  gravityOf(realmId, sx, sy) {
    const remembered = this.realmGravity.get(realmId);
    if (remembered !== undefined) return remembered;
    const s = this.getScroll(realmId, sx, sy, false);
    return s ? s.gravDir : 1;
  }
  flipGravity(realmId, sx, sy) {
    const next = -this.gravityOf(realmId, sx, sy);
    this.realmGravity.set(realmId, next);
    for (const s of this.scrolls.values()) {
      if (s.realmId === realmId) s.gravDir = next;
    }
    this.log("warp", realmById(realmId).name,
      `down is now ${next > 0 ? "down" : "up"} across the whole realm — the world remembers`);
    return next;
  }
  // Attune this view to a gravity the SHARED chart declares (the
  // gravity scroll, demo10): the realm's down as read back from
  // subspace, applied without a flip's inscription — reading is not
  // writing. Every scroll of the realm is kept in step, exactly as
  // a flip keeps them. Returns true when the realm's down actually
  // changed under this call.
  applyRealmGravity(realmId, dir) {
    const next = dir < 0 ? -1 : 1;
    const changed = this.realmGravity.get(realmId) !== next;
    this.realmGravity.set(realmId, next);
    for (const s of this.scrolls.values()) {
      if (s.realmId === realmId) s.gravDir = next;
    }
    return changed;
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

  // --- the chisel: granular deformation (feedback #10) ------------------
  // A block is not all-or-nothing any more. Each chisel stroke shapes
  // it down a level (the view draws it shrunk by its level); the
  // third stroke breaks it, and the breaking is an inscription — an
  // AIR override the generator honors forever. Shaping is written
  // too: levels live here, in the world truth, not in the view.
  chiselLevel(realmId, x, y, z) {
    const m = this.chisel.get(realmId);
    return m ? m.get(`${x},${y},${z}`) || 0 : 0;
  }
  // EE 1023 (item 1): rift links REGISTER in subspace. While a link
  // stands, the tick steps the far end's scroll alongside the
  // player's neighborhood — the two ends of a rift are stitched in
  // the simulation, so the world across the door stays alive while
  // the door stands. (Before EE 1023 a rift was a view-layer object
  // only; subspace now accommodates it.) Ends arrive in the view's
  // riftEnd shape; their scrolls are precomputed here.
  noteRiftLink(id, a, b) {
    this.riftLinks.set(id, {
      aRealm: a.realmId, asx: scrollOfBlock(a.landX), asy: scrollOfBlock(a.landZ),
      bRealm: b.realmId, bsx: scrollOfBlock(b.landX), bsy: scrollOfBlock(b.landZ),
    });
  }
  clearRiftLink(id) {
    this.riftLinks.delete(id);
  }

  // EE 1034 (item 5): the dragon flag. Beat 2's dragon, when it
  // dies, sets this — and flight's gate opens for the slayer.
  // Nothing in this build calls it in normal play; that absence is
  // correct (the dragon is Christmas), and the setter is wal-logged
  // like every world fact.
  setDragonKilled(v) {
    this.dragonKilled = !!v;
    if (v) this.log("dragon", "the chart",
      "the dragon is dead — flight's second gate stands open");
  }

  // EE 1034 (item 1): adopt the chart's resolved standing wormholes.
  // Returns the keys whose presence or shape changed, so the view
  // can rebuild exactly the chunks those tunnels touch.
  applyTunnels(tunnels) {
    const before = this.tunnels;
    this.tunnels = new Map((tunnels || []).map((t) => [t.key, t]));
    const changed = [];
    for (const [k, t] of this.tunnels) {
      if (!before.has(k) || before.get(k).ts !== t.ts) changed.push(k);
    }
    for (const k of before.keys()) if (!this.tunnels.has(k)) changed.push(k);
    return changed;
  }

  // P-1: adopt the chart's resolved geometry record (the mirror of
  // applyTunnels). Returns the "realm|x,y,z" keys whose standing
  // block changed, so the view can rebuild exactly the chunks those
  // cells touch.
  applyGeometry(resolved) {
    const before = this.geo;
    this.geo = resolved || new Map();
    const changed = [];
    for (const [realmId, m] of this.geo) {
      const bm = before.get(realmId);
      for (const [k, v] of m) {
        if (!bm || bm.get(k) !== v) changed.push(`${realmId}|${k}`);
      }
    }
    for (const [realmId, bm] of before) {
      const m = this.geo.get(realmId);
      for (const k of bm.keys()) {
        if (!m || !m.has(k)) changed.push(`${realmId}|${k}`);
      }
    }
    return changed;
  }

  chiselBlock(realmId, x, y, z) {
    const b = baseBlockAt(this, realmId, x, y, z);
    // v5 (feedback #11): a refusal now NAMES itself. There is no
    // depth limit and never was — three different things refuse,
    // and the view can finally say which one it was.
    if (b === BLOCK.BEDROCK) return { ok: false, level: 0, broke: false, reason: "bedrock" };
    if (b === BLOCK.DEEPSTONE) return { ok: false, level: 0, broke: false, reason: "deepstone" };
    if (b === BLOCK.AIR) return { ok: false, level: 0, broke: false, reason: "air" };
    if (this.getOverride(realmId, x, y, z) === BLOCK.AIR) {
      return { ok: false, level: 3, broke: true, reason: "gone" };
    }
    // EE 1023 (item 8): single click to carve. One stroke now does
    // what three did — the block breaks through, and the break is
    // the inscription, exactly as the third stroke's was. (The
    // degrees remain in the mesh for marks the older world already
    // carries; a fresh stroke finishes any degree it finds.)
    if (!this.chisel.has(realmId)) this.chisel.set(realmId, new Map());
    const m = this.chisel.get(realmId);
    m.delete(`${x},${y},${z}`);
    this.setOverride(realmId, x, y, z, BLOCK.AIR);
    this.log("break", `${realmById(realmId).name} ${x},${y},${z}`,
      "carved through in a single stroke — the mark stays");
    return { ok: true, level: 3, broke: true };
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

// ---------- gravity on the shared chart (demo10) --------------------------
// Will's ruling (2026-11-26): gravity is stored in subspace on a
// per-realm basis — a real change, not a local flag — and a player
// may shift a realm's gravity at most once per day per realm. The
// store is one append-only scroll on the shared chart phext (the
// gravity scroll): every shift is one line, and the realm's current
// down is its LATEST line — the scroll is the realm's memory, held
// in common by every fox. The shift lines double as the rate-limit
// ledger: a line naming this realm, this player, this day is the
// spent shift. Pure record logic lives here so the headless tests
// exercise exactly what the game decides with.
//
// Line shape: grav|<realmId>|<dir>|<player>|<day>|<ts>
//   dir: 1 (down is down) or -1 (down is up); day: YYYY-MM-DD local.

export function gravityShiftLine(realmId, dir, player, day, ts) {
  return `grav|${realmId}|${dir < 0 ? -1 : 1}|${player}|${day}|${ts}`;
}

export function parseGravityScroll(text) {
  if (!text) return [];
  const out = [];
  for (const ln of String(text).split("\n")) {
    const parts = ln.split("|");
    if (parts.length !== 6 || parts[0] !== "grav") continue;
    const [, realmId, dirRaw, player, day, tsRaw] = parts;
    const dir = Number(dirRaw), ts = Number(tsRaw);
    if (!realmId || !player || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (dir !== 1 && dir !== -1) continue;
    if (!Number.isFinite(ts)) continue;
    out.push({ realmId, dir, player, day, ts });
  }
  return out;
}

// The realm's current down, per the records: the last record for a
// realm (in the order given) is its truth. Callers who merge
// read-back rows with still-queued local records order the array
// so the newest act stands last.
export function latestGravityByRealm(records) {
  const by = new Map();
  for (const r of records || []) by.set(r.realmId, r);
  return by;
}

// One shift per player per realm per day, judged against the
// records — read-back and queued alike, so a shift still in the
// outbox already counts as spent.
export function gravityShiftAllowed(records, realmId, player, day) {
  for (const r of records || []) {
    if (r.realmId === realmId && r.player === player && r.day === day) return false;
  }
  return true;
}

// F-2 (Libby playtest, EE 1129): the correction window. Will's
// standing rule — "the world still needs to still be playable
// after the inversion" — outranks the no-free-reversal shape of
// the daily rule where the two collide: a fox who flips into a
// landing that strands them (the Hall's ceiling, a pit's
// underside) had NO legal way back until tomorrow, because the
// flip itself spent the day. So: flipping back to the direction
// that stood before your own shift, within the window below, is
// a CORRECTION of that shift, not a new one. Judged purely from
// the records: the realm's latest line must be yours, from
// today, inside the window, and it must be your ONLY line in
// this realm today — after a correction the day is spent either
// way, so no toggle loop exists. Because direction is binary
// and yours is the realm's latest line, the correction
// necessarily restores the pre-shift direction. Returns the
// record being corrected, or null.
export const GRAVITY_CORRECTION_MS = 120000;
export function gravityCorrection(records, realmId, player, day, now) {
  let latest = null;
  let mineToday = 0;
  for (const r of records || []) {
    if (!r || r.realmId !== realmId) continue;
    if (r.dir !== 1 && r.dir !== -1) continue;
    if (!latest || r.ts >= latest.ts) latest = r;
    if (r.player === player && r.day === day) mineToday++;
  }
  if (!latest) return null;
  if (latest.player !== player || latest.day !== day) return null;
  if (mineToday !== 1) return null;
  if (now - latest.ts > GRAVITY_CORRECTION_MS) return null;
  return latest;
}

// A2-GRAV (F-2, the fall itself): the physics-time arrest for a
// gravity fall that has passed the plane where its landing surface
// must exist. The vault is generation: baseBlockAt lays it at
// CEIL_Y/CEIL_Y+1 over every column of an inverted realm, but the
// view's collision reads generated chunk data, and a chunk generated
// before the flip carries no vault until it is regenerated — and
// regeneration after a flip is local (the flip's own scroll is
// dirtied) and gradual (the signature sweep reaches only the first
// few loaded chunks), so a fox walking the vault can step into a
// still-stale chunk and fall UP through the open top of the world,
// into the Nothing, until the fall-out catch far above WORLD_H
// teleports it back. The correction window above cannot cover that
// fall: it only re-opens the shift gate, for the shifter alone, for
// 120 s — a fall minutes later, or under another fox's shift (whose
// record is the latest, so no correction is ever offered), has no
// correction at all. So the fall itself is arrested, at fall time,
// on the world's own rule: inverted, the vault plane is the ground,
// and a fall that has risen past the vault's underside without
// landing lands there — the same feet plane surfaceStandY names in
// the view (CEIL_Y - 0.01). The bedrock plane is the mirror bound
// under normal gravity: feet can never lawfully stand below the
// bedrock's top face (y = 1). Flight is exempt — flight holds the
// gravity term's place and answers to its own controls. Returns
// the feet y to land on, or null when the fall is lawful.
export function gravityFallArrest(gravDir, y, velY, flying) {
  if (flying) return null;
  if (gravDir < 0 && velY > 0 && y > CEIL_Y - 0.01) return CEIL_Y - 0.01;
  if (gravDir > 0 && velY < 0 && y < 1) return 1 + 1e-4;
  return null;
}

// ---------- wormhole tunnels (EE 1034, item 1) --------------------------------
// Will (EE 1034): the tunnel mechanism was the right transit; it
// "just lacked integration with the world's geometry" — and
// (00:55) "the warp tunnel you build is permanent" — and (00:58)
// "wormholes you craft are shared across all players - but if you
// form a new wormhole between the same two realms, your old one
// disappears."
//
// So a wormhole is a STRUCTURE and a RECORD. The record lives on
// the shared chart (scroll 1.1.1/1.1.8/1.1.1, append-only, gravity's
// discipline): craft lines and retirement lines, resolved on
// read-back into the standing set — per crafter, per unordered
// realm-pair, at most one stands; a new craft on the pair retires
// the crafter's old one. The structure is a bore in the world
// itself: genChunk stamps it (below) wherever a standing tunnel's
// end runs — real blocks, cut through rises, floored over dips,
// lined half in the home realm's stone and half in the far realm's,
// with a crystal course every five blocks. The bore is straight
// and axis-aligned: the block world is axis-aligned, and a curved
// bore would need non-block geometry — the fakery this replaces.
//
// Line shapes:
//   tun|<crafter>|<ts>|<endA>|<endB>
//     an end: <realmId>,<mx>,<mz>,<dx>,<dz>,<floorY>,<gdir>
//     (mx, mz): the mouth block; (dx, dz): the bore's unit axis,
//     pointing INTO the tunnel; floorY: the gravity surface's top
//     block at the mouth; gdir: down there (1 or -1).
//   tunx|<crafter>|<realmA>|<realmB>|<ts>   (pair sorted)

export const TUNNEL_LEN = 15; // blocks of bore from the mouth plane
const TUNNEL_BLOCKS = {
  // A2-CARVE (EE 1245): every realm lines its half of the bore in its
  // OWN block — one distinct substance per band, all eleven realms —
  // so the kaleido blend in tunnelBlockAt can actually show the two
  // realities meeting in the carved walls.
  nova: BLOCK.STONE, ashfall: BLOCK.BASALT, trust: BLOCK.SCAR,
  logos: BLOCK.SANDSTONE, willow: BLOCK.MOSS, elven: BLOCK.WOOD,
  delta: BLOCK.SHALE, halycon: BLOCK.VAULT,
  "ni-knight": BLOCK.BRICK, orchid: BLOCK.DEEPSTONE, plain: BLOCK.BEDROCK,
};
export function tunnelBlockFor(realmId) {
  return TUNNEL_BLOCKS[realmId] ?? BLOCK.STONE;
}
export function tunnelKey(crafter, realmA, realmB) {
  const [a, b] = [realmA, realmB].sort();
  return `${crafter}|${a}|${b}`;
}
export function makeTunnel(crafter, endA, endB, ts) {
  return { key: tunnelKey(crafter, endA.realmId, endB.realmId),
    crafter, ends: { a: endA, b: endB }, ts };
}
export function tunnelEndAt(tunnel, realmId) {
  if (tunnel.ends.a.realmId === realmId) return tunnel.ends.a;
  if (tunnel.ends.b.realmId === realmId) return tunnel.ends.b;
  return null;
}
export function tunnelOtherRealm(tunnel, realmId) {
  return tunnel.ends.a.realmId === realmId
    ? tunnel.ends.b.realmId : tunnel.ends.a.realmId;
}
// Does this wormhole serve a ring planted at (x, z) in realmId,
// bound for otherRealm? The mouth within two blocks, the pair right.
export function tunnelServes(tunnel, realmId, otherRealm, x, z) {
  const e = tunnelEndAt(tunnel, realmId);
  if (!e || tunnelOtherRealm(tunnel, realmId) !== otherRealm) return false;
  const dx = e.mx + 0.5 - x, dz = e.mz + 0.5 - z;
  return dx * dx + dz * dz <= 4.0001;
}
// Does this wormhole serve a LINK between its two ends (a and b,
// each { realmId, x, z })? BOTH ends must match within two blocks
// — a single-end match is not enough (EE 1119): the slope link's
// Ashfall end coincides with the earlier Arrival tunnel's Ashfall
// mouth, so an either-end rule served the slope link a tunnel
// whose Nova end was the Arrival mouth, not the slope ring, and
// transit read along ~-21 and instantly unmade itself.
export function tunnelServesLink(tunnel, a, b) {
  return tunnelServes(tunnel, a.realmId, b.realmId, a.x, a.z) &&
    tunnelServes(tunnel, b.realmId, a.realmId, b.x, b.z);
}
// A point's place in an end's bore: `along` blocks from the mouth
// plane (negative outside, at the fox's back), `lat` the signed
// offset from the centerline.
export function tunnelProgress(end, x, z) {
  const rx = x - (end.mx + 0.5), rz = z - (end.mz + 0.5);
  return { along: rx * end.dx + rz * end.dz,
    lat: rx * end.dz - rz * end.dx };
}
// The block a wormhole stamps at (x, y, z) — or null where it does
// not reach. Interior is AIR; floor, cap, walls and the far end
// wall are lining; a crystal course rings the bore every 5 blocks.
export function tunnelBlockAt(tunnel, realmId, x, y, z) {
  const end = tunnelEndAt(tunnel, realmId);
  if (!end) return null;
  const rx = x - end.mx, rz = z - end.mz;
  const along = rx * end.dx + rz * end.dz;
  if (along < 0 || along > TUNNEL_LEN) return null;
  const lat = rx * end.dz - rz * end.dx;
  if (lat < -2 || lat > 2) return null;
  // Height against the gravity surface at the mouth: rel 0 is the
  // surface block itself, rel grows AWAY from the surface (up into
  // the air under normal gravity; down off the vault when inverted).
  const rel = end.gdir > 0 ? y - end.floorY : end.floorY + 1 - y;
  if (rel < 0 || rel > 5) return null;
  const shell = rel === 0 || rel === 5 || lat === -2 || lat === 2 ||
    along === TUNNEL_LEN;
  if (!shell) return BLOCK.AIR;
  if (along % 5 === 0) return BLOCK.CRYSTAL;
  // A2-CARVE (EE 1244/1245): the fun-house quality lives in the
  // carved walls' MATERIAL, not in any overlay. The lining is a
  // kaleidoscope in the world's own blocks: a checker mirrored
  // about the bore's midpoint (mirrorAlong) and about its
  // centerline (|lat|), whose majority realm swaps at the
  // midpoint — the entry realm's band flecked with the
  // destination's on the near half, the destination's band
  // flecked with the entry's on the far half. The two realities
  // blend along the bore, in the substance the fox walks past.
  const other = tunnelOtherRealm(tunnel, realmId);
  const mirrorAlong = Math.min(along, TUNNEL_LEN - along);
  const checker = (mirrorAlong + Math.abs(lat)) % 2 === 0;
  const homeward = along * 2 < TUNNEL_LEN;
  const majority = homeward ? realmId : other;
  const minority = homeward ? other : realmId;
  return tunnelBlockFor(checker ? majority : minority);
}

export function tunnelLine(t) {
  const e = (x) => [x.realmId, x.mx, x.mz, x.dx, x.dz, x.floorY, x.gdir].join(",");
  return `tun|${t.crafter}|${t.ts}|${e(t.ends.a)}|${e(t.ends.b)}`;
}
export function tunnelRetireLine(crafter, realmA, realmB, ts) {
  const [a, b] = [realmA, realmB].sort();
  return `tunx|${crafter}|${a}|${b}|${ts}`;
}
function parseTunnelEnd(text) {
  const p = String(text).split(",");
  if (p.length !== 7) return null;
  const [realmId, mx, mz, dx, dz, floorY, gdir] = p;
  if (!REALMS.some((r) => r.id === realmId)) return null;
  const n = [mx, mz, dx, dz, floorY, gdir].map(Number);
  if (n.some((v) => !Number.isFinite(v))) return null;
  const [imx, imz, idx, idz, ifloor, igdir] = n;
  if ((Math.abs(idx) === 1) === (Math.abs(idz) === 1)) return null; // one axis only
  if (igdir !== 1 && igdir !== -1) return null;
  if (ifloor < 0 || ifloor >= WORLD_H) return null;
  return { realmId, mx: Math.trunc(imx), mz: Math.trunc(imz),
    dx: idx, dz: idz, floorY: Math.trunc(ifloor), gdir: igdir };
}
export function parseTunnelScroll(text) {
  if (!text) return [];
  const out = [];
  for (const ln of String(text).split("\n")) {
    const parts = ln.split("|");
    if (parts[0] === "tun" && parts.length === 5) {
      const [, crafter, tsRaw, ea, eb] = parts;
      const ts = Number(tsRaw);
      const a = parseTunnelEnd(ea), b = parseTunnelEnd(eb);
      if (!crafter || !Number.isFinite(ts) || !a || !b) continue;
      if (a.realmId === b.realmId) continue;
      out.push({ kind: "tun", ts, tunnel: makeTunnel(crafter, a, b, ts) });
    } else if (parts[0] === "tunx" && parts.length === 5) {
      const [, crafter, ra, rb, tsRaw] = parts;
      const ts = Number(tsRaw);
      if (!crafter || !Number.isFinite(ts)) continue;
      if (!REALMS.some((r) => r.id === ra) || !REALMS.some((r) => r.id === rb)) continue;
      const [a, b] = [ra, rb].sort();
      out.push({ kind: "tunx", ts, crafter, a, b });
    }
  }
  return out;
}
// The standing set, resolved from the records in the order given
// (callers order by ts, read-back last on ties, as gravity does):
// a craft stands unless a LATER craft or retirement for the same
// (crafter, pair) follows it.
export function resolveTunnels(records) {
  const by = new Map();
  for (const r of records || []) {
    if (r.kind === "tun") by.set(r.tunnel.key, r.tunnel);
    else if (r.kind === "tunx") by.delete(`${r.crafter}|${r.a}|${r.b}`);
  }
  return [...by.values()];
}

// ---------- the brush: shaping at more than one size (feedback #4) --------
// The chisel used to speak to one block at a time. A brush is a
// small volume of blocks shaped together with one stroke: the four
// sizes Will named — a single block, then 2x2x3, 3x3x2, 4x4x2
// (width x height x depth). The volume hangs on the block you aim
// at: width and height spread across the face you are looking at,
// depth reaches INTO the material, away from you. Pure geometry —
// the view aims, this module lays out the volume, chiselBlock
// judges each block in it on its own merits.
// ---------- mutable subspace geometry (P-1, EE 1087 batch) ----------------
// Will (EE 1087): world geometry itself becomes a subspace record.
// Gravity keeps a realm's down on the chart (1.1.1/1.1.5/1.1.1);
// wormholes keep crafted tunnels there (1.1.1/1.1.8/1.1.1); the
// geometry scroll (1.1.1/1.1.9/1.1.1, allocated by the scroll
// registry) is the third sibling: every shaping of the world is one
// append-only line, every client renders base world + the replayed
// record, and the record is the truth — shared by all players,
// persistent across sessions. Pure record logic lives here so the
// headless tests exercise exactly what the game decides with.
//
// Line shape: geo|<realmId>|<x>,<y>,<z>|<block>|<crafter>|<ts>
//   <block> is the resulting BLOCK id: 0 (AIR) is a carve; a
//   non-zero id is a raise/place of that block type. One line per
//   cell changed; a brush stroke is one edit event whose lines
//   share crafter + ts — the stroke's region is that line set.
//
// Ratified defaults (EE 1088, Will: "use your best judgement, nova
// fox is how the wavefront expands"): (a) all players may edit;
// (b) no per-player daily cap beyond the gateway's insert budget
// discipline; (c) edits do not decay; (d) cross-player same-cell
// conflicts resolve by record order — the last record in the
// scroll is the cell's truth, the same latest-line-wins gravity
// already runs on. (a) also covers a crafter's own supersession:
// their later edit to a cell replaces their earlier one in replay.
export function geometryLine(realmId, x, y, z, block, crafter, ts) {
  return `geo|${realmId}|${x},${y},${z}|${block}|${crafter}|${ts}`;
}

export function parseGeometryScroll(text) {
  if (!text) return [];
  const out = [];
  const known = new Set(Object.values(BLOCK));
  for (const ln of String(text).split("\n")) {
    const parts = ln.split("|");
    if (parts.length !== 6 || parts[0] !== "geo") continue;
    const [, realmId, cellRaw, blockRaw, crafter, tsRaw] = parts;
    if (!REALMS.some((r) => r.id === realmId)) continue;
    const cell = String(cellRaw).split(",").map(Number);
    if (cell.length !== 3 || cell.some((v) => !Number.isFinite(v))) continue;
    const [x, y, z] = cell.map(Math.trunc);
    if (y < 0 || y >= WORLD_H) continue;
    const block = Number(blockRaw), ts = Number(tsRaw);
    if (!known.has(block)) continue;
    if (!crafter || !Number.isFinite(ts)) continue;
    out.push({ realmId, x, y, z, block, crafter, ts });
  }
  return out;
}

// The shaped world, resolved: per realm, cell -> standing block.
// Records apply in scroll order; the last record for a cell is its
// truth (ratified default (d)).
export function resolveGeometry(records) {
  const by = new Map();
  for (const r of records || []) {
    if (!by.has(r.realmId)) by.set(r.realmId, new Map());
    by.get(r.realmId).set(`${r.x},${r.y},${r.z}`, r.block);
  }
  return by;
}

// The chisel's yield judge (P-2): what you see break is what you
// carry. A stroke's yield is the block that STANDS at the cell.
// Where the geometry record speaks with a placed block, that block
// is what stands — whatever the base generation buried under it —
// so the break belongs to the record path and the yield is the
// placed type. Where the record is silent, or has carved the cell
// away, the base block judges, exactly as the chisel always did.
// (Named EE 1101 by the P-2 probe, build #8: the judge was
// base-only, so a placed block re-filling a carved ground cell
// yielded the buried base type and the placed type vanished —
// ashfall (68,22,64), placed 7, pack +1 of 6, +0 of 7.)
export function chiselYield(sub, realmId, x, y, z) {
  const gm = sub && sub.geo ? sub.geo.get(realmId) : undefined;
  const gb = gm ? gm.get(`${x},${y},${z}`) : undefined;
  if (gb !== undefined && gb !== BLOCK.AIR) return { block: gb, placed: true };
  return { block: baseBlockAt(sub, realmId, x, y, z), placed: false };
}

// The write-time playability check (gravity's precedent, Will
// 2026-11-26: "the world still needs to still be playable after
// the inversion"). Judged BEFORE an edit is carved or recorded; a
// refusal is a name, not a silent no — the view says which one it
// was, as chisel refusals already do (feedback #11). `block` is the
// edit's resulting block: AIR for a carve, solid for a raise/fill.
// Returns null when the edit may stand.
export function geoEditRefusal(realmId, x, y, z, block) {
  // The arrival pad, any realm: carving strands arrivals in a pit,
  // filling buries them. The surface block and the air above it.
  const a = ARRIVAL[realmId];
  if (a && Math.abs(x - a.x) <= 1 && Math.abs(z - a.z) <= 1) {
    const h = heightAt(realmId, x, z);
    if (y === h || y === h + 1) return "spawn";
  }
  if (realmId !== DUNGEON.realm) return null;
  const d = DUNGEON;
  // The Deep Stone and the pedestal it stands on: the goal is not
  // geometry.
  if (x === d.deepStone.x && z === d.deepStone.z &&
      (y === d.deepStone.y || y === d.deepStone.y - 1)) return "deepstone";
  // The Hall's volume — its built structure and its interior air.
  // The Hall is a built place, not terrain.
  if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1 &&
      y >= d.floorY && y <= d.ceilY) return "hall";
  // The entrance shaft: a solid fill above the ceiling seals the
  // only route down. Carving the shaft's walls seals nothing.
  if (block !== BLOCK.AIR &&
      Math.abs(x - d.shaftX) <= 1 && Math.abs(z - d.shaftZ) <= 1 &&
      y > d.ceilY) return "sealed-route";
  return null;
}

// ---------- fight skills, tier 2: the world skills (EE 1087 batch, P-4) -----
// Tier 1 (demo35) drew on the fox; tier 2 draws each skill from a
// world system — the geometry record, the realm's declared gravity,
// the spectral flute. The pure arithmetic lives here, beside the
// systems themselves; the view (game3.js) holds the stamps and the
// verbs. Nothing in this section writes to any scroll: the feint is
// read-only by construction, the snare is a field on the monster,
// and the shaping strike writes through P-1's geometry path in the
// view, gated by the pure gate below.

// The shaping strike's combat rate limit: one block mid-fight can
// never out-dig the shaping tools. A chisel stroke at the grand
// brush writes 16 geometry lines at a click; the strike writes ONE
// line, at most once per SHAPE_STRIKE_CD_MS, and at most
// SHAPE_STRIKE_WINDOW_MAX times in any SHAPE_STRIKE_WINDOW_MS
// window — a small, named share of the gateway's ~115/min insert
// budget the whole chart shares. Pure gate; the view keeps the
// counters (lastMs, windowStartMs, windowCount).
export const SHAPE_STRIKE_CD_MS = 1200;
export const SHAPE_STRIKE_WINDOW_MS = 60000;
export const SHAPE_STRIKE_WINDOW_MAX = 30;
export function shapeStrikeAllowed(nowMs, lastMs, windowStartMs, windowCount) {
  if (nowMs - lastMs < SHAPE_STRIKE_CD_MS) return false;
  if (nowMs - windowStartMs < SHAPE_STRIKE_WINDOW_MS &&
      windowCount >= SHAPE_STRIKE_WINDOW_MAX) return false;
  return true;
}

// The gravity feint: for a breath, the fox's personal gravity
// tilts toward the dodge. feintAccel returns the acceleration the
// movement step integrates (blocks/s^2): standing gravity is
// -23 * gravDir on y (the game's gravity constant, the view's own
// term); feinting quarters that pull (FEINT_GRAV_SCALE — the fox
// hangs) and lends the sideways bias FEINT_BIAS along the dodge
// direction. The y term follows gravDir, so the feint hangs
// toward the ceiling in an inverted realm exactly as it hangs
// toward the floor in an honest one. It reads the realm's
// declared down; it writes nothing, anywhere.
export const FEINT_GRAV_SCALE = 0.25;
export const FEINT_BIAS = 30;
export function feintAccel(gravDir, dirX, dirZ, active) {
  if (!active) return { ax: 0, ay: -23 * gravDir, az: 0 };
  return {
    ax: dirX * FEINT_BIAS,
    ay: -23 * gravDir * FEINT_GRAV_SCALE,
    az: dirZ * FEINT_BIAS,
  };
}

// The flute snare: a thing of the dark that hears the spectral
// flute moves at SNARE_FACTOR for SNARE_TICKS physics ticks (the
// tick runs every 650 ms; 6 ticks is about 3.9 s from the last
// note). Monster movement is whole cell-steps per tick, so the
// halving is an accumulator carried on the monster: snaredSteps
// feeds the tick's step count through it, and the whole steps
// come out averaging exactly SNARE_FACTOR over any window
// (speed 1 alternates 0,1; speed 2 takes 1; speed 3 takes 1,2).
export const SNARE_TICKS = 6;
export const SNARE_FACTOR = 0.5;
export function snareStepSplit(acc, steps) {
  const total = (acc || 0) + steps * SNARE_FACTOR;
  const whole = Math.floor(total);
  return [whole, total - whole];
}
export function snaredSteps(m, steps) {
  const [whole, acc] = snareStepSplit(m._snareAcc, steps);
  m._snareAcc = acc;
  return whole;
}

// Item #6 (THE CINDER HUSK): the husk's own pace. It is slow by
// nature, not by status — the snare's step-split discipline above
// applied through its own accumulator (never the snare's field:
// the husk is deaf, and the two must never share a ledger). Over
// any window it takes exactly half the steps a glimmer takes.
export function huskSteps(m, steps) {
  const [whole, acc] = snareStepSplit(m._huskAcc, steps);
  m._huskAcc = acc;
  return whole;
}

// Item #6: whether an Ashfall scroll rises a husk instead of a
// surface thing — one in four, hashed on the scroll's own identity
// (the realm seed and its coordinates, the phase/role hash idiom),
// so every derivation of the same scroll agrees.
export function huskRises(seed, sx, sy) {
  return kernels.hash(`${seed}|husk|${sx},${sy}`) % 4 === 0;
}

export const BRUSHES = [
  { id: "one", label: "single block", dims: [1, 1, 1] },
  { id: "flat", label: "2 by 2 by 3", dims: [2, 2, 3] },
  { id: "wide", label: "3 by 3 by 2", dims: [3, 3, 2] },
  { id: "grand", label: "4 by 4 by 2", dims: [4, 4, 2] },
];
export function brushBlocks(brush, x, y, z, dir) {
  const [w, h, d] = brush.dims;
  // The face axis: the aim's dominant component. The face normal
  // points back toward the player; depth runs the other way.
  const ax = Math.abs(dir.x), ay = Math.abs(dir.y), az = Math.abs(dir.z);
  const axis = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
  const into = [0, 0, 0];
  into[axis] = (axis === 0 ? dir.x : axis === 1 ? dir.y : dir.z) > 0 ? 1 : -1;
  const tangents = [0, 1, 2].filter((a) => a !== axis);
  // Centered offsets: odd sizes straddle the target evenly; even
  // sizes lean one step toward the positive tangent.
  const off = (n) => {
    const s = -Math.floor((n - 1) / 2);
    return Array.from({ length: n }, (_, i) => s + i);
  };
  const wo = off(w), ho = off(h);
  const cells = [];
  const base = [x, y, z];
  for (let depth = 0; depth < d; depth++) {
    for (const a of wo) {
      for (const b of ho) {
        const p = [...base];
        p[axis] += into[axis] * depth;
        p[tangents[0]] += a;
        p[tangents[1]] += b;
        cells.push(p);
      }
    }
  }
  return cells;
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

// ---------- realmgen: the world's character, recorded (P-5) -----------------
// Feature 5's record: each realm's generation parameters (REALM_GEN
// above) stated on the shared chart, on the realmgen scroll
// (1.1.1/1.1.10/1.1.1, allocated by the scroll registry). The grammar
// mirrors the geometry scroll's discipline: one append-only line
// per realm, a defensive parse, last line per realm wins on resolve.
//
// Generation NEVER reads this scroll. A realm's shape derives from
// its identity (realmGenParams) — that derivation is why every
// client generates the same realm, downloaded or hosted, online or
// off. The scroll is the world's public statement of its own
// character: any client can read it back and check it against the
// derived record (realmGenAgrees), and the game's reconcile queues
// the derived line for any realm whose standing line is missing or
// disagrees — the record heals itself at boot, in identical bytes
// from every fox. A forged line can dirty the record's agreement;
// it can never move a hill.

const GEN_MODES = new Set(["roll", "ridge", "terrace", "channel"]);
const GEN_CANOPY_FORMS = new Set(["oak", "willow", "pillar", "none"]);
// The canonical parameter string a realmgen line carries — the
// record's comparable form (density in thousandths, the meadow
// thresholds in hundredths, so the line is all integers and names).
export function realmGenKey(p) {
  return [p.mode, p.base, p.amp, p.amp2,
    Math.round((p.density || 0) * 1000),
    Math.round((p.lushT || 0) * 100),
    Math.round((p.dryT || 0) * 100),
    p.strataPeriod || 0, p.canopy].join("|");
}
export function realmGenLine(realmId, crafter, ts) {
  return `rgen|${realmId}|${realmGenKey(realmGenParams(realmId))}|${crafter}|${ts}`;
}
export function parseRealmGenScroll(text) {
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("rgen|")) continue;
    const f = line.split("|");
    if (f.length !== 13) continue;
    const realmId = f[1], mode = f[2], canopy = f[10];
    const crafter = f[11];
    if (!realmById(realmId) || !GEN_MODES.has(mode) ||
        !GEN_CANOPY_FORMS.has(canopy) || !crafter) continue;
    const nums = [f[3], f[4], f[5], f[6], f[7], f[8], f[9], f[12]].map(Number);
    if (nums.some((n) => !Number.isFinite(n))) continue;
    out.push({
      realmId,
      key: [mode, nums[0], nums[1], nums[2], nums[3], nums[4], nums[5], nums[6], canopy].join("|"),
      crafter, ts: nums[7],
    });
  }
  return out;
}
export function resolveRealmGen(records) {
  const byRealm = new Map();
  for (const r of records || []) byRealm.set(r.realmId, r);
  return byRealm;
}
// Does the record, as resolved, state every realm's character
// exactly as derived? The verification the probe runs in public.
export function realmGenAgrees(records) {
  const resolved = resolveRealmGen(records);
  for (const r of REALMS) {
    const line = resolved.get(r.id);
    if (!line || line.key !== realmGenKey(realmGenParams(r.id))) return false;
  }
  return true;
}

// A realm's fingerprint: over its home scroll, the hash of the
// height stream and of the surface stream, with the surface mix —
// a pure function of the realm's identity, computed against a
// fresh Subspace. Two clients that agree on a fingerprint generate
// the same realm; the suite pins the fingerprints so a realm's
// character can never drift silently. (The surface stream reads
// baseBlockAt raw — the dungeon's CARVE sentinel included, exactly
// as generated; genChunk renders it as air.)
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
export function realmFingerprint(realmId) {
  const sub = new Subspace();
  let hs = "", ss = "";
  const mix = {};
  for (let z = 0; z < SCROLL; z++) {
    for (let x = 0; x < SCROLL; x++) {
      const h = heightAt(realmId, x, z);
      hs += h + ",";
      const b = baseBlockAt(sub, realmId, x, h, z, h);
      ss += b + ",";
      mix[b] = (mix[b] || 0) + 1;
    }
  }
  return { heights: fnv1a(hs), surface: fnv1a(ss), mix };
}

// The playability proof, per realm (P-5): the arrival stands on
// solid ground with air to breathe; an on-foot walk (climb at most
// 1, fall at most 4, over the heightfield) reaches the realm's
// anchor — Ashfall's swift charm, open country at Chebyshev
// distance 56 for the rest. Nova's anchor is stated as the terrain
// itself dictates (measured, EE 1099: the least step up across the
// barrow's ring is 6 — there is NO walk-up route onto the hill):
// the walk reaches the barrow's apron, the ring's cliff face is
// shapeable material the whole way round (the ascent is made by
// shaping, as the game teaches), and a 3D air route runs from the
// shaft mouth down the shaft and through the hall to the Deep
// Stone's neighbour cell. Pure, against a fresh Subspace: this is
// a claim about the GENERATED world, the same one every client
// builds.
export function realmRouteCheck(realmId) {
  const a = ARRIVAL[realmId] || ARRIVAL.nova;
  const sub = new Subspace();
  const hA = heightAt(realmId, a.x, a.z);
  const stand = isSolid(baseBlockAt(sub, realmId, a.x, hA, a.z, hA)) &&
    baseBlockAt(sub, realmId, a.x, hA + 1, a.z) === BLOCK.AIR &&
    baseBlockAt(sub, realmId, a.x, hA + 2, a.z) === BLOCK.AIR;
  const target = realmId === "ashfall"
    ? { x: ITEM_SPOTS.swift.bx, z: ITEM_SPOTS.swift.bz } : null;
  // Nova's reach test: a column of the barrow's apron — inside the
  // apron box, outside the raised rect itself.
  const inApron = (x, z) => realmId === "nova" &&
    x >= DUNGEON.x0 - 5 && x <= DUNGEON.x1 + 5 &&
    z >= DUNGEON.z0 - 5 && z <= DUNGEON.z1 + 5 &&
    !(x >= DUNGEON.x0 - 2 && x <= DUNGEON.x1 + 2 &&
      z >= DUNGEON.z0 - 2 && z <= DUNGEON.z1 + 2);
  const seen = new Set([`${a.x},${a.z}`]);
  const queue = [[a.x, a.z]];
  let reached = false;
  while (queue.length) {
    const [x, z] = queue.shift();
    if (target) {
      if (x === target.x && z === target.z) { reached = true; break; }
    } else if (realmId === "nova") {
      if (inApron(x, z)) { reached = true; break; }
    } else if (Math.max(Math.abs(x - a.x), Math.abs(z - a.z)) >= 56) {
      reached = true; break;
    }
    const h = heightAt(realmId, x, z);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, key = `${nx},${nz}`;
      if (seen.has(key)) continue;
      if (nx < a.x - 88 || nx > a.x + 88 || nz < a.z - 88 || nz > a.z + 88) continue;
      const nh = heightAt(realmId, nx, nz);
      if (nh - h > 1 || h - nh > 4) continue;
      seen.add(key);
      queue.push([nx, nz]);
    }
  }
  let hall = null;
  if (realmId === DUNGEON.realm) {
    const sx = DUNGEON.shaftX + 1, sz = DUNGEON.shaftZ + 1;
    const start = [sx, heightAt(realmId, sx, sz) + 1, sz];
    const goal = [DUNGEON.deepStone.x - 2, DUNGEON.deepStone.y, DUNGEON.deepStone.z];
    const airAt = (x, y, z) => {
      const b = baseBlockAt(sub, realmId, x, y, z);
      return b === BLOCK.AIR || b === CARVE;
    };
    const seen3 = new Set([start.join(",")]);
    const q3 = [start];
    hall = false;
    while (q3.length) {
      const [x, y, z] = q3.shift();
      if (x === goal[0] && y === goal[1] && z === goal[2]) { hall = true; break; }
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const nx = x + dx, ny = y + dy, nz = z + dz, key = `${nx},${ny},${nz}`;
        if (seen3.has(key)) continue;
        if (nx < 36 || nx >= 64 || ny < 0 || ny >= 30 || nz < 22 || nz >= 48) continue;
        if (!airAt(nx, ny, nz)) continue;
        seen3.add(key);
        q3.push([nx, ny, nz]);
      }
    }
  }
  // Nova's cliff face (the ascent by shaping): sampled round the
  // ring, every face cell between the apron's ground and the
  // hill's top must be a shapeable block — dirt and stone, never
  // bedrock, vault or brick.
  let face = null;
  if (realmId === "nova") {
    const SHAPEABLE = new Set([BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE,
      BLOCK.MOSS, BLOCK.SANDSTONE]);
    face = true;
    const ring = [];
    for (let x = DUNGEON.x0 - 2; x <= DUNGEON.x1 + 2; x += 4) {
      ring.push([x, DUNGEON.z0 - 2, 0, -1], [x, DUNGEON.z1 + 2, 0, 1]);
    }
    for (let z = DUNGEON.z0 - 2; z <= DUNGEON.z1 + 2; z += 4) {
      ring.push([DUNGEON.x0 - 2, z, -1, 0], [DUNGEON.x1 + 2, z, 1, 0]);
    }
    for (const [x, z, ox, oz] of ring) {
      const hIn = heightAt(realmId, x, z);
      const hOut = heightAt(realmId, x + ox, z + oz);
      for (let y = hOut + 1; y <= hIn && face; y++) {
        if (!SHAPEABLE.has(baseBlockAt(sub, realmId, x, y, z, hIn))) face = false;
      }
    }
  }
  return { stand, reached, hall, face, ok: stand && reached && hall !== false && face !== false };
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
  // The vault caps every column alike when down is up — the dungeon
  // shaft included (IP-3, 2026-11-26): the shaft's carve below would
  // otherwise punch a hole through the vault exactly over the shaft,
  // and a fox walking the vault would fall out of the world there.
  // Under normal gravity this is inert — no vault exists to cap with.
  if ((y === CEIL_Y || y === CEIL_Y + 1) && y > h &&
      sub.gravityOf(realmId, scrollOfBlock(x), scrollOfBlock(z)) < 0) {
    return BLOCK.VAULT;
  }
  // The dungeon is carved into Nova Prime's hill country.
  if (realmId === DUNGEON.realm && inDungeon(x, z)) {
    const db = dungeonBlockAt(x, y, z, h);
    if (db !== null) return db;
  }
  // P-5: the realm's recorded generation character (REALM_GEN) —
  // the strata, surface and subsurface reads below all speak it.
  const g = realmGenParams(realmId);
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
    // v5 (feedback #10): shale bands cut the strata, so a cliff
    // face reads as geology, not wallpaper. P-5: the bands are the
    // realm's recorded character now (strataBand) — Ashfall's are
    // its historical period 11, rows 4–5, exactly as before.
    if (strataBand(realmId, y)) return BLOCK.SHALE;
    return y % 7 < 3 ? BLOCK.BASALT : BLOCK.STONE;
  }
  // Trust Fall wears the strata form in its own red (item 3) —
  // and, since P-5, its own bands: period 9, seed-derived phase,
  // no longer Ashfall's geology copied verbatim. The REDROCK cap
  // and the two layers under it are untouched, so Trust's surface
  // and near-surface columns stand exactly as they did.
  if (realmId === "trust") {
    if (y === h) return BLOCK.REDROCK;
    if (y >= h - 2) return BLOCK.REDROCK;
    if (strataBand(realmId, y)) return BLOCK.SHALE;
    return y % 7 < 3 ? BLOCK.BASALT : BLOCK.STONE;
  }
  if (y === h) {
    // v5 (feedback #10, #16): the meadow has character now — lush
    // patches wear moss, dry flats wear sandstone, and the two
    // noises disagree enough that the patches wander organically.
    // EE 995 (item 3): the thresholds and caps are per-realm —
    // Ni-Knight is stone-flagged, Logos wears sandstone (gold
    // mesas), Delta's river bed is sandstone, Elven shade is
    // moss-dominant. P-5: the caps and thresholds are the realm's
    // recorded mix (REALM_GEN) — the same values, one record —
    // and the meadow reads are clustered by the patch field.
    const seed = realmById(realmId).seed;
    if (g.mix === "flags") {
      return (x + z) % 17 === 0 ? BLOCK.BRICK : BLOCK.STONE;
    }
    if (g.mix === "sand") return BLOCK.SANDSTONE;
    if (g.mix === "pale") {
      // Halycon's pale flats: sandstone dusted with shale where
      // the patch field rides high. (EE 995 left Halycon's surface
      // byte-identical to Logos'; P-5 parts the mixes measurably.)
      return patchField(realmId, x, z) > 0.55
        ? BLOCK.SHALE : BLOCK.SANDSTONE;
    }
    if (realmId === "delta" && deltaRiver(realmId, x, z) > 0) return BLOCK.SANDSTONE;
    // The worn path (nova): the walk from the arrival pad to the
    // Hall's shaft, worn into the dress. Surface only.
    if (realmId === "nova" && hallPathWear(x, z)) return BLOCK.DIRT;
    // The meadow mix, clustered (P-5): the slow patch field
    // (cell 26) breathes on both thresholds, so moss gathers
    // into meadows and dry sandstone into flats — no two
    // stretches alike, and none of it static.
    const patch = patchField(realmId, x, z) - 0.5;
    const lush = vnoise(`${seed}|lush`, x, z, 9);
    if (lush > g.lushT + patch * 0.3) return BLOCK.MOSS;
    const dry = vnoise(`${seed}|dry`, x, z, 14);
    if (dry > g.dryT - patch * 0.3) return BLOCK.SANDSTONE;
    return BLOCK.GRASS;
  }
  if (y >= h - 3) {
    if (g.mix === "flags") return BLOCK.STONE;
    if (g.mix === "sand" || g.mix === "pale") return BLOCK.SANDSTONE;
    return BLOCK.DIRT;
  }
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

  // The wormhole's pocket (EE 995, items 5+6): while a transit
  // pocket is set on a realm's reserved scroll, that scroll
  // generates as the passage alone — a straight vault corridor in
  // empty dark, the tube the fox walks through a rift inside of.
  // Nothing in play reaches the reserved scroll.
  const tp = sub.transitPocket;
  if (tp && realmId === tp.realmId &&
      Math.floor((cx * CHUNK) / SCROLL) === tp.sx &&
      Math.floor((cz * CHUNK) / SCROLL) === tp.sy) {
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = x0 + lx, z = z0 + lz;
        if (x < tp.x0 || x > tp.x1 || z < tp.z0 - 1 || z > tp.z1 + 1) continue;
        for (let y = tp.floorY; y <= tp.ceilY; y++) {
          const wall = z === tp.z0 - 1 || z === tp.z1 + 1 || x === tp.x0 || x === tp.x1;
          if (y === tp.floorY || y === tp.ceilY || wall) put(lx, y, lz, BLOCK.VAULT);
        }
      }
    }
  } else {
  for (let lz = 0; lz < CHUNK; lz++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = x0 + lx, z = z0 + lz;
      const h = heightAt(realmId, x, z);
      for (let y = 0; y < WORLD_H; y++) {
        let b = baseBlockAt(sub, realmId, x, y, z, h);
        if (b === CARVE) b = BLOCK.AIR;
        if (b !== BLOCK.AIR) put(lx, y, lz, b);
      }
      // Life-grown features, v3: generation reads the cell's GROWTH
      // LEVEL — a value the physics tick ramps gradually toward what
      // density and neighbor pressure would support (feedback #6).
      // A young growth is a single bloom block; a mature one is a
      // crystal spine. Because the level moves a few percent per
      // tick, features creep in over many ticks and ebb the same
      // way. Density and pressure near a border are still fed by the
      // NEIGHBOR scroll's cells — the non-local effect, now gradual.
      const gx = cellOfBlock(x), gy = cellOfBlock(z);
      const isCellCenter = x % 2 === 0 && z % 2 === 0;
      if (isCellCenter && !(realmId === DUNGEON.realm && inDungeon(x, z))) {
        const level = sub.growthAt(realmId, gx, gy);
        if (level > 0.45 && h + 1 < CEIL_Y - 1) {
          const grow = 1 + Math.floor((level - 0.45) * 5); // 1..3 blocks
          for (let i = 0; i < grow; i++) put(lx, h + 1 + i, lz, BLOCK.CRYSTAL);
        } else if (level > (realmId === "orchid" ? 0.18 : 0.25) && h + 1 < CEIL_Y - 1 &&
                   kernels.hash(`${realmId}|bloom|${x},${z}`) % (realmId === "orchid" ? 3 : 4) === 0) {
          put(lx, h + 1, lz, realmId === "ashfall" ? BLOCK.EMBER : BLOCK.CRYSTAL);
        }
      }
    }
  }

  // Trees (Nova Prime) / dead snags (Ashfall): placed per column from
  // the seed hash, with a 2-block margin pass so canopies cross chunk
  // borders seamlessly. v5 (feedback #16): the density breathes with
  // a slow grove noise — woods gather into groves, clearings open
  // between them, and a realm stops reading as one even scatter.
  // EE 995 (item 3): a realm's trees wear its own form — Elven
  // shade stands dense and tall, willows droop wide, Ni-Knight
  // raises stone pillars instead of trees, Halycon stands bare.
  // P-5: the styles are REALM_GEN's density + form, derived here
  // so the record and the generator can never disagree.
  const TREE_STYLES = Object.fromEntries(REALMS.map((r) => {
    const gg = realmGenParams(r.id);
    return [r.id, { p: gg.density, trunk: gg.trunk, canopy: gg.canopy }];
  }));
  const tstyle = TREE_STYLES[realmId] || TREE_STYLES.nova;
  const treeP = tstyle.p;
  for (let z = z0 - 2; z < z0 + CHUNK + 2; z++) {
    for (let x = x0 - 2; x < x0 + CHUNK + 2; x++) {
      if (realmId === DUNGEON.realm && inDungeon(x, z)) continue;
      const r = realmById(realmId);
      const roll = kernels.hash(`${r.seed}|tree|${x},${z}`) % 1000 / 1000;
      const grove = vnoise(`${r.seed}|grove`, x, z, 22);
      if (roll >= treeP * (0.25 + grove * 1.75)) continue;
      const h = heightAt(realmId, x, z);
      // No trees on steep ground.
      if (Math.abs(heightAt(realmId, x + 1, z) - h) > 1) continue;
      if (tstyle.canopy === "pillar") {
        const ph = 4 + (kernels.hash(`${r.seed}|ph|${x},${z}`) % 4);
        for (let i = 1; i <= ph; i++) put(x - x0, h + i, z - z0, BLOCK.STONE);
        put(x - x0, h + ph + 1, z - z0, BLOCK.BRICK);
        continue;
      }
      const trunk = tstyle.trunk + (kernels.hash(`${r.seed}|th|${x},${z}`) % 3);
      for (let i = 1; i <= trunk; i++) {
        put(x - x0, h + i, z - z0, BLOCK.WOOD);
      }
      if (tstyle.canopy === "oak" || tstyle.canopy === "willow") {
        const wil = tstyle.canopy === "willow";
        const R = wil ? 2 : 1;
        for (let dy = wil ? -2 : -1; dy <= 1; dy++)
          for (let dx = -R; dx <= R; dx++)
            for (let dz = -R; dz <= R; dz++) {
              if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > (wil ? 3 : 2)) continue;
              const px = x + dx, py = h + trunk + dy, pz = z + dz;
              if (baseBlockAt(sub, realmId, px, py, pz) === BLOCK.AIR) {
                put(px - x0, py, pz - z0, BLOCK.LEAF);
              }
            }
      }
    }
  }

  // v5 (feedback #16): scatter with a memory of place — boulders
  // dropped where the hash drops them, and one standing stone per
  // scroll at most, so a realm has landmarks to navigate by instead
  // of one more stretch of the same hill. Everything yields to
  // what's already standing (trees, growth, the dungeon, the
  // placed things) and to Arrival's clearing.
  const clearOfArrival = (x, z) =>
    !(realmId === "nova" && x >= 2 && x <= 14 && z >= 2 && z <= 14);
  const clearOfItems = (x, z) =>
    !Object.values(ITEM_SPOTS).some((s) =>
      s.realmId === realmId && Math.abs(s.bx - x) <= 1 && Math.abs(s.bz - z) <= 1);
  for (let lz = 0; lz < CHUNK; lz++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = x0 + lx, z = z0 + lz;
      if (realmId === DUNGEON.realm && inDungeon(x, z)) continue;
      if (!clearOfArrival(x, z) || !clearOfItems(x, z)) continue;
      const roll = kernels.hash(`${realmById(realmId).seed}|rock|${x},${z}`) % 1000;
      if (roll >= 7) continue;
      // P-5: boulders gather — the same roll, gated by the realm's
      // cluster field, so the rocks clump along the field's ridges
      // and clearings open between them (a uniform scatter reads
      // as noise; a clustered one reads as a place).
      if (clusterField(realmId, x, z) <= 0.42) continue;
      const h = heightAt(realmId, x, z);
      if (data[idx(lx, h + 1, lz)] !== BLOCK.AIR) continue;
      const rock = realmId === "ashfall" ? BLOCK.SHALE : BLOCK.STONE;
      put(lx, h + 1, lz, rock);
      if (roll % 3 === 0 && data[idx(lx, h + 2, lz)] === BLOCK.AIR) {
        put(lx, h + 2, lz, rock);
      }
    }
  }
  {
    // The standing stone: one per scroll, where the scroll's own
    // hash puts it — a deliberate-feeling marker in open country.
    const sxFrom = Math.floor(x0 / SCROLL), sxTo = Math.floor((x0 + CHUNK - 1) / SCROLL);
    const syFrom = Math.floor(z0 / SCROLL), syTo = Math.floor((z0 + CHUNK - 1) / SCROLL);
    for (let ssx = sxFrom; ssx <= sxTo; ssx++) {
      for (let ssy = syFrom; ssy <= syTo; ssy++) {
        const r = realmById(realmId);
        const sh = kernels.hash(`${r.seed}|stone|${ssx},${ssy}`);
        if (sh % 100 >= 55) continue;
        const gx = ssx * SCROLL + 8 + (sh % 40), gz = ssy * SCROLL + 8 + ((sh >> 5) % 40);
        const lx = gx - x0, lz = gz - z0;
        if (lx < 0 || lz < 0 || lx >= CHUNK || lz >= CHUNK) continue;
        if (realmId === DUNGEON.realm && inDungeon(gx, gz)) continue;
        if (!clearOfArrival(gx, gz) || !clearOfItems(gx, gz)) continue;
        const h = heightAt(realmId, gx, gz);
        let clear = true;
        for (let i = 1; i <= 4; i++) {
          if (data[idx(lx, h + i, lz)] !== BLOCK.AIR) { clear = false; break; }
        }
        if (!clear) continue;
        for (let i = 1; i <= 3; i++) put(lx, h + i, lz, BLOCK.STONE);
        put(lx, h + 4, lz, BLOCK.SANDSTONE);
      }
    }
  }

  }

  // EE 1034 (item 1): standing wormholes stamp their bores into
  // the chunk — after base generation and Life features, before
  // inscribed overrides (a carve inside a tunnel still wins: it
  // was written later, by a hand).
  if (sub.tunnels && sub.tunnels.size) {
    for (const t of sub.tunnels.values()) {
      const end = tunnelEndAt(t, realmId);
      if (!end) continue;
      // The bore's block footprint, generously bounded.
      const bx1 = end.mx + end.dx * TUNNEL_LEN, bz1 = end.mz + end.dz * TUNNEL_LEN;
      const minx = Math.min(end.mx, bx1) - 2, maxx = Math.max(end.mx, bx1) + 2;
      const minz = Math.min(end.mz, bz1) - 2, maxz = Math.max(end.mz, bz1) + 2;
      if (x0 + CHUNK - 1 < minx || x0 > maxx || z0 + CHUNK - 1 < minz || z0 > maxz) continue;
      const y0 = end.gdir > 0 ? end.floorY : end.floorY - 5;
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const x = x0 + lx, z = z0 + lz;
          if (x < minx || x > maxx || z < minz || z > maxz) continue;
          for (let y = y0; y <= y0 + 5; y++) {
            const b = tunnelBlockAt(t, realmId, x, y, z);
            if (b !== null) put(lx, y, lz, b);
          }
        }
      }
    }
  }

  // P-1: the shared geometry record — the shaped world every
  // player has written into subspace, resolved. After the tunnels
  // (a geometry carve through a bore's lining is a later, shared
  // fact and wins over the bore), before local overrides (a
  // player's own scar still wins on their own client).
  const geo = sub.geo ? sub.geo.get(realmId) : null;
  if (geo) {
    for (const [key, b] of geo) {
      const [x, y, z] = key.split(",").map(Number);
      const lx = x - x0, lz = z - z0;
      if (lx >= 0 && lz >= 0 && lx < CHUNK && lz < CHUNK && y >= 0 && y < WORLD_H) {
        data[idx(lx, y, lz)] = b;
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

// ---------- scoring: the leaderboard's arithmetic -----------------------
// One rule, stated in PLAN.md and applied identically everywhere:
// the board counts what the inscription log can prove.
//   cross (a realm crossing) ......... 100
//   tune to a pocket page ............  25
//   scar (a thing struck out) ........  50
//   pickup (weapon or charm taken) ...  40
//   break (a block shaped through) ...  10
//   daily pocket reached ............. 300
//   quest (the Deep Stone reached) ... 500
//   grant (the hat, written down) .... 250
export const SCORE_WEIGHTS = {
  cross: 100, tune: 25, scar: 50, pickup: 40, break: 10,
  daily: 300, quest: 500, grant: 250,
};
export function computeScore(sub) {
  let score = 0;
  const counts = {};
  for (const seg of sub.wal) {
    // 'tune' segments are logged for every chord; only pocket-bound
    // tunes score (the detail names the landing as a far page).
    if (seg.op === "tune") continue;
    const w = SCORE_WEIGHTS[seg.op];
    if (w) { score += w; counts[seg.op] = (counts[seg.op] || 0) + 1; }
  }
  // Pocket tunes: a 'tune' followed by arrival on a far page is
  // visible in the log as the pocket scroll opening after it; count
  // distinct pocket scrolls opened instead — simpler and provable.
  return { score, counts };
}
export function pocketScore(sub) {
  // Distinct pocket pages visited (scroll opens beyond the home 3x3
  // of each realm), 25 each — folded into the headline score by the
  // view so computeScore stays a pure read of the log's own ops.
  const seen = new Set();
  for (const seg of sub.wal) {
    if (seg.op !== "scroll") continue;
    const m = /^(-?\d+),(-?\d+)$/.exec(seg.where.split(" ").pop() || "");
    if (!m) continue;
    const sx = Number(m[1]), sy = Number(m[2]);
    if (Math.abs(sx) > 1 || Math.abs(sy) > 1) seen.add(seg.where);
  }
  return seen.size * 25;
}
export function totalScore(sub) {
  return computeScore(sub).score + pocketScore(sub);
}

// ---------- the daily pocket (DESIGN.md's daily cycle) ------------------
// One pocket per day, the same for everyone: the date seeds a chord
// and a page, phorge-style. Reaching the page is the day's feat; the
// daily board ranks it. Date is the player's local YYYY-MM-DD.
export function dailyPocket(dateStr) {
  const h = kernels.hash(`nova-phox|daily|${dateStr}`) >>> 0;
  const notes = new Set();
  let k = h;
  while (notes.size < 3) {
    notes.add(((k >>> 0) % 11) + 1);
    k = (k >>> 3) + 7;
  }
  const chord = [...notes].sort((a, b) => a - b);
  const dx = (h % 5) - 2 || 1;
  const dy = ((h >>> 4) % 5) - 2 || -1;
  return { date: dateStr, chord, sx: dx, sy: dy, realmId: "nova" };
}
// Call when the player stands in a scroll: claims the daily feat
// exactly once per date, inscribed like everything else.
export function checkDaily(sub, realmId, sx, sy, dateStr) {
  const d = dailyPocket(dateStr);
  if (realmId !== d.realmId || sx !== d.sx || sy !== d.sy) return false;
  if (sub.dailyClaimed.has(dateStr)) return false;
  sub.dailyClaimed.add(dateStr);
  sub.log("daily", `${realmById(realmId).name} ${sx},${sy}`,
    `the day's page (${dateStr}) is reached — tune ${d.chord.join("+")}`);
  return true;
}

// ---------- the loading trail -------------------------------------------
// While the world loads, the load panel carries a quiet trail of
// words. The trail is not a canned list: it consumes the words of
// the reads the boot itself performs — the shared chart's scrolls as
// the gateway answers them, and the local subspace's own inscription
// log as generation writes it — tokenized as they arrive, so the
// loading IS the reading and the trail shows its words. Between the
// read words, classic loading-flavor phrases are woven in so the
// whole stream reads as whimsical loading chatter. Nothing on any
// player surface names or explains the trail; it is set dressing.
// The feed is capped: when reads arrive faster than the trail can
// show them, words are dropped, never queued — the trail must never
// slow a load down.
export const TRAIL_FLAVOR = [
  "reticulating splines",
  "charging batteries",
  "greasing the gears",
  "polishing the portals",
  "counting backwards from infinity",
  "untangling the cables",
  "feeding the hamsters",
  "sharpening the pencils",
  "inflating the tires",
  "brewing the coffee",
  "sorting the mail",
  "winding the clockwork",
  "dusting the shelves",
  "aligning the stars",
  "tuning the instruments",
  "oiling the hinges",
  "stacking the crates",
  "herding the electrons",
  "shuffling the deck",
  "tightening the bolts",
  "waxing the moon",
  "folding the laundry",
  "priming the pump",
  "sweeping the hangar",
  "labeling the boxes",
  "testing the echoes",
  "raising the periscope",
  "calibrating the compass",
];
// Words out of a read: split on anything that is not a word
// character, keep words of two or more, clip the very long (hashes
// and keys ride the chart too) at a readable length.
export function trailWordsFrom(text) {
  if (!text) return [];
  const out = [];
  for (const raw of String(text).split(/[^A-Za-z0-9'’-]+/)) {
    if (raw.length < 2) continue;
    out.push(raw.length > 24 ? raw.slice(0, 24) : raw);
  }
  return out;
}
export class TrailFeed {
  constructor(cap = 220) {
    this.q = []; // words waiting to be shown, oldest first
    this.cap = cap;
    this.live = true; // feeds land only while the load is live
    this.fed = 0; // words taken in
    this.dropped = 0; // words let go because the cap was full
    this._sinceFlavor = 0; // read words shown since the last phrase
    this._flavorIdx = 0; // phrases cycle, never in a short loop
    this._gap = 6; // read words between phrases (wanders 5..9)
  }
  // Take in the words of one real read. Returns how many landed.
  feedText(text) {
    if (!this.live) return 0;
    let n = 0;
    for (const w of trailWordsFrom(text)) {
      if (this.q.length >= this.cap) { this.dropped++; continue; }
      this.q.push(w);
      n++;
    }
    this.fed += n;
    return n;
  }
  stop() { this.live = false; }
  get pending() { return this.q.length; }
  // The next thing the trail shows: a read word, or — every handful
  // of read words — one flavor phrase, whole. Null when no read
  // words are waiting: the trail never invents a stream of its own.
  next() {
    if (!this.q.length) return null;
    if (this._sinceFlavor >= this._gap) {
      this._sinceFlavor = 0;
      const i = this._flavorIdx++;
      this._gap = 5 + ((i * 7) % 5); // 5..9, wandering
      return TRAIL_FLAVOR[i % TRAIL_FLAVOR.length];
    }
    this._sinceFlavor++;
    return this.q.shift();
  }
}
// ---------- the world, written out: a .phext copy (2026-11-26) -----
// The Esc menu's "Save the world to .phext": the whole local world —
// every opened scroll's living grid, the player's marks, the placed
// things and the monsters, and the inscription log itself — as a
// real phext document. The serializer is the estate's own implode
// (the same state machine as build_artifacts_phext.py and its
// siblings): coordinates are 9 components, 1-indexed; scrolls are
// visited in sorted coordinate order; advancing a component emits
// that level's byte and resets every deeper component to 1.
export const PHEXT_LEVEL_BYTES =
  [0x01, 0x1F, 0x1E, 0x1D, 0x1C, 0x1A, 0x19, 0x18, 0x17]; // library..scroll

export function phextImplode(scrolls) {
  const entries = (scrolls instanceof Map
    ? [...scrolls.entries()] : Object.entries(scrolls))
    .map(([k, v]) => [k.replace(/\//g, ".").split(".").map(Number), v])
    .sort((a, b) => {
      for (let i = 0; i < 9; i++) if (a[0][i] !== b[0][i]) return a[0][i] - b[0][i];
      return 0;
    });
  const state = [1, 1, 1, 1, 1, 1, 1, 1, 1];
  let out = "";
  for (const [target, text] of entries) {
    for (let lvl = 0; lvl < 9; lvl++) {
      while (state[lvl] < target[lvl]) {
        out += String.fromCharCode(PHEXT_LEVEL_BYTES[lvl]);
        state[lvl]++;
        for (let j = lvl + 1; j < 9; j++) state[j] = 1;
      }
    }
    out += text;
  }
  return out;
}

// The coordinate scheme (documented in the export's home scroll):
// 1.1.1/1.1.1/1.1.1 is the home scroll, 1.1.1/1.1.1/1.1.2 the
// inscription log. Realm i (in REALMS order) stands at book i+2:
// its realm scroll at 1.1.(i+2)/1.1.1/1.1.1, its marks at
// .../1.1.2/1.1.1, its monsters and placed things at .../1.1.3/
// 1.1.1, and each opened page at .../1.2.1/1.(sx+4097).(sy+4097)
// (the +4097 keeps every component >= 1 for pages west/north of
// the origin). Returns { text, scrolls, bytes, coords }.
export function worldToPhext(sub, meta = {}) {
  const scrolls = new Map();
  const key = (a) => `${a[0]}.${a[1]}.${a[2]}/${a[3]}.${a[4]}.${a[5]}/${a[6]}.${a[7]}.${a[8]}`;
  let markCount = 0;
  for (const m of sub.overrides.values()) markCount += m.size;
  for (const m of sub.chisel.values()) markCount += m.size;
  scrolls.set(key([1, 1, 1, 1, 1, 1, 1, 1, 1]), [
    "# Nova Fox — a world, written out",
    "",
    `Player: ${meta.player || "unknown"}`,
    `Exported: ${meta.exportedAt || ""}`,
    ...(meta.score !== undefined ? [`Score: ${meta.score}`] : []),
    `Opened pages: ${sub.scrolls.size} · Marks: ${markCount} · Inscriptions: ${sub.wal.length}`,
    "",
    "The coordinate map: 1.1.1/1.1.1/1.1.1 is this scroll;",
    "1.1.1/1.1.1/1.1.2 is the inscription log — every mark the",
    "world has taken, in order. Each realm stands at book",
    "(its place in the game's realm list) + 2: its first scroll",
    "is the realm itself, 1.1.2 its marks, 1.1.3 its monsters",
    "and placed things, and its opened pages stand at 1.2.1",
    "with the page's own coordinates, shifted by 4097 so no",
    "component falls below 1.",
    "",
  ].join("\n"));
  const logLines = [
    "# The inscription log",
    "",
    `Quest done: ${sub.questDone ? "yes" : "no"} · Deep Stone Hat granted: ${sub.hatGranted ? "yes" : "no"}`,
    `Days claimed: ${[...sub.dailyClaimed].join(", ") || "none"}`,
    "",
  ];
  for (const seg of sub.wal) logLines.push(`#${seg.seq} ${seg.op} @ ${seg.where} — ${seg.detail}`);
  logLines.push("");
  scrolls.set(key([1, 1, 1, 1, 1, 1, 1, 1, 2]), logLines.join("\n"));
  REALMS.forEach((r, i) => {
    const book = i + 2;
    const pages = [...sub.scrolls.values()].filter((s) => s.realmId === r.id);
    const overrides = sub.overrides.get(r.id);
    const chisel = sub.chisel.get(r.id);
    const monsters = sub.monsters.filter((m) => m.realmId === r.id);
    const items = sub.items.filter((it) => it.realmId === r.id);
    if (!pages.length && !monsters.length && !items.length &&
        !(overrides && overrides.size) && !(chisel && chisel.size)) return;
    const grav = sub.realmGravity.get(r.id);
    scrolls.set(key([1, 1, book, 1, 1, 1, 1, 1, 1]), [
      `# ${r.name}`,
      "",
      `Realm: ${r.id}`,
      `Subspace coordinate: ${realmCoord(r.id).join(".")}`,
      `Down: ${grav === -1 ? "up (flipped, and remembered)" : "down"}`,
      `Opened pages: ${pages.length} · Monsters: ${monsters.length} · Placed things: ${items.length}`,
      "",
    ].join("\n"));
    if ((overrides && overrides.size) || (chisel && chisel.size)) {
      const lines = [`# Marks in ${r.name}`, ""];
      if (overrides) for (const [k, v] of [...overrides.entries()].sort()) {
        lines.push(`${k} block ${v}`);
      }
      if (chisel) for (const [k, v] of [...chisel.entries()].sort()) {
        lines.push(`${k} chisel ${v}`);
      }
      lines.push("");
      scrolls.set(key([1, 1, book, 1, 1, 2, 1, 1, 1]), lines.join("\n"));
    }
    if (monsters.length || items.length) {
      const lines = [`# Monsters and placed things in ${r.name}`, ""];
      for (const m of monsters) {
        lines.push(`monster #${m.id} ${m.kind} at cell ${m.gx},${m.gy} — ${m.alive ? `alive, ${m.hp} hp` : "struck down"}`);
      }
      for (const it of items) {
        lines.push(`thing ${it.kind} at ${it.bx},${it.bz} — ${it.taken ? "taken up" : "waiting"}`);
      }
      lines.push("");
      scrolls.set(key([1, 1, book, 1, 1, 3, 1, 1, 1]), lines.join("\n"));
    }
    for (const s of pages) {
      const lines = [
        `# ${r.name} — page ${s.sx},${s.sy}`,
        "",
        `Seed: ${s.seed} · Down: ${s.gravDir === -1 ? "up" : "down"} · Living cells: ${sub.lifeOf(s)}`,
        "",
      ];
      for (let gy = 0; gy < LIFE_N; gy++) {
        let row = "";
        for (let gx = 0; gx < LIFE_N; gx++) row += s.grid[gy * LIFE_N + gx] ? "#" : ".";
        lines.push(row);
      }
      lines.push("");
      scrolls.set(key([1, 1, book, 1, 2, 1, 1, s.sx + 4097, s.sy + 4097]),
        lines.join("\n"));
    }
  });
  const text = phextImplode(scrolls);
  return {
    text,
    scrolls: scrolls.size,
    bytes: new TextEncoder().encode(text).length,
    coords: [...scrolls.keys()],
  };
}

// ---------- the sky: atmosphere, stars, galaxies (A2-SKYSSO, build 42 attempt 2) ----------
// Pure module — no DOM, no THREE, no storage — exactly like
// feedback.js / ideas.js: the game glue (game3.js) builds the real
// THREE objects from the data and decisions made here, and tests
// drive this module directly.
//
// Why this exists: the sky used to be a flat void colour plus fog
// ("the engine has no gradient skybox" — world.js palette note).
// Will, Play 1: "the sky should have atmosphere and stars/galaxies".
// So: a per-realm gradient dome derived from the realm's OWN palette
// (horizon = its fog colour, mid = fog lifted toward its sky light,
// zenith = its void deepened toward its accent), a deterministic
// starfield on that dome, and deterministic spiral galaxies — all
// in the world's palette idiom, per-realm where the realm colour
// scheme applies. Deterministic (seeded by a string hash, never
// Math.random) so every fox sees the same sky and tests can pin it.

export const SKY_DOME_RADIUS = 320; // inside the camera far plane (400, game3.js)
export const SKY_STAR_COUNT = 1400;
export const SKY_STAR_SEED = "nova-fox-sky";

// A small deterministic hash + PRNG (mulberry32), in the same
// spirit as world.js's hashStringJS: same seed, same sky, always.
export function skyHash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function skyRandom(seedStr) {
  let a = skyHash(seedStr) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mixHex(a, b, t) {
  const x = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((Math.round(ar + (br - ar) * x) << 16)
    | (Math.round(ag + (bg - ag) * x) << 8)
    | Math.round(ab + (bb - ab) * x)) >>> 0;
}
export function hexRgb(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

// The atmosphere gradient for a palette: four stops from horizon
// to zenith. Horizon is the realm's fog (the haze the world already
// fades into), the low sky lifts that fog toward the hemisphere sky
// light, the high sky falls toward the void, and the zenith is the
// void warmed a touch by the realm accent — depth, not a flat fill.
export function skyStopsFor(pal) {
  if (!pal) return [];
  const horizon = pal.fog;
  const low = mixHex(pal.fog, pal.hemiSky, 0.38);
  const high = mixHex(pal.void, pal.hemiSky, 0.16);
  const zenith = mixHex(pal.void, pal.accent, 0.07);
  return [
    { offset: 0.0, color: horizon },
    { offset: 0.28, color: low },
    { offset: 0.62, color: high },
    { offset: 1.0, color: zenith },
  ];
}
// Colour of the gradient at dome height t (0 = horizon, 1 = zenith),
// by linear interpolation between the stops above.
export function skyColorAt(pal, t) {
  const stops = skyStopsFor(pal);
  if (!stops.length) return 0;
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i].offset) {
      const a = stops[i - 1], b = stops[i];
      const f = (x - a.offset) / ((b.offset - a.offset) || 1);
      return mixHex(a.color, b.color, f);
    }
  }
  return stops[stops.length - 1].color;
}
// The atmosphere treatment as one record the glue applies whole:
// gradient stops plus the haze band (the fog the scene already
// carries, named here so the sky and the world fog agree) and the
// star/galaxy tint (the realm's sky light, so a realm's stars are
// dressed in its own colours).
export function atmosphereFor(pal) {
  if (!pal) return null;
  return {
    stops: skyStopsFor(pal),
    hazeColor: pal.fog,
    hazeNear: pal.fogNear,
    hazeFar: pal.fogFar,
    starTint: mixHex(0xffffff, pal.hemiSky, 0.35),
    galaxyTint: mixHex(pal.accent, pal.hemiSky, 0.4),
  };
}

// The starfield: SKY_STAR_COUNT points spread over the dome
// (full sphere — the fox can flip gravity and look down-sky too),
// each with a brightness. Deterministic from SKY_STAR_SEED.
let _stars = null;
export function starField() {
  if (_stars) return _stars;
  const rnd = skyRandom(SKY_STAR_SEED);
  const out = [];
  for (let i = 0; i < SKY_STAR_COUNT; i++) {
    const u = rnd() * 2 - 1; // cos of polar angle, uniform on sphere
    const th = rnd() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    out.push({
      x: SKY_DOME_RADIUS * s * Math.cos(th),
      y: SKY_DOME_RADIUS * u,
      z: SKY_DOME_RADIUS * s * Math.sin(th),
      bright: 0.35 + rnd() * 0.65,
      size: rnd() < 0.08 ? 2 : 1,
    });
  }
  _stars = out;
  return out;
}

// The galaxies: a handful of named-by-index spiral discs high on
// the dome, each with a palette-independent identity (position,
// radius in dome units, colour, arm tightness) — the glue tints
// them per-realm via atmosphereFor().galaxyTint.
// F-GROK-13: three of them (the Pale Wheel, the Ember Spiral, the
// Green Veil) now sit within ~23 degrees of the zenith with radii
// of 46-52 dome units (a radius of ~8-9 degrees of sky each, before the glue's
// extended glow discs), so a fox looking straight up sees more
// than one galaxy at a size no star can match.
export const SKY_GALAXIES = [
  { name: "the Pale Wheel", azimuth: 0.7, elevation: 1.18, radius: 48, color: 0xbfd8ff, arms: 2, spin: 0.9 },
  { name: "the Ember Spiral", azimuth: 2.4, elevation: 1.28, radius: 52, color: 0xffc9a3, arms: 2, spin: 1.2 },
  { name: "the Violet Reach", azimuth: 3.6, elevation: 0.5, radius: 42, color: 0xd6b3ff, arms: 3, spin: 0.7 },
  { name: "the Green Veil", azimuth: 4.8, elevation: 1.42, radius: 46, color: 0xa8ffd0, arms: 2, spin: 1.4 },
  { name: "the Far Choir", azimuth: 5.7, elevation: 0.78, radius: 30, color: 0xfff0b3, arms: 3, spin: 1.0 },
  { name: "the Low Halo", azimuth: 1.6, elevation: -0.55, radius: 24, color: 0xa3e6ff, arms: 2, spin: 1.1 },
];
export function galaxyCenter(g) {
  const ce = Math.cos(g.elevation), se = Math.sin(g.elevation);
  return {
    x: SKY_DOME_RADIUS * ce * Math.cos(g.azimuth),
    y: SKY_DOME_RADIUS * se,
    z: SKY_DOME_RADIUS * ce * Math.sin(g.azimuth),
  };
}
// Points of one galaxy: a flat spiral disc around its centre,
// lying tangent to the dome. Deterministic per galaxy name.
export function galaxyPoints(g, perGalaxy = 140) {
  const rnd = skyRandom(SKY_STAR_SEED + ":" + g.name);
  const c = galaxyCenter(g);
  // Tangent basis at the centre: t1 = normalised cross with up
  // (or with X when the centre is near a pole), t2 = centre x t1.
  const n = [c.x / SKY_DOME_RADIUS, c.y / SKY_DOME_RADIUS, c.z / SKY_DOME_RADIUS];
  const up = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let t1 = [n[1] * up[2] - n[2] * up[1], n[2] * up[0] - n[0] * up[2], n[0] * up[1] - n[1] * up[0]];
  const l1 = Math.hypot(...t1) || 1; t1 = t1.map((v) => v / l1);
  const t2 = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]];
  const out = [];
  for (let i = 0; i < perGalaxy; i++) {
    const arm = i % g.arms;
    const f = Math.pow(rnd(), 0.6); // denser toward the core
    const ang = (arm / g.arms) * Math.PI * 2 + f * g.spin * 3.2 + (rnd() - 0.5) * 0.35;
    const r = f * g.radius;
    out.push({
      x: c.x + t1[0] * Math.cos(ang) * r + t2[0] * Math.sin(ang) * r,
      y: c.y + t1[1] * Math.cos(ang) * r + t2[1] * Math.sin(ang) * r,
      z: c.z + t1[2] * Math.cos(ang) * r + t2[2] * Math.sin(ang) * r,
      bright: 0.25 + (1 - f) * 0.6 + rnd() * 0.15,
    });
  }
  return out;
}
export function allGalaxyPoints(perGalaxy = 140) {
  const out = [];
  for (const g of SKY_GALAXIES) for (const p of galaxyPoints(g, perGalaxy)) out.push({ ...p, galaxy: g.name, color: g.color });
  return out;
}
