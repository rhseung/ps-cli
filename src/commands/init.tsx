import React, { useState, useEffect } from "react";
import { render, Text, Box } from "ink";
import { mkdir, readFile, writeFile, access } from "fs/promises";
import { join } from "path";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import {
  StepIndicator,
  type Step,
  type StepStatus,
} from "../components/step-indicator";
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
  | "cancelled";

interface InitCommandProps {
  onComplete: () => void;
}

function InitCommand({ onComplete }: InitCommandProps) {
  const [currentStep, setCurrentStep] = useState<InitStep>("problem-dir");
  const [steps, setSteps] = useState<Step[]>([
    { label: "문제 디렉토리 설정", status: "current" },
    { label: "기본 언어 설정", status: "pending" },
    { label: "에디터 설정", status: "pending" },
    { label: "자동 에디터 열기", status: "pending" },
    { label: "Solved.ac 핸들 (선택)", status: "pending" },
  ]);

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

  // Ctrl+C 처리
  useEffect(() => {
    const handleSigInt = () => {
      setCancelled(true);
      setCurrentStep("cancelled");
      const cancelledSteps = steps.map((step, idx) => {
        const stepIndex = getStepIndex(currentStep);
        if (idx === stepIndex) {
          return {
            ...step,
            status: "cancelled" as StepStatus,
            error: "작업이 취소되었습니다",
          };
        }
        return step;
      });
      setSteps(cancelledSteps);
      setTimeout(() => {
        onComplete();
      }, 2000);
    };

    process.on("SIGINT", handleSigInt);
    return () => {
      process.off("SIGINT", handleSigInt);
    };
  }, [currentStep, steps, onComplete]);

  function getStepIndex(step: InitStep): number {
    const stepOrder: InitStep[] = [
      "problem-dir",
      "language",
      "editor",
      "auto-open",
      "handle",
    ];
    return stepOrder.indexOf(step);
  }

  function updateStepStatus(
    stepIndex: number,
    status: StepStatus,
    value?: string,
    error?: string
  ) {
    setSteps((prev) => {
      const newSteps = [...prev];
      if (newSteps[stepIndex]) {
        newSteps[stepIndex] = { ...newSteps[stepIndex], status, value, error };
      }
      return newSteps;
    });
  }

  function moveToNextStep(selectedValue?: string) {
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

      // 현재 step을 완료로 표시 (선택된 값이 있으면 사용, 없으면 현재 값 사용)
      const displayValue = selectedValue || getStepValue(currentStep);
      updateStepStatus(currentIndex, "completed", displayValue);

      setCurrentStep(nextStep);

      // 다음 step이 "done"이면 초기화 실행
      if (nextStep === "done") {
        void executeInit();
      } else if (nextStep !== "cancelled") {
        // 다음 step을 current로 표시
        updateStepStatus(currentIndex + 1, "current");
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

      setCurrentStep("done");

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

      // 모든 step 완료 표시
      setSteps((prev) =>
        prev.map((step) => ({ ...step, status: "completed" as StepStatus }))
      );

      setTimeout(() => {
        onComplete();
      }, 3000);
    } catch (err) {
      const error = err as Error;
      console.error("초기화 중 오류 발생:", error.message);
      const stepIndex = getStepIndex(currentStep);
      updateStepStatus(stepIndex, "cancelled", undefined, error.message);
      setCurrentStep("cancelled");
      setTimeout(() => {
        onComplete();
      }, 2000);
    }
  }

  function renderStepContent() {
    if (cancelled || currentStep === "cancelled") {
      return null;
    }

    switch (currentStep) {
      case "problem-dir": {
        const items = [
          { label: "problems", value: "problems" },
          { label: ".", value: "." },
        ];
        return (
          <SelectInput
            items={items}
            indicatorComponent={() => null}
            itemComponent={({ label, isSelected }) => (
              <Box>
                <Text color="gray">│ </Text>
                <Text color={isSelected ? "yellow" : "white"}>
                  {isSelected ? "●" : "○"} {label}
                </Text>
              </Box>
            )}
            onSelect={(item) => {
              setProblemDirValue(item.value);
              const displayValue =
                item.value === "." ? "프로젝트 루트" : item.value;
              moveToNextStep(displayValue);
            }}
          />
        );
      }

      case "language": {
        const supportedLanguages = getSupportedLanguages();
        const items = supportedLanguages.map((lang) => ({
          label: lang,
          value: lang,
        }));
        return (
          <SelectInput
            items={items}
            indicatorComponent={() => null}
            itemComponent={({ label, isSelected }) => (
              <Box>
                <Text color="gray">│ </Text>
                <Text color={isSelected ? "yellow" : "white"}>
                  {isSelected ? "●" : "○"} {label}
                </Text>
              </Box>
            )}
            onSelect={(item) => {
              setLanguage(item.value as string);
              moveToNextStep(item.value);
            }}
          />
        );
      }

      case "editor": {
        const items = [
          { label: "code", value: "code" },
          { label: "cursor", value: "cursor" },
          { label: "vim", value: "vim" },
          { label: "nano", value: "nano" },
        ];
        return (
          <SelectInput
            items={items}
            indicatorComponent={() => null}
            itemComponent={({ label, isSelected }) => (
              <Box>
                <Text color="gray">│ </Text>
                <Text color={isSelected ? "yellow" : "white"}>
                  {isSelected ? "●" : "○"} {label}
                </Text>
              </Box>
            )}
            onSelect={(item) => {
              setEditorValue(item.value);
              moveToNextStep(item.value);
            }}
          />
        );
      }

      case "auto-open": {
        const items = [
          { label: "예", value: "true" },
          { label: "아니오", value: "false" },
        ];
        return (
          <SelectInput
            items={items}
            indicatorComponent={() => null}
            itemComponent={({ label, isSelected }) => (
              <Box>
                <Text color="gray">│ </Text>
                <Text color={isSelected ? "yellow" : "white"}>
                  {isSelected ? "●" : "○"} {label}
                </Text>
              </Box>
            )}
            onSelect={(item) => {
              setAutoOpen(item.value === "true");
              moveToNextStep(item.value === "true" ? "예" : "아니오");
            }}
          />
        );
      }

      case "handle": {
        if (handleInputMode) {
          return (
            <Box>
              <Text color="gray">│ </Text>
              <TextInput
                value={handle}
                placeholder="핸들 입력"
                onChange={setHandle}
                onSubmit={(value) => {
                  setHandleInputMode(false);
                  moveToNextStep(value || "(스킵)");
                }}
              />
            </Box>
          );
        }
        const items = [
          { label: "설정", value: "set" },
          { label: "스킵", value: "skip" },
        ];
        return (
          <SelectInput
            items={items}
            indicatorComponent={() => null}
            itemComponent={({ label, isSelected }) => (
              <Box>
                <Text color="gray">│ </Text>
                <Text color={isSelected ? "yellow" : "white"}>
                  {isSelected ? "●" : "○"} {label}
                </Text>
              </Box>
            )}
            onSelect={(item) => {
              if (item.value === "skip") {
                setHandle("");
                moveToNextStep("(스킵)");
              } else {
                setHandleInputMode(true);
              }
            }}
          />
        );
      }

      case "done": {
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text color="green">✓ 프로젝트 초기화 완료</Text>
            {created.length > 0 && (
              <Box marginTop={1} flexDirection="column">
                <Text color="gray">생성된 항목:</Text>
                {created.map((item, idx) => (
                  <Text key={idx} color="cyan">
                    • {item}
                  </Text>
                ))}
              </Box>
            )}
            <Box marginTop={1}>
              <Text color="gray">
                이제 <Text bold>ps fetch &lt;문제번호&gt;</Text> 명령어를 사용할
                수 있습니다.
              </Text>
            </Box>
          </Box>
        );
      }

      default:
        return null;
    }
  }

  const currentStepIndex = getStepIndex(currentStep);

  return (
    <Box flexDirection="column">
      <StepIndicator
        steps={steps}
        currentStepIndex={currentStepIndex >= 0 ? currentStepIndex : undefined}
      >
        {renderStepContent()}
      </StepIndicator>
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
