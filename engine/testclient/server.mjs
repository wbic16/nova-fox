// Nova Fox test-client server — Node stdlib only, no dependencies.
//
// One process, four surfaces:
//   1. The game itself, served from a build tree with bridge.js
//      injected at serve time (the tree on disk is never modified):
//        GET  /game/            the playable page (bridge included)
//        GET  /nf-bridge.js     the bridge script
//   2. The bridge channel (the in-page bridge talks back here):
//        POST /bridge/hello     -> { sessionId }
//        GET  /bridge/stream    Server-Sent Events: commands down
//        POST /bridge/report    snapshots / marks / events / track up
//        POST /bridge/ack       command results up
//   3. REST for builders and test clients:
//        GET  /api/health       GET /api/sessions
//        GET  /api/state        GET /api/marks
//        GET  /api/events       GET /api/track
//        POST /api/actions/<name>   (token required; see below)
//   4. MCP over HTTP JSON-RPC (POST /mcp): the same capabilities as
//      tools, for any MCP host — a builder agent, or a player's AI.
//
// Auth discipline (deliberately small; open questions for Will are in
// TESTCLIENT-REPORT.md):
//   - Observing is open: state/marks/events/track/sessions need no
//     token. A connected page can always be watched.
//   - Acting requires the actor token: `Authorization: Bearer <token>`.
//     The token is generated on first run into ./.token (mode 0600) or
//     taken from --token / $NF_TOKEN.
//   - --readonly refuses every action (REST 403, MCP tool error), for
//     pure-observer deployments.
//   - The server binds 127.0.0.1 unless --host says otherwise.
//
// Usage: node server.mjs [--tree <dir>] [--port <n>] [--host <h>]
//                        [--token <t>] [--readonly]
import http from "node:http";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function argVal(name, dflt) {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const TREE = resolve(argVal("tree", join(HERE, "..", "integration")));
const PORT = Number(argVal("port", "0"));
const HOST = argVal("host", "127.0.0.1");
const READONLY = args.includes("--readonly");

// ---------- actor token ---------------------------------------------------
let TOKEN = argVal("token", process.env.NF_TOKEN || "");
if (!TOKEN) {
  const tokenFile = join(HERE, ".token");
  if (existsSync(tokenFile)) {
    TOKEN = readFileSync(tokenFile, "utf8").trim();
  } else {
    TOKEN = randomBytes(24).toString("hex");
    writeFileSync(tokenFile, TOKEN + "\n", { mode: 0o600 });
  }
}

// ---------- game page (bridge injected per request) ----------------------
const bridgeJs = readFileSync(join(HERE, "bridge.js"), "utf8");
const gameRaw = readFileSync(join(TREE, "index.html"), "utf8");
function gamePage() {
  const port = server.address().port;
  const tag = `<script>window.__NF_SERVER__="http://${HOST}:${port}";</script><script src="/nf-bridge.js"></script>`;
  return gameRaw.includes("</body>") ? gameRaw.replace("</body>", tag + "</body>") : gameRaw + tag;
}
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg", ".wasm": "application/wasm", ".css": "text/css",
  ".md": "text/plain; charset=utf-8",
};

// ---------- sessions --------------------------------------------------------
const sessions = new Map();
let sessionSeq = 0;
function getSession(id) {
  if (id && sessions.has(id)) return sessions.get(id);
  // default: the most recently connected live session
  let best = null;
  for (const s of sessions.values()) if (!best || s.connectedAt > best.connectedAt) best = s;
  return best;
}
function newSession(hello) {
  const s = {
    id: "s" + (++sessionSeq) + "-" + randomUUID().slice(0, 8),
    connectedAt: Date.now(),
    hello, snapshot: null, marks: null,
    events: [], eventSeq: 0, track: [],
    sse: null, pending: new Map(),
  };
  sessions.set(s.id, s);
  return s;
}
async function dispatch(session, type, cmdArgs, timeoutMs = 12000) {
  if (READONLY) throw Object.assign(new Error("server is read-only"), { status: 403 });
  if (!session) throw Object.assign(new Error("no game session connected"), { status: 409 });
  // The bridge opens its command stream a beat after its first
  // snapshot lands; wait briefly for it instead of failing the call.
  for (let i = 0; i < 50 && !session.sse; i++) await new Promise((r) => setTimeout(r, 100));
  if (!session.sse) throw Object.assign(new Error("bridge stream not connected"), { status: 409 });
  return new Promise((resolveP, rejectP) => {
    const id = randomUUID();
    const timer = setTimeout(() => {
      session.pending.delete(id);
      rejectP(Object.assign(new Error("bridge ack timeout: " + type), { status: 504 }));
    }, timeoutMs);
    session.pending.set(id, { resolve: resolveP, reject: rejectP, timer });
    session.sse.write(`data: ${JSON.stringify({ id, type, args: cmdArgs || {} })}\n\n`);
  });
}
// Timeouts are generous: under software rendering the game's main
// thread can block for seconds while a rift opens (measured: a tune
// ack at ~10 s on a contended box). The ack timeout is about the
// bridge answering, not about the game being fast.
const ACTION_TIMEOUT = (type, a) =>
  type === "walk" ? Math.min(120000, (a.durationMs || 0) + 30000)
  : type === "play-tune" ? 60000
  : 15000;

// ---------- helpers -----------------------------------------------------------
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json", "content-length": Buffer.byteLength(body),
    "access-control-allow-origin": "*",
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolveP, rejectP) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => { size += c.length; if (size > 4_000_000) rejectP(new Error("body too large")); else chunks.push(c); });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) return resolveP({});
      try { resolveP(JSON.parse(text)); } catch (e) { rejectP(new Error("invalid JSON body")); }
    });
    req.on("error", rejectP);
  });
}
function authed(req) {
  const h = req.headers.authorization || "";
  return h === "Bearer " + TOKEN;
}
function publicState(s) {
  if (!s) return null;
  return { sessionId: s.id, connectedAt: s.connectedAt, snapshotAgeMs: s.snapshot ? Date.now() - s.snapshot.t : null, ...s.snapshot };
}

// ---------- actions: one implementation, REST + MCP both call it -------------
const ACTIONS = {
  "play-note": (s, a) => dispatch(s, "play-note", { note: a.note }),
  "play-tune": (s, a) => dispatch(s, "play-tune", { notes: a.notes, gapMs: a.gapMs }, ACTION_TIMEOUT("play-tune", a)),
  "walk": (s, a) => dispatch(s, "walk", { durationMs: a.durationMs, backward: !!a.backward, strafe: a.strafe || null }, ACTION_TIMEOUT("walk", a)),
  "turn": (s, a) => dispatch(s, "turn", { steps: a.steps, direction: a.direction }),
  "jump": (s) => dispatch(s, "jump", {}),
  "strike": (s) => dispatch(s, "strike", {}),
  "flip-gravity": (s) => dispatch(s, "flip-gravity", {}),
  "fox-vision": (s) => dispatch(s, "fox-vision", {}),
  "dismiss-splash": (s) => dispatch(s, "dismiss-splash", {}),
  "survey": (s, a) => dispatch(s, "survey", { cx: a.cx, cz: a.cz, radius: a.radius, step: a.step }, 20000),
};
const OBSERVERS = {
  state: (s) => publicState(s),
  marks: (s) => (s ? { sessionId: s.id, ...s.marks } : null),
  events: (s, since) => (s ? { sessionId: s.id, events: s.events.filter((e) => e.seq > (since || 0)) } : null),
  track: (s, since) => (s ? { sessionId: s.id, samples: s.track.filter((p) => p.t > (since || 0)) } : null),
  sessions: () => [...sessions.values()].map((s) => ({
    id: s.id, connectedAt: s.connectedAt, ua: s.hello && s.hello.ua,
    capabilities: s.hello && s.hello.capabilities,
    snapshotAgeMs: s.snapshot ? Date.now() - s.snapshot.t : null,
    streamConnected: !!s.sse,
  })),
};

// ---------- MCP ----------------------------------------------------------------
const MCP_TOOLS = [
  { name: "nf_sessions", description: "List connected Nova Fox game sessions and their capabilities.", inputSchema: { type: "object", properties: {} } },
  { name: "nf_state", description: "Observe the live game: realm, position, gravity (fox direction + the realm's remembered value in subspace), hearts, purse, rift, narration, quest.", inputSchema: { type: "object", properties: { session: { type: "string" } } } },
  { name: "nf_marks", description: "The world's marks: the subspace inscription log (recent), per-realm override counts, monster count, quest/hat state.", inputSchema: { type: "object", properties: { session: { type: "string" } } } },
  { name: "nf_events", description: "Game events since a sequence number: beats fired, realm crossings, rift open/close, hurts, deaths, gravity flips.", inputSchema: { type: "object", properties: { session: { type: "string" }, since: { type: "number" } } } },
  { name: "nf_play_note", description: "Play one note on the fox's instrument (1..11) through the game's real input path.", inputSchema: { type: "object", properties: { note: { type: "number" }, session: { type: "string" } }, required: ["note"] }, act: "play-note" },
  { name: "nf_play_tune", description: "Play a tune (array of note numbers, e.g. [1,4,9] — the bridge tune). Three notes open a rift if they name a place.", inputSchema: { type: "object", properties: { notes: { type: "array", items: { type: "number" } }, session: { type: "string" } }, required: ["notes"] }, act: "play-tune" },
  { name: "nf_walk", description: "Hold a movement key for durationMs (real movement through the game's physics). Default forward; backward=true walks backward; strafe='left'|'right' sidesteps. Keys follow the fox's own control scheme (WASD or AWEF).", inputSchema: { type: "object", properties: { durationMs: { type: "number" }, backward: { type: "boolean" }, strafe: { type: "string" }, session: { type: "string" } }, required: ["durationMs"] }, act: "walk" },
  { name: "nf_turn", description: "Turn by arrow-key taps: each step is ~0.32 rad (~18 deg). direction: left|right.", inputSchema: { type: "object", properties: { steps: { type: "number" }, direction: { type: "string" }, session: { type: "string" } } }, act: "turn" },
  { name: "nf_jump", description: "Jump (the Space key path).", inputSchema: { type: "object", properties: { session: { type: "string" } } }, act: "jump" },
  { name: "nf_strike", description: "Strike with the fox's weapon (the game's tryStrike entry, the same one click/F converge on).", inputSchema: { type: "object", properties: { session: { type: "string" } } }, act: "strike" },
  { name: "nf_flip_gravity", description: "Flip this realm's gravity (the G key path). In builds with the once-per-day rule, a second shift in the same realm on the same day is refused by the game itself.", inputSchema: { type: "object", properties: { session: { type: "string" } } }, act: "flip-gravity" },
  { name: "nf_fox_vision", description: "Toggle Fox Vision (the N key path). Only present in builds that carry Fox Vision; elsewhere the tool errors NOT_SUPPORTED.", inputSchema: { type: "object", properties: { session: { type: "string" } } }, act: "fox-vision" },
  { name: "nf_survey", description: "Read-only terrain survey: ground heights on a grid around (cx, cz) in the fox's current realm, from the game's own surface function.", inputSchema: { type: "object", properties: { cx: { type: "number" }, cz: { type: "number" }, radius: { type: "number" }, step: { type: "number" }, session: { type: "string" } }, required: ["cx", "cz"] }, act: "survey" },
];
async function mcpCall(req, body) {
  const { id, method, params } = body || {};
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (method === "initialize") {
    return reply({
      protocolVersion: (params && params.protocolVersion) || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "nova-fox-testclient", version: "0.1.0" },
    });
  }
  if (method === "ping") return reply({});
  if (method === "tools/list") return reply({ tools: MCP_TOOLS.map(({ act, ...t }) => t) });
  if (method === "tools/call") {
    const tool = MCP_TOOLS.find((t) => t.name === (params && params.name));
    if (!tool) return fail(-32602, "unknown tool: " + (params && params.name));
    const a = (params && params.arguments) || {};
    const s = getSession(a.session);
    try {
      let out;
      if (tool.act) {
        if (!authed(req)) throw Object.assign(new Error("acting requires the actor token (Authorization: Bearer)"), { status: 401 });
        out = await ACTIONS[tool.act](s, a);
      } else if (tool.name === "nf_sessions") out = OBSERVERS.sessions();
      else if (tool.name === "nf_state") out = OBSERVERS.state(s);
      else if (tool.name === "nf_marks") out = OBSERVERS.marks(s);
      else if (tool.name === "nf_events") out = OBSERVERS.events(s, a.since || 0);
      if (out == null) throw Object.assign(new Error("no game session connected"), { status: 409 });
      return reply({ content: [{ type: "text", text: JSON.stringify(out) }] });
    } catch (e) {
      return reply({ content: [{ type: "text", text: "error: " + e.message }], isError: true });
    }
  }
  return fail(-32601, "method not found: " + method);
}

// ---------- HTTP ------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const path = url.pathname;
  try {
    // CORS: the bridge may ride in a page served from another origin
    // (a file:// copy, the hosted game) — observing is open by design
    // and acting is gated by the token, not by origin.
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-max-age": "600",
      });
      return res.end();
    }
    // game + bridge script
    if (req.method === "GET" && (path === "/game" || path === "/game/" || path === "/game/index.html")) {
      res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store", "access-control-allow-origin": "*" });
      return res.end(gamePage());
    }
    if (req.method === "GET" && path === "/nf-bridge.js") {
      res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store", "access-control-allow-origin": "*" });
      return res.end(bridgeJs);
    }
    if (req.method === "GET" && path.startsWith("/game/")) {
      const file = resolve(join(TREE, path.slice(6)));
      if (!file.startsWith(TREE) || !existsSync(file) || !statSync(file).isFile()) return sendJson(res, 404, { error: "not found" });
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      return res.end(readFileSync(file));
    }
    if (req.method === "GET" && path === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(`<title>Nova Fox test client</title><p><a href="/game/">Open the game</a> · <a href="/api/sessions">sessions</a> · POST /mcp for the MCP surface</p>`);
    }

    // bridge channel
    if (req.method === "POST" && path === "/bridge/hello") {
      const hello = await readBody(req);
      const s = newSession(hello);
      return sendJson(res, 200, { sessionId: s.id });
    }
    if (req.method === "GET" && path === "/bridge/stream") {
      const s = getSession(url.searchParams.get("session"));
      if (!s) return sendJson(res, 404, { error: "no such session" });
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive", "access-control-allow-origin": "*" });
      res.write(": bridge stream open\n\n");
      s.sse = res;
      const hb = setInterval(() => { try { res.write(": hb\n\n"); } catch (e) { /* gone */ } }, 15000);
      req.on("close", () => { clearInterval(hb); if (s.sse === res) s.sse = null; });
      return;
    }
    if (req.method === "POST" && path === "/bridge/report") {
      const r = await readBody(req);
      const s = sessions.get(r.sessionId);
      if (!s) return sendJson(res, 404, { error: "no such session" });
      if (r.snapshot) s.snapshot = r.snapshot;
      if (r.marks) s.marks = r.marks;
      for (const e of r.events || []) s.events.push({ seq: ++s.eventSeq, ...e });
      if (s.events.length > 2000) s.events.splice(0, s.events.length - 2000);
      for (const p of r.track || []) s.track.push(p);
      const cutoff = Date.now() - 90000;
      while (s.track.length && s.track[0].t < cutoff) s.track.shift();
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === "POST" && path === "/bridge/ack") {
      const r = await readBody(req);
      const s = sessions.get(r.sessionId);
      const p = s && s.pending.get(r.id);
      if (p) {
        clearTimeout(p.timer);
        s.pending.delete(r.id);
        if (r.ok) p.resolve(r.result); else p.reject(Object.assign(new Error(r.error || "bridge error"), { status: 502 }));
      }
      return sendJson(res, 200, { ok: true });
    }

    // REST
    if (req.method === "GET" && path === "/api/health")
      return sendJson(res, 200, { ok: true, tree: TREE, readonly: READONLY, sessions: sessions.size });
    if (req.method === "GET" && path === "/api/sessions") return sendJson(res, 200, OBSERVERS.sessions());
    if (req.method === "GET" && path === "/api/state") {
      const out = OBSERVERS.state(getSession(url.searchParams.get("session")));
      return out ? sendJson(res, 200, out) : sendJson(res, 409, { error: "no game session connected" });
    }
    if (req.method === "GET" && path === "/api/marks") {
      const out = OBSERVERS.marks(getSession(url.searchParams.get("session")));
      return out ? sendJson(res, 200, out) : sendJson(res, 409, { error: "no game session connected" });
    }
    if (req.method === "GET" && path === "/api/events") {
      const out = OBSERVERS.events(getSession(url.searchParams.get("session")), Number(url.searchParams.get("since") || 0));
      return out ? sendJson(res, 200, out) : sendJson(res, 409, { error: "no game session connected" });
    }
    if (req.method === "GET" && path === "/api/track") {
      const out = OBSERVERS.track(getSession(url.searchParams.get("session")), Number(url.searchParams.get("since") || 0));
      return out ? sendJson(res, 200, out) : sendJson(res, 409, { error: "no game session connected" });
    }
    if (req.method === "POST" && path.startsWith("/api/actions/")) {
      const name = path.slice("/api/actions/".length);
      if (!ACTIONS[name]) return sendJson(res, 404, { error: "unknown action: " + name });
      if (READONLY) return sendJson(res, 403, { error: "server is read-only" });
      if (!authed(req)) return sendJson(res, 401, { error: "acting requires the actor token (Authorization: Bearer)" });
      const body = await readBody(req);
      const s = getSession(body.session || url.searchParams.get("session"));
      try {
        const result = await ACTIONS[name](s, body);
        return sendJson(res, 200, { ok: true, action: name, result });
      } catch (e) {
        return sendJson(res, e.status || 500, { error: e.message });
      }
    }

    // MCP
    if (req.method === "POST" && path === "/mcp") {
      const body = await readBody(req);
      if (body && body.method && body.id === undefined) { res.writeHead(202); return res.end(); } // notification
      return sendJson(res, 200, await mcpCall(req, body));
    }
    if (req.method === "GET" && path === "/mcp")
      return sendJson(res, 200, { name: "nova-fox-testclient", transport: "http-jsonrpc", tools: MCP_TOOLS.map((t) => t.name) });

    return sendJson(res, 404, { error: "not found: " + path });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  const addr = server.address();
  console.log(JSON.stringify({
    ready: true, url: `http://${HOST}:${addr.port}`, game: `http://${HOST}:${addr.port}/game/`,
    tree: TREE, readonly: READONLY, tokenFile: join(HERE, ".token"),
  }));
});
