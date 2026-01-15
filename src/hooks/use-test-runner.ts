import { join } from 'path';

import chokidar from 'chokidar';
import { useEffect, useState, useCallback } from 'react';

import type { Language } from '../core';
import { runAllTests } from '../services/test-runner';
import type { TestResult, TestSummary } from '../types';

type Status = 'loading' | 'ready' | 'error';

export interface UseTestRunnerParams {
  problemDir: string;
  language: Language;
  watch: boolean;
  timeoutMs?: number;
  onComplete: () => void;
}

export interface UseTestRunnerReturn {
  status: Status;
  results: TestResult[];
  summary: TestSummary;
  error: string | null;
}

export function useTestRunner({
  problemDir,
  language,
  watch,
  timeoutMs,
  onComplete,
}: UseTestRunnerParams): UseTestRunnerReturn {
  const [status, setStatus] = useState<Status>('loading');
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary>({
    total: 0,
    passed: 0,
    failed: 0,
    errored: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const runTests = useCallback(
    (isWatchTrigger = false) => {
      // watch 모드에서 파일 변경으로 트리거된 경우 화면 클리어
      if (isWatchTrigger && watch) {
        console.clear();
      }
      setStatus('loading');
      void runAllTests({
        problemDir,
        language,
        timeoutMs,
      })
        .then(({ results, summary }) => {
          setResults(results);
          setSummary(summary);
          setStatus('ready');
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setStatus('error');
        });
    },
    [problemDir, language, timeoutMs, watch],
  );

  // 초기 테스트 실행
  useEffect(() => {
    const timer = setTimeout(() => {
      void runTests();
    }, 0);
    return () => clearTimeout(timer);
  }, [runTests]);

  // Watch 모드 설정
  useEffect(() => {
    if (!watch) {
      return undefined;
    }

    const watcher = chokidar.watch(
      [
        join(problemDir, 'solution.*'),
        join(problemDir, 'testcases', '**', '*.txt'),
      ],
      {
        ignoreInitial: true,
      },
    );

    watcher.on('change', () => {
      runTests(true);
    });

    return () => {
      void watcher.close();
    };
  }, [problemDir, watch, runTests]);

  useEffect(() => {
    if (!watch && status === 'ready') {
      const timer = setTimeout(() => onComplete(), 200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, watch, onComplete]);

  return {
    status,
    results,
    summary,
    error,
  };
}
