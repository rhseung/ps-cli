import { Alert } from "@inkjs/ui";
import { Spinner } from "@inkjs/ui";
import chalk from "chalk";
import gradient from "gradient-string";
import { Box, Text } from "ink";
import React from "react";

import { Command } from "../core/base-command";
import { CommandDef, CommandBuilder } from "../core/command-builder";
import { useUserStats } from "../hooks/use-user-stats";
import type { CommandFlags } from "../types/command";
import { getSolvedAcHandle } from "../utils/config";
import { getTierColor, getTierName } from "../utils/tier";

interface StatsViewProps {
  handle: string;
  onComplete: () => void;
}

function StatsView({ handle, onComplete }: StatsViewProps) {
  const { status, user, error } = useUserStats({
    handle,
    onComplete,
  });

  if (status === "loading") {
    return (
      <Box flexDirection="column">
        <Spinner label="통계를 불러오는 중..." />
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box flexDirection="column">
        <Alert variant="error">통계를 불러올 수 없습니다: {error}</Alert>
      </Box>
    );
  }

  if (user) {
    const tierName = getTierName(user.tier);
    const tierDisplay =
      user.tier === 31
        ? gradient([
            { r: 255, g: 124, b: 168 },
            { r: 180, g: 145, b: 255 },
            { r: 124, g: 249, b: 255 },
          ])(tierName)
        : chalk.hex(getTierColor(user.tier))(tierName);

    return (
      <Box flexDirection="column">
        {/* 헤더 */}
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            ✨ {user.handle}
          </Text>
        </Box>

        {/* 통계 정보 */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          alignSelf="flex-start"
        >
          <Box paddingX={1} paddingY={0} flexDirection="column">
            <Text>
              {tierDisplay} <Text bold>{user.rating.toLocaleString()}</Text>
            </Text>
            <Text>
              해결한 문제:{" "}
              <Text bold color="green">
                {user.solvedCount.toLocaleString()}
              </Text>
              개
            </Text>
            <Text>
              클래스: <Text bold>{user.class}</Text>
            </Text>
            {user.maxStreak > 0 && (
              <Text>
                최대 연속 해결:{" "}
                <Text bold color="cyan">
                  {user.maxStreak}
                </Text>
                일
              </Text>
            )}
            <Text>
              순위: <Text bold>{user.rank.toLocaleString()}</Text>위
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return null;
}

@CommandDef({
  name: "stats",
  description: `Solved.ac에서 사용자 통계를 조회합니다.
- 티어, 레이팅, 해결한 문제 수 등 표시
- 그라데이션으로 시각적으로 표시`,
  flags: [
    {
      name: "handle",
      options: {
        shortFlag: "h",
        description: "Solved.ac 핸들 (설정에 저장된 값 사용 가능)",
      },
    },
  ],
  autoDetectProblemId: false,
  examples: ["stats myhandle", "stats --handle myhandle"],
})
export class StatsCommand extends Command {
  async execute(args: string[], flags: CommandFlags): Promise<void> {
    // 핸들 결정: 인자 > 플래그 > 설정
    let handle: string | undefined =
      args[0] || (flags.handle as string | undefined);

    if (!handle) {
      handle = getSolvedAcHandle();
    }

    if (!handle) {
      console.error("오류: Solved.ac 핸들을 입력해주세요.");
      console.error(`사용법: ps stats <핸들>`);
      console.error(`도움말: ps stats --help`);
      console.error(
        `힌트: 설정에 핸들을 저장하면 매번 입력할 필요가 없습니다.`,
      );
      process.exit(1);
      return;
    }

    await this.renderView(StatsView, {
      handle,
    });
  }
}

export default CommandBuilder.fromClass(StatsCommand);
