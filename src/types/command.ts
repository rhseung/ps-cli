export interface CommandFlags {
  help?: boolean;
  [key: string]: unknown;
}

export interface CommandDefinition {
  name: string;
  help: string;
  execute: (args: string[], flags: CommandFlags) => Promise<void> | void;
  metadata?: CommandMetadata;
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
 * 플래그 정의 스키마 (타입 추론용)
 */
export type FlagDefinitionSchema = {
  readonly [K in string]: {
    readonly type?: 'string' | 'boolean' | 'number';
    readonly shortFlag?: string;
    readonly default?: string | boolean | number;
    readonly description?: string;
  };
};

/**
 * 플래그 스키마에서 타입을 추론하는 유틸리티 타입
 */
export type InferFlagsFromSchema<T extends FlagDefinitionSchema> = {
  [K in keyof T]: T[K]['type'] extends 'number'
    ? number
    : T[K]['type'] extends 'boolean'
      ? boolean
      : string;
} & CommandFlags;

/**
 * 플래그 정의 스키마를 FlagDefinition 배열로 변환하는 헬퍼 함수
 */
export function defineFlags<T extends FlagDefinitionSchema>(
  schema: T,
): Array<{
  name: string;
  options?: FlagOptions;
}> {
  return Object.entries(schema).map(([name, options]) => ({
    name,
    options: options as FlagOptions,
  }));
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
