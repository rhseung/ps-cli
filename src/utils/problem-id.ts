import { join } from "path";

import { getProblemDir, getSolvingDir, findProjectRoot } from "./config";

/**
 * 현재 작업 디렉토리 경로에서 문제 번호를 추론합니다.
 * config의 problemDir 또는 solvingDir 설정에 따라 경로를 추론합니다.
 *
 * @param cwd - 확인할 디렉토리 경로 (기본값: process.cwd())
 * @returns 문제 번호 또는 null (추론 실패 시)
 *
 * @example
 * detectProblemIdFromPath('/path/to/problems/10998') // 10998 (problemDir="problems"인 경우)
 * detectProblemIdFromPath('/path/to/solving/10998') // 10998 (solvingDir="solving"인 경우)
 * detectProblemIdFromPath('/path/to/10998') // 10998 (problemDir="."인 경우)
 */
export function detectProblemIdFromPath(
  cwd: string = process.cwd(),
): number | null {
  const problemDir = getProblemDir();
  const solvingDir = getSolvingDir();
  const normalizedPath = cwd.replace(/\\/g, "/");

  // 디렉토리 목록 (problemDir, solvingDir 순서로 확인)
  const dirsToCheck = [problemDir, solvingDir].filter(
    (dir) => dir && dir !== "." && dir !== "",
  );

  // problemDir나 solvingDir가 "." 또는 ""인 경우 프로젝트 루트에서 직접 추론
  if (dirsToCheck.length === 0) {
    // 현재 경로의 마지막 세그먼트가 숫자인지 확인
    const segments = normalizedPath.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];

    if (lastSegment) {
      const problemId = parseInt(lastSegment, 10);
      if (
        !isNaN(problemId) &&
        problemId > 0 &&
        lastSegment === problemId.toString()
      ) {
        return problemId;
      }
    }
    return null;
  }

  // 각 디렉토리에서 확인
  for (const dir of dirsToCheck) {
    const dirPattern = `/${dir}/`;
    const dirIndex = normalizedPath.indexOf(dirPattern);
    if (dirIndex === -1) {
      continue;
    }

    // 디렉토리 이후의 경로 부분 추출
    const afterDir = normalizedPath.substring(dirIndex + dirPattern.length);
    if (!afterDir) {
      continue;
    }

    // 첫 번째 경로 세그먼트 추출 (문제 번호가 될 부분)
    const firstSegment = afterDir.split("/")[0];
    if (!firstSegment) {
      continue;
    }

    // 숫자로만 구성되어 있는지 확인
    const problemId = parseInt(firstSegment, 10);
    if (isNaN(problemId) || problemId <= 0) {
      continue;
    }

    // 숫자 부분만 정확히 매칭되는지 확인 (예: "10998abc" 같은 경우 방지)
    if (firstSegment !== problemId.toString()) {
      continue;
    }

    return problemId;
  }

  return null;
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
  cwd: string = process.cwd(),
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

/**
 * 문제 번호에 해당하는 디렉토리 경로를 반환합니다.
 * config의 problemDir 설정에 따라 경로가 결정됩니다.
 * 프로젝트 루트를 기준으로 생성하므로, 문제 디렉토리 안에서 실행해도 올바른 위치에 생성됩니다.
 *
 * @param problemId - 문제 번호
 * @param cwd - 현재 작업 디렉토리 (기본값: process.cwd(), 프로젝트 루트를 찾기 위해 사용)
 * @returns 문제 디렉토리 경로
 *
 * @example
 * getProblemDirPath(1000) // "/path/to/problems/1000" (problemDir="problems"인 경우)
 * getProblemDirPath(1000) // "/path/to/1000" (problemDir="."인 경우)
 */
export function getProblemDirPath(
  problemId: number,
  cwd: string = process.cwd(),
): string {
  const problemDir = getProblemDir();

  // 프로젝트 루트 찾기
  const projectRoot = findProjectRoot(cwd);
  const baseDir = projectRoot || cwd;

  // problemDir가 "." 또는 ""인 경우 프로젝트 루트에 직접 생성
  if (problemDir === "." || problemDir === "") {
    return join(baseDir, problemId.toString());
  }

  // 그 외의 경우 해당 디렉토리 아래에 생성
  return join(baseDir, problemDir, problemId.toString());
}

/**
 * 문제 번호에 해당하는 solving 디렉토리 경로를 반환합니다.
 * config의 solvingDir 설정에 따라 경로가 결정됩니다.
 * 프로젝트 루트를 기준으로 생성하므로, 문제 디렉토리 안에서 실행해도 올바른 위치에 생성됩니다.
 *
 * @param problemId - 문제 번호
 * @param cwd - 현재 작업 디렉토리 (기본값: process.cwd(), 프로젝트 루트를 찾기 위해 사용)
 * @returns solving 디렉토리 경로
 *
 * @example
 * getSolvingDirPath(1000) // "/path/to/solving/1000" (solvingDir="solving"인 경우)
 * getSolvingDirPath(1000) // "/path/to/1000" (solvingDir="."인 경우)
 */
export function getSolvingDirPath(
  problemId: number,
  cwd: string = process.cwd(),
): string {
  const solvingDir = getSolvingDir();

  // 프로젝트 루트 찾기
  const projectRoot = findProjectRoot(cwd);
  const baseDir = projectRoot || cwd;

  // solvingDir가 "." 또는 ""인 경우 프로젝트 루트에 직접 생성
  if (solvingDir === "." || solvingDir === "") {
    return join(baseDir, problemId.toString());
  }

  // 그 외의 경우 해당 디렉토리 아래에 생성
  return join(baseDir, solvingDir, problemId.toString());
}
