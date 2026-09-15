# 🔒 Study Lock — companion extension (Chrome / Edge, MV3)

Blocks distracting sites during My Study Timer sessions. The precise
promise: **during a locked session, this extension prevents navigation to
websites outside your study allowlist.** It can't see other browsers,
desktop apps or your phone.

## Install
1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge)
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this `extension/` folder

## Pair with the web dashboard (one time)
1. On `chrome://extensions`, click *Details* on My Study Timer → copy the **ID**
2. Open the dashboard → Settings → Study Lock → paste the ID → **TEST**
3. Now START FOCUS on the dashboard automatically arms the lock with your
   allowlist, chosen mode and grace period — and completing a session
   releases it.

## Modes
| Mode | Blocked site behaviour | Can dashboard stop it? |
|------|------------------------|------------------------|
| Gentle | Notification warning | Yes |
| Strict | Auto-redirect to countdown page | Yes |
| Hardcore | Auto-redirect + violations counter | **No** (popup emergency stop only) |

A grace period (default 10 s, configurable) at session start lets you fix
mistakes without getting trapped.

## Files
- `manifest.json` — MV3, permissions: `tabs`, `storage`, `notifications`, `alarms`
- `background.js` — service worker: URL classification, enforcement, messaging
- `content.js` — floating 🔒 countdown widget on allowed pages
- `blocked.html/css/js` — the "This site is blocked" page
- `popup/` — quick sessions, emergency stop, allow current site
