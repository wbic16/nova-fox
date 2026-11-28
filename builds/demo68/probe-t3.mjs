// Nova Fox T-3 — Lite loader probe. Runs against lite.html SERVED
// over http (the hosted truth), via the Jenkins nova-fox-e2e-t3lite
// job only (Will, 2026-11-26: e2e via ranch Jenkins, never direct).
// Legs:
//   A. The loader fetches the .phext.gz with a bar that advances on
//      real fetched bytes (network throttled so the fetch is
//      observable), opens it with DecompressionStream, parses the
//      phext by scroll, and the game boots playable.
//   B. A fresh boot with the browser cache disabled fetches the
//      package again, byte-identical, and boots again.
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
const PORT = Number(process.env.NF_PORT || 9433);
const HTTP_PORT = Number(process.env.NF_HTTP_PORT || 8491);
const TREE = process.env.NF_TREE || dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- static server with a request log ----------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".gz": "application/gzip", ".phext": "text/plain",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".png": "image/png", ".wasm": "application/wasm" };
const requests = [];
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(TREE, path);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  const data = readFileSync(file);
  requests.push({ path, bytes: data.length });
  res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream",
    "Content-Length": data.length, "Cache-Control": "public, max-age=31536000, immutable" });
  res.end(data);
});
await new Promise((r) => server.listen(HTTP_PORT, "127.0.0.1", r));
const LITE_URL = `http://127.0.0.1:${HTTP_PORT}/lite.html`;

// ---------- byte ledger (from disk, the ground truth) ----------
const liteHtml = readFileSync(join(TREE, "lite.html"), "utf8");
const ee = (liteHtml.match(/"ee":\s*"?(\d+)"?/) || [])[1];
const gzPath = join(TREE, "assets", ee, "nova-fox.phext.gz");
const phextPath = join(TREE, "assets", ee, "nova-fox.phext");
const gzBytes = statSync(gzPath).size, phextBytes = statSync(phextPath).size;
console.log(`  .. byte ledger: loader ${Buffer.byteLength(liteHtml)} B, ` +
  `package ${gzBytes} B, phext ${phextBytes} B, ratio ${(gzBytes / phextBytes).toFixed(3)}`);

// ---------- chrome over CDP (lite_e2e pattern) ----------
const profile = mkdtempSync(join(tmpdir(), "novafoxT3-"));
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
const gzRequests = () => requests.filter((r) => r.path.endsWith("nova-fox.phext.gz"));

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
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  // ---------- Leg A: throttled fetch, bar on real bytes ----------
  await send("Network.emulateNetworkConditions",
    { offline: false, latency: 40, downloadThroughput: 220 * 1024, uploadThroughput: 220 * 1024 });
  await send("Page.navigate", { url: LITE_URL });
  const samples = [];
  const bootMsP = waitBoot(120000);
  let booted = false;
  bootMsP.then(() => { booted = true; });
  const t0 = Date.now();
  while (!booted && Date.now() - t0 < 120000) {
    try {
      const s = await evalJs(`(() => {
        const L = window.__NF_LOADER;
        const fill = document.getElementById('nf-load-fill');
        return L ? { phase: L.phase, fetched: L.fetched, opened: L.opened,
                     width: fill ? parseFloat(fill.style.width || '0') : -1 } : null;
      })()`);
      if (s) samples.push(s);
    } catch (e) { /* document being replaced */ }
    await sleep(120);
  }
  const bootMs = await bootMsP;
  check("A: the game boots from the package (NOVA_FOX3 handle)", bootMs >= 0);
  console.log(`  .. throttled boot: ${bootMs} ms, ${samples.length} loader samples`);
  const mid = samples.filter((s) => s.fetched > 0 && s.fetched < gzBytes);
  check("A: the bar advanced on real fetched bytes mid-fetch",
    mid.length >= 2 && mid.some((s) => s.width > 0 && s.width < 100),
    `mid samples=${mid.length}`);
  check("A: fetch progress was monotonic",
    samples.every((s, i) => i === 0 || s.fetched >= samples[i - 1].fetched));
  const lastFetch = [...samples].reverse().find((s) => s.phase === "fetch" || s.phase === "open");
  check("A: the loader counted the whole package",
    samples.some((s) => s.fetched === gzBytes), `saw max ${Math.max(0, ...samples.map((s) => s.fetched))} of ${gzBytes}`);
  check("A: decompression produced the whole phext",
    samples.some((s) => s.opened === phextBytes), `saw max ${Math.max(0, ...samples.map((s) => s.opened))} of ${phextBytes}`);
  check("A: the server served the package exactly once for the boot",
    gzRequests().length === 1 && gzRequests()[0].bytes === gzBytes,
    `requests=${gzRequests().length}`);
  await sleep(500);
  check("A: spawn realm is Nova Prime", await evalJs("NOVA_FOX3.state.realm") === "nova");
  check("A: zero page exceptions", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));

  // ---------- Leg B: cache disabled, fresh fetch, identical boot ----------
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  const before = gzRequests().length;
  await send("Page.navigate", { url: LITE_URL });
  const boot2 = await waitBoot(120000);
  check("B: cache-disabled boot succeeds", boot2 >= 0);
  check("B: the package was fetched again (no cache)",
    gzRequests().length === before + 1, `requests=${gzRequests().length} before=${before}`);
  check("B: the refetched package is byte-identical in size",
    gzRequests()[gzRequests().length - 1].bytes === gzBytes);
  await sleep(400);
  check("B: spawn realm is Nova Prime again", await evalJs("NOVA_FOX3.state.realm") === "nova");
  check("B: zero page exceptions", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + (e && e.message || e));
} finally {
  try { chrome.kill("SIGKILL"); } catch (e) { /* already gone */ }
  server.close();
}
console.log(`\nprobe-t3: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
