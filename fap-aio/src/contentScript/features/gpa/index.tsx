import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import { dom } from '../../shared/dom';

function waitForGradeDiv(): Promise<HTMLElement> {
  return new Promise((resolve) => {
    const gradeDiv = document.getElementById('ctl00_mainContent_divGrade');
    if (gradeDiv) {
      return resolve(gradeDiv);
    }

    // Use MutationObserver to wait for the element
    const observer = new MutationObserver(() => {
      const gradeDiv = document.getElementById('ctl00_mainContent_divGrade');
      if (gradeDiv) {
        observer.disconnect();
        resolve(gradeDiv);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Fallback timeout after 10 seconds
    setTimeout(() => {
      observer.disconnect();
      const gradeDiv = document.getElementById('ctl00_mainContent_divGrade');
      if (gradeDiv) {
        resolve(gradeDiv);
      }
    }, 10000);
  });
}

export async function initGPA() {
  console.info('[FAP-AIO] Initializing GPA Calculator module');

  try {
    // Wait for the grade div to appear
    const gradeDiv = await waitForGradeDiv();
    const tables = gradeDiv.querySelectorAll<HTMLTableElement>('table');
    
    console.info('[FAP-AIO] Found', tables.length, 'tables in grade container');
    
    if (tables.length === 0) {
      console.warn('[FAP-AIO] No tables found in grade container');
      return;
    }

    const transcriptTable = tables[0];
    mountGPACalculator(transcriptTable, gradeDiv);
  } catch (error) {
    console.error('[FAP-AIO] Error initializing GPA module:', error);
  }
}

function mountGPACalculator(transcriptTable: HTMLTableElement, gradeDiv: HTMLElement) {
  console.info('[FAP-AIO] Mounting GPA Calculator');

  // Create container for React app
  const container = document.createElement('div');
  container.id = 'gpa-panel-new';
  
  // Prepend to the grid container (keeps original table visible)
  gradeDiv.prepend(container);

  // Mount React app
  const root = ReactDOM.createRoot(container);
  root.render(React.createElement(App));

  // Inject semester color styles directly into the page
  injectSemesterStyles();

  // Apply semester colors after a short delay to ensure React has rendered
  setTimeout(() => {
    dom.applySemesterColors(gradeDiv);
    console.info('[FAP-AIO] Semester colors applied');
  }, 200);

  console.info('[FAP-AIO] GPA Calculator module initialized successfully');
}

function injectSemesterStyles() {
  // Check if styles already injected
  if (document.getElementById('fap-aio-semester-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'fap-aio-semester-styles';
  style.textContent = `
    /* Semester color cycle - HIGHEST SPECIFICITY to override GPA module styles */
    /* Color 1: #4e1445 */
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2023,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2020,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2027,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2030,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2034,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2038,
    table.table-hover tbody tr td.Fall2023,
    table.table-hover tbody tr td.Summer2020,
    table.table-hover tbody tr td.Spring2027,
    table.table-hover tbody tr td.Fall2030,
    table.table-hover tbody tr td.Summer2034,
    table.table-hover tbody tr td.Spring2038 { 
        background-color: #4e1445 !important; 
    }
    /* Color 2: #2a144e */
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2024,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2020,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2027,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2031,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2034,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2038,
    table.table-hover tbody tr td.Spring2024,
    table.table-hover tbody tr td.Fall2020,
    table.table-hover tbody tr td.Summer2027,
    table.table-hover tbody tr td.Spring2031,
    table.table-hover tbody tr td.Fall2034,
    table.table-hover tbody tr td.Summer2038 { 
        background-color: #2a144e !important; 
    }
    /* Color 3: #17144e */
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2024,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2021,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2027,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2031,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2035,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2038,
    table.table-hover tbody tr td.Summer2024,
    table.table-hover tbody tr td.Spring2021,
    table.table-hover tbody tr td.Fall2027,
    table.table-hover tbody tr td.Summer2031,
    table.table-hover tbody tr td.Spring2035,
    table.table-hover tbody tr td.Fall2038 { 
        background-color: #17144e !important; 
    }
    /* Color 4: #143c4e */
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2024,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2021,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2028,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2031,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2035,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2039,
    table.table-hover tbody tr td.Fall2024,
    table.table-hover tbody tr td.Summer2021,
    table.table-hover tbody tr td.Spring2028,
    table.table-hover tbody tr td.Fall2031,
    table.table-hover tbody tr td.Summer2035,
    table.table-hover tbody tr td.Spring2039 { 
        background-color: #143c4e !important; 
    }
    /* Color 5: #144e40 */
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2025,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2021,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2028,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2032,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2035,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2039,
    table.table-hover tbody tr td.Spring2025,
    table.table-hover tbody tr td.Fall2021,
    table.table-hover tbody tr td.Summer2028,
    table.table-hover tbody tr td.Spring2032,
    table.table-hover tbody tr td.Fall2035,
    table.table-hover tbody tr td.Summer2039 { 
        background-color: #144e40 !important; 
    }
    /* Color 6: #144e15 */
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2025,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2022,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2028,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2032,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2036,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2039,
    table.table-hover tbody tr td.Summer2025,
    table.table-hover tbody tr td.Spring2022,
    table.table-hover tbody tr td.Fall2028,
    table.table-hover tbody tr td.Summer2032,
    table.table-hover tbody tr td.Spring2036,
    table.table-hover tbody tr td.Fall2039 { 
        background-color: #144e15 !important; 
    }
    /* Color 7: #4e4d14 */
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2025,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2022,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2029,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2032,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2036,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2040,
    table.table-hover tbody tr td.Fall2025,
    table.table-hover tbody tr td.Summer2022,
    table.table-hover tbody tr td.Spring2029,
    table.table-hover tbody tr td.Fall2032,
    table.table-hover tbody tr td.Summer2036,
    table.table-hover tbody tr td.Spring2040 { 
        background-color: #4e4d14 !important; 
    }
    /* Color 8: #4e3314 */
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2026,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2022,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2029,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2033,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2036,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2040,
    table.table-hover tbody tr td.Spring2026,
    table.table-hover tbody tr td.Fall2022,
    table.table-hover tbody tr td.Summer2029,
    table.table-hover tbody tr td.Spring2033,
    table.table-hover tbody tr td.Fall2036,
    table.table-hover tbody tr td.Summer2040 { 
        background-color: #4e3314 !important; 
    }
    /* Color 9: #4e1614 */
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2026,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2023,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2029,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2033,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2037,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2040,
    table.table-hover tbody tr td.Summer2026,
    table.table-hover tbody tr td.Spring2023,
    table.table-hover tbody tr td.Fall2029,
    table.table-hover tbody tr td.Summer2033,
    table.table-hover tbody tr td.Spring2037,
    table.table-hover tbody tr td.Fall2040 { 
        background-color: #4e1614 !important; 
    }
    /* Color 10: #4e1438 */
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2026,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2023,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2030,
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2033,
    #ctl00_mainContent_divGrade table.table tbody tr td.Summer2037,
    table.table-hover tbody tr td.Fall2026,
    table.table-hover tbody tr td.Summer2023,
    table.table-hover tbody tr td.Spring2030,
    table.table-hover tbody tr td.Fall2033,
    table.table-hover tbody tr td.Summer2037 { 
        background-color: #4e1438 !important; 
    }
    /* Earlier semesters (2019-2020) */
    #ctl00_mainContent_divGrade table.table tbody tr td.Fall2019,
    #ctl00_mainContent_divGrade table.table tbody tr td.Spring2020,
    table.table-hover tbody tr td.Fall2019,
    table.table-hover tbody tr td.Spring2020 { 
        background-color: #4e3314 !important; 
    }
  `;
  document.head.appendChild(style);
  console.info('[FAP-AIO] Semester color styles injected with high specificity');
}
