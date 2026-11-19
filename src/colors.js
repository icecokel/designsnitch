import fs from "node:fs";
import path from "node:path";
import { findArbitraryColors, findPaletteClasses } from "./core/classes.js";
import { normalizeHex } from "./core/color.js";
import { findCssColors } from "./core/css.js";
import { createEngine } from "./engine.js";
import { splitPaths } from "./files.js";
import { visitStrings } from "./rules/visit-strings.js";

const RULE_ID = "designsnitch-internal/collect-colors";
const HEX_LITERAL = /^#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})$/i;
const MAX_EXAMPLES = 3;

// 알파가 붙은 hex 는 6자리로 펼칠 수 없으니 소문자로만 맞춘다.
const colorKey = (hex) => normalizeHex(hex) ?? hex.toLowerCase();

const findColors = (text) => [
  ...findArbitraryColors(text).map((found) => ({
    ...found,
    payload: { kind: "hex", key: colorKey(found.value), utility: found.utility },
  })),
  ...findPaletteClasses(text).map((found) => ({
    ...found,
    payload: { kind: "palette", key: found.name, utility: found.utility },
  })),
];

// 위반을 보고하는 규칙이 아니라, 찾은 색을 메시지에 실어 내보내는 수집용 규칙이다.
const collectRule = {
  meta: { type: "suggestion", schema: [], messages: { found: "{{payload}}" } },
  create(context) {
    const report = (loc, payload) =>
      context.report({ loc, messageId: "found", data: { payload: JSON.stringify(payload) } });
    const visitor = visitStrings(context, findColors, (found, { loc }) => report(loc, found.payload));

    return {
      ...visitor,
      Literal(node) {
        // 문자열 전체가 hex 색인 경우. 예: style={{ color: "#3B82F6" }}
        if (typeof node.value === "string" && HEX_LITERAL.test(node.value)) {
          report(node.loc, { kind: "hex", key: colorKey(node.value), utility: null });
          return;
        }
        visitor.Literal(node);
      },
    };
  },
};

/**
 * @typedef {object} ColorUse
 * @property {number} uses 쓰인 횟수
 * @property {number} files 쓰인 파일 수
 * @property {Record<string, number>} utilities Tailwind 유틸리티별 횟수. 예: { bg: 3, text: 1 }
 * @property {{ file: string, line: number }[]} examples 파일이 서로 다른 위치 몇 개
 */

/**
 * 코드에서 쓰는 색을 모은다. 설정 파일이 없어도 동작한다.
 * @param {object} options
 * @param {string} options.cwd 프로젝트 디렉터리
 * @param {string[]} [options.paths] 검사할 파일이나 디렉터리 (cwd 기준)
 * @param {Map<string, string[]>} [options.tokens] 색 값 → 토큰 이름들. 주면 색마다 tokens 를 붙인다
 * @returns {Promise<{
 *   summary: { files: number, colors: number, paletteColors: number, uses: number },
 *   colors: (ColorUse & { color: string, literals: number, properties: Record<string, number>, tokens?: string[] })[],
 *   palette: (ColorUse & { name: string })[],
 * }>} colors 는 hex 색, palette 는 Tailwind 기본 팔레트 색. 둘 다 많이 쓰인 순서.
 *   literals 는 문자열 전체가 hex 인 곳의 수, properties 는 CSS 속성별 횟수
 */
export async function collectColors({ cwd, paths = ["."], tokens }) {
  const eslint = createEngine({
    cwd,
    // 수집이 목적이므로 eslint-disable 주석이 있어도 빠뜨리지 않는다.
    allowInlineConfig: false,
    config: {
      plugins: { "designsnitch-internal": { rules: { "collect-colors": collectRule } } },
      rules: { [RULE_ID]: "warn" },
    },
  });

  const { scriptPaths, cssFiles } = splitPaths(cwd, paths);
  const results = scriptPaths.length > 0 ? await eslint.lintFiles(scriptPaths) : [];

  /** @type {{ file: string, line: number, kind: "hex" | "palette", key: string, utility?: string | null, prop?: string }[]} */
  const uses = [];
  for (const result of results) {
    const file = path.relative(cwd, result.filePath).split(path.sep).join("/");
    for (const message of result.messages) {
      if (message.ruleId !== RULE_ID) continue;
      uses.push({ file, line: message.line, ...JSON.parse(message.message) });
    }
  }
  for (const file of cssFiles) {
    let found;
    try {
      found = findCssColors(fs.readFileSync(path.resolve(cwd, file), "utf8"));
    } catch {
      continue; // 읽지 못한 CSS 는 건너뛴다
    }
    for (const { line, value, prop } of found) {
      uses.push({ file, line, kind: "hex", key: colorKey(value), prop });
    }
  }
  uses.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  const groups = { hex: new Map(), palette: new Map() };
  for (const { file, line, kind, key, utility, prop } of uses) {
    const entry = getOrCreate(groups[kind], key);
    entry.uses += 1;
    if (prop) entry.properties[prop] = (entry.properties[prop] ?? 0) + 1;
    else if (utility) entry.utilities[utility] = (entry.utilities[utility] ?? 0) + 1;
    else entry.literals += 1;
    if (!entry.fileSet.has(file)) {
      entry.fileSet.add(file);
      if (entry.examples.length < MAX_EXAMPLES) entry.examples.push({ file, line });
    }
  }

  const colors = sorted(groups.hex).map(([color, entry]) => ({
    color,
    uses: entry.uses,
    files: entry.fileSet.size,
    utilities: entry.utilities,
    literals: entry.literals,
    properties: entry.properties,
    ...(tokens ? { tokens: tokens.get(color) ?? [] } : {}),
    examples: entry.examples,
  }));
  // 프로젝트가 --color-blue-500 처럼 같은 이름의 토큰을 정의했으면 그 클래스는 프로젝트 토큰이다.
  const tokenClassNames = new Set(
    [...(tokens?.values() ?? [])].flat().map((name) => name.replace(/^--color-/, "")),
  );
  const palette = sorted(groups.palette)
    .filter(([name]) => !tokenClassNames.has(name))
    .map(([name, entry]) => ({
      name,
      uses: entry.uses,
      files: entry.fileSet.size,
      utilities: entry.utilities,
      examples: entry.examples,
    }));

  return {
    summary: {
      files: results.length + cssFiles.length,
      colors: colors.length,
      paletteColors: palette.length,
      uses: [...colors, ...palette].reduce((sum, item) => sum + item.uses, 0),
    },
    colors,
    palette,
  };
}

function getOrCreate(map, key) {
  if (!map.has(key)) {
    map.set(key, { uses: 0, fileSet: new Set(), utilities: {}, literals: 0, properties: {}, examples: [] });
  }
  return map.get(key);
}

// 많이 쓰인 순서, 같으면 이름 순서
function sorted(map) {
  return [...map].sort(([a, x], [b, y]) => y.uses - x.uses || a.localeCompare(b));
}
