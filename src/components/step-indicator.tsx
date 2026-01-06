import React from "react";
import { Box, Text } from "ink";

export type StepStatus = "completed" | "current" | "pending" | "cancelled";

export interface Step {
  label: string;
  status: StepStatus;
  value?: string; // 완료된 step의 답변 값
  error?: string; // 취소 메시지 등
}

interface StepIndicatorProps {
  steps: Step[];
  currentStepIndex?: number;
  children?: React.ReactNode; // 현재 step의 input 컴포넌트
}

export function StepIndicator({
  steps,
  currentStepIndex,
  children,
}: StepIndicatorProps) {
  // pending step들은 필터링 (현재 step까지만 표시)
  const visibleSteps = steps
    .map((step, index) => ({ step, index }))
    .filter(
      ({ step, index }) =>
        step.status !== "pending" ||
        (currentStepIndex !== undefined && index === currentStepIndex)
    );

  return (
    <Box flexDirection="column">
      {visibleSteps.map(({ step, index: originalIndex }, visibleIndex) => {
        const isLast = visibleIndex === visibleSteps.length - 1;
        const nextStep = !isLast ? visibleSteps[visibleIndex + 1] : null;
        const showLine =
          !isLast &&
          step.status !== "cancelled" &&
          nextStep?.step.status !== "cancelled";
        const isCurrentStep =
          currentStepIndex !== undefined && originalIndex === currentStepIndex;

        let bullet: string;
        let bulletColor: string;
        let textColor: string = "white";

        switch (step.status) {
          case "completed":
            bullet = "◇";
            bulletColor = "green";
            textColor = "white";
            break;
          case "current":
            bullet = "◆";
            bulletColor = "yellow";
            textColor = "yellow";
            break;
          case "cancelled":
            bullet = "■";
            bulletColor = "red";
            textColor = "red";
            break;
          case "pending":
          default:
            bullet = "◇";
            bulletColor = "gray";
            textColor = "gray";
            break;
        }

        return (
          <Box key={originalIndex} flexDirection="column">
            {/* Step label과 bullet */}
            <Box flexDirection="row">
              <Box flexDirection="column" width={3}>
                <Text color={bulletColor}>{bullet}</Text>
                {showLine && !isCurrentStep && <Text color="gray">│</Text>}
              </Box>
              <Box flexDirection="column" flexGrow={1}>
                <Text color={textColor}>{step.label}</Text>
              </Box>
            </Box>

            {/* 완료된 step의 value 표시 */}
            {step.status === "completed" && step.value && (
              <Box flexDirection="row">
                <Box width={3}>
                  <Text color="gray">│ </Text>
                </Box>
                <Box flexGrow={1}>
                  <Text color="white">{step.value}</Text>
                </Box>
              </Box>
            )}

            {/* 취소된 step의 error 표시 */}
            {step.status === "cancelled" && step.error && (
              <Box flexDirection="row">
                <Box width={3}>
                  <Text color="gray">│</Text>
                </Box>
                <Box flexGrow={1}>
                  <Text color="red">{step.error}</Text>
                </Box>
              </Box>
            )}

            {/* 현재 step의 input 영역 */}
            {isCurrentStep && children && (
              <Box flexDirection="column">
                {/* label과 input 사이의 빈 줄 (vertical line은 계속) */}
                <Box flexDirection="row">
                  <Box width={3}>
                    <Text color="gray">│</Text>
                  </Box>
                </Box>
                {children}
                {/* 마지막에 L자 꺾임 */}
                {showLine && (
                  <Box flexDirection="row">
                    <Box width={3}>
                      <Text color="gray">└</Text>
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {/* 다음 step으로 이어지는 line (현재 step이 아니고 children이 없을 때) */}
            {showLine && !isCurrentStep && (
              <Box flexDirection="row">
                <Box width={3}>
                  <Text color="gray">│</Text>
                </Box>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
