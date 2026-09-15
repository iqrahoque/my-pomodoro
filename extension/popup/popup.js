/* popup.js — local session control + emergency stop + quick allow. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const DEFAULT_ALLOWLIST = [
    "chatgpt.com", "elms.uiu.ac.bd", "google.com", "docs.google.com",
    "drive.google.com", "github.com", "stackoverflow.com", "coursera.org", "udemy.com"
  ];

  function send(msg) {
    return new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => {
      if (chrome.runtime.lastError) resolve({ ok: false, reason: chrome.runtime.lastError.message });
      else resolve(r || { ok: false, reason: "no-response" });
    }));
  }

  function fmt(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  function render(state) {
    const card = $("state-card");
    const stopBtn = $("stop-btn");
    $("hardcore-hint").hidden = !(state.active && state.mode === "hardcore");

    if (state.active && state.endAt > Date.now()) {
      card.className = "card locked";
      $("state-title").textContent = `🔒 ${state.mode.toUpperCase()} — LOCK ACTIVE`;
      $("count").textContent = fmt(state.endAt - Date.now());
      $("state-meta").textContent = `“${state.task || "Focus session"}” · violations: ${state.violations || 0}`;
      stopBtn.disabled = false;
    } else {
      card.className = "card idle";
      $("state-title").textContent = "NO ACTIVE SESSION";
      $("count").textContent = "--:--";
      $("state-meta").textContent = "Navigate freely";
      stopBtn.disabled = true;
    }
  }

  async function refresh() {
    const r = await send({ type: "MST_STATE" });
    if (r && r.ok) render(r.state);
  }

  $("q-start").addEventListener("click", async () => {
    const task = $("q-task").value.trim() || "Focus session";
    const durationMin = Number($("q-min").value) || 25;
    const mode = $("q-mode").value;
    const { extAllowlist } = await chrome.storage.local.get("extAllowlist");
    const r = await send({
      type: "MST_START_LOCK",
      mode, task, durationMin,
      graceSec: 10,
      allowlist: Array.isArray(extAllowlist) && extAllowlist.length ? extAllowlist : DEFAULT_ALLOWLIST
    });
    if (r && r.ok) { $("q-task").value = ""; refresh(); } else alert(r ? r.reason : "Could not start");
  });

  $("stop-btn").addEventListener("click", async () => {
    const r = await send({ type: "MST_STOP_LOCK" });
    if (r && r.ok) refresh();
    else alert(r ? r.reason : "Could not stop");
  });

  $("allow-current").addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;
      const host = new URL(tab.url).hostname.replace(/^www\./, "");
      if (!host || !host.includes(".")) return;
      const { extAllowlist } = await chrome.storage.local.get("extAllowlist");
      const list = Array.isArray(extAllowlist) ? extAllowlist.slice() : DEFAULT_ALLOWLIST.slice();
      if (!list.includes(host)) list.push(host);
      await chrome.storage.local.set({ extAllowlist: list });
      $("allow-current").textContent = `✓ ${host} allowed`;
      setTimeout(() => { $("allow-current").textContent = "✓ Allow current site"; }, 1600);
    } catch (e) {}
  });

  refresh();
  setInterval(refresh, 1000);
})();
