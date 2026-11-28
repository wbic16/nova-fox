// Nova Fox MP-1 — THE GATE: a two-client probe, plus the household
// legs. Two real browser clients (plus raw foxes) meet in one realm
// room served by the hub gateway instance, and every assertion is
// read from a CLIENT's own state (NOVA_FOX3.mpState) — never the
// server log. Single-client evidence does not count.
//
// Legs:
//   0. A and B boot signed-in (TEST identities) and connect; each
//      one's roster holds the other (the echo, both ways).
//   1. Together at spawn: A's count is 1, its bonus +10%, and the
//      HUD chip says so.
//   2. A walks; B's rendered world shows A's fox at the moved
//      position (B's interpolated sample vs A's own truth).
//   3. B walks out of the radius: A's count falls to 0.
//   4. B walks back: the count returns to 1.
//   5. B is hurt (its own hurtPlayer, away from Arrival's ward).
//   6. A pulses: B's OWN health rises one heart-step (+2), the
//      floater names A, A gains nothing.
//   7. A third fox C pulses from beside B: B heals again — two
//      sources, two heals.
//   8. C pulses again at once: B unchanged (receiver-side
//      cooldown, judged by B).
//   9. A pulses again inside its window: refused on the sending
//      side (mpPulse returns false).
//  10. HOUSEHOLD (EE ~1157): D arrives from A's own egress
//      (stand-in 1) but stands in ANOTHER realm — A lists D in its
//      household; B walks out of the radius and A's together stays
//      1 on D alone; D pulses across the realm and A heals, the
//      floater naming D; E arrives from a DIFFERENT egress
//      (stand-in 2), pulses from that same far realm, and A does
//      not heal and does not list E; D parts and the household
//      stands empty, together 0.
//  11. A leaves (page closed): B sees the part; C leaves too and
//      B's room stands empty, together 0.
//  12. Lite, signed out: boots, carries the menu row, and never
//      attempts a connection.
//
// The stand-ins: local https servers on 127.0.0.21 / 127.0.0.22
// (two households). fox.phext.io serves the tree; phext.tech
// proxies (HTTP and the websocket upgrade) to the hub gateway
// instance, the splice BOUND to the stand-in's own address — so
// the gateway sees each household's egress exactly as it would
// see a NAT address in production. Chrome resolves both names via
// --host-resolver-rules. Binding :443 takes privilege the browser
// must not have, so the stand-ins run as their own process:
//   NF_STANDIN_ONLY=1 (sudo) — serve and stay; the probe itself
//   runs unprivileged with NF_STANDIN_EXTERNAL=1.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { createServer as createHttps } from "node:https";
import { request as httpRequest } from "node:http";
import { connect as netConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";

const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const BASE_PORT = Number(process.env.NF_PORT || 9438);
const TREE = process.env.NF_TREE || dirname(fileURLToPath(import.meta.url));
const TOKENS = JSON.parse(readFileSync(
  process.env.NF_TOKENS || "/home/wbic16/mp1-gw/test-tokens.json", "utf8"));
const GW_PORT = Number(process.env.NF_GW_PORT || 18962);
const HOUSE1 = "127.0.0.21", HOUSE2 = "127.0.0.22";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms, step = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await fn();
    if (v) return v;
    await sleep(step);
  }
  return null;
}

// ---------- the stand-ins ----------
function makeStandin(ip) {
  const certDir = mkdtempSync(join(tmpdir(), "mp1-cert-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", join(certDir, "key.pem"), "-out", join(certDir, "cert.pem"),
    "-days", "2", "-subj", "/CN=fox.phext.io",
    "-addext", "subjectAltName=DNS:fox.phext.io,DNS:phext.tech"],
    { stdio: "ignore" });
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
    ".json": "application/json", ".gz": "application/gzip", ".png": "image/png",
    ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".wasm": "application/wasm" };
  const srv = createHttps(
    { key: readFileSync(join(certDir, "key.pem")),
      cert: readFileSync(join(certDir, "cert.pem")) },
    (req, res) => {
      try { route(req, res); }
      catch (e) { try { res.writeHead(500); res.end(); } catch (e2) { /* gone */ } }
    });
  function route(req, res) {
      const host = (req.headers.host || "").split(":")[0];
      if (host === "phext.tech") {
        const up = httpRequest(
          { host: "127.0.0.1", port: GW_PORT, path: req.url, method: req.method,
            headers: { ...req.headers, host: `127.0.0.1:${GW_PORT}` },
            localAddress: ip },
          (ur) => { res.writeHead(ur.statusCode, ur.headers); ur.pipe(res); });
        up.on("error", () => { res.writeHead(502); res.end(); });
        req.pipe(up);
        return;
      }
      let path = normalize(decodeURIComponent(
        new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
      if (path === "/" || path === "\\") path = "/index.html";
      const file = join(TREE, path);
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404); res.end(); return;
      }
      const data = readFileSync(file);
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream",
        "Content-Length": data.length });
      res.end(data);
  }
  srv.on("upgrade", (req, socket, head) => {
    const host = (req.headers.host || "").split(":")[0];
    if (host !== "phext.tech") { socket.destroy(); return; }
    const back = netConnect({ host: "127.0.0.1", port: GW_PORT, localAddress: ip }, () => {
      back.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        back.write(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`);
      }
      back.write("\r\n");
      if (head && head.length) back.write(head);
      back.pipe(socket);
      socket.pipe(back);
    });
    back.on("error", () => socket.destroy());
    socket.on("error", () => back.destroy());
  });
  return srv;
}

if (process.env.NF_STANDIN_ONLY) {
  const { writeFileSync } = await import("node:fs");
  try { writeFileSync("/tmp/mp1-standin.pid", String(process.pid)); } catch (e) {}
  const s1 = makeStandin(HOUSE1), s2 = makeStandin(HOUSE2);
  await new Promise((r) => s1.listen(443, HOUSE1, r));
  await new Promise((r) => s2.listen(443, HOUSE2, r));
  console.log(`stand-ins up: ${HOUSE1} + ${HOUSE2} (gateway :${GW_PORT})`);
  setInterval(() => {}, 60000);
} else {
  main().catch((e) => { console.error("PROBE ERROR:", e); process.exit(2); });
}

async function main() {
  if (!process.env.NF_STANDIN_EXTERNAL) {
    const s1 = makeStandin(HOUSE1), s2 = makeStandin(HOUSE2);
    await new Promise((r) => s1.listen(443, HOUSE1, r));
    await new Promise((r) => s2.listen(443, HOUSE2, r));
    console.log(`  .. stand-ins on ${HOUSE1}/${HOUSE2}:443 -> gateway :${GW_PORT}`);
    process.on("exit", () => { s1.close(); s2.close(); });
  } else {
    console.log(`  .. stand-ins external (${HOUSE1}/${HOUSE2}) -> gateway :${GW_PORT}`);
  }

  let pass = 0, fail = 0;
  function check(name, cond, extra = "") {
    if (cond) { pass++; console.log(`  ok  ${name}`); }
    else { fail++; console.log(`FAIL  ${name} ${extra}`); }
  }

  // ---------- a fox client (the cdp_test3 idiom, per-client) ----------
  class Fox {
    constructor(port, token, name, house) {
      this.port = port; this.token = token; this.name = name;
      this.house = house; this.msgId = 0; this.pending = new Map(); this.errors = [];
    }
    async boot(url) {
      // Headless WebGL init on this hub is flaky under load (the
      // GPU process intermittently fails to bind); the established
      // probes survive it by relaunching fresh. Three attempts,
      // a new profile each time.
      let lastErr = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try { await this._bootOnce(url); return; }
        catch (e) {
          lastErr = e;
          try { this.chrome.kill("SIGKILL"); } catch (e2) { /* gone */ }
          await sleep(1500);
        }
      }
      throw lastErr;
    }
    async _bootOnce(url) {
      // Never attach to a stranger's chrome: if the CDP port
      // already answers, it belongs to an orphan or another
      // producer — fail loud instead of polling a dead page.
      try {
        const r = await fetch(`http://127.0.0.1:${this.port}/json/list`);
        if (r.ok) throw new Error(`fox ${this.name}: CDP port ${this.port} is already held by another chrome`);
      } catch (e) {
        if (e.message.includes("already held")) throw e;
        /* connection refused is the expected, healthy answer */
      }
      const profile = mkdtempSync(join(tmpdir(), "mp1-fox-"));
      const args = [
        "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
        "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
        "--autoplay-policy=no-user-gesture-required",
        "--ignore-certificate-errors",
        `--host-resolver-rules=MAP fox.phext.io ${this.house}, MAP phext.tech ${this.house}`,
      ];
      const POLICY = process.env.NF_POLICY ||
        "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
      if (existsSync(POLICY)) {
        args.push(`--hatch-webgl-allowed-domains-file=${POLICY}`,
          `--hatch-webgl-allowed-domains-sha256=${createHash("sha256").update(readFileSync(POLICY)).digest("hex")}`);
      }
      args.push(`--remote-debugging-port=${this.port}`,
        `--user-data-dir=${profile}`, "about:blank");
      this.chrome = spawn(CHROME, args, { stdio: ["ignore", "ignore", "pipe"] });
      this.chrome.stderr.on("data", () => {});
      let wsUrl = null;
      for (let i = 0; i < 50 && !wsUrl; i++) {
        try {
          const list = await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json();
          const page = list.find((t) => t.type === "page");
          if (page) wsUrl = page.webSocketDebuggerUrl;
        } catch (e) { /* not up yet */ }
        if (!wsUrl) await sleep(200);
      }
      if (!wsUrl) throw new Error(`fox ${this.name}: devtools never came up`);
      this.ws = new WebSocket(wsUrl);
      await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
      this.ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.id && this.pending.has(m.id)) {
          const p = this.pending.get(m.id);
          this.pending.delete(m.id);
          p(m.result);
        }
        if (m.method === "Runtime.exceptionThrown") {
          this.errors.push(m.params?.exceptionDetails?.exception?.description ||
            m.params?.exceptionDetails?.text || "exception");
        }
      };
      await this.send("Runtime.enable");
      await this.send("Page.enable");
      if (this.token) {
        await this.send("Page.addScriptToEvaluateOnNewDocument", {
          source: `localStorage.setItem("nova-phox-token", ${JSON.stringify(JSON.stringify(this.token))});
                   localStorage.setItem("nova-phox-name", ${JSON.stringify(JSON.stringify(this.name))});
                   localStorage.setItem("nf.scheme", "wasd");`,
        });
      }
      await this.send("Page.navigate", { url });
      const booted = await until(async () =>
        (await this.eval("typeof window.NOVA_FOX3 === 'object' && !!window.NOVA_FOX3")) || null,
        90000, 500);
      if (!booted) throw new Error(`fox ${this.name}: the game never booted` +
        (this.errors.length ? ` (page: ${this.errors[this.errors.length - 1].slice(0, 160)})` : ""));
      await this.send("Input.dispatchMouseEvent",
        { type: "mousePressed", x: 480, y: 320, button: "left", clickCount: 1 });
      await this.send("Input.dispatchMouseEvent",
        { type: "mouseReleased", x: 480, y: 320, button: "left", clickCount: 1 });
      await sleep(600);
    }
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++this.msgId;
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }, 30000);
        this.pending.set(id, (v) => { clearTimeout(timer); resolve(v); });
        this.ws.send(JSON.stringify({ id, method, params }));
      });
    }
    async eval(expression) {
      const r = await this.send("Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise: true });
      if (!r || !r.result) throw new Error("no result for: " + expression.slice(0, 60));
      if (r.exceptionDetails) {
        throw new Error("page exception: " +
          (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      }
      return r.result.value;
    }
    async key(code, down) {
      await this.send("Input.dispatchKeyEvent", {
        type: down ? "keyDown" : "keyUp",
        key: code === "Space" ? " " : code.replace(/^Key/, "").toLowerCase(),
        code, text: code.length === 1 ? code : "",
      });
    }
    async hold(code, ms) {
      await this.key(code, true);
      await sleep(ms);
      await this.key(code, false);
    }
    mp() { return this.eval("NOVA_FOX3.mpState()"); }
    async kill() {
      try { this.chrome.kill("SIGKILL"); } catch (e) { /* gone */ }
      await sleep(300);
    }
  }

  // ---------- a raw fox through a household stand-in ----------
  // A minimal websocket client over TLS to the stand-in: the
  // splice carries it, so the gateway sees the stand-in's egress —
  // the household it presents. Used for D (A's household) and E
  // (a different household).
  class RawFox {
    constructor() { this.msgs = []; this.buf = Buffer.alloc(0); this.frag = []; }
    async connect(ip, token, realm) {
      this.sock = tlsConnect({ host: ip, port: 443, servername: "phext.tech",
        rejectUnauthorized: false });
      await new Promise((res, rej) => { this.sock.once("secureConnect", res); this.sock.once("error", rej); });
      const key = randomBytes(16).toString("base64");
      this.sock.write(
        "GET /api/v2/mp HTTP/1.1\r\nHost: phext.tech\r\nUpgrade: websocket\r\n" +
        "Connection: Upgrade\r\nSec-WebSocket-Version: 13\r\n" +
        `Sec-WebSocket-Key: ${key}\r\nOrigin: https://fox.phext.io\r\n\r\n`);
      let head = Buffer.alloc(0);
      const status = await new Promise((res, rej) => {
        const onData = (d) => {
          head = Buffer.concat([head, d]);
          const i = head.indexOf("\r\n\r\n");
          if (i >= 0) {
            this.sock.off("data", onData);
            const rest = head.subarray(i + 4);
            if (rest.length) this._feed(rest);
            res(head.subarray(0, i).toString("latin1").split(" ")[1]);
          }
        };
        this.sock.on("data", onData);
        this.sock.once("error", rej);
      });
      if (status !== "101") throw new Error(`raw fox: upgrade refused (${status})`);
      this.sock.on("data", (d) => this._feed(d));
      this.send({ t: "hello", token, realm });
      const w = await until(() => this.msgs.find((m) => m.t === "welcome") || null, 8000);
      if (!w) throw new Error("raw fox: no welcome");
      this.id = w.id;
      return w;
    }
    _feed(d) {
      this.buf = Buffer.concat([this.buf, d]);
      for (;;) {
        if (this.buf.length < 2) return;
        const fin = this.buf[0] & 0x80, op = this.buf[0] & 0x0f;
        let len = this.buf[1] & 0x7f, off = 2;
        if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
        if (this.buf.length < off + len) return;
        const payload = this.buf.subarray(off, off + len);
        this.buf = this.buf.subarray(off + len);
        if (op === 1 || op === 0) {
          this.frag.push(payload);
          if (fin) {
            try { this.msgs.push(JSON.parse(Buffer.concat(this.frag).toString("utf8"))); } catch (e) {}
            this.frag = [];
          }
        }
      }
    }
    send(obj) {
      const data = Buffer.from(JSON.stringify(obj), "utf8");
      const mask = randomBytes(4);
      let head;
      if (data.length < 126) head = Buffer.from([0x81, 0x80 | data.length]);
      else { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 0x80 | 126; head.writeUInt16BE(data.length, 2); }
      const masked = Buffer.from(data.map((c, i) => c ^ mask[i % 4]));
      this.sock.write(Buffer.concat([head, mask, masked]));
    }
    close() { try { this.sock.end(); } catch (e) {} try { this.sock.destroy(); } catch (e) {} }
  }

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

  // Hurt a fox for real: Arrival's ward (feedback #4) turns every
  // blow until the fox's first jump has landed, and within 14
  // cells of Arrival besides. So: jump, land, walk out of the
  // ward's ground, then take the hurt.
  async function hurtFox(fox, amount) {
    const home = (await fox.mp()).self.p;
    await fox.key("Space", true);
    await sleep(150);
    await fox.key("Space", false);
    await sleep(1300);
    await fox.key("KeyW", true);
    const out = await until(async () => {
      const p = (await fox.mp()).self.p;
      return dist(p, home) > 15.5 ? p : null;
    }, 30000, 400);
    await fox.key("KeyW", false);
    if (!out) return null;
    for (let i = 0; i < 3; i++) {
      const before = (await fox.mp()).hp;
      const after = await fox.eval(`NOVA_FOX3.mpHurt(${amount})`);
      if (after < before) return after;
      await sleep(1600);
    }
    return null;
  }

  // ---------- the legs ----------
  const A = new Fox(BASE_PORT, TOKENS.a, "TESTFOX-A-MP1", HOUSE1);
  const B = new Fox(BASE_PORT + 1, TOKENS.b, "TESTFOX-B-MP1", HOUSE2);
  await A.boot("https://fox.phext.io/");
  await B.boot("https://fox.phext.io/");

  const aConn = await until(async () => (await A.mp()).connected || null, 30000);
  const bConn = await until(async () => (await B.mp()).connected || null, 30000);
  check("0: both foxes connect to the room", !!aConn && !!bConn);
  const aId = (await A.mp()).id, bId = (await B.mp()).id;
  const aSees = await until(async () => {
    const m = await A.mp();
    return m.remotes.some((r) => r.id === bId) ? m : null;
  }, 15000);
  const bSees = await until(async () => {
    const m = await B.mp();
    return m.remotes.some((r) => r.id === aId) ? m : null;
  }, 15000);
  check("0: the echo answers both ways — each roster holds the other",
    !!aSees && !!bSees, `A:${JSON.stringify((await A.mp()).remotes)} B:${JSON.stringify((await B.mp()).remotes)}`);

  const spawnPos = (await A.mp()).self.p;
  const tg0 = (await A.mp()).together;
  check("1: together at spawn — count 1, bonus +10%",
    tg0.count === 1 && Math.abs(tg0.bonus - 0.1) < 1e-9, JSON.stringify(tg0));
  const hud = await A.eval(`({d: document.getElementById("together").style.display,
    t: document.getElementById("together").textContent})`);
  check("1: the HUD chip reads the togetherness",
    hud.d === "block" && hud.t.includes("×1") && hud.t.includes("+10%"), JSON.stringify(hud));

  await A.hold("KeyW", 2600);
  const moved = await until(async () => {
    const bm = await B.mp();
    const ra = bm.remotes.find((r) => r.id === aId);
    const am = await A.mp();
    if (!ra || !ra.p) return null;
    const fromSpawn = dist(ra.p, spawnPos);
    const truth = dist(ra.p, am.self.p);
    return fromSpawn >= 3.5 && truth <= 3 ? { fromSpawn, truth } : null;
  }, 20000);
  check("2: B's world shows A's fox at the moved position (B's own state)",
    !!moved, moved ? `fromSpawn=${moved.fromSpawn.toFixed(1)} vsTruth=${moved.truth.toFixed(1)}` : "no movement read");

  await B.key("KeyS", true);
  const out = await until(async () => (await A.mp()).together.count === 0 || null, 45000, 500);
  await B.key("KeyS", false);
  check("3: B leaves the radius — A's together falls to 0", !!out);
  const hudOff = await A.eval(`document.getElementById("together").style.display`);
  check("3: the HUD chip stands down at zero", hudOff === "none", hudOff);

  await B.key("KeyW", true);
  const back = await until(async () => (await A.mp()).together.count === 1 || null, 45000, 500);
  await B.key("KeyW", false);
  check("4: B returns — A's together is 1 again", !!back);

  const hpHurt = await hurtFox(B, 6);
  check("5: B stands hurt (jumped the ward off, walked out, hurt)",
    hpHurt !== null && hpHurt <= 14, `hp=${hpHurt}`);

  const aPulse = await A.eval("NOVA_FOX3.mpPulse()");
  check("6: A's pulse fires", aPulse === true);
  const healed = await until(async () => {
    const m = await B.mp();
    return m.hp === hpHurt + 2 ? m : null;
  }, 5000);
  check("6: B's own health rises one heart-step (+2)", !!healed,
    `hp=${(await B.mp()).hp} want=${hpHurt + 2}`);
  const floater = await B.eval(`document.getElementById("dmgnum").textContent`);
  check("6: the floater names the healer", floater.includes("TESTFOX-A-MP1"), floater);
  const aHp = (await A.mp()).hp;
  check("6: the pulsing fox gains nothing itself", aHp === 20, `A hp=${aHp}`);
  const bHeal = (await B.mp()).lastHeal;
  check("6: B's record names A as the healer",
    !!bHeal && bHeal.from === "TESTFOX-A-MP1" && bHeal.amount === 2, JSON.stringify(bHeal));

  const bPos = (await B.mp()).self.p;
  const C = new WebSocket("ws://127.0.0.1:" + GW_PORT + "/api/v2/mp");
  const cGot = [];
  C.onmessage = (e) => cGot.push(JSON.parse(e.data));
  await new Promise((res, rej) => { C.onopen = res; C.onerror = rej; });
  C.send(JSON.stringify({ t: "hello", token: TOKENS.c, realm: "nova" }));
  await until(() => cGot.some((m) => m.t === "welcome") || null, 5000);
  C.send(JSON.stringify({ t: "s", seq: 1, p: bPos, h: 0, a: "" }));
  await sleep(200);
  C.send(JSON.stringify({ t: "pulse", p: bPos }));
  const healed2 = await until(async () => (await B.mp()).hp === hpHurt + 4 || null, 5000);
  check("7: a second source heals B again (two sources, two heals)", !!healed2,
    `hp=${(await B.mp()).hp} want=${hpHurt + 4}`);
  C.send(JSON.stringify({ t: "pulse", p: bPos }));
  await sleep(900);
  const hpAfterSpam = (await B.mp()).hp;
  check("8: C's instant second pulse is ignored — B judges the cooldown",
    hpAfterSpam === hpHurt + 4, `hp=${hpAfterSpam}`);
  const aPulse2 = await A.eval("NOVA_FOX3.mpPulse()");
  check("9: A's own pulse inside its cooldown is refused on the sending side",
    aPulse2 === false, `returned ${aPulse2}`);

  // ---------- the household legs ----------
  const D = new RawFox();
  await D.connect(HOUSE1, TOKENS.d, "ashfall");
  const aHouse = await until(async () => {
    const m = await A.mp();
    return m.house.some((h) => h.id === D.id) ? m : null;
  }, 15000);
  check("10: A lists D in its household, though D stands in another realm",
    !!aHouse && aHouse.house.find((h) => h.id === D.id).realm === "ashfall",
    JSON.stringify((await A.mp()).house));
  // D must stay present in A's household: its state rides at ~10 Hz
  // in a real client; the raw fox sends a few by hand.
  const dBeat = setInterval(() => D.send({ t: "s", seq: 1, p: [40, 3, 40], h: 0, a: "" }), 700);
  await B.key("KeyS", true);
  const bOut = await until(async () => {
    const m = await A.mp();
    const rb = m.remotes.find((r) => r.id === bId);
    if (!rb || !rb.p) return null;
    return dist(rb.p, m.self.p) > 13 ? m : null;
  }, 45000, 500);
  await B.key("KeyS", false);
  check("10: B walks out of the radius", !!bOut);
  const tgHouse = (await A.mp()).together;
  check("10: A's together holds at 1 on the household alone, bonus +10%",
    tgHouse.count === 1 && Math.abs(tgHouse.bonus - 0.1) < 1e-9, JSON.stringify(tgHouse));
  const aHurt = await hurtFox(A, 6);
  check("10: A stands hurt in the field", aHurt !== null && aHurt <= 14, `hp=${aHurt}`);
  D.send({ t: "pulse", p: [40, 3, 40] });
  const aHealed = await until(async () => {
    const m = await A.mp();
    return m.hp === aHurt + 2 ? m : null;
  }, 5000);
  check("10: D's pulse heals A across the realm — A's own health rises",
    !!aHealed, `hp=${(await A.mp()).hp} want=${aHurt + 2}`);
  const aFloater = await A.eval(`document.getElementById("dmgnum").textContent`);
  check("10: A's floater names D", aFloater.includes("TESTFOX-D-MP1"), aFloater);
  const E = new RawFox();
  await E.connect(HOUSE2, TOKENS.e, "ashfall");
  E.send({ t: "s", seq: 1, p: [40, 3, 40], h: 0, a: "" });
  await sleep(200);
  E.send({ t: "pulse", p: [40, 3, 40] });
  await sleep(900);
  const aHpAfterE = (await A.mp()).hp;
  check("10: a fox from another household, same far realm, does not heal A",
    aHpAfterE === aHurt + 2, `hp=${aHpAfterE}`);
  const aHouseE = (await A.mp()).house;
  check("10: A does not list the other household's fox",
    !aHouseE.some((h) => h.id === E.id), JSON.stringify(aHouseE));
  E.close();
  clearInterval(dBeat);
  D.close();
  const houseGone = await until(async () => {
    const m = await A.mp();
    return m.house.length === 0 && m.together.count === 0 ? m : null;
  }, 15000);
  check("10: D parts — the household stands empty and together reads 0",
    !!houseGone, JSON.stringify((await A.mp()).house));

  await A.kill();
  const parted = await until(async () => {
    const m = await B.mp();
    return !m.remotes.some((r) => r.id === aId) ? m : null;
  }, 15000);
  check("11: B sees A part the room", !!parted);
  C.close();
  const empty = await until(async () => {
    const m = await B.mp();
    return m.remotes.length === 0 && m.together.count === 0 ? m : null;
  }, 15000);
  check("11: the room stands empty and together reads 0", !!empty,
    JSON.stringify((await B.mp()).remotes));
  check("11: neither fox threw a page exception",
    A.errors.length === 0 && B.errors.length === 0,
    `A:${A.errors[0] || ""} B:${B.errors[0] || ""}`);
  await B.kill();

  const L = new Fox(BASE_PORT + 2, null, null, HOUSE1);
  await L.boot("https://fox.phext.io/lite.html");
  await sleep(6000);
  const liteMp = await L.mp();
  const liteRow = await L.eval(`!!document.getElementById("menu-mp")`);
  check("12: Lite boots signed-out with the multiplayer row present",
    liteRow === true);
  check("12: signed-out Lite never connects (solo by default)",
    liteMp.connected === false && liteMp.remotes.length === 0,
    JSON.stringify({ connected: liteMp.connected, remotes: liteMp.remotes.length }));
  check("12: Lite threw no page exception", L.errors.length === 0, L.errors[0] || "");
  await L.kill();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
