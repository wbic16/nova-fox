#!/usr/bin/env python3
"""QC for the Nova Fox hand-drawn texture set. Task 17.5.6/5.5.8/4.5.7.

(a) PALETTE: every pixel of every output must be a palette-v4 color or a
    blend of exactly two palette-v4 colors (distance to the nearest
    palette-pair segment <= 3.0 in RGB). Palette = PALETTE-V4.md values
    (retired v3 values named in that doc excluded) + the additional hexes
    the v4 build itself uses in game3.js (atlas + portrait code).
(b) TILING: per tile, mean color of the left 6 columns vs right 6, and
    top 6 rows vs bottom 6 — wrap neighbours must agree (<=14/channel),
    plus wrap-render sheets saved for visual seam inspection.
(c) AT-SCALE: contact sheets at 32x32 (the original texel resolution)
    and 96x96 saved for the readability judgment.
(d) PORTRAIT IDENTITY: hand portrait downscaled to 72x72 vs the code
    replica — share of pixels nearest to fur / muzzle / hat / dark must
    track the original's shares.
"""
import itertools, json, os
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
TILE = 256

DOC = ['#000000','#020814','#030614','#00d9ff','#00c8ff','#00e5ff','#00a3ff',
 '#2979ff','#8fd0ff','#bfe3ff','#7fb2ff','#6fb7ff','#aee6ff','#eafcff',
 '#d8f4ff','#d6ecff','#33baff','#5fe8d8','#ff7a00','#ff9500','#ff9d5c',
 '#0e4d8f','#1565c0','#1e88e5','#00b0ff','#0b3f78','#0a2a4a','#14406e',
 '#1a4f86','#04506e','#0a6d94','#cfe6f5','#a9c6dc','#3b2f7a','#5f748c',
 '#46586e','#1c2531','#3d4a5c','#0a0f1a','#7fefff','#0033cc','#33ccff',
 '#0b4fa8','#05060d','#0033aa','#0044cc','#0a1230','#2f7fe0','#9fe8ff']
CODE = ['#001f6e','#002a9e','#0050ff','#00a3e8','#023047','#03405a','#05080f',
 '#062c5c','#071f38','#083058','#083a6e','#083d84','#0a0e1c','#0e141c',
 '#111a2a','#121a2e','#123f66','#141b24','#1a527a','#2273c4','#241d52',
 '#28323f','#2f2563','#2f8fe8','#323e4d','#35c4ff','#3a4a5f','#42536a',
 '#4a3d94','#4a5a6e','#4d6076','#54687f','#66e0ff','#71869e','#93b2ca',
 '#9dbfd8','#aef4ff','#b3f1ff','#b9d6ea','#bcd4e6','#e6f4fd','#f2faff',
 '#ffffff','#005f8f','#04101e','#d8f1ff']
PALETTE = np.array([[int(h[i:i+2], 16) for i in (1, 3, 5)] for h in sorted(set(DOC + CODE))], dtype=np.float64)
PAIRS = np.array([(PALETTE[i], PALETTE[j]) for i, j in itertools.combinations(range(len(PALETTE)), 2)])

def seg_dist(colors):
    """colors (N,3) -> min distance to any palette-pair segment, chunked."""
    out = np.empty(len(colors))
    A = PAIRS[:, 0]; B = PAIRS[:, 1]; AB = B - A
    denom = (AB * AB).sum(axis=1)
    for s in range(0, len(colors), 512):
        c = colors[s:s + 512]
        t = ((c[:, None, :] - A[None]) * AB[None]).sum(axis=2) / denom[None]
        t = np.clip(t, 0, 1)
        proj = A[None] + t[:, :, None] * AB[None]
        dist = np.sqrt(((c[:, None, :] - proj) ** 2).sum(axis=2)).min(axis=1)
        # also distance to palette points (degenerate segments)
        dp = np.sqrt(((c[:, None, :] - PALETTE[None]) ** 2).sum(axis=2)).min(axis=1)
        out[s:s + 512] = np.minimum(dist, dp)
    return out

def palette_check(path, alpha=False):
    im = Image.open(path)
    if alpha:
        a = np.asarray(im)[:, :, 3]
        rgb = np.asarray(im)[:, :, :3][a > 0]
    else:
        rgb = np.asarray(im.convert('RGB')).reshape(-1, 3)
    uniq = np.unique(rgb, axis=0).astype(np.float64)
    dist = seg_dist(uniq)
    worst = int(np.argmax(dist))
    return {'file': os.path.basename(path), 'distinct_colors': int(len(uniq)),
            'max_segment_dist': round(float(dist[worst]), 2),
            'worst_color': '#%02x%02x%02x' % tuple(int(v) for v in uniq[worst]),
            'pixels_off_palette_pct': round(100.0 * float((dist > 3.0).mean()), 3),
            'pass': bool(dist.max() <= 3.0)}

def main():
    report = {'palette': [], 'tiling': [], 'portrait': {}}
    files = [os.path.join(HERE, 'atlas-handdrawn-1536x768.png')]
    tdir = os.path.join(HERE, 'tiles')
    tiles = sorted(os.path.join(tdir, f) for f in os.listdir(tdir) if f.endswith('.png'))
    files += tiles
    for f in files:
        report['palette'].append(palette_check(f))
    report['palette'].append(palette_check(os.path.join(HERE, 'portrait-fox-288.png'), alpha=True))

    # (b) tiling
    for f in tiles:
        im = np.asarray(Image.open(f).convert('RGB')).astype(np.float64)
        lr = np.abs(im[:, :6].mean(axis=(0, 1)) - im[:, -6:].mean(axis=(0, 1))).max()
        tb = np.abs(im[:6].mean(axis=(1, 2)) - im[-6:].mean(axis=(1, 2))).max()
        report['tiling'].append({'file': os.path.basename(f),
                                 'left_right_edge_diff': round(float(lr), 1),
                                 'top_bottom_edge_diff': round(float(tb), 1),
                                 'pass': bool(max(lr, tb) <= 14.0)})
    # wrap sheets for the seam-critical tiles
    wrap = Image.new('RGB', (512, 512))
    for name, pos in (('tile-11-ember.png', (0, 0)), ('tile-12-brick.png', (256, 0)),
                      ('tile-01-grass-side.png', (0, 256)), ('tile-04-wood-side.png', (256, 256))):
        t = Image.open(os.path.join(tdir, name)).resize((128, 128), Image.NEAREST)
        for dx in (0, 128):
            for dy in (0, 128):
                wrap.paste(t, (pos[0] + dx, pos[1] + dy))
    wrap = wrap.resize((1024, 1024), Image.NEAREST)
    wrap.save(os.path.join(HERE, 'qc', 'wrap-test.png'))

    # (c) at-scale sheets
    for px, label in ((32, 'scale-32'), (96, 'scale-96')):
        sheet = Image.new('RGB', (6 * px, 3 * px), 'black')
        for i, f in enumerate(tiles):
            t = Image.open(f).resize((px, px), Image.NEAREST)
            sheet.paste(t, ((i % 6) * px, (i // 6) * px))
        sheet = sheet.resize((6 * px * 3, 3 * px * 3), Image.NEAREST)
        sheet.save(os.path.join(HERE, 'qc', f'{label}.png'))

    # (d) portrait identity by color-share at 72x72
    def shares(path):
        im = Image.open(path).convert('RGBA').resize((72, 72), Image.BOX)
        a = np.asarray(im)
        rgb = a[:, :, :3].reshape(-1, 3).astype(np.float64)
        alpha = a[:, :, 3].reshape(-1)
        rgb = rgb[alpha > 0]
        keys = {'fur': '#2f7fe0', 'muzzle': '#d8f1ff', 'hat': '#00a3ff', 'dark': '#04101e'}
        out = {}
        for k, h in keys.items():
            target = np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)
            out[k] = round(100.0 * float((np.sqrt(((rgb - target) ** 2).sum(axis=1)) < 60).mean()), 1)
        out['opaque_pct'] = round(100.0 * float((alpha > 0).mean()), 1)
        return out
    report['portrait']['hand'] = shares(os.path.join(HERE, 'portrait-fox-288.png'))
    report['portrait']['original_replica'] = shares(os.path.join(HERE, 'qc', 'original-portrait-72.png'))

    with open(os.path.join(HERE, 'qc', 'qc-report.json'), 'w') as fh:
        json.dump(report, fh, indent=1)
    print(json.dumps(report, indent=1))

if __name__ == '__main__':
    main()
