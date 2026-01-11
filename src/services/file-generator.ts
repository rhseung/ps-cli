import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import type { Problem } from '../types/index';
import type { Language } from '../utils/language';
import { getLanguageConfig } from '../utils/language';
import { getSolvingDirPath } from '../utils/problem-id';
import { getTierName, getTierImageUrl } from '../utils/tier';

function parseTimeLimitToMs(timeLimit?: string): number | undefined {
  if (!timeLimit) return undefined;
  const match = timeLimit.match(/([\d.]+)/);
  if (!match) return undefined;
  const seconds = parseFloat(match[1]);
  if (Number.isNaN(seconds)) return undefined;
  return Math.round(seconds * 1000);
}

// 프로젝트 루트 경로 찾기 (dist 또는 src에서 실행될 수 있음)
function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // dist/services에서 실행되는 경우
  if (__dirname.includes('dist')) {
    return join(__dirname, '../..');
  }
  // src/services에서 실행되는 경우 (개발 모드)
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
  const templatePath = join(projectRoot, 'templates', langConfig.templateFile);
  const solutionPath = join(problemDir, `solution.${langConfig.extension}`);

  // 템플릿 파일 복사
  try {
    const templateContent = await readFile(templatePath, 'utf-8');
    await writeFile(solutionPath, templateContent, 'utf-8');
  } catch {
    // 템플릿 파일이 없으면 기본 내용 생성
    await writeFile(
      solutionPath,
      `// Problem ${problem.id}: ${problem.title}\n`,
      'utf-8',
    );
  }

  // 예제 파일 생성
  for (let i = 0; i < problem.testCases.length; i++) {
    const testCase = problem.testCases[i];
    const inputPath = join(problemDir, `input${i + 1}.txt`);
    const outputPath = join(problemDir, `output${i + 1}.txt`);

    await writeFile(inputPath, testCase.input, 'utf-8');
    await writeFile(outputPath, testCase.output, 'utf-8');
  }

  // README.md 생성
  const tierName = getTierName(problem.level);
  const tierImageUrl = getTierImageUrl(problem.level);
  const tags = problem.tags.length > 0 ? problem.tags.join(', ') : '없음';

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

  const readmeContent = `# [${problem.id}: ${
    problem.title
  }](https://www.acmicpc.net/problem/${problem.id})

${infoTable}## 문제 설명
${problem.description || '설명 없음'}

## 입력
${problem.inputFormat || '입력 형식 없음'}

## 출력
${problem.outputFormat || '출력 형식 없음'}

## 예제
${problem.testCases
  .map(
    (tc, i) => `### 예제 ${i + 1}

**입력:**
\`\`\`
${tc.input.trimEnd()}
\`\`\`

**출력:**
\`\`\`
${tc.output.trimEnd()}
\`\`\`
`,
  )
  .join('\n')}

## 태그
${tags}
`;

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
