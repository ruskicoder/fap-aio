export interface Subject {
  semester: string;
  code: string;
  name: string;
  credit: number;
  grade: number;
  status: 'Passed' | 'Not passed' | 'Studying' | 'Not started';
}

export interface SemesterData {
  semester: string;
  year: string;
  data?: string;
  subjects: Subject[];
  gpa: number;
}

export interface GPAConfig {
  nonGPAKeys: string[];
}

export const DEFAULT_NON_GPA_KEYS = [
  'OJS',
  'VOV',
  'GDQP',
  'LAB',
  'ENT',
  'SSS',
  'TMI',
  'TRS',
  'OTP',
];
