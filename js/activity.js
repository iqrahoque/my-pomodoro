/* ============================================================
   MY STUDY TIMER — activity.js
   Phase 6 (Focus Monitor): tracks mouse / click / keyboard /
   scroll / touch / page-visibility as activity signals.
   ------------------------------------------------------------
   Smart inactivity ladder (all customizable in Settings):
     0 – softSec   → nothing (normal studying, e.g. reading)
     softSec       → soft visual reminder banner
     soundSec      → sound reminder
     strongSec     → strong reminder (+ "Hey. Focus." voice)
   Reading Mode ignores all input-based signals and only
   monitors tab violations.
   Honest by design: this detects browser activity, not whether
   you are actually studying.
   ============================================================ */
(function () {
  "use strict";

  const S = () => window.MST.storage;

  let lastActivity = Date.now();
  let fired = { soft: false, sound: false, strong: false };
  let monitorId = null;
  let strongRepeatId = null;
  let hiddenAt = null;

  function activity() { lastActivity = Date.now(); fired = { soft: false, sound: false, strong: false }; dismissBanner(); }

  /* ---------- signal listeners ---------- */
  let moveTick = 0;
  window.addEventListener("pointermove", () => { const n = Date.now(); if (n - moveTick > 800) { moveTick = n; activity(); } }, { passive: true });
  window.addEventListener("pointerdown", activity, { passive: true });
  window.addEventListener("keydown", activity);
  window.addEventListener("wheel", activity, { passive: true });
  window.addEventListener("touchstart", activity, { passive: true });
  window.addEventListener("scroll", activity, { passive: true });

  /* Tab violations (counted for the session summary) */
  document.addEventListener("visibilitychange", () => {
    const t = window.MST.timer;
    if (document.hidden) {
      hiddenAt = Date.now();
    } else {
      if (hiddenAt && t.mode === "focus" && t.isRunning && S().get("settings.lock.blockTabSwitch")) {
        t.session && (t.session.violations += 1);
        window.toastMsg("👋 Tab switch counted as a distraction");
      }
      hiddenAt = null;
    }
  });

  /* ---------- reminder banner ---------- */
  const banner = () => document.getElementById("reminder-banner");
  function showBanner(text, strong) {
    const b = banner(); if (!b) return;
    b.textContent = text;
    b.classList.toggle("strong", !!strong);
    b.hidden = false;
  }
  function dismissBanner() { const b = banner(); if (b) b.hidden = true; if (strongRepeatId) { clearInterval(strongRepeatId); strongRepeatId = null; } }

  /* ---------- monitor loop ---------- */
  function check() {
    const t = window.MST.timer;
    const m = S().get("settings.monitor");
    if (!m.enabled || !t.isRunning || t.mode !== "focus" || m.readingMode) return;

    const idle = Math.floor((Date.now() - lastActivity) / 1000);
    const soft = Math.max(30, Number(m.softSec) || 120);
    const sound = Math.max(soft + 10, Number(m.soundSec) || 150);
    const strong = Math.max(sound + 10, Number(m.strongSec) || 180);

    if (idle >= strong && !fired.strong) {
      fired.strong = true;
      showBanner("🔔 3 minutes idle. This is the loud one. Back to the books!", true);
      window.MST.sounds.event("inactivity", 3);
      t.session && (t.session.reminders += 1);
      if (strongRepeatId) clearInterval(strongRepeatId);
      strongRepeatId = setInterval(() => window.MST.sounds.event("inactivity", 3), 45000);
    } else if (idle >= sound && !fired.sound) {
      fired.sound = true;
      showBanner("🔔 Still with me? Move the mouse or press any key if you're studying.", false);
      window.MST.sounds.event("inactivity", 2);
      t.session && (t.session.reminders += 1);
    } else if (idle >= soft && !fired.soft) {
      fired.soft = true;
      showBanner("💭 Idle for a while — still there? (Reading? Turn on Reading Mode.)", false);
    }
  }

  function startMonitor() {
    if (monitorId === null) monitorId = setInterval(check, 1000);
  }
  function stopMonitor() {
    if (monitorId !== null) { clearInterval(monitorId); monitorId = null; }
    dismissBanner();
  }

  /* React to timer phases */
  document.addEventListener("mst", (e) => {
    const d = e.detail;
    if (d.type === "phase" || d.type === "complete") {
      activity(); // fresh phase = fresh slate
      if (d.timer && (d.timer.mode === "focus") && d.timer.running) startMonitor();
      else stopMonitor();
    }
    if (d.type === "lifecycle" && (d.what === "paused" || d.what === "reset")) stopMonitor();
    if (d.type === "lifecycle" && d.what === "started") startMonitor();
  });

  window.MST = window.MST || {};
  window.MST.activity = {
    dismissBanner,
    get idleSeconds() { return Math.floor((Date.now() - lastActivity) / 1000); }
  };
})();
