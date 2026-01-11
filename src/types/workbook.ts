export interface WorkbookProblem {
  problemId: number;
  title: string;
  level?: number; // 티어 레벨 (solved.ac에서 가져옴)
  order: number; // 문제집 내 순서
}

export interface Workbook {
  id: number;
  title: string;
  problems: WorkbookProblem[];
  createdAt: Date;
}
