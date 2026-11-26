#!/usr/bin/env python3
"""Assemble index.html — the self-contained playable demo.

Concatenates, into one <script type="module"> in page.html:
  1. three.module.js (vendored r160) with its export block rewritten
     as `const THREE = { ... }` so the single-file build needs no
     imports and opens from file://;
  2. dungeon.js      (the dungeon-phext, embedded byte-identical);
  3. nova_core_b64.js (the WASM core, embedded base64);
  4. subspace.js     (export keywords stripped — same source the Node
     playtest imports);
  5. game.js         (view + input + loop).

Also writes _built_module.mjs so the exact shipped code can be
syntax-checked (and smoke-run) under Node.
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

subspace = re.sub(r"^export ", "", read("subspace.js"), flags=re.M)

parts = [
    "// ===== three.js r160 (vendored; export block -> THREE namespace) =====",
    three,
    "// ===== the world (dungeon.phext, embedded) =====",
    read("dungeon.js"),
    "// ===== the WASM core (embedded base64) =====",
    read("nova_core_b64.js"),
    "// ===== subspace module (source: subspace.js) =====",
    subspace,
    "// ===== game (source: game.js) =====",
    read("game.js"),
]
module = "\n".join(parts)
assert "</script" not in module.lower(), "module contains </script"
(HERE / "_built_module.mjs").write_text(module, encoding="utf-8")

page = read("page.html")
assert "/*__BUILT_MODULE__*/" in page
page = page.replace("/*__BUILT_MODULE__*/", module)
(HERE / "index.html").write_text(page, encoding="utf-8")
print(f"index.html: {len(page)} bytes (module {len(module)} bytes)")
