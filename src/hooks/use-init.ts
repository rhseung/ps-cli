import { existsSync } from 'fs';
import {
  mkdir,
  readFile,
  writeFile,
  access,
  copyFile,
  readdir,
} from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { execaCommand, execa } from 'execa';
import { useEffect, useState, useCallback } from 'react';

import type { ConfigKey } from '../core/config';
import {
  getArchiveDir,
  getSolvingDir,
  getDefaultLanguage,
  getEditor,
  getAutoOpenEditor,
  getSolvedAcHandle,
  getArchiveStrategy,
  getIncludeTag,
  getConfigMetadata,
} from '../core/config';

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
  form: InitForm;
  handleInputMode: boolean;
  created: string[];
  cancelled: boolean;
  setForm: React.Dispatch<React.SetStateAction<InitForm>>;
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

// 프로젝트 루트 경로 찾기 (dist 또는 src에서 실행될 수 있음)
function getCliRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  let current = __dirname;
  while (current !== dirname(current)) {
    const templatesDir = join(current, 'templates');
    try {
      // package.json과 templates 디렉토리가 같이 있는 곳을 루트로 간주
      const stats = existsSync(templatesDir);
      if (stats) return current;
    } catch {
      // ignore
    }
    current = dirname(current);
  }

  return join(__dirname, '../..');
}

function buildDefaultConfigYaml({
  language,
  editor,
  autoOpen,
  solvingDir,
  archiveDir,
  archiveStrategy,
  includeTag,
  handle,
}: InitForm): string {
  return `
# ps-cli 설정 파일
# 더 자세한 정보는 다음을 참고하세요: https://github.com/rhseung/ps-cli

general:
  # 새로운 문제를 가져올 때 사용할 기본 프로그래밍 언어입니다.
  default_language: ${language}
  # 통계 조회를 위한 Solved.ac 핸들(닉네임)입니다.
  solved_ac_handle: "${handle}"

editor:
  # 에디터를 열 때 사용할 명령어입니다 (예: code, cursor, vim).
  command: ${editor}
  # 문제를 가져온 후 자동으로 에디터를 열지 여부입니다.
  auto_open: ${autoOpen}

paths:
  # 현재 풀고 있는 문제들을 담을 디렉토리 경로입니다.
  solving: ${solvingDir}
  # 해결한 문제를 보관할 디렉토리 경로입니다.
  archive: ${archiveDir}
  # 아카이빙 전략입니다 (flat, by-range, by-tier, by-tag).
  archive_strategy: ${archiveStrategy}

archive:
  # 아카이브 시 자동으로 Git 커밋을 수행할지 여부입니다.
  auto_commit: true
  # Git 커밋 메시지 템플릿입니다 ({id}, {title} 사용 가능).
  commit_message: "feat: solve {id} {title}"

markdown:
  # 문제 README에 알고리즘 분류(태그)를 포함할지 여부입니다.
  include_tag: ${includeTag}

# 언어별 설정
# 이곳에서 컴파일/실행 명령어나 템플릿 파일명을 수정하거나 새로운 언어를 추가할 수 있습니다.
languages:
  python:
    extension: py
    # 템플릿 파일명 (옵션, 기본값: solution.py)
    template_file: "solution.py"
    # 실행 명령어 (필수)
    run: python3
  cpp:
    extension: cpp
    # 템플릿 파일명 (옵션, 기본값: solution.cpp)
    template_file: "solution.cpp"
    # 컴파일 명령어 (옵션)
    compile: "g++ -fdiagnostics-absolute-paths -o solution solution.cpp"
    # 실행 명령어 (필수)
    run: "./solution"
  #   rust:
  #     extension: rs
  #     # 템플릿 파일명을 직접 지정하려면 template_file을 사용하세요 (기본: solution.{extension})
  #     template_file: "solution.rs"
  #     compile: "rustc {file}"
  #     run: "./{file_no_ext}"
`.trim();
}

export interface InitForm {
  archiveDir: string;
  solvingDir: string;
  archiveStrategy: string;
  language: string;
  editor: string;
  autoOpen: boolean;
  includeTag: boolean;
  handle: string;
}

export function useInit({ onComplete }: UseInitParams): UseInitReturn {
  const [currentStep, setCurrentStep] = useState<InitStep>('archive-dir');
  const [completedSteps, setCompletedSteps] = useState<CompletedStep[]>([]);
  const [confirmExit, setConfirmExit] = useState(false);

  // 프로젝트별 config 파일에서 초기값 로드
  const [initialized, setInitialized] = useState(false);
  const [form, setForm] = useState<InitForm>({
    archiveDir: getArchiveDir(),
    solvingDir: getSolvingDir(),
    archiveStrategy: getArchiveStrategy(),
    language: getDefaultLanguage(),
    editor: getEditor(),
    autoOpen: getAutoOpenEditor(),
    includeTag: getIncludeTag(),
    handle: getSolvedAcHandle() || '',
  });
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

        setForm((prev) => ({
          ...prev,
          archiveDir: projectConfig.archiveDir ?? prev.archiveDir,
          solvingDir: projectConfig.solvingDir ?? prev.solvingDir,
          archiveStrategy:
            projectConfig.archiveStrategy ?? prev.archiveStrategy,
          language: projectConfig.defaultLanguage ?? prev.language,
          editor: projectConfig.editor ?? prev.editor,
          autoOpen:
            projectConfig.autoOpenEditor !== undefined
              ? projectConfig.autoOpenEditor
              : prev.autoOpen,
          includeTag:
            projectConfig.includeTag !== undefined
              ? projectConfig.includeTag
              : prev.includeTag,
          handle: projectConfig.solvedAcHandle ?? prev.handle,
        }));
      } catch {
        // 파일이 없으면 기본값 사용 (무시)
      } finally {
        setInitialized(true);
      }
    }
    void loadProjectConfig();
  }, []);

  const getStepLabel = useCallback((step: InitStep): string => {
    const stepToConfigKey: Partial<Record<InitStep, ConfigKey>> = {
      'archive-dir': 'paths.archive',
      'solving-dir': 'paths.solving',
      'archive-strategy': 'paths.archive-strategy',
      language: 'general.default-language',
      editor: 'editor.command',
      'auto-open': 'editor.auto-open',
      'include-tag': 'markdown.include-tag',
      handle: 'general.solved-ac-handle',
    };
    const configKey = stepToConfigKey[step];
    if (!configKey) return '';
    const meta = getConfigMetadata().find((m) => m.key === configKey);
    return meta?.label ?? '';
  }, []);

  const getStepValue = useCallback(
    (step: InitStep): string => {
      switch (step) {
        case 'archive-dir':
          return form.archiveDir === '.' ? '프로젝트 루트' : form.archiveDir;
        case 'solving-dir':
          return form.solvingDir === '.' ? '프로젝트 루트' : form.solvingDir;
        case 'archive-strategy': {
          const strategyLabels: Record<string, string> = {
            flat: '평면 (전부 나열)',
            'by-range': '1000번대 묶기',
            'by-tier': '티어별',
            'by-tag': '태그별',
          };
          return strategyLabels[form.archiveStrategy] || form.archiveStrategy;
        }
        case 'language':
          return form.language;
        case 'editor':
          return form.editor;
        case 'auto-open':
          return form.autoOpen ? '예' : '아니오';
        case 'include-tag':
          return form.includeTag ? '예' : '아니오';
        case 'handle':
          return form.handle || '(스킵)';
        default:
          return '';
      }
    },
    [form],
  );

  const executeInit = useCallback(
    async (overrideHandle?: string) => {
      try {
        const cwd = process.cwd();
        const cliRoot = getCliRoot();

        // .ps-cli 폴더 생성
        const psCliDir = join(cwd, '.ps-cli');
        const templatesDir = join(psCliDir, 'templates');
        await mkdir(psCliDir, { recursive: true });
        await mkdir(templatesDir, { recursive: true });
        setCreated((prev) => [...prev, '.ps-cli/']);

        // .ps-cli/config.yaml 생성 (주석 포함)
        const handleToUse = (overrideHandle ?? form.handle)?.trim() || '';
        const configYaml = buildDefaultConfigYaml({
          language: form.language,
          editor: form.editor,
          autoOpen: form.autoOpen,
          solvingDir: form.solvingDir,
          archiveDir: form.archiveDir,
          archiveStrategy: form.archiveStrategy,
          includeTag: form.includeTag,
          handle: handleToUse,
        });

        await writeFile(join(psCliDir, 'config.yaml'), configYaml, 'utf-8');
        setCreated((prev) => [...prev, '.ps-cli/config.yaml']);

        // 기본 템플릿 복사
        const defaultTemplatesDir = join(cliRoot, 'templates');
        if (existsSync(defaultTemplatesDir)) {
          const files = await readdir(defaultTemplatesDir);
          for (const file of files) {
            await copyFile(
              join(defaultTemplatesDir, file),
              join(templatesDir, file),
            );
          }
          setCreated((prev) => [
            ...prev,
            '.ps-cli/templates/ (기본 템플릿 복사)',
          ]);
        }

        // archiveDir가 "." 또는 ""인 경우 디렉토리 생성 스킵
        if (form.archiveDir !== '.' && form.archiveDir !== '') {
          const archiveDirPath = join(cwd, form.archiveDir);
          try {
            await mkdir(archiveDirPath, { recursive: true });
            setCreated((prev) => [...prev, `${form.archiveDir}/`]);
          } catch (err) {
            const error = err as NodeJS.ErrnoException;
            if (error.code !== 'EEXIST') {
              throw err;
            }
          }
        }

        // solvingDir가 "." 또는 ""인 경우 디렉토리 생성 스킵
        if (form.solvingDir !== '.' && form.solvingDir !== '') {
          const solvingDirPath = join(cwd, form.solvingDir);
          try {
            await mkdir(solvingDirPath, { recursive: true });
            setCreated((prev) => [...prev, `${form.solvingDir}/`]);
          } catch (err) {
            const error = err as NodeJS.ErrnoException;
            if (error.code !== 'EEXIST') {
              throw err;
            }
          }
        }

        // .gitignore 업데이트
        const gitignorePath = join(cwd, '.gitignore');
        // .ps-cli는 git에 포함시키고, solving dir만 무시하도록 함
        const gitignorePatterns: string[] = [];
        if (form.solvingDir !== '.' && form.solvingDir !== '') {
          gitignorePatterns.push(`${form.solvingDir}/`);
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
                  `\n# ps-cli 문제 디렉토리\n${pattern}`;
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
            await execaCommand('git init', { cwd });
            setCreated((prev) => [...prev, 'Git 저장소 초기화']);
          }

          // .ps-cli 폴더와 .gitignore를 스테이징
          const filesToAdd: string[] = ['.ps-cli'];
          try {
            await access(gitignorePath);
            filesToAdd.push('.gitignore');
          } catch {
            // .gitignore가 없으면 스킵
          }

          if (filesToAdd.length > 0) {
            await execa('git', ['add', ...filesToAdd], { cwd });

            try {
              await execa('git', ['rev-parse', '--verify', 'HEAD'], { cwd });
            } catch {
              await execa(
                'git',
                ['commit', '-m', 'chore: ps-cli 프로젝트 초기화'],
                { cwd },
              );
              setCreated((prev) => [...prev, '초기 커밋 생성']);
            }
          }
        } catch (err) {
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
    [form, onComplete],
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
        setForm((prev) => ({
          ...prev,
          handle: handleValue,
        }));
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
    form,
    handleInputMode,
    created,
    cancelled,
    setForm,
    setHandleInputMode,
    setConfirmExit,
    setCurrentStep,
    setCancelled,
    moveToNextStep,
    getStepLabel,
    getStepValue,
  };
}
