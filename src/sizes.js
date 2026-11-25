import fs from "node:fs";
import path from "node:path";
import { findArbitrarySizes, findCssSizes, findLengths, parseLength, sizePropertyKind } from "./core/size.js";
import { createEngine } from "./engine.js";
import { splitPaths } from "./files.js";
import { visitStrings } from "./rules/visit-strings.js";
import { mergeVisitors, styleProperty } from "./rules/visit-style.js";

const RULE_ID = "designsnitch-internal/collect-sizes";
const MAX_EXAMPLES = 3;
const GROUP = { fontSize: "fontSizes", radius: "radii", spacing: "spacing" };

// 위반을 보고하는 규칙이 아니라, 찾은 크기를 메시지에 실어 내보내는 수집용 규칙이다.
const collectRule = {
  meta: { type: "suggestion", schema: [], messages: { found: "{{payload}}" } },
  create(context) {
    const { sourceCode } = context;
    const report = (loc, payload) =>
      context.report({ loc, messageId: "found", data: { payload: JSON.stringify(payload) } });
    return mergeVisitors(
      visitStrings(context, findArbitrarySizes, (found, { loc }) =>
        report(loc, { kind: found.kind, value: found.value, where: "class" }),
      ),
      {
        Literal(node) {
          const property = styleProperty(node, sourceCode);
          const kind = property && sizePropertyKind(property);
          if (!kind) return;
          // React 는 숫자를 px 로 쓴다.
          if (typeof node.value === "number") {
            if (parseLength(`${node.value}px`)) report(node.loc, { kind, value: `${node.value}px`, where: "style" });
          } else if (typeof node.value === "string") {
            for (const length of findLengths(node.value)) report(node.loc, { kind, value: length.text, where: "style" });
          }
        },
      },
    );
  },
};

/**
 * @typedef {object} SizeUse
 * @property {string} value 예: "14px", "0.875rem"
 * @property {number} uses 쓰인 횟수
 * @property {number} files 쓰인 파일 수
 * @property {{ class: number, style: number, css: number }} where 클래스, 인라인 스타일, CSS 선언별 횟수
 * @property {string[]} [tokens] 같은 값의 토큰. 설정 파일이 있을 때만 붙는다. 간격에는 없다
 * @property {{ file: string, line: number }[]} examples 파일이 서로 다른 위치 몇 개
 */

/**
 * 코드가 직접 쓴 글자 크기, radius, 간격을 모은다. 설정 파일이 없어도 동작한다.
 * 위반을 판정하지 않는다. 무엇을 기준으로 삼을지 정할 때 보는 현황이다.
 * @param {object} options
 * @param {string} options.cwd
 * @param {string[]} [options.paths]
 * @param {ReturnType<typeof import("./core/size.js").parseSizeTokens>} [options.tokens] 주면 값마다 tokens 를 붙인다
 * @param {Set<string>} [options.tokenFiles] 토큰을 정의하는 파일들. JS 설정은 통째로 건너뛴다
 * @returns {Promise<{ summary: { files: number, fontSizes: number, radii: number, spacing: number, uses: number }, fontSizes: SizeUse[], radii: SizeUse[], spacing: SizeUse[] }>}
 *   종류마다 많이 쓰인 순서
 */
export async function collectSizes({ cwd, paths = ["."], tokens, tokenFiles }) {
  const eslint = createEngine({
    cwd,
    allowInlineConfig: false,
    config: {
      plugins: { "designsnitch-internal": { rules: { "collect-sizes": collectRule } } },
      rules: { [RULE_ID]: "warn" },
    },
  });
  const { scriptPaths, cssFiles } = splitPaths(cwd, paths);
  const results = scriptPaths.length > 0 ? await eslint.lintFiles(scriptPaths) : [];

  /** @type {{ file: string, line: number, kind: "fontSize" | "radius" | "spacing", value: string, where: "class" | "style" | "css" }[]} */
  const uses = [];
  for (const result of results) {
    if (tokenFiles?.has(fs.realpathSync(result.filePath))) continue;
    const file = path.relative(cwd, result.filePath).split(path.sep).join("/");
    for (const message of result.messages) {
      if (message.ruleId === RULE_ID) uses.push({ file, line: message.line, ...JSON.parse(message.message) });
    }
  }
  for (const file of cssFiles) {
    let found;
    try {
      found = findCssSizes(fs.readFileSync(path.resolve(cwd, file), "utf8"));
    } catch {
      continue; // 읽지 못한 CSS 는 건너뛴다
    }
    for (const { line, value, kind, utility } of found) {
      uses.push({ file, line, kind, value, where: utility ? "class" : "css" });
    }
  }
  uses.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  /** @type {Record<string, Map<string, any>>} */
  const groups = { fontSizes: new Map(), radii: new Map(), spacing: new Map() };
  for (const { file, line, kind, value, where } of uses) {
    const length = parseLength(value);
    const group = groups[GROUP[kind]];
    if (!group.has(length.text)) {
      group.set(length.text, { px: length.px, uses: 0, fileSet: new Set(), where: { class: 0, style: 0, css: 0 }, examples: [] });
    }
    const entry = group.get(length.text);
    entry.uses += 1;
    entry.where[where] += 1;
    if (!entry.fileSet.has(file)) {
      entry.fileSet.add(file);
      if (entry.examples.length < MAX_EXAMPLES) entry.examples.push({ file, line });
    }
  }

  const list = (group, sizeTokens) =>
    [...group]
      .sort(([a, x], [b, y]) => y.uses - x.uses || x.px - y.px || a.localeCompare(b))
      .map(([value, entry]) => ({
        value,
        uses: entry.uses,
        files: entry.fileSet.size,
        where: entry.where,
        ...(sizeTokens ? { tokens: (sizeTokens.byPx.get(entry.px) ?? []).map((token) => token.name) } : {}),
        examples: entry.examples,
      }));
  const fontSizes = list(groups.fontSizes, tokens?.fontSize);
  const radii = list(groups.radii, tokens?.radius);
  const spacing = list(groups.spacing);

  return {
    summary: {
      files: results.length + cssFiles.length,
      fontSizes: fontSizes.length,
      radii: radii.length,
      spacing: spacing.length,
      uses: uses.length,
    },
    fontSizes,
    radii,
    spacing,
  };
}
