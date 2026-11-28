// ---------- the economy (demo4: W2 entitlement + W3 core) --------------------
// The two-currency model of ECONOMY.md, as ruled:
//   D1 (Will, 2026-11-26 08:40 CST) — paid players stand on a global
//     leaderboard ordered by purchase number; the credit generation
//     skill is the first paid player interaction with the world.
//   D2 (Will, 2026-11-26 08:46 CST) — one key system, two issuers:
//     a Gumroad purchase and a credit gift issue the same kind of
//     unlock, redeemed the same way.
//   D12 (Will, 2026-11-26 14:00 CST) — Fork B: free players hold
//     credits from named faucets: daily-prize credits, generator
//     hand-downs, token -> credit conversion at 50 : 1.
// This module is pure logic: no DOM, no storage, no clock of its
// own. The game glue (game3.js) owns persistence and the network;
// tests drive this file directly, exactly like world.js.

// Rates and prices — every number traces to ECONOMY.md §1.1 / §2
// or PLAN.md §2; the ones that are drafts say so in place.
export const ECO_RATES = {
  // Tokens ("flux"): the free drip, 1 token per 3 minutes of
  // active play (P1 — ECONOMY's modeling value inside PLAN §2.2's
  // draft range "one token per few minutes").
  TOKEN_DRIP_PER_HOUR: 20,
  // Generator spew: 100 tokens per active hour leave a generator's
  // play for the world (P2, modeling assumption — ECONOMY names it
  // the model's most sensitive number).
  SPEW_TOKENS_PER_HOUR: 100,
  // The generation skill's earn ratio: 1 credit per 10 tokens
  // spewed (P3, PLAN §2.2 draft) — derived generator income is
  // 10 credits per active hour (P4).
  TOKENS_SPEWED_PER_CREDIT: 10,
  // Gifting the game: 100 credits (P6, PLAN §2.6 draft price set
  // against the $6 cash price).
  GIFT_PRICE_CREDITS: 100,
  // Fork B conversion: 50 tokens destroyed per 1 credit minted
  // (P8, PLAN §2.7 draft). The draft also says "capped weekly" but
  // the cap's size is unruled (ECONOMY P8: "cap size unstated"), so
  // no cap is enforced here; conversions are counted per week in
  // the ledger (state.conversionWeeks) so a ruled cap can bind
  // later without a data migration.
  CONVERSION_TOKENS_PER_CREDIT: 50,
  // Daily-prize credits (Fork B): ECONOMY P9 states an expected
  // value, not a prize size — ≈10 credits/month for a devoted
  // free player (a daily claim every day), ≈3/month for a casual
  // (≈9 claims). The prize shape itself is D6/D7, unruled. The
  // pair below reproduces P9's expectation exactly: a 1-credit
  // prize won on 1 claim in 3 gives 30 claims -> ≈10/month and
  // 9 claims -> ≈3/month. The draw is deterministic per
  // (player, date): it cannot be re-rolled by reloading, and the
  // daily feat itself is claimable once per day.
  DAILY_PRIZE_CREDITS: 1,
  DAILY_PRIZE_WIN_SHARE: 1 / 3,
  // The Gumroad product, created by Will 2026-11-26:
  // phext.gumroad.com/l/nova-fox. License verification is
  // Gumroad's documented POST /v2/licenses/verify.
  GUMROAD_PRODUCT_PERMALINK: "nova-fox",
  GUMROAD_VERIFY_URL: "https://api.gumroad.com/v2/licenses/verify",
};

// The Lance (PLAN §2.5): is the base Lance a power-up, or the
// guide's tool given in the opening? Carried inside D12 and NOT
// ruled in the 2026-11-26 pass (LAUNCH.md, D12 ruling note). So
// the classification lives here as data, unruled, and the
// conditional weapon tiers (PLAN §2.14 / ECONOMY §4.1: the War
// Lance's whole-tier price is 600) stay dormant — listed, priced
// only where a source prices them, and not purchasable until
// Will rules the base Lance's status.
export const LANCE = {
  classification: "unruled", // -> "power-up" | "guides-tool" when Will rules
  tiersDormant: true,
  tiers: [
    { id: "keen-lance", name: "the Keen Lance", price: null }, // §2.14 draft tier; price not stated in ECONOMY §4
    { id: "war-lance", name: "the War Lance", price: 600 },    // ECONOMY §4.1 cross-check: whole-tier price 600
  ],
};

// ---------- small deterministic helpers --------------------------------------

// FNV-1a, 32-bit — for the daily-prize draw (determinism, not secrecy).
export function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// FNV-1a, 64-bit (BigInt) — the gift-key commitment. A gift key is
// 128 bits of randomness; what touches the shared chart is only
// this hash of it, so the key itself never travels or is stored
// server-side, and redemption proves possession by re-hashing.
export function fnv1a64hex(str) {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n, mask = 0xffffffffffffffffn;
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, "0");
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648 base32, exactly 32
export function makeGiftKey(rngBytes) {
  // rngBytes: a function returning one random byte (0..255) per call.
  let body = "";
  for (let i = 0; i < 16; i++) body += B32[rngBytes() & 31];
  const grouped = body.match(/.{4}/g).join("-");
  return `NFG-${grouped}`;
}
export function giftKeyHash(key) {
  return fnv1a64hex(String(key).trim().toUpperCase());
}
export function isGiftKey(key) {
  return /^NFG-([A-Z2-7]{4}-){3}[A-Z2-7]{4}$/.test(String(key).trim().toUpperCase());
}

// ISO week key (for conversion accounting), from a Date.
export function weekKeyOf(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------- state --------------------------------------------------------------

// P-6: the solver's purse-side state — twelfths of a credit not yet
// whole, the units this purse has been credited for (a cache of the
// solver scroll's solcredit lines), the first solver day (the ramp's
// local mirror; the scroll is the record), lifetime verified units.
function freshSolverState() {
  return { fracTwelfths: 0, creditedUnits: [], firstDay: null, lifetimeUnits: 0 };
}

export function newEconomyState() {
  return {
    v: 1,
    tokens: 0,          // whole flux held
    credits: 0,         // whole credits held
    frac: { drip: 0, spew: 0, credit: 0 }, // fractional accrual, in each unit
    poolSpewed: 0,      // tokens this generator has spewed, not yet posted
    lifetime: {
      tokensEarned: 0, tokensSpewed: 0, creditsEarned: 0,
      creditsSpent: 0, giftsGiven: 0, conversionsMinted: 0,
      handdownsSent: 0, handdownsReceived: 0, ladderSpent: 0,
      materialsSold: 0, // P-2: blocks sold back into the purse, by count
    },
    entitlement: {
      status: "free",        // "free" | "paid"
      source: null,          // "gumroad" | "gift"
      key: null,             // the player's own key, kept on this machine
      saleRef: null,         // Gumroad sale/order id, when the API returns one
      verifiedAt: 0,
      purchaseNumber: null,  // standing on the written record, once read back
      claimPosted: false,    // our purchase claim has reached the shared chart
    },
    dailyPrize: { date: null, won: null }, // last draw, by local date string
    handdownIdsApplied: [],                // transfer ids already credited here
    pendingGiftKey: null,                  // entered offline; verifies on first sync
    conversionWeeks: {},                   // weekKey -> credits minted by conversion
    ladder: {},                            // rung id -> { ts, via: "bought" | "granted" }
    materials: {},                         // P-2: BLOCK id -> count carried (what digging yields)
    solver: freshSolverState(), // P-6: contributed-work accrual (solver.js holds the math)
  };
}

const num = (v, d = 0) => (Number.isFinite(+v) && +v >= 0 ? Math.floor(+v) : d);
export function loadEconomyState(raw) {
  const s = newEconomyState();
  if (!raw || typeof raw !== "object") return s;
  s.tokens = num(raw.tokens); s.credits = num(raw.credits);
  s.poolSpewed = num(raw.poolSpewed);
  if (raw.frac) {
    for (const k of ["drip", "spew", "credit"]) {
      const v = +raw.frac[k];
      s.frac[k] = Number.isFinite(v) && v > 0 ? Math.min(v, 1e9) : 0;
    }
  }
  if (raw.lifetime) for (const k of Object.keys(s.lifetime)) s.lifetime[k] = num(raw.lifetime[k]);
  if (raw.entitlement) {
    const e = raw.entitlement;
    if (e.status === "paid" && (e.source === "gumroad" || e.source === "gift")) {
      s.entitlement.status = "paid";
      s.entitlement.source = e.source;
      s.entitlement.key = typeof e.key === "string" ? e.key : null;
      s.entitlement.saleRef = typeof e.saleRef === "string" ? e.saleRef : null;
      s.entitlement.verifiedAt = num(e.verifiedAt);
      s.entitlement.purchaseNumber =
        Number.isInteger(e.purchaseNumber) && e.purchaseNumber > 0 ? e.purchaseNumber : null;
      s.entitlement.claimPosted = !!e.claimPosted;
    }
  }
  if (raw.dailyPrize && typeof raw.dailyPrize.date === "string") {
    s.dailyPrize = { date: raw.dailyPrize.date, won: !!raw.dailyPrize.won };
  }
  if (Array.isArray(raw.handdownIdsApplied)) {
    s.handdownIdsApplied = raw.handdownIdsApplied.filter((x) => typeof x === "string").slice(-500);
  }
  if (typeof raw.pendingGiftKey === "string") s.pendingGiftKey = raw.pendingGiftKey;
  if (raw.conversionWeeks && typeof raw.conversionWeeks === "object") {
    for (const [k, v] of Object.entries(raw.conversionWeeks)) s.conversionWeeks[k] = num(v);
  }
  if (raw.ladder && typeof raw.ladder === "object") {
    for (const [k, v] of Object.entries(raw.ladder)) {
      if (!rungById(k) || !v || typeof v !== "object") continue; // unknown rungs are dropped, never charged for
      s.ladder[k] = { ts: num(v.ts), via: v.via === "granted" ? "granted" : "bought" };
    }
  }
  if (raw.materials && typeof raw.materials === "object") {
    for (const [k, v] of Object.entries(raw.materials)) {
      if (!materialDef(+k)) continue; // unknown types are dropped, never carried
      const c = num(v);
      if (c > 0) s.materials[+k] = c;
    }
  }
  if (raw.solver && typeof raw.solver === "object") {
    const sv = raw.solver;
    // Twelfths are a remainder by construction: 0..11 (12 to a
    // credit — SOLVER_RATES in solver.js; the purse keeps the number).
    if (Number.isFinite(sv.fracTwelfths)) {
      s.solver.fracTwelfths = Math.min(11, Math.max(0, Math.floor(sv.fracTwelfths)));
    }
    if (Array.isArray(sv.creditedUnits)) {
      s.solver.creditedUnits =
        sv.creditedUnits.filter((u) => typeof u === "string").slice(-4000);
    }
    if (typeof sv.firstDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sv.firstDay)) {
      s.solver.firstDay = sv.firstDay;
    }
    if (Number.isInteger(sv.lifetimeUnits) && sv.lifetimeUnits >= 0) {
      s.solver.lifetimeUnits = sv.lifetimeUnits;
    }
  }
  return s;
}
export function isGenerator(eco) { return eco.entitlement.status === "paid"; }

// EE 1034 item 5, RE-RULED EE 1338 (Will, verbatim): "purchase
// unlocks flight". Until EE 1338 the gate was paid OR dragonKill
// (the 2026-11-27 ruling); the dragon path is now REPLACED as
// flight's unlock condition — a dragon kill no longer opens
// flight (the dragon flag keeps its other meanings, e.g. the
// dial's range gate in gdial.js, untouched). Flight opens on a
// valid purchase / license, through the surfaces that already
// carry it, and no parallel one:
//   - the local paid entitlement (isGenerator: a redeemed
//     Gumroad or gift key), or
//   - the gateway's license-session word (sessionPaid, W-3: the
//     Gumroad sale validated on connect), or
//   - the written purchase record itself (purchaseRows, read
//     back from the purchase scroll at BACKEND.purchaseCoord
//     1.1.1/1.1.3/1.1.1): a row standing in the player's name.
// A row typed "x-factor-grant" IS a license (EE 1338 reading: a
// grant-typed record in the purchase record unlocks, via
// "grant") — flagged in the MR for Will's correction if wrong.
export function flightUnlocked(eco, sessionPaid, purchaseRows, playerName) {
  if (eco && isGenerator(eco)) return { ok: true, via: "paid" };
  if (sessionPaid) return { ok: true, via: "paid" }; // the global server's word, W-3
  const row = Array.isArray(purchaseRows) && playerName
    ? purchaseRows.find((r) => r && r.name === playerName) : null;
  if (row) return { ok: true, via: row.source === "x-factor-grant" ? "grant" : "paid" };
  return { ok: false, via: null };
}

// ---------- accrual: the drip, the spew, the generation skill -----------------
// Active play only — the glue decides what "active" means (tab
// visible, recent input) and passes whole seconds. Fractions carry
// between calls, so a 5-second tick rhythm loses nothing.
export function accrue(eco, seconds) {
  const out = { tokensMinted: 0, tokensSpewed: 0, creditsMinted: 0 };
  if (!(seconds > 0)) return out;
  // The free drip runs for everyone, generator or not (PLAN §2.2).
  eco.frac.drip += (ECO_RATES.TOKEN_DRIP_PER_HOUR * seconds) / 3600;
  const dripWhole = Math.floor(eco.frac.drip);
  if (dripWhole > 0) {
    eco.frac.drip -= dripWhole;
    eco.tokens += dripWhole;
    eco.lifetime.tokensEarned += dripWhole;
    out.tokensMinted += dripWhole;
  }
  // The generation skill (D1): a paid player's play spews tokens
  // for the world and earns credits at 1 per 10 spewed (P3/P4).
  if (isGenerator(eco)) {
    eco.frac.spew += (ECO_RATES.SPEW_TOKENS_PER_HOUR * seconds) / 3600;
    const spewWhole = Math.floor(eco.frac.spew);
    if (spewWhole > 0) {
      eco.frac.spew -= spewWhole;
      eco.poolSpewed += spewWhole;
      eco.lifetime.tokensSpewed += spewWhole;
      out.tokensSpewed += spewWhole;
      eco.frac.credit += spewWhole / ECO_RATES.TOKENS_SPEWED_PER_CREDIT;
      const creditWhole = Math.floor(eco.frac.credit);
      if (creditWhole > 0) {
        eco.frac.credit -= creditWhole;
        eco.credits += creditWhole;
        eco.lifetime.creditsEarned += creditWhole;
        out.creditsMinted += creditWhole;
      }
    }
  }
  return out;
}

// ---------- Fork B faucet 1: daily-prize credits -------------------------------
// Called by the glue on the day's first daily-pocket claim (the
// feat itself is once per day — world.js checkDaily). The draw is
// a pure function of (player, date): the same answer on every
// machine, every reload.
export function dailyPrizeDraw(eco, playerName, dateStr) {
  if (eco.dailyPrize.date === dateStr) {
    return { already: true, won: eco.dailyPrize.won, credits: eco.dailyPrize.won ? ECO_RATES.DAILY_PRIZE_CREDITS : 0 };
  }
  const roll = fnv1a32(`nova-phox|prize|${playerName}|${dateStr}`) / 4294967296;
  const won = roll < ECO_RATES.DAILY_PRIZE_WIN_SHARE;
  eco.dailyPrize = { date: dateStr, won };
  if (won) {
    eco.credits += ECO_RATES.DAILY_PRIZE_CREDITS;
    eco.lifetime.creditsEarned += ECO_RATES.DAILY_PRIZE_CREDITS;
  }
  return { already: false, won, credits: won ? ECO_RATES.DAILY_PRIZE_CREDITS : 0 };
}

// ---------- Fork B faucet 2: token -> credit conversion (50 : 1) ---------------
export function convertTokens(eco, wantCredits, date = new Date()) {
  const affordable = Math.floor(eco.tokens / ECO_RATES.CONVERSION_TOKENS_PER_CREDIT);
  const n = Math.max(0, Math.min(Math.floor(wantCredits) || 0, affordable));
  if (n <= 0) return { converted: 0, spent: 0 };
  const spent = n * ECO_RATES.CONVERSION_TOKENS_PER_CREDIT;
  eco.tokens -= spent;
  eco.credits += n;
  eco.lifetime.creditsEarned += n;
  eco.lifetime.conversionsMinted += n;
  const wk = weekKeyOf(date);
  eco.conversionWeeks[wk] = (eco.conversionWeeks[wk] || 0) + n;
  return { converted: n, spent };
}

// ---------- Fork B faucet 3 + the gift: hand-downs and gift keys ---------------
// Hand-downs move existing credits; they mint none (ECONOMY §2.2).
// The transfer rides the shared chart as a ledger line; the
// recipient's client credits it exactly once, by transfer id.
export function handdownLine(id, from, to, amount, ts) {
  return `handdown|${id}|${from}|${to}|${amount}|${ts}`;
}
export function sendHanddown(eco, id, fromName, toName, amount, ts) {
  const n = Math.floor(amount);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: "amount" };
  if (eco.credits < n) return { ok: false, reason: "funds" };
  if (!toName || toName === fromName) return { ok: false, reason: "recipient" };
  eco.credits -= n;
  eco.lifetime.creditsSpent += n;
  eco.lifetime.handdownsSent += n;
  return { ok: true, line: handdownLine(id, fromName, toName, n, ts) };
}
export function applyHanddowns(eco, ledger, myName) {
  let received = 0;
  for (const t of ledger.handdowns) {
    if (t.to !== myName) continue;
    if (eco.handdownIdsApplied.includes(t.id)) continue;
    eco.handdownIdsApplied.push(t.id);
    eco.credits += t.amount;
    eco.lifetime.creditsEarned += t.amount;
    eco.lifetime.handdownsReceived += t.amount;
    received += t.amount;
  }
  return received;
}

// Buying a gift: 100 credits out, one key into the giver's hands.
// Only the key's hash is inscribed on the shared chart.
export function giftIssuedLine(hash, giver, ts) { return `gift-issued|${hash}|${giver}|${ts}`; }
export function giftRedeemedLine(hash, name, ts) { return `gift-redeemed|${hash}|${name}|${ts}`; }
export function buyGift(eco, rngBytes, giverName, ts) {
  if (eco.credits < ECO_RATES.GIFT_PRICE_CREDITS) return { ok: false, reason: "funds" };
  const key = makeGiftKey(rngBytes);
  eco.credits -= ECO_RATES.GIFT_PRICE_CREDITS;
  eco.lifetime.creditsSpent += ECO_RATES.GIFT_PRICE_CREDITS;
  eco.lifetime.giftsGiven += 1;
  const hash = giftKeyHash(key);
  return { ok: true, key, hash, line: giftIssuedLine(hash, giverName, ts) };
}

// ---------- the shared economy ledger ------------------------------------------
// One scroll carries the economy's public facts, pipe-delimited
// like the board scroll: gift issuances and redemptions (by key
// hash) and hand-downs (by transfer id). Append-only; a line's
// meaning never changes after it lands.
export function parseEcoLedger(text) {
  const issued = new Map(), redeemed = new Map(), handdowns = [];
  for (const ln of String(text || "").split("\n")) {
    const p = ln.split("|");
    if (p[0] === "gift-issued" && p[1]) issued.set(p[1], { giver: p[2] || "", ts: +p[3] || 0 });
    else if (p[0] === "gift-redeemed" && p[1]) redeemed.set(p[1], { name: p[2] || "", ts: +p[3] || 0 });
    else if (p[0] === "handdown" && p[1] && p[3] && Number.isFinite(+p[4])) {
      handdowns.push({ id: p[1], from: p[2] || "", to: p[3], amount: Math.floor(+p[4]), ts: +p[5] || 0 });
    }
  }
  return { issued, redeemed, handdowns };
}

// Redeem a gift key against a ledger read from the shared chart.
// ledger === null means the chart hasn't answered: the caller
// keeps the key as pending and nothing is granted on a guess —
// the same discipline the marks outbox keeps.
export function redeemGiftKey(eco, key, ledger) {
  if (isGenerator(eco)) return { ok: false, reason: "already" };
  if (!isGiftKey(key)) return { ok: false, reason: "format" };
  if (!ledger) return { ok: false, pending: true, reason: "offline" };
  const hash = giftKeyHash(key);
  if (!ledger.issued.has(hash)) return { ok: false, reason: "unknown" };
  if (ledger.redeemed.has(hash)) return { ok: false, reason: "spent" };
  return { ok: true, hash };
}
export function applyGiftRedemption(eco, key, ts) {
  eco.entitlement.status = "paid";
  eco.entitlement.source = "gift";
  eco.entitlement.key = String(key).trim().toUpperCase();
  eco.entitlement.verifiedAt = ts;
  eco.entitlement.claimPosted = false;
  eco.entitlement.purchaseNumber = null;
  eco.pendingGiftKey = null;
}

// ---------- Gumroad keys: the other issuer, the same door -----------------------
// Gumroad's license verification: POST product_permalink +
// license_key; the answer carries success and the purchase, with
// refunded / chargebacked / disputed flags on it. Verification is
// read-only for us (increment_uses_count=false). A network failure
// is "pending", never "no": the downloadable build keeps the key
// and verifies on the first connection that answers (D2: the file
// degrades gracefully offline; a key once verified on this machine
// stays verified — the entitlement is cached in the save).
export async function verifyGumroadKey(fetchFn, key) {
  const body = new URLSearchParams({
    product_permalink: ECO_RATES.GUMROAD_PRODUCT_PERMALINK,
    license_key: String(key).trim(),
    increment_uses_count: "false",
  });
  let r;
  try {
    r = await fetchFn(ECO_RATES.GUMROAD_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    return { ok: false, pending: true, reason: "offline" };
  }
  let data = null;
  try { data = await r.json(); } catch (e) { /* fall through */ }
  if (!data || data.success !== true) return { ok: false, reason: "rejected" };
  const p = data.purchase || {};
  if (p.refunded || p.chargebacked || p.disputed) return { ok: false, reason: "refunded" };
  return {
    ok: true,
    saleRef: p.sale_id || p.order_id || null,
    createdAt: p.created_at || p.sale_timestamp || null,
  };
}
export function applyGumroadVerification(eco, key, result, ts) {
  eco.entitlement.status = "paid";
  eco.entitlement.source = "gumroad";
  eco.entitlement.key = String(key).trim();
  eco.entitlement.saleRef = result.saleRef || null;
  eco.entitlement.verifiedAt = ts;
  eco.entitlement.claimPosted = false;
  eco.entitlement.purchaseNumber = null;
}

// ---------- the global server's word: license session (W-3, build 42) ----------
// On connect, the game presents the player's stored key to the
// gateway, and the gateway — the global server — validates it:
// Gumroad keys against Gumroad's own door, gift keys against the
// economy ledger, both judged exactly as the panel's doors judge
// them (S-2 semantics). Its answer marks the SESSION paid. It never
// gates entry (no key, or a refused key, is a full free session),
// and it never strips a locally verified entitlement: a key once
// verified on this machine stays verified in the save (the D2
// discipline above), so the server's word can only raise a free
// standing to paid, never lower one.
export const LICENSE_REASONS = ["rejected", "refunded", "unknown", "spent", "none", "offline"];
export function parseLicenseAnswer(data) {
  if (!data || typeof data !== "object" || data.ok !== true) {
    return { paid: false, source: null, reason: "offline", message: "" };
  }
  if (data.paid === true && (data.source === "gumroad" || data.source === "gift")) {
    return { paid: true, source: data.source, reason: null, message: String(data.message || "") };
  }
  const reason = LICENSE_REASONS.includes(data.reason) ? data.reason : "rejected";
  return { paid: false, source: null, reason, message: String(data.message || "") };
}
// Apply a paid answer to a free standing. Returns true when the
// standing changed (the caller then runs the became-generator
// path, which posts the purchase claim as always). A paid answer
// for a key names its source; gift keys are kept upper-cased, as
// the gift door keeps them.
export function applyLicenseSession(eco, answer, key, ts) {
  if (!answer || answer.paid !== true) return false;
  if (isGenerator(eco)) return false;
  eco.entitlement.status = "paid";
  eco.entitlement.source = answer.source;
  const k = String(key || "").trim();
  if (k) eco.entitlement.key = answer.source === "gift" ? k.toUpperCase() : k;
  eco.entitlement.verifiedAt = ts;
  eco.entitlement.claimPosted = false;
  eco.entitlement.purchaseNumber = null;
  if (answer.source === "gift") eco.pendingGiftKey = null;
  return true;
}

// ---------- the written record: the purchase leaderboard (D1) -------------------
// Paid players stand on a global leaderboard ordered by purchase
// number. The number is not chosen by the client: a redemption
// appends a claim line to the purchase scroll, and a player's
// number is their claim's position in the scroll as read back —
// arrival order, first claim per name wins, exactly the shared
// chart's own semantics. Until the chart answers, the number is
// honestly "not yet written".
export function purchaseClaimLine(name, source, ts) { return `${name}|${source}|${ts}`; }
export function parsePurchaseBoard(text) {
  const rows = [], seen = new Set();
  for (const ln of String(text || "").split("\n")) {
    const [name, source, ts] = ln.split("|");
    if (!name || seen.has(name)) continue;
    // EE 1338: a grant-typed record ("x-factor-grant") stands on
    // the purchase record as a license in its own right (see
    // flightUnlocked); gumroad = a Gumroad sale, gift = a gift key.
    if (source !== "gumroad" && source !== "gift" && source !== "x-factor-grant") continue;
    seen.add(name);
    rows.push({ name, source, ts: +ts || 0, number: rows.length + 1 });
  }
  return rows;
}
export function purchaseNumberFor(rows, name) {
  const r = rows.find((x) => x.name === name);
  return r ? r.number : null;
}

// ---------- the power-up ladder: the finite sink (demo5) -----------------------
// The ladder of PLAN §2.14 (DRAFT prices — Will is iterating on the
// ladder; every price below is the draft price from §2.14's tables,
// and ECONOMY §4.1's sums are the cross-check: Band 1 = 225,
// Band 2 = 875, Band 3 = 4,350, Apex = 18,000, whole ladder 23,450).
// ECONOMY §2.2 rules the ladder a sink: one-time per rung per
// player — a rung is bought exactly once, ever, and the charge is
// exact-once: a refused purchase never touches the purse.
//
// Launch scope is RULED (2026-11-24 16:07 CST): Beat 1 carries the
// first three gear tiers — trash (white), common (grey), uncommon
// (green). Annotated by band (PLAN §2.14): Band 1 is white/grey,
// Band 2 is green. The per-rung split between white and grey inside
// Band 1 is NOT stated in the docs, so rungs carry their band's
// tier scope, not an invented per-rung tier. Band 3 (red) and the
// Apex relics (blue) are Beat 2 — Christmas, with the dragon: they
// are carried here as data with beat 2 and are NOT purchasable in
// this build (buyRung refuses them with reason "beat").
// The Keen/War Lance tiers are NOT rungs here either: they live in
// LANCE above, dormant, conditional on Will's unmade ruling on the
// base Lance (D12 note in PLAN §2.14). The Deep Stone Hat is the
// ladder's one grant: price 0, given by the Deep Stone quest,
// never sold (buyRung refuses it with reason "granted").
// `requires` carries only rung-to-rung prerequisites stated in
// §2.14's tables (the brush sizes ascend, the chisel degrees
// ascend, Flute Harmonics follows the Reed). The tables' other
// "sprinkle" timings name world events, not purchases, and gate
// nothing here.
export const LADDER_BEAT = 1; // the beat this build sells
export const LADDER_RUNGS = [
  // Band 1 — Tools of the Path (white/grey, Beat 1). Bought total 225.
  { id: "keepsake-tune-pip", band: 1, tiers: "white/grey", beat: 1, name: "Keepsake Tune Pip", price: 5,
    effect: "A chip-tune pip that lifts the pickup tune and carries it with you between realms." },
  { id: "chisel-first-degree", band: 1, tiers: "white/grey", beat: 1, name: "Chisel, First Degree", price: 10,
    effect: "Shape a block down one degree before it breaks — the first step of the chisel degrees." },
  { id: "pocket-bell", band: 1, tiers: "white/grey", beat: 1, name: "Pocket Bell", price: 10,
    effect: "A small bell that chimes just before the daily pocket turns." },
  { id: "lamp-of-small-hours", band: 1, tiers: "white/grey", beat: 1, name: "Lamp of Small Hours", price: 15,
    effect: "Your lamp burns wider and longer in the dark." },
  { id: "soft-boots", band: 1, tiers: "white/grey", beat: 1, name: "Soft Boots", price: 15,
    effect: "High-gravity landings stop hurting." },
  { id: "portal-bead", band: 1, tiers: "white/grey", beat: 1, name: "Portal Bead", price: 15,
    effect: "A bead that holds one portal view a breath longer, so you can look before you step." },
  { id: "bright-charm-second-knot", band: 1, tiers: "white/grey", beat: 1, name: "Bright Charm, Second Knot", price: 20,
    effect: "A second knot in the charm: the lamp's throw stretches further, and the glimpse of hidden things in portal views sharpens." },
  { id: "solvers-spool", band: 1, tiers: "white/grey", beat: 1, name: "Solver's Spool", price: 20,
    effect: "While your solver runs at 30%, your spew runs richer." },
  { id: "second-breath", band: 1, tiers: "white/grey", beat: 1, name: "Second Breath", price: 20,
    effect: "Your voice returns sooner between yells." },
  { id: "reed-of-small-rifts", band: 1, tiers: "white/grey", beat: 1, name: "Reed of Small Rifts", price: 20,
    effect: "A lesser reed for the spectral flute: short gesture-tunes stir small rifts ajar." },
  { id: "ember-gloves", band: 1, tiers: "white/grey", beat: 1, name: "Ember Gloves", price: 25,
    effect: "Carry two blocks at once, warm-handed, even in cold realms." },
  { id: "dowsers-thread", band: 1, tiers: "white/grey", beat: 1, name: "Dowser's Thread", price: 25,
    effect: "A thread that tugs faintly toward hidden lesser things nearby — never toward the dragon." },
  { id: "hand-brush", band: 1, tiers: "white/grey", beat: 1, name: "Hand Brush", price: 25,
    effect: "A 2×2×2 brush — eight blocks a stroke, the grand brushes' smaller cousin." },
  { id: "deep-stone-hat", band: 1, tiers: "white/grey", beat: 1, name: "The Deep Stone Hat", price: 0, granted: true,
    effect: "The hat granted at the Deep Stone, written down: it stays. Granted by the Deep Stone quest, not bought." },
  // Band 2 — Realmcraft (green, Beat 1). Bought total 875.
  { id: "grand-brush-2x2x3", band: 2, tiers: "green", beat: 1, name: "Grand Brush, 2×2×3", price: 40,
    effect: "Shape a whole 2×2×3 volume per stroke." },
  { id: "paint-that-holds", band: 2, tiers: "green", beat: 1, name: "Paint That Holds", price: 45,
    effect: "Your paint stays bright in the dark and under shifted gravity, so routes you mark can be followed by anyone." },
  { id: "chisel-second-degree", band: 2, tiers: "green", beat: 1, name: "Chisel, Second Degree", price: 50, requires: "chisel-first-degree",
    effect: "Shape a block down a second, finer degree before it breaks." },
  { id: "melody-reel", band: 2, tiers: "green", beat: 1, name: "Melody Reel", price: 50,
    effect: "Two extra chip-melody slots: carry more of the day's tunes with you." },
  { id: "flute-harmonics", band: 2, tiers: "green", beat: 1, name: "Flute Harmonics", price: 60, requires: "reed-of-small-rifts",
    effect: "The spectral flute gains its harmonics: held gesture-tunes bend a rift's note, and bent notes open rifts the plain tune cannot." },
  { id: "riverstone-cap", band: 2, tiers: "green", beat: 1, name: "Riverstone Cap", price: 60,
    effect: "The Deep Stone hat's cousin: while you wear it, the last block you placed in each realm glows faintly in the dark — a trail of your own making." },
  { id: "grand-brush-3x3x2", band: 2, tiers: "green", beat: 1, name: "Grand Brush, 3×3×2", price: 70, requires: "grand-brush-2x2x3",
    effect: "Shape a whole 3×3×2 volume per stroke." },
  { id: "portal-twine", band: 2, tiers: "green", beat: 1, name: "Portal Twine", price: 80,
    effect: "Two portals, linked by twine: step into one and the twine pulls you out the other, wherever it lies." },
  { id: "gravity-stop", band: 2, tiers: "green", beat: 1, name: "A Gravity Stop of One's Own", price: 90,
    effect: "One realm remembers your strength setting: set its gravity once, and it holds for you when you return." },
  { id: "chisel-fine-degree", band: 2, tiers: "green", beat: 1, name: "Chisel, Fine Degree", price: 100, requires: "chisel-second-degree",
    effect: "The finest chisel degree: shape a block down to its last degree before it breaks." },
  { id: "realm-anchor-cord", band: 2, tiers: "green", beat: 1, name: "Realm Anchor Cord", price: 110,
    effect: "Tie one anchor in a realm; from anywhere in that realm, follow the cord back to it." },
  { id: "grand-brush-4x4x2", band: 2, tiers: "green", beat: 1, name: "Grand Brush, 4×4×2", price: 120, requires: "grand-brush-3x3x2",
    effect: "Shape a whole 4×4×2 volume per stroke — the largest brush on the ladder." },
  // Band 3 — Dragonward (red, Beat 2 — Christmas, with the dragon). Data only; not purchasable here.
  { id: "dragonward-helm", band: 3, tiers: "red", beat: 2, name: "Dragonward Helm", price: 250,
    effect: "A helm made for the dragon fight: its face-plate turns the worst of the dragon's breath." },
  { id: "hoard-scent", band: 3, tiers: "red", beat: 2, name: "Hoard-Scent", price: 250,
    effect: "You can smell a dragon's leavings, days old: where it has rested, fed, and passed." },
  { id: "dragonward-gauntlets", band: 3, tiers: "red", beat: 2, name: "Dragonward Gauntlets", price: 300,
    effect: "Gauntlets of the set: your grip holds — blocks, twine, and weapon — through the dragon's shaking of the realm." },
  { id: "dragonward-greaves", band: 3, tiers: "red", beat: 2, name: "Dragonward Greaves", price: 300,
    effect: "Greaves of the set: you keep your feet in high gravity and in the flux of the fight." },
  { id: "dragonward-pauldrons", band: 3, tiers: "red", beat: 2, name: "Dragonward Pauldrons", price: 350,
    effect: "Shoulder-guards of the set: a swipe from above glances off instead of throwing you down." },
  { id: "second-breath-greater", band: 3, tiers: "red", beat: 2, name: "Second Breath, Greater", price: 350, requires: "second-breath",
    effect: "The greater form of Second Breath: your voice returns sooner still, and a yell at full strength no longer leaves you hoarse." },
  { id: "war-chanters-throat", band: 3, tiers: "red", beat: 2, name: "War-Chanter's Throat", price: 400,
    effect: "Your yell carries further — across the whole realm of the fight, to every friend in it." },
  { id: "dragonward-aegis", band: 3, tiers: "red", beat: 2, name: "Dragonward Aegis", price: 450,
    effect: "The shield of the set: raised, it covers the friend beside you as well as yourself." },
  { id: "dragonward-breastplate", band: 3, tiers: "red", beat: 2, name: "Dragonward Breastplate", price: 600,
    effect: "The breastplate of the set: the blow that would end the fight, it takes once and holds." },
  { id: "company-standard", band: 3, tiers: "red", beat: 2, name: "Company Standard", price: 200,
    effect: "Plant a standard in the fight: every friend in your company can see it through dark and flux, and rally to it." },
  // Apex relics (blue, Beat 2 — Christmas). Data only; not purchasable here.
  // The ultra sword is not a rung and appears nowhere on this ladder (PLAN §2.14).
  { id: "plinth-of-the-first-realm", band: 4, tiers: "blue", beat: 2, name: "Plinth of the First Realm", price: 1500,
    effect: "An empty plinth in the first realm's shape, sized for something long. Whatever stood here was taken, or never came." },
  { id: "mantle-of-the-unfinished-road", band: 4, tiers: "blue", beat: 2, name: "Mantle of the Unfinished Road", price: 2000, requires: "realm-anchor-cord",
    effect: "A mantle woven with a road that stops mid-stitch; wearing it, your footprints show a little way ahead of your feet." },
  { id: "sword-calling-compass", band: 4, tiers: "blue", beat: 2, name: "Sword-Calling Compass", price: 2500,
    effect: "A compass that spins uselessly near dragons, and points nowhere anyone has followed." },
  { id: "throne-of-yelling", band: 4, tiers: "blue", beat: 2, name: "Throne of Yelling", price: 3000, requires: "war-chanters-throat",
    effect: "A seat of old stone: sit in it, and your yell is heard in every realm you have ever entered." },
  { id: "bell-of-the-long-wait", band: 4, tiers: "blue", beat: 2, name: "Bell of the Long Wait", price: 4000,
    effect: "A bell that rings on its own, some mornings, once. Nobody living knows what it is counting." },
  { id: "nameless-sheath", band: 4, tiers: "blue", beat: 2, name: "Nameless Sheath", price: 5000,
    effect: "An empty sheath that fits no blade anyone owns. It is the top public rung of the ladder." },
];
export function rungById(id) { return LADDER_RUNGS.find((r) => r.id === id) || null; }
export function ownsRung(eco, id) { return !!eco.ladder[id]; }

// ---------- W-4: gear tier markers (colorblind-safe tiers) ----------
// Gear progression speaks in color — trash (white) below common
// (grey), then green, red, blue (Will's canon order). Color alone
// locks out red-green colorblind foxes, so every tier ALSO carries
// a shape: one marker per tier, drawn the same way everywhere tier
// is communicated. This helper is the ONLY hand that draws them —
// the shop, the field guide, and every later surface call here, so
// the shapes can never drift apart. Color stays exactly as it was;
// the marker is a second channel, never a replacement. A rung's
// `tiers` scope names its band's tiers (Band 1 spans white AND
// grey — the docs state no per-rung split inside the band, so a
// Band 1 rung wears both markers, in canon order).
export const GEAR_TIERS = [
  { id: "white", color: "#f2f2f2", shape: "circle" },
  { id: "grey", color: "#9aa0a6", shape: "square" },
  { id: "green", color: "#57d957", shape: "triangle" },
  { id: "red", color: "#e5484d", shape: "diamond" },
  { id: "blue", color: "#5b8def", shape: "hexagon" },
];
export const TIER_MARKER_SHAPES = Object.fromEntries(GEAR_TIERS.map((t) => [t.id, t.shape]));
const TIER_MARKER_BODY = {
  circle: (c) => `<circle cx="6" cy="6" r="4" fill="none" stroke="${c}" stroke-width="1.6"/>`,
  square: (c) => `<rect x="2.2" y="2.2" width="7.6" height="7.6" fill="${c}"/>`,
  triangle: (c) => `<path d="M6 1.8 L10.6 9.8 L1.4 9.8 Z" fill="${c}"/>`,
  diamond: (c) => `<path d="M6 1.4 L10.4 6 L6 10.6 L1.6 6 Z" fill="${c}"/>`,
  hexagon: (c) => `<path d="M6 1.2 L10.2 3.6 L10.2 8.4 L6 10.8 L1.8 8.4 L1.8 3.6 Z" fill="${c}"/>`,
};
export function gearTier(id) { return GEAR_TIERS.find((t) => t.id === id) || null; }
export function tierMarkerSVG(id) {
  const t = gearTier(id);
  if (!t) return "";
  return `<svg class="tiermark" data-tier="${t.id}" data-shape="${t.shape}" width="11" height="11" viewBox="0 0 12 12" role="img" aria-label="${t.id} tier"><title>${t.id}</title>${TIER_MARKER_BODY[t.shape](t.color)}</svg>`;
}
export function tierMarkersForScope(scope) {
  return String(scope || "").split("/").map((s) => s.trim()).filter(Boolean)
    .map((id) => tierMarkerSVG(id)).join("");
}
export function rungTierMarkers(rung) { return tierMarkersForScope(rung && rung.tiers); }
export function bandTierMarkers(band) {
  const seen = [];
  for (const r of LADDER_RUNGS) {
    if (r.band !== band) continue;
    for (const id of String(r.tiers).split("/").map((s) => s.trim())) {
      if (id && !seen.includes(id)) seen.push(id);
    }
  }
  return seen.map((id) => tierMarkerSVG(id)).join("");
}

// Buying a rung: one-time per player, exact-once. Every refusal
// leaves the purse and the ladder exactly as they were. The order
// of checks names the refusal: unknown rung, the granted rung (it
// is given, never sold), a later beat's rung (not on this build's
// shelf), already owned, a rung prerequisite unmet, then funds.
export function buyRung(eco, id, ts) {
  const rung = rungById(id);
  if (!rung) return { ok: false, reason: "unknown" };
  if (rung.granted) return { ok: false, reason: "granted" };
  if (rung.beat > LADDER_BEAT) return { ok: false, reason: "beat", rung };
  if (ownsRung(eco, id)) return { ok: false, reason: "owned", rung };
  if (rung.requires && !ownsRung(eco, rung.requires)) {
    return { ok: false, reason: "requires", rung, missing: rungById(rung.requires) };
  }
  if (eco.credits < rung.price) return { ok: false, reason: "funds", rung };
  eco.credits -= rung.price;
  eco.lifetime.creditsSpent += rung.price;
  eco.lifetime.ladderSpent += rung.price;
  eco.ladder[id] = { ts, via: "bought" };
  return { ok: true, rung };
}

// The ladder's one grant (the Deep Stone Hat): given by the quest,
// never sold, and giving it twice changes nothing.
export function grantRung(eco, id, ts) {
  const rung = rungById(id);
  if (!rung || !rung.granted || ownsRung(eco, id)) return false;
  eco.ladder[id] = { ts, via: "granted" };
  return true;
}

// What the ladder's owned rungs do to the lamp — the one place the
// demo's shipped mechanics and a rung share a single parameter
// (the lamp's own light, game3.js toggleLamp). Wider: the Second
// Knot widens the cone. Longer: Small Hours stretches the throw
// and feeds the flame. Everything else a rung promises belongs to
// systems the demo does not carry yet; ownership is the record
// those systems will read when they land (see the build report).
export function ladderLampBonuses(eco) {
  return {
    intensity: ownsRung(eco, "lamp-of-small-hours") ? 1.0 : 0,
    distance: ownsRung(eco, "lamp-of-small-hours") ? 18 : 0,
    angle: ownsRung(eco, "bright-charm-second-knot") ? 0.15 : 0,
  };
}

// ---------- material: what digging yields (P-2, EE 1088 batch) ---------------
// EE 1034's loose end: a carved block vanished, so digging had no
// point. Now the break yields the block as typed material, placing
// spends it back into the world through the geometry record
// (Feature 1 — one mechanism, not two), and the excess sells into
// the purse. This section is the pure logic; the glue (game3.js)
// owns the chisel, the ray, and the panels.
//
// Rates are flux per block, anchored to the existing price level
// (P2-PRODUCER-REPORT.md carries the full derivation):
//   - Fork B conversion is 50 flux = 1 credit, so selling feeds
//     credits only through the ruled conversion — no new faucet.
//   - The cheapest ladder rung is 5 credits = 250 flux-equivalent;
//     the richest block here (crystal, 20) is 8% of that.
//   - The passive drip is 20 flux/hour; a brisk 100 stone/hour of
//     digging earns 400 flux ~ 8 credits-equivalent/hour, still
//     under the generation skill's derived 10 credits/hour.
// A type exists here exactly when the chisel can break it:
// BEDROCK and DEEPSTONE refuse by name and never break; SCAR is
// an override mark, never a base block. Keys are BLOCK ids
// (world.js); the BLOCK name rides in each def so this module
// never imports the world.
export const MATERIAL_DEFS = {
  1:  { block: "GRASS",     name: "grass",     flux: 2,  use: "The meadow's skin. Placed, it caps a dug column with green again." },
  2:  { block: "DIRT",      name: "dirt",      flux: 2,  use: "Plain earth — the honest filler. Every wall starts as dirt." },
  3:  { block: "STONE",     name: "stone",     flux: 4,  use: "The world's default rock: trench walls, bridges, stairs — the builder's block." },
  4:  { block: "WOOD",      name: "wood",      flux: 6,  use: "Tree-trunk timber. Placed, it stands as a post or a beam." },
  5:  { block: "LEAF",      name: "leaf",      flux: 1,  use: "Canopy stuff. Placed, it makes a green, rustling block." },
  6:  { block: "ASH",       name: "ash",       flux: 3,  use: "Ashfall's pale surface. Placed, it lightens dark ground." },
  7:  { block: "REDROCK",   name: "redrock",   flux: 5,  use: "The red strata rock of Ashfall and Trust Fall." },
  8:  { block: "BASALT",    name: "basalt",    flux: 5,  use: "Dark strata rock — heavy-looking, and it places heavy too." },
  9:  { block: "EMBER",     name: "ember",     flux: 12, use: "A living growth of Ashfall, warm to the touch." },
  10: { block: "BRICK",     name: "brick",     flux: 8,  use: "Worked stone from built places — the Hall's own stuff, pried loose." },
  13: { block: "CRYSTAL",   name: "crystal",   flux: 20, use: "A shining growth. The rarest thing a chisel frees." },
  14: { block: "VAULT",     name: "vault",     flux: 15, use: "Riftstone from the turned ceiling — it only exists where gravity flipped." },
  16: { block: "SANDSTONE", name: "sandstone", flux: 3,  use: "Dry-flat stone, gold in the mesas of Logos and Halycon." },
  17: { block: "MOSS",      name: "moss",      flux: 3,  use: "The lush patches' green cap, softer than grass." },
  18: { block: "SHALE",     name: "shale",     flux: 4,  use: "Band rock from the cliff strata; it splits in plates." },
};
export function materialDef(block) { return MATERIAL_DEFS[block] || null; }
export function materialCount(eco, block) {
  const c = eco.materials[block];
  return Number.isInteger(c) && c > 0 ? c : 0;
}
// The yield: n more of a type in the pack. Unknown types and
// non-positive yields change nothing and report 0.
export function addMaterial(eco, block, n = 1) {
  if (!materialDef(block) || !(n > 0)) return 0;
  eco.materials[block] = materialCount(eco, block) + Math.floor(n);
  return eco.materials[block];
}
// What the fox carries, in def order — the pack line and the
// field guide's material page read this, nothing else.
export function heldMaterials(eco) {
  return Object.keys(MATERIAL_DEFS).map(Number)
    .filter((b) => materialCount(eco, b) > 0)
    .map((b) => ({ ...MATERIAL_DEFS[b], block: b, count: eco.materials[b] }));
}
// Selling is exact-once like the ladder: a refused sale (nothing
// held, nothing asked) never touches the purse; a landed sale
// moves count -> flux in one step. n is a count or "all".
export function sellMaterial(eco, block, n) {
  const def = materialDef(block);
  const held = materialCount(eco, block);
  if (!def || held <= 0) return { ok: false, reason: "none" };
  const count = n === "all" ? held : Math.min(held, Math.max(0, Math.floor(+n || 0)));
  if (count <= 0) return { ok: false, reason: "none" };
  eco.materials[block] = held - count;
  if (eco.materials[block] <= 0) delete eco.materials[block];
  const gained = count * def.flux;
  eco.tokens += gained;
  eco.lifetime.tokensEarned += gained;
  eco.lifetime.materialsSold += count;
  return { ok: true, block, count, gained, def };
}

// ---------- the load-time sign-in prompt (A2-SKYSSO, build 42 attempt 2) ----------
// Pure module — no DOM, no storage, no fetch — like feedback.js:
// game3.js owns the panel and the network; this module owns the
// decisions and the URLs so tests can pin them.
//
// Will, Play 1: "prompt for login code / SSO authentication on
// load". The machinery this wires to ALREADY exists — nothing here
// invents a backend, an endpoint, or a credential store:
//  * SSO handoff: phext.tech's /api/game-login (game3.js loginUrl,
//    used by the board / save / ideas doors). The platform asks
//    phext-edit's /api/session who is signed in and returns with a
//    signed game-scoped token in the URL fragment (np_token=…),
//    which takeLoginToken() stores as the game token. The wiki's
//    SSO (audience novafoxwiki) is the wiki's own handoff and is
//    NOT the game's — the game has always used this game-login
//    path, so the prompt uses it too.
//  * Login code: the license code the game already holds doors
//    for — a Gumroad license key or a gift key (NFG-…) — presented
//    to the gateway's POST /api/v2/license-session (W-3, economy.js
//    parseLicenseAnswer / applyLicenseSession, game3.js
//    presentLicenseKey). A paid answer marks the session paid.
// The prompt never hard-blocks play: with no session the game has
// always run as a full free session (W-3 contract), and the prompt
// keeps that — it is shown, it is dismissible, and the game
// proceeds whether it is answered, dismissed, or the gateway
// never answers at all.

// The SSO handoff URL, exactly as game3.js loginUrl() has always
// built it (BACKEND.base + this path, back to the game's home).
export const SSO_GAME_LOGIN_PATH = "/api/game-login";
export const GAME_HOME_URL = "https://fox.phext.io/";
export function ssoLoginUrl(base) {
  return `${base}${SSO_GAME_LOGIN_PATH}?back=${encodeURIComponent(GAME_HOME_URL)}`;
}
// The W-3 license-session endpoint the login code is presented to.
export const LICENSE_SESSION_PATH = "/api/v2/license-session";
export function licenseSessionUrl(base) {
  return `${base}${LICENSE_SESSION_PATH}`;
}

// Should the load-time prompt be shown? Input is the session state
// the glue can actually know on load:
//   hasToken   — a game token from a prior SSO handoff is stored
//   hasKey     — a license key is already held (it is presented on
//                connect by presentLicenseKey, W-3, as always)
//   dismissed  — the player dismissed the prompt THIS load
// A session is "established" when either stands. Gateway
// reachability (online) deliberately does NOT gate the prompt:
// offline, the prompt still offers the code field and the SSO
// door, and dismissing it leaves the full free game — the prompt
// is an offer, never a gate.
export function authPromptDecision(state) {
  const s = state || {};
  if (s.hasToken) return { show: false, reason: "session-token" };
  if (s.hasKey) return { show: false, reason: "session-key" };
  if (s.dismissed) return { show: false, reason: "dismissed" };
  return { show: true, reason: s.online === false ? "no-session-offline" : "no-session" };
}
export function shouldShowAuthPrompt(state) {
  return authPromptDecision(state).show;
}

// A login code, normalised the way the existing doors normalise
// theirs: trimmed; gift keys (NFG-…) are kept upper-cased (the
// gift door's own discipline, economy.js applyLicenseSession).
export function normalizeLoginCode(code) {
  const k = String(code || "").trim();
  return /^nfg-/i.test(k) ? k.toUpperCase() : k;
}
export function loginCodeKind(code) {
  const k = normalizeLoginCode(code);
  if (!k) return "empty";
  return /^NFG-/.test(k) ? "gift" : "license";
}
