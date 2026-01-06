import meow from "meow";
import { fetchCommand } from "./commands/fetch";
import type { Language } from "./utils/language";

const cli = meow(
  `
  사용법:
    $ ps fetch <문제번호> [옵션]

  명령어:
    fetch <문제번호>    문제를 가져와서 로컬에 파일 생성

  옵션:
    --language, -l      언어 선택 (python, javascript, typescript, cpp)
                        기본값: python

  예제:
    $ ps fetch 1000
    $ ps fetch 1000 --language python
    $ ps fetch 1000 -l cpp
`,
  {
    importMeta: import.meta,
    flags: {
      language: {
        type: "string",
        shortFlag: "l",
        default: "python",
      },
    },
  }
);

const [command, ...args] = cli.input;

async function main() {
  if (command === "fetch") {
    const problemId = parseInt(args[0], 10);

    if (isNaN(problemId)) {
      console.error("오류: 문제 번호를 입력해주세요.");
      process.exit(1);
    }

    const language = cli.flags.language as Language;
    const validLanguages: Language[] = [
      "python",
      "javascript",
      "typescript",
      "cpp",
    ];

    if (!validLanguages.includes(language)) {
      console.error(
        `오류: 지원하지 않는 언어입니다. (${validLanguages.join(", ")})`
      );
      process.exit(1);
    }

    await fetchCommand(problemId, language);
  } else if (!command) {
    cli.showHelp();
  } else {
    console.error(`오류: 알 수 없는 명령어: ${command}`);
    console.error("사용 가능한 명령어: fetch");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("오류:", error.message);
  process.exit(1);
});
