import { access, readFile, rename } from "fs/promises";
import { join } from "path";

import { execa } from "execa";
import { useEffect, useState } from "react";

import { findProjectRoot } from "../utils/config";
import { getSolvingDirPath, getProblemDirPath } from "../utils/problem-id";

export interface UseSolveParams {
  problemId: number;
  onComplete?: () => void;
}

export interface UseSolveReturn {
  status: "loading" | "success" | "error";
  message: string;
  error: string | null;
}

export function useSolve({
  problemId,
  onComplete,
}: UseSolveParams): UseSolveReturn {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("문제를 아카이브하는 중...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function solve() {
      try {
        // 프로젝트 루트 찾기
        const projectRoot = findProjectRoot();
        if (!projectRoot) {
          throw new Error("프로젝트 루트를 찾을 수 없습니다.");
        }

        // solving 디렉토리 경로
        const solvingDir = getSolvingDirPath(problemId, projectRoot);

        // solving 디렉토리에 문제가 있는지 확인
        setMessage("solving 디렉토리에서 문제를 확인하는 중...");
        try {
          await access(solvingDir);
        } catch {
          throw new Error(
            `solving 디렉토리에 문제 ${problemId}를 찾을 수 없습니다.`,
          );
        }

        // meta.json에서 문제 이름 읽기
        setMessage("문제 정보를 읽는 중...");
        const metaPath = join(solvingDir, "meta.json");
        let problemTitle = `문제 ${problemId}`;
        try {
          const metaContent = await readFile(metaPath, "utf-8");
          const meta = JSON.parse(metaContent) as { title?: string };
          if (meta.title) {
            problemTitle = meta.title;
          }
        } catch {
          // meta.json이 없거나 읽을 수 없어도 계속 진행
        }

        // problem 디렉토리 경로
        const problemDir = getProblemDirPath(problemId, projectRoot);

        // problem 디렉토리에 이미 같은 문제가 있는지 확인
        try {
          await access(problemDir);
          throw new Error(
            `problem 디렉토리에 이미 문제 ${problemId}가 존재합니다.`,
          );
        } catch (err) {
          // access 실패는 정상 (파일이 없음)
          if (err instanceof Error && err.message.includes("이미")) {
            throw err;
          }
        }

        // 디렉토리 이동
        setMessage("문제를 problem 디렉토리로 이동하는 중...");
        await rename(solvingDir, problemDir);

        // Git 커밋
        setMessage("Git 커밋을 실행하는 중...");
        try {
          // git add
          await execa("git", ["add", problemDir], { cwd: projectRoot });

          // git commit
          const commitMessage = `solve: ${problemId} - ${problemTitle}`;
          await execa("git", ["commit", "-m", commitMessage], {
            cwd: projectRoot,
          });
        } catch (gitError) {
          // Git 연동 실패해도 경고만 표시하고 계속 진행
          console.warn(
            "Git 커밋 실패:",
            gitError instanceof Error ? gitError.message : String(gitError),
          );
        }

        setStatus("success");
        setMessage(`문제 ${problemId}를 아카이브했습니다: ${problemDir}`);

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

    void solve();
  }, [problemId, onComplete]);

  return {
    status,
    message,
    error,
  };
}
