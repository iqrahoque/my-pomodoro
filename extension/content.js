/* ============================================================
   MY STUDY TIMER — content.js
   A tiny floating "🔒 23:41 FOCUS" widget on allowed pages
   while a Study Lock session is running. Shadow DOM keeps the
   host page's CSS out; the page can't accidentally restyle it.
   ============================================================ */
(function () {
  "use strict";

  if (window.top !== window.self) return;           // iframes only get noise
  if (location.protocol.startsWith("chrome") || location.protocol.startsWith("edge")) return;

  let host = null;
  let label = null;
  let timerId = null;

  function ensureWidget() {
    if (host) return;
    host = document.createElement("div");
    host.id = "mst-lock-widget";
    host.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:2147483647;pointer-events:none;";
    const root = host.attachShadow({ mode: "closed" });
    const el = document.createElement("div");
    el.textContent = "";
    el.style.cssText = [
      "font: 700 12.5px/1 'Segoe UI', system-ui, sans-serif",
      "letter-spacing:0.06em",
      "color:#fff",
      "background:linear-gradient(135deg, rgba(240,90,130,.92), rgba(200,60,110,.92))",
      "padding:9px 14px",
      "border-radius:999px",
      "box-shadow:0 6px 22px rgba(0,0,0,.30)",
      "backdrop-filter:blur(4px)",
      "font-variant-numeric:tabular-nums"
    ].join(";");
    root.appendChild(el);
    label = el;
    (document.body || document.documentElement).appendChild(host);
  }

  function destroyWidget() {
    if (host) { host.remove(); host = null; label = null; }
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  function fmt(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  async function sync() {
    try {
      const { lock } = await chrome.storage.local.get("lock");
      if (lock && lock.active && lock.endAt > Date.now()) {
        ensureWidget();
        const left = lock.endAt - Date.now();
        label.textContent = lock.mode === "hardcore"
          ? `🔒 ${fmt(left)} · HARDCORE`
          : `🔒 ${fmt(left)} · STUDY LOCK`;
      } else {
        destroyWidget();
      }
    } catch (e) { destroyWidget(); }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.lock) sync();
  });
  sync();
  timerId = setInterval(sync, 1000);
})();
