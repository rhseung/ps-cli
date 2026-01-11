import { Select, TextInput, StatusMessage, Alert, Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';
import React, { useState, useEffect } from 'react';

import { ProblemDashboard } from '../components/problem-dashboard';
import { ProblemSelector } from '../components/problem-selector';
import { Command } from '../core/base-command';
import { CommandDef, CommandBuilder } from '../core/command-builder';
import { useFetchProblem } from '../hooks/use-fetch-problem';
import { useWorkbook, type WorkbookMode } from '../hooks/use-workbook';
import { resetWorkbookProgress } from '../services/workbook-storage';
import type { CommandFlags } from '../types/command';
import type { ProblemStatus } from '../types/workbook';
import { getDefaultLanguage } from '../utils/config';
import type { Language } from '../utils/language';

type InteractiveStep =
  | 'workbook-id'
  | 'main-menu'
  | 'next-problem-mode'
  | 'update-status-problem'
  | 'update-status-value'
  | 'fetching'
  | 'completed'
  | 'status';

interface WorkbookViewProps {
  workbookId: number | null;
  mode?: WorkbookMode;
  language?: Language;
  markSolved?: number;
  markFailed?: number;
  markUnsolved?: number;
  reset?: boolean;
  showStatus?: boolean;
  interactive?: boolean;
  onComplete?: () => void;
}

function WorkbookView({
  workbookId: initialWorkbookId,
  mode: initialMode,
  language: initialLanguage,
  markSolved,
  markFailed,
  markUnsolved,
  reset,
  showStatus,
  interactive = false,
  onComplete,
}: WorkbookViewProps) {
  const [workbookId, setWorkbookId] = useState<number | null>(
    initialWorkbookId,
  );
  const [mode, setMode] = useState<WorkbookMode>(initialMode || 'sequential');
  const language = initialLanguage || (getDefaultLanguage() as Language);
  const [currentStep, setCurrentStep] = useState<InteractiveStep>(
    initialWorkbookId ? 'main-menu' : 'workbook-id',
  );
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(
    null,
  );

  const {
    status: workbookStatus,
    workbook,
    progress,
    enrichedProblems,
    error: workbookError,
    message: workbookMessage,
    nextProblem,
    updateStatus,
    refresh,
  } = useWorkbook({
    workbookId,
    mode,
  });

  const {
    status: fetchStatus,
    problem,
    error: fetchError,
    message: fetchMessage,
  } = useFetchProblem({
    problemId: selectedProblemId || 0,
    language,
    onComplete: selectedProblemId
      ? () => setCurrentStep('completed')
      : undefined,
  });

  // 명령줄 옵션 처리
  useEffect(() => {
    if (!workbookId || workbookStatus !== 'ready') return;

    // 상태 업데이트 옵션
    if (markSolved !== undefined) {
      void (async () => {
        await updateStatus(markSolved, 'solved');
        setTimeout(() => {
          onComplete?.();
        }, 1000);
      })();
      return;
    }

    if (markFailed !== undefined) {
      void (async () => {
        await updateStatus(markFailed, 'failed');
        setTimeout(() => {
          onComplete?.();
        }, 1000);
      })();
      return;
    }

    if (markUnsolved !== undefined) {
      void (async () => {
        await updateStatus(markUnsolved, 'unsolved');
        setTimeout(() => {
          onComplete?.();
        }, 1000);
      })();
      return;
    }

    // 리셋 옵션
    if (reset) {
      void (async () => {
        await resetWorkbookProgress(workbookId);
        await refresh();
        setTimeout(() => {
          onComplete?.();
        }, 1000);
      })();
      return;
    }

    // 상태 보기 옵션
    if (showStatus) {
      // 상태만 보여주고 종료
      return;
    }

    // 인터랙티브 모드가 아니고 모드가 지정된 경우 자동으로 다음 문제 fetch
    if (!interactive && initialMode && nextProblem) {
      setSelectedProblemId(nextProblem.problemId);
      setCurrentStep('fetching');
    }
  }, [
    workbookId,
    workbookStatus,
    markSolved,
    markFailed,
    markUnsolved,
    reset,
    showStatus,
    interactive,
    initialMode,
    nextProblem,
    updateStatus,
    refresh,
    onComplete,
  ]);

  // 진행률 계산
  const getProgressStats = () => {
    if (!progress || !workbook) {
      return { solved: 0, failed: 0, unsolved: 0, total: 0, percentage: 0 };
    }

    const total = workbook.problems.length;
    let solved = 0;
    let failed = 0;

    for (const problem of workbook.problems) {
      const problemProgress = progress.problems[problem.problemId];
      if (problemProgress) {
        if (problemProgress.status === 'solved') {
          solved++;
        } else if (problemProgress.status === 'failed') {
          failed++;
        }
      }
    }

    const unsolved = total - solved - failed;
    const percentage = total > 0 ? Math.round((solved / total) * 100) : 0;

    return { solved, failed, unsolved, total, percentage };
  };

  const stats = getProgressStats();

  // 진행률 바 생성
  const getProgressBar = (percentage: number) => {
    const barLength = 20;
    const filled = Math.round((percentage / 100) * barLength);
    const empty = barLength - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  };

  // 인터랙티브 모드 UI
  if (interactive || currentStep !== 'main-menu') {
    // 문제집 ID 입력
    if (currentStep === 'workbook-id') {
      return (
        <Box flexDirection="column">
          <Alert variant="info">문제집 ID를 입력해주세요</Alert>
          <Box marginTop={1}>
            <TextInput
              placeholder="예: 25052"
              onSubmit={(value) => {
                const id = parseInt(value, 10);
                if (!isNaN(id) && id > 0) {
                  setWorkbookId(id);
                  setCurrentStep('main-menu');
                }
              }}
            />
          </Box>
        </Box>
      );
    }

    // 로딩 중
    if (workbookStatus === 'loading') {
      return (
        <Box flexDirection="column">
          <Spinner label={workbookMessage} />
        </Box>
      );
    }

    // 에러
    if (workbookStatus === 'error') {
      return (
        <Box flexDirection="column">
          <Alert variant="error">오류: {workbookError}</Alert>
        </Box>
      );
    }

    // 메인 메뉴
    if (currentStep === 'main-menu' && workbook) {
      const menuOptions = [
        { label: '다음 문제 가져오기', value: 'next-problem' },
        { label: '현재 문제 상태 업데이트', value: 'update-status' },
        { label: '진행 상황 보기', value: 'status' },
        { label: '종료', value: 'exit' },
      ];

      return (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              📚 문제집: {workbook.title} (ID: {workbook.id})
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text>
              진행률: [{getProgressBar(stats.percentage)}] {stats.percentage}% (
              {stats.solved}/{stats.total})
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text>
              해결: {stats.solved} | 틀림: {stats.failed} | 미해결:{' '}
              {stats.unsolved}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Alert variant="info">무엇을 하시겠습니까?</Alert>
          </Box>
          <Box marginTop={1}>
            <Select
              options={menuOptions}
              onChange={(value) => {
                if (value === 'next-problem') {
                  setCurrentStep('next-problem-mode');
                } else if (value === 'update-status') {
                  setCurrentStep('update-status-problem');
                } else if (value === 'status') {
                  setCurrentStep('status');
                } else if (value === 'exit') {
                  onComplete?.();
                }
              }}
            />
          </Box>
        </Box>
      );
    }

    // 다음 문제 모드 선택
    if (currentStep === 'next-problem-mode') {
      const modeOptions = [
        { label: '순차 모드 (sequential)', value: 'sequential' },
        { label: '틀린 문제만 (failed)', value: 'failed' },
        { label: '미해결 문제만 (unsolved)', value: 'unsolved' },
      ];

      return (
        <Box flexDirection="column">
          <Alert variant="info">모드를 선택해주세요</Alert>
          <Box marginTop={1}>
            <Select
              options={modeOptions}
              onChange={(value) => {
                setMode(value as WorkbookMode);
                if (nextProblem) {
                  setSelectedProblemId(nextProblem.problemId);
                  setCurrentStep('fetching');
                } else {
                  // 다음 문제가 없으면 메인 메뉴로
                  setCurrentStep('main-menu');
                }
              }}
            />
          </Box>
        </Box>
      );
    }

    // 상태 업데이트 - 문제 선택
    if (currentStep === 'update-status-problem') {
      return (
        <Box flexDirection="column">
          <Alert variant="info">상태를 업데이트할 문제를 선택해주세요</Alert>
          <Box marginTop={1}>
            <ProblemSelector
              problems={enrichedProblems.map((p) => ({
                problemId: p.problemId,
                title: p.title,
                level: p.level,
                status: p.status,
              }))}
              onSelect={(problemId) => {
                setSelectedProblemId(problemId);
                setCurrentStep('update-status-value');
              }}
            />
          </Box>
        </Box>
      );
    }

    // 상태 업데이트 - 상태 선택
    if (currentStep === 'update-status-value' && selectedProblemId) {
      const statusOptions = [
        { label: '해결함 (solved)', value: 'solved' },
        { label: '틀림 (failed)', value: 'failed' },
        { label: '미해결로 되돌리기 (unsolved)', value: 'unsolved' },
      ];

      return (
        <Box flexDirection="column">
          <Alert variant="info">
            문제 #{selectedProblemId}의 상태를 선택해주세요
          </Alert>
          <Box marginTop={1}>
            <Select
              options={statusOptions}
              onChange={async (value) => {
                await updateStatus(selectedProblemId, value as ProblemStatus);
                setSelectedProblemId(null);
                setCurrentStep('main-menu');
              }}
            />
          </Box>
        </Box>
      );
    }

    // 진행 상황 보기
    if (currentStep === 'status') {
      return (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              📊 진행 상황
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text>전체: {stats.total}문제</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>
              ✅ 해결: {stats.solved} (
              {Math.round((stats.solved / stats.total) * 100)}%)
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text>
              ❌ 틀림: {stats.failed} (
              {Math.round((stats.failed / stats.total) * 100)}%)
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text>
              ⏳ 미해결: {stats.unsolved} (
              {Math.round((stats.unsolved / stats.total) * 100)}%)
            </Text>
          </Box>
          <Box marginTop={1}>
            <Select
              options={[{ label: '메인 메뉴로 돌아가기', value: 'back' }]}
              onChange={() => {
                setCurrentStep('main-menu');
              }}
            />
          </Box>
        </Box>
      );
    }

    // Fetching
    if (currentStep === 'fetching') {
      if (fetchStatus === 'loading') {
        return (
          <Box flexDirection="column">
            <Spinner label={fetchMessage} />
          </Box>
        );
      }

      if (fetchStatus === 'error') {
        return (
          <Box flexDirection="column">
            <Alert variant="error">오류: {fetchError}</Alert>
            <Box marginTop={1}>
              <Select
                options={[{ label: '메인 메뉴로 돌아가기', value: 'back' }]}
                onChange={() => {
                  setCurrentStep('main-menu');
                }}
              />
            </Box>
          </Box>
        );
      }

      if (fetchStatus === 'success' && problem) {
        return (
          <Box flexDirection="column">
            <ProblemDashboard problem={problem} />
            <StatusMessage variant="success">{fetchMessage}</StatusMessage>
            <Box marginTop={1}>
              <Select
                options={[{ label: '메인 메뉴로 돌아가기', value: 'back' }]}
                onChange={() => {
                  setCurrentStep('main-menu');
                }}
              />
            </Box>
          </Box>
        );
      }
    }

    // Completed
    if (currentStep === 'completed') {
      return (
        <Box flexDirection="column">
          <StatusMessage variant="success">완료!</StatusMessage>
        </Box>
      );
    }
  }

  // 명령줄 모드 UI
  if (workbookStatus === 'loading') {
    return (
      <Box flexDirection="column">
        <Spinner label={workbookMessage} />
      </Box>
    );
  }

  if (workbookStatus === 'error') {
    return (
      <Box flexDirection="column">
        <Alert variant="error">오류: {workbookError}</Alert>
      </Box>
    );
  }

  if (showStatus && workbook && progress) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            📚 문제집: {workbook.title} (ID: {workbook.id})
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text>
            진행률: [{getProgressBar(stats.percentage)}] {stats.percentage}% (
            {stats.solved}/{stats.total})
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text>
            ✅ 해결: {stats.solved} | ❌ 틀림: {stats.failed} | ⏳ 미해결:{' '}
            {stats.unsolved}
          </Text>
        </Box>
      </Box>
    );
  }

  if (fetchStatus === 'loading') {
    return (
      <Box flexDirection="column">
        <Spinner label={fetchMessage} />
      </Box>
    );
  }

  if (fetchStatus === 'error') {
    return (
      <Box flexDirection="column">
        <Alert variant="error">오류: {fetchError}</Alert>
      </Box>
    );
  }

  if (fetchStatus === 'success' && problem) {
    return (
      <Box flexDirection="column">
        <ProblemDashboard problem={problem} />
        <StatusMessage variant="success">{fetchMessage}</StatusMessage>
      </Box>
    );
  }

  // 기본 상태
  return (
    <Box flexDirection="column">
      <Text>문제집을 로드하는 중...</Text>
    </Box>
  );
}

@CommandDef({
  name: 'workbook',
  description: `백준 문제집을 반복적으로 학습할 수 있는 명령어입니다.
- 문제집에서 문제 목록을 가져와 진행 상황을 추적합니다
- 순차 모드, 틀린 문제만, 미해결 문제만 등 다양한 모드를 지원합니다
- 인터랙티브 모드와 명령줄 옵션 모드를 모두 지원합니다`,
  flags: [
    {
      name: 'mode',
      options: {
        shortFlag: 'm',
        description: `학습 모드 선택 (sequential, failed, unsolved)
                        기본값: sequential`,
      },
    },
    {
      name: 'language',
      options: {
        shortFlag: 'l',
        description: `언어 선택 (기본값: 설정된 기본 언어)`,
      },
    },
    {
      name: 'mark-solved',
      options: {
        description: '특정 문제를 해결했다고 표시',
      },
    },
    {
      name: 'mark-failed',
      options: {
        description: '특정 문제를 틀렸다고 표시',
      },
    },
    {
      name: 'mark-unsolved',
      options: {
        description: '특정 문제를 미해결로 되돌리기',
      },
    },
    {
      name: 'reset',
      options: {
        description: '진행 상황 초기화',
      },
    },
    {
      name: 'status',
      options: {
        description: '현재 진행 상황 표시',
      },
    },
    {
      name: 'interactive',
      options: {
        shortFlag: 'i',
        description: '강제로 인터랙티브 모드 실행',
      },
    },
  ],
  autoDetectProblemId: false,
  requireProblemId: false,
  examples: [
    'workbook 25052                    # 인터랙티브 모드',
    'workbook 25052 --mode sequential  # 순차 모드로 다음 문제 가져오기',
    'workbook 25052 --mark-solved 1000 # 문제 1000을 해결했다고 표시',
    'workbook 25052 --status           # 진행 상황 보기',
  ],
})
export class WorkbookCommand extends Command {
  async execute(args: string[], flags: CommandFlags): Promise<void> {
    const workbookIdArg = args[0];
    const workbookId = workbookIdArg ? parseInt(workbookIdArg, 10) : null;

    if (workbookId !== null && (isNaN(workbookId) || workbookId <= 0)) {
      console.error('오류: 유효한 문제집 ID를 입력해주세요.');
      process.exit(1);
      return;
    }

    const mode = flags.mode as WorkbookMode | undefined;
    const language = flags.language as Language | undefined;
    const markSolved = flags['mark-solved']
      ? parseInt(String(flags['mark-solved']), 10)
      : undefined;
    const markFailed = flags['mark-failed']
      ? parseInt(String(flags['mark-failed']), 10)
      : undefined;
    const markUnsolved = flags['mark-unsolved']
      ? parseInt(String(flags['mark-unsolved']), 10)
      : undefined;
    const reset = flags.reset === true;
    const showStatus = flags.status === true;
    const interactive =
      flags.interactive === true ||
      (!mode &&
        !markSolved &&
        !markFailed &&
        !markUnsolved &&
        !reset &&
        !showStatus);

    await this.renderView(WorkbookView, {
      workbookId,
      mode,
      language,
      markSolved,
      markFailed,
      markUnsolved,
      reset,
      showStatus,
      interactive,
    });
  }
}

export default CommandBuilder.fromClass(WorkbookCommand);
