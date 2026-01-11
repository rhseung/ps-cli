export interface TestCase {
  input: string;
  output: string;
}

export interface Problem {
  id: number;
  title: string;
  level: number;
  tier: string;
  tags: string[];
  timeLimit?: string;
  memoryLimit?: string;
  submissions?: string;
  accepted?: string;
  acceptedUsers?: string;
  acceptedRate?: string;
  description?: string;
  inputFormat?: string;
  outputFormat?: string;
  testCases: TestCase[];
}

export interface SolvedAcProblem {
  problemId: number;
  titleKo: string;
  level: number;
  tags: Array<{
    key: string;
    displayNames: Array<{
      language: string;
      name: string;
      short: string;
    }>;
  }>;
}

export interface SolvedAcUser {
  handle: string;
  bio: string;
  badgeId?: string;
  backgroundId?: string;
  profileImageUrl?: string;
  solvedCount: number;
  voteCount: number;
  tier: number;
  rating: number;
  ratingByProblemsSum: number;
  ratingByClass: number;
  ratingBySolvedCount: number;
  ratingByVoteCount: number;
  class: number;
  classDecoration: string;
  rivalCount: number;
  reverseRivalCount: number;
  maxStreak: number;
  rank: number;
}

export interface ScrapedProblem {
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  testCases: TestCase[];
  timeLimit?: string;
  memoryLimit?: string;
  submissions?: string;
  accepted?: string;
  acceptedUsers?: string;
  acceptedRate?: string;
}

export type TestStatus = 'pass' | 'fail' | 'error';

export interface TestResult {
  caseId: number;
  inputPath: string;
  expected?: string;
  actual?: string;
  error?: string;
  stderr?: string;
  status: TestStatus;
  durationMs?: number;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  errored: number;
}

export type SubmitStatus =
  | 'AC'
  | 'WA'
  | 'TLE'
  | 'MLE'
  | 'RE'
  | 'CE'
  | 'OLE'
  | 'PE'
  | 'WAITING'
  | 'JUDGING';

export interface SubmitResult {
  problemId: number;
  submitId?: number;
  status: SubmitStatus;
  time?: number | null;
  memory?: number | null;
  submittedAt?: Date;
  language: string;
  message?: string;
}

export interface SearchResult {
  problemId: number;
  title: string;
  level?: number; // 티어 레벨 (1-31)
  solvedCount?: number;
  averageTries?: number;
  isSolved?: boolean; // 사용자가 해결한 문제인지 여부
}

export interface SearchResults {
  problems: SearchResult[];
  currentPage: number;
  totalPages: number;
}

export type {
  Workbook,
  WorkbookProblem,
  WorkbookProgress,
  ProblemStatus,
} from './workbook';
