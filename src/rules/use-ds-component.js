import path from "node:path";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "디자인 시스템 컴포넌트가 있는 raw 태그를 직접 쓰지 않는다" },
    schema: [],
    messages: {
      useComponent:
        "<{{tag}}> 대신 디자인 시스템 컴포넌트를 사용하세요: {{component}} ({{path}})",
    },
  },
  create(context) {
    const components = context.settings?.designsnitch?.components;
    if (!components?.path || !components.replaces) return {};

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
            tag,
            // 대체 컴포넌트는 하나(문자열)일 수도 여러 개(배열)일 수도 있다.
            component: [components.replaces[tag]].flat().join(", "),
            path: components.path,
          },
        });
      },
    };
  },
};
