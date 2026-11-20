import fs from "node:fs";
import path from "node:path";
import { parseColorTokens } from "../core/tokens.js";
import { messages, resolveLang } from "../messages.js";

/**
 * @typedef {object} Tokens
 * @property {Map<string, string[]>} colors 색 값 → 토큰 이름들
 */

/** @type {Map<string, { mtimeMs: number, tokens: Tokens }>} */
const cache = new Map();

/**
 * settings.designsnitch.tokens 에 적힌 CSS를 읽어 토큰을 돌려준다.
 * 파일이 바뀌지 않았으면 다시 읽지 않는다.
 * @returns {Tokens}
 */
export function loadTokens(settings, cwd) {
  const m = messages(resolveLang(settings?.designsnitch?.lang));
  const tokensPath = settings?.designsnitch?.tokens;
  if (typeof tokensPath !== "string") throw new Error(m.tokensSettingMissing());

  const file = path.resolve(cwd, tokensPath);
  try {
    const { mtimeMs } = fs.statSync(file);
    const cached = cache.get(file);
    if (cached?.mtimeMs === mtimeMs) return cached.tokens;

    const tokens = { colors: parseColorTokens(fs.readFileSync(file, "utf8")) };
    cache.set(file, { mtimeMs, tokens });
    return tokens;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      throw new Error(m.tokensFileMissing({ file }));
    }
    // 기준이 되는 파일이 깨져 있으면 무엇도 판정할 수 없다. 어디가 깨졌는지 알려준다.
    throw new Error(
      m.tokensUnreadable({
        file,
        line: error.line ?? 1,
        column: error.column ?? 1,
        reason: error.reason ?? error.message,
      }),
    );
  }
}
