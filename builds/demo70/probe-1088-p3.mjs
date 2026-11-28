// Nova Fox EE 1088 — P-3 (monsters, second pass) probe legs, in
// headless Chrome over CDP (the probe-1034/1037 pattern; run via the
// Jenkins job nova-fox-e2e-p3-probe). Behavior only:
//   A. the pack's memory, driven through sub.tick in one synchronous
//      script (atomic against the page's 650 ms tick): contact is
//      shared as a last known place; losing the fox starts a search;
//      the search gives up and the thing walks home.
//   B. the trench, in the REAL frame loop: a monster hunting the fox
//      through the real chisel write path is stopped by a dug trench
//      and admitted again by a placed bridge.
//   C. the live loop itself enters the search when the fox breaks
//      away (teleport), and the search is written in the log.
// The boss pair (competent fox wins / standing fox falls) is
// probe-1037.mjs, run as its own job against this same tree.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9419);
const HERE = dirname(fileURLToPath(import.meta.url));
const URL = process.env.NF_URL || pathToFileURL(join(HERE, "index.html")).href;
const STONE = 3; // BLOCK.STONE (world.js)

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "novafox-p3-probe-"));
const POLICY = process.env.NF_POLICY ||
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policyExists = existsSync(POLICY);
const policySha = policyExists
  ? createHash("sha256").update(readFileSync(POLICY)).digest("hex") : null;
const chromeArgs = [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-features=CalculateNativeWinOcclusion",
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
async function waitFor(expr, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await evalJs(expr)) return true;
    await sleep(250);
  }
  console.log(`  .. timeout waiting for: ${label}`);
  return false;
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
    width: 960, height: 600, deviceScaleFactor: 1, mobile: false,
  });
  await send("Page.navigate", { url: URL });
  let booted = false;
  for (let i = 0; i < 60 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
  }
  check("page boots, NOVA_FOX3 handle present", booted);
  await sleep(800);
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
  await sleep(300);

  // ---- Leg A: the pack's memory, driven ticks (one synchronous script) ----
  const legA = await evalJs(`(() => {
    const sub = window.NOVA_FOX3.sub;
    sub.monsters.length = 0;
    const m2 = sub.spawnMonster("nova", 11, 10, "surface");
    const m1 = sub.spawnMonster("nova", 19, 10, "surface");
    m1.role = "hunter"; m2.role = "hunter";
    // The share is only observable beyond the sphere (inside it,
    // every packmate has its own contact), so the hunter's contact
    // is a grudge: an aggroed thing hunts from ANY range (EE 1023).
    m1.aggro = true; m1.aggroTicks = 9999;
    const out = {};
    sub.tick({ realmId: "nova", bx: -121, bz: 21 }); // fox at cell (-61, 10)
    out.contact = { m1mode: m1.mode, m1lk: m1.lastKnown, m2mode: m2.mode, m2lk: m2.lastKnown };
    m1.aggro = false; m1.aggroTicks = 0; // the grudge cools (EE 1023's pin idiom)
    const far = { realmId: "nova", bx: 401, bz: 21 }; // fox at cell (200, 10): gone
    sub.tick(far);
    out.lost = { m1mode: m1.mode, m2mode: m2.mode,
      searchLogged: sub.wal.some((w) => w.op === "search") };
    for (let i = 0; i < 180; i++) sub.tick(far);
    out.gaveUp = { m1mode: m1.mode, m1lk: m1.lastKnown,
      giveUpLogged: sub.wal.some((w) => w.op === "give-up") };
    for (let i = 0; i < 200; i++) sub.tick(far);
    out.home = { gx: m1.gx, gy: m1.gy, hx: m1.hx, hy: m1.hy };
    return out;
  })()`);
  check("A: contact writes the hunter's last known place",
    legA.contact.m1mode === "hunt" && legA.contact.m1lk &&
    legA.contact.m1lk.x === -61 && legA.contact.m1lk.y === 10,
    JSON.stringify(legA.contact));
  check("A: the pack is told — the packmate beyond the sphere shares it",
    legA.contact.m2mode === "hunt" && legA.contact.m2lk && legA.contact.m2lk.x === -61,
    JSON.stringify(legA.contact));
  check("A: losing the fox starts the search, written in the log",
    legA.lost.m1mode === "search" && legA.lost.m2mode === "search" && legA.lost.searchLogged,
    JSON.stringify(legA.lost));
  check("A: the search gives up — memory clears, dispersal written",
    legA.gaveUp.m1mode === null && legA.gaveUp.m1lk === null && legA.gaveUp.giveUpLogged,
    JSON.stringify(legA.gaveUp));
  check("A: after giving up, the thing walks home to where it rose",
    legA.home.gx === legA.home.hx && legA.home.gy === legA.home.hy,
    JSON.stringify(legA.home));

  // ---- Leg B: the trench in the real frame loop -----------------------------
  const setup = await evalJs(`(() => {
    const F = window.NOVA_FOX3, sub = F.sub;
    // A level run in Nova Prime, clear of the dungeon footprint
    // (blocks x 40..63, z 26..45 -> cells gx 20..31, gy 13..22).
    let run = null;
    for (let gy = 24; gy < 60 && !run; gy++) {
      for (let gx = 34; gx < 80 && !run; gx++) {
        const h = sub.groundHeightAt("nova", gx * 2 + 1, gy * 2 + 1);
        if (h < 9) continue;
        let ok = true;
        for (let k = 0; k < 7 && ok; k++) {
          if (sub.groundHeightAt("nova", (gx + k) * 2 + 1, gy * 2 + 1) !== h) ok = false;
        }
        for (const dz of [-1, 1]) {
          const ht = sub.groundHeightAt("nova", (gx + 2) * 2 + 1, (gy + dz) * 2 + 1);
          if (Math.abs(ht - h) > 1) ok = false;
        }
        if (ok) run = { gx, gy, h };
      }
    }
    if (!run) return { run: null };
    const { gx, gy } = run;
    // The fox stands at the east end; the monster rises at the west.
    F.state.hp = 999;
    F.state.pos.x = (gx + 6) * 2 + 1.5;
    F.state.pos.z = gy * 2 + 1.5;
    F.state.pos.y = run.h + 3;
    const m = sub.spawnMonster("nova", gx, gy, "surface");
    m.role = "hunter";
    // The trench: three cells across, six deep, through the real
    // chisel write path.
    const tops = {};
    for (const dz of [-1, 0, 1]) {
      const bx = (gx + 2) * 2 + 1, bz = (gy + dz) * 2 + 1;
      const top = sub.groundHeightAt("nova", bx, bz);
      tops[dz] = top;
      for (let y = top; y > top - 6; y--) sub.chiselBlock("nova", bx, y, bz);
    }
    return { run, monsterId: m.id, tops,
      trenchGround: sub.groundHeightAt("nova", (gx + 2) * 2 + 1, gy * 2 + 1) };
  })()`);
  check("B: a level run found and the trench dug through the chisel path",
    !!setup.run && setup.trenchGround === setup.tops[0] - 6,
    JSON.stringify(setup));
  if (setup.run) {
    const { gx, gy } = setup.run;
    const mid = setup.monsterId;
    let maxGx = -Infinity, lastGx = null, sawAlive = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 26000) {
      const s = await evalJs(`(() => {
        const m = window.NOVA_FOX3.sub.monsters.find((mm) => mm.id === ${mid});
        return m ? { gx: m.gx, alive: m.alive } : null;
      })()`);
      if (s) { sawAlive = sawAlive || s.alive; lastGx = s.gx; if (s.gx > maxGx) maxGx = s.gx; }
      await sleep(500);
    }
    check("B: the pursuing monster reaches the trench edge and no farther",
      sawAlive && maxGx === gx + 1 && lastGx === gx + 1,
      `maxGx=${maxGx} lastGx=${lastGx} want=${gx + 1}`);
    // Bridge the middle cell back to its own top and watch it cross.
    await evalJs(`(() => {
      const sub = window.NOVA_FOX3.sub;
      const bx = ${gx + 2} * 2 + 1, bz = ${gy} * 2 + 1;
      const top = ${setup.tops[0]};
      for (let y = top - 6; y <= top; y++) sub.setOverride("nova", bx, y, bz, ${STONE});
      return sub.groundHeightAt("nova", bx, bz);
    })()`);
    const crossed = await waitFor(`(() => {
      const m = window.NOVA_FOX3.sub.monsters.find((mm) => mm.id === ${mid});
      return !!m && m.gx >= ${gx + 3};
    })()`, 30000, "monster crosses the bridge");
    check("B: a placed bridge admits the monster again", crossed);
  }

  // ---- Leg C: the live loop enters the search when the fox breaks away ------
  const legC0 = await evalJs(`(() => {
    const F = window.NOVA_FOX3, sub = F.sub;
    const foxCell = { x: Math.floor(F.state.pos.x / 2), y: Math.floor(F.state.pos.z / 2) };
    const m = sub.spawnMonster("nova", foxCell.x - 10, foxCell.y, "surface");
    m.role = "hunter";
    return { id: m.id, foxCell };
  })()`);
  const hunted = await waitFor(`(() => {
    const m = window.NOVA_FOX3.sub.monsters.find((mm) => mm.id === ${legC0.id});
    return !!m && m.mode === "hunt";
  })()`, 12000, "live loop hunts");
  check("C: the live loop hunts and remembers (mode = hunt)", hunted);
  await evalJs(`(() => {
    const F = window.NOVA_FOX3;
    F.state.pos.x += 400; // the fox breaks away, 200 cells east
    return true;
  })()`);
  const searching = await waitFor(`(() => {
    const m = window.NOVA_FOX3.sub.monsters.find((mm) => mm.id === ${legC0.id});
    return !!m && m.mode === "search";
  })()`, 12000, "live loop searches");
  const searchLogged = await evalJs(
    `window.NOVA_FOX3.sub.wal.some((w) => w.op === "search")`);
  check("C: when the fox breaks away, the live loop searches the last known place",
    searching && searchLogged);

  check("no page errors during the probe", consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(" | "));
} catch (e) {
  fail++;
  console.log(`FAIL  probe aborted: ${e.message}`);
  if (chromeErr) console.log("chrome stderr tail:", chromeErr.slice(-400));
} finally {
  try { chrome.kill(); } catch (e) { /* already gone */ }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
