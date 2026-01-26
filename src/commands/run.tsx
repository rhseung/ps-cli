import { join } from 'path';

import { StatusMessage, Alert } from '@inkjs/ui';
import { Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';

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
  icons,
  type Language,
} from '../core';
import { useRunSolution } from '../hooks/use-run-solution';
import type {
  InferFlagsFromSchema,
  FlagDefinitionSchema,
} from '../types/command';
import { defineFlags } from '../types/command';

// 플래그 정의 스키마 (타입 추론용)
const runFlagsSchema = {
  language: {
    type: 'string' as const,
    shortFlag: 'l',
    description: `언어 선택 (지정 시 자동 감지 무시)
                        지원 언어: ${getSupportedLanguagesString()}`,
  },
  input: {
    type: 'string' as const,
    shortFlag: 'i',
    description: '입력 파일 지정 (예: 1 또는 testcases/1/input.txt)',
  },
  file: {
    type: 'string' as const,
    shortFlag: 'f',
    description: '특정 solution 파일 지정 (예: solution-2.py)',
  },
  index: {
    type: 'string' as const,
    description: '인덱스로 solution 파일 지정 (예: 2)',
  },
} as const satisfies FlagDefinitionSchema;

type RunCommandFlags = InferFlagsFromSchema<typeof runFlagsSchema>;

interface RunViewProps {
  problemDir: string;
  language: Language;
  inputFile?: string;
  onComplete: () => void;
  solutionPath?: string; // 실행에 사용할 solution 파일 경로
}

function RunView({
  problemDir,
  language,
  inputFile,
  onComplete,
  solutionPath,
}: RunViewProps) {
  const { status, result, error } = useRunSolution({
    problemDir,
    language,
    inputFile,
    onComplete,
    solutionPath,
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
              {icons.solving} macOS/Linux: Ctrl+D
            </Text>
            <Text color="gray" dimColor>
              {icons.solving} Windows: Ctrl+Z (그리고 Enter)
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
            {problemDir} {icons.solving} {language}
            {result.timedOut && ` ${icons.solving} 타임아웃`}
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
- 테스트 케이스 검증 없이 단순 실행
- 기본 언어 등은 ps config에서 설정 가능합니다.`,
  flags: defineFlags(runFlagsSchema),
  autoDetectProblemId: true,
  autoDetectLanguage: true,
  examples: [
    'run                              # 현재 디렉토리에서 표준 입력으로 실행',
    'run 1000                          # 1000번 문제 표준 입력으로 실행',
    'run --language python             # Python으로 표준 입력으로 실행',
    'run --input 1                     # 테스트 케이스 1번 사용',
    'run --input testcases/1/input.txt # 전체 경로로 입력 파일 지정',
    'run --file solution-2.py          # 특정 파일로 실행',
    'run --index 2                     # 인덱스 2의 파일로 실행',
  ],
})
export class RunCommand extends Command<RunCommandFlags> {
  async execute(args: string[], flags: RunCommandFlags): Promise<void> {
    // 문제 컨텍스트 해석
    const context = await resolveProblemContext(args);

    // 솔루션 파일 경로 결정 및 언어 감지
    let solutionPath: string | undefined;
    let detectedLanguage: Language;

    if (flags.file) {
      // --file 플래그로 특정 파일 지정
      const filePath = flags.file as string;
      if (filePath.startsWith('/') || filePath.match(/^[A-Z]:/)) {
        solutionPath = filePath;
      } else {
        // 상대 경로인 경우 파일명만 지정된 것으로 간주
        solutionPath = join(context.archiveDir, filePath);
      }

      // 파일명에서 언어 감지
      const fileName = solutionPath.split(/[/\\]/).pop() || '';
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
        solutionPath = await findSolutionFileByIndex(
          context.archiveDir,
          index,
          detectedLanguage,
        );
      } else {
        // 언어가 없으면 모든 파일에서 찾기
        const files = await findSolutionFiles(context.archiveDir);
        const targetFile = files.find((f) => f.index === index);
        if (!targetFile) {
          throw new Error(`인덱스 ${index}의 solution 파일을 찾을 수 없습니다.`);
        }
        solutionPath = targetFile.path;
        detectedLanguage = targetFile.language as Language;
      }
    } else {
      // 기본값: 언어 감지 후 가장 최근 파일 찾기
      detectedLanguage = await resolveLanguage(
        context.archiveDir,
        flags.language as Language | undefined,
      );
      // solutionPath는 undefined로 두어 runner에서 자동으로 찾도록 함
    }

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

    await this.renderView(RunView, {
      problemDir: context.archiveDir,
      language: detectedLanguage,
      inputFile: inputPath,
      solutionPath,
    });
  }
}

export default CommandBuilder.fromClass(RunCommand);
