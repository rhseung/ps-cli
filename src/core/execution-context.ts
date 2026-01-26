import { access, stat } from 'fs/promises';
import { readdir } from 'fs/promises';
import { join } from 'path';

import type { ProblemContext } from '../types/execution';

import {
  detectLanguageFromFile,
  getSupportedLanguages,
  getLanguageConfig,
  type Language,
} from './language';
import {
  getProblemId,
  detectProblemIdFromPath,
  getArchiveDirPath,
  getSolvingDirPath,
} from './problem';

export interface ResolveProblemContextOptions {
  /** Problem ID가 필수인지 여부 */
  requireId?: boolean;
}

/**
 * 디렉토리가 존재하는지 확인합니다.
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 명령어 인자와 현재 경로에서 문제 컨텍스트를 해석합니다.
 * solving dir과 archive dir 둘 다 확인하여 존재하는 디렉토리를 사용합니다.
 * solving dir을 먼저 확인하고, 없으면 archive dir을 확인합니다.
 *
 * @param args - 명령어 인자 배열
 * @param options - 옵션
 * @returns 문제 컨텍스트
 * @throws requireId가 true이고 problemId를 찾을 수 없는 경우
 * @throws problemId가 주어졌지만 solving dir과 archive dir 둘 다 존재하지 않는 경우
 */
export async function resolveProblemContext(
  args: string[],
  options: ResolveProblemContextOptions = {},
): Promise<ProblemContext> {
  const { requireId = false } = options;

  // 현재 경로에서 문제 번호 추론
  const currentPathProblemId = detectProblemIdFromPath(process.cwd());

  // 인자에서 문제 번호 추출
  const problemId = getProblemId(args);

  // Problem ID 검증
  if (requireId && problemId === null) {
    throw new Error(
      '문제 번호를 찾을 수 없습니다. 문제 번호를 인자로 전달하거나 문제 디렉토리에서 실행해주세요.',
    );
  }

  // 문제 디렉토리 결정
  const isCurrentDir =
    problemId === null ||
    (problemId !== null && currentPathProblemId === problemId);

  let archiveDir: string;

  if (problemId && !isCurrentDir) {
    // solving dir과 archive dir 둘 다 확인
    const solvingDirPath = getSolvingDirPath(problemId);
    const archiveDirPath = getArchiveDirPath(problemId);

    // 먼저 solving dir 확인
    const solvingDirExists = await directoryExists(solvingDirPath);
    if (solvingDirExists) {
      archiveDir = solvingDirPath;
    } else {
      // solving dir이 없으면 archive dir 확인
      const archiveDirExists = await directoryExists(archiveDirPath);
      if (archiveDirExists) {
        archiveDir = archiveDirPath;
      } else {
        // 둘 다 없으면 solving dir을 기본값으로 사용 (새로 생성될 가능성이 높음)
        archiveDir = solvingDirPath;
      }
    }
  } else {
    // 현재 디렉토리 사용
    archiveDir = process.cwd();
  }

  return {
    problemId,
    archiveDir,
    isCurrentDir,
  };
}

/**
 * 문제 디렉토리에서 언어를 자동 감지하거나, override가 제공되면 검증합니다.
 * @param problemDir - 문제 디렉토리 경로
 * @param override - 언어 override (선택적)
 * @returns 감지되거나 검증된 언어
 * @throws 언어를 찾을 수 없거나 지원하지 않는 언어인 경우
 */
export async function resolveLanguage(
  problemDir: string,
  override?: Language,
): Promise<Language> {
  // override가 제공되면 검증만 수행
  if (override) {
    const validLanguages = getSupportedLanguages();
    if (!validLanguages.includes(override)) {
      throw new Error(
        `지원하지 않는 언어입니다: ${override}\n지원 언어: ${validLanguages.join(
          ', ',
        )}`,
      );
    }
    return override;
  }

  // 자동 감지
  const solutionFilePath = await findSolutionFile(problemDir);
  const solutionFileName = solutionFilePath.split(/[/\\]/).pop() || '';
  const detectedLanguage = detectLanguageFromFile(solutionFileName);
  if (!detectedLanguage) {
    throw new Error(`지원하지 않는 언어입니다: ${solutionFileName}`);
  }

  return detectedLanguage;
}

/**
 * solution 파일 이름에서 인덱스를 파싱합니다.
 * @param filename - 파일 이름
 * @returns 인덱스 (파싱 실패 시 null)
 */
function parseSolutionIndex(filename: string): number | null {
  // solution-{인덱스}.{확장자} 형식
  const match = filename.match(/^solution-(\d+)\./);
  if (match) {
    const index = parseInt(match[1], 10);
    if (!isNaN(index) && index > 0) {
      return index;
    }
  }

  // solution.{확장자} 형식은 인덱스 1로 간주 (하위 호환성)
  if (filename.match(/^solution\./)) {
    return 1;
  }

  return null;
}

/**
 * 문제 디렉토리에서 모든 solution 파일을 찾습니다.
 * @param problemDir - 문제 디렉토리 경로
 * @param language - 언어 필터 (선택적)
 * @returns solution 파일 정보 배열
 */
export async function findSolutionFiles(
  problemDir: string,
  language?: Language,
): Promise<
  Array<{
    path: string;
    filename: string;
    index: number;
    language: string;
    mtime: Date;
  }>
> {
  try {
    const files = await readdir(problemDir);
    const solutionFiles: Array<{
      path: string;
      filename: string;
      index: number;
      language: string;
      mtime: Date;
    }> = [];

    for (const file of files) {
      if (!file.startsWith('solution')) {
        continue;
      }

      const detectedLang = detectLanguageFromFile(file);
      if (!detectedLang) {
        continue;
      }

      // 언어 필터가 있으면 확인
      if (language && detectedLang !== language) {
        continue;
      }

      const index = parseSolutionIndex(file);
      if (index === null) {
        continue;
      }

      const filePath = join(problemDir, file);
      try {
        const stats = await stat(filePath);
        solutionFiles.push({
          path: filePath,
          filename: file,
          index,
          language: detectedLang,
          mtime: stats.mtime,
        });
      } catch {
        // stat 실패 시 스킵
      }
    }

    return solutionFiles;
  } catch {
    return [];
  }
}

/**
 * 문제 디렉토리에서 가장 최근 수정된 solution 파일을 찾습니다.
 * @param problemDir - 문제 디렉토리 경로
 * @param language - 언어 필터 (선택적)
 * @returns solution 파일의 전체 경로
 * @throws solution 파일을 찾을 수 없는 경우
 */
export async function findLatestSolutionFile(
  problemDir: string,
  language?: Language,
): Promise<string> {
  const files = await findSolutionFiles(problemDir, language);
  if (files.length === 0) {
    throw new Error('solution.* 파일을 찾을 수 없습니다.');
  }

  // 가장 최근 수정된 파일 찾기
  const latest = files.reduce((prev, current) => {
    return current.mtime > prev.mtime ? current : prev;
  });

  return latest.path;
}

/**
 * 문제 디렉토리에서 특정 인덱스의 solution 파일을 찾습니다.
 * @param problemDir - 문제 디렉토리 경로
 * @param index - 인덱스
 * @param language - 언어 필터 (선택적)
 * @returns solution 파일의 전체 경로
 * @throws solution 파일을 찾을 수 없는 경우
 */
export async function findSolutionFileByIndex(
  problemDir: string,
  index: number,
  language?: Language,
): Promise<string> {
  const files = await findSolutionFiles(problemDir, language);
  const targetFile = files.find((f) => f.index === index);

  if (!targetFile) {
    const langText = language ? ` (언어: ${language})` : '';
    throw new Error(
      `인덱스 ${index}의 solution 파일을 찾을 수 없습니다.${langText}`,
    );
  }

  return targetFile.path;
}

/**
 * 문제 디렉토리에서 solution 파일을 찾습니다.
 * 기본적으로 가장 최근 수정된 파일을 반환합니다.
 * @param problemDir - 문제 디렉토리 경로
 * @param language - 언어 필터 (선택적)
 * @returns solution 파일의 전체 경로
 * @throws solution 파일을 찾을 수 없는 경우
 */
export async function findSolutionFile(
  problemDir: string,
  language?: Language,
): Promise<string> {
  return findLatestSolutionFile(problemDir, language);
}
