import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import type {
  ScrapedProblem,
  TestCase,
  SearchResult,
  SearchResults,
} from '../types/index';

const BOJ_BASE_URL = 'https://www.acmicpc.net';
const SOLVED_AC_BASE_URL = 'https://solved.ac';

/**
 * HTML 요소를 Markdown으로 변환
 * superscript, subscript, 강조 등을 유지
 */
function htmlToMarkdown(
  $: cheerio.CheerioAPI,
  element: cheerio.Cheerio<Element>,
): string {
  if (element.length === 0) return '';

  let result = '';
  const contents = element.contents();

  // contents가 비어있으면 텍스트만 반환
  if (contents.length === 0) {
    return element.text().trim();
  }

  contents.each((_, node) => {
    if (node.type === 'text') {
      const text = node.data || '';
      if (text.trim()) {
        result += text;
      }
    } else if (node.type === 'tag') {
      const tagName = node.name.toLowerCase();
      const $node = $(node);

      switch (tagName) {
        case 'sup':
          result += `^${htmlToMarkdown($, $node)}`;
          break;
        case 'sub':
          result += `<sub>${htmlToMarkdown($, $node)}</sub>`;
          break;
        case 'strong':
        case 'b':
          result += `**${htmlToMarkdown($, $node)}**`;
          break;
        case 'em':
        case 'i':
          result += `*${htmlToMarkdown($, $node)}*`;
          break;
        case 'br':
          result += '\n';
          break;
        case 'p': {
          const pContent = htmlToMarkdown($, $node);
          if (pContent) {
            result += pContent + '\n\n';
          }
          break;
        }
        case 'div': {
          const divContent = htmlToMarkdown($, $node);
          if (divContent) {
            result += divContent + '\n\n';
          }
          break;
        }
        case 'span':
          result += htmlToMarkdown($, $node);
          break;
        case 'code':
          result += `\`${htmlToMarkdown($, $node)}\``;
          break;
        case 'pre': {
          const preContent = htmlToMarkdown($, $node);
          if (preContent) {
            result += `\n\`\`\`\n${preContent}\n\`\`\`\n\n`;
          }
          break;
        }
        case 'ul':
        case 'ol':
          $node.find('li').each((i, li) => {
            const liContent = htmlToMarkdown($, $(li));
            if (liContent) {
              result += `- ${liContent}\n`;
            }
          });
          result += '\n';
          break;
        case 'li':
          result += htmlToMarkdown($, $node);
          break;
        case 'img': {
          const imgSrc = $node.attr('src') || '';
          const imgAlt = $node.attr('alt') || '';
          if (imgSrc) {
            // 상대 경로를 절대 URL로 변환
            let imageUrl = imgSrc;
            if (imgSrc.startsWith('/')) {
              imageUrl = `${BOJ_BASE_URL}${imgSrc}`;
            } else if (
              !imgSrc.startsWith('http') &&
              !imgSrc.startsWith('data:')
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
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch problem page: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // 제목 추출
  const title = $('#problem_title').text().trim();

  // 문제 설명 추출 (HTML을 Markdown으로 변환)
  const descriptionEl = $('#problem_description');
  let description = '';
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
  const inputEl = $('#problem_input');
  let inputFormat = '';
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
  const outputEl = $('#problem_output');
  let outputFormat = '';
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
  const problemInfoTable = $('#problem-info');
  const tableInResponsive = $('.table-responsive table');

  const targetTable =
    problemInfoTable.length > 0 ? problemInfoTable : tableInResponsive;

  if (targetTable.length > 0) {
    // 테이블 구조: thead에 헤더(th), tbody에 데이터(td)
    const headerRow = targetTable.find('thead tr');
    const dataRow = targetTable.find('tbody tr');

    if (headerRow.length > 0 && dataRow.length > 0) {
      const headers = headerRow
        .find('th')
        .map((_, th) => $(th).text().trim())
        .get();
      const values = dataRow
        .find('td')
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
      targetTable.find('tr').each((_, row) => {
        const tds = $(row).find('td');
        if (tds.length >= 2) {
          const label = $(tds[0]).text().trim();
          const value = $(tds[1]).text().trim();
          problemInfo[label] = value;
        }
      });
    }
  }

  const timeLimit =
    problemInfo['시간 제한'] || problemInfo['Time Limit'] || undefined;
  const memoryLimit =
    problemInfo['메모리 제한'] || problemInfo['Memory Limit'] || undefined;
  const submissions = problemInfo['제출'] || problemInfo['Submit'] || undefined;
  const accepted = problemInfo['정답'] || problemInfo['Accepted'] || undefined;
  const acceptedUsers =
    problemInfo['맞힌 사람'] || problemInfo['Accepted Users'] || undefined;
  const acceptedRate =
    problemInfo['정답 비율'] || problemInfo['Accepted Rate'] || undefined;

  // 예제 입력/출력 추출
  const testCases: TestCase[] = [];
  const sampleInputs = $('.sampledata').filter((_, el) => {
    const id = $(el).attr('id');
    return id?.startsWith('sample-input-') ?? false;
  });

  sampleInputs.each((_, el) => {
    const inputId = $(el).attr('id');
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
    $('pre').each((_, el) => {
      const text = $(el).text().trim();
      const prevText = $(el).prev().text().toLowerCase();

      if (prevText.includes('입력') || prevText.includes('input')) {
        const nextPre = $(el).next('pre');
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

/**
 * solved.ac 검색 결과를 스크래핑합니다.
 * @param query - 검색 쿼리 (예: "*g1...g5", "#dp", "tier:g3 tag:dp")
 * @param page - 페이지 번호 (기본값: 1)
 * @returns 검색 결과 (문제 목록 및 페이지네이션 정보)
 */
export async function searchProblems(
  query: string,
  page: number = 1,
): Promise<SearchResults> {
  const url = `${SOLVED_AC_BASE_URL}/problems?query=${encodeURIComponent(query)}&page=${page}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch search results: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const problems: SearchResult[] = [];

  // 테이블에서 문제 목록 추출
  // DOM Path: tbody.c.-1d9xc1d > tr.c.-1ojb0xa
  const rows = $('tbody tr');

  rows.each((index, row) => {
    const $row = $(row);
    const cells = $row.find('td');

    // td가 2개 이상인지 확인 (헤더 행은 th를 사용할 수 있음)
    if (cells.length >= 2) {
      // 첫 번째 td: 문제 번호
      // 이미지나 다른 요소가 있을 수 있으므로 모든 텍스트를 가져온 후 숫자만 추출
      const firstCell = $(cells[0]);
      const firstCellText = firstCell.text().trim();

      // 숫자만 추출 (이미지 alt 텍스트나 다른 텍스트가 섞여있을 수 있음)
      // 첫 번째로 나타나는 숫자 시퀀스를 문제 번호로 사용
      // 4자리 이상의 숫자를 우선적으로 찾음 (문제 번호는 보통 4자리 이상)
      const problemIdMatches = firstCellText.match(/\d{4,}/g);
      let problemId: number;

      if (problemIdMatches && problemIdMatches.length > 0) {
        // 가장 긴 숫자 시퀀스를 문제 번호로 사용
        problemId = parseInt(problemIdMatches[0], 10);
      } else {
        // 4자리 이상이 없으면 첫 번째 숫자 시퀀스 사용
        const problemIdMatch = firstCellText.match(/\d+/);
        if (problemIdMatch) {
          problemId = parseInt(problemIdMatch[0], 10);
        } else {
          // 숫자가 없으면 전체 텍스트를 숫자로 변환 시도
          problemId = parseInt(firstCellText, 10);
        }
      }

      // 문제 번호가 유효하지 않으면 스킵 (헤더 행일 수 있음)
      if (isNaN(problemId) || problemId <= 0) {
        return;
      }

      // 두 번째 td: 제목
      // 링크가 있으면 링크의 텍스트만 사용, 없으면 전체 텍스트에서 불필요한 부분 제거
      const titleCell = $(cells[1]);

      // 먼저 링크에서 제목 추출 시도
      const linkElement = titleCell.find('a').first();
      let title = linkElement.length > 0 ? linkElement.text().trim() : '';

      // 링크가 없거나 빈 문자열이면 전체 텍스트 사용하되, 배지/스타일 정보 제거
      if (!title) {
        // 자식 요소(배지, 스타일 등)를 제거하고 순수 텍스트만 추출
        const clonedCell = titleCell.clone();
        // 배지나 스타일 관련 요소 제거 (span, div, 그리고 css-로 시작하는 클래스를 가진 요소)
        clonedCell.find('span, div').remove();
        clonedCell.find('[class*="css-"]').remove();
        title = clonedCell.text().trim();

        // "STANDARD", "CLASS", "NORMAL" 같은 배지 텍스트 제거
        title = title.replace(
          /\s+(STANDARD|CLASS|NORMAL|EASY|MEDIUM|HARD|EXPERT|MASTER|CLASSIC)\s*$/i,
          '',
        );
        // CSS 클래스명 같은 것들 제거 (예: .css-xxx 같은 패턴)
        title = title.replace(/\s*\.css-[a-z0-9-]+\s*/g, '');
        // 추가로 남은 공백 정리
        title = title.trim();
      }

      // 여전히 제목이 없으면 원본 텍스트에서 직접 추출 시도
      if (!title || title.length === 0) {
        title = titleCell.text().trim();
        // "STANDARD", "CLASS", "NORMAL" 같은 배지 텍스트 제거
        title = title.replace(
          /\s+(STANDARD|CLASS|NORMAL|EASY|MEDIUM|HARD|EXPERT|MASTER|CLASSIC)\s*$/i,
          '',
        );
        title = title.trim();
      }

      // 문제 번호가 유효하면 추가 (제목이 없어도 문제 번호만으로 추가 가능)
      // 단, 문제 번호가 0보다 커야 함
      if (!isNaN(problemId) && problemId > 0) {
        // 제목이 없으면 문제 번호를 제목으로 사용
        if (!title || title.length === 0) {
          title = `문제 ${problemId}`;
        }
        // 티어 레벨 추출
        // solved.ac에서는 첫 번째 셀의 img 태그 src에서 티어 레벨을 확인할 수 있음
        // 예: <img src="https://static.solved.ac/tier_small/13.svg" alt="Gold III" />
        let level: number | undefined;
        const firstCell = $(cells[0]);
        const tierImg = firstCell.find("img[src*='tier_small']");

        if (tierImg.length > 0) {
          const imgSrc = tierImg.attr('src');
          if (imgSrc) {
            // URL에서 티어 레벨 추출: tier_small/{level}.svg
            const match = imgSrc.match(/tier_small\/(\d+)\.svg/);
            if (match && match[1]) {
              const parsedLevel = parseInt(match[1], 10);
              if (
                !isNaN(parsedLevel) &&
                parsedLevel >= 0 &&
                parsedLevel <= 31
              ) {
                level = parsedLevel;
              }
            }
          }
        }

        // 세 번째 td: 푼 사람 수 (선택적)
        let solvedCount: number | undefined;
        if (cells.length >= 3) {
          const solvedCountText = $(cells[2]).text().trim();
          // 쉼표 제거 후 숫자로 변환
          const parsed = parseInt(solvedCountText.replace(/,/g, ''), 10);
          if (!isNaN(parsed)) {
            solvedCount = parsed;
          }
        }

        // 네 번째 td: 평균 시도 횟수 (선택적)
        let averageTries: number | undefined;
        if (cells.length >= 4) {
          const averageTriesText = $(cells[3]).text().trim();
          const parsed = parseFloat(averageTriesText);
          if (!isNaN(parsed)) {
            averageTries = parsed;
          }
        }

        problems.push({
          problemId,
          title,
          level,
          solvedCount,
          averageTries,
        });
      }
    }
  });

  // 페이지네이션 정보 추출
  // 총 페이지 수 찾기 (페이지네이션 버튼에서 마지막 페이지 번호 추출)
  let totalPages = 1;
  const paginationLinks = $('a[href*="page="]');
  const pageNumbers: number[] = [];

  paginationLinks.each((_, link) => {
    const href = $(link).attr('href');
    if (href) {
      const match = href.match(/page=(\d+)/);
      if (match) {
        const pageNum = parseInt(match[1], 10);
        if (!isNaN(pageNum)) {
          pageNumbers.push(pageNum);
        }
      }
    }
  });

  if (pageNumbers.length > 0) {
    totalPages = Math.max(...pageNumbers);
  } else {
    // 페이지네이션 링크가 없으면 결과가 있으면 1페이지, 없으면 0페이지
    totalPages = problems.length > 0 ? 1 : 0;
  }

  return {
    problems,
    currentPage: page,
    totalPages,
  };
}
