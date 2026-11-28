// Nova Fox demo34 — EE 1034 feedback-batch legs, in headless Chrome
// over CDP (the probe-1023 pattern; run via the Jenkins job
// nova-fox-e2e-demo34-probe). Drives the real input path.
// Legs: item purpose at pickup + the field guide (2) — the tunnel
// transit: craft on open, walk the bore, cross, permanence, cross
// back through the SAME tunnel, step back out unmakes it (1) —
// monster threat: hp 2, pack aggro, battle cues, the contact
// telegraph (3) — coins visible: the purse, minting seen, paid in
// full (4) — flight: locked refusal, paid flight under both
// gravities (5).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9416);
const URL = process.env.NF_URL || pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "index.html")).href;

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "novafox34-probe-"));
const POLICY = process.env.NF_POLICY ||
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policyExists = existsSync(POLICY);
const policySha = policyExists
  ? createHash("sha256").update(readFileSync(POLICY)).digest("hex") : null;
const chromeArgs = [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
];
if (policyExists) {
  chromeArgs.push(
    `--hatch-webgl-allowed-domains-file=${POLICY}`,
    `--hatch-webgl-allowed-domains-sha256=${policySha}`);
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
// Face the standing ring (the probe-1023 aiming formula).
async function faceRift() {
  await evalJs(`(() => {
    const F = window.NOVA_FOX3, r = F.state.rift;
    F.state.yaw = Math.atan2(-(r.x - F.state.pos.x), -(r.z - F.state.pos.z));
    return true;
  })()`);
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

  await evalJs("localStorage.setItem('nf.scheme', 'wasd')");
  await send("Page.reload");
  booted = false;
  for (let i = 0; i < 60 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
  }
  check("the pinned boot returns (WASD)", booted &&
    (await evalJs("NOVA_FOX3.state.scheme")) === "WASD");
  await sleep(800);
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(300);
  check("splash bypassed", (await evalJs("NOVA_FOX3.state.splash")) === false);
  // a real player's click: the mousedown is what unlocks the sfx context
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 640, y: 360, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 640, y: 360, button: "left", clickCount: 1 });
  await sleep(300);

  // --- Item 4 (free purse): the balance stands on screen from boot ------------
  const purse0 = await evalJs("document.getElementById('purse').textContent");
  check("coins: the purse stands in the HUD from boot, naming flux and credits",
    /flux/.test(purse0) && /credit/.test(purse0), purse0);

  // --- Item 2: the sword explains itself at pickup ------------------------------
  await evalJs("NOVA_FOX3.state.yaw = Math.atan2(-(11 - NOVA_FOX3.state.pos.x), -(10 - NOVA_FOX3.state.pos.z))");
  const gotSword = await walkUntil("w", "KeyW",
    "NOVA_FOX3.equipState().weapon === 'sword'", 15000, "walking to the Small Sword");
  check("the Small Sword is picked up near the spawn", gotSword);
  const comms = await evalJs("document.getElementById('comms').textContent");
  check("item purpose: the pickup card says what the sword is FOR and how it is used",
    /strikes with/.test(comms) && /swap what the hand holds/.test(comms), comms.slice(0, 160));

  // --- Item 2: the field guide stands in the board --------------------------------
  await key("b", "KeyB");
  await sleep(500);
  const guide = await evalJs("document.getElementById('board-guide').textContent");
  check("item purpose: the field guide names the weapons and the ladder's rungs",
    /Small Sword/.test(guide) && /Star Lance/.test(guide) && /credits/.test(guide),
    guide.slice(0, 120));
  await key("b", "KeyB");
  await sleep(300);

  // --- Item 5 (locked): flight refuses, and names its keepers ----------------------
  await key("h", "KeyH");
  await sleep(400);
  const lockedComms = await evalJs("document.getElementById('comms').textContent");
  check("flight: a free fox is refused, in words that name purchase alone (EE 1338)",
    (await evalJs("NOVA_FOX3.flightState().flying")) === false &&
    /Flight is not yours yet/.test(lockedComms) && /bought the game/.test(lockedComms) &&
    !/kills the dragon/.test(lockedComms),
    lockedComms.slice(0, 120));

  // --- Item 1: the tunnel — craft on open, walk the bore, cross ----------------------
  await evalJs("NOVA_FOX3.state.yaw = 0");
  await key("m", "KeyM");
  await sleep(300);
  await evalJs("document.querySelector('[data-portal=\\\"ashfall\\\"]').click()");
  await sleep(600);
  const tun0 = await evalJs("NOVA_FOX3.tunnelsState()");
  check("wormholes: opening a rift crafts a standing tunnel (shared record, at once)",
    tun0.standing >= 1 && !!tun0.link, JSON.stringify(tun0));
  const linkKey = tun0.link;
  let sawTransit = false;
  await keyDown("w", "KeyW");
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      if (await evalJs("NOVA_FOX3.inTransit()")) sawTransit = true;
      if ((await evalJs("NOVA_FOX3.state.realm")) === "ashfall") break;
      await sleep(300);
    }
  }
  await keyUp("w", "KeyW");
  check("the crossing is a WALK: stepping in begins a transit the fox walks himself",
    sawTransit && (await evalJs("NOVA_FOX3.state.realm")) === "ashfall");
  check("the crossing counted, on the same link",
    (await evalJs("NOVA_FOX3.state.riftLink.crosses")) >= 1);
  const tun1 = await evalJs("NOVA_FOX3.tunnelsState()");
  check("permanence: the tunnel still stands after the crossing — it was not consumed",
    tun1.standing === tun0.standing && tun1.link === linkKey, JSON.stringify(tun1));

  // --- Item 1: cross back through the SAME standing tunnel ---------------------------
  await faceRift();
  const back = await walkUntil("w", "KeyW", "NOVA_FOX3.state.realm === 'nova'", 45000, "the walk home through the tunnel");
  const tun2 = await evalJs("NOVA_FOX3.tunnelsState()");
  check("crossing back rides the same standing tunnel — no new craft, none consumed",
    back && tun2.standing === tun0.standing && tun2.link === linkKey, JSON.stringify(tun2));

  // --- Item 1: stepping back out unmakes the crossing ----------------------------------
  await faceRift();
  await key("m", "KeyM");
  await sleep(300);
  await evalJs("document.querySelector('[data-portal=\\\"ashfall\\\"]').click()");
  await sleep(600);
  const tun3 = await evalJs("NOVA_FOX3.tunnelsState()");
  check("re-opening at the same mouth is SERVED by the standing tunnel (no re-craft)",
    tun3.standing === tun0.standing && tun3.link === linkKey, JSON.stringify(tun3));
  const entered = await walkUntil("w", "KeyW", "NOVA_FOX3.inTransit()", 30000, "stepping into the bore again");
  check("the bore takes the fox again", entered);
  await keyDown("s", "KeyS");
  const aborted = await waitFor("!NOVA_FOX3.inTransit()", 9000, "backing out of the bore");
  await keyUp("s", "KeyS");
  check("stepping back out unmakes the crossing — uncrossed, still home",
    aborted && (await evalJs("NOVA_FOX3.state.realm")) === "nova" &&
    (await evalJs("NOVA_FOX3.state.riftLink.crosses")) === 0);
  const crossed3 = await walkUntil("w", "KeyW", "NOVA_FOX3.state.realm === 'ashfall'", 45000, "the third walk through");
  check("and the tunnel takes him through again — it stands", crossed3);

  // --- Item 3: monsters — pack aggro, battle cues, the telegraph -----------------------
  await evalJs("NOVA_FOX3.state.pos.x += 130");
  await sleep(600);
  await key(" ", "Space"); // a first jump, landed, lifts the Arrival ward's gate
  await sleep(900);
  // the ward also holds while the opening lines play — a real player's first
  // fight comes after them; wait for the same truth here
  const wardLifted = await waitFor(
    "NOVA_FOX3.state.firstJumpDone && performance.now() > NOVA_FOX3.state.introUntil + 1200",
    150000, "the Arrival ward lifting");
  check("monsters: the Arrival ward has lifted — the fox can be hurt now", wardLifted);
  await evalJs(`(() => {
    const F = window.NOVA_FOX3;
    const gx = Math.floor(F.state.pos.x / 2) + 1, gz = Math.floor(F.state.pos.z / 2);
    window.__m1 = F.sub.spawnMonster(F.state.realm, gx, gz, "surface");
    window.__m2 = F.sub.spawnMonster(F.state.realm, gx + 3, gz, "surface");
    // stand the fox on the monster's own column, at its center — the
    // contact a hunter makes when it reaches the fox in real play
    // (an off-column stand on unknown slopes silently fails the
    // game's |dy| reach gate, which is the game's truth, not a bug)
    F.state.pos.x = __m1.gx * 2 + 1.5;
    F.state.pos.z = __m1.gy * 2 + 1.5;
    return true;
  })()`);
  await sleep(700); // settle onto that column's ground
  // The telegraph first, while the touch is fresh (the strike and
  // the battle checks follow — a landed hit would muddy both).
  const hp0 = await evalJs("NOVA_FOX3.state.hp");
  await sleep(150);
  const hpEarly = await evalJs("NOVA_FOX3.state.hp");
  check("the telegraph: a fresh touch cannot land inside its first moments",
    hpEarly === hp0, `hp ${hp0} -> ${hpEarly}`);
  const dropped = await waitFor("NOVA_FOX3.state.hp < " + hp0, 3500, "the dwelt touch lands");
  const hp1 = await evalJs("NOVA_FOX3.state.hp");
  const geo = dropped ? "" : await evalJs(`JSON.stringify({
    fox: NOVA_FOX3.foxPos(),
    m1: { gx: __m1.gx, gy: __m1.gy, alive: __m1.alive, engaged: __m1.engaged },
    m2: { gx: __m2.gx, gy: __m2.gy, alive: __m2.alive } })`);
  check("the dwelt touch lands — one hit, two points, pressure to respect",
    dropped && hp1 === hp0 - 2, `hp ${hp0} -> ${hp1} ${geo}`);
  await evalJs("NOVA_FOX3.sub.strikeMonster(window.__m1)");
  const m1 = await evalJs("({ alive: __m1.alive, hp: __m1.hp, aggro: __m1.aggro })");
  const m2 = await evalJs("({ aggro: __m2.aggro })");
  check("monsters: a surface thing holds through one strike now (hp 2)",
    m1.alive === true && m1.hp === 1, JSON.stringify(m1));
  check("monsters: the pack answers a blow — the neighbor shares the grudge",
    m1.aggro === true && m2.aggro === true, JSON.stringify({ m1, m2 }));
  const battleOn = await waitFor("NOVA_FOX3.battleState().on", 5000, "battle mode engages");
  const bst = await evalJs("NOVA_FOX3.battleState()");
  check("battle audio: entering combat cues (and the state stands)",
    battleOn && bst.ins >= 1, JSON.stringify(bst));
  await evalJs("NOVA_FOX3.state.pos.x += 200");
  const battleOff = await waitFor("!NOVA_FOX3.battleState().on", 5000, "combat ends with distance");
  const bst2 = await evalJs("NOVA_FOX3.battleState()");
  check("battle audio: leaving combat cues, differently",
    battleOff && bst2.outs >= 1, JSON.stringify(bst2));

  // --- Item 4: minting is seen as it happens --------------------------------------------
  // Top the drip fraction to just under a whole flux, honestly —
  // through the game's own accrual — so the next natural ecoTick
  // mints exactly one, in view.
  const tokensBefore = await evalJs(`(() => {
    const F = window.NOVA_FOX3;
    F.ecoAccrue(180);
    const fr = F.ecoState().frac.drip;
    if (fr < 0.99) F.ecoAccrue((0.99 - fr) * 180);
    return F.ecoState().tokens;
  })()`);
  await key("l", "KeyL"); await key("l", "KeyL"); // hands on the game: active play
  const mintedSeen = await waitFor(
    "!!document.querySelector('#coinfloat .coinfloat')", 20000, "a mint floater rises");
  const purse1 = await evalJs("document.getElementById('purse').textContent");
  check("coins: accrual is SEEN as it happens — a floater, and the purse moves",
    mintedSeen && new RegExp(`${tokensBefore + 1} flux`).test(purse1),
    `tokensBefore=${tokensBefore} purse=${purse1.slice(0, 80)}`);

  // --- Item 4: paid in full, visible -------------------------------------------------------
  await evalJs("NOVA_FOX3.eco.entitlement.status = 'paid'; NOVA_FOX3.eco.entitlement.purchaseNumber = 7;");
  const paidSeen = await waitFor(
    "/paid in full/.test(document.getElementById('purse').textContent)", 9000, "the purse names the paid standing");
  const purse2 = await evalJs("document.getElementById('purse').textContent");
  check("coins: a paid player's standing is on screen — generator, numbered, paid in full",
    paidSeen && /Generator № 7/.test(purse2), purse2.slice(0, 120));
  await evalJs("document.getElementById('purse').click()");
  await sleep(500);
  const boardOpen = await evalJs("getComputedStyle(document.getElementById('board')).display");
  const shop = await evalJs("document.getElementById('board-shop').textContent");
  check("coins: spending is one click from the purse — the ladder shop stands open",
    boardOpen !== "none" && /buy/.test(shop), `display=${boardOpen}`);
  await key("b", "KeyB");
  await sleep(300);

  // --- Item 5 (paid): flight, under both gravities ------------------------------------------
  await key("h", "KeyH");
  await sleep(300);
  check("flight: the paid fox's key opens the sky",
    (await evalJs("NOVA_FOX3.flightState().flying")) === true &&
    (await evalJs("NOVA_FOX3.flightState().gate.via")) === "paid");
  const y0 = await evalJs("NOVA_FOX3.state.pos.y");
  await keyDown(" ", "Space");
  await sleep(1400);
  await keyUp(" ", "Space");
  const y1 = await evalJs("NOVA_FOX3.state.pos.y");
  check("flight: holding jump rises, away from the ground", y1 > y0 + 2, `y ${y0.toFixed(1)} -> ${y1.toFixed(1)}`);
  await sleep(900);
  const y2 = await evalJs("NOVA_FOX3.state.pos.y");
  check("flight: released, the fox hovers", Math.abs(y2 - y1) < 0.9, `y ${y1.toFixed(1)} -> ${y2.toFixed(1)}`);
  await key("h", "KeyH");
  await sleep(1100);
  const y3 = await evalJs("NOVA_FOX3.state.pos.y");
  check("flight: toggled off, gravity takes him again", y3 < y2 - 1, `y ${y2.toFixed(1)} -> ${y3.toFixed(1)}`);
  // inverted: down is up — rising is toward the world's floor side
  await waitFor("NOVA_FOX3.state.onGround", 6000, "landed again");
  await key("g", "KeyG");
  const flipped = await waitFor("NOVA_FOX3.state.gravDir === -1", 9000, "gravity inverts");
  await waitFor("NOVA_FOX3.state.onGround", 9000, "standing on the vault");
  check("gravity inverts for the flight leg", flipped);
  await key("h", "KeyH");
  await sleep(300);
  const iy0 = await evalJs("NOVA_FOX3.state.pos.y");
  await keyDown(" ", "Space");
  await sleep(1400);
  await keyUp(" ", "Space");
  const iy1 = await evalJs("NOVA_FOX3.state.pos.y");
  check("flight inverted: holding jump rises AWAY from the vault (world-y falls)",
    (await evalJs("NOVA_FOX3.flightState().flying")) === true && iy1 < iy0 - 2,
    `y ${iy0.toFixed(1)} -> ${iy1.toFixed(1)}`);
  await key("h", "KeyH");

  check("no console errors across the EE 1034 legs", consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(" | "));
} catch (err) {
  fail++;
  console.log(`FAIL  probe aborted: ${err.message}`);
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  try { ws && ws.close(); } catch (e) { /* already closed */ }
  chrome.kill("SIGKILL");
  process.exit(fail ? 1 : 0);
}
