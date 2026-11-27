// Diagnostic 2: mirror the probe flow, log every phext.tech request.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = "/home/wbic16/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome";
const PORT = 9418;
const TOKEN = readFileSync("/home/wbic16/msg-probe/token.txt", "utf8").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "novafox-diag2-"));
const POLICY = "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const args = ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required", "--ignore-certificate-errors",
  "--host-resolver-rules=MAP fox.phext.io 127.0.0.1"];
if (existsSync(POLICY)) {
  args.push(`--hatch-webgl-allowed-domains-file=${POLICY}`,
    `--hatch-webgl-allowed-domains-sha256=${createHash("sha256").update(readFileSync(POLICY)).digest("hex")}`);
}
args.push(`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank");
const chrome = spawn(CHROME, args, { stdio: ["ignore", "ignore", "pipe"] });
chrome.stderr.on("data", () => {});
let ws, msgId = 0;
const pending = new Map();
const netlog = [];
async function wsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await r.json()).find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(200);
  }
  throw new Error("no devtools");
}
ws = new WebSocket(await wsUrl());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error.message));
    else p.resolve(m.result);
  } else if (m.method === "Network.responseReceived") {
    const r = m.params.response;
    if (r.url.includes("phext.tech")) netlog.push(`RESP ${r.status} ${m.params.type} ${r.url.slice(0, 110)}`);
  } else if (m.method === "Network.loadingFailed") {
    netlog.push(`FAILED ${m.params.type} ${m.params.errorText} ${m.params.blockedReason || ""} req=${m.params.requestId}`);
  } else if (m.method === "Network.requestWillBeSent") {
    const r = m.params.request;
    if (r.url.includes("phext.tech") && r.method !== "GET") {
      netlog.push(`REQ ${r.method} ${r.url.slice(0, 110)}`);
    }
  }
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "page exception");
  return r.result.value;
}
async function key(k, code) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, text: k.length === 1 ? k : "" });
  await sleep(90);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code });
  await sleep(130);
}
await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await send("Page.navigate", { url: "https://fox.phext.io/index.html" });
for (let i = 0; i < 60; i++) {
  await sleep(250);
  try { if (await evalJs("!!window.NOVA_FOX3")) break; } catch (e) {}
}
await evalJs(`localStorage.setItem('nova-phox-token', ${JSON.stringify(TOKEN)})`);
await evalJs("localStorage.setItem('nova-phox-name', 'probe-msg-geo')");
await evalJs("localStorage.setItem('nf.scheme', 'wasd')");
await evalJs("location.reload()");
for (let i = 0; i < 60; i++) {
  await sleep(250);
  try { if (await evalJs("!!window.NOVA_FOX3")) break; } catch (e) {}
}
await sleep(800);
await evalJs("document.getElementById('splash-btn').click()");
await sleep(300);
await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 640, y: 360, button: "left", clickCount: 1 });
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 640, y: 360, button: "left", clickCount: 1 });
await sleep(300);
console.log("online:", await evalJs("NOVA_FOX3.geoState().online"));
// carve one cell near the nova arrival (its chunk is generated): (14, surface, 14)
const h = await evalJs(`(() => { const F = window.NOVA_FOX3;
  for (let y = 63; y > 0; y--) { if (F.geoBlockAt('nova', 14, y, 14) !== 0) return y; } return -1; })()`);
console.log("nova (14,?,14) surface:", h);
await evalJs(`(() => { const F = window.NOVA_FOX3;
  F.state.pos.x = 14.5; F.state.pos.y = ${h} + 2.4; F.state.pos.z = 14.5;
  F.state.pitch = -Math.PI / 2; F.state.yaw = 0; return true; })()`);
await key("c", "KeyC");
await sleep(600);
console.log("carved:", (await evalJs(`NOVA_FOX3.geoBlockAt('nova', 14, ${h}, 14)`)) === 0);
console.log("outbox:", await evalJs("localStorage.getItem('nova-phox-eco-outbox')"));
for (let i = 0; i < 5; i++) {
  await sleep(10000);
  console.log(`t+${(i + 1) * 10}s outbox:`, await evalJs("localStorage.getItem('nova-phox-eco-outbox')"),
    "online:", await evalJs("NOVA_FOX3.geoState().online"));
}
console.log("--- network log ---");
for (const ln of netlog) console.log(ln);
chrome.kill("SIGKILL");
process.exit(0);
