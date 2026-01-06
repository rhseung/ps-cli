import React, { useState, useEffect } from "react";
import { render, Text, Box } from "ink";
import { readdir } from "fs/promises";
import { join } from "path";
import { readFile } from "fs/promises";
import { getProblemId, detectProblemIdFromPath } from "../utils/problem-id";
import {
  detectLanguageFromFile,
  getSupportedLanguages,
  getSupportedLanguagesString,
  type Language,
} from "../utils/language";
import { submitSolution } from "../services/submitter";
import { LoadingSpinner } from "../components/spinner";
import type { SubmitResult } from "../types";

interface SubmitCommandProps {
  problemId: number;
  language: Language;
  sourcePath: string;
  dryRun: boolean;
  onComplete: () => void;
}

function SubmitCommand({
  problemId,
  language,
  sourcePath,
  dryRun,
  onComplete,
}: SubmitCommandProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("제출 준비 중...");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function submit() {
      try {
        setMessage("코드를 읽는 중...");
        const sourceCode = await readFile(sourcePath, "utf-8");

        if (dryRun) {
          setMessage("[DRY RUN] 제출 검증 중...");
        } else {
          setMessage("BOJ에 제출하는 중...");
        }

        const submitResult = await submitSolution({
          problemId,
          language,
          sourceCode,
          dryRun,
        });

        setResult(submitResult);
        setStatus("success");
        setMessage("제출 완료");
        setTimeout(() => {
          onComplete();
        }, 3000);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
        setTimeout(() => {
          onComplete();
        }, 3000);
      }
    }

    submit();
  }, [problemId, language, sourcePath, dryRun, onComplete]);

  if (status === "loading") {
    return (
      <Box flexDirection="column">
        <LoadingSpinner message={message} />
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ 제출 실패: {error}</Text>
      </Box>
    );
  }

  if (result) {
    const statusColor =
      result.status === "AC"
        ? "green"
        : result.status === "WA" ||
          result.status === "CE" ||
          result.status === "RE"
        ? "red"
        : result.status === "TLE" || result.status === "MLE"
        ? "yellow"
        : "cyan";

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            제출 결과
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text>
            문제: <Text bold>{result.problemId}</Text>
          </Text>
          <Text>
            언어: <Text bold>{result.language}</Text>
          </Text>
          <Text>
            상태:{" "}
            <Text color={statusColor} bold>
              {result.status}
            </Text>
          </Text>
          {result.time !== null && result.time !== undefined && (
            <Text>
              시간: <Text bold>{result.time}ms</Text>
            </Text>
          )}
          {result.memory !== null && result.memory !== undefined && (
            <Text>
              메모리: <Text bold>{result.memory}KB</Text>
            </Text>
          )}
          {result.message && (
            <Box marginTop={1}>
              <Text color="gray">{result.message}</Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  return null;
}

async function detectSolutionFile(problemDir: string): Promise<string> {
  const files = await readdir(problemDir);
  const solutionFile = files.find((f) => f.startsWith("solution."));
  if (!solutionFile) {
    throw new Error("solution.* 파일을 찾을 수 없습니다.");
  }
  return join(problemDir, solutionFile);
}

async function submitCommand(
  problemId: number,
  language?: Language,
  dryRun: boolean = false
) {
  // 현재 경로에서 문제 번호 추론
  const currentPathProblemId = detectProblemIdFromPath(process.cwd());

  // 현재 경로가 이미 해당 문제 디렉토리인 경우 그대로 사용, 아니면 경로 구성
  const problemDir =
    currentPathProblemId === problemId
      ? process.cwd()
      : join(process.cwd(), "problems", String(problemId));

  // 솔루션 파일 찾기
  const sourcePath = await detectSolutionFile(problemDir);

  // 언어 감지
  const detectedLanguage = language ?? detectLanguageFromFile(sourcePath);
  if (!detectedLanguage) {
    throw new Error(`지원하지 않는 언어입니다: ${sourcePath}`);
  }

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <SubmitCommand
        problemId={problemId}
        language={detectedLanguage}
        sourcePath={sourcePath}
        dryRun={dryRun}
        onComplete={() => {
          unmount();
          resolve();
        }}
      />
    );
  });
}

export const submitHelp = `
  사용법:
    $ ps submit [문제번호] [옵션]

  설명:
    현재 문제의 솔루션 파일을 BOJ에 제출합니다.
    - 현재 디렉토리 또는 지정한 문제 번호의 솔루션 파일 제출
    - solution.* 파일을 자동으로 찾아 언어 감지
    - 제출 후 채점 결과를 자동으로 확인

  옵션:
    --language, -l      언어 선택 (지정 시 자동 감지 무시)
                        지원 언어: ${getSupportedLanguagesString()}
    --dry-run          실제 제출 없이 검증만 수행

  예제:
    $ ps submit                    # 현재 디렉토리에서 제출
    $ ps submit 1000                # 1000번 문제 제출
    $ ps submit --language python   # Python으로 제출
`;

export async function submitExecute(
  args: string[],
  flags: { language?: string; "dry-run"?: boolean; help?: boolean }
): Promise<void> {
  if (flags.help) {
    console.log(submitHelp.trim());
    process.exit(0);
    return;
  }

  const problemId = getProblemId(args);

  if (problemId === null) {
    console.error("오류: 문제 번호를 입력해주세요.");
    console.error(`사용법: ps submit [문제번호] [옵션]`);
    console.error(`도움말: ps submit --help`);
    console.error(
      `힌트: problems/{문제번호} 디렉토리에서 실행하면 자동으로 문제 번호를 추론합니다.`
    );
    process.exit(1);
  }

  const validLanguages = getSupportedLanguages();

  const language = flags.language as Language | undefined;
  if (flags.language && language && !validLanguages.includes(language)) {
    console.error(
      `오류: 지원하지 않는 언어입니다. (${getSupportedLanguagesString()})`
    );
    process.exit(1);
  }

  await submitCommand(problemId, language, Boolean(flags["dry-run"]));
}
