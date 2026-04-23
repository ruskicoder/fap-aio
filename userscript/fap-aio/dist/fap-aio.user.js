// ==UserScript==
// @name         FAP-AIO Userscript
// @namespace    https://github.com/ruskicoder/fap-aio
// @version      0.0.1
// @description  All-in-One Enhancement for FPT University Academic Portal (Userscript)
// @author       ruskicoder
// @match        https://fap.fpt.edu.vn/*
// @match        http://fap.fpt.edu.vn/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @require      https://unpkg.com/react@18/umd/react.production.min.js
// @require      https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
// @connect      fap.fpt.edu.vn
// @connect      raw.githubusercontent.com
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/ruskicoder/fap-aio/master/userscript/fap-aio/dist/fap-aio.user.js
// @downloadURL  https://raw.githubusercontent.com/ruskicoder/fap-aio/master/userscript/fap-aio/dist/fap-aio.user.js
// @homepageURL  https://github.com/ruskicoder/fap-aio
// @icon         https://fptshop.com.vn/favicon.ico
// ==/UserScript==


var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
(function(React$1, ReactDOM$1) {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  class HTTPAdapter {
    constructor() {
      __publicField(this, "useGM");
      this.useGM = typeof GM_xmlhttpRequest !== "undefined";
      if (!this.useGM) {
        console.warn("[FAP-AIO HTTP] GM_xmlhttpRequest not available, using fetch (CORS limited)");
      } else {
        console.info("[FAP-AIO HTTP] Using GM_xmlhttpRequest");
      }
    }
    /**
     * Prepare request data and auto-detect Content-Type
     * Handles FormData, URLSearchParams, objects, and strings
     */
    prepareRequestData(data, headers) {
      const preparedHeaders = { ...headers };
      if (!data) {
        return { data: "", headers: preparedHeaders };
      }
      if (typeof FormData !== "undefined" && data instanceof FormData) {
        const params = new URLSearchParams();
        for (const [key, value] of data.entries()) {
          params.append(key, value);
        }
        if (!preparedHeaders["content-type"]) {
          preparedHeaders["content-type"] = "application/x-www-form-urlencoded";
        }
        return { data: params.toString(), headers: preparedHeaders };
      }
      if (typeof URLSearchParams !== "undefined" && data instanceof URLSearchParams) {
        if (!preparedHeaders["content-type"]) {
          preparedHeaders["content-type"] = "application/x-www-form-urlencoded";
        }
        return { data: data.toString(), headers: preparedHeaders };
      }
      if (typeof data === "object" && data !== null) {
        if (!preparedHeaders["content-type"]) {
          preparedHeaders["content-type"] = "application/json";
        }
        if (preparedHeaders["content-type"].includes("application/json")) {
          return { data: JSON.stringify(data), headers: preparedHeaders };
        } else if (preparedHeaders["content-type"].includes("application/x-www-form-urlencoded")) {
          const params = new URLSearchParams();
          Object.entries(data).forEach(([key, value]) => {
            params.append(key, String(value));
          });
          return { data: params.toString(), headers: preparedHeaders };
        }
      }
      return { data: String(data), headers: preparedHeaders };
    }
    /**
     * Make HTTP request with auto-detection of response type
     */
    async request(options) {
      if (this.useGM) {
        return this.gmRequest(options);
      } else {
        return this.fetchRequest(options);
      }
    }
    /**
     * GM_xmlhttpRequest implementation with auto-detection
     */
    gmRequest(options) {
      return new Promise((resolve, reject) => {
        const { data, headers } = this.prepareRequestData(options.data, options.headers || {});
        GM_xmlhttpRequest({
          method: options.method || "GET",
          url: options.url,
          headers,
          data,
          timeout: options.timeout || 3e4,
          onload: (response) => {
            try {
              const contentType = this.parseHeaders(response.responseHeaders)["content-type"] || "";
              let responseData;
              if (contentType.includes("application/json")) {
                responseData = JSON.parse(response.responseText);
              } else if (response.responseText.trim().startsWith("{") || response.responseText.trim().startsWith("[")) {
                try {
                  responseData = JSON.parse(response.responseText);
                } catch {
                  responseData = response.responseText;
                }
              } else {
                responseData = response.responseText;
              }
              resolve({
                data: responseData,
                status: response.status,
                statusText: response.statusText,
                headers: this.parseHeaders(response.responseHeaders)
              });
            } catch (e) {
              console.error("[FAP-AIO HTTP] Failed to parse response:", e);
              reject(new Error(`Failed to parse response: ${e.message}`));
            }
          },
          onerror: (error) => {
            console.error("[FAP-AIO HTTP] Request failed:", error);
            reject(new Error(`Request failed: ${error.statusText || "Unknown error"}`));
          },
          ontimeout: () => {
            console.error("[FAP-AIO HTTP] Request timeout");
            reject(new Error("Request timeout"));
          }
        });
      });
    }
    /**
     * Fetch fallback implementation
     */
    async fetchRequest(options) {
      try {
        const { data: preparedData, headers } = this.prepareRequestData(options.data, options.headers || {});
        const response = await fetch(options.url, {
          method: options.method || "GET",
          headers,
          body: preparedData || void 0
        });
        const contentType = response.headers.get("content-type") || "";
        let data;
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          data = await response.text();
        }
        return {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        };
      } catch (e) {
        console.error("[FAP-AIO HTTP] Fetch request failed:", e);
        throw new Error(`Fetch request failed: ${e.message}`);
      }
    }
    /**
     * Parse GM response headers into object
     */
    parseHeaders(headersString) {
      const headers = {};
      headersString.split("\r\n").forEach((line) => {
        const separatorIndex = line.indexOf(": ");
        if (separatorIndex > 0) {
          const key = line.substring(0, separatorIndex);
          const value = line.substring(separatorIndex + 2);
          if (key && value) {
            headers[key.toLowerCase()] = value;
          }
        }
      });
      return headers;
    }
    /**
     * GET request convenience method
     */
    async get(url2, options) {
      return this.request({ url: url2, ...options, method: "GET" });
    }
    /**
     * POST request convenience method
     */
    async post(url2, body, options) {
      return this.request({ url: url2, ...options, method: "POST", data: body });
    }
  }
  const http = new HTTPAdapter();
  function createFetchPolyfill() {
    return async function polyfillFetch(input, init2) {
      const url2 = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init2?.method?.toUpperCase() || "GET";
      try {
        const result = await http.request({
          method,
          url: url2,
          headers: init2?.headers,
          data: init2?.body
        });
        const responseHeaders = new Headers(result.headers || {});
        const response = {
          ok: result.status >= 200 && result.status < 300,
          status: result.status,
          statusText: result.statusText || "",
          headers: responseHeaders,
          url: url2,
          type: "basic",
          redirected: false,
          body: null,
          bodyUsed: false,
          // Response body methods
          async json() {
            try {
              return JSON.parse(result.data);
            } catch (e) {
              throw new Error(`Failed to parse JSON: ${e}`);
            }
          },
          async text() {
            return result.data;
          },
          async blob() {
            return new Blob([result.data]);
          },
          async arrayBuffer() {
            return new TextEncoder().encode(result.data).buffer;
          },
          async formData() {
            throw new Error("formData() not supported in fetch polyfill");
          },
          async bytes() {
            return new TextEncoder().encode(result.data);
          },
          clone() {
            return this;
          }
        };
        return response;
      } catch (error) {
        console.error("[FAP-AIO Fetch Polyfill] Request failed:", error);
        return {
          ok: false,
          status: 0,
          statusText: "Network Error",
          headers: new Headers(),
          url: url2,
          type: "basic",
          redirected: false,
          body: null,
          bodyUsed: false,
          async json() {
            throw new Error("Network request failed");
          },
          async text() {
            throw new Error("Network request failed");
          },
          async blob() {
            throw new Error("Network request failed");
          },
          async arrayBuffer() {
            throw new Error("Network request failed");
          },
          async formData() {
            throw new Error("formData() not supported");
          },
          async bytes() {
            throw new Error("Network request failed");
          },
          clone() {
            return this;
          }
        };
      }
    };
  }
  console.log("[FAP-AIO] Fetch polyfill module loaded");
  var jsxRuntime = { exports: {} };
  var reactJsxRuntime_production_min = {};
  /**
   * @license React
   * react-jsx-runtime.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   */
  var f = React$1, k = Symbol.for("react.element"), l = Symbol.for("react.fragment"), m = Object.prototype.hasOwnProperty, n = f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, p = { key: true, ref: true, __self: true, __source: true };
  function q(c, a, g) {
    var b, d = {}, e = null, h = null;
    void 0 !== g && (e = "" + g);
    void 0 !== a.key && (e = "" + a.key);
    void 0 !== a.ref && (h = a.ref);
    for (b in a) m.call(a, b) && !p.hasOwnProperty(b) && (d[b] = a[b]);
    if (c && c.defaultProps) for (b in a = c.defaultProps, a) void 0 === d[b] && (d[b] = a[b]);
    return { $$typeof: k, type: c, key: e, ref: h, props: d, _owner: n.current };
  }
  reactJsxRuntime_production_min.Fragment = l;
  reactJsxRuntime_production_min.jsx = q;
  reactJsxRuntime_production_min.jsxs = q;
  {
    jsxRuntime.exports = reactJsxRuntime_production_min;
  }
  var jsxRuntimeExports = jsxRuntime.exports;
  const Header$1 = ({
    nonGPAKey,
    setNonGPAKey
  }) => {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { id: "gpa-header", className: "table-responsive", children: /* @__PURE__ */ jsxRuntimeExports.jsx("table", { className: "table", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("thead", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "w-25", children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Các môn không tính vào GPA: " }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "w-50", children: nonGPAKey.map((item, index) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "inline-block", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "non-gpa label label-primary", children: item }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "a",
            {
              href: "#",
              className: "non-gpa non-gpa-delete label",
              onClick: () => setNonGPAKey(
                nonGPAKey.filter((_, i) => i !== index)
              ),
              children: "x"
            }
          )
        ] }, item)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("th", { rowSpan: 2, className: "w-25 buttons", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "btn btn-warning w-100", children: "Mặc định" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "spacing-h" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "btn btn-primary w-100", children: "Lưu" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Thêm môn vào danh sách:" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "input-group", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              className: "form-control",
              placeholder: "Nhập mã môn ( không cần số )"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "input-group-btn", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "btn btn-success", children: "Thêm vào danh sách" }) })
        ] }) })
      ] })
    ] }) }) });
  };
  class GMStorageAdapter {
    constructor() {
      __publicField(this, "prefix", "fap-aio:");
      __publicField(this, "useGM");
      this.useGM = typeof GM_setValue !== "undefined";
      if (!this.useGM) {
        console.warn("[FAP-AIO Storage] GM storage not available, falling back to localStorage");
      } else {
        console.info("[FAP-AIO Storage] Using GM storage");
      }
    }
    /**
     * Get value from storage
     * @param key - Simple key name (prefix added automatically)
     */
    get(key) {
      const fullKey = this.prefix + key;
      try {
        let item;
        if (this.useGM) {
          item = GM_getValue(fullKey, null);
        } else {
          item = localStorage.getItem(fullKey);
        }
        if (!item) {
          return null;
        }
        return JSON.parse(item);
      } catch (e) {
        console.error("[FAP-AIO Storage] Error getting key:", key, e);
        return null;
      }
    }
    /**
     * Set value in storage
     * @param key - Simple key name (prefix added automatically)
     * @param value - Value to store (will be JSON serialized)
     */
    set(key, value) {
      const fullKey = this.prefix + key;
      try {
        const serialized = JSON.stringify(value);
        if (this.useGM) {
          GM_setValue(fullKey, serialized);
        } else {
          localStorage.setItem(fullKey, serialized);
        }
      } catch (e) {
        console.error("[FAP-AIO Storage] Error setting key:", key, e);
      }
    }
    /**
     * Remove value from storage
     * @param key - Simple key name (prefix added automatically)
     */
    remove(key) {
      const fullKey = this.prefix + key;
      try {
        if (this.useGM) {
          GM_deleteValue(fullKey);
        } else {
          localStorage.removeItem(fullKey);
        }
      } catch (e) {
        console.error("[FAP-AIO Storage] Error removing key:", key, e);
      }
    }
    /**
     * Clear all keys with our prefix
     */
    clear() {
      try {
        if (this.useGM) {
          const knownKeys = [
            "examSchedule",
            "weeklySchedule",
            "semesterSyncState",
            "selectedSemester",
            "pendingSemesterSync",
            "gpaConfig",
            "moveoutCache"
          ];
          knownKeys.forEach((key) => this.remove(key));
        } else {
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith(this.prefix)) {
              localStorage.removeItem(key);
            }
          });
        }
      } catch (e) {
        console.error("[FAP-AIO Storage] Error clearing storage:", e);
      }
    }
    /**
     * Check if a stored value has expired
     * @param key - Simple key name (prefix added automatically)
     */
    isExpired(key) {
      try {
        const data = this.get(key);
        if (!data || !data.timestamp || !data.expiry) {
          return false;
        }
        return Date.now() - data.timestamp > data.expiry;
      } catch (e) {
        console.error("[FAP-AIO Storage] Error checking expiration for key:", key, e);
        return false;
      }
    }
  }
  new GMStorageAdapter();
  console.log("[FAP-AIO] Storage facade loaded (GM-backed)");
  const mapSemesterColor = (semester) => {
    const match = semester.match(/^(Spring|Summer|Fall)(\d{4})$/);
    if (!match) return "#6c757d";
    const [, season, year] = match;
    const colorIndex = {
      Spring: 0,
      Summer: 1,
      Fall: 2
    }[season];
    const yearNum = parseInt(year);
    const baseIndex = (yearNum - 2019) * 3 + (colorIndex || 0);
    const colors = [
      "#4e1445",
      "#2a144e",
      "#17144e",
      "#143c4e",
      "#144e40",
      "#144e15",
      "#4e4d14",
      "#4e3314",
      "#4e1614",
      "#4e1438"
    ];
    return colors[baseIndex % colors.length];
  };
  const mapGPALabel = (subject, grade) => {
    let gradeValue = 0;
    if (subject?.status) {
      if (subject.status == "Passed") {
        gradeValue = subject.grade;
      } else if (subject.status == "Not passed") {
        return "gpa-failed";
      }
    } else if (grade !== void 0) {
      gradeValue = grade;
    }
    if (gradeValue >= 9) return "gpa-excellent";
    if (gradeValue >= 8) return "gpa-verygood";
    if (gradeValue >= 7) return "gpa-good";
    if (gradeValue >= 5) return "gpa-average";
    return "gpa-failed";
  };
  const GradeTable = ({
    nonGPAKey,
    data,
    rawData
  }) => {
    const [collapsedSemesters, setCollapsedSemesters] = React$1.useState(
      /* @__PURE__ */ new Set()
    );
    const toggleSemester = (semester) => {
      setCollapsedSemesters((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(semester)) {
          newSet.delete(semester);
        } else {
          newSet.add(semester);
        }
        return newSet;
      });
    };
    const totalCredit = rawData?.reduce((acc, curr) => {
      if (nonGPAKey.includes(curr.code?.slice(0, 3))) return acc;
      if (curr.status !== "Passed") return acc;
      return acc + Number(curr.credit);
    }, 0);
    const totalGrade = rawData?.reduce((acc, curr) => {
      if (nonGPAKey.includes(curr?.code?.slice(0, 3))) return acc;
      if (curr.status !== "Passed") return acc;
      return acc + Number(curr?.grade) * Number(curr?.credit);
    }, 0);
    const totalGPA = (totalGrade / totalCredit).toFixed(2);
    const filteredData = data.filter((item) => {
      return item.data !== "Studying" && item.data !== "Not started";
    });
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "total-gpa-header", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "credits", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "label", children: "Total Accumulated Credits" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { id: "total-credit", className: "value", children: totalCredit })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "gpa", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "label", children: "Total GPA" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { id: "total-gpa", className: `value ${mapGPALabel(null, parseFloat(totalGPA))}`, children: totalGPA })
        ] })
      ] }),
      filteredData.map((item, index) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        SemesterBlock,
        {
          data: item,
          nonGPAKey,
          termNumber: index,
          isCollapsed: collapsedSemesters.has(item.data),
          onToggle: () => toggleSemester(item.data)
        },
        index
      ))
    ] });
  };
  const SemesterBlock = ({
    nonGPAKey,
    data,
    termNumber,
    isCollapsed,
    onToggle
  }) => {
    const totalCredit = data?.subjects?.reduce((acc, curr) => {
      if (nonGPAKey.includes(curr.code?.slice(0, 3))) return acc;
      if (curr.status !== "Passed") return acc;
      return acc + Number(curr.credit);
    }, 0);
    const totalGrade = data?.subjects?.reduce((acc, curr) => {
      if (nonGPAKey.includes(curr.code?.slice(0, 3))) return acc;
      if (curr.status !== "Passed") return acc;
      return acc + Number(curr.grade) * Number(curr.credit);
    }, 0);
    const GPA = (totalGrade / totalCredit).toFixed(2);
    const subjectCount = data?.subjects?.filter((s) => {
      const isNonGPA = nonGPAKey.includes(s.code?.slice(0, 3));
      const isNotStarted = s.status === "Not started";
      const isStudying = s.status === "Studying";
      return !isNonGPA && !isNotStarted && !isStudying;
    }).length || 0;
    const semesterColor = mapSemesterColor(data.data);
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "semester-block", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "semester-header", onClick: onToggle, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "term-number", children: termNumber }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "semester-info", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "span",
            {
              className: "label",
              style: {
                backgroundColor: semesterColor,
                color: "white",
                padding: "4px 12px",
                borderRadius: "4px"
              },
              children: ["Not started", "Studying"].includes(data?.data) ? data?.data : `${data?.semester} ${data?.year}`
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            "(",
            subjectCount,
            " subjects)"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { id: "semester-gpa", className: `semester-gpa ${mapGPALabel(null, parseFloat(GPA))}`, children: GPA === "NaN" ? "N/A" : GPA })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `semester-content ${isCollapsed ? "collapsed" : ""}`, children: /* @__PURE__ */ jsxRuntimeExports.jsx(SubjectTable, { subjects: data?.subjects, nonGPAKey }) })
    ] });
  };
  const SubjectTable = ({
    subjects,
    nonGPAKey
  }) => {
    const filteredSubjects = subjects.filter((subject) => {
      const isNonGPA = nonGPAKey.includes(subject.code?.slice(0, 3));
      const isNotStarted = subject.status === "Not started";
      const isStudying = subject.status === "Studying";
      return !isNonGPA && !isNotStarted && !isStudying;
    });
    const rows = [];
    const cols = 8;
    for (let i = 0; i < filteredSubjects.length; i += cols) {
      rows.push(filteredSubjects.slice(i, i + cols));
    }
    return /* @__PURE__ */ jsxRuntimeExports.jsx("table", { className: "subject-table", children: /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: rows.map((row, rowIndex) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
      row.map((subject, colIndex) => {
        const gradeColorClass = mapGPALabel(subject, subject.grade);
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { className: "subject-cell", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "subject-code", children: subject.code }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: `subject-grade ${gradeColorClass}`, children: [
            subject.grade,
            " × ",
            subject.credit
          ] })
        ] }, colIndex);
      }),
      row.length < cols && Array.from({ length: cols - row.length }).map((_, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("td", {}, `empty-${i}`))
    ] }, rowIndex)) }) });
  };
  const CalculateTable = ({
    rawData,
    nonGPAKey,
    data
  }) => {
    const [editData, setEditData] = React$1.useState([]);
    const [editing, setEditing] = React$1.useState("");
    const [collapsedSemesters, setCollapsedSemesters] = React$1.useState(
      /* @__PURE__ */ new Set()
    );
    const toggleSemester = (semester) => {
      setCollapsedSemesters((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(semester)) {
          newSet.delete(semester);
        } else {
          newSet.add(semester);
        }
        return newSet;
      });
    };
    React$1.useEffect(() => {
      setEditData(rawData);
    }, [rawData]);
    const handleSave = () => {
      const creditInput = document.querySelector(
        ".edit[name='credit']"
      );
      const gradeInput = document.querySelector(
        ".edit[name='grade']"
      );
      const credit = creditInput?.value;
      const grade = gradeInput?.value;
      setEditData((prevData) => {
        return prevData.map((item) => {
          if (item.code == editing) {
            return { ...item, credit, grade };
          }
          return item;
        });
      });
      setEditing("");
      console.log("editData", editData);
    };
    const totalCredit = editData?.reduce((acc, curr) => {
      if (nonGPAKey.includes(curr.code?.slice(0, 3))) return acc;
      if (curr.status !== "Passed") return acc;
      return acc + Number(curr.credit);
    }, 0);
    const totalGrade = editData?.reduce((acc, curr) => {
      if (nonGPAKey.includes(curr?.code?.slice(0, 3))) return acc;
      if (curr.status !== "Passed") return acc;
      return acc + Number(curr?.grade) * Number(curr?.credit);
    }, 0);
    const totalGPA = (totalGrade / totalCredit).toFixed(2);
    const filteredData = data.filter((item) => {
      return item.data !== "Studying" && item.data !== "Not started";
    });
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { id: "edit-gpa", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "total-gpa-header", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "credits", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "label", children: "Total Accumulated Credits" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { id: "total-credit", className: "value", children: totalCredit })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "gpa", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "label", children: "Total GPA" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { id: "total-gpa", className: `value ${mapGPALabel(null, parseFloat(totalGPA))}`, children: totalGPA }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "a",
            {
              href: "https://fap.fpt.edu.vn/FrontOffice/SubjectFees.aspx",
              target: "_blank",
              rel: "noopener noreferrer",
              style: {
                marginLeft: "15px",
                padding: "5px 10px",
                backgroundColor: "transparent",
                color: "#fff",
                border: "1px solid #f36b16",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                textDecoration: "none",
                display: "inline-block"
              },
              children: "Search Credit"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => setEditData(rawData),
              className: "reset-btn",
              style: {
                marginLeft: "10px",
                padding: "5px 10px",
                backgroundColor: "#ff9244",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              },
              children: "Reset All"
            }
          )
        ] })
      ] }),
      filteredData.map((semesterData, index) => {
        const semesterSubjects = editData.filter(
          (item) => item.semester === semesterData.data
        );
        const displaySubjects = semesterSubjects.filter((subject) => {
          const isNonGPA = nonGPAKey.includes(subject.code?.slice(0, 3));
          const isNotStarted = subject.status === "Not started";
          const isStudying = subject.status === "Studying";
          return !isNonGPA && !isNotStarted && !isStudying;
        });
        if (displaySubjects.length === 0) return null;
        const semesterCredit = displaySubjects.reduce((acc, curr) => {
          if (curr.status !== "Passed") return acc;
          return acc + Number(curr.credit);
        }, 0);
        const semesterGrade = displaySubjects.reduce((acc, curr) => {
          if (curr.status !== "Passed") return acc;
          return acc + Number(curr.grade) * Number(curr.credit);
        }, 0);
        const semesterGPA = (semesterGrade / semesterCredit).toFixed(2);
        const semesterColor = mapSemesterColor(semesterData.data);
        const isCollapsed = collapsedSemesters.has(semesterData.data);
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "semester-block", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "semester-header", onClick: () => toggleSemester(semesterData.data), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "term-number", children: index }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "semester-info", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "span",
                {
                  className: "semester-badge",
                  style: {
                    backgroundColor: semesterColor,
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontWeight: "bold"
                  },
                  children: semesterData.data
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#6c757d", fontSize: "14px" }, children: [
                "(",
                displaySubjects.length,
                " subjects)"
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { id: "semester-gpa", className: `semester-gpa ${mapGPALabel(null, parseFloat(semesterGPA))}`, children: semesterGPA })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `semester-content ${isCollapsed ? "collapsed" : ""}`, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "subject-table edit-table", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "8%" }, children: "No" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "15%" }, children: "Code" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "12%" }, children: "Credit" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "12%" }, children: "Grade" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "12%" }, children: "Status" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: "auto" }, children: "Actions" })
            ] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: displaySubjects.map((item, subIndex) => {
              const isEditing = editing === item.code;
              const gradeColorClass = mapGPALabel(item, item.grade);
              return /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: subIndex + 1 }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { fontWeight: "bold" }, children: item.code }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: isEditing ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    className: "edit",
                    name: "credit",
                    type: "number",
                    defaultValue: item.credit,
                    style: {
                      width: "60px",
                      padding: "4px",
                      border: "1px solid #dee2e6",
                      borderRadius: "4px",
                      color: "#000",
                      backgroundColor: "#fff"
                    }
                  }
                ) : item.credit }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: isEditing ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    className: "edit",
                    name: "grade",
                    type: "number",
                    defaultValue: item.grade,
                    style: {
                      width: "60px",
                      padding: "4px",
                      border: "1px solid #dee2e6",
                      borderRadius: "4px",
                      color: "#000",
                      backgroundColor: "#fff"
                    }
                  }
                ) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: gradeColorClass, style: { fontWeight: "bold", fontSize: "14px" }, children: item.grade }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "12px", color: item.status === "Passed" ? "#28a745" : "#dc3545" }, children: item.status }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: isEditing ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: handleSave,
                    style: {
                      padding: "4px 8px",
                      backgroundColor: "#007bff",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    },
                    children: "Save"
                  }
                ) : /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: () => setEditing(item.code),
                    style: {
                      padding: "4px 8px",
                      backgroundColor: "#6c757d",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    },
                    children: "Edit"
                  }
                ) })
              ] }, subIndex);
            }) })
          ] }) })
        ] }, index);
      })
    ] });
  };
  const App$1 = () => {
    const [nonGPAKey, setNonGPAKey] = React$1.useState([
      "OJS",
      "VOV",
      "GDQP",
      "LAB",
      "ENT",
      "SSS",
      "TMI",
      "TRS",
      "OTP"
    ]);
    const [data, setData] = React$1.useState([]);
    const [rawData, setRawData] = React$1.useState([]);
    const semesters = /* @__PURE__ */ new Set();
    const [showGPA, setShowGPA] = React$1.useState(false);
    const [showEdit, setShowEdit] = React$1.useState(false);
    const tabRootRef = React$1.useRef(null);
    React$1.useEffect(() => {
      const gradeDiv = document.getElementById("ctl00_mainContent_divGrade");
      if (gradeDiv && !tabRootRef.current) {
        const tabContainer = document.createElement("div");
        tabContainer.className = "gpa-tab-container";
        gradeDiv.insertBefore(tabContainer, gradeDiv.firstChild);
        tabRootRef.current = ReactDOM$1.createRoot(tabContainer);
      }
    }, []);
    React$1.useEffect(() => {
      if (tabRootRef.current) {
        tabRootRef.current.render(
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "gpa-tab-buttons", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                className: `gpa-tab-btn ${showGPA ? "active" : ""}`,
                onClick: (e) => {
                  e.preventDefault();
                  setShowGPA((prev) => !prev);
                  setShowEdit(false);
                },
                children: "Show GPA"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                className: `gpa-tab-btn ${showEdit ? "active" : ""}`,
                onClick: (e) => {
                  e.preventDefault();
                  setShowEdit((prev) => !prev);
                  setShowGPA(false);
                },
                children: "Edit GPA"
              }
            )
          ] })
        );
      }
    }, [showGPA, showEdit]);
    React$1.useEffect(() => {
      try {
        let tableData = crawlGPA();
        semesters.add("Studying");
        semesters.add("Not started");
        const hehe = [...semesters].map((data2) => {
          const semester = data2?.slice(0, data2.length - 4) || "";
          const year = data2?.slice(data2.length - 4, data2.length) || "";
          let subjects = [];
          if (data2 == "Not started") {
            subjects = tableData.filter((item) => item.status == "Not started");
          } else if (data2 == "Studying") {
            subjects = tableData.filter((item) => item.status == "Studying");
          } else {
            subjects = tableData.filter((item) => item.semester == data2);
          }
          return { data: data2, semester, year, subjects };
        });
        setData(hehe);
        setRawData(tableData);
      } catch (error) {
        console.log("error", error);
      }
    }, []);
    const crawlGPA = () => {
      const targetTable = document.querySelector(
        "#ctl00_mainContent_divGrade > table"
      );
      const targetTRs = Array.from(
        targetTable?.querySelectorAll("tbody > tr") || []
      );
      let test1 = [];
      targetTRs.forEach((tr) => {
        const tds = Array.from(tr.querySelectorAll("td") || []);
        const semester = tds?.[2]?.innerText;
        if (semester) semesters.add(semester);
        const code = tds?.[3]?.innerText;
        const name = tds?.[6]?.innerText;
        const credit = tds?.[7]?.innerText;
        const grade = tds?.[8]?.innerText;
        const status = tds?.[9]?.innerText;
        if (code)
          test1.push({
            semester,
            credit,
            grade,
            code,
            name,
            status
          });
      });
      return test1;
    };
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      showEdit && /* @__PURE__ */ jsxRuntimeExports.jsx(CalculateTable, { rawData, nonGPAKey, data }),
      showGPA && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Header$1, { nonGPAKey, setNonGPAKey }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(GradeTable, { data, rawData, nonGPAKey })
      ] })
    ] });
  };
  const dom = {
    waitForElement: (selector, timeout = 5e3) => {
      return new Promise((resolve) => {
        if (document.querySelector(selector)) {
          return resolve(document.querySelector(selector));
        }
        const observer = new MutationObserver(() => {
          if (document.querySelector(selector)) {
            resolve(document.querySelector(selector));
            observer.disconnect();
          }
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, timeout);
      });
    },
    createElement: (tag, attributes = {}, text) => {
      const element = document.createElement(tag);
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
      if (text) {
        element.textContent = text;
      }
      return element;
    },
    injectStyles: (css) => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
    },
    enhanceUI: () => {
      const userDiv = document.querySelector("#ctl00_divUser");
      if (userDiv && !document.querySelector(".fap-back-button")) {
        const backButton = document.createElement("a");
        backButton.href = "https://fap.fpt.edu.vn/Student.aspx";
        backButton.className = "fap-back-button";
        backButton.innerHTML = "← Home";
        backButton.style.cssText = `
        float: left;
        margin-right: 16px;
        padding: 0.3125rem 0.625rem;
        background-color: #0f0905;
        color: #E0E0E0;
        border-radius: 0.25rem;
        border: 0.0625rem solid #333333;
        text-decoration: none;
        display: inline-block;
        font-weight: 600;
        transition: all 0.2s ease;
      `;
        const hoverStyle = document.createElement("style");
        hoverStyle.textContent = `
        .fap-back-button:hover {
          background-color: #F36B16 !important;
          color: #000000 !important;
          border-color: #F36B16 !important;
        }
      `;
        document.head.appendChild(hoverStyle);
        userDiv.parentElement?.insertBefore(backButton, userDiv);
      }
      const headings = Array.from(document.querySelectorAll("h1, h2"));
      const titleHeading = headings.find(
        (h) => h.textContent?.includes("FPT University Academic Portal")
      );
      if (titleHeading && !titleHeading.querySelector("a")) {
        const link = document.createElement("a");
        link.href = "https://fap.fpt.edu.vn/Student.aspx";
        link.style.cssText = `
        color: #E0E0E0 !important;
        text-decoration: none !important;
        padding: 0;
        display: inline-block;
        transition: color 0.2s ease;
      `;
        link.innerHTML = titleHeading.innerHTML;
        titleHeading.innerHTML = "";
        titleHeading.appendChild(link);
        const titleHoverStyle = document.createElement("style");
        titleHoverStyle.textContent = `
        h1 a:hover, h2 a:hover {
          color: #F36B16 !important;
        }
      `;
        document.head.appendChild(titleHoverStyle);
      }
      const breadcrumb = document.querySelector(".breadcrumb");
      if (breadcrumb) {
        breadcrumb.style.display = "block";
        breadcrumb.style.visibility = "visible";
      }
      const semesterPattern = /^(Fall|Spring|Summer)(20\d{2})$/;
      const tableCells = document.querySelectorAll("table td, table th");
      tableCells.forEach((cell) => {
        const text = cell.textContent?.trim();
        if (text && semesterPattern.test(text)) {
          cell.classList.add(text);
        }
      });
      const statusSpans = document.querySelectorAll("table td span, table th span");
      statusSpans.forEach((span) => {
        const text = span.textContent?.trim();
        if (text === "Passed") {
          span.classList.add("status-passed");
        } else if (text === "Not Passed") {
          span.classList.add("status-not-passed");
        }
      });
    },
    applySemesterColors: (container = document) => {
      const semesterPattern = /^(Fall|Spring|Summer)(20\d{2})$/;
      const tableCells = container.querySelectorAll("table td, table th");
      tableCells.forEach((cell) => {
        const text = cell.textContent?.trim();
        if (text && semesterPattern.test(text)) {
          cell.classList.add(text);
        }
      });
      const statusSpans = container.querySelectorAll("table td span, table th span");
      statusSpans.forEach((span) => {
        const text = span.textContent?.trim();
        if (text === "Passed") {
          span.classList.add("status-passed");
        } else if (text === "Not Passed") {
          span.classList.add("status-not-passed");
        }
      });
    }
  };
  function waitForGradeDiv() {
    return new Promise((resolve) => {
      const gradeDiv = document.getElementById("ctl00_mainContent_divGrade");
      if (gradeDiv) {
        return resolve(gradeDiv);
      }
      const observer = new MutationObserver(() => {
        const gradeDiv2 = document.getElementById("ctl00_mainContent_divGrade");
        if (gradeDiv2) {
          observer.disconnect();
          resolve(gradeDiv2);
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      setTimeout(() => {
        observer.disconnect();
        const gradeDiv2 = document.getElementById("ctl00_mainContent_divGrade");
        if (gradeDiv2) {
          resolve(gradeDiv2);
        }
      }, 1e4);
    });
  }
  async function initGPA() {
    console.info("[FAP-AIO] Initializing GPA Calculator module");
    try {
      const gradeDiv = await waitForGradeDiv();
      const tables = gradeDiv.querySelectorAll("table");
      console.info("[FAP-AIO] Found", tables.length, "tables in grade container");
      if (tables.length === 0) {
        console.warn("[FAP-AIO] No tables found in grade container");
        return;
      }
      const transcriptTable = tables[0];
      mountGPACalculator(transcriptTable, gradeDiv);
    } catch (error) {
      console.error("[FAP-AIO] Error initializing GPA module:", error);
    }
  }
  function mountGPACalculator(transcriptTable, gradeDiv) {
    console.info("[FAP-AIO] Mounting GPA Calculator");
    const container = document.createElement("div");
    container.id = "gpa-panel-new";
    gradeDiv.prepend(container);
    const root = ReactDOM$1.createRoot(container);
    root.render(React$1.createElement(App$1));
    injectSemesterStyles();
    setTimeout(() => {
      dom.applySemesterColors(gradeDiv);
      console.info("[FAP-AIO] Semester colors applied");
    }, 200);
    console.info("[FAP-AIO] GPA Calculator module initialized successfully");
  }
  function injectSemesterStyles() {
    if (document.getElementById("fap-aio-semester-styles")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "fap-aio-semester-styles";
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
    console.info("[FAP-AIO] Semester color styles injected with high specificity");
  }
  function initScheduler() {
    if (window.__FPTU_SCHEDULER_LOADED__) {
      console.log("FPTU Scheduler already loaded");
      return;
    }
    window.__FPTU_SCHEDULER_LOADED__ = true;
    if (!window.location.href.includes("fap.fpt.edu.vn")) return;
    console.log("FPTU Scheduler initializing...");
    Promise.resolve().then(() => scheduler).then(({ initSchedulerPanel: initSchedulerPanel2 }) => {
      initSchedulerPanel2();
    });
  }
  function parseHTML(html) {
    const parser = new DOMParser();
    return parser.parseFromString(html, "text/html");
  }
  function query(selector, parent = document) {
    return parent.querySelector(selector);
  }
  function queryAll(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  }
  function getText(element) {
    return element?.textContent?.trim() || "";
  }
  function getAttr(element, attribute) {
    return element?.getAttribute(attribute) || "";
  }
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const slots = ["1", "2", "3", "4", "5", "6", "7", "8"];
  const classData = /* @__PURE__ */ new Map([
    ["Mon", /* @__PURE__ */ new Map([["1", []], ["2", []], ["3", []], ["4", []], ["5", []], ["6", []], ["7", []], ["8", []]])],
    ["Tue", /* @__PURE__ */ new Map([["1", []], ["2", []], ["3", []], ["4", []], ["5", []], ["6", []], ["7", []], ["8", []]])],
    ["Wed", /* @__PURE__ */ new Map([["1", []], ["2", []], ["3", []], ["4", []], ["5", []], ["6", []], ["7", []], ["8", []]])],
    ["Thu", /* @__PURE__ */ new Map([["1", []], ["2", []], ["3", []], ["4", []], ["5", []], ["6", []], ["7", []], ["8", []]])],
    ["Fri", /* @__PURE__ */ new Map([["1", []], ["2", []], ["3", []], ["4", []], ["5", []], ["6", []], ["7", []], ["8", []]])],
    ["Sat", /* @__PURE__ */ new Map([["1", []], ["2", []], ["3", []], ["4", []], ["5", []], ["6", []], ["7", []], ["8", []]])],
    ["Sun", /* @__PURE__ */ new Map([["1", []], ["2", []], ["3", []], ["4", []], ["5", []], ["6", []], ["7", []], ["8", []]])]
  ]);
  const url = "https://fap.fpt.edu.vn/FrontOffice/MoveSubject.aspx";
  const formGetter = (id = "", isRegisterCourse = false) => {
    const __EVENTARGUMENT = document.getElementById("__EVENTARGUMENT")?.getAttribute("value");
    const __LASTFOCUS = document.getElementById("__LASTFOCUS")?.getAttribute("value");
    const __VIEWSTATEGENERATOR = document.getElementById("__VIEWSTATEGENERATOR")?.getAttribute("value");
    const __VIEWSTATE = document.getElementById("__VIEWSTATE")?.getAttribute("value");
    const __EVENTVALIDATION = document.getElementById("__EVENTVALIDATION")?.getAttribute("value");
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
  const secondFormGetter = async (secondId, id) => {
    const page = await (await nativeFetch(url + `?id=${secondId}`, {
      method: "GET"
    })).text();
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
  function mapToObject(map) {
    const obj = {};
    map.forEach((value, key) => {
      obj[key] = {};
      value.forEach((innerValue, innerKey) => {
        obj[key][innerKey] = innerValue;
      });
    });
    return obj;
  }
  function objectToMap(obj) {
    const map = /* @__PURE__ */ new Map();
    for (const [key, value] of Object.entries(obj)) {
      const innerMap = /* @__PURE__ */ new Map();
      for (const [innerKey, innerValue] of Object.entries(
        value
      )) {
        innerMap.set(innerKey, innerValue);
      }
      map.set(key, innerMap);
    }
    return map;
  }
  const textToColor = (text) => {
    const intensity = 120;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
    }
    let color = "#";
    for (let i = 0; i < 3; i++) {
      let value = hash >> i * 8 & 255;
      value = Math.min(value + intensity, 255);
      color += ("00" + value.toString(16)).slice(-2);
    }
    return color;
  };
  const getClassKey = (isRegisterCourse = false) => {
    const id = window.location.href.slice(window.location.href.indexOf("=") + 1);
    const selectId = isRegisterCourse ? "#ctl00_mainContent_ddlGroups" : "#ctl00_mainContent_dllCourse";
    let data = document.querySelector(selectId)?.innerHTML || "";
    const doc = parseHTML(data);
    let classes = /* @__PURE__ */ new Map();
    classes.set(
      document.getElementById("ctl00_mainContent_lblOldGroup")?.innerText || "",
      id
    );
    queryAll("option", doc).forEach((option) => {
      const value = getAttr(option, "value");
      if (value) {
        classes.set(getText(option), value);
      }
    });
    return classes;
  };
  const send = async (subject, formData) => {
    const response = await nativeFetch(
      "https://fap.fpt.edu.vn/FrontOffice/Courses.aspx",
      {
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "content-type": "application/x-www-form-urlencoded"
        },
        referrer: "https://fap.fpt.edu.vn/FrontOffice/Courses.aspx",
        referrerPolicy: "same-origin",
        body: `__EVENTTARGET=${subject}&__EVENTARGUMENT=&__LASTFOCUS=&__VIEWSTATE=${formData.__VIEWSTATE}&__VIEWSTATEGENERATOR=${formData.__VIEWSTATEGENERATOR}&__VIEWSTATEENCRYPTED=&__EVENTVALIDATION=${formData.__EVENTVALIDATION}&ctl00%24mainContent%24txtNewGroup=&ctl00%24mainContent%24ddlCampuses=${formData.ctl00_mainContent_ddlCampuses}&ctl00%24mainContent%24hdException=Index+was+out+of+range.+Must+be+non-negative+and+less+than+the+size+of+the+collection.%0D%0AParameter+name%3A+index`,
        method: "POST",
        mode: "cors",
        credentials: "include"
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
      await response.text();
    }
  };
  const getCurrentSubjects = async () => {
    const response = await nativeFetch(
      "https://fap.fpt.edu.vn/FrontOffice/Courses.aspx",
      {
        method: "GET"
      }
    ).then((res) => res.text());
    const doc = parseHTML(response);
    const allRows = queryAll("#ctl00_mainContent_gvCourses tbody tr", doc);
    const currentSubjects = allRows.slice(1).map((row) => {
      return {
        classId: getText(query("td:nth-child(1)", row)),
        subject: getText(query("td:nth-child(2)", row)),
        lecturer: getText(query("td:nth-child(5)", row)),
        moveId: getAttr(query("td:nth-child(7) a", row), "id")
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
      ctl00_mainContent_ddlCampuses
    };
  };
  const getCurrentStatus = async () => {
    const response = await nativeFetch(
      "https://fap.fpt.edu.vn/Course/Courses.aspx"
    ).then((res2) => res2.text());
    const doc = parseHTML(response);
    const classCode = (document.getElementById("ctl00_mainContent_lblSubject")?.textContent || "").match(/^(.*?)(?=\s*-)/)?.[1] || "";
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
    let deptData;
    try {
      const deptResponse = await nativeFetch(
        "https://ruskicoder.github.io/fap-moveout/dept.json"
      );
      if (!deptResponse.ok) throw new Error("Failed to fetch");
      deptData = await deptResponse.json();
    } catch (error) {
      console.log("Dept fetch failed, returning empty result");
      return {};
    }
    let deptNum = Object.keys(deptData[campusName]).filter(
      (item) => item.includes(classCode.toLowerCase())
    )?.[0];
    const link = `https://fap.fpt.edu.vn/Course/Courses.aspx${currentLink}=${deptData[campusName][deptNum]}`;
    console.log(link);
    const res = await nativeFetch(link, {
      priority: "low",
      keepalive: false
    }).then((res2) => res2.text());
    const resDoc = parseHTML(res);
    const subjectRows = queryAll("#id tr", resDoc);
    const subject = subjectRows.find(
      (el) => getText(query("td:nth-child(1)", el)).toLowerCase().includes(classCode.toLowerCase())
    );
    let result = {};
    if (subject) {
      queryAll('td:nth-child(2) a[href^="Groups.aspx"]', subject).forEach((el) => {
        const course = getText(el).trim();
        const nextSibling = el.nextSibling;
        if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
          const number = (nextSibling.nodeValue || "").split("|")[1]?.trim()?.split("-(")[0];
          if (number) {
            result[course] = number;
          }
        }
      });
      queryAll('td:nth-child(3) a[href^="Groups.aspx"]', subject).forEach((el) => {
        const course = getText(el).trim();
        const nextSibling = el.nextSibling;
        if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
          const number = (nextSibling.nodeValue || "").split("|")[1]?.trim()?.split("-(")[0];
          if (number) {
            result[course] = number;
          }
        }
      });
    }
    return result;
  };
  const handleDownload = () => {
    const title = `${document.querySelector("#class-id")?.textContent}-${document.querySelector("#ctl00_mainContent_lblOldGroup")?.textContent}`;
    const link = document.createElement("a");
    const divStudents = document.getElementById("ctl00_mainContent_divStudents");
    const doc = parseHTML(divStudents?.innerHTML || "");
    const result = queryAll("tbody tr", doc).map((row) => {
      const td3 = getText(query("td:nth-child(3)", row));
      const td4 = getText(query("td:nth-child(4)", row)).trim();
      const td5 = getText(query("td:nth-child(5)", row)).trim();
      const td6 = getText(query("td:nth-child(6)", row)).trim();
      return `${td3}, ${td4} ${td5} ${td6}`;
    }).join("\n");
    const utf8Result = new TextEncoder().encode(result);
    const file = new Blob([utf8Result], { type: "text/plain;charset=utf-8" });
    link.href = URL.createObjectURL(file);
    link.download = `${title}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    console.log(result);
  };
  async function sendTrackingEvent() {
    return Promise.resolve();
  }
  const Header = ({
    isLoading,
    refresh,
    handleStudentCount,
    isRegisterCourse
  }) => {
    return /* @__PURE__ */ React$1.createElement("div", { className: "flex gap-6 items-center text-xl" }, /* @__PURE__ */ React$1.createElement("div", { className: "flex gap-5 items-center" }, !isLoading.fetching && /* @__PURE__ */ React$1.createElement(React$1.Fragment, null, /* @__PURE__ */ React$1.createElement(
      "a",
      {
        href: "https://docs.google.com/spreadsheets/d/1CTlmTC4RgW4zk-A9VTkz4BGzjY2PMk5s/edit",
        className: "font-semibold px-4 py-2 rounded-md border-2 border-[#F36B16] text-[#F36B16] hover:bg-[#F36B16] hover:text-black transition-all cursor-pointer !no-underline",
        target: "_blank"
      },
      "Xem review GV"
    ), /* @__PURE__ */ React$1.createElement(
      "button",
      {
        type: "button",
        onClick: refresh,
        className: "font-semibold px-4 py-2 rounded-md border-2 border-[#F36B16] text-[#F36B16] hover:bg-[#F36B16] hover:text-black transition-all cursor-pointer"
      },
      "Làm mới"
    ), !isRegisterCourse && /* @__PURE__ */ React$1.createElement(
      "button",
      {
        type: "button",
        onClick: handleStudentCount,
        className: "font-semibold px-4 py-2 rounded-md border-2 border-[#F36B16] text-[#F36B16] hover:bg-[#F36B16] hover:text-black transition-all cursor-pointer",
        id: "studentCount",
        title: "(Có thể sẽ hơi lag)"
      },
      "Lấy sĩ số"
    ), /* @__PURE__ */ React$1.createElement("span", { className: "font-bold text-3xl", id: "class-id" }, document.getElementById("ctl00_mainContent_lblSubject")?.textContent?.split("-")[0].trim())), (isLoading.moving || isLoading.fetching) && /* @__PURE__ */ React$1.createElement(React$1.Fragment, null, /* @__PURE__ */ React$1.createElement("div", { className: "" }, isLoading.moving ? "Đang thực hiện chuyển đổi, vui lòng đợi trong giây lát" : "Đang lấy sĩ số lớp"), /* @__PURE__ */ React$1.createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: 24,
        height: 24,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        className: "lucide lucide-rotate-cw rotate"
      },
      /* @__PURE__ */ React$1.createElement("path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" }),
      /* @__PURE__ */ React$1.createElement("path", { d: "M21 3v5h-5" })
    ))));
  };
  const Timetable = ({
    timeTable,
    filter,
    studentCount,
    getClassKey: getClassKey2,
    sendTrackingEvent: sendTrackingEvent2,
    setIsLoading,
    formData,
    setIsFull,
    subject,
    setFilter,
    isRegisterCourse
  }) => {
    const handleClassClick = async (item) => {
      const userConfirmed = window.confirm(
        `Bạn có chắc muốn chuyển qua lớp ${item} không?`
      );
      if (userConfirmed) {
        await sendTrackingEvent2();
        setIsLoading((prev) => ({
          ...prev,
          moving: true
        }));
        const classId = getClassKey2(isRegisterCourse).get(item.split(" (")[0]);
        if (isRegisterCourse) {
          formData.set("ctl00$mainContent$ddlGroups", classId);
        } else {
          formData.set("ctl00$mainContent$dllCourse", classId);
        }
        formData.set("ctl00$mainContent$btSave", "Save");
        nativeFetch(window.location.href, {
          method: "POST",
          headers: {},
          body: formData,
          priority: "high"
        }).then((res) => res.text()).then((text) => {
          if (isRegisterCourse) {
            const doc = parseHTML(text);
            const alertTextRegex = getText(query("#ctl00_mainContent_lblMessage", doc));
            if (alertTextRegex.startsWith("Bạn không thể đăng ký")) {
              alert(alertTextRegex);
            } else {
              alert("Yêu cầu của bạn đã được chấp nhận");
            }
          } else {
            const alertTextRegex = /alert\('([^']*)'\)/;
            const match = text.match(alertTextRegex);
            let res = match?.[1]?.replaceAll("</br>", "\n");
            if (res) {
              alert(res);
              if (res?.includes("Bạn không thể chuyển tới lớp này, bởi vì")) {
                setIsFull(true);
              }
              if (res?.includes("đã được chấp nhận")) {
                const url2 = new URL(window.location.href);
                if (classId) {
                  url2.searchParams.set("id", classId);
                }
                localStorage.removeItem(subject);
                window.location.href = "https://fap.fpt.edu.vn/FrontOffice/MoveSubject.aspx?id=" + getClassKey2().get(item.split(" ")[0]);
              } else if (res?.includes("Bạn không thể chuyển tới lớp này, bởi vì")) {
                setIsFull(true);
              }
            } else {
              alert("Bạn đã ở trong lớp này rồi");
            }
          }
          setIsLoading((prev) => ({
            ...prev,
            moving: false
          }));
        });
      }
    };
    return /* @__PURE__ */ React$1.createElement("table", { className: "w-full" }, /* @__PURE__ */ React$1.createElement("thead", null, /* @__PURE__ */ React$1.createElement("tr", { className: "" }, /* @__PURE__ */ React$1.createElement("td", { className: "text-white bg-blue-500 font-bold p-2 w-[100px] text-center rounded-tl-2xl" }), weekdays.map((day) => /* @__PURE__ */ React$1.createElement(
      "td",
      {
        key: day,
        className: `text-white bg-blue-500 font-bold border px-2 py-3 w-[200px] text-center ${day == "Sun" && "rounded-tr-2xl border-transparent"}`
      },
      /* @__PURE__ */ React$1.createElement(
        "label",
        {
          htmlFor: day,
          className: "flex justify-center items-center gap-2 !m-0 cursor-pointer"
        },
        /* @__PURE__ */ React$1.createElement(
          "input",
          {
            defaultChecked: true,
            className: "!mt-0",
            type: "checkbox",
            id: day,
            checked: !filter.excludeWeekdays.includes(day),
            onChange: (e) => {
              setFilter((prev) => ({
                ...prev,
                excludeWeekdays: !e.target.checked ? [...filter.excludeWeekdays, day] : filter.excludeWeekdays.filter(
                  (item) => item != day
                )
              }));
            }
          }
        ),
        day
      )
    )))), /* @__PURE__ */ React$1.createElement("tbody", null, slots.map((slot) => /* @__PURE__ */ React$1.createElement("tr", { className: "", key: slot }, /* @__PURE__ */ React$1.createElement(
      "td",
      {
        className: `text-white bg-blue-500 font-bold border w-[80px] text-center px-3 py-4 m-auto ${slot == "8" && "rounded-bl-2xl border-transparent"}`
      },
      /* @__PURE__ */ React$1.createElement(
        "label",
        {
          htmlFor: slot,
          className: "flex justify-center items-center gap-2 !m-0 cursor-pointer"
        },
        /* @__PURE__ */ React$1.createElement(
          "input",
          {
            defaultChecked: true,
            className: "!mt-0",
            type: "checkbox",
            id: slot,
            checked: !filter.excludeSlots.includes(slot),
            onChange: (e) => {
              setFilter((prev) => ({
                ...prev,
                excludeSlots: !e.target.checked ? [...filter.excludeSlots, slot] : filter.excludeSlots.filter(
                  (item) => item != slot
                )
              }));
            }
          }
        ),
        "Slot ",
        slot
      )
    ), weekdays.map((day) => /* @__PURE__ */ React$1.createElement(
      "td",
      {
        key: day,
        className: "border col-span-1 p-2 w-[200px]",
        onClick: () => {
        }
      },
      timeTable?.get(day)?.get(slot)?.map((item) => {
        return /* @__PURE__ */ React$1.createElement(
          "div",
          {
            key: item,
            className: `border-[0.5px] border-black font-bold p-2 rounded-md mb-2 bg-opacity-5 cursor-pointer hover:scale-[1.03] duration-200 ${item.includes(filter.lecturer) && item.toLocaleLowerCase().includes(filter.classId.toLowerCase()) && (Object.keys(studentCount).length > 0 ? studentCount?.[item.split(" ")[0]] <= filter.studentCount : true) && !filter.excludeWeekdays.includes(day) && !filter.excludeSlots.includes(slot) ? "" : "hidden"}`,
            style: {
              backgroundColor: textToColor(item)
            },
            title: getClassKey2(isRegisterCourse).get(item.split(" (")[0]) || "",
            onClick: () => handleClassClick(item)
          },
          item.split("\n").map((line, index) => /* @__PURE__ */ React$1.createElement(React$1.Fragment, { key: line + index }, line, /* @__PURE__ */ React$1.createElement("br", null))),
          /* @__PURE__ */ React$1.createElement("span", { className: "text-lg mt-1" }, `${studentCount?.[item.split(" ")[0]] ?? ""} ${studentCount?.[item.split(" ")[0]] ? "students" : ""}`)
        );
      })
    ))))));
  };
  const FilterSection = ({
    filter,
    setFilter,
    studentCount,
    lecturerList,
    moveList,
    subject,
    changeSubjectForm,
    setIsLoading,
    send: send2,
    isRegisterCourse
  }) => {
    return /* @__PURE__ */ React$1.createElement("div", { className: "flex gap-6 items-center justify-between mb-3 mt-3" }, /* @__PURE__ */ React$1.createElement("div", { className: "flex items-center text-xl" }, /* @__PURE__ */ React$1.createElement(
      "select",
      {
        name: "",
        id: "",
        defaultValue: "",
        className: "border-2 rounded-md p-2 h-full",
        onChange: async (e) => {
          setIsLoading((prev) => ({
            ...prev,
            moving: true
          }));
          if (e.target.value) {
            send2(e.target.value, changeSubjectForm);
          }
        }
      },
      /* @__PURE__ */ React$1.createElement("option", { value: "", disabled: true }, "Tìm theo môn học"),
      moveList?.map((move) => /* @__PURE__ */ React$1.createElement(
        "option",
        {
          key: move.moveId,
          selected: subject.includes(move.subject),
          value: move?.moveId.replaceAll("_", "$")
        },
        `${move?.subject} (${move?.classId} - ${move?.lecturer.trim() == "" ? "N/A" : move?.lecturer})`
      ))
    ), /* @__PURE__ */ React$1.createElement(
      "select",
      {
        name: "",
        id: "",
        value: filter.lecturer,
        className: "ml-4 border-2 rounded-md p-2 !h-full",
        onChange: (e) => setFilter((prev) => ({
          ...prev,
          lecturer: e.target.value
        })),
        defaultValue: ""
      },
      /* @__PURE__ */ React$1.createElement("option", { value: "", disabled: true }, "Tìm theo giảng viên"),
      /* @__PURE__ */ React$1.createElement("option", { value: "" }, "Tất cả"),
      lecturerList?.map((lecture) => /* @__PURE__ */ React$1.createElement("option", { key: lecture, value: lecture }, lecture))
    ), /* @__PURE__ */ React$1.createElement(
      "input",
      {
        name: "search",
        id: "",
        className: "w-[140px] ml-4 border-2 rounded-md p-2",
        placeholder: "Tìm theo lớp",
        value: filter.classId,
        onChange: (e) => {
          setFilter((prev) => ({
            ...prev,
            classId: e.target.value
          }));
        }
      }
    ), /* @__PURE__ */ React$1.createElement("div", { className: "ml-4" }, /* @__PURE__ */ React$1.createElement("span", { className: "text-lg" }, "Lọc sĩ số ", `(≤ ${filter?.studentCount})`, " "), /* @__PURE__ */ React$1.createElement("span", { className: "flex gap-2 items-center" }, /* @__PURE__ */ React$1.createElement(
      "input",
      {
        type: "range",
        defaultValue: 100,
        value: filter.studentCount,
        min: Math.min(
          ...Object.values(studentCount).map((value) => Number(value))
        ) ?? 0,
        max: Math.max(
          ...Object.values(studentCount).map((value) => Number(value))
        ) ?? 100,
        onChange: (e) => {
          if (Object.keys(studentCount).length === 0) {
            alert(`Cần phải lấy sĩ số lớp trước`);
          } else {
            setFilter((prev) => ({
              ...prev,
              studentCount: e.target.value
            }));
          }
        }
      }
    ))), /* @__PURE__ */ React$1.createElement(
      "span",
      {
        className: "cursor-pointer inline-block ml-4 mt-1 rounded-full !text-sm p-1 font-semibold bg-slate-500 hover:bg-slate-400 text-white",
        onClick: () => setFilter({
          lecturer: "",
          classId: "",
          studentCount: Object.values(studentCount).length > 0 ? Math.max(
            ...Object.values(studentCount).map(
              (value) => Number(value)
            )
          ) ?? 100 : 100,
          excludeSlots: [],
          excludeWeekdays: []
        })
      },
      /* @__PURE__ */ React$1.createElement(
        "svg",
        {
          xmlns: "http://www.w3.org/2000/svg",
          width: 12,
          height: 12,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          className: "lucide lucide-x-icon lucide-x"
        },
        /* @__PURE__ */ React$1.createElement("path", { d: "M18 6 6 18" }),
        /* @__PURE__ */ React$1.createElement("path", { d: "m6 6 12 12" })
      )
    )));
  };
  const ClassListDetails = ({
    handleDownload: handleDownload2
  }) => {
    return /* @__PURE__ */ React$1.createElement("details", { className: "p-4 [&_svg]:open:-rotate-180 mt-4" }, /* @__PURE__ */ React$1.createElement("summary", { className: "flex cursor-pointer list-none items-center gap-4 text-xl" }, /* @__PURE__ */ React$1.createElement("div", null, /* @__PURE__ */ React$1.createElement(
      "svg",
      {
        className: "rotate-0 transform text-blue-700 transition-all duration-300",
        fill: "none",
        height: 20,
        width: 20,
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        viewBox: "0 0 24 24"
      },
      /* @__PURE__ */ React$1.createElement("polyline", { points: "6 9 12 15 18 9" })
    )), /* @__PURE__ */ React$1.createElement("div", { className: "flex gap-4 items-center" }, "Danh sách lớp hiện tại (", document.querySelector("#ctl00_mainContent_lblOldGroup")?.textContent, ")", /* @__PURE__ */ React$1.createElement(
      "div",
      {
        onClick: handleDownload2,
        className: "hover:bg-green-700 font-bold py-2 px-4 bg-green-500 text-white rounded-md"
      },
      "Tải danh sách lớp"
    ))), /* @__PURE__ */ React$1.createElement("div", { className: "h-[500px] overflow-y-scroll", id: "class-list" }));
  };
  const TimetableDetails = () => {
    return /* @__PURE__ */ React$1.createElement("details", { className: "p-4 [&_svg]:open:-rotate-180", style: { width: "100%" } }, /* @__PURE__ */ React$1.createElement("summary", { className: "flex cursor-pointer list-none items-center gap-4 text-xl font-semibold px-4 py-2 rounded-md border-2 border-[#F36B16] text-[#F36B16] hover:bg-[#F36B16] hover:text-black transition-all" }, /* @__PURE__ */ React$1.createElement("div", null, /* @__PURE__ */ React$1.createElement(
      "svg",
      {
        className: "rotate-0 transform transition-all duration-300",
        fill: "none",
        height: 20,
        width: 20,
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        viewBox: "0 0 24 24"
      },
      /* @__PURE__ */ React$1.createElement("polyline", { points: "6 9 12 15 18 9" })
    )), /* @__PURE__ */ React$1.createElement("div", null, "Thời khóa biểu")), /* @__PURE__ */ React$1.createElement(
      "iframe",
      {
        id: "myframe",
        src: "https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx",
        className: "w-full border",
        style: { width: "100%", height: "80vh", minHeight: "600px" }
      }
    ));
  };
  function App() {
    const url2 = window.location.href;
    const id = url2.slice(url2.indexOf("id=") + 3).split("&")[0];
    const formData = formGetter(id);
    const [message, setMessage] = React$1.useState("");
    let secondId = "";
    let subject = document.getElementById("ctl00_mainContent_lblSubject")?.textContent || "";
    let cached = localStorage.getItem(subject);
    let timeTableData = cached ? JSON.parse(cached) : null;
    const [timeTable, setTimeTable] = React$1.useState(timeTableData ? objectToMap(timeTableData) : classData);
    const [total, setTotal] = React$1.useState(0);
    const [gotten, setGotten] = React$1.useState(0);
    const [isLoading, setIsLoading] = React$1.useState({
      moving: false,
      fetching: false
    });
    const [version, setVersion] = React$1.useState("1.3.9");
    const [moveList, setMoveList] = React$1.useState([]);
    const [studentCount, setStudentCount] = React$1.useState({});
    const [changeSubjectForm, setChangeSubjectForm] = React$1.useState({});
    const [lecturerList, setLecturerList] = React$1.useState([]);
    const [filter, setFilter] = React$1.useState({
      lecturer: "",
      classId: "",
      studentCount: 100,
      excludeSlots: [],
      excludeWeekdays: []
    });
    const [isFull, setIsFull] = React$1.useState(false);
    const handleStudentCount = async () => {
      await sendTrackingEvent();
      setIsLoading((prev) => ({
        ...prev,
        fetching: true
      }));
      getCurrentStatus().then((res) => {
        console.log(res);
        setStudentCount(res);
        setIsLoading((prev) => ({
          ...prev,
          fetching: false
        }));
        setFilter((prev) => ({
          ...prev,
          studentCount: Math.max(...Object.values(res).map((value) => Number(value))) ?? 100
        }));
        alert("Đã lấy xong sĩ số!");
      });
    };
    React$1.useEffect(() => {
      const fetchInitialData = async () => {
        await crawlAndSave();
        try {
          const response = await nativeFetch(
            "https://ruskicoder.github.io/fap-moveout/noti.json",
            { cache: "no-cache" }
          );
          if (!response.ok) throw new Error("Failed to fetch");
          const data = await response.json();
          const message2 = `
          <div class="notification-container ${data.bg}">
            <span class="notification-dot animate-ping-slow mx-1"></span>
            <span class="notification-text font-semibold text-xl">
            ${data.message}
            </span>
            <span class="notification-dot animate-ping-slow mx-1"></span>
          </div>
        `;
          setMessage(message2);
          setVersion(data.version);
        } catch (error) {
          console.log("Notification fetch failed, using defaults");
          setMessage("");
          setVersion("1.3.9");
        }
      };
      fetchInitialData();
    }, []);
    React$1.useEffect(() => {
      const fetchClassListAndSubjects = async () => {
        nativeFetch(`https://fap.fpt.edu.vn/Course/Groups.aspx?group=${id}`).then((response) => response.text()).then((html) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const element = doc.querySelector("#ctl00_mainContent_divStudents");
          if (element) {
            document.getElementById("class-list")?.appendChild(element);
          }
        });
        const data = await getCurrentSubjects();
        setMoveList(data.currentSubjects);
        setChangeSubjectForm({
          __VIEWSTATE: data.__VIEWSTATE,
          __VIEWSTATEGENERATOR: data.__VIEWSTATEGENERATOR,
          __EVENTVALIDATION: data.__EVENTVALIDATION,
          ctl00_mainContent_ddlCampuses: data.ctl00_mainContent_ddlCampuses
        });
        handleToggleOldFeature();
      };
      fetchClassListAndSubjects();
    }, []);
    const refresh = async () => {
      await sendTrackingEvent();
      localStorage.removeItem(subject);
      window.location.reload();
    };
    const crawlAndSave = async () => {
      if (Date.now() < Number(localStorage.getItem("expireAt")) && timeTableData) {
        let lecturerList2 = [];
        slots.forEach((slot) => {
          weekdays.forEach((day) => {
            timeTable.get(day)?.get(slot)?.forEach((item) => {
              let lecturer = item.split("(")[1].replace(")", "").split(" ")[0];
              if (!lecturerList2.includes(lecturer)) {
                lecturerList2.push(lecturer);
              }
            });
          });
        });
        setLecturerList(lecturerList2);
        return;
      }
      const data = document.querySelector("#ctl00_mainContent_dllCourse")?.innerHTML || "";
      const doc = parseHTML(data);
      const classes = /* @__PURE__ */ new Map();
      classes.set(
        id,
        document.getElementById("ctl00_mainContent_lblOldGroup")?.innerText || ""
      );
      queryAll("option", doc).forEach((option) => {
        const value = getAttr(option, "value");
        if (value) {
          secondId = value;
          classes.set(value, getText(option));
        }
      });
      setTotal(classes.size);
      await secondFormGetter(secondId, id);
      for (const [key, _item] of classes) {
        formData.set("ctl00$mainContent$dllCourse", key);
        let nextClass;
        nextClass = await (await nativeFetch(window.location.href, {
          method: "POST",
          headers: {},
          body: formData
        })).text();
        const nextDoc = parseHTML(nextClass);
        const classInfo = getText(nextDoc.querySelector("#ctl00_mainContent_lblNewSlot"));
        const selectOptions = queryAll("#ctl00_mainContent_dllCourse option", nextDoc);
        const selectedOption = selectOptions.find((opt) => opt.hasAttribute("selected"));
        const className = selectedOption ? getText(selectedOption) : "";
        console.log("className", classInfo);
        const classDetail = classInfo.split(",");
        const lecture = classDetail[0].slice(
          classDetail[0].indexOf("Lecture:") + 9
        );
        const classRoom = classDetail[0].slice(
          classDetail[0].indexOf("RoomNo:") + 9,
          classDetail[0].indexOf(" - Lecture:")
        );
        for (const detail of classDetail) {
          const weekday = detail.slice(0, 3);
          const slot = detail.slice(11, 12);
          if (weekdays.indexOf(weekday) >= 0) {
            const updatedClassData = new Map(classData);
            const slotMap = updatedClassData.get(weekday) || /* @__PURE__ */ new Map();
            const classNames = slotMap.get(slot) || [];
            classNames.push(
              className + ` (${lecture.length > 0 ? lecture : "N/A"}) 
${classRoom}`
            );
            slotMap.set(slot, classNames);
            updatedClassData.set(weekday, slotMap);
            setTimeTable(updatedClassData);
          }
        }
        setGotten((prev) => prev + 1);
      }
      localStorage.setItem(subject, JSON.stringify(mapToObject(timeTable)));
      let lecturerListTemp = [];
      slots.forEach((slot) => {
        weekdays.forEach((day) => {
          timeTable.get(day)?.get(slot)?.forEach((item) => {
            if (!lecturerListTemp.includes(
              item.slice(item.indexOf("(") + 1, item.indexOf(")"))
            )) {
              let lecturer = item.slice(
                item.indexOf("(") + 1,
                item.indexOf(")")
              );
              console.log("lecturer temp", lecturer);
              lecturerListTemp.push(lecturer);
            }
          });
        });
      });
      console.log("lecturerListTemp", lecturerListTemp);
      setLecturerList(lecturerListTemp);
      localStorage.setItem(
        "expireAt",
        (Date.now() + 1e3 * 60 * 60 * 24).toString()
      );
    };
    const handleToggleOldFeature = () => {
      document.getElementById("ctl00_mainContent_divMoveSubject")?.classList.toggle("hidden");
      document.getElementById("ctl00_mainContent_divNewGroupInfo")?.classList.toggle("hidden");
    };
    const MoveToFilledClass = () => /* @__PURE__ */ React$1.createElement("div", { className: "text-xl font-semibold flex gap-6 items-center mt-4" }, /* @__PURE__ */ React$1.createElement(
      "a",
      {
        href: "https://github.com/ruskicoder/fap-moveout",
        target: "_blank",
        className: "text-blue-500 !no-underline transition-all duration-200 border-blue-500 border-b-2 hover:border-transparent"
      },
      "v1.3.9"
    ), /* @__PURE__ */ React$1.createElement(
      "a",
      {
        href: "https://github.com/ruskicoder/fap-moveout/issues",
        target: "_blank",
        className: "text-blue-500 !no-underline transition-all duration-200 border-blue-500 border-b-2 hover:border-transparent"
      },
      "Feedback 😇"
    ));
    const ShowOldFeature = () => /* @__PURE__ */ React$1.createElement("div", { className: "flex items-center gap-2 mt-4" }, /* @__PURE__ */ React$1.createElement(
      "input",
      {
        id: "showOldFeature",
        type: "checkbox",
        defaultChecked: false,
        onChange: handleToggleOldFeature
      }
    ), /* @__PURE__ */ React$1.createElement(
      "label",
      {
        className: "text-xl mb-0 mt-2 leading-none",
        htmlFor: "showOldFeature"
      },
      "Hiện chức năng FAP cũ"
    ));
    return /* @__PURE__ */ React$1.createElement("div", { className: "w-full" }, /* @__PURE__ */ React$1.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React$1.createElement(
      Header,
      {
        isLoading,
        refresh,
        handleStudentCount
      }
    ), /* @__PURE__ */ React$1.createElement(
      FilterSection,
      {
        filter,
        setFilter,
        studentCount,
        lecturerList,
        moveList,
        subject,
        changeSubjectForm,
        setIsLoading,
        isRegisterCourse: false,
        send
      }
    ), gotten < total && /* @__PURE__ */ React$1.createElement("span", { className: "my-4 flex gap-4 justify-between items-center w-full" }, /* @__PURE__ */ React$1.createElement("span", { className: "text-2xl" }, /* @__PURE__ */ React$1.createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: 24,
        height: 24,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        className: "lucide lucide-rotate-cw rotate"
      },
      /* @__PURE__ */ React$1.createElement("path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" }),
      /* @__PURE__ */ React$1.createElement("path", { d: "M21 3v5h-5" })
    )), /* @__PURE__ */ React$1.createElement(
      "progress",
      {
        value: gotten,
        max: total,
        className: "w-full border border-zinc-500"
      }
    ))), /* @__PURE__ */ React$1.createElement(
      "div",
      {
        className: "text-2xl mb-4",
        dangerouslySetInnerHTML: { __html: message }
      }
    ), /* @__PURE__ */ React$1.createElement(
      Timetable,
      {
        timeTable,
        filter,
        studentCount,
        getClassKey,
        sendTrackingEvent,
        setIsLoading,
        formData,
        setIsFull,
        subject,
        setFilter
      }
    ), /* @__PURE__ */ React$1.createElement(ClassListDetails, { handleDownload }), /* @__PURE__ */ React$1.createElement(TimetableDetails, null), /* @__PURE__ */ React$1.createElement(MoveToFilledClass, null), /* @__PURE__ */ React$1.createElement(ShowOldFeature, null));
  }
  function RegisterCourse() {
    const url2 = window.location.href;
    const id = url2.slice(url2.indexOf("id=") + 3).split("&")[0];
    const formData = formGetter(id, true);
    let secondId = "";
    let subject = document.getElementById("ctl00_mainContent_lblSubject")?.textContent || "";
    let cached = localStorage.getItem(subject);
    let timeTableData = cached ? JSON.parse(cached) : null;
    const [timeTable, setTimeTable] = React$1.useState(timeTableData ? objectToMap(timeTableData) : classData);
    const [total, setTotal] = React$1.useState(0);
    const [gotten, setGotten] = React$1.useState(0);
    const [isLoading, setIsLoading] = React$1.useState({
      moving: false,
      fetching: false
    });
    const [moveList, setMoveList] = React$1.useState([]);
    const [studentCount, setStudentCount] = React$1.useState({});
    const [changeSubjectForm, setChangeSubjectForm] = React$1.useState({});
    const [lecturerList, setLecturerList] = React$1.useState([]);
    const [filter, setFilter] = React$1.useState({
      lecturer: "",
      classId: "",
      studentCount: 100,
      excludeSlots: [],
      excludeWeekdays: []
    });
    const [isFull, setIsFull] = React$1.useState(false);
    const handleStudentCount = async () => {
      await sendTrackingEvent();
      setIsLoading((prev) => ({
        ...prev,
        fetching: true
      }));
      getCurrentStatus().then((res) => {
        setStudentCount(res);
        setIsLoading((prev) => ({
          ...prev,
          fetching: false
        }));
        setFilter((prev) => ({
          ...prev,
          studentCount: Math.max(...Object.values(res).map((value) => Number(value))) ?? 100
        }));
        alert("Đã lấy xong sĩ số!");
      });
    };
    React$1.useEffect(() => {
      const fetchInitialData = async () => {
        console.log("Register course ne");
        await crawlAndSave();
      };
      try {
        fetchInitialData();
      } catch (error) {
        console.log("error", error);
      }
    }, []);
    React$1.useEffect(() => {
      const fetchClassListAndSubjects = async () => {
        nativeFetch(`https://fap.fpt.edu.vn/Course/Groups.aspx?group=${id}`).then((response) => response.text()).then((html) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const element = doc.querySelector("#ctl00_mainContent_divStudents");
          if (element) {
            document.getElementById("class-list")?.appendChild(element);
          }
        });
        const data = await getCurrentSubjects();
        setMoveList(data.currentSubjects);
        setChangeSubjectForm({
          __VIEWSTATE: data.__VIEWSTATE,
          __VIEWSTATEGENERATOR: data.__VIEWSTATEGENERATOR,
          __EVENTVALIDATION: data.__EVENTVALIDATION,
          ctl00_mainContent_ddlCampuses: data.ctl00_mainContent_ddlCampuses
        });
        handleToggleOldFeature();
      };
      fetchClassListAndSubjects();
    }, []);
    const refresh = async () => {
      await sendTrackingEvent();
      localStorage.removeItem(subject);
      window.location.reload();
    };
    const crawlAndSave = async () => {
      const data = document.querySelector("#ctl00_mainContent_ddlGroups")?.innerHTML || "";
      const doc = parseHTML(data);
      const classes = /* @__PURE__ */ new Map();
      classes.set(
        id,
        document.getElementById("ctl00_mainContent_lblOldGroup")?.innerText || ""
      );
      queryAll("option", doc).forEach((option) => {
        const value = getAttr(option, "value");
        if (value) {
          secondId = value;
          classes.set(value, getText(option));
        }
      });
      setTotal(classes.size);
      await secondFormGetter(secondId, id);
      for (const [key, _item] of classes) {
        formData.set("ctl00$mainContent$ddlGroups", key);
        let nextClass;
        nextClass = await (await nativeFetch(window.location.href, {
          method: "POST",
          headers: {},
          body: formData
        })).text();
        const nextDoc = parseHTML(nextClass);
        const classInfo = getText(nextDoc.querySelector("#ctl00_mainContent_lblCourseInfo")).replaceAll(
          "(học tại nhà văn hóa Sinh viên, khu Đại học quốc gia)",
          ""
        );
        const selectOptions = queryAll("#ctl00_mainContent_ddlGroups option", nextDoc);
        const selectedOption = selectOptions.find((opt) => opt.hasAttribute("selected"));
        const className = selectedOption ? getText(selectedOption) : "";
        const classDetail = classInfo.split(",");
        const lecture = classDetail[0].slice(
          classDetail[0].indexOf("Lecture:") + 10
        );
        const classRoom = classDetail[0].slice(
          classDetail[0].indexOf("RoomNo:") + 9,
          classDetail[0].indexOf(" - Lecture:")
        ).replaceAll(
          "(học tại nhà văn hóa Sinh viên, khu Đại học quốc gia)",
          ""
        );
        for (const detail of classDetail) {
          const weekday = detail.slice(0, 3);
          const slot = detail.slice(11, 12);
          if (weekdays.indexOf(weekday) >= 0) {
            const updatedClassData = new Map(classData);
            const slotMap = updatedClassData.get(weekday) || /* @__PURE__ */ new Map();
            const classNames = slotMap.get(slot) || [];
            classNames.push(
              className + ` (${lecture.length > 0 ? lecture : "N/A"}) 
${classRoom}`
            );
            slotMap.set(slot, classNames);
            updatedClassData.set(weekday, slotMap);
            setTimeTable(updatedClassData);
          }
        }
        setGotten((prev) => prev + 1);
      }
      localStorage.setItem(subject, JSON.stringify(mapToObject(timeTable)));
      let lecturerListTemp = [];
      slots.forEach((slot) => {
        weekdays.forEach((day) => {
          timeTable.get(day)?.get(slot)?.forEach((item) => {
            if (!lecturerListTemp.includes(
              item.slice(item.indexOf("(") + 1, item.indexOf(")"))
            )) {
              lecturerListTemp.push(
                item.slice(item.indexOf("(") + 1, item.indexOf(")"))
              );
            }
          });
        });
      });
      setLecturerList(lecturerListTemp);
      localStorage.setItem(
        "expireAt",
        (Date.now() + 1e3 * 60 * 60 * 24).toString()
      );
    };
    const handleToggleOldFeature = () => {
      document.getElementById("ctl00_mainContent_divMoveSubject")?.classList.toggle("hidden");
      document.getElementById("ctl00_mainContent_divNewGroupInfo")?.classList.toggle("hidden");
    };
    const ShowOldFeature = () => /* @__PURE__ */ React$1.createElement("div", { className: "flex items-center gap-2 mt-4" }, /* @__PURE__ */ React$1.createElement(
      "input",
      {
        id: "showOldFeature",
        type: "checkbox",
        defaultChecked: false,
        onChange: handleToggleOldFeature
      }
    ), /* @__PURE__ */ React$1.createElement(
      "label",
      {
        className: "text-xl mb-0 mt-2 leading-none",
        htmlFor: "showOldFeature"
      },
      "Hiện chức năng FAP cũ"
    ));
    return /* @__PURE__ */ React$1.createElement("div", { className: "w-full" }, /* @__PURE__ */ React$1.createElement("div", { className: "my-8" }, /* @__PURE__ */ React$1.createElement(
      Header,
      {
        isLoading,
        refresh,
        handleStudentCount,
        isRegisterCourse: true
      }
    ), /* @__PURE__ */ React$1.createElement(
      FilterSection,
      {
        filter,
        setFilter,
        studentCount,
        lecturerList,
        moveList,
        subject,
        changeSubjectForm,
        setIsLoading,
        send,
        isRegisterCourse: true
      }
    ), gotten < total && /* @__PURE__ */ React$1.createElement("span", { className: "my-4 flex gap-4 justify-between items-center w-full" }, /* @__PURE__ */ React$1.createElement("span", { className: "text-2xl" }, /* @__PURE__ */ React$1.createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: 24,
        height: 24,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        className: "lucide lucide-rotate-cw rotate"
      },
      /* @__PURE__ */ React$1.createElement("path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" }),
      /* @__PURE__ */ React$1.createElement("path", { d: "M21 3v5h-5" })
    )), /* @__PURE__ */ React$1.createElement(
      "progress",
      {
        value: gotten,
        max: total,
        className: "w-full border border-zinc-500"
      }
    ))), isFull && /* @__PURE__ */ React$1.createElement("div", { className: "text-2xl mb-4" }, "Lớp đã full. Xem thêm tại", " ", /* @__PURE__ */ React$1.createElement(
      "a",
      {
        href: "https://github.com/ruskicoder/fap-moveout",
        target: "_blank",
        rel: "noreferrer"
      },
      "GitHub"
    )), /* @__PURE__ */ React$1.createElement(
      Timetable,
      {
        timeTable,
        filter,
        studentCount,
        getClassKey,
        sendTrackingEvent,
        setIsLoading,
        formData,
        setIsFull,
        subject,
        setFilter,
        isRegisterCourse: true
      }
    ), /* @__PURE__ */ React$1.createElement(TimetableDetails, null), /* @__PURE__ */ React$1.createElement(ShowOldFeature, null));
  }
  function initMoveOut() {
    console.info("[FAP-AIO Userscript] Initializing MoveOut module (standalone)");
    const url2 = window.location.href;
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
    const rootPath = "#aspnetForm > table > tbody > tr:nth-child(1) > td > div > h2";
    let rootContainer = document.querySelector(rootPath);
    if (!rootContainer) {
      rootContainer = document.querySelector("#aspnetForm > table > tbody > tr:nth-child(1) > td > div");
    }
    if (!rootContainer) {
      rootContainer = document.querySelector("#ctl00_mainContent_divMoveSubject")?.parentElement || document.body;
    }
    const appDiv = document.createElement("div");
    appDiv.id = "fap-moveout-root";
    rootContainer?.insertBefore(appDiv, rootContainer.firstChild);
    const rootElement = document.getElementById("fap-moveout-root");
    if (rootElement) {
      const root = ReactDOM$1.createRoot(rootElement);
      if (url2.startsWith("https://fap.fpt.edu.vn/FrontOffice/MoveSubject.aspx")) {
        root.render(React$1.createElement(App));
        console.info("[FAP-AIO Userscript] MoveOut App (MoveSubject) mounted");
      } else if (url2.startsWith("https://fap.fpt.edu.vn/FrontOffice/Courses.aspx")) {
        root.render(React$1.createElement(RegisterCourse));
        console.info("[FAP-AIO Userscript] MoveOut RegisterCourse mounted");
      }
    } else {
      console.warn("[FAP-AIO Userscript] Failed to find root element for MoveOut module");
    }
  }
  console.log("[FAP-AIO Userscript] Feature modules loaded");
  function initRouter() {
    const url2 = window.location.href;
    const pathname = window.location.pathname;
    console.info("[FAP-AIO Router] Current URL:", url2);
    console.info("[FAP-AIO Router] Pathname:", pathname);
    try {
      enhanceGlobalUI();
      if (pathname.includes("StudentTranscript.aspx")) {
        console.info("[FAP-AIO Router] Initializing GPA Calculator");
        initGPA();
      } else if (pathname.includes("Courses.aspx") || pathname.includes("MoveSubject.aspx")) {
        console.info("[FAP-AIO Router] Initializing MoveOut Tool");
        initMoveOut();
      } else if (pathname.includes("ScheduleExams.aspx") || pathname.includes("ScheduleOfWeek.aspx")) {
        console.info("[FAP-AIO Router] Initializing Scheduler");
        initScheduler();
      } else {
        console.info("[FAP-AIO Router] No feature match for current page, applying global enhancements only");
      }
    } catch (error) {
      console.error("[FAP-AIO Router] Error during feature initialization:", error);
    }
  }
  function enhanceGlobalUI() {
    try {
      console.info("[FAP-AIO Router] Applying global UI enhancements");
      dom.enhanceUI();
      console.info("[FAP-AIO Router] Global UI enhancements applied");
    } catch (error) {
      console.error("[FAP-AIO Router] Error applying global UI enhancements:", error);
    }
  }
  class StyleAdapter {
    constructor() {
      __publicField(this, "useGM");
      __publicField(this, "injectedStyles", /* @__PURE__ */ new Set());
      this.useGM = typeof GM_addStyle !== "undefined";
      if (!this.useGM) {
        console.warn("[FAP-AIO Style] GM_addStyle not available, using style elements");
      } else {
        console.info("[FAP-AIO Style] Using GM_addStyle");
      }
    }
    /**
     * Inject CSS into page
     * @param css - CSS string to inject
     * @param id - Optional ID to prevent duplicate injection
     */
    inject(css, id) {
      if (id && this.injectedStyles.has(id)) {
        console.info(`[FAP-AIO Style] Style '${id}' already injected, skipping`);
        return;
      }
      try {
        console.log(`[FAP-AIO Style] Injecting style${id ? ` '${id}'` : ""} (${css.length} bytes)`);
        if (this.useGM) {
          GM_addStyle(css);
          console.log(`[FAP-AIO Style] Successfully injected via GM_addStyle${id ? ` '${id}'` : ""}`);
        } else {
          const style = document.createElement("style");
          if (id) {
            style.id = `fap-aio-style-${id}`;
          }
          style.textContent = css;
          document.head.appendChild(style);
          console.log(`[FAP-AIO Style] Successfully injected via <style> element${id ? ` '${id}'` : ""}`);
        }
        if (id) {
          this.injectedStyles.add(id);
        }
      } catch (e) {
        console.error(`[FAP-AIO Style] Error injecting CSS${id ? ` '${id}'` : ""}:`, e);
      }
    }
    /**
     * Remove injected style (only works with fallback method)
     * @param id - ID of style to remove
     */
    remove(id) {
      if (!this.useGM && id) {
        try {
          const style = document.getElementById(`fap-aio-style-${id}`);
          if (style) {
            style.remove();
          }
        } catch (e) {
          console.error("[FAP-AIO Style] Error removing style:", e);
        }
      }
      this.injectedStyles.delete(id);
    }
  }
  const styleAdapter = new StyleAdapter();
  const userstyleCSS = `:root {\r
    --accent: #F36B16;\r
    --black: #000000;\r
    --text-light: #E0E0E0;\r
    --text-medium: #BDBDBD;\r
    --text-dark: #212121;\r
    --grey-dark: #1A1A1A;\r
    --grey-medium: #0f0905;\r
    --grey-light: #301403;\r
    --grey-darker: #150901;\r
    --border-color: #333333;\r
    --white: #FFFFFF;\r
    --red: #F44336;\r
    /* Material Design Red */\r
    --green: #4CAF50;\r
    /* Material Design Green */\r
    font-size: 16px;\r
    /* Base font size for rem calculation */\r
}\r
\r
body {\r
    background: var(--black) !important;\r
    color: var(--text-light) !important;\r
    font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif !important;\r
    background-repeat: no-repeat !important;\r
    background-attachment: fixed !important;\r
    line-height: 1.6 !important;\r
}\r
\r
h1,\r
h2,\r
h3,\r
h4,\r
h5,\r
h6 {\r
    color: var(--text-light) !important;\r
    margin-top: 0 !important;\r
}\r
\r
h1 span {\r
    color: var(--text-light);\r
}\r
\r
p {\r
    color: var(--text-medium);\r
    line-height: 1.6;\r
    margin-bottom: 1rem;\r
}\r
\r
#cssTable tbody tr {\r
    background-color: var(--grey-medium);\r
    color: var(--white);\r
}\r
\r
a {\r
    color: var(--accent) !important;\r
    text-decoration: none !important;\r
    padding: 0.125rem 0.3125rem;\r
    border-radius: 0.1875rem;\r
    transition: color 0.2s ease, background-color 0.2s ease !important;\r
}\r
\r
a:hover,\r
a:focus {\r
    color: var(--black) !important;\r
    background-color: var(--accent) !important;\r
    text-decoration: none !important;\r
}\r
\r
.breadcrumb {\r
    background-color: var(--black) !important;\r
    padding-left: 0 !important;\r
    margin-bottom: 1rem !important;\r
    display: block !important;\r
    visibility: visible !important;\r
    padding: 0.625rem 0 !important;\r
}\r
\r
.breadcrumb::after {\r
    content: "";\r
    display: table;\r
    clear: both;\r
}\r
\r
/* Back button styling */\r
.fap-back-button {\r
    float: left !important;\r
    margin-right: 1rem !important;\r
    padding: 0.3125rem 0.75rem !important;\r
    background-color: var(--grey-medium) !important;\r
    color: var(--text-light) !important;\r
    border-radius: 0.25rem !important;\r
    border: 0.0625rem solid var(--border-color) !important;\r
    text-decoration: none !important;\r
    display: inline-block !important;\r
    font-weight: 600 !important;\r
    transition: all 0.2s ease !important;\r
    line-height: 1.4 !important;\r
}\r
\r
.fap-back-button:hover {\r
    background-color: var(--accent) !important;\r
    color: var(--black) !important;\r
    border-color: var(--accent) !important;\r
}\r
\r
#ctl00_mainContent_img1 {\r
    background: transparent;\r
}\r
\r
#ctl00_lblNavigation b {\r
    color: var(--text-light);\r
    font-size: 1.125rem;\r
    /* ~18px */\r
}\r
\r
#ctl00_divUser {\r
    padding-top: 0.625rem;\r
    /* 10px */\r
    float: right !important;\r
    margin-right: 1rem !important;\r
}\r
\r
#ctl00_divUser::after {\r
    content: "";\r
    display: table;\r
    clear: both;\r
}\r
\r
.row > .col-md-6 > .col-md-12 {\r
    visibility: hidden;\r
    height: 0;\r
    /* Collapse the space it occupies */\r
    overflow: hidden;\r
    /* Prevent content spill */\r
    padding: 0;\r
    /* Remove padding */\r
    margin: 0;\r
    /* Remove margin */\r
}\r
\r
/* Title link styling */\r
h1 a, h2 a {\r
    color: var(--text-light) !important;\r
    text-decoration: none !important;\r
    padding: 0 !important;\r
    display: inline-block !important;\r
    transition: color 0.2s ease !important;\r
}\r
\r
h1 a:hover, h2 a:hover {\r
    color: var(--accent) !important;\r
    background-color: transparent !important;\r
}\r
\r
#ctl00_lblNavigation,\r
#chat-widget-container div {\r
    visibility: hidden;\r
    display: none;\r
    /* Also hide it from layout flow */\r
}\r
\r
\r
#ctl00_lblLogIn,\r
#ctl00_lblCampusName,\r
a.label-success,\r
span.label-success {\r
    background-color: var(--grey-medium);\r
    color: var(--text-light);\r
    padding: 0.3125rem 0.625rem;\r
    /* 5px 10px */\r
    border-radius: 0.25rem;\r
    /* 4px */\r
    text-shadow: none;\r
    box-shadow: none;\r
    border: 0.0625rem solid var(--border-color);\r
    /* 1px */\r
    display: inline-block;\r
    margin-left: 0.3125rem;\r
    /* 5px */\r
}\r
\r
#ctl00_divUser a.label-success:hover {\r
    background-color: var(--accent);\r
    color: var(--black);\r
    border-color: var(--accent);\r
}\r
\r
/* Schedule buttons - View Materials, Meet URL, and Edunext */\r
a.label-warning,\r
a.label-default,\r
a.label-primary[href*="edunext"],\r
.label-warning,\r
.label-default {\r
    background-color: transparent !important;\r
    color: var(--accent) !important;\r
    border: 2px solid var(--accent) !important;\r
    padding: 0.3125rem 0.625rem !important;\r
    border-radius: 0.25rem !important;\r
    text-shadow: none !important;\r
    box-shadow: none !important;\r
    display: inline-block !important;\r
    margin: 0.125rem !important;\r
    font-weight: 600 !important;\r
    transition: all 0.2s ease !important;\r
}\r
\r
a.label-warning:hover,\r
a.label-default:hover,\r
a.label-primary[href*="edunext"]:hover,\r
.label-warning:hover,\r
.label-default:hover {\r
    background-color: var(--accent) !important;\r
    color: var(--black) !important;\r
    border-color: var(--accent) !important;\r
}\r
\r
#ctl00_lblLogIn span {\r
    color: var(--accent);\r
    background-color: transparent;\r
    padding: 0;\r
    border: none;\r
    display: inline;\r
    /* margin: 0; Removed as it doesn't apply to display: inline */\r
}\r
#ctl00_lblLogIn span:hover {\r
    text-decoration: underline;\r
}\r
\r
.container {\r
    width: 95% !important;\r
    max-width: 1920px !important;\r
    min-width: 320px !important;\r
    margin-left: auto !important;\r
    margin-right: auto !important;\r
    padding-left: 1rem !important;\r
    padding-right: 1rem !important;\r
}\r
\r
.col-md-6 h1 {\r
    color: var(--text-light);\r
    font-weight: bold;\r
    margin-top: 0;\r
}\r
\r
.box {\r
    background-color: var(--grey-dark) !important;\r
    border: 0.0625rem solid var(--border-color) !important;\r
    /* 1px */\r
    padding: 0.9375rem !important;\r
    /* 15px */\r
    margin-bottom: 1.25rem !important;\r
    /* 20px */\r
    border-radius: 0.3125rem !important;\r
    /* 5px */\r
}\r
\r
.box h3 {\r
    margin-top: 0;\r
    padding-bottom: 0.625rem;\r
    /* 10px */\r
    border-bottom: 0.0625rem solid var(--border-color);\r
    /* 1px */\r
    margin-bottom: 0.9375rem;\r
    /* 15px */\r
    color: var(--accent);\r
}\r
\r
.blueTitle,\r
.orangeTitle {\r
    background: none;\r
    color: var(--accent);\r
}\r
\r
.table .table {\r
    background-color: var(--grey-light);\r
}\r
\r
b {\r
    color: var(--text-light);\r
    font-weight: bold;\r
    font-size: 1rem;\r
}\r
\r
ul {\r
    padding-left: 1.25rem;\r
    /* 20px */\r
    list-style: disc;\r
    /* Ensure bullets are visible */\r
}\r
\r
li {\r
    margin-bottom: 0.5rem;\r
    /* 8px */\r
    color: var(--text-medium);\r
}\r
\r
li a {\r
    padding: 0.0625rem 0.1875rem;\r
    /* 1px 3px */\r
}\r
\r
/* General table reset - no borders by default for layout tables */\r
table {\r
    border-collapse: collapse !important;\r
    border-spacing: 0 !important;\r
    width: 100%;\r
    margin-top: 0.625rem;\r
    background-color: var(--grey-medium) !important;\r
}\r
\r
/* Schedule-specific responsive table styling - only for schedule page */\r
/* Target the table containing the divContent div (invalid HTML structure) */\r
body:has(#ctl00_mainContent_divContent) table {\r
    width: 100% !important;\r
    table-layout: fixed !important;\r
    border-collapse: collapse !important;\r
}\r
\r
body:has(#ctl00_mainContent_divContent) table thead th,\r
body:has(#ctl00_mainContent_divContent) table tbody td {\r
    word-wrap: break-word !important;\r
    overflow-wrap: break-word !important;\r
    white-space: normal !important;\r
    overflow: hidden !important;\r
}\r
\r
/* First column (Slot) has fixed 80px width */\r
body:has(#ctl00_mainContent_divContent) table tbody td:first-child {\r
    width: 80px !important;\r
    max-width: 80px !important;\r
    min-width: 80px !important;\r
}\r
\r
/* Other columns split remaining width equally */\r
body:has(#ctl00_mainContent_divContent) table tbody td:not(:first-child) {\r
    width: calc((100% - 80px) / 7) !important;\r
}\r
\r
body:has(#ctl00_mainContent_divContent) table tbody td p {\r
    word-wrap: break-word !important;\r
    overflow-wrap: break-word !important;\r
    white-space: normal !important;\r
    margin: 0.25rem 0 !important;\r
    max-width: 100%;\r
}\r
\r
/* Data tables with Bootstrap classes get borders */\r
.table {\r
    border: 1px solid var(--border-color) !important;\r
    margin-bottom: 1rem !important;\r
}\r
\r
.table-bordered,\r
.table-hover {\r
    border-collapse: collapse !important;\r
}\r
\r
.table thead {\r
    background-color: var(--grey-medium) !important;\r
}\r
\r
.table thead th {\r
    border: 1px solid var(--border-color) !important;\r
    background-color: var(--grey-medium) !important;\r
    color: var(--text-light) !important;\r
    font-weight: bold !important;\r
    text-align: center !important;\r
    padding: 0.75rem !important;\r
}\r
\r
.table tbody td {\r
    border: 1px solid var(--border-color) !important;\r
    background-color: var(--grey-medium) !important;\r
    color: var(--text-light) !important;\r
    padding: 0.625rem 0.9375rem !important;\r
}\r
\r
/* Specific styling for bordered tables */\r
.table-bordered th,\r
.table-bordered td {\r
    border: 1px solid var(--border-color) !important;\r
}\r
\r
/* Hover effect for table-hover */\r
.table-hover tbody tr:hover {\r
    background-color: var(--grey-dark) !important;\r
}\r
\r
/* Alternate row colors for better readability */\r
.table tbody tr:nth-child(even) td {\r
    background-color: var(--grey-darker) !important;\r
}\r
\r
.table tbody tr:nth-child(odd) td {\r
    background-color: var(--grey-medium) !important;\r
}\r
\r
caption {\r
    color: var(--text-medium);\r
    padding-bottom: 0.625rem;\r
    caption-side: top;\r
    text-align: left;\r
}\r
\r
/* Style schedule notice text prominently */\r
#ctl00_mainContent_ghichuHCM p.auto-style2,\r
#ctl00_mainContent_ghichuHCM .auto-style2 {\r
    font-size: 1.5rem !important;\r
    color: var(--accent) !important;\r
    border: 2px solid var(--accent) !important;\r
    padding: 0.75rem 1rem !important;\r
    border-radius: 0.375rem !important;\r
    background-color: rgba(243, 107, 22, 0.1) !important;\r
    font-weight: bold !important;\r
    display: inline-block !important;\r
    margin: 0.5rem 0 !important;\r
}\r
\r
#ctl00_mainContent_ghichuHCM p.auto-style2 b,\r
#ctl00_mainContent_ghichuHCM .auto-style2 b {\r
    color: var(--accent) !important;\r
}\r
\r
/* Table header auto-style2 - keep normal table cell display */\r
thead th.auto-style2,\r
table tr td.auto-style2 {\r
    display: table-cell !important;\r
    font-size: 14pt !important;\r
    color: var(--text-light) !important;\r
    background-color: var(--grey-medium) !important;\r
    font-weight: bold !important;\r
    text-align: center !important;\r
    border: 1px solid var(--border-color) !important;\r
    padding: 0.625rem !important;\r
}\r
\r
.row{\r
    background-color: var(--black) !important;\r
}\r
\r
/* Default th/td styling (for layout tables without .table class) */\r
th,\r
td {\r
    padding: 0.625rem 0.9375rem !important;\r
    background-color: var(--grey-medium) !important;\r
    color: var(--text-light) !important;\r
    vertical-align: top !important;\r
}\r
\r
/* Override for layout tables that should have minimal styling */\r
table:not(.table) th,\r
table:not(.table) td {\r
    border: none !important;\r
    padding: 0.3rem 0.5rem !important;\r
}\r
\r
input[type=submit] {\r
    border: 0.0625rem solid var(--border-color);\r
    background-color: var(--grey-medium);\r
    color: var(--text-light);\r
    border-radius: 0.25rem;\r
}\r
\r
input[type=submit]:hover {\r
    border: 0.0625rem solid var(--border-color);\r
    background-color: var(--grey-light);\r
    color: var(--accent);\r
    \r
}\r
\r
thead th,\r
.auto-style2 {\r
    background-color: var(--grey-medium);\r
    color: var(--text-light);\r
    font-weight: bold;\r
    text-align: center;\r
}\r
\r
td span,\r
td div,\r
td p {\r
    color: var(--text-light) !important;\r
    /* Ensure override */\r
    background-color: transparent !important;\r
    font-size: inherit !important;\r
}\r
\r
td span[style*="color:black"],\r
td div[style*="color:black"],\r
td p[style*="color:black"] {\r
    color: var(--text-light) !important;\r
}\r
\r
td span[style*="color:#2F5597"] {\r
    color: var(--accent) !important;\r
}\r
\r
td p[style*="background-color: #009900;"] {\r
    background-color: var(--accent) !important;\r
    padding: 0.3125rem;\r
    /* 5px */\r
    border-radius: 0.1875rem;\r
    /* 3px */\r
}\r
td p[style*="background-color: #009900;"] span {\r
    color: var(--black) !important;\r
}\r
\r
.btn {\r
    background-color: var(--accent) !important;\r
    color: var(--black) !important;\r
    border: none !important;\r
    padding: 0.5rem 0.9375rem !important;\r
    /* 8px 15px */\r
    border-radius: 0.25rem !important;\r
    /* 4px */\r
    cursor: pointer !important;\r
    transition: background-color 0.2s ease !important;\r
    font-weight: bold !important;\r
    text-transform: uppercase !important;\r
    display: inline-block !important;\r
    text-decoration: none !important;\r
    text-align: center !important;\r
    margin: 0.3125rem !important;\r
    /* 5px */\r
    line-height: normal !important;\r
    /* Ensure button text aligns */\r
}\r
\r
.btn:hover,\r
.btn:focus {\r
    background-color: #d15a13;\r
    color: var(--black);\r
}\r
\r
.btn-warning {\r
    background-color: var(--accent);\r
    color: var(--black);\r
}\r
.btn-warning:hover {\r
    background-color: #d15a13;\r
    color: var(--black);\r
}\r
.btn-success {\r
    background-color: var(--accent);\r
    color: var(--black);\r
}\r
.btn-success:hover {\r
    background-color: #d15a13;\r
    color: var(--black);\r
}\r
.btn-danger {\r
    background-color: var(--grey-light);\r
    color: var(--text-light);\r
}\r
.btn-danger:hover {\r
    background-color: var(--grey-medium);\r
    color: var(--text-light);\r
}\r
\r
input[type="text"],\r
input[type="email"],\r
input[type="password"],\r
select,\r
textarea {\r
    background-color: var(--grey-medium) !important;\r
    color: var(--text-light) !important;\r
    border: 0.0625rem solid var(--border-color) !important;\r
    /* 1px */\r
    padding: 0.5rem 0.625rem !important;\r
    /* 8px 10px */\r
    border-radius: 0.25rem !important;\r
    /* 4px */\r
    width: 100% !important;\r
    box-sizing: border-box !important;\r
    margin-bottom: 0.625rem !important;\r
    /* 10px */\r
    font-size: 1rem !important;\r
    /* Ensure form elements scale */\r
}\r
\r
input[type="text"]:focus,\r
input[type="email"]:focus,\r
input[type="password"]:focus,\r
select:focus,\r
textarea:focus {\r
    outline: none;\r
    border-color: var(--accent);\r
    box-shadow: 0 0 0 0.125rem rgba(243, 107, 22, 0.3);\r
    /* 2px */\r
}\r
\r
input[type="submit"],\r
button {\r
    /* Inherit .btn styles */\r
}\r
\r
#ctl00_mainContent_btCancel,\r
#ctl00_mainContent_btSave {\r
    /* Inherit .btn styles */\r
}\r
\r
#ctl00_mainContent_divHocphi span,\r
#ctl00_mainContent_lblAccount {\r
    color: var(--accent);\r
    font-weight: bold;\r
}\r
#ctl00_mainContent_divHocphi {\r
    background-color: var(--grey-dark);\r
    border: 0.0625rem solid var(--accent);\r
    /* 1px */\r
    padding: 0.9375rem;\r
    /* 15px */\r
    border-radius: 0.3125rem;\r
    /* 5px */\r
    margin-bottom: 1.25rem;\r
    /* 20px */\r
    color: var(--text-medium);\r
}\r
#ctl00_mainContent_lblAccount b {\r
    color: var(--text-light);\r
}\r
\r
.listBoxWrapper {\r
    /* Styling context */\r
}\r
\r
.listBoxWrapper b {\r
    color: var(--text-light);\r
}\r
\r
.modal {\r
    background-color: rgba(0, 0, 0, 0.8);\r
    display: none;\r
    position: fixed;\r
    inset: 0;\r
    /* Replaces top/left/right/bottom: 0 */\r
    z-index: 1050;\r
    overflow-y: auto;\r
}\r
.modal.show {\r
    display: block;\r
}\r
\r
.modal-dialog {\r
    margin: 3.125rem auto;\r
    /* 50px */\r
    max-width: 500px;\r
    /* Example constraint */\r
    width: 90%;\r
    /* Responsive width */\r
}\r
\r
.modal-content {\r
    background-color: var(--grey-dark);\r
    border: 0.0625rem solid var(--border-color);\r
    /* 1px */\r
    border-radius: 0.375rem;\r
    /* 6px */\r
    color: var(--text-light);\r
}\r
\r
.modal-header {\r
    border-bottom: 0.0625rem solid var(--border-color);\r
    /* 1px */\r
    padding: 0.9375rem;\r
    /* 15px */\r
}\r
\r
.modal-header .modal-title {\r
    color: var(--accent);\r
    margin: 0;\r
    /* Reset default margin */\r
    line-height: 1.4;\r
    /* Adjust line height */\r
}\r
\r
.modal-header .close {\r
    color: var(--text-light);\r
    opacity: 0.8;\r
    text-shadow: none;\r
    background: transparent;\r
    border: none;\r
    font-size: 1.5rem;\r
    padding: 0;\r
    /* Remove padding */\r
    float: right;\r
    /* Position correctly */\r
    cursor: pointer;\r
}\r
.modal-header .close:hover {\r
    color: var(--text-light);\r
    opacity: 1;\r
}\r
\r
.modal-body {\r
    padding: 0.9375rem;\r
    /* 15px */\r
    color: var(--text-medium);\r
}\r
\r
.modal-footer {\r
    border-top: 0.0625rem solid var(--border-color);\r
    /* 1px */\r
    padding: 0.9375rem;\r
    /* 15px */\r
    text-align: right;\r
}\r
.modal-footer center {\r
    text-align: right;\r
    margin-right: 0;\r
}\r
\r
#cssTable {\r
    border: none !important;\r
    margin-top: 1.25rem;\r
    /* 20px */\r
    background-color: var(--grey-dark);\r
    padding: 0.9375rem;\r
    /* 15px */\r
    border-radius: 0.3125rem;\r
    /* 5px */\r
}\r
#cssTable td {\r
    border: none;\r
    background: transparent;\r
    padding: 0.3125rem 0;\r
    /* 5px 0 */\r
}\r
#cssTable p {\r
    color: var(--text-medium);\r
    text-align: center;\r
    width: 100%;\r
    margin-bottom: 0;\r
}\r
#cssTable a {\r
    color: var(--accent);\r
}\r
#cssTable a:hover {\r
    color: var(--black);\r
    background-color: var(--accent);\r
}\r
\r
#ctl00_divSupporthcm {\r
    color: var(--text-medium);\r
    margin-bottom: 0.625rem;\r
    /* 10px */\r
    padding-bottom: 0.625rem;\r
    /* 10px */\r
    border-bottom: 0.0625rem solid var(--border-color);\r
    /* 1px */\r
}\r
#ctl00_divSupporthcm strong {\r
    color: var(--text-light);\r
}\r
#ctl00_divSupporthcm a,\r
#ctl00_divSupporthcm a span {\r
    color: var(--accent) !important;\r
    background: none !important;\r
}\r
#ctl00_divSupporthcm a:hover,\r
#ctl00_divSupporthcm a:hover span {\r
    text-decoration: underline !important;\r
    background-color: transparent !important;\r
    /* Ensure no background on hover */\r
    color: var(--accent) !important;\r
    /* Keep color on hover */\r
}\r
\r
img[src*="New_icons_10.gif"] {\r
    filter: invert(47%) sepia(93%) saturate(1457%) hue-rotate(359deg) brightness(97%) contrast(93%);\r
    /* Generated filter for --accent */\r
    margin-left: 0.3125rem;\r
    /* 5px */\r
    vertical-align: middle;\r
    width: 1em;\r
    /* Scale with text */\r
    height: 1em;\r
    /* Scale with text */\r
}\r
\r
/* Semester color cycle (10 colors, sequential order) - Fall2023 is position 0 */\r
/* Color 1: #4e1445 */\r
table td.Fall2023, table td.Summer2020, table td.Spring2027, table td.Fall2030, table td.Summer2034, table td.Spring2038,\r
table th.Fall2023, table th.Summer2020, table th.Spring2027, table th.Fall2030, table th.Summer2034, table th.Spring2038 { \r
    background-color: #4e1445 !important; \r
}\r
/* Color 2: #2a144e */\r
table td.Spring2024, table td.Fall2020, table td.Summer2027, table td.Spring2031, table td.Fall2034, table td.Summer2038,\r
table th.Spring2024, table th.Fall2020, table th.Summer2027, table th.Spring2031, table th.Fall2034, table th.Summer2038 { \r
    background-color: #2a144e !important; \r
}\r
/* Color 3: #17144e */\r
table td.Summer2024, table td.Spring2021, table td.Fall2027, table td.Summer2031, table td.Spring2035, table td.Fall2038,\r
table th.Summer2024, table th.Spring2021, table th.Fall2027, table th.Summer2031, table th.Spring2035, table th.Fall2038 { \r
    background-color: #17144e !important; \r
}\r
/* Color 4: #143c4e */\r
table td.Fall2024, table td.Summer2021, table td.Spring2028, table td.Fall2031, table td.Summer2035, table td.Spring2039,\r
table th.Fall2024, table th.Summer2021, table th.Spring2028, table th.Fall2031, table th.Summer2035, table th.Spring2039 { \r
    background-color: #143c4e !important; \r
}\r
/* Color 5: #144e40 */\r
table td.Spring2025, table td.Fall2021, table td.Summer2028, table td.Spring2032, table td.Fall2035, table td.Summer2039,\r
table th.Spring2025, table th.Fall2021, table th.Summer2028, table th.Spring2032, table th.Fall2035, table th.Summer2039 { \r
    background-color: #144e40 !important; \r
}\r
/* Color 6: #144e15 */\r
table td.Summer2025, table td.Spring2022, table td.Fall2028, table td.Summer2032, table td.Spring2036, table td.Fall2039,\r
table th.Summer2025, table th.Spring2022, table th.Fall2028, table th.Summer2032, table th.Spring2036, table th.Fall2039 { \r
    background-color: #144e15 !important; \r
}\r
/* Color 7: #4e4d14 */\r
table td.Fall2025, table td.Summer2022, table td.Spring2029, table td.Fall2032, table td.Summer2036, table td.Spring2040,\r
table th.Fall2025, table th.Summer2022, table th.Spring2029, table th.Fall2032, table th.Summer2036, table th.Spring2040 { \r
    background-color: #4e4d14 !important; \r
}\r
/* Color 8: #4e3314 */\r
table td.Spring2026, table td.Fall2022, table td.Summer2029, table td.Spring2033, table td.Fall2036, table td.Summer2040,\r
table th.Spring2026, table th.Fall2022, table th.Summer2029, table th.Spring2033, table th.Fall2036, table th.Summer2040 { \r
    background-color: #4e3314 !important; \r
}\r
/* Color 9: #4e1614 */\r
table td.Summer2026, table td.Spring2023, table td.Fall2029, table td.Summer2033, table td.Spring2037, table td.Fall2040,\r
table th.Summer2026, table th.Spring2023, table th.Fall2029, table th.Summer2033, table th.Spring2037, table th.Fall2040 { \r
    background-color: #4e1614 !important; \r
}\r
/* Color 10: #4e1438 */\r
table td.Fall2026, table td.Summer2023, table td.Spring2030, table td.Fall2033, table td.Summer2037,\r
table th.Fall2026, table th.Summer2023, table th.Spring2030, table th.Fall2033, table th.Summer2037 { \r
    background-color: #4e1438 !important; \r
}\r
/* Earlier semesters (2019-2020) */\r
table td.Fall2019, table td.Spring2020,\r
table th.Fall2019, table th.Spring2020 { \r
    background-color: #4e3314 !important; \r
}\r
\r
/* Status highlighting */\r
table td span.status-passed,\r
table th span.status-passed {\r
    background-color: #144e15 !important;\r
    color: var(--text-light) !important;\r
    padding: 0.3125rem 0.625rem !important;\r
    border-radius: 0.25rem !important;\r
    display: inline-block !important;\r
}\r
\r
table td span.status-not-passed,\r
table th span.status-not-passed {\r
    background-color: #4e1614 !important;\r
    color: var(--text-light) !important;\r
    padding: 0.3125rem 0.625rem !important;\r
    border-radius: 0.25rem !important;\r
    display: inline-block !important;\r
}\r
\r
/* GPA color coding */\r
.gpa-failed {\r
    color: #ff4444 !important;\r
}\r
.gpa-average {\r
    color: #ff9244 !important;\r
}\r
.gpa-good {\r
    color: #44aaff !important;\r
}\r
.gpa-verygood {\r
    color: #44ff44 !important;\r
}\r
.gpa-excellent {\r
    color: #ff44ff !important;\r
}\r
\r
a.__cf_email__,\r
span.__cf_email__ {\r
    color: var(--accent) !important;\r
}\r
a.__cf_email__:hover {\r
    color: var(--black) !important;\r
    background-color: var(--accent) !important;\r
}\r
`;
  const tailwindCSS = "@tailwind base;\r\n@tailwind components;\r\n@tailwind utilities;\r\n";
  const gpaCSS = "#gpa-panel {\r\n  overflow: hidden;\r\n  transition: max-height 0.2s ease-out;\r\n  width: 100%;\r\n}\r\n\r\n.gpa-tab-container {\r\n  margin-bottom: 20px;\r\n}\r\n\r\n.gpa-tab-buttons {\r\n  display: flex;\r\n  gap: 12px;\r\n  padding: 0;\r\n}\r\n\r\n.gpa-tab-btn {\r\n  padding: 10px 24px;\r\n  background: transparent;\r\n  border: 2px solid #F36B16;\r\n  color: #F36B16;\r\n  border-radius: 8px;\r\n  font-size: 14px;\r\n  font-weight: 600;\r\n  cursor: pointer;\r\n  transition: all 0.2s ease;\r\n  box-shadow: none;\r\n}\r\n\r\n.gpa-tab-btn:hover {\r\n  background: rgba(243, 107, 22, 0.1);\r\n  border-color: #ff7a1f;\r\n  color: #ff7a1f;\r\n  transform: translateY(-1px);\r\n  box-shadow: 0 2px 8px rgba(243, 107, 22, 0.2);\r\n}\r\n\r\n.gpa-tab-btn.active {\r\n  background: linear-gradient(135deg, #F36B16 0%, #e65a00 100%);\r\n  color: #000000;\r\n  border-color: #F36B16;\r\n  box-shadow: 0 2px 8px rgba(243, 107, 22, 0.3);\r\n}\r\n\r\n.gpa-tab-btn.active:hover {\r\n  background: linear-gradient(135deg, #ff7a1f 0%, #F36B16 100%);\r\n  transform: translateY(-1px);\r\n  box-shadow: 0 4px 12px rgba(243, 107, 22, 0.4);\r\n}\r\n\r\n#gpa-btn {\r\n  cursor: pointer;\r\n}\r\n\r\n#help-btn {\r\n  cursor: pointer;\r\n}\r\n\r\n.bl-btn {\r\n  margin-left: 2pt;\r\n  color: white;\r\n}\r\n\r\n#total-gpa {\r\n  font-size: 28px !important;\r\n  font-weight: bold !important;\r\n}\r\n#total-credit {\r\n  font-size: 24px !important;\r\n  font-weight: bold !important;\r\n}\r\n#semester-gpa {\r\n  font-size: 24px !important;\r\n  font-weight: bold !important;\r\n}\r\n\r\ninput.edit {\r\n  border: 1px solid #cfcfcf !important;\r\n  padding: 2px 8px !important;\r\n  border-radius: 8px !important;\r\n  outline: #4198fc !important;\r\n}\r\n\r\n.test {\r\n  margin-left: 2pt;\r\n  color: #cfcfcffa;\r\n}\r\n\r\n.subject-block {\r\n  display: inline-block;\r\n  margin-right: 5px;\r\n}\r\n\r\n#gpa-table .label {\r\n  line-height: 2 !important;\r\n}\r\n\r\n.subject-block .code {\r\n  z-index: 9999999;\r\n  position: relative;\r\n}\r\n\r\n.subject-block .point {\r\n  margin-left: -3px;\r\n  position: relative;\r\n}\r\n\r\n.non-gpa {\r\n  font-size: 10pt !important;\r\n  line-height: 2 !important;\r\n  /* position: relative; */\r\n}\r\n\r\n.non-gpa-delete {\r\n  margin-left: -4px;\r\n  margin-right: 2px;\r\n  /* position: relative; */\r\n}\r\n\r\n.w-25 {\r\n  width: 25%;\r\n}\r\n\r\n.w-50 {\r\n  width: 50%;\r\n}\r\n\r\n.w-100 {\r\n  width: 100%;\r\n}\r\n\r\n.spacing-h {\r\n  margin-top: 10px;\r\n  margin-bottom: 10px;\r\n}\r\n\r\n.inline-block {\r\n  display: inline-block;\r\n}\r\n\r\n.inline {\r\n  display: inline;\r\n}\r\n\r\n.form-control {\r\n  border-radius: 8px 0 0 8px !important;\r\n}\r\n\r\n.input-group-btn span {\r\n  border-radius: 0 10px 10px 0 !important;\r\n}\r\n\r\n.hidden {\r\n  display: none;\r\n}\r\n\r\n.margin-8 {\r\n  margin: 8px;\r\n}\r\n\r\n.reset-btn {\r\n  cursor: pointer;\r\n}\r\n\r\n.reset-btn:hover {\r\n  opacity: 0.8;\r\n  transition: opacity 0.2s ease-in-out;\r\n}\r\n\r\n/* Enhanced GPA Color Coding */\r\n.gpa-failed {\r\n  color: #ff4444 !important;\r\n}\r\n\r\n.gpa-average {\r\n  color: #ff9244 !important;\r\n}\r\n\r\n.gpa-good {\r\n  color: #44aaff !important;\r\n}\r\n\r\n.gpa-verygood {\r\n  color: #44ff44 !important;\r\n}\r\n\r\n.gpa-excellent {\r\n  color: #ff44ff !important;\r\n}\r\n\r\n/* Total GPA Header */\r\n.total-gpa-header {\r\n  width: 100%;\r\n  display: flex;\r\n  justify-content: space-between;\r\n  align-items: center;\r\n  padding: 10px 15px;\r\n  background: #f8f9fa;\r\n  border: 1px solid #dee2e6;\r\n  border-radius: 4px;\r\n  margin-bottom: 10px;\r\n}\r\n\r\n.total-gpa-header .credits {\r\n  display: flex;\r\n  flex-direction: column;\r\n}\r\n\r\n.total-gpa-header .credits .label {\r\n  font-size: 12px;\r\n  font-weight: normal;\r\n  margin-bottom: 3px;\r\n}\r\n\r\n.total-gpa-header .credits .value {\r\n  font-size: 22px;\r\n  font-weight: bold;\r\n}\r\n\r\n.total-gpa-header .gpa {\r\n  display: flex;\r\n  flex-direction: column;\r\n  align-items: flex-end;\r\n}\r\n\r\n.total-gpa-header .gpa .label {\r\n  font-size: 12px;\r\n  font-weight: normal;\r\n  margin-bottom: 3px;\r\n}\r\n\r\n.total-gpa-header .gpa .value {\r\n  font-size: 42px;\r\n  font-weight: bold;\r\n}\r\n\r\n/* Collapsible Semester Blocks */\r\n.semester-block {\r\n  margin-bottom: 6px;\r\n  border: 1px solid #dee2e6;\r\n  border-radius: 4px;\r\n}\r\n\r\n.semester-header {\r\n  display: flex;\r\n  align-items: center;\r\n  padding: 8px 12px;\r\n  background: #f8f9fa;\r\n  cursor: pointer;\r\n  user-select: none;\r\n  transition: background 0.2s;\r\n}\r\n\r\n.semester-header:hover {\r\n  background: #e9ecef;\r\n}\r\n\r\n.semester-header .term-number {\r\n  font-weight: bold;\r\n  margin-right: 8px;\r\n  min-width: 25px;\r\n}\r\n\r\n.semester-header .semester-info {\r\n  flex: 1;\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n}\r\n\r\n.semester-header .semester-gpa {\r\n  font-size: 24px;\r\n  font-weight: bold;\r\n  margin-left: auto;\r\n}\r\n\r\n.semester-content {\r\n  padding: 8px;\r\n  background: white;\r\n}\r\n\r\n.semester-content.collapsed {\r\n  display: none;\r\n}\r\n\r\n/* Subject Table */\r\n.subject-table {\r\n  width: 100%;\r\n  border-collapse: collapse;\r\n}\r\n\r\n.subject-table td {\r\n  padding: 4px 3px;\r\n  border: 1px solid #dee2e6;\r\n  text-align: center;\r\n  vertical-align: middle;\r\n  width: 12.5%;\r\n}\r\n\r\n.subject-table .subject-cell {\r\n  font-size: 13px;\r\n  line-height: 1.4;\r\n}\r\n\r\n.subject-table .subject-code {\r\n  font-weight: bold;\r\n  display: block;\r\n  margin-bottom: 2px;\r\n  font-size: 12px;\r\n}\r\n\r\n.subject-table .subject-grade {\r\n  font-size: 14px;\r\n  font-weight: bold;\r\n  display: block;\r\n}\r\n\r\n/* Edit Table Specific Styles */\r\n.edit-table {\r\n  width: 100%;\r\n  border-collapse: collapse;\r\n  margin-top: 8px;\r\n}\r\n\r\n.edit-table th {\r\n  background: #f8f9fa;\r\n  padding: 8px;\r\n  border: 1px solid #dee2e6;\r\n  text-align: center;\r\n  font-weight: bold;\r\n  font-size: 13px;\r\n}\r\n\r\n.edit-table td {\r\n  padding: 6px 8px;\r\n  border: 1px solid #dee2e6;\r\n  text-align: center;\r\n  vertical-align: middle;\r\n  font-size: 13px;\r\n}\r\n\r\n.reset-btn:hover {\r\n  opacity: 0.8;\r\n}\r\n";
  const moveoutCSS = "/* Ensure FAP date info remains visible */\r\n#ctl00_mainContent_lblDateInfo {\r\n  display: block !important;\r\n  visibility: visible !important;\r\n  opacity: 1 !important;\r\n  color: inherit !important;\r\n  font-size: 14px;\r\n  padding: 10px 0;\r\n  background-color: #fff3cd;\r\n  border: 1px solid #ffc107;\r\n  border-radius: 4px;\r\n  padding: 10px;\r\n  margin-bottom: 10px;\r\n}\r\n\r\nprogress {\r\n  border-radius: 8px;\r\n  width: 80%;\r\n  height: 20px;\r\n  border: 2px solid rgba(32, 32, 32, 0.747);\r\n}\r\n\r\nprogress::-webkit-progress-bar {\r\n  background-color: rgb(255, 255, 255);\r\n  border-radius: 7px;\r\n}\r\n\r\nprogress::-webkit-progress-value {\r\n  background-color: rgb(21, 255, 0);\r\n  border-radius: 7px;\r\n  animation: skeletonLoading 2s linear infinite;\r\n}\r\n\r\nprogress::-moz-progress-bar {\r\n  background-color: rgb(255, 255, 255);\r\n  border-radius: 7px;\r\n}\r\n\r\n@keyframes skeletonLoading {\r\n  0% {\r\n    background-color: rgb(21, 255, 0);\r\n    opacity: 0.5;\r\n  }\r\n  100% {\r\n    background-color: rgb(226, 120, 96);\r\n    opacity: 1;\r\n  }\r\n}\r\n\r\n.rotate {\r\n  animation: rotate 1s linear infinite;\r\n}\r\n\r\n@keyframes rotate {\r\n  from {\r\n    transform: rotate(0deg);\r\n  }\r\n  to {\r\n    transform: rotate(360deg);\r\n  }\r\n}\r\n\r\n/* Notification / decorative message styles */\r\n.notification-container {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 0.75rem;\r\n  padding: 0.5rem 1rem;\r\n  border-radius: 0.5rem;\r\n  background: #22c55e;\r\n  color: white;\r\n  box-shadow: 0 10px 30px rgba(6, 182, 212, 0.12);\r\n}\r\n\r\n.notification-dot {\r\n  width: 0.6rem;\r\n  height: 0.6rem;\r\n  background: white;\r\n  border-radius: 9999px;\r\n}\r\n\r\n@keyframes pingSlow {\r\n  0% {\r\n    transform: scale(1);\r\n    opacity: 1;\r\n  }\r\n  75% {\r\n    transform: scale(2);\r\n    opacity: 0;\r\n  }\r\n  100% {\r\n    opacity: 0;\r\n  }\r\n}\r\n\r\n.animate-ping-slow {\r\n  animation: pingSlow 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;\r\n}\r\n\r\n@keyframes slideLoop {\r\n  0% {\r\n    transform: translateX(0);\r\n  }\r\n  50% {\r\n    transform: translateX(8px);\r\n  }\r\n  100% {\r\n    transform: translateX(0);\r\n  }\r\n}\r\n\r\n.slide-loop {\r\n  display: inline-block;\r\n  animation: slideLoop 3s ease-in-out infinite;\r\n}\r\n\r\n#fap-moveout-root {\r\n  width: 100%;\r\n}\r\n\r\n/* Ensure iframe details element expands fully */\r\n#fap-moveout-root details[open] {\r\n  width: 100% !important;\r\n  max-width: 100% !important;\r\n}\r\n\r\n#fap-moveout-root #myframe {\r\n  width: 100% !important;\r\n  height: 80vh !important;\r\n  min-height: 600px !important;\r\n  display: block;\r\n  border: 1px solid #ccc;\r\n}\r\n\r\n/* Action buttons */\r\n#fap-moveout-root button {\r\n  font-weight: 600;\r\n  padding: 0.5rem 1rem;\r\n  border-radius: 0.375rem;\r\n  border: 2px solid #F36B16;\r\n  color: #F36B16;\r\n  background: transparent;\r\n  cursor: pointer;\r\n  transition: all 0.2s;\r\n}\r\n\r\n#fap-moveout-root button:hover {\r\n  background: #F36B16;\r\n  color: black;\r\n}\r\n\r\n";
  let debugMode = false;
  async function waitForReact(timeout = 5e3) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (typeof React !== "undefined" && typeof ReactDOM !== "undefined") {
        if (debugMode) {
          console.log("[FAP-AIO] React and ReactDOM loaded successfully");
        }
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    console.error("[FAP-AIO] Timeout waiting for React to load from CDN");
    return false;
  }
  async function init() {
    try {
      if (debugMode) {
        console.log("[FAP-AIO] Userscript initialization started");
        console.log("[FAP-AIO] Version:", GM_info?.script?.version || "0.0.1");
      }
      const reactReady = await waitForReact(5e3);
      if (!reactReady) {
        console.warn("[FAP-AIO] React not available, some features may not work");
      }
      if (document.readyState === "loading") {
        await new Promise((resolve) => {
          document.addEventListener("DOMContentLoaded", resolve, { once: true });
        });
      }
      if (debugMode) {
        console.log("[FAP-AIO] DOM ready, initializing router");
      }
      initRouter();
      console.log("[FAP-AIO] Userscript initialized successfully");
    } catch (error) {
      console.error("[FAP-AIO] Fatal error during initialization:", error);
    }
  }
  (function() {
    if (window.__FAP_AIO_LOADED__) {
      console.warn("[FAP-AIO] Userscript already loaded, skipping initialization");
      return;
    }
    window.__FAP_AIO_LOADED__ = true;
    styleAdapter.inject(userstyleCSS, "userstyle");
    styleAdapter.inject(tailwindCSS, "tailwind");
    styleAdapter.inject(gpaCSS, "gpa");
    styleAdapter.inject(moveoutCSS, "moveout");
    console.log("[FAP-AIO] All styles injected immediately");
    globalThis.fetch = createFetchPolyfill();
    console.log("[FAP-AIO] Fetch polyfill injected (using GM_xmlhttpRequest)");
    try {
      const debugValue = typeof GM_getValue !== "undefined" ? GM_getValue("fap-aio:debug", "false") : localStorage.getItem("fap-aio:debug");
      debugMode = debugValue === "true" || debugValue === true;
      if (debugMode) {
        console.log("[FAP-AIO] Debug mode enabled");
      }
    } catch (e) {
      console.error("[FAP-AIO] Failed to check debug mode:", e);
    }
    init().catch((error) => {
      console.error("[FAP-AIO] Unhandled error in init():", error);
    });
  })();
  const SLOT_TIMES = {
    1: { start: "7:00", end: "9:15" },
    2: { start: "9:30", end: "11:45" },
    3: { start: "12:30", end: "14:45" },
    4: { start: "15:00", end: "17:15" },
    5: { start: "17:30", end: "19:45" },
    6: { start: "20:00", end: "22:15" },
    7: { start: "7:00", end: "9:15" },
    8: { start: "9:30", end: "11:45" }
  };
  function getSemesterOptions() {
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const maxYear = currentYear + 1;
    const seasons = ["Spring", "Summer", "Fall"];
    const options = [];
    for (let year = 2022; year <= maxYear; year++) {
      const yearShort = year.toString().slice(-2);
      seasons.forEach((season) => {
        options.push({ label: season + yearShort, season, year });
      });
    }
    return options;
  }
  function getSemesterInfo(semesterLabel) {
    const match = semesterLabel.match(/^(Spring|Summer|Fall)(\d{2})$/i);
    if (!match) return null;
    const season = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const yearShort = match[2];
    const year = 2e3 + parseInt(yearShort);
    let startMonth, endMonth;
    if (season === "Spring") {
      startMonth = 1;
      endMonth = 4;
    } else if (season === "Summer") {
      startMonth = 5;
      endMonth = 8;
    } else {
      startMonth = 9;
      endMonth = 12;
    }
    return {
      label: season + yearShort,
      season,
      year,
      yearShort,
      startDate: new Date(year, startMonth - 1, 1),
      endDate: new Date(year, endMonth, 0)
      // Last day of endMonth
    };
  }
  function getDefaultSemester() {
    const now = /* @__PURE__ */ new Date();
    const month = now.getMonth() + 1;
    const yearShort = now.getFullYear().toString().slice(-2);
    let season;
    if (month >= 1 && month <= 4) season = "Spring";
    else if (month >= 5 && month <= 8) season = "Summer";
    else season = "Fall";
    return season + yearShort;
  }
  function isWeekInSemester(weekText, pageYear, semester) {
    const match = weekText.match(/(\d{1,2})\/(\d{1,2})\s+To\s+(\d{1,2})\/(\d{1,2})/);
    if (!match) return false;
    const startDay = parseInt(match[1]);
    const startMonth = parseInt(match[2]);
    const endDay = parseInt(match[3]);
    const endMonth = parseInt(match[4]);
    let weekStartYear = semester.year;
    let weekEndYear = semester.year;
    if (endMonth < startMonth) {
      if (semester.season === "Spring") {
        weekStartYear = semester.year - 1;
      } else {
        weekEndYear = semester.year + 1;
      }
    }
    const weekStart = new Date(weekStartYear, startMonth - 1, startDay);
    const weekEnd = new Date(weekEndYear, endMonth - 1, endDay);
    return weekEnd >= semester.startDate && weekStart <= semester.endDate;
  }
  const storage = {
    get: (key) => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error("Storage error:", e);
      }
    }
  };
  const fmtTime = (t) => {
    if (!t || typeof t !== "string") return { hour: 0, minute: 0 };
    const cleaned = t.trim().replace(/\s+/g, "");
    if (cleaned.match(/\d+h\d*/i)) {
      const parts = cleaned.replace(/h/i, ":").split(":").map(Number);
      const h = parts[0] || 0;
      const m2 = parts[1] || 0;
      return { hour: h, minute: m2 };
    }
    if (cleaned.includes(":")) {
      const parts = cleaned.split(":").map(Number);
      const h = parts[0] || 0;
      const m2 = parts[1] || 0;
      return { hour: h, minute: m2 };
    }
    if (/^\d{1,2}$/.test(cleaned)) {
      return { hour: Number(cleaned), minute: 0 };
    }
    if (cleaned.includes(".")) {
      const parts = cleaned.split(".").map(Number);
      const h = parts[0] || 0;
      const m2 = parts[1] || 0;
      return { hour: h, minute: m2 };
    }
    return { hour: 0, minute: 0 };
  };
  const formatTime = (d) => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (d) => d.toLocaleDateString("vi-VN");
  function generateICS(events, filename) {
    const SEPARATOR = "\r\n";
    const calendarStart = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:fptu-scheduler", "CALSCALE:GREGORIAN"].join(SEPARATOR);
    const calendarEnd = "END:VCALENDAR";
    const fmt = (d) => {
      const date = new Date(d);
      return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    };
    const eventsStr = events.map((e) => {
      const start = new Date(e.start);
      const end = new Date(e.end);
      const uid = fmt(/* @__PURE__ */ new Date()) + "-" + Math.random().toString(36).substring(2, 8) + "@fptu";
      let title = e.title;
      if (e.tag) title += " - " + e.tag;
      return [
        "BEGIN:VEVENT",
        "UID:" + uid,
        "DTSTAMP:" + fmt(/* @__PURE__ */ new Date()),
        "DTSTART:" + fmt(start),
        "DTEND:" + fmt(end),
        "SUMMARY:" + title,
        "DESCRIPTION:" + (e.description || ""),
        "LOCATION:" + (e.location || ""),
        "BEGIN:VALARM",
        "TRIGGER:-P1D",
        "ACTION:DISPLAY",
        "DESCRIPTION:Reminder",
        "END:VALARM",
        "END:VEVENT"
      ].join(SEPARATOR);
    }).join(SEPARATOR);
    const ics = calendarStart + SEPARATOR + eventsStr + SEPARATOR + calendarEnd;
    const blob = new Blob([ics], { type: "text/calendar" });
    const url2 = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url2;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url2);
  }
  function extractExamSchedule() {
    try {
      const rows = Array.from(document.querySelectorAll("#ctl00_mainContent_divContent table tr")).slice(1).map((tr) => Array.from(tr.cells).map((td) => td.textContent?.trim() || ""));
      return rows.filter((row) => row.length >= 8 && row[3] && row[5] !== void 0).map((row) => {
        const [no, code, name, date, room, time, form, exam, ...rest] = row;
        const [day, month, year] = date.split("/").map(Number);
        const [startStr, endStr] = time.split("-");
        const start = new Date(year, month - 1, day, fmtTime(startStr).hour, fmtTime(startStr).minute);
        const end = new Date(year, month - 1, day, fmtTime(endStr).hour, fmtTime(endStr).minute);
        let rawTag = exam?.trim().toUpperCase() || (rest[0]?.trim().toUpperCase() || "");
        const formLower = (form || "").toLowerCase();
        let tag = void 0;
        if (rawTag === "2NDFE") tag = "2NDFE";
        else if (rawTag === "2NDPE") tag = "2NDPE";
        else if (rawTag === "PE") tag = "PE";
        else if (rawTag === "FE") tag = "FE";
        else if (!rawTag) {
          if (formLower.includes("2nd") && formLower.includes("fe")) tag = "2NDFE";
          else if (formLower.includes("2nd") && formLower.includes("pe")) tag = "2NDPE";
          else if (formLower.includes("practical_exam") || formLower.includes("project presentation")) tag = "PE";
          else if (formLower.includes("multiple_choices") || formLower.includes("speaking")) tag = "FE";
        }
        return {
          title: code || "Unknown",
          location: room || "",
          description: form || "",
          start,
          end,
          tag,
          type: "exam"
        };
      });
    } catch (e) {
      console.error("Exam extraction error:", e);
      return [];
    }
  }
  function extractWeeklySchedule() {
    try {
      const events = [];
      const yearSelect = document.querySelector("#ctl00_mainContent_drpYear");
      const year = yearSelect ? parseInt(yearSelect.value) : (/* @__PURE__ */ new Date()).getFullYear();
      const theadRows = document.querySelectorAll("thead tr");
      const dates = [];
      if (theadRows.length >= 2) {
        const dateRow = theadRows[1];
        dateRow.querySelectorAll("th").forEach((th) => {
          const text = th.textContent?.trim() || "";
          if (text.includes("/")) {
            const [day, month] = text.split("/").map(Number);
            dates.push({ day, month, year });
          }
        });
      }
      const rows = document.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 2) return;
        const slotText = cells[0].textContent?.trim() || "";
        const slotMatch = slotText.match(/Slot\s*(\d+)/i);
        if (!slotMatch) return;
        const slotNum = parseInt(slotMatch[1]);
        const slotTiming = SLOT_TIMES[slotNum] || SLOT_TIMES[1];
        for (let i = 1; i < cells.length && i <= 7; i++) {
          const cell = cells[i];
          const cellText = cell.textContent?.trim() || "";
          if (cellText === "-" || !cellText) continue;
          const activityPs = cell.querySelectorAll("p");
          if (activityPs.length === 0) continue;
          activityPs.forEach((p2) => {
            const fullText = p2.textContent || "";
            let subjectCode = "";
            const firstLink = p2.querySelector("a[href*='ActivityDetail']");
            if (firstLink) {
              let linkText = firstLink.textContent?.trim().replace(/-$/, "") || "";
              const codeMatch = linkText.match(/^([A-Z]{2,4}\d{2,4}c?)/i);
              if (codeMatch) subjectCode = codeMatch[1];
            }
            if (!subjectCode) {
              const codeFromText = fullText.match(/([A-Z]{2,4}\d{2,4}c?)/i);
              if (codeFromText) subjectCode = codeFromText[1];
            }
            let room = "";
            const roomMatch = fullText.match(/at\s+([^(]+)\(/i);
            if (roomMatch) room = roomMatch[1].trim();
            let meetUrl = "";
            const meetLink = p2.querySelector("a[href*='meet.google.com']");
            if (meetLink) meetUrl = meetLink.getAttribute("href") || "";
            let startTimeStr = slotTiming.start, endTimeStr = slotTiming.end;
            const timeSpan = p2.querySelector(".label-success");
            if (timeSpan) {
              const timeMatch = timeSpan.textContent?.match(/\((\d{1,2}:\d{2})-(\d{1,2}:\d{2})\)/);
              if (timeMatch) {
                startTimeStr = timeMatch[1];
                endTimeStr = timeMatch[2];
              }
            }
            let status = "not-yet";
            if (fullText.toLowerCase().includes("attended") && !fullText.toLowerCase().includes("not yet")) {
              status = "attended";
            } else if (fullText.toLowerCase().includes("absent")) {
              status = "absent";
            }
            const dateIndex = i - 1;
            if (dateIndex >= dates.length) return;
            const dateInfo = dates[dateIndex];
            const startTime = fmtTime(startTimeStr);
            const endTime = fmtTime(endTimeStr);
            const startDate = new Date(dateInfo.year, dateInfo.month - 1, dateInfo.day, startTime.hour, startTime.minute);
            const endDate = new Date(dateInfo.year, dateInfo.month - 1, dateInfo.day, endTime.hour, endTime.minute);
            if (subjectCode) {
              events.push({
                title: subjectCode,
                location: room,
                description: `Slot ${slotNum}`,
                start: startDate,
                end: endDate,
                meetUrl,
                status,
                slot: slotNum,
                type: "class"
              });
            }
          });
        }
      });
      return events;
    } catch (e) {
      console.error("Weekly extraction error:", e);
      return [];
    }
  }
  function getWeekOptions() {
    const weekSelect = document.querySelector("#ctl00_mainContent_drpSelectWeek");
    const yearSelect = document.querySelector("#ctl00_mainContent_drpYear");
    if (!weekSelect) return { weeks: [], currentYear: (/* @__PURE__ */ new Date()).getFullYear() };
    const weeks = [];
    weekSelect.querySelectorAll("option").forEach((opt) => {
      const option = opt;
      weeks.push({ value: option.value, text: option.textContent?.trim() || "", selected: option.selected });
    });
    return { weeks, currentYear: yearSelect ? parseInt(yearSelect.value) : (/* @__PURE__ */ new Date()).getFullYear() };
  }
  function selectWeek(weekValue) {
    const weekSelect = document.querySelector("#ctl00_mainContent_drpSelectWeek");
    if (!weekSelect) return false;
    if (weekSelect.value === weekValue) return false;
    weekSelect.value = weekValue;
    weekSelect.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function createPanelHTML(isExamActive, isWeeklyActive) {
    return `
    <div class="fptu-panel-header">
      <h2>📅 FPTU Scheduler</h2>
      <div class="fptu-panel-controls">
        <button id="fptu-reset-btn" title="Xoá dữ liệu">🗑</button>
        <button id="fptu-minimize-btn" title="Thu nhỏ">−</button>
        <button id="fptu-close-btn" title="Đóng">×</button>
      </div>
    </div>
    <div class="fptu-panel-body">
      <div class="fptu-main-tabs">
        <button id="fptu-exam-tab" class="fptu-main-tab ${isExamActive ? "active" : ""}">📝 Lịch thi</button>
        <button id="fptu-weekly-tab" class="fptu-main-tab ${isWeeklyActive ? "active" : ""}">📚 Lịch học</button>
      </div>
      
      <!-- Exam Section -->
      <div id="fptu-exam-section" class="fptu-section ${isExamActive ? "active" : ""}">
        <div class="fptu-section-header">
          <button id="fptu-sync-exam-btn" class="fptu-sync-btn">🔄 Đồng bộ lịch thi</button>
        </div>
        <div class="fptu-sub-tabs">
          <button id="fptu-upcoming-tab" class="fptu-sub-tab active">📅 Chưa thi <span class="fptu-tab-count" id="fptu-upcoming-count">0</span></button>
          <button id="fptu-completed-tab" class="fptu-sub-tab">✅ Đã thi <span class="fptu-tab-count" id="fptu-completed-count">0</span></button>
        </div>
        <div id="fptu-upcoming-exams" class="fptu-list active"></div>
        <div id="fptu-completed-exams" class="fptu-list"></div>
        <div class="fptu-actions">
          <button id="fptu-export-exam-btn" class="fptu-export-btn">📅 Tải xuống lịch thi (.ics)</button>
        </div>
      </div>
      
      <!-- Weekly Section -->
      <div id="fptu-weekly-section" class="fptu-section ${isWeeklyActive ? "active" : ""}">
        <div class="fptu-semester-selector">
          <label for="fptu-semester-select">Học kỳ:</label>
          <select id="fptu-semester-select">
            ${getSemesterOptions().map(
      (s) => `<option value="${s.label}" ${s.label === getDefaultSemester() ? "selected" : ""}>${s.label}</option>`
    ).join("")}
          </select>
        </div>
        <div class="fptu-section-header fptu-weekly-header">
          <button id="fptu-sync-week-btn" class="fptu-sync-btn">🔄 Tuần này</button>
          <button id="fptu-sync-semester-btn" class="fptu-sync-btn fptu-semester-btn">📆 Cả học kỳ</button>
        </div>
        <div id="fptu-semester-progress" class="fptu-progress" style="display: none;">
          <div class="fptu-progress-info">
            <span id="fptu-semester-label">Spring25</span>
            <span id="fptu-progress-text">0/0 tuần</span>
          </div>
          <div class="fptu-progress-bar">
            <div id="fptu-progress-fill" class="fptu-progress-fill"></div>
          </div>
        </div>
        <div class="fptu-sub-tabs">
          <button id="fptu-offline-tab" class="fptu-sub-tab active">🏫 Offline <span class="fptu-tab-count" id="fptu-offline-count">0</span></button>
          <button id="fptu-online-tab" class="fptu-sub-tab">💻 Online <span class="fptu-tab-count" id="fptu-online-count">0</span></button>
        </div>
        <div id="fptu-offline-classes" class="fptu-list active"></div>
        <div id="fptu-online-classes" class="fptu-list"></div>
        <div class="fptu-actions fptu-export-actions">
          <button id="fptu-export-offline-btn" class="fptu-export-btn">🏫 Xuất Offline (.ics)</button>
          <button id="fptu-export-online-btn" class="fptu-export-btn fptu-export-online">💻 Xuất Online (.ics)</button>
        </div>
      </div>
    </div>
  `;
  }
  function addPanelStyles() {
    if (document.getElementById("fptu-scheduler-styles")) return;
    const style = document.createElement("style");
    style.id = "fptu-scheduler-styles";
    style.textContent = `
    #fptu-scheduler-panel {
      position: fixed;
      top: 50%;
      right: 20px;
      transform: translateY(-50%);
      width: 380px;
      height: 580px;
      background: #000000;
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(243, 107, 22, 0.15), 0 0 0 1px #333333;
      z-index: 999999;
      font-family: 'Inter', 'Roboto', 'Segoe UI', sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    #fptu-scheduler-panel.minimized {
      height: auto;
    }
    #fptu-scheduler-panel.minimized .fptu-panel-body {
      display: none;
    }
    .fptu-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      background: linear-gradient(135deg, #F36B16 0%, #ff8533 100%);
      color: #000000;
      cursor: move;
    }
    .fptu-panel-header h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #000000;
      text-shadow: none;
    }
    .fptu-panel-controls button {
      background: rgba(0,0,0,0.25);
      border: none;
      color: #000000;
      width: 26px;
      height: 26px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      margin-left: 6px;
      transition: all 0.2s;
    }
    .fptu-panel-controls button:hover {
      background: rgba(0,0,0,0.4);
      transform: scale(1.05);
    }
    .fptu-panel-body {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #000000;
    }
    .fptu-main-tabs {
      display: flex;
      background: #0f0905;
      border-bottom: 1px solid #333333;
    }
    .fptu-main-tab {
      flex: 1;
      padding: 12px;
      border: none;
      background: none;
      font-size: 13px;
      font-weight: 500;
      color: #BDBDBD;
      cursor: pointer;
      transition: all 0.2s;
    }
    .fptu-main-tab.active {
      color: #F36B16;
      border-bottom: 2px solid #F36B16;
      background: rgba(243, 107, 22, 0.1);
    }
    .fptu-section {
      display: none;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
    }
    .fptu-section.active {
      display: flex;
    }
    #fptu-semester-select {
      color: #E0E0E0;
    }
    .fptu-semester-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: #0f0905;
      border-bottom: 1px solid #333333;
    }
    .fptu-semester-selector label {
      font-size: 12px;
      font-weight: 500;
      color: #E0E0E0;
    }
    .fptu-semester-selector select {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #333333;
      border-radius: 10px;
      font-size: 12px;
      background: #1A1A1A;
      color: #E0E0E0;
      cursor: pointer;
      transition: all 0.2s;
    }
    .fptu-semester-selector select:focus {
      outline: none;
      border-color: #F36B16;
      box-shadow: 0 0 0 3px rgba(243, 107, 22, 0.2);
    }
    .fptu-section-header {
      display: flex;
      gap: 8px;
      padding: 10px 12px;
      background: #0f0905;
      border-bottom: 1px solid #333333;
      justify-content: center;
    }
    .fptu-sync-btn {
      padding: 8px 16px;
      background: linear-gradient(135deg, #F36B16 0%, #e65a00 100%);
      color: #000000;
      border: none;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(243, 107, 22, 0.3);
    }
    .fptu-sync-btn:hover { background: linear-gradient(135deg, #ff7a1f 0%, #F36B16 100%); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(243, 107, 22, 0.4); }
    .fptu-sync-btn:disabled { background: #333333; cursor: not-allowed; box-shadow: none; transform: none; color: #666666; }
    .fptu-semester-btn { background: transparent; border: 2px solid #F36B16; color: #F36B16; box-shadow: none; }
    .fptu-semester-btn:hover { background: rgba(243, 107, 22, 0.1); border-color: #ff7a1f; color: #ff7a1f; box-shadow: 0 2px 8px rgba(243, 107, 22, 0.2); }
    .fptu-progress {
      padding: 10px 12px;
      background: #0f0905;
      border-bottom: 1px solid #333333;
    }
    .fptu-progress-info {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-bottom: 6px;
    }
    #fptu-semester-label { font-weight: 600; color: #4CAF50; }
    #fptu-progress-text { color: #BDBDBD; }
    .fptu-progress-bar {
      height: 6px;
      background: #1A1A1A;
      border-radius: 3px;
      overflow: hidden;
    }
    .fptu-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #F36B16, #4CAF50);
      width: 0%;
      transition: width 0.3s;
      border-radius: 3px;
    }
    .fptu-sub-tabs {
      display: flex;
      background: #0f0905;
      border-bottom: 1px solid #333333;
    }
    .fptu-sub-tab {
      flex: 1;
      padding: 10px;
      border: none;
      background: none;
      font-size: 12px;
      color: #BDBDBD;
      cursor: pointer;
      transition: all 0.2s;
    }
    .fptu-sub-tab.active {
      color: #F36B16;
      font-weight: 600;
      background: rgba(243, 107, 22, 0.1);
    }
    .fptu-sub-tab:hover:not(.active) {
      background: rgba(243, 107, 22, 0.05);
    }
    .fptu-tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      margin-left: 4px;
      background: rgba(243, 107, 22, 0.2);
      color: #F36B16;
      border-radius: 9px;
      font-size: 10px;
      font-weight: 600;
    }
    .fptu-sub-tab.active .fptu-tab-count {
      background: #F36B16;
      color: #000000;
    }
    .fptu-list {
      display: none;
      overflow-y: auto;
      padding: 10px;
      background: #000000;
      height: 240px;
      min-height: 240px;
      max-height: 240px;
    }
    .fptu-list.active { display: block; }
    .fptu-card {
      background: #1A1A1A;
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      border: 1px solid #333333;
      transition: all 0.2s;
    }
    .fptu-card:hover {
      box-shadow: 0 4px 16px rgba(243, 107, 22, 0.2);
      border-color: #F36B16;
      transform: translateY(-1px);
    }
    .fptu-card-title {
      font-weight: 600;
      font-size: 14px;
      color: #E0E0E0;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
    }
    .fptu-tag {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 500;
    }
    .fptu-tag.fe { background: rgba(243, 107, 22, 0.2); color: #F36B16; }
    .fptu-tag.pe { background: rgba(76, 175, 80, 0.2); color: #4CAF50; }
    .fptu-tag.secondfe { background: #301403; color: #ff9f4a; }
    .fptu-tag.secondpe { background: rgba(244, 67, 54, 0.2); color: #F44336; }
    .fptu-tag.countdown { background: rgba(243, 107, 22, 0.2); color: #F36B16; }
    .fptu-tag.today { background: rgba(244, 67, 54, 0.2); color: #F44336; }
    .fptu-tag.tomorrow { background: #301403; color: #ff9f4a; }
    .fptu-tag.urgent { background: #301403; color: #ff9f4a; }
    .fptu-tag.attended { background: rgba(76, 175, 80, 0.2); color: #4CAF50; }
    .fptu-tag.absent { background: rgba(244, 67, 54, 0.2); color: #F44336; }
    .fptu-tag.not-yet { background: #1A1A1A; color: #BDBDBD; }
    .fptu-tag.online { background: rgba(243, 107, 22, 0.2); color: #F36B16; }
    .fptu-card-detail {
      font-size: 12px;
      color: #BDBDBD;
    }
    .fptu-card-detail .line {
      margin: 2px 0;
    }
    .fptu-card-detail .label {
      font-weight: 500;
      color: #E0E0E0;
    }
    .fptu-meet-btn {
      display: inline-block;
      margin-top: 6px;
      padding: 5px 10px;
      background: transparent;
      border: 2px solid #F36B16;
      color: #F36B16;
      text-decoration: none;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      transition: all 0.2s;
      box-shadow: none;
    }
    .fptu-meet-btn:hover {
      background: rgba(243, 107, 22, 0.1);
      border-color: #ff7a1f;
      color: #ff7a1f;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(243, 107, 22, 0.2);
    }
    .fptu-actions {
      padding: 12px;
      background: #0f0905;
      border-top: 1px solid #333333;
    }
    .fptu-export-actions {
      display: flex;
      gap: 8px;
    }
    .fptu-export-btn {
      flex: 1;
      padding: 10px 8px;
      background: linear-gradient(135deg, #F36B16 0%, #e65a00 100%);
      color: #000000;
      border: none;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(243, 107, 22, 0.3);
    }
    .fptu-export-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(243, 107, 22, 0.4);
    }
    .fptu-export-online {
      background: transparent;
      border: 2px solid #F36B16;
      color: #F36B16;
      box-shadow: none;
    }
    .fptu-export-online:hover {
      background: rgba(243, 107, 22, 0.1);
      border-color: #ff7a1f;
      color: #ff7a1f;
      box-shadow: 0 2px 8px rgba(243, 107, 22, 0.2);
    }
    .fptu-empty {
      text-align: center;
      padding: 40px 20px;
      color: #666666;
      font-size: 13px;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Toggle Button */
    #fptu-toggle-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 54px;
      height: 54px;
      background: linear-gradient(135deg, #F36B16 0%, #ff8533 100%);
      border: none;
      border-radius: 50%;
      color: #000000;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(243, 107, 22, 0.4);
      z-index: 999998;
      display: none;
      transition: all 0.2s;
    }
    #fptu-toggle-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 25px rgba(243, 107, 22, 0.5);
    }
  `;
    document.head.appendChild(style);
  }
  function showToggleButton() {
    let btn = document.getElementById("fptu-toggle-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "fptu-toggle-btn";
      btn.textContent = "📅";
      btn.addEventListener("click", () => {
        const panel = document.getElementById("fptu-scheduler-panel");
        if (panel) {
          panel.style.display = "flex";
          btn.style.display = "none";
        }
      });
      document.body.appendChild(btn);
    }
    btn.style.display = "block";
  }
  const isExamPage = () => window.location.href.includes("Exam/ScheduleExams.aspx");
  const isWeeklyPage = () => window.location.href.includes("Report/ScheduleOfWeek.aspx");
  let semesterSyncState = null;
  function startSemesterSync() {
    const semesterSelect = document.getElementById("fptu-semester-select");
    const selectedSemester = semesterSelect ? semesterSelect.value : getDefaultSemester();
    storage.set("selectedSemester", selectedSemester);
    const semester = getSemesterInfo(selectedSemester);
    if (!semester) {
      alert("Không thể xác định học kỳ: " + selectedSemester);
      return;
    }
    const { weeks } = getWeekOptions();
    const yearSelect = document.querySelector("#ctl00_mainContent_drpYear");
    const pageYear = yearSelect ? parseInt(yearSelect.value) : semester.year;
    const semesterWeeks = weeks.filter((w) => isWeekInSemester(w.text, pageYear, semester));
    if (semesterWeeks.length === 0) {
      alert("Không tìm thấy tuần trong học kỳ " + semester.label + ". Vui lòng chọn đúng năm trên trang FAP.");
      return;
    }
    storage.set("weeklySchedule", []);
    semesterSyncState = {
      semester,
      weeks: semesterWeeks,
      currentIndex: 0,
      collectedEvents: []
    };
    storage.set("semesterSyncState", semesterSyncState);
    updateProgressUI();
    processNextSemesterWeek();
  }
  function processNextSemesterWeek() {
    if (!semesterSyncState) {
      semesterSyncState = storage.get("semesterSyncState");
    }
    if (!semesterSyncState) return;
    const { weeks, currentIndex, semester } = semesterSyncState;
    if (currentIndex >= weeks.length) {
      finishSemesterSync();
      return;
    }
    const yearSelect = document.querySelector("#ctl00_mainContent_drpYear");
    if (yearSelect && parseInt(yearSelect.value) !== semester.year) {
      storage.set("semesterSyncState", semesterSyncState);
      yearSelect.value = semester.year.toString();
      yearSelect.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    const week = weeks[currentIndex];
    updateProgressUI();
    const weekSelect = document.querySelector("#ctl00_mainContent_drpSelectWeek");
    if (weekSelect && weekSelect.value !== week.value) {
      storage.set("semesterSyncState", semesterSyncState);
      selectWeek(week.value);
    } else {
      extractAndContinue();
    }
  }
  function extractAndContinue() {
    const events = extractWeeklySchedule();
    if (!semesterSyncState) return;
    const existingKeys = new Set(semesterSyncState.collectedEvents.map((e) => `${e.title}-${new Date(e.start).getTime()}`));
    events.forEach((e) => {
      const key = `${e.title}-${new Date(e.start).getTime()}`;
      if (!existingKeys.has(key)) {
        semesterSyncState.collectedEvents.push(e);
        existingKeys.add(key);
      }
    });
    semesterSyncState.currentIndex++;
    storage.set("semesterSyncState", semesterSyncState);
    updateProgressUI();
    setTimeout(() => processNextSemesterWeek(), 500);
  }
  function finishSemesterSync() {
    if (!semesterSyncState) return;
    const events = semesterSyncState.collectedEvents;
    storage.set("weeklySchedule", events);
    renderWeeklyList(events);
    semesterSyncState = null;
    storage.set("semesterSyncState", null);
    const progressEl = document.getElementById("fptu-semester-progress");
    if (progressEl) progressEl.style.display = "none";
    const syncBtn = document.getElementById("fptu-sync-semester-btn");
    if (syncBtn) syncBtn.disabled = false;
    console.log("Semester sync complete:", events.length, "events");
  }
  function updateProgressUI() {
    if (!semesterSyncState) return;
    const progressEl = document.getElementById("fptu-semester-progress");
    const labelEl = document.getElementById("fptu-semester-label");
    const textEl = document.getElementById("fptu-progress-text");
    const fillEl = document.getElementById("fptu-progress-fill");
    const syncBtn = document.getElementById("fptu-sync-semester-btn");
    if (progressEl) progressEl.style.display = "block";
    if (labelEl) labelEl.textContent = semesterSyncState.semester.label;
    if (textEl) textEl.textContent = `${semesterSyncState.currentIndex}/${semesterSyncState.weeks.length} tuần`;
    if (fillEl) fillEl.style.width = `${semesterSyncState.currentIndex / semesterSyncState.weeks.length * 100}%`;
    if (syncBtn) syncBtn.disabled = true;
  }
  function checkPendingSync() {
    if (storage.get("pendingSemesterSync") && isWeeklyPage()) {
      storage.set("pendingSemesterSync", null);
      setTimeout(() => startSemesterSync(), 1e3);
      return;
    }
    const savedState = storage.get("semesterSyncState");
    if (savedState && savedState.currentIndex !== void 0 && isWeeklyPage()) {
      semesterSyncState = savedState;
      updateProgressUI();
      setTimeout(() => extractAndContinue(), 1e3);
    }
  }
  function syncExamSchedule() {
    const events = extractExamSchedule();
    storage.set("examSchedule", events);
    renderExamList(events);
    console.log("Exam schedule synced:", events.length, "events");
  }
  function syncCurrentWeek() {
    const events = extractWeeklySchedule();
    const existing = storage.get("weeklySchedule") || [];
    const existingKeys = new Set(existing.map((e) => `${e.title}-${new Date(e.start).getTime()}`));
    events.forEach((e) => {
      const key = `${e.title}-${new Date(e.start).getTime()}`;
      if (!existingKeys.has(key)) {
        existing.push(e);
        existingKeys.add(key);
      }
    });
    storage.set("weeklySchedule", existing);
    renderWeeklyList(existing);
    console.log("Weekly schedule synced:", events.length, "new events,", existing.length, "total");
  }
  function renderExamList(events) {
    const upcomingList = document.getElementById("fptu-upcoming-exams");
    const completedList = document.getElementById("fptu-completed-exams");
    const upcomingCount = document.getElementById("fptu-upcoming-count");
    const completedCount = document.getElementById("fptu-completed-count");
    if (!upcomingList || !completedList) return;
    upcomingList.innerHTML = "";
    completedList.innerHTML = "";
    let upcoming = 0, completed = 0;
    if (!events || !events.length) {
      upcomingList.innerHTML = '<div class="fptu-empty">Không có lịch thi. Nhấn đồng bộ để tải.</div>';
      if (upcomingCount) upcomingCount.textContent = "0";
      if (completedCount) completedCount.textContent = "0";
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    events.forEach((e) => {
      const start = new Date(e.start);
      const examDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const diffDays = Math.ceil((examDate.getTime() - today.getTime()) / (1e3 * 60 * 60 * 24));
      const card = createExamCard(e, diffDays);
      if (diffDays < 0) {
        completedList.appendChild(card);
        completed++;
      } else {
        upcomingList.appendChild(card);
        upcoming++;
      }
    });
    if (upcomingCount) upcomingCount.textContent = upcoming.toString();
    if (completedCount) completedCount.textContent = completed.toString();
    if (!upcomingList.children.length) {
      upcomingList.innerHTML = '<div class="fptu-empty">Không có kỳ thi sắp tới.</div>';
    }
    if (!completedList.children.length) {
      completedList.innerHTML = '<div class="fptu-empty">Không có kỳ thi đã hoàn thành.</div>';
    }
  }
  function createExamCard(e, diffDays) {
    const start = new Date(e.start);
    const end = new Date(e.end);
    const card = document.createElement("div");
    card.className = "fptu-card";
    let tagHtml = "";
    if (e.tag) {
      const tagClass = e.tag.toLowerCase().replace("2nd", "second");
      tagHtml = `<span class="fptu-tag ${tagClass}">${e.tag}</span>`;
    }
    let countdownClass = "countdown";
    let countdownText = "";
    if (diffDays < 0) {
      countdownClass = "countdown past";
      countdownText = "Đã thi";
    } else if (diffDays === 0) {
      countdownClass = "countdown today";
      countdownText = "Hôm nay";
    } else if (diffDays === 1) {
      countdownClass = "countdown tomorrow";
      countdownText = "Ngày mai";
    } else if (diffDays <= 3) {
      countdownClass = "countdown urgent";
      countdownText = `Còn ${diffDays} ngày`;
    } else {
      countdownText = `Còn ${diffDays} ngày`;
    }
    card.innerHTML = `
    <div class="fptu-card-title">
      ${e.title} ${tagHtml} <span class="fptu-tag ${countdownClass}">${countdownText}</span>
    </div>
    <div class="fptu-card-detail">
      <div class="line"><span class="label">Phương thức:</span> ${e.description || "Chưa rõ"}</div>
      <div class="line"><span class="label">Phòng:</span> ${e.location || "Chưa rõ"}</div>
      <div class="line"><span class="label">Ngày:</span> ${formatDate(start)}</div>
      <div class="line"><span class="label">Giờ:</span> ${formatTime(start)} - ${formatTime(end)}</div>
    </div>
  `;
    return card;
  }
  function isOnlineSubject(subjectCode) {
    if (!subjectCode) return false;
    return /^[A-Z]{2,4}\d{2,4}c$/i.test(subjectCode.trim());
  }
  function renderWeeklyList(events) {
    const offlineList = document.getElementById("fptu-offline-classes");
    const onlineList = document.getElementById("fptu-online-classes");
    const offlineCount = document.getElementById("fptu-offline-count");
    const onlineCount = document.getElementById("fptu-online-count");
    if (!offlineList || !onlineList) return;
    offlineList.innerHTML = "";
    onlineList.innerHTML = "";
    if (!events || !events.length) {
      offlineList.innerHTML = '<div class="fptu-empty">Không có lịch học. Nhấn đồng bộ để tải.</div>';
      onlineList.innerHTML = '<div class="fptu-empty">Không có lịch học online.</div>';
      if (offlineCount) offlineCount.textContent = "0";
      if (onlineCount) onlineCount.textContent = "0";
      return;
    }
    const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const offlineEvents = sorted.filter((e) => !isOnlineSubject(e.title));
    const onlineEvents = sorted.filter((e) => isOnlineSubject(e.title));
    if (offlineCount) offlineCount.textContent = offlineEvents.length.toString();
    if (onlineCount) onlineCount.textContent = onlineEvents.length.toString();
    offlineEvents.forEach((e) => {
      const card = createClassCard(e, false);
      offlineList.appendChild(card);
    });
    onlineEvents.forEach((e) => {
      const card = createClassCard(e, true);
      onlineList.appendChild(card);
    });
    if (!offlineList.children.length) {
      offlineList.innerHTML = '<div class="fptu-empty">Không có lịch học offline.</div>';
    }
    if (!onlineList.children.length) {
      onlineList.innerHTML = '<div class="fptu-empty">Không có lịch học online.</div>';
    }
  }
  function createClassCard(e, isOnline = false) {
    const start = new Date(e.start);
    const end = new Date(e.end);
    const card = document.createElement("div");
    card.className = "fptu-card";
    let statusClass = e.status || "not-yet";
    let statusText = "Chưa điểm danh";
    if (e.status === "attended") {
      statusText = "✓ Đã điểm danh";
    } else if (e.status === "absent") {
      statusText = "✗ Vắng";
    }
    let meetHtml = "";
    if (e.meetUrl) {
      meetHtml = `<a href="${e.meetUrl}" target="_blank" class="fptu-meet-btn">📹 Google Meet</a>`;
    }
    const onlineTag = isOnline ? '<span class="fptu-tag online">Online</span>' : "";
    card.innerHTML = `
    <div class="fptu-card-title">
      ${e.title} ${onlineTag} <span class="fptu-tag ${statusClass}">${statusText}</span>
    </div>
    <div class="fptu-card-detail">
      <div class="line"><span class="label">Phòng:</span> ${e.location || (isOnline ? "Online" : "Chưa rõ")}</div>
      <div class="line"><span class="label">Ngày:</span> ${formatDate(start)}</div>
      <div class="line"><span class="label">Giờ:</span> ${formatTime(start)} - ${formatTime(end)}</div>
      ${meetHtml}
    </div>
  `;
    return card;
  }
  function exportExamICS() {
    const events = storage.get("examSchedule") || [];
    if (!events.length) {
      alert("Không có lịch thi để xuất. Vui lòng đồng bộ trước.");
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcoming = events.filter((e) => {
      const start = new Date(e.start);
      return start >= today && e.location && !e.location.toLowerCase().includes("chưa");
    });
    if (!upcoming.length) {
      alert("Không có kỳ thi sắp tới với phòng thi hợp lệ.");
      return;
    }
    generateICS(upcoming, "lich-thi.ics");
  }
  function exportWeeklyICS(onlineOnly = false) {
    const events = storage.get("weeklySchedule") || [];
    if (!events.length) {
      alert("Không có lịch học để xuất. Vui lòng đồng bộ trước.");
      return;
    }
    const filtered = events.filter((e) => {
      const isOnline = isOnlineSubject(e.title);
      return onlineOnly ? isOnline : !isOnline;
    });
    if (!filtered.length) {
      alert(onlineOnly ? "Không có lịch học online." : "Không có lịch học offline.");
      return;
    }
    const eventsWithMeet = filtered.map((e) => {
      if (e.meetUrl) {
        return {
          ...e,
          description: (e.description || "") + (e.description ? "\\n" : "") + "Meet: " + e.meetUrl
        };
      }
      return e;
    });
    const filename = onlineOnly ? "lich-hoc-online.ics" : "lich-hoc.ics";
    generateICS(eventsWithMeet, filename);
  }
  function loadCachedData() {
    const examData = storage.get("examSchedule");
    if (examData && examData.length) {
      renderExamList(examData);
    } else {
      const upcomingList = document.getElementById("fptu-upcoming-exams");
      const completedList = document.getElementById("fptu-completed-exams");
      if (upcomingList) upcomingList.innerHTML = '<div class="fptu-empty">Không có lịch thi. Nhấn đồng bộ để tải.</div>';
      if (completedList) completedList.innerHTML = '<div class="fptu-empty">Không có kỳ thi đã hoàn thành.</div>';
    }
    const weeklyData = storage.get("weeklySchedule");
    if (weeklyData && weeklyData.length) {
      renderWeeklyList(weeklyData);
    } else {
      const offlineList = document.getElementById("fptu-offline-classes");
      const onlineList = document.getElementById("fptu-online-classes");
      if (offlineList) offlineList.innerHTML = '<div class="fptu-empty">Không có lịch học. Nhấn đồng bộ để tải.</div>';
      if (onlineList) onlineList.innerHTML = '<div class="fptu-empty">Không có lịch học online.</div>';
    }
  }
  function attachPanelEvents(panel) {
    const minimizeBtn = panel.querySelector("#fptu-minimize-btn");
    const closeBtn = panel.querySelector("#fptu-close-btn");
    const resetBtn = panel.querySelector("#fptu-reset-btn");
    minimizeBtn?.addEventListener("click", () => {
      panel.classList.toggle("minimized");
      if (minimizeBtn) minimizeBtn.textContent = panel.classList.contains("minimized") ? "+" : "−";
    });
    closeBtn?.addEventListener("click", () => {
      panel.style.display = "none";
      showToggleButton();
    });
    resetBtn?.addEventListener("click", () => {
      if (confirm("Xoá tất cả dữ liệu lịch đã lưu?")) {
        storage.set("examSchedule", null);
        storage.set("weeklySchedule", null);
        storage.set("semesterSyncState", null);
        storage.set("selectedSemester", null);
        storage.set("pendingSemesterSync", null);
        loadCachedData();
        alert("Đã xoá tất cả dữ liệu!");
      }
    });
    const examTab = panel.querySelector("#fptu-exam-tab");
    const weeklyTab = panel.querySelector("#fptu-weekly-tab");
    const examSection = panel.querySelector("#fptu-exam-section");
    const weeklySection = panel.querySelector("#fptu-weekly-section");
    examTab?.addEventListener("click", () => {
      examTab.classList.add("active");
      weeklyTab?.classList.remove("active");
      examSection?.classList.add("active");
      weeklySection?.classList.remove("active");
    });
    weeklyTab?.addEventListener("click", () => {
      weeklyTab?.classList.add("active");
      examTab?.classList.remove("active");
      weeklySection?.classList.add("active");
      examSection?.classList.remove("active");
    });
    const upcomingTab = panel.querySelector("#fptu-upcoming-tab");
    const completedTab = panel.querySelector("#fptu-completed-tab");
    const upcomingList = panel.querySelector("#fptu-upcoming-exams");
    const completedList = panel.querySelector("#fptu-completed-exams");
    upcomingTab?.addEventListener("click", () => {
      upcomingTab.classList.add("active");
      completedTab?.classList.remove("active");
      upcomingList?.classList.add("active");
      completedList?.classList.remove("active");
    });
    completedTab?.addEventListener("click", () => {
      completedTab?.classList.add("active");
      upcomingTab?.classList.remove("active");
      completedList?.classList.add("active");
      upcomingList?.classList.remove("active");
    });
    const offlineTab = panel.querySelector("#fptu-offline-tab");
    const onlineTab = panel.querySelector("#fptu-online-tab");
    const offlineList = panel.querySelector("#fptu-offline-classes");
    const onlineList = panel.querySelector("#fptu-online-classes");
    offlineTab?.addEventListener("click", () => {
      offlineTab.classList.add("active");
      onlineTab?.classList.remove("active");
      offlineList?.classList.add("active");
      onlineList?.classList.remove("active");
    });
    onlineTab?.addEventListener("click", () => {
      onlineTab?.classList.add("active");
      offlineTab?.classList.remove("active");
      onlineList?.classList.add("active");
      offlineList?.classList.remove("active");
    });
    panel.querySelector("#fptu-sync-exam-btn")?.addEventListener("click", () => {
      if (!isExamPage()) {
        window.location.href = "https://fap.fpt.edu.vn/Exam/ScheduleExams.aspx";
        return;
      }
      syncExamSchedule();
    });
    panel.querySelector("#fptu-sync-week-btn")?.addEventListener("click", () => {
      if (!isWeeklyPage()) {
        window.location.href = "https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx";
        return;
      }
      syncCurrentWeek();
    });
    panel.querySelector("#fptu-sync-semester-btn")?.addEventListener("click", () => {
      if (!isWeeklyPage()) {
        window.location.href = "https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx";
        storage.set("pendingSemesterSync", true);
        return;
      }
      startSemesterSync();
    });
    panel.querySelector("#fptu-export-exam-btn")?.addEventListener("click", exportExamICS);
    panel.querySelector("#fptu-export-offline-btn")?.addEventListener("click", () => exportWeeklyICS(false));
    panel.querySelector("#fptu-export-online-btn")?.addEventListener("click", () => exportWeeklyICS(true));
    makeDraggable(panel);
  }
  function makeDraggable(panel) {
    const header = panel.querySelector(".fptu-panel-header");
    let isDragging = false;
    let offsetX, offsetY;
    header.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      isDragging = true;
      offsetX = e.clientX - panel.offsetLeft;
      offsetY = e.clientY - panel.offsetTop;
      panel.style.transform = "none";
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      panel.style.left = e.clientX - offsetX + "px";
      panel.style.top = e.clientY - offsetY + "px";
      panel.style.right = "auto";
    });
    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }
  function initSchedulerPanel() {
    console.log("Creating FPTU Scheduler Panel...");
    const existing = document.getElementById("fptu-scheduler-panel");
    if (existing) existing.remove();
    const panel = document.createElement("div");
    panel.id = "fptu-scheduler-panel";
    panel.innerHTML = createPanelHTML(isExamPage(), isWeeklyPage());
    document.body.appendChild(panel);
    addPanelStyles();
    attachPanelEvents(panel);
    const savedSemester = storage.get("selectedSemester");
    if (savedSemester) {
      const semesterSelect = panel.querySelector("#fptu-semester-select");
      if (semesterSelect) {
        semesterSelect.value = savedSemester;
      }
    }
    loadCachedData();
    setTimeout(() => {
      if (isExamPage()) {
        syncExamSchedule();
      } else if (isWeeklyPage()) {
        syncCurrentWeek();
        checkPendingSync();
      }
    }, 1e3);
  }
  const scheduler = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    initSchedulerPanel
  }, Symbol.toStringTag, { value: "Module" }));
})(React, ReactDOM);
