import fs from "node:fs";
import path from "node:path";
import { replacementNames, tokenSettings } from "./config.js";
import { findArbitraryColors, tokenToClass } from "./core/classes.js";
import { colorLabel, parseColor } from "./core/color.js";
import { findCssColors } from "./core/css.js";
import {
  cssColorPrefixes,
  lookupColor,
  recommendColorCandidate,
  selectColorTokens,
  themeValue,
  tokenClass,
  tokenValue,
  utilityColorPrefixes,
} from "./core/tokens.js";
import { createEngine } from "./engine.js";
import { splitPaths } from "./files.js";
import plugin from "./index.js";
import { messages, resolveLang } from "./messages.js";
import { loadTokens } from "./rules/load-tokens.js";
import uncheckedColors from "./rules/unchecked-colors.js";

const RULE_PREFIX = "designsnitch/";
const UNCHECKED_RULE = "designsnitch-internal/unchecked-colors";
const internalPlugin = { rules: { "unchecked-colors": uncheckedColors } };
const MAX_DECISION_LOCATIONS = 5;

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
 * @property {string | null} recommended 바로 바꿀 후보 또는 역할에 맞는 유일한 후보
 * @property {"replace" | "migrate" | "ask" | "repair"} action 이 위반을 어떻게 다룰지.
 *   replace: found 를 candidates 의 값으로 바꿔도 화면과 동작이 같다 (후보가 하나뿐인 색 오류)
 *   migrate: raw 태그를 하나뿐인 후보 컴포넌트로 옮긴다. 컴포넌트를 읽고 props 와 스타일을 맞춰야 한다
 *   ask: 사람이 정해야 한다 (교체가 확실하지 않거나 후보가 하나가 아닌 경우)
 *   repair: 파일을 읽지 못했다. 문법 오류부터 고쳐야 한다
 */

/**
 * @typedef {object} Decision
 * @property {string} id
 * @property {string} rule
 * @property {string} subject 정규화한 색 또는 꺾쇠로 감싼 태그 이름
 * @property {number} uses 위반 횟수
 * @property {number} files 위반이 있는 파일 수
 * @property {Pick<Violation, "file" | "line" | "column">[]} locations 위반 위치 최대 다섯 곳
 * @property {string[]} candidates
 * @property {string | null} recommended 각 위치에서 추천이 같을 때 그 후보
 * @property {("multiple-candidates" | "no-token" | "themed-token" | "class-only-token" | "translucent" | "not-a-style" | "dynamic-props")[]} reasons
 */

/**
 * 프로젝트를 검사한다. 프로젝트의 ESLint 설정은 쓰지 않고 designsnitch 규칙만 실행한다.
 * @param {object} options
 * @param {string} options.cwd 프로젝트 디렉터리
 * @param {ReturnType<typeof import("./config.js").loadConfig>} options.config
 * @param {string[]} [options.paths] 검사할 파일이나 디렉터리 (cwd 기준)
 * @param {"en" | "ko"} [options.lang] 문장의 언어. 없으면 설정의 lang, 환경 변수, 영어 순으로 정한다
 * @param {string} [options.sourceCwd] 임시 복사본을 검사할 때 원본 프로젝트 디렉터리
 * @returns {Promise<{
 *   designSystem: { colorTokens: number, components: number, replacedTags: number },
 *   problems: string[],
 *   next: string[],
 *   summary: { files: number, errors: number, warnings: number },
 *   violations: Violation[],
 *   decisions: Decision[],
 * }>} designSystem 은 설정에서 읽어 낸 것의 개수, problems 는 결과를 믿기 어렵게 만드는 설정 문제,
 *   next 는 이 결과를 받은 에이전트가 순서대로 할 일
 */
export async function check({ cwd, config, paths = ["."], lang, sourceCwd = cwd }) {
  lang = resolveLang(lang, config.lang);
  const m = messages(lang);
  const root = path.resolve(sourceCwd, config.root ?? ".");
  // 규칙도 같은 언어를 쓰도록 설정에 실어 보낸다.
  const settings = { designsnitch: { ...config, root, lang } };
  // 설정에 문제가 있으면 파일을 검사하기 전에 알린다.
  const tokens = loadTokens(settings, cwd);
  if (config.components) {
    const dir = path.resolve(root, config.components.path);
    if (!fs.existsSync(dir)) {
      throw new Error(m.componentsDirMissing({ dir }));
    }
  }
  const designSystem = describeDesignSystem(tokens, config);
  const problems = [...tokens.problems];
  if (designSystem.colorTokens + designSystem.paletteColors === 0) {
    problems.push(m.noColorTokens({ tokens: tokenSettings(config.tokens).file }));
  }

  const { scriptPaths, cssFiles } = splitPaths(cwd, paths);

  // JS, TS 는 ESLint 로 규칙을 실행하고, CSS 는 직접 읽는다.
  const recommended = plugin.configs.recommended;
  const eslint = createEngine({
    cwd,
    config: {
      plugins: { ...recommended.plugins, "designsnitch-internal": internalPlugin },
      rules: { ...recommended.rules, [UNCHECKED_RULE]: "warn" },
      settings,
    },
  });
  const results = scriptPaths.length > 0 ? await eslint.lintFiles(scriptPaths) : [];
  // 검사하지 못한 색은 위반이 아니라 개수로만 알린다. 놓친 것이 있다는 사실을 숨기지 않기 위해서다.
  const uncheckedFiles = results
    // 토큰을 정의하는 파일(tailwind.config.js)의 색은 놓친 색이 아니다.
    .filter((result) => !tokens.files.has(realPath(result.filePath)))
    .map((result) => result.messages.filter((message) => message.ruleId === UNCHECKED_RULE).length)
    .filter((n) => n > 0);
  const unchecked = { colors: uncheckedFiles.reduce((a, b) => a + b, 0), files: uncheckedFiles.length };
  const scriptViolations = results.flatMap((result) => {
    const file = path.relative(cwd, result.filePath).split(path.sep).join("/");
    return result.messages
      .filter(isOurs)
      .map((message) => toViolation(file, result.source, message, config));
  });
  const cssViolations = cssFiles.flatMap((file) => {
    const source = fs.readFileSync(path.resolve(cwd, file), "utf8");
    const skipCustomProperties = tokens.files.has(realPath(path.resolve(sourceCwd, file)));
    return checkCss(file, source, tokens, m, { skipCustomProperties });
  });

  const findings = [...scriptViolations, ...cssViolations]
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column)
    .map((finding) => {
      const action = actionFor(finding, finding.messageId);
      const recommended = action === "replace" || action === "migrate" ? finding.candidates[0] : finding.recommended ?? null;
      return { ...finding, action, recommended };
    });
  const violations = findings.map(({ messageId, ...violation }) => violation);
  const decisions = groupDecisions(findings);

  return {
    designSystem,
    problems,
    next: nextSteps(designSystem, violations, lang, decisions),
    summary: {
      files: results.length + cssFiles.length,
      errors: violations.filter((v) => v.severity === "error").length,
      warnings: violations.filter((v) => v.severity === "warning").length,
    },
    violations,
    decisions,
    unchecked,
  };
}

/**
 * CSS 파일 하나의 색을 토큰과 비교한다. 대체 후보는 선언에서는 var(--토큰), @apply 에서는 토큰 클래스다.
 * @returns {(Omit<Violation, "action" | "recommended"> & { recommended?: string | null, messageId?: string })[]}
 */
function checkCss(file, source, tokens, m, options) {
  let colors;
  try {
    colors = findCssColors(source, options);
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
    .map(({ value, prop, utility, text, disabled, ...location }) => {
      // @apply 의 클래스는 JS 의 클래스처럼 토큰 클래스로, 선언의 값은 var(--토큰) 으로 바꾼다.
      const found = text ?? value;
      const prefixes = utility ? utilityColorPrefixes(utility) : cssColorPrefixes(prop);
      const { names: known, opacity } = lookupColor(tokens.colors, value);
      // CSS 변수가 없는 토큰도 Tailwind v3 의 CSS 에서는 theme() 으로 같은 값을 쓸 수 있다.
      const viaTheme = (name) => tokens.classOnly.has(name) && tokens.themePaths.has(name);
      const toCandidate = (name) => {
        if (utility) return tokenClass(utility, name, opacity);
        return viaTheme(name) ? themeValue(tokens.themePaths.get(name), opacity) : tokenValue(name, tokens.prefix, opacity);
      };
      // 클래스로만 쓸 수 있는 토큰은 선언의 값을 대신할 수 없다. 그래도 직접 쓴 색이라는 것은 알린다.
      const usable = utility ? known : known.filter((name) => !tokens.classOnly.has(name) || viaTheme(name));
      if (known.length > 0 && usable.length === 0) {
        return {
          file,
          ...location,
          rule: "color-use-token",
          severity: "error",
          messageId: "useTokenClassOnly",
          message: m.useTokenClassOnly({ found, tokens: known.join(", ") }),
          found,
          candidates: [],
          recommended: null,
        };
      }
      const tokenNames = selectColorTokens(usable, tokens.prefer, prefixes);
      const candidates = tokenNames.map(toCandidate);
      const recommendedToken = recommendColorCandidate(tokenNames, prefixes);
      const messageId =
        opacity !== null ? "useTokenAlpha" : tokenNames.some((name) => tokens.themed.has(name)) ? "useTokenThemed" : "useToken";
      return {
        file,
        ...location,
        ...(tokenNames.length > 0
          ? {
              rule: "color-use-token",
              severity: "error",
              messageId,
              message: m[messageId]({
                found,
                tokens: tokenNames.join(", "),
                candidates: candidates.join(", "),
                opacity,
              }),
            }
          : {
              rule: "color-unknown",
              severity: "warning",
              message: utility ? m.unknownColor({ found }) : m.unknownCssColor({ value }),
            }),
        found,
        candidates,
        recommended: recommendedToken ? toCandidate(recommendedToken) : null,
      };
    });
}

function realPath(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return file; // HEAD 비교처럼 원본 위치에 파일이 없을 수 있다
  }
}

function actionFor({ rule, severity, candidates }, messageId) {
  if (rule === "parse-error") return "repair";
  // 반투명한 색은 불투명도를 반올림해 후보를 내므로, 바꿔도 같은 색이라고 보장할 수 없다.
  // 스타일이 아닌 자리의 색은 var() 가 통하는지 알 수 없다.
  if (["useComponentAsk", "useTokenThemed", "useTokenAlpha", "useTokenData"].includes(messageId)) return "ask";
  if (severity !== "error" || candidates.length !== 1) return "ask";
  // 컴포넌트는 props 와 기본 스타일이 태그와 다를 수 있어서, 바꿔도 같다고 보장할 수 없다.
  return rule === "use-ds-component" ? "migrate" : "replace";
}

function decisionSubject({ rule, found }) {
  if (rule === "use-ds-component") return `<${found}>`;
  const value = parseColor(found) ? found : findArbitraryColors(found)[0]?.value;
  return value ? colorLabel(value) : found;
}

/**
 * @param {(Violation & { messageId?: string })[]} violations
 * @returns {Decision[]}
 */
function groupDecisions(violations) {
  /** @type {Map<string, Omit<Decision, "id" | "files" | "reasons"> & { files: Set<string>, reasons: Set<Decision["reasons"][number]> }>} */
  const byQuestion = new Map();
  for (const violation of violations) {
    if (violation.action !== "ask") continue;
    const { rule, candidates, recommended, messageId, file, line, column } = violation;
    const subject = decisionSubject(violation);
    // 역할 때문에 순서만 다른 후보는 같은 질문으로 묶는다.
    const key = JSON.stringify([rule, subject, [...candidates].sort()]);
    let decision = byQuestion.get(key);
    if (!decision) {
      decision = { rule, subject, uses: 0, files: new Set(), locations: [], candidates, recommended, reasons: new Set() };
      byQuestion.set(key, decision);
    }
    decision.uses += 1;
    decision.files.add(file);
    if (decision.locations.length < MAX_DECISION_LOCATIONS) decision.locations.push({ file, line, column });
    if (decision.recommended !== recommended) decision.recommended = null;
    if (candidates.length > 1) decision.reasons.add("multiple-candidates");
    if (rule === "color-unknown") decision.reasons.add("no-token");
    if (messageId === "useTokenThemed") decision.reasons.add("themed-token");
    if (messageId === "useTokenClassOnly") decision.reasons.add("class-only-token");
    if (messageId === "useTokenAlpha") decision.reasons.add("translucent");
    if (messageId === "useTokenData") decision.reasons.add("not-a-style");
    if (messageId === "useComponentAsk") decision.reasons.add("dynamic-props");
  }

  return [...byQuestion.values()]
    .sort((a, b) => b.uses - a.uses)
    .map(({ files, reasons, ...decision }, index) => ({
      id: `decision-${index + 1}`,
      ...decision,
      files: files.size,
      reasons: [...reasons],
    }));
}

/**
 * 결과를 받은 에이전트가 무엇부터 해야 하는지를 순서대로 적는다.
 * @param {{ colorTokens: number }} designSystem
 * @param {Violation[]} violations action 이 붙은 위반들
 * @param {"en" | "ko"} [lang]
 * @param {Decision[]} [decisions] check 결과의 결정 목록. 훅은 위반만 보여 준다
 * @returns {string[]}
 */
export function nextSteps(designSystem, violations, lang, decisions) {
  const m = messages(lang);
  const noColorTokens = designSystem.colorTokens + (designSystem.paletteColors ?? 0) === 0;
  // 색 토큰이 없으면 색 위반은 하나씩 다룰 일이 아니라 토큰을 정하는 일 하나로 묶인다.
  const actionable = noColorTokens
    ? violations.filter((v) => !v.rule.startsWith("color-"))
    : violations;
  const count = (action) => actionable.filter((v) => v.action === action).length;
  const [repair, replace, migrate] = ["repair", "replace", "migrate"].map(count);
  const ask = decisions === undefined
    ? count("ask")
    : decisions.filter((decision) => !noColorTokens || !decision.rule.startsWith("color-")).length;
  const steps = [];

  if (noColorTokens) steps.push(m.nextNoTokens());
  if (repair > 0) steps.push(m.nextRepair(repair));
  if (replace > 0) steps.push(m.nextReplace(replace));
  if (migrate > 0) steps.push(m.nextMigrate(migrate));
  if (ask > 0) steps.push(decisions === undefined ? m.hookNextAsk(ask) : m.nextAsk(ask));
  if (repair + replace + migrate > 0) steps.push(m.nextRerun());

  return steps.length > 0 ? steps : [m.nextNone()];
}

function describeDesignSystem(tokens, config) {
  const replaces = Object.values(config.components?.replaces ?? {});
  const names = new Set([...tokens.colors.values()].flat());
  return {
    colorTokens: [...names].filter((name) => !tokens.paletteNames.has(name)).length,
    paletteColors: tokens.paletteNames.size,
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

  let recommended = null;
  const color = rule === "color-use-token" && findArbitraryColors(found)[0];
  if (color) {
    const prefixes = utilityColorPrefixes(color.utility).map((prefix) => tokenToClass(color.utility, prefix));
    recommended = recommendColorCandidate(candidates, prefixes);
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
    recommended,
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
