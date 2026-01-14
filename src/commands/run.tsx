import { join } from 'path';

import { StatusMessage, Alert } from '@inkjs/ui';
import { Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';

import { Command } from '../core/base-command';
import { CommandDef, CommandBuilder } from '../core/command-builder';
import { useRunSolution } from '../hooks/use-run-solution';
import type { CommandFlags } from '../types/command';
import {
  resolveProblemContext,
  resolveLanguage,
} from '../utils/execution-context';
import { getSupportedLanguagesString, type Language } from '../utils/language';

interface RunViewProps {
  problemDir: string;
  language: Language;
  inputFile?: string;
  onComplete: () => void;
}

function RunView({
  problemDir,
  language,
  inputFile,
  onComplete,
}: RunViewProps) {
  const { status, result, error } = useRunSolution({
    problemDir,
    language,
    inputFile,
    onComplete,
  });

  if (status === 'loading') {
    // 표준 입력을 받아야 하는 경우 안내 메시지 표시
    if (!inputFile) {
      return (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              표준 입력 대기 중
            </Text>
          </Box>
          <Box flexDirection="column">
            <Text color="gray" dimColor>
              입력을 입력한 후, 마지막 줄에서 Enter를 누르고:
            </Text>
            <Text color="gray" dimColor>
              • macOS/Linux: Ctrl+D
            </Text>
            <Text color="gray" dimColor>
              • Windows: Ctrl+Z (그리고 Enter)
            </Text>
            <Text color="gray" dimColor>
              예: "3 4" 입력 → Enter → Ctrl+D
            </Text>
          </Box>
        </Box>
      );
    }
    return (
      <Box flexDirection="column">
        <Spinner label="코드 실행 중..." />
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box flexDirection="column">
        <Alert variant="error">실행 실패{error ? `: ${error}` : ''}</Alert>
      </Box>
    );
  }

  if (result) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="cyan" bold>
            실행 결과
          </Text>
          <Text color="gray">
            {problemDir} • {language}
            {result.timedOut && ' • 타임아웃'}
          </Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          {result.timedOut ? (
            <StatusMessage variant="warning">
              실행 시간이 초과되었습니다.
            </StatusMessage>
          ) : result.exitCode !== 0 ? (
            <StatusMessage variant="error">
              프로그램이 비정상 종료되었습니다 (exit code: {result.exitCode})
            </StatusMessage>
          ) : (
            <StatusMessage variant="success">실행 완료</StatusMessage>
          )}
          {result.input && (
            <Box marginTop={1} flexDirection="column">
              <Text color="gray" dimColor>
                입력:
              </Text>
              <Text>{result.input.trim()}</Text>
            </Box>
          )}
          {result.stdout && (
            <Box marginTop={1} flexDirection="column">
              <Text color="gray" dimColor>
                출력:
              </Text>
              <Text>{result.stdout.trim()}</Text>
            </Box>
          )}
          {result.stderr && (
            <Box marginTop={1} flexDirection="column">
              <Text color="yellow" dimColor>
                에러 출력:
              </Text>
              <Text color="yellow">{result.stderr}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="gray">실행 시간: {result.durationMs}ms</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return null;
}

@CommandDef({
  name: 'run',
  description: `코드를 실행합니다 (테스트 없이).
- 현재 디렉토리 또는 지정한 문제 번호의 코드 실행
- solution.* 파일을 자동으로 찾아 언어 감지
- --input 옵션으로 입력 파일 지정 가능 (예: testcases/1/input.txt)
- 옵션 없이 실행 시 표준 입력으로 입력 받기
- 테스트 케이스 검증 없이 단순 실행`,
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
      name: 'input',
      options: {
        shortFlag: 'i',
        description: '입력 파일 지정 (예: 1 또는 testcases/1/input.txt)',
      },
    },
  ],
  autoDetectProblemId: true,
  autoDetectLanguage: true,
  examples: [
    'run                              # 현재 디렉토리에서 표준 입력으로 실행',
    'run 1000                          # 1000번 문제 표준 입력으로 실행',
    'run --language python             # Python으로 표준 입력으로 실행',
    'run --input 1                     # 테스트 케이스 1번 사용',
    'run --input testcases/1/input.txt # 전체 경로로 입력 파일 지정',
  ],
})
export class RunCommand extends Command {
  async execute(args: string[], flags: CommandFlags): Promise<void> {
    // 문제 컨텍스트 해석
    const context = await resolveProblemContext(args);

    // 입력 파일 찾기 (옵션이 있을 때만)
    let inputPath: string | undefined;
    if (flags.input) {
      const inputValue = flags.input as string;
      // 숫자만 입력된 경우 testcases/{숫자}/input.txt로 변환
      if (/^\d+$/.test(inputValue)) {
        inputPath = join(
          context.archiveDir,
          'testcases',
          inputValue,
          'input.txt',
        );
      } else {
        // 전체 경로가 입력된 경우 그대로 사용
        inputPath = join(context.archiveDir, inputValue);
      }
    }

    // 언어 감지
    const detectedLanguage = await resolveLanguage(
      context.archiveDir,
      flags.language as Language | undefined,
    );

    await this.renderView(RunView, {
      problemDir: context.archiveDir,
      language: detectedLanguage,
      inputFile: inputPath,
    });
  }
}

export default CommandBuilder.fromClass(RunCommand);
