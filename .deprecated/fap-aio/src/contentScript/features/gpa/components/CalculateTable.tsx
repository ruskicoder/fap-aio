import React, { useEffect, useState } from "react";
import { mapGPALabel, mapSemesterColor } from "../utils";

const CalculateTable = ({
  rawData,
  nonGPAKey,
  data,
}: {
  rawData: any;
  nonGPAKey: any[];
  data: any;
}) => {
  const [editData, setEditData] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>("");
  const [collapsedSemesters, setCollapsedSemesters] = useState<Set<string>>(
    new Set()
  );

  const toggleSemester = (semester: string) => {
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

  useEffect(() => {
    setEditData(rawData);
  }, [rawData]);

  const handleSave = () => {
    const creditInput: HTMLFormElement = document.querySelector(
      ".edit[name='credit']",
    )!;
    const gradeInput: HTMLFormElement = document.querySelector(
      ".edit[name='grade']",
    )!;
    const credit = creditInput?.value;
    const grade = gradeInput?.value;

    setEditData((prevData) => {
      return prevData.map((item: any) => {
        if (item.code == editing) {
          return { ...item, credit, grade };
        }
        return item;
      });
    });

    setEditing("");
    console.log("editData", editData);
  };

  const totalCredit = editData?.reduce((acc: any, curr: any) => {
    if (nonGPAKey.includes(curr.code?.slice(0, 3))) return acc;
    if (curr.status !== "Passed") return acc;
    return acc + Number(curr.credit);
  }, 0);

  const totalGrade = editData?.reduce((acc: any, curr: any) => {
    if (nonGPAKey.includes(curr?.code?.slice(0, 3))) return acc;
    if (curr.status !== "Passed") return acc;
    return acc + Number(curr?.grade) * Number(curr?.credit);
  }, 0);

  const totalGPA = (totalGrade / totalCredit).toFixed(2);

  // Filter out "Studying" and "Not started" semesters
  const filteredData = data.filter((item: any) => {
    return item.data !== "Studying" && item.data !== "Not started";
  });

  return (
    <div id="edit-gpa">
      {/* Total GPA Header */}
      <div className="total-gpa-header">
        <div className="credits">
          <span className="label">Total Accumulated Credits</span>
          <span id="total-credit" className="value">{totalCredit}</span>
        </div>
        <div className="gpa">
          <span className="label">Total GPA</span>
          <span id="total-gpa" className={`value ${mapGPALabel(null, parseFloat(totalGPA))}`}>
            {totalGPA}
          </span>
          <a
            href="https://fap.fpt.edu.vn/FrontOffice/SubjectFees.aspx"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: "15px",
              padding: "5px 10px",
              backgroundColor: "transparent",
              color: "#fff",
              border: "1px solid #f36b16",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Search Credit
          </a>
          <button
            onClick={() => setEditData(rawData)}
            className="reset-btn"
            style={{
              marginLeft: "10px",
              padding: "5px 10px",
              backgroundColor: "#ff9244",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Semester Blocks */}
      {filteredData.map((semesterData: any, index: any) => {
        const semesterSubjects = editData.filter(
          (item) => item.semester === semesterData.data
        );
        
        // Filter out non-GPA, Not started, and Studying subjects
        const displaySubjects = semesterSubjects.filter((subject) => {
          const isNonGPA = nonGPAKey.includes(subject.code?.slice(0, 3));
          const isNotStarted = subject.status === "Not started";
          const isStudying = subject.status === "Studying";
          return !isNonGPA && !isNotStarted && !isStudying;
        });

        if (displaySubjects.length === 0) return null;

        const semesterCredit = displaySubjects.reduce((acc: any, curr: any) => {
          if (curr.status !== "Passed") return acc;
          return acc + Number(curr.credit);
        }, 0);

        const semesterGrade = displaySubjects.reduce((acc: any, curr: any) => {
          if (curr.status !== "Passed") return acc;
          return acc + Number(curr.grade) * Number(curr.credit);
        }, 0);

        const semesterGPA = (semesterGrade / semesterCredit).toFixed(2);
        const semesterColor = mapSemesterColor(semesterData.data);
        const isCollapsed = collapsedSemesters.has(semesterData.data);

        return (
          <div key={index} className="semester-block">
            <div className="semester-header" onClick={() => toggleSemester(semesterData.data)}>
              <span className="term-number">{index}</span>
              <div className="semester-info">
                <span
                  className="semester-badge"
                  style={{
                    backgroundColor: semesterColor,
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  {semesterData.data}
                </span>
                <span style={{ color: "#6c757d", fontSize: "14px" }}>
                  ({displaySubjects.length} subjects)
                </span>
              </div>
              <span id="semester-gpa" className={`semester-gpa ${mapGPALabel(null, parseFloat(semesterGPA))}`}>
                {semesterGPA}
              </span>
            </div>

            <div className={`semester-content ${isCollapsed ? "collapsed" : ""}`}>
              <table className="subject-table edit-table">
                <thead>
                  <tr>
                    <th style={{ width: "8%" }}>No</th>
                    <th style={{ width: "15%" }}>Code</th>
                    <th style={{ width: "12%" }}>Credit</th>
                    <th style={{ width: "12%" }}>Grade</th>
                    <th style={{ width: "12%" }}>Status</th>
                    <th style={{ width: "auto" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displaySubjects.map((item: any, subIndex: any) => {
                    const isEditing = editing === item.code;
                    const gradeColorClass = mapGPALabel(item, item.grade);

                    return (
                      <tr key={subIndex}>
                        <td>{subIndex + 1}</td>
                        <td style={{ fontWeight: "bold" }}>{item.code}</td>
                        <td>
                          {isEditing ? (
                            <input
                              className="edit"
                              name="credit"
                              type="number"
                              defaultValue={item.credit}
                              style={{
                                width: "60px",
                                padding: "4px",
                                border: "1px solid #dee2e6",
                                borderRadius: "4px",
                                color: "#000",
                                backgroundColor: "#fff",
                              }}
                            />
                          ) : (
                            item.credit
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              className="edit"
                              name="grade"
                              type="number"
                              defaultValue={item.grade}
                              style={{
                                width: "60px",
                                padding: "4px",
                                border: "1px solid #dee2e6",
                                borderRadius: "4px",
                                color: "#000",
                                backgroundColor: "#fff",
                              }}
                            />
                          ) : (
                            <span className={gradeColorClass} style={{ fontWeight: "bold", fontSize: "14px" }}>
                              {item.grade}
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: "12px", color: item.status === "Passed" ? "#28a745" : "#dc3545" }}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          {isEditing ? (
                            <button
                              onClick={handleSave}
                              style={{
                                padding: "4px 8px",
                                backgroundColor: "#007bff",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              Save
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditing(item.code)}
                              style={{
                                padding: "4px 8px",
                                backgroundColor: "#6c757d",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CalculateTable;
