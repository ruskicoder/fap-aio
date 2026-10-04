import '@/styles/tailwind.css';
import '@/styles/userstyle.css';
import { dom } from '@/contentScript/shared/dom';
import { initGPA } from '@/contentScript/features/gpa';
import { initMoveOut } from '@/contentScript/features/moveout';
import { initScheduler } from '@/contentScript/features/scheduler';

const routeToFeature = () => {
  const url = window.location.href;

  // Enhance UI on all FAP pages
  dom.enhanceUI();

  if (url.includes('/Grade/StudentTranscript.aspx')) {
    initGPA();
  } else if (url.includes('/FrontOffice/MoveSubject.aspx') || url.includes('/FrontOffice/Courses.aspx')) {
    initMoveOut();
  } else if (url.includes('/Exam/ScheduleExams.aspx') || url.includes('/Report/ScheduleOfWeek.aspx')) {
    // Initialize scheduler for both exam and weekly schedule pages
    initScheduler();
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', routeToFeature);
} else {
  routeToFeature();
}

console.info('[FAP-AIO] Content script loaded');
