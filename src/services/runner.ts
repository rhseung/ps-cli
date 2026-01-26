import { readFile } from 'fs/promises';
import { join } from 'path';
import { createInterface } from 'readline';

import { execaCommand } from 'execa';

import type { Language } from '../core';
import { getLanguageConfig, findSolutionFile } from '../core';

export interface RunSolutionParams {
  problemDir: string;
  language: Language;
  inputPath?: string;
  timeoutMs?: number;
  solutionPath?: string; // 특정 solution 파일 경로 (지정하지 않으면 자동으로 찾음)
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  input?: string;
}

/**
 * 표준 입력에서 모든 내용을 읽어옵니다.
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on('line', (line) => {
      lines.push(line);
    });

    rl.on('close', () => {
      resolve(lines.join('\n'));
    });
  });
}

export async function runSolution({
  problemDir,
  language,
  inputPath,
  timeoutMs = 5000,
  solutionPath: providedSolutionPath,
}: RunSolutionParams): Promise<RunResult> {
  // solution 파일 경로 결정
  let solutionPath: string;
  if (providedSolutionPath) {
    // 절대 경로인지 확인
    if (providedSolutionPath.startsWith('/') || providedSolutionPath.match(/^[A-Z]:/)) {
      solutionPath = providedSolutionPath;
    } else {
      // 상대 경로인 경우 problemDir 기준으로 해석
      solutionPath = join(problemDir, providedSolutionPath);
    }
  } else {
    // 자동으로 가장 최근 파일 찾기
    solutionPath = await findSolutionFile(problemDir, language);
  }

  const langConfig = getLanguageConfig(language);

  // 표준 입력을 받는 경우 먼저 읽기
  let input: string | undefined;
  let capturedInput: string | undefined;
  if (inputPath) {
    input = await readFile(inputPath, 'utf-8');
    capturedInput = input;
  } else {
    // 표준 입력 읽기 (TTY 또는 파이프 모두 지원)
    // 사용자가 Ctrl+D를 누르면 입력 완료
    capturedInput = await readStdin();
    input = capturedInput;
  }

  const start = Date.now();

  try {
    if (langConfig.compileCommand) {
      await execaCommand(langConfig.compileCommand, {
        cwd: problemDir,
        timeout: timeoutMs,
      });
    }

    const child = execaCommand(`${langConfig.runCommand} ${solutionPath}`, {
      cwd: problemDir,
      ...(input !== undefined ? { input } : { stdin: 'inherit' }),
      timeout: timeoutMs,
    });

    const result = await child;
    const exitCode = result.exitCode ?? null;
    const { stdout, stderr } = result;
    const durationMs = Date.now() - start;

    return {
      stdout,
      stderr,
      exitCode,
      timedOut: false,
      durationMs,
      ...(capturedInput !== undefined && { input: capturedInput }),
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    if (error instanceof Error && 'timedOut' in error) {
      const err = error as Error & {
        timedOut?: boolean;
        stdout?: string;
        stderr?: string;
        shortMessage?: string;
        exitCode?: number | null;
      };
      return {
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? err.shortMessage ?? err.message,
        exitCode: err.exitCode ?? null,
        timedOut: Boolean(err.timedOut),
        durationMs,
        ...(capturedInput !== undefined && { input: capturedInput }),
      };
    }

    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: null,
      timedOut: false,
      durationMs,
    };
  }
}
