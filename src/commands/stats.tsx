import { Alert } from '@inkjs/ui';
import { Spinner } from '@inkjs/ui';
import chalk from 'chalk';
import { Box, Text, Transform } from 'ink';
import React from 'react';

import { Command } from '../core/base-command';
import { CommandDef, CommandBuilder } from '../core/command-builder';
import { useUserStats } from '../hooks/use-user-stats';
import type {
  InferFlagsFromSchema,
  FlagDefinitionSchema,
} from '../types/command';
import { defineFlags } from '../types/command';
import { getSolvedAcHandle } from '../utils/config';
import {
  calculateTierProgress,
  getNextTierMinRating,
  getTierColor,
  getTierName,
  getTierShortName,
} from '../utils/tier';

// 플래그 정의 스키마 (타입 추론용)
const statsFlagsSchema = {
  handle: {
    type: 'string' as const,
    shortFlag: 'h',
    description: 'Solved.ac 핸들 (설정에 저장된 값 사용 가능)',
  },
} as const satisfies FlagDefinitionSchema;

type StatsCommandFlags = InferFlagsFromSchema<typeof statsFlagsSchema>;

interface StatsViewProps {
  handle: string;
  onComplete: () => void;
  showLocalStats: boolean;
}

interface ProgressBarWithColorProps {
  value: number;
  colorFn: (text: string) => string;
}

function ProgressBarWithColor({ value, colorFn }: ProgressBarWithColorProps) {
  const width = process.stdout.columns || 40;
  const barWidth = Math.max(10, Math.min(30, width - 20)); // 최소 10칸, 최대 30칸

  const filled = Math.round((value / 100) * barWidth);
  const empty = barWidth - filled;

  const filledBar = '█'.repeat(filled);
  const emptyBar = '░'.repeat(empty);
  const barText = filledBar + emptyBar;

  return (
    <Transform transform={(output) => colorFn(output)}>
      <Text>{barText}</Text>
    </Transform>
  );
}

function StatsView({ handle, onComplete, showLocalStats }: StatsViewProps) {
  const { status, user, top100, localSolvedCount, error } = useUserStats({
    handle,
    onComplete,
    fetchLocalCount: showLocalStats,
  });

  if (status === 'loading') {
    return (
      <Box flexDirection="column">
        <Spinner label="통계를 불러오는 중..." />
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box flexDirection="column">
        <Alert variant="error">통계를 불러올 수 없습니다: {error}</Alert>
      </Box>
    );
  }

  if (user) {
    const tierName = getTierName(user.tier);
    const tierColor = getTierColor(user.tier);
    const tierColorFn =
      typeof tierColor === 'string'
        ? chalk.hex(tierColor)
        : tierColor.multiline;

    // 티어 승급 프로그레스 계산
    const nextTierMin = getNextTierMinRating(user.tier);
    const progress =
      user.tier === 31 ? 100 : calculateTierProgress(user.rating, user.tier);

    return (
      <Box flexDirection="column">
        {/* 헤더 */}
        <Box marginBottom={1} flexDirection="column">
          <Text color="cyan" bold>
            ✨ {user.handle}
          </Text>
          <Text color="blue" underline>
            https://solved.ac/profile/{user.handle}
          </Text>
        </Box>

        {/* 티어 정보 (박스 밖) */}
        <Box marginBottom={1} flexDirection="row" gap={1}>
          <Text>
            {tierColorFn(tierName)}{' '}
            <Text bold>{tierColorFn(user.rating.toLocaleString())}</Text>
            {nextTierMin !== null && (
              <Text bold>{' / ' + nextTierMin.toLocaleString()}</Text>
            )}
          </Text>
        </Box>

        {/* 프로그레스 바 */}
        <Box flexDirection="column" marginBottom={1}>
          <ProgressBarWithColor value={progress} colorFn={tierColorFn} />
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
              해결한 문제:{' '}
              <Text bold color="green">
                {user.solvedCount.toLocaleString()}
              </Text>
              개
              {localSolvedCount !== null && (
                <Text color="gray"> (로컬: {localSolvedCount}개)</Text>
              )}
            </Text>
            <Text>
              클래스: <Text bold>{user.class}</Text>
            </Text>
            {user.maxStreak > 0 && (
              <Text>
                최대 연속 해결:{' '}
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

        {/* 상위 100문제 티어 분포 */}
        {top100 && top100.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Box marginBottom={1}>
              <Text bold color="yellow">
                🏆 상위 100문제 티어 분포
              </Text>
            </Box>
            <Box flexDirection="column">
              {Array.from({ length: Math.ceil(top100.length / 10) }).map(
                (_, rowIndex) => (
                  <Box key={rowIndex} flexDirection="row">
                    {top100
                      .slice(rowIndex * 10, (rowIndex + 1) * 10)
                      .map((p, colIndex) => {
                        const tierColor = getTierColor(p.level);
                        const tierColorFn =
                          typeof tierColor === 'string'
                            ? chalk.hex(tierColor)
                            : tierColor.multiline;
                        return (
                          <Box key={colIndex} width={4}>
                            <Text>
                              {tierColorFn(getTierShortName(p.level))}
                            </Text>
                          </Box>
                        );
                      })}
                  </Box>
                ),
              )}
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  return null;
}

@CommandDef({
  name: 'stats',
  description: `Solved.ac에서 사용자 통계를 조회합니다.
- 티어, 레이팅, 해결한 문제 수 등 표시
- 그라데이션으로 시각적으로 표시`,
  flags: defineFlags(statsFlagsSchema),
  autoDetectProblemId: false,
  examples: ['stats myhandle', 'stats --handle myhandle'],
})
export class StatsCommand extends Command<StatsCommandFlags> {
  async execute(args: string[], flags: StatsCommandFlags): Promise<void> {
    // 핸들 결정: 인자 > 플래그 > 설정
    let handle: string | undefined =
      args[0] || (flags.handle as string | undefined);

    if (!handle) {
      handle = getSolvedAcHandle();
    }

    if (!handle) {
      console.error('오류: Solved.ac 핸들을 입력해주세요.');
      console.error(`사용법: ps stats <핸들>`);
      console.error(`도움말: ps stats --help`);
      console.error(
        `힌트: 설정에 핸들을 저장하면 매번 입력할 필요가 없습니다.`,
      );
      process.exit(1);
      return;
    }

    // 핸들을 생략한 경우(자신의 통계를 보는 경우)에만 로컬 통계 표시
    const showLocalStats = !args[0] && !flags.handle;

    await this.renderView(StatsView, {
      handle,
      showLocalStats,
    });
  }
}

export default CommandBuilder.fromClass(StatsCommand);
