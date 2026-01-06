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
