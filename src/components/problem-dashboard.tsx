import { Box, Text } from "ink";
import React from "react";

import type { Problem } from "../types/index";
import { getTierName, getTierColor } from "../utils/tier";

interface ProblemDashboardProps {
  problem: Problem;
}

export function ProblemDashboard({ problem }: ProblemDashboardProps) {
  const tierName = getTierName(problem.level);
  const tierColor = getTierColor(problem.level);
  // borderColor는 string이 필요하므로 첫 번째 색상 사용
  const borderColorString =
    typeof tierColor === "string" ? tierColor : "#ff7ca8";
  // 텍스트 색상도 동일하게 사용
  const textColorString = borderColorString;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColorString}
      paddingX={1}
      alignSelf="flex-start"
    >
      <Text bold color={textColorString}>
        {tierName}{" "}
        <Text color="white">
          #{problem.id}: {problem.title}
        </Text>
      </Text>
    </Box>
  );
}
