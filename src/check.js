import fs from "node:fs";
import path from "node:path";
import { replacementNames } from "./config.js";
import { normalizeHex } from "./core/color.js";
import { findCssColors } from "./core/css.js";
import { createEngine } from "./engine.js";
import { splitPaths } from "./files.js";
import plugin from "./index.js";
import { messages, resolveLang } from "./messages.js";
import { loadTokens } from "./rules/load-tokens.js";

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
 * @property {"replace" | "ask" | "repair"} action 이 위반을 어떻게 다룰지.
 *   replace: found 를 candidates 의 값으로 바꿀 수 있다 (교체가 안전하고 후보가 하나뿐인 오류)
 *   ask: 사람이 정해야 한다 (교체가 확실하지 않거나 후보가 하나가 아닌 경우)
 *   repair: 파일을 읽지 못했다. 문법 오류부터 고쳐야 한다
 */

/**
 * 프로젝트를 검사한다. 프로젝트의 ESLint 설정은 쓰지 않고 designsnitch 규칙만 실행한다.
 * @param {object} options
 * @param {string} options.cwd 프로젝트 디렉터리
 * @param {ReturnType<typeof import("./config.js").loadConfig>} options.config
 * @param {string[]} [options.paths] 검사할 파일이나 디렉터리 (cwd 기준)
 * @param {"en" | "ko"} [options.lang] 문장의 언어. 없으면 설정의 lang, 환경 변수, 영어 순으로 정한다
 * @returns {Promise<{
 *   designSystem: { colorTokens: number, components: number, replacedTags: number },
 *   problems: string[],
 *   next: string[],
 *   summary: { files: number, errors: number, warnings: number },
 *   violations: Violation[],
 * }>} designSystem 은 설정에서 읽어 낸 것의 개수, problems 는 결과를 믿기 어렵게 만드는 설정 문제,
 *   next 는 이 결과를 받은 에이전트가 순서대로 할 일
 */
export async function check({ cwd, config, paths = ["."], lang }) {
  lang = resolveLang(lang, config.lang);
  const m = messages(lang);
  // 규칙도 같은 언어를 쓰도록 설정에 실어 보낸다.
  const settings = { designsnitch: { ...config, lang } };
  // 설정에 문제가 있으면 파일을 검사하기 전에 알린다.
  const tokens = loadTokens(settings, cwd);
  if (config.components) {
    const dir = path.resolve(cwd, config.components.path);
    if (!fs.existsSync(dir)) {
      throw new Error(m.componentsDirMissing({ dir }));
    }
  }
  const designSystem = describeDesignSystem(tokens, config);
  const problems = [];
  if (designSystem.colorTokens === 0) {
    problems.push(m.noColorTokens({ tokens: config.tokens }));
  }

  const { scriptPaths, cssFiles } = splitPaths(cwd, paths);

  // JS, TS 는 ESLint 로 규칙을 실행하고, CSS 는 직접 읽는다.
  const eslint = createEngine({ cwd, config: { ...plugin.configs.recommended, settings } });
  const results = scriptPaths.length > 0 ? await eslint.lintFiles(scriptPaths) : [];
  const scriptViolations = results.flatMap((result) => {
    const file = path.relative(cwd, result.filePath).split(path.sep).join("/");
    return result.messages
      .filter(isOurs)
      .map((message) => toViolation(file, result.source, message, config));
  });
  const cssViolations = cssFiles.flatMap((file) =>
    checkCss(file, fs.readFileSync(path.resolve(cwd, file), "utf8"), tokens, m),
  );

  const violations = [...scriptViolations, ...cssViolations]
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column)
    .map(({ messageId, ...violation }) => ({ ...violation, action: actionFor(violation, messageId) }));

  return {
    designSystem,
    problems,
    next: nextSteps(designSystem, violations, lang),
    summary: {
      files: results.length + cssFiles.length,
      errors: violations.filter((v) => v.severity === "error").length,
      warnings: violations.filter((v) => v.severity === "warning").length,
    },
    violations,
  };
}

/**
 * CSS 파일 하나의 hex 색을 토큰과 비교한다. 대체 후보는 var(--토큰) 이다.
 * @returns {(Omit<Violation, "action"> & { messageId?: string })[]}
 */
function checkCss(file, source, tokens, m) {
  let colors;
  try {
    colors = findCssColors(source);
  } catch (error) {
    const at = { line: error.line ?? 1, column: error.column ?? 1 };
    return [
      {
        file,
        ...at,
        endLine: at.line,
        endColumn: at.column,
        rule: "parse-error",
        severity: "error",
        message: error.reason ?? error.message,
        found: "",
        candidates: [],
      },
    ];
  }

  return colors
    .filter((color) => !color.disabled)
    .map(({ value, prop, disabled, ...location }) => {
      const tokenNames = tokens.colors.get(normalizeHex(value)) ?? [];
      const candidates = tokenNames.map((name) => `var(${name})`);
      const messageId = tokenNames.some((name) => tokens.themed.has(name)) ? "useTokenThemed" : "useToken";
      return {
        file,
        ...location,
        ...(tokenNames.length > 0
          ? {
              rule: "color-use-token",
              severity: "error",
              messageId,
              message: m[messageId]({
                found: value,
                tokens: tokenNames.join(", "),
                candidates: candidates.join(", "),
              }),
            }
          : {
              rule: "color-unknown",
              severity: "warning",
              message: m.unknownCssColor({ value }),
            }),
        found: value,
        candidates,
      };
    });
}

function actionFor({ rule, severity, candidates }, messageId) {
  if (rule === "parse-error") return "repair";
  if (messageId === "useComponentAsk" || messageId === "useTokenThemed") return "ask";
  return severity === "error" && candidates.length === 1 ? "replace" : "ask";
}

/**
 * 결과를 받은 에이전트가 무엇부터 해야 하는지를 순서대로 적는다.
 * @param {{ colorTokens: number }} designSystem
 * @param {Violation[]} violations action 이 붙은 위반들
 * @param {"en" | "ko"} [lang]
 * @returns {string[]}
 */
export function nextSteps(designSystem, violations, lang) {
  const m = messages(lang);
  const noColorTokens = designSystem.colorTokens === 0;
  // 색 토큰이 없으면 색 위반은 하나씩 다룰 일이 아니라 토큰을 정하는 일 하나로 묶인다.
  const actionable = noColorTokens
    ? violations.filter((v) => !v.rule.startsWith("color-"))
    : violations;
  const count = (action) => actionable.filter((v) => v.action === action).length;
  const [repair, replace, ask] = ["repair", "replace", "ask"].map(count);
  const steps = [];

  if (noColorTokens) steps.push(m.nextNoTokens());
  if (repair > 0) steps.push(m.nextRepair(repair));
  if (replace > 0) steps.push(m.nextReplace(replace));
  if (ask > 0) steps.push(m.nextAsk(ask));
  if (repair + replace > 0) steps.push(m.nextRerun());

  return steps.length > 0 ? steps : [m.nextNone()];
}

function describeDesignSystem(tokens, config) {
  const countNames = (map) => new Set([...map.values()].flat()).size;
  const replaces = Object.values(config.components?.replaces ?? {});
  return {
    colorTokens: countNames(tokens.colors),
    components: new Set(replaces.flatMap(replacementNames)).size,
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
    candidates = replacementNames(config.components?.replaces?.[found]);
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
    messageId: message.messageId,
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
