// Nova Fox demo3 — view + input + game loop.
//
// Three.js renders a first-person voxel world GENERATED from subspace
// state (world.js). This file holds no world truth: terrain, features,
// gravity, monsters, and the quest all live in the Subspace; the view
// meshes what genChunk() derives, reports events back for inscription,
// and obeys the gravity the current scroll declares.
//
// The veil binds everything in-fiction: chart, rift, tune, page, the
// dark. The readout panel is demo instrumentation for Will, labelled
// as such — it may name machinery the fiction never mentions.

// ---------- the ship stamp: the version is an epoch ---------------------
// Nova Fox versions derive from the Exocortical Epoch they ship
// within (Will, 2026-11-26). The epoch: EE 1 opened at unix
// 1795327200 (2026-11-22 00:00 CST), each epoch runs 420 seconds,
// EE = floor((now − 1795327200) / 420) + 1. The token below is the
// ONE place the version lives in the source: at staging time its
// digits are rewritten to the then-current epoch, and the staged
// file is hashed after stamping. The stamp stands nowhere on
// screen — hovering the standing realm title speaks it, as hover
// text; on touch, a tap on the title toggles it.
const NF_SHIP_EE = "NF_SHIP_EE:950";
const SHIP_EE = NF_SHIP_EE.split(":")[1];

// ---------- boot ------------------------------------------------------

const wasmBytes = Uint8Array.from(atob(NOVA_CORE_WASM_B64), (c) =>
  c.charCodeAt(0)
);
await kernels.init(wasmBytes);

const sub = new Subspace();

const state = {
  realm: "nova",
  pos: new THREE.Vector3(8.5, 20, 8.5), // feet
  vel: new THREE.Vector3(),
  yaw: Math.PI * 0.75, // face the meadow, the barrow hill beyond
  pitch: -0.05,
  onGround: false,
  gravDir: 1,
  hp: 20, maxHp: 20,
  invulnUntil: 0,
  notes: [], // note numbers collected toward a chord
  notesTimer: null,
  pocketChord: null, // the tune of the pocket page we stand in, if any
  pocketScroll: null, // {sx, sy} of that pocket page
  lastScrollKey: "",
  movedTotal: 0,
  jumped: 0,
  notesPlayed: 0,
  flips: 0,
  guideStep: 0,
  guideDone: false,
  // v3 state
  weapon: null, // null = bare strike; "lance" = the Star Lance
  charms: { swift: false, ward: false, bright: false },
  wardCharge: 0, // the Ward Charm's one turned blow
  firstJumpDone: false, // invulnerable until the first jump lands (feedback #4)
  wispKills: 0,
  gestureUsed: false,
  introKind: null,
  introUntil: 0,
  swingT: 1, // swing-arc animation clock (1 = idle)
  lastGuideBeat: null,
  introduced: new Set(JSON.parse((() => {
    try { return localStorage.getItem("nova-phox-introduced") || "[]"; }
    catch (e) { return "[]"; }
  })())),
  bobPhase: 0,
  dead: false,
  // v5 state
  brush: 0, // index into BRUSHES (world.js) — the chisel's size (feedback #4)
  scheme: "WASD", // control scheme (feedback #5); the other is AWEF
  lamp: false, // the fox's own light (feedback #12)
  flute: null, // a shift-drag in progress (feedback #6)
  splash: true, // the logo panel is up (feedback #15)
  extras: false, // optional UI components shown (2026-11-26); off by default
  introOpen: false, // the Arrival screen's film is showing (feedback #14)
  exploreMoved0: 0, // movedTotal when the guide handed the game over
  jitShown: new Set(), // just-in-time guide steps already surfaced (#19)
};

// Spawn: Nova Prime, on the surface of the arrival column.
state.pos.set(ARRIVAL.nova.x + 0.5, heightAt("nova", ARRIVAL.nova.x, ARRIVAL.nova.z) + 1.01, ARRIVAL.nova.z + 0.5);
ensureNeighborhood(state.realm, 0, 0);
// The training wisp (feedback #2): a pale, harmless thing set in the
// spawn meadow for learning the strike on. It never hunts, never hurts.
state.wispId = sub.spawnMonster("nova", 9, 6, "wisp").id;

function playerScroll() {
  return {
    sx: scrollOfBlock(Math.floor(state.pos.x)),
    sy: scrollOfBlock(Math.floor(state.pos.z)),
  };
}
function ensureNeighborhood(realmId, sx, sy) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) sub.getScroll(realmId, sx + dx, sy + dy, true);
}

// ---------- small helpers ----------------------------------------------

const $ = (id) => document.getElementById(id);
function toast(text, ms = 6500) {
  const el = $("comms");
  el.textContent = text;
  el.style.opacity = "1";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.opacity = "0"; }, ms);
}
function realmName(id) {
  return realmById(id).name;
}

// ---------- audio (all synthesized; the world speaks) --------------------

const NOTE_SCALE = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17]; // semitones
const sfx = {
  ctx: null, master: null, windGain: null, stepAlt: false, muted: false,
  heldSuspend: false, // the unwatched-tab hold froze the clock (2026-11-26)
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      // Ambient wind: looped noise through a low filter, barely there.
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        d[i] = last * 3.2;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass"; filt.frequency.value = 420;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.05;
      src.connect(filt).connect(this.windGain).connect(this.master);
      src.start();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.07; lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain).connect(this.windGain.gain);
      lfo.start();
    } catch (e) {
      this.ctx = null; // audio failed; the game goes on
    }
  },
  env(gain, t, peak, decay) {
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  },
  tone(freq, { type = "triangle", peak = 0.3, decay = 0.6, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + decay);
    this.env(g, t, peak, decay);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + decay + 0.05);
  },
  noise({ peak = 0.2, decay = 0.15, freq = 800, type = "bandpass", delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, (decay + 0.05) * this.ctx.sampleRate);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = peak;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  },
  pluck(noteIdx) {
    // The instrument: a plucked string, bright attack, long ring.
    const f = 196 * Math.pow(2, NOTE_SCALE[noteIdx] / 12);
    this.tone(f, { type: "triangle", peak: 0.5, decay: 0.9 });
    this.tone(f * 2, { type: "sine", peak: 0.18, decay: 0.45 });
  },
  step() {
    this.stepAlt = !this.stepAlt;
    this.noise({ peak: 0.10, decay: 0.07, freq: this.stepAlt ? 500 : 380 });
  },
  jump() { this.tone(300, { type: "sine", peak: 0.15, decay: 0.18, slide: 160 }); },
  land() { this.noise({ peak: 0.16, decay: 0.1, freq: 220, type: "lowpass" }); },
  hurt() {
    this.tone(140, { type: "sawtooth", peak: 0.3, decay: 0.25, slide: -60 });
    this.noise({ peak: 0.22, decay: 0.18, freq: 300, type: "lowpass" });
  },
  strikeHit() { this.noise({ peak: 0.3, decay: 0.12, freq: 1400 }); },
  strikeKill() {
    this.tone(520, { type: "square", peak: 0.22, decay: 0.5, slide: -380 });
    this.noise({ peak: 0.2, decay: 0.3, freq: 700 });
  },
  flip() {
    this.tone(180, { type: "sine", peak: 0.25, decay: 0.5, slide: 240 });
    this.tone(270, { type: "sine", peak: 0.15, decay: 0.5, slide: 360, delay: 0.06 });
  },
  portal() {
    [0, 4, 7, 11].forEach((st, i) =>
      this.tone(220 * Math.pow(2, st / 12), { peak: 0.22, decay: 0.8, delay: i * 0.07 }));
    this.noise({ peak: 0.12, decay: 0.7, freq: 1200, type: "highpass" });
  },
  chime() {
    [0, 4, 7, 12].forEach((st, i) =>
      this.tone(523 * Math.pow(2, st / 12), { type: "sine", peak: 0.25, decay: 0.9, delay: i * 0.09 }));
  },
  // v5 (feedback #13): little chip tunes — square-wave melodies on
  // the instrument's own eleven notes, for the moments that earn
  // one (a pickup's two-note lift, the day's tune played back as a
  // melody when its page is claimed, the quest's fanfare). Music
  // only: the old no-sound-effects note stands for everything else.
  stats: { melodies: 0, contactNoises: 0 },
  melody(notes, { gap = 150 } = {}) {
    if (!this.ctx || this.muted) return;
    this.stats.melodies++;
    notes.forEach((n, i) => {
      const f = 196 * Math.pow(2, NOTE_SCALE[(n - 1) % 11] / 12);
      this.tone(f, { type: "square", peak: 0.15, decay: 0.32, delay: (i * gap) / 1000 });
      this.tone(f * 2, { type: "square", peak: 0.05, decay: 0.18, delay: (i * gap) / 1000 });
    });
  },
  // v5 (feedback #24): the contact cue that replaced the retired
  // spoken line — a short, low burst of noise when a hit lands.
  // Not a voice, not a word: just the sound of being reached.
  contactNoise() {
    if (!this.ctx || this.muted) return;
    this.stats.contactNoises++;
    this.noise({ peak: 0.34, decay: 0.22, freq: 240, type: "lowpass" });
    this.noise({ peak: 0.16, decay: 0.1, freq: 900 });
  },
};

// ---------- narration audio (feedback #3) ---------------------------------
// Emise's recorded voice, one MP3 per beat ID from NARRATION.md,
// embedded in the build (NARRATION_AUDIO: beat ID -> data URI) by
// build3.py from ~/workspace/nova-fox/narration-audio/. The guide's
// steps and the world's events speak by beat ID; the text panel
// always rides along, so a beat that cannot play loses nothing.
//
// THREE mechanisms decide whether a beat is ever heard; each was
// broken in turn, and each fix is load-bearing:
//  1. THE SHADOW (fixed EE 177). build3.py concatenates the vendored
//     three.js into this same module scope, and three declares a
//     top-level `class Audio` (THREE.Audio). A bare `new Audio(...)`
//     here built a THREE.Audio around the data URI — its constructor
//     dereferences listener.context and throws — and the catch below
//     swallowed it. No HTMLAudioElement was ever created; no beat
//     ever played. The element is constructed as
//     `new window.Audio(...)`, which the shadow cannot reach. (The
//     sfx engine survived the same build because it always said
//     window.AudioContext.)
//  2. THE LOCK (fixed EE 177). The opening beats fire at boot,
//     before any user gesture, and browsers refuse audible playback
//     then. A refused beat used to be spent silently. Now beats
//     attempted while locked QUEUE, and the first real gesture
//     (pointerdown / keydown, capture phase) unlocks the voice.
//  3. THE CHOP (fixed EE 178; Will, 2026-11-22: "audio is glitchy —
//     it doesn't play properly — I did hear it though"). EE 177's
//     rule was "a live beat interrupts whatever is speaking", and a
//     scripted CDP probe under the default autoplay policy showed
//     what that costs in real play: the wake beat was paused at
//     currentTime 0 by the next beat fired from the SAME click that
//     unlocked it (0.00 s of 15.84 s heard); N-02 got 1.58 s of
//     14.02 s before the next click chopped it; the flip and border
//     beats fired by a single G press annihilated each other at
//     ct=0; the queued arrival beat was silently discarded. The
//     voice is now a QUEUE, not a preemption: beats speak one at a
//     time, in trigger order, each heard through to its end, with a
//     short breath between them. A trigger for the beat already
//     speaking or already waiting is a duplicate and is dropped.
//     Event beats (BEAT-*) comment on a moment: one that has waited
//     longer than EVENT_MAX_AGE_MS behind the guide's spine is
//     stale when reached and is let go — except the durable place
//     announcements (EVENT_KEEP), which stay true. Guide beats
//     (N-*) are the spine and never expire. Nothing interrupts the
//     voice except stop() (mute, or the player dismissing the
//     guide to explore on their own).
const narration = {
  cache: new Map(),
  unlocked: false, // a real user gesture has been seen
  held: false,     // the tab is unwatched: the voice holds (2026-11-26)
  queue: [],       // [{id, at, event}] waiting to speak, trigger order
  speaking: null,  // the element currently talking
  speakingId: null,
  speakingEntry: null, // the queue entry the speaking element came from
  gapTimer: 0,     // the breath between beats, while scheduled
  endedIds: [],    // beats heard through to their end, in order
  BREATH_MS: 240,
  EVENT_MAX_AGE_MS: 10000,
  EVENT_KEEP: new Set([ // durable announcements; never stale
    "BEAT-cross-ashfall", "BEAT-cross-nova", "BEAT-pocket",
    "BEAT-barrow", "BEAT-quest",
  ]),
  ready(id) {
    return typeof NARRATION_AUDIO !== "undefined" && !!NARRATION_AUDIO[id];
  },
  element(id) {
    let a = this.cache.get(id);
    if (!a) {
      a = new window.Audio(NARRATION_AUDIO[id]); // NOT bare Audio — see above
      a.preload = "auto";
      a.addEventListener("ended", () => this.onEnded(a));
      a.addEventListener("error", () => this.onEnded(a));
      this.cache.set(id, a);
    }
    return a;
  },
  play(id) {
    if (!this.ready(id) || sfx.muted) return false;
    if (id === this.speakingId) return false;               // already saying it
    if (this.queue.some((q) => q.id === id)) return false;  // already waiting
    this.queue.push({
      id, at: performance.now(), event: id.startsWith("BEAT-"),
    });
    if (!this.unlocked || this.held) return false; // queued, not spent — the gesture (or the return) speaks it
    this.pump();
    return true;
  },
  pump() {
    if (!this.unlocked || this.held || this.speaking || this.gapTimer) return;
    const now = performance.now();
    this.queue = this.queue.filter((q) =>
      !q.event || this.EVENT_KEEP.has(q.id) ||
      now - q.at <= this.EVENT_MAX_AGE_MS);
    const next = this.queue.shift();
    if (next) this.speak(next);
  },
  speak(entry) {
    try {
      const a = this.element(entry.id);
      this.speaking = a;
      this.speakingId = entry.id;
      this.speakingEntry = entry;
      a.currentTime = 0;
      const pr = a.play();
      if (pr && typeof pr.catch === "function") {
        pr.catch((err) => {
          if (this.speaking !== a) return; // stop() or a newer state owns it
          this.speaking = null;
          this.speakingId = null;
          this.speakingEntry = null;
          if (err && err.name === "NotAllowedError") {
            // Refused after all (autoplay policy): re-lock and put
            // the beat back at the head of the queue — the next
            // gesture retries it.
            this.unlocked = false;
            this.queue.unshift(entry);
          } else {
            this.breath(); // a lost beat never wedges the voice
          }
        });
      }
      return true;
    } catch (e) {
      this.speaking = null;
      this.speakingId = null;
      this.speakingEntry = null;
      return false; // audio is a grace, never a gate
    }
  },
  onEnded(a) {
    if (this.speaking !== a) return;
    const id = this.speakingId;
    this.speaking = null;
    this.speakingId = null;
    this.speakingEntry = null;
    if (id) {
      this.endedIds.push(id);
      if (this.endedIds.length > 64) this.endedIds.shift();
    }
    this.breath();
  },
  breath() {
    if (this.gapTimer) return;
    this.gapTimer = setTimeout(() => {
      this.gapTimer = 0;
      this.pump();
    }, this.BREATH_MS);
  },
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    // Warm every element now, so a beat's first play is not also its
    // first decode (the probe saw metadata land 200-580 ms after
    // play() on first use — a stall at the head of every new beat).
    if (typeof NARRATION_AUDIO !== "undefined") {
      for (const id of Object.keys(NARRATION_AUDIO)) {
        try { this.element(id); } catch (e) { /* a cold beat still plays late */ }
      }
    }
    this.pump();
  },
  stop() {
    this.queue.length = 0;
    if (this.gapTimer) { clearTimeout(this.gapTimer); this.gapTimer = 0; }
    this.speaking = null;
    this.speakingId = null;
    this.speakingEntry = null;
    for (const a of this.cache.values()) {
      try { a.pause(); } catch (e) { /* already still */ }
    }
  },
  // The unwatched tab (2026-11-26; Will: "audio should stop when
  // the tab isn't active"). The voice does not freeze mid-line and
  // does not talk to an empty room: the interrupted beat goes back
  // to the head of the queue WHOLE — the same rule the queue
  // already keeps for a beat the browser refuses (see THE LOCK,
  // above) — and speaks from its start when the fox returns. Its
  // original trigger time rides along, so an event beat that went
  // stale while the tab was dark is still let go by pump()'s age
  // filter; the guide's spine never expires, as ever. Beats
  // triggered while held simply queue, like beats before the
  // first gesture.
  hold() {
    if (this.held) return;
    this.held = true;
    if (this.gapTimer) { clearTimeout(this.gapTimer); this.gapTimer = 0; }
    if (this.speaking) {
      const a = this.speaking, entry = this.speakingEntry;
      this.speaking = null;
      this.speakingId = null;
      this.speakingEntry = null;
      try { a.pause(); a.currentTime = 0; } catch (e) { /* already still */ }
      if (entry) this.queue.unshift(entry);
    }
  },
  release() {
    if (!this.held) return;
    this.held = false;
    this.pump();
  },
  debugState() {
    return {
      unlocked: this.unlocked,
      held: this.held,
      pending: this.queue.map((q) => q.id),
      speaking: this.speakingId,
      paused: this.speaking ? this.speaking.paused : true,
      currentTime: this.speaking ? this.speaking.currentTime : 0,
      ended: [...this.endedIds],
    };
  },
};
function playBeat(id) {
  return narration.play(id);
}
// The first real gesture unlocks the voice. Capture phase, so the
// queue starts speaking ahead of the gesture's own handlers; a beat
// the gesture itself triggers (the guide button advancing) simply
// takes its place in line behind whatever is speaking.
for (const ev of ["pointerdown", "keydown"]) {
  window.addEventListener(ev, () => narration.unlock(), true);
}
// ---------- the unwatched tab (2026-11-26) ---------------------------------
// Will: "audio should stop when the tab isn't active." Every sound
// the game makes stops while the tab is hidden — stopped, not
// muted-while-playing: the voice holds (narration.hold, above),
// the synthesized engine's clock freezes (ctx.suspend halts the
// wind loop, the LFO and every scheduled tone where it stands),
// and the Arrival film pauses. On return the engine resumes and
// the voice takes its interrupted line from the top; the film
// resumes only if this hold was what paused it — a film the
// player paused themselves stays paused.
let filmHeldPause = false;
function audioHold() {
  narration.hold();
  if (sfx.ctx && sfx.ctx.state === "running") {
    sfx.heldSuspend = true;
    sfx.ctx.suspend();
  }
  const v = $("intro-video");
  if (v && !v.paused && !v.ended) { filmHeldPause = true; v.pause(); }
}
function audioRelease() {
  narration.release();
  if (sfx.heldSuspend) {
    sfx.heldSuspend = false;
    if (sfx.ctx && sfx.ctx.state === "suspended") sfx.ctx.resume();
  }
  if (filmHeldPause) {
    filmHeldPause = false;
    const v = $("intro-video");
    if (v && $("intro-viewer").style.display === "block") {
      const pr = v.play();
      if (pr && typeof pr.catch === "function") pr.catch(() => {});
    }
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) audioHold(); else audioRelease();
});
window.addEventListener("pagehide", audioHold);
window.addEventListener("pageshow", () => { if (!document.hidden) audioRelease(); });
// Guide step -> the recorded beat that speaks it (NARRATION.md IDs).
// The v3-only steps (fight, gesture) have no recorded beat yet: they
// are text-only for now, and PLAN.md says so.
const GUIDE_BEATS = {
  wake: "N-01", rifts: "N-02", move: "N-03", numbers: "N-04",
  bridge: "N-05", ashfall: "N-06", gravity: "N-07", quest: "N-08",
  done: "N-09", fight: null, gesture: null, handover: null, mark: null,
};

// ---------- persistence helpers --------------------------------------------
const LS = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : JSON.parse(v);
    } catch (e) { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ }
  },
};
const playerName = LS.get("nova-phox-name", null) || (() => {
  const n = "fox-" + Math.floor(1000 + Math.random() * 9000);
  LS.set("nova-phox-name", n);
  return n;
})();

// ---------- the economy: entitlement + ledgers (demo4, W2/W3) ----------------
// The state itself lives in economy.js (pure logic, unit-tested);
// this glue owns its persistence, its network, and its panel. The
// ledgers ride in the local save (and in save copies, v3) exactly
// like the standings do.
const eco = loadEconomyState(LS.get("nova-phox-economy", null));
function persistEco() { LS.set("nova-phox-economy", eco); }
// Economy lines bound for the shared chart queue here — the same
// discipline as the marks outbox: written locally the moment they
// happen, flushed under the gateway's rate budget with a login
// token, and never presented as landed until the chart answers.
const ecoOutbox = LS.get("nova-phox-eco-outbox", []);
function persistEcoOutbox() { LS.set("nova-phox-eco-outbox", ecoOutbox); }
function queueEcoLine(coord, line) {
  ecoOutbox.push({ coord, line });
  persistEcoOutbox();
}
function ecoNote(msg) {
  const el = document.getElementById("eco-note");
  if (el) el.textContent = msg;
}
// Idea lines bound for the shared chart queue here — a dedicated
// outbox with the eco outbox's exact discipline (EE 953 design):
// persisted locally the moment a telling is made, flushed inside
// backendFlush() under the shared insert budget with a login
// token, oldest first, honest stop at the first refusal, and
// never shown as told until the chart reads it back.
const ideaOutbox = LS.get("nova-phox-idea-outbox", []);
function persistIdeaOutbox() { LS.set("nova-phox-idea-outbox", ideaOutbox); }
function queueIdeaLine(line) {
  ideaOutbox.push({ coord: BACKEND.ideaCoord, line });
  persistIdeaOutbox();
}
// Random bytes for gift keys: the browser's crypto, nothing else.
function ecoRandomByte() {
  const a = new Uint8Array(1);
  crypto.getRandomValues(a);
  return a[0];
}
// On becoming a generator (either issuer, one door): the purchase
// claim joins the queue — the written record numbers it by arrival
// when the chart reads it back.
function onBecameGenerator() {
  persistEco();
  if (!eco.entitlement.claimPosted) {
    queueEcoLine(BACKEND.purchaseCoord,
      purchaseClaimLine(playerName, eco.entitlement.source, Date.now()));
  }
  syncHud();
  renderBoard();
}

// Control prefs (v5, feedback #5): the chosen key scheme and the
// chisel's brush size persist on this machine.
{
  const ctl = LS.get("nova-phox-controls", null);
  if (ctl) {
    if (ctl.scheme === "AWEF" || ctl.scheme === "WASD") state.scheme = ctl.scheme;
    if (Number.isInteger(ctl.brush)) {
      state.brush = Math.min(BRUSHES.length - 1, Math.max(0, ctl.brush));
    }
    if (typeof ctl.extras === "boolean") state.extras = ctl.extras;
  }
}
document.body.classList.toggle("extras", state.extras);
function saveCtlPrefs() {
  LS.set("nova-phox-controls", {
    scheme: state.scheme, brush: state.brush, extras: state.extras,
  });
}

// ---------- the shared chart: phext.tech backend ----------------------------
// World state — the inscription log, player marks, scores — belongs
// on the shared chart phext hosted at phext.tech (Will's ruling,
// 2026-11-22). The client speaks the SQ REST pattern this estate
// runs (/api/v2: select reads a scroll, insert appends to one).
// The backend is the nova-phox gateway stack on awsbox (gateway +
// dedicated SQ host holding nova-phox-world, wired into phext.tech
// since 2026-11-23; verified live EE 948 — see BACKEND-FIX-REPORT.md:
// /api/v2/version, /health, select and token-gated insert all answer
// on the public route). An earlier 404 verification (2026-11-22,
// before that wiring) is superseded. The client still probes at
// runtime and never assumes: when a probe fails, the game runs from
// its local chart, queues every inscription in the outbox, labels
// the state plainly in the HUD, and flushes on the first probe that
// answers. Nothing is ever presented as synced that was not
// actually answered.
const BACKEND = {
  base: "https://phext.tech",
  phext: "nova-phox-world",
  logCoord: "1.1.1/1.1.1/1.1.1", // the shared inscription log scroll
  boardCoord: "1.1.1/1.1.2/1.1.1", // the shared leaderboard scroll
  purchaseCoord: "1.1.1/1.1.3/1.1.1", // the written record: purchase claims, in order (D1)
  ecoCoord: "1.1.1/1.1.4/1.1.1", // the economy ledger: gift issues/redeems, hand-downs (D12)
  formCoord: "1.1.1/1.1.5/1.1.1", // the forms scroll: the shapes foxes wear (demo6)
  ideaCoord: "1.1.1/1.1.6/1.1.1", // the ideas scroll: tellings at the door (demo8)
  online: false,
  probed: false,
  boardRows: [], // rows actually read back from the shared chart
  purchaseRows: [], // purchase claims actually read back, numbered by arrival
  ecoLedger: null, // parsed economy ledger actually read back (null = not yet)
  formRows: null, // forms actually read back, by fox name (null = not yet)
  ideaRows: [], // ideas actually read back, resolved to their current state
  lastPostedScore: LS.get("nova-phox-posted", -1),
};
// ---------- login, for saving (Will, 2026-11-22 18:05) ----------------------
// Saving to the shared chart requires a phext.tech login — or a
// local copy (the save doors are in the board panel). The login is
// phext.tech's own: the game sends the player, top-level, to
// /api/game-login on phext.tech; the platform's gateway there asks
// phext-edit's /api/session who is signed in and, if somebody is,
// returns here with a signed, game-scoped token in the URL
// fragment. We keep the token in localStorage and present it as a
// Bearer token on inserts only. Reads stay public, exactly as the
// platform's own pages are public. No account is created here.
function takeLoginToken() {
  try {
    const m = /np_token=([A-Za-z0-9._-]+)/.exec(location.hash || "");
    if (m) {
      LS.set("nova-phox-token", m[1]);
      history.replaceState(null, "", location.pathname + location.search);
    }
  } catch (e) { /* odd contexts (file://): no intake, no harm */ }
}
takeLoginToken();
window.addEventListener("hashchange", takeLoginToken);
function gameToken() { return LS.get("nova-phox-token", null); }
function loginUrl() {
  return `${BACKEND.base}/api/game-login?back=${encodeURIComponent("https://fox.phext.io/")}`;
}

const outbox = LS.get("nova-phox-outbox", []);
// Every inscription the world makes joins the outbox the moment it
// is written locally. Append-only on both ends, so simultaneous
// inscriptions from two foxes commute — order on the shared scroll
// is arrival order, and no mark can overwrite another.
//
// v5 (UPDATE-CHECK-1): the queue used to silently DISCARD past 500
// — marks were lost while the board said "queued, not lost". Now:
// the live queue keeps 4,000; overflow FOLDS into a second store on
// this machine (which the local save copy also carries), and the
// flush promotes the fold back as the queue drains. Only if the
// fold itself overflows a generous bound is anything let go — and
// then it is counted, in the open, where the player can read it.
const OUTBOX_KEEP = 4000, FOLD_KEEP = 20000;
let outboxFolded = LS.get("nova-phox-outbox-folded", []);
let outboxDropped = LS.get("nova-phox-outbox-dropped", 0);
function persistOutbox() {
  LS.set("nova-phox-outbox", outbox);
  LS.set("nova-phox-outbox-folded", outboxFolded);
  LS.set("nova-phox-outbox-dropped", outboxDropped);
}
function foldOverflow() {
  if (outbox.length > OUTBOX_KEEP) {
    outboxFolded.push(...outbox.splice(0, outbox.length - OUTBOX_KEEP));
  }
  if (outboxFolded.length > FOLD_KEEP) {
    outboxDropped += outboxFolded.length - FOLD_KEEP;
    outboxFolded.splice(0, outboxFolded.length - FOLD_KEEP);
  }
}
function marksWaiting() { return outbox.length + outboxFolded.length; }
function marksNote() {
  // The honest sentence about the queue's edges (board + save).
  let s = "marks past the first 4,000 waiting fold into your local copy — kept, not lost";
  if (outboxDropped > 0) {
    s += `; ${outboxDropped} oldest mark${outboxDropped === 1 ? " was" : "s were"} let go when even the copy overflowed`;
  }
  return s;
}
{
  const origLog = sub.log.bind(sub);
  sub.log = (op, where, detail) => {
    origLog(op, where, detail);
    const seg = sub.wal[sub.wal.length - 1];
    outbox.push({ ...seg, by: playerName, ts: Date.now() });
    foldOverflow();
    persistOutbox();
    updateSyncLabel();
  };
}
// The gateway's rate limit is 120 inserts a minute (UPDATE-CHECK-1).
// The flush paces itself under it, and a 429 means "wait and keep
// draining", not "the line is dead".
const insertTimes = [];
function insertBudget() {
  const now = Date.now();
  while (insertTimes.length && insertTimes[0] < now - 60000) insertTimes.shift();
  return 115 - insertTimes.length; // a breath under the limit
}
let flushRetryAt = 0;
async function backendProbe() {
  try {
    const r = await fetch(`${BACKEND.base}/api/v2/version`, {
      method: "GET", signal: AbortSignal.timeout(4000),
    });
    BACKEND.online = !!r.ok;
  } catch (e) {
    BACKEND.online = false;
  }
  BACKEND.probed = true;
  updateSyncLabel();
  return BACKEND.online;
}
async function backendFlush() {
  if (!BACKEND.online) return;
  if (Date.now() < flushRetryAt) return; // a 429 asked us to wait; we wait
  // Writes require login (Will, 2026-11-22 18:05): without a game
  // token the queue stays on this machine and the board below is
  // read-only. A 401 means the token aged out — drop it and say so
  // via the label; the marks themselves stay queued.
  const token = gameToken();
  const writeHeaders = token ? { "Authorization": `Bearer ${token}` } : null;
  if (writeHeaders) {
    // The fold comes back first: when the live queue has drained,
    // promote the oldest folded marks into it (they were written
    // earlier; arrival order forgives the commute).
    if (!outbox.length && outboxFolded.length) {
      outbox.push(...outboxFolded.splice(0, 1000));
      persistOutbox();
    }
    // Flush queued inscriptions, oldest first, inside the gateway's
    // rate budget; stop at the first real refusal and stay honest
    // about what remains queued. A 429 is not a refusal — it sets
    // the retry clock and the 20-second cycle resumes the drain.
    while (outbox.length) {
      if (insertBudget() <= 0) break;
      const seg = outbox[0];
      try {
        const r = await fetch(
          `${BACKEND.base}/api/v2/insert?p=${BACKEND.phext}&c=${BACKEND.logCoord}`,
          { method: "POST", headers: writeHeaders,
            body: `#${seg.seq} ${seg.op} @ ${seg.where} — ${seg.detail} [${seg.by}]`,
            signal: AbortSignal.timeout(5000) });
        if (r.status === 401) { LS.set("nova-phox-token", null); break; }
        if (r.status === 429) { flushRetryAt = Date.now() + 25000; break; }
        if (!r.ok) { BACKEND.online = false; break; }
        insertTimes.push(Date.now());
      } catch (e) { BACKEND.online = false; break; }
      outbox.shift();
      persistOutbox();
    }
    // Post the standing when it has moved (it spends budget too).
    const score = totalScore(sub);
    if (BACKEND.online && gameToken() && score !== BACKEND.lastPostedScore && score > 0 && insertBudget() > 0) {
      const today = todayStr();
      const line = `${playerName}|${score}|${today}|${sub.dailyClaimed.has(today) ? 1 : 0}|${Date.now()}`;
      try {
        const r = await fetch(
          `${BACKEND.base}/api/v2/insert?p=${BACKEND.phext}&c=${BACKEND.boardCoord}`,
          { method: "POST", headers: writeHeaders, body: line, signal: AbortSignal.timeout(5000) });
        if (r.ok) {
          insertTimes.push(Date.now());
          BACKEND.lastPostedScore = score;
          LS.set("nova-phox-posted", score);
        }
      } catch (e) { /* stays unposted; the board will say so */ }
    }
  }
  // Read the shared board back — only rows actually read are shown.
  if (BACKEND.online) {
    try {
      const r = await fetch(
        `${BACKEND.base}/api/v2/select?p=${BACKEND.phext}&c=${BACKEND.boardCoord}`,
        { method: "GET", signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const text = await r.text();
        BACKEND.boardRows = text.split("\n").map((ln) => {
          const [name, sc, date, daily, ts] = ln.split("|");
          return name && Number.isFinite(+sc)
            ? { name, score: +sc, date, daily: daily === "1", ts: +ts }
            : null;
        }).filter(Boolean);
      }
    } catch (e) { /* board keeps its last honest state */ }
  }
  // Flush the economy queue under the same discipline: token,
  // budget, oldest first, honest stop at the first refusal.
  if (writeHeaders && BACKEND.online) {
    while (ecoOutbox.length) {
      if (insertBudget() <= 0) break;
      const seg = ecoOutbox[0];
      try {
        const r = await fetch(
          `${BACKEND.base}/api/v2/insert?p=${BACKEND.phext}&c=${seg.coord}`,
          { method: "POST", headers: writeHeaders, body: seg.line,
            signal: AbortSignal.timeout(5000) });
        if (r.status === 401) { LS.set("nova-phox-token", null); break; }
        if (r.status === 429) { flushRetryAt = Date.now() + 25000; break; }
        if (!r.ok) { BACKEND.online = false; break; }
        insertTimes.push(Date.now());
      } catch (e) { BACKEND.online = false; break; }
      ecoOutbox.shift();
      persistEcoOutbox();
    }
  }
  // Flush the idea queue under the same discipline again: token,
  // budget, oldest first, honest stop at the first refusal. One
  // queued telling is exactly one insert.
  if (writeHeaders && BACKEND.online) {
    while (ideaOutbox.length) {
      if (insertBudget() <= 0) break;
      const seg = ideaOutbox[0];
      try {
        const r = await fetch(
          `${BACKEND.base}/api/v2/insert?p=${BACKEND.phext}&c=${seg.coord}`,
          { method: "POST", headers: writeHeaders, body: seg.line,
            signal: AbortSignal.timeout(5000) });
        if (r.status === 401) { LS.set("nova-phox-token", null); break; }
        if (r.status === 429) { flushRetryAt = Date.now() + 25000; break; }
        if (!r.ok) { BACKEND.online = false; break; }
        insertTimes.push(Date.now());
      } catch (e) { BACKEND.online = false; break; }
      ideaOutbox.shift();
      persistIdeaOutbox();
    }
  }
  // Read the written record and the economy ledger back — only
  // what is actually read is ever shown or acted on.
  if (BACKEND.online) {
    try {
      const r = await fetch(
        `${BACKEND.base}/api/v2/select?p=${BACKEND.phext}&c=${BACKEND.purchaseCoord}`,
        { method: "GET", signal: AbortSignal.timeout(5000) });
      if (r.ok) BACKEND.purchaseRows = parsePurchaseBoard(await r.text());
    } catch (e) { /* the record keeps its last honest state */ }
    try {
      const r = await fetch(
        `${BACKEND.base}/api/v2/select?p=${BACKEND.phext}&c=${BACKEND.ecoCoord}`,
        { method: "GET", signal: AbortSignal.timeout(5000) });
      if (r.ok) BACKEND.ecoLedger = parseEcoLedger(await r.text());
    } catch (e) { /* same */ }
    try {
      const r = await fetch(
        `${BACKEND.base}/api/v2/select?p=${BACKEND.phext}&c=${BACKEND.formCoord}`,
        { method: "GET", signal: AbortSignal.timeout(5000) });
      if (r.ok) BACKEND.formRows = parseFormChart(await r.text());
    } catch (e) { /* the forms keep their last honest state */ }
    try {
      const r = await fetch(
        `${BACKEND.base}/api/v2/select?p=${BACKEND.phext}&c=${BACKEND.ideaCoord}`,
        { method: "GET", signal: AbortSignal.timeout(5000) });
      if (r.ok) BACKEND.ideaRows = parseIdeas(await r.text());
    } catch (e) { /* the tellings keep their last honest state */ }
    if (BACKEND.ecoLedger) {
      // Hand-downs addressed to this fox land exactly once.
      const got = applyHanddowns(eco, BACKEND.ecoLedger, playerName);
      if (got > 0) {
        persistEco();
        ecoNote(`a friend handed you ${got} credit${got === 1 ? "" : "s"} — they're in your purse.`);
      }
      // A gift key entered offline is tried against the first
      // ledger that answers.
      if (eco.pendingGiftKey && !isGenerator(eco)) {
        const res = redeemGiftKey(eco, eco.pendingGiftKey, BACKEND.ecoLedger);
        if (res.ok) {
          queueEcoLine(BACKEND.ecoCoord, giftRedeemedLine(res.hash, playerName, Date.now()));
          applyGiftRedemption(eco, eco.pendingGiftKey, Date.now());
          onBecameGenerator();
          ecoNote("the gift key is good — you are a generator now. Welcome to the written record.");
        } else if (res.reason === "spent" || res.reason === "unknown" || res.reason === "format") {
          eco.pendingGiftKey = null;
          persistEco();
          ecoNote("the shared map has answered, and that gift key is not good — it was already spent, or never issued.");
        }
      }
    }
    // The purchase number is the claim's place in the record as
    // read back — never a number the client picks for itself.
    if (isGenerator(eco)) {
      const n = purchaseNumberFor(BACKEND.purchaseRows, playerName);
      if (n !== null) {
        if (eco.entitlement.purchaseNumber !== n || !eco.entitlement.claimPosted) {
          eco.entitlement.purchaseNumber = n;
          eco.entitlement.claimPosted = true;
          persistEco();
        }
      } else if (!eco.entitlement.claimPosted &&
                 !ecoOutbox.some((s) => s.coord === BACKEND.purchaseCoord)) {
        // Entitled but no claim queued or landed (e.g. a save copy
        // carried the entitlement without its queue): claim again.
        queueEcoLine(BACKEND.purchaseCoord,
          purchaseClaimLine(playerName, eco.entitlement.source, Date.now()));
      }
    }
  }
  updateSyncLabel();
  renderBoard();
  renderIdeas();
}
function updateSyncLabel() {
  const el = document.getElementById("syncline");
  if (!el) return;
  const waiting = marksWaiting();
  const queued = `${waiting} mark${waiting === 1 ? "" : "s"} waiting`;
  if (!BACKEND.online) {
    el.textContent = `can't reach the shared map — you're playing on your own · ${queued} on this machine`;
  } else if (gameToken()) {
    el.textContent = waiting
      ? `signed in — your marks are saving to the shared map · ${queued}`
      : "signed in — your marks save to the shared map as you make them";
  } else {
    el.textContent = `sign in to save your marks to the shared map · ${queued} on this machine`;
  }
  renderSaveState();
}
function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
// Local standings: your own best and your daily results, kept on
// this machine and mirrored into the inscription physics above.
const standings = LS.get("nova-phox-standings", { best: 0, daily: {} });
function recordStandings() {
  const score = totalScore(sub);
  if (score > standings.best) standings.best = score;
  const today = todayStr();
  if (sub.dailyClaimed.has(today)) {
    standings.daily[today] = { claimed: true, score };
  }
  LS.set("nova-phox-standings", standings);
}

// ---------- textures: a small hand-drawn atlas ----------------------------

const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, WOOD_SIDE: 4, WOOD_TOP: 5,
  LEAF: 6, ASH_TOP: 7, ASH_SIDE: 8, REDROCK: 9, BASALT: 10, EMBER: 11,
  BRICK: 12, DEEPSTONE: 13, SCAR: 14, CRYSTAL: 15, VAULT: 16, BEDROCK: 17,
  MOSS: 18, SHALE: 19, // v5 (feedback #10)
};
const ATLAS_COLS = 6, ATLAS_ROWS = 4, TILE_PX = 32;
let atlasTexture = null;
let atlasCanvas = null; // the base atlas canvas, kept for variants
const atlasVariants = new Map(); // realmId -> THREE.Texture

// Per-realm atlas (feedback #27): the base atlas is drawn once in
// the blue register; each realm's palette re-skins it with a canvas
// hue-rotate / saturate, so every block tile — grass, stone, wood,
// ember — wears the realm's hue while keeping its drawn structure.
// Cached per realm; home (hue 0, sat 1) IS the base texture.
function atlasForRealm(realmId) {
  if (atlasVariants.has(realmId)) return atlasVariants.get(realmId);
  const pal = paletteFor(realmId);
  let tex = atlasTexture;
  if ((pal.hue || pal.sat !== 1) && atlasCanvas) {
    const cv = document.createElement("canvas");
    cv.width = atlasCanvas.width;
    cv.height = atlasCanvas.height;
    const g = cv.getContext("2d");
    g.filter = `hue-rotate(${pal.hue}deg) saturate(${pal.sat})`;
    g.drawImage(atlasCanvas, 0, 0);
    tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  atlasVariants.set(realmId, tex);
  return tex;
}

function makeAtlas() {
  // SPACE LEGO (feedback #7): the register is bricks now — clean
  // plastic colors, a molded rim on every tile so each block reads
  // as its own brick, and studs on the top faces. Same atlas slots,
  // same machinery underneath; the visual language is what changed.
  const cv = document.createElement("canvas");
  cv.width = ATLAS_COLS * TILE_PX;
  cv.height = ATLAS_ROWS * TILE_PX;
  const g = cv.getContext("2d");
  let rngState = 987654;
  const rnd = () => {
    rngState = (Math.imul(rngState, 1103515245) + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };
  const tile = (idx, base, flecks, n = 26, size = 3) => {
    const ox = (idx % ATLAS_COLS) * TILE_PX, oy = Math.floor(idx / ATLAS_COLS) * TILE_PX;
    // Plastic sheen: a soft vertical gradient, then sparse flecks.
    const grad = g.createLinearGradient(ox, oy, ox, oy + TILE_PX);
    grad.addColorStop(0, base);
    grad.addColorStop(1, base);
    g.fillStyle = grad; g.fillRect(ox, oy, TILE_PX, TILE_PX);
    g.fillStyle = "rgba(255,255,255,0.10)";
    g.fillRect(ox, oy, TILE_PX, 5);
    for (let i = 0; i < n; i++) {
      g.fillStyle = flecks[Math.floor(rnd() * flecks.length)];
      g.fillRect(ox + Math.floor(rnd() * (TILE_PX - size)), oy + Math.floor(rnd() * (TILE_PX - size)),
        1 + Math.floor(rnd() * size), 1 + Math.floor(rnd() * size));
    }
    // The molded rim: every brick edge catches its own line.
    g.strokeStyle = "rgba(0,0,0,0.34)"; g.lineWidth = 2;
    g.strokeRect(ox + 1, oy + 1, TILE_PX - 2, TILE_PX - 2);
    g.strokeStyle = "rgba(255,255,255,0.20)"; g.lineWidth = 1;
    g.strokeRect(ox + 3, oy + 3, TILE_PX - 6, TILE_PX - 6);
    return [ox, oy];
  };
  const studs = (ox, oy, hi, lo) => {
    for (const [cx, cy] of [[8, 8], [24, 8], [8, 24], [24, 24]]) {
      g.fillStyle = lo;
      g.beginPath(); g.arc(ox + cx, oy + cy + 1.5, 5, 0, 7); g.fill();
      g.fillStyle = hi;
      g.beginPath(); g.arc(ox + cx, oy + cy, 5, 0, 7); g.fill();
      g.fillStyle = "rgba(255,255,255,0.5)";
      g.beginPath(); g.arc(ox + cx - 1.6, oy + cy - 1.6, 1.8, 0, 7); g.fill();
    }
  };
  {
    const [ox, oy] = tile(TILE.GRASS_TOP, "#0e4d8f", ["#1565c0", "#1e88e5", "#00b0ff"]);
    studs(ox, oy, "#35c4ff", "#083a6e");
  }
  {
    const [ox, oy] = tile(TILE.GRASS_SIDE, "#0b3f78", ["#083058", "#1565c0"]);
    g.fillStyle = "#1e88e5"; g.fillRect(ox + 2, oy + 2, TILE_PX - 4, 7);
  }
  tile(TILE.DIRT, "#0a2a4a", ["#123f66", "#071f38", "#1a527a"]);
  tile(TILE.STONE, "#5f748c", ["#4d6076", "#71869e", "#42536a"]);
  {
    const [ox, oy] = tile(TILE.WOOD_SIDE, "#14406e", ["#0f3358", "#1a4f86"]);
    g.fillStyle = "rgba(0,0,0,0.25)";
    for (let x = 7; x < TILE_PX; x += 9) g.fillRect(ox + x, oy + 2, 2, TILE_PX - 4);
  }
  {
    const [ox, oy] = tile(TILE.WOOD_TOP, "#1a4f86", ["#14406e", "#2273c4"]);
    studs(ox, oy, "#2f8fe8", "#0f3358");
  }
  tile(TILE.LEAF, "#04506e", ["#03405a", "#0a6d94", "#023047"], 60, 4);
  {
    const [ox, oy] = tile(TILE.ASH_TOP, "#cfe6f5", ["#b9d6ea", "#e6f4fd"]);
    studs(ox, oy, "#f2faff", "#9dbfd8");
  }
  tile(TILE.ASH_SIDE, "#a9c6dc", ["#93b2ca", "#bcd4e6"]);
  tile(TILE.REDROCK, "#3b2f7a", ["#2f2563", "#4a3d94", "#241d52"]);
  tile(TILE.BASALT, "#1c2531", ["#141b24", "#28323f", "#0e141c"]);
  {
    const [ox, oy] = tile(TILE.EMBER, "#0a0f1a", ["#111a2a", "#05080f"]);
    g.strokeStyle = "#00d9ff"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(ox + 2, oy + 22); g.lineTo(ox + 12, oy + 14);
    g.lineTo(ox + 20, oy + 20); g.lineTo(ox + 30, oy + 10); g.stroke();
    g.strokeStyle = "#7fefff";
    g.beginPath(); g.moveTo(ox + 6, oy + 28); g.lineTo(ox + 16, oy + 24); g.stroke();
  }
  {
    const [ox, oy] = tile(TILE.BRICK, "#46586e", ["#3a4a5f", "#54687f"]);
    g.fillStyle = "rgba(0,0,0,0.35)";
    for (let y = 0; y < TILE_PX; y += 8) g.fillRect(ox, oy + y, TILE_PX, 2);
    for (let y = 0; y < TILE_PX; y += 16) {
      g.fillRect(ox + 8, oy + y, 2, 8); g.fillRect(ox + 24, oy + y + 8, 2, 8);
    }
  }
  {
    const [ox, oy] = tile(TILE.DEEPSTONE, "#0033cc", ["#002a9e", "#0050ff"]);
    g.fillStyle = "#aef4ff";
    for (const [dx, dy] of [[8, 8], [22, 12], [14, 22], [26, 26], [6, 26]]) {
      g.fillRect(ox + dx, oy + dy, 3, 3);
    }
    studs(ox, oy, "#0050ff", "#001f6e");
  }
  tile(TILE.SCAR, "#05060d", ["#0a0e1c", "#000000", "#121a2e"], 40);
  {
    const [ox, oy] = tile(TILE.CRYSTAL, "#33ccff", ["#66e0ff", "#00a3e8", "#b3f1ff"], 30, 4);
    g.fillStyle = "#ffffff";
    for (const [dx, dy] of [[6, 6], [20, 10], [12, 22]]) g.fillRect(ox + dx, oy + dy, 4, 4);
  }
  {
    const [ox, oy] = tile(TILE.VAULT, "#0b4fa8", ["#083d84", "#0f63cc"]);
    studs(ox, oy, "#0f63cc", "#062c5c");
  }
  tile(TILE.BEDROCK, "#3d4a5c", ["#323e4d", "#4a5a6e", "#28323f"], 50, 5);
  {
    // Moss (v5): the meadow's lush patches — deep teal in the
    // settled blue family, soft-flecked, studded like a top face.
    const [ox, oy] = tile(TILE.MOSS, "#075263", ["#0a6a75", "#064453", "#0d7f8c"], 44, 4);
    studs(ox, oy, "#12a3b4", "#05333f");
  }
  {
    // Shale (v5): layered slate for Ashfall's strata — thin dark
    // seams across a blue-grey face.
    const [ox, oy] = tile(TILE.SHALE, "#2e3a52", ["#263146", "#39486a"]);
    g.fillStyle = "rgba(0,0,0,0.4)";
    for (let y = 5; y < TILE_PX; y += 7) g.fillRect(ox + 2, oy + y, TILE_PX - 4, 2);
  }
  atlasCanvas = cv; // kept: per-realm variants are drawn from it
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// block -> [top, side, bottom] tiles
const BLOCK_TILES = {
  [BLOCK.GRASS]: [TILE.GRASS_TOP, TILE.GRASS_SIDE, TILE.DIRT],
  [BLOCK.DIRT]: [TILE.DIRT, TILE.DIRT, TILE.DIRT],
  [BLOCK.STONE]: [TILE.STONE, TILE.STONE, TILE.STONE],
  [BLOCK.WOOD]: [TILE.WOOD_TOP, TILE.WOOD_SIDE, TILE.WOOD_TOP],
  [BLOCK.LEAF]: [TILE.LEAF, TILE.LEAF, TILE.LEAF],
  [BLOCK.ASH]: [TILE.ASH_TOP, TILE.ASH_SIDE, TILE.REDROCK],
  [BLOCK.REDROCK]: [TILE.REDROCK, TILE.REDROCK, TILE.REDROCK],
  [BLOCK.BASALT]: [TILE.BASALT, TILE.BASALT, TILE.BASALT],
  [BLOCK.EMBER]: [TILE.EMBER, TILE.EMBER, TILE.EMBER],
  [BLOCK.BRICK]: [TILE.BRICK, TILE.BRICK, TILE.BRICK],
  [BLOCK.DEEPSTONE]: [TILE.DEEPSTONE, TILE.DEEPSTONE, TILE.DEEPSTONE],
  [BLOCK.SCAR]: [TILE.SCAR, TILE.SCAR, TILE.SCAR],
  [BLOCK.CRYSTAL]: [TILE.CRYSTAL, TILE.CRYSTAL, TILE.CRYSTAL],
  [BLOCK.VAULT]: [TILE.VAULT, TILE.VAULT, TILE.VAULT],
  [BLOCK.BEDROCK]: [TILE.BEDROCK, TILE.BEDROCK, TILE.BEDROCK],
  [BLOCK.SANDSTONE]: [TILE.ASH_SIDE, TILE.ASH_SIDE, TILE.ASH_SIDE],
  [BLOCK.MOSS]: [TILE.MOSS, TILE.GRASS_SIDE, TILE.DIRT],
  [BLOCK.SHALE]: [TILE.SHALE, TILE.SHALE, TILE.SHALE],
};
const GLOW_BLOCKS = new Set([BLOCK.EMBER, BLOCK.DEEPSTONE, BLOCK.CRYSTAL]);

// ---------- three.js scene -------------------------------------------------

let scene, camera, renderer, hemi, sun, swoosh = null;
let lampLight = null; // the fox's lamp (v5, feedback #12)
let introScreen = null, introScreenMesh = null; // the Arrival memory screen (v5, feedback #14)
const chunkStore = new Map(); // "realm|cx,cz" -> {data, group, meshKey}
const chunkMats = new Set(); // live main-scene chunk materials (palette swaps)
const dirtyChunks = new Set();
const RENDER_R = 3;

function initThree() {
  const holder = $("stage");
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(74, 1, 0.1, 400);
  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  holder.appendChild(renderer.domElement);
  hemi = new THREE.HemisphereLight(0x8fd0ff, 0x0a1a33, 0.95);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xbfe3ff, 1.6);
  sun.position.set(40, 80, 25);
  scene.add(sun);
  atlasTexture = makeAtlas();
  // The swing arc lives on the camera (feedback #2).
  scene.add(camera);
  swoosh = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.62, 20, 1, 0, Math.PI * 0.95),
    new THREE.MeshBasicMaterial({
      color: 0x9fe8ff, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthTest: false,
    }));
  swoosh.position.set(0.18, -0.12, -0.7);
  swoosh.visible = false;
  camera.add(swoosh);
  // The fox's lamp (feedback #12): a spotlight riding the camera,
  // off until V. The Bright Charm, once held, stretches it.
  lampLight = new THREE.SpotLight(0xd8ecff, 0, 46, 0.55, 0.45, 0.8);
  lampLight.position.set(0.25, -0.15, 0.1);
  camera.add(lampLight);
  lampLight.target.position.set(0, -0.1, -8);
  camera.add(lampLight.target);
  buildIntroScreen();
  buildTellingDoor();
  applyRealmSky();
  window.addEventListener("resize", onResize);
  onResize();
  renderer.setAnimationLoop(animate);
}

let appliedPaletteRealm = null;
// Realm palettes (feedback #27): ONE data-driven path — the
// palette table in world.js (REALM_PALETTES + HOME_PALETTE for
// Nova Prime) applied whole on realm entry: void, fog, lights,
// and the atlas + tint of every live chunk material, so the place
// the fox lands is dressed in its own colors, not the last one's.
function applyRealmPalette(realmId) {
  const pal = paletteFor(realmId);
  scene.background = new THREE.Color(pal.void);
  scene.fog = new THREE.Fog(pal.fog, pal.fogNear, pal.fogFar);
  hemi.color.set(pal.hemiSky); hemi.groundColor.set(pal.hemiGround);
  hemi.intensity = pal.hemiI;
  sun.color.set(pal.sun); sun.intensity = pal.sunI;
  const tex = atlasForRealm(realmId);
  for (const m of chunkMats) {
    m.map = tex;
    if (m.emissiveMap) m.emissiveMap = tex;
    m.color.set(pal.tint);
  }
  appliedPaletteRealm = realmId;
}
function applyRealmSky() {
  applyRealmPalette(state.realm);
}

// ---------- the Arrival memory screen (feedback #14) -------------------------
// A standing stone screen west of the spawn clearing, facing the
// fox as they wake. It keeps the first film — the phext intro —
// and plays it IN the world: walk up, look at it, click, and the
// film opens (poster first, click-to-play, closable at any moment
// — the same bypass spirit as the load panel). The film itself is
// embedded in the build by build3.py (window.__INTRO_VIDEO /
// __INTRO_POSTER); if a build ever lacks it, the screen stands
// dark and honest rather than pretending.
function buildIntroScreen() {
  introScreen = new THREE.Group();
  const bx = 4, bz = 11; // blocks, Nova Prime scroll (0,0)
  const groundY = heightAt("nova", bx, bz) + 1;
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x2c3e55 });
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x0a1a33 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.9, 0.24), stoneMat);
    post.position.set(side * 1.85, 1.45, 0);
    introScreen.add(post);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.3, 0.18), frameMat);
  back.position.set(0, 2.05, -0.1);
  introScreen.add(back);
  let faceMat;
  if (window.__INTRO_POSTER) {
    const img = new window.Image();
    img.src = window.__INTRO_POSTER;
    const tex = new THREE.Texture(img);
    img.onload = () => { tex.needsUpdate = true; };
    faceMat = new THREE.MeshBasicMaterial({ map: tex });
  } else {
    faceMat = new THREE.MeshBasicMaterial({ color: 0x04101e });
  }
  introScreenMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.55, 2.0), faceMat);
  introScreenMesh.position.set(0, 2.05, 0.02);
  introScreen.add(introScreenMesh);
  introScreen.position.set(bx + 0.5, groundY, bz + 0.5);
  // Face the spawn clearing, so the waking fox sees it.
  introScreen.rotation.y = Math.atan2(
    (ARRIVAL.nova.x + 0.5) - (bx + 0.5), (ARRIVAL.nova.z + 0.5) - (bz + 0.5));
  scene.add(introScreen);
}
const _introRay = new THREE.Raycaster();
function introScreenAimed() {
  if (!introScreenMesh || state.realm !== "nova" || !introScreen.visible) return false;
  _introRay.setFromCamera({ x: 0, y: 0 }, camera);
  const hit = _introRay.intersectObject(introScreenMesh, false);
  return hit.length > 0 && hit[0].distance < 7;
}
function openIntroViewer() {
  const v = $("intro-video");
  if (v && !v.getAttribute("src") && window.__INTRO_VIDEO) {
    v.src = window.__INTRO_VIDEO; // set on first open: preload stays honest
  }
  if (v && window.__INTRO_POSTER && !v.getAttribute("poster")) {
    v.poster = window.__INTRO_POSTER;
  }
  $("intro-viewer").style.display = "block";
  state.introOpen = true;
  if (document.exitPointerLock) document.exitPointerLock();
}
function closeIntroViewer() {
  const v = $("intro-video");
  if (v) v.pause();
  $("intro-viewer").style.display = "none";
  state.introOpen = false;
}

// ---------- the telling door (demo8, EE 953 design) ---------------------------
// A standing door in Nova Prime on the taught path near Arrival —
// fixed scenery, NOT a rift: rifts are player-opened travel links,
// one at a time; this door never moves and carries nobody
// anywhere. It stands east of Arrival, on the way a new fox is
// taught to walk (the Deep Stone lies east), as a frame with a
// warm light in it. Walking up to it offers the telling panel;
// looking at it and clicking opens the panel too, and its hover
// line speaks its name in the game's hover idiom.
let tellingDoor = null, tellingDoorGlow = null;
function buildTellingDoor() {
  tellingDoor = new THREE.Group();
  const bx = 13, bz = 10; // blocks, Nova Prime scroll (0,0), east of Arrival
  const groundY = heightAt("nova", bx, bz) + 1;
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x3a2c1c });
  const postGeo = new THREE.BoxGeometry(0.26, 3.1, 0.26);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, frameMat);
    post.position.set(side * 0.95, 1.55, 0);
    tellingDoor.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.26, 0.26), frameMat);
  lintel.position.set(0, 3.1, 0);
  tellingDoor.add(lintel);
  const step = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.12, 0.7), frameMat);
  step.position.set(0, 0.06, 0);
  tellingDoor.add(step);
  // The warm light in the doorway: a soft pane that never opens.
  tellingDoorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.64, 2.84),
    new THREE.MeshBasicMaterial({
      color: 0xffb84d, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    }));
  tellingDoorGlow.position.set(0, 1.55, 0);
  tellingDoor.add(tellingDoorGlow);
  const lamp = new THREE.PointLight(0xffc37a, 14, 11, 1.8);
  lamp.position.set(0, 1.9, 0.4);
  tellingDoor.add(lamp);
  tellingDoor.position.set(bx + 0.5, groundY, bz + 0.5);
  // Face the spawn clearing, so the waking fox sees its light.
  tellingDoor.rotation.y = Math.atan2(
    (ARRIVAL.nova.x + 0.5) - (bx + 0.5), (ARRIVAL.nova.z + 0.5) - (bz + 0.5));
  scene.add(tellingDoor);
}
const _doorRay = new THREE.Raycaster();
function tellingDoorAimed() {
  if (!tellingDoor || state.realm !== "nova" || !tellingDoor.visible) return false;
  _doorRay.setFromCamera({ x: 0, y: 0 }, camera);
  const hit = _doorRay.intersectObject(tellingDoor, true);
  return hit.length > 0 && hit[0].distance < 7;
}
// The door's nearness, polled from animate(): the first approach
// carries the teaching as a toast (once, ever, on this machine);
// walking up to the door offers the panel, once per approach —
// stepping away and back offers it again.
let doorArmed = true, doorToastDone = LS.get("nova-phox-idea-door-met", false);
function doorStep() {
  const line = $("doorline");
  if (!tellingDoor) { if (line) line.style.display = "none"; return; }
  tellingDoor.visible = state.realm === "nova";
  if (state.realm !== "nova") { if (line) line.style.display = "none"; return; }
  const d = camera.position.distanceTo(tellingDoor.position);
  // Hover: the door names itself while it is what you are looking at.
  const aimed = d < 7 && tellingDoorAimed();
  if (line) {
    line.style.display = aimed ? "block" : "none";
    if (aimed) line.textContent = "the telling door — leave an idea for the world";
  }
  if (d > 4.5) doorArmed = true;
  if (d < 3.4 && !doorToastDone) {
    doorToastDone = true;
    LS.set("nova-phox-idea-door-met", true);
    toast("The telling door. Leave an idea for the world — the world listens, and answers by changing.", 8000);
  }
  const panel = $("ideas");
  if (d < 2.3 && doorArmed && panel && panel.style.display !== "block") {
    doorArmed = false;
    toggleIdeas(true);
  }
}

function onResize() {
  const holder = $("stage");
  const w = holder.clientWidth, h = holder.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ---------- chunk store: generate, mesh, rebuild ---------------------------

function chunkKey(cx, cz) {
  return `${state.realm}|${cx},${cz}`;
}
function getBlockWorld(x, y, z) {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  const e = chunkStore.get(chunkKey(cx, cz));
  if (e) return chunkBlock(e.data, x - cx * CHUNK, y, z - cz * CHUNK);
  return baseBlockAt(sub, state.realm, x, y, z);
}
function solidAt(x, y, z) {
  return isSolid(getBlockWorld(x, y, z));
}

const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], tile: 1 },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], tile: 1 },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], tile: 0 },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], tile: 2 },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], tile: 1 },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], tile: 1 },
];
const FACE_SHADE = [0.82, 0.82, 1.0, 0.62, 0.7, 0.7];

function buildChunkMesh(cx, cz, data, opts = {}) {
  // opts.realmId / opts.atlas / opts.register serve the portal view
  // (feedback #27): a chunk meshed for ANOTHER realm reads that
  // realm's chisel map and base generation, wears that realm's
  // atlas, and keeps its materials out of the main-scene registry.
  const meshRealm = opts.realmId || state.realm;
  const group = new THREE.Group();
  const buckets = { opaque: [], glow: [] };
  const geo = {
    opaque: { pos: [], norm: [], uv: [], col: [], idx: [] },
    glow: { pos: [], norm: [], uv: [], col: [], idx: [] },
  };
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  // The chisel's levels for THIS chunk, resolved once into local
  // keys — the mesh loop asks per block and must not pay a
  // string-keyed realm-map lookup (plus its allocation) for every
  // one of 16k blocks on every rebuild (v5, feedback #8).
  const chiselHere = new Map();
  const realmChisel = sub.chisel.get(meshRealm);
  if (realmChisel) {
    for (const [key, lv] of realmChisel) {
      const [bx, by, bz] = key.split(",").map(Number);
      const lx = bx - x0, lz = bz - z0;
      if (lx >= 0 && lz >= 0 && lx < CHUNK && lz < CHUNK) {
        chiselHere.set(`${lx},${by},${lz}`, lv);
      }
    }
  }
  const blockAt = (x, y, z) => {
    if (x >= x0 && x < x0 + CHUNK && z >= z0 && z < z0 + CHUNK) {
      return chunkBlock(data, x - x0, y, z - z0);
    }
    if (meshRealm !== state.realm) return baseBlockAt(sub, meshRealm, x, y, z);
    return getBlockWorld(x, y, z);
  };
  for (let y = 0; y < WORLD_H; y++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const b = chunkBlock(data, lx, y, lz);
        if (b === BLOCK.AIR) continue;
        const wx = x0 + lx, wz = z0 + lz;
        const tiles = BLOCK_TILES[b] || BLOCK_TILES[BLOCK.STONE];
        const bucket = GLOW_BLOCKS.has(b) ? geo.glow : geo.opaque;
        // The chisel's degrees (feedback #10): a shaped block is
        // drawn shrunk toward its center by its level — granular
        // deformation you can see, from the world truth (world.js).
        const chLv = chiselHere.get(`${lx},${y},${lz}`) || 0;
        const inset = chLv * 0.13;
        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nb = blockAt(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
          // Every block is solid: a face shows only where it meets air.
          if (nb !== BLOCK.AIR) continue;
          const tileIdx = tiles[face.tile];
          const u0 = (tileIdx % ATLAS_COLS) / ATLAS_COLS;
          const v0 = 1 - (Math.floor(tileIdx / ATLAS_COLS) + 1) / ATLAS_ROWS;
          const du = 1 / ATLAS_COLS, dv = 1 / ATLAS_ROWS;
          const base = bucket.pos.length / 3;
          const shade = FACE_SHADE[f];
          for (const c of face.corners) {
            bucket.pos.push(
              wx + c[0] + (0.5 - c[0]) * inset,
              y + c[1] + (0.5 - c[1]) * inset,
              wz + c[2] + (0.5 - c[2]) * inset);
            bucket.norm.push(...face.dir);
            bucket.col.push(shade, shade, shade);
          }
          bucket.uv.push(u0, v0 + dv, u0 + du, v0 + dv, u0 + du, v0, u0, v0);
          bucket.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }
  for (const kind of ["opaque", "glow"]) {
    const bk = geo[kind];
    if (!bk.idx.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(bk.pos, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(bk.norm, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(bk.uv, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(bk.col, 3));
    geometry.setIndex(bk.idx);
    const tex = opts.atlas || atlasForRealm(meshRealm);
    const mat = kind === "glow"
      ? new THREE.MeshLambertMaterial({
          map: tex, vertexColors: true, color: paletteFor(meshRealm).tint,
          emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55,
        })
      : new THREE.MeshLambertMaterial({
          map: tex, vertexColors: true, color: paletteFor(meshRealm).tint,
        });
    if (opts.register !== false) chunkMats.add(mat);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    buckets[kind] = mesh;
  }
  return group;
}

// A chunk's generated form depends on: its scroll's gravity, the
// Life density of its cells (crystal growth), and the pressure along
// its seams (neighbor-scroll growth). Signature those inputs cheaply;
// regenerate only when they actually change. (Regenerating on every
// tick regardless was a storm that starved the frame rate.)
function chunkSignature(cx, cz) {
  // Generation inputs, v3: the growth levels of the chunk's cells
  // (quantized — the ramp is slow, so a chunk re-derives a handful
  // of times while a feature creeps in, not every tick) + gravity.
  const gx0 = cx * (CHUNK / 2), gz0 = cz * (CHUNK / 2); // cells are 2 blocks
  let growth = 0;
  for (let gy = gz0; gy < gz0 + CHUNK / 2; gy++)
    for (let gx = gx0; gx < gx0 + CHUNK / 2; gx++)
      growth += Math.round(sub.growthAt(state.realm, gx, gy) * 6);
  const { sx, sy } = {
    sx: scrollOfBlock(cx * CHUNK), sy: scrollOfBlock(cz * CHUNK),
  };
  const grav = sub.gravityOf(state.realm, sx, sy);
  let chiselN = 0;
  const cm = sub.chisel.get(state.realm);
  if (cm) {
    for (const key of cm.keys()) {
      const [x, , z] = key.split(",").map(Number);
      if (Math.floor(x / CHUNK) === cx && Math.floor(z / CHUNK) === cz) chiselN++;
    }
  }
  return `${growth}|${grav}|${chiselN}`;
}

function ensureChunk(cx, cz, remeshOnly = false) {
  const key = chunkKey(cx, cz);
  let e = chunkStore.get(key);
  if (!e) {
    const data = genChunk(sub, state.realm, cx, cz);
    const group = buildChunkMesh(cx, cz, data);
    scene.add(group);
    chunkStore.set(key, { data, group, sig: chunkSignature(cx, cz) });
    // Neighbors are NOT invalidated: a face of ours that should have
    // been culled by a neighbor's late-arriving feature ends up
    // embedded inside that feature — invisible. (Invalidating them
    // caused a boot-time rebuild storm.)
    return true;
  }
  if (remeshOnly) {
    const group = buildChunkMesh(cx, cz, e.data);
    scene.remove(e.group);
    disposeGroup(e.group);
    e.group = group;
    scene.add(group);
  }
  return false;
}

function regenerateChunk(cx, cz) {
  const key = chunkKey(cx, cz);
  const e = chunkStore.get(key);
  if (!e) return ensureChunk(cx, cz);
  e.data = genChunk(sub, state.realm, cx, cz);
  e.sig = chunkSignature(cx, cz);
  const group = buildChunkMesh(cx, cz, e.data);
  scene.remove(e.group);
  disposeGroup(e.group);
  e.group = group;
  scene.add(group);
}

function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { chunkMats.delete(o.material); o.material.dispose(); }
  });
}

function markScrollChunksDirty(realmId, sx, sy) {
  if (realmId !== state.realm) return;
  for (let cx = sx * (SCROLL / CHUNK); cx < (sx + 1) * (SCROLL / CHUNK); cx++) {
    for (let cz = sy * (SCROLL / CHUNK); cz < (sy + 1) * (SCROLL / CHUNK); cz++) {
      const key = chunkKey(cx, cz);
      if (chunkStore.has(key)) dirtyChunks.add(key);
    }
  }
}

function chunkMaintenance() {
  const pcx = Math.floor(state.pos.x / CHUNK), pcz = Math.floor(state.pos.z / CHUNK);
  // Generate missing chunks near the player (a few per frame).
  let made = 0;
  for (let r = 0; r <= RENDER_R && made < 3; r++) {
    for (let dx = -r; dx <= r && made < 3; dx++) {
      for (let dz = -r; dz <= r && made < 3; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (ensureChunk(pcx + dx, pcz + dz)) made++;
      }
    }
  }
  // Rebuild a few explicitly-dirtied chunks (scars, new neighbors).
  let rebuilt = 0;
  for (const key of dirtyChunks) {
    if (rebuilt >= 2) break;
    dirtyChunks.delete(key);
    const [, rest] = key.split("|");
    const [cx, cz] = rest.split(",").map(Number);
    if (Math.abs(cx - pcx) <= RENDER_R + 1 && Math.abs(cz - pcz) <= RENDER_R + 1) {
      regenerateChunk(cx, cz);
      rebuilt++;
    }
  }
  // Signature sweep: Life moved somewhere — find the loaded chunks
  // whose generation inputs drifted and re-derive just those.
  if (rebuilt === 0) {
    let checked = 0;
    for (const [key, e] of chunkStore) {
      if (checked >= 10) break;
      const [realm, rest] = key.split("|");
      if (realm !== state.realm) continue;
      const [cx, cz] = rest.split(",").map(Number);
      if (Math.abs(cx - pcx) > RENDER_R + 1 || Math.abs(cz - pcz) > RENDER_R + 1) continue;
      checked++;
      if (chunkSignature(cx, cz) !== e.sig) {
        regenerateChunk(cx, cz);
        break; // one per frame is plenty; the world breathes slowly
      }
    }
  }
  // Drop far chunks.
  for (const [key, e] of chunkStore) {
    const [realm, rest] = key.split("|");
    const [cx, cz] = rest.split(",").map(Number);
    if (realm !== state.realm ||
        Math.abs(cx - pcx) > RENDER_R + 2 || Math.abs(cz - pcz) > RENDER_R + 2) {
      scene.remove(e.group);
      disposeGroup(e.group);
      chunkStore.delete(key);
    }
  }
}

// ---------- monsters in the view -------------------------------------------

const monsterMeshes = new Map(); // monster id -> THREE.Group
function buildMonsterMesh(kind) {
  // Brick-built (feedback #7): the dark things are assembled from
  // blocks and studs like everything else in the world — plastic,
  // snapped together, wrong. Materials are transparent so the view
  // can FADE a thing in and out (feedback #6): nothing pops.
  const g = new THREE.Group();
  const mats = [];
  const mat = (color, emissive, ei) => {
    const m = new THREE.MeshLambertMaterial({
      color, emissive, emissiveIntensity: ei, transparent: true, opacity: 0,
    });
    mats.push(m);
    return m;
  };
  const dark = mat(0x0a1230, 0x0033aa, 0.9);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.0, 1.05), dark);
  body.position.y = 0.95;
  g.add(body);
  const studMat = mat(0x101c44, 0x0044cc, 0.7);
  for (const [dx, dz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 10), studMat);
    stud.position.set(dx, 1.52, dz);
    g.add(stud);
  }
  const legMat = mat(0x05080f, 0x000000, 0);
  for (const [dx, dz] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 0.24), legMat);
    leg.position.set(dx, 0.22, dz);
    g.add(leg);
  }
  const eyeMat = mat(0x140a00,
    kind === "guardian" ? 0xff9500 : kind === "wisp" ? 0xbfe8ff : 0xff7a00, 2.4);
  for (const dz of [0.2, -0.2]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.14), eyeMat);
    eye.position.set(0.54, 1.05, dz);
    g.add(eye);
  }
  if (kind === "wisp") {
    // Pale plastic, gentle — clearly not of the dark.
    dark.color.set(0xd6ecff); dark.emissive.set(0x33baff); dark.emissiveIntensity = 0.5;
    studMat.color.set(0xf2faff);
  }
  if (kind === "guardian") g.scale.setScalar(1.7);
  g.userData.mats = mats;
  g.userData.opacity = 0;
  return g;
}

// The featured introduction (feedback #8): the first time a kind of
// thing shows itself, the world presents it — name card, a held
// breath, and no harm from it while it is being introduced.
const MONSTER_INTROS = {
  wisp: { name: "THE TRAINING WISP", epithet: "pale, patient, harmless — learn the strike on it" },
  surface: { name: "THE GLIMMER", epithet: "a thing that lives between glimpses — strike when it shows itself" },
  guardian: { name: "THE KEEPER OF THE DEEP ROOM", epithet: "it has guarded the stone a long time — strike it down" },
};
function startIntro(kind) {
  if (state.introduced.has(kind)) return;
  state.introduced.add(kind);
  LS.set("nova-phox-introduced", [...state.introduced]);
  state.introKind = kind;
  state.introUntil = performance.now() + 2100;
  const intro = MONSTER_INTROS[introKindKey(kind)];
  const card = $("introcard");
  $("intro-name").textContent = intro.name;
  $("intro-epithet").textContent = intro.epithet;
  card.style.display = "block";
  card.classList.remove("show");
  void card.offsetWidth;
  card.classList.add("show");
  if (hemi) hemi.intensity *= 0.45; // the spotlight: the world dims around it
  setTimeout(() => {
    card.style.display = "none";
    if (hemi) hemi.intensity /= 0.45;
    state.introKind = null;
  }, 2100);
}
function introKindKey(kind) {
  return kind === "guardian" || kind === "wisp" ? kind : "surface";
}

function monsterWorldPos(m) {
  const bx = m.gx * 2 + 1, bz = m.gy * 2 + 1;
  const y = m.kind === "guardian"
    ? DUNGEON.floorY + 1
    : heightAt(m.realmId, bx, bz) + 1;
  return { x: bx + 0.5, y, z: bz + 0.5 };
}
function syncMonsterMeshes(dt) {
  const seen = new Set();
  const now = performance.now();
  for (const m of sub.monsters) {
    if (!m.alive || m.realmId !== state.realm) continue;
    seen.add(m.id);
    let mesh = monsterMeshes.get(m.id);
    if (!mesh) {
      mesh = buildMonsterMesh(m.kind);
      monsterMeshes.set(m.id, mesh);
      scene.add(mesh);
      const p = monsterWorldPos(m);
      mesh.position.set(p.x, p.y, p.z);
    }
    // Fades, never pops (feedback #6): the glimpse cycle becomes an
    // opacity ramp. The Bright Charm stretches the glimpse — a
    // phase-1 thing shows as a faint shape (0.22) instead of nothing.
    let target = 0;
    if (m.kind === "wisp") target = 1;
    else if (sub.monsterVisible(m)) target = 1;
    else if (state.charms.bright && m.phase === 1) target = 0.22;
    const cur = mesh.userData.opacity || 0;
    const next = cur + (target - cur) * Math.min(1, dt * 5);
    mesh.userData.opacity = next;
    for (const mt of mesh.userData.mats) mt.opacity = next;
    mesh.visible = next > 0.03;
    if (mesh.visible) {
      const p = monsterWorldPos(m);
      const target3 = new THREE.Vector3(p.x, p.y, p.z);
      mesh.position.lerp(target3, 1 - Math.pow(0.001, dt));
      const bob = m.kind === "wisp" ? Math.sin(now / 480) * 0.12 : 0;
      mesh.position.y += bob;
      const s = (m.kind === "guardian" ? 1.7 : 1) * (1 + Math.sin(now / 260) * 0.05);
      mesh.scale.setScalar(s);
      mesh.rotation.y = Math.atan2(state.pos.x - p.x, state.pos.z - p.z) - Math.PI / 2;
      // Featured introduction, once per kind (feedback #8).
      if (target === 1 && next > 0.6 && !state.introduced.has(introKindKey(m.kind))) {
        const d = Math.hypot(state.pos.x - p.x, state.pos.z - p.z);
        if (d < 30) startIntro(m.kind);
      }
    }
  }
  for (const [id, mesh] of monsterMeshes) {
    if (!seen.has(id)) {
      scene.remove(mesh);
      monsterMeshes.delete(id);
    }
  }
}

// ---------- placed things in the view: the Lance and the charms --------------

const itemMeshes = new Map(); // item id -> THREE.Group
function buildItemMesh(it) {
  const g = new THREE.Group();
  const glow = (color) => new THREE.MeshLambertMaterial({
    color, emissive: color, emissiveIntensity: 0.85, transparent: true, opacity: 0.95,
  });
  if (it.kind === "lance") {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.0, 0.14), glow(0x00c8ff));
    shaft.position.y = 1.1;
    g.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 4), glow(0xeafcff));
    tip.position.y = 2.35;
    g.add(tip);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.9, 7, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x33baff, transparent: true, opacity: 0.13,
        side: THREE.DoubleSide, depthWrite: false,
      }));
    beam.position.y = 3.5;
    g.add(beam);
  } else {
    const colors = { swift: 0x00e5ff, ward: 0x2979ff, bright: 0xb3f1ff };
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), glow(colors[it.kind] || 0xffffff));
    gem.position.y = 1.0;
    g.add(gem);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x46586e }));
    base.position.y = 0.42;
    g.add(base);
  }
  return g;
}
function itemWorldPos(it) {
  const y = it.y !== null && it.y !== undefined
    ? it.y
    : heightAt(it.realmId, it.bx, it.bz) + 1;
  return { x: it.bx + 0.5, y, z: it.bz + 0.5 };
}
function syncItemMeshes(now) {
  for (const it of sub.items) {
    let mesh = itemMeshes.get(it.id);
    if (it.taken) {
      if (mesh) { scene.remove(mesh); itemMeshes.delete(it.id); }
      continue;
    }
    if (it.realmId !== state.realm) {
      if (mesh) { scene.remove(mesh); itemMeshes.delete(it.id); }
      continue;
    }
    if (!mesh) {
      mesh = buildItemMesh(it);
      itemMeshes.set(it.id, mesh);
      scene.add(mesh);
    }
    const p = itemWorldPos(it);
    mesh.position.set(p.x, p.y + Math.sin(now / 600 + it.bx) * 0.08, p.z);
    mesh.rotation.y = now / 900 + it.bx;
  }
  // Taking: walk into a thing and it is yours (inscribed by world.js).
  const it = sub.itemAt(state.realm, state.pos.x, state.pos.z);
  if (it && Math.abs((itemWorldPos(it).y) - state.pos.y) < 2.6) {
    const def = sub.pickupItem(it.id);
    if (def) {
      applyItemEffect(def);
      sfx.chime();
      sfx.melody([5, 9], { gap: 90 }); // v5: a pickup's two-note lift (#13)
      toast(`${def.name} is yours — ${def.blurb}.`, 7000);
      syncHud();
      syncReadout();
    }
  }
}
function applyItemEffect(def) {
  if (def.kind === "lance") state.weapon = "lance";
  if (def.kind === "swift") state.charms.swift = true;
  if (def.kind === "bright") state.charms.bright = true;
  if (def.kind === "ward") { state.charms.ward = true; state.wardCharge = 1; }
}

// ---------- player physics (the view obeys subspace gravity) ----------------

const HALF = 0.3, PHEIGHT = 1.8;
function playerBox() {
  const minY = state.gravDir > 0 ? state.pos.y : state.pos.y - PHEIGHT;
  return {
    minX: state.pos.x - HALF, maxX: state.pos.x + HALF,
    minY, maxY: minY + PHEIGHT,
    minZ: state.pos.z - HALF, maxZ: state.pos.z + HALF,
  };
}
function collides() {
  const b = playerBox();
  const x0 = Math.floor(b.minX), x1 = Math.floor(b.maxX - 1e-7);
  const y0 = Math.floor(b.minY), y1 = Math.floor(b.maxY - 1e-7);
  const z0 = Math.floor(b.minZ), z1 = Math.floor(b.maxZ - 1e-7);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++)
        if (solidAt(x, y, z)) return true;
  return false;
}
function moveAxis(axis, delta) {
  if (delta === 0) return false;
  // Substep so a fast fall can never tunnel through a 1-block floor.
  if (axis === "y" && Math.abs(delta) > 0.4) {
    const steps = Math.ceil(Math.abs(delta) / 0.4);
    let hit = false;
    for (let i = 0; i < steps; i++) {
      if (moveAxis("y", delta / steps)) { hit = true; break; }
    }
    return hit;
  }
  state.pos[axis] += delta;
  if (!collides()) return false;
  // Clamp back to the boundary of the block we hit.
  const b = playerBox();
  if (axis === "x") {
    state.pos.x = delta > 0
      ? Math.floor(b.maxX) - HALF - 1e-4
      : Math.floor(b.minX) + 1 + HALF + 1e-4;
  } else if (axis === "z") {
    state.pos.z = delta > 0
      ? Math.floor(b.maxZ) - HALF - 1e-4
      : Math.floor(b.minZ) + 1 + HALF + 1e-4;
  } else {
    if (state.gravDir > 0) {
      state.pos.y = delta > 0
        ? Math.floor(b.maxY) - PHEIGHT - 1e-4
        : Math.floor(b.minY) + 1 + 1e-4;
    } else {
      // Feet are the TOP of the box when down is up.
      state.pos.y = delta > 0
        ? Math.floor(b.maxY) - 1e-4 + 0 // moving up, feet stop at block bottom
        : Math.floor(b.minY) + 1 + PHEIGHT + 1e-4;
      if (delta > 0) state.pos.y = Math.floor(b.maxY) - 1e-4;
    }
  }
  // If still colliding (corner case), revert the move entirely.
  if (collides()) state.pos[axis] -= delta;
  return true;
}

// Horizontal move with a one-block step assist: meadow ground rises
// and falls a block at a time, and a fox should flow over it, not
// snag. (Stepping is toward away-from-ground, so it works on a
// ceiling too.)
function moveHorizontal(axis, delta) {
  const startA = state.pos[axis], startY = state.pos.y;
  if (!moveAxis(axis, delta)) return false;
  if (!state.onGround) return true;
  state.pos[axis] = startA;
  state.pos.y = startY + 1.02 * state.gravDir;
  if (collides()) {
    state.pos.y = startY;
    moveAxis(axis, delta);
    return true;
  }
  if (moveAxis(axis, delta)) {
    state.pos[axis] = startA;
    state.pos.y = startY;
    moveAxis(axis, delta);
    return true;
  }
  return false; // stepped up and moved; gravity settles us
}

const keys = new Set();
function updatePlayer(dt) {
  const { sx, sy } = playerScroll();
  const g = sub.gravityOf(state.realm, sx, sy);
  if (g !== state.gravDir) {
    // Down changed under the fox: keep the body's span exactly where
    // it is and move only the feet to the span's other end. (Without
    // this, the flipped box extends into the ground it stood on and
    // the collision clamp ratchets the player through the floor.)
    state.pos.y -= PHEIGHT * g;
    state.vel.y = 0;
    state.gravDir = g;
    playBeat(g > 0 ? "BEAT-border-down" : "BEAT-border-up");
    toast(g > 0 ? "Down is down again here." : "Down is up here. The place says so.");
  }
  // Input direction in heading space. When down is up, your right
  // hand points the other way — the strafe sign follows gravity.
  // The walking keys themselves are the chosen scheme's (feedback
  // #5): WASD, or AWEF for home-row hands (F walks backward there).
  const mv = state.scheme === "AWEF"
    ? { f: "KeyW", b: "KeyF", l: "KeyA", r: "KeyE" }
    : { f: "KeyW", b: "KeyS", l: "KeyA", r: "KeyD" };
  let fwd = 0, strafe = 0;
  if (keys.has(mv.f) || keys.has("ArrowUp")) fwd += 1;
  if (keys.has(mv.b) || keys.has("ArrowDown")) fwd -= 1;
  if (keys.has(mv.r)) strafe += 1;
  if (keys.has(mv.l)) strafe -= 1;
  strafe *= state.gravDir;
  const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
  const wishX = (-sin * fwd + cos * strafe);
  const wishZ = (-cos * fwd - sin * strafe);
  const wishLen = Math.hypot(wishX, wishZ) || 1;
  const run = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const speed = (run ? 6.8 : 4.4) * (state.charms.swift ? 1.35 : 1);
  const accel = state.onGround ? 42 : 12;
  state.vel.x += (wishX / wishLen) * (fwd || strafe ? accel : 0) * dt;
  state.vel.z += (wishZ / wishLen) * (fwd || strafe ? accel : 0) * dt;
  // Friction / clamp horizontal speed.
  const hSpeed = Math.hypot(state.vel.x, state.vel.z);
  const maxH = (fwd || strafe) ? speed : 0;
  if (state.onGround && !(fwd || strafe)) {
    const damp = Math.max(0, 1 - 14 * dt);
    state.vel.x *= damp; state.vel.z *= damp;
  } else if (hSpeed > speed) {
    state.vel.x *= speed / hSpeed; state.vel.z *= speed / hSpeed;
  }
  // Gravity — the scroll's word, not the view's.
  state.vel.y -= 23 * state.gravDir * dt;
  if (state.vel.y > 26) state.vel.y = 26;
  if (state.vel.y < -26) state.vel.y = -26;
  const wasGround = state.onGround;
  const prevVy = state.vel.y;
  const hitX = moveHorizontal("x", state.vel.x * dt);
  const hitZ = moveHorizontal("z", state.vel.z * dt);
  if (hitX) state.vel.x = 0;
  if (hitZ) state.vel.z = 0;
  const falling = Math.sign(state.vel.y) === -state.gravDir && state.vel.y !== 0;
  const hitY = moveAxis("y", state.vel.y * dt);
  state.onGround = hitY && falling;
  if (hitY) {
    if (!wasGround && Math.abs(prevVy) > 9) sfx.land();
    state.vel.y = 0;
  }
  // Head-bob + weave: the camera rides the stride; strafing leans.
  const moving = Math.hypot(state.vel.x, state.vel.z);
  if (state.onGround && moving > 0.6) {
    const prevPhase = state.bobPhase;
    state.bobPhase += dt * moving * 1.9;
    if (Math.sin(prevPhase) > 0 && Math.sin(state.bobPhase) <= 0) sfx.step();
    state.movedTotal += moving * dt;
  }
  state._lean = THREE.MathUtils.lerp(state._lean || 0, -strafe * 0.02, 1 - Math.pow(0.001, dt));
  // The first jump, landed: the ward's second half lifts (feedback #4).
  if (state.jumped >= 1 && state.onGround) state.firstJumpDone = true;
  // Fell out of the world entirely (should not happen; bedrock/vault).
  if (state.pos.y < -12 || state.pos.y > WORLD_H + 14) {
    playBeat("BEAT-fall");
    hurtPlayer(2, null, "The world lost track of you for a moment.");
    respawnAtArrival();
  }
  // Scroll crossing: your passage is written where pages change.
  const key = `${state.realm}|${sx},${sy}`;
  if (state.lastScrollKey && key !== state.lastScrollKey) {
    sub.log("trail", `${realmName(state.realm)} ${sx},${sy}`,
      "your passage crosses into a new page");
    ensureNeighborhood(state.realm, sx, sy);
    // Leaving the pocket page behind: its tune no longer holds us.
    if (state.pocketScroll &&
        (state.pocketScroll.sx !== sx || state.pocketScroll.sy !== sy)) {
      state.pocketChord = null;
      state.pocketScroll = null;
    }
  }
  state.lastScrollKey = key;
  // The day's page (DESIGN.md daily cycle): standing in today's
  // pocket scroll claims the feat, once, in writing.
  if (checkDaily(sub, state.realm, sx, sy, todayStr())) {
    sfx.chime();
    // v5 (#13): the day's own tune, played back as a melody.
    sfx.melody(dailyPocket(todayStr()).chord, { gap: 170 });
    // Fork B (D12): the daily prize draw — a small credit prize,
    // decided by the day itself, the same on every machine.
    const prize = dailyPrizeDraw(eco, playerName, todayStr());
    persistEco();
    toast(prize.won
      ? `You found the place of the day — and the day's prize is yours: ${prize.credits} credit${prize.credits === 1 ? "" : "s"}, in your purse.`
      : "You found the place of the day — it's on the board.", 7000);
    recordStandings();
    syncHud();
  }
}

function respawnAtArrival() {
  closeRift(); // a carried fox leaves no open rift behind
  const a = ARRIVAL[state.realm];
  state.pos.set(a.x + 0.5, heightAt(state.realm, a.x, a.z) + 1.01, a.z + 0.5);
  state.vel.set(0, 0, 0);
  ensureNeighborhood(state.realm, 0, 0);
}

// ---------- damage, death, combat ---------------------------------------------

function flashDamage() {
  const el = $("dmg");
  el.style.transition = "none";
  el.style.opacity = "0.55";
  requestAnimationFrame(() => {
    el.style.transition = "opacity 0.7s";
    el.style.opacity = "0";
  });
}
// Arrival's ward (feedback #4): no harm on the starting ground, and
// none until your first jump has landed — the world lets you learn
// your feet before it tests them. The HUD says when the ward holds.
function isWarded() {
  if (!state.firstJumpDone) return true;
  if (performance.now() < state.introUntil + 1000) return true; // featured, not fighting
  const a = ARRIVAL[state.realm];
  const dx = state.pos.x - (a.x + 0.5), dz = state.pos.z - (a.z + 0.5);
  return dx * dx + dz * dz < 14 * 14;
}
function hurtPlayer(amount, fromPos, why) {
  const now = performance.now();
  if (now < state.invulnUntil || state.dead) return;
  if (isWarded()) {
    if (!hurtPlayer._wardToast || now - hurtPlayer._wardToast > 6000) {
      hurtPlayer._wardToast = now;
      toast("You're safe here — nothing can hurt you at Arrival.", 3500);
    }
    return;
  }
  if (state.wardCharge > 0) {
    state.wardCharge--;
    state.invulnUntil = now + 1200;
    sfx.chime();
    toast("The Ward Charm turns the blow aside.", 4000);
    syncHud();
    return;
  }
  state.hp -= amount;
  state.invulnUntil = now + 1200;
  sfx.hurt();
  flashDamage();
  if (fromPos) {
    const dx = state.pos.x - fromPos.x, dz = state.pos.z - fromPos.z;
    const len = Math.hypot(dx, dz) || 1;
    state.vel.x += (dx / len) * 7;
    state.vel.z += (dz / len) * 7;
    state.vel.y += 3.5 * state.gravDir;
  }
  if (state.hp <= 0) {
    state.dead = true;
    playBeat("BEAT-death");
    sub.log("return", realmName(state.realm),
      "carried back to Arrival; everything written stayed written");
    toast("The dark takes its due — and you wake back at Arrival. Everything you earned is still yours.", 8000);
    setTimeout(() => {
      state.hp = 10;
      state.dead = false;
      respawnAtArrival();
      syncHud();
    }, 900);
  } else if (why) {
    toast(why);
  }
  syncHud();
}

function checkMonsterContact() {
  if (state.dead) return;
  for (const m of sub.monsters) {
    if (!m.alive || m.realmId !== state.realm || !sub.monsterVisible(m)) continue;
    const p = monsterWorldPos(m);
    const dx = state.pos.x - p.x, dz = state.pos.z - p.z;
    const dy = (state.pos.y + 0.9) - (p.y + 0.9);
    if (dx * dx + dz * dz < 1.5 && Math.abs(dy) < 2.1) {
      const before = state.hp;
      if (m.kind === "wisp") return; // the training thing cannot hurt you
      hurtPlayer(2, p, m.kind === "guardian"
        ? "The guardian reaches you. Strike it back — click, or F."
        : null);
      // It recoils to a distance — in subspace, where it lives —
      // whether or not the blow landed, so a turned-aside thing does
      // not camp on the fox and re-trigger every frame.
      const away = { x: Math.sign(m.gx - cellOfBlock(Math.floor(state.pos.x))) || 1,
                     y: Math.sign(m.gy - cellOfBlock(Math.floor(state.pos.z))) || 0 };
      for (let i = 0; i < 3; i++) sub._monsterStepBack(m, away);
      if (state.hp < before) {
        // The spoken line is for a hit that LANDS. (Playtest 1 /
        // Will, 2026-11-22: the beat used to fire on every contact
        // attempt — dozens of repeats of the same line in one
        // session. A landed hit is an event; a blocked one is not.)
        // BEAT-contact is RETIRED from the spoken rotation (feedback
        // #24, Will: the line "should just be a noise"): an ordinary
        // thing's landed hit cues with the damage flash, the hurt
        // sound, and — v5 completes the replacement — a short burst
        // of synthesized noise, the contact cue itself. No voice,
        // no toast. The guardian keeps its own spoken line; it is
        // one named foe, not a repeat.
        if (m.kind === "guardian") playBeat("BEAT-guardian-contact");
        else sfx.contactNoise();
        sub.log("contact", realmName(state.realm),
          `the ${m.kind === "guardian" ? "guardian" : "dark thing"} reached you`);
      }
    }
  }
}

function showSwing() {
  state.swingT = 0; // the frame loop sweeps the arc (see animate)
}
function damagePopup(text, color = "#aee6ff") {
  const el = $("dmgnum");
  el.textContent = text;
  el.style.color = color;
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
}
function tryStrike() {
  if (state.dead) return false;
  showSwing();
  sfx.noise({ peak: 0.08, decay: 0.08, freq: 2000 }); // the swing itself
  // The weapon decides the arm (feedback #9): bare strike is close
  // and single; the Star Lance reaches half again as far and lands
  // twice the word. Either way the blow is VISIBLE — a swept arc in
  // the view, a flash and a number where it lands.
  const weapon = state.weapon === "lance" ? ITEM_DEFS.lance : null;
  const range = weapon ? weapon.range : 4.4;
  const damage = weapon ? weapon.damage : 1;
  const dir = new THREE.Vector3(0, 0, -1)
    .applyEuler(new THREE.Euler(state.pitch, state.yaw, 0, "YXZ"));
  const eye = eyePos();
  let best = null, bestT = range;
  for (const m of sub.monsters) {
    if (!m.alive || m.realmId !== state.realm || !sub.monsterVisible(m)) continue;
    const p = monsterWorldPos(m);
    const center = new THREE.Vector3(p.x, p.y + 0.95, p.z);
    const to = center.clone().sub(eye);
    const t = to.dot(dir);
    if (t < 0 || t > bestT) continue;
    const closest = eye.clone().add(dir.clone().multiplyScalar(t));
    if (closest.distanceTo(center) < 1.3) { best = m; bestT = t; }
  }
  if (!best) return false;
  let killed = false;
  for (let d = 0; d < damage && !killed; d++) killed = sub.strikeMonster(best);
  if (killed) {
    sfx.strikeKill();
    playBeat(best.kind === "guardian" ? "BEAT-guardian-kill" : "BEAT-strike-kill");
    damagePopup("struck out", "#ff9d5c");
    const p = monsterWorldPos(best);
    const cx = Math.floor(p.x / CHUNK), cz = Math.floor(p.z / CHUNK);
    dirtyChunks.add(chunkKey(cx, cz));
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      dirtyChunks.add(chunkKey(cx + dx, cz + dz));
    }
    if (best.kind === "wisp") {
      state.wispKills++;
      toast("That's fighting, start to finish: get close, face it, strike when it shows itself.", 7000);
    } else {
      toast(best.kind === "guardian"
        ? "The guardian is gone. The hall is quiet."
        : "It's gone. And the scar stays.");
    }
    guideNotify("strike");
  } else {
    sfx.strikeHit();
    playBeat("BEAT-strike-hold");
    damagePopup(`-${damage} · it holds`, "#d8f4ff");
    toast("It holds. Strike again.");
  }
  syncReadout();
  syncHud();
  return true;
}

// ---------- the chisel (feedback #10, #4, #11) ------------------------------
// Granular deformation: aim at a block and shape it down by degrees
// (C, or a click that isn't a strike — feedback #3). Two strokes
// shrink it in the mesh; the third breaks it through, and the break
// is an inscription. v5: the chisel works at the brush's size
// (feedback #4 — , and . change it), a whole volume per stroke,
// each block judged on its own merits; and a refusal NAMES itself
// (feedback #11): there is no depth limit and never was — the old
// "too deep to shape" covered three different refusals (the floor
// of the world, the Deep Stone, already-broken ground) with one
// misleading sentence.
function tryChisel() {
  if (state.dead) return false;
  const dir = new THREE.Vector3(0, 0, -1)
    .applyEuler(new THREE.Euler(state.pitch, state.yaw, 0, "YXZ"));
  const eye = eyePos();
  for (let t = 0.4; t < 5.2; t += 0.1) {
    const px = Math.floor(eye.x + dir.x * t);
    const py = Math.floor(eye.y + dir.y * t);
    const pz = Math.floor(eye.z + dir.z * t);
    if (!solidAt(px, py, pz)) continue;
    const brush = BRUSHES[state.brush] || BRUSHES[0];
    const cells = brushBlocks(brush, px, py, pz, dir);
    let shaped = 0, broke = 0, lastLevel = 0, refusal = null;
    const dirty = new Set();
    for (const [bx, by, bz] of cells) {
      const r = sub.chiselBlock(state.realm, bx, by, bz);
      if (r.ok) {
        if (r.broke) broke++; else { shaped++; lastLevel = r.level; }
        dirty.add(`${Math.floor(bx / CHUNK)},${Math.floor(bz / CHUNK)}`);
      } else if (!refusal && r.reason !== "air") {
        refusal = r.reason; // bedrock / deepstone / gone — named below
      }
    }
    if (!shaped && !broke) {
      if (refusal === "bedrock") damagePopup("the floor of the world — it will not shape", "#93a7cc");
      else if (refusal === "deepstone") damagePopup("the Deep Stone will not shape", "#93a7cc");
      else if (refusal === "gone") damagePopup("already broken through", "#93a7cc");
      return false;
    }
    sfx.noise({ peak: 0.16, decay: 0.09, freq: broke ? 500 : 1100 });
    if (broke) {
      damagePopup(broke > 1 ? `broken through ×${broke} — for good` : "broken through — for good",
        "#ff9d5c");
    } else {
      damagePopup(cells.length === 1 ? `shaped · ${lastLevel} of 3` : `shaped ×${shaped}`,
        "#d8f4ff");
    }
    for (const k of dirty) {
      const [cx, cz] = k.split(",").map(Number);
      dirtyChunks.add(chunkKey(cx, cz));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        dirtyChunks.add(chunkKey(cx + dx, cz + dz));
      }
    }
    syncReadout();
    syncHud();
    return true;
  }
  return false;
}
function cycleBrush(d) {
  state.brush = (state.brush + d + BRUSHES.length) % BRUSHES.length;
  saveCtlPrefs();
  damagePopup(`brush: ${BRUSHES[state.brush].label}`, "#aee6ff");
}
// The lamp's numbers, with the ladder's two lamp rungs folded in
// (economy.js ladderLampBonuses): Small Hours feeds the flame and
// stretches its throw; the Second Knot widens its cone. The base
// lamp is untouched for a fox who owns neither — a rung widens a
// verb the free tier already has; it never gates it.
function lampIntensity() {
  if (!state.lamp) return 0;
  return (state.charms.bright ? 3.4 : 2.4) + ladderLampBonuses(eco).intensity;
}
function applyLamp() {
  if (!lampLight) return;
  const b = ladderLampBonuses(eco);
  lampLight.intensity = lampIntensity();
  lampLight.distance = 46 + b.distance;
  lampLight.angle = 0.55 + b.angle;
}
function toggleLamp() {
  state.lamp = !state.lamp;
  applyLamp();
  toast(state.lamp ? "Lamp on." : "Lamp off.", 2500);
}

// ---------- the instrument: numbers are the teleport ----------------------------

const NUMBER_KEYS = {
  Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, Digit6: 6,
  Digit7: 7, Digit8: 8, Digit9: 9, Digit0: 10, Minus: 11,
};
const LETTER_KEYS = ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft"];

function playNote(n) {
  sfx.unlock();
  sfx.pluck(n - 1);
  state.notesPlayed++;
  // v5 (feedback #9): repeats count. A tune is three notes played,
  // not three different notes — 2, 2, 2 is a coordinate like any
  // other, and it answers.
  state.notes.push(n);
  clearTimeout(state.notesTimer);
  state.notesTimer = setTimeout(() => { state.notes = []; syncHud(); }, 4000);
  if (state.notes.length === 3) {
    const chord = [...state.notes].sort((a, b) => a - b);
    state.notes = [];
    clearTimeout(state.notesTimer);
    playChord(chord);
  }
  syncHud();
  guideNotify("note");
}

// ---------- rifts: travel you walk through ---------------------------------
// Steering (Will, 2026-11-22, verbatim): "render ports for the rifts,
// don't just jump - actually render the rift and let the player walk
// through" and "don't select worlds with 3 coordinates, just draw the
// portal with the mouse". So: a played tune — keys or a drawn gesture
// (both route through playChord) — no longer teleports. It OPENS a
// rift a few steps ahead of the fox: a ring standing in the world,
// and the crossing happens when the fox walks through it.
//
// Rulings (Will, 2026-11-24): "portals remain open and traversable
// if the player is within range - it's not a 1-way trip" and
// "monsters start out native to different regions of subspace, but
// can be carried across by the rifts players open." So a rift is
// ONE door with TWO ends — a link. openRift plants both ends at
// once: the near ring a few steps ahead of the fox, the far ring a
// few steps ahead of where the fox will land. Crossing walks you
// through and leaves the door standing behind you, its far end
// now the near one: the far ring stands at the landing's BACK,
// so a fox who keeps walking after a crossing walks away from
// the door, never straight back through it. There is no clock on
// it: the door's leash is
// RANGE — it folds when the fox wanders more than RIFT_RANGE
// blocks from the end he is standing at (30 blocks, the outer
// band the portal view's cadence already used to judge presence).
// And the door is not the fox's alone: a thing of the dark near
// the ring when the fox crosses is carried across with him, and
// one that blunders into a standing ring crosses by itself —
// carried things come to live where they land
// (Subspace.carryMonster, world.js).
//
// And the door's FORM is the jump it spans (Will, 2026-11-24 —
// Leg A: "portals should have geometry, based upon how far apart
// they are in subspace"; "use the *shape* of CYOA"): each realm
// sits at a coordinate derived from CYOA's own shape (world.js,
// REALMS.coord), and the ring's size and facets are computed from
// the coordinate difference between the door's two realms —
// riftRingGeometry, a function, never a lookup.
//
// Feedback #27 (Will, 2026-11-22 23:09): "portals as actual camera
// views of the remote region." The disc is a true see-through view:
// a camera on the far side renders the destination region — its
// chunks, generated for the far realm and dressed in the far
// realm's palette; its monsters; its standing things; its marks,
// which ride along inside the generation — into a render target
// textured onto the disc. The far camera is the fox's own camera
// carried through the rift by the standard portal transform (eye
// offset from the ring, rotated by the heading change, re-anchored
// where the fox will land), so the view shifts as the fox moves
// and stepping through feels continuous. The ring wears the
// destination palette's accent. Only one rift LINK can stand at
// a time (openRift folds any other), so at most one portal view
// is ever live. Cadence: every frame within 12 units of the ring, ~120 ms
// within 30, a still refreshed every 500 ms beyond that. If the far
// view cannot be built, the disc falls back to the destination
// tint, as before — a tint, never a hole.
const RIFT_TINT = { nova: 0x0e4d8f, ashfall: 0x2979ff };
const RIFT_RANGE = 30; // blocks: the leash (see the rift header)
const RIFT_CARRY_RANGE = 6; // blocks from the ring: carried across with the fox
let riftSeq = 0; // link ids, so a test can tell one door from the next
const monsterRiftCooldown = new Map(); // monster id -> when it may next wander through
let portalRT = null; // THREE.WebGLRenderTarget, made on first rift
let portalView = null; // {scene, cam, dest, critters, renders, lastRender}

function portalDestInfo(target) {
  if (target.type === "realm") {
    const a = ARRIVAL[target.realmId] || { x: 8, z: 8 };
    return { realmId: target.realmId, bx: a.x, bz: a.z, sx: 0, sy: 0 };
  }
  if (target.type === "point") {
    // A named ground in a realm: the far end of a standing link,
    // seen from the end the fox is standing at.
    return {
      realmId: target.realmId, bx: target.bx, bz: target.bz,
      sx: scrollOfBlock(target.bx), sy: scrollOfBlock(target.bz),
    };
  }
  return {
    realmId: target.realmId, sx: target.sx, sy: target.sy,
    bx: target.sx * SCROLL + SCROLL / 2, bz: target.sy * SCROLL + SCROLL / 2,
  };
}

function buildPortalView(target) {
  disposePortalView();
  const dest = portalDestInfo(target);
  ensureNeighborhood(dest.realmId, dest.sx, dest.sy);
  const pal = paletteFor(dest.realmId);
  const pscene = new THREE.Scene();
  pscene.background = new THREE.Color(pal.void);
  pscene.fog = new THREE.Fog(pal.fog, pal.fogNear, pal.fogFar);
  const phemi = new THREE.HemisphereLight(pal.hemiSky, pal.hemiGround, pal.hemiI);
  pscene.add(phemi);
  const psun = new THREE.DirectionalLight(pal.sun, pal.sunI);
  psun.position.set(40, 80, 25);
  pscene.add(psun);
  const tex = atlasForRealm(dest.realmId);
  const ccx = Math.floor(dest.bx / CHUNK), ccz = Math.floor(dest.bz / CHUNK);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const data = genChunk(sub, dest.realmId, ccx + dx, ccz + dz);
      pscene.add(buildChunkMesh(ccx + dx, ccz + dz, data,
        { realmId: dest.realmId, atlas: tex, register: false }));
    }
  }
  const critters = [];
  for (const m of sub.monsters) {
    if (!m.alive || m.realmId !== dest.realmId) continue;
    const p = monsterWorldPos(m);
    if (Math.abs(p.x - dest.bx) > 26 || Math.abs(p.z - dest.bz) > 26) continue;
    const mesh = buildMonsterMesh(m.kind);
    mesh.position.set(p.x, p.y, p.z);
    pscene.add(mesh);
    critters.push({ m, mesh });
  }
  for (const it of sub.items) {
    if (it.taken || it.realmId !== dest.realmId) continue;
    const p = itemWorldPos(it);
    if (Math.abs(p.x - dest.bx) > 26 || Math.abs(p.z - dest.bz) > 26) continue;
    const mesh = buildItemMesh(it);
    mesh.position.set(p.x, p.y, p.z);
    pscene.add(mesh);
  }
  portalView = {
    scene: pscene, dest, critters,
    cam: new THREE.PerspectiveCamera(74, 1, 0.1, 220),
    renders: 0, lastRender: 0,
  };
}

function disposePortalView() {
  if (!portalView) return;
  portalView.scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  portalView = null;
}

// The far camera: the fox's eye offset from the ring's center,
// rotated by the heading change (a crossing preserves the fox's
// heading, so the far side faces the fox's current heading) and
// re-anchored at the landing eye. Yaw-only, like the ring itself.
const _pvRel = new THREE.Vector3();
const _pvQ = new THREE.Quaternion();
const _pvAxisY = new THREE.Vector3(0, 1, 0);
function renderPortalView(now, force = false) {
  const pv = portalView, r = state.rift;
  if (!pv || !r || !portalRT) return;
  const dist = Math.hypot(state.pos.x - r.x, state.pos.z - r.z);
  const cadence = dist < 12 ? 0 : dist < 30 ? 120 : 500;
  if (!force && cadence && now - pv.lastRender < cadence) return;
  pv.lastRender = now;
  const d = pv.dest;
  const anchorY = heightAt(d.realmId, d.bx, d.bz) + 1.01 + 1.62;
  _pvRel.copy(eyePos());
  _pvRel.x -= r.x;
  _pvRel.z -= r.z;
  _pvRel.y -= r.feetY + 1.65;
  _pvQ.setFromAxisAngle(_pvAxisY, state.yaw - r.faceYaw);
  _pvRel.applyQuaternion(_pvQ);
  pv.cam.position.set(
    d.bx + 0.5 + _pvRel.x, anchorY + _pvRel.y, d.bz + 0.5 + _pvRel.z);
  pv.cam.quaternion.copy(_pvQ).multiply(camera.quaternion);
  for (const c of pv.critters) {
    const p = monsterWorldPos(c.m);
    c.mesh.position.set(p.x, p.y, p.z);
    const vis = !c.m.alive ? 0
      : c.m.kind === "wisp" || sub.monsterVisible(c.m) ? 1
      : state.charms.bright && c.m.phase === 1 ? 0.22 : 0;
    for (const mt of c.mesh.userData.mats) mt.opacity = vis;
    c.mesh.visible = vis > 0.03;
  }
  renderer.setRenderTarget(portalRT);
  renderer.render(pv.scene, pv.cam);
  renderer.setRenderTarget(null);
  pv.renders++;
}

function closeRift() {
  if (state.rift) {
    scene.remove(state.rift.mesh);
    state.rift = null;
  }
  state.riftLink = null;
  disposePortalView();
}
// One end of a rift link: the ground you land on (landX/landZ,
// world coords) and its ring, facing back at the landing ground.
// The near end's ring stands a few steps AHEAD of the opener,
// where he can walk into it; the far end's ring stands a few
// steps BEHIND the landing (behind = true) — the door a fox
// steps out of is at his back, not in his path.
function riftEnd(realmId, landX, landZ, yaw, feetY, behind = false) {
  const dirx = -Math.sin(yaw), dirz = -Math.cos(yaw);
  const off = behind ? -3.4 : 3.4;
  const x = landX + dirx * off, z = landZ + dirz * off;
  return {
    realmId, landX, landZ, x, z,
    feetY: feetY !== undefined
      ? feetY : heightAt(realmId, Math.floor(x), Math.floor(z)),
    faceYaw: Math.atan2(landX - x, landZ - z),
  };
}
// Stand the local end of the standing link in the world: the ring,
// wearing the far realm's accent, and the live view through it —
// which looks at the OTHER end's landing ground.
function showRiftEnd(which) {
  const link = state.riftLink;
  if (!link) return;
  if (state.rift) {
    scene.remove(state.rift.mesh);
    state.rift = null;
    disposePortalView();
  }
  const end = link[which], other = link[which === "a" ? "b" : "a"];
  const viewTarget = which === "a" ? link.target : {
    type: "point", realmId: other.realmId,
    bx: Math.floor(other.landX), bz: Math.floor(other.landZ),
  };
  const mesh = new THREE.Group();
  // The ring's form is the jump it spans (Will, 2026-11-24 —
  // Leg A): its size and facets are computed from the coordinate
  // difference between the two ends' realms in subspace
  // (riftRingGeometry, world.js) — a near door stands small and
  // coarse, a far one large and smooth. No table: the geometry
  // is the difference, read off the realms' CYOA-derived coords.
  const geo = riftRingGeometry(end.realmId, other.realmId);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(geo.radius, geo.tube, 10, geo.segments),
    new THREE.MeshBasicMaterial({ color: paletteFor(other.realmId).accent }));
  let viewOk = false;
  try {
    if (!portalRT) portalRT = new THREE.WebGLRenderTarget(320, 320);
    buildPortalView(viewTarget);
    viewOk = true;
  } catch (err) {
    disposePortalView();
    viewOk = false;
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(geo.disc, geo.segments),
    viewOk
      ? new THREE.MeshBasicMaterial({ map: portalRT.texture, side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({
          color: RIFT_TINT[other.realmId] ?? 0x0e4d8f,
          transparent: true, opacity: 0.5, side: THREE.DoubleSide,
        }));
  mesh.add(ring);
  mesh.add(disc);
  mesh.position.set(end.x, end.feetY + 1.65, end.z);
  mesh.lookAt(end.landX, end.feetY + 1.65, end.landZ);
  scene.add(mesh);
  state.rift = {
    target: viewTarget, end: which, x: end.x, z: end.z,
    feetY: end.feetY, mesh, disc, faceYaw: end.faceYaw, viewOk,
    armed: false, geo,
  };
  if (viewOk) renderPortalView(performance.now(), true);
}
function openRift(target) {
  closeRift();
  const dest = portalDestInfo(target);
  // Both ends planted now (Will, 2026-11-24: not a 1-way trip):
  // the near end at the fox's ground, the far end at the landing
  // the tune names — a realm's Arrival, or a page's center.
  const a = riftEnd(state.realm, state.pos.x, state.pos.z, state.yaw,
    state.pos.y - 1.01);
  const b = riftEnd(target.realmId, dest.bx + 0.5, dest.bz + 0.5,
    state.yaw, undefined, true);
  state.riftLink = { id: ++riftSeq, target, a, b, crosses: 0 };
  showRiftEnd("a");
  sfx.portal();
  toast(target.type === "realm"
    ? `A rift opens — ${realmName(target.realmId)}. Walk through.`
    : "A rift opens — a far-off place in this world. Walk through.", 6000);
}
// Carry one thing of the dark through the standing link: it steps
// out around the far ring, offset from that ring as it stood to
// the near one, and never closer than minEmerge — a thing that
// emerges inside the far ring's own threshold would only blunder
// straight back.
function carryMonsterThrough(m, fromEnd, offX, offZ, minEmerge) {
  const link = state.riftLink;
  if (!link) return;
  const other = link[fromEnd === "a" ? "b" : "a"];
  let ox = offX, oz = offZ;
  const len = Math.hypot(ox, oz);
  if (len < minEmerge) {
    if (len > 0.01) { ox = ox / len * minEmerge; oz = oz / len * minEmerge; }
    else { ox = minEmerge; oz = 0; }
  }
  sub.carryMonster(m, other.realmId,
    cellOfBlock(Math.floor(other.x + ox)),
    cellOfBlock(Math.floor(other.z + oz)));
  monsterRiftCooldown.set(m.id, performance.now() + 4000);
}
// Walk through the standing door. The door stays standing: the
// end you entered becomes the far end, and the end you stepped
// out of is at your back, ready to take you back.
function crossThroughRift() {
  const link = state.riftLink, r = state.rift;
  const fromEnd = r.end;
  const other = link[fromEnd === "a" ? "b" : "a"];
  // Carried across with the fox: things of the dark near the ring
  // when it is crossed (Will, 2026-11-24 — the rifts players open
  // are the migration vector).
  const carried = [];
  for (const m of sub.monsters) {
    if (!m.alive || m.kind !== "surface" || m.realmId !== state.realm) continue;
    const p = monsterWorldPos(m);
    const mdx = p.x - r.x, mdz = p.z - r.z;
    if (mdx * mdx + mdz * mdz <= RIFT_CARRY_RANGE * RIFT_CARRY_RANGE)
      carried.push({ m, mdx, mdz });
  }
  link.crosses++;
  if (fromEnd === "a") {
    doCross(link.target, { viaLink: true, land: other });
  } else if (other.realmId !== state.realm) {
    doCross({ type: "realm", realmId: other.realmId },
      { viaLink: true, land: other });
  } else {
    // Home again within one realm: step out at the end you opened.
    flashPortal();
    state.pocketChord = null;
    state.pocketScroll = null;
    state.pos.set(other.landX,
      heightAt(state.realm, Math.floor(other.landX),
        Math.floor(other.landZ)) + 1.01,
      other.landZ);
    state.vel.set(0, 0, 0);
    ensureNeighborhood(state.realm,
      scrollOfBlock(other.landX), scrollOfBlock(other.landZ));
    syncHud();
    syncReadout();
  }
  for (const c of carried) carryMonsterThrough(c.m, fromEnd, c.mdx, c.mdz, 2.4);
  showRiftEnd(fromEnd === "a" ? "b" : "a");
}
function riftStep(now, dt) {
  const r = state.rift, link = state.riftLink;
  if (!r || !link) return;
  r.mesh.rotation.z += dt * 0.7;
  if (r.viewOk) renderPortalView(now);
  else r.disc.material.opacity = 0.42 + 0.14 * Math.sin(now / 280);
  const dx = state.pos.x - r.x, dz = state.pos.z - r.z;
  const dist2 = dx * dx + dz * dz;
  // The leash (Will, 2026-11-24): the rift stands while the fox is
  // within range of the end he is at, and folds when he is not.
  if (dist2 > RIFT_RANGE * RIFT_RANGE) {
    closeRift();
    toast("The rift folds shut — you have wandered beyond its reach.", 3000);
    return;
  }
  // The door is not the fox's alone: a thing of the dark that
  // blunders into the standing ring crosses by itself.
  for (const m of sub.monsters) {
    if (!m.alive || m.kind !== "surface" || m.realmId !== state.realm) continue;
    if (now < (monsterRiftCooldown.get(m.id) || 0)) continue;
    const p = monsterWorldPos(m);
    const mdx = p.x - r.x, mdz = p.z - r.z;
    if (mdx * mdx + mdz * mdz < 1.25)
      carryMonsterThrough(m, r.end, mdx, mdz, 2.4);
  }
  // A crossing arms only once the fox has stepped clear of the
  // ring he stepped out of — the same door, never a hair trigger.
  if (!r.armed) {
    if (dist2 > 4) r.armed = true;
    return;
  }
  const dy = (state.pos.y - 1.01) - r.feetY;
  if (dist2 < 1.25 && Math.abs(dy) < 2.4) crossThroughRift();
}

function playChord(chord) {
  const { sx, sy } = playerScroll();
  // The day's tune (DESIGN.md): today's chord goes to today's page,
  // whoever plays it, from the home meadow.
  const daily = dailyPocket(todayStr());
  let target = chordTarget(sub, state.realm, sx, sy, chord, state.pocketChord);
  if (state.realm === daily.realmId &&
      chord.length === daily.chord.length &&
      chord.every((n, i) => n === daily.chord[i]) &&
      !(target.type === "realm")) {
    target = { type: "pocket", realmId: daily.realmId, sx: daily.sx, sy: daily.sy, chord: daily.chord };
  }
  sub.log("tune", `${realmName(state.realm)} ${sx},${sy}`,
    `notes ${chord.join("+")} — a tune is played, and written`);
  if (target.type === "stay") {
    playBeat("BEAT-stay");
    toast("That's this place's own tune — it hums, and you stay put.");
    return;
  }
  // The tune opens a rift; the crossing itself happens when the
  // fox walks through it (doCross, below) — steering, Will
  // 2026-11-22: "render ports for the rifts, don't just jump".
  openRift(target);
  syncHud();
  syncReadout();
}

function doCross(target, opts = {}) {
  flashPortal();
  if (target.type === "realm") {
    const from = state.realm;
    state.realm = target.realmId;
    sub.log("cross", realmName(state.realm),
      `the bridge tune carries you from ${realmName(from)}`);
    state.pocketChord = null;
    state.pocketScroll = null;
    if (opts.viaLink) {
      // Through a standing door (Will, 2026-11-24): you step out
      // at the far end's ground, and the door stays standing —
      // respawnAtArrival would fold it and drop you at Arrival.
      const land = opts.land;
      state.pos.set(land.landX,
        heightAt(state.realm, Math.floor(land.landX),
          Math.floor(land.landZ)) + 1.01,
        land.landZ);
      state.vel.set(0, 0, 0);
      ensureNeighborhood(state.realm,
        scrollOfBlock(land.landX), scrollOfBlock(land.landZ));
    } else {
      respawnAtArrival();
    }
    applyRealmSky();
    for (const [, mesh] of monsterMeshes) scene.remove(mesh);
    monsterMeshes.clear();
    playBeat(state.realm === "ashfall" ? "BEAT-cross-ashfall" : "BEAT-cross-nova");
    toast(state.realm === "ashfall"
      ? "Ashfall Haven. The air tastes of cinders; the rock remembers fire."
      : "Nova Prime. Home meadow, green under a kind sky.", 8000);
    guideNotify("realm");
  } else {
    sub.getScroll(state.realm, target.sx, target.sy, true);
    state.pocketChord = target.chord;
    state.pocketScroll = { sx: target.sx, sy: target.sy };
    const cx = target.sx * SCROLL + SCROLL / 2, cz = target.sy * SCROLL + SCROLL / 2;
    state.pos.set(cx + 0.5, heightAt(state.realm, cx, cz) + 1.01, cz + 0.5);
    state.vel.set(0, 0, 0);
    ensureNeighborhood(state.realm, target.sx, target.sy);
    playBeat("BEAT-pocket");
    toast("The tune lands you in a far-off place.", 6000);
    guideNotify("pocket");
  }
  syncHud();
  syncReadout();
}

function flashPortal() {
  const el = $("flash");
  el.style.transition = "none";
  el.style.opacity = "0.85";
  requestAnimationFrame(() => {
    el.style.transition = "opacity 0.9s";
    el.style.opacity = "0";
  });
}

function flipGravityHere() {
  const { sx, sy } = playerScroll();
  const dir = sub.flipGravity(state.realm, sx, sy);
  state.flips++;
  sfx.flip();
  // The vault (or its absence) is generation: rebuild nearby NOW so
  // the new down has somewhere to land you.
  const pcx = Math.floor(state.pos.x / CHUNK), pcz = Math.floor(state.pos.z / CHUNK);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) regenerateChunk(pcx + dx, pcz + dz);
  markScrollChunksDirty(state.realm, sx, sy);
  playBeat(dir > 0 ? "BEAT-flip-down" : "BEAT-flip-up");
  toast(dir > 0 ? "Down is down. The place remembers." : "Down is up. The place remembers.", 5000);
  guideNotify("flip");
  syncReadout();
}

// ---------- the guide (Emise narrates; the guide guarantees the XP) --------------
// The first minutes are engineered so a fresh player cannot finish
// them without having DONE the two things that teach the world:
//   1. played a chord of three numbers and been carried somewhere
//      (movement is addressing), and
//   2. made a mark that stayed (the quest's hat is an inscription).
// The guide never explains either. It just makes sure they happen.

// v5 (feedback #19, per PLAYTEST-1 §6): the guide's order is
// re-sequenced. The old order was a 45-second conveyor — every verb
// taught back-to-back before the fox had taken ten free steps, and
// exploration was 0% of the first five minutes. Now the CROSSING is
// taught first (wake → rifts → move → numbers → bridge → ashfall:
// the directive's first true thing, done inside the opening
// minutes), then Emise hands the game over (handover), and the
// remaining verbs arrive JUST IN TIME — a step marked `jit` waits
// with the panel hidden until its `when` moment occurs in play:
// the fight when a thing of the dark first comes near, the mark
// once the wisp has fallen, gravity once a mark exists or the fox
// has wandered far enough to earn a new verb, the gesture once
// down has been turned, the quest once every verb is in hand. A
// step whose lesson the player has already lived (its `until`
// already true when its moment comes) passes silently.
function nearestMonsterDist() {
  let best = Infinity;
  for (const m of sub.monsters) {
    if (!m.alive || m.realmId !== state.realm) continue;
    const p = monsterWorldPos(m);
    const d = Math.hypot(p.x - state.pos.x, p.z - state.pos.z);
    if (d < best) best = d;
  }
  return best;
}
const GUIDE = [
  {
    id: "wake",
    lines: [
      "Wake up, fox. I'm Emise — I keep the map, and I'll walk with you a while.",
      "The galaxy is ours: every star named, every shore explored. But most of everything is still dark — and nobody ever learned what the dark is hiding.",
    ],
    button: "And then?",
  },
  {
    id: "rifts",
    lines: [
      "Then the rifts opened — cracks where the dark gets in. Things turn up that shouldn't exist. Places appear that nobody built.",
      "You're standing in one now: Nova Prime. Click the world to take control — the sound starts with that click, so listen as you go.",
    ],
    button: "Take control",
    action: "helm",
  },
  {
    id: "move",
    lines: [
      "Feet first. Walk with W A S D — the arrows work too. Look with the mouse, and jump with Space. Walk as far as you like: there is no fence, no edge, no end.",
    ],
    until: () => state.movedTotal > 7 && state.jumped >= 1,
    hint: "Walk a little. Jump once. (Nothing can hurt you yet — learn your feet.)",
  },
  {
    id: "numbers",
    lines: [
      "See the number keys along the top of your keyboard? They're an instrument. The letter row under them works too. Press any number and listen.",
      "Three different notes together make a tune. And a tune, fox, is a place.",
    ],
    until: () => state.notesPlayed >= 1,
    hint: "Press a number key. Any one.",
  },
  {
    id: "bridge",
    lines: [
      "Here is the first tune worth knowing: 1, 4, 9. Play the three notes in any order, close together.",
      "That's the bridge tune. It opens a rift to Ashfall Haven, a few steps in front of you — walk through it to cross. From Ashfall, the same tune opens the way home.",
    ],
    until: () => state.realm === "ashfall",
    hint: "Play 1, 4, 9.",
  },
  {
    id: "ashfall",
    lines: [
      "Ash and red rock. Every place on the map has its own weather, its own ground, its own mood.",
      "Things move in the dark here, same as at home. Most of the time you'll only catch a glimpse of them — and that's your moment. Strike when one shows itself: click, or press F.",
      "Play 1, 4, 9 when you're ready to head back.",
    ],
    until: () => state.realm === "nova",
    hint: "Play 1, 4, 9 to cross home.",
  },
  {
    id: "handover",
    // The hand-over (PLAYTEST-1 §6): the taught loop is done; the
    // game is the player's now, and Emise goes quiet until a
    // just-in-time moment is worth breaking the silence for.
    lines: [
      "That's the shape of it, fox: walk, play a tune, cross. The rest of the map is yours to wander.",
      "I'll speak when there's something worth saying. Until then — explore.",
    ],
    button: "Explore",
  },
  {
    id: "fight",
    // v3 step, text-only (no recorded beat yet — PLAN.md carries the flag).
    jit: true,
    when: () => nearestMonsterDist() < 16,
    lines: [
      "Before the dark tests you, let's practice. A pale wisp is waiting in the meadow, east of where you woke. It can't hurt you — and you're still safe here.",
      "Walk up to it, face it, and strike: click, or press F. Watch your swing, and watch where the blow lands. Two hits will finish it.",
      "Then pick up the Star Lance gleaming nearby. It reaches farther and hits harder — you'll want it for the real dark.",
    ],
    until: () => state.wispKills >= 1,
    hint: "Find the pale wisp. Face it. Click or F, twice.",
  },
  {
    id: "mark",
    // Playtest 1 (2026-11-22): the directive's second experience —
    // a mark that stays while the world shifts — was never staged.
    // The wisp's scar was written silently and the chisel was never
    // taught, so the moment the whole game is about happened where
    // no one was looking. This beat stages it: look at the scar,
    // then make one of your own.
    jit: true,
    when: () => state.wispKills >= 1,
    lines: [
      "Look at the ground where the wisp fell. See the dark scar? It's still there. This place remembers every mark made in it.",
      "Now make one of your own. Aim at any block and press C — that's your chisel. Three strokes shape a block down and break it through — and that break stays, too.",
    ],
    until: () => sub.wal.some((s) => s.op === "break"),
    hint: "Aim at a block. Press C — three strokes.",
  },
  {
    id: "gravity",
    jit: true,
    when: () => sub.wal.some((s) => s.op === "break") ||
      state.movedTotal - state.exploreMoved0 > 40,
    lines: [
      "One more trick before I leave you to it: press G, and down turns upside down. Down isn't a law here — each place keeps its own down, and it remembers what you set.",
      "Try it. Flip down up, and a dark ceiling appears over this place to catch you — it wasn't there before you flipped.",
    ],
    until: () => state.flips >= 1,
    hint: "Press G.",
  },
  {
    id: "gesture",
    // v3 step, text-only (no recorded beat yet).
    jit: true,
    when: () => state.flips >= 1,
    lines: [
      "One more way to travel, using the mouse: hold the right mouse button, draw a triangle in the air, and let go. That's the bridge tune, drawn instead of played.",
      "Draw a circle the same way to go home to Arrival. Draw a diamond to open a rift to a far-off place. The number keys still work — this is just a second way to play.",
    ],
    until: () => state.gestureUsed,
    hint: "Hold right mouse. Draw a triangle. Let go.",
  },
  {
    id: "quest",
    jit: true,
    when: () => state.gestureUsed,
    lines: [
      "East of where you woke up, a hill rises over an old buried hall — the barrow. Deep inside it lies the Deep Stone, and something is guarding it.",
      "Reach the stone, and the prize is yours for good. The grass, the light, even the day will change around it — what you've earned stays earned.",
      "Climb the hill and go down the shaft in its top. Fight with click or F. And watch your hearts — when they're gone, you're carried back to where you started.",
    ],
    until: () => sub.questDone,
    hint: "East, to the barrow. Reach the Deep Stone.",
  },
  {
    id: "done",
    lines: [
      "The hat is yours, and it's yours for good. You know the two true things now, even if you'd never say them my way: a tune is a place, and a mark you make stays — even when everything around it changes.",
      "The rest of the map is yours. Ten more realms are marked on it, quiet for now — press M to see their names. I'll be here when you need me.",
    ],
    button: "Explore",
  },
];

function guideCurrent() {
  return GUIDE[state.guideStep] || null;
}
function renderGuide() {
  const step = guideCurrent();
  const panel = $("guide");
  if (!step || state.guideDone) {
    panel.style.display = "none";
    return;
  }
  if (step.jit && !step.when()) {
    // Just-in-time (v5, feedback #19): the lesson waits for its
    // moment in play; until then the panel stays out of the
    // explorer's way. The frame loop surfaces it when `when` fires.
    panel.style.display = "none";
    updateObjective();
    return;
  }
  // When Emise teaches a tune, the slate is clean: notes noodled
  // during the earlier beats must not bleed into the taught chord
  // (a stray note would turn the bridge into some other place, and
  // the guided crossing — the thing the first minutes guarantee —
  // would silently not happen).
  if (step.id === "bridge" || step.id === "ashfall") {
    state.notes = [];
    clearTimeout(state.notesTimer);
    syncHud();
  }
  panel.style.display = "block";
  const beat = GUIDE_BEATS[step.id];
  if (beat && state.lastGuideBeat !== beat) {
    state.lastGuideBeat = beat;
    playBeat(beat);
  }
  $("guide-lines").innerHTML = step.lines.map((l) => `<p>${l}</p>`).join("");
  const btn = $("guide-btn");
  if (step.button) {
    btn.style.display = "inline-block";
    btn.textContent = step.button;
  } else {
    btn.style.display = "none";
  }
  $("guide-hint").textContent = step.hint || "";
  updateObjective();
}
function guideAdvance() {
  const leaving = guideCurrent();
  if (leaving && leaving.id === "handover") {
    state.exploreMoved0 = state.movedTotal; // the exploration clock starts
  }
  state.guideStep++;
  if (state.guideStep >= GUIDE.length) state.guideDone = true;
  renderGuide();
  syncHud();
}
function guideNotify(kind) {
  // Movement/jump are polled in the frame loop; discrete events land here.
  const step = guideCurrent();
  if (!step || !step.until) return;
  if (step.until()) guideAdvance();
}
function updateObjective() {
  const el = $("objective");
  if (sub.questDone) {
    el.textContent = "The map is yours now. Explore.";
    return;
  }
  const step = guideCurrent();
  if (state.guideDone || !step) {
    el.textContent = "Objective: the Deep Stone, east of Arrival";
    return;
  }
  el.textContent = "Objective: " + (
    step.id === "move" ? "walk, and jump once" :
    step.id === "handover" ? "explore — the map is yours" :
    step.id === "fight" ? "strike the pale wisp — click or F" :
    step.id === "numbers" ? "press a number — the instrument" :
    step.id === "bridge" ? "play the bridge tune: 1, 4, 9" :
    step.id === "ashfall" ? "play 1, 4, 9 to cross home" :
    step.id === "gravity" ? "press G — flip down upside down" :
    step.id === "gesture" ? "hold right mouse — draw a triangle" :
    step.id === "quest" ? "the Deep Stone, east of Arrival" :
    "listen to Emise");
}

// ---------- HUD -------------------------------------------------------------------

function drawPortrait() {
  const cv = $("portrait");
  const g = cv.getContext("2d");
  g.clearRect(0, 0, 72, 72);
  // A worn form IS the fox's face while it lasts (demo6): the
  // current animation frame, fitted into the portrait, standing
  // on its floor.
  if (typeof formState !== "undefined" && formState.text) {
    const fc = formCanvases(formState.text);
    if (fc && fc.frames.length) {
      const fcv = fc.frames[Math.min(formFrameIdx, fc.frames.length - 1)];
      g.fillStyle = "#0d1526";
      g.fillRect(0, 0, 72, 72);
      const sc = Math.min(72 / fcv.width, 72 / fcv.height);
      g.drawImage(fcv, (72 - fcv.width * sc) / 2, 72 - fcv.height * sc,
        fcv.width * sc, fcv.height * sc);
      return;
    }
  }
  // Fox face.
  g.fillStyle = "#2f7fe0";
  g.beginPath(); g.moveTo(14, 30); g.lineTo(24, 8); g.lineTo(34, 26); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(58, 30); g.lineTo(48, 8); g.lineTo(38, 26); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(36, 42, 22, 19, 0, 0, 7); g.fill();
  g.fillStyle = "#d8f1ff";
  g.beginPath(); g.ellipse(36, 52, 12, 9, 0, 0, 7); g.fill();
  g.fillStyle = "#04101e";
  g.beginPath(); g.ellipse(27, 40, 3, 4, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(45, 40, 3, 4, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(36, 50, 3.4, 2.6, 0, 0, 7); g.fill();
  if (sub.hatGranted) {
    g.fillStyle = "#00a3ff";
    g.fillRect(12, 20, 48, 6); // brim
    g.fillRect(22, 4, 28, 17); // crown
    g.fillStyle = "#005f8f";
    g.fillRect(22, 16, 28, 5); // band
  }
}
function syncHud() {
  // Hearts AND numbers: hit points, unmistakable.
  const heartsEl = $("hearts");
  let heartsHtml = "";
  for (let i = 0; i < 10; i++) {
    const v = state.hp - i * 2;
    heartsHtml += `<span class="heart ${v >= 2 ? "full" : v === 1 ? "half" : "empty"}">♥</span>`;
  }
  heartsEl.innerHTML = heartsHtml;
  $("hpnum").textContent = `HP ${Math.max(0, state.hp)} / ${state.maxHp}`;
  $("realmname").textContent = realmName(state.realm);
  $("realm-big").textContent = realmName(state.realm);
  $("chord").innerHTML =
    [0, 1, 2].map((i) =>
      `<span class="chordnote ${state.notes[i] ? "on" : ""}">${state.notes[i] ?? "·"}</span>`).join(" ");
  document.querySelectorAll(".notepad").forEach((el) => {
    const n = Number(el.dataset.note) + 1;
    el.classList.toggle("held", state.notes.includes(n));
  });
  $("hatbrim").style.display = sub.hatGranted ? "block" : "none";
  $("scoreline").textContent = `score ${totalScore(sub)} · best ${Math.max(standings.best, totalScore(sub))}`;
  const inv = [];
  if (state.weapon === "lance") inv.push("the Star Lance");
  if (state.charms.swift) inv.push("Swift Charm");
  if (state.charms.bright) inv.push("Bright Charm");
  if (state.charms.ward) inv.push(state.wardCharge > 0 ? "Ward Charm (ready)" : "Ward Charm (spent)");
  // The purse rides the inventory line: flux and credits are
  // carried things, and a generator's standing is worn openly.
  inv.push(`${eco.tokens} flux`);
  inv.push(`${eco.credits} credit${eco.credits === 1 ? "" : "s"}`);
  if (isGenerator(eco)) {
    inv.push(eco.entitlement.purchaseNumber
      ? `generator № ${eco.entitlement.purchaseNumber}`
      : "generator (number not yet written)");
  }
  const rungsHeld = Object.keys(eco.ladder).length;
  if (rungsHeld) inv.push(`${rungsHeld} ladder rung${rungsHeld === 1 ? "" : "s"}`);
  $("invline").textContent = inv.length ? "carrying: " + inv.join(" · ") : "";
  recordStandings();
  $("questline").textContent = sub.questDone
    ? "The Deep Stone — reached. The hat is yours."
    : "The Deep Stone waits in the barrow, east of Arrival.";
  drawPortrait();
  updateObjective();
}

// ---------- readout (demo instrumentation, not in-fiction) -------------------------

function syncReadout() {
  const { sx, sy } = playerScroll();
  const bx = Math.floor(state.pos.x), bz = Math.floor(state.pos.z);
  const density = sub.cellDensity(state.realm, cellOfBlock(bx), cellOfBlock(bz));
  const pressure = borderPressure(sub, state.realm,
    cellOfBlock(bx), cellOfBlock(bz), null);
  $("ro-kernel").textContent = kernels.usingWasm
    ? "WASM core live (hash / foam / Life in nova_core.wasm)"
    : "JS fallback kernels (WASM did not instantiate)";
  $("ro-where").textContent =
    `${state.realm} · scroll ${sx},${sy} · block ${bx},${Math.floor(state.pos.y)},${bz} · gravity ${state.gravDir > 0 ? "down" : "UP (inscribed)"}`;
  $("ro-phys").textContent =
    `tick ${sub.tickCount} · living cells here ${sub.totalLife()} (genesis ${sub.genesisLife ?? "—"}) · monster speed ${sub.monsterSpeed()} · Life density at feet ${density}/9 · neighbor pressure ${pressure.toFixed(2)}`;
  $("ro-wal").innerHTML = sub.wal.slice(-8)
    .map((s) => `#${s.seq} ${s.op} @ ${s.where} — ${s.detail}`)
    .join("<br>");
  $("ro-walcount").textContent = sub.wal.length;
}

// ---------- the board (leaderboard) -------------------------------------------
// Two views of one arithmetic (world.js computeScore): the all-time
// board and today's board. Rows shown as GLOBAL are only ever rows
// actually read back from the shared chart — when the chart-line is
// quiet, the panel says so and shows your own standings, which live
// in your inscription record on this machine.
function boardData() {
  const today = todayStr();
  const mine = { name: playerName + " (you)", score: totalScore(sub), date: today,
    daily: sub.dailyClaimed.has(today) };
  const global = [...BACKEND.boardRows];
  const byName = new Map();
  for (const r of global) {
    if (!byName.has(r.name) || r.score > byName.get(r.name).score) byName.set(r.name, r);
  }
  const allTime = [...byName.values()].sort((a, b) => b.score - a.score).slice(0, 12);
  const dailyRows = global.filter((r) => r.date === today && r.daily)
    .sort((a, b) => b.score - a.score).slice(0, 12);
  return { mine, allTime, dailyRows, today, daily: dailyPocket(today) };
}
function renderBoard() {
  const el = document.getElementById("board");
  if (!el || el.style.display === "none") return;
  const d = boardData();
  const row = (r, me) =>
    `<div class="realmrow ${me ? "here" : ""}"><span class="realmname2">${r.name}</span>` +
    `<span class="realmstatus">${r.score} pts${r.daily ? " · place of the day ✓" : ""}</span></div>`;
  const globalNote = BACKEND.online
    ? "read from the shared map just now"
    : `the shared map hasn't answered yet this session — no global scores to show. Your marks wait on this machine — ${marksNote()}`;
  $("board-alltime").innerHTML =
    (d.allTime.length ? d.allTime.map((r) => row(r, r.name === playerName)).join("")
      : `<div class="realmrow"><span class="realmstatus">no other foxes on the map yet</span></div>`) +
    row(d.mine, true);
  $("board-daily").innerHTML =
    `<div class="realmrow"><span class="realmname2">the place of the day</span>` +
    `<span class="realmstatus">tune ${d.daily.chord.join(", ")} from the home meadow</span></div>` +
    (d.dailyRows.length ? d.dailyRows.map((r) => row(r, r.name === playerName)).join("")
      : `<div class="realmrow"><span class="realmstatus">nobody has found the place of the day yet</span></div>`) +
    `<div class="realmrow ${d.mine.daily ? "here" : ""}"><span class="realmname2">${d.mine.name}</span>` +
    `<span class="realmstatus">${d.mine.daily ? "place of the day found ✓" : "place of the day not found yet"} · best ${standings.best} pts</span></div>`;
  $("board-note").textContent = globalNote;
  renderEco();
  renderFormPanel();
  renderSaveState();
}

// ---------- the purse panel: record, entitlement, faucets ----------------------
function renderEco() {
  const rec = document.getElementById("board-purchases");
  if (!rec) return;
  const rows = BACKEND.purchaseRows;
  const myNumber = isGenerator(eco) ? purchaseNumberFor(rows, playerName) : null;
  rec.innerHTML =
    (rows.length
      ? rows.map((r) =>
          `<div class="realmrow ${r.name === playerName ? "here" : ""}"><span class="realmname2">№ ${r.number} — ${r.name}</span>` +
          `<span class="realmstatus">${r.source === "gift" ? "gifted in" : "unlocked"} · ${r.ts ? new Date(r.ts).toLocaleDateString() : ""}</span></div>`).join("")
      : `<div class="realmrow"><span class="realmstatus">${BACKEND.online ? "no generator has been written yet" : "the shared map hasn't answered yet — the record waits with your marks"}</span></div>`) +
    (isGenerator(eco) && myNumber === null
      ? `<div class="realmrow here"><span class="realmname2">${playerName} (you)</span><span class="realmstatus">a generator — your claim is on its way to the record</span></div>`
      : "");
  const st = document.getElementById("eco-status");
  if (st) {
    st.textContent = isGenerator(eco)
      ? `You are a generator (${eco.entitlement.source === "gift" ? "gifted in" : "unlocked with a Gumroad key"})${myNumber ? ` — № ${myNumber} on the written record` : " — your number lands when the shared map reads your claim back"}. Your play spews flux for the world and earns credits.`
      : "You play free — the whole launch world is yours. An unlock key (a $6 Gumroad purchase, or a friend's 100-credit gift) makes you a generator: your play earns credits, and your name joins the written record.";
  }
  const bal = document.getElementById("eco-balances");
  if (bal) {
    bal.textContent =
      `purse: ${eco.tokens} flux · ${eco.credits} credit${eco.credits === 1 ? "" : "s"}` +
      (eco.poolSpewed ? ` · ${eco.poolSpewed} flux spewed for the world, not yet posted` : "") +
      (eco.pendingGiftKey ? " · a gift key is waiting for the shared map to answer" : "");
  }
  renderShop();
}

// One redemption path, two issuers (D2): the field takes either
// key, and the shape of the key says which door it came through.
async function redeemKeyFromField() {
  const field = document.getElementById("eco-key");
  const key = (field.value || "").trim();
  if (!key) { ecoNote("paste a key first — a Gumroad license key, or a gift key (NFG-…)."); return; }
  if (isGenerator(eco)) { ecoNote("you are already a generator — this key can go to a friend instead."); return; }
  if (isGiftKey(key)) {
    const res = redeemGiftKey(eco, key, BACKEND.ecoLedger);
    if (res.ok) {
      queueEcoLine(BACKEND.ecoCoord, giftRedeemedLine(res.hash, playerName, Date.now()));
      applyGiftRedemption(eco, key, Date.now());
      onBecameGenerator();
      field.value = "";
      ecoNote("the gift key is good — you are a generator now. Your claim is on its way to the written record.");
    } else if (res.pending) {
      eco.pendingGiftKey = key.toUpperCase();
      persistEco();
      field.value = "";
      ecoNote("the shared map hasn't answered yet, so the gift can't be checked. It's kept — it verifies itself on the first answer, and the game is whole meanwhile.");
      backendProbe().then(() => backendFlush());
    } else if (res.reason === "spent") {
      ecoNote("that gift key has already been spent — a gift opens one door, once.");
    } else {
      ecoNote("the shared map has no record of that gift key — it was never issued, or hasn't landed yet.");
    }
    return;
  }
  // A Gumroad key: verified against Gumroad's own license door.
  ecoNote("asking Gumroad about that key…");
  const res = await verifyGumroadKey(fetch.bind(window), key);
  if (res.ok) {
    applyGumroadVerification(eco, key, res, Date.now());
    onBecameGenerator();
    field.value = "";
    ecoNote("Gumroad says yes — you are a generator now. Your claim is on its way to the written record.");
  } else if (res.pending) {
    ecoNote("Gumroad can't be reached from here right now. The game is whole anyway — try the key again when there's a connection. (A key already verified on this machine stays verified.)");
  } else if (res.reason === "refunded") {
    ecoNote("that purchase was refunded or charged back, so its key no longer opens the door.");
  } else {
    ecoNote("Gumroad doesn't know that key for Nova Fox — check it for typos, straight from your receipt.");
  }
  renderBoard();
}

function buyGiftFromPanel() {
  const out = document.getElementById("gift-out");
  if (eco.credits < ECO_RATES.GIFT_PRICE_CREDITS) {
    ecoNote(`a gift costs ${ECO_RATES.GIFT_PRICE_CREDITS} credits — your purse holds ${eco.credits}.`);
    return;
  }
  const res = buyGift(eco, ecoRandomByte, playerName, Date.now());
  if (!res.ok) { ecoNote("the gift didn't go through — your credits are untouched."); return; }
  queueEcoLine(BACKEND.ecoCoord, res.line);
  persistEco();
  if (out) out.textContent = `your gift key: ${res.key}`;
  ecoNote("100 credits spent. Give that key to a friend — they paste it here, and they're a generator for life. The key itself is the gift; keep it somewhere safe until it's theirs.");
  syncHud();
  renderBoard();
  backendFlush();
}

function convertFromPanel() {
  const res = convertTokens(eco, 1);
  if (!res.converted) {
    ecoNote(`conversion turns ${ECO_RATES.CONVERSION_TOKENS_PER_CREDIT} flux into 1 credit — your purse holds ${eco.tokens} flux.`);
    return;
  }
  persistEco();
  ecoNote(`turned ${res.spent} flux into ${res.converted} credit. The flux is gone; the credit is yours.`);
  syncHud();
  renderBoard();
}

function handdownFromPanel() {
  const to = (document.getElementById("hand-name").value || "").trim();
  const amount = +document.getElementById("hand-amt").value;
  const id = `hd-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const res = sendHanddown(eco, id, playerName, to, amount, Date.now());
  if (!res.ok) {
    ecoNote(res.reason === "funds" ? `your purse holds ${eco.credits} credits — not enough for that hand-down.`
      : res.reason === "recipient" ? "name a friend's fox — not yourself, and not nobody."
      : "a hand-down is a whole number of credits, at least 1.");
    return;
  }
  queueEcoLine(BACKEND.ecoCoord, res.line);
  persistEco();
  ecoNote(`${Math.floor(amount)} credit${Math.floor(amount) === 1 ? "" : "s"} handed down to ${to} — it lands in their purse when the shared map carries it, and needs you signed in to travel.`);
  syncHud();
  renderBoard();
  backendFlush();
}
// ---------- the ladder shop (demo5): the finite sink ---------------------------
// The rungs on this build's shelf are Beat 1's (white/grey/green);
// Band 3 and the Apex stand below as what Christmas brings, priced
// in the open and not buyable — the ladder leads toward them the
// way it leads toward everything above it. A purchase is local and
// final the moment it lands (economy.js buyRung): credits out
// exactly once, the rung yours forever, in this save and its copies.
const LADDER_BAND_TITLES = {
  1: "Band 1 — Tools of the Path · trash (white) and common (grey)",
  2: "Band 2 — Realmcraft · uncommon (green)",
  3: "Band 3 — Dragonward · valuable (red) — at Christmas, with the dragon",
  4: "The Apex relics · rare (blue) — at Christmas, with the dragon",
};
function renderShop() {
  const el = document.getElementById("board-shop");
  if (!el) return;
  let html = "";
  for (const band of [1, 2, 3, 4]) {
    html += `<div class="sub" style="margin-top:10px">${LADDER_BAND_TITLES[band]}</div>`;
    for (const r of LADDER_RUNGS.filter((x) => x.band === band)) {
      const owned = ownsRung(eco, r.id);
      const locked = r.beat > LADDER_BEAT;
      const status = owned
        ? (eco.ladder[r.id].via === "granted" ? "granted — yours" : "yours")
        : r.granted
          ? "granted by the Deep Stone quest — not sold"
          : locked
            ? `${r.price} credits · not yet on the shelf`
            : r.requires && !ownsRung(eco, r.requires)
              ? `${r.price} credits · after ${rungById(r.requires).name}`
              : `${r.price} credits`;
      html +=
        `<div class="realmrow ${owned ? "here" : ""}"><span class="realmname2">${r.name}</span>` +
        `<span class="realmstatus">${r.effect}</span>` +
        `<span class="realmstatus">${status}</span>` +
        (!owned && !r.granted && !locked
          ? `<button class="ghost" data-rung="${r.id}">buy — ${r.price}</button>` : "") +
        `</div>`;
    }
  }
  const spent = eco.lifetime.ladderSpent;
  html += `<div class="sub" style="margin-top:8px">the ladder so far: ${Object.keys(eco.ladder).length} of ${LADDER_RUNGS.length} rungs yours` +
    (spent ? ` · ${spent} credits laid on it` : "") + `</div>`;
  el.innerHTML = html;
}
function buyRungFromPanel(id) {
  const res = buyRung(eco, id, Date.now());
  if (!res.ok) {
    const r = res.rung;
    ecoNote(
      res.reason === "funds" ? `${r.name} costs ${r.price} credits — your purse holds ${eco.credits}. Your credits are untouched.`
      : res.reason === "owned" ? `${r.name} is already yours — a rung is bought once, ever.`
      : res.reason === "requires" ? `${r.name} comes after ${res.missing.name} on the ladder — that rung first.`
      : res.reason === "beat" ? `${r.name} is not on this season's shelf — it comes at Christmas, with the dragon.`
      : res.reason === "granted" ? "the Deep Stone Hat is granted by the quest, not sold."
      : "that rung isn't on the ladder.");
    return;
  }
  persistEco();
  applyLamp();
  ecoNote(`${res.rung.name} is yours — ${res.rung.price} credits laid on the ladder. It stays in your save and its copies.`);
  syncHud();
  renderBoard();
}
function toggleBoard(force) {
  const el = $("board");
  const show = force !== undefined ? force : el.style.display !== "block";
  el.style.display = show ? "block" : "none";
  if (show) renderBoard();
}

// ---------- the telling door's panel (demo8) ------------------------------------
// The logic lives in ideas.js (pure, unit-tested); this glue owns
// the panel, the outbox, and the chart. Player text is rendered
// ONLY as text nodes — a telling is data, never markup, so no
// player's words can become a script surface. Copy stays under
// the veil: the world, the shared map, told / taken up / in the
// world — no machinery words in the fiction.
const IDEA_STATE_LABELS = {
  submitted: "told",
  picked: "taken up",
  shipped: "in the world",
};
function ideaStateText(idea) {
  const label = IDEA_STATE_LABELS[idea.status] || "told";
  return idea.status === "shipped" && idea.shipEE
    ? `${label} · EE ${idea.shipEE}` : label;
}
function ideaNote(msg) {
  const el = document.getElementById("idea-note");
  if (el) el.textContent = msg;
}
function ideaRowEl(nameText, titleText, stateText, here) {
  const row = document.createElement("div");
  row.className = "realmrow" + (here ? " here" : "");
  const nm = document.createElement("span");
  nm.className = "realmname2";
  nm.textContent = nameText;
  const tt = document.createElement("span");
  tt.className = "realmname2";
  tt.textContent = titleText;
  const st = document.createElement("span");
  st.className = "realmstatus";
  st.textContent = stateText;
  row.append(nm, tt, st);
  return row;
}
function ideaEmptyEl(text) {
  const row = document.createElement("div");
  row.className = "realmrow";
  const st = document.createElement("span");
  st.className = "realmstatus";
  st.textContent = text;
  row.append(st);
  return row;
}
function renderIdeas() {
  const el = document.getElementById("ideas");
  if (!el || el.style.display === "none") return;
  // The character count, honest about the caps.
  const title = $("idea-title").value || "";
  const body = $("idea-body").value || "";
  const count = $("idea-count");
  const over = [...title].length > IDEA_TITLE_MAX || [...body].length > IDEA_BODY_MAX;
  count.textContent =
    `a title of at most ${IDEA_TITLE_MAX} letters (yours: ${[...title].length}) · ` +
    `a telling of at most ${IDEA_BODY_MAX} (yours: ${[...body].length})`;
  count.className = over ? "over" : "";
  // Sign-in: only the write needs it — the same door the board uses.
  const signin = $("idea-signin");
  if (gameToken()) {
    signin.style.display = "none";
  } else {
    signin.style.display = "block";
    $("idea-signin-text").textContent = ideaOutbox.length
      ? "Your telling is waiting on this machine. Sign in, and it travels to the shared map — until then it is kept here, not lost."
      : "Tellings travel on the shared map, and writing there asks you to sign in — the same sign-in the board uses. An idea told while signed out waits on this machine and travels when you sign in.";
  }
  // Your ideas: the ones still waiting on this machine first
  // (labelled plainly as waiting here), then yours as read back.
  const yours = $("idea-yours");
  yours.replaceChildren();
  const readBackIds = new Set(BACKEND.ideaRows.map((r) => r.id));
  let shown = 0;
  for (const seg of ideaOutbox) {
    const idea = parseIdeaLine(seg.line);
    if (!idea || readBackIds.has(idea.id)) continue;
    yours.append(ideaRowEl(idea.name, idea.title, "waiting on this machine", true));
    shown++;
  }
  for (const idea of BACKEND.ideaRows) {
    if (idea.name !== playerName) continue;
    yours.append(ideaRowEl(idea.name, idea.title, ideaStateText(idea), true));
    shown++;
  }
  if (!shown) {
    yours.append(ideaEmptyEl(BACKEND.online
      ? "you haven't told the world anything yet"
      : "the shared map hasn't answered yet — your tellings wait with you"));
  }
  // Lately told: the latest 20 ideas the chart actually read back.
  const lately = $("idea-lately");
  lately.replaceChildren();
  const recent = BACKEND.ideaRows.slice(-20).reverse();
  if (!recent.length) {
    lately.append(ideaEmptyEl(BACKEND.online
      ? "no fox has told the world anything yet — yours could be the first"
      : "the shared map hasn't answered yet this session"));
  }
  for (const idea of recent) {
    lately.append(ideaRowEl(idea.name, idea.title, ideaStateText(idea),
      idea.name === playerName));
  }
}
function toggleIdeas(force) {
  const el = $("ideas");
  if (!el) return;
  const show = force !== undefined ? force : el.style.display !== "block";
  el.style.display = show ? "block" : "none";
  if (show) {
    renderIdeas();
    if (document.exitPointerLock) document.exitPointerLock();
  }
}
// One submit = one queued line = one insert when it flushes. A
// short cooldown keeps a double-tap from spending two.
let lastIdeaSubmitAt = 0;
function submitIdea(titleRaw, bodyRaw) {
  const title = String(titleRaw ?? "").trim();
  const body = String(bodyRaw ?? "").trim();
  const v = validateIdea(title, body);
  if (!v.ok) {
    ideaNote(
      v.reason === "title-cap" ? `a title can be at most ${IDEA_TITLE_MAX} letters — yours is ${v.count}. Shorten it; nothing was told.`
      : v.reason === "body-cap" ? `a telling can be at most ${IDEA_BODY_MAX} letters — yours is ${v.count}. Shorten it; nothing was told.`
      : v.reason === "title-empty" ? "give your idea a short name first — that's how the world will know it."
      : "say what you wish the world had, in the telling — an empty telling tells nothing.");
    return { ok: false, reason: v.reason };
  }
  const now = Date.now();
  if (now - lastIdeaSubmitAt < 3000) {
    ideaNote("one telling at a time — that one is already on its way.");
    return { ok: false, reason: "cooldown" };
  }
  // The id is checked against everything the chart has read back
  // and everything still queued here; a collision rolls again.
  const taken = new Set([
    ...BACKEND.ideaRows.map((r) => r.id),
    ...ideaOutbox.map((s) => { const p = parseIdeaLine(s.line); return p ? p.id : null; }),
  ]);
  let id = makeIdeaId(now, Math.random);
  for (let tries = 0; tries < 8 && taken.has(id); tries++) id = makeIdeaId(now, Math.random);
  if (taken.has(id)) {
    ideaNote("the door stumbled over its own names just now — try the telling again.");
    return { ok: false, reason: "id-collision" };
  }
  const line = serializeIdea({ id, name: playerName, ts: now, title, body });
  if (!line) {
    ideaNote("that telling couldn't be written down — nothing was told.");
    return { ok: false, reason: "serialize" };
  }
  queueIdeaLine(line);
  lastIdeaSubmitAt = now;
  ideaNote(gameToken()
    ? "your telling is on its way — it will stand as told once the shared map reads it back."
    : "your telling is kept on this machine. Sign in, and it travels to the shared map.");
  renderIdeas();
  backendProbe().then(() => backendFlush());
  return { ok: true, id };
}
function submitIdeaFromPanel() {
  const res = submitIdea($("idea-title").value, $("idea-body").value);
  if (res.ok) {
    $("idea-title").value = "";
    $("idea-body").value = "";
    renderIdeas();
  }
}
$("btn-idea-tell").addEventListener("click", () => submitIdeaFromPanel());
$("btn-idea-close").addEventListener("click", () => toggleIdeas(false));
$("btn-idea-login").addEventListener("click", () => {
  if (gameToken()) { ideaNote("you're signed in — your tellings travel as you make them."); return; }
  ideaNote("taking you to sign in — your telling stays on this machine and travels when you get back.");
  location.href = loginUrl();
});
$("btn-board-idea").addEventListener("click", () => toggleIdeas(true));
$("idea-title").addEventListener("input", () => renderIdeas());
$("idea-body").addEventListener("input", () => renderIdeas());

// ---------- player forms: the phext a fox wears (demo6) -------------------------
// The logic lives in forms.js (pure, unit-tested); this glue owns
// the state, the editor panel, the canvases, the in-world sprite,
// and the chart. The editor is a surface of this board — a player
// opens it, edits, previews, and wears the form without ever
// leaving the game.
const formState = loadFormState(LS.get("nova-phox-form", null));
function persistForm() { LS.set("nova-phox-form", formState); }

// The stage a form stands on: the ruled box (120 x 360 form
// units) centered in the leeway stage (box x ceiling scale).
const FORM_STAGE = {
  w: FORM_LIMITS.boxW * FORM_LIMITS.boxScaleCeiling,
  h: FORM_LIMITS.boxH * FORM_LIMITS.boxScaleCeiling,
};
const FORM_PX = 2; // canvas pixels per form unit

// Rasterize one compiled frame to its own canvas, at natural
// size. Frames are rasterized once and cached; the animation
// only ever swaps finished canvases, so a heavy form costs its
// price once, at apply time, never per step.
const formRasterCache = new Map();
function rasterizeFrame(frame, palette) {
  const b = frame.bounds || { x: 0, y: 0, w: 1, h: 1 };
  const w = Math.max(1, b.w), h = Math.max(1, b.h);
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.min(720, Math.round(w * FORM_PX)));
  cv.height = Math.max(1, Math.min(2160, Math.round(h * FORM_PX)));
  const sx = cv.width / w, sy = cv.height / h;
  const g = cv.getContext("2d");
  cv._ready = true;
  if (frame.type === "svg") {
    // The second wall of the no-script rule: sanitized in
    // forms.js on load, and drawn only ever as an <img> — a
    // context in which SVG cannot execute at all.
    cv._ready = false;
    const img = new Image();
    img.onload = () => {
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      cv._ready = true;
      refreshFormSurfaces();
    };
    img.onerror = () => { cv._ready = true; };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(frame.svg);
  } else if (frame.type === "bitmap") {
    const cell = FORM_LIMITS.bitmapCell;
    frame.rows.forEach((row, ri) => {
      for (let ci = 0; ci < row.length; ci++) {
        const ch = row[ci];
        if (ch === ".") continue;
        const pi = "0123456789abcdef".indexOf(ch);
        g.fillStyle = palette[pi] || "#ffffff";
        g.fillRect(ci * cell * sx, ri * cell * sy, Math.ceil(cell * sx), Math.ceil(cell * sy));
      }
    });
  } else if (frame.type === "turtle") {
    g.lineCap = "round";
    for (const s of frame.segments) {
      g.strokeStyle = s.color;
      g.lineWidth = Math.max(1, s.width * ((sx + sy) / 2));
      g.beginPath();
      g.moveTo((s.x1 - b.x) * sx, (b.y + b.h - s.y1) * sy);
      g.lineTo((s.x2 - b.x) * sx, (b.y + b.h - s.y2) * sy);
      g.stroke();
    }
  } else if (frame.type === "shapes") {
    for (const s of frame.shapes) {
      g.fillStyle = s.color;
      const X = (x) => (x - b.x) * sx, Y = (y) => (b.y + b.h - y) * sy;
      g.beginPath();
      if (s.kind === "circle") {
        g.ellipse(X(s.cx), Y(s.cy), s.r * sx, s.r * sy, 0, 0, 7);
      } else if (s.kind === "rect") {
        g.rect(X(s.x), Y(s.y + s.h), s.w * sx, s.h * sy);
      } else if (s.kind === "tri") {
        g.moveTo(X(s.pts[0]), Y(s.pts[1]));
        g.lineTo(X(s.pts[2]), Y(s.pts[3]));
        g.lineTo(X(s.pts[4]), Y(s.pts[5]));
        g.closePath();
      } else if (s.kind === "star") {
        const n = s.points;
        for (let i = 0; i < n * 2; i++) {
          const r = i % 2 === 0 ? s.r : s.r * 0.45;
          const a = (Math.PI / n) * i - Math.PI / 2;
          const px = X(s.cx) + Math.cos(a) * r * sx, py = Y(s.cy) + Math.sin(a) * r * sy;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
      }
      g.fill();
    }
  }
  return cv;
}
function formCanvases(text) {
  if (!text) return null;
  const key = fnv1a64hex(text);
  let hit = formRasterCache.get(key);
  if (hit) return hit;
  const parsed = parseForm(text);
  if (!parsed.ok) return null;
  hit = { parsed, frames: parsed.frames.map((f) => rasterizeFrame(f, parsed.palette)) };
  formRasterCache.set(key, hit);
  while (formRasterCache.size > 6) formRasterCache.delete(formRasterCache.keys().next().value);
  return hit;
}
function whenFormReady(fc) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    (function poll() {
      if (!fc || fc.frames.every((c) => c._ready) || Date.now() - t0 > 5000) resolve();
      else setTimeout(poll, 30);
    })();
  });
}
// Draw one frame canvas onto a stage canvas, standing on the
// stage floor, centered — the same stance in the preview, on
// the portrait, and in the world.
function drawFrameOnStage(g, frameCanvas) {
  const W = FORM_STAGE.w * FORM_PX, H = FORM_STAGE.h * FORM_PX;
  g.clearRect(0, 0, W, H);
  if (!frameCanvas) return;
  g.drawImage(frameCanvas, (W - frameCanvas.width) / 2, H - frameCanvas.height);
}

// The in-world body: a sprite at the fox's own position, sized
// as the leeway stage in world units (0.9 x 2.7 — the ruled box
// at 1.0, the leeway's edge at 1.5). It is the fox's appearance
// and nothing else: no collision, no physics, no verb reads it.
// This build is first-person, so the sprite stands aside
// whenever the fox's own eye is near (it never blocks the view);
// any other eye — a rift's far side, a future third person —
// sees the form standing where the fox stands.
let formSprite = null, formSpriteCanvas = null, formSpriteTex = null;
let formFrameIdx = 0, formAnimT = 0;
function ensureFormSprite() {
  if (formSprite) return;
  formSpriteCanvas = document.createElement("canvas");
  formSpriteCanvas.width = FORM_STAGE.w * FORM_PX;
  formSpriteCanvas.height = FORM_STAGE.h * FORM_PX;
  formSpriteTex = new THREE.CanvasTexture(formSpriteCanvas);
  formSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: formSpriteTex, transparent: true }));
  formSprite.scale.set(0.6 * FORM_LIMITS.boxScaleCeiling, 1.8 * FORM_LIMITS.boxScaleCeiling, 1);
  formSprite.visible = false;
  scene.add(formSprite);
}
function drawFormSpriteFrame(fc, idx) {
  ensureFormSprite();
  const g = formSpriteCanvas.getContext("2d");
  drawFrameOnStage(g, fc.frames[idx]);
  formSpriteTex.needsUpdate = true;
}
// Called from animate(): the worn form walks its neighborhood,
// and the sprite stands where the fox stands.
function formStep(dt) {
  if (!formState.text) {
    if (formSprite) formSprite.visible = false;
  } else {
    const fc = formCanvases(formState.text);
    if (fc) {
      formAnimT += dt * 1000;
      const idx = frameIndexAt(fc.parsed, formAnimT);
      ensureFormSprite();
      formSprite.position.set(
        state.pos.x,
        state.pos.y + (PHEIGHT / 2) * FORM_LIMITS.boxScaleCeiling * state.gravDir,
        state.pos.z);
      formSprite.material.rotation = state.gravDir < 0 ? Math.PI : 0;
      formSprite.visible = camera.position.distanceTo(formSprite.position) > 1.2;
      if (idx !== formFrameIdx) {
        formFrameIdx = idx;
        drawFormSpriteFrame(fc, idx);
        drawPortrait();
      }
    }
  }
  // The editor's preview walks too, while the board is open.
  const board = $("board");
  if (board && board.style.display !== "none" && formEdit.playing && formEdit.parsed && formEdit.parsed.ok) {
    formEdit.previewT += dt * 1000;
    const idx = frameIndexAt(formEdit.parsed, formEdit.previewT);
    if (idx !== formEdit.previewIdx) {
      formEdit.previewIdx = idx;
      drawFormPreview();
    }
  }
}
function refreshFormSurfaces() {
  if (formState.text) {
    const fc = formCanvases(formState.text);
    if (fc) { drawFormSpriteFrame(fc, formFrameIdx); drawPortrait(); }
  }
  const board = $("board");
  if (board && board.style.display !== "none") drawFormPreview();
}

// ---------- the form editor: this board's own surface ---------------------------
const formEdit = {
  init: false, lastGood: "", standing: null, parsed: null,
  page: 0, previewIdx: 0, previewT: 0, playing: true, paint: "6",
  gridSig: "",
};
function formNote(msg) {
  const el = document.getElementById("form-note");
  if (el) el.textContent = msg;
}
function scrollOffsets(text) {
  // Character offset of each scroll's first line, for seating
  // the cursor on a chosen page.
  const scrolls = splitScrolls(text);
  const lines = String(text).split("\n");
  const offs = [];
  let li = 0;
  for (const s of scrolls) {
    while (li < lines.length && lines[li].trim() !== s.coord) li++;
    let chars = 0;
    for (let i = 0; i < li; i++) chars += lines[i].length + 1;
    offs.push(chars);
    li++;
  }
  return offs;
}
function rebuildScroll(text, scrollIdx, newLines) {
  const scrolls = splitScrolls(text);
  if (scrollIdx < 0 || scrollIdx >= scrolls.length) return text;
  scrolls[scrollIdx].lines = newLines;
  return scrolls.map((s) => [s.coord, ...s.lines].join("\n")).join("\n\n") + "\n";
}
function formEditorRefresh() {
  const ta = $("form-text");
  if (!ta) return;
  const text = ta.value;
  const standing = formStanding(text);
  formEdit.standing = standing;
  formEdit.parsed = standing.parsed;
  // The meter: where the phext stands against both lines.
  const meter = $("form-meter");
  const L = FORM_LIMITS;
  meter.textContent =
    `${standing.bytes.toLocaleString()} bytes of phext — the ruled line is ${L.capBaselineBytes.toLocaleString()}, ` +
    `the leeway's ceiling ${L.capCeilingBytes.toLocaleString()}`;
  meter.className = standing.cap === "over" ? "over" : standing.cap === "leeway" ? "warn" : "";
  // The status: the first honest sentence about the form.
  const status = $("form-status");
  let msg = "", cls = "";
  if (!standing.parsed.ok) {
    msg = standing.parsed.errors[0] || "the phext doesn't parse yet";
    cls = "over";
  } else {
    const badFit = standing.fit.frames.find((f) => !f.fitsCeiling);
    if (badFit) {
      msg = `frame ${badFit.index + 1} (${badFit.coord}) spills past the box — it needs ${badFit.need.toFixed(2)}x the player's size, and the leeway ends at ${L.boxScaleCeiling}x`;
      cls = "over";
    } else if (standing.leeway) {
      const bits = [];
      if (standing.cap === "leeway") bits.push("more phext than the ruled 4 KB");
      if (standing.fit.leeway) bits.push("a frame standing larger than your body");
      msg = `inside the leeway: ${bits.join(" and ")} — the leeway holds it, for now`;
      cls = "warn";
    } else {
      msg = "this form stands inside the ruled lines";
    }
  }
  status.textContent = msg;
  status.className = cls;
  $("btn-form-apply").disabled = standing.refused;
  renderFormPages();
  renderFormBitmapTools();
  drawFormPreview();
  renderFormChart();
}
function renderFormPages() {
  const wrap = $("form-pages");
  if (!wrap || !formEdit.parsed) return;
  const scrolls = splitScrolls($("form-text").value);
  formEdit.page = Math.min(formEdit.page, Math.max(0, scrolls.length - 1));
  wrap.innerHTML = scrolls.map((s, i) => {
    const label = i === 0 ? "head" : `frame ${i} — ${(formEdit.parsed.frames[i - 1] || {}).type || "?"}`;
    return `<button class="ghost form-pagebtn ${i === formEdit.page ? "sel" : ""}" data-form-page="${i}">${label} · ${s.coord.split("/")[2]}</button>`;
  }).join("");
  const sel = $("form-type");
  const frame = formEdit.parsed.frames[formEdit.page - 1];
  if (sel) {
    sel.disabled = formEdit.page === 0;
    if (frame && frame.type) sel.value = frame.type;
  }
}
function selectedBitmapFrame() {
  if (formEdit.page === 0 || !formEdit.parsed) return null;
  const f = formEdit.parsed.frames[formEdit.page - 1];
  return f && f.type === "bitmap" ? f : null;
}
function renderFormBitmapTools() {
  const tools = $("form-bitmap-tools");
  if (!tools) return;
  const frame = selectedBitmapFrame();
  if (!frame) { tools.style.display = "none"; formEdit.gridSig = ""; return; }
  tools.style.display = "block";
  const pal = $("form-palette");
  pal.innerHTML = [".", ..."0123456789abcdef"].map((k) => {
    const color = k === "." ? "transparent" : formEdit.parsed.palette["0123456789abcdef".indexOf(k)];
    return `<button class="swatch ${formEdit.paint === k ? "sel" : ""}" data-form-paint="${k}" title="${k === "." ? "clear" : k}" style="background:${color}"></button>`;
  }).join("");
  const sig = `${frame.coord}|${frame.cols}|${frame.rowCount}`;
  if (sig === formEdit.gridSig) return;
  formEdit.gridSig = sig;
  const grid = $("form-grid");
  grid.style.gridTemplateColumns = `repeat(${frame.cols}, 15px)`;
  grid.innerHTML = frame.rows.map((row, ri) =>
    [...row].map((ch, ci) => {
      const color = ch === "." ? "rgba(20,32,54,0.6)" : formEdit.parsed.palette["0123456789abcdef".indexOf(ch)];
      return `<button class="cell" data-form-cell="${ri}:${ci}" style="background:${color}"></button>`;
    }).join("")).join("");
}
function drawFormPreview() {
  const cv = $("form-preview");
  if (!cv) return;
  const g = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#050b16";
  g.fillRect(0, 0, W, H);
  // The leeway stage edge, dashed amber; the ruled box, solid.
  g.strokeStyle = "rgba(255,184,77,0.55)";
  g.setLineDash([8, 6]);
  g.strokeRect(1, 1, W - 2, H - 2);
  g.setLineDash([]);
  const bw = FORM_LIMITS.boxW * FORM_PX, bh = FORM_LIMITS.boxH * FORM_PX;
  g.strokeStyle = "rgba(0,217,255,0.8)";
  g.strokeRect((W - bw) / 2, H - bh, bw, bh);
  const text = $("form-text").value;
  const fc = formCanvases(text);
  const line = $("form-frame-line");
  if (fc && fc.frames.length) {
    const idx = Math.min(formEdit.previewIdx, fc.frames.length - 1);
    drawFrameOnStage(g, fc.frames[idx]);
    const f = fc.parsed.frames[idx];
    const need = frameNeed(f);
    if (line) line.textContent =
      `frame ${idx + 1} of ${fc.frames.length} — ${f.type} — ${f.coord}` +
      (need > 1 ? ` — standing at ${need.toFixed(2)}x your size (the leeway)` : "");
  } else if (line) {
    line.textContent = formEdit.parsed && !formEdit.parsed.ok
      ? "the preview waits for a phext that parses" : "";
  }
}
function renderFormChart() {
  const el = $("form-chart");
  if (!el) return;
  const rows = BACKEND.formRows;
  if (!rows || !rows.size) {
    el.innerHTML = `<div class="sub">${BACKEND.online
      ? "no fox has worn a form onto the record yet"
      : "the shared map hasn't answered yet — forms on the record wait with your marks"}</div>`;
    return;
  }
  const reason = (entry) => {
    if (!entry.standing) return "";
    if (entry.standing.cap === "over") return "past even the leeway's cap — not rendered";
    if (!entry.standing.parsed.ok) return "doesn't parse — not rendered";
    if (!entry.standing.fit.ok) return "a frame doesn't fit the box — not rendered";
    return "";
  };
  el.innerHTML = `<h3>Forms on the record</h3>` + [...rows.values()]
    .sort((a, b) => a.ts - b.ts)
    .map((e) => `<div class="realmrow ${e.name === playerName ? "here" : ""}"><span class="realmname2">${e.name}</span>` +
      `<span class="realmstatus">${e.text === null ? "wearing no form"
        : e.refused ? reason(e)
        : `wearing "${(e.standing.parsed.name || "a form")}" — ${e.standing.parsed.frames.length} frame${e.standing.parsed.frames.length === 1 ? "" : "s"}`}</span></div>`)
    .join("");
}
function renderFormPanel() {
  const ta = $("form-text");
  if (!ta) return;
  if (!formEdit.init) {
    formEdit.init = true;
    ta.value = formState.text || FORM_EXAMPLES.svg;
    formEdit.lastGood = ta.value;
  }
  formEditorRefresh();
}
function formPublish(text, ts) {
  queueEcoLine(BACKEND.formCoord, formChartLine(playerName, text, ts));
  formState.publishedAt = ts;
  persistForm();
}
// The editor's events. The textarea is the one source of truth;
// every structural button rewrites it and lets the refresh say
// what the rewrite means.
{
  const ta = $("form-text");
  if (ta) {
    ta.addEventListener("input", () => {
      // The hard stop: the editor will not hold more phext
      // than the ceiling, whatever is pasted at it.
      if (formByteLength(ta.value) > FORM_LIMITS.capCeilingBytes) {
        ta.value = formEdit.lastGood;
        formNote(`too much phext — the editor stops at ${FORM_LIMITS.capCeilingBytes.toLocaleString()} bytes, and that paste didn't land`);
      } else {
        formEdit.lastGood = ta.value;
      }
      formEdit.previewT = 0;
      formEditorRefresh();
    });
    $("btn-form-apply").addEventListener("click", () => {
      const text = ta.value;
      const r = applyForm(formState, text, Date.now());
      if (!r.ok) {
        formNote(r.reason === "cap" ? "too much phext — past even the leeway's ceiling"
          : r.reason === "fit" ? "a frame spills past the box — the preview names it"
          : "the phext doesn't parse yet — the line above says where");
        return;
      }
      persistForm();
      formPublish(text, formState.appliedAt);
      formAnimT = 0; formFrameIdx = 0;
      refreshFormSurfaces();
      formNote(r.standing.leeway
        ? "you're wearing it — inside the leeway, and on its way to the shared map, where it's your public shape"
        : "you're wearing it — and it's on its way to the shared map, where it's your public shape");
      renderFormChart();
    });
    $("btn-form-clear").addEventListener("click", () => {
      clearForm(formState);
      persistForm();
      queueEcoLine(BACKEND.formCoord, formOffLine(playerName, Date.now()));
      if (formSprite) formSprite.visible = false;
      drawPortrait();
      formNote("form off — you're the fox again. The record will say so when the map reads it back.");
      renderFormChart();
    });
    $("form-pages").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-form-page]");
      if (!btn) return;
      formEdit.page = +btn.dataset.formPage;
      formEdit.gridSig = "";
      const offs = scrollOffsets(ta.value);
      if (offs[formEdit.page] !== undefined) {
        ta.focus();
        ta.setSelectionRange(offs[formEdit.page], offs[formEdit.page]);
      }
      formEditorRefresh();
    });
    $("form-type").addEventListener("change", (ev) => {
      if (formEdit.page === 0) return;
      const type = ev.target.value;
      ta.value = rebuildScroll(ta.value, formEdit.page,
        FORM_PAGE_STARTERS[type].split("\n"));
      formEdit.lastGood = ta.value;
      formEdit.gridSig = "";
      formEditorRefresh();
      formNote(`this page is a ${type} page now — it starts from the ${type} starter; make it yours`);
    });
    $("btn-form-addpage").addEventListener("click", () => {
      const scrolls = splitScrolls(ta.value);
      if (!scrolls.length) {
        formNote("the form needs its head first — start from one of the starter forms below");
        return;
      }
      const type = $("form-type").value || "svg";
      const headParts = scrolls[0].parts.slice();
      let maxSc = 1;
      for (const s of scrolls) maxSc = Math.max(maxSc, s.parts[8]);
      headParts[8] = maxSc + 1;
      const coord = `${headParts[0]}.${headParts[1]}.${headParts[2]}/${headParts[3]}.${headParts[4]}.${headParts[5]}/${headParts[6]}.${headParts[7]}.${headParts[8]}`;
      const next = ta.value.replace(/\s+$/, "") + `\n\n${coord}\n${FORM_PAGE_STARTERS[type]}\n`;
      if (formByteLength(next) > FORM_LIMITS.capCeilingBytes) {
        formNote("no room for another page — the ceiling is the ceiling");
        return;
      }
      ta.value = next;
      formEdit.lastGood = ta.value;
      formEdit.page = scrolls.length;
      formEdit.gridSig = "";
      formEditorRefresh();
    });
    document.querySelectorAll("[data-form-example]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ta.value = FORM_EXAMPLES[btn.dataset.formExample];
        formEdit.lastGood = ta.value;
        formEdit.page = 0;
        formEdit.gridSig = "";
        formEdit.previewT = 0;
        formEditorRefresh();
        formNote("a starter form — edit it, break it, wear it");
      });
    });
    $("btn-form-play").addEventListener("click", (ev) => {
      formEdit.playing = !formEdit.playing;
      ev.target.textContent = formEdit.playing ? "pause" : "play";
    });
    $("btn-form-prev").addEventListener("click", () => {
      if (!formEdit.parsed || !formEdit.parsed.ok) return;
      const n = formEdit.parsed.frames.length;
      formEdit.previewIdx = (formEdit.previewIdx + n - 1) % n;
      formEdit.previewT = formEdit.previewIdx * formEdit.parsed.stepMs;
      drawFormPreview();
    });
    $("btn-form-next").addEventListener("click", () => {
      if (!formEdit.parsed || !formEdit.parsed.ok) return;
      const n = formEdit.parsed.frames.length;
      formEdit.previewIdx = (formEdit.previewIdx + 1) % n;
      formEdit.previewT = formEdit.previewIdx * formEdit.parsed.stepMs;
      drawFormPreview();
    });
    $("form-palette").addEventListener("click", (ev) => {
      const sw = ev.target.closest("[data-form-paint]");
      if (sw) { formEdit.paint = sw.dataset.formPaint; renderFormBitmapTools(); }
    });
    let painting = false;
    const paintCell = (cellBtn) => {
      const frame = selectedBitmapFrame();
      if (!frame || !cellBtn) return;
      const [ri, ci] = cellBtn.dataset.formCell.split(":").map(Number);
      const rows = frame.rows.map((r) => [...r]);
      while (rows[ri].length <= ci) rows[ri].push(".");
      rows[ri][ci] = formEdit.paint;
      const scrolls = splitScrolls(ta.value);
      const typeLine = scrolls[formEdit.page].lines.findIndex((l) => /^\s*type\s*:/i.test(l));
      const head = scrolls[formEdit.page].lines.slice(0, typeLine + 1);
      ta.value = rebuildScroll(ta.value, formEdit.page,
        [...head, ...rows.map((r) => r.join(""))]);
      formEdit.lastGood = ta.value;
      cellBtn.style.background = formEdit.paint === "."
        ? "rgba(20,32,54,0.6)"
        : formEdit.parsed.palette["0123456789abcdef".indexOf(formEdit.paint)];
      formEditorRefresh();
    };
    $("form-grid").addEventListener("mousedown", (ev) => {
      const cell = ev.target.closest("[data-form-cell]");
      if (cell) { painting = true; paintCell(cell); }
    });
    $("form-grid").addEventListener("mouseover", (ev) => {
      if (painting) paintCell(ev.target.closest("[data-form-cell]"));
    });
    document.addEventListener("mouseup", () => { painting = false; });
  }
}

// ---------- saving: two doors (Will, 2026-11-22 18:05) -----------------------
// Exactly two ways to save, and playing needs neither:
//  (a) log in to save your game — marks land on the shared chart
//      at phext.tech under your phext.tech login;
//  (b) save a copy locally — a file you keep; no account, no line.
// What lives on this machine either way: your name, your record
// (best score, daily pages), and every mark still queued for the
// chart. A copy carries exactly those. The current run's world is
// a session (v3's standing simplification) — as on any reload, a
// fresh visit starts a fresh run with your record intact.
function saveFileContents() {
  return JSON.stringify({
    kind: "nova-phox-save", version: 3, exportedAt: new Date().toISOString(),
    name: playerName, standings, outbox: [...outbox],
    // v5: the fold and the drop count ride in the copy too — a copy
    // is the whole queue, not just its front (UPDATE-CHECK-1).
    folded: [...outboxFolded], dropped: outboxDropped,
    posted: BACKEND.lastPostedScore,
    // v3 (demo4): the purse rides too — ledgers, entitlement, and
    // the economy queue are part of the player's record now.
    economy: eco, ecoOutbox: [...ecoOutbox],
    // demo6: the worn form's phext rides in the copy too — a
    // form is part of the player's record, and a copy restores it.
    form: formState,
    // demo8: tellings still waiting on this machine ride too —
    // a waiting idea is part of the player's record, like a mark.
    ideaOutbox: [...ideaOutbox],
  }, null, 2);
}
function downloadLocalSave() {
  const blob = new Blob([saveFileContents()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nova-phox-save-${todayStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  saveNote("Saved. The copy holds your name, your record, your purse, and every waiting mark. You can load it from this panel on any machine.");
}
function loadLocalSave(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.kind !== "nova-phox-save" || !data.standings || !Array.isArray(data.outbox)) {
        throw new Error("not a nova-phox save");
      }
      LS.set("nova-phox-name", data.name || playerName);
      LS.set("nova-phox-standings", data.standings);
      LS.set("nova-phox-outbox", data.outbox);
      LS.set("nova-phox-outbox-folded", Array.isArray(data.folded) ? data.folded : []);
      LS.set("nova-phox-outbox-dropped", Number.isFinite(data.dropped) ? data.dropped : 0);
      LS.set("nova-phox-posted", Number.isFinite(data.posted) ? data.posted : -1);
      // v3 copies carry the purse; a v2 copy simply starts one fresh.
      if (data.economy) LS.set("nova-phox-economy", loadEconomyState(data.economy));
      LS.set("nova-phox-eco-outbox", Array.isArray(data.ecoOutbox) ? data.ecoOutbox : []);
      // A copy's form passes the loader's gate before it is
      // worn: over the ceiling, unparseable, or unfit, and the
      // copy simply carries no form (v2/v3-era copies predate it).
      LS.set("nova-phox-form", loadFormState(data.form || null));
      LS.set("nova-phox-idea-outbox", Array.isArray(data.ideaOutbox) ? data.ideaOutbox : []);
      location.reload();
    } catch (e) {
      saveNote("that file is not a Nova Phox save copy — nothing was loaded.");
    }
  };
  reader.readAsText(file);
}
function saveNote(msg) {
  const el = document.getElementById("save-note");
  if (el) el.textContent = msg;
}
function renderSaveState() {
  const el = document.getElementById("save-state");
  if (!el) return;
  const btn = document.getElementById("btn-login-save");
  if (!BACKEND.online) {
    el.textContent = "No connection right now: your record and your waiting marks live on this machine. Saving a copy locally keeps them safe.";
    if (btn) btn.textContent = "log in to save your game (needs a connection)";
  } else if (gameToken()) {
    el.textContent = "You're signed in: your marks save to the shared map as you make them.";
    if (btn) btn.textContent = "signed in — saving is on";
  } else {
    el.textContent = `You're not signed in: your marks are waiting on this machine — ${marksNote()}. Sign in to save them to the shared map, or save a copy locally.`;
    if (btn) btn.textContent = "log in to save your game";
  }
}

// ---------- realms panel -----------------------------------------------------------------

function renderRealms() {
  $("realms-list").innerHTML = REALMS.map((r) => {
    const here = r.id === state.realm;
    const status = here ? "you are here" : r.open ? "open — the bridge tune goes there" : "named, but not open yet";
    return `<div class="realmrow ${here ? "here" : ""} ${r.open ? "" : "shut"}">
      <span class="realmname2">${r.name}</span><span class="realmstatus">${status}</span></div>`;
  }).join("");
}
function toggleRealms(force) {
  const el = $("realms");
  const show = force !== undefined ? force : el.style.display !== "block";
  el.style.display = show ? "block" : "none";
  if (show) renderRealms();
}

// ---------- the load panel (feedback #15) --------------------------------------
// First thing on the page: the phext logo panel. The game boots
// behind it; any click or key steps it aside — the bypass is the
// whole interaction, no timer, no trap.
function dismissSplash() {
  if (!state.splash) return;
  state.splash = false;
  const el = $("splash");
  if (el) el.style.display = "none";
}
window.__splashDismiss = dismissSplash;

// ---------- input ---------------------------------------------------------------------------

let pointerLocked = false;
function lockPointer() {
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (e) { /* pointer lock unavailable (headless); keys still play */ }
}
document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});
document.addEventListener("mousemove", (e) => {
  if (state.flute) {
    // The spectral flute (v5, feedback #6): drag distance becomes
    // pitch — drag up to climb the eleven notes, and every note
    // sounds through playNote, so a dragged tune travels exactly
    // like a keyed one.
    const dy = pointerLocked ? (e.movementY || 0) : (e.clientY - state.flute.lastClientY);
    state.flute.lastClientY = e.clientY;
    state.flute.travel += dy;
    const band = Math.max(1, Math.min(11, 1 + Math.round(-state.flute.travel / 26)));
    if (band !== state.flute.band) {
      state.flute.band = band;
      playNote(band);
    }
  }
  if (!pointerLocked) return;
  state.yaw -= e.movementX * 0.0023 * state.gravDir;
  state.pitch -= e.movementY * 0.0023 * state.gravDir;
  state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch));
});
document.addEventListener("mousedown", (e) => {
  sfx.unlock();
  if (state.splash) { dismissSplash(); return; }
  if (e.button === 2) { gestureBegin(e); return; }
  if (e.button === 0 && e.shiftKey && e.target === renderer.domElement) {
    state.flute = { travel: 0, lastClientY: e.clientY, band: null };
    return;
  }
  if (e.target === renderer.domElement) {
    if (!pointerLocked) {
      lockPointer();
    } else if (e.button === 0) {
      // A click does what the moment asks (v5, feedback #3): the
      // memory screen if that is what you are looking at, a strike
      // if a thing of the dark is in reach — and otherwise the
      // chisel, so shaping is one click away like everything else.
      if (introScreenAimed()) { openIntroViewer(); return; }
      if (tellingDoorAimed()) { toggleIdeas(true); return; }
      if (!tryStrike()) tryChisel();
    }
  }
});
document.addEventListener("mouseup", (e) => {
  if (e.button === 0) state.flute = null;
});
document.addEventListener("contextmenu", (e) => {
  if (e.target === renderer.domElement) e.preventDefault();
});

// ---------- mouse gestures: the second instrument (feedback #5) ---------------
// Hold the right mouse button and draw. Three shapes, taught by the
// guide, deliberately coarse so a shaky hand still lands them:
//   triangle -> the bridge tune (cross, or cross home)
//   circle   -> home to Arrival, from anywhere on the page
//   diamond  -> a far page (a chord drawn from the stroke itself)
// Classification is by closedness + corner count on the normalized
// path — a $1-style recognizer reduced to what these three need.
const gesture = { active: false, pts: [], acc: { x: 0, y: 0 } };
function gestureBegin(e) {
  gesture.active = true;
  gesture.pts = [pointerLocked ? { x: 0, y: 0 } : { x: e.clientX, y: e.clientY }];
  gesture.acc = { x: 0, y: 0 };
}
document.addEventListener("mousemove", (e) => {
  if (!gesture.active) return;
  let x, y;
  if (pointerLocked) {
    gesture.acc.x += e.movementX || 0;
    gesture.acc.y += e.movementY || 0;
    x = gesture.acc.x; y = gesture.acc.y;
  } else {
    x = e.clientX; y = e.clientY;
  }
  const last = gesture.pts[gesture.pts.length - 1];
  if (!last || Math.hypot(x - last.x, y - last.y) > 5) gesture.pts.push({ x, y });
});
document.addEventListener("mouseup", (e) => {
  if (e.button !== 2 || !gesture.active) return;
  gesture.active = false;
  const shape = classifyStroke(gesture.pts);
  gesture.pts = [];
  if (!shape) return;
  resolveGestureShape(shape);
});
// What a drawn shape DOES — one path for the right mouse and for
// the touch draw (2026-11-26), so a shape means the same thing
// however it was drawn.
function resolveGestureShape(shape) {
  state.gestureUsed = true;
  if (shape === "triangle") {
    toast("You drew the bridge tune: 1, 4, 9.", 4000);
    playChord([...BRIDGE_CHORD]);
  } else if (shape === "circle") {
    sfx.portal();
    flashPortal();
    sub.log("gesture", realmName(state.realm), "a circle drawn — home to Arrival");
    respawnAtArrival();
    toast("The circle carries you home to Arrival.", 4000);
  } else if (shape === "diamond") {
    // A chord drawn from the stroke: its own length seeds the tune,
    // so the same drawing tends to find the same page.
    let h = 0;
    for (const pt of gesture._raw || []) h = (h * 31 + ((pt.x | 0) * 7 + (pt.y | 0))) >>> 0;
    const notes = new Set();
    let k = h || 12345;
    while (notes.size < 3) { notes.add(((k >>> 0) % 11) + 1); k = (k >>> 3) + 7; }
    toast("You drew a diamond — a far-off place answers.", 4000);
    playChord([...notes].sort((a, b) => a - b));
  }
  guideNotify("gesture");
  syncHud();
}
function classifyStroke(pts) {
  if (!pts || pts.length < 6) return null;
  gesture._raw = pts;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, len = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    if (i) len += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
  }
  const w = maxX - minX, h = maxY - minY;
  if (Math.max(w, h) < 40 || len < 120) return null; // too small to mean it
  const gap = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
  const closed = gap < 0.3 * Math.max(w, h) + 18;
  if (!closed) return null;
  // Corners: walk the path in strides — INCLUDING the closing
  // segment back to the start, since a closed shape's first vertex
  // is a corner too — and count sharp direction changes, with a
  // one-step refractory so a shaky vertex counts once. A circle's
  // turning is spread thin (no single stride turns sharply); a
  // triangle turns hard exactly 3 times; a diamond, 4.
  const path = [...pts, pts[0]];
  let corners = 0;
  const stride = Math.max(1, Math.floor(path.length / 28));
  let prevDir = null, refractory = 0;
  for (let i = stride; i < path.length; i += stride) {
    const a = path[i - stride], b = path[i];
    const dir = Math.atan2(b.y - a.y, b.x - a.x);
    if (prevDir !== null) {
      let d = Math.abs(dir - prevDir);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d > 0.8 && refractory === 0) { corners++; refractory = 1; }
      else if (refractory > 0) refractory--;
    }
    prevDir = dir;
  }
  if (corners <= 2) return "circle";
  if (corners === 3) return "triangle";
  return "diamond";
}
// The jump, one verb for every input path (Space, the touch
// button) — the guide's until() hears it the same way either way.
function doJump() {
  if (state.onGround && !state.dead) {
    state.vel.y = 8.8 * state.gravDir;
    state.onGround = false;
    state.jumped++;
    sfx.jump();
    guideNotify("jump");
  }
}
document.addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) {
    e.preventDefault();
  }
  // Typing in the telling door's fields is typing: no game verb
  // fires from inside them (a title with an "i" in it must not
  // shut the door it is being written at).
  if (e.target && (e.target.id === "idea-title" || e.target.id === "idea-body")) {
    if (e.code === "Escape") e.target.blur();
    return;
  }
  if (state.splash) { dismissSplash(); return; } // any key steps the panel aside (#15)
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === "ArrowLeft") state.yaw += 0.32 * state.gravDir;
  if (e.code === "ArrowRight") state.yaw -= 0.32 * state.gravDir;
  if (e.code in NUMBER_KEYS) return playNote(NUMBER_KEYS[e.code]);
  if (e.code === "KeyW") {
    // W walks. It is also note 2 on the letter row — a quick TAP
    // (not a stride) sounds it; see the keyup handler.
    wTap = { t: performance.now(), x: state.pos.x, z: state.pos.z };
    return;
  }
  // In the AWEF scheme, E is a walking key, not a note (feedback #5).
  if (state.scheme === "AWEF" && e.code === "KeyE") return;
  // The telling door (demo8): I opens it from anywhere. (The
  // letter row's note 8 keeps its number-row key, Digit8.)
  if (e.code === "KeyI") { toggleIdeas(); return; }
  const li = LETTER_KEYS.indexOf(e.code);
  if (li >= 0) return playNote(li + 1);
  switch (e.code) {
    case "Space": doJump(); break;
    case "KeyG": flipGravityHere(); break;
    case "KeyF":
      // In AWEF, F walks backward — the strike lives on the click.
      if (state.scheme !== "AWEF") tryStrike();
      break;
    case "KeyC": case "KeyX": tryChisel(); break;
    case "Comma": cycleBrush(-1); break;
    case "Period": cycleBrush(1); break;
    case "KeyV": toggleLamp(); break;
    case "Escape":
      if (state.introOpen) closeIntroViewer();
      if ($("ideas").style.display === "block") toggleIdeas(false);
      break;
    case "KeyB": toggleBoard(); break;
    case "KeyM": case "Tab": toggleRealms(); break;
    case "KeyL": {
      const el = $("readout");
      el.style.display = el.style.display === "none" ? "block" : "none";
      break;
    }
  }
});
let wTap = null;
document.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "KeyW" && wTap) {
    const held = performance.now() - wTap.t;
    const dist = Math.hypot(state.pos.x - wTap.x, state.pos.z - wTap.z);
    wTap = null;
    if (held < 200 && dist < 0.5) playNote(2);
  }
});
document.querySelectorAll(".notepad").forEach((el) => {
  el.addEventListener("click", () => playNote(Number(el.dataset.note) + 1));
});
$("btn-realms").addEventListener("click", () => toggleRealms());
$("btn-board").addEventListener("click", () => toggleBoard());
$("btn-login-save").addEventListener("click", () => {
  if (gameToken()) { saveNote("you're signed in — your marks save to the shared map as you make them."); return; }
  saveNote("taking you to sign in — your record and waiting marks stay on this machine and save when you get back.");
  location.href = loginUrl();
});
$("btn-save-local").addEventListener("click", () => downloadLocalSave());
$("btn-redeem").addEventListener("click", () => redeemKeyFromField());
$("btn-buy-gift").addEventListener("click", () => buyGiftFromPanel());
$("btn-convert").addEventListener("click", () => convertFromPanel());
$("btn-handdown").addEventListener("click", () => handdownFromPanel());
$("board-shop").addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-rung]");
  if (b) buyRungFromPanel(b.dataset.rung);
});
$("btn-load-local").addEventListener("click", () => $("file-load-local").click());
$("file-load-local").addEventListener("change", (e) => {
  if (e.target.files && e.target.files[0]) loadLocalSave(e.target.files[0]);
});
$("btn-guide").addEventListener("click", () => {
  if (state.guideDone) { state.guideDone = false; state.guideStep = GUIDE.length - 2; }
  renderGuide();
});
$("btn-sound").addEventListener("click", (e) => {
  sfx.muted = !sfx.muted;
  if (sfx.master) sfx.master.gain.value = sfx.muted ? 0 : 0.9;
  if (sfx.muted) narration.stop(); // sound off means the voice too
  e.target.textContent = sfx.muted ? "sound: off" : "sound: on";
});
$("btn-extras").textContent = state.extras ? "extras: on" : "extras: off";
$("btn-extras").addEventListener("click", (e) => {
  state.extras = !state.extras;
  document.body.classList.toggle("extras", state.extras);
  saveCtlPrefs();
  e.target.textContent = state.extras ? "extras: on" : "extras: off";
});
$("btn-log").addEventListener("click", () => {
  const el = $("readout");
  el.style.display = el.style.display === "none" ? "block" : "none";
});
$("btn-keys").textContent = `keys: ${state.scheme}`;
$("btn-keys").addEventListener("click", () => {
  state.scheme = state.scheme === "WASD" ? "AWEF" : "WASD";
  saveCtlPrefs();
  $("btn-keys").textContent = `keys: ${state.scheme}`;
  toast(state.scheme === "AWEF"
    ? "Keys: A W E F — F walks backward in this scheme, so strike with the click."
    : "Keys: W A S D.", 4000);
});
// The version, as hover text (2026-11-26): the standing realm
// title carries the ship stamp. A mouse resting on the title fades
// the stamp in beneath it, in the game's own floating dress; on
// touch, a tap on the title toggles it (the tap is claimed here,
// so it never falls through to the world's tap-as-click). The
// title rides the extras toggle like the rest of the standing
// chrome — with the title away, the stamp is away.
$("ver-line1").textContent = `Nova Fox — EE ${SHIP_EE}`;
{
  const title = $("realm-big"), top = $("topcenter");
  title.addEventListener("mouseenter", () => top.classList.add("ver-on"));
  title.addEventListener("mouseleave", () => top.classList.remove("ver-on"));
  title.addEventListener("touchstart", (e) => {
    e.preventDefault();
    e.stopPropagation();
    top.classList.toggle("ver-on");
  }, { passive: false });
}
$("splash").addEventListener("click", () => dismissSplash());
$("intro-close").addEventListener("click", () => closeIntroViewer());
$("intro-viewer").addEventListener("click", (e) => {
  if (e.target === $("intro-viewer")) closeIntroViewer();
});
$("guide-btn").addEventListener("click", () => {
  const step = guideCurrent();
  if (step && step.action === "helm") {
    sfx.unlock();
    lockPointer();
  }
  if (step && step.button) guideAdvance();
});
$("guide-dismiss").addEventListener("click", () => {
  state.guideDone = true;
  narration.stop(); // exploring on your own means Emise stops talking
  renderGuide();
  syncHud();
});

// ---------- touch: a way to play without keys (2026-11-26) -------------------
// Will: "mobile needs a way to play." Every verb the keyboard and
// mouse own has a touch form, in the game's own idioms:
//   - the stick walks: it presses the scheme's own key codes into
//     the same `keys` set the keyboard fills, so WASD/AWEF, the
//     guide's until()s and the physics all just work;
//   - a drag on the world looks, exactly as the pointer-locked
//     mouse does, at a touch's shorter throw;
//   - a TAP on the world is the click: the memory screen if that
//     is what you face, a strike if a dark thing is in reach, the
//     chisel otherwise — the mousedown path's own rule;
//   - the round buttons carry jump / strike / chisel / flip /
//     run (hold) / lamp / brush both ways;
//   - DRAW arms the second instrument: the next drag on the world
//     is a stroke, classified on release by the same recognizer
//     and resolved by the same path as the right-mouse drawing;
//   - FLUTE arms the spectral flute: the next vertical drag
//     sounds the notes it crosses, through playNote like the
//     shift-drag;
//   - the instrument pads were always tappable and stay the way
//     tunes are played; the panels (board, realms, Emise, log)
//     are buttons already.
// The layer shows only on touch devices (page CSS: a coarse
// pointer, or body.touch once a real touch is felt) and no
// handler here touches a mouse or keyboard event, so desktop
// play is undisturbed. Desktop holds a modifier while it drags
// (right mouse, shift); a touch ARMS its verb with a tap and the
// next drag spends it — the one-finger form of the same verbs.
const touch = {
  mode: null, // null | "draw" | "flute" — an armed one-drag verb
  lookId: null, lookX: 0, lookY: 0, lookT: 0, lookMoved: 0,
  stickId: null,
};
window.addEventListener("touchstart", () => {
  document.body.classList.add("touch");
}, { capture: true, once: true });

function stickCodes() {
  return state.scheme === "AWEF"
    ? { f: "KeyW", b: "KeyF", l: "KeyA", r: "KeyE" }
    : { f: "KeyW", b: "KeyS", l: "KeyA", r: "KeyD" };
}
function stickSet(dx, dy) {
  const mv = stickCodes();
  for (const c of [mv.f, mv.b, mv.l, mv.r]) keys.delete(c);
  if (dy < -0.35) keys.add(mv.f);
  if (dy > 0.35) keys.add(mv.b);
  if (dx < -0.35) keys.add(mv.l);
  if (dx > 0.35) keys.add(mv.r);
  $("stick-knob").style.transform =
    `translate(calc(-50% + ${Math.round(dx * 30)}px), calc(-50% + ${Math.round(dy * 30)}px))`;
}
function stickEnd() {
  if (touch.stickId === null) return;
  touch.stickId = null;
  const mv = stickCodes();
  for (const c of [mv.f, mv.b, mv.l, mv.r]) keys.delete(c);
  $("stick-knob").style.transform = "translate(-50%, -50%)";
}
function stickPoint(t) {
  const r = $("stick").getBoundingClientRect();
  return {
    dx: Math.max(-1, Math.min(1, (t.clientX - (r.left + r.width / 2)) / (r.width / 2))),
    dy: Math.max(-1, Math.min(1, (t.clientY - (r.top + r.height / 2)) / (r.height / 2))),
  };
}
$("stick").addEventListener("touchstart", (e) => {
  e.preventDefault();
  sfx.unlock();
  if (state.splash) { dismissSplash(); return; }
  const t = e.changedTouches[0];
  touch.stickId = t.identifier;
  const p = stickPoint(t);
  stickSet(p.dx, p.dy);
}, { passive: false });
$("stick").addEventListener("touchmove", (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier !== touch.stickId) continue;
    const p = stickPoint(t);
    stickSet(p.dx, p.dy);
  }
}, { passive: false });
$("stick").addEventListener("touchend", (e) => {
  for (const t of e.changedTouches) if (t.identifier === touch.stickId) stickEnd();
});
$("stick").addEventListener("touchcancel", stickEnd);

// The world itself: look-drag, tap-as-click, and the armed verbs.
// A touch belongs to the world unless it lands inside one of the
// interactive subtrees (the touch layer itself, the bars and
// panels that carry buttons and pads) — naming the exceptions
// rather than the one canvas element keeps the drag surface the
// whole screen on real devices, HUD text included.
const TOUCH_UI = "#touchui, #bottombar, #bottomright, #readout, " +
  "#board, #realms, #subspace, #intro-viewer, #login-screen";
document.addEventListener("touchstart", (e) => {
  if (e.target.closest && e.target.closest(TOUCH_UI)) return;
  e.preventDefault();
  sfx.unlock();
  if (state.splash) { dismissSplash(); return; }
  const t = e.changedTouches[0];
  touch.lookId = t.identifier;
  touch.lookX = t.clientX; touch.lookY = t.clientY;
  touch.lookT = performance.now(); touch.lookMoved = 0;
  if (touch.mode === "draw") {
    gesture.active = true;
    gesture.pts = [{ x: t.clientX, y: t.clientY }];
    gesture.acc = { x: 0, y: 0 };
  } else if (touch.mode === "flute") {
    state.flute = { travel: 0, lastClientY: t.clientY, band: null };
  }
}, { passive: false });
document.addEventListener("touchmove", (e) => {
  if (touch.lookId === null) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== touch.lookId) continue;
    e.preventDefault();
    const dx = t.clientX - touch.lookX, dy = t.clientY - touch.lookY;
    touch.lookX = t.clientX; touch.lookY = t.clientY;
    touch.lookMoved += Math.abs(dx) + Math.abs(dy);
    if (touch.mode === "draw" && gesture.active) {
      const last = gesture.pts[gesture.pts.length - 1];
      if (!last || Math.hypot(t.clientX - last.x, t.clientY - last.y) > 5) {
        gesture.pts.push({ x: t.clientX, y: t.clientY });
      }
    } else if (touch.mode === "flute" && state.flute) {
      // The mouse flute's own arithmetic, fed by the finger.
      state.flute.travel += dy;
      const band = Math.max(1, Math.min(11, 1 + Math.round(-state.flute.travel / 26)));
      if (band !== state.flute.band) {
        state.flute.band = band;
        playNote(band);
      }
    } else if (touch.mode === null) {
      state.yaw -= dx * 0.0048 * state.gravDir;
      state.pitch -= dy * 0.0048 * state.gravDir;
      state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch));
    }
  }
}, { passive: false });
document.addEventListener("touchend", (e) => {
  if (touch.lookId === null) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== touch.lookId) continue;
    touch.lookId = null;
    if (touch.mode === "draw" && gesture.active) {
      gesture.active = false;
      const shape = classifyStroke(gesture.pts);
      gesture.pts = [];
      setTouchMode(null);
      if (shape) resolveGestureShape(shape);
    } else if (touch.mode === "flute") {
      state.flute = null;
      setTouchMode(null);
    } else if (touch.mode === null &&
               performance.now() - touch.lookT < 300 && touch.lookMoved < 10) {
      // A tap is the click (see the header): screen, strike, chisel.
      if (introScreenAimed()) { openIntroViewer(); return; }
      if (tellingDoorAimed()) { toggleIdeas(true); return; }
      if (!tryStrike()) tryChisel();
    }
  }
});
document.addEventListener("touchcancel", () => {
  touch.lookId = null;
  if (gesture.active) { gesture.active = false; gesture.pts = []; }
  if (state.flute && touch.mode === "flute") state.flute = null;
  if (touch.mode) setTouchMode(null);
  stickEnd();
});

function setTouchMode(mode) {
  touch.mode = mode;
  $("t-draw").classList.toggle("on", mode === "draw");
  $("t-flute").classList.toggle("on", mode === "flute");
}
function tBtn(id, fn) {
  $(id).addEventListener("touchstart", (e) => {
    e.preventDefault();
    sfx.unlock();
    if (state.splash) { dismissSplash(); return; }
    fn();
  }, { passive: false });
}
tBtn("t-jump", () => doJump());
tBtn("t-strike", () => { tryStrike(); });
tBtn("t-chisel", () => { tryChisel(); });
tBtn("t-flip", () => flipGravityHere());
tBtn("t-lamp", () => toggleLamp());
tBtn("t-brushdn", () => cycleBrush(-1));
tBtn("t-brushup", () => cycleBrush(1));
tBtn("t-draw", () => setTouchMode(touch.mode === "draw" ? null : "draw"));
tBtn("t-flute", () => setTouchMode(touch.mode === "flute" ? null : "flute"));
$("t-run").addEventListener("touchstart", (e) => {
  e.preventDefault();
  sfx.unlock();
  if (state.splash) { dismissSplash(); return; }
  keys.add("ShiftLeft");
  $("t-run").classList.add("on");
}, { passive: false });
const runOff = () => {
  keys.delete("ShiftLeft");
  $("t-run").classList.remove("on");
};
$("t-run").addEventListener("touchend", runOff);
$("t-run").addEventListener("touchcancel", runOff);

// ---------- the frame loop ---------------------------------------------------------------------

function eyePos() {
  const up = state.gravDir > 0 ? 1 : -1;
  return new THREE.Vector3(state.pos.x, state.pos.y + up * 1.62, state.pos.z);
}

let lastT = performance.now();
let questWasDone = false;
let inDungeonBefore = false;
function animate() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (!state.dead) updatePlayer(dt);
  if (!state.dead) riftStep(now, dt);
  chunkMaintenance();
  syncMonsterMeshes(dt);
  syncItemMeshes(now);
  formStep(dt);
  // The swing arc (feedback #2): a bright wedge sweeping the view
  // for a quarter second — the blow is something you SEE.
  if (swoosh) {
    if (state.swingT < 1) {
      state.swingT = Math.min(1, state.swingT + dt / 0.26);
      swoosh.visible = true;
      swoosh.rotation.z = -0.7 + state.swingT * 1.9;
      swoosh.material.opacity = 0.75 * (1 - state.swingT);
      const sc = state.weapon === "lance" ? 1.5 : 1;
      swoosh.scale.setScalar(sc * (0.8 + state.swingT * 0.5));
    } else {
      swoosh.visible = false;
    }
  }
  // The ward, stated while it holds (feedback #4).
  const wardEl = $("wardline");
  if (wardEl) {
    const w = isWarded() && !state.dead;
    wardEl.style.display = w ? "block" : "none";
    if (w) wardEl.textContent = !state.firstJumpDone
      ? "🛡 safe — nothing can hurt you until your first jump lands"
      : "🛡 safe here — nothing can hurt you at Arrival";
  }
  checkMonsterContact();
  // The quest: reaching the stone is checked against the subspace.
  if (!sub.questDone) {
    const bx = Math.floor(state.pos.x), bz = Math.floor(state.pos.z);
    if (inDungeon(bx, bz) && !inDungeonBefore) {
      playBeat("BEAT-barrow");
      toast("The barrow hall. Something guards the deep room below — watch for its glimpses, and strike when it shows itself.", 7000);
    }
    inDungeonBefore = inDungeon(bx, bz);
    if (sub.checkQuest(bx, Math.floor(state.pos.y), bz)) {
      playBeat("BEAT-quest");
      sfx.chime();
      sfx.melody([1, 4, 9, 11, 9], { gap: 130 }); // v5: the quest fanfare (#13)
      flashPortal();
      toast("The Deep Stone — and with it, a hat. It's yours for good.", 9000);
      guideNotify("quest");
      syncHud();
      syncReadout();
    }
  }
  questWasDone = sub.questDone;
  // Camera: eye + stride bob + strafe weave + the gravity roll.
  const eye = eyePos();
  const bobY = state.onGround ? Math.abs(Math.sin(state.bobPhase)) * 0.055 : 0;
  eye.y += bobY * state.gravDir;
  camera.position.copy(eye);
  const roll = (state._lean || 0) + Math.sin(state.bobPhase) * 0.004 +
    (state.gravDir < 0 ? Math.PI : 0);
  camera.quaternion.setFromEuler(new THREE.Euler(
    state.pitch, state.yaw, roll, "YXZ"));
  // Guide steps that poll (movement, jump) advance here.
  const step = guideCurrent();
  if (step && step.until && step.until()) guideAdvance();
  // A just-in-time step surfaces the moment its occasion arrives.
  const jitStep = guideCurrent();
  if (jitStep && jitStep.jit && jitStep.when() && !state.jitShown.has(jitStep.id)) {
    state.jitShown.add(jitStep.id);
    renderGuide();
  }
  if (introScreen) introScreen.visible = state.realm === "nova";
  doorStep();
  renderer.render(scene, camera);
}

// ---------- subspace physics tick -------------------------------------------------------------

setInterval(() => {
  // During a featured introduction the things hold their places —
  // presented, not hunting (feedback #8). Life and growth go on.
  const presented = performance.now() < state.introUntil;
  sub.tick(presented ? null : {
    realmId: state.realm,
    bx: Math.floor(state.pos.x),
    bz: Math.floor(state.pos.z),
  });
  // Life moved: the chunk signature sweep in the frame loop notices
  // which loaded chunks' inputs drifted and re-derives only those.
  syncReadout();
}, 650);

// ---------- go ---------------------------------------------------------------------------------------

initThree();
// Pre-generate the arrival neighborhood so the first frames are whole.
{
  const pcx = Math.floor(state.pos.x / CHUNK), pcz = Math.floor(state.pos.z / CHUNK);
  for (let dx = -RENDER_R; dx <= RENDER_R; dx++)
    for (let dz = -RENDER_R; dz <= RENDER_R; dz++) ensureChunk(pcx + dx, pcz + dz);
}
renderGuide();
// ---------- economy accrual: active play feeds the ledgers -------------------
// "Active" is the PLAN §2.2 discipline: the tab is in front of the
// player and their hands have been on the game within the last
// half minute. An idle open tab mints nothing.
let lastActiveAt = Date.now();
for (const ev of ["keydown", "pointermove", "pointerdown", "touchstart", "wheel"]) {
  window.addEventListener(ev, () => { lastActiveAt = Date.now(); }, { passive: true });
}
let lastEcoTickAt = Date.now();
function ecoTick() {
  const now = Date.now();
  const elapsed = Math.min((now - lastEcoTickAt) / 1000, 30); // a stalled tab grants no backlog
  lastEcoTickAt = now;
  if (document.hidden || now - lastActiveAt > 30000 || elapsed <= 0) return;
  const minted = accrue(eco, elapsed);
  if (minted.tokensMinted || minted.tokensSpewed || minted.creditsMinted) persistEco();
  // The ladder's one grant: the Deep Stone quest gives the hat in
  // the world (sub.hatGranted); the ladder writes it down so it
  // stays — in the save and its copies, like everything owned.
  if (sub.hatGranted && grantRung(eco, "deep-stone-hat", Date.now())) {
    persistEco();
    ecoNote("the Deep Stone Hat is written on your ladder — granted, and it stays.");
  }
  // Spew is the generator's gift to the world: once a hundred flux
  // have pooled, the pool is inscribed on the shared chart through
  // the ordinary marks path — arrival order, queued when offline.
  if (eco.poolSpewed >= 100) {
    sub.log("spew", "the shared pool", `${eco.poolSpewed} flux from a generator's play`);
    eco.poolSpewed = 0;
    persistEco();
  }
}

syncHud();
syncReadout();
updateSyncLabel();
playBeat("BEAT-arrival");
toast("Nova Prime. I'm Emise — my panel is at the bottom of your screen.", 6000);
// The chart-line: probe now, re-probe and flush every 20 s. Offline
// is a first-class state (the ranch itself goes dark some days):
// play never waits on it.
backendProbe().then(() => backendFlush());
setInterval(() => { backendProbe().then(() => backendFlush()); }, 20000);
setInterval(() => { ecoTick(); recordStandings(); syncHud(); }, 5000);

// Demo instrumentation: a handle for headless playtests (and for
// Will's own poking in devtools). Not part of the fiction.
window.NOVA_FOX3 = {
  state, sub, kernels, BACKEND, playerName, standings,
  playNote, playChord, flipGravityHere, tryStrike, tryChisel, hurtPlayer,
  guideAdvance, guideCurrent: () => GUIDE[state.guideStep] || null,
  isWarded, classifyStroke, boardData, scoreNow: () => totalScore(sub),
  narration: {
    ready: (id) => narration.ready(id),
    play: (id) => narration.play(id),
    manifest: () => (typeof NARRATION_MANIFEST !== "undefined" ? NARRATION_MANIFEST : {}),
    state: () => narration.debugState(),
  },
  backendFlush: () => backendFlush(),
  loginUrl: () => loginUrl(),
  hasToken: () => !!gameToken(),
  saveJson: () => saveFileContents(),
  // demo6 handles: player forms — standing, apply, the world.
  formStanding: (text) => {
    const s = formStanding(text);
    return { bytes: s.bytes, cap: s.cap, refused: s.refused, leeway: s.leeway,
      errors: s.parsed.errors,
      frames: s.parsed.frames.map((f) => ({ type: f.type, coord: f.coord,
        w: f.bounds ? f.bounds.w : null, h: f.bounds ? f.bounds.h : null,
        need: f.bounds ? frameNeed(f) : null })) };
  },
  formApply: (text) => {
    const r = applyForm(formState, text, Date.now());
    if (r.ok) {
      persistForm();
      formPublish(text, formState.appliedAt);
      formAnimT = 0; formFrameIdx = 0;
      refreshFormSurfaces();
    }
    return { ok: r.ok, reason: r.reason || null };
  },
  formClear: () => {
    clearForm(formState);
    persistForm();
    if (formSprite) formSprite.visible = false;
    drawPortrait();
    return true;
  },
  formState: () => JSON.parse(JSON.stringify(formState)),
  formExamples: () => FORM_EXAMPLES,
  formWorld: () => ({ worn: !!formState.text, frame: formFrameIdx,
    spriteInScene: !!formSprite, spriteVisible: formSprite ? formSprite.visible : false }),
  formBench: async (text) => {
    const t0 = performance.now();
    const s = formStanding(text);
    const t1 = performance.now();
    const fc = formCanvases(text);
    if (fc) await whenFormReady(fc);
    const t2 = performance.now();
    return { bytes: s.bytes, refused: s.refused, frames: fc ? fc.frames.length : 0,
      parseMs: +(t1 - t0).toFixed(2), rasterMs: fc ? +(t2 - t1).toFixed(2) : null };
  },
  // demo4 handles: the economy — ledgers, entitlement, the record.
  ecoState: () => JSON.parse(JSON.stringify(eco)),
  ecoAccrue: (seconds) => {
    accrue(eco, seconds);
    persistEco();
    syncHud();
    return JSON.parse(JSON.stringify(eco));
  },
  // demo5 handles: the ladder shop — buy a rung, read the ladder.
  ecoBuyRung: (id) => {
    const r = buyRung(eco, id, Date.now());
    if (r.ok) { persistEco(); applyLamp(); syncHud(); renderBoard(); }
    return r.ok ? { ok: true } : { ok: false, reason: r.reason };
  },
  ladderState: () => JSON.parse(JSON.stringify(eco.ladder)),
  // v5 handles (playtest + Will's poking)
  sfxStats: () => ({ ...sfx.stats }),
  // 2026-11-26 handles: the unwatched-tab hold, the touch layer,
  // the optional UI components.
  audioState: () => ({
    ctx: sfx.ctx ? sfx.ctx.state : null,
    heldSuspend: sfx.heldSuspend,
    narrationHeld: narration.held,
  }),
  touchState: () => ({
    touch: document.body.classList.contains("touch"),
    mode: touch.mode,
  }),
  extrasState: () => state.extras,
  outboxState: () => ({
    queued: outbox.length, folded: outboxFolded.length, dropped: outboxDropped,
  }),
  dismissSplash,
  cycleBrush,
  setBrush: (i) => { state.brush = i; },
  toggleLamp,
  openIntroViewer, closeIntroViewer,
  introVideoReady: () => !!window.__INTRO_VIDEO,
  // feedback #27 handles: portal views + realm palettes
  portalState: () => state.rift ? {
    open: true, view: !!portalView, viewOk: state.rift.viewOk,
    renders: portalView ? portalView.renders : 0,
    destRealm: portalView ? portalView.dest.realmId : null,
    targetType: state.rift.target.type,
    // the link (Will, 2026-11-24): one door, two ends — a test
    // can tell the same door crossed twice from two doors.
    linkId: state.riftLink ? state.riftLink.id : null,
    crosses: state.riftLink ? state.riftLink.crosses : 0,
    end: state.rift.end,
    // the link's subspace span (Leg A): the coordinate difference
    // the standing door crosses, and the ring geometry it bought.
    delta: state.rift.geo ? state.rift.geo.delta : null,
    distance: state.rift.geo ? state.rift.geo.distance : null,
    ringRadius: state.rift.geo ? state.rift.geo.radius : null,
    ringSegments: state.rift.geo ? state.rift.geo.segments : null,
  } : { open: false },
  portalPixels: () => {
    if (!portalRT || !portalView) return null;
    renderPortalView(performance.now(), true);
    const w = portalRT.width, h = portalRT.height;
    const buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(portalRT, 0, 0, w, h, buf);
    const fog = paletteFor(portalView.dest.realmId).fog;
    const fr = (fog >> 16) & 255, fg = (fog >> 8) & 255, fb = fog & 255;
    let paleCool = 0, nonFog = 0;
    for (let i = 0; i < buf.length; i += 4) {
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      if (b > r + 25 && b > 120) paleCool++;
      if (Math.abs(r - fr) + Math.abs(g - fg) + Math.abs(b - fb) > 24) nonFog++;
    }
    return { paleCool, nonFog, total: w * h };
  },
  palettes: () => REALM_PALETTES,
  // Leg A handles: the realms' subspace coordinates and the ring
  // geometry any pair's difference implies (no rift need stand).
  realmCoord: (id) => realmCoord(id),
  riftGeometry: (a, b) => riftRingGeometry(a, b),
  homePalette: () => HOME_PALETTE,
  paletteNow: () => ({
    realm: state.realm, applied: appliedPaletteRealm,
    fog: scene.fog ? scene.fog.color.getHex() : null,
    tableFog: paletteFor(state.realm).fog,
  }),
  applyPalette: (id) => applyRealmPalette(id),
  screenPos: () => (introScreen ? introScreen.position : null),
  // demo8 handles: the telling door — queue, read-back, the door.
  ideaState: () => ({
    coord: BACKEND.ideaCoord,
    queued: ideaOutbox.length,
    rows: JSON.parse(JSON.stringify(BACKEND.ideaRows)),
    panelOpen: $("ideas").style.display === "block",
  }),
  ideaSubmit: (title, body) => submitIdea(title, body),
  ideaToggle: (force) => toggleIdeas(force),
  doorPos: () => (tellingDoor ? tellingDoor.position : null),
  doorAimed: () => tellingDoorAimed(),
  teleportTo(x, z) {
    state.pos.set(x + 0.5, heightAt(state.realm, x, z) + 1.01, z + 0.5);
    state.vel.set(0, 0, 0);
    const { sx, sy } = playerScroll();
    ensureNeighborhood(state.realm, sx, sy);
  },
  surfaceY(x, z) { return heightAt(state.realm, x, z) + 1; },

};
