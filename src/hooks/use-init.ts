import { mkdir, readFile, writeFile, access } from "fs/promises";
import { join } from "path";

import { execaCommand, execa } from "execa";
import { useEffect, useState, useCallback } from "react";

import {
  getProblemDir,
  getDefaultLanguage,
  getEditor,
  getAutoOpenEditor,
  getSolvedAcHandle,
} from "../utils/config";

export type InitStep =
  | "problem-dir"
  | "language"
  | "editor"
  | "auto-open"
  | "handle"
  | "done"
  | "cancelled"
  | "confirm-exit";

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
  problemDir: string;
  language: string;
  editor: string;
  autoOpen: boolean;
  handle: string;
  handleInputMode: boolean;
  created: string[];
  cancelled: boolean;
  setProblemDirValue: (value: string) => void;
  setLanguage: (value: string) => void;
  setEditorValue: (value: string) => void;
  setAutoOpen: (value: boolean) => void;
  setHandle: (value: string) => void;
  setHandleInputMode: (value: boolean) => void;
  setConfirmExit: (value: boolean) => void;
  setCurrentStep: (step: InitStep) => void;
  setCancelled: (value: boolean) => void;
  moveToNextStep: (selectedValue: string, stepLabel: string) => void;
  getStepLabel: (step: InitStep) => string;
  getStepValue: (step: InitStep) => string;
}

export function useInit({ onComplete }: UseInitParams): UseInitReturn {
  const [currentStep, setCurrentStep] = useState<InitStep>("problem-dir");
  const [completedSteps, setCompletedSteps] = useState<CompletedStep[]>([]);
  const [confirmExit, setConfirmExit] = useState(false);

  // 프로젝트별 config 파일에서 초기값 로드
  const [initialized, setInitialized] = useState(false);
  const [problemDir, setProblemDirValue] = useState<string>(getProblemDir());
  const [language, setLanguage] = useState<string>(getDefaultLanguage());
  const [editor, setEditorValue] = useState<string>(getEditor());
  const [autoOpen, setAutoOpen] = useState<boolean>(getAutoOpenEditor());
  const [handle, setHandle] = useState<string>(getSolvedAcHandle() || "");
  const [handleInputMode, setHandleInputMode] = useState<boolean>(false);
  const [created, setCreated] = useState<string[]>([]);
  const [cancelled, setCancelled] = useState(false);

  // Ctrl+C 처리 - 확인 모드
  useEffect(() => {
    const handleSigInt = () => {
      if (confirmExit) {
        // 이미 확인 모드인 경우 즉시 종료
        setCancelled(true);
        setCurrentStep("cancelled");
        setTimeout(() => {
          onComplete();
        }, 500);
        return;
      }

      // 확인 모드 진입
      setConfirmExit(true);
    };

    process.on("SIGINT", handleSigInt);
    return () => {
      process.off("SIGINT", handleSigInt);
    };
  }, [confirmExit, onComplete]);

  // 프로젝트별 config 파일 로드
  useEffect(() => {
    async function loadProjectConfig() {
      try {
        const cwd = process.cwd();
        const projectConfigPath = join(cwd, ".ps-cli.json");
        await access(projectConfigPath);
        const configContent = await readFile(projectConfigPath, "utf-8");
        const projectConfig = JSON.parse(configContent);

        if (projectConfig.problemDir)
          setProblemDirValue(projectConfig.problemDir);
        if (projectConfig.defaultLanguage)
          setLanguage(projectConfig.defaultLanguage);
        if (projectConfig.editor) setEditorValue(projectConfig.editor);
        if (projectConfig.autoOpenEditor !== undefined)
          setAutoOpen(projectConfig.autoOpenEditor);
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
      case "problem-dir":
        return "문제 디렉토리 설정";
      case "language":
        return "기본 언어 설정";
      case "editor":
        return "에디터 설정";
      case "auto-open":
        return "자동 에디터 열기";
      case "handle":
        return "Solved.ac 핸들 (선택)";
      default:
        return "";
    }
  }, []);

  const getStepValue = useCallback(
    (step: InitStep): string => {
      switch (step) {
        case "problem-dir":
          return problemDir === "." ? "프로젝트 루트" : problemDir;
        case "language":
          return language;
        case "editor":
          return editor;
        case "auto-open":
          return autoOpen ? "예" : "아니오";
        case "handle":
          return handle || "(스킵)";
        default:
          return "";
      }
    },
    [problemDir, language, editor, autoOpen, handle],
  );

  const executeInit = useCallback(async () => {
    try {
      const cwd = process.cwd();

      // 프로젝트별 메타데이터 파일 생성 (.ps-cli.json)
      const projectConfigPath = join(cwd, ".ps-cli.json");
      const projectConfig = {
        problemDir,
        defaultLanguage: language,
        editor,
        autoOpenEditor: autoOpen,
        solvedAcHandle: handle || undefined,
      };
      await writeFile(
        projectConfigPath,
        JSON.stringify(projectConfig, null, 2),
        "utf-8",
      );
      setCreated((prev) => [...prev, ".ps-cli.json"]);

      // problemDir가 "." 또는 ""인 경우 디렉토리 생성 스킵
      if (problemDir !== "." && problemDir !== "") {
        const problemDirPath = join(cwd, problemDir);
        try {
          await mkdir(problemDirPath, { recursive: true });
          setCreated((prev) => [...prev, `${problemDir}/`]);
        } catch (err) {
          const error = err as NodeJS.ErrnoException;
          if (error.code !== "EEXIST") {
            throw err;
          }
        }

        // .gitignore 업데이트
        const gitignorePath = join(cwd, ".gitignore");
        const gitignorePattern = `${problemDir}/`;
        try {
          const gitignoreContent = await readFile(gitignorePath, "utf-8");
          if (!gitignoreContent.includes(gitignorePattern)) {
            const updatedContent =
              gitignoreContent.trim() +
              (gitignoreContent.trim() ? "\n" : "") +
              `\n# ps-cli 문제 디렉토리\n${gitignorePattern}\n`;
            await writeFile(gitignorePath, updatedContent, "utf-8");
            setCreated((prev) => [...prev, ".gitignore 업데이트"]);
          }
        } catch (err) {
          const error = err as NodeJS.ErrnoException;
          if (error.code === "ENOENT") {
            await writeFile(
              gitignorePath,
              `# ps-cli 문제 디렉토리\n${gitignorePattern}\n`,
              "utf-8",
            );
            setCreated((prev) => [...prev, ".gitignore 생성"]);
          } else {
            console.warn(".gitignore 업데이트 실패:", error.message);
          }
        }
      }

      // Git 저장소 초기화 및 커밋
      try {
        const gitDir = join(cwd, ".git");
        let isGitRepo = false;
        try {
          await access(gitDir);
          isGitRepo = true;
        } catch {
          // .git 디렉토리가 없으면 새로 초기화
        }

        if (!isGitRepo) {
          // Git 저장소 초기화
          await execaCommand("git init", { cwd });
          setCreated((prev) => [...prev, "Git 저장소 초기화"]);
        }

        // .ps-cli.json과 .gitignore를 스테이징
        const filesToAdd: string[] = [".ps-cli.json"];
        const gitignorePath = join(cwd, ".gitignore");
        try {
          await access(gitignorePath);
          filesToAdd.push(".gitignore");
        } catch {
          // .gitignore가 없으면 스킵
        }

        if (filesToAdd.length > 0) {
          await execa("git", ["add", ...filesToAdd], { cwd });

          // 초기 커밋 생성 (이미 커밋이 있는지 확인)
          try {
            await execa("git", ["rev-parse", "--verify", "HEAD"], { cwd });
            // HEAD가 있으면 커밋 스킵 (이미 커밋이 있는 경우)
          } catch {
            // HEAD가 없으면 초기 커밋 생성
            await execa(
              "git",
              ["commit", "-m", "chore: ps-cli 프로젝트 초기화"],
              { cwd },
            );
            setCreated((prev) => [...prev, "초기 커밋 생성"]);
          }
        }
      } catch (err) {
        // Git 연동 실패해도 계속 진행 (경고만 표시)
        const error = err as NodeJS.ErrnoException;
        console.warn("Git 연동 실패:", error.message);
      }

      setTimeout(() => {
        onComplete();
      }, 3000);
    } catch (err) {
      const error = err as Error;
      console.error("초기화 중 오류 발생:", error.message);
      setCancelled(true);
      setCurrentStep("cancelled");
      setTimeout(() => {
        onComplete();
      }, 2000);
    }
  }, [problemDir, language, editor, autoOpen, handle, onComplete]);

  const moveToNextStep = useCallback(
    (selectedValue: string, stepLabel: string) => {
      // 현재 단계를 완료 목록에 추가
      setCompletedSteps((prev) => [
        ...prev,
        { label: stepLabel, value: selectedValue },
      ]);

      const stepOrder: InitStep[] = [
        "problem-dir",
        "language",
        "editor",
        "auto-open",
        "handle",
        "done",
      ];
      const currentIndex = stepOrder.indexOf(currentStep);
      if (currentIndex < stepOrder.length - 1) {
        const nextStep = stepOrder[currentIndex + 1];
        setCurrentStep(nextStep);

        // 다음 step이 "done"이면 초기화 실행
        if (nextStep === "done") {
          void executeInit();
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
    problemDir,
    language,
    editor,
    autoOpen,
    handle,
    handleInputMode,
    created,
    cancelled,
    setProblemDirValue,
    setLanguage,
    setEditorValue,
    setAutoOpen,
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
