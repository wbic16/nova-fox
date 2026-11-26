#!/usr/bin/env python3
"""Insert the Nova Phox API locations into the phext.tech vhost.

Run by install.sh (as root, via sudo) on awsbox. Idempotent: a
second run sees the marker and changes nothing. The caller gates
on `nginx -t` and restores the backup on any failure.

The two locations proxy to the nova-phox gateway on
127.0.0.1:18942 (a wbic16 user service):
  location /api/v2/        the SQ surface for nova-phox-world
                           (reads public; writes need a game token)
  location = /api/game-login
                           the login hand-off: reads the phext.tech
                           session via phext-edit's /api/session
                           and mints the game token
They are inserted immediately after the existing /api/auth/ block
inside the 443 server — the only place they can go, since
phext-edit (location /) does not serve /api/v2 (404 today).
"""
import shutil
import sys
import time

PATH = "/etc/nginx/sites-available/phext.tech"
MARKER = "# nova-phox-api (installed by fox-phext-launch/install.sh)"

BLOCK = """
    # nova-phox-api (installed by fox-phext-launch/install.sh) —
    # the Nova Phox backend: gateway to the SQ host that holds the
    # nova-phox-world phext. Reads public; writes require a
    # phext.tech login (game token minted by /api/game-login).
    location /api/v2/ {
        proxy_pass http://127.0.0.1:18942;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/game-login {
        proxy_pass http://127.0.0.1:18942;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
"""


def main():
    with open(PATH, "r", encoding="utf-8") as f:
        src = f.read()
    if MARKER in src:
        print("phext.tech: nova-phox locations already present — no change")
        return 0
    anchor = "    location /api/auth/ {"
    i = src.find(anchor)
    if i < 0:
        print("phext.tech: ANCHOR NOT FOUND (%r) — refusing to guess" % anchor)
        return 1
    j = src.find("{", i)
    depth = 0
    k = j
    while k < len(src):
        ch = src[k]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                break
        k += 1
    if depth != 0:
        print("phext.tech: unbalanced braces scanning the /api/auth/ block")
        return 1
    backup = PATH + ".bak-nova-phox-" + time.strftime("%Y%m%d%H%M%S")
    shutil.copy2(PATH, backup)
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(src[:k + 1] + "\n" + BLOCK + src[k + 1:])
    print("phext.tech: nova-phox locations inserted (backup: %s)" % backup)
    return 0


if __name__ == "__main__":
    sys.exit(main())
