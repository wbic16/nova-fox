// Quick probe: boot, dismiss splash, exercise the input paths the
// long suite stumbled on, plus every menu door. Not a suite — a
// stethoscope.
import { spawn } from "node:child_process";
const PORT = 9341;
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
const POLICY = "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policySha = createHash("sha256").update(readFileSync(POLICY)).digest("hex");
const profile = mkdtempSync(join(tmpdir(), "probe-menu-"));
const chrome = spawn("/opt/meta-chromium/chrome", [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
  `--hatch-webgl-allowed-domains-file=${POLICY}`,
  `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map();
async function wsUrl() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const j = await r.json();
      const p = j.find((t) => t.type === "page");
      if (p) return p.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(300);
  }
  throw new Error("no page target");
}
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res) => pending.set(id, res));
}
async function evalJs(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function key(k, code) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, text: k.length === 1 ? k : "" });
  await sleep(90);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code });
  await sleep(130);
}
try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.navigate", { url: "file:///home/hatch/workspace/nova-fox/demo13/index.html" });
  let booted = false;
  for (let i = 0; i < 80 && !booted; i++) { await sleep(250); try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) {} }
  console.log("booted:", booted);
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(300);
  console.log("splash dismissed:", await evalJs("NOVA_FOX3.state.splash") === false);
  await evalJs("document.getElementById('btn-keys').click()");
  console.log("scheme after btn-keys:", await evalJs("NOVA_FOX3.state.scheme"));
  await evalJs("document.getElementById('btn-keys').click()");
  console.log("scheme back:", await evalJs("NOVA_FOX3.state.scheme"));
  await key("v", "KeyV");
  console.log("lamp after V:", await evalJs("NOVA_FOX3.state.lamp"));
  await key("Escape", "Escape");
  console.log("menu after Esc:", JSON.stringify(await evalJs("NOVA_FOX3.menuState()")));
  await key("Escape", "Escape");
  console.log("menu closed:", await evalJs("NOVA_FOX3.menuState().open") === false);
  await key("Escape", "Escape");
  await evalJs("document.getElementById('menu-lan').click()");
  console.log("lan:", JSON.stringify(await evalJs("NOVA_FOX3.lanState()")),
    "| note:", await evalJs("document.getElementById('menu-note').textContent"));
  await evalJs("document.getElementById('menu-quit').click()");
  console.log("after quit: splash =", await evalJs("NOVA_FOX3.state.splash"),
    "menu open =", await evalJs("NOVA_FOX3.menuState().open"));
} catch (e) {
  console.log("PROBE ERROR:", e.message);
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill("SIGKILL");
}
