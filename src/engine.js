import tsParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import { IGNORED_DIRS } from "./files.js";

const FILES = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];
const IGNORES = IGNORED_DIRS.map((dir) => `**/${dir}/**`);

/**
 * 프로젝트의 소스 파일에 주어진 규칙만 실행하는 ESLint 를 만든다.
 * 프로젝트 자신의 ESLint 설정은 쓰지 않는다.
 * @param {object} options
 * @param {string} options.cwd 프로젝트 디렉터리
 * @param {import("eslint").Linter.Config} options.config plugins, rules, settings
 * @param {boolean} [options.allowInlineConfig] false 면 eslint-disable 같은 주석을 무시한다
 */
export function createEngine({ cwd, config, allowInlineConfig = true }) {
  return new ESLint({
    cwd,
    overrideConfigFile: true,
    errorOnUnmatchedPattern: false,
    allowInlineConfig,
    overrideConfig: [
      { ignores: IGNORES },
      {
        ...config,
        files: FILES,
        languageOptions: {
          parser: tsParser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        // 프로젝트 코드에는 다른 규칙용 eslint-disable 주석이 있을 수 있다.
        linterOptions: { reportUnusedDisableDirectives: "off" },
      },
    ],
  });
}

