export type Language = "python" | "javascript" | "typescript" | "cpp";

export interface LanguageConfig {
  extension: string;
  templateFile: string;
  compileCommand?: string;
  runCommand: string;
}

export const LANGUAGE_CONFIGS: Record<Language, LanguageConfig> = {
  python: {
    extension: "py",
    templateFile: "solution.py",
    runCommand: "python3",
  },
  javascript: {
    extension: "js",
    templateFile: "solution.js",
    runCommand: "node",
  },
  typescript: {
    extension: "ts",
    templateFile: "solution.ts",
    runCommand: "node",
  },
  cpp: {
    extension: "cpp",
    templateFile: "solution.cpp",
    compileCommand: "g++ -o solution solution.cpp",
    runCommand: "./solution",
  },
};

export function getLanguageConfig(language: Language): LanguageConfig {
  return LANGUAGE_CONFIGS[language];
}

export function detectLanguageFromFile(filename: string): Language | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;

  switch (ext) {
    case "py":
      return "python";
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "cpp":
    case "cc":
    case "cxx":
      return "cpp";
    default:
      return null;
  }
}
