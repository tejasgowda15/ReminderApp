if ("Notification" in window && Notification.permission !== "granted") {
  Notification.requestPermission();
}

const reminderForm = document.getElementById("reminderForm");
const reminderList = document.getElementById("reminderList");
let reminders = JSON.parse(localStorage.getItem("reminders")) || [];
let editIndex = null;

function getTimeTag(date) {
  const today = new Date();
  const dateOnly = new Date(date.toDateString());
  const todayOnly = new Date(today.toDateString());
  const diff = dateOnly - todayOnly;

  if (diff === 0) return "📌 Today";
  if (diff === 86400000) return "📅 Tomorrow";
  return "🔜 Upcoming";
}

function renderReminders() {
  reminderList.innerHTML = "";

  if (reminders.length === 0) {
    reminderList.innerHTML = "<li style='text-align:center;color:#999'>No reminders yet 💤</li>";
    return;
  }

  reminders.sort((a, b) => new Date(a.time) - new Date(b.time));

  reminders.forEach((reminder, index) => {
    const li = document.createElement("li");
    const date = new Date(reminder.time);
    const timeLeft = date - new Date();

    let urgencyClass = "";
    if (timeLeft < 3600000 && timeLeft > 0) urgencyClass = "urgent"; // Less than 1 hour, but still in the future
    else if (timeLeft < 86400000 && timeLeft > 0) urgencyClass = "soon"; // Less than 1 day, but still in the future
    else if (timeLeft <= 0 && !reminder.done) urgencyClass = "past-due"; // Added for past due reminders

    const doneClass = reminder.done ? "done" : "";

    li.className = `reminder-card ${urgencyClass} ${doneClass}`;
    li.innerHTML = `
      <div class="reminder-header">
        <strong>${reminder.title}</strong>
        <div class="options-menu">
          <span class="options-toggle">⋮</span>
          <ul class="options-dropdown">
            <li class="mark-done" data-index="${index}">${reminder.done ? "✅ Mark as Undone" : "✅ Mark as Done"}</li>
            <li class="edit-option" data-index="${index}">✏️ Edit</li>
            <li class="delete-option" data-index="${index}">🗑️ Delete</li>
          </ul>
        </div>
      </div>
      <div class="reminder-meta">
        <span>📅 ${date.toLocaleDateString()}</span>
        <span>⏰ ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="reminder-note">${getTimeTag(date)} • Remind ${reminder.leadTime} mins before</div>
    `;
    reminderList.appendChild(li);
  });

// Toggle dropdown
document.querySelectorAll(".options-toggle").forEach(toggle => {
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllDropdowns();

    // Add 'options-open' class to parent card
    const reminderCard = toggle.closest(".reminder-card");
    reminderCard.classList.add("options-open");

    // Show dropdown
    toggle.nextElementSibling.classList.add("show");
  });
});


  // Delete
  document.querySelectorAll(".delete-option").forEach(item => {
    item.addEventListener("click", (e) => {
      const index = e.target.getAttribute("data-index");
      if (confirm("Are you sure you want to delete this reminder?")) {
        reminders.splice(index, 1);
        localStorage.setItem("reminders", JSON.stringify(reminders));
        renderReminders();
        showToast("Reminder deleted!");
      }
    });
  });

  // Edit
  document.querySelectorAll(".edit-option").forEach(item => {
    item.addEventListener("click", (e) => {
      const index = e.target.getAttribute("data-index");
      const r = reminders[index];
      document.getElementById("title").value = r.title;
      document.getElementById("dateTime").value = r.time;
      document.getElementById("leadTime").value = r.leadTime;
      document.getElementById("reminderModal").classList.add("show");
      editIndex = index;
    });
  });

  // Mark as done
  document.querySelectorAll(".mark-done").forEach(item => {
    item.addEventListener("click", (e) => {
      const index = e.target.getAttribute("data-index");
      reminders[index].done = !reminders[index].done;
      localStorage.setItem("reminders", JSON.stringify(reminders));
      renderReminders();
      showToast(reminders[index].done ? "Reminder marked as done!" : "Reminder marked as undone!");
    });
  });

  window.addEventListener("click", closeAllDropdowns);
}

function closeAllDropdowns() {
  document.querySelectorAll(".options-dropdown").forEach(drop => {
    drop.classList.remove("show");
  });
  document.querySelectorAll(".reminder-card").forEach(card => {
    card.classList.remove("options-open");
  });
}


function scheduleNotification(reminder) {
  const now = new Date().getTime();
  const reminderTime = new Date(reminder.time).getTime();
  const leadMillis = reminder.leadTime * 60 * 1000;
  const notifyAt = reminderTime - leadMillis;
  const delay = notifyAt - now;

  if (delay > 0) {
    setTimeout(() => {
      const currentReminders = JSON.parse(localStorage.getItem("reminders")) || [];
      const stillActive = currentReminders.find(r =>
        r.title === reminder.title &&
        r.time === reminder.time &&
        !r.done
      );

      if (stillActive) {
        // 🔊 Play sound
        const audio = document.getElementById("reminderSound");
        if (audio) audio.play();

        // 🔔 Browser notification without icon
        if (Notification.permission === "granted") {
          new Notification("🔔 Smart Reminder", {
            body: `⏰ ${reminder.title} is due in ${reminder.leadTime} min${reminder.leadTime > 1 ? 's' : ''}`
          });
        } else {
          showToast(`Reminder: ${reminder.title} is due soon!`);
        }
      }
    }, delay);
  }
}




reminderForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const title = document.getElementById("title").value;
  const dateTime = document.getElementById("dateTime").value;
  const leadTime = parseInt(document.getElementById("leadTime").value);

  const newReminder = { title, time: dateTime, leadTime, done: false };

  if (editIndex !== null) {
    // Keep existing 'done' status if editing an existing reminder
    newReminder.done = reminders[editIndex].done;
    reminders[editIndex] = newReminder;
    editIndex = null;
    showToast("Reminder updated!");
  } else {
    reminders.push(newReminder);
    scheduleNotification(newReminder);
    showToast("Reminder added!");
  }

  localStorage.setItem("reminders", JSON.stringify(reminders));
  renderReminders();
  reminderForm.reset();
  document.getElementById("reminderModal").classList.remove("show");
  generateCalendar(); // Re-render calendar after adding/editing reminder
});

document.getElementById("openModal").addEventListener("click", () => {
  editIndex = null;
  reminderForm.reset();
  document.getElementById("reminderModal").classList.add("show");
});

document.getElementById("closeModal").addEventListener("click", () => {
  document.getElementById("reminderModal").classList.remove("show");
});

document.getElementById("hamburger").addEventListener("click", () => {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("open");
  document.body.classList.toggle("sidebar-active");
});

window.addEventListener("click", (e) => {
  const sidebar = document.getElementById("sidebar");
  const hamburger = document.getElementById("hamburger");
  const modal = document.getElementById("reminderModal");

  // Close modal if clicked outside
  if (e.target === modal) document.getElementById("reminderModal").classList.remove("show");

  // Close sidebar if clicked outside and it's open
  if (
    document.body.classList.contains("sidebar-active") &&
    !sidebar.contains(e.target) &&
    !hamburger.contains(e.target)
  ) {
    sidebar.classList.remove("open");
    document.body.classList.remove("sidebar-active");
  }
});

const clearBtn = document.getElementById("clearAllBtn");
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete all reminders? This cannot be undone.")) {
      reminders = [];
      localStorage.removeItem("reminders");
      renderReminders();
      generateCalendar(); // Re-render calendar after clearing all
      showToast("All reminders cleared!");
    }
  });
}

// Schedule notifications for existing reminders on load
reminders.forEach(scheduleNotification);
renderReminders();


function generateCalendar() {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Get the day of the week for the first day of the month (0 for Sunday, 1 for Monday, etc.)
  const firstDay = new Date(year, month, 1).getDay();
  // Get the total number of days in the current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const todayDate = now.getDate(); // Get current day of the month
  const reminderMap = {}; // To store count of reminders per day

  reminders.forEach(r => {
    const d = new Date(r.time);
    // Only map reminders for the current year and month
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate(); // The day of the month
      reminderMap[key] = (reminderMap[key] || 0) + 1;
    }
  });

  // Create empty cells for days before the 1st of the month
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    calendar.appendChild(empty);
  }

  // Create cells for each day of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day";

    // Add 'today' class if it's the current day
    if (d === todayDate) cell.classList.add("today");

    // Add 'has-reminder' class and a badge if there are reminders for this day
    if (reminderMap[d]) {
      cell.classList.add("has-reminder");
      const badge = document.createElement("span");
      badge.className = "event-count";
      badge.innerText = reminderMap[d]; // Show count of events
      cell.appendChild(badge);
    }

    cell.innerHTML += d; // Add the day number to the cell
    cell.addEventListener("click", () => showDayReminders(d));
    calendar.appendChild(cell);
  }
}


function showDayReminders(day) {
  const dayReminders = document.getElementById("dayReminders");
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  dayReminders.innerHTML = `<strong>Reminders for ${day}/${month + 1}/${year}:</strong>`;

  const list = reminders.filter(r => {
    const d = new Date(r.time);
    return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
  });

  if (list.length === 0) {
    dayReminders.innerHTML += "<li>No reminders for this day.</li>";
    return;
  }

  list.sort((a, b) => new Date(a.time) - new Date(b.time)); // Sort by time

  list.forEach(r => {
    const li = document.createElement("li");
    const date = new Date(r.time);
    const doneText = r.done ? " (Done)" : "";
    li.innerText = `${r.title} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${doneText}`;
    dayReminders.appendChild(li);
  });
}

generateCalendar(); // Initial call to generate the calendar

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').then(() => { // Corrected to service-worker.js
    console.log('✅ Service Worker Registered');
  }).catch(err => {
    console.warn('Service Worker Failed:', err);
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

const darkToggle = document.getElementById("toggleDarkMode");
darkToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
});

// Auto-enable if last saved
if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark");
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').then(reg => {
    console.log("✅ Service Worker Registered");
  });

  // 👇 Listen for update messages from service worker
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "NEW_VERSION_AVAILABLE") {
      showUpdateToast();
    }
  });
}

// 🔔 Show reload toast when new version is available
function showUpdateToast() {
  const toast = document.getElementById("toast");
  toast.innerText = "🚀 New version available. Click to reload.";
  toast.classList.add("show");
  toast.style.cursor = "pointer";

  toast.addEventListener("click", () => {
    window.location.reload();
  });

  setTimeout(() => {
    toast.classList.remove("show");
    toast.style.cursor = "default";
  }, 10000);
}

function closeNotificationModal() {
  const modal = document.getElementById("notificationModal");
  if (modal) modal.classList.remove("show");
}
