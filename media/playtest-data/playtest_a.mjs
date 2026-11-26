// Nova Fox PLAYTEST Session A — the first five minutes, played like a
// player: fresh profile, real keyboard/mouse input through CDP, guide
// followed in order. The only harness assists (counted + logged):
//  - steering yaw is set from handle state (CDP cannot synthesize
//    pointer-lock movementX; this is the player's "eyes")
//  - teleportTo is used ONLY to unstick after a phase timeout, and
//    every use is logged as an ASSIST event (a real player would
//    have stayed stuck longer).
// Output: sessionA.json (event log) + screenshots A-*.png + stdout.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = "/opt/meta-chromium/chrome";
const PORT = 9336;
const URL = "file:///home/hatch/workspace/nova-fox/demo3/index.html";
const OUT = "/home/hatch/workspace/nova-fox/playtest-data";
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const events = [];
const T0 = Date.now();
const now = () => (Date.now() - T0) / 1000;
function log(kind, msg, extra = {}) {
  const e = { t: +now().toFixed(2), kind, msg, ...extra };
  events.push(e);
  console.log(`[${e.t.toFixed(1).padStart(7)}s] ${kind.padEnd(9)} ${msg}`);
}

const profile = mkdtempSync(join(tmpdir(), "novafox-ptA-"));
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
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(200);
  }
  throw new Error("devtools endpoint never came up");
}
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("page exception: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
async function keyDown(k, code) { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: code || "", text: k.length === 1 ? k : "" }); }
async function keyUp(k, code) { await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: code || "" }); }
async function key(k, code) { await keyDown(k, code); await sleep(90); await keyUp(k, code); await sleep(130); }
async function mouse(type, x, y, button, buttons) {
  await send("Input.dispatchMouseEvent", { type, x, y, button: button || "none", buttons: buttons || 0, clickCount: 1 });
}
async function shot(name) {
  try {
    const r = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
    log("SHOT", name);
  } catch (e) { log("SHOTFAIL", name + ": " + e.message); }
}
async function snap() {
  return evalJs(`(() => { const s = NOVA_FOX3.state; return {
    realm: s.realm, x: +s.pos.x.toFixed(1), y: +s.pos.y.toFixed(1), z: +s.pos.z.toFixed(1),
    hp: s.hp, moved: +s.movedTotal.toFixed(1), jumped: s.jumped, firstJumpDone: s.firstJumpDone,
    wispKills: s.wispKills, notesPlayed: s.notesPlayed, flips: s.flips,
    gestureUsed: s.gestureUsed, weapon: s.weapon, dead: s.dead,
    guide: NOVA_FOX3.guideCurrent() ? NOVA_FOX3.guideCurrent().id : "none",
    introduced: [...s.introduced], questDone: NOVA_FOX3.sub.questDone,
    monstersAlive: NOVA_FOX3.sub.monsters.filter(m => m.alive).length,
    monstersTotal: NOVA_FOX3.sub.monsters.length,
    walOps: NOVA_FOX3.sub.wal.map(w => w.op),
    score: NOVA_FOX3.scoreNow(),
    guideText: (document.getElementById('guide-lines')||{}).textContent || "",
    hint: (document.getElementById('guide-hint')||{}).textContent || "",
    objective: (document.getElementById('objective')||{}).textContent || "",
    dmg: (document.getElementById('dmgnum')||{}).textContent || "",
  }; })()`);
}
async function waitFor(fn, timeoutMs, label, pollMs = 200) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await snap();
    if (fn(s)) return s;
    await sleep(pollMs);
  }
  log("TIMEOUT", label);
  return null;
}
// Walk toward (tx,tz) with W held; yaw steered from handle (player's eyes).
async function walkTo(tx, tz, timeoutMs, label) {
  const t0 = Date.now();
  await keyDown("w", "KeyW");
  let last = null;
  try {
    while (Date.now() - t0 < timeoutMs) {
      const s = await snap();
      last = s;
      const dx = tx - s.x, dz = tz - s.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.6) { log("ARRIVE", `${label} at (${s.x},${s.z}) after ${((Date.now()-t0)/1000).toFixed(1)}s`); return s; }
      await evalJs(`NOVA_FOX3.state.yaw = ${Math.atan2(-dx, -dz)}; NOVA_FOX3.state.pitch = -0.05;`);
      await sleep(280);
    }
    log("TIMEOUT", `walkTo ${label} (last pos ${last && last.x},${last && last.z})`);
    return null;
  } finally { await keyUp("w", "KeyW"); }
}
let assists = 0;
async function assist(x, z, why) {
  assists++;
  log("ASSIST", `#${assists} teleportTo(${x},${z}) — ${why}`);
  await evalJs(`NOVA_FOX3.teleportTo(${x}, ${z})`);
  await sleep(400);
}

const milestones = {};
function mark(name, s) {
  if (!(name in milestones)) { milestones[name] = +now().toFixed(2); log("MILESTONE", `${name} @ ${milestones[name]}s`, s ? { guide: s.guide } : {}); }
}

try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
    else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors.push(JSON.stringify(m.params.args));
    else if (m.method === "Runtime.exceptionThrown") consoleErrors.push("exception: " + (m.params.exceptionDetails.exception?.description || ""));
  };
  await send("Runtime.enable");
  await send("Page.enable");
  log("NAV", "navigating to index.html");
  await send("Page.navigate", { url: URL });
  let booted = false;
  for (let i = 0; i < 80 && !booted; i++) { await sleep(250); try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) {} }
  if (!booted) throw new Error("page never booted");
  mark("boot_interactive");
  // FPS meter
  await evalJs(`window.__frames = 0; window.__fpsLog = []; (() => { let last = performance.now();
    function f(t) { window.__frames++; if (t - last >= 2000) { window.__fpsLog.push({t: Math.round(t/1000), fps: Math.round(window.__frames / ((t-last)/1000))}); window.__frames = 0; last = t; } requestAnimationFrame(f); } requestAnimationFrame(f); })()`);
  await sleep(600);
  let s = await snap();
  log("SPAWN", `realm=${s.realm} pos=(${s.x},${s.y},${s.z}) hp=${s.hp}`, {});
  log("GUIDE", `wake text: "${s.guideText.slice(0, 220)}"`);
  await shot("A-01-spawn.png");

  // --- wake + rifts: two button clicks before any movement is taught
  const clickT = now();
  await evalJs("document.getElementById('guide-btn').click()");
  await sleep(250);
  s = await snap(); log("GUIDE", `after click 1: beat=${s.guide} text="${s.guideText.slice(0,180)}"`);
  await evalJs("document.getElementById('guide-btn').click()");
  await sleep(250);
  s = await snap(); mark("move_beat_start", s);
  log("GUIDE", `after click 2: beat=${s.guide} hint="${s.hint}" (${(now()-clickT).toFixed(1)}s of clicking/reading before movement is taught)`);

  // --- move beat: walk east, jump once
  await keyDown("w", "KeyW");
  const movePoll = setInterval(async () => {}, 99999); clearInterval(movePoll);
  let seenMove = false, seenJump = false;
  const moveT0 = Date.now();
  await evalJs("NOVA_FOX3.state.yaw = -Math.PI/2;"); // face east
  while (Date.now() - moveT0 < 30000) {
    s = await snap();
    if (!seenMove && s.moved > 0.1) { seenMove = true; mark("first_movement", s); }
    if (s.moved > 3 && !seenJump) { await keyUp("w", "KeyW"); await key(" ", "Space"); await keyDown("w", "KeyW"); }
    if (s.jumped >= 1 && !seenJump) { seenJump = true; mark("first_jump", s); }
    if (s.guide !== "move") break;
    await sleep(200);
  }
  await keyUp("w", "KeyW");
  s = await snap();
  if (s.guide === "fight") mark("move_beat_done", s);
  log("GUIDE", `move beat ended: guide=${s.guide} moved=${s.moved} jumped=${s.jumped} hint="${s.hint}"`);

  // --- fight beat: find the wisp (guide says: meadow, east of spawn)
  const wispPos = await evalJs(`(() => { const m = NOVA_FOX3.sub.monsters.find(m => m.kind === 'wisp'); return { x: m.gx*2+1, z: m.gy*2+1 }; })()`);
  log("HUNT", `wisp cell-world pos (${wispPos.x},${wispPos.z}); player at (${s.x},${s.z}) — guide text says only "east of where you woke"`);
  let got = await walkTo(wispPos.x, wispPos.z, 45000, "the wisp");
  if (!got) { await assist(wispPos.x - 2, wispPos.z, "could not reach wisp by walking in 45s"); }
  s = await snap();
  if (s.introduced.includes("wisp")) mark("first_monster_encounter", s);
  await shot("A-02-wisp.png");
  await key("f", "KeyF"); await sleep(400);
  s = await snap(); log("STRIKE", `after strike 1: wispKills=${s.wispKills} dmg="${s.dmg}"`);
  await key("f", "KeyF");
  s = await waitFor((x) => x.wispKills >= 1, 6000, "wisp kill");
  if (s) mark("first_fight_won", s);
  else { await key("f", "KeyF"); await sleep(500); s = await snap(); log("STRIKE", `after strike 3: wispKills=${s.wispKills}`); if (s.wispKills >= 1) mark("first_fight_won", s); }
  log("WAL", `ops so far: ${JSON.stringify((await snap()).walOps)}`);
  // take the Star Lance
  const lance = await evalJs(`(() => { const it = NOVA_FOX3.sub.items.find(i => i.kind === 'lance' && !i.taken); return it ? { x: it.bx, z: it.bz } : null; })()`);
  if (lance) { await walkTo(lance.x, lance.z, 20000, "the Star Lance"); s = await snap(); log("ITEM", `weapon=${s.weapon}`); }

  // --- numbers beat
  s = await snap(); log("GUIDE", `beat=${s.guide} hint="${s.hint}"`);
  await key("5", "Digit5");
  s = await waitFor((x) => x.notesPlayed >= 1, 5000, "first note");
  if (s) mark("first_note", s);

  // --- bridge beat: THE chord -> travel moment
  s = await snap(); log("GUIDE", `beat=${s.guide} text="${s.guideText.slice(0,160)}"`);
  const bridgeT0 = now();
  await key("1", "Digit1"); await sleep(250); await key("4", "Digit4"); await sleep(250); await key("9", "Digit9");
  s = await waitFor((x) => x.realm === "ashfall", 15000, "bridge crossing");
  if (s) { mark("first_chord_travel", s); log("CHORD", `bridge beat -> Ashfall in ${(now()-bridgeT0).toFixed(1)}s from first key of the tune`); }
  await shot("A-03-ashfall.png");
  s = await snap(); log("GUIDE", `ashfall beat text="${s.guideText.slice(0,160)}" objective="${s.objective}"`);

  // --- home again
  await sleep(3000);
  await key("1", "Digit1"); await sleep(250); await key("4", "Digit4"); await sleep(250); await key("9", "Digit9");
  s = await waitFor((x) => x.realm === "nova", 15000, "home crossing");
  if (s) mark("crossed_home", s);

  // --- gravity beat
  await key("g", "KeyG");
  s = await waitFor((x) => x.flips >= 1, 6000, "gravity flip");
  if (s) mark("first_gravity_flip", s);
  s = await waitFor((x) => x.y > 40, 20000, "ceiling landing");
  log("GRAVITY", s ? `landed on the ceiling y=${s.y}` : "never reached the ceiling");
  await key("g", "KeyG");
  s = await waitFor((x) => x.y < 26, 20000, "ground landing");
  log("GRAVITY", `restored, y=${s && s.y}`);

  // --- gesture beat: right-mouse triangle
  const triVerts = [[300, 420], [460, 220], [620, 420], [300, 420]];
  const tri = [];
  for (let v = 0; v < triVerts.length - 1; v++) {
    const [x0, y0] = triVerts[v], [x1, y1] = triVerts[v + 1];
    for (let i = 0; i < 14; i++) tri.push([x0 + (x1 - x0) * (i / 14), y0 + (y1 - y0) * (i / 14)]);
  }
  tri.push(triVerts[triVerts.length - 1]);
  await mouse("mousePressed", tri[0][0], tri[0][1], "right", 2);
  for (const [x, y] of tri.slice(1)) { await mouse("mouseMoved", x, y, "none", 2); await sleep(16); }
  await mouse("mouseReleased", tri[tri.length - 1][0], tri[tri.length - 1][1], "right", 0);
  s = await waitFor((x) => x.gestureUsed || x.realm === "ashfall", 15000, "gesture crossing");
  if (s) mark("first_gesture_travel", s);
  if (s && s.realm === "ashfall") { await key("1", "Digit1"); await sleep(250); await key("4", "Digit4"); await sleep(250); await key("9", "Digit9"); await waitFor((x) => x.realm === "nova", 15000, "home after gesture"); }

  // --- five-minute mark
  const fiveMin = await snap();
  log("FIVEMIN", `at 5:00-ish (t=${now().toFixed(1)}s): guide=${fiveMin.guide} milestones=${Object.keys(milestones).join(",")}`);

  // --- quest beat: east to the barrow, down the shaft, the Deep Stone
  s = await snap(); log("GUIDE", `quest beat text="${s.guideText.slice(0,200)}" hint="${s.hint}"`);
  let q = await walkTo(45.5, 31.5, 90000, "the barrow shaft top");
  if (!q) { await assist(45, 31, "barrow not reached by walking in 90s"); }
  await shot("A-04-barrow.png");
  // descend: walk into the shaft and let gravity work; then head for the stone
  await keyDown("w", "KeyW");
  const descT0 = Date.now();
  let low = null;
  while (Date.now() - descT0 < 30000) {
    s = await snap();
    await evalJs(`(() => { const dx = 60.5 - NOVA_FOX3.state.pos.x, dz = 35.5 - NOVA_FOX3.state.pos.z; NOVA_FOX3.state.yaw = Math.atan2(-dx, -dz); })()`);
    if (s.y < 12) { low = s; break; }
    await sleep(300);
  }
  await keyUp("w", "KeyW");
  log("DESCENT", low ? `reached y=${low.y}` : `still at y=${s.y} after 30s in the shaft`);
  if (!low) await assist(58, 35, "shaft descent did not reach the deep room");
  q = await walkTo(60.5, 35.5, 45000, "the Deep Stone");
  s = await snap();
  // guardian may be in the way: strike if close
  for (let i = 0; i < 6 && !s.questDone; i++) {
    const g = await evalJs(`(() => { const m = NOVA_FOX3.sub.monsters.find(m => m.kind === 'guardian' && m.alive); if (!m) return null; const dx = m.gx*2+1 - NOVA_FOX3.state.pos.x, dz = m.gy*2+1 - NOVA_FOX3.state.pos.z; return { d: Math.hypot(dx, dz), hp: m.hp }; })()`);
    if (g && g.d < 4) { await evalJs(`(() => { const m = NOVA_FOX3.sub.monsters.find(m => m.kind === 'guardian'); const dx = m.gx*2+1 - NOVA_FOX3.state.pos.x, dz = m.gy*2+1 - NOVA_FOX3.state.pos.z; NOVA_FOX3.state.yaw = Math.atan2(-dx, -dz); })()`); await key("f", "KeyF"); await sleep(400); }
    s = await snap();
    if (s.questDone) break;
    await walkTo(60.5, 35.5, 8000, "the Deep Stone (retry)");
    s = await snap();
  }
  if (s.questDone) mark("quest_done", s);
  log("QUEST", `questDone=${s.questDone} hp=${s.hp} score=${s.score} walOps=${JSON.stringify(s.walOps)}`);
  await shot("A-05-deepstone.png");

  const fps = await evalJs("window.__fpsLog");
  log("FPS", JSON.stringify(fps));
  log("ERRORS", `console errors: ${consoleErrors.length} ${consoleErrors.slice(0,2).join(" | ")}`);
  log("SUMMARY", `assists=${assists} milestones=${JSON.stringify(milestones)}`);
} catch (e) {
  log("HARNESS-ERROR", e.message + " || chrome: " + chromeErr.slice(-400));
} finally {
  writeFileSync(join(OUT, "sessionA.json"), JSON.stringify({ milestones, assists, events, consoleErrors }, null, 1));
  try { ws && ws.close(); } catch (e) {}
  chrome.kill("SIGKILL");
}
console.log("SESSION A DONE");
