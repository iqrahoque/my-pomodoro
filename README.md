# 🍅 MY STUDY TIMER (my-pomodoro)

A Pomodoro study timer that grew up — themes, a focus monitor, sounds,
statistics, PWA support, and a companion browser extension that locks
distractions away while you study.

**Live app: https://iqrahoque.github.io/my-pomodoro/**

Built phase by phase, exactly as planned. Every feature below is implemented.

## Features

### Timer (Phases 1–2)
- Focus / short break / long break with automatic transitions
- Presets: `25/5` classic · `50/10` deep study · `45/15` lecture/coding · `90/20` deep work · fully custom
- Session counter with progress dots; long break after N sessions (configurable)
- Drift-proof timestamp countdown (survives background-tab throttling)
- Live countdown in the tab title, desktop notifications

### Personality (Phase 3)
- 11 preset themes: 🌸 Sakura · 🌿 Matcha · 🌊 Ocean · 💜 Lavender · ☕ Café ·
  🌙 Midnight · 🌅 Sunset · 🌲 Forest · 🍓 Strawberry · 🧊 Arctic · 🖥️ Cyber
- Custom theme builder (8 color fields, named, saved, applied via CSS variables)
- 6 clock styles: Circular · Digital · Minimal · Flip · Progress bar · Large fullscreen
- UI fonts: Quicksand / Nunito / Inter / Poppins / DM Sans — clock fonts:
  JetBrains Mono / Space Mono (monospace so digits never jump)
- Animations toggle (also respects `prefers-reduced-motion`)

### Sound (Phase 4)
All sounds are synthesized with the Web Audio API — zero audio files:
- Refreshing Chime (C → E → G) · Soft Bell · Glass · Rain Drop · Tiny Piano · Morning Chime
- Custom uploaded `.mp3`/`.wav` (stored locally, ≤ 2 MB)
- Master volume + per-event toggles (timer complete / break complete /
  inactivity / tab blocked) + optional "Hey. Focus." spoken reminder

### Preferences (Phase 5)
Full settings page (settings.html): appearance, timer durations, sound,
focus monitor, study lock, behavior — everything saved to `localStorage`
with export / import / reset.

### Focus Monitor (Phase 6)
Tracks mouse, click, keyboard, scroll and touch as activity signals with a
**smart inactivity ladder** (defaults: 120 s soft banner → 150 s sound →
180 s strong + voice, all customizable). **Reading Mode** ignores input
inactivity and only watches tab violations. Honest by design: it detects
browser activity, not whether you are actually studying.

### Session intent ("I am studying…" mode)
Before starting: task name, duration preset, theme, clock, lock mode.
After each session: a summary — duration, violations, reminder count —
feeding the statistics.

### Statistics (Phase 9)
Today (focus time, sessions, completion, longest streak), 7-day bar chart,
day streak, recent session history with flags. All local.

### Polish (Phase 10)
Responsive · keyboard shortcuts (`Space`, `R`, `S`, `F`, `M`, `?`, `Esc`) ·
accessibility (aria, focus states, reduced motion) · error handling ·
onboarding · empty states · favicon · PWA (manifest + service worker →
installable & works offline).

## Browser extension — Study Lock (Phases 7–8) → `extension/`

> "During a locked session, this extension prevents navigation to websites
> outside your study allowlist." — that's the precise promise. It cannot see
> other browsers, desktop apps or your phone.

- **Allowlist model**: everything not on your list is blocked during a session
  (`.pdf` files always allowed)
- **Gentle** — notification warning only
- **Strict** — auto-redirect to a themed blocked page with live countdown
- **Hardcore** — no dashboard stop, no escape; 10 s grace period at start
- Floating 🔒 countdown widget on allowed pages (Shadow DOM)
- Popup: quick locked sessions, emergency stop, allow-current-site
- **Pairs with the dashboard** via `externally_connectable` — paste the
  extension ID into Settings → Study Lock once, then START FOCUS arms it

### Install (Chrome / Edge)
1. Download / clone this repo
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. **Load unpacked** → select the `extension/` folder
5. Copy the extension ID → Settings → Study Lock → paste → TEST

## Project structure

```
my-pomodoro/
├── index.html            # timer app
├── settings.html         # preferences
├── manifest.json         # PWA manifest
├── sw.js                 # service worker (offline)
├── css/
│   ├── main.css          # layout + clock styles
│   ├── themes.css        # palettes + fonts
│   └── components.css    # buttons, toggles, editors
├── js/
│   ├── storage.js        # localStorage layer (loads first)
│   ├── themes.js         # presets + custom builder
│   ├── sounds.js         # Web Audio synth engine
│   ├── activity.js       # focus monitor
│   ├── stats.js          # statistics
│   ├── timer.js          # Pomodoro state machine
│   ├── app.js            # UI orchestration (index)
│   └── settings.js       # settings page logic
├── assets/icons/         # favicon + PWA icons
└── extension/            # Chrome / Edge MV3 extension
    ├── manifest.json
    ├── background.js     # service worker — lock enforcement
    ├── content.js        # floating countdown widget
    ├── blocked.html/css/js
    ├── icons/
    └── popup/            # toolbar popup
```

The web app lives at the repo root so GitHub Pages serves it at the clean
URL; the extension is a self-contained folder you load unpacked.

## Run locally

No build step, no dependencies:
- **App**: open `index.html`, or `python3 -m http.server` → http://localhost:8000
- **Extension**: load `extension/` unpacked (steps above)

## Privacy

Everything — settings, themes, stats, custom sounds — stays in your
browser's localStorage. Nothing is uploaded, no analytics, no accounts.
