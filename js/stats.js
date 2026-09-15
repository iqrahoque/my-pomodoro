/* ============================================================
   MY STUDY TIMER — stats.js
   Phase 9 (Statistics): session log in localStorage.
   TODAY   — focus time, sessions, completion, longest streak
   WEEK    — 7-day focus-minutes bar chart (pure CSS bars)
   HISTORY — recent sessions with reminders/violations flags
   ============================================================ */
(function () {
  "use strict";

  const S = () => window.MST.storage;

  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function all() { return S().get("stats.sessions", []) || []; }

  function record(rec) {
    const list = all();
    list.push(Object.assign({ id: Date.now() + "" + Math.floor(Math.random() * 1e4) }, rec));
    if (list.length > 500) list.splice(0, list.length - 500); // keep it lean
    S().set("stats.sessions", list);
    S().flush();
  }

  function todays() {
    const k = dayKey(Date.now());
    return all().filter((s) => dayKey(s.startedAt) === k);
  }

  function summaryToday() {
    const list = todays();
    const focusSec = list.reduce((a, s) => a + (s.focusSec || 0), 0);
    const completed = list.filter((s) => s.completed).length;
    let streak = 0, best = 0;
    list.forEach((s) => { if (s.completed) { streak += 1; best = Math.max(best, streak); } else streak = 0; });
    return {
      focusSec,
      sessions: list.length,
      completed,
      longestStreak: best,
      plannedTotal: list.length
    };
  }

  function last7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const ts = Date.now() - i * 86400000;
      const k = dayKey(ts);
      const secs = all().filter((s) => dayKey(s.startedAt) === k).reduce((a, s) => a + (s.focusSec || 0), 0);
      days.push({ ts, key: k, focusSec: secs, label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(ts).getDay()] });
    }
    return days;
  }

  /* Day-streak: consecutive days (ending today/yesterday) with ≥1 completed session */
  function dayStreak() {
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const k = dayKey(Date.now() - i * 86400000);
      const has = all().some((s) => dayKey(s.startedAt) === k && s.completed);
      if (has) streak += 1;
      else if (i > 0 || !has) break;
    }
    return streak;
  }

  function fmt(sec) {
    if (sec < 60) return Math.round(sec) + "s";
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  /* ---------- rendering ---------- */
  function renderDrawer() {
    const todayEl = document.getElementById("stats-today");
    const weekEl = document.getElementById("stats-week");
    const histEl = document.getElementById("stats-history");
    if (!todayEl) return;

    const t = summaryToday();
    if (!t.sessions) {
      todayEl.innerHTML = `<div class="empty-state">No sessions yet today.<br>Start your first focus session and this fills up. 🌱</div>`;
    } else {
      todayEl.innerHTML = [
        ["FOCUS TIME", fmt(t.focusSec)],
        ["SESSIONS", String(t.sessions)],
        ["COMPLETED", `${t.completed} / ${t.plannedTotal}`],
        ["LONGEST STREAK", `${t.longestStreak} 🏅`]
      ].map(([k, v]) => `<div class="stat-cell"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");
    }

    const days = last7Days();
    const max = Math.max(60 * 5, ...days.map((d) => d.focusSec)); // floor scale: 5 min
    weekEl.innerHTML = days.map((d) => {
      const h = Math.max(3, Math.round((d.focusSec / max) * 100));
      const isToday = d.key === dayKey(Date.now());
      return `<div class="week-col" title="${d.key}: ${fmt(d.focusSec)}">
          <div class="week-bar ${d.focusSec ? "" : "empty"}" style="height:${h}%"></div>
          <div class="week-label" style="${isToday ? "color:var(--primary)" : ""}">${d.label}</div>
        </div>`;
    }).join("");

    const recent = all().slice(-8).reverse();
    if (!recent.length) {
      histEl.innerHTML = `<div class="empty-state">Your session history will appear here.<br>Statistics turn a timer into something you want to use.</div>`;
    } else {
      histEl.innerHTML = recent.map((s) => {
        const flags = `${s.completed ? "✅" : "⏹"}${s.reminders ? " · 🔔" + s.reminders : ""}${s.violations ? " · 🚫" + s.violations : ""}`;
        return `<div class="history-item">
            <span class="t">${escapeHtml(s.task || "Focus session")}</span>
            <span class="flags">${flags}</span>
            <span class="m">${new Date(s.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${fmt(s.focusSec || 0)}</span>
          </div>`;
      }).join("");
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.MST = window.MST || {};
  window.MST.stats = { record, summaryToday, last7Days, dayStreak, renderDrawer, fmt };
})();
