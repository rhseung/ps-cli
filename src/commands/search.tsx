import { existsSync } from 'fs';

import { Alert, Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';
import React, { useEffect, useState } from 'react';

import { ProblemSelector } from '../components/problem-selector';
import { Command } from '../core/base-command';
import { CommandDef, CommandBuilder } from '../core/command-builder';
import { useOpenBrowser } from '../hooks/use-open-browser';
import { searchProblems } from '../services/scraper';
import type { CommandFlags } from '../types/command';
import type { SearchResult } from '../types/index';
import { getProblemDirPath } from '../utils/problem-id';

interface SearchViewProps {
  query: string;
  onComplete?: () => void;
}

interface OpenBrowserViewProps {
  problemId: number;
  onComplete?: () => void;
}

function OpenBrowserView({ problemId, onComplete }: OpenBrowserViewProps) {
  const { status, error, url } = useOpenBrowser({
    problemId,
    onComplete,
  });

  if (status === 'loading') {
    return (
      <Box flexDirection="column">
        <Spinner label="브라우저를 여는 중..." />
        <Box marginTop={1}>
          <Text color="gray">문제 #{problemId}</Text>
        </Box>
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box flexDirection="column">
        <Alert variant="error">브라우저를 열 수 없습니다: {error}</Alert>
        <Box marginTop={1}>
          <Text color="gray">URL: {url}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Alert variant="success">브라우저에서 문제 페이지를 열었습니다!</Alert>
      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text color="cyan" bold>
            문제 번호:
          </Text>{' '}
          {problemId}
        </Text>
        <Text>
          <Text color="cyan" bold>
            URL:
          </Text>{' '}
          <Text color="blue" underline>
            {url}
          </Text>
        </Text>
      </Box>
    </Box>
  );
}

function SearchView({ query, onComplete }: SearchViewProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(
    null,
  );

  // 검색 실행
  useEffect(() => {
    async function performSearch() {
      try {
        setLoading(true);
        setError(null);
        const searchResults = await searchProblems(query, currentPage);

        // 각 문제에 대해 problem_dir에 디렉토리가 존재하는지 확인
        const resultsWithSolvedStatus = searchResults.problems.map(
          (problem) => {
            const problemDirPath = getProblemDirPath(problem.problemId);
            const isSolved = existsSync(problemDirPath);
            return {
              ...problem,
              isSolved,
            };
          },
        );

        setResults(resultsWithSolvedStatus);
        setTotalPages(searchResults.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    void performSearch();
  }, [query, currentPage]);

  if (loading && !selectedProblemId) {
    return (
      <Box flexDirection="column">
        <Spinner label="검색 중..." />
        <Box marginTop={1}>
          <Text color="gray">쿼리: {query}</Text>
        </Box>
      </Box>
    );
  }

  if (error && !selectedProblemId) {
    return (
      <Box flexDirection="column">
        <Alert variant="error">검색 실패: {error}</Alert>
        <Box marginTop={1}>
          <Text color="gray">쿼리: {query}</Text>
        </Box>
      </Box>
    );
  }

  if (selectedProblemId) {
    return (
      <OpenBrowserView problemId={selectedProblemId} onComplete={onComplete} />
    );
  }

  if (results.length === 0) {
    return (
      <Box flexDirection="column">
        <Alert variant="info">검색 결과가 없습니다.</Alert>
        <Box marginTop={1}>
          <Text color="gray">쿼리: {query}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <ProblemSelector
      problems={results.map((problem) => ({
        problemId: problem.problemId,
        title: problem.title,
        level: problem.level,
        solvedCount: problem.solvedCount,
        averageTries: problem.averageTries,
        isSolved: problem.isSolved,
      }))}
      currentPage={currentPage}
      totalPages={totalPages}
      showPagination={true}
      onSelect={(problemId) => {
        setSelectedProblemId(problemId);
      }}
      onPageChange={(page) => {
        setCurrentPage(page);
      }}
      header={
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              🔍 검색 결과
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="gray">쿼리: {query}</Text>
          </Box>
        </Box>
      }
    />
  );
}

@CommandDef({
  name: 'search',
  description: `solved.ac에서 문제를 검색하고 선택한 문제를 브라우저로 엽니다.
- solved.ac 검색어 문법을 지원합니다.
- 문제 목록에서 선택하면 자동으로 브라우저에서 문제 페이지를 엽니다.
- 페이지네이션을 통해 여러 페이지의 결과를 탐색할 수 있습니다.`,
  autoDetectProblemId: false,
  requireProblemId: false,
  examples: [
    'search "*g1...g5"           # Gold 1-5 문제 검색',
    'search "tier:g1...g5"       # Gold 1-5 문제 검색 (tier: 문법)',
    'search "#dp"                 # DP 태그 문제 검색',
    'search "tag:dp"              # DP 태그 문제 검색 (tag: 문법)',
    'search "*g1...g5 #dp"        # Gold 1-5 티어의 DP 태그 문제 검색',
  ],
})
export class SearchCommand extends Command {
  async execute(args: string[], _flags: CommandFlags): Promise<void> {
    const query = args.join(' ').trim();

    if (!query) {
      console.error('오류: 검색 쿼리를 입력해주세요.');
      console.error(`사용법: ps search <쿼리>`);
      console.error(`도움말: ps search --help`);
      console.error(`예제: ps search "*g1...g5"`);
      process.exit(1);
      return;
    }

    await this.renderView(SearchView, {
      query,
    });
  }
}

export default CommandBuilder.fromClass(SearchCommand);
