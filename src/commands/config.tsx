import { render, Text, Box } from "ink";
import { StatusMessage } from "@inkjs/ui";
import {
  setBojSessionCookie,
  getBojSessionCookie,
  setDefaultLanguage,
  getDefaultLanguage,
  setCodeOpen,
  getCodeOpen,
  setEditor,
  getEditor,
  setAutoOpenEditor,
  getAutoOpenEditor,
  setSolvedAcHandle,
  getSolvedAcHandle,
  setProblemDir,
  getProblemDir,
  clearConfig,
} from "../utils/config";
import {
  getSupportedLanguages,
  getSupportedLanguagesString,
} from "../utils/language";
import type { CommandDefinition } from "../types/command";

export function getConfigHelp(): string {
  return `
  사용법:
    $ ps config <키> [값]
    $ ps config <키> --get
    $ ps config --list
    $ ps config clear

  설명:
    사용자 설정을 관리합니다.
    설정은 ~/.config/ps-cli/config.json에 저장됩니다.

  설정 키:
    boj-session-cookie    BOJ 세션 쿠키
    default-language       기본 언어 (${getSupportedLanguagesString()})
    code-open              코드 공개 여부 (true/false)
    editor                 에디터 명령어 (예: code, vim, nano)
    auto-open-editor       fetch 후 자동으로 에디터 열기 (true/false)
    solved-ac-handle       Solved.ac 핸들 (stats 명령어용)
    problem-dir            문제 디렉토리 경로 (기본값: problems, "." 또는 ""는 프로젝트 루트)

  옵션:
    --get                  설정 값 조회
    --list                 모든 설정 조회
    clear                  모든 설정 초기화
    --help, -h             도움말 표시

  예제:
    $ ps config boj-session-cookie "boj_session=xxx"
    $ ps config default-language python
    $ ps config solved-ac-handle myhandle
    $ ps config problem-dir "."              # 프로젝트 루트에 직접 저장
    $ ps config problem-dir "problems"      # problems 디렉토리 사용 (기본값)
    $ ps config problem-dir --get
    $ ps config --list
    $ ps config clear                       # 모든 설정 초기화
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
  if (clear) {
    clearConfig();
    return (
      <Box>
        <StatusMessage variant="success">
          모든 설정이 초기화되었습니다.
        </StatusMessage>
      </Box>
    );
  }
  if (list) {
    const bojCookie = getBojSessionCookie();
    const defaultLang = getDefaultLanguage();
    const codeOpen = getCodeOpen();
    const editor = getEditor();
    const autoOpen = getAutoOpenEditor();
    const handle = getSolvedAcHandle();

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>현재 설정:</Text>
        </Box>
        <Box flexDirection="column">
          <Text>
            boj-session-cookie:{" "}
            <Text color={bojCookie ? "green" : "gray"}>
              {bojCookie ? "설정됨" : "설정 안 됨"}
            </Text>
          </Text>
          <Text>
            default-language: <Text bold>{defaultLang}</Text>
          </Text>
          <Text>
            code-open: <Text bold>{codeOpen ? "true" : "false"}</Text>
          </Text>
          <Text>
            editor: <Text bold>{editor}</Text>
          </Text>
          <Text>
            auto-open-editor: <Text bold>{autoOpen ? "true" : "false"}</Text>
          </Text>
          <Text>
            solved-ac-handle: <Text bold>{handle || "설정 안 됨"}</Text>
          </Text>
          <Text>
            problem-dir: <Text bold>{getProblemDir()}</Text>
          </Text>
        </Box>
      </Box>
    );
  }

  if (get && configKey) {
    let configValue: string | undefined;
    switch (configKey) {
      case "boj-session-cookie":
        configValue = getBojSessionCookie();
        break;
      case "default-language":
        configValue = getDefaultLanguage();
        break;
      case "code-open":
        configValue = getCodeOpen() ? "true" : "false";
        break;
      case "editor":
        configValue = getEditor();
        break;
      case "auto-open-editor":
        configValue = getAutoOpenEditor() ? "true" : "false";
        break;
      case "solved-ac-handle":
        configValue = getSolvedAcHandle();
        break;
      case "problem-dir":
        configValue = getProblemDir();
        break;
      default:
        console.error(`알 수 없는 설정 키: ${configKey}`);
        process.exit(1);
    }

    return (
      <Box>
        <Text>{configValue || "(설정 안 됨)"}</Text>
      </Box>
    );
  }

  if (configKey && value !== undefined) {
    switch (configKey) {
      case "boj-session-cookie":
        setBojSessionCookie(value);
        break;
      case "default-language":
        const supportedLanguages = getSupportedLanguages();
        if (!supportedLanguages.includes(value as any)) {
          console.error(
            `지원하지 않는 언어입니다: ${value}\n지원 언어: ${getSupportedLanguagesString()}`
          );
          process.exit(1);
        }
        setDefaultLanguage(value);
        break;
      case "code-open":
        setCodeOpen(value === "true");
        break;
      case "editor":
        setEditor(value);
        break;
      case "auto-open-editor":
        setAutoOpenEditor(value === "true");
        break;
      case "solved-ac-handle":
        setSolvedAcHandle(value);
        break;
      case "problem-dir":
        setProblemDir(value);
        break;
      default:
        console.error(`알 수 없는 설정 키: ${configKey}`);
        process.exit(1);
    }

    return (
      <Box>
        <StatusMessage variant="success">
          설정이 저장되었습니다: {configKey} = {value}
        </StatusMessage>
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

export async function configExecute(
  args: string[],
  flags: { get?: boolean; list?: boolean; help?: boolean }
): Promise<void> {
  if (flags.help) {
    console.log(getConfigHelp().trim());
    process.exit(0);
    return;
  }

  // clear 명령어 처리
  if (args[0] === "clear") {
    await configCommand(undefined, undefined, false, false, true);
    return;
  }

  if (flags.list) {
    await configCommand(undefined, undefined, false, true);
    return;
  }

  const key = args[0];
  const value = args[1];

  if (!key) {
    console.error("오류: 설정 키를 입력해주세요.");
    console.error(`사용법: ps config <키> [값]`);
    console.error(`사용법: ps config clear`);
    console.error(`도움말: ps config --help`);
    process.exit(1);
  }

  if (flags.get) {
    await configCommand(key, undefined, true, false);
  } else if (value !== undefined) {
    await configCommand(key, value, false, false);
  } else {
    console.error("오류: 설정 값을 입력하거나 --get 옵션을 사용해주세요.");
    console.error(`사용법: ps config <키> <값>`);
    console.error(`사용법: ps config <키> --get`);
    process.exit(1);
  }
}

const configCommandDef: CommandDefinition = {
  name: "config",
  help: configHelp,
  execute: configExecute,
};

export default configCommandDef;
