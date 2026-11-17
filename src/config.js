import fs from "node:fs";
import path from "node:path";

export const CONFIG_FILE = "designsnitch.config.json";

const EXAMPLE = `{
  "tokens": "./app/globals.css",
  "components": {
    "path": "./components/ui",
    "replaces": { "button": "Button" }
  }
}`;

/**
 * 프로젝트의 설정 파일을 읽는다. 문제가 있으면 무엇을 고쳐야 하는지 담은 Error 를 던진다.
 * @param {string} cwd 프로젝트 디렉터리
 * @param {string} [configPath] cwd 기준 설정 파일 경로
 * @returns {{ tokens: string, components?: { path: string, replaces: Record<string, string> } }}
 */
export function loadConfig(cwd, configPath = CONFIG_FILE) {
  const file = path.resolve(cwd, configPath);

  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(`설정 파일이 없습니다: ${file}\n다음과 같은 내용으로 만드세요.\n${EXAMPLE}`);
  }

  let config;
  try {
    config = JSON.parse(text);
  } catch (error) {
    throw new Error(`설정 파일을 읽을 수 없습니다: ${file}\n${error.message}`);
  }

  if (typeof config?.tokens !== "string") {
    throw new Error(`설정 파일에 "tokens"(토큰 CSS 파일 경로)가 없습니다: ${file}`);
  }
  return config;
}
