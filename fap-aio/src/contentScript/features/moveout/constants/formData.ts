import { parseHTML, query, getAttr } from "../../../../../../userscript/fap-aio/src/userscript/utils/dom-parser";

const url = "https://fap.fpt.edu.vn/FrontOffice/MoveSubject.aspx";

export const formGetter = (id: string = "", isRegisterCourse = false) => {
  const __EVENTARGUMENT = document
    .getElementById("__EVENTARGUMENT")
    ?.getAttribute("value");
  const __LASTFOCUS = document
    .getElementById("__LASTFOCUS")
    ?.getAttribute("value");
  const __VIEWSTATEGENERATOR = document
    .getElementById("__VIEWSTATEGENERATOR")
    ?.getAttribute("value");
  const __VIEWSTATE = document
    .getElementById("__VIEWSTATE")
    ?.getAttribute("value");
  const __EVENTVALIDATION = document
    .getElementById("__EVENTVALIDATION")
    ?.getAttribute("value");
  const formData = new FormData();
  formData.append("__EVENTTARGET", "ctl00$mainContent$dllCourse");
  formData.append("__EVENTARGUMENT", __EVENTARGUMENT || "");
  formData.append("__LASTFOCUS", __LASTFOCUS || "");
  formData.append("__EVENTVALIDATION", __EVENTVALIDATION || "");
  formData.append("__VIEWSTATE", __VIEWSTATE || "");
  formData.append("__VIEWSTATEGENERATOR", __VIEWSTATEGENERATOR || "");
  formData.append("ctl00$mainContent$hdException", "");
  if (isRegisterCourse) {
    formData.append("ctl00$mainContent$ddlGroups", id + "");
  } else {
    formData.append("ctl00$mainContent$dllCourse", id + "");
  }
  return formData;
};

export const secondFormGetter = async (secondId: string, id: string) => {
  const page = await (
    await fetch(url + `?id=${secondId}`, {
      method: "GET",
    })
  ).text();
  
  const doc = parseHTML(page);
  const __EVENTARGUMENT = getAttr(query("#__EVENTARGUMENT", doc), "value");
  const __LASTFOCUS = getAttr(query("#__LASTFOCUS", doc), "value");
  const __VIEWSTATEGENERATOR = getAttr(query("#__VIEWSTATEGENERATOR", doc), "value");
  const __VIEWSTATE = getAttr(query("#__VIEWSTATE", doc), "value");
  const __EVENTVALIDATION = getAttr(query("#__EVENTVALIDATION", doc), "value");
  
  const formData = new FormData();
  formData.append("__EVENTTARGET", "ctl00$mainContent$dllCourse");
  formData.append("__EVENTARGUMENT", __EVENTARGUMENT || "");
  formData.append("__LASTFOCUS", __LASTFOCUS || "");
  formData.append("__EVENTVALIDATION", __EVENTVALIDATION || "");
  formData.append("__VIEWSTATE", __VIEWSTATE || "");
  formData.append("__VIEWSTATEGENERATOR", __VIEWSTATEGENERATOR || "");
  formData.append("ctl00$mainContent$dllCourse", id);
  formData.append("ctl00$mainContent$hdException", "");
  return formData;
};
