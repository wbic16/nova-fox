// Rift visual probe — open a rift and photograph it standing in the world.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const CHROME = "/opt/meta-chromium/chrome"; const PORT = 9340;
const URL = "file:///home/hatch/workspace/nova-fox/demo3/index.html";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "novafox-rift-"));
const POLICY = "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policySha = createHash("sha256").update(readFileSync(POLICY)).digest("hex");
const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required",
  `--hatch-webgl-allowed-domains-file=${POLICY}`, `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
chrome.stderr.on("data", () => {});
async function wsUrl() { for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const l = await r.json(); const p = l.find((t) => t.type === "page"); if (p) return p.webSocketDebuggerUrl; } catch (e) {} await sleep(200); } throw new Error("no devtools"); }
let msgId = 0; const pending = new Map(); let ws;
function send(m, p = {}) { return new Promise((res, rej) => { const id = ++msgId; pending.set(id, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id, method: m, params: p })); }); }
async function evalJs(x) { const r = await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval"); return r.result.value; }
async function key(k, c) { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: c || "", text: k.length === 1 ? k : "" }); await sleep(90); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: c || "" }); await sleep(130); }
try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); } };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.navigate", { url: URL });
  let booted = false;
  for (let i = 0; i < 80 && !booted; i++) { await sleep(250); try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) {} }
  await sleep(600);
  await evalJs(`(() => { const bs = document.querySelectorAll('#guide button'); for (const b of bs) if (b.textContent.includes('explore')) { b.click(); return 'retired'; } return 'not found: ' + [...bs].map(b => b.textContent).join('|'); })()`);
  await sleep(400);
  await evalJs("NOVA_FOX3.state.yaw = -Math.PI/2; NOVA_FOX3.state.pitch = -0.05;");
  await key("1", "Digit1"); await key("4", "Digit4"); await key("9", "Digit9");
  await sleep(900);
  console.log("rift open:", await evalJs("!!NOVA_FOX3.state.rift"));
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync("/home/hatch/workspace/nova-fox/playtest-data/RIFT-02-open.png", Buffer.from(shot.data, "base64"));
  console.log("shot saved");
} catch (e) { console.log("ERROR", e.message); }
finally { try { ws && ws.close(); } catch (e) {} chrome.kill("SIGKILL"); }
console.log("RIFT SHOT DONE");
