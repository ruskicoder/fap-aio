import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import RegisterCourse from './RegisterCourse';
import './style.css';

export function initMoveOut() {
  console.info('[FAP-AIO] Initializing MoveOut module');

  const url = window.location.href;

  // Ensure the date info span is visible
  const dateInfoElement = document.getElementById("ctl00_mainContent_lblDateInfo");
  if (dateInfoElement) {
    dateInfoElement.style.display = "block";
    dateInfoElement.style.visibility = "visible";
    let parent = dateInfoElement.parentElement;
    while (parent && parent !== document.body) {
      if (getComputedStyle(parent).display === "none") {
        parent.style.display = "block";
      }
      if (getComputedStyle(parent).visibility === "hidden") {
        parent.style.visibility = "visible";
      }
      parent = parent.parentElement;
    }
  }

  // Find root container
  const rootPath = "#aspnetForm > table > tbody > tr:nth-child(1) > td > div > h2";
  let rootContainer = document.querySelector(rootPath);
  if (!rootContainer) {
    rootContainer = document.querySelector("#aspnetForm > table > tbody > tr:nth-child(1) > td > div");
  }
  if (!rootContainer) {
    rootContainer = document.querySelector("#ctl00_mainContent_divMoveSubject")?.parentElement || document.body;
  }

  // Create app container
  const appDiv = document.createElement("div");
  appDiv.id = "fap-moveout-root";
  rootContainer?.insertBefore(appDiv, rootContainer.firstChild);

  const rootElement = document.getElementById("fap-moveout-root");
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);

    if (url.startsWith("https://fap.fpt.edu.vn/FrontOffice/MoveSubject.aspx")) {
      root.render(React.createElement(App));
      console.info('[FAP-AIO] MoveOut App (MoveSubject) mounted');
    } else if (url.startsWith("https://fap.fpt.edu.vn/FrontOffice/Courses.aspx")) {
      root.render(React.createElement(RegisterCourse));
      console.info('[FAP-AIO] MoveOut RegisterCourse mounted');
    }
  } else {
    console.warn('[FAP-AIO] Failed to find root element for MoveOut module');
  }
}
