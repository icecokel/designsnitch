import fs from "node:fs";
import path from "node:path";
import { isLang, messages } from "./messages.js";

export const CONFIG_FILE = "designsnitch.config.json";

const EXAMPLE = `{
  "tokens": "./app/globals.css",
  "components": {
    "path": "./components/ui",
    "replaces": { "button": "Button", "input": ["Input", "SearchInput"] }
  }
}`;

/** @typedef {string | string[] | { component: string | string[], when?: Record<string, (string | null)[]> }} Replacement */
/** @typedef {string | { file: string, exclude?: string[], prefer?: string[] }} TokenSettings */

/** @param {TokenSettings} tokens */
export function tokenSettings(tokens) {
  return typeof tokens === "string" ? { file: tokens } : tokens;
}

export function invalidTokenField(tokens) {
  if (typeof tokens === "string") return tokens.length > 0 ? null : "tokens";
  if (!isRecord(tokens)) return "tokens";
  if (typeof tokens.file !== "string" || tokens.file.length === 0) return "tokens.file";
  if (tokens.exclude !== undefined && !isPatternList(tokens.exclude, /^[^*]*\*?$/)) return "tokens.exclude";
  if (tokens.prefer !== undefined && !isPatternList(tokens.prefer, /^[^*]+$/)) return "tokens.prefer";
  return null;
}

function isPatternList(values, pattern) {
  return Array.isArray(values) &&
    values.every((value) => typeof value === "string" && value.length > 0 && pattern.test(value));
}

/** @param {Replacement} [replacement] */
export function replacementNames(replacement) {
  const component = typeof replacement === "string" || Array.isArray(replacement)
    ? replacement
    : replacement?.component;
  return [component ?? []].flat();
}

/**
 * 프로젝트의 설정 파일을 읽는다. 문제가 있으면 무엇을 고쳐야 하는지 담은 Error 를 던진다.
 * @param {string} cwd 프로젝트 디렉터리
 * @param {string} [configPath] cwd 기준 설정 파일 경로
 * @param {"en" | "ko"} [lang] 오류 문장의 언어
 * @returns {{ tokens: TokenSettings, root: string, lang?: "en" | "ko", components?: { path: string, replaces: Record<string, Replacement> } }}
 */
export function loadConfig(cwd, configPath = CONFIG_FILE, lang) {
  const m = messages(lang);
  const file = path.resolve(cwd, configPath);

  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(m.configMissing({ file, example: EXAMPLE }));
  }

  let config;
  try {
    config = JSON.parse(text);
  } catch (error) {
    throw new Error(m.configUnreadable({ file, reason: error.message }));
  }

  const tokenField = invalidTokenField(config?.tokens);
  if (tokenField === "tokens") throw new Error(m.configNoTokens({ file }));
  if (tokenField) throw new Error(m.invalidTokenSetting({ field: tokenField, file }));
  if (config.lang !== undefined && !isLang(config.lang)) throw new Error(m.configBadLang({ file }));
  if (config.components !== undefined) validateComponents(config.components, file, m);
  return { ...config, root: path.dirname(file) };
}

function validateComponents(components, file, m) {
  if (typeof components?.path !== "string") throw new Error(m.configNoComponentsPath({ file }));
  if (!isRecord(components.replaces)) {
    throw new Error(m.configNoReplaces({ file }));
  }
  for (const [tag, value] of Object.entries(components.replaces)) {
    const conditional = isRecord(value);
    const names = replacementNames(value);
    if (names.length === 0 || names.some((name) => typeof name !== "string" || name === "")) {
      throw new Error(conditional ? m.configBadReplaceComponent({ tag, file }) : m.configBadReplace({ tag, file }));
    }

    if (!conditional || value.when === undefined) continue;
    if (!isRecord(value.when)) throw new Error(m.configBadWhen({ tag, file }));
    for (const [attribute, allowed] of Object.entries(value.when)) {
      if (!Array.isArray(allowed) || allowed.some((entry) => entry !== null && typeof entry !== "string")) {
        throw new Error(m.configBadWhenValues({ tag, attribute, file }));
      }
    }
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
