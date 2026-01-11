import { useEffect, useState } from 'react';

import { getUserStats } from '../services/solved-api';
import type { SolvedAcUser } from '../types';

export interface UseUserStatsParams {
  handle: string;
  onComplete: () => void;
}

export interface UseUserStatsReturn {
  status: 'loading' | 'success' | 'error';
  user: SolvedAcUser | null;
  error: string | null;
}

export function useUserStats({
  handle,
  onComplete,
}: UseUserStatsParams): UseUserStatsReturn {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [user, setUser] = useState<SolvedAcUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getUserStats(handle)
      .then((userData) => {
        setUser(userData);
        setStatus('success');
        setTimeout(() => {
          onComplete();
        }, 5000);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
        setTimeout(() => {
          onComplete();
        }, 3000);
      });
  }, [handle, onComplete]);

  return {
    status,
    user,
    error,
  };
}
