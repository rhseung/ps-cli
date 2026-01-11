import { readFile } from 'fs/promises';

import { useEffect, useState } from 'react';

import { openBrowser } from '../utils/browser';
import { copyToClipboard } from '../utils/clipboard';
import type { Language } from '../utils/language';

const BOJ_BASE_URL = 'https://www.acmicpc.net';

export interface UseSubmitParams {
  problemId: number;
  language: Language;
  sourcePath: string;
  onComplete: () => void;
}

export interface UseSubmitReturn {
  status: 'loading' | 'success' | 'error';
  message: string;
  error: string | null;
  submitUrl: string;
  clipboardSuccess: boolean;
  clipboardError: string | null;
}

export function useSubmit({
  problemId,
  language: _language,
  sourcePath,
  onComplete,
}: UseSubmitParams): UseSubmitReturn {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('제출 준비 중...');
  const [error, setError] = useState<string | null>(null);
  const [submitUrl, setSubmitUrl] = useState<string>('');
  const [clipboardSuccess, setClipboardSuccess] = useState<boolean>(false);
  const [clipboardError, setClipboardError] = useState<string | null>(null);

  useEffect(() => {
    async function submit() {
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

        // 제출 URL 생성
        const url = `${BOJ_BASE_URL}/submit/${problemId}`;
        setSubmitUrl(url);

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

    void submit();
  }, [problemId, sourcePath, onComplete]);

  return {
    status,
    message,
    error,
    submitUrl,
    clipboardSuccess,
    clipboardError,
  };
}
