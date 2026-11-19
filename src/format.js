const SEVERITY_LABELS = { error: "오류", warning: "경고" };

/**
 * 검사 결과를 사람이 읽는 글로 만든다.
 * @param {Awaited<ReturnType<typeof import("./check.js").check>>} result
 */
export function formatText({ designSystem, problems, summary, violations }) {
  const header = [
    describe(designSystem),
    ...problems.map((problem) => `주의: ${problem}`),
    "",
  ];

  if (violations.length === 0) {
    return [...header, `위반이 없습니다. (파일 ${summary.files}개 검사)`, ""].join("\n");
  }

  const byFile = Map.groupBy(violations, (violation) => violation.file);
  const sections = [...byFile].map(([file, items]) =>
    [
      file,
      ...items.map(
        ({ line, column, severity, message, rule }) =>
          `  ${line}:${column}  ${SEVERITY_LABELS[severity]}  ${message}  (${rule})`,
      ),
      "",
    ].join("\n"),
  );

  const count = (action) => violations.filter((v) => v.action === action).length;
  const actions = [
    `바로 바꿀 수 있는 것 ${count("replace")}건`,
    `사람이 정해야 하는 것 ${count("ask")}건`,
    ...(count("repair") > 0 ? [`문법을 고쳐야 하는 것 ${count("repair")}건`] : []),
  ].join(", ");

  return [
    ...header,
    ...sections,
    `오류 ${summary.errors}개, 경고 ${summary.warnings}개 (파일 ${summary.files}개 검사)`,
    actions,
    "",
  ].join("\n");
}

// 설정에서 무엇을 읽었는지 보여준다. 경로를 잘못 적으면 여기서 0개로 드러난다.
function describe({ colorTokens, components }) {
  return [
    `디자인 시스템: 색 토큰 ${colorTokens}개`,
    components > 0 ? `컴포넌트 ${components}개` : "컴포넌트 설정 없음",
  ].join(", ");
}

/**
 * 색 수집 결과를 사람이 읽는 글로 만든다.
 * @param {Awaited<ReturnType<typeof import("./colors.js").collectColors>>} result
 */
export function formatColorsText({ summary, colors, palette }) {
  if (colors.length === 0 && palette.length === 0) {
    return `코드에서 색을 찾지 못했습니다. (파일 ${summary.files}개 검사)\n`;
  }

  const usage = ({ uses, files, utilities, literals, properties = {} }) => {
    const where = Object.entries(utilities).map(([utility, count]) => `${utility} ${count}`);
    if (literals) where.push(`문자열 ${literals}`);
    const inCss = Object.values(properties).reduce((sum, count) => sum + count, 0);
    if (inCss) where.push(`CSS ${inCss}`);
    return `${uses}곳  파일 ${files}개  ${where.join(", ")}`;
  };
  // 설정 파일이 있을 때만 tokens 가 붙는다.
  const tokenNote = ({ tokens }) =>
    tokens === undefined ? "" : tokens.length > 0 ? `  토큰: ${tokens.join(", ")}` : "  토큰 없음";

  const lines = [
    `코드에서 쓰는 색: hex ${summary.colors}개, 기본 팔레트 ${summary.paletteColors}개 (사용 ${summary.uses}곳, 파일 ${summary.files}개 검사)`,
    "",
  ];
  if (colors.length > 0) {
    lines.push("hex 색", ...colors.map((c) => `  ${c.color}  ${usage(c)}${tokenNote(c)}`), "");
  }
  if (palette.length > 0) {
    lines.push("Tailwind 기본 팔레트", ...palette.map((p) => `  ${p.name}  ${usage(p)}`), "");
  }
  return lines.join("\n");
}
