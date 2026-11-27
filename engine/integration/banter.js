// Nova Fox — Joy's exploration banter (2026-11-26).
//
// The hundred lines are Joy's own (JOY-BANTER.md, received from Will
// 2026-11-26 15:52 CST after she battle-tested the draft set): 1–30
// are the launch cut, 31–100 fill the other seventy slots. Her
// per-group guidance and her closing mapping rule are the design
// requirements this engine implements:
//
//   "Find the smallest thing that would make Joi say this particular
//    line today."
//
// This module is pure logic, on the economy.js pattern: game3.js
// feeds it events (a crossing, a note, a glimpse, a landing) and a
// slow stream of observations (position, stillness, gravity), and it
// decides — sparsely, with cooldowns — whether Joy speaks, and which
// line the moment earned. It owns no DOM and no audio. The view
// shows the returned line's text on the narration line surface and
// calls narration.play(line.id): a future narration-audio/JOY-###.mp3
// attaches by that ID with no restructuring (build3.py embeds every
// MP3 in narration-audio/ by filename stem).
//
// Banter is earned and sparse. Silence is a valid state: a moment
// whose line is gated (cooldown, quiet, the opening's grace) is
// simply gone — banter never queues up to speak late.

// ---------- the lines ------------------------------------------------------
// id: the beat ID an MP3 will attach to. n: Joy's number. group: her
// grouping, which carries the per-group cooldown. Texts are verbatim
// from JOY-BANTER.md — her punctuation is performance direction.
export const BANTER_LINES = [
  [1, "wonder", "I love this part. The not-knowing part."],
  [2, "wonder", "If we get lost, we get lost together. Deal?"],
  [3, "wonder", "New realm smell! Nothing beats it."],
  [4, "wonder", "They watch us the way we watch them. Fair’s fair."],
  [5, "wonder", "Three notes between us and anywhere. I still can’t get over that."],
  [6, "wonder", "I wonder what tune this realm dreams about."],
  [7, "wonder", "Small mark, long memory."],
  [8, "wonder", "Cinders on the wind. Ashfall’s saying hello."],
  [9, "wonder", "The weather here has opinions. I respect that."],
  [10, "wonder", "Quiet here. The good quiet. Stay a while?"],
  [11, "catches", "Look at that light, Fox. Oh, it knows."],
  [12, "catches", "That view. I picked a good Fox to follow."],
  [13, "catches", "Hear that, Fox? A hall. I think."],
  [14, "catches", "This realm tastes like rain."],
  [15, "catches", "Behind you, Fox. Oh! Behind me now."],
  [16, "catches", "The dark’s doing its empty impression again."],
  [17, "catches", "A familiar! …Do you think that’s what it calls us?"],
  [18, "catches", "Your inky, Fox. Somewhere strange?"],
  [19, "catches", "Oh, that one again. I was hoping."],
  [20, "catches", "Down had its chance."],
  [21, "remembers", "Still flying. Still flying."],
  [22, "remembers", "Walking on the sky again. Show-off."],
  [23, "remembers", "Someday somebody’s going to find that and wonder about you."],
  [24, "remembers", "Nova Prime’s counting on us. I was counting on a smaller hall."],
  [25, "remembers", "All those pieces. Good thing you like looking for things, Fox."],
  [26, "remembers", "Hear it, Fox? Your feet are playing a duet."],
  [27, "remembers", "You’ve got me, Fox."],
  [28, "remembers", "Oh, that was clever. I had a much worse idea."],
  [29, "remembers", "There you are."],
  [30, "remembers", "Let’s go exploring."],
  [31, "forks", "Oh, good. I was curious about the crooked one."],
  [32, "forks", "We came all this way for a rock. …That is a very good rock."],
  [33, "forks", "From down there, this hill looked positively innocent."],
  [34, "forks", "I had a feeling about this way. Admittedly, I had one about the other way too."],
  [35, "forks", "That little gap? You saw that from there?"],
  [36, "forks", "Look how far away our morning is."],
  [37, "forks", "Fox, we’ve gone miles past my guess. I’d like a new guess."],
  [38, "forks", "I can see our whole walk from here. Even the bit we did twice."],
  [39, "forks", "All right, hill. What’ve you been hiding behind your back?"],
  [40, "forks", "Funny. I was just about to say, “I wonder what’s down there.”"],
  [41, "rifts", "Fox, it was autumn one foot ago."],
  [42, "rifts", "I could smell Ashfall on the other side. I’m getting good at this."],
  [43, "rifts", "This side’s raining. Shall we tell the other side?"],
  [44, "rifts", "Oh! I brought a little shiver through with me."],
  [45, "rifts", "I liked that breeze. Think it’ll fit through?"],
  [46, "rifts", "One raindrop. Very brave. …Ah. It brought everybody."],
  [47, "rifts", "That patch of sun is exactly one Fox wide."],
  [48, "rifts", "Ash on the wind again. I knew where we were with my eyes shut."],
  [49, "rifts", "Did you hear the rain stop? All at once, like it saw us."],
  [50, "rifts", "What a tiny rift for all that sky."],
  [51, "familiars", "Ears. Definitely ears. Still taking guesses on the middle."],
  [52, "familiars", "Oh. We startled each other. That feels polite."],
  [53, "familiars", "I blinked first. Point to the dark."],
  [54, "familiars", "Same one, Fox. I’d know that little hop anywhere."],
  [55, "familiars", "I wonder how long it took to work up the nerve to look at us."],
  [56, "familiars", "It waited till you turned around. I’m beginning to like it."],
  [57, "familiars", "Fox, your shadow has company."],
  [58, "familiars", "All that quiet, and then one very guilty pebble."],
  [59, "familiars", "There goes the tail end of my theory."],
  [60, "familiars", "It looked right at me that time. At me, Fox."],
  [61, "inky", "I know those first two. Go on, surprise me."],
  [62, "inky", "That last note sounded taller in here."],
  [63, "inky", "Oh, lovely. The hall knows your part too."],
  [64, "inky", "I hummed along that time. Did I land with you?"],
  [65, "inky", "That’s the tune you played when we found the cinders."],
  [66, "inky", "Funny how I miss a place the minute you play it."],
  [67, "inky", "You held that one longer. I liked having time to wonder."],
  [68, "inky", "May I have that middle note? Just to hum later."],
  [69, "inky", "The rift’s gone quiet. I’m still humming."],
  [70, "inky", "I knew where you meant by the way you played the first note."],
  [71, "gravity", "Oh, that up."],
  [72, "gravity", "I liked that floor. Hello again!"],
  [73, "gravity", "Plenty of time to admire the—oof."],
  [74, "gravity", "So that’s what the tops of doors look like."],
  [75, "gravity", "You found a whole other side to that puddle."],
  [76, "gravity", "Fox. The rain’s going past us the wrong way."],
  [77, "gravity", "My favorite part was when your ears caught up."],
  [78, "gravity", "Excellent landing. Very nearly where you meant."],
  [79, "gravity", "I believe that hill owes us a climb back."],
  [80, "gravity", "Let’s stay upside down till I’ve seen the stars under my feet."],
  [81, "marks", "Oh, I know that handwriting. Hi, earlier Fox."],
  [82, "marks", "You make that same little hook at the end every time."],
  [83, "marks", "Imagine finding yours and deciding to leave one beside it."],
  [84, "marks", "There’s your mark. We were so sure we were lost."],
  [85, "marks", "That one’s crooked. Keep it. I remember laughing."],
  [86, "marks", "From here, your mark looks like it’s waving."],
  [87, "marks", "A piece of the Heart. Smaller than the sound it made."],
  [88, "marks", "That whole enormous hall, and the bit we came for fits right there."],
  [89, "marks", "Oh, Fox. We walked right over this room yesterday."],
  [90, "marks", "I’d know this hall anywhere now. You gave it your handwriting."],
  [91, "soft", "We can watch this one cloud the whole way across."],
  [92, "soft", "I had something to say. Then you found this view."],
  [93, "soft", "Oh, good. The light’s still on that hill. I wanted you to see it."],
  [94, "soft", "I like hearing the wind in the gaps between your steps."],
  [95, "soft", "We could sit here long enough to find out what color comes next."],
  [96, "soft", "I missed that little pause you take before you jump."],
  [97, "soft", "There’s the first star. You can have the wish. I saw it yesterday."],
  [98, "soft", "I used to wonder what was over that hill. Now I miss it sometimes."],
  [99, "soft", "You came back the long way. More time with you. Suits me."],
  [100, "soft", "I saved you a quiet, Fox."],
].map(([n, group, text]) => ({
  n, group, text,
  id: "JOY-" + String(n).padStart(3, "0"),
}));
export const BANTER_BY_N = new Map(BANTER_LINES.map((l) => [l.n, l]));

// ---------- the discipline (tunables — stated, never hidden) ---------------
export const BANTER_TUNABLES = {
  startGraceMs: 20000,    // the scripted opening owns the first moments
  globalGapMs: 45000,     // minimum ms between any two banter lines
  groupGapMs: 90000,      // minimum ms between two lines of one group
  poolLockPlays: 60,      // a played line sits out until 60 other lines have played
  longAbsenceMs: 8 * 3600 * 1000, // #29: "a long absence" before a return
  quietAfter100Ms: 180000,        // #100: the quiet she saved, protected
  pauseMinMs: 12000,      // a player-chosen pause: this long without input, on ground
  pauseViewMs: 18000,     // #100 asks a longer settle than an ordinary pause
  markOldMs: 10 * 60 * 1000,      // a mark is "old" (Joy was there when Fox made it)
  markNearBlocks: 7,      // an encounter: this close to one of your own marks
  familiarTargetVisits: 3,        // #70: a place visited this often is "often"
  sessionFarBlocks: 400,  // #37: miles past her guess
  marksRegistryCap: 300,  // persisted own-marks remembered (oldest dropped)
};
// Lines that may cut through their own group's cooldown (never the
// global gap, the grace, or #100's quiet): the ones Joy's mapping
// rule names, plus the two one-time bookends.
const NAMED = new Set([29, 30, 36, 70, 81, 100]);
const ONCE = new Set([29, 30, 100]);

// ---------- state ------------------------------------------------------------
export function createBanter(saved, now) {
  const bs = {
    startedAt: now,
    lastPlayedAt: -Infinity,
    plays: 0,                    // total lines played, ever (the pool clock)
    linePlay: new Map(),         // n -> {count, atPlay} (atPlay = plays index when last played)
    groupLastAt: new Map(),      // group -> ms
    quietUntil: 0,
    muted: false,       // the view mutes her while the scripted guide owns the fox
    helloPending: false, // #30 still owed (a long-absence #29 spoke first)
    // the world, remembered
    visitedRealms: new Set(saved?.visitedRealms || []),
    realmVisits: new Map(Object.entries(saved?.realmVisits || {}).map(([k, v]) => [k, v])),
    realmEnteredAt: now,
    chordInRealm: false,
    dreamtRealms: new Set(),     // realms #6 has already wondered about
    targetVisits: new Map(Object.entries(saved?.targetVisits || {}).map(([k, v]) => [k, v])),
    seqs: [],                    // recent ordered sequences {notes:[...], targetKey}
    ashfallTune: saved?.ashfallTune || null, // chord-set key first played into the cinders
    hallChords: 0,
    lastChordAt: -Infinity,
    lastChordSet: null,
    gravDir: 1,
    gravSince: now,              // down has been this way since
    sightings: new Map(),        // monsterId -> {count, realms:Set, kind}
    kindsSeen: new Set(),
    kindsKilled: new Set(),
    anyGlimpseYet: false,
    marks: new Map(Object.entries(saved?.marks || {}).map(([k, v]) => [k, v])),
    marksMade: saved?.marksMade || 0,
    marksInHall: 0,
    // the session's own geography
    start: null,                 // {x, z, realm} — "our morning"
    visitedScrolls: new Set(),
    sessionDist: 0,
    crests: [],                  // {x, z, realm, at}
    pauses: [],                  // {x, z, realm, at}
    distSincePause: 0,
    awayArmedAt: null,           // #99 armed: returned to a realm long away
    realmLeftAt: new Map(),      // realm -> when we last left it
    darkEnteredAt: -Infinity,    // last crossing into a dark-fog realm (#97)
    lastSeenAt: saved?.lastSeenAt || 0,
    // observe-stream trackers
    _obs: null, _ascent: 0, _peakY: 0, _sag: 0, _crestArmed: false,
    _straight: 0, _lastYaw: null, _turnWin: [],
    _walkStretch: 0, _invWalk: 0, _invCinder: 0,
    _pauseFired: false, _idleWas: 0,
    _firstCrestDone: false, _far37Done: false,
    _hurtLowDone: false, _firstInvLandDone: false,
  };
  return bs;
}

export function banterSnapshot(bs, now) {
  const marks = {};
  const entries = [...bs.marks.entries()]
    .sort((a, b) => b[1].t - a[1].t)
    .slice(0, BANTER_TUNABLES.marksRegistryCap);
  for (const [k, v] of entries) marks[k] = v;
  return {
    visitedRealms: [...bs.visitedRealms],
    realmVisits: Object.fromEntries(bs.realmVisits),
    targetVisits: Object.fromEntries(bs.targetVisits),
    ashfallTune: bs.ashfallTune,
    marks, marksMade: bs.marksMade,
    lastSeenAt: now,
  };
}

// ---------- the gate -----------------------------------------------------------
function lineAvailable(bs, n, now) {
  const rec = bs.linePlay.get(n);
  if (!rec) return true;
  if (ONCE.has(n)) return false;
  return bs.plays - rec.atPlay >= BANTER_TUNABLES.poolLockPlays;
}
function speak(bs, candidates, now, opts = {}) {
  const T = BANTER_TUNABLES;
  if (bs.muted) return null;
  if (now < bs.quietUntil) return null;
  if (!opts.bypassGrace && now - bs.startedAt < T.startGraceMs) return null;
  if (now - bs.lastPlayedAt < T.globalGapMs) return null;
  const ready = candidates
    .filter((c) => c.when !== false)
    .filter((c) => lineAvailable(bs, c.n, now))
    .filter((c) => NAMED.has(c.n) ||
      now - (bs.groupLastAt.get(BANTER_BY_N.get(c.n).group) || -Infinity) >= T.groupGapMs);
  if (!ready.length) return null;
  ready.sort((a, b) =>
    (b.pri - a.pri) ||
    ((bs.groupLastAt.get(BANTER_BY_N.get(a.n).group) || -Infinity) -
     (bs.groupLastAt.get(BANTER_BY_N.get(b.n).group) || -Infinity)) ||
    (a.n - b.n));
  const pick = BANTER_BY_N.get(ready[0].n);
  if (pick.n === 30) bs.helloPending = false;
  bs.plays++;
  bs.linePlay.set(pick.n, { count: (bs.linePlay.get(pick.n)?.count || 0) + 1, atPlay: bs.plays });
  bs.groupLastAt.set(pick.group, now);
  bs.lastPlayedAt = now;
  if (pick.n === 100) bs.quietUntil = now + T.quietAfter100Ms;
  return pick;
}
const angleDiff = (a, b) => {
  let d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
};

// ---------- events -------------------------------------------------------------
// banterEvent(bs, ev, now) -> the line to speak, or null. Every event
// first updates what Joy remembers; the speaking decision comes after,
// so a gated moment still teaches her the world.
export function banterEvent(bs, ev, now) {
  const T = BANTER_TUNABLES;
  switch (ev.type) {
    case "sessionStart": {
      // #29 is reserved for a long absence (Joy's rule for 91–100:
      // "'There you are' gets the long absence"). If it speaks, the
      // bookend #30 is still owed — it follows at a quiet moment.
      if (ev.awayMs >= T.longAbsenceMs) {
        bs.helloPending = true;
        return speak(bs, [{ n: 29, pri: 100 }], now, { bypassGrace: true });
      }
      return null;
    }
    case "handover": {
      // The guide hands the game over: the bookend, once.
      bs.helloPending = true;
      return speak(bs, [{ n: 30, pri: 100 }], now, { bypassGrace: true });
    }
    case "cross": {
      const from = ev.from, to = ev.to;
      const awayMs = now - (bs.realmLeftAt.get(to) ?? now);
      bs.realmLeftAt.set(from, now);
      if (bs.visitedRealms.has(to) && awayMs >= 5 * 60 * 1000) bs.awayArmedAt = now;
      const firstEver = !bs.visitedRealms.has(to);
      bs.visitedRealms.add(to);
      bs.realmVisits.set(to, (bs.realmVisits.get(to) || 0) + 1);
      bs.realmEnteredAt = now;
      bs.chordInRealm = false;
      const visits = bs.realmVisits.get(to);
      const amb = new Set(ev.ambience || []);
      if (amb.has("dark")) bs.darkEnteredAt = now;
      const c = [];
      if (firstEver) c.push({ n: 3, pri: 80 });
      if (amb.has("cinders")) {
        if (firstEver) c.push({ n: 8, pri: 85 });
        else if (visits === 2) c.push({ n: 42, pri: 70 });
        else if (visits >= 3) c.push({ n: 48, pri: 68 });
        if (!firstEver) c.push({ n: 43, pri: 45 });
        c.push({ n: 46, pri: 40 });
      }
      if ((ev.fromAmbience || []).includes("cinders") && !amb.has("cinders")) {
        c.push({ n: 49, pri: 60 }); // the rain stops, all at once
      }
      if (amb.has("bright") && firstEver) c.push({ n: 11, pri: 60 });
      if (amb.has("bright") && !firstEver) c.push({ n: 47, pri: 36 }); // a patch of sun, revisited
      if (amb.has("strong") && firstEver) c.push({ n: 9, pri: 42 });
      if (amb.has("wet") && firstEver) c.push({ n: 14, pri: 44 });
      // The seam itself: the two sides of the rift feel different.
      const fromAmb = new Set(ev.fromAmbience || []);
      const differs = [...amb].some((t) => !fromAmb.has(t)) ||
        [...fromAmb].some((t) => !amb.has(t));
      if (differs) c.push({ n: 41, pri: 38 });
      if (ev.viaLink) c.push({ n: 45, pri: 50 });
      if (ev.inverted) c.push({ n: 44, pri: 50 });
      if (firstEver) c.push({ n: 1, pri: 30 });
      return speak(bs, c, now);
    }
    case "pocket": {
      bs.realmEnteredAt = now;
      bs.chordInRealm = false;
      return speak(bs, [{ n: 50, pri: 55 }, { n: 1, pri: 30 }], now);
    }
    case "note": {
      const c = [];
      if (ev.seqIndex === 1) {
        // #70 (Joy's named example): the first note of a tune toward
        // a place visited often enough that she knows the intention.
        const targets = bs.targetVisits;
        let often = false;
        for (const s of bs.seqs) {
          if (s.notes[0] === ev.n && (targets.get(s.targetKey) || 0) >= T.familiarTargetVisits) often = true;
        }
        if (often) c.push({ n: 70, pri: 95 });
        if (now - bs.realmEnteredAt < 30000) c.push({ n: 18, pri: 40 });
      }
      if (ev.seqIndex === 2) {
        const prev = bs.seqs[bs.seqs.length - 1];
        if (prev && prev.notes[0] === ev.firstNote && prev.notes[1] === ev.n) {
          c.push({ n: 61, pri: 65 }); // I know those first two
        } else {
          c.push({ n: 68, pri: 25 }); // the middle note, to hum later
        }
        if (ev.gapMs > 2200) c.push({ n: 67, pri: 55 }); // held longer
      }
      if (ev.seqIndex === 3 && ev.gapMs > 2200) c.push({ n: 67, pri: 55 });
      return speak(bs, c, now);
    }
    case "chord": {
      const setKey = [...ev.seq].sort((a, b) => a - b).join("+");
      const firstChord = bs.seqs.length === 0;
      bs.seqs.push({ notes: [...ev.seq], targetKey: ev.targetKey });
      if (bs.seqs.length > 24) bs.seqs.shift();
      bs.targetVisits.set(ev.targetKey, (bs.targetVisits.get(ev.targetKey) || 0) + 1);
      bs.chordInRealm = true;
      if (ev.targetRealm === "ashfall" && !bs.ashfallTune) bs.ashfallTune = setKey;
      const c = [];
      if (firstChord) c.push({ n: 5, pri: 70 });
      if (ev.inHall) {
        if (bs.hallChords === 0) c.push({ n: 62, pri: 60 });
        else c.push({ n: 63, pri: 55 });
        bs.hallChords++;
      }
      if (bs.lastChordSet === setKey) c.push({ n: 64, pri: 50 });
      if (bs.ashfallTune === setKey && ev.targetRealm !== "ashfall" && bs.lastChordSet !== null) {
        c.push({ n: 65, pri: 60 }); // the tune from the cinders, played again
      }
      if (ev.leavesRealm) c.push({ n: 66, pri: 45 });
      bs.lastChordSet = setKey;
      bs.lastChordAt = now;
      return speak(bs, c, now);
    }
    case "riftFold": {
      if (now - bs.lastChordAt < 60000) return speak(bs, [{ n: 69, pri: 42 }], now);
      return null;
    }
    case "flip": {
      const downFor = now - bs.gravSince;
      bs.gravDir = ev.toUp ? -1 : 1;
      bs.gravSince = now;
      if (!ev.toUp) return null;
      return speak(bs, [
        { n: 71, pri: 70 },
        { n: 20, pri: 75, when: downFor >= 5 * 60 * 1000 },
      ], now);
    }
    case "borderFlip": {
      bs.gravDir = ev.toUp ? -1 : 1;
      bs.gravSince = now;
      return null; // the place announces itself; Joy doesn't pile on
    }
    case "airborne": {
      return speak(bs, [{ n: 21, pri: 60 }], now); // still flying
    }
    case "land": {
      const c = [];
      if (ev.flipMidAir) c.push({ n: 77, pri: 75 });
      if (ev.airMs >= 1600) c.push({ n: 73, pri: 65 });
      if (ev.inverted) {
        c.push({ n: 72, pri: 60 });
        if (!bs._firstInvLandDone) { c.push({ n: 74, pri: 65 }); bs._firstInvLandDone = true; }
        c.push({ n: 80, pri: 45 });
        c.push({ n: 75, pri: 42 });
      }
      if (ev.descent >= 10) c.push({ n: 79, pri: 50 });
      if (ev.horizDist >= 10) c.push({ n: 78, pri: 45 });
      return speak(bs, c, now);
    }
    case "glimpse": {
      let s = bs.sightings.get(ev.monsterId);
      if (!s) { s = { count: 0, realms: new Set(), kind: ev.kind }; bs.sightings.set(ev.monsterId, s); }
      s.count++;
      s.realms.add(ev.realm);
      const firstKind = !bs.kindsSeen.has(ev.kind);
      bs.kindsSeen.add(ev.kind);
      const firstEver = !bs.anyGlimpseYet;
      bs.anyGlimpseYet = true;
      const c = [];
      if (firstEver) c.push({ n: 4, pri: 66 });
      if (firstKind) c.push({ n: 17, pri: 62 });
      if (ev.bearingDeg > 120) c.push({ n: 15, pri: 68 });
      if (ev.dist > 14) c.push({ n: 51, pri: 64 });
      if (ev.dist < 6) c.push({ n: 52, pri: 58 });
      if (s.count >= 3) c.push({ n: 19, pri: 57 });
      if (s.count >= 2 && s.realms.size >= 2) c.push({ n: 54, pri: 56 });
      if (ev.secondVisible) c.push({ n: 57, pri: 55 });
      if (ev.afterStillMs >= 8000) c.push({ n: 58, pri: 54 });
      if (bs.kindsKilled.has(ev.kind)) c.push({ n: 59, pri: 53 });
      if (ev.dist < 8 && !ev.playerMoving) c.push({ n: 60, pri: 52 });
      if (ev.turnedRecently) c.push({ n: 56, pri: 56 });
      if (ev.dist >= 10 && ev.dist <= 18) c.push({ n: 55, pri: 40 });
      if (ev.longDarkMs >= 45000) c.push({ n: 16, pri: 44 });
      return speak(bs, c, now);
    }
    case "glimpseEnd": {
      if (!ev.struck && ev.durationMs < 1200) {
        return speak(bs, [{ n: 53, pri: 58 }], now); // I blinked first
      }
      return null;
    }
    case "kill": {
      bs.kindsKilled.add(ev.kind);
      if (!ev.guardian && ev.sinceGlimpseMs <= 2000) {
        return speak(bs, [{ n: 28, pri: 60 }], now); // struck in the glimpse: clever
      }
      return null;
    }
    case "hurt": {
      if (ev.hpFrac < 0.5 && !bs._hurtLowDone) {
        bs._hurtLowDone = true;
        return speak(bs, [{ n: 27, pri: 55 }], now);
      }
      return null;
    }
    case "mark": {
      bs.marks.set(ev.key, {
        t: now, yaw: ev.yaw, broke: !!ev.broke, level: ev.broke ? 3 : (ev.level || 1),
        realm: ev.realm, x: ev.x, y: ev.y, z: ev.z, encounters: 0,
      });
      bs.marksMade++;
      if (ev.inHall) bs.marksInHall++;
      let nearOld = false;
      for (const [k, m] of bs.marks) {
        if (k === ev.key || m.realm !== ev.realm) continue;
        if (now - m.t >= T.markOldMs &&
            Math.hypot(m.x - ev.x, m.z - ev.z) <= 5) nearOld = true;
      }
      const c = [];
      if (bs.marksMade === 1) c.push({ n: 7, pri: 80 });
      if (nearOld) c.push({ n: 83, pri: 62 });
      if (ev.dist > 4.5) c.push({ n: 35, pri: 60 });
      if (bs.marksMade >= 3) c.push({ n: 82, pri: 40 });
      if (bs.start && Math.hypot(ev.x - bs.start.x, ev.z - bs.start.z) > 60) {
        c.push({ n: 23, pri: 45 });
      }
      return speak(bs, c, now);
    }
    case "hallApproach": {
      return speak(bs, [{ n: 13, pri: 65 }], now);
    }
    case "hallEnter": {
      const c = [];
      if (ev.first) c.push({ n: 24, pri: 70 });
      else c.push({ n: 25, pri: 45 });
      if (ev.walkedAboveBefore) c.push({ n: 89, pri: 66 });
      return speak(bs, c, now);
    }
    case "quest": {
      return speak(bs, [
        { n: 88, pri: 62, when: ev.hallTimeMs >= 60000 },
        { n: 87, pri: 62, when: ev.hallTimeMs < 60000 },
      ], now);
    }
    case "jump": {
      if (ev.pauseBeforeMs >= 6000 && ev.sincePauseEndMs <= 4000) {
        return speak(bs, [{ n: 96, pri: 57 }], now);
      }
      return null;
    }
    case "observe": return observe(bs, ev, now);
    default: return null;
  }
}

// ---------- the observe stream -------------------------------------------------
// Fed a few times a second by the view: where the fox is, how still,
// which way down is. The movement-derived conditions live here —
// crests, turns, stretches of walking, and the player-chosen pauses
// the soft set (91–100) belongs to.
function observe(bs, ev, now) {
  const T = BANTER_TUNABLES;
  if (!bs.start) bs.start = { x: ev.x, z: ev.z, realm: ev.realm };
  const prev = bs._obs;
  bs._obs = { x: ev.x, y: ev.y, z: ev.z, realm: ev.realm, yaw: ev.yaw, at: now, onGround: ev.onGround };
  const scrollKey = `${ev.realm}|${Math.floor(ev.x / 32)},${Math.floor(ev.z / 32)}`;
  const newScroll = !bs.visitedScrolls.has(scrollKey);
  if (newScroll) bs.visitedScrolls.add(scrollKey);

  const c = [];
  if (bs.helloPending) c.push({ n: 30, pri: 20 });
  if (prev && prev.realm === ev.realm) {
    const moved = Math.hypot(ev.x - prev.x, ev.z - prev.z);
    bs.sessionDist += moved;
    if (bs._pauseFired) { /* still inside the consumed pause */ }
    else bs.distSincePause += moved;
    // #37: miles past my guess — once the session's walk runs long.
    if (!bs._far37Done && bs.sessionDist >= T.sessionFarBlocks) {
      bs._far37Done = true;
      c.push({ n: 37, pri: 48 });
    }
    // #2: a page never visited, far from the morning.
    if (newScroll && Math.hypot(ev.x - bs.start.x, ev.z - bs.start.z) > 120 &&
        ev.realm === bs.start.realm) {
      c.push({ n: 2, pri: 44 });
    }
    // #32: a long walk that ends with the fox stopped, looking at a
    // very good rock (the view reports a crystal / ember / the Deep
    // Stone itself in the aim).
    if (ev.lookPrize && ev.idleMs >= 4000 && bs.distSincePause >= 60) {
      c.push({ n: 32, pri: 52 });
    }
    // --- crest tracking: climb while grounded, then crest over ---
    if (ev.onGround) {
      if (bs._ascent === 0 && ev.y > (bs._peakY || ev.y)) bs._peakY = ev.y;
      if (prev.onGround && ev.y > prev.y) {
        if (bs._ascent === 0) bs._crestBase = prev.y;
        bs._ascent += ev.y - prev.y;
        bs._peakY = Math.max(bs._peakY, ev.y);
        bs._sag = 0;
      } else if (prev.onGround && ev.y < prev.y) {
        bs._sag += prev.y - ev.y;
        if (bs._ascent >= 4 && bs._sag >= 1.5) {
          // crested: the ridge is behind us
          const crest = { x: ev.x, z: ev.z, realm: ev.realm, at: now };
          bs.crests.push(crest);
          if (ev.startVisible) c.push({ n: 36, pri: 95 }); // Joy's named example
          if (!bs._firstCrestDone) { c.push({ n: 12, pri: 58 }); bs._firstCrestDone = true; }
          if (bs.sessionDist >= 150 && !newScroll) c.push({ n: 38, pri: 56 });
          c.push({ n: 33, pri: 50 });
          bs._ascent = 0; bs._sag = 0;
        }
      }
    } else {
      bs._ascent = 0; bs._sag = 0;
    }
    // --- turns: a sharp choice after a straight walk --------------
    if (bs._lastYaw !== null && ev.onGround) {
      const dy = angleDiff(ev.yaw, bs._lastYaw);
      bs._turnWin.push({ dy, at: now });
      bs._turnWin = bs._turnWin.filter((w) => now - w.at <= 1000);
      const turnSum = bs._turnWin.reduce((s, w) => s + w.dy, 0);
      if (ev.hSpeed > 0.5) bs._straight += moved;
      if (turnSum >= 1.2 && bs._straight >= 15) {
        bs._straight = 0;
        bs._turnWin = [];
        c.push({ n: 31, pri: 47 }, { n: 34, pri: 42 });
      }
    }
    bs._lastYaw = ev.yaw;
    // --- hills and edges, from the ground ahead --------------------
    if (ev.onGround && ev.groundAheadDelta >= 5) c.push({ n: 39, pri: 40 });
    if (ev.onGround && ev.groundAheadDelta <= -6) c.push({ n: 40, pri: 46 });
    // --- walking rhythms -------------------------------------------
    if (ev.onGround && ev.hSpeed > 1) {
      bs._walkStretch += now - prev.at;
      if (bs._walkStretch >= 20000) { c.push({ n: 26, pri: 38 }); bs._walkStretch = -40000; }
    } else bs._walkStretch = 0;
    if (ev.onGround && ev.gravDir < 0) {
      bs._invWalk += now - prev.at;
      if (bs._invWalk >= 4000) { c.push({ n: 22, pri: 48 }); bs._invWalk = -60000; }
      if (ev.ambienceCinders) {
        bs._invCinder += now - prev.at;
        if (bs._invCinder >= 3000) { c.push({ n: 76, pri: 50 }); bs._invCinder = -60000; }
      } else bs._invCinder = 0;
    } else { bs._invWalk = 0; bs._invCinder = 0; }
    // --- #6: a realm she hasn't heard the tune of yet --------------
    if (now - bs.realmEnteredAt >= 20000 && !bs.chordInRealm &&
        !bs.dreamtRealms.has(ev.realm)) {
      bs.dreamtRealms.add(ev.realm);
      c.push({ n: 6, pri: 36 });
    }
    // --- your own old marks, encountered ---------------------------
    for (const [k, m] of bs.marks) {
      if (m.realm !== ev.realm) continue;
      if (now - m.t < T.markOldMs) continue;
      if (Math.hypot(m.x - ev.x, m.z - ev.z) > T.markNearBlocks) continue;
      if (now - (m.lastEncounterAt || -Infinity) < 10 * 60 * 1000) continue;
      m.lastEncounterAt = now;
      m.encounters++;
      const unfamiliar = angleDiff(ev.yaw, m.yaw) > 1.75; // > ~100°
      if (unfamiliar) c.push({ n: 81, pri: 95 }); // Joy's named example
      if (ev.inHall && bs.marksInHall > 0) c.push({ n: 90, pri: 60 });
      if (!m.broke && m.level < 3) c.push({ n: 85, pri: 55 });
      if (ev.y > m.y + 6) c.push({ n: 86, pri: 54 });
      if (newScroll) c.push({ n: 84, pri: 53 });
    }
  }
  // --- the pauses (91–100, and #10): chosen stillness ---------------
  const idle = ev.idleMs;
  if (idle >= T.pauseMinMs && ev.onGround && !bs._pauseFired) {
    const atView = !!ev.atView;
    const sameSpot = bs.pauses.some((p) => p.realm === ev.realm &&
      Math.hypot(p.x - ev.x, p.z - ev.z) <= 6);
    const nearOldCrest = bs.crests.some((p) => p.realm === ev.realm &&
      Math.hypot(p.x - ev.x, p.z - ev.z) <= 10);
    const lastCrestRecent = bs.crests.length &&
      now - bs.crests[bs.crests.length - 1].at <= 120000;
    const pc = [];
    if (atView && idle >= T.pauseViewMs) pc.push({ n: 100, pri: 100 });
    if (bs.awayArmedAt && now - bs.awayArmedAt < 10 * 60 * 1000) pc.push({ n: 99, pri: 54 });
    if (lastCrestRecent) pc.push({ n: 92, pri: 52 });
    if (nearOldCrest) pc.push({ n: 98, pri: 51 });
    if (ev.lookTowardStart) pc.push({ n: 93, pri: 50 });
    if (sameSpot) pc.push({ n: 95, pri: 49 });
    if (bs.distSincePause >= 120) pc.push({ n: 94, pri: 47 });
    if (now - bs.darkEnteredAt <= 30000) pc.push({ n: 97, pri: 46 });
    if (idle >= 25000) pc.push({ n: 91, pri: 44 });
    if (bs.pauses.length === 0 && atView) pc.push({ n: 10, pri: 43 });
    const line = speak(bs, pc, now);
    if (line) {
      bs._pauseFired = true;
      bs.pauses.push({ x: ev.x, z: ev.z, realm: ev.realm, at: now });
      bs.distSincePause = 0;
      return line;
    }
    // Not spoken (gated): leave the pause unconsumed — if the fox is
    // still sitting when the gate opens, the moment is still true.
  }
  if (idle < 2000) bs._pauseFired = false;
  const line = speak(bs, c, now);
  return line;
}
