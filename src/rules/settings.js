import fs from "node:fs";
import path from "node:path";
import { CONFIG_FILE } from "../config.js";

/** @type {Map<string, { mtimeMs: number, config: Record<string, any> | undefined }>} */
const cache = new Map();

/**
 * 규칙이 쓸 설정. settings.designsnitch 가 있으면 그것을 쓰고,
 * 없으면 작업 디렉터리의 designsnitch.config.json 을 읽는다.
 * JSON 설정 파일은 다른 파일을 불러올 수 없어서(oxlint 의 .oxlintrc.json), 기준을 두 번 적지 않게 한다.
 * @returns {Record<string, any>} settings 와 같은 모양
 */
export function ruleSettings(context) {
  if (context.settings?.designsnitch) return context.settings;
  const config = readConfigFile(path.join(context.cwd, CONFIG_FILE));
  return config ? { ...context.settings, designsnitch: config } : (context.settings ?? {});
}

function readConfigFile(file) {
  let mtimeMs;
  try {
    mtimeMs = fs.statSync(file).mtimeMs;
  } catch {
    return undefined;
  }
  const cached = cache.get(file);
  if (cached?.mtimeMs === mtimeMs) return cached.config;
  let config;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) config = parsed;
  } catch {
    // 읽을 수 없는 설정은 없는 것으로 본다. 규칙이 토큰 설정이 없다고 알린다.
  }
  cache.set(file, { mtimeMs, config });
  return config;
}
