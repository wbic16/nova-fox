// Diagnostic 2: the probe's exact charge sequence, watched closely.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = 9435;
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
async function facePoint(tx, tz) {
  await evalJs(`(() => { const F = window.NOVA_FOX3;
    F.state.yaw = Math.atan2(-(${tx} - F.state.pos.x), -(${tz} - F.state.pos.z));
    F.state.pitch = -0.05; return true; })()`);
}
const watch = (tag) => evalJs(`(() => { const F = window.NOVA_FOX3;
  return { tag: "${tag}", fox: F.foxPos(), wisp: { gx: __w.gx, gy: __w.gy, hp: __w.hp },
    cs: F.combatState(), yaw: F.state.yaw }; })()`);

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
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 480, y: 300, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 480, y: 300, button: "left", clickCount: 1 });
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(400);
  // get the sword the probe's way: walk to its spot
  await facePoint(11, 10);
  await keyDown("w", "KeyW");
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    if ((await evalJs("NOVA_FOX3.equipState().weapon")) === "sword") break;
  }
  await keyUp("w", "KeyW");
  console.log("weapon:", await evalJs("NOVA_FOX3.equipState().weapon"));
  // the probe's charge sequence, verbatim shape
  await evalJs(`(() => { const F = window.NOVA_FOX3;
    const gx = Math.floor(F.state.pos.x / 2) + 3, gz = Math.floor(F.state.pos.z / 2);
    window.__w = F.sub.spawnMonster(F.state.realm, gx, gz, "wisp");
    F.state.pos.x = gx * 2 + 1.5 - 3; F.state.pos.z = gz * 2 + 1.5;
    return true; })()`);
  await sleep(700);
  const wx = await evalJs("__w.gx * 2 + 1.5"), wz = await evalJs("__w.gy * 2 + 1.5");
  await evalJs(`NOVA_FOX3.state.pos.x = ${wx} - 1.2; NOVA_FOX3.state.pos.z = ${wz}`);
  await sleep(600);
  console.log(JSON.stringify(await watch("placed")));
  await facePoint(wx, wz);
  await evalJs("NOVA_FOX3.state.yaw += Math.PI");
  await keyDown("f", "KeyF");
  console.log(JSON.stringify(await watch("pressed-away")));
  await sleep(150);
  await keyDown("w", "KeyW");
  for (let i = 0; i < 5; i++) {
    const cx = await evalJs("__w.gx * 2 + 1.5"), cz = await evalJs("__w.gy * 2 + 1.5");
    await facePoint(cx, cz);
    await sleep(130);
    console.log(JSON.stringify(await watch("hold" + i)));
  }
  {
    const cx = await evalJs("__w.gx * 2 + 1.5"), cz = await evalJs("__w.gy * 2 + 1.5");
    await facePoint(cx, cz);
  }
  await keyUp("f", "KeyF");
  await keyUp("w", "KeyW");
  await sleep(500);
  console.log(JSON.stringify(await watch("released")));
} catch (e) {
  console.log("diag aborted:", e.message);
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill("SIGKILL");
  process.exit(0);
}
