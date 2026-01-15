import { StatusMessage, Select, TextInput, Alert } from '@inkjs/ui';
import { render, Text, Box } from 'ink';
import React from 'react';

import {
  Command,
  CommandDef,
  CommandBuilder,
  getConfigMetadata,
  logger,
  icons,
  type CommandFlags,
  type ConfigKey,
} from '../core';
import { useConfig } from '../hooks/use-config';

export function getConfigHelp(): string {
  const metadata = getConfigMetadata();
  const keysHelp = metadata
    .map((m) => `    ${m.key.padEnd(23)} ${m.label}`)
    .join('\n');

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
${keysHelp}

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

const CONFIG_KEYS = getConfigMetadata().map((m) => ({
  label: m.key,
  value: m.key,
}));

interface ConfigViewProps {
  configKey?: ConfigKey;
  value?: string;
  get?: boolean;
  list?: boolean;
  clear?: boolean;
  onComplete: () => void;
}

function ConfigView({
  configKey,
  value,
  get,
  list,
  clear,
  onComplete,
}: ConfigViewProps) {
  const { config, loading, cleared, saved } = useConfig({
    configKey,
    value,
    get,
    list,
    clear,
    onComplete,
  });

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
    const metadata = getConfigMetadata();

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            {icons.config} 현재 설정 (.ps-cli.json)
          </Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          {metadata.map((m) => {
            const val = config ? config[m.property] : undefined;
            const displayValue =
              val !== undefined ? String(val) : '(설정 안 됨)';
            const isBool = m.type === 'boolean';
            const valColor = isBool
              ? val === true
                ? 'green'
                : 'gray'
              : val
                ? 'cyan'
                : 'gray';

            return (
              <Box key={m.key} marginBottom={1}>
                <Text color="gray">{m.key}:</Text>
                <Text> </Text>
                <Text bold color={valColor}>
                  {displayValue}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  }

  if (get && configKey) {
    const metadata = getConfigMetadata();
    const item = metadata.find((m) => m.key === configKey);

    if (!item) {
      logger.error(`알 수 없는 설정 키: ${configKey}`);
      process.exit(1);
    }

    const val = config ? config[item.property] : undefined;
    const displayValue = val !== undefined ? String(val) : '(설정 안 됨)';

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color="gray">{configKey}:</Text>
          <Text> </Text>
          <Text bold color={val ? 'cyan' : 'gray'}>
            {displayValue}
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

@CommandDef({
  name: 'config',
  description: `프로젝트 설정 파일(.ps-cli.json)을 관리합니다.
설정은 현재 프로젝트의 .ps-cli.json 파일에 저장됩니다.`,
  autoDetectProblemId: false,
  examples: [
    'config get                         # 대화형으로 키 선택 후 값 조회',
    'config get default-language         # default-language 값 조회',
    'config set                         # 대화형으로 키 선택 후 값 설정',
    'config set editor cursor            # editor를 cursor로 설정',
    'config list                         # 모든 설정 조회',
    'config clear                        # .ps-cli.json 파일 삭제',
  ],
})
export class ConfigCommand extends Command {
  async execute(args: string[], flags: CommandFlags): Promise<void> {
    const command = args[0];

    // clear 명령어 처리
    if (command === 'clear') {
      await this.renderView(ConfigView, {
        clear: true,
      });
      return;
    }

    // list 명령어 처리
    if (command === 'list' || flags.list) {
      await this.renderView(ConfigView, {
        list: true,
      });
      return;
    }

    // get 명령어 처리
    if (command === 'get') {
      const key = args[1];
      if (key) {
        // 키가 있으면 바로 조회
        await this.renderView(ConfigView, {
          configKey: key as ConfigKey,
          get: true,
        });
      } else {
        // 키가 없으면 대화형으로 선택
        const selectedKey = await this.selectConfigKey();
        if (!selectedKey) {
          process.exit(0);
          return;
        }
        await this.renderView(ConfigView, {
          configKey: selectedKey,
          get: true,
        });
      }
      return;
    }

    // set 명령어 처리
    if (command === 'set') {
      const key = args[1];
      if (key) {
        // 키가 있으면 바로 값 입력
        const inputValue = await this.inputConfigValue(key);
        if (!inputValue) {
          process.exit(0);
          return;
        }
        await this.renderView(ConfigView, {
          configKey: key as ConfigKey,
          value: inputValue,
        });
      } else {
        // 키가 없으면 대화형으로 선택
        const selectedKey = await this.selectConfigKey();
        if (!selectedKey) {
          process.exit(0);
          return;
        }
        const inputValue = await this.inputConfigValue(selectedKey);
        if (!inputValue) {
          process.exit(0);
          return;
        }
        await this.renderView(ConfigView, {
          configKey: selectedKey,
          value: inputValue,
        });
      }
      return;
    }

    // 명령어가 없거나 알 수 없는 명령어
    if (!command) {
      logger.error('명령어를 입력해주세요.');
      console.log('도움말: ps config --help');
      process.exit(1);
      return;
    }

    logger.error(`알 수 없는 명령어: ${command}`);
    console.log('도움말: ps config --help');
    process.exit(1);
  }

  // 설정 키 선택: private 메서드
  private async selectConfigKey(): Promise<ConfigKey | null> {
    return new Promise<ConfigKey | null>((resolve) => {
      const { unmount } = render(
        <this.ConfigKeySelector
          onSelect={(key) => {
            unmount();
            resolve(key as ConfigKey);
          }}
        />,
      );
    });
  }

  // 설정 값 입력: private 메서드
  private async inputConfigValue(configKey: string): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const { unmount } = render(
        <this.ConfigValueInput
          configKey={configKey}
          onSubmit={(value) => {
            unmount();
            resolve(value);
          }}
        />,
      );
    });
  }

  // 설정 키 선택 컴포넌트: 클래스 내부에 정의
  private ConfigKeySelector = ({
    onSelect,
  }: {
    onSelect: (key: string) => void;
  }) => {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            {icons.config} 설정 관리
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
  };

  // 설정 값 입력 컴포넌트: 클래스 내부에 정의
  private ConfigValueInput = ({
    configKey,
    onSubmit,
  }: {
    configKey: string;
    onSubmit: (value: string) => void;
  }) => {
    const metadata = getConfigMetadata();
    const item = metadata.find((m) => m.key === configKey);

    return (
      <Box flexDirection="column">
        <Box marginTop={1}>
          <Alert variant="info">값을 입력하세요</Alert>
        </Box>
        {item && (
          <Box marginTop={1} marginBottom={0}>
            <Text color="gray" dimColor>
              {item.description}
            </Text>
          </Box>
        )}
        <Box marginTop={0}>
          <TextInput
            placeholder={item?.placeholder || '값 입력'}
            suggestions={item?.suggestions || []}
            onSubmit={(value) => {
              onSubmit(value);
            }}
          />
        </Box>
      </Box>
    );
  };
}

export default CommandBuilder.fromClass(ConfigCommand);
