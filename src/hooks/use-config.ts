import { existsSync } from 'fs';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';

import { useEffect, useState } from 'react';

import type { ProjectConfig } from '../types/index';
import {
  getSupportedLanguages,
  getSupportedLanguagesString,
  type Language,
} from '../utils/language';

function getProjectConfigPath(): string {
  return join(process.cwd(), '.ps-cli.json');
}

async function readProjectConfig(): Promise<ProjectConfig | null> {
  const configPath = getProjectConfigPath();
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content) as ProjectConfig;
  } catch {
    return null;
  }
}

async function writeProjectConfig(config: ProjectConfig): Promise<void> {
  const configPath = getProjectConfigPath();
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export interface UseConfigParams {
  configKey?: string;
  value?: string;
  get?: boolean;
  list?: boolean;
  clear?: boolean;
  onComplete: () => void;
}

export interface UseConfigReturn {
  config: ProjectConfig | null;
  loading: boolean;
  cleared: boolean;
  saved: boolean;
}

export function useConfig({
  configKey,
  value,
  get: _get,
  list: _list,
  clear,
  onComplete: _onComplete,
}: UseConfigParams): UseConfigReturn {
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleared, setCleared] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      const projectConfig = await readProjectConfig();
      setConfig(projectConfig);
      setLoading(false);
    }
    void loadConfig();
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    if (configKey && value !== undefined && !saved) {
      void (async () => {
        const currentConfig = (await readProjectConfig()) ?? {};
        const updatedConfig: ProjectConfig = { ...currentConfig };

        switch (configKey) {
          case 'default-language': {
            const supportedLanguages = getSupportedLanguages();
            if (!supportedLanguages.includes(value as Language)) {
              console.error(
                `지원하지 않는 언어입니다: ${value}\n지원 언어: ${getSupportedLanguagesString()}`,
              );
              process.exit(1);
            }
            updatedConfig.defaultLanguage = value;
            break;
          }
          case 'editor':
            updatedConfig.editor = value;
            break;
          case 'auto-open-editor':
            updatedConfig.autoOpenEditor = value === 'true';
            break;
          case 'solved-ac-handle':
            updatedConfig.solvedAcHandle = value;
            break;
          case 'archive-dir':
            updatedConfig.archiveDir = value;
            break;
          case 'archive-strategy': {
            const validStrategies = ['flat', 'by-range', 'by-tier', 'by-tag'];
            if (!validStrategies.includes(value)) {
              console.error(
                `지원하지 않는 아카이빙 전략입니다: ${value}\n지원 전략: ${validStrategies.join(', ')}`,
              );
              process.exit(1);
            }
            updatedConfig.archiveStrategy = value;
            break;
          }
          case 'archive-auto-commit': {
            if (value !== 'true' && value !== 'false') {
              console.error(
                `archive-auto-commit 값은 true 또는 false 여야 합니다: ${value}`,
              );
              process.exit(1);
            }
            updatedConfig.archiveAutoCommit = value === 'true';
            break;
          }
          case 'archive-commit-message':
            updatedConfig.archiveCommitMessage = value;
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

  return {
    config,
    loading,
    cleared,
    saved,
  };
}

export { readProjectConfig, writeProjectConfig, getProjectConfigPath };
