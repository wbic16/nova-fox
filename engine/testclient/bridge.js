"use strict";
/*
 * Nova Fox test-client bridge — injected into the game page by the
 * test-client server (server.mjs) at serve time. The game tree on disk
 * is never modified; this script rides along with the served page only.
 *
 * What it does:
 *   - waits for the game's own handle, window.NOVA_FOX3 (the same
 *     handle the CDP harness used), and announces a session;
 *   - samples the live game (state, subspace, economy, narration) and
 *     reports snapshots + transition events + a position track to the
 *     server;
 *   - executes commands from the server through the game's REAL input
 *     path: synthetic KeyboardEvents dispatched on `document`, which
 *     the game's own keydown/keyup handlers process exactly as they
 *     process a physical keyboard (notes via the Digit row, walking by
 *     holding KeyW, turning by ArrowLeft/ArrowRight taps, gravity by
 *     KeyG, Fox Vision by KeyN). Two deliberate exceptions, both
 *     documented in TESTCLIENT-REPORT.md:
 *       * strike calls NOVA_FOX3.tryStrike() directly, because the F
 *         key's meaning is scheme-dependent (in the AWEF scheme F
 *         walks and the strike lives on the mouse click); tryStrike is
 *         the single real entry point both input paths converge on.
 *       * dismiss-splash calls the game's own dismissSplash().
 *   - NEVER writes game state: no teleporting, no state edits, no
 *     forged inscriptions. Observation reads the handle; action goes
 *     through input.
 */
(function () {
  if (window.__NF_BRIDGE__) return;
  window.__NF_BRIDGE__ = true;

  // The server that injected us tells us where it lives (a file://
  // page's location.origin is the string "null", so never trust it
  // blindly).
  const ORIGIN = window.__NF_SERVER__ || location.origin;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const now = () => Date.now();

  let H = null;          // the NOVA_FOX3 handle
  let sessionId = null;
  let lastSnap = null;   // last reported snapshot (for event diffing)
  let trackBuf = [];     // position samples since last report
  let lastToast = null;

  // ---------- input: the game's own handlers, fed real-shaped events ----
  function keyEvent(type, code, key) {
    document.dispatchEvent(new KeyboardEvent(type, {
      code, key, bubbles: true, cancelable: true,
    }));
  }
  const KEY_FOR_CODE = {
    KeyW: "w", KeyS: "s", KeyG: "g", KeyN: "n", KeyA: "a", KeyD: "d",
    KeyE: "e", KeyF: "f", Space: " ",
    ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight",
  };
  // Movement keys follow the fox's control scheme (the game assigns
  // WASD or AWEF per player): WASD walks W/S and strafes A/D; AWEF
  // walks F/A and strafes W/E. Read live from state, never assumed.
  function moveKeys() {
    return H.state.scheme === "AWEF"
      ? { fwd: "KeyF", back: "KeyA", left: "KeyW", right: "KeyE" }
      : { fwd: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD" };
  }
  function keyTap(code, holdMs = 60) {
    keyEvent("keydown", code, KEY_FOR_CODE[code] || code);
    return sleep(holdMs).then(() => keyEvent("keyup", code, KEY_FOR_CODE[code] || code));
  }
  function keyHold(code, ms) {
    keyEvent("keydown", code, KEY_FOR_CODE[code] || code);
    return sleep(ms).then(() => keyEvent("keyup", code, KEY_FOR_CODE[code] || code));
  }
  const NOTE_CODE = (n) =>
    n >= 1 && n <= 9 ? "Digit" + n : n === 10 ? "Digit0" : n === 11 ? "Minus" : null;
  const NOTE_KEY = (n) => (n === 11 ? "-" : String(n % 10));

  function keyTapNote(code, key, holdMs = 60) {
    keyEvent("keydown", code, key);
    return sleep(holdMs).then(() => keyEvent("keyup", code, key));
  }

  // ---------- observation ------------------------------------------------
  function capabilities() {
    const s = H.state;
    return {
      handle: true,
      foxVision: typeof s.foxVision === "boolean" || typeof H.toggleFoxVision === "function",
      survey: typeof H.surfaceY === "function",
      portalState: typeof H.portalState === "function",
      economy: typeof H.ecoState === "function",
      scheme: s.scheme || null,
    };
  }

  function snapshot() {
    const s = H.state, sub = H.sub;
    const sx = Math.floor(s.pos.x / 64), sy = Math.floor(s.pos.z / 64);
    let scrollGrav = null;
    try { scrollGrav = sub.gravityOf(s.realm, sx, sy); } catch (e) { /* older builds */ }
    let realmGrav = null;
    try { realmGrav = sub.realmGravity.get(s.realm); } catch (e) { /* ignore */ }
    if (realmGrav === undefined) realmGrav = null;

    let rift = { open: false };
    try {
      const p = H.portalState();
      if (p && p.open) {
        // portalState().end is the string "a"/"b" (which end of the
        // link is shown); the end's coordinates live in
        // state.riftLink[that letter].
        let end = null;
        const link = s.riftLink, which = s.rift && s.rift.end;
        if (link && which && link[which]) {
          const e = link[which];
          end = { x: e.x, z: e.z, landX: e.landX, landZ: e.landZ, feetY: e.feetY, realmId: e.realmId };
        }
        rift = {
          open: true, crosses: p.crosses, linkId: p.linkId,
          targetType: p.targetType, destRealm: p.destRealm,
          ringRadius: p.ringRadius,
          disc: s.rift && s.rift.geo ? s.rift.geo.disc : null,
          end,
        };
      }
    } catch (e) { /* portal state unavailable */ }

    let purse = null;
    try {
      const eco = H.ecoState();
      purse = { flux: eco.tokens, credits: eco.credits };
    } catch (e) { /* economy unavailable */ }

    let narration = { speaking: null, pending: [] };
    try {
      const ns = H.narration.state();
      narration = { speaking: ns.speaking, pending: ns.pending || [] };
    } catch (e) { /* narration unavailable */ }

    let toastText = null;
    try {
      const el = document.getElementById("comms");
      if (el && el.style.opacity !== "0" && el.textContent) toastText = el.textContent;
    } catch (e) { /* no comms element */ }
    if (toastText) lastToast = toastText;

    const guide = typeof H.guideCurrent === "function" ? H.guideCurrent() : null;
    const snap = {
      t: now(),
      realm: s.realm,
      pos: { x: s.pos.x, y: s.pos.y, z: s.pos.z },
      yaw: s.yaw, pitch: s.pitch, onGround: s.onGround,
      gravDir: s.gravDir,
      gravity: { foxDir: s.gravDir, realmValue: realmGrav, scrollValue: scrollGrav, scroll: { sx, sy } },
      hp: s.hp, maxHp: s.maxHp, hearts: s.hp / 2, dead: !!s.dead,
      scheme: s.scheme || null, splash: !!s.splash,
      foxVision: typeof s.foxVision === "boolean" ? s.foxVision : null,
      vision: (() => { try { return typeof H.foxVisionState === "function" ? H.foxVisionState() : null; } catch (e) { return null; } })(),
      guide: { step: s.guideStep, current: guide ? guide.id : null },
      narration,
      rift,
      purse,
      counters: {
        flips: s.flips, notesPlayed: s.notesPlayed, jumped: s.jumped,
        movedTotal: Math.round(s.movedTotal * 100) / 100, wispKills: s.wispKills,
      },
      quest: { done: !!sub.questDone, hatGranted: !!sub.hatGranted },
      toast: lastToast,
      capabilities: capabilities(),
    };
    return snap;
  }

  function marks() {
    const sub = H.sub;
    const wal = sub.wal || [];
    const overrides = {};
    try {
      for (const [realm, m] of sub.overrides) overrides[realm] = m.size;
    } catch (e) { /* ignore */ }
    return {
      inscriptions: wal.length,
      recent: wal.slice(-25).map((w) => ({
        seq: w.seq, op: w.op,
        where: String(w.where).slice(0, 120),
        detail: String(w.detail).slice(0, 200),
      })),
      overrides,
      monsters: (sub.monsters || []).length,
      questDone: !!sub.questDone, hatGranted: !!sub.hatGranted,
    };
  }

  function diffEvents(prev, cur) {
    const evs = [];
    if (!prev) return evs;
    const push = (type, data) => evs.push({ type, t: cur.t, ...data });
    if (cur.realm !== prev.realm) push("realm", { from: prev.realm, to: cur.realm });
    if (cur.narration.speaking && cur.narration.speaking !== prev.narration.speaking)
      push("beat", { id: cur.narration.speaking });
    if (cur.rift.open && !prev.rift.open) push("rift-open", { end: cur.rift.end, targetType: cur.rift.targetType });
    if (!cur.rift.open && prev.rift.open) push("rift-close", {});
    if (cur.rift.crosses != null && prev.rift.crosses != null && cur.rift.crosses > prev.rift.crosses)
      push("crossed", { crosses: cur.rift.crosses, realm: cur.realm });
    if (cur.hp < prev.hp) push("hurt", { hp: cur.hp, was: prev.hp });
    if (cur.dead && !prev.dead) push("death", {});
    if (!cur.dead && prev.dead) push("respawn", { realm: cur.realm });
    if (cur.gravDir !== prev.gravDir) push("gravity", { dir: cur.gravDir, realmValue: cur.gravity.realmValue });
    if (cur.quest.done && !prev.quest.done) push("quest-done", {});
    if (cur.quest.hatGranted && !prev.quest.hatGranted) push("hat-granted", {});
    return evs;
  }

  // ---------- commands ----------------------------------------------------
  const commands = {
    "dismiss-splash": async () => {
      if (H.state.splash) H.dismissSplash();
      return { splash: !!H.state.splash };
    },
    "play-note": async ({ note }) => {
      const code = NOTE_CODE(note);
      if (!code) throw new Error("note out of range (1..11)");
      await keyTapNote(code, NOTE_KEY(note));
      return { note, notesPlayed: H.state.notesPlayed };
    },
    "play-tune": async ({ notes, gapMs = 150 }) => {
      if (!Array.isArray(notes) || notes.length < 1 || notes.length > 6)
        throw new Error("notes must be an array of 1..6 note numbers");
      for (const n of notes) {
        const code = NOTE_CODE(n);
        if (!code) throw new Error("note out of range (1..11)");
        await keyTapNote(code, NOTE_KEY(n));
        await sleep(gapMs);
      }
      return { notes, riftOpen: !!(H.state.rift) };
    },
    "walk": async ({ durationMs, backward = false, strafe = null }) => {
      const ms = Math.max(50, Math.min(30000, durationMs | 0));
      const mk = moveKeys();
      const code = strafe === "left" ? mk.left : strafe === "right" ? mk.right : backward ? mk.back : mk.fwd;
      const before = { x: H.state.pos.x, z: H.state.pos.z };
      await keyHold(code, ms);
      const after = H.state.pos;
      return {
        durationMs: ms,
        moved: Math.round(Math.hypot(after.x - before.x, after.z - before.z) * 100) / 100,
        realm: H.state.realm,
      };
    },
    "turn": async ({ steps = 1, direction = "left" }) => {
      const code = direction === "right" ? "ArrowRight" : "ArrowLeft";
      const yawBefore = H.state.yaw;
      const n = Math.max(1, Math.min(24, steps | 0));
      for (let i = 0; i < n; i++) { await keyTap(code, 40); await sleep(50); }
      let delta = H.state.yaw - yawBefore;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      return { steps: n, direction, yawBefore, yawAfter: H.state.yaw, deltaRad: Math.round(delta * 1000) / 1000 };
    },
    "jump": async () => {
      const jumpedBefore = H.state.jumped;
      await keyTap("Space", 80);
      await sleep(120);
      return { jumped: H.state.jumped, delta: H.state.jumped - jumpedBefore };
    },
    "strike": async () => {
      // Direct call to the game's real strike entry — see header note.
      H.tryStrike();
      await sleep(60);
      return { swingT: H.state.swingT, wispKills: H.state.wispKills };
    },
    "flip-gravity": async () => {
      const before = { dir: H.state.gravDir, flips: H.state.flips };
      await keyTap("KeyG", 60);
      await sleep(250);
      return {
        before, after: { dir: H.state.gravDir, flips: H.state.flips },
        changed: H.state.gravDir !== before.dir, toast: lastToast,
      };
    },
    "fox-vision": async () => {
      if (!capabilities().foxVision) throw new Error("NOT_SUPPORTED: this build has no Fox Vision");
      await keyTap("KeyN", 60);
      await sleep(120);
      let st = null;
      try { st = typeof H.foxVisionState === "function" ? H.foxVisionState() : { on: H.state.foxVision }; }
      catch (e) { st = { on: H.state.foxVision }; }
      return { vision: st };
    },
    "survey": async ({ cx, cz, radius = 26, step = 2 }) => {
      if (typeof H.surfaceY !== "function") throw new Error("NOT_SUPPORTED: no surfaceY in this build");
      const pts = [];
      for (let x = Math.floor(cx - radius); x <= cx + radius; x += step)
        for (let z = Math.floor(cz - radius); z <= cz + radius; z += step)
          pts.push({ x, z, y: H.surfaceY(x, z) });
      return { center: { x: cx, z: cz }, radius, step, points: pts };
    },
  };

  async function ack(id, ok, payload) {
    try {
      await fetch(ORIGIN + "/bridge/ack", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, id, ok, ...(ok ? { result: payload } : { error: String(payload) }) }),
      });
    } catch (e) { /* server gone; nothing to ack to */ }
  }

  function listen() {
    const es = new EventSource(ORIGIN + "/bridge/stream?session=" + encodeURIComponent(sessionId));
    es.onmessage = async (msg) => {
      let cmd;
      try { cmd = JSON.parse(msg.data); } catch (e) { return; }
      const fn = commands[cmd.type];
      if (!fn) { ack(cmd.id, false, "unknown command: " + cmd.type); return; }
      try { ack(cmd.id, true, await fn(cmd.args || {})); }
      catch (e) { ack(cmd.id, false, e && e.message ? e.message : e); }
    };
  }

  async function reportLoop() {
    for (;;) {
      try {
        const snap = snapshot();
        const events = diffEvents(lastSnap, snap);
        lastSnap = snap;
        const track = trackBuf; trackBuf = [];
        await fetch(ORIGIN + "/bridge/report", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, snapshot: snap, marks: marks(), events, track }),
        });
      } catch (e) { /* transient; keep sampling */ }
      await sleep(150);
    }
  }

  function trackLoop() {
    setInterval(() => {
      if (!H) return;
      const s = H.state;
      trackBuf.push({ t: now(), x: s.pos.x, z: s.pos.z, realm: s.realm });
      if (trackBuf.length > 600) trackBuf.splice(0, trackBuf.length - 600);
    }, 40);
  }

  async function boot() {
    while (!window.NOVA_FOX3) await sleep(100);
    H = window.NOVA_FOX3;
    const hello = await (await fetch(ORIGIN + "/bridge/hello", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ua: navigator.userAgent,
        capabilities: capabilities(),
        href: location.href,
      }),
    })).json();
    sessionId = hello.sessionId;
    if (H.state.splash) { try { H.dismissSplash(); } catch (e) { /* panel stays; a human key also clears it */ } }
    listen();
    trackLoop();
    reportLoop();
  }

  boot();
})();
