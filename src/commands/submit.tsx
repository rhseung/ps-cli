import { Badge, StatusMessage, Alert, Spinner } from '@inkjs/ui';
import { Text, Box } from 'ink';
import React from 'react';

import {
  Command,
  CommandDef,
  CommandBuilder,
  resolveProblemContext,
  resolveLanguage,
  findSolutionFile,
  getSupportedLanguagesString,
  detectProblemIdFromPath,
  type Language,
} from '../core';
import { useSubmit } from '../hooks/use-submit';
import type {
  InferFlagsFromSchema,
  FlagDefinitionSchema,
} from '../types/command';
import { defineFlags } from '../types/command';

// 플래그 정의 스키마 (타입 추론용)
const submitFlagsSchema = {
  language: {
    type: 'string' as const,
    shortFlag: 'l',
    description: `언어 선택 (지정 시 자동 감지 무시)
                        지원 언어: ${getSupportedLanguagesString()}`,
  },
} as const satisfies FlagDefinitionSchema;

type SubmitCommandFlags = InferFlagsFromSchema<typeof submitFlagsSchema>;

export interface SubmitViewProps {
  problemId: number;
  language: Language;
  sourcePath: string;
  onComplete: () => void;
}

export function SubmitView({
  problemId,
  language,
  sourcePath,
  onComplete,
}: SubmitViewProps) {
  const {
    status,
    message,
    error,
    submitUrl,
    clipboardSuccess,
    clipboardError,
  } = useSubmit({
    problemId,
    language,
    sourcePath,
    onComplete,
  });

  if (status === 'loading') {
    return (
      <Box flexDirection="column">
        <Spinner label={message} />
        <Box marginTop={1}>
          <Text color="gray">문제 #{problemId}</Text>
        </Box>
      </Box>
    );
  }

  if (status === 'error') {
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
          </Text>{' '}
          {problemId}
        </Text>
        <Text>
          <Text color="cyan" bold>
            언어:
          </Text>{' '}
          <Text color="gray">{language}</Text>
        </Text>
        <Text>
          <Text color="cyan" bold>
            URL:
          </Text>{' '}
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

@CommandDef({
  name: 'submit',
  description: `백준 제출 페이지를 브라우저로 열고 소스 코드를 클립보드에 복사합니다.
- 문제 번호를 인자로 전달하거나 문제 디렉토리에서 실행하면 자동으로 문제 번호를 추론
- solution.* 파일을 자동으로 찾아 언어 감지
- 소스 코드를 클립보드에 자동 복사
- 제출 페이지를 브라우저로 자동 열기
- 기본 언어 등은 ps config에서 설정 가능합니다.`,
  flags: defineFlags(submitFlagsSchema),
  autoDetectProblemId: true,
  autoDetectLanguage: true,
  requireProblemId: true,
  examples: [
    'submit                    # 현재 디렉토리에서 제출',
    'submit 1000                # 1000번 문제 제출',
    'submit --language python   # Python으로 제출',
  ],
})
export class SubmitCommand extends Command<SubmitCommandFlags> {
  async execute(args: string[], flags: SubmitCommandFlags): Promise<void> {
    // 문제 컨텍스트 해석 (solving dir과 archive dir 둘 다 확인)
    const context = await resolveProblemContext(args, { requireId: true });

    // 솔루션 파일 찾기
    const sourcePath = await findSolutionFile(context.archiveDir);

    // 언어 감지
    const detectedLanguage = await resolveLanguage(
      context.archiveDir,
      flags.language as Language | undefined,
    );

    // 최종 문제 번호 결정
    let finalProblemId = context.problemId;
    if (finalProblemId === null) {
      // 경로에서 다시 시도
      finalProblemId = detectProblemIdFromPath(context.archiveDir);
    }

    if (finalProblemId === null) {
      throw new Error(
        '문제 번호를 찾을 수 없습니다. 문제 번호를 인자로 전달하거나 문제 디렉토리에서 실행해주세요.',
      );
    }

    await this.renderView(SubmitView, {
      problemId: finalProblemId,
      language: detectedLanguage,
      sourcePath,
    });
  }
}

export default CommandBuilder.fromClass(SubmitCommand);
