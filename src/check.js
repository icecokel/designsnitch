import fs from "node:fs";
import path from "node:path";
import tsParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import plugin from "./index.js";
import { loadTokens } from "./rules/load-tokens.js";

const FILES = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];
const IGNORES = ["**/.next/**", "**/dist/**", "**/build/**", "**/out/**", "**/coverage/**"];
const RULE_PREFIX = "designsnitch/";

/**
 * @typedef {object} Violation
 * @property {string} file cwd 기준 경로
 * @property {number} line
 * @property {number} column
 * @property {number} endLine
 * @property {number} endColumn
 * @property {string} rule 규칙 ID. 파일을 파싱하지 못했으면 "parse-error"
 * @property {"error" | "warning"} severity
 * @property {string} message
 * @property {string} found 위반한 코드 조각 (클래스나 태그 이름)
 * @property {string[]} candidates 대신 쓸 클래스나 컴포넌트. 없으면 빈 배열
 */

/**
 * 프로젝트를 검사한다. 프로젝트의 ESLint 설정은 쓰지 않고 designsnitch 규칙만 실행한다.
 * @param {object} options
 * @param {string} options.cwd 프로젝트 디렉터리
 * @param {ReturnType<typeof import("./config.js").loadConfig>} options.config
 * @param {string[]} [options.paths] 검사할 파일이나 디렉터리 (cwd 기준)
 * @returns {Promise<{
 *   designSystem: { colorTokens: number, radiusTokens: number, textTokens: number, components: number, replacedTags: number },
 *   problems: string[],
 *   summary: { files: number, errors: number, warnings: number },
 *   violations: Violation[],
 * }>} designSystem 은 설정에서 읽어 낸 것의 개수, problems 는 결과를 믿기 어렵게 만드는 설정 문제
 */
export async function check({ cwd, config, paths = ["."] }) {
  const settings = { designsnitch: config };
  // 설정에 문제가 있으면 파일을 검사하기 전에 알린다.
  const tokens = loadTokens(settings, cwd);
  if (config.components) {
    const dir = path.resolve(cwd, config.components.path);
    if (!fs.existsSync(dir)) {
      throw new Error(`디자인 시스템 컴포넌트 경로를 찾을 수 없습니다: ${dir}`);
    }
  }
  const designSystem = describeDesignSystem(tokens, config);
  const problems = [];
  if (designSystem.colorTokens === 0) {
    problems.push(
      `색 토큰을 하나도 읽지 못했습니다: ${config.tokens}. ` +
        "--color-* 변수의 값이 hex이거나 var()로 hex를 가리켜야 읽을 수 있습니다. " +
        '지금은 모든 hex가 "토큰에 없음" 경고로 나옵니다.',
    );
  }

  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    errorOnUnmatchedPattern: false,
    overrideConfig: [
      { ignores: IGNORES },
      {
        ...plugin.configs.recommended,
        files: FILES,
        languageOptions: {
          parser: tsParser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        // 프로젝트 코드에는 다른 규칙용 eslint-disable 주석이 있을 수 있다.
        linterOptions: { reportUnusedDisableDirectives: "off" },
        settings,
      },
    ],
  });

  const results = await eslint.lintFiles(paths);
  results.sort((a, b) => a.filePath.localeCompare(b.filePath));

  const violations = results.flatMap((result) => {
    const file = path.relative(cwd, result.filePath).split(path.sep).join("/");
    return result.messages
      .filter(isOurs)
      .map((message) => toViolation(file, result.source, message, config));
  });

  return {
    designSystem,
    problems,
    summary: {
      files: results.length,
      errors: violations.filter((v) => v.severity === "error").length,
      warnings: violations.filter((v) => v.severity === "warning").length,
    },
    violations,
  };
}

function describeDesignSystem(tokens, config) {
  const countNames = (map) => new Set([...map.values()].flat()).size;
  const replaces = Object.values(config.components?.replaces ?? {});
  return {
    colorTokens: countNames(tokens.colors),
    radiusTokens: countNames(tokens.scale.radius),
    textTokens: countNames(tokens.scale.text),
    components: new Set(replaces.flat()).size,
    replacedTags: replaces.length,
  };
}

// 프로젝트 코드의 eslint-disable 주석이 여기 없는 다른 플러그인 규칙을 가리키면
// ESLint 가 "규칙 정의를 찾을 수 없다"고 보고한다. 우리 규칙과 파싱 실패만 남긴다.
function isOurs(message) {
  return message.fatal || message.ruleId?.startsWith(RULE_PREFIX);
}

function toViolation(file, source, message, config) {
  const rule = message.ruleId ? message.ruleId.slice(RULE_PREFIX.length) : "parse-error";
  const endLine = message.endLine ?? message.line;
  const endColumn = message.endColumn ?? message.column;
  const found =
    message.ruleId && source
      ? sliceSource(source, message.line, message.column, endLine, endColumn)
      : "";

  let candidates = (message.suggestions ?? []).map((suggestion) => suggestion.fix.text);
  if (rule === "use-ds-component") {
    // 컴포넌트는 import 까지 바꿔야 해서 제안(자동 교체)이 없다. 설정에서 후보를 찾는다.
    candidates = [config.components?.replaces?.[found] ?? []].flat();
  }

  return {
    file,
    line: message.line,
    column: message.column,
    endLine,
    endColumn,
    rule,
    severity: message.severity === 2 ? "error" : "warning",
    message: message.message,
    found,
    candidates,
  };
}

// ESLint 의 줄, 열은 1부터 시작한다.
function sliceSource(source, line, column, endLine, endColumn) {
  const lines = source.split("\n");
  if (line === endLine) return lines[line - 1].slice(column - 1, endColumn - 1);
  return [
    lines[line - 1].slice(column - 1),
    ...lines.slice(line, endLine - 1),
    lines[endLine - 1].slice(0, endColumn - 1),
  ].join("\n");
}
