import { existsSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

import { useEffect, useState } from 'react';

import { findProjectRoot, getArchiveDir, getSolvingDir } from '../core';
import { scrapeUserStats } from '../services/scraper';
import {
  getUserStats,
  getUserTop100,
  getUserProblemStats,
  getUserTagRatings,
} from '../services/solved-api';
import type {
  SolvedAcUser,
  SolvedAcProblem,
  SolvedAcProblemStat,
  SolvedAcTagRating,
  UserBojStats,
} from '../types';

export interface UseUserStatsParams {
  handle: string;
  onComplete: () => void;
  fetchLocalCount?: boolean;
}

export interface UseUserStatsReturn {
  status: 'loading' | 'success' | 'error';
  user: SolvedAcUser | null;
  top100: SolvedAcProblem[] | null;
  problemStats: SolvedAcProblemStat[] | null;
  tagRatings: SolvedAcTagRating[] | null;
  bojStats: UserBojStats | null;
  localSolvedCount: number | null;
  error: string | null;
}

async function countProblems(dir: string): Promise<number> {
  let count = 0;
  try {
    if (!existsSync(dir)) return 0;
    const entries = await readdir(dir);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const fullPath = join(dir, entry);
      const s = await stat(fullPath);
      if (s.isDirectory()) {
        if (existsSync(join(fullPath, 'meta.json'))) {
          count++;
        } else {
          count += await countProblems(fullPath);
        }
      }
    }
  } catch {
    // ignore
  }
  return count;
}

export function useUserStats({
  handle,
  onComplete,
  fetchLocalCount = false,
}: UseUserStatsParams): UseUserStatsReturn {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [user, setUser] = useState<SolvedAcUser | null>(null);
  const [top100, setTop100] = useState<SolvedAcProblem[] | null>(null);
  const [problemStats, setProblemStats] = useState<
    SolvedAcProblemStat[] | null
  >(null);
  const [tagRatings, setTagRatings] = useState<SolvedAcTagRating[] | null>(
    null,
  );
  const [bojStats, setBojStats] = useState<UserBojStats | null>(null);
  const [localSolvedCount, setLocalSolvedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // 먼저 사용자 존재 여부 확인
        const userData = await getUserStats(handle).catch((err) => {
          // 404 에러인 경우 명확한 메시지 반환
          if (err instanceof Error && err.message.includes('404')) {
            throw new Error(`사용자 '${handle}'을(를) 찾을 수 없습니다.`);
          }
          throw err;
        });

        if (!userData) {
          throw new Error(`사용자 '${handle}'을(를) 찾을 수 없습니다.`);
        }

        setUser(userData);

        // 사용자가 존재하면 나머지 통계 데이터를 병렬로 가져옴
        const [top100Data, problemStatsData, tagRatingsData, bojStatsData] =
          await Promise.all([
            getUserTop100(handle).catch((err) => {
              console.error('Error fetching top 100:', err);
              return null;
            }),
            getUserProblemStats(handle).catch((err) => {
              console.error('Error fetching problem stats:', err);
              return null;
            }),
            getUserTagRatings(handle).catch((err) => {
              console.error('Error fetching tag ratings:', err);
              return null;
            }),
            scrapeUserStats(handle).catch((err) => {
              console.error('Error scraping BOJ stats:', err);
              return null;
            }),
          ]);

        setTop100(top100Data);
        setProblemStats(problemStatsData);
        setTagRatings(tagRatingsData);
        setBojStats(bojStatsData);

        // 로컬 문제 수 계산 (fetchLocalCount가 true일 때만)
        if (fetchLocalCount) {
          const projectRoot = findProjectRoot();
          if (projectRoot) {
            const archiveDir = getArchiveDir();
            const solvingDir = getSolvingDir();

            const archivePath = join(projectRoot, archiveDir);
            const solvingPath = join(projectRoot, solvingDir);

            const [archiveCount, solvingCount] = await Promise.all([
              countProblems(archivePath),
              countProblems(solvingPath),
            ]);

            setLocalSolvedCount(archiveCount + solvingCount);
          }
        }

        setStatus('success');
        setTimeout(() => {
          onComplete();
        }, 5000);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
        setTimeout(() => {
          onComplete();
        }, 3000);
      }
    }

    void fetchData();
  }, [fetchLocalCount, handle, onComplete]);

  return {
    status,
    user,
    top100,
    problemStats,
    tagRatings,
    bojStats,
    localSolvedCount,
    error,
  };
}
