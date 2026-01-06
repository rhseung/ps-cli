import * as cheerio from "cheerio";
import { getBojSessionCookie, getCodeOpen } from "../utils/config";
import { getLanguageConfig, type Language } from "../utils/language";
import type { SubmitResult, SubmitStatus } from "../types";

const BOJ_BASE_URL = "https://www.acmicpc.net";

interface SubmitSolutionParams {
  problemId: number;
  language: Language;
  sourceCode: string;
  dryRun?: boolean;
}

/**
 * BOJ 제출 결과를 폴링하여 최종 상태를 가져옵니다.
 */
async function pollSubmitResult(
  problemId: number,
  submitId: number,
  sessionCookie: string
): Promise<SubmitResult> {
  const maxAttempts = 60; // 최대 60번 시도 (약 2분)
  const pollInterval = 2000; // 2초마다 폴링

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    try {
      const response = await fetch(
        `${BOJ_BASE_URL}/status?from_mine=1&problem_id=${problemId}`,
        {
          headers: {
            Cookie: sessionCookie,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );

      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // 제출 목록에서 해당 제출 ID 찾기
      let targetRow: cheerio.Cheerio<any> | null = null;
      $("table#status-table tbody tr").each((_, element) => {
        const row = $(element);
        const rowSubmitId = parseInt(
          row.find("td:first-child").text().trim(),
          10
        );
        if (rowSubmitId === submitId) {
          targetRow = row;
          return false; // break
        }
      });

      // 제출 ID를 찾지 못한 경우, 첫 번째 항목 사용 (가장 최근 제출)
      if (!targetRow) {
        targetRow = $("table#status-table tbody tr").first();
      }

      if (!targetRow || targetRow.length === 0) {
        continue;
      }

      const statusText = targetRow.find("td.result").text().trim();
      const status = parseSubmitStatus(statusText);

      // 최종 상태인지 확인 (WAITING, JUDGING이 아닌 경우)
      if (status !== "WAITING" && status !== "JUDGING") {
        const timeText = targetRow.find("td.time").text().trim();
        const memoryText = targetRow.find("td.memory").text().trim();
        const languageText = targetRow.find("td.language").text().trim();

        const time = parseTime(timeText);
        const memory = parseMemory(memoryText);

        return {
          problemId,
          submitId: parseInt(
            targetRow.find("td:first-child").text().trim(),
            10
          ),
          status,
          time,
          memory,
          submittedAt: new Date(),
          language: languageText,
        };
      }
    } catch (error) {
      // 폴링 중 에러는 무시하고 계속 시도
      continue;
    }
  }

  // 타임아웃
  throw new Error(
    "제출 결과 확인 시간이 초과되었습니다. BOJ 웹사이트에서 직접 확인해주세요."
  );
}

/**
 * 제출 상태 텍스트를 SubmitStatus로 파싱합니다.
 */
function parseSubmitStatus(statusText: string): SubmitStatus {
  const upper = statusText.toUpperCase();
  if (upper.includes("ACCEPTED") || upper.includes("맞았습니다")) {
    return "AC";
  }
  if (upper.includes("WRONG ANSWER") || upper.includes("틀렸습니다")) {
    return "WA";
  }
  if (upper.includes("TIME LIMIT") || upper.includes("시간 초과")) {
    return "TLE";
  }
  if (upper.includes("MEMORY LIMIT") || upper.includes("메모리 초과")) {
    return "MLE";
  }
  if (upper.includes("RUNTIME ERROR") || upper.includes("런타임 에러")) {
    return "RE";
  }
  if (upper.includes("COMPILE ERROR") || upper.includes("컴파일 에러")) {
    return "CE";
  }
  if (upper.includes("OUTPUT LIMIT") || upper.includes("출력 초과")) {
    return "OLE";
  }
  if (upper.includes("PRESENTATION ERROR") || upper.includes("출력 형식")) {
    return "PE";
  }
  if (upper.includes("WAITING") || upper.includes("기다리는 중")) {
    return "WAITING";
  }
  if (upper.includes("JUDGING") || upper.includes("채점 중")) {
    return "JUDGING";
  }
  return "WAITING";
}

/**
 * 시간 텍스트를 밀리초로 파싱합니다.
 */
function parseTime(timeText: string): number | null {
  const match = timeText.match(/(\d+)\s*ms/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * 메모리 텍스트를 KB로 파싱합니다.
 */
function parseMemory(memoryText: string): number | null {
  const match = memoryText.match(/(\d+)\s*KB/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * BOJ 제출 페이지에서 CSRF 토큰을 가져옵니다.
 */
async function getCsrfToken(
  problemId: number,
  sessionCookie: string
): Promise<string> {
  const response = await fetch(`${BOJ_BASE_URL}/submit/${problemId}`, {
    headers: {
      Cookie: sessionCookie,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(
      `제출 페이지를 불러올 수 없습니다. (HTTP ${response.status})`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // CSRF 토큰 찾기 - 여러 위치 시도
  let csrfToken: string | undefined;

  // 1. hidden input 필드에서 찾기
  csrfToken =
    $('input[name="csrf_key"]').val()?.toString() ||
    $('input[name="_csrf"]').val()?.toString() ||
    $('input[name="csrf"]').val()?.toString() ||
    $('input[type="hidden"][name*="csrf"]').val()?.toString();

  // 2. meta 태그에서 찾기
  if (!csrfToken) {
    csrfToken =
      $('meta[name="csrf-token"]').attr("content") ||
      $('meta[name="_csrf"]').attr("content") ||
      $('meta[name="csrf"]').attr("content");
  }

  // 3. JavaScript 변수에서 찾기 (예: window.csrfKey 등)
  if (!csrfToken) {
    const scriptTags = $("script").toArray();
    for (const script of scriptTags) {
      const scriptContent = $(script).html() || "";
      // csrf_key나 csrf 관련 변수 찾기
      const match =
        scriptContent.match(/csrf[_-]?key["\s:=]+["']([^"']+)["']/) ||
        scriptContent.match(/csrf[_-]?token["\s:=]+["']([^"']+)["']/) ||
        scriptContent.match(/window\.csrf[_-]?key\s*=\s*["']([^"']+)["']/);
      if (match && match[1]) {
        csrfToken = match[1];
        break;
      }
    }
  }

  // 4. 폼의 action URL에서 찾기
  if (!csrfToken) {
    const formAction = $('form[action*="submit"]').attr("action");
    if (formAction) {
      const match = formAction.match(/csrf[_-]?key=([^&]+)/);
      if (match && match[1]) {
        csrfToken = decodeURIComponent(match[1]);
      }
    }
  }

  if (!csrfToken) {
    // 디버깅을 위해 HTML 일부를 출력 (개발 모드에서만)
    const formHtml = $("form").html()?.substring(0, 500) || "";
    throw new Error(
      "CSRF 토큰을 찾을 수 없습니다. BOJ 페이지 구조가 변경되었을 수 있습니다.\n" +
        "다음 위치들을 확인했습니다:\n" +
        "- input[name='csrf_key'], input[name='_csrf'], input[name='csrf']\n" +
        "- meta[name='csrf-token'], meta[name='_csrf']\n" +
        "- JavaScript 변수 (csrf_key, csrf_token)\n" +
        "- 폼 action URL\n\n" +
        "제출 페이지 HTML 구조를 확인해주세요."
    );
  }

  return String(csrfToken);
}

/**
 * BOJ에 코드를 제출합니다.
 */
export async function submitSolution({
  problemId,
  language,
  sourceCode,
  dryRun = false,
}: SubmitSolutionParams): Promise<SubmitResult> {
  // 드라이런 모드
  if (dryRun) {
    const langConfig = getLanguageConfig(language);
    if (!langConfig.bojLangId) {
      throw new Error(
        `언어 ${language}에 대한 BOJ 언어 ID가 설정되지 않았습니다.`
      );
    }

    return {
      problemId,
      status: "WAITING",
      language,
      message: `[DRY RUN] 문제 ${problemId}, 언어: ${language} (BOJ ID: ${langConfig.bojLangId}), 코드 길이: ${sourceCode.length}자`,
    };
  }

  // 세션 쿠키 확인
  const sessionCookie = getBojSessionCookie();
  if (!sessionCookie) {
    throw new Error(
      "BOJ 세션 쿠키가 설정되지 않았습니다.\n\n" +
        "📋 쿠키 복사 방법:\n" +
        "1. 브라우저에서 https://www.acmicpc.net 에 로그인\n" +
        "2. 개발자 도구(F12) 열기\n" +
        "3. 방법 A - Network 탭 사용 (추천):\n" +
        "   - Network 탭 열기 → 페이지 새로고침(F5)\n" +
        "   - 아무 요청 클릭 → Headers 탭\n" +
        "   - Request Headers 섹션에서 'Cookie:' 값을 복사\n" +
        "   (전체 Cookie 헤더 값 복사, 예: 'OnlineJudge=xxx; __ga=yyy; ...')\n\n" +
        "4. 방법 B - Application 탭 사용:\n" +
        "   - Application/저장소 탭 → Cookies → https://www.acmicpc.net\n" +
        "   - 'OnlineJudge' 쿠키의 Name과 Value를 복사\n" +
        "   - 형식: 'OnlineJudge=값'\n\n" +
        "💡 팁: Network 탭에서 복사하는 것이 가장 정확합니다!\n\n" +
        "⚙️ 설정 방법:\n" +
        "  export PS_CLI_BOJ_COOKIE='복사한_쿠키_값'\n\n" +
        "예시:\n" +
        "  export PS_CLI_BOJ_COOKIE='OnlineJudge=abc123; __ga=xyz789; ...'"
    );
  }

  const langConfig = getLanguageConfig(language);
  if (!langConfig.bojLangId) {
    throw new Error(
      `언어 ${language}에 대한 BOJ 언어 ID가 설정되지 않았습니다.`
    );
  }

  // CSRF 토큰 가져오기 (없을 수도 있음)
  let csrfToken: string | undefined;
  try {
    csrfToken = await getCsrfToken(problemId, sessionCookie);
  } catch (error) {
    // CSRF 토큰을 찾지 못해도 제출을 시도 (일부 사이트는 CSRF 토큰이 없을 수 있음)
    console.warn("CSRF 토큰을 찾지 못했습니다. 제출을 계속 시도합니다...");
    csrfToken = undefined;
  }

  // 제출 폼 데이터 구성
  const codeOpen = getCodeOpen() ? "open" : "close";
  const formData = new URLSearchParams();
  formData.append("problem_id", String(problemId));
  formData.append("language", String(langConfig.bojLangId));
  formData.append("code_open", codeOpen);
  formData.append("source", sourceCode);

  // CSRF 토큰이 있으면 추가 (없어도 제출이 가능할 수 있음)
  if (csrfToken) {
    formData.append("csrf_key", csrfToken);
  }

  // 제출 요청
  const submitResponse = await fetch(`${BOJ_BASE_URL}/submit/${problemId}`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: `${BOJ_BASE_URL}/submit/${problemId}`,
    },
    body: formData.toString(),
    redirect: "manual", // 리다이렉트를 수동으로 처리
  });

  // 응답 본문 확인 (에러 메시지가 있을 수 있음)
  const responseText = await submitResponse.text();
  const $response = cheerio.load(responseText);

  // 에러 메시지 확인
  const errorMessage = $response(".alert-danger, .error, .warning")
    .text()
    .trim();

  if (!submitResponse.ok) {
    if (submitResponse.status === 401 || submitResponse.status === 403) {
      throw new Error(
        "로그인이 필요하거나 세션이 만료되었습니다. 쿠키를 다시 설정해주세요."
      );
    }
    const error =
      errorMessage ||
      `HTTP ${submitResponse.status} ${submitResponse.statusText}`;
    throw new Error(`제출 실패: ${error}`);
  }

  // 제출 ID 추출 (리다이렉트 URL에서)
  const location = submitResponse.headers.get("location");
  let submitId: number | undefined;

  if (location) {
    const match = location.match(/\/status\/(\d+)/);
    if (match) {
      submitId = parseInt(match[1], 10);
    }
  }

  // 리다이렉트가 없거나 제출 ID를 찾지 못한 경우, 응답 본문에서 확인
  if (!submitId) {
    // 응답 본문에 에러가 있는지 확인
    if (errorMessage) {
      throw new Error(`제출 실패: ${errorMessage}`);
    }

    // 상태 페이지에서 최근 제출 찾기 시도
    const statusResponse = await fetch(
      `${BOJ_BASE_URL}/status?from_mine=1&problem_id=${problemId}`,
      {
        headers: {
          Cookie: sessionCookie,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (statusResponse.ok) {
      const html = await statusResponse.text();
      const $ = cheerio.load(html);
      const firstRow = $("table#status-table tbody tr").first();
      if (firstRow.length > 0) {
        const idText = firstRow.find("td:first-child").text().trim();
        submitId = parseInt(idText, 10);
      }
    }
  }

  // 제출 ID를 찾지 못하면 실패로 처리
  if (!submitId) {
    throw new Error(
      "제출에 실패했습니다. 제출 ID를 확인할 수 없습니다.\n" +
        "가능한 원인:\n" +
        "- CSRF 토큰이 필요할 수 있습니다\n" +
        "- 로그인 세션이 만료되었을 수 있습니다\n" +
        "- BOJ 페이지 구조가 변경되었을 수 있습니다\n\n" +
        "브라우저에서 직접 제출해보시고, 문제가 계속되면 이슈를 등록해주세요."
    );
  }

  // 결과 폴링
  const result = await pollSubmitResult(problemId, submitId, sessionCookie);
  return {
    ...result,
    problemId,
    submitId,
  };
}
