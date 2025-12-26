// Constants for FPTU Scheduler

import type { SlotTime, SemesterInfo } from './types';

export const SLOT_TIMES: Record<number, SlotTime> = {
  1: { start: "7:00", end: "9:15" },
  2: { start: "9:30", end: "11:45" },
  3: { start: "12:30", end: "14:45" },
  4: { start: "15:00", end: "17:15" },
  5: { start: "17:30", end: "19:45" },
  6: { start: "20:00", end: "22:15" },
  7: { start: "7:00", end: "9:15" },
  8: { start: "9:30", end: "11:45" }
};

// Generate semester options from 2022 to current year + 1
export function getSemesterOptions(): Array<{ label: string; season: string; year: number }> {
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + 1;
  const seasons = ["Spring", "Summer", "Fall"];
  const options: Array<{ label: string; season: string; year: number }> = [];
  
  for (let year = 2022; year <= maxYear; year++) {
    const yearShort = year.toString().slice(-2);
    seasons.forEach(season => {
      options.push({ label: season + yearShort, season, year });
    });
  }
  
  return options;
}

// Parse semester label like "Spring25" into semester info with date ranges
export function getSemesterInfo(semesterLabel: string): SemesterInfo | null {
  const match = semesterLabel.match(/^(Spring|Summer|Fall)(\d{2})$/i);
  if (!match) return null;
  
  const season = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  const yearShort = match[2];
  const year = 2000 + parseInt(yearShort);
  
  let startMonth: number, endMonth: number;
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
export function getDefaultSemester(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const yearShort = now.getFullYear().toString().slice(-2);
  
  let season: string;
  if (month >= 1 && month <= 4) season = "Spring";
  else if (month >= 5 && month <= 8) season = "Summer";
  else season = "Fall";
  
  return season + yearShort;
}

// Check if week overlaps with semester (DD/MM To DD/MM format)
// Include weeks that have ANY overlap with semester range
export function isWeekInSemester(weekText: string, pageYear: number, semester: SemesterInfo): boolean {
  // Format: "DD/MM To DD/MM" (day/month)
  const match = weekText.match(/(\d{1,2})\/(\d{1,2})\s+To\s+(\d{1,2})\/(\d{1,2})/);
  if (!match) return false;
  
  const startDay = parseInt(match[1]);
  const startMonth = parseInt(match[2]);
  const endDay = parseInt(match[3]);
  const endMonth = parseInt(match[4]);
  
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
