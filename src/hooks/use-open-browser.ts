import { useEffect, useState } from 'react';

import { openBrowser } from '../utils/browser';

const BOJ_BASE_URL = 'https://www.acmicpc.net';

export interface UseOpenBrowserParams {
  problemId?: number;
  workbookId?: number;
  onComplete?: () => void;
}

export interface UseOpenBrowserReturn {
  status: 'loading' | 'success' | 'error';
  error: string | null;
  url: string;
}

export function useOpenBrowser({
  problemId,
  workbookId,
  onComplete,
}: UseOpenBrowserParams): UseOpenBrowserReturn {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    async function handleOpenBrowser() {
      try {
        let targetUrl: string;
        if (workbookId !== undefined) {
          targetUrl = `${BOJ_BASE_URL}/workbook/view/${workbookId}`;
        } else if (problemId !== undefined) {
          targetUrl = `${BOJ_BASE_URL}/problem/${problemId}`;
        } else {
          throw new Error('문제 번호 또는 문제집 ID가 필요합니다.');
        }

        setUrl(targetUrl);

        // 브라우저 열기
        await openBrowser(targetUrl);

        setStatus('success');
        setTimeout(() => {
          onComplete?.();
        }, 1500);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
        setTimeout(() => {
          onComplete?.();
        }, 2000);
      }
    }

    void handleOpenBrowser();
  }, [problemId, workbookId, onComplete]);

  return {
    status,
    error,
    url,
  };
}
