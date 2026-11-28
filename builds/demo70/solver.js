// ---------- the solver (P-6): contribute cycles, earn credits ----------
// The design of record is SOLVER.md (~/workspace/nova-fox-restructure/).
// This module is its client half, written to the same discipline as
// economy.js: pure, no DOM, no three.js, no clocks except the ones a
// caller hands in — so test3.mjs can pin every number it promises.
//
// What the solver is (SOLVER.md §0): a fox lends their machine's idle
// capacity to work the world itself needs done, and the world pays in
// credits. This is NOT the generator: accrue() in economy.js is credit
// GENERATION (a paid entitlement dripping from a held world). The
// solver is contribution — verified work, paid per verified unit, at
// a self-throttled 30% of the machine, opt-in only, stoppable now.
//
// The v1 work class is a library stress-test placement in the game's
// own substrate (SOLVER.md §1.3(b)): seed a foam grid, run the Life
// lattice for a declared number of generations, record the resulting
// state hash. The algorithm is pinned IN THIS FILE and versioned with
// the class: if the core kernel's rule ever changes, the class
// version bumps and results are never compared across versions
// (§1.2 — determinism is the admission rule).

export const SOLVER_CLASS = {
  id: "life-stress-1",
  version: 1,
  W: 512,
  H: 512,
  GENS: 19000,
  // Measured on aletheia-core (node, one thread): a cold 100-gen run
  // costs 6.56 ms/generation, but JIT-warm steady state is ~2.1
  // ms/generation — 19,000 generations is ~40 s of raw CPU per unit
  // -> ~2.2 min of wall at the 30% duty on hub-class hardware, ~4.4
  // min on a machine twice as slow. SOLVER.md §1.1 asks 3-5 minutes
  // at 30% on a modest machine; 15 units is the reference
  // contributed hour the rates are tuned to.
  RAW_MS_REF: 240000, // the expected wall of one unit at 30% duty
  CANARY_EVERY: 50,   // every 50th unit re-issues an earlier input (§4.3)
  // Lease (§2.2): twice the expected duration + 2 minutes of grace.
  // A result that lands after its lease is not creditable, ever.
  LEASE_MS: 2 * 240000 + 120000,
};

export const SOLVER_RATES = {
  // Credits are whole in the purse, so the solver accrues in
  // twelfths of a credit — integers, exact, no float dust.
  TWELFTHS_PER_CREDIT: 12,
  // SOLVER.md §4.5, the reconciliation that binds: 5 credits per
  // USEFUL verified hour, k=2 redundancy + 2% canaries -> useful
  // fraction 0.49 -> an honest hour nets 2.45 cr. One unit at full
  // rate is 2 twelfths (1/6 cr): 15 units/hour x 2 = 30 twelfths
  // gross, x 49/50 canary expectation = 29.4 twelfths = 2.45 cr.
  TWELFTHS_PER_UNIT: 2,
  TWELFTHS_HALF_RATE: 1, // past the day's 4th contributed hour (§5.2)
  UNITS_PER_HOUR_REF: 15,
  DIMINISH_AFTER_MS: 4 * 60 * 60 * 1000,
  // Daily earn caps (§5.2 draft numbers, D47(c) split): the RATE is
  // never tiered — the cap is. Free foxes cap at 8 cr/day, paid at
  // 15 cr/day; past the cap, contributing continues as a gift.
  CAP_PAID_TWELFTHS: 180,  // 15 cr
  CAP_FREE_TWELFTHS: 96,   // 8 cr
};

// The governor's promise (SOLVER.md §3, §6): never more than 30% of
// the machine, rolling 5-minute average. The duty target rides a
// point under the line so 100 ms slice quantization can't cross it.
export const SOLVER_GOVERNOR = {
  DUTY: 0.29,
  CAP: 0.30,
  SLICE_MS: 100,
  WINDOW_MS: 5 * 60 * 1000,
};

// ---------- hashes (the FNV-1a family, as economy.js keeps them) ----

export function solverFnv1a64hex(str) {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i) & 0xff);
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, "0");
}

function solverScramble(s) {
  s = (s + 0x9e3779b9) >>> 0;
  let z = s;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}

function solverXorshift(s) {
  s ^= (s << 13) >>> 0; s >>>= 0;
  s ^= s >>> 17;
  s ^= (s << 5) >>> 0; s >>>= 0;
  return s >>> 0;
}

// String -> u32, FNV-1a over the string's bytes. Solver seed strings
// are ASCII by construction ("life-stress-1|123"), where char codes
// ARE the bytes — so this agrees with world.js's hashStringJS on
// every input the solver will ever hash.
export function solverHash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return solverScramble(h >>> 0);
}

// ---------- the work class kernel (pinned; versioned with the class)
// These functions are SELF-CONTAINED on purpose: the worker source is
// assembled from their own text (buildSolverWorkerSource), so the
// code that runs is the code the tests check — one text, two doors.

export function solverSeedString(seedN) {
  return "life-stress-1|" + seedN;
}

// The foam: world.js genFoamJS's shape — border all alive, interior
// alive where the xorshift stream lands under 30%.
export function solverFoamGrid(seedStr, w, h) {
  let s = solverScramble((solverHash32(seedStr) ^ 0x9e3779b9) >>> 0);
  if (s === 0) s = 0x1234567;
  const grid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { grid[y * w + x] = 1; continue; }
      s = solverXorshift(s);
      grid[y * w + x] = (s % 100) < 30 ? 1 : 0;
    }
  }
  return grid;
}

// One generation of the Life lattice: B3/S23, bounded edges (a cell
// outside the grid is dead ground) — world.js lifeStepJS's rule.
export function solverLifeStep(layer, w, h) {
  const next = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const yu = y > 0 ? y - 1 : -1, yd = y < h - 1 ? y + 1 : -1;
    for (let x = 0; x < w; x++) {
      const xl = x > 0 ? x - 1 : -1, xr = x < w - 1 ? x + 1 : -1;
      let n = 0;
      if (yu >= 0) { if (xl >= 0) n += layer[yu * w + xl]; n += layer[yu * w + x]; if (xr >= 0) n += layer[yu * w + xr]; }
      if (xl >= 0) n += layer[y * w + xl];
      if (xr >= 0) n += layer[y * w + xr];
      if (yd >= 0) { if (xl >= 0) n += layer[yd * w + xl]; n += layer[yd * w + x]; if (xr >= 0) n += layer[yd * w + xr]; }
      const alive = layer[y * w + x] === 1;
      next[y * w + x] = (alive ? (n === 2 || n === 3) : n === 3) ? 1 : 0;
    }
  }
  return next;
}

// The result of a finished unit: the FNV-1a-64 hash of the final
// grid's canonical byte string, and the living population.
export function solverGridResult(grid) {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  let pop = 0;
  for (let i = 0; i < grid.length; i++) {
    h ^= BigInt(grid[i]);
    h = (h * prime) & mask;
    pop += grid[i];
  }
  return { outputHash: h.toString(16).padStart(16, "0"), population: pop };
}

// Run one unit's work to completion, synchronously. The worker and
// the inline fallback slice this same computation by generations;
// the result is a pure function of (seedN, w, h, gens).
export function solverCompute(seedN, w, h, gens) {
  let grid = solverFoamGrid(solverSeedString(seedN), w, h);
  for (let g = 0; g < gens; g++) grid = solverLifeStep(grid, w, h);
  return solverGridResult(grid);
}

// ---------- unit derivation (SOLVER.md §2.1: the server chooses) ----
// There is no solver server in this architecture — the gateway IS
// the scroll. So the queue is a public discipline over a
// deterministic sequence: unit n's input is a pure function of n.
// A fox never chooses WHICH work — only when to stop, which is
// §6.1's right, not cherry-picking.

export function solverUnitId(n) { return "sol1-" + n; }

export function solverUnitNumber(unitId) {
  const m = /^sol1-(\d+)$/.exec(String(unitId || ""));
  return m ? parseInt(m[1], 10) : -1;
}

// Canary re-issue (§4.3): every 50th unit repeats the input of the
// unit 49 places earlier — a retired unit's answer is already
// public, so a fox who submits it without working is visible.
export function solverIsCanary(n) {
  return n >= SOLVER_CLASS.CANARY_EVERY - 1 && n % SOLVER_CLASS.CANARY_EVERY === SOLVER_CLASS.CANARY_EVERY - 1;
}

export function solverSeedUnitFor(n) {
  return solverIsCanary(n) ? n - (SOLVER_CLASS.CANARY_EVERY - 1) : n;
}

export function solverInputDescriptor(n) {
  return ["sol1", "v" + SOLVER_CLASS.version, solverSeedUnitFor(n),
    SOLVER_CLASS.W + "x" + SOLVER_CLASS.H, SOLVER_CLASS.GENS].join("|");
}

export function solverInputHash(n) {
  return solverFnv1a64hex(solverInputDescriptor(n));
}

// ---------- the solver scroll grammar (1.1.1/1.1.11/1.1.1) ----------
// Append-only, like every shared record. Three line kinds:
//   solclaim  — committed BEFORE work begins (§2.2); the claim hash
//               binds unit + input + account + a secret nonce.
//   solresult — submission reveals the nonce, so anyone can check
//               the claim was real and early.
//   solcredit — the mint record: exactly one per (unit, account),
//               written by the earner's own client when agreement
//               resolves; the public record that makes the mint
//               exactly-once across devices.

export function solverClaimHash(unitId, inputHash, account, nonce) {
  return solverFnv1a64hex([unitId, inputHash, account, nonce].join("|"));
}

export function solverClaimLine(unitId, inputHash, account, nonce, ts) {
  return ["solclaim", unitId, inputHash, account,
    solverClaimHash(unitId, inputHash, account, nonce), ts].join("|");
}

export function solverResultLine(unitId, outputHash, account, nonce, ts) {
  return ["solresult", unitId, outputHash, account, nonce, ts].join("|");
}

export function solverCreditLine(unitId, account, twelfths, dayKey, ts) {
  return ["solcredit", unitId, account, twelfths, dayKey, ts].join("|");
}

export function parseSolverScroll(text) {
  const rows = [];
  if (!text) return rows;
  for (const raw of String(text).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const p = line.split("|");
    const ts = parseInt(p[p.length - 1], 10);
    if (p[0] === "solclaim" && p.length === 6 && Number.isFinite(ts)) {
      rows.push({ kind: "claim", unitId: p[1], inputHash: p[2], account: p[3], claimHash: p[4], ts, idx: rows.length });
    } else if (p[0] === "solresult" && p.length === 6 && Number.isFinite(ts)) {
      rows.push({ kind: "result", unitId: p[1], outputHash: p[2], account: p[3], nonce: p[4], ts, idx: rows.length });
    } else if (p[0] === "solcredit" && p.length === 6 && Number.isFinite(ts)) {
      const twelfths = parseInt(p[3], 10);
      if (Number.isFinite(twelfths)) {
        rows.push({ kind: "credit", unitId: p[1], account: p[2], twelfths, dayKey: p[4], ts, idx: rows.length });
      }
    }
  }
  return rows;
}

// ---------- resolution: a pure function of the scroll ---------------
// Claim-before-first-result is the anti-copy rule: a result is
// ELIGIBLE only if its claim stands earlier in scroll order than
// the FIRST result for that unit. Scroll order is the record of
// truth (the geometry replay's precedent). A copier who waits for
// someone else's answer and then claims can never be eligible —
// their claim necessarily lands after the first result.

function solverIndexRows(rows) {
  const units = new Map();
  for (const r of rows) {
    if (r.kind === "credit") continue;
    if (!units.has(r.unitId)) units.set(r.unitId, { claims: [], results: [] });
    const u = units.get(r.unitId);
    if (r.kind === "claim") u.claims.push(r); else u.results.push(r);
  }
  return units;
}

// The eligible results of one unit, in scroll order: claim real
// (nonce recomputes the claim hash), claim early, lease in window,
// one result per account (the first counts).
export function solverEligibleResults(unitId, claims, results) {
  const n = solverUnitNumber(unitId);
  if (n < 0 || !results.length) return [];
  const inputHash = solverInputHash(n);
  const firstIdx = results[0].idx;
  const seen = new Set();
  const out = [];
  for (const r of results) {
    if (seen.has(r.account)) continue;
    const claim = claims.find((c) => c.account === r.account && c.idx < firstIdx &&
      c.inputHash === inputHash &&
      solverClaimHash(unitId, inputHash, r.account, r.nonce) === c.claimHash);
    if (!claim) continue;
    const dt = r.ts - claim.ts;
    if (!(dt >= 0 && dt <= SOLVER_CLASS.LEASE_MS)) continue;
    seen.add(r.account);
    out.push({ ...r, claim });
  }
  return out;
}

// The credited pairs of the whole scroll (§4.2, k=2): scan each
// unit's eligible results in scroll order; the first result matched
// by a later eligible result from a DIFFERENT account forms the
// pair; both earn; the unit closes. Disagreement is evidence, not
// accusation — no credit until an agreeing pair forms.
export function resolveSolver(rows) {
  const units = solverIndexRows(rows);
  const pairs = [];
  for (const [unitId, u] of units) {
    const eligible = solverEligibleResults(unitId, u.claims, u.results);
    let done = false;
    for (let i = 0; i < eligible.length && !done; i++) {
      for (let j = i + 1; j < eligible.length; j++) {
        if (eligible[j].outputHash === eligible[i].outputHash) {
          pairs.push({ unitId, n: solverUnitNumber(unitId),
            pair: [eligible[i].account, eligible[j].account],
            outputHash: eligible[i].outputHash, atIdx: eligible[j].idx });
          done = true;
          break;
        }
      }
    }
  }
  pairs.sort((a, b) => a.atIdx - b.atIdx);
  return { pairs };
}

export function solverCreditExists(rows, account, unitId) {
  return rows.some((r) => r.kind === "credit" && r.account === account && r.unitId === unitId);
}

// ---------- days, caps, standing (per-account derivations) ----------

// A day is a local calendar day, as the daily prize keeps it.
export function solverDayKey(ts) {
  const d = new Date(ts);
  const p2 = (v) => String(v).padStart(2, "0");
  return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
}

export function solverDayIndex(dayKey) {
  const p = String(dayKey || "").split("-").map((v) => parseInt(v, 10));
  if (p.length !== 3 || p.some((v) => !Number.isFinite(v))) return 0;
  return Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
}

// The account's first solver day on the scroll — the ramp's anchor
// (§5.3). Earliest claim day wins; a fox can't reset it by waiting,
// because it's read from the public record, not from local state.
export function solverFirstDay(rows, account) {
  let first = null;
  for (const r of rows) {
    if (r.kind !== "claim" || r.account !== account) continue;
    const k = solverDayKey(r.ts);
    if (first === null || k < first) first = k;
  }
  return first;
}

// New-account ramp (§5.3): days 1-7 the cap is a quarter, days
// 8-29 a half, full standing from day 30 of clean history.
export function solverRampFactor(ageDays) {
  if (ageDays < 7) return 0.25;
  if (ageDays < 30) return 0.5;
  return 1;
}

export function solverCapTwelfths(paid, ageDays) {
  const base = paid ? SOLVER_RATES.CAP_PAID_TWELFTHS : SOLVER_RATES.CAP_FREE_TWELFTHS;
  return Math.round(base * solverRampFactor(ageDays));
}

// One account's day, read off the scroll: twelfths already minted
// today, contributed milliseconds today (claim -> result spans of
// the account's own results), and every unit it has ever been
// credited for.
export function solverDayStats(rows, account, dayKey) {
  let twelfths = 0;
  const credited = new Set();
  for (const r of rows) {
    if (r.kind !== "credit" || r.account !== account) continue;
    credited.add(r.unitId);
    if (r.dayKey === dayKey) twelfths += r.twelfths;
  }
  const units = solverIndexRows(rows);
  let contribMs = 0;
  for (const [unitId, u] of units) {
    const res = u.results.find((r) => r.account === account);
    if (!res || solverDayKey(res.ts) !== dayKey) continue;
    const eligible = solverEligibleResults(unitId, u.claims, u.results);
    const mine = eligible.find((r) => r.account === account);
    if (mine) contribMs += Math.min(mine.ts - mine.claim.ts, SOLVER_CLASS.LEASE_MS);
  }
  return { twelfths, contribMs, credited };
}

// Standing (§2.3): completion over the account's last 100 claims.
// v1 records and shows it; it confiscates nothing, ever.
export function solverStanding(rows, account) {
  const units = solverIndexRows(rows);
  const mine = rows.filter((r) => r.kind === "claim" && r.account === account).slice(-100);
  let completed = 0;
  for (const c of mine) {
    const u = units.get(c.unitId);
    if (!u) continue;
    const res = u.results.find((r) => r.account === account);
    if (res && res.ts - c.ts >= 0 && res.ts - c.ts <= SOLVER_CLASS.LEASE_MS) completed++;
  }
  return { accepted: mine.length, completed,
    ratio: mine.length ? completed / mine.length : 1 };
}

// The grant for one credited unit, in twelfths — the rate math the
// pins hold: canaries pay 0 (the §4.5 overhead), the day's hours
// past the fourth pay half, and the day's cap binds the total.
export function solverGrantTwelfths({ canary, contribMsBefore, dayTwelfths, capTwelfths }) {
  if (canary) return 0;
  const base = contribMsBefore >= SOLVER_RATES.DIMINISH_AFTER_MS
    ? SOLVER_RATES.TWELFTHS_HALF_RATE : SOLVER_RATES.TWELFTHS_PER_UNIT;
  return Math.max(0, Math.min(base, capTwelfths - dayTwelfths));
}

// Everything a client needs to mint one credit, derived from the
// scroll alone: null when there is nothing to mint (no pair, not
// in the pair, already credited), else the twelfths to grant.
export function solverGrantFor(rows, account, unitId, paid, now) {
  const n = solverUnitNumber(unitId);
  if (n < 0) return null;
  const { pairs } = resolveSolver(rows);
  const hit = pairs.find((p) => p.unitId === unitId && p.pair.includes(account));
  if (!hit) return null;
  if (solverCreditExists(rows, account, unitId)) return null;
  const dayKey = solverDayKey(now);
  const stats = solverDayStats(rows, account, dayKey);
  // The diminishing slope judges the day's contributed time BEFORE
  // this unit: subtract this unit's own claim -> result span.
  let ownMs = 0;
  const u = solverIndexRows(rows).get(unitId);
  if (u) {
    const eligible = solverEligibleResults(unitId, u.claims, u.results);
    const mine = eligible.find((r) => r.account === account);
    if (mine && solverDayKey(mine.ts) === dayKey) {
      ownMs = Math.min(mine.ts - mine.claim.ts, SOLVER_CLASS.LEASE_MS);
    }
  }
  const firstDay = solverFirstDay(rows, account);
  const ageDays = firstDay ? solverDayIndex(dayKey) - solverDayIndex(firstDay) : 0;
  return solverGrantTwelfths({
    canary: solverIsCanary(n),
    contribMsBefore: Math.max(0, stats.contribMs - ownMs),
    dayTwelfths: stats.twelfths,
    capTwelfths: solverCapTwelfths(paid, ageDays),
  });
}

// The next unit a fox may claim (§2.1's discipline): the smallest n
// that is unclosed, unclaimed by me, and holding fewer than two
// live claims. A claim is live while its lease runs or it produced
// a result; an expired, resultless claim frees its slot (§2.3 —
// the unit returns to the queue).
export function nextSolverUnit(rows, account, now) {
  const units = solverIndexRows(rows);
  const { pairs } = resolveSolver(rows);
  const closed = new Set(pairs.map((p) => p.unitId));
  for (let n = 0; n < 1000000; n++) {
    const unitId = solverUnitId(n);
    if (closed.has(unitId)) continue;
    const u = units.get(unitId);
    if (!u) return n;
    if (u.claims.some((c) => c.account === account) ||
        u.results.some((r) => r.account === account)) continue;
    // Slots in use: foxes actively working (claimed, lease running,
    // no result yet) plus results already in. Two slots serve k=2;
    // when two results DISAGREE the unit stays claimable a while
    // longer — the escalation copy is how a pair ever forms (§4.4).
    const resulted = new Set(u.results.map((r) => r.account));
    const pending = u.claims.filter((c) => !resulted.has(c.account) &&
      now - c.ts <= SOLVER_CLASS.LEASE_MS).length;
    const slots = pending + resulted.size;
    if (slots >= 2 && !(resulted.size >= 2 && u.claims.length < 5)) continue;
    return n;
  }
  return -1;
}

// Fold twelfths into the purse: whole credits mint as they
// accumulate past multiples of twelve; the fraction carries (the
// accrue() house pattern). Returns the whole credits minted.
export function applySolverTwelfths(eco, twelfths) {
  if (!eco || !eco.solver || !(twelfths > 0)) return 0;
  eco.solver.fracTwelfths += twelfths;
  const whole = Math.floor(eco.solver.fracTwelfths / SOLVER_RATES.TWELFTHS_PER_CREDIT);
  if (whole > 0) {
    eco.solver.fracTwelfths -= whole * SOLVER_RATES.TWELFTHS_PER_CREDIT;
    eco.credits += whole;
    eco.lifetime.creditsEarned += whole;
  }
  return whole;
}

// ---------- the worker (SOLVER.md §3.2, §6.2: in-game door) ---------
// The compute runs in a Web Worker assembled from the kernel
// functions' own source text, so the shipped worker and the pinned
// kernel are the same text. The worker owns the governor: 100 ms
// work slices, sleeps scheduled to hold the duty target, its own
// busy time measured into a rolling 5-minute window — the number
// the panel's load meter shows. What is enforced is what is
// measured is what is displayed (§6.3).

const SOLVER_WORKER_DRIVER = `
let job = null;
let ring = []; // [performance.now(), busyMs] per finished slice
function loadAvg(now) {
  const from = now - ${SOLVER_GOVERNOR.WINDOW_MS};
  let busy = 0, span = Math.min(now - (job ? job.t0 : now), ${SOLVER_GOVERNOR.WINDOW_MS});
  for (const [t, ms] of ring) if (t >= from) busy += ms;
  return span > 0 ? busy / span : 0;
}
function slice() {
  if (!job) return;
  if (job.stopped) { job = null; return; }
  if (job.paused) { setTimeout(slice, 200); return; }
  const start = performance.now();
  while (job.gensLeft > 0 && performance.now() - start < ${SOLVER_GOVERNOR.SLICE_MS}) {
    const chunk = Math.min(job.gensLeft, 10);
    for (let i = 0; i < chunk; i++) job.grid = solverLifeStep(job.grid, job.w, job.h);
    job.gensLeft -= chunk;
    job.gensDone += chunk;
  }
  const busy = performance.now() - start;
  job.busyMs += busy;
  const now = performance.now();
  ring.push([now, busy]);
  while (ring.length && ring[0][0] < now - ${SOLVER_GOVERNOR.WINDOW_MS}) ring.shift();
  const avg = loadAvg(now);
  if (now - job.lastProgress >= 500) {
    job.lastProgress = now;
    postMessage({ type: "progress", gensDone: job.gensDone, busyMs: job.busyMs, loadAvg: avg });
  }
  if (job.gensLeft <= 0) {
    const res = solverGridResult(job.grid);
    postMessage({ type: "result", outputHash: res.outputHash, population: res.population, busyMs: job.busyMs, loadAvg: avg });
    job = null;
    return;
  }
  let sleep = busy * (1 - job.duty) / job.duty;
  if (avg > ${SOLVER_GOVERNOR.CAP}) sleep *= 2; // the guard: measured over the line, back off harder
  setTimeout(slice, Math.max(1, sleep));
}
onmessage = (e) => {
  const m = e.data || {};
  if (m.type === "start") {
    job = { grid: solverFoamGrid(solverSeedString(m.seedN), m.w, m.h),
      w: m.w, h: m.h, gensLeft: m.gens, gensDone: 0,
      duty: m.duty > 0 && m.duty <= 1 ? m.duty : ${SOLVER_GOVERNOR.DUTY},
      busyMs: 0, t0: performance.now(), lastProgress: 0,
      paused: false, stopped: false };
    ring = [];
    slice();
  } else if (m.type === "pause" && job) job.paused = true;
  else if (m.type === "resume" && job) job.paused = false;
  else if (m.type === "stop") { job = null; }
};
`;

export function buildSolverWorkerSource() {
  const fns = [solverScramble, solverXorshift, solverHash32, solverSeedString,
    solverFoamGrid, solverLifeStep, solverGridResult];
  return fns.map((f) => f.toString()).join("\n") + "\n" + SOLVER_WORKER_DRIVER;
}
