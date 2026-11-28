// Nova Fox — everything-ship feature probe (EE 987): the core
// interactions of the features the full suite's portal-section abort
// leaves unjudged in this environment (Jenkins nova-fox-e2e #5/#6/#8:
// the pristine shipped tree aborts at the same place), plus banter,
// which has no section in the shared suite at all. Drives the merged
// tree (demo24) through the game's own test surface (NOVA_FOX3) and
// the real DOM, in the family harness shape (private port; the Jenkins
// runner adapts chrome/URL/policy/port the same way as the suites).
//   1. narration capstone: 25 beats embedded, N-03 in both schemes,
//      silent beats absent, the banter takes hooked as JOY-###,
//      the wake beat queued while playback is locked
//   2. the world starts: guide at the wake beat
//   3. banter: a line surfaces on the #banter-line surface and the
//      engine counts the play (natural arrival first; the game's own
//      banter.fire handle with a pocket event as the fallback offer)
//   4. speedrun: arm at Arrival, the clock starts on first movement,
//      the race clock stands on screen, abort stands it down
//   5. idea door: the full telling round trip at 1.1.1/1.1.7/1.1.1
//      against a fetch-level chart stub (the suite's own legs)
//   6. zero console errors throughout
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = "/opt/meta-chromium/chrome";
const PORT = 9391;
const URL = "file:///home/hatch/workspace/nova-fox/demo24/index.html";

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "novafox24-probe-"));
const POLICY =
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
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
    } catch (e) { /* not up yet */ }
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
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP call timed out (30s): ${method}`));
    }, 30000);
    pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error("page exception: " +
      (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}
async function boot() {
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    try { if (await evalJs("!!window.NOVA_FOX3")) { await sleep(800); return true; } }
    catch (e) { /* loading */ }
  }
  return false;
}
async function waitFor(expr, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await evalJs(expr)) return true; } catch (e) { /* frame mid-step */ }
    await sleep(300);
  }
  return false;
}
async function keyDown(key, code, vk) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
  });
}
async function keyUp(key, code, vk) {
  await send("Input.dispatchKeyEvent", {
    type: "keyUp", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
  });
}

try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id).resolve(m.result);
      pending.delete(m.id);
    } else if (m.method === "Runtime.consoleAPICalled" &&
               m.params.type === "error") {
      consoleErrors.push(JSON.stringify(m.params.args));
    } else if (m.method === "Runtime.exceptionThrown") {
      consoleErrors.push("exception: " +
        (m.params.exceptionDetails.exception?.description || ""));
    }
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: URL });
  check("page boots, NOVA_FOX3 handle present", await boot());

  // ---- 1. narration capstone -------------------------------------
  check("narration: all 25 Joy beats in the manifest",
    await evalJs("Object.keys(NOVA_FOX3.narration.manifest()).length") === 25);
  check("narration: wake and quest takes ready",
    await evalJs("NOVA_FOX3.narration.ready('N-01') && NOVA_FOX3.narration.ready('BEAT-quest')"));
  check("narration: N-03 ready in both schemes, no bare N-03",
    await evalJs("NOVA_FOX3.narration.ready('N-03-WASD') && NOVA_FOX3.narration.ready('N-03-AWEF') && !NOVA_FOX3.narration.ready('N-03')"));
  check("narration: the silent beats carry no take",
    await evalJs("!NOVA_FOX3.narration.ready('BEAT-border-down') && !NOVA_FOX3.narration.ready('BEAT-strike-hold')"));
  check("banter audio hook: the recorded takes are embedded as JOY-###",
    await evalJs("NOVA_FOX3.narration.ready('JOY-001') && NOVA_FOX3.narration.ready('JOY-081')"));
  check("narration: the wake beat queues while playback is locked",
    await evalJs("NOVA_FOX3.narration.state().pending.includes('N-01')") === true);

  // ---- 2. the world starts ---------------------------------------
  await evalJs("document.getElementById('splash-btn').click()");
  check("the world starts: the guide stands at the wake beat",
    await waitFor("NOVA_FOX3.guideCurrent() && NOVA_FOX3.guideCurrent().id === 'wake'", 8000,
      "wake beat"));

  // ---- 3. banter --------------------------------------------------
  // Joy's ambient voice is designed to start when her lesson ends
  // (banterGoLive: guide handover, or the player's own dismiss —
  // game3's guide-dismiss handler). During the lesson she is muted
  // by design, so the probe takes the player's door out of the
  // lesson first, exactly as a player would.
  await evalJs("document.getElementById('guide-dismiss').click()");
  await sleep(400);
  check("banter: the engine is live once the lesson is dismissed",
    await evalJs("NOVA_FOX3.banter.state().live") === true);
  let banterPlayed = await waitFor(
    "NOVA_FOX3.banter.state().plays >= 1", 8000, "a banter line on arrival");
  if (!banterPlayed) {
    // Offer her a moment through the game's own handle (a pocket
    // crossing — the event game3 fires on a tune landing).
    await evalJs("NOVA_FOX3.banter.fire({ type: 'pocket' })");
    banterPlayed = await waitFor(
      "NOVA_FOX3.banter.state().plays >= 1", 8000, "a banter line on the pocket offer");
  }
  check("banter: a line plays in the world", banterPlayed);
  check("banter: the line stands on the #banter-line surface",
    ((await evalJs("document.getElementById('banter-line').textContent")) || "").length >= 8,
    JSON.stringify(await evalJs("document.getElementById('banter-line').textContent")));
  check("banter: the engine remembers the play",
    (await evalJs("NOVA_FOX3.banter.state().lines.length")) >= 1);

  // ---- 4. speedrun -------------------------------------------------
  await evalJs("NOVA_FOX3.speedrun.arm()");
  check("speedrun: arming a run stands the fox at Arrival, clock waiting",
    await evalJs("NOVA_FOX3.speedrun.phase()") === "armed" &&
    await evalJs("NOVA_FOX3.state.realm") === "nova");
  await keyDown("w", "KeyW", 87);
  const srStarted = await waitFor(
    "NOVA_FOX3.speedrun.phase() === 'running'", 8000, "the run starts");
  await keyUp("w", "KeyW", 87);
  check("speedrun: the clock starts on first movement", srStarted);
  check("speedrun: the race clock stands on screen while a run is live",
    await evalJs("document.getElementById('runtimer').style.display") === "block");
  check("speedrun: elapsed time accrues on the run",
    (await evalJs("NOVA_FOX3.speedrun.elapsed()")) > 0);
  await evalJs("NOVA_FOX3.speedrun.abort()");
  check("speedrun: abort stands the run down",
    await evalJs("NOVA_FOX3.speedrun.phase()") !== "running" &&
    await evalJs("NOVA_FOX3.speedrun.phase()") !== "armed");

  // ---- 5. idea door -------------------------------------------------
  check("idea door: the door stands in Nova Prime at blocks (13, 10)",
    await evalJs("(() => { const p = NOVA_FOX3.doorPos(); " +
      "return !!p && p.x === 13.5 && p.z === 10.5; })()") === true);
  check("idea door: the aiming check answers (doorAimed is a live boolean)",
    typeof (await evalJs("NOVA_FOX3.doorAimed()")) === "boolean");
  await evalJs("NOVA_FOX3.ideaToggle(true)");
  await sleep(200);
  check("idea door: the panel opens and ideaState says so",
    await evalJs("NOVA_FOX3.ideaState().panelOpen") === true &&
    (await evalJs("document.getElementById('ideas').style.display")) === "block");
  check("idea door: the door writes to the ideas scroll, 1.1.1/1.1.7/1.1.1",
    await evalJs("NOVA_FOX3.ideaState().coord") === "1.1.1/1.1.7/1.1.1");
  await evalJs(`(() => {
    window.__ideaNet = { inserts: [], selects: [] };
    window.__ideaScroll = "";
    const IDEA_COORD = "1.1.1/1.1.7/1.1.1";
    window.fetch = (url, opts = {}) => {
      const u = String(url);
      const ok = (body) => Promise.resolve(new Response(body, { status: 200 }));
      if (u.includes("/api/v2/version")) return ok("{}");
      const c = new URL(u).searchParams.get("c");
      if (u.includes("/api/v2/select")) {
        window.__ideaNet.selects.push(c);
        return ok(c === IDEA_COORD ? window.__ideaScroll : "");
      }
      if (u.includes("/api/v2/insert")) {
        window.__ideaNet.inserts.push({ coord: c, body: String(opts.body || "") });
        if (c === IDEA_COORD) window.__ideaScroll += String(opts.body || "") + "\\n";
        return ok("");
      }
      return ok("");
    };
    return true;
  })()`);
  check("idea door: signed out at the door (no token on this machine)",
    await evalJs("NOVA_FOX3.hasToken()") === false &&
    await evalJs("NOVA_FOX3.ideaState().queued") === 0);
  await evalJs("document.getElementById('idea-title').value = 'a bridge of bells'");
  await evalJs("document.getElementById('idea-body').value = 'so the dark water can be crossed by sound'");
  await evalJs("document.getElementById('btn-idea-tell').click()");
  await sleep(400);
  check("idea door: an offline telling queues exactly one outbox entry",
    await evalJs("NOVA_FOX3.ideaState().queued") === 1 &&
    await evalJs("JSON.parse(localStorage.getItem('nova-phox-idea-outbox')).length") === 1);
  check("idea door: nothing was inserted while signed out",
    await evalJs("window.__ideaNet.inserts.filter(i => i.coord === '1.1.1/1.1.7/1.1.1').length") === 0);
  check("idea door: the panel labels the waiting telling honestly — on this machine",
    (await evalJs("document.getElementById('idea-yours').textContent"))
      .includes("waiting on this machine"));
  await evalJs("localStorage.setItem('nova-phox-token', JSON.stringify('e2e-door-token'))");
  let ideaFlushed = false;
  for (let i = 0; i < 40 && !ideaFlushed; i++) {
    await evalJs("NOVA_FOX3.backendFlush()");
    ideaFlushed =
      (await evalJs("window.__ideaNet.inserts.filter(i => i.coord === '1.1.1/1.1.7/1.1.1').length")) === 1 &&
      (await evalJs("NOVA_FOX3.ideaState().queued")) === 0;
    if (!ideaFlushed) await sleep(5000);
  }
  check("idea door: signing in flushes exactly one insert to the ideas scroll",
    ideaFlushed,
    "idea-coord inserts: " +
      JSON.stringify(await evalJs("window.__ideaNet.inserts.filter(i => i.coord === '1.1.1/1.1.7/1.1.1')")) +
      " queued=" + (await evalJs("NOVA_FOX3.ideaState().queued")));
  check("idea door: the flushed insert is one IDEA line, the panel's own words",
    await evalJs("(() => { const i = window.__ideaNet.inserts" +
      ".find(x => x.coord === '1.1.1/1.1.7/1.1.1'); " +
      "return !!i && i.body.startsWith('IDEA|v1|') && !i.body.includes('\\n'); })()") === true);
  check("idea door: read-back shows the telling as told — from the chart, not the click",
    await evalJs("(() => { const s = NOVA_FOX3.ideaState(); " +
      "return s.rows.length === 1 && s.rows[0].title === 'a bridge of bells' && " +
      "s.rows[0].status === 'submitted'; })()") === true &&
    (await evalJs("document.getElementById('idea-yours').textContent")).includes("told"));
  await evalJs(`(() => {
    const row = NOVA_FOX3.ideaState().rows[0];
    if (!row) return false;
    window.__ideaScroll += "STATUS|v1|" + row.id + "|picked|" + Date.now() + "|-\\n";
    return true;
  })()`);
  for (let i = 0; i < 10; i++) {
    await evalJs("NOVA_FOX3.backendFlush()");
    if ((await evalJs("(NOVA_FOX3.ideaState().rows[0] || {}).status")) === "picked") break;
    await sleep(2000);
  }
  check("idea door: a picked STATUS on the chart reads back as taken up",
    await evalJs("(NOVA_FOX3.ideaState().rows[0] || {}).status") === "picked" &&
    (await evalJs("document.getElementById('idea-yours').textContent")).includes("taken up"));
  await evalJs(`(() => {
    const row = NOVA_FOX3.ideaState().rows[0];
    if (!row) return false;
    window.__ideaScroll += "STATUS|v1|" + row.id + "|shipped|" + Date.now() + "|999\\n";
    return true;
  })()`);
  for (let i = 0; i < 10; i++) {
    await evalJs("NOVA_FOX3.backendFlush()");
    if ((await evalJs("(NOVA_FOX3.ideaState().rows[0] || {}).status")) === "shipped") break;
    await sleep(2000);
  }
  check("idea door: a shipped STATUS reads back as in the world, with its EE",
    await evalJs("(() => { const r = NOVA_FOX3.ideaState().rows[0]; " +
      "return !!r && r.status === 'shipped' && r.shipEE === 999; })()") === true &&
    (await evalJs("document.getElementById('idea-yours').textContent")).includes("in the world") &&
    (await evalJs("document.getElementById('idea-yours').textContent")).includes("EE 999"));
  check("idea door: lately told carries the telling for every fox to see",
    (await evalJs("document.getElementById('idea-lately').textContent"))
      .includes("a bridge of bells"));
  await evalJs("NOVA_FOX3.ideaToggle(false)");

  // ---- 6. console ---------------------------------------------------
  check("no page console errors", consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(" | "));
} catch (e) {
  fail++;
  console.log("FAIL  harness error:", e.message);
  if (chromeErr) console.log(chromeErr.slice(-800));
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill("SIGKILL");
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
