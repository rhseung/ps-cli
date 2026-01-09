import React, { useEffect, useState } from "react";
import { render, Box, Text } from "ink";
import { Alert } from "@inkjs/ui";
import chokidar from "chokidar";
import { readdir } from "fs/promises";
import { join } from "path";
import {
  detectLanguageFromFile,
  getSupportedLanguages,
  getSupportedLanguagesString,
  type Language,
} from "../utils/language";
import { runAllTests } from "../services/test-runner";
import { Spinner } from "@inkjs/ui";
import { TestResultView } from "../components/test-result";
import type { TestResult, TestSummary } from "../types";
import type { CommandDefinition } from "../types/command";
import {
  getProblemId,
  detectProblemIdFromPath,
  getProblemDirPath,
} from "../utils/problem-id";

interface TestCommandOptions {
  id?: number;
  watch?: boolean;
  timeoutMs?: number;
  language?: Language;
}

interface TestCommandProps {
  problemDir: string;
  language: Language;
  watch: boolean;
  timeoutMs?: number;
  onComplete: () => void;
}

type Status = "loading" | "ready" | "error";

function TestCommand({
  problemDir,
  language,
  watch,
  timeoutMs,
  onComplete,
}: TestCommandProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary>({
    total: 0,
    passed: 0,
    failed: 0,
    errored: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const runTests = (isWatchTrigger = false) => {
    // watch 모드에서 파일 변경으로 트리거된 경우 화면 클리어
    if (isWatchTrigger && watch) {
      console.clear();
    }
    setStatus("loading");
    void runAllTests({
      problemDir,
      language,
      timeoutMs,
    })
      .then(({ results, summary }) => {
        setResults(results);
        setSummary(summary);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
  };

  useEffect(() => {
    void runTests();

    if (watch) {
      const watcher = chokidar.watch(
        [
          join(problemDir, "solution.*"),
          join(problemDir, "input*.txt"),
          join(problemDir, "output*.txt"),
        ],
        {
          ignoreInitial: true,
        }
      );

      watcher.on("change", () => {
        runTests(true);
      });

      return () => {
        void watcher.close();
      };
    }

    return undefined;
  }, [problemDir, language, watch]);

  useEffect(() => {
    if (!watch && status === "ready") {
      const timer = setTimeout(() => onComplete(), 200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, watch, onComplete]);

  if (status === "loading") {
    return (
      <Box flexDirection="column">
        <Spinner label="테스트 실행 중..." />
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box flexDirection="column">
        <Alert variant="error">
          테스트 실행 실패{error ? `: ${error}` : ""}
        </Alert>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          테스트 실행 중
        </Text>
        <Text> </Text>
        <Text color="gray">
          {problemDir} • {language}
          {watch && " • watch"}
        </Text>
      </Box>
      <TestResultView results={results} summary={summary} />
    </Box>
  );
}

async function detectLanguage(problemDir: string): Promise<Language> {
  const files = await readdir(problemDir);
  const solutionFile = files.find((f) => f.startsWith("solution."));
  if (!solutionFile) {
    throw new Error("solution.* 파일을 찾을 수 없습니다.");
  }
  const lang = detectLanguageFromFile(solutionFile);
  if (!lang) {
    throw new Error(`지원하지 않는 언어입니다: ${solutionFile}`);
  }
  return lang;
}

async function testCommand(options: TestCommandOptions = {}) {
  // 현재 경로에서 문제 번호 추론
  const currentPathProblemId = detectProblemIdFromPath(process.cwd());

  // options.id가 있고, 현재 경로가 이미 해당 문제 디렉토리가 아닌 경우에만 경로 구성
  const problemDir =
    options.id && currentPathProblemId !== options.id
      ? getProblemDirPath(options.id)
      : process.cwd();

  const language = options.language ?? (await detectLanguage(problemDir));

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <TestCommand
        problemDir={problemDir}
        language={language}
        watch={Boolean(options.watch)}
        timeoutMs={options.timeoutMs}
        onComplete={() => {
          unmount();
          resolve();
        }}
      />
    );
  });
}

export const testHelp = `
  사용법:
    $ ps test [문제번호] [옵션]

  설명:
    예제 입출력 기반으로 로컬 테스트를 실행합니다.
    - 현재 디렉토리 또는 지정한 문제 번호의 테스트 실행
    - solution.* 파일을 자동으로 찾아 언어 감지
    - input*.txt와 output*.txt 파일을 기반으로 테스트
    - 문제의 시간 제한을 자동으로 적용
    - --watch 옵션으로 파일 변경 시 자동 재테스트

  옵션:
    --language, -l      언어 선택 (지정 시 자동 감지 무시)
                        지원 언어: ${getSupportedLanguagesString()}
    --watch, -w         watch 모드 (파일 변경 시 자동 재테스트)
                        solution.*, input*.txt, output*.txt 파일 변경 감지

  예제:
    $ ps test                    # 현재 디렉토리에서 테스트
    $ ps test 1000               # 1000번 문제 테스트
    $ ps test --watch            # watch 모드로 테스트
    $ ps test 1000 --watch       # 1000번 문제를 watch 모드로 테스트
`;

export async function testExecute(
  args: string[],
  flags: { language?: string; watch?: boolean; help?: boolean }
): Promise<void> {
  if (flags.help) {
    console.log(testHelp.trim());
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

  await testCommand({
    id: problemId ?? undefined,
    language: language ?? undefined,
    watch: Boolean(flags.watch),
  });
}

const testCommandDef: CommandDefinition = {
  name: "test",
  help: testHelp,
  execute: testExecute,
};

export default testCommandDef;
