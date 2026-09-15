/* ============================================================
   MY STUDY TIMER — app.js
   UI orchestration for index.html:
   - renders every clock style (circular/digital/minimal/flip/bar/large)
   - session setup modal ("What are you working on?")
   - session summary modal + break flow
   - Study Lock badge + extension bridge (Phase 7-8 pairing)
   - stats drawer, reading mode chip, toasts
   - keyboard shortcuts (Phase 10), PWA registration, onboarding
   ============================================================ */
(function () {
  "use strict";

  const S = () => window.MST.storage;
  const $ = (id) => document.getElementById(id);

  const RING_R = 144;
  const RING_C = 2 * Math.PI * RING_R;
  let lastDigits = "";
  let lastSummary = null;

  /* ================= clock rendering ================= */
  function renderClock(t) {
    const mm = String(Math.floor(t.remaining / 60)).padStart(2, "0");
    const ss = String(t.remaining % 60).padStart(2, "0");
    const str = mm + ":" + ss;

    $("time-display").textContent = str;

    const ring = $("ring-progress");
    ring.style.strokeDasharray = RING_C;
    ring.style.strokeDashoffset = RING_C * (1 - t.fraction);
    ring.classList.toggle("on-break", t.mode === "shortBreak" || t.mode === "longBreak");

    const bar = $("bar-fill");
    if (bar) bar.style.width = (t.fraction * 100).toFixed(2) + "%";

    if (str !== lastDigits) {
      lastDigits = str;
      renderFlip(mm, ss);
    }

    document.title = (t.running || t.remaining < t.total)
      ? `${str} · ${window.MST.timer.labelFor(t.mode)} — My Study Timer`
      : "My Study Timer";
  }

  function renderFlip(mm, ss) {
    const box = $("flip-clock");
    if (!box || document.documentElement.getAttribute("data-clock") !== "flip") return;
    const digits = (mm + ss).split("");
    if (box.children.length !== digits.length + 1) {
      box.innerHTML = "";
      digits.forEach((d, i) => {
        if (i === 2) box.insertAdjacentHTML("beforeend", `<span class="flip-colon">:</span>`);
        box.insertAdjacentHTML("beforeend", `<span class="flip-group"><span class="flip-digit">${d}</span></span>`);
      });
    } else {
      const els = box.querySelectorAll(".flip-digit");
      digits.forEach((d, i) => {
        const el = els[i];
        if (el.textContent !== d) {
          el.textContent = d;
          el.classList.remove("swap");
          void el.offsetWidth; // retrigger animation
          el.classList.add("swap");
        }
      });
    }
  }

  function renderPhase(t) {
    const label = $("mode-label");
    label.textContent = window.MST.timer.labelFor(t.mode);
    label.classList.toggle("break", t.mode === "shortBreak" || t.mode === "longBreak");
    label.classList.toggle("done", t.mode === "idle" && t.remaining === 0 && t.total > 0 ? false : false);

    const cycle = Math.max(2, Number(S().get("settings.timer.sessionsBeforeLong")) || 4);
    const dots = $("session-dots");
    if (dots.childElementCount !== cycle) {
      dots.innerHTML = Array.from({ length: cycle }, () => `<span class="dot"></span>`).join("");
    }
    [...dots.children].forEach((d, i) => d.classList.toggle("filled", i < t.sessionsInCycle));

    const task = window.MST.currentTask;
    const tl = $("task-line");
    if (task && t.mode !== "idle") { tl.hidden = false; tl.innerHTML = `<span class="lock-tick">🎯</span>${escapeHtml(task)} — Session #${t.sessionsInCycle + (t.mode === "focus" ? 1 : 0)}`; }
    else tl.hidden = true;

    const isDone = !t.running && t.remaining === 0 && t.mode !== "idle";
    $("start-btn").textContent = t.running ? "PAUSE" : (isDone ? "START" : (t.mode !== "idle" && t.remaining > 0 && t.remaining < t.total ? "RESUME" : "START"));
    $("lock-badge").hidden = !(S().get("settings.lock.mode") !== "off" && t.mode === "focus" && isDone === false);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ================= toast / hint ================= */
  let toastTimer = null;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  window.toastMsg = toast;

  function setHint(text) { $("hint").textContent = text; }

  /* ================= extension bridge (Phase 7-8) ================= */
  function bridgeSend(msg) {
    return new Promise((resolve) => {
      const id = S().get("settings.lock.extensionId", "");
      if (!id || !id.trim()) return resolve({ ok: false, reason: "not-configured" });
      try {
        if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return resolve({ ok: false, reason: "browser" });
        chrome.runtime.sendMessage(id.trim(), msg, (r) => {
          if (chrome.runtime.lastError) resolve({ ok: false, reason: chrome.runtime.lastError.message });
          else resolve(r || { ok: false, reason: "no-response" });
        });
      } catch (e) { resolve({ ok: false, reason: e.message || "error" }); }
    });
  }
  window.MST.bridgeSend = bridgeSend;

  async function armLock(remainingSec) {
    const mode = S().get("settings.lock.mode");
    if (mode === "off") return;
    const res = await bridgeSend({
      type: "MST_START_LOCK",
      mode,
      task: window.MST.currentTask || "Focus session",
      durationMin: Math.max(1, Math.ceil(remainingSec / 60)),
      graceSec: Number(S().get("settings.lock.graceSec")) || 10,
      allowlist: S().get("settings.lock.allowlist", [])
    });
    if (res.ok) { document.documentElement.setAttribute("data-lock", "on"); toast(`🔒 Study Lock armed (${mode})`); }
    else if (res.reason === "not-configured") toast("⚠️ Lock mode on, but no extension connected (Settings → Study Lock)");
    else if (res.reason === "browser") toast("⚠️ Open this page in the browser where the extension is installed");
    else toast("⚠️ Study Lock: " + (res.reason || "unavailable"));
  }

  async function disarmLock() {
    const mode = S().get("settings.lock.mode");
    if (mode === "off") return { ok: true };
    const res = await bridgeSend({ type: "MST_STOP_LOCK" });
    document.documentElement.setAttribute("data-lock", "off");
    return res;
  }

  /* ================= setup modal ================= */
  function openSetup() {
    const app = S().get("settings.appearance");
    $("setup-task").value = S().get("meta.lastTask", "") || "";
    $("setup-preset").value = S().get("meta.lastPreset", "25/5");
    $("setup-theme").innerHTML = Object.entries(window.MST.themes.PRESETS)
      .map(([k, v]) => `<option value="${k}" ${k === app.theme ? "selected" : ""}>${v.label}</option>`).join("") +
      (app.customThemes.length ? `<option value="custom" ${app.theme === "custom" ? "selected" : ""}>🎨 ${escapeHtml(app.customName || "Custom")}</option>` : "");
    $("setup-clock").value = app.clockStyle;
    $("setup-lock").value = S().get("settings.lock.mode");
    syncCustomFields();
    $("setup-modal").hidden = false;
    $("setup-task").focus();
  }
  function closeSetup() { $("setup-modal").hidden = true; }

  function syncCustomFields() {
    const isCustom = $("setup-preset").value === "custom";
    $("setup-custom").hidden = !isCustom;
    if (isCustom) {
      const t = S().get("settings.timer");
      $("setup-focus").value = t.focusMin; $("setup-short").value = t.shortMin;
      $("setup-long").value = t.longMin; $("setup-cycle").value = t.sessionsBeforeLong;
    }
  }

  function startFromSetup() {
    const t = S().get("settings.timer");
    let cfg;
    if ($("setup-preset").value === "custom") {
      cfg = {
        focusMin: clampNum($("setup-focus").value, t.focusMin, 1, 180),
        shortMin: clampNum($("setup-short").value, t.shortMin, 1, 60),
        longMin: clampNum($("setup-long").value, t.longMin, 1, 90),
        sessionsBeforeLong: clampNum($("setup-cycle").value, t.sessionsBeforeLong, 2, 12)
      };
    } else {
      const [f, s] = $("setup-preset").value.split("/").map(Number);
      cfg = { focusMin: f, shortMin: s, longMin: t.longMin, sessionsBeforeLong: t.sessionsBeforeLong };
    }
    cfg.task = $("setup-task").value.trim() || "Focus session";
    cfg.lockMode = $("setup-lock").value;

    // appearance choices
    const app = S().get("settings.appearance");
    app.theme = $("setup-theme").value;
    app.clockStyle = $("setup-clock").value;
    S().set("settings.appearance", app);
    window.MST.themes.applyAll();

    S().set("meta.lastTask", cfg.task);
    S().set("meta.lastPreset", $("setup-preset").value);
    S().set("meta.onboarded", true);

    window.MST.timer.requestNotifyPermission();
    closeSetup();
    window.MST.timer.beginSession(cfg);
    armLock(cfg.focusMin * 60);
    setHint("Locked in. Stay with it.");
  }

  function clampNum(v, fb, min, max) {
    const n = Math.round(Number(v));
    if (!isFinite(n)) return fb;
    return Math.max(min, Math.min(max, n));
  }

  /* ================= summary modal ================= */
  function showSummary(detail) {
    lastSummary = detail;
    const s = detail.session;
    $("summary-check").textContent = detail.ended === "focus" ? "🎉" : "😌";
    $("summary-title").textContent = detail.ended === "focus" ? "SESSION COMPLETE" : "BREAK COMPLETE";
    $("summary-task").textContent = s ? s.task : "Break time";
    const rows = [];
    if (s) {
      const mins = Math.round(s.plannedSec / 60);
      rows.push(["Duration", `${mins} minutes focused`]);
      rows.push(["Blocked-site violations", s.violations === 0 ? "✓ none" : `✕ ${s.violations}`, s.violations === 0 ? "ok" : "bad"]);
      rows.push(["Focus reminders", String(s.reminders)]);
      const day = window.MST.stats.summaryToday();
      rows.push(["Today", window.MST.stats.fmt(day.focusSec)]);
    }
    $("summary-rows").innerHTML = rows.map(([k, v, cls]) =>
      `<div class="summary-row ${cls || ""}"><span>${k}</span><span>${v}</span></div>`).join("");
    $("summary-break-btn").textContent = detail.ended === "focus"
      ? (detail.nextMode === "longBreak" ? "START LONG BREAK" : "START BREAK")
      : "START FOCUS";
    $("summary-modal").hidden = false;
  }

  function summaryAction() {
    $("summary-modal").hidden = true;
    if (!lastSummary) return;
    if (lastSummary.ended === "focus") {
      window.MST.timer.startBreak();
    } else {
      openSetup();
    }
  }

  /* ================= stats drawer / reading mode / help ================= */
  function toggleStats(open) {
    const d = $("stats-drawer");
    const willOpen = open === undefined ? d.hidden : open;
    d.hidden = !willOpen;
    requestAnimationFrame(() => d.classList.toggle("open", willOpen));
    if (willOpen) window.MST.stats.renderDrawer();
  }

  function toggleReading() {
    const cur = S().get("settings.monitor.readingMode");
    const next = !cur;
    S().set("settings.monitor.readingMode", next);
    syncReadingChip();
    toast(next ? "📖 Reading mode ON — only tab violations are monitored" : "Reading mode OFF — full monitoring");
  }
  function syncReadingChip() {
    $("reading-btn").setAttribute("aria-pressed", String(!!S().get("settings.monitor.readingMode")));
  }

  /* ================= hardcore refusals ================= */
  function hardcoreRefusal(action) {
    toast(`🔒 Hardcore mode: you can't ${action} during a locked session. Back to studying.`);
  }

  /* ================= timer event wiring ================= */
  document.addEventListener("mst", (e) => {
    const d = e.detail;
    if (d.type === "tick") { renderClock(d.timer); renderPhase(d.timer); }
    if (d.type === "phase") { renderClock(d.timer); renderPhase(d.timer); }
    if (d.type === "lifecycle") {
      if (d.what === "hardcore-refusal") hardcoreRefusal(d.action === "skip" ? "skip this session" : "reset the timer");
      if (d.what === "reset") { document.documentElement.setAttribute("data-lock", "off"); setHint("25 minutes of focused study. You've got this."); }
      if (d.what === "paused") setHint("Paused. Take a breath, then jump back in.");
      if (d.what === "started") setHint("Locked in. Stay with it.");
      if (d.what === "request-setup") openSetup();
    }
    if (d.type === "complete" && d.mode === "focus") {
      disarmLock();
      showSummary(d);
      if (!S().get("settings.behavior.autoStartBreak")) window.MST.timer.pause();
    }
  });

  /* ================= buttons ================= */
  $("start-btn").addEventListener("click", () => {
    const t = window.MST.timer;
    if (t.mode === "idle" && !t.isRunning) { openSetup(); return; }
    t.toggle();
  });
  $("reset-btn").addEventListener("click", () => window.MST.timer.reset());
  $("skip-btn").addEventListener("click", () => window.MST.timer.skip());

  $("setup-start").addEventListener("click", startFromSetup);
  $("setup-cancel").addEventListener("click", closeSetup);
  $("setup-preset").addEventListener("change", syncCustomFields);
  $("summary-break-btn").addEventListener("click", summaryAction);
  $("summary-close").addEventListener("click", () => { $("summary-modal").hidden = true; openSetup(); });

  $("stats-btn").addEventListener("click", () => toggleStats());
  $("stats-close").addEventListener("click", () => toggleStats(false));
  $("reading-btn").addEventListener("click", toggleReading);
  $("shortcuts-btn").addEventListener("click", () => { $("help-modal").hidden = false; });
  $("help-close").addEventListener("click", () => { $("help-modal").hidden = true; });

  document.querySelectorAll(".modal-overlay").forEach((ov) => {
    ov.addEventListener("click", (e) => {
      if (e.target === ov && ov.id !== "setup-modal") ov.hidden = true; // setup needs explicit action
    });
  });

  /* ================= keyboard shortcuts (Phase 10) ================= */
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (!$("setup-modal").hidden && e.key !== "Escape") return;

    switch (e.key) {
      case " ": e.preventDefault(); $("start-btn").click(); break;
      case "r": case "R": window.MST.timer.reset(); break;
      case "s": case "S": window.MST.timer.skip(); break;
      case "m": case "M": toggleReading(); break;
      case "f": case "F": toggleFullscreen(); break;
      case "?": $("help-modal").hidden = false; break;
      case "Escape":
        document.querySelectorAll(".modal-overlay").forEach((ov) => { if (ov.id !== "setup-modal") ov.hidden = true; });
        toggleStats(false);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        break;
    }
  });

  function toggleFullscreen() {
    const card = $("timer-card");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else card.requestFullscreen ? card.requestFullscreen().catch(() => toast("Fullscreen not available")) : toast("Fullscreen not supported");
  }

  /* ================= onboarding (Phase 10) ================= */
  function onboard() {
    if (!S().get("meta.onboarded")) {
      setTimeout(() => {
        if (window.MST.timer.mode === "idle" && $("setup-modal").hidden) openSetup();
      }, 600);
    }
  }

  /* ================= PWA (Phase 10) ================= */
  function registerSW() {
    try {
      if ("serviceWorker" in navigator && location.protocol === "https:") {
        navigator.serviceWorker.register("sw.js").catch(() => {});
      }
    } catch (e) {}
  }

  /* ================= boot ================= */
  window.MST.themes.applyAll();
  syncReadingChip();
  renderClock(window.MST.timer.state);
  renderPhase(window.MST.timer.state);
  registerSW();
  onboard();
})();
