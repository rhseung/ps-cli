import { StatusMessage, Select, TextInput, Alert } from '@inkjs/ui';
import { render, Text, Box } from 'ink';
import React from 'react';

import { Command } from '../core/base-command';
import { CommandDef, CommandBuilder } from '../core/command-builder';
import { useConfig } from '../hooks/use-config';
import type { CommandFlags } from '../types/command';
import {
  getDefaultLanguage,
  getEditor,
  getAutoOpenEditor,
  getSolvedAcHandle,
  getProblemDir,
  getArchiveStrategy,
} from '../utils/config';
import {
  getSupportedLanguages,
  getSupportedLanguagesString,
} from '../utils/language';

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
    archive-strategy       아카이빙 전략 (flat, by-range, by-tier, by-tag)

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

const CONFIG_KEYS = [
  { label: 'default-language', value: 'default-language' },
  { label: 'editor', value: 'editor' },
  { label: 'auto-open-editor', value: 'auto-open-editor' },
  { label: 'solved-ac-handle', value: 'solved-ac-handle' },
  { label: 'problem-dir', value: 'problem-dir' },
  { label: 'archive-strategy', value: 'archive-strategy' },
];

interface ConfigViewProps {
  configKey?: string;
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
    const defaultLang = config?.defaultLanguage ?? getDefaultLanguage();
    const editor = config?.editor ?? getEditor();
    const autoOpen = config?.autoOpenEditor ?? getAutoOpenEditor();
    const handle = config?.solvedAcHandle ?? getSolvedAcHandle();
    const problemDir = config?.problemDir ?? getProblemDir();
    const archiveStrategy = config?.archiveStrategy ?? getArchiveStrategy();

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
            <Text bold color={autoOpen ? 'green' : 'gray'}>
              {autoOpen ? 'true' : 'false'}
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="gray">solved-ac-handle:</Text>
            <Text> </Text>
            <Text bold color={handle ? 'cyan' : 'gray'}>
              {handle || '설정 안 됨'}
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="gray">problem-dir:</Text>
            <Text> </Text>
            <Text bold>{problemDir}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="gray">archive-strategy:</Text>
            <Text> </Text>
            <Text bold>{archiveStrategy}</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (get && configKey) {
    let configValue: string | undefined;
    switch (configKey) {
      case 'default-language':
        configValue = config?.defaultLanguage ?? getDefaultLanguage();
        break;
      case 'editor':
        configValue = config?.editor ?? getEditor();
        break;
      case 'auto-open-editor':
        configValue =
          config?.autoOpenEditor !== undefined
            ? String(config.autoOpenEditor)
            : String(getAutoOpenEditor());
        break;
      case 'solved-ac-handle':
        configValue = config?.solvedAcHandle ?? getSolvedAcHandle();
        break;
      case 'problem-dir':
        configValue = config?.problemDir ?? getProblemDir();
        break;
      case 'archive-strategy':
        configValue = config?.archiveStrategy ?? getArchiveStrategy();
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
          <Text bold color={configValue ? 'cyan' : 'gray'}>
            {configValue || '(설정 안 됨)'}
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
          configKey: key,
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
          configKey: key,
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
      console.error('오류: 명령어를 입력해주세요.');
      console.error('사용법: ps config <명령어>');
      console.error('명령어: get, set, list, clear');
      console.error('도움말: ps config --help');
      process.exit(1);
      return;
    }

    console.error(`오류: 알 수 없는 명령어: ${command}`);
    console.error('사용 가능한 명령어: get, set, list, clear');
    console.error('도움말: ps config --help');
    process.exit(1);
  }

  // 설정 키 선택: private 메서드
  private async selectConfigKey(): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const { unmount } = render(
        <this.ConfigKeySelector
          onSelect={(key) => {
            unmount();
            resolve(key);
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
  };

  // 설정 값 입력 컴포넌트: 클래스 내부에 정의
  private ConfigValueInput = ({
    configKey,
    onSubmit,
  }: {
    configKey: string;
    onSubmit: (value: string) => void;
  }) => {
    const getPlaceholder = () => {
      switch (configKey) {
        case 'default-language':
          return `언어 입력 (${getSupportedLanguagesString()})`;
        case 'editor':
          return '에디터 명령어 입력';
        case 'auto-open-editor':
          return 'true 또는 false 입력';
        case 'solved-ac-handle':
          return 'Solved.ac 핸들 입력';
        case 'problem-dir':
          return '문제 디렉토리 경로 입력';
        case 'archive-strategy':
          return '아카이빙 전략 입력 (flat, by-range, by-tier, by-tag)';
        default:
          return '값 입력';
      }
    };

    const getDescription = () => {
      switch (configKey) {
        case 'default-language':
          return `지원 언어: ${getSupportedLanguagesString()}`;
        case 'editor':
          return '예: code, cursor, vim, nano';
        case 'auto-open-editor':
          return 'fetch 후 자동으로 에디터를 열지 여부';
        case 'solved-ac-handle':
          return 'Solved.ac 사용자 핸들';
        case 'problem-dir':
          return '문제 디렉토리 경로 (기본값: "problems", 프로젝트 루트: ".")';
        case 'archive-strategy':
          return '아카이빙 전략: flat (평면), by-range (1000번대 묶기), by-tier (티어별), by-tag (태그별)';
        default:
          return '';
      }
    };

    const getSuggestions = (): string[] => {
      switch (configKey) {
        case 'default-language':
          return getSupportedLanguages();
        case 'editor':
          return ['code', 'cursor', 'vim', 'nano'];
        case 'auto-open-editor':
          return ['true', 'false'];
        case 'problem-dir':
          return ['problems', '.', ''];
        case 'archive-strategy':
          return ['flat', 'by-range', 'by-tier', 'by-tag'];
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
  };
}

export default CommandBuilder.fromClass(ConfigCommand);
