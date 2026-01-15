import * as cheerio from 'cheerio';

import type { Workbook, WorkbookProblem } from '../types/workbook';
import { fetchWithRetry } from '../utils/http';

const BOJ_BASE_URL = 'https://www.acmicpc.net';

/**
 * 백준 문제집 페이지에서 문제 목록을 스크래핑합니다.
 * @param workbookId - 문제집 ID
 * @returns 문제집 정보 (제목, 문제 목록)
 */
export async function scrapeWorkbook(workbookId: number): Promise<Workbook> {
  const url = `${BOJ_BASE_URL}/workbook/view/${workbookId}`;
  const html = await fetchWithRetry(url, `문제집 ${workbookId}`);

  const $ = cheerio.load(html);

  // 문제집 제목 추출
  // 일반적으로 h1 태그나 페이지 제목에서 찾을 수 있음
  let title = '';
  const titleElement = $('h1').first();
  if (titleElement.length > 0) {
    title = titleElement.text().trim();
  } else {
    // 대체 방법: 페이지 제목에서 추출
    const pageTitle = $('title').text().trim();
    // "문제집: [제목]" 형식일 수 있음
    const match = pageTitle.match(/문제집[:\s]*(.+)/);
    if (match) {
      title = match[1].trim();
    } else {
      title = pageTitle;
    }
  }

  // 문제 목록 추출
  // DOM Path: table.table.table-striped.table-bordered > tbody > tr
  const problems: WorkbookProblem[] = [];
  const table = $('table.table.table-striped.table-bordered');

  if (table.length === 0) {
    throw new Error(
      `문제집 ${workbookId}의 문제 목록을 찾을 수 없습니다. 페이지 구조가 변경되었을 수 있습니다.`,
    );
  }

  const rows = table.find('tbody tr');

  rows.each((index, row) => {
    const $row = $(row);
    const cells = $row.find('td');

    if (cells.length >= 2) {
      // td[0]: 문제 번호
      const problemIdText = $(cells[0]).text().trim();
      const problemId = parseInt(problemIdText, 10);

      // td[1]: 문제 제목
      const title = $(cells[1]).text().trim();

      if (!isNaN(problemId) && title) {
        problems.push({
          problemId,
          title,
          order: index + 1, // 1부터 시작하는 순서
        });
      }
    }
  });

  if (problems.length === 0) {
    throw new Error(
      `문제집 ${workbookId}에 문제가 없거나 문제 목록을 추출할 수 없습니다.`,
    );
  }

  // 제목이 없으면 기본값 사용
  if (!title) {
    title = `문제집 ${workbookId}`;
  }

  return {
    id: workbookId,
    title,
    problems,
    createdAt: new Date(),
  };
}
