import React from "react";
import { Box, Text } from "ink";
import type { TestResult, TestSummary } from "../types";

interface TestResultProps {
  summary: TestSummary;
  results: TestResult[];
}

function truncate(text = "", max = 200) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function ResultRow({ result }: { result: TestResult }) {
  const statusIcon =
    result.status === "pass" ? "✓" : result.status === "fail" ? "✗" : "!";
  const statusColor =
    result.status === "pass"
      ? "green"
      : result.status === "fail"
      ? "red"
      : "yellow";
  const statusText =
    result.status === "pass"
      ? "PASS"
      : result.status === "fail"
      ? "FAIL"
      : "ERROR";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={statusColor} bold>
          {statusIcon}
        </Text>
        <Text> </Text>
        <Text color={statusColor} bold>
          {statusText}
        </Text>
        <Text> </Text>
        <Text>케이스 {result.caseId}</Text>
        {result.durationMs !== undefined && (
          <>
            <Text> </Text>
            <Text color="cyan">({formatDuration(result.durationMs)})</Text>
          </>
        )}
      </Box>
      {result.status === "fail" && (
        <Box flexDirection="column" marginLeft={3} marginTop={1}>
          <Box flexDirection="column" marginBottom={1}>
            <Text color="gray">기대값:</Text>
            <Text>{truncate(result.expected ?? "")}</Text>
          </Box>
          <Box flexDirection="column">
            <Text color="gray">실제값:</Text>
            <Text>{truncate(result.actual ?? "")}</Text>
          </Box>
        </Box>
      )}
      {result.status === "error" && (
        <Box flexDirection="column" marginLeft={3} marginTop={1}>
          <Text color="yellow">{result.error ?? "알 수 없는 오류"}</Text>
          {result.stderr && (
            <Text color="gray" dimColor>
              {truncate(result.stderr)}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

export function TestResultView({ summary, results }: TestResultProps) {
  const allPassed = summary.failed === 0 && summary.errored === 0;
  const summaryColor = allPassed ? "green" : "red";

  return (
    <Box flexDirection="column">
      <Box
        borderStyle="round"
        borderColor={summaryColor}
        paddingX={1}
        alignSelf="flex-start"
        flexDirection="column"
      >
        <Box>
          <Text bold>테스트 결과</Text>
        </Box>
        <Box marginTop={1}>
          <Text>
            총 <Text bold>{summary.total}</Text>개
          </Text>
          <Text> | </Text>
          <Text color="green">
            Pass <Text bold>{summary.passed}</Text>
          </Text>
          {summary.failed > 0 && (
            <>
              <Text> | </Text>
              <Text color="red">
                Fail <Text bold>{summary.failed}</Text>
              </Text>
            </>
          )}
          {summary.errored > 0 && (
            <>
              <Text> | </Text>
              <Text color="yellow">
                Error <Text bold>{summary.errored}</Text>
              </Text>
            </>
          )}
        </Box>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {results.map((r) => (
          <ResultRow key={r.caseId} result={r} />
        ))}
      </Box>
    </Box>
  );
}
