// oklch(L C H) → sRGB hex. 공식은 CSS Color 4 의 OKLab 정의를 따른다.
const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.]+%?\s*)?\)$/i;
// 반올림 오차로 범위를 조금 넘는 것은 sRGB 안으로 본다.
const EPSILON = 0.0005;

/**
 * oklch 색을 sRGB hex(소문자 6자리)로 바꾼다. sRGB 밖의 색이거나 oklch 가 아니면 null.
 * @param {string} value
 * @returns {string | null}
 */
export function oklchToHex(value) {
  const match = OKLCH.exec(value.trim());
  if (!match) return null;
  const L = Number(match[1]) / (match[2] ? 100 : 1);
  const C = Number(match[3]);
  const h = (Number(match[4]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  if (linear.some((c) => c < -EPSILON || c > 1 + EPSILON)) return null;

  const toByte = (c) => {
    const v = Math.min(1, Math.max(0, c));
    const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255).toString(16).padStart(2, "0");
  };
  return `#${linear.map(toByte).join("")}`;
}
