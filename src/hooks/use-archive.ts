import { access, readFile, rename, mkdir, readdir, rmdir } from 'fs/promises';
import { join, dirname } from 'path';

import { execa } from 'execa';
import { useEffect, useState } from 'react';

import {
  findProjectRoot,
  getSolvingDir,
  getArchiveAutoCommit,
  getArchiveCommitMessage,
} from '../core/config';
import { getSolvingDirPath, getArchiveDirPath } from '../core/problem';
import type { Problem } from '../types/index';

export interface UseArchiveParams {
  problemId: number;
  onComplete?: () => void;
}

export interface UseArchiveReturn {
  status: 'loading' | 'success' | 'error';
  message: string;
  error: string | null;
}

export function useArchive({
  problemId,
  onComplete,
}: UseArchiveParams): UseArchiveReturn {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('문제를 아카이브하는 중...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function archive() {
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

        // archive 디렉토리 경로 (문제 정보 전달)
        const archiveDir = getArchiveDirPath(problemId, projectRoot, problem);

        // archive 디렉토리에 이미 같은 문제가 있는지 확인
        try {
          await access(archiveDir);
          throw new Error(
            `archive 디렉토리에 이미 문제 ${problemId}가 존재합니다.`,
          );
        } catch (err) {
          // access 실패는 정상 (파일이 없음)
          if (err instanceof Error && err.message.includes('이미')) {
            throw err;
          }
        }

        // 아카이브 시 Git 자동 커밋 여부 및 커밋 메시지 템플릿 결정
        const autoCommit = getArchiveAutoCommit();
        const template = getArchiveCommitMessage() ?? 'solve: {id} - {title}';
        const commitMessage = template
          .replace('{id}', String(problemId))
          .replace('{title}', problemTitle);

        // 타겟 디렉토리의 부모 디렉토리 생성 (아카이빙 전략에 따라 필요)
        const archiveDirParent = dirname(archiveDir);
        setMessage('아카이브 디렉토리를 준비하는 중...');
        await mkdir(archiveDirParent, { recursive: true });

        // 1. 먼저 디렉토리 이동 (Git add가 ignore되지 않도록)
        setMessage('문제를 archive 디렉토리로 이동하는 중...');
        await rename(solvingDir, archiveDir);

        // 2. autoCommit이 true인 경우 Git 커밋 시도
        if (autoCommit) {
          try {
            setMessage('Git 커밋을 실행하는 중...');
            await execa('git', ['add', archiveDir], { cwd: projectRoot });
            await execa('git', ['commit', '-m', commitMessage], {
              cwd: projectRoot,
            });
          } catch (gitError) {
            // 커밋 실패 시 원래 위치로 롤백
            setMessage('커밋 실패로 인해 롤백하는 중...');
            try {
              await rename(archiveDir, solvingDir);
            } catch (rollbackError) {
              throw new Error(
                `Git 커밋 실패 및 롤백 실패: ${gitError instanceof Error ? gitError.message : String(gitError)}. 롤백 에러: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}. 수동으로 파일을 확인해주세요.`,
              );
            }
            throw gitError;
          }
        }

        // 3. 모든 작업(커밋 포함)이 성공한 경우에만 빈 부모 디렉토리 삭제
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

        setStatus('success');
        setMessage(`문제 ${problemId}를 아카이브했습니다: ${archiveDir}`);

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

    void archive();
  }, [problemId, onComplete]);

  return {
    status,
    message,
    error,
  };
}
