// Nova Fox — portal frame-cost probe, take 2 (feedback #27).
// portal_perf.mjs's with-rift window outlived the rift's 25 s
// life, so most of its frames had no live portal. This probe
// interleaves short samples (50 frames ≈ 16 s, inside the rift's
// life) — no-rift / rift-open alternating, three reps each — at
// the same barrow vantage, and re-opens the rift before each
// rift rep (openRift folds and re-opens, restarting its clock).
// Run: node portal_perf2.mjs [url]
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const URL = process.argv[2] ||
  "file:///home/hatch/workspace/nova-fox/demo3/index.html";
const CHROME = "/opt/meta-chromium/chrome";
const PORT = 9343;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "novafox-portalperf2-"));
const POLICY =
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policySha = createHash("sha256").update(readFileSync(POLICY)).digest("hex");
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
  `--hatch-webgl-allowed-domains-file=${POLICY}`,
  `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

let msgId = 0;
const pending = new Map();
let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error("page exception: " +
      (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}
const SAMPLE50 = `new Promise((resolve) => {
  const deltas = [];
  let last = performance.now();
  function frame(now) {
    deltas.push(now - last);
    last = now;
    if (deltas.length < 51) requestAnimationFrame(frame);
    else {
      deltas.shift();
      const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      resolve({ frames: deltas.length, mean });
    }
  }
  requestAnimationFrame(frame);
})`;

try {
  let wsUrl = null;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === "page");
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
    await sleep(200);
  }
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id).resolve(m.result);
      pending.delete(m.id);
    }
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: URL });
  let booted = false;
  for (let i = 0; i < 60 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
  }
  if (!booted) throw new Error("page never booted");
  await evalJs(`(() => {
    if (window.__splashDismiss) window.__splashDismiss();
    NOVA_FOX3.teleportTo(20, 20);
    NOVA_FOX3.state.yaw = Math.PI * 1.25;
    NOVA_FOX3.state.pitch = -0.12;
    return true;
  })()`);
  await sleep(4000);
  const noRift = [], withRift = [];
  for (let rep = 0; rep < 3; rep++) {
    noRift.push((await evalJs(SAMPLE50)).mean);
    const renders0 = await evalJs("NOVA_FOX3.portalState().renders || 0");
    await evalJs("NOVA_FOX3.playChord([1, 4, 9])");
    await sleep(300);
    withRift.push((await evalJs(SAMPLE50)).mean);
    const renders1 = await evalJs("NOVA_FOX3.portalState().renders || 0");
    console.log(`rep ${rep}: portal renders during rift sample: ${renders1 - renders0}`);
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(JSON.stringify({
    noRiftMeans: noRift.map((m) => Math.round(m)),
    withRiftMeans: withRift.map((m) => Math.round(m)),
    noRiftAvg: Math.round(avg(noRift)),
    withRiftAvg: Math.round(avg(withRift)),
  }, null, 1));
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill("SIGKILL");
}
