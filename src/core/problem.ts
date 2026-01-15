import { readFile } from 'fs/promises';
import { join } from 'path';

import type { Problem } from '../types/index';

import {
  getArchiveDir,
  getSolvingDir,
  findProjectRoot,
  getArchiveStrategy,
} from './config';
import { getTierName } from './tier';

/**
 * 시간 제한 문자열(예: "1 초", "2.5s")을 밀리초로 변환합니다.
 */
export function parseTimeLimitToMs(timeLimit?: string): number | undefined {
  if (!timeLimit) return undefined;
  const match = timeLimit.match(/([\d.]+)/);
  if (!match) return undefined;
  const seconds = parseFloat(match[1]);
  if (Number.isNaN(seconds)) return undefined;
  return Math.round(seconds * 1000);
}

/**
 * 문제 디렉토리의 meta.json에서 시간 제한을 읽어옵니다.
 * @param problemDir 문제 디렉토리 경로
 * @returns 시간 제한 (ms) 또는 undefined
 */
export async function getProblemTimeLimitMs(
  problemDir: string,
): Promise<number | undefined> {
  try {
    const metaPath = join(problemDir, 'meta.json');
    const metaRaw = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaRaw) as {
      timeLimitMs?: number;
      timeLimit?: string;
    };

    if (typeof meta.timeLimitMs === 'number') {
      return meta.timeLimitMs;
    }

    if (typeof meta.timeLimit === 'string') {
      return parseTimeLimitToMs(meta.timeLimit);
    }
  } catch {
    // meta.json 이 없거나 읽기 실패
  }

  return undefined;
}

/**
 * 파일 시스템 안전한 이름으로 변환합니다.
 * 특수 문자를 제거하거나 변환하여 디렉토리명으로 사용 가능하게 만듭니다.
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '') // 파일 시스템에서 금지된 문자 제거
    .replace(/\s+/g, '-') // 공백을 하이픈으로 변환
    .toLowerCase() // 소문자로 변환
    .trim();
}

/**
 * 티어 이름을 디렉토리명으로 사용 가능한 형태로 변환합니다.
 */
function getTierDirName(level: number): string {
  const tierName = getTierName(level);
  if (tierName === 'Unrated') {
    return 'unrated';
  }
  // "Bronze V" -> "bronze-v", "Silver I" -> "silver-i" 등
  return sanitizeFileName(tierName);
}

/**
 * 아카이빙 전략에 따른 서브 경로를 반환합니다.
 *
 * @param problemId - 문제 번호
 * @param strategy - 아카이빙 전략 ('flat', 'by-range', 'by-tier', 'by-tag')
 * @param problem - 문제 정보 (by-tier, by-tag 전략에 필요)
 * @returns 서브 경로 (예: '01000', 'bronze', '구현' 등)
 */
export function getArchiveSubPath(
  problemId: number,
  strategy: string = 'flat',
  problem?: { level?: number; tags?: string[] },
): string {
  switch (strategy) {
    case 'flat':
      return '';

    case 'by-range': {
      // 1000번대 묶기: 0-999 -> 00000, 1000-1999 -> 01000, 2000-2999 -> 02000, ...
      const range = Math.floor(problemId / 1000) * 1000;
      return String(range).padStart(5, '0');
    }

    case 'by-tier': {
      if (!problem || problem.level === undefined) {
        // 문제 정보가 없으면 flat으로 폴백
        return '';
      }
      return getTierDirName(problem.level);
    }

    case 'by-tag': {
      if (!problem || !problem.tags || problem.tags.length === 0) {
        // 태그가 없으면 flat으로 폴백
        return '';
      }
      // 첫 번째 태그 사용
      return sanitizeFileName(problem.tags[0]);
    }

    default:
      return '';
  }
}

/**
 * 현재 작업 디렉토리 경로에서 문제 번호를 추론합니다.
 * config의 archiveDir 또는 solvingDir 설정과 archiveStrategy에 따라 경로를 추론합니다.
 * 여러 아카이빙 전략을 시도하여 매칭합니다 (하위 호환성).
 *
 * @param cwd - 확인할 디렉토리 경로 (기본값: process.cwd())
 * @returns 문제 번호 또는 null (추론 실패 시)
 *
 * @example
 * detectProblemIdFromPath('/path/to/problems/10998') // 10998 (flat 전략)
 * detectProblemIdFromPath('/path/to/problems/01000/10998') // 10998 (by-range 전략)
 * detectProblemIdFromPath('/path/to/problems/bronze/10998') // 10998 (by-tier 전략)
 * detectProblemIdFromPath('/path/to/solving/10998') // 10998 (solvingDir="solving"인 경우)
 */
export function detectProblemIdFromPath(
  cwd: string = process.cwd(),
): number | null {
  const archiveDir = getArchiveDir();
  const solvingDir = getSolvingDir();
  const archiveStrategy = getArchiveStrategy();
  const normalizedPath = cwd.replace(/\\/g, '/');

  // 디렉토리 목록 (archiveDir, solvingDir 순서로 확인)
  const dirsToCheck = [archiveDir, solvingDir].filter(
    (dir) => dir && dir !== '.' && dir !== '',
  );

  // archiveDir나 solvingDir가 "." 또는 ""인 경우 프로젝트 루트에서 직접 추론
  if (dirsToCheck.length === 0) {
    // 현재 경로의 마지막 세그먼트가 숫자인지 확인
    const segments = normalizedPath.split('/').filter(Boolean);
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

    const segments = afterDir.split('/').filter(Boolean);
    if (segments.length === 0) {
      continue;
    }

    // 아카이빙 전략에 따라 추론
    let problemId: number | null = null;

    if (archiveStrategy === 'flat') {
      // flat: 첫 번째 세그먼트가 문제 번호
      const firstSegment = segments[0];
      if (firstSegment) {
        const id = parseInt(firstSegment, 10);
        if (
          !isNaN(id) &&
          id > 0 &&
          firstSegment === id.toString() &&
          segments.length === 1
        ) {
          problemId = id;
        }
      }
    } else if (archiveStrategy === 'by-range') {
      // by-range: 두 번째 세그먼트가 문제 번호 (첫 번째는 범위)
      if (segments.length === 2) {
        const secondSegment = segments[1];
        if (secondSegment) {
          const id = parseInt(secondSegment, 10);
          if (!isNaN(id) && id > 0 && secondSegment === id.toString()) {
            problemId = id;
          }
        }
      }
    } else if (archiveStrategy === 'by-tier' || archiveStrategy === 'by-tag') {
      // by-tier, by-tag: 두 번째 세그먼트가 문제 번호 (첫 번째는 티어/태그)
      if (segments.length === 2) {
        const secondSegment = segments[1];
        if (secondSegment) {
          const id = parseInt(secondSegment, 10);
          if (!isNaN(id) && id > 0 && secondSegment === id.toString()) {
            problemId = id;
          }
        }
      }
    }

    // 현재 전략으로 매칭되지 않으면 다른 전략들도 시도 (하위 호환성)
    if (!problemId) {
      // flat 전략 시도 (마지막 세그먼트가 숫자)
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) {
        const id = parseInt(lastSegment, 10);
        if (
          !isNaN(id) &&
          id > 0 &&
          lastSegment === id.toString() &&
          segments.length === 1
        ) {
          problemId = id;
        }
      }

      // by-range, by-tier, by-tag 전략 시도 (두 번째 세그먼트가 숫자)
      if (!problemId && segments.length === 2) {
        const secondSegment = segments[1];
        if (secondSegment) {
          const id = parseInt(secondSegment, 10);
          if (!isNaN(id) && id > 0 && secondSegment === id.toString()) {
            problemId = id;
          }
        }
      }
    }

    if (problemId) {
      return problemId;
    }
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
 * 문제 번호에 해당하는 아카이브 디렉토리 경로를 반환합니다.
 * config의 archiveDir 설정과 archiveStrategy에 따라 경로가 결정됩니다.
 * 프로젝트 루트를 기준으로 생성하므로, 문제 디렉토리 안에서 실행해도 올바른 위치에 생성됩니다.
 *
 * @param problemId - 문제 번호
 * @param cwd - 현재 작업 디렉토리 (기본값: process.cwd(), 프로젝트 루트를 찾기 위해 사용)
 * @param problem - 문제 정보 (by-tier, by-tag 전략에 필요, 선택적)
 * @returns 아카이브 디렉토리 경로
 *
 * @example
 * getArchiveDirPath(1000) // "/path/to/problems/1000" (flat 전략, archiveDir="problems"인 경우)
 * getArchiveDirPath(1000) // "/path/to/problems/01000/1000" (by-range 전략)
 * getArchiveDirPath(1000, process.cwd(), problem) // "/path/to/problems/bronze/1000" (by-tier 전략)
 */
export function getArchiveDirPath(
  problemId: number,
  cwd: string = process.cwd(),
  problem?: { level?: number; tags?: string[] },
): string {
  const archiveDir = getArchiveDir();
  const archiveStrategy = getArchiveStrategy();

  // 프로젝트 루트 찾기
  const projectRoot = findProjectRoot(cwd);
  const baseDir = projectRoot || cwd;

  // 아카이빙 전략에 따른 서브 경로
  const subPath = getArchiveSubPath(problemId, archiveStrategy, problem);

  // archiveDir가 "." 또는 ""인 경우 프로젝트 루트에 직접 생성
  if (archiveDir === '.' || archiveDir === '') {
    if (subPath) {
      return join(baseDir, subPath, problemId.toString());
    }
    return join(baseDir, problemId.toString());
  }

  // 그 외의 경우 해당 디렉토리 아래에 생성
  if (subPath) {
    return join(baseDir, archiveDir, subPath, problemId.toString());
  }
  return join(baseDir, archiveDir, problemId.toString());
}

/**
 * 문제 번호에 해당하는 solving 디렉토리 경로를 반환합니다.
 * config의 solvingDir 설정에 따라 경로가 결정됩니다.
 * solving dir은 아카이빙 전략을 적용하지 않고 항상 평면적으로 나열됩니다.
 * 프로젝트 루트를 기준으로 생성하므로, 문제 디렉토리 안에서 실행해도 올바른 위치에 생성됩니다.
 *
 * @param problemId - 문제 번호
 * @param cwd - 현재 작업 디렉토리 (기본값: process.cwd(), 프로젝트 루트를 찾기 위해 사용)
 * @param problem - 문제 정보 (사용하지 않음, 호환성을 위해 유지)
 * @returns solving 디렉토리 경로
 *
 * @example
 * getSolvingDirPath(1000) // "/path/to/solving/1000" (solvingDir="solving"인 경우)
 * getSolvingDirPath(1000) // "/path/to/1000" (solvingDir="."인 경우)
 */
export function getSolvingDirPath(
  problemId: number,
  cwd: string = process.cwd(),
  _?: Problem,
): string {
  const solvingDir = getSolvingDir();

  // 프로젝트 루트 찾기
  const projectRoot = findProjectRoot(cwd);
  const baseDir = projectRoot || cwd;

  // solving dir은 아카이빙 전략을 적용하지 않고 항상 평면적으로 나열
  // solvingDir가 "." 또는 ""인 경우 프로젝트 루트에 직접 생성
  if (solvingDir === '.' || solvingDir === '') {
    return join(baseDir, problemId.toString());
  }

  // 그 외의 경우 해당 디렉토리 아래에 직접 생성
  return join(baseDir, solvingDir, problemId.toString());
}
