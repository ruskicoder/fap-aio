import { Subject, SemesterData, DEFAULT_NON_GPA_KEYS } from './types';
import { storage } from '@/contentScript/shared/storage';

const GPA_CONFIG_KEY = 'gpa-config';

export function getGPAConfig(): string[] {
  const config = storage.get<{ nonGPAKeys: string[] }>(GPA_CONFIG_KEY);
  return config?.nonGPAKeys || DEFAULT_NON_GPA_KEYS;
}

export function setGPAConfig(nonGPAKeys: string[]): void {
  storage.set(GPA_CONFIG_KEY, { nonGPAKeys });
}

export const mapSemesterLabel = (semester: string) => {
  if (semester == "Summer") return "label-warning";
  if (semester == "Spring") return "label-success";
  if (semester == "Fall") return "label-info";
  return "label-default";
};

export const mapSemesterColor = (semester: string): string => {
  const match = semester.match(/^(Spring|Summer|Fall)(\d{4})$/);
  if (!match) return '#6c757d';
  
  const [, season, year] = match;
  const colorIndex = {
    Spring: 0,
    Summer: 1,
    Fall: 2,
  }[season];
  
  const yearNum = parseInt(year);
  const baseIndex = (yearNum - 2019) * 3 + (colorIndex || 0);
  const colors = [
    '#4e1445', '#2a144e', '#17144e', '#143c4e', '#144e40',
    '#144e15', '#4e4d14', '#4e3314', '#4e1614', '#4e1438',
  ];
  
  return colors[baseIndex % colors.length];
};

export const mapGPALabel = (subject?: any, grade?: number) => {
  let gradeValue = 0;
  
  if (subject?.status) {
    if (subject.status == "Passed") {
      gradeValue = subject.grade;
    } else if (subject.status == "Not passed") {
      return "gpa-failed";
    }
  } else if (grade !== undefined) {
    gradeValue = grade;
  }
  
  if (gradeValue >= 9) return "gpa-excellent";
  if (gradeValue >= 8) return "gpa-verygood";
  if (gradeValue >= 7) return "gpa-good";
  if (gradeValue >= 5) return "gpa-average";
  return "gpa-failed";
};

// Helper function to extract text from element (copied exactly from fap-gpa)
function extractText(node: HTMLElement | null): string {
  if (node?.childElementCount === 0) {
    return node.innerHTML;
  }
  return node?.textContent || '';
}

export function parseTranscriptTable(): SemesterData[] {
  // Get the main grade table exactly like fap-gpa does
  const gradeDiv = document.getElementById('ctl00_mainContent_divGrade');
  if (!gradeDiv) {
    console.warn('[FAP-AIO] Grade container div not found');
    return [];
  }

  const tables = gradeDiv.querySelectorAll<HTMLTableElement>('table');
  if (tables.length === 0) {
    console.warn('[FAP-AIO] No tables found in grade container');
    return [];
  }

  const table = tables[0];
  
  // Parse grade exactly like fap-gpa: [2, 3, 6, 7, 8, 9] are the column indices
  const subjects: Subject[] = Array.from(table.querySelectorAll('tbody>tr')).map((tr) => {
    const tds = tr.querySelectorAll('td');
    const args = [2, 3, 6, 7, 8, 9].map((e: number) => extractText(tds[e] as HTMLElement));
    return {
      semester: args[0],
      code: args[1],
      name: args[2],
      credit: parseFloat(args[3]) || 0,
      grade: parseFloat(args[4]) || 0,
      status: args[5] as Subject['status'],
    };
  });

  // Create map of semesters exactly like fap-gpa
  const semesters = new Map<string, SemesterData>();

  subjects.forEach((subj) => {
    // If no semester, use status as semester (for "Not started" etc.)
    let semester = subj.semester;
    if (!semester) semester = subj.status;
    
    if (!semesters.has(semester)) {
      const semName = semester;
      let year = '';
      let data: string | undefined = undefined;
      
      if (semester === 'Not started' || semester === 'Studying') {
        data = semester;
      } else {
        year = semester.slice(-4);
      }
      
      semesters.set(semester, {
        semester: semName,
        year,
        data,
        subjects: [],
        gpa: 0,
      });
    }

    const semesterObj = semesters.get(semester)!;
    semesterObj.subjects.push(subj);
  });

  // Calculate GPA for each semester
  const nonGPAKeys = getGPAConfig();
  semesters.forEach((semesterData) => {
    let totalCredits = 0;
    let totalPoints = 0;

    semesterData.subjects.forEach((subject) => {
      // Skip non-GPA subjects
      const isNonGPA = nonGPAKeys.some((prefix) =>
        subject.code.startsWith(prefix)
      );
      
      if (
        !isNonGPA &&
        subject.status === 'Passed' &&
        subject.grade > 0 &&
        subject.credit > 0
      ) {
        totalCredits += subject.credit;
        totalPoints += subject.grade * subject.credit;
      }
    });

    semesterData.gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
  });

  return Array.from(semesters.values()).sort((a, b) => {
    const seasonOrder = { Spring: 1, Summer: 2, Fall: 3 };
    const aSeason = a.semester.match(/^(Spring|Summer|Fall)/)?.[1] as keyof typeof seasonOrder;
    const bSeason = b.semester.match(/^(Spring|Summer|Fall)/)?.[1] as keyof typeof seasonOrder;
    
    if (a.year !== b.year) {
      return parseInt(a.year) - parseInt(b.year);
    }
    return seasonOrder[aSeason] - seasonOrder[bSeason];
  });
}

export function calculateCumulativeGPA(semesters: SemesterData[]): number {
  let totalCredits = 0;
  let totalPoints = 0;
  const nonGPAKeys = getGPAConfig();

  semesters.forEach((semester) => {
    semester.subjects.forEach((subject) => {
      const isNonGPA = nonGPAKeys.some((prefix) =>
        subject.code.startsWith(prefix)
      );
      
      if (
        !isNonGPA &&
        subject.status === 'Passed' &&
        subject.grade > 0 &&
        subject.credit > 0
      ) {
        totalCredits += subject.credit;
        totalPoints += subject.grade * subject.credit;
      }
    });
  });

  return totalCredits > 0 ? totalPoints / totalCredits : 0;
}
