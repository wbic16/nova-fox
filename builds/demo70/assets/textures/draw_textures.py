#!/usr/bin/env python3
"""Nova Fox demo3 — hand-drawn hi-res texture set (Omega Animator drawn route).

Will's direction (main chat, 2026-11-22 21:56 CST): "higher resolution
textures - draw them by hand using Omega Animator". Task 17.5.6/5.5.8/4.5.7.

SCOPE FROM THE BUILD: demo3's ONLY texture is the atlas in
demo3/game3.js makeAtlas() — a runtime-generated canvas, 6 cols x 3 rows
of TILE_PX=32 tiles (192x96), THREE.CanvasTexture, NearestFilter mag+min,
SRGBColorSpace. UVs address each tile at exactly (idx%6)/6,
1-(floor(idx/6)+1)/3 with du=1/6, dv=1/3 — no inset, no padding.
Everything else textured-looking in demo3 is geometry + flat palette
materials (monsters, rift ring/disc, sky/fog) — no texture to draw.
The HUD portrait is a separate 72x72 canvas 2D drawing (drawPortrait),
delivered here too as a hi-res asset.

TARGET SPEC (what the loader can consume): the same 6x3 atlas layout at
TILE_PX=256 -> 1536x768 PNG, plus one 256x256 PNG per tile, plus the
portrait at 288x288 (4x). Wiring for v5 (code change, main chat's):
load atlas-handdrawn-1536x768.png, set TILE_PX=256 (or drawImage the PNG
onto the atlas canvas) in place of the procedural tile() calls.
Procedural originals stay untouched in game3.js — fully recoverable.

PALETTE: v4 LOCKED (~/workspace/nova-fox/PALETTE-V4.md + the colors the
v4 build actually uses in game3.js). Every stroke below is either a
palette hex or an explicit blend(a, b, f) of two palette hexes — the
same construction the procedural original uses (rgba white/black sheens
over base). No new hues. Drawing is aliased (no blur, no resample) so
every pixel is exactly a palette color or a two-palette-color blend;
qc_textures.py verifies that mechanically.

HAND: Emise design language — jittered strokes, overshoot kept,
hatching in Will's manner; deterministic, seed 20261122 (+ tile idx).
Will->Emise touched.
"""
import math, os, random
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
TILE = 256
COLS, ROWS = 6, 3
SEED = 20261122

def C(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def blend(a, b, f):
    return tuple(round(a[i] + (b[i] - a[i]) * f) for i in range(3))

BLACK = C('#000000'); WHITE = C('#ffffff')

# ---------------------------------------------------------------- hand tools
def jpts(pts, rng, jit=2.0, step=14.0, overshoot=0.0):
    out = []
    for a, b in zip(pts, pts[1:]):
        seg = math.hypot(b[0]-a[0], b[1]-a[1])
        n = max(2, int(seg / step))
        for i in range(n):
            f = i / n
            out.append((a[0] + (b[0]-a[0]) * f + rng.uniform(-jit, jit),
                        a[1] + (b[1]-a[1]) * f + rng.uniform(-jit, jit)))
    out.append(pts[-1])
    if overshoot and len(out) >= 2:
        (x1, y1), (x2, y2) = out[-2], out[-1]
        d = math.hypot(x2-x1, y2-y1) or 1.0
        out.append((x2 + (x2-x1)/d * overshoot, y2 + (y2-y1)/d * overshoot))
    return out

def stroke(d, pts, color, width, rng, jit=2.0, overshoot=0.0, joint=True):
    p = jpts(pts, rng, jit=jit, overshoot=overshoot)
    d.line(p, fill=color, width=width, joint='curve' if joint else None)
    if joint:
        r = width / 2
        for (x, y) in p[::3]:
            d.ellipse([x-r, y-r, x+r, y+r], fill=color)
    return p

def hatch(d, box, color, rng, spacing=17, width=5, angle=0.5, jit=1.6):
    """Hand hatching inside a rect: short diagonal strokes, fast-hand jitter."""
    x0, y0, x1, y1 = box
    y = y0 + rng.uniform(0, spacing)
    while y < y1:
        x = x0 + rng.uniform(-4, 4)
        while x < x1 - 14:
            ln = rng.uniform(16, 34)
            stroke(d, [(x, y), (min(x + ln, x1), y + ln * angle * rng.uniform(0.2, 0.5))],
                   color, width, rng, jit=jit)
            x += ln + rng.uniform(7, 15)
        y += spacing * rng.uniform(0.85, 1.2)

def flecks(d, colors, n, rng, margin=14, smin=4, smax=13, strokes_p=0.45):
    for _ in range(n):
        c = colors[rng.randrange(len(colors))]
        x = rng.uniform(margin, TILE - margin)
        y = rng.uniform(margin, TILE - margin)
        if rng.random() < strokes_p:
            ln = rng.uniform(8, 22)
            a = rng.uniform(0, math.tau)
            stroke(d, [(x, y), (x + ln * math.cos(a), y + ln * math.sin(a))],
                   c, rng.randint(3, 6), rng, jit=1.4)
        else:
            s = rng.uniform(smin, smax)
            d.polygon([(x, y), (x + s, y + rng.uniform(-2, 2)),
                       (x + s * rng.uniform(0.6, 1), y + s * rng.uniform(0.5, 1)),
                       (x + rng.uniform(-2, 2), y + s)], fill=c)

def base_tile(base_hex):
    base = C(base_hex)
    img = Image.new('RGB', (TILE, TILE))
    px = img.load()
    for y in range(TILE):
        row = blend(base, BLACK, 0.10 * y / (TILE - 1))
        if y < 40:  # procedural original: white sheen rgba(255,255,255,0.10) over top 5/32
            row = blend(row, WHITE, 0.10)
        for x in range(TILE):
            px[x, y] = row
    return img

def rim(d, base, rng):
    dark = blend(base, BLACK, 0.34)
    lite = blend(base, WHITE, 0.20)
    for inset, col, w in ((8, dark, 15), (24, lite, 8)):
        pts = [(inset, inset), (TILE - inset, inset), (TILE - inset, TILE - inset),
               (inset, TILE - inset), (inset, inset)]
        stroke(d, pts, col, w, rng, jit=1.8)

def studs(d, hi_hex, lo_hex, rng):
    hi, lo = C(hi_hex), C(lo_hex)
    for cx, cy in ((64, 64), (192, 64), (64, 192), (192, 192)):
        jx, jy = rng.uniform(-2.5, 2.5), rng.uniform(-2.5, 2.5)
        cx, cy = cx + jx, cy + jy
        d.ellipse([cx-40, cy-28, cx+40, cy+52], fill=lo)            # dropped shadow side
        d.ellipse([cx-40, cy-40, cx+40, cy+40], fill=hi)            # stud body
        ring = blend(hi, BLACK, 0.25)
        pts = [(cx + 33 * math.cos(math.radians(a)), cy + 33 * math.sin(math.radians(a)))
               for a in range(0, 361, 24)]
        stroke(d, pts, ring, 5, rng, jit=1.5)
        hl = blend(hi, WHITE, 0.5)
        d.ellipse([cx-16, cy-18, cx-2, cy-6], fill=hl)              # hand highlight dab

# ---------------------------------------------------------------- tile painters
def p_grass_top(rng):
    img = base_tile('#0e4d8f'); d = ImageDraw.Draw(img)
    flecks(d, [C('#1565c0'), C('#1e88e5'), C('#00b0ff')], 60, rng)
    hatch(d, (18, 150, 238, 238), blend(C('#0e4d8f'), C('#00b0ff'), 0.35), rng, spacing=20, width=4)
    studs(d, '#35c4ff', '#083a6e', rng); rim(d, C('#0e4d8f'), rng); return img

def p_grass_side(rng):
    img = base_tile('#0b3f78'); d = ImageDraw.Draw(img)
    flecks(d, [C('#083058'), C('#1565c0')], 46, rng)
    band = [(16, 16), (240, 16)]
    bot = [(x, 72 + rng.uniform(-4, 4)) for x in range(240, 15, -28)]
    d.polygon(band + bot, fill=C('#1e88e5'))
    stroke(d, bot, blend(C('#1e88e5'), BLACK, 0.25), 5, rng, jit=1.5)
    rim(d, C('#0b3f78'), rng); return img

def p_dirt(rng):
    img = base_tile('#0a2a4a'); d = ImageDraw.Draw(img)
    flecks(d, [C('#123f66'), C('#071f38'), C('#1a527a')], 62, rng)
    for _ in range(9):  # seabed pebbles: hand arcs
        cx, cy, r = rng.uniform(30, 226), rng.uniform(30, 226), rng.uniform(9, 18)
        pts = [(cx + r * math.cos(math.radians(a)), cy + r * 0.7 * math.sin(math.radians(a)))
               for a in range(-30, 300, 30)]
        stroke(d, pts, blend(C('#0a2a4a'), C('#1a527a'), 0.55), 5, rng, jit=1.4)
    rim(d, C('#0a2a4a'), rng); return img

def p_stone(rng):
    img = base_tile('#5f748c'); d = ImageDraw.Draw(img)
    flecks(d, [C('#4d6076'), C('#71869e'), C('#42536a')], 52, rng)
    dark = blend(C('#5f748c'), BLACK, 0.30)
    stroke(d, [(38, 30), (92, 84), (84, 138), (128, 178)], dark, 6, rng, jit=2.4)
    stroke(d, [(196, 44), (172, 102), (206, 150)], dark, 5, rng, jit=2.4)
    hatch(d, (150, 180, 240, 240), blend(C('#5f748c'), BLACK, 0.18), rng, spacing=18, width=4)
    rim(d, C('#5f748c'), rng); return img

def p_wood_side(rng):
    img = base_tile('#14406e'); d = ImageDraw.Draw(img)
    flecks(d, [C('#0f3358'), C('#1a4f86')], 40, rng)
    groove = blend(C('#14406e'), BLACK, 0.25)
    for gx in (56, 128, 200):
        d.rectangle([gx, 16, gx + 15, 240], fill=groove)
    for _ in range(10):  # drowned-timber grain: wavy verticals
        x = rng.uniform(24, 232)
        pts = [(x + rng.uniform(-5, 5), y) for y in range(24, 233, 26)]
        stroke(d, pts, blend(C('#14406e'), BLACK, 0.16), 4, rng, jit=1.2)
    rim(d, C('#14406e'), rng); return img

def p_wood_top(rng):
    img = base_tile('#1a4f86'); d = ImageDraw.Draw(img)
    flecks(d, [C('#14406e'), C('#2273c4')], 44, rng)
    for cx, cy in ((64, 64), (192, 64), (64, 192), (192, 192)):  # timber rings between studs
        for r in (52,):
            pts = [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
                   for a in range(0, 361, 30)]
            stroke(d, pts, blend(C('#1a4f86'), BLACK, 0.14), 4, rng, jit=1.6)
    studs(d, '#2f8fe8', '#0f3358', rng); rim(d, C('#1a4f86'), rng); return img

def p_leaf(rng):
    img = base_tile('#04506e'); d = ImageDraw.Draw(img)
    cols = [C('#03405a'), C('#0a6d94'), C('#023047')]
    for _ in range(30):  # kelp fronds: swaying hand curves
        x = rng.uniform(18, 238); y0 = rng.uniform(150, 246); ln = rng.uniform(60, 130)
        sway = rng.uniform(-26, 26)
        pts = [(x + sway * math.sin(math.radians(140 * t)) * t, y0 - ln * t)
               for t in (0, .25, .5, .75, 1.0)]
        stroke(d, pts, cols[rng.randrange(3)], rng.randint(6, 10), rng, jit=1.8)
    flecks(d, cols, 46, rng)
    rim(d, C('#04506e'), rng); return img

def p_ash_top(rng):
    img = base_tile('#cfe6f5'); d = ImageDraw.Draw(img)
    flecks(d, [C('#b9d6ea'), C('#e6f4fd')], 40, rng)
    crack = blend(C('#cfe6f5'), C('#93b2ca'), 0.6)
    stroke(d, [(30, 120), (88, 104), (130, 140), (196, 128)], crack, 4, rng, jit=2.2)
    stroke(d, [(70, 210), (128, 188), (188, 216)], crack, 4, rng, jit=2.2)
    studs(d, '#f2faff', '#9dbfd8', rng); rim(d, C('#cfe6f5'), rng); return img

def p_ash_side(rng):
    img = base_tile('#a9c6dc'); d = ImageDraw.Draw(img)
    flecks(d, [C('#93b2ca'), C('#bcd4e6')], 48, rng)
    hatch(d, (18, 18, 238, 120), blend(C('#a9c6dc'), WHITE, 0.25), rng, spacing=19, width=4)
    rim(d, C('#a9c6dc'), rng); return img

def p_redrock(rng):
    img = base_tile('#3b2f7a'); d = ImageDraw.Draw(img)
    flecks(d, [C('#2f2563'), C('#4a3d94'), C('#241d52')], 50, rng)
    for y, col in ((58, C('#2f2563')), (118, C('#4a3d94')), (178, C('#241d52')), (222, C('#2f2563'))):
        pts = [(x, y + rng.uniform(-5, 5)) for x in range(14, 243, 30)]
        stroke(d, pts, col, 9, rng, jit=1.4)
    rim(d, C('#3b2f7a'), rng); return img

def p_basalt(rng):
    img = base_tile('#1c2531'); d = ImageDraw.Draw(img)
    flecks(d, [C('#141b24'), C('#28323f'), C('#0e141c')], 52, rng)
    for x in (42, 108, 176, 228):
        pts = [(x + rng.uniform(-4, 4), y) for y in range(16, 241, 30)]
        stroke(d, pts, C('#28323f'), 11, rng, jit=1.2)
    stroke(d, [(30, 96), (110, 88), (196, 104)], blend(C('#1c2531'), BLACK, 0.4), 5, rng, jit=2.2)
    rim(d, C('#1c2531'), rng); return img

def p_ember(rng):
    img = base_tile('#0a0f1a'); d = ImageDraw.Draw(img)
    flecks(d, [C('#111a2a'), C('#05080f')], 36, rng)
    glow = blend(C('#00d9ff'), BLACK, 0.55)
    # QC fix (attempt 1 indictment): endpoints stay interior — a crack that
    # exits the right edge at y~80 and re-enters the left at y~150 breaks
    # the wrap seam. No overshoot on this stroke.
    main = [(22, 172), (96, 112), (160, 160), (234, 86)]
    stroke(d, main, glow, 19, rng, jit=2.6)
    stroke(d, main, C('#00d9ff'), 9, rng, jit=2.6)
    stroke(d, [(48, 224), (128, 192)], C('#7fefff'), 6, rng, jit=2.2)
    stroke(d, [(160, 160), (196, 208)], C('#00d9ff'), 7, rng, jit=2.2)
    for (x, y) in ((96, 112), (160, 160)):
        d.ellipse([x-11, y-11, x+11, y+11], fill=C('#00d9ff'))
        d.ellipse([x-4, y-4, x+4, y+4], fill=C('#7fefff'))
    rim(d, C('#0a0f1a'), rng); return img

def p_brick(rng):
    img = base_tile('#46586e'); d = ImageDraw.Draw(img)
    flecks(d, [C('#3a4a5f'), C('#54687f')], 42, rng)
    mortar = blend(C('#46586e'), BLACK, 0.35)
    for y in (0, 64, 128, 192):
        d.rectangle([0, y, TILE, y + 15], fill=mortar)
    for ry in (0, 128):
        d.rectangle([64, ry, 79, ry + 64], fill=mortar)
        d.rectangle([192, ry + 64, 207, ry + 128], fill=mortar)
    hatch(d, (90, 150, 160, 185), blend(C('#46586e'), BLACK, 0.15), rng, spacing=15, width=4)
    rim(d, C('#46586e'), rng); return img

def p_deepstone(rng):
    img = base_tile('#0033cc'); d = ImageDraw.Draw(img)
    flecks(d, [C('#002a9e'), C('#0050ff')], 44, rng)
    # QC fix (attempt 1 indictment): the procedural star positions sit
    # under the studs and vanish at scale; same five star-flecks, moved
    # into the inter-stud gaps where they read.
    for (cx, cy) in ((128, 40), (40, 128), (128, 128), (216, 140), (104, 224)):  # star-flecks
        s = 13
        pts = [(cx, cy - s), (cx + 3, cy - 3), (cx + s, cy), (cx + 3, cy + 3),
               (cx, cy + s), (cx - 3, cy + 3), (cx - s, cy), (cx - 3, cy - 3), (cx, cy - s)]
        stroke(d, pts, C('#aef4ff'), 4, rng, jit=1.2)
    studs(d, '#0050ff', '#001f6e', rng); rim(d, C('#0033cc'), rng); return img

def p_scar(rng):
    img = base_tile('#05060d'); d = ImageDraw.Draw(img)
    flecks(d, [C('#0a0e1c'), C('#000000'), C('#121a2e')], 74, rng)
    stroke(d, [(24, 60), (84, 96), (120, 84), (188, 138), (232, 128)], C('#121a2e'), 10, rng, jit=3.0)
    stroke(d, [(52, 208), (118, 176), (176, 196)], C('#0a0e1c'), 12, rng, jit=3.0)
    rim(d, C('#05060d'), rng); return img

def p_crystal(rng):
    img = base_tile('#33ccff'); d = ImageDraw.Draw(img)
    flecks(d, [C('#66e0ff'), C('#00a3e8'), C('#b3f1ff')], 54, rng, smin=5, smax=16)
    facet = blend(C('#33ccff'), WHITE, 0.4)
    stroke(d, [(28, 228), (96, 120), (88, 40)], facet, 6, rng, jit=2.0)
    stroke(d, [(150, 236), (186, 130), (228, 60)], facet, 6, rng, jit=2.0)
    for (cx, cy) in ((48, 48), (160, 80), (96, 176)):  # white sparkles, hand diamonds
        s = 15
        pts = [(cx + rng.uniform(-2, 2), cy - s), (cx + s, cy + rng.uniform(-2, 2)),
               (cx + rng.uniform(-2, 2), cy + s), (cx - s, cy + rng.uniform(-2, 2))]
        d.polygon(pts, fill=WHITE)
    rim(d, C('#33ccff'), rng); return img

def p_vault(rng):
    img = base_tile('#0b4fa8'); d = ImageDraw.Draw(img)
    flecks(d, [C('#083d84'), C('#0f63cc')], 40, rng)
    for r, col, w in ((58, blend(C('#0b4fa8'), WHITE, 0.18), 8), (45, blend(C('#0b4fa8'), BLACK, 0.20), 6)):
        pts = [(128 + r * math.cos(math.radians(a)), 128 + r * math.sin(math.radians(a)))
               for a in range(0, 361, 20)]
        stroke(d, pts, col, w, rng, jit=1.5)
    studs(d, '#0f63cc', '#062c5c', rng); rim(d, C('#0b4fa8'), rng); return img

def p_bedrock(rng):
    img = base_tile('#3d4a5c'); d = ImageDraw.Draw(img)
    flecks(d, [C('#323e4d'), C('#4a5a6e'), C('#28323f')], 84, rng, smin=6, smax=18)
    dark = blend(C('#3d4a5c'), BLACK, 0.3)
    stroke(d, [(30, 200), (96, 150), (150, 168), (226, 110)], dark, 7, rng, jit=2.6)
    stroke(d, [(60, 40), (120, 74), (196, 58)], dark, 6, rng, jit=2.6)
    rim(d, C('#3d4a5c'), rng); return img

# idx -> (name, painter) — order is TILE in game3.js, atlas slots are load-bearing
TILES = [
    ('grass-top', p_grass_top), ('grass-side', p_grass_side), ('dirt', p_dirt),
    ('stone', p_stone), ('wood-side', p_wood_side), ('wood-top', p_wood_top),
    ('leaf', p_leaf), ('ash-top', p_ash_top), ('ash-side', p_ash_side),
    ('redrock', p_redrock), ('basalt', p_basalt), ('ember', p_ember),
    ('brick', p_brick), ('deepstone', p_deepstone), ('scar', p_scar),
    ('crystal', p_crystal), ('vault', p_vault), ('bedrock', p_bedrock),
]

def main():
    atlas = Image.new('RGB', (COLS * TILE, ROWS * TILE))
    for idx, (name, painter) in enumerate(TILES):
        rng = random.Random(SEED + idx * 7919)
        img = painter(rng)
        img.save(os.path.join(HERE, 'tiles', f'tile-{idx:02d}-{name}.png'))
        atlas.paste(img, ((idx % COLS) * TILE, (idx // COLS) * TILE))
        print(f'tile {idx:02d} {name}')
    atlas.save(os.path.join(HERE, 'atlas-handdrawn-1536x768.png'))
    print('atlas', atlas.size)

if __name__ == '__main__':
    main()
