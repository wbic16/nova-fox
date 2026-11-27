// Nova Fox — S-2 money path + login verification legs, in headless
// Chrome over CDP (the probe-msg pattern; run via the Jenkins job
// nova-fox-e2e-s2money-probe). Exercises, against the REAL gateway
// (phext.tech) and the REAL Gumroad verify door:
//   LOGIN      — the signed-out hand-off chain (game -> game-login
//                -> phext.tech sign-in, ?next= round-trip), the
//                token intake from the URL fragment (the hand-off's
//                own return shape; the token is operator-minted by
//                the gateway's own mint function + secret, the
//                EE 948 precedent — the OAuth click-through itself
//                is phext.tech platform surface and is the one leg
//                no probe can drive), and token-gated writes.
//   REDEMPTION — a TEST gift issuance on the economy ledger (posted
//                through the gateway write path by s2-issue.mjs):
//                unknown-key refusal, the real redeem in the real
//                panel, the purchase claim read back with its
//                number, the spent refusal in a second context,
//                and the Gumroad door's refusal of a fake key.
//   FUNDED BUY — a TEST handdown (Fork B faucet 3) funds the buyer;
//                two ladder buys through the shop's real buttons,
//                four refusals (requires/funds by button, owned/
//                beat/granted by the shop's own handle), persistence
//                across a reload, and generator accrual observed.
//   CONSOLE    — the S-2 gate: rift-straight refused with no token,
//                admitted with one; diagnostics open either way.
//   REOPEN     — the P-2-flagged question (EE 1100): a funded
//                profile with a pack, a real sale, every write
//                flushed — then reopen + flush again, and the
//                pack/purse read-back must equal the server's
//                current economy record exactly (no stale
//                snapshot, no double-count).
// The page is served as https://fox.phext.io from a local stand-in
// (host-resolver maps that one host to 127.0.0.3) because the
// gateway's CORS admits only the game's own origin; phext.tech
// itself is the real awsbox gateway throughout.
//
// Every record these legs write names its TEST identity in the
// record itself (TEST-GIVER-S2 / TESTBUYER-S2 / TESTBUYER2-S2) —
// subspace is append-only, so the test evidence stands labeled.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { giftKeyHash, isGiftKey, parsePurchaseBoard, purchaseNumberFor }
  from "./economy.js";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9423);
const URL = process.env.NF_URL || "https://fox.phext.io/index.html";
const TOKEN = process.env.NF_TOKEN_FILE
  ? readFileSync(process.env.NF_TOKEN_FILE, "utf8").trim() : "";
const GIFT = process.env.NF_GIFT_FILE
  ? readFileSync(process.env.NF_GIFT_FILE, "utf8").trim() : "";
const GIFT_HASH = GIFT ? giftKeyHash(GIFT) : "";
// The buyer identity is a parameter so a re-run can take a fresh
// TEST name: subspace is append-only, so a spent gift and a posted
// claim from an earlier run stand forever under the first name.
const BUYER = process.env.NF_BUYER || "TESTBUYER-S2";
const HD_ID = process.env.NF_HD_ID || "s2-test-hd1";
const SELECT = (c) =>
  `https://phext.tech/api/v2/select?p=nova-phox-world&c=${c}`;
const ECO_COORD = "1.1.1/1.1.4/1.1.1";
const PURCHASE_COORD = "1.1.1/1.1.3/1.1.1";

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
    "--host-resolver-rules=MAP fox.phext.io 127.0.0.3",
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
  const loginChain = []; // game-login responses: {status, location}
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
    } else if (m.method === "Network.responseReceived") {
      const r = m.params.response;
      if (r.url.includes("phext.tech")) {
        const h = {};
        for (const [k, v] of Object.entries(r.headers || {})) h[k.toLowerCase()] = v;
        loginChain.push({ via: "response", url: r.url, status: r.status, location: h.location || "" });
      }
    } else if (m.method === "Network.requestWillBeSent") {
      // A redirect hop surfaces here, on the FOLLOWING request, as
      // redirectResponse — the canonical place to observe a 302.
      const rr = m.params.redirectResponse;
      if (rr && rr.url.includes("phext.tech")) {
        const h = {};
        for (const [k, v] of Object.entries(rr.headers || {})) h[k.toLowerCase()] = v;
        loginChain.push({ via: "redirect", url: rr.url, status: rr.status, location: h.location || "" });
      }
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
  async function waitNote(substr, timeoutMs) {
    const t0 = Date.now();
    let text = "";
    while (Date.now() - t0 < timeoutMs) {
      text = await evalJs("(document.getElementById('eco-note')||{}).textContent || ''");
      if (text.includes(substr)) return text;
      await sleep(300);
    }
    return text;
  }
  return { chrome, evalJs, waitFor, boot, waitBooted, enterWorld, waitNote,
           consoleErrors, loginChain,
           close: () => { try { ws.close(); } catch (e) {} chrome.kill("SIGKILL"); } };
}

const ecoState = (C) => C.evalJs("NOVA_FOX3.ecoState()");
const setKeyAndRedeem = async (C, key) => {
  await C.evalJs(`(() => { const f = document.getElementById('eco-key');
    f.value = ${JSON.stringify(key)}; return true; })()`);
  await C.evalJs("document.getElementById('btn-redeem').click()");
};

try {
  check("setup: the operator token stands ready (never printed)", TOKEN.length > 20);
  check("setup: the TEST gift key stands ready and is well-formed",
    !!GIFT && isGiftKey(GIFT));
  const ledger0 = await (await fetch(SELECT(ECO_COORD))).text();
  check("setup: the TEST gift issuance stands on the real ledger",
    ledger0.includes(`gift-issued|${GIFT_HASH}|TEST-GIVER-S2|`));
  check("setup: the TEST handdown stands on the real ledger",
    ledger0.includes(`handdown|${HD_ID}|TEST-GIVER-S2|${BUYER}|25|`));

  // ================= CONTEXT A: the test buyer =================
  const A = await launch(mkdtempSync(join(tmpdir(), "novafox-s2A-")), PORT);
  check("A: page boots, NOVA_FOX3 handle present", await A.boot());
  // The pinned identity, seeded the way the game's own stores keep
  // it (the LS wrapper JSON-encodes), then a reload to boot as him.
  await A.evalJs(`localStorage.setItem('nova-phox-name', ${JSON.stringify(JSON.stringify(BUYER))})`);
  await A.evalJs("localStorage.setItem('nf.scheme', 'wasd')");
  await A.evalJs("location.reload()");
  check("A: the pinned boot returns (test buyer name)", await A.waitBooted());
  check("A: a fresh buyer carries no token", await A.evalJs("NOVA_FOX3.hasToken()") === false);
  check("A: the login door is the real phext.tech hand-off",
    (await A.evalJs("NOVA_FOX3.loginUrl()")) ===
      "https://phext.tech/api/game-login?back=https%3A%2F%2Ffox.phext.io%2F");

  // --- LOGIN leg 1: the signed-out hand-off chain, live -----------
  await A.evalJs("NOVA_FOX3.loginUrl()").then((u) =>
    A.evalJs(`location.href = ${JSON.stringify("https://phext.tech/api/game-login?back=https%3A%2F%2Ffox.phext.io%2F")}`));
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 25000 &&
           !A.loginChain.some((e) => e.status === 302)) await sleep(300);
    await sleep(2500); // let the platform page settle
  }
  const hop = A.loginChain.find((e) => e.status === 302) || {};
  check("login: game-login answers a signed-out buyer with a redirect (302)",
    hop.status === 302, JSON.stringify(A.loginChain).slice(0, 300));
  check("login: the redirect hands the buyer to phext.tech sign-in, carrying the way back",
    typeof hop.location === "string" &&
    hop.location.startsWith("https://phext.tech/?next=") &&
    decodeURIComponent(hop.location).includes("/api/game-login?back="),
    hop.location || "(no location)");
  const landedOn = await A.evalJs("location.href").catch(() => "");
  check("login: the buyer lands on phext.tech itself (the platform's own sign-in)",
    landedOn.startsWith("https://phext.tech/"), landedOn);
  check("login: the landing URL itself carries the way back (?next= round-trips game-login)",
    landedOn.includes("?next=") &&
    decodeURIComponent(landedOn).includes("/api/game-login?back="), landedOn);
  await A.evalJs(`location.href = ${JSON.stringify(URL)}`);
  check("A: the game boots again after the hand-off excursion", await A.waitBooted());

  // --- LOGIN leg 2: the token return, in the hand-off's own shape --
  await A.evalJs(`location.href = ${JSON.stringify(URL + "#np_token=" + TOKEN)}`);
  check("A: the game boots on the hand-off's return", await A.waitBooted());
  check("login: the fragment token is taken in (hasToken)",
    await A.evalJs("NOVA_FOX3.hasToken()") === true);
  check("login: the fragment is stripped from the address after intake",
    (await A.evalJs("location.hash")) === "");
  check("login: the stored token is the delivered token",
    (await A.evalJs("localStorage.getItem('nova-phox-token')")) === JSON.stringify(TOKEN));

  await A.enterWorld();
  check("A: the backend answers — the game is online against the real gateway",
    await A.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online"));

  // --- the handdown lands (Fork B faucet 3, read through the game) -
  await A.evalJs("NOVA_FOX3.backendFlush()");
  await A.waitFor("NOVA_FOX3.ecoState().lifetime.handdownsReceived === 25",
    30000, "handdown applied");
  const afterHd = await ecoState(A);
  check("funding: the TEST handdown credits the buyer exactly once (25)",
    afterHd.lifetime.handdownsReceived === 25 && afterHd.credits >= 25,
    `credits=${afterHd.credits} received=${afterHd.lifetime.handdownsReceived}`);
  check("funding: a second flush does not credit it twice",
    (await A.evalJs("NOVA_FOX3.backendFlush()"), await ecoState(A))
      .lifetime.handdownsReceived === 25);

  // --- REDEMPTION legs ----------------------------------------------
  check("redeem: the buyer starts free", afterHd.entitlement.status === "free");
  await setKeyAndRedeem(A, "TEST-INVALID-KEY-0000");
  // Wait for the door's RESOLUTION, not its first word: the note
  // opens with "asking Gumroad about that key…" and only later
  // lands on a verdict.
  const gumNote = await (async () => {
    const t0 = Date.now();
    let text = "";
    while (Date.now() - t0 < 60000) {
      text = await A.evalJs("(document.getElementById('eco-note')||{}).textContent || ''");
      if (text.includes("doesn't know that key") || text.includes("can't be reached")) return text;
      await sleep(300);
    }
    return text;
  })();
  const gumState = await ecoState(A);
  check("redeem: the Gumroad door refuses a fake TEST key — no entitlement",
    gumState.entitlement.status === "free" &&
    (gumNote.includes("doesn't know that key") || gumNote.includes("can't be reached")),
    gumNote);
  console.log(`  .. gumroad leg observed: ${gumNote.includes("doesn't know that key")
    ? "the door answered and rejected the key" : "the door was unreachable from the page (pending, no grant)"}`);
  await setKeyAndRedeem(A, "NFG-TEST-TEST-TEST-TEST");
  const unkNote = await A.waitNote("no record of that gift key", 20000);
  check("redeem: a well-formed but never-issued gift key is refused by name",
    unkNote.includes("no record of that gift key") &&
    (await ecoState(A)).entitlement.status === "free", unkNote);
  await setKeyAndRedeem(A, GIFT);
  const goodNote = await A.waitNote("the gift key is good", 20000);
  const paidState = await ecoState(A);
  check("redeem: the issued TEST gift key redeems in the real panel",
    goodNote.includes("the gift key is good") &&
    paidState.entitlement.status === "paid" &&
    paidState.entitlement.source === "gift", goodNote);
  check("redeem: a paid fox's flight gate opens on the paid path (EE 1034 ruling)",
    (await A.evalJs("NOVA_FOX3.flightState()")).gate.ok === true);

  // --- the written record: claim out, number back --------------------
  await A.evalJs("NOVA_FOX3.backendFlush()");
  await A.waitFor(
    "JSON.parse(localStorage.getItem('nova-phox-eco-outbox') || '[]').length === 0",
    45000, "eco outbox drained");
  const purchaseText = await (await fetch(SELECT(PURCHASE_COORD))).text();
  const ledgerText = await (await fetch(SELECT(ECO_COORD))).text();
  check("record: the redemption stands on the real ledger under the test name",
    ledgerText.includes(`gift-redeemed|${GIFT_HASH}|${BUYER}|`));
  check("record: the purchase claim stands on the written record",
    purchaseText.includes(`${BUYER}|gift|`), purchaseText.slice(0, 200));
  await A.evalJs("NOVA_FOX3.backendFlush()");
  const rows = parsePurchaseBoard(purchaseText);
  const expectNum = purchaseNumberFor(rows, BUYER);
  const numbered = await ecoState(A);
  check("record: the claim's number reads back from the record itself",
    expectNum !== null && numbered.entitlement.purchaseNumber === expectNum &&
    numbered.entitlement.claimPosted === true,
    `scroll says ${expectNum}, client holds ${numbered.entitlement.purchaseNumber}`);

  // --- ACCRUAL, observed ----------------------------------------------
  const beforeAcc = await ecoState(A);
  const spewExpect = Math.floor(beforeAcc.frac.spew + 100);
  await A.evalJs("NOVA_FOX3.ecoAccrue(3600)");
  const afterAcc = await ecoState(A);
  const spewDelta = afterAcc.lifetime.tokensSpewed - beforeAcc.lifetime.tokensSpewed;
  const creditDelta = afterAcc.credits - beforeAcc.credits;
  check("accrual: an hour of generator play spews for the world (observed, ~100 flux)",
    Math.abs(spewDelta - spewExpect) <= 1 && spewDelta >= 100,
    `spewed delta=${spewDelta} expected=${spewExpect}`);
  check("accrual: the generation skill mints credits from the spew (observed, ~10)",
    creditDelta >= 10 && creditDelta <= 11,
    `credits ${beforeAcc.credits} -> ${afterAcc.credits}`);
  check("accrual: the spew pool stands ready to post",
    afterAcc.poolSpewed >= beforeAcc.poolSpewed + 100,
    `pool ${beforeAcc.poolSpewed} -> ${afterAcc.poolSpewed}`);

  // --- FUNDED BUY legs ---------------------------------------------------
  const B0 = (await ecoState(A)).credits;
  check("buy: the shop renders a real buy button for the cheapest rung",
    await A.evalJs("!!document.querySelector('button[data-rung=\"keepsake-tune-pip\"]')"));
  await A.evalJs("document.querySelector('button[data-rung=\"keepsake-tune-pip\"]').click()");
  const buy1Note = await A.waitNote("is yours", 10000);
  let st = await ecoState(A);
  check("buy: keepsake-tune-pip bought through the shop button — 5 credits, exact",
    buy1Note.includes("Keepsake Tune Pip is yours") && st.credits === B0 - 5 &&
    st.ladder["keepsake-tune-pip"] && st.ladder["keepsake-tune-pip"].via === "bought",
    `${buy1Note} | credits ${B0} -> ${st.credits}`);
  await A.evalJs("document.querySelector('button[data-rung=\"chisel-first-degree\"]').click()");
  const buy2Note = await A.waitNote("is yours", 10000);
  st = await ecoState(A);
  check("buy: chisel-first-degree bought through the shop button — 10 credits, exact",
    buy2Note.includes("Chisel, First Degree is yours") && st.credits === B0 - 15 &&
    !!st.ladder["chisel-first-degree"],
    `${buy2Note} | credits -> ${st.credits}`);
  await A.evalJs("document.querySelector('button[data-rung=\"flute-harmonics\"]').click()");
  const reqNote = await A.waitNote("comes after", 10000);
  st = await ecoState(A);
  check("buy refusal: a rung past its prerequisite refuses by name (requires), purse untouched",
    reqNote.includes("comes after") && st.credits === B0 - 15 && !st.ladder["flute-harmonics"],
    reqNote);
  await A.evalJs("document.querySelector('button[data-rung=\"realm-anchor-cord\"]').click()");
  const fundsNote = await A.waitNote("costs 110 credits", 10000);
  st = await ecoState(A);
  check("buy refusal: a rung past the purse refuses by name (funds), purse untouched",
    fundsNote.includes("costs 110 credits") && st.credits === B0 - 15 &&
    !st.ladder["realm-anchor-cord"], fundsNote);
  check("buy refusal: an owned rung refuses (owned)",
    JSON.stringify(await A.evalJs("NOVA_FOX3.ecoBuyRung('keepsake-tune-pip')"))
      .includes('"reason":"owned"'));
  check("buy refusal: a Beat 2 rung refuses (beat)",
    JSON.stringify(await A.evalJs("NOVA_FOX3.ecoBuyRung('dragonward-helm')"))
      .includes('"reason":"beat"'));
  check("buy refusal: the granted rung is never sold (granted)",
    JSON.stringify(await A.evalJs("NOVA_FOX3.ecoBuyRung('deep-stone-hat')"))
      .includes('"reason":"granted"'));
  st = await ecoState(A);
  check("buy: after every refusal the purse and ladder stand exactly as the two buys left them",
    st.credits === B0 - 15 && Object.keys(st.ladder).length === 2,
    `credits=${st.credits} rungs=${Object.keys(st.ladder).join(",")}`);

  // Give the pack a real shape in the profile's own store (dirt x3,
  // stone x2 — the store is the profile's record; the reopen legs
  // below read it back through the game's own handles only).
  // The economy store is single-encoded (the LS wrapper's own
  // JSON.stringify) — parse once, guard the string case, write
  // back in the wrapper's exact shape.
  await A.evalJs(`(() => { let ecoObj = JSON.parse(localStorage.getItem('nova-phox-economy'));
    if (typeof ecoObj === 'string') ecoObj = JSON.parse(ecoObj);
    ecoObj.materials = { "2": 3, "3": 2 };
    localStorage.setItem('nova-phox-economy', JSON.stringify(ecoObj));
    return true; })()`);
  await A.evalJs("location.reload()");
  check("A: the pinned boot returns with a pack in the store", await A.waitBooted());
  const packSeeded = await A.evalJs("NOVA_FOX3.digState()");
  check("pack: the stored pack reads back through the game's own handle",
    packSeeded.materials["2"] === 3 && packSeeded.materials["3"] === 2,
    JSON.stringify(packSeeded.materials));

  // --- persistence across a reload ---------------------------------------
  await A.evalJs("location.reload()");
  check("A: the pinned boot returns after reload", await A.waitBooted());
  const reSt = await ecoState(A);
  const reDig = await A.evalJs("NOVA_FOX3.digState()");
  check("buy: the paid standing, the purse, and both rungs survive a reload",
    reSt.entitlement.status === "paid" && reSt.credits === B0 - 15 &&
    !!reSt.ladder["keepsake-tune-pip"] && !!reSt.ladder["chisel-first-degree"],
    `credits=${reSt.credits}`);
  check("pack: the pack survives the reload, count for count",
    reDig.materials["2"] === 3 && reDig.materials["3"] === 2 &&
    Object.keys(reDig.materials).length === 2,
    JSON.stringify(reDig.materials));

  // --- REOPEN AFTER FLUSH (the P-2-flagged question, EE 1100) --------
  // A funded profile, a real sale through the game's own verb, every
  // queued write flushed to the server — then the profile reopens
  // and flushes AGAIN. The read-back must equal the server's current
  // economy record exactly: no stale snapshot, no double-count.
  const preSale = await A.evalJs("NOVA_FOX3.digState()");
  await A.evalJs("NOVA_FOX3.sellMaterialNow(3, 1)");
  const saleNote = await A.waitNote("sold 1 stone for 4 flux", 10000);
  const postSale = await A.evalJs("NOVA_FOX3.digState()");
  check("reopen: a real sale moves pack -> purse in one step (stone -1, +4 flux)",
    saleNote.includes("sold 1 stone for 4 flux") &&
    postSale.materials["3"] === preSale.materials["3"] - 1 &&
    postSale.tokens === preSale.tokens + 4 && postSale.sold === preSale.sold + 1,
    `${saleNote} | ${JSON.stringify(preSale.materials)} -> ${JSON.stringify(postSale.materials)}`);
  await A.evalJs("NOVA_FOX3.backendFlush()");
  await A.waitFor(
    "JSON.parse(localStorage.getItem('nova-phox-eco-outbox') || '[]').length === 0",
    45000, "eco outbox drained (reopen leg)");
  const S1 = await ecoState(A);
  const S1dig = await A.evalJs("NOVA_FOX3.digState()");
  const srvEco = await (await fetch(SELECT(ECO_COORD))).text();
  const srvPur = await (await fetch(SELECT(PURCHASE_COORD))).text();
  const redeemedLines = srvEco.split("\n")
    .filter((l) => l.startsWith(`gift-redeemed|${GIFT_HASH}|`)).length;
  const handdownSum = srvEco.split("\n")
    .filter((l) => l.startsWith("handdown|"))
    .map((l) => l.split("|"))
    .filter((p) => p[3] === BUYER)
    .reduce((a, p) => a + (+p[4] || 0), 0);
  const claimLines = srvPur.split("\n")
    .filter((l) => l.startsWith(`${BUYER}|`)).length;
  check("reopen: the server record holds the redemption exactly once",
    redeemedLines === 1, `gift-redeemed lines=${redeemedLines}`);
  check("reopen: the server's handdowns to the buyer sum to what the client credited (25, no more)",
    handdownSum === 25 && S1.lifetime.handdownsReceived === handdownSum,
    `server=${handdownSum} client=${S1.lifetime.handdownsReceived}`);
  check("reopen: the server holds exactly one purchase claim, at the number the client carries",
    claimLines === 1 &&
    purchaseNumberFor(parsePurchaseBoard(srvPur), BUYER) ===
      S1.entitlement.purchaseNumber,
    `claims=${claimLines} number=${S1.entitlement.purchaseNumber}`);
  await A.evalJs("location.reload()");
  check("A: the pinned boot returns for the reopen-after-flush read-back",
    await A.waitBooted());
  await A.evalJs("NOVA_FOX3.backendFlush()");
  const S2 = await ecoState(A);
  const S2dig = await A.evalJs("NOVA_FOX3.digState()");
  check("reopen: after flush + reopen + flush, the pack is count-for-count identical",
    JSON.stringify(S2dig.materials) === JSON.stringify(S1dig.materials),
    `before=${JSON.stringify(S1dig.materials)} after=${JSON.stringify(S2dig.materials)}`);
  check("reopen: the purse's credits are exact after reopen — no double-count, no rollback",
    S2.credits === S1.credits &&
    S2.lifetime.handdownsReceived === 25 &&
    S2.lifetime.creditsEarned === S1.lifetime.creditsEarned &&
    S2.lifetime.ladderSpent === S1.lifetime.ladderSpent &&
    Object.keys(S2.ladder).length === 2,
    `credits ${S1.credits} -> ${S2.credits}, handdownsReceived=${S2.lifetime.handdownsReceived}`);
  check("reopen: flux moves only by honest accrual across the reopen (0 or +1, earned-lifetime agrees)",
    (S2.tokens - S1.tokens === 0 || S2.tokens - S1.tokens === 1) &&
    S2.lifetime.tokensEarned - S1.lifetime.tokensEarned === S2.tokens - S1.tokens,
    `tokens ${S1.tokens} -> ${S2.tokens}`);
  const srvEco2 = await (await fetch(SELECT(ECO_COORD))).text();
  const srvPur2 = await (await fetch(SELECT(PURCHASE_COORD))).text();
  check("reopen: the second flush writes no duplicate redemption and no duplicate claim",
    srvEco2.split("\n").filter((l) => l.startsWith(`gift-redeemed|${GIFT_HASH}|`)).length === 1 &&
    srvPur2.split("\n").filter((l) => l.startsWith(`${BUYER}|`)).length === 1);

  // --- CONSOLE GATE, with a token ------------------------------------------
  await A.evalJs("NOVA_FOX3.nfConsole.open()");
  const purseOut = await A.evalJs(`(async () => {
    const before = NOVA_FOX3.nfConsole.text().length;
    await NOVA_FOX3.nfConsole.run('purse');
    return NOVA_FOX3.nfConsole.text().slice(before); })()`);
  check("console: diagnostics run for a signed-in fox (purse)",
    purseOut.includes("flux"), purseOut.trim().split("\n").pop());
  await A.evalJs("(NOVA_FOX3.nfConsole.run('rift-straight'), 'fired')");
  {
    const t0 = Date.now();
    let out = "";
    while (Date.now() - t0 < 30000) {
      out = await A.evalJs("NOVA_FOX3.nfConsole.text()");
      if (out.includes("rift-straight: the bridge tune") ||
          out.includes("no rift opened")) break;
      await sleep(300);
    }
    check("console gate: with a token, rift-straight is admitted (the leg itself answers)",
      !out.includes("REFUSED") &&
      (out.includes("rift-straight: the bridge tune") || out.includes("no rift opened")),
      out.trim().split("\n").pop());
  }
  await A.evalJs("NOVA_FOX3.nfConsole.close()");
  await A.waitFor("NOVA_FOX3.nfConsole.busy() === false", 30000, "console leg settled");
  check("A: no page exceptions across the session",
    A.consoleErrors.filter((e) => e.startsWith("exception:")).length === 0,
    A.consoleErrors.slice(0, 2).join(" ; "));
  A.close();
  await sleep(1500);

  // ================= CONTEXT B: no token, and the spent key =========
  const B = await launch(mkdtempSync(join(tmpdir(), "novafox-s2B-")), PORT + 7);
  check("B: page boots in a fresh profile", await B.boot());
  check("B: no token stands in a fresh profile",
    await B.evalJs("NOVA_FOX3.hasToken()") === false);
  await B.evalJs("NOVA_FOX3.nfConsole.open()");
  const straightB = await B.evalJs(`(async () => {
    const before = NOVA_FOX3.nfConsole.text().length;
    await NOVA_FOX3.nfConsole.run('rift-straight');
    return NOVA_FOX3.nfConsole.text().slice(before); })()`);
  check("console gate: without a token, rift-straight is refused by name",
    straightB.includes("REFUSED") && straightB.includes("signed in"),
    straightB.trim().split("\n").pop());
  const diag = {};
  for (const c of ["where", "version", "purse", "gravity"]) {
    diag[c] = await B.evalJs(`(async () => {
      const before = NOVA_FOX3.nfConsole.text().length;
      await NOVA_FOX3.nfConsole.run(${JSON.stringify(c)});
      return NOVA_FOX3.nfConsole.text().slice(before); })()`);
  }
  check("console gate: the diagnostics stay open without a token (where/version/purse/gravity)",
    diag.where.includes("scroll") && diag.version.includes("EE") &&
    diag.purse.includes("flux") && diag.gravity.includes("subspace"),
    Object.entries(diag).map(([k, v]) => `${k}:${v.trim().split("\n").pop()}`).join(" | "));

  // The spent key, from a second fox: the ledger itself refuses.
  await B.evalJs(`localStorage.setItem('nova-phox-name', ${JSON.stringify(JSON.stringify("TESTBUYER2-S2"))})`);
  await B.evalJs(`localStorage.setItem('nova-phox-token', ${JSON.stringify(JSON.stringify(TOKEN))})`);
  await B.evalJs("location.reload()");
  check("B: the pinned boot returns (second test fox)", await B.waitBooted());
  await B.enterWorld();
  check("B: the backend answers for the second fox",
    await B.waitFor("NOVA_FOX3.geoState().online === true", 30000, "backend online (B)"));
  await B.evalJs("NOVA_FOX3.backendFlush()");
  await setKeyAndRedeem(B, GIFT);
  const spentNote = await B.waitNote("already been spent", 20000);
  check("redeem: the same gift key, spent once, refuses its second fox by name",
    spentNote.includes("already been spent") &&
    (await ecoState(B)).entitlement.status === "free", spentNote);
  check("B: no page exceptions across the session",
    B.consoleErrors.filter((e) => e.startsWith("exception:")).length === 0,
    B.consoleErrors.slice(0, 2).join(" ; "));
  B.close();
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + (e && e.message || e));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
