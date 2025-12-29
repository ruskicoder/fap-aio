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
    
    // Add back button functionality (if applicable)
    addBackButton();
    
    // Enhance title link (if applicable)
    enhanceTitleLink();
    
    console.info('[FAP-AIO Router] Global UI enhancements applied');
  } catch (error) {
    console.error('[FAP-AIO Router] Error applying global UI enhancements:', error);
    // Continue even if enhancements fail
  }
}

/**
 * Add back button to navigation
 */
function addBackButton(): void {
  // Check if back button already exists
  if (document.querySelector('.fap-aio-back-button')) {
    return;
  }
  
  // Find navigation container
  const nav = document.querySelector('.navbar, .header, nav');
  if (!nav) {
    return;
  }
  
  // Create back button
  const backButton = document.createElement('button');
  backButton.className = 'fap-aio-back-button';
  backButton.textContent = '← Back';
  backButton.style.cssText = `
    margin: 0 10px;
    padding: 5px 15px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  
  backButton.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  });
  
  nav.prepend(backButton);
  console.info('[FAP-AIO Router] Back button added');
}

/**
 * Enhance title link to be clickable and return to home
 */
function enhanceTitleLink(): void {
  const titleElement = document.querySelector('h1, .page-title, .header-title');
  if (!titleElement) {
    return;
  }
  
  // Make title clickable if not already a link
  if (titleElement.tagName !== 'A' && !titleElement.querySelector('a')) {
    if (titleElement instanceof HTMLElement) {
      titleElement.style.cursor = 'pointer';
      titleElement.addEventListener('click', () => {
        window.location.href = '/';
      });
      console.info('[FAP-AIO Router] Title link enhanced');
    }
  }
}
