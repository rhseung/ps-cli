import type {
  CommandDefinition,
  CommandMetadata,
  CommandFlags,
  FlagDefinition,
} from '../types/command';
import {
  resolveProblemContext,
  resolveLanguage,
} from '../utils/execution-context';
import {
  getSupportedLanguages,
  getSupportedLanguagesString,
  type Language,
} from '../utils/language';

import { type Command } from './base-command';

/**
 * Command 메타데이터를 저장하는 맵
 */
const commandMetadataMap = new Map<
  new (...args: unknown[]) => unknown,
  CommandMetadata
>();

/**
 * Command 데코레이터
 * 함수나 클래스에 Command 메타데이터를 첨부합니다.
 */
export function CommandDef(metadata: CommandMetadata) {
  return function (target: new (...args: unknown[]) => unknown) {
    commandMetadataMap.set(target, metadata);
  };
}

/**
 * Flag 데코레이터
 * 함수 파라미터에 플래그 메타데이터를 첨부합니다.
 * (현재는 Command 메타데이터의 flags 배열에 포함되어야 함)
 */
export function Flag(
  _name: string,
  _options?: {
    shortFlag?: string;
    type?: 'string' | 'boolean' | 'number';
    default?: string | boolean | number;
    description?: string;
  },
) {
  return function (
    _target: unknown,
    _propertyKey: string | symbol,
    _parameterIndex: number,
  ) {
    // 데코레이터는 메타데이터와 함께 사용되어야 함
    // 실제 플래그 정의는 Command 메타데이터의 flags 배열에 포함
  };
}

/**
 * Command Builder 클래스
 * Command 메타데이터를 기반으로 CommandDefinition을 생성합니다.
 */
export class CommandBuilder {
  /**
   * 메타데이터에서 CommandDefinition 생성
   */
  static build(
    executeFn: (args: string[], flags: CommandFlags) => Promise<void> | void,
    metadata?: CommandMetadata,
  ): CommandDefinition {
    // 함수에서 메타데이터 찾기
    const fnMetadata = commandMetadataMap.get(
      executeFn as unknown as new (...args: unknown[]) => unknown,
    );
    const finalMetadata = metadata || fnMetadata;

    if (!finalMetadata) {
      throw new Error(
        'Command 메타데이터가 필요합니다. @Command() 데코레이터를 사용하거나 metadata를 제공하세요.',
      );
    }

    // Help 문자열 생성
    const help = this.generateHelp(finalMetadata);

    // execute 함수 래핑 (자동 Problem ID 감지 및 Language 검증)
    const wrappedExecute = async (
      args: string[],
      flags: CommandFlags,
    ): Promise<void> => {
      // Help 플래그 처리
      if (flags.help) {
        console.log(help.trim());
        process.exit(0);
        return;
      }

      // 자동 Problem ID 감지가 활성화된 경우
      if (finalMetadata.autoDetectProblemId !== false) {
        // args에서 problemId 추출 (이미 getProblemId가 처리)
        // 실제 사용은 executeFn 내부에서 resolveProblemContext 사용 권장
      }

      // Language 검증 (autoDetectLanguage가 true인 경우)
      if (finalMetadata.autoDetectLanguage && flags.language) {
        const validLanguages = getSupportedLanguages();
        const language = flags.language as Language;
        if (!validLanguages.includes(language)) {
          console.error(
            `오류: 지원하지 않는 언어입니다. (${getSupportedLanguagesString()})`,
          );
          process.exit(1);
          return;
        }
      }

      // 원본 execute 함수 호출
      return executeFn(args, flags);
    };

    return {
      name: finalMetadata.name,
      help,
      execute: wrappedExecute,
    };
  }

  /**
   * Help 문자열 생성
   */
  private static generateHelp(metadata: CommandMetadata): string {
    const lines: string[] = [];

    // 사용법
    lines.push(`  사용법:`);
    lines.push(
      `    $ ps ${metadata.name}${
        metadata.requireProblemId ? ' <문제번호>' : ' [문제번호]'
      } [옵션]`,
    );
    lines.push('');

    // 설명
    lines.push(`  설명:`);
    const descriptionLines = metadata.description.split('\n');
    for (const line of descriptionLines) {
      lines.push(`    ${line}`);
    }
    lines.push('');

    // 옵션
    if (metadata.flags && metadata.flags.length > 0) {
      lines.push(`  옵션:`);
      for (const flag of metadata.flags) {
        const flagLine: string[] = [];
        flagLine.push(`    --${flag.name}`);
        if (flag.options?.shortFlag) {
          flagLine.push(`, -${flag.options.shortFlag}`);
        }
        if (flag.options?.description) {
          flagLine.push(`      ${flag.options.description}`);
        }
        lines.push(flagLine.join(''));
      }
      lines.push('');
    }

    // 예제
    if (metadata.examples && metadata.examples.length > 0) {
      lines.push(`  예제:`);
      for (const example of metadata.examples) {
        lines.push(`    $ ps ${example}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 간편한 Command 정의 헬퍼
   */
  static define(
    name: string,
    description: string,
    execute: (args: string[], flags: CommandFlags) => Promise<void> | void,
    options?: {
      flags?: FlagDefinition[];
      requireProblemId?: boolean;
      autoDetectProblemId?: boolean;
      autoDetectLanguage?: boolean;
      examples?: string[];
    },
  ): CommandDefinition {
    const metadata: CommandMetadata = {
      name,
      description,
      flags: options?.flags,
      requireProblemId: options?.requireProblemId,
      autoDetectProblemId: options?.autoDetectProblemId ?? true,
      autoDetectLanguage: options?.autoDetectLanguage,
      examples: options?.examples,
    };

    return this.build(execute, metadata);
  }

  /**
   * 클래스에서 CommandDefinition 생성
   * @Command() 데코레이터가 적용된 클래스에서 메타데이터를 읽어 CommandDefinition을 생성합니다.
   */
  static fromClass<T extends Command>(
    CommandClass: new () => T,
  ): CommandDefinition {
    // 클래스에서 메타데이터 찾기
    const metadata = commandMetadataMap.get(CommandClass);

    if (!metadata) {
      throw new Error(
        `Command 클래스에 @Command() 데코레이터가 적용되지 않았습니다: ${CommandClass.name}`,
      );
    }

    // 클래스 인스턴스 생성 및 execute 메서드 추출
    // BaseCommand는 추상 클래스이지만, 실제로는 구체적인 하위 클래스가 전달되므로 안전함
    const instance = new (CommandClass as new () => T)();
    const execute = instance.execute.bind(instance);

    if (typeof execute !== 'function') {
      throw new Error(
        `Command 클래스에 execute 메서드가 없습니다: ${CommandClass.name}`,
      );
    }

    return this.build(execute, metadata);
  }
}

/**
 * Problem ID 자동 감지 헬퍼
 * execute 함수 내부에서 사용할 수 있는 헬퍼 함수
 */
export async function withProblemContext<T>(
  args: string[],
  options: { requireId?: boolean } = {},
  callback: (
    context: Awaited<ReturnType<typeof resolveProblemContext>>,
  ) => Promise<T>,
): Promise<T> {
  const context = await resolveProblemContext(args, options);
  return callback(context);
}

/**
 * Language 자동 감지 헬퍼
 * execute 함수 내부에서 사용할 수 있는 헬퍼 함수
 */
export async function withLanguage(
  problemDir: string,
  override: string | undefined,
  callback: (language: Language) => Promise<void>,
): Promise<void> {
  const language = await resolveLanguage(
    problemDir,
    override as Language | undefined,
  );
  return callback(language);
}
