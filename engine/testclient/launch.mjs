// Launch a real Nova Fox session for the test client:
//   1. start the server on an OS-assigned port;
//   2. write a TEMP COPY of the tree's index.html with the bridge
//      inlined (the tree on disk is never modified) into a scratch
//      dir, and open that copy in headless Chrome via file:// —
//      the same load path the old CDP harness proved, chosen because
//      this sandbox's Chromium refuses to navigate to loopback HTTP
//      (ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS), while a file://
//      page can still call the server's REST bridge channel (the
//      server sends CORS headers for exactly this). On an ordinary
//      machine the served /game/ page works too; the checks do not
//      care which carried the page.
//   3. wait until the bridge has connected and a snapshot is fresh.
//
// No remote-debugging port is opened at all: driving happens over
// the API, so the shared-CDP-port collision class that broke the old
// harness (every suite on port 9335, cross-navigating each other's
// pages) cannot occur.
//
//   import { launchGame } from "./launch.mjs";
//   const g = await launchGame({ tree: "../demo7" });
//   ... g.client ...
//   await g.close();
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { NfClient } from "./client.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = "/opt/meta-chromium/chrome";
const POLICY = "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchGame({ tree, serverArgs = [] } = {}) {
  const treeDir = resolve(tree || join(HERE, "..", "integration"));
  const server = spawn("node", [join(HERE, "server.mjs"), "--tree", treeDir, "--port", "0", ...serverArgs],
    { stdio: ["ignore", "pipe", "pipe"] });
  let serverErr = "";
  server.stderr.on("data", (d) => { serverErr += d; });
  const ready = await new Promise((resolveP, rejectP) => {
    let buf = "";
    server.stdout.on("data", (d) => {
      buf += d;
      const line = buf.split("\n").find((l) => l.includes('"ready"'));
      if (line) { try { resolveP(JSON.parse(line)); } catch (e) { rejectP(e); } }
    });
    server.on("exit", (code) => rejectP(new Error("server exited " + code + ": " + serverErr)));
    setTimeout(() => rejectP(new Error("server start timeout: " + serverErr)), 15000);
  });
  const base = ready.url;
  const client = new NfClient(base);

  // The temp copy: the tree's own page + __NF_SERVER__ + bridge inlined.
  const scratch = mkdtempSync(join(tmpdir(), "novafox-tc-page-"));
  const raw = readFileSync(join(treeDir, "index.html"), "utf8");
  const bridge = readFileSync(join(HERE, "bridge.js"), "utf8");
  const injected = `<script>window.__NF_SERVER__=${JSON.stringify(base)};</script><script>\n${bridge}\n</script>`;
  const page = raw.includes("</body>") ? raw.replace("</body>", injected + "</body>") : raw + injected;
  const pageFile = join(scratch, "index.html");
  writeFileSync(pageFile, page);

  const profile = mkdtempSync(join(tmpdir(), "novafox-tc-profile-"));
  const policySha = createHash("sha256").update(readFileSync(POLICY)).digest("hex");
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
    "--autoplay-policy=no-user-gesture-required",
    `--hatch-webgl-allowed-domains-file=${POLICY}`,
    `--hatch-webgl-allowed-domains-sha256=${policySha}`,
    `--user-data-dir=${profile}`,
    "file://" + pageFile,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let chromeErr = "";
  chrome.stderr.on("data", (d) => { chromeErr += d; });

  try {
    await client.waitFor(async () => {
      try {
        const s = await client.state();
        if (!s || s.snapshotAgeMs === null || s.snapshotAgeMs >= 2000) return null;
        const sess = await client.sessions();
        const mine = sess.find((x) => x.id === s.sessionId);
        return mine && mine.streamConnected ? s : null;
      } catch (e) { return null; }
    }, 120000, 300, "game session + first snapshot + command stream");
  } catch (e) {
    chrome.kill("SIGKILL");
    server.kill("SIGKILL");
    throw new Error("launch failed: " + e.message + "\nchrome stderr tail: " + chromeErr.slice(-500));
  }

  return {
    client, base, tree: treeDir, server, chrome, profile, pageFile,
    async close() {
      try { chrome.kill("SIGKILL"); } catch (e) { /* already gone */ }
      try { server.kill("SIGKILL"); } catch (e) { /* already gone */ }
      await sleep(200);
    },
  };
}
