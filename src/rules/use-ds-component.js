import path from "node:path";
import { replacementNames } from "../config.js";
import { ruleSettings } from "./settings.js";
import { ruleMessages, TEXT } from "./suggest.js";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "Use the design system component instead of a raw tag" },
    schema: [],
    messages: { useComponent: TEXT, useComponentAsk: TEXT },
  },
  create(context) {
    const { components, root } = ruleSettings(context).designsnitch ?? {};
    if (!components?.path || !components.replaces) return {};
    const m = ruleMessages(context);

    // 디자인 시스템 컴포넌트는 raw 태그로 만들어지므로 그 경로 안은 검사하지 않는다.
    const dsDir = path.resolve(context.cwd, root ?? ".", components.path);
    const file = path.resolve(context.cwd, context.filename);
    if (file.startsWith(dsDir + path.sep)) return {};

    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return;
        const tag = node.name.name;
        if (!Object.hasOwn(components.replaces, tag)) return;
        const replacement = components.replaces[tag];
        const hasSpread = node.attributes.some((attr) => attr.type === "JSXSpreadAttribute");
        let dynamicAttribute;
        // spread 가 있으면 명시한 속성 값도 런타임에 덮어쓸 수 있다.
        if (!hasSpread && replacement.when) {
          for (const [name, allowed] of Object.entries(replacement.when)) {
            const attr = node.attributes.findLast(
              (attr) => attr.type === "JSXAttribute" && attr.name.name === name,
            );
            const value = attr?.value;
            const literal = value?.type === "JSXExpressionContainer" ? value.expression : value;
            if (literal && literal.type !== "Literal") {
              dynamicAttribute ??= name;
              continue;
            }
            // null 조건은 속성이 아예 생략된 경우에만 맞는다.
            const actual = attr ? literal?.value : null;
            if ((attr && typeof actual !== "string") || !allowed.includes(actual)) return;
          }
        }

        const messageId = hasSpread || dynamicAttribute !== undefined ? "useComponentAsk" : "useComponent";
        context.report({
          node: node.name,
          messageId,
          data: {
            text: m[messageId]({
              tag,
              component: replacementNames(replacement).join(", "),
              path: components.path,
              dynamicAttribute,
            }),
          },
        });
      },
    };
  },
};
