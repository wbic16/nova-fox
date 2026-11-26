// Nova Fox test client — library + CLI over the test-client server's
// REST surface. The CLI is the builders' hand tool; checks.mjs uses
// the library.
//
//   node client.mjs state
//   node client.mjs marks | events [--since N] | track [--since MS]
//   node client.mjs note 4 | tune 1,4,9 | walk 3000 [--back]
//   node client.mjs turn left 2 | jump | strike | flip | vision
//   node client.mjs survey <cx> <cz> [radius] [step]
// Env: NF_URL (default http://127.0.0.1:8979), NF_TOKEN (default:
// the .token file beside this script), NF_SESSION.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export function defaultToken() {
  if (process.env.NF_TOKEN) return process.env.NF_TOKEN;
  const f = join(HERE, ".token");
  return existsSync(f) ? readFileSync(f, "utf8").trim() : "";
}

export class NfClient {
  constructor(baseUrl, token = defaultToken(), session = process.env.NF_SESSION || "") {
    this.base = baseUrl.replace(/\/$/, "");
    this.token = token;
    this.session = session;
  }
  async _get(path) {
    const r = await fetch(this.base + path);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${path} -> ${r.status}: ${j.error || "error"}`);
    return j;
  }
  async _act(name, args = {}) {
    const r = await fetch(this.base + "/api/actions/" + name, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + this.token },
      body: JSON.stringify({ ...args, session: this.session || undefined }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${name} -> ${r.status}: ${j.error || "error"}`);
    return j.result;
  }
  sessions() { return this._get("/api/sessions"); }
  state() { return this._get("/api/state" + (this.session ? "?session=" + this.session : "")); }
  marks() { return this._get("/api/marks" + (this.session ? "?session=" + this.session : "")); }
  events(since = 0) { return this._get(`/api/events?since=${since}` + (this.session ? "&session=" + this.session : "")); }
  track(since = 0) { return this._get(`/api/track?since=${since}` + (this.session ? "&session=" + this.session : "")); }
  playNote(note) { return this._act("play-note", { note }); }
  playTune(notes, gapMs) { return this._act("play-tune", { notes, gapMs }); }
  walk(durationMs, opts = {}) { return this._act("walk", { durationMs, backward: !!opts.backward, strafe: opts.strafe || null }); }
  turn(direction, steps) { return this._act("turn", { direction, steps }); }
  jump() { return this._act("jump", {}); }
  strike() { return this._act("strike", {}); }
  flipGravity() { return this._act("flip-gravity", {}); }
  foxVision() { return this._act("fox-vision", {}); }
  dismissSplash() { return this._act("dismiss-splash", {}); }
  survey(cx, cz, radius = 26, step = 2) { return this._act("survey", { cx, cz, radius, step }); }
  async waitFor(fn, timeoutMs = 15000, pollMs = 200, label = "condition") {
    const t0 = Date.now();
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() - t0 > timeoutMs) throw new Error("waitFor timeout: " + label);
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (import.meta.url === "file://" + process.argv[1]) {
  const base = process.env.NF_URL || "http://127.0.0.1:8979";
  const c = new NfClient(base);
  const [cmd, ...rest] = process.argv.slice(2);
  const out = (v) => console.log(JSON.stringify(v, null, 2));
  try {
    switch (cmd) {
      case "sessions": out(await c.sessions()); break;
      case "state": out(await c.state()); break;
      case "marks": out(await c.marks()); break;
      case "events": out(await c.events(Number(rest[0] || 0))); break;
      case "track": out(await c.track(Number(rest[0] || 0))); break;
      case "note": out(await c.playNote(Number(rest[0]))); break;
      case "tune": out(await c.playTune(rest[0].split(",").map(Number))); break;
      case "walk": out(await c.walk(Number(rest[0]), { backward: rest.includes("--back"), strafe: rest.includes("--left") ? "left" : rest.includes("--right") ? "right" : null })); break;
      case "turn": out(await c.turn(rest[0] || "left", Number(rest[1] || 1))); break;
      case "jump": out(await c.jump()); break;
      case "strike": out(await c.strike()); break;
      case "flip": out(await c.flipGravity()); break;
      case "vision": out(await c.foxVision()); break;
      case "survey": out(await c.survey(Number(rest[0]), Number(rest[1]), Number(rest[2] || 26), Number(rest[3] || 2))); break;
      default:
        console.error("usage: client.mjs <sessions|state|marks|events|track|note|tune|walk|turn|jump|strike|flip|vision|survey> ...");
        process.exit(2);
    }
  } catch (e) {
    console.error("error:", e.message);
    process.exit(1);
  }
  await sleep(10);
}
