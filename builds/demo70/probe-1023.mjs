// Nova Fox demo31 — EE 1023 feedback-batch legs, in headless Chrome
// over CDP (the probe-995 pattern; run via the Jenkins job
// nova-fox-e2e-demo31-probe). Drives the real input path.
// Legs: waypoints to the Hall (6) - the sword equips (5) - one
// click carves (8) - the warp transit to Ashfall, standing still,
// no pocket (1) - stepping out unmakes it (1) - the warp home (1) -
// a struck thing holds a grudge and hunts (3).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9412);
const URL = process.env.NF_URL || pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "index.html")).href;

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "novafox31-probe-"));
const POLICY = process.env.NF_POLICY ||
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policyExists = existsSync(POLICY);
const policySha = policyExists
  ? createHash("sha256").update(readFileSync(POLICY)).digest("hex") : null;
const chromeArgs = [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
];
if (policyExists) {
  chromeArgs.push(
    `--hatch-webgl-allowed-domains-file=${POLICY}`,
    `--hatch-webgl-allowed-domains-sha256=${policySha}`);
}
chromeArgs.push(`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank");
const chrome = spawn(CHROME, chromeArgs, { stdio: ["ignore", "ignore", "pipe"] });
let chromeErr = "";
chrome.stderr.on("data", (d) => { chromeErr += d; });

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
let ws;
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
    if (await evalJs(expr)) return true;
    await sleep(250);
  }
  console.log(`  .. timeout waiting for: ${label}`);
  return false;
}
// Hold the forward key until expr is true or the cap passes.
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

try {
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
  check("page boots, NOVA_FOX3 handle present", booted);
  await sleep(800);

  // Deterministic scheme (the suite's own pin): WASD — W walks forward.
  await evalJs("localStorage.setItem('nf.scheme', 'wasd')");
  await send("Page.reload");
  booted = false;
  for (let i = 0; i < 60 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
  }
  check("the pinned boot returns (WASD)", booted &&
    (await evalJs("NOVA_FOX3.state.scheme")) === "WASD");
  await sleep(800);
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(300);
  check("splash bypassed", (await evalJs("NOVA_FOX3.state.splash")) === false);

  // --- Item 6: waypoints to the Hall, from the spawn -------------------------
  const wp = await evalJs("NOVA_FOX3.waypoint()");
  check("waypoint: the beacon stands over the Hall while the quest is unfinished",
    wp.beacon === true, JSON.stringify(wp));
  check("waypoint: the HUD diamond shows (the Hall is not yet near)",
    wp.hud === "block", JSON.stringify(wp));

  // --- Item 5: the sword — picked up, owned, equipped -------------------------
  await evalJs("NOVA_FOX3.state.yaw = Math.atan2(-(11 - NOVA_FOX3.state.pos.x), -(10 - NOVA_FOX3.state.pos.z))");
  const gotSword = await walkUntil("w", "KeyW",
    "NOVA_FOX3.equipState().weapon === 'sword'", 15000, "walking to the Small Sword");
  const eq = await evalJs("NOVA_FOX3.equipState()");
  check("the Small Sword is picked up near the spawn, and owned",
    gotSword && eq.ownsSword === true && eq.weapon === "sword", JSON.stringify(eq));
  await key("z", "KeyZ");
  await sleep(300);
  const eq2 = await evalJs("NOVA_FOX3.equipState()");
  check("the equip key with one weapon owned keeps it in hand (no phantom swap)",
    eq2.weapon === "sword" && eq2.ownsSword === true, JSON.stringify(eq2));

  // --- Item 8: one click carves ------------------------------------------------
  await evalJs("NOVA_FOX3.state.pitch = -1.25");
  await sleep(350);
  const breaksBefore = await evalJs("NOVA_FOX3.sub.wal.filter((w) => w.op === 'break').length");
  await key("c", "KeyC");
  await sleep(450);
  const breaksAfter = await evalJs("NOVA_FOX3.sub.wal.filter((w) => w.op === 'break').length");
  check("one click carves: a single chisel press breaks a block through",
    breaksAfter === breaksBefore + 1, `breaks ${breaksBefore} -> ${breaksAfter}`);
  await evalJs("NOVA_FOX3.state.pitch = 0");

  // --- Item 1: the portal panel opens the Ashfall rift -------------------------
  await evalJs("NOVA_FOX3.state.yaw = 0");
  await key("m", "KeyM");
  await sleep(300);
  await evalJs("document.querySelector('[data-portal=\\\"ashfall\\\"]').click()");
  await sleep(300);
  check("choosing Ashfall brings its portal up where the fox stands",
    (await evalJs("NOVA_FOX3.state.riftLink && NOVA_FOX3.state.riftLink.target.realmId")) === "ashfall" &&
    (await evalJs("!!NOVA_FOX3.state.rift")) === true);

  // --- Item 1: step in, then STAND STILL — the warp does the walking -----------
  const entered = await walkUntil("w", "KeyW", "NOVA_FOX3.inTransit()", 30000, "stepping into the disc");
  check("stepping into the disc begins the warp transit", entered);
  const tEnter = Date.now();
  let peakWarp = 0, maxX = 0, crossedAt = 0;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 9000) {
      const w = await evalJs("NOVA_FOX3.warpLevel()");
      if (w > peakWarp) peakWarp = w;
      const p = await evalJs("NOVA_FOX3.foxPos()");
      if (p.x > maxX) maxX = p.x;
      if ((await evalJs("NOVA_FOX3.state.realm")) === "ashfall") { crossedAt = Date.now(); break; }
      await sleep(100);
    }
  }
  check("the warp peaks: the rendered world itself bends (envelope > 0.5)",
    peakWarp > 0.5, `peak=${peakWarp.toFixed(2)}`);
  check("the crossing happens standing still — no pocket, no passage to walk",
    crossedAt > 0 && maxX < 30000, `maxX=${maxX}`);
  check("the crossing rides the warp's own envelope (~2.6 s, crossed at its peak)",
    crossedAt - tEnter >= 800 && crossedAt - tEnter <= 6000, `${crossedAt - tEnter}ms`);
  await waitFor("!NOVA_FOX3.inTransit()", 5000, "the transit settles");
  check("arrived in Ashfall Haven, the crossing counted",
    (await evalJs("NOVA_FOX3.state.riftLink.crosses")) >= 1);

  // --- Item 1: stepping back out unmakes the crossing ----------------------------
  await evalJs("NOVA_FOX3.state.yaw = 0");
  await key("m", "KeyM");
  await sleep(300);
  await evalJs("document.querySelector('[data-portal=\\\"nova\\\"]').click()");
  await sleep(300);
  const entered2 = await walkUntil("w", "KeyW", "NOVA_FOX3.inTransit()", 30000, "stepping into the home disc");
  check("a second warp begins (home to Nova)", entered2);
  await keyDown("s", "KeyS");
  await sleep(1200);
  await keyUp("s", "KeyS");
  await sleep(2500);
  check("stepping out of the disc unmakes the crossing, uncrossed",
    (await evalJs("NOVA_FOX3.inTransit()")) === false &&
    (await evalJs("NOVA_FOX3.state.realm")) === "ashfall");

  // --- Item 1: and the warp home completes ---------------------------------------
  await keyDown("s", "KeyS"); await sleep(1400); await keyUp("s", "KeyS");
  const entered3 = await walkUntil("w", "KeyW", "NOVA_FOX3.inTransit()", 30000, "re-entering the home disc");
  check("the door re-arms after stepping clear", entered3);
  const home = await waitFor("NOVA_FOX3.state.realm === 'nova'", 9000, "the warp carries the fox home");
  check("standing in the warp crosses home to Nova Prime", home);
  await waitFor("!NOVA_FOX3.inTransit()", 5000, "the home transit settles");

  // --- Item 3: a struck thing holds a grudge, and hunts ---------------------------
  await evalJs(`(() => {
    const F = window.NOVA_FOX3;
    const gx = Math.floor(F.state.pos.x / 2) + 3, gz = Math.floor(F.state.pos.z / 2);
    window.__m31 = F.sub.spawnMonster(F.state.realm, gx, gz, "surface");
    __m31.hp = 3;
    return __m31.id;
  })()`);
  await evalJs("NOVA_FOX3.sub.strikeMonster(window.__m31)");
  check("a struck thing holds a grudge (aggro is set in subspace)",
    (await evalJs("__m31.aggro")) === true);
  const d0 = await evalJs("Math.hypot(__m31.gx * 2 + 1 - NOVA_FOX3.state.pos.x, __m31.gy * 2 + 1 - NOVA_FOX3.state.pos.z)");
  await evalJs("NOVA_FOX3.state.pos.x += 130");
  await sleep(5200); // ~8 ticks: the grudge hunts at the quicker step
  const d1 = await evalJs("Math.hypot(__m31.gx * 2 + 1 - NOVA_FOX3.state.pos.x, __m31.gy * 2 + 1 - NOVA_FOX3.state.pos.z)");
  check("the grudge hunts from beyond the sphere (it closes on the fox)",
    d1 < d0 - 3, `d0=${d0.toFixed(1)} d1=${d1.toFixed(1)}`);

  check("no console errors across the EE 1023 legs", consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(" | "));
} catch (err) {
  fail++;
  console.log(`FAIL  probe aborted: ${err.message}`);
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  try { ws && ws.close(); } catch (e) { /* already closed */ }
  chrome.kill("SIGKILL");
  process.exit(fail ? 1 : 0);
}
