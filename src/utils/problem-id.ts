import { join, basename, dirname } from "path";

/**
 * 현재 작업 디렉토리 경로에서 문제 번호를 추론합니다.
 * 경로가 `problems/{문제번호}` 형식이거나 그 하위 디렉토리인 경우 문제 번호를 반환합니다.
 *
 * @param cwd - 확인할 디렉토리 경로 (기본값: process.cwd())
 * @returns 문제 번호 또는 null (추론 실패 시)
 *
 * @example
 * detectProblemIdFromPath('/path/to/problems/10998') // 10998
 * detectProblemIdFromPath('/path/to/problems/10998/solution.py') // 10998
 * detectProblemIdFromPath('/path/to/other') // null
 */
export function detectProblemIdFromPath(
  cwd: string = process.cwd()
): number | null {
  // 경로를 정규화하고 절대 경로로 변환
  const normalizedPath = cwd.replace(/\\/g, "/");

  // `problems/` 문자열을 찾음
  const problemsIndex = normalizedPath.indexOf("/problems/");
  if (problemsIndex === -1) {
    return null;
  }

  // `problems/` 이후의 경로 부분 추출
  const afterProblems = normalizedPath.substring(
    problemsIndex + "/problems/".length
  );
  if (!afterProblems) {
    return null;
  }

  // 첫 번째 경로 세그먼트 추출 (문제 번호가 될 부분)
  const firstSegment = afterProblems.split("/")[0];
  if (!firstSegment) {
    return null;
  }

  // 숫자로만 구성되어 있는지 확인
  const problemId = parseInt(firstSegment, 10);
  if (isNaN(problemId) || problemId <= 0) {
    return null;
  }

  // 숫자 부분만 정확히 매칭되는지 확인 (예: "10998abc" 같은 경우 방지)
  if (firstSegment !== problemId.toString()) {
    return null;
  }

  return problemId;
}

/**
 * 명령어 인자 또는 현재 경로에서 문제 번호를 추론합니다.
 * 인자가 있으면 우선적으로 사용하고, 없으면 경로에서 자동 추론합니다.
 *
 * @param args - 명령어 인자 배열
 * @param cwd - 확인할 디렉토리 경로 (기본값: process.cwd())
 * @returns 문제 번호 또는 null (추론 실패 시)
 *
 * @example
 * getProblemId(['10998'], '/path/to') // 10998 (인자 우선)
 * getProblemId([], '/path/to/problems/10998') // 10998 (경로에서 추론)
 * getProblemId([], '/path/to/other') // null
 */
export function getProblemId(
  args: string[],
  cwd: string = process.cwd()
): number | null {
  // 인자가 있으면 우선적으로 파싱
  if (args.length > 0 && args[0]) {
    const problemId = parseInt(args[0], 10);
    if (!isNaN(problemId) && problemId > 0) {
      return problemId;
    }
  }

  // 인자가 없거나 유효하지 않으면 경로에서 추론
  return detectProblemIdFromPath(cwd);
}
