import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

import Conf from 'conf';

import { type ProjectConfig } from '../types/index';

interface ConfigSchema {
  bojSessionCookie?: string;
  defaultLanguage?: string;
  codeOpen?: boolean;
  editor?: string; // 에디터 명령어 (예: "code", "vim", "nano")
  autoOpenEditor?: boolean; // fetch 완료 후 자동으로 에디터 열기
  solvedAcHandle?: string; // Solved.ac 핸들 (stats 명령어용)
  archiveDir?: string; // 아카이브 디렉토리 경로 (기본값: "problems", "." 또는 ""는 프로젝트 루트)
  solvingDir?: string; // 푸는 중인 문제 디렉토리 경로 (기본값: "solving", "." 또는 ""는 프로젝트 루트)
  archiveAutoCommit?: boolean; // 아카이브 시 Git 커밋 자동 실행 여부
  archiveCommitMessage?: string; // 아카이브 커밋 메시지 템플릿
  includeTag?: boolean; // README에 알고리즘 분류 포함 여부
}

export type ConfigKey =
  | 'default-language'
  | 'editor'
  | 'auto-open-editor'
  | 'solved-ac-handle'
  | 'archive-dir'
  | 'solving-dir'
  | 'archive-strategy'
  | 'archive-auto-commit'
  | 'archive-commit-message'
  | 'include-tag';

export interface ConfigMetadata {
  key: ConfigKey;
  property: keyof ProjectConfig;
  label: string;
  description: string;
  placeholder: string;
  type: 'string' | 'boolean' | 'select';
  suggestions?: string[];
}

export const getConfigMetadata = (): ConfigMetadata[] => [
  {
    key: 'default-language',
    property: 'defaultLanguage',
    label: '기본 언어',
    description: `기본으로 사용할 프로그래밍 언어입니다.`,
    placeholder: '언어 입력 (python, javascript, typescript, cpp)',
    type: 'select',
    suggestions: ['python', 'javascript', 'typescript', 'cpp'],
  },
  {
    key: 'editor',
    property: 'editor',
    label: '에디터',
    description: '문제를 가져온 후 자동으로 열 에디터 명령어입니다.',
    placeholder: '에디터 명령어 입력 (예: code, cursor, vim, nano)',
    type: 'string',
    suggestions: ['code', 'cursor', 'vim', 'nano'],
  },
  {
    key: 'auto-open-editor',
    property: 'autoOpenEditor',
    label: '자동 에디터 열기',
    description: 'fetch 명령 실행 후 자동으로 에디터를 열지 여부입니다.',
    placeholder: 'true 또는 false 입력',
    type: 'boolean',
    suggestions: ['true', 'false'],
  },
  {
    key: 'solved-ac-handle',
    property: 'solvedAcHandle',
    label: 'Solved.ac 핸들',
    description: '사용자의 Solved.ac 핸들입니다 (통계 조회용).',
    placeholder: '핸들 입력',
    type: 'string',
  },
  {
    key: 'archive-dir',
    property: 'archiveDir',
    label: '아카이브 디렉토리',
    description: '해결한 문제를 보관할 디렉토리 경로입니다.',
    placeholder: '디렉토리 경로 입력 (기본값: problems)',
    type: 'string',
    suggestions: ['problems', '.', ''],
  },
  {
    key: 'solving-dir',
    property: 'solvingDir',
    label: 'Solving 디렉토리',
    description: '현재 풀고 있는 문제를 담을 디렉토리 경로입니다.',
    placeholder: '디렉토리 경로 입력 (기본값: solving)',
    type: 'string',
    suggestions: ['solving', '.', ''],
  },
  {
    key: 'archive-strategy',
    property: 'archiveStrategy',
    label: '아카이빙 전략',
    description: '문제를 아카이브할 때의 디렉토리 구조 전략입니다.',
    placeholder: '전략 입력 (flat, by-range, by-tier, by-tag)',
    type: 'select',
    suggestions: ['flat', 'by-range', 'by-tier', 'by-tag'],
  },
  {
    key: 'archive-auto-commit',
    property: 'archiveAutoCommit',
    label: '자동 Git 커밋',
    description: '아카이브 시 자동으로 Git 커밋을 수행할지 여부입니다.',
    placeholder: 'true 또는 false 입력',
    type: 'boolean',
    suggestions: ['true', 'false'],
  },
  {
    key: 'archive-commit-message',
    property: 'archiveCommitMessage',
    label: '커밋 메시지 템플릿',
    description: '아카이브 시 사용할 Git 커밋 메시지 템플릿입니다.',
    placeholder: '메시지 템플릿 입력 ({id}, {title} 사용 가능)',
    type: 'string',
  },
  {
    key: 'include-tag',
    property: 'includeTag',
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
    editor: 'code', // 기본값: VS Code
    autoOpenEditor: false, // 기본값: 자동 열기 비활성화
    solvedAcHandle: undefined,
    archiveDir: 'problems', // 기본값: problems 디렉토리
    solvingDir: 'solving', // 기본값: solving 디렉토리
    archiveAutoCommit: true,
    includeTag: true,
  },
});

// 프로젝트별 설정 파일 읽기 (캐싱)
let projectConfigCache: ProjectConfig | null = null;
let projectConfigCachePath: string | null = null;

/**
 * 프로젝트 루트 디렉토리를 찾습니다 (.ps-cli.json 파일이 있는 디렉토리).
 */
export function findProjectRoot(
  startDir: string = process.cwd(),
): string | null {
  let currentDir = startDir;
  const rootPath =
    process.platform === 'win32' ? currentDir.split('\\')[0] + '\\' : '/';

  while (currentDir !== rootPath) {
    const projectConfigPath = join(currentDir, '.ps-cli.json');
    if (existsSync(projectConfigPath)) {
      return currentDir;
    }
    const parentDir = dirname(currentDir);
    // 루트에 도달했거나 더 이상 올라갈 수 없으면 중단
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

// 동기적으로 프로젝트 설정 읽기
function getProjectConfigSync(): ProjectConfig | null {
  try {
    const cwd = process.cwd();

    // 프로젝트 루트 찾기
    const projectRoot = findProjectRoot(cwd);
    if (!projectRoot) {
      projectConfigCache = null;
      projectConfigCachePath = null;
      return null;
    }

    const projectConfigPath = join(projectRoot, '.ps-cli.json');

    // 캐시된 경로와 같으면 캐시 사용
    if (projectConfigCache && projectConfigCachePath === projectConfigPath) {
      return projectConfigCache;
    }

    // 파일이 존재하는지 확인
    if (!existsSync(projectConfigPath)) {
      projectConfigCache = null;
      projectConfigCachePath = null;
      return null;
    }

    // 파일 읽기
    try {
      const content = readFileSync(projectConfigPath, 'utf-8');
      const projectConfig = JSON.parse(content) as ProjectConfig;
      projectConfigCache = projectConfig;
      projectConfigCachePath = projectConfigPath;
      return projectConfig;
    } catch {
      // JSON 파싱 실패
      projectConfigCache = null;
      projectConfigCachePath = null;
      return null;
    }
  } catch {
    return null;
  }
}

export function getBojSessionCookie(): string | undefined {
  // 환경 변수에서 먼저 확인
  const envCookie = process.env.PS_CLI_BOJ_COOKIE;
  if (envCookie) {
    return envCookie;
  }
  // 설정 파일에서 확인
  return config.get('bojSessionCookie');
}

export function setBojSessionCookie(cookie: string): void {
  config.set('bojSessionCookie', cookie);
}

export function getDefaultLanguage(): string {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.defaultLanguage) {
    return projectConfig.defaultLanguage;
  }
  return config.get('defaultLanguage') ?? 'python';
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
  if (projectConfig?.editor) {
    return projectConfig.editor;
  }
  return config.get('editor') ?? 'code';
}

export function setEditor(editor: string): void {
  config.set('editor', editor);
}

export function getAutoOpenEditor(): boolean {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.autoOpenEditor !== undefined) {
    return projectConfig.autoOpenEditor;
  }
  return config.get('autoOpenEditor') ?? false;
}

export function setAutoOpenEditor(enabled: boolean): void {
  config.set('autoOpenEditor', enabled);
}

export function getSolvedAcHandle(): string | undefined {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.solvedAcHandle) {
    return projectConfig.solvedAcHandle;
  }
  return config.get('solvedAcHandle');
}

export function setSolvedAcHandle(handle: string): void {
  config.set('solvedAcHandle', handle);
}

export function getArchiveDir(): string {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.archiveDir !== undefined) {
    return projectConfig.archiveDir;
  }
  return config.get('archiveDir') ?? 'problems';
}

export function setArchiveDir(dir: string): void {
  config.set('archiveDir', dir);
}

export function getSolvingDir(): string {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.solvingDir !== undefined) {
    return projectConfig.solvingDir;
  }
  return config.get('solvingDir') ?? 'solving';
}

export function setSolvingDir(dir: string): void {
  config.set('solvingDir', dir);
}

export function getArchiveStrategy(): string {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.archiveStrategy !== undefined) {
    return projectConfig.archiveStrategy;
  }
  return config.get('archiveStrategy') ?? 'flat';
}

export function setArchiveStrategy(strategy: string): void {
  config.set('archiveStrategy', strategy);
}

export function getArchiveAutoCommit(): boolean {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.archiveAutoCommit !== undefined) {
    return projectConfig.archiveAutoCommit;
  }
  const globalValue = config.get('archiveAutoCommit');
  if (globalValue !== undefined) {
    return globalValue;
  }
  return true;
}

export function setArchiveAutoCommit(enabled: boolean): void {
  config.set('archiveAutoCommit', enabled);
}

export function getArchiveCommitMessage(): string | undefined {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.archiveCommitMessage !== undefined) {
    return projectConfig.archiveCommitMessage;
  }
  return config.get('archiveCommitMessage');
}

export function setArchiveCommitMessage(message: string): void {
  config.set('archiveCommitMessage', message);
}

export function getIncludeTag(): boolean {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.includeTag !== undefined) {
    return projectConfig.includeTag;
  }
  return config.get('includeTag') ?? true;
}

export function setIncludeTag(enabled: boolean): void {
  config.set('includeTag', enabled);
}

export function clearConfig(): void {
  config.clear();
}
