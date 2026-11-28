// Nova Fox W-2 — the feedback door probe. One action from inside
// the game to the Nova Wiki's feedback page, the build's ship-EE
// attached automatically. Runs against the tree SERVED over http,
// Full first and then the Lite package boot (the door must exist
// in both). window.open is stubbed and intercepted — the probe
// asserts the URL the door WOULD open and never navigates anywhere
// external.
// Legs (each on Full, then the click leg repeated on Lite):
//   A. boot, splash dismissed, Esc opens the menu; the probe
//      handle's feedbackUrl() is the named constant + this
//      artifact's own stamp (read from index.html on disk).
//   B. clicking the menu row opens exactly that URL, in a new
//      tab, and the menu note speaks.
//   C. keyboard only: Esc, seven ArrowDowns land the selection on
//      the feedback row (focus order), Enter opens the same URL.
// Env: NF_CHROME, NF_PORT (private CDP port), NF_HTTP_PORT,
//      NF_TREE (tree dir to serve; default: this file's dir).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME ||
  (existsSync("/opt/meta-chromium/chrome") ? "/opt/meta-chromium/chrome"
    : "/home/wbic16/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome");
const PORT = Number(process.env.NF_PORT || 9436);
const HTTP_PORT = Number(process.env.NF_HTTP_PORT || 8496);
const TREE = process.env.NF_TREE || dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- ground truth from disk ----------
const fullHtml = readFileSync(join(TREE, "index.html"), "utf8");
const stamp = (fullHtml.match(/NF_SHIP_EE:(\d+)/) || [])[1];
const liteHtml = readFileSync(join(TREE, "lite.html"), "utf8");
const liteEe = (liteHtml.match(/"ee":\s*"?(\d+)"?/) || [])[1];
const EXPECTED = `https://fox.phext.io/wiki/feedback?from=game&ee=${stamp}`;
console.log(`  .. ground truth: stamp=${stamp} liteEe=${liteEe} expected=${EXPECTED}`);

// ---------- static server ----------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".gz": "application/gzip", ".phext": "text/plain",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".png": "image/png", ".wasm": "application/wasm" };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(TREE, path);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  const data = readFileSync(file);
  res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream",
    "Content-Length": data.length });
  res.end(data);
});
await new Promise((r) => server.listen(HTTP_PORT, "127.0.0.1", r));
const FULL_URL = `http://127.0.0.1:${HTTP_PORT}/index.html`;
const LITE_URL = `http://127.0.0.1:${HTTP_PORT}/lite.html`;

// ---------- chrome over CDP (probe-t3 pattern) ----------
const profile = mkdtempSync(join(tmpdir(), "novafoxW2-"));
const POLICY = process.env.NF_POLICY ||
  "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const chromeArgs = [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
];
if (existsSync(POLICY)) {
  chromeArgs.push(
    `--hatch-webgl-allowed-domains-file=${POLICY}`,
    `--hatch-webgl-allowed-domains-sha256=${createHash("sha256").update(readFileSync(POLICY)).digest("hex")}`,
  );
}
chromeArgs.push(`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank");
const chrome = spawn(CHROME, chromeArgs, { stdio: ["ignore", "ignore", "pipe"] });
chrome.stderr.on("data", () => {});

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
let consoleErrors = [];
let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(id, { label: method,
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); } });
    try { ws.send(JSON.stringify({ id, method, params })); }
    catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
  });
}
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (!r || !r.result) throw new Error("evaluate returned no result");
  if (r.exceptionDetails) throw new Error("page exception: " +
    (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
async function waitBoot(timeoutMs = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await evalJs("!!window.NOVA_FOX3")) return Date.now() - t0; } catch (e) { /* loading */ }
    await sleep(250);
  }
  return -1;
}
async function key(k, code) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, text: k.length === 1 ? k : "" });
  await sleep(90);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code });
  await sleep(130);
}
async function mouse(type, x, y, button, buttons) {
  await send("Input.dispatchMouseEvent", { type, x, y, button, buttons, clickCount: 1 });
}
const STUB_OPEN = `(() => {
  window.__opened = [];
  window.open = (u, t, f) => { window.__opened.push({ u, t, f }); return null; };
  return true;
})()`;

function checkOpened(label, opened, expectedEe) {
  const want = `https://fox.phext.io/wiki/feedback?from=game&ee=${expectedEe}`;
  check(`${label}: the door opened exactly the expected URL`,
    !!opened && opened.u === want, `got ${opened && opened.u}`);
  if (!opened) return;
  const u = new URL(opened.u);
  check(`${label}: host/path/params parse as the wiki feedback page`,
    u.protocol === "https:" && u.host === "fox.phext.io" &&
    u.pathname === "/wiki/feedback" &&
    u.searchParams.get("from") === "game" && u.searchParams.get("ee") === String(expectedEe));
  check(`${label}: the door opens a new tab`, opened.t === "_blank", `target=${opened.t}`);
}

try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onclose = () => { for (const p of pending.values()) p.reject(new Error("CDP closed")); pending.clear(); };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.reject(new Error(`CDP error from ${p.label}: ` + (m.error.message || "")));
      else p.resolve(m.result);
    } else if (m.method === "Runtime.exceptionThrown") {
      consoleErrors.push("exception: " + (m.params.exceptionDetails.exception?.description || ""));
    }
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  // ---------- Full: legs A, B, C ----------
  await send("Page.navigate", { url: FULL_URL });
  check("Full: the game boots (NOVA_FOX3 handle)", (await waitBoot()) >= 0);
  await sleep(800);
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(200);
  await mouse("mousePressed", 400, 300, "left", 1);
  await mouse("mouseReleased", 400, 300, "left", 0);
  await sleep(300);
  await evalJs(STUB_OPEN);
  check("Full A: the handle's feedbackUrl() is the constant + this artifact's stamp",
    (await evalJs("NOVA_FOX3.feedbackUrl()")) === EXPECTED,
    `got ${await evalJs("NOVA_FOX3.feedbackUrl()")}`);
  await key("Escape", "Escape");
  check("Full A: Esc opens the menu",
    (await evalJs("NOVA_FOX3.menuState().open")) === true);
  await evalJs("document.getElementById('menu-feedback').click()");
  await sleep(200);
  let opened = await evalJs("window.__opened");
  check("Full B: one click opens the door exactly once", opened.length === 1, `count=${opened.length}`);
  checkOpened("Full B", opened[0], stamp);
  check("Full B: the menu note speaks",
    (await evalJs("document.getElementById('menu-note').textContent")).includes("feedback page"));
  // Leg C: keyboard only — close, reopen, walk the focus order.
  await key("Escape", "Escape");
  check("Full C: Esc closes the menu", (await evalJs("NOVA_FOX3.menuState().open")) === false);
  await key("Escape", "Escape");
  for (let i = 0; i < 7; i++) await key("ArrowDown", "ArrowDown");
  check("Full C: seven ArrowDowns land the selection on the feedback row",
    (await evalJs("document.querySelector('#menu .menuitem.sel') && document.querySelector('#menu .menuitem.sel').id")) === "menu-feedback");
  await key("Enter", "Enter");
  await sleep(200);
  opened = await evalJs("window.__opened");
  check("Full C: Enter opens the door a second time", opened.length === 2, `count=${opened.length}`);
  checkOpened("Full C", opened[1], stamp);
  check("Full: zero page exceptions", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));

  // ---------- Lite: the door in the package boot ----------
  consoleErrors = [];
  await send("Page.navigate", { url: LITE_URL });
  check("Lite: the game boots from the package (NOVA_FOX3 handle)", (await waitBoot(120000)) >= 0);
  await sleep(800);
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(200);
  await mouse("mousePressed", 400, 300, "left", 1);
  await mouse("mouseReleased", 400, 300, "left", 0);
  await sleep(300);
  await evalJs(STUB_OPEN);
  check("Lite: the handle's feedbackUrl() carries the package's stamp",
    (await evalJs("NOVA_FOX3.feedbackUrl()")) ===
      `https://fox.phext.io/wiki/feedback?from=game&ee=${liteEe}`,
    `got ${await evalJs("NOVA_FOX3.feedbackUrl()")}`);
  await key("Escape", "Escape");
  check("Lite: Esc opens the menu", (await evalJs("NOVA_FOX3.menuState().open")) === true);
  await evalJs("document.getElementById('menu-feedback').click()");
  await sleep(200);
  opened = await evalJs("window.__opened");
  check("Lite: one click opens the door exactly once", opened.length === 1, `count=${opened.length}`);
  checkOpened("Lite", opened[0], liteEe);
  check("Lite: the package stamp is the build's stamp", liteEe === stamp, `lite=${liteEe} full=${stamp}`);
  check("Lite: zero page exceptions", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + (e && e.message || e));
} finally {
  try { chrome.kill("SIGKILL"); } catch (e) { /* already gone */ }
  server.close();
}
console.log(`\nprobe-w2: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
