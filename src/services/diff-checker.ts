export interface DiffResult {
  pass: boolean;
  expected: string;
  actual: string;
}

// 줄 끝 공백을 제거하고 CRLF를 LF로 통일
export function normalizeOutput(output: string): string {
  return output
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

export function compareOutput(expected: string, actual: string): DiffResult {
  const expectedNorm = normalizeOutput(expected);
  const actualNorm = normalizeOutput(actual);

  return {
    pass: expectedNorm === actualNorm,
    expected: expectedNorm,
    actual: actualNorm,
  };
}
