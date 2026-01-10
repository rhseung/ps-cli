import { useEffect, useState } from "react";

import { openBrowser } from "../utils/browser";

const BOJ_BASE_URL = "https://www.acmicpc.net";

export interface UseOpenBrowserParams {
  problemId: number;
  onComplete?: () => void;
}

export interface UseOpenBrowserReturn {
  status: "loading" | "success" | "error";
  error: string | null;
  url: string;
}

export function useOpenBrowser({
  problemId,
  onComplete,
}: UseOpenBrowserParams): UseOpenBrowserReturn {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    async function handleOpenBrowser() {
      try {
        const problemUrl = `${BOJ_BASE_URL}/problem/${problemId}`;
        setUrl(problemUrl);

        // 브라우저 열기
        await openBrowser(problemUrl);

        setStatus("success");
        setTimeout(() => {
          onComplete?.();
        }, 1500);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
        setTimeout(() => {
          onComplete?.();
        }, 2000);
      }
    }

    void handleOpenBrowser();
  }, [problemId, onComplete]);

  return {
    status,
    error,
    url,
  };
}
