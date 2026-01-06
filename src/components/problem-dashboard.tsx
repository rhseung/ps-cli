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
    </Box>
  );
}
