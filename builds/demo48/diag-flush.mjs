// Diagnostic: one carve in nova, then watch the outbox/token/online.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = "/home/wbic16/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome";
const PORT = 9418;
const TOKEN = readFileSync("/home/wbic16/msg-probe/token.txt", "utf8").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "novafox-diag-"));
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
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, text: k });
  await sleep(90);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code });
  await sleep(130);
}
await send("Runtime.enable");
await send("Page.enable");
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
await sleep(500);
console.log("online:", await evalJs("NOVA_FOX3.geoState().online"));
const h = await evalJs(`(() => { const F = window.NOVA_FOX3;
  for (let y = 63; y > 0; y--) { if (F.geoBlockAt('nova', 100, y, 100) !== 0) return y; } return -1; })()`);
console.log("nova (100,?,100) surface:", h);
await evalJs(`(() => { const F = window.NOVA_FOX3;
  F.state.pos.x = 100.5; F.state.pos.y = ${h} + 2.4; F.state.pos.z = 100.5;
  F.state.pitch = -Math.PI / 2; F.state.yaw = 0; return true; })()`);
await key("c", "KeyC");
await sleep(600);
console.log("carved:", (await evalJs(`NOVA_FOX3.geoBlockAt('nova', 100, ${h}, 100)`)) === 0);
for (let i = 0; i < 7; i++) {
  const snap = await evalJs(`(() => ({
    outbox: localStorage.getItem('nova-phox-eco-outbox'),
    token: !!localStorage.getItem('nova-phox-token'),
    online: window.NOVA_FOX3.geoState().online,
    known: window.NOVA_FOX3.geoState().known }))()`);
  console.log(`t+${i * 10}s`, JSON.stringify(snap).slice(0, 300));
  await sleep(10000);
}
chrome.kill("SIGKILL");
process.exit(0);
