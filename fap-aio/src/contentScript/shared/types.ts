export interface Subject {
  code: string;
  name: string;
  credits: number;
  grade: number;
  status: string;
  semester: string;
}

export interface SemesterData {
  semester: string;
  subjects: Subject[];
  gpa: number;
}
