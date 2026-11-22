import { messages } from "./messages.js";

/**
 * 검사 결과를 사람이 읽는 글로 만든다.
 * @param {Awaited<ReturnType<typeof import("./check.js").check>>} result
 * @param {"en" | "ko"} [lang]
 */
export function formatText({ designSystem, problems, summary, violations, decisions = [], unchecked }, lang) {
  const m = messages(lang);
  // 첫 줄은 설정에서 무엇을 읽었는지다. 경로를 잘못 적으면 여기서 0개로 드러난다.
  const header = [m.designSystem(designSystem), ...problems.map(m.notice), ""];
  const uncheckedLine = unchecked?.colors > 0 ? [m.unchecked(unchecked)] : [];

  if (violations.length === 0) {
    return [...header, m.noViolations(summary), ...uncheckedLine, ""].join("\n");
  }

  const byFile = new Map();
  for (const violation of violations) {
    const { file } = violation;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(violation);
  }
  const sections = [...byFile].map(([file, items]) =>
    [
      file,
      ...items.map(
        ({ line, column, severity, message, rule }) =>
          `  ${line}:${column}  ${m.severity[severity]}  ${message}  (${rule})`,
      ),
      "",
    ].join("\n"),
  );

  const count = (action) => violations.filter((v) => v.action === action).length;
  return [
    ...header,
    ...sections,
    m.summary(summary),
    m.actions({ replace: count("replace"), migrate: count("migrate"), ask: count("ask"), repair: count("repair"), decisions: decisions.length }),
    ...uncheckedLine,
    "",
  ].join("\n");
}

/**
 * 색 수집 결과를 사람이 읽는 글로 만든다.
 * @param {Awaited<ReturnType<typeof import("./colors.js").collectColors>>} result
 * @param {"en" | "ko"} [lang]
 */
export function formatColorsText({ summary, colors, palette }, lang) {
  const m = messages(lang);
  if (colors.length === 0 && palette.length === 0) return `${m.colorsNone(summary)}\n`;

  const usage = ({ uses, files, utilities, literals, properties = {} }) => {
    const where = Object.entries(utilities).map(([utility, count]) => `${utility} ${count}`);
    if (literals) where.push(m.literals(literals));
    const inCss = Object.values(properties).reduce((sum, count) => sum + count, 0);
    if (inCss) where.push(m.css(inCss));
    return `${m.usage({ uses, files })}  ${where.join(", ")}`;
  };
  // 설정 파일이 있을 때만 tokens 가 붙는다.
  const tokenNote = ({ tokens }) => (tokens === undefined ? "" : `  ${m.tokenNote(tokens)}`);

  const lines = [m.colorsSummary(summary), ""];
  if (colors.length > 0) {
    lines.push(m.hexTitle, ...colors.map((c) => `  ${c.color}  ${usage(c)}${tokenNote(c)}`), "");
  }
  if (palette.length > 0) {
    lines.push(m.paletteTitle, ...palette.map((p) => `  ${p.name}  ${usage(p)}`), "");
  }
  return lines.join("\n");
}
