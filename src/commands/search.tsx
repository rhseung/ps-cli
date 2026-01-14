import { existsSync } from 'fs';

import { Alert, Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';
import React, { useEffect, useState } from 'react';

import { ProblemSelector } from '../components/problem-selector';
import { Command } from '../core/base-command';
import { CommandDef, CommandBuilder } from '../core/command-builder';
import { useOpenBrowser } from '../hooks/use-open-browser';
import { searchProblems } from '../services/scraper';
import { getProblem } from '../services/solved-api';
import { scrapeWorkbook } from '../services/workbook-scraper';
import type {
  InferFlagsFromSchema,
  FlagDefinitionSchema,
} from '../types/command';
import { defineFlags } from '../types/command';
import type { SearchResult } from '../types/index';
import type { WorkbookProblem } from '../types/workbook';
import { getArchiveDirPath } from '../utils/problem-id';

// 플래그 정의 스키마 (타입 추론용)
const searchFlagsSchema = {
  workbook: {
    type: 'number' as const,
    shortFlag: 'w',
    description: '문제집 ID를 지정하여 해당 문제집의 문제 목록을 표시',
  },
} as const satisfies FlagDefinitionSchema;

type SearchCommandFlags = InferFlagsFromSchema<typeof searchFlagsSchema>;

interface SearchViewProps {
  query: string;
  onComplete?: () => void;
}

interface WorkbookSearchViewProps {
  workbookId: number;
  onComplete?: () => void;
}

/**
 * 문제 목록에 티어 정보를 추가합니다.
 * solved.ac API를 사용하여 일괄 조회합니다.
 */
async function enrichProblemsWithTiers(
  problems: WorkbookProblem[],
): Promise<Array<WorkbookProblem & { level?: number }>> {
  // Rate limit을 고려하여 배치 처리
  // 한 번에 너무 많은 요청을 보내지 않도록 제한
  const BATCH_SIZE = 10;
  const DELAY_MS = 200; // 각 배치 사이에 200ms 대기

  const enriched: Array<WorkbookProblem & { level?: number }> = [];

  for (let i = 0; i < problems.length; i += BATCH_SIZE) {
    const batch = problems.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (problem) => {
      try {
        const solvedAcData = await getProblem(problem.problemId);
        return {
          ...problem,
          level: solvedAcData.level,
        };
      } catch (error) {
        // API 호출 실패해도 문제는 포함 (티어 정보만 없음)
        console.warn(
          `문제 ${problem.problemId}의 티어 정보를 가져올 수 없습니다: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return problem;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    enriched.push(...batchResults);

    // 마지막 배치가 아니면 대기
    if (i + BATCH_SIZE < problems.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  return enriched;
}

function WorkbookSearchView({
  workbookId,
  onComplete,
}: WorkbookSearchViewProps) {
  const [problems, setProblems] = useState<
    Array<WorkbookProblem & { level?: number }>
  >([]);
  const [workbookTitle, setWorkbookTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    async function loadWorkbook() {
      try {
        setLoading(true);
        setError(null);

        // 문제집 스크래핑
        const workbook = await scrapeWorkbook(workbookId);
        setWorkbookTitle(workbook.title);

        // 티어 정보 추가
        const enriched = await enrichProblemsWithTiers(workbook.problems);
        setProblems(enriched);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    void loadWorkbook();
  }, [workbookId]);

  if (selectedProblemId) {
    return (
      <OpenBrowserView problemId={selectedProblemId} onComplete={onComplete} />
    );
  }

  if (loading) {
    return (
      <Box flexDirection="column">
        <Spinner label="문제집을 로드하는 중..." />
        <Box marginTop={1}>
          <Text color="gray">문제집 ID: {workbookId}</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Alert variant="error">오류: {error}</Alert>
        <Box marginTop={1}>
          <Text color="gray">문제집 ID: {workbookId}</Text>
        </Box>
      </Box>
    );
  }

  if (problems.length === 0) {
    return (
      <Box flexDirection="column">
        <Alert variant="info">문제집에 문제가 없습니다.</Alert>
        <Box marginTop={1}>
          <Text color="gray">문제집 ID: {workbookId}</Text>
        </Box>
      </Box>
    );
  }

  // 각 문제에 대해 problem_dir에 디렉토리가 존재하는지 확인
  const problemsWithSolvedStatus = problems.map((problem) => {
    const problemDirPath = getArchiveDirPath(problem.problemId);
    const isSolved = existsSync(problemDirPath);
    return {
      problemId: problem.problemId,
      title: problem.title,
      level: problem.level,
      isSolved,
    };
  });

  return (
    <ProblemSelector
      problems={problemsWithSolvedStatus}
      onSelect={(problemId) => {
        setSelectedProblemId(problemId);
      }}
      header={
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              📚 문제집: {workbookTitle} (ID: {workbookId})
            </Text>
          </Box>
          <Box>
            <Text color="gray">총 {problems.length}문제</Text>
          </Box>
        </Box>
      }
    />
  );
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
            const problemDirPath = getArchiveDirPath(problem.problemId);
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
          <Box>
            <Text color="gray">쿼리: {query}</Text>
          </Box>
        </Box>
      }
    />
  );
}

@CommandDef({
  name: 'search',
  description: `solved.ac에서 문제를 검색하거나 백준 문제집의 문제 목록을 표시합니다.
- solved.ac 검색어 문법을 지원합니다.
- 문제 목록에서 선택하면 자동으로 브라우저에서 문제 페이지를 엽니다.
- 페이지네이션을 통해 여러 페이지의 결과를 탐색할 수 있습니다.
- --workbook 옵션으로 백준 문제집의 문제 목록을 볼 수 있습니다.`,
  flags: defineFlags(searchFlagsSchema),
  autoDetectProblemId: false,
  requireProblemId: false,
  examples: [
    'search "*g1...g5"           # Gold 1-5 문제 검색',
    'search "tier:g1...g5"       # Gold 1-5 문제 검색 (tier: 문법)',
    'search "#dp"                 # DP 태그 문제 검색',
    'search "tag:dp"              # DP 태그 문제 검색 (tag: 문법)',
    'search "*g1...g5 #dp"        # Gold 1-5 티어의 DP 태그 문제 검색',
    'search --workbook 25052      # 문제집 25052의 문제 목록 표시',
    'search -w 25052              # 문제집 25052의 문제 목록 표시 (단축 옵션)',
  ],
})
export class SearchCommand extends Command<SearchCommandFlags> {
  async execute(args: string[], flags: SearchCommandFlags): Promise<void> {
    const workbookId = flags.workbook
      ? parseInt(String(flags.workbook), 10)
      : null;

    if (workbookId) {
      if (isNaN(workbookId) || workbookId <= 0) {
        console.error('오류: 유효한 문제집 ID를 입력해주세요.');
        console.error(`사용법: ps search --workbook <문제집ID>`);
        console.error(`도움말: ps search --help`);
        process.exit(1);
        return;
      }

      await this.renderView(WorkbookSearchView, {
        workbookId,
      });
      return;
    }

    // 기존 검색 모드
    const query = args.join(' ').trim();

    if (!query) {
      console.error('오류: 검색 쿼리 또는 --workbook 옵션을 입력해주세요.');
      console.error(`사용법: ps search <쿼리>`);
      console.error(`      ps search --workbook <문제집ID>`);
      console.error(`도움말: ps search --help`);
      console.error(`예제: ps search "*g1...g5"`);
      console.error(`      ps search --workbook 25052`);
      process.exit(1);
      return;
    }

    await this.renderView(SearchView, {
      query,
    });
  }
}

export default CommandBuilder.fromClass(SearchCommand);
