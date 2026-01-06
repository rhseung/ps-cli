import React, { useState, useEffect } from "react";
import { render, Text, Box } from "ink";
import { mkdir, access, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { LoadingSpinner } from "../components/spinner";
import type { CommandDefinition } from "../types/command";
import { getProblemDir } from "../utils/config";

interface InitCommandProps {
  onComplete: () => void;
}

function InitCommand({ onComplete }: InitCommandProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("프로젝트를 초기화하는 중...");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const cwd = process.cwd();
        const problemDir = getProblemDir();

        // problemDir가 "." 또는 ""인 경우 디렉토리 생성 스킵
        if (problemDir !== "." && problemDir !== "") {
          const problemDirPath = join(cwd, problemDir);
          setMessage(`${problemDir} 디렉토리를 생성하는 중...`);
          try {
            await mkdir(problemDirPath, { recursive: true });
            setCreated((prev) => [...prev, `${problemDir}/`]);
          } catch (err) {
            // 이미 존재하는 경우 무시
            const error = err as NodeJS.ErrnoException;
            if (error.code !== "EEXIST") {
              throw err;
            }
          }

          // .gitignore에 problemDir 추가 (이미 있으면 스킵)
          setMessage(".gitignore를 업데이트하는 중...");
          const gitignorePath = join(cwd, ".gitignore");
          const gitignorePattern = `${problemDir}/`;
          try {
            const gitignoreContent = await readFile(gitignorePath, "utf-8");
            if (!gitignoreContent.includes(gitignorePattern)) {
              const updatedContent =
                gitignoreContent.trim() +
                (gitignoreContent.trim() ? "\n" : "") +
                `\n# ps-cli 문제 디렉토리\n${gitignorePattern}\n`;
              await writeFile(gitignorePath, updatedContent, "utf-8");
              setCreated((prev) => [...prev, ".gitignore 업데이트"]);
            }
          } catch (err) {
            const error = err as NodeJS.ErrnoException;
            if (error.code === "ENOENT") {
              // .gitignore가 없으면 생성
              await writeFile(
                gitignorePath,
                `# ps-cli 문제 디렉토리\n${gitignorePattern}\n`,
                "utf-8"
              );
              setCreated((prev) => [...prev, ".gitignore 생성"]);
            } else {
              // 읽기 실패는 무시 (권한 문제 등)
              console.warn(".gitignore 업데이트 실패:", error.message);
            }
          }
        } else {
          setMessage("프로젝트 루트에 문제를 저장하도록 설정되어 있습니다.");
        }

        setStatus("success");
        setMessage("프로젝트 초기화가 완료되었습니다!");
        setTimeout(() => {
          onComplete();
        }, 2000);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    }

    init();
  }, [onComplete]);

  if (status === "loading") {
    return (
      <Box flexDirection="column">
        <LoadingSpinner message={message} />
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ 초기화 실패: {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="green">✓ 프로젝트 초기화 완료</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color="gray">생성된 항목:</Text>
        {created.map((item, idx) => (
          <Text key={idx} color="cyan">
            • {item}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color="gray">
          이제 <Text bold>ps fetch &lt;문제번호&gt;</Text> 명령어를 사용할 수
          있습니다.
        </Text>
      </Box>
    </Box>
  );
}

async function initCommand() {
  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <InitCommand
        onComplete={() => {
          unmount();
          resolve();
        }}
      />
    );
  });
}

export const initHelp = `
  사용법:
    $ ps init

  설명:
    현재 디렉토리를 ps-cli 프로젝트로 초기화합니다.
    - config의 problem-dir 설정에 따라 디렉토리 생성
    - .gitignore에 문제 디렉토리 추가 (이미 있으면 스킵)
    - problem-dir이 "." 또는 ""인 경우 디렉토리 생성 스킵

  예제:
    $ ps init
`;

export async function initExecute(
  args: string[],
  flags: { help?: boolean }
): Promise<void> {
  if (flags.help) {
    console.log(initHelp.trim());
    process.exit(0);
    return;
  }

  await initCommand();
}

const initCommandDef: CommandDefinition = {
  name: "init",
  help: initHelp,
  execute: initExecute,
};

export default initCommandDef;
