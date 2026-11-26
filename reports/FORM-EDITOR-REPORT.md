# Nova Fox demo6 — Form Editor Build Report (recovery + verification pass)

EE 961 · 2026-11-26 · Recovery pass: the original builder ended
without delivering this report. Everything below was established
from the tree itself — code read, suites run, measurements taken —
not from the builder's notes. Not staged, not deployed.

**Deliverable:** [demo6/index.html](sandbox://workspace/nova-fox/demo6/index.html) —
4,994,637 bytes, sha256
`2815e809e4480cc425fe9ee8b74704f34c1f5323fb6719acacbd327525292310`

**Build integrity:** a faithful rebuild from the tree's sources
(build3.py, with the narration audio and intro film it reads from
the parent directory) reproduces the shipped index.html
**byte-for-byte** — same sha256. The built file is exactly what
the sources say; nothing is stale, and this pass changed no code:
every brief item was found present and working.

## Verdict by requirement (Will's rulings, 2026-11-26 14:50–14:53 CST)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | In-game editor for customizable player forms | **Present** | A surface of the board panel (page3.html `#form-*`; glue in game3.js from line 3331). E2E: "the editor lives in the board, open in-game, with a starter form loaded" — ok |
| 2 | A form is written as phext; baseline ≤ 4 KB | **Present** | forms.js `parseForm` / `formStanding`; `capBaselineBytes: 4096`, counted in UTF-8 bytes, not characters |
| 3 | Renders within a player-sized bounding box | **Present** | Box is 120 × 360 form units = the fox's own 0.6 × 1.8 world units at 200 units/unit. Fit is a property of each frame's *rendered bounds*, never of the text |
| 4 | Frames live at neighboring phext coordinates | **Present** | Layout below. Frames step along the scroll coordinate in order; a scroll outside the neighborhood is set aside with a named warning, its bytes still counted |
| 5 | Template types selectable per form page; mixed types play as one animation | **Present** | Four types: `svg`, `bitmap`, `turtle`, `shapes`. Each page declares its own `type:`; the editor's per-page selector swaps in that type's starter. Unit + e2e: a mixed svg+bitmap+turtle form parses and steps as one looping animation |
| 6 | SVG frames allowed and sanitized — script never executes | **Present, two walls** | `sanitizeSvg` strips script and every other banned element (foreignObject, iframe, object, embed, form, animate, set…), all `on*=` handlers, non-fragment hrefs, `javascript:`, doctype/ENTITY, and style `url()`/`expression()`. Second wall: sanitized SVG is only ever drawn as an `<img>` (data URI), a context where SVG cannot run code at all. E2E wears a script-bearing SVG and verifies after a second that nothing executed |
| 7 | Limits tunable, with leeway: warn at the 4 KB baseline, refuse only at the experimental ceiling; no-script is NOT part of the leeway | **Present** | All limits are named parameters in one place (`FORM_LIMITS`). Baseline → clean; past baseline, inside ceiling → applies with a warning; past ceiling → refused at every gate (editor hard-stop on input, Apply disabled, loader drops it, chart marks it refused). The sanitizer runs at every size — leeway is about bytes and fit only |
| 8 | Live size meter | **Present** | The meter reads "N bytes of phext — the ruled line is 4,096, the leeway's ceiling 65,536" and colors itself warn/over as the text crosses the lines, on every keystroke |
| 9 | Preview in the box, per-frame fit check | **Present** | The preview canvas draws the leeway stage edge (dashed amber) and the ruled box (solid cyan); the frame line names the frame, its type, its coordinate, and its oversize factor when in the leeway. The status line names a frame that spills past the ceiling, with the factor it needs |
| 10 | Apply / persist with the game's save discipline | **Present** | Apply → gated state in localStorage (`nova-phox-form`, loaded back through the same gate) → the worn phext also rides in the game's save copy (`saveFileContents()`), and a loaded copy's form passes the gate before it is worn (older copies simply carry none) |
| 11 | Publish via the gateway | **Present** | Apply queues `form\|<name>\|<ts>\|<base64 of the phext>` to the forms scroll **1.1.1/1.1.5/1.1.1** through the same token-flushed outbox the purchases use; the board reads the scroll back (`/api/v2/select` → `parseFormChart`) and lists who wears what, naming refusals instead of rendering them. Clear queues a `formoff\|` line |
| 12 | Port of demo5's final versioning: `NF_SHIP_EE` exactly once + always-on EE readout | **Present — the final form** | Diffed against demo5 @ 98207789…: the stamp token `NF_SHIP_EE:950` occurs exactly once; `#ee-line` stands on the title row (`#titlerow`), populated from the stamp, carries no `.opt` class and is untouched by the extras rule (`body:not(.extras) .opt`); the `#vertip` hover reading is intact. Only line offsets differ |
| 13 | Portal fix (demo7) | **Absent — as expected** | demo6 predates it by design: game3.js:2620 still carries the old crossing trigger (`dist2 < 1.25`). Not ported; the ship step must merge demo7's fix forward |

## The form phext layout, as built

A form is a small phext living in one coordinate neighborhood —
its own corner of the multiverse, written as text: a line that is
exactly a coordinate opens that scroll; the lines after it, until
the next coordinate line, are that scroll's content.

```
1.1.1/1.1.1/1.1.1   the head: name:, step: (ms per frame,
                    clamped 40–2000), palette: overrides.
                    Not a picture.
1.1.1/1.1.1/1.1.2   frame 1
1.1.1/1.1.1/1.1.3   frame 2
...                 frames step along the scroll coordinate,
                    in coordinate order (not writing order)
```

Each frame scroll declares its template type on a `type:` line;
the renderer dispatches on it:

- **svg** — a full `<svg>` picture; its coordinates are form
  units; natural size from width/height, else the viewBox, else
  the box. Sanitized, drawn as an image.
- **bitmap** — rows of palette keys (`.` transparent, `0-9a-f`
  the 16-color palette), one character a pixel, a cell 10 form
  units: a 12 × 36 grid is exactly the ruled box. The editor
  offers a click-to-paint grid for this type.
- **turtle** — short commands (`F/B n`, `L/R a`, `U/D`, `J x y`,
  `C c`, `W n`, `H`, `;` comments) compiled deterministically to
  segments and bounds. Data, never code.
- **shapes** — one shape a line (`circle`, `rect`, `tri`,
  `star`, each ending in a color): the type a player can write
  without learning anything first.

Animation is the form walking its own neighborhood: frame index
= floor(t / step) mod n, mixed types indifferent. In the world,
the worn form is a sprite at the fox's position, sized by the
leeway the form actually uses (`worldScale` = its worst frame
need, capped at the ceiling); frames are rasterized once and
cached (≤ 6 forms), so a heavy form pays at apply time, never
per step. First-person design: the sprite stands aside when the
fox's own eye is near, so it never blocks the view.

On the shared chart, forms live on the forms scroll
**1.1.1/1.1.5/1.1.1** — the fifth scroll in the row with the
inscription log (…1.1.1), the leaderboard (…1.1.2), the purchase
record (…1.1.3), and the economy ledger (…1.1.4). One line per
wearing: `form|<name>|<ts>|<base64>`; the latest line for a name
is that fox's standing form, and anything arriving is loaded
through the same gate before it is rendered anywhere.

## The limits experiment

Shipped experimental defaults (the generous end of the brief's
leeway, awaiting Will's ratification or pullback):

- **Bytes:** ceiling **65,536 B** — 16× the ruled 4 KB baseline.
- **Box:** scale ceiling **1.5×** player size.

Measured costs (this pass; node figures are medians of 15 runs
of forms.js itself; browser figures are the build's own
`NOVA_FOX3.formBench` handle under headless SwiftShader on a
heavily loaded box — read them as upper bounds):

| Form | Frames | Parse (node) | Standing (node) | Parse (browser) | Rasterize all frames (browser, one-time) |
|---|---|---|---|---|---|
| ~4 KB bitmap (baseline) | 14 | 0.10 ms | 0.19 ms | — | — |
| ~16 KB bitmap | 60–61 | 0.50 ms | 1.84 ms | 5.5 ms | 113 ms (~1.9 ms/frame) |
| ~65 KB bitmap (ceiling) | 243–244 | 7.69 ms | 2.96 ms | 7.9 ms | 704 ms (~2.9 ms/frame) |
| SVG starter (1,960 B) | 3 | — | — | 3.6 ms | 486 ms (async `<img>` decode dominates) |

- Parse and fit stay in single-digit milliseconds even at the
  ceiling. The ceiling's real price is **canvas memory**, which
  scales with frames × frame area: the stage canvas is
  360 × 1080 px ≈ 1.48 MiB; a box-sized bitmap frame rasterizes
  to 240 × 360 px ≈ 0.33 MiB, so a 64 KB bitmap form's ~244
  frames are ≈ 80 MiB of canvases in the worst case; an SVG
  frame is capped at 720 × 2160 px ≈ 5.93 MiB. That memory curve
  — not parse time — is the number to weigh at ratification.
- A ceiling-sized form also puts an 87,324-byte base64 line on
  the forms scroll (65,491 B of phext), flushed under the
  gateway's existing rate budget like any chart write.
- Box ladder, verified: a frame needing 1.0× stands at the
  baseline; 1.25× and 1.5× stand in the leeway (1.5× exactly at
  its edge); 1.51× is refused. `worldScale` follows the need up
  to the ceiling and no further.

## Tests — real counts

- **Unit (test3.mjs): 254 passed, 0 failed** — run twice, same
  result. Demo5's baseline was 210; the +44 are the forms checks
  (limits at/inside/past both lines, layout, all four types,
  sanitizer, mixed animation, state and chart round-trips,
  refusal paths).
- **E2E, forms section (the suite's own section, run verbatim
  standalone on a private CDP port): 13 passed, 1 failed,
  0 console errors.** The one failure — "the worn form animates
  in-world, frame 0 -> 0" — was investigated and is **not a
  build defect**: the check samples the frame index twice in
  quick succession, and a direct probe shows the index advancing
  over time (0 → 1 across ~2 s of wall clock; the sprite is
  correctly hidden from the fox's own first-person eye). Under
  this box's load the game clock runs at a small fraction of
  real time, so two close samples land in the same step.
- **E2E, full suite: not completed in this environment — stated
  plainly.** Five attempts were made. The first (shared CDP
  port 9335) aborted at check 27 when a sibling tree's harness
  navigated the shared port's page — the known shared-port
  failure, since documented in demo14's harness and the reason
  sibling trees moved to private ports. Four attempts on a
  private port (9417) were each cut short or cascaded by the
  box itself: load average 11–16 on 1.5 shared CPUs with up to
  ~11 sibling e2e suites running at once; the game clock ran at
  a fraction of real time (the walk leg covered 2.18–6.58 units
  against its 7.5 threshold), so the movement/guide cascade
  failed downstream of it, and two attempts lost the renderer/
  session outright mid-run. Best partial: 100 checks ok before
  the session died in the touch section. The failures observed
  were that cascade plus the known touch-emulation legs
  (demo5's baseline: 126 passed / 7 failed / 0 console errors,
  recorded on a quieter box). **No forms-attributable failure
  appeared in any attempt.** A quiet-box full-suite run of
  demo6 remains outstanding and should be taken before demo6
  ships anywhere.

## Still open

- The experimental ceilings (65,536 B / 1.5×) are shipped as
  the brief directed — generous defaults **awaiting Will's
  ratification or pullback**, with the canvas-memory curve
  above as the cost to weigh.
- The gateway publish path is wired and verified locally
  (outbox discipline, chart line format, read-back parse, all
  unit/e2e-covered); a live phext.tech round-trip of a form
  line was not exercised in this pass — from file:// with no
  login, lines wait in the outbox exactly as purchase lines do.
- demo6 does not contain the demo7 portal fix (expected), the
  idea door, or the in-game roadmap — those are the dev loop's
  pipeline, to be reconciled at ship time.
