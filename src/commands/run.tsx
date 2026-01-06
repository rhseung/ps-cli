import React, { useEffect, useState } from "react";
import { render, Box, Text } from "ink";
import { readdir } from "fs/promises";
import { join } from "path";
import {
  detectLanguageFromFile,
  getSupportedLanguages,
  getSupportedLanguagesString,
  type Language,
} from "../utils/language";
import { runSolution } from "../services/runner";
import { LoadingSpinner } from "../components/spinner";
import type { CommandDefinition } from "../types/command";
import { getProblemId, detectProblemIdFromPath } from "../utils/problem-id";

interface RunCommandProps {
  problemDir: string;
  language: Language;
  inputFile: string;
  onComplete: () => void;
}

function RunCommand({
  problemDir,
  language,
  inputFile,
  onComplete,
}: RunCommandProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [result, setResult] = useState<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
    durationMs: number;
  } | null>(null);
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

  if (status === "loading") {
    return (
      <Box flexDirection="column">
        <Text>코드 실행 중...</Text>
        <LoadingSpinner />
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ 실행 실패</Text>
        {error && <Text color="gray">{error}</Text>}
      </Box>
    );
  }

  if (result) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            실행 결과
          </Text>
          <Text color="gray">
            {problemDir} • {language}
            {result.timedOut && " • 타임아웃"}
          </Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          {result.timedOut ? (
            <Text color="yellow">⏱ 실행 시간이 초과되었습니다.</Text>
          ) : result.exitCode !== 0 ? (
            <Text color="red">
              ✗ 프로그램이 비정상 종료되었습니다 (exit code: {result.exitCode})
            </Text>
          ) : (
            <Text color="green">✓ 실행 완료</Text>
          )}
          {result.stdout && (
            <Box marginTop={1} flexDirection="column">
              <Text color="gray" dimColor>
                출력:
              </Text>
              <Text>{result.stdout}</Text>
            </Box>
          )}
          {result.stderr && (
            <Box marginTop={1} flexDirection="column">
              <Text color="yellow" dimColor>
                에러 출력:
              </Text>
              <Text color="yellow">{result.stderr}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="gray">실행 시간: {result.durationMs}ms</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return null;
}

async function findInputFile(problemDir: string): Promise<string> {
  const files = await readdir(problemDir);
  // input1.txt, input.txt 순서로 찾기
  const inputFile =
    files.find((f) => f === "input1.txt") ||
    files.find((f) => f === "input.txt");
  if (!inputFile) {
    throw new Error("input.txt 또는 input1.txt 파일을 찾을 수 없습니다.");
  }
  return join(problemDir, inputFile);
}

async function runCommand(
  problemId: number | null,
  language?: Language,
  inputFile?: string
) {
  // 문제 디렉토리 결정
  const currentPathProblemId = detectProblemIdFromPath(process.cwd());
  const problemDir =
    problemId && currentPathProblemId !== problemId
      ? join(process.cwd(), "problems", String(problemId))
      : process.cwd();

  // 입력 파일 찾기
  const inputPath = inputFile
    ? join(problemDir, inputFile)
    : await findInputFile(problemDir);

  // 언어 감지
  const files = await readdir(problemDir);
  const solutionFile = files.find((f) => f.startsWith("solution."));
  if (!solutionFile) {
    throw new Error("solution.* 파일을 찾을 수 없습니다.");
  }
  const detectedLanguage = language ?? detectLanguageFromFile(solutionFile);
  if (!detectedLanguage) {
    throw new Error(`지원하지 않는 언어입니다: ${solutionFile}`);
  }

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <RunCommand
        problemDir={problemDir}
        language={detectedLanguage}
        inputFile={inputPath}
        onComplete={() => {
          unmount();
          resolve();
        }}
      />
    );
  });
}

export const runHelp = `
  사용법:
    $ ps run [문제번호] [옵션]

  설명:
    코드를 실행합니다 (테스트 없이).
    - 현재 디렉토리 또는 지정한 문제 번호의 코드 실행
    - solution.* 파일을 자동으로 찾아 언어 감지
    - input.txt 또는 input1.txt를 표준 입력으로 사용
    - 테스트 케이스 검증 없이 단순 실행

  옵션:
    --language, -l      언어 선택 (지정 시 자동 감지 무시)
                        지원 언어: ${getSupportedLanguagesString()}
    --input, -i         입력 파일 지정 (기본값: input.txt 또는 input1.txt)

  예제:
    $ ps run                    # 현재 디렉토리에서 실행
    $ ps run 1000               # 1000번 문제 실행
    $ ps run --language python  # Python으로 실행
    $ ps run --input input2.txt # 특정 입력 파일 사용
`;

export async function runExecute(
  args: string[],
  flags: {
    language?: string;
    input?: string;
    help?: boolean;
  }
): Promise<void> {
  if (flags.help) {
    console.log(runHelp.trim());
    process.exit(0);
    return;
  }

  const problemId = getProblemId(args);

  const validLanguages = getSupportedLanguages();

  const language = flags.language as Language | undefined;
  if (flags.language && language && !validLanguages.includes(language)) {
    console.error(
      `오류: 지원하지 않는 언어입니다. (${getSupportedLanguagesString()})`
    );
    process.exit(1);
  }

  await runCommand(problemId, language, flags.input);
}

const runCommandDef: CommandDefinition = {
  name: "run",
  help: runHelp,
  execute: runExecute,
};

export default runCommandDef;
