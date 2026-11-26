// Nova Fox test-client check suite — the e2e legs, run against a real
// running game entirely over the test-client API (no CDP, no browser
// automation; the only browser involvement is launch.mjs opening the
// page). Every measurement below is read back from the live game.
//
// Ported from PORTAL-DIAGNOSIS.md §3/§6 — the legs the old harness
// never had:
//   * portal-offcenter: approach the ring 1.25 blocks off its center —
//     inside the visible disc (r = 1.467) but outside the broken
//     build's hard-coded trigger (r = 1.118). The diagnosis's veer
//     scenario D in parallel-approach form: the keyboard's turn
//     granularity is 0.32 rad, which cannot express the diagnosis's
//     21° veer (1 step = 18.3° passes at 1.07 blocks — inside even the
//     broken trigger), so the offset is set by measured strafing
//     instead. A separate 18.3° veer leg runs as data.
//   * portal-uphill: open the bridge rift on ground that rises >= 2.6
//     blocks across the 3.4-block gap (defect 2's envelope).
// Smoke set: spawn state, tune crossing home, gravity flip, gravity
// once-per-day refusal, Fox Vision capability.
//
// Each check reports PASS / FAIL / ABSENT (the build under test does
// not carry the feature the check exercises — reported, never faked).
// A required check FAILing fails the suite; ABSENT does not.
//
//   node checks.mjs --tree ../demo7 [--out results-demo7.json]
import { writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchGame } from "./launch.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const dist2d = (x1, z1, x2, z2) => Math.hypot(x1 - x2, z1 - z2);

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf("--" + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const TREE = resolve(argVal("tree", join(HERE, "..", "integration")));
const OUT = argVal("out", null);
const ONLY = argVal("only", null) ? argVal("only", null).split(",") : null;

const results = [];
function record(name, status, details, required = true) {
  results.push({ name, status, required, ...details });
  console.log(`${status.padEnd(6)} ${name} — ${details.summary || ""}`);
}

// Closed-loop walk to (tx, tz) using only state reads + turn/walk.
async function gotoPos(client, tx, tz, { tol = 1.2, timeoutMs = 240000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const s = await client.state();
    const dx = tx - s.pos.x, dz = tz - s.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= tol) return { ok: true, dist, pos: s.pos };
    if (Date.now() - t0 > timeoutMs) return { ok: false, dist, pos: s.pos };
    const desired = Math.atan2(-dx, -dz);
    const steps = Math.round(wrap(desired - s.yaw) / 0.32);
    if (steps !== 0) await client.turn(steps > 0 ? "left" : "right", Math.min(Math.abs(steps), 5));
    else await client.walk(500);
  }
}

async function openBridgeRift(client) {
  await client.playTune([1, 4, 9]);
  return client.waitFor(async () => {
    const s = await client.state();
    return s.rift && s.rift.open ? s : null;
  }, 9000, 200, "rift opens");
}

// Walk forward in chunks until the realm changes or the deadline
// passes. Fixed-duration walks are meaningless under software
// rendering — the fox's pace varies with the box's load (measured
// 0.3–1+ blocks/s) — so the leg's real assertion (crossed or not)
// gets a deadline, not a duration. Returns the track-based closest
// approach to (cx, cz) measured in `realm` (an approximation: the
// track is sampled in-page and thins out under load, so treat the
// number as an upper bound on the true closest approach).
async function walkAndMeasure(client, deadlineMs, cx, cz, realm) {
  const t0 = Date.now();
  let crossed = false;
  while (Date.now() - t0 < deadlineMs) {
    await client.walk(4000);
    const s = await client.state().catch(() => null);
    if (s && s.realm !== realm) { crossed = true; break; }
  }
  const samples = (await client.track(t0 - 500)).samples.filter((p) => p.realm === realm);
  let closest = Infinity;
  for (const p of samples) closest = Math.min(closest, dist2d(p.x, p.z, cx, cz));
  const after = await client.state();
  return { crossed: crossed || after.realm !== realm, closest, samples: samples.length, realmAfter: after.realm };
}

async function main() {
  console.log("tree:", TREE);
  const g = await launchGame({ tree: TREE });
  const c = g.client;
  const want = (name) => !ONLY || ONLY.includes(name);
  try {
    await c.dismissSplash().catch(() => {});
    await sleep(600);

    // ---- smoke: spawn state -------------------------------------------
    if (want("spawn-state")) {
      try {
        const s = await c.state();
        const ok = s.realm === "nova" && s.hp === s.maxHp && Number.isFinite(s.pos.x) && !!s.purse;
        record("spawn-state", ok ? "PASS" : "FAIL", {
          summary: `realm=${s.realm} pos=(${s.pos.x.toFixed(1)}, ${s.pos.y.toFixed(1)}, ${s.pos.z.toFixed(1)}) hp=${s.hp}/${s.maxHp} scheme=${s.scheme} purse=${s.purse ? s.purse.flux + " flux / " + s.purse.credits + " cr" : "n/a"}`,
          realm: s.realm, pos: s.pos, hp: s.hp, scheme: s.scheme,
        });
      } catch (e) { record("spawn-state", "FAIL", { summary: e.message }); }
    }

    // ---- portal regression: 18.3-degree veer (data leg) ----------------
    if (want("portal-veer")) {
      try {
        const s0 = await c.state();
        if (s0.realm !== "nova") throw new Error("expected nova, in " + s0.realm);
        const rs = await openBridgeRift(c);
        const end = rs.rift.end;
        const turn = await c.turn("left", 1);
        const m = await walkAndMeasure(c, 60000, end.x, end.z, "nova");
        record("portal-veer-18deg", m.crossed ? "PASS" : "FAIL", {
          summary: `turned ${turn.deltaRad} rad; closest approach ${m.closest.toFixed(3)} blocks (disc ${rs.rift.disc ? rs.rift.disc.toFixed(3) : "?"}); crossed=${m.crossed}`,
          closest: m.closest, disc: rs.rift.disc, crossed: m.crossed, required: false,
        }, false);
      } catch (e) { record("portal-veer-18deg", "FAIL", { summary: e.message }, false); }
    }

    // ---- back home if the veer crossed ---------------------------------
    let inAshfall = (await c.state()).realm === "ashfall";
    if (inAshfall && want("cross-home-setup")) {
      try {
        const rs = await openBridgeRift(c);
        const m = await walkAndMeasure(c, 60000, rs.rift.end.x, rs.rift.end.z, "ashfall");
        inAshfall = m.realmAfter === "ashfall";
        record("cross-home-setup", m.crossed ? "PASS" : "FAIL", {
          summary: `straight walk home; closest ${m.closest.toFixed(3)}; realm now ${m.realmAfter}`,
        }, false);
      } catch (e) { record("cross-home-setup", "FAIL", { summary: e.message }, false); }
    }

    // ---- portal regression: off-center approach (defect 1) -------------
    if (want("portal-offcenter")) {
      try {
        let s = await c.state();
        if (s.realm !== "nova") throw new Error("needs nova (in " + s.realm + ")");
        const rs = await openBridgeRift(c);
        const end = rs.rift.end;
        // Strafe left in bursts until the measured lateral offset from
        // the ring's approach line is ~1.25 blocks: inside the visible
        // disc (1.467), outside the broken trigger (1.118).
        const fwd = { x: -Math.sin(s.yaw), z: -Math.cos(s.yaw) };
        const lat0 = s.pos.x * fwd.z - s.pos.z * fwd.x; // lateral coord along approach axis
        // Closed-loop strafing into the band [1.25, 1.40]: short
        // bursts, correcting back right if a burst overshoots past
        // the disc's edge (1.467) — an overshot approach misses the
        // ring entirely and proves nothing.
        for (let i = 0; i < 40; i++) {
          const cur = await c.state();
          const off = (cur.pos.x * fwd.z - cur.pos.z * fwd.x) - lat0;
          if (off >= 1.25 && off <= 1.40) break;
          if (off > 1.40) await c.walk(120, { strafe: "right" });
          else await c.walk(150, { strafe: "left" });
        }
        const pre = await c.state();
        const latOff = Math.abs((pre.pos.x * fwd.z - pre.pos.z * fwd.x) - lat0);
        const m = await walkAndMeasure(c, 60000, end.x, end.z, "nova");
        // A pass only discriminates if the offset was actually
        // established beyond the broken build's 1.118 trigger: below
        // that, crossing proves nothing about the fix.
        const discriminates = latOff >= 1.2;
        record("portal-offcenter", m.crossed && discriminates ? "PASS" : "FAIL", {
          summary: `lateral offset ${latOff.toFixed(2)} blocks${discriminates ? "" : " (BELOW the 1.2 needed to discriminate — pass would prove nothing)"}; closest approach ${m.closest.toFixed(3)} (disc ${rs.rift.disc ? rs.rift.disc.toFixed(3) : "?"}); crossed=${m.crossed}`,
          lateralOffset: latOff, closest: m.closest, disc: rs.rift.disc, crossed: m.crossed,
        });
        inAshfall = m.realmAfter === "ashfall";
      } catch (e) { record("portal-offcenter", "FAIL", { summary: e.message }); }
    }

    // ---- smoke: tune crossing home (dead-center, from Ashfall) ---------
    if (want("tune-crossing-home")) {
      try {
        if (!inAshfall) {
          record("tune-crossing-home", "ABSENT", { summary: "prerequisite not met: the fox is not in Ashfall (off-center leg did not cross)" });
        } else {
          const rs = await openBridgeRift(c);
          const m = await walkAndMeasure(c, 60000, rs.rift.end.x, rs.rift.end.z, "ashfall");
          record("tune-crossing-home", m.crossed && m.realmAfter === "nova" ? "PASS" : "FAIL", {
            summary: `bridge tune from Ashfall; closest ${m.closest.toFixed(3)}; realm now ${m.realmAfter}`,
            closest: m.closest, crossed: m.crossed,
          });
          inAshfall = m.realmAfter === "ashfall";
        }
      } catch (e) { record("tune-crossing-home", "FAIL", { summary: e.message }); }
    }

    // ---- portal regression: uphill opening (defect 2) -------------------
    if (want("portal-uphill")) {
      try {
        let s = await c.state();
        if (s.realm !== "nova") throw new Error("needs nova (in " + s.realm + ")");
        const survey = await c.survey(Math.round(s.pos.x), Math.round(s.pos.z), 40, 2);
        const grid = new Map(survey.points.map((p) => [p.x + "," + p.z, p.y]));
        const gAt = (x, z) => grid.get(Math.round(x / 2) * 2 + "," + Math.round(z / 2) * 2);
        let best = null, maxRise = -Infinity;
        for (const p of survey.points) {
          for (let k = 0; k < 8; k++) {
            const yaw = (k * Math.PI) / 4;
            const rx = p.x + -Math.sin(yaw) * 3.4, rz = p.z + -Math.cos(yaw) * 3.4;
            const gr = gAt(rx, rz);
            if (gr === undefined) continue;
            const rise = gr - p.y;
            if (rise > maxRise) maxRise = rise;
            if (rise < 2.6) continue;
            const d = dist2d(s.pos.x, s.pos.z, p.x, p.z);
            if (!best || d < best.d || (d === best.d && rise > best.rise)) best = { x: p.x, z: p.z, yaw, rise, d };
          }
        }
        if (!best) {
          record("portal-uphill", "ABSENT", {
            summary: `no >=2.6-block rise within 40 blocks of spawn (steepest found: ${maxRise.toFixed(2)} blocks across the 3.4-block gap — below the broken build's 2.4-block |dy| envelope, so the defect-2 scenario cannot be staged from this spawn)`,
            maxRise,
          });
        } else {
          const nav = await gotoPos(c, best.x, best.z);
          if (!nav.ok) throw new Error(`navigation to the slope failed (stopped ${nav.dist.toFixed(1)} blocks short)`);
          const cur = await c.state();
          const steps = Math.round(wrap(best.yaw - cur.yaw) / 0.32);
          if (steps !== 0) await c.turn(steps > 0 ? "left" : "right", Math.abs(steps));
          const foxGround = (await c.state()).pos.y - 1.01;
          const rs = await openBridgeRift(c);
          const ringGround = rs.rift.end.feetY;
          const m = await walkAndMeasure(c, 60000, rs.rift.end.x, rs.rift.end.z, "nova");
          record("portal-uphill", m.crossed ? "PASS" : "FAIL", {
            summary: `ground rise across the gap ${(ringGround - foxGround).toFixed(2)} blocks (survey said ${best.rise.toFixed(2)}); closest ${m.closest.toFixed(3)}; crossed=${m.crossed}`,
            rise: ringGround - foxGround, closest: m.closest, crossed: m.crossed,
          });
          inAshfall = m.realmAfter === "ashfall";
          if (inAshfall) { // leave the fox home for the gravity legs
            const back = await openBridgeRift(c);
            await walkAndMeasure(c, 60000, back.rift.end.x, back.rift.end.z, "ashfall");
          }
        }
      } catch (e) { record("portal-uphill", "FAIL", { summary: e.message }); }
    }

    // ---- smoke: gravity flip --------------------------------------------
    if (want("gravity-flip")) {
      try {
        const before = await c.state();
        await c.flipGravity();
        await sleep(500);
        const after = await c.state();
        const ok = after.gravDir === -before.gravDir &&
          (after.gravity.realmValue === null || after.gravity.realmValue === after.gravDir);
        record("gravity-flip", ok ? "PASS" : "FAIL", {
          summary: `gravDir ${before.gravDir} -> ${after.gravDir}; subspace realm value ${before.gravity.realmValue} -> ${after.gravity.realmValue}`,
          before: before.gravDir, after: after.gravDir, realmValue: after.gravity.realmValue,
        });
        await c.flipGravity().catch(() => {}); // restore attempt (refused in once-per-day builds)
        await sleep(400);
      } catch (e) { record("gravity-flip", "FAIL", { summary: e.message }); }
    }

    // ---- smoke: gravity once-per-day refusal ------------------------------
    if (want("gravity-refusal")) {
      try {
        const s0 = await c.state();
        await c.flipGravity();
        await sleep(500);
        const s1 = await c.state();
        if (s1.gravDir === s0.gravDir && s1.counters.flips === s0.counters.flips) {
          record("gravity-refusal", "PASS", {
            summary: "a shift was refused outright (gravDir and flip count unchanged — today's shift for this realm is already spent)",
            toast: s1.toast,
          });
        } else if (s1.gravDir !== s0.gravDir) {
          await c.flipGravity();
          await sleep(500);
          const s2 = await c.state();
          if (s2.gravDir === s1.gravDir && s2.counters.flips === s1.counters.flips) {
            record("gravity-refusal", "PASS", {
              summary: "second shift in the same realm on the same day refused by the game (gravDir held, flip count held)",
              toast: s2.toast,
            });
          } else {
            record("gravity-refusal", "ABSENT", {
              summary: "two shifts in a row succeeded — this build carries no once-per-day rule (it lands with the gravity build)",
            });
          }
        } else {
          record("gravity-refusal", "FAIL", { summary: "flip changed the flip counter but not gravity — ambiguous refusal signal" });
        }
      } catch (e) { record("gravity-refusal", "FAIL", { summary: e.message }); }
    }

    // ---- Fox Vision capability --------------------------------------------
    if (want("fox-vision")) {
      try {
        const s = await c.state();
        if (!s.capabilities.foxVision) {
          record("fox-vision", "ABSENT", { summary: "this build carries no Fox Vision" });
        } else {
          const before = s.foxVision;
          await c.foxVision();
          await sleep(300);
          const after = await c.state();
          if (after.foxVision !== before) {
            record("fox-vision", "PASS", { summary: `vision toggled ${before} -> ${after.foxVision} via the N-key path` });
            await c.foxVision().catch(() => {});
          } else if (after.vision && after.vision.inHall === false) {
            record("fox-vision", "ABSENT", {
              summary: "vision is wired, but the toggle only takes hold inside the Unexpected Hall — spawn is outside it, so the sense was not exercised",
              vision: after.vision,
            });
          } else {
            record("fox-vision", "FAIL", { summary: "toggle invoked, vision state did not change", vision: after.vision });
          }
        }
      } catch (e) { record("fox-vision", "FAIL", { summary: e.message }); }
    }
  } finally {
    await g.close();
  }

  const fails = results.filter((r) => r.status === "FAIL" && r.required);
  const summary = {
    tree: TREE,
    at: new Date().toISOString(),
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    absent: results.filter((r) => r.status === "ABSENT").length,
    results,
  };
  console.log(`\n== ${summary.pass} passed, ${summary.fail} failed, ${summary.absent} absent (tree: ${TREE})`);
  if (OUT) writeFileSync(OUT, JSON.stringify(summary, null, 2));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error("suite error:", e.message); process.exit(2); });
