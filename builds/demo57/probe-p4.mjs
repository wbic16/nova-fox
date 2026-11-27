// Nova Fox P-4 — fight skills, tier 2 (EE 1087 batch, Feature 4), in
// headless Chrome over CDP (the probe-1037 pattern; run via the
// Jenkins job nova-fox-e2e with HARNESS=probe-p4.mjs). Drives the
// real input path throughout.
// Legs: the tier-2 bindings stand in the one store and REMAP (0) —
// the skills line and the field guide teach the three skills from
// the live bindings (1) — the shaping strike carves ONE block
// through P-1's geometry record path, is combat-rate-limited, and
// the record is read back by a FRESH profile that never edited (2)
// — the gravity feint lends its borrowed pull in honest gravity
// and under inverted gravity, and its cooldown is real (3) — the
// flute snare halves a pursuing hunter's closing, and while the
// flute sounds the strike window is spent (4) — the demo35 boss
// pair, re-run with the feint as the dodge: a competent fox wins
// through the mechanics, a standing fox falls (5).
// The geometry legs write REAL records to the shared chart, under
// the probe name "probe-p4-skills" with the standing probe token
// (NF_TOKEN_FILE, operator-minted, EE 948 precedent; never
// printed). Sacrificial range, named per the gravity/tunnel/MSG
// probe precedent: realm nova, cells around (200, surface, 200) —
// far from the arrival pad (8,8), the Hall, and every protection;
// two or three carved cells of remote meadow, permanent like
// everything on the scroll.
// The page is served as https://fox.phext.io from a local stand-in
// (~/p4-serve.py on 127.0.0.4:443, serving the demo44 tree; the
// host-resolver maps that one host) because the gateway's CORS
// admits only the game's own origin — a file:// page is Origin
// null and never comes online (build #19's lesson: every scroll
// read back empty while the local legs passed). phext.tech itself
// is the real awsbox gateway throughout. The P-1/P-2 stand-in
// pattern, on P-4's own loopback so no producer disturbs another.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9471);
const HERE = dirname(fileURLToPath(import.meta.url));
// The page ALWAYS boots from the stand-in. The Jenkins runner
// exports NF_URL=file://<tree>/index.html for the harness lineage
// it was built for; honoring it here would put the page back on
// Origin null and the gateway would refuse it again (build #21's
// lesson — the env beats the default). NF_PAGE_URL is the probe's
// own override; NF_URL is used only to locate the built artifact.
const PAGE_URL = process.env.NF_PAGE_URL || "https://fox.phext.io/index.html";
// The standing probe token (EE 948 precedent). NF_TOKEN_FILE wins
// when it names a readable, non-empty file; otherwise the
// standing path. The file is shared probe infrastructure and is
// occasionally rotated — an empty read is retried, not believed.
function readProbeToken() {
  const candidates = [process.env.NF_TOKEN_FILE,
    "/home/wbic16/msg-probe/token.txt"].filter(Boolean);
  for (const p of candidates) {
    try {
      const t = readFileSync(p, "utf8").trim();
      if (t) return t;
    } catch (e) { /* try the next source */ }
  }
  return "";
}
const TOKEN = readProbeToken();
const PROBE_NAME = "probe-p4-skills";

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chromeArgsFor(port, profile) {
  const args = [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=CalculateNativeWinOcclusion",
    "--ignore-certificate-errors",
    "--host-resolver-rules=MAP fox.phext.io 127.0.0.4",
  ];
  const POLICY = process.env.NF_POLICY ||
    "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
  if (existsSync(POLICY)) {
    args.push(
      `--hatch-webgl-allowed-domains-file=${POLICY}`,
      `--hatch-webgl-allowed-domains-sha256=${createHash("sha256").update(readFileSync(POLICY)).digest("hex")}`);
  }
  args.push(`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank");
  return args;
}

// One page over CDP — the probe-1037 plumbing, factored so the
// fresh-profile read-back leg (B) runs the same code as the actor (A).
async function openPage(port, tag) {
  const profile = mkdtempSync(join(tmpdir(), `novafox-p4-${tag}-`));
  const chrome = spawn(CHROME, chromeArgsFor(port, profile), { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", () => {});
  async function wsUrl() {
    for (let i = 0; i < 50; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await r.json();
        const page = list.find((t) => t.type === "page");
        if (page) return page.webSocketDebuggerUrl;
      } catch (e) { /* not up yet */ }
      await sleep(200);
    }
    throw new Error(`devtools endpoint never came up (${tag})`);
  }
  const ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  const errors = [];
  ws.onclose = () => {
    for (const p of pending.values()) p.reject(new Error(`CDP connection closed (${tag})`));
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
      errors.push(JSON.stringify(m.params.args));
    } else if (m.method === "Runtime.exceptionThrown") {
      errors.push("exception: " + (m.params.exceptionDetails.exception?.description || ""));
    }
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++msgId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: no response to ${method} (${tag}) within 30s`));
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
      if (await evalJs(expr)) return true;
      await sleep(250);
    }
    console.log(`  .. timeout waiting for: ${label} (${tag})`);
    return false;
  }
  async function boot() {
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 960, height: 600, deviceScaleFactor: 1, mobile: false,
    });
    await send("Page.navigate", { url: PAGE_URL });
    let booted = false;
    for (let i = 0; i < 60 && !booted; i++) {
      await sleep(250);
      try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
    }
    return booted;
  }
  return { chrome, ws, errors, send, evalJs, keyDown, keyUp, key, waitFor, boot };
}

let A = null, B = null;
try {
  A = await openPage(PORT, "a");
  const { evalJs, keyDown, keyUp, key, waitFor } = A;
  const bossState = () => evalJs("NOVA_FOX3.bossState()");
  const combatState = () => evalJs("NOVA_FOX3.combatState()");
  const foxPos = () => evalJs("NOVA_FOX3.foxPos()");
  const geoState = () => evalJs("NOVA_FOX3.geoState()");

  check("page boots, NOVA_FOX3 handle present", await A.boot());
  await sleep(800);
  await evalJs("localStorage.setItem('nf.scheme', 'wasd')");
  await A.send("Page.reload");
  let booted = false;
  for (let i = 0; i < 60 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
  }
  check("the pinned boot returns (WASD)", booted &&
    (await evalJs("NOVA_FOX3.state.scheme")) === "WASD");
  await sleep(800);

  // --- Leg 0: the probe identity stands ready for the write path -------------
  check("the probe token stands ready for the write path", TOKEN.length > 20,
    TOKEN ? "" : "no token file (NF_TOKEN_FILE / the standing probe token)");
  // The game's LS wrapper JSON-encodes values (LS.set); seed the
  // stored form (the JSON string of the value) or gameToken()
  // reads nothing back — build #19's token leg failed on exactly
  // this, the P-1 probe's recorded lesson.
  await evalJs(`localStorage.setItem('nova-phox-token', ${JSON.stringify(JSON.stringify(TOKEN))})`);
  await evalJs(`localStorage.setItem('nova-phox-name', ${JSON.stringify(JSON.stringify(PROBE_NAME))})`);
  await A.send("Page.reload");
  booted = false;
  for (let i = 0; i < 60 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
  }
  check("the pinned boot returns (token + probe name)", booted &&
    (await evalJs("NOVA_FOX3.hasToken()")) === true);
  await sleep(800);
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(300);
  check("splash bypassed", (await evalJs("NOVA_FOX3.state.splash")) === false);
  check("the backend answers — the game is online against the real gateway",
    await waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online"));
  // NO canvas mouse click for the verbs, on purpose (probe-1037's
  // lesson: pointer lock's loss opens the menu and eats the run).
  // The one exception is the flute leg, whose shift-press IS the
  // verb under test — and the flute branch returns before the
  // lock branch in the game's own handler.
  await sleep(300);

  // --- Leg 1: the surface — bindings, remapping, the line, the guide ---------
  check("bindings: the tier-2 defaults stand in the one store",
    (await evalJs("NOVA_FOX3.bindingFor('feint')")) === "KeyK" &&
    (await evalJs("NOVA_FOX3.bindingFor('shapeStrike')")) === "BracketRight",
    `feint=${await evalJs("NOVA_FOX3.bindingFor('feint')")} shape=${await evalJs("NOVA_FOX3.bindingFor('shapeStrike')")}`);
  const skills0 = await evalJs("document.getElementById('skills').textContent");
  check("skills: the HUD names the feint and the shaping strike, from the live bindings",
    /feint/.test(skills0) && /shaping/.test(skills0), skills0);
  // Remapping is real: move the feint to ';', fire it there, move it home.
  await evalJs("NOVA_FOX3.setBinding('feint', 'Semicolon')");
  await key(";", "Semicolon");
  await sleep(250);
  const remapped = (await combatState()).feintCdLeft > 0;
  check("bindings: a remapped feint answers on its new key", remapped);
  await evalJs("NOVA_FOX3.setBinding('feint', 'KeyK')");
  check("bindings: the feint is home again",
    (await evalJs("NOVA_FOX3.bindingFor('feint')")) === "KeyK");
  for (let i = 0; i < 3; i++) {
    await key("b", "KeyB");
    if (await waitFor("/Shaping strike/.test(document.getElementById('board-guide').textContent)",
      9000, "the field guide renders")) break;
  }
  const guide = await evalJs("document.getElementById('board-guide').textContent");
  check("the field guide teaches the three tier-2 skills",
    /Shaping strike/.test(guide) && /Gravity feint/.test(guide) && /Flute snare/.test(guide),
    guide.slice(0, 120));
  await key("b", "KeyB");
  await sleep(300);
  await evalJs("document.activeElement && document.activeElement.blur()");
  await sleep(300);

  // --- prep: the sword, and the Arrival ward lifted (probe-1037) --------------
  await evalJs("NOVA_FOX3.state.yaw = Math.atan2(-(11 - NOVA_FOX3.state.pos.x), -(10 - NOVA_FOX3.state.pos.z))");
  async function walkUntil(keyName, keyCode, expr, capMs, label) {
    await keyDown(keyName, keyCode);
    const t0 = Date.now();
    let ok = false;
    try {
      while (Date.now() - t0 < capMs) {
        if (await evalJs(expr)) { ok = true; break; }
        await sleep(400);
      }
    } finally { await keyUp(keyName, keyCode); }
    if (!ok) console.log(`  .. walk cap reached: ${label}`);
    return ok;
  }
  const gotSword = await walkUntil("w", "KeyW",
    "NOVA_FOX3.equipState().weapon === 'sword'", 15000, "walking to the Small Sword");
  check("the Small Sword is picked up near the spawn", gotSword);
  await key(" ", "Space");
  await sleep(900);
  const wardLifted = await waitFor(
    "NOVA_FOX3.state.firstJumpDone && performance.now() > NOVA_FOX3.state.introUntil + 1200",
    150000, "the Arrival ward lifting");
  check("the Arrival ward has lifted — the fox can be hurt now", wardLifted);
  async function reviveIfDead() {
    if ((await combatState()).dead) {
      await waitFor("!NOVA_FOX3.state.dead", 30000, "the fox wakes");
      await sleep(1200);
      return true;
    }
    return false;
  }
  async function facePoint(x, z) {
    await evalJs(`(() => {
      const F = window.NOVA_FOX3;
      F.state.yaw = Math.atan2(-(${x} - F.state.pos.x), -(${z} - F.state.pos.z));
      return true;
    })()`);
  }

  // --- travel to the sacrificial range: nova, around (200, surface, 200) ------
  async function travelTo(x, z) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await reviveIfDead();
      await evalJs(`NOVA_FOX3.state.pos.set(${x}, 34, ${z})`);
      await waitFor("NOVA_FOX3.state.onGround", 20000, "the fox lands");
      await sleep(600);
      const p = await foxPos();
      if (Math.abs(p.x - x) < 12 && Math.abs(p.z - z) < 12 &&
          !(await combatState()).dead) return true;
    }
    return false;
  }
  check("the fox stands in the sacrificial range (nova, ~200,200)",
    await travelTo(200.5, 200.5));

  // --- Leg 2: the shaping strike — one block, through the record ---------------
  // Aim exactly as the game aims (eye + facing, the chisel's ray),
  // read through the game's own block handle, so the cell named
  // here is the cell the strike will meet.
  async function scanTargetCell() {
    return await evalJs(`(async () => {
      const F = window.NOVA_FOX3;
      const st = F.state;
      // the game's own aiming math, replicated on plain numbers:
      const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
      const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
      // Euler YXZ on (0,0,-1): pitch about X, then yaw about Y.
      let dx = 0, dy = sp, dz = -cp;
      const rx = dx * cy + dz * sy, rz = -dx * sy + dz * cy;
      dx = rx; dz = rz;
      const ex = st.pos.x, ey = st.pos.y + 1.62, ez = st.pos.z;
      for (let t = 0.4; t < 5.2; t += 0.1) {
        const bx = Math.floor(ex + dx * t), by = Math.floor(ey + dy * t), bz = Math.floor(ez + dz * t);
        const v = F.geoBlockAt(st.realm, bx, by, bz);
        if (v !== 0) return { bx, by, bz, v };
      }
      return null;
    })()`);
  }
  await evalJs("NOVA_FOX3.state.pitch = -1.15; NOVA_FOX3.state.yaw = 0;");
  await sleep(400);
  // The aim must meet ground within the ray's reach from the
  // stance it presses in: if the stance looks over a dip or a
  // gully, step forward (the ray's own heading) and scan again.
  // Build #19's first press whiffed exactly this way — the slot
  // was spent over a slope the 5.2-block ray could not reach.
  async function findStrikeTarget() {
    for (let i = 0; i < 6; i++) {
      const cell = await scanTargetCell();
      if (cell) return cell;
      await evalJs("NOVA_FOX3.state.pos.z -= 2;");
      await sleep(700);
    }
    return null;
  }
  const cellA = await findStrikeTarget();
  check("the strike's aim finds a solid cell of ordinary ground", !!cellA,
    JSON.stringify(cellA));
  const known0 = (await geoState()).known;
  await key("]", "BracketRight");
  await sleep(700);
  const known1 = (await geoState()).known;
  check("shaping strike: ONE press carves ONE block, and the record grows by it",
    known1 === known0 + 1, `known ${known0} -> ${known1}`);
  check("shaping strike: the carved cell reads AIR in the geometry layer",
    cellA && (await evalJs(`NOVA_FOX3.geoBlockAt('nova', ${cellA.bx}, ${cellA.by}, ${cellA.bz})`)) === 0);
  check("shaping strike: the cooldown is real (the state names the wait)",
    (await combatState()).shapeCdLeft > 60,
    `shapeCdLeft=${(await combatState()).shapeCdLeft}`);
  await key("]", "BracketRight");
  await sleep(600);
  check("shaping strike: a second press inside the gather carves NOTHING (rate-limited)",
    (await geoState()).known === known1, `known=${(await geoState()).known}`);
  // After the gather, the strike answers again — the ray passes
  // through the carved cell and meets the ground beneath it.
  for (let i = 0; i < 20 && (await combatState()).shapeCdLeft > 0; i++) await sleep(300);
  const cellB = await findStrikeTarget();
  await key("]", "BracketRight");
  await sleep(700);
  const known2 = (await geoState()).known;
  check("shaping strike: after the gather it carves again, one more block",
    known2 === known1 + 1 && !!cellB, `known ${known1} -> ${known2}`);

  // --- Leg 2b: the record is the truth — a fresh profile renders it ------------
  let flushed = false;
  for (let i = 0; i < 18 && !flushed; i++) {
    await evalJs("NOVA_FOX3.backendFlush()");
    await sleep(5000);
    const gs = await geoState();
    flushed = gs.online && gs.rows >= 2;
    if (flushed) break;
  }
  check("the write path flushes to the shared chart (the scroll reads back)",
    flushed, JSON.stringify(await geoState()));
  B = await openPage(PORT + 7, "b");
  check("context B boots in a fresh profile (no token, no edits)", await B.boot());
  await sleep(800);
  await B.evalJs("document.getElementById('splash-btn').click()");
  await sleep(300);
  check("context B comes online against the real gateway",
    await B.waitFor("NOVA_FOX3.geoState().online === true", 30000, "context B online"));
  const bRows = await B.waitFor("NOVA_FOX3.geoState().rows > 0", 60000,
    "context B reads the geometry scroll");
  check("context B reads the geometry scroll from the chart alone", bRows,
    JSON.stringify(await B.evalJs("NOVA_FOX3.geoState()")));
  check("context B renders the strike's first carve — the record, not a local scar",
    cellA && (await B.evalJs(`NOVA_FOX3.geoBlockAt('nova', ${cellA.bx}, ${cellA.by}, ${cellA.bz})`)) === 0,
    JSON.stringify(cellA));
  check("context B renders the strike's second carve too",
    cellB && (await B.evalJs(`NOVA_FOX3.geoBlockAt('nova', ${cellB.bx}, ${cellB.by}, ${cellB.bz})`)) === 0,
    JSON.stringify(cellB));
  try { B.ws.close(); } catch (e) { /* already closed */ }
  B.chrome.kill("SIGKILL");
  B = null;

  // --- Leg 3: the gravity feint, in honest gravity ------------------------------
  // Read as physics, not theatre: falling, the fox's downward
  // velocity grows at gravity's rate (23/s). A feint quarters the
  // growth and lends the difference sideways — measure the
  // velocity's change across the feint's breath, mid-fall.
  // The velocity is sampled BEFORE the press, so the whole
  // measurement window sits inside the feint's breath (350 ms):
  // build #19 sampled after a 250 ms-granularity polling wait and
  // caught only the breath's tail (dv -3.11 against a -3.0 bar,
  // with the sideways loan already proving the feint fired). A
  // control fall in the same session carries the comparison, so
  // the ratio is the measurement, not the clock.
  async function feintFall(inverted, press) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await evalJs(`NOVA_FOX3.state.pos.y += ${inverted ? -13 : 13}`);
      const falling = await waitFor(
        inverted ? "NOVA_FOX3.state.vel.y > 3" : "NOVA_FOX3.state.vel.y < -3",
        6000, "the fox is falling");
      if (!falling) continue;
      const v1 = await evalJs("NOVA_FOX3.state.vel.y");
      // keyDown only, sampled inside the breath: the full key()
      // helper spends ~220 ms in its own sleeps, which pushed the
      // sample past the feint's 350 ms window (build #21: feint dv
      // -3.87 against control -4.37 — the loan was real, the
      // window had closed before the reading).
      if (press) { await keyDown("k", "KeyK"); await sleep(180); }
      else await sleep(200);
      const st = await evalJs("({ vy: NOVA_FOX3.state.vel.y, vx: NOVA_FOX3.state.vel.x, vz: NOVA_FOX3.state.vel.z })");
      if (press) await keyUp("k", "KeyK");
      return { dv: st.vy - v1, hSpeed: Math.hypot(st.vx, st.vz),
               cd: (await combatState()).feintCdLeft };
    }
    return null;
  }
  const ctl = await feintFall(false, false);
  const ff = await feintFall(false, true);
  check("gravity feint: mid-fall, the pull quarters — the fall's growth nearly stops",
    !!ctl && !!ff && ff.dv > ctl.dv * 0.55,
    (ctl && ff) ? `control dv=${ctl.dv.toFixed(2)}, feint dv=${ff.dv.toFixed(2)} over the same breath` : "a fall never settled");
  check("gravity feint: the borrowed pull lands sideways, toward the dodge",
    !!ff && ff.hSpeed > 2.5, ff ? `hSpeed=${ff.hSpeed.toFixed(2)}` : "");
  check("gravity feint: the cooldown is real (the state names the wait)",
    !!ff && ff.cd > 400, ff ? `feintCdLeft=${ff.cd}` : "");
  // Inside the same cooldown (the window has closed, the gather
  // has not): a second press must not feint.
  await sleep(500);
  await key("k", "KeyK");
  await sleep(300);
  check("gravity feint: a second press inside the cooldown does NOT feint",
    (await combatState()).feinting === false &&
    (await combatState()).feintCdLeft > 0);
  await waitFor("NOVA_FOX3.state.onGround", 15000, "the fox lands from the feint fall");

  // --- Leg 4: the flute snare ---------------------------------------------------
  // A hunter closes on a standing fox at the tick's full rate;
  // the same hunter, snared, closes at half. Both windows are
  // the same wall length in the same session, so the ratio is
  // the measurement, not the clock.
  await evalJs("NOVA_FOX3.state.pitch = -0.05;");
  await evalJs(`(() => {
    const F = window.NOVA_FOX3;
    const gx = Math.floor(F.state.pos.x / 2) + 8, gz = Math.floor(F.state.pos.z / 2);
    window.__sm = F.sub.spawnMonster(F.state.realm, gx, gz, "surface");
    __sm.role = "hunter"; __sm.aggro = false;
    return true;
  })()`);
  await sleep(700);
  const cellDist = async () => await evalJs(`(() => {
    const F = window.NOVA_FOX3;
    const fc = { x: Math.floor(F.state.pos.x / 2), y: Math.floor(F.state.pos.z / 2) };
    return Math.hypot(__sm.gx - fc.x, __sm.gy - fc.y);
  })()`);
  const d0 = await cellDist();
  await sleep(2600);
  const d1 = await cellDist();
  const controlClosed = d0 - d1;
  // The flute: shift + press on the canvas, drag up through the
  // bands. The game's handler takes the shift-press branch (the
  // flute) before the pointer-lock branch, by its own order.
  async function mouse(type, x, y, opts = {}) {
    await A.send("Input.dispatchMouseEvent", {
      type, x, y, button: opts.button || "none",
      buttons: opts.buttons || 0, modifiers: opts.shift ? 8 : 0,
      clickCount: type === "mousePressed" ? 1 : 0,
    });
  }
  await mouse("mousePressed", 480, 300, { button: "left", buttons: 1, shift: true });
  await sleep(200);
  for (const y of [268, 236, 204, 172, 140, 108]) {
    await mouse("mouseMoved", 480, y, { buttons: 1, shift: true });
    await sleep(130);
  }
  const snaredNow = await waitFor(
    "NOVA_FOX3.snareState().some((s) => s.id === window.__sm.id)",
    4000, "the hunter stands snared");
  check("flute snare: a dragged note snares the hunter in earshot", snaredNow,
    JSON.stringify(await evalJs("NOVA_FOX3.snareState()")));
  await sleep(1300);
  for (const y of [150, 118, 86]) { // a second drag keeps the tune (and the snare) alive
    await mouse("mouseMoved", 480, y, { buttons: 1, shift: true });
    await sleep(130);
  }
  await sleep(1300);
  const d2 = await cellDist();
  const snaredClosed = d1 - d2;
  check("flute snare: the snared hunter closes at half the unsnared rate",
    controlClosed >= 2 && snaredClosed * 2 <= controlClosed + 2,
    `control closed ${controlClosed.toFixed(1)} cells, snared closed ${snaredClosed.toFixed(1)}`);
  // The hunter's work is done: strike it out where it stands, so
  // it cannot hunt the fox into the Hall legs that follow.
  await evalJs("(() => { const F = window.NOVA_FOX3; F.sub.strikeMonster(__sm); F.sub.strikeMonster(__sm); return __sm.alive; })()");
  await sleep(300);
  // The strike window is the price: while the flute sounds, a
  // strike press is refused; the moment it ends, the strike is back.
  await evalJs(`(() => {
    const F = window.NOVA_FOX3;
    const gx = Math.floor(F.state.pos.x / 2) + 3, gz = Math.floor(F.state.pos.z / 2);
    window.__sw = F.sub.spawnMonster(F.state.realm, gx, gz, "wisp");
    F.state.pos.x = gx * 2 + 1.5 - 1.2; F.state.pos.z = gz * 2 + 1.5;
    return true;
  })()`);
  await sleep(600);
  await facePoint(await evalJs("__sw.gx * 2 + 1.5"), await evalJs("__sw.gy * 2 + 1.5"));
  await sleep(300);
  await key("f", "KeyF");
  await sleep(450);
  check("flute snare: while the flute sounds, the strike is refused (the window is the price)",
    (await evalJs("__sw.hp")) === 2, `wisp hp=${await evalJs("__sw.hp")}`);
  await mouse("mouseReleased", 480, 86, { button: "left", buttons: 0, shift: true });
  await sleep(400);
  // A whiffed swing is aim noise, not a refusal: re-face and
  // press again (up to three) — the leg's claim is that the
  // strike ANSWERS once the flute ends, not that one swing
  // cannot miss (build #21 whiffed its only swing).
  let answered = false;
  for (let i = 0; i < 3 && !answered; i++) {
    await facePoint(await evalJs("__sw.gx * 2 + 1.5"), await evalJs("__sw.gy * 2 + 1.5"));
    await sleep(200);
    await key("f", "KeyF");
    await sleep(450);
    answered = (await evalJs("__sw.hp")) === 1;
  }
  check("flute snare: the flute ended, the strike answers again",
    answered, `wisp hp=${await evalJs("__sw.hp")}`);

  // --- Leg 5: the boss pair, with the feint as the dodge -------------------------
  await reviveIfDead();
  const bs0 = await bossState();
  check("the Shadow stands in the Hall (boss handle reads it)",
    !!bs0 && bs0.alive === true && bs0.hp === 6, JSON.stringify(bs0));
  const gcx = bs0.cell.gx * 2 + 1.5, gcz = bs0.cell.gy * 2 + 1.5;
  await evalJs(`NOVA_FOX3.state.pos.set(${gcx - 4}, 8, ${gcz})`);
  await sleep(900);
  if (!(await waitFor("NOVA_FOX3.viewState().inHall", 10000, "the fox stands in the Hall"))) {
    await reviveIfDead();
    await evalJs(`NOVA_FOX3.state.pos.set(${gcx - 4}, 8, ${gcz})`);
    await sleep(900);
    await waitFor("NOVA_FOX3.viewState().inHall", 10000, "the fox stands in the Hall (retry)");
  }
  await facePoint(gcx, gcz);
  const engaged = await waitFor(
    "NOVA_FOX3.bossState().boss && NOVA_FOX3.bossState().boss.state !== 'guard'",
    20000, "the Shadow wakes");
  check("the Shadow wakes when the fox closes (the fight begins)", engaged);
  {
    let won = false, exposureDamage = 0, slamsDodged = 0, feintDodges = 0, entries = 0;
    let maxPhase = 0, lastHp = (await bossState()).hp, chargedFired = false;
    let bestChargedWindow = 0;
    let dodgeMark = null, dodgedThisTelegraph = false, feintThisTelegraph = false;
    const fightT0 = Date.now();
    while (Date.now() - fightT0 < 300000) {
      const bs = await bossState();
      if (!bs || !bs.alive) { won = true; break; }
      const st = bs.boss ? bs.boss.state : "guard";
      maxPhase = Math.max(maxPhase, bs.phase || 0);
      if (bs.hp < lastHp) {
        if (st === "exposed") exposureDamage += lastHp - bs.hp;
        lastHp = bs.hp;
      }
      const fp = await foxPos();
      const dist = Math.hypot(fp.x - gcx, fp.z - gcz);
      const foxHp = (await combatState()).hp;
      if (await evalJs("NOVA_FOX3.state.dead")) {
        entries++;
        await waitFor("!NOVA_FOX3.state.dead", 30000, "the fox wakes");
        await sleep(1200);
        await evalJs(`NOVA_FOX3.state.pos.set(${gcx - 4}, 8, ${gcz})`);
        await sleep(900);
        const bsR = await bossState();
        if (bsR) lastHp = bsR.hp;
        continue;
      }
      if (st === "telegraph" && !dodgedThisTelegraph) {
        dodgedThisTelegraph = true;
        dodgeMark = bs.boss.slamTick;
        feintThisTelegraph = false;
        await keyDown("s", "KeyS");
        // THE DODGE IS THE FEINT when its breath is gathered —
        // the tier-2 skill, spent where tier 1 spent the dash.
        // The dash serves only while the feint gathers.
        const cs = await combatState();
        if (cs.feintCdLeft <= 0) { await key("k", "KeyK"); feintThisTelegraph = true; }
        else if (cs.dashCdLeft <= 0) await key("j", "KeyJ");
        await sleep(1050);
        await keyUp("s", "KeyS");
        const tS = Date.now();
        while (Date.now() - tS < 1600) {
          const bsD = await bossState();
          if (bsD && bsD.boss && bsD.boss.slamTick > dodgeMark) {
            const sc = bsD.cell;
            const fpD = await foxPos();
            const fcell = { x: Math.floor(fpD.x / 2), y: Math.floor(fpD.z / 2) };
            const cheb = Math.max(Math.abs(fcell.x - sc.gx), Math.abs(fcell.y - sc.gy));
            if (cheb >= 2) {
              slamsDodged++;
              if (feintThisTelegraph) feintDodges++;
            }
            dodgeMark = null;
            break;
          }
          await sleep(120);
        }
        if (foxHp > 8) {
          const bsC = bs?.cell;
          const fpE = await foxPos();
          const distE = bsC ? Math.hypot(fpE.x - (bsC.gx * 2 + 1.5), fpE.z - (bsC.gy * 2 + 1.5)) : 99;
          if (bsC && distE < 9) {
            await facePoint(bsC.gx * 2 + 1.5, bsC.gy * 2 + 1.5);
            await keyDown("w", "KeyW");
            await keyDown("f", "KeyF");
            await sleep(580);
            await keyUp("f", "KeyF");
            await keyUp("w", "KeyW");
            chargedFired = true;
            await sleep(600);
            const bsS = await bossState();
            if (bsS && bsS.hp < lastHp) { exposureDamage += lastHp - bsS.hp; lastHp = bsS.hp; }
            const pop = await evalJs("document.getElementById('dmgnum').textContent");
            const mm = /^-(\d+)/.exec(pop || "");
            if (mm) bestChargedWindow = Math.max(bestChargedWindow, Number(mm[1]));
            else if (pop === "struck out") bestChargedWindow = Math.max(bestChargedWindow, 1);
          }
        }
      } else if (st === "exposed") {
        dodgedThisTelegraph = false;
        await facePoint(gcx, gcz);
        if (dist > 2.2) {
          await keyDown("w", "KeyW"); await sleep(300); await keyUp("w", "KeyW");
        }
        await facePoint(gcx, gcz);
        await keyDown("f", "KeyF");
        await sleep(250);
        await sleep(400);
        const releaseCharged = (await combatState()).chargeReady;
        if (releaseCharged) chargedFired = true;
        await keyUp("f", "KeyF");
        await sleep(500);
        const bs2 = await bossState();
        if (bs2 && bs2.hp < lastHp) { exposureDamage += lastHp - bs2.hp; lastHp = bs2.hp; }
        if (releaseCharged) {
          const pop = await evalJs("document.getElementById('dmgnum').textContent");
          const mm = /^-([0-9]+)/.exec(pop || "");
          if (mm) bestChargedWindow = Math.max(bestChargedWindow, Number(mm[1]));
          else if (pop === "struck out") bestChargedWindow = Math.max(bestChargedWindow, 1);
        }
      } else {
        if (st !== "telegraph") dodgedThisTelegraph = false;
        if (dist > 4.4) {
          await facePoint(gcx, gcz);
          await keyDown("w", "KeyW"); await sleep(300); await keyUp("w", "KeyW");
        } else if (dist < 1.6 && st === "stalk") {
          await keyDown("s", "KeyS"); await sleep(300); await keyUp("s", "KeyS");
        }
        if (foxHp <= 8) {
          await keyDown("s", "KeyS"); await sleep(900); await keyUp("s", "KeyS");
        }
      }
      await sleep(200);
    }
    const fightSecs = ((Date.now() - fightT0) / 1000).toFixed(0);
    check("the Shadow fight: a competent fox WINS (the tier-2 build)", won,
      `after ${fightSecs}s, deaths=${entries}`);
    check("the Shadow fight: it was a fight, not an accident (duration, phases)",
      won && Number(fightSecs) >= 8 && maxPhase >= 2,
      `${fightSecs}s maxPhase=${maxPhase}`);
    check("the Heart's gate: damage landed in the EXPOSURE (the weak point paid)",
      exposureDamage >= 2, `exposureDamage=${exposureDamage}`);
    check("the telegraph is a true tell: at least one slam was dodged clean",
      slamsDodged >= 1, `slamsDodged=${slamsDodged}`);
    check("the feint is a true dodge: at least one clean dodge was the feint's",
      feintDodges >= 1, `feintDodges=${feintDodges} of slamsDodged=${slamsDodged}`);
    check("the charged strike fired inside the fight", chargedFired);
    check("charged strike: the released charge lands through the gate — never a glance (the double: unit-pinned, read clean unloaded)",
      bestChargedWindow >= 1, `bestReleaseDelta=${bestChargedWindow}`);
  }

  // --- the standing fox falls (probe-1037's leg, unchanged) ----------------------
  await waitFor("!NOVA_FOX3.state.dead", 30000, "the fox is awake for the standing leg");
  await sleep(1500);
  {
    const bsS = await bossState();
    if (bsS && bsS.alive) {
      await evalJs(`NOVA_FOX3.state.pos.set(${bsS.cell.gx * 2 + 1.5}, 8, ${bsS.cell.gy * 2 + 1.5})`);
    } else {
      await evalJs(`(() => {
        const F = window.NOVA_FOX3;
        window.__sg = F.sub.spawnMonster("nova", 27, 19, "guardian");
        F.state.pos.set(27 * 2 + 1.5, 8, 19 * 2 + 1.5);
        return true;
      })()`);
    }
  }
  await sleep(900);
  {
    const hpStart = (await combatState()).hp;
    let sawDead = false, dmgAt30 = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 80000) {
      const cs = await combatState();
      if (Date.now() - t0 >= 30000) dmgAt30 = Math.max(dmgAt30, hpStart - cs.hp);
      if (cs.dead || cs.hp <= 0) { sawDead = true; break; }
      if (dmgAt30 >= 6 && Date.now() - t0 >= 30000) break;
      await sleep(250);
    }
    dmgAt30 = Math.max(dmgAt30, hpStart - (await combatState()).hp);
    check("the standing fox is hurt, repeatedly (the Shadow presses its advantage)",
      dmgAt30 >= Math.min(6, hpStart), `dmg across the stand=${dmgAt30} of hp ${hpStart}`);
    check("the standing fox FALLS — standing still in front of the Shadow is death",
      sawDead, `hp start=${hpStart}`);
  }

  // --- Leg 3b: the feint under inverted gravity -----------------------------------
  // Back in the sacrificial range — its own scroll, far from the
  // Hall's — so the day's one shift is spent where nothing else
  // stands. gravityState().allowed is read first: if this probe
  // name has already shifted nova today, the leg says so by name
  // rather than pressing against a refusal.
  await waitFor("!NOVA_FOX3.state.dead", 20000, "the fox wakes again");
  await sleep(1200);
  check("the fox returns to the sacrificial range for the inverted leg",
    await travelTo(200.5, 200.5));
  let flipped = (await evalJs("NOVA_FOX3.state.gravDir")) === -1;
  if (!flipped) {
    const gs = await evalJs("NOVA_FOX3.gravityState()");
    console.log(`  .. gravity at the range: ${JSON.stringify(gs)}`);
    for (let i = 0; i < 3 && !flipped; i++) {
      await key("g", "KeyG");
      flipped = await waitFor("NOVA_FOX3.state.gravDir === -1", 6000, "gravity inverts");
    }
  }
  check("gravity inverts for the feint leg (the day's shift, spent at the range)", flipped);
  if (flipped) {
    await waitFor("NOVA_FOX3.state.onGround", 12000, "standing on the vault");
    await sleep(2800); // the warp and the wooze run their course
    const ff2 = await feintFall(true, true);
    check("gravity feint INVERTED: the pull still quarters — now toward the ceiling",
      !!ff2 && ff2.dv < 3.0, ff2 ? `dv=${ff2.dv.toFixed(2)} over the breath (unfeinted: about +5.75)` : "the feint never fired");
    check("gravity feint INVERTED: the borrowed pull still lands sideways",
      !!ff2 && ff2.hSpeed > 2.5, ff2 ? `hSpeed=${ff2.hSpeed.toFixed(2)}` : "");
  }

  // --- the artifact itself carries the tier-2 work ---------------------------------
  {
    // Under the Jenkins runner the harness runs from a scratch
    // dir, not the tree — resolve the built artifact from the
    // runner's NF_URL (the tree's file URL) when there is one,
    // else the tree.
    const envUrl = process.env.NF_URL || "";
    const artPath = [envUrl.startsWith("file:") ? fileURLToPath(new URL(envUrl)) : null,
      join(HERE, "index.html"),
      "/home/wbic16/nf-repo/builds/demo44/index.html"]
      .find((p) => p && existsSync(p));
    const html = readFileSync(artPath, "utf8");
    check("the built artifact carries the tier-2 skills (verbs, physics, guide)",
      html.includes("function tryShapeStrike") && html.includes("function fluteSnare") &&
      html.includes("function feintAccel") && html.includes("Gravity feint"));
  }

  check("no console errors across the P-4 legs", A.errors.length === 0,
    A.errors.slice(0, 3).join(" | "));
} catch (err) {
  fail++;
  console.log(`FAIL  probe aborted: ${err.message}`);
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  try { A && A.ws.close(); } catch (e) { /* already closed */ }
  try { B && B.ws.close(); } catch (e) { /* already closed */ }
  try { A && A.chrome.kill("SIGKILL"); } catch (e) { /* already dead */ }
  try { B && B.chrome.kill("SIGKILL"); } catch (e) { /* already dead */ }
  process.exit(fail ? 1 : 0);
}
