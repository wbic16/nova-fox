# SOLVER — Nova Fox: the contribution protocol and solver client

**Status: internal design draft. PREPARED FOR WILL — nothing in this
document is ruled.** It drafts the protocol and client behind PLAN.md
§2.13 (RULED: Nova Fox ships a protocol and a solver client players run
on their own machines; players contribute compute cycles, self-throttled
to 30% load, and earn credits for verified work) and prepares decisions
D42–D47 (PLAN.md §6) as options with marked recommendations. It settles
none of them.

**Launch (RULED, 2026-11-24 16:08 CST): Christmas.** Will, verbatim:
"the full token economy minus mining ships in Thanksgiving, mining
launches at Christmas." **Mining** — Will's term for this document's
subject, the solver protocol's cycle-contribution earning (the work
faucet) — does not ship at Thanksgiving. It launches at **Christmas,
2026-12-25 (Beat 2)**, with the dragon and the red/blue gear tiers.
Decisions D42–D47 are Christmas-gated accordingly (PLAN.md §6).
Player-facing language stays "contributing", as drafted throughout;
"mining" is the design's name for the faucet.

Sources and anchors used throughout:

- The gift price is **100 credits** (PLAN.md §2.6, draft), against the
  ruled **$5** cash price — a cash shadow price of **$0.05 per credit**.
- ECONOMY.md §7 prepares D44 at three candidates — **2 / 5 / 10 credits
  per verified hour** at 30% load, middle recommended — with an
  electricity floor of **≈ $0.00975 per hour** (65 W incremental draw
  above idle, $0.15 / kWh). §4 and §7 of this document reconcile those
  candidates against verification overhead; the reconciliation changes
  two of ECONOMY.md's downstream figures, and says so where it does.
- Player-facing language in this design is plain English throughout:
  players see "contributing", "verified work", "credits earned", and a
  load meter — never internal vocabulary.

---

## 1. Work-unit shape

### 1.1 The unit, defined

A **work unit** is the smallest thing the solver assigns, computes, and
verifies. Every unit is:

- **Bounded.** A unit declares, before it is assigned: its work class,
  its input size, its expected run time on a reference machine, a hard
  CPU-time budget, a hard memory budget, and a hard output size. A unit
  that exceeds any budget is killed by the client and reported as
  failed-by-budget; it is never allowed to run long "to finish up".
- **Self-describing.** A unit carries everything needed to compute and
  check it, and nothing else: a unit ID, the work-class ID and version,
  the input payload (or a content address for it), the parameters, the
  random seed where the class uses one, and the hashes below. A unit
  does not carry the identity of whoever requested the work, any other
  unit's data, or any account information.
- **Independently checkable.** A unit's result can be judged correct or
  incorrect without trusting the machine that produced it, without
  re-running any other unit, and without any state from the contributor's
  machine. If a proposed work class cannot meet this test, it does not
  enter the protocol — this is the protocol's admission rule, and it is
  what makes §4's verification possible at all.
- **Sized for a few minutes.** Target: **3–5 minutes of wall-clock time
  at 30% load on a modest machine** (a few years old, 4 cores, no
  discrete GPU). That sizing is deliberate:
  - Short enough that abandoning or losing a unit wastes minutes, not
    hours, and reassignment is cheap (§2).
  - Short enough that a player who opens the client for one short
    session still completes whole units and sees verified results.
  - Long enough that assignment, download, and submission overhead —
    seconds each — stay under ~2% of the unit's compute.
  - At this size, one contributed hour is **12–20 units**, which is the
    sample size §4's spot-checking arithmetic relies on.
- **Hashed at both ends.** The server records the SHA-256 of the unit's
  canonical input before assignment. The client submits the SHA-256 of
  its canonical output with the result, and the output itself. A result
  whose output hash does not match its payload, or whose input hash
  does not match the assigned unit, is rejected without further
  checking — cheap rejections happen before expensive ones.
- **Versioned.** Work classes are versioned, and a unit names its class
  version. When a class's algorithm changes, the version bumps; results
  from different versions are never compared against each other (§4's
  agreement checks compare like with like, always).

### 1.2 Determinism — the rule and the exceptions

**The rule: solver work is deterministic.** Same unit, same result,
byte for byte, on any honest machine. Determinism is what makes
agreement between independent contributors mean "correct" rather than
"similar". Work classes are admitted only if they can be made
deterministic: fixed seeds, fixed iteration counts, integer or
fixed-point arithmetic where floating-point rounding would diverge
across hardware, and canonical output ordering (sorted where the
natural computation is unordered).

Some useful work is not naturally deterministic. Three options for it,
in order of preference:

1. **Make it deterministic (recommended default).** Most apparently
   non-deterministic work is deterministic once the seed, the order of
   operations, and the numeric format are pinned. The cost is paid once,
   at class design time; the benefit — exact agreement checking — is
   collected on every unit forever.
2. **Tolerance checking.** Where outputs are legitimately approximate
   (floating-point simulations, iterative solvers), the class declares
   a tolerance, and two results "agree" if they match within it. This
   works, but it weakens §4: a fabricator can hide inside the tolerance
   band, producing cheap near-enough results. Tolerance classes should
   carry a higher canary rate (§4.3) to compensate.
3. **Exclude the class.** Work that can be neither determinised nor
   tolerance-checked with a narrow band does not run on the solver,
   however useful it would be. The protocol's credibility — credits mint
   only on proven work — is worth more than any single work class.

**Recommendation:** admit deterministic classes at launch; admit
tolerance classes only case by case, each with its tolerance and its
compensating canary rate stated in the class definition.

### 1.3 Candidate work classes — PREPARED FOR WILL — D42

D42 asks what the solver computes. The three candidates, each with
concrete unit types:

**(a) Nova Fox game infrastructure only**

Work the game itself needs, whose results land in the game:

- *World and pocket pre-generation.* Generate a pocket or world region
  from its seed and parameters ahead of any player visiting it, so first
  entry is instant. Deterministic by construction (the seed is the
  unit); the result is checked against the same generation the game
  would have done itself.
- *Shared-world integrity recomputation.* Recompute a region of the
  shared world's derived state (what stands where, in what condition)
  from its recorded history, and compare against the stored state.
  Disagreement flags a corrupted or tampered region for review. The
  unit is a slice of history; the result is a hash of the recomputed
  state — small output, independently checkable, and exactly the kind
  of work that gets more valuable as the world grows.
- *Render and prepass help.* Precompute the expensive, cacheable parts
  of presenting a place — lighting prepasses, distant-view summaries,
  thumbnail and preview renders at fixed settings. Fixed settings and
  fixed seeds keep it deterministic; outputs are hashed images or
  summary data other players' clients would otherwise each compute
  alone.

Strength: every unit visibly serves the game the contributor is
playing; the story a player tells themselves — "my machine helps run
our world" — is literally true. Weakness: the supply of game work is
bounded by the game's own needs; a large contributor pool could drain
the queue, and idle contributors earn nothing.

**(b) Exocortex jobs only**

Public work with public results, from the wider project:

- *Indexing.* Build or rebuild a slice of a search index over a public
  corpus: the unit is a document range, the result is the index slice
  and its hash. Anyone can spot-verify a slice against the corpus.
- *Format verification.* Check a slice of a large structured file for
  conformance — every record parses, every cross-reference resolves,
  every declared hash matches. The result is a pass/fail per record plus
  a summary hash. Pure, deterministic, and embarrassingly parallel.
- *Library stress-test placements.* Place test workloads against a
  public library's operations — run a declared sequence of operations
  from a seed, record the resulting state hash. Catches regressions and
  hardware-dependent behaviour precisely because many different machines
  run the identical sequence.

Strength: effectively unlimited work supply, and the work is useful
beyond the game. Weakness: the connection between a player's cycles and
the game they love is abstract; results need a public home or the work
feels like it vanishes; and each external class is its own admission
review under §1.1–1.2.

**(c) Both, behind one protocol with work classes — RECOMMENDED**

One protocol, one client, one verification system, one earn rate;
work is organised into named, versioned **classes**, and classes from
both sources are admitted under the same rules (§1.1, §1.2). Game
infrastructure classes ship first — they are the launch story and the
launch need — and Exocortex classes are admitted one at a time, each
publicly described, as they pass review.

Why this is the recommendation: the protocol is the hard part, and it
is identical either way. Building it for one source and retrofitting
the other would pay the hard cost twice. Class-level admission keeps
the quality bar where it belongs — per class, on checkability — rather
than per source. And a two-source queue solves (a)'s supply problem:
when game work runs dry, contributors fall through to public work
instead of idling, so the faucet's capacity does not rise and fall
with the game's internal needs.

The honest cost of (c): two queues to prioritise (game work should
win when both exist — it is the players' world), and a standing
admission process someone must actually run.

---

## 2. Assignment protocol

The protocol's shape is deliberately dull: the server decides, the
client computes, the server checks. Every interesting property —
fairness, farm resistance, verifiability — comes from who is allowed
to decide what.

### 2.1 Assignment: the server chooses, always

- **Players never choose units.** The server assigns the next unit
  from the queue for the contributor's hardware class. A client may
  declare capabilities (CPU class, memory, whether GPU work is
  acceptable) and the server assigns only units those capabilities
  fit — but within that, assignment is the server's, unpredictable to
  the client in advance. This is anti-cherry-picking in both
  directions: a contributor cannot select easy units to inflate their
  completion count, cannot select units whose answers they already
  know, and cannot avoid canary units (§4.3) — because nobody, client
  included, can tell which units are canaries.
- **Redundant copies go to strangers.** When a unit is assigned more
  than once (§4.2), the copies go to contributors with no shared
  account, no shared machine fingerprint, and — as far as network
  signals show — no shared connection. Agreement only means something
  when the agreers are independent.
- **One active unit per client by default.** A client holds one lease
  at a time (§2.2). A player who wants to contribute more runs the one
  client at the one cap (§3); parallel self-assignment is a farm shape
  (§5), not a feature.

### 2.2 Lease, claim, submission

1. **Lease.** Assignment comes with a **lease**: the unit ID, the
   input (or its content address), the deadline, and the budgets
   (§1.1). The deadline is **twice the unit's expected run time on the
   contributor's hardware class, plus a fixed grace of two minutes** —
   generous to slow and interrupted machines, short enough that a dead
   lease recycles its unit within roughly ten minutes.
2. **Claim committed before work begins.** On accepting a lease, the
   client immediately returns a **claim**: the unit ID, the input hash,
   the client's session identifier, and a client-generated nonce,
   hashed together. The server records the claim and its time before
   the client starts computing. This ordering matters: it proves the
   contributor held *this* unit from *this* time, so a result cannot
   be copied from another contributor's earlier submission and
   presented as fresh work, and a client cannot wait to see whether a
   unit is "worth" finishing before committing to it.
3. **Submission.** Before the deadline, the client submits: the unit
   ID, the claim nonce, the output, and the output hash. The server
   checks, in order: lease still valid → input hash matches the
   assigned unit → output hash matches the output → the verification
   pipeline of §4. Credits are discussed in §4.5; nothing mints at
   submission time, only at acceptance.
4. **Heartbeat (optional, cheap).** A client may send one heartbeat
   mid-lease ("still working, roughly half done"). Heartbeats never
   extend a deadline; they exist so the server can distinguish a slow
   honest machine from a vanished one when it schedules redundant
   copies.

### 2.3 Timeout, abandonment, and standing

- **On timeout or abandonment, the unit returns to the queue** and is
  reassigned. The work is never lost; only time is.
- **First offence: no penalty.** Machines sleep, laptops close,
  connections drop. A lease that expires is assumed to be life, not
  misconduct, and the design says so to the player in those words.
- **Repeated abandonment has standing effects, not fines.** A rolling
  measure — completed leases ÷ accepted leases over the last 100
  leases — is the contributor's **completion standing**. Below 80%,
  the client is offered shorter, cheaper units first (less is wasted
  when one is dropped) and its offline queue (§2.4) shrinks. Below
  50%, new leases pause until the contributor completes a short
  probationary run. Standing never touches credits already earned, and
  it recovers automatically with completed work. The principle:
  abandonment is a reliability signal, so it is answered with
  reliability measures — never by confiscating earnings, which would
  punish exactly the honest-but-unstable machines (old laptops, shared
  family computers) the solver most wants to welcome.
- **Deliberate lease-hoarding** — accepting leases to deny units to
  others while completing none — is indistinguishable from abandonment
  at the protocol level and is handled by the same standing ladder;
  at pool scale it also fails on its own terms, because the queue is
  deep and units recycle in minutes.

### 2.4 Offline queuing limits

A client may pre-fetch a small queue so a network gap does not idle
the machine:

- **At most 3 units** held offline, **at most 1 hour** of expected
  work, whichever is smaller.
- Queued units keep their leases; a queued unit whose deadline passes
  while offline is simply dead on reconnect — submitted late results
  are not accepted, because a result that sat unseen for an hour
  cannot be distinguished from a result copied during that hour.
- Canary discipline is preserved offline: the queue is filled by the
  server in assignment order, so a client cannot stockpile, inspect,
  and selectively complete. (A client that completes queued units
  selectively shows it in its completion standing and in the pattern
  of *which* units come back — §5.4.)
- No offline earning beyond the queue: a client that has been offline
  a day has done, at most, one hour of creditable work. Generous
  offline earning and verifiable earning are opposites; this design
  chooses verifiable.

---

## 3. The 30% load cap

The cap is ruled (PLAN.md §2.13: "self-throttled to 30% load"). What
"30%" means, how the honest client enforces it, and what the server
can and cannot check are all design — prepared here.

### 3.1 What 30% means — three readings

| Reading | What it means in practice | Player experience |
|---|---|---|
| **(a) 30% of one core** | On a 4-core machine, the solver uses about 7.5% of total capacity; on an 8-core machine, under 4% | Barely noticeable anywhere; also barely any work done on big machines, and wildly unequal contribution between a 2-core laptop and an 8-core desktop for the same credits-per-hour rate |
| **(b) 30% of total CPU** | The solver may use 30% of all cores combined, continuously | Real contribution that scales with the machine; a steady warmth and fan presence; on a modest machine, a third of the computer is genuinely spoken for, all the time |
| **(c) Duty-cycled bursts within a 30% average** | The solver works in short full-speed bursts on the cores it uses, then idles, averaging 30% of total CPU over a rolling window (draft: 5 minutes) | The machine breathes: brief activity, then quiet. Games, video, and the player's own work slip into the quiet gaps far more easily than under a continuous load, and modern CPUs handle bursty work at better efficiency than a pinned partial load |

**Recommendation: (c), defined as 30% of total CPU capacity averaged
over a rolling 5-minute window, duty-cycled.** It is the only reading
that is simultaneously fair across machine sizes (unlike (a)),
polite to live on (unlike (b)), and measurable in one unambiguous
number the client can show the player (§6.3): "your average load from
the solver over the last five minutes", against a line drawn at 30%.

### 3.2 Client-side enforcement

The honest client enforces the cap on itself, in three layers:

- **Duty-cycle governor.** The worker runs in slices (draft: 100 ms
  of work, then sleep for the remainder of the slice period the
  current duty cycle requires). The governor adjusts the duty cycle
  continuously to hold the rolling 5-minute average at or under 30%.
  If the player's own work spikes, the solver's share of the *total*
  is what is capped — the governor measures solver-caused load, not
  machine load, so a player compiling code does not owe the solver a
  pause; the solver simply stays within its own 30% regardless.
- **Rolling-window measurement.** The client measures its own
  processes' CPU time from the operating system's accounting (not
  from its own estimates), over the same 5-minute window the cap is
  defined on, and feeds the measurement to the governor. What is
  enforced is what is measured is what is displayed (§6.3) — one
  number, three uses, no room for the three to drift apart.
- **OS scheduling niceness.** Solver workers run at the operating
  system's lowest scheduling priority (nice / idle priority class)
  and, where the OS supports it, in its efficiency / background QoS
  class. Even inside its 30%, the solver should lose every contest
  for the CPU against anything the player is actually doing. The cap
  limits how much the solver takes; niceness decides who wins when
  both want it — the player, always.

### 3.3 Server-side plausibility

The server cannot see the player's machine. What it can see is
**time**: when each unit was claimed and when its result arrived,
across thousands of units and contributors. That is enough for
plausibility, in the statistical sense:

- For each hardware class, the server keeps the **distribution of
  honest completion times** per work class: median, spread, and the
  fast tail. An honest throttled machine's times cluster; they cannot
  be arbitrarily fast, because the throttle is arithmetic — a unit
  sized for 4 minutes at 30% load contains roughly 72 seconds of
  full-speed CPU work, and no honest client returns it in 20 seconds
  of wall time, every time, for a week.
- A client whose completions sit persistently in the implausible
  tail — say, below the 1st percentile of its hardware class, as a
  pattern rather than once — is flagged. Once could be a mis-declared
  hardware class; a pattern is either a much faster machine than
  declared (the fix is reclassification, offered automatically) or an
  unthrottled or faking client (§4.3's ladder applies).
- The same distributions catch the opposite fraud: results returned
  *too uniformly* — identical timings to the second, hour after hour —
  which real throttled machines, buffeted by the player's own
  activity, never produce (§5.4).

### 3.4 The honest limit, stated plainly

**A patched client can lie about its own load.** The solver runs on
the player's machine, under the player's control; someone determined
to run it at 100% load, or to strip the governor out, can. No
client-side enforcement survives the person who owns the computer,
and this design does not pretend otherwise.

So the cap's real enforcement is **economic, not technical**:

- Credits pay for **verified units** (§4), at rates (§7, D44) that
  assume honest throttling. Running unthrottled finishes a unit
  sooner but earns **exactly the same credits for it** — the rate is
  per unit of verified work, never per minute and never with a speed
  bonus. There is nothing to win by burning the machine harder,
  except finishing sooner a fixed amount of paid work — after which
  the daily cap (§5.2) is the wall, and it does not move for fast
  machines either.
- **Over-speed returns are treated as a fraud signal, not a bonus**
  (§3.3): they draw scrutiny, canary attention, and standing
  consequences. The incentive gradient points the right way — honesty
  is the best-paid strategy available — which is the strongest
  enforcement a voluntary client on someone else's machine can have.

What the cap *does* guarantee, and what players should be told it
guarantees: **the honest client — the one we ship, unmodified —
never takes more than 30%.** That is a promise about our software,
kept by §3.2 and shown on the meter (§6.3). It is not, and is never
worded as, a promise about what modified software might do.

---

## 4. Result verification — with the math

Credits mint only on verified work. Two mechanisms are designed here
to compose: **redundancy** (independent contributors compute the same
unit and must agree) and **spot-checking with canary units**
(known-answer units mixed invisibly into the stream). Either alone
has a hole the other covers: redundancy alone is beaten by collusion
at scale; canaries alone catch fakers only probabilistically per
unit and say nothing about honest-but-wrong results (a buggy client,
an overheating machine). Together: redundancy catches error,
canaries catch intent.

### 4.1 Terms

- *k* — the redundancy factor: how many independent contributors
  compute the same unit.
- *p* — the colluding fraction of the contributor pool: the share of
  assignments that land on machines controlled by one coordinating
  faker, all returning the same fabricated result.
- *c* — the canary rate: the fraction of assignments that are canary
  units.
- *f* — the fraction of a given client's results that are fabricated.
- *N* — the number of units a client completes in the period under
  consideration.

All probabilities below assume assignments are independent — which is
why §2.1 assigns copies to strangers and never lets clients choose
units. Break the assignment independence and every formula in this
section is optimistic.

### 4.2 Redundancy

**Design:** each unit is computed by *k* independent contributors.
Acceptance rules considered:

- **First two agreeing (k = 2, unanimity of two):** the first two
  results submitted are compared; if they agree exactly (or within
  tolerance, §1.2), the result is accepted and both contributors are
  in line for credit. If they disagree, the unit escalates (§4.4).
- **Majority of k (k = 3 or 5):** all k results are collected; the
  majority value is accepted.

**Overhead.** Redundancy multiplies the compute spent per useful
unit by *k*. As a share of all contributed compute, the redundant
fraction is (k − 1) / k:

| k | Compute per useful unit | Share of contributed compute that is redundancy |
|---:|---:|---:|
| 1 | 1× | 0% — no protection; not proposed for credit-bearing work |
| 2 | 2× | **50%** |
| 3 | 3× | 67% |
| 5 | 5× | 80% |

**Fabrication acceptance.** A fabricated result is accepted only if
the acceptance rule is satisfied by colluders alone (honest
contributors return the true result, which a fabricator cannot match
without doing the work — matching it *is* doing the work):

- k = 2, first two agreeing: both copies must land on colluders.
  **P = p²**
- k = 3, majority: at least 2 of 3 copies on colluders.
  **P = 3p²(1 − p) + p³**
- k = 5, majority: at least 3 of 5 copies on colluders.
  **P = 10p³(1 − p)² + 5p⁴(1 − p) + p⁵**

| Colluding fraction p | k = 2, two agreeing | k = 3, majority | k = 5, majority |
|---:|---:|---:|---:|
| 1% | 0.010% | 0.030% | 0.001% |
| 5% | 0.25% | 0.73% | 0.12% |
| 10% | 1.0% | 2.8% | 0.86% |

Two readings matter:

1. **Unanimity-of-two is stricter than majority-of-three.** k = 3
   majority *raises* fabrication acceptance versus k = 2 (a faker
   needs only 2 of 3 seats, not both of 2), while costing half again
   as much compute. Majority rules buy smoothness — fewer disputes,
   a result even when one contributor vanishes — not strictness.
   Strictness comes from requiring agreement among *all* copies
   counted, which is why the recommended design (§4.4) accepts on
   two agreeing and uses the third copy only as a tie-breaker on
   dispute, where it is compared against both claimants rather than
   voted in blindly.
2. **Even the worst cell is small, and it is not the real defence.**
   At a 10% colluding pool — an enormous, expensive infiltration —
   k = 2 still rejects 99% of fabricated results on first pass, and
   every rejection is a detection event feeding §4.3's ladder and
   §5.4's pattern analysis. Redundancy's second job is generating
   that evidence.

**The cost of disagreement.** Honest disagreement happens: a buggy
client version, marginal hardware, a tolerance class at its edge.
Disagreement is not treated as fraud (§4.4's ladder starts from
standing, not accusation), but a client whose results disagree with
its partners far above the pool's base rate is a client whose work
cannot be trusted — its results stop being counted as the agreeing
copy until its disagreement rate returns to normal. This also closes
a subtle hole: a faker cannot grind the system by forcing endless
disputes, because chronic dispute follows the *disagreer*.

### 4.3 Spot-checking with canary units

**Design:** a fraction *c* of all assignments are **canary units** —
units whose correct result the server already knows (computed by the
server itself, or retired real units with long-accepted results,
re-issued). A canary is indistinguishable from a real unit in every
client-visible respect: same classes, same size distribution, same
lease terms. The contributor learns a unit was a canary only by
failing one.

**Detection math.** A client fabricating a fraction *f* of its
results fabricates, in expectation, *fN* of the *N* units it
completes — and each fabricated result independently has probability
*c* of being a canary it will certainly fail (a fabricated answer to
a known-answer unit is wrong, and *provably* wrong — no dispute, no
tolerance argument). The probability of escaping detection across
the whole period is (1 − c)^(fN), so:

> **P(detection) = 1 − (1 − c)^(fN)**

Take *N* = 200 units — at 12–20 units per contributed hour (§1.1),
roughly **10–16 contributed hours, about a week for a regular
earner**:

| Canary rate c | Faking f = 10% (20 fakes) | Faking f = 50% (100 fakes) | Faking f = 100% (200 fakes) |
|---:|---:|---:|---:|
| 1% | 18% | 63% | 87% |
| **2%** | **33%** | **87%** | **98%** |
| 5% | 64% | 99.4% | ≈ 100% |

Readings:

- **Against heavy fakers, canaries are decisive at any rate.** A
  client faking everything is caught within a week with 87–100%
  probability; extend the window to a month (N ≈ 800) and even
  c = 1% catches a full faker with probability above 99.9%. Faking
  everything is the only strategy that earns a farm real money
  (§5) — and it is the strategy canaries are best at catching. That
  alignment is the point of the mechanism.
- **Against light fakers, canaries alone are slow** — a client
  faking 10% escapes a week at c = 2% two times in three. But a 10%
  faker is also redundancy's easiest case (their fakes must survive
  §4.2's agreement check, which rejects ~99.75% of them at p = 5%),
  and each rejection is evidence. The mechanisms compose precisely
  here: canaries bound the *scale* of profitable faking, redundancy
  bounds the *rate* of it getting paid.
- **Canary failures are the one unambiguous signal in the system.**
  A redundancy disagreement can be honest error; a canary failure
  cannot — the answer was known. That is why the consequence ladder
  below is allowed to be firmer than anything disagreement triggers.

**Consequence ladder for canary failures** (standing-based, stated
to players in plain terms at onboarding):

1. **First failed canary:** warning, in plain words ("one of the
   check tasks in your recent work came back wrong"), and the
   client's canary rate quietly rises for a probationary window.
   One failure can be a corrupted download or a dying disk; the
   ladder starts gentle because the honest explanations are real.
2. **Second failure inside the window:** **rate cut** — earnings
   per verified unit halve, and the probationary canary rate rises
   again. The client is told its rate changed and why.
3. **Third failure, or a failure pattern with no honest shape:**
   **standing loss** — earning pauses for the account, completed
   but unpaid verifications are voided, and return requires a
   clean probationary run at the raised canary rate. Credits
   already paid and spent are not clawed back — clawbacks would
   poison every honest player's trust in the faucet's finality —
   but credits paid and *unspent* on a standing-lost account are
   frozen pending the probationary run.

### 4.4 The recommended combined design — PREPARED FOR WILL — D43

> **k = 2 redundancy on every credit-bearing unit (first two
> agreeing accept), canaries at c = 2% of all assignments, and
> escalation to a third independent copy (k = 3, tie-break) on any
> disagreement — with the third copy's contributor also checked
> against both originals, so a dispute produces evidence about
> *which* side disagrees with the pool, not just a verdict.**

Why this shape:

- k = 2 unanimity is the strictest cheap rule (§4.2), and its
  weakness — a dispute leaves no verdict — is exactly what the
  escalation copy fixes, at a cost paid only on disputes. If honest
  disagreement runs at ~1% of units, escalation adds ~0.5% to total
  compute: a rounding term, budgeted below.
- c = 2% sits at the knee of the canary table: doubling to 5% buys
  real detection against light fakers but spends 5% of the entire
  pool's compute on theatre; halving to 1% leaves a full faker a
  13% chance of surviving their first week. 2% plus §4.2 plus time
  (detection compounds weekly; farms must survive *every* week) is
  the defensible middle.
- Everything is checked; nothing is trusted. There is no tier of
  "established contributor" whose results skip redundancy — standing
  (§2.3, §4.3) modulates canary rates, caps, and queue priority,
  never the agreement requirement. The day a trusted tier exists,
  compromising one trusted account becomes the whole attack.

### 4.5 Total overhead, and the reconciliation with D44

**Overhead accounting** (share of all contributed compute):

| Component | Share of contributed compute |
|---|---:|
| Redundancy at k = 2 (one of every two copies of a real unit is a check copy) | 49% of total (50% of the 98% that is real work) |
| Canary units at c = 2% (compute spent on known-answer checks, producing no new useful result) | 2% |
| Dispute escalation (third copies, at a ~1% honest disagreement rate) | ≈ 0.5%, inside rounding |
| **Total verification overhead** | **≈ 51% of contributed compute** |
| **Useful work delivered** | **≈ 49% of contributed compute** |

Formally: useful fraction = (1 − c) × (1 / k) = 0.98 × 0.5 = **0.49**.

**Reconciliation with D44.** ECONOMY.md §7 states its candidates per
*verified hour* without separating useful work from verification
work. This draft recommends D44 be defined — and worded to players —
as a rate per **useful verified hour**: one hour of unique, accepted
work delivered to the system. Under that definition, an honest
contributor's wall-clock hour at 30% load delivers, in expectation,
0.49 useful hours, and nets:

| D44 candidate (per useful verified hour) | Honest net per contributed hour | Contributed hours to earn a gift (100 cr) | Electricity cost per net credit |
|---:|---:|---:|---:|
| Slow — 2 | **0.98 credits** | ≈ 102 h | ≈ $0.0099 |
| **Middle — 5 (recommended, §7)** | **2.45 credits** | **≈ 41 h** | **≈ $0.0040** |
| Fast — 10 | **4.90 credits** | ≈ 20 h | ≈ $0.0020 |

Three consequences, stated plainly because they move other
documents' numbers:

1. **The gift by cycles takes ≈ 41 contributed hours at the middle
   rate, not 20.** ECONOMY.md §7's "20 verified hours" is correct in
   its own terms (20 *useful verified* hours); a player's machine
   must run ≈ 41 hours to deliver them. Player-facing wording must
   use the 41-hour figure — the hours a person actually experiences
   are wall-clock hours, and a faucet that quietly takes twice the
   advertised time would be found out in the first week and believed
   about nothing afterwards.
2. **The electricity floor roughly doubles per credit** — from
   ECONOMY.md's $0.0020 to ≈ $0.0040 per credit at the middle rate —
   because the contributor's electricity pays for the check copies
   too. The floor still sits far under the $0.05 cash shadow price
   (≈ 8% of it), so the floor disciplines farming margins exactly as
   ECONOMY.md §7.3 describes; it is simply a firmer floor than the
   unverified arithmetic suggested.
3. **ECONOMY.md §6's solver timelines double.** A free solver-earner
   at the middle rate, 2 contributed hours a day, nets
   2 × 2.45 × 30 ≈ **147 credits a month, not 300** — and self-arms
   a full kit (2,850 credits) in **≈ 19.4 months, not ≈ 9.5**. §7's
   D47 recommendation below is written against the corrected figure.
   The correction cuts both ways: the solver is a slower road than
   ECONOMY.md modelled, for honest players and for farms alike.

The alternative definition — rate per *contributed* hour, overhead
minted on top — was considered and is not recommended: it would mint
roughly twice the credits per useful unit that D44's candidates were
sized against, silently doubling the faucet ECONOMY.md §5's
inflation analysis has to carry. Defining the rate on useful work
keeps the faucet the size Will picks in D44. That, ultimately, is
what "the rate" should mean.

---

## 5. Anti-farm measures — PREPARED FOR WILL — D45

The threat, named plainly: one person, many solver instances or many
identities, multiplying the faucet without multiplying real,
verifiable work — or multiplying the identities while the work stays
real, to multiply caps and ramps that are set per account. The
measures below are layered; no single one carries the defence.

### 5.1 Identity anchor

Every solver account is anchored to the **phext.tech sign-in the
shared world already uses** (PLAN.md §2.6's anti-abuse shape). No
second identity system, no identity checks beyond the account. One
account, one credited solver stream: an account may register
machines, but only **one active credited lease per account** at a
time (§2.1) — a second machine is a convenience (home and laptop),
never a second faucet.

### 5.2 Per-account caps and diminishing returns

- **Daily earn cap (draft): 15 credits per account per day**,
  counted in net earned credits. At the recommended middle rate
  (§4.5) that is ≈ 6 contributed hours at full value — generous for
  a machine that also has a human using it, and a hard ceiling for
  one that doesn't.
- **Diminishing returns before the cap:** hours beyond the fourth
  contributed hour in a day earn at half rate, so the cap is
  approached along a slope, not a cliff — honest long-runners are
  slowed, not stopped dead, and the marginal hour a farm adds is
  the least valuable hour in the system.
- Caps bind *earning*, never *contributing*: a capped player may
  keep the solver running as a gift to the pool, and the client
  says so in those words. Some will. That is a feature the design
  is proud of, not a leak.

### 5.3 New-account ramp

Earning starts small and grows with standing:

- **Days 1–7:** daily cap at 25% (draft: ≈ 4 credits/day), canary
  rate at the raised probationary level (§4.3).
- **Weeks 2–4:** cap at 50%, canary rate stepping down as clean
  units accumulate.
- **After 30 days of clean standing:** full cap, standard canary
  rate.
- Standing is per account *and* sticky to the identity anchor: a
  fresh account starts at the bottom of the ramp every time, so
  burning an account to escape its history costs the farm a month
  of low-yield ramp per replacement. The ramp is the Sybil tax —
  it cannot be paid once and shared.

### 5.4 Result-pattern analysis

Beyond per-unit checks, the server watches shapes no honest fleet
produces:

- **Timing fingerprints.** Identical machines returning identical
  completion timings (§3.3) — a farm's images are one image, and
  it shows. Clusters of accounts whose timing distributions are
  statistically indistinguishable are treated as one contributor
  for assignment independence (§4.1) and reviewed as one actor
  for caps.
- **Agreement clusters.** Accounts that are assigned together and
  agree with each other at rates far above the pool — the
  signature of collusion discovering itself — lose assignment
  independence first and standing second.
- **Selective completion.** Accounts whose returned units are
  systematically the *easy* ones (short-expected-time units
  completed, long ones abandoned) are visible against §2.3's
  standing data; cherry-picking that survives assignment (§2.1)
  still has to survive arithmetic.

### 5.5 Sybil arithmetic — what 100 fake identities actually yield

At the recommended design (middle D44 rate as reconciled in §4.5:
2.45 net credits per contributed hour; daily cap 15 credits per
account; ramp as §5.3 — the arithmetic below is generous to the
farm and assumes all 100 identities are *past* the ramp, at full
cap, which itself takes each of them a clean month):

| Quantity | Value |
|---|---:|
| Maximum yield, 100 identities at cap | 100 × 15 = **1,500 credits / day** |
| In gifts | 1,500 ÷ 100 = **15 gifts / day** (≈ $75/day at the $5 shadow price) |
| Real compute required to earn it | 1,500 ÷ 2.45 ≈ **612 machine-hours / day** |
| Machines required | ≈ **26 machines running 24 h**, or ≈ 102 machines running a plausible 6 h |
| Electricity for that compute | 612 × $0.00975 ≈ **$5.97 / day** |
| Hardware to do it | ~26 modest machines — on the order of **$7,800** of hardware, before space, cooling, and attention |
| Time to repay the hardware *if* gifts could be sold at full price | ≈ 113 days of perfect, uninterrupted, full-cap operation |

And the three facts that make the headline number a poor farm
target in practice:

1. **Identities do not multiply compute.** The 1,500-credit day
   needs 612 machine-hours of *verified* work no matter how it is
   sliced. A farm with 5 real machines and 100 identities earns at
   most 5 × 24 × 2.45 ≈ **294 credits a day** — the identities add
   nothing; the cap that binds is physics. Sybil identities only
   help a farm against *per-account* caps, and the per-account cap
   is deliberately set where one honest machine can nearly reach
   it, so there is little per-account headroom for identities to
   unlock.
2. **Credits are not cash.** The yield is gifts and power-ups
   inside one game — there is no withdrawal, no transfer back into
   money, and gifts are one-way (PLAN.md §2.6). Monetising the
   yield means finding buyers for gifted copies of a $5 game, at a
   discount, through channels that leave the identity anchor all
   over them. The $75/day is a shadow price, not a revenue line.
3. **The farm must survive verification every day it operates.**
   At full-cap volume, each identity completes ~120 units a day;
   §4.3's detection compounds across all of them, and the ramp
   (§5.3) means a burned identity is replaced at 25% yield for a
   week. The farm's expected lifetime, not its daily yield, is
   what the design actually taxes.

### 5.6 The honest limit, again

**Determined farms are slowed and made unprofitable, not made
impossible.** A patient operator with real machines, doing real
work, rotating identities through real ramps, will earn credits —
because at that point the operator is, mechanically, a large honest
contributor with unusual account habits. The design's claim is
narrower and keepable: *fake* work does not pay (§4), *multiplied*
identities do not multiply earnings beyond real compute (§5.5), and
the remaining road — real machines doing real verified work for
in-game credits with no cash exit — is a road whose economics
defend themselves.

---

## 6. Client behaviour — PREPARED FOR WILL — D46

The solver runs on other people's computers, in other people's
homes, next to other people's work. Its behaviour rules are the
product. A solver that surprises its owner once — a hot laptop in a
meeting, a drained battery on a train, a fan during a film — is a
solver uninstalled forever, and it takes the faucet's reputation
with it.

### 6.1 Non-negotiable behaviour rules (draft, recommended as a set)

- **Opt-in only, never on by default.** The solver is off after
  install, off after every update, and off after any crash, until
  the player turns it on again and sees the load meter (§6.3) while
  doing so. No pre-ticked boxes, no "recommended settings" that
  include it. Consent that has to be renewed is the only kind that
  survives contact with a bad week.
- **Pause on battery.** On a laptop, the solver pauses when the
  machine leaves mains power, and does not resume on battery at
  all below a **50% charge threshold** (player-adjustable, never
  below 20%). It resumes automatically on mains power. A player
  should never have to choose between the solver and the train
  journey.
- **Pause on the player's own life.** The solver pauses while a
  full-screen game or video is in the foreground, while the
  machine's user is actively working in bursts the governor reads
  as contention, and during screen-sharing / presentation mode
  where the OS exposes it. Contributing is background by definition;
  the moment it is foreground competition, it has failed.
- **Thermal back-off.** If the machine's thermal state rises
  (OS-reported pressure, fan / temperature signals where available),
  the governor steps the duty cycle down in stages — 30% → 20% →
  10% → paused — and steps back up only after a sustained cool
  period. Heat is the cost players feel in their hands; it is
  managed first, before deadlines, before queue depth, before
  anything.
- **Quiet hours.** Players set quiet hours (draft default suggestion
  at onboarding: none — the player picks). During quiet hours the
  solver does not run, full stop, including resuming.
- **One-click stop that stops now.** The stop control halts work
  within one governor slice (~100 ms), releases the lease (§2.3 —
  a stopped unit is an abandoned unit, first-offence rules apply
  and the client says so reassuringly), and stays stopped. Not
  "stops after this unit", not "stops when the queue drains".
  *Now* is the feature; everything else in this section is
  commentary on it.

### 6.2 Run shapes — the three options

| Shape | How it works | Consequences |
|---|---|---|
| **(a) In-game only** | The solver runs only while Nova Fox is open and the player is playing (or has it open) | Simplest consent story — the machine is already awake for the game; contribution tracks play, so solver income correlates with being a player, which flatters D47 either way. But the ceiling is low: play sessions are hours, and the machines are busy *being the game* while they run — the 30% is genuinely contested. The faucet stays small |
| **(b) Companion app** | A separate small application, installed and consented to on its own, running the solver under §6.1's rules whether or not the game is open | The full faucet: machines contribute through the workday and the evening, under the player's rules. The honest costs: a second install to explain and support, a second consent to earn, and a standing temptation — resisted in §6.1 — to make it quieter and more automatic than consent allows |
| **(c) Opt-in background service** | The solver installs as a background service that survives reboots and runs whenever the machine is on, under §6.1's rules | Maximum contribution and maximum risk in one shape: "runs when I'm not looking" is precisely what players fear about contributed-compute software, and one bad story — true or not — attaches to the game's name permanently. Every safeguard in §6.1 has to be perfect, forever, on every machine |

**Recommendation: (b), the companion app** — with (a) available
inside the game as the same client's second door (a player who
never installs the companion can still contribute while playing).
(c) is not recommended at any maturity: the marginal compute is
not worth being the game that people warn each other about. The
companion's separateness is the consent: it has its own icon, its
own meter, its own stop button, and its own uninstall, and it
never arrives bundled silently with the game — it is offered,
once, in plain words, and a "no" is remembered permanently.

### 6.3 The load meter — showing the actual number

The client shows, always, while running:

- **The measured solver load** — the same rolling 5-minute average
  the governor enforces (§3.2), as a plain bar against a marked
  30% line. Measured from the OS, never estimated from work done.
- **Session facts:** units completed, units verified, credits
  earned (this session and today, against the daily cap), and the
  machine's pause state with its reason in plain words ("paused —
  on battery", "paused — you're watching a video", "slowed —
  machine is warm").
- **The stop button**, beside the meter, always (§6.1).

The meter is a trust instrument before it is a UI element: a
player who can *see* 30% being kept does not have to believe it.

---

## 7. Decisions D42–D47 — PREPARED FOR WILL

Each decision below is presented with its options, the trade-offs,
and a marked recommendation. **None is ruled. All are Will's.**

### D42 — Work units: what the solver computes

- **(a) Game infrastructure only** — bounded supply, perfect story
  (§1.3).
- **(b) Exocortex jobs only** — unbounded supply, abstract story,
  public results need a public home.
- **(c) Both behind one protocol with work classes** — game classes
  first, public classes admitted one at a time under the same
  checkability rules.
- **RECOMMENDATION: (c).** The protocol is the hard part and is
  identical either way; classes keep the quality bar per class;
  two sources keep the queue — and therefore the faucet — from
  draining when game work runs dry.

### D43 — Verification shape

- **(a) Redundancy only** — strict against error, beaten slowly by
  collusion, blind to intent.
- **(b) Spot-checking only** — cheap, decisive against heavy
  fakers over time, but light fakers get paid for weeks and
  honest-but-wrong results are never caught.
- **(c) Both, composed (recommended design, §4.4)** — k = 2
  redundancy on every unit, canaries at c = 2%, third-copy
  escalation on dispute. Total overhead ≈ 51% of contributed
  compute; useful fraction 49%.
- **RECOMMENDATION: (c).** Each mechanism covers the other's hole
  (§4, opening), and the combined overhead — while real, and
  charged honestly against the earn rate in §4.5 — buys the only
  property the faucet cannot survive without: credits that provably
  correspond to work.

### D44 — The earn rate

Candidates from ECONOMY.md §7, restated on this draft's
recommended definition (per **useful verified hour**, §4.5), with
the honest contributed-hour net shown beside each:

| Candidate | Per useful verified hour | Net per contributed hour | Gift (100 cr) in contributed hours |
|---|---:|---:|---:|
| Slow | 2 | 0.98 | ≈ 102 h |
| **Middle** | **5** | **2.45** | **≈ 41 h** |
| Fast | 10 | 4.90 | ≈ 20 h |

- **RECOMMENDATION: the middle candidate, 5 credits per useful
  verified hour — 2.45 net credits per contributed hour.**
  ECONOMY.md §7.4's reasoning survives the overhead correction:
  play as a generator (10 credits per active hour, ECONOMY.md P4)
  remains the fastest road by a wide margin — now ~4× the solver's
  net rate rather than 2× — so the solver is a second road, never
  a replacement for play. A gift at ≈ 41 contributed hours is a
  real commitment of machine time that still reads as reachable;
  at the slow candidate (≈ 102 hours) the faucet risks the
  irrelevance ECONOMY.md warned of, and at the fast candidate a
  solver hour nets half a generator's play hour for no play at
  all, which is the swallowing-play failure in a milder but real
  form.

### D45 — Farm resistance

- **(a) Rate-only defence** — set the rate low and let electricity
  economics do the work. Rejected by ECONOMY.md §7.3's own
  arithmetic: at every candidate, electricity is 2–10% of the
  shadow price; the floor alone stops nobody.
- **(b) Identity and caps only** — anchor, daily caps, ramp
  (§5.1–5.3), no pattern analysis. Stops casual multiplication;
  a disciplined farm runs under it indefinitely.
- **(c) Layered (recommended)** — identity anchor + one credited
  stream per account + daily cap (15 credits, draft) with
  diminishing returns + new-account ramp + result-pattern
  analysis, on top of §4's verification (§5).
- **RECOMMENDATION: (c).** The Sybil arithmetic (§5.5) is the
  reason in one line: under (c), 100 fake identities yield at
  most what ~26 real machines' worth of verified work can earn —
  identities multiply nothing, fake work pays nothing, and the
  residual road is real work for credits with no cash exit.

### D46 — Run conditions and the 30% cap

- **Cap definition:** (a) 30% of one core / (b) 30% of total CPU
  continuously / **(c) 30% of total CPU, rolling 5-minute average,
  duty-cycled (recommended, §3.1)**.
- **Run shape:** (a) in-game only / **(b) companion app, with an
  in-game door (recommended, §6.2)** / (c) background service
  (not recommended at any maturity).
- **Enforcement honesty:** client governor + measurement +
  niceness (§3.2); server plausibility on completion-time
  distributions (§3.3); and the stated limit that a patched
  client can lie, answered economically — pay per verified unit,
  never per speed, and treat over-speed as a fraud signal (§3.4).
- **RECOMMENDATION: cap (c), run shape (b), §6.1's behaviour
  rules as a set** — opt-in only, battery / activity / thermal
  pauses, quiet hours, the true load meter, and one-click stop
  that stops now.

### D47 — Earner eligibility

Who may contribute cycles and earn credits. This decision
interacts with D12 (the fork, PLAN.md §2.7) but is not settled by
it — ECONOMY.md §6's central finding is that **solver eligibility
matters more than the fork**: under either fork, an open solver
is a free player's largest credit road by an order of magnitude,
and a closed solver leaves the fork's own faucets (under Fork B,
≈ 9–34 credits a month) as small change beside it.

Options:

- **(a) Paid players only.** The solver becomes another paid-tier
  advantage — obvious, like generator status. Costs: the work
  faucet's founding story ("anyone can earn their way in by
  contributing") dies; the contributor pool is capped at the paid
  population, which is the population least in need of the work
  done cheaply and, at launch, the smallest; and a free player
  watching the solver in the shop window they cannot use is
  Fork A's texture problem (§2.7) repeated in a second system.
- **(b) Both, on identical terms.** The solver is a pure work
  faucet: the machine does not know or care what tier its owner
  is. Cleanest to explain, largest pool, and the strongest
  version of the road-in story. Under the corrected rate (§4.5),
  a free solver-earner at 2 contributed hours a day nets
  ≈ 147 credits a month and self-arms a full kit in
  **≈ 19.4 months** — half the speed ECONOMY.md §6 modelled
  (its ≈ 9.5 months used the unreconciled rate), and roughly
  half the speed of a generator *casual* arming by play
  (≈ 9.5 months). The road is real and it is slow; both halves
  of that sentence are the design working.
- **(c) Both, with free earners under a tighter cap and the
  standard ramp (recommended).** Free accounts earn at the same
  rate per verified unit — a two-tier rate would make free work
  literally worth less for identical verified output, which
  players would read, correctly, as the work not being the point
  — but under a **lower daily cap (draft: 8 credits/day against
  the standard 15)** and §5.3's ramp in full. A free earner who
  gifts themselves into the paid tier with solver credits — the
  road completing itself — steps up to the standard cap the
  moment the gift lands.
- **RECOMMENDATION: (c).** Reasoning, against ECONOMY.md §6's
  analysis with §4.5's correction applied: the fear under (b)
  was a free company arming itself in ≈ 9.5 months and the paid
  advantage dissolving; at the verified net rate that timeline
  is ≈ 19.4 months at typical use — and (c)'s cap stretches the
  *maximum-speed* free road (a devoted free earner running to
  cap daily) from ≈ 6 months at the standard cap to
  ≈ 12 months (2,850 ÷ 8 ÷ 30), while leaving the typical
  earner's road untouched, since 2 hours a day nets ≈ 4.9
  credits, under either cap. Meanwhile (a)'s cost is not
  hypothetical: closing the solver to free players removes the
  one credit road whose price is set by physics rather than by
  the design's own faucets, and with it the answer to the free
  player's fair question — "how do I earn, if I cannot pay?" —
  that the solver exists to be. Decide D47 as the main event it
  is, not as a footnote to D12; and under any option, staff
  accounts stand outside earning entirely, as they stand outside
  prizes (PLAN.md §2.10) — staff machines may contribute
  *uncredited* work for testing, and that is all.

---

*End of SOLVER.md — draft protocol design for Will's decisions
D42–D47. Companion documents: PLAN.md §2.13 (the ruling this
drafts under), §6 (the decisions), ECONOMY.md §6–§7 (the fork
and rate analyses this reconciles with, and corrects at §4.5
above). No number in this document is ruled.*
