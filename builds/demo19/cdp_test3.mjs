// Nova Fox demo3 — end-to-end playtest of the SHIPPED index.html in
// headless Chrome over CDP. Drives the real input path (keyboard and
// mouse events through the page's own handlers) along the v5
// fresh-player path the re-sequenced guide guarantees:
//   boot under the phext logo panel (bypass it) -> wake/rifts ->
//   walk + jump -> the instrument (one number) -> the bridge tune
//   crosses to Ashfall and home -> the hand-over: Emise goes quiet
//   -> the fight surfaces just in time at the wisp (two strikes,
//   the Star Lance) -> the mark beat: a grand brush shapes the
//   ground through -> gravity surfaces (G flips, ceiling, back) ->
//   the gesture beat: a drawn triangle crosses -> a repeated-digit
//   tune (2-2-2) opens its rift -> a shift-drag plays the flute ->
//   a monster's contact drops HP and sounds the noise cue -> the
//   Deep Stone completes the quest -> the board -> the Arrival
//   memory screen opens the intro film -> zero console errors.
// Run: node cdp_test3.mjs   (exits non-zero on any failure)
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = "/opt/meta-chromium/chrome";
const PORT = 9349; // demo19's private port — the shared 9335 cross-navigates sibling suites
const URL = "file:///home/hatch/workspace/nova-fox/demo19/index.html";

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "novafox3-cdp-"));
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
// Playtest 1: a played tune OPENS a rift a few steps ahead instead
// of teleporting — the crossing happens by walking through it. Hold
// W long enough to reach and pass the ring (harness rendering is
// slow; the fox's effective pace here is well under real-time).
async function walkThroughRift(ms = 6000) {
  await keyDown("w", "KeyW");
  await sleep(ms);
  await keyUp("w", "KeyW");
}
async function mouse(type, x, y, button, buttons, modifiers = 0) {
  await send("Input.dispatchMouseEvent", {
    type, x, y, button: button || "none", buttons: buttons || 0,
    clickCount: 1, modifiers,
  });
}
// Touch (2026-11-26 pass): real touch events through the same CDP
// input path. touchEnd releases every point (empty list).
async function touchEv(type, points) {
  await send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map(([x, y], i) => ({
      x, y, id: i + 1, radiusX: 6, radiusY: 6, force: 1,
    })),
  });
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
    try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
  }
  check("page boots, NOVA_FOX3 handle present", booted);
  await sleep(800);

  check("WASM core live in page",
    await evalJs("NOVA_FOX3.kernels.usingWasm") === true);
  check("spawn realm is Nova Prime",
    await evalJs("NOVA_FOX3.state.realm") === "nova");
  // Realm palettes (feedback #27): exactly ten in the table, home
  // wears palette v4 at boot, and applying a realm's palette puts
  // that realm's fog on the scene.
  check("the palette table has exactly 10 entries (feedback #27)",
    await evalJs("Object.keys(NOVA_FOX3.palettes()).length") === 10);
  check("home at boot wears palette v4 (ocean fog, Tron cyan)",
    await evalJs("NOVA_FOX3.paletteNow().applied") === "nova" &&
    await evalJs("NOVA_FOX3.paletteNow().fog") === 0x020814 &&
    await evalJs("NOVA_FOX3.homePalette().accent") === 0x00d9ff);
  check("applying a realm's palette dresses the scene in it",
    await evalJs("NOVA_FOX3.applyPalette('logos'), NOVA_FOX3.paletteNow().fog") ===
      await evalJs("NOVA_FOX3.palettes().logos.fog") &&
    await evalJs("NOVA_FOX3.paletteNow().applied") === "logos" &&
    await evalJs("NOVA_FOX3.applyPalette('plain'), NOVA_FOX3.paletteNow().fog") ===
      await evalJs("NOVA_FOX3.palettes().plain.fog"));
  await evalJs("NOVA_FOX3.applyPalette('nova')");
  check("home's palette restores cleanly",
    await evalJs("NOVA_FOX3.paletteNow().fog") === 0x020814);
  check("HP is numeric in the HUD from the first frame",
    (await evalJs("document.getElementById('hpnum').textContent")) === "HP 20 / 20");
  check("the ward holds at spawn (feedback #4)",
    await evalJs("NOVA_FOX3.isWarded()") === true &&
    (await evalJs("document.getElementById('wardline').style.display")) === "block");
  check("narration is embedded: all 27 beats ready",
    await evalJs("Object.keys(NOVA_FOX3.narration.manifest()).length") === 27 &&
    await evalJs("NOVA_FOX3.narration.ready('N-01') && NOVA_FOX3.narration.ready('BEAT-quest')"));
  check("the save state is labeled in the HUD (waiting or saving, never silent)",
    (await evalJs("document.getElementById('syncline').textContent")).includes("marks"));
  check("score line is in the HUD",
    (await evalJs("document.getElementById('scoreline').textContent")).includes("score"));
  check("guide opens on the wake step",
    await evalJs("NOVA_FOX3.guideCurrent().id") === "wake");
  check("narration queues the wake beat while playback is locked (no gesture yet)",
    await evalJs("NOVA_FOX3.narration.state().pending.includes('N-01')") === true);

  // SCHEME PIN (demo19): first play now resolves the scheme by coin
  // flip when nothing is stored (Will's ruling, 2026-11-26 15:07),
  // and this suite's later legs are written against WASD (F strikes
  // there; in AWEF it walks backward). Pin the stored preference and
  // reload onto a deterministic boot; the preference machinery
  // itself is exercised by cdp_scheme_test.mjs.
  await evalJs("localStorage.setItem('nf.scheme', 'wasd')");
  await send("Page.reload");
  {
    let rebooted = false;
    for (let i = 0; i < 60 && !rebooted; i++) {
      await sleep(250);
      try { rebooted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
    }
    check("the pinned boot returns", rebooted);
    await sleep(800);
  }
  check("the stored preference resolves to WASD on reload (demo19)",
    await evalJs("NOVA_FOX3.state.scheme") === "WASD" &&
    await evalJs("localStorage.getItem('nf.scheme')") === "wasd");

  // THE LOAD PANEL (v5, feedback #15): the phext logo panel is the
  // first thing on the page, and any click steps it aside.
  check("the phext logo panel is up first (feedback #15)",
    await evalJs("NOVA_FOX3.state.splash") === true &&
    (await evalJs("getComputedStyle(document.getElementById('splash')).display")) === "flex");
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(200);
  check("the bypass steps the panel aside",
    await evalJs("NOVA_FOX3.state.splash") === false &&
    (await evalJs("document.getElementById('splash').style.display")) === "none");

  // CONTROL SCHEMES (v5, feedback #5; preference demo19): the keys
  // button flips WASD <-> AWEF and the choice persists on this
  // machine — in the controls record and in nf.scheme alike.
  await evalJs("document.getElementById('btn-keys').click()");
  check("the keys button switches to AWEF and persists it",
    await evalJs("NOVA_FOX3.state.scheme") === "AWEF" &&
    await evalJs("JSON.parse(localStorage.getItem('nova-phox-controls')).scheme") === "AWEF" &&
    await evalJs("localStorage.getItem('nf.scheme')") === "awef");
  await evalJs("document.getElementById('btn-keys').click()");
  check("and back to WASD",
    await evalJs("NOVA_FOX3.state.scheme") === "WASD" &&
    await evalJs("localStorage.getItem('nf.scheme')") === "wasd");

  // THE LAMP (v5, feedback #12): V toggles the fox's own light.
  await key("v", "KeyV");
  check("V lights the lamp", await evalJs("NOVA_FOX3.state.lamp") === true);
  await key("v", "KeyV");
  check("V douses it", await evalJs("NOVA_FOX3.state.lamp") === false);

  await evalJs("document.getElementById('guide-btn').click()");
  await sleep(200);
  check("guide advances to the rifts beat",
    await evalJs("NOVA_FOX3.guideCurrent().id") === "rifts");
  await evalJs("document.getElementById('guide-btn').click()");
  await sleep(200);
  check("guide advances to the move beat",
    await evalJs("NOVA_FOX3.guideCurrent().id") === "move");

  // Walk + jump (the move beat), as in v2.
  await keyDown("w", "KeyW");
  // NARRATION, ACTUALLY HEARD: the keydown is the first real gesture,
  // so the locked queue drains and the wake beat (N-01) must reach a
  // playing state — element unpaused, playback clock advancing.
  check("the first gesture unlocks narration and the wake beat plays",
    await waitFor("(() => { const s = NOVA_FOX3.narration.state(); " +
      "return s.speaking === 'N-01' && !s.paused && s.currentTime > 0.2; })()",
      8000, "wake beat playing"));
  const ctA = await evalJs("NOVA_FOX3.narration.state().currentTime");
  await sleep(600);
  const ctB = await evalJs("NOVA_FOX3.narration.state().currentTime");
  check("the wake beat's playback clock advances", ctB > ctA, `${ctA} -> ${ctB}`);
  // NARRATION QUEUE DISCIPLINE (EE 178 — the chop fix): a beat fired
  // while the voice is speaking must WAIT, not interrupt.
  check("later guide beats queue behind the wake beat instead of chopping it",
    await evalJs("NOVA_FOX3.narration.state().speaking") === "N-01" &&
    await evalJs("NOVA_FOX3.narration.state().pending.includes('N-02')"));
  check("a duplicate trigger for a queued beat is dropped",
    await evalJs("NOVA_FOX3.narration.play('N-02')") === false &&
    await evalJs("NOVA_FOX3.narration.state().pending.filter(x => x === 'N-02').length") === 1);
  let moved = 0;
  const walkT0 = Date.now();
  while (Date.now() - walkT0 < 16000) {
    await sleep(700);
    const m2 = await evalJs("NOVA_FOX3.state.movedTotal");
    if (m2 > 7.5) { moved = m2; break; }
    if (m2 - moved < 0.3) await key("ArrowRight", "ArrowRight");
    moved = m2;
  }
  await keyUp("w", "KeyW");
  check("walking covers ground (step assist over the meadow)", moved > 7,
    `movedTotal=${moved}`);
  await key(" ", "Space");
  check("space jumps, and the first jump lands under the ward",
    await waitFor("NOVA_FOX3.state.jumped >= 1 && NOVA_FOX3.state.firstJumpDone", 8000, "first jump landing"),
    `jumped=${await evalJs("NOVA_FOX3.state.jumped")} done=${await evalJs("NOVA_FOX3.state.firstJumpDone")}`);
  // v5 (feedback #19): the crossing is taught BEFORE the fight —
  // after the move beat comes the instrument, not the wisp.
  check("guide advances to the numbers beat (crossing taught first)",
    await waitFor("NOVA_FOX3.guideCurrent().id === 'numbers'", 8000, "numbers beat"),
    await evalJs("NOVA_FOX3.guideCurrent().id"));
  check("the wake beat plays to its end, first in the ended list",
    await waitFor("NOVA_FOX3.narration.state().ended.includes('N-01')", 45000, "wake beat ending") &&
    await evalJs("NOVA_FOX3.narration.state().ended[0]") === "N-01");

  // THE INSTRUMENT: one number, then the bridge tune by number keys.
  await key("5", "Digit5");
  check("a number key plays a note",
    await evalJs("NOVA_FOX3.state.notesPlayed") >= 1);
  check("guide advances to the bridge beat",
    await waitFor("NOVA_FOX3.guideCurrent().id === 'bridge'", 8000, "bridge beat"),
    await evalJs("NOVA_FOX3.guideCurrent().id"));

  // Portal views (feedback #27): a marker wisp is placed ONLY in
  // Ashfall, ahead of its Arrival along the fox's heading — before
  // the tune is played, so the far view is built with it standing
  // there. Through the rift we should see it; with it gone, not.
  await evalJs(`(() => {
    const yaw = NOVA_FOX3.state.yaw;
    const bx = 8 + Math.round(-Math.sin(yaw) * 7);
    const bz = 8 + Math.round(-Math.cos(yaw) * 7);
    const m = NOVA_FOX3.sub.spawnMonster("ashfall",
      Math.floor(bx / 2), Math.floor(bz / 2), "wisp");
    window.__markerId = m.id;
    return m.id;
  })()`);
  await key("1", "Digit1");
  await key("4", "Digit4");
  await key("9", "Digit9");
  check("the bridge tune opens a rift — it does not jump-cut",
    await evalJs("!!NOVA_FOX3.state.rift") === true &&
    await evalJs("NOVA_FOX3.state.realm") === "nova");
  check("the rift carries a live view of the far side (feedback #27)",
    await evalJs("NOVA_FOX3.portalState().viewOk") === true &&
    await evalJs("NOVA_FOX3.portalState().destRealm") === "ashfall" &&
    await evalJs("NOVA_FOX3.portalState().renders") >= 1);
  const pxWith = await evalJs("NOVA_FOX3.portalPixels()");
  await evalJs("NOVA_FOX3.sub.monsters.find((m) => m.id === window.__markerId).alive = false");
  const pxWithout = await evalJs("NOVA_FOX3.portalPixels()");
  check("the portal view renders a real place, not an empty target",
    pxWith && pxWith.nonFog > 1000, JSON.stringify(pxWith));
  check("a thing standing only in the far realm is visible through the rift",
    pxWith && pxWithout && pxWith.paleCool > pxWithout.paleCool + 30,
    `with=${pxWith && pxWith.paleCool} without=${pxWithout && pxWithout.paleCool}`);
  await walkThroughRift();
  check("walking through the rift crosses to Ashfall Haven",
    await waitFor("NOVA_FOX3.state.realm === 'ashfall'", 15000, "ashfall crossing"),
    await evalJs("NOVA_FOX3.state.realm"));
  check("crossing applies Ashfall's own palette (feedback #27)",
    await evalJs("NOVA_FOX3.paletteNow().applied") === "ashfall" &&
    await evalJs("NOVA_FOX3.paletteNow().fog") ===
      await evalJs("NOVA_FOX3.palettes().ashfall.fog"));
  // The Swift Charm waits by Ashfall's Arrival.
  await evalJs("NOVA_FOX3.teleportTo(13, 11)");
  check("the Swift Charm is taken up in Ashfall",
    await waitFor("NOVA_FOX3.state.charms.swift === true", 6000, "swift pickup"));
  check("guide advances to the ashfall beat",
    await waitFor("NOVA_FOX3.guideCurrent().id === 'ashfall'", 8000, "ashfall beat"),
    await evalJs("NOVA_FOX3.guideCurrent().id"));
  await key("1", "Digit1");
  await key("4", "Digit4");
  await key("9", "Digit9");
  await walkThroughRift();
  check("the same tune's rift carries you home to Nova Prime",
    await waitFor("NOVA_FOX3.state.realm === 'nova'", 15000, "home crossing"),
    await evalJs("NOVA_FOX3.state.realm"));
  check("guide reaches the hand-over (the taught loop is complete)",
    await waitFor("NOVA_FOX3.guideCurrent().id === 'handover'", 8000, "handover beat"),
    await evalJs("NOVA_FOX3.guideCurrent().id"));
  await evalJs("document.getElementById('guide-btn').click()");
  await sleep(300);
  check("after the hand-over the guide waits on the fight, panel out of the way",
    await evalJs("NOVA_FOX3.guideCurrent().id") === "fight");

  // THE FIGHT BEAT, just in time: it surfaces when the fox comes
  // near a thing of the dark. Face the wisp, strike it with F.
  await evalJs(`(() => {
    const m = NOVA_FOX3.sub.monsters.find((m) => m.kind === "wisp");
    NOVA_FOX3.teleportTo(m.gx * 2 - 1, m.gy * 2 + 1);
    const dx = (m.gx * 2 + 1.5) - NOVA_FOX3.state.pos.x;
    const dz = (m.gy * 2 + 1.5) - NOVA_FOX3.state.pos.z;
    NOVA_FOX3.state.yaw = Math.atan2(-dx, -dz);
    NOVA_FOX3.state.pitch = 0;
    return true;
  })()`);
  check("the fight beat surfaces when its moment comes",
    await waitFor("document.getElementById('guide').style.display === 'block'", 8000, "fight surfacing"));
  await sleep(600);
  check("the wisp gets its featured introduction (feedback #8)",
    await waitFor("NOVA_FOX3.state.introduced.has('wisp')", 6000, "wisp intro"),
    await evalJs("[...NOVA_FOX3.state.introduced].join(',')"));
  await key("f", "KeyF");
  await sleep(350);
  check("first strike lands and the wisp holds (hp 2 -> 1)",
    await evalJs("NOVA_FOX3.sub.monsters.find(m => m.kind === 'wisp').hp") === 1);
  await key("f", "KeyF");
  check("second strike writes the wisp out",
    await waitFor("NOVA_FOX3.state.wispKills >= 1", 6000, "wisp kill"));
  check("the kill is a scar in the log (a mark that stays)",
    await evalJs("NOVA_FOX3.sub.wal.some(s => s.op === 'scar')") === true);
  check("guide advances to the mark beat (the mark that stays, staged)",
    await waitFor("NOVA_FOX3.guideCurrent().id === 'mark'", 8000, "mark beat"),
    await evalJs("NOVA_FOX3.guideCurrent().id"));
  // THE MARK (prime directive, experience 2): with the grand brush
  // (v5, feedback #4) three strokes shape a whole volume through —
  // the break count proves the brush, not just the chisel.
  await evalJs("NOVA_FOX3.setBrush(3)");
  await evalJs("NOVA_FOX3.state.pitch = -1.15;");
  await sleep(300);
  await key("c", "KeyC");
  await sleep(500);
  await key("c", "KeyC");
  await sleep(500);
  await key("c", "KeyC");
  check("the grand brush breaks a volume through — marks of your own, written",
    await waitFor("NOVA_FOX3.sub.wal.filter(s => s.op === 'break').length >= 4", 8000, "brush breaks"),
    await evalJs("String(NOVA_FOX3.sub.wal.filter(s => s.op === 'break').length)"));
  await evalJs("NOVA_FOX3.setBrush(0)");
  await evalJs("NOVA_FOX3.state.pitch = -0.05;");
  // The Star Lance (feedback #9): the fight beat's own coda — taken
  // up after the practice kill, as the guide's text tells it.
  await evalJs("NOVA_FOX3.teleportTo(15, 12)");
  check("the Star Lance is taken up",
    await waitFor("NOVA_FOX3.state.weapon === 'lance'", 6000, "lance pickup"));
  check("the taking is inscribed",
    await evalJs("NOVA_FOX3.sub.wal.some(s => s.op === 'pickup')") === true);
  check("guide advances to the gravity beat (its moment: a mark exists)",
    await waitFor("NOVA_FOX3.guideCurrent().id === 'gravity'", 8000, "gravity beat"),
    await evalJs("NOVA_FOX3.guideCurrent().id"));

  // G: down turns, the fox lands on the vault, G again restores.
  await key("g", "KeyG");
  check("G flips the realm's gravity (per-world memory, feedback #25)",
    await waitFor("NOVA_FOX3.state.gravDir === -1", 6000, "gravity flip"));
  check("the fox lands on the new ceiling",
    await waitFor("NOVA_FOX3.state.pos.y > 40", 20000, "ceiling landing"),
    await evalJs("NOVA_FOX3.state.pos.y"));
  check("guide advances to the gesture beat",
    await waitFor("NOVA_FOX3.guideCurrent().id === 'gesture'", 8000, "gesture beat"),
    await evalJs("NOVA_FOX3.guideCurrent().id"));
  await key("g", "KeyG");
  check("G again restores down, and the fox lands",
    await waitFor(
      "NOVA_FOX3.state.gravDir === 1 && NOVA_FOX3.state.pos.y < 26",
      20000, "ground landing"),
    await evalJs("NOVA_FOX3.state.pos.y"));

  // THE GESTURE (feedback #5): a right-mouse triangle, drawn with
  // real mouse events (pointer-lock-free path).
  const triVerts = [[300, 420], [460, 220], [620, 420], [300, 420]];
  const tri = [];
  for (let v = 0; v < triVerts.length - 1; v++) {
    const [x0, y0] = triVerts[v], [x1, y1] = triVerts[v + 1];
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      tri.push([x0 + (x1 - x0) * (i / steps), y0 + (y1 - y0) * (i / steps)]);
    }
  }
  tri.push(triVerts[triVerts.length - 1]);
  await mouse("mousePressed", tri[0][0], tri[0][1], "right", 2);
  for (const [x, y] of tri.slice(1)) {
    await mouse("mouseMoved", x, y, "none", 2);
    await sleep(16);
  }
  await mouse("mouseReleased", tri[tri.length - 1][0], tri[tri.length - 1][1], "right", 0);
  check("a drawn triangle opens the bridge rift (drawn, not keyed)",
    await evalJs("!!NOVA_FOX3.state.rift") === true);
  await walkThroughRift();
  check("walking through the drawn rift crosses the realm",
    await waitFor("NOVA_FOX3.state.realm === 'ashfall'", 15000, "gesture crossing"),
    await evalJs("NOVA_FOX3.state.realm"));
  check("the gesture is marked used",
    await evalJs("NOVA_FOX3.state.gestureUsed") === true);
  check("guide advances to the quest beat (every verb in hand)",
    await waitFor("NOVA_FOX3.guideCurrent().id === 'quest'", 8000, "quest beat"),
    await evalJs("NOVA_FOX3.guideCurrent().id"));
  await key("1", "Digit1");
  await key("4", "Digit4");
  await key("9", "Digit9");
  await walkThroughRift();
  check("keys still cross home after the gesture (through the rift)",
    await waitFor("NOVA_FOX3.state.realm === 'nova'", 15000, "home again"),
    await evalJs("NOVA_FOX3.state.realm"));

  // THE DOOR STANDS (Will, 2026-11-24): a rift is one door with
  // two ends — it stays open while you are in range (no clock),
  // the SAME door takes you back, it folds when you wander
  // beyond its reach, and things of the dark near the ring are
  // carried across with you. (The fox is made invulnerable for
  // this section only: carrying is what is under test here;
  // combat has its own checks below.)
  await evalJs("NOVA_FOX3.state.invulnUntil = performance.now() + 120000");
  await key("1", "Digit1");
  await key("4", "Digit4");
  await key("9", "Digit9");
  check("the bridge rift opens as a standing link",
    await waitFor("NOVA_FOX3.portalState().open", 6000, "link opens"));
  const linkId = await evalJs("NOVA_FOX3.portalState().linkId");
  // THE DOOR'S FORM IS ITS JUMP (Will, 2026-11-24 — Leg A): the
  // standing bridge door spans Nova Prime → Ashfall Haven in
  // subspace — CYOA's entry scroll to the corridor's first step —
  // and its ring is sized and faceted by that very difference.
  check("the standing door reports its subspace span: entry to corridor, 18",
    await evalJs("NOVA_FOX3.portalState().distance") === 18 &&
    JSON.stringify(await evalJs("NOVA_FOX3.portalState().delta")) ===
      JSON.stringify([9, 9, 0, 0, 0, 0, 0, 9, 9]));
  check("the bridge ring is sized and faceted by its jump (~1.557, 36 facets)",
    Math.abs((await evalJs("NOVA_FOX3.portalState().ringRadius")) - 1.5571) < 0.001 &&
    await evalJs("NOVA_FOX3.portalState().ringSegments") === 36);
  check("ring geometry tracks the difference: near pair smaller, far pair larger",
    await evalJs(`(() => {
      const near = NOVA_FOX3.riftGeometry("orchid", "halycon");
      const bridge = NOVA_FOX3.riftGeometry("nova", "ashfall");
      const far = NOVA_FOX3.riftGeometry("willow", "orchid");
      return near.distance === 1 && far.distance > 89 &&
        near.radius < bridge.radius && bridge.radius < far.radius;
    })()`) === true);
  const carryIds = await evalJs(`(() => {
    const r = NOVA_FOX3.state.rift;
    const near = NOVA_FOX3.sub.spawnMonster("nova",
      Math.floor((r.x + 1.5) / 2), Math.floor(r.z / 2), "surface");
    const far = NOVA_FOX3.sub.spawnMonster("nova", 55, 55, "surface");
    return { near: near && near.id, far: far && far.id };
  })()`);
  await sleep(26000); // the old rift folded, uncrossed, at ~25 s
  check("the door outlives the old 25-second fold — it stands in range",
    await evalJs("NOVA_FOX3.portalState().open") === true &&
    await evalJs("NOVA_FOX3.portalState().linkId") === linkId);
  await walkThroughRift();
  check("crossing through the standing door reaches Ashfall",
    await waitFor("NOVA_FOX3.state.realm === 'ashfall'", 15000, "link crossing"),
    await evalJs("NOVA_FOX3.state.realm"));
  check("the door still stands on the far side — the same link",
    await evalJs("NOVA_FOX3.portalState().open") === true &&
    await evalJs("NOVA_FOX3.portalState().linkId") === linkId &&
    await evalJs("NOVA_FOX3.portalState().end") === "b");
  check("the near monster crossed and now lives in Ashfall, Nova-born",
    await evalJs(`(() => { const m = NOVA_FOX3.sub.monsters.find(m => m.id === ${carryIds.near});
      return !!m && m.realmId === "ashfall" && m.nativeRealmId === "nova"; })()`) === true);
  check("the far monster stayed home",
    await evalJs(`(() => { const m = NOVA_FOX3.sub.monsters.find(m => m.id === ${carryIds.far});
      return !!m && m.realmId === "nova"; })()`) === true);
  await evalJs("NOVA_FOX3.state.yaw += Math.PI"); // the door is at your back — turn for it
  await walkThroughRift();
  check("the same door takes you home — no tune replayed",
    await waitFor("NOVA_FOX3.state.realm === 'nova'", 15000, "link return"),
    await evalJs("NOVA_FOX3.state.realm"));
  check("one link, two crossings",
    await evalJs("NOVA_FOX3.portalState().linkId") === linkId &&
    await evalJs("NOVA_FOX3.portalState().crosses") === 2);
  await evalJs("NOVA_FOX3.teleportTo(120, 120)");
  check("out of range, the rift folds",
    await waitFor("!NOVA_FOX3.portalState().open", 8000, "range fold"));
  await evalJs("NOVA_FOX3.teleportTo(9, 9)");
  await evalJs("NOVA_FOX3.state.invulnUntil = 0");

  // REPEATED DIGITS (v5, feedback #9): 2-2-2 is a valid tune.
  await key("2", "Digit2");
  await key("2", "Digit2");
  await key("2", "Digit2");
  check("the tune 2-2-2 opens its rift (repeats are valid)",
    await waitFor("!!NOVA_FOX3.state.rift", 6000, "2-2-2 rift"));
  check("a pocket rift also carries a live view of its far page (feedback #27)",
    await evalJs("NOVA_FOX3.portalState().viewOk") === true &&
    await evalJs("NOVA_FOX3.portalState().targetType") === "pocket" &&
    await evalJs("NOVA_FOX3.portalState().renders") >= 1);
  check("a pocket door spans no subspace distance — the smallest ring stands",
    await evalJs("NOVA_FOX3.portalState().distance") === 0 &&
    await evalJs("NOVA_FOX3.portalState().ringRadius") === 1);

  // THE SPECTRAL FLUTE (v5, feedback #6): shift-drag across the
  // canvas sounds notes — drag up, the pitch climbs.
  const notesBeforeFlute = await evalJs("NOVA_FOX3.state.notesPlayed");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Shift", code: "ShiftLeft", modifiers: 8 });
  // (The drag lives in the canvas strip above the guide panel —
  // the only part of the window the canvas itself receives. The
  // strip's height depends on the current guide step's text, so
  // find the canvas by probing, not by assuming a coordinate.)
  const fluteY = await evalJs(`(() => {
    for (const y of [84, 64, 104, 44, 124]) {
      const el = document.elementFromPoint(400, y);
      if (el && el.tagName === "CANVAS") return y;
    }
    return 0;
  })()`);
  await mouse("mousePressed", 400, fluteY, "left", 1, 8);
  const fluteSteps = Math.max(3, Math.floor((fluteY - 12) / 18));
  for (let i = 1; i <= fluteSteps; i++) {
    await mouse("mouseMoved", 400, fluteY - i * 18, "none", 1, 8);
    await sleep(60);
  }
  await mouse("mouseReleased", 400, Math.max(4, fluteY - fluteSteps * 18), "left", 0, 8);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Shift", code: "ShiftLeft" });
  check("a shift-drag plays the flute (notes sound)",
    (await evalJs("NOVA_FOX3.state.notesPlayed")) >= notesBeforeFlute + 2,
    `before=${notesBeforeFlute} after=${await evalJs("NOVA_FOX3.state.notesPlayed")}`);

  // A monster's contact costs HP — outside the ward, after the first
  // jump, exactly the danger the fight beat prepared for. Its kind
  // must have been FEATURED first (feedback #8). And v5: the landed
  // hit sounds the synthesized contact noise (feedback #24).
  await evalJs(`(() => {
    const a = { x: 8.5, z: 8.5 };
    const m = NOVA_FOX3.sub.monsters.find(
      (m) => m.alive && m.kind === "surface" && m.realmId === "nova" &&
        Math.hypot(m.gx * 2 + 1 - a.x, m.gy * 2 + 1 - a.z) > 18);
    if (m) NOVA_FOX3.teleportTo(m.gx * 2 + 1, m.gy * 2 + 1);
    return !!m;
  })()`);
  const noisesBefore = await evalJs("NOVA_FOX3.sfxStats().contactNoises");
  const hpBefore = await evalJs("NOVA_FOX3.state.hp");
  const dropped = await waitFor("NOVA_FOX3.state.hp < " + hpBefore, 30000, "monster contact");
  check("monster contact drops HP (outside the ward)", dropped,
    `hp=${await evalJs("NOVA_FOX3.state.hp")}`);
  check("the landed hit sounds the contact noise, not a voice (feedback #24)",
    (await evalJs("NOVA_FOX3.sfxStats().contactNoises")) > noisesBefore);
  check("the surface kind was featured before it could hurt (intro)",
    await evalJs("NOVA_FOX3.state.introduced.has('surface')") === true);
  const hpPair = await evalJs(`(() => ({
    hp: NOVA_FOX3.state.hp,
    text: document.getElementById('hpnum').textContent,
  }))()`);
  check("the HUD's numeric HP drops with it",
    hpPair.text === `HP ${hpPair.hp} / 20`, JSON.stringify(hpPair));

  // The quest: the Deep Stone (debug teleport into the deep room —
  // the shaft descent itself is unit-verified geometry).
  await evalJs("NOVA_FOX3.state.pos.set(60.5, 5.01, 35.5); NOVA_FOX3.state.vel.set(0,0,0);");
  check("reaching the Deep Stone completes the quest",
    await waitFor("NOVA_FOX3.sub.questDone", 5000, "quest completion"));
  check("the hat is granted (inscribed)",
    await evalJs("NOVA_FOX3.sub.hatGranted") === true &&
    await evalJs("NOVA_FOX3.sub.wal.some(s => s.op === 'grant')") === true);
  check("the quest fanfare is a chip melody (feedback #13)",
    (await evalJs("NOVA_FOX3.sfxStats().melodies")) >= 1);
  check("guide reaches its closing beat",
    await waitFor("NOVA_FOX3.guideCurrent().id === 'done'", 8000, "closing beat"),
    await evalJs("NOVA_FOX3.guideCurrent().id"));

  // THE BOARD: your own row, honestly labeled sync state.
  await key("b", "KeyB");
  await sleep(400);
  check("the board opens (B) and shows your own standing",
    (await evalJs("document.getElementById('board').style.display")) === "block" &&
    (await evalJs("document.getElementById('board-alltime').textContent")).includes("(you)"));
  check("the board states the shared chart's status plainly",
    (await evalJs("document.getElementById('board-note').textContent")).length > 10);
  check("your score is the log's arithmetic (crossings + scar + pickups + quest)",
    await evalJs("NOVA_FOX3.scoreNow()") >= 1000,
    await evalJs("String(NOVA_FOX3.scoreNow())"));
  // THE ECONOMY (demo4): a fresh fox is free, the purse renders,
  // and an hour of active play drips flux into it (P1).
  check("economy: a fresh fox plays free, purse empty",
    await evalJs("(() => { const e = NOVA_FOX3.ecoState(); " +
      "return e.entitlement.status === 'free' && e.tokens === 0 && e.credits === 0; })()") === true);
  check("economy: the board carries the written record and the purse",
    (await evalJs("document.getElementById('board-purchases').textContent")).length > 0 &&
    (await evalJs("document.getElementById('eco-balances').textContent")).includes("flux"));
  check("economy: an hour of play drips 20 flux into the purse",
    await evalJs("(() => { const e = NOVA_FOX3.ecoAccrue(3600); return e.tokens; })()") === 20);
  check("economy: the purse shows on the inventory line",
    (await evalJs("document.getElementById('invline').textContent")).includes("flux"));
  // THE LADDER SHOP (demo5): the board carries the ladder — Beat 1
  // buyable, Beat 2 named and priced but not on this shelf — and a
  // real purchase through the panel's own button charges once.
  check("ladder: the shop renders Beat 1 rungs and names the Christmas bands",
    (await evalJs("document.getElementById('board-shop').textContent")).includes("Keepsake Tune Pip") &&
    (await evalJs("document.getElementById('board-shop').textContent")).includes("Dragonward") &&
    (await evalJs("document.getElementById('board-shop').textContent")).includes("Christmas"));
  await evalJs("NOVA_FOX3.ecoAccrue(90000)"); // 25 more hours of drip: 500 flux
  for (let i = 0; i < 10; i++) await evalJs("document.getElementById('btn-convert').click()");
  check("ladder: ten conversions through the panel mint ten credits",
    await evalJs("NOVA_FOX3.ecoState().credits") === 10);
  await evalJs("document.querySelector('button[data-rung=\"keepsake-tune-pip\"]').click()");
  check("ladder: buying the pip through its button charges 5, once, and records the rung",
    await evalJs("(() => { const e = NOVA_FOX3.ecoState(); " +
      "return e.credits === 5 && !!e.ladder['keepsake-tune-pip'] && " +
      "e.ladder['keepsake-tune-pip'].via === 'bought'; })()") === true);
  check("ladder: an owned rung offers no second buy button",
    await evalJs("document.querySelector('button[data-rung=\"keepsake-tune-pip\"]')") === null);
  check("ladder: a Beat 2 rung is refused through the shop's own path, purse untouched",
    await evalJs("(() => { const r = NOVA_FOX3.ecoBuyRung('dragonward-helm'); " +
      "return r.ok === false && r.reason === 'beat' && NOVA_FOX3.ecoState().credits === 5; })()") === true);
  check("ladder: the save copy carries the ladder",
    await evalJs("(() => { const s = JSON.parse(NOVA_FOX3.saveJson()); " +
      "return !!s.economy.ladder['keepsake-tune-pip']; })()") === true);
  await evalJs("document.getElementById('guide-btn').click()");
  await sleep(200);
  check("the guide retires when told to explore",
    (await evalJs("document.getElementById('guide').style.display")) === "none");

  // THE MEMORY SCREEN (v5, feedback #14): the intro film is in the
  // build, the stone screen stands at Arrival, and opening it wires
  // the player — poster first, click-to-play, closable.
  check("the intro film is embedded in the build",
    await evalJs("NOVA_FOX3.introVideoReady()") === true);
  check("the memory screen stands at Arrival",
    await evalJs("!!NOVA_FOX3.screenPos()") === true);
  await evalJs("NOVA_FOX3.openIntroViewer()");
  await sleep(300);
  check("the viewer opens with the film wired (poster + data src, no preload)",
    (await evalJs("document.getElementById('intro-viewer').style.display")) === "block" &&
    (await evalJs("document.getElementById('intro-video').preload")) === "none" &&
    ((await evalJs("document.getElementById('intro-video').getAttribute('poster')")) || "").startsWith("data:image/png") &&
    ((await evalJs("document.getElementById('intro-video').getAttribute('src')")) || "").startsWith("data:video/mp4"));
  await evalJs("document.getElementById('intro-close').click()");
  await sleep(200);
  check("the viewer closes — the film is skippable",
    (await evalJs("document.getElementById('intro-viewer').style.display")) === "none");

  // THE QUEUE'S HONESTY (v5, UPDATE-CHECK-1): the save copy carries
  // the fold, and the outbox reports its true shape.
  check("the local save is v3 and carries the folded queue and the purse",
    await evalJs("(() => { const s = JSON.parse(NOVA_FOX3.saveJson()); " +
      "return s.version === 3 && Array.isArray(s.folded) && !!s.economy && Array.isArray(s.ecoOutbox); })()") === true);
  check("the outbox state is readable and undistorted",
    await evalJs("(() => { const o = NOVA_FOX3.outboxState(); " +
      "return o.queued >= 0 && o.folded >= 0 && o.dropped === 0; })()") === true);

  // ---- 2026-11-26 pass: clean UI, the unwatched tab, touch --------

  // CLEAN UI (Will, 2026-11-26): "the ui needs to be clean, move
  // all of the distractions to optional components." The default
  // view keeps only what play requires; the rest is one toggle
  // away and nothing is deleted.
  check("clean UI: the key wall is an optional component, off by default",
    await evalJs("getComputedStyle(document.getElementById('help')).display") === "none");
  check("clean UI: the standing realm title is optional, off by default",
    await evalJs("getComputedStyle(document.getElementById('realm-big')).display") === "none");
  check("clean UI: quest, score and sync lines are optional, off by default",
    await evalJs("getComputedStyle(document.getElementById('questline')).display") === "none" &&
    await evalJs("getComputedStyle(document.getElementById('scoreline')).display") === "none" &&
    await evalJs("getComputedStyle(document.getElementById('syncline')).display") === "none");
  check("clean UI: the portrait is optional, off by default",
    await evalJs("getComputedStyle(document.getElementById('portrait')).display") === "none");
  check("clean UI: what play requires stays — hearts, chord, objective, instrument",
    await evalJs("getComputedStyle(document.getElementById('hearts')).display") !== "none" &&
    await evalJs("getComputedStyle(document.getElementById('chord')).display") !== "none" &&
    await evalJs("getComputedStyle(document.getElementById('objective')).display") !== "none" &&
    await evalJs("getComputedStyle(document.getElementById('instrument')).display") !== "none");
  await evalJs("document.getElementById('btn-extras').click()");
  check("clean UI: the extras toggle brings them all back, and the choice persists",
    await evalJs("getComputedStyle(document.getElementById('help')).display") !== "none" &&
    await evalJs("getComputedStyle(document.getElementById('realm-big')).display") !== "none" &&
    await evalJs("getComputedStyle(document.getElementById('scoreline')).display") !== "none" &&
    await evalJs("NOVA_FOX3.extrasState()") === true &&
    await evalJs("JSON.parse(localStorage.getItem('nova-phox-controls')).extras") === true);
  await evalJs("document.getElementById('btn-extras').click()");
  check("clean UI: and the toggle tucks them away again",
    await evalJs("getComputedStyle(document.getElementById('help')).display") === "none" &&
    await evalJs("NOVA_FOX3.extrasState()") === false);

  // THE UNWATCHED TAB (Will, 2026-11-26): "audio should stop when
  // the tab isn't active." The voice's interrupted beat returns to
  // the head of the queue whole and speaks from its start on
  // return; the engine's clock suspends (a stop, not a mute); the
  // film pauses and resumes, because the hold was what paused it.
  // Visibility is driven synthetically — the handler reads
  // document.hidden, so the test shadows it and fires the event.
  const setHidden = async (h) => {
    await evalJs(`(() => {
      Object.defineProperty(document, "hidden",
        { configurable: true, get: () => ${h} });
      document.dispatchEvent(new Event("visibilitychange"));
    })()`);
  };
  // The voice must be at rest before the hold can be observed:
  // whatever the road here left speaking or queued drains first.
  await waitFor("NOVA_FOX3.narration.state().speaking === null && " +
    "NOVA_FOX3.narration.state().pending.length === 0", 90000, "the voice at rest");
  await evalJs("NOVA_FOX3.openIntroViewer()");
  await sleep(300);
  await evalJs("document.getElementById('intro-video').play()");
  check("the film plays for the visibility test",
    await waitFor("!document.getElementById('intro-video').paused", 8000, "film playing"));
  await evalJs("NOVA_FOX3.narration.play('N-03')");
  check("a fresh beat speaks for the visibility test, and gets past its opening",
    await waitFor("NOVA_FOX3.narration.state().speaking === 'N-03' && " +
      "NOVA_FOX3.narration.state().currentTime > 2", 10000, "N-03 well in"),
    JSON.stringify(await evalJs("NOVA_FOX3.narration.state()")));
  await setHidden(true);
  await sleep(250);
  check("hidden tab: the voice holds — the beat is back at the queue's head, whole",
    await evalJs("NOVA_FOX3.narration.state().held") === true &&
    await evalJs("NOVA_FOX3.narration.state().speaking") === null &&
    await evalJs("NOVA_FOX3.narration.state().pending[0]") === "N-03");
  check("hidden tab: the engine's clock is suspended — stopped, not muted",
    await evalJs("NOVA_FOX3.audioState().ctx") === "suspended" &&
    await evalJs("NOVA_FOX3.audioState().heldSuspend") === true);
  check("hidden tab: the film pauses",
    await evalJs("document.getElementById('intro-video').paused") === true);
  await setHidden(false);
  check("return: the held beat speaks again, from its start — not mid-line",
    await waitFor("NOVA_FOX3.narration.state().speaking === 'N-03' && " +
      "NOVA_FOX3.narration.state().currentTime < 1.5", 8000, "N-03 from its start"));
  check("return: the engine's clock runs again",
    await waitFor("NOVA_FOX3.audioState().ctx === 'running'", 5000, "ctx running"));
  check("return: the film resumes — the hold was what paused it",
    await waitFor("!document.getElementById('intro-video').paused", 5000, "film resumed"));
  await evalJs("NOVA_FOX3.closeIntroViewer()");
  await sleep(200);

  // TOUCH (Will, 2026-11-26): "mobile needs a way to play." Every
  // verb, through real touch events: the stick walks, a drag on
  // the world looks, the buttons jump and flip, an armed drag
  // draws and flutes.
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await evalJs("NOVA_FOX3.teleportTo(120, 120)"); // fold any standing rift
  await sleep(400);
  await evalJs("NOVA_FOX3.teleportTo(9, 9)");
  await evalJs("NOVA_FOX3.state.yaw = 0; NOVA_FOX3.state.pitch = 0;");
  await waitFor("NOVA_FOX3.state.onGround", 8000, "grounded for the touch tests");
  const canvasC = await evalJs(`(() => {
    const r = document.querySelector('#stage canvas').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  await touchEv("touchStart", [[canvasC.x, canvasC.y]]);
  await touchEv("touchEnd", []);
  check("touch: the first touch raises the touch controls",
    await evalJs("NOVA_FOX3.touchState().touch") === true &&
    await evalJs("getComputedStyle(document.getElementById('touchui')).display") === "block");
  const centerOf = async (id) => evalJs(`(() => {
    const r = document.getElementById('${id}').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r: r.width / 2 };
  })()`);
  const tap = async (id) => {
    const c = await centerOf(id);
    await touchEv("touchStart", [[c.x, c.y]]);
    await sleep(60);
    await touchEv("touchEnd", []);
  };
  const stick = await centerOf("stick");
  const movedBefore = await evalJs("NOVA_FOX3.state.movedTotal");
  await touchEv("touchStart", [[stick.x, Math.round(stick.y - stick.r * 0.9)]]);
  await sleep(4000);
  await touchEv("touchEnd", []);
  check("touch: the stick walks the fox",
    (await evalJs("NOVA_FOX3.state.movedTotal")) > movedBefore + 0.5,
    `movedTotal ${movedBefore} -> ${await evalJs("NOVA_FOX3.state.movedTotal")}`);
  const yawBefore = await evalJs("NOVA_FOX3.state.yaw");
  await touchEv("touchStart", [[canvasC.x, canvasC.y]]);
  await touchEv("touchMove", [[canvasC.x - 60, canvasC.y]]);
  await touchEv("touchMove", [[canvasC.x - 130, canvasC.y]]);
  await touchEv("touchEnd", []);
  check("touch: a drag on the world turns the fox",
    Math.abs((await evalJs("NOVA_FOX3.state.yaw")) - yawBefore) > 0.25,
    `yaw ${yawBefore} -> ${await evalJs("NOVA_FOX3.state.yaw")}`);
  const jumpedBefore = await evalJs("NOVA_FOX3.state.jumped");
  await tap("t-jump");
  check("touch: the jump button jumps",
    await waitFor(`NOVA_FOX3.state.jumped > ${jumpedBefore}`, 6000, "touch jump"));
  await waitFor("NOVA_FOX3.state.onGround", 8000, "landed after the touch jump");
  await tap("t-flip");
  check("touch: the flip button turns down upside down",
    await waitFor("NOVA_FOX3.state.gravDir === -1", 6000, "touch flip"));
  check("touch: the fox lands on the new ceiling",
    await waitFor("NOVA_FOX3.state.pos.y > 40", 20000, "ceiling landing (touch)"),
    await evalJs("NOVA_FOX3.state.pos.y"));
  await tap("t-flip");
  check("touch: and the flip button turns it back",
    await waitFor("NOVA_FOX3.state.gravDir === 1 && NOVA_FOX3.state.onGround",
      20000, "touch flip back"));
  await tap("t-draw");
  check("touch: the draw button arms the second instrument",
    await evalJs("NOVA_FOX3.touchState().mode") === "draw");
  const tTriVerts = [[300, 330], [430, 190], [560, 330], [300, 330]];
  const tTriPts = [];
  for (let v = 0; v < tTriVerts.length - 1; v++) {
    const [x0, y0] = tTriVerts[v], [x1, y1] = tTriVerts[v + 1];
    for (let i = 0; i < 10; i++) {
      tTriPts.push([Math.round(x0 + (x1 - x0) * (i / 10)), Math.round(y0 + (y1 - y0) * (i / 10))]);
    }
  }
  tTriPts.push(tTriVerts[tTriVerts.length - 1]);
  await touchEv("touchStart", [tTriPts[0]]);
  for (const p of tTriPts.slice(1)) { await touchEv("touchMove", [p]); await sleep(16); }
  await touchEv("touchEnd", []);
  check("touch: a drawn triangle opens the bridge rift, and spends the arming",
    await evalJs("!!NOVA_FOX3.state.rift") === true &&
    await evalJs("NOVA_FOX3.touchState().mode") === null);
  await tap("t-flute");
  check("touch: the flute button arms the spectral flute",
    await evalJs("NOVA_FOX3.touchState().mode") === "flute");
  const notesBefore = await evalJs("NOVA_FOX3.state.notesPlayed");
  await touchEv("touchStart", [[canvasC.x, canvasC.y + 30]]);
  for (let i = 1; i <= 5; i++) {
    await touchEv("touchMove", [[canvasC.x, canvasC.y + 30 - i * 26]]);
    await sleep(50);
  }
  await touchEv("touchEnd", []);
  check("touch: an upward drag sounds the flute, and spends the arming",
    (await evalJs("NOVA_FOX3.state.notesPlayed")) > notesBefore &&
    await evalJs("NOVA_FOX3.touchState().mode") === null,
    `notes ${notesBefore} -> ${await evalJs("NOVA_FOX3.state.notesPlayed")}`);

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
