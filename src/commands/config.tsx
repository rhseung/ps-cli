import React from "react";
import { render, Text, Box } from "ink";
import { StatusMessage, Select, TextInput, Alert } from "@inkjs/ui";
import { readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import {
  getBojSessionCookie,
  getDefaultLanguage,
  getCodeOpen,
  getEditor,
  getAutoOpenEditor,
  getSolvedAcHandle,
  getProblemDir,
} from "../utils/config";
import {
  getSupportedLanguages,
  getSupportedLanguagesString,
} from "../utils/language";
import type { CommandDefinition } from "../types/command";

interface ProjectConfig {
  problemDir?: string;
  defaultLanguage?: string;
  editor?: string;
  autoOpenEditor?: boolean;
  solvedAcHandle?: string;
}

function getProjectConfigPath(): string {
  return join(process.cwd(), ".ps-cli.json");
}

async function readProjectConfig(): Promise<ProjectConfig | null> {
  const configPath = getProjectConfigPath();
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content) as ProjectConfig;
  } catch {
    return null;
  }
}

async function writeProjectConfig(config: ProjectConfig): Promise<void> {
  const configPath = getProjectConfigPath();
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function getConfigHelp(): string {
  return `
  사용법:
    $ ps config get [키]
    $ ps config set [키]
    $ ps config list
    $ ps config clear

  설명:
    프로젝트 설정 파일(.ps-cli.json)을 관리합니다.
    설정은 현재 프로젝트의 .ps-cli.json 파일에 저장됩니다.

  명령어:
    get [키]                설정 값 조회 (키 없으면 대화형 선택)
    set [키]                설정 값 설정 (키 없으면 대화형 선택)
    list                    모든 설정 조회
    clear                   .ps-cli.json 파일 삭제

  설정 키:
    default-language       기본 언어 (${getSupportedLanguagesString()})
    editor                 에디터 명령어 (예: code, vim, nano)
    auto-open-editor       fetch 후 자동으로 에디터 열기 (true/false)
    solved-ac-handle       Solved.ac 핸들 (stats 명령어용)
    problem-dir            문제 디렉토리 경로 (기본값: problems, "." 또는 ""는 프로젝트 루트)

  옵션:
    --help, -h             도움말 표시

  예제:
    $ ps config get                         # 대화형으로 키 선택 후 값 조회
    $ ps config get default-language         # default-language 값 조회
    $ ps config set                         # 대화형으로 키 선택 후 값 설정
    $ ps config set editor cursor            # editor를 cursor로 설정
    $ ps config list                         # 모든 설정 조회
    $ ps config clear                        # .ps-cli.json 파일 삭제
`;
}

// index.ts에서 동적으로 로드하기 위한 export
export const configHelp = getConfigHelp();

function ConfigCommand({
  configKey,
  value,
  get,
  list,
  clear,
  onComplete,
}: {
  configKey?: string;
  value?: string;
  get?: boolean;
  list?: boolean;
  clear?: boolean;
  onComplete: () => void;
}) {
  // 모든 hooks를 최상단에 선언 (조건부 렌더링 전에)
  const [config, setConfig] = React.useState<ProjectConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [cleared, setCleared] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    async function loadConfig() {
      const projectConfig = await readProjectConfig();
      setConfig(projectConfig);
      setLoading(false);
    }
    void loadConfig();
  }, []);

  React.useEffect(() => {
    if (clear && !cleared) {
      void (async () => {
        const configPath = getProjectConfigPath();
        if (existsSync(configPath)) {
          await unlink(configPath);
        }
        setCleared(true);
      })();
    }
  }, [clear, cleared]);

  React.useEffect(() => {
    if (configKey && value !== undefined && !saved) {
      void (async () => {
        const currentConfig = (await readProjectConfig()) ?? {};
        let updatedConfig: ProjectConfig = { ...currentConfig };

        switch (configKey) {
          case "default-language": {
            const supportedLanguages = getSupportedLanguages();
            if (!supportedLanguages.includes(value as any)) {
              console.error(
                `지원하지 않는 언어입니다: ${value}\n지원 언어: ${getSupportedLanguagesString()}`
              );
              process.exit(1);
            }
            updatedConfig.defaultLanguage = value;
            break;
          }
          case "editor":
            updatedConfig.editor = value;
            break;
          case "auto-open-editor":
            updatedConfig.autoOpenEditor = value === "true";
            break;
          case "solved-ac-handle":
            updatedConfig.solvedAcHandle = value;
            break;
          case "problem-dir":
            updatedConfig.problemDir = value;
            break;
          default:
            console.error(`알 수 없는 설정 키: ${configKey}`);
            process.exit(1);
        }

        await writeProjectConfig(updatedConfig);
        setSaved(true);
      })();
    }
  }, [configKey, value, saved]);

  // 조건부 렌더링은 hooks 선언 후에
  if (loading) {
    return (
      <Box>
        <StatusMessage variant="info">설정을 불러오는 중...</StatusMessage>
      </Box>
    );
  }

  if (clear) {
    if (!cleared) {
      return (
        <Box>
          <StatusMessage variant="info">
            .ps-cli.json 파일을 삭제하는 중...
          </StatusMessage>
        </Box>
      );
    }
    return (
      <Box>
        <Alert variant="success">.ps-cli.json 파일이 삭제되었습니다.</Alert>
      </Box>
    );
  }

  if (list) {
    const defaultLang = config?.defaultLanguage ?? getDefaultLanguage();
    const editor = config?.editor ?? getEditor();
    const autoOpen = config?.autoOpenEditor ?? getAutoOpenEditor();
    const handle = config?.solvedAcHandle ?? getSolvedAcHandle();
    const problemDir = config?.problemDir ?? getProblemDir();

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            ⚙️ 현재 설정 (.ps-cli.json)
          </Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Box marginBottom={1}>
            <Text color="gray">default-language:</Text>
            <Text> </Text>
            <Text bold>{defaultLang}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="gray">editor:</Text>
            <Text> </Text>
            <Text bold>{editor}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="gray">auto-open-editor:</Text>
            <Text> </Text>
            <Text bold color={autoOpen ? "green" : "gray"}>
              {autoOpen ? "true" : "false"}
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="gray">solved-ac-handle:</Text>
            <Text> </Text>
            <Text bold color={handle ? "cyan" : "gray"}>
              {handle || "설정 안 됨"}
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="gray">problem-dir:</Text>
            <Text> </Text>
            <Text bold>{problemDir}</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (get && configKey) {
    let configValue: string | undefined;
    switch (configKey) {
      case "default-language":
        configValue = config?.defaultLanguage ?? getDefaultLanguage();
        break;
      case "editor":
        configValue = config?.editor ?? getEditor();
        break;
      case "auto-open-editor":
        configValue =
          config?.autoOpenEditor !== undefined
            ? String(config.autoOpenEditor)
            : String(getAutoOpenEditor());
        break;
      case "solved-ac-handle":
        configValue = config?.solvedAcHandle ?? getSolvedAcHandle();
        break;
      case "problem-dir":
        configValue = config?.problemDir ?? getProblemDir();
        break;
      default:
        console.error(`알 수 없는 설정 키: ${configKey}`);
        process.exit(1);
    }

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color="gray">{configKey}:</Text>
          <Text> </Text>
          <Text bold color={configValue ? "cyan" : "gray"}>
            {configValue || "(설정 안 됨)"}
          </Text>
        </Box>
      </Box>
    );
  }

  if (configKey && value !== undefined) {
    if (!saved) {
      return (
        <Box>
          <StatusMessage variant="info">설정을 저장하는 중...</StatusMessage>
        </Box>
      );
    }
    return (
      <Box flexDirection="column">
        <Box marginTop={1}>
          <Alert variant="success">설정이 저장되었습니다</Alert>
        </Box>
        <Box marginTop={1}>
          <Text bold>{value}</Text>
        </Box>
      </Box>
    );
  }

  return null;
}

async function configCommand(
  configKey?: string,
  value?: string,
  get?: boolean,
  list?: boolean,
  clear?: boolean
) {
  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <ConfigCommand
        configKey={configKey}
        value={value}
        get={get}
        list={list}
        clear={clear}
        onComplete={() => {
          unmount();
          resolve();
        }}
      />
    );
    // 즉시 완료 (비동기 작업 없음)
    setTimeout(() => {
      unmount();
      resolve();
    }, 100);
  });
}

const CONFIG_KEYS = [
  { label: "default-language", value: "default-language" },
  { label: "editor", value: "editor" },
  { label: "auto-open-editor", value: "auto-open-editor" },
  { label: "solved-ac-handle", value: "solved-ac-handle" },
  { label: "problem-dir", value: "problem-dir" },
];

function ConfigKeySelector({ onSelect }: { onSelect: (key: string) => void }) {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          ⚙️ 설정 관리
        </Text>
      </Box>
      <Alert variant="info">설정 키를 선택하세요</Alert>
      <Box marginTop={1}>
        <Select
          options={CONFIG_KEYS}
          onChange={(value) => {
            onSelect(value);
          }}
        />
      </Box>
    </Box>
  );
}

async function selectConfigKey(): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const { unmount } = render(
      <ConfigKeySelector
        onSelect={(key) => {
          unmount();
          resolve(key);
        }}
      />
    );
  });
}

function ConfigValueInput({
  configKey,
  onSubmit,
}: {
  configKey: string;
  onSubmit: (value: string) => void;
}) {
  const getPlaceholder = () => {
    switch (configKey) {
      case "default-language":
        return `언어 입력 (${getSupportedLanguagesString()})`;
      case "editor":
        return "에디터 명령어 입력";
      case "auto-open-editor":
        return "true 또는 false 입력";
      case "solved-ac-handle":
        return "Solved.ac 핸들 입력";
      case "problem-dir":
        return "문제 디렉토리 경로 입력";
      default:
        return "값 입력";
    }
  };

  const getDescription = () => {
    switch (configKey) {
      case "default-language":
        return `지원 언어: ${getSupportedLanguagesString()}`;
      case "editor":
        return "예: code, cursor, vim, nano";
      case "auto-open-editor":
        return "fetch 후 자동으로 에디터를 열지 여부";
      case "solved-ac-handle":
        return "Solved.ac 사용자 핸들";
      case "problem-dir":
        return '문제 디렉토리 경로 (기본값: "problems", 프로젝트 루트: ".")';
      default:
        return "";
    }
  };

  const getSuggestions = (): string[] => {
    switch (configKey) {
      case "default-language":
        return getSupportedLanguages();
      case "editor":
        return ["code", "cursor", "vim", "nano"];
      case "auto-open-editor":
        return ["true", "false"];
      case "problem-dir":
        return ["problems", ".", ""];
      default:
        return [];
    }
  };

  return (
    <Box flexDirection="column">
      <Box marginTop={1}>
        <Alert variant="info">값을 입력하세요</Alert>
      </Box>
      {getDescription() && (
        <Box marginTop={1} marginBottom={0}>
          <Text color="gray" dimColor>
            {getDescription()}
          </Text>
        </Box>
      )}
      <Box marginTop={0}>
        <TextInput
          placeholder={getPlaceholder()}
          suggestions={getSuggestions()}
          onSubmit={(value) => {
            onSubmit(value);
          }}
        />
      </Box>
    </Box>
  );
}

async function inputConfigValue(configKey: string): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const { unmount } = render(
      <ConfigValueInput
        configKey={configKey}
        onSubmit={(value) => {
          unmount();
          resolve(value);
        }}
      />
    );
  });
}

export async function configExecute(
  args: string[],
  flags: { list?: boolean; help?: boolean }
): Promise<void> {
  if (flags.help) {
    console.log(getConfigHelp().trim());
    process.exit(0);
    return;
  }

  const command = args[0];

  // clear 명령어 처리
  if (command === "clear") {
    await configCommand(undefined, undefined, false, false, true);
    return;
  }

  // list 명령어 처리
  if (command === "list" || flags.list) {
    await configCommand(undefined, undefined, false, true);
    return;
  }

  // get 명령어 처리
  if (command === "get") {
    const key = args[1];
    if (key) {
      // 키가 있으면 바로 조회
      await configCommand(key, undefined, true, false);
    } else {
      // 키가 없으면 대화형으로 선택
      const selectedKey = await selectConfigKey();
      if (!selectedKey) {
        process.exit(0);
        return;
      }
      await configCommand(selectedKey, undefined, true, false);
    }
    return;
  }

  // set 명령어 처리
  if (command === "set") {
    const key = args[1];
    if (key) {
      // 키가 있으면 바로 값 입력
      const inputValue = await inputConfigValue(key);
      if (!inputValue) {
        process.exit(0);
        return;
      }
      await configCommand(key, inputValue, false, false);
    } else {
      // 키가 없으면 대화형으로 선택
      const selectedKey = await selectConfigKey();
      if (!selectedKey) {
        process.exit(0);
        return;
      }
      const inputValue = await inputConfigValue(selectedKey);
      if (!inputValue) {
        process.exit(0);
        return;
      }
      await configCommand(selectedKey, inputValue, false, false);
    }
    return;
  }

  // 명령어가 없거나 알 수 없는 명령어
  if (!command) {
    console.error("오류: 명령어를 입력해주세요.");
    console.error("사용법: ps config <명령어>");
    console.error("명령어: get, set, list, clear");
    console.error("도움말: ps config --help");
    process.exit(1);
    return;
  }

  console.error(`오류: 알 수 없는 명령어: ${command}`);
  console.error("사용 가능한 명령어: get, set, list, clear");
  console.error("도움말: ps config --help");
  process.exit(1);
}

const configCommandDef: CommandDefinition = {
  name: "config",
  help: configHelp,
  execute: configExecute,
};

export default configCommandDef;
