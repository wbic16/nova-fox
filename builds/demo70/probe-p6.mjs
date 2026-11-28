// Nova Fox — P-6 (the Solver) dedicated probe, in headless Chrome
// over CDP (the probe-msg/probe-p2 pattern; run via the Jenkins job
// nova-fox-e2e-p6solver-probe). The page is served as
// https://fox.phext.io from a local stand-in on 127.0.0.6 serving
// this area's tree, because the gateway's CORS admits only the
// game's own origin; phext.tech itself is the real awsbox gateway
// throughout.
//
// Two foxes, probe-p6-a and probe-p6-b, run CONCURRENTLY (separate
// Chrome instances, separate CDP ports): both claim the same unit
// before either can finish — the solver's anti-copy rule credits
// only claims that stand before the first result — then compute it
// for real at full duty (the console-only solverTestDuty hook; the
// production cap is measured separately, in the governor leg).
// Each must be minted exactly 2 twelfths for the unit when their
// results agree. Then: the governor leg (default duty, the rolling
// load average must sit at or under the 30% line), and a fresh
// device carrying A's name, which must rebuild A's credited record
// from the scroll alone and mint NOTHING a second time.
//
// Residue: the probe accounts' claims/results/credits for the
// worked unit(s) stand permanently on the solver scroll
// (1.1.1/1.1.11/1.1.1), labeled probe-p6-a / probe-p6-b.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
let PORT_A = Number(process.env.NF_PORT || 9425);
let PORT_B = PORT_A + 1;

// A CDP port is only ours if nothing answers on it. On this hub a
// port can be squatted by another producer's Chrome (build #1 found
// S-1's page on our registered port after our own Chrome died), and
// a half-dead endpoint can leave a WebSocket handshake hanging
// forever (build #2: seventeen silent minutes inside launch).
// Choose the first free pair from a candidate ladder, and bound
// every wait in launch.
async function portFree(port) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2000);
    await fetch(`http://127.0.0.1:${port}/json/list`, { signal: ctl.signal });
    clearTimeout(t);
    return false;
  } catch (e) { return true; }
}
async function choosePorts() {
  for (const base of [PORT_A, PORT_A + 10, PORT_A + 20, PORT_A + 30]) {
    if ((await portFree(base)) && (await portFree(base + 1))) {
      PORT_A = base; PORT_B = base + 1;
      console.log(`  .. CDP ports: ${PORT_A} (A) / ${PORT_B} (B)`);
      return;
    }
  }
  throw new Error("no free CDP port pair on the candidate ladder");
}
const URL = process.env.NF_URL || "https://fox.phext.io/index.html";
const TOKEN = process.env.NF_TOKEN_FILE
  ? readFileSync(process.env.NF_TOKEN_FILE, "utf8").trim() : "";
const SOLVER_SELECT =
  "https://phext.tech/api/v2/select?p=nova-phox-world&c=1.1.1/1.1.11/1.1.1";

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
    // The worker's slice chain is setTimeout-driven; a headless
    // instance Chrome decides is "background" gets its timers
    // throttled to a crawl and a unit never finishes (probe build
    // #1: fox A stalled while fox B, launched last, ran free).
    // S-1's probe carries the same four flags for the same reason.
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=CalculateNativeWinOcclusion",
    "--host-resolver-rules=MAP fox.phext.io 127.0.0.6",
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
    throw new Error("devtools endpoint never came up on port " + port);
  }
  let msgId = 0;
  const pending = new Map();
  const consoleErrors = [];
  const ws = new WebSocket(await wsUrl());
  await Promise.race([
    new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }),
    sleep(20000).then(() => { throw new Error("CDP websocket never opened on port " + port); }),
  ]);
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
      try { if (await evalJs(expr)) return true; }
      catch (e) { /* a mid-navigation page answers nothing yet — keep waiting */ }
      await sleep(250);
    }
    console.log(`  .. timeout waiting for: ${label}`);
    return false;
  }
  async function boot() {
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
    return booted;
  }
  async function enterWorld() {
    await sleep(800);
    await evalJs("document.getElementById('splash-btn').click()");
    await sleep(300);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 640, y: 360, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 640, y: 360, button: "left", clickCount: 1 });
    await sleep(300);
  }
  // The game's LS wrapper JSON-parses what it reads: the stored
  // entry must be the JSON encoding of the string (P-1's probe
  // builds #1-#5 defect, fixed in their landed probe).
  async function seed(name) {
    await evalJs(`localStorage.setItem('nova-phox-token', ${JSON.stringify(JSON.stringify(TOKEN))})`);
    await evalJs(`localStorage.setItem('nova-phox-name', ${JSON.stringify(JSON.stringify(name))})`);
    await evalJs("localStorage.setItem('nf.scheme', 'wasd')");
    await evalJs("location.reload()");
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) {
      await sleep(250);
      try { ok = await evalJs("!!window.NOVA_FOX3"); } catch (e) { /* loading */ }
    }
    return ok;
  }
  return { chrome, evalJs, waitFor, boot, enterWorld, seed, consoleErrors,
           close: () => { try { ws.close(); } catch (e) {} chrome.kill("SIGKILL"); } };
}

async function solverScrollLines() {
  const r = await fetch(SOLVER_SELECT);
  const text = await r.text();
  return text.split("\n").filter((ln) => ln.trim().length > 0);
}

try {
  check("the probe token stands ready for the write path", TOKEN.length > 20,
    TOKEN ? "" : "NF_TOKEN_FILE missing or empty");
  // Fresh account names per build: the game's queue discipline
  // never re-offers a fox a unit it has claimed before, so a
  // re-run under build #3's names would send A and B to different
  // units (their claim histories differ). Fresh names keep the
  // two foxes symmetric — both pick the same smallest claimable
  // unit — and the residue stays honestly labeled per build.
  const RUN = process.env.BUILD_NUMBER ? "-b" + process.env.BUILD_NUMBER : "";
  const NAME_A = "probe-p6-a" + RUN;
  const NAME_B = "probe-p6-b" + RUN;

  // ================= A and B: the contribution =================
  await choosePorts();
  const profileA = mkdtempSync(join(tmpdir(), "novafox-p6A-"));
  const profileB = mkdtempSync(join(tmpdir(), "novafox-p6B-"));
  const A = await launch(profileA, PORT_A);
  const B = await launch(profileB, PORT_B);
  check("A: page boots, NOVA_FOX3 handle present", await A.boot());
  check("B: page boots, NOVA_FOX3 handle present", await B.boot());
  // Port squatting is a real hazard on this hub (producers run
  // concurrently): if the debugging endpoint we reached belonged
  // to a foreign Chrome, boot() just navigated THEIR page — the
  // URL assertion catches that before any seeding happens.
  check("A: the page we drive is the stand-in's, not a foreign Chrome's",
    ((await A.evalJs("location.href")) || "").includes("fox.phext.io"));
  check("B: the page we drive is the stand-in's, not a foreign Chrome's",
    ((await B.evalJs("location.href")) || "").includes("fox.phext.io"));
  check("A: the pinned boot returns (token + probe name)", await A.seed(NAME_A));
  check("B: the pinned boot returns (token + probe name)", await B.seed(NAME_B));
  await A.enterWorld();
  await B.enterWorld();
  check("A: the backend answers — online against the real gateway",
    await A.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online (A)"));
  check("B: the backend answers — online against the real gateway",
    await B.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online (B)"));
  check("A: the solver scroll has been read back",
    await A.waitFor("NOVA_FOX3.solverState().rows !== null", 60000, "solver rows (A)"));
  check("B: the solver scroll has been read back",
    await B.waitFor("NOVA_FOX3.solverState().rows !== null", 60000, "solver rows (B)"));

  // Full duty via the console-only hook: the work itself is the
  // real 19,000-generation unit either way — only the pacing is
  // lifted, so the probe measures minutes, not the production cap
  // (the governor leg below measures the cap honestly).
  await A.evalJs("NOVA_FOX3.solverTestDuty(1)");
  await A.evalJs("NOVA_FOX3.solverStartNow()");
  await sleep(1500);
  const unitA = await A.evalJs("NOVA_FOX3.solverState().unit");
  check("A: contributing — a unit is claimed", unitA !== null && unitA !== undefined,
    `unit=${unitA}`);
  const unitId = "sol1-" + unitA;
  await B.evalJs("NOVA_FOX3.solverTestDuty(1)");
  await B.evalJs("NOVA_FOX3.solverStartNow()");
  await sleep(1500);
  const unitB = await B.evalJs("NOVA_FOX3.solverState().unit");
  check("B: claims the same unit A holds (the second slot of k=2)",
    unitB === unitA, `A=${unitA} B=${unitB}`);

  check("A: the unit's work completes for real",
    await A.waitFor("NOVA_FOX3.solverState().completed >= 1", 420000, "A completes a unit"));
  check("B: the unit's work completes for real",
    await B.waitFor("NOVA_FOX3.solverState().completed >= 1", 420000, "B completes a unit"));
  check("A: agreement mints A's share (2 twelfths at full rate)",
    await A.waitFor("NOVA_FOX3.solverState().earnedTwelfths >= 2", 360000, "A is minted"),
    JSON.stringify(await A.evalJs("NOVA_FOX3.solverState()").catch(() => null)));
  check("B: agreement mints B's share (2 twelfths at full rate)",
    await B.waitFor("NOVA_FOX3.solverState().earnedTwelfths >= 2", 360000, "B is minted"),
    JSON.stringify(await B.evalJs("NOVA_FOX3.solverState()").catch(() => null)));
  // The mint is observed in the client the moment reconcile runs;
  // the credit LINE rides the outbox on the 20 s flush cadence.
  // Give both outboxes a full cadence to drain before any browser
  // closes, or a credit line dies in a dead profile's storage.
  await sleep(30000);
  await A.evalJs("NOVA_FOX3.solverStopNow()");
  await B.evalJs("NOVA_FOX3.solverStopNow()");
  check("B: no console errors", B.consoleErrors.length === 0,
    B.consoleErrors.slice(0, 2).join(" ; "));
  B.close();
  A.close();
  await sleep(1500);

  // ---- the scroll itself: claims early, results real, credits once
  {
    const lines = await solverScrollLines();
    const mine = lines.map((ln, i) => ({ ln, i })).filter(({ ln }) => ln.includes("|" + unitId + "|"));
    const claimA = mine.find(({ ln }) => ln.startsWith("solclaim|") && ln.includes("|" + NAME_A + "|"));
    const claimB = mine.find(({ ln }) => ln.startsWith("solclaim|") && ln.includes("|" + NAME_B + "|"));
    const resA = mine.find(({ ln }) => ln.startsWith("solresult|") && ln.includes("|" + NAME_A + "|"));
    const resB = mine.find(({ ln }) => ln.startsWith("solresult|") && ln.includes("|" + NAME_B + "|"));
    check("scroll: both claims and both results stand for the unit",
      !!(claimA && claimB && resA && resB), mine.map(({ ln }) => ln).join(" ; "));
    if (claimA && claimB && resA && resB) {
      const firstResult = Math.min(resA.i, resB.i);
      check("scroll: both claims stand before the first result (the anti-copy shape)",
        claimA.i < firstResult && claimB.i < firstResult);
      const spanA = Number(resA.ln.split("|")[5]) - Number(claimA.ln.split("|")[5]);
      check("scroll: A's claim->result span is real work, not an instant forge",
        spanA >= 10000 && spanA <= 600000, `span=${spanA}ms`);
      check("scroll: the two results agree (the deterministic kernel, two machines)",
        resA.ln.split("|")[2] === resB.ln.split("|")[2],
        `${resA.ln.split("|")[2]} vs ${resB.ln.split("|")[2]}`);
    }
    const creditA = mine.filter(({ ln }) => ln.startsWith("solcredit|") && ln.includes("|" + NAME_A + "|"));
    const creditB = mine.filter(({ ln }) => ln.startsWith("solcredit|") && ln.includes("|" + NAME_B + "|"));
    check("scroll: exactly one credit line for A, of exactly 2 twelfths",
      creditA.length === 1 && creditA[0].ln.split("|")[3] === "2",
      creditA.map(({ ln }) => ln).join(" ; "));
    check("scroll: exactly one credit line for B, of exactly 2 twelfths",
      creditB.length === 1 && creditB[0].ln.split("|")[3] === "2",
      creditB.map(({ ln }) => ln).join(" ; "));
  }

  // ================= A2: the governor, at the production duty ======
  const A2 = await launch(profileA, PORT_A);
  check("A2: A's profile reopens", await A2.boot());
  try { await A2.enterWorld(); } catch (e) { /* a returning profile may skip the splash */ }
  await A2.waitFor("NOVA_FOX3.solverState().rows !== null", 60000, "solver rows (A2)");
  check("A2: A's credited record stands in its own purse",
    await A2.waitFor("NOVA_FOX3.solverState().credited >= 1", 120000, "A credited (A2)"));
  await A2.evalJs("NOVA_FOX3.solverTestDuty(0)"); // 0 -> override cleared, the production 0.29 duty
  await A2.evalJs("NOVA_FOX3.solverStartNow()");
  await sleep(25000);
  const gov = await A2.evalJs("NOVA_FOX3.solverState()");
  check("governor: at the production duty the measured load rides at or under the 30% line",
    gov.loadAvg > 0.05 && gov.loadAvg <= 0.32, `loadAvg=${gov.loadAvg}`);
  await A2.evalJs("NOVA_FOX3.solverStopNow()");
  check("governor: the stop button stops it now",
    (await A2.evalJs("NOVA_FOX3.solverState().running")) === false);
  A2.close();
  await sleep(1500);

  // ================= C: a fresh device carrying A's name ==========
  const profileC = mkdtempSync(join(tmpdir(), "novafox-p6C-"));
  const C = await launch(profileC, PORT_A);
  check("C: page boots in a fresh profile", await C.boot());
  check("C: the pinned boot returns (A's name, fresh machine)", await C.seed(NAME_A));
  await C.enterWorld();
  check("C: the credited record rebuilds from the scroll alone",
    await C.waitFor("NOVA_FOX3.solverState().credited >= 1", 180000, "C rebuilds A's credit"));
  check("C: the fresh device mints nothing a second time",
    (await C.evalJs("NOVA_FOX3.solverState().fracTwelfths")) === 0);
  check("C: no console errors", C.consoleErrors.length === 0,
    C.consoleErrors.slice(0, 2).join(" ; "));
  C.close();

  // ---- after every device has spoken: still exactly one credit each
  {
    const lines = await solverScrollLines();
    const credits = lines.filter((ln) => ln.startsWith("solcredit|") && ln.includes("|" + unitId + "|"));
    // The contract is one GRANT per (unit, fox), not one LINE:
    // this probe SIGKILLs A and reopens its profile (A2) while
    // A's persisted outbox may still hold a credit line whose
    // insert the server already appended — the reopened instance
    // re-posts the identical line (same grant, same timestamp).
    // Resolution counts a (unit, account) pair once, so balances
    // are never wrong; what must never happen is two DIFFERENT
    // grants for one fox. Assert exactly that: the distinct
    // credit lines for the unit number one per fox.
    const distinctGrants = [...new Set(credits)];
    check("scroll: after the fresh device's visit, the unit carries exactly one distinct grant per fox (a kill-reopen duplicate line resolves away)",
      distinctGrants.length === 2 &&
      distinctGrants.some((ln) => ln.includes("|" + NAME_A + "|")) &&
      distinctGrants.some((ln) => ln.includes("|" + NAME_B + "|")),
      credits.join(" ; "));
  }
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + (e && e.message || e));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
