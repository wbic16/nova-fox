// Probe P — walk speed + eastward trek with jump-when-stuck (what a
// human does when terrain blocks). Answers: can a walking player
// actually reach the barrow, and how long does it take?
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
const CHROME = "/opt/meta-chromium/chrome"; const PORT = 9338;
const URL = "file:///home/hatch/workspace/nova-fox/demo3/index.html";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now(); const now = () => (Date.now() - T0) / 1000;
function log(k, m) { console.log(`[${now().toFixed(1).padStart(6)}s] ${k.padEnd(8)} ${m}`); }
const profile = mkdtempSync(join(tmpdir(), "novafox-ptP-"));
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
async function keyDown(k, c) { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: c || "", text: k.length === 1 ? k : "" }); }
async function keyUp(k, c) { await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: c || "" }); }
async function key(k, c) { await keyDown(k, c); await sleep(90); await keyUp(k, c); await sleep(120); }
async function snap() { return evalJs(`(() => { const s = NOVA_FOX3.state; return { x: +s.pos.x.toFixed(1), y: +s.pos.y.toFixed(1), z: +s.pos.z.toFixed(1), moved: +s.movedTotal.toFixed(1), hp: s.hp, dead: s.dead }; })()`); }
try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); } };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.navigate", { url: URL });
  let booted = false;
  for (let i = 0; i < 80 && !booted; i++) { await sleep(250); try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) {} }
  await sleep(500);
  await evalJs("document.getElementById('guide-btn').click()"); await sleep(200);
  await evalJs("document.getElementById('guide-btn').click()"); await sleep(200);
  // (a) flat speed: face east, hold W for 10s from spawn meadow
  await evalJs("NOVA_FOX3.state.yaw = -Math.PI/2;");
  let s = await snap(); const m0 = s.moved, p0 = { x: s.x, z: s.z };
  await keyDown("w", "KeyW");
  await sleep(10000);
  s = await snap();
  await keyUp("w", "KeyW");
  const dist = Math.hypot(s.x - p0.x, s.z - p0.z);
  log("SPEED", `10s east from spawn: movedTotal delta=${(s.moved - m0).toFixed(1)} straight-line=${dist.toFixed(1)} -> ${(dist / 10).toFixed(2)} u/s, end=(${s.x},${s.z}) y=${s.y}`);
  // (b) trek to the barrow shaft top (45.5,31.5), jump when stuck
  const t0 = Date.now(); let lastMoved = s.moved, lastCheck = Date.now(), jumps = 0;
  await keyDown("w", "KeyW");
  let arrived = false;
  while (Date.now() - t0 < 150000) {
    s = await snap();
    const d = Math.hypot(45.5 - s.x, 31.5 - s.z);
    if (d < 2.0) { arrived = true; break; }
    await evalJs(`(() => { const dx = 45.5 - NOVA_FOX3.state.pos.x, dz = 31.5 - NOVA_FOX3.state.pos.z; NOVA_FOX3.state.yaw = Math.atan2(-dx, -dz); })()`);
    if (Date.now() - lastCheck > 1500) {
      if (s.moved - lastMoved < 0.25) { await keyUp("w", "KeyW"); await key(" ", "Space"); jumps++; await keyDown("w", "KeyW"); }
      lastMoved = s.moved; lastCheck = Date.now();
    }
    if (Math.floor((Date.now() - t0) / 1000) % 15 === 0) log("TREK", `t=${((Date.now()-t0)/1000).toFixed(0)}s pos=(${s.x},${s.y},${s.z}) d=${d.toFixed(1)} hp=${s.hp} jumps=${jumps}`);
    await sleep(300);
  }
  await keyUp("w", "KeyW");
  s = await snap();
  log("TREK", `arrived=${arrived} after ${((Date.now() - t0) / 1000).toFixed(1)}s jumps=${jumps} end=(${s.x},${s.y},${s.z}) hp=${s.hp} dead=${s.dead}`);
  writeFileSync("/home/hatch/workspace/nova-fox/playtest-data/probe.json", JSON.stringify({ arrived, seconds: (Date.now() - t0) / 1000, jumps, end: s }, null, 1));
} catch (e) { log("ERROR", e.message); }
finally { try { ws && ws.close(); } catch (e) {} chrome.kill("SIGKILL"); }
console.log("PROBE DONE");
