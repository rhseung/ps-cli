import {
  Select,
  TextInput,
  StatusMessage,
  Alert,
  ConfirmInput,
} from '@inkjs/ui';
import { Text, Box } from 'ink';
import React from 'react';

import {
  Command,
  CommandDef,
  CommandBuilder,
  getSupportedLanguages,
  icons,
} from '../core';
import { useInit } from '../hooks/use-init';
import type { CommandFlags } from '../types/command';
import { getVersion } from '../utils/version';

interface InitViewProps {
  onComplete: () => void;
}

function InitView({ onComplete }: InitViewProps) {
  const {
    currentStep,
    completedSteps,
    confirmExit,
    initialized,
    handleInputMode,
    created,
    cancelled,
    setArchiveDirValue,
    setSolvingDirValue,
    setArchiveStrategy,
    setLanguage,
    setEditorValue,
    setAutoOpen,
    setIncludeTag,
    setHandle,
    setHandleInputMode,
    setConfirmExit,
    setCurrentStep,
    setCancelled,
    moveToNextStep,
    getStepLabel,
    getStepValue: _getStepValue,
  } = useInit({ onComplete });

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
    if (cancelled || currentStep === 'cancelled') {
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
                setCurrentStep('cancelled');
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
      case 'archive-dir': {
        const options = [
          { label: 'problems', value: 'problems' },
          { label: '. (프로젝트 루트)', value: '.' },
        ];
        return renderQuestionCard(
          getStepLabel(currentStep),
          <Select
            options={options}
            onChange={(value) => {
              setArchiveDirValue(value);
              const displayValue = value === '.' ? '프로젝트 루트' : value;
              moveToNextStep(displayValue, getStepLabel(currentStep));
            }}
          />,
        );
      }

      case 'solving-dir': {
        const options = [
          { label: 'solving', value: 'solving' },
          { label: '. (프로젝트 루트)', value: '.' },
        ];
        return renderQuestionCard(
          getStepLabel(currentStep),
          <Select
            options={options}
            onChange={(value) => {
              setSolvingDirValue(value);
              const displayValue = value === '.' ? '프로젝트 루트' : value;
              moveToNextStep(displayValue, getStepLabel(currentStep));
            }}
          />,
        );
      }

      case 'archive-strategy': {
        const options = [
          { label: '평면 (전부 나열)', value: 'flat' },
          { label: '1000번대 묶기', value: 'by-range' },
          { label: '티어별', value: 'by-tier' },
          { label: '태그별', value: 'by-tag' },
        ];
        return renderQuestionCard(
          getStepLabel(currentStep),
          <Select
            options={options}
            onChange={(value) => {
              setArchiveStrategy(value);
              const strategyLabels: Record<string, string> = {
                flat: '평면 (전부 나열)',
                'by-range': '1000번대 묶기',
                'by-tier': '티어별',
                'by-tag': '태그별',
              };
              moveToNextStep(
                strategyLabels[value] || value,
                getStepLabel(currentStep),
              );
            }}
          />,
        );
      }

      case 'language': {
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
          />,
        );
      }

      case 'editor': {
        const options = [
          { label: 'code', value: 'code' },
          { label: 'cursor', value: 'cursor' },
          { label: 'vim', value: 'vim' },
          { label: 'nano', value: 'nano' },
        ];
        return renderQuestionCard(
          getStepLabel(currentStep),
          <Select
            options={options}
            onChange={(value) => {
              setEditorValue(value);
              moveToNextStep(value, getStepLabel(currentStep));
            }}
          />,
        );
      }

      case 'auto-open': {
        const options = [
          { label: '예', value: 'true' },
          { label: '아니오', value: 'false' },
        ];
        return renderQuestionCard(
          getStepLabel(currentStep),
          <Select
            options={options}
            onChange={(value) => {
              setAutoOpen(value === 'true');
              moveToNextStep(
                value === 'true' ? '예' : '아니오',
                getStepLabel(currentStep),
              );
            }}
          />,
        );
      }

      case 'include-tag': {
        const options = [
          { label: '예', value: 'true' },
          { label: '아니오', value: 'false' },
        ];
        return renderQuestionCard(
          getStepLabel(currentStep),
          <Select
            options={options}
            onChange={(value) => {
              setIncludeTag(value === 'true');
              moveToNextStep(
                value === 'true' ? '예' : '아니오',
                getStepLabel(currentStep),
              );
            }}
          />,
        );
      }

      case 'handle': {
        if (handleInputMode) {
          return renderQuestionCard(
            getStepLabel(currentStep),
            <Box>
              <TextInput
                placeholder="핸들 입력"
                onSubmit={(value) => {
                  const handleValue = value.trim();
                  setHandle(handleValue);
                  setHandleInputMode(false);
                  moveToNextStep(
                    handleValue || '(스킵)',
                    getStepLabel(currentStep),
                    handleValue,
                  );
                }}
              />
            </Box>,
          );
        }
        const options = [
          { label: '설정', value: 'set' },
          { label: '스킵', value: 'skip' },
        ];
        return renderQuestionCard(
          getStepLabel(currentStep),
          <Select
            options={options}
            onChange={(value) => {
              if (value === 'skip') {
                setHandle('');
                moveToNextStep('(스킵)', getStepLabel(currentStep));
              } else {
                setHandleInputMode(true);
              }
            }}
          />,
        );
      }

      case 'done': {
        const createdItemsText =
          created.length > 0
            ? `\n생성된 항목:\n${created.map((item) => `${icons.solving} ${item}`).join('\n')}`
            : '';
        return (
          <Box flexDirection="column">
            <Box marginTop={1}>
              <Alert variant="success">
                프로젝트 초기화 완료{createdItemsText}
              </Alert>
            </Box>
            <Box marginTop={1}>
              <Text color="gray">
                이제{' '}
                <Text bold color="cyan">
                  ps help
                </Text>{' '}
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

  const version = getVersion();

  return (
    <Box flexDirection="column">
      {/* 헤더 */}
      <Box marginBottom={completedSteps.length > 0 ? 1 : 0}>
        <Text color="cyan" bold>
          {icons.init} ps-cli 프로젝트 초기화
        </Text>
        {version && (
          <Text color="gray" dimColor>
            {' '}
            v{version}
          </Text>
        )}
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

@CommandDef({
  name: 'init',
  description: `현재 디렉토리를 ps-cli 프로젝트로 대화형으로 초기화합니다.
- 단계별로 설정을 물어봅니다
- 문제 디렉토리, 기본 언어, 에디터, 태그 포함 여부 등을 설정할 수 있습니다`,
  flags: [],
  autoDetectProblemId: false,
  examples: ['init'],
})
export class InitCommand extends Command {
  async execute(_args: string[], _flags: CommandFlags): Promise<void> {
    await this.renderView(InitView, {});
  }
}

export default CommandBuilder.fromClass(InitCommand);
