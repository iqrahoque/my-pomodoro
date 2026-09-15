/* ============================================================
   MY STUDY TIMER — sounds.js
   Phase 4 (Sound): every sound is synthesized with the Web
   Audio API — no audio files needed. Includes the Refreshing
   Chime (C → E → G), five more profiles, a custom uploaded
   sound, master volume, per-event toggles, and the optional
   "Hey. Focus." speech reminder via speechSynthesis.
   ============================================================ */
(function () {
  "use strict";

  let ctx = null;
  let master = null;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  function st() { return window.MST.storage.get("settings.sound"); }
  function vol() { return Math.max(0, Math.min(1, Number(st().volume) || 0.7)); }

  /* ---------- tiny synth helpers ---------- */
  function tone(freq, when, dur, type, peak, release) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(master);
    o.start(when); o.stop(when + dur + (release || 0.05));
  }

  function noiseBurst(when, dur, freq, peak) {
    const c = ac(); if (!c) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 1.4;
    const g = c.createGain(); g.gain.value = peak;
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(when);
  }

  /* ---------- sound profiles ---------- */
  const N = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.51, B5: 987.77, G4: 392, A5: 880 };

  const PROFILES = {
    /* Refreshing Chime — C → E → G (the signature) */
    chime(t) {
      [N.C5, N.E5, N.G5].forEach((f, i) => {
        tone(f, t + i * 0.14, 0.9, "sine", 0.5);
        tone(f * 2, t + i * 0.14, 0.5, "sine", 0.08);
      });
    },
    /* Soft Bell — one warm bell */
    softbell(t) {
      tone(N.B5, t, 1.7, "sine", 0.45);
      tone(N.B5 * 2.76, t, 0.7, "sine", 0.07);
    },
    /* Glass — bright, crystalline */
    glass(t) {
      tone(N.E6, t, 0.8, "triangle", 0.35);
      tone(N.E6 * 1.004, t + 0.03, 0.7, "sine", 0.2);
      tone(N.C6 * 1.5, t + 0.1, 0.55, "sine", 0.14);
    },
    /* Rain Drop — filtered droplets */
    raindrop(t) {
      [0, 0.22, 0.47].forEach((d, i) => {
        noiseBurst(t + d, 0.07, 1400 + i * 350, 0.25);
        tone(1150 - i * 260, t + d + 0.02, 0.16, "sine", 0.3);
      });
    },
    /* Tiny Piano — little music box */
    piano(t) {
      [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => {
        tone(f, t + i * 0.16, 0.34, "triangle", 0.4);
        tone(f / 2, t + i * 0.16, 0.3, "sine", 0.1);
      });
    },
    /* Morning Chime — slow warm fifth */
    morning(t) {
      tone(N.C5, t, 2.1, "sine", 0.4, 0.2);
      tone(N.G5, t + 0.3, 2.1, "sine", 0.32, 0.2);
      tone(N.C5 * 1.003, t, 2.0, "sine", 0.08);
    },
    /* Gentle Alert — soft two-tone (default reminder) */
    gentle(t) {
      tone(N.A5, t, 0.35, "sine", 0.35);
      tone(659.25, t + 0.22, 0.45, "sine", 0.32);
    },
    /* Weird Alert — deliberately noticeable (backup under voice) */
    weird(t) {
      [0, 0.18, 0.36].forEach((d) => tone(196, t + d, 0.13, "square", 0.22));
      tone(415.3, t + 0.6, 0.3, "sawtooth", 0.16);
    },
    /* Blocked-site buzz */
    blocked(t) {
      tone(220, t, 0.16, "square", 0.25);
      tone(196, t + 0.18, 0.2, "square", 0.2);
    },
    /* Custom uploaded sound */
    custom(t) {
      const c = ac(); if (!c) return;
      const data = st().custom;
      if (!data) return PROFILES.gentle(t);
      fetch(data).then((r) => r.arrayBuffer()).then((ab) => c.decodeAudioData(ab)).then((buf) => {
        const src = c.createBufferSource(); src.buffer = buf;
        src.connect(master); src.start(t);
      }).catch(() => PROFILES.gentle(t));
    }
  };

  function playCustomBuffer() { PROFILES.custom(ac() ? ac().currentTime : 0); }

  /* ---------- "Hey. Focus." — optional voice reminder ---------- */
  function speakReminder(strong) {
    if (!st().voice || !("speechSynthesis" in window)) return false;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(strong ? "Hey. Focus. Right now." : "Hey. Focus.");
      u.rate = 1.05; u.pitch = 0.55; u.volume = vol();
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  /* ---------- public API ---------- */
  /**
   * play(name)         — play any profile by name
   * event(kind, level) — kind: "complete" | "break" | "inactivity" | "blocked"
   *                      level (inactivity): 2 = sound, 3 = strong
   */
  function event(kind, level) {
    const s = st();
    const enabled = s.toggles || {};
    if (kind === "complete") {
      if (!enabled.complete) return;
      if (master) master.gain.value = vol();
      PROFILES[s.completion] ? PROFILES[s.completion](ac() ? ac().currentTime + 0.02 : 0) : PROFILES.chime(0);
    } else if (kind === "break") {
      if (!enabled.breakComplete) return;
      if (master) master.gain.value = vol();
      PROFILES.morning(ac() ? ac().currentTime + 0.02 : 0);
    } else if (kind === "inactivity") {
      if (!enabled.inactivity) return;
      if (master) master.gain.value = vol();
      const name = level >= 3 ? (s.reminder === "weird" ? "weird" : s.reminder) : "gentle";
      if (master) master.gain.value = vol();
      PROFILES[name](ac() ? ac().currentTime + 0.02 : 0);
      if (level >= 3) speakReminder(true);
    } else if (kind === "blocked") {
      if (!enabled.blocked) return;
      if (master) master.gain.value = vol();
      PROFILES.blocked(ac() ? ac().currentTime : 0);
    }
  }

  window.MST = window.MST || {};
  window.MST.sounds = { event, playCustomBuffer, speakReminder, _profiles: PROFILES };
})();
