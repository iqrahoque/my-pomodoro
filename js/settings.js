/* ============================================================
   MY STUDY TIMER — settings.js
   Phase 5 (Preferences): binds every control on settings.html
   to storage and applies changes instantly. Also hosts the
   custom theme builder, allowlist/blocklist editors, extension
   bridge test and data import/export/reset.
   ============================================================ */
(function () {
  "use strict";

  const S = () => window.MST.storage;
  const $ = (id) => document.getElementById(id);

  let toastTimer = null;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  window.toastMsg = toast;

  /* ================= generic binders ================= */
  function bindSelect(id, path, apply) {
    const el = $(id);
    el.value = S().get(path);
    el.addEventListener("change", () => {
      S().set(path, el.value);
      if (apply) apply();
    });
  }
  function bindNumber(id, path, min, max, apply) {
    const el = $(id);
    el.value = S().get(path);
    el.addEventListener("change", () => {
      const n = Math.round(Number(el.value));
      const v = isFinite(n) ? Math.max(min, Math.min(max, n)) : S().get(path);
      el.value = v;
      S().set(path, v);
      if (apply) apply();
    });
  }
  function bindToggle(id, path, apply) {
    const el = $(id);
    el.checked = !!S().get(path);
    el.addEventListener("change", () => {
      S().set(path, el.checked);
      if (apply) apply();
    });
  }

  /* ================= appearance ================= */
  function renderThemeGrid() {
    const grid = $("theme-grid");
    const current = S().get("settings.appearance.theme");
    grid.innerHTML = Object.entries(window.MST.themes.PRESETS).map(([k, v]) => `
      <button type="button" class="theme-swatch ${k === current ? "active" : ""}" data-theme-key="${k}">
        <span class="dots"><i style="background:${v.a}"></i><i style="background:${v.b}"></i></span>
        <span class="nm">${v.label}</span>
      </button>`).join("");
    grid.querySelectorAll(".theme-swatch").forEach((b) => {
      b.addEventListener("click", () => {
        S().set("settings.appearance.theme", b.dataset.themeKey);
        window.MST.themes.applyAll();
        renderThemeGrid();
      });
    });
  }

  bindSelect("set-clock", "settings.appearance.clockStyle", () => window.MST.themes.applyAll());
  bindSelect("set-font", "settings.appearance.font", () => window.MST.themes.applyAll());
  bindSelect("set-clockfont", "settings.appearance.clockFont", () => window.MST.themes.applyAll());
  bindToggle("set-animations", "settings.appearance.animations", () => window.MST.themes.applyAll());

  /* ================= custom theme builder ================= */
  const CT_IDS = ["bg", "card", "primary", "secondary", "text", "timer", "progress", "buttons"];
  function currentCustom() {
    const o = {};
    CT_IDS.forEach((k) => { o[k] = $("ct-" + k).value; });
    return o;
  }
  function loadCustomInputs(t) {
    CT_IDS.forEach((k) => { $("ct-" + k).value = t[k]; });
    $("ct-name").value = t.name || "";
  }
  CT_IDS.forEach((k) => {
    $("ct-" + k).addEventListener("input", () => {
      const t = Object.assign(currentCustom(), { name: $("ct-name").value || "Custom" });
      window.MST.themes.applyCustom(t); // live preview while picking
    });
  });
  $("ct-preview").addEventListener("click", () => {
    const t = Object.assign(currentCustom(), { name: $("ct-name").value || "Custom" });
    window.MST.themes.applyCustom(t);
    toast("Previewing — pick a preset above to go back");
  });
  $("ct-save").addEventListener("click", () => {
    const name = ($("ct-name").value || "").trim() || "My Theme";
    const app = S().get("settings.appearance");
    const t = Object.assign(currentCustom(), { name });
    const list = (app.customThemes || []).filter((x) => x.name !== name);
    list.push(t);
    S().set("settings.appearance.customThemes", list);
    S().set("settings.appearance.customName", name);
    S().set("settings.appearance.theme", "custom");
    window.MST.themes.applyAll();
    renderThemeGrid();
    renderSavedThemes();
    toast(`🎨 Saved & applied “${name}”`);
  });
  function renderSavedThemes() {
    const box = $("saved-themes");
    const app = S().get("settings.appearance");
    const list = app.customThemes || [];
    box.innerHTML = list.length ? list.map((t) => `
      <span class="pill ${app.theme === "custom" && app.customName === t.name ? "active" : ""}" data-name="${t.name.replace(/"/g, "&quot;")}">
        🎨 ${t.name}<button class="rm" data-rm="${t.name.replace(/"/g, "&quot;")}" aria-label="Delete ${t.name}">✕</button>
      </span>`).join("") : `<span style="font-size:12px;color:var(--muted)">No saved custom themes yet.</span>`;
    box.querySelectorAll(".pill").forEach((p) => {
      p.addEventListener("click", (e) => {
        if (e.target.classList.contains("rm")) return;
        S().set("settings.appearance.customName", p.dataset.name);
        S().set("settings.appearance.theme", "custom");
        window.MST.themes.applyAll();
        renderThemeGrid(); renderSavedThemes();
      });
    });
    box.querySelectorAll(".rm").forEach((b) => {
      b.addEventListener("click", () => {
        const app2 = S().get("settings.appearance");
        S().set("settings.appearance.customThemes", (app2.customThemes || []).filter((x) => x.name !== b.dataset.rm));
        if (app2.customName === b.dataset.rm && app2.theme === "custom") S().set("settings.appearance.theme", "sakura");
        window.MST.themes.applyAll();
        renderThemeGrid(); renderSavedThemes();
      });
    });
  }
  renderThemeGrid();
  renderSavedThemes();
  const savedList = S().get("settings.appearance.customThemes", []);
  if (savedList.length) loadCustomInputs(savedList[savedList.length - 1]);

  /* ================= timer ================= */
  bindNumber("set-focus", "settings.timer.focusMin", 1, 180);
  bindNumber("set-short", "settings.timer.shortMin", 1, 60);
  bindNumber("set-long", "settings.timer.longMin", 1, 90);
  bindNumber("set-cycle", "settings.timer.sessionsBeforeLong", 2, 12);

  /* ================= sound ================= */
  bindSelect("set-completion", "settings.sound.completion", syncCustomRow);
  bindSelect("set-reminder", "settings.sound.reminder");
  bindToggle("tg-complete", "settings.sound.toggles.complete");
  bindToggle("tg-break", "settings.sound.toggles.breakComplete");
  bindToggle("tg-inactivity", "settings.sound.toggles.inactivity");
  bindToggle("tg-blocked", "settings.sound.toggles.blocked");
  bindToggle("tg-voice", "settings.sound.voice");

  function syncCustomRow() { $("custom-sound-row").hidden = S().get("settings.sound.completion") !== "custom"; }
  syncCustomRow();

  const volEl = $("set-volume");
  volEl.value = Math.round((Number(S().get("settings.sound.volume")) || 0.7) * 100);
  volEl.addEventListener("input", () => S().set("settings.sound.volume", Number(volEl.value) / 100));
  volEl.addEventListener("change", () => window.MST.sounds.event("complete"));

  $("preview-completion").addEventListener("click", () => {
    const kind = S().get("settings.sound.completion");
    if (kind === "custom" && S().get("settings.sound.custom")) window.MST.sounds.playCustomBuffer();
    else window.MST.sounds.event("complete");
  });

  $("set-customfile").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast("⚠️ Too large — pick audio under 2 MB"); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => {
      S().set("settings.sound.custom", reader.result); // data URL
      S().flush();
      toast("🎵 Custom sound saved");
      window.MST.sounds.playCustomBuffer();
    };
    reader.onerror = () => toast("⚠️ Could not read that file");
    reader.readAsDataURL(file);
  });

  /* ================= focus monitor ================= */
  bindToggle("tg-monitor", "settings.monitor.enabled");
  bindNumber("set-soft", "settings.monitor.softSec", 30, 600);
  bindNumber("set-soundsec", "settings.monitor.soundSec", 40, 900);
  bindNumber("set-strongsec", "settings.monitor.strongSec", 50, 1800);
  bindToggle("tg-reading", "settings.monitor.readingMode");

  /* ================= study lock ================= */
  bindSelect("set-lockmode", "settings.lock.mode");
  bindNumber("set-grace", "settings.lock.graceSec", 0, 60);
  bindToggle("tg-tabswitch", "settings.lock.blockTabSwitch");

  const extInput = $("set-extid");
  extInput.value = S().get("settings.lock.extensionId", "");
  extInput.addEventListener("change", () => S().set("settings.lock.extensionId", extInput.value.trim()));

  $("ext-test").addEventListener("click", async () => {
    const st = $("ext-status");
    st.className = "bridge-status";
    st.textContent = "testing…";
    try {
      const id = extInput.value.trim();
      if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        st.className = "bridge-status err"; st.textContent = "✕ not available on this page/browser";
        return;
      }
      chrome.runtime.sendMessage(id, { type: "MST_PING" }, (r) => {
        if (chrome.runtime.lastError || !r || !r.ok) {
          st.className = "bridge-status err";
          st.textContent = "✕ " + ((chrome.runtime.lastError && chrome.runtime.lastError.message) || "extension not reachable");
        } else {
          S().set("settings.lock.extensionId", id);
          st.className = "bridge-status ok";
          st.textContent = "✓ connected — lock will arm with sessions";
        }
      });
    } catch (e) {
      st.className = "bridge-status err"; st.textContent = "✕ " + e.message;
    }
  });

  /* ---------- allowlist / blocklist editors ---------- */
  function renderSiteList(ulId, path, kind) {
    const ul = $(ulId);
    const items = S().get(path, []);
    ul.innerHTML = items.length
      ? items.map((d) => `<li>${d}<button class="rm" data-d="${d}" aria-label="Remove ${d}">✕</button></li>`).join("")
      : `<li class="none">empty</li>`;
    ul.querySelectorAll(".rm").forEach((b) => {
      b.addEventListener("click", () => { S().removeItem(path, b.dataset.d); renderSiteList(ulId, path, kind); });
    });
  }
  function wireAdd(inputId, btnId, ulId, path) {
    const input = $(inputId);
    const add = () => {
      let v = input.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!v || !v.includes(".")) { toast("Enter a domain like example.com"); return; }
      S().pushItem(path, v);
      input.value = "";
      renderSiteList(ulId, path);
    };
    $(btnId).addEventListener("click", add);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
  }
  wireAdd("allow-input", "allow-add", "allow-list", "settings.lock.allowlist");
  wireAdd("deny-input", "deny-add", "deny-list", "settings.lock.blocklist");
  renderSiteList("allow-list", "settings.lock.allowlist");
  renderSiteList("deny-list", "settings.lock.blocklist");

  /* ================= behavior ================= */
  bindToggle("tg-autobreak", "settings.behavior.autoStartBreak");
  bindToggle("tg-autofocus", "settings.behavior.autoStartFocus");
  bindToggle("tg-notifications", "settings.behavior.notifications", () => {
    if (S().get("settings.behavior.notifications") && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  });

  /* ================= data ================= */
  $("data-export").addEventListener("click", () => {
    try {
      const blob = new Blob([S().export()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "my-study-timer-backup.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast("⬇ Backup downloaded");
    } catch (e) { toast("⚠️ Export failed: " + e.message); }
  });
  $("data-import").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        S().import(reader.result);
        toast("✓ Backup imported — reloading");
        setTimeout(() => location.reload(), 800);
      } catch (err) { toast("⚠️ Import failed: " + err.message); }
    };
    reader.readAsText(file);
  });
  $("data-reset").addEventListener("click", () => {
    if (!window.confirm("Reset ALL settings and statistics? This cannot be undone.")) return;
    if (!window.confirm("Really sure? Every theme, setting and session record will be gone.")) return;
    S().reset();
    location.reload();
  });

  window.MST.themes.applyAll();
})();
