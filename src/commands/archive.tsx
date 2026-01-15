import { StatusMessage, Alert, Spinner } from '@inkjs/ui';
import { Box } from 'ink';
import React from 'react';

import {
  Command,
  CommandDef,
  CommandBuilder,
  resolveProblemContext,
  logger,
  type CommandFlags,
} from '../core';
import { useArchive } from '../hooks/use-archive';

export interface ArchiveViewProps {
  problemId: number;
  onComplete?: () => void;
}

export function ArchiveView({ problemId, onComplete }: ArchiveViewProps) {
  const { status, message, error } = useArchive({
    problemId,
    onComplete,
  });

  if (status === 'loading') {
    return (
      <Box flexDirection="column">
        <Spinner label={message} />
      </Box>
    );
  }

  if (status === 'error') {
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
  name: 'archive',
  description: `문제를 아카이브하고 Git 커밋을 생성합니다.
- solving 디렉토리에서 문제를 찾아 archive 디렉토리로 이동
- Git add 및 commit 실행 (커밋 메시지: "solve: {문제번호} - {문제이름}")
- 아카이브 경로, 전략, 자동 커밋 여부 등은 ps config에서 설정 가능합니다.`,
  flags: [],
  autoDetectProblemId: true,
  requireProblemId: false,
  examples: [
    'archive 1000',
    'archive                    # 현재 디렉토리에서 문제 번호 자동 감지',
  ],
})
export class ArchiveCommand extends Command {
  async execute(args: string[], _: CommandFlags): Promise<void> {
    const context = await resolveProblemContext(args, { requireId: false });

    if (context.problemId === null) {
      logger.error('문제 번호를 입력해주세요.');
      console.log(`도움말: ps archive --help`);
      process.exit(1);
      return;
    }

    await this.renderView(ArchiveView, {
      problemId: context.problemId,
    });
  }
}

export default CommandBuilder.fromClass(ArchiveCommand);
