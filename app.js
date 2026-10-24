
"use strict";

// ======================================
// FitSoul - Automatic Step Tracker
// ======================================

const DAILY_GOAL = 8000;

// Approximate values; personalize these for better estimates.
const STEP_LENGTH_KM = 0.0007;
const KCAL_PER_STEP = 0.04;

// Motion detection tuning. These are starting values,
// not guaranteed to work identically on every phone.
const STEP_THRESHOLD = 1.15;
const MIN_STEP_INTERVAL_MS = 300;

const $ = (id) => document.getElementById(id);

const countEl = $("stepCount");
const statusEl = $("stepStatus");
const statusDot = $("statusDot");
const startBtn = $("startTracking");
const stopBtn = $("stopTracking");
const resetBtn = $("resetTracking");

let steps = 0;
let tracking = false;
let hasMotionData = false;
let lastStepTime = 0;
let gravityEstimate = 9.81;
let previousSignal = 0;
let previousDelta = 0;
let motionHandler = null;
let sensorCheckTimer = null;

// --------------------------------------
// Daily storage
// --------------------------------------

function getTodayKey() {
  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `fitsoul-steps-${year}-${month}-${day}`;
}

let storageKey = getTodayKey();

function saveSteps() {
  try {
    localStorage.setItem(storageKey, String(steps));
  } catch (error) {
    console.warn("FitSoul could not save steps:", error);
  }
}

function loadSteps() {
  storageKey = getTodayKey();

  try {
    const saved = Number(localStorage.getItem(storageKey));
    steps = Number.isSafeInteger(saved) && saved >= 0 ? saved : 0;
  } catch (error) {
    steps = 0;
  }
}

// Check for a new day while the page remains open.
function checkNewDay() {
  const newKey = getTodayKey();

  if (newKey !== storageKey) {
    storageKey = newKey;
    steps = 0;
    saveSteps();
    renderDashboard();
  }
}

// --------------------------------------
// Dashboard
// --------------------------------------

function renderDashboard() {
  const progress = Math.min((steps / DAILY_GOAL) * 100, 100);
  const distance = steps * STEP_LENGTH_KM;
  const calories = Math.round(steps * KCAL_PER_STEP);

  countEl.textContent = steps.toLocaleString();

  $("stepProgress").style.width = `${progress}%`;
  $("stepProgressTrack").setAttribute(
    "aria-valuenow",
    String(Math.round(progress))
  );

  $("progressPercent").textContent =
    `${Math.round(progress)}% completed`;

  $("goalLabel").textContent = DAILY_GOAL.toLocaleString();

  $("distance").textContent = distance.toFixed(2);
  $("calories").textContent = calories.toLocaleString();

  $("stepsSummary").textContent =
    `${steps.toLocaleString()} / ${DAILY_GOAL.toLocaleString()}`;

  $("distanceSummary").textContent = `${distance.toFixed(2)} km`;
  $("caloriesSummary").textContent = `${calories.toLocaleString()} kcal`;

  $("stepsMiniProgress").style.width = `${progress}%`;

  $("goalMessage").textContent =
    steps >= DAILY_GOAL
      ? "🎉 Amazing! You reached your daily step goal."
      : `🌟 ${(DAILY_GOAL - steps).toLocaleString()} more steps to reach your goal.`;

  saveSteps();
}

function setStatus(message, type = "idle") {
  statusEl.textContent = message;
  statusDot.classList.toggle("active", type === "active");
  statusDot.classList.toggle("warning", type === "warning");
}

// --------------------------------------
// Motion sensor and step detection
// --------------------------------------

function handleMotion(event) {
  if (!tracking) return;

  const acceleration = event.acceleration;
  const gravityAcceleration = event.accelerationIncludingGravity;

  let signal;

  // Prefer acceleration with gravity already removed.
  if (
    acceleration &&
    acceleration.x !== null &&
    acceleration.y !== null &&
    acceleration.z !== null
  ) {
    signal = Math.hypot(
      acceleration.x,
      acceleration.y,
      acceleration.z
    );
  } else if (
    gravityAcceleration &&
    gravityAcceleration.x !== null &&
    gravityAcceleration.y !== null &&
    gravityAcceleration.z !== null
  ) {
    const magnitude = Math.hypot(
      gravityAcceleration.x,
      gravityAcceleration.y,
      gravityAcceleration.z
    );

    // Rough gravity estimate to isolate movement.
    gravityEstimate += 0.15 * (magnitude - gravityEstimate);
    signal = Math.abs(magnitude - gravityEstimate);
  } else {
    return;
  }

  if (!Number.isFinite(signal)) return;

  hasMotionData = true;

  const delta = signal - previousSignal;
  const now = Date.now();

  // Count a step at a local motion peak, with a cooldown
  // to reduce duplicate detections.
  if (
    previousDelta > 0 &&
    delta <= 0 &&
    previousSignal > STEP_THRESHOLD &&
    now - lastStepTime >= MIN_STEP_INTERVAL_MS
  ) {
    steps++;
    lastStepTime = now;
    renderDashboard();
  }

  previousDelta = delta;
  previousSignal = signal;
}

// --------------------------------------
// Start tracking
// --------------------------------------

async function startTracking() {
  if (tracking) return;

  if (!window.isSecureContext) {
    setStatus("Open FitSoul over HTTPS to use motion sensors.", "warning");
    return;
  }

  if (!("DeviceMotionEvent" in window)) {
    setStatus(
      "Motion tracking is not supported by this browser.",
      "warning"
    );
    return;
  }

  startBtn.disabled = true;
  setStatus("Checking motion permission…");

  try {
    // iOS Safari requires this request to follow a user action.
    if (
      typeof DeviceMotionEvent.requestPermission === "function"
    ) {
      const permission =
        await DeviceMotionEvent.requestPermission();

      if (permission !== "granted") {
        setStatus(
          "Motion access denied. Allow access and try again.",
          "warning"
        );
        startBtn.disabled = false;
        return;
      }
    }

    previousSignal = 0;
    previousDelta = 0;
    gravityEstimate = 9.81;
    hasMotionData = false;

    motionHandler = handleMotion;

    window.addEventListener("devicemotion", motionHandler);

    tracking = true;
    stopBtn.disabled = false;

    setStatus("Waiting for sensor data… Start walking.");

    clearTimeout(sensorCheckTimer);

    sensorCheckTimer = setTimeout(() => {
      if (tracking && !hasMotionData) {
        setStatus(
          "No sensor data received. Check browser permissions.",
          "warning"
        );
      } else if (tracking && hasMotionData) {
        setStatus("Motion sensor active. Keep walking!", "active");
      }
    }, 5000);

  } catch (error) {
    tracking = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    if (error.name === "NotAllowedError") {
      setStatus(
        "Permission denied. Check your browser's motion settings.",
        "warning"
      );
    } else {
      setStatus(
        "Unable to start tracking. Try reopening FitSoul.",
        "warning"
      );
    }

    console.error("FitSoul motion error:", error);
  }
}

// --------------------------------------
// Stop tracking
// --------------------------------------

function stopTracking() {
  tracking = false;

  clearTimeout(sensorCheckTimer);

  if (motionHandler) {
    window.removeEventListener("devicemotion", motionHandler);
    motionHandler = null;
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;

  setStatus("Tracking stopped. Your steps are saved.");
  renderDashboard();
}

// --------------------------------------
// Reset daily count
// --------------------------------------

function resetTracking() {
  const confirmed = window.confirm(
    "Reset today's step count? This cannot be undone."
  );

  if (!confirmed) return;

  steps = 0;
  lastStepTime = 0;
  previousSignal = 0;
  previousDelta = 0;

  renderDashboard();
  setStatus(
    tracking
      ? "Step count reset. Keep walking!"
      : "Today's step count has been reset.",
    tracking ? "active" : "idle"
  );
}

// --------------------------------------
// Page visibility and lifecycle
// --------------------------------------

document.addEventListener("visibilitychange", () => {
  saveSteps();

  if (document.hidden && tracking) {
    setStatus(
      "App in background. Sensor updates may pause.",
      "warning"
    );
  } else if (tracking) {
    setStatus(
      hasMotionData
        ? "FitSoul is open. Keep walking!"
        : "Waiting for motion data…",
      hasMotionData ? "active" : "warning"
    );
  }

  checkNewDay();
});

window.addEventListener("pagehide", saveSteps);

// --------------------------------------
// Initialize
// --------------------------------------

startBtn.addEventListener("click", startTracking);
stopBtn.addEventListener("click", stopTracking);
resetBtn.addEventListener("click", resetTracking);

$("todayDate").textContent = new Date().toLocaleDateString(
  undefined,
  {
    weekday: "short",
    month: "short",
    day: "numeric"
  }
);

loadSteps();
renderDashboard();
setStatus("Tracker is stopped");
