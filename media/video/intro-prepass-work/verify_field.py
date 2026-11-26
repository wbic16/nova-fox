#!/usr/bin/env python3
"""Packet IP-3 — Alveus (Rock Mountain): tiling-field verification.
Arc sketch 22.6.9/8.6.10/7.6.9 · Task 24.7.8/9.7.11/7.8.12
On frames 340/350/359: for every line in field-manifest.json, sample
its midpoint and two along-line points (+-7px) for ballpoint-blue
ink; count lines found per box; verify manifest parity alternates
checkerboard-style. Output printed + field-verification.json."""
import json, math, sys
from PIL import Image

frames_dir, manifest_path = sys.argv[1], sys.argv[2]
lines = json.load(open(manifest_path))
def is_blue(px, x, y, W, H):
    for dx in range(-3, 4):
        for dy in range(-3, 4):
            xx, yy = int(round(x + dx)), int(round(y + dy))
            if 0 <= xx < W and 0 <= yy < H:
                r, g, b = px[xx, yy]
                if b > 110 and b > r + 35:
                    return True
    return False
report = {}
for f in (340, 350, 359):
    img = Image.open(f"{frames_dir}/frame_{f:03d}.png").convert("RGB")
    px = img.load()
    per_box = {}
    found = 0
    for L in lines:
        mx, my = L["mid"]; ax, ay = L["a"]; bx, by = L["b"]
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy) or 1.0
        ux, uy = dx / n, dy / n
        ok = (is_blue(px, mx, my, img.width, img.height)
              and is_blue(px, mx + 7 * ux, my + 7 * uy, img.width, img.height)
              and is_blue(px, mx - 7 * ux, my - 7 * uy, img.width, img.height))
        key = tuple(L["box"])
        per_box.setdefault(key, 0)
        if ok:
            per_box[key] += 1
            found += 1
    counts = sorted(per_box.values())
    report[str(f)] = {"lines_found": found, "lines_total": len(lines),
                      "boxes": len(per_box), "per_box_min": counts[0],
                      "per_box_max": counts[-1],
                      "boxes_at_5": sum(1 for v in per_box.values() if v == 5)}
    print(f"frame {f}: lines {found}/{len(lines)} boxes {len(per_box)} "
          f"per-box min {counts[0]} max {counts[-1]} at-5 {report[str(f)]['boxes_at_5']}")
alt_ok = all(L["parity"] == (L["box"][0] + L["box"][1]) % 2 for L in lines)
print("manifest parity alternates checkerboard:", alt_ok)
json.dump({"frames": report, "parity_alternates": alt_ok},
          open("field-verification.json", "w"), indent=1)
print("IP3-DONE")
