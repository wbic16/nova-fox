// ---------- the ship log: recent builds, as shipped (W-5) ----------
// The start screen's "Recent builds" panel is a read-only view of
// SHIP_LOG — the rows build3.py bakes in from SHIPLOG.md, the repo
// source of record. The log players see is the log that shipped
// them: no fetching, no chart traffic, nothing written. These are
// the pure pieces (the roadmapSplit idiom): validate the rows,
// newest first, cap the headline, letter a row for display. A row
// is { ee, name, note } — ee is the epoch the build shipped within,
// and ee 0 is the build being made itself ("this" in SHIPLOG.md),
// whose line takes the running build's own stamp at display time.

// How many ships the panel headlines. The source keeps every row;
// older ships rest below the cap, one scroll of the panel away.
export const SHIPLOG_MAX = 8;

function shipLogValid(row) {
  return !!row && Number.isInteger(row.ee) && row.ee >= 0 &&
    typeof row.name === "string" && row.name.length > 0 &&
    typeof row.note === "string" && row.note.length > 0;
}

// The rows of the log, newest first. The build being made (ee 0)
// stands at the head whatever its stamp will be; the rest order by
// epoch, highest first. Rows that are not rows are dropped — a
// malformed line in the source must never reach the panel.
export function shipLogRows(log) {
  const rows = (Array.isArray(log) ? log : []).filter(shipLogValid);
  return rows.sort((a, b) =>
    (b.ee === 0) - (a.ee === 0) || b.ee - a.ee);
}

// The headline: the newest SHIPLOG_MAX ships.
export function shipLogHeadline(log) {
  return shipLogRows(log).slice(0, SHIPLOG_MAX);
}

// One row lettered for the panel: "EE 1081 · demo41 · <the line>".
// The build being made shows the running build's own epoch — the
// same number the title's version row shows — or, before any stamp
// exists, simply "this build".
export function shipLogLine(row, currentEE) {
  if (!shipLogValid(row)) return "";
  const cur = Number(currentEE) || 0;
  const head = row.ee > 0 ? `EE ${row.ee}`
    : cur > 0 ? `EE ${cur}` : "this build";
  return `${head} · ${row.name} · ${row.note}`;
}
