export interface LanguageConfig {
  extension: string;
  templateFile: string;
  compileCommand?: string;
  runCommand: string;
  bojLangId?: number; // BOJ 제출 시 사용하는 언어 ID
}

export const SUPPORTED_LANGUAGES = ['python', 'cpp'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export function getSupportedLanguages(): Language[] {
  return [...SUPPORTED_LANGUAGES];
}

export function getSupportedLanguagesString(): string {
  return SUPPORTED_LANGUAGES.join(', ');
}

export const LANGUAGE_CONFIGS: Record<Language, LanguageConfig> = {
  python: {
    extension: 'py',
    templateFile: 'solution.py',
    runCommand: 'python3',
    bojLangId: 28, // Python 3
  },
  cpp: {
    extension: 'cpp',
    templateFile: 'solution.cpp',
    // 절대 경로로 에러를 표시해서 에디터에서 문제 디렉토리의 파일로 바로 이동할 수 있도록 함
    compileCommand: 'g++ -fdiagnostics-absolute-paths -o solution solution.cpp',
    runCommand: './solution',
    bojLangId: 84, // C++17
  },
};

export function getLanguageConfig(language: Language): LanguageConfig {
  return LANGUAGE_CONFIGS[language];
}

export function detectLanguageFromFile(filename: string): Language | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  switch (ext) {
    case 'py':
      return 'python';
    case 'cpp':
    case 'cc':
    case 'cxx':
      return 'cpp';
    default:
      return null;
  }
}
