// Nova Fox demo29 — EE 995 feedback-batch legs, in headless Chrome
// over CDP (the cdp_test3.mjs pattern; run via the Jenkins job
// nova-fox-e2e-demo29-probe). Drives the real input path.
// Legs: Joy present (8) - the sword + powerup announcement (11+10) -
// intro once per game (1) - menu by touch button and by the Esc
// unlock (2) - the portal panel (4) - the rift walked through to
// Ashfall (5+6) - stepping back out aborts - the walk home - enemy
// engagement persistence (9) - ROYGBIV palettes in-page (7).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9385);
const URL = process.env.NF_URL || pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "index.html")).href;

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "novafox29-probe-"));
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
async function mouse(type, x, y, button, buttons) {
  await send("Input.dispatchMouseEvent", {
    type, x, y, button: button || "none", buttons: buttons || 0, clickCount: 1,
  });
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
// Returns the final truth of expr.
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

  // --- Item 8: Joy is present, visually -------------------------------------
  const joy0 = await evalJs("NOVA_FOX3.joyPos()");
  const pos0 = await evalJs("({x: NOVA_FOX3.state.pos.x, y: NOVA_FOX3.state.pos.y, z: NOVA_FOX3.state.pos.z})");
  check("Joy has a visible form at the fox's shoulder",
    !!joy0 && Math.hypot(joy0.x - pos0.x, joy0.z - pos0.z) < 4 && joy0.y > pos0.y,
    JSON.stringify(joy0));

  // --- Item 7: ROYGBIV in the page's own palette table ----------------------
  check("ROYGBIV: the page's palettes carry the band accents",
    (await evalJs("NOVA_FOX3.palettes().trust.accent")) === 0xff2e2e &&
    (await evalJs("NOVA_FOX3.palettes().logos.accent")) === 0xffd21f &&
    (await evalJs("NOVA_FOX3.palettes().elven.accent")) === 0x2eff7a &&
    (await evalJs("NOVA_FOX3.palettes().halycon.accent")) === 0x3fa9ff &&
    (await evalJs("NOVA_FOX3.palettes().orchid.accent")) === 0xb45cff);
  check("ROYGBIV: applying Trust Fall dresses the scene in its fog",
    (await evalJs("NOVA_FOX3.applyPalette('trust'), NOVA_FOX3.paletteNow().fog")) ===
    (await evalJs("NOVA_FOX3.palettes().trust.fog")));
  await evalJs("NOVA_FOX3.applyPalette('nova')");

  // --- Items 11+10: the sword by the spawn, and its announcement -------------
  // Face the sword (spawn ~(8.5, 8.5), sword at (11, 10)) and walk to it.
  await evalJs("NOVA_FOX3.state.yaw = Math.atan2(-(11 - NOVA_FOX3.state.pos.x), -(10 - NOVA_FOX3.state.pos.z))");
  let cardSeen = false;
  await keyDown("w", "KeyW");
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      const d = await evalJs("document.getElementById('powercard').style.display");
      if (d === "block") cardSeen = true;
      if ((await evalJs("NOVA_FOX3.state.weapon")) === "sword") break;
      await sleep(150);
    }
  }
  await keyUp("w", "KeyW");
  check("the Small Sword is picked up near the spawn",
    (await evalJs("NOVA_FOX3.state.weapon")) === "sword");
  check("the powerup announcement fired (center card + count)",
    cardSeen && (await evalJs("NOVA_FOX3.powerShown()")) >= 1 &&
    (await evalJs("document.getElementById('power-name').textContent")) === "the Small Sword");
  const joy1 = await evalJs("NOVA_FOX3.joyPos()");
  const pos1 = await evalJs("({x: NOVA_FOX3.state.pos.x, z: NOVA_FOX3.state.pos.z})");
  check("Joy followed the walk (still at the shoulder)",
    !!joy1 && Math.hypot(joy1.x - pos1.x, joy1.z - pos1.z) < 4 &&
    Math.hypot(joy1.x - joy0.x, joy1.z - joy0.z) > 0.5);

  // --- Item 1: the intro plays once per game ---------------------------------
  check("guide opens on the wake step (fresh game)",
    (await evalJs("NOVA_FOX3.state.guideStep")) === 0);
  await evalJs("NOVA_FOX3.guideAdvance()");
  await evalJs("NOVA_FOX3.guideAdvance()");
  const savedGuide = await evalJs("localStorage.getItem('nova-phox-guide')");
  check("the guide's place is written as it advances",
    !!savedGuide && JSON.parse(savedGuide).step === 2, String(savedGuide));
  await send("Page.reload");
  booted = false;
  for (let i = 0; i < 60 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
  }
  await sleep(800);
  check("after a reload the intro does NOT restart (step kept)",
    booted && (await evalJs("NOVA_FOX3.state.guideStep")) === 2 &&
    (await evalJs("NOVA_FOX3.guideCurrent().id")) !== "wake");
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(300);

  // --- Item 2a: the menu by its touch button ----------------------------------
  await evalJs("document.getElementById('btn-menu').click()");
  await sleep(250);
  check("menu opens from the touch menu button",
    (await evalJs("document.getElementById('menu').style.display")) === "block");
  await evalJs("document.getElementById('menu-close').click()");
  await sleep(250);
  check("menu closes from its back-to-the-world row",
    (await evalJs("document.getElementById('menu').style.display")) !== "block");

  // --- Item 2b: Esc through the pointer-unlock --------------------------------
  await mouse("mousePressed", 640, 400, "left", 1);
  await mouse("mouseReleased", 640, 400, "left", 0);
  await sleep(600);
  const locked = await evalJs("!!document.pointerLockElement");
  if (locked) {
    await evalJs("document.exitPointerLock()");
    await sleep(400);
    check("Esc (the pointer-unlock) opens the menu",
      (await evalJs("document.getElementById('menu').style.display")) === "block");
    await key("Escape", "Escape");
    await sleep(250);
    check("the menu closes again (Esc while unlocked)",
      (await evalJs("document.getElementById('menu').style.display")) !== "block");
  } else {
    console.log("  .. pointer lock unavailable in this headless run — Esc leg SKIPPED (lock never engaged)");
    check("Esc (the pointer-unlock) opens the menu [skipped: no lock in headless]", false, "pointerLockElement never set");
  }

  // --- Item 4: the portal panel ------------------------------------------------
  await evalJs("NOVA_FOX3.state.yaw = 0");
  await key("m", "KeyM");
  await sleep(300);
  check("one action opens the portal panel (M)",
    (await evalJs("document.getElementById('realms').style.display")) === "block");
  check("the panel lists eleven realms, ten of them portals",
    (await evalJs("document.querySelectorAll('#realms-list .realmrow').length")) === 11 &&
    (await evalJs("document.querySelectorAll('#realms-list [data-portal]').length")) === 10);
  await evalJs("document.querySelector('[data-portal=\"ashfall\"]').click()");
  await sleep(300);
  check("choosing Ashfall brings its portal up where the fox stands",
    (await evalJs("document.getElementById('realms').style.display")) !== "block" &&
    (await evalJs("NOVA_FOX3.state.riftLink && NOVA_FOX3.state.riftLink.target.realmId")) === "ashfall" &&
    (await evalJs("!!NOVA_FOX3.state.rift")) === true);

  // --- Items 5+6: walk through the rift to Ashfall ------------------------------
  const entered = await walkUntil("w", "KeyW", "!!NOVA_FOX3.state.transit", 30000, "stepping into the disc");
  check("stepping into the disc begins the walk through (transit, not teleport)",
    entered && (await evalJs("NOVA_FOX3.state.realm")) === "nova");
  const pocketX = await evalJs("NOVA_FOX3.state.pos.x");
  check("the passage is elsewhere: the fox stands in the pocket",
    pocketX > 30000, `pos.x=${pocketX}`);
  const crossed = await walkUntil("w", "KeyW", "NOVA_FOX3.state.realm === 'ashfall'", 120000, "walking the passage to Ashfall");
  check("walking the passage crosses to Ashfall Haven",
    crossed && (await evalJs("!!NOVA_FOX3.state.transit")) === false &&
    (await evalJs("NOVA_FOX3.state.riftLink.crosses")) >= 1);

  // --- Items 5+6: stepping back out aborts the walk -----------------------------
  await evalJs("NOVA_FOX3.state.yaw = 0");
  await key("m", "KeyM");
  await sleep(300);
  await evalJs("document.querySelector('[data-portal=\"nova\"]').click()");
  await sleep(300);
  const entered2 = await walkUntil("w", "KeyW", "!!NOVA_FOX3.state.transit", 30000, "stepping into the home disc");
  check("a second walk begins (home to Nova)", entered2);
  await keyDown("s", "KeyS");
  await sleep(3500);
  await keyUp("s", "KeyS");
  check("stepping back into the near disc aborts the walk, uncrossed",
    (await evalJs("!!NOVA_FOX3.state.transit")) === false &&
    (await evalJs("NOVA_FOX3.state.realm")) === "ashfall" &&
    (await evalJs("NOVA_FOX3.state.pos.x")) < 30000);

  // --- Items 5+6: and the walk home completes -----------------------------------
  // Step clear to re-arm the door, then walk in and through.
  await keyDown("s", "KeyS"); await sleep(1600); await keyUp("s", "KeyS");
  const entered3 = await walkUntil("w", "KeyW", "!!NOVA_FOX3.state.transit", 30000, "re-entering the home disc");
  check("the door re-arms after stepping clear", entered3);
  const home = await walkUntil("w", "KeyW", "NOVA_FOX3.state.realm === 'nova'", 120000, "walking the passage home");
  check("walking the passage home crosses to Nova Prime", home);

  // --- Item 9: engagement persistence, live --------------------------------------
  const mid = await evalJs(`(() => {
    const F = window.NOVA_FOX3;
    const gx = Math.floor(F.state.pos.x / 2) + 3, gz = Math.floor(F.state.pos.z / 2);
    window.__m995 = F.sub.spawnMonster(F.state.realm, gx, gz, "surface");
    return __m995.id;
  })()`);
  await sleep(4500); // several 650 ms ticks with the fox right there
  const eng = await evalJs("({e: __m995.engaged, v: NOVA_FOX3.sub.monsterVisible(__m995), p: __m995.phase})");
  check("a thing of the dark that entered the sphere is engaged and visible",
    eng.e === true && eng.v === true && eng.p === 0, JSON.stringify(eng));
  let stayedVisible = true;
  for (let i = 0; i < 5; i++) {
    await sleep(700);
    if (!(await evalJs("NOVA_FOX3.sub.monsterVisible(__m995)"))) stayedVisible = false;
  }
  check("engaged, it stays visible and targetable (no fade)",
    stayedVisible && (await evalJs("__m995.alive")) === true);

  check("no console errors across the EE 995 legs", consoleErrors.length === 0,
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
