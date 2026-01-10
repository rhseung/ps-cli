import { StatusMessage, Alert } from "@inkjs/ui";
import { Spinner } from "@inkjs/ui";
import { Text, Box } from "ink";
import React from "react";

import { Command } from "../core/base-command";
import { CommandDef, CommandBuilder } from "../core/command-builder";
import { useOpenBrowser } from "../hooks/use-open-browser";
import type { CommandFlags } from "../types/command";
import { resolveProblemContext } from "../utils/execution-context";
import { getProblemId } from "../utils/problem-id";

interface OpenViewProps {
  problemId: number;
  onComplete?: () => void;
}

function OpenView({ problemId, onComplete }: OpenViewProps) {
  const { status, error, url } = useOpenBrowser({
    problemId,
    onComplete,
  });

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

@CommandDef({
  name: "open",
  description: `백준 문제 페이지를 브라우저로 엽니다.
- 문제 번호를 인자로 전달하거나
- 문제 디렉토리에서 실행하면 자동으로 문제 번호를 추론합니다.`,
  autoDetectProblemId: true,
  requireProblemId: true,
  examples: [
    "open 1000                    # 1000번 문제 열기",
    "open                         # 문제 디렉토리에서 실행 시 자동 추론",
    "open --help                  # 도움말 표시",
  ],
})
export class OpenCommand extends Command {
  async execute(args: string[], _flags: CommandFlags): Promise<void> {
    const problemId = getProblemId(args);

    // 문제 컨텍스트 해석
    const context = await resolveProblemContext(
      problemId !== null ? [problemId.toString()] : [],
      { requireId: true },
    );

    if (context.problemId === null) {
      console.error("오류: 문제 번호를 입력해주세요.");
      console.error(`사용법: ps open <문제번호>`);
      console.error(`도움말: ps open --help`);
      console.error(
        `힌트: problems/{문제번호} 디렉토리에서 실행하면 자동으로 문제 번호를 추론합니다.`,
      );
      process.exit(1);
      return;
    }

    await this.renderView(OpenView, {
      problemId: context.problemId,
    });
  }
}

export default CommandBuilder.fromClass(OpenCommand);
