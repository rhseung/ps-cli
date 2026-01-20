import { StatusMessage, Select, TextInput, Alert, Badge } from '@inkjs/ui';
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
import { type ProjectConfig } from '../types';

export function getConfigHelp(): string {
  const metadata = getConfigMetadata();
  const keysHelp = metadata
    .map((m) => `    ${m.key.padEnd(25)} ${m.label}`)
    .join('\n');

  return `
  사용법:
    $ ps config get [키]
    $ ps config set [키] [값]
    $ ps config list
    $ ps config clear

  설명:
    프로젝트 설정(.ps-cli/config.yaml)을 관리합니다.
    설정은 현재 프로젝트의 .ps-cli 디렉토리 내에 저장됩니다.

  명령어:
    get [키]                설정 값 조회 (키 없으면 대화형 선택)
    set [키] [값]           설정 값 설정 (인자 없으면 대화형 선택)
    list                    모든 설정 조회
    clear                   .ps-cli 폴더 및 설정 삭제

  설정 키 예시:
${keysHelp}

  옵션:
    --help, -h             도움말 표시

  예제:
    $ ps config get                         # 대화형으로 키 선택 후 값 조회
    $ ps config get general.default-language # 기본 언어 설정 조회
    $ ps config set editor.command cursor    # 에디터를 cursor로 설정
    $ ps config list                         # 모든 설정 조회
    $ ps config clear                        # 모든 설정 및 템플릿 삭제
`;
}

export const configHelp = getConfigHelp();

const METADATA = getConfigMetadata();

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
            .ps-cli 폴더를 삭제하는 중...
          </StatusMessage>
        </Box>
      );
    }
    return (
      <Box>
        <Alert variant="success">
          .ps-cli 폴더와 모든 설정이 삭제되었습니다.
        </Alert>
      </Box>
    );
  }

  if (list) {
    // 그룹별로 묶기
    const groups: Record<string, typeof METADATA> = {};
    METADATA.forEach((m) => {
      const group = m.key.split('.')[0];
      if (!groups[group]) groups[group] = [];
      groups[group].push(m);
    });

    const getNestedValue = (obj: ProjectConfig | null, path: string) => {
      if (!obj) return undefined;
      return path.split('.').reduce((acc: unknown, part) => {
        if (acc && typeof acc === 'object' && part in acc) {
          return (acc as Record<string, unknown>)[part];
        }
        return undefined;
      }, obj);
    };

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            {icons.config} 현재 설정 (.ps-cli/config.yaml)
          </Text>
        </Box>
        {Object.entries(groups).map(([groupName, items]) => (
          <Box key={groupName} flexDirection="column" marginTop={1}>
            <Box>
              <Badge color="blue">{groupName.toUpperCase()}</Badge>
            </Box>
            <Box flexDirection="column" paddingLeft={2} marginTop={1}>
              {items.map((m) => {
                const val = getNestedValue(config, m.path);
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
                  <Box key={m.key} marginBottom={0}>
                    <Text color="gray">
                      {m.key.split('.').slice(1).join('.')}:
                    </Text>
                    <Text> </Text>
                    <Text bold color={valColor}>
                      {displayValue}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  if (get && configKey) {
    const item = METADATA.find((m) => m.key === configKey);

    if (!item) {
      logger.error(`알 수 없는 설정 키: ${configKey}`);
      process.exit(1);
    }

    const getNestedValue = (obj: ProjectConfig | null, path: string) => {
      if (!obj) return undefined;
      return path.split('.').reduce((acc: unknown, part) => {
        if (acc && typeof acc === 'object' && part in acc) {
          return (acc as Record<string, unknown>)[part];
        }
        return undefined;
      }, obj);
    };

    const val = getNestedValue(config, item.path);
    const displayValue = val !== undefined ? String(val) : '(설정 안 됨)';

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color="gray">{configKey}:</Text>
          <Text> </Text>
          <Text bold color={val !== undefined ? 'cyan' : 'gray'}>
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
        <Box marginTop={1} paddingLeft={2}>
          <Text color="gray">{configKey} → </Text>
          <Text bold color="green">
            {value}
          </Text>
        </Box>
      </Box>
    );
  }

  return null;
}

@CommandDef({
  name: 'config',
  description: `프로젝트 설정(.ps-cli/config.yaml)을 관리합니다.
설정은 현재 프로젝트의 .ps-cli 디렉토리 내에 저장됩니다.`,
  autoDetectProblemId: false,
  examples: [
    'config get                         # 대화형으로 키 선택 후 값 조회',
    'config get general.default-language # 기본 언어 설정 조회',
    'config set editor.command cursor    # 에디터를 cursor로 설정',
    'config list                         # 모든 설정 조회',
    'config clear                        # 모든 설정 및 템플릿 삭제',
  ],
})
export class ConfigCommand extends Command {
  async execute(args: string[], flags: CommandFlags): Promise<void> {
    const command = args[0];

    if (command === 'clear') {
      await this.renderView(ConfigView, { clear: true });
      return;
    }

    if (command === 'list' || flags.list) {
      await this.renderView(ConfigView, { list: true });
      return;
    }

    if (command === 'get') {
      const key = args[1];
      if (key) {
        await this.renderView(ConfigView, {
          configKey: key as ConfigKey,
          get: true,
        });
      } else {
        const selectedKey = await this.selectConfigKeyInteractive();
        if (!selectedKey) {
          process.exit(0);
        }
        await this.renderView(ConfigView, {
          configKey: selectedKey,
          get: true,
        });
      }
      return;
    }

    if (command === 'set') {
      const key = args[1];
      const value = args[2];

      if (key && value !== undefined) {
        await this.renderView(ConfigView, {
          configKey: key as ConfigKey,
          value: value,
        });
      } else if (key) {
        const inputValue = await this.inputConfigValue(key);
        if (inputValue === null) process.exit(0);
        await this.renderView(ConfigView, {
          configKey: key as ConfigKey,
          value: inputValue,
        });
      } else {
        const selectedKey = await this.selectConfigKeyInteractive();
        if (!selectedKey) process.exit(0);
        const inputValue = await this.inputConfigValue(selectedKey);
        if (inputValue === null) process.exit(0);
        await this.renderView(ConfigView, {
          configKey: selectedKey,
          value: inputValue,
        });
      }
      return;
    }

    if (!command) {
      logger.error('명령어를 입력해주세요.');
      console.log('도움말: ps config --help');
      process.exit(1);
    }

    logger.error(`알 수 없는 명령어: ${command}`);
    console.log('도움말: ps config --help');
    process.exit(1);
  }

  private async selectConfigKeyInteractive(): Promise<ConfigKey | null> {
    const groups = Array.from(
      new Set(METADATA.map((m) => m.key.split('.')[0])),
    );

    // 1단계: 그룹 선택
    const selectedGroup = await new Promise<string | null>((resolve) => {
      const { unmount } = render(
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              {icons.config} 설정 그룹 선택
            </Text>
          </Box>
          <Select
            options={groups.map((g) => ({ label: g.toUpperCase(), value: g }))}
            onChange={(val) => {
              unmount();
              resolve(val);
            }}
          />
        </Box>,
      );
    });

    if (!selectedGroup) return null;

    // 2단계: 키 선택
    const groupItems = METADATA.filter((m) =>
      m.key.startsWith(selectedGroup + '.'),
    );

    return new Promise<ConfigKey | null>((resolve) => {
      const { unmount } = render(
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              {icons.config} [{selectedGroup.toUpperCase()}] 설정 키 선택
            </Text>
          </Box>
          <Select
            options={groupItems.map((m) => ({ label: m.label, value: m.key }))}
            onChange={(val) => {
              unmount();
              resolve(val as ConfigKey);
            }}
          />
        </Box>,
      );
    });
  }

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

  private ConfigValueInput = ({
    configKey,
    onSubmit,
  }: {
    configKey: string;
    onSubmit: (value: string) => void;
  }) => {
    const item = METADATA.find((m) => m.key === configKey);

    return (
      <Box flexDirection="column">
        <Box marginTop={1}>
          <Alert variant="info">값을 입력하세요 [{configKey}]</Alert>
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
