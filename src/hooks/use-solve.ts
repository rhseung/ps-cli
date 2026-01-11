import { access, readFile, rename, mkdir, readdir, rmdir } from 'fs/promises';
import { join, dirname } from 'path';

import { execa } from 'execa';
import { useEffect, useState } from 'react';

import type { Problem } from '../types/index';
import { findProjectRoot, getSolvingDir } from '../utils/config';
import { getSolvingDirPath, getProblemDirPath } from '../utils/problem-id';

export interface UseSolveParams {
  problemId: number;
  onComplete?: () => void;
}

export interface UseSolveReturn {
  status: 'loading' | 'success' | 'error';
  message: string;
  error: string | null;
}

export function useSolve({
  problemId,
  onComplete,
}: UseSolveParams): UseSolveReturn {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('문제를 아카이브하는 중...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function solve() {
      try {
        // 프로젝트 루트 찾기
        const projectRoot = findProjectRoot();
        if (!projectRoot) {
          throw new Error('프로젝트 루트를 찾을 수 없습니다.');
        }

        // solving 디렉토리 경로
        const solvingDir = getSolvingDirPath(problemId, projectRoot);

        // solving 디렉토리에 문제가 있는지 확인
        setMessage('solving 디렉토리에서 문제를 확인하는 중...');
        try {
          await access(solvingDir);
        } catch {
          throw new Error(
            `solving 디렉토리에 문제 ${problemId}를 찾을 수 없습니다.`,
          );
        }

        // meta.json에서 문제 정보 읽기
        setMessage('문제 정보를 읽는 중...');
        const metaPath = join(solvingDir, 'meta.json');
        let problemTitle = `문제 ${problemId}`;
        let problem: Problem | undefined;
        try {
          const metaContent = await readFile(metaPath, 'utf-8');
          const meta = JSON.parse(metaContent) as {
            id?: number;
            title?: string;
            level?: number;
            tags?: string[];
          };
          if (meta.title) {
            problemTitle = meta.title;
          }
          // 문제 정보 구성 (아카이빙 전략에 필요)
          if (meta.id && meta.level !== undefined) {
            problem = {
              id: meta.id,
              title: meta.title || `문제 ${meta.id}`,
              level: meta.level,
              tier: '', // tier는 level에서 계산되므로 빈 문자열로 충분
              tags: meta.tags || [],
              testCases: [],
            };
          }
        } catch {
          // meta.json이 없거나 읽을 수 없어도 계속 진행
        }

        // problem 디렉토리 경로 (문제 정보 전달)
        const problemDir = getProblemDirPath(problemId, projectRoot, problem);

        // problem 디렉토리에 이미 같은 문제가 있는지 확인
        try {
          await access(problemDir);
          throw new Error(
            `problem 디렉토리에 이미 문제 ${problemId}가 존재합니다.`,
          );
        } catch (err) {
          // access 실패는 정상 (파일이 없음)
          if (err instanceof Error && err.message.includes('이미')) {
            throw err;
          }
        }

        // 타겟 디렉토리의 부모 디렉토리 생성 (아카이빙 전략에 따라 필요)
        const problemDirParent = dirname(problemDir);
        setMessage('아카이브 디렉토리를 준비하는 중...');
        await mkdir(problemDirParent, { recursive: true });

        // 디렉토리 이동
        setMessage('문제를 problem 디렉토리로 이동하는 중...');
        await rename(solvingDir, problemDir);

        // solving dir의 빈 부모 디렉토리 삭제
        setMessage('빈 디렉토리 정리 중...');
        try {
          const solvingDirConfig = getSolvingDir();
          if (
            solvingDirConfig &&
            solvingDirConfig !== '.' &&
            solvingDirConfig !== ''
          ) {
            let currentParentDir = dirname(solvingDir);
            const solvingBaseDir = join(projectRoot, solvingDirConfig);

            // solving dir의 부모 디렉토리들을 재귀적으로 확인하고 삭제
            while (
              currentParentDir !== solvingBaseDir &&
              currentParentDir !== projectRoot
            ) {
              try {
                const entries = await readdir(currentParentDir);
                // 디렉토리가 비어있으면 삭제
                if (entries.length === 0) {
                  await rmdir(currentParentDir);
                  currentParentDir = dirname(currentParentDir);
                } else {
                  // 비어있지 않으면 중단
                  break;
                }
              } catch {
                // 읽기 실패하면 중단
                break;
              }
            }
          }
        } catch {
          // 빈 디렉토리 삭제 실패해도 계속 진행
        }

        // Git 커밋
        setMessage('Git 커밋을 실행하는 중...');
        try {
          // git add
          await execa('git', ['add', problemDir], { cwd: projectRoot });

          // git commit
          const commitMessage = `solve: ${problemId} - ${problemTitle}`;
          await execa('git', ['commit', '-m', commitMessage], {
            cwd: projectRoot,
          });
        } catch (gitError) {
          // Git 연동 실패해도 경고만 표시하고 계속 진행
          console.warn(
            'Git 커밋 실패:',
            gitError instanceof Error ? gitError.message : String(gitError),
          );
        }

        setStatus('success');
        setMessage(`문제 ${problemId}를 아카이브했습니다: ${problemDir}`);

        setTimeout(() => {
          onComplete?.();
        }, 2000);
      } catch (err) {
        setStatus('error');
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
