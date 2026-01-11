import { StatusMessage, Alert } from '@inkjs/ui';
import { Spinner } from '@inkjs/ui';
import { Box } from 'ink';
import React from 'react';

import { ProblemDashboard } from '../components/problem-dashboard';
import { Command } from '../core/base-command';
import { CommandDef, CommandBuilder } from '../core/command-builder';
import { useFetchProblem } from '../hooks/use-fetch-problem';
import type { CommandFlags } from '../types/command';
import type { Language } from '../utils/language';
import {
  getSupportedLanguages,
  getSupportedLanguagesString,
} from '../utils/language';
import { getProblemId } from '../utils/problem-id';

interface FetchViewProps {
  problemId: number;
  language?: Language;
  onComplete?: () => void;
}

function FetchView({
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
- README.md에 문제 정보, 통계, 태그 등 포함`,
  flags: [
    {
      name: 'language',
      options: {
        shortFlag: 'l',
        description: `언어 선택 (${getSupportedLanguagesString()})
                        기본값: python`,
      },
    },
  ],
  autoDetectProblemId: false,
  requireProblemId: true,
  examples: ['fetch 1000', 'fetch 1000 --language python', 'fetch 1000 -l cpp'],
})
export class FetchCommand extends Command {
  async execute(args: string[], flags: CommandFlags): Promise<void> {
    const problemId = getProblemId(args);

    if (problemId === null) {
      console.error('오류: 문제 번호를 입력해주세요.');
      console.error(`사용법: ps fetch <문제번호> [옵션]`);
      console.error(`도움말: ps fetch --help`);
      console.error(
        `힌트: problems/{문제번호} 디렉토리에서 실행하면 자동으로 문제 번호를 추론합니다.`,
      );
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
      problemId,
      language: language || 'python',
    });
  }
}

export default CommandBuilder.fromClass(FetchCommand);
