/**
 * 문자열과 템플릿 리터럴마다 find 로 클래스를 찾고, 찾은 것마다 onFound 를 부르는 visitor 를 만든다.
 * @template {{ index: number, text: string }} T
 * @param {import("eslint").Rule.RuleContext} context
 * @param {(text: string) => T[]} find
 * @param {(found: T, where: { loc: import("estree").SourceLocation, range: [number, number] }) => void} onFound
 */
export function visitStrings(context, find, onFound) {
  const { sourceCode } = context;

  function check(node) {
    // 값이 아니라 소스 텍스트를 훑어야 이스케이프가 있어도 위치가 정확하다.
    for (const found of find(sourceCode.getText(node))) {
      const start = node.range[0] + found.index;
      const end = start + found.text.length;
      onFound(found, {
        loc: { start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) },
        range: [start, end],
      });
    }
  }

  return {
    Literal(node) {
      if (typeof node.value === "string") check(node);
    },
    TemplateElement: check,
  };
}
