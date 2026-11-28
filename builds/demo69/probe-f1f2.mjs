import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9434);
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
    "--host-resolver-rules=MAP fox.phext.io 127.0.0.9",
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
  const profile = mkdtempSync(join(tmpdir(), "novafox-f1f2-"));
  const A = await launch(profile);
  const F = "window.NOVA_FOX3";
  check("boot reaches the game", await A.boot());
  // Deterministic identity: the random fox-NNNN names repeat across
  // profiles (fox-8664 twice in diagnosis) and a name that flipped
  // during the diagnosis sessions has its day already spent. The LS
  // wrapper JSON-encodes, so set the name JSON-encoded, reload, and
  // the fox is a name no session has ever spent.
  const myName = "probe-f1f2-" + Math.floor(Math.random() * 1e9);
  // One atomic storage write: the name, plus the guide reset.
  // The guide persists its step in LS and marches while the page
  // idles (the spawn fall drives its untils), so a guide left
  // wherever the first load's idle took it may have no talk
  // beats left after the reload. Resetting it beside the name
  // makes the reloaded fox start the lesson at wake, every run.
  await A.evalJs(`localStorage.setItem('nova-phox-name', JSON.stringify(${JSON.stringify(myName)})); localStorage.removeItem('nova-phox-guide'); location.reload();`);
  await sleep(2000);
  check("boot after identity reload", await A.boot());
  check("probe identity is the set name", (await A.evalJs(`${F}.playerName`)) === myName,
    await A.evalJs(`${F}.playerName`));
  await A.enterWorld();
  await sleep(300);
  const nstate = async () => JSON.parse(await A.evalJs(`JSON.stringify(${F}.narration.state())`));
  const gstate = async () => JSON.parse(await A.evalJs(`JSON.stringify(${F}.gravityState())`));
  const poll = async (fn, want, ms = 12000) => {
    const t0 = Date.now(); let v = await fn();
    while (!want(v) && Date.now() - t0 < ms) { await sleep(600); v = await fn(); }
    return v;
  };
  const BEATS = { wake: "N-01", rifts: "N-02", move: "N-03", numbers: "N-04",
    bridge: "N-05", ashfall: "N-06", gravity: "N-07", done: "N-09" };

  // ---- F-1: the voice follows the player ----
  // Choreography: pin the fox at spawn for the guide phase. Left
  // alone, the spawn fall (the realm stands inverted from the
  // diagnosis flips) can carry the fox through the border rift;
  // the bounce satisfies the bridge/ashfall untils on the spot
  // and the guide fast-forwards past its talk steps before any
  // line can be observed (diag5, and one full run, lost every
  // guide line this way). A pinned fox keeps the guide at its
  // opening steps, where its lines speak in order.
  await A.evalJs(`(() => { const s = ${F}.state;
    window.__fpin = setInterval(() => { s.pos.set(8.5, 20, 8.5); s.vel.set(0, 0, 0); }, 200);
    return true; })()`);
  const pollFast = async (want, ms = 25000) => {
    const t0 = Date.now(); let v = await nstate();
    while (!want(v) && Date.now() - t0 < ms) { await sleep(300); v = await nstate(); }
    return v;
  };
  let ns = await pollFast((v) => (v.speaking && v.speaking.startsWith("N-")) || v.pending.some((id) => id.startsWith("N-")), 8000);
  check("F-1: opening voice is live (speaking or queued N- line)",
    (ns.speaking && ns.speaking.startsWith("N-")) || ns.pending.some((id) => id.startsWith("N-")),
    JSON.stringify(ns));
  const dismissLit = await A.evalJs(`document.getElementById('guide-dismiss').classList.contains('skip-on')`);
  check("F-1: skip affordance lit before handover (#guide-dismiss.skip-on)", dismissLit === true);
  ns = await pollFast((v) => v.speaking && v.speaking.startsWith("N-"));
  const speaking0 = ns.speaking;
  check("F-1: a guide line is speaking before skip", !!speaking0, JSON.stringify(ns));
  await A.evalJs(`document.getElementById('guide-lines').click()`);
  ns = await poll(nstate, (v) => v.skipped.includes(speaking0), 6000);
  check("F-1: clicking Joy's lines skips the speaking line", ns.skipped.includes(speaking0),
    `skipped=${JSON.stringify(ns.skipped)} speaking=${ns.speaking}`);
  await A.evalJs(`clearInterval(window.__fpin)`);
  await A.evalJs(`${F}.guideAdvance()`);
  ns = await pollFast((v) => v.speaking && v.speaking.startsWith("N-"), 20000);
  const speaking1 = ns.speaking;
  check("F-1: the next step's guide line speaks after advancing", !!speaking1, JSON.stringify(ns));
  if (speaking1) {
    await A.keyDown("Enter", "Enter");
    await A.keyUp("Enter", "Enter");
    ns = await poll(nstate, (v) => v.skipped.includes(speaking1), 6000);
  }
  check("F-1: Enter skips the speaking guide line", !!speaking1 && ns.skipped.includes(speaking1),
    `skipped=${JSON.stringify(ns.skipped)} speaking=${ns.speaking}`);
  await A.evalJs(`${F}.guideAdvance()`);
  await sleep(350);
  await A.evalJs(`${F}.guideAdvance()`);
  await sleep(900);
  const stepNow = await A.evalJs(`${F}.guideCurrent() && ${F}.guideCurrent().id`);
  ns = await nstate();
  const liveN = [...(ns.speaking ? [ns.speaking] : []), ...ns.pending].filter((id) => id.startsWith("N-"));
  const prefNow = BEATS[stepNow];
  check("F-1: after advancing, no left-behind guide lines remain live",
    prefNow ? liveN.every((id) => id.startsWith(prefNow)) : liveN.length === 0,
    `step=${stepNow} live=${JSON.stringify(liveN)}`);

  // ---- F-2: the correction window + the Arrival return ----
  const g0 = await gstate();
  check("F-2: fresh fox may shift gravity (day unspent)", g0.allowed === true && g0.correction === false,
    JSON.stringify(g0));
  await A.evalJs(`${F}.flipGravityHere()`);
  const g1 = await poll(gstate, (v) => v.dir !== g0.dir);
  check("F-2: the flip turns the realm (dir changed)", g1.dir !== g0.dir, `${g0.dir} -> ${g1.dir}`);
  check("F-2: the flip spends the day (allowed=false)", g1.allowed === false, JSON.stringify(g1));
  check("F-2: correction window stands open after own flip", g1.correction === true, JSON.stringify(g1));
  await A.evalJs(`${F}.flipGravityHere()`);
  const g2 = await poll(gstate, (v) => v.dir === g0.dir);
  check("F-2: correction inside the window restores the realm (dir back)", g2.dir === g0.dir,
    `${g2.dir} vs ${g0.dir}`);
  check("F-2: correction is spent once used (no toggle loop)", g2.correction === false && g2.allowed === false,
    JSON.stringify(g2));
  await A.evalJs(`${F}.flipGravityHere()`);
  await sleep(1500);
  const g3 = await gstate();
  check("F-2: a third flip is refused - the day stays spent", g3.dir === g0.dir && g3.allowed === false,
    JSON.stringify(g3));
  await A.evalJs(`(() => { const s = ${F}.state; s.pos.x = 44.5; s.pos.y = 30; s.pos.z = 30.5; s.vel.set(0,0,0); return true; })()`);
  await sleep(2500);
  const back = JSON.parse(await A.evalJs(`JSON.stringify(${F}.unstick())`));
  await sleep(1200);
  const after = JSON.parse(await A.evalJs(`JSON.stringify(${F}.foxPos())`));
  check("F-2: unstick returns the fox to the realm Arrival",
    Math.hypot(after.x - 44.5, after.z - 30.5) > 3 && Math.hypot(after.x - back.x, after.z - back.z) < 1.5,
    `back=${JSON.stringify(back)} after=${JSON.stringify(after)}`);
  const menuItem = await A.evalJs(`!!document.getElementById('menu-unstick')`);
  check("F-2: Esc menu carries the Arrival return item (#menu-unstick)", menuItem === true);
  check("no console errors", A.consoleErrors.length === 0, A.consoleErrors.slice(0, 2).join(" ; "));
  A.close();
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + ((e && e.message) || e));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
