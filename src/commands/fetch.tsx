import React, { useState, useEffect } from "react";
import { render, Text, Box } from "ink";
import { getProblem } from "../services/solved-api";
import { scrapeProblem } from "../services/scraper";
import { generateProblemFiles } from "../services/file-generator";
import { ProblemDashboard } from "../components/problem-dashboard";
import { LoadingSpinner } from "../components/spinner";
import type { Problem } from "../types/index";
import type { Language } from "../utils/language";
import { getTierName } from "../utils/tier";
import { getProblemId } from "../utils/problem-id";
import {
  getSupportedLanguages,
  getSupportedLanguagesString,
} from "../utils/language";
import { getAutoOpenEditor, getEditor } from "../utils/config";
import { execaCommand } from "execa";

interface FetchCommandProps {
  problemId: number;
  language?: Language;
  onComplete?: () => void;
}

function FetchCommand({
  problemId,
  language = "python",
  onComplete,
}: FetchCommandProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [problem, setProblem] = useState<Problem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("문제 정보를 가져오는 중...");

  useEffect(() => {
    async function fetchProblem() {
      try {
        // Solved.ac API 호출
        setMessage("Solved.ac에서 문제 정보를 가져오는 중...");
        const solvedAcData = await getProblem(problemId);

        // BOJ 페이지 크롤링
        setMessage("BOJ에서 문제 상세 정보를 가져오는 중...");
        const scrapedData = await scrapeProblem(problemId);

        // 필수 데이터 검증
        if (!scrapedData.title && !solvedAcData.titleKo) {
          throw new Error(
            `문제 ${problemId}의 제목을 가져올 수 없습니다. 문제가 존재하지 않거나 접근할 수 없습니다.`
          );
        }

        // 문제 데이터 통합
        const combinedProblem: Problem = {
          id: problemId,
          title: solvedAcData.titleKo || scrapedData.title,
          level: solvedAcData.level,
          tier: getTierName(solvedAcData.level),
          tags: solvedAcData.tags.map(
            (tag) =>
              tag.displayNames.find((d) => d.language === "ko")?.name ||
              tag.displayNames[0]?.name ||
              tag.key
          ),
          timeLimit: scrapedData.timeLimit,
          memoryLimit: scrapedData.memoryLimit,
          submissions: scrapedData.submissions,
          accepted: scrapedData.accepted,
          acceptedUsers: scrapedData.acceptedUsers,
          acceptedRate: scrapedData.acceptedRate,
          description: scrapedData.description,
          inputFormat: scrapedData.inputFormat,
          outputFormat: scrapedData.outputFormat,
          testCases: scrapedData.testCases,
        };

        setProblem(combinedProblem);

        // 파일 생성
        setMessage("파일을 생성하는 중...");
        const problemDir = await generateProblemFiles(
          combinedProblem,
          language
        );

        setStatus("success");
        setMessage(`✓ 문제 파일이 생성되었습니다: ${problemDir}`);

        // 에디터 자동 열기 (설정이 활성화된 경우)
        if (getAutoOpenEditor()) {
          try {
            const editor = getEditor();
            await execaCommand(`${editor} ${problemDir}`, {
              shell: true,
              detached: true,
              stdio: "ignore",
            });
            setMessage(
              `✓ 문제 파일이 생성되었습니다: ${problemDir}\n✓ ${editor}로 열었습니다.`
            );
          } catch (err) {
            // 에디터 열기 실패해도 계속 진행
            console.warn(
              `에디터를 열 수 없습니다: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }

        setTimeout(() => {
          onComplete?.();
        }, 2000);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
        setTimeout(() => {
          onComplete?.();
        }, 2000);
      }
    }

    fetchProblem();
  }, [problemId, language, onComplete]);

  if (status === "loading") {
    return (
      <Box flexDirection="column">
        <LoadingSpinner message={message} />
        {problem && <ProblemDashboard problem={problem} />}
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ 오류 발생: {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      {problem && (
        <Box alignSelf="flex-start">
          <ProblemDashboard problem={problem} />
        </Box>
      )}
      <Text color="green">{message}</Text>
    </Box>
  );
}

async function fetchCommand(problemId: number, language?: Language) {
  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <FetchCommand
        problemId={problemId}
        language={language}
        onComplete={() => {
          unmount();
          resolve();
        }}
      />
    );
  });
}

export const fetchHelp = `
  사용법:
    $ ps fetch <문제번호> [옵션]

  설명:
    백준 문제를 가져와서 로컬에 파일을 생성합니다.
    - Solved.ac API와 BOJ 크롤링을 통해 문제 정보 수집
    - 문제 설명, 입출력 형식, 예제 입출력 파일 자동 생성
    - 선택한 언어의 솔루션 템플릿 파일 생성
    - README.md에 문제 정보, 통계, 태그 등 포함

  옵션:
    --language, -l      언어 선택 (${getSupportedLanguagesString()})
                        기본값: python

  예제:
    $ ps fetch 1000
    $ ps fetch 1000 --language python
    $ ps fetch 1000 -l cpp
`;

export async function fetchExecute(
  args: string[],
  flags: { language?: string; help?: boolean }
): Promise<void> {
  if (flags.help) {
    console.log(fetchHelp.trim());
    process.exit(0);
    return;
  }

  const problemId = getProblemId(args);

  if (problemId === null) {
    console.error("오류: 문제 번호를 입력해주세요.");
    console.error(`사용법: ps fetch <문제번호> [옵션]`);
    console.error(`도움말: ps fetch --help`);
    console.error(
      `힌트: problems/{문제번호} 디렉토리에서 실행하면 자동으로 문제 번호를 추론합니다.`
    );
    process.exit(1);
  }

  const validLanguages = getSupportedLanguages();

  const language = flags.language as Language | undefined;
  if (language && !validLanguages.includes(language)) {
    console.error(
      `오류: 지원하지 않는 언어입니다. (${getSupportedLanguagesString()})`
    );
    process.exit(1);
  }

  await fetchCommand(problemId, language || "python");
}
