const SEVERITY_LABELS = { error: "오류", warning: "경고" };

/**
 * 검사 결과를 사람이 읽는 글로 만든다.
 * @param {Awaited<ReturnType<typeof import("./check.js").check>>} result
 */
export function formatText({ summary, violations }) {
  if (violations.length === 0) {
    return `위반이 없습니다. (파일 ${summary.files}개 검사)\n`;
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
    ...sections,
    `오류 ${summary.errors}개, 경고 ${summary.warnings}개 (파일 ${summary.files}개 검사)`,
    "",
  ].join("\n");
}
