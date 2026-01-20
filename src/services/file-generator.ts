import { existsSync } from 'fs';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  getLanguageConfig,
  getSolvingDirPath,
  getTierName,
  getTierImageUrl,
  parseTimeLimitToMs,
  getIncludeTag,
  findProjectRoot,
  type Language,
} from '../core';
import type { Problem } from '../types/index';

/**
 * Markdown 텍스트가 리스트, 테이블, 코드 블록 등으로 끝나는지 확인하고
 * 필요한 경우 적절한 개행을 추가합니다.
 */
function ensureTrailingNewline(content: string): string {
  if (!content || content.trim().length === 0) {
    return content;
  }

  // 이미 개행으로 끝나는지 확인
  const trimmed = content.trimEnd();
  if (trimmed.length === 0) {
    return content;
  }

  // 마지막 줄 확인
  const lines = trimmed.split('\n');
  const lastLine = lines[lines.length - 1];

  // 리스트 항목으로 끝나는지 확인 (unordered: - 또는 *, ordered: 숫자. 또는 숫자))
  const isListItem =
    /^[\s]*[-*]\s/.test(lastLine) || /^[\s]*\d+[.)]\s/.test(lastLine);

  // 테이블로 끝나는지 확인 (|로 시작하고 끝나는 줄)
  const isTableRow = /^\s*\|.+\|\s*$/.test(lastLine);

  // 코드 블록으로 끝나는지 확인 (```로 끝나는 경우)
  const isCodeBlock = trimmed.endsWith('```');

  // 이미지로 끝나는지 확인 (![...] (...) 형식)
  const isImage = /!\[.*\]\(.*\)$/.test(trimmed);

  // 리스트, 테이블, 코드 블록, 이미지로 끝나면 추가 개행 필요 (Markdown에서는 빈 줄이 있어야 함)
  if (isListItem || isTableRow || isCodeBlock || isImage) {
    return trimmed + '\n\n';
  }

  // 이미 개행으로 끝나지 않으면 개행 추가
  if (!content.endsWith('\n')) {
    return content + '\n\n';
  }

  // 개행이 하나만 있으면 하나 더 추가해서 빈 줄 만들기
  if (!content.endsWith('\n\n')) {
    return content + '\n';
  }

  return content;
}

// 프로젝트 루트 경로 찾기 (dist 또는 src에서 실행될 수 있음)
function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // templates 디렉토리가 있는 곳을 찾을 때까지 상위로 올라감
  let current = __dirname;
  while (current !== dirname(current)) {
    if (existsSync(join(current, 'templates'))) {
      return current;
    }
    current = dirname(current);
  }

  // 기본값 (이전 로직 fallback)
  return join(__dirname, '../..');
}

export async function generateProblemFiles(
  problem: Problem,
  language: Language = 'python',
): Promise<string> {
  const problemDir = getSolvingDirPath(problem.id, process.cwd(), problem);
  await mkdir(problemDir, { recursive: true });

  const langConfig = getLanguageConfig(language);
  const projectRoot = getProjectRoot();
  const userProjectRoot = findProjectRoot(process.cwd());
  const solutionPath = join(problemDir, `solution.${langConfig.extension}`);

  let templateContent = '';
  let templateFound = false;

  // 1. 프로젝트 로컬 템플릿 확인 (.ps-cli/templates/)
  if (userProjectRoot) {
    const localTemplatePath = join(
      userProjectRoot,
      '.ps-cli',
      'templates',
      langConfig.templateFile,
    );
    if (existsSync(localTemplatePath)) {
      try {
        templateContent = await readFile(localTemplatePath, 'utf-8');
        templateFound = true;
      } catch {
        // 읽기 실패 시 다음 단계로
      }
    }
  }

  // 2. 기본 템플릿 확인
  if (!templateFound) {
    const templatePath = join(
      projectRoot,
      'templates',
      langConfig.templateFile,
    );
    try {
      templateContent = await readFile(templatePath, 'utf-8');
    } catch {
      // 템플릿 파일이 없으면 기본 내용 생성
      templateContent = `// Problem ${problem.id}: ${problem.title}\n`;
    }
  }

  await writeFile(solutionPath, templateContent, 'utf-8');

  // 예제 파일 생성
  const testcasesDir = join(problemDir, 'testcases');
  for (let i = 0; i < problem.testCases.length; i++) {
    const testCase = problem.testCases[i];
    const caseDir = join(testcasesDir, String(i + 1));
    await mkdir(caseDir, { recursive: true });

    const inputPath = join(caseDir, 'input.txt');
    const outputPath = join(caseDir, 'output.txt');

    await writeFile(inputPath, testCase.input, 'utf-8');
    await writeFile(outputPath, testCase.output, 'utf-8');
  }

  // README.md 생성
  const tierName = getTierName(problem.level);
  const tierImageUrl = getTierImageUrl(problem.level);
  const tags = problem.tags.length > 0 ? problem.tags.join(', ') : '없음';
  const includeTag = getIncludeTag();

  // 문제 정보 테이블 생성
  const headers: string[] = [];
  const values: string[] = [];

  // 난이도 컬럼 (티어 이미지 + 이름)
  headers.push('난이도');
  values.push(`<img src="${tierImageUrl}" alt="${tierName}" width="20" />`);

  if (problem.timeLimit) {
    headers.push('시간 제한');
    values.push(problem.timeLimit);
  }
  if (problem.memoryLimit) {
    headers.push('메모리 제한');
    values.push(problem.memoryLimit);
  }
  if (problem.submissions) {
    headers.push('제출');
    values.push(problem.submissions);
  }
  if (problem.accepted) {
    headers.push('정답');
    values.push(problem.accepted);
  }
  if (problem.acceptedUsers) {
    headers.push('맞힌 사람');
    values.push(problem.acceptedUsers);
  }
  if (problem.acceptedRate) {
    headers.push('정답 비율');
    values.push(problem.acceptedRate);
  }

  let infoTable = '';
  if (headers.length > 0) {
    const headerRow = `| ${headers.join(' | ')} |`;
    const separatorRow = `|${headers.map(() => '---').join('|')}|`;
    const valueRow = `| ${values.join(' | ')} |`;
    infoTable = `\n${headerRow}\n${separatorRow}\n${valueRow}\n`;
  }

  // 각 필드에 적절한 개행 추가
  const description = ensureTrailingNewline(problem.description || '설명 없음');
  const inputFormat = ensureTrailingNewline(
    problem.inputFormat || '입력 형식 없음',
  );
  const outputFormat = ensureTrailingNewline(
    problem.outputFormat || '출력 형식 없음',
  );

  const readmeContent =
    `
# [${problem.id}: ${problem.title}](https://www.acmicpc.net/problem/${problem.id})

${infoTable.trim()}

## 문제 설명

${description.trim()}

## 입력

${inputFormat.trim()}

## 출력

${outputFormat.trim()}

## 예제

${problem.testCases
  .map((tc, i) =>
    `
### 예제 ${i + 1}

**입력:**

\`\`\`text
${tc.input.trim()}
\`\`\`

**출력:**

\`\`\`text
${tc.output.trim()}
\`\`\`
`.trim(),
  )
  .join('\n\n')}
${
  includeTag
    ? `
## 태그

${tags.trim()}
`
    : ''
}`.trim() + '\n';

  const readmePath = join(problemDir, 'README.md');
  await writeFile(readmePath, readmeContent, 'utf-8');

  // 메타데이터 저장 (예: 시간 제한 ms)
  const meta = {
    id: problem.id,
    title: problem.title,
    level: problem.level,
    tags: problem.tags,
    timeLimit: problem.timeLimit,
    timeLimitMs: parseTimeLimitToMs(problem.timeLimit),
    memoryLimit: problem.memoryLimit,
  };

  const metaPath = join(problemDir, 'meta.json');
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  return problemDir;
}
