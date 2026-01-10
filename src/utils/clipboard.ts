import { execa, execaCommand } from "execa";

/**
 * 플랫폼별로 소스 코드를 클립보드에 복사합니다.
 * @param text - 클립보드에 복사할 텍스트
 * @returns 성공 여부
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (process.platform === "win32") {
      // Windows: clip 명령어 사용
      await execaCommand("clip", {
        shell: true,
        input: text,
      });
    } else if (process.platform === "darwin") {
      // macOS: pbcopy 사용
      await execaCommand("pbcopy", {
        shell: false,
        input: text,
      });
    } else {
      // Linux: xclip 또는 xsel 사용
      // 먼저 xclip을 시도하고, 없으면 xsel 시도
      try {
        await execa("xclip", ["-selection", "clipboard"], {
          input: text,
        });
      } catch {
        try {
          await execa("xsel", ["--clipboard", "--input"], {
            input: text,
          });
        } catch {
          // 에러는 무시하고 false 반환 (경고만 표시)
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    // 에러는 무시하고 false 반환 (경고만 표시)
    return false;
  }
}
