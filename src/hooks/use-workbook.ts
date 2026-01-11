import { useEffect, useState } from 'react';

import { getProblem } from '../services/solved-api';
import { scrapeWorkbook } from '../services/workbook-scraper';
import {
  getWorkbookProgress,
  updateProblemStatus,
} from '../services/workbook-storage';
import type { ProblemStatus } from '../types/workbook';
import type {
  Workbook,
  WorkbookProblem,
  WorkbookProgress,
} from '../types/workbook';

export type WorkbookMode = 'sequential' | 'failed' | 'unsolved';

export interface UseWorkbookParams {
  workbookId: number | null;
  mode?: WorkbookMode;
  onComplete?: () => void;
}

export interface UseWorkbookReturn {
  status: 'loading' | 'ready' | 'error';
  workbook: Workbook | null;
  progress: WorkbookProgress | null;
  enrichedProblems: Array<WorkbookProblem & { status?: ProblemStatus }>;
  error: string | null;
  message: string;
  nextProblem: WorkbookProblem | null;
  updateStatus: (problemId: number, status: ProblemStatus) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * 문제 목록에 티어 정보를 추가합니다.
 * solved.ac API를 사용하여 일괄 조회합니다.
 */
async function enrichProblemsWithTiers(
  problems: WorkbookProblem[],
): Promise<WorkbookProblem[]> {
  // Rate limit을 고려하여 배치 처리
  // 한 번에 너무 많은 요청을 보내지 않도록 제한
  const BATCH_SIZE = 10;
  const DELAY_MS = 200; // 각 배치 사이에 200ms 대기

  const enriched: WorkbookProblem[] = [];

  for (let i = 0; i < problems.length; i += BATCH_SIZE) {
    const batch = problems.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (problem) => {
      try {
        const solvedAcData = await getProblem(problem.problemId);
        return {
          ...problem,
          level: solvedAcData.level,
        };
      } catch (error) {
        // API 호출 실패해도 문제는 포함 (티어 정보만 없음)
        console.warn(
          `문제 ${problem.problemId}의 티어 정보를 가져올 수 없습니다: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return problem;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    enriched.push(...batchResults);

    // 마지막 배치가 아니면 대기
    if (i + BATCH_SIZE < problems.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  return enriched;
}

export function useWorkbook({
  workbookId,
  mode = 'sequential',
}: UseWorkbookParams): UseWorkbookReturn {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [progress, setProgress] = useState<WorkbookProgress | null>(null);
  const [enrichedProblems, setEnrichedProblems] = useState<
    Array<WorkbookProblem & { status?: ProblemStatus }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('문제집을 로드하는 중...');

  useEffect(() => {
    if (workbookId !== null) {
      // useEffect 내부에서 비동기 함수를 정의하고 즉시 호출
      void (async () => {
        try {
          setStatus('loading');
          setError(null);
          setMessage('문제집 정보를 가져오는 중...');

          // 문제집 스크래핑
          const scrapedWorkbook = await scrapeWorkbook(workbookId);
          setWorkbook(scrapedWorkbook);

          // 진행 상황 로드
          setMessage('진행 상황을 로드하는 중...');
          const workbookProgress = await getWorkbookProgress(workbookId);
          setProgress(workbookProgress);

          // 티어 정보 추가
          setMessage('티어 정보를 가져오는 중...');
          const enriched = await enrichProblemsWithTiers(
            scrapedWorkbook.problems,
          );

          // 진행 상황과 병합
          const problemsWithStatus = enriched.map((problem) => {
            const problemProgress =
              workbookProgress.problems[problem.problemId];
            return {
              ...problem,
              status: problemProgress?.status,
            };
          });

          setEnrichedProblems(problemsWithStatus);
          setStatus('ready');
          setMessage('준비 완료');
        } catch (err) {
          setStatus('error');
          setError(err instanceof Error ? err.message : String(err));
          setMessage('로드 실패');
        }
      })();
    } else {
      // 비동기로 상태 업데이트하여 경고 방지
      const timer = setTimeout(() => {
        setStatus('ready');
        setMessage('문제집 ID를 입력해주세요.');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [workbookId]);

  // 다음 문제 선택
  const getNextProblem = (): WorkbookProblem | null => {
    if (!workbook || enrichedProblems.length === 0) {
      return null;
    }

    let candidates: Array<WorkbookProblem & { status?: ProblemStatus }> = [];

    switch (mode) {
      case 'sequential': {
        // 순서대로, 아직 풀지 않은 문제
        candidates = enrichedProblems.filter(
          (p) => !p.status || p.status === 'unsolved',
        );
        // 순서대로 정렬
        candidates.sort((a, b) => a.order - b.order);
        break;
      }
      case 'failed': {
        // 틀린 문제만
        candidates = enrichedProblems.filter((p) => p.status === 'failed');
        // 최근 시도한 순서대로 정렬
        candidates.sort((a, b) => {
          const aProgress = progress?.problems[a.problemId];
          const bProgress = progress?.problems[b.problemId];
          if (!aProgress?.lastAttemptedAt && !bProgress?.lastAttemptedAt) {
            return 0;
          }
          if (!aProgress?.lastAttemptedAt) return 1;
          if (!bProgress?.lastAttemptedAt) return -1;
          return (
            bProgress.lastAttemptedAt!.getTime() -
            aProgress.lastAttemptedAt!.getTime()
          );
        });
        break;
      }
      case 'unsolved': {
        // 미해결 문제만
        candidates = enrichedProblems.filter(
          (p) => !p.status || p.status === 'unsolved',
        );
        // 순서대로 정렬
        candidates.sort((a, b) => a.order - b.order);
        break;
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    return candidates[0];
  };

  const nextProblem = getNextProblem();

  // 상태 업데이트
  const updateStatus = async (
    problemId: number,
    newStatus: ProblemStatus,
  ): Promise<void> => {
    if (!workbook) {
      throw new Error('문제집이 로드되지 않았습니다.');
    }

    await updateProblemStatus(workbook.id, problemId, newStatus);

    // 진행 상황 다시 로드
    const updatedProgress = await getWorkbookProgress(workbook.id);
    setProgress(updatedProgress);

    // enrichedProblems 업데이트
    setEnrichedProblems((prev) =>
      prev.map((p) =>
        p.problemId === problemId ? { ...p, status: newStatus } : p,
      ),
    );
  };

  // 새로고침
  const refresh = async (): Promise<void> => {
    if (workbookId !== null) {
      try {
        setStatus('loading');
        setError(null);
        setMessage('문제집 정보를 가져오는 중...');

        // 문제집 스크래핑
        const scrapedWorkbook = await scrapeWorkbook(workbookId);
        setWorkbook(scrapedWorkbook);

        // 진행 상황 로드
        setMessage('진행 상황을 로드하는 중...');
        const workbookProgress = await getWorkbookProgress(workbookId);
        setProgress(workbookProgress);

        // 티어 정보 추가
        setMessage('티어 정보를 가져오는 중...');
        const enriched = await enrichProblemsWithTiers(
          scrapedWorkbook.problems,
        );

        // 진행 상황과 병합
        const problemsWithStatus = enriched.map((problem) => {
          const problemProgress = workbookProgress.problems[problem.problemId];
          return {
            ...problem,
            status: problemProgress?.status,
          };
        });

        setEnrichedProblems(problemsWithStatus);
        setStatus('ready');
        setMessage('준비 완료');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
        setMessage('로드 실패');
      }
    }
  };

  return {
    status,
    workbook,
    progress,
    enrichedProblems,
    error,
    message,
    nextProblem,
    updateStatus,
    refresh,
  };
}
