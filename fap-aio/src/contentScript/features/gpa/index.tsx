import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import { dom } from '../../shared/dom';

function findTranscriptTable(): HTMLTableElement | null {
  // Exactly like fap-gpa: get table from MainContentID
  const gradeDiv = document.getElementById('ctl00_mainContent_divGrade');
  if (!gradeDiv) {
    console.warn('[FAP-AIO] Grade container div not found');
    return null;
  }

  const tables = gradeDiv.querySelectorAll<HTMLTableElement>('table');
  console.info('[FAP-AIO] Found', tables.length, 'tables in grade container');
  
  if (tables.length === 0) {
    return null;
  }

  // fap-gpa uses gradeTablesDOM[0], so we use the first table
  return tables[0];
}

export function initGPA() {
  console.info('[FAP-AIO] Initializing GPA Calculator module');

  // Try to find the table immediately
  let transcriptTable = findTranscriptTable();
  
  if (!transcriptTable) {
    // If not found, wait a bit and try again (for dynamic content)
    console.info('[FAP-AIO] Transcript table not found immediately, retrying...');
    setTimeout(() => {
      transcriptTable = findTranscriptTable();
      if (transcriptTable) {
        mountGPACalculator(transcriptTable);
      } else {
        console.warn('[FAP-AIO] Transcript table not found after retry');
        console.warn('[FAP-AIO] Available tables:', document.querySelectorAll('table').length);
      }
    }, 1000);
    return;
  }

  mountGPACalculator(transcriptTable);
}

function mountGPACalculator(transcriptTable: HTMLTableElement) {
  console.info('[FAP-AIO] Mounting GPA Calculator');

  // Create container for React app exactly like fap-gpa
  const GridID = '#ctl00_mainContent_divGrade';
  const container = document.createElement('div');
  container.id = 'gpa-panel-new';
  
  // Prepend to the grid container (keeps original table visible)
  document.querySelector(GridID)?.prepend(container);

  // Mount React app
  const root = ReactDOM.createRoot(container);
  root.render(React.createElement(App));

  // Apply semester colors to the transcript table
  const gradeDiv = document.getElementById('ctl00_mainContent_divGrade');
  if (gradeDiv) {
    dom.applySemesterColors(gradeDiv);
  }

  console.info('[FAP-AIO] GPA Calculator module initialized successfully');
}
