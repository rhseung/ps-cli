import { execaCommand } from 'execa';

/**
 * 플랫폼별로 브라우저를 열어 URL을 엽니다.
 * @param url - 열 URL
 * @throws 브라우저를 열 수 없는 경우 에러 발생
 */
export async function openBrowser(url: string): Promise<void> {
  let command: string;

  if (process.platform === 'win32') {
    command = `start "" "${url}"`;
  } else if (process.platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    // Linux 및 기타 Unix 계열
    command = `xdg-open "${url}"`;
  }

  await execaCommand(command, {
    shell: true,
    detached: true,
    stdio: 'ignore',
  });
}
