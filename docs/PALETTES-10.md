# Nova Fox — the ten realm palettes (feedback #27)

Will's order, 2026-11-22 23:09 CST: *"each level the user jumps to
needs to feel different — a different color palette — only 10 of
them."*

**Home is Nova Prime.** It is the starting realm, and it keeps the
palette-v4 identity (PALETTE-V4.md) exactly — OLED black, ocean fog,
Tron cyan. Its palette is the built-in home default in world.js
(`HOME_PALETTE`), not a row of the table.

**The table holds exactly ten entries** — one for each of the ten
ranch-named realms in `REALMS` (world.js `REALM_PALETTES`). A naming
note, stated plainly: the game names eleven realms — Nova Prime plus
the ten ranch names. The ten-entry table covers the ten ranch-named
realms; home's v4 palette is the reference the other ten depart
from, and it applies to Nova Prime on entry like any other palette.

Each palette is data, applied on realm entry by one code path
(`applyRealmPalette` in game3.js): void (scene background), fog
color + near/far, hemisphere sky/ground + intensity, sun color +
intensity, the atlas hue-rotate/saturate that re-skins every block
tile, a material tint, and the realm's two accents (primary glow —
also the color of a rift ring that leads there — and secondary).
The engine has no gradient skybox: the sky a player sees is the
void + fog pair, so those two carry the "sky" role. All departures
are hue changes, not brightness steps; every realm stays OLED-dark
so the DOM HUD and popups (fixed colors, panel-backed) keep their
contrast in all ten.

| Realm | Feel | Void | Fog (near–far) | Hemi sky / ground (I) | Sun (I) | Accent | Accent 2 | Atlas hue / sat | Tint |
|---|---|---|---|---|---|---|---|---|---|
| **Nova Prime** (home, v4) | the ocean of probability, Tron dark | #000000 | #020814 (34–110) | #8fd0ff / #0a1a33 (0.95) | #bfe3ff (1.6) | #00d9ff | #2979ff | 0° / 1.00 | #ffffff |
| **Ashfall Haven** | ember dark, cinder air | #000000 | #140301 (26–88) | #c97a4e / #180602 (0.70) | #ff9a5c (1.25) | #ff7a00 | #ffd23f | +165° / 1.05 | #ffe3cf |
| **Ni-Knight** | violet steel, a knight's vigil | #000000 | #06030f (30–100) | #8a76d6 / #0a0618 (0.80) | #a98fff (1.35) | #8b5cff | #c9a7ff | +55° / 1.00 | #e6dcff |
| **Logos Prime** | prime gold, first light | #000000 | #0c0700 (32–105) | #d6b25e / #171002 (0.85) | #ffd76a (1.55) | #ffc400 | #ffe082 | +195° / 1.00 | #fff0c2 |
| **Elven Path** | deep emerald shade | #000000 | #02100a (30–100) | #5ec98d / #04150a (0.80) | #8fffca (1.30) | #2effa8 | #a8ffd9 | −65° / 1.05 | #d2ffe6 |
| **Orchid Flow** | orchid magenta bloom | #000000 | #10030c (30–98) | #d65ec0 / #150410 (0.80) | #ff8fe8 (1.35) | #ff4fd8 | #ffa8ef | +105° / 1.05 | #ffd9f6 |
| **Halycon Vector** | pale ice serenity | #000000 | #050b0e (36–120) | #cfeeff / #0a1418 (1.10) | #eafcff (1.85) | #aee6ff | #eafcff | −15° / 0.55 | #f4fbff |
| **Delta Wood** | river teal, wet light | #000000 | #02100e (30–102) | #4ec9bb / #03120e (0.85) | #9ffce8 (1.40) | #00ffd0 | #8ffcf0 | −32° / 1.10 | #d8fff4 |
| **Best Willow** | willow chartreuse, pollen light | #000000 | #080c02 (30–100) | #a4d65e / #101602 (0.85) | #d9ff8f (1.45) | #b6ff2e | #e2ffa8 | −125° / 1.00 | #f0ffd2 |
| **Plain View** | plain silver — no hue at all | #000000 | #050505 (32–108) | #cfd8dc / #0c0e10 (0.95) | #f2f2f2 (1.70) | #e8e8e8 | #9fb6c9 | 0° / 0.12 | #f5f5f5 |
| **Trust Fall** | crimson dark, the drop | #000000 | #0d0206 (28–92) | #d65e7a / #150308 (0.75) | #ff5c7a (1.30) | #ff2e63 | #ff8fab | +140° / 1.05 | #ffd9e0 |

Ground/block tint range, per realm: the atlas hue-rotate re-skins
every tile (grass, stone, wood, leaf, ash, ember…) around the base
blue register (≈210°), and the material tint multiplies on top —
the pair is each realm's ground range. Fog colors and accents are
all distinct across the ten (unit-tested); no two realms share a
fog color, an accent, or a hue angle (except Plain View, whose
departure is precisely the absence of hue: saturation 0.12).

**Reachability, stated plainly:** in the current game only Nova
Prime and Ashfall Haven are open (`open: true` in REALMS); the
other eight are named and shut, as they were in v5. This pass gives
all ten their palettes and portal views the moment they are
entered, but does not open them — which tunes lead to which shut
realm is a travel-design decision this order did not specify.
