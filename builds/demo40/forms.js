// ---------- player forms (demo6): a fox is a small phext --------------------
// Will's ruling (2026-11-26): players have customizable forms —
// any description, written as phext, that renders within a
// player-sized bounding box, the description itself at most
// 4 KB of phext. And: "make a player form editor that gives
// them the ability to animate and change their form using
// multiversal phext."
//
// A form IS a phext. Its scrolls live in one coordinate
// neighborhood — the form's own corner of the multiverse:
//
//   1.1.1/1.1.1/1.1.1   the head: name, step (ms per frame),
//                       palette overrides. Not a picture.
//   1.1.1/1.1.1/1.1.2   frame 1
//   1.1.1/1.1.1/1.1.3   frame 2
//   ...                 frames step along the scroll coordinate,
//                       in order. Animation is the form walking
//                       its own neighborhood, one scroll a step.
//
// In the editor (and in the save, and on the shared chart) the
// phext is written as text: a line that is exactly a coordinate
// opens that coordinate's scroll; every line after it, until the
// next coordinate line, is that scroll's content. Each frame
// scroll declares its template type on its first line —
//   type: svg | bitmap | turtle | shapes
// — and the renderer dispatches on it. Types may mix freely
// across the frames of one form; the animation plays them as
// one. A scroll outside the neighborhood is noted and set
// aside (its bytes still count); a frame that does not declare
// a known type is a parse error, named, never guessed at.
//
// THE LIMITS ARE PARAMETERS, NOT CONSTANTS (Will, 2026-11-26:
// "give them a lot of leeway, experiment with higher limits").
// The ruled baseline is 4 KB of phext and a box of exactly
// player size. The shipped build carries experimental ceilings
// above both, measured in FORM-EDITOR-REPORT.md. Enforcement is
// leeway-shaped: inside the baseline, clean; past the baseline
// but inside the ceiling, the form wears a warning and still
// applies; past the ceiling, refused — the editor will not hold
// more, the loader will not load more, however a form arrives.
//
// THE ONE ABSOLUTE: form content is picture, never program.
// SVG frames are sanitized on load (script and every other
// active surface stripped — see sanitizeSvg) and are only ever
// drawn as images, a context in which SVG cannot run code at
// all. Turtle, bitmap, and shapes pages are data for their own
// drawing semantics and nothing else. Leeway is about size and
// fit; it is never about executing another player's code.
//
// This module is pure logic — no DOM, no storage, no clock —
// exactly like economy.js. The glue (game3.js) owns the panel,
// the canvases, the sprite, and the chart.

// ---------- the limits: named, tunable, in one place -------------------------
export const FORM_LIMITS = {
  // Will's ruled baseline (2026-11-26): 4 KB of phext, and a
  // player-sized box — the fox's own body is 0.6 x 1.8 world
  // units (HALF 0.3, PHEIGHT 1.8 in game3.js), which at
  // 200 form-units per world unit is 120 x 360.
  capBaselineBytes: 4096,
  boxW: 120,
  boxH: 360,
  boxScaleBaseline: 1,
  // EXPERIMENTAL ceilings (measured in FORM-EDITOR-REPORT.md;
  // shipped generous, awaiting Will's ratification or pullback):
  capCeilingBytes: 65536,   // 16x the ruled cap
  boxScaleCeiling: 1.5,     // a form may stand half again player-sized
  // Animation step: the head scroll may set it; clamped here.
  stepDefaultMs: 240,
  stepMinMs: 40,
  stepMaxMs: 2000,
  // A bitmap cell is 10 form-units: a 12 x 36 grid is exactly
  // the ruled box.
  bitmapCell: 10,
};

export const FORM_TYPES = ["svg", "bitmap", "turtle", "shapes"];
export const FORM_ROOT = "1.1.1/1.1.1/1.1.1";

// The 16-color palette bitmap pages draw with (and turtle /
// shapes pages may name by index). "." on a bitmap page is
// transparent; the digits and letters are these, in order.
export const FORM_PALETTE = [
  "#12263f", "#00d9ff", "#00a3ff", "#2f7fe0",
  "#7fd8ff", "#d8f1ff", "#ffb84d", "#ff7847",
  "#ff4757", "#ff6b9d", "#b06bff", "#5fe8d8",
  "#3ddc84", "#a9bcdc", "#5f7194", "#ffffff",
];
const PALETTE_KEYS = "0123456789abcdef";

// ---------- bytes -------------------------------------------------------------
// The cap is on BYTES of phext, not characters — a fox drawn in
// a wide alphabet pays for its width honestly.
const _formEnc = new TextEncoder();
export function formByteLength(text) { return _formEnc.encode(String(text)).length; }

// ---------- base64 (for the chart line; no dependencies) -----------------------
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function b64encodeUtf8(text) {
  const bytes = _formEnc.encode(String(text));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] || 0, c = bytes[i + 2] || 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[c & 63] : "=";
  }
  return out;
}
export function b64decodeUtf8(b64) {
  const clean = String(b64).replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]), b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2]), d = B64.indexOf(clean[i + 3]);
    if (a < 0 || b < 0) break;
    bytes.push((a << 2) | (b >> 4));
    if (c >= 0) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d >= 0 && c >= 0) bytes.push(((c & 3) << 6) | d);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// ---------- the SVG sanitizer ---------------------------------------------------
// A form received over the shared chart is another player's
// content. The rule is absolute: form SVG is picture, never
// program. This strips every active surface we know how to
// name — script elements, event-handler attributes, javascript:
// and external references, foreign content, doctypes — and the
// renderer adds the second wall: the sanitized markup is only
// ever drawn as an <img>, where SVG cannot execute at all.
// What survives is drawing: shapes, paths, gradients, fills.
const SVG_BANNED_ELEMENTS = [
  "script", "foreignObject", "iframe", "object", "embed",
  "link", "meta", "base", "form", "input", "button", "a",
  "animate", "set", "handler", "listener",
];
export function sanitizeSvg(svg) {
  let s = String(svg);
  // Doctype / entity declarations: an XXE has no business in a fox.
  s = s.replace(/<!DOCTYPE[\s\S]*?>/gi, "");
  s = s.replace(/<!ENTITY[\s\S]*?>/gi, "");
  s = s.replace(/<\?[\s\S]*?\?>/g, "");
  // Banned elements, with their contents where they wrap any.
  for (const el of SVG_BANNED_ELEMENTS) {
    s = s.replace(new RegExp(`<${el}\\b[^>]*>[\\s\\S]*?<\\/${el}\\s*>`, "gi"), "");
    s = s.replace(new RegExp(`<${el}\\b[^>]*\\/?>`, "gi"), "");
  }
  // Event-handler attributes (onclick, onload, ...) — any on*=.
  s = s.replace(/\son[a-zA-Z]+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\son[a-zA-Z]+\s*=\s*'[^']*'/gi, "");
  s = s.replace(/\son[a-zA-Z]+\s*=\s*[^\s>]+/gi, "");
  // References: only same-picture fragments (#id) may be named.
  // Anything else — http:, data:, javascript:, a file — goes.
  s = s.replace(/\b(xlink:href|href)\s*=\s*"([^"]*)"/gi,
    (m, a, v) => (/^\s*#/.test(v) ? m : `${a}=""`));
  s = s.replace(/\b(xlink:href|href)\s*=\s*'([^']*)'/gi,
    (m, a, v) => (/^\s*#/.test(v) ? m : `${a}=''`));
  s = s.replace(/javascript\s*:/gi, "");
  // Styles: url() and expression() are doors; shut them.
  s = s.replace(/\bstyle\s*=\s*"[^"]*"/gi,
    (m) => (/url\s*\(|expression|javascript/i.test(m) ? "" : m));
  s = s.replace(/\bstyle\s*=\s*'[^']*'/gi,
    (m) => (/url\s*\(|expression|javascript/i.test(m) ? "" : m));
  return s;
}
// The natural size of an SVG frame, in form units: the declared
// width/height if it carries them, else its viewBox. In this
// editor an SVG's coordinates ARE form units — the starter
// page's viewBox is the box itself — so a picture drawn on a
// 1000-unit canvas is a 1000-unit picture, and the fit check
// will say so. No size at all: it takes the box as its canvas.
export function svgNaturalSize(svg) {
  // Only the opening <svg> tag speaks for the picture's size —
  // a rect inside it has a width of its own, and it is not the
  // frame's.
  const tag = /<svg\b[^>]*>/i.exec(String(svg));
  const s = tag ? tag[0] : "";
  const num = (v) => {
    const n = parseFloat(String(v).replace(/px\s*$/, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const wm = /\bwidth\s*=\s*"([^"]+)"/.exec(s) || /\bwidth\s*=\s*'([^']+)'/.exec(s);
  const hm = /\bheight\s*=\s*"([^"]+)"/.exec(s) || /\bheight\s*=\s*'([^']+)'/.exec(s);
  if (wm && hm) {
    const w = num(wm[1]), h = num(hm[1]);
    if (w && h) return { w, h };
  }
  const vb = /\bviewBox\s*=\s*"([^"]+)"/.exec(s) || /\bviewBox\s*=\s*'([^']+)'/.exec(s);
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/).map(Number);
    if (p.length === 4 && p[2] > 0 && p[3] > 0) return { w: p[2], h: p[3] };
  }
  return { w: FORM_LIMITS.boxW, h: FORM_LIMITS.boxH };
}

// ---------- turtle: a page of short commands draws the frame -------------------
// Turtle space: x right, y up, home is (0, 0), heading starts
// pointing up. Commands, case-insensitive, several to a line,
// ";" begins a comment:
//   F n / B n    forward / back n units
//   L a / R a    turn left / right a degrees
//   U / D        pen up / pen down
//   J x y        jump (pen lifted) to a point
//   C c          color: a palette key (0-9a-f) or #rgb / #rrggbb
//   W n          stroke width 1..12
//   H            home again
// The simulation is deterministic and total: a page compiles
// to a list of segments and their bounds, here, with no canvas
// anywhere near it. Data, never code.
function turtleColor(tok, palette) {
  if (/^#[0-9a-fA-F]{3}$/.test(tok) || /^#[0-9a-fA-F]{6}$/.test(tok)) return tok;
  const i = PALETTE_KEYS.indexOf(String(tok).toLowerCase());
  return i >= 0 ? palette[i] : null;
}
export function compileTurtle(lines, palette) {
  let x = 0, y = 0, heading = 90, pen = true, color = palette[5], width = 3;
  const segments = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const note = (sx, sy, ex, ey, w) => {
    const p = w / 2;
    minX = Math.min(minX, sx - p, ex - p); maxX = Math.max(maxX, sx + p, ex + p);
    minY = Math.min(minY, sy - p, ey - p); maxY = Math.max(maxY, sy + p, ey + p);
  };
  const errors = [];
  const tokens = [];
  for (const raw of lines) {
    const line = String(raw).split(";")[0];
    for (const t of line.split(/\s+/)) if (t) tokens.push(t);
  }
  const numAt = (i) => {
    const v = Number(tokens[i]);
    return Number.isFinite(v) ? Math.max(-10000, Math.min(10000, v)) : null;
  };
  for (let i = 0; i < tokens.length; i++) {
    const cmd = tokens[i].toUpperCase();
    if (cmd === "F" || cmd === "B") {
      const n = numAt(++i);
      if (n === null) { errors.push(`turtle: "${cmd}" wants a number`); continue; }
      const d = cmd === "F" ? n : -n;
      const rad = (heading * Math.PI) / 180;
      const nx = x + d * Math.cos(rad), ny = y + d * Math.sin(rad);
      if (pen && d !== 0) {
        segments.push({ x1: x, y1: y, x2: nx, y2: ny, color, width });
        note(x, y, nx, ny, width);
        if (segments.length > 4096) { errors.push("turtle: too many strokes (4096)"); break; }
      }
      x = nx; y = ny;
    } else if (cmd === "L" || cmd === "R") {
      const a = numAt(++i);
      if (a === null) { errors.push(`turtle: "${cmd}" wants a number`); continue; }
      heading += cmd === "L" ? a : -a;
    } else if (cmd === "U") pen = false;
    else if (cmd === "D") pen = true;
    else if (cmd === "H") { x = 0; y = 0; heading = 90; }
    else if (cmd === "J") {
      const jx = numAt(++i), jy = numAt(i + 1); i++;
      if (jx === null || jy === null) { errors.push("turtle: \"J\" wants two numbers"); continue; }
      x = jx; y = jy;
    } else if (cmd === "C") {
      const c = turtleColor(tokens[++i] || "", palette);
      if (c === null) { errors.push(`turtle: unknown color "${tokens[i]}"`); continue; }
      color = c;
    } else if (cmd === "W") {
      const w = numAt(++i);
      if (w === null) { errors.push("turtle: \"W\" wants a number"); continue; }
      width = Math.max(1, Math.min(12, w));
    } else {
      errors.push(`turtle: I don't know "${tokens[i]}"`);
    }
  }
  const bounds = segments.length
    ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    : { x: 0, y: 0, w: 0, h: 0 };
  return { segments, bounds, errors };
}

// ---------- shapes: nouns and numbers ------------------------------------------
// The simplest page of all: one shape a line, in a page space
// where x runs right and y runs up from the shape-field's own
// floor. circle cx cy r · rect x y w h · tri x1 y1 x2 y2 x3 y3 ·
// star cx cy r points — each ending in a color (palette key or
// #hex). No state, no sequence: the whole page is the picture,
// readable at a glance. That is the entire justification for a
// fourth type: it is the only one a player can write without
// learning anything first.
export function compileShapes(lines, palette) {
  const shapes = [];
  const errors = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x0, y0, x1, y1) => {
    minX = Math.min(minX, x0); minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1); maxY = Math.max(maxY, y1);
  };
  for (const raw of lines) {
    const line = String(raw).split(";")[0].trim();
    if (!line) continue;
    const t = line.split(/\s+/);
    const kind = t[0].toLowerCase();
    const color = turtleColor(t[t.length - 1] || "", palette);
    const nums = t.slice(1, -1).map(Number);
    if (color === null) { errors.push(`shapes: "${line}" ends in no color I know`); continue; }
    if (nums.some((n) => !Number.isFinite(n))) { errors.push(`shapes: "${line}" has a number I can't read`); continue; }
    if (kind === "circle" && nums.length === 3) {
      const [cx, cy, r] = nums;
      shapes.push({ kind, cx, cy, r, color }); grow(cx - r, cy - r, cx + r, cy + r);
    } else if (kind === "rect" && nums.length === 4) {
      const [x, y, w, h] = nums;
      shapes.push({ kind, x, y, w, h, color }); grow(x, y, x + w, y + h);
    } else if (kind === "tri" && nums.length === 6) {
      shapes.push({ kind, pts: nums, color });
      grow(Math.min(nums[0], nums[2], nums[4]), Math.min(nums[1], nums[3], nums[5]),
           Math.max(nums[0], nums[2], nums[4]), Math.max(nums[1], nums[3], nums[5]));
    } else if (kind === "star" && nums.length === 4) {
      const [cx, cy, r, n] = nums;
      shapes.push({ kind, cx, cy, r, points: Math.max(3, Math.min(12, Math.round(n))), color });
      grow(cx - r, cy - r, cx + r, cy + r);
    } else {
      errors.push(`shapes: I don't know "${line}"`);
    }
  }
  const bounds = shapes.length
    ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    : { x: 0, y: 0, w: 0, h: 0 };
  return { shapes, bounds, errors };
}

// ---------- bitmap: rows of palette keys ----------------------------------------
// One character a pixel: "." is transparent, 0-9a-f are the
// palette. A row is a line; the picture is the stack of rows,
// first row at the top. Few bytes a picture — a 12 x 18 fox is
// 234 characters of phext, grid and all.
export function compileBitmap(lines) {
  const rows = [];
  const errors = [];
  let cols = 0;
  for (const raw of lines) {
    const row = String(raw).trim();
    if (!row) continue;
    if (!/^[.0-9a-fA-F]+$/.test(row)) {
      errors.push(`bitmap: the row "${row.slice(0, 24)}" has a mark that isn't a palette key`);
      continue;
    }
    rows.push(row.toLowerCase());
    cols = Math.max(cols, row.length);
  }
  return {
    rows, cols, rowCount: rows.length,
    w: cols * FORM_LIMITS.bitmapCell,
    h: rows.length * FORM_LIMITS.bitmapCell,
    errors,
  };
}

// ---------- the parse ------------------------------------------------------------
// parseForm never throws. It returns the head, the compiled
// frames in coordinate order, every error with its coordinate
// attached, and the form's standing against the limits.
const COORD_LINE = /^\s*(\d+)\.(\d+)\.(\d+)\/(\d+)\.(\d+)\.(\d+)\/(\d+)\.(\d+)\.(\d+)\s*$/;
export function splitScrolls(text) {
  const scrolls = [];
  let cur = null;
  for (const line of String(text).split(/\r?\n/)) {
    const m = COORD_LINE.exec(line);
    if (m) {
      cur = { coord: `${+m[1]}.${+m[2]}.${+m[3]}/${+m[4]}.${+m[5]}.${+m[6]}/${+m[7]}.${+m[8]}.${+m[9]}`,
              parts: m.slice(1).map(Number), lines: [] };
      scrolls.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  for (const s of scrolls) {
    while (s.lines.length && s.lines[s.lines.length - 1].trim() === "") s.lines.pop();
    while (s.lines.length && s.lines[0].trim() === "") s.lines.shift();
  }
  return scrolls;
}
function parsePalette(headLines, errors) {
  const palette = [...FORM_PALETTE];
  for (const raw of headLines) {
    const m = /^\s*palette\s*:\s*(.+)$/i.exec(raw);
    if (!m) continue;
    for (const pair of m[1].split(",")) {
      const pm = /^\s*([0-9a-fA-F])\s*=\s*(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)\s*$/.exec(pair);
      if (pm) palette[PALETTE_KEYS.indexOf(pm[1].toLowerCase())] = pm[2];
      else errors.push(`the palette line names "${pair.trim()}", which I can't read`);
    }
  }
  return palette;
}
export function parseForm(text, limits = FORM_LIMITS) {
  const out = {
    ok: false, errors: [], warnings: [],
    name: "", stepMs: limits.stepDefaultMs,
    palette: [...FORM_PALETTE], frames: [],
    bytes: formByteLength(text ?? ""),
    stray: 0,
  };
  if (typeof text !== "string" || text.trim() === "") {
    out.errors.push("the form is empty — an empty editor is no form at all");
    return out;
  }
  const scrolls = splitScrolls(text);
  if (!scrolls.length) {
    out.errors.push("no scrolls: a form begins with its coordinate — 1.1.1/1.1.1/1.1.1");
    return out;
  }
  const head = scrolls.find((s) => s.coord === FORM_ROOT);
  if (!head) {
    out.errors.push(`the head scroll is missing — a form begins at ${FORM_ROOT}`);
    return out;
  }
  for (const raw of head.lines) {
    const nm = /^\s*name\s*:\s*(.+)$/i.exec(raw);
    if (nm) out.name = nm[1].trim().slice(0, 40);
    const sm = /^\s*step\s*:\s*(\d+)\s*$/i.exec(raw);
    if (sm) {
      out.stepMs = Math.max(limits.stepMinMs, Math.min(limits.stepMaxMs, +sm[1]));
    }
  }
  out.palette = parsePalette(head.lines, out.errors);
  // Frames: the root's own neighborhood — every dimension of
  // the coordinate equal to the head's, stepping only along
  // the last (the scroll number, parts[8]).
  const frameScrolls = [];
  for (const s of scrolls) {
    if (s === head) continue;
    const sameCorner = s.parts.slice(0, 8).every((p, i) => p === head.parts[i]);
    if (sameCorner && s.parts[8] >= 2) {
      frameScrolls.push({ s, sc: s.parts[8] });
    } else {
      out.stray++;
      out.warnings.push(`${s.coord} lives outside the form's neighborhood — set aside, though its bytes still count`);
    }
  }
  frameScrolls.sort((a, b) => a.sc - b.sc);
  if (!frameScrolls.length) {
    out.errors.push("the form has no frames — give it at least one page, at 1.1.1/1.1.1/1.1.2");
    return out;
  }
  for (const { s } of frameScrolls) {
    const frame = { coord: s.coord, type: null, errors: [] };
    const typeLine = s.lines.findIndex((l) => /^\s*type\s*:/i.test(l));
    if (typeLine < 0) {
      frame.errors.push(`${s.coord}: this page doesn't say its type — begin it with "type: svg", "type: bitmap", "type: turtle", or "type: shapes"`);
      out.frames.push(frame);
      continue;
    }
    const type = /^\s*type\s*:\s*(\w+)\s*$/i.exec(s.lines[typeLine])[1].toLowerCase();
    const content = s.lines.slice(typeLine + 1);
    frame.type = type;
    if (type === "svg") {
      const raw = content.join("\n").trim();
      if (!/<svg[\s>]/i.test(raw)) {
        frame.errors.push(`${s.coord}: this page says svg, but carries no <svg> picture`);
      } else {
        frame.svg = sanitizeSvg(raw);
        const { w, h } = svgNaturalSize(raw);
        frame.bounds = { x: 0, y: 0, w, h };
      }
    } else if (type === "bitmap") {
      const bmp = compileBitmap(content);
      frame.rows = bmp.rows; frame.cols = bmp.cols; frame.rowCount = bmp.rowCount;
      frame.bounds = { x: 0, y: 0, w: bmp.w, h: bmp.h };
      frame.errors.push(...bmp.errors.map((e) => `${s.coord}: ${e}`));
    } else if (type === "turtle") {
      const tur = compileTurtle(content, out.palette);
      frame.segments = tur.segments;
      frame.bounds = tur.bounds;
      frame.errors.push(...tur.errors.map((e) => `${s.coord}: ${e}`));
    } else if (type === "shapes") {
      const shp = compileShapes(content, out.palette);
      frame.shapes = shp.shapes;
      frame.bounds = shp.bounds;
      frame.errors.push(...shp.errors.map((e) => `${s.coord}: ${e}`));
    } else {
      frame.errors.push(`${s.coord}: "${type}" is not a template I know — svg, bitmap, turtle, or shapes`);
    }
    out.frames.push(frame);
  }
  out.errors.push(...out.frames.flatMap((f) => f.errors));
  out.ok = out.errors.length === 0;
  return out;
}

// ---------- fit: the render against the box --------------------------------------
// Fit is a property of the RENDER, never of the text: each
// frame's drawn bounds are measured against the box. The scale
// a frame needs is the larger of its width and height ratios;
// at or under the baseline scale it stands inside the ruled
// lines, at or under the ceiling scale it stands in the
// leeway, past that it does not stand at all.
export function frameNeed(frame, limits = FORM_LIMITS) {
  if (!frame || !frame.bounds) return Infinity;
  return Math.max(frame.bounds.w / limits.boxW, frame.bounds.h / limits.boxH);
}
export function formFit(parsed, limits = FORM_LIMITS) {
  const frames = (parsed.frames || []).map((f, i) => {
    const need = frameNeed(f, limits);
    return {
      index: i, coord: f.coord, need,
      fitsBaseline: need <= limits.boxScaleBaseline,
      fitsCeiling: need <= limits.boxScaleCeiling,
    };
  });
  return {
    frames,
    ok: frames.length > 0 && frames.every((f) => f.fitsCeiling),
    leeway: frames.some((f) => !f.fitsBaseline),
    worstNeed: frames.length ? Math.max(...frames.map((f) => f.need)) : Infinity,
  };
}
// A form's whole standing: bytes and fit together, each judged
// baseline / leeway / refused. This is the one gate every path
// — editor, save, chart — loads through.
export function formStanding(text, limits = FORM_LIMITS) {
  const bytes = formByteLength(text ?? "");
  const cap = bytes <= limits.capBaselineBytes ? "baseline"
    : bytes <= limits.capCeilingBytes ? "leeway" : "over";
  const parsed = parseForm(text, limits);
  const fit = formFit(parsed, limits);
  const refused = cap === "over" || !parsed.ok || !fit.ok;
  return {
    bytes, cap, parsed, fit, refused,
    leeway: cap === "leeway" || fit.leeway,
    // The world-space size the worn form stands at: the box,
    // grown only as far as the leeway the form actually uses.
    worldScale: Math.max(1, Math.min(limits.boxScaleCeiling, fit.worstNeed || 1)),
  };
}
// The animation: frame index at a moment, looping the
// neighborhood walk. Mixed types are just frames; the walk
// does not care what a page is made of.
export function frameIndexAt(parsed, tMs) {
  const n = parsed.frames.length;
  if (!n) return 0;
  return Math.floor(Math.max(0, tMs) / parsed.stepMs) % n;
}

// ---------- state: the worn form, with demo4's ledger discipline -----------------
export function newFormState() {
  return { v: 1, text: null, appliedAt: 0, publishedAt: 0 };
}
// Loading a form — from a save, from this machine, from the
// chart — is loading a stranger's phext: it is clamped through
// the same gate as the editor's Apply. Over the ceiling,
// unparseable, or a frame that does not fit: it is not worn
// and not rendered. It is simply not a form this build will
// stand behind, and nothing about the refusal is silent in the
// places that report it.
export function loadFormState(raw, limits = FORM_LIMITS) {
  const s = newFormState();
  if (!raw || typeof raw !== "object") return s;
  if (typeof raw.text === "string" && raw.text.trim() !== "") {
    if (!formStanding(raw.text, limits).refused) {
      s.text = raw.text;
      s.appliedAt = Number.isFinite(+raw.appliedAt) ? +raw.appliedAt : 0;
      s.publishedAt = Number.isFinite(+raw.publishedAt) ? +raw.publishedAt : 0;
    }
  }
  return s;
}
export function applyForm(state, text, ts, limits = FORM_LIMITS) {
  const standing = formStanding(text, limits);
  if (standing.refused) {
    return { ok: false, reason: standing.cap === "over" ? "cap"
      : !standing.parsed.ok ? "parse" : "fit", standing };
  }
  state.text = text;
  state.appliedAt = ts;
  state.publishedAt = 0;
  return { ok: true, standing };
}
export function clearForm(state) {
  state.text = null;
  state.appliedAt = 0;
  state.publishedAt = 0;
}

// ---------- the shared chart: a form is a fox's public shape ----------------------
// One line per wearing, in the economy ledger's own discipline:
// form|<name>|<ts>|<base64 of the phext>. The latest line for a
// name is that fox's standing form; anything arriving is loaded
// through loadFormState's gate before it is rendered anywhere.
export function formChartLine(name, text, ts) {
  return `form|${name}|${ts}|${b64encodeUtf8(text)}`;
}
export function formOffLine(name, ts) {
  return `formoff|${name}|${ts}`;
}
export function parseFormChart(text, limits = FORM_LIMITS) {
  const byName = new Map();
  for (const line of String(text || "").split("\n")) {
    const off = /^formoff\|([^|]+)\|(\d+)\s*$/.exec(line);
    if (off) {
      const [, name, ts] = off;
      const prev = byName.get(name);
      if (!prev || prev.ts < +ts) byName.set(name, { name, ts: +ts, text: null, refused: false, standing: null });
      continue;
    }
    const m = /^form\|([^|]+)\|(\d+)\|([A-Za-z0-9+/=]+)\s*$/.exec(line);
    if (!m) continue;
    const [, name, ts, b64] = m;
    const prev = byName.get(name);
    if (prev && prev.ts >= +ts) continue;
    let decoded = null;
    try { decoded = b64decodeUtf8(b64); } catch (e) { decoded = null; }
    if (decoded === null) continue;
    const standing = formStanding(decoded, limits);
    byName.set(name, { name, ts: +ts, text: decoded, refused: standing.refused, standing });
  }
  return byName;
}

// ---------- starter pages: one honest example per type ----------------------------
// These are the editor's "start" buttons and the report's
// worked examples — the same texts, so what the report shows
// is what a player gets.
const SVG_FRAME_A = `<svg viewBox="0 0 120 360" xmlns="http://www.w3.org/2000/svg">
<polygon points="30,120 48,30 62,110" fill="#2f7fe0"/>
<polygon points="90,120 72,30 58,110" fill="#2f7fe0"/>
<ellipse cx="60" cy="180" rx="42" ry="52" fill="#2f7fe0"/>
<ellipse cx="60" cy="205" rx="24" ry="30" fill="#d8f1ff"/>
<circle cx="44" cy="168" r="6" fill="#04101e"/>
<circle cx="76" cy="168" r="6" fill="#04101e"/>
<polygon points="52,192 68,192 60,204" fill="#04101e"/>
<path d="M30 250 Q60 300 90 250 L96 330 Q60 352 24 330 Z" fill="#00a3ff"/>
</svg>`;
const SVG_FRAME_B = `<svg viewBox="0 0 120 360" xmlns="http://www.w3.org/2000/svg">
<polygon points="30,110 48,20 62,100" fill="#2f7fe0"/>
<polygon points="90,110 72,20 58,100" fill="#2f7fe0"/>
<ellipse cx="60" cy="172" rx="42" ry="52" fill="#2f7fe0"/>
<ellipse cx="60" cy="197" rx="24" ry="30" fill="#d8f1ff"/>
<circle cx="44" cy="160" r="6" fill="#04101e"/>
<circle cx="76" cy="160" r="6" fill="#04101e"/>
<polygon points="52,184 68,184 60,196" fill="#04101e"/>
<path d="M30 242 Q60 292 90 242 L96 322 Q60 344 24 322 Z" fill="#00a3ff"/>
<circle cx="98" cy="60" r="7" fill="#ffb84d"/>
<circle cx="24" cy="44" r="5" fill="#5fe8d8"/>
</svg>`;
const SVG_FRAME_C = `<svg viewBox="0 0 120 360" xmlns="http://www.w3.org/2000/svg">
<polygon points="30,120 48,30 62,110" fill="#2f7fe0"/>
<polygon points="90,120 72,30 58,110" fill="#2f7fe0"/>
<ellipse cx="60" cy="180" rx="42" ry="52" fill="#2f7fe0"/>
<ellipse cx="60" cy="205" rx="24" ry="30" fill="#d8f1ff"/>
<path d="M38 168 Q44 162 50 168" stroke="#04101e" stroke-width="4" fill="none"/>
<path d="M70 168 Q76 162 82 168" stroke="#04101e" stroke-width="4" fill="none"/>
<polygon points="52,192 68,192 60,204" fill="#04101e"/>
<path d="M30 250 Q60 300 90 250 L96 330 Q60 352 24 330 Z" fill="#00a3ff"/>
<circle cx="98" cy="60" r="5" fill="#5fe8d8"/>
<circle cx="24" cy="44" r="7" fill="#ffb84d"/>
</svg>`;
export const FORM_EXAMPLES = {
  svg: [
    "1.1.1/1.1.1/1.1.1",
    "name: Herald Fox",
    "step: 300",
    "",
    "1.1.1/1.1.1/1.1.2",
    "type: svg",
    SVG_FRAME_A,
    "",
    "1.1.1/1.1.1/1.1.3",
    "type: svg",
    SVG_FRAME_B,
    "",
    "1.1.1/1.1.1/1.1.4",
    "type: svg",
    SVG_FRAME_C,
  ].join("\n"),
  bitmap: [
    "1.1.1/1.1.1/1.1.1",
    "name: Ember Kit",
    "step: 260",
    "",
    "1.1.1/1.1.1/1.1.2",
    "type: bitmap",
    ".3........3.",
    ".33......33.",
    ".333....333.",
    ".3333333333.",
    ".3333333333.",
    ".3553333553.",
    ".3555335553.",
    "..55555555..",
    "...555555...",
    "..66666666..",
    ".6666666666.",
    ".666.666.666",
    ".66..66..66.",
    "..6..66..6..",
    "............",
    "...7....7...",
    "..777..777..",
    "...7....7...",
    "",
    "1.1.1/1.1.1/1.1.3",
    "type: bitmap",
    ".3........3.",
    ".33......33.",
    ".333....333.",
    ".3333333333.",
    ".3333333333.",
    ".3553333553.",
    ".3555335553.",
    "..55555555..",
    "...555555...",
    "..66666666..",
    ".6666666666.",
    ".666.666.666",
    ".66..66..66.",
    "..6..66..6..",
    "............",
    "....7..7....",
    "...777777...",
    "....7..7....",
  ].join("\n"),
  turtle: [
    "1.1.1/1.1.1/1.1.1",
    "name: The Little Comet",
    "step: 220",
    "",
    "1.1.1/1.1.1/1.1.2",
    "type: turtle",
    "; a five-point star, drawn in one walk (the last turn brings the heading home)",
    "C 6 W 5",
    "F 120 R 144 F 120 R 144 F 120 R 144 F 120 R 144 F 120 R 144",
    "U J 0 -170 D C 2 W 3",
    "F 40 R 144 F 40 R 144 F 40 R 144 F 40 R 144 F 40 R 144",
    "",
    "1.1.1/1.1.1/1.1.3",
    "type: turtle",
    "C 7 W 5",
    "F 108 R 144 F 108 R 144 F 108 R 144 F 108 R 144 F 108 R 144",
    "U J 0 -170 D C 4 W 3",
    "F 40 R 144 F 40 R 144 F 40 R 144 F 40 R 144 F 40 R 144",
    "",
    "1.1.1/1.1.1/1.1.4",
    "type: turtle",
    "C b W 5",
    "F 96 R 144 F 96 R 144 F 96 R 144 F 96 R 144 F 96 R 144",
    "U J 0 -170 D C 6 W 3",
    "F 40 R 144 F 40 R 144 F 40 R 144 F 40 R 144 F 40 R 144",
  ].join("\n"),
  shapes: [
    "1.1.1/1.1.1/1.1.1",
    "name: Herald of Circles",
    "step: 300",
    "",
    "1.1.1/1.1.1/1.1.2",
    "type: shapes",
    "tri 10 250 35 330 48 255 3",
    "tri 110 250 85 330 72 255 3",
    "circle 60 215 42 3",
    "circle 60 190 24 5",
    "circle 45 225 5 0",
    "circle 75 225 5 0",
    "rect 25 20 70 120 2",
    "circle 60 80 16 6",
    "",
    "1.1.1/1.1.1/1.1.3",
    "type: shapes",
    "tri 10 240 35 320 48 245 3",
    "tri 110 240 85 320 72 245 3",
    "circle 60 205 42 3",
    "circle 60 180 24 5",
    "circle 45 215 5 0",
    "circle 75 215 5 0",
    "rect 25 20 70 120 2",
    "star 60 80 18 5 6",
  ].join("\n"),
};
// One form, three kinds of page, walking as one animation —
// the mixed example the unit tests and the report both use.
export const FORM_EXAMPLE_MIXED = [
  "1.1.1/1.1.1/1.1.1",
  "name: Three Doors",
  "step: 250",
  "",
  "1.1.1/1.1.1/1.1.2",
  "type: svg",
  SVG_FRAME_A,
  "",
  "1.1.1/1.1.1/1.1.3",
  "type: bitmap",
  ".3........3.",
  ".33......33.",
  ".3333333333.",
  ".3553333553.",
  "..55555555..",
  "...666666...",
  "",
  "1.1.1/1.1.1/1.1.4",
  "type: turtle",
  "C 6 W 5",
  "F 100 R 144 F 100 R 144 F 100 R 144 F 100 R 144 F 100 R 144",
].join("\n");
// A single starter PAGE (not a whole form) for each type — the
// editor's per-page "make it a ..." surface drops one of these
// into the selected page.
export const FORM_PAGE_STARTERS = {
  svg: ["type: svg", SVG_FRAME_A].join("\n"),
  bitmap: [
    "type: bitmap",
    ".3........3.",
    ".33......33.",
    ".3333333333.",
    ".3553333553.",
    "..55555555..",
    "...666666...",
  ].join("\n"),
  turtle: [
    "type: turtle",
    "; the turtle starts at the floor, facing up",
    "C 6 W 5",
    "F 100 R 144 F 100 R 144 F 100 R 144 F 100 R 144 F 100 R 144",
  ].join("\n"),
  shapes: [
    "type: shapes",
    "circle 60 200 40 3",
    "circle 60 180 22 5",
    "star 60 80 16 5 6",
  ].join("\n"),
};
