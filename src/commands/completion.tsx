import { existsSync, readFileSync, appendFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { CommandBuilder, logger } from '../core';
import type { CommandFlags } from '../types/command';
import { defineFlags } from '../types/command';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COMPLETION_MARKER = '# ps-cli zsh completion';
const COMPLETION_END_MARKER = '# end ps-cli zsh completion';

function getZshrcPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    throw new Error('HOME 환경 변수를 찾을 수 없습니다.');
  }
  return join(home, '.zshrc');
}

function getCompletionBlock(completionsDir: string): string {
  return `
${COMPLETION_MARKER}
fpath=("${completionsDir}" $fpath)
autoload -U compinit && compinit
${COMPLETION_END_MARKER}
`;
}

function isAlreadyInstalled(zshrcPath: string): boolean {
  if (!existsSync(zshrcPath)) return false;
  const content = readFileSync(zshrcPath, 'utf-8');
  return content.includes(COMPLETION_MARKER);
}

export default CommandBuilder.define(
  'completion',
  'zsh 자동 완성 설치 방법을 표시하거나 자동으로 설치합니다.',
  async (_args: string[], flags: CommandFlags): Promise<void> => {
    const packageRoot = join(__dirname, '..', '..');
    const completionsDir = join(packageRoot, 'completions');
    const completionsPath = join(completionsDir, '_ps');

    if (!existsSync(completionsPath)) {
      logger.error('completions 파일을 찾을 수 없습니다.');
      console.log(`  예상 경로: ${completionsPath}`);
      process.exit(1);
      return;
    }

    if (flags.install) {
      const zshrcPath = getZshrcPath();

      if (isAlreadyInstalled(zshrcPath)) {
        logger.success('zsh 자동 완성이 이미 설치되어 있습니다.');
        logger.dim(`  설정 위치: ${zshrcPath}\n`);
        return;
      }

      try {
        appendFileSync(zshrcPath, getCompletionBlock(completionsDir));
        logger.success('zsh 자동 완성이 설치되었습니다.');
        console.log(`
  ${logger.dim('설정이 .zshrc에 추가되었습니다.')}
  ${logger.dim('적용: 새 터미널을 열거나')} exec zsh ${logger.dim('실행')}

`);
      } catch (err) {
        logger.error('설치에 실패했습니다.');
        console.error(err);
        process.exit(1);
        return;
      }
      return;
    }

    logger.bold('\n  zsh 자동 완성 설치\n');

    console.log(`
  자동 설치 (권장):

    ps completion --install

  수동 설치:

    .zshrc에 다음을 추가하세요:

    ${logger.dim('# ps-cli zsh completion')}
    fpath=("${completionsDir}" $fpath)
    autoload -U compinit && compinit

  적용: 변경 후 새 터미널을 열거나 \`exec zsh\` 실행

`);

    logger.dim(
      '  완료 후 "ps " 입력 후 Tab을 눌러 자동 완성을 확인할 수 있습니다.\n',
    );
  },
  {
    autoDetectProblemId: false,
    flags: defineFlags({
      install: {
        type: 'boolean',
        description: '.zshrc에 자동 완성 설정을 자동으로 추가합니다',
      },
    }),
  },
);
