import { useEffect, useState } from 'react';
import { join } from 'path';
import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';

import { getUserStats, getUserTop100 } from '../services/solved-api';
import type { SolvedAcUser, SolvedAcProblem } from '../types';
import { findProjectRoot, getArchiveDir, getSolvingDir } from '../utils/config';

export interface UseUserStatsParams {
  handle: string;
  onComplete: () => void;
  fetchLocalCount?: boolean;
}

export interface UseUserStatsReturn {
  status: 'loading' | 'success' | 'error';
  user: SolvedAcUser | null;
  top100: SolvedAcProblem[] | null;
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
  const [localSolvedCount, setLocalSolvedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userData, top100Data] = await Promise.all([
          getUserStats(handle),
          getUserTop100(handle),
        ]);

        setUser(userData);
        setTop100(top100Data);

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
  }, [handle, onComplete]);

  return {
    status,
    user,
    top100,
    localSolvedCount,
    error,
  };
}
