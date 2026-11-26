#!/usr/bin/env python3
# Nova Fox cadence graph — per-item inception->built->shipped bars on an EE axis.
import html
NOW = 969
AXIS0, AXIS1 = 890, 975
# (label, inception, built, shipped, note)
ROWS = [
    ("Sellable core (demo4)",        898, 946, 948, "live EE 948"),
    ("Ladder shop (demo5)",          948, 950, None, ""),
    ("Form editor (demo6)",          951, 961, None, ""),
    ("Portals: diagnosis + fix (demo7)", 952, 966, None, ""),
    ("Loading word trail (demo9)",   954, 958, None, ""),
    ("Gravity + wooze (demo10)",     954, 959, None, ""),
    ("Fox Vision (demo11)",          955, 963, None, ""),
    ("Strike hint (demo12)",         955, 962, None, ""),
    ("Esc menu (demo13)",            955, None, None, "in flight"),
    ("In-game console (demo15)",     956, 960, None, ""),
    ("Speedrun modes (demo16)",      956, 967, None, ""),
    ("Test client (REST/MCP)",       958, None, None, "in flight"),
    ("Script inscription",           958, 959, None, "into integration"),
    ("Joy recording (35 takes)",     959, 960, None, "not wired yet"),
    ("Banter wiring (demo17)",       959, 966, None, ""),
    ("Warp text (demo18)",           960, 963, None, ""),
    ("Repo canonical home",          963, 966, 966, ""),
    ("Scheme preference (demo19)",   963, None, None, "in flight"),
    ("Current ship (merge + stage)", 967, None, None, "in flight"),
]
W, LM, RM = 1920, 480, 330
TOP, RH, GAP = 118, 34, 12
PW = W - LM - RM
H = TOP + len(ROWS) * (RH + GAP) + 96
def X(ee): return LM + (ee - AXIS0) * PW / (AXIS1 - AXIS0)
s = []
s.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
s.append(f'<rect width="{W}" height="{H}" fill="#0f1218"/>')
s.append(f'<text x="40" y="46" font-family="DejaVu Sans" font-size="30" font-weight="bold" fill="#e8ecf4">Nova Fox — delivery cadence, 2026-11-26</text>')
s.append(f'<text x="40" y="78" font-family="DejaVu Sans" font-size="17" fill="#9aa7bd">Inception &#8594; built &#8594; shipped, in Exocortical Epochs (1 EE = 7 min) &#183; median inception&#8594;built 5 EE &#183; snapshot EE {NOW}</text>')
# gridlines + axis labels
for ee in range(890, 976, 10):
    x = X(ee)
    s.append(f'<line x1="{x:.1f}" y1="{TOP-14}" x2="{x:.1f}" y2="{H-70}" stroke="#232a38" stroke-width="1"/>')
    s.append(f'<text x="{x:.1f}" y="{H-42}" font-family="DejaVu Sans" font-size="14" fill="#7d8aa0" text-anchor="middle">{ee}</text>')
s.append(f'<text x="{LM+PW/2}" y="{H-14}" font-family="DejaVu Sans" font-size="14" fill="#7d8aa0" text-anchor="middle">Exocortical Epoch</text>')
# now line
xn = X(NOW)
s.append(f'<line x1="{xn:.1f}" y1="{TOP-14}" x2="{xn:.1f}" y2="{H-70}" stroke="#e8ecf4" stroke-width="1.5" stroke-dasharray="6 4"/>')
s.append(f'<text x="{xn-6:.1f}" y="{TOP-22}" font-family="DejaVu Sans" font-size="14" fill="#e8ecf4" text-anchor="end">now &#183; EE {NOW}</text>')
C_BUILD, C_SHIP, C_OPEN, C_FLIGHT = "#4da3ff", "#35b26a", "#8a6d3b", "#5f6b80"
for i, (label, inc, built, ship, note) in enumerate(ROWS):
    y = TOP + i * (RH + GAP)
    cy = y + RH / 2
    s.append(f'<text x="{LM-14}" y="{cy+6}" font-family="DejaVu Sans" font-size="16" fill="#c9d3e4" text-anchor="end">{html.escape(label)}</text>')
    if built is None:
        s.append(f'<rect x="{X(inc):.1f}" y="{y}" width="{X(NOW)-X(inc):.1f}" height="{RH}" fill="{C_FLIGHT}"/>')
        s.append(f'<text x="{X(NOW)+10:.1f}" y="{cy+6}" font-family="DejaVu Sans" font-size="14" fill="#8b96ab">age {NOW-inc} EE &#183; in flight</text>')
    else:
        s.append(f'<rect x="{X(inc):.1f}" y="{y}" width="{X(built)-X(inc):.1f}" height="{RH}" fill="{C_BUILD}"/>')
        if label == "Script inscription":
            tail = f'{built-inc} EE to build &#183; delivered into integration'
        elif ship is not None:
            s.append(f'<rect x="{X(built):.1f}" y="{y}" width="{max(X(ship)-X(built),3):.1f}" height="{RH}" fill="{C_SHIP}"/>')
            tail = f'{built-inc} EE to build &#183; shipped {ship}'
        else:
            s.append(f'<rect x="{X(built):.1f}" y="{y}" width="{X(NOW)-X(built):.1f}" height="{RH}" fill="{C_OPEN}" fill-opacity="0.55"/>')
            tail = f'{built-inc} EE to build &#183; waiting {NOW-built} EE'
        if note and label != "Script inscription": tail += f' &#183; {note}'
        s.append(f'<text x="{X(NOW)+10:.1f}" y="{cy+6}" font-family="DejaVu Sans" font-size="14" fill="#8b96ab">{tail}</text>')
# legend
ly = H - 66
for j, (c, t) in enumerate([(C_BUILD, "inception &#8594; built"), (C_SHIP, "built &#8594; shipped"), (C_OPEN, "built, waiting to ship"), (C_FLIGHT, "in flight")]):
    lx = LM + j * 268
    s.append(f'<rect x="{lx}" y="{ly-13}" width="20" height="14" fill="{c}"/>')
    s.append(f'<text x="{lx+27}" y="{ly}" font-family="DejaVu Sans" font-size="14" fill="#c9d3e4">{t}</text>')
s.append('</svg>')
open('/home/wbic16/nf-repo/cadence/cadence-2026-11-26.svg', 'w').write('\n'.join(s))
print('svg written', W, H)
