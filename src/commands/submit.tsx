import React, { useState, useEffect } from "react";
import { render, Text, Box } from "ink";
import { Badge, StatusMessage, Alert } from "@inkjs/ui";
import { readdir } from "fs/promises";
import { join } from "path";
import { readFile } from "fs/promises";
import {
  getProblemId,
  detectProblemIdFromPath,
  getProblemDirPath,
} from "../utils/problem-id";
import {
  detectLanguageFromFile,
  getSupportedLanguages,
  getSupportedLanguagesString,
  type Language,
} from "../utils/language";
import { Spinner } from "@inkjs/ui";
import type { CommandDefinition } from "../types/command";
import { execaCommand } from "execa";
import { copyToClipboard } from "../utils/clipboard";

const BOJ_BASE_URL = "https://www.acmicpc.net";

interface SubmitCommandProps {
  problemId: number;
  language: Language;
  sourcePath: string;
  onComplete: () => void;
}

function SubmitCommand({
  problemId,
  language,
  sourcePath,
  onComplete,
}: SubmitCommandProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("제출 준비 중...");
  const [error, setError] = useState<string | null>(null);
  const [submitUrl, setSubmitUrl] = useState<string>("");
  const [clipboardSuccess, setClipboardSuccess] = useState<boolean>(false);
  const [clipboardError, setClipboardError] = useState<string | null>(null);

  useEffect(() => {
    async function submit() {
      try {
        // 소스 코드 읽기
        setMessage("소스 코드를 읽는 중...");
        const sourceCode = await readFile(sourcePath, "utf-8");

        // 클립보드에 복사
        setMessage("클립보드에 복사하는 중...");
        const clipboardResult = await copyToClipboard(sourceCode);
        setClipboardSuccess(clipboardResult);
        if (!clipboardResult) {
          setClipboardError("클립보드 복사에 실패했습니다.");
        }

        // 제출 URL 생성
        const url = `${BOJ_BASE_URL}/submit/${problemId}`;
        setSubmitUrl(url);

        // 브라우저 열기
        setMessage("브라우저를 여는 중...");
        let command: string;
        if (process.platform === "win32") {
          command = `start "" "${url}"`;
        } else if (process.platform === "darwin") {
          command = `open "${url}"`;
        } else {
          // Linux 및 기타 Unix 계열
          command = `xdg-open "${url}"`;
        }

        await execaCommand(command, {
          shell: true,
          detached: true,
          stdio: "ignore",
        });

        setStatus("success");
        setTimeout(() => {
          onComplete();
        }, 2000);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    }

    submit();
  }, [problemId, language, sourcePath, onComplete]);

  if (status === "loading") {
    return (
      <Box flexDirection="column">
        <Spinner label={message} />
        <Box marginTop={1}>
          <Text color="gray">문제 #{problemId}</Text>
        </Box>
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box flexDirection="column">
        <Alert variant="error">오류 발생: {error}</Alert>
        {submitUrl && (
          <Box marginTop={1}>
            <Text color="gray">URL: {submitUrl}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      <StatusMessage variant="success">제출 페이지를 열었습니다!</StatusMessage>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="gray"
        marginTop={1}
        paddingX={1}
        paddingY={0}
        alignSelf="flex-start"
      >
        <Text>
          <Text color="cyan" bold>
            문제 번호:
          </Text>{" "}
          {problemId}
        </Text>
        <Text>
          <Text color="cyan" bold>
            언어:
          </Text>{" "}
          <Text color="gray">{language}</Text>
        </Text>
        <Text>
          <Text color="cyan" bold>
            URL:
          </Text>{" "}
          <Text color="blue" underline>
            {submitUrl}
          </Text>
        </Text>
        <Box marginTop={1}>
          {clipboardSuccess ? (
            <Badge color="green">클립보드에 복사됨</Badge>
          ) : (
            <Badge color="yellow">클립보드 복사 실패</Badge>
          )}
        </Box>
        {clipboardError && !clipboardSuccess && (
          <Box marginTop={1}>
            <Alert variant="warning">{clipboardError}</Alert>
          </Box>
        )}
      </Box>
    </Box>
  );
}

async function detectSolutionFile(problemDir: string): Promise<string> {
  const files = await readdir(problemDir);
  const solutionFile = files.find((f) => f.startsWith("solution."));
  if (!solutionFile) {
    throw new Error("solution.* 파일을 찾을 수 없습니다.");
  }
  return join(problemDir, solutionFile);
}

async function submitCommand(problemId: number | null, language?: Language) {
  // 현재 경로에서 문제 번호 추론
  const currentPathProblemId = detectProblemIdFromPath(process.cwd());

  // problemId가 있고, 현재 경로가 이미 해당 문제 디렉토리가 아닌 경우에만 경로 구성
  const problemDir =
    problemId && currentPathProblemId !== problemId
      ? getProblemDirPath(problemId)
      : process.cwd();

  // 솔루션 파일 찾기
  const sourcePath = await detectSolutionFile(problemDir);

  // 언어 감지
  const detectedLanguage = language ?? detectLanguageFromFile(sourcePath);
  if (!detectedLanguage) {
    throw new Error(`지원하지 않는 언어입니다: ${sourcePath}`);
  }

  // 문제 번호 결정: problemId가 있으면 사용, 없으면 경로에서 추론
  // 먼저 detectProblemIdFromPath로 시도하고, 실패하면 problemDir의 마지막 세그먼트 확인
  let finalProblemId = problemId ?? detectProblemIdFromPath(problemDir);

  // detectProblemIdFromPath가 실패한 경우, problemDir의 마지막 세그먼트가 숫자인지 확인
  if (finalProblemId === null) {
    const segments = problemDir.split(/[/\\]/).filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment) {
      const parsedId = parseInt(lastSegment, 10);
      if (
        !isNaN(parsedId) &&
        parsedId > 0 &&
        lastSegment === parsedId.toString()
      ) {
        finalProblemId = parsedId;
      }
    }
  }

  if (finalProblemId === null) {
    throw new Error(
      "문제 번호를 찾을 수 없습니다. 문제 번호를 인자로 전달하거나 문제 디렉토리에서 실행해주세요."
    );
  }

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <SubmitCommand
        problemId={finalProblemId}
        language={detectedLanguage}
        sourcePath={sourcePath}
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
    백준 제출 페이지를 브라우저로 열고 소스 코드를 클립보드에 복사합니다.
    - 문제 번호를 인자로 전달하거나 문제 디렉토리에서 실행하면 자동으로 문제 번호를 추론
    - solution.* 파일을 자동으로 찾아 언어 감지
    - 소스 코드를 클립보드에 자동 복사
    - 제출 페이지를 브라우저로 자동 열기

  옵션:
    --language, -l      언어 선택 (지정 시 자동 감지 무시)
                        지원 언어: ${getSupportedLanguagesString()}

  예제:
    $ ps submit                    # 현재 디렉토리에서 제출
    $ ps submit 1000                # 1000번 문제 제출
    $ ps submit --language python   # Python으로 제출
`;

export async function submitExecute(
  args: string[],
  flags: { language?: string; help?: boolean }
): Promise<void> {
  if (flags.help) {
    console.log(submitHelp.trim());
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

  await submitCommand(problemId, language);
}

const submitCommandDef: CommandDefinition = {
  name: "submit",
  help: submitHelp,
  execute: submitExecute,
};

export default submitCommandDef;
