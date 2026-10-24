
"use strict";

const STORAGE_KEY = "strideFitnessData_v1";

const DEFAULT_GOALS = {
  steps: 8000,
  calories: 500,
  minutes: 30
};

const $ = id => document.getElementById(id);

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const offsetDate = offset => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatNumber = n => Math.round(Number(n) || 0).toLocaleString("en-US");

const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;",
  '"': "&quot;", "'": "&#39;"
})[char]);

const workoutIcons = {
  "Walking": ["🚶", ""],
  "Running": ["🏃", "orange"],
  "Cycling": ["🚴", "blue"],
  "Strength training": ["🏋️", "purple"],
  "Yoga": ["🧘", "purple"],
  "Swimming": ["🏊", "blue"],
  "HIIT": ["⚡", "orange"],
  "Other": ["✨", ""]
};

let state = loadState();
let weeklyChart = null;
let toastTimer;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return {
        goals: { ...DEFAULT_GOALS },
        activities: []
      };
    }

    const parsed = JSON.parse(saved);

    return {
      goals: { ...DEFAULT_GOALS, ...(parsed.goals || {}) },
      activities: Array.isArray(parsed.activities)
        ? parsed.activities.filter(a => a && a.id && a.date)
        : []
    };
  } catch (error) {
    console.error("Could not load fitness data:", error);

    return {
      goals: { ...DEFAULT_GOALS },
      activities: []
    };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Could not save fitness data:", error);
    showToast("Unable to save. Check your browser storage.");
  }
}

function totalsFor(date) {
  return state.activities
    .filter(a => a.date === date)
    .reduce((totals, activity) => {
      totals.steps += Number(activity.steps) || 0;
      totals.calories += Number(activity.calories) || 0;
      totals.minutes += Number(activity.duration) || 0;
      return totals;
    }, { steps: 0, calories: 0, minutes: 0 });
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = offsetDate(index - 6);

    return {
      date,
      label: new Date(date + "T12:00:00")
        .toLocaleDateString("en-US", { weekday: "short" }),
      ...totalsFor(date)
    };
  });
}

function prettyDate(date) {
  if (date === todayISO()) return "Today";
  if (date === offsetDate(-1)) return "Yesterday";

  return new Date(date + "T12:00:00")
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.slice(0, 4) !== todayISO().slice(0, 4)
        ? "numeric"
        : undefined
    });
}

function activityIcon(type) {
  const [icon, color] = workoutIcons[type] || ["✦", ""];

  return `<div class="activity-icon ${color}">${icon}</div>`;
}

function activityHTML(activity) {
  const note = activity.notes
    ? ` · ${escapeHTML(activity.notes)}`
    : "";

  return `
    <article class="activity-row">
      ${activityIcon(activity.type)}

      <div class="activity-copy">
        <strong>${escapeHTML(activity.type)}</strong>
        <small>${prettyDate(activity.date)}${note}</small>
      </div>

      <div class="activity-metrics">
        <div class="metric">
          <strong>${formatNumber(activity.duration)} min</strong>
          <small>Duration</small>
        </div>

        <div class="metric">
          <strong>${formatNumber(activity.calories)}</strong>
          <small>Kcal</small>
        </div>

        ${Number(activity.steps) > 0 ? `
          <div class="metric">
            <strong>${formatNumber(activity.steps)}</strong>
            <small>Steps</small>
          </div>
        ` : ""}
      </div>

      <button
        class="delete-btn"
        data-delete="${escapeHTML(activity.id)}"
        aria-label="Delete ${escapeHTML(activity.type)} activity"
        title="Delete activity"
      >✕</button>
    </article>
  `;
}

function setProgress(id, value, target) {
  const percent = Math.min(
    100,
    Math.round(value / Math.max(1, target) * 100)
  );

  $(id).style.width = percent + "%";
  return percent;
}

function renderDashboard() {
  const today = totalsFor(todayISO());
  const goals = state.goals;

  $("stepsValue").textContent = formatNumber(today.steps);
  $("caloriesValue").textContent = formatNumber(today.calories);
  $("minutesValue").textContent = formatNumber(today.minutes);

  const stepPercent = setProgress("stepsBar", today.steps, goals.steps);
  const caloriePercent = setProgress(
    "caloriesBar", today.calories, goals.calories
  );
  const minutePercent = setProgress(
    "minutesBar", today.minutes, goals.minutes
  );

  $("stepsPct").textContent = stepPercent + "%";
  $("caloriesPct").textContent = caloriePercent + "%";
  $("minutesPct").textContent = minutePercent + "%";

  $("stepsTarget").textContent = formatNumber(goals.steps) + " goal";
  $("caloriesTarget").textContent =
    formatNumber(goals.calories) + " kcal goal";
  $("minutesTarget").textContent =
    formatNumber(goals.minutes) + " min goal";

  $("goalSteps").textContent =
    `${formatNumber(today.steps)} / ${formatNumber(goals.steps)} steps`;

  $("goalCalories").textContent =
    `${formatNumber(today.calories)} / ${formatNumber(goals.calories)} kcal`;

  $("goalMinutes").textContent =
    `${formatNumber(today.minutes)} / ${formatNumber(goals.minutes)} min`;

  const checks = [
    ["goalStepsCheck", stepPercent],
    ["goalCaloriesCheck", caloriePercent],
    ["goalMinutesCheck", minutePercent]
  ];

  checks.forEach(([id, percent]) => {
    $(id).textContent = percent >= 100 ? "✓" : "○";
    $(id).style.color = percent >= 100 ? "#53b779" : "#c8d0d8";
  });

  const overall = Math.round(
    (stepPercent + caloriePercent + minutePercent) / 3
  );

  $("goalRing").style.setProperty("--ring", (overall * 3.6) + "deg");
  $("goalPercent").textContent = overall + "%";

  if (overall === 100) {
    $("goalHeadline").textContent = "You did it. Amazing!";
    $("goalDescription").textContent =
      "All your daily targets are complete. Celebrate your win!";
  } else if (overall >= 65) {
    $("goalHeadline").textContent = "You're on a roll!";
    $("goalDescription").textContent =
      "You're close to your targets. Keep moving!";
  } else if (overall >= 30) {
    $("goalHeadline").textContent = "Look at you go!";
    $("goalDescription").textContent =
      "Your progress is adding up. Keep going!";
  } else {
    $("goalHeadline").textContent = "Every step counts";
    $("goalDescription").textContent =
      "Log your movement to see your progress.";
  }

  const activeDates = new Set(
    state.activities
      .filter(a => a.date <= todayISO())
      .map(a => a.date)
  );

  let streak = 0;

  for (let i = 0; i < 365; i++) {
    if (activeDates.has(offsetDate(-i))) {
      streak++;
    } else {
      break;
    }
  }

  $("streak").textContent =
    `${streak} day${streak === 1 ? "" : "s"} active`;

  $("sideProgress").style.width = overall + "%";
  $("sideProgressText").textContent =
    overall + "% of daily goals complete";

  const recent = [...state.activities]
    .sort((a, b) =>
      b.date.localeCompare(a.date) ||
      (b.createdAt || 0) - (a.createdAt || 0)
    )
    .slice(0, 4);

  $("recentList").innerHTML = recent.map(activityHTML).join("");
  $("recentList").classList.toggle("hidden", recent.length === 0);
  $("recentEmpty").classList.toggle("hidden", recent.length !== 0);

  renderChart();
}

function renderChart() {
  const days = lastSevenDays();

  $("weeklyAverage").textContent =
    formatNumber(days.reduce((sum, day) => sum + day.steps, 0) / 7)
    + " steps";

  if (!window.Chart) return;

  if (weeklyChart) weeklyChart.destroy();

  weeklyChart = new Chart($("weeklyChart"), {
    type: "bar",

    data: {
      labels: days.map(day => day.label),

      datasets: [
        {
          label: "Steps",
          data: days.map(day => day.steps),
          backgroundColor: "#91ddb0",
          hoverBackgroundColor: "#68c98e",
          borderRadius: 5,
          borderSkipped: false,
          yAxisID: "y"
        },
        {
          label: "Calories",
          data: days.map(day => day.calories),
          backgroundColor: "#ffca9f",
          hoverBackgroundColor: "#ffb77d",
          borderRadius: 5,
          borderSkipped: false,
          yAxisID: "y1"
        }
      ]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "index",
        intersect: false
      },

      plugins: {
        legend: { display: false },

        tooltip: {
          backgroundColor: "#17273b",
          padding: 11,
          cornerRadius: 8,

          callbacks: {
            label(context) {
              const unit = context.dataset.label === "Steps"
                ? " steps"
                : " kcal";

              return context.dataset.label + ": " +
                formatNumber(context.raw) + unit;
            }
          }
        }
      },

      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: "#9ba4b1",
            font: { size: 10 },
            padding: 9
          }
        },

        y: {
          beginAtZero: true,
          grid: { color: "#eff2f5", drawTicks: false },
          border: { display: false },

          ticks: {
            color: "#a0a8b4",
            maxTicksLimit: 5,
            callback(value) {
              return value >= 1000
                ? (value / 1000) + "k"
                : value;
            }
          }
        },

        y1: {
          beginAtZero: true,
          position: "right",
          grid: { display: false },
          border: { display: false },
          ticks: { display: false }
        }
      }
    }
  });
}

function renderActivityPage() {
  const activities = [...state.activities].sort((a, b) =>
    b.date.localeCompare(a.date) ||
    (b.createdAt || 0) - (a.createdAt || 0)
  );

  $("totalActivities").textContent = formatNumber(activities.length);

  $("totalCalories").textContent =
    formatNumber(activities.reduce((sum, a) =>
      sum + (Number(a.calories) || 0), 0
    )) + " kcal";

  $("totalMinutes").textContent =
    formatNumber(activities.reduce((sum, a) =>
      sum + (Number(a.duration) || 0), 0
    )) + " min";

  const filter = $("activityFilter").value;

  const filtered = activities.filter(activity => {
    if (filter === "today") {
      return activity.date === todayISO();
    }

    if (filter === "week") {
      return activity.date >= offsetDate(-6) &&
        activity.date <= todayISO();
    }

    return true;
  });

  $("allActivityList").innerHTML =
    filtered.map(activityHTML).join("");

  $("allActivityList").classList.toggle(
    "hidden", filtered.length === 0
  );

  $("activityEmpty").classList.toggle(
    "hidden", filtered.length !== 0
  );
}

function renderGoals() {
  $("stepsGoalInput").value = state.goals.steps;
  $("caloriesGoalInput").value = state.goals.calories;
  $("minutesGoalInput").value = state.goals.minutes;
}

function renderAll() {
  renderDashboard();
  renderActivityPage();
  renderGoals();
}

function showToast(message) {
  const toast = $("toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function switchView(name) {
  const titles = {
    dashboard: "Dashboard",
    activity: "Activity log",
    goals: "My goals"
  };

  document.querySelectorAll(".view").forEach(view => {
    view.classList.remove("active");
  });

  $(name + "View").classList.add("active");
  $("pageName").textContent = titles[name];

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.view === name);
  });

  $("sidebar").classList.remove("open");

  if (name === "activity") renderActivityPage();
  if (name === "goals") renderGoals();
  if (name === "dashboard") renderDashboard();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openModal() {
  $("activityForm").reset();

  $("activityDate").value = todayISO();
  $("activityDate").max = todayISO();
  $("activityDuration").value = 30;
  $("activityCalories").value = 150;
  $("activitySteps").value = 0;
  $("formError").textContent = "";

  $("activityModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";

  setTimeout(() => $("activityType").focus(), 50);
}

function closeModal() {
  $("activityModal").classList.add("hidden");
  document.body.style.overflow = "";
}

// Navigation
document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => {
    switchView(button.dataset.view);
  });
});

// Open activity form
["addBtn", "activityAdd", "firstActivity"].forEach(id => {
  $(id).addEventListener("click", openModal);
});

$("closeModal").addEventListener("click", closeModal);
$("cancelModal").addEventListener("click", closeModal);

$("activityModal").addEventListener("click", event => {
  if (event.target === $("activityModal")) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" &&
      !$("activityModal").classList.contains("hidden")) {
    closeModal();
  }
});

// Other navigation shortcuts
$("editGoals").addEventListener("click", () => switchView("goals"));
$("viewAll").addEventListener("click", () => switchView("activity"));
$("activityFilter").addEventListener("change", renderActivityPage);

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

// Suggested default workout values
const workoutDefaults = {
  "Walking": [30, 120, 3500],
  "Running": [30, 300, 4000],
  "Cycling": [40, 280, 0],
  "Strength training": [45, 220, 0],
  "Yoga": [30, 100, 0],
  "Swimming": [30, 250, 0],
  "HIIT": [25, 280, 0],
  "Other": [30, 150, 0]
};

$("activityType").addEventListener("change", () => {
  const values =
    workoutDefaults[$("activityType").value] ||
    workoutDefaults.Other;

  $("activityDuration").value = values[0];
  $("activityCalories").value = values[1];
  $("activitySteps").value = values[2];
});

// Save new activity
$("activityForm").addEventListener("submit", event => {
  event.preventDefault();

  const date = $("activityDate").value;
  const duration = Number($("activityDuration").value);
  const calories = Number($("activityCalories").value);
  const steps = Number($("activitySteps").value || 0);

  if (!date || date > todayISO()) {
    $("formError").textContent =
      "Please choose today or an earlier date.";
    return;
  }

  if ([duration, calories, steps].some(value =>
    !Number.isFinite(value) || value < 0
  )) {
    $("formError").textContent =
      "Please enter valid, non-negative numbers.";
    return;
  }

  const id = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : Date.now() + "-" + Math.random().toString(16).slice(2);

  state.activities.push({
    id,
    type: $("activityType").value,
    date,
    duration,
    calories,
    steps,
    notes: $("activityNotes").value.trim(),
    createdAt: Date.now()
  });

  saveState();
  renderAll();
  closeModal();

  showToast("Activity saved. Nice work! ✦");
});

// Delete an activity
document.addEventListener("click", event => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  const id = button.dataset.delete;
  const activity = state.activities.find(a => a.id === id);

  if (!activity) return;

  if (!confirm(`Delete this ${activity.type.toLowerCase()} activity?`)) {
    return;
  }

  state.activities = state.activities.filter(a => a.id !== id);

  saveState();
  renderAll();
  showToast("Activity deleted.");
});

// Save daily goals
$("goalsForm").addEventListener("submit", event => {
  event.preventDefault();

  const goals = {
    steps: Number($("stepsGoalInput").value),
    calories: Number($("caloriesGoalInput").value),
    minutes: Number($("minutesGoalInput").value)
  };

  if (Object.values(goals).some(value =>
    !Number.isFinite(value) || value <= 0
  )) {
    $("goalsFeedback").textContent =
      "Please enter goals greater than zero.";
    return;
  }

  state.goals = goals;

  saveState();
  renderAll();

  $("goalsFeedback").textContent =
    "Goals saved successfully — keep going!";

  showToast("Your goals have been updated.");
});

// Reset all locally saved data
document.querySelector(".profile").addEventListener("click", () => {
  if (!confirm(
    "Reset all fitness activities and goals saved in this browser?"
  )) {
    return;
  }

  state = {
    goals: { ...DEFAULT_GOALS },
    activities: []
  };

  saveState();
  renderAll();
  showToast("Your fitness data has been reset.");
});

// Initialize application
$("todayLabel").textContent =
  new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

$("activityDate").max = todayISO();

renderAll();

// Chart.js loads from a CDN. Retry rendering when the page finishes loading.
if (!window.Chart) {
  window.addEventListener("load", renderChart, { once: true });
}
