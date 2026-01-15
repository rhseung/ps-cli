import { Alert, Spinner } from '@inkjs/ui';
import { BarChart, StackedBarChart } from '@pppp606/ink-chart';
import chalk from 'chalk';
import { Box, Text } from 'ink';

import {
  Command,
  CommandDef,
  CommandBuilder,
  getSolvedAcHandle,
  calculateTierProgress,
  getNextTierMinRating,
  getTierColor,
  getTierName,
  getTierShortName,
  icons,
  logger,
  TIER_COLORS,
} from '../core';
import { useUserStats } from '../hooks/use-user-stats';
import type {
  InferFlagsFromSchema,
  FlagDefinitionSchema,
} from '../types/command';
import { defineFlags } from '../types/command';

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

function StatsView({ handle, onComplete, showLocalStats }: StatsViewProps) {
  const {
    status,
    user,
    top100,
    problemStats,
    tagRatings,
    bojStats,
    localSolvedCount,
    error,
  } = useUserStats({
    handle,
    onComplete,
    fetchLocalCount: showLocalStats,
  });

  if (status === 'loading') {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Spinner label="통계를 불러오는 중..." />
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box flexDirection="column" paddingY={1}>
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

    // 티어별 분포 데이터 가공
    const tierDistData = problemStats
      ? [
          {
            label: 'Bronze',
            value: problemStats
              .filter((s) => s.level >= 1 && s.level <= 5)
              .reduce((a, b) => a + b.solved, 0),
            color: TIER_COLORS[3]!, // Bronze III
          },
          {
            label: 'Silver',
            value: problemStats
              .filter((s) => s.level >= 6 && s.level <= 10)
              .reduce((a, b) => a + b.solved, 0),
            color: TIER_COLORS[8]!, // Silver III
          },
          {
            label: 'Gold',
            value: problemStats
              .filter((s) => s.level >= 11 && s.level <= 15)
              .reduce((a, b) => a + b.solved, 0),
            color: TIER_COLORS[13]!, // Gold III
          },
          {
            label: 'Platinum',
            value: problemStats
              .filter((s) => s.level >= 16 && s.level <= 20)
              .reduce((a, b) => a + b.solved, 0),
            color: TIER_COLORS[18]!, // Platinum III
          },
          {
            label: 'Diamond',
            value: problemStats
              .filter((s) => s.level >= 21 && s.level <= 25)
              .reduce((a, b) => a + b.solved, 0),
            color: TIER_COLORS[23]!, // Diamond III
          },
          {
            label: 'Ruby',
            value: problemStats
              .filter((s) => s.level >= 26 && s.level <= 30)
              .reduce((a, b) => a + b.solved, 0),
            color: TIER_COLORS[28]!, // Ruby III
          },
          {
            label: 'Master',
            value: problemStats
              .filter((s) => s.level === 31)
              .reduce((a, b) => a + b.solved, 0),
            color: TIER_COLORS[31]!, // Master
          },
        ].filter((d) => d.value > 0)
      : [];

    // 태그 레이팅 데이터 가공 (상위 8개)
    const tagChartData = tagRatings
      ? tagRatings
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 8)
          .map((tr) => ({
            label:
              tr.tag.displayNames.find((dn) => dn.language === 'ko')?.name ||
              tr.tag.key,
            value: tr.rating,
          }))
      : [];

    // 백준 제출 통계
    const bojSummaryData = bojStats
      ? [
          { label: '정답', value: bojStats.accepted, color: 'green' },
          { label: '오답', value: bojStats.wrong, color: 'red' },
          {
            label: 'TLE/MLE',
            value: bojStats.timeout + bojStats.memory,
            color: 'yellow',
          },
          {
            label: '기타',
            value: bojStats.runtimeError + bojStats.compileError,
            color: 'gray',
          },
        ].filter((d) => d.value > 0)
      : [];

    return (
      <Box flexDirection="column" gap={1}>
        {/* 헤더 섹션 */}
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="flex-end"
        >
          <Box flexDirection="column">
            <Text bold>
              {icons.user} {chalk.cyan(user.handle)}
            </Text>
            <Text color="gray">https://solved.ac/profile/{user.handle}</Text>
          </Box>
        </Box>

        {/* 티어 정보 및 프로그레스 */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
        >
          <Box justifyContent="space-between" marginBottom={1}>
            <Box gap={1}>
              <Text bold>{tierColorFn(tierName)}</Text>
              <Text bold>{tierColorFn(user.rating.toLocaleString())}</Text>
              {nextTierMin !== null && (
                <Text dimColor> / {nextTierMin.toLocaleString()}</Text>
              )}
            </Box>
            <Text color="yellow">
              {icons.trophy} Rank #{user.rank.toLocaleString()}
            </Text>
          </Box>
          <StackedBarChart
            data={[
              {
                label: 'Progress',
                value: progress,
                color: typeof tierColor === 'string' ? tierColor : '#ff7ca8',
              },
              ...(progress < 100
                ? [{ label: 'Remaining', value: 100 - progress, color: '#333' }]
                : []),
            ]}
            showLabels={false}
            showValues={false}
            width="full"
          />
        </Box>

        <Box flexDirection="row" gap={2}>
          {/* 상세 수치 통계 */}
          <Box flexDirection="column" flexGrow={1}>
            <Box marginBottom={1}>
              <Text bold color="cyan">
                [ 상세 통계 ]
              </Text>
            </Box>
            <Box flexDirection="column" gap={0}>
              <Text>
                해결한 문제:{' '}
                <Text bold color="green">
                  {user.solvedCount.toLocaleString()}
                </Text>{' '}
                개
              </Text>
              {localSolvedCount !== null && (
                <Text color="gray">
                  {' '}
                  └ 로컬 관리: <Text bold>{localSolvedCount}</Text> 개
                </Text>
              )}
              <Text>
                클래스:{' '}
                <Text bold color="magenta">
                  {user.class}
                  {user.classDecoration === 'gold'
                    ? '++'
                    : user.classDecoration === 'silver'
                      ? '+'
                      : ''}
                </Text>
              </Text>
              <Text>
                최대 스트릭:{' '}
                <Text bold color="orange">
                  {user.maxStreak}
                </Text>{' '}
                일
              </Text>
              <Text>
                기여 횟수:{' '}
                <Text bold color="blue">
                  {user.voteCount}
                </Text>{' '}
                회
              </Text>
            </Box>

            {bojSummaryData.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Box marginBottom={1}>
                  <Text bold color="cyan">
                    [ 백준 제출 요약 ]
                  </Text>
                </Box>
                <StackedBarChart
                  data={bojSummaryData}
                  mode="absolute"
                  width={30}
                />
              </Box>
            )}
          </Box>

          {/* 알고리즘 강점 */}
          {tagChartData.length > 0 && (
            <Box flexDirection="column" width={40}>
              <Box marginBottom={1}>
                <Text bold color="cyan">
                  [ 알고리즘 강점 (Tag Rating) ]
                </Text>
              </Box>
              <BarChart
                data={tagChartData}
                showValue="right"
                barChar="█"
                color="cyan"
              />
            </Box>
          )}
        </Box>

        {/* 티어별 해결 분포 */}
        {tierDistData.length > 0 && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold color="cyan">
                [ 티어별 해결 문제 분포 ]
              </Text>
            </Box>
            <StackedBarChart data={tierDistData} width="full" />
          </Box>
        )}

        {/* 상위 100문제 그리드 */}
        {top100 && top100.length > 0 && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold color="cyan">
                [ 상위 100문제 분포 ]
              </Text>
            </Box>
            <Box flexDirection="column">
              {Array.from({ length: Math.ceil(top100.length / 20) }).map(
                (_, rowIndex) => (
                  <Box key={rowIndex} flexDirection="row">
                    {top100
                      .slice(rowIndex * 20, (rowIndex + 1) * 20)
                      .map((p, colIndex) => {
                        const tierColor = getTierColor(p.level);
                        const tierColorFn =
                          typeof tierColor === 'string'
                            ? chalk.hex(tierColor)
                            : tierColor.multiline;
                        return (
                          <Box key={colIndex} width={3}>
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
- 기본 Solved.ac 핸들은 ps config에서 설정 가능합니다.`,
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
      logger.error('Solved.ac 핸들을 입력해주세요.');
      console.log(`도움말: ps stats --help`);
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
