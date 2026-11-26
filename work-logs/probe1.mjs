// Probe: (1) where do CDP touch points actually land?
//        (2) narration queue behavior on a fresh boot.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 9341;
const chrome = spawn("/opt/meta-chromium/chrome", [
  "--headless=new", "--disable-gpu", "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader", "--no-sandbox",
  "--autoplay-policy=no-user-gesture-required",
  `--remote-debugging-port=${PORT}`, "--remote-debugging-address=127.0.0.1",
  "--window-size=800,600", "about:blank",
], { stdio: "ignore" });

async function waitJson(url) {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch {}
    await sleep(500);
  }
  throw new Error("chrome never came up");
}
const targets = await waitJson(`http://127.0.0.1:${PORT}/json/list`);
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let mid = 0; const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
function send(method, params = {}) {
  const id = ++mid;
  return new Promise((res) => { pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
}
async function evalJs(expr) {
  const m = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.text + " :: " + expr);
  return m.result?.result?.value;
}
async function touchEv(type, points) {
  await send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 6, radiusY: 6, force: 1 })),
  });
}

try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url: "file:///home/hatch/workspace/nova-fox/demo3/index.html" });
  for (let i = 0; i < 40; i++) {
    if (await evalJs("!!window.NOVA_FOX3")) break;
    await sleep(500);
  }
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(1500);

  // ---- narration probe (fresh boot) ----
  console.log("narration at boot+1.5s:", JSON.stringify(await evalJs("NOVA_FOX3.narration.state()")));
  await evalJs("NOVA_FOX3.narration.play('N-03')");
  for (let i = 0; i < 8; i++) {
    await sleep(2000);
    console.log(`t+${2 * (i + 1)}s:`, JSON.stringify(await evalJs("NOVA_FOX3.narration.state()")));
  }

  // ---- touch probe ----
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await evalJs(`window.__probe = [];
    document.addEventListener('touchstart', (e) => {
      const t = e.target;
      window.__probe.push({ target: t.id || t.tagName, x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY });
    }, true);`);
  await touchEv("touchStart", [[400, 300]]); await touchEv("touchEnd", []);
  await sleep(200);
  const jumpC = await evalJs(`(() => { const r = document.getElementById('t-jump').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  console.log("t-jump center per rect:", JSON.stringify(jumpC),
    "elementFromPoint:", await evalJs(`document.elementFromPoint(${jumpC.x}, ${jumpC.y}).id || document.elementFromPoint(${jumpC.x}, ${jumpC.y}).tagName`));
  await touchEv("touchStart", [[jumpC.x, jumpC.y]]); await touchEv("touchEnd", []);
  await sleep(200);
  const stickC = await evalJs(`(() => { const r = document.getElementById('stick').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  await touchEv("touchStart", [[stickC.x, stickC.y]]); await touchEv("touchEnd", []);
  await sleep(200);
  console.log("touchstart targets seen:", JSON.stringify(await evalJs("window.__probe")));
  console.log("body.touch:", await evalJs("document.body.classList.contains('touch')"),
    "touchui display:", await evalJs("getComputedStyle(document.getElementById('touchui')).display"));
} finally {
  try { ws.close(); } catch {}
  chrome.kill("SIGKILL");
}
