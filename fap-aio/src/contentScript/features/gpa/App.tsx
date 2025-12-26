import React, { useEffect, useState, useRef } from "react";
import Header from "./components/Header";
import GradeTable from "./components/GradeTable";
import CalculateTable from "./components/CalculateTable";
import { createRoot, Root } from "react-dom/client";

const App = () => {
  const [nonGPAKey, setNonGPAKey] = useState<any>([
    "OJS",
    "VOV",
    "GDQP",
    "LAB",
    "ENT",
    "SSS",
    "TMI",
    "TRS",
    "OTP",
  ]);
  const [data, setData] = useState<any[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const semesters = new Set<string>();
  const [showGPA, setShowGPA] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const tabRootRef = useRef<Root | null>(null);

  useEffect(() => {
    const gradeDiv = document.getElementById("ctl00_mainContent_divGrade");
    if (gradeDiv && !tabRootRef.current) {
      const tabContainer = document.createElement("div");
      tabContainer.className = "gpa-tab-container";
      
      // Insert tab container at the top of gradeDiv
      gradeDiv.insertBefore(tabContainer, gradeDiv.firstChild);
      
      tabRootRef.current = createRoot(tabContainer);
    }
  }, []);

  useEffect(() => {
    if (tabRootRef.current) {
      tabRootRef.current.render(
        <div className="gpa-tab-buttons">
          <button
            className={`gpa-tab-btn ${showGPA ? 'active' : ''}`}
            onClick={() => {
              setShowGPA((prev) => !prev);
              setShowEdit(false);
            }}
          >
            Show GPA
          </button>
          <button
            className={`gpa-tab-btn ${showEdit ? 'active' : ''}`}
            onClick={() => {
              setShowEdit((prev) => !prev);
              setShowGPA(false);
            }}
          >
            Edit GPA
          </button>
        </div>
      );
    }
  }, [showGPA, showEdit]);

  useEffect(() => {
    try {
      let tableData = crawlGPA();
      semesters.add("Studying");
      semesters.add("Not started");

      const hehe = [...semesters].map((data) => {
        const semester = data?.slice(0, data.length - 4) || "";
        const year = data?.slice(data.length - 4, data.length) || "";
        let subjects: any[] = [];
        if (data == "Not started") {
          subjects = tableData.filter((item) => item.status == "Not started");
        } else if (data == "Studying") {
          subjects = tableData.filter((item) => item.status == "Studying");
        } else {
          subjects = tableData.filter((item) => item.semester == data);
        }
        return { data, semester, year, subjects };
      });
      setData(hehe);
      setRawData(tableData);
    } catch (error) {
      console.log("error", error);
    }
  }, []);

  const crawlGPA = () => {
    const targetTable = document.querySelector(
      "#ctl00_mainContent_divGrade > table",
    );
    const targetTRs = Array.from(
      targetTable?.querySelectorAll("tbody > tr") || [],
    );

    let test1: any[] = [];

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
          status,
        });
    });
    return test1;
  };

  return (
    <>
      {showEdit && <CalculateTable rawData={rawData} nonGPAKey={nonGPAKey} data={data} />}
      {showGPA && (
        <>
          <Header nonGPAKey={nonGPAKey} setNonGPAKey={setNonGPAKey} />
          <GradeTable data={data} rawData={rawData} nonGPAKey={nonGPAKey} />
        </>
      )}
    </>
  );
};

export default App;
