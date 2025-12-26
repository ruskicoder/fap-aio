// Type definitions for FPTU Scheduler

export interface ScheduleEvent {
  title: string;
  location: string;
  description: string;
  start: Date;
  end: Date;
  tag?: string;
  type: "exam" | "class";
  meetUrl?: string;
  status?: "attended" | "absent" | "not-yet";
  slot?: number;
}

export interface WeekOption {
  value: string;
  text: string;
  selected: boolean;
}

export interface SemesterInfo {
  label: string;
  season: string;
  year: number;
  yearShort: string;
  startDate: Date;
  endDate: Date;
}

export interface SemesterSyncState {
  semester: SemesterInfo;
  weeks: WeekOption[];
  currentIndex: number;
  collectedEvents: ScheduleEvent[];
}

export interface SlotTime {
  start: string;
  end: string;
}
