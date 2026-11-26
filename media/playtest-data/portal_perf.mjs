// Nova Fox — portal frame-cost probe (feedback #27).
// Same vantage and sampling as perf_probe.mjs (barrow country,
// SwiftShader — absolute numbers are a floor artifact; only the
// before/after delta means anything), in three acts:
//   1. 360 frames, no rift — the frame as v5 left it.
//   2. The cost of OPENING a rift (the far view's build), timed.
//   3. 360 frames with the rift standing ahead, its far view
//      rendering every frame (the fox is within 12 units).
// Run: node portal_perf.mjs [url]
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const URL = process.argv[2] ||
  "file:///home/hatch/workspace/nova-fox/demo3/index.html";
const CHROME = "/opt/meta-chromium/chrome";
const PORT = 9342;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "novafox-portalperf-"));
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
const SAMPLE = `new Promise((resolve) => {
  const deltas = [];
  let last = performance.now();
  function frame(now) {
    deltas.push(now - last);
    last = now;
    if (deltas.length < 360) requestAnimationFrame(frame);
    else {
      deltas.shift();
      const sorted = [...deltas].sort((a, b) => a - b);
      const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      resolve({
        frames: deltas.length, mean,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
      });
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
  await sleep(4000); // let the chunk field finish generating
  const noRift = await evalJs(SAMPLE);
  const openMs = await evalJs(`(() => {
    const t0 = performance.now();
    NOVA_FOX3.playChord([1, 4, 9]);
    return performance.now() - t0;
  })()`);
  await sleep(600);
  const rendersBefore = await evalJs("NOVA_FOX3.portalState().renders");
  const withRift = await evalJs(SAMPLE);
  const rendersAfter = await evalJs("NOVA_FOX3.portalState().renders");
  console.log(JSON.stringify({
    noRift, openMs, withRift,
    portalRendersDuringSample: rendersAfter - rendersBefore,
    viewOk: await evalJs("NOVA_FOX3.portalState().viewOk"),
  }, null, 1));
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill("SIGKILL");
}
