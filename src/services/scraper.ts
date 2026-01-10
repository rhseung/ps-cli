import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import type { ScrapedProblem, TestCase } from "../types/index";

const BOJ_BASE_URL = "https://www.acmicpc.net";

/**
 * HTML 요소를 Markdown으로 변환
 * superscript, subscript, 강조 등을 유지
 */
function htmlToMarkdown(
  $: cheerio.CheerioAPI,
  element: cheerio.Cheerio<Element>,
): string {
  if (element.length === 0) return "";

  let result = "";
  const contents = element.contents();

  // contents가 비어있으면 텍스트만 반환
  if (contents.length === 0) {
    return element.text().trim();
  }

  contents.each((_, node) => {
    if (node.type === "text") {
      const text = node.data || "";
      if (text.trim()) {
        result += text;
      }
    } else if (node.type === "tag") {
      const tagName = node.name.toLowerCase();
      const $node = $(node);

      switch (tagName) {
        case "sup":
          result += `^${htmlToMarkdown($, $node)}`;
          break;
        case "sub":
          result += `<sub>${htmlToMarkdown($, $node)}</sub>`;
          break;
        case "strong":
        case "b":
          result += `**${htmlToMarkdown($, $node)}**`;
          break;
        case "em":
        case "i":
          result += `*${htmlToMarkdown($, $node)}*`;
          break;
        case "br":
          result += "\n";
          break;
        case "p": {
          const pContent = htmlToMarkdown($, $node);
          if (pContent) {
            result += pContent + "\n\n";
          }
          break;
        }
        case "div": {
          const divContent = htmlToMarkdown($, $node);
          if (divContent) {
            result += divContent + "\n";
          }
          break;
        }
        case "span":
          result += htmlToMarkdown($, $node);
          break;
        case "code":
          result += `\`${htmlToMarkdown($, $node)}\``;
          break;
        case "pre": {
          const preContent = htmlToMarkdown($, $node);
          if (preContent) {
            result += `\n\`\`\`\n${preContent}\n\`\`\`\n`;
          }
          break;
        }
        case "ul":
        case "ol":
          $node.find("li").each((i, li) => {
            const liContent = htmlToMarkdown($, $(li));
            if (liContent) {
              result += `- ${liContent}\n`;
            }
          });
          break;
        case "li":
          result += htmlToMarkdown($, $node);
          break;
        case "img": {
          const imgSrc = $node.attr("src") || "";
          const imgAlt = $node.attr("alt") || "";
          if (imgSrc) {
            // 상대 경로를 절대 URL로 변환
            let imageUrl = imgSrc;
            if (imgSrc.startsWith("/")) {
              imageUrl = `${BOJ_BASE_URL}${imgSrc}`;
            } else if (
              !imgSrc.startsWith("http") &&
              !imgSrc.startsWith("data:")
            ) {
              // 상대 경로인 경우
              imageUrl = `${BOJ_BASE_URL}/${imgSrc}`;
            }
            result += `![${imgAlt}](${imageUrl})`;
          }
          break;
        }
        default:
          result += htmlToMarkdown($, $node);
      }
    }
  });

  return result.trim();
}

export async function scrapeProblem(
  problemId: number,
): Promise<ScrapedProblem> {
  const url = `${BOJ_BASE_URL}/problem/${problemId}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch problem page: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // 제목 추출
  const title = $("#problem_title").text().trim();

  // 문제 설명 추출 (HTML을 Markdown으로 변환)
  const descriptionEl = $("#problem_description");
  let description = "";
  if (descriptionEl.length > 0) {
    description = htmlToMarkdown($, descriptionEl).trim();
    // htmlToMarkdown이 빈 문자열을 반환하면 텍스트로 fallback
    if (!description) {
      description = descriptionEl.text().trim();
    }
  } else {
    // 대체 선택자 시도
    const altDesc = $('[id*="description"]').first();
    if (altDesc.length > 0) {
      description = altDesc.text().trim();
    }
  }

  // 입력 형식 추출 (HTML을 Markdown으로 변환)
  const inputEl = $("#problem_input");
  let inputFormat = "";
  if (inputEl.length > 0) {
    inputFormat = htmlToMarkdown($, inputEl).trim();
    // htmlToMarkdown이 빈 문자열을 반환하면 텍스트로 fallback
    if (!inputFormat) {
      inputFormat = inputEl.text().trim();
    }
  } else {
    // 대체 선택자 시도
    const altInput = $('[id*="input"]').first();
    if (altInput.length > 0) {
      inputFormat = altInput.text().trim();
    }
  }

  // 출력 형식 추출 (HTML을 Markdown으로 변환)
  const outputEl = $("#problem_output");
  let outputFormat = "";
  if (outputEl.length > 0) {
    outputFormat = htmlToMarkdown($, outputEl).trim();
    // htmlToMarkdown이 빈 문자열을 반환하면 텍스트로 fallback
    if (!outputFormat) {
      outputFormat = outputEl.text().trim();
    }
  } else {
    // 대체 선택자 시도
    const altOutput = $('[id*="output"]').first();
    if (altOutput.length > 0) {
      outputFormat = altOutput.text().trim();
    }
  }

  // 문제 정보 테이블에서 데이터 추출
  const problemInfo: Record<string, string> = {};

  // table#problem-info 또는 .table-responsive 안의 table 찾기
  const problemInfoTable = $("#problem-info");
  const tableInResponsive = $(".table-responsive table");

  const targetTable =
    problemInfoTable.length > 0 ? problemInfoTable : tableInResponsive;

  if (targetTable.length > 0) {
    // 테이블 구조: thead에 헤더(th), tbody에 데이터(td)
    const headerRow = targetTable.find("thead tr");
    const dataRow = targetTable.find("tbody tr");

    if (headerRow.length > 0 && dataRow.length > 0) {
      const headers = headerRow
        .find("th")
        .map((_, th) => $(th).text().trim())
        .get();
      const values = dataRow
        .find("td")
        .map((_, td) => $(td).text().trim())
        .get();

      // 헤더와 값을 매칭
      headers.forEach((header, index) => {
        if (values[index]) {
          problemInfo[header] = values[index];
        }
      });
    } else {
      // 대체 방법: 각 행이 하나의 정보를 담고 있는 경우
      targetTable.find("tr").each((_, row) => {
        const tds = $(row).find("td");
        if (tds.length >= 2) {
          const label = $(tds[0]).text().trim();
          const value = $(tds[1]).text().trim();
          problemInfo[label] = value;
        }
      });
    }
  }

  const timeLimit =
    problemInfo["시간 제한"] || problemInfo["Time Limit"] || undefined;
  const memoryLimit =
    problemInfo["메모리 제한"] || problemInfo["Memory Limit"] || undefined;
  const submissions = problemInfo["제출"] || problemInfo["Submit"] || undefined;
  const accepted = problemInfo["정답"] || problemInfo["Accepted"] || undefined;
  const acceptedUsers =
    problemInfo["맞힌 사람"] || problemInfo["Accepted Users"] || undefined;
  const acceptedRate =
    problemInfo["정답 비율"] || problemInfo["Accepted Rate"] || undefined;

  // 예제 입력/출력 추출
  const testCases: TestCase[] = [];
  const sampleInputs = $(".sampledata").filter((_, el) => {
    const id = $(el).attr("id");
    return id?.startsWith("sample-input-") ?? false;
  });

  sampleInputs.each((_, el) => {
    const inputId = $(el).attr("id");
    if (!inputId) return;

    const match = inputId.match(/sample-input-(\d+)/);
    if (!match) return;

    const sampleNumber = match[1];
    const outputId = `sample-output-${sampleNumber}`;
    const outputEl = $(`#${outputId}`);

    if (outputEl.length > 0) {
      testCases.push({
        input: $(el).text(),
        output: outputEl.text(),
      });
    }
  });

  // 예제가 없으면 빈 배열 반환
  if (testCases.length === 0) {
    // 대체 방법: pre 태그에서 찾기
    $("pre").each((_, el) => {
      const text = $(el).text().trim();
      const prevText = $(el).prev().text().toLowerCase();

      if (prevText.includes("입력") || prevText.includes("input")) {
        const nextPre = $(el).next("pre");
        if (nextPre.length > 0) {
          testCases.push({
            input: text,
            output: nextPre.text().trim(),
          });
        }
      }
    });
  }

  // 필수 데이터 검증
  if (!title) {
    throw new Error(
      `문제 ${problemId}의 제목을 찾을 수 없습니다. BOJ 페이지 구조가 변경되었거나 문제가 존재하지 않을 수 있습니다.`,
    );
  }

  if (!description && !inputFormat && !outputFormat) {
    throw new Error(
      `문제 ${problemId}의 내용을 가져올 수 없습니다. BOJ 페이지 구조가 변경되었거나 API 제한에 걸렸을 수 있습니다. 잠시 후 다시 시도해주세요.`,
    );
  }

  return {
    title,
    description,
    inputFormat,
    outputFormat,
    testCases,
    timeLimit,
    memoryLimit,
    submissions,
    accepted,
    acceptedUsers,
    acceptedRate,
  };
}
