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

/**
 * 프로젝트의 설정 파일을 읽는다. 문제가 있으면 무엇을 고쳐야 하는지 담은 Error 를 던진다.
 * @param {string} cwd 프로젝트 디렉터리
 * @param {string} [configPath] cwd 기준 설정 파일 경로
 * @param {"en" | "ko"} [lang] 오류 문장의 언어
 * @returns {{ tokens: string, lang?: "en" | "ko", components?: { path: string, replaces: Record<string, string | string[]> } }}
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

  if (typeof config?.tokens !== "string") throw new Error(m.configNoTokens({ file }));
  if (config.lang !== undefined && !isLang(config.lang)) throw new Error(m.configBadLang({ file }));
  if (config.components !== undefined) validateComponents(config.components, file, m);
  return config;
}

function validateComponents(components, file, m) {
  if (typeof components?.path !== "string") throw new Error(m.configNoComponentsPath({ file }));
  if (typeof components.replaces !== "object" || components.replaces === null) {
    throw new Error(m.configNoReplaces({ file }));
  }
  for (const [tag, value] of Object.entries(components.replaces)) {
    const names = [value].flat();
    if (names.length === 0 || names.some((name) => typeof name !== "string" || name === "")) {
      throw new Error(m.configBadReplace({ tag, file }));
    }
  }
}
