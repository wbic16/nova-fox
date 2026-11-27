// Nova Fox — P-2 (digging with a point) dedicated probe, in headless
// Chrome over CDP (the probe-msg pattern; run via the Jenkins job
// nova-fox-e2e-p2dig-probe). Drives the real input path and the REAL
// gateway: the page is served as https://fox.phext.io from a local
// stand-in on 127.0.0.2 (host-resolver maps that one host there;
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
// x in [40,44], z = 40, at the surface — clear of the arrival pad
// (8,8) and of P-1's trench range (x 27..33, z 28..32).
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
const ASH = 6; // BLOCK.ASH — ashfall's surface block, flux rate 3

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
    "--host-resolver-rules=MAP fox.phext.io 127.0.0.2",
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
  await A.evalJs(`localStorage.setItem('nova-phox-token', ${JSON.stringify(TOKEN)})`);
  await A.evalJs("localStorage.setItem('nova-phox-name', 'probe-p2-dig')");
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
  check("A: the pack starts empty",
    (await A.evalJs(`Object.keys(NOVA_FOX3.digState().materials).length`)) === 0);

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
  const carved = [];
  for (const x of [40, 41, 42]) {
    const h = await A.evalJs(surfaceExpr("ashfall", x, 40));
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      await A.evalJs(aimDown(x + 0.5, h + 2.4, 40.5));
      await A.key("c", "KeyC");
      await sleep(450);
      ok = (await A.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', ${x}, ${h}, 40)`)) === 0;
    }
    check(`A: one stroke carves through at (${x}, surface, 40)`, ok, `h=${h}`);
    if (ok) carved.push({ x, y: h });
  }
  const packAfterCarve = await A.evalJs("NOVA_FOX3.digState()");
  check("A: carving yields the carved block as typed material",
    (packAfterCarve.materials[ASH] || 0) === carved.length,
    JSON.stringify(packAfterCarve.materials));

  // --- place a carried block on open ground at (44, surface+1, 40) -------
  const h44 = await A.evalJs(surfaceExpr("ashfall", 44, 40));
  await A.evalJs(`NOVA_FOX3.selectMaterial(${ASH})`);
  let placed = false;
  for (let attempt = 0; attempt < 3 && !placed; attempt++) {
    await A.evalJs(aimDown(44.5, h44 + 4.4, 40.5));
    await A.key("k", "KeyK");
    await sleep(500);
    placed = (await A.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', 44, ${h44 + 1}, 40)`)) === ASH;
  }
  check("A: the place verb stands a carried block on the ground", placed,
    `h44=${h44}`);
  const packAfterPlace = await A.evalJs("NOVA_FOX3.digState()");
  check("A: placing consumes exactly one unit of the type",
    (packAfterPlace.materials[ASH] || 0) === carved.length - 1,
    JSON.stringify(packAfterPlace.materials));

  // --- the place stands on the real geometry scroll ----------------------
  // The flush drains every queue oldest-first under one shared
  // 115/min budget (marks -> board -> economy -> ideas): a busy
  // session's marks can starve the economy queue — where geometry
  // lines ride — for a cycle or two (the EE 976 diagnosis). The
  // fox stands still and the wait gives the sliding window time
  // to free; the snaps show the queue draining as evidence.
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
      if (scrollText.split("\n").some(
        (ln) => ln.startsWith(`geo|ashfall|44,${h44 + 1},40|${ASH}|probe-p2-dig|`))) break;
      if (!snappedMid && Date.now() - t0 > 60000) { snappedMid = true; await snap("mid-wait"); }
      await sleep(3000);
    }
  }
  await snap("after the scroll wait");
  check("A: the place is a geometry record on the real scroll, crafter-named",
    scrollText.split("\n").some(
      (ln) => ln.startsWith(`geo|ashfall|44,${h44 + 1},40|${ASH}|probe-p2-dig|`)),
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
    await B.waitFor(`NOVA_FOX3.geoBlockAt('ashfall', 44, ${h44 + 1}, 40) === ${ASH}`,
      90000, "placed block in B"),
    `top=${await B.evalJs(surfaceExpr("ashfall", 44, 40)).catch(() => "?")}`);
  check("B: the ground under the placed block still stands",
    (await B.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', 44, ${h44}, 40)`)) !== 0);
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
    await B.waitFor(`NOVA_FOX3.geoBlockAt('ashfall', 44, ${h44 + 1}, 40) === ${ASH}`,
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
  check("A2: A's profile reopens, pack intact",
    await A2.boot() &&
    (await A2.evalJs(`(NOVA_FOX3.digState().materials[${ASH}] || 0)`)) === carved.length - 1);
  try { await A2.enterWorld(); } catch (e) { /* a returning profile may skip the splash */ }
  await A2.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online (A2)");
  const held = await A2.evalJs(`NOVA_FOX3.digState().materials[${ASH}] || 0`);
  const soldBefore = await A2.evalJs("NOVA_FOX3.digState().sold");
  const tokensBefore = await A2.evalJs("NOVA_FOX3.digState().tokens");
  await A2.evalJs(`NOVA_FOX3.sellMaterialNow(${ASH}, 'all')`);
  await sleep(400);
  const after = await A2.evalJs("NOVA_FOX3.digState()");
  check("A2: selling drains the type from the pack",
    (after.materials[ASH] || 0) === 0, JSON.stringify(after.materials));
  check("A2: the sale is counted, block for block",
    after.sold === soldBefore + held, `sold ${soldBefore} -> ${after.sold}, held=${held}`);
  check("A2: the purse rises by the recorded rate (3 flux per ash, +- one drip token)",
    after.tokens - tokensBefore >= held * 3 && after.tokens - tokensBefore <= held * 3 + 1,
    `tokens ${tokensBefore} -> ${after.tokens}, held=${held}`);

  // The carve-back: A's own placed block breaks through the
  // geometry path and yields its type again.
  await A2.evalJs("NOVA_FOX3.state.realm === 'ashfall' || NOVA_FOX3.state.pos.set(8.5, 20, 8.5)");
  {
    // stand in ashfall: if the reopened profile starts in nova,
    // walk the tunnel as before.
    if ((await A2.evalJs("NOVA_FOX3.state.realm")) !== "ashfall") {
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
  let back = false;
  for (let attempt = 0; attempt < 3 && !back; attempt++) {
    await A2.evalJs(aimDown(44.5, h44 + 3.4, 40.5));
    await A2.key("c", "KeyC");
    await sleep(450);
    back = (await A2.evalJs(`NOVA_FOX3.geoBlockAt('ashfall', 44, ${h44 + 1}, 40)`)) === 0;
  }
  check("A2: a placed block carves back through the geometry path", back);
  check("A2: the carve-back yields the placed type again",
    (await A2.evalJs(`NOVA_FOX3.digState().materials[${ASH}] || 0`)) === 1);
  check("A2: no console errors", A2.consoleErrors.length === 0,
    A2.consoleErrors.slice(0, 2).join(" ; "));
  A2.close();
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + (e && e.message || e));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
