// Diagnostic: the charged strike against a wisp, step by step.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = 9433;
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
  // sword + wisp at a known cell, fox placed 1.2 west of its centre
  await evalJs(`(() => { const F = window.NOVA_FOX3;
    F.giveItem ? F.giveItem("sword") : null;
    window.__w = F.sub.spawnMonster(F.state.realm, 12, 6, "wisp");
    F.state.pos.x = 12 * 2 + 1.5 - 1.2; F.state.pos.z = 6 * 2 + 1.5;
    return true; })()`);
  await sleep(700);
  console.log("equip:", JSON.stringify(await evalJs("NOVA_FOX3.equipState()")));
  console.log("wisp hp:", await evalJs("__w.hp"), "fox:", JSON.stringify(await evalJs("NOVA_FOX3.foxPos()")));
  await evalJs(`(() => { const F = window.NOVA_FOX3;
    F.state.yaw = Math.atan2(-((12 * 2 + 1.5) - F.state.pos.x), -((6 * 2 + 1.5) - F.state.pos.z));
    return F.state.yaw; })()`);
  console.log("yaw toward wisp:", await evalJs("NOVA_FOX3.state.yaw"));
  // cycle A: face AWAY press, hold, face back, release
  await evalJs("NOVA_FOX3.state.yaw += Math.PI");
  await keyDown("f", "KeyF");
  console.log("after press (away): hp =", await evalJs("__w.hp"),
    "combat:", JSON.stringify(await evalJs("NOVA_FOX3.combatState()")));
  await sleep(150);
  await evalJs(`(() => { const F = window.NOVA_FOX3;
    F.state.yaw = Math.atan2(-((12 * 2 + 1.5) - F.state.pos.x), -((6 * 2 + 1.5) - F.state.pos.z));
    return true; })()`);
  await sleep(700);
  console.log("mid-hold: combat:", JSON.stringify(await evalJs("NOVA_FOX3.combatState()")));
  await keyUp("f", "KeyF");
  await sleep(500);
  console.log("after release: hp =", await evalJs("__w.hp"), "alive =", await evalJs("__w.alive"));
  // cycle B: plain hold facing the wisp the whole time (fresh wisp)
  await evalJs(`(() => { const F = window.NOVA_FOX3;
    window.__w2 = F.sub.spawnMonster(F.state.realm, 14, 6, "wisp");
    F.state.pos.x = 14 * 2 + 1.5 - 1.2; F.state.pos.z = 6 * 2 + 1.5;
    F.state.yaw = Math.atan2(-((14 * 2 + 1.5) - F.state.pos.x), -((6 * 2 + 1.5) - F.state.pos.z));
    return true; })()`);
  await sleep(700);
  await keyDown("f", "KeyF");
  console.log("B after press (facing): hp =", await evalJs("__w2.hp"));
  await sleep(800);
  await keyUp("f", "KeyF");
  await sleep(500);
  console.log("B after release: hp =", await evalJs("__w2.hp"), "alive =", await evalJs("__w2.alive"));
} catch (e) {
  console.log("diag aborted:", e.message);
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill("SIGKILL");
  process.exit(0);
}
