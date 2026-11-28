// Nova Fox W-4 — gear tier marker probe (colorblind-safe tiers).
// Real-client spot check, run ONLY via the Jenkins job
// nova-fox-e2e-w4gear (Will, 2026-11-26: e2e via ranch Jenkins).
// Legs:
//   A. Full (index.html): a TEST fixture eco is seeded in
//      localStorage (one owned rung per tier scope — a Band 1
//      rung for white/grey, then green, red, blue), the board
//      opens, and the shop + field guide are audited in the DOM:
//      every tier's marker renders, the five shapes are pairwise
//      distinct, owned rows wear their markers, band titles wear
//      theirs. Fixture state lives only in this probe's throwaway
//      browser profile; nothing touches the shared chart.
//   B. Lite (lite.html): the loader boots the game from the
//      .phext.gz package and the same shop audit runs — the
//      markers must survive the package path too.
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
const PORT = Number(process.env.NF_PORT || 9435);
const HTTP_PORT = Number(process.env.NF_HTTP_PORT || 8494);
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
    "Content-Length": data.length, "Cache-Control": "no-store" });
  res.end(data);
});
await new Promise((r) => server.listen(HTTP_PORT, "127.0.0.1", r));
const FULL_URL = `http://127.0.0.1:${HTTP_PORT}/index.html`;
const LITE_URL = `http://127.0.0.1:${HTTP_PORT}/lite.html`;

// ---------- chrome over CDP (probe-t3 pattern) ----------
const profile = mkdtempSync(join(tmpdir(), "novafoxW4-"));
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
async function waitBoot(timeoutMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await evalJs("!!window.NOVA_FOX3")) return Date.now() - t0; } catch (e) { /* loading */ }
    await sleep(250);
  }
  return -1;
}
async function openBoard() {
  await evalJs(`(() => { const b = document.getElementById('splash-btn');
    if (b && b.offsetParent !== null) b.click(); return true; })()`);
  await sleep(400);
  await evalJs("document.getElementById('purse') && document.getElementById('purse').click()");
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const ready = await evalJs(`(() => { const s = document.getElementById('board-shop');
      return !!s && s.querySelectorAll('.realmrow').length > 10; })()`).catch(() => false);
    if (ready) return true;
    await sleep(300);
  }
  // Fallback: the board key.
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }))");
  await sleep(1200);
  return await evalJs(`(() => { const s = document.getElementById('board-shop');
    return !!s && s.querySelectorAll('.realmrow').length > 10; })()`).catch(() => false);
}
const AUDIT = `(() => {
  const out = {};
  const shop = document.getElementById('board-shop');
  const guide = document.getElementById('board-guide');
  out.shopPresent = !!shop; out.guidePresent = !!guide;
  if (!shop || !guide) return out;
  const marks = (root) => [...root.querySelectorAll('svg.tiermark')];
  const tiersOf = (root) => [...new Set(marks(root).map((s) => s.getAttribute('data-tier')))];
  out.shopTiers = tiersOf(shop); out.guideTiers = tiersOf(guide);
  out.sig = {}; out.box = {};
  for (const t of out.shopTiers) {
    const s = marks(shop).find((x) => x.getAttribute('data-tier') === t);
    const child = s.querySelector('circle,rect,path');
    out.sig[t] = s.getAttribute('data-shape') + ':' + (child ? child.tagName + ':' +
      (child.getAttribute('d') || child.getAttribute('r') || child.getAttribute('x')) : 'none');
    const r = s.getBoundingClientRect();
    out.box[t] = [Math.round(r.width), Math.round(r.height)];
  }
  const rowWith = (root, text) => [...root.querySelectorAll('.realmrow')]
    .find((r) => r.textContent.includes(text));
  const rowTiers = (row) => row ? [...row.querySelectorAll('svg.tiermark')]
    .map((s) => s.getAttribute('data-tier')) : null;
  const rowInfo = (root, text) => { const row = rowWith(root, text);
    return row ? { here: row.classList.contains('here'), tiers: rowTiers(row) } : null; };
  out.pipRow = rowInfo(shop, 'Keepsake Tune Pip');
  out.brushRow = rowInfo(shop, 'Grand Brush, 2');
  out.helmRow = rowInfo(shop, 'Dragonward Helm');
  out.sheathRow = rowInfo(shop, 'Nameless Sheath');
  out.guidePipTiers = rowTiers(rowWith(guide, 'Keepsake Tune Pip'));
  out.guideSheathTiers = rowTiers(rowWith(guide, 'Nameless Sheath'));
  const subs = [...shop.querySelectorAll('.sub')]
    .filter((d) => d.textContent.includes('Band') || d.textContent.includes('Apex'));
  out.bandHeaders = subs.map((d) => [...d.querySelectorAll('svg.tiermark')]
    .map((s) => s.getAttribute('data-tier')).join('+'));
  return out;
})()`;
const FIVE = ["white", "grey", "green", "red", "blue"];
function auditChecks(tag, a) {
  check(`${tag}: the shop and the field guide both rendered`, a && a.shopPresent && a.guidePresent);
  if (!a || !a.shopPresent) return;
  check(`${tag}: all five tiers' markers render in the shop`,
    FIVE.every((t) => a.shopTiers.includes(t)), `saw ${a.shopTiers}`);
  check(`${tag}: all five tiers' markers render in the field guide`,
    FIVE.every((t) => a.guideTiers.includes(t)), `saw ${a.guideTiers}`);
  check(`${tag}: the five rendered shapes are pairwise distinct`,
    new Set(Object.values(a.sig)).size === 5, JSON.stringify(a.sig));
  check(`${tag}: the rendered shapes are the ruled ones (circle/square/triangle/diamond/hexagon)`,
    a.sig.white?.startsWith("circle") && a.sig.grey?.startsWith("square") &&
    a.sig.green?.startsWith("triangle") && a.sig.red?.startsWith("diamond") &&
    a.sig.blue?.startsWith("hexagon"), JSON.stringify(a.sig));
  check(`${tag}: every tier's marker has real size on screen`,
    FIVE.every((t) => a.box[t] && a.box[t][0] >= 8 && a.box[t][1] >= 8), JSON.stringify(a.box));
  check(`${tag}: band titles wear their bands' markers (white+grey, green, red, blue)`,
    a.bandHeaders.length === 4 && a.bandHeaders[0] === "white+grey" &&
    a.bandHeaders[1] === "green" && a.bandHeaders[2] === "red" && a.bandHeaders[3] === "blue",
    JSON.stringify(a.bandHeaders));
  check(`${tag}: the guide's Band 1 row wears white+grey and its Apex row wears blue`,
    JSON.stringify(a.guidePipTiers) === '["white","grey"]' &&
    JSON.stringify(a.guideSheathTiers) === '["blue"]',
    `pip=${JSON.stringify(a.guidePipTiers)} sheath=${JSON.stringify(a.guideSheathTiers)}`);
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

  // ---------- Leg A: Full, with the TEST fixture eco ----------
  await send("Page.navigate", { url: FULL_URL });
  check("A: the Full build boots (NOVA_FOX3 handle)", (await waitBoot()) >= 0);
  await evalJs(`localStorage.setItem('nova-phox-economy', JSON.stringify({
    credits: 100000,
    ladder: {
      'keepsake-tune-pip': { ts: 1, via: 'bought' },
      'grand-brush-2x2x3': { ts: 2, via: 'bought' },
      'dragonward-helm': { ts: 3, via: 'bought' },
      'nameless-sheath': { ts: 4, via: 'bought' },
    } }))`);
  await send("Page.reload", { ignoreCache: true });
  check("A: the fixture boot loads", (await waitBoot()) >= 0);
  check("A: the board opens on the shop and guide", await openBoard());
  const a = await evalJs(AUDIT);
  auditChecks("A", a);
  check("A: the fixture's Band 1 rung stands owned, wearing white+grey",
    a.pipRow && a.pipRow.here && JSON.stringify(a.pipRow.tiers) === '["white","grey"]',
    JSON.stringify(a.pipRow));
  check("A: the fixture's green rung stands owned, wearing green",
    a.brushRow && a.brushRow.here && JSON.stringify(a.brushRow.tiers) === '["green"]',
    JSON.stringify(a.brushRow));
  check("A: the fixture's red rung stands owned, wearing red",
    a.helmRow && a.helmRow.here && JSON.stringify(a.helmRow.tiers) === '["red"]',
    JSON.stringify(a.helmRow));
  check("A: the fixture's blue rung stands owned, wearing blue",
    a.sheathRow && a.sheathRow.here && JSON.stringify(a.sheathRow.tiers) === '["blue"]',
    JSON.stringify(a.sheathRow));
  check("A: zero page exceptions", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));

  // ---------- Leg B: Lite, booted from the package ----------
  consoleErrors.length = 0;
  await send("Page.navigate", { url: LITE_URL });
  check("B: the Lite build boots from the .phext.gz package", (await waitBoot()) >= 0);
  check("B: the board opens on the shop and guide", await openBoard());
  const b = await evalJs(AUDIT);
  auditChecks("B", b);
  check("B: zero page exceptions", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  fail++;
  console.log("FAIL  probe aborted: " + (e && e.message || e));
} finally {
  try { chrome.kill("SIGKILL"); } catch (e) { /* already gone */ }
  server.close();
}
console.log(`\nprobe-w4: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
