// Nova Fox demo3 — end-to-end playtest of the SHIPPED index.html in
// headless Chrome over CDP. Drives the real input path (keyboard and
// mouse events through the page's own handlers) along the v5
// fresh-player path the re-sequenced guide guarantees:
//   boot under the phext logo panel (bypass it) -> wake/rifts ->
//   walk + jump -> the instrument (one number) -> the bridge tune
//   crosses to Ashfall and home -> the hand-over: Joy goes quiet
//   -> the fight surfaces just in time at the wisp (two strikes,
//   the Star Lance) -> the mark beat: a grand brush shapes the
//   ground through -> gravity surfaces (G flips, ceiling; a second G is refused — one shift a day, demo10; another fox's read-back restores) ->
//   the gesture beat: a drawn triangle crosses -> a repeated-digit
//   tune (2-2-2) opens its rift -> a shift-drag plays the flute ->
//   a monster's contact drops HP and sounds the noise cue -> the
//   Deep Stone completes the quest -> the board -> the Arrival
//   memory screen opens the intro film -> zero console errors.
// Run: node cdp_test3.mjs   (exits non-zero on any failure)
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9455); // demo42: its own private port (9455 — fresh: 9447 is demo41's, 9439 is demo39's, 9431 demo38's, 9415 demo35's, 9393 demo27's, 9385 demo25's, 9377 demo23's/demo40's, 9369 demo21's, 9361 the old demo20 harness's, 9353 demo14's) — sibling trees' harnesses share 9335 and navigate each other's pages; a shared port is the root cause of the CDP unsettled-await abort — see send() below
const URL = process.env.NF_URL || pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "index.html")).href;

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "novafox3-cdp-"));
const POLICY = process.env.NF_POLICY ||
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policyExists = existsSync(POLICY);
const policySha = policyExists
  ? createHash("sha256").update(readFileSync(POLICY)).digest("hex")
  : null;
const chromeArgs = [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
];
if (policyExists) {
  chromeArgs.push(
    `--hatch-webgl-allowed-domains-file=${POLICY}`,
    `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  );
}
chromeArgs.push(
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "about:blank",
);
const chrome = spawn(CHROME, chromeArgs,
  { stdio: ["ignore", "ignore", "pipe"] });
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
    // Bounded wait (demo14, BUILD return for Item #1): a CDP
    // response that never arrives must FAIL NAMING the call, not
    // hang the harness into Node's "unsettled top-level await"
    // (exit 13, no pass/fail summary — the EE 955 TEST failure).
    // That abort's root cause: this harness shared debugging
    // port 9335 with sibling trees' harnesses; a sibling's
    // wsUrl() finds the FIRST page on the shared port — another
    // tree's Chrome — and its Page.navigate / shutdown steals or
    // kills this run's page mid-evaluate, so the response never
    // comes and, with no timer and no close handling, nothing
    // ever settled the promise. The port is private now (above);
    // this timeout is the second half of the fix: 30 s is far
    // beyond any single call's honest work here, and it does not
    // swallow failures — the check awaiting the call fails, by
    // name, and the summary still prints.
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(
        `CDP timeout: no response to ${method} (id ${id}) within 30s`));
    }, 30000);
    pending.set(id, {
      label: method,
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    try { ws.send(JSON.stringify({ id, method, params })); }
    catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
  });
}
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (!r || !r.result) {
    // A CDP error response carries no result; naming it beats the
    // old crash ("Cannot read properties of undefined").
    throw new Error("page evaluate returned no result for: " +
      expression.slice(0, 80));
  }
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
async function walkThroughRift(ms = 12000) {
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
  ws.onclose = () => {
    // A dead connection must settle every waiter, by name — an
    // unrejected pending promise is the exit-13 abort above.
    for (const p of pending.values()) {
      p.reject(new Error(
        `CDP connection closed while waiting for ${p.label}`));
    }
    pending.clear();
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) {
        p.reject(new Error(`CDP error from ${p.label}: ` +
          (m.error.message || JSON.stringify(m.error))));
      } else {
        p.resolve(m.result);
      }
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
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 800, deviceScaleFactor: 1, mobile: false,
  });
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
  check("narration is embedded: all 25 Joy beats ready (demo22 — N-03 in both schemes, none for the silent beats)",
    await evalJs("Object.keys(NOVA_FOX3.narration.manifest()).length") === 25 &&
    await evalJs("NOVA_FOX3.narration.ready('N-01') && NOVA_FOX3.narration.ready('BEAT-quest')") &&
    await evalJs("NOVA_FOX3.narration.ready('N-03-WASD') && NOVA_FOX3.narration.ready('N-03-AWEF') && !NOVA_FOX3.narration.ready('N-03') && !NOVA_FOX3.narration.ready('BEAT-border-down') && !NOVA_FOX3.narration.ready('BEAT-strike-hold')"));
  check("the save state is labeled in the HUD (waiting or saving, never silent)",
    (await evalJs("document.getElementById('syncline').textContent")).includes("marks"));
  check("score line is in the HUD",
    (await evalJs("document.getElementById('scoreline').textContent")).includes("score"));
  check("guide opens on the wake step",
    await evalJs("NOVA_FOX3.guideCurrent().id") === "wake");
  check("the guide speaks Joy's script: the wake step shows N-01, under Joy's name (demo22)",
    (await evalJs("document.querySelector('#guide .who').textContent")) === "Joy — your aperture shift" &&
    (await evalJs("document.getElementById('guide-lines').textContent")).includes("Wake up, Fox! The rifts have opened. I'm Joy, your aperture shift."));
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
  // THE LOADING TRAIL (2026-11-26): a quiet line of words on the
  // load panel, fed by the boot's own reads (here, offline, the
  // local inscription log alone) — present, unlabeled, and fed.
  check("the loading trail rides the load panel, fed by the boot's reads",
    await evalJs("!!document.getElementById('trail-line')") === true &&
    await evalJs("NOVA_FOX3.trailState().fed") > 0);
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
  check("the move step shows the scheme's N-03 text (WASD — the harness flipped back) (demo22)",
    (await evalJs("document.getElementById('guide-lines').textContent")).includes("Feet first, Fox! W A S D to walk — the arrows work too."));

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
  check("the inversion woozes: the degauss treatment is on screen (demo10)",
    await evalJs("NOVA_FOX3.invertFx().active") === true &&
    await evalJs("Number(document.getElementById('degauss').style.opacity)") > 0 &&
    (await evalJs("document.querySelector('#stage canvas').style.filter")).includes("blur"));
  check("the inversion is announced: GRAVITY INVERSION!! warp text (demo18)",
    await evalJs("NOVA_FOX3.warpText().shown") === 1 &&
    await evalJs("NOVA_FOX3.warpText().text") === "GRAVITY INVERSION!!" &&
    await evalJs("document.getElementById('warp-name').textContent") === "GRAVITY INVERSION!!" &&
    await evalJs("document.getElementById('warpcard').classList.contains('show')") === true);
  check("the fox lands on the new ceiling",
    await waitFor("NOVA_FOX3.state.pos.y > 40", 20000, "ceiling landing"),
    await evalJs("NOVA_FOX3.state.pos.y"));
  check("guide advances to the gesture beat",
    await waitFor("NOVA_FOX3.guideCurrent().id === 'gesture'", 8000, "gesture beat"),
    await evalJs("NOVA_FOX3.guideCurrent().id"));
  // ONE SHIFT A DAY (demo10; Will, 2026-11-26): gravity lives in
  // subspace now, and this fox has spent today's shift in this
  // realm — G again is refused, and down stays up.
  await key("g", "KeyG");
  await sleep(1200);
  check("G again is refused — one shift per realm per day (demo10)",
    await evalJs("NOVA_FOX3.state.gravDir") === -1 &&
    await evalJs("NOVA_FOX3.gravityState().allowed") === false &&
    await evalJs("NOVA_FOX3.gravityState().known") >= 1,
    JSON.stringify(await evalJs("NOVA_FOX3.gravityState()")));
  check("a refused shift announces nothing — no warp text (demo18)",
    await evalJs("NOVA_FOX3.warpText().shown") === 1);
  // The chart answers: another fox's shift, read back through the
  // same reconcile path the flush uses, attunes this view — down
  // is down again, and the fox lands.
  const todayG = (() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  })();
  await evalJs(`NOVA_FOX3.gravityReadback("grav|nova|1|another-fox|${todayG}|${Date.now() + 60000}")`);
  check("another fox's shift, read back, restores down — and the fox lands",
    await waitFor(
      "NOVA_FOX3.state.gravDir === 1 && NOVA_FOX3.state.pos.y < 26",
      20000, "ground landing"),
    await evalJs("NOVA_FOX3.state.pos.y"));
  check("a read-back turn is announced too — the warp text fires again (demo18)",
    await evalJs("NOVA_FOX3.warpText().shown") === 2);

  // THE GESTURE (feedback #5): a right-mouse triangle, drawn with
  // real mouse events (pointer-lock-free path).
  await evalJs("if (document.exitPointerLock) document.exitPointerLock()");
  await waitFor("document.pointerLockElement === null", 4000,
    "pointer lock released for the draw");
  // Vertices in draw order, STARTING MID-EDGE (the base's midpoint):
  // a stroke that starts exactly on a vertex can lose that vertex's
  // corner to classifyStroke's closing seam (demo21 round-B, EE 976).
  const triVerts = [[460, 420], [620, 420], [460, 220], [300, 420], [460, 420]];
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

  // PORTAL REGRESSION (EE 954 — PORTAL-DIAGNOSIS.md): the crossing
  // test used to demand the fox pass within ~1.118 blocks of the
  // ring's center while the visible disc spans 1.467 (defect 1),
  // and it gated height against the ground where the tune was
  // played instead of the ring's own ground (defect 2). Both legs
  // below walk the way a human walks — off-center, and uphill —
  // and both must cross. (Invulnerable again: traversal is what
  // is under test here, not combat.)
  await evalJs("NOVA_FOX3.state.invulnUntil = performance.now() + 120000");
  const faceTheRing = async () => evalJs(`(() => {
    const r = NOVA_FOX3.state.rift, p = NOVA_FOX3.state.pos;
    NOVA_FOX3.state.yaw = Math.atan2(-(r.x - p.x), -(r.z - p.z));
    return true;
  })()`);
  // (a) The veer: open on the flat Arrival meadow, turn ~21° off
  // the ring, and walk. The path clips the disc ~1.2 blocks
  // off-center — through the visible portal, outside the old
  // trigger.
  await evalJs("NOVA_FOX3.teleportTo(9, 9)");
  await evalJs("NOVA_FOX3.state.yaw = 0; NOVA_FOX3.state.pitch = 0;");
  await waitFor("NOVA_FOX3.state.onGround", 8000, "grounded for the veer leg");
  const veerLinkBefore = await evalJs("NOVA_FOX3.portalState().linkId");
  await key("1", "Digit1");
  await key("4", "Digit4");
  await key("9", "Digit9");
  check("portal regression: the veer leg's rift opens",
    await waitFor(`!!NOVA_FOX3.state.rift && ` +
      `NOVA_FOX3.portalState().linkId !== ${veerLinkBefore}`,
      6000, "veer rift opens"));
  await evalJs("NOVA_FOX3.state.yaw += 0.37"); // ~21 degrees off the ring
  await walkThroughRift();
  check("portal regression: a ~20° veer through the disc crosses (defect 1)",
    await waitFor("NOVA_FOX3.state.realm === 'ashfall'", 15000, "veer crossing"),
    await evalJs("NOVA_FOX3.state.realm"));
  await faceTheRing();
  await walkThroughRift();
  check("portal regression: the veer door takes the fox home again",
    await waitFor("NOVA_FOX3.state.realm === 'nova'", 15000, "veer return"),
    await evalJs("NOVA_FOX3.state.realm"));
  // (b) The slope: at block (10, 29) facing -z the ground climbs
  // 13 -> 14 -> 15 -> 16, so the ring planted 3.4 ahead stands on
  // ground 3 blocks above the opener's — dead-center, and the old
  // height gate refused it by construction (rise 3 > tolerance 2.4).
  await evalJs("NOVA_FOX3.teleportTo(120, 120)"); // fold the veer door
  await sleep(300);
  await evalJs("NOVA_FOX3.teleportTo(10, 29)");
  await evalJs("NOVA_FOX3.state.yaw = 0; NOVA_FOX3.state.pitch = 0;");
  await waitFor("NOVA_FOX3.state.onGround", 8000, "grounded for the slope leg");
  const slopeSetup = await evalJs(`(() => {
    const feetHere = NOVA_FOX3.surfaceY(10, 29) - 1;
    const ringGround = NOVA_FOX3.surfaceY(10, 26) - 1;
    return { feetHere, ringGround, rise: ringGround - feetHere };
  })()`);
  check("portal regression: the slope leg's ground really rises 3 to the ring",
    slopeSetup.rise === 3, JSON.stringify(slopeSetup));
  const slopeLinkBefore = await evalJs("NOVA_FOX3.portalState().linkId");
  await key("1", "Digit1");
  await key("4", "Digit4");
  await key("9", "Digit9");
  check("portal regression: the slope rift opens on the ring's own ground",
    await waitFor(`!!NOVA_FOX3.state.rift && ` +
      `NOVA_FOX3.portalState().linkId !== ${slopeLinkBefore}`,
      6000, "slope rift opens") &&
    (await evalJs("NOVA_FOX3.state.rift.feetY")) === slopeSetup.ringGround,
    `feetY=${await evalJs("NOVA_FOX3.state.rift && NOVA_FOX3.state.rift.feetY")}`);
  await walkThroughRift();
  check("portal regression: an uphill walk-through crosses (defect 2)",
    await waitFor("NOVA_FOX3.state.realm === 'ashfall'", 15000, "slope crossing"),
    await evalJs("NOVA_FOX3.state.realm"));
  await faceTheRing();
  await walkThroughRift();
  check("portal regression: the slope door takes the fox home again",
    await waitFor("NOVA_FOX3.state.realm === 'nova'", 15000, "slope return"),
    await evalJs("NOVA_FOX3.state.realm"));
  await evalJs("NOVA_FOX3.teleportTo(120, 120)"); // fold the slope door
  await sleep(300);
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

  // THE STRIKE HINT (2026-11-26): while the encounter with the
  // Shadow lasts, the strike binding stands bulging at the view's
  // edge — the binding as assigned, never lettered by hand — and
  // fades on its own when the fox runs or the Shadow falls.
  // Start from quiet ground: step away, so no encounter can stand.
  await evalJs("NOVA_FOX3.state.pos.set(8.5, 30, 8.5); NOVA_FOX3.state.vel.set(0, 0, 0);");
  await sleep(700);
  check("strike hint: nothing stands before the guardian is met",
    await evalJs("NOVA_FOX3.encounterState().guardian") === false &&
    await evalJs("getComputedStyle(document.getElementById('striker')).display") === "none");
  const meetShadow = async () => evalJs(`(() => {
    const g = NOVA_FOX3.sub.monsters.find((m) => m.kind === "guardian");
    if (!g) return false;
    NOVA_FOX3.state.pos.set(g.gx * 2 + 1.5, 5.01, g.gy * 2 + 1.5);
    NOVA_FOX3.state.vel.set(0, 0, 0);
    return true;
  })()`);
  check("strike hint: the Shadow is there to be met", await meetShadow() === true);
  check("strike hint: the guardian's touch raises the encounter",
    await waitFor("NOVA_FOX3.encounterState().guardian", 30000, "guardian encounter"));
  check("strike hint: the cap stands and names the assigned binding (WASD: F)",
    await waitFor("document.getElementById('striker').classList.contains('on') && " +
      "getComputedStyle(document.getElementById('striker')).opacity > 0.9",
      20000, "cap faded in") &&
    await evalJs("document.getElementById('striker-cap').textContent") === "F" &&
    await evalJs("NOVA_FOX3.encounterState().label") === "F");
  await evalJs("document.getElementById('btn-keys').click()");
  check("strike hint: reassigning the scheme re-letters the cap (AWEF: the click)",
    await waitFor("document.getElementById('striker-cap').textContent === 'CLICK'",
      5000, "cap re-lettered"),
    await evalJs("document.getElementById('striker-cap').textContent"));
  await evalJs("document.getElementById('btn-keys').click()");
  check("strike hint: and back again (WASD: F)",
    await waitFor("document.getElementById('striker-cap').textContent === 'F'",
      5000, "cap back to F"));
  await evalJs("NOVA_FOX3.state.pos.set(8.5, 30, 8.5); NOVA_FOX3.state.vel.set(0, 0, 0);");
  check("strike hint: running away ends the encounter, and the cap fades on its own",
    await waitFor("!NOVA_FOX3.encounterState().guardian", 20000, "encounter fled") &&
    await waitFor("getComputedStyle(document.getElementById('striker')).display === 'none'",
      20000, "cap faded away"));
  // Meet it again, and this time finish it — through the fox's own
  // strike, aimed by hand each attempt as the Shadow moves.
  check("strike hint: the Shadow is there to be met again", await meetShadow() === true);
  check("strike hint: re-entering the encounter raises the cap again",
    await waitFor("NOVA_FOX3.encounterState().guardian", 30000, "guardian encounter again"));
  let shadowDown = false;
  for (let i = 0; i < 90 && !shadowDown; i++) {
    shadowDown = await evalJs(`(() => {
      const S = NOVA_FOX3;
      const g = S.sub.monsters.find((m) => m.kind === "guardian");
      if (!g || !g.alive) return true;
      const gx = g.gx * 2 + 1.5, gz = g.gy * 2 + 1.5;
      const dx = S.state.pos.x - gx, dz = S.state.pos.z - gz;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 2.6) { // close to striking distance, off its own square
        S.state.pos.set(gx + (dx / d) * 2.2, 5.01, gz + (dz / d) * 2.2);
        S.state.vel.set(0, 0, 0);
      }
      S.state.yaw = Math.atan2(-(gx - S.state.pos.x), -(gz - S.state.pos.z));
      S.state.pitch = 0;
      S.tryStrike();
      const g2 = S.sub.monsters.find((m) => m.kind === "guardian");
      return !g2 || !g2.alive;
    })()`);
    if (!shadowDown) await sleep(220);
  }
  check("strike hint: the Shadow falls to the fox's own strike", shadowDown);
  check("strike hint: the vanquish ends the encounter, and the cap fades",
    await waitFor("!NOVA_FOX3.encounterState().guardian", 20000, "encounter won") &&
    await waitFor("getComputedStyle(document.getElementById('striker')).display === 'none'",
      20000, "cap faded after the kill"));

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
  // N-03 speaks in the fox's scheme variant (demo22): resolve
  // the take this player hears and drive the hold test with it.
  const n03 = await evalJs(
    "NOVA_FOX3.state.scheme === 'AWEF' ? 'N-03-AWEF' : 'N-03-WASD'");
  await evalJs(`NOVA_FOX3.narration.play('${n03}')`);
  check("a fresh beat speaks for the visibility test, and gets past its opening",
    await waitFor(`NOVA_FOX3.narration.state().speaking === '${n03}' && ` +
      "NOVA_FOX3.narration.state().currentTime > 2", 10000, "N-03 well in"),
    JSON.stringify(await evalJs("NOVA_FOX3.narration.state()")));
  await setHidden(true);
  await sleep(250);
  check("hidden tab: the voice holds — the beat is back at the queue's head, whole",
    await evalJs("NOVA_FOX3.narration.state().held") === true &&
    await evalJs("NOVA_FOX3.narration.state().speaking") === null &&
    await evalJs("NOVA_FOX3.narration.state().pending[0]") === n03);
  check("hidden tab: the engine's clock is suspended — stopped, not muted",
    await evalJs("NOVA_FOX3.audioState().ctx") === "suspended" &&
    await evalJs("NOVA_FOX3.audioState().heldSuspend") === true);
  check("hidden tab: the film pauses",
    await evalJs("document.getElementById('intro-video').paused") === true);
  await setHidden(false);
  check("return: the held beat speaks again, from its start — not mid-line",
    await waitFor(`NOVA_FOX3.narration.state().speaking === '${n03}' && ` +
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
  // The touch verbs run in Ashfall (demo10): Nova's gravity shift
  // for today is spent under the once-a-day ruling, and the flip
  // button needs a realm whose day is fresh. Cross by the bridge
  // tune first, as a player does.
  await key("1", "Digit1");
  await key("4", "Digit4");
  await key("9", "Digit9");
  await walkThroughRift();
  check("the touch tests cross to Ashfall (a fresh realm for the flip button)",
    await waitFor("NOVA_FOX3.state.realm === 'ashfall'", 15000, "touch crossing"),
    await evalJs("NOVA_FOX3.state.realm"));
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
  // World-drag probe points (portal-fix pass, EE 954): a drag
  // that STARTS on a UI panel is ignored by the game on purpose
  // (its document touchstart handler skips the TOUCH_UI subtrees)
  // — and in this small viewport the canvas center sits inside
  // #bottombar, so the old world-drag legs never reached the
  // world at all (PORTAL-DIAGNOSIS.md §4). Probe for a point the
  // canvas itself owns, in its upper reaches, clear of every
  // panel. Only the start point matters: moves are tracked by
  // touch identifier wherever they wander.
  const worldPoint = async (fx, fy) => evalJs(`(() => {
    const cv = document.querySelector('#stage canvas');
    const r = cv.getBoundingClientRect();
    const tries = [[${fx}, ${fy}], [0.5, 0.3], [0.5, 0.2], [0.36, 0.3], [0.64, 0.3], [0.5, 0.42]];
    for (const [tx, ty] of tries) {
      const x = Math.round(r.left + r.width * tx);
      const y = Math.round(r.top + r.height * ty);
      if (document.elementFromPoint(x, y) === cv) return { x, y };
    }
    return null;
  })()`);
  const wpFound = await worldPoint(0.5, 0.3);
  check("touch: a world-owned probe point exists for the drag legs",
    !!wpFound, `canvas center=${JSON.stringify(canvasC)}`);
  const wp = wpFound || canvasC;
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
  await touchEv("touchStart", [[wp.x, wp.y]]);
  await touchEv("touchMove", [[wp.x - 60, wp.y]]);
  await touchEv("touchMove", [[wp.x - 130, wp.y]]);
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
  await sleep(1200);
  check("touch: a second flip is refused — the realm's shift is spent for today (demo10)",
    await evalJs("NOVA_FOX3.state.gravDir") === -1 &&
    await evalJs("NOVA_FOX3.gravityState().allowed") === false,
    JSON.stringify(await evalJs("NOVA_FOX3.gravityState()")));
  await tap("t-draw");
  check("touch: the draw button arms the second instrument",
    await evalJs("NOVA_FOX3.touchState().mode") === "draw");
  // The drawn triangle is anchored on the probed world point
  // (its apex): the old fixed vertices sat low in this small
  // viewport, inside #bottombar's band, so the stroke's first
  // touch was panel-owned and the stroke was never recorded.
  const tTriVerts = [
    [wp.x, wp.y],
    [wp.x + 130, wp.y + 150],
    [wp.x - 130, wp.y + 150],
    [wp.x, wp.y],
  ];
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
  const wpFlute = (await worldPoint(0.5, 0.38)) || wp;
  await touchEv("touchStart", [[wpFlute.x, wpFlute.y]]);
  for (let i = 1; i <= 5; i++) {
    await touchEv("touchMove", [[wpFlute.x, wpFlute.y - i * 26]]);
    await sleep(50);
  }
  await touchEv("touchEnd", []);
  check("touch: an upward drag sounds the flute, and spends the arming",
    (await evalJs("NOVA_FOX3.state.notesPlayed")) > notesBefore &&
    await evalJs("NOVA_FOX3.touchState().mode") === null,
    `notes ${notesBefore} -> ${await evalJs("NOVA_FOX3.state.notesPlayed")}`);

  // PLAYER FORMS (demo6): the editor is a surface of the board;
  // a form is a small phext the fox wears; the chart carries it.
  // (Its own try, so a failure here still lets the console-error
  // check below speak.)
  try {
  await evalJs(`(() => { const b = document.getElementById('board');
    if (b.style.display !== 'block') document.getElementById('btn-board').click(); })()`);
  await sleep(400);
  check("form: the editor's DOM stands in the board",
    (await evalJs(`['form-text','form-meter','btn-form-apply','form-preview','form-pages']` +
      `.map(id => !!document.getElementById(id)).join(',')`)) === "true,true,true,true,true",
    await evalJs(`['form-text','form-meter','btn-form-apply','form-preview','form-pages']` +
      `.map(id => id + ':' + !!document.getElementById(id)).join(' ')`));
  check("form: the editor lives in the board, open in-game, with a starter form loaded",
    (await evalJs("document.getElementById('board').style.display")) === "block" &&
    (await evalJs("document.getElementById('form-text').value")).includes("type: svg") &&
    (await evalJs("document.getElementById('form-meter').textContent")).includes("bytes of phext"));
  check("form: the svg example stands clean (3 frames, inside the ruled lines)",
    await evalJs(`(() => { const s = NOVA_FOX3.formStanding(NOVA_FOX3.formExamples().svg);
      return !s.refused && !s.leeway && s.frames.length === 3 &&
        s.frames.every(f => f.type === 'svg'); })()`) === true);
  check("form: the mixed example carries svg + bitmap + turtle in one form",
    await evalJs(`(() => { const s = NOVA_FOX3.formStanding(NOVA_FOX3.formExamples().bitmap);
      const t = NOVA_FOX3.formStanding(NOVA_FOX3.formExamples().turtle);
      return !s.refused && !t.refused && s.frames[0].type === 'bitmap' &&
        t.frames[0].type === 'turtle'; })()`) === true);
  check("form: wearing the svg form applies, persists, and enters the save copy",
    await evalJs(`(() => { const ex = NOVA_FOX3.formExamples().svg;
      const r = NOVA_FOX3.formApply(ex);
      const ls = JSON.parse(localStorage.getItem('nova-phox-form') || 'null');
      return r.ok && NOVA_FOX3.formWorld().worn && ls && ls.text === ex &&
        NOVA_FOX3.saveJson().includes('"form"'); })()`) === true);
  await sleep(300);
  const formFrameA = await evalJs("NOVA_FOX3.formWorld().frame");
  check("form: the worn form animates in-world, stepping its coordinates",
    (await evalJs("NOVA_FOX3.formWorld().spriteInScene")) === true &&
    (await waitFor("NOVA_FOX3.formWorld().frame !== " + formFrameA,
      10000, "form frame steps")),
    `frame ${formFrameA} -> ${await evalJs("NOVA_FOX3.formWorld().frame")}`);
  check("form: an unfit form is refused at apply and the worn form stands",
    await evalJs(`(() => { const big = ['1.1.1/1.1.1/1.1.1','name: Big','',
      '1.1.1/1.1.1/1.1.2','type: svg',
      '<svg viewBox="0 0 400 360" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="360" fill="#fff"/></svg>'].join('\\n');
      const r = NOVA_FOX3.formApply(big);
      return !r.ok && r.reason === 'fit' &&
        NOVA_FOX3.formState().text === NOVA_FOX3.formExamples().svg; })()`) === true);
  check("form: a script-bearing svg is worn as a picture and never runs",
    await evalJs(`(() => { const evil = ['1.1.1/1.1.1/1.1.1','name: Evil','',
      '1.1.1/1.1.1/1.1.2','type: svg',
      '<svg viewBox="0 0 120 360" xmlns="http://www.w3.org/2000/svg" onload="window.__formPwned=1"><script>window.__formPwned=1</' + 'script><circle cx="60" cy="180" r="30" fill="#fff"/></svg>'].join('\\n');
      return NOVA_FOX3.formApply(evil).ok; })()`) === true);
  await sleep(900);
  check("form: ...and after a second of wearing it, nothing has executed",
    await evalJs("typeof window.__formPwned") === "undefined");
  check("form: the editor's hard stop refuses to hold past the ceiling",
    await evalJs(`(() => { const ta = document.getElementById('form-text');
      ta.value = 'x'.repeat(90000);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return new TextEncoder().encode(ta.value).length <= 65536; })()`) === true);
  check("form: the wear button wears the editor's bitmap, the clear button takes it off",
    await evalJs(`(() => { const ta = document.getElementById('form-text');
      ta.value = NOVA_FOX3.formExamples().bitmap;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('btn-form-apply').click();
      const worn = NOVA_FOX3.formState().text === NOVA_FOX3.formExamples().bitmap;
      document.getElementById('btn-form-clear').click();
      return worn && NOVA_FOX3.formState().text === null &&
        !NOVA_FOX3.formWorld().worn; })()`) === true);
  check("form: the preview names the frame it stands on",
    (await evalJs("document.getElementById('form-frame-line').textContent")).includes("frame"));
  } catch (e) {
    fail++;
    console.log("FAIL  form section error:", e.message);
  }
  // FOX VISION (demo11, Will 2026-11-26): the Hall sense. Outside
  // The Unexpected Hall the N key is a quiet non-response; inside,
  // every familiar within subspace range stands revealed in every
  // phase — seen, strikable, and able to strike back — until the
  // fox puts the sense down or walks out of the Hall. (Phases are
  // pinned inside the same eval that reads them: the subspace
  // ticks every 650 ms and would rotate the phase mid-assertion.)
  await evalJs("NOVA_FOX3.teleportTo(8, 8)");
  await sleep(300);
  check("fox vision: Arrival is not the Hall",
    await evalJs("NOVA_FOX3.foxVisionState().inHall") === false);
  await key("n", "KeyN");
  await sleep(200);
  check("fox vision: N outside the Hall switches nothing on",
    await evalJs("NOVA_FOX3.foxVisionState().on") === false);
  await evalJs("NOVA_FOX3.state.pos.set(52.5, 5.01, 35.5); NOVA_FOX3.state.vel.set(0,0,0);");
  check("fox vision: the deep room is the Hall",
    await waitFor("NOVA_FOX3.foxVisionState().inHall", 5000, "hall entry"));
  const guardianId = await evalJs(`(() => {
    let g = NOVA_FOX3.sub.monsters.find((m) => m.alive && m.kind === "guardian");
    if (!g) g = NOVA_FOX3.sub.spawnMonster("nova", 27, 19, "guardian");
    return g.id;
  })()`);
  check("fox vision: out of phase, the Keeper is not seen the ordinary way",
    await evalJs(`(() => { const m = NOVA_FOX3.sub.monsters.find((x) => x.id === ${guardianId}); m.phase = 1; return !NOVA_FOX3.sub.monsterVisible(m) && !NOVA_FOX3.familiarSeen(${guardianId}); })()`) === true);
  await key("n", "KeyN");
  await sleep(200);
  check("fox vision: N inside the Hall wakes the sense",
    await evalJs("NOVA_FOX3.foxVisionState().active") === true);
  check("fox vision: the Keeper stands revealed in a dark phase",
    await evalJs(`(() => { const m = NOVA_FOX3.sub.monsters.find((x) => x.id === ${guardianId}); m.phase = 2; return NOVA_FOX3.familiarSeen(${guardianId}); })()`) === true);
  check("fox vision: the revealed Keeper lights up in the view",
    await waitFor(`NOVA_FOX3.monsterLit(${guardianId}) && NOVA_FOX3.monsterOpacity(${guardianId}) > 0.9`, 30000, "keeper lit"));
  const farId = await evalJs("NOVA_FOX3.sub.spawnMonster('nova', 220, 220, 'surface').id");
  check("fox vision: a familiar beyond subspace range stays dark",
    await evalJs(`NOVA_FOX3.familiarSeen(${farId})`) === false);
  await key("n", "KeyN");
  check("fox vision: putting the sense down restores the glimpses",
    await evalJs(`(() => { const m = NOVA_FOX3.sub.monsters.find((x) => x.id === ${guardianId}); m.phase = 1; return !NOVA_FOX3.familiarSeen(${guardianId}); })()`) === true &&
    await waitFor(`NOVA_FOX3.monsterLit(${guardianId}) === false`, 30000, "keeper unlit"));
  await key("n", "KeyN");
  await sleep(200);
  await evalJs("NOVA_FOX3.teleportTo(8, 8)");
  check("fox vision: leaving the Hall puts the sense down",
    await waitFor("NOVA_FOX3.foxVisionState().on === false", 15000, "vision auto-off"));
  // --- the in-game test console (2026-11-26): the checks moved
  // into the client. Driven here through the real input path
  // (Backquote key, typed commands) and the console's own handle;
  // every assertion is on what the console measured and printed,
  // never on a canned outcome. This build's traversal is the
  // diagnosed one, so the veer and slope legs are expected to
  // FAIL with the diagnosis's numbers — those checks assert the
  // console reports the defect honestly, and they flip when the
  // traversal fix lands in a later tree.
  async function conRun(line) {
    const before = (await evalJs("NOVA_FOX3.nfConsole.text()")).length;
    await evalJs(`NOVA_FOX3.nfConsole.run(${JSON.stringify(line)})`);
    return (await evalJs("NOVA_FOX3.nfConsole.text()")).slice(before);
  }
  await key("`", "Backquote");
  await sleep(400);
  check("console: Backquote opens the in-game test console",
    await evalJs("NOVA_FOX3.nfConsole.isOpen()") === true &&
    await evalJs("document.getElementById('nfconsole').style.display") === "block");
  const leakNotes = await evalJs("NOVA_FOX3.state.notesPlayed");
  const leakPos = await evalJs("JSON.stringify(NOVA_FOX3.state.pos)");
  await send("Input.insertText", { text: "where" });
  await key("Enter", "Enter");
  await sleep(500);
  const whereOut = await evalJs("NOVA_FOX3.nfConsole.text()");
  check("console: a typed command runs and prints a live readout",
    whereOut.includes("> where") && whereOut.includes("scroll"));
  check("console: typing never reaches the game (no notes, no walking)",
    await evalJs("NOVA_FOX3.state.notesPlayed") === leakNotes &&
    await evalJs("JSON.stringify(NOVA_FOX3.state.pos)") === leakPos,
    `notes ${leakNotes} -> ${await evalJs("NOVA_FOX3.state.notesPlayed")}`);
  check("console: version reports the build's ship EE",
    (await conRun("version")).includes("EE 950"));
  check("console: purse reads the live economy state",
    (await conRun("purse")).includes("flux"));
  check("console: gravity reports the subspace value",
    (await conRun("gravity")).includes("subspace"));
  const geoOut = await conRun("geometry");
  check("console: geometry check passes against the live function",
    geoOut.includes("PASS") && geoOut.includes("1.5571"), geoOut.trim().split("\n").pop());
  check("console: the geometry check measures the dead band",
    geoOut.includes("dead ground"), geoOut.trim());
  check("console: bridge check resolves the tune live",
    (await conRun("bridge")).includes("PASS"));
  // Terrain at hand, measured off the live heightAt (surfaceY):
  // a flat stance (a level 3.4-block path) and a steep one (a
  // >= 2.6-block rise across the gap), wherever the fox now is.
  const terrain = await evalJs(`(() => {
    const S = NOVA_FOX3, st = S.state;
    const g = (x, z) => S.surfaceY(x, z) - 1;
    const cx = Math.floor(st.pos.x), cz = Math.floor(st.pos.z);
    let flat = null, steep = null;
    for (let x = cx - 48; x <= cx + 48 && !(flat && steep); x++) {
      for (let z = cz - 48; z <= cz + 48 && !(flat && steep); z++) {
        const g0 = g(x, z);
        let maxRise = -Infinity;
        for (let i = 0; i < 36; i++) {
          const yaw = i / 36 * Math.PI * 2;
          const gr = g(Math.floor(x + 0.5 - Math.sin(yaw) * 3.4), Math.floor(z + 0.5 - Math.cos(yaw) * 3.4));
          if (gr - g0 > maxRise) maxRise = gr - g0;
          if (!flat && maxRise <= 1) {
            let level = true;
            for (const s of [0.85, 1.7, 2.55, 3.4]) {
              const gs = g(Math.floor(x + 0.5 - Math.sin(yaw) * s), Math.floor(z + 0.5 - Math.cos(yaw) * s));
              if (Math.abs(gs - g0) > 0.5) { level = false; break; }
            }
            if (level) flat = { x, z, yaw };
          }
        }
        if (!steep && maxRise >= 2.6) steep = { x, z, rise: maxRise };
      }
    }
    return { flat, steep };
  })()`);
  check("console: terrain for the legs exists in this realm (flat + steep)",
    !!terrain.flat && !!terrain.steep, JSON.stringify(terrain));
  if (terrain.flat) {
    await evalJs(`NOVA_FOX3.teleportTo(${terrain.flat.x}, ${terrain.flat.z})`);
    await evalJs(`NOVA_FOX3.state.yaw = ${terrain.flat.yaw}`);
    // S-2b (EE 1105): the legs refuse in themselves now, so
    // this section stands the token for each traversal leg
    // it runs — the S-2 accommodation, extended from
    // straight to veer, slope, and runall — and removes it
    // again after each, so the sections below still meet
    // the logged-out fox they assert.
    await evalJs("localStorage.setItem('nova-phox-token', JSON.stringify('e2e-console-token'))");
    const veerOut = await conRun("rift-veer");
    await evalJs("localStorage.removeItem('nova-phox-token')");
    const veerD = veerOut.match(/closest approach ([\d.]+)/);
    check("console: veer probe measures a real closest approach",
      !!veerD, veerOut.trim().split("\n").pop());
    check("console: veer probe reports the diagnosed dead band honestly (fails on this build)",
      veerOut.includes("FAIL") && !!veerD &&
      Number(veerD[1]) > 1.118 &&
      veerOut.includes("against a trigger radius of 1.118 and a visible disc of 1.467"),
      veerOut.trim().split("\n").pop());
    await evalJs(`NOVA_FOX3.teleportTo(${terrain.flat.x}, ${terrain.flat.z})`);
    await evalJs(`NOVA_FOX3.state.yaw = ${terrain.flat.yaw}`);
    // S-2 (EE 1100): rift-straight is signed-in-only in the client
    // now (the console gate — a traversal test in a shared world
    // stands behind the login token). This section runs the leg as
    // a signed-in fox: the token stands only for this one command
    // and is removed again immediately, so the merge and door
    // sections below still meet the logged-out fox they assert.
    await evalJs("localStorage.setItem('nova-phox-token', JSON.stringify('e2e-console-token'))");
    const straightOut = await conRun("rift-straight");
    await evalJs("localStorage.removeItem('nova-phox-token')");
    check("console: straight probe crosses dead-center on flat ground",
      straightOut.includes("PASS") && straightOut.includes("crossed"),
      straightOut.trim().split("\n").pop());
  }
  if (terrain.steep) {
    await evalJs(`NOVA_FOX3.teleportTo(${terrain.steep.x}, ${terrain.steep.z})`);
    await evalJs("localStorage.setItem('nova-phox-token', JSON.stringify('e2e-console-token'))");
    const slopeOut = await conRun("rift-slope");
    await evalJs("localStorage.removeItem('nova-phox-token')");
    check("console: slope probe runs on a real rise and reports both gates",
      slopeOut.includes("steepest rise") && slopeOut.includes("the two gates, measured"),
      slopeOut.trim().split("\n").pop());
    check("console: slope probe reports the height gate unmet on this build",
      slopeOut.includes("FAIL") && /height \|dy\| [\d.]+ vs 2\.4 — NOT met/.test(slopeOut),
      slopeOut.trim().split("\n").pop());
  }
  await evalJs("localStorage.setItem('nova-phox-token', JSON.stringify('e2e-console-token'))");
  const runallOut = await conRun("runall");
  await evalJs("localStorage.removeItem('nova-phox-token')");
  check("console: runall summarizes real counts, geometry among them",
    /runall: \d+ passed, \d+ failed, \d+ not run/.test(runallOut) &&
    runallOut.includes("geometry: pass"),
    runallOut.trim().split("\n").pop());
  await key("`", "Backquote");
  await sleep(200);
  check("console: Backquote closes it again",
    await evalJs("NOVA_FOX3.nfConsole.isOpen()") === false);
  const resumePos = await evalJs("({ x: NOVA_FOX3.state.pos.x, z: NOVA_FOX3.state.pos.z })");
  await keyDown("w", "KeyW");
  await sleep(900);
  await keyUp("w", "KeyW");
  const resumePos2 = await evalJs("({ x: NOVA_FOX3.state.pos.x, z: NOVA_FOX3.state.pos.z })");
  check("console: play resumes unbroken after it closes",
    Math.hypot(resumePos2.x - resumePos.x, resumePos2.z - resumePos.z) > 0.5,
    `${JSON.stringify(resumePos)} -> ${JSON.stringify(resumePos2)}`);
  // =====================================================================
  // THE ESC MENU (demo13, 2026-11-26): every row's real behavior —
  // open/close, keyboard navigation, the honest LAN state, the
  // binding store (capture, swap, refusal, reset), the real video
  // and audio settings, the .phext save, the merge's honest states,
  // quit-to-title, and the new-game confirm gate (last: it reloads).
  await key("Escape", "Escape");
  check("menu: Esc opens the menu",
    await evalJs("NOVA_FOX3.menuState().open") === true &&
    (await evalJs("document.getElementById('menu').style.display")) === "block");
  await key("Escape", "Escape");
  check("menu: Esc closes it again",
    await evalJs("NOVA_FOX3.menuState().open") === false);
  await key("Escape", "Escape");
  await key("ArrowDown", "ArrowDown");
  await key("ArrowDown", "ArrowDown");
  check("menu: the arrow keys move the selection",
    await evalJs("document.querySelectorAll('#menu .menuitem')[2].classList.contains('sel')") === true);
  await key("Enter", "Enter");
  check("menu: Enter works the selected row (the .phext save speaks its count)",
    (await evalJs("document.getElementById('menu-note').textContent")).includes("scrolls"));

  await evalJs("document.getElementById('menu-lan').click()");
  check("menu: Open to LAN never claims a session that does not exist",
    await evalJs("NOVA_FOX3.lanState().open") === false &&
    await evalJs("NOVA_FOX3.lanState().available") === false &&
    (await evalJs("document.getElementById('menu-note').textContent")).includes("no LAN transport"));
  check("menu: the LAN state line says closed",
    (await evalJs("document.getElementById('menu-lan-state').textContent")) === "closed");

  await evalJs("document.getElementById('menu-keys').click()");
  check("menu: the key bindings panel opens",
    await evalJs("NOVA_FOX3.menuState().panel") === "bindings-panel");
  check("menu: the strike binding starts at the default",
    await evalJs("NOVA_FOX3.bindingFor('strike')") === "KeyF");
  await evalJs("document.querySelector('button[data-action=\"strike\"]').click()");
  await key("h", "KeyH");
  check("menu: capturing a key remaps the action and persists it",
    await evalJs("NOVA_FOX3.bindingFor('strike')") === "KeyH" &&
    await evalJs("JSON.parse(localStorage.getItem('nova-phox-bindings')).strike") === "KeyH");
  await evalJs("document.querySelector('button[data-action=\"chisel\"]').click()");
  await key("h", "KeyH");
  check("menu: taking another action's key swaps the two bindings",
    await evalJs("NOVA_FOX3.bindingFor('chisel')") === "KeyH" &&
    await evalJs("NOVA_FOX3.bindingFor('strike')") === "KeyC");
  await evalJs("document.querySelector('button[data-action=\"strike\"]').click()");
  await key("q", "KeyQ");
  check("menu: a note-row key is refused as a binding, with its reason",
    await evalJs("NOVA_FOX3.bindingFor('strike')") === "KeyC" &&
    (await evalJs("document.getElementById('bindings-note').textContent")).includes("already plays a note"));
  await evalJs("document.getElementById('bindings-reset').click()");
  check("menu: reset restores the default bindings",
    await evalJs("NOVA_FOX3.bindingFor('strike')") === "KeyF" &&
    await evalJs("NOVA_FOX3.bindingFor('chisel')") === "KeyC");
  await key("Escape", "Escape");
  check("menu: Esc from a sub-panel returns to the menu",
    await evalJs("NOVA_FOX3.menuState().panel") === "menu");

  await evalJs("document.getElementById('menu-video').click()");
  check("menu: the video panel opens",
    await evalJs("NOVA_FOX3.menuState().panel") === "video-panel");
  const pr0 = await evalJs("NOVA_FOX3.renderScaleNow()");
  await evalJs("document.getElementById('vid-scale').click()");
  check("menu: render scale really reaches the renderer",
    await evalJs("NOVA_FOX3.settings().renderScale") === 0.75 &&
    Math.abs((await evalJs("NOVA_FOX3.renderScaleNow()")) - pr0 * 0.75) < 0.001,
    `pixelRatio ${pr0} -> ${await evalJs("NOVA_FOX3.renderScaleNow()")}`);
  await evalJs("document.getElementById('vid-view').click()");
  check("menu: view distance really moves the chunk radius",
    await evalJs("NOVA_FOX3.renderRadius()") === 4);
  await evalJs("document.getElementById('vid-view').click()");
  await evalJs("document.getElementById('vid-view').click()");
  await evalJs("document.getElementById('vid-scale').click()");
  await evalJs("document.getElementById('vid-scale').click()");
  check("menu: and both cycle home to the shipped settings",
    await evalJs("NOVA_FOX3.renderRadius()") === 3 &&
    await evalJs("NOVA_FOX3.settings().renderScale") === 1);
  await evalJs("document.getElementById('video-back').click()");

  await evalJs("document.getElementById('menu-audio').click()");
  check("menu: the audio panel opens",
    await evalJs("NOVA_FOX3.menuState().panel") === "audio-panel");
  await evalJs("(() => { const r = document.getElementById('aud-master'); r.value = 40; r.dispatchEvent(new Event('input')); })()");
  check("menu: the master volume really reaches the master gain",
    await evalJs("NOVA_FOX3.settings().master") === 0.4 &&
    Math.abs((await evalJs("NOVA_FOX3.masterGain()")) - 0.4) < 0.001,
    `gain ${await evalJs("NOVA_FOX3.masterGain()")}`);
  await evalJs("document.getElementById('aud-mute').click()");
  check("menu: the audio panel's mute is the game's one mute",
    await evalJs("NOVA_FOX3.masterGain()") === 0);
  await evalJs("document.getElementById('aud-mute').click()");
  check("menu: and unmuting restores the set level",
    Math.abs((await evalJs("NOVA_FOX3.masterGain()")) - 0.4) < 0.001);
  await evalJs("document.getElementById('audio-back').click()");

  const urlBefore = await evalJs("location.href");
  await evalJs("document.getElementById('menu-merge').click()");
  await sleep(2000);
  check("menu: merging never navigates away uninvited",
    (await evalJs("location.href")) === urlBefore);
  check("menu: with no sign-in, the merge claims nothing it did not do",
    (await evalJs("NOVA_FOX3.mergeState().hasToken")) === false &&
    !(await evalJs("document.getElementById('menu-note').textContent")).startsWith("merged —"));

  await evalJs("document.getElementById('menu-savephext').click()");
  check("menu: saving the world says what it wrote",
    (await evalJs("document.getElementById('menu-note').textContent")).includes("the world is written out"));
  const wpMenu = await evalJs("(() => { const r = NOVA_FOX3.worldPhext(); return { scrolls: r.scrolls, genesis: r.text.includes('the world is loaded') }; })()");
  check("menu: the export is this session's world, inscription log included",
    wpMenu.scrolls >= 13 && wpMenu.genesis === true, `${wpMenu.scrolls} scrolls`);

  await evalJs("document.getElementById('menu-quit').click()");
  check("menu: quit closes the menu and lands on the title",
    await evalJs("NOVA_FOX3.menuState().open") === false &&
    await evalJs("NOVA_FOX3.state.splash") === true &&
    (await evalJs("document.getElementById('splash').style.display")) === "flex");
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(200);

  // The new game, last — confirming reloads the page.
  await evalJs("localStorage.setItem('nova-phox-standings', JSON.stringify({ best: 4242, score: 4242 }))");
  await evalJs("localStorage.setItem('nova-phox-name', JSON.stringify('e2e-old-name'))");
  await key("Escape", "Escape");
  await evalJs("document.getElementById('menu-newgame').click()");
  check("menu: a new game asks first — nothing is wiped yet",
    await evalJs("NOVA_FOX3.menuState().newGameArmed") === true &&
    (await evalJs("JSON.parse(localStorage.getItem('nova-phox-standings')).best")) === 4242);
  await evalJs("document.getElementById('menu-confirm-no').click()");
  check("menu: keeping playing disarms the gate, record intact",
    await evalJs("NOVA_FOX3.menuState().newGameArmed") === false &&
    (await evalJs("JSON.parse(localStorage.getItem('nova-phox-standings')).best")) === 4242);
  await evalJs("document.getElementById('menu-newgame').click()");
  await evalJs("document.getElementById('menu-confirm-yes').click()");
  let rebooted = false;
  for (let i = 0; i < 60 && !rebooted; i++) {
    await sleep(250);
    try { rebooted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* reloading */ }
  }
  await sleep(800);
  check("menu: confirming starts over — the old record and name are gone",
    rebooted === true &&
    (await evalJs("JSON.parse(localStorage.getItem('nova-phox-standings') || '{}').best || 0")) !== 4242 &&
    (await evalJs("NOVA_FOX3.saveJson().name")) !== "e2e-old-name");
  check("menu: a new game keeps the machine's keepings (bindings, settings, controls)",
    await evalJs("localStorage.getItem('nova-phox-bindings')") !== null &&
    await evalJs("localStorage.getItem('nova-phox-settings')") !== null &&
    await evalJs("localStorage.getItem('nova-phox-controls')") !== null);
  check("menu: the fresh game wakes at the first guide beat",
    await evalJs("NOVA_FOX3.guideCurrent().id") === "wake");
  // ---- demo16: speedrun mode — play, record, stream ----------------
  // Arm a run through the game's own handle, start its clock with a
  // real key held down, finish it standing at the stone (the quest
  // is already done by here — the finish is a place, tested every
  // frame, so the run still counts), and read the recording back.
  await evalJs("NOVA_FOX3.speedrun.arm()");
  check("speedrun: arming a run stands the fox at Arrival, clock waiting",
    await evalJs("NOVA_FOX3.speedrun.phase()") === "armed" &&
    await evalJs("NOVA_FOX3.state.realm") === "nova");
  await keyDown("w", "KeyW");
  let srStarted = false;
  for (let i = 0; i < 24 && !srStarted; i++) {
    await sleep(500);
    srStarted = await evalJs("NOVA_FOX3.speedrun.phase()") === "running";
  }
  await keyUp("w", "KeyW");
  check("speedrun: the clock starts on first movement", srStarted);
  check("speedrun: the race clock stands on screen while a run is live",
    await evalJs("document.getElementById('runtimer').style.display") === "block");
  await evalJs("NOVA_FOX3.state.pos.set(60.5, 7.01, 35.5)");
  await waitFor("NOVA_FOX3.speedrun.phase() === 'finished'", 6000,
    "the run finishes at the stone");
  const srVerify = await evalJs("NOVA_FOX3.speedrun.verify()");
  check("speedrun: the recorded run verifies against its own stream, finish reproduced",
    !!srVerify && srVerify.ok === true && srVerify.finishMs > 0,
    JSON.stringify(srVerify));
  check("speedrun: the finished run is written into the book",
    (await evalJs("NOVA_FOX3.speedrun.recordings().length")) >= 1);

  // The stream: a minimal WebSocket listener in this process —
  // handshake and masked-frame decode, just enough to drink what
  // the game pours — and a second run under its eye.
  const { createServer } = await import("node:http");
  const srMessages = [];
  const srHttp = createServer();
  srHttp.on("upgrade", (req, socket) => {
    const accept = createHash("sha1")
      .update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");
    socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n" +
      "Connection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
    let buf = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 2) {
        const op = buf[0] & 0x0f;
        let len = buf[1] & 0x7f;
        let off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        const masked = buf[1] & 0x80;
        const maskOff = off;
        if (masked) off += 4;
        if (buf.length < off + len) return;
        const payload = Buffer.from(buf.subarray(off, off + len));
        if (masked) {
          const mask = buf.subarray(maskOff, maskOff + 4);
          for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
        }
        buf = buf.subarray(off + len);
        if (op === 1) { try { srMessages.push(JSON.parse(payload.toString("utf8"))); } catch (e) { /* not ours */ } }
        if (op === 8) socket.end();
      }
    });
    socket.on("error", () => {});
  });
  await new Promise((r) => srHttp.listen(9713, "127.0.0.1", r));
  await evalJs("NOVA_FOX3.speedrun.connect('ws://127.0.0.1:9713')");
  await waitFor("NOVA_FOX3.speedrun.streamState() === 'open'", 6000, "the stream connects");
  await evalJs("NOVA_FOX3.speedrun.arm()");
  await keyDown("w", "KeyW");
  let srStarted2 = false;
  for (let i = 0; i < 28 && !srStarted2; i++) {
    await sleep(500);
    srStarted2 = await evalJs("NOVA_FOX3.speedrun.phase()") === "running";
  }
  await keyUp("w", "KeyW");
  await sleep(1200); // let at least two telemetry ticks flow
  await evalJs("NOVA_FOX3.state.pos.set(60.5, 7.01, 35.5)");
  await waitFor("NOVA_FOX3.speedrun.phase() === 'finished'", 6000, "the streamed run finishes");
  await sleep(300);
  check("speedrun: the stream carried hello, run-start, telemetry, and the finish",
    srMessages.some((m) => m.type === "hello") &&
    srMessages.some((m) => m.type === "run-start") &&
    srMessages.some((m) => m.type === "telemetry" && m.pos && typeof m.elapsedMs === "number") &&
    srMessages.some((m) => m.type === "run-finish" && m.finishMs > 0),
    JSON.stringify(srMessages.map((m) => m.type)));
  await evalJs("NOVA_FOX3.speedrun.disconnect()");
  srHttp.close();

  // THE TELLING DOOR (demo8, Item #1 — coverage added in demo14's
  // BUILD return): the door stands in Nova Prime, its panel opens,
  // and a telling's whole honest round trip runs against a fake
  // chart stubbed at the fetch level (the game's own backend code
  // — probe, flush, read-back — does the work; only the network
  // is pretend, and the stub keeps the chart the way the real one
  // does: an insert appends, a select reads back what landed).
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
  // (The token rides localStorage JSON-encoded — the game's LS
  // wrapper JSON.parses it; a raw string would read back as no
  // token at all, which is a harness bug, not a game bug.)
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
      " queued=" + (await evalJs("NOVA_FOX3.ideaState().queued")) +
      " log-coord inserts=" +
      (await evalJs("window.__ideaNet.inserts.filter(i => i.coord === '1.1.1/1.1.1/1.1.1').length")));
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
    if (!row) return false; // the read-back checks below fail by name
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
  check("idea door: the panel closes",
    await evalJs("NOVA_FOX3.ideaState().panelOpen") === false);

  // THE ROAD AHEAD (demo39, Item #3): the board carries a
  // read-only roadmap section fed by the same stubbed ideas
  // chart the door section above drove — one shipped telling
  // already stands on it (EE 999); a second fox's told idea is
  // appended to the stub chart here, and the section must show
  // it as upcoming under its suggester's name.
  await evalJs(`(() => {
    window.__ideaScroll += "IDEA|v1|road2|Wren|1700000000000|YSBsYW50ZXJuIHJvYWQ=|c28gbmlnaHQgcGF0aHMgZ2xvdw==\\n";
    return true;
  })()`);
  for (let i = 0; i < 10; i++) {
    await evalJs("NOVA_FOX3.backendFlush()");
    if ((await evalJs("NOVA_FOX3.ideaState().rows.length")) === 2) break;
    await sleep(1000);
  }
  await evalJs(`(() => { const b = document.getElementById('board');
    if (b.style.display !== 'block') document.getElementById('btn-board').click(); })()`);
  await sleep(300);
  check("roadmap: the board opens (B) and the road ahead stands in it",
    (await evalJs("document.getElementById('board').style.display")) === "block" &&
    await evalJs("!!document.getElementById('board-roadmap')") === true);
  check("roadmap: the told idea shows as upcoming under its suggester's name",
    (await evalJs("document.getElementById('board-roadmap').textContent")).includes("Wren") &&
    (await evalJs("document.getElementById('board-roadmap').textContent")).includes("a lantern road") &&
    (await evalJs("document.getElementById('board-roadmap').textContent")).includes("On the way"));
  check("roadmap: the shipped idea shows in the world with its EE",
    (await evalJs("document.getElementById('board-roadmap').textContent")).includes("a bridge of bells") &&
    (await evalJs("document.getElementById('board-roadmap').textContent")).includes("EE 999"));
  await evalJs(`(() => { window.__ideaScroll = ""; return true; })()`);
  for (let i = 0; i < 10; i++) {
    await evalJs("NOVA_FOX3.backendFlush()");
    if ((await evalJs("NOVA_FOX3.ideaState().rows.length")) === 0) break;
    await sleep(1000);
  }
  await evalJs(`(() => { const b = document.getElementById('board');
    document.getElementById('btn-board').click();
    if (b.style.display !== 'block') document.getElementById('btn-board').click(); })()`);
  await sleep(300);
  check("roadmap: an empty chart shows the honest empty line",
    (await evalJs("document.getElementById('board-roadmap').textContent"))
      .includes("No ideas told yet — the telling door by Arrival is listening."));

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
