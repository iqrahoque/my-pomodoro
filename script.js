/* ============================================================
   MY STUDY TIMER — script.js
   V0.1 · Phase 1 (Foundation): countdown + start/pause + reset
   ------------------------------------------------------------
   Design notes for future phases:
   - The countdown uses timestamps (Date.now()), never second
     counting, so it stays accurate even when the browser
     throttles setInterval in a background tab.
   - All state lives in one `timer` object — Phase 2 (real
     Pomodoro: focus / short break / long break / sessions)
     will grow this into a small mode machine.
   - Sounds (Phase 4), settings + localStorage (Phase 5) and
     the focus monitor (Phase 6) hook in without rewrites.
   ============================================================ */

"use strict";

/* ---------- Configuration (Settings page arrives in Phase 5) ---------- */
const FOCUS_MINUTES = 25;

/* ---------- DOM references ---------- */
const timeDisplay  = document.getElementById("time-display");
const ringProgress = document.getElementById("ring-progress");
const startBtn     = document.getElementById("start-btn");
const resetBtn     = document.getElementById("reset-btn");
const modeLabel    = document.getElementById("mode-label");
const hint         = document.getElementById("hint");
const timerCard    = document.querySelector(".timer-card");

/* ---------- Progress ring geometry ---------- */
const RING_RADIUS = 144;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
ringProgress.style.strokeDasharray = RING_CIRCUMFERENCE;

/* ---------- Timer state ---------- */
const timer = {
  totalSeconds: FOCUS_MINUTES * 60,
  remaining: FOCUS_MINUTES * 60,
  isRunning: false,
  endAt: null,   // timestamp (ms) when the countdown hits zero
  tickId: null,  // interval handle
};

/* ---------- Helpers ---------- */
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* Push current state to the screen: digits, ring, tab title */
function render() {
  timeDisplay.textContent = formatTime(timer.remaining);

  const fraction =
    timer.totalSeconds === 0 ? 0 : timer.remaining / timer.totalSeconds;
  ringProgress.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - fraction);

  document.title =
    timer.isRunning || timer.remaining < timer.totalSeconds
      ? `${formatTime(timer.remaining)} · My Study Timer`
      : "My Study Timer";
}

/* ---------- Core actions ---------- */
function startTimer() {
  if (timer.isRunning) return;

  // Finished a run? Start fresh.
  if (timer.remaining <= 0) {
    timer.remaining = timer.totalSeconds;
    timerCard.classList.remove("done");
  }

  timer.isRunning = true;
  timer.endAt = Date.now() + timer.remaining * 1000;
  timer.tickId = setInterval(tick, 200);

  startBtn.textContent = "PAUSE";
  hint.textContent = "Locked in. Stay with it.";
  render();
}

function pauseTimer() {
  if (!timer.isRunning) return;

  timer.remaining = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
  stopTicking();
  timer.isRunning = false;

  startBtn.textContent = "RESUME";
  hint.textContent = "Paused. Take a breath, then jump back in.";
  render();
}

function resetTimer() {
  stopTicking();
  timer.isRunning = false;
  timer.remaining = timer.totalSeconds;

  startBtn.textContent = "START";
  modeLabel.textContent = "FOCUS";
  timerCard.classList.remove("done");
  hint.textContent = "25 minutes of focused study. You've got this.";
  render();
}

function tick() {
  timer.remaining = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));

  if (timer.remaining <= 0) {
    completeSession();
    return;
  }
  render();
}

function stopTicking() {
  if (timer.tickId !== null) {
    clearInterval(timer.tickId);
    timer.tickId = null;
  }
}

/* V0.1: a clear visual finish. Completion sounds arrive in Phase 4. */
function completeSession() {
  stopTicking();
  timer.isRunning = false;
  timer.remaining = 0;

  startBtn.textContent = "START";
  modeLabel.textContent = "SESSION COMPLETE ✓";
  hint.textContent =
    "Beautiful work. Stretch, hydrate, rest your eyes — breaks arrive in Phase 2.";
  timerCard.classList.add("done");
  render();
}

/* ---------- Wiring ---------- */
startBtn.addEventListener("click", () =>
  timer.isRunning ? pauseTimer() : startTimer()
);
resetBtn.addEventListener("click", resetTimer);

/* First paint */
render();
