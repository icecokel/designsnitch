import postcss from "postcss";
import { normalizeHex } from "./color.js";
import { oklchToHex } from "./oklch.js";

const COLOR_TOKEN = /^--color-/;
const ROLE_PREFIXES = {
  text: ["--color-text-"],
  border: ["--color-border-"],
  bg: ["--color-bg-", "--color-surface", "--color-background"],
};
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
 * @returns {{ colors: Map<string, string[]>, themed: Set<string> }}
 */
export function parseColorTokenData(css, exclude = []) {
  /** @type {Map<string, string[]>} 변수 이름 → 선언된 값들 */
  const declared = new Map();
  postcss.parse(css).walkDecls(/^--/, (decl) => {
    const values = declared.get(decl.prop) ?? [];
    values.push(decl.value);
    declared.set(decl.prop, values);
  });

  /** @returns {string[]} 값이 결국 가리키는 값들 */
  function resolve(value, visiting) {
    const trimmed = value.trim();
    const reference = VAR_REFERENCE.exec(trimmed);
    if (!reference) return [trimmed];
    const [, name, fallback] = reference;
    if (visiting.has(name)) return [];
    if (!declared.has(name)) return fallback ? resolve(fallback, visiting) : [];

    const next = new Set(visiting).add(name);
    return declared.get(name).flatMap((target) => resolve(target, next));
  }

  const colors = new Map();
  const themed = new Set();
  for (const [name, values] of declared) {
    if (!COLOR_TOKEN.test(name)) continue;
    if (exclude.some((pattern) => pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern)) continue;
    const resolved = new Set();
    for (const value of values.flatMap((value) => resolve(value, new Set([name])))) {
      const color = normalizeHex(value);
      // hex 가 아닌 값도 테마 차이는 만들 수 있지만 색 후보로는 쓰지 않는다.
      const key = color ?? value;
      if (resolved.has(key)) continue;
      resolved.add(key);
      if (!color) continue;
      if (!colors.has(color)) colors.set(color, []);
      colors.get(color).push(name);
    }
    if (resolved.size > 1) themed.add(name);
  }
  return { colors, themed };
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
 * Tailwind theme.css 같은 팔레트 CSS 에서 --color-* 의 값을 hex 로 읽는다.
 * oklch 는 sRGB 안에 있을 때만 hex 로 바꾼다. 밖이면 hex 와 비교할 수 없으니 뺀다.
 * @param {string} css
 * @returns {Map<string, string>} 토큰 이름 → hex
 */
export function parsePaletteColors(css) {
  const palette = new Map();
  postcss.parse(css).walkDecls(COLOR_TOKEN, (decl) => {
    const hex = normalizeHex(decl.value) ?? oklchToHex(decl.value);
    if (hex) palette.set(decl.prop, hex);
  });
  return palette;
}
