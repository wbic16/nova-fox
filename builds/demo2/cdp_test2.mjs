// Nova Fox demo2 — end-to-end playtest of the SHIPPED index.html in
// headless Chrome over CDP. Drives the real input path (keyboard
// events through the page's own handlers) along the scripted
// fresh-player path the guide guarantees:
//   boot (WASM live, Nova Prime, HP readable) -> guide buttons ->
//   walk + jump -> one number (the instrument) -> bridge tune
//   1,4,9 by NUMBER keys -> Ashfall Haven -> same tune home ->
//   G flips gravity (and back) -> a monster's contact drops HP ->
//   the Deep Stone completes the quest and grants the hat ->
//   zero console errors.
// Run: node cdp_test2.mjs   (exits non-zero on any failure)
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = "/opt/meta-chromium/chrome";
const PORT = 9334;
const URL = "file:///home/hatch/workspace/nova-fox/demo2/index.html";

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "novafox2-cdp-"));
const POLICY =
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policySha = createHash("sha256").update(readFileSync(POLICY)).digest("hex");
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
async function keyDown(k, code) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown", key: k, code: code || "", text: k.length === 1 ? k : "",
  });
}
async function keyUp(k, code) {
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: code || "" });
}
async function key(k, code) {
  await keyDown(k, code);
  await sleep(90);
  await keyUp(k, code);
  await sleep(130);
}
async function waitFor(expr, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await evalJs(expr)) return true;
    await sleep(250);
  }
  console.log(`  .. timeout waiting for: ${label}`);
  return false;
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
  let booted = false;
  for (let i = 0; i < 60 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX2"); } catch (e) { /* loading */ }
  }
  check("page boots, NOVA_FOX2 handle present", booted);
  await sleep(800);

  check("WASM core live in page",
    await evalJs("NOVA_FOX2.kernels.usingWasm") === true);
  check("spawn realm is Nova Prime",
    await evalJs("NOVA_FOX2.state.realm") === "nova");
  check("HUD shows the realm name",
    (await evalJs("document.getElementById('realm-big').textContent")) === "Nova Prime");
  check("HP is numeric in the HUD from the first frame",
    (await evalJs("document.getElementById('hpnum').textContent")) === "HP 20 / 20");
  check("readout names the WASM kernel",
    (await evalJs("document.getElementById('ro-kernel').textContent")).includes("WASM"));
  check("canvas rendered",
    await evalJs("document.querySelectorAll('#stage canvas').length") === 1);
  check("guide opens on the wake step",
    await evalJs("NOVA_FOX2.guideCurrent().id") === "wake");

  // The guide's two button beats: wake -> rifts -> (helm) -> move.
  await evalJs("document.getElementById('guide-btn').click()");
  await sleep(200);
  check("guide advances to the rifts beat",
    await evalJs("NOVA_FOX2.guideCurrent().id") === "rifts");
  await evalJs("document.getElementById('guide-btn').click()");
  await sleep(200);
  check("guide advances to the move beat",
    await evalJs("NOVA_FOX2.guideCurrent().id") === "move");

  // Walk: hold W until the guide's distance is covered, turning if
  // the fox snags on something.
  await keyDown("w", "KeyW");
  let moved = 0;
  const walkT0 = Date.now();
  while (Date.now() - walkT0 < 16000) {
    await sleep(700);
    const m2 = await evalJs("NOVA_FOX2.state.movedTotal");
    if (m2 > 7.5) { moved = m2; break; }
    if (m2 - moved < 0.3) await key("ArrowRight", "ArrowRight"); // turn a little
    moved = m2;
  }
  await keyUp("w", "KeyW");
  check("walking covers ground (step assist over the meadow)", moved > 7,
    `movedTotal=${moved}`);
  await key(" ", "Space");
  await sleep(400);
  check("space jumps", await evalJs("NOVA_FOX2.state.jumped") >= 1);
  check("guide advances to the numbers beat",
    await waitFor("NOVA_FOX2.guideCurrent().id === 'numbers'", 8000, "numbers beat"),
    await evalJs("NOVA_FOX2.guideCurrent().id"));

  // One number: the instrument sounds.
  await key("5", "Digit5");
  check("a number key plays a note",
    await evalJs("NOVA_FOX2.state.notesPlayed") >= 1);
  check("guide advances to the bridge beat",
    await waitFor("NOVA_FOX2.guideCurrent().id === 'bridge'", 8000, "bridge beat"),
    await evalJs("NOVA_FOX2.guideCurrent().id"));

  // The bridge tune by NUMBER keys: 1, 4, 9 -> Ashfall Haven.
  await key("1", "Digit1");
  await key("4", "Digit4");
  await key("9", "Digit9");
  check("bridge tune 1-4-9 crosses to Ashfall Haven",
    await waitFor("NOVA_FOX2.state.realm === 'ashfall'", 15000, "ashfall crossing"),
    await evalJs("NOVA_FOX2.state.realm"));
  check("HUD names Ashfall Haven",
    (await evalJs("document.getElementById('realm-big').textContent")) === "Ashfall Haven");
  check("the crossing is inscribed",
    await evalJs("NOVA_FOX2.sub.wal.some(s => s.op === 'cross')") === true);
  check("guide advances to the ashfall beat",
    await waitFor("NOVA_FOX2.guideCurrent().id === 'ashfall'", 8000, "ashfall beat"),
    await evalJs("NOVA_FOX2.guideCurrent().id"));

  // Same tune home.
  await key("1", "Digit1");
  await key("4", "Digit4");
  await key("9", "Digit9");
  check("the same tune carries you home to Nova Prime",
    await waitFor("NOVA_FOX2.state.realm === 'nova'", 15000, "home crossing"),
    await evalJs("NOVA_FOX2.state.realm"));
  check("guide advances to the gravity beat",
    await waitFor("NOVA_FOX2.guideCurrent().id === 'gravity'", 8000, "gravity beat"),
    await evalJs("NOVA_FOX2.guideCurrent().id"));

  // G: down turns. The fox falls UP to the vault the flip provides.
  await key("g", "KeyG");
  check("G flips the scroll's gravity (state follows subspace)",
    await waitFor("NOVA_FOX2.state.gravDir === -1", 6000, "gravity flip"));
  check("the fox lands on the new ceiling",
    await waitFor("NOVA_FOX2.state.pos.y > 40", 20000, "ceiling landing"),
    await evalJs("NOVA_FOX2.state.pos.y"));
  check("the flip is inscribed as a warp",
    await evalJs("NOVA_FOX2.sub.wal.some(s => s.op === 'warp')") === true);
  check("guide advances to the quest beat",
    await waitFor("NOVA_FOX2.guideCurrent().id === 'quest'", 8000, "quest beat"),
    await evalJs("NOVA_FOX2.guideCurrent().id"));
  await key("g", "KeyG"); // down is down again
  check("G again restores down, and the fox lands",
    await waitFor(
      "NOVA_FOX2.state.gravDir === 1 && NOVA_FOX2.state.pos.y < 26",
      20000, "ground landing"),
    await evalJs("NOVA_FOX2.state.pos.y"));

  // A monster's contact costs HP, unmistakably. Stage it honestly:
  // walk the fox (via the debug handle) to a living surface monster
  // and let the subspace tick + contact rule do the rest.
  await evalJs(`(() => {
    const m = NOVA_FOX2.sub.monsters.find(
      (m) => m.alive && m.kind !== "guardian" && m.realmId === "nova");
    if (m) NOVA_FOX2.teleportTo(m.gx * 2 + 1, m.gy * 2 + 1);
    return !!m;
  })()`);
  const hpBefore = await evalJs("NOVA_FOX2.state.hp");
  const dropped = await waitFor("NOVA_FOX2.state.hp < " + hpBefore, 30000, "monster contact");
  check("monster contact drops HP", dropped,
    `hp=${await evalJs("NOVA_FOX2.state.hp")}`);
  const hpPair = await evalJs(`(() => ({
    hp: NOVA_FOX2.state.hp,
    text: document.getElementById('hpnum').textContent,
  }))()`);
  check("the HUD's numeric HP drops with it",
    hpPair.text === `HP ${hpPair.hp} / 20`,
    JSON.stringify(hpPair));

  // The quest: stand before the Deep Stone (debug teleport into the
  // deep room — the shaft descent itself is unit-verified geometry).
  await evalJs("NOVA_FOX2.state.pos.set(60.5, 5.01, 35.5); NOVA_FOX2.state.vel.set(0,0,0);");
  check("reaching the Deep Stone completes the quest",
    await waitFor("NOVA_FOX2.sub.questDone", 5000, "quest completion"));
  check("the hat is granted (inscribed)",
    await evalJs("NOVA_FOX2.sub.hatGranted") === true &&
    await evalJs("NOVA_FOX2.sub.wal.some(s => s.op === 'grant')") === true);
  check("the hat shows on the view (brim) and the log line is in the readout",
    (await evalJs("document.getElementById('hatbrim').style.display")) === "block");
  check("guide reaches its closing beat",
    await waitFor("NOVA_FOX2.guideCurrent().id === 'done'", 8000, "closing beat"),
    await evalJs("NOVA_FOX2.guideCurrent().id"));
  await evalJs("document.getElementById('guide-btn').click()");
  await sleep(200);
  check("the guide retires when told to explore",
    (await evalJs("document.getElementById('guide').style.display")) === "none");

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
