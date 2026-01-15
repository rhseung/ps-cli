import { existsSync } from 'fs';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';

import { useEffect, useState } from 'react';

import { getConfigMetadata, type ConfigKey } from '../core';
import type { ProjectConfig } from '../types/index';

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

        const metadata = getConfigMetadata();
        const item = metadata.find((m) => m.key === configKey);

        if (!item) {
          console.error(`알 수 없는 설정 키: ${configKey}`);
          process.exit(1);
        }

        const property = item.property;

        if (item.type === 'boolean') {
          if (value !== 'true' && value !== 'false') {
            console.error(
              `${configKey} 값은 true 또는 false 여야 합니다: ${value}`,
            );
            process.exit(1);
          }
          Object.assign(updatedConfig, { [property]: value === 'true' });
        } else if (item.type === 'select' && item.suggestions) {
          if (!item.suggestions.includes(value)) {
            console.error(
              `지원하지 않는 값입니다: ${value}\n지원되는 값: ${item.suggestions.join(', ')}`,
            );
            process.exit(1);
          }
          Object.assign(updatedConfig, { [property]: value });
        } else {
          Object.assign(updatedConfig, { [property]: value });
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
