import { readFile } from "fs/promises";
import { join } from "path";

import { execa, execaCommand } from "execa";

import type { Language } from "../utils/language";
import { getLanguageConfig } from "../utils/language";

export interface RunSolutionParams {
  problemDir: string;
  language: Language;
  inputPath: string;
  timeoutMs?: number;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

export async function runSolution({
  problemDir,
  language,
  inputPath,
  timeoutMs = 5000,
}: RunSolutionParams): Promise<RunResult> {
  const langConfig = getLanguageConfig(language);
  const solutionFile = `solution.${langConfig.extension}`;
  const solutionPath = join(problemDir, solutionFile);

  const input = await readFile(inputPath, "utf-8");
  const start = Date.now();

  try {
    if (langConfig.compileCommand) {
      await execaCommand(langConfig.compileCommand, {
        cwd: problemDir,
        timeout: timeoutMs,
      });
    }

    const child = execa(langConfig.runCommand, [solutionPath], {
      cwd: problemDir,
      input,
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
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    if (error instanceof Error && "timedOut" in error) {
      const err = error as Error & {
        timedOut?: boolean;
        stdout?: string;
        stderr?: string;
        shortMessage?: string;
        exitCode?: number | null;
      };
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? err.shortMessage ?? err.message,
        exitCode: err.exitCode ?? null,
        timedOut: Boolean(err.timedOut),
        durationMs,
      };
    }

    return {
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: null,
      timedOut: false,
      durationMs,
    };
  }
}
