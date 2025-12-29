/**
 * FAP-AIO Userscript - Feature Router
 * 
 * Routes to appropriate feature based on current URL.
 * Coordinates feature initialization with platform adapters.
 */

/// <reference path="./types/tampermonkey.d.ts" />


import { initGPA } from './features/index';
import { initMoveOut } from './features/index';
import { initScheduler } from './features/index';
import { dom } from '@/contentScript/shared/dom';

/**
 * Determine which feature(s) to initialize based on current URL
 */
export function initRouter(): void {
  const url = window.location.href;
  const pathname = window.location.pathname;
  
  console.info('[FAP-AIO Router] Current URL:', url);
  console.info('[FAP-AIO Router] Pathname:', pathname);
  
  try {
    // Apply global UI enhancements for all FAP pages
    enhanceGlobalUI();
    
    // Route to specific features based on URL
    if (pathname.includes('StudentTranscript.aspx')) {
      console.info('[FAP-AIO Router] Initializing GPA Calculator');
      initGPA();
    } 
    else if (pathname.includes('Courses.aspx') || pathname.includes('MoveSubject.aspx')) {
      console.info('[FAP-AIO Router] Initializing MoveOut Tool');
      initMoveOut();
    }
    else if (pathname.includes('ScheduleExams.aspx') || pathname.includes('ScheduleOfWeek.aspx')) {
      console.info('[FAP-AIO Router] Initializing Scheduler');
      initScheduler();
    }
    else {
      console.info('[FAP-AIO Router] No feature match for current page, applying global enhancements only');
    }
  } catch (error) {
    console.error('[FAP-AIO Router] Error during feature initialization:', error);
    // Don't throw - allow page to function even if feature fails
  }
}

/**
 * Apply global UI enhancements to all FAP pages
 * These enhancements work across all pages
 */
function enhanceGlobalUI(): void {
  try {
    console.info('[FAP-AIO Router] Applying global UI enhancements');
    
    // Use extension's DOM utilities for consistent behavior
    dom.enhanceUI();
    
    console.info('[FAP-AIO Router] Global UI enhancements applied');
  } catch (error) {
    console.error('[FAP-AIO Router] Error applying global UI enhancements:', error);
    // Continue even if enhancements fail
  }
}
