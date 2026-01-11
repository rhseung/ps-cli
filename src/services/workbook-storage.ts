import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

import type { WorkbookProgress } from '../types/workbook';
import type { ProblemStatus } from '../types/workbook';
import { findProjectRoot } from '../utils/config';

/**
 * 문제집 진행 상황 파일 경로를 가져옵니다.
 */
function getWorkbookProgressPath(workbookId: number): string {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    throw new Error(
      '프로젝트 루트를 찾을 수 없습니다. ps-cli 프로젝트가 아닌 디렉토리에서 실행 중입니다.',
    );
  }

  const workbooksDir = join(projectRoot, '.ps-cli', 'workbooks');
  return join(workbooksDir, `${workbookId}.json`);
}

/**
 * 문제집 진행 상황을 로드합니다.
 * @param workbookId - 문제집 ID
 * @returns 진행 상황 (없으면 새로 생성)
 */
export async function getWorkbookProgress(
  workbookId: number,
): Promise<WorkbookProgress> {
  const filePath = getWorkbookProgressPath(workbookId);

  if (!existsSync(filePath)) {
    // 새 진행 상황 생성
    return {
      workbookId,
      problems: {},
      updatedAt: new Date(),
    };
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as WorkbookProgress;

    // 날짜 문자열을 Date 객체로 변환
    if (data.updatedAt && typeof data.updatedAt === 'string') {
      data.updatedAt = new Date(data.updatedAt);
    }

    // 각 문제의 lastAttemptedAt도 변환
    for (const problemId in data.problems) {
      const problem = data.problems[problemId];
      if (
        problem.lastAttemptedAt &&
        typeof problem.lastAttemptedAt === 'string'
      ) {
        problem.lastAttemptedAt = new Date(problem.lastAttemptedAt);
      }
    }

    return data;
  } catch (error) {
    throw new Error(
      `진행 상황 파일을 읽을 수 없습니다: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * 문제집 진행 상황을 저장합니다.
 * @param progress - 진행 상황
 */
export async function saveWorkbookProgress(
  progress: WorkbookProgress,
): Promise<void> {
  const filePath = getWorkbookProgressPath(progress.workbookId);
  const dir = join(filePath, '..');

  // 디렉토리가 없으면 생성
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  // updatedAt 업데이트
  progress.updatedAt = new Date();

  try {
    await writeFile(filePath, JSON.stringify(progress, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(
      `진행 상황 파일을 저장할 수 없습니다: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * 문제의 상태를 업데이트합니다.
 * @param workbookId - 문제집 ID
 * @param problemId - 문제 ID
 * @param status - 새로운 상태
 */
export async function updateProblemStatus(
  workbookId: number,
  problemId: number,
  status: ProblemStatus,
): Promise<void> {
  const progress = await getWorkbookProgress(workbookId);

  if (!progress.problems[problemId]) {
    progress.problems[problemId] = {
      status: 'unsolved',
      attemptCount: 0,
    };
  }

  const problem = progress.problems[problemId];
  const previousStatus = problem.status;

  // 상태 업데이트
  problem.status = status;
  problem.lastAttemptedAt = new Date();

  // 상태가 변경된 경우에만 시도 횟수 증가
  // (같은 상태로 다시 설정하는 경우는 증가하지 않음)
  if (previousStatus !== status) {
    // solved나 failed로 변경되는 경우에만 시도 횟수 증가
    if (status === 'solved' || status === 'failed') {
      problem.attemptCount += 1;
    }
  }

  await saveWorkbookProgress(progress);
}

/**
 * 문제의 시도 횟수를 증가시킵니다.
 * @param workbookId - 문제집 ID
 * @param problemId - 문제 ID
 */
export async function incrementAttemptCount(
  workbookId: number,
  problemId: number,
): Promise<void> {
  const progress = await getWorkbookProgress(workbookId);

  if (!progress.problems[problemId]) {
    progress.problems[problemId] = {
      status: 'unsolved',
      attemptCount: 0,
    };
  }

  progress.problems[problemId].attemptCount += 1;
  progress.problems[problemId].lastAttemptedAt = new Date();

  await saveWorkbookProgress(progress);
}

/**
 * 문제집 진행 상황을 초기화합니다.
 * @param workbookId - 문제집 ID
 */
export async function resetWorkbookProgress(workbookId: number): Promise<void> {
  const progress: WorkbookProgress = {
    workbookId,
    problems: {},
    updatedAt: new Date(),
  };

  await saveWorkbookProgress(progress);
}
