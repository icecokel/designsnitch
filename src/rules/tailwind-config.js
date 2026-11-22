import { createRequire } from "node:module";
import { normalizeColor } from "../core/color.js";

/**
 * @config 로 불러오는 Tailwind JavaScript 설정에서 색을 읽는다. Tailwind v4 의 동작을 따른다.
 * - theme.extend.colors 는 색을 더한다. theme.colors 는 기본 팔레트를 대체한다.
 * - 프리셋(presets)의 색도 같은 방식으로 합친다.
 * - 이 색들은 클래스(bg-brand-500)로만 쓸 수 있다. Tailwind 가 CSS 변수를 만들지 않기 때문이다.
 * 설정 파일을 실행하므로, 그 파일이 require 하는 것이 설치되어 있어야 한다.
 * @param {string} file 설정 파일의 절대 경로
 * @returns {{ colors: Map<string, string>, replacesPalette: boolean }} colors 는 토큰 이름(--color-brand-500) → 비교용 색 표기
 * @throws 설정을 불러오지 못했을 때
 */
export function loadConfigColors(file) {
  const require = createRequire(file);
  const resolved = require.resolve(file);
  // 에디터처럼 오래 떠 있는 프로세스에서도 바뀐 설정을 다시 읽는다. ESM 설정은 Node 가 캐시를 비워 주지 않는다.
  delete require.cache[resolved];
  const loaded = require(resolved);

  let palette = {};
  try {
    const module = require("tailwindcss/colors");
    palette = module.default ?? module;
  } catch {
    // tailwindcss/colors 를 쓰지 않는 설정이면 없어도 된다.
  }

  const result = { colors: new Map(), replacesPalette: false };
  collect(loaded?.default ?? loaded, palette, result);
  return result;
}

function collect(config, palette, result) {
  if (!config || typeof config !== "object") return;
  for (const preset of Array.isArray(config.presets) ? config.presets : []) collect(preset?.default ?? preset, palette, result);

  const section = (value) => {
    if (typeof value !== "function") return value;
    try {
      return value({ colors: palette, theme: () => undefined });
    } catch {
      return undefined;
    }
  };
  const replaced = section(config.theme?.colors);
  if (replaced && typeof replaced === "object") {
    result.replacesPalette = true;
    result.colors.clear();
    flatten(replaced, "--color", result.colors);
  }
  flatten(section(config.theme?.extend?.colors), "--color", result.colors);
}

/** { brand: { DEFAULT: "#f00", 500: "#a00" } } → --color-brand, --color-brand-500 */
function flatten(colors, prefix, out) {
  if (!colors || typeof colors !== "object") return;
  for (const [key, value] of Object.entries(colors)) {
    const name = key === "DEFAULT" ? prefix : `${prefix}-${key}`;
    if (typeof value === "string") {
      const color = normalizeColor(value);
      if (color && name !== "--color") out.set(name, color);
    } else {
      flatten(value, name, out);
    }
  }
}
