import { existsSync } from 'fs';

import { Select, Alert, Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';
import React, { useEffect, useState } from 'react';

import { ProblemSelector } from '../components/problem-selector';
import {
  Command,
  CommandDef,
  CommandBuilder,
  resolveLanguage,
  findSolutionFile,
  getArchiveDirPath,
  getSolvingDirPath,
  icons,
  logger,
  getEditor,
  type Language,
} from '../core';
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

import { ArchiveView } from './archive';
import { FetchView } from './fetch';
import { OpenView } from './open';
import { SubmitView } from './submit';
import { TestView } from './test';

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
): Promise<Array<WorkbookProblem & { level?: number; tags?: string[] }>> {
  // Rate limit을 고려하여 배치 처리
  // 한 번에 너무 많은 요청을 보내지 않도록 제한
  const BATCH_SIZE = 10;
  const DELAY_MS = 200; // 각 배치 사이에 200ms 대기

  const enriched: Array<WorkbookProblem & { level?: number; tags?: string[] }> =
    [];

  for (let i = 0; i < problems.length; i += BATCH_SIZE) {
    const batch = problems.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (problem) => {
      try {
        const solvedAcData = await getProblem(problem.problemId);
        return {
          ...problem,
          level: solvedAcData.level,
          tags: solvedAcData.tags.map(
            (t) =>
              t.displayNames.find((n) => n.language === 'ko')?.name || t.key,
          ),
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

interface ProblemActionViewProps {
  problemId: number;
  isSolved: boolean;
  isSolving: boolean;
  onBack: () => void;
  onComplete?: () => void;
}

type Action =
  | 'open'
  | 'editor'
  | 'fetch'
  | 'test'
  | 'submit'
  | 'archive'
  | 'back';

function ProblemActionView({
  problemId,
  isSolved,
  isSolving,
  onBack,
  onComplete,
}: ProblemActionViewProps) {
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [problemDir, setProblemDir] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 필요한 정보 미리 로드 (test, submit 등을 위해)
  useEffect(() => {
    async function loadInfo() {
      if (isSolving || isSolved) {
        try {
          setLoading(true);
          const solvingPath = getSolvingDirPath(problemId);
          const archivePath = getArchiveDirPath(problemId);

          let dir = '';
          if (existsSync(solvingPath)) {
            dir = solvingPath;
          } else if (existsSync(archivePath)) {
            dir = archivePath;
          }

          if (dir) {
            setProblemDir(dir);
            try {
              const lang = await resolveLanguage(dir);
              setLanguage(lang);
              const src = await findSolutionFile(dir);
              setSourcePath(src);
            } catch {
              // language나 source file을 못 찾을 수도 있음 (fetch만 된 상태 등)
            }
          }
        } catch {
          // 정보 로드 실패해도 메뉴는 보여줌
        } finally {
          setLoading(false);
        }
      }
    }
    void loadInfo();
  }, [problemId, isSolving, isSolved]);

  if (selectedAction === 'open') {
    return (
      <OpenView problemId={problemId} mode="browser" onComplete={onComplete} />
    );
  }

  if (selectedAction === 'editor') {
    return (
      <OpenView
        problemId={problemId}
        problemDir={sourcePath || problemDir || undefined}
        mode="editor"
        onComplete={onComplete}
      />
    );
  }

  if (selectedAction === 'fetch') {
    return <FetchView problemId={problemId} onComplete={onComplete} />;
  }

  if (selectedAction === 'test' && problemDir && language) {
    return (
      <TestView
        problemDir={problemDir}
        language={language}
        watch={false}
        onComplete={() => onComplete?.()}
      />
    );
  }

  if (selectedAction === 'submit' && language && sourcePath) {
    return (
      <SubmitView
        problemId={problemId}
        language={language}
        sourcePath={sourcePath}
        onComplete={() => onComplete?.()}
      />
    );
  }

  if (selectedAction === 'archive') {
    return <ArchiveView problemId={problemId} onComplete={onComplete} />;
  }

  const options = [
    { label: `${icons.open} 브라우저에서 열기 (open)`, value: 'open' },
  ];

  if (isSolving || isSolved) {
    const editorName = getEditor();
    options.push({
      label: `${icons.editor} 에디터에서 열기 (${editorName})`,
      value: 'editor',
    });
  }

  options.push({
    label: `${icons.fetch} 문제 가져오기 (fetch)`,
    value: 'fetch',
  });

  if (isSolving || isSolved) {
    if (problemDir && language) {
      options.push({
        label: `${icons.test} 로컬 테스트 실행 (test)`,
        value: 'test',
      });
      if (sourcePath) {
        options.push({
          label: `${icons.submit} 코드 제출하기 (submit)`,
          value: 'submit',
        });
      }
    }
    if (isSolving) {
      options.push({
        label: `${icons.archive} 문제 아카이브 (archive)`,
        value: 'archive',
      });
    }
  }

  options.push({ label: `${icons.back} 뒤로 가기`, value: 'back' });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          문제 #{problemId} 선택됨. 어떤 작업을 하시겠습니까?
        </Text>
      </Box>
      {loading && <Spinner label="문제 정보를 확인하는 중..." />}
      {!loading && (
        <Select
          options={options}
          onChange={(value) => {
            if (value === 'back') {
              onBack();
            } else {
              setSelectedAction(value as Action);
            }
          }}
        />
      )}
    </Box>
  );
}

function WorkbookSearchView({
  workbookId,
  onComplete,
}: WorkbookSearchViewProps) {
  const [problems, setProblems] = useState<
    Array<WorkbookProblem & { level?: number; tags?: string[] }>
  >([]);
  const [workbookTitle, setWorkbookTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<{
    problemId: number;
    isSolved: boolean;
    isSolving: boolean;
  } | null>(null);

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

  if (selectedProblem) {
    return (
      <ProblemActionView
        problemId={selectedProblem.problemId}
        isSolved={selectedProblem.isSolved}
        isSolving={selectedProblem.isSolving}
        onBack={() => setSelectedProblem(null)}
        onComplete={onComplete}
      />
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

  // 각 문제에 대해 solving 및 archive 디렉토리가 존재하는지 확인
  const problemsWithStatus = problems.map((problem) => {
    const archiveDirPath = getArchiveDirPath(problem.problemId, process.cwd(), {
      level: problem.level,
      tags: problem.tags,
    });
    const solvingDirPath = getSolvingDirPath(problem.problemId);

    const isSolved = existsSync(archiveDirPath);
    const isSolving = existsSync(solvingDirPath);

    return {
      problemId: problem.problemId,
      title: problem.title,
      level: problem.level,
      isSolved,
      isSolving,
    };
  });

  return (
    <ProblemSelector
      problems={problemsWithStatus}
      onSelect={(problemId) => {
        const problem = problemsWithStatus.find(
          (p) => p.problemId === problemId,
        );
        if (problem) {
          setSelectedProblem({
            problemId,
            isSolved: problem.isSolved,
            isSolving: problem.isSolving,
          });
        }
      }}
      header={
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              {icons.workbook} 문제집: {workbookTitle} (ID: {workbookId})
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

function SearchView({ query, onComplete }: SearchViewProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<{
    problemId: number;
    isSolved: boolean;
    isSolving: boolean;
  } | null>(null);

  // 검색 실행
  useEffect(() => {
    async function performSearch() {
      try {
        setLoading(true);
        setError(null);
        const searchResults = await searchProblems(query, currentPage);

        // 각 문제에 대해 상세 정보(티어, 태그 등) 추가로 가져오기 (배치 처리)
        const enrichedProblems = await enrichProblemsWithTiers(
          searchResults.problems.map((p) => ({
            problemId: p.problemId,
            title: p.title,
            order: 0, // SearchResult에는 order가 없으므로 0으로 설정
          })),
        );

        // 상세 정보와 검색 결과를 병합하고 해결 상태 확인
        const resultsWithStatus = searchResults.problems.map((problem) => {
          const enriched = enrichedProblems.find(
            (ep) => ep.problemId === problem.problemId,
          );
          const level = enriched?.level ?? problem.level;
          const tags = enriched?.tags ?? problem.tags;

          const archiveDirPath = getArchiveDirPath(
            problem.problemId,
            process.cwd(),
            {
              level,
              tags,
            },
          );
          const solvingDirPath = getSolvingDirPath(problem.problemId);

          const isSolved = existsSync(archiveDirPath);
          const isSolving = existsSync(solvingDirPath);

          return {
            ...problem,
            level,
            tags,
            isSolved,
            isSolving,
          };
        });

        setResults(resultsWithStatus);
        setTotalPages(searchResults.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    void performSearch();
  }, [query, currentPage]);

  if (loading && !selectedProblem) {
    return (
      <Box flexDirection="column">
        <Spinner label="검색 중..." />
        <Box marginTop={1}>
          <Text color="gray">쿼리: {query}</Text>
        </Box>
      </Box>
    );
  }

  if (error && !selectedProblem) {
    return (
      <Box flexDirection="column">
        <Alert variant="error">검색 실패: {error}</Alert>
        <Box marginTop={1}>
          <Text color="gray">쿼리: {query}</Text>
        </Box>
      </Box>
    );
  }

  if (selectedProblem) {
    return (
      <ProblemActionView
        problemId={selectedProblem.problemId}
        isSolved={selectedProblem.isSolved}
        isSolving={selectedProblem.isSolving}
        onBack={() => setSelectedProblem(null)}
        onComplete={onComplete}
      />
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
        isSolving: problem.isSolving,
      }))}
      currentPage={currentPage}
      totalPages={totalPages}
      showPagination={true}
      onSelect={(problemId) => {
        const problem = results.find((p) => p.problemId === problemId);
        if (problem) {
          setSelectedProblem({
            problemId,
            isSolved: problem.isSolved || false,
            isSolving: problem.isSolving || false,
          });
        }
      }}
      onPageChange={(page) => {
        setCurrentPage(page);
      }}
      header={
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              {icons.search} 검색 결과
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
- 문제 목록에서 해결 상태를 아이콘으로 확인할 수 있습니다.
- 문제 선택 시 인터랙티브 메뉴를 통해 열기, 가져오기, 테스트, 제출 등을 수행할 수 있습니다.
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
        logger.error('유효한 문제집 ID를 입력해주세요.');
        console.log(`사용법: ps search --workbook <문제집ID>`);
        console.log(`도움말: ps search --help`);
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
      logger.error('검색 쿼리 또는 --workbook 옵션을 입력해주세요.');
      console.log(`도움말: ps search --help`);
      process.exit(1);
      return;
    }

    await this.renderView(SearchView, {
      query,
    });
  }
}

export default CommandBuilder.fromClass(SearchCommand);
