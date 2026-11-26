#!/usr/bin/env python3
"""Assemble demo2/index.html — the self-contained playable demo v2.

Concatenates, into one <script type="module"> in page2.html:
  1. three.module.js (vendored r160, copied from the v1 demo) with its
     export block rewritten as `const THREE = { ... }` so the single
     file needs no imports and opens from file://;
  2. nova_core_b64.js (the WASM core, embedded base64 — same core as v1);
  3. world.js    (subspace + generator; export keywords stripped — the
     same source the Node playtest imports);
  4. game2.js    (Three.js view + input + loop).

Also writes _built_module2.mjs so the exact shipped code can be
syntax-checked under Node.
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent


def read(p):
    return (HERE / p).read_text(encoding="utf-8")


three = read("assets/three.module.js")
m = re.search(r"export\s*\{(.*)\};\s*$", three, re.S)
assert m, "three export block not found"
entries = []
for item in m.group(1).split(","):
    item = item.strip()
    if not item:
        continue
    if " as " in item:
        local, alias = [s.strip() for s in item.split(" as ")]
        entries.append(f"{alias}: {local}")
    else:
        entries.append(item)
three = three[: m.start()] + "const THREE = {\n" + ",\n".join(entries) + "\n};\n"

world = re.sub(r"^export ", "", read("world.js"), flags=re.M)

parts = [
    "// ===== three.js r160 (vendored; export block -> THREE namespace) =====",
    three,
    "// ===== the WASM core (embedded base64) =====",
    read("nova_core_b64.js"),
    "// ===== subspace + generator (source: world.js) =====",
    world,
    "// ===== game (source: game2.js) =====",
    read("game2.js"),
]
module = "\n".join(parts)
assert "</script" not in module.lower(), "module contains </script"
(HERE / "_built_module2.mjs").write_text(module, encoding="utf-8")

page = read("page2.html")
assert "/*__BUILT_MODULE__*/" in page
page = page.replace("/*__BUILT_MODULE__*/", module)
(HERE / "index.html").write_text(page, encoding="utf-8")
print(f"index.html: {len(page)} bytes (module {len(module)} bytes)")
