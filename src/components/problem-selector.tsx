import { Select } from '@inkjs/ui';
import chalk from 'chalk';
import { Box, Text } from 'ink';
import React from 'react';

import { getTierName, getTierColor } from '../utils/tier';

export interface ProblemSelectorProblem {
  problemId: number;
  title: string;
  level?: number; // 티어 레벨 (solved.ac에서 가져옴)
  solvedCount?: number;
  averageTries?: number;
  isSolved?: boolean; // 로컬에 파일이 있는지
  order?: number; // 문제집 내 순서 (workbook용)
}

export interface ProblemSelectorProps {
  problems: ProblemSelectorProblem[];
  currentPage?: number;
  totalPages?: number;
  showPagination?: boolean;
  onSelect: (problemId: number) => void;
  onPageChange?: (page: number) => void;
  header?: React.ReactNode;
}

export function ProblemSelector({
  problems,
  currentPage,
  totalPages,
  showPagination = false,
  onSelect,
  onPageChange,
  header,
}: ProblemSelectorProps) {
  // Select 옵션 생성
  const options: Array<{ label: string; value: string }> = [];

  // 문제 목록 추가
  problems.forEach((problem) => {
    const solvedText = problem.solvedCount
      ? ` (${problem.solvedCount.toLocaleString()}명`
      : '';
    const triesText = problem.averageTries
      ? `, 평균 ${problem.averageTries}회`
      : '';
    const suffix = solvedText + triesText + (solvedText ? ')' : '');

    // 해결된 문제 표시
    const solvedMark = problem.isSolved ? ' ✓' : '';

    // 티어 표시 (색상 적용)
    let tierText = '';
    if (problem.level) {
      const tierName = getTierName(problem.level);
      const tierColor = getTierColor(problem.level);

      // 색상 적용
      if (typeof tierColor === 'string') {
        tierText = ` ${chalk.bold.hex(tierColor)(tierName)}`;
      } else {
        tierText = ` ${tierColor(chalk.bold(tierName))}`;
      }
    }

    // 문제 번호와 제목
    const problemText = `${problem.problemId} - ${problem.title}`;

    options.push({
      label: `${tierText} ${problemText}${solvedMark}${suffix}`,
      value: `problem:${problem.problemId}`,
    });
  });

  // 페이지네이션 옵션 추가
  if (showPagination && currentPage !== undefined && totalPages !== undefined) {
    if (currentPage < totalPages) {
      options.push({
        label: `→ 다음 페이지 (${currentPage + 1}/${totalPages})`,
        value: 'next-page',
      });
    }

    if (currentPage > 1) {
      options.push({
        label: `← 이전 페이지 (${currentPage - 1}/${totalPages})`,
        value: 'prev-page',
      });
    }
  }

  const handleSelect = (value: string) => {
    if (value === 'next-page' && onPageChange && currentPage !== undefined) {
      onPageChange(currentPage + 1);
      return;
    }

    if (value === 'prev-page' && onPageChange && currentPage !== undefined) {
      onPageChange(currentPage - 1);
      return;
    }

    if (value.startsWith('problem:')) {
      const problemId = parseInt(value.replace('problem:', ''), 10);
      if (!isNaN(problemId)) {
        onSelect(problemId);
      }
    }
  };

  return (
    <Box flexDirection="column">
      {header && <Box marginBottom={1}>{header}</Box>}
      {showPagination &&
        currentPage !== undefined &&
        totalPages !== undefined && (
          <Box marginBottom={1}>
            <Text color="gray">
              페이지 {currentPage}/{totalPages}
            </Text>
          </Box>
        )}
      <Box>
        <Select options={options} onChange={handleSelect} />
      </Box>
    </Box>
  );
}
