import chalk from "chalk";
import { Box, Text, Transform } from "ink";
import React from "react";

import type { Problem } from "../types/index";
import { getTierName, getTierColor } from "../utils/tier";

interface ProblemDashboardProps {
  problem: Problem;
}

export function ProblemDashboard({ problem }: ProblemDashboardProps) {
  const tierName = getTierName(problem.level);
  const tierColor = getTierColor(problem.level);
  const tierColorFn =
    typeof tierColor === "string" ? chalk.hex(tierColor) : tierColor.multiline;
  // borderColor는 string이 필요하므로 첫 번째 색상 사용
  const borderColorString =
    typeof tierColor === "string" ? tierColor : "#ff7ca8";

  return (
    <Transform transform={(output) => tierColorFn(output)}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={borderColorString}
        paddingX={1}
        alignSelf="flex-start"
      >
        <Text bold>
          {tierName}{" "}
          <Text color="white">
            #{problem.id}: {problem.title}
          </Text>
        </Text>
      </Box>
    </Transform>
  );
}
