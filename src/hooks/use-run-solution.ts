import { useEffect, useState } from 'react';

import { getProblemTimeLimitMs, type Language } from '../core';
import { runSolution } from '../services/runner';

export interface UseRunSolutionParams {
  problemDir: string;
  language: Language;
  inputFile?: string;
  onComplete: () => void;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  input?: string;
}

export interface UseRunSolutionReturn {
  status: 'loading' | 'ready' | 'error';
  result: RunResult | null;
  error: string | null;
}

export function useRunSolution({
  problemDir,
  language,
  inputFile,
  onComplete,
}: UseRunSolutionParams): UseRunSolutionReturn {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      // 문제의 시간 제한을 가져와서 5배 적용 (기본값 2초 * 5 = 10초)
      const timeLimitMs = await getProblemTimeLimitMs(problemDir);
      const effectiveTimeout = timeLimitMs ? timeLimitMs * 5 : 10000;

      try {
        const runResult = await runSolution({
          problemDir,
          language,
          inputPath: inputFile,
          timeoutMs: effectiveTimeout,
        });
        setResult(runResult);
        setStatus('ready');
        setTimeout(() => {
          onComplete();
        }, 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    }

    void run();
  }, [problemDir, language, inputFile, onComplete]);

  return {
    status,
    result,
    error,
  };
}
