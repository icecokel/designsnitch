import postcss from "postcss";
import { normalizeColor, parseColor } from "./color.js";

const COLOR_TOKEN = /^--color-/;
const ROLE_PREFIXES = {
  text: ["--color-text-"],
  border: ["--color-border-"],
  bg: ["--color-bg-", "--color-surface", "--color-background"],
};
// 값을 정할 수 없다는 표시. 가리키는 변수가 없고 fallback 도 없는 경우다.
const UNRESOLVED = "";
// 조건이 맞을 때만 적용되는 at-rule. 그 안의 선언은 전역이 아니다.
const CONDITIONAL_AT_RULES = new Set(["media", "supports", "container", "scope", "starting-style"]);
// 문서 전체에 적용되는 선택자
const GLOBAL_SELECTOR = /^(?::root|html|:host|\*)$/;

/** 선언이 어디서나 적용되는지. @theme 안이거나, 조건 없는 :root, html, :host 규칙 안이다. */
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

/** 선언이 @theme 안에 있는지. Tailwind v4 는 @theme 의 변수로만 유틸리티 클래스를 만든다. */
export function isInTheme(decl) {
  for (let node = decl.parent; node && node.type !== "root"; node = node.parent) {
    if (node.type === "atrule" && node.name === "theme") return true;
  }
  return false;
}

// var(--name) 또는 var(--name, 대체값)
const VAR_REFERENCE = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/s;

/**
 * 토큰 CSS에서 --color-* 변수를 읽어 "색 값 → 토큰 이름들" 표를 만든다.
 *
 * 값이 var() 로 다른 변수를 가리키면 따라가서 읽는다. 한 변수가 여러 곳에서
 * (예: :root 와 .dark) 다른 값으로 선언되어 있으면 그 값들을 모두 토큰의 값으로 본다.
 * @param {string} css
 * @returns {Map<string, string[]>}
 */
export function parseColorTokens(css) {
  return parseColorTokenData(css).colors;
}

/**
 * 색 값 → 토큰 표와 서로 다른 최종 값이 있는 토큰 이름을 함께 읽는다.
 * @param {string} css
 * @param {string[]} [exclude] 정확한 이름 또는 끝에 *가 붙은 이름 패턴
 * @returns {{ colors: Map<string, string[]>, themed: Set<string>, names: Set<string>, resets: string[], varOnly: Set<string> }}
 *   varOnly 는 @theme 밖에만 선언된 토큰. CSS 변수로는 있지만 Tailwind 가 클래스를 만들지 않는다
 *   names 는 값을 읽었든 못 읽었든 선언된 --color-* 이름, resets 는 initial 로 비운 네임스페이스(예: "--color-*")
 */
export function parseColorTokenData(css, exclude = []) {
  /** @type {Map<string, { global: string[], scoped: string[], theme: boolean }>} 변수 이름 → 전역에서 선언된 값들과 일부에서만 선언된 값들, @theme 에 선언됐는지 */
  const declared = new Map();
  postcss.parse(css).walkDecls(/^--/, (decl) => {
    const values = declared.get(decl.prop) ?? { global: [], scoped: [], theme: false };
    values[isGlobal(decl) ? "global" : "scoped"].push(decl.value);
    if (isInTheme(decl)) values.theme = true;
    declared.set(decl.prop, values);
  });

  /**
   * 값이 결국 가리키는 값들. 값을 정할 수 없는 경우가 있으면 UNRESOLVED 가 섞인다.
   * @returns {string[]}
   */
  function resolve(value, visiting) {
    const trimmed = value.trim();
    const reference = VAR_REFERENCE.exec(trimmed);
    if (!reference) return [trimmed];
    const [, name, fallback] = reference;
    if (visiting.has(name)) return [];
    const whenMissing = () => (fallback ? resolve(fallback, visiting) : [UNRESOLVED]);
    const target = declared.get(name);
    if (!target) return whenMissing();

    const next = new Set(visiting).add(name);
    const values = [...target.global, ...target.scoped].flatMap((item) => resolve(item, next));
    // 변수가 일부 선택자에만 있으면, 그 밖에서는 fallback 이 쓰인다.
    return target.global.length === 0 ? [...whenMissing(), ...values] : values;
  }

  const colors = new Map();
  const themed = new Set();
  const names = new Set();
  const resets = [];
  const varOnly = new Set();
  for (const [name, { global, scoped, theme }] of declared) {
    // Tailwind 는 --color-*: initial 처럼 네임스페이스를 비울 수 있다. 토큰이 아니라 기본 테마를 지우는 선언이다.
    if (name.endsWith("*")) {
      if ([...global, ...scoped].some((value) => value.trim() === "initial")) resets.push(name);
      continue;
    }
    if (!COLOR_TOKEN.test(name)) continue;
    // .promo { --color-promo: ... } 처럼 일부에서만 선언된 변수는 어디서나 쓸 수 있는 토큰이 아니다.
    if (global.length === 0) continue;
    names.add(name);
    if (!theme) varOnly.add(name);
    if (exclude.some((pattern) => pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern)) continue;
    const resolved = new Set();
    for (const value of [...global, ...scoped].flatMap((value) => resolve(value, new Set([name])))) {
      const color = normalizeColor(value);
      // 색으로 읽지 못한 값도 테마 차이는 만들 수 있지만 색 후보로는 쓰지 않는다.
      const key = color ?? value;
      if (resolved.has(key)) continue;
      resolved.add(key);
      if (!color) continue;
      if (!colors.has(color)) colors.set(color, []);
      colors.get(color).push(name);
    }
    if (resolved.size > 1) themed.add(name);
  }
  return { colors, themed, names, resets, varOnly };
}

/** 토큰을 CSS 에서 가리키는 표기. Tailwind 접두어가 있으면 변수 이름에 붙는다. 예: var(--tw-color-brand) */
export function tokenVar(name, prefix) {
  return `var(${prefix ? name.replace(/^--/, `--${prefix}-`) : name})`;
}

/**
 * 색 값에 맞는 토큰을 찾는다. 반투명한 색이면 불투명한 색의 토큰과 불투명도를 함께 준다.
 * @param {Map<string, string[]>} colors 색 값 → 토큰 이름들
 * @param {string} value
 * @returns {{ names: string[], opacity: number | null }} opacity 는 반투명할 때의 불투명도(%). 불투명하면 null
 */
export function lookupColor(colors, value) {
  const color = parseColor(value);
  if (!color) return { names: [], opacity: null };
  // 0 은 아니지만 반올림하면 0% 가 되는 값은 1% 로 본다. 0% 는 완전히 투명하다는 다른 뜻이다.
  const opacity = color.opaque ? null : Math.max(1, Math.round(color.alpha * 100));
  return { names: colors.get(color.key) ?? [], opacity };
}

/** 토큰을 CSS 값으로 쓰는 표기. 불투명도가 있으면 투명과 섞는다. */
export function tokenValue(name, prefix, opacity) {
  const reference = tokenVar(name, prefix);
  return opacity === null ? reference : `color-mix(in srgb, ${reference} ${opacity}%, transparent)`;
}

/**
 * Tailwind v3 의 CSS 에서 설정의 색을 가리키는 표기. 예: theme("colors.brand.500"), theme("colors.brand.500 / 50%")
 * @param {string[]} path 설정의 키 경로
 * @param {number | null} opacity
 */
export function themeValue(path, opacity) {
  const keys = path.map((key) => (/^[\w-]+$/.test(key) ? `.${key}` : `[${key}]`)).join("");
  return `theme("colors${keys}${opacity === null ? "" : ` / ${opacity}%`}")`;
}

/** 토큰을 클래스로 쓰는 표기. 불투명도는 Tailwind 의 /50 꼴로 붙인다. 예: bg-brand/50 */
export function tokenClass(utility, name, opacity) {
  const className = `${utility}-${name.replace(/^--color-/, "")}`;
  return opacity === null ? className : `${className}/${opacity}`;
}

/**
 * 색을 클래스로 쓸 후보를 만든다. @theme 에 선언된 토큰이 있으면 그 클래스만 낸다.
 * 모두 @theme 밖의 변수뿐이면 그 이름의 클래스는 없다. Tailwind v4 에서는 변수를 직접 가리키는 bg-(--color-x) 꼴을 내고,
 * v3 에서는 낼 수 있는 클래스가 없다.
 * @param {string[]} names 값이 같은 토큰 이름들
 * @param {{ varOnly?: Set<string>, tailwindV3?: boolean }} tokens
 * @param {string} utility
 * @param {number | null} opacity
 * @returns {{ names: string[], toClass: (name: string) => string | null, varOnly: boolean }}
 */
export function classableTokens(names, tokens, utility, opacity) {
  const inTheme = names.filter((name) => !tokens.varOnly?.has(name));
  if (inTheme.length > 0 || names.length === 0) {
    return { names: inTheme, toClass: (name) => tokenClass(utility, name, opacity), varOnly: false };
  }
  const suffix = opacity === null ? "" : `/${opacity}`;
  return {
    names,
    toClass: (name) => (tokens.tailwindV3 ? null : `${utility}-(${name})${suffix}`),
    varOnly: true,
  };
}

export function utilityColorPrefixes(utility) {
  const kind = utility.toLowerCase().split("-", 1)[0];
  if (["border", "ring", "outline", "divide"].includes(kind)) return ROLE_PREFIXES.border;
  return kind === "text" || kind === "bg" ? ROLE_PREFIXES[kind] : [];
}

export function cssColorPrefixes(property) {
  const name = property.toLowerCase();
  if (name === "color") return ROLE_PREFIXES.text;
  if (name.startsWith("border")) return ROLE_PREFIXES.border;
  if (name.startsWith("background")) return ROLE_PREFIXES.bg;
  return [];
}

const startsWithAny = (name, prefixes) => prefixes.some((prefix) => name.startsWith(prefix));

export function selectColorTokens(names, prefer, rolePrefixes) {
  const prefix = prefer.find((prefix) => names.some((name) => name.startsWith(prefix)));
  if (prefix !== undefined) {
    const preferred = names.filter((name) => name.startsWith(prefix));
    if (preferred.length === 1) return preferred;
  }

  const matching = names.filter((name) => startsWithAny(name, rolePrefixes));
  return [...matching, ...names.filter((name) => !startsWithAny(name, rolePrefixes))];
}

export function recommendColorCandidate(candidates, rolePrefixes) {
  const matching = candidates.filter((candidate) => startsWithAny(candidate, rolePrefixes));
  return matching.length === 1 ? matching[0] : null;
}

/**
 * Tailwind theme.css 같은 팔레트 CSS 에서 --color-* 의 값을 비교용 표기로 읽는다.
 * sRGB 안의 색은 hex 가 되고, 밖의 oklch 는 oklch 표기로 남아 같은 oklch 값과만 맞는다.
 * @param {string} css
 * @returns {Map<string, string>} 토큰 이름 → 비교용 색 표기
 */
export function parsePaletteColors(css) {
  const palette = new Map();
  postcss.parse(css).walkDecls(COLOR_TOKEN, (decl) => {
    const color = normalizeColor(decl.value);
    if (color) palette.set(decl.prop, color);
  });
  return palette;
}
