import { useEffect, useState } from "react";

import { runSolution } from "../services/runner";
import type { Language } from "../utils/language";

export interface UseRunSolutionParams {
  problemDir: string;
  language: Language;
  inputFile: string;
  onComplete: () => void;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

export interface UseRunSolutionReturn {
  status: "loading" | "ready" | "error";
  result: RunResult | null;
  error: string | null;
}

export function useRunSolution({
  problemDir,
  language,
  inputFile,
  onComplete,
}: UseRunSolutionParams): UseRunSolutionReturn {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void runSolution({
      problemDir,
      language,
      inputPath: inputFile,
      timeoutMs: 10000, // 10초 타임아웃
    })
      .then((runResult) => {
        setResult(runResult);
        setStatus("ready");
        setTimeout(() => {
          onComplete();
        }, 100);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
        setTimeout(() => {
          onComplete();
        }, 2000);
      });
  }, [problemDir, language, inputFile, onComplete]);

  return {
    status,
    result,
    error,
  };
}
