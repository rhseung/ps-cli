import { execaCommand } from 'execa';

import { getEditor } from '../core/config';

/**
 * 설정된 에디터로 파일 또는 디렉토리를 엽니다.
 * @param path - 열 파일 또는 디렉토리 경로
 * @throws 에디터를 열 수 없는 경우 에러 발생
 */
export async function openEditor(path: string): Promise<void> {
  const editor = getEditor();

  await execaCommand(`${editor} ${path}`, {
    shell: true,
    detached: true,
    stdio: 'ignore',
  });
}
