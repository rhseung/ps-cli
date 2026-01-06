import React, { useEffect, useState } from "react";
import { render, Box, Text } from "ink";
import { getUserStats } from "../services/solved-api";
import { LoadingSpinner } from "../components/spinner";
import { getSolvedAcHandle } from "../utils/config";
import { TIER_COLORS, getTierColor, getTierName } from "../utils/tier";
import chalk from "chalk";
import type { SolvedAcUser } from "../types";
import type { CommandDefinition } from "../types/command";
import gradient from "gradient-string";

interface StatsCommandProps {
  handle: string;
  onComplete: () => void;
}

function StatsCommand({ handle, onComplete }: StatsCommandProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [user, setUser] = useState<SolvedAcUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getUserStats(handle)
      .then((userData) => {
        setUser(userData);
        setStatus("success");
        setTimeout(() => {
          onComplete();
        }, 5000);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
        setTimeout(() => {
          onComplete();
        }, 3000);
      });
  }, [handle, onComplete]);

  if (status === "loading") {
    return (
      <Box flexDirection="column">
        <LoadingSpinner message="통계를 불러오는 중..." />
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ 통계를 불러올 수 없습니다: {error}</Text>
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

        {/* 티어 & 레이팅 (한 줄) */}
        <Box marginBottom={1}>
          <Text>
            {tierDisplay} <Text bold>{user.rating.toLocaleString()}</Text>
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

async function statsCommand(handle: string) {
  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <StatsCommand
        handle={handle}
        onComplete={() => {
          unmount();
          resolve();
        }}
      />
    );
  });
}

export const statsHelp = `
  사용법:
    $ ps stats [핸들] [옵션]

  설명:
    Solved.ac에서 사용자 통계를 조회합니다.
    - 티어, 레이팅, 해결한 문제 수 등 표시
    - 그라데이션으로 시각적으로 표시

  옵션:
    --handle, -h      Solved.ac 핸들 (설정에 저장된 값 사용 가능)

  예제:
    $ ps stats myhandle
    $ ps stats --handle myhandle
`;

export async function statsExecute(
  args: string[],
  flags: { handle?: string; help?: boolean }
): Promise<void> {
  if (flags.help) {
    console.log(statsHelp.trim());
    process.exit(0);
    return;
  }

  // 핸들 결정: 인자 > 플래그 > 설정
  let handle: string | undefined = args[0] || flags.handle;

  if (!handle) {
    handle = getSolvedAcHandle();
  }

  if (!handle) {
    console.error("오류: Solved.ac 핸들을 입력해주세요.");
    console.error(`사용법: ps stats <핸들>`);
    console.error(`도움말: ps stats --help`);
    console.error(`힌트: 설정에 핸들을 저장하면 매번 입력할 필요가 없습니다.`);
    process.exit(1);
  }

  await statsCommand(handle);
}

const statsCommandDef: CommandDefinition = {
  name: "stats",
  help: statsHelp,
  execute: statsExecute,
};

export default statsCommandDef;
