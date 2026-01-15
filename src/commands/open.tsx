import { StatusMessage, Alert, Spinner } from '@inkjs/ui';
import { Text, Box } from 'ink';

import {
  Command,
  CommandDef,
  CommandBuilder,
  resolveProblemContext,
} from '../core';
import { useOpenBrowser } from '../hooks/use-open-browser';
import type {
  InferFlagsFromSchema,
  FlagDefinitionSchema,
} from '../types/command';
import { defineFlags } from '../types/command';

// 플래그 정의 스키마 (타입 추론용)
const openFlagsSchema = {
  workbook: {
    type: 'number' as const,
    shortFlag: 'w',
    description: '문제집 ID를 지정하여 해당 문제집 페이지를 엽니다',
  },
} as const satisfies FlagDefinitionSchema;

type OpenCommandFlags = InferFlagsFromSchema<typeof openFlagsSchema>;

export interface OpenViewProps {
  problemId?: number;
  workbookId?: number;
  onComplete?: () => void;
}

export function OpenView({ problemId, workbookId, onComplete }: OpenViewProps) {
  const { status, error, url } = useOpenBrowser({
    problemId,
    workbookId,
    onComplete,
  });

  const displayId = workbookId !== undefined ? workbookId : problemId;
  const displayType = workbookId !== undefined ? '문제집' : '문제';

  if (status === 'loading') {
    return (
      <Box flexDirection="column">
        <Spinner label="브라우저를 여는 중..." />
        <Box marginTop={1}>
          <Text color="gray">
            {displayType} {workbookId !== undefined ? 'ID' : '#'}: {displayId}
          </Text>
        </Box>
      </Box>
    );
  }

  if (status === 'error') {
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
        브라우저에서 {displayType} 페이지를 열었습니다!
      </StatusMessage>
      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text color="cyan" bold>
            {displayType} {workbookId !== undefined ? 'ID' : '번호'}:
          </Text>{' '}
          {displayId}
        </Text>
        <Text>
          <Text color="cyan" bold>
            URL:
          </Text>{' '}
          <Text color="blue" underline>
            {url}
          </Text>
        </Text>
      </Box>
    </Box>
  );
}

@CommandDef({
  name: 'open',
  description: `백준 문제 페이지 또는 문제집 페이지를 브라우저로 엽니다.
- 문제 번호를 인자로 전달하거나
- 문제 디렉토리에서 실행하면 자동으로 문제 번호를 추론합니다.
- --workbook 옵션으로 문제집 ID를 지정하면 문제집 페이지를 엽니다.`,
  autoDetectProblemId: true,
  requireProblemId: false,
  flags: defineFlags(openFlagsSchema),
  examples: [
    'open 1000                    # 1000번 문제 열기',
    'open                         # 문제 디렉토리에서 실행 시 자동 추론',
    'open --workbook 25052        # 문제집 25052 열기',
    'open -w 25052                # 문제집 25052 열기 (단축 옵션)',
    'open --help                  # 도움말 표시',
  ],
})
export class OpenCommand extends Command<OpenCommandFlags> {
  async execute(args: string[], flags: OpenCommandFlags): Promise<void> {
    const workbookId = flags.workbook
      ? parseInt(String(flags.workbook), 10)
      : null;

    // 문제집 모드
    if (workbookId !== null) {
      if (isNaN(workbookId) || workbookId <= 0) {
        console.error('오류: 유효한 문제집 ID를 입력해주세요.');
        console.error(`사용법: ps open --workbook <문제집ID>`);
        console.error(`도움말: ps open --help`);
        process.exit(1);
        return;
      }

      await this.renderView(OpenView, {
        workbookId,
      });
      return;
    }

    // 문제 모드
    const context = await resolveProblemContext(args, { requireId: true });

    if (context.problemId === null) {
      console.error('오류: 문제 번호를 입력해주세요.');
      console.error(`사용법: ps open <문제번호>`);
      console.error(`      ps open --workbook <문제집ID>`);
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
