import path from "node:path";
import { ruleMessages, TEXT } from "./suggest.js";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "Use the design system component instead of a raw tag" },
    schema: [],
    messages: { useComponent: TEXT },
  },
  create(context) {
    const components = context.settings?.designsnitch?.components;
    if (!components?.path || !components.replaces) return {};
    const m = ruleMessages(context);

    // 디자인 시스템 컴포넌트는 raw 태그로 만들어지므로 그 경로 안은 검사하지 않는다.
    const dsDir = path.resolve(context.cwd, components.path);
    const file = path.resolve(context.cwd, context.filename);
    if (file.startsWith(dsDir + path.sep)) return {};

    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return;
        const tag = node.name.name;
        if (!Object.hasOwn(components.replaces, tag)) return;
        context.report({
          node: node.name,
          messageId: "useComponent",
          data: {
            text: m.useComponent({
              tag,
              // 대체 컴포넌트는 하나(문자열)일 수도 여러 개(배열)일 수도 있다.
              component: [components.replaces[tag]].flat().join(", "),
              path: components.path,
            }),
          },
        });
      },
    };
  },
};
