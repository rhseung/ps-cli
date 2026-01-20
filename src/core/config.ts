import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
} from 'fs';
import { join, dirname } from 'path';

import Conf from 'conf';
import { parse, stringify } from 'yaml';

import { type ProjectConfig } from '../types/index';

interface ConfigSchema {
  bojSessionCookie?: string;
  defaultLanguage?: string;
  codeOpen?: boolean;
  editor?: string;
  autoOpenEditor?: boolean;
  solvedAcHandle?: string;
  archiveDir?: string;
  solvingDir?: string;
  archiveAutoCommit?: boolean;
  archiveCommitMessage?: string;
  includeTag?: boolean;
}

export type ConfigKey =
  | 'general.default-language'
  | 'general.solved-ac-handle'
  | 'editor.command'
  | 'editor.auto-open'
  | 'paths.solving'
  | 'paths.archive'
  | 'paths.archive-strategy'
  | 'archive.auto-commit'
  | 'archive.commit-message'
  | 'markdown.include-tag';

export interface ConfigMetadata {
  key: ConfigKey;
  path: string; // "general.defaultLanguage" 등
  label: string;
  description: string;
  placeholder: string;
  type: 'string' | 'boolean' | 'select';
  suggestions?: string[];
}

export const getConfigMetadata = (): ConfigMetadata[] => [
  {
    key: 'general.default-language',
    path: 'general.defaultLanguage',
    label: '기본 언어',
    description: `기본으로 사용할 프로그래밍 언어입니다.`,
    placeholder: '언어 입력 (python, cpp 등)',
    type: 'select',
    suggestions: ['python', 'cpp'],
  },
  {
    key: 'general.solved-ac-handle',
    path: 'general.solvedAcHandle',
    label: 'Solved.ac 핸들',
    description: '사용자의 Solved.ac 핸들입니다 (통계 조회용).',
    placeholder: '핸들 입력',
    type: 'string',
  },
  {
    key: 'editor.command',
    path: 'editor.command',
    label: '에디터 명령어',
    description: '문제를 가져온 후 자동으로 열 에디터 명령어입니다.',
    placeholder: '에디터 명령어 입력 (예: code, cursor, vim)',
    type: 'string',
    suggestions: ['code', 'cursor', 'vim', 'nano'],
  },
  {
    key: 'editor.auto-open',
    path: 'editor.autoOpen',
    label: '자동 에디터 열기',
    description: 'fetch 명령 실행 후 자동으로 에디터를 열지 여부입니다.',
    placeholder: 'true 또는 false 입력',
    type: 'boolean',
    suggestions: ['true', 'false'],
  },
  {
    key: 'paths.solving',
    path: 'paths.solving',
    label: 'Solving 디렉토리',
    description: '현재 풀고 있는 문제를 담을 디렉토리 경로입니다.',
    placeholder: '디렉토리 경로 입력 (기본값: solving)',
    type: 'string',
    suggestions: ['solving', '.', ''],
  },
  {
    key: 'paths.archive',
    path: 'paths.archive',
    label: '아카이브 디렉토리',
    description: '해결한 문제를 보관할 디렉토리 경로입니다.',
    placeholder: '디렉토리 경로 입력 (기본값: problems)',
    type: 'string',
    suggestions: ['problems', '.', ''],
  },
  {
    key: 'paths.archive-strategy',
    path: 'paths.archiveStrategy',
    label: '아카이빙 전략',
    description: '문제를 아카이브할 때의 디렉토리 구조 전략입니다.',
    placeholder: '전략 입력 (flat, by-range, by-tier, by-tag)',
    type: 'select',
    suggestions: ['flat', 'by-range', 'by-tier', 'by-tag'],
  },
  {
    key: 'archive.auto-commit',
    path: 'archive.autoCommit',
    label: '자동 Git 커밋',
    description: '아카이브 시 자동으로 Git 커밋을 수행할지 여부입니다.',
    placeholder: 'true 또는 false 입력',
    type: 'boolean',
    suggestions: ['true', 'false'],
  },
  {
    key: 'archive.commit-message',
    path: 'archive.commitMessage',
    label: '커밋 메시지 템플릿',
    description: '아카이브 시 사용할 Git 커밋 메시지 템플릿입니다.',
    placeholder: '메시지 템플릿 입력 ({id}, {title} 사용 가능)',
    type: 'string',
  },
  {
    key: 'markdown.include-tag',
    path: 'markdown.includeTag',
    label: '태그 포함 여부',
    description: 'README 생성 시 알고리즘 분류(태그)를 포함할지 여부입니다.',
    placeholder: 'true 또는 false 입력',
    type: 'boolean',
    suggestions: ['true', 'false'],
  },
];

const config = new Conf<ConfigSchema>({
  projectName: 'ps-cli',
  defaults: {
    bojSessionCookie: undefined,
    defaultLanguage: 'python',
    codeOpen: false,
    editor: 'code',
    autoOpenEditor: false,
    solvedAcHandle: undefined,
    archiveDir: 'problems',
    solvingDir: 'solving',
    archiveAutoCommit: true,
    includeTag: true,
  },
});

// 프로젝트별 설정 파일 읽기 (캐싱)
let projectConfigCache: ProjectConfig | null = null;
let projectConfigCachePath: string | null = null;

/**
 * 프로젝트 루트 디렉토리를 찾습니다 (.ps-cli 디렉토리가 있는 디렉토리).
 */
export function findProjectRoot(
  startDir: string = process.cwd(),
): string | null {
  let currentDir = startDir;
  const rootPath =
    process.platform === 'win32' ? currentDir.split('\\')[0] + '\\' : '/';

  while (currentDir !== rootPath) {
    const psCliDir = join(currentDir, '.ps-cli');
    if (existsSync(psCliDir)) {
      return currentDir;
    }
    // 하위 호환성: .ps-cli.json 파일이 있는 경우도 루트로 인정
    if (existsSync(join(currentDir, '.ps-cli.json'))) {
      return currentDir;
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * 기존 .ps-cli.json 파일을 새로운 .ps-cli/config.yaml 구조로 마이그레이션합니다.
 */
function migrateOldConfig(projectRoot: string): ProjectConfig | null {
  const oldPath = join(projectRoot, '.ps-cli.json');
  if (!existsSync(oldPath)) return null;

  try {
    const content = readFileSync(oldPath, 'utf-8');
    const oldConfig = JSON.parse(content);

    const newConfig: ProjectConfig = {
      general: {
        defaultLanguage: oldConfig.defaultLanguage,
        solvedAcHandle: oldConfig.solvedAcHandle,
      },
      editor: {
        command: oldConfig.editor,
        autoOpen: oldConfig.autoOpenEditor,
      },
      paths: {
        solving: oldConfig.solvingDir,
        archive: oldConfig.archiveDir,
        archiveStrategy: oldConfig.archiveStrategy,
      },
      archive: {
        autoCommit: oldConfig.archiveAutoCommit,
        commitMessage: oldConfig.archiveCommitMessage,
      },
      markdown: {
        includeTag: oldConfig.includeTag,
      },
    };

    // .ps-cli 폴더 생성
    const psCliDir = join(projectRoot, '.ps-cli');
    if (!existsSync(psCliDir)) {
      mkdirSync(psCliDir, { recursive: true });
    }

    // config.yaml 저장
    const newPath = join(psCliDir, 'config.yaml');
    writeFileSync(newPath, stringify(newConfig), 'utf-8');

    // 이전 파일 삭제
    unlinkSync(oldPath);

    return newConfig;
  } catch (err) {
    console.error('설정 파일 마이그레이션 실패:', err);
    return null;
  }
}

// 동기적으로 프로젝트 설정 읽기
export function getProjectConfigSync(): ProjectConfig | null {
  try {
    const cwd = process.cwd();
    const projectRoot = findProjectRoot(cwd);
    if (!projectRoot) return null;

    const psCliDir = join(projectRoot, '.ps-cli');
    const configPath = join(psCliDir, 'config.yaml');

    // 마이그레이션 체크
    if (!existsSync(psCliDir) || !existsSync(configPath)) {
      const migrated = migrateOldConfig(projectRoot);
      if (migrated) {
        projectConfigCache = migrated;
        projectConfigCachePath = configPath;
        return migrated;
      }
      if (!existsSync(configPath)) return null;
    }

    if (projectConfigCache && projectConfigCachePath === configPath) {
      return projectConfigCache;
    }

    try {
      const content = readFileSync(configPath, 'utf-8');
      const projectConfig = parse(content) as ProjectConfig;
      projectConfigCache = projectConfig;
      projectConfigCachePath = configPath;
      return projectConfig;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export function getBojSessionCookie(): string | undefined {
  return process.env.PS_CLI_BOJ_COOKIE || config.get('bojSessionCookie');
}

export function setBojSessionCookie(cookie: string): void {
  config.set('bojSessionCookie', cookie);
}

export function getDefaultLanguage(): string {
  const projectConfig = getProjectConfigSync();
  return (
    projectConfig?.general?.defaultLanguage ||
    config.get('defaultLanguage') ||
    'python'
  );
}

export function setDefaultLanguage(language: string): void {
  config.set('defaultLanguage', language);
}

export function getCodeOpen(): boolean {
  return config.get('codeOpen') ?? false;
}

export function setCodeOpen(open: boolean): void {
  config.set('codeOpen', open);
}

export function getEditor(): string {
  const projectConfig = getProjectConfigSync();
  return projectConfig?.editor?.command || config.get('editor') || 'code';
}

export function setEditor(editor: string): void {
  config.set('editor', editor);
}

export function getAutoOpenEditor(): boolean {
  const projectConfig = getProjectConfigSync();
  return (
    projectConfig?.editor?.autoOpen ?? config.get('autoOpenEditor') ?? false
  );
}

export function setAutoOpenEditor(enabled: boolean): void {
  config.set('autoOpenEditor', enabled);
}

export function getSolvedAcHandle(): string | undefined {
  const projectConfig = getProjectConfigSync();
  return projectConfig?.general?.solvedAcHandle || config.get('solvedAcHandle');
}

export function setSolvedAcHandle(handle: string): void {
  config.set('solvedAcHandle', handle);
}

export function getArchiveDir(): string {
  const projectConfig = getProjectConfigSync();
  return (
    projectConfig?.paths?.archive || config.get('archiveDir') || 'problems'
  );
}

export function setArchiveDir(dir: string): void {
  config.set('archiveDir', dir);
}

export function getSolvingDir(): string {
  const projectConfig = getProjectConfigSync();
  return projectConfig?.paths?.solving || config.get('solvingDir') || 'solving';
}

export function setSolvingDir(dir: string): void {
  config.set('solvingDir', dir);
}

export function getArchiveStrategy(): string {
  const projectConfig = getProjectConfigSync();
  return (
    projectConfig?.paths?.archiveStrategy ||
    config.get('archiveStrategy') ||
    'flat'
  );
}

export function setArchiveStrategy(strategy: string): void {
  config.set('archiveStrategy', strategy);
}

export function getArchiveAutoCommit(): boolean {
  const projectConfig = getProjectConfigSync();
  return (
    projectConfig?.archive?.autoCommit ??
    config.get('archiveAutoCommit') ??
    true
  );
}

export function setArchiveAutoCommit(enabled: boolean): void {
  config.set('archiveAutoCommit', enabled);
}

export function getArchiveCommitMessage(): string | undefined {
  const projectConfig = getProjectConfigSync();
  return (
    projectConfig?.archive?.commitMessage || config.get('archiveCommitMessage')
  );
}

export function setArchiveCommitMessage(message: string): void {
  config.set('archiveCommitMessage', message);
}

export function getIncludeTag(): boolean {
  const projectConfig = getProjectConfigSync();
  return (
    projectConfig?.markdown?.includeTag ?? config.get('includeTag') ?? true
  );
}

export function setIncludeTag(enabled: boolean): void {
  config.set('includeTag', enabled);
}

export function clearConfig(): void {
  config.clear();
}
