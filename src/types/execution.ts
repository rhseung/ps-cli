/**
 * 문제 실행 컨텍스트 정보
 */
export interface ProblemContext {
  /** 문제 번호 (null인 경우 자동 감지 실패) */
  problemId: number | null;
  /** 문제 디렉토리 경로 */
  problemDir: string;
  /** 현재 디렉토리가 문제 디렉토리인지 여부 */
  isCurrentDir: boolean;
}
