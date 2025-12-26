import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import RegisterCourse from "./RegisterCourse.tsx";
// import Test from "./Test.tsx";

const rootPath =
  "#aspnetForm > table > tbody > tr:nth-child(1) > td > div > h2";
// "#root";

// Ensure the date info span is visible
const dateInfoElement = document.getElementById("ctl00_mainContent_lblDateInfo");
if (dateInfoElement) {
  dateInfoElement.style.display = "block";
  dateInfoElement.style.visibility = "visible";
  // Also ensure parent elements are visible
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

// Try to find the h2 element, or fall back to alternative selectors
let rootContainer = document.querySelector(rootPath);
if (!rootContainer) {
  // Fallback: try to find the form and insert after the main content area
  rootContainer = document.querySelector("#aspnetForm > table > tbody > tr:nth-child(1) > td > div");
}
if (!rootContainer) {
  // Last resort: use the main content div
  rootContainer = document.querySelector("#ctl00_mainContent_divMoveSubject")?.parentElement || document.body;
}

const appDiv = document.createElement("div");
appDiv.id = "fap-moveout-root";
rootContainer?.insertBefore(appDiv, rootContainer.firstChild);

if (
  window.location.href.startsWith(
    "https://fap.fpt.edu.vn/FrontOffice/MoveSubject.aspx"
  )
) {
  const rootElement = document.getElementById("fap-moveout-root");
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(<App />);
  } else {
    console.error("Root element not found for React app");
  }
} else if (
  window.location.href.startsWith(
    "https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx"
  )
) {
  const labels = document.querySelectorAll(`.label.label-primary`);
  labels.forEach((label) => {
    // Don't clear the date info element
    if (label.id !== "ctl00_mainContent_lblDateInfo" && 
        !label.querySelector("#ctl00_mainContent_lblDateInfo")) {
      label.innerHTML = "";
    }
  });
}

// else if (
//   window.location.href.startsWith(
//     "https://fap.fpt.edu.vn/FrontOffice/RegisterCourseFast.aspx"
//   )
// ) {
//   ReactDOM.createRoot(document.querySelector(`${rootPath} div`)!).render(
//     <RegisterCourse />
//   );
// }
