import fs from "node:fs";
import path from "node:path";

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
 * @returns {{ tokens: string, components?: { path: string, replaces: Record<string, string | string[]> } }}
 */
export function loadConfig(cwd, configPath = CONFIG_FILE) {
  const file = path.resolve(cwd, configPath);

  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(
      `설정 파일이 없습니다: ${file}\n` +
        `다음과 같은 내용으로 만드세요. designsnitch-setup 스킬을 따르면 저장소를 읽어서 만들 수 있습니다.\n${EXAMPLE}`,
    );
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
  if (config.components !== undefined) validateComponents(config.components, file);
  return config;
}

function validateComponents(components, file) {
  if (typeof components?.path !== "string") {
    throw new Error(
      `설정 파일의 "components.path"(디자인 시스템 컴포넌트 경로)가 없습니다: ${file}`,
    );
  }
  if (typeof components.replaces !== "object" || components.replaces === null) {
    throw new Error(
      `설정 파일의 "components.replaces"(raw 태그와 대체 컴포넌트)가 없습니다: ${file}`,
    );
  }
  for (const [tag, value] of Object.entries(components.replaces)) {
    const names = [value].flat();
    if (names.length === 0 || names.some((name) => typeof name !== "string" || name === "")) {
      throw new Error(
        `설정 파일의 "components.replaces.${tag}"는 컴포넌트 이름이거나 이름의 배열이어야 합니다: ${file}`,
      );
    }
  }
}
