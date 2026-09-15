/* ============================================================
   MY STUDY TIMER — storage.js
   Phase 5 (Preferences): namespaced localStorage persistence.
   Loaded first; exposes window.MST.storage.
   Every feature reads/writes here — one key, dot-paths, safe
   fallbacks if localStorage is unavailable (private mode).
   ============================================================ */
(function () {
  "use strict";

  const KEY = "mystudytimer.v1";
  const listeners = [];

  const DEFAULTS = {
    settings: {
      appearance: {
        theme: "sakura",
        clockStyle: "circular",   // circular | digital | minimal | flip | bar | large
        font: "quicksand",        // quicksand | nunito | inter | poppins | dmsans
        clockFont: "jetbrains",   // jetbrains | spacemono
        animations: true,
        customThemes: []          // [{name, bg, card, primary, secondary, text, timer, progress, buttons}]
      },
      timer: {
        focusMin: 25, shortMin: 5, longMin: 15, sessionsBeforeLong: 4
      },
      sound: {
        volume: 0.7,
        completion: "chime",      // chime | softbell | glass | raindrop | piano | morning | custom
        reminder: "gentle",       // gentle | weird | custom
        custom: null,             // base64 data URL of uploaded audio
        voice: true,              // "Hey. Focus." speech reminder
        toggles: { complete: true, breakComplete: true, inactivity: true, blocked: false }
      },
      monitor: {
        enabled: true,
        softSec: 120, soundSec: 150, strongSec: 180,
        readingMode: false
      },
      lock: {
        mode: "off",              // off | gentle | strict | hardcore
        graceSec: 10,
        blockTabSwitch: false,
        extensionId: "",
        allowlist: ["chatgpt.com", "elms.uiu.ac.bd", "google.com", "docs.google.com",
                    "drive.google.com", "github.com", "stackoverflow.com",
                    "coursera.org", "udemy.com"],
        blocklist: ["youtube.com", "instagram.com", "facebook.com", "tiktok.com",
                    "netflix.com", "reddit.com", "x.com"]
      },
      behavior: {
        autoStartBreak: false, autoStartFocus: false, notifications: true
      }
    },
    stats: { sessions: [] },
    meta: { onboarded: false }
  };

  let cache = load();
  let saveTimer = null;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
      listeners.forEach((fn) => { try { fn(); } catch (e) {} });
    } catch (e) {
      console.warn("My Study Timer: could not save to localStorage", e);
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 150);
  }

  function walk(obj, path, fallback) {
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur === undefined || cur === null) return fallback;
      cur = cur[p];
    }
    return cur === undefined ? fallback : cur;
  }

  function setDeep(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  return void (window.MST = window.MST || {}, Object.assign(window.MST, {
    storage: {
      DEFAULTS,
      /** Read a dot-path; falls back to defaults. */
      get(path, fallback) {
        return walk(cache, path, walk(DEFAULTS, path, fallback));
      },
      /** Write a dot-path and persist (debounced). */
      set(path, value) {
        setDeep(cache, path, value);
        scheduleSave();
        return value;
      },
      /** Array helpers for lists like allowlist. */
      pushItem(path, value) {
        const arr = (this.get(path, []) || []).slice();
        if (!arr.includes(value)) arr.push(value);
        this.set(path, arr);
        return arr;
      },
      removeItem(path, value) {
        const arr = (this.get(path, []) || []).filter((v) => v !== value);
        this.set(path, arr);
        return arr;
      },
      onChange(fn) { listeners.push(fn); },
      flush() { save(); },
      export() { this.flush(); return JSON.stringify(cache, null, 2); },
      import(jsonString) {
        const data = JSON.parse(jsonString); // throws on bad JSON — caller catches
        if (!data || typeof data !== "object" || !data.settings) throw new Error("Not a My Study Timer backup");
        cache = data;
        save();
      },
      reset() {
        try { localStorage.removeItem(KEY); } catch (e) {}
        cache = {};
      }
    }
  }));
})();
