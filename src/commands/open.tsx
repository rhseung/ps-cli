import React, { useState, useEffect } from "react";
import { render, Text, Box } from "ink";
import { StatusMessage, Alert } from "@inkjs/ui";
import { Spinner } from "@inkjs/ui";
import type { CommandDefinition } from "../types/command";
import { getProblemId } from "../utils/problem-id";
import { execaCommand } from "execa";

const BOJ_BASE_URL = "https://www.acmicpc.net";

interface OpenCommandProps {
  problemId: number;
  onComplete?: () => void;
}

function OpenCommand({ problemId, onComplete }: OpenCommandProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    async function openBrowser() {
      try {
        const problemUrl = `${BOJ_BASE_URL}/problem/${problemId}`;
        setUrl(problemUrl);

        // 플랫폼별 브라우저 열기 명령어 결정
        let command: string;
        if (process.platform === "win32") {
          command = `start "" "${problemUrl}"`;
        } else if (process.platform === "darwin") {
          command = `open "${problemUrl}"`;
        } else {
          // Linux 및 기타 Unix 계열
          command = `xdg-open "${problemUrl}"`;
        }

        // 브라우저 열기
        await execaCommand(command, {
          shell: true,
          detached: true,
          stdio: "ignore",
        });

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

    openBrowser();
  }, [problemId, onComplete]);

  if (status === "loading") {
    return (
      <Box flexDirection="column">
        <Spinner label="브라우저를 여는 중..." />
        <Box marginTop={1}>
          <Text color="gray">문제 #{problemId}</Text>
        </Box>
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box flexDirection="column">
        <Alert variant="error">브라우저를 열 수 없습니다: {error}</Alert>
        <Box marginTop={1}>
          <Text color="gray">URL: {url}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      <StatusMessage variant="success">
        브라우저에서 문제 페이지를 열었습니다!
      </StatusMessage>
      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text color="cyan" bold>
            문제 번호:
          </Text>{" "}
          {problemId}
        </Text>
        <Text>
          <Text color="cyan" bold>
            URL:
          </Text>{" "}
          <Text color="blue" underline>
            {url}
          </Text>
        </Text>
      </Box>
    </Box>
  );
}

async function openCommand(problemId: number) {
  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <OpenCommand
        problemId={problemId}
        onComplete={() => {
          unmount();
          resolve();
        }}
      />
    );
  });
}

export const openHelp = `
  사용법:
    $ ps open [문제번호]

  설명:
    백준 문제 페이지를 브라우저로 엽니다.
    - 문제 번호를 인자로 전달하거나
    - 문제 디렉토리에서 실행하면 자동으로 문제 번호를 추론합니다.

  예제:
    $ ps open 1000                    # 1000번 문제 열기
    $ ps open                         # 문제 디렉토리에서 실행 시 자동 추론
    $ ps open --help                  # 도움말 표시
`;

export async function openExecute(
  args: string[],
  flags: { help?: boolean }
): Promise<void> {
  if (flags.help) {
    console.log(openHelp.trim());
    process.exit(0);
    return;
  }

  const problemId = getProblemId(args);

  if (problemId === null) {
    console.error("오류: 문제 번호를 입력해주세요.");
    console.error(`사용법: ps open <문제번호>`);
    console.error(`도움말: ps open --help`);
    console.error(
      `힌트: problems/{문제번호} 디렉토리에서 실행하면 자동으로 문제 번호를 추론합니다.`
    );
    process.exit(1);
  }

  await openCommand(problemId);
}

const openCommandDef: CommandDefinition = {
  name: "open",
  help: openHelp,
  execute: openExecute,
};

export default openCommandDef;
