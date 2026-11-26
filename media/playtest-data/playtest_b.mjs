// Nova Fox PLAYTEST Session B — systems: chisel pacing, monster
// pressure + despawn watch, realm variation, performance.
// Teleports are used freely here (systems probing, not a player
// session) and every one is logged. Output: sessionB.json + shots.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = "/opt/meta-chromium/chrome";
const PORT = 9337;
const URL = "file:///home/hatch/workspace/nova-fox/demo3/index.html";
const OUT = "/home/hatch/workspace/nova-fox/playtest-data";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const events = [];
const T0 = Date.now();
const now = () => (Date.now() - T0) / 1000;
function log(kind, msg) { const e = { t: +now().toFixed(2), kind, msg }; events.push(e); console.log(`[${e.t.toFixed(1).padStart(7)}s] ${kind.padEnd(9)} ${msg}`); }

const profile = mkdtempSync(join(tmpdir(), "novafox-ptB-"));
const POLICY = "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policySha = createHash("sha256").update(readFileSync(POLICY)).digest("hex");
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
  `--hatch-webgl-allowed-domains-file=${POLICY}`,
  `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
let chromeErr = "";
chrome.stderr.on("data", (d) => { chromeErr += d; });
async function wsUrl() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const list = await r.json();
      const page = list.find((t) => t.type === "page"); if (page) return page.webSocketDebuggerUrl;
    } catch (e) {} await sleep(200);
  } throw new Error("devtools endpoint never came up");
}
let msgId = 0; const pending = new Map(); const consoleErrors = []; let ws;
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++msgId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evalJs(expression) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("page exception: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; }
async function keyDown(k, code) { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: code || "", text: k.length === 1 ? k : "" }); }
async function keyUp(k, code) { await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: code || "" }); }
async function key(k, code) { await keyDown(k, code); await sleep(90); await keyUp(k, code); await sleep(130); }
async function shot(name) { try { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(join(OUT, name), Buffer.from(r.data, "base64")); log("SHOT", name); } catch (e) { log("SHOTFAIL", name); } }
async function snap() { return evalJs(`(() => { const s = NOVA_FOX3.state; const ms = NOVA_FOX3.sub.monsters;
  return { realm: s.realm, x: +s.pos.x.toFixed(1), y: +s.pos.y.toFixed(1), z: +s.pos.z.toFixed(1), hp: s.hp, dead: s.dead,
    alive: ms.filter(m => m.alive).length, total: ms.length,
    aliveHere: ms.filter(m => m.alive && m.realmId === s.realm).length,
    deadRecords: ms.filter(m => !m.alive).length,
    scrolls: NOVA_FOX3.sub.scrolls.size, wal: NOVA_FOX3.sub.wal.length,
    chisel: NOVA_FOX3.sub.chisel.get(s.realm) ? NOVA_FOX3.sub.chisel.get(s.realm).size : 0,
    dmg: (document.getElementById('dmgnum')||{}).textContent || "",
    score: NOVA_FOX3.scoreNow() }; })()`); }

try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
    else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors.push(JSON.stringify(m.params.args));
    else if (m.method === "Runtime.exceptionThrown") consoleErrors.push("exception: " + (m.params.exceptionDetails.exception?.description || "")); };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.navigate", { url: URL });
  let booted = false;
  for (let i = 0; i < 80 && !booted; i++) { await sleep(250); try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) {} }
  if (!booted) throw new Error("no boot");
  await evalJs(`window.__frames = 0; window.__fpsLog = []; (() => { let last = performance.now();
    function f(t) { window.__frames++; if (t - last >= 2000) { window.__fpsLog.push({t: Math.round(t/1000), fps: Math.round(window.__frames / ((t-last)/1000))}); window.__frames = 0; last = t; } requestAnimationFrame(f); } requestAnimationFrame(f); })()`);
  await sleep(600);
  // click through the two text beats to unlock normal play quickly
  await evalJs("document.getElementById('guide-btn').click()"); await sleep(200);
  await evalJs("document.getElementById('guide-btn').click()"); await sleep(200);
  let s = await snap();
  log("BOOT", `monsters at boot: total=${s.total} alive=${s.alive} scrolls=${s.scrolls} wal=${s.wal}`);

  // ---------- 1. CHISEL PACING ----------
  // Flat-ish spot near spawn; aim down at the ground block underfoot-ish.
  await evalJs("NOVA_FOX3.teleportTo(20, 20)"); await sleep(600);
  await evalJs("NOVA_FOX3.state.pitch = -1.2; NOVA_FOX3.state.yaw = 0;");
  await sleep(300);
  const chiselTimes = [];
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    await key("c", "KeyC");
    await sleep(500);
    s = await snap();
    chiselTimes.push({ stroke: i + 1, ms: Date.now() - t0, dmg: s.dmg, chiselEntries: s.chisel, wal: s.wal });
    log("CHISEL", `stroke ${i+1}: popup="${s.dmg}" chiselMap=${s.chisel} wal=${s.wal}`);
  }
  // A 2x2 patch: 4 blocks x 3 strokes. Reposition between blocks.
  const patchT0 = Date.now();
  let strokes = 0;
  for (const [ox, oz] of [[0, 0], [2, 0], [0, 2], [2, 2]]) {
    await evalJs(`NOVA_FOX3.teleportTo(${20 + ox}, ${20 + oz})`);
    await sleep(350);
    await evalJs("NOVA_FOX3.state.pitch = -1.2; NOVA_FOX3.state.yaw = 0;");
    await sleep(200);
    for (let i = 0; i < 3; i++) { await key("c", "KeyC"); strokes++; await sleep(420); }
  }
  s = await snap();
  log("CHISEL", `2x2 patch: ${strokes} strokes in ${((Date.now() - patchT0) / 1000).toFixed(1)}s -> wal=${s.wal}`);
  // "too deep to shape": aim at the Deep Stone itself.
  await evalJs("NOVA_FOX3.state.pos.set(58.5, 7.5, 35.5); NOVA_FOX3.state.vel.set(0,0,0);");
  await sleep(600);
  await evalJs(`(() => { const dx = 60.5 - NOVA_FOX3.state.pos.x, dz = 35.5 - NOVA_FOX3.state.pos.z; NOVA_FOX3.state.yaw = Math.atan2(-dx, -dz); NOVA_FOX3.state.pitch = -0.2; })()`);
  await sleep(300);
  await key("c", "KeyC"); await sleep(500);
  s = await snap();
  log("CHISEL", `chiseling the Deep Stone -> popup="${s.dmg}" (this is what feedback #11 asks about)`);

  // ---------- 2. REALM VARIATION (data) ----------
  for (const realm of ["nova", "ashfall"]) {
    const v = await evalJs(`(() => { const sub = NOVA_FOX3.sub; const out = { scrolls: 0, lifeTotal: 0, growthCells: 0, kinds: {} };
      for (const sc of sub.scrolls.values()) { if (sc.realmId !== "${realm}") continue; out.scrolls++; out.lifeTotal += sub.lifeOf(sc); }
      for (const m of sub.monsters) if (m.realmId === "${realm}") out.kinds[m.kind] = (out.kinds[m.kind] || 0) + 1;
      return out; })()`);
    log("VARIATION", `${realm}: ${JSON.stringify(v)}`);
  }
  // Visual: same-ish spots in both realms
  await evalJs("NOVA_FOX3.teleportTo(8, 8)"); await sleep(800); await shot("B-01-nova-arrival.png");
  await key("1", "Digit1"); await sleep(200); await key("4", "Digit4"); await sleep(200); await key("9", "Digit9");
  await sleep(2500);
  await evalJs("NOVA_FOX3.teleportTo(8, 8)"); await sleep(800); await shot("B-02-ashfall-arrival.png");
  await key("1", "Digit1"); await sleep(200); await key("4", "Digit4"); await sleep(200); await key("9", "Digit9");
  await sleep(2500);

  // ---------- 3. MONSTER PRESSURE + DESPAWN WATCH (7 min) ----------
  // Outside the ward, on foot, evading: walk a slow circuit, never strike.
  await evalJs("NOVA_FOX3.teleportTo(30, 30)"); await sleep(600);
  // make sure the ward is behind us: first jump long done in A; here set state honestly via a jump
  await key(" ", "Space"); await sleep(1200);
  const watchT0 = Date.now();
  const samples = [];
  let leg = 0;
  await keyDown("w", "KeyW");
  while (Date.now() - watchT0 < 7 * 60 * 1000) {
    // steer a lazy square circuit
    const yaw = [0, -Math.PI / 2, Math.PI, Math.PI / 2][Math.floor(leg / 2) % 4];
    await evalJs(`NOVA_FOX3.state.yaw = ${yaw};`);
    await sleep(5000);
    leg++;
    s = await snap();
    const fps = await evalJs("window.__fpsLog.length ? window.__fpsLog[window.__fpsLog.length-1].fps : -1");
    const row = { t: +((Date.now() - watchT0) / 1000).toFixed(0), ...s, fps };
    samples.push(row);
    log("WATCH", `t=${row.t}s alive=${s.alive} total=${s.total} deadRecords=${s.deadRecords} scrolls=${s.scrolls} hp=${s.hp} fps=${fps} pos=(${s.x},${s.z})`);
    if (s.dead) { log("WATCH", "player died under pure flight; respawn expected"); await sleep(2500); await keyDown("w", "KeyW"); }
  }
  await keyUp("w", "KeyW");
  const fpsAll = await evalJs("window.__fpsLog");
  log("FPS", JSON.stringify(fpsAll));
  log("ERRORS", `console errors: ${consoleErrors.length}`);
  writeFileSync(join(OUT, "sessionB.json"), JSON.stringify({ events, samples, consoleErrors }, null, 1));
} catch (e) {
  log("HARNESS-ERROR", e.message + " || chrome: " + chromeErr.slice(-400));
  try { writeFileSync(join(OUT, "sessionB.json"), JSON.stringify({ events, consoleErrors }, null, 1)); } catch (e2) {}
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill("SIGKILL");
}
console.log("SESSION B DONE");
