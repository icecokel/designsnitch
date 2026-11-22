import { oklchKey } from "./oklch.js";

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION = /^(rgba?|hsla?|oklch)\((.*)\)$/is;
// 문자열 속의 색 값. 예: "#fff", "rgb(1, 2, 3)". a#top, &#39; 같은 것은 색이 아니다.
const COLOR_VALUE =
  /(?<![\w&#])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|(?<![\w-])(?:rgba?|hsla?|oklch)\([^()]*\)/gi;

/**
 * 색 값을 읽는다. 읽을 수 없으면 null.
 * @param {string} value 예: "#3B82F6", "rgb(59 130 246)", "hsl(217, 91%, 60%)", "oklch(55.4% 0.046 257.417)"
 * @returns {{ key: string, alpha: number, opaque: boolean } | null} key 는 비교용 표기. sRGB 색은 소문자 6자리 hex,
 *   sRGB 밖의 oklch 는 표기를 맞춘 oklch(...). opaque 가 false 면 반투명이다
 */
export function parseColor(value) {
  const text = value.trim();
  if (text.startsWith("#")) return parseHex(text);
  // Tailwind 임의 값은 공백 대신 _ 를 쓴다.
  const match = FUNCTION.exec(text.replaceAll("_", " "));
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
 * 문자열에서 색 값(hex 와 rgb(), hsl(), oklch())을 찾는다. 반투명한 색도 찾는다.
 * @param {string} text
 * @returns {{ index: number, text: string, value: string }[]}
 */
export function findColorValues(text) {
  return [...text.matchAll(COLOR_VALUE)]
    .filter((match) => parseColor(match[0]) !== null)
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
