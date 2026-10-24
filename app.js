
(() => {
  const startBtn = document.getElementById("startTracking");
  const resetBtn = document.getElementById("resetTracking");
  const status = document.getElementById("trackerStatus");

  if (!startBtn || !resetBtn || !status) {
    console.error("FitSoul: Required buttons or status element are missing.");
    return;
  }

  const GOAL = 8000;
  const dateKey = () => {
    const d = new Date();
    return `fitsoul-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  let key = dateKey();
  let steps = Number(localStorage.getItem(key) || 0);
  let tracking = false;
  let lastStep = 0;
  let gravity = 9.81;
  let previousSignal = 0;
  let previousSlope = 0;

  function refresh() {
    if (key !== dateKey()) {
      key = dateKey();
      steps = Number(localStorage.getItem(key) || 0);
    }

    if (typeof updateDashboard === "function") {
      updateDashboard(steps);
    } else {
      const count = document.getElementById("stepCount");
      if (count) count.textContent = steps.toLocaleString();
    }

    localStorage.setItem(key, String(steps));
  }

  function onMotion(event) {
    if (!tracking) return;

    const a = event.acceleration;
    const g = event.accelerationIncludingGravity;
    let signal;

    if (a && a.x !== null && a.y !== null && a.z !== null) {
      signal = Math.hypot(a.x, a.y, a.z);
    } else if (g && g.x !== null && g.y !== null && g.z !== null) {
      const magnitude = Math.hypot(g.x, g.y, g.z);
      gravity += 0.15 * (magnitude - gravity);
      signal = Math.abs(magnitude - gravity);
    } else {
      status.textContent = "Sensor data unavailable. Try another phone browser.";
      return;
    }

    const slope = signal - previousSignal;
    const now = Date.now();

    if (
      previousSlope > 0 &&
      slope <= 0 &&
      previousSignal > 1.15 &&
      now - lastStep >= 300
    ) {
      steps++;
localStorage.setItem(key, String(steps));
updateAllFitnessStats(steps);

const resetButton = document.getElementById("resetTracking");

if (resetButton) {
  resetButton.addEventListener("click", () => {
    const confirmed = confirm(
      "Reset today's steps, calories, distance, and progress?"
    );

    if (!confirmed) return;

    // Reset today's count
    steps = 0;
    localStorage.setItem(key, "0");

    // Update every dashboard statistic
    updateAllFitnessStats(steps);

    // Reset the sensor detector's previous movement state
    previous = 0;
    peak = false;

    // Keep tracking active if it was already running
    status.textContent = tracking
      ? "Steps reset. Keep walking!"
      : "Today's progress has been reset.";

  });
}

    }

    previousSlope = slope;
    previousSignal = signal;
  }

  async function start() {
    if (tracking) return;

    if (!window.isSecureContext) {
      status.textContent = "Open FitSoul using its HTTPS GitHub Pages URL.";
      return;
    }

    if (!("DeviceMotionEvent" in window)) {
      status.textContent = "This browser does not support motion sensors.";
      return;
    }

    try {
      if (typeof DeviceMotionEvent.requestPermission === "function") {
        const permission = await DeviceMotionEvent.requestPermission();

        if (permission !== "granted") {
          status.textContent = "Please allow motion sensor access.";
          return;
        }
      }

      // Reset detection state when tracking starts.
      previousSignal = 0;
      previousSlope = 0;
      gravity = 9.81;

      window.addEventListener("devicemotion", onMotion);

      tracking = true;
      startBtn.textContent = "Tracking active";
      status.textContent = "Walk with your phone to test step counting.";
    } catch (error) {
      status.textContent = "Could not start tracking. Check browser permissions.";
      console.error(error);
    }
  }

  function stop() {
    window.removeEventListener("devicemotion", onMotion);
    tracking = false;
    startBtn.textContent = "Start tracking";
    status.textContent = "Tracking stopped. Your steps are saved.";
    refresh();
  }

  startBtn.addEventListener("click", start);

  resetBtn.addEventListener("click", () => {
    if (!confirm("Reset today's step count?")) return;
    steps = 0;
    refresh();
    status.textContent = "Today's steps have been reset.";
  });

  // Stop listening when the page is closed or navigated away from.
  window.addEventListener("pagehide", stop);

  refresh();
})();
