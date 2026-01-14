import type { SolvedAcProblem, SolvedAcUser } from '../types/index';

const BASE_URL = 'https://solved.ac/api/v3';
const USER_AGENT = 'ps-cli/1.0.0';

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': USER_AGENT,
          ...options.headers,
        },
      });

      // Rate limit 처리
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : (attempt + 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, (attempt + 1) * 1000),
        );
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

export async function getProblem(problemId: number): Promise<SolvedAcProblem> {
  const url = `${BASE_URL}/problem/show?problemId=${problemId}`;
  const response = await fetchWithRetry(url);
  const data = await response.json();
  return data as SolvedAcProblem;
}

export async function getUserStats(handle: string): Promise<SolvedAcUser> {
  const url = `${BASE_URL}/user/show?handle=${handle}`;
  const response = await fetchWithRetry(url);
  const data = await response.json();
  return data as SolvedAcUser;
}

export async function getUserTop100(
  handle: string,
): Promise<SolvedAcProblem[]> {
  const url = `${BASE_URL}/user/top_100?handle=${handle}`;
  const response = await fetchWithRetry(url);
  const data = (await response.json()) as { items: SolvedAcProblem[] };
  return (data.items || []) as SolvedAcProblem[];
}
