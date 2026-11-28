// Nova Fox S-1 — Joy narration wiring, behavioral probe (EE 1100).
// Drives the real input path in headless Chrome over CDP (the
// probe-1037 pattern) and proves, beat by beat, that the canonical
// narration (integration/NARRATION.md) actually FIRES in play:
// the text shows (guide panel / #comms toast) and the Voice 1 take
// enters the narration queue (the in-page recorder unions
// pending+speaking+ended from narration.state() — a beat the game
// fired is a beat captured, even if the queue speaks it later).
// Also pins the fight-beat takes by manifest duration (demo35's
// re-records: 5.42 / 1.20 / 9.00 / 5.66 s — the originals were
// 5.81 / 1.99 / 11.28 / 5.11; see S1-PRODUCER-REPORT Finding 1),
// the (Winds of Change) atmosphere swell at the Shadow's fall
// (EE 1100 ruling: atmosphere, never speech), and the ruled
// silences (border-down, strike-hold, contact never fire a line).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const HERE = dirname(fileURLToPath(import.meta.url));
const URL = process.env.NF_URL || pathToFileURL(join(HERE, "index.html")).href;

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LINES = {
  "N-01": "Wake up, Fox! The rifts have opened. I'm Joy, your aperture shift. Ten realms have appeared, each one unexpected. Let's go exploring!",
  "N-02": "Nova Prime — that's here! The first realm, and you're standing in the rift that opened it. Click the world to take hold of it. The sound starts with your click, so listen as you go!",
  "N-03-WASD": "Feet first, Fox! W A S D to walk — the arrows work too. Mouse to look, Space to jump. There's no fence, no edge, no end. Run as far as you like!",
  "N-03-AWEF": "Feet first, Fox — and your hands get the other layout. F walks forwards, A walks backwards, W strafes left, E strafes right. Mouse to look, Space to jump. Cartoon hands make do with four fingers. Sentients ship with five, so your thumb gets the Space bar all to itself. There's no fence, no edge, no end. Run as far as you like!",
  "N-04": "See the numbers along the top? They're an inky! Press three in a row - together they make a tune...and a tune? That's a place.",
  "N-05": "Here's your first tune: 1, 4, 9. Any order, close together. That's the bridge tune — it opens a rift to Ashfall Haven, right in front of you. Step through! From Ashfall, the same tune brings you home.",
  "N-06": "Ashfall Haven! Ash, red rock, cinders on the wind. Every realm has its own weather, its own ground, its own mood. Things move in the dark here — you'll glimpse them, just barely. Strike in the glimpse: click, or F. Ready to head back? 1, 4, 9.",
  "N-07": "One more surprise...press G to invert gravity self. Down and up are suggestions here, ones that you can swap daily. You'll feel a little woozy after a gravity inversion, that's normal. Just remember, each realm can only swap gravity once a day!",
  "N-08": "East of Home Base, where you woke up, rises the Unexpected Hall. Deep inside lies a piece of Nova Prime's Heart. Whenever you find a hall, you should explore it to collect another piece of the planet's heart. The journey will be dangerous, but Nova Prime will reward you every time.",
  "N-09": "Good, Fox: you've found another piece of Nova Heart. You've unlocked a Bundle. Return to Home Base and help rebuild Nova Prime! Press M to view available realms.",
  "BEAT-arrival": "Nova Prime! Welcome Home, Fox. Your items are on the left.",
  "BEAT-cross-ashfall": "Ashfall Haven...the rock here remembers the fire that forged the cinders.",
  "BEAT-cross-nova": "Nova Prime! Home Base and safety. The monsters cannot find you here.",
  "BEAT-pocket": "Whoa, Fox! This place is entirely new! That tune was powerful.",
  "BEAT-stay": "This is ours.",
  "BEAT-flip-up": "Gravity inversion in progress. Reality has shifted, permanently.",
  "BEAT-flip-down": "Gravity restored.",
  "BEAT-border-up": "Inverted Gravity Detected.",
  "BEAT-barrow": "The Unexpected Hall, Fox. Find the Shadow, strike at the Heart. Your vision alone can fix it.",
  "BEAT-quest": "This ... is the (gasp) Nova Heart, Fox! You've earned this - take the hat. It's yours, for good!",
  "BEAT-guardian-contact": "This guardian is confused, Fox. You must strike back. Strike, now!",
  "BEAT-strike-kill": "It is done.",
  "BEAT-guardian-kill": "(Winds of Change) The ... shadow is ... gone, Fox! You've done it! The hall is quiet, Nova Prime calls to you. Another piece of Nova Heart is near.",
  "BEAT-death": "Oh no!! Fox, hold on. I'm getting you out of here. Stay with me...please.",
  "BEAT-fall": "Fall home, fox.",
};
const SPOKEN = Object.keys(LINES);
const FIGHT_SECONDS = {
  "BEAT-guardian-contact": 5.42, "BEAT-strike-kill": 1.20,
  "BEAT-guardian-kill": 9.00, "BEAT-death": 5.66,
};

async function launchCtx(port, scheme) {
  const profile = mkdtempSync(join(tmpdir(), "novafox-s1-"));
  const POLICY = process.env.NF_POLICY ||
    "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
  const policyExists = existsSync(POLICY);
  const policySha = policyExists
    ? createHash("sha256").update(readFileSync(POLICY)).digest("hex") : null;
  const chromeArgs = [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=CalculateNativeWinOcclusion",
  ];
  if (policyExists) {
    chromeArgs.push(
      `--hatch-webgl-allowed-domains-file=${POLICY}`,
      `--hatch-webgl-allowed-domains-sha256=${policySha}`);
  }
  chromeArgs.push(`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank");
  const chrome = spawn(CHROME, chromeArgs, { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", () => {});
  let ws;
  async function wsUrl() {
    for (let i = 0; i < 50; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/list`);
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
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onclose = () => {
    for (const p of pending.values()) p.reject(new Error(`CDP connection closed while waiting for ${p.label}`));
    pending.clear();
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.reject(new Error(`CDP error from ${p.label}: ` + (m.error.message || JSON.stringify(m.error))));
      else p.resolve(m.result);
    } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      consoleErrors.push(JSON.stringify(m.params.args));
    } else if (m.method === "Runtime.exceptionThrown") {
      consoleErrors.push("exception: " + (m.params.exceptionDetails.exception?.description || ""));
    }
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++msgId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: no response to ${method} (id ${id}) within 30s`));
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
    if (!r || !r.result) throw new Error("page evaluate returned no result for: " + expression.slice(0, 80));
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
    await keyDown(k, code); await sleep(90); await keyUp(k, code); await sleep(130);
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
  async function walkUntil(keyName, keyCode, expr, capMs, label) {
    await keyDown(keyName, keyCode);
    const t0 = Date.now();
    let ok = false;
    try {
      while (Date.now() - t0 < capMs) {
        if (await evalJs(expr)) { ok = true; break; }
        await sleep(400);
      }
    } finally { await keyUp(keyName, keyCode); }
    if (!ok) console.log(`  .. walk cap reached: ${label}`);
    return ok;
  }
  async function facePoint(x, z) {
    await evalJs(`(() => {
      const F = window.NOVA_FOX3;
      F.state.yaw = Math.atan2(-(${x} - F.state.pos.x), -(${z} - F.state.pos.z));
      return true;
    })()`);
  }
  const heard = async () => evalJs("window.__s1 ? window.__s1.heard : []");
  const heardHas = async (id) => (await heard()).includes(id);
  const waitHeard = (id, ms) => waitFor(`(window.__s1 ? window.__s1.heard : []).includes(${JSON.stringify(id)})`, ms, `beat heard: ${id}`);
  const toasts = async () => evalJs("window.__s1 ? window.__s1.toasts : []");
  const toastHas = async (text) => (await toasts()).some((t) => t.includes(text));
  const waitToast = (text, ms) => waitFor(
    `(window.__s1 ? window.__s1.toasts : []).some((t) => t.includes(${JSON.stringify(text)}))`,
    ms, `toast: ${text.slice(0, 40)}`);
  const guideText = () => evalJs("document.getElementById('guide-lines') ? document.getElementById('guide-lines').textContent : ''");
  const waitGuide = (text, ms) => waitFor(
    `(document.getElementById('guide-lines') || {textContent:''}).textContent.includes(${JSON.stringify(text)})`,
    ms, `guide line: ${text.slice(0, 40)}`);

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 960, height: 600, deviceScaleFactor: 1, mobile: false,
  });
  // The recorder rides in before the page's own scripts: it unions
  // every #comms toast and every beat the narration queue touches.
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__s1 = { toasts: [], heard: [], banter: [] };
// Toast capture is MutationObserver-based: toast() REPLACES the
// #comms text, and a busy main thread (chunk regeneration after a
// gravity flip) can starve a polling recorder for a toast's whole
// visible life. Observer records QUEUE even when delivery is
// delayed, so every intermediate #comms state is preserved.
(function watch() {
  const c = document.getElementById('comms');
  const b = document.getElementById('banter-line');
  if (!c) { setTimeout(watch, 100); return; }
  const pushT = (t) => { if (t && window.__s1.toasts[window.__s1.toasts.length - 1] !== t) window.__s1.toasts.push(t); };
  const grab = (records) => {
    // Walk the records themselves: a toast can be written and
    // overwritten inside one task (the fall line is superseded
    // by the respawn's arrival line in the same tick), and the
    // callback would otherwise only ever see the final value.
    if (records) for (const r of records) {
      if (r.type === 'childList') {
        for (const n of r.removedNodes) pushT(n.textContent);
        for (const n of r.addedNodes) pushT(n.textContent);
      } else if (r.type === 'characterData') {
        pushT(r.oldValue);
      }
    }
    pushT(c.textContent);
    if (b) { const bt = b.textContent; if (bt && window.__s1.banter[window.__s1.banter.length - 1] !== bt) window.__s1.banter.push(bt); }
  };
  new MutationObserver(grab).observe(c, { childList: true, characterData: true, characterDataOldValue: true, subtree: true });
  if (b) new MutationObserver(grab).observe(b, { childList: true, characterData: true, subtree: true });
  grab();
})();
setInterval(() => {
  try {
    const F = window.NOVA_FOX3;
    if (F && F.narration) {
      const s = F.narration.state();
      const all = [...(s.pending || []), s.speaking, ...(s.ended || [])].filter(Boolean);
      for (const id of all) if (!window.__s1.heard.includes(id)) window.__s1.heard.push(id);
    }
  } catch (e) { /* page still booting */ }
}, 120);`,
  });
  await send("Page.navigate", { url: URL });
  let booted = false;
  for (let i = 0; i < 60 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
  }
  if (!booted) throw new Error("page never booted");
  await evalJs(`localStorage.setItem('nf.scheme', ${JSON.stringify(scheme)})`);
  await send("Page.reload");
  booted = false;
  for (let i = 0; i < 60 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
  }
  if (!booted) throw new Error("page never re-booted");
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(400);
  return { chrome, ws, evalJs, key, keyDown, keyUp, waitFor, walkUntil, facePoint,
           heard, heardHas, waitHeard, toasts, toastHas, waitToast, guideText, waitGuide,
           consoleErrors };
}
// The rifts step's button takes the helm (pointer lock). Headless
// Chrome may engage then drop the lock, and the game answers an
// unlock by opening the menu — which eats verb keys. This helper
// unwinds both, in the game's own order: exit the lock (the menu
// opens), then Escape (the menu closes).
async function ensureNoMenu(C) {
  for (let i = 0; i < 5; i++) {
    const st = await C.evalJs(`({ locked: !!document.pointerLockElement, menu: (document.getElementById('menu') || { style: {} }).style.display === 'block' })`);
    if (!st.locked && !st.menu) return true;
    if (st.locked) await C.evalJs("document.exitPointerLock()");
    else if (st.menu) await C.key("Escape", "Escape");
    await sleep(500);
  }
  return false;
}

try {
  const basePort = Number(process.env.NF_PORT || 9422);
  // ================= context A: WASD, the full beat walk ==========
  const A = await launchCtx(basePort, "wasd");
  check("context A boots in the WASD scheme",
    (await A.evalJs("NOVA_FOX3.state.scheme")) === "WASD");

  // --- the ready set + the takes' identity (manifest durations) --
  {
    const ready = await A.evalJs(`(() => {
      const out = {};
      for (const id of ${JSON.stringify(SPOKEN)}) out[id] = NOVA_FOX3.narration.ready(id);
      return out;
    })()`);
    check("all 25 script beats are ready (a take stands behind each)",
      SPOKEN.every((id) => ready[id]),
      SPOKEN.filter((id) => !ready[id]).join(", "));
    const silent = await A.evalJs(`["BEAT-border-down", "BEAT-strike-hold", "BEAT-contact"]
      .map((id) => NOVA_FOX3.narration.ready(id))`);
    check("the ruled-silent beats have no take (border-down, strike-hold, contact)",
      silent.every((v) => v === false), JSON.stringify(silent));
    const man = await A.evalJs("NOVA_FOX3.narration.manifest()");
    check("the fight beats carry demo35's re-recorded takes (manifest seconds)",
      Object.entries(FIGHT_SECONDS).every(([id, s]) =>
        man[id] && Math.abs(man[id].seconds - s) <= 0.07),
      Object.entries(FIGHT_SECONDS).map(([id, s]) =>
        `${id}: want ${s}, got ${man[id] ? man[id].seconds : "none"}`).join(" · "));
  }

  // --- BEAT-arrival: fired at boot, heard once the voice unlocks -
  check("BEAT-arrival fires at spawn (voice)", await A.waitHeard("BEAT-arrival", 15000));
  check("BEAT-arrival shows its line", await A.waitToast(LINES["BEAT-arrival"], 4000));

  // --- the guide spine --------------------------------------------
  check("N-01 wake: guide shows the line", await A.waitGuide(LINES["N-01"], 8000));
  check("N-01 wake: voice fires", await A.waitHeard("N-01", 8000));
  await A.evalJs("document.getElementById('guide-btn').click()");
  check("N-02 rifts: guide shows the line", await A.waitGuide(LINES["N-02"], 8000));
  check("N-02 rifts: voice fires", await A.waitHeard("N-02", 8000));
  await A.evalJs("document.getElementById('guide-btn').click()");
  await ensureNoMenu(A);
  check("N-03 WASD: guide shows the scheme's line", await A.waitGuide(LINES["N-03-WASD"], 8000));
  check("N-03 WASD: voice fires", await A.waitHeard("N-03-WASD", 8000));
  // Satisfy the move step: walk + jump on the real keys. Retried
  // across headings — at SwiftShader frame rates a single 3 s walk
  // can come up short of the step's distance, and a pond or wall
  // can eat another; the step's conditions are the game's own.
  let n04 = false;
  for (let round = 0; round < 3 && !n04; round++) {
    const p = await A.evalJs("({x: NOVA_FOX3.state.pos.x, z: NOVA_FOX3.state.pos.z})");
    await A.facePoint(p.x + (round === 1 ? -10 : 10), p.z + (round === 2 ? 10 : 0));
    await A.keyDown("w", "KeyW"); await sleep(3500); await A.keyUp("w", "KeyW");
    await A.key(" ", "Space");
    n04 = await A.waitGuide(LINES["N-04"], 9000);
  }
  check("N-04 numbers: guide shows the line", n04);
  check("N-04 numbers: voice fires", await A.waitHeard("N-04", 8000));
  await A.key("1", "Digit1");
  check("N-05 bridge: guide shows the line", await A.waitGuide(LINES["N-05"], 12000));
  check("N-05 bridge: voice fires", await A.waitHeard("N-05", 8000));

  // cross to Ashfall on the bridge tune, walking through the rift
  async function playTune(C, digits) {
    for (const d of digits) await C.key(String(d), "Digit" + d);
  }
  async function crossTo(C, realm, label) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const p = await C.evalJs("({x: NOVA_FOX3.state.pos.x, z: NOVA_FOX3.state.pos.z})");
      await C.facePoint(p.x + 10, p.z);
      await playTune(C, [1, 4, 9]);
      await sleep(700);
      if (await C.walkUntil("w", "KeyW",
        `NOVA_FOX3.state.realm === ${JSON.stringify(realm)}`, 25000, label)) return true;
    }
    return false;
  }
  check("the bridge crossing lands in Ashfall", await crossTo(A, "ashfall", "cross to ashfall"));
  check("BEAT-cross-ashfall: voice fires", await A.waitHeard("BEAT-cross-ashfall", 8000));
  check("BEAT-cross-ashfall: line shows", await A.waitToast(LINES["BEAT-cross-ashfall"], 4000));
  check("N-06 ashfall: guide shows the line", await A.waitGuide(LINES["N-06"], 10000));
  check("N-06 ashfall: voice fires", await A.waitHeard("N-06", 8000));
  check("the crossing home lands in Nova", await crossTo(A, "nova", "cross home"));
  check("BEAT-cross-nova: voice fires", await A.waitHeard("BEAT-cross-nova", 8000));
  check("BEAT-cross-nova: line shows", await A.waitToast(LINES["BEAT-cross-nova"], 4000));
  // handover (unscripted step): click through to the JIT steps
  await A.waitFor("!!document.getElementById('guide-btn') && document.getElementById('guide-btn').style.display !== 'none'", 8000, "handover button");
  await A.evalJs("document.getElementById('guide-btn').click()");
  await sleep(600);

  // --- the fight step's wisp: strike-hold silence, strike-kill ---
  {
    const wisp = await A.evalJs(`(() => {
      const F = NOVA_FOX3;
      const m = F.sub.monsters.find((m) => m.kind === 'wisp' && m.alive && m.realmId === F.state.realm);
      return m ? { gx: m.gx, gy: m.gy, hp: m.hp } : null;
    })()`);
    check("a meadow wisp stands for the fight lesson", !!wisp, JSON.stringify(wisp));
    if (wisp) {
      const wx = wisp.gx * 2 + 1, wz = wisp.gy * 2 + 1;
      const vis = `(() => { const F = NOVA_FOX3; const m = F.sub.monsters.find((m) => m.kind === 'wisp' && m.alive && m.realmId === F.state.realm); return m ? F.sub.monsterVisible(m) : false; })()`;
      await A.evalJs(`NOVA_FOX3.state.pos.set(${wx - 2.2}, NOVA_FOX3.state.pos.y + 2, ${wz})`);
      await A.waitFor(vis, 25000, "the wisp shows itself");
      await A.facePoint(wx, wz);
      await A.key("f", "KeyF");
      await sleep(900);
      const hp1 = await A.evalJs(`(() => { const m = NOVA_FOX3.sub.monsters.find((m) => m.kind === 'wisp' && m.realmId === NOVA_FOX3.state.realm); return m ? m.hp : -1; })()`);
      console.log(`  .. wisp hp after strike 1: ${hp1}`);
      // strike-hold: the strike landed and the thing HOLDS — the
      // ruled response is NO DIALOGUE: no voice, no line.
      check("BEAT-strike-hold: a landed strike that holds stays dialogueless (ruled)",
        hp1 > 0 && !(await A.heardHas("BEAT-strike-hold")));
      await A.waitFor(vis, 25000, "the wisp shows itself again");
      await A.facePoint(wx, wz);
      await A.key("f", "KeyF");
      check("BEAT-strike-kill: voice fires when the wisp falls", await A.waitHeard("BEAT-strike-kill", 10000));
      // The wisp is the tutorial fight: its kill toasts the
      // fighting lesson, by design (applyStrikeHit's wisp branch);
      // Joy's "It is done." line belongs to dark-thing kills and
      // is proven on a non-wisp kill in the Ashfall leg below.
      check("the wisp kill toasts the fighting lesson (its designed line)",
        await A.waitToast("That's fighting, start to finish", 4000));
    }
  }

  // --- mark step: chisel a block; gravity step: N-07 + flip-up ---
  {
    let broke = false;
    for (const pitch of [1.3, -1.3, 0]) {
      await A.evalJs(`NOVA_FOX3.state.pitch = ${pitch}`);
      const before = await A.evalJs("NOVA_FOX3.sub.wal.filter((s) => s.op === 'break').length");
      await A.key("c", "KeyC");
      await sleep(700);
      const after = await A.evalJs("NOVA_FOX3.sub.wal.filter((s) => s.op === 'break').length");
      if (after > before) { broke = true; break; }
    }
    check("the chisel carves (mark step's condition)", broke);
    check("N-07 gravity: guide shows the line", await A.waitGuide(LINES["N-07"], 15000));
    check("N-07 gravity: voice fires", await A.waitHeard("N-07", 8000));
    await A.key("g", "KeyG");
    check("BEAT-flip-up: voice fires on the inversion", await A.waitHeard("BEAT-flip-up", 10000));
    check("BEAT-flip-up: line shows", await A.waitToast(LINES["BEAT-flip-up"], 4000));
    // restore Nova's down by read-back (another fox's record): the
    // border back into ordinary down is BEAT-border-down — SILENT.
    const toastsBefore = (await A.toasts()).length;
    await A.evalJs(`(() => {
      const day = new Date().toLocaleDateString('en-CA');
      NOVA_FOX3.gravityReadback('grav|nova|1|probe-other-fox|' + day + '|' + Date.now());
      return true;
    })()`);
    await sleep(2500);
    check("BEAT-border-down stays silent (no voice, no line) when down is restored",
      !(await A.heardHas("BEAT-border-down")) &&
      (await A.toasts()).slice(toastsBefore).every((t) => !t.includes("Down is")));
    // the gesture step is text-only; satisfy it by its own flag and
    // the quest step surfaces with N-08.
    await A.evalJs("NOVA_FOX3.state.gestureUsed = true");
    check("N-08 quest: guide shows the line", await A.waitGuide(LINES["N-08"], 15000));
    check("N-08 quest: voice fires", await A.waitHeard("N-08", 8000));
  }

  // --- Ashfall borders: border-up speaks, my flip restores -------
  {
    check("crossing to Ashfall for the border legs", await crossTo(A, "ashfall", "cross for borders"));
    const ashfallArrival = await A.evalJs("({x: NOVA_FOX3.state.pos.x, y: NOVA_FOX3.state.pos.y, z: NOVA_FOX3.state.pos.z})");
    await A.evalJs(`(() => {
      const day = new Date().toLocaleDateString('en-CA');
      NOVA_FOX3.gravityReadback('grav|ashfall|-1|probe-other-fox|' + day + '|' + Date.now());
      return true;
    })()`);
    check("BEAT-border-up: voice fires entering inverted down", await A.waitHeard("BEAT-border-up", 12000));
    check("BEAT-border-up: line shows", await A.waitToast(LINES["BEAT-border-up"], 4000));
    await A.key("g", "KeyG");
    check("BEAT-flip-down: voice fires on my restoring shift", await A.waitHeard("BEAT-flip-down", 10000));
    check("BEAT-flip-down: line shows", await A.waitToast(LINES["BEAT-flip-down"], 4000));
    // BEAT-strike-kill's LINE ("It is done.") toasts only on a
    // non-wisp kill (the wisp carries the tutorial line instead).
    // Stage one here in Ashfall: any living dark thing that is
    // neither wisp nor the Shadow.
    {
      const foe = await A.evalJs(`(() => {
        const m = NOVA_FOX3.sub.monsters.find((m) => m.alive && m.realmId === 'ashfall' && m.kind !== 'wisp' && m.kind !== 'guardian');
        return m ? { id: m.id, gx: m.gx, gy: m.gy, hp: m.hp, kind: m.kind } : null;
      })()`);
      if (!foe) {
        console.log("  .. no non-wisp Ashfall monster to stage the strike-kill line leg (code-verified branch)");
      } else {
        console.log(`  .. strike-kill line leg vs a ${foe.kind} (hp ${foe.hp})`);
        const fx = foe.gx * 2 + 1, fz = foe.gy * 2 + 1;
        const visF = `(() => { const F = NOVA_FOX3; const m = F.sub.monsters.find((m) => m.id === ${JSON.stringify(foe.id)}); return m && m.alive ? F.sub.monsterVisible(m) : false; })()`;
        const aliveF = `(() => { const m = NOVA_FOX3.sub.monsters.find((m) => m.id === ${JSON.stringify(foe.id)}); return !!m && m.alive; })()`;
        await A.evalJs("NOVA_FOX3.state.hp = 99");
        let down = false;
        for (let i = 0; i < 24 && !down; i++) {
          await A.evalJs(`NOVA_FOX3.state.pos.set(${fx - 2.2}, NOVA_FOX3.state.pos.y + 2, ${fz})`);
          await A.evalJs("NOVA_FOX3.state.hp = 99");
          await A.waitFor(visF, 6000, "the dark thing shows itself");
          await A.facePoint(fx, fz);
          await A.key("f", "KeyF");
          await sleep(700);
          down = !(await A.evalJs(aliveF));
        }
        check("a dark thing falls in Ashfall", down);
        check("BEAT-strike-kill: line shows on a dark-thing kill",
          down && await A.waitToast(LINES["BEAT-strike-kill"], 4000));
      }
    }
    // Back to the Arrival neighborhood before crossing home: the
    // rift walk is staged from there (a kill across the map leaves
    // the fox somewhere the walk cannot stage from).
    await A.evalJs(`NOVA_FOX3.state.pos.set(${ashfallArrival.x}, ${ashfallArrival.y + 2}, ${ashfallArrival.z})`);
    await sleep(800);
    check("crossing home after the border legs", await crossTo(A, "nova", "cross home again"));
  }

  // --- pocket + stay ----------------------------------------------
  {
    await playTune(A, [2, 3, 4]);
    await sleep(700);
    const p = await A.evalJs("({x: NOVA_FOX3.state.pos.x, z: NOVA_FOX3.state.pos.z})");
    await A.facePoint(p.x + 10, p.z);
    const pocketed = await A.walkUntil("w", "KeyW",
      "!!NOVA_FOX3.state.pocketScroll", 25000, "walk into the pocket rift");
    check("a far tune lands the fox in a pocket", pocketed);
    check("BEAT-pocket: voice fires", await A.waitHeard("BEAT-pocket", 8000));
    check("BEAT-pocket: line shows", await A.waitToast(LINES["BEAT-pocket"], 4000));
    await playTune(A, [2, 3, 4]);
    check("BEAT-stay: voice fires when the tune is the place's own", await A.waitHeard("BEAT-stay", 10000));
    check("BEAT-stay: line shows", await A.waitToast(LINES["BEAT-stay"], 4000));
  }

  // --- the Hall: barrow, guardian-contact, guardian-kill, quest --
  let hallColumn = null;
  {
    const cell = await A.evalJs("NOVA_FOX3.bossState() ? NOVA_FOX3.bossState().cell : null");
    check("the Shadow stands in the Hall", !!cell, JSON.stringify(cell));
    if (cell) {
      const gcx = cell.gx * 2 + 1.5, gcz = cell.gy * 2 + 1.5;
      hallColumn = { x: gcx, z: gcz };
      await A.evalJs("NOVA_FOX3.state.hp = 99");
      await A.evalJs(`NOVA_FOX3.state.pos.set(${gcx - 4}, 8, ${gcz})`);
      await A.waitFor("NOVA_FOX3.viewState().inHall", 12000, "the fox stands in the Hall");
      check("BEAT-barrow: voice fires on first entering the Hall", await A.waitHeard("BEAT-barrow", 12000));
      check("BEAT-barrow: line shows", await A.waitToast(LINES["BEAT-barrow"], 4000));
      // guardian-contact: stand in its reach and let a hit LAND.
      // The Shadow wanders/chases, so stage from its LIVE cell
      // each attempt, not the boss cell it started in.
      const guardPos = `(() => { const g = NOVA_FOX3.sub.monsters.find((m) => m.kind === 'guardian' && m.alive); return g ? { x: g.gx * 2 + 1, z: g.gy * 2 + 1 } : null; })()`;
      let contact = false;
      for (let i = 0; i < 12 && !contact; i++) {
        const gp = await A.evalJs(guardPos);
        if (!gp) break;
        await A.evalJs("NOVA_FOX3.state.hp = 99");
        await A.evalJs(`NOVA_FOX3.state.pos.set(${gp.x - 1.8}, 8, ${gp.z})`);
        await A.facePoint(gp.x, gp.z);
        contact = await A.waitHeard("BEAT-guardian-contact", 6000);
      }
      check("BEAT-guardian-contact: voice fires when the Shadow's hit lands",
        contact || (await A.heardHas("BEAT-guardian-contact")));
      check("BEAT-guardian-contact: line shows (S-1 Finding 2)",
        await A.waitToast(LINES["BEAT-guardian-contact"], 4000));
      // the kill: the Heart's gate is staged to a single true blow
      // (probe-1037 owns the honest fight; the BEAT is under test).
      // Re-pin hp and re-stage from the Shadow's live position on
      // every attempt — it moves between holds — and strike only
      // in a glimpse (strikes land on visible things).
      const guardVis = `(() => { const F = NOVA_FOX3; const g = F.sub.monsters.find((m) => m.kind === 'guardian' && m.alive); return g ? F.sub.monsterVisible(g) : false; })()`;
      // TAP strikes, not charged holds: a hold releases 750 ms
      // after the aim was set and the Shadow moves inside that
      // window (its boss states cycle rush/stalk/slam); taps are
      // the mechanism the wisp and Ashfall kills already proved.
      let killed = false;
      for (let i = 0; i < 30 && !killed; i++) {
        const gp = await A.evalJs(guardPos);
        if (!gp) { killed = true; break; }
        await A.evalJs(`(() => { const g = NOVA_FOX3.sub.monsters.find((m) => m.kind === 'guardian'); if (g) g.hp = 1; return !!g; })()`);
        await A.evalJs("NOVA_FOX3.state.hp = 99");
        await A.evalJs(`NOVA_FOX3.state.pos.set(${gp.x - 1.8}, 8, ${gp.z})`);
        await sleep(500);
        await A.facePoint(gp.x, gp.z);
        await A.waitFor(guardVis, 6000, "the Shadow shows itself");
        await A.key("f", "KeyF");
        await sleep(600);
        const bs = await A.evalJs("NOVA_FOX3.bossState()");
        killed = !bs || !bs.alive;
        if (i % 6 === 5 || killed) console.log(`  .. kill attempt ${i + 1}: boss=${JSON.stringify(bs)}`);
      }
      check("the Shadow falls", killed);
      check("BEAT-guardian-kill: voice fires", await A.waitHeard("BEAT-guardian-kill", 10000));
      check("BEAT-guardian-kill: line shows", await A.waitToast(LINES["BEAT-guardian-kill"], 4000));
      const winds = await A.evalJs("NOVA_FOX3.battleState().winds");
      check("(Winds of Change): the atmosphere swell fires in the bed (EE 1100)",
        typeof winds === "number" && winds >= 1, `winds=${winds}`);
      await A.waitFor("!!window.NOVA_FOX3", 30000, "page alive after the Hall");
      // the quest: sweep the deep room for the stone's reach.
      let quest = false;
      outer:
      for (let dx = -6; dx <= 6; dx += 2) {
        for (let dz = -6; dz <= 6; dz += 2) {
          await A.evalJs(`NOVA_FOX3.state.pos.set(${gcx + dx}, 8, ${gcz + dz})`);
          await sleep(450);
          if (await A.evalJs("NOVA_FOX3.sub.questDone")) { quest = true; break outer; }
        }
      }
      check("the Deep Stone is reached (quest completes)", quest);
      check("BEAT-quest: voice fires at the Nova Heart", await A.waitHeard("BEAT-quest", 10000));
      check("BEAT-quest: line shows", await A.waitToast(LINES["BEAT-quest"], 4000));
      check("N-09 done: guide shows the line", await A.waitGuide(LINES["N-09"], 15000));
      check("N-09 done: voice fires", await A.waitHeard("N-09", 8000));
    }
  }

  // --- fall ---------------------------------------------------------
  {
    // BEAT-fall is the out-of-world catch (game3.js: pos.y < -12
    // or above the world's top): it fires playBeat, hurts for 2
    // (the line rides hurtPlayer's why-toast) and respawns the
    // fox at Arrival. Stage exactly that, where the fox stands
    // (Ashfall side of the Hall — unwarded). The ward charm is
    // spent first and the invulnerability window outlasted, so
    // the hurt — and its line — actually land.
    if (!(await A.heardHas("BEAT-fall"))) {
      await A.evalJs("NOVA_FOX3.state.wardCharge = 0");
      await sleep(1600);
      const p = await A.evalJs("({x: NOVA_FOX3.state.pos.x, z: NOVA_FOX3.state.pos.z})");
      await A.evalJs(`NOVA_FOX3.state.pos.set(${p.x}, -20, ${p.z})`);
      check("BEAT-fall: voice fires on the out-of-world fall", await A.waitHeard("BEAT-fall", 15000));
      check("BEAT-fall: line shows", await A.waitToast(LINES["BEAT-fall"], 4000));
    } else {
      check("BEAT-fall: voice fired earlier in the walk", true);
      check("BEAT-fall: line showed earlier in the walk", await A.toastHas(LINES["BEAT-fall"]));
    }
    // Death: the same catch at 1 hp, staged at the Hall column —
    // the column family where the catch demonstrably fires and
    // blows land unwarded. hurtPlayer's death branch speaks
    // BEAT-death and toasts its line; the fox is carried home.
    // (Staging death by the Shadow's own hit also works — seed
    // build #6 — but it resets the boss encounter, so the kill
    // leg owns the Shadow and death rides the catch instead.)
    if (hallColumn && !(await A.heardHas("BEAT-death"))) {
      await A.evalJs("NOVA_FOX3.state.wardCharge = 0");
      await sleep(1600);
      await A.evalJs("NOVA_FOX3.state.hp = 1");
      await A.evalJs(`NOVA_FOX3.state.pos.set(${hallColumn.x}, -20, ${hallColumn.z})`);
      check("BEAT-death: voice fires when the fox falls", await A.waitHeard("BEAT-death", 15000));
      check("BEAT-death: line shows", await A.waitToast(LINES["BEAT-death"], 4000));
    } else if (await A.heardHas("BEAT-death")) {
      check("BEAT-death: voice fired earlier in the walk", true);
      check("BEAT-death: line showed earlier in the walk", await A.toastHas(LINES["BEAT-death"]));
    } else {
      check("BEAT-death: voice fires when the fox falls", false, "no Hall column to stage at");
    }
  }

  // --- the ruled silences, globally --------------------------------
  {
    const h = await A.heard();
    check("no silent/retired beat ever entered the voice queue",
      !h.includes("BEAT-border-down") && !h.includes("BEAT-strike-hold") && !h.includes("BEAT-contact"),
      h.join(","));
    check("the retired contact line is never shown",
      !(await A.toastHas("It reaches you out of the dark.")));
    check("no console errors across the S-1 legs", A.consoleErrors.length === 0,
      A.consoleErrors.slice(0, 3).join(" | "));
  }
  try { A.ws.close(); } catch (e) {}
  A.chrome.kill("SIGKILL");

  // ================= context B: AWEF, the other N-03 ==============
  const B = await launchCtx(basePort + 1, "awef");
  check("context B boots in the AWEF scheme",
    (await B.evalJs("NOVA_FOX3.state.scheme")) === "AWEF");
  await B.evalJs("document.getElementById('guide-btn').click()");
  await B.waitGuide(LINES["N-02"], 8000);
  await B.evalJs("document.getElementById('guide-btn').click()");
  await ensureNoMenu(B);
  check("N-03 AWEF: guide shows the scheme's line", await B.waitGuide(LINES["N-03-AWEF"], 10000));
  check("N-03 AWEF: voice fires", await B.waitHeard("N-03-AWEF", 10000));
  try { B.ws.close(); } catch (e) {}
  B.chrome.kill("SIGKILL");
} catch (err) {
  fail++;
  console.log(`FAIL  probe aborted: ${err.message}`);
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
