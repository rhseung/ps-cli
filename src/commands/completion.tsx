import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { CommandBuilder, logger } from '../core';
import type { CommandFlags } from '../types/command';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default CommandBuilder.define(
  'completion',
  'zsh 자동 완성 설치 방법을 표시합니다.',
  async (_args: string[], _flags: CommandFlags): Promise<void> => {
    // 설치된 패키지의 completions 경로 (dist/commands에서 실행 시 패키지 루트는 ../..)
    const packageRoot = join(__dirname, '..', '..');
    const completionsPath = join(packageRoot, 'completions', '_ps');

    logger.bold('\n  zsh 자동 완성 설치\n');

    console.log(`
  방법 1: fpath에 추가 (권장)

    .zshrc에 다음을 추가하세요:

    ${logger.dim('# ps-cli zsh completion')}
    fpath=("${completionsPath}" $fpath)
    autoload -U compinit && compinit

  방법 2: 직접 source

    .zshrc에 다음을 추가하세요:

    source "${completionsPath}"

  적용: 변경 후 새 터미널을 열거나 \`exec zsh\` 실행

`);

    logger.dim(
      '  완료 후 "ps " 입력 후 Tab을 눌러 자동 완성을 확인할 수 있습니다.\n',
    );
  },
  {
    autoDetectProblemId: false,
    flags: [],
  },
);
