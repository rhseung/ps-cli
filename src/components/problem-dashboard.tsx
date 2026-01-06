import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import type { Problem } from "../types/index";
import { getTierName, getTierColor } from "../utils/tier";

interface ProblemDashboardProps {
  problem: Problem;
}

export function ProblemDashboard({ problem }: ProblemDashboardProps) {
  const tierName = getTierName(problem.level);
  const tierColor = getTierColor(problem.level);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={tierColor}
      paddingX={1}
      alignSelf="flex-start"
    >
      <Text bold>
        {chalk.hex(tierColor)(tierName)}{" "}
        <Text color="white">
          #{problem.id}: {problem.title}
        </Text>
      </Text>

      {(problem.timeLimit || problem.memoryLimit) && (
        <Box marginTop={1}>
          {problem.timeLimit && (
            <Text color="yellow">⏱️ {problem.timeLimit}</Text>
          )}
          {problem.timeLimit && problem.memoryLimit && <Text> </Text>}
          {problem.memoryLimit && (
            <Text color="cyan">💾 {problem.memoryLimit}</Text>
          )}
        </Box>
      )}

      {problem.tags.length > 0 && (
        <Box marginTop={1}>
          <Text color="gray">태그: </Text>
          <Text>{problem.tags.join(", ")}</Text>
        </Box>
      )}

      {problem.testCases.length > 0 && (
        <Box marginTop={1}>
          <Text color="green">✓ 예제 {problem.testCases.length}개</Text>
        </Box>
      )}
    </Box>
  );
}
