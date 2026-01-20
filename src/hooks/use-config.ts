import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, unlink, rm } from 'fs/promises';
import { join } from 'path';

import { useEffect, useState } from 'react';
import { parse, stringify } from 'yaml';

import { getConfigMetadata, type ConfigKey, findProjectRoot } from '../core';
import type { ProjectConfig } from '../types/index';

function getProjectConfigPath(): string | null {
  const root = findProjectRoot();
  if (!root) return null;
  return join(root, '.ps-cli', 'config.yaml');
}

async function readProjectConfig(): Promise<ProjectConfig | null> {
  const configPath = getProjectConfigPath();
  if (!configPath || !existsSync(configPath)) {
    return null;
  }
  try {
    const content = await readFile(configPath, 'utf-8');
    return parse(content) as ProjectConfig;
  } catch {
    return null;
  }
}

async function writeProjectConfig(config: ProjectConfig): Promise<void> {
  const configPath = getProjectConfigPath();
  if (!configPath) {
    const root = process.cwd();
    const psCliDir = join(root, '.ps-cli');
    if (!existsSync(psCliDir)) {
      mkdirSync(psCliDir, { recursive: true });
    }
    const newConfigPath = join(psCliDir, 'config.yaml');
    await writeFile(newConfigPath, stringify(config), 'utf-8');
    return;
  }
  await writeFile(configPath, stringify(config), 'utf-8');
}

function setDeep(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

export interface UseConfigParams {
  configKey?: ConfigKey;
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
        const root = findProjectRoot();
        if (root) {
          const psCliDir = join(root, '.ps-cli');
          if (existsSync(psCliDir)) {
            // .ps-cli 폴더 전체 삭제
            await rm(psCliDir, { recursive: true, force: true });
          }
          // 레거시 파일 삭제
          const legacyPath = join(root, '.ps-cli.json');
          if (existsSync(legacyPath)) {
            await unlink(legacyPath);
          }
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

        const metadata = getConfigMetadata();
        const item = metadata.find((m) => m.key === configKey);

        if (!item) {
          console.error(`알 수 없는 설정 키: ${configKey}`);
          process.exit(1);
        }

        const path = item.path;
        let finalValue: unknown = value;

        if (item.type === 'boolean') {
          if (value !== 'true' && value !== 'false') {
            console.error(
              `${configKey} 값은 true 또는 false 여야 합니다: ${value}`,
            );
            process.exit(1);
          }
          finalValue = value === 'true';
        } else if (item.type === 'select' && item.suggestions) {
          if (!item.suggestions.includes(value)) {
            console.error(
              `지원하지 않는 값입니다: ${value}\n지원되는 값: ${item.suggestions.join(', ')}`,
            );
            process.exit(1);
          }
        }

        setDeep(
          updatedConfig as unknown as Record<string, unknown>,
          path,
          finalValue,
        );
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
