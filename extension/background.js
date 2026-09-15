/* ============================================================
   MY STUDY TIMER — background.js (MV3 service worker)
   Phase 7 (extension basics) + Phase 8 (Study Lock).
   ------------------------------------------------------------
   THE PROMISE (precise, per the spec):
   "During a locked session, this extension prevents navigation
    to websites outside your study allowlist."
   It cannot see other browsers, desktop apps or phones.

   Modes:
     gentle   — notification warning, no redirect
     strict   — auto-redirect to blocked.html
     hardcore — strict + refuses stop/skip from the dashboard
   A grace period at session start lets you fix mistakes.
   ============================================================ */

const DEFAULT_ALLOWLIST = [
  "chatgpt.com", "elms.uiu.ac.bd", "google.com", "docs.google.com",
  "drive.google.com", "github.com", "stackoverflow.com", "coursera.org", "udemy.com"
];
const BLOCKED_PAGE = chrome.runtime.getURL("blocked.html");

/* ---------------- state helpers ---------------- */
async function getLock() {
  const { lock } = await chrome.storage.local.get("lock");
  return lock && lock.active ? lock : { active: false };
}
async function setLock(lock) {
  await chrome.storage.local.set({ lock });
  await updateBadge(lock);
  if (lock && lock.active && lock.endAt) {
    chrome.alarms.create("mst-session-end", { when: lock.endAt });
  } else {
    chrome.alarms.clear("mst-session-end");
  }
}
async function updateBadge(lock) {
  try {
    if (lock && lock.active) {
      chrome.action.setBadgeText({ text: "ON" });
      chrome.action.setBadgeBackgroundColor({ color: "#e0517a" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (e) {}
}

function bumpViolations() {
  chrome.storage.local.get("lock").then(({ lock }) => {
    if (lock && lock.active) {
      lock.violations = (lock.violations || 0) + 1;
      chrome.storage.local.set({ lock });
    }
  });
}

/* ---------------- URL classification ---------------- */
const BROWSER_SCHEMES = /^(chrome|edge|about|chrome-extension|moz-extension|view-source|devtools):/i;

function classify(url, allowlist) {
  try {
    const u = new URL(url);
    if (BROWSER_SCHEMES.test(u.protocol)) return "browser";
    if (u.protocol === "file:") return u.pathname.toLowerCase().endsWith(".pdf") ? "allowed" : "browser";
    if (u.pathname.toLowerCase().endsWith(".pdf")) return "allowed"; // PDFs are always allowed
    const host = u.hostname.toLowerCase();
    const list = Array.isArray(allowlist) ? allowlist : DEFAULT_ALLOWLIST;
    for (const d of list) {
      const dom = String(d).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (host === dom || host.endsWith("." + dom)) return "allowed";
    }
    return "blocked";
  } catch (e) {
    return "allowed"; // unparseable → don't trap the user
  }
}

/* ---------------- enforcement ---------------- */
let lastWarned = {};
async function guardUrl(tabId, url) {
  const lock = await getLock();
  if (!lock.active) return;
  if (Date.now() < (lock.graceUntil || 0)) return;      // grace period
  if (!url || url.startsWith(BLOCKED_PAGE)) return;
  if (Date.now() >= (lock.endAt || 0)) { await clearLock(false); return; }

  const verdict = classify(url, lock.allowlist);
  if (verdict !== "blocked") return;

  let host = "site";
  try { host = new URL(url).hostname; } catch (e) {}
  bumpViolations();

  if (lock.mode === "gentle") {
    const now = Date.now();
    if (lastWarned[host] && now - lastWarned[host] < 120000) return;
    lastWarned[host] = now;
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon-128.png",
      title: "My Study Timer",
      message: `You're drifting — ${host} is not on your allowlist. ${remainingStr(lock.endAt)} left. Back to studying!`
    });
    return;
  }

  // strict / hardcore: redirect
  const target = BLOCKED_PAGE +
    "?from=" + encodeURIComponent(url) +
    "&end=" + encodeURIComponent(lock.endAt || Date.now()) +
    "&mode=" + encodeURIComponent(lock.mode || "strict");
  chrome.tabs.update(tabId, { url: target });
}

function remainingStr(endAt) {
  const s = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  const m = Math.floor(s / 60), r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || (changeInfo.status === "loading" && tab && tab.url);
  if (url) guardUrl(tabId, url);
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url) guardUrl(tabId, tab.url);
  } catch (e) {}
});

/* ---------------- session lifecycle ---------------- */
async function startLock(msg) {
  const durationMin = Math.max(1, Number(msg.durationMin) || 25);
  const now = Date.now();
  const lock = {
    active: true,
    mode: ["gentle", "strict", "hardcore"].includes(msg.mode) ? msg.mode : "strict",
    task: String(msg.task || "Focus session").slice(0, 80),
    startedAt: now,
    endAt: now + durationMin * 60000,
    graceUntil: now + Math.max(0, Number(msg.graceSec ?? 10)) * 1000,
    allowlist: Array.isArray(msg.allowlist) && msg.allowlist.length ? msg.allowlist : DEFAULT_ALLOWLIST,
    violations: 0
  };
  await setLock(lock);
  try {
    chrome.notifications.create({
      type: "basic", iconUrl: "icons/icon-128.png",
      title: "🔒 Study Lock armed",
      message: `${lock.mode} mode · ${durationMin} min · “${lock.task}”`
    });
  } catch (e) {}
  return { ok: true, lock: { active: true, mode: lock.mode, endAt: lock.endAt } };
}

async function clearLock(announce) {
  await setLock({ active: false });
  if (announce) {
    try {
      chrome.notifications.create({
        type: "basic", iconUrl: "icons/icon-128.png",
        title: "Study Lock released",
        message: "Session over — the whole web is yours again."
      });
    } catch (e) {}
  }
  return { ok: true };
}

/* ---------------- messaging (web dashboard + popup) ---------------- */
async function handleMessage(msg, external) {
  if (!msg || typeof msg.type !== "string") return { ok: false, reason: "bad-message" };
  const lock = await getLock();
  switch (msg.type) {
    case "MST_PING":
      return { ok: true, version: "1.0.0", active: lock.active };
    case "MST_START_LOCK":
      if (lock.active && lock.mode === "hardcore" && Date.now() < lock.endAt) {
        return { ok: false, reason: "hardcore: a locked session is already running" };
      }
      return startLock(msg);
    case "MST_STOP_LOCK":
      if (lock.active && lock.mode === "hardcore" && Date.now() < lock.endAt && external) {
        return { ok: false, reason: "hardcore: you can't disable Study Lock from the dashboard" };
      }
      return clearLock(false);
    case "MST_STATE":
      return { ok: true, state: { active: lock.active, mode: lock.mode, endAt: lock.endAt, task: lock.task, violations: lock.violations || 0 } };
    default:
      return { ok: false, reason: "unknown-type" };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, false).then(sendResponse);
  return true; // async
});

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  const allowed = /^(https:\/\/iqrahoque\.github\.io|https?:\/\/localhost(:\d+)?|https?:\/\/127\.0\.0\.1(:\d+)?)/.test(sender.url || "");
  if (!allowed) { sendResponse({ ok: false, reason: "untrusted-origin" }); return; }
  handleMessage(msg, true).then(sendResponse);
  return true;
});

/* ---------------- session end alarm ---------------- */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "mst-session-end") clearLock(true);
});
