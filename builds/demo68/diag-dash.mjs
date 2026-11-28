// Diagnostic: the inverted-gravity dash, isolated. Boots the area
// build, flips gravity, and reports the fox's state around W and J.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = 9431;
const HERE = dirname(fileURLToPath(import.meta.url));
const URL = pathToFileURL(join(HERE, "index.html")).href;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "nf-diag-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding", "--disable-features=CalculateNativeWinOcclusion",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

async function wsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* not up */ }
    await sleep(200);
  }
  throw new Error("no devtools");
}
let msgId = 0; const pending = new Map(); let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => reject(new Error("timeout " + method)), 30000);
    pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); },
                      reject: (e) => { clearTimeout(timer); reject(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("page exception: " + (r.exceptionDetails.exception?.description || ""));
  return r.result.value;
}
async function keyDown(k, code) { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: code || "", text: k.length === 1 ? k : "" }); }
async function keyUp(k, code) { await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: code || "" }); }
async function key(k, code) { await keyDown(k, code); await sleep(90); await keyUp(k, code); await sleep(130); }
const snap = () => evalJs(`(() => { const F = window.NOVA_FOX3, s = F.state;
  return { x: +s.pos.x.toFixed(2), y: +s.pos.y.toFixed(2), z: +s.pos.z.toFixed(2),
    yaw: +s.yaw.toFixed(2), gravDir: s.gravDir, onGround: s.onGround, dead: s.dead,
    realm: s.realm, dashCd: Math.max(0, s.dashCdUntil - performance.now()),
    vel: { x: +s.vel.x.toFixed(2), y: +s.vel.y.toFixed(2), z: +s.vel.z.toFixed(2) } }; })()`);

try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); p.resolve(m.result); }
  };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.navigate", { url: URL });
  for (let i = 0; i < 60; i++) { await sleep(250); try { if (await evalJs("!!window.NOVA_FOX3")) break; } catch (e) {} }
  await evalJs("localStorage.setItem('nf.scheme', 'wasd')");
  await send("Page.reload");
  for (let i = 0; i < 60; i++) { await sleep(250); try { if (await evalJs("!!window.NOVA_FOX3")) break; } catch (e) {} }
  await sleep(800);
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(400);
  console.log("at spawn:", JSON.stringify(await snap()));
  await evalJs("NOVA_FOX3.state.pos.set(13.59, 24, 8.5)");
  await evalJs("NOVA_FOX3.state.yaw = -Math.PI / 2");
  await sleep(1200);
  console.log("moved to the probe column:", JSON.stringify(await snap()));
  // plain dash first (the control)
  await keyDown("w", "KeyW"); await key("j", "KeyJ"); await sleep(400); await keyUp("w", "KeyW");
  console.log("after plain dash:", JSON.stringify(await snap()));
  await sleep(1800);
  // flip
  await key("g", "KeyG");
  for (let i = 0; i < 40; i++) { await sleep(250); const s = await snap(); if (s.gravDir === -1 && s.onGround) break; }
  console.log("after flip, settled:", JSON.stringify(await snap()));
  await sleep(1800); // dash cooldown out
  console.log("pre-inverted-dash:", JSON.stringify(await snap()));
  await keyDown("w", "KeyW");
  await sleep(300);
  console.log("walking inverted +300ms:", JSON.stringify(await snap()));
  await key("j", "KeyJ");
  await sleep(400);
  console.log("after inverted dash:", JSON.stringify(await snap()));
  await keyUp("w", "KeyW");
  // try dash alone, no W
  await sleep(1800);
  await key("j", "KeyJ");
  await sleep(400);
  console.log("after inverted dash (no W):", JSON.stringify(await snap()));
} catch (e) {
  console.log("diag aborted:", e.message);
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill("SIGKILL");
  process.exit(0);
}
