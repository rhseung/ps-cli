import { mkdir, readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';

import { execaCommand, execa } from 'execa';
import { useEffect, useState, useCallback } from 'react';

import {
  getArchiveDir,
  getSolvingDir,
  getDefaultLanguage,
  getEditor,
  getAutoOpenEditor,
  getSolvedAcHandle,
  getArchiveStrategy,
  getIncludeTag,
} from '../core/config';
import type { ProjectConfig } from '../types/index';

export type InitStep =
  | 'archive-dir'
  | 'solving-dir'
  | 'archive-strategy'
  | 'language'
  | 'editor'
  | 'auto-open'
  | 'include-tag'
  | 'handle'
  | 'done'
  | 'cancelled'
  | 'confirm-exit';

export interface CompletedStep {
  label: string;
  value: string;
}

export interface UseInitParams {
  onComplete: () => void;
}

export interface UseInitReturn {
  currentStep: InitStep;
  completedSteps: CompletedStep[];
  confirmExit: boolean;
  initialized: boolean;
  archiveDir: string;
  solvingDir: string;
  archiveStrategy: string;
  language: string;
  editor: string;
  autoOpen: boolean;
  includeTag: boolean;
  handle: string;
  handleInputMode: boolean;
  created: string[];
  cancelled: boolean;
  setArchiveDirValue: (value: string) => void;
  setSolvingDirValue: (value: string) => void;
  setArchiveStrategy: (value: string) => void;
  setLanguage: (value: string) => void;
  setEditorValue: (value: string) => void;
  setAutoOpen: (value: boolean) => void;
  setIncludeTag: (value: boolean) => void;
  setHandle: (value: string) => void;
  setHandleInputMode: (value: boolean) => void;
  setConfirmExit: (value: boolean) => void;
  setCurrentStep: (step: InitStep) => void;
  setCancelled: (value: boolean) => void;
  moveToNextStep: (
    selectedValue: string,
    stepLabel: string,
    handleValue?: string,
  ) => void;
  getStepLabel: (step: InitStep) => string;
  getStepValue: (step: InitStep) => string;
}

export function useInit({ onComplete }: UseInitParams): UseInitReturn {
  const [currentStep, setCurrentStep] = useState<InitStep>('archive-dir');
  const [completedSteps, setCompletedSteps] = useState<CompletedStep[]>([]);
  const [confirmExit, setConfirmExit] = useState(false);

  // 프로젝트별 config 파일에서 초기값 로드
  const [initialized, setInitialized] = useState(false);
  const [archiveDir, setArchiveDirValue] = useState<string>(getArchiveDir());
  const [solvingDir, setSolvingDirValue] = useState<string>(getSolvingDir());
  const [archiveStrategy, setArchiveStrategy] =
    useState<string>(getArchiveStrategy());
  const [language, setLanguage] = useState<string>(getDefaultLanguage());
  const [editor, setEditorValue] = useState<string>(getEditor());
  const [autoOpen, setAutoOpen] = useState<boolean>(getAutoOpenEditor());
  const [includeTag, setIncludeTag] = useState<boolean>(getIncludeTag());
  const [handle, setHandle] = useState<string>(getSolvedAcHandle() || '');
  const [handleInputMode, setHandleInputMode] = useState<boolean>(false);
  const [created, setCreated] = useState<string[]>([]);
  const [cancelled, setCancelled] = useState(false);

  // Ctrl+C 처리 - 확인 모드
  useEffect(() => {
    const handleSigInt = () => {
      if (confirmExit) {
        // 이미 확인 모드인 경우 즉시 종료
        setCancelled(true);
        setCurrentStep('cancelled');
        setTimeout(() => {
          onComplete();
        }, 500);
        return;
      }

      // 확인 모드 진입
      setConfirmExit(true);
    };

    process.on('SIGINT', handleSigInt);
    return () => {
      process.off('SIGINT', handleSigInt);
    };
  }, [confirmExit, onComplete]);

  // 프로젝트별 config 파일 로드
  useEffect(() => {
    async function loadProjectConfig() {
      try {
        const cwd = process.cwd();
        const projectConfigPath = join(cwd, '.ps-cli.json');
        await access(projectConfigPath);
        const configContent = await readFile(projectConfigPath, 'utf-8');
        const projectConfig = JSON.parse(configContent);

        if (projectConfig.archiveDir)
          setArchiveDirValue(projectConfig.archiveDir);
        if (projectConfig.solvingDir)
          setSolvingDirValue(projectConfig.solvingDir);
        if (projectConfig.archiveStrategy)
          setArchiveStrategy(projectConfig.archiveStrategy);
        if (projectConfig.defaultLanguage)
          setLanguage(projectConfig.defaultLanguage);
        if (projectConfig.editor) setEditorValue(projectConfig.editor);
        if (projectConfig.autoOpenEditor !== undefined)
          setAutoOpen(projectConfig.autoOpenEditor);
        if (projectConfig.includeTag !== undefined)
          setIncludeTag(projectConfig.includeTag);
        if (projectConfig.solvedAcHandle)
          setHandle(projectConfig.solvedAcHandle);
      } catch {
        // 파일이 없으면 기본값 사용 (무시)
      } finally {
        setInitialized(true);
      }
    }
    void loadProjectConfig();
  }, []);

  const getStepLabel = useCallback((step: InitStep): string => {
    switch (step) {
      case 'archive-dir':
        return '아카이브 디렉토리 설정 (아카이브된 문제)';
      case 'solving-dir':
        return 'Solving 디렉토리 설정 (푸는 중인 문제)';
      case 'archive-strategy':
        return '아카이빙 전략 설정';
      case 'language':
        return '기본 언어 설정';
      case 'editor':
        return '에디터 설정';
      case 'auto-open':
        return '자동 에디터 열기';
      case 'include-tag':
        return 'README에 알고리즘 분류 포함';
      case 'handle':
        return 'Solved.ac 핸들 (선택)';
      default:
        return '';
    }
  }, []);

  const getStepValue = useCallback(
    (step: InitStep): string => {
      switch (step) {
        case 'archive-dir':
          return archiveDir === '.' ? '프로젝트 루트' : archiveDir;
        case 'solving-dir':
          return solvingDir === '.' ? '프로젝트 루트' : solvingDir;
        case 'archive-strategy': {
          const strategyLabels: Record<string, string> = {
            flat: '평면 (전부 나열)',
            'by-range': '1000번대 묶기',
            'by-tier': '티어별',
            'by-tag': '태그별',
          };
          return strategyLabels[archiveStrategy] || archiveStrategy;
        }
        case 'language':
          return language;
        case 'editor':
          return editor;
        case 'auto-open':
          return autoOpen ? '예' : '아니오';
        case 'include-tag':
          return includeTag ? '예' : '아니오';
        case 'handle':
          return handle || '(스킵)';
        default:
          return '';
      }
    },
    [
      archiveDir,
      solvingDir,
      language,
      editor,
      autoOpen,
      includeTag,
      handle,
      archiveStrategy,
    ],
  );

  const executeInit = useCallback(
    async (overrideHandle?: string) => {
      try {
        const cwd = process.cwd();

        // 프로젝트별 메타데이터 파일 생성 (.ps-cli.json)
        const projectConfigPath = join(cwd, '.ps-cli.json');
        const projectConfig: ProjectConfig = {
          archiveDir,
          solvingDir,
          archiveStrategy,
          defaultLanguage: language,
          editor,
          autoOpenEditor: autoOpen,
          includeTag,
        };
        // handle이 존재하고 빈 문자열이 아닐 때만 추가
        // overrideHandle이 있으면 우선 사용, 없으면 상태의 handle 사용
        const handleToUse = overrideHandle ?? handle;
        if (
          handleToUse &&
          typeof handleToUse === 'string' &&
          handleToUse.trim().length > 0
        ) {
          projectConfig.solvedAcHandle = handleToUse.trim();
        }
        await writeFile(
          projectConfigPath,
          JSON.stringify(projectConfig, null, 2),
          'utf-8',
        );
        setCreated((prev) => [...prev, '.ps-cli.json']);

        // archiveDir가 "." 또는 ""인 경우 디렉토리 생성 스킵
        if (archiveDir !== '.' && archiveDir !== '') {
          const archiveDirPath = join(cwd, archiveDir);
          try {
            await mkdir(archiveDirPath, { recursive: true });
            setCreated((prev) => [...prev, `${archiveDir}/`]);
          } catch (err) {
            const error = err as NodeJS.ErrnoException;
            if (error.code !== 'EEXIST') {
              throw err;
            }
          }
        }

        // solvingDir가 "." 또는 ""인 경우 디렉토리 생성 스킵
        if (solvingDir !== '.' && solvingDir !== '') {
          const solvingDirPath = join(cwd, solvingDir);
          try {
            await mkdir(solvingDirPath, { recursive: true });
            setCreated((prev) => [...prev, `${solvingDir}/`]);
          } catch (err) {
            const error = err as NodeJS.ErrnoException;
            if (error.code !== 'EEXIST') {
              throw err;
            }
          }
        }

        // .gitignore 업데이트 (solving dir만 포함, archive dir은 Git에 커밋)
        const gitignorePath = join(cwd, '.gitignore');
        const gitignorePatterns: string[] = [];
        // archiveDir은 Git에 커밋하므로 .gitignore에 포함하지 않음
        if (solvingDir !== '.' && solvingDir !== '') {
          gitignorePatterns.push(`${solvingDir}/`);
        }

        if (gitignorePatterns.length > 0) {
          try {
            const gitignoreContent = await readFile(gitignorePath, 'utf-8');
            let updatedContent = gitignoreContent.trim();
            let hasChanges = false;

            for (const pattern of gitignorePatterns) {
              if (!gitignoreContent.includes(pattern)) {
                updatedContent +=
                  (updatedContent ? '\n' : '') +
                  `# ps-cli 문제 디렉토리\n${pattern}`;
                hasChanges = true;
              }
            }

            if (hasChanges) {
              await writeFile(gitignorePath, updatedContent + '\n', 'utf-8');
              setCreated((prev) => [...prev, '.gitignore 업데이트']);
            }
          } catch (err) {
            const error = err as NodeJS.ErrnoException;
            if (error.code === 'ENOENT') {
              const content = `# ps-cli 문제 디렉토리\n${gitignorePatterns.join('\n')}\n`;
              await writeFile(gitignorePath, content, 'utf-8');
              setCreated((prev) => [...prev, '.gitignore 생성']);
            } else {
              console.warn('.gitignore 업데이트 실패:', error.message);
            }
          }
        }

        // Git 저장소 초기화 및 커밋
        try {
          const gitDir = join(cwd, '.git');
          let isGitRepo = false;
          try {
            await access(gitDir);
            isGitRepo = true;
          } catch {
            // .git 디렉토리가 없으면 새로 초기화
          }

          if (!isGitRepo) {
            // Git 저장소 초기화
            await execaCommand('git init', { cwd });
            setCreated((prev) => [...prev, 'Git 저장소 초기화']);
          }

          // .ps-cli.json과 .gitignore를 스테이징
          const filesToAdd: string[] = ['.ps-cli.json'];
          const gitignorePath = join(cwd, '.gitignore');
          try {
            await access(gitignorePath);
            filesToAdd.push('.gitignore');
          } catch {
            // .gitignore가 없으면 스킵
          }

          if (filesToAdd.length > 0) {
            await execa('git', ['add', ...filesToAdd], { cwd });

            // 초기 커밋 생성 (이미 커밋이 있는지 확인)
            try {
              await execa('git', ['rev-parse', '--verify', 'HEAD'], { cwd });
              // HEAD가 있으면 커밋 스킵 (이미 커밋이 있는 경우)
            } catch {
              // HEAD가 없으면 초기 커밋 생성
              await execa(
                'git',
                ['commit', '-m', 'chore: ps-cli 프로젝트 초기화'],
                { cwd },
              );
              setCreated((prev) => [...prev, '초기 커밋 생성']);
            }
          }
        } catch (err) {
          // Git 연동 실패해도 계속 진행 (경고만 표시)
          const error = err as NodeJS.ErrnoException;
          console.warn('Git 연동 실패:', error.message);
        }

        setTimeout(() => {
          onComplete();
        }, 3000);
      } catch (err) {
        const error = err as Error;
        console.error('초기화 중 오류 발생:', error.message);
        setCancelled(true);
        setCurrentStep('cancelled');
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    },
    [
      archiveDir,
      solvingDir,
      archiveStrategy,
      language,
      editor,
      autoOpen,
      includeTag,
      handle,
      onComplete,
    ],
  );

  const moveToNextStep = useCallback(
    (selectedValue: string, stepLabel: string, handleValue?: string) => {
      // 현재 단계를 완료 목록에 추가
      setCompletedSteps((prev) => [
        ...prev,
        { label: stepLabel, value: selectedValue },
      ]);

      // handle 단계에서 handleValue가 전달된 경우 즉시 업데이트
      if (currentStep === 'handle' && handleValue !== undefined) {
        setHandle(handleValue);
      }

      const stepOrder: InitStep[] = [
        'archive-dir',
        'solving-dir',
        'archive-strategy',
        'language',
        'editor',
        'auto-open',
        'include-tag',
        'handle',
        'done',
      ];
      const currentIndex = stepOrder.indexOf(currentStep);
      if (currentIndex < stepOrder.length - 1) {
        const nextStep = stepOrder[currentIndex + 1];
        setCurrentStep(nextStep);

        // 다음 step이 "done"이면 초기화 실행
        // handle 단계에서 handleValue가 전달된 경우 해당 값을 executeInit에 전달
        if (nextStep === 'done') {
          if (currentStep === 'handle' && handleValue !== undefined) {
            void executeInit(handleValue.trim());
          } else {
            void executeInit();
          }
        }
      }
    },
    [currentStep, executeInit],
  );

  return {
    currentStep,
    completedSteps,
    confirmExit,
    initialized,
    archiveDir,
    solvingDir,
    archiveStrategy,
    language,
    editor,
    autoOpen,
    includeTag,
    handle,
    handleInputMode,
    created,
    cancelled,
    setArchiveDirValue,
    setSolvingDirValue,
    setArchiveStrategy,
    setLanguage,
    setEditorValue,
    setAutoOpen,
    setIncludeTag,
    setHandle,
    setHandleInputMode,
    setConfirmExit,
    setCurrentStep,
    setCancelled,
    moveToNextStep,
    getStepLabel,
    getStepValue,
  };
}
