import { readFile } from 'fs/promises';

import { useEffect, useState } from 'react';

import { openBrowser } from '../utils/browser';
import { copyToClipboard } from '../utils/clipboard';

const TESTCASE_AC_BASE_URL = 'https://testcase.ac';

export interface UseTestcaseAcParams {
  problemId: number;
  sourcePath: string;
  onComplete: () => void;
}

export interface UseTestcaseAcReturn {
  status: 'loading' | 'success' | 'error';
  message: string;
  error: string | null;
  url: string;
  clipboardSuccess: boolean;
  clipboardError: string | null;
}

export function useTestcaseAc({
  problemId,
  sourcePath,
  onComplete,
}: UseTestcaseAcParams): UseTestcaseAcReturn {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('testcase.ac 준비 중...');
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string>('');
  const [clipboardSuccess, setClipboardSuccess] = useState<boolean>(false);
  const [clipboardError, setClipboardError] = useState<string | null>(null);

  useEffect(() => {
    async function open() {
      try {
        // 소스 코드 읽기
        setMessage('소스 코드를 읽는 중...');
        const sourceCode = await readFile(sourcePath, 'utf-8');

        // 클립보드에 복사
        setMessage('클립보드에 복사하는 중...');
        const clipboardResult = await copyToClipboard(sourceCode);
        setClipboardSuccess(clipboardResult);
        if (!clipboardResult) {
          setClipboardError('클립보드 복사에 실패했습니다.');
        }

        // testcase.ac URL 생성
        const url = `${TESTCASE_AC_BASE_URL}/problems/${problemId}`;
        setUrl(url);

        // 브라우저 열기
        setMessage('브라우저를 여는 중...');
        await openBrowser(url);

        setStatus('success');
        setTimeout(() => {
          onComplete();
        }, 2000);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    }

    void open();
  }, [problemId, sourcePath, onComplete]);

  return {
    status,
    message,
    error,
    url,
    clipboardSuccess,
    clipboardError,
  };
}
