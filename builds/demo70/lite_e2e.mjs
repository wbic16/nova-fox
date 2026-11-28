// Nova Fox demo30 — Lite e2e probe. Runs against lite.html SERVED
// over http (the hosted truth), via the Jenkins nova-fox-e2e-demo30
// job only (Will, 2026-11-26: e2e via ranch Jenkins, never direct).
// Legs:
//   A. Lite boots playable with assets served; the guide-voice
//      prefetch fetches real bytes from assets/<EE>/.
//   D. The progress element reflects real fetched bytes (observed
//      visible mid-prefetch; resource bytes match the manifest set).
//   B. Lite boots playable with every asset fetch FAILED (Fetch
//      interception): the game stands, Joy's text carries the beats,
//      failed voices mark themselves down and never block the queue.
//   T. Time-to-playable: Lite vs Full boot timing on the same server.
// Env: NF_CHROME, NF_PORT (private CDP port), NF_LITE_URL, NF_FULL_URL.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9411);
const LITE_URL = process.env.NF_LITE_URL;
const FULL_URL = process.env.NF_FULL_URL;
if (!LITE_URL) { console.error("NF_LITE_URL required"); process.exit(2); }

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "novafox30-lite-"));
const POLICY = process.env.NF_POLICY ||
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const chromeArgs = [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
];
if (existsSync(POLICY)) {
  chromeArgs.push(
    `--hatch-webgl-allowed-domains-file=${POLICY}`,
    `--hatch-webgl-allowed-domains-sha256=${createHash("sha256").update(readFileSync(POLICY)).digest("hex")}`,
  );
}
chromeArgs.push(`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank");
const chrome = spawn(CHROME, chromeArgs, { stdio: ["ignore", "ignore", "pipe"] });
chrome.stderr.on("data", () => {});

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
let failAssets = false;
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
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (!r || !r.result) throw new Error("page evaluate returned no result for: " + expression.slice(0, 80));
  if (r.exceptionDetails) throw new Error("page exception: " +
    (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
async function mouse(type, x, y, button, buttons) {
  await send("Input.dispatchMouseEvent", {
    type, x, y, button: button || "none", buttons: buttons || 0, clickCount: 1,
  });
}
// The splash bypass through the REAL input path: narration.unlock()
// is wired to window pointerdown/keydown (capture), so a programmatic
// .click() never unlocks the voice — a real press does, exactly as a
// player's first gesture does.
async function clickSplash() {
  const r = await evalJs(`(() => {
    const b = document.getElementById('splash-btn');
    const q = b.getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  })()`);
  await mouse("mousePressed", r.x, r.y, "left", 1);
  await sleep(90);
  await mouse("mouseReleased", r.x, r.y, "left", 0);
  await sleep(250);
}
async function waitBoot(timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await evalJs("!!window.NOVA_FOX3")) return Date.now() - t0; } catch (e) { /* loading */ }
    await sleep(200);
  }
  return -1;
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
    } else if (m.method === "Fetch.requestPaused" && failAssets) {
      send("Fetch.failRequest", { requestId: m.params.requestId, errorReason: "Failed" }).catch(() => {});
    }
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  // ---------- Leg A + D: assets served ----------
  const tNav = Date.now();
  await send("Page.navigate", { url: LITE_URL });
  const liteBootMs = await waitBoot();
  check("A: Lite boots to the NOVA_FOX3 handle", liteBootMs >= 0);
  console.log(`  .. Lite time-to-handle: ${liteBootMs} ms`);
  await sleep(600);
  check("A: spawn realm is Nova Prime", await evalJs("NOVA_FOX3.state.realm") === "nova");
  check("A: narration manifest carries the 25 script beats",
    await evalJs("Object.keys(NOVA_FOX3.narration.manifest()).length") === 25);
  check("A: beats are ready from the manifest before any fetch",
    await evalJs("NOVA_FOX3.narration.ready('N-01') && NOVA_FOX3.narration.ready('BEAT-quest')"));
  await clickSplash(); // real press: unlock + prefetch
  // D: watch the progress element + resource bytes while prefetch runs.
  let sawBar = false, maxPct = 0, fetchedBytes = 0, fetchedMp3 = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    const snap = await evalJs(`(() => {
      const wrap = document.getElementById('nf-progress');
      const bar = document.getElementById('nf-progress-bar');
      const res = performance.getEntriesByType('resource')
        .filter((r) => r.name.includes('/assets/'));
      const mp3 = res.filter((r) => r.name.endsWith('.mp3'));
      return {
        hidden: !wrap || wrap.hidden || wrap.getClientRects().length === 0,
        width: bar ? parseFloat(bar.style.width || '0') : 0,
        bytes: res.reduce((s, r) => s + (r.decodedBodySize || 0), 0),
        mp3bytes: mp3.reduce((s, r) => s + (r.decodedBodySize || 0), 0),
        mp3count: mp3.length,
      };
    })()`);
    if (!snap.hidden && snap.width > 0) { sawBar = true; maxPct = Math.max(maxPct, snap.width); }
    fetchedBytes = snap.bytes; fetchedMp3 = snap.mp3count;
    // prefetch set = 9 guide files; film/poster may add 2 more mp3-less entries
    if (snap.mp3count >= 9 && snap.mp3bytes > 1_000_000) break;
    await sleep(150);
  }
  check("D: progress element showed real progress mid-prefetch", sawBar && maxPct > 0, `sawBar=${sawBar} maxPct=${maxPct}`);
  check("A: guide-voice prefetch fetched the 9 guide files", fetchedMp3 >= 9, `mp3=${fetchedMp3}`);
  check("A: fetched asset bytes are real (>1 MB of voice)", fetchedBytes > 1_000_000, `bytes=${fetchedBytes}`);
  check("A: the wake beat's text is on the guide panel (Joy's script)",
    (await evalJs("document.getElementById('guide-lines').textContent")).includes("Wake up, Fox!"));
  check("A: zero console errors", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));

  // ---------- Leg T: Full boot timing on the same server ----------
  if (FULL_URL) {
    await send("Page.navigate", { url: FULL_URL });
    const fullBootMs = await waitBoot();
    check("T: Full boots on the same server", fullBootMs >= 0);
    console.log(`  .. time-to-handle: Lite ${liteBootMs} ms vs Full ${fullBootMs} ms (same local server; parse+transfer bound)`);
  }

  // ---------- Leg B: every asset fetch fails ----------
  failAssets = true;
  await send("Fetch.enable", { patterns: [
    // T-3: the package and the loader are the core now — leg B fails
    // the MEDIA assets only (voice, film, poster), never the package.
    { urlPattern: "*assets/*.mp3", requestStage: "Request" },
    { urlPattern: "*assets/*.mp4", requestStage: "Request" },
    { urlPattern: "*assets/*.png", requestStage: "Request" },
  ] });
  consoleErrors.length = 0;
  await send("Page.navigate", { url: LITE_URL });
  const bMs = await waitBoot();
  check("B: Lite still boots with all asset fetches failing", bMs >= 0);
  await sleep(600);
  await clickSplash();
  check("B: Joy's text carries the wake beat without any voice file",
    (await evalJs("document.getElementById('guide-lines').textContent")).includes("Wake up, Fox!"));
  // The failed prefetch must mark voices down (ready() false) and the
  // queue must drain — the game never blocks on a fetch.
  let drained = false, markedDown = false;
  const t1 = Date.now();
  while (Date.now() - t1 < 60000) {
    markedDown = await evalJs("!NOVA_FOX3.narration.ready('N-01')");
    const pend = await evalJs("NOVA_FOX3.narration.state().pending.length");
    if (markedDown && pend === 0) { drained = true; break; }
    await sleep(400);
  }
  check("B: failed voices mark themselves down (ready('N-01') false)", markedDown);
  check("B: the narration queue drains — play is never blocked", drained);
  check("B: the fox is still in Nova Prime, playable", await evalJs("NOVA_FOX3.state.realm") === "nova");
  check("B: zero console errors", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  await send("Fetch.disable");
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + (e && e.message || e));
} finally {
  try { chrome.kill("SIGKILL"); } catch (e) { /* already gone */ }
}
console.log(`\nlite e2e: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
