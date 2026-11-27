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
const NF_SHIP_EE = "NF_SHIP_EE:1023";
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
  invertFxT0: -1e9, // when the last real gravity inversion began (demo10)
  invertFxOn: false, // the degauss treatment is on screen right now
  guideStep: 0,
  guideDone: false,
  transit: null, // EE 995: the rift walk in progress, or null
  transitVisuals: null,
  // v3 state
  weapon: null, // null = bare strike; "lance" = the Star Lance
  charms: { swift: false, ward: false, bright: false },
  wardCharge: 0, // the Ward Charm's one turned blow
  firstJumpDone: false, // invulnerable until the first jump lands (feedback #4)
  wispKills: 0,
  gestureUsed: false,
  introKind: null,
  introUntil: 0,
  warpT0: 0, // when the warp announcement last fired (demo18)
  realmSince: 0, // when the fox entered the realm it stands in (demo18)
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
  foxVision: false, // Fox Vision: the Hall sense (Will, 2026-11-26)
  flute: null, // a shift-drag in progress (feedback #6)
  splash: true, // the logo panel is up (feedback #15)
  extras: false, // optional UI components shown (2026-11-26); off by default
  introOpen: false, // the Arrival screen's film is showing (feedback #14)
  guardianEncounter: false, // the Shadow has reached you; the strike hint stands (2026-11-26)
  exploreMoved0: 0, // movedTotal when the guide handed the game over
  jitShown: new Set(), // just-in-time guide steps already surfaced (#19)
};

// Spawn: Nova Prime, on the surface of the arrival column.
state.pos.set(ARRIVAL.nova.x + 0.5, heightAt("nova", ARRIVAL.nova.x, ARRIVAL.nova.z) + 1.01, ARRIVAL.nova.z + 0.5);
state.realmSince = performance.now(); // the spawn realm is "entered" now (demo18)
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
      this.master.gain.value = SETTINGS.master;
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
  degauss() {
    // The CRT's thunk-buzz (demo10): a low thunk as the coil
    // fires, then its hum — a sagging buzz at twice-mains that
    // rings down as the field settles. Synthesized from the same
    // tone/noise kit as every sound here; no asset, no download.
    this.tone(64, { type: "sine", peak: 0.5, decay: 0.28, slide: -22 });
    this.noise({ peak: 0.25, decay: 0.2, freq: 240, type: "lowpass" });
    this.tone(118, { type: "sawtooth", peak: 0.16, decay: 1.5, slide: -30, delay: 0.03 });
    this.tone(236, { type: "sawtooth", peak: 0.07, decay: 1.1, slide: -55, delay: 0.03 });
    this.tone(59, { type: "square", peak: 0.1, decay: 0.9, slide: -12, delay: 0.03 });
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
  powerup() {
    // EE 995 (item 10): a found powerup gets its own sound — a
    // rising major climb with a shimmer over it, distinct from
    // the quest chime and the warp boom.
    [0, 4, 7, 12, 16].forEach((st, i) =>
      this.tone(392 * Math.pow(2, st / 12), { type: "sine", peak: 0.24, decay: 0.7, delay: i * 0.06 }));
    this.noise({ peak: 0.07, decay: 0.5, freq: 2600, type: "highpass", delay: 0.04 });
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
// Joy's recorded voice, one MP3 per beat ID from NARRATION.md,
// embedded in the build (NARRATION_AUDIO: beat ID -> data URI) by
// build3.py from the repo's audio/narration-audio-joy/ (Voice 1).
// The guide's
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
      a.volume = SETTINGS.narration; // the audio panel's narration level
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

// The event beats' lines (NARRATION.md — Will's final script): the
// words Joy speaks when the world's events fire. The toast at each
// fire site shows the very line the recording speaks, so a beat
// that cannot play still reads true. BEAT-border-down is SILENT
// and BEAT-strike-hold has NO DIALOGUE under the script: neither
// has an entry here, and their fire sites show nothing. BEAT-contact
// is retired (feedback #24) — its line lives in NARRATION.md only,
// and the game never triggers it.
const BEAT_LINES = {
  "BEAT-arrival": "Nova Prime! Welcome Home, Fox. Your items are on the left.",
  "BEAT-cross-ashfall": "Ashfall Haven...the rock here remembers the fire that forged the cinders.",
  "BEAT-cross-nova": "Nova Prime! Home Base and safety. The monsters cannot find you here.",
  "BEAT-pocket": "Whoa, Fox! This place is entirely new! That tune was powerful.",
  "BEAT-stay": "This is ours.",
  "BEAT-flip-up": "Gravity inversion in progress. Reality has shifted, permanently.",
  "BEAT-flip-down": "Gravity restored.",
  "BEAT-border-up": "Inverted Gravity Detected.",
  "BEAT-barrow": "The Unexpected Hall, Fox. Find the Shadow, strike at the Heart. Your vision alone can fix it.",
  "BEAT-quest": "This ... is the (gasp) Nova Heart, Fox! You've earned this - take the hat. It's yours, for good!",
  "BEAT-guardian-contact": "This guardian is confused, Fox. You must strike back. Strike, now!",
  "BEAT-strike-kill": "It is done.",
  "BEAT-guardian-kill": "(Winds of Change) The ... shadow is ... gone, Fox! You've done it! The hall is quiet, Nova Prime calls to you. Another piece of Nova Heart is near.",
  "BEAT-death": "Oh no!! Fox, hold on. I'm getting you out of here. Stay with me...please.",
  "BEAT-fall": "Fall home, fox.",
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

// ---------- Joy's banter (2026-11-26) ---------------------------------------
// The engine is banter.js (pure, unit-tested): Joy's hundred lines
// (JOY-BANTER.md — her own cut, battle-tested by the real Joy) and
// the trigger discipline her mapping rule demands. This glue feeds
// it the world's events and a slow observation stream, and shows
// what it returns on the narration line surface (#banter-line),
// also calling narration.play(line.id) — no take is recorded yet,
// so ready() says no and the call is harmless; the day a
// narration-audio/JOY-###.mp3 lands, build3.py embeds it by stem
// and the same hook speaks it, no restructuring.
//
// She is muted while the scripted guide owns the fox: the engine
// still remembers everything (crossings, marks, sightings), it
// just doesn't speak over the lesson. Banter goes live when the
// guide hands the game over, or is dismissed.
const banterSaved = LS.get("nova-phox-banter", null);
const bs = createBanter(banterSaved, performance.now());
let banterLive = false;
let banterLineTimer = 0;
function banterPersist() { LS.set("nova-phox-banter", banterSnapshot(bs, Date.now())); }
function banterSay(line) {
  if (!line) return;
  const el = $("banter-line");
  if (el) {
    el.textContent = line.text;
    el.style.opacity = "1";
    clearTimeout(banterLineTimer);
    banterLineTimer = setTimeout(() => { el.style.opacity = "0"; },
      Math.max(4200, line.text.length * 95));
  }
  narration.play(line.id); // the audio hook: attaches by ID when a take exists
  banterPersist();
}
function banterFire(ev) {
  bs.muted = !(banterLive && !state.dead && !state.splash);
  banterSay(banterEvent(bs, ev, performance.now()));
}
function banterGoLive() {
  if (banterLive) return;
  banterLive = true;
  const seen = banterSaved && banterSaved.lastSeenAt ? banterSaved.lastSeenAt : 0;
  banterFire({ type: "sessionStart", awayMs: seen ? Date.now() - seen : 0 });
  banterFire({ type: "handover" });
}
// Ambience tags the seam-lines compare across a crossing, read off
// the realm's palette: cinder-fall in Ashfall, the hard bright of
// Halycon, the close dark of the short-fog realms.
function banterAmbience(realmId) {
  const tags = [];
  const pal = paletteFor(realmId);
  if (realmId === "ashfall") tags.push("cinders", "wet");
  if (pal.sunI >= 1.7) tags.push("bright");
  if (pal.sat >= 1.05 && realmId !== "nova") tags.push("strong");
  if (pal.fogFar <= 92) tags.push("dark");
  return tags;
}
// Glue-side trackers the events read.
let banterInputAt = performance.now();
let banterLastMoveAt = performance.now();
let banterLastTurnAt = -Infinity;
let banterLastYaw = null;
let banterLastGlimpseAt = -Infinity;
const banterVis = new Map();       // monsterId -> currently in a glimpse
const banterVisSince = new Map();  // monsterId -> glimpse start (ms)
const banterStruck = new Set();    // monsterIds struck during this glimpse
let banterAirStart = 0, banterAirX = 0, banterAirY = 0, banterAirZ = 0;
let banterAirFired = false;
let banterLastFlipAt = -Infinity;
let banterSeqNotes = [];           // the ordered notes of the tune being played
let banterLastNoteAt = 0;
let banterHallVisited = false, banterHallEnterAt = 0, banterWasAbove = false;
let banterApproachArmed = false;
let banterIdlePeak = 0, banterLastPauseMs = 0, banterPauseEndAt = -Infinity;
for (const evName of ["keydown", "pointerdown", "wheel", "touchstart"]) {
  window.addEventListener(evName, () => { banterInputAt = performance.now(); }, { passive: true });
}
window.addEventListener("pointermove", (e) => {
  if (e.buttons > 0) banterInputAt = performance.now();
}, { passive: true });
window.addEventListener("pagehide", () => banterPersist());
// The observation stream: a few times a second the engine hears
// where the fox is, how still, and what the ground ahead is doing.
let banterObsAt = 0;
function banterObserveTick(now) {
  if (now - banterObsAt < 200) return;
  banterObsAt = now;
  const hSpeed = Math.hypot(state.vel.x, state.vel.z);
  if (hSpeed > 1) banterLastMoveAt = now;
  if (banterLastYaw !== null && Math.abs(state.yaw - banterLastYaw) > 0.45) {
    banterLastTurnAt = now;
  }
  banterLastYaw = state.yaw;
  const idleMs = now - banterInputAt;
  if (idleMs >= BANTER_TUNABLES.pauseMinMs) banterIdlePeak = idleMs;
  else if (banterIdlePeak > 0 && idleMs < 2000) {
    banterLastPauseMs = banterIdlePeak;
    banterPauseEndAt = now;
    banterIdlePeak = 0;
  }
  const bx = Math.floor(state.pos.x), bz = Math.floor(state.pos.z);
  if (state.realm === "nova") {
    if (inDungeon(bx, bz) && state.pos.y > DUNGEON.ceilY + 3) banterWasAbove = true;
    const ddx = Math.max(DUNGEON.x0 - state.pos.x, 0, state.pos.x - (DUNGEON.x1 + 1));
    const ddz = Math.max(DUNGEON.z0 - state.pos.z, 0, state.pos.z - (DUNGEON.z1 + 1));
    const dHall = Math.hypot(ddx, ddz);
    if (!inDungeon(bx, bz) && dHall < 16 && !banterApproachArmed) {
      banterApproachArmed = true;
      banterFire({ type: "hallApproach" });
    } else if (dHall > 26) banterApproachArmed = false;
  }
  const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
  // What the fox is looking at: for #32, a very good rock.
  let lookPrize = false;
  {
    const dir = new THREE.Vector3(0, 0, -1)
      .applyEuler(new THREE.Euler(state.pitch, state.yaw, 0, "YXZ"));
    const eye = eyePos();
    for (let t = 0.4; t < 5.2; t += 0.2) {
      const px = Math.floor(eye.x + dir.x * t);
      const py = Math.floor(eye.y + dir.y * t);
      const pz = Math.floor(eye.z + dir.z * t);
      if (!solidAt(px, py, pz)) continue;
      lookPrize = GLOW_BLOCKS.has(baseBlockAt(sub, state.realm, px, py, pz));
      break;
    }
  }
  const groundHere = heightAt(state.realm, bx, bz);
  const groundAhead = heightAt(state.realm,
    Math.floor(state.pos.x + fx * 8), Math.floor(state.pos.z + fz * 8));
  const sdx = (ARRIVAL.nova.x + 0.5) - state.pos.x;
  const sdz = (ARRIVAL.nova.z + 0.5) - state.pos.z;
  const startDist = Math.hypot(sdx, sdz);
  const startGroundY = heightAt("nova", ARRIVAL.nova.x, ARRIVAL.nova.z) + 1.01;
  let minAround = groundHere;
  for (const [ox, oz] of [[12, 0], [-12, 0], [0, 12], [0, -12]]) {
    minAround = Math.min(minAround, heightAt(state.realm, bx + ox, bz + oz));
  }
  banterFire({ type: "observe",
    x: state.pos.x, y: state.pos.y, z: state.pos.z, realm: state.realm,
    yaw: state.yaw, onGround: state.onGround, hSpeed, idleMs,
    gravDir: state.gravDir,
    startVisible: state.realm === "nova" && startDist <= 100 &&
      state.pos.y >= startGroundY - 2,
    atView: (state.pos.y - 1.01 - minAround) >= 5 || (groundAhead - groundHere) <= -6,
    lookTowardStart: state.realm === "nova" && startDist > 10 && startDist <= 150 &&
      (sdx * fx + sdz * fz) / (startDist || 1) > 0.86,
    groundAheadDelta: groundAhead - groundHere,
    inHall: state.realm === "nova" && inDungeon(bx, bz),
    lookPrize,
    ambienceCinders: state.realm === "ashfall" });
}

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

// Control prefs (v5, feedback #5; scheme preference demo19, Will
// 2026-11-26 16:17): the chosen key scheme and the chisel's brush
// size persist on this machine. The scheme itself resolves in
// scheme.js's order: the player's stored preference (localStorage
// "nf.scheme": 'wasd' | 'awef') first; then the scheme the v5
// controls record below already holds; then the coin flip Will
// ruled for first play (2026-11-26 15:07) — half of all players
// walk WASD, half AWEF. Whatever resolves is written back to BOTH
// stores, so the flip happens at most once per browser, the scheme
// is stable across sessions on that browser, and a corrupt
// preference heals itself instead of crashing the boot.
//
// Why a stored preference and not detection: a web page cannot read
// the visitor's browser account name or their machine's hostname —
// no web API offers either, and this build does not pretend
// otherwise. What the preference honestly buys is the same end: set
// the scheme once in a browser on a machine and it is simply always
// that scheme there, from then on.
function readSchemePref() {
  try { return localStorage.getItem(SCHEME_PREF_KEY); } catch (e) { return null; }
}
function writeSchemePref() {
  try { localStorage.setItem(SCHEME_PREF_KEY, prefForScheme(state.scheme)); }
  catch (e) { /* private mode: the controls record still holds it */ }
}
{
  const ctl = LS.get("nova-phox-controls", null);
  if (ctl) {
    if (Number.isInteger(ctl.brush)) {
      state.brush = Math.min(BRUSHES.length - 1, Math.max(0, ctl.brush));
    }
    if (typeof ctl.extras === "boolean") state.extras = ctl.extras;
  }
  state.scheme = resolveScheme({
    pref: readSchemePref(),
    legacy: ctl ? ctl.scheme : null,
    flip: () => (Math.random() < 0.5 ? "AWEF" : "WASD"),
  }).scheme;
  saveCtlPrefs(); // the resolved scheme lands in both stores at boot
}
document.body.classList.toggle("extras", state.extras);
function saveCtlPrefs() {
  LS.set("nova-phox-controls", {
    scheme: state.scheme, brush: state.brush, extras: state.extras,
  });
  writeSchemePref();
}
// setScheme: the one door every scheme change walks through (the
// title panel's toggle, the keys button). state.scheme is read live
// by the movement table, the key handler, the touch stick, and the
// strike hint, so the new scheme applies the moment this returns —
// no reload, and no re-lettering code of its own anywhere. If the
// guide's move lesson is on screen, it re-renders in the new scheme
// (words and voice alike) via renderGuide below.
function setScheme(s) {
  if (!isScheme(s)) return;
  state.scheme = s;
  saveCtlPrefs();
  syncSchemeControls();
  const step = guideCurrent();
  if (step && step.id === "move" && !state.guideDone) renderGuide();
}
function syncSchemeControls() {
  const b = $("btn-keys");
  if (b) b.textContent = `Controls: ${state.scheme}`;
  const t = $("btn-scheme-splash");
  if (t) t.textContent = `Controls: ${state.scheme}`;
}

// ---------- key bindings + settings: the one store (2026-11-26) -----
// The Esc menu's remapping panel and settings panels read and write
// HERE — one obvious place. Bindings map action -> KeyboardEvent
// code; the keydown dispatch consults BIND, never literals, for
// every remappable verb. Other builds read the same store through
// NOVA_FOX3.bindings() (the strike hint's "currently-assigned
// binding" is BIND.strike). Both stores persist with the game's
// save discipline: the LS wrapper, nova-phox- keys, on this machine
// only — like the control prefs, they do not ride in save copies,
// and a new game does not clear them.
const BINDING_ACTIONS = [
  { id: "jump", label: "Jump", def: "Space" },
  { id: "strike", label: "Strike", def: "KeyF" },
  { id: "chisel", label: "Chisel", def: "KeyC" },
  { id: "flip", label: "Flip gravity", def: "KeyG" },
  { id: "lamp", label: "Lamp", def: "KeyV" },
  { id: "brushDown", label: "Brush smaller", def: "Comma" },
  { id: "brushUp", label: "Brush larger", def: "Period" },
  { id: "board", label: "The board", def: "KeyB" },
  { id: "realms", label: "Map of realms", def: "KeyM" },
  { id: "log", label: "Log", def: "KeyL" },
];
const BIND = (() => {
  const stored = LS.get("nova-phox-bindings", {});
  const b = {};
  for (const a of BINDING_ACTIONS) {
    b[a.id] = typeof stored[a.id] === "string" ? stored[a.id] : a.def;
  }
  return b;
})();
function saveBindings() { LS.set("nova-phox-bindings", BIND); }
function setBinding(action, code) {
  // Two actions that would share a key swap places — a binding is
  // never silently doubled, and never silently lost.
  for (const a of BINDING_ACTIONS) {
    if (a.id !== action && BIND[a.id] === code) BIND[a.id] = BIND[action];
  }
  BIND[action] = code;
  saveBindings();
}
function keyName(code) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return {
    Space: "Space", Comma: ",", Period: ".", Minus: "−", Slash: "/",
    Semicolon: ";", Quote: "'", BracketLeft: "[", BracketRight: "]",
    Backquote: "`", Backslash: "\\", Equal: "=",
  }[code] || code;
}
// Keys a binding may not take, and why — the note rows, the scheme's
// walking keys, and the keys the menu and the browser already own.
const RESERVED_BIND_CODES = (() => {
  const r = {};
  // The instrument's two rows, spelled out (NUMBER_KEYS and
  // LETTER_KEYS themselves are defined with the instrument, below).
  for (const c of ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
    "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus",
    "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI",
    "KeyO", "KeyP", "BracketLeft"]) {
    r[c] = "already plays a note";
  }
  for (const c of ["KeyA", "KeyS", "KeyD"]) {
    r[c] = "already walks — the scheme keys are the keys button's, below";
  }
  r.Escape = "is the menu key";
  r.Tab = "opens the map of realms";
  r.Enter = "works the menu";
  r.ArrowUp = r.ArrowDown = r.ArrowLeft = r.ArrowRight = "work the menu and the looking";
  r.ShiftLeft = r.ShiftRight = "is run";
  r.ControlLeft = r.ControlRight = r.AltLeft = r.AltRight =
    r.MetaLeft = r.MetaRight = "belongs to the browser";
  return r;
})();
// Settings the engine really has: the synthesized sound's master
// level, the narration elements' level, the render scale the
// renderer is actually given, and the chunk radius the world
// actually keeps around the fox.
const SETTINGS = Object.assign(
  { master: 0.9, narration: 1.0, renderScale: 1, viewDistance: 3 },
  LS.get("nova-phox-settings", {}));
function saveSettings() { LS.set("nova-phox-settings", SETTINGS); }
function applyMasterVolume() {
  if (sfx.master) sfx.master.gain.value = sfx.muted ? 0 : SETTINGS.master;
}
function applyNarrationVolume() {
  for (const a of narration.cache.values()) {
    try { a.volume = SETTINGS.narration; } catch (e) { /* a cold element */ }
  }
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
  gravityCoord: "1.1.1/1.1.5/1.1.1", // the gravity scroll: one line per shift; a realm's latest line is its down (demo10)
  formCoord: "1.1.1/1.1.6/1.1.1", // the forms scroll: the shapes foxes wear (demo6; coordinate reassigned at integration — demo6 and demo10 both claimed 1.1.1/1.1.5/1.1.1; gravity kept it, forms moved to 1.1.6)
  ideaCoord: "1.1.1/1.1.7/1.1.1", // the ideas scroll: tellings at the door (demo8; coordinate allocated 1.1.7 by the scroll registry, EE 974 — forms keep 1.1.6)
  online: false,
  probed: false,
  boardRows: [], // rows actually read back from the shared chart
  purchaseRows: [], // purchase claims actually read back, numbered by arrival
  ecoLedger: null, // parsed economy ledger actually read back (null = not yet)
  gravityRows: [], // gravity records actually read back from the shared chart
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
    trailTap(`${where} ${detail}`);
    const seg = sub.wal[sub.wal.length - 1];
    outbox.push({ ...seg, by: playerName, ts: Date.now() });
    foldOverflow();
    persistOutbox();
    updateSyncLabel();
  };
}
// ---------- the loading trail -------------------------------------------
// Set dressing on the load panel (world.js has the machinery): the
// words of the boot's own reads — the inscription log as generation
// writes it (tapped above), the shared chart's scrolls as the
// gateway answers them (tapped in backendFlush below) — flow across
// the panel while the world loads, flavor phrases woven through.
// It starts with the load and ends when the world is ready: the
// boot sync settling, the panel stepping aside, or a hard cap,
// whichever comes first. No player-facing surface names it.
const trail = new TrailFeed();
for (const seg of sub.wal) trail.feedText(`${seg.where} ${seg.detail}`);
function trailTap(text) { if (trail.live) trail.feedText(text); }
const trailShown = [];
let trailTimer = null;
function trailRender() {
  const el = document.getElementById("trail-line");
  if (!el) { trailDone(); return; }
  const w = trail.next();
  if (w === null) return;
  trailShown.push(w);
  while (trailShown.length > 9) trailShown.shift();
  el.textContent = trailShown.join(" ");
}
function trailDone() {
  trail.stop();
  if (trailTimer !== null) { clearInterval(trailTimer); trailTimer = null; }
  const el = document.getElementById("trail-line");
  if (el) {
    el.style.opacity = "0";
    setTimeout(() => { el.textContent = ""; }, 700);
  }
}
trailTimer = setInterval(trailRender, 110);
setTimeout(trailDone, 30000); // the trail never outlives the load

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
        trailTap(text);
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
      if (r.ok) {
        const text = await r.text();
        trailTap(text);
        BACKEND.purchaseRows = parsePurchaseBoard(text);
      }
    } catch (e) { /* the record keeps its last honest state */ }
    try {
      const r = await fetch(
        `${BACKEND.base}/api/v2/select?p=${BACKEND.phext}&c=${BACKEND.ecoCoord}`,
        { method: "GET", signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const text = await r.text();
        trailTap(text);
        BACKEND.ecoLedger = parseEcoLedger(text);
      }
    } catch (e) { /* same */ }
    try {
      const r = await fetch(
        `${BACKEND.base}/api/v2/select?p=${BACKEND.phext}&c=${BACKEND.gravityCoord}`,
        { method: "GET", signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        BACKEND.gravityRows = parseGravityScroll(await r.text());
        reconcileGravity();
      }
    } catch (e) { /* gravity keeps its last honest state */ }
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
// ---------- gravity on the shared chart (demo10) ----------------------------
// Will's ruling (2026-11-26): gravity is stored in subspace on a
// per-realm basis — make sure it's a real change — and a player may
// shift a realm's gravity only once per day per realm. The store is
// the gravity scroll on the shared chart: every shift appends one
// record (world.js: gravityShiftLine), a realm's down is its latest
// record, and the records double as the once-a-day ledger. The
// local Subspace realm memory is a mirror for responsiveness; the
// scroll is the truth, attuned to on every read-back and on realm
// entry. A shift made offline or signed-out is queued in the record
// outbox like every other inscription and counts as spent from the
// moment it is made — it lands when the chart answers, and until
// then the sync label says plainly that marks are waiting.

// Every gravity record this fox can honestly know: the scroll as
// read back, plus this fox's own shifts still queued for it. The
// merge orders by the records' own timestamps; on a tie the
// read-back stands last — the scroll wins its own ties, because
// arrival order on the scroll is the final truth once a queued
// shift lands.
function gravityKnownRecords() {
  const queued = [];
  for (const seg of ecoOutbox) {
    if (seg.coord !== BACKEND.gravityCoord) continue;
    for (const r of parseGravityScroll(seg.line)) { r.queued = true; queued.push(r); }
  }
  const all = [...BACKEND.gravityRows, ...queued];
  all.sort((a, b) => (a.ts - b.ts) || ((a.queued ? 0 : 1) - (b.queued ? 0 : 1)));
  return all;
}

function regenChunksAroundPlayer() {
  const pcx = Math.floor(state.pos.x / CHUNK), pcz = Math.floor(state.pos.z / CHUNK);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) regenerateChunk(pcx + dx, pcz + dz);
}

// Attune the local mirror to the chart's word. When the CURRENT
// realm's down changes under the fox — another fox shifted it, or
// the entry read-back speaks — the nearby ground is rebuilt so the
// new down has somewhere to land; the physics loop settles the
// body itself, with the border beat it already speaks.
function reconcileGravity() {
  const latest = latestGravityByRealm(gravityKnownRecords());
  for (const [realmId, rec] of latest) {
    if (!sub.applyRealmGravity(realmId, rec.dir)) continue;
    if (realmId === state.realm) {
      const { sx, sy } = playerScroll();
      regenChunksAroundPlayer();
      markScrollChunksDirty(state.realm, sx, sy);
      syncReadout();
      // The realm turned under the fox by the chart's word — an
      // experienced inversion, announced big (demo18), once the
      // fox has truly been standing here a while. Realm entry
      // re-attunes through this same path with the dwell freshly
      // restarted (enterRealmGravity), so arriving somewhere whose
      // down is up stays quiet here — the border beat speaks it.
      if (warpAnnounceOk(performance.now())) showGravityWarp();
    }
  }
}

// Realm entry: attune at once from what is already known, then ask
// the chart again — its answer, when it comes, reconciles.
async function enterRealmGravity(realmId) {
  state.realmSince = performance.now(); // entry restarts the warp dwell (demo18)
  reconcileGravity();
  if (!BACKEND.online) return;
  try {
    const r = await fetch(
      `${BACKEND.base}/api/v2/select?p=${BACKEND.phext}&c=${BACKEND.gravityCoord}`,
      { method: "GET", signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      BACKEND.gravityRows = parseGravityScroll(await r.text());
      if (state.realm === realmId) reconcileGravity();
    }
  } catch (e) { /* the chart keeps its last honest state; entry already attuned from what is known */ }
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
let RENDER_R = SETTINGS.viewDistance; // the video panel can move it ( Esc menu, 2026-11-26)

function initThree() {
  const holder = $("stage");
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(74, 1, 0.1, 400);
  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * SETTINGS.renderScale);
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
    m.userData.baseEI = ei; // Fox Vision scales from the material's own glow
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
    // Banter glimpse tracking: a dark thing's phase turning visible
    // is a glimpse; its ending is one too. The wisp stays in the
    // light and is never a familiar.
    if (m.kind !== "wisp") {
      const vis = sub.monsterVisible(m);
      const was = banterVis.get(m.id) || false;
      if (vis && !was) {
        banterVis.set(m.id, true);
        banterVisSince.set(m.id, performance.now());
        const p = monsterWorldPos(m);
        const dx = p.x - state.pos.x, dz = p.z - state.pos.z;
        const dist = Math.hypot(dx, dz);
        const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
        const bearing = Math.acos(Math.max(-1, Math.min(1,
          (dx * fx + dz * fz) / (dist || 1)))) * 180 / Math.PI;
        let second = false;
        for (const m2 of sub.monsters) {
          if (m2 !== m && m2.alive && m2.realmId === state.realm &&
              m2.kind !== "wisp" && sub.monsterVisible(m2)) second = true;
        }
        const bNow = performance.now();
        banterFire({ type: "glimpse", monsterId: m.id, kind: m.kind, realm: state.realm,
          dist, bearingDeg: bearing, secondVisible: second,
          afterStillMs: bNow - banterLastMoveAt,
          playerMoving: Math.hypot(state.vel.x, state.vel.z) > 0.5,
          turnedRecently: bNow - banterLastTurnAt < 1500,
          longDarkMs: bNow - banterLastGlimpseAt });
        banterLastGlimpseAt = bNow;
      } else if (!vis && was) {
        banterVis.set(m.id, false);
        banterFire({ type: "glimpseEnd", monsterId: m.id,
          durationMs: performance.now() - (banterVisSince.get(m.id) || performance.now()),
          struck: banterStruck.has(m.id) });
        banterStruck.delete(m.id);
      }
    }
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
    // Fox Vision (Will, 2026-11-26): inside the Hall, a revealed
    // familiar stands at full presence in EVERY phase — the fox
    // sees it, lit, instead of catching its glimpses.
    const revealed = visionReveals(m);
    let target = 0;
    if (m.kind === "wisp") target = 1;
    else if (sub.monsterVisible(m) || revealed) target = 1;
    else if (state.charms.bright && m.phase === 1) target = 0.22;
    const cur = mesh.userData.opacity || 0;
    const next = cur + (target - cur) * Math.min(1, dt * 5);
    mesh.userData.opacity = next;
    mesh.userData.visionLit = revealed;
    for (const mt of mesh.userData.mats) {
      mt.opacity = next;
      // Lit: a revealed familiar burns brighter in every material,
      // so it reads through the Hall's dark instead of merely
      // fading in. The boost scales the material's own emissive —
      // nothing new is painted on the thing.
      mt.emissiveIntensity = (mt.userData.baseEI ?? 1) * (revealed ? 2.4 : 1);
    }
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
  } else if (it.kind === "sword") {
    // The Small Sword (EE 995, item 11): bright blade, gold guard,
    // dark grip — the Lance's glow idiom at a smaller scale.
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 0.17), glow(0xdfe9ff));
    blade.position.y = 1.02;
    g.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 4), glow(0xffffff));
    tip.position.y = 1.53;
    g.add(tip);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.22), glow(0xffd23f));
    guard.position.y = 0.6;
    g.add(guard);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 }));
    grip.position.y = 0.42;
    g.add(grip);
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

// ---------- Joy, present (EE 995, item 8) -----------------------------------
// Will: "Joy should be present, visually." She has been a voice
// since demo22; now she has a form: an APERTURE WISP — a bright
// core turning inside a thin ring, the aperture she names herself
// ("your aperture shift", N-01). She hovers at the fox's shoulder
// on a lagging follow, bobs gently, and brightens and opens while
// she speaks. No collision, no strike target, not a monster — a
// companion light. (Design record: FEEDBACK-995-REPORT.md.)
let joyMesh = null;
function buildJoy() {
  if (joyMesh) return;
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0x00d9ff }));
  ring.rotation.x = Math.PI / 2.4;
  g.add(core); g.add(ring);
  g.userData = { core, ring };
  g.position.copy(state.pos);
  scene.add(g);
  joyMesh = g;
}
function stepJoy(now, dt) {
  if (!joyMesh) return;
  const u = joyMesh.userData;
  const back = 1.15, side = 0.95, up = 2.35;
  const sx = Math.sin(state.yaw), cz = Math.cos(state.yaw);
  const tx = state.pos.x + sx * back + cz * side;
  const tz = state.pos.z + cz * back - sx * side;
  const ty = state.pos.y + up + Math.sin(now / 340) * 0.12;
  const k = 1 - Math.exp(-dt * 3.2);
  joyMesh.position.x += (tx - joyMesh.position.x) * k;
  joyMesh.position.y += (ty - joyMesh.position.y) * k;
  joyMesh.position.z += (tz - joyMesh.position.z) * k;
  u.ring.rotation.z += dt * 1.4;
  u.core.rotation.y += dt * 0.9;
  const speaking = !!(typeof narration !== "undefined" && narration && narration.speakingId);
  const target = speaking ? 1.45 : 1.0;
  joyMesh.scale.setScalar(joyMesh.scale.x + (target - joyMesh.scale.x) * Math.min(1, dt * 6));
  u.core.material.color.setHex(speaking ? 0xffffff : 0xfff3c4);
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
      sfx.powerup(); // EE 995 (item 10): a found powerup SOUNDS...
      showPowerup(def.name); // ...and is announced, center-screen
      sfx.melody([5, 9], { gap: 90 }); // v5: a pickup's two-note lift (#13)
      toast(`${def.name} is yours — ${def.blurb}.`, 7000);
      syncHud();
      syncReadout();
    }
  }
}
function applyItemEffect(def) {
  if (def.kind === "lance") state.weapon = "lance";
  // The Small Sword fills an empty hand; it never takes the
  // Star Lance's place (and the Lance, once held, is kept).
  if (def.kind === "sword" && state.weapon !== "lance") state.weapon = "sword";
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
    banterLastFlipAt = performance.now();
    banterFire({ type: "borderFlip", toUp: g < 0 });
    // BEAT-border-down is SILENT under the final script — no line
    // fires in the normal case; only inverted down gets a line.
    if (g <= 0) toast(BEAT_LINES["BEAT-border-up"]);
  }
  // Input direction in heading space. When down is up, your right
  // hand points the other way — the strafe sign follows gravity.
  // The walking keys themselves are the chosen scheme's (feedback
  // #5): WASD, or AWEF for home-row hands (F walks forward there).
  const mv = state.scheme === "AWEF"
    ? { f: "KeyF", b: "KeyA", l: "KeyW", r: "KeyE" }
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
  const speed = (run ? 6.8 : 4.4) * (state.charms.swift ? 1.35 : 1)
    * (invertFxActive(performance.now()) ? INVERT_SLOW : 1);
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
    if (!wasGround && banterAirStart > 0) {
      banterFire({ type: "land",
        airMs: performance.now() - banterAirStart,
        inverted: state.gravDir < 0,
        flipMidAir: banterLastFlipAt > banterAirStart,
        descent: (banterAirY - state.pos.y) * state.gravDir,
        horizDist: Math.hypot(state.pos.x - banterAirX, state.pos.z - banterAirZ) });
      banterAirStart = 0;
    }
    state.vel.y = 0;
  }
  if (wasGround && !state.onGround) {
    banterAirStart = performance.now();
    banterAirX = state.pos.x; banterAirY = state.pos.y; banterAirZ = state.pos.z;
    banterAirFired = false;
  }
  if (!state.onGround && banterAirStart > 0 && !banterAirFired &&
      performance.now() - banterAirStart >= 2500) {
    banterAirFired = true;
    banterFire({ type: "airborne", airMs: performance.now() - banterAirStart });
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
    hurtPlayer(2, null, BEAT_LINES["BEAT-fall"]);
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
  endTransit(); // EE 995: and no walk through it, either
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
  banterFire({ type: "hurt", hpFrac: state.hp / state.maxHp });
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
    toast(BEAT_LINES["BEAT-death"], 8000);
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

// ---------- the strike hint (2026-11-26) -------------------------------------
// While the encounter with the Shadow is in progress, the fox's
// strike binding stands at the view's edge, bulging — the control
// the moment asks for, impossible to forget while it matters. It
// latches at the same event that can speak the guardian-contact
// line (the guardian's touch, in checkMonsterContact below) and
// it fades on its own when the encounter ends: the Shadow struck
// down, or the fox gone beyond the leash — run away, and the
// moment is over. No dismissal, nothing to close; meeting the
// Shadow again raises it again.
//
// The binding is read from the assignment itself, never lettered
// by hand: under WASD the strike lives on F; under AWEF, F walks
// forward (see the key handler) and the strike lives on the
// click; on touch it is the strike button. One pure function of
// the assignment, so the unit suite can hold it to account.
function strikeBindingLabel(scheme, touch) {
  if (touch) return "STRIKE";
  return scheme === "AWEF" ? "CLICK" : "F";
}
const GUARDIAN_LEASH = 16; // blocks: past this, you have run away
function syncStrikeHint() {
  const cap = $("striker-cap");
  if (!cap) return;
  const label = strikeBindingLabel(
    state.scheme, document.body.classList.contains("touch"));
  if (cap.textContent !== label) cap.textContent = label;
  $("striker-word").style.display = label === "STRIKE" ? "none" : "block";
}
function setGuardianEncounter(on) {
  if (state.guardianEncounter === on) return;
  state.guardianEncounter = on;
  const el = $("striker");
  if (!el) return;
  clearTimeout(setGuardianEncounter._t);
  if (on) {
    syncStrikeHint();
    el.style.display = "block";
    void el.offsetWidth; // let the fade start from 0, not jump
    el.classList.add("on");
  } else {
    el.classList.remove("on");
    setGuardianEncounter._t = setTimeout(() => {
      if (!state.guardianEncounter) el.style.display = "none";
    }, 480);
  }
}
function updateGuardianEncounter() {
  if (!state.guardianEncounter) return;
  const g = sub.monsters.find(
    (m) => m.kind === "guardian" && m.realmId === state.realm);
  if (!g || !g.alive || state.dead) { setGuardianEncounter(false); return; }
  const p = monsterWorldPos(g);
  const dx = state.pos.x - p.x, dz = state.pos.z - p.z;
  if (dx * dx + dz * dz > GUARDIAN_LEASH * GUARDIAN_LEASH) {
    setGuardianEncounter(false);
    return;
  }
  syncStrikeHint(); // the assignment may change mid-encounter
}

function checkMonsterContact() {
  if (state.dead) return;
  for (const m of sub.monsters) {
    if (!m.alive || m.realmId !== state.realm || !familiarSeen(m)) continue;
    const p = monsterWorldPos(m);
    const dx = state.pos.x - p.x, dz = state.pos.z - p.z;
    const dy = (state.pos.y + 0.9) - (p.y + 0.9);
    if (dx * dx + dz * dz < 1.5 && Math.abs(dy) < 2.1) {
      const before = state.hp;
      if (m.kind === "wisp") return; // the training thing cannot hurt you
      // The encounter with the Shadow begins at its touch — the
      // same event that can speak the guardian-contact line below —
      // and the strike hint stands for as long as the encounter
      // lasts (updateGuardianEncounter keeps its end).
      if (m.kind === "guardian") setGuardianEncounter(true);
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
  const weapon = state.weapon === "lance" ? ITEM_DEFS.lance
    : state.weapon === "sword" ? ITEM_DEFS.sword : null;
  const range = weapon ? weapon.range : 4.4;
  const damage = weapon ? weapon.damage : 1;
  const dir = new THREE.Vector3(0, 0, -1)
    .applyEuler(new THREE.Euler(state.pitch, state.yaw, 0, "YXZ"));
  const eye = eyePos();
  let best = null, bestT = range;
  for (const m of sub.monsters) {
    if (!m.alive || m.realmId !== state.realm || !familiarSeen(m)) continue;
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
    banterFire({ type: "kill", kind: best.kind, guardian: best.kind === "guardian",
      sinceGlimpseMs: performance.now() - (banterVisSince.get(best.id) || performance.now()) });
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
      toast(BEAT_LINES[best.kind === "guardian"
        ? "BEAT-guardian-kill" : "BEAT-strike-kill"]);
    }
    guideNotify("strike");
  } else {
    sfx.strikeHit();
    playBeat("BEAT-strike-hold");
    banterStruck.add(best.id);
    damagePopup(`-${damage} · it holds`, "#d8f4ff");
    // BEAT-strike-hold: NO DIALOGUE under the final script — the
    // sound of the hit does the talking (the popup still lands).
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
    banterFire({ type: "mark", key: `${state.realm}:${px},${py},${pz}`,
      x: px, y: py, z: pz, realm: state.realm, yaw: state.yaw,
      broke: broke > 0, level: lastLevel, dist: t,
      inHall: state.realm === "nova" && inDungeon(px, pz) });
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

// ---------- Fox Vision (Will, 2026-11-26) --------------------------------
// "Introduce Fox Vision, usable when inside The Unexpected Hall —
// it provides night vision of all familiars within subspace
// range." The rules live in world.js (inTheHall, foxVisionToggle,
// foxVisionReveals, FAMILIAR_RANGE_CELLS); the view composes them.
// No cost, no cooldown: the Hall is the gate. No toast, no beat —
// the sense waking IS the feedback: the dark gives up its shapes,
// lit. (Joy's barrow line already promised it: "Your vision
// alone can fix it.") An N press outside the Hall is a quiet
// non-response — the toggle rule in world.js simply declines.
function playerInHall() {
  return state.realm === DUNGEON.realm &&
    inTheHall(state.pos.x, state.pos.y, state.pos.z);
}
function foxVisionActive() {
  return state.foxVision && playerInHall();
}
function visionReveals(m) {
  if (!foxVisionActive() || !m.alive || m.realmId !== state.realm) return false;
  return foxVisionReveals(m,
    cellOfBlock(Math.floor(state.pos.x)), cellOfBlock(Math.floor(state.pos.z)));
}
// Seen: shown by the phases, or revealed by Fox Vision. The
// strike and the reach both read this one word — what the Vision
// shows the fox, the fox can strike; and it can strike back.
// Vision cuts both ways, which is what makes it a sense and not
// a cheat: inside the Hall, everything is simply THERE.
function familiarSeen(m) {
  return sub.monsterVisible(m) || visionReveals(m);
}
function toggleFoxVision() {
  state.foxVision = foxVisionToggle(state.foxVision, playerInHall());
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
  banterSeqNotes.push(n);
  {
    const bNow = performance.now();
    banterFire({ type: "note", n, seqIndex: state.notes.length,
      firstNote: state.notes[0],
      gapMs: banterLastNoteAt ? bNow - banterLastNoteAt : 0 });
    banterLastNoteAt = bNow;
  }
  clearTimeout(state.notesTimer);
  state.notesTimer = setTimeout(() => { state.notes = []; banterSeqNotes = []; syncHud(); }, 4000);
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
const RIFT_TINT = {
  nova: 0x0e4d8f, ashfall: 0x2979ff, trust: 0xff2e2e, logos: 0xffd21f,
  willow: 0xb6ff2e, elven: 0x2eff7a, delta: 0x00ffd0, halycon: 0x3fa9ff,
  "ni-knight": 0x6a5cff, orchid: 0xb45cff, plain: 0xf2f2f2,
};
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
  // No feetY override (portal fix, EE 954): the near end's ground
  // is the ring's own ground, computed by riftEnd from the ring's
  // position — anchoring it to the opener's feet made rings opened
  // on slopes untraversable (PORTAL-DIAGNOSIS.md, defect 2).
  const a = riftEnd(state.realm, state.pos.x, state.pos.z, state.yaw);
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
// Carried across with the fox: things of the dark near the ring
// when it is crossed (Will, 2026-11-24 — the rifts players open
// are the migration vector). Computed at the step-in for a walk
// through (the company is chosen at the door), or at the crossing
// itself for an instant one.
function computeCarried(r) {
  const carried = [];
  for (const m of sub.monsters) {
    if (!m.alive || m.kind !== "surface" || m.realmId !== state.realm) continue;
    const p = monsterWorldPos(m);
    const mdx = p.x - r.x, mdz = p.z - r.z;
    if (mdx * mdx + mdz * mdz <= RIFT_CARRY_RANGE * RIFT_CARRY_RANGE)
      carried.push({ m, mdx, mdz });
  }
  return carried;
}
function crossThroughRift(carriedPre) {
  const link = state.riftLink, r = state.rift;
  const fromEnd = r.end;
  const other = link[fromEnd === "a" ? "b" : "a"];
  const carried = carriedPre || computeCarried(r);
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

// ---------- walking through the rift (EE 995, items 5+6) -------------------
// Will's words: "it should be a warp/wormhole implemented as a
// cylinder that curves spacetime around it — a kaleidoscope of fun
// house mirrors" and "players walk through the rift, like walking
// through an underground aquarium."
//
// The design (recorded in full in FEEDBACK-995-REPORT.md): stepping
// into a standing ring's disc no longer teleports. It begins a
// TRANSIT. The passage is a pocket in the departure realm's
// reserved scroll (512,512): while the pocket is set, subspace
// generates a straight vault corridor there, and a glass cylinder
// stands inside it — a kaleidoscope canvas (mirrored rainbow
// wedges) blending the entry realm's band into the destination's,
// three rings along its length, the far disc showing the landing
// through the ring's own portal view, and a drifting mote field
// outside the glass: the aquarium. The fox walks the corridor
// under the game's own physics; stepping into the far disc
// completes the crossing through crossThroughRift itself — the
// same arrival a crossing always took (carried monsters, the far
// ring re-armed at his back) — and the near disc takes him back
// out the way he came, uncrossed. The tune-summoned portals are
// untouched; the rift itself is now the traversable object.
// Monsters keep their instant blunder-crossing (riftStep, below).

const TRANSIT_SCROLL = { sx: 512, sy: 512 };
const TRANSIT_MS = 90000; // the passage's patience, then it sets you back
let transitGroup = null;

function kaleidoTexture(hex) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  const base = new THREE.Color(hex);
  const cols = [];
  for (let i = 0; i < 6; i++) {
    const cc = base.clone();
    cc.offsetHSL(i * 0.055 - 0.14, 0, (i % 2) * 0.13 - 0.06);
    cols.push(`#${cc.getHexString()}`);
  }
  g.fillStyle = "#05060a"; g.fillRect(0, 0, 512, 256);
  const cx = 256, cy = 128;
  for (let k = 0; k < 24; k++) {
    const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 1) / 24) * Math.PI * 2;
    g.fillStyle = cols[k % cols.length];
    g.globalAlpha = 0.5 + (k % 3) * 0.16;
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 195, a0, a1); g.closePath(); g.fill();
    // the funhouse mirror: every wedge again, flipped in its neighbour
    g.save(); g.translate(cx, cy); g.scale(1, -1); g.translate(-cx, -cy);
    g.globalAlpha = 0.28;
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 118, a0, a1); g.closePath(); g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

function beginTransit() {
  if (state.transit || !state.rift || !state.riftLink) return;
  const link = state.riftLink, r = state.rift;
  const fromEnd = r.end;
  const other = link[fromEnd === "a" ? "b" : "a"];
  const carried = computeCarried(r);
  const bx0 = TRANSIT_SCROLL.sx * SCROLL, bz0 = TRANSIT_SCROLL.sy * SCROLL;
  const tp = {
    realmId: state.realm, sx: TRANSIT_SCROLL.sx, sy: TRANSIT_SCROLL.sy,
    x0: bx0 + 6, x1: bx0 + 36, z0: bz0 + 29, z1: bz0 + 35, floorY: 19, ceilY: 25,
  };
  tp.zc = (tp.z0 + tp.z1) / 2;
  sub.transitPocket = tp;
  ensureNeighborhood(state.realm, tp.sx, tp.sy);
  // The passage stands empty: whatever the pocket scroll's genesis
  // seeded is swept out of the tube's road.
  for (const m of sub.monsters) {
    if (m.alive && m.realmId === state.realm &&
        Math.floor(m.gx / 32) === tp.sx && Math.floor(m.gy / 32) === tp.sy) m.alive = false;
  }
  buildTransitMeshes(other, tp);
  state.transit = {
    link, fromEnd, other, carried, t0: performance.now(), pocket: tp,
    home: { x: state.pos.x, y: state.pos.y, z: state.pos.z, yaw: state.yaw, pitch: state.pitch },
  };
  // The wormhole's own frame: down is down inside the passage,
  // whatever the realm outside is doing (an inverted realm stays
  // traversable — Will's ruling — and so does its rift).
  state.gravDir = 1;
  state.pos.set(tp.x0 + 3.5, tp.floorY + 1.01, tp.zc);
  state.vel.set(0, 0, 0);
  state.yaw = -Math.PI / 2; state.pitch = 0;
  flashPortal();
  sfx.portal();
  sub.log("transit", `${realmName(state.realm)} ${tp.sx},${tp.sy}`,
    "the fox steps into the rift — the walk through begins");
}

function buildTransitMeshes(other, tp) {
  endTransitMeshes();
  transitGroup = new THREE.Group();
  const midX = (tp.x0 + tp.x1) / 2, len = tp.x1 - tp.x0 - 8, yC = tp.floorY + 2.6;
  const fromPal = paletteFor(state.realm), toPal = paletteFor(other.realmId);
  const texA = kaleidoTexture(fromPal.accent), texB = kaleidoTexture(toPal.accent);
  const mkTube = (tex, cx, l) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.3, l, 24, 1, true),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, transparent: true, opacity: 0.94 }));
    m.rotation.z = Math.PI / 2;
    m.position.set(cx, yC, tp.zc);
    transitGroup.add(m);
    return m;
  };
  const tubeA = mkTube(texA, tp.x0 + 4 + len / 4, len / 2);
  const tubeB = mkTube(texB, tp.x1 - 4 - len / 4, len / 2);
  const ribs = [];
  [[tp.x0 + 4.5, fromPal.accent], [midX, 0xffffff], [tp.x1 - 4.5, toPal.accent]].forEach(([x, col]) => {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(2.32, 0.07, 8, 32),
      new THREE.MeshBasicMaterial({ color: col }));
    rib.rotation.y = Math.PI / 2;
    rib.position.set(x, yC, tp.zc);
    transitGroup.add(rib); ribs.push(rib);
  });
  // The aquarium: motes drifting outside the glass, in both
  // realms' colors. (Positions relative to the passage's center,
  // so the whole field can slowly wheel around the tube.)
  const N = 260, posArr = new Float32Array(N * 3), colArr = new Float32Array(N * 3);
  const cA = new THREE.Color(fromPal.accent), cB = new THREE.Color(toPal.accent);
  for (let i = 0; i < N; i++) {
    const h1 = kernels.hash(`mote|${i}|a`), h2 = kernels.hash(`mote|${i}|b`);
    const a = (h1 % 628) / 100, r = 3 + (h2 % 220) / 100;
    posArr[i * 3] = -len / 2 + ((h1 >> 4) % Math.max(1, Math.floor(len)));
    posArr[i * 3 + 1] = Math.sin(a) * r;
    posArr[i * 3 + 2] = Math.cos(a) * r;
    const c = i % 2 ? cA : cB;
    colArr[i * 3] = c.r; colArr[i * 3 + 1] = c.g; colArr[i * 3 + 2] = c.b;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
  moteGeo.setAttribute("color", new THREE.BufferAttribute(colArr, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    size: 0.16, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
  motes.position.set(midX, yC, tp.zc);
  transitGroup.add(motes);
  // The far disc: the destination, through the ring's own portal
  // view — the same living picture the ring itself wears.
  const discMat = (portalRT && state.rift && state.rift.viewOk)
    ? new THREE.MeshBasicMaterial({ map: portalRT.texture, side: THREE.DoubleSide })
    : new THREE.MeshBasicMaterial({
        color: RIFT_TINT[other.realmId] ?? 0x0e4d8f,
        transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.15, 32), discMat);
  disc.position.set(tp.x1 - 1.2, yC, tp.zc);
  transitGroup.add(disc);
  // The near disc: home, behind the fox — step back out any time.
  const back = new THREE.Mesh(new THREE.CircleGeometry(2.15, 32),
    new THREE.MeshBasicMaterial({
      color: fromPal.accent, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
  back.position.set(tp.x0 + 1.2, yC, tp.zc);
  transitGroup.add(back);
  scene.add(transitGroup);
  state.transitVisuals = { texA, texB, tubeA, tubeB, ribs, motes, started: performance.now() };
}

function transitStep(now, dt) {
  const T = state.transit;
  if (!T) return;
  const V = state.transitVisuals;
  if (V) {
    const t = (now - V.started) / 1000;
    V.texA.offset.x = (t * 0.045) % 1;
    V.texB.offset.x = (t * 0.045) % 1;
    V.tubeA.material.color.setHSL(0.55 + 0.08 * Math.sin(t * 0.23), 0.35, 0.82);
    V.tubeB.material.color.setHSL(0.55 + 0.08 * Math.sin(t * 0.23 + 1.7), 0.35, 0.82);
    V.ribs.forEach((r, i) => { r.scale.setScalar(1 + 0.05 * Math.sin(t * 2 + i * 2.1)); });
    V.motes.rotation.x = t * 0.05;
  }
  if (state.dead) { endTransit(); return; }
  if (now - T.t0 > TRANSIT_MS) {
    abortTransit("the passage tires, and sets the fox back at its mouth");
    return;
  }
  if (state.pos.x >= T.pocket.x1 - 3) completeTransit();
  else if (state.pos.x <= T.pocket.x0 + 2.5) abortTransit();
}

function completeTransit() {
  const T = state.transit;
  if (!T) return;
  const carried = T.carried;
  endTransit();
  crossThroughRift(carried); // the arrival is the crossing's own
}

function abortTransit(note) {
  const T = state.transit;
  if (!T) return;
  endTransit();
  state.pos.set(T.home.x, T.home.y, T.home.z);
  state.vel.set(0, 0, 0);
  state.yaw = T.home.yaw; state.pitch = T.home.pitch;
  enterRealmGravity(state.realm); // the realm's own down, restored
  if (state.rift) state.rift.armed = false; // step clear to re-arm the door
  flashPortal();
  if (note) toast(note, 3200);
}

function endTransit() {
  if (!state.transit) return;
  state.transit = null;
  state.transitVisuals = null;
  if (sub.transitPocket) sub.transitPocket = null;
  endTransitMeshes();
}

function endTransitMeshes() {
  if (!transitGroup) return;
  scene.remove(transitGroup);
  transitGroup.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map && o.material.map.isCanvasTexture) o.material.map.dispose();
      o.material.dispose();
    }
  });
  transitGroup = null;
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
    banterFire({ type: "riftFold" });
    return;
  }
  // The door is not the fox's alone: a thing of the dark that
  // blunders into the standing ring crosses by itself.
  for (const m of sub.monsters) {
    if (!m.alive || m.kind !== "surface" || m.realmId !== state.realm) continue;
    if (now < (monsterRiftCooldown.get(m.id) || 0)) continue;
    const p = monsterWorldPos(m);
    const mdx = p.x - r.x, mdz = p.z - r.z;
    if (mdx * mdx + mdz * mdz < r.geo.disc * r.geo.disc)
      carryMonsterThrough(m, r.end, mdx, mdz, 2.4);
  }
  // A crossing arms only once the fox has stepped clear of the
  // ring he stepped out of — the same door, never a hair trigger.
  if (!r.armed) {
    if (dist2 > 4) r.armed = true;
    return;
  }
  const dy = (state.pos.y - 1.01) - r.feetY;
  // The trigger is the visible disc itself (portal fix, EE 954):
  // the old hard-coded 1.25 (radius ~1.118) left the outer ~42% of
  // the disc dead (PORTAL-DIAGNOSIS.md, defect 1).
  if (dist2 < r.geo.disc * r.geo.disc && Math.abs(dy) < 2.4)
    beginTransit(); // EE 995 (items 5+6): the rift is walked through now
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
  banterFire({ type: "chord",
    seq: banterSeqNotes.length ? [...banterSeqNotes] : [...chord],
    targetKey: target.type === "realm" ? `realm:${target.realmId}`
      : target.type === "pocket" ? `pocket:${target.realmId}:${target.sx},${target.sy}`
      : `stay:${state.realm}:${sx},${sy}`,
    targetRealm: target.realmId || state.realm,
    inHall: state.realm === "nova" &&
      inDungeon(Math.floor(state.pos.x), Math.floor(state.pos.z)),
    leavesRealm: target.type === "realm" && target.realmId !== state.realm });
  banterSeqNotes = [];
  sub.log("tune", `${realmName(state.realm)} ${sx},${sy}`,
    `notes ${chord.join("+")} — a tune is played, and written`);
  if (target.type === "stay") {
    playBeat("BEAT-stay");
    toast(BEAT_LINES["BEAT-stay"]);
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
    enterRealmGravity(state.realm);
    applyRealmSky();
    for (const [, mesh] of monsterMeshes) scene.remove(mesh);
    monsterMeshes.clear();
    playBeat(state.realm === "ashfall" ? "BEAT-cross-ashfall" : "BEAT-cross-nova");
    toast(BEAT_LINES[state.realm === "ashfall"
      ? "BEAT-cross-ashfall" : "BEAT-cross-nova"], 8000);
    banterVis.clear(); // the old realm's glimpses end at the seam
    banterAirStart = 0; // a crossing is not a fall
    banterFire({ type: "cross", from, to: state.realm,
      viaLink: !!opts.viaLink, inverted: state.gravDir < 0,
      ambience: banterAmbience(state.realm), fromAmbience: banterAmbience(from) });
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
    toast(BEAT_LINES["BEAT-pocket"], 6000);
    banterAirStart = 0; // a crossing is not a fall
    banterFire({ type: "pocket" });
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

// ---------- the inversion wooze (demo10) ------------------------------------
// Will (2026-11-26): a gravity inversion slows the player for
// 5 seconds and the screen goes fuzzy for the same 5 seconds —
// like degaussing a monitor, sound effect included. The effect
// hangs on the REAL inversion: it starts only where a shift
// actually turns the realm (flipGravityHere, past the once-a-day
// gate). A refused shift inverts nothing and woozes nothing.
const INVERT_FX_MS = 5000; // the wooze lasts five seconds
const INVERT_SLOW = 0.5; // at half speed while it lasts
function invertFxActive(now) { return now - state.invertFxT0 < INVERT_FX_MS; }
function startInvertFx() {
  state.invertFxT0 = performance.now();
  sfx.degauss();
}
// The degauss treatment, driven per frame from animate(): the
// picture starts bent and ringing — blur, a hue swing, a wobble
// that collapses and settles on a damped envelope — under a
// rainbow shimmer veil, and every trace is gone at five seconds.
function updateInvertFx(now) {
  const canvas = renderer.domElement, veil = $("degauss");
  if (!invertFxActive(now)) {
    if (state.invertFxOn) {
      state.invertFxOn = false;
      canvas.style.filter = "";
      canvas.style.transform = "";
      if (veil) veil.style.opacity = "0";
    }
    return;
  }
  state.invertFxOn = true;
  const t = now - state.invertFxT0, u = t / INVERT_FX_MS;
  const amp = Math.pow(1 - u, 1.6); // strong at the thunk, settling tail
  const wob = Math.sin(t * 0.0138) * amp; // the ~2.2 Hz dying wobble
  const shim = Math.sin(t * 0.055) * amp; // the faster rainbow shimmer
  canvas.style.filter =
    `blur(${(4.5 * amp).toFixed(2)}px) hue-rotate(${(70 * wob).toFixed(1)}deg) saturate(${(1 + 0.9 * amp).toFixed(2)})`;
  canvas.style.transform =
    `translate(${(6 * wob).toFixed(1)}px, ${(1.6 * shim).toFixed(1)}px) scale(${(1 + 0.03 * wob).toFixed(3)})`;
  if (veil) veil.style.opacity = (0.26 * amp * (0.75 + 0.25 * shim)).toFixed(3);
}

// ---------- warp text: the inversion, announced (demo18) --------------------
// Will (2026-11-26): "GRAVITY INVERSION!!" — warp text on the
// announcement method: the intro card's presentation (a centered
// serif name between cyan rules, shown, held, then gone), the name
// at 3x the card's 40px, and the card itself warped — swung through
// perspective with a skew that rings down and settles (the warpin /
// warpname keyframes in page3.html). A dedicated card built exactly
// on that method, so a warp announcement never preempts or corrupts
// a monster introduction in flight (startIntro owns #introcard's
// timer and its spotlight dim).
//
// It fires on the inversions the fox EXPERIENCES: its own shift,
// past the once-a-day gate, beside the wooze (flipGravityHere); and
// a turn that arrives by read-back while the fox is standing in the
// realm (reconcileGravity) — down changed under the fox, and the
// big text is the helpful word for why the world just turned. A
// refused shift inverts nothing and announces nothing. Arriving
// somewhere is not an inversion: the dwell below keeps realm entry
// and the boot attunement quiet.
const WARP_TEXT = "GRAVITY INVERSION!!";
const WARP_MS = 2600; // on screen: lands with the inversion, clears well inside the wooze's 5000
const WARP_DWELL_MS = 4000; // a read-back turn counts as experienced only after this long in the realm
let warpShown = 0; // how many times the announcement has fired (playtest evidence)
function showGravityWarp() {
  const card = $("warpcard");
  if (!card) return;
  warpShown++;
  state.warpT0 = performance.now();
  card.style.display = "block";
  card.classList.remove("show");
  void card.offsetWidth; // restart the animation, as the intro card does
  card.classList.add("show");
  clearTimeout(showGravityWarp._t);
  showGravityWarp._t = setTimeout(() => { card.style.display = "none"; }, WARP_MS);
}
const POWER_MS = 2600;
let powerShown = 0; // how many powerup announcements have fired
// EE 995 (item 10): finding a powerup is announced center-screen,
// on the gravity-warp card's method — its name, held a beat, gone.
function showPowerup(name) {
  const card = $("powercard");
  if (!card) return;
  powerShown++;
  $("power-name").textContent = name;
  card.style.display = "block";
  card.classList.remove("show");
  void card.offsetWidth; // restart the animation
  card.classList.add("show");
  clearTimeout(showPowerup._t);
  showPowerup._t = setTimeout(() => { card.style.display = "none"; }, POWER_MS);
}
function warpAnnounceOk(now) {
  return !state.splash && now - state.realmSince >= WARP_DWELL_MS;
}

function flipGravityHere() {
  // One shift per player per realm per day (Will, 2026-11-26),
  // judged against every record known here — read back from the
  // gravity scroll or still queued for it — so a shift counts from
  // the moment it is made, not from when it lands. A refused shift
  // does not happen; the toast below is a placeholder line in the
  // game's comms style, flagged for Will's wording.
  const day = todayStr();
  if (!gravityShiftAllowed(gravityKnownRecords(), state.realm, playerName, day)) {
    toast("This realm's gravity has already been shifted today — one shift per realm per day.", 5000);
    return;
  }
  const { sx, sy } = playerScroll();
  const dir = sub.flipGravity(state.realm, sx, sy);
  // The shift is inscribed on the gravity scroll: that record IS
  // the realm's new down, for every fox, from when the chart takes
  // it — and it spends this fox's one shift in this realm today.
  queueEcoLine(BACKEND.gravityCoord,
    gravityShiftLine(state.realm, dir, playerName, day, Date.now()));
  state.flips++;
  startInvertFx(); // the inversion is real — the wooze rides it
  showGravityWarp(); // — and the warp text announces it, big (demo18)
  sfx.flip();
  // The vault (or its absence) is generation: rebuild nearby NOW so
  // the new down has somewhere to land you.
  const pcx = Math.floor(state.pos.x / CHUNK), pcz = Math.floor(state.pos.z / CHUNK);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) regenerateChunk(pcx + dx, pcz + dz);
  markScrollChunksDirty(state.realm, sx, sy);
  playBeat(dir > 0 ? "BEAT-flip-down" : "BEAT-flip-up");
  toast(BEAT_LINES[dir > 0 ? "BEAT-flip-down" : "BEAT-flip-up"], 5000);
  banterLastFlipAt = performance.now();
  banterFire({ type: "flip", toUp: dir < 0 });
  guideNotify("flip");
  syncReadout();
}

// ---------- the guide (Joy narrates; the guide guarantees the XP) --------------
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
// N-03 (the move step) speaks in two variants — NARRATION.md,
// Will's ruling (2026-11-26): half of all players get WASD, half
// get AWEF, by coin flip. The step's text follows the fox's
// resolved scheme, exactly as its recorded beat does (renderGuide).
const MOVE_LINES = {
  WASD: "Feet first, Fox! W A S D to walk — the arrows work too. Mouse to look, Space to jump. There's no fence, no edge, no end. Run as far as you like!",
  AWEF: "Feet first, Fox — and your hands get the other layout. F walks forwards, A walks backwards, W strafes left, E strafes right. Mouse to look, Space to jump. Cartoon hands make do with four fingers. Sentients ship with five, so your thumb gets the Space bar all to itself. There's no fence, no edge, no end. Run as far as you like!",
};

const GUIDE = [
  {
    id: "wake",
    lines: [
      "Wake up, Fox! The rifts have opened. I'm Joy, your aperture shift. Ten realms have appeared, each one unexpected. Let's go exploring!",
    ],
    button: "And then?",
  },
  {
    id: "rifts",
    lines: [
      "Nova Prime — that's here! The first realm, and you're standing in the rift that opened it. Click the world to take hold of it. The sound starts with your click, so listen as you go!",
    ],
    button: "Take control",
    action: "helm",
  },
  {
    id: "move",
    lines: [MOVE_LINES.WASD],
    until: () => state.movedTotal > 7 && state.jumped >= 1,
    hint: "Walk a little. Jump once. (Nothing can hurt you yet — learn your feet.)",
  },
  {
    id: "numbers",
    lines: [
      "See the numbers along the top? They're an inky! Press three in a row - together they make a tune...and a tune? That's a place.",
    ],
    until: () => state.notesPlayed >= 1,
    hint: "Press a number key. Any one.",
  },
  {
    id: "bridge",
    lines: [
      "Here's your first tune: 1, 4, 9. Any order, close together. That's the bridge tune — it opens a rift to Ashfall Haven, right in front of you. Step through! From Ashfall, the same tune brings you home.",
    ],
    until: () => state.realm === "ashfall",
    hint: "Play 1, 4, 9.",
  },
  {
    id: "ashfall",
    lines: [
      "Ashfall Haven! Ash, red rock, cinders on the wind. Every realm has its own weather, its own ground, its own mood. Things move in the dark here — you'll glimpse them, just barely. Strike in the glimpse: click, or F. Ready to head back? 1, 4, 9.",
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
      "One more surprise...press G to invert gravity self. Down and up are suggestions here, ones that you can swap daily. You'll feel a little woozy after a gravity inversion, that's normal. Just remember, each realm can only swap gravity once a day!",
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
      "East of Home Base, where you woke up, rises the Unexpected Hall. Deep inside lies a piece of Nova Prime's Heart. Whenever you find a hall, you should explore it to collect another piece of the planet's heart. The journey will be dangerous, but Nova Prime will reward you every time.",
    ],
    until: () => sub.questDone,
    hint: "East, to the barrow. Reach the Deep Stone.",
  },
  {
    id: "done",
    lines: [
      "Good, Fox: you've found another piece of Nova Heart. You've unlocked a Bundle. Return to Home Base and help rebuild Nova Prime! Press M to view available realms.",
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
  let beat = GUIDE_BEATS[step.id];
  if (step.id === "move") {
    // N-03 was recorded in both schemes (NARRATION.md): the fox
    // hears the variant matching the keys under their hands.
    beat = state.scheme === "AWEF" ? "N-03-AWEF" : "N-03-WASD";
  }
  if (beat && state.lastGuideBeat !== beat) {
    state.lastGuideBeat = beat;
    playBeat(beat);
  }
  const lines = step.id === "move"
    ? [MOVE_LINES[state.scheme] || MOVE_LINES.WASD]
    : step.lines;
  $("guide-lines").innerHTML = lines.map((l) => `<p>${l}</p>`).join("");
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
// EE 995 (item 1): Joy's lesson is a per-GAME thing, not a
// per-load thing — "intro should only play once per game." The
// guide's place is kept on this machine beside the introduced set
// (the same pattern); a reload or a continue resumes where the
// lesson left off — finished stays finished — and only a new game
// (which clears the key, see NEW_GAME_KEYS) plays it again.
function saveGuide() {
  try {
    localStorage.setItem("nova-phox-guide",
      JSON.stringify({ step: state.guideStep, done: state.guideDone }));
  } catch (e) { /* private mode: the lesson simply runs per load */ }
}
function restoreGuide() {
  try {
    const g = JSON.parse(localStorage.getItem("nova-phox-guide") || "null");
    if (!g) return;
    state.guideStep = Math.max(0, Math.min(g.step | 0, GUIDE.length));
    state.guideDone = !!g.done || state.guideStep >= GUIDE.length;
  } catch (e) { /* an unreadable record starts the lesson fresh */ }
}
function guideAdvance() {
  const leaving = guideCurrent();
  if (leaving && leaving.id === "handover") {
    state.exploreMoved0 = state.movedTotal; // the exploration clock starts
    banterGoLive(); // and Joy's ambient voice with it
  }
  state.guideStep++;
  if (state.guideStep >= GUIDE.length) state.guideDone = true;
  saveGuide();
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
    "listen to Joy");
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

// The ten portals in rainbow order (item 7's bands), home last.
const PORTAL_ORDER = ["trust", "ashfall", "logos", "willow", "elven", "delta",
  "halycon", "ni-knight", "orchid", "plain", "nova"];
function renderRealms() {
  // EE 995 (item 4): the map of realms is the PORTAL PANEL — one
  // action (M, or the map button) lists the ten rift portals in
  // rainbow order with their band chips; choosing a realm brings
  // its portal up where the fox stands (openRift plants both ends
  // and raises the ring), ready to step into. Every realm is open.
  $("realms-list").innerHTML = PORTAL_ORDER.map((id) => realmById(id)).filter(Boolean).map((r) => {
    const here = r.id === state.realm;
    const chip = `#${paletteFor(r.id).accent.toString(16).padStart(6, "0")}`;
    const status = here ? "you are here" : "bring up its portal";
    const attrs = here ? "" : ` data-portal="${r.id}" role="button" tabindex="0" title="Bring up the ${r.name} portal"`;
    return `<div class="realmrow ${here ? "here" : ""}"${attrs}>
      <span class="realmname2"><span class="realmchip" style="background:${chip}"></span>${r.name}</span><span class="realmstatus">${status}</span></div>`;
  }).join("");
}
function toggleRealms(force) {
  const el = $("realms");
  const show = force !== undefined ? force : el.style.display !== "block";
  el.style.display = show ? "block" : "none";
  if (show) renderRealms();
}

// ---------- the Esc menu (2026-11-26) ----------------------------------
// Will's spec: a menu on Esc — Start a New Game · Open to LAN ·
// Save the world to .phext · Merge the local game to fox.phext.io ·
// Key bindings · Video settings · Audio settings · Quit. The menu
// and its three sub-panels wear the realms panel's dress. Like
// every other panel in this game, the menu does NOT pause the
// world: the animate loop runs under it, exactly as it runs under
// the board and the map. While a menu panel is up, the keyboard
// works the menu instead of the fox (the keydown handler routes
// here first) — a menu you cannot type through.
const MENU_PANELS = ["menu", "bindings-panel", "video-panel", "audio-panel"];
let panelFocus = { panel: null, index: 0 };
let bindingCapture = null; // the action awaiting a key, or null
let newGameArmed = false;
let mergeArmed = false; // the merge's sign-in step is a second, deliberate click

function menuIsOpen() {
  return MENU_PANELS.some((p) => $(p).style.display === "block");
}
function openPanel(id) {
  for (const p of MENU_PANELS) $(p).style.display = p === id ? "block" : "none";
  panelFocus = { panel: id, index: 0 };
  if (id) { refreshMenuStates(); markSelection(); }
}
function toggleMenu(force) {
  const show = force !== undefined ? force : $("menu").style.display !== "block";
  if (show) { newGameArmed = false; mergeArmed = false; syncMenuConfirm(); openPanel("menu"); }
  else openPanel(null);
}
function closeMenu() { openPanel(null); }
function menuNote(msg) { $("menu-note").textContent = msg; }
function syncMenuConfirm() {
  $("menu-confirm").style.display = newGameArmed ? "block" : "none";
}
// The controls the keyboard can reach in the open panel, in order.
function panelControls(id) {
  if (id === "menu") {
    if (newGameArmed) return [$("menu-confirm-yes"), $("menu-confirm-no")];
    return ["menu-newgame", "menu-lan", "menu-savephext", "menu-merge",
      "menu-keys", "menu-video", "menu-audio", "menu-quit", "menu-close"].map($);
  }
  if (id === "bindings-panel") {
    return [...$("bindings-list").querySelectorAll("button"),
      $("bindings-reset"), $("bindings-back")];
  }
  if (id === "video-panel") {
    return [$("vid-scale"), $("vid-view"), $("vid-full"), $("video-back")];
  }
  if (id === "audio-panel") {
    return [$("aud-master"), $("aud-narration"), $("aud-mute"), $("audio-back")];
  }
  return [];
}
function markSelection() {
  for (const p of MENU_PANELS) {
    for (const el of $(p).querySelectorAll(".sel")) el.classList.remove("sel");
  }
  if (!panelFocus.panel) return;
  const ctl = panelControls(panelFocus.panel)[panelFocus.index];
  if (ctl) ctl.classList.add("sel");
}
function handleMenuKey(e) {
  const id = panelFocus.panel;
  if (!id) return;
  if (e.code === "Escape") {
    if (id === "menu") closeMenu(); else openPanel("menu");
    return;
  }
  const ctls = panelControls(id);
  if (!ctls.length) return;
  panelFocus.index = Math.min(panelFocus.index, ctls.length - 1);
  const ctl = ctls[panelFocus.index];
  if (e.code === "ArrowDown" || e.code === "ArrowUp") {
    const d = e.code === "ArrowDown" ? 1 : -1;
    panelFocus.index = (panelFocus.index + d + ctls.length) % ctls.length;
    markSelection();
  } else if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
    const d = e.code === "ArrowRight" ? 1 : -1;
    if (ctl.type === "range") {
      ctl.value = Math.max(0, Math.min(100, Number(ctl.value) + d * 5));
      ctl.dispatchEvent(new Event("input"));
    } else if (ctl.tagName === "BUTTON") ctl.click();
  } else if (e.code === "Enter") {
    if (ctl.tagName === "BUTTON") ctl.click();
  }
}
function refreshMenuStates() {
  $("menu-lan-state").textContent = LAN.open ? "open" : "closed";
  const waiting = marksWaiting();
  $("menu-merge-state").textContent = !BACKEND.online
    ? "the shared map is out of reach"
    : waiting ? `${waiting} mark${waiting === 1 ? "" : "s"} waiting` : "in step with the shared map";
  $("vid-scale").textContent = `${Math.round(SETTINGS.renderScale * 100)}%`;
  $("vid-view").textContent =
    SETTINGS.viewDistance === 2 ? "near" : SETTINGS.viewDistance === 4 ? "far" : "standard";
  $("vid-full").textContent = document.fullscreenElement ? "leave" : "enter";
  $("aud-master").value = Math.round(SETTINGS.master * 100);
  $("aud-narration").value = Math.round(SETTINGS.narration * 100);
  $("aud-mute").textContent = sfx.muted ? "off" : "on";
  renderBindings();
}

// --- Start a New Game ---------------------------------------------------
// The reset is the game's own save model, cleared: the record a
// save copy carries (name, standings, the mark queues, the posted
// standing) plus the economy and the introduced-realms set. What
// stays is what a save copy never carried either: the phext.tech
// sign-in, the control prefs, the key bindings, the settings —
// machine keepings, not game progress. Then a reload, so the new
// game boots exactly as a brand-new player's does (the same door
// loadLocalSave takes).
const NEW_GAME_KEYS = [
  "nova-phox-guide",
  "nova-phox-name", "nova-phox-standings", "nova-phox-introduced",
  "nova-phox-outbox", "nova-phox-outbox-folded", "nova-phox-outbox-dropped",
  "nova-phox-posted", "nova-phox-economy", "nova-phox-eco-outbox",
];
function startNewGame() {
  for (const k of NEW_GAME_KEYS) {
    try { localStorage.removeItem(k); } catch (e) { /* private mode */ }
  }
  location.reload();
}

// --- Open to LAN ---------------------------------------------------------
// D2 rules LAN play for the download build. The honest state of
// this build: there is no LAN transport in it at all — no socket,
// no peer machinery, nothing to open. The item is wired to this
// state object, whose only truthful answer today is "closed, and
// cannot open"; when a transport lands, openToLan is where it
// plugs in, and the menu's state line will say "open" only when
// open is a fact.
const LAN = {
  transport: null, // no LAN transport exists in this build
  open: false,
  state() { return { open: this.open, available: this.transport !== null }; },
  openToLan() {
    if (!this.transport) return { ok: false, reason: "no-transport" };
    this.open = true;
    return { ok: true };
  },
};

// --- Save the world to .phext -------------------------------------------
// worldToPhext (world.js) serializes the actual subspace — opened
// pages, marks, things, monsters, the inscription log — as a real
// phext document; this is the download door, the same shape as the
// local save copy's.
function downloadWorldPhext() {
  const r = worldToPhext(sub, {
    player: playerName, score: totalScore(sub),
    exportedAt: new Date().toISOString(),
  });
  const blob = new Blob([r.text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nova-fox-world-${todayStr()}.phext`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  menuNote(`the world is written out — ${r.scrolls} scrolls, ${r.bytes} bytes, in the .phext file.`);
  return r;
}

// --- Merge the local game to fox.phext.io -------------------------------
// What a merge can mean here is what the shared chart holds:
// inscriptions (the mark queues), the standing, and the economy
// ledger — all append-only, all already carried by backendFlush,
// the same machinery the 20-second cycle runs. Merging overwrites
// nothing anywhere, so it needs no confirm gate; the one gate it
// does have is the platform's own: writing takes a phext.tech
// sign-in, and going to sign in is a second, deliberate click —
// never a surprise navigation out of the menu. What does NOT
// merge, because the chart holds no such thing: the local subspace
// itself (this session's pages and life) — the chart takes the
// written record of the world, not the world.
async function mergeToHosted() {
  menuNote("reaching for the shared map…");
  if (!BACKEND.probed || !BACKEND.online) await backendProbe();
  if (!BACKEND.online) {
    menuNote("can't reach fox.phext.io — nothing was merged. Your game stays whole on this machine.");
    return { merged: false, reason: "offline" };
  }
  if (!gameToken()) {
    if (!mergeArmed) {
      mergeArmed = true;
      menuNote("merging writes your marks to the shared chart under your phext.tech sign-in. Choose “Merge the local game” again to go and sign in — the game comes right back to this page.");
      return { merged: false, reason: "needs-signin" };
    }
    location.href = loginUrl();
    return { merged: false, reason: "signing-in" };
  }
  const before = marksWaiting() + ecoOutbox.length;
  await backendFlush();
  const after = marksWaiting() + ecoOutbox.length;
  const sent = before - after;
  refreshMenuStates();
  if (after === 0) {
    menuNote(sent > 0
      ? `merged — ${sent} entr${sent === 1 ? "y" : "ies"} reached the shared chart, and your standing stands there. Nothing is left waiting.`
      : "merged — there was nothing waiting; your standing stands on the shared chart.");
    return { merged: true, sent };
  }
  menuNote(`the merge stopped partway — ${sent} entr${sent === 1 ? "y" : "ies"} reached the shared chart, ${after} still waiting on this machine. Nothing was lost; merging again resumes it.`);
  return { merged: false, reason: "partial", sent, waiting: after };
}

// --- Quit -----------------------------------------------------------------
// What quitting can honestly be in a single-file build: try to
// close the window (browsers allow it only where a script opened
// the window), and otherwise land back on the title — the phext
// logo panel the game booted behind. The session's world is not
// destroyed by quitting; stepping past the title resumes it.
function quitToTitle() {
  closeMenu();
  narration.stop();
  if (document.exitPointerLock) document.exitPointerLock();
  try { window.close(); } catch (e) { /* most windows refuse */ }
  state.splash = true;
  const el = $("splash");
  if (el) el.style.display = "flex";
}

// --- Key bindings panel ---------------------------------------------------
function renderBindings() {
  const rows = BINDING_ACTIONS.map((a) => `
    <div class="setrow"><span>${a.label}</span>
    <button class="ghost bindbtn" data-action="${a.id}">${bindingCapture === a.id ? "press a key… (Esc cancels)" : keyName(BIND[a.id])}</button></div>`);
  rows.push(`
    <div class="setrow"><span>Walk — the scheme</span>
    <button class="ghost" id="bind-scheme">${state.scheme}</button></div>`);
  $("bindings-list").innerHTML = rows.join("");
}
$("bindings-list").addEventListener("click", (ev) => {
  if (ev.target.id === "bind-scheme") { $("btn-keys").click(); renderBindings(); return; }
  const b = ev.target.closest("button[data-action]");
  if (b) { bindingCapture = b.dataset.action; renderBindings(); markSelection(); }
});
$("bindings-reset").addEventListener("click", () => {
  for (const a of BINDING_ACTIONS) BIND[a.id] = a.def;
  saveBindings();
  bindingCapture = null;
  renderBindings();
  $("bindings-note").textContent = "the bindings are the defaults again.";
});
$("bindings-back").addEventListener("click", () => openPanel("menu"));

// --- Video + audio panels ---------------------------------------------------
const RENDER_SCALES = [1, 0.75, 0.5];
$("vid-scale").addEventListener("click", () => {
  const i = RENDER_SCALES.indexOf(SETTINGS.renderScale);
  SETTINGS.renderScale = RENDER_SCALES[(i + 1) % RENDER_SCALES.length];
  saveSettings();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * SETTINGS.renderScale);
  renderer.setSize(window.innerWidth, window.innerHeight);
  refreshMenuStates();
});
const VIEW_DISTANCES = [3, 4, 2];
$("vid-view").addEventListener("click", () => {
  const i = VIEW_DISTANCES.indexOf(SETTINGS.viewDistance);
  SETTINGS.viewDistance = VIEW_DISTANCES[(i + 1) % VIEW_DISTANCES.length];
  RENDER_R = SETTINGS.viewDistance; // chunk maintenance re-reads it every frame
  saveSettings();
  refreshMenuStates();
});
$("vid-full").addEventListener("click", () => {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else {
      const p = document.documentElement.requestFullscreen();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  } catch (e) { /* fullscreen unavailable here */ }
  setTimeout(refreshMenuStates, 300);
});
$("video-back").addEventListener("click", () => openPanel("menu"));
$("aud-master").addEventListener("input", (e) => {
  SETTINGS.master = Number(e.target.value) / 100;
  saveSettings();
  applyMasterVolume();
});
$("aud-narration").addEventListener("input", (e) => {
  SETTINGS.narration = Number(e.target.value) / 100;
  saveSettings();
  applyNarrationVolume();
});
$("aud-mute").addEventListener("click", () => {
  $("btn-sound").click(); // the one mute, shared with the sound button
  refreshMenuStates();
});
$("audio-back").addEventListener("click", () => openPanel("menu"));

// --- The menu's own rows ----------------------------------------------------
$("btn-menu").addEventListener("click", () => toggleMenu());
$("menu-close").addEventListener("click", () => { closeMenu(); lockPointer(); });
$("menu-newgame").addEventListener("click", () => {
  newGameArmed = true;
  syncMenuConfirm();
  panelFocus = { panel: "menu", index: 0 };
  markSelection();
});
$("menu-confirm-no").addEventListener("click", () => {
  newGameArmed = false;
  syncMenuConfirm();
  panelFocus = { panel: "menu", index: 0 };
  markSelection();
});
$("menu-confirm-yes").addEventListener("click", () => startNewGame());
$("menu-lan").addEventListener("click", () => {
  const r = LAN.openToLan();
  menuNote(r.ok
    ? "open to LAN — this session can be joined from the local network."
    : "Open to LAN: this build has no LAN transport yet, so nothing was opened. LAN play is ruled for the download build (D2) and is still being built.");
  refreshMenuStates();
});
$("menu-savephext").addEventListener("click", () => downloadWorldPhext());
$("menu-merge").addEventListener("click", () => { mergeToHosted(); });
$("menu-keys").addEventListener("click", () => openPanel("bindings-panel"));
$("menu-video").addEventListener("click", () => openPanel("video-panel"));
$("menu-audio").addEventListener("click", () => openPanel("audio-panel"));
$("menu-quit").addEventListener("click", () => quitToTitle());

// ---------- the load panel (feedback #15) --------------------------------------
// First thing on the page: the phext logo panel. The game boots
// behind it; any click or key steps it aside — the bypass is the
// whole interaction, no timer, no trap.
function dismissSplash() {
  if (!state.splash) return;
  state.splash = false;
  trailDone();
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
  const wasLocked = pointerLocked;
  pointerLocked = document.pointerLockElement === renderer.domElement;
  // EE 995 (item 2): while pointer-locked the browser reserves
  // Esc for itself — the keydown never reaches the page; the lock
  // simply ends, and the menu (complete since demo13) never got
  // its key. So the unlock IS the player's Esc: answer it with
  // the menu. The menu's back-to-the-world row re-locks (below),
  // and the touch menu button never needed the lock at all.
  if (wasLocked && !pointerLocked && !state.splash && !menuIsOpen() &&
      !nfCon.open && !bindingCapture) {
    openPanel("menu");
  }
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
    banterAirStart = performance.now();
    banterAirX = state.pos.x; banterAirY = state.pos.y; banterAirZ = state.pos.z;
    banterAirFired = false;
    banterFire({ type: "jump",
      pauseBeforeMs: banterLastPauseMs,
      sincePauseEndMs: banterPauseEndAt > 0 ? performance.now() - banterPauseEndAt : Infinity });
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
  // The Esc menu's key capture (2026-11-26): while a binding waits
  // for its key, the next keydown IS the answer — Escape cancels,
  // a reserved key is refused with its reason, anything else is
  // assigned (swapping with whatever held it).
  if (bindingCapture) {
    e.preventDefault();
    if (e.code !== "Escape") {
      const why = RESERVED_BIND_CODES[e.code];
      if (why) {
        $("bindings-note").textContent = `${keyName(e.code)} ${why}.`;
      } else {
        setBinding(bindingCapture, e.code);
        $("bindings-note").textContent = "";
      }
    }
    bindingCapture = null;
    renderBindings();
    markSelection();
    return;
  }
  // While a menu panel is up, the keyboard works the menu.
  if (menuIsOpen()) { handleMenuKey(e); return; }
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
  // The remappable verbs consult the binding store (Esc menu, 2026-11-26).
  if (e.code === BIND.jump) { doJump(); return; }
  if (e.code === BIND.flip) { flipGravityHere(); return; }
  if (e.code === BIND.strike) {
    // In AWEF, F walks forward — while the strike is bound to F,
    // it lives on the click there, as before.
    if (!(state.scheme === "AWEF" && BIND.strike === "KeyF")) tryStrike();
    return;
  }
  if (e.code === BIND.chisel || e.code === "KeyX") { tryChisel(); return; }
  if (e.code === BIND.brushDown) { cycleBrush(-1); return; }
  if (e.code === BIND.brushUp) { cycleBrush(1); return; }
  if (e.code === BIND.lamp) { toggleLamp(); return; }
  if (e.code === BIND.board) { toggleBoard(); return; }
  if (e.code === BIND.realms) { toggleRealms(); return; }
  if (e.code === BIND.log) {
    const el = $("readout");
    el.style.display = el.style.display === "none" ? "block" : "none";
    return;
  }
  switch (e.code) {
    case "Escape":
      if (state.introOpen) closeIntroViewer(); else toggleMenu();
      break;
    case "KeyC": case "KeyX": tryChisel(); break;
    case "Comma": cycleBrush(-1); break;
    case "Period": cycleBrush(1); break;
    case "KeyV": toggleLamp(); break;
    case "KeyN": toggleFoxVision(); break;
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
// Portal panel rows (item 4): a click — or Enter on a focused row —
// brings that realm's portal up where the fox stands.
$("realms-list").addEventListener("click", (e) => {
  const row = e.target.closest("[data-portal]");
  if (!row) return;
  toggleRealms(false);
  openRift({ type: "realm", realmId: row.dataset.portal });
});
$("realms-list").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const row = e.target.closest("[data-portal]");
  if (!row) return;
  toggleRealms(false);
  openRift({ type: "realm", realmId: row.dataset.portal });
});
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
  if (state.guideDone) { state.guideDone = false; state.guideStep = GUIDE.length - 2; saveGuide(); }
  renderGuide();
});
$("btn-sound").addEventListener("click", (e) => {
  sfx.muted = !sfx.muted;
  applyMasterVolume();
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
syncSchemeControls();
$("btn-keys").addEventListener("click", () => {
  setScheme(otherScheme(state.scheme));
  toast(state.scheme === "AWEF"
    ? "Keys: A W E F — F walks forward in this scheme, so strike with the click."
    : "Keys: W A S D.", 4000);
});
// The same choice on the title panel (demo19): the splash is where a
// player first lands, so the scheme can be set before the first
// step is taken. The press is claimed at the button — mousedown and
// touchstart are stopped here so the document's any-press-steps-
// aside handlers never see it, and the click itself is stopped so
// the panel's own click-to-dismiss never fires. Setting the scheme
// must not start the game by accident.
{
  const schemeBtn = $("btn-scheme-splash");
  if (schemeBtn) {
    schemeBtn.addEventListener("mousedown", (e) => e.stopPropagation());
    schemeBtn.addEventListener("touchstart", (e) => e.stopPropagation(),
      { passive: true });
    schemeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setScheme(otherScheme(state.scheme));
      toast(state.scheme === "AWEF"
        ? "Keys: A W E F — F walks forward in this scheme, so strike with the click."
        : "Keys: W A S D.", 4000);
    });
  }
}
// The version (2026-11-26): the ship stamp speaks two ways, both
// from the one SHIP_EE above. The number stands on screen at all
// times in #ee-line, on the title's own line in the title
// cluster — Will ruled it always visible for play testing, so it
// never rides the extras toggle and never waits for a hover. The full
// reading stays as hover text on the standing realm title: a
// mouse resting on the title fades the tip in beneath the
// cluster, in the game's own floating dress; on touch, a tap on
// the title toggles it (the tap is claimed here, so it never
// falls through to the world's tap-as-click).
$("ver-line1").textContent = `Nova Fox — EE ${SHIP_EE}`;
$("ee-line").textContent = `EE ${SHIP_EE}`;
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
  saveGuide();
  narration.stop(); // exploring on your own means Emise stops talking
  banterGoLive(); // — and Joy's ambient voice starts
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
    ? { f: "KeyF", b: "KeyA", l: "KeyW", r: "KeyE" }
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
tBtn("t-vision", () => toggleFoxVision());
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
  if (state.transit) transitStep(now, dt); // EE 995: walking the passage
  else if (!state.dead) riftStep(now, dt);
  updateInvertFx(now);
  // Fox Vision is a Hall sense: leaving the Hall puts it down,
  // silently, the same quiet with which it refused to wake outside.
  if (state.foxVision && !playerInHall()) state.foxVision = false;
  banterObserveTick(now);
  chunkMaintenance();
  syncMonsterMeshes(dt);
  syncItemMeshes(now);
  stepJoy(now, dt); // EE 995 (item 8): Joy keeps her place
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
  updateGuardianEncounter();
  // The quest: reaching the stone is checked against the subspace.
  if (!sub.questDone) {
    const bx = Math.floor(state.pos.x), bz = Math.floor(state.pos.z);
    if (inDungeon(bx, bz) && !inDungeonBefore) {
      playBeat("BEAT-barrow");
      toast(BEAT_LINES["BEAT-barrow"], 7000);
      banterHallEnterAt = performance.now();
      banterFire({ type: "hallEnter", first: !banterHallVisited, walkedAboveBefore: banterWasAbove });
      banterHallVisited = true;
    }
    inDungeonBefore = inDungeon(bx, bz);
    if (sub.checkQuest(bx, Math.floor(state.pos.y), bz)) {
      playBeat("BEAT-quest");
      banterFire({ type: "quest",
        hallTimeMs: banterHallEnterAt ? performance.now() - banterHallEnterAt : 0 });
      sfx.chime();
      sfx.melody([1, 4, 9, 11, 9], { gap: 130 }); // v5: the quest fanfare (#13)
      flashPortal();
      toast(BEAT_LINES["BEAT-quest"], 9000);
      guideNotify("quest");
      syncHud();
      syncReadout();
    }
  }
  questWasDone = sub.questDone;
  speedrunTick(now);
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
restoreGuide(); // EE 995 (item 1): resume the lesson where this game left it
renderGuide();
buildJoy(); // EE 995 (item 8): Joy takes her place at the fox's shoulder
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
toast(BEAT_LINES["BEAT-arrival"], 6000);
// The chart-line: probe now, re-probe and flush every 20 s. Offline
// is a first-class state (the ranch itself goes dark some days):
// play never waits on it.
backendProbe().then(() => backendFlush()).then(trailDone, trailDone);
setInterval(() => { backendProbe().then(() => backendFlush()); }, 20000);
setInterval(() => { ecoTick(); recordStandings(); syncHud(); }, 5000);

// ---------- the test console (Will, 2026-11-26) ---------------------------
// "Build the e2e testing into the game itself — give me a console
// I can work with." The external harness walked portals dead-center
// from a flat spawn for three builds while real traversal was
// broken (PORTAL-DIAGNOSIS.md), and the harness itself aborts.
// So the checks live here now, in the real client, run by a person
// standing in the real world. Every command below calls the game's
// own systems and prints what it measured; nothing is simulated.
// In this build the veer and slope legs are EXPECTED to fail —
// demo5's crossing test is the diagnosed one — and the console's
// whole job is to make that visible from inside, with numbers,
// until the traversal fix reconciles into a later tree.
//
// Toggle: Backquote (`) — checked free against the keydown switch,
// LETTER_KEYS and NUMBER_KEYS, and the touch layer. While the
// console is open, capture-phase handlers keep every keystroke
// out of the game (no notes sounded, no walking) and the fox's
// held keys are cleared, so opening it mid-stride stops him.
// Closing it hands the keys back untouched.
const NF_TRIGGER2 = 1.25; // riftStep's crossing test in this build:
                          // dist2 < 1.25, a radius of ~1.118 blocks.
                          // If the traversal fix changes riftStep,
                          // it must change this with it — the
                          // geometry command exists to catch drift.
const nfCon = {
  open: false, busy: false, history: [], hIdx: -1,
  el: $("nfconsole"), out: $("nfconsole-out"), input: $("nfconsole-input"),
};
function nfPrint(text, cls = "") {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = text;
  nfCon.out.appendChild(line);
  nfCon.out.scrollTop = nfCon.out.scrollHeight;
}
function nfConsoleToggle(force) {
  const want = force !== undefined ? !!force : !nfCon.open;
  if (want === nfCon.open) return;
  nfCon.open = want;
  nfCon.el.style.display = want ? "block" : "none";
  if (want) {
    keys.clear();
    wTap = null;
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    setTimeout(() => nfCon.input.focus(), 0);
    if (!nfCon.out.childNodes.length)
      nfPrint("the game's own checks, in the client. help lists them.", "dim");
  } else {
    nfCon.input.blur();
  }
}
document.addEventListener("keydown", (e) => {
  if (e.code === "Backquote") {
    if (state.splash) return; // any key steps the splash aside first
    e.preventDefault();
    e.stopPropagation();
    nfConsoleToggle();
    return;
  }
  if (!nfCon.open) return;
  e.stopPropagation(); // the game never sees a console keystroke
  if (e.code === "Escape") { nfConsoleToggle(false); return; }
  if (e.target === nfCon.input) {
    if (e.code === "Enter") {
      e.preventDefault();
      const line = nfCon.input.value;
      nfCon.input.value = "";
      nfConsoleRun(line);
    } else if (e.code === "ArrowUp") {
      e.preventDefault();
      if (nfCon.hIdx > 0) { nfCon.hIdx--; nfCon.input.value = nfCon.history[nfCon.hIdx] || ""; }
    } else if (e.code === "ArrowDown") {
      e.preventDefault();
      if (nfCon.hIdx < nfCon.history.length) { nfCon.hIdx++; nfCon.input.value = nfCon.history[nfCon.hIdx] || ""; }
    }
  }
}, true);
document.addEventListener("keyup", (e) => {
  if (nfCon.open) e.stopPropagation();
}, true);
nfCon.el.addEventListener("click", (e) => {
  if (e.target !== $("nfconsole-close")) nfCon.input.focus();
});
$("nfconsole-close").addEventListener("click", () => nfConsoleToggle(false));
$("btn-console").addEventListener("click", () => nfConsoleToggle());

// --- readouts: the facts a playtester needs, read off live state ---------
function nfCmdWhere() {
  const { sx, sy } = playerScroll();
  nfPrint(`${realmName(state.realm)} (${state.realm}) · pos ${state.pos.x.toFixed(1)}, ${state.pos.y.toFixed(1)}, ${state.pos.z.toFixed(1)} · scroll ${sx},${sy} · block ${Math.floor(state.pos.x)}, ${Math.floor(state.pos.y)}, ${Math.floor(state.pos.z)} · facing ${(state.yaw * 180 / Math.PI).toFixed(0)}° · keys: ${state.scheme}`);
}
function nfCmdGravity() {
  const { sx, sy } = playerScroll();
  const g = sub.gravityOf(state.realm, sx, sy);
  nfPrint(`you hang ${state.gravDir > 0 ? "down" : "UP"} (gravDir ${state.gravDir}) · subspace: scroll ${sx},${sy} of ${state.realm} declares ${g > 0 ? "down" : "UP"} (gravityOf ${g}) · the two ${state.gravDir === g ? "agree" : "differ"}`);
}
function nfCmdPurse() {
  const e = eco, t = e.entitlement;
  nfPrint(`purse: ${e.tokens} flux · ${e.credits} credit${e.credits === 1 ? "" : "s"} · tier ${t.status}${t.source ? ` (${t.source})` : ""}${t.purchaseNumber ? ` · purchase #${t.purchaseNumber}` : ""} · lifetime earned ${e.lifetime.tokensEarned} flux / ${e.lifetime.creditsEarned} credits`);
}
function nfCmdVersion() {
  nfPrint(`Nova Fox — EE ${SHIP_EE}: the epoch this build shipped within (stamp token ${NF_SHIP_EE}, standing in #ee-line).`);
}
function nfCmdPortal() {
  const r = state.rift, link = state.riftLink;
  if (!r || !link) { nfPrint("no rift standing."); return; }
  nfPrint(`rift link #${link.id} · end ${r.end} standing · target ${r.target.type}${r.target.realmId ? " " + r.target.realmId : ""} · crosses ${link.crosses} · ring at ${r.x.toFixed(1)}, ${r.z.toFixed(1)}, feetY ${r.feetY.toFixed(2)} · armed ${r.armed} · view ${r.viewOk ? "live" : "tint fallback"}`);
  if (r.geo) nfPrint(`  geometry: radius ${r.geo.radius.toFixed(4)} · disc ${r.geo.disc.toFixed(3)} · segments ${r.geo.segments} · subspace distance ${r.geo.distance ? r.geo.distance.toFixed(3) : "?"}`);
  if (r.viewOk && portalRT && portalView) {
    renderPortalView(performance.now(), true);
    const w = portalRT.width, h = portalRT.height;
    const buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(portalRT, 0, 0, w, h, buf);
    const fog = paletteFor(portalView.dest.realmId).fog;
    const fr = (fog >> 16) & 255, fg = (fog >> 8) & 255, fb = fog & 255;
    let paleCool = 0, nonFog = 0;
    for (let i = 0; i < buf.length; i += 4) {
      const pr = buf[i], pg = buf[i + 1], pb = buf[i + 2];
      if (pb > pr + 25 && pb > 120) paleCool++;
      if (Math.abs(pr - fr) + Math.abs(pg - fg) + Math.abs(pb - fb) > 24) nonFog++;
    }
    nfPrint(`  portal view pixels (measured off the render target): pale-cool ${paleCool} · non-fog ${nonFog} · of ${w * h}`);
  }
}

// --- checks: the unit suite's pins, against the live functions -----------
function nfCheckGeometry() {
  const g = riftRingGeometry("nova", "ashfall");
  const trigR = Math.sqrt(NF_TRIGGER2);
  const deadPct = (1 - NF_TRIGGER2 / (g.disc * g.disc)) * 100;
  nfPrint(`  ring geometry, nova→ashfall, from riftRingGeometry itself: radius ${g.radius.toFixed(4)} · disc ${g.disc.toFixed(3)} · segments ${g.segments}`);
  nfPrint(`  the crossing test in this build admits radius ${trigR.toFixed(3)} of that ${g.disc.toFixed(3)} disc — the outer ${deadPct.toFixed(1)}% of the visible portal is dead ground.`);
  const ok = Math.abs(g.radius - 1.5571) < 0.001 && g.segments === 36;
  nfPrint(ok
    ? "  PASS  the live function still returns the unit suite's pinned geometry (radius 1.5571 ±0.001, 36 segments)."
    : `  FAIL  geometry drifted from the unit pin (radius 1.5571, 36 segments) — measured radius ${g.radius.toFixed(4)}, segments ${g.segments}.`, ok ? "pass" : "fail");
  return ok ? "pass" : "fail";
}
function nfCheckBridge() {
  const { sx, sy } = playerScroll();
  const t = chordTarget(sub, state.realm, sx, sy, [...BRIDGE_CHORD], state.pocketChord);
  const ok = t.type === "realm" && t.realmId !== state.realm;
  nfPrint(`  the bridge tune (1, 4, 9) from ${state.realm} scroll ${sx},${sy} resolves, by chordTarget itself, to ${t.type}${t.realmId ? " " + t.realmId : ""}.`);
  nfPrint(ok ? "  PASS  it names the other open realm." : "  FAIL  it does not name another realm from here.", ok ? "pass" : "fail");
  return ok ? "pass" : "fail";
}

// --- traversal probes: the diagnosis, runnable from where you stand ------
// Open the bridge rift by playing its tune through the real
// instrument path (playNote -> playChord -> openRift) — the same
// path a player's fingers take. The pending-note buffer is
// cleared first, and the fact is printed: a half-played tune of
// the player's must not silently join the probe's chord.
function nfOpenBridgeRift() {
  state.notes = [];
  clearTimeout(state.notesTimer);
  for (const n of BRIDGE_CHORD) playNote(n);
  return state.rift || null;
}
// Walk the fox forward — the forward key in the same keys set
// updatePlayer reads, so the real physics, collision and
// riftStep do the walking — until he crosses, the rift folds,
// he falls, or the clock runs out. His distance to the ring's
// center is sampled on the game's own animation frames (plus a
// slow backstop in case frames stall), so the closest approach
// printed is the closest riftStep itself ever saw — the quantity
// that decides crossing — not a timer's guess between frames.
// Resolves with measurements, never a bare verdict.
function nfWalkProbe(timeoutMs) {
  return new Promise((resolve) => {
    const r = state.rift;
    if (!r) return resolve({ error: "no rift standing" });
    const fwdCode = state.scheme === "AWEF" ? "KeyF" : "KeyW"; // the scheme's own forward key — canonical AWEF walks forward on F
    const startRealm = state.realm;
    const crosses0 = state.riftLink ? state.riftLink.crosses : 0;
    const ring = { x: r.x, z: r.z, feetY: r.feetY };
    let minD = Infinity, dyAtMin = null, done = false;
    const t0 = performance.now();
    const finish = (flags) => {
      if (done) return;
      done = true;
      keys.delete(fwdCode);
      resolve({ ...flags, minD, dyAtMin,
        ms: Math.round(performance.now() - t0), realm: state.realm });
    };
    const tick = () => {
      if (done) return;
      const dx = state.pos.x - ring.x, dz = state.pos.z - ring.z;
      const d = Math.hypot(dx, dz);
      if (d < minD) { minD = d; dyAtMin = (state.pos.y - 1.01) - ring.feetY; }
      const crossed = state.realm !== startRealm ||
        (state.riftLink && state.riftLink.crosses > crosses0);
      const folded = !state.rift && !crossed;
      if (crossed || folded || state.dead || performance.now() - t0 > timeoutMs) {
        finish({ crossed, folded, dead: !!state.dead });
        return;
      }
      requestAnimationFrame(tick);
    };
    keys.add(fwdCode);
    requestAnimationFrame(tick);
    const backstop = setInterval(() => {
      if (done) { clearInterval(backstop); return; }
      tick();
    }, 100);
  });
}
function nfWalkFailLine(w, disc) {
  if (w.dead) return "  FAIL  the fox went down mid-probe — no crossing measured.";
  if (w.folded) return `  FAIL  the rift folded (leash) before any crossing — closest approach ${w.minD.toFixed(3)}.`;
  return `  FAIL  no crossing in ${(w.ms / 1000).toFixed(1)}s — closest approach ${w.minD.toFixed(3)} against a trigger radius of ${Math.sqrt(NF_TRIGGER2).toFixed(3)} and a visible disc of ${disc.toFixed(3)}${w.minD < disc ? " — he passed through the visible portal and it did not take him" : ""}; |dy| at closest ${Math.abs(w.dyAtMin).toFixed(2)} against a gate of 2.4.`;
}
async function nfLegStraight() {
  nfPrint("rift-straight: the bridge tune, walked dead-center — the control leg, the harness's own pattern.");
  if (state.dead) { nfPrint("  NOT RUN  the fox is down.", "fail"); return "notrun"; }
  const r = nfOpenBridgeRift();
  if (!r) { nfPrint("  FAIL  no rift opened — the tune answered otherwise from here.", "fail"); return "fail"; }
  nfPrint(`  ring stands ahead at ${r.x.toFixed(1)}, ${r.z.toFixed(1)} · disc radius ${r.geo.disc.toFixed(3)} · ring feetY ${r.feetY.toFixed(2)}. walking…`);
  const w = await nfWalkProbe(12000);
  if (w.crossed) {
    nfPrint(`  PASS  crossed to ${realmName(w.realm)} in ${(w.ms / 1000).toFixed(1)}s; closest approach ${w.minD.toFixed(3)}.`, "pass");
    return "pass";
  }
  nfPrint(nfWalkFailLine(w, r.geo.disc), "fail");
  return "fail";
}
async function nfLegVeer(deg) {
  nfPrint(`rift-veer: open the bridge rift, turn ${deg}°, walk — the approach a player actually makes.`);
  if (state.dead) { nfPrint("  NOT RUN  the fox is down.", "fail"); return "notrun"; }
  const r = nfOpenBridgeRift();
  if (!r) { nfPrint("  FAIL  no rift opened — the tune answered otherwise from here.", "fail"); return "fail"; }
  const disc = r.geo.disc;
  state.yaw += deg * Math.PI / 180;
  nfPrint(`  veered ${deg}° (a ruler-straight line now misses the ring's center by ~${(3.4 * Math.sin(deg * Math.PI / 180)).toFixed(2)} blocks). walking…`);
  const w = await nfWalkProbe(12000);
  if (w.crossed) {
    nfPrint(`  PASS  crossed to ${realmName(w.realm)} in ${(w.ms / 1000).toFixed(1)}s; closest approach ${w.minD.toFixed(3)} of a ${disc.toFixed(3)} disc.`, "pass");
    return "pass";
  }
  nfPrint(nfWalkFailLine(w, disc), "fail");
  return "fail";
}
function nfFindSlope() {
  const g0 = heightAt(state.realm, Math.floor(state.pos.x), Math.floor(state.pos.z));
  let best = { yaw: state.yaw, rise: -Infinity, g0, gR: g0 };
  for (let i = 0; i < 36; i++) {
    const yaw = (i / 36) * Math.PI * 2;
    const rx = state.pos.x - Math.sin(yaw) * 3.4;
    const rz = state.pos.z - Math.cos(yaw) * 3.4;
    const gR = heightAt(state.realm, Math.floor(rx), Math.floor(rz));
    if (gR - g0 > best.rise) best = { yaw, rise: gR - g0, g0, gR };
  }
  return best;
}
async function nfLegSlope() {
  nfPrint("rift-slope: the steepest rise within one rift's reach of where you stand, opened uphill, walked dead-center.");
  if (state.dead) { nfPrint("  NOT RUN  the fox is down.", "fail"); return "notrun"; }
  const spot = nfFindSlope();
  nfPrint(`  steepest rise from here, measured off heightAt: ${spot.rise.toFixed(2)} blocks across the 3.4-block gap (ground ${spot.g0} → ${spot.gR}).`);
  if (spot.rise < 2.4) {
    nfPrint("  NOT RUN  no direction from here rises the 2.4 blocks the height gate cares about — stand on a hillside and run it again.", "dim");
    return "notrun";
  }
  state.yaw = spot.yaw;
  const r = nfOpenBridgeRift();
  if (!r) { nfPrint("  FAIL  no rift opened — the tune answered otherwise from here.", "fail"); return "fail"; }
  nfPrint(`  ring feetY is ${r.feetY.toFixed(2)} — in this build the ring's height is anchored to the ground where the tune was played, while the ground at the ring itself is ${spot.gR}. walking…`);
  const w = await nfWalkProbe(12000);
  if (w.crossed) {
    nfPrint(`  PASS  crossed to ${realmName(w.realm)} in ${(w.ms / 1000).toFixed(1)}s up a ${spot.rise.toFixed(2)}-block rise; closest approach ${w.minD.toFixed(3)}, |dy| there ${Math.abs(w.dyAtMin).toFixed(2)}.`, "pass");
    return "pass";
  }
  nfPrint(nfWalkFailLine(w, r.geo.disc), "fail");
  nfPrint(`  the two gates, measured: distance ${w.minD.toFixed(3)} vs trigger ${Math.sqrt(NF_TRIGGER2).toFixed(3)} — ${w.minD < Math.sqrt(NF_TRIGGER2) ? "met" : "NOT met"} · height |dy| ${Math.abs(w.dyAtMin).toFixed(2)} vs 2.4 — ${Math.abs(w.dyAtMin) < 2.4 ? "met" : "NOT met"}.`, "dim");
  return "fail";
}
async function nfRunAll() {
  nfPrint("runall: every in-client check, in order. Every number below is measured in this client, just now.");
  const results = [];
  nfPrint("geometry:"); results.push(["geometry", nfCheckGeometry()]);
  nfPrint("bridge:"); results.push(["bridge tune", nfCheckBridge()]);
  results.push(["rift-straight", await nfLegStraight()]);
  results.push(["rift-veer", await nfLegVeer(20)]);
  results.push(["rift-slope", await nfLegSlope()]);
  const p = results.filter((r) => r[1] === "pass").length;
  const f = results.filter((r) => r[1] === "fail").length;
  const n = results.filter((r) => r[1] === "notrun").length;
  nfPrint(`runall: ${p} passed, ${f} failed, ${n} not run — ${results.map((r) => `${r[0]}: ${r[1]}`).join(" · ")}`, f ? "fail" : "pass");
  return f ? "fail" : "pass";
}
const NF_COMMANDS = {
  help: { usage: "help — this list", run: () => { for (const c of Object.values(NF_COMMANDS)) nfPrint(`  ${c.usage}`, "dim"); } },
  where: { usage: "where — realm, position, scroll, facing", run: () => nfCmdWhere() },
  gravity: { usage: "gravity — your orientation and the subspace value under you", run: () => nfCmdGravity() },
  purse: { usage: "purse — flux, credits, tier, lifetime", run: () => nfCmdPurse() },
  version: { usage: "version — this build's ship EE", run: () => nfCmdVersion() },
  state: { usage: "state — where + gravity + purse", run: () => { nfCmdWhere(); nfCmdGravity(); nfCmdPurse(); } },
  portal: { usage: "portal — the standing rift: link, geometry, view pixels", run: () => nfCmdPortal() },
  geometry: { usage: "geometry — ring geometry vs the unit pin; the dead band, measured", run: () => nfCheckGeometry() },
  bridge: { usage: "bridge — the bridge tune's target, resolved live", run: () => nfCheckBridge() },
  "rift-straight": { usage: "rift-straight — open the bridge rift, walk dead-center (control)", probe: true, run: () => nfLegStraight() },
  "rift-veer": { usage: "rift-veer [deg] — open, veer (default 20°), walk", probe: true, run: (args) => nfLegVeer(Math.min(45, Math.max(1, Number(args[0]) || 20))) },
  "rift-slope": { usage: "rift-slope — open uphill on the steepest rise at hand, walk dead-center", probe: true, run: () => nfLegSlope() },
  runall: { usage: "runall — geometry, bridge, and all three traversal legs", probe: true, run: () => nfRunAll() },
  clear: { usage: "clear — empty the pane", run: () => { nfCon.out.innerHTML = ""; } },
};
async function nfConsoleRun(line) {
  const trimmed = (line || "").trim();
  if (!trimmed) return;
  nfCon.history.push(trimmed);
  nfCon.hIdx = nfCon.history.length;
  nfPrint(`> ${trimmed}`, "cmd");
  const [name, ...args] = trimmed.split(/\s+/);
  const cmd = NF_COMMANDS[name.toLowerCase()];
  if (!cmd) { nfPrint("no such command — help lists them.", "fail"); return; }
  if (cmd.probe && nfCon.busy) { nfPrint("a probe is already walking — let it finish.", "fail"); return; }
  if (cmd.probe) nfCon.busy = true;
  try { await cmd.run(args); }
  catch (err) { nfPrint(`  ERROR  ${err && err.message ? err.message : err}`, "fail"); }
  finally { if (cmd.probe) nfCon.busy = false; }
}
// ---------- speedrun mode (demo16) -------------------------------------
// Will's spec (2026-11-26): "include modes for speed runners to
// play and record and stream their telemetry." The pure logic —
// what a run is, what its recording says, how a recording checks
// out — lives in speedrun.js; this section owns the clock, the
// panel, and the socket. The run's terms, stated there for Will's
// ratification: arm at Arrival in a clean state, the clock starts
// on your first movement, and the finish is standing at the Deep
// Stone — tested against the stone's own near-box every frame, so
// a run repeats even after the quest itself is done.
const sr = {
  phase: "idle", // idle | armed | running | finished
  t0: 0,
  finalMs: null,
  rec: null,
  movedAtArm: 0,
  lastT: 0,
  lastRealm: state.realm,
  wasDead: false,
  wasInDungeon: false,
  lastPosAt: 0,
  lastTeleAt: 0,
  splitsHit: new Set(),
  ws: null,
  wsState: "closed", // closed | connecting | open
};
const SR_RUNS_KEY = "nova-phox-runs";
function srRecordings() { return LS.get(SR_RUNS_KEY, []); }
function srSaveRecording(rec) {
  const all = srRecordings();
  all.push(rec);
  while (all.length > 20) all.shift(); // the last twenty runs stand
  LS.set(SR_RUNS_KEY, all);
}

// The stream is a witness, never a gate: a dead socket must never
// touch the run, so every send is wrapped and silent on failure.
function srSend(type, payload = {}) {
  if (sr.ws && sr.ws.readyState === 1) {
    try { sr.ws.send(telemetryMessage(type, payload)); } catch (e) { /* witness only */ }
  }
}
function srStreamConnect(url) {
  srStreamClose();
  sr.wsState = "connecting";
  srRenderPanel();
  let ws;
  try { ws = new WebSocket(url); } catch (e) {
    sr.wsState = "closed";
    srRenderPanel();
    return false;
  }
  sr.ws = ws;
  ws.onopen = () => {
    sr.wsState = "open";
    srRenderPanel();
    srSend("hello", { player: playerName, shipEE: SHIP_EE });
  };
  ws.onclose = () => {
    if (sr.ws === ws) { sr.ws = null; sr.wsState = "closed"; srRenderPanel(); }
  };
  ws.onerror = () => { /* onclose follows and tells the story */ };
  return true;
}
function srStreamClose() {
  if (sr.ws) { try { sr.ws.close(); } catch (e) { /* already gone */ } sr.ws = null; }
  sr.wsState = "closed";
}

function speedrunArm() {
  dismissSplash();
  // A clean, defined start: Arrival in Nova Prime, whole, no notes
  // carried, gravity down, standing at spawn. The shared world is
  // NOT touched — a run is a way of travelling it, not a reset of
  // it; standings, purse, and marks all stand.
  state.realm = "nova";
  state.pos.set(
    ARRIVAL.nova.x + 0.5,
    heightAt("nova", ARRIVAL.nova.x, ARRIVAL.nova.z) + 1.01,
    ARRIVAL.nova.z + 0.5);
  state.vel.set(0, 0, 0);
  state.hp = state.maxHp;
  state.dead = false;
  state.notes = [];
  state.gravDir = 1;
  const { sx, sy } = playerScroll();
  ensureNeighborhood("nova", sx, sy);
  sr.phase = "armed";
  sr.rec = null;
  sr.finalMs = null;
  sr.splitsHit = new Set();
  sr.movedAtArm = state.movedTotal;
  sr.lastRealm = state.realm;
  sr.wasDead = false;
  sr.wasInDungeon = false;
  srSend("run-armed", { player: playerName });
  srRenderTimer(performance.now());
  srRenderPanel();
  toast("Speed run armed — the clock starts when you move. Reach the Deep Stone.", 6000);
}

// The run's one clock. Events are stamped when the code that
// reports them runs — a frame's start time would lie about its
// own late beats (a slow frame spans seconds under load, and its
// beats land ahead of its frame stamp, which put a real stream
// out of order in testing). One clock, clamped so a stream can
// never run backwards.
function srNow() {
  const t = performance.now() - sr.t0;
  if (t > sr.lastT) sr.lastT = t;
  return sr.lastT;
}

function srStart(now) {
  sr.t0 = now;
  sr.lastT = 0;
  sr.phase = "running";
  sr.lastPosAt = -250; // the first sample lands on the first frame
  sr.lastTeleAt = -500;
  sr.rec = newRunRecording({
    player: playerName,
    shipEE: SHIP_EE,
    startedAt: new Date().toISOString(),
    stone: DUNGEON.deepStone,
  });
  recEvent(sr.rec, 0, "start", { realm: state.realm });
  srSend("run-start", { player: playerName });
  srRenderPanel();
}

function srFinish(now) {
  if (sr.phase !== "running") return;
  const t = srNow();
  sr.phase = "finished";
  sr.finalMs = Math.round(t);
  recEvent(sr.rec, t, "finish", { x: state.pos.x, y: state.pos.y, z: state.pos.z });
  srSaveRecording(sr.rec);
  srSend("run-finish", {
    player: playerName,
    finishMs: sr.finalMs,
    splits: sr.rec.events.filter((e) => e.k === "split").map((e) => ({ beat: e.beat, atMs: e.t })),
  });
  toast(`Run complete — ${formatRunTime(sr.finalMs)}. It's written down.`, 8000);
  srRenderTimer(now);
  srRenderPanel();
}

function speedrunAbort() {
  if (sr.phase === "running" && sr.rec) {
    const t = srNow();
    recEvent(sr.rec, t, "abort", {});
    srSend("run-abort", { player: playerName, elapsedMs: Math.round(t) });
  }
  // An aborted run is not written into the standings — only a
  // finished run is a record. The stream hears about it; the
  // book does not keep it.
  sr.phase = "idle";
  sr.rec = null;
  srRenderTimer(performance.now());
  srRenderPanel();
}

// The frame's word on the run, called from animate() beside the
// quest check: start on first movement, sample the path, watch
// the crossings and the deaths, feed the stream, test the finish.
function speedrunTick(now) {
  if (sr.phase === "armed" && state.movedTotal > sr.movedAtArm) srStart(now);
  if (sr.phase === "running") {
    const t = srNow();
    if (t - sr.lastPosAt >= 250) {
      sr.lastPosAt = t;
      recEvent(sr.rec, t, "pos", {
        realm: state.realm,
        x: state.pos.x, y: state.pos.y, z: state.pos.z,
        hp: state.hp, grav: state.gravDir,
      });
    }
    if (state.realm !== sr.lastRealm) {
      recEvent(sr.rec, t, "cross", { from: sr.lastRealm, to: state.realm });
      sr.lastRealm = state.realm;
    }
    if (state.dead && !sr.wasDead) recEvent(sr.rec, t, "death", {});
    sr.wasDead = state.dead;
    // The barrow split: the narration beat is quest-gated (it
    // speaks only until the quest is done), but the milestone is
    // the doorway itself — so the tick watches the doorway too,
    // and whichever of the beat or the doorway speaks first, the
    // split is taken once.
    const inDung = state.realm === DUNGEON.realm &&
      inDungeon(Math.floor(state.pos.x), Math.floor(state.pos.z));
    if (inDung && !sr.wasInDungeon) srFireSplit("BEAT-barrow", t);
    sr.wasInDungeon = inDung;
    if (t - sr.lastTeleAt >= 500) {
      sr.lastTeleAt = t;
      srSend("telemetry", {
        player: playerName,
        elapsedMs: Math.round(t),
        realm: state.realm,
        pos: { x: state.pos.x, y: state.pos.y, z: state.pos.z },
        hp: state.hp,
        grav: state.gravDir,
      });
    }
    const bx = Math.floor(state.pos.x);
    const by = Math.floor(state.pos.y);
    const bz = Math.floor(state.pos.z);
    if (state.realm === DUNGEON.realm && deepStoneNear(bx, by, bz, DUNGEON.deepStone)) {
      srFinish(now);
    }
  }
  if (sr.phase !== "idle") srRenderTimer(now);
}

// The beats are the splits, and playBeat is the one door every
// beat passes through — so the recorder stands at that door. The
// strike and the flip get the same treatment: one wrap each, at
// the verb itself, so the stream hears the attempt and not a
// retelling of it.
function srFireSplit(beat, t) {
  if (sr.phase !== "running" || !sr.rec) return;
  const split = splitForBeat(beat);
  if (!split || sr.splitsHit.has(beat)) return;
  sr.splitsHit.add(beat);
  recEvent(sr.rec, t, "split", { beat });
  srSend("split", { player: playerName, beat, name: split.name, atMs: Math.round(t) });
  toast(`${split.name} — ${formatRunTime(t)}`, 3500);
}
const srPlayBeat = playBeat;
playBeat = function (id) {
  if (sr.phase === "running" && sr.rec) {
    const t = srNow();
    recEvent(sr.rec, t, "beat", { id });
    srFireSplit(id, t);
  }
  return srPlayBeat(id);
};
const srTryStrike = tryStrike;
tryStrike = function () {
  if (sr.phase === "running" && sr.rec) {
    recEvent(sr.rec, srNow(), "strike", {});
  }
  return srTryStrike();
};
const srFlipGravityHere = flipGravityHere;
flipGravityHere = function () {
  const before = state.gravDir;
  const r = srFlipGravityHere();
  if (sr.phase === "running" && sr.rec && state.gravDir !== before) {
    recEvent(sr.rec, srNow(), "flip", { dir: state.gravDir });
  }
  return r;
};
// The inputs, as they arrive: key codes only, never characters —
// a recording replays a run's shape, not its player's typing.
window.addEventListener("keydown", (e) => {
  if (sr.phase === "running" && sr.rec) {
    recEvent(sr.rec, srNow(), "key", { code: e.code });
  }
}, true);

function srRenderTimer(now) {
  const el = $("runtimer");
  if (!el) return;
  if (sr.phase === "idle") { el.style.display = "none"; return; }
  el.style.display = "block";
  if (sr.phase === "armed") el.textContent = "0:00.000 — move to start the clock";
  else if (sr.phase === "finished") el.textContent = formatRunTime(sr.finalMs);
  else el.textContent = formatRunTime(now - sr.t0);
}

function srRenderPanel() {
  const st = $("sr-stream-state");
  if (st) {
    st.textContent = `stream: ${sr.wsState}` +
      (sr.wsState === "open" ? " — telemetry is flowing" : "") +
      (sr.wsState === "connecting" ? " — reaching for the listener…" : "");
  }
  const cb = $("sr-connect");
  if (cb) cb.textContent = sr.wsState === "open" || sr.wsState === "connecting" ? "disconnect" : "connect";
  const ph = $("sr-phase");
  if (ph) {
    ph.textContent =
      sr.phase === "armed" ? "Armed at Arrival — the clock starts when you move." :
      sr.phase === "running" ? "Running — the Deep Stone is the finish." :
      sr.phase === "finished" ? `Finished — ${formatRunTime(sr.finalMs)}. It's written down below.` :
      "No run in progress.";
  }
  const list = $("sr-runs");
  if (list) {
    const all = srRecordings();
    if (!all.length) {
      list.innerHTML = `<div class="sub">No runs written down yet.</div>`;
    } else {
      list.innerHTML = all.slice().reverse().map((r, i) => {
        const idx = all.length - 1 - i;
        const v = verifyRecording(r);
        return `<div class="realmrow"><span class="realmname2">${v.finishMs !== null ? formatRunTime(v.finishMs) : "—"}</span>` +
          `<span class="realmstatus">${(r.startedAt || "").slice(0, 10)} · ${v.ok ? "verified ✓" : "does not verify"} ` +
          `<button class="ghost" data-sr-dl="${idx}">download .phext</button></span></div>`;
      }).join("");
      list.querySelectorAll("[data-sr-dl]").forEach((b) =>
        b.addEventListener("click", () => srDownload(Number(b.getAttribute("data-sr-dl")))));
    }
  }
}

function srDownload(idx) {
  const rec = srRecordings()[idx];
  if (!rec) return;
  const blob = new Blob([serializeRecording(rec)], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nova-fox-run-${(rec.startedAt || "run").slice(0, 19).replace(/[:T]/g, "-")}.phext`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function toggleSpeedrun(force) {
  const el = $("speedrun");
  const show = force !== undefined ? force : el.style.display !== "block";
  el.style.display = show ? "block" : "none";
  if (show) srRenderPanel();
}
$("btn-speedrun").addEventListener("click", () => toggleSpeedrun());
$("sr-start").addEventListener("click", () => speedrunArm());
$("sr-abort").addEventListener("click", () => speedrunAbort());
$("sr-connect").addEventListener("click", () => {
  if (sr.wsState === "open" || sr.wsState === "connecting") {
    srStreamClose();
    srRenderPanel();
  } else {
    srStreamConnect($("sr-url").value.trim());
  }
});

// Demo instrumentation: a handle for headless playtests (and for
// Will's own poking in devtools). Not part of the fiction.
window.NOVA_FOX3 = {
  state, sub, kernels, BACKEND, playerName, standings,
  speedrun: {
    arm: () => speedrunArm(),
    abort: () => speedrunAbort(),
    phase: () => sr.phase,
    elapsed: () => (sr.phase === "running" ? performance.now() - sr.t0
      : sr.phase === "finished" ? sr.finalMs : 0),
    recordings: () => srRecordings(),
    verify: (rec) => verifyRecording(rec || srRecordings()[srRecordings().length - 1]),
    streamState: () => sr.wsState,
    connect: (url) => srStreamConnect(url),
    disconnect: () => { srStreamClose(); srRenderPanel(); },
  },
  playNote, playChord, flipGravityHere, tryStrike, tryChisel, hurtPlayer,
  guideAdvance, guideCurrent: () => GUIDE[state.guideStep] || null,
  // EE 995 handles: Joy's visible presence (item 8) and the
  // powerup announcement count (item 10), for the e2e legs.
  joyPos: () => (joyMesh ? { x: joyMesh.position.x, y: joyMesh.position.y, z: joyMesh.position.z } : null),
  powerShown: () => powerShown,
  isWarded, classifyStroke, boardData, scoreNow: () => totalScore(sub),
  narration: {
    ready: (id) => narration.ready(id),
    play: (id) => narration.play(id),
    manifest: () => (typeof NARRATION_MANIFEST !== "undefined" ? NARRATION_MANIFEST : {}),
    state: () => narration.debugState(),
  },
  // demo17 handles: Joy's banter — what she has said, and a way to
  // offer her a moment headlessly.
  banter: {
    state: () => ({
      live: banterLive, plays: bs.plays, lastPlayedAt: bs.lastPlayedAt,
      quietUntil: bs.quietUntil,
      lines: [...bs.linePlay.entries()].map(([n, r]) => ({ n, count: r.count })),
      visitedRealms: [...bs.visitedRealms],
      marks: bs.marksMade,
    }),
    fire: (ev) => banterEvent(bs, ev, performance.now()),
    say: (line) => banterSay(line),
  },
  backendFlush: () => backendFlush(),
  // demo10 handles: gravity in subspace — read what this fox knows
  // of the gravity scroll, and feed a read-back line through the
  // same reconcile path the flush uses (a playtest stands in for
  // the chart answering: another fox's shift, read back, attunes
  // this view — the ruling's other half).
  gravityState: () => ({
    dir: sub.gravityOf(state.realm, 0, 0),
    known: gravityKnownRecords().length,
    allowed: gravityShiftAllowed(gravityKnownRecords(), state.realm, playerName, todayStr()),
  }),
  gravityReadback: (line) => {
    BACKEND.gravityRows.push(...parseGravityScroll(line));
    reconcileGravity();
  },
  invertFx: () => ({
    active: invertFxActive(performance.now()),
    slow: INVERT_SLOW, ms: INVERT_FX_MS,
  }),
  // demo18 handle: the warp announcement — how often it has fired,
  // whether it is on screen right now, and the words it throws.
  warpText: () => ({
    shown: warpShown,
    active: state.warpT0 > 0 && performance.now() - state.warpT0 < WARP_MS,
    text: WARP_TEXT, ms: WARP_MS,
  }),
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
  // 2026-11-26 handle: the Shadow encounter and its strike hint.
  encounterState: () => ({
    guardian: state.guardianEncounter,
    label: strikeBindingLabel(
      state.scheme, document.body.classList.contains("touch")),
  }),
  outboxState: () => ({
    queued: outbox.length, folded: outboxFolded.length, dropped: outboxDropped,
  }),
  dismissSplash,
  trailState: () => ({ live: trail.live, fed: trail.fed, dropped: trail.dropped }),
  cycleBrush,
  setBrush: (i) => { state.brush = i; },
  toggleLamp,
  // Fox Vision handles (demo11): the sense's state, and per-thing
  // readings a test can take without trusting pixels.
  toggleFoxVision,
  foxVisionState: () => ({
    on: state.foxVision, inHall: playerInHall(), active: foxVisionActive(),
  }),
  familiarSeen: (id) => {
    const m = sub.monsters.find((mm) => mm.id === id);
    return m ? familiarSeen(m) : false;
  },
  monsterLit: (id) => {
    const mesh = monsterMeshes.get(id);
    return mesh ? mesh.userData.visionLit === true : false;
  },
  monsterOpacity: (id) => {
    const mesh = monsterMeshes.get(id);
    return mesh ? (mesh.userData.opacity || 0) : 0;
  },
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
  // The Esc menu (2026-11-26): state + the same doors the menu's
  // own rows take, so tests exercise the real behavior.
  menuState() {
    return {
      open: menuIsOpen(),
      panel: MENU_PANELS.find((p) => $(p).style.display === "block") || null,
      newGameArmed,
    };
  },
  toggleMenu: (f) => toggleMenu(f),
  newGameKeys: () => [...NEW_GAME_KEYS],
  bindings: () => ({ ...BIND }),
  bindingFor: (action) => BIND[action],
  setBinding: (action, code) => { setBinding(action, code); return { ...BIND }; },
  settings: () => ({ ...SETTINGS }),
  masterGain: () => (sfx.master ? sfx.master.gain.value : null),
  renderScaleNow: () => (renderer ? renderer.getPixelRatio() : null),
  renderRadius: () => RENDER_R,
  lanState: () => LAN.state(),
  openToLan: () => LAN.openToLan(),
  mergeState: () => ({
    online: BACKEND.online, hasToken: !!gameToken(),
    waiting: marksWaiting(), ecoWaiting: ecoOutbox.length,
  }),
  mergeToHosted: () => mergeToHosted(),
  worldPhext: () => downloadWorldPhext(),

};
// The test console's handle (2026-11-26): the same surface the
// person at the keyboard gets — open it, run a line, read the pane.
window.NOVA_FOX3.nfConsole = {
  open: () => nfConsoleToggle(true),
  close: () => nfConsoleToggle(false),
  toggle: () => nfConsoleToggle(),
  isOpen: () => nfCon.open,
  busy: () => nfCon.busy,
  run: (line) => nfConsoleRun(line),
  text: () => nfCon.out.innerText,
};
