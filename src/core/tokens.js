import postcss from "postcss";
import { normalizeHex } from "./color.js";
import { parseLength } from "./scale.js";

const COLOR_TOKEN = /^--color-/;
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
  /** @type {Map<string, string[]>} 변수 이름 → 선언된 값들 */
  const declared = new Map();
  postcss.parse(css).walkDecls(/^--/, (decl) => {
    const values = declared.get(decl.prop) ?? [];
    values.push(decl.value);
    declared.set(decl.prop, values);
  });

  /** @returns {string[]} 값이 결국 가리키는 hex 색들 */
  function resolve(value, visiting) {
    const color = normalizeHex(value);
    if (color) return [color];

    const reference = VAR_REFERENCE.exec(value.trim());
    if (!reference) return [];
    const [, name, fallback] = reference;
    if (visiting.has(name)) return [];
    if (!declared.has(name)) return fallback ? resolve(fallback, visiting) : [];

    const next = new Set(visiting).add(name);
    return declared.get(name).flatMap((target) => resolve(target, next));
  }

  /** @type {Map<string, Set<string>>} */
  const tokens = new Map();
  for (const [name, values] of declared) {
    if (!COLOR_TOKEN.test(name)) continue;
    for (const color of values.flatMap((value) => resolve(value, new Set([name])))) {
      if (!tokens.has(color)) tokens.set(color, new Set());
      tokens.get(color).add(name);
    }
  }
  return new Map([...tokens].map(([color, names]) => [color, [...names]]));
}

const DEFAULT_SPACING = "0.25rem";
// --text-sm--line-height 같은 부속 값은 제외한다.
const RADIUS_TOKEN = /^--radius-(?!.*--)/;
const TEXT_TOKEN = /^--text-(?!.*--)/;

/**
 * 토큰 CSS에서 간격 단위와 radius, 폰트 크기 토큰을 px 값으로 읽는다.
 * @param {string} css
 * @returns {{ spacingUnit: number, radius: Map<number, string[]>, text: Map<number, string[]> }}
 */
export function parseScaleTokens(css) {
  const scale = {
    spacingUnit: parseLength(DEFAULT_SPACING),
    radius: new Map(),
    text: new Map(),
  };

  postcss.parse(css).walkDecls((decl) => {
    const px = parseLength(decl.value);
    if (px === null) return;

    if (decl.prop === "--spacing") {
      scale.spacingUnit = px;
      return;
    }
    const tokens = RADIUS_TOKEN.test(decl.prop)
      ? scale.radius
      : TEXT_TOKEN.test(decl.prop)
        ? scale.text
        : null;
    if (!tokens) return;
    const names = tokens.get(px) ?? [];
    names.push(decl.prop);
    tokens.set(px, names);
  });
  return scale;
}
