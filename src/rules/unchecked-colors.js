import { findArbitraryColors } from "../core/classes.js";
import { findColorValues } from "../core/color.js";
import { visitStrings } from "./visit-strings.js";
import { colorContext } from "./visit-style.js";

/**
 * 검사 규칙이 보지 않는 문자열 속 색을 알린다. 위반이 아니라 check 가 개수를 세는 데 쓴다.
 * 임의 값 클래스(bg-[#fff])와 인라인 스타일의 색은 다른 규칙이 검사하므로 빼고 센다.
 * @type {import("eslint").Rule.RuleModule}
 */
export default {
  meta: { type: "suggestion", schema: [], messages: { unchecked: "{{color}}" } },
  create(context) {
    const findUnchecked = (text) => {
      const inClasses = findArbitraryColors(text).map(({ index, text: found }) => [index, index + found.length]);
      return findColorValues(text).filter(({ index }) => !inClasses.some(([start, end]) => index >= start && index < end));
    };
    const visitor = visitStrings(context, findUnchecked, (found, { loc }) =>
      context.report({ loc, messageId: "unchecked", data: { color: found.value } }),
    );
    const { sourceCode } = context;
    // 색을 받는 자리의 값은 다른 규칙이 검사한다.
    const skipStyle = (handler) => (node) => {
      if (colorContext(node, sourceCode) === null && colorContext(node.parent ?? {}, sourceCode) === null) handler(node);
    };
    return { Literal: skipStyle(visitor.Literal), TemplateElement: skipStyle(visitor.TemplateElement) };
  },
};
