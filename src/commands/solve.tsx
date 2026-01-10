import { StatusMessage, Alert } from "@inkjs/ui";
import { Spinner } from "@inkjs/ui";
import { Box } from "ink";
import React from "react";

import { Command } from "../core/base-command";
import { CommandDef, CommandBuilder } from "../core/command-builder";
import { useSolve } from "../hooks/use-solve";
import type { CommandFlags } from "../types/command";
import { getProblemId } from "../utils/problem-id";

interface SolveViewProps {
  problemId: number;
  onComplete?: () => void;
}

function SolveView({ problemId, onComplete }: SolveViewProps) {
  const { status, message, error } = useSolve({
    problemId,
    onComplete,
  });

  if (status === "loading") {
    return (
      <Box flexDirection="column">
        <Spinner label={message} />
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box flexDirection="column">
        <Alert variant="error">오류 발생: {error}</Alert>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      <StatusMessage variant="success">{message}</StatusMessage>
    </Box>
  );
}

@CommandDef({
  name: "solve",
  description: `문제를 아카이브하고 Git 커밋을 생성합니다.
- solving 디렉토리에서 문제를 찾아 problem 디렉토리로 이동
- Git add 및 commit 실행 (커밋 메시지: "solve: {문제번호} - {문제이름}")`,
  autoDetectProblemId: true,
  requireProblemId: false,
  examples: [
    "solve 1000",
    "solve                    # 현재 디렉토리에서 문제 번호 자동 감지",
  ],
})
export class SolveCommand extends Command {
  async execute(args: string[], _: CommandFlags): Promise<void> {
    const problemId = getProblemId(args);

    if (problemId === null) {
      console.error("오류: 문제 번호를 입력해주세요.");
      console.error(`사용법: ps solve <문제번호>`);
      console.error(`도움말: ps solve --help`);
      console.error(
        `힌트: solving/{문제번호} 디렉토리에서 실행하면 자동으로 문제 번호를 추론합니다.`,
      );
      process.exit(1);
      return;
    }

    await this.renderView(SolveView, {
      problemId,
    });
  }
}

export default CommandBuilder.fromClass(SolveCommand);
