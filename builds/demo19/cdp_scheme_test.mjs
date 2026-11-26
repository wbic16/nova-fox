// Nova Fox demo19 — the control-scheme preference, end to end in
// headless Chrome over CDP (private port 9351; the shared 9335
// cross-navigates sibling suites). The legs, in order:
//   1. first play, nothing stored: a scheme resolves by coin flip
//      and the flip's result is stored, so a reload keeps it
//   2. nf.scheme = 'awef' stored before load: AWEF is the active
//      scheme, both Controls toggles wear its name
//   3. the title panel's Controls toggle flips the scheme live and
//      persists it — and does NOT step the panel aside
//   4. the guide's move lesson speaks and shows the AWEF variant
//      (N-03-AWEF queued; the panel's letters are A W E F)
//   5. toggling mid-lesson re-letters the lesson live (words and
//      voice) and persists the new preference
//   6. cleared storage: a scheme resolves again and is stable
//      across the next load
//   7. a corrupt stored value heals: boot succeeds, a real scheme
//      resolves, the stored value is rewritten to match
//   8. zero console errors throughout
// Run: node cdp_scheme_test.mjs   (exits non-zero on any failure)
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = "/opt/meta-chromium/chrome";
const PORT = 9351;
const URL = "file:///home/hatch/workspace/nova-fox/demo19/index.html";

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "novafox19-scheme-"));
const POLICY =
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const policySha = createHash("sha256").update(readFileSync(POLICY)).digest("hex");
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
  `--hatch-webgl-allowed-domains-file=${POLICY}`,
  `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
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
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error("page exception: " +
      (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}
async function boot() {
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    try { if (await evalJs("!!window.NOVA_FOX3")) { await sleep(800); return true; } }
    catch (e) { /* loading */ }
  }
  return false;
}
const scheme = () => evalJs("NOVA_FOX3.state.scheme");
const storedPref = () => evalJs("localStorage.getItem('nf.scheme')");

try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id).resolve(m.result);
      pending.delete(m.id);
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
  await send("Page.navigate", { url: URL });
  check("page boots, NOVA_FOX3 handle present", await boot());

  // 1. First play: the flip resolves and stores.
  const first = await scheme();
  check("first play resolves a scheme (the coin flip)",
    first === "WASD" || first === "AWEF", `got ${first}`);
  check("the flip's result is stored in nf.scheme",
    (await storedPref()) === (first === "AWEF" ? "awef" : "wasd"),
    `stored ${await storedPref()}`);
  check("the flip's result is stored in the controls record too",
    await evalJs("JSON.parse(localStorage.getItem('nova-phox-controls')).scheme") === first);
  await send("Page.reload");
  check("reload returns", await boot());
  check("the scheme is stable across sessions on this browser",
    (await scheme()) === first, `was ${first}, now ${await scheme()}`);

  // 2. A stored preference rules the boot.
  await evalJs("localStorage.setItem('nf.scheme', 'awef')");
  await send("Page.reload");
  check("reload returns", await boot());
  check("stored nf.scheme=awef makes AWEF the active scheme",
    (await scheme()) === "AWEF");
  check("the title toggle wears the resolved scheme",
    (await evalJs("document.getElementById('btn-scheme-splash').textContent")) === "Controls: AWEF");
  check("the keys button wears the resolved scheme",
    (await evalJs("document.getElementById('btn-keys').textContent")) === "Controls: AWEF");

  // 3. The title toggle: live, persisted, and the panel stays up.
  check("the title panel is up before the toggle",
    await evalJs("NOVA_FOX3.state.splash") === true);
  await evalJs("document.getElementById('btn-scheme-splash').click()");
  check("the title toggle switches the scheme live",
    (await scheme()) === "WASD");
  check("the title toggle persists the preference",
    (await storedPref()) === "wasd");
  check("setting the scheme does not step the title panel aside",
    await evalJs("NOVA_FOX3.state.splash") === true &&
    (await evalJs("getComputedStyle(document.getElementById('splash')).display")) === "flex");
  await evalJs("document.getElementById('btn-scheme-splash').click()");
  check("and toggles back to AWEF, persisted",
    (await scheme()) === "AWEF" && (await storedPref()) === "awef");

  // 4. The move lesson speaks and shows the AWEF variant.
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(200);
  await evalJs("document.getElementById('guide-btn').click()");
  await sleep(200);
  await evalJs("document.getElementById('guide-btn').click()");
  await sleep(200);
  check("the guide reaches the move lesson",
    await evalJs("NOVA_FOX3.guideCurrent().id") === "move");
  check("the AWEF intro variant is the beat queued",
    await evalJs("NOVA_FOX3.state.lastGuideBeat") === "N-03-AWEF" &&
    await evalJs("NOVA_FOX3.narration.state().pending.includes('N-03-AWEF')") === true,
    `lastGuideBeat=${await evalJs("NOVA_FOX3.state.lastGuideBeat")}`);
  check("the move panel's letters are the AWEF letters",
    (await evalJs("document.getElementById('guide-lines').textContent")).includes("A W E F"));

  // 5. A mid-lesson toggle re-letters live and persists.
  await evalJs("document.getElementById('btn-keys').click()");
  check("the keys button switches back to WASD live",
    (await scheme()) === "WASD" && (await storedPref()) === "wasd");
  check("the lesson re-letters to WASD on screen",
    (await evalJs("document.getElementById('guide-lines').textContent")).includes("W A S D"));
  check("and the WASD variant takes the voice's place",
    await evalJs("NOVA_FOX3.state.lastGuideBeat") === "N-03-WASD",
    `lastGuideBeat=${await evalJs("NOVA_FOX3.state.lastGuideBeat")}`);

  // 6. Cleared storage: resolve again, then stay put.
  await evalJs("localStorage.clear()");
  await send("Page.reload");
  check("reload returns", await boot());
  const again = await scheme();
  check("cleared storage still resolves a scheme",
    again === "WASD" || again === "AWEF", `got ${again}`);
  check("and stores it again",
    (await storedPref()) === (again === "AWEF" ? "awef" : "wasd"));
  await send("Page.reload");
  check("reload returns", await boot());
  check("the re-resolved scheme persists on the next load",
    (await scheme()) === again);

  // 7. A corrupt stored value heals.
  await evalJs("localStorage.setItem('nf.scheme', 'banana')");
  await send("Page.reload");
  check("reload returns", await boot());
  const healed = await scheme();
  check("a corrupt preference still boots to a real scheme",
    healed === "WASD" || healed === "AWEF", `got ${healed}`);
  check("the corrupt value is rewritten to the resolved scheme",
    (await storedPref()) === (healed === "AWEF" ? "awef" : "wasd"),
    `stored ${await storedPref()}`);

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
