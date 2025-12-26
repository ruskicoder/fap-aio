// FPTU Scheduler - Content Script Entry Point
// Injects floating panel into FAP pages for schedule extraction

export function initScheduler() {
  // Guard against multiple injections
  if ((window as any).__FPTU_SCHEDULER_LOADED__) {
    console.log("FPTU Scheduler already loaded");
    return;
  }
  (window as any).__FPTU_SCHEDULER_LOADED__ = true;

  // Only run on FAP pages
  if (!window.location.href.includes("fap.fpt.edu.vn")) return;

  console.log("FPTU Scheduler initializing...");

  // Import and execute the scheduler
  import('./scheduler').then(({ initSchedulerPanel }) => {
    initSchedulerPanel();
  });
}
