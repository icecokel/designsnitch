import postcss from "postcss";
import { isInTheme } from "./tokens.js";

/**
 * 크기 값의 종류.
 * - radius: 모서리 둥글기. 토큰은 --radius-*, 클래스는 rounded-*
 * - fontSize: 글자 크기. 토큰은 --text-*, 클래스는 text-*
 * - spacing: 간격. 모으기만 하고 검사하지 않는다
 * @typedef {"radius" | "fontSize" | "spacing"} SizeKind
 */

const ROOT_FONT_SIZE = 16;
// 이보다 크면 알약 모양을 만들려고 쓴 값이다. 예: border-radius: 9999px
const PILL = 999;
const LENGTH = /(?<![\w.#-])(\d*\.?\d+)(px|rem)(?![\w%.-])/g;
// 함수 안의 값은 계산의 재료라 그대로 비교할 수 없다. 예: calc(100% - 8px), var(--x, 8px), "문자열", 주석
const NOT_PLAIN = /[a-z-]+\((?:[^()]|\([^()]*\))*\)|"[^"]*"|'[^']*'|\/\*[\s\S]*?\*\//gi;
const DISABLE_NEXT_LINE = "designsnitch-disable-next-line";

/**
 * "8px", "0.5rem" 을 읽는다. 0 과 알약 모양 값, 다른 단위는 null.
 * @returns {{ text: string, px: number, unit: "px" | "rem" } | null} text 는 같은 값을 같은 글자로 적은 것. 예: ".50rem" → "0.5rem"
 */
export function parseLength(value) {
  const match = /^(\d*\.?\d+)(px|rem)$/.exec(String(value).trim().toLowerCase());
  if (!match) return null;
  const n = Number(match[1]);
  const unit = /** @type {"px" | "rem"} */ (match[2]);
  const px = unit === "rem" ? n * ROOT_FONT_SIZE : n;
  if (n === 0 || px >= PILL) return null;
  return { text: `${n}${unit}`, px: Math.round(px * 1000) / 1000, unit };
}

/** 글에서 그대로 적은 길이를 찾는다. 함수 안은 보지 않는다. */
export function findLengths(text) {
  const masked = text.replace(NOT_PLAIN, (skipped) => " ".repeat(skipped.length));
  return [...masked.matchAll(LENGTH)]
    .filter((match) => parseLength(match[0]))
    .map((match) => ({ index: match.index, text: match[0] }));
}

const SPACING_UTILITY = "p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]";
const ARBITRARY_SIZE = new RegExp(
  `(?<![\\w-])(-?)(rounded(?:-(?:[trblse]|[tb][lr]|[se][se]))?|text|${SPACING_UTILITY})-\\[(?:length:)?(\\d*\\.?\\d+(?:px|rem))\\]`,
  "g",
);

/** @returns {SizeKind} */
function utilityKind(utility) {
  if (utility.startsWith("rounded")) return "radius";
  return utility === "text" ? "fontSize" : "spacing";
}

/**
 * 문자열에서 크기를 임의 값으로 쓴 Tailwind 클래스를 찾는다. 예: rounded-t-[8px], text-[14px], px-[13px]
 * @param {string} text
 * @returns {{ index: number, text: string, utility: string, value: string, kind: SizeKind }[]}
 */
export function findArbitrarySizes(text) {
  return [...text.matchAll(ARBITRARY_SIZE)]
    .filter((match) => parseLength(match[3]))
    .map((match) => ({
      index: match.index + match[1].length,
      text: match[0].slice(match[1].length),
      utility: match[2],
      value: match[3],
      kind: utilityKind(match[2]),
    }));
}

const RADIUS_PROPERTY = /^border(-(top|bottom|start|end)-(left|right|start|end))?-radius$/;
const SPACING_PROPERTY = /^(padding|margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^(row-|column-)?gap$/;

/**
 * CSS 속성이 어떤 크기를 받는지. 스타일 객체의 이름(borderRadius, fontSize)도 받는다.
 * @returns {SizeKind | null}
 */
export function sizePropertyKind(property) {
  const name = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  if (RADIUS_PROPERTY.test(name)) return "radius";
  if (name === "font-size") return "fontSize";
  return SPACING_PROPERTY.test(name) ? "spacing" : null;
}

/**
 * CSS 의 선언과 @apply 에서 크기 값을 찾는다. 줄과 열은 1부터 시작하고, 끝 열은 값 바로 다음 칸이다.
 * @param {string} css
 * @param {{ skipCustomProperties?: boolean }} [options]
 * @returns {{ line: number, column: number, endLine: number, endColumn: number, value: string, kind: SizeKind, prop?: string, utility?: string, text?: string, disabled: boolean }[]}
 * @throws {import("postcss").CssSyntaxError}
 */
export function findCssSizes(css) {
  const lineStarts = [0];
  for (let i = 0; i < css.length; i += 1) if (css[i] === "\n") lineStarts.push(i + 1);
  const position = (offset) => {
    let line = lineStarts.length - 1;
    while (lineStarts[line] > offset) line -= 1;
    return { line: line + 1, column: offset - lineStarts[line] + 1 };
  };
  const span = (start, length) => {
    const from = position(start);
    const to = position(start + length);
    return { line: from.line, column: from.column, endLine: to.line, endColumn: to.column };
  };
  const isDisabled = (node) => {
    const previous = node.prev();
    return previous?.type === "comment" && previous.text.includes(DISABLE_NEXT_LINE);
  };

  const found = [];
  const root = postcss.parse(css);
  root.walkAtRules("apply", (rule) => {
    const raw = rule.raws.params?.raw ?? rule.params;
    const paramsStart = rule.source.start.offset + 1 + rule.name.length + (rule.raws.afterName ?? "").length;
    for (const match of findArbitrarySizes(raw)) {
      found.push({
        ...span(paramsStart + match.index, match.text.length),
        value: match.value,
        kind: match.kind,
        utility: match.utility,
        text: match.text,
        disabled: isDisabled(rule),
      });
    }
  });
  root.walkDecls((decl) => {
    const kind = sizePropertyKind(decl.prop);
    if (!kind) return;
    const raw = decl.raws.value?.raw ?? decl.value;
    const valueStart = decl.source.start.offset + decl.prop.length + decl.raws.between.length;
    for (const match of findLengths(raw)) {
      found.push({
        ...span(valueStart + match.index, match.text.length),
        value: match.text,
        kind,
        prop: decl.prop,
        disabled: isDisabled(decl),
      });
    }
  });
  return found.sort((a, b) => a.line - b.line || a.column - b.column);
}

const NAMESPACE = { radius: "--radius-", fontSize: "--text-" };
const CLASS_ROOT = { radius: "rounded", fontSize: "text" };
// 조건이 맞을 때만 적용되는 at-rule. 그 안의 선언은 전역이 아니다.
const CONDITIONAL_AT_RULES = new Set(["media", "supports", "container", "scope", "starting-style"]);
const GLOBAL_SELECTOR = /^(?::root|html|:host|\*)$/;

function isGlobal(decl) {
  let rule = null;
  for (let node = decl.parent; node && node.type !== "root"; node = node.parent) {
    if (node.type === "atrule") {
      if (node.name === "theme") return true;
      if (CONDITIONAL_AT_RULES.has(node.name)) return false;
    } else if (node.type === "rule") {
      rule ??= node;
    }
  }
  return !rule || rule.selectors.every((selector) => GLOBAL_SELECTOR.test(selector.trim()));
}

/**
 * @typedef {object} SizeTokens
 * @property {Map<number, { name: string, text: string, theme: boolean }[]>} byPx px 로 환산한 값 → 그 값의 토큰들
 * @property {number} count 토큰 수
 */

/**
 * 토큰 CSS 에서 --radius-* 와 --text-* 를 읽는다. 어디서나 적용되는 선언만, 값이 px 나 rem 길이인 것만 토큰으로 본다.
 * --text-sm--line-height 같은 딸린 값과 --text-shadow-* 는 글자 크기가 아니다.
 * @param {string} css
 * @returns {{ radius: SizeTokens, fontSize: SizeTokens }}
 */
export function parseSizeTokens(css) {
  const tokens = { radius: { byPx: new Map(), count: 0 }, fontSize: { byPx: new Map(), count: 0 } };
  /** @type {Map<string, Set<string>>} 이름 → 전역에서 선언된 값들 */
  const declared = new Map();
  const themeNames = new Set();
  postcss.parse(css).walkDecls(/^--(radius|text)-/, (decl) => {
    if (!isGlobal(decl)) return;
    declared.set(decl.prop, (declared.get(decl.prop) ?? new Set()).add(decl.value.trim()));
    if (isInTheme(decl)) themeNames.add(decl.prop);
  });
  for (const [name, values] of declared) {
    const kind = name.startsWith(NAMESPACE.radius) ? "radius" : "fontSize";
    const rest = name.slice(NAMESPACE[kind].length);
    if (rest.includes("--") || (kind === "fontSize" && rest.startsWith("shadow-"))) continue;
    // 값이 여러 가지로 선언된 토큰은 어느 값인지 정할 수 없다.
    const length = values.size === 1 ? parseLength([...values][0]) : null;
    if (!length) continue;
    const list = tokens[kind].byPx.get(length.px) ?? [];
    // @theme 밖의 변수는 var() 로는 쓸 수 있어도 rounded-card 같은 클래스는 없다.
    list.push({ name, text: length.text, theme: themeNames.has(name) });
    tokens[kind].byPx.set(length.px, list);
    tokens[kind].count += 1;
  }
  return tokens;
}

/**
 * 예: ("rounded-t", "--radius-lg") → "rounded-t-lg", ("text", "--text-sm") → "text-sm".
 * @theme 밖의 변수는 그 이름의 클래스가 없으므로 변수를 직접 가리킨다: rounded-(--radius-card), text-(length:--text-body)
 */
export function sizeTokenClass(kind, utility, name, varOnly = false) {
  if (varOnly) return kind === "fontSize" ? `${utility}-(length:${name})` : `${utility}-(${name})`;
  return `${utility}-${name.slice(NAMESPACE[kind].length)}`;
}

export { CLASS_ROOT };

/**
 * 직접 쓴 크기를 토큰과 맞춘다.
 * @param {"radius" | "fontSize"} kind
 * @param {SizeTokens} tokens
 * @param {string} value 예: "8px"
 * @param {boolean} asClass 클래스로 쓴 값인지. 아니면 선언이나 스타일의 값이다
 * @returns {null | { names: string[], messageId: "unknown" | "useToken" | "useTokenUnit" | "useTokenLineHeight" | "useTokenVarOnly", varOnly?: boolean }}
 *   토큰이 하나도 없는 종류면 null (기준이 없으니 판정하지 않는다).
 *   useToken: 같은 단위의 같은 값이라 바꿔도 화면이 같다.
 *   useTokenUnit: px 와 rem 을 환산해야 같다. 브라우저의 글자 크기 설정에 따라 달라질 수 있다.
 *   useTokenLineHeight: 글자 크기 클래스는 줄 높이도 함께 정할 수 있다.
 *   useTokenVarOnly: 클래스 자리인데 토큰이 @theme 밖에만 있어서 그 이름의 클래스가 없다.
 */
export function matchSize(kind, tokens, value, asClass) {
  if (tokens.count === 0) return null;
  const length = parseLength(value);
  if (!length) return null;
  const matches = tokens.byPx.get(length.px) ?? [];
  if (matches.length === 0) return { names: [], messageId: "unknown" };
  // 클래스 자리에서는 클래스가 있는 토큰(@theme)을 먼저 본다.
  const classable = matches.filter((token) => token.theme);
  if (asClass && classable.length === 0) {
    return { names: matches.map((token) => token.name), messageId: "useTokenVarOnly", varOnly: true };
  }
  const pool = asClass ? classable : matches;
  const sameUnit = pool.filter((token) => token.text === length.text);
  const names = (sameUnit.length > 0 ? sameUnit : pool).map((token) => token.name);
  if (kind === "fontSize" && asClass) return { names, messageId: "useTokenLineHeight" };
  return { names, messageId: sameUnit.length > 0 ? "useToken" : "useTokenUnit" };
}
