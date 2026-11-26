# ECONOMY — Nova Fox: the two-currency model, with numbers

**Status: internal design analysis, DRAFT throughout.** Every number
in this document is either (a) a draft value taken from PLAN.md,
cited to its section, or (b) a modeling assumption, labeled as such
where it is used and collected in §1. Nothing here is ruled.
Decisions D12 and D44 are prepared for Will in §6 and §7 — those
sections present options, analysis, and a marked recommendation;
they settle nothing.

Sources: PLAN.md §2.1–2.7 (currencies, generation, sinks, gift,
the fork), §2.13 (the solver), §2.14 (the power-up ladder), §6
(decisions D12, D42–D47).

---

## 1. Archetypes and assumptions

### 1.1 The parameters

| # | Parameter | PLAN draft value | Modeling value used here | Source / note |
|---|---|---|---|---|
| P1 | Free token drip | "one token per few minutes of active play" (§2.2) | **1 token per 3 min = 20 tokens / active hour** | Modeling choice inside the PLAN draft's range |
| P2 | Generator spew rate | No rate stated; spew tied to world-riching verbs (§2.2) | **100 tokens spewed / active hour** | Modeling assumption — the single most sensitive number in this model; §5.3 gives the sensitivity |
| P3 | Credit earn ratio | **1 credit per 10 tokens spewed** (§2.2, "illustrative") | 1 : 10, as drafted | PLAN draft |
| P4 | Derived generator credit rate | — | **10 credits / active hour** (= P2 × P3) | Arithmetic: 100 ÷ 10 |
| P5 | Per-hour / per-day caps, diminishing returns | Proposed, no numbers (§2.2) | **Not applied in the baseline**; baseline assumes play stays under any cap. Sensitivity in §5.3 | PLAN proposal, unquantified |
| P6 | Gift price | **100 credits** (§2.6) | 100 credits | PLAN draft |
| P7 | Cash price | **$5 one time, for life** (§1) | $5 → a gift's cash anchor is $0.05 / credit | RULED price; the per-credit anchor is arithmetic |
| P8 | Token → credit conversion (Fork B only) | **50 : 1, capped weekly** (§2.7); cap size unstated | 50 : 1; modeling cap assumed **not binding** at the drip rates below (a devoted free player drips ≈ 280 tokens/week ≈ 5.6 credits/week of conversion) | PLAN draft rate; cap interaction is a modeling assumption |
| P9 | Daily-prize credits (Fork B only) | "small, once a day" (§2.7); no amount | Expected value: **10 credits/month** for a devoted free player, **3 credits/month** for a casual | Modeling assumption — an expectation over attempts and wins, not a stated prize size |
| P10 | Generator hand-downs (Fork B only) | Proposed, no rate (§2.7) | **0 in the baseline** (unquantifiable until a transfer mechanic is drafted) | Modeling assumption |
| P11 | Solver earn rate | Open — that is D44 (§2.13, §6) | Candidates in §7: **2 / 5 / 10 credits per verified hour** at 30% load | Prepared for Will, §7 |
| P12 | Solver electricity | "electricity and hardware time at 30% load" (§2.13) | Incremental draw **65 W** above idle; electricity **$0.15 / kWh** | Modeling assumptions, §7 |
| P13 | Month length | — | **30 days** | Modeling convention |

### 1.2 Player archetypes

| Archetype | Active play | Pattern (modeling description) |
|---|---|---|
| Free casual | **0.5 h/day** | Drops in most days; the daily pocket, some exploring; rarely finishes a long session |
| Free devoted | **2 h/day** | Plays daily, chases the daily, builds, explores shut realms as they open |
| Generator casual | **1 h/day** | Paid (bought or gifted); plays most days; spews while playing |
| Generator devoted | **3 h/day** | Paid; the company's engine — plays daily, organizes, gifts, arms friends |
| Solver-earner | Play as their tier's archetype, **plus 2 verified solver-hours/day** in solver calculations | Runs the solver client at 30% load (§2.13) alongside or outside play; treated as an overlay on any archetype, not a population slice, because eligibility is itself open (D47) |

### 1.3 Population mix (modeling assumption)

Within any scenario: free players split **70% casual / 30%
devoted**; paid players split **60% casual / 40% devoted**. These
splits are modeling assumptions, chosen plain and round so Will
can re-run the model with his own.

Derived per-generator averages under this mix:

- Generator-hours per generator per day = 0.6 × 1 + 0.4 × 3 = **1.8 h/day**
- Credits per generator per month = 1.8 h/day × 10 cr/h × 30 days = **540 credits/month**
- Tokens spewed per generator per month = 1.8 × 100 × 30 = **5,400 tokens/month**

---

## 2. Faucets and sinks inventory

**Launch-phase note (RULED, 2026-11-24 15:41 CST):** the
early game is all exploration, so at launch the flow
modeled below hangs on exploration verbs — discoveries,
crossings, traversal — not kills; there is nothing to kill
until the dragon arrives at Christmas.

### 2.1 Tokens (player-facing draft name "flux", §2.1)

| Kind | Source / sink | Rate | Notes |
|---|---|---|---|
| Faucet | Free drip | 20 / active hour (P1) | Tied to active play, not an idle tab (§2.2) |
| Faucet | Generator spew | 100 / active hour per generator (P2) | Lands on free players — pool, nearby, or split; where it lands is D14 (§2.3). Spew is new issuance into free hands under every landing option |
| Sink (renewable) | Riding a rift to a far pocket | Price unstated (§2.4) | Draft sink |
| Sink (renewable) | Posting marks to the shared world | Price unstated (§2.4) | Draft sink; also the honest answer to the shared gateway's rate cap |
| Sink (renewable, partly returning) | Daily challenge pocket entry stake | Price unstated (§2.4) | Clearing pays tokens back with a prize chance — a churn sink, not a pure drain |
| Sink (renewable) | Renting the grand brushes for a session | Price unstated (§2.4) | Only if the brushes are ruled tools-not-power-ups; interacts with the ladder, where brushes are also buyable rungs (§2.14) |
| Sink (Fork B only) | Token → credit conversion | 50 tokens destroyed per 1 credit minted (P8) | A token sink and a credit faucet in one act |

Token sink prices are all unstated in the PLAN, so token inflation
cannot be modeled to a number yet — only its shape: token issuance
is fully quantified in §3, and every token sink is renewable, so
the token economy can in principle be balanced at any issuance
level by pricing the sinks. That pricing is D13's work, not this
document's.

### 2.2 Credits

| Kind | Source / sink | Rate | Notes |
|---|---|---|---|
| Faucet | Generator spew earnings | 10 / active hour (P4) | The primary faucet; paid-side by construction |
| Faucet | Solver earnings | D44 — candidates 2 / 5 / 10 per verified hour (§7) | A work faucet with a real cost floor (§2.13); eligibility is D47 |
| Faucet (Fork B only) | Daily-prize credits | ≈ 10 / month devoted, ≈ 3 / month casual, expected value (P9) | §2.7 proposal |
| Faucet (Fork B only) | Token → credit conversion | 50 : 1 (P8) | §2.7 proposal |
| Transfer (not a faucet) | Generator hand-downs (Fork B) | Unquantified (P10) | Moves existing credits; mints none |
| **Sink (RULED)** | **Power-ups — the ladder** | 23,450 credits per player for the whole ladder (§4.1) | One-time per rung per player — a **finite** sink |
| **Sink (RULED)** | **Gifting the game** | 100 credits per gift (P6) | **Renewable** — every gift is repeatable, forever |

Credits have exactly two sinks (RULED, §2.1). One of them is
finite per player. That asymmetry is the whole inflation story,
told in §5.

A candidate third drain exists in the design but is **not ruled
and not counted in any number below**: when a dragon fight is
lost, equipped items are lost with it (§2.8), and re-arming for
the next attempt would mean buying the kit again. Whether lost
gear must be re-bought, is recovered from a later win, or is
replaced some other way is unsettled in the PLAN — flagged here
as a gap (§5.2), because if re-buying is the rule, the ladder's
dragonward band becomes a renewable sink and §5's conclusion
changes materially.

### 2.3 Dragon tokens — the hoard, sold as fortune cookies (RULED, 2026-11-24 15:43 CST; reframed 15:48 CST; draw and scale structure ruled 15:50 CST; quality ruled 15:56 CST; the million scales ruled 15:57 CST; the yield amended 16:00 CST; in the Thanksgiving launch, with red/blue gear ruled for Christmas, 16:07 CST)

Will, verbatim (15:43): "shard the dragons lexicon into
pieces small enough to chew. we'll sell them at $1 ea."
And the reframe, verbatim (15:48): "the dragon tokens
are like fortune cookies, loot, maybe one dragon phrase."
And the structure, verbatim (15:50): "dragon tokens are
sold without replacement, when the full set is cleared
for a scale, they improve in quality" — and: "users
can't choose which scale they pick from."

The dragon's lexicon (55,000,000 phrases, PLAN §2.8) is
sharded on the ranch into chewable pieces — the shard is
the bulk storage unit, ranch-side. What a player buys is
a **dragon token**: fortune-cookie loot. A token costs
**$1**; you crack it open and it holds dragon phrases —
3 of its scale's 55 possibilities, chosen randomly,
each carrying point totals that generate loot (the
scale anatomy ruled 15:57 CST; the yield amended
16:00 CST, below). The corpus becomes a purchasable artifact
of the game, one crack at a time. This is a revenue line
beside the $5 unlock, not a currency: tokens are bought
with dollars and sit outside the faucets and sinks above.
Every phrase is an equal citizen of the corpus; the offer
treats all tokens alike. The release scheme is the
standing moon-phase direction (Will, 2026-11-24), still to
be designed — his to direct.

**The draw, ruled (2026-11-24 15:50 CST).** Tokens are
sold **without replacement**: each token is a unique
slice of the corpus, the supply is finite, and collecting
is completion-shaped. Sets are issued **per scale** —
the decade ladder of PLAN §2.15 / SCALE.md: the set of
all tokens for a scale is a partition of the corpus, and
when a scale's full set is **cleared** — sold out — the
tokens **improve in quality**: the next scale's set is
better than the last. And no one picks their era: a buyer
draws from the **current** scale's set only — no choosing
an earlier era's leftovers, no buying ahead into a future
scale's better set. When a set clears, that era's tokens
exist only in their holders' hands. The world's current
scale is the only shelf in the shop.

**Quality, ruled (2026-11-24 15:56 CST).** Will,
verbatim: "gear follows a progression of trash (white),
common (grey), green (uncommon), red (valuable), and
blue (rare). so do scales. the dragon changes color as
the game grows." Quality is not a hidden dimension: it
**is** the color tier. Gear carries the five tiers —
trash (white) → common (grey) → uncommon (green) →
valuable (red) → rare (blue), in Will's order, white
below grey — and so do scales: dragon tokens follow the
same progression, and when a scale's set clears, the
next set improves **one step** along it. The dragon
itself wears the progression — it changes color as the
game grows, its color a public signal of the world's
era (PLAN §2.8, SCALE.md §3).

**The million scales, ruled (2026-11-24 15:57 CST).**
Will, verbatim: "1 million scales, 55 possible phrases
per scale." The dragon has **1,000,000 scales** — the
tokens are its scales — and each scale holds **55
possible phrases**: 1,000,000 × 55 = 55,000,000, the
corpus exactly. This is the partition of the corpus:
every phrase belongs to exactly one scale's possibility
set. A token is one scale, sealed; it yields **one**
phrase — one of its scale's 55 possibilities — and
which of the 55 it holds is the fortune, revealed when
the token is cracked. The fortune-cookie logic, plainly:
the cookie is sealed, the fortune is one of 55, and
nobody knows which until it opens.

**One shard per scale, ruled (2026-11-24 15:58 CST).**
Will, verbatim: "we need 1 million shards" — "one shard
per scale." The storage layout now matches the design
exactly: the ranch holds **1,000,000 shards**, one per
scale, each shard holding its scale's **55 possible
phrases**. Shard = scale = token: the unit stored on
the ranch, the unit in the design, and the unit sold
are the same object — the bulk-storage framing earlier
in this section is superseded. The ranch re-shard is
underway; the earlier 5,500-shard layout is superseded
with it.

**The yield, ruled (2026-11-24 16:00 CST — amends the
one-phrase yield of 15:57 CST).** Will, verbatim: "3
phrases from 55 are chosen randomly to issue point
totals that generate loot." The yield is now **three**:
from a scale's **55** possible phrases, **3 are chosen
randomly**; the 3 chosen phrases carry **point totals**;
and those point totals **generate loot**. The fortune
is three of the fifty-five, each one scored — what a
scale holds is not a lone phrase but a scored draw of
three, and the score is paid in loot. Parameter (a)
below carries the amended status; what remains open —
how the totals are assigned, how points become loot,
when the 3 are chosen, and the fate of the 52 unchosen
— is filed at (m), (n), (o), and (p) below, with no
recommendations.

**In the Thanksgiving launch, ruled (2026-11-24
16:07 CST).** Will, verbatim: "tokens and white, grey,
and green gear need to be in the Thanksgiving launch,
just not the dragon." Tokens ship in Beat 1 —
Thanksgiving, 2026-11-26: the $1 scale tokens, sold
without replacement from the current scale's set, with
the 3-of-55 scored yield — beside gear of the first
three tiers: trash (white), common (grey), uncommon
(green) (PLAN §2.14). Not at Thanksgiving: the dragon
itself (Christmas, ruled 15:41 CST) and the top two
gear tiers — valuable (red) and rare (blue) launch at
Christmas, 2026-12-25, with the dragon (RULED,
2026-11-24 16:07 CST: "red and blue gear for
Christmas"), Beat 2 scope. Two parameters below define
a shippable token and are therefore launch-relevant,
flagged in place: **(n) points → loot** and **(o) when
the 3 are chosen**. Both remain unruled.

**Parameters (filed, no recommendations — Will is still
shaping these; (b) ruled 2026-11-24 15:50 CST; (d) ruled
15:56 CST; (a) resolved 15:57 CST, amended 16:00 CST):**

(a) *Phrases per token* — **RESOLVED (2026-11-24 15:57
CST): one; AMENDED (16:00 CST): three, scored.** As
first resolved, a token yielded one phrase, one of its
scale's 55 possibilities. The 16:00 ruling amends the
yield: from the 55, **3 phrases are chosen randomly**,
the 3 carry **point totals**, and the point totals
**generate loot**. The supply arithmetic stands — the
whole token supply is 1,000,000 tokens, $1,000,000 buys
every scale there is — and the issue arithmetic
becomes: at most 3,000,000 phrases can ever issue, 3
per scale, drawn from a possibility space of
55,000,000. And plainly, as before: even holding every
issued phrase buys no way to test them. There is no
test outside the game — the oracle is the dragon,
in-game, lethal and rate-limited — so owning phrases
and learning anything from them remain two different
things. (This supersedes both the 15:43 shard-size
framing and the per-token table that stood here:
phrases per shard is a ranch storage detail, and
phrases per token is now ruled — one at 15:57, three
and scored at 16:00.)

(b) *Draw mechanics* — **RULED (2026-11-24 15:50 CST):
sold without replacement.** Tokens are cut from the
corpus without repetition; the supply is finite, and the
set of all tokens for a scale IS a partition of the
corpus — collecting is completion-shaped. Sets are
issued per scale, improve in quality as each scale's set
clears, and buyers draw from the current scale's set
only (the ruled structure above). The random-draw
alternative — duplicates possible, supply effectively
endless, rarity from frequency — is foreclosed by the
ruling.

(c) *Sale only, or loot too* — whether dragon tokens are
only ever sold for $1, or can also drop as in-game loot:
won, found, or earned in play, beside the $1 shelf.

(d) *What "quality" improves* — **RULED (2026-11-24
15:56 CST): quality is the color tier.** Dragon tokens
follow the same five-tier progression as gear — trash
(white) → common (grey) → uncommon (green) → valuable
(red) → rare (blue) — and when a scale's set clears,
the next set steps one tier up. The candidate dimensions
once filed here (phrases per token, cut of the corpus,
presentation and material, rarity mix) are superseded
as the definition of quality; the step's *mapping* onto
the decade ladder is the new open question, filed at
(g) below.

(e) *Whose tokens improve* — whether a clearing's
quality step reaches tokens already held (every holder's
tokens improve when the set clears) or applies only to
sets issued after the clearing (held tokens keep the
quality of their era).

(f) *Set size per scale* — how many tokens a scale's set
holds: sized to the scale's population (a set cut to be
clearable by the people of its decade) vs a fixed
partition of the 55,000,000-phrase corpus across the
scales (each era's share set in advance, whatever its
population).

(g) *Ten scales, five tiers* — the decade ladder has ten
scales (§2.15 / SCALE.md) and the color progression has
five tiers; how the clearings map onto the steps is
open. Options, stated only: two sets per tier (each tier
spans two decade scales); the tier advances not on every
clearing (some clearings hold the color, some step it);
the progression starts partway up (the first set is not
white); the top tier repeats (blue sets for the highest
scales, the progression complete before the ladder is).

(h) *The dragon's color* — whether the dragon's color is
exactly the current token tier (the dragon and the shelf
always the same color) or its own track (leading,
lagging, or stepping on a different event than a set
clearing).

(i) *Held tokens and the color step* — the companion to
(e), now that quality is color: when the world steps up
a tier, do tokens already held change color with it, or
does a held token keep its era's color forever — a white
token from the first age staying white in a blue age?

(j) *How the one phrase is determined* — each scale
holds 55 possible phrases and yields one: is that one
fixed at the scale's making, sealed inside it until
cracked, or drawn at the moment of cracking from the
55? (Filed under the one-phrase form; the 16:00 yield's
version — when the 3 are chosen — is at (o).)

(k) *The other 54* — when a scale is cracked and its one
phrase issues, what becomes of its remaining 54
possibilities: do they retire with the scale, never to
issue, or do they stay in the world somehow? (Filed
under the one-phrase form; under the 16:00 yield the
unchosen number 52, filed at (p).)

(l) *The million across the decades* — how the
1,000,000 scales partition across the decade sets: the
refinement of (f), now that the supply is counted — how
many scales a scale's set holds, decade by decade.

(m) *Point totals — how assigned* — the 3 chosen
phrases carry point totals: are a phrase's points fixed
to the phrase (the same phrase always worth the same,
wherever it issues) or rolled at the draw (a phrase's
worth decided when it is chosen)? And the ranges: what
a phrase can be worth, and whether the totals of the 3
combine — a sum the holder banks — or stand separately.

(n) *Points → loot — the mapping* — **LAUNCH-RELEVANT
(flagged 2026-11-24 16:07 CST): tokens ship at
Thanksgiving, and this mapping is part of what makes a
token shippable. Still unruled.** How point totals
generate loot, stated as options only: points spent on
loot rolls (the holder banks points and spends them on
draws); thresholds that drop items (cross a total and
loot falls); a loot table keyed to the color tiers of
PLAN §2.14 (totals map to tiers, tiers to gear). What
the loot itself is — gear, tokens, credits — rides
with this question.

(o) *When the 3 are chosen* — **LAUNCH-RELEVANT
(flagged 2026-11-24 16:07 CST): tokens ship at
Thanksgiving, and this timing is part of what makes a
token shippable. Still unruled.** The companion to
(j): are a scale's 3 chosen phrases fixed at the
scale's making, sealed inside it until cracked, or
chosen at the moment of cracking from the 55?

(p) *The 52 unchosen* — when a scale's 3 chosen phrases
issue, what becomes of the other 52 possibilities of
that scale: do they retire with the scale, never to
issue, or do they stay in the world somehow? (The
16:00 form of (k).)

---

## 3. Population scenarios

Three registered populations × three paid shares. "Paid share"
counts everyone with generator status, bought or gifted. The
solver overlay is excluded from the baseline tables and priced
separately in §7 — including it here would smuggle a D47 answer
into a D12 table.

Formulas (checkable by hand):

- Generators G = N × paid share
- Generator-hours/day = G × 1.8 (mix average, §1.3)
- Free-hours/day = (free casuals × 0.5) + (free devoted × 2)
- Monthly token issuance = 30 × [(free-hours/day × 20) + (generator-hours/day × 100)]
- Monthly credit issuance = 30 × generator-hours/day × 10

### 3.1 Monthly issuance

| Registered N | Paid share | Generators | Token issuance / month | Credit issuance / month | Credits per capita / month |
|---:|---:|---:|---:|---:|---:|
| 1,000 | 2% | 20 | 666,600 | 10,800 | 10.8 |
| 1,000 | 5% | 50 | 811,500 | 27,000 | 27.0 |
| 1,000 | 10% | 100 | 1,053,000 | 54,000 | 54.0 |
| 10,000 | 2% | 200 | 6,666,000 | 108,000 | 10.8 |
| 10,000 | 5% | 500 | 8,115,000 | 270,000 | 27.0 |
| 10,000 | 10% | 1,000 | 10,530,000 | 540,000 | 54.0 |
| 100,000 | 2% | 2,000 | 66,660,000 | 1,080,000 | 10.8 |
| 100,000 | 5% | 5,000 | 81,150,000 | 2,700,000 | 27.0 |
| 100,000 | 10% | 10,000 | 105,300,000 | 5,400,000 | 54.0 |

The model is linear — issuance scales exactly with N — so the
per-capita column depends only on paid share. What does *not*
scale linearly is the sink side (§5): the ladder's capacity
scales with the number of *credit holders*, and under Fork A
that is only the generators.

### 3.2 Credit stock trajectory — middle scenario (10,000 registered, 5% paid)

Modeling assumption for spending: players spend **60% of each
month's issuance in the month it arrives** (on ladder rungs and
gifts); the other 40% accumulates as held stock. This spend share
is a modeling assumption, stated so the trajectory is re-runnable
at any other share.

Monthly credit issuance: 270,000. Monthly sink drain at the
assumed share: 162,000. Net stock growth: **108,000 / month**.

| Month | Cumulative issuance | Cumulative sunk | Held stock (end of month) | Stock per capita | Stock per generator |
|---:|---:|---:|---:|---:|---:|
| 1 | 270,000 | 162,000 | 108,000 | 10.8 | 216 |
| 2 | 540,000 | 324,000 | 216,000 | 21.6 | 432 |
| 3 | 810,000 | 486,000 | 324,000 | 32.4 | 648 |
| 4 | 1,080,000 | 648,000 | 432,000 | 43.2 | 864 |
| 5 | 1,350,000 | 810,000 | 540,000 | 54.0 | 1,080 |
| 6 | 1,620,000 | 972,000 | 648,000 | 64.8 | 1,296 |
| 7 | 1,890,000 | 1,134,000 | 756,000 | 75.6 | 1,512 |
| 8 | 2,160,000 | 1,296,000 | 864,000 | 86.4 | 1,728 |
| 9 | 2,430,000 | 1,458,000 | 972,000 | 97.2 | 1,944 |
| 10 | 2,700,000 | 1,620,000 | 1,080,000 | 108.0 | 2,160 |
| 11 | 2,970,000 | 1,782,000 | 1,188,000 | 118.8 | 2,376 |
| 12 | 3,240,000 | 1,944,000 | 1,296,000 | 129.6 | 2,592 |

Read: by month 12 the average generator is *holding* 2,592
credits — 91% of a full dragon kit (2,850) sitting unspent — even
while spending 60% of income as it arrives. Held stock is not a
problem while the ladder still has rungs a player wants; it
becomes the problem in §5, when it doesn't.

### 3.3 The gift loop's compounding

Gifted friends become full generators (PLAN draft, §2.6). Model:
each generator gifts at a behavioral cadence of **0.25 gifts per
month** (one gift per generator per four months — a modeling
assumption; a generator *could* gift far faster, see the bounds
below), every gift converts one free player into a generator, and
growth stops at the population cap (everyone is a generator).

Middle scenario start: 500 generators, 9,500 free players.
G(month + 1) = G(month) × 1.25, capped at 10,000.

| Month | Generators (gifting alone) | Of which created by gifts |
|---:|---:|---:|
| 0 | 500 | — |
| 3 | 977 | 477 |
| 6 | 1,907 | 1,407 |
| 9 | 3,725 | 3,225 |
| 12 | 7,276 | 6,776 |

Bounds on the cadence assumption:

- **Slow cadence, 0.1 gifts/generator/month:** the generator
  population reaches the 10,000 cap in ≈ **31 months**
  (ln 20 ÷ ln 1.1 ≈ 31.4).
- **Baseline cadence, 0.25/month:** cap reached in ≈ **13 months**
  (ln 20 ÷ ln 1.25 ≈ 13.4); the table above is still under the
  cap at month 12.
- **Fast cadence, 0.5/month:** cap reached in ≈ **7 months**
  (ln 20 ÷ ln 1.5 ≈ 7.4).
- **Theoretical maximum:** if generators spent *all* income on
  gifts, the average generator earns 540 credits/month = 5.4
  gifts/month. Nobody will — the ladder competes for the same
  credits — but the ceiling shows the loop is never
  credit-starved; it is behavior-starved. The real governor on
  growth is how much players *want* to gift versus arm
  themselves, which is a play-pattern question, not a faucet
  question.

Two honest caveats: (1) this models gifting as the *only* growth
— cash purchases add generators on top, so real growth is faster;
(2) every gifted generator dilutes nothing — a gifted account
generates at the full rate (draft, §2.6) — so the loop compounds
at full strength until the free pool runs dry. When it does, the
gift sink doesn't die (gifts can go to brand-new players outside
the registered base), but its growth function inside a fixed
population ends.

---

## 4. Key derived numbers

### 4.1 The ladder's totals (from PLAN §2.14's tables, summed)

| Band | Bought rungs | Band total (credits) |
|---|---:|---:|
| Band 1 — Tools of the Path | 13 (plus 1 granted, price 0) | **225** |
| Band 2 — Realmcraft | 12 | **875** |
| Band 3 — Dragonward | 12 | **4,350** |
| Apex relics | 6 | **18,000** |
| **Whole ladder** | **43 bought + 1 granted = 44** | **23,450** |

Cross-checks against §2.14's own arithmetic: full armor
250 + 600 + 350 + 300 + 300 + 450 = **2,250** ✓; full kit
2,250 + 600 (War Lance, whole-tier price) = **2,850 per
fighter** ✓; company of 40 = 40 × 2,850 = **114,000** ✓.
The Apex band is 77% of the ladder's total price
(18,000 ÷ 23,450) — the sink ceiling is mostly legend-tier.

**Per-player sink ceiling: 23,450 credits.** That is the most
credits the power-up sink can ever absorb from one player
(one-time rungs; §2.2's re-buy question aside). Everything a
player earns beyond 23,450 lifetime credits has exactly one
place to go: gifts, at 100 each.

### 4.2 Time-to-gift (generator, by play)

At 10 credits per active hour (P4):

- **100 credits = 10 active hours of generator play.**
- Generator casual (1 h/day): **10 days** to a gift.
- Generator devoted (3 h/day): **≈ 3.3 days** to a gift.
- Mix-average generator (1.8 h/day): **≈ 5.6 days** to a gift —
  consistent with §3.1: 540 credits/month ≈ 5.4 gifts/month of
  gross earning capacity.

### 4.3 Time-to-full-kit, and the company

- One full kit (2,850 credits) = **285 generator-hours**.
  - Generator devoted: 285 ÷ 3 h/day = **95 days**.
  - Generator casual: **285 days**.
  - Mix-average: 285 ÷ 1.8 ≈ **158 days**.
- A company of 40 in full kit (114,000 credits) = **11,400
  generator-hours** in aggregate.
  - If the 40 arm *themselves* evenly, each carries their own
    285 hours — the company is ready when its slowest member is,
    ≈ 95 days if all 40 play devoted, ≈ 158 days at the mix
    average.
  - If one devoted generator tried to arm all 40 alone:
    11,400 ÷ 3 h/day = 3,800 days ≈ **10.4 years**. The PLAN's
    own framing (§2.14) is confirmed by the arithmetic: nobody
    arms 40 friends alone, and nobody was meant to. Arming a
    company is a *company's* season of work — or a wider
    community's: 200 mix-average generators contributing their
    full income could fund a company's kits in
    114,000 ÷ (200 × 540) ≈ **1.1 months**, if they spent on
    nothing else.
- One full kit = **28.5 gifts** (§2.14's figure, verified:
  2,850 ÷ 100). Every kitted fighter is 28½ friends not gifted —
  the ladder and the loop bid against each other for the same
  credits, which is the economy's central tension and, on this
  model, a healthy one: both bids are sinks.

### 4.4 The whole ladder, per player

- Full buyout: **23,450 credits = 2,345 generator-hours.**
  - Generator devoted (900 credits/month): **≈ 26 months** of
    play, spending on nothing else.
  - Generator casual (300/month): **≈ 78 months**.
  - Mix-average generator (540/month): **≈ 43 months**.

---

## 5. Inflation pressure analysis

### 5.1 The structural fact

Credit issuance is a *flow* that never stops while generators
play. Credit sinks are: one **finite** stock (the ladder,
23,450 per player) and one **renewable** flow (gifts, 100 each,
repeatable). Therefore, in every scenario, the question is not
*whether* issuance outruns the ladder — it is *when*, and what
carries the drain afterwards.

### 5.2 When the middle scenario hits sink exhaustion

Middle scenario (10,000 registered, 5% paid, 500 generators,
issuance 270,000 credits/month):

- Aggregate ladder capacity held by generators (Fork A reading —
  only generators hold credits): 500 × 23,450 = **11,725,000
  credits**. At full issuance directed at the ladder, that
  capacity absorbs **≈ 43 months** of issuance
  (11,725,000 ÷ 270,000 ≈ 43.4 — the same 43 months as the
  per-player figure in §4.4, as it must be in a linear model).
- But exhaustion arrives **player by player, not in aggregate**.
  The devoted segment (200 of the 500) exhausts its own ladder
  at **≈ month 26**; from then on, those players' 900
  credits/month each — 180,000 credits/month, **two-thirds of
  all issuance** — can only go to gifts or pile up as stock.
- Under the §3.2 spend-share assumption the pile-up is visible
  earlier: by month 12 the average generator already holds
  2,592 unspent credits. Stock itself is harmless; stock with
  nowhere meaningful to go is the inflation pressure — credits
  stop feeling scarce, gift-giving becomes costless-feeling,
  and the $5 anchor (P7) stops disciplining anything.

After exhaustion, the renewable drain is gifts alone. For gifts
to absorb the middle scenario's full issuance, generators must
collectively gift 270,000 ÷ 100 = **2,700 gifts/month = 5.4
gifts per generator per month** — every credit earned, gifted,
none kept. At the §3.3 baseline behavior (0.25 gifts/month),
gifts drain only 12,500 credits/month — **under 5% of issuance**.
The gap between those two numbers *is* the long-run inflation
pressure, quantified.

The same shape holds at every scale in §3.1, because the model
is linear: per-generator exhaustion timing (≈ 26 months devoted,
≈ 43 months average) is identical in the 1,000 and 100,000
scenarios. Scale changes the totals, not the timing. Paid share
changes who holds the capacity (Fork A) but not the per-holder
clock.

### 5.3 Valves that already exist in the design

1. **Generation caps and diminishing returns** (PROPOSAL, §2.2):
   a per-hour credit cap and per-day spew cap directly throttle
   P4. Sensitivity: if the effective credit rate were halved
   (5/hour), every time figure in §4 doubles — gift in 20 hours,
   kit in 570 hours, devoted ladder exhaustion at ≈ month 52.
   The caps are the strongest single lever Will holds, and they
   are currently unquantified — quantifying them is worth a
   decision of its own.
2. **The gift price** (draft 100, D15): the renewable sink's
   size. Raising it drains faster per gift and slows the growth
   loop; lowering it does the reverse. It is a tuning dial on
   both inflation and growth at once, which is why it can't be
   set from either side alone.
3. **The Apex band's depth**: 18,000 of the 23,450 ceiling is
   six relics priced for legend-chasers. The ladder's long tail
   is deliberately expensive — it postpones exhaustion for the
   most devoted by ≈ 20 of their 26 months (Bands 1–3 total
   5,450 = ≈ 6 devoted-months; the Apex is the other ≈ 20).
4. **Varied-activity generation** (§2.6 anti-abuse draft):
   generation tied to varied verbs, not one repeated act —
   throttles farming-shaped play before it mints.

### 5.4 Gaps

1. **No ruled renewable sink besides gifts.** Once the ladder is
   owned, gifting is the whole drain, and §5.2 shows plausible
   gifting behavior absorbs under 5% of issuance. The dragon
   loss / re-arm question (§2.2, end) is the largest unexamined
   candidate: if losing a fight means re-buying the kit, the
   dragonward band (4,350, including the 2,850 kit) becomes a
   renewable sink tied to the game's daily heartbeat — a single
   lost company fight would drain up to 114,000 credits of
   re-arming demand. Whether that is the design is Will's to
   rule; the economy's long run looks very different under each
   answer.
2. **No sink at all on held stock** — no decay, no fee, no
   upkeep is drafted anywhere. This document proposes none; it
   names the absence.
3. **Token sink prices are all unstated** (§2.1), so the token
   side cannot yet be checked the way §5.2 checks credits.
4. **The solver faucet is unpriced** (D44) and its eligibility
   undecided (D47) — an unquantified second credit faucet
   bearing on every figure above. §7 prices it.

---

## 6. PREPARED FOR WILL — D12: the fork, re-run with numbers

**Decision D12 (§2.7, §6):** Fork A — credits strictly
paid-side; or Fork B — free players hold credits from named
faucets (daily-prize credits, generator hand-downs, token →
credit conversion at the draft 50 : 1).

**The D47 interaction, stated plainly:** the solver (§2.13)
exists under both forks — Will ruled it as its own section, and
§2.13 records that it *bears on* D12 without closing it. Whether
free players may earn solver credits is D47's question, not
D12's. So each fork below is read twice: solver closed to free
players, and solver open to free players (at §7's middle
candidate, 5 credits/verified hour, solver-earner overlay of
2 verified hours/day = **300 credits/month**). The solver
reading turns out to matter more than the fork — that is a
finding of this model, and it is why D47 should not be decided
as an afterthought to D12.

### 6.1 A free player's realistic credit access

Monthly credit income for a free player, by fork and solver
reading (assumptions P8–P10; conversion assumes the player
converts *all* dripped tokens — an upper bound, since tokens
also have their own sinks):

| Path | Free casual | Free devoted |
|---|---:|---:|
| **Fork A, solver closed to free** | **0** | **0** |
| **Fork A, solver open to free** | 300 (solver only) | 300 (solver only) |
| **Fork B, solver closed to free** | ≈ 9 (6 conversion + 3 prizes) | ≈ 34 (24 conversion + 10 prizes) |
| **Fork B, solver open to free** | ≈ 309 | ≈ 334 |

Hand-downs (Fork B) are excluded (P10) — they would add
unpredictable, social amounts on top of the Fork B rows.

### 6.2 Time for a free player to reach rungs

First bought rung = the ladder's cheapest, 5 credits (Band 1).
A representative early rung = 15 credits (Band 1). Full kit =
2,850 (§4.3). "—" means the path does not exist.

| Path | First rung (5) | Early rung (15) | Full kit (2,850) |
|---|---|---|---|
| Fork A, solver closed | — | — | — |
| Fork A, solver open (300/mo) | < 1 day of solving (1 verified hour) | 1 day | **≈ 9.5 months** |
| Fork B, solver closed — casual (9/mo) | ≈ 17 days | ≈ 50 days | ≈ 317 months (≈ 26 years — effectively never) |
| Fork B, solver closed — devoted (34/mo) | ≈ 4–5 days | ≈ 13 days | ≈ 84 months (≈ 7 years — effectively never) |
| Fork B, solver open — devoted (334/mo) | < 1 day | ≈ 1–2 days | ≈ 8.5 months |

For scale, the generator devoted earns a full kit in **95 days**
(§4.3) and the cheapest rung in **half an hour of play**.

### 6.3 What each fork does to the dragon's 40

The dragon requires 40 friends in full kit — 114,000 credits of
gear (§4.1). Who can be armed decides who can stand in the 40.

- **Fork A, solver closed:** a free player can *never* hold a
  rung. The 40 must be 40 generators — bought, or gifted into
  generator status and then armed by play. The gifting loop is
  the only road from free to the fight, exactly as §2.8's
  interlock describes. The company is a paid-side achievement,
  full stop.
- **Fork B, solver closed:** a free player can hold *a* rung —
  a first Band 1 piece inside a week for the devoted — but a
  self-earned full kit takes ≈ 7 devoted years. In practice the
  40 is still generator-built; Fork B changes the *texture*
  (a free friend can arrive owning their own lamp upgrade and
  charm knot, earned) without changing the dragon's arithmetic.
- **Either fork, solver open to free:** a free solver-earner
  self-arms a full kit in ≈ 9.5 months of contributed cycles —
  *faster than a generator casual arms by play* (285 days ≈
  9.5 months — the same figure, arrived at by work instead of
  play). Forty free solver-earners could field a company that
  never paid and was never gifted. That may be exactly what
  Will wants the solver to mean — work as a road in — but it
  should be chosen as that, in D47, with eyes open: under this
  reading the solver, not the fork, is the decision that
  decides who can fight the dragon.

### 6.4 Recommendation (recommendation only — D12 is Will's)

**Fork B, with the solver's eligibility decided separately and
deliberately in D47.**

Reason, in the model's numbers: Fork B's faucets are too slow
to threaten the paid advantage — the free devoted path to a
full kit is ≈ 7 years against the generator devoted's 95 days,
a 27-to-1 gap that keeps the paid advantage *obvious by scale*,
which is the very mechanism §2.7's Fork B text proposes — while
buying something Fork A cannot offer at any price: a free
player holds a real rung, bought with real credits, inside
their first week, and has *felt* what credits do before anyone
asks them for $5. Fork A's purity costs the free tier a shop
window it can never touch; Fork B's cost is three small faucets
to balance, and this model shows all three are small. The fork
is not where the economy's risk lives — §5's sink exhaustion
and D47's solver eligibility are both larger. Decide B, and
spend the saved deliberation there.

---

## 7. PREPARED FOR WILL — D44: the solver earn rate

**Decision D44 (§2.13, §6):** credits per verified unit of
work. Prepared here as credits per **verified hour** of solver
running at the ruled 30% load.

### 7.1 The cost floor (shown in full)

Modeling assumptions (P12): a typical player machine running
the solver at 30% load draws **65 W incrementally** above its
idle draw (the honest floor is the *extra* electricity the
solving causes); electricity at **$0.15 / kWh**.

- Energy per verified hour: 65 W × 1 h = 0.065 kWh
- Electricity cost per verified hour: 0.065 × $0.15 = **$0.00975 ≈ 1 cent per hour**
- Electricity cost per credit = $0.00975 ÷ (credits earned per hour)

Hardware time — wear, heat, a fan's life — is real but not
priced here; the floor below is electricity only, and is
therefore a floor in the strict sense: the true cost of a
solver credit is somewhat above it.

Cash anchor for comparison (P7): the game costs $5 and a gift
costs 100 credits, so credits carry a cash shadow price of
**$0.05 per credit**. Every candidate below mints credits at an
electricity cost far under that anchor — the floor disciplines
*farming margins*, it does not make credits expensive.

### 7.2 Three candidates

| | Slow | Middle | Fast |
|---|---:|---:|---:|
| Rate (credits / verified hour) | **2** | **5** | **10** |
| Hours to earn a gift (100 cr) | 50 h | 20 h | 10 h |
| Electricity cost per credit | $0.0049 | $0.0020 | $0.0010 |
| Electricity cost per gift earned | $0.49 | $0.20 | $0.10 |
| Electricity cost as share of the $5 cash price | ≈ 10% | ≈ 4% | ≈ 2% |
| One solver hour vs one generator play hour (10 cr, P4) | 1 solver hour = 0.2 play hours | = 0.5 play hours | = 1.0 play hours |
| Solver-earner at 2 verified h/day earns | 120 cr/month | 300 cr/month | 600 cr/month |
| Time for a solver-earner to earn a full kit (2,850) | ≈ 24 months | ≈ 9.5 months | ≈ 4.8 months |

### 7.3 Farm-pressure notes

- **Slow (2/hr):** a gift costs 50 machine-hours and $0.49 of
  electricity. Farming is possible but slow; a farm's margin
  against the $5 anchor is thin once hardware and attention
  count. The risk flips: at 2/hr, honest players may find the
  solver not worth running, and the faucet contributes little.
- **Middle (5/hr):** a gift in 20 verified hours — a real
  commitment of machine time, visibly work-priced. A determined
  farmer running many machines still profits on paper
  ($0.20 of electricity per $5-shadow gift); the defense
  against that is verification and Sybil resistance (D43, D45),
  not the rate — no rate in this table makes electricity alone
  stop a farm, because the floor is 2–10% of the anchor at
  every candidate.
- **Fast (10/hr):** a solver hour equals a generator's play
  hour. Two consequences: play stops being the best way to
  earn (idling a solver matches devoted generation), and a
  gift costs 10 machine-hours — farming pressure is at its
  highest exactly where the faucet is most attractive. This
  rate also maximizes §5's pressure: at 2 h/day the fast
  solver-earner out-earns the mix-average generator
  (600 vs 540 credits/month) without playing at all.

### 7.4 Recommendation (recommendation only — D44 is Will's)

**The middle candidate: 5 credits per verified hour.**

Reason: it keeps the hierarchy the design implies — playing
the game as a generator remains the fastest way to earn
(10/hour against the solver's 5), so the solver reads as a
second road, not a replacement for play — while still pricing
a gift at 20 verified hours: long enough that a gift earned by
cycles means something, short enough that the road is real for
a free player (§6.3: a kit in ≈ 9.5 months). And it is the
candidate whose farm economics most need D43/D45 to be honest
rather than heroic: at 2/hr the faucet risks irrelevance, at
10/hr it risks swallowing play; at 5/hr it is a faucet a
verification system can plausibly defend.

### 7.5 Reconciliation note (2026-11-24, after SOLVER.md)

SOLVER.md's recommended verification design (Tranche 3 —
k=2 redundancy on every credit-bearing unit + canary units
at 2% + k=3 dispute escalation) spends ≈ 51% of contributed
compute on checking, so only ≈ 49% of a contributed hour is
*useful* verified work. This document's solver figures were
computed per verified hour. In contributed hours — the
hours a player actually gives — the middle rate nets
**2.45 credits per contributed hour**, a gift takes
**≈ 41 contributed hours** (not 20), the electricity floor
is ≈ $0.0040/credit, and every solver timeline in §6
doubles: the free solver-earner's full kit is
**≈ 19.4 months, not ≈ 9.5**. The D12 recommendation is
unchanged in direction — the correction makes the work
faucet slower than modelled, which widens the safety
margin its reasoning rests on. All figures remain draft;
D44 is Will's.

---

## 8. Scale — the decade ladder (summary; full analysis in SCALE.md)

Will ruled (2026-11-24 14:35 CST) that the economy must be
scaled for exponential growth — "the game gets more complex
with the userbase" — across decade events at 10, 100, 1K,
10K, 100K, 1M, 10M, 100M, 1B, 10B users; that sentients fill
the top of the ladder, literally (14:38 CST — the population
up there is mixed, and sentient players carry the userbase
past the human count); and that Nova Fox tracks the
transition (14:39 CST — the ladder is a chronology, and the
global record is its instrument). SCALE.md works the ladder
decade by decade. What it does to *this* document's model,
in brief:

- **The per-capita model is scale-free.** Every price, rate,
  and per-player clock in §§1–5 is designed scale-invariant:
  issuance per capita depends only on paid share at every N,
  and the exhaustion clocks (≈ month 26 devoted, ≈ 43
  average) are per-cohort timings, not scale timings. Growth
  does not change the model's numbers; it changes who they
  are happening to.
- **Growth defers §5's conclusion; it does not repeal it.**
  Under decade growth ≈ 90% of the population arrived in the
  newest cohort, and only ≈ 0.3% of generators are past the
  26-month horizon — aggregate sink capacity is dominated by
  fresh ladders (each arriving generator brings ≈ 868
  per-capita-months of sink at the 5% column). §5.2's
  exhaustion is a biography while growth lasts. At the top
  of the ladder it becomes the economy again: if arrivals
  stop, universal exhaustion follows within one clock of the
  last cohort, and gifts alone (< 5% drain) cannot carry it.
  If sentient arrivals continue after human arrivals end,
  the deferral continues on faster clocks (≈ 3.3 months —
  full-tempo sentient earners make ≈ 7,200 credits/month,
  ≈ 8× the devoted human, because play-hour rates compress
  while wall-clock terms — prices, daily caps, the dragon's
  day — do not move).
- **Two aggregate corrections to this document's framing.**
  (1) Paid share drifts: settled cohorts gift themselves
  toward the all-generator cap (≈ 13 months at baseline
  cadence), so long-run aggregate issuance exceeds the
  fixed-share tables of §3.1, bounded by 540
  credits/capita/month — the tables are floors. (2) The
  solver faucet's ceiling (≈ 45 credits/capita/month across
  the whole population at 10% participation under the daily
  cap) exceeds spew's 27 at 5% paid: above ≈ 1M users the
  primary faucet can be work, not play, unless D44/D47 say
  otherwise.
- **Prepared from the scale analysis:** D48 (adopt the
  decade schedule), D49 (realm openings per decade), D50
  (the steady-state sink — §5.4's gap 1, promoted: rule it
  before it is needed), D51 (claim customs as dragon access
  per capita falls), D52 (the record as chronicle:
  crossing entries, composition snapshots, firsts by kind).
  All in SCALE.md §7; all Will's.

---

## Appendix — formula sheet (the whole model, checkable by hand)

- Generator credit rate = spew (100 tok/h) × ratio (1 cr / 10 tok) = **10 cr/h**
- Credits per generator-month = 1.8 h/day × 10 cr/h × 30 = **540**
- Monthly credit issuance = generators × 540
- Time to X credits (generator) = X ÷ 10 active hours
- Ladder total = 225 + 875 + 4,350 + 18,000 = **23,450**
- Full kit = 2,250 armor + 600 weapon = **2,850**; company = × 40 = **114,000**
- Gift-loop growth = G × (1 + cadence)^months, cadence 0.25 baseline
- Solver electricity per credit = (0.065 kWh/h × $0.15) ÷ rate = $0.00975 ÷ rate
- Sink exhaustion (per player) = 23,450 ÷ monthly credit income

*End of ECONOMY.md — draft analysis for Will's decisions D12,
D44, and (by interaction) D47. No number in this document is
ruled.*
