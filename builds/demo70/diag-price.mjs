// Diagnostic 3: the charged-price sequence against a fresh
// guardian, with the state machine watched at 100 ms intervals.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = 9439;
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
const boss = () => evalJs(`(() => { const F = window.NOVA_FOX3;
  const g = F.sub.monsters.find((m) => m.kind === "guardian" && m.alive);
  return g ? { hp: g.hp, state: g.boss.state, gx: g.gx, gy: g.gy } : null; })()`);

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
  await facePoint(11, 10);
  await keyDown("w", "KeyW");
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    if ((await evalJs("NOVA_FOX3.equipState().weapon")) === "sword") break;
  }
  await keyUp("w", "KeyW");
  console.log("weapon:", await evalJs("NOVA_FOX3.equipState().weapon"));
  // lift the Arrival ward: jump once, wait out the intro
  await key(" ", "Space");
  await sleep(2500);
  // to the hall: spawn a fresh guardian (the hall's own may exist;
  // use whichever is alive), stand 4 blocks west of its cell
  let b = await boss();
  if (!b) {
    await evalJs(`window.__g = NOVA_FOX3.sub.spawnMonster("nova", 27, 19, "guardian")`);
    await sleep(700);
    b = await boss();
  }
  console.log("guardian:", JSON.stringify(b));
  await evalJs(`NOVA_FOX3.state.pos.set(${b.gx * 2 + 1.5 - 4}, 8, ${b.gy * 2 + 1.5})`);
  await sleep(1200);
  // watch until stalk/telegraph
  for (let i = 0; i < 60; i++) {
    b = await boss();
    if (b && (b.state === "stalk" || b.state === "telegraph")) break;
    await sleep(300);
  }
  console.log("press window:", JSON.stringify(b));
  await facePoint(b.gx * 2 + 1.5, b.gy * 2 + 1.5);
  await keyDown("f", "KeyF");
  console.log("after press:", JSON.stringify(await boss()),
    "swingCharged:", await evalJs("NOVA_FOX3.state.swingCharged"),
    "charging:", await evalJs("NOVA_FOX3.state.charging"));
  await sleep(500);
  await keyDown("s", "KeyS"); await sleep(350); await keyUp("s", "KeyS");
  // watch for the exposure, logging the machine
  let exposedAt = null;
  for (let i = 0; i < 60; i++) {
    b = await boss();
    const cs = await evalJs("NOVA_FOX3.combatState()");
    console.log(`  t+${i * 200}ms state=${b.state} hp=${b.hp} chargeReady=${cs.chargeReady}`);
    if (b.state === "exposed") { exposedAt = i; break; }
    await sleep(200);
  }
  if (exposedAt !== null) {
    const hpBefore = b.hp;
    await facePoint(b.gx * 2 + 1.5, b.gy * 2 + 1.5);
    console.log("releasing: chargeReady =", await evalJs("NOVA_FOX3.state.chargeReady"),
      "boss state =", (await boss()).state);
    await keyUp("f", "KeyF");
    await sleep(450);
    const after = await boss();
    console.log(`RELEASED: hp ${hpBefore} -> ${after.hp} state=${after.state}`,
      "swingCharged:", await evalJs("NOVA_FOX3.state.swingCharged"));
  } else {
    await keyUp("f", "KeyF");
    console.log("no exposure seen");
  }
} catch (e) {
  console.log("diag aborted:", e.message);
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill("SIGKILL");
  process.exit(0);
}
