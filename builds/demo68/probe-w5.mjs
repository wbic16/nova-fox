// Nova Fox W-5 — ship log probe. Runs against the tree SERVED over
// http (the hosted truth), via the Jenkins nova-fox-e2e-w5shiplog
// job only (Will, 2026-11-26: e2e via ranch Jenkins, never direct).
// Legs:
//   A. The Full build boots; on the start screen the "Recent
//      builds" panel reads back the seeded ships, newest first,
//      the top row lettered with the build's own stamp — the same
//      epoch the title's version row shows. Starting dismisses it.
//   B. The Lite build boots from its .phext.gz package; the same
//      panel reads back identically from the packaged scrolls.
// Env: NF_CHROME, NF_PORT (private CDP port), NF_HTTP_PORT,
//      NF_TREE (tree dir to serve; default: this file's dir).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9436);
const HTTP_PORT = Number(process.env.NF_HTTP_PORT || 8495);
const TREE = process.env.NF_TREE || dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ---------- chrome over CDP (lite_e2e pattern) ----------
const profile = mkdtempSync(join(tmpdir(), "novafoxW5-"));
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
const consoleErrors = [];
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
const readPanel = () => evalJs(`(() => {
  const rows = [...document.querySelectorAll('#shiplog-rows .shiplog-row')]
    .map((d) => d.textContent);
  const box = document.getElementById('shiplog');
  const r = box ? box.getBoundingClientRect() : { width: 0, top: -1, bottom: 0 };
  return { rows,
    ver: (document.getElementById('ver-line1') || {}).textContent || "",
    head: (document.querySelector('.shiplog-head') || {}).textContent || "",
    splashShown: getComputedStyle(document.getElementById('splash')).display !== 'none',
    inView: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight + 40 };
})()`);
function checkPanel(tag, p, stamp) {
  const names = p.rows.map((r) => r.split(" · ")[1]);
  const ees = p.rows.map((r) => Number((r.match(/^EE (\d+)/) || [])[1] || -1));
  check(`${tag}: the panel headlines the eight seeded ships`,
    p.rows.length === 8, `rows=${p.rows.length}`);
  check(`${tag}: newest first — build 42 at the head, demo29 at the foot`,
    names.join(",") === "build 42,demo41,demo35,demo34,demo32,demo31,demo30,demo29",
    names.join(","));
  check(`${tag}: the top row carries the build's own stamp, as the version row does`,
    p.ver === `Nova Fox — EE ${stamp}` && p.rows[0].startsWith(`EE ${stamp} · build 42 · `),
    `ver=${JSON.stringify(p.ver)} top=${JSON.stringify(p.rows[0] || "")}`);
  check(`${tag}: epochs descend the panel`,
    ees.slice(1).every((e, i) => e <= ees[i]) && ees[7] === 1023,
    ees.join(","));
  check(`${tag}: the panel stands on the start screen, headed and in view`,
    p.head === "Recent builds" && p.splashShown && p.inView);
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

  // The stamp this tree carries (the game3.js token, as stamped).
  const stamp = (readFileSync(join(TREE, "game3.js"), "utf8")
    .match(/NF_SHIP_EE:(\d+)/) || [])[1];

  // ---------- Leg A: the Full build's start screen ----------
  await send("Page.navigate", { url: FULL_URL });
  check("A: the game boots (NOVA_FOX3 handle)", await waitBoot() >= 0);
  await sleep(400);
  const panelA = await readPanel();
  checkPanel("A", panelA, stamp);
  check("A: zero page exceptions", consoleErrors.length === 0,
    consoleErrors.slice(0, 2).join(" | "));
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(600);
  check("A: starting dismisses the panel with the splash",
    await evalJs("getComputedStyle(document.getElementById('splash')).display") === "none");

  // ---------- Leg B: the Lite build, booted from the package ----------
  await send("Page.navigate", { url: LITE_URL });
  check("B: the game boots from the package (NOVA_FOX3 handle)", await waitBoot(120000) >= 0);
  await sleep(400);
  const panelB = await readPanel();
  checkPanel("B", panelB, stamp);
  check("B: the Lite panel reads back exactly the Full panel",
    JSON.stringify(panelB.rows) === JSON.stringify(panelA.rows));
  check("B: zero page exceptions", consoleErrors.length === 0,
    consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + (e && e.message || e));
} finally {
  try { chrome.kill("SIGKILL"); } catch (e) { /* gone */ }
  server.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
