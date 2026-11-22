// oklch(L C H) → sRGB hex. 공식은 CSS Color 4 의 OKLab 정의를 따른다.
// 값 대신 none 을 쓸 수 있다(CSS Color 4). Tailwind 4.3.5 부터 회색의 색상(hue)을 none 으로 적는다.
const OKLCH =
  /^oklch\(\s*([\d.]+|none)(%?)\s+([\d.]+|none)\s+([\d.]+|none)(?:deg)?\s*(?:\/\s*([\d.]+%?|none)\s*)?\)$/i;
// none 은 계산할 때 0 으로 본다.
const num = (text) => (text.toLowerCase() === "none" ? 0 : Number(text));
// 반올림 오차로 범위를 조금 넘는 것은 sRGB 안으로 본다.
const EPSILON = 0.0005;
const round = (number, digits) => Number(number.toFixed(digits));

/**
 * oklch 색을 비교용 표기로 읽는다. oklch 가 아니면 null.
 * @param {string} value
 * @returns {{ key: string, alpha: number, opaque: boolean } | null} key 는 sRGB 안이면 소문자 6자리 hex,
 *   밖이면 자릿수를 맞춘 "oklch(L C H)". 같은 색을 내는 hex 가 없기 때문이다
 */
export function oklchKey(value) {
  const match = OKLCH.exec(value.trim());
  if (!match) return null;
  const L = num(match[1]) / (match[2] ? 100 : 1);
  const C = num(match[3]);
  const H = num(match[4]);
  const alpha = match[5] === undefined ? 1 : match[5].endsWith("%") ? Number(match[5].slice(0, -1)) / 100 : num(match[5]);
  const h = (H * Math.PI) / 180;
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
  const opaque = alpha >= 1;
  if (linear.some((c) => c < -EPSILON || c > 1 + EPSILON)) {
    const hue = C === 0 ? 0 : round(((H % 360) + 360) % 360, 3);
    return { key: `oklch(${round(L, 4)} ${round(C, 4)} ${hue})`, alpha, opaque };
  }

  const toByte = (c) => {
    const v = Math.min(1, Math.max(0, c));
    const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255).toString(16).padStart(2, "0");
  };
  return { key: `#${linear.map(toByte).join("")}`, alpha, opaque };
}

/**
 * oklch 색을 sRGB hex(소문자 6자리)로 바꾼다. sRGB 밖의 색이거나 oklch 가 아니면 null.
 * @param {string} value
 * @returns {string | null}
 */
export function oklchToHex(value) {
  const color = oklchKey(value);
  return color?.opaque && color.key.startsWith("#") ? color.key : null;
}
