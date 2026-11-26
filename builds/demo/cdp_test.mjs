// Nova Fox demo — end-to-end playtest of the SHIPPED index.html in
// headless Chrome (Chrome for Testing) over CDP. Drives the real input
// path (keyboard events) and asserts the core loop:
//   boot with WASM live -> walk (trail inscribes) -> chord opens a
//   pocket -> gravity flips -> re-derive drifts the view while the
//   document stays byte-identical.
// Run: node cdp_test.mjs   (exits non-zero on any failure)
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/opt/meta-chromium/chrome";
const PORT = 9333;
const URL = "file:///home/hatch/workspace/nova-fox/demo/index.html";

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "novafox-cdp-"));
// This Chromium build requires the Hatch WebGL domain policy at
// startup (file + its SHA-256) — the same pair the house Playwright
// runtime passes.
import { readFileSync as readPolicy } from "node:fs";
import { createHash } from "node:crypto";
const POLICY =
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policySha = createHash("sha256").update(readPolicy(POLICY)).digest("hex");
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
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
    pending.set(id, { resolve, reject });
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
async function key(k, code) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown", key: k, code: code || "", text: k.length === 1 ? k : "",
  });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: code || "" });
  await sleep(120);
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
  // wait for the game handle
  let booted = false;
  for (let i = 0; i < 60 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX"); } catch (e) { /* loading */ }
  }
  check("page boots, NOVA_FOX handle present", booted);
  await sleep(600); // let the first frames render

  check("WASM core live in page",
    await evalJs("NOVA_FOX.kernels.usingWasm") === true);
  check("boots into Arrival",
    await evalJs("NOVA_FOX.state.room") === "1.1.1/1.1.1/1.1.1");
  check("world starts at 4 scrolls",
    await evalJs("NOVA_FOX.doc.scrollCount") === 4);
  check("readout names the WASM kernel",
    (await evalJs("document.getElementById('ro-kernel').textContent")).includes("WASM"));
  check("canvas rendered",
    await evalJs("document.querySelectorAll('#stage canvas').length") === 1);

  // Walk the entrance shelf to the fall shaft and drop onto the '*':
  // spawn (3,5) -> road east to (7,5) -> down the shaft to (7,7).
  const wal0 = await evalJs("NOVA_FOX.doc.wal.length");
  for (let i = 0; i < 4; i++) await key("ArrowRight", "ArrowRight");
  await key("ArrowDown", "ArrowDown");
  check("walking advances the tick",
    (await evalJs("NOVA_FOX.state.tick")) >= 5);
  check("the fall shaft delivers the player to the deepening (7,7)",
    (await evalJs("NOVA_FOX.state.player.x")) === 7 &&
    (await evalJs("NOVA_FOX.state.player.y")) === 7);
  check("taking the deepening inscribes (WAL grew)",
    (await evalJs("NOVA_FOX.doc.wal.length")) > wal0);
  check("inscription rights held for Arrival",
    (await evalJs("NOVA_FOX.state.deepening.size")) >= 1);

  // The instrument: Q E T = notes 1,3,5 -> a pocket opens.
  await key("q", "KeyQ");
  await key("e", "KeyE");
  await key("t", "KeyT");
  await sleep(300);
  const roomAfterChord = await evalJs("NOVA_FOX.state.room");
  check("chord opens a pocket (now in section 1.2)",
    roomAfterChord.split("/")[2].startsWith("1.2."), roomAfterChord);
  check("pocket inscribed (5 scrolls)",
    (await evalJs("NOVA_FOX.doc.scrollCount")) === 5);
  check("tune segment in the WAL",
    await evalJs("NOVA_FOX.doc.wal.some(s => s.op === 'tune')") === true);
  check("pocket has a live monster",
    await evalJs(
      "(() => { const m = NOVA_FOX.state.monsters.get(NOVA_FOX.state.room); return !!m && m.alive; })()") === true);

  // Gravity flip, in the pocket.
  const g0 = await evalJs("NOVA_FOX.state.gdir");
  await key("g", "KeyG");
  check("gravity flips", (await evalJs("NOVA_FOX.state.gdir")) === -g0);
  check("warp inscribed",
    await evalJs("NOVA_FOX.doc.wal.some(s => s.op === 'warp')") === true);
  await key("g", "KeyG"); // flip back for the next checks

  // Walk the pocket road to the gate: east past the burning cell
  // (it costs a heart, it does not refuse), a gravity-flip pair mid-
  // road to break the dark thing's approach, then on to the gate.
  for (let i = 0; i < 8; i++) await key("ArrowRight", "ArrowRight");
  await key("g", "KeyG");
  await key("g", "KeyG");
  for (let i = 0; i < 12; i++) await key("ArrowRight", "ArrowRight");
  const crossings = await evalJs("NOVA_FOX.state.crossings");
  const roomNow = await evalJs("NOVA_FOX.state.room");
  const heartsNow = await evalJs("NOVA_FOX.state.hearts");
  const posNow = await evalJs(
    "NOVA_FOX.state.player.x + ',' + NOVA_FOX.state.player.y");
  check("the road is walkable end to end (gate crossed)",
    crossings >= 1,
    `crossings=${crossings} room=${roomNow} hearts=${heartsNow} at=${posNow}`);

  // Reload law: re-derive drifts the view, the document is untouched.
  const serBefore = await evalJs("NOVA_FOX.doc.serialize()");
  const seedBefore = await evalJs(
    "document.getElementById('ro-room').textContent");
  await key("v", "KeyV");
  await sleep(200);
  check("document byte-identical across re-derive",
    (await evalJs("NOVA_FOX.doc.serialize()")) === serBefore);
  check("derivation epoch advanced",
    (await evalJs("document.getElementById('ro-room').textContent")) !== seedBefore);

  // Same tune at the same place reopens the same pocket.
  const home = await evalJs("NOVA_FOX.state.room");
  if (home !== "1.1.1/1.1.1/1.1.1") {
    await evalJs("NOVA_FOX.enterRoom('1.1.1/1.1.1/1.1.1')");
  }
  const countBefore = await evalJs("NOVA_FOX.doc.scrollCount");
  await key("q", "KeyQ");
  await key("e", "KeyE");
  await key("t", "KeyT");
  await sleep(300);
  check("same tune reopens the same pocket (no new scroll)",
    (await evalJs("NOVA_FOX.doc.scrollCount")) === countBefore);
  check("...and you are standing in it again",
    (await evalJs("NOVA_FOX.state.room")) === roomAfterChord);

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
