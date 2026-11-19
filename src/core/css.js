import postcss from "postcss";

const HEX_COLOR = /(?<![\w-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
// 색이 아닌 # 이 들어갈 수 있는 곳: url(#id), "문자열", /* 주석 */
const NOT_A_VALUE = /url\([^)]*\)|"[^"]*"|'[^']*'|\/\*[\s\S]*?\*\//g;
const DISABLE_NEXT_LINE = "designsnitch-disable-next-line";

/**
 * CSS 의 선언 값에서 hex 색을 찾는다. 줄과 열은 1부터 시작하고, 끝 열은 색 바로 다음 칸이다.
 * --로 시작하는 선언은 토큰이나 변수를 정의하는 곳이므로 건너뛴다.
 * 바로 앞에 designsnitch-disable-next-line 주석이 있는 선언의 색은 disabled 로 표시한다.
 * @param {string} css
 * @returns {{ line: number, column: number, endLine: number, endColumn: number, value: string, prop: string, disabled: boolean }[]}
 * @throws {import("postcss").CssSyntaxError} CSS 를 읽지 못했을 때
 */
export function findCssColors(css) {
  const lineStarts = [0];
  for (let i = 0; i < css.length; i += 1) {
    if (css[i] === "\n") lineStarts.push(i + 1);
  }
  const position = (offset) => {
    let line = lineStarts.length - 1;
    while (lineStarts[line] > offset) line -= 1;
    return { line: line + 1, column: offset - lineStarts[line] + 1 };
  };

  const found = [];
  postcss.parse(css).walkDecls((decl) => {
    if (decl.prop.startsWith("--")) return;

    const previous = decl.prev();
    const disabled = previous?.type === "comment" && previous.text.includes(DISABLE_NEXT_LINE);

    // 위치를 정확히 잡으려고 정리된 값이 아니라 원본 텍스트에서 찾는다.
    const raw = decl.raws.value?.raw ?? decl.value;
    const valueStart = decl.source.start.offset + decl.prop.length + decl.raws.between.length;
    const masked = raw.replace(NOT_A_VALUE, (skipped) => " ".repeat(skipped.length));

    for (const match of masked.matchAll(HEX_COLOR)) {
      const start = position(valueStart + match.index);
      const end = position(valueStart + match.index + match[0].length);
      found.push({
        line: start.line,
        column: start.column,
        endLine: end.line,
        endColumn: end.column,
        value: match[0],
        prop: decl.prop,
        disabled,
      });
    }
  });
  return found;
}
