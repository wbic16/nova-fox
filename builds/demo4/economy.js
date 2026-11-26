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
  // against the $5 cash price).
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
      handdownsSent: 0, handdownsReceived: 0,
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
  return s;
}
export function isGenerator(eco) { return eco.entitlement.status === "paid"; }

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
    if (source !== "gumroad" && source !== "gift") continue;
    seen.add(name);
    rows.push({ name, source, ts: +ts || 0, number: rows.length + 1 });
  }
  return rows;
}
export function purchaseNumberFor(rows, name) {
  const r = rows.find((x) => x.name === name);
  return r ? r.number : null;
}
