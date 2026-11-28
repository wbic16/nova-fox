#!/usr/bin/env python3
"""QC evidence only: a faithful Python replica of demo3's procedural
originals, transcribed from game3.js makeAtlas() (TILE_PX=32, seeded
LCG 987654) and drawPortrait() (72x72). Used for side-by-side identity
checks against the hand-drawn set. NOT a deliverable."""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
TP = 32
COLS, ROWS = 6, 3

state = [987654]
def rnd():
    state[0] = (state[0] * 1103515245 + 12345) & 0x7fffffff
    return state[0] / 0x7fffffff

img = Image.new('RGB', (COLS * TP, ROWS * TP))
d = ImageDraw.Draw(img, 'RGBA')

def tile(idx, base, flecks, n=26, size=3):
    ox, oy = (idx % COLS) * TP, (idx // COLS) * TP
    d.rectangle([ox, oy, ox + TP - 1, oy + TP - 1], fill=base)
    d.rectangle([ox, oy, ox + TP - 1, oy + 4], fill=(255, 255, 255, 26))
    for _ in range(n):
        c = flecks[int(rnd() * len(flecks))]
        fx, fy = int(rnd() * (TP - size)), int(rnd() * (TP - size))
        s = 1 + int(rnd() * size)
        d.rectangle([ox + fx, oy + fy, ox + fx + s - 1, oy + fy + s - 1], fill=c)
    d.rectangle([ox + 1, oy + 1, ox + TP - 2, oy + TP - 2], outline=(0, 0, 0, 87), width=2)
    d.rectangle([ox + 3, oy + 3, ox + TP - 4, oy + TP - 4], outline=(255, 255, 255, 51), width=1)
    return ox, oy

def studs(ox, oy, hi, lo):
    for cx, cy in ((8, 8), (24, 8), (8, 24), (24, 24)):
        d.ellipse([ox + cx - 5, oy + cy - 3.5, ox + cx + 5, oy + cy + 6.5], fill=lo)
        d.ellipse([ox + cx - 5, oy + cy - 5, ox + cx + 5, oy + cy + 5], fill=hi)
        d.ellipse([ox + cx - 3.4, oy + cy - 3.4, ox + cx + 0.2, oy + cy + 0.2], fill=(255, 255, 255, 128))

ox, oy = tile(0, '#0e4d8f', ['#1565c0', '#1e88e5', '#00b0ff']); studs(ox, oy, '#35c4ff', '#083a6e')
ox, oy = tile(1, '#0b3f78', ['#083058', '#1565c0']); d.rectangle([ox + 2, oy + 2, ox + TP - 3, oy + 8], fill='#1e88e5')
tile(2, '#0a2a4a', ['#123f66', '#071f38', '#1a527a'])
tile(3, '#5f748c', ['#4d6076', '#71869e', '#42536a'])
ox, oy = tile(4, '#14406e', ['#0f3358', '#1a4f86'])
for x in range(7, TP, 9):
    d.rectangle([ox + x, oy + 2, ox + x + 1, oy + TP - 3], fill=(0, 0, 0, 64))
ox, oy = tile(5, '#1a4f86', ['#14406e', '#2273c4']); studs(ox, oy, '#2f8fe8', '#0f3358')
tile(6, '#04506e', ['#03405a', '#0a6d94', '#023047'], 60, 4)
ox, oy = tile(7, '#cfe6f5', ['#b9d6ea', '#e6f4fd']); studs(ox, oy, '#f2faff', '#9dbfd8')
tile(8, '#a9c6dc', ['#93b2ca', '#bcd4e6'])
tile(9, '#3b2f7a', ['#2f2563', '#4a3d94', '#241d52'])
tile(10, '#1c2531', ['#141b24', '#28323f', '#0e141c'])
ox, oy = tile(11, '#0a0f1a', ['#111a2a', '#05080f'])
d.line([ox + 2, oy + 22, ox + 12, oy + 14, ox + 20, oy + 20, ox + 30, oy + 10], fill='#00d9ff', width=2)
d.line([ox + 6, oy + 28, ox + 16, oy + 24], fill='#7fefff', width=2)
ox, oy = tile(12, '#46586e', ['#3a4a5f', '#54687f'])
for y in range(0, TP, 8):
    d.rectangle([ox, oy + y, ox + TP - 1, oy + y + 1], fill=(0, 0, 0, 89))
for y in range(0, TP, 16):
    d.rectangle([ox + 8, oy + y, ox + 9, oy + y + 7], fill=(0, 0, 0, 89))
    d.rectangle([ox + 24, oy + y + 8, ox + 25, oy + y + 15], fill=(0, 0, 0, 89))
ox, oy = tile(13, '#0033cc', ['#002a9e', '#0050ff'])
for dx, dy in ((8, 8), (22, 12), (14, 22), (26, 26), (6, 26)):
    d.rectangle([ox + dx, oy + dy, ox + dx + 2, oy + dy + 2], fill='#aef4ff')
studs(ox, oy, '#0050ff', '#001f6e')
tile(14, '#05060d', ['#0a0e1c', '#000000', '#121a2e'], 40)
ox, oy = tile(15, '#33ccff', ['#66e0ff', '#00a3e8', '#b3f1ff'], 30, 4)
for dx, dy in ((6, 6), (20, 10), (12, 22)):
    d.rectangle([ox + dx, oy + dy, ox + dx + 3, oy + dy + 3], fill='#ffffff')
ox, oy = tile(16, '#0b4fa8', ['#083d84', '#0f63cc']); studs(ox, oy, '#0f63cc', '#062c5c')
tile(17, '#3d4a5c', ['#323e4d', '#4a5a6e', '#28323f'], 50, 5)
img.save(os.path.join(HERE, 'original-atlas-192x96.png'))
print('replica atlas', img.size)

# portrait replica from drawPortrait()
p = Image.new('RGBA', (72, 72), (0, 0, 0, 0))
g = ImageDraw.Draw(p)
g.polygon([(14, 30), (24, 8), (34, 26)], fill='#2f7fe0')
g.polygon([(58, 30), (48, 8), (38, 26)], fill='#2f7fe0')
g.ellipse([14, 23, 58, 61], fill='#2f7fe0')
g.ellipse([24, 43, 48, 61], fill='#d8f1ff')
g.ellipse([24, 36, 30, 44], fill='#04101e')
g.ellipse([42, 36, 48, 44], fill='#04101e')
g.ellipse([32.6, 47.4, 39.4, 52.6], fill='#04101e')
g.rectangle([12, 20, 60, 26], fill='#00a3ff')
g.rectangle([22, 4, 50, 21], fill='#00a3ff')
g.rectangle([22, 16, 50, 21], fill='#005f8f')
p.save(os.path.join(HERE, 'original-portrait-72.png'))
print('replica portrait', p.size)
