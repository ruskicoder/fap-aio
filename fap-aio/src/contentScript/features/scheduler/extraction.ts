// Extraction functions for FPTU Scheduler

import { SLOT_TIMES } from './constants';
import { fmtTime } from './utils';
import type { ScheduleEvent, WeekOption } from './types';

// ============ EXTRACTION FUNCTIONS ============
export function extractExamSchedule(): ScheduleEvent[] {
  try {
    const rows = Array.from(document.querySelectorAll("#ctl00_mainContent_divContent table tr"))
      .slice(1)
      .map(tr => Array.from((tr as HTMLTableRowElement).cells).map(td => td.textContent?.trim() || ""));

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
        
        let tag: string | undefined = undefined;
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

        return { 
          title: code || "Unknown", 
          location: room || "", 
          description: form || "", 
          start, 
          end, 
          tag, 
          type: "exam" as const
        };
      });
  } catch (e) {
    console.error("Exam extraction error:", e);
    return [];
  }
}

export function extractWeeklySchedule(): ScheduleEvent[] {
  try {
    const events: ScheduleEvent[] = [];
    const yearSelect = document.querySelector("#ctl00_mainContent_drpYear") as HTMLSelectElement;
    const year = yearSelect ? parseInt(yearSelect.value) : new Date().getFullYear();
    
    const theadRows = document.querySelectorAll("thead tr");
    const dates: Array<{ day: number; month: number; year: number }> = [];
    
    if (theadRows.length >= 2) {
      const dateRow = theadRows[1];
      dateRow.querySelectorAll("th").forEach(th => {
        const text = th.textContent?.trim() || "";
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
      
      const slotText = cells[0].textContent?.trim() || "";
      const slotMatch = slotText.match(/Slot\s*(\d+)/i);
      if (!slotMatch) return;
      
      const slotNum = parseInt(slotMatch[1]);
      const slotTiming = SLOT_TIMES[slotNum] || SLOT_TIMES[1];
      
      for (let i = 1; i < cells.length && i <= 7; i++) {
        const cell = cells[i];
        const cellText = cell.textContent?.trim() || "";
        if (cellText === "-" || !cellText) continue;
        
        const activityPs = cell.querySelectorAll("p");
        if (activityPs.length === 0) continue;
        
        activityPs.forEach(p => {
          const fullText = p.textContent || "";
          
          let subjectCode = "";
          const firstLink = p.querySelector("a[href*='ActivityDetail']");
          if (firstLink) {
            let linkText = firstLink.textContent?.trim().replace(/-$/, "") || "";
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
          const meetLink = p.querySelector("a[href*='meet.google.com']") as HTMLAnchorElement;
          if (meetLink) meetUrl = meetLink.getAttribute("href") || "";
          
          let startTimeStr = slotTiming.start, endTimeStr = slotTiming.end;
          const timeSpan = p.querySelector(".label-success");
          if (timeSpan) {
            const timeMatch = timeSpan.textContent?.match(/\((\d{1,2}:\d{2})-(\d{1,2}:\d{2})\)/);
            if (timeMatch) { startTimeStr = timeMatch[1]; endTimeStr = timeMatch[2]; }
          }
          
          let status: "attended" | "absent" | "not-yet" = "not-yet";
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
              title: subjectCode, 
              location: room, 
              description: `Slot ${slotNum}`,
              start: startDate, 
              end: endDate, 
              meetUrl, 
              status, 
              slot: slotNum, 
              type: "class" as const
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

export function getWeekOptions(): { weeks: WeekOption[]; currentYear: number } {
  const weekSelect = document.querySelector("#ctl00_mainContent_drpSelectWeek") as HTMLSelectElement;
  const yearSelect = document.querySelector("#ctl00_mainContent_drpYear") as HTMLSelectElement;
  if (!weekSelect) return { weeks: [], currentYear: new Date().getFullYear() };
  
  const weeks: WeekOption[] = [];
  weekSelect.querySelectorAll("option").forEach(opt => {
    const option = opt as HTMLOptionElement;
    weeks.push({ value: option.value, text: option.textContent?.trim() || "", selected: option.selected });
  });
  
  return { weeks, currentYear: yearSelect ? parseInt(yearSelect.value) : new Date().getFullYear() };
}

export function selectWeek(weekValue: string): boolean {
  const weekSelect = document.querySelector("#ctl00_mainContent_drpSelectWeek") as HTMLSelectElement;
  if (!weekSelect) return false;
  if (weekSelect.value === weekValue) return false; // Already on this week
  
  weekSelect.value = weekValue;
  weekSelect.dispatchEvent(new Event("change", { bubbles: true }));
  return true; // Page will reload
}
