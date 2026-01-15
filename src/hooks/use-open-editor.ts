import { useEffect, useState } from 'react';

import { openEditor } from '../utils/editor';

export interface UseOpenEditorParams {
  path?: string;
  onComplete?: () => void;
}

export interface UseOpenEditorReturn {
  status: 'loading' | 'success' | 'error';
  error: string | null;
}

export function useOpenEditor({
  path,
  onComplete,
}: UseOpenEditorParams): UseOpenEditorReturn {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleOpenEditor() {
      if (!path) {
        setStatus('error');
        setError('경로가 지정되지 않았습니다.');
        onComplete?.();
        return;
      }

      try {
        await openEditor(path);
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

    void handleOpenEditor();
  }, [path, onComplete]);

  return {
    status,
    error,
  };
}
