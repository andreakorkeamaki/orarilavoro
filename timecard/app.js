const STORAGE_KEY = "lessa-timecard-v1";
const DEFAULT_VIEW = "home";

const defaultState = {
  settings: {
    workerName: "Lessa",
    hourlyRate: 10,
    currency: "EUR",
  },
  activeShift: null,
  shifts: [],
};

const elements = {
  workStatus: document.querySelector("#workStatus"),
  topWorkStatus: document.querySelector("#topWorkStatus"),
  todayLabel: document.querySelector("#todayLabel"),
  activeTitle: document.querySelector("#activeTitle"),
  liveClock: document.querySelector("#liveClock"),
  shiftNote: document.querySelector("#shiftNote"),
  clockInButton: document.querySelector("#clockInButton"),
  clockOutButton: document.querySelector("#clockOutButton"),
  activeHint: document.querySelector("#activeHint"),
  previousMonth: document.querySelector("#previousMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  monthLabel: document.querySelector("#monthLabel"),
  monthHours: document.querySelector("#monthHours"),
  monthPay: document.querySelector("#monthPay"),
  monthShifts: document.querySelector("#monthShifts"),
  averageShift: document.querySelector("#averageShift"),
  exportCsv: document.querySelector("#exportCsv"),
  shiftList: document.querySelector("#shiftList"),
  settingsForm: document.querySelector("#settingsForm"),
  workerName: document.querySelector("#workerName"),
  hourlyRate: document.querySelector("#hourlyRate"),
  currency: document.querySelector("#currency"),
  manualForm: document.querySelector("#manualForm"),
  manualDate: document.querySelector("#manualDate"),
  manualStart: document.querySelector("#manualStart"),
  manualEnd: document.querySelector("#manualEnd"),
  manualNote: document.querySelector("#manualNote"),
  exportBackup: document.querySelector("#exportBackup"),
  importBackup: document.querySelector("#importBackup"),
  backupFile: document.querySelector("#backupFile"),
  storageHint: document.querySelector("#storageHint"),
  shiftTemplate: document.querySelector("#shiftTemplate"),
  views: document.querySelectorAll("[data-view]"),
  viewLinks: document.querySelectorAll("[data-view-link]"),
};

let state = loadState();
let selectedMonth = startOfMonth(new Date());
let storagePersistRequested = false;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      ...defaultState,
      ...saved,
      settings: {
        ...defaultState.settings,
        ...(saved?.settings || {}),
      },
      shifts: Array.isArray(saved?.shifts) ? saved.shifts : [],
      activeShift: saved?.activeShift || null,
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `shift-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function getShiftMonthKey(shift) {
  return getMonthKey(new Date(shift.start));
}

function formatDate(date) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDuration(milliseconds) {
  const totalMinutes = Math.max(0, Math.round(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${pad(minutes)}m`;
}

function formatTimer(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: state.settings.currency,
  }).format(amount);
}

function shiftDuration(shift) {
  return new Date(shift.end).getTime() - new Date(shift.start).getTime();
}

function shiftPay(shift) {
  return (shiftDuration(shift) / 3600000) * Number(state.settings.hourlyRate || 0);
}

function monthShifts() {
  const key = getMonthKey(selectedMonth);
  return state.shifts
    .filter((shift) => getShiftMonthKey(shift) === key)
    .sort((a, b) => new Date(b.start) - new Date(a.start));
}

function renderActiveShift() {
  const active = state.activeShift;

  if (!active) {
    elements.workStatus.textContent = "Fuori servizio";
    elements.topWorkStatus.textContent = "Fuori servizio";
    elements.workStatus.classList.remove("active");
    elements.topWorkStatus.classList.remove("active");
    elements.activeTitle.textContent = "Pronta a iniziare";
    elements.liveClock.textContent = "00:00:00";
    elements.clockInButton.disabled = false;
    elements.clockOutButton.disabled = true;
    elements.activeHint.textContent = "La timbrata resta salvata anche se chiudi la pagina.";
    return;
  }

  const startedAt = new Date(active.start);
  const elapsed = Date.now() - startedAt.getTime();
  elements.workStatus.textContent = "Al lavoro";
  elements.topWorkStatus.textContent = "Al lavoro";
  elements.workStatus.classList.add("active");
  elements.topWorkStatus.classList.add("active");
  elements.activeTitle.textContent = `Iniziato alle ${formatTime(startedAt)}`;
  elements.liveClock.textContent = formatTimer(elapsed);
  elements.clockInButton.disabled = true;
  elements.clockOutButton.disabled = false;
  elements.shiftNote.value = active.note || "";
  elements.activeHint.textContent = `${formatDate(startedAt)} - turno in corso`;
}

function renderSettings() {
  elements.workerName.value = state.settings.workerName;
  elements.hourlyRate.value = state.settings.hourlyRate;
  elements.currency.value = state.settings.currency;
}

function renderMonth() {
  const shifts = monthShifts();
  const totalMilliseconds = shifts.reduce((sum, shift) => sum + shiftDuration(shift), 0);
  const totalPay = shifts.reduce((sum, shift) => sum + shiftPay(shift), 0);

  elements.monthLabel.textContent = formatMonth(selectedMonth);
  elements.monthHours.textContent = formatDuration(totalMilliseconds);
  elements.monthPay.textContent = formatMoney(totalPay);
  elements.monthShifts.textContent = String(shifts.length);
  elements.averageShift.textContent = shifts.length
    ? formatDuration(totalMilliseconds / shifts.length)
    : "0h 00m";

  renderShiftList(shifts);
}

function renderShiftList(shifts) {
  elements.shiftList.replaceChildren();

  if (!shifts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nessun turno registrato per questo mese.";
    elements.shiftList.append(empty);
    return;
  }

  for (const shift of shifts) {
    const node = elements.shiftTemplate.content.firstElementChild.cloneNode(true);
    const start = new Date(shift.start);
    const end = new Date(shift.end);

    node.querySelector(".shift-date").textContent = formatDate(start);
    node.querySelector(".shift-meta").textContent =
      `${formatTime(start)} - ${formatTime(end)} | ${formatDuration(shiftDuration(shift))}`;
    node.querySelector(".shift-note").textContent = shift.note || "";
    node.querySelector(".shift-pay").textContent = formatMoney(shiftPay(shift));
    node.querySelector(".delete-shift").addEventListener("click", () => deleteShift(shift.id));
    elements.shiftList.append(node);
  }
}

function render() {
  elements.todayLabel.textContent = formatDate(new Date());
  renderActiveShift();
  renderSettings();
  renderMonth();
  updateStorageHint();
}

function currentViewFromHash() {
  const view = window.location.hash.replace("#", "");
  return view === "settings" ? "settings" : DEFAULT_VIEW;
}

function setView(viewName) {
  const normalizedView = viewName === "settings" ? "settings" : DEFAULT_VIEW;

  for (const view of elements.views) {
    view.classList.toggle("active", view.dataset.view === normalizedView);
  }

  for (const link of elements.viewLinks) {
    const isActive = link.dataset.viewLink === normalizedView;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

function clockIn() {
  const now = new Date();
  state.activeShift = {
    id: createId(),
    start: now.toISOString(),
    note: elements.shiftNote.value.trim(),
  };
  saveState();
  requestPersistentStorage();
  render();
}

function clockOut() {
  if (!state.activeShift) {
    return;
  }

  const end = new Date();
  const shift = {
    ...state.activeShift,
    note: elements.shiftNote.value.trim(),
    end: end.toISOString(),
  };

  if (shiftDuration(shift) < 60000) {
    elements.activeHint.textContent = "Il turno deve durare almeno un minuto.";
    return;
  }

  state.shifts.push(shift);
  state.activeShift = null;
  elements.shiftNote.value = "";
  selectedMonth = startOfMonth(new Date(shift.start));
  saveState();
  requestPersistentStorage();
  render();
}

function addManualShift(event) {
  event.preventDefault();

  const start = new Date(`${elements.manualDate.value}T${elements.manualStart.value}`);
  let end = new Date(`${elements.manualDate.value}T${elements.manualEnd.value}`);
  if (end <= start) {
    end = new Date(end.getTime() + 24 * 3600000);
  }

  state.shifts.push({
    id: createId(),
    start: start.toISOString(),
    end: end.toISOString(),
    note: elements.manualNote.value.trim(),
  });

  selectedMonth = startOfMonth(start);
  event.target.reset();
  elements.manualDate.value = toDateInputValue(new Date());
  saveState();
  requestPersistentStorage();
  render();
}

function deleteShift(id) {
  const shift = state.shifts.find((item) => item.id === id);
  if (!shift) {
    return;
  }

  const label = `${formatDate(new Date(shift.start))} ${formatTime(new Date(shift.start))}`;
  if (!confirm(`Eliminare il turno del ${label}?`)) {
    return;
  }

  state.shifts = state.shifts.filter((item) => item.id !== id);
  saveState();
  requestPersistentStorage();
  render();
}

function saveSettings(event) {
  event.preventDefault();
  state.settings = {
    workerName: elements.workerName.value.trim() || "Lessa",
    hourlyRate: Math.max(0, Number(elements.hourlyRate.value || 0)),
    currency: elements.currency.value,
  };
  saveState();
  requestPersistentStorage();
  render();
}

function changeMonth(direction) {
  selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + direction, 1);
  renderMonth();
}

function escapeCsv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv() {
  const shifts = monthShifts().slice().reverse();
  if (!shifts.length) {
    alert("Non ci sono turni da esportare per questo mese.");
    return;
  }

  const rows = [
    ["Data", "Inizio", "Fine", "Ore", "Nota", "Paga stimata"],
    ...shifts.map((shift) => {
      const start = new Date(shift.start);
      const end = new Date(shift.end);
      const hours = (shiftDuration(shift) / 3600000).toFixed(2);
      return [
        toDateInputValue(start),
        formatTime(start),
        formatTime(end),
        hours,
        shift.note || "",
        shiftPay(shift).toFixed(2),
      ];
    }),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `conta-palle-${getMonthKey(selectedMonth)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportBackup() {
  const backup = {
    app: "conta-palle",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `conta-palle-backup-${toDateInputValue(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importBackupFile(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const importedState = parsed.data || parsed;
      if (!Array.isArray(importedState.shifts)) {
        throw new Error("Invalid backup");
      }

      if (!confirm("Ripristinare questo backup e sostituire i dati attuali?")) {
        return;
      }

      state = {
        ...defaultState,
        ...importedState,
        settings: {
          ...defaultState.settings,
          ...(importedState.settings || {}),
        },
        activeShift: importedState.activeShift || null,
        shifts: importedState.shifts,
      };
      selectedMonth = startOfMonth(new Date());
      saveState();
      requestPersistentStorage();
      render();
    } catch {
      alert("Backup non valido.");
    } finally {
      elements.backupFile.value = "";
    }
  });
  reader.readAsText(file);
}

async function requestPersistentStorage() {
  if (storagePersistRequested || !navigator.storage?.persist) {
    return;
  }

  storagePersistRequested = true;
  try {
    await navigator.storage.persist();
    updateStorageHint();
  } catch {
    updateStorageHint();
  }
}

async function updateStorageHint() {
  if (!elements.storageHint) {
    return;
  }

  if (!navigator.storage?.persisted) {
    elements.storageHint.textContent = "Dati salvati su questo dispositivo.";
    return;
  }

  try {
    const persisted = await navigator.storage.persisted();
    elements.storageHint.textContent = persisted
      ? "Archivio protetto su questo dispositivo."
      : "Dati salvati su questo dispositivo.";
  } catch {
    elements.storageHint.textContent = "Dati salvati su questo dispositivo.";
  }
}

elements.clockInButton.addEventListener("click", clockIn);
elements.clockOutButton.addEventListener("click", clockOut);
elements.previousMonth.addEventListener("click", () => changeMonth(-1));
elements.nextMonth.addEventListener("click", () => changeMonth(1));
elements.exportCsv.addEventListener("click", exportCsv);
elements.exportBackup.addEventListener("click", exportBackup);
elements.importBackup.addEventListener("click", () => elements.backupFile.click());
elements.backupFile.addEventListener("change", () => {
  const [file] = elements.backupFile.files;
  if (file) {
    importBackupFile(file);
  }
});
window.addEventListener("hashchange", () => setView(currentViewFromHash()));
elements.settingsForm.addEventListener("submit", saveSettings);
elements.manualForm.addEventListener("submit", addManualShift);
elements.shiftNote.addEventListener("input", () => {
  if (!state.activeShift) {
    return;
  }
  state.activeShift.note = elements.shiftNote.value.trim();
  saveState();
  requestPersistentStorage();
});

elements.manualDate.value = toDateInputValue(new Date());
setView(currentViewFromHash());
render();
setInterval(renderActiveShift, 1000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        registration.update();
      })
      .catch(() => {
        // The app still works without offline support, for example from file://.
      });
  });
}
