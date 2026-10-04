// Utility functions for FPTU Scheduler

import type { ScheduleEvent } from './types';

// Format time helper
export const fmtTime = (t: string): { hour: number; minute: number } => {
  if (!t || typeof t !== "string") return { hour: 0, minute: 0 };
  const cleaned = t.trim().replace(/\s+/g, "");
  
  if (cleaned.match(/\d+h\d*/i)) {
    const parts = cleaned.replace(/h/i, ":").split(":").map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return { hour: h, minute: m };
  }
  if (cleaned.includes(":")) {
    const parts = cleaned.split(":").map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return { hour: h, minute: m };
  }
  if (/^\d{1,2}$/.test(cleaned)) {
    return { hour: Number(cleaned), minute: 0 };
  }
  if (cleaned.includes(".")) {
    const parts = cleaned.split(".").map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return { hour: h, minute: m };
  }
  return { hour: 0, minute: 0 };
};

export const formatTime = (d: Date): string => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
export const formatDate = (d: Date): string => d.toLocaleDateString("vi-VN");

// ============ ICS GENERATOR ============
export function generateICS(events: ScheduleEvent[], filename: string): void {
  const SEPARATOR = '\r\n';
  const calendarStart = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:fptu-scheduler', 'CALSCALE:GREGORIAN'].join(SEPARATOR);
  const calendarEnd = 'END:VCALENDAR';
  
  const fmt = (d: Date): string => {
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
