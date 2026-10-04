document.addEventListener("DOMContentLoaded", () => {
  const syncButton = document.getElementById("syncButton");
  const syncWeeklyButton = document.getElementById("syncWeeklyButton");
  const exportBtn = document.getElementById("exportBtn");
  const exportWeeklyBtn = document.getElementById("exportWeeklyBtn");
  const settingsButton = document.getElementById("settingsButton");
  const filterModal = document.getElementById("filterModal");
  const closeFilter = document.getElementById("closeFilter");
  const docsLink = document.getElementById("docsLink");
  
  // Main tab switching (Exam vs Weekly)
  const examMainTab = document.getElementById("examMainTab");
  const weeklyMainTab = document.getElementById("weeklyMainTab");
  const examSection = document.getElementById("examSection");
  const weeklySection = document.getElementById("weeklySection");

  if (examMainTab && weeklyMainTab && examSection && weeklySection) {
    examMainTab.addEventListener("click", () => {
      examMainTab.classList.add("active");
      weeklyMainTab.classList.remove("active");
      examSection.classList.add("active");
      weeklySection.classList.remove("active");
    });

    weeklyMainTab.addEventListener("click", () => {
      weeklyMainTab.classList.add("active");
      examMainTab.classList.remove("active");
      weeklySection.classList.add("active");
      examSection.classList.remove("active");
    });
  }

  // Exam sub-tab switching
  const upcomingTab = document.getElementById("upcomingTab");
  const completedTab = document.getElementById("completedTab");
  const upcomingContent = document.getElementById("upcomingExams");
  const completedContent = document.getElementById("completedExams");

  if (upcomingTab && completedTab && upcomingContent && completedContent) {
    upcomingTab.addEventListener("click", () => {
      upcomingTab.classList.add("active");
      completedTab.classList.remove("active");
      upcomingContent.classList.add("active");
      completedContent.classList.remove("active");
    });

    completedTab.addEventListener("click", () => {
      completedTab.classList.add("active");
      upcomingTab.classList.remove("active");
      completedContent.classList.add("active");
      upcomingContent.classList.remove("active");
    });
  }

  // Weekly sub-tab switching
  const thisWeekTab = document.getElementById("thisWeekTab");
  const allClassesTab = document.getElementById("allClassesTab");
  const thisWeekContent = document.getElementById("thisWeekClasses");
  const allClassesContent = document.getElementById("allClasses");

  if (thisWeekTab && allClassesTab && thisWeekContent && allClassesContent) {
    thisWeekTab.addEventListener("click", () => {
      thisWeekTab.classList.add("active");
      allClassesTab.classList.remove("active");
      thisWeekContent.classList.add("active");
      allClassesContent.classList.remove("active");
    });

    allClassesTab.addEventListener("click", () => {
      allClassesTab.classList.add("active");
      thisWeekTab.classList.remove("active");
      allClassesContent.classList.add("active");
      thisWeekContent.classList.remove("active");
    });
  }

  // Load filter preferences
  const filterPrefs = JSON.parse(localStorage.getItem("examFilter") || '{"FE":true,"PE":true,"2NDFE":true,"2NDPE":true}');
  
  // Set initial filter states
  if (document.getElementById("filterFE")) {
    document.getElementById("filterFE").checked = filterPrefs.FE;
    document.getElementById("filterPE").checked = filterPrefs.PE;
    document.getElementById("filter2NDFE").checked = filterPrefs["2NDFE"];
    document.getElementById("filter2NDPE").checked = filterPrefs["2NDPE"];
  }

  // Filter modal events
  if (settingsButton && filterModal) {
    settingsButton.addEventListener("click", () => {
      filterModal.style.display = "block";
    });
  }

  if (closeFilter && filterModal) {
    closeFilter.addEventListener("click", () => {
      filterModal.style.display = "none";
    });
  }

  // Close modal when clicking outside
  if (filterModal) {
    filterModal.addEventListener("click", (e) => {
      if (e.target === filterModal) {
        filterModal.style.display = "none";
      }
    });
  }

  // Remove the immediate filter change events - comment them out completely
  // ["filterFE", "filterPE", "filter2NDFE", "filter2NDPE"].forEach(id => {
  //   const element = document.getElementById(id);
  //   if (element) {
  //     element.addEventListener("change", () => {
  //       saveFilterPrefs();
  //       applyFilters();
  //     });
  //   }
  // });

  // Select/Deselect all buttons
  const selectAllBtn = document.getElementById("selectAll");
  const deselectAllBtn = document.getElementById("deselectAll");
  const applyFilterBtn = document.getElementById("applyFilter");
  
  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", () => {
      ["filterFE", "filterPE", "filter2NDFE", "filter2NDPE"].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.checked = true;
      });
    });
  }

  if (deselectAllBtn) {
    deselectAllBtn.addEventListener("click", () => {
      ["filterFE", "filterPE", "filter2NDFE", "filter2NDPE"].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.checked = false;
      });
    });
  }

  if (applyFilterBtn) {
    applyFilterBtn.addEventListener("click", () => {
      console.log("Apply filter clicked"); // Debug log
      saveFilterPrefs();
      applyFilters();
      filterModal.style.display = "none";
    });
  }

  function saveFilterPrefs() {
    const prefs = {
      FE: document.getElementById("filterFE")?.checked || false,
      PE: document.getElementById("filterPE")?.checked || false,
      "2NDFE": document.getElementById("filter2NDFE")?.checked || false,
      "2NDPE": document.getElementById("filter2NDPE")?.checked || false
    };
    console.log("Saving filter prefs:", prefs); // Debug log
    localStorage.setItem("examFilter", JSON.stringify(prefs));
  }

  function applyFilters() {
    console.log("Applying filters"); // Debug log
    const upcomingItems = document.querySelectorAll("#upcomingExams .exam-item");
    const completedItems = document.querySelectorAll("#completedExams .exam-item");
    const activeFilters = JSON.parse(localStorage.getItem("examFilter") || '{"FE":true,"PE":true,"2NDFE":true,"2NDPE":true}');
    console.log("Active filters:", activeFilters); // Debug log
    
    // Apply filters to both upcoming and completed tabs
    [...upcomingItems, ...completedItems].forEach(item => {
      const examCard = item.querySelector(".exam-card");
      const tags = examCard.querySelectorAll(".tag");
      let examType = null;
      
      // Check for exam type tags
      tags.forEach(tag => {
        if (tag.classList.contains("fe")) examType = "FE";
        else if (tag.classList.contains("pe")) examType = "PE";
        else if (tag.classList.contains("secondfe")) examType = "2NDFE";
        else if (tag.classList.contains("secondpe")) examType = "2NDPE";
      });
      
      // If no specific exam type found, try to determine from tag text
      if (!examType) {
        tags.forEach(tag => {
          const tagText = tag.textContent.trim();
          if (tagText === "FE") examType = "FE";
          else if (tagText === "PE") examType = "PE";
          else if (tagText === "2NDFE") examType = "2NDFE";
          else if (tagText === "2NDPE") examType = "2NDPE";
        });
      }
      
      console.log("Exam type found:", examType, "Should show:", !examType || activeFilters[examType]); // Debug log
      
      // Show if no exam type found or if exam type is enabled
      if (!examType || activeFilters[examType]) {
        item.style.display = "block";
      } else {
        item.style.display = "none";
      }
    });
  }

  // Make applyFilters available globally
  window.applyFilters = applyFilters;

  if (syncButton) {
    syncButton.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://fap.fpt.edu.vn/Exam/ScheduleExams.aspx" });
    });
  }

  // Weekly schedule sync button
  if (syncWeeklyButton) {
    syncWeeklyButton.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx" });
    });
  }

  // Semester sync button - syncs all weeks in current semester
  const syncSemesterButton = document.getElementById("syncSemesterButton");
  if (syncSemesterButton) {
    syncSemesterButton.addEventListener("click", () => {
      startSemesterSync();
    });
  }

  // Check if there's a semester sync in progress on popup open
  chrome.storage.local.get(["semesterSyncState"], (result) => {
    if (result.semesterSyncState && result.semesterSyncState.inProgress) {
      // Show progress UI
      updateSemesterProgressUI(result.semesterSyncState);
    }
  });

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      // Get stored exam data instead of requiring FAP page
      const storedData = localStorage.getItem("examSchedule");
      
      if (!storedData) {
        alert("Chưa có dữ liệu lịch thi. Vui lòng truy cập trang FAP và nhấn Sync để tải dữ liệu.");
        return;
      }

      let events;
      try {
        events = JSON.parse(storedData);
      } catch (e) {
        console.error("Parse stored data failed:", e);
        alert("Dữ liệu lịch thi bị lỗi. Vui lòng sync lại từ trang FAP.");
        return;
      }

      if (!events || !events.length) {
        alert("Không có lịch thi nào để xuất.");
        return;
      }

      const ICS = function (uid = "fptu", prod = "examination") {
        const SEPARATOR = '\r\n';
        let eventsData = [];
        const calendarStart = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:' + prod,
          'CALSCALE:GREGORIAN'
        ].join(SEPARATOR);
        const calendarEnd = 'END:VCALENDAR';

        return {
          addEvent: function (title, desc, loc, start, end) {
            const now = new Date();
            const fmt = d => {
              let s = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z';
              if (s.endsWith('ZZ')) s = s.slice(0, -1);
              return s;
            };
            let stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z';
            if (stamp.endsWith('ZZ')) stamp = stamp.slice(0, -1);
            const uidStr = fmt(now) + '-' + Math.random().toString(36).substring(2, 8) + '@' + prod;
            eventsData.push([
              'BEGIN:VEVENT',
              'UID:' + uidStr,
              'DTSTAMP:' + stamp,
              'DTSTART:' + fmt(start),
              'DTEND:' + fmt(end),
              'SUMMARY:' + title,
              'DESCRIPTION:' + desc,
              'LOCATION:' + loc,
              'BEGIN:VALARM',
              'TRIGGER:-P1D',
              'ACTION:DISPLAY',
              'DESCRIPTION:Nhắc nhở: Thi vào ngày mai',
              'END:VALARM',
              'BEGIN:VALARM',
              'TRIGGER:-PT1H',
              'ACTION:DISPLAY',
              'DESCRIPTION:Nhắc nhở: Thi trong 1 giờ nữa',
              'END:VALARM',
              'END:VEVENT'
            ].join(SEPARATOR));
          },
          build: function () {
            return calendarStart + SEPARATOR + eventsData.join(SEPARATOR) + SEPARATOR + calendarEnd;
          }
        };
      };

      const cal = new ICS();
      let validEventsCount = 0;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      events.forEach(e => {
        // Check if exam is upcoming (not completed)
        const start = new Date(e.start);
        const examDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const diffTime = examDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Skip completed exams
        if (diffDays < 0) {
          return; // Skip past exams
        }

        // Skip exams without room number (not scheduled for retake)
        if (!e.location || 
            e.location.trim() === "" || 
            e.location.toLowerCase().includes("chưa có") ||
            e.location.toLowerCase().includes("chưa rõ") ||
            e.location.toLowerCase() === "tba" ||
            e.location.toLowerCase() === "to be announced") {
          return; // Skip this exam
        }

        let title = e.title;
     
        if (e.tag) {
          title += ' - ' + e.tag;
        } else {
          if (/2nd_fe/i.test(e.description)) title += ' - 2NDFE';
          else if (/practical_exam/i.test(e.description)) title += ' - PE';
          else if (/multiple_choices|final|fe/i.test(e.description)) title += ' - FE';
        }

        cal.addEvent(title, e.description, e.location, new Date(e.start), new Date(e.end));
        validEventsCount++;
      });

      if (validEventsCount === 0) {
        alert("Không có kỳ thi nào sắp tới và có phòng để xuất ra file .ics");
        return;
      }

      const blob = new Blob([cal.build()], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', 'lich-thi.ics');
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });
  }

  // Weekly schedule export handler
  if (exportWeeklyBtn) {
    exportWeeklyBtn.addEventListener("click", () => {
      const storedData = localStorage.getItem("weeklySchedule");
      
      if (!storedData) {
        alert("Chưa có dữ liệu lịch học. Vui lòng truy cập trang FAP và nhấn Sync để tải dữ liệu.");
        return;
      }

      let events;
      try {
        events = JSON.parse(storedData);
      } catch (e) {
        console.error("Parse weekly data failed:", e);
        alert("Dữ liệu lịch học bị lỗi. Vui lòng sync lại từ trang FAP.");
        return;
      }

      if (!events || !events.length) {
        alert("Không có lịch học nào để xuất.");
        return;
      }

      const ICS = function (uid = "fptu", prod = "weekly") {
        const SEPARATOR = '\r\n';
        let eventsData = [];
        const calendarStart = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:' + prod,
          'CALSCALE:GREGORIAN'
        ].join(SEPARATOR);
        const calendarEnd = 'END:VCALENDAR';

        return {
          addEvent: function (title, desc, loc, start, end, meetUrl) {
            const now = new Date();
            const fmt = d => {
              let s = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z';
              if (s.endsWith('ZZ')) s = s.slice(0, -1);
              return s;
            };
            let stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z';
            if (stamp.endsWith('ZZ')) stamp = stamp.slice(0, -1);
            const uidStr = fmt(now) + '-' + Math.random().toString(36).substring(2, 8) + '@' + prod;
            
            let eventLines = [
              'BEGIN:VEVENT',
              'UID:' + uidStr,
              'DTSTAMP:' + stamp,
              'DTSTART:' + fmt(start),
              'DTEND:' + fmt(end),
              'SUMMARY:' + title,
              'DESCRIPTION:' + (meetUrl ? desc + '\\nMeet: ' + meetUrl : desc),
              'LOCATION:' + loc
            ];
            
            // Add 15 min reminder for classes
            eventLines.push(
              'BEGIN:VALARM',
              'TRIGGER:-PT15M',
              'ACTION:DISPLAY',
              'DESCRIPTION:Lớp học bắt đầu trong 15 phút',
              'END:VALARM'
            );
            
            eventLines.push('END:VEVENT');
            eventsData.push(eventLines.join(SEPARATOR));
          },
          build: function () {
            return calendarStart + SEPARATOR + eventsData.join(SEPARATOR) + SEPARATOR + calendarEnd;
          }
        };
      };

      const cal = new ICS();
      let validEventsCount = 0;
      
      events.forEach(e => {
        if (!e.title) return;
        
        const title = e.title;
        const desc = e.description || '';
        const loc = e.location || '';
        
        cal.addEvent(title, desc, loc, new Date(e.start), new Date(e.end), e.meetUrl);
        validEventsCount++;
      });

      if (validEventsCount === 0) {
        alert("Không có lớp học nào để xuất ra file .ics");
        return;
      }

      const blob = new Blob([cal.build()], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', 'lich-hoc.ics');
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });
  }


  setTimeout(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs[0] && tabs[0].url) {
        if (tabs[0].url.includes("https://fap.fpt.edu.vn/Exam/ScheduleExams.aspx")) {
          autoSyncSchedule();
        } else if (tabs[0].url.includes("https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx")) {
          autoSyncWeeklySchedule();
          // Switch to weekly tab
          if (weeklyMainTab && examSection && weeklySection) {
            weeklyMainTab.classList.add("active");
            examMainTab.classList.remove("active");
            weeklySection.classList.add("active");
            examSection.classList.remove("active");
          }
        }
      }
    });
  }, 100);

  // Load stored exam data
  const data = localStorage.getItem("examSchedule");
  if (data) {
    try {
      renderExamList(JSON.parse(data));
    } catch (e) {
      console.error("Parse failed:", e);
    }
  }

  // Load stored weekly data
  const weeklyData = localStorage.getItem("weeklySchedule");
  if (weeklyData) {
    try {
      renderWeeklyList(JSON.parse(weeklyData));
    } catch (e) {
      console.error("Parse weekly failed:", e);
    }
  }

  // Documentation link event
  if (docsLink) {
    docsLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: "https://yunkhngn.github.io/fptu-examination/" });
    });
  }
});

// Auto-sync weekly schedule
function autoSyncWeeklySchedule() {
  const loadingEl = document.querySelector(".weekly-loading");
  const errorEl = document.querySelector("#weeklySection .error");

  if (loadingEl) loadingEl.style.display = "block";
  if (errorEl) errorEl.style.display = "none";

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || !tabs[0]) return;
    
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ["content.js"]
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.error('Script injection failed:', chrome.runtime.lastError);
        if (loadingEl) loadingEl.style.display = "none";
        if (errorEl) errorEl.style.display = "block";
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, { action: "extractWeeklySchedule" }, function (response) {
        if (loadingEl) loadingEl.style.display = "none";
        if (chrome.runtime.lastError) {
          console.error('Message sending failed:', chrome.runtime.lastError);
          if (errorEl) errorEl.style.display = "block";
          return;
        }
        if (!response || !response.events) {
          if (errorEl) errorEl.style.display = "block";
          return;
        }
        localStorage.setItem("weeklySchedule", JSON.stringify(response.events));
        renderWeeklyList(response.events);
      });
    });
  });
}

// Auto-sync exam schedule
function autoSyncSchedule() {
  const loadingEl = document.querySelector(".exam-loading");
  const errorEl = document.querySelector("#examSection .error");

  if (loadingEl) loadingEl.style.display = "block";
  if (errorEl) errorEl.style.display = "none";

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || !tabs[0]) return;
    
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ["content.js"]
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.error('Script injection failed:', chrome.runtime.lastError);
        if (loadingEl) loadingEl.style.display = "none";
        if (errorEl) errorEl.style.display = "block";
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, { action: "extractSchedule" }, function (response) {
        if (loadingEl) loadingEl.style.display = "none";
        if (chrome.runtime.lastError) {
          console.error('Message sending failed:', chrome.runtime.lastError);
          if (errorEl) errorEl.style.display = "block";
          return;
        }
        if (!response || !response.events) {
          if (errorEl) errorEl.style.display = "block";
          return;
        }
        localStorage.setItem("examSchedule", JSON.stringify(response.events));

        renderExamList(response.events);
      });
    });
  });
}

function renderExamList(events) {
  const upcomingContainer = document.getElementById("upcomingExams");
  const completedContainer = document.getElementById("completedExams");
  const loadingEl = document.querySelector(".loading");
  const errorEl = document.querySelector(".error");
  
  // Hide loading/error elements
  if (loadingEl) loadingEl.style.display = "none";
  if (errorEl) errorEl.style.display = "none";
  
  if (!upcomingContainer || !completedContainer) return;

  // Clear both containers safely
  while (upcomingContainer.firstChild) {
    upcomingContainer.removeChild(upcomingContainer.firstChild);
  }
  while (completedContainer.firstChild) {
    completedContainer.removeChild(completedContainer.firstChild);
  }
  
  if (!events.length) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error";
    errorDiv.textContent = "Không có lịch thi nào.";
    upcomingContainer.appendChild(errorDiv);
    return;
  }

  // Separate upcoming and completed exams
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const upcomingExams = [];
  const completedExams = [];

  events.forEach(e => {
    const start = new Date(e.start);
    const examDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const diffTime = examDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      completedExams.push(e);
    } else {
      upcomingExams.push(e);
    }
  });

  // Render upcoming exams
  if (upcomingExams.length === 0) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error";
    errorDiv.textContent = "Không có kỳ thi nào sắp tới.";
    upcomingContainer.appendChild(errorDiv);
  } else {
    upcomingExams.forEach(e => {
      const examItem = createExamItem(e);
      upcomingContainer.appendChild(examItem);
    });
  }

  // Render completed exams
  if (completedExams.length === 0) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error";
    errorDiv.textContent = "Không có kỳ thi nào đã hoàn thành.";
    completedContainer.appendChild(errorDiv);
  } else {
    completedExams.forEach(e => {
      const examItem = createExamItem(e);
      completedContainer.appendChild(examItem);
    });
  }

  // Update tab labels with counts
  const upcomingTab = document.getElementById("upcomingTab");
  const completedTab = document.getElementById("completedTab");
  
  if (upcomingTab) upcomingTab.textContent = `📅 Chưa thi (${upcomingExams.length})`;
  if (completedTab) completedTab.textContent = `✅ Đã thi (${completedExams.length})`;
  
  // Apply filters after rendering
  setTimeout(() => {
    if (window.applyFilters) {
      window.applyFilters();
    }
  }, 100);
}

function createExamItem(e) {
  const desc = (e.description + ' ' + e.title).toLowerCase();
  const examType = (e.examType || "").toLowerCase();
  const tagType = (() => {
    if (e.tag) {
      return e.tag; 
    }
    
    const tag = (examType || "").toLowerCase();
    if (tag.includes("2ndfe") || desc.includes("2ndfe") || desc.includes("2nd fe")) return "2NDFE";
    if (tag.includes("2ndpe") || desc.includes("2ndpe") || desc.includes("2nd pe")) return "2NDPE";
    if (tag === "pe" || desc.includes("practical_exam") || desc.includes("project presentation")) return "PE";
    if (tag === "fe" || desc.includes("fe") || desc.includes("final") || desc.includes("multiple_choices") || desc.includes("speaking")) return "FE";
    return null;
  })();

  const row = document.createElement("div");
  row.className = "exam-item";

  const start = new Date(e.start);
  const end = new Date(e.end);
  const formatTime = d => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const formatDate = d => d.toLocaleDateString("vi-VN");

  // Calculate days remaining
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const examDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffTime = examDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Create exam card structure safely
  const examCard = document.createElement("div");
  examCard.className = "exam-card";

  const examHeader = document.createElement("div");
  examHeader.className = "exam-header";

  const examTitle = document.createElement("div");
  examTitle.className = "exam-title";
  examTitle.textContent = e.title + " ";

  // Add tags safely
  if (tagType) {
    const tagSpan = document.createElement("span");
    tagSpan.className = "tag";
    if (tagType === "2NDFE") {
      tagSpan.classList.add("secondfe");
      tagSpan.textContent = "2NDFE";
    } else if (tagType === "2NDPE") {
      tagSpan.classList.add("secondpe");
      tagSpan.textContent = "2NDPE";
    } else if (tagType === "PE") {
      tagSpan.classList.add("pe");
      tagSpan.textContent = "PE";
    } else if (tagType === "FE") {
      tagSpan.classList.add("fe");
      tagSpan.textContent = "FE";
    }
    examTitle.appendChild(tagSpan);
    examTitle.appendChild(document.createTextNode(" "));
  }

  // Add countdown tag safely
  const countdownSpan = document.createElement("span");
  countdownSpan.className = "tag countdown";
  if (diffDays < 0) {
    countdownSpan.classList.add("past");
    countdownSpan.textContent = "Đã thi";
  } else if (diffDays === 0) {
    countdownSpan.classList.add("today");
    countdownSpan.textContent = "Hôm nay";
  } else if (diffDays === 1) {
    countdownSpan.classList.add("tomorrow");
    countdownSpan.textContent = "Ngày mai";
  } else if (diffDays <= 3) {
    countdownSpan.classList.add("urgent");
    countdownSpan.textContent = "Còn " + diffDays + " ngày";
  } else {
    countdownSpan.classList.add("future");
    countdownSpan.textContent = "Còn " + diffDays + " ngày";
  }
  examTitle.appendChild(countdownSpan);

  examHeader.appendChild(examTitle);
  examCard.appendChild(examHeader);

  // Create exam details safely
  const examDetail = document.createElement("div");
  examDetail.className = "exam-detail";

  const createDetailLine = (label, value) => {
    const line = document.createElement("div");
    line.className = "line";
    
    const labelSpan = document.createElement("span");
    labelSpan.className = "label";
    const strong = document.createElement("strong");
    strong.textContent = label + ":";
    labelSpan.appendChild(strong);
    
    line.appendChild(labelSpan);
    line.appendChild(document.createTextNode(" " + value));
    return line;
  };

  examDetail.appendChild(createDetailLine("Phương thức", e.description || "Chưa rõ"));
  examDetail.appendChild(createDetailLine("Phòng", e.location || "Chưa rõ"));
  examDetail.appendChild(createDetailLine("Ngày thi", formatDate(start)));
  examDetail.appendChild(createDetailLine("Thời gian", formatTime(start) + " - " + formatTime(end)));

  examCard.appendChild(examDetail);
  row.appendChild(examCard);
  
  return row;
}

// Render weekly schedule list
function renderWeeklyList(events) {
  const thisWeekContainer = document.getElementById("thisWeekClasses");
  const allClassesContainer = document.getElementById("allClasses");
  const loadingEl = document.querySelector(".weekly-loading");
  const errorEl = document.querySelector("#weeklySection .error");
  
  // Hide loading/error elements
  if (loadingEl) loadingEl.style.display = "none";
  if (errorEl) errorEl.style.display = "none";
  
  if (!thisWeekContainer || !allClassesContainer) return;

  // Clear both containers safely
  while (thisWeekContainer.firstChild) {
    thisWeekContainer.removeChild(thisWeekContainer.firstChild);
  }
  while (allClassesContainer.firstChild) {
    allClassesContainer.removeChild(allClassesContainer.firstChild);
  }
  
  if (!events.length) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error";
    errorDiv.textContent = "Không có lịch học nào.";
    thisWeekContainer.appendChild(errorDiv);
    return;
  }

  // Calculate this week bounds
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Get start of this week (Monday)
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + diff);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const thisWeekEvents = [];
  const allEvents = [];

  events.forEach(e => {
    const start = new Date(e.start);
    const eventDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    
    allEvents.push(e);
    
    if (eventDate >= weekStart && eventDate <= weekEnd) {
      thisWeekEvents.push(e);
    }
  });

  // Render this week classes
  if (thisWeekEvents.length === 0) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error";
    errorDiv.textContent = "Không có lớp học nào trong tuần này.";
    thisWeekContainer.appendChild(errorDiv);
  } else {
    // Sort by date/time
    thisWeekEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
    thisWeekEvents.forEach(e => {
      const classItem = createClassItem(e);
      thisWeekContainer.appendChild(classItem);
    });
  }

  // Render all classes
  if (allEvents.length === 0) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error";
    errorDiv.textContent = "Không có lớp học nào.";
    allClassesContainer.appendChild(errorDiv);
  } else {
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
    allEvents.forEach(e => {
      const classItem = createClassItem(e);
      allClassesContainer.appendChild(classItem);
    });
  }

  // Update tab labels with counts
  const thisWeekTab = document.getElementById("thisWeekTab");
  const allClassesTab = document.getElementById("allClassesTab");
  
  if (thisWeekTab) thisWeekTab.textContent = `📅 Tuần này (${thisWeekEvents.length})`;
  if (allClassesTab) allClassesTab.textContent = `📚 Tất cả (${allEvents.length})`;
}

function createClassItem(e) {
  const row = document.createElement("div");
  row.className = "class-item";

  const start = new Date(e.start);
  const end = new Date(e.end);
  const formatTime = d => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const formatDate = d => d.toLocaleDateString("vi-VN", { weekday: 'short', day: '2-digit', month: '2-digit' });

  // Create class card structure
  const classCard = document.createElement("div");
  classCard.className = "class-card";

  const classHeader = document.createElement("div");
  classHeader.className = "class-header";

  const classTitle = document.createElement("div");
  classTitle.className = "class-title";
  classTitle.textContent = e.title + " ";

  // Add slot tag
  if (e.slot) {
    const slotTag = document.createElement("span");
    slotTag.className = "tag slot";
    slotTag.textContent = "Slot " + e.slot;
    classTitle.appendChild(slotTag);
    classTitle.appendChild(document.createTextNode(" "));
  }

  // Add status tag
  if (e.status) {
    const statusTag = document.createElement("span");
    statusTag.className = "tag status";
    if (e.status === "attended") {
      statusTag.classList.add("attended");
      statusTag.textContent = "✓ Đã điểm danh";
    } else if (e.status === "absent") {
      statusTag.classList.add("absent");
      statusTag.textContent = "✗ Vắng";
    } else {
      statusTag.classList.add("not-yet");
      statusTag.textContent = "Chưa điểm danh";
    }
    classTitle.appendChild(statusTag);
  }

  classHeader.appendChild(classTitle);
  classCard.appendChild(classHeader);

  // Create class details
  const classDetail = document.createElement("div");
  classDetail.className = "class-detail";

  const createDetailLine = (label, value) => {
    const line = document.createElement("div");
    line.className = "line";
    
    const labelSpan = document.createElement("span");
    labelSpan.className = "label";
    labelSpan.textContent = label + ":";
    
    line.appendChild(labelSpan);
    line.appendChild(document.createTextNode(" " + value));
    return line;
  };

  classDetail.appendChild(createDetailLine("Phòng", e.location || "Chưa rõ"));
  classDetail.appendChild(createDetailLine("Ngày", formatDate(start)));
  classDetail.appendChild(createDetailLine("Giờ", formatTime(start) + " - " + formatTime(end)));

  // Add Meet URL if available
  if (e.meetUrl) {
    const meetLine = document.createElement("div");
    meetLine.className = "line";
    
    const meetLink = document.createElement("a");
    meetLink.href = e.meetUrl;
    meetLink.className = "meet-btn";
    meetLink.target = "_blank";
    meetLink.textContent = "📹 Google Meet";
    meetLine.appendChild(meetLink);
    
    classDetail.appendChild(meetLine);
  }

  classCard.appendChild(classDetail);
  row.appendChild(classCard);
  
  return row;
}

// ============ SEMESTER SYNC FUNCTIONS ============

/**
 * Get current semester info based on local date
 * Spring: 01/01 - 30/04
 * Summer: 01/05 - 31/08
 * Fall: 01/09 - 31/12
 */
function getCurrentSemester() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  const yearShort = year.toString().slice(-2);
  
  let season, startMonth, endMonth;
  
  if (month >= 1 && month <= 4) {
    season = "Spring";
    startMonth = 1;
    endMonth = 4;
  } else if (month >= 5 && month <= 8) {
    season = "Summer";
    startMonth = 5;
    endMonth = 8;
  } else {
    season = "Fall";
    startMonth = 9;
    endMonth = 12;
  }
  
  return {
    label: season + yearShort,
    season,
    year,
    yearShort,
    startDate: new Date(year, startMonth - 1, 1),
    endDate: new Date(year, endMonth, 0) // Last day of end month
  };
}

/**
 * Check if a week date range falls within semester
 * @param {string} weekText - Format: "DD/MM To DD/MM"
 * @param {number} year
 * @param {object} semester
 */
function isWeekInSemester(weekText, year, semester) {
  // Parse "05/01 To 11/01" format
  const match = weekText.match(/(\d{2})\/(\d{2})\s+To\s+(\d{2})\/(\d{2})/);
  if (!match) return false;
  
  const [_, startDay, startMonth, endDay, endMonth] = match;
  
  // Handle year wraparound (e.g., week starting in December ending in January)
  let startYear = year;
  let endYear = year;
  
  // If end month is less than start month, it spans into next year
  if (parseInt(endMonth) < parseInt(startMonth)) {
    endYear = year + 1;
  }
  
  const weekStart = new Date(startYear, parseInt(startMonth) - 1, parseInt(startDay));
  const weekEnd = new Date(endYear, parseInt(endMonth) - 1, parseInt(endDay));
  
  // Check if week overlaps with semester
  return weekEnd >= semester.startDate && weekStart <= semester.endDate;
}

/**
 * Start the semester sync process
 */
function startSemesterSync() {
  const semester = getCurrentSemester();
  
  // Show progress UI
  const progressDiv = document.getElementById("semesterSyncProgress");
  const semesterLabel = document.getElementById("semesterLabel");
  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");
  const syncBtn = document.getElementById("syncSemesterButton");
  
  if (progressDiv) progressDiv.style.display = "block";
  if (semesterLabel) semesterLabel.textContent = semester.label;
  if (progressText) progressText.textContent = "Đang tải...";
  if (progressFill) progressFill.style.width = "0%";
  if (syncBtn) syncBtn.disabled = true;
  
  // Open the weekly schedule page and start sync
  chrome.tabs.create({ url: "https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx" }, (tab) => {
    // Store sync state
    const syncState = {
      inProgress: true,
      tabId: tab.id,
      semester: semester,
      currentWeekIndex: 0,
      weeksToSync: [],
      collectedEvents: [],
      startTime: Date.now()
    };
    
    chrome.storage.local.set({ semesterSyncState: syncState });
    
    // Wait for page to load, then start extraction
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Give page a moment to fully render
        setTimeout(() => {
          initializeSemesterSync(tab.id, semester);
        }, 1000);
      }
    });
  });
}

/**
 * Initialize semester sync by getting week options
 */
function initializeSemesterSync(tabId, semester) {
  // Inject content script and get week options
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ["content.js"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("Script injection failed:", chrome.runtime.lastError);
      finishSemesterSync(false, "Không thể kết nối với trang FAP");
      return;
    }
    
    chrome.tabs.sendMessage(tabId, { action: "getWeekOptions" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.weeks) {
        console.error("Failed to get week options:", chrome.runtime.lastError);
        finishSemesterSync(false, "Không thể lấy danh sách tuần");
        return;
      }
      
      const { weeks, currentYear } = response;
      
      // Filter weeks that fall within the semester
      const semesterWeeks = weeks.filter(w => isWeekInSemester(w.text, currentYear, semester));
      
      if (semesterWeeks.length === 0) {
        finishSemesterSync(false, "Không tìm thấy tuần trong học kỳ " + semester.label);
        return;
      }
      
      // Update sync state with weeks to process
      chrome.storage.local.get(["semesterSyncState"], (result) => {
        const state = result.semesterSyncState || {};
        state.weeksToSync = semesterWeeks;
        state.totalWeeks = semesterWeeks.length;
        state.currentYear = currentYear;
        
        chrome.storage.local.set({ semesterSyncState: state }, () => {
          updateSemesterProgressUI(state);
          // Start processing first week
          processNextWeek(tabId);
        });
      });
    });
  });
}

/**
 * Process the next week in the sync queue
 */
function processNextWeek(tabId) {
  chrome.storage.local.get(["semesterSyncState"], (result) => {
    const state = result.semesterSyncState;
    if (!state || !state.inProgress) return;
    
    const weekIndex = state.currentWeekIndex;
    const week = state.weeksToSync[weekIndex];
    
    if (!week) {
      // All weeks processed
      finishSemesterSync(true);
      return;
    }
    
    // Update UI
    updateSemesterProgressUI(state);
    
    // Send message to change week and extract
    chrome.tabs.sendMessage(tabId, { 
      action: "selectWeekAndExtract", 
      weekValue: week.value 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Week extraction error:", chrome.runtime.lastError);
        // Try to continue with next week
        advanceToNextWeek(tabId);
        return;
      }
      
      if (response && response.needsReload) {
        // Page will reload, set up listener
        chrome.tabs.onUpdated.addListener(function listener(tid, changeInfo) {
          if (tid === tabId && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            
            // Wait for page to settle
            setTimeout(() => {
              extractCurrentWeekData(tabId);
            }, 1500);
          }
        });
      } else if (response && response.events) {
        // Got events directly (no reload needed)
        saveWeekEvents(response.events, tabId);
      }
    });
  });
}

/**
 * Extract data from current week after page reload
 */
function extractCurrentWeekData(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ["content.js"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("Re-injection failed:", chrome.runtime.lastError);
      advanceToNextWeek(tabId);
      return;
    }
    
    chrome.tabs.sendMessage(tabId, { action: "extractWeeklySchedule" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        console.error("Extraction failed:", chrome.runtime.lastError);
        advanceToNextWeek(tabId);
        return;
      }
      
      saveWeekEvents(response.events || [], tabId);
    });
  });
}

/**
 * Save extracted events and move to next week
 */
function saveWeekEvents(events, tabId) {
  chrome.storage.local.get(["semesterSyncState"], (result) => {
    const state = result.semesterSyncState;
    if (!state) return;
    
    // Add events to collected list (avoid duplicates by checking start time + title)
    const existingKeys = new Set(
      state.collectedEvents.map(e => `${e.title}-${new Date(e.start).getTime()}`)
    );
    
    events.forEach(event => {
      const key = `${event.title}-${new Date(event.start).getTime()}`;
      if (!existingKeys.has(key)) {
        state.collectedEvents.push(event);
        existingKeys.add(key);
      }
    });
    
    state.currentWeekIndex++;
    
    chrome.storage.local.set({ semesterSyncState: state }, () => {
      updateSemesterProgressUI(state);
      
      if (state.currentWeekIndex >= state.weeksToSync.length) {
        finishSemesterSync(true);
      } else {
        // Continue to next week
        processNextWeek(tabId);
      }
    });
  });
}

/**
 * Advance to next week on error
 */
function advanceToNextWeek(tabId) {
  chrome.storage.local.get(["semesterSyncState"], (result) => {
    const state = result.semesterSyncState;
    if (!state) return;
    
    state.currentWeekIndex++;
    chrome.storage.local.set({ semesterSyncState: state }, () => {
      if (state.currentWeekIndex >= state.weeksToSync.length) {
        finishSemesterSync(true);
      } else {
        processNextWeek(tabId);
      }
    });
  });
}

/**
 * Finish the semester sync process
 */
function finishSemesterSync(success, errorMessage) {
  chrome.storage.local.get(["semesterSyncState"], (result) => {
    const state = result.semesterSyncState || {};
    
    if (success && state.collectedEvents && state.collectedEvents.length > 0) {
      // Save collected events to localStorage
      localStorage.setItem("weeklySchedule", JSON.stringify(state.collectedEvents));
      
      // Update UI
      renderWeeklyList(state.collectedEvents);
    }
    
    // Clear sync state
    chrome.storage.local.remove("semesterSyncState");
    
    // Update UI
    const progressDiv = document.getElementById("semesterSyncProgress");
    const syncBtn = document.getElementById("syncSemesterButton");
    const loadingEl = document.querySelector(".weekly-loading");
    
    if (progressDiv) progressDiv.style.display = "none";
    if (syncBtn) syncBtn.disabled = false;
    if (loadingEl) loadingEl.style.display = "none";
    
    if (success) {
      const eventCount = state.collectedEvents ? state.collectedEvents.length : 0;
      console.log(`Semester sync complete: ${eventCount} events`);
    } else {
      alert(errorMessage || "Đồng bộ thất bại");
    }
  });
}

/**
 * Update progress UI
 */
function updateSemesterProgressUI(state) {
  const progressDiv = document.getElementById("semesterSyncProgress");
  const semesterLabel = document.getElementById("semesterLabel");
  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");
  
  if (!progressDiv) return;
  
  progressDiv.style.display = "block";
  
  if (semesterLabel && state.semester) {
    semesterLabel.textContent = state.semester.label;
  }
  
  const total = state.totalWeeks || state.weeksToSync?.length || 0;
  const current = state.currentWeekIndex || 0;
  
  if (progressText) {
    progressText.textContent = `${current}/${total} tuần`;
  }
  
  if (progressFill && total > 0) {
    const percent = Math.round((current / total) * 100);
    progressFill.style.width = percent + "%";
  }
}