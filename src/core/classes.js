import { parseLength } from "./scale.js";

// 예: bg-[#3B82F6], ring-offset-[#fff]
const ARBITRARY_COLOR =
  /(?<![\w-])([a-z][a-z0-9]*(?:-[a-z0-9]+)*)-\[(#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4}))\]/gi;

/**
 * 문자열에서 hex를 임의 값으로 쓴 Tailwind 클래스를 찾는다.
 * @param {string} text
 * @returns {{ index: number, text: string, utility: string, value: string }[]}
 */
export function findArbitraryColors(text) {
  return [...text.matchAll(ARBITRARY_COLOR)].map((match) => ({
    index: match.index,
    text: match[0],
    utility: match[1],
    value: match[2],
  }));
}

/** 예: ("bg", "--color-primary-500") → "bg-primary-500" */
export function tokenToClass(utility, tokenName) {
  return `${utility}-${tokenName.replace(/^--color-/, "")}`;
}

// 예: p-[16px], rounded-t-[0.375rem]
const ARBITRARY_LENGTH =
  /(?<![\w-])([a-z][a-z0-9]*(?:-[a-z0-9]+)*)-\[(\d*\.?\d+(?:px|rem))\]/gi;

/**
 * 문자열에서 px, rem 길이를 임의 값으로 쓴 Tailwind 클래스를 찾는다.
 * @param {string} text
 * @returns {{ index: number, text: string, utility: string, px: number }[]}
 */
export function findArbitraryLengths(text) {
  return [...text.matchAll(ARBITRARY_LENGTH)].map((match) => ({
    index: match.index,
    text: match[0],
    utility: match[1],
    px: parseLength(match[2]),
  }));
}

const COLOR_UTILITY =
  "bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|divide|fill|stroke|from|via|to|decoration|accent|caret|shadow|placeholder";
const PALETTE_HUE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
// 예: bg-blue-500, border-t-red-50, text-white
const PALETTE_CLASS = new RegExp(
  `(?<![\\w-])(${COLOR_UTILITY})-((?:${PALETTE_HUE})-(?:50|[1-9]00|950)|black|white)(?![\\w-])`,
  "g",
);

/**
 * 문자열에서 Tailwind 기본 팔레트 색을 쓴 클래스를 찾는다.
 * @param {string} text
 * @returns {{ index: number, text: string, utility: string, name: string }[]}
 */
export function findPaletteClasses(text) {
  return [...text.matchAll(PALETTE_CLASS)].map((match) => ({
    index: match.index,
    text: match[0],
    utility: match[1],
    name: match[2],
  }));
}
