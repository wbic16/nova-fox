#!/bin/bash
# Nova Phox launch for fox.phext.io + the phext.tech API locations.
#
# Run on awsbox as wbic16; the script sudo's the root steps (Will's
# password is asked once or twice). Follows the docs.phext.io
# launch pattern (~/docs-phext-launch/deploy.sh):
#
#   1. webroot /sites/web/fox.phext.io + the game (demo3/index.html)
#   2. HTTP bootstrap vhost -> certbot webroot -> HTTPS site vhost
#   3. phext.tech vhost patch: /api/v2/ and /api/game-login proxy
#      to the nova-phox gateway (127.0.0.1:18942, a user service
#      that is already running — see ~/nova-phox/)
#   4. nginx -t gates every reload; the patch rolls back on failure
#   5. smoke checks at the end
#
# Exit: 0 ok · 3 fox.phext.io DNS does not resolve to this box ·
#       1 other failure
set -u

SITE=fox.phext.io
WEBROOT=/sites/web/fox.phext.io
PUBIP=44.248.235.76
LAUNCH="$HOME/fox-phext-launch"
PHEXT_VHOST=/etc/nginx/sites-available/phext.tech

say() { echo "[fox] $*"; }
die() { echo "[fox] FATAL: $*" >&2; exit 1; }

# --- 0. DNS sanity: never ask certbot for a name that isn't us.
RESOLVED=$(getent hosts "$SITE" | awk '{print $1}' | head -1)
say "DNS: $SITE -> ${RESOLVED:-<none>} (this box: $PUBIP)"
if [ "$RESOLVED" != "$PUBIP" ]; then
  echo "[fox] FATAL: $SITE does not resolve to this box yet." >&2
  exit 3
fi

# --- 1. Webroot + game.
sudo mkdir -p "$WEBROOT/.well-known/acme-challenge"
[ -f "$LAUNCH/site/index.html" ] || die "missing $LAUNCH/site/index.html"
sudo cp "$LAUNCH/site/index.html" "$WEBROOT/index.html"
sudo chown -R www-data:www-data "$WEBROOT"
sudo chmod 755 "$WEBROOT" "$WEBROOT/.well-known" "$WEBROOT/.well-known/acme-challenge"
sudo chmod 644 "$WEBROOT/index.html"
say "game installed at $WEBROOT/index.html ($(stat -c%s "$WEBROOT/index.html") bytes)"

# --- 2. Bootstrap vhost, then the certificate, then the real site.
sudo cp "$LAUNCH/nginx/fox.phext.io.bootstrap" /etc/nginx/sites-available/fox.phext.io
sudo ln -sf /etc/nginx/sites-available/fox.phext.io /etc/nginx/sites-enabled/fox.phext.io
sudo nginx -t || die "nginx -t failed on the bootstrap vhost"
sudo systemctl reload nginx
say "bootstrap vhost live; requesting certificate"
sudo certbot certonly --webroot -w "$WEBROOT" -d "$SITE" \
  --non-interactive --agree-tos --register-unsafely-without-email \
  || die "certbot failed for $SITE"
sudo cp "$LAUNCH/nginx/fox.phext.io.site" /etc/nginx/sites-available/fox.phext.io
sudo nginx -t || die "nginx -t failed on the HTTPS vhost"
sudo systemctl reload nginx
say "HTTPS vhost live for $SITE"

# --- 3. phext.tech: the Nova Phox API locations.
BACKUPS=$(ls "$PHEXT_VHOST".bak-nova-phox-* 2>/dev/null | wc -l)
sudo python3 "$LAUNCH/patch-phext-tech.py" || die "phext.tech patch failed"
if ! sudo nginx -t; then
  NEWEST=$(ls -t "$PHEXT_VHOST".bak-nova-phox-* 2>/dev/null | head -1)
  COUNT=$(ls "$PHEXT_VHOST".bak-nova-phox-* 2>/dev/null | wc -l)
  if [ -n "$NEWEST" ] && [ "$COUNT" -gt "$BACKUPS" ]; then
    sudo cp "$NEWEST" "$PHEXT_VHOST"
    sudo nginx -t && say "phext.tech rolled back to $NEWEST"
  fi
  die "nginx -t failed after the phext.tech patch — rolled back"
fi
sudo systemctl reload nginx
say "phext.tech now proxies /api/v2/ and /api/game-login to the nova-phox gateway"

# --- 4. Smoke checks.
say "smoke checks:"
code=$(curl -s -o /tmp/fox-smoke.html -w '%{http_code}' --max-time 10 "https://$SITE/")
grep -qi "Nova" /tmp/fox-smoke.html && TITLE=ok || TITLE=MISSING
echo "  https://$SITE/            -> $code (title: $TITLE)"
ver=$(curl -s --max-time 10 https://phext.tech/api/v2/version)
echo "  https://phext.tech/api/v2/version -> $ver"
board=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://phext.tech/api/v2/select?p=nova-phox-world&c=1.1.1/1.1.2/1.1.1")
echo "  board select             -> $board (want 200)"
ins=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST --data-binary 'smoke' "https://phext.tech/api/v2/insert?p=nova-phox-world&c=1.1.1/1.1.1/1.1.1")
echo "  insert without a token   -> $ins (want 401)"
login=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://phext.tech/api/game-login?back=https://fox.phext.io/")
echo "  game-login (signed out)  -> $login (want 302 to phext.tech sign-in)"
[ "$code" = 200 ] && [ "$ver" = "0.6.0" ] && [ "$board" = 200 ] && [ "$ins" = 401 ] && [ "$login" = 302 ] \
  && say "SMOKE PASS — Nova Phox is live at https://$SITE/" \
  || say "SMOKE: something above is off — read the lines before believing this"
