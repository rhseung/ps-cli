import { StatusMessage, Alert, Spinner } from '@inkjs/ui';
import { Text, Box } from 'ink';

import {
  Command,
  CommandDef,
  CommandBuilder,
  resolveProblemContext,
  logger,
  getEditor,
} from '../core';
import { useOpenBrowser } from '../hooks/use-open-browser';
import { useOpenEditor } from '../hooks/use-open-editor';
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
  editor: {
    type: 'boolean' as const,
    shortFlag: 'e',
    description: '에디터로 문제 파일을 엽니다',
  },
} as const satisfies FlagDefinitionSchema;

type OpenCommandFlags = InferFlagsFromSchema<typeof openFlagsSchema>;

export interface OpenViewProps {
  problemId?: number;
  workbookId?: number;
  problemDir?: string;
  mode: 'browser' | 'editor' | 'both';
  onComplete?: () => void;
}

export function OpenView({
  problemId,
  workbookId,
  problemDir,
  mode,
  onComplete,
}: OpenViewProps) {
  const showBrowser = mode === 'browser' || mode === 'both';
  const showEditor = mode === 'editor' || mode === 'both';

  const {
    status: browserStatus,
    error: browserError,
    url,
  } = useOpenBrowser({
    problemId: showBrowser ? problemId : undefined,
    workbookId: showBrowser ? workbookId : undefined,
    // 브라우저만 열거나 둘 다 열 때, 에디터가 없거나 완료되었을 때만 onComplete 호출
    onComplete: mode === 'browser' ? onComplete : undefined,
  });

  const { status: editorStatus, error: editorError } = useOpenEditor({
    path: showEditor ? problemDir : undefined,
    // 에디터만 열거나 둘 다 열 때, 브라우저가 완료되었을 때만 onComplete 호출
    onComplete: mode === 'editor' || mode === 'both' ? onComplete : undefined,
  });

  const displayId = workbookId !== undefined ? workbookId : problemId;
  const displayType = workbookId !== undefined ? '문제집' : '문제';
  const editorName = getEditor();

  const isLoading =
    (showBrowser && browserStatus === 'loading') ||
    (showEditor && editorStatus === 'loading');

  const isError =
    (showBrowser && browserStatus === 'error') ||
    (showEditor && editorStatus === 'error');

  const errorMessage = browserError || editorError;

  if (isLoading) {
    return (
      <Box flexDirection="column">
        <Spinner
          label={
            mode === 'both'
              ? '브라우저와 에디터를 여는 중...'
              : mode === 'browser'
                ? '브라우저를 여는 중...'
                : '에디터를 여는 중...'
          }
        />
        {displayId && (
          <Box marginTop={1}>
            <Text color="gray">
              {displayType} {workbookId !== undefined ? 'ID' : '#'}: {displayId}
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  if (isError) {
    return (
      <Box flexDirection="column">
        <Alert variant="error">열기 실패: {errorMessage}</Alert>
        {url && (
          <Box marginTop={1}>
            <Text color="gray">URL: {url}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      <StatusMessage variant="success">
        {mode === 'both'
          ? '브라우저와 에디터에서 열었습니다!'
          : mode === 'browser'
            ? '브라우저에서 열었습니다!'
            : '에디터에서 열었습니다!'}
      </StatusMessage>
      <Box marginTop={1} flexDirection="column">
        {displayId && (
          <Text>
            <Text color="cyan" bold>
              {displayType} {workbookId !== undefined ? 'ID' : '번호'}:
            </Text>{' '}
            {displayId}
          </Text>
        )}
        {showBrowser && url && (
          <Text>
            <Text color="cyan" bold>
              URL:
            </Text>{' '}
            <Text color="blue" underline>
              {url}
            </Text>
          </Text>
        )}
        {showEditor && problemDir && (
          <Text>
            <Text color="cyan" bold>
              에디터:
            </Text>{' '}
            <Text>{editorName}</Text>
          </Text>
        )}
      </Box>
    </Box>
  );
}

@CommandDef({
  name: 'open',
  description: `백준 문제 페이지 또는 에디터를 엽니다.
- 문제 번호를 인자로 전달하거나
- 문제 디렉토리에서 실행하면 자동으로 문제 번호를 추론합니다.
- --workbook 옵션으로 문제집 ID를 지정하면 문제집 페이지를 엽니다.
- --editor 옵션으로 문제 파일을 에디터로 엽니다.
- 옵션이 없으면 브라우저를 엽니다.
* 에디터는 config editor 옵션으로 설정할 수 있습니다 (기본값: code)`,
  autoDetectProblemId: true,
  requireProblemId: false,
  flags: defineFlags(openFlagsSchema),
  examples: [
    'open 1000                    # 1000번 문제 브라우저로 열기',
    'open                         # 현재 문제 브라우저로 열기',
    'open -e                      # 현재 문제 에디터로 열기',
    'open 1000 -e                 # 1000번 문제 에디터로 열기',
    'open --workbook 25052        # 문제집 25052 열기',
    'open --help                  # 도움말 표시',
  ],
})
export class OpenCommand extends Command<OpenCommandFlags> {
  async execute(args: string[], flags: OpenCommandFlags): Promise<void> {
    const workbookId = flags.workbook
      ? parseInt(String(flags.workbook), 10)
      : null;

    // 문제집 모드 (에디터 미지원)
    if (workbookId !== null) {
      if (isNaN(workbookId) || workbookId <= 0) {
        logger.error('유효한 문제집 ID를 입력해주세요.');
        console.log(`사용법: ps open --workbook <문제집ID>`);
        console.log(`도움말: ps open --help`);
        process.exit(1);
        return;
      }

      await this.renderView(OpenView, {
        workbookId,
        mode: 'browser',
      });
      return;
    }

    // 문제 모드
    const context = await resolveProblemContext(args, { requireId: true });

    if (context.problemId === null) {
      logger.error('문제 번호를 입력해주세요.');
      console.log(`도움말: ps open --help`);
      process.exit(1);
      return;
    }

    const mode = flags.editor ? 'editor' : 'browser';
    // 에디터로 열 때는 항상 디렉토리를 엽니다
    const problemPath = context.archiveDir;

    await this.renderView(OpenView, {
      problemId: context.problemId,
      problemDir: problemPath,
      mode,
    });
  }
}

export default CommandBuilder.fromClass(OpenCommand);
