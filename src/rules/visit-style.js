import { findColorValues, isColorProperty } from "../core/color.js";

// 색을 받는 이름. CSS 의 색 속성이거나 Color 로 끝난다. 예: backgroundColor, stroke, pointHoverBackgroundColor
const isColorKey = (name) => isColorProperty(name) || /color$/i.test(name);
const STYLE_TYPE = /CSSProperties/;

/**
 * 노드가 색을 값으로 받는 자리에 있는지 본다.
 * - style: 스타일로 쓰이는 객체의 값. JSX 의 style 속성과 CSSProperties 타입의 객체.
 *   여기서는 var(--토큰) 이 통한다. 변수 이름(cardStyle, VARIANT_STYLES)은 근거로 삼지 않는다.
 *   이름만 그럴 뿐 차트 설정 묶음일 수 있고, 그러면 var() 로 바꾸는 것이 안전하지 않다.
 * - data: 그 밖에 색을 받는 이름의 속성이나 JSX 속성. 예: 차트 옵션의 backgroundColor, <Line stroke="...">.
 *   색인 것은 분명하지만 var() 가 통하는지는 알 수 없다.
 * @param {import("estree").Node & { parent?: any }} node 문자열이나 템플릿 리터럴
 * @param {import("eslint").SourceCode} [sourceCode] 주면 타입 표기(CSSProperties)도 본다
 * @returns {{ property: string, kind: "style" | "data" } | null}
 */
export function colorContext(node, sourceCode) {
  // color: on ? "#fff" : "#000", color: x || "#fff" 처럼 값이 고르는 식이면 그 식을 거슬러 올라간다.
  while (
    (node.parent?.type === "ConditionalExpression" && node.parent.test !== node) ||
    node.parent?.type === "LogicalExpression"
  ) {
    node = node.parent;
  }

  const holder = node.parent?.type === "JSXExpressionContainer" ? node.parent.parent : node.parent;
  if (holder?.type === "JSXAttribute") {
    const name = holder.name?.name;
    return typeof name === "string" && isColorKey(name) ? { property: name, kind: "data" } : null;
  }

  const property = node.parent;
  if (property?.type !== "Property" || property.value !== node || property.computed) return null;
  const { key } = property;
  const name = key.type === "Identifier" ? key.name : typeof key.value === "string" ? key.value : null;
  if (name === null || property.parent?.type !== "ObjectExpression") return null;

  const style = styleObjectKind(property.parent, sourceCode);
  if (style === "jsx") return { property: name, kind: "style" };
  if (!isColorKey(name)) return null;
  return { property: name, kind: style ? "style" : "data" };
}

/** 객체가 스타일로 쓰이는지. JSX 의 style 속성이면 "jsx", CSSProperties 타입이면 "typed", 아니면 null. */
function styleObjectKind(object, sourceCode) {
  const typed = (annotation) => Boolean(annotation && sourceCode && STYLE_TYPE.test(sourceCode.getText(annotation)));
  for (let node = object; node; node = node.parent) {
    const parent = node.parent;
    if (!parent) return null;
    if (parent.type === "TSAsExpression" || parent.type === "TSSatisfiesExpression") {
      if (typed(parent.typeAnnotation)) return "typed";
    } else if (parent.type === "JSXExpressionContainer") {
      const attribute = parent.parent;
      return attribute?.type === "JSXAttribute" && attribute.name?.name === "style" ? "jsx" : null;
    } else if (parent.type === "Property" && parent.value === node && parent.parent?.type === "ObjectExpression") {
      // styles = { title: { color: ... } } 처럼 스타일 객체 안에 들어 있는 객체
      node = parent;
    } else if (parent.type === "VariableDeclarator" && parent.init === node) {
      const { id } = parent;
      if (id.type !== "Identifier") return null;
      return typed(id.typeAnnotation) ? "typed" : null;
    } else {
      return null;
    }
  }
  return null;
}

/**
 * 노드가 스타일 객체의 값이면 CSS 속성 이름을, 아니면 null 을 돌려준다.
 * 예: <div style={{ color: "#fff" }} /> 의 "#fff" → "color"
 * @param {import("estree").Node & { parent?: any }} node
 * @returns {string | null}
 */
export function inlineStyleProperty(node) {
  const context = colorContext(node);
  return context?.kind === "style" ? context.property : null;
}

/**
 * 색을 값으로 받는 자리에 문자열로 적은 색마다 onFound 를 부르는 visitor 를 만든다.
 * @param {import("eslint").Rule.RuleContext} context
 * @param {(found: { text: string, value: string, property: string, kind: "style" | "data" }, where: { loc: import("estree").SourceLocation, range: [number, number] }) => void} onFound
 */
export function visitInlineStyleColors(context, onFound) {
  const { sourceCode } = context;

  function scan(node, { property, kind }) {
    // 색 이름은 스타일의 색 속성에서만 색으로 본다. <Badge color="red"> 의 red 는 변형 이름일 수 있다.
    const named = kind === "style" && isColorProperty(property);
    for (const found of findColorValues(sourceCode.getText(node), { named })) {
      const start = node.range[0] + found.index;
      const end = start + found.text.length;
      onFound({ ...found, property, kind }, {
        loc: { start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) },
        range: [start, end],
      });
    }
  }

  return {
    Literal(node) {
      if (typeof node.value !== "string") return;
      const where = colorContext(node, sourceCode);
      if (where) scan(node, where);
    },
    TemplateLiteral(node) {
      const where = colorContext(node, sourceCode);
      // ${} 안의 코드는 다른 노드가 맡는다. 문자열 부분만 본다.
      if (where) for (const quasi of node.quasis) scan(quasi, where);
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
