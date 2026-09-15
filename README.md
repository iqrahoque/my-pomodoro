# 🍅 MY STUDY TIMER (my-pomodoro)

A Pomodoro study timer built to grow with me — starting from a single
beautiful 25-minute timer and layering on themes, a focus monitor, sounds,
statistics, and eventually a browser extension that locks distractions away
while I study.

**Current version: V0.1 — Foundation** (Phase 1 of the roadmap)

## What V0.1 does

- Working 25-minute focus timer with a circular progress ring
- START / PAUSE / RESUME / RESET
- Live countdown mirrored in the browser tab title
- Drift-proof countdown — it is timestamp-based, so it stays accurate even
  when the browser throttles timers in a background tab
- Sakura-inspired default theme, with every color defined as a CSS variable
  so future themes swap palettes without touching layout
- Monospaced clock digits (JetBrains Mono) so the numbers never jump around
- Zero dependencies, zero build step

## Run it

1. Clone or download this repo
2. Open `index.html` in your browser

That's it. Optionally serve it locally:

```bash
python3 -m http.server
```

## Project structure (for now)

```
my-pomodoro/
├── index.html
├── style.css
└── script.js
```

Deliberately small — every feature below gets layered onto this same base
instead of becoming a giant mess of code on day one.

## Roadmap

| Phase | Goal | Status |
|-------|------|--------|
| 1 — Foundation | HTML/CSS/JS · start/pause · reset · countdown | ✅ V0.1 |
| 2 — Real Pomodoro | Focus / short break / long break · session counter · auto transitions | ⏳ |
| 3 — Personality | Preset themes · custom colors · clock styles · fonts | ⏳ |
| 4 — Sound | Completion + reminder sounds · volume · custom audio | ⏳ |
| 5 — Preferences | Settings page · custom durations · localStorage | ⏳ |
| 6 — Focus Monitor | Mouse/keyboard/scroll detection · reminder levels · reading mode | ⏳ |
| 7 — Browser Extension | manifest.json · tabs API · content scripts | ⏳ |
| 8 — Study Lock | Allowlist · strict & hardcore modes · blocked page | ⏳ |
| 9 — Statistics | Daily focus time · weekly graph · streaks · history | ⏳ |
| 10 — Polish | Responsive · shortcuts · accessibility · PWA · packaging | ⏳ |
