import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * package.json에서 버전을 가져옵니다.
 * @returns 버전 문자열 (실패 시 빈 문자열)
 */
export function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // dist에서 실행되는 경우와 src에서 실행되는 경우 모두 고려
    // dist/utils/version.js -> ../../package.json
    // src/utils/version.ts -> ../../package.json
    const packageJsonPath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      version: string;
    };
    return packageJson.version;
  } catch {
    // 실패 시 빈 문자열 반환
    return '';
  }
}
