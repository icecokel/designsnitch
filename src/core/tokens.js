import postcss from "postcss";
import { normalizeHex } from "./color.js";
import { parseLength } from "./scale.js";

const COLOR_TOKEN = /^--color-/;

/**
 * 토큰 CSS에서 --color-* 변수를 읽어 "색 값 → 토큰 이름들" 표를 만든다.
 * @param {string} css
 * @returns {Map<string, string[]>}
 */
export function parseColorTokens(css) {
  const tokens = new Map();
  postcss.parse(css).walkDecls(COLOR_TOKEN, (decl) => {
    const color = normalizeHex(decl.value);
    if (!color) return;
    const names = tokens.get(color) ?? [];
    names.push(decl.prop);
    tokens.set(color, names);
  });
  return tokens;
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
