const LENGTH = /^(\d*\.?\d+)(px|rem)$/;
const ROOT_FONT_SIZE = 16;

const SPACING_UTILITY = /^(?:[pm][xytrblse]?|gap(?:-[xy])?|space-[xy])$/;
const RADIUS_UTILITY = /^rounded(?:-(?:[trblse]|tl|tr|br|bl|ss|se|ee|es))?$/;

const round = (n) => Math.round(n * 1e4) / 1e4;

/**
 * px, rem 길이를 px 숫자로 바꾼다. 다른 단위나 식은 null.
 */
export function parseLength(value) {
  const match = LENGTH.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  return round(match[2] === "rem" ? amount * ROOT_FONT_SIZE : amount);
}

/**
 * 임의 값으로 쓴 길이가 스케일에 있는지 본다.
 * - 있으면 { kind, exact: [대신 쓸 클래스] }
 * - 없으면 { kind, nearest: [{ className, px }] } (바로 아래, 바로 위)
 * - 검사 대상이 아니거나 비교할 토큰이 없으면 null
 *
 * @param {string} utility 예: "p", "rounded-t", "text"
 * @param {number} px
 * @param {{ spacingUnit: number, radius: Map<number, string[]>, text: Map<number, string[]> }} scale
 */
export function matchScale(utility, px, scale) {
  if (SPACING_UTILITY.test(utility)) {
    return { kind: "spacing", ...matchSpacing(utility, px, scale.spacingUnit) };
  }
  if (RADIUS_UTILITY.test(utility) && scale.radius.size > 0) {
    return { kind: "radius", ...matchTokens(utility, px, scale.radius, "--radius-") };
  }
  if (utility === "text" && scale.text.size > 0) {
    return { kind: "text", ...matchTokens(utility, px, scale.text, "--text-") };
  }
  return null;
}

// 간격은 단위의 0.5배수까지를 스케일로 본다 (p-0.5, p-1.5, p-4 ...). 1px 는 p-px.
function matchSpacing(utility, px, unit) {
  const halfSteps = round((px / unit) * 2);
  if (Number.isInteger(halfSteps)) return { exact: [`${utility}-${halfSteps / 2}`] };
  if (px === 1) return { exact: [`${utility}-px`] };

  const lower = Math.floor(halfSteps) / 2;
  return {
    nearest: [lower, lower + 0.5].map((steps) => ({
      className: `${utility}-${steps}`,
      px: round(steps * unit),
    })),
  };
}

function matchTokens(utility, px, tokens, prefix) {
  const toClass = (name) => `${utility}-${name.slice(prefix.length)}`;

  const names = tokens.get(px);
  if (names) return { exact: names.map(toClass) };

  const values = [...tokens.keys()].sort((a, b) => a - b);
  const below = values.findLast((value) => value < px);
  const above = values.find((value) => value > px);
  return {
    nearest: [below, above]
      .filter((value) => value !== undefined)
      .map((value) => ({ className: toClass(tokens.get(value)[0]), px: value })),
  };
}
