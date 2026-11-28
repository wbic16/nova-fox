// Nova Fox — P-5 (realms with character) dedicated probe, in headless
// Chrome over CDP (the probe-msg pattern; run via the Jenkins job
// nova-fox-e2e-p5realms-probe). The page is served as
// https://fox.phext.io from a local stand-in on 127.0.0.5 (P-1 holds
// 127.0.0.1, P-2 127.0.0.2, P-4 127.0.0.3, S-2 127.0.0.4) because the
// gateway's CORS admits only the game's own origin; phext.tech
// itself is the real awsbox gateway throughout.
//
// What it proves, in the built artifact, against the REAL world
// record: context A (a named, token-carrying fox) boots, and the
// game's own reconcile records every realm's generation parameters
// on the realmgen scroll (1.1.1/1.1.10/1.1.1) — the genesis lines,
// crafter "probe-p5-realms", permanent by design; after a reload
// the standing record still agrees with the derived parameters.
// Context B (a fresh profile, no token, no name of A's) reads the
// record and agrees, generates byte-identical realm fingerprints
// to A's for all eleven realms, and passes the route proof in
// every realm — two independent clients, one world.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9441);
const URL = process.env.NF_URL || "https://fox.phext.io/index.html";
const TOKEN = process.env.NF_TOKEN_FILE
  ? readFileSync(process.env.NF_TOKEN_FILE, "utf8").trim() : "";
const GEN_SELECT =
  "https://phext.tech/api/v2/select?p=nova-phox-world&c=1.1.1/1.1.10/1.1.1";
const REALM_IDS = ["nova", "ashfall", "ni-knight", "logos", "elven",
  "orchid", "halycon", "delta", "willow", "plain", "trust"];

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(profile) {
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
    "--host-resolver-rules=MAP fox.phext.io 127.0.0.5",
  ];
  if (policyExists) {
    chromeArgs.push(
      `--hatch-webgl-allowed-domains-file=${POLICY}`,
      `--hatch-webgl-allowed-domains-sha256=${policySha}`);
  }
  chromeArgs.push(`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank");
  const chrome = spawn(CHROME, chromeArgs, { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", () => {});
  let ws;
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
      }, 60000);
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
    for (let i = 0; i < 120 && !booted; i++) {
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
  return { chrome, evalJs, waitFor, boot, enterWorld, consoleErrors,
           close: () => { try { ws.close(); } catch (e) {} chrome.kill("SIGKILL"); } };
}

const fingerprintsExpr = `(() => {
  const F = window.NOVA_FOX3;
  const out = {};
  for (const id of ${JSON.stringify(REALM_IDS)}) out[id] = F.genFingerprint(id);
  return out;
})()`;

try {
  // ================= CONTEXT A: the recorder =================
  const profileA = mkdtempSync(join(tmpdir(), "novafox-p5A-"));
  const A = await launch(profileA);
  check("A: page boots, NOVA_FOX3 handle present", await A.boot());
  check("A: token stands ready for the write path", TOKEN.length > 20,
    TOKEN ? "" : "NF_TOKEN_FILE missing or empty");
  // The game's LS wrapper JSON-parses what it reads: stored entries
  // must be the JSON encoding of the string (P-1's probe lesson).
  await A.evalJs(`localStorage.setItem('nova-phox-token', ${JSON.stringify(JSON.stringify(TOKEN))})`);
  await A.evalJs(`localStorage.setItem('nova-phox-name', ${JSON.stringify(JSON.stringify("probe-p5-realms"))})`);
  await A.evalJs("localStorage.setItem('nf.scheme', 'wasd')");
  await A.evalJs("location.reload()");
  check("A: the pinned boot returns (token + probe name)",
    await A.waitFor("!!window.NOVA_FOX3", 120000, "pinned boot returns"));
  await A.enterWorld();
  check("A: the backend answers — the game is online against the real gateway",
    await A.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online"));
  check("A: the realmgen record agrees in-page once the reconcile has run",
    await A.waitFor("NOVA_FOX3.realmGenState().agrees === true", 60000, "realmgen agrees (A)"),
    JSON.stringify(await A.evalJs("NOVA_FOX3.realmGenState()").catch(() => null)));

  // --- the genesis lines land on the real realmgen scroll --------------
  // The flush drains under the gateway's shared insert budget; the
  // fox stands still and the wait gives the window time to free.
  let scrollText = "";
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 300000) {
      try {
        const r = await fetch(GEN_SELECT);
        scrollText = await r.text();
      } catch (e) { /* retry */ }
      const seen = new Set(scrollText.split("\n")
        .filter((ln) => ln.startsWith("rgen|"))
        .map((ln) => ln.split("|")[1]));
      if (REALM_IDS.every((id) => seen.has(id))) break;
      await sleep(3000);
    }
  }
  const rgenLines = scrollText.split("\n").filter((ln) => ln.startsWith("rgen|"));
  check("A: the realmgen scroll carries a genesis line for every realm",
    REALM_IDS.every((id) => rgenLines.some((ln) => ln.split("|")[1] === id)),
    `lines=${rgenLines.length}`);
  check("A: the standing lines are the probe fox's own recording",
    rgenLines.length > 0 && rgenLines.every((ln) => ln.split("|")[11] === "probe-p5-realms"),
    rgenLines.slice(0, 2).join(" ; "));

  // --- after reload, the standing record still agrees -------------------
  await A.evalJs("location.reload()");
  check("A: the pinned boot returns after reload",
    await A.waitFor("!!window.NOVA_FOX3", 120000, "pinned boot returns after reload"));
  check("A: after reload the standing record still agrees, read back from the scroll",
    await A.waitFor("NOVA_FOX3.realmGenState().agrees === true && NOVA_FOX3.realmGenState().rows >= 11",
      60000, "realmgen agrees after reload"),
    JSON.stringify(await A.evalJs("NOVA_FOX3.realmGenState()").catch(() => null)));

  // --- fingerprints and routes, context A --------------------------------
  const fpA = await A.evalJs(fingerprintsExpr);
  check("A: fingerprints compute for all eleven realms",
    REALM_IDS.every((id) => fpA[id] && /^[0-9a-f]{8}$/.test(fpA[id].heights) &&
      /^[0-9a-f]{8}$/.test(fpA[id].surface)),
    JSON.stringify(fpA).slice(0, 200));
  const routesA = await A.evalJs("NOVA_FOX3.realmRouteState()");
  check("A: the route proof passes in every realm",
    REALM_IDS.every((id) => routesA[id] && routesA[id].ok === true),
    JSON.stringify(routesA));
  check("A: Nova's hall route and shapeable face both prove",
    routesA.nova && routesA.nova.hall === true && routesA.nova.face === true,
    JSON.stringify(routesA.nova));
  check("A: no console errors", A.consoleErrors.length === 0,
    A.consoleErrors.slice(0, 2).join(" ; "));
  A.close();
  await sleep(1500);

  // ================= CONTEXT B: the witness =================
  const profileB = mkdtempSync(join(tmpdir(), "novafox-p5B-"));
  const B = await launch(profileB);
  check("B: page boots in a fresh profile (no token, no edits)", await B.boot());
  await B.enterWorld();
  check("B: the backend answers for a reader",
    await B.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online (B)"));
  check("B: the realmgen record agrees for a fresh reader, from the scroll alone",
    await B.waitFor("NOVA_FOX3.realmGenState().agrees === true", 60000, "realmgen agrees (B)"),
    JSON.stringify(await B.evalJs("NOVA_FOX3.realmGenState()").catch(() => null)));
  const fpB = await B.evalJs(fingerprintsExpr);
  check("B: two fresh contexts generate identical realms — every fingerprint matches A's",
    REALM_IDS.every((id) => JSON.stringify(fpB[id]) === JSON.stringify(fpA[id])),
    REALM_IDS.filter((id) => JSON.stringify(fpB[id]) !== JSON.stringify(fpA[id])).join(","));
  const routesB = await B.evalJs("NOVA_FOX3.realmRouteState()");
  check("B: the route proof passes in every realm for the witness too",
    REALM_IDS.every((id) => routesB[id] && routesB[id].ok === true),
    JSON.stringify(routesB));
  check("B: no console errors", B.consoleErrors.length === 0,
    B.consoleErrors.slice(0, 2).join(" ; "));
  B.close();
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + (e && e.message || e));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
