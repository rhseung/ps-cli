import { getProjectConfigSync } from './config';

export interface LanguageConfig {
  extension: string;
  templateFile: string;
  compileCommand?: string;
  runCommand: string;
}

export type Language = string;

export const DEFAULT_LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  python: {
    extension: 'py',
    templateFile: 'solution.py',
    runCommand: 'python3',
  },
  cpp: {
    extension: 'cpp',
    templateFile: 'solution.cpp',
    compileCommand: 'g++ -fdiagnostics-absolute-paths -o solution solution.cpp',
    runCommand: './solution',
  },
};

export function getSupportedLanguages(): string[] {
  const projectConfig = getProjectConfigSync();
  const customLanguages = Object.keys(projectConfig?.languages || {});
  const defaultLanguages = Object.keys(DEFAULT_LANGUAGE_CONFIGS);
  return Array.from(new Set([...defaultLanguages, ...customLanguages]));
}

export function getSupportedLanguagesString(): string {
  return getSupportedLanguages().join(', ');
}

export function getLanguageConfig(language: string): LanguageConfig {
  const projectConfig = getProjectConfigSync();
  const customConfig = projectConfig?.languages?.[language];

  if (customConfig) {
    return {
      extension: customConfig.extension,
      templateFile:
        customConfig.templateFile || `solution.${customConfig.extension}`,
      compileCommand: customConfig.compile,
      runCommand: customConfig.run,
    };
  }

  return (
    DEFAULT_LANGUAGE_CONFIGS[language] || DEFAULT_LANGUAGE_CONFIGS['python']
  );
}

export function detectLanguageFromFile(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  const languages = getSupportedLanguages();

  for (const lang of languages) {
    const config = getLanguageConfig(lang);
    if (config.extension === ext) {
      return lang;
    }
  }

  // 기본 확장자 매핑 (설정에 없을 경우를 대비)
  switch (ext) {
    case 'py':
      return 'python';
    case 'cpp':
    case 'cc':
    case 'cxx':
      return 'cpp';
    default:
      return null;
  }
}
