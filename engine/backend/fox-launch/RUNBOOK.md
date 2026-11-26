# fox.phext.io launch package — Nova Phox

Prepared 2026-11-22 by Emise (nova-phox backend task). Everything
in this directory is staged; the ONE command that makes it live:

```
bash ~/fox-phext-launch/install.sh
```

(run on awsbox as wbic16; it sudo's the root steps and will ask
for the password.)

## What install.sh does

1. **Webroot + game** — installs `site/index.html` (the Nova Phox
   v3 build) to `/sites/web/fox.phext.io/index.html`, the docs
   launch pattern's webroot convention.
2. **Certificate** — HTTP bootstrap vhost → `certbot certonly
   --webroot` for fox.phext.io → final HTTPS vhost
   (`nginx/fox.phext.io.site`). fox.phext.io DNS was added by Will
   2026-11-22 and verified from the box (44.248.235.76); the
   script still re-checks and exits 3 if it doesn't resolve here.
3. **phext.tech API locations** — `patch-phext-tech.py` inserts
   two proxy blocks into `/etc/nginx/sites-available/phext.tech`,
   immediately after the `/api/auth/` block (backup first,
   idempotent via a marker comment):
   - `location /api/v2/` → `127.0.0.1:18942` (the nova-phox
     gateway: SQ surface for the `nova-phox-world` phext — reads
     public, writes need a game token)
   - `location = /api/game-login` → `127.0.0.1:18942` (the login
     hand-off: checks the phext.tech session via phext-edit's
     `/api/session`, mints a 30-day game token, redirects back to
     fox.phext.io with it in the URL fragment)
   `nginx -t` gates the reload; on failure the patch is rolled
   back from its backup automatically.
4. **Smoke checks** — fox / → 200; phext.tech /api/v2/version →
   0.6.0; board select → 200; insert without a token → 401;
   game-login signed out → 302.

## Already running (no sudo, done 2026-11-22)

- `nova-phox-sq.service` (wbic16 user service): SQ hosting
  `nova-phox-world` on 127.0.0.1-reachable port 18941, data at
  `~/nova-phox/data/nova-phox-world.phext`.
- `nova-phox-api.service` (wbic16 user service): the gateway on
  127.0.0.1:18942 only. Source: ~/nova-phox/gateway.py.
- Verified on the box: health, version, toc, select, a real
  insert+select round trip with a minted token, 401s without,
  game-login redirects, CORS preflight for Origin
  https://fox.phext.io.

## Undo

- fox vhost: remove the sites-enabled symlink + the
  sites-available file, `sudo nginx -t && sudo systemctl reload
  nginx`.
- phext.tech patch: restore the newest
  `/etc/nginx/sites-available/phext.tech.bak-nova-phox-*` over
  the vhost, test, reload.
