import { findColorValues } from "../core/color.js";

/**
 * 노드가 JSX style 속성 객체의 값이면 CSS 속성 이름을, 아니면 null 을 돌려준다.
 * 예: <div style={{ color: "#fff" }} /> 의 "#fff" → "color"
 * @param {import("estree").Node & { parent?: any }} node
 * @returns {string | null}
 */
export function inlineStyleProperty(node) {
  const property = node.parent;
  if (property?.type !== "Property" || property.value !== node || property.computed) return null;
  const object = property.parent;
  if (object?.type !== "ObjectExpression" || object.parent?.type !== "JSXExpressionContainer") return null;
  const attribute = object.parent.parent;
  if (attribute?.type !== "JSXAttribute" || attribute.name?.name !== "style") return null;
  const { key } = property;
  if (key.type === "Identifier") return key.name;
  return typeof key.value === "string" ? key.value : null;
}

/**
 * JSX style 속성에 문자열로 적은 색마다 onFound 를 부르는 visitor 를 만든다.
 * @param {import("eslint").Rule.RuleContext} context
 * @param {(found: { text: string, value: string, property: string }, where: { loc: import("estree").SourceLocation, range: [number, number] }) => void} onFound
 */
export function visitInlineStyleColors(context, onFound) {
  const { sourceCode } = context;

  function scan(node, property) {
    for (const found of findColorValues(sourceCode.getText(node))) {
      const start = node.range[0] + found.index;
      const end = start + found.text.length;
      onFound({ ...found, property }, {
        loc: { start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) },
        range: [start, end],
      });
    }
  }

  return {
    Literal(node) {
      if (typeof node.value !== "string") return;
      const property = inlineStyleProperty(node);
      if (property !== null) scan(node, property);
    },
    TemplateLiteral(node) {
      const property = inlineStyleProperty(node);
      // ${} 안의 코드는 다른 노드가 맡는다. 문자열 부분만 본다.
      if (property !== null) for (const quasi of node.quasis) scan(quasi, property);
    },
  };
}

/** 같은 노드 종류를 여러 visitor 가 보도록 합친다. */
export function mergeVisitors(...visitors) {
  const merged = {};
  for (const visitor of visitors) {
    for (const [type, handler] of Object.entries(visitor)) {
      const previous = merged[type];
      merged[type] = previous ? (node) => { previous(node); handler(node); } : handler;
    }
  }
  return merged;
}
