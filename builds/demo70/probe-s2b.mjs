// Nova Fox — S-2b leg-level console gate probe, in headless Chrome
// over CDP (the probe-s2 pattern; run via the Jenkins job
// nova-fox-e2e-s2bgate-probe). S-2 (EE 1100) gated the
// rift-straight COMMAND in the console runner; S-2b (EE 1105)
// moves the gate into the legs themselves, because runall reaches
// the legs internally and veer/slope carried no gate. This probe
// shows the bypass closed, live:
//   SIGNED OUT — each of rift-straight / rift-veer / rift-slope
//     refuses BY NAME through its command, and runall — the
//     internal reach — meets the same three refusals, counts all
//     three legs not run, and still runs its diagnostics. After
//     every refusal the fox stands exactly where he stood: no
//     rift opened, no step taken (the refusal precedes movement).
//   DIAGNOSTICS — where / version / purse / gravity print their
//     readouts signed out, exactly as S-2 left them.
//   SIGNED IN — the operator probe token (NF_TOKEN_FILE, the
//     probe-s2 idiom) standing in localStorage admits all three
//     legs: each leg's own header answers and no REFUSED stands.
//     A REAL token is required, not a placeholder: the game drops
//     a token the gateway answers 401 (game3.js, the flush paths),
//     so a fake token evaporates mid-sequence — observed in run #1
//     of this probe, where veer and straight were admitted and
//     slope then refused over the cleared token. The legs'
//     verdicts on traversal merits are not this probe's claim.
//   RE-ENGAGE — the token removed, the gate refuses again.
// The page is served as https://fox.phext.io from a local stand-in
// (host-resolver maps that one host to 127.0.0.8) because the
// gateway's CORS admits only the game's own origin; nothing here
// writes to any scroll — the console legs are in-client checks.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9429);
const URL = process.env.NF_URL || "https://fox.phext.io/index.html";
const MAP_IP = process.env.NF_MAP_IP || "127.0.0.8";
const TOKEN = process.env.NF_TOKEN_FILE
  ? readFileSync(process.env.NF_TOKEN_FILE, "utf8").trim() : "";

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(profile, port) {
  const POLICY = process.env.NF_POLICY ||
    "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
  const policyExists = existsSync(POLICY);
  const policySha = policyExists
    ? createHash("sha256").update(readFileSync(POLICY)).digest("hex") : null;
  const chromeArgs = [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
    "--autoplay-policy=no-user-gesture-required",
    "--ignore-certificate-errors",
    `--host-resolver-rules=MAP fox.phext.io ${MAP_IP}`,
  ];
  if (policyExists) {
    chromeArgs.push(
      `--hatch-webgl-allowed-domains-file=${POLICY}`,
      `--hatch-webgl-allowed-domains-sha256=${policySha}`);
  }
  chromeArgs.push(`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank");
  const chrome = spawn(CHROME, chromeArgs, { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", () => {});
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
  const ws = new WebSocket(await wsUrl());
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
  async function waitFor(expr, timeoutMs, label) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await evalJs(expr)) return true;
      await sleep(250);
    }
    console.log(`  .. timeout waiting for: ${label}`);
    return false;
  }
  async function boot() {
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Network.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1280, height: 800, deviceScaleFactor: 1, mobile: false,
    });
    await send("Page.navigate", { url: URL });
    return waitBooted();
  }
  async function waitBooted() {
    for (let i = 0; i < 80; i++) {
      await sleep(250);
      try { if (await evalJs("!!window.NOVA_FOX3")) return true; } catch (e) { /* loading */ }
    }
    return false;
  }
  async function enterWorld() {
    await sleep(800);
    await evalJs("document.getElementById('splash-btn').click()");
    await sleep(300);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 640, y: 360, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 640, y: 360, button: "left", clickCount: 1 });
    await sleep(300);
  }
  return { chrome, evalJs, waitFor, boot, waitBooted, enterWorld,
           consoleErrors,
           close: () => { try { ws.close(); } catch (e) {} chrome.kill("SIGKILL"); } };
}

// Run one console line and return only the pane text it added.
// Awaited: refusals and diagnostics settle immediately; the
// admitted legs are fired separately (fireLeg) because a walk can
// run up to the leg's own 12 s probe timeout.
async function conRun(C, line) {
  const before = (await C.evalJs("NOVA_FOX3.nfConsole.text()")).length;
  await C.evalJs(`NOVA_FOX3.nfConsole.run(${JSON.stringify(line)})`);
  return (await C.evalJs("NOVA_FOX3.nfConsole.text()")).slice(before);
}
// Fire a leg without awaiting the walk; poll the pane until the
// leg's header (or a refusal) stands, then wait for the console
// to settle (busy clears when the leg resolves).
async function fireLeg(C, line, timeoutMs = 45000) {
  const before = (await C.evalJs("NOVA_FOX3.nfConsole.text()")).length;
  await C.evalJs(`(NOVA_FOX3.nfConsole.run(${JSON.stringify(line)}), 'fired')`);
  await C.waitFor("NOVA_FOX3.nfConsole.busy() === false", timeoutMs, `${line} settled`);
  return (await C.evalJs("NOVA_FOX3.nfConsole.text()")).slice(before);
}
// A walk's signature is horizontal: x/z and the realm. The fox's
// y is not compared — at spawn the arriving generation can still
// be carrying him upward (run #1 measured +2.07 y during a fully
// refused runall, x/z/realm unmoved), and no leg walks straight
// up. The settle wait below still runs first, so the comparison
// starts from a fox at rest.
const foxAt = (C) => C.evalJs("JSON.stringify({ x: NOVA_FOX3.state.pos.x, z: NOVA_FOX3.state.pos.z, r: NOVA_FOX3.state.realm })");
const riftStands = (C) => C.evalJs("!!NOVA_FOX3.state.rift");
async function waitSettled(C, timeoutMs = 45000) {
  const t0 = Date.now();
  let prev = await C.evalJs("JSON.stringify(NOVA_FOX3.state.pos)");
  while (Date.now() - t0 < timeoutMs) {
    await sleep(1500);
    const now = await C.evalJs("JSON.stringify(NOVA_FOX3.state.pos)");
    if (now === prev) return true;
    prev = now;
  }
  return false;
}

try {
  check("setup: the operator token stands ready (never printed)", TOKEN.length > 20);
  const A = await launch(mkdtempSync(join(tmpdir(), "novafox-s2b-")), PORT);
  check("page boots, NOVA_FOX3 handle present", await A.boot());
  check("a fresh profile carries no token",
    await A.evalJs("NOVA_FOX3.hasToken()") === false);
  await A.enterWorld();
  check("the fox settles at spawn before movement is measured",
    await waitSettled(A));
  await A.evalJs("NOVA_FOX3.nfConsole.open()");
  check("console opens", await A.evalJs("NOVA_FOX3.nfConsole.isOpen()") === true);

  // --- DIAGNOSTICS, signed out: open exactly as S-2 left them ----
  const diag = {};
  for (const c of ["where", "version", "purse", "gravity"]) {
    diag[c] = await conRun(A, c);
  }
  check("diagnostics stay open without a token (where/version/purse/gravity)",
    diag.where.includes("scroll") && diag.version.includes("EE") &&
    diag.purse.includes("flux") && diag.gravity.includes("subspace"),
    Object.entries(diag).map(([k, v]) => `${k}:${v.trim().split("\n").pop()}`).join(" | "));

  // --- THE THREE LEGS, signed out, through their commands --------
  for (const cmd of ["rift-straight", "rift-veer", "rift-slope"]) {
    const at0 = await foxAt(A);
    const out = await conRun(A, cmd);
    check(`${cmd}: refused by name without a token`,
      out.includes("REFUSED") && out.includes(`${cmd} runs only when you are signed in`),
      out.trim().split("\n").pop());
    check(`${cmd}: the refusal precedes movement — fox unmoved, no rift stands`,
      (await foxAt(A)) === at0 && (await riftStands(A)) === false,
      `before=${at0} after=${await foxAt(A)}`);
  }

  // --- RUNALL, signed out: the internal reach meets the gate -----
  {
    const at0 = await foxAt(A);
    const out = await conRun(A, "runall");
    check("runall: all three legs refuse inside runall, by name",
      out.includes("rift-straight runs only when you are signed in") &&
      out.includes("rift-veer runs only when you are signed in") &&
      out.includes("rift-slope runs only when you are signed in"),
      out.trim().split("\n").slice(-3).join(" | "));
    check("runall: the refused legs count as not run, and its diagnostics still ran",
      out.includes("rift-straight: notrun") && out.includes("rift-veer: notrun") &&
      out.includes("rift-slope: notrun") && out.includes("geometry:") &&
      /runall: \d+ passed, \d+ failed, 3 not run/.test(out),
      out.trim().split("\n").pop());
    check("runall: nothing walked — fox unmoved, no rift stands",
      (await foxAt(A)) === at0 && (await riftStands(A)) === false,
      `before=${at0} after=${await foxAt(A)}`);
  }

  // --- SIGNED IN: the legs are admitted ---------------------------
  await A.evalJs(`localStorage.setItem('nova-phox-token', ${JSON.stringify(JSON.stringify(TOKEN))})`);
  check("the token stands (the gate's own check)",
    await A.evalJs("NOVA_FOX3.hasToken()") === true);
  const veerIn = await fireLeg(A, "rift-veer");
  check("rift-veer: admitted with a token — the leg itself answers, no refusal",
    veerIn.includes("rift-veer: open the bridge rift") && !veerIn.includes("REFUSED"),
    veerIn.trim().split("\n").pop());
  const straightIn = await fireLeg(A, "rift-straight");
  check("rift-straight: admitted with a token — the leg itself answers, no refusal",
    straightIn.includes("rift-straight: the bridge tune") && !straightIn.includes("REFUSED"),
    straightIn.trim().split("\n").pop());
  const slopeIn = await fireLeg(A, "rift-slope");
  check("rift-slope: admitted with a token — the leg itself answers, no refusal",
    slopeIn.includes("rift-slope: the steepest rise") && !slopeIn.includes("REFUSED"),
    slopeIn.trim().split("\n").pop());
  const runallIn = await fireLeg(A, "runall", 120000);
  check("runall: admitted with a token — no refusal anywhere in the run",
    !runallIn.includes("REFUSED") && /runall: \d+ passed, \d+ failed, \d+ not run/.test(runallIn),
    runallIn.trim().split("\n").pop());

  // --- RE-ENGAGE: token removed, the gate refuses again -----------
  await A.evalJs("localStorage.removeItem('nova-phox-token')");
  check("the token is gone again",
    await A.evalJs("NOVA_FOX3.hasToken()") === false);
  const veerOut2 = await conRun(A, "rift-veer");
  check("rift-veer: refused again once the token is removed",
    veerOut2.includes("REFUSED") && veerOut2.includes("rift-veer runs only when you are signed in"),
    veerOut2.trim().split("\n").pop());

  await A.evalJs("NOVA_FOX3.nfConsole.close()");
  check("no page exceptions across the session",
    A.consoleErrors.filter((e) => e.startsWith("exception:")).length === 0,
    A.consoleErrors.slice(0, 2).join(" ; "));
  A.close();
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + (e && e.message || e));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
