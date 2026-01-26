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
  findSolutionFileByIndex,
  findSolutionFiles,
  detectLanguageFromFile,
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
  file: {
    type: 'string' as const,
    shortFlag: 'f',
    description: '특정 solution 파일 지정 (예: solution-2.py)',
  },
  index: {
    type: 'string' as const,
    shortFlag: 'i',
    description: '인덱스로 solution 파일 지정 (예: 2)',
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
- solution.* 파일을 자동으로 찾아 언어 감지 (기본적으로 가장 최근 수정된 파일 사용)
- 여러 답안 파일 지원: solution-1.py, solution-2.py 형식으로 여러 답안 관리 가능
- --file 또는 --index 옵션으로 특정 파일 지정 가능
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
    'submit --file solution-2.py  # 특정 파일로 제출',
    'submit --index 2          # 인덱스 2의 파일로 제출',
  ],
})
export class SubmitCommand extends Command<SubmitCommandFlags> {
  async execute(args: string[], flags: SubmitCommandFlags): Promise<void> {
    // 문제 컨텍스트 해석 (solving dir과 archive dir 둘 다 확인)
    const context = await resolveProblemContext(args, { requireId: true });

    // 솔루션 파일 경로 결정 및 언어 감지
    let sourcePath: string;
    let detectedLanguage: Language;

    if (flags.file) {
      // --file 플래그로 특정 파일 지정
      const filePath = flags.file as string;
      if (filePath.startsWith('/') || filePath.match(/^[A-Z]:/)) {
        sourcePath = filePath;
      } else {
        // 상대 경로인 경우 파일명만 지정된 것으로 간주
        const { join } = await import('path');
        sourcePath = join(context.archiveDir, filePath);
      }

      // 파일명에서 언어 감지
      const fileName = sourcePath.split(/[/\\]/).pop() || '';
      const fileLang = detectLanguageFromFile(fileName);
      if (flags.language) {
        detectedLanguage = flags.language as Language;
      } else if (fileLang) {
        detectedLanguage = fileLang;
      } else {
        // 언어를 감지할 수 없으면 resolveLanguage 시도
        detectedLanguage = await resolveLanguage(
          context.archiveDir,
          flags.language as Language | undefined,
        );
      }
    } else if (flags.index) {
      // --index 플래그로 인덱스 지정
      const index = parseInt(flags.index as string, 10);
      if (isNaN(index) || index < 1) {
        throw new Error(`유효하지 않은 인덱스입니다: ${flags.index}`);
      }

      // 언어가 지정되어 있으면 사용, 없으면 먼저 파일 찾기
      if (flags.language) {
        detectedLanguage = flags.language as Language;
        sourcePath = await findSolutionFileByIndex(
          context.archiveDir,
          index,
          detectedLanguage,
        );
      } else {
        // 언어가 없으면 모든 파일에서 찾기
        const files = await findSolutionFiles(context.archiveDir);
        const targetFile = files.find((f) => f.index === index);
        if (!targetFile) {
          throw new Error(
            `인덱스 ${index}의 solution 파일을 찾을 수 없습니다.`,
          );
        }
        sourcePath = targetFile.path;
        detectedLanguage = targetFile.language as Language;
      }
    } else {
      // 기본값: 언어 감지 후 가장 최근 파일 찾기
      detectedLanguage = await resolveLanguage(
        context.archiveDir,
        flags.language as Language | undefined,
      );
      sourcePath = await findSolutionFile(context.archiveDir, detectedLanguage);
    }

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
