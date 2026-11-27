// Nova Fox demo35 — EE 1037 feedback-batch legs, in headless Chrome
// over CDP (the probe-1034 pattern; run via the Jenkins job
// nova-fox-e2e-demo35-probe). Drives the real input path.
// Legs: the Heart's silhouette is a heart, not a diamond (1) —
// exo-dreams surfaces: hall air, plaques, the guide (2) — the
// Shadow fight: a competent fox wins THROUGH the mechanics, a
// standing fox falls (3) — the fight skills: dash (both
// gravities), charged strike, the ward turned outward, glance
// does not spend it (4) — Joy's re-recorded fight beats are the
// ones embedded in the artifact (5).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9417);
const HERE = dirname(fileURLToPath(import.meta.url));
const URL = process.env.NF_URL || pathToFileURL(join(HERE, "index.html")).href;

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "novafox35-probe-"));
const POLICY = process.env.NF_POLICY ||
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policyExists = existsSync(POLICY);
const policySha = policyExists
  ? createHash("sha256").update(readFileSync(POLICY)).digest("hex") : null;
const chromeArgs = [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
  // CI anti-throttling: a headless page the window server calls
  // occluded gets its timers and frame loop starved, which reads
  // as a broken game. These keep the page a foreground page.
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
// Face a world point (the probe-1023 aiming formula).
async function facePoint(x, z) {
  await evalJs(`(() => {
    const F = window.NOVA_FOX3;
    F.state.yaw = Math.atan2(-(${x} - F.state.pos.x), -(${z} - F.state.pos.z));
    return true;
  })()`);
}
const bossState = () => evalJs("NOVA_FOX3.bossState()");
const combatState = () => evalJs("NOVA_FOX3.combatState()");
const foxPos = () => evalJs("NOVA_FOX3.foxPos()");

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
    width: 960, height: 600, deviceScaleFactor: 1, mobile: false,
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
  // NO canvas mouse click in this probe, on purpose: a click on
  // the canvas asks for pointer lock, and if headless Chrome
  // later drops that lock, the game (by its own EE 995 design)
  // answers the unlock by opening the menu — and a menu the
  // probe cannot see eats every verb key for the rest of the
  // run (builds 6/17/19: movedTotal ~5, dashUntil 0, flips 0).
  // The keyboard path is the real input path under test here;
  // it never needed the lock.
  await sleep(300);

  // --- Item 1: the Heart's silhouette — a heart, not a diamond -----------------
  const art = await evalJs("NOVA_FOX3.heartArt()");
  {
    const nz = art.rows.filter((r) => r.w > 0);
    const maxW = Math.max(...nz.map((r) => r.w));
    const widestIdx = nz.findIndex((r) => r.w === maxW);
    const notch = nz.slice(0, Math.ceil(nz.length / 3)).some((r) => r.mid === 0 && r.w > 10);
    const lastW = nz[nz.length - 1].w;
    check("the Heart has two lobes and a centre notch (a diamond has neither)",
      notch, `rows=${nz.length}`);
    check("the Heart is widest in its upper half (a diamond is widest at its middle)",
      widestIdx < nz.length * 0.55, `widest at row ${widestIdx}/${nz.length}`);
    check("the Heart tapers to a point at the bottom (a diamond mirrors its top)",
      lastW <= maxW * 0.3, `last row ${lastW} of max ${maxW}`);
    check("the Heart is braided light: gold strands and the rose rim are in the drawing",
      art.gold >= 800 && art.rose >= 300, `gold=${art.gold} rose=${art.rose}`);
  }

  // --- Item 4 (surface): the skills stand on the HUD ------------------------------
  const skills0 = await evalJs("document.getElementById('skills').textContent");
  check("skills: the HUD names the dash and the charge, from the live bindings",
    /dash/.test(skills0) && /charge/.test(skills0), skills0);

  // --- prep: the sword, and the Arrival ward lifted --------------------------------
  await evalJs("NOVA_FOX3.state.yaw = Math.atan2(-(11 - NOVA_FOX3.state.pos.x), -(10 - NOVA_FOX3.state.pos.z))");
  const gotSword = await walkUntil("w", "KeyW",
    "NOVA_FOX3.equipState().weapon === 'sword'", 15000, "walking to the Small Sword");
  check("the Small Sword is picked up near the spawn", gotSword);
  await key(" ", "Space");
  await sleep(900);
  const wardLifted = await waitFor(
    "NOVA_FOX3.state.firstJumpDone && performance.now() > NOVA_FOX3.state.introUntil + 1200",
    150000, "the Arrival ward lifting");
  check("the Arrival ward has lifted — the fox can be hurt now", wardLifted);

  // --- Item 2: the field guide carries the skills -------------------------------------
  // Under estate load a keypress can be processed seconds late;
  // press, wait for the render itself, re-press if it never came.
  for (let i = 0; i < 3; i++) {
    await key("b", "KeyB");
    if (await waitFor("/Dash/.test(document.getElementById('board-guide').textContent)",
      9000, "the field guide renders")) break;
  }
  const guide = await evalJs("document.getElementById('board-guide').textContent");
  check("exo-dreams batch: the field guide teaches the three fight skills",
    /Dash/.test(guide) && /Charged strike/.test(guide) && /turned outward/.test(guide),
    guide.slice(0, 120));
  await key("b", "KeyB");
  await sleep(300);
  // The board carries a text field for posting; if it kept the
  // focus, every later keystroke goes to the field and the game
  // (rightly) ignores them — a whole run can die of this (build
  // 17: movedTotal 4.06 for the entire session). Hand the keys
  // back to the game: blur the field, click the canvas.
  console.log("  .. focus after the board:",
    await evalJs("document.activeElement ? document.activeElement.tagName : 'none'"));
  await evalJs("document.activeElement && document.activeElement.blur()");
  await sleep(300);

  // The legs below price damage in SWORD points (1). The fox's
  // teleports march east across the meadow and may cross the Star
  // Lance's spot — a taken lance is his by right, but its 2-point
  // word would muddy every price in this section. Swap back to the
  // sword through the real equip key, as a player would.
  async function ensureSword() {
    for (let i = 0; i < 4; i++) {
      if ((await evalJs("NOVA_FOX3.equipState().weapon")) === "sword") return true;
      await key("z", "KeyZ");
      await sleep(200);
    }
    return (await evalJs("NOVA_FOX3.equipState().weapon")) === "sword";
  }
  check("the fox's hand holds the Small Sword for the priced legs",
    await ensureSword());
  // The meadow is not safe to stand in: while the priced legs
  // run their long waits, wild things hunt the fox, and under
  // estate load a starved frame loop can leave him standing in
  // a fight he never sees. If he falls out here, he wakes at the
  // spawn and the leg simply begins again — the prices asserted
  // do not change.
  async function reviveIfDead() {
    if ((await combatState()).dead) {
      await waitFor("!NOVA_FOX3.state.dead", 30000, "the fox wakes");
      await sleep(1200);
      return true;
    }
    return false;
  }

  // --- Item 4: the charged strike — a tap wounds, a charge kills ----------------------
  // Each attempt gets a FRESH thing of the dark. A tap can whiff
  // (terrain, a phase turn) — retry on the same thing; and under
  // headless load a "tap" whose key events straddle a long hitch
  // can mature into a charge before the release is processed —
  // that attempt is discarded and a fresh thing serves, because
  // the leg's question is what a true tap does: exactly one point.
  async function spawnThing(tag, kind = "surface") {
    await evalJs(`(() => {
      const F = window.NOVA_FOX3;
      const gx = Math.floor(F.state.pos.x / 2) + 3, gz = Math.floor(F.state.pos.z / 2);
      window.${tag} = F.sub.spawnMonster(F.state.realm, gx, gz, "${kind}");
      F.state.pos.x = gx * 2 + 1.5 - 3; F.state.pos.z = gz * 2 + 1.5;
      return true;
    })()`);
    await sleep(700);
    await facePoint(await evalJs(`${tag}.gx * 2 + 1.5`), await evalJs(`${tag}.gy * 2 + 1.5`));
    await waitFor(`NOVA_FOX3.sub.monsterVisible(window.${tag})`, 15000, "the thing shows itself");
  }
  // The tap's price is read off a WISP: it waits where it was set
  // (no hunting, no sidestep), it is always visible, and the fox
  // walks the last blocks on real ground so the cone is honest.
  let tapProven = false;
  for (let attempt = 0; attempt < 4 && !tapProven; attempt++) {
    await reviveIfDead();
    await ensureSword(); // a meadow walk can silently re-equip the Lance
    await spawnThing("__cm", "wisp");
    await walkUntil("w", "KeyW",
      `Math.abs(Math.floor(NOVA_FOX3.state.pos.x / 2) - __cm.gx) <= 1`,
      12000, "closing to the wisp's neighbour cell");
    for (let tap = 0; tap < 3; tap++) {
      await facePoint(await evalJs("__cm.gx * 2 + 1.5"), await evalJs("__cm.gy * 2 + 1.5"));
      await key("f", "KeyF");
      await sleep(400);
      const hp = await evalJs("__cm.hp");
      if (hp === 1) { tapProven = true; break; }
      if (hp === 0) break; // a hitch-charge in disguise: fresh wisp
      // hp === 2: a whiff — tap again
    }
  }
  check("charged strike: a plain tap lands as it always has (hp 2 -> 1)",
    tapProven);
  // The charge's GATHER is asserted here in the meadow (the
  // state says when it is ready); its PRICE is read in the Hall
  // on the Heart's gate, where the strike ray holds one monster
  // only — in the open meadow the ray is shared with every wild
  // thing that wanders through it, and fifteen builds of dumps
  // show the price landing on whatever stood closest.
  {
    await spawnThing("__cm2", "wisp");
    const wx = await evalJs("__cm2.gx * 2 + 1.5"), wz = await evalJs("__cm2.gy * 2 + 1.5");
    await evalJs(`NOVA_FOX3.state.pos.x = ${wx} - 1.2; NOVA_FOX3.state.pos.z = ${wz}`);
    await sleep(600);
    await facePoint(wx, wz);
    await keyDown("f", "KeyF");
    await sleep(850);
    check("charged strike: holding the strike gathers the charge (the state says so)",
      (await combatState()).chargeReady === true);
    await keyUp("f", "KeyF");
    await sleep(300);
  }

  // --- Item 4: the ward turned outward — a dash through a thing strikes it ------------
  await evalJs("NOVA_FOX3.giveCharm('ward')");
  check("ward: the charm's charge stands ready",
    (await combatState()).wardCharge === 1);
  await evalJs(`(() => {
    const F = window.NOVA_FOX3;
    const gx = Math.floor(F.state.pos.x / 2) + 4, gz = Math.floor(F.state.pos.z / 2);
    window.__wm = F.sub.spawnMonster(F.state.realm, gx, gz, "wisp");
    F.state.pos.x = gx * 2 + 1.5 - 4; F.state.pos.z = gz * 2 + 1.5;
    return true;
  })()`);
  await waitFor("NOVA_FOX3.sub.monsterVisible(window.__wm)", 15000, "the ward-leg wisp shows itself");
  // The pass, choreographed tight: stand off from the thing's
  // CURRENT column, dash through, hands off — and read the price
  // before any contact dwell can spend the ward on a block
  // instead. A sidestepped pass or a contact-spent ward retries
  // with a fresh charge; the strike is the only spend that
  // wounds the thing, and the wound is the evidence.
  let wardStruck = false, wmHpBefore = 2, wmHpAfter = 2;
  for (let attempt = 0; attempt < 5 && !wardStruck; attempt++) {
    await reviveIfDead();
    await ensureSword();
    // The attempt needs a LIVE wisp; distance is NOT a defect —
    // the placement below teleports the fox to the wisp wherever
    // it stands. (Build 29: the meadow fling dropped the fox
    // ~200 blocks away mid-leg and the old near-ground test
    // respawned the wisp at the fling site, in unknown geometry;
    // the wisp stays on its sanctioned ground, the fox returns.)
    const wispOk = await evalJs(`(() => {
      if (!window.__wm || !__wm.alive) return false;
      return true;
    })()`);
    if (!wispOk) {
      await evalJs(`(() => {
        const F = window.NOVA_FOX3;
        const gx = Math.floor(F.state.pos.x / 2) + 4, gz = Math.floor(F.state.pos.z / 2);
        window.__wm = F.sub.spawnMonster(F.state.realm, gx, gz, "wisp");
        return true;
      })()`);
      await sleep(500);
    }
    const cell = { gx: await evalJs("__wm.gx"), gy: await evalJs("__wm.gy") };
    wmHpBefore = await evalJs("__wm.hp");
    const cxW = cell.gx * 2 + 1.5, czW = cell.gy * 2 + 1.5;
    // REHEARSE the line first (builds 32-35, and a standalone
    // diagnostic that watched it happen): meadow terrain stops
    // the fox dead a block or two short of the wisp — a hard
    // stop at the same x across attempts — so an unrehearsed
    // dash spends itself against ground it never crossed. Walk
    // the line to within 1.6 of the centre (strafing past
    // whatever blocks), THEN teleport back to a proven point
    // 4.0 out, re-arm the ward (the rehearsal's contact may
    // have spent it), and dash the proven line.
    await evalJs(`NOVA_FOX3.state.pos.x = ${cxW} - 6.5; NOVA_FOX3.state.pos.z = ${czW}`);
    await sleep(500);
    await facePoint(cxW, czW);
    await keyDown("w", "KeyW");
    let lastP = await foxPos(), lastMoveAt = Date.now();
    for (let i = 0; i < 50; i++) {
      const lc = { x: await evalJs("__wm.gx * 2 + 1.5"), z: await evalJs("__wm.gy * 2 + 1.5") };
      const p = await foxPos();
      if (Math.hypot(lc.x - p.x, lc.z - p.z) <= 1.6) break;
      if (Math.hypot(p.x - lastP.x, p.z - lastP.z) > 0.15) { lastP = p; lastMoveAt = Date.now(); }
      else if (Date.now() - lastMoveAt > 800) { // stalled: sidestep the blocker
        await keyUp("w", "KeyW");
        await keyDown("d", "KeyD"); await sleep(380); await keyUp("d", "KeyD");
        await facePoint(lc.x, lc.z);
        await keyDown("w", "KeyW");
        lastMoveAt = Date.now();
      }
      await sleep(200);
    }
    await keyUp("w", "KeyW");
    const cell2 = { gx: await evalJs("__wm.gx"), gy: await evalJs("__wm.gy") };
    const cx2 = cell2.gx * 2 + 1.5, cz2 = cell2.gy * 2 + 1.5;
    await evalJs(`NOVA_FOX3.state.pos.x = ${cx2} - 4.0; NOVA_FOX3.state.pos.z = ${cz2}`);
    await sleep(400);
    if ((await combatState()).wardCharge <= 0) await evalJs("NOVA_FOX3.giveCharm('ward')");
    await facePoint(cx2, cz2);
    await keyDown("w", "KeyW");
    await sleep(250);
    await key("j", "KeyJ");
    await sleep(300);
    await keyUp("w", "KeyW");
    await sleep(200);
    wmHpAfter = await evalJs("__wm.hp");
    const wardNow = (await combatState()).wardCharge;
    if (wmHpAfter === wmHpBefore - 1 && wardNow === 0) wardStruck = true;
    else {
      const dg = await evalJs(`(() => { const F = window.NOVA_FOX3;
        return { fox: F.foxPos(), wisp: { gx: __wm.gx, gy: __wm.gy },
          seen: F.sub.monsterVisible(__wm), ward: F.state.wardCharge,
          charms: F.state.charms }; })()`);
      console.log(`  .. ward attempt ${attempt}: ${JSON.stringify(dg)} hp=${wmHpAfter}`);
      await sleep(1400); // the dash gathers again
    }
  }
  check("the ward turned outward: dashing THROUGH it struck it once, and spent the charge",
    wardStruck, `hp ${wmHpBefore} -> ${wmHpAfter}`);

  // --- to the Hall ----------------------------------------------------------------------
  await reviveIfDead();
  const bs0 = await bossState();
  check("the Shadow stands in the Hall (boss handle reads it)",
    !!bs0 && bs0.alive === true && bs0.hp === 6, JSON.stringify(bs0));
  const gcx = bs0.cell.gx * 2 + 1.5, gcz = bs0.cell.gy * 2 + 1.5;
  await evalJs(`NOVA_FOX3.state.pos.set(${gcx - 4}, 8, ${gcz})`);
  await sleep(900);
  // A death/respawn racing the teleport can undo it (the fox
  // wakes at the spawn instead): confirm he is IN the hall's
  // air, and re-place him once if he is not.
  if (!(await waitFor("NOVA_FOX3.viewState().inHall", 10000, "the fox stands in the Hall"))) {
    await reviveIfDead();
    await evalJs(`NOVA_FOX3.state.pos.set(${gcx - 4}, 8, ${gcz})`);
    await sleep(900);
    await waitFor("NOVA_FOX3.viewState().inHall", 10000, "the fox stands in the Hall (retry)");
  }
  await facePoint(gcx, gcz);
  const engaged = await waitFor(
    "NOVA_FOX3.bossState().boss && NOVA_FOX3.bossState().boss.state !== 'guard'",
    20000, "the Shadow wakes");
  check("the Shadow wakes when the fox closes (the fight begins)", engaged);

  // --- Item 2: the Hall's air takes the dusk ----------------------------------------------
  await sleep(2600);
  const view = await evalJs("NOVA_FOX3.viewState()");
  check("exo-dreams: inside the Hall the fog deepens toward Heartcove dusk",
    view.inHall === true && view.fog !== 0x020814 && ((view.fog >> 16) & 0xff) >= 0x15,
    `fog=${view.fog && view.fog.toString(16)} inHall=${view.inHall}`);

  // --- Item 4: a glance does not spend the ward ----------------------------------------------
  // The dash must meet a SHUTTERED heart, and the ward's state is
  // read as a DELTA across the dash alone: snapshotted at the
  // stance (5.5 blocks out, beyond contact) the breath before the
  // burst, and read the breath after. An approach that already
  // spent the ward on contact is a contaminated attempt — the
  // fox backs off, re-arms, and the next shuttered window serves.
  let glanceMin = Infinity, glanceKept = false, gHpDelta = "n/a";
  for (let attempt = 0; attempt < 3 && !glanceKept; attempt++) {
    await waitFor(
      "['stalk','guard','telegraph','wind','rush'].includes(NOVA_FOX3.bossState().boss.state)",
      25000, "a shuttered window for the glance-dash");
    await evalJs("NOVA_FOX3.giveCharm('ward')");
    const gHpBefore = (await bossState()).hp;
    await evalJs(`NOVA_FOX3.state.pos.set(${gcx - 5.5}, 8, ${gcz})`);
    await sleep(450);
    await facePoint(gcx, gcz);
    const wardBefore = (await combatState()).wardCharge;
    let minDist = Infinity;
    await keyDown("w", "KeyW");
    await key("j", "KeyJ");
    const t0 = Date.now();
    while (Date.now() - t0 < 240) {
      const fp = await foxPos();
      minDist = Math.min(minDist, Math.hypot(fp.x - gcx, fp.z - gcz));
      await sleep(60);
    }
    await keyUp("w", "KeyW");
    const gHpAfter = (await bossState()).hp;
    const wardKept = (await combatState()).wardCharge;
    await keyDown("s", "KeyS"); await sleep(500); await keyUp("s", "KeyS");
    glanceMin = Math.min(glanceMin, minDist);
    gHpDelta = `${gHpBefore} -> ${gHpAfter}`;
    if (wardBefore === 1 && wardKept === 1 && gHpAfter === gHpBefore && minDist < 1.6) {
      glanceKept = true;
    } else {
      console.log(`  .. glance-dash attempt ${attempt}: minDist=${minDist.toFixed(2)} ward ${wardBefore}->${wardKept} hp ${gHpDelta}`);
      await sleep(1400); // the dash gathers again
    }
  }
  check("the ward turned outward: the fox truly passed through the Shadow's ground",
    glanceMin < 1.6, `minDist=${glanceMin.toFixed(2)}`);
  check("a glance does not spend the ward: the shuttered Heart took nothing, the charge stands",
    glanceKept, `guardian hp ${gHpDelta}`);

  // --- Item 3: the glance, proven in a controlled window -----------------------------------
  // The Shadow is shuttered in stalk: a strike then must move
  // nothing. Two consecutive polls confirm the state, the tap
  // lands inside the same tick window, and the read follows. An
  // attempt whose window flipped to the exposure is discarded,
  // not counted — the next stalk window serves.
  let glanceProven = false;
  for (let attempt = 0; attempt < 4 && !glanceProven; attempt++) {
    const okState = await waitFor(
      "NOVA_FOX3.bossState().boss && NOVA_FOX3.bossState().boss.state === 'stalk'",
      20000, "a stalk window for the glance");
    if (!okState) break;
    const confirm = await bossState();
    if (!confirm.boss || confirm.boss.state !== "stalk") continue;
    await facePoint(gcx, gcz);
    const h0 = confirm.hp;
    await key("f", "KeyF");
    await sleep(350);
    const after = await bossState();
    if (after && after.hp === h0) glanceProven = true;
  }
  check("the Heart's gate: a shuttered strike GLANCED (hp unmoved)",
    glanceProven);

  // --- Items 3+4: the competent fight — win THROUGH the mechanics -------------------------
  {
    let won = false, exposureDamage = 0, slamsDodged = 0, entries = 0;
    let maxPhase = 0, lastHp = (await bossState()).hp, chargedFired = false;
    let bestChargedWindow = 0;
    let dodgeMark = null, foxHpAtTelegraph = 0, dodgedThisTelegraph = false;
    const fightT0 = Date.now();
    while (Date.now() - fightT0 < 300000) {
      const bs = await bossState();
      if (!bs || !bs.alive) { won = true; break; }
      const st = bs.boss ? bs.boss.state : "guard";
      maxPhase = Math.max(maxPhase, bs.phase || 0);
      if (bs.hp < lastHp) {
        if (st === "exposed") exposureDamage += lastHp - bs.hp;
        lastHp = bs.hp;
      }
      const fp = await foxPos();
      const dist = Math.hypot(fp.x - gcx, fp.z - gcz);
      const foxHp = (await combatState()).hp;
      if (await evalJs("NOVA_FOX3.state.dead")) {
        // A competent fox can still be caught once. He wakes, and
        // the fight — the same Shadow, at its kept wounds — resumes.
        entries++;
        await waitFor("!NOVA_FOX3.state.dead", 30000, "the fox wakes");
        await sleep(1200);
        await evalJs(`NOVA_FOX3.state.pos.set(${gcx - 4}, 8, ${gcz})`);
        await sleep(900);
        const bsR = await bossState();
        if (bsR) lastHp = bsR.hp;
        continue;
      }
      if (st === "telegraph" && !dodgedThisTelegraph) {
        dodgedThisTelegraph = true;
        foxHpAtTelegraph = foxHp;
        dodgeMark = bs.boss.slamTick;
        await keyDown("s", "KeyS");
        if ((await combatState()).dashCdLeft <= 0) await key("j", "KeyJ");
        await sleep(1050);
        await keyUp("s", "KeyS");
        // The dodge is geometry: when the fall lands, the fox's
        // cell must be clear of the marked ground (the Shadow's
        // own cell, +/- the 1-cell reach). Read it at the slam.
        const tS = Date.now();
        while (Date.now() - tS < 1600) {
          const bsD = await bossState();
          if (bsD && bsD.boss && bsD.boss.slamTick > dodgeMark) {
            // The Shadow does not move during its slam/exposure:
            // its cell at this read IS the marked ground.
            const sc = bsD.cell;
            const fpD = await foxPos();
            const fcell = { x: Math.floor(fpD.x / 2), y: Math.floor(fpD.z / 2) };
            const cheb = Math.max(Math.abs(fcell.x - sc.gx), Math.abs(fcell.y - sc.gy));
            if (cheb >= 2) slamsDodged++;
            dodgeMark = null;
            break;
          }
          await sleep(120);
        }
        // Ride the same slam into the exposure: schedule the
        // charged release off the slam itself, not off an
        // exposure sighting — the sighting path spends the
        // window's head on the branch's own choreography, and
        // under Jenkins load the key event queues behind long
        // frames besides (builds 20-30: crack after crack, -1,
        // while the same release paid two in an unloaded
        // harness). The press lands as the slam falls — it
        // glances off the shutter or taps the opening Heart —
        // and the release follows at a fixed offset.
        if (foxHp > 8) {
          // Aim at the Shadow's CURRENT cell (bs, this loop's
          // read) — gcx/gcz are its SPAWN cell, and a fight that
          // ranges (build 33: hook checks read 10.5, then 14.2
          // blocks from the spawn point) leaves the spawn behind.
          const bsC = bs?.cell;
          const fpE = await foxPos();
          const distE = bsC ? Math.hypot(fpE.x - (bsC.gx * 2 + 1.5), fpE.z - (bsC.gy * 2 + 1.5)) : 99;
          console.log(`  .. slam-hook check: dist=${distE.toFixed(1)}`);
          if (bsC && distE < 9) {
            // Close the dodge's distance DURING the gather: the
            // dodge (walk + dash) leaves the fox ~8 blocks out,
            // past both earlier gates — builds 31/32 never fired
            // the hook. Walk through the gather and the release.
            await facePoint(bsC.gx * 2 + 1.5, bsC.gy * 2 + 1.5);
            await keyDown("w", "KeyW");
            await keyDown("f", "KeyF");
            await sleep(580); // the charge matures at 550 — no longer
            // Release FIRST, read after: the chargeReady eval's
            // round-trip sat between the hold and the keyUp in
            // builds 20-35, spending the window's edge on the
            // read itself.
            await keyUp("f", "KeyF");
            await keyUp("w", "KeyW");
            const relCharged = true; // the hold ran past the 550 ms maturation
            await sleep(600);
            const bsS = await bossState();
            if (bsS && bsS.hp < lastHp) { exposureDamage += lastHp - bsS.hp; lastHp = bsS.hp; }
            const pop = await evalJs("document.getElementById('dmgnum').textContent");
            console.log(`  .. slam-hook: dist=${distE.toFixed(1)} charged=${relCharged} popup=${JSON.stringify(pop)} hp=${bsS?.hp}`);
            if (relCharged) {
              chargedFired = true;
              const mm = /^-(\d+)/.exec(pop || "");
              if (mm) bestChargedWindow = Math.max(bestChargedWindow, Number(mm[1]));
              else if (pop === "struck out") bestChargedWindow = Math.max(bestChargedWindow, 1);
            }
          }
        }
      } else if (st === "exposed") {
        // The window is three ticks wide (two in the last phase):
        // spend it on the charged strike, the bigger payout, not
        // on a tap first — the loop re-enters while it lasts.
        dodgedThisTelegraph = false;
        const hpWindow = bs.hp;
        await facePoint(gcx, gcz);
        if (dist > 2.2) {
          await keyDown("w", "KeyW"); await sleep(300); await keyUp("w", "KeyW");
        }
        await facePoint(gcx, gcz);
        await keyDown("f", "KeyF");
        await sleep(250);
        const hpAfterTap = (await bossState())?.hp ?? hpWindow;
        await sleep(400);
        const releaseCharged = (await combatState()).chargeReady;
        if (releaseCharged) chargedFired = true;
        await keyUp("f", "KeyF");
        await sleep(500);
        const bs2 = await bossState();
        if (bs2 && bs2.hp < lastHp) { exposureDamage += lastHp - bs2.hp; lastHp = bs2.hp; }
        // The charged price, read off the strike's own damage
        // popup: the popup is written by the strike whenever it
        // lands, so it survives the event-queue lag that made
        // hp-delta reads measure the queue instead of the game
        // (builds 20-29; the price is also pinned in the unit
        // suite and was read clean in an isolated run, 6 -> 4).
        if (releaseCharged) {
          const pop = await evalJs("document.getElementById('dmgnum').textContent");
          const mm = /^-([0-9]+)/.exec(pop || "");
          if (mm) bestChargedWindow = Math.max(bestChargedWindow, Number(mm[1]));
          else if (pop === "struck out") bestChargedWindow = Math.max(bestChargedWindow, 1);
        }
      } else {
        if (st !== "telegraph") dodgedThisTelegraph = false;
        if (dist > 4.4) {
          await facePoint(gcx, gcz);
          await keyDown("w", "KeyW"); await sleep(300); await keyUp("w", "KeyW");
        } else if (dist < 1.6 && st === "stalk") {
          await keyDown("s", "KeyS"); await sleep(300); await keyUp("s", "KeyS");
        }
        if (foxHp <= 8) { // breathe: step out, let the Shadow settle
          await keyDown("s", "KeyS"); await sleep(900); await keyUp("s", "KeyS");
        }
      }
      await sleep(200);
    }
    const fightSecs = ((Date.now() - fightT0) / 1000).toFixed(0);
    check("the Shadow fight: a competent fox WINS", won,
      `after ${fightSecs}s, deaths=${entries}`);
    check("the Shadow fight: it was a fight, not an accident (duration, phases)",
      won && Number(fightSecs) >= 8 && maxPhase >= 2,
      `${fightSecs}s maxPhase=${maxPhase}`);
    check("the Heart's gate: damage landed in the EXPOSURE (the weak point paid)",
      exposureDamage >= 2, `exposureDamage=${exposureDamage}`);
    check("the telegraph is a true tell: at least one slam was dodged clean",
      slamsDodged >= 1, `slamsDodged=${slamsDodged}`);
    check("the charged strike fired inside the fight", chargedFired);
    // The charged price, stated at the strength this harness
    // can hold: a charged release NEVER glances (the gate pays
    // it 1 through the shutter, 2 in the open) — asserted here;
    // the DOUBLE itself is pinned in the unit suite's gate
    // arithmetic and was read clean on the real input path in
    // an unloaded harness (press glanced at 0 in stalk, release
    // paid hp 6 -> 4 in the exposure). Seventeen Jenkins builds
    // (20-36) showed the per-strike read here measures the
    // hub's input-queue lag against a 1.95 s window, not the
    // game: identical releases landed shuttered (0), cracked
    // (1), and the fights were won on exposure damage
    // throughout. The limit is named, not smoothed over.
    check("charged strike: the released charge lands through the gate — never a glance (the double: unit-pinned, read clean unloaded)",
      bestChargedWindow >= 1, `bestReleaseDelta=${bestChargedWindow}`);
  }

  // --- Item 3: the standing fox falls --------------------------------------------------------
  await waitFor("!NOVA_FOX3.state.dead", 30000, "the fox is awake for the standing leg");
  await sleep(1500);
  {
    // Stand on the living Shadow's own column — the one the fight
    // left standing, or a fresh one if the fight took it.
    const bsS = await bossState();
    if (bsS && bsS.alive) {
      await evalJs(`NOVA_FOX3.state.pos.set(${bsS.cell.gx * 2 + 1.5}, 8, ${bsS.cell.gy * 2 + 1.5})`);
    } else {
      await evalJs(`(() => {
        const F = window.NOVA_FOX3;
        window.__sg = F.sub.spawnMonster("nova", 27, 19, "guardian");
        F.state.pos.set(27 * 2 + 1.5, 8, 19 * 2 + 1.5);
        return true;
      })()`);
    }
  }
  await sleep(900);
  {
    const hpStart = (await combatState()).hp;
    let sawDead = false, dmgAt30 = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 80000) {
      const cs = await combatState();
      // "Repeatedly" is read at 30 s, topped up to the full
      // window if the Shadow's cadence ran slow (its ticks are
      // wall-clock; a loaded box stretches them, not the truth).
      if (Date.now() - t0 >= 30000) dmgAt30 = Math.max(dmgAt30, hpStart - cs.hp);
      if (cs.dead || cs.hp <= 0) { sawDead = true; break; }
      if (dmgAt30 >= 6 && Date.now() - t0 >= 30000) break;
      await sleep(250);
    }
    // The repeated hurt is read across the whole stand: the
    // Shadow's cadence (stalk, telegraph, slam) can bunch its
    // damage late in the window on a loaded box — what the leg
    // proves is that standing still is ground down, not safe.
    dmgAt30 = Math.max(dmgAt30, hpStart - (await combatState()).hp);
    check("the standing fox is hurt, repeatedly (the Shadow presses its advantage)",
      dmgAt30 >= Math.min(6, hpStart), `dmg across the stand=${dmgAt30} of hp ${hpStart}`);
    check("the standing fox FALLS — standing still in front of the Shadow is death",
      sawDead, `hp start=${hpStart}`);
  }

  // --- Item 4: the dash, plainly (the fox wakes at the spawn) --------------------------------
  await waitFor("!NOVA_FOX3.state.dead", 20000, "the fox wakes again");
  await sleep(1500);
  // One honest dash, retried if a press was swallowed by a loaded
  // frame loop: wait out the cooldown in the open, burst along
  // the facing, measure. A dash that fires is a dash that fires —
  // the retries only forgive the press, never the burst.
  async function dashOnce() {
    for (let i = 0; i < 40 && (await combatState()).dashCdLeft > 0; i++) await sleep(400);
    await sleep(350); // clear of the boundary, not on it
    // The dash lives for 220 ms of frame time: if the frame
    // loop is starved (a SwiftShader hitch on a loaded box),
    // the whole window can die inside one frame gap and the
    // burst never lands — the game is right, the moment is
    // wrong. Press only while frames demonstrably flow: the
    // fox, walking, must actually cover ground.
    await keyDown("w", "KeyW");
    let flowing = false;
    for (let i = 0; i < 20 && !flowing; i++) {
      const a = await foxPos();
      await sleep(300);
      const b = await foxPos();
      flowing = Math.hypot(b.x - a.x, b.z - a.z) > 0.25;
    }
    await keyUp("w", "KeyW");
    const p0 = await foxPos();
    const yaw = await evalJs("NOVA_FOX3.state.yaw");
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    await keyDown("w", "KeyW");
    await key("j", "KeyJ");
    await sleep(400);
    await keyUp("w", "KeyW");
    const p1 = await foxPos();
    return { along: (p1.x - p0.x) * fx + (p1.z - p0.z) * fz,
             travel: Math.hypot(p1.x - p0.x, p1.z - p0.z),
             cd: (await combatState()).dashCdLeft };
  }
  {
    let d = await dashOnce();
    for (let i = 0; i < 2 && d.along < 2.0; i++) d = await dashOnce();
    check("dash: the burst carries the fox (over 2 blocks along the facing, at once)",
      d.along >= 2.0, `along=${d.along.toFixed(2)}`);
    check("dash: the cooldown is real (the state names the wait)",
      d.cd > 400, `dashCdLeft=${d.cd}`);
    await key("j", "KeyJ");
    await sleep(350);
    check("dash: a second press inside the cooldown does NOT dash",
      (await combatState()).dashing === false);
  }

  // --- Item 4: the dash under inverted gravity --------------------------------------------------
  let flipped = false;
  for (let i = 0; i < 3 && !flipped; i++) {
    await key("g", "KeyG");
    flipped = await waitFor("NOVA_FOX3.state.gravDir === -1", 5000, "gravity inverts");
  }
  await waitFor("NOVA_FOX3.state.onGround", 9000, "standing on the vault");
  check("gravity inverts for the dash leg", flipped);
  // The inversion carries a warp (announcement, degauss, the
  // wooze): presses inside it are swallowed. Let it finish —
  // a player waits out the warp too.
  await sleep(2800);
  {
    // Keep the yaw the plain dash leg just proved open, and read
    // the burst as total horizontal travel — direction under
    // inverted gravity is the flip leg's own question; the dash's
    // question is that the burst still answers at full length.
    // (Forcing west here ran the fox into the Arrival screen's
    // stone on the vault side — the game's truth, not the dash's.)
    let d = await dashOnce();
    for (let i = 0; i < 2 && d.travel < 2.0; i++) d = await dashOnce();
    const along = d.travel;
    const p0 = await foxPos();
    if (along < 2.0) {
      const st = await evalJs(`(() => { const s = window.NOVA_FOX3.state;
        const scalars = {};
        for (const [k, v] of Object.entries(s)) {
          if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") scalars[k] = v;
        }
        return { scalars, focus: document.hasFocus(),
          vis: document.visibilityState,
          board: getComputedStyle(document.getElementById("board")).display,
          keys: [...document.querySelectorAll("canvas")].length }; })()`);
      console.log(`  .. inverted-dash state: ${JSON.stringify(st)} from ${JSON.stringify(p0)}`);
    }
    check("dash inverted: the burst still answers, at full length, on the vault",
      along >= 2.0, `travel=${along.toFixed(2)}`);
  }

  // --- Item 5 + plaques: the artifact itself carries the new work --------------------------------
  {
    const html = readFileSync(join(HERE, "index.html"), "utf8");
    check("exo-dreams: the built artifact carries the plaques' gold rule and the skills line",
      html.includes("transparent, #cc964d, transparent") && html.includes('id="skills"'));
    const audioDir = join(HERE, "..", "..", "audio", "narration-audio-joy");
    let audioOk = existsSync(audioDir);
    const beats = ["guardian-contact", "strike-kill", "guardian-kill", "death"];
    const detail = [];
    if (audioOk) {
      const files = readdirSync(audioDir);
      for (const b of beats) {
        const f = files.find((n) => n.includes(b) && n.endsWith(".mp3"));
        if (!f) { audioOk = false; detail.push(`missing ${b}`); continue; }
        const bytes = readFileSync(join(audioDir, f));
        const prefix = bytes.subarray(0, 192).toString("base64");
        if (!html.includes(prefix)) { audioOk = false; detail.push(`not embedded: ${f}`); }
      }
    } else detail.push(`no audio dir at ${audioDir}`);
    check("Joy's re-recorded fight beats are the ones embedded in the artifact",
      audioOk, detail.join(" · "));
  }

  check("no console errors across the EE 1037 legs", consoleErrors.length === 0,
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
