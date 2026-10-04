import { parseHTML, query, queryAll, getText, getAttr } from "../../shared/dom-parser";

export function mapToObject(map: Map<string, Map<string, string[]>>) {
  const obj: any = {};
  map.forEach((value, key: any) => {
    obj[key] = {};
    value.forEach((innerValue, innerKey) => {
      obj[key][innerKey] = innerValue;
    });
  });
  return obj;
}

export function objectToMap(obj: any): Map<string, Map<string, string[]>> {
  const map = new Map<string, Map<string, string[]>>();
  for (const [key, value] of Object.entries(obj as { [s: string]: unknown })) {
    const innerMap = new Map<string, string[]>();
    for (const [innerKey, innerValue] of Object.entries(
      value as { [s: string]: string[] }
    )) {
      innerMap.set(innerKey, innerValue);
    }
    map.set(key, innerMap);
  }
  return map;
}

export const textToColor = (text: string): string => {
  const intensity = 120;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 255;
    value = Math.min(value + intensity, 255);
    color += ("00" + value.toString(16)).slice(-2);
  }
  return color;
};

export const getClassKey = (isRegisterCourse: boolean = false): any => {
  const id = window.location.href.slice(window.location.href.indexOf("=") + 1);

  const selectId = isRegisterCourse
    ? "#ctl00_mainContent_ddlGroups"
    : "#ctl00_mainContent_dllCourse";

  let data: string = document.querySelector(selectId)?.innerHTML || "";
  const doc = parseHTML(data);
  let classes = new Map<string, string>();
  classes.set(
    document.getElementById("ctl00_mainContent_lblOldGroup")?.innerText || "",
    id
  );
  
  queryAll("option", doc).forEach((option: Element) => {
    const value = getAttr(option, "value");
    if (value) {
      classes.set(getText(option), value);
    }
  });

  return classes;
};

export const send = async (subject: string, formData: any) => {
  const response = await fetch(
    "https://fap.fpt.edu.vn/FrontOffice/Courses.aspx",
    {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "content-type": "application/x-www-form-urlencoded",
      },
      referrer: "https://fap.fpt.edu.vn/FrontOffice/Courses.aspx",
      referrerPolicy: "same-origin",
      body: `__EVENTTARGET=${subject}&__EVENTARGUMENT=&__LASTFOCUS=&__VIEWSTATE=${formData.__VIEWSTATE}&__VIEWSTATEGENERATOR=${formData.__VIEWSTATEGENERATOR}&__VIEWSTATEENCRYPTED=&__EVENTVALIDATION=${formData.__EVENTVALIDATION}&ctl00%24mainContent%24txtNewGroup=&ctl00%24mainContent%24ddlCampuses=${formData.ctl00_mainContent_ddlCampuses}&ctl00%24mainContent%24hdException=Index+was+out+of+range.+Must+be+non-negative+and+less+than+the+size+of+the+collection.%0D%0AParameter+name%3A+index`,
      method: "POST",
      mode: "cors",
      credentials: "include",
    }
  );

  if (response.redirected) {
    window.location.href = response.url;
  } else if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("Location");
    if (location) {
      window.location.href = location;
    }
  } else {
    const data = await response.text();
  }
};

export const getCurrentSubjects = async () => {
  const response = await fetch(
    "https://fap.fpt.edu.vn/FrontOffice/Courses.aspx",
    {
      method: "GET",
    }
  ).then((res) => res.text());
  
  const doc = parseHTML(response);
  const allRows = queryAll("#ctl00_mainContent_gvCourses tbody tr", doc);
  const currentSubjects = allRows.slice(1).map((row: Element) => {
    return {
      classId: getText(query("td:nth-child(1)", row)),
      subject: getText(query("td:nth-child(2)", row)),
      lecturer: getText(query("td:nth-child(5)", row)),
      moveId: getAttr(query("td:nth-child(7) a", row), "id"),
    };
  });
    
  const __VIEWSTATE = encodeURIComponent(getAttr(query("#__VIEWSTATE", doc), "value"));
  const __VIEWSTATEGENERATOR = getAttr(query("#__VIEWSTATEGENERATOR", doc), "value");
  const __EVENTVALIDATION = encodeURIComponent(getAttr(query("#__EVENTVALIDATION", doc), "value"));
  const ctl00_mainContent_ddlCampuses = getAttr(
    query("#ctl00_mainContent_ddlCampuses option:nth-child(1)", doc),
    "value"
  );
  
  return {
    currentSubjects,
    __VIEWSTATE,
    __VIEWSTATEGENERATOR,
    __EVENTVALIDATION,
    ctl00_mainContent_ddlCampuses,
  };
};

export const getCurrentStatus = async () => {
  const response = await fetch(
    "https://fap.fpt.edu.vn/Course/Courses.aspx"
  ).then((res) => res.text());
  
  const doc = parseHTML(response);
  const classCode =
    (
      document.getElementById("ctl00_mainContent_lblSubject")?.textContent || ""
    ).match(/^(.*?)(?=\s*-)/)?.[1] || "";

  let currentLink = getAttr(
    query("#ctl00_mainContent_divDepartment table tr:nth-child(1) td a", doc),
    "href"
  );

  currentLink = currentLink?.replace(/(.*?&[^&]+)=[^&]+$/, "$1");

  let campusName = "";
  const campus = getText(query("#ctl00_lblCampusName", doc));
  console.log(campus);
  if (campus.includes("Hòa Lạc")) {
    campusName = "hola";
  } else {
    campusName = "xavalo";
  }
  
  let deptData: any;
  try {
    const deptResponse = await fetch(
      "https://ruskicoder.github.io/fap-moveout/dept.json"
    );
    if (!deptResponse.ok) throw new Error("Failed to fetch");
    deptData = await deptResponse.json();
  } catch (error) {
    console.log("Dept fetch failed, returning empty result");
    return {};
  }

  let deptNum = Object.keys((deptData as any)[campusName]).filter((item) =>
    item.includes(classCode.toLowerCase())
  )?.[0];

  const link = `https://fap.fpt.edu.vn/Course/Courses.aspx${currentLink}=${
    (deptData as { [key: string]: { [key: string]: number } })[campusName][
      deptNum
    ]
  }`;

  console.log(link);
  const res = await fetch(link, {
    priority: "low",
    keepalive: false,
  }).then((res) => res.text());

  const resDoc = parseHTML(res);

  const subjectRows = queryAll("#id tr", resDoc);
  const subject = subjectRows.find((el: Element) =>
    getText(query("td:nth-child(1)", el))
      .toLowerCase()
      .includes(classCode.toLowerCase())
  );

  let result: any = {};
  if (subject) {
    // Process td:nth-child(2) links
    queryAll('td:nth-child(2) a[href^="Groups.aspx"]', subject).forEach((el: Element) => {
      const course = getText(el).trim();
      const nextSibling = el.nextSibling;
      if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
        const number = (nextSibling.nodeValue || "")
          .split("|")[1]
          ?.trim()
          ?.split("-(")[0];
        if (number) {
          result[course] = number;
        }
      }
    });
    
    // Process td:nth-child(3) links
    queryAll('td:nth-child(3) a[href^="Groups.aspx"]', subject).forEach((el: Element) => {
      const course = getText(el).trim();
      const nextSibling = el.nextSibling;
      if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
        const number = (nextSibling.nodeValue || "")
          .split("|")[1]
          ?.trim()
          ?.split("-(")[0];
        if (number) {
          result[course] = number;
        }
      }
    });
  }
  
  return result;
};

export const getLecturerList = async () => {
  const response = await fetch(
    "https://fap.fpt.edu.vn/FrontOffice/Courses.aspx"
  ).then((r) => r.text());
  
  const doc = parseHTML(response);
  const lecturerList = queryAll("#ctl00_mainContent_ddlCampuses option", doc)
    .map((option: Element) => getText(option));
    
  return lecturerList;
};

export const handleDownload = () => {
  const title = `${document.querySelector("#class-id")?.textContent}-${
    document.querySelector("#ctl00_mainContent_lblOldGroup")?.textContent
  }`;
  const link = document.createElement("a");
  
  const divStudents = document.getElementById("ctl00_mainContent_divStudents");
  const doc = parseHTML(divStudents?.innerHTML || "");
  
  const result = queryAll("tbody tr", doc)
    .map((row: Element) => {
      const td3 = getText(query("td:nth-child(3)", row));
      const td4 = getText(query("td:nth-child(4)", row)).trim();
      const td5 = getText(query("td:nth-child(5)", row)).trim();
      const td6 = getText(query("td:nth-child(6)", row)).trim();
      return `${td3}, ${td4} ${td5} ${td6}`;
    })
    .join("\n");
    
  const utf8Result = new TextEncoder().encode(result);
  const file = new Blob([utf8Result], { type: "text/plain;charset=utf-8" });
  link.href = URL.createObjectURL(file);
  link.download = `${title}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
  console.log(result);
};

export const cleanTimetable = async (document: Document | undefined) => {
  const labels = document?.querySelectorAll(".label.label-primary");
  labels?.forEach((label) => {
    if (label.id !== "ctl00_mainContent_lblDateInfo" && 
        !label.querySelector("#ctl00_mainContent_lblDateInfo")) {
      label.innerHTML = "";
    }
  });
  document?.querySelector(".container .row:nth-child(1)")?.remove();
  document?.querySelector(".breadcrumb")?.remove();
  document?.querySelector("tbody tr:nth-child(2)")?.remove();
  document?.querySelectorAll("td > div > p").forEach((item) => item.remove());
  document?.querySelectorAll("h2").forEach((item) => item.remove());
  document?.querySelector("#ctl00_mainContent_divfoot")?.remove();
  document?.querySelector("#ctl00_divUser")?.remove();
  document?.querySelector("#cssTable")?.remove();
  document?.querySelector('[id^="ctl00_divSupport"]')?.remove();
  document?.querySelector('[id^="ctl00_mainContent_ghichu"]')?.remove();
  document
    ?.querySelector(".container")
    ?.setAttribute(
      "style",
      "padding: 0px; margin: 0px; width: 100%;overflow-x: hidden;"
    );
  document
    ?.querySelector(".container > .row > .col-md-12")
    ?.setAttribute("style", "padding-right: 0px;");
};
