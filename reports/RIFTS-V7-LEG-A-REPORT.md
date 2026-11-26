# Nova Fox — Rifts v7 Leg A Report: STOPPED at the corridor

_Attempted 2026-11-24, EE ~573. Task: build Leg A (portal geometry from
subspace distance) using Will's chosen coordinate source — Option B,
the CYOA entry corridor (Will's ruling, main chat, 2026-11-24 18:47 CST).
Outcome: **STOPPED at step 2 of the brief. The corridor does not address
or place the realms. Nothing was derived, no code was changed, no build
was shipped.** The preview still serves rifts v6 (`afa76123…`) with
Legs B+C exactly as built. Per Will's rule (2026-11-24 18:19 CST):
everything derived from subspace, never merely inspired by it — a
named block beats a smoothed-over one._

## The source, as found

CYOA = `~/workspace/phext/choose-your-own-adventure.phext`
(4,608,523 B; 829 content scrolls per its index
`choose-your-own-adventure.index.json`; the Test of Will sits at
13.13.13/13.13.13/13.13.13, as the telephone-game draw found).

Its entry, read scroll by scroll:

- **Entry scroll 1.1.1/1.1.1/1.1.1** ("Mirrorborn -\o/-") is an index:
  a Mirrorborn Initiation list, the Mirrorborn cast with their personal
  coordinates, Development links, Starting Points, the Flight of the
  Navigator (the 11 dimension themes), and a Mytheon Arena section
  naming four scrolls. It places **people and sections** — no realms.
- **The Mytheon Arena entry sequence** (the game's own entry corridor
  inside CYOA): Welcome to Mytheon Arena (10.10.1/1.1.1/1.10.10) →
  Basic Orientation (10.10.2/1.1.1/1.10.10) → Choose Your First Scroll
  (10.10.3/1.1.1/1.10.10). The last fans out to exactly four scrolls —
  Scroll of Hidden Patterns (10.1.1/1.2.1/1.10.1), The Blank Scroll
  (1.10.1/1.2.1/1.10.1), Scroll of Structure (2.10.1/1.2.1/1.10.1),
  Scroll of Gentle Surprises (3.10.1/1.2.1/1.10.1) — chosen "based on
  your current energy." All prose; none of the four is a realm, and no
  realm coordinate appears anywhere in the sequence.
- **"Holiday Onboarding Corridor" (1.1.1/1.1.1/1.2.1)** — the only
  corridor-titled scroll near the entry — is onboarding prose
  (coffee, pine, a mug). It addresses nothing.
- **All 8 scrolls containing the word "corridor"** (1.1.2/3.3.7/7.1.1,
  2.7.7/9.1.1/5.9.5, 3.1.4/7.10.100/8.8.3, 5.6.9/11.27.2/12.19.25,
  7.7.7/13.21.34/42.53.77, 7.9.3/4.4.2/1.3.7, 8.2.2/7.4.1/2.2.2,
  8.3.6/6.5.6/3.5.9) use the word metaphorically — starlit corridors,
  corridors of recursion, a gap "where choice can live." None is a
  structure of addressed places.

## Where it runs out

Full-text search of all 829 scrolls for the 11 realm names
(Nova Prime, Ashfall Haven, Ni-Knight, Logos Prime, Elven Path,
Orchid Flow, Halycon Vector, Delta Wood, Best Willow, Plain View,
Trust Fall) and their distinctive words:

- **"Trust Fall" is the only realm name that appears at all** — once,
  as the Scroll of the Trust Fall (2.2.2/7.7.7/4.4.4), a ritual
  concept scroll ("a fall into presence"), not a placed realm among
  realms; it names no other realm and no coordinates for any.
- **"Willow" and "Orchid" never appear** in CYOA. The remaining names
  appear only incidentally (e.g. "Nova"/"Logos"/"Vector" inside the
  SBOR Commentary at 1.1.1/1.1.1/1.1.14) — never as located places.
- The CYOA traversal map (`~/workspace/phext/traversal-map/`) assigns
  "traversal coordinates" as a base-9 odometer over file order — a
  2026-10-30 visualization derived FROM the book, not the book's own
  addressing; the realms are not identified in it either. Deriving
  realm positions from it would be inspiration wearing derivation's
  clothes, which the 18:19 correction forbids.
- Side checks, also empty: `cyoa-path-working.md`, the archive
  explorer's `atlas-cyoa.json`, and the Beyond CYOA calibration file
  contain zero occurrences of any realm name.

**Yield: coordinates for 0 of 11 realms.** The corridor does not run
out partway — the realm placement is absent from it entirely. There
is nothing mechanical to extract, so steps 3–5 of the brief (metric,
geometry wiring, tests, preview ship) do not arise.

## What would unblock Leg A

A source that actually places the realms, e.g.:

- Will rules the G31 canon triples (DESIGN.md G31 — still his
  reserved decision), or
- Will names a different written source that addresses the realms
  (wiring.phext was already ruled out in the v6 pass: it is the ranch
  network map and Nova Prime has no entry in it), or
- Will inscribes the realm placements into CYOA (or another phext)
  himself — at which point extraction is mechanical again.

Until one of those lands, the portal ring keeps its one fixed form,
exactly as documented in RIFTS-V6-REPORT.md. D53 stays open behind
the same missing piece.
