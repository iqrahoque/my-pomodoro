/* ============================================================
   MY STUDY TIMER — timer.js
   Phase 2 (Real Pomodoro): focus / short break / long break,
   session counting, automatic transitions, skip & reset.
   ------------------------------------------------------------
   - Timestamp-based countdown (survives background-tab throttling).
   - Emits document events "mst" so UI / stats / activity modules
     stay decoupled:  { type, ... }  with types:
       tick      { remaining, fraction, mode, running }
       phase     { mode, ended }        mode: focus|shortBreak|longBreak|idle
       complete  { mode, session }      a focus or break phase finished
       lifecycle { what }               started|paused|resumed|reset|skipped
   - Hardcore lock (Phase 8): refuses skip/reset while a locked
     focus session is running.
   ============================================================ */
(function () {
  "use strict";

  const S = () => window.MST.storage;

  const timer = {
    mode: "idle",            // idle | focus | shortBreak | longBreak
    running: false,
    totalSeconds: S().get("settings.timer.focusMin") * 60,
    remaining: S().get("settings.timer.focusMin") * 60,
    endAt: null,
    tickId: null,
    sessionsInCycle: 0,      // completed focus sessions since last long break
    session: null            // live session record for stats/summary
  };

  function emit(type, extra) {
    document.dispatchEvent(new CustomEvent("mst", { detail: Object.assign({ type, timer: snapshot() }, extra || {}) }));
  }
  function snapshot() {
    return {
      mode: timer.mode, running: timer.running,
      remaining: timer.remaining, total: timer.totalSeconds,
      fraction: timer.totalSeconds ? timer.remaining / timer.totalSeconds : 0,
      sessionsInCycle: timer.sessionsInCycle,
      session: timer.session
    };
  }

  function durationFor(mode) {
    const t = S().get("settings.timer");
    const map = { focus: t.focusMin, shortBreak: t.shortMin, longBreak: t.longMin };
    return Math.max(1, Math.round(map[mode] || 25)) * 60;
  }
  function labelFor(mode) {
    return { idle: "FOCUS", focus: "FOCUS", shortBreak: "SHORT BREAK", longBreak: "LONG BREAK" }[mode] || "FOCUS";
  }

  function start(mode) {
    mode = mode || (timer.mode === "idle" ? "focus" : timer.mode);
    if (timer.running && timer.mode === mode) return;
    if (timer.mode !== mode) timer.mode = mode;

    if (timer.remaining <= 0 || timer.totalSeconds !== durationFor(timer.mode)) {
      timer.totalSeconds = durationFor(timer.mode);
      timer.remaining = timer.totalSeconds;
    }

    // New focus session bookkeeping
    if (mode === "focus" && !timer.session) {
      timer.session = {
        task: (window.MST.currentTask || "").trim() || "Focus session",
        lockMode: S().get("settings.lock.mode"),
        startedAt: Date.now(),
        plannedSec: timer.totalSeconds,
        reminders: 0,
        violations: 0
      };
    }

    timer.running = true;
    timer.endAt = Date.now() + timer.remaining * 1000;
    stopTicking();
    timer.tickId = setInterval(tick, 200);

    emit("lifecycle", { what: "started" });
    emit("phase", { mode: timer.mode });
    render();
  }

  function pause() {
    if (!timer.running) return;
    timer.remaining = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
    stopTicking();
    timer.running = false;
    emit("lifecycle", { what: "paused" });
    render();
  }

  function resume() { if (!timer.running && timer.remaining > 0) start(timer.mode); }

  function toggle() {
    if (timer.running) { pause(); return; }
    if (timer.remaining > 0) { resume(); return; }
    emit("lifecycle", { what: "request-setup" }); // finished state → ask for a new session
  }

  function stopTicking() {
    if (timer.tickId !== null) { clearInterval(timer.tickId); timer.tickId = null; }
  }

  function tick() {
    timer.remaining = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
    if (timer.remaining <= 0) { completePhase(); return; }
    render();
  }

  function completePhase() {
    stopTicking();
    timer.running = false;
    timer.remaining = 0;
    const ended = timer.mode;

    if (ended === "focus") {
      finishSessionRecord(true);
      timer.sessionsInCycle += 1;
      const cycle = Math.max(2, Number(S().get("settings.timer.sessionsBeforeLong")) || 4);
      window.MST.sounds.event("complete");
      notify("Focus session complete", timer.session ? `“${timer.session.task}” — nice work.` : "Nice work.");
      emit("complete", { mode: "focus", ended, session: timer.session, nextMode: nextBreakMode() });
      // next transition decided by UI (summary modal / auto-start)
    } else {
      window.MST.sounds.event("break");
      notify("Break over", "Ready for another focus session?");
      emit("complete", { mode: ended, ended });
      if (S().get("settings.behavior.autoStartFocus")) {
        setTimeout(() => startFocusFresh(), 900);
      } else {
        timer.mode = "idle";
        armIdle();
        emit("phase", { mode: "idle" });
      }
    }
    render();
  }

  function nextBreakMode() {
    const cycle = Math.max(2, Number(S().get("settings.timer.sessionsBeforeLong")) || 4);
    return timer.sessionsInCycle % cycle === 0 ? "longBreak" : "shortBreak";
  }

  function startBreak() {
    const mode = nextBreakMode();
    timer.mode = mode;
    timer.totalSeconds = durationFor(mode);
    timer.remaining = timer.totalSeconds;
    timer.session = null;
    if (S().get("settings.behavior.autoStartBreak") || true) start(mode); // user pressed START BREAK
  }

  function startFocusFresh() {
    timer.mode = "focus";
    timer.session = null;
    timer.totalSeconds = durationFor("focus");
    timer.remaining = timer.totalSeconds;
    start("focus");
  }

  function finishSessionRecord(completed) {
    if (!timer.session) return;
    const rec = Object.assign({}, timer.session, {
      endedAt: Date.now(),
      focusSec: completed ? timer.session.plannedSec : Math.max(0, timer.session.plannedSec - timer.remaining),
      completed: !!completed
    });
    window.MST.stats.record(rec);
  }

  /* Skip — hardcore refuses. */
  function skip() {
    if (timer.mode === "focus" && S().get("settings.lock.mode") === "hardcore" && timer.session) {
      emit("lifecycle", { what: "hardcore-refusal", action: "skip" });
      return false;
    }
    if (timer.mode === "focus") { finishSessionRecord(false); }
    stopTicking();
    timer.running = false;
    const wasFocus = timer.mode === "focus";
    if (wasFocus) {
      timer.sessionsInCycle += 0; // abandoned session doesn't count
      timer.mode = "idle";
      timer.session = null;
      armIdle();
      emit("phase", { mode: "idle" });
      emit("lifecycle", { what: "skipped" });
    } else {
      startFocusFresh();
      emit("lifecycle", { what: "skipped" });
    }
    return true;
  }

  /* Reset — hardcore refuses while locked focus runs. */
  function reset() {
    if (timer.mode === "focus" && timer.session && S().get("settings.lock.mode") === "hardcore") {
      emit("lifecycle", { what: "hardcore-refusal", action: "reset" });
      return false;
    }
    if (timer.mode === "focus" && timer.session && timer.remaining < timer.session.plannedSec) {
      finishSessionRecord(false);
    }
    stopTicking();
    timer.running = false;
    timer.mode = "idle";
    timer.session = null;
    timer.sessionsInCycle = 0;
    armIdle();
    emit("phase", { mode: "idle" });
    emit("lifecycle", { what: "reset" });
    return true;
  }

  /* Called by app.js after the setup modal starts a session. */
  function beginSession(cfg) {
    const t = S().get("settings.timer");
    t.focusMin = cfg.focusMin; t.shortMin = cfg.shortMin; t.longMin = cfg.longMin;
    t.sessionsBeforeLong = cfg.sessionsBeforeLong;
    S().set("settings.timer", t);
    S().set("settings.lock.mode", cfg.lockMode);
    window.MST.currentTask = cfg.task;
    timer.sessionsInCycle = 0;
    timer.session = null;
    startFocusFresh();
  }

  function armIdle() {
    timer.totalSeconds = durationFor("focus");
    timer.remaining = timer.totalSeconds;
    timer.endAt = null;
    render();
  }

  function render() { emit("tick", {}); }

  function notify(title, body) {
    try {
      if (S().get("settings.behavior.notifications") && "Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body || "", icon: "assets/icons/icon-192.png" });
      }
    } catch (e) {}
  }

  window.MST = window.MST || {};
  window.MST.timer = {
    get state() { return snapshot(); },
    get mode() { return timer.mode; },
    get isRunning() { return timer.running; },
    get session() { return timer.session; },
    start, pause, resume, toggle, reset, skip, startBreak, startFocusFresh,
    beginSession, nextBreakMode, labelFor, notify,
    requestNotifyPermission() {
      try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
    }
  };
})();
