import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { invalidTokenField, tokenSettings } from "../config.js";
import { parseColorTokenData, parsePaletteColors } from "../core/tokens.js";
import { messages, resolveLang } from "../messages.js";

/**
 * @typedef {object} Tokens
 * @property {Map<string, string[]>} colors 색 값 → 토큰 이름들
 * @property {Set<string>} themed 테마마다 값이 다른 토큰 이름들
 * @property {string[]} prefer 먼저 적용할 토큰 접두어
 * @property {Set<string>} paletteNames 기본 팔레트에서 온 토큰 이름들. palette 설정이 없으면 비어 있다
 */

/** @type {Map<string, { mtimeMs: number, tokens: Pick<Tokens, "colors" | "themed"> }>} */
const cache = new Map();
/** @type {Map<string, { mtimeMs: number, palette: Map<string, string> }>} */
const paletteCache = new Map();

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
  const root = path.resolve(cwd, settings?.designsnitch?.root ?? ".");
  const file = path.resolve(root, tokensPath);
  const project = readProjectTokens(file, exclude, m);
  if (settings?.designsnitch?.palette !== "tailwind") return { ...project, prefer, paletteNames: new Set() };
  return { ...withPalette(project, readTailwindPalette(file, m), exclude), prefer };
}

function readProjectTokens(file, exclude, m) {
  const key = JSON.stringify([file, exclude]);
  try {
    const { mtimeMs } = fs.statSync(file);
    const cached = cache.get(key);
    if (cached?.mtimeMs === mtimeMs) return cached.tokens;

    const parsed = parseColorTokenData(fs.readFileSync(file, "utf8"), exclude);
    cache.set(key, { mtimeMs, tokens: parsed });
    return parsed;
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

/**
 * 프로젝트에 설치된 tailwindcss 의 theme.css 에서 기본 팔레트를 읽는다.
 * 토큰 CSS 가 tailwindcss 를 불러오는 파일이므로, 그 위치에서 찾는다.
 */
function readTailwindPalette(tokensFile, m) {
  const require = createRequire(tokensFile);
  let file;
  try {
    file = require.resolve("tailwindcss/theme.css");
  } catch {
    // v3 에는 theme.css 가 없다. 설치가 안 된 것과 구분해서 알린다.
    const version = installedVersion(require);
    if (version && !version.startsWith("4.")) throw new Error(m.paletteNeedsV4({ version }));
    throw new Error(m.paletteMissing({ root: path.dirname(tokensFile) }));
  }
  const { mtimeMs } = fs.statSync(file);
  const cached = paletteCache.get(file);
  if (cached?.mtimeMs === mtimeMs) return cached.palette;
  const palette = parsePaletteColors(fs.readFileSync(file, "utf8"));
  paletteCache.set(file, { mtimeMs, palette });
  return palette;
}

/**
 * 프로젝트 토큰 뒤에 팔레트 색을 더한다. 프로젝트가 같은 이름을 정의했거나 exclude 에 걸린 색은 뺀다.
 * @param {Pick<Tokens, "colors" | "themed">} project
 * @param {Map<string, string>} palette
 * @param {string[]} exclude
 */
function withPalette(project, palette, exclude) {
  const own = new Set([...project.colors.values()].flat());
  const excluded = (name) => exclude.some((p) => (p.endsWith("*") ? name.startsWith(p.slice(0, -1)) : name === p));
  const colors = new Map([...project.colors].map(([hex, names]) => [hex, [...names]]));
  const paletteNames = new Set();
  for (const [name, hex] of palette) {
    if (own.has(name) || excluded(name)) continue;
    paletteNames.add(name);
    colors.set(hex, [...(colors.get(hex) ?? []), name]);
  }
  return { colors, themed: project.themed, paletteNames };
}

function installedVersion(require) {
  try {
    return JSON.parse(fs.readFileSync(require.resolve("tailwindcss/package.json"), "utf8")).version;
  } catch {
    return null;
  }
}
