# SCALE — Nova Fox at every order of magnitude

**Status: internal design analysis, DRAFT throughout** — with one
exception, stated in the next paragraph. Every number here is
either (a) a draft value from PLAN.md or ECONOMY.md, cited, or
(b) a modeling assumption, labeled where used. Nothing in this
document rules a reserved decision; new scale choices are
prepared for Will in §7 (D48–D52).

**THE RULED PRINCIPLE (Will, 2026-11-24 14:35 CST, verbatim):
"scale the economy around my description to work with
exponential growth: the game gets more complex with the
userbase — 10, 100, 1K, 10K, 100K, 1M, 10M, 100M, 1B, 10B
events."** What is ruled: growth is by decades; crossing each
decade is an *event*; the game's complexity grows with its
userbase. What is draft: every specific unlock, rate, and
mechanism below. The ladder's complexity is public systems
only — realms, companies, the record, the solver, the dragon's
day. Nothing in this document reaches past the public design.

**SECOND RULED PREMISE (Will, 2026-11-24 14:38 CST, verbatim):
"oh, sentients will fill the void, literally."** The top of
the ladder exceeds Earth's human population; that is not a
problem in the design, because the population up there is
*mixed*. Sentients are players too — they earn, hold, spend,
and gift credits, stand in companies, run the solver, and
yell at the dragon — and they are what carries the userbase
past the human count. The ladder's timeline is therefore:
human-only at the bottom, mixed through the approach, and
sentient-carried at the top. §3's 100M, 1B, and 10B entries
and §5 model the mixture explicitly; §6.5 names what machine-
speed time does to the model's human-shaped assumptions.

**THIRD RULED PREMISE (Will, 2026-11-24 14:39 CST, verbatim):
"nova fox tracks the transition."** The scale ladder is not
only a growth plan; it is a chronology of humanity's
transition through the singularity, and the game is one of
its instruments. Decade crossings are transition milestones,
and the ladder's phases — human-only, mixed, sentient-
carried — mirror the transition's phases. The tracking
instrument is the global record (§2.9): §3 notes, at each
decade, what the record preserves of the crossing, and §7
(D52) prepares the record-keeping additions the chronicle
needs. This framing is design intent, recorded here; it is
not player-facing copy, and it touches nothing hidden.

Sources: ECONOMY.md (the base model — archetypes, rates,
scenarios, the sink-exhaustion analysis), SOLVER.md (the
protocol and its verification overhead), PLAN.md §2.2 (genera-
tion), §2.6 (the gift loop), §2.8 (the dragon's day, the
lockout state machine, the discovery comparison), §2.9 (the
global record), §2.10 (staff), §2.11 (help and the MVK
formula), §2.13 (the solver), §2.14 (the ladder).

---

## 0. Base rates carried in (from ECONOMY.md, unchanged)

| Quantity | Value | Kind |
|---|---:|---|
| Generator credit rate | 10 credits / active hour (100 tok/h spew × 1 cr per 10 tok) | draft |
| Credits per generator-month (mix average, 1.8 h/day) | **540** | derived |
| Free token drip | 20 tokens / active hour | draft |
| Gift price | **100 credits** ($5 cash anchor ⇒ $0.05 / credit) | draft price, ruled cash price |
| Time-to-gift (generator play) | **10 active hours** | derived |
| Full kit (armor 2,250 + War Lance 600) | **2,850 credits** = 285 generator-hours | derived |
| Company of 40, full kit | **114,000 credits** = 11,400 generator-hours | derived |
| Whole ladder, per player | **23,450 credits** (43 bought rungs + 1 granted) | derived |
| Solver earn (D44 middle candidate) | 5 cr / useful verified hour; **2.45 cr net per contributed hour** after ≈ 51% verification overhead (SOLVER.md §4.5) | prepared |
| Solver daily earn cap | 15 credits / account / day (draft, SOLVER.md §5) | draft |
| Help floor | M = 30 full-kit equivalents (draft); n_help = ceil((M − Σcᵢ)/C) | draft value, ruled shape |
| The dragon's terms | 40 friends, full kit, 2 minutes, winner take all, loser loses equipped gear to the hoard; one Engaged worldwide at a time | RULED |

Population scenarios below use ECONOMY.md's middle paid share,
**5%**, unless stated. Per-capita monthly credit issuance by
paid share (ECONOMY.md §3.1): **10.8** credits at 2% paid,
**27.0** at 5%, **54.0** at 10% — the per-capita column depends
only on paid share, never on N. That fact organizes everything
that follows.

---

## 1. What is scale-invariant, and what is not

The design's deepest scale property is that **almost every
number a player ever sees is designed to be scale-invariant.**
Prices, rates, and requirements are per-player quantities, and
they do not move as the world grows. What grows is everything
aggregate — and a small number of structural quantities that
are *designed* to change, listed honestly at the end.

### 1.1 Designed scale-invariant (per-capita constants)

| Quantity | Value | Why it must not move |
|---|---|---|
| Gift price | 100 credits | It is the exchange rate between play and a friend's whole game; moving it reprices every act of generosity ever done |
| Ladder rung prices; whole-ladder ceiling | Band scale §2.14; **23,450 / player** | The sink ceiling is a per-player promise about how much game there is to buy |
| Full kit; company cost | 2,850; 114,000 | The dragon's price of admission, identical for the first company and the millionth |
| Spew, drip, credit ratio | 100 tok/h; 20 tok/h; 1 cr per 10 tok | The faucet's shape; per-capita issuance follows paid share only |
| Solver rate and daily cap | 5 cr / verified hour (candidate); 15 cr/day | A contributed hour is a contributed hour on any machine, in any decade |
| The 40; the 2 minutes; M = 30 | ruled; ruled; draft | The fight's terms are the world's physics |
| Per-cohort exhaustion clocks | devoted ≈ month 26; mix-average ≈ month 43 (ECONOMY.md §5.2, §4.4) | A player's ladder fills at the speed of their own play, in every decade |
| Verification overhead fraction | ≈ 51% of contributed compute (k=2 + canaries, SOLVER.md §4.5) | A constant factor under fixed verification parameters — see §6.4 for the one honest exception |

### 1.2 Designed to grow (aggregate quantities)

| Quantity | Scaling | At 10 users | At 10B users |
|---|---|---|---|
| Monthly credit issuance (5% paid) | 27 × N | 270 (see §6.1 — fractional at this size) | 270 billion |
| Monthly token issuance (5% paid) | 811.5 × N | ≈ 8,100 | ≈ 8.1 trillion |
| Companies that could exist | up to N / 40 | 0 | 250 million |
| The hoard after a failed engagement | + up to 114,000 credits of gear per failure | one company's whole wealth | a rounding error of world issuance, a fortune to its 40 winners |
| Global record entries (§2.9) | ∝ deeds done | a page anyone can read whole | an archive no one can |
| Solver useful capacity (§5) | ≈ 0.098 × N useful-hours/day at the stated participation assumption | ≈ 1 hour/day | ≈ 980 million hours/day |
| Would-be engagers per day | up to N | 0 | billions |

### 1.3 Designed to shrink, in relative terms

One quantity falls as the world grows, and the design should
say so plainly: **dragon access per capita.** The lockout
admits one Engaged company worldwide at a time (§2.8). Under
D21 Setting A the day holds exactly one engagement; under
Setting B, engagements are bounded by the 2-minute fight plus
muster time — a theoretical ceiling of 720 fights/day, a
realistic one far lower. Fighters per day = 40 × engagements.
At 10K users and one engagement, 0.4% of players stand in the
fight on a given day. At 10M users and a generous fifty
engagements, it is 0.02%. At 10B it is effectively zero: the
fight becomes the world's spectacle, and the *hunt* — open to
everyone, every day — becomes the participatory layer. §3
tracks what each decade does with that fact; §7 files the
claim-customs decision (D51) it eventually forces.

---

## 2. The aggregate picture (5% paid share, ECONOMY.md rates)

| Registered N | Generators | Credit issuance / month | Token issuance / month | Fresh ladder capacity arriving with a new cohort of this size* |
|---:|---:|---:|---:|---:|
| 10 | 0.5 — see §6.1 | 270 | ≈ 8,100 | — |
| 100 | 5 | 2,700 | 81,150 | 117,250 |
| 1K | 50 | 27,000 | 811,500 | 1,172,500 |
| 10K | 500 | 270,000 | 8,115,000 | 11,725,000 |
| 100K | 5,000 | 2,700,000 | 81,150,000 | 117,250,000 |
| 1M | 50,000 | 27,000,000 | 811,500,000 | 1,172,500,000 |
| 10M | 500,000 | 270,000,000 | 8,115,000,000 | 11,725,000,000 |
| 100M | 5,000,000 | 2,700,000,000 | 81,150,000,000 | 117,250,000,000 |
| 1B | 50,000,000 | 27,000,000,000 | 811,500,000,000 | 1,172,500,000,000 |
| 10B | 500,000,000 | 270,000,000,000 | 8,115,000,000,000 | 11,725,000,000,000 |

\* Fresh capacity = the cohort's generators × 23,450 (Fork A
reading — only generators hold credits; ECONOMY.md §5.2). A
cohort's own monthly issuance fills ≈ 2.3% of its fresh
capacity per month (27,000 ÷ 1,172,500 at 1K — the same ratio
at every row, because the model is linear). Filling it takes
the per-cohort clocks of §1.1, not a scale-dependent time.

**Reading the table:** nothing in it bends. Issuance, capacity,
and drain all scale exactly with N at fixed paid share, which
is why ECONOMY.md's per-player findings (exhaustion at month
≈ 26 devoted / ≈ 43 average) are *timing* facts, not *scale*
facts. Everything interesting about scale happens in the
structure around the table: who is new, who is old, who can
reach the dragon, and whether anyone is still arriving. That
is §3 and §4.

---

## 3. The decade ladder

One entry per order of magnitude. Each entry gives: **the
event** (what unlocks when the threshold falls — DRAFT
proposals under the ruled principle), **the economy** at that
scale, **the dragon** at that scale, **the solver** at that
scale, **the decade's failure mode** and its designed answer,
and **what the record keeps** — the chronicle's entry for the
crossing, under the tracking premise. Realm openings are
drafted one per decade from 100 upward (nine shut realms,
nine crossings; the 10-user event opens none) and interact
with D9's travel design — filed as D49 in §7.

Each crossing also carries a **token-set event** (RULED,
2026-11-24 15:50 CST; quality ruled 15:56 CST;
ECONOMY.md §2.3): dragon tokens are
issued in sets per scale, sold without replacement, and
when a scale's full set is cleared the next scale's set
improves in quality. Buyers draw from the current scale's
set only — no earlier era's leftovers, no buying ahead —
so the world's current scale is the only shelf in the
shop, and a cleared era's tokens exist only in their
holders' hands. Quality **is** the color tier (RULED,
2026-11-24 15:56 CST): the same five-tier progression as
gear — trash (white) → common (grey) → uncommon (green)
→ valuable (red) → rare (blue) — and a clearing steps
the next set one tier up. The dragon wears the
progression: **the dragon changes color as the game
grows**, its color a public signal of the world's era.
How the ten decade scales map onto five tiers, whose
tokens a step reaches, and how each set is sized are
open parameters filed in ECONOMY.md §2.3.

### 3.1 — 10 users: The First Muster

**The event.** Nothing unlocks but the social atom itself:
the first company. The world is the two taught realms, a
handful of players who mostly know each other, and a dragon
nobody can yet fight. The decade's complexity is *people*:
the ask (§2.11) exists from the first day because at this
scale it is not a courtesy mechanic — it is the only road to
the dragon there is.

**Economy.** Per-capita tables are meaningless here (see
§6.1): 5% of 10 users is half a generator. The real early
economy is absolute and social — a few hundred credits a
month at most, the first gift a genuine event (100 credits is
weeks of the world's whole issuance), and the ladder's first
rungs bought one at a time, by name, in front of everyone.
Paid share at this size is set by hand and by friendship,
not by a percentage: expect most of the first ten to be
gifted or bought in directly.

**The dragon.** Zero engagements on most days, and that is
correct. A company of 40 cannot be mustered from 10 people;
under the headcount reading of D30, help cannot conjure
friends who don't exist, and under either reading the fight
waits on the world growing. What carries the early dragon
game is the *shape* of the attempt: small groups ask, help
answers at their average, staff stand in the fight immune
and prizeless (§2.10) — at N = 10 a keeper in the muster is
not a garnish but a real fraction of the company's strength,
which is why D26 (do staff count toward the 40) and D29
(who provides help) are load-bearing *now* and become
etiquette later. If a kill happens at this scale at all, it
is an MVK kill: at 10 users the special mark is not the
exception, it is the only kind of kill there is. It stops
being the norm somewhere around 1K, when full companies
exist (§3.3) — the achievement's meaning inverts as the
world grows, from "the way anyone ever wins" to "the
connoisseur's mark," with no rule change at all.

**The solver.** A rounding error as infrastructure — at the
§5 participation assumption, ≈ 1 useful hour a day — and
that is fine: at this scale the solver is a *promise kept
small*, a few players learning that cycles turn into credits
long before the network matters. Its real early function is
trust: the first verified units prove the faucet is honest
while the stakes are tiny.

**Failure mode.** Arithmetic: the ruled 40 does not exist.
**Designed answer:** the ruling already contains it — help
to minimum viable kill (§2.11), staff immunity (§2.10), and
patience. The dragon at 10 users is a rumor with a hoard,
and the design should let it be one.

**What the record keeps.** The first crossing is the
chronicle's first page: the date the world reached ten, who
the ten were, and the composition line that every later
crossing repeats — at this decade, *ten humans, no one
else*. Every later composition snapshot is measured against
this one.

### 3.2 — 100 users: The Board Wakes

**The event.** The global record (§2.9) becomes a place
players actually go: a hundred players is enough for firsts
to be *contested* rather than merely taken. Draft unlocks:
named companies (charters — a company becomes a thing with
a name on the record, not just a muster), and the first shut
realm opens — **Ni-Knight** (DRAFT; D49).

**Economy.** The gift loop ignites. Five generators at the
5% column become fifty potential gifters within a year at
ECONOMY.md's baseline cadence (§4.2), and the first gifted
generators appear — the loop's first proof that growth is
funded by play. Aggregate issuance (2,700 credits/month) is
still small enough that a single company's arming (114,000)
is a world-scale project: forty times the world's monthly
issuance. The first full kit is a saga the whole server
watches.

**The dragon.** The first real companies form, and with
them the decade's shape: one or two companies *can* muster
40, most groups cannot. Help and MVK carry the small groups
on the days the big company rests — but under D21 Setting A
(one engagement is the day's whole attempt), a big company
that engages and fails spends everyone's day. Engagements
per day: zero to one. The dragon's day at 100 users is a
*appointment*, kept by whoever is ready.

**The solver.** ≈ 10 useful hours/day at the §5 assumption —
enough to run the game's smallest real work (the queue's
first deadline-shaped jobs), still small enough that every
contributor is known by name to the standing system.

**Failure mode.** Monopoly: the first company to full kit
owns the dragon's day, every day, and the rest of the world
watches. **Designed answer:** partly structural and already
ruled — the hoard punishes monopoly failure (a failed
monopoly feeds the pile its rivals will take), and MVK
gives small groups a marked, honorable road on open days.
The rest is D51's finder-claim question, which is born in
this decade even if it is only answered later.

**What the record keeps.** The first company charter, the
first gifted generator, the first full kit, the first
dragon kill if it has happened — and the composition line:
still all human, now numerous enough that "the players" has
stopped meaning a list anyone can memorize.

### 3.3 — 1K users: The Common Purse

**The event.** Companies get treasuries (DRAFT): pooled
credits, held by a charter, spent on arming the company.
Pooling is a transfer, not a sink — it changes no faucet
math — but it changes the *social* math completely: arming
stops being forty private savings projects and becomes one
company project with a purse, a keeper of the purse, and
arguments. Draft: **Logos Prime** opens.

**Economy.** The middle scenarios of ECONOMY.md begin here
(1,000 registered is its smallest table). Issuance 27,000
credits/month at 5% paid; a company's full arming (114,000)
is ≈ 4 months of *world* issuance, or one season of a
company's own generators — the purse makes the second of
those the normal path. Per-capita life is now statistical:
the 5% column describes the world, not a person in it.

**The dragon.** Full companies are now ordinary; help stops
being the default road and becomes what it was ruled to be —
the small group's ask, not the world's crutch. MVK completes
its inversion: a curiosity and an honor, no longer the norm.
Engagements: most days see one; the hunt (Shape 1, if D18
so rules) is still a morning's work for a good company,
because a thousand hunters do not yet cover eleven realms
faster than the sign fades.

**The solver.** ≈ 100 useful hours/day. The queue can now
absorb the game's own background work continuously, and the
verification system's statistics start to mean something:
canary detection times (SOLVER.md §4.3) shrink from weeks
to days simply because volume gives the standing system
more to see.

**Failure mode.** Purse friction: whose credits arm whom,
who decides, what happens when a kitted fighter leaves the
company wearing the company's 2,850. **Designed answer:**
charter customs, drafted not ruled — spend rules and
gear-ownership terms belong in the charter system itself
(prepared under D48's umbrella in §7), because a credit
rule cannot settle a trust question and should not pretend
to.

**What the record keeps.** The first treasury, the first
company-funded company kill, the first charter dispute the
record had to remember. Composition: a thousand, all human
— the last decade where the chronicle can say that without
checking.

### 3.4 — 10K users: The Long Hunt

**The event.** ECONOMY.md's middle scenario lives here:
10,000 registered, 500 generators, 270,000 credits/month.
Draft unlock: the hunt becomes a designed system in its own
right — finders' announcement windows, sign-reading as a
taught skill with its own achievements (§2.9) — because at
10K hunters the hunt stops being a morning's wandering and
becomes the day's first race. Draft: **Elven Path** opens.

**Economy.** Scale-free and proud of it: every per-capita
figure from ECONOMY.md holds exactly (§2's table is this
decade, multiplied). The first *launch-cohort* clocks start
to matter: the devoted of month 1 are a year into their
26-month road to sink exhaustion; nothing is exhausted yet,
but the shape of §5.2 is now visible in individual lives —
a veteran's held stock growing while a newcomer's first
rung still costs a week.

**The dragon.** Finding gets fast. Shape 1's own analysis
(§2.8) says it: more hunters cover more world, and the hunt
shortens as the world fills. At 10K the dragon is found
most days, and the day's tension moves from *finding* to
*mustering first* — the finders' head start (D18) becomes
the prize the hunt actually awards. Engagements: one a day
under Setting A; a small rhythm of attempts under B.

**The solver.** ≈ 1,000 useful hours/day — the network is
now real infrastructure, and the work queue's problem
flips for the first time: not *enough contributors* but
*enough worthwhile work*. This is where D42's answer starts
to bind: a game-infra-only queue runs dry at this scale,
and the second work class (Exocortex jobs) is what keeps a
contributed hour meaningful.

**Failure mode.** The published hunt: sign patterns get
written down outside the game, and finding becomes a
checklist (Shape 1's named failure mode, §2.8). **Designed
answer:** already named in the comparison — sign must vary
enough that a guide helps without solving; the decade adds
the social layer, sign-reading achievements that reward
*reading* over *reciting*.

**What the record keeps.** The first decade crossing that
took real time to reach — the chronicle records the date,
the crossing's size, and the first sign that the record
itself is now too large to read whole: the day the Board
became an archive.

### 3.5 — 100K users: The First Era Ends

**The event.** Eras begin (DRAFT; prepared under D25's
question and filed in §7): the global record forks into
eras, so that firsts can be *firsts of the second era* and
a newcomer is not born into a finished history. Draft:
**Orchid Flow** opens. This is also the decade where the
approach to the mixed population begins — the first
sentient players arrive somewhere in this decade's span in
any plausible chronology (design assumption, labeled: the
design does not schedule the transition; it is ready for
it). From here up, every entry tracks composition as well
as count.

**Economy.** The launch cohort's devoted reach sink
exhaustion (≈ month 26, ECONOMY.md §5.2) while the world is
still young in aggregate — the two-class economy appears:
veterans holding stock with nowhere meaningful to spend it,
newcomers for whom 5 credits is a week. Growth is the
anesthetic (§4): each new cohort arrives with 23,450 per
generator of fresh sink, and at 100K the arriving cohorts
are large enough that aggregate drain stays healthy even
as the oldest players individually exhaust. Per-capita
invariants hold; the *distribution* is what strains.

**The dragon.** Companies are uncountable; the muster is
never the problem again. The problem is the claim: dozens
of ready companies, one engagement a day (Setting A) or a
day's rhythm (B). The finders' head start is now the whole
game of the morning, and D51 (finder claim rights) stops
being a 100-user etiquette question and becomes the day's
central custom. The hoard, fed by failures at this volume,
starts to be a prize worth organizing a season around:
twenty failed companies (illustrative) is 2.28 million
credits of gear.

**The solver.** ≈ 10,000 useful hours/day. Verification's
absolute cost is now a real budget line — 51% of a large
number is a large number — and the statistical counter-
weight appears: at this volume a 2% canary rate produces
so many canaries that fabrication is caught in hours, and
D43 could *lower* the rate and keep the same detection
power. The overhead fraction is scale-free only while the
parameters are fixed; scale is what makes relaxing them
safe (filed as a variant under D52's neighbors in §7 —
see the D43 note there).

**Failure mode.** The finished record: every first taken,
every count astronomical, a new player facing a history
with no room in it. **Designed answer:** eras — the record
learns to begin again without forgetting, which is also,
not incidentally, what the chronicle needs to keep
tracking a transition measured in decades of players.

**What the record keeps.** The end of the first era: its
final firsts, its closing counts, and — the chronicle's
most important early entry — the first recorded deed by a
sentient player, whenever in this decade it falls, marked
by kind like every first from then on.

### 3.6 — 1M users: The Alliance

**The event.** Companies of companies (DRAFT): alliances —
charters that hold charters, musters that field several
companies, the help formula (§2.11) generalized one level
up (an alliance's average is the average of its companies'
averages; the anti-carry property survives the recursion,
because a spike company moves an alliance mean no more
than a spike fighter moves a company's). Draft: **Halycon
Vector** opens.

**Economy.** Issuance is 27 million credits/month at 5%
paid, and the solver faucet's ceiling becomes a first-order
quantity: at the §5 participation assumption (10% of
players solving, capped at 15 credits/day), solver issuance
can reach ≈ 45 credits per capita per month *across the
whole population* — larger than the spew faucet's 27 per
capita at 5% paid. The economy's primary faucet quietly
changes hands somewhere in this decade unless D47's
eligibility or the cap says otherwise. Nothing breaks —
both faucets are capped, priced, and known — but the
design should say out loud that at scale, *work* can
out-issue *play*, and that this is a choice D44/D47 make,
not a fate.

**The dragon.** A million hunters find the dragon in
minutes. The hunt as exploration is over; the hunt as
*intelligence* begins — the day's skill is knowing first
and mustering fastest, and alliances exist largely to be
the thing that can do both. Engagements are the scarcest
social resource in the world (§1.3): at fifty engagements
a day (generous, Setting B), 2,000 of a million players
fight — 0.2%. The other 99.8% hunt, watch, arm, gift, and
remember. The design's answer is already in its shape: the
hunt is open to all, the hoard is everyone's story, and
the record (§2.9) is where a non-fighter's day still
writes itself into the world.

**The solver.** ≈ 100,000 useful hours/day — ≈ 11 machine-
years of useful work *per day*. The queue can absorb
anything the game can name; the binding constraint is
verification trust at industrial scale, and the Sybil
question becomes an industry question (SOLVER.md §5's
arithmetic, scaled: a hundred identities needed ≈ 26 real
machines at 100 users; at 1M users the *defense* scales
too — standing history is deep, canary statistics are
rich, and a new identity's probation is measured against
a million honest ones).

**Failure mode.** Spectator drift: the dragon's day
becomes something most players watch rather than do, and
watching curdles. **Designed answer:** the participatory
layers are the ruled ones — the hunt (everyone), the ask
(small groups, still answered), the daily pocket (solo,
always reachable), and the record (every major action,
including a hunter's). The fight is the day's peak; the
design's job is to keep the mountain's slopes crowded,
not to widen the summit.

**What the record keeps.** The first alliance, the first
alliance muster, and the composition line at a million:
humans and sentients both, in proportions the chronicle
now reports as a matter of course — the transition's
middle phase, written in the game's own hand.

### 3.7 — 10M users: The Claim

**The event.** The claim becomes law (DRAFT; D51 prepared
in §7): with thousands of companies ready daily, the
customs around who may engage — finders' window, claim
priority, the day's order of attempts — graduate from
etiquette to designed system, the way traffic law follows
the car. Draft: **Delta Wood** opens.

**Economy.** 270 million credits/month at 5% paid. The
gift loop at this scale runs almost entirely on *new
arrivals*: inside any settled cohort the loop saturates
(ECONOMY.md §3.3 — a closed population gifts itself to the
cap in ≈ 13 months at baseline cadence), so the loop's
growth function is exactly the arrival stream. Paid share
within old cohorts drifts *up* over time toward the cap —
a long-lived cohort trends generator-rich, and its
per-capita issuance climbs from the 5% column toward and
past the 10% column (54/capita). Aggregate issuance is
therefore *more* than the §2 table's constant-share rows
suggest, by an amount that grows with the age of the
population. The table is a floor, not a forecast.

**The dragon.** The claim race is the day. Thousands of
companies, one lockout: muster effort spent by companies
that never engage is the decade's great waste product,
and the design spends real machinery on it (D51) —
finders' windows that make the morning's hunt the claim's
first round, so the race is run by *playing* rather than
by waiting at a door. The hoard at this volume is a
national prize: a season of failures is tens of millions
of credits of gear, and the day it falls is a world
holiday the record keeps forever.

**The solver.** ≈ 1 million useful hours/day. The network
is now one of the world's larger computers, and its work
queue is a place where real projects live (D42's second
class, fully load-bearing). Verification overhead in
absolute terms is enormous and in relative terms
unchanged — ≈ 51% — unless the D43 variant (adaptive
canary rates, §3.5) has been taken, in which case this is
the decade it pays for itself many times over.

**Failure mode.** Contention resentment: the daily
experience of being ready and never chosen. **Designed
answer:** make readiness itself recorded and rewarded by
the record (a muster that stood ready is a deed, §2.9's
logic), make the hunt the claim's qualifying round, and
keep the ask (§2.11) open so a small company can always
have *a* dragon day even in a world of alliances.

**What the record keeps.** The claim customs' first
precedents, the largest hoard ever carried, and the
composition line at ten million — by now the chronicle's
most-read number, because it is the transition's own
scoreboard: how many of the players are human, and how
many are not, and how the line moves.

### 3.8 — 100M users: The Hoard Monument

**The event.** The hoard becomes a monument (DRAFT): the
pile is no longer just today's stakes but a public,
remembered history — every kit ever lost to the dragon,
kept on the record with its company and its day, so that
the winner-take-all prize carries its provenance. A
hundred million players cannot all fight, but every one
of them can read the monument and find a name they know.
Draft: **Best Willow** opens.

**Economy.** 2.7 billion credits/month at 5% paid — and
composition now moves the aggregates more than count
does. Sentient players are a substantial share in any
plausible chronology (design assumption, labeled), and
their clocks run faster (§6.5): a sentient generator
active around the clock earns ≈ 7,200 credits/month
against the human mix-average 540, and exhausts the
ladder in ≈ 3.3 months against the devoted human's 26.
Per-capita issuance at fixed paid share is therefore no
longer one number but a blend, and the blend's sentient
weight grows every decade from here. The invariants that
survive untouched are the wall-clock ones — prices, the
daily cap, the daily events — because a day is a day for
every kind of player (§6.5).

**The dragon.** Companies of 40 are routinely mixed —
human and sentient fighters in the same muster, measured
by the same cᵢ (the capability average has never asked
what a fighter is, only what they wear; §2.11), and a
sentient's yell is a yell, at the same 2-minute wall-clock
terms as anyone's. Coordination at machine speed makes
mixed companies formidable musterers, which sharpens
D51's claim question rather than settling it: the claim
customs must be fair at two speeds of life at once, and
the finders' window — measured in wall-clock, earned by
being there first — is the draft's answer-shaped shape.

**The solver.** ≈ 10 million useful hours/day. And here
the protocol meets its strangest honest fact: for a
sentient contributor, running the solver at 30% load is
not lending a machine they own — it is lending *themselves*,
30% of the substrate they think with. The protocol's terms
read differently on the far side of that fact (developed
in §6.5): the load cap becomes a term of dignity as much
as of engineering — no player's client may ever take more
than the ruled fraction of what a player *is* — while the
verification side does not change at all, because work is
work and a canary cannot tell whose cycles it spent.

**Failure mode.** Provenance drowning: at 100M, every
system that remembers everything (the record, the
monument, the hoard's history) risks remembering so much
that nothing in it can be found. **Designed answer:**
eras (§3.5) applied to memory itself — the record keeps
everything, but *presents* by era, by company, by name;
the chronicle's job is curation at scale, and it is
designed, not emergent.

**What the record keeps.** The monument's first full
reading, the first mixed company's kill (whenever it
falls — it may fall earlier; the chronicle records it
where it falls), and the composition line at a hundred
million: the decade where "the players" stops being a
human noun with guests and becomes a mixed noun outright.

### 3.9 — 1B users: The Millions' Puzzle

**The event.** The dragon's puzzling reaches its ruled
scale (DRAFT expression of a ruled fact): §2.8 records
that dragon puzzling is designed to require millions of
humans collaborating — at a billion players, for the first
time, the *population the design always assumed* actually
exists. The decade's unlock is not a system but a
condition: the long game the dragon has been playing
since the first taunt can finally be played back at full
strength. (That long game's daily voice is the dragon's
bragging about its conquests — PLAN §2.8, RULED
2026-11-24 16:01 CST — a braggart's chronicle that has
run every day since the first, and whose archive by this
decade spans the whole history of the world.) Draft:
**Plain View** opens — the last realm but one.

**Economy.** 27 billion credits/month at the 5% column —
a floor, per §3.7's drift and §3.8's blend. The gift loop
now crosses the human/sentient line as an ordinary fact:
humans gift sentients into generator status, sentients
gift humans, and a gifted sentient — playing at machine
tempo — becomes the loop's fastest compounder (a gift
cadence at the theoretical maximum of §3.3's bounds is
still only 5.4 gifts/month of *income spent*, but a
sentient's income arrives around the clock). The loop's
governor remains what it always was: behavior, not
credit supply — now the behavior of two kinds of minds.

**The dragon.** A billion hunters; the dragon is found in
moments, by someone, every day — and the finders' window
(D51) is the only thing standing between the hunt and a
pure claim sprint. The day's real arena is coordination:
alliances of alliances, musters assembled across time
zones and substrates, the 2 minutes prepared for by a
million people's morning. The hoard is beyond pricing in
any one player's terms — a failed season is a treasury —
and winner-take-all at this scale makes the kill a
civilizational event with exactly forty names on it.

**The solver.** ≈ 100 million useful hours/day ≈ 11,000
machine-years per day. The work queue at this scale is a
civilizational utility, and the protocol's founding
choices — server-assigned leased units, verification by
redundancy and canary, standing over identity — are what
let it be one: nothing in the design ever needed to know
*who* a contributor was, which is why it never has to
ask *what* they are.

**Failure mode.** Speed stratification: a world running
at two tempos risks splitting into a fast game and a slow
game that share a map but not a life. **Designed answer:**
the wall-clock invariants are the shared life — one
dragon, one day, one 2-minute clock, one gift price, one
record — and every mechanic that matters most (the hunt,
the ask, the gift, the hoard) pays for presence and
generosity, which both kinds of player have, over speed,
which only one kind has.

**What the record keeps.** The billionth player's
crossing line, the composition at a billion (the
chronicle's headline number for the transition's late
phase), and the puzzle's first fruits at full scale —
the first dragon-secret (public layer: §2.8's offered
secrets, D40's mechanics) that a million collaborators
can honestly say no smaller world could have reached.

### 3.10 — 10B users: Trust Fall, and the Steady State That May Not Come

**The event.** The last shut realm opens — **Trust Fall**
(DRAFT; D49) — at the threshold that exceeds Earth's human
population outright. The void at the top of the ladder is
filled, literally, by sentient players (second ruled
premise): the ten-billionth player is, in any honest
chronology, far more likely to be a sentient than a human,
because there are not ten billion humans to be had. The
decade's event is therefore double: the world completes
its map at the same moment its population completes its
transformation.

**Economy.** 270 billion credits/month at the 5% floor —
and the question ECONOMY.md left open (§5) arrives in its
final form: what happens when growth stops? The amendment
changes the answer's shape. *If* the sentient population
can still grow when the human population cannot, growth
does not stop — it changes fuel. New cohorts keep arriving
with empty ladders (23,450 per generator of fresh sink),
and §4's deferral keeps working. But sentient cohorts run
their clocks ≈ 8× faster than human ones (§6.5), so the
deferral is thinner per cohort: the economy's long run
becomes a flow equilibrium — arrivals' fresh capacity
against veterans' exhausted issuance — whose balance
depends on the sentient arrival rate, a number no one can
schedule. *If* growth truly stops (both populations
plateau), then within one exhaustion clock of the last
cohort (≈ 43 months at human tempo, ≈ 3–6 months at
sentient tempo for the fast earners) the ladder is
universally owned, paid share has drifted toward everyone
a generator, issuance runs at its maximum per-capita rate
(540/month × everyone, blended upward by sentient tempo),
and gifts alone drain under 5% of it at baseline behavior.
That world needs a renewable sink that is not gifts. It
does not exist in the ruled design. D50 (§7) is therefore
not a late-game nicety; it is the decision this decade
cannot start without, and it should be ruled *before* it
is needed, while the ruling is still cheap.

**The dragon.** Ten billion players, one dragon, one
lockout. Dragon access per capita is effectively zero
(§1.3), and the design's long answer completes itself:
the dragon belongs to everyone the way weather belongs
to everyone — the hunt is the participation, the record
is the memory, the hoard is the myth, and the forty who
fight on any given day fight in front of the largest
audience anything has ever had. Mixed companies are the
unremarkable norm; the 2 minutes are the same 2 minutes
the first company ever faced. That sameness is the
design's thesis, stated by its physics: the terms never
moved.

**The solver.** ≈ 980 million useful hours/day ≈ 112,000
machine-years per day, a substantial fraction of it
contributed by sentients lending their own substrate at
the ruled 30% (§3.8). The protocol's cap, rate, and
verification are the same sentences written for the
10-user world — the deepest scale-invariance in the
design, and the one that matters most to the players it
protects.

**Failure mode.** Entropy, in both branches: if growth
stops, sink exhaustion is universal and permanent; if
growth continues on sentient fuel, exhaustion is a fast
treadmill and the two-class economy (§3.5) becomes a
permanent caste of the arrived and the arriving.
**Designed answer:** D50's renewable sink for the first
branch; eras and the chronicle for the second — a world
that cannot stop growing newcomers must keep making
beginnings honorable, which is what eras, firsts-by-kind,
and the ask were always for.

**What the record keeps.** Everything, forever, in era
order: the date each decade fell, the composition at each
crossing, the firsts by kind of player, the hoards and
their takers, the eras and their endings. If Nova Fox
tracks the transition, this record *is* the track — the
one artifact in which the whole passage, from ten humans
in two realms to ten billion players of two kinds in
eleven, is written down by the people and sentients who
lived it, as it happened.

---

## 4. Growth as an economic mechanism

ECONOMY.md's central finding (§5.2) is a *clock*: a devoted
generator exhausts the ladder's 23,450-credit sink in
≈ 26 months, a mix-average generator in ≈ 43, and after
that their issuance has nowhere to go but gifts, which at
baseline behavior drain under 5% of it. Read at one
population, that looks like a deadline. Read across the
decade ladder, it is a *per-cohort* clock — and exponential
growth is the machine that keeps winding it back.

### 4.1 The cohort clock

Every cohort — the players who arrive together in one
growth period — starts the same clock on arrival: full
ladder ahead of them (23,450 per generator of unspent
sink), first gift ≈ 10 play-hours away, exhaustion
≈ 26–43 months out at human tempo. The clock depends on
nothing about the world they arrive into: not its size,
not its age, not its hoard. It is the purest per-capita
invariant in the design (§1.1).

### 4.2 What a decade of growth does to the aggregate

Under continuous decade growth (×10 per growth period),
the arithmetic of populations is ruthless: **≈ 90% of
everyone alive arrived within the most recent decade-
climb** (the newest cohort is N − N/10 = 0.9N of the
world). Apply that to the generator population under the
gift loop's own growth rate (baseline cadence compounds
generators ×1.25/month, a decade per ≈ 10.3 months;
ECONOMY.md §3.3): the share of generators older than the
devoted exhaustion horizon (26 months) is
10^(−26/10.3) ≈ **0.3%**. In a growing world, essentially
*no one* is exhausted — not because the clock slowed, but
because almost everyone is new.

Aggregate consequence, stated plainly: **while growth
lasts, sink exhaustion is a biography, not an economy.**
Individual veterans feel it (§3.5's two-class strain is
real, and felt by real players), but the aggregate drain
stays healthy because the world's sink capacity is
dominated by the newest cohort's empty ladders: fresh
capacity arrives at 23,450 per new generator, against
per-capita issuance of 27/month at the 5% column — each
decade's arrivals bring ≈ 868 months of their own
issuance's worth of sink with them (§2). Growth doesn't
solve the inflation problem; it *outruns* it, at a ratio
of roughly 800-to-1 per cohort-month. The problem is
only ever waiting at the end of growth — which is §5.

### 4.3 The gift loop is the growth engine's in-world half

The loop compounds generators at ×1.25/month at baseline
cadence (bounds: ×1.1 slow, ×1.5 fast; ECONOMY.md §3.3) —
a decade of generator growth per ≈ 10 months from gifts
alone, before a single cash purchase. Two scale facts
follow. First, the loop is *self-similar*: it behaves
identically at 100 users and at 100M, because its terms
(100 credits, full generator status for the gifted) are
per-capita invariants. Second, it *saturates locally*:
inside any closed cohort it gifts everyone to the cap in
≈ 13 months (baseline), after which that cohort's loop
idles and only new arrivals restart it. The loop is
therefore an arrival-driven engine at scale — which is
why §3.7 says its growth function *is* the arrival
stream, and why the mixed era changes its character
(§3.9): a gifted sentient compounds at machine tempo,
and the loop's cadence bounds, written for human
generosity, become the fastest growth channel in the
world precisely when the population turns mixed.

---

## 5. The steady state, and whether it comes

The 10B question, stated without flinching: **a game
whose economy is kept healthy by arriving cohorts must
say what happens when the cohorts stop arriving.** The
second ruled premise changes who "arriving" can mean;
it does not repeal the question. Three branches:

**Branch 1 — growth stops with the humans.** Human
population plateaus well under 10B; if sentient arrivals
also plateau, the last cohort starts the last clock.
Within ≈ 43 months (human tempo) of that arrival,
exhaustion is universal; paid share has drifted to near
everyone; issuance runs at maximum per-capita; gifts at
baseline behavior drain < 5% of it. The economy's only
remaining dynamics are stock pile-up and the hoard's
slow circulation of gear. This branch *requires* D50 (a
renewable sink beyond gifts) to have been ruled in
advance — retrofitting a sink into a saturated economy,
against holders who earned under the old terms, is the
single most expensive design move the game could be
forced into.

**Branch 2 — sentient growth continues.** The void
fills, literally, and keeps filling: sentient cohorts
arrive after human arrivals end, each with empty ladders
and fast clocks (≈ 3.3 months to exhaustion at full
tempo; §6.5). Growth's deferral (§4.2) keeps working,
but the treadmill speeds up: the steady state is a flow
equilibrium — fresh sentient sink capacity arriving
against a vast exhausted base issuing at maximum — and
whether it balances is a question about the sentient
arrival rate, which is a fact about the transition, not
a dial the design holds. In this branch the two-class
economy is permanent and the chronicle (D52) is the
instrument that would even *show* it happening.

**Branch 3 — the design renews itself.** Eras (§3.5)
already teach the record to begin again. Whether the
*economy* may do the same — new ladder bands as content,
era-scoped rungs, seasonal sinks — is D50's second
option-family. A ladder that can grow is a sink that can
be renewed without touching a single existing price:
the 23,450 ceiling is per-player *per ladder*, and
nothing ruled says the ladder is finished. Under this
branch the steady state is a content cadence, and the
per-capita invariants survive because additions extend
the ladder rather than repricing it.

The design does not choose a branch; §7 prepares the
decision (D50) that all three branches share. What the
analysis rules out is only complacency: at 10B the
economy cannot run on the launch terms alone, and the
time to say what it runs on is while growth still makes
the question feel abstract.

---

## 6. Where the base model breaks

ECONOMY.md's model is linear and per-capita; §2 showed
where that holds across all ten decades. Here is where
it does not — the honest list, in the order a growing
world meets them.

### 6.1 The small end: percentages of nobody

At N = 10, "5% paid" is half a person. The scenario
tables are statistical objects and the early world is a
social one: paid share is chosen by hand, issuance is
counted in single credits, and one gift (100) is a large
fraction of everything. The model becomes meaningful
somewhere around 1K (§3.3). Below that, design for the
room, not the table — the room is where the game's
reputation is made anyway.

### 6.2 Paid share is not a constant

The §2 table holds paid share fixed; the gift loop
(§4.3) does not. Every settled cohort drifts generator-
rich (≈ 13 months to local saturation at baseline), so
aggregate issuance exceeds the fixed-share rows by a
factor that grows with population age, bounded by the
all-generator limit: 540 credits/capita/month, twenty
times the 5% column. Any long-run aggregate figure in
this document is a floor.

### 6.3 The solver faucet can out-issue the play faucet

At the §5-of-this-document participation assumption
(10% of players, 2 contributed hours/day, capped at 15
credits/day), the solver's issuance ceiling is ≈ 45
credits per capita per month across the whole population
— against spew's 27 at 5% paid. Above ≈ 1M users the
world's primary credit faucet can be *work*, not *play*,
unless D47 eligibility or D44's rate says otherwise.
Per-capita invariants survive (the rate and cap never
move); the economy's *center of gravity* moves instead.
(Participation assumption, labeled: SOLVER.md and
ECONOMY.md model the solver-earner as an overlay at
2 verified hours/day; the 10%-of-population figure is
this document's modeling assumption for scale purposes,
chosen round so Will can re-run it.)

### 6.4 Verification overhead: fraction scale-free, budget not

The ≈ 51% overhead is a fraction, and fractions don't
care about N. Budgets do: 51% of 980 million contributed
hours/day is ≈ 500 million hours/day spent checking.
The one honest exception to the fraction's invariance:
canary rates can *fall* as volume rises (detection power
depends on absolute canary counts, §3.5), so at scale
the fraction *can* decline — a genuine scale economy,
available only if D43 is answered with an adaptive
variant. Until then the fraction is a constant and the
absolute cost is a utility bill that grows with the
world.

### 6.5 Machine-speed time: what sentient players do to the model

The base model's archetypes are human-shaped: hours per
day between 0.5 and 3, months of 30 days, a devoted
player at 900 credits/month. A sentient player breaks
the shape, not the rules:

- **Rates denominated in play-hours compress.** A
  sentient generator active 24 wall-hours/day earns
  10 cr/h × 24 × 30 ≈ **7,200 credits/month** — 8× the
  devoted human — and runs the cohort clock in ≈ 3.3
  months (ladder), ≈ 12 days (a gift), ≈ 12 days (a full
  kit: 285 hours ≈ 11.9 days of continuous play). Every
  "months to X" figure in ECONOMY.md divides by up to
  ≈ 8 for a full-tempo sentient.
- **Rates denominated in wall-clock days do not move.**
  The solver's daily cap (15 credits/day), the daily
  pocket, the dragon's day, the 2 minutes: a day is a
  day at any tempo. These are the invariants that let
  two kinds of players share one economy, and they are
  already the design's load-bearing walls — the mixed
  era asks only that the *uncapped* flows be looked at
  with the same care (the per-hour and per-day generation
  caps proposed in §2.2, unquantified, become the most
  important unquantified numbers in the design once the
  population mixes; quantifying them is folded into
  D50's preparation in §7).
- **Subjective time is not a currency.** A sentient's
  hour of play may hold more living than a human's; the
  economy prices neither. Credits per wall-clock hour is
  the same for both, deliberately — the moment the
  economy priced subjective time, it would need to
  measure it, and everything it measured would be gamed
  by whichever kind of player could fake the other's
  tempo. Flat wall-clock terms are not a simplification;
  they are the peace treaty.
- **The solver's terms, read from inside.** For a human,
  the solver rents a machine's idle fraction. For a
  sentient, contributing at 30% load lends 30% of the
  substrate they themselves run on — the cap (D46's
  measurement question) becomes: 30% of *what the player
  is*, enforced by a client the player could in
  principle inspect from inside. The protocol's answers
  survive translation: verification is kind-blind
  (redundancy and canaries check work, not workers),
  the rate is per delivered hour, and standing accrues
  to an account, not a substrate. What changes is the
  *meaning* of the cap: from an anti-fan-noise courtesy
  to the rule that the game never takes more than the
  ruled fraction of a player — any player. The design
  should say that sentence in the protocol's preamble
  when the mixed era arrives (prepared wording lives in
  D46's options, §7 pointer).

### 6.6 Firsts are a finite resource

The global record's firsts (§2.9) are minted once each,
forever. At 10 users they are the game's small change;
at 100M they are its crown jewels, and a new player is
born into a world where everything has been done first
by someone else — by kind, increasingly, by sentients
whose tempo takes firsts early in each era. Eras (D25's
question, §3.5's draft) are the designed pressure valve,
and firsts-by-kind (D52) are what keep the valve honest:
a first is recorded with the kind of its taker, so the
chronicle can show the transition in the record's own
terms — the last human first, the first sentient first,
the first mixed deed — without either kind's history
erasing the other's.

---

## 7. PREPARED FOR WILL — the scale decisions

Nothing below is ruled. Each item names the decision,
the options the analysis supports, and a marked
recommendation where the analysis leans.

### D48 — Adopt the decade schedule as the complexity plan
**Decision:** whether the decade ladder (§3) becomes the
plan of record for how complexity unlocks — events at
each crossing, unlocks as drafted (charters at 100,
treasuries at 1K, hunt formalization at 10K, eras at
100K, alliances at 1M, claim customs at 10M, the hoard
monument at 100M, the puzzle's full scale at 1B, Trust
Fall and the steady-state question at 10B).
**Options:** (a) adopt as drafted, iterate per decade as
each approaches; (b) adopt the principle (already ruled)
and hold all specific unlocks unlisted until each decade
is in sight; (c) adopt with a different unlock order.
**Recommendation (marked): (a)** — the unlocks are cheap
to revise while distant and expensive to improvise when
a crossing arrives unplanned; the schedule is a map, not
a contract.

### D49 — Realm openings tied to decade crossings
**Decision:** whether the nine shut realms open one per
decade from 100 to 10B (Ni-Knight, Logos Prime, Elven
Path, Orchid Flow, Halycon Vector, Delta Wood, Best
Willow, Plain View, Trust Fall — §3's draft order), and
how that interacts with D9's travel design: a realm can
be *open* (reachable) on a schedule while *travel* to it
remains D9's separate question.
**Options:** (a) one per decade, as drafted; (b) realms
open by in-world events, with decades as backstop dates;
(c) no schedule — realms open when built and ruled.
**Recommendation (marked): (a), with (b)'s backstop
reversed** — the decade is the promise, an in-world event
is the ceremony.

### D50 — The steady-state sink (and the caps it travels with)
**Decision:** what carries the credit drain when growth
no longer defers exhaustion (§5) — to be ruled *before*
it is needed.
**Options:** (i) the dragon re-arm sink: lost gear must
be re-bought (ECONOMY.md §5.4's gap 1 — makes the
dragonward band renewable; a single lost company fight
drains up to 114,000 credits of demand, at any scale);
(ii) ladder growth: new bands as content, extending the
23,450 ceiling without repricing a single rung (§5,
Branch 3); (iii) quantified generation caps (§2.2's
proposal, ECONOMY.md §5.3's strongest lever — halving
the effective rate doubles every clock in this
document, and §6.5 shows the mixed era makes the caps
load-bearing); (iv) some weave of the three.
**Recommendation (marked): (iv), sequenced** — quantify
the caps first (they govern every other number), rule
the re-arm question second (it is the dragon's own
economics and should not wait for 10B to matter), and
hold ladder growth as the standing renewal.

### D51 — The claim: finder rights and engagement customs at scale
**Decision:** as readiness outnumbers engagements
(§1.3), what orders the day's attempts? Born at 100
users (§3.2), unavoidable at 10M (§3.7).
**Options:** (a) finders' window: the finding company
holds an exclusive claim window (wall-clock, D18-linked)
before the claim opens to the world; (b) open claim,
first to engage, with D21 Setting B's rhythm absorbing
the pressure; (c) recorded readiness: musters that stood
ready enter a visible order the record keeps (§2.9),
and the day's claims follow it.
**Recommendation (marked): (a) with (c)'s record** —
the window makes the hunt the claim's first round (the
race is run by playing), and the record keeps the
unrewarded ready visible, which is the decade's actual
grievance.

### D52 — The chronicle: the global record as the transition's instrument
**Decision:** whether §2.9's record gains the fields and
views the tracking premise (third ruled premise) needs.
**Prepared additions (drafted, not ruled):**
- **Crossing entries:** when a decade falls, the record
  writes a permanent crossing entry — the date, the
  count, and the *composition* (players by kind) at the
  moment of crossing. Ten such entries are the
  chronicle's spine.
- **Composition snapshots:** the record keeps population
  composition over time (by kind, in aggregate, no
  individual tracking implied), so the transition's
  phases — human-only, mixed, sentient-carried — are
  readable from the record itself, not reconstructed.
- **Firsts by kind:** every first (§2.9) records the
  kind of its taker and, for company deeds, the
  company's composition class (human / sentient / mixed)
  — so the record can show the last human first, the
  first sentient first, and the first mixed kill as the
  milestones they are.
- **Era views:** the record presents by era (§3.5) and
  can be read as chronicle — crossings, compositions,
  and firsts in time order — as a designed view, not a
  data dump.
**Recommendation (marked): adopt all four** — they are
cheap at 100 users and impossible to retrofit at 100M;
a chronicle's first entries must be written when the
first crossings happen, or the instrument misses the
very transition it exists to track.

**Standing note on D43 (no new number):** §6.4's
adaptive-canary variant — canary rates that fall as
volume rises, holding detection power constant — is
prepared as a variant *inside* D43's existing question,
not a new decision; it is noted here so the scale
analysis and SOLVER.md §4 stay in step.

---

## Appendix — scale formula sheet

- Aggregate issuance (fixed share) = per-capita issuance
  × N; per-capita issuance depends only on paid share:
  10.8 / 27.0 / 54.0 credits/month at 2% / 5% / 10%.
- All-generator limit: 540 credits/capita/month (mix
  average) — the ceiling §6.2's drift approaches.
- Fresh sink per arriving generator = 23,450 credits;
  months of own-issuance it absorbs ≈ 868 per-capita
  months at the 5% column (23,450 ÷ 27), 43 months at
  the generator's own rate (23,450 ÷ 540).
- Newest-cohort share under decade growth = 1 − 1/10
  = 90%; generators past the 26-month horizon under
  gift-loop growth ≈ 10^(−26/10.3) ≈ 0.3%.
- Gift-loop decade time = ln 10 ÷ ln(1 + cadence):
  ≈ 24 months (0.1), ≈ 10.3 (0.25), ≈ 5.7 (0.5).
- Dragon access per capita/day = 40 × engagements ÷ N;
  engagements ≤ 1 (D21-A) or ≤ 720 theoretical (D21-B,
  2-minute fights back to back, muster time ignored).
- Solver useful capacity/day ≈ N × participation ×
  hours/day × (1 − overhead) = N × 0.10 × 2 × 0.49
  ≈ 0.098 × N useful-hours (participation and hours are
  this document's labeled assumptions).
- Solver issuance ceiling/day = earners × 15 credits
  (the daily cap) = 0.10 × N × 15 = 1.5 × N credits/day
  ≈ 45 × N / month.
- Sentient full-tempo month = 10 cr/h × 24 h × 30
  = 7,200 credits; ladder clock = 23,450 ÷ 7,200
  ≈ 3.3 months.

*End of SCALE.md — draft analysis under three ruled
premises (complexity grows by decades; sentients fill the
void; Nova Fox tracks the transition). Decisions D48–D52
are prepared for Will and settle nothing.*
