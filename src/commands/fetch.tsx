import { StatusMessage, Alert, Spinner } from '@inkjs/ui';
import { Box } from 'ink';

import { ProblemDashboard } from '../components/problem-dashboard';
import {
  Command,
  CommandDef,
  CommandBuilder,
  resolveProblemContext,
  getSupportedLanguages,
  getSupportedLanguagesString,
  logger,
  type Language,
} from '../core';
import { useFetchProblem } from '../hooks/use-fetch-problem';
import type {
  InferFlagsFromSchema,
  FlagDefinitionSchema,
} from '../types/command';
import { defineFlags } from '../types/command';

// 플래그 정의 스키마 (타입 추론용)
const fetchFlagsSchema = {
  language: {
    type: 'string' as const,
    shortFlag: 'l',
    description: `언어 선택 (${getSupportedLanguagesString()})
                        기본값: python`,
  },
} as const satisfies FlagDefinitionSchema;

type FetchCommandFlags = InferFlagsFromSchema<typeof fetchFlagsSchema>;

export interface FetchViewProps {
  problemId: number;
  language?: Language;
  onComplete?: () => void;
}

export function FetchView({
  problemId,
  language = 'python',
  onComplete,
}: FetchViewProps) {
  const { status, problem, error, message } = useFetchProblem({
    problemId,
    language,
    onComplete,
  });

  if (status === 'loading') {
    return (
      <Box flexDirection="column">
        <Spinner label={message} />
        {problem && <ProblemDashboard problem={problem} />}
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
      {problem && (
        <Box alignSelf="flex-start">
          <ProblemDashboard problem={problem} />
        </Box>
      )}
      <StatusMessage variant="success">{message}</StatusMessage>
    </Box>
  );
}

@CommandDef({
  name: 'fetch',
  description: `백준 문제를 가져와서 로컬에 파일을 생성합니다.
- Solved.ac API와 BOJ 크롤링을 통해 문제 정보 수집
- 문제 설명, 입출력 형식, 예제 입출력 파일 자동 생성
- 선택한 언어의 솔루션 템플릿 파일 생성
- README.md에 문제 정보, 통계, 태그(설정 시) 등 포함
- 기본 언어, 에디터 설정 등은 ps config에서 설정 가능합니다.`,
  flags: defineFlags(fetchFlagsSchema),
  autoDetectProblemId: false,
  requireProblemId: true,
  examples: ['fetch 1000', 'fetch 1000 --language python', 'fetch 1000 -l cpp'],
})
export class FetchCommand extends Command<FetchCommandFlags> {
  async execute(args: string[], flags: FetchCommandFlags): Promise<void> {
    // 문제 컨텍스트 해석
    const context = await resolveProblemContext(args, { requireId: true });

    if (context.problemId === null) {
      logger.error('문제 번호를 입력해주세요.');
      console.log(`도움말: ps fetch --help`);
      process.exit(1);
      return;
    }

    const validLanguages = getSupportedLanguages();
    const language = flags.language as Language | undefined;
    if (language && !validLanguages.includes(language)) {
      console.error(
        `오류: 지원하지 않는 언어입니다. (${getSupportedLanguagesString()})`,
      );
      process.exit(1);
      return;
    }

    await this.renderView(FetchView, {
      problemId: context.problemId,
      language: language || 'python',
    });
  }
}

export default CommandBuilder.fromClass(FetchCommand);
