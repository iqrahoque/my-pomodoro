/* ============================================================
   MY STUDY TIMER — themes.js
   Phase 3 (Personality): preset themes, custom theme builder,
   fonts, animations. Applies everything via data-attributes +
   CSS variables on <html>.
   ============================================================ */
(function () {
  "use strict";

  const PRESETS = {
    sakura:     { label: "🌸 Sakura",     a: "#f66a8c", b: "#ffe3ec" },
    matcha:     { label: "🌿 Matcha",     a: "#7a9d54", b: "#e4eed7" },
    ocean:      { label: "🌊 Ocean",      a: "#2f9dd0", b: "#d8ecf9" },
    lavender:   { label: "💜 Lavender",   a: "#8b6fd8", b: "#e9e2fa" },
    cafe:       { label: "☕ Café",       a: "#9a6b4f", b: "#ecdfd0" },
    midnight:   { label: "🌙 Midnight",   a: "#8f7bff", b: "#3a3f6e" },
    sunset:     { label: "🌅 Sunset",     a: "#f2795c", b: "#ffe3d6" },
    forest:     { label: "🌲 Forest",     a: "#3e7d54", b: "#dbe9dc" },
    strawberry: { label: "🍓 Strawberry", a: "#e64560", b: "#ffdadf" },
    arctic:     { label: "🧊 Arctic",     a: "#4aa3c7", b: "#dcedf6" },
    cyber:      { label: "🖥️ Cyber",      a: "#00e5ff", b: "#16283a" }
  };

  const FONTS = {
    quicksand: "Quicksand", nunito: "Nunito", inter: "Inter",
    poppins: "Poppins", dmsans: "DM Sans"
  };
  const CLOCK_FONTS = { jetbrains: "JetBrains Mono", spacemono: "Space Mono" };

  /* ---------- color helpers for custom themes ---------- */
  function clamp(n) { return Math.max(0, Math.min(255, Math.round(n))); }
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
  }
  function shade(hex, amt) { // amt > 0 lighten, < 0 darken
    const { r, g, b } = hexToRgb(hex);
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
  }
  function mix(hexA, hexB, w) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return rgbToHex(a.r + (b.r - a.r) * w, a.g + (b.g - a.g) * w, a.b + (b.b - a.b) * w);
  }
  function isLight(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
  }

  /* Apply a saved custom theme object as CSS variables. */
  function applyCustom(t) {
    const root = document.documentElement;
    const bg2 = shade(t.bg, isLight(t.bg) ? -0.05 : 0.06);
    const s = {
      "--bg-gradient": `linear-gradient(135deg, ${t.bg} 0%, ${mix(t.bg, bg2, 0.5)} 55%, ${bg2} 100%)`,
      "--card": t.card,
      "--primary": t.primary,
      "--primary-deep": shade(t.primary, -0.18),
      "--primary-soft": mix(t.card, t.primary, 0.16),
      "--secondary": t.secondary,
      "--text": t.text,
      "--muted": mix(t.text, t.card, 0.45),
      "--ring-track": mix(t.card, t.primary, 0.16),
      "--ring-progress": t.progress,
      "--ring-break": mix(t.secondary, "#7fb069", 0.45),
      "--timer-color": t.timer,
      "--btn-gradient": `linear-gradient(135deg, ${t.primary}, ${t.buttons})`,
      "--shadow": `0 24px 60px -18px ${mix(t.primary, "#000000", 0.55)}59`,
      "--blob-1": mix(t.primary, "#ffffff", 0.25) + "59",
      "--blob-2": mix(t.secondary, "#ffffff", 0.25) + "59",
      "--banner-bg": mix(t.card, t.primary, 0.07),
      "--border-soft": mix(t.card, t.text, 0.16)
    };
    root.setAttribute("data-theme", "custom");
    Object.entries(s).forEach(([k, v]) => root.style.setProperty(k, v));
  }

  function clearCustom() {
    const root = document.documentElement;
    ["--bg-gradient", "--card", "--primary", "--primary-deep", "--primary-soft", "--secondary",
     "--text", "--muted", "--ring-track", "--ring-progress", "--ring-break", "--timer-color",
     "--btn-gradient", "--shadow", "--blob-1", "--blob-2", "--banner-bg", "--border-soft"]
      .forEach((k) => root.style.removeProperty(k));
  }

  /* Master apply — reads settings and updates <html> attributes. */
  function applyAll() {
    const st = window.MST.storage;
    const app = st.get("settings.appearance");
    const root = document.documentElement;

    root.setAttribute("data-clock", app.clockStyle);
    root.setAttribute("data-font", app.font in FONTS ? app.font : "quicksand");
    root.setAttribute("data-clockfont", app.clockFont in CLOCK_FONTS ? app.clockFont : "jetbrains");
    root.setAttribute("data-animations", app.animations ? "on" : "off");

    const setThemeColor = (hex) => {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", hex);
    };

    if (app.theme === "custom" && Array.isArray(app.customThemes) && app.customThemes.length) {
      // Most recently applied custom theme is stored in settings.appearance.customName
      const chosen = app.customThemes.find((t) => t.name === app.customName) || app.customThemes[app.customThemes.length - 1];
      applyCustom(chosen);
      setThemeColor(chosen.bg);
    } else {
      clearCustom();
      root.setAttribute("data-theme", PRESETS[app.theme] ? app.theme : "sakura");
      setThemeColor(app.theme === "midnight" ? "#1c2340" : app.theme === "cyber" ? "#0c1120" : "#ffe9f0");
    }
  }

  window.MST = window.MST || {};
  window.MST.themes = { PRESETS, FONTS, CLOCK_FONTS, applyAll, applyCustom, clearCustom, shade, mix };
})();
