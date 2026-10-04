// FPTU Scheduler - Main Module
// Converted from vanilla JS to TypeScript

import { SLOT_TIMES, getSemesterOptions, getSemesterInfo, getDefaultSemester, isWeekInSemester } from './constants';
import { storage } from './storage';
import { formatTime, formatDate, generateICS } from './utils';
import { 
  extractExamSchedule, 
  extractWeeklySchedule, 
  getWeekOptions, 
  selectWeek 
} from './extraction';
import { createPanelHTML, addPanelStyles, showToggleButton } from './ui';
import { ScheduleEvent, SemesterSyncState } from './types';

// ============ PAGE DETECTION ============
const isExamPage = () => window.location.href.includes("Exam/ScheduleExams.aspx");
const isWeeklyPage = () => window.location.href.includes("Report/ScheduleOfWeek.aspx");

// ============ SEMESTER SYNC ============
let semesterSyncState: SemesterSyncState | null = null;

function startSemesterSync() {
  // Get selected semester from dropdown
  const semesterSelect = document.getElementById("fptu-semester-select") as HTMLSelectElement;
  const selectedSemester = semesterSelect ? semesterSelect.value : getDefaultSemester();
  
  // Save selected semester for restoration after page reload
  storage.set("selectedSemester", selectedSemester);
  
  const semester = getSemesterInfo(selectedSemester);
  if (!semester) {
    alert("Không thể xác định học kỳ: " + selectedSemester);
    return;
  }
  
  const { weeks } = getWeekOptions();
  
  // Filter weeks that overlap with semester
  const yearSelect = document.querySelector("#ctl00_mainContent_drpYear") as HTMLSelectElement;
  const pageYear = yearSelect ? parseInt(yearSelect.value) : semester.year;
  const semesterWeeks = weeks.filter((w: { text: string }) => isWeekInSemester(w.text, pageYear, semester));
  
  if (semesterWeeks.length === 0) {
    alert("Không tìm thấy tuần trong học kỳ " + semester.label + ". Vui lòng chọn đúng năm trên trang FAP.");
    return;
  }
  
  // Clear previous weekly data for fresh semester sync
  storage.set("weeklySchedule", []);
  
  semesterSyncState = {
    semester,
    weeks: semesterWeeks,
    currentIndex: 0,
    collectedEvents: []
  };
  
  storage.set("semesterSyncState", semesterSyncState);
  updateProgressUI();
  processNextSemesterWeek();
}

function processNextSemesterWeek() {
  if (!semesterSyncState) {
    semesterSyncState = storage.get("semesterSyncState");
  }
  if (!semesterSyncState) return;
  
  const { weeks, currentIndex, semester } = semesterSyncState;
  
  if (currentIndex >= weeks.length) {
    finishSemesterSync();
    return;
  }
  
  // First, ensure the correct year is selected on page
  const yearSelect = document.querySelector("#ctl00_mainContent_drpYear") as HTMLSelectElement;
  if (yearSelect && parseInt(yearSelect.value) !== semester.year) {
    // Need to change year first
    storage.set("semesterSyncState", semesterSyncState);
    yearSelect.value = semester.year.toString();
    yearSelect.dispatchEvent(new Event("change", { bubbles: true }));
    // Page will reload
    return;
  }
  
  const week = weeks[currentIndex];
  updateProgressUI();
  
  // Check if we need to change week
  const weekSelect = document.querySelector("#ctl00_mainContent_drpSelectWeek") as HTMLSelectElement;
  if (weekSelect && weekSelect.value !== week.value) {
    // Save state before page reload
    storage.set("semesterSyncState", semesterSyncState);
    selectWeek(week.value);
    // Page will reload, continuation handled in checkPendingSync
  } else {
    // Already on correct week, extract and continue
    extractAndContinue();
  }
}

function extractAndContinue() {
  const events = extractWeeklySchedule();
  
  if (!semesterSyncState) return;
  
  // Add to collected events (dedup)
  const existingKeys = new Set(semesterSyncState.collectedEvents.map((e: ScheduleEvent) => `${e.title}-${new Date(e.start).getTime()}`));
  events.forEach((e: ScheduleEvent) => {
    const key = `${e.title}-${new Date(e.start).getTime()}`;
    if (!existingKeys.has(key)) {
      semesterSyncState!.collectedEvents.push(e);
      existingKeys.add(key);
    }
  });
  
  semesterSyncState.currentIndex++;
  storage.set("semesterSyncState", semesterSyncState);
  updateProgressUI();
  
  // Small delay then continue
  setTimeout(() => processNextSemesterWeek(), 500);
}

function finishSemesterSync() {
  if (!semesterSyncState) return;
  
  const events = semesterSyncState.collectedEvents;
  storage.set("weeklySchedule", events);
  renderWeeklyList(events);
  
  // Clear state
  semesterSyncState = null;
  storage.set("semesterSyncState", null);
  
  // Hide progress
  const progressEl = document.getElementById("fptu-semester-progress");
  if (progressEl) progressEl.style.display = "none";
  
  const syncBtn = document.getElementById("fptu-sync-semester-btn") as HTMLButtonElement;
  if (syncBtn) syncBtn.disabled = false;
  
  console.log("Semester sync complete:", events.length, "events");
}

function updateProgressUI() {
  if (!semesterSyncState) return;
  
  const progressEl = document.getElementById("fptu-semester-progress");
  const labelEl = document.getElementById("fptu-semester-label");
  const textEl = document.getElementById("fptu-progress-text");
  const fillEl = document.getElementById("fptu-progress-fill");
  const syncBtn = document.getElementById("fptu-sync-semester-btn") as HTMLButtonElement;
  
  if (progressEl) progressEl.style.display = "block";
  if (labelEl) labelEl.textContent = semesterSyncState.semester.label;
  if (textEl) textEl.textContent = `${semesterSyncState.currentIndex}/${semesterSyncState.weeks.length} tuần`;
  if (fillEl) (fillEl as HTMLElement).style.width = `${(semesterSyncState.currentIndex / semesterSyncState.weeks.length) * 100}%`;
  if (syncBtn) syncBtn.disabled = true;
}

function checkPendingSync() {
  // Check for pending semester sync (after page redirect)
  if (storage.get("pendingSemesterSync") && isWeeklyPage()) {
    storage.set("pendingSemesterSync", null);
    setTimeout(() => startSemesterSync(), 1000);
    return;
  }
  
  // Check for continuing semester sync (after week change)
  const savedState = storage.get("semesterSyncState");
  if (savedState && savedState.currentIndex !== undefined && isWeeklyPage()) {
    semesterSyncState = savedState;
    updateProgressUI();
    setTimeout(() => extractAndContinue(), 1000);
  }
}

// ============ SYNC FUNCTIONS ============
function syncExamSchedule() {
  const events = extractExamSchedule();
  storage.set("examSchedule", events);
  renderExamList(events);
  console.log("Exam schedule synced:", events.length, "events");
}

function syncCurrentWeek() {
  const events = extractWeeklySchedule();
  const existing = storage.get("weeklySchedule") || [];
  
  // Merge with existing (dedup by title + start time)
  const existingKeys = new Set(existing.map((e: ScheduleEvent) => `${e.title}-${new Date(e.start).getTime()}`));
  events.forEach(e => {
    const key = `${e.title}-${new Date(e.start).getTime()}`;
    if (!existingKeys.has(key)) {
      existing.push(e);
      existingKeys.add(key);
    }
  });
  
  storage.set("weeklySchedule", existing);
  renderWeeklyList(existing);
  console.log("Weekly schedule synced:", events.length, "new events,", existing.length, "total");
}

// ============ RENDER FUNCTIONS ============
function renderExamList(events: ScheduleEvent[]) {
  const upcomingList = document.getElementById("fptu-upcoming-exams");
  const completedList = document.getElementById("fptu-completed-exams");
  const upcomingCount = document.getElementById("fptu-upcoming-count");
  const completedCount = document.getElementById("fptu-completed-count");
  if (!upcomingList || !completedList) return;
  
  upcomingList.innerHTML = "";
  completedList.innerHTML = "";
  
  let upcoming = 0, completed = 0;
  
  if (!events || !events.length) {
    upcomingList.innerHTML = '<div class="fptu-empty">Không có lịch thi. Nhấn đồng bộ để tải.</div>';
    if (upcomingCount) upcomingCount.textContent = "0";
    if (completedCount) completedCount.textContent = "0";
    return;
  }
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  events.forEach(e => {
    const start = new Date(e.start);
    const examDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const diffDays = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    const card = createExamCard(e, diffDays);
    
    if (diffDays < 0) {
      completedList.appendChild(card);
      completed++;
    } else {
      upcomingList.appendChild(card);
      upcoming++;
    }
  });
  
  // Update counters
  if (upcomingCount) upcomingCount.textContent = upcoming.toString();
  if (completedCount) completedCount.textContent = completed.toString();
  
  if (!upcomingList.children.length) {
    upcomingList.innerHTML = '<div class="fptu-empty">Không có kỳ thi sắp tới.</div>';
  }
  if (!completedList.children.length) {
    completedList.innerHTML = '<div class="fptu-empty">Không có kỳ thi đã hoàn thành.</div>';
  }
}

function createExamCard(e: ScheduleEvent, diffDays: number): HTMLElement {
  const start = new Date(e.start);
  const end = new Date(e.end);
  
  const card = document.createElement("div");
  card.className = "fptu-card";
  
  let tagHtml = "";
  if (e.tag) {
    const tagClass = e.tag.toLowerCase().replace("2nd", "second");
    tagHtml = `<span class="fptu-tag ${tagClass}">${e.tag}</span>`;
  }
  
  let countdownClass = "countdown";
  let countdownText = "";
  if (diffDays < 0) {
    countdownClass = "countdown past"; countdownText = "Đã thi";
  } else if (diffDays === 0) {
    countdownClass = "countdown today"; countdownText = "Hôm nay";
  } else if (diffDays === 1) {
    countdownClass = "countdown tomorrow"; countdownText = "Ngày mai";
  } else if (diffDays <= 3) {
    countdownClass = "countdown urgent"; countdownText = `Còn ${diffDays} ngày`;
  } else {
    countdownText = `Còn ${diffDays} ngày`;
  }
  
  card.innerHTML = `
    <div class="fptu-card-title">
      ${e.title} ${tagHtml} <span class="fptu-tag ${countdownClass}">${countdownText}</span>
    </div>
    <div class="fptu-card-detail">
      <div class="line"><span class="label">Phương thức:</span> ${e.description || "Chưa rõ"}</div>
      <div class="line"><span class="label">Phòng:</span> ${e.location || "Chưa rõ"}</div>
      <div class="line"><span class="label">Ngày:</span> ${formatDate(start)}</div>
      <div class="line"><span class="label">Giờ:</span> ${formatTime(start)} - ${formatTime(end)}</div>
    </div>
  `;
  
  return card;
}

// Check if subject is online (ends with 'c' like ENW492c)
function isOnlineSubject(subjectCode: string): boolean {
  if (!subjectCode) return false;
  // Online subjects end with lowercase 'c' after the normal code pattern
  return /^[A-Z]{2,4}\d{2,4}c$/i.test(subjectCode.trim());
}

function renderWeeklyList(events: ScheduleEvent[]) {
  const offlineList = document.getElementById("fptu-offline-classes");
  const onlineList = document.getElementById("fptu-online-classes");
  const offlineCount = document.getElementById("fptu-offline-count");
  const onlineCount = document.getElementById("fptu-online-count");
  if (!offlineList || !onlineList) return;
  
  offlineList.innerHTML = "";
  onlineList.innerHTML = "";
  
  if (!events || !events.length) {
    offlineList.innerHTML = '<div class="fptu-empty">Không có lịch học. Nhấn đồng bộ để tải.</div>';
    onlineList.innerHTML = '<div class="fptu-empty">Không có lịch học online.</div>';
    if (offlineCount) offlineCount.textContent = "0";
    if (onlineCount) onlineCount.textContent = "0";
    return;
  }
  
  // Sort by date
  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  
  // Separate online and offline
  const offlineEvents = sorted.filter(e => !isOnlineSubject(e.title));
  const onlineEvents = sorted.filter(e => isOnlineSubject(e.title));
  
  // Update counters
  if (offlineCount) offlineCount.textContent = offlineEvents.length.toString();
  if (onlineCount) onlineCount.textContent = onlineEvents.length.toString();
  
  offlineEvents.forEach(e => {
    const card = createClassCard(e, false);
    offlineList.appendChild(card);
  });
  
  onlineEvents.forEach(e => {
    const card = createClassCard(e, true);
    onlineList.appendChild(card);
  });
  
  if (!offlineList.children.length) {
    offlineList.innerHTML = '<div class="fptu-empty">Không có lịch học offline.</div>';
  }
  if (!onlineList.children.length) {
    onlineList.innerHTML = '<div class="fptu-empty">Không có lịch học online.</div>';
  }
}

function createClassCard(e: ScheduleEvent, isOnline = false): HTMLElement {
  const start = new Date(e.start);
  const end = new Date(e.end);
  
  const card = document.createElement("div");
  card.className = "fptu-card";
  
  let statusClass = e.status || "not-yet";
  let statusText = "Chưa điểm danh";
  if (e.status === "attended") { statusText = "✓ Đã điểm danh"; }
  else if (e.status === "absent") { statusText = "✗ Vắng"; }
  
  let meetHtml = "";
  if (e.meetUrl) {
    meetHtml = `<a href="${e.meetUrl}" target="_blank" class="fptu-meet-btn">📹 Google Meet</a>`;
  }
  
  const onlineTag = isOnline ? '<span class="fptu-tag online">Online</span>' : '';
  
  card.innerHTML = `
    <div class="fptu-card-title">
      ${e.title} ${onlineTag} <span class="fptu-tag ${statusClass}">${statusText}</span>
    </div>
    <div class="fptu-card-detail">
      <div class="line"><span class="label">Phòng:</span> ${e.location || (isOnline ? "Online" : "Chưa rõ")}</div>
      <div class="line"><span class="label">Ngày:</span> ${formatDate(start)}</div>
      <div class="line"><span class="label">Giờ:</span> ${formatTime(start)} - ${formatTime(end)}</div>
      ${meetHtml}
    </div>
  `;
  
  return card;
}

// ============ EXPORT FUNCTIONS ============
function exportExamICS() {
  const events = storage.get("examSchedule") || [];
  if (!events.length) {
    alert("Không có lịch thi để xuất. Vui lòng đồng bộ trước.");
    return;
  }
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = events.filter((e: ScheduleEvent) => {
    const start = new Date(e.start);
    return start >= today && e.location && !e.location.toLowerCase().includes("chưa");
  });
  
  if (!upcoming.length) {
    alert("Không có kỳ thi sắp tới với phòng thi hợp lệ.");
    return;
  }
  
  generateICS(upcoming, "lich-thi.ics");
}

function exportWeeklyICS(onlineOnly = false) {
  const events = storage.get("weeklySchedule") || [];
  if (!events.length) {
    alert("Không có lịch học để xuất. Vui lòng đồng bộ trước.");
    return;
  }
  
  // Filter based on online/offline
  const filtered = events.filter((e: ScheduleEvent) => {
    const isOnline = isOnlineSubject(e.title);
    return onlineOnly ? isOnline : !isOnline;
  });
  
  if (!filtered.length) {
    alert(onlineOnly ? "Không có lịch học online." : "Không có lịch học offline.");
    return;
  }
  
  // Include meetUrl in description for online classes
  const eventsWithMeet = filtered.map((e: ScheduleEvent) => {
    if (e.meetUrl) {
      return {
        ...e,
        description: (e.description || '') + (e.description ? '\\n' : '') + 'Meet: ' + e.meetUrl
      };
    }
    return e;
  });
  
  const filename = onlineOnly ? "lich-hoc-online.ics" : "lich-hoc.ics";
  generateICS(eventsWithMeet, filename);
}

// ============ LOAD CACHED DATA ============
function loadCachedData() {
  const examData = storage.get("examSchedule");
  if (examData && examData.length) {
    renderExamList(examData);
  } else {
    // Show empty state
    const upcomingList = document.getElementById("fptu-upcoming-exams");
    const completedList = document.getElementById("fptu-completed-exams");
    if (upcomingList) upcomingList.innerHTML = '<div class="fptu-empty">Không có lịch thi. Nhấn đồng bộ để tải.</div>';
    if (completedList) completedList.innerHTML = '<div class="fptu-empty">Không có kỳ thi đã hoàn thành.</div>';
  }
  
  const weeklyData = storage.get("weeklySchedule");
  if (weeklyData && weeklyData.length) {
    renderWeeklyList(weeklyData);
  } else {
    // Show empty state
    const offlineList = document.getElementById("fptu-offline-classes");
    const onlineList = document.getElementById("fptu-online-classes");
    if (offlineList) offlineList.innerHTML = '<div class="fptu-empty">Không có lịch học. Nhấn đồng bộ để tải.</div>';
    if (onlineList) onlineList.innerHTML = '<div class="fptu-empty">Không có lịch học online.</div>';
  }
}

// ============ PANEL UI & EVENT ATTACHMENT ============
function attachPanelEvents(panel: HTMLElement) {
  const minimizeBtn = panel.querySelector("#fptu-minimize-btn");
  const closeBtn = panel.querySelector("#fptu-close-btn");
  const resetBtn = panel.querySelector("#fptu-reset-btn");
  
  // Minimize
  minimizeBtn?.addEventListener("click", () => {
    panel.classList.toggle("minimized");
    if (minimizeBtn) (minimizeBtn as HTMLButtonElement).textContent = panel.classList.contains("minimized") ? "+" : "−";
  });
  
  // Close
  closeBtn?.addEventListener("click", () => {
    panel.style.display = "none";
    showToggleButton();
  });
  
  // Reset all data
  resetBtn?.addEventListener("click", () => {
    if (confirm("Xoá tất cả dữ liệu lịch đã lưu?")) {
      storage.set("examSchedule", null);
      storage.set("weeklySchedule", null);
      storage.set("semesterSyncState", null);
      storage.set("selectedSemester", null);
      storage.set("pendingSemesterSync", null);
      loadCachedData(); // Reload empty state
      alert("Đã xoá tất cả dữ liệu!");
    }
  });
  
  // Main tabs
  const examTab = panel.querySelector("#fptu-exam-tab");
  const weeklyTab = panel.querySelector("#fptu-weekly-tab");
  const examSection = panel.querySelector("#fptu-exam-section");
  const weeklySection = panel.querySelector("#fptu-weekly-section");
  
  examTab?.addEventListener("click", () => {
    examTab.classList.add("active");
    weeklyTab?.classList.remove("active");
    examSection?.classList.add("active");
    weeklySection?.classList.remove("active");
  });
  
  weeklyTab?.addEventListener("click", () => {
    weeklyTab?.classList.add("active");
    examTab?.classList.remove("active");
    weeklySection?.classList.add("active");
    examSection?.classList.remove("active");
  });
  
  // Exam sub-tabs
  const upcomingTab = panel.querySelector("#fptu-upcoming-tab");
  const completedTab = panel.querySelector("#fptu-completed-tab");
  const upcomingList = panel.querySelector("#fptu-upcoming-exams");
  const completedList = panel.querySelector("#fptu-completed-exams");
  
  upcomingTab?.addEventListener("click", () => {
    upcomingTab.classList.add("active");
    completedTab?.classList.remove("active");
    upcomingList?.classList.add("active");
    completedList?.classList.remove("active");
  });
  
  completedTab?.addEventListener("click", () => {
    completedTab?.classList.add("active");
    upcomingTab?.classList.remove("active");
    completedList?.classList.add("active");
    upcomingList?.classList.remove("active");
  });
  
  // Weekly sub-tabs (Offline/Online)
  const offlineTab = panel.querySelector("#fptu-offline-tab");
  const onlineTab = panel.querySelector("#fptu-online-tab");
  const offlineList = panel.querySelector("#fptu-offline-classes");
  const onlineList = panel.querySelector("#fptu-online-classes");
  
  offlineTab?.addEventListener("click", () => {
    offlineTab.classList.add("active");
    onlineTab?.classList.remove("active");
    offlineList?.classList.add("active");
    onlineList?.classList.remove("active");
  });
  
  onlineTab?.addEventListener("click", () => {
    onlineTab?.classList.add("active");
    offlineTab?.classList.remove("active");
    onlineList?.classList.add("active");
    offlineList?.classList.remove("active");
  });
  
  // Sync buttons
  panel.querySelector("#fptu-sync-exam-btn")?.addEventListener("click", () => {
    if (!isExamPage()) {
      window.location.href = "https://fap.fpt.edu.vn/Exam/ScheduleExams.aspx";
      return;
    }
    syncExamSchedule();
  });
  
  panel.querySelector("#fptu-sync-week-btn")?.addEventListener("click", () => {
    if (!isWeeklyPage()) {
      window.location.href = "https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx";
      return;
    }
    syncCurrentWeek();
  });
  
  panel.querySelector("#fptu-sync-semester-btn")?.addEventListener("click", () => {
    if (!isWeeklyPage()) {
      window.location.href = "https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx";
      storage.set("pendingSemesterSync", true);
      return;
    }
    startSemesterSync();
  });
  
  // Export buttons
  panel.querySelector("#fptu-export-exam-btn")?.addEventListener("click", exportExamICS);
  panel.querySelector("#fptu-export-offline-btn")?.addEventListener("click", () => exportWeeklyICS(false));
  panel.querySelector("#fptu-export-online-btn")?.addEventListener("click", () => exportWeeklyICS(true));
  
  // Make panel draggable
  makeDraggable(panel);
}

function makeDraggable(panel: HTMLElement) {
  const header = panel.querySelector(".fptu-panel-header") as HTMLElement;
  let isDragging = false;
  let offsetX: number, offsetY: number;
  
  header.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
    isDragging = true;
    offsetX = e.clientX - panel.offsetLeft;
    offsetY = e.clientY - panel.offsetTop;
    panel.style.transform = "none";
  });
  
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    panel.style.left = (e.clientX - offsetX) + "px";
    panel.style.top = (e.clientY - offsetY) + "px";
    panel.style.right = "auto";
  });
  
  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

// ============ INITIALIZE ============
export function initSchedulerPanel() {
  console.log("Creating FPTU Scheduler Panel...");
  
  // Remove existing panel if any
  const existing = document.getElementById("fptu-scheduler-panel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "fptu-scheduler-panel";
  panel.innerHTML = createPanelHTML(isExamPage(), isWeeklyPage());

  document.body.appendChild(panel);
  addPanelStyles();
  attachPanelEvents(panel);
  
  // Restore saved semester selection if exists
  const savedSemester = storage.get("selectedSemester");
  if (savedSemester) {
    const semesterSelect = panel.querySelector("#fptu-semester-select") as HTMLSelectElement;
    if (semesterSelect) {
      semesterSelect.value = savedSemester;
    }
  }
  
  // Load cached data
  loadCachedData();
  
  // Auto-sync if on relevant page
  setTimeout(() => {
    if (isExamPage()) {
      syncExamSchedule();
    } else if (isWeeklyPage()) {
      syncCurrentWeek();
      checkPendingSync();
    }
  }, 1000);
}
