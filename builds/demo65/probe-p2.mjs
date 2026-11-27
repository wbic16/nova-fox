// Nova Fox — P-2 (digging with a point) dedicated probe, in headless
// Chrome over CDP (the probe-msg pattern; run via the Jenkins job
// nova-fox-e2e-p2dig-probe). Drives the real input path and the REAL
// gateway: the page is served as https://fox.phext.io from a local
// stand-in on 127.0.0.7 (host-resolver maps that one host there;
// P-1's stand-in holds 127.0.0.1) because the gateway's CORS admits
// only the game's own origin; phext.tech itself is the real awsbox
// gateway throughout. Context A carries a login token
// (operator-minted on awsbox, the EE 948 precedent; NF_TOKEN_FILE,
// never printed): it carves through the game's own chisel -> yield
// path, places a carried block through Feature 1's geometry record
// path, sells material into the purse, and carves its own placed
// block back. Context B is a fresh profile with no token and no
// edits: it must render A's placed block from the public scroll
// alone.
//
// Designated probe range (append-only subspace; these records are
// permanent and are labeled crafter "probe-p2-dig"): realm ashfall,
// carve columns x in [64,66] at z = 64, place column x = 68 at
// z = 64, at the surface — clear of the arrival pad (8,8), of P-1's
// trench range (x 27..33, z 28..32), and of this probe's retired
// first range (x 40..44, z = 40).
//
// REVISION (after EE 1100, probe builds #3/#4): the first range is
// retired — it is permanent, and build #3's carves deepened it, so
// build #4's strokes broke the newly exposed strata block (type 7)
// against the probe's hardcoded ASH expectation and every type-keyed
// leg cascaded. This revision (a) digs a FRESH range, (b) is
// type-agnostic: each column's judged type is read from the game
// state BEFORE the stroke, and yield / place / scroll / sale checks
// assert exact counts of whatever type was actually carved, and
// (c) splits build #3's undiagnosed compound A2 check ("profile
// reopens, pack intact" — boot() && exact count, no detail) into
// three separately named legs (boot returns / pack count exact /
// pack types exact), each printing the pack it actually saw.
//
// SECOND REVISION (EE 1101, after probe builds #5/#6): two more
// absolutes retired. (1) THE CROSSING RACE: the arrival structure
// generates ~20 s after boot (surface at the spawn columns goes
// y~17 -> y=47; a standing fox is carried up to the deck).
// openRift stands the rift where the fox stands AT CLICK TIME,
// so a probe that clicks before generation and walks after it
// passes over its own rift (feetY 17) on the deck (y 46)
// forever — builds #5/#6 walked 200+ cells north without a
// transit. The probe now SETTLES (waits until the fox's stand
// is stable) before clicking, in both crossings — what a player
// at the keyboard does without thinking. (2) THE SHARED PACK:
// the probe identity's economy record persists across runs
// (diagnostic runs' carve yields flushed and restored into a
// fresh profile), so the pack is not virgin at start. Every
// pack expectation is now a DELTA against the baseline read at
// start; the sale legs already read their counts live. (3) THE
// CARVE-BACK RETRY LOOP: the placed block's break goes through
// the geometry record, and the loop's 450 ms re-read could beat
// the attunement — the loop stroked again and gained a second
// unit from a second break, reading as a +2 yield. An isolation
// run proved the game exact (one stroke -> exactly one unit,
// ground cell intact). The leg now fires ONE stroke and reads
// the settled state before asserting the exact +1. (4) REPLAY
// COMPLETENESS: geoState() exposes rows vs known; carving
// before the geometry replay finishes lets a stroke re-break
// a cell the scroll already carved (the mirror still shows
// base) and yield it a second time. The probe waits for
// rows >= known, stable, before any carve. NOTE: even fully
// revised, one leg is EXPECTED to fail until the game defect
// it names is fixed — the carve-back yield: tryChisel yields
// baseBlockAt on base-branch breaks, so a placed block over a
// base-solid cell (a re-filled ground cell) yields the buried
// base type and the placed type vanishes. That leg tests the
// design's stated intent ("what you see break is what you
// carry"); its failure is the defect's signature, recorded in
// P2-PRODUCER-REPORT.md (EE 1101).
// (5) FIX VERIFICATION (this tree only — the chiselYield fix):
// the defect above is FIXED in this tree, so no leg is expected
// to fail. Three settle windows widen; every assertion stands
// exactly as written. The pack baseline is read until two
// consecutive reads agree (the economy record's landing can lag
// the boot under load, and a baseline read mid-landing poisons
// every delta after it — fix-probe builds #1/#2). The A2 reopen
// poll runs 90 s (same landing, slower profile). And the
// carve-back waits until the placed block actually stands in
// A2's own chunk view before its single stroke: a stroke fired
// before the chunk builds passes the placed cell by and breaks
// the ground under it — the control run on the UNFIXED tree
// (build #9) showed that failure alongside the defect's own,
// and fix-probe build #2 showed it here.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9419);
const URL = process.env.NF_URL || "https://fox.phext.io/index.html";
const TOKEN = process.env.NF_TOKEN_FILE
  ? readFileSync(process.env.NF_TOKEN_FILE, "utf8").trim() : "";
const GEO_SELECT =
  "https://phext.tech/api/v2/select?p=nova-phox-world&c=1.1.1/1.1.9/1.1.1";
// Flux per block, the MATERIAL_DEFS rates of record (economy.js).
// Used only to check the purse rise for whatever type the terrain
// actually judged — never to predict the type.
const FLUX = { 1: 2, 2: 2, 3: 4, 4: 6, 5: 1, 6: 3, 7: 5, 8: 5,
               9: 12, 10: 8, 13: 20, 14: 15, 16: 3, 17: 3, 18: 4 };
// The fresh sacrificial range (see header).
const CARVE_XS = [64, 65, 66];
const PLACE_X = 68;
const RANGE_Z = 64;

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Material maps compare by content, ignoring zero-count keys (a
// drained type may stand at 0 or be dropped, depending on the path).
function normMap(m) {
  const out = {};
  for (const [k, v] of Object.entries(m || {})) if (v) out[k] = v;
  return out;
}
function mapsEqual(a, b) {
  const na = normMap(a), nb = normMap(b);
  const ka = Object.keys(na), kb = Object.keys(nb);
  return ka.length === kb.length && ka.every((k) => na[k] === nb[k]);
}
const totalUnits = (m) => Object.values(normMap(m)).reduce((s, v) => s + v, 0);
// Add delta counts onto a baseline pack map (delta keys are block
// ids; values may fall to zero and are normalised away on compare).
function addToMap(base, delta) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(delta || {})) out[k] = (out[k] || 0) + v;
  return out;
}
// Wait until the fox's stand is stable — same realm, same y,
// across three consecutive one-second polls (the arrival
// structure has finished generating; see the header). Logs the
// settled stand either way; a timeout is not fatal, the crossing
// that follows is the actual test.
async function settleFox(F, label) {
  const t0 = Date.now();
  let last = null, stable = 0;
  while (Date.now() - t0 < 90000) {
    try {
      const s = await F.evalJs(`(() => { const s = NOVA_FOX3.state;
        return s.realm + "@" + s.pos.y.toFixed(1); })()`);
      if (s === last) { if (++stable >= 3) break; } else { last = s; stable = 0; }
    } catch (e) { /* page mid-load */ }
    await sleep(1000);
  }
  console.log(`  .. settled (${label}): ${last} after ${Math.round((Date.now() - t0) / 1000)}s`);
}
// Wait until the geometry replay is complete: geoState().rows
// (applied) catches up to geoState().known (on the scroll),
// stable across two polls. Carving against a half-replayed
// mirror re-breaks cells the scroll already carved.
async function settleWorld(F, label) {
  const t0 = Date.now();
  let last = null, stable = 0;
  while (Date.now() - t0 < 90000) {
    try {
      const g = await F.evalJs("NOVA_FOX3.geoState()");
      const s = `${g.rows}/${g.known}`;
      if (g.known > 0 && g.rows >= g.known && s === last) {
        if (++stable >= 2) break;
      } else { last = s; stable = 0; }
    } catch (e) { /* page mid-load */ }
    await sleep(1000);
  }
  console.log(`  .. world replay settled (${label}): rows/known ${last} after ${Math.round((Date.now() - t0) / 1000)}s`);
}

async function launch(profile) {
  const POLICY = process.env.NF_POLICY ||
    "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
  const policyExists = existsSync(POLICY);
  const policySha = policyExists
    ? createHash("sha256").update(readFileSync(POLICY)).digest("hex") : null;
  const chromeArgs = [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
    "--autoplay-policy=no-user-gesture-required",
    "--ignore-certificate-errors",
    "--host-resolver-rules=MAP fox.phext.io 127.0.0.7",
  ];
  if (policyExists) {
    chromeArgs.push(
      `--hatch-webgl-allowed-domains-file=${POLICY}`,
      `--hatch-webgl-allowed-domains-sha256=${policySha}`);
  }
  chromeArgs.push(`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank");
  const chrome = spawn(CHROME, chromeArgs, { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", () => {});
  let ws;
  async function wsUrl() {
    for (let i = 0; i < 50; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const list = await r.json();
        const page = list.find((t) => t.type === "page");
        if (page) return page.webSocketDebuggerUrl;
      } catch (e) { /* not up yet */ }
      await sleep(200);
    }
    throw new Error("devtools endpoint never came up");
  }
  let msgId = 0;
  const pending = new Map();
  const consoleErrors = [];
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onclose = () => {
    for (const p of pending.values()) p.reject(new Error(`CDP connection closed while waiting for ${p.label}`));
    pending.clear();
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.reject(new Error(`CDP error from ${p.label}: ` + (m.error.message || JSON.stringify(m.error))));
      else p.resolve(m.result);
    } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      consoleErrors.push(JSON.stringify(m.params.args));
    } else if (m.method === "Runtime.exceptionThrown") {
      consoleErrors.push("exception: " + (m.params.exceptionDetails.exception?.description || ""));
    }
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++msgId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: no response to ${method} (id ${id}) within 30s`));
      }, 30000);
      pending.set(id, {
        label: method,
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      try { ws.send(JSON.stringify({ id, method, params })); }
      catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
    });
  }
  async function evalJs(expression) {
    const r = await send("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (!r || !r.result) throw new Error("page evaluate returned no result for: " + expression.slice(0, 80));
    if (r.exceptionDetails) {
      throw new Error("page exception: " +
        (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    }
    return r.result.value;
  }
  async function keyDown(k, code) {
    await send("Input.dispatchKeyEvent", {
      type: "keyDown", key: k, code: code || "", text: k.length === 1 ? k : "",
    });
  }
  async function keyUp(k, code) {
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: code || "" });
  }
  async function key(k, code) {
    await keyDown(k, code); await sleep(90); await keyUp(k, code); await sleep(130);
  }
  async function waitFor(expr, timeoutMs, label) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if (await evalJs(expr)) return true; }
      catch (e) { /* a mid-navigation page answers nothing yet — keep waiting */ }
      await sleep(250);
    }
    console.log(`  .. timeout waiting for: ${label}`);
    return false;
  }
  async function boot() {
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1280, height: 800, deviceScaleFactor: 1, mobile: false,
    });
    await send("Page.navigate", { url: URL });
    let booted = false;
    for (let i = 0; i < 60 && !booted; i++) {
      await sleep(250);
      try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
    }
    return booted;
  }
  async function enterWorld() {
    await sleep(800);
    await evalJs("document.getElementById('splash-btn').click()");
    await sleep(300);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 640, y: 360, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 640, y: 360, button: "left", clickCount: 1 });
    await sleep(300);
  }
  return { chrome, evalJs, key, keyDown, keyUp, waitFor, boot, enterWorld, consoleErrors,
           close: () => { try { ws.close(); } catch (e) {} chrome.kill("SIGKILL"); } };
}

// The surface block's y in a column, from the world's own truth
// (the effective block, geometry record included).
const surfaceExpr = (realm, x, z) => `(() => {
  const F = window.NOVA_FOX3;
  for (let y = 63; y > 0; y--) {
    if (F.geoBlockAt(${JSON.stringify(realm)}, ${x}, y, ${z}) !== 0) return y;
  }
  return -1;
})()`;
// The judged type of the block standing at a cell — read BEFORE a
// stroke, this is the type the chisel will break and yield.
const typeExpr = (realm, x, y, z) =>
  `NOVA_FOX3.geoBlockAt(${JSON.stringify(realm)}, ${x}, ${y}, ${z})`;

const aimDown = (x, y, z) => `(() => { const F = window.NOVA_FOX3;
  F.state.pos.x = ${x}; F.state.pos.y = ${y}; F.state.pos.z = ${z};
  F.state.vel.y = 0;
  F.state.pitch = -Math.PI / 2; F.state.yaw = 0; return true; })()`;

try {
  // ================= CONTEXT A: the digger =================
  const profileA = mkdtempSync(join(tmpdir(), "novafox-p2A-"));
  const A = await launch(profileA);
  check("A: page boots, NOVA_FOX3 handle present", await A.boot());
  check("A: token stands ready for the write path", TOKEN.length > 20,
    TOKEN ? "" : "NF_TOKEN_FILE missing or empty");
  // The game's LS wrapper JSON-parses what it reads: the stored
  // entry must be the JSON encoding of the string, or the token
  // read honestly returns null and nothing ever flushes (P-1's
  // probe builds #1-#5 defect, fixed in their landed probe).
  await A.evalJs(`localStorage.setItem('nova-phox-token', ${JSON.stringify(JSON.stringify(TOKEN))})`);
  await A.evalJs(`localStorage.setItem('nova-phox-name', ${JSON.stringify(JSON.stringify("probe-p2-dig"))})`);
  await A.evalJs("localStorage.setItem('nf.scheme', 'wasd')");
  await A.evalJs("location.reload()");
  {
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) {
      await sleep(250);
      try { ok = await A.evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
    }
    check("A: the pinned boot returns (token + probe name)", ok);
  }
  await A.enterWorld();
  check("A: the backend answers — the game is online against the real gateway",
    await A.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online"));
  await settleWorld(A, "A before carving");
  await settleFox(A, "A before the crossing");
  // The shared identity's pack persists across runs (see header):
  // record the baseline; every pack expectation below is a delta
  // against it, never an absolute.
  // The baseline settles before it is recorded (header point
  // 5): poll until two consecutive reads agree, max 45 s.
  let packStart = null;
  {
    let prev = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      const m = (await A.evalJs("NOVA_FOX3.digState()")).materials;
      if (prev !== null && mapsEqual(m, prev)) { packStart = m; break; }
      prev = m;
      await sleep(1000);
    }
    if (packStart === null) packStart = prev || {};
  }
  check("A: the pack baseline is read (shared identity state recorded)",
    packStart !== null && typeof packStart === "object",
    `saw ${JSON.stringify(packStart)}`);
  console.log(`  .. A pack baseline: ${JSON.stringify(packStart)}`);

  // --- travel to ashfall (the probe-1034 crossing) ----------------------
  await A.evalJs("NOVA_FOX3.state.yaw = 0");
  await A.key("m", "KeyM");
  await sleep(300);
  await A.evalJs("document.querySelector('[data-portal=\\\"ashfall\\\"]').click()");
  await sleep(600);
  await A.keyDown("w", "KeyW");
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      if ((await A.evalJs("NOVA_FOX3.state.realm")) === "ashfall") break;
      await sleep(300);
    }
  }
  await A.keyUp("w", "KeyW");
  check("A: crossed to ashfall through the walked tunnel",
    (await A.evalJs("NOVA_FOX3.state.realm")) === "ashfall");
  await sleep(1000);

  // --- carve three surface cells: the yield lands in the pack ------------
  // Type-agnostic: each column's judged type is read from the game
  // state before the stroke; the yield expectation is built from
  // those reads, never from a hardcoded type.
  const carved = [];
  for (const x of CARVE_XS) {
    const h = await A.evalJs(surfaceExpr("ashfall", x, RANGE_Z));
    const judged = await A.evalJs(typeExpr("ashfall", x, h, RANGE_Z));
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      await A.evalJs(aimDown(x + 0.5, h + 2.4, RANGE_Z + 0.5));
      await A.key("c", "KeyC");
      await sleep(450);
      ok = (await A.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', ${x}, ${h}, ${RANGE_Z})`)) === 0;
    }
    check(`A: one stroke carves through at (${x}, surface, ${RANGE_Z})`, ok, `h=${h} judged=${judged}`);
    if (ok) carved.push({ x, y: h, type: judged });
  }
  // The expected pack: one unit of each carved cell's judged type,
  // for types that are materials at all (a type with no MATERIAL_DEF
  // yields nothing, by the design's own rule).
  const carveDelta = {};
  for (const c of carved) {
    if (FLUX[c.type] !== undefined) {
      carveDelta[c.type] = (carveDelta[c.type] || 0) + 1;
    }
  }
  const expectedAfterCarve = addToMap(packStart, carveDelta);
  const packAfterCarve = await A.evalJs("NOVA_FOX3.digState()");
  check("A: carving yields each carved block as its judged type",
    mapsEqual(packAfterCarve.materials, expectedAfterCarve),
    `expected ${JSON.stringify(expectedAfterCarve)}, saw ${JSON.stringify(packAfterCarve.materials)}`);
  // The placed type: the first carved type that is a held material.
  const placeEntry = carved.find((c) => FLUX[c.type] !== undefined);
  if (!placeEntry) throw new Error("no carved cell yielded a material type — nothing to place");
  const PT = placeEntry.type;
  const expectedAfterPlace = { ...expectedAfterCarve };
  expectedAfterPlace[PT] -= 1;

  // --- place a carried block on open ground at (PLACE_X, surface+1, RANGE_Z)
  const hP = await A.evalJs(surfaceExpr("ashfall", PLACE_X, RANGE_Z));
  await A.evalJs(`NOVA_FOX3.selectMaterial(${PT})`);
  let placed = false;
  for (let attempt = 0; attempt < 3 && !placed; attempt++) {
    await A.evalJs(aimDown(PLACE_X + 0.5, hP + 4.4, RANGE_Z + 0.5));
    await A.key("k", "KeyK");
    await sleep(500);
    placed = (await A.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', ${PLACE_X}, ${hP + 1}, ${RANGE_Z})`)) === PT;
  }
  check("A: the place verb stands a carried block on the ground", placed,
    `hP=${hP} type=${PT}`);
  const packAfterPlace = await A.evalJs("NOVA_FOX3.digState()");
  check("A: placing consumes exactly one unit of the type",
    mapsEqual(packAfterPlace.materials, expectedAfterPlace),
    `expected ${JSON.stringify(expectedAfterPlace)}, saw ${JSON.stringify(packAfterPlace.materials)}`);

  // --- the place stands on the real geometry scroll ----------------------
  // The flush drains every queue oldest-first under one shared
  // 115/min budget (marks -> board -> economy -> ideas): a busy
  // session's marks can starve the economy queue — where geometry
  // lines ride — for a cycle or two (the EE 976 diagnosis). The
  // fox stands still and the wait gives the sliding window time
  // to free; the snaps show the queue draining as evidence.
  const placeLine = `geo|ashfall|${PLACE_X},${hP + 1},${RANGE_Z}|${PT}|probe-p2-dig|`;
  const snap = async (label) => {
    try {
      const s = await A.evalJs(`(() => {
        let segs = [];
        try { segs = JSON.parse(localStorage.getItem('nova-phox-eco-outbox') || '[]')
          .map((x) => x.coord); } catch (e) { segs = ['<unparseable>']; }
        return { ecoQueued: segs.length, geoQueued: segs.filter((c) => c === '1.1.1/1.1.9/1.1.1').length,
          token: !!localStorage.getItem('nova-phox-token'),
          online: window.NOVA_FOX3.geoState().online };
      })()`);
      console.log(`  .. snap ${label}: ${JSON.stringify(s)}`);
    } catch (e) { console.log(`  .. snap ${label}: <unavailable>`); }
  };
  await snap("before the scroll wait");
  let scrollText = "";
  {
    const t0 = Date.now();
    let snappedMid = false;
    while (Date.now() - t0 < 300000) {
      try {
        const r = await fetch(GEO_SELECT);
        scrollText = await r.text();
      } catch (e) { /* retry */ }
      if (scrollText.split("\n").some((ln) => ln.startsWith(placeLine))) break;
      if (!snappedMid && Date.now() - t0 > 60000) { snappedMid = true; await snap("mid-wait"); }
      await sleep(3000);
    }
  }
  await snap("after the scroll wait");
  check("A: the place is a geometry record on the real scroll, crafter-named",
    scrollText.split("\n").some((ln) => ln.startsWith(placeLine)),
    scrollText.slice(0, 200));

  // ================= CONTEXT B: the witness =================
  A.close();
  await sleep(1500);
  const profileB = mkdtempSync(join(tmpdir(), "novafox-p2B-"));
  const B = await launch(profileB);
  check("B: page boots in a fresh profile (no token, no edits)", await B.boot());
  await B.enterWorld();
  check("B: the backend answers for a reader",
    await B.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online (B)"));
  check("B: the placed block renders from the scroll alone",
    await B.waitFor(`NOVA_FOX3.geoBlockAt('ashfall', ${PLACE_X}, ${hP + 1}, ${RANGE_Z}) === ${PT}`,
      90000, "placed block in B"),
    `top=${await B.evalJs(surfaceExpr("ashfall", PLACE_X, RANGE_Z)).catch(() => "?")}`);
  check("B: the ground under the placed block still stands",
    (await B.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', ${PLACE_X}, ${hP}, ${RANGE_Z})`)) !== 0);
  // reload: a second fresh boot renders it again — persistence,
  // not a cached view.
  await B.evalJs("location.reload()");
  {
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) {
      await sleep(250);
      try { ok = await B.evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
    }
    check("B: the pinned boot returns after reload", ok);
  }
  check("B: after reload the placed block still renders",
    await B.waitFor(`NOVA_FOX3.geoBlockAt('ashfall', ${PLACE_X}, ${hP + 1}, ${RANGE_Z}) === ${PT}`,
      45000, "placed block in B after reload"));
  check("B: no console errors", B.consoleErrors.length === 0,
    B.consoleErrors.slice(0, 2).join(" ; "));
  B.close();
  await sleep(1500);

  // ================= CONTEXT A2: the sale + the carve-back =================
  // A fresh profile carrying A's identity would start with an empty
  // pack (the pack is per-machine, with the purse) — so the sale leg
  // reopens A's own profile, where the pack persists.
  const A2 = await launch(profileA);
  // Split from build #3's compound check ("profile reopens, pack
  // intact" = boot() && exact count, no detail printed): three
  // legs, each naming its own cause, each printing what it saw.
  const bootedA2 = await A2.boot();
  check("A2: profile reopens (boot returns)", bootedA2);
  // The pack read settles: poll until it matches the expectation or
  // 90 s pass, logging the first and last packs seen, so a late
  // load and a stale snapshot are distinguishable in the console.
  let packA2 = null, firstPackA2 = null;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      try {
        const m = (await A2.evalJs("NOVA_FOX3.digState()")).materials;
        if (firstPackA2 === null) firstPackA2 = m;
        packA2 = m;
        if (mapsEqual(packA2, expectedAfterPlace)) break;
      } catch (e) { /* page not answering yet */ }
      await sleep(500);
    }
    console.log(`  .. A2 pack: first ${JSON.stringify(firstPackA2)}, settled ${JSON.stringify(packA2)}, expected ${JSON.stringify(expectedAfterPlace)}`);
  }
  check("A2: pack count exact after reopen",
    packA2 !== null && totalUnits(packA2) === totalUnits(expectedAfterPlace),
    `expected ${totalUnits(expectedAfterPlace)} units ${JSON.stringify(expectedAfterPlace)}, saw ${JSON.stringify(packA2)}`);
  check("A2: pack types exact after reopen",
    packA2 !== null && mapsEqual(packA2, expectedAfterPlace),
    `expected ${JSON.stringify(expectedAfterPlace)}, saw ${JSON.stringify(packA2)}`);
  try { await A2.enterWorld(); } catch (e) { /* a returning profile may skip the splash */ }
  await A2.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online (A2)");
  await settleWorld(A2, "A2 before the carve-back");
  const held = await A2.evalJs(`NOVA_FOX3.digState().materials[${PT}] || 0`);
  const soldBefore = await A2.evalJs("NOVA_FOX3.digState().sold");
  const tokensBefore = await A2.evalJs("NOVA_FOX3.digState().tokens");
  await A2.evalJs(`NOVA_FOX3.sellMaterialNow(${PT}, 'all')`);
  await sleep(400);
  const after = await A2.evalJs("NOVA_FOX3.digState()");
  check("A2: selling drains the type from the pack",
    (after.materials[PT] || 0) === 0, JSON.stringify(after.materials));
  check("A2: the sale is counted, block for block",
    after.sold === soldBefore + held, `sold ${soldBefore} -> ${after.sold}, held=${held}`);
  check(`A2: the purse rises by the recorded rate (${FLUX[PT]} flux per block of type ${PT}, +- one drip token)`,
    after.tokens - tokensBefore >= held * FLUX[PT] && after.tokens - tokensBefore <= held * FLUX[PT] + 1,
    `tokens ${tokensBefore} -> ${after.tokens}, held=${held}`);

  // The carve-back: A's own placed block breaks through the
  // geometry path and yields its type again.
  await A2.evalJs("NOVA_FOX3.state.realm === 'ashfall' || NOVA_FOX3.state.pos.set(8.5, 20, 8.5)");
  {
    // stand in ashfall: if the reopened profile starts in nova,
    // walk the tunnel as before.
    if ((await A2.evalJs("NOVA_FOX3.state.realm")) !== "ashfall") {
      await settleFox(A2, "A2 before the crossing");
      await A2.evalJs("NOVA_FOX3.state.yaw = 0");
      await A2.key("m", "KeyM");
      await sleep(300);
      await A2.evalJs("document.querySelector('[data-portal=\\\"ashfall\\\"]').click()");
      await sleep(600);
      await A2.keyDown("w", "KeyW");
      const t0 = Date.now();
      while (Date.now() - t0 < 60000) {
        if ((await A2.evalJs("NOVA_FOX3.state.realm")) === "ashfall") break;
        await sleep(300);
      }
      await A2.keyUp("w", "KeyW");
      await sleep(1000);
    }
  }
  const heldPTBeforeBack = await A2.evalJs(`NOVA_FOX3.digState().materials[${PT}] || 0`);
  // ONE stroke, then read the SETTLED state (see header point
  // 3): the geometry attunement can lag a fast re-read, and a
  // retry loop strokes again into that lag and breaks a second
  // cell — the +2 the first patched run recorded. Settled =
  // the cell reads 0 on two reads a second apart.
  // The stroke fires only once the placed block stands in THIS
  // client's chunk view (header point 5): two consecutive reads
  // of the placed type, 1 s apart, max 90 s.
  {
    const t0 = Date.now();
    let seen = 0;
    while (Date.now() - t0 < 90000) {
      const cell = await A2.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', ${PLACE_X}, ${hP + 1}, ${RANGE_Z})`);
      if (cell === PT) { if (++seen >= 2) break; } else seen = 0;
      await sleep(1000);
    }
    console.log(`  .. A2 carve-back readiness: placed block standing=${seen >= 2}`);
  }
  await A2.evalJs(aimDown(PLACE_X + 0.5, hP + 3.4, RANGE_Z + 0.5));
  await A2.key("c", "KeyC");
  let back = false;
  {
    const t0 = Date.now();
    let zeroReads = 0;
    while (Date.now() - t0 < 20000) {
      const cell = await A2.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', ${PLACE_X}, ${hP + 1}, ${RANGE_Z})`);
      if (cell === 0) { if (++zeroReads >= 2) { back = true; break; } }
      else zeroReads = 0;
      await sleep(1000);
    }
  }
  check("A2: a placed block carves back through the geometry path", back);
  check("A2: the carve-back yields the placed type again",
    (await A2.evalJs(`NOVA_FOX3.digState().materials[${PT}] || 0`)) === heldPTBeforeBack + 1,
    `saw ${JSON.stringify((await A2.evalJs("NOVA_FOX3.digState()")).materials)}, before=${heldPTBeforeBack}`);
  check("A2: no console errors", A2.consoleErrors.length === 0,
    A2.consoleErrors.slice(0, 2).join(" ; "));
  A2.close();
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + (e && e.message || e));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
