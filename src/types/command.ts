export interface CommandFlags {
  language?: string;
  watch?: boolean;
  help?: boolean;
  [key: string]: unknown;
}

export interface CommandDefinition {
  name: string;
  help: string;
  execute: (args: string[], flags: CommandFlags) => Promise<void> | void;
}

/**
 * 플래그 정의 옵션
 */
export interface FlagOptions {
  /** 짧은 플래그 (예: "l" -> -l) */
  shortFlag?: string;
  /** 플래그 타입 */
  type?: 'string' | 'boolean' | 'number';
  /** 기본값 */
  default?: string | boolean | number;
  /** 설명 */
  description?: string;
}

/**
 * 플래그 정의
 */
export interface FlagDefinition {
  name: string;
  options?: FlagOptions;
}

/**
 * Command 메타데이터
 */
export interface CommandMetadata {
  /** 명령어 이름 */
  name: string;
  /** 명령어 설명 */
  description: string;
  /** 플래그 정의 */
  flags?: FlagDefinition[];
  /** Problem ID 자동 감지 여부 (기본값: true) */
  autoDetectProblemId?: boolean;
  /** Problem ID 필수 여부 */
  requireProblemId?: boolean;
  /** Language 자동 감지 여부 (기본값: false) */
  autoDetectLanguage?: boolean;
  /** 사용 예제 */
  examples?: string[];
}
