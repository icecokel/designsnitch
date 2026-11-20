import fs from "node:fs";
import path from "node:path";
import { invalidTokenField, tokenSettings } from "../config.js";
import { parseColorTokenData } from "../core/tokens.js";
import { messages, resolveLang } from "../messages.js";

/**
 * @typedef {object} Tokens
 * @property {Map<string, string[]>} colors 색 값 → 토큰 이름들
 * @property {Set<string>} themed 테마마다 값이 다른 토큰 이름들
 * @property {string[]} prefer 먼저 적용할 토큰 접두어
 */

/** @type {Map<string, { mtimeMs: number, tokens: Omit<Tokens, "prefer"> }>} */
const cache = new Map();

/**
 * settings.designsnitch.tokens 에 적힌 CSS를 읽어 토큰을 돌려준다.
 * 파일이 바뀌지 않았으면 다시 읽지 않는다.
 * @returns {Tokens}
 */
export function loadTokens(settings, cwd) {
  const m = messages(resolveLang(settings?.designsnitch?.lang));
  const tokens = settings?.designsnitch?.tokens;
  const invalidField = invalidTokenField(tokens);
  if (invalidField === "tokens") throw new Error(m.tokensSettingMissing());
  if (invalidField) throw new Error(m.invalidTokenSetting({ field: invalidField }));

  const { file: tokensPath, exclude = [], prefer = [] } = tokenSettings(tokens);
  const file = path.resolve(cwd, settings?.designsnitch?.root ?? ".", tokensPath);
  const key = JSON.stringify([file, exclude]);
  try {
    const { mtimeMs } = fs.statSync(file);
    const cached = cache.get(key);
    if (cached?.mtimeMs === mtimeMs) return { ...cached.tokens, prefer };

    const parsed = parseColorTokenData(fs.readFileSync(file, "utf8"), exclude);
    cache.set(key, { mtimeMs, tokens: parsed });
    return { ...parsed, prefer };
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
