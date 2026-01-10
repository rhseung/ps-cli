import { execaCommand } from "execa";
import { useEffect, useState } from "react";

import { generateProblemFiles } from "../services/file-generator";
import { scrapeProblem } from "../services/scraper";
import { getProblem } from "../services/solved-api";
import type { Problem } from "../types/index";
import { getAutoOpenEditor, getEditor } from "../utils/config";
import type { Language } from "../utils/language";
import { getTierName } from "../utils/tier";

export interface UseFetchProblemParams {
  problemId: number;
  language: Language;
  onComplete?: () => void;
}

export interface UseFetchProblemReturn {
  status: "loading" | "success" | "error";
  problem: Problem | null;
  error: string | null;
  message: string;
}

export function useFetchProblem({
  problemId,
  language,
  onComplete,
}: UseFetchProblemParams): UseFetchProblemReturn {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
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
            `문제 ${problemId}의 제목을 가져올 수 없습니다. 문제가 존재하지 않거나 접근할 수 없습니다.`,
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
              tag.key,
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
          language,
        );

        setStatus("success");
        setMessage(`문제 파일이 생성되었습니다: ${problemDir}`);

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
              `문제 파일이 생성되었습니다: ${problemDir}\n${editor}로 열었습니다.`,
            );
          } catch (err) {
            // 에디터 열기 실패해도 계속 진행
            console.warn(
              `에디터를 열 수 없습니다: ${
                err instanceof Error ? err.message : String(err)
              }`,
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

    void fetchProblem();
  }, [problemId, language, onComplete]);

  return {
    status,
    problem,
    error,
    message,
  };
}
