import fs from "node:fs";
import path from "node:path";
import { parseColorTokens, parseScaleTokens } from "../core/tokens.js";

/**
 * @typedef {object} Tokens
 * @property {Map<string, string[]>} colors 색 값 → 토큰 이름들
 * @property {ReturnType<typeof parseScaleTokens>} scale 간격 단위, radius, 폰트 크기 토큰
 */

/** @type {Map<string, { mtimeMs: number, tokens: Tokens }>} */
const cache = new Map();

/**
 * settings.designsnitch.tokens 에 적힌 CSS를 읽어 토큰을 돌려준다.
 * 파일이 바뀌지 않았으면 다시 읽지 않는다.
 * @returns {Tokens}
 */
export function loadTokens(settings, cwd) {
  const tokensPath = settings?.designsnitch?.tokens;
  if (typeof tokensPath !== "string") {
    throw new Error(
      "designsnitch: settings.designsnitch.tokens 에 토큰 CSS 파일 경로를 설정하세요.",
    );
  }

  const file = path.resolve(cwd, tokensPath);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    throw new Error(`designsnitch: 토큰 CSS 파일을 찾을 수 없습니다: ${file}`);
  }

  const cached = cache.get(file);
  if (cached?.mtimeMs === stat.mtimeMs) return cached.tokens;

  const css = fs.readFileSync(file, "utf8");
  const tokens = { colors: parseColorTokens(css), scale: parseScaleTokens(css) };
  cache.set(file, { mtimeMs: stat.mtimeMs, tokens });
  return tokens;
}
