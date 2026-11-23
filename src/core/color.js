import { NAMED_COLORS } from "./named-colors.js";
import { oklchKey } from "./oklch.js";

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION = /^(rgba?|hsla?|oklch)\((.*)\)$/is;
// hex 로 바꾸지 않는 표기. 같은 표기끼리만 맞춘다.
const OTHER_FUNCTION = /^(hwb|lab|lch|oklab|color)\(([^()]*)\)$/is;
// 문자열 속의 색 값. 예: "#fff", "rgb(1, 2, 3)". a#top, &#39; 같은 것은 색이 아니다.
const COLOR_VALUE =
  /(?<![\w&#])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|(?<![\w-])(?:rgba?|hsla?|oklch|hwb|lab|lch|oklab|color)\([^()]*\)/gi;
// 색 이름. var(--red), .red, dark-red, red-500 같은 것은 색 이름이 아니다.
const NAMED_VALUE = new RegExp(
  `(?<![\\w#.$@-])(?:${Object.keys(NAMED_COLORS).sort((a, b) => b.length - a.length).join("|")})(?![\\w(-])`,
  "gi",
);
// 색을 값으로 받는 CSS 속성. 색 이름은 여기서만 색으로 본다.
const COLOR_PROPERTY =
  /^(?:-(?:webkit|moz)-)?(?:color|background(?:-color|-image)?|border(?:-[a-z-]+)?|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration(?:-color)?|text-emphasis(?:-color)?|column-rule(?:-color)?|scrollbar-color|stop-color|flood-color|lighting-color|text-fill-color|text-stroke(?:-color)?|tap-highlight-color)$/;

/** 색을 값으로 받는 CSS 속성인지. backgroundColor 같은 JS 표기도 받는다. */
export function isColorProperty(property) {
  return COLOR_PROPERTY.test(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));
}

/** white, red 같은 CSS 색 이름인지. */
export function isNamedColor(value) {
  return Object.hasOwn(NAMED_COLORS, value.trim().toLowerCase());
}

/**
 * 색 값을 읽는다. 읽을 수 없으면 null.
 * @param {string} value 예: "#3B82F6", "rgb(59 130 246)", "hsl(217, 91%, 60%)", "oklch(55.4% 0.046 257.417)", "white"
 * @returns {{ key: string, alpha: number, opaque: boolean } | null} key 는 비교용 표기. sRGB 색은 소문자 6자리 hex,
 *   sRGB 밖의 oklch 는 표기를 맞춘 oklch(...). opaque 가 false 면 반투명이다
 */
export function parseColor(value) {
  const text = value.trim();
  if (text.startsWith("#")) return parseHex(text);
  // Tailwind 임의 값은 공백 대신 _ 를 쓴다.
  if (isNamedColor(text)) return { key: `#${NAMED_COLORS[text.toLowerCase()]}`, alpha: 1, opaque: true };
  const spaced = text.replaceAll("_", " ");
  const other = OTHER_FUNCTION.exec(spaced);
  if (other) {
    const args = other[2].trim().replace(/\s+/g, " ").toLowerCase();
    return args ? { key: `${other[1].toLowerCase()}(${args})`, alpha: 1, opaque: !args.includes("/") } : null;
  }
  const match = FUNCTION.exec(spaced);
  if (!match) return null;
  const name = match[1].toLowerCase();
  if (name === "oklch") return oklchKey(`oklch(${match[2]})`);

  const parts = match[2].trim().split(/\s*[,/]\s*|\s+/);
  if (parts.length !== 3 && parts.length !== 4) return null;
  const alpha = parts.length === 4 ? unit(parts[3], 1) : 1;
  const rgb = name.startsWith("rgb") ? parts.slice(0, 3).map((part) => unit(part, 255)) : hslToRgb(parts);
  if (alpha === null || !rgb || rgb.some((channel) => channel === null)) return null;
  return { key: `#${rgb.map(toByte).join("")}`, alpha, opaque: alpha >= 1 };
}

/**
 * 색을 세거나 묶을 때 쓰는 이름. 표기가 달라도 같은 색이면 같은 이름이 된다.
 * 불투명한 색은 normalizeColor 와 같고, 반투명한 색은 #rrggbbaa 다. 색이 아니면 소문자로만 맞춘다.
 * @param {string} value
 */
export function colorLabel(value) {
  const color = parseColor(value);
  if (!color) return value.toLowerCase();
  if (color.opaque) return color.key;
  return color.key.startsWith("#") ? `${color.key}${toByte(color.alpha * 255)}` : color.key.replace(")", ` / ${color.alpha})`);
}

/**
 * 색 값을 비교할 수 있는 표기로 바꾼다. 반투명한 색과 색이 아닌 값은 null.
 * @param {string} value
 * @returns {string | null}
 */
export function normalizeColor(value) {
  const color = parseColor(value);
  return color?.opaque ? color.key : null;
}

/**
 * 문자열에서 색 값(hex 와 rgb(), hsl(), oklch() 같은 색 함수)을 찾는다. 반투명한 색도 찾는다.
 * @param {string} text
 * @param {{ named?: boolean }} [options] named 가 true 면 white 같은 색 이름도 찾는다.
 *   색을 값으로 받는 자리에서만 켠다. 일반 문자열에서는 그냥 단어일 수 있다
 * @returns {{ index: number, text: string, value: string }[]}
 */
export function findColorValues(text, { named = false } = {}) {
  const matches = [...text.matchAll(COLOR_VALUE), ...(named ? text.matchAll(NAMED_VALUE) : [])];
  return matches
    .filter((match) => parseColor(match[0]) !== null)
    .sort((a, b) => a.index - b.index)
    .map((match) => ({ index: match.index, text: match[0], value: match[0] }));
}

function parseHex(text) {
  if (!HEX.test(text)) return null;
  let digits = text.slice(1).toLowerCase();
  if (digits.length <= 4) digits = [...digits].map((d) => d + d).join("");
  const alpha = digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1;
  return { key: `#${digits.slice(0, 6)}`, alpha, opaque: alpha >= 1 };
}

/** "50%" → max 의 절반, "128" → 128. 숫자가 아니면 null. */
function unit(text, max) {
  const match = /^(-?[\d.]+)(%?)$/.exec(text);
  if (!match || Number.isNaN(Number(match[1]))) return null;
  const number = Number(match[1]);
  return match[2] ? (number / 100) * max : number;
}

function hslToRgb([hue, saturation, lightness]) {
  const h = /^(-?[\d.]+)(?:deg)?$/i.exec(hue);
  const s = unit(saturation.replace(/%$/, ""), 1);
  const l = unit(lightness.replace(/%$/, ""), 1);
  if (!h || s === null || l === null) return null;
  const [sat, light] = [s / 100, l / 100];
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const sector = (((Number(h[1]) % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const [r, g, b] = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ][Math.floor(sector) % 6];
  const m = light - chroma / 2;
  return [r, g, b].map((channel) => (channel + m) * 255);
}

const toByte = (channel) =>
  Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, "0");
