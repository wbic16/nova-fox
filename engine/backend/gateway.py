#!/usr/bin/env python3
"""nova-phox-gateway — the Nova Phox backend surface for phext.tech.

Will's rulings (2026-11-22): phext.tech is the backend for Nova
Phox's world state; saving requires login, or a local copy. Reads
are public; writes require a phext.tech login.

What this is: a thin, stdlib-only gateway in front of a dedicated
SQ host instance that holds the single phext `nova-phox-world`.
SQ's native REST (/api/v2: version/toc/select/insert, Bearer-key
auth) matches the game client's contract, but SQ's key cannot be
given to a browser (whoever holds it can write). So the key stays
here, server-side, and the gateway enforces the login rule:

  GET  /api/v2/version   public  -> SQ version
  GET  /api/v2/toc       public  -> SQ toc (nova-phox-world only)
  GET  /api/v2/select    public  -> SQ select (nova-phox-world only)
  POST /api/v2/insert    LOGIN   -> SQ insert, needs a game token
  GET  /api/game-login   the token hand-off (below)
  GET  /api/v2/health    gateway + SQ liveness

The hand-off (no parallel accounts — identity IS the phext.tech
session): the game sends the player, top-level, to
  https://phext.tech/api/game-login?back=https://fox.phext.io/
The gateway asks phext-edit's own /api/session (the player's
Cookie forwarded server-side) who is signed in. If nobody is, it
redirects to phext.tech's front page carrying ?next= back here,
so the platform's own sign-in (Google / X today; GitHub when
configured) completes first. If somebody is, it mints a signed,
30-day, game-scoped token and redirects back to the game with
the token in the URL fragment (fragments never reach servers or
logs). The game stores it and sends it as `Authorization: Bearer`
on inserts. Tokens are HMAC-SHA256 over a secret that never
leaves this host's nova-phox directory (mode 0600).

Insert bodies gain a trailing newline when missing: SQ appends
raw bytes, and the shared scrolls are line-oriented (one
inscription per line, one standing per line).

Config (environment, set by the systemd unit):
  NP_PORT         listen port            (default 18942)
  NP_SQ_BASE      SQ base URL            (default http://127.0.0.1:18941)
  NP_SQ_KEY_FILE  file holding the SQ key
  NP_SECRET_FILE  file holding the token HMAC secret
  NP_PHEXT        the one phext served   (default nova-phox-world)
  NP_SESSION_URL  phext-edit session URL (default http://127.0.0.1:8080/api/session)
  NP_GAME_ORIGIN  the game's origin      (default https://fox.phext.io)
  NP_PUBLIC_BASE  public platform base   (default https://phext.tech)
"""

import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, quote

PORT = int(os.environ.get("NP_PORT", "18942"))
SQ_BASE = os.environ.get("NP_SQ_BASE", "http://127.0.0.1:18941").rstrip("/")
PHEXT = os.environ.get("NP_PHEXT", "nova-phox-world")
SESSION_URL = os.environ.get("NP_SESSION_URL", "http://127.0.0.1:8080/api/session")
GAME_ORIGIN = os.environ.get("NP_GAME_ORIGIN", "https://fox.phext.io")
PUBLIC_BASE = os.environ.get("NP_PUBLIC_BASE", "https://phext.tech").rstrip("/")
TOKEN_TTL = 30 * 24 * 3600  # 30 days
MAX_BODY = 65536
COORD_RE = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,3}\.\d{1,3}\.\d{1,3}$")


def read_secret(path_env):
    path = os.environ.get(path_env, "")
    if not path:
        return ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


SQ_KEY = read_secret("NP_SQ_KEY_FILE")
TOKEN_SECRET = read_secret("NP_SECRET_FILE")


def log(msg):
    sys.stderr.write("[nova-phox-gateway] %s %s\n" % (time.strftime("%Y-%m-%dT%H:%M:%S"), msg))
    sys.stderr.flush()


# ---------- tokens -----------------------------------------------------------

def b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def b64u_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def mint_token(sub: str, name: str) -> str:
    payload = {"sub": sub, "name": name, "iat": int(time.time()),
               "exp": int(time.time()) + TOKEN_TTL}
    body = b64u(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(TOKEN_SECRET.encode("utf-8"), ("npt1." + body).encode("ascii"),
                   hashlib.sha256).digest()
    return "npt1." + body + "." + b64u(sig)


def check_token(token: str):
    """Return the payload dict for a valid token, else None."""
    if not token or not TOKEN_SECRET:
        return None
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != "npt1":
        return None
    body, sig = parts[1], parts[2]
    expect = b64u(hmac.new(TOKEN_SECRET.encode("utf-8"), ("npt1." + body).encode("ascii"),
                           hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expect):
        return None
    try:
        payload = json.loads(b64u_decode(body).decode("utf-8"))
    except Exception:
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    if not payload.get("sub"):
        return None
    return payload


# ---------- upstream helpers ---------------------------------------------------

def sq_request(method: str, path: str, body: bytes = None):
    """Call the SQ host with the server-side key. Returns (status, bytes)."""
    req = urllib.request.Request(SQ_BASE + path, method=method, data=body)
    req.add_header("Authorization", "Bearer " + SQ_KEY)
    if body is not None:
        req.add_header("Content-Type", "text/plain; charset=utf-8")
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        log("SQ upstream error: %r" % (e,))
        return 502, b'{"ok":false,"error":"chart store unreachable"}'


def session_lookup(cookie_header: str):
    """Ask phext-edit who this cookie belongs to. Returns dict or None."""
    req = urllib.request.Request(SESSION_URL, method="GET")
    if cookie_header:
        req.add_header("Cookie", cookie_header)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:
        log("session lookup error: %r" % (e,))
        return None


# ---------- rate limiting (inserts, per source IP) ------------------------------

_insert_log = {}
INSERT_LIMIT = 120  # per minute per IP


def insert_allowed(ip: str) -> bool:
    now = time.time()
    hits = [t for t in _insert_log.get(ip, []) if now - t < 60]
    if len(hits) >= INSERT_LIMIT:
        _insert_log[ip] = hits
        return False
    hits.append(now)
    _insert_log[ip] = hits
    return True


# ---------- HTTP handler ---------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # keep stderr ours
        pass

    # -- response plumbing
    def cors(self):
        origin = self.headers.get("Origin", "")
        if origin == GAME_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", GAME_ORIGIN)
            self.send_header("Vary", "Origin")

    def reply(self, status, body: bytes, ctype="text/plain; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.cors()
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def reply_json(self, status, obj):
        self.reply(status, json.dumps(obj).encode("utf-8"), "application/json")

    def redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    # -- verbs
    def do_OPTIONS(self):
        u = urlparse(self.path)
        if u.path.startswith("/api/v2/"):
            self.send_response(204)
            self.cors()
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Max-Age", "86400")
            self.send_header("Content-Length", "0")
            self.end_headers()
        else:
            self.reply_json(404, {"ok": False, "error": "not found"})

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == "/api/v2/health":
            status, _ = sq_request("GET", "/api/v2/version")
            return self.reply_json(200, {"ok": True, "service": "nova-phox-gateway",
                                         "phext": PHEXT, "sq": status == 200})
        if u.path == "/api/v2/version":
            status, body = sq_request("GET", "/api/v2/version")
            return self.reply(status, body)
        if u.path in ("/api/v2/toc", "/api/v2/select"):
            if q.get("p", [""])[0] != PHEXT:
                return self.reply_json(404, {"ok": False, "error": "unknown phext"})
            if u.path.endswith("select"):
                c = q.get("c", [""])[0]
                if not COORD_RE.match(c):
                    return self.reply_json(400, {"ok": False, "error": "bad coordinate"})
                status, body = sq_request("GET", "/api/v2/select?p=%s&c=%s" % (PHEXT, c))
            else:
                status, body = sq_request("GET", "/api/v2/toc?p=%s" % PHEXT)
            return self.reply(status, body)
        if u.path == "/api/game-login":
            return self.game_login(q)
        return self.reply_json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path != "/api/v2/insert":
            return self.reply_json(404, {"ok": False, "error": "not found"})
        if q.get("p", [""])[0] != PHEXT:
            return self.reply_json(404, {"ok": False, "error": "unknown phext"})
        c = q.get("c", [""])[0]
        if not COORD_RE.match(c):
            return self.reply_json(400, {"ok": False, "error": "bad coordinate"})
        auth = self.headers.get("Authorization", "")
        token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
        payload = check_token(token)
        if payload is None:
            return self.reply_json(401, {"ok": False,
                                         "error": "login required to save to the shared chart"})
        if not insert_allowed(self.client_address[0]):
            return self.reply_json(429, {"ok": False, "error": "slow down"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            return self.reply_json(400, {"ok": False, "error": "bad body size"})
        body = self.rfile.read(length)
        if not body.endswith(b"\n"):
            body += b"\n"
        status, resp = sq_request("POST", "/api/v2/insert?p=%s&c=%s" % (PHEXT, c), body)
        if status == 200:
            log("insert %s by %s (%d bytes)" % (c, payload.get("sub", "?"), len(body)))
        return self.reply(status, resp)

    # -- the hand-off
    def game_login(self, q):
        back = q.get("back", [GAME_ORIGIN + "/"])[0]
        if not back.startswith(GAME_ORIGIN) or any(ch in back for ch in ' \t\r\n"<>'):
            back = GAME_ORIGIN + "/"
        sess = session_lookup(self.headers.get("Cookie", ""))
        if sess is None:
            return self.reply(502, b"phext.tech sign-in is unreachable from here; try again in a moment.")
        if sess.get("signed_in"):
            sub = sess.get("who") or sess.get("handle") or ""
            name = sess.get("name") or sess.get("handle") or sub
            if sub:
                token = mint_token(sub, name)
                base = back.split("#")[0]
                return self.redirect(base + "#np_token=" + token)
        # Not signed in: hand the player to the platform's own
        # sign-in, carrying the way back here in ?next=.
        me = "/api/game-login?back=" + quote(back, safe="")
        return self.redirect(PUBLIC_BASE + "/?next=" + quote(me, safe=""))


def main():
    if not SQ_KEY:
        log("FATAL: SQ key file unreadable (NP_SQ_KEY_FILE)")
        sys.exit(1)
    if not TOKEN_SECRET:
        log("FATAL: token secret file unreadable (NP_SECRET_FILE)")
        sys.exit(1)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    log("listening on 127.0.0.1:%d for phext %s (SQ at %s)" % (PORT, PHEXT, SQ_BASE))
    server.serve_forever()


if __name__ == "__main__":
    main()
