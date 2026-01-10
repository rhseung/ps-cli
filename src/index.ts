import { existsSync } from "fs";
import { readdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import meow from "meow";

import type { CommandDefinition } from "./types/command";
import { getSupportedLanguagesString } from "./utils/language";

// commands 디렉토리 경로 찾기 (개발/빌드 환경 모두 지원)
function getCommandsDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // dist에서 실행되는 경우
  if (__dirname.includes("dist")) {
    return join(__dirname, "commands");
  }
  // src에서 실행되는 경우 (개발 모드)
  return join(__dirname, "commands");
}

// commands 디렉토리에서 모든 명령어 동적으로 로드
async function loadCommands(): Promise<Map<string, CommandDefinition>> {
  const commandsDir = getCommandsDir();
  const commandMap = new Map<string, CommandDefinition>();

  try {
    const files = await readdir(commandsDir);

    for (const file of files) {
      // .tsx, .ts, .js 파일만 처리 (index 파일 제외)
      if (
        (!file.endsWith(".ts") &&
          !file.endsWith(".tsx") &&
          !file.endsWith(".js")) ||
        file === "index.ts" ||
        file === "index.tsx" ||
        file === "index.js"
      ) {
        continue;
      }

      const commandName = file.replace(/\.(ts|tsx|js)$/, "");
      try {
        // 동적 import (import.meta.url 기준 상대 경로)
        const isDist = commandsDir.includes("dist");
        const baseUrl = new URL(import.meta.url);
        const commandsUrl = new URL(
          isDist ? `./commands/${commandName}.js` : `./commands/${commandName}`,
          baseUrl,
        );
        const module = await import(commandsUrl.href);

        // export default로 CommandDefinition 객체를 반환하도록 강제
        if (module.default) {
          const commandDef = module.default as CommandDefinition;
          // name이 일치하는지 확인 (선택사항)
          if (commandDef.name && commandDef.name !== commandName) {
            console.warn(
              `명령어 파일명(${commandName})과 정의된 이름(${commandDef.name})이 일치하지 않습니다.`,
            );
          }
          commandMap.set(commandName, commandDef);
        } else {
          console.warn(
            `명령어 ${commandName}: export default를 찾을 수 없습니다.`,
          );
        }
      } catch (error) {
        // 명령어 로드 실패 시 경고만 출력하고 계속 진행
        console.warn(`명령어 ${commandName} 로드 실패:`, error);
      }
    }
  } catch (error) {
    console.error(
      `commands 디렉토리를 읽을 수 없습니다: ${commandsDir}`,
      error,
    );
    throw error;
  }

  return commandMap;
}

// 명령어 맵 (비동기 로드)
let commands: Map<string, CommandDefinition> | null = null;

// 전체 help 텍스트 생성
function generateHelpText(commands: Map<string, CommandDefinition>): string {
  const commandList = Array.from(commands.values())
    .map((cmd) => `    ${cmd.name}`)
    .join("\n");

  return `
  사용법:
    $ ps <명령어> [인자] [옵션]

  명령어:
${commandList}
    help                이 도움말 표시

  옵션:
    --language, -l      언어 선택
                        지원 언어: ${getSupportedLanguagesString()}
                        - fetch: 기본값 python
                        - test: solution.* 파일로 자동 감지 (지정 시 덮어쓰기)

    --watch, -w         테스트 watch 모드 (test 명령어 전용)
                        - solution.*, input*.txt, output*.txt 파일 변경 감지
                        - 변경 시 자동으로 테스트 재실행

    --help, -h          명령어별 도움말 표시

  예제:
    $ ps fetch 1000
    $ ps test 1000 --watch
    $ ps help
    $ ps fetch --help
`;
}

const cli = meow(
  `
  사용법:
    $ ps <명령어> [인자] [옵션]

  명령어를 로드하는 중...
`,
  {
    importMeta: import.meta,
    flags: {
      language: {
        type: "string",
        shortFlag: "l",
        default: "python",
      },
      watch: {
        type: "boolean",
        shortFlag: "w",
        default: false,
      },
      help: {
        type: "boolean",
        shortFlag: "h",
        default: false,
      },
    },
  },
);

async function main() {
  // 명령어 동적 로드
  if (!commands) {
    commands = await loadCommands();
  }

  const [command, ...args] = cli.input;

  // help 명령어 처리 또는 명령어 없이 --help 플래그
  if (command === "help" || (!command && cli.flags.help)) {
    const helpText = generateHelpText(commands);
    console.log(helpText.trim());
    process.exit(0);
    return;
  }

  // 명령어가 없으면 전체 help 표시
  if (!command) {
    const helpText = generateHelpText(commands);
    console.log(helpText.trim());
    process.exit(0);
    return;
  }

  // 명령어 실행
  const commandDef = commands.get(command);
  if (!commandDef) {
    console.error(`오류: 알 수 없는 명령어: ${command}`);
    console.error(
      `사용 가능한 명령어: ${Array.from(commands.keys()).join(", ")}, help`,
    );
    process.exit(1);
    return;
  }

  // init 명령어는 예외 (프로젝트 초기화 명령어)
  if (command !== "init") {
    // 프로젝트 폴더 확인 (.ps-cli.json 파일 존재 여부)
    // 현재 디렉토리부터 상위 디렉토리로 올라가면서 찾기
    let currentDir = process.cwd();
    let found = false;
    const rootPath =
      process.platform === "win32" ? currentDir.split("\\")[0] + "\\" : "/";

    while (currentDir !== rootPath && !found) {
      const projectConfigPath = join(currentDir, ".ps-cli.json");
      if (existsSync(projectConfigPath)) {
        found = true;
        break;
      }
      const parentDir = dirname(currentDir);
      // 루트에 도달했거나 더 이상 올라갈 수 없으면 중단
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    if (!found) {
      console.error("오류: 현재 디렉토리가 ps-cli 프로젝트가 아닙니다.");
      console.error("프로젝트를 초기화하려면 다음 명령어를 실행하세요:");
      console.error("  $ ps init");
      process.exit(1);
      return;
    }
  }

  await commandDef.execute(args, cli.flags);
}

main().catch((error) => {
  console.error("오류:", error.message);
  process.exit(1);
});
