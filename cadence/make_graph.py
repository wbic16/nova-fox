#!/usr/bin/env python3
# Nova Fox cadence graph — data-driven: parses cadence-data.md (same dir),
# emits cadence-<date>.svg + .png. Per-item bars inception->built->shipped
# on an EE axis, median markers in the subtitle, dark background.
# (EE 1008 shrink: previously this file carried a hard-coded row list and
# needed hand-fix commits at EE 969-970; now regeneration is one command.)
import html, re, statistics, subprocess, sys, os
from datetime import datetime
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = 1795327200
NOW = int((datetime.now().timestamp() - BASE) // 420) + 1
DATE = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")

def num(s):
    s = str(s).strip()
    return None if s == "-" else int(s.rstrip("*"))

ROWS = []
for line in open(os.path.join(HERE, "cadence-data.md")):
    if not line.startswith("item: "):
        continue
    parts = [p.strip() for p in line.split("|")]
    get = lambda k: next(p.split(":", 1)[1].strip() for p in parts if p.strip().startswith(k + ":"))
    label = parts[0].split(":", 1)[1].strip()
    tree = get("tree")
    ROWS.append((f"{label} ({tree})", num(get("inception")), num(get("built")),
                 num(get("shipped")), num(get("live")), get("status")))

i2b = [b - i for (_, i, b, s, l, _) in ROWS if b is not None]
i2s = [s - i for (_, i, b, s, l, _) in ROWS if s is not None]
med_b = statistics.median(i2b); med_s = statistics.median(i2s)
AXIS0 = min(i for (_, i, *_rest) in ROWS) - 8
AXIS1 = NOW + 4
W, LM, RM = 1920, 480, 330
TOP, RH, GAP = 118, 34, 12
PW = W - LM - RM
H = TOP + len(ROWS) * (RH + GAP) + 96
def X(ee): return LM + (ee - AXIS0) * PW / (AXIS1 - AXIS0)
s = []
s.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
s.append(f'<rect width="{W}" height="{H}" fill="#0f1218"/>')
s.append(f'<text x="40" y="46" font-family="DejaVu Sans" font-size="30" font-weight="bold" fill="#e8ecf4">Nova Fox — delivery cadence, {DATE}</text>')
s.append(f'<text x="40" y="78" font-family="DejaVu Sans" font-size="17" fill="#9aa7bd">Inception &#8594; built &#8594; shipped, in Exocortical Epochs (1 EE = 7 min) &#183; median inception&#8594;built {med_b:g} EE &#183; median inception&#8594;shipped {med_s:g} EE &#183; snapshot EE {NOW}</text>')
step = 10 if AXIS1 - AXIS0 <= 130 else 20
for ee in range((AXIS0 // step) * step, AXIS1 + 1, step):
    x = X(ee)
    s.append(f'<line x1="{x:.1f}" y1="{TOP-14}" x2="{x:.1f}" y2="{H-70}" stroke="#232a38" stroke-width="1"/>')
    s.append(f'<text x="{x:.1f}" y="{H-42}" font-family="DejaVu Sans" font-size="14" fill="#7d8aa0" text-anchor="middle">{ee}</text>')
s.append(f'<text x="{LM+PW/2}" y="{H-14}" font-family="DejaVu Sans" font-size="14" fill="#7d8aa0" text-anchor="middle">Exocortical Epoch</text>')
xn = X(NOW)
s.append(f'<line x1="{xn:.1f}" y1="{TOP-14}" x2="{xn:.1f}" y2="{H-70}" stroke="#e8ecf4" stroke-width="1.5" stroke-dasharray="6 4"/>')
s.append(f'<text x="{xn-6:.1f}" y="{TOP-22}" font-family="DejaVu Sans" font-size="14" fill="#e8ecf4" text-anchor="end">now &#183; EE {NOW}</text>')
C_BUILD, C_SHIP, C_OPEN, C_FLIGHT, C_LIVE = "#4da3ff", "#35b26a", "#8a6d3b", "#5f6b80", "#ffd34d"
for i, (label, inc, built, ship, live, status) in enumerate(ROWS):
    y = TOP + i * (RH + GAP); cy = y + RH / 2
    s.append(f'<text x="{LM-14}" y="{cy+6}" font-family="DejaVu Sans" font-size="16" fill="#c9d3e4" text-anchor="end">{html.escape(label)}</text>')
    if built is None:
        s.append(f'<rect x="{X(inc):.1f}" y="{y}" width="{X(NOW)-X(inc):.1f}" height="{RH}" fill="{C_FLIGHT}"/>')
        tail = f'age {NOW-inc} EE &#183; in flight'
    else:
        s.append(f'<rect x="{X(inc):.1f}" y="{y}" width="{max(X(built)-X(inc),3):.1f}" height="{RH}" fill="{C_BUILD}"/>')
        if ship is not None:
            s.append(f'<rect x="{X(built):.1f}" y="{y}" width="{max(X(ship)-X(built),3):.1f}" height="{RH}" fill="{C_SHIP}"/>')
            tail = f'{built-inc} EE to build &#183; shipped {ship}'
            if live is not None:
                s.append(f'<circle cx="{X(live):.1f}" cy="{cy}" r="6" fill="{C_LIVE}"/>')
                tail += f' &#183; live {live}'
        else:
            s.append(f'<rect x="{X(built):.1f}" y="{y}" width="{X(NOW)-X(built):.1f}" height="{RH}" fill="{C_OPEN}" fill-opacity="0.55"/>')
            tail = f'{built-inc} EE to build &#183; waiting {NOW-built} EE'
    s.append(f'<text x="{X(NOW)+10:.1f}" y="{cy+6}" font-family="DejaVu Sans" font-size="14" fill="#8b96ab">{tail}</text>')
ly = H - 66
for j, (c, t) in enumerate([(C_BUILD, "inception &#8594; built"), (C_SHIP, "built &#8594; shipped"), (C_OPEN, "built, waiting to ship"), (C_FLIGHT, "in flight")]):
    lx = LM + j * 268
    s.append(f'<rect x="{lx}" y="{ly-13}" width="20" height="14" fill="{c}"/>')
    s.append(f'<text x="{lx+27}" y="{ly}" font-family="DejaVu Sans" font-size="14" fill="#c9d3e4">{t}</text>')
s.append(f'<circle cx="{LM+4*268}" cy="{ly-6}" r="6" fill="{C_LIVE}"/>')
s.append(f'<text x="{LM+4*268+14}" y="{ly}" font-family="DejaVu Sans" font-size="14" fill="#c9d3e4">live</text>')
s.append('</svg>')
svg_path = os.path.join(HERE, f"cadence-{DATE}.svg")
png_path = os.path.join(HERE, f"cadence-{DATE}.png")
open(svg_path, "w").write("\n".join(s))
print("svg written", svg_path, W, H, "rows", len(ROWS), "median i2b", med_b, "median i2s", med_s, "NOW", NOW)
# SVG -> PNG: try cairosvg, rsvg-convert, inkscape, chromium headless
ok = False
try:
    import cairosvg
    cairosvg.svg2png(url=svg_path, write_to=png_path); ok = True; print("png via cairosvg")
except Exception as e:
    print("cairosvg unavailable:", e)
if not ok:
    for cmd in (["rsvg-convert", "-o", png_path, svg_path],
                ["inkscape", svg_path, "--export-type=png", f"--export-filename={png_path}"]):
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if r.returncode == 0 and os.path.exists(png_path): ok = True; print("png via", cmd[0]); break
        except Exception as e: print(cmd[0], "failed:", e)
if not ok:
    chrome = os.path.expanduser("~/.cache/ms-playwright")
    cand = []
    if os.path.isdir(chrome):
        for root, _, files in os.walk(chrome):
            for f in files:
                if f in ("chrome", "headless_shell"): cand.append(os.path.join(root, f))
    for c in cand[:1]:
        r = subprocess.run([c, "--headless", "--disable-gpu", "--no-sandbox",
                            f"--screenshot={png_path}", "--window-size=1920," + str(H),
                            "file://" + svg_path], capture_output=True, text=True, timeout=120)
        if os.path.exists(png_path): ok = True; print("png via chromium", c); break
print("PNG_OK" if ok and os.path.exists(png_path) else "PNG_FAILED", png_path,
      os.path.getsize(png_path) if os.path.exists(png_path) else 0)
sys.exit(0 if ok else 3)
