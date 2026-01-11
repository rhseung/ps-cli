import { Alert } from '@inkjs/ui';
import { Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';
import React from 'react';

import { TestResultView } from '../components/test-result';
import { Command } from '../core/base-command';
import { CommandDef, CommandBuilder } from '../core/command-builder';
import { useTestRunner } from '../hooks/use-test-runner';
import type { CommandFlags } from '../types/command';
import {
  resolveProblemContext,
  resolveLanguage,
} from '../utils/execution-context';
import { getSupportedLanguagesString, type Language } from '../utils/language';
import { getProblemId } from '../utils/problem-id';

interface TestViewProps {
  problemDir: string;
  language: Language;
  watch: boolean;
  timeoutMs?: number;
  onComplete: () => void;
}

function TestView({
  problemDir,
  language,
  watch,
  timeoutMs,
  onComplete,
}: TestViewProps) {
  const { status, results, summary, error } = useTestRunner({
    problemDir,
    language,
    watch,
    timeoutMs,
    onComplete,
  });

  if (status === 'loading') {
    return (
      <Box flexDirection="column">
        <Spinner label="테스트 실행 중..." />
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box flexDirection="column">
        <Alert variant="error">
          테스트 실행 실패{error ? `: ${error}` : ''}
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
          {watch && ' • watch'}
        </Text>
      </Box>
      <TestResultView results={results} summary={summary} />
    </Box>
  );
}

@CommandDef({
  name: 'test',
  description: `예제 입출력 기반으로 로컬 테스트를 실행합니다.
- 현재 디렉토리 또는 지정한 문제 번호의 테스트 실행
- solution.* 파일을 자동으로 찾아 언어 감지
- input*.txt와 output*.txt 파일을 기반으로 테스트
- 문제의 시간 제한을 자동으로 적용
- --watch 옵션으로 파일 변경 시 자동 재테스트`,
  flags: [
    {
      name: 'language',
      options: {
        shortFlag: 'l',
        description: `언어 선택 (지정 시 자동 감지 무시)
                        지원 언어: ${getSupportedLanguagesString()}`,
      },
    },
    {
      name: 'watch',
      options: {
        shortFlag: 'w',
        description: `watch 모드 (파일 변경 시 자동 재테스트)
                        solution.*, input*.txt, output*.txt 파일 변경 감지`,
      },
    },
  ],
  autoDetectProblemId: true,
  autoDetectLanguage: true,
  examples: [
    'test                    # 현재 디렉토리에서 테스트',
    'test 1000               # 1000번 문제 테스트',
    'test --watch            # watch 모드로 테스트',
    'test 1000 --watch       # 1000번 문제를 watch 모드로 테스트',
  ],
})
export class TestCommand extends Command {
  async execute(args: string[], flags: CommandFlags): Promise<void> {
    const problemId = getProblemId(args);

    // 문제 컨텍스트 해석
    const context = await resolveProblemContext(
      problemId !== null && problemId !== undefined
        ? [problemId.toString()]
        : [],
    );

    // 언어 감지
    const language = await resolveLanguage(
      context.problemDir,
      flags.language as Language | undefined,
    );

    await this.renderView(TestView, {
      problemDir: context.problemDir,
      language,
      watch: Boolean(flags.watch),
      timeoutMs: flags.timeoutMs as number | undefined,
    });
  }
}

export default CommandBuilder.fromClass(TestCommand);
