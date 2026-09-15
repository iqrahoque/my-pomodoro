/* blocked.js — countdown + way back. No way around, only back to work. */
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const endAt = Number(params.get("end")) || Date.now() + 25 * 60000;
  const from = params.get("from") || "";
  const mode = params.get("mode") || "strict";
  const el = document.getElementById("remaining");
  const cheer = document.getElementById("cheer");
  const meta = document.getElementById("meta");
  const CHEERS = [
    "Back to studying.",
    "Future you says thanks.",
    "One page at a time.",
    "The timer believes in you.",
    "Small steps, big results."
  ];

  try {
    chrome.storage.local.get("lock").then(({ lock }) => {
      if (lock && lock.active && lock.task) {
        document.getElementById("task-line").textContent = `“${lock.task}”`;
      }
      if (lock && lock.active) {
        meta.textContent = `Violations this session: ${lock.violations || 0} · mode: ${lock.mode}`;
      }
    });
  } catch (e) {}

  function fmt(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  function tick() {
    const left = endAt - Date.now();
    if (left <= 0) {
      el.textContent = "00:00";
      cheer.textContent = "Lock released — you're free. 🎉";
      document.title = "Study Lock — released";
      clearInterval(timerId);
      return;
    }
    el.textContent = fmt(left);
    document.title = `${fmt(left)} — Study Lock`;
  }
  const timerId = setInterval(tick, 250);
  tick();
  cheer.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];

  document.getElementById("back-btn").addEventListener("click", () => {
    if (history.length > 1) {
      history.back();
    } else {
      location.replace("https://iqrahoque.github.io/my-pomodoro/");
    }
  });

  if (from) {
    let host = from;
    try { host = new URL(from).hostname; } catch (e) {}
    document.title = `Study Lock — ${host} blocked`;
  }
})();
