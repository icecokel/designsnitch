import fs from "node:fs";
import path from "node:path";

/**
 * action 이 replace 인 위반을 후보로 바꿔 쓴다. 다른 action 은 건드리지 않는다.
 * 위치의 글자가 found 와 다르면(그 사이에 파일이 바뀌었으면) 그 건은 건너뛴다.
 * @param {string} cwd
 * @param {import("./check.js").Violation[]} violations
 * @returns {number} 고친 수
 */
export function applyReplacements(cwd, violations) {
  /** @type {Map<string, import("./check.js").Violation[]>} */
  const byFile = new Map();
  for (const violation of violations) {
    if (violation.action !== "replace" || violation.candidates.length !== 1) continue;
    byFile.set(violation.file, [...(byFile.get(violation.file) ?? []), violation]);
  }

  let fixed = 0;
  for (const [file, list] of byFile) {
    const target = path.resolve(cwd, file);
    let source = fs.readFileSync(target, "utf8");
    const lineStarts = [0];
    for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStarts.push(i + 1);
    const offset = (line, column) => lineStarts[line - 1] + column - 1;

    const edits = list
      .map((v) => ({ start: offset(v.line, v.column), end: offset(v.endLine, v.endColumn), v }))
      .filter(({ start, end, v }) => source.slice(start, end) === v.found)
      // 뒤에서부터 바꿔야 앞의 위치가 밀리지 않는다.
      .sort((a, b) => b.start - a.start);
    let last = Infinity;
    for (const { start, end, v } of edits) {
      if (end > last) continue; // 겹치는 범위는 한 번만
      source = source.slice(0, start) + v.candidates[0] + source.slice(end);
      last = start;
      fixed += 1;
    }
    if (edits.length > 0) fs.writeFileSync(target, source);
  }
  return fixed;
}
