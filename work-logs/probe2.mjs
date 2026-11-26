// Probe 2 (minimal, decisive): record every touch event's type and
// target while replaying the suite's drag + button taps.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 9335;
const chrome = spawn("/opt/meta-chromium/chrome", [
  "--headless=new", "--disable-gpu", "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader", "--no-sandbox",
  "--autoplay-policy=no-user-gesture-required",
  `--remote-debugging-port=${PORT}`, "--remote-debugging-address=127.0.0.1",
  "about:blank",
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
  await sleep(1200);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await evalJs(`window.__ev = [];
    for (const ty of ["touchstart", "touchmove", "touchend", "touchcancel"]) {
      document.addEventListener(ty, (e) => {
        const t = e.target;
        window.__ev.push(ty + " -> " + (t.id || t.tagName) +
          " @(" + e.changedTouches[0].clientX + "," + e.changedTouches[0].clientY + ")");
      }, true);
    }`);
  const C = await evalJs(`(() => { const r = document.querySelector('#stage canvas').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  console.log("canvas center:", JSON.stringify(C),
    "inner:", await evalJs("window.innerWidth + 'x' + window.innerHeight"),
    "elementFromPoint:", await evalJs(`(document.elementFromPoint(${C.x}, ${C.y}) || {}).id || (document.elementFromPoint(${C.x}, ${C.y}) || {}).tagName`));
  await touchEv("touchStart", [[C.x, C.y]]);
  await touchEv("touchMove", [[C.x - 60, C.y]]);
  await touchEv("touchMove", [[C.x - 130, C.y]]);
  await touchEv("touchEnd", []);
  await sleep(300);
  console.log("drag events:", JSON.stringify(await evalJs("window.__ev")));
  console.log("yaw after drag:", await evalJs("NOVA_FOX3.state.yaw"),
    "touchState:", JSON.stringify(await evalJs("NOVA_FOX3.touchState()")));
  const J = await evalJs(`(() => { const r = document.getElementById('t-jump').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  console.log("t-jump center:", JSON.stringify(J),
    "elementFromPoint:", await evalJs(`(document.elementFromPoint(${J.x}, ${J.y}) || {}).id || (document.elementFromPoint(${J.x}, ${J.y}) || {}).tagName`));
  await evalJs("window.__ev = []");
  const jumped = await evalJs("NOVA_FOX3.state.jumped");
  await touchEv("touchStart", [[J.x, J.y]]);
  await sleep(80);
  await touchEv("touchEnd", []);
  await sleep(300);
  console.log("tap events:", JSON.stringify(await evalJs("window.__ev")));
  console.log("jumped:", jumped, "->", await evalJs("NOVA_FOX3.state.jumped"),
    "onGround:", await evalJs("NOVA_FOX3.state.onGround"));
} finally {
  try { ws.close(); } catch {}
  chrome.kill("SIGKILL");
}
