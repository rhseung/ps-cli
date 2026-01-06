import Conf from "conf";

interface ConfigSchema {
  bojSessionCookie?: string;
  defaultLanguage?: string;
  codeOpen?: boolean;
  editor?: string; // 에디터 명령어 (예: "code", "vim", "nano")
  autoOpenEditor?: boolean; // fetch 완료 후 자동으로 에디터 열기
  solvedAcHandle?: string; // Solved.ac 핸들 (stats 명령어용)
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
  },
});

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
  return config.get("editor") ?? "code";
}

export function setEditor(editor: string): void {
  config.set("editor", editor);
}

export function getAutoOpenEditor(): boolean {
  return config.get("autoOpenEditor") ?? false;
}

export function setAutoOpenEditor(enabled: boolean): void {
  config.set("autoOpenEditor", enabled);
}

export function getSolvedAcHandle(): string | undefined {
  return config.get("solvedAcHandle");
}

export function setSolvedAcHandle(handle: string): void {
  config.set("solvedAcHandle", handle);
}
