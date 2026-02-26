import { Box, Text } from 'ink';
import React, { useState } from 'react';

import { ProblemSelector } from '../components/problem-selector';
import {
  Command,
  CommandDef,
  CommandBuilder,
  findProjectRoot,
  getSolvingProblems,
  logger,
  type CommandFlags,
  type SolvingProblemInfo,
} from '../core';

import { OpenView } from './open';

export interface SolvingListViewProps {
  problems: SolvingProblemInfo[];
  onComplete?: () => void;
}

function SolvingListView({ problems, onComplete }: SolvingListViewProps) {
  const [selectedProblem, setSelectedProblem] =
    useState<SolvingProblemInfo | null>(null);

  if (selectedProblem) {
    return (
      <OpenView
        problemDir={selectedProblem.problemDir}
        mode="editor"
        onComplete={onComplete}
      />
    );
  }

  const selectorProblems = problems.map((p) => ({
    problemId: p.problemId,
    title: p.title,
    level: p.level,
    isSolving: true,
  }));

  return (
    <Box flexDirection="column">
      <ProblemSelector
        problems={selectorProblems}
        onSelect={(problemId) => {
          const p = problems.find((x) => x.problemId === problemId);
          if (p) setSelectedProblem(p);
        }}
        header={<Text bold>풀이 중인 문제를 선택하세요 (에디터로 열기):</Text>}
      />
    </Box>
  );
}

@CommandDef({
  name: 'solving',
  description: `solving 디렉터리에 있는 풀이 중인 문제 목록을 표시하고, 선택한 문제를 에디터로 엽니다.
- meta.json에서 문제 제목, 티어 등 정보를 읽어 표시합니다.
- 문제 번호만 보던 ls solving 대신 직관적으로 문제를 고를 수 있습니다.`,
  flags: [],
  autoDetectProblemId: false,
  requireProblemId: false,
  examples: [
    'solving                 # 풀이 중인 문제 목록 → 선택 시 에디터로 열기',
    'solving --help          # 도움말 표시',
  ],
})
export class SolvingCommand extends Command {
  async execute(_args: string[], _flags: CommandFlags): Promise<void> {
    const projectRoot = findProjectRoot();
    if (!projectRoot) {
      logger.error('현재 디렉터리가 ps-cli 프로젝트가 아닙니다.');
      process.exit(1);
      return;
    }

    const problems = await getSolvingProblems();
    if (problems.length === 0) {
      logger.info('풀이 중인 문제가 없습니다.');
      process.exit(0);
      return;
    }

    await this.renderView(SolvingListView, { problems });
  }
}

export default CommandBuilder.fromClass(SolvingCommand);
