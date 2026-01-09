import React, { useState, useEffect } from "react";
import { render, Text, Box } from "ink";
import { mkdir, readFile, writeFile, access } from "fs/promises";
import { join } from "path";
import {
  Select,
  TextInput,
  StatusMessage,
  Alert,
  ConfirmInput,
} from "@inkjs/ui";
import type { CommandDefinition } from "../types/command";
import {
  getProblemDir,
  setProblemDir,
  getDefaultLanguage,
  setDefaultLanguage,
  getEditor,
  setEditor,
  getAutoOpenEditor,
  setAutoOpenEditor,
  getSolvedAcHandle,
  setSolvedAcHandle,
} from "../utils/config";
import { getSupportedLanguages } from "../utils/language";

type InitStep =
  | "problem-dir"
  | "language"
  | "editor"
  | "auto-open"
  | "handle"
  | "done"
  | "cancelled"
  | "confirm-exit";

interface CompletedStep {
  label: string;
  value: string;
}

interface InitCommandProps {
  onComplete: () => void;
}

function InitCommand({ onComplete }: InitCommandProps) {
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
      } catch (err) {
        // 파일이 없으면 기본값 사용 (무시)
      } finally {
        setInitialized(true);
      }
    }
    loadProjectConfig();
  }, []);

  function getStepLabel(step: InitStep): string {
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
  }

  function moveToNextStep(selectedValue: string, stepLabel: string) {
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
  }

  function getStepValue(step: InitStep): string {
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
  }

  async function executeInit() {
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
        "utf-8"
      );
      setCreated((prev) => [...prev, ".ps-cli.json"]);

      // Global config에도 저장 (하위 호환성)
      setProblemDir(problemDir);
      setDefaultLanguage(language);
      setEditor(editor);
      setAutoOpenEditor(autoOpen);
      if (handle) {
        setSolvedAcHandle(handle);
      }

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
              "utf-8"
            );
            setCreated((prev) => [...prev, ".gitignore 생성"]);
          } else {
            console.warn(".gitignore 업데이트 실패:", error.message);
          }
        }
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
  }

  function renderQuestionCard(title: string, children: React.ReactNode) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Alert variant="info">{title}</Alert>
        <Box marginTop={1} flexDirection="column">
          {children}
        </Box>
      </Box>
    );
  }

  function renderStepContent() {
    if (cancelled || currentStep === "cancelled") {
      return <Alert variant="error">초기화가 취소되었습니다.</Alert>;
    }

    if (confirmExit) {
      return (
        <Box flexDirection="column">
          <Alert variant="error">정말 종료하시겠습니까?</Alert>
          <Box marginTop={1}>
            <ConfirmInput
              onConfirm={() => {
                setCancelled(true);
                setCurrentStep("cancelled");
                setConfirmExit(false);
                setTimeout(() => {
                  onComplete();
                }, 500);
              }}
              onCancel={() => {
                setConfirmExit(false);
              }}
            />
          </Box>
        </Box>
      );
    }

    switch (currentStep) {
      case "problem-dir": {
        const options = [
          { label: "problems", value: "problems" },
          { label: ". (프로젝트 루트)", value: "." },
        ];
        return renderQuestionCard(
          getStepLabel(currentStep),
          <Select
            options={options}
            onChange={(value) => {
              setProblemDirValue(value);
              const displayValue = value === "." ? "프로젝트 루트" : value;
              moveToNextStep(displayValue, getStepLabel(currentStep));
            }}
          />
        );
      }

      case "language": {
        const supportedLanguages = getSupportedLanguages();
        const options = supportedLanguages.map((lang) => ({
          label: lang,
          value: lang,
        }));
        return renderQuestionCard(
          getStepLabel(currentStep),
          <Select
            options={options}
            onChange={(value) => {
              setLanguage(value);
              moveToNextStep(value, getStepLabel(currentStep));
            }}
          />
        );
      }

      case "editor": {
        const options = [
          { label: "code", value: "code" },
          { label: "cursor", value: "cursor" },
          { label: "vim", value: "vim" },
          { label: "nano", value: "nano" },
        ];
        return renderQuestionCard(
          getStepLabel(currentStep),
          <Select
            options={options}
            onChange={(value) => {
              setEditorValue(value);
              moveToNextStep(value, getStepLabel(currentStep));
            }}
          />
        );
      }

      case "auto-open": {
        const options = [
          { label: "예", value: "true" },
          { label: "아니오", value: "false" },
        ];
        return renderQuestionCard(
          getStepLabel(currentStep),
          <Select
            options={options}
            onChange={(value) => {
              setAutoOpen(value === "true");
              moveToNextStep(
                value === "true" ? "예" : "아니오",
                getStepLabel(currentStep)
              );
            }}
          />
        );
      }

      case "handle": {
        if (handleInputMode) {
          return renderQuestionCard(
            getStepLabel(currentStep),
            <Box>
              <TextInput
                placeholder="핸들 입력"
                onSubmit={(value) => {
                  setHandle(value);
                  setHandleInputMode(false);
                  moveToNextStep(value || "(스킵)", getStepLabel(currentStep));
                }}
              />
            </Box>
          );
        }
        const options = [
          { label: "설정", value: "set" },
          { label: "스킵", value: "skip" },
        ];
        return renderQuestionCard(
          getStepLabel(currentStep),
          <Select
            options={options}
            onChange={(value) => {
              if (value === "skip") {
                setHandle("");
                moveToNextStep("(스킵)", getStepLabel(currentStep));
              } else {
                setHandleInputMode(true);
              }
            }}
          />
        );
      }

      case "done": {
        const createdItemsText =
          created.length > 0
            ? `\n생성된 항목:\n${created.map((item) => `• ${item}`).join("\n")}`
            : "";
        return (
          <Box flexDirection="column">
            <Alert variant="success">
              프로젝트 초기화 완료{createdItemsText}
            </Alert>
            <Box marginTop={1}>
              <Text color="gray">
                이제{" "}
                <Text bold color="cyan">
                  ps help
                </Text>{" "}
                명령어를 통해 더 자세한 정보를 확인할 수 있습니다.
              </Text>
            </Box>
          </Box>
        );
      }

      default:
        return null;
    }
  }

  if (!initialized) {
    return (
      <Box>
        <Text color="gray">로딩 중...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* 헤더 */}
      <Box marginBottom={completedSteps.length > 0 ? 1 : 0}>
        <Text color="cyan" bold>
          🚀 ps-cli 프로젝트 초기화
        </Text>
      </Box>

      {/* 완료된 단계 표시 */}
      {completedSteps.length > 0 && (
        <Box flexDirection="column">
          {completedSteps.map((step, idx) => (
            <StatusMessage key={idx} variant="success">
              {step.label}: {step.value}
            </StatusMessage>
          ))}
        </Box>
      )}

      {/* 현재 단계 */}
      {renderStepContent()}
    </Box>
  );
}

async function initCommand() {
  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <InitCommand
        onComplete={() => {
          unmount();
          resolve();
        }}
      />
    );
  });
}

export const initHelp = `
  사용법:
    $ ps init

  설명:
    현재 디렉토리를 ps-cli 프로젝트로 대화형으로 초기화합니다.
    - 단계별로 설정을 물어봅니다
    - 문제 디렉토리, 기본 언어, 에디터 등을 설정할 수 있습니다

  예제:
    $ ps init
`;

export async function initExecute(
  args: string[],
  flags: { help?: boolean }
): Promise<void> {
  if (flags.help) {
    console.log(initHelp.trim());
    process.exit(0);
    return;
  }

  await initCommand();
}

const initCommandDef: CommandDefinition = {
  name: "init",
  help: initHelp,
  execute: initExecute,
};

export default initCommandDef;
