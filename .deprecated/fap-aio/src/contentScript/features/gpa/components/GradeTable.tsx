import React, { useState } from "react";
import { mapGPALabel, mapSemesterColor } from "../utils";

const GradeTable = ({
  nonGPAKey,
  data,
  rawData,
}: {
  nonGPAKey: any[];
  data: any;
  rawData: any;
}) => {
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

  const totalCredit = rawData?.reduce((acc: any, curr: any) => {
    if (nonGPAKey.includes(curr.code?.slice(0, 3))) return acc;
    if (curr.status !== "Passed") return acc;
    return acc + Number(curr.credit);
  }, 0);

  const totalGrade = rawData?.reduce((acc: any, curr: any) => {
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
    <div>
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
        </div>
      </div>

      {/* Semester Blocks */}
      {filteredData.map((item: any, index: any) => (
        <SemesterBlock
          key={index}
          data={item}
          nonGPAKey={nonGPAKey}
          termNumber={index}
          isCollapsed={collapsedSemesters.has(item.data)}
          onToggle={() => toggleSemester(item.data)}
        />
      ))}
    </div>
  );
};

const SemesterBlock = ({
  nonGPAKey,
  data,
  termNumber,
  isCollapsed,
  onToggle,
}: {
  nonGPAKey: any[];
  data: any;
  termNumber: number;
  isCollapsed: boolean;
  onToggle: () => void;
}) => {
  const totalCredit = data?.subjects?.reduce((acc: any, curr: any) => {
    if (nonGPAKey.includes(curr.code?.slice(0, 3))) return acc;
    if (curr.status !== "Passed") return acc;
    return acc + Number(curr.credit);
  }, 0);

  const totalGrade = data?.subjects?.reduce((acc: any, curr: any) => {
    if (nonGPAKey.includes(curr.code?.slice(0, 3))) return acc;
    if (curr.status !== "Passed") return acc;
    return acc + Number(curr.grade) * Number(curr.credit);
  }, 0);

  const GPA = (totalGrade / totalCredit).toFixed(2);
  const subjectCount = data?.subjects?.filter((s: any) => {
    const isNonGPA = nonGPAKey.includes(s.code?.slice(0, 3));
    const isNotStarted = s.status === "Not started";
    const isStudying = s.status === "Studying";
    return !isNonGPA && !isNotStarted && !isStudying;
  }).length || 0;
  const semesterColor = mapSemesterColor(data.data);

  return (
    <div className="semester-block">
      <div className="semester-header" onClick={onToggle}>
        <span className="term-number">{termNumber}</span>
        <div className="semester-info">
          <span
            className="label"
            style={{
              backgroundColor: semesterColor,
              color: "white",
              padding: "4px 12px",
              borderRadius: "4px",
            }}
          >
            {["Not started", "Studying"].includes(data?.data)
              ? data?.data
              : `${data?.semester} ${data?.year}`}
          </span>
          <span>({subjectCount} subjects)</span>
        </div>
        <span id="semester-gpa" className={`semester-gpa ${mapGPALabel(null, parseFloat(GPA))}`}>
          {GPA === "NaN" ? "N/A" : GPA}
        </span>
      </div>

      <div className={`semester-content ${isCollapsed ? "collapsed" : ""}`}>
        <SubjectTable subjects={data?.subjects} nonGPAKey={nonGPAKey} />
      </div>
    </div>
  );
};

const SubjectTable = ({
  subjects,
  nonGPAKey,
}: {
  subjects: any[];
  nonGPAKey: any[];
}) => {
  // Filter out non-GPA subjects, Not started, and Studying subjects
  const filteredSubjects = subjects.filter((subject) => {
    const isNonGPA = nonGPAKey.includes(subject.code?.slice(0, 3));
    const isNotStarted = subject.status === "Not started";
    const isStudying = subject.status === "Studying";
    return !isNonGPA && !isNotStarted && !isStudying;
  });

  // Organize subjects into grid (8 columns)
  const rows = [];
  const cols = 8;
  for (let i = 0; i < filteredSubjects.length; i += cols) {
    rows.push(filteredSubjects.slice(i, i + cols));
  }

  return (
    <table className="subject-table">
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((subject, colIndex) => {
              const gradeColorClass = mapGPALabel(subject, subject.grade);

              return (
                <td key={colIndex} className="subject-cell">
                  <span className="subject-code">{subject.code}</span>
                  <span className={`subject-grade ${gradeColorClass}`}>
                    {subject.grade} × {subject.credit}
                  </span>
                </td>
              );
            })}
            {/* Fill empty cells if row is incomplete */}
            {row.length < cols &&
              Array.from({ length: cols - row.length }).map((_, i) => (
                <td key={`empty-${i}`}></td>
              ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default GradeTable;
