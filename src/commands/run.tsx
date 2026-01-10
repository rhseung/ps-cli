import { readdir } from "fs/promises";
import { join } from "path";

import { StatusMessage, Alert } from "@inkjs/ui";
import { Spinner } from "@inkjs/ui";
import { Box, Text } from "ink";

import { Command } from "../core/base-command";
import { CommandDef, CommandBuilder } from "../core/command-builder";
import { useRunSolution } from "../hooks/use-run-solution";
import type { CommandFlags } from "../types/command";
import {
  resolveProblemContext,
  resolveLanguage,
} from "../utils/execution-context";
import { getSupportedLanguagesString, type Language } from "../utils/language";
import { getProblemId } from "../utils/problem-id";

interface RunViewProps {
  problemDir: string;
  language: Language;
  inputFile: string;
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

  if (status === "loading") {
    return (
      <Box flexDirection="column">
        <Spinner label="코드 실행 중..." />
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box flexDirection="column">
        <Alert variant="error">실행 실패{error ? `: ${error}` : ""}</Alert>
      </Box>
    );
  }

  if (result) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            실행 결과
          </Text>
          <Text color="gray">
            {problemDir} • {language}
            {result.timedOut && " • 타임아웃"}
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
          {result.stdout && (
            <Box marginTop={1} flexDirection="column">
              <Text color="gray" dimColor>
                출력:
              </Text>
              <Text>{result.stdout}</Text>
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
  name: "run",
  description: `코드를 실행합니다 (테스트 없이).
- 현재 디렉토리 또는 지정한 문제 번호의 코드 실행
- solution.* 파일을 자동으로 찾아 언어 감지
- input.txt 또는 input1.txt를 표준 입력으로 사용
- 테스트 케이스 검증 없이 단순 실행`,
  flags: [
    {
      name: "language",
      options: {
        shortFlag: "l",
        description: `언어 선택 (지정 시 자동 감지 무시)
                        지원 언어: ${getSupportedLanguagesString()}`,
      },
    },
    {
      name: "input",
      options: {
        shortFlag: "i",
        description: "입력 파일 지정 (기본값: input.txt 또는 input1.txt)",
      },
    },
  ],
  autoDetectProblemId: true,
  autoDetectLanguage: true,
  examples: [
    "run                    # 현재 디렉토리에서 실행",
    "run 1000               # 1000번 문제 실행",
    "run --language python  # Python으로 실행",
    "run --input input2.txt # 특정 입력 파일 사용",
  ],
})
export class RunCommand extends Command {
  async execute(args: string[], flags: CommandFlags): Promise<void> {
    const problemId = getProblemId(args);

    // 문제 컨텍스트 해석
    const context = await resolveProblemContext(
      problemId !== null ? [problemId.toString()] : [],
    );

    // 입력 파일 찾기
    const inputPath = flags.input
      ? join(context.problemDir, flags.input as string)
      : await this.findInputFile(context.problemDir);

    // 언어 감지
    const detectedLanguage = await resolveLanguage(
      context.problemDir,
      flags.language as Language | undefined,
    );

    await this.renderView(RunView, {
      problemDir: context.problemDir,
      language: detectedLanguage,
      inputFile: inputPath,
    });
  }

  // 입력 파일 찾기: private 메서드
  private async findInputFile(problemDir: string): Promise<string> {
    const files = await readdir(problemDir);
    // input1.txt, input.txt 순서로 찾기
    const inputFile =
      files.find((f) => f === "input1.txt") ||
      files.find((f) => f === "input.txt");
    if (!inputFile) {
      throw new Error("input.txt 또는 input1.txt 파일을 찾을 수 없습니다.");
    }
    return join(problemDir, inputFile);
  }
}

export default CommandBuilder.fromClass(RunCommand);
