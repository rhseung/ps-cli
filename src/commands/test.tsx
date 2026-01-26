import { Alert, Badge, Spinner, StatusMessage } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import React, { useEffect, useState } from 'react';

import { TestResultView } from '../components/test-result';
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
  detectProblemIdFromPath,
  getSupportedLanguagesString,
  icons,
  type Language,
} from '../core';
import { useTestRunner, useTestcaseAc } from '../hooks';
import type {
  InferFlagsFromSchema,
  FlagDefinitionSchema,
} from '../types/command';
import { defineFlags } from '../types/command';

// 플래그 정의 스키마 (타입 추론용)
const testFlagsSchema = {
  language: {
    type: 'string' as const,
    shortFlag: 'l',
    description: `언어 선택 (지정 시 자동 감지 무시)
                        지원 언어: ${getSupportedLanguagesString()}`,
  },
  watch: {
    type: 'boolean' as const,
    shortFlag: 'w',
    description: `watch 모드 (파일 변경 시 자동 재테스트)
                        solution.*, testcases/**/*.txt 파일 변경 감지`,
  },
  testcaseAc: {
    type: 'boolean' as const,
    description:
      '로컬 테스트 실행 없이 testcase.ac 문제 페이지를 열고 소스를 클립보드에 복사합니다',
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

type TestCommandFlags = InferFlagsFromSchema<typeof testFlagsSchema>;

export interface TestViewProps {
  problemDir: string;
  language: Language;
  watch: boolean;
  timeoutMs?: number;
  onComplete: () => void;
  problemId?: number | null;
  sourcePath?: string;
  solutionPath?: string; // 테스트에 사용할 solution 파일 경로
}

interface TestcaseAcPanelProps {
  problemId: number;
  sourcePath: string;
  onComplete: () => void;
}

function TestcaseAcPanel({
  problemId,
  sourcePath,
  onComplete,
}: TestcaseAcPanelProps) {
  const { status, message, error, url, clipboardSuccess, clipboardError } =
    useTestcaseAc({
      problemId,
      sourcePath,
      onComplete,
    });

  if (status === 'loading') {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Spinner label={message} />
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Alert variant="error">testcase.ac 열기 실패: {error}</Alert>
        {url && (
          <Box marginTop={1}>
            <Text color="gray">URL: {url}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" marginTop={1}>
      <StatusMessage variant="success">
        testcase.ac 페이지를 열었습니다!
      </StatusMessage>
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
        {url && (
          <Text>
            <Text color="cyan" bold>
              URL:
            </Text>{' '}
            <Text color="blue" underline>
              {url}
            </Text>
          </Text>
        )}
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

export function TestView({
  problemDir,
  language,
  watch,
  timeoutMs,
  onComplete,
  problemId,
  sourcePath,
  solutionPath,
}: TestViewProps) {
  const { status, results, summary, error } = useTestRunner({
    problemDir,
    language,
    watch,
    timeoutMs,
    solutionPath,
    onComplete: () => {
      // use-test-runner 훅 내부에서는 onComplete를 사용하지 않습니다.
      // 완료 시점 관리는 TestView에서 직접 수행합니다.
    },
  });

  const [completed, setCompleted] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [acceptedSuggestion, setAcceptedSuggestion] = useState(false);

  const allPassed =
    summary.total > 0 &&
    summary.total === summary.passed &&
    summary.failed === 0 &&
    summary.errored === 0;

  // 테스트 완료 후 자동 종료 시점 제어
  useEffect(() => {
    if (watch || completed) {
      return;
    }

    if (status === 'error') {
      const timer = setTimeout(() => {
        setCompleted(true);
        onComplete();
      }, 200);
      return () => clearTimeout(timer);
    }

    if (status === 'ready') {
      // testcase.ac 제안을 할 수 있는 경우에는 사용자의 입력을 기다립니다.
      const canSuggest =
        allPassed && !!problemId && !!sourcePath && !acceptedSuggestion;
      if (!canSuggest) {
        const timer = setTimeout(() => {
          setCompleted(true);
          onComplete();
        }, 200);
        return () => clearTimeout(timer);
      }
    }

    return undefined;
  }, [
    status,
    watch,
    completed,
    onComplete,
    allPassed,
    acceptedSuggestion,
    problemId,
    sourcePath,
  ]);

  // 모든 테스트 통과 시 제안 표시
  useEffect(() => {
    if (watch) {
      setShowSuggestion(false);
      return;
    }

    if (status === 'ready' && allPassed && problemId && sourcePath) {
      setShowSuggestion(true);
    } else {
      setShowSuggestion(false);
    }
  }, [status, allPassed, watch]);

  // 사용자의 Y/N 입력 처리
  useInput((input, key) => {
    if (!showSuggestion || acceptedSuggestion || completed) {
      return;
    }

    const lower = input.toLowerCase();

    if (lower === 'y' || key.return) {
      setAcceptedSuggestion(true);
      setShowSuggestion(false);
    } else if (lower === 'n' || key.escape) {
      setShowSuggestion(false);
      // 거절 시에는 약간의 딜레이 후 종료
      if (!completed) {
        setCompleted(true);
        onComplete();
      }
    }
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
          {problemDir} {icons.solving} {language}
          {watch && ` ${icons.solving} watch`}
        </Text>
      </Box>
      <TestResultView results={results} summary={summary} />
      {showSuggestion && !acceptedSuggestion && (
        <Box marginTop={1} flexDirection="column">
          <Alert variant="info">
            모든 로컬 테스트를 통과했습니다. testcase.ac에서 추가 테스트를
            실행해 볼까요? (Y/n)
          </Alert>
          <Box marginTop={1}>
            <Text color="gray">
              Y 또는 Enter: testcase.ac 열기 / N 또는 Esc: 건너뛰기
            </Text>
          </Box>
        </Box>
      )}
      {acceptedSuggestion && problemId && sourcePath && !completed && (
        <TestcaseAcPanel
          problemId={problemId}
          sourcePath={sourcePath}
          onComplete={() => {
            if (!completed) {
              setCompleted(true);
              onComplete();
            }
          }}
        />
      )}
    </Box>
  );
}

@CommandDef({
  name: 'test',
  description: `예제 입출력 기반으로 로컬 테스트를 실행합니다.
- 현재 디렉토리 또는 지정한 문제 번호의 테스트 실행
- solution.* 파일을 자동으로 찾아 언어 감지
- testcases/{번호}/input.txt와 testcases/{번호}/output.txt 파일을 기반으로 테스트
- 문제의 시간 제한을 자동으로 적용
- --watch 옵션으로 파일 변경 시 자동 재테스트
- 기본 언어 등은 ps config에서 설정 가능합니다.`,
  flags: defineFlags(testFlagsSchema),
  autoDetectProblemId: true,
  autoDetectLanguage: true,
  examples: [
    'test                    # 현재 디렉토리에서 테스트',
    'test 1000               # 1000번 문제 테스트',
    'test --watch            # watch 모드로 테스트',
    'test 1000 --watch       # 1000번 문제를 watch 모드로 테스트',
    'test --language python  # Python으로 테스트',
    'test --file solution-2.py  # 특정 파일로 테스트',
    'test --index 2          # 인덱스 2의 파일로 테스트',
  ],
})
export class TestCommand extends Command<TestCommandFlags> {
  async execute(args: string[], flags: TestCommandFlags): Promise<void> {
    // 문제 컨텍스트 해석
    const context = await resolveProblemContext(args);

    // 솔루션 파일 경로 결정 및 언어 감지
    let sourcePath: string;
    let language: Language;

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
        language = flags.language as Language;
      } else if (fileLang) {
        language = fileLang;
      } else {
        // 언어를 감지할 수 없으면 resolveLanguage 시도
        language = await resolveLanguage(
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
        language = flags.language as Language;
        sourcePath = await findSolutionFileByIndex(
          context.archiveDir,
          index,
          language,
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
        language = targetFile.language as Language;
      }
    } else {
      // 기본값: 언어 감지 후 가장 최근 파일 찾기
      language = await resolveLanguage(
        context.archiveDir,
        flags.language as Language | undefined,
      );
      sourcePath = await findSolutionFile(context.archiveDir, language);
    }

    // 최종 문제 번호 결정
    let finalProblemId = context.problemId;
    if (finalProblemId === null) {
      finalProblemId = detectProblemIdFromPath(context.archiveDir);
    }

    // --testcase-ac 플래그: 로컬 테스트 없이 바로 testcase.ac 열기
    if (flags.testcaseAc) {
      if (finalProblemId === null) {
        throw new Error(
          '문제 번호를 찾을 수 없습니다. 문제 번호를 인자로 전달하거나 문제 디렉토리에서 실행해주세요.',
        );
      }

      await this.renderView(TestcaseAcPanel, {
        problemId: finalProblemId,
        sourcePath,
      });
      return;
    }

    await this.renderView(TestView, {
      problemDir: context.archiveDir,
      language,
      watch: Boolean(flags.watch),
      timeoutMs: flags.timeoutMs as number | undefined,
      problemId: finalProblemId,
      sourcePath,
      solutionPath: sourcePath,
    });
  }
}

export default CommandBuilder.fromClass(TestCommand);
