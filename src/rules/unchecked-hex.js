import { findArbitraryColors, findHexColors } from "../core/classes.js";
import { visitStrings } from "./visit-strings.js";
import { inlineStyleProperty } from "./visit-style.js";

/**
 * 검사 규칙이 보지 않는 문자열 속 hex 색을 알린다. 위반이 아니라 check 가 개수를 세는 데 쓴다.
 * 임의 값 클래스(bg-[#fff])와 인라인 스타일의 hex 는 다른 규칙이 검사하므로 빼고 센다.
 * @type {import("eslint").Rule.RuleModule}
 */
export default {
  meta: { type: "suggestion", schema: [], messages: { unchecked: "{{color}}" } },
  create(context) {
    const findUnchecked = (text) => {
      const inClasses = findArbitraryColors(text).map(({ index, text: found }) => [index, index + found.length]);
      return findHexColors(text).filter(({ index }) => !inClasses.some(([start, end]) => index >= start && index < end));
    };
    const visitor = visitStrings(context, findUnchecked, (found, { loc }) =>
      context.report({ loc, messageId: "unchecked", data: { color: found.value } }),
    );
    const skipStyle = (handler) => (node) => {
      if (inlineStyleProperty(node) === null && inlineStyleProperty(node.parent ?? {}) === null) handler(node);
    };
    return { Literal: skipStyle(visitor.Literal), TemplateElement: skipStyle(visitor.TemplateElement) };
  },
};
