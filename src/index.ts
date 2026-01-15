import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import meow from 'meow';

import { generateGlobalHelp, logger } from './core';
import type { CommandDefinition } from './types/command';

// commands 디렉토리 경로 찾기 (개발/빌드 환경 모두 지원)
function getCommandsDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // dist에서 실행되는 경우
  if (__dirname.includes('dist')) {
    return join(__dirname, 'commands');
  }
  // src에서 실행되는 경우 (개발 모드)
  return join(__dirname, 'commands');
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
        (!file.endsWith('.ts') &&
          !file.endsWith('.tsx') &&
          !file.endsWith('.js')) ||
        file === 'index.ts' ||
        file === 'index.tsx' ||
        file === 'index.js'
      ) {
        continue;
      }

      const commandName = file.replace(/\.(ts|tsx|js)$/, '');
      try {
        // 동적 import (import.meta.url 기준 상대 경로)
        const isDist = commandsDir.includes('dist');
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

const cli = meow(
  `
  사용법:
    $ ps <명령어> [인자] [옵션]
`,
  {
    importMeta: import.meta,
    autoHelp: false,
    flags: {
      help: {
        type: 'boolean',
        shortFlag: 'h',
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

  const [command, ...initialArgs] = cli.input;
  let rawArgs = initialArgs;

  // help 명령어 처리 또는 명령어 없이 --help 플래그
  if (command === 'help' || (!command && cli.flags.help)) {
    console.log(generateGlobalHelp(commands));
    process.exit(0);
    return;
  }

  // 명령어가 없으면 전체 help 표시
  if (!command) {
    console.log(generateGlobalHelp(commands));
    process.exit(0);
    return;
  }

  // 명령어 실행
  const commandDef = commands.get(command);
  if (!commandDef) {
    logger.error(`알 수 없는 명령어: ${command}`);
    console.log(
      `사용 가능한 명령어: ${Array.from(commands.keys()).join(', ')}`,
    );
    process.exit(1);
    return;
  }

  // 명령어별 플래그 파싱
  let finalFlags = cli.flags;

  // 명령어 인자에서 플래그 파싱을 위한 준비
  const commandIndex = process.argv.findIndex((arg) => arg === command);
  const commandArgs =
    commandIndex >= 0
      ? process.argv.slice(commandIndex + 1)
      : process.argv.slice(2);

  if (commandDef.metadata?.flags) {
    // 명령어별 플래그 정의를 meow 형식으로 변환
    const commandFlags: Record<string, unknown> = {};
    for (const flagDef of commandDef.metadata.flags) {
      const flagConfig: Record<string, unknown> = {
        type: flagDef.options?.type || 'string',
      };

      if (flagDef.options?.shortFlag) {
        flagConfig.shortFlag = flagDef.options.shortFlag;
      }

      // default가 있을 때만 포함 (undefined를 전달하면 meow가 에러 발생)
      if (flagDef.options?.default !== undefined) {
        flagConfig.default = flagDef.options.default;
      }

      commandFlags[flagDef.name] = flagConfig;
    }

    // 명령어별 meow 인스턴스 생성 (명령어 인자만 파싱)
    const commandCli = meow('', {
      importMeta: import.meta,
      argv: commandArgs,
      autoHelp: false, // 기본 help 출력 비활성화 (우리가 직접 처리)
      flags: {
        help: {
          type: 'boolean',
          shortFlag: 'h',
          default: false,
        },
        ...commandFlags,
      },
    });

    // help 플래그가 설정되어 있으면 도움말 표시 후 종료
    if (commandCli.flags.help) {
      if (commandDef.help && commandDef.help.trim()) {
        console.log(commandDef.help.trim());
      } else {
        // help가 없으면 기본 정보 표시
        console.log(`명령어: ${commandDef.name}`);
        if (commandDef.metadata?.description) {
          console.log(`설명: ${commandDef.metadata.description}`);
        }
      }
      process.exit(0);
      return;
    }

    // meow가 이미 플래그를 제거한 인자를 반환
    rawArgs = commandCli.input;
    finalFlags = { ...cli.flags, ...commandCli.flags };
  } else {
    // 플래그가 없는 명령어도 help 플래그 확인
    const commandCli = meow('', {
      importMeta: import.meta,
      argv: commandArgs,
      autoHelp: false, // 기본 help 출력 비활성화 (우리가 직접 처리)
      flags: {
        help: {
          type: 'boolean',
          shortFlag: 'h',
          default: false,
        },
      },
    });

    // help 플래그가 설정되어 있으면 도움말 표시 후 종료
    if (commandCli.flags.help) {
      if (commandDef.help && commandDef.help.trim()) {
        console.log(commandDef.help.trim());
      } else {
        // help가 없으면 기본 정보 표시
        console.log(`명령어: ${commandDef.name}`);
        if (commandDef.metadata?.description) {
          console.log(`설명: ${commandDef.metadata.description}`);
        }
      }
      process.exit(0);
      return;
    }

    rawArgs = commandCli.input;
    finalFlags = { ...cli.flags, ...commandCli.flags };
  }

  // init 명령어는 예외 (프로젝트 초기화 명령어)
  if (command !== 'init') {
    // 프로젝트 폴더 확인 (.ps-cli.json 파일 존재 여부)
    // 현재 디렉토리부터 상위 디렉토리로 올라가면서 찾기
    let currentDir = process.cwd();
    let found = false;
    const rootPath =
      process.platform === 'win32' ? currentDir.split('\\')[0] + '\\' : '/';

    while (currentDir !== rootPath && !found) {
      const projectConfigPath = join(currentDir, '.ps-cli.json');
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
      logger.error('현재 디렉토리가 ps-cli 프로젝트가 아닙니다.');
      logger.tip('프로젝트를 초기화하려면 다음 명령어를 실행하세요:');
      console.log('  $ ps init');
      process.exit(1);
      return;
    }
  }

  await commandDef.execute(rawArgs, finalFlags);
}

main().catch((error) => {
  logger.error(error.message);
  process.exit(1);
});
