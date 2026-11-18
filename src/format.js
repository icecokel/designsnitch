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

  return [
    ...header,
    ...sections,
    `오류 ${summary.errors}개, 경고 ${summary.warnings}개 (파일 ${summary.files}개 검사)`,
    "",
  ].join("\n");
}

// 설정에서 무엇을 읽었는지 보여준다. 경로를 잘못 적으면 여기서 0개로 드러난다.
function describe({ colorTokens, radiusTokens, textTokens, components }) {
  return [
    `디자인 시스템: 색 토큰 ${colorTokens}개`,
    `radius 토큰 ${radiusTokens}개`,
    `폰트 크기 토큰 ${textTokens}개`,
    components > 0 ? `컴포넌트 ${components}개` : "컴포넌트 설정 없음",
  ].join(", ");
}
