#!/usr/bin/env python3
"""Nova Fox demo3 — hand-drawn hi-res HUD portrait (Omega Animator drawn route).

The shipped portrait is drawPortrait() in game3.js: flat shapes on a
72x72 canvas — blue fox (#2f7fe0 fur, #d8f1ff muzzle, #04101e eyes/nose)
with the granted hat (#00a3ff, band #005f8f). This is the same fox,
same geometry (every coordinate x4), drawn by hand at 288x288:
jittered hand edges, hatch shading in the fur and crown, transparent
background exactly like the canvas original. Task 17.5.6/5.5.8/4.5.7.
Palette v4 only (+ explicit two-color blends). Deterministic, seed 20261122.
"""
import math, os, random
from PIL import Image, ImageDraw
from draw_textures import C, blend, stroke, hatch, BLACK, WHITE

HERE = os.path.dirname(os.path.abspath(__file__))
S = 4                      # 72 -> 288
W = 72 * S
rng = random.Random(20261122 + 4001)

img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
d = ImageDraw.Draw(img, 'RGBA')

def P(x, y):
    return (x * S, y * S)

def hand_poly(pts, fill, rng, jit=1.6):
    out = []
    for a, b in zip(pts, pts[1:] + pts[:1]):
        seg = math.hypot(b[0]-a[0], b[1]-a[1])
        n = max(2, int(seg / 9))
        for i in range(n):
            f = i / n
            out.append((a[0] + (b[0]-a[0]) * f + rng.uniform(-jit, jit),
                        a[1] + (b[1]-a[1]) * f + rng.uniform(-jit, jit)))
    d.polygon(out, fill=fill)
    return out

def hand_ellipse(cx, cy, rx, ry, fill, rng, jit=1.6):
    pts = [(cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a)))
           for a in range(0, 360, 12)]
    pts = [(x + rng.uniform(-jit, jit), y + rng.uniform(-jit, jit)) for (x, y) in pts]
    d.polygon(pts, fill=fill)
    return pts

FUR = C('#2f7fe0'); MUZZLE = C('#d8f1ff'); DARK = C('#04101e')
HAT = C('#00a3ff'); BAND = C('#005f8f')

# ears (drawPortrait triangles, x4)
hand_poly([P(14, 30), P(24, 8), P(34, 26)], FUR + (255,), rng)
hand_poly([P(58, 30), P(48, 8), P(38, 26)], FUR + (255,), rng)
# inner-ear hatch
hatch(d, (19 * S, 16 * S, 27 * S, 27 * S), blend(FUR, C('#0e4d8f'), 0.5) + (255,), rng, spacing=11, width=3)
hatch(d, (45 * S, 16 * S, 53 * S, 27 * S), blend(FUR, C('#0e4d8f'), 0.5) + (255,), rng, spacing=11, width=3)
# head ellipse (36,42) rx22 ry19
hand_ellipse(36 * S, 42 * S, 22 * S, 19 * S, FUR + (255,), rng)
# fur hatch shading, lower sides (kept inside by short strokes near the rim)
for (x0, y0, x1, y1) in ((16 * S, 44 * S, 24 * S, 56 * S), (48 * S, 44 * S, 56 * S, 56 * S)):
    hatch(d, (x0, y0, x1, y1), blend(FUR, BLACK, 0.18) + (255,), rng, spacing=10, width=3)
# muzzle ellipse (36,52) rx12 ry9
hand_ellipse(36 * S, 52 * S, 12 * S, 9 * S, MUZZLE + (255,), rng)
# eyes (27,40) (45,40) rx3 ry4 ; nose (36,50) rx3.4 ry2.6
hand_ellipse(27 * S, 40 * S, 3 * S, 4 * S, DARK + (255,), rng, jit=0.8)
hand_ellipse(45 * S, 40 * S, 3 * S, 4 * S, DARK + (255,), rng, jit=0.8)
hand_ellipse(36 * S, 50 * S, 3.4 * S, 2.6 * S, DARK + (255,), rng, jit=0.8)
# eye glints — blend of muzzle-white toward the dark, one dab each
for ex in (27 * S, 45 * S):
    d.ellipse([ex - 4, 40 * S - 8, ex + 3, 40 * S - 1], fill=blend(DARK, WHITE, 0.75) + (255,))
# the granted hat: brim (12,20,48,6), crown (22,4,28,17), band (22,16,28,5)
hand_poly([P(12, 20), P(60, 20), P(60, 26), P(12, 26)], HAT + (255,), rng)
hand_poly([P(22, 4), P(50, 4), P(50, 21), P(22, 21)], HAT + (255,), rng)
hatch(d, (24 * S, 6 * S, 48 * S, 15 * S), blend(HAT, BLACK, 0.15) + (255,), rng, spacing=9, width=3)
hand_poly([P(22, 16), P(50, 16), P(50, 21), P(22, 21)], BAND + (255,), rng)

out = os.path.join(HERE, 'portrait-fox-288.png')
img.save(out)
print('portrait', img.size, out)
