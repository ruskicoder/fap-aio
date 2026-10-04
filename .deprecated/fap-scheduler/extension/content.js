// FPTU Scheduler - Content Script
// Injects floating panel into FAP pages for schedule extraction

(function() {
  'use strict';

  // Guard against multiple injections
  if (window.__FPTU_SCHEDULER_LOADED__) {
    console.log("FPTU Scheduler already loaded");
    return;
  }
  window.__FPTU_SCHEDULER_LOADED__ = true;

  // ============ CONSTANTS ============
  const SLOT_TIMES = {
    1: { start: "7:00", end: "9:15" },
    2: { start: "9:30", end: "11:45" },
    3: { start: "12:30", end: "14:45" },
    4: { start: "15:00", end: "17:15" },
    5: { start: "17:30", end: "19:45" },
    6: { start: "20:00", end: "22:15" },
    7: { start: "7:00", end: "9:15" },
    8: { start: "9:30", end: "11:45" }
  };

  // ============ UTILITY FUNCTIONS ============
  const fmtTime = t => {
    if (!t || typeof t !== "string") return { hour: 0, minute: 0 };
    const cleaned = t.trim().replace(/\s+/g, "");
    
    if (cleaned.match(/\d+h\d*/i)) {
      const [h, m = "0"] = cleaned.replace(/h/i, ":").split(":").map(Number);
      return { hour: h, minute: m };
    }
    if (cleaned.includes(":")) {
      const [h, m = "0"] = cleaned.split(":").map(Number);
      return { hour: h, minute: m };
    }
    if (/^\d{1,2}$/.test(cleaned)) {
      return { hour: Number(cleaned), minute: 0 };
    }
    if (cleaned.includes(".")) {
      const [h, m = "0"] = cleaned.split(".").map(Number);
      return { hour: h, minute: m };
    }
    return { hour: 0, minute: 0 };
  };

  const formatTime = d => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const formatDate = d => d.toLocaleDateString("vi-VN");

  // ============ STORAGE HELPERS ============
  const storage = {
    get: (key) => {
      try {
        return JSON.parse(localStorage.getItem(key) || 'null');
      } catch { return null; }
    },
    set: (key, value) => {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  // ============ SEMESTER UTILITIES ============
  // Generate semester options from 2022 to current year + 1
  function getSemesterOptions() {
    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + 1;
    const seasons = ["Spring", "Summer", "Fall"];
    const options = [];
    
    for (let year = 2022; year <= maxYear; year++) {
      const yearShort = year.toString().slice(-2);
      seasons.forEach(season => {
        options.push({ label: season + yearShort, season, year });
      });
    }
    
    return options;
  }

  // Parse semester label like "Spring25" into semester info with date ranges
  function getSemesterInfo(semesterLabel) {
    const match = semesterLabel.match(/^(Spring|Summer|Fall)(\d{2})$/i);
    if (!match) return null;
    
    const season = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const yearShort = match[2];
    const year = 2000 + parseInt(yearShort);
    
    let startMonth, endMonth;
    if (season === "Spring") { startMonth = 1; endMonth = 4; }
    else if (season === "Summer") { startMonth = 5; endMonth = 8; }
    else { startMonth = 9; endMonth = 12; }
    
    return {
      label: season + yearShort,
      season, year, yearShort,
      startDate: new Date(year, startMonth - 1, 1),
      endDate: new Date(year, endMonth, 0) // Last day of endMonth
    };
  }

  // Get default semester based on current date
  function getDefaultSemester() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const yearShort = now.getFullYear().toString().slice(-2);
    
    let season;
    if (month >= 1 && month <= 4) season = "Spring";
    else if (month >= 5 && month <= 8) season = "Summer";
    else season = "Fall";
    
    return season + yearShort;
  }

  // Check if week overlaps with semester (DD/MM To DD/MM format)
  // Include weeks that have ANY overlap with semester range
  function isWeekInSemester(weekText, pageYear, semester) {
    // Format: "DD/MM To DD/MM" (day/month)
    const match = weekText.match(/(\d{1,2})\/(\d{1,2})\s+To\s+(\d{1,2})\/(\d{1,2})/);
    if (!match) return false;
    
    const [_, startDay, startMonth, endDay, endMonth] = match.map((v, i) => i === 0 ? v : parseInt(v));
    
    // Determine years for week start and end
    // Use semester year, but handle year boundary (e.g., 29/12 To 04/01)
    let weekStartYear = semester.year;
    let weekEndYear = semester.year;
    
    // If week crosses year boundary (end month < start month)
    if (endMonth < startMonth) {
      // Week like "29/12 To 04/01"
      // If semester is Spring (Jan-Apr), the 29/12 is from previous year
      if (semester.season === "Spring") {
        weekStartYear = semester.year - 1;
      } else {
        // For Fall semester, 04/01 would be next year
        weekEndYear = semester.year + 1;
      }
    }
    
    const weekStart = new Date(weekStartYear, startMonth - 1, startDay);
    const weekEnd = new Date(weekEndYear, endMonth - 1, endDay);
    
    // Include week if ANY part overlaps with semester
    return weekEnd >= semester.startDate && weekStart <= semester.endDate;
  }

  // ============ PAGE DETECTION ============
  const isExamPage = () => window.location.href.includes("Exam/ScheduleExams.aspx");
  const isWeeklyPage = () => window.location.href.includes("Report/ScheduleOfWeek.aspx");

  // ============ EXTRACTION FUNCTIONS ============
  function extractExamSchedule() {
    try {
      const rows = Array.from(document.querySelectorAll("#ctl00_mainContent_divContent table tr"))
        .slice(1)
        .map(tr => Array.from(tr.cells).map(td => td.textContent.trim()));

      return rows
        .filter(row => row.length >= 8 && row[3] && row[5] !== undefined)
        .map(row => {
          const [no, code, name, date, room, time, form, exam, ...rest] = row;
          const [day, month, year] = date.split("/").map(Number);
          const [startStr, endStr] = time.split("-");
          const start = new Date(year, month - 1, day, fmtTime(startStr).hour, fmtTime(startStr).minute);
          const end = new Date(year, month - 1, day, fmtTime(endStr).hour, fmtTime(endStr).minute);
          
          let rawTag = exam?.trim().toUpperCase() || (rest[0]?.trim().toUpperCase() || "");
          const formLower = (form || "").toLowerCase();
          
          let tag = null;
          if (rawTag === "2NDFE") tag = "2NDFE";
          else if (rawTag === "2NDPE") tag = "2NDPE";
          else if (rawTag === "PE") tag = "PE";
          else if (rawTag === "FE") tag = "FE";
          else if (!rawTag) {
            if (formLower.includes("2nd") && formLower.includes("fe")) tag = "2NDFE";
            else if (formLower.includes("2nd") && formLower.includes("pe")) tag = "2NDPE";
            else if (formLower.includes("practical_exam") || formLower.includes("project presentation")) tag = "PE";
            else if (formLower.includes("multiple_choices") || formLower.includes("speaking")) tag = "FE";
          }

          return { title: code || "Unknown", location: room || "", description: form || "", start, end, tag, type: "exam" };
        });
    } catch (e) {
      console.error("Exam extraction error:", e);
      return [];
    }
  }

  function extractWeeklySchedule() {
    try {
      const events = [];
      const yearSelect = document.querySelector("#ctl00_mainContent_drpYear");
      const year = yearSelect ? parseInt(yearSelect.value) : new Date().getFullYear();
      
      const theadRows = document.querySelectorAll("thead tr");
      const dates = [];
      
      if (theadRows.length >= 2) {
        const dateRow = theadRows[1];
        dateRow.querySelectorAll("th").forEach(th => {
          const text = th.textContent.trim();
          if (text.includes("/")) {
            const [day, month] = text.split("/").map(Number);
            dates.push({ day, month, year });
          }
        });
      }
      
      const rows = document.querySelectorAll("tbody tr");
      
      rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 2) return;
        
        const slotText = cells[0].textContent.trim();
        const slotMatch = slotText.match(/Slot\s*(\d+)/i);
        if (!slotMatch) return;
        
        const slotNum = parseInt(slotMatch[1]);
        const slotTiming = SLOT_TIMES[slotNum] || SLOT_TIMES[1];
        
        for (let i = 1; i < cells.length && i <= 7; i++) {
          const cell = cells[i];
          const cellText = cell.textContent.trim();
          if (cellText === "-" || !cellText) continue;
          
          const activityPs = cell.querySelectorAll("p");
          if (activityPs.length === 0) continue;
          
          activityPs.forEach(p => {
            const fullText = p.textContent;
            
            let subjectCode = "";
            const firstLink = p.querySelector("a[href*='ActivityDetail']");
            if (firstLink) {
              let linkText = firstLink.textContent.trim().replace(/-$/, "");
              // Match subject code with optional 'c' suffix for online courses (e.g., PMG201c)
              const codeMatch = linkText.match(/^([A-Z]{2,4}\d{2,4}c?)/i);
              if (codeMatch) subjectCode = codeMatch[1];
            }
            if (!subjectCode) {
              const codeFromText = fullText.match(/([A-Z]{2,4}\d{2,4}c?)/i);
              if (codeFromText) subjectCode = codeFromText[1];
            }
            
            let room = "";
            const roomMatch = fullText.match(/at\s+([^(]+)\(/i);
            if (roomMatch) room = roomMatch[1].trim();
            
            let meetUrl = "";
            const meetLink = p.querySelector("a[href*='meet.google.com']");
            if (meetLink) meetUrl = meetLink.getAttribute("href");
            
            let startTimeStr = slotTiming.start, endTimeStr = slotTiming.end;
            const timeSpan = p.querySelector(".label-success");
            if (timeSpan) {
              const timeMatch = timeSpan.textContent.match(/\((\d{1,2}:\d{2})-(\d{1,2}:\d{2})\)/);
              if (timeMatch) { startTimeStr = timeMatch[1]; endTimeStr = timeMatch[2]; }
            }
            
            let status = "not-yet";
            if (fullText.toLowerCase().includes("attended") && !fullText.toLowerCase().includes("not yet")) {
              status = "attended";
            } else if (fullText.toLowerCase().includes("absent")) {
              status = "absent";
            }
            
            const dateIndex = i - 1;
            if (dateIndex >= dates.length) return;
            
            const dateInfo = dates[dateIndex];
            const startTime = fmtTime(startTimeStr);
            const endTime = fmtTime(endTimeStr);
            
            const startDate = new Date(dateInfo.year, dateInfo.month - 1, dateInfo.day, startTime.hour, startTime.minute);
            const endDate = new Date(dateInfo.year, dateInfo.month - 1, dateInfo.day, endTime.hour, endTime.minute);
            
            if (subjectCode) {
              events.push({
                title: subjectCode, location: room, description: `Slot ${slotNum}`,
                start: startDate, end: endDate, meetUrl, status, slot: slotNum, type: "class"
              });
            }
          });
        }
      });
      
      return events;
    } catch (e) {
      console.error("Weekly extraction error:", e);
      return [];
    }
  }

  function getWeekOptions() {
    const weekSelect = document.querySelector("#ctl00_mainContent_drpSelectWeek");
    const yearSelect = document.querySelector("#ctl00_mainContent_drpYear");
    if (!weekSelect) return { weeks: [], currentYear: new Date().getFullYear() };
    
    const weeks = [];
    weekSelect.querySelectorAll("option").forEach(opt => {
      weeks.push({ value: opt.value, text: opt.textContent.trim(), selected: opt.selected });
    });
    
    return { weeks, currentYear: yearSelect ? parseInt(yearSelect.value) : new Date().getFullYear() };
  }

  function selectWeek(weekValue) {
    const weekSelect = document.querySelector("#ctl00_mainContent_drpSelectWeek");
    if (!weekSelect) return false;
    if (weekSelect.value === weekValue) return false; // Already on this week
    
    weekSelect.value = weekValue;
    weekSelect.dispatchEvent(new Event("change", { bubbles: true }));
    return true; // Page will reload
  }

  // ============ ICS GENERATOR ============
  function generateICS(events, filename) {
    const SEPARATOR = '\r\n';
    const calendarStart = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:fptu-scheduler', 'CALSCALE:GREGORIAN'].join(SEPARATOR);
    const calendarEnd = 'END:VCALENDAR';
    
    const fmt = d => {
      const date = new Date(d);
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };
    
    const eventsStr = events.map(e => {
      const start = new Date(e.start);
      const end = new Date(e.end);
      const uid = fmt(new Date()) + '-' + Math.random().toString(36).substring(2, 8) + '@fptu';
      
      let title = e.title;
      if (e.tag) title += ' - ' + e.tag;
      
      return [
        'BEGIN:VEVENT',
        'UID:' + uid,
        'DTSTAMP:' + fmt(new Date()),
        'DTSTART:' + fmt(start),
        'DTEND:' + fmt(end),
        'SUMMARY:' + title,
        'DESCRIPTION:' + (e.description || ''),
        'LOCATION:' + (e.location || ''),
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder',
        'END:VALARM',
        'END:VEVENT'
      ].join(SEPARATOR);
    }).join(SEPARATOR);
    
    const ics = calendarStart + SEPARATOR + eventsStr + SEPARATOR + calendarEnd;
    
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============ PANEL UI ============
  function createPanel() {
    // Remove existing panel if any
    const existing = document.getElementById("fptu-scheduler-panel");
    if (existing) existing.remove();

    const panel = document.createElement("div");
    panel.id = "fptu-scheduler-panel";
    panel.innerHTML = `
      <div class="fptu-panel-header">
        <h2>📅 FPTU Scheduler</h2>
        <div class="fptu-panel-controls">
          <button id="fptu-reset-btn" title="Xoá dữ liệu">🗑</button>
          <button id="fptu-minimize-btn" title="Thu nhỏ">−</button>
          <button id="fptu-close-btn" title="Đóng">×</button>
        </div>
      </div>
      <div class="fptu-panel-body">
        <div class="fptu-main-tabs">
          <button id="fptu-exam-tab" class="fptu-main-tab ${isExamPage() ? 'active' : ''}">📝 Lịch thi</button>
          <button id="fptu-weekly-tab" class="fptu-main-tab ${isWeeklyPage() ? 'active' : ''}">📚 Lịch học</button>
        </div>
        
        <!-- Exam Section -->
        <div id="fptu-exam-section" class="fptu-section ${isExamPage() ? 'active' : ''}">
          <div class="fptu-section-header">
            <button id="fptu-sync-exam-btn" class="fptu-sync-btn">🔄 Đồng bộ lịch thi</button>
          </div>
          <div class="fptu-sub-tabs">
            <button id="fptu-upcoming-tab" class="fptu-sub-tab active">📅 Chưa thi <span class="fptu-tab-count" id="fptu-upcoming-count">0</span></button>
            <button id="fptu-completed-tab" class="fptu-sub-tab">✅ Đã thi <span class="fptu-tab-count" id="fptu-completed-count">0</span></button>
          </div>
          <div id="fptu-upcoming-exams" class="fptu-list active"></div>
          <div id="fptu-completed-exams" class="fptu-list"></div>
          <div class="fptu-actions">
            <button id="fptu-export-exam-btn" class="fptu-export-btn">📅 Tải xuống lịch thi (.ics)</button>
          </div>
        </div>
        
        <!-- Weekly Section -->
        <div id="fptu-weekly-section" class="fptu-section ${isWeeklyPage() ? 'active' : ''}">
          <div class="fptu-semester-selector">
            <label for="fptu-semester-select">Học kỳ:</label>
            <select id="fptu-semester-select">
              ${getSemesterOptions().map(s => 
                `<option value="${s.label}" ${s.label === getDefaultSemester() ? 'selected' : ''}>${s.label}</option>`
              ).join('')}
            </select>
          </div>
          <div class="fptu-section-header fptu-weekly-header">
            <button id="fptu-sync-week-btn" class="fptu-sync-btn">🔄 Tuần này</button>
            <button id="fptu-sync-semester-btn" class="fptu-sync-btn fptu-semester-btn">📆 Cả học kỳ</button>
          </div>
          <div id="fptu-semester-progress" class="fptu-progress" style="display: none;">
            <div class="fptu-progress-info">
              <span id="fptu-semester-label">Spring25</span>
              <span id="fptu-progress-text">0/0 tuần</span>
            </div>
            <div class="fptu-progress-bar">
              <div id="fptu-progress-fill" class="fptu-progress-fill"></div>
            </div>
          </div>
          <div class="fptu-sub-tabs">
            <button id="fptu-offline-tab" class="fptu-sub-tab active">🏫 Offline <span class="fptu-tab-count" id="fptu-offline-count">0</span></button>
            <button id="fptu-online-tab" class="fptu-sub-tab">💻 Online <span class="fptu-tab-count" id="fptu-online-count">0</span></button>
          </div>
          <div id="fptu-offline-classes" class="fptu-list active"></div>
          <div id="fptu-online-classes" class="fptu-list"></div>
          <div class="fptu-actions fptu-export-actions">
            <button id="fptu-export-offline-btn" class="fptu-export-btn">🏫 Xuất Offline (.ics)</button>
            <button id="fptu-export-online-btn" class="fptu-export-btn fptu-export-online">💻 Xuất Online (.ics)</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    addPanelStyles();
    attachPanelEvents(panel);
    
    // Restore saved semester selection if exists
    const savedSemester = storage.get("selectedSemester");
    if (savedSemester) {
      const semesterSelect = panel.querySelector("#fptu-semester-select");
      if (semesterSelect) {
        semesterSelect.value = savedSemester;
      }
    }
    
    // Load cached data
    loadCachedData();
    
    return panel;
  }

  function addPanelStyles() {
    if (document.getElementById("fptu-scheduler-styles")) return;
    
    const style = document.createElement("style");
    style.id = "fptu-scheduler-styles";
    style.textContent = `
      #fptu-scheduler-panel {
        position: fixed;
        top: 50%;
        right: 20px;
        transform: translateY(-50%);
        width: 380px;
        height: 580px;
        background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
        backdrop-filter: blur(20px);
        border-radius: 20px;
        box-shadow: 0 8px 32px rgba(0, 122, 255, 0.15), 0 0 0 1px rgba(0, 122, 255, 0.1);
        z-index: 999999;
        font-family: 'Inter', 'Segoe UI', 'Roboto', sans-serif;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      #fptu-scheduler-panel.minimized {
        height: auto;
      }
      #fptu-scheduler-panel.minimized .fptu-panel-body {
        display: none;
      }
      .fptu-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        background: linear-gradient(135deg, #007AFF 0%, #34C759 100%);
        color: white;
        cursor: move;
      }
      .fptu-panel-header h2 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        text-shadow: 0 1px 2px rgba(0,0,0,0.15);
      }
      .fptu-panel-controls button {
        background: rgba(255,255,255,0.25);
        border: none;
        color: white;
        width: 26px;
        height: 26px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        margin-left: 6px;
        transition: all 0.2s;
      }
      .fptu-panel-controls button:hover {
        background: rgba(255,255,255,0.4);
        transform: scale(1.05);
      }
      .fptu-panel-body {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: rgba(248,250,252,0.6);
      }
      .fptu-main-tabs {
        display: flex;
        background: rgba(255,255,255,0.8);
        border-bottom: 1px solid rgba(0, 122, 255, 0.1);
      }
      .fptu-main-tab {
        flex: 1;
        padding: 12px;
        border: none;
        background: none;
        font-size: 13px;
        font-weight: 500;
        color: #6b7280;
        cursor: pointer;
        transition: all 0.2s;
      }
      .fptu-main-tab.active {
        color: #007AFF;
        border-bottom: 2px solid #007AFF;
        background: rgba(0, 122, 255, 0.05);
      }
      .fptu-section {
        display: none;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
      }
      .fptu-section.active {
        display: flex;
      }
      #fptu-semester-select {
        color: #1f2937;
      }
      .fptu-semester-selector {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: rgba(255,255,255,0.7);
        border-bottom: 1px solid rgba(0, 122, 255, 0.1);
      }
      .fptu-semester-selector label {
        font-size: 12px;
        font-weight: 500;
        color: #374151;
      }
      .fptu-semester-selector select {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid rgba(0, 122, 255, 0.2);
        border-radius: 10px;
        font-size: 12px;
        background: rgba(255,255,255,0.9);
        cursor: pointer;
        transition: all 0.2s;
      }
      .fptu-semester-selector select:focus {
        outline: none;
        border-color: #007AFF;
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
      }
      .fptu-section-header {
        display: flex;
        gap: 8px;
        padding: 10px 12px;
        background: rgba(255,255,255,0.6);
        border-bottom: 1px solid rgba(0, 122, 255, 0.1);
        justify-content: center;
      }
      .fptu-sync-btn {
        padding: 8px 16px;
        background: linear-gradient(135deg, #007AFF 0%, #0066DD 100%);
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
      }
      .fptu-sync-btn:hover { background: linear-gradient(135deg, #0066DD 0%, #0055CC 100%); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 122, 255, 0.4); }
      .fptu-sync-btn:disabled { background: #9ca3af; cursor: not-allowed; box-shadow: none; transform: none; }
      .fptu-semester-btn { background: linear-gradient(135deg, #34C759 0%, #28A745 100%); box-shadow: 0 2px 8px rgba(52, 199, 89, 0.3); }
      .fptu-semester-btn:hover { background: linear-gradient(135deg, #28A745 0%, #1E8E3E 100%); box-shadow: 0 4px 12px rgba(52, 199, 89, 0.4); }
      .fptu-progress {
        padding: 10px 12px;
        background: rgba(255,255,255,0.6);
        border-bottom: 1px solid rgba(0, 122, 255, 0.1);
      }
      .fptu-progress-info {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        margin-bottom: 6px;
      }
      #fptu-semester-label { font-weight: 600; color: #34C759; }
      #fptu-progress-text { color: #6b7280; }
      .fptu-progress-bar {
        height: 6px;
        background: rgba(0, 122, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
      }
      .fptu-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #007AFF, #34C759);
        width: 0%;
        transition: width 0.3s;
        border-radius: 3px;
      }
      .fptu-sub-tabs {
        display: flex;
        background: rgba(255,255,255,0.7);
        border-bottom: 1px solid rgba(0, 122, 255, 0.1);
      }
      .fptu-sub-tab {
        flex: 1;
        padding: 10px;
        border: none;
        background: none;
        font-size: 12px;
        color: #6b7280;
        cursor: pointer;
        transition: all 0.2s;
      }
      .fptu-sub-tab.active {
        color: #007AFF;
        font-weight: 600;
        background: rgba(0, 122, 255, 0.08);
      }
      .fptu-sub-tab:hover:not(.active) {
        background: rgba(0, 122, 255, 0.04);
      }
      .fptu-tab-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        margin-left: 4px;
        background: rgba(0, 122, 255, 0.15);
        color: #007AFF;
        border-radius: 9px;
        font-size: 10px;
        font-weight: 600;
      }
      .fptu-sub-tab.active .fptu-tab-count {
        background: #007AFF;
        color: white;
      }
      .fptu-list {
        display: none;
        overflow-y: auto;
        padding: 10px;
        background: rgba(248,250,252,0.5);
        height: 240px;
        min-height: 240px;
        max-height: 240px;
      }
      .fptu-list.active { display: block; }
      .fptu-card {
        background: rgba(255,255,255,0.9);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 12px;
        margin-bottom: 8px;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.08);
        border: 1px solid rgba(0, 122, 255, 0.1);
        transition: all 0.2s;
      }
      .fptu-card:hover {
        box-shadow: 0 4px 16px rgba(0, 122, 255, 0.15);
        border-color: #007AFF;
        transform: translateY(-1px);
      }
      .fptu-card-title {
        font-weight: 600;
        font-size: 14px;
        color: #1f2937;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
      }
      .fptu-tag {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 500;
      }
      .fptu-tag.fe { background: rgba(0, 122, 255, 0.1); color: #007AFF; }
      .fptu-tag.pe { background: rgba(52, 199, 89, 0.1); color: #28A745; }
      .fptu-tag.secondfe { background: #fef3c7; color: #b45309; }
      .fptu-tag.secondpe { background: #fee2e2; color: #dc2626; }
      .fptu-tag.countdown { background: rgba(0, 122, 255, 0.1); color: #007AFF; }
      .fptu-tag.today { background: #fee2e2; color: #dc2626; }
      .fptu-tag.tomorrow { background: #fef3c7; color: #b45309; }
      .fptu-tag.urgent { background: #fef3c7; color: #b45309; }
      .fptu-tag.attended { background: rgba(52, 199, 89, 0.1); color: #28A745; }
      .fptu-tag.absent { background: #fee2e2; color: #dc2626; }
      .fptu-tag.not-yet { background: #f3f4f6; color: #6b7280; }
      .fptu-tag.online { background: rgba(0, 122, 255, 0.1); color: #007AFF; }
      .fptu-card-detail {
        font-size: 12px;
        color: #6b7280;
      }
      .fptu-card-detail .line {
        margin: 2px 0;
      }
      .fptu-card-detail .label {
        font-weight: 500;
        color: #374151;
      }
      .fptu-meet-btn {
        display: inline-block;
        margin-top: 6px;
        padding: 5px 10px;
        background: linear-gradient(135deg, #007AFF 0%, #34C759 100%);
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-size: 11px;
        transition: all 0.2s;
        box-shadow: 0 2px 6px rgba(0, 122, 255, 0.25);
      }
      .fptu-meet-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(0, 122, 255, 0.35);
      }
      .fptu-actions {
        padding: 12px;
        background: rgba(255,255,255,0.7);
        border-top: 1px solid rgba(0, 122, 255, 0.1);
      }
      .fptu-export-actions {
        display: flex;
        gap: 8px;
      }
      .fptu-export-btn {
        flex: 1;
        padding: 10px 8px;
        background: linear-gradient(135deg, #007AFF 0%, #0066DD 100%);
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
      }
      .fptu-export-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.4);
      }
      .fptu-export-online {
        background: linear-gradient(135deg, #34C759 0%, #28A745 100%);
        box-shadow: 0 2px 8px rgba(52, 199, 89, 0.3);
      }
      .fptu-export-online:hover {
        box-shadow: 0 4px 12px rgba(52, 199, 89, 0.4);
      }
      .fptu-empty {
        text-align: center;
        padding: 40px 20px;
        color: #9ca3af;
        font-size: 13px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      /* Toggle Button */
      #fptu-toggle-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 54px;
        height: 54px;
        background: linear-gradient(135deg, #007AFF 0%, #34C759 100%);
        border: none;
        border-radius: 50%;
        color: white;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(0, 122, 255, 0.4);
        z-index: 999998;
        display: none;
        transition: all 0.2s;
      }
      #fptu-toggle-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 25px rgba(0, 122, 255, 0.5);
      }
    `;
    document.head.appendChild(style);
  }

  function attachPanelEvents(panel) {
    const minimizeBtn = panel.querySelector("#fptu-minimize-btn");
    const closeBtn = panel.querySelector("#fptu-close-btn");
    const resetBtn = panel.querySelector("#fptu-reset-btn");
    
    // Minimize
    minimizeBtn.addEventListener("click", () => {
      panel.classList.toggle("minimized");
      minimizeBtn.textContent = panel.classList.contains("minimized") ? "+" : "−";
    });
    
    // Close
    closeBtn.addEventListener("click", () => {
      panel.style.display = "none";
      showToggleButton();
    });
    
    // Reset all data
    resetBtn.addEventListener("click", () => {
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
    
    examTab.addEventListener("click", () => {
      examTab.classList.add("active");
      weeklyTab.classList.remove("active");
      examSection.classList.add("active");
      weeklySection.classList.remove("active");
    });
    
    weeklyTab.addEventListener("click", () => {
      weeklyTab.classList.add("active");
      examTab.classList.remove("active");
      weeklySection.classList.add("active");
      examSection.classList.remove("active");
    });
    
    // Exam sub-tabs
    const upcomingTab = panel.querySelector("#fptu-upcoming-tab");
    const completedTab = panel.querySelector("#fptu-completed-tab");
    const upcomingList = panel.querySelector("#fptu-upcoming-exams");
    const completedList = panel.querySelector("#fptu-completed-exams");
    
    upcomingTab.addEventListener("click", () => {
      upcomingTab.classList.add("active");
      completedTab.classList.remove("active");
      upcomingList.classList.add("active");
      completedList.classList.remove("active");
    });
    
    completedTab.addEventListener("click", () => {
      completedTab.classList.add("active");
      upcomingTab.classList.remove("active");
      completedList.classList.add("active");
      upcomingList.classList.remove("active");
    });
    
    // Weekly sub-tabs (Offline/Online)
    const offlineTab = panel.querySelector("#fptu-offline-tab");
    const onlineTab = panel.querySelector("#fptu-online-tab");
    const offlineList = panel.querySelector("#fptu-offline-classes");
    const onlineList = panel.querySelector("#fptu-online-classes");
    
    offlineTab.addEventListener("click", () => {
      offlineTab.classList.add("active");
      onlineTab.classList.remove("active");
      offlineList.classList.add("active");
      onlineList.classList.remove("active");
    });
    
    onlineTab.addEventListener("click", () => {
      onlineTab.classList.add("active");
      offlineTab.classList.remove("active");
      onlineList.classList.add("active");
      offlineList.classList.remove("active");
    });
    
    // Sync buttons
    panel.querySelector("#fptu-sync-exam-btn").addEventListener("click", () => {
      if (!isExamPage()) {
        window.location.href = "https://fap.fpt.edu.vn/Exam/ScheduleExams.aspx";
        return;
      }
      syncExamSchedule();
    });
    
    panel.querySelector("#fptu-sync-week-btn").addEventListener("click", () => {
      if (!isWeeklyPage()) {
        window.location.href = "https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx";
        return;
      }
      syncCurrentWeek();
    });
    
    panel.querySelector("#fptu-sync-semester-btn").addEventListener("click", () => {
      if (!isWeeklyPage()) {
        window.location.href = "https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx";
        storage.set("pendingSemesterSync", true);
        return;
      }
      startSemesterSync();
    });
    
    // Export buttons
    panel.querySelector("#fptu-export-exam-btn").addEventListener("click", exportExamICS);
    panel.querySelector("#fptu-export-offline-btn").addEventListener("click", () => exportWeeklyICS(false));
    panel.querySelector("#fptu-export-online-btn").addEventListener("click", () => exportWeeklyICS(true));
    
    // Make panel draggable
    makeDraggable(panel);
  }

  function showToggleButton() {
    let btn = document.getElementById("fptu-toggle-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "fptu-toggle-btn";
      btn.textContent = "📅";
      btn.addEventListener("click", () => {
        const panel = document.getElementById("fptu-scheduler-panel");
        if (panel) {
          panel.style.display = "flex";
          btn.style.display = "none";
        }
      });
      document.body.appendChild(btn);
    }
    btn.style.display = "block";
  }

  function makeDraggable(panel) {
    const header = panel.querySelector(".fptu-panel-header");
    let isDragging = false;
    let offsetX, offsetY;
    
    header.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
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
    const existingKeys = new Set(existing.map(e => `${e.title}-${new Date(e.start).getTime()}`));
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

  // ============ SEMESTER SYNC ============
  let semesterSyncState = null;

  function startSemesterSync() {
    // Get selected semester from dropdown
    const semesterSelect = document.getElementById("fptu-semester-select");
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
    const semesterWeeks = weeks.filter(w => isWeekInSemester(w.text, semester.year, semester));
    
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
    const yearSelect = document.querySelector("#ctl00_mainContent_drpYear");
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
    const weekSelect = document.querySelector("#ctl00_mainContent_drpSelectWeek");
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
    
    // Add to collected events (dedup)
    const existingKeys = new Set(semesterSyncState.collectedEvents.map(e => `${e.title}-${new Date(e.start).getTime()}`));
    events.forEach(e => {
      const key = `${e.title}-${new Date(e.start).getTime()}`;
      if (!existingKeys.has(key)) {
        semesterSyncState.collectedEvents.push(e);
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
    
    const syncBtn = document.getElementById("fptu-sync-semester-btn");
    if (syncBtn) syncBtn.disabled = false;
    
    console.log("Semester sync complete:", events.length, "events");
  }

  function updateProgressUI() {
    if (!semesterSyncState) return;
    
    const progressEl = document.getElementById("fptu-semester-progress");
    const labelEl = document.getElementById("fptu-semester-label");
    const textEl = document.getElementById("fptu-progress-text");
    const fillEl = document.getElementById("fptu-progress-fill");
    const syncBtn = document.getElementById("fptu-sync-semester-btn");
    
    if (progressEl) progressEl.style.display = "block";
    if (labelEl) labelEl.textContent = semesterSyncState.semester.label;
    if (textEl) textEl.textContent = `${semesterSyncState.currentIndex}/${semesterSyncState.weeks.length} tuần`;
    if (fillEl) fillEl.style.width = `${(semesterSyncState.currentIndex / semesterSyncState.weeks.length) * 100}%`;
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

  // ============ RENDER FUNCTIONS ============
  function renderExamList(events) {
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
      const diffDays = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
      
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

  function createExamCard(e, diffDays) {
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
  function isOnlineSubject(subjectCode) {
    if (!subjectCode) return false;
    // Online subjects end with lowercase 'c' after the normal code pattern
    return /^[A-Z]{2,4}\d{2,4}c$/i.test(subjectCode.trim());
  }

  function renderWeeklyList(events) {
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
    const sorted = [...events].sort((a, b) => new Date(a.start) - new Date(b.start));
    
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

  function createClassCard(e, isOnline = false) {
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
    const upcoming = events.filter(e => {
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
    const filtered = events.filter(e => {
      const isOnline = isOnlineSubject(e.title);
      return onlineOnly ? isOnline : !isOnline;
    });
    
    if (!filtered.length) {
      alert(onlineOnly ? "Không có lịch học online." : "Không có lịch học offline.");
      return;
    }
    
    // Include meetUrl in description for online classes
    const eventsWithMeet = filtered.map(e => {
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

  // ============ INITIALIZE ============
  function init() {
    // Only run on FAP pages
    if (!window.location.href.includes("fap.fpt.edu.vn")) return;
    
    console.log("FPTU Scheduler initializing...");
    
    // Create floating panel
    createPanel();
    
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

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
