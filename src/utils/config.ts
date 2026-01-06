import Conf from "conf";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface ConfigSchema {
  bojSessionCookie?: string;
  defaultLanguage?: string;
  codeOpen?: boolean;
  editor?: string; // 에디터 명령어 (예: "code", "vim", "nano")
  autoOpenEditor?: boolean; // fetch 완료 후 자동으로 에디터 열기
  solvedAcHandle?: string; // Solved.ac 핸들 (stats 명령어용)
  problemDir?: string; // 문제 디렉토리 경로 (기본값: "problems", "." 또는 ""는 프로젝트 루트)
}

interface ProjectConfig {
  problemDir?: string;
  defaultLanguage?: string;
  editor?: string;
  autoOpenEditor?: boolean;
  solvedAcHandle?: string;
}

const config = new Conf<ConfigSchema>({
  projectName: "ps-cli",
  defaults: {
    bojSessionCookie: undefined,
    defaultLanguage: "python",
    codeOpen: false,
    editor: "code", // 기본값: VS Code
    autoOpenEditor: false, // 기본값: 자동 열기 비활성화
    solvedAcHandle: undefined,
    problemDir: "problems", // 기본값: problems 디렉토리
  },
});

// 프로젝트별 설정 파일 읽기 (캐싱)
let projectConfigCache: ProjectConfig | null = null;
let projectConfigCachePath: string | null = null;

// 동기적으로 프로젝트 설정 읽기
function getProjectConfigSync(): ProjectConfig | null {
  try {
    const cwd = process.cwd();
    const projectConfigPath = join(cwd, ".ps-cli.json");

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
      const content = readFileSync(projectConfigPath, "utf-8");
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
  return config.get("bojSessionCookie");
}

export function setBojSessionCookie(cookie: string): void {
  config.set("bojSessionCookie", cookie);
}

export function getDefaultLanguage(): string {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.defaultLanguage) {
    return projectConfig.defaultLanguage;
  }
  return config.get("defaultLanguage") ?? "python";
}

export function setDefaultLanguage(language: string): void {
  config.set("defaultLanguage", language);
}

export function getCodeOpen(): boolean {
  return config.get("codeOpen") ?? false;
}

export function setCodeOpen(open: boolean): void {
  config.set("codeOpen", open);
}

export function getEditor(): string {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.editor) {
    return projectConfig.editor;
  }
  return config.get("editor") ?? "code";
}

export function setEditor(editor: string): void {
  config.set("editor", editor);
}

export function getAutoOpenEditor(): boolean {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.autoOpenEditor !== undefined) {
    return projectConfig.autoOpenEditor;
  }
  return config.get("autoOpenEditor") ?? false;
}

export function setAutoOpenEditor(enabled: boolean): void {
  config.set("autoOpenEditor", enabled);
}

export function getSolvedAcHandle(): string | undefined {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.solvedAcHandle) {
    return projectConfig.solvedAcHandle;
  }
  return config.get("solvedAcHandle");
}

export function setSolvedAcHandle(handle: string): void {
  config.set("solvedAcHandle", handle);
}

export function getProblemDir(): string {
  const projectConfig = getProjectConfigSync();
  if (projectConfig?.problemDir !== undefined) {
    return projectConfig.problemDir;
  }
  return config.get("problemDir") ?? "problems";
}

export function setProblemDir(dir: string): void {
  config.set("problemDir", dir);
}

export function clearConfig(): void {
  config.clear();
}
