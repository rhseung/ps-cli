import { logger } from './logger';

export const MAX_RETRIES = 3;
export const RETRY_DELAY = 1000; // 1 second

export const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 백준 사이트의 봇 방지 시스템이나 네트워크 오류에 대응하기 위해
 * 재시도 로직이 포함된 fetch 함수입니다.
 */
export async function fetchWithRetry(
  url: string,
  context: string,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: DEFAULT_HEADERS,
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          throw new Error(
            `백준 사이트 접근이 거부되었습니다 (HTTP ${response.status}). 잠시 후 다시 시도해주세요.`,
          );
        }
        throw new Error(
          `페이지를 가져오지 못했습니다: HTTP ${response.status}`,
        );
      }

      const html = await response.text();

      if (!html || html.trim().length === 0) {
        throw new Error('응답 본문이 비어있습니다.');
      }

      if (html.includes('Access Denied') || html.includes('CAPTCHA')) {
        throw new Error(
          '백준의 봇 방지 시스템에 의해 접근이 차단되었습니다. 브라우저에서 직접 접속하여 확인이 필요할 수 있습니다.',
        );
      }

      return html;
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
        logger.warn(
          `${context} 데이터를 가져오는 데 실패했습니다 (${attempt}/${MAX_RETRIES}). ${delay}ms 후 재시도합니다...`,
        );
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error(`${context} 데이터를 가져올 수 없습니다.`);
}
