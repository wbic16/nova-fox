// Nova Fox — W-3 license-session probe, in headless Chrome over CDP
// (the probe-s2 pattern; run via the Jenkins job nova-fox-e2e-w3keys).
// W-3 (build 42): the global server validates the license key ON
// CONNECT. The gateway side of this probe is the real W-3 gateway
// (a hub instance over a real SQ, set up by the job): the page's
// calls to https://phext.tech/api/v2/* are relayed to it verbatim
// through CDP Fetch interception — the gateway's own bytes answer,
// the probe only carries them. The Gumroad door the gateway asks
// is the real one. TEST identities only; every record names its
// TEST fox.
//   CONTEXT A — a fox whose machine holds a gift key still waiting
//     for its first sync (pendingGiftKey), the key issued on the
//     ledger by TESTGIVER-W3: on connect the server validates it,
//     the standing rises to generator, flight opens via "paid",
//     the dial's range unlocks, the gift-redeemed line lands on
//     the ledger naming this fox, and the purchase claim follows.
//   CONTEXT B — a fox with no key at all: the session stands
//     free, no gate opens, and the game is whole and playable.
//   CONTEXT C — a second fox presenting the SAME gift key after
//     A's redemption landed: the server refuses it "spent" by
//     name, and the session stands free.
// The page is served as https://fox.phext.io from a local stand-in
// (host-resolver maps that one host to 127.0.0.11) because the
// gateway's CORS admits only the game's own origin.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9437);
const PAGE_URL = process.env.NF_URL || "https://fox.phext.io/index.html";
const MAP_IP = process.env.NF_MAP_IP || "127.0.0.11";
const GW = (process.env.NF_GW || "http://127.0.0.1:18952").replace(/\/$/, "");
const SETUP = JSON.parse(readFileSync(process.env.NF_W3_SETUP, "utf8"));

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(profile, port, seed) {
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
  // Relay one paused phext.tech request to the hub gateway and
  // fulfill it with the gateway's own answer, byte for byte.
  async function relay(params) {
    const { requestId, request } = params;
    try {
      const u = new URL(request.url);
      const init = { method: request.method, headers: {} };
      for (const [k, v] of Object.entries(request.headers || {})) {
        if (/^(host|content-length|connection)$/i.test(k)) continue;
        init.headers[k] = v;
      }
      if (request.postData) init.body = request.postData;
      const r = await fetch(GW + u.pathname + u.search, init);
      const buf = Buffer.from(await r.arrayBuffer());
      const headers = [];
      r.headers.forEach((v, k) => {
        if (/^(content-length|connection|transfer-encoding)$/i.test(k)) return;
        headers.push({ name: k, value: v });
      });
      await send("Fetch.fulfillRequest", {
        requestId, responseCode: r.status, responseHeaders: headers,
        body: buf.toString("base64"),
      });
    } catch (e) {
      // Logged, never silent: a blind relay once ate a whole gate
      // run (the page-URL constant shadowed the URL constructor and
      // every relay threw before it began).
      console.log("  relay error:", request.method, request.url, String(e).slice(0, 140));
      try { await send("Fetch.failRequest", { requestId, errorReason: "Failed" }); } catch (e2) {}
    }
  }
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.reject(new Error(`CDP error from ${p.label}: ` + (m.error.message || JSON.stringify(m.error))));
      else p.resolve(m.result);
    } else if (m.method === "Fetch.requestPaused") {
      relay(m.params);
    } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      consoleErrors.push(JSON.stringify(m.params.args));
    } else if (m.method === "Runtime.exceptionThrown") {
      consoleErrors.push("exception: " + (m.params.exceptionDetails.exception?.description || ""));
    }
  };
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
      try { if (await evalJs(expr)) return true; } catch (e) { /* loading */ }
      await sleep(250);
    }
    console.log(`  .. timeout waiting for: ${label}`);
    return false;
  }
  async function boot() {
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Network.enable");
    await send("Fetch.enable", {
      patterns: [{ urlPattern: "https://phext.tech/api/v2/*", requestStage: "Request" }],
    });
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1280, height: 800, deviceScaleFactor: 1, mobile: false,
    });
    if (seed) {
      await send("Page.addScriptToEvaluateOnNewDocument", { source: seed });
    }
    await send("Page.navigate", { url: PAGE_URL });
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
  return { chrome, evalJs, waitFor, boot, enterWorld,
           consoleErrors,
           close: () => { try { ws.close(); } catch (e) {} chrome.kill("SIGKILL"); } };
}

function seedScript({ fox, token, eco }) {
  const lines = [
    `localStorage.setItem('nova-phox-name', ${JSON.stringify(JSON.stringify(fox))});`,
    `localStorage.setItem('nf.scheme', 'wasd');`,
  ];
  if (token) lines.push(`localStorage.setItem('nova-phox-token', ${JSON.stringify(JSON.stringify(token))});`);
  if (eco) lines.push(`localStorage.setItem('nova-phox-economy', ${JSON.stringify(JSON.stringify(eco))});`);
  return lines.join("\n");
}

async function selectScroll(coord) {
  const r = await fetch(`${GW}/api/v2/select?p=nova-phox-world&c=${coord}`);
  return r.ok ? await r.text() : "";
}

try {
  check("setup: the W-3 fixtures stand ready (gift + three foxes + tokens)",
    !!SETUP.gift && !!SETUP.foxA && !!SETUP.tokenA && !!SETUP.tokenB && !!SETUP.tokenC);

  // ---- Context A: the server validates the waiting gift key ----
  console.log("\n== A: connect with a gift key waiting for its first sync ==");
  const profA = mkdtempSync(join(tmpdir(), "nf-w3-a-"));
  const A = await launch(profA, PORT, seedScript({
    fox: SETUP.foxA, token: SETUP.tokenA, eco: { pendingGiftKey: SETUP.gift },
  }));
  check("A: the game boots", await A.boot());
  check("A: the global server marks the session paid",
    await A.waitFor("NOVA_FOX3.licenseSession().paid === true", 30000, "license paid"));
  const sessA = await A.evalJs("JSON.stringify(NOVA_FOX3.licenseSession())");
  check("A: the paid word names its source (gift)",
    JSON.parse(sessA).source === "gift", sessA.slice(0, 120));
  check("A: the standing itself rose to paid (the generator standing)",
    await A.waitFor("NOVA_FOX3.ecoState().entitlement.status === 'paid'", 15000, "paid standing"));
  const gateA = JSON.parse(await A.evalJs("JSON.stringify(NOVA_FOX3.flightState().gate)"));
  check("A: flight opens via paid, on the server's word",
    gateA.ok === true && gateA.via === "paid", JSON.stringify(gateA));
  const dialA = JSON.parse(await A.evalJs("JSON.stringify(NOVA_FOX3.dialState().unlocked)"));
  check("A: the dial's range unlocks on the same word",
    dialA.ok === true && dialA.via === "paid", JSON.stringify(dialA));
  await A.enterWorld();
  // The redemption + claim ride the outbox discipline; give the
  // flush a moment, then read the chart itself.
  await sleep(3000);
  await A.evalJs("NOVA_FOX3.backendFlush()");
  await sleep(2000);
  const ledger = await selectScroll("1.1.1/1.1.4/1.1.1");
  check("A: the gift-redeemed line lands on the ledger, naming this fox",
    ledger.includes(`gift-redeemed|${SETUP.giftHash}|${SETUP.foxA}|`), "");
  const record = await selectScroll("1.1.1/1.1.3/1.1.1");
  check("A: the purchase claim lands on the written record",
    record.includes(`${SETUP.foxA}|gift|`), record.slice(0, 120));
  check("A: zero page exceptions", A.consoleErrors.length === 0,
    A.consoleErrors.slice(0, 2).join(" | "));
  A.close();

  // ---- Context B: no key — a full free session ----
  console.log("\n== B: connect with no key ==");
  const profB = mkdtempSync(join(tmpdir(), "nf-w3-b-"));
  const B = await launch(profB, PORT + 1, seedScript({
    fox: SETUP.foxB, token: SETUP.tokenB, eco: null,
  }));
  check("B: the game boots", await B.boot());
  await B.enterWorld();
  await sleep(1500);
  const sessB = JSON.parse(await B.evalJs("JSON.stringify(NOVA_FOX3.licenseSession())"));
  check("B: the session stands free (validation never gates entry)",
    sessB.paid === false, JSON.stringify(sessB).slice(0, 120));
  check("B: the standing stays free", (await B.evalJs("NOVA_FOX3.ecoState().entitlement.status")) === "free");
  const gateB = JSON.parse(await B.evalJs("JSON.stringify(NOVA_FOX3.flightState().gate)"));
  check("B: flight stays shut for a free fox", gateB.ok === false, JSON.stringify(gateB));
  const realmB = await B.evalJs("NOVA_FOX3.state.realm");
  check("B: the fox stands in the world, playable", realmB === "nova", String(realmB));
  check("B: zero page exceptions", B.consoleErrors.length === 0,
    B.consoleErrors.slice(0, 2).join(" | "));
  B.close();

  // ---- Context C: the spent gift refuses the second fox ----
  console.log("\n== C: a second fox presents the spent gift ==");
  const profC = mkdtempSync(join(tmpdir(), "nf-w3-c-"));
  const C = await launch(profC, PORT + 2, seedScript({
    fox: SETUP.foxC, token: SETUP.tokenC, eco: { pendingGiftKey: SETUP.gift },
  }));
  check("C: the game boots", await C.boot());
  // The boot flush judges the waiting key against the ledger it
  // reads back and clears it with the spent verdict in the panel
  // note; the gateway's own answer to the same fox + key is asked
  // directly below — both doors must refuse, and neither may pay.
  check("C: the in-game verdict names the spend",
    await C.waitFor(
      "(document.getElementById('eco-note') || {}).textContent?.includes('already spent') === true",
      30000, "spent note"));
  const direct = await (await fetch(`${GW}/api/v2/license-session`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: SETUP.gift, name: SETUP.foxC }),
  })).json();
  check("C: the gateway refuses the second fox 'spent' by name",
    direct.paid === false && direct.reason === "spent",
    JSON.stringify(direct).slice(0, 120));
  check("C: the session stands free", (await C.evalJs("NOVA_FOX3.licenseSession().paid")) === false);
  check("C: the standing stays free", (await C.evalJs("NOVA_FOX3.ecoState().entitlement.status")) === "free");
  check("C: zero page exceptions", C.consoleErrors.length === 0,
    C.consoleErrors.slice(0, 2).join(" | "));
  C.close();
} catch (e) {
  fail++;
  console.log("FAIL  probe error: " + (e && e.stack || e));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
