// Nova Fox demo43 — P-1 mutable subspace geometry legs, in headless
// Chrome over CDP (the probe-1034 pattern; run via the Jenkins job
// nova-fox-e2e-demo43-probe). Drives the real input path and the
// REAL gateway: the page is served as https://fox.phext.io from a
// local stand-in (host-resolver maps that one host to 127.0.0.1)
// because the gateway's CORS admits only the game's own origin;
// phext.tech itself is the real awsbox gateway throughout. Context
// A carries a login token (operator-minted on awsbox, the EE 948
// precedent; NF_TOKEN_FILE, never printed) and carves through the
// game's own chisel -> outbox -> flush path. Context B is a fresh
// profile with no token and no edits: it must render A's trench
// from the public scroll alone.
//
// Designated probe range (append-only subspace; these records are
// permanent and are labeled crafter "probe-msg-geo"): realm
// ashfall, x in [27,33], z in [28,32], at the surface.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9418);
const URL = process.env.NF_URL || "https://fox.phext.io/index.html";
const TOKEN = process.env.NF_TOKEN_FILE
  ? readFileSync(process.env.NF_TOKEN_FILE, "utf8").trim() : "";
const GEO_SELECT =
  "https://phext.tech/api/v2/select?p=nova-phox-world&c=1.1.1/1.1.9/1.1.1";

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    "--host-resolver-rules=MAP fox.phext.io 127.0.0.1",
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
      if (await evalJs(expr)) return true;
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

// The surface block's y in a column, from the world's own truth.
const surfaceExpr = (realm, x, z) => `(() => {
  const F = window.NOVA_FOX3;
  for (let y = 63; y > 0; y--) {
    if (F.geoBlockAt(${JSON.stringify(realm)}, ${x}, y, ${z}) !== 0) return y;
  }
  return -1;
})()`;

const trench = []; // {x, y, z} carved by context A

try {
  // ================= CONTEXT A: the carver =================
  const profileA = mkdtempSync(join(tmpdir(), "novafox-msgA-"));
  const A = await launch(profileA);
  check("A: page boots, NOVA_FOX3 handle present", await A.boot());
  check("A: token stands ready for the write path", TOKEN.length > 20,
    TOKEN ? "" : "NF_TOKEN_FILE missing or empty");
  await A.evalJs(`localStorage.setItem('nova-phox-token', ${JSON.stringify(TOKEN)})`);
  await A.evalJs("localStorage.setItem('nova-phox-name', 'probe-msg-geo')");
  await A.evalJs("localStorage.setItem('nf.scheme', 'wasd')");
  await A.evalJs("location.reload()");
  await (async () => { // re-boot after reload (same CDP session)
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) {
      await sleep(250);
      try { ok = await A.evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
    }
    check("A: the pinned boot returns (token + probe name)", ok);
  })();
  await A.enterWorld();
  check("A: the backend answers — the game is online against the real gateway",
    await A.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online"));
  const rows0 = await A.evalJs("NOVA_FOX3.geoState().rows");
  check("A: the geometry scroll starts empty (a fresh coordinate)",
    rows0 === 0, `rows=${rows0}`);

  // --- the spawn pad refuses, in the game, through the verb ------------
  const padH = await A.evalJs(surfaceExpr("nova", 8, 8));
  const known0 = await A.evalJs("NOVA_FOX3.geoState().known");
  await A.evalJs(`(() => { const F = window.NOVA_FOX3;
    F.state.pos.x = 8.5; F.state.pos.y = ${padH} + 2.4; F.state.pos.z = 8.5;
    F.state.pitch = -Math.PI / 2; F.state.yaw = 0; return true; })()`);
  await A.key("c", "KeyC");
  await sleep(500);
  check("spawn: the arrival pad will not shape — its block stands",
    (await A.evalJs(`NOVA_FOX3.geoBlockAt('nova', 8, ${padH}, 8)`)) !== 0);
  check("spawn: the refusal wrote no record",
    (await A.evalJs("NOVA_FOX3.geoState().known")) === known0);
  check("spawn: the write-time check names the refusal",
    (await A.evalJs(`NOVA_FOX3.geoRefusal('nova', 8, ${padH}, 8, 0)`)) === "spawn");

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

  // --- the trench: three real chisel strokes at the surface --------------
  for (const x of [29, 30, 31]) {
    const h = await A.evalJs(surfaceExpr("ashfall", x, 30));
    let carved = false;
    for (let attempt = 0; attempt < 3 && !carved; attempt++) {
      await A.evalJs(`(() => { const F = window.NOVA_FOX3;
        F.state.pos.x = ${x} + 0.5; F.state.pos.y = ${h} + 2.4; F.state.pos.z = 30.5;
        F.state.pitch = -Math.PI / 2; F.state.yaw = 0; return true; })()`);
      await A.key("c", "KeyC");
      await sleep(450);
      carved = (await A.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', ${x}, ${h}, 30)`)) === 0;
    }
    check(`A: one stroke carves through at (${x}, surface, 30)`, carved, `h=${h}`);
    if (carved) trench.push({ x, y: h, z: 30 });
  }
  check("A: the trench is three cells", trench.length === 3,
    JSON.stringify(trench));

  // Diagnostic snapshot: is the record queued? did the flush run?
  const snap = async (label) => {
    const s = await A.evalJs(`(() => {
      let segs = [];
      try { segs = JSON.parse(localStorage.getItem('nova-phox-eco-outbox') || '[]')
        .map((x) => x.coord); } catch (e) { segs = ['<unparseable>']; }
      return { segs, token: !!localStorage.getItem('nova-phox-token'),
        online: window.NOVA_FOX3.geoState().online,
        known: window.NOVA_FOX3.geoState().known };
    })()`);
    console.log(`  .. snap ${label}: ${JSON.stringify(s)}`);
  };
  await snap("after the trench");

  // --- the records reach the real scroll ----------------------------------
  let scrollText = "";
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      try {
        const r = await fetch(GEO_SELECT);
        scrollText = await r.text();
      } catch (e) { /* retry */ }
      const lines = scrollText.split("\n")
        .filter((ln) => ln.startsWith("geo|ashfall|") && ln.includes("|probe-msg-geo|"));
      if (trench.every((c) => lines.some(
        (ln) => ln.startsWith(`geo|ashfall|${c.x},${c.y},${c.z}|0|`)))) break;
      if (Date.now() - t0 > 20000 && Date.now() - t0 < 24000) await snap("mid-wait");
      await sleep(3000);
    }
  }
  await snap("after the scroll wait");
  for (const c of trench) {
    check(`A: the carve at (${c.x},${c.y},${c.z}) stands on the real geometry scroll`,
      scrollText.split("\n").some(
        (ln) => ln.startsWith(`geo|ashfall|${c.x},${c.y},${c.z}|0|probe-msg-geo|`)),
      scrollText.slice(0, 200));
  }

  // --- restart persistence ---------------------------------------------------
  await A.evalJs("location.reload()");
  {
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) {
      await sleep(250);
      try { ok = await A.evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
    }
    check("A: the pinned boot returns after restart", ok);
  }
  await A.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online after restart");
  for (const c of trench) {
    check(`A: after restart the carve at (${c.x},${c.y},${c.z}) still stands`,
      (await A.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', ${c.x}, ${c.y}, ${c.z})`)) === 0);
  }

  // --- the sealing refusal, by name -------------------------------------------
  check("sealing: a solid fill in the entrance shaft is refused by name",
    (await A.evalJs("NOVA_FOX3.geoRefusal('nova', 44, 13, 30, 3)")) === "sealed-route");
  check("sealing: carving the shaft's walls is no sealing",
    (await A.evalJs("NOVA_FOX3.geoRefusal('nova', 45, 13, 30, 0)")) === null);
  check("sealing: no record names the shaft cell — the refusal wrote nothing",
    !scrollText.split("\n").some((ln) => ln.includes("|44,13,30|")));
  check("A: no console errors", A.consoleErrors.length === 0,
    A.consoleErrors.slice(0, 2).join(" ; "));
  A.close();
  await sleep(1500);

  // ================= CONTEXT B: the witness =================
  const profileB = mkdtempSync(join(tmpdir(), "novafox-msgB-"));
  const B = await launch(profileB);
  check("B: page boots in a fresh profile (no token, no edits)", await B.boot());
  await B.enterWorld();
  check("B: the backend answers for a reader",
    await B.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online (B)"));
  check("B: the scroll read-back carries the trench's records",
    await B.waitFor("NOVA_FOX3.geoState().rows >= 3", 45000, "geo rows >= 3"),
    `rows=${await B.evalJs("NOVA_FOX3.geoState().rows")}`);
  for (const c of trench) {
    check(`B: the trench renders for a fox who never carved — (${c.x},${c.y},${c.z}) is air`,
      (await B.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', ${c.x}, ${c.y}, ${c.z})`)) === 0);
  }
  const ctlH = await B.evalJs(surfaceExpr("ashfall", 35, 30));
  check("B: untouched ground nearby still stands",
    (await B.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', 35, ${ctlH}, 30)`)) !== 0);
  check("B: no console errors", B.consoleErrors.length === 0,
    B.consoleErrors.slice(0, 2).join(" ; "));
  B.close();
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + (e && e.message || e));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
