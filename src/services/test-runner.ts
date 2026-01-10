import { readdir, readFile } from "fs/promises";
import { join } from "path";

import type { TestResult, TestSummary } from "../types";
import type { Language } from "../utils/language";

import { compareOutput } from "./diff-checker";
import { runSolution } from "./runner";

export interface RunAllTestsOptions {
  problemDir: string;
  language: Language;
  timeoutMs?: number;
}

export interface RunAllTestsResult {
  results: TestResult[];
  summary: TestSummary;
}

function buildSummary(results: TestResult[]): TestSummary {
  const summary: TestSummary = {
    total: results.length,
    passed: 0,
    failed: 0,
    errored: 0,
  };

  for (const r of results) {
    if (r.status === "pass") summary.passed += 1;
    else if (r.status === "fail") summary.failed += 1;
    else summary.errored += 1;
  }

  return summary;
}

export async function runAllTests({
  problemDir,
  language,
  timeoutMs,
}: RunAllTestsOptions): Promise<RunAllTestsResult> {
  const entries = await readdir(problemDir);
  const inputFiles = entries.filter((f) => /^input\d+\.txt$/.test(f));

  const results: TestResult[] = [];

  // 문제 메타데이터에서 시간 제한(ms)을 우선적으로 사용
  let effectiveTimeout: number | undefined = timeoutMs;
  if (effectiveTimeout == null) {
    try {
      const metaRaw = await readFile(join(problemDir, "meta.json"), "utf-8");
      const meta = JSON.parse(metaRaw) as {
        timeLimitMs?: number;
        timeLimit?: string;
      };
      if (typeof meta.timeLimitMs === "number") {
        effectiveTimeout = meta.timeLimitMs;
      } else if (typeof meta.timeLimit === "string") {
        const match = meta.timeLimit.match(/([\d.]+)/);
        if (match) {
          const seconds = parseFloat(match[1]);
          if (!Number.isNaN(seconds)) {
            effectiveTimeout = Math.round(seconds * 1000);
          }
        }
      }
    } catch {
      // meta.json 이 없거나 파싱 실패 시 이후 기본값 사용
    }
  }

  if (effectiveTimeout == null) {
    effectiveTimeout = 5000;
  }

  for (const inputFile of inputFiles) {
    const match = inputFile.match(/input(\d+)\.txt$/);
    const caseId = match ? Number(match[1]) : results.length + 1;
    const inputPath = join(problemDir, inputFile);
    const outputPath = join(problemDir, `output${caseId}.txt`);

    // 기대 출력 읽기
    let expected: string | undefined;
    try {
      expected = await readFile(outputPath, "utf-8");
    } catch {
      results.push({
        caseId,
        inputPath,
        status: "error",
        error: "기대 출력(output*.txt)을 찾을 수 없습니다.",
      });
      continue;
    }

    const runResult = await runSolution({
      problemDir,
      language,
      inputPath,
      timeoutMs: effectiveTimeout,
    });

    // 실행 에러 처리
    if (runResult.exitCode !== 0 || runResult.timedOut) {
      results.push({
        caseId,
        inputPath,
        expected,
        actual: runResult.stdout,
        error: runResult.timedOut
          ? `시간 초과 (timeout ${effectiveTimeout}ms)`
          : runResult.stderr || "실행 에러",
        status: "error",
        durationMs: runResult.durationMs,
      });
      continue;
    }

    const diff = compareOutput(expected ?? "", runResult.stdout);
    results.push({
      caseId,
      inputPath,
      expected: diff.expected,
      actual: diff.actual,
      status: diff.pass ? "pass" : "fail",
      durationMs: runResult.durationMs,
    });
  }

  return { results, summary: buildSummary(results) };
}
