// Nova Fox demo28 — phone playability probe: REAL TOUCH input on a
// phone-sized viewport (400x800, touch emulation on), plus the
// inverted-gravity traversal legs from Will's 2026-11-26 20:27 CST
// ruling ("the world still needs to still be playable after the
// inversion"). Runs against THIS tree's index.html.
//   legs: console open/close/toggle by touch · the note pads play
//   the bridge tune by touch · flip -> land on the vault -> walk
//   the vault across a scroll border, standing over the barrow
//   shaft on the way · the Hall completed from its ceiling · exit
//   up the shaft · a rift opened and crossed ON the vault, and the
//   way back · a running probe cancelled from touch.
// Setup placements (a state.pos set into the Hall) are marked as
// such; every traversal itself is real keys + real physics.
// Run: node probe-touch.mjs   (exits non-zero on any failure)
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_TOUCH_PORT || 9385);
const URL = process.env.NF_URL || pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "index.html")).href;

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "novafox28-touch-"));
const POLICY = process.env.NF_POLICY ||
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policyExists = existsSync(POLICY);
const chromeArgs = [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
];
if (policyExists) {
  chromeArgs.push(
    `--hatch-webgl-allowed-domains-file=${POLICY}`,
    `--hatch-webgl-allowed-domains-sha256=${createHash("sha256").update(readFileSync(POLICY)).digest("hex")}`,
  );
}
chromeArgs.push(`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank");
const chrome = spawn(CHROME, chromeArgs, { stdio: ["ignore", "ignore", "pipe"] });
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
async function touchEv(type, points) {
  await send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map(([x, y], i) => ({
      x, y, id: i + 1, radiusX: 6, radiusY: 6, force: 1,
    })),
  });
}
async function tapAt(x, y) {
  await touchEv("touchStart", [[x, y]]);
  await sleep(70);
  await touchEv("touchEnd", [[x, y]]);
  await sleep(300);
}
// Tap an element's center with a real touch. Returns false when the
// element does not exist (the pre-fix shape of several legs). Logs
// what actually sits at the tap point — on a phone the layout is
// part of the behavior.
async function tapEl(sel) {
  const c = await evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null; const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return [cx, cy, hit ? (hit.id || hit.className || hit.tagName) : "nothing"]; })()`);
  if (!c) return false;
  console.log(`  .. tap ${sel} -> hits ${c[2]} at ${Math.round(c[0])},${Math.round(c[1])}`);
  await tapAt(c[0], c[1]);
  return true;
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
const pos = () => evalJs("(() => { const s = NOVA_FOX3.state; return [s.pos.x, s.pos.y, s.pos.z]; })()");
// Walk with the real forward key, steering by yaw toward (tx, tz).
// Locomotion is the game's own physics; only the heading is set.
async function centerOn(tx, tz, timeoutMs = 30000) {
  const scheme = await evalJs("NOVA_FOX3.state.scheme");
  const fwd = scheme === "AWEF" ? ["f", "KeyF"] : ["w", "KeyW"];
  const t0 = Date.now();
  let ok = false;
  while (Date.now() - t0 < timeoutMs) {
    const [x, , z] = await pos();
    const dx = tx - x, dz = tz - z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) { ok = true; break; }
    await evalJs(`NOVA_FOX3.state.yaw = ${Math.atan2(-dx, -dz)}`);
    await keyDown(fwd[0], fwd[1]);
    await sleep(dist > 0.45 ? 130 : 40);
    await keyUp(fwd[0], fwd[1]);
    await sleep(dist > 0.45 ? 160 : 260);
  }
  console.log(`  .. centered on ${tx},${tz}: ${ok}`);
  return ok;
}
async function walkTo(tx, tz, timeoutMs = 150000) {
  const t0 = Date.now();
  let maxY = -Infinity, minY = Infinity;
  // The scheme's own forward key, resolved exactly as the game
  // resolves it (game3.js nfWalkProbe): AWEF walks forward on F.
  const scheme = await evalJs("NOVA_FOX3.state.scheme");
  const fwd = scheme === "AWEF" ? ["f", "KeyF"] : ["w", "KeyW"];
  console.log(`  .. walk to ${tx},${tz} on ${fwd[1]} (scheme ${scheme})`);
  await keyDown(fwd[0], fwd[1]);
  let arrived = false, samples = 0;
  while (Date.now() - t0 < timeoutMs) {
    const [x, y, z] = await pos();
    if (y > maxY) maxY = y;
    if (y < minY) minY = y;
    const dx = tx - x, dz = tz - z;
    if (samples < 5 || samples % 15 === 0)
      console.log(`  .. walk sample ${samples}: ${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)} dist ${Math.hypot(dx, dz).toFixed(1)}`);
    samples++;
    if (Math.hypot(dx, dz) < 1.1) { arrived = true; break; }
    await evalJs(`NOVA_FOX3.state.yaw = ${Math.atan2(-dx, -dz)}`);
    await sleep(400);
  }
  await keyUp(fwd[0], fwd[1]);
  return { arrived, maxY, minY };
}

try {
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
  await send("Runtime.enable");
  await send("Page.enable");
  // A phone: portrait, touch on.
  await send("Emulation.setDeviceMetricsOverride", {
    width: 400, height: 800, deviceScaleFactor: 1, mobile: true,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Page.navigate", { url: URL });
  let booted = false;
  for (let i = 0; i < 60 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
  }
  check("page boots on a phone viewport, NOVA_FOX3 handle present", booted);
  await sleep(800);
  // Step the splash aside with a world tap, as a thumb does.
  await tapAt(200, 300);
  check("splash dismissed by a touch", await waitFor("!NOVA_FOX3.state.splash", 5000, "splash dismissed"));

  // ---- the console, by touch ------------------------------------
  check("console button found on screen", await tapEl("#btn-console"));
  check("console OPENED by tapping its on-screen button",
    await waitFor("NOVA_FOX3.nfConsole.isOpen()", 4000, "console open"));
  check("close button found on screen", await tapEl("#nfconsole-close"));
  check("console CLOSED by tapping its own close button (Will: 'couldn't cancel the console')",
    await waitFor("!NOVA_FOX3.nfConsole.isOpen()", 4000, "console closed by its close button"));
  // The console button toggles both ways.
  await tapEl("#btn-console");
  const reopened = await waitFor("NOVA_FOX3.nfConsole.isOpen()", 4000, "console re-opened");
  await tapEl("#btn-console");
  check("console button toggles shut as well as open",
    reopened && await waitFor("!NOVA_FOX3.nfConsole.isOpen()", 4000, "console toggled shut"));

  // ---- the instrument, by touch ---------------------------------
  const played0 = await evalJs("NOVA_FOX3.state.notesPlayed");
  await tapEl('.notepad[data-note="0"]');
  await tapEl('.notepad[data-note="3"]');
  await tapEl('.notepad[data-note="8"]');
  await sleep(600);
  const played1 = await evalJs("NOVA_FOX3.state.notesPlayed");
  check("three note pads tapped on touch play three notes (1-4-9, the bridge tune)",
    played1 - played0 === 3, `played ${played0} -> ${played1}`);
  check("the touch-played tune opens its rift, exactly as keys do",
    await waitFor("!!NOVA_FOX3.state.rift", 4000, "rift standing from touch tune"));
  // If a stray tap opened the console instead (the pre-fix layout
  // overlap), put it away through the handle so later legs see the
  // world cleanly; the failure is already recorded above.
  if (await evalJs("NOVA_FOX3.nfConsole.isOpen()")) {
    await evalJs("NOVA_FOX3.nfConsole.close()");
    await sleep(300);
  }

  // ---- gravity: the realm stays playable inverted ----------------
  const hp0 = await evalJs("NOVA_FOX3.state.hp");
  await evalJs("NOVA_FOX3.flipGravityHere()");
  check("the flip turns the fox's world (gravDir -1)",
    await waitFor("NOVA_FOX3.state.gravDir === -1", 5000, "gravDir -1"));
  check("the inverted fox lands and stands on the vault (feet at CEIL_Y 46)",
    await waitFor("NOVA_FOX3.state.onGround && Math.abs(NOVA_FOX3.state.pos.y - 46) < 1.5", 12000, "standing on the vault"));
  // Walk the vault: first to directly over the barrow shaft
  // (44-46, 30-32) and STAND there — the pre-fix vault has a hole
  // exactly there and the fox falls out of the world upward.
  const w1 = await walkTo(45.5, 31.0);
  await sleep(2500);
  const [sx1, sy1, sz1] = await pos();
  const hp1 = await evalJs("NOVA_FOX3.state.hp");
  check("vault walk reaches the barrow shaft's column",
    w1.arrived, `pos ${sx1.toFixed(1)},${sy1.toFixed(1)},${sz1.toFixed(1)}`);
  check("standing over the shaft on the vault: still standing, not fallen out of the world",
    await evalJs("NOVA_FOX3.state.onGround") && Math.abs(sy1 - 46) < 1.5 && hp1 === hp0,
    `y=${sy1.toFixed(2)} hp ${hp0} -> ${hp1} maxY ${w1.maxY.toFixed(1)}`);
  // On across the scroll border (scroll edge = 64 blocks).
  const w2 = await walkTo(70, 31);
  const [, sy2] = await pos();
  check("vault traversal crosses a scroll border end-to-end (x >= 69, still on the vault)",
    w2.arrived && Math.abs(sy2 - 46) < 1.5, `y=${sy2.toFixed(2)}`);

  // The Hall, completed from its ceiling. SETUP PLACEMENT: the fox
  // is set inside the hall at floor level (a ground door cannot be
  // entered from the vault side — gravity admits no descent); every
  // step after this is real physics and real keys.
  await evalJs("(() => { const s = NOVA_FOX3.state; s.pos.set(50.5, 9, 35.5); s.vel.set(0, 0, 0); return true; })()");
  check("inside the Hall, the inverted fox rises to and stands on the hall ceiling",
    await waitFor("NOVA_FOX3.state.onGround && Math.abs(NOVA_FOX3.state.pos.y - 11) < 1.2", 12000, "standing on the hall ceiling"));
  await walkTo(60.5, 35.5, 90000);
  let quest = await waitFor("NOVA_FOX3.sub.questDone", 8000, "quest done from the ceiling");
  if (!quest) { // one re-approach in case the guardian shoved the fox
    await walkTo(60.5, 35.5, 60000);
    quest = await waitFor("NOVA_FOX3.sub.questDone", 8000, "quest done from the ceiling (retry)");
  }
  check("the Deep Stone is reached from the hall ceiling — the quest completes inverted", quest);
  // Exit: walk to the shaft's column and let gravity carry the fox
  // up and out; the rise must end standing on the vault, never in
  // open sky (the pre-fix hole again, from inside).
  await walkTo(45.5, 31.5, 90000);
  await centerOn(45.5, 31.5);
  let exitOk = await waitFor(
    "NOVA_FOX3.state.onGround && Math.abs(NOVA_FOX3.state.pos.y - 46) < 1.5",
    12000, "risen out of the shaft, standing on the vault");
  if (!exitOk) { // a drifted rise hangs under the lip: re-center, rise again
    await centerOn(45.5, 31.5);
    exitOk = await waitFor(
      "NOVA_FOX3.state.onGround && Math.abs(NOVA_FOX3.state.pos.y - 46) < 1.5",
      12000, "risen out of the shaft, standing on the vault (retry)");
  }
  const hp2 = await evalJs("NOVA_FOX3.state.hp");
  check("exit up the shaft ends standing on the vault (no fall out of the world)",
    exitOk && hp2 === hp0, `hp ${hp0} -> ${hp2}`);

  // Portals on the vault: the tune opens the ring on the surface
  // the fox stands on, and walking through it crosses.
  await evalJs("NOVA_FOX3.state.yaw = -Math.PI / 2"); // face +x
  await evalJs("NOVA_FOX3.playNote(1)");
  await sleep(200);
  await evalJs("NOVA_FOX3.playNote(4)");
  await sleep(200);
  await evalJs("NOVA_FOX3.playNote(9)");
  await sleep(600);
  const feetY = await evalJs("NOVA_FOX3.state.rift ? NOVA_FOX3.state.rift.feetY : null");
  check("a rift opened on the vault stands on the vault (feetY = CEIL_Y - 1 = 45)",
    feetY === 45, `feetY=${feetY}`);
  const ring = await evalJs("(() => { const r = NOVA_FOX3.state.rift; return r ? [r.x, r.z] : null; })()");
  check("ring standing for the crossing", !!ring);
  const tgt = await evalJs(`(() => { const l = NOVA_FOX3.state.riftLink;
    return l && l.target ? (l.target.type + ":" + (l.target.realmId || "")) : "none"; })()`);
  check("the vault tune resolves to the bridge (a realm target, not the day's pocket)",
    tgt === "realm:ashfall", `target=${tgt}`);
  if (ring) {
    const trace = { stop: false, lines: [] };
    const tracer = (async () => {
      const t0 = Date.now();
      let last = "";
      while (!trace.stop && Date.now() - t0 < 240000) {
        const s = await evalJs(`(() => { const s = NOVA_FOX3.state;
          return [s.realm, s.rift ? s.rift.end : "null", s.riftLink ? s.riftLink.id : "null",
            s.riftLink ? s.riftLink.crosses : "-", s.hp, s.dead ? "DEAD" : "alive", s.gravDir,
            s.pos.x.toFixed(1), s.pos.y.toFixed(1), s.pos.z.toFixed(1)].join(" "); })()`)
          .catch(() => "eval-failed");
        if (s !== last) { trace.lines.push(((Date.now() - t0) / 1000).toFixed(1) + "s " + s); last = s; }
        await sleep(250);
      }
    })();
    const scheme = await evalJs("NOVA_FOX3.state.scheme");
    const fwd = scheme === "AWEF" ? ["f", "KeyF"] : ["w", "KeyW"];
    const [fx0, , fz0] = await pos();
    const adx = ring[0] - fx0, adz = ring[1] - fz0, alen = Math.hypot(adx, adz) || 1;
    await walkTo(ring[0] - adx / alen * 2.4, ring[1] - adz / alen * 2.4, 60000);
    await evalJs(`NOVA_FOX3.state.yaw = ${Math.atan2(-adx, -adz)}`);
    await keyDown(fwd[0], fwd[1]);
    const crossedOut = await waitFor("NOVA_FOX3.state.realm === 'ashfall'", 30000, "crossed to ashfall");
    await keyUp(fwd[0], fwd[1]);
    check("walking through the vault ring crosses to Ashfall Haven", crossedOut);
    // And back through the same standing door: the landing in
    // inverted Nova Prime is the vault, not a 30-block fall up.
    for (let i = 0; i < 5; i++) { // poll: does the return door stand?
      console.log("  .. after the cross (" + i + "): " + await evalJs(`(() => { const s = NOVA_FOX3.state;
        return "realm=" + s.realm + " rift=" + (s.rift ? s.rift.end + "@" + s.rift.x.toFixed(1) + "," + s.rift.z.toFixed(1) : "null") +
          " link=" + (s.riftLink ? s.riftLink.id : "null") + " pos=" + s.pos.x.toFixed(1) + "," + s.pos.y.toFixed(1) + "," + s.pos.z.toFixed(1); })()`));
      if (await evalJs("!!(NOVA_FOX3.state.rift && NOVA_FOX3.state.riftLink)")) break;
      await sleep(2000);
    }
    const beyond = await evalJs(`(() => { const s = NOVA_FOX3.state, r = s.rift, l = s.riftLink;
      if (!r || !l) return null; const end = l[r.end === 'a' ? 'a' : 'b'];
      const dx = r.x - end.landX, dz = r.z - end.landZ; const len = Math.hypot(dx, dz) || 1;
      return [r.x + dx / len * 3, r.z + dz / len * 3]; })()`);
    if (beyond) {
      const ringB = await evalJs("(() => { const r = NOVA_FOX3.state.rift; return r ? [r.x, r.z] : null; })()");
      const [bx0, , bz0] = await pos();
      const bdx = ringB[0] - bx0, bdz = ringB[1] - bz0, blen = Math.hypot(bdx, bdz) || 1;
      await walkTo(ringB[0] - bdx / blen * 2.4, ringB[1] - bdz / blen * 2.4, 60000);
      await evalJs(`NOVA_FOX3.state.yaw = ${Math.atan2(-bdx, -bdz)}`);
      await keyDown(fwd[0], fwd[1]);
      const back = await waitFor("NOVA_FOX3.state.realm === 'nova'", 30000, "crossed back to nova");
      await keyUp(fwd[0], fwd[1]);
      let minY = Infinity;
      const t0 = Date.now();
      while (Date.now() - t0 < 3000) {
        const [, y] = await pos();
        if (y < minY) minY = y;
        await sleep(250);
      }
      check("crossing back lands ON the vault (never dropped to the ground first)",
        back && minY > 40, `minY after return ${minY.toFixed(1)}`);
      check("and settles standing on the vault",
        await waitFor("NOVA_FOX3.state.onGround && Math.abs(NOVA_FOX3.state.pos.y - 46) < 1.5", 10000, "standing on the vault after return"));
    } else {
      check("return ring readable for the way back", false);
    }
    trace.stop = true;
    await tracer;
    for (const l of trace.lines) console.log("  .. trace " + l);
  }

  // ---- a running probe, cancelled from touch ---------------------
  await evalJs("NOVA_FOX3.nfConsole.open()");
  await evalJs("(() => { NOVA_FOX3.nfConsole.run('runall'); return true; })()");
  const busy = await waitFor("NOVA_FOX3.nfConsole.busy()", 8000, "runall busy");
  check("runall starts and reports busy", busy);
  await sleep(600);
  const stopFound = await tapEl("#nfconsole-stop");
  check("a stop control exists on the console while a probe runs", stopFound);
  const cancelled = await waitFor("!NOVA_FOX3.nfConsole.busy()", 6000, "probe cancelled");
  check("tapping stop cancels the running probe", cancelled);
  if (!cancelled) { // pre-fix shape: let it finish so the run can end cleanly
    await waitFor("!NOVA_FOX3.nfConsole.busy()", 60000, "probe finished on its own");
  } else {
    const [ax, , az] = await pos();
    await sleep(800);
    const [bx, , bz] = await pos();
    check("a cancelled probe releases the fox (he stops walking)",
      Math.hypot(bx - ax, bz - az) < 0.6, `moved ${Math.hypot(bx - ax, bz - az).toFixed(2)} after cancel`);
  }
  await tapEl("#nfconsole-close");
  check("console closes after the cancelled run",
    await waitFor("!NOVA_FOX3.nfConsole.isOpen()", 4000, "console closed at the end"));

  check("zero console errors throughout", consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(" | "));
} catch (err) {
  fail++;
  console.log(`FAIL  probe aborted: ${err && err.message ? err.message : err}`);
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  try { chrome.kill(); } catch (e) { /* already gone */ }
  process.exit(fail ? 1 : 0);
}
