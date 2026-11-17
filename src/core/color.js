const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * hex 색을 비교할 수 있는 형태(소문자 6자리)로 바꾼다.
 * 알파가 있는 hex(4, 8자리)와 hex가 아닌 값은 null.
 */
export function normalizeHex(value) {
  const hex = value.trim();
  if (!HEX.test(hex)) return null;
  const digits = hex.slice(1).toLowerCase();
  if (digits.length === 6) return `#${digits}`;
  return `#${[...digits].map((d) => d + d).join("")}`;
}
