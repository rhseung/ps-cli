import chalk from 'chalk';

import type {
  CommandDefinition,
  CommandMetadata,
  FlagDefinition,
} from '../types/command';

import { icons } from './icons';
import { colors, logger, psGradient } from './logger';

export function generateGlobalHelp(
  commands: Map<string, CommandDefinition>,
): string {
  const title = psGradient.multiline(`

  ██████╗ ███████╗     ██████╗██╗     ██╗
  ██╔══██╗██╔════╝    ██╔════╝██║     ██║
  ██████╔╝███████╗    ██║     ██║     ██║
  ██╔═══╝ ╚════██║    ██║     ██║     ██║
  ██║     ███████║    ╚██████╗███████╗██║
  ╚═╝     ╚══════╝     ╚═════╝╚══════╝╚═╝
  `);

  const usage = `
  ${logger.bold('사용법:')}
    $ ps ${chalk.hex(colors.primary)('<명령어>')} [인자] [옵션]
  `;

  const commandLines = Array.from(commands.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((cmd) => {
      const icon = icons[cmd.name as keyof typeof icons] || '  ';
      return `    ${chalk.hex(colors.primary)(cmd.name.padEnd(12))} ${chalk.dim(icon)} ${cmd.metadata?.description.split('\n')[0]}`;
    })
    .join('\n');

  const commandsSection = `
  ${logger.bold('명령어:')}
${commandLines}
    ${chalk.hex(colors.primary)('help'.padEnd(12))} ${chalk.dim(icons.info)} 도움말 표시
  `;

  const quickStart = `
  ${logger.bold('빠른 시작:')}
    $ ps ${chalk.hex(colors.primary)('init')}           ${chalk.dim(icons.init)} 프로젝트 초기화
    $ ps ${chalk.hex(colors.primary)('fetch')} 1000     ${chalk.dim(icons.fetch)} 문제 가져오기
    $ ps ${chalk.hex(colors.primary)('test')}            ${chalk.dim(icons.test)} 테스트 실행
    $ ps ${chalk.hex(colors.primary)('submit')}          ${chalk.dim(icons.submit)} 제출
  `;

  const moreInfo = `
  ${logger.bold('자세한 도움말:')}
    $ ps ${chalk.hex(colors.primary)('<명령어>')} --help
  `;

  return [title, usage, commandsSection, quickStart, moreInfo]
    .map((s) => s.trim())
    .join('\n\n');
}

export function generateCommandHelp(metadata: CommandMetadata): string {
  const usage = `
  ${logger.bold('사용법:')}
    $ ps ${chalk.hex(colors.primary)(metadata.name)}${
      metadata.requireProblemId
        ? ` ${chalk.hex(colors.secondary)('<문제번호>')}`
        : metadata.autoDetectProblemId !== false
          ? ` ${chalk.dim('[문제번호]')}`
          : ''
    } [옵션]
  `;

  const description = `
  ${logger.bold('설명:')}
${metadata.description
  .split('\n')
  .map((line: string) => `    ${line}`)
  .join('\n')}
  `;

  let flagsSection = '';
  if (metadata.flags && metadata.flags.length > 0) {
    const flagLines = metadata.flags
      .map((flag: FlagDefinition) => {
        const name = `--${flag.name}`;
        const short = flag.options?.shortFlag
          ? `, -${flag.options.shortFlag}`
          : '';
        const desc = flag.options?.description
          ? `  ${flag.options.description}`
          : '';
        return `    ${chalk.hex(colors.primary)((name + short).padEnd(20))}${chalk.dim(desc)}`;
      })
      .join('\n');

    flagsSection = `
  ${logger.bold('옵션:')}
${flagLines}
    ${chalk.hex(colors.primary)('--help, -h'.padEnd(20))}${chalk.dim('  도움말 표시')}
    `;
  } else {
    flagsSection = `
  ${logger.bold('옵션:')}
    ${chalk.hex(colors.primary)('--help, -h'.padEnd(20))}${chalk.dim('  도움말 표시')}
    `;
  }

  let examplesSection = '';
  if (metadata.examples && metadata.examples.length > 0) {
    const exampleLines = metadata.examples
      .map((ex: string) => `    $ ps ${ex}`)
      .join('\n');

    examplesSection = `
  ${logger.bold('예제:')}
${exampleLines}
    `;
  }

  return [usage, description, flagsSection, examplesSection]
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim())
    .join('\n\n');
}
