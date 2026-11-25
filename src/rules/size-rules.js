import { findArbitrarySizes, findLengths, matchSize, sizePropertyKind, sizeTokenClass } from "../core/size.js";
import { tokenVar } from "../core/tokens.js";
import { definesTokens, loadTokens } from "./load-tokens.js";
import { ruleSettings } from "./settings.js";
import { ruleMessages, suggestClasses, TEXT } from "./suggest.js";
import { visitStrings } from "./visit-strings.js";
import { mergeVisitors, styleProperty } from "./visit-style.js";

/** 규칙 이름에 쓰는 말과 메시지 이름의 앞부분 */
const KINDS = {
  radius: { label: "radius", messages: "radius" },
  fontSize: { label: "font-size", messages: "fontSize" },
};

/**
 * 직접 쓴 크기를 토큰과 비교하는 규칙 한 쌍을 만든다.
 * use-token: 같은 값의 토큰이 있는데 쓰지 않았다. unknown: 토큰이 있는 종류인데 맞는 토큰이 없다.
 * 그 종류의 토큰이 하나도 없으면 아무것도 보고하지 않는다. 기준이 없으면 비춰 볼 것이 없다.
 * @param {"radius" | "fontSize"} kind
 * @param {"use-token" | "unknown"} mode
 * @returns {import("eslint").Rule.RuleModule}
 */
export function createSizeRule(kind, mode) {
  const isUseToken = mode === "use-token";
  return {
    meta: {
      type: isUseToken ? "problem" : "suggestion",
      docs: {
        description: isUseToken
          ? `Use the ${KINDS[kind].label} token instead of writing its value by hand`
          : `Report ${KINDS[kind].label} values that have no matching token`,
      },
      ...(isUseToken ? { fixable: "code", hasSuggestions: true } : {}),
      schema: [],
      messages: { useToken: TEXT, useTokenUnit: TEXT, useTokenLineHeight: TEXT, unknown: TEXT, replace: TEXT },
    },
    create(context) {
      let tokens;
      try {
        tokens = loadTokens(ruleSettings(context), context.cwd);
      } catch {
        // 토큰 설정 문제는 color-use-token 에서만 보고한다.
        return {};
      }
      const sizeTokens = tokens.sizes?.[kind];
      if (!sizeTokens || sizeTokens.count === 0 || definesTokens(tokens, context.filename)) return {};
      const m = ruleMessages(context);
      const { sourceCode } = context;

      /**
       * @param {string} found 보고할 글자. 예: rounded-[8px], 8px, 8
       * @param {string} value 길이. 예: 8px
       * @param {{ loc: any, range: [number, number] }} where
       * @param {(name: string) => string} toCandidate
       * @param {boolean} asClass
       */
      function judge(found, value, where, toCandidate, asClass) {
        const match = matchSize(kind, sizeTokens, value, asClass);
        if (!match) return;
        if (match.messageId === "unknown") {
          if (isUseToken) return;
          const text = m[`${KINDS[kind].messages}Unknown`]({ found });
          context.report({ loc: where.loc, messageId: "unknown", data: { text } });
          return;
        }
        if (!isUseToken) return;
        const candidates = match.names.map(toCandidate);
        const text = m.sizeUseToken({
          kind,
          reason: match.messageId,
          found,
          tokens: match.names.join(", "),
          candidates: candidates.join(", "),
        });
        context.report({
          loc: where.loc,
          messageId: match.messageId,
          data: { text },
          // 같은 단위의 같은 값이고 후보가 하나일 때만 자동 수정한다.
          ...(match.messageId === "useToken" && candidates.length === 1
            ? { fix: (fixer) => fixer.replaceTextRange(where.range, candidates[0]) }
            : {}),
          suggest: suggestClasses(where.range, candidates, m),
        });
      }

      const variable = (name) => tokenVar(name, tokens.prefix);

      return mergeVisitors(
        visitStrings(
          context,
          (text) => findArbitrarySizes(text).filter((found) => found.kind === kind),
          (found, where) => judge(found.text, found.value, where, (name) => sizeTokenClass(kind, found.utility, name), true),
        ),
        {
          Literal(node) {
            const property = styleProperty(node, sourceCode);
            if (!property || sizePropertyKind(property) !== kind) return;
            const whole = { loc: node.loc, range: node.range };
            // React 는 숫자를 px 로 쓴다. 숫자를 바꿀 때는 문자열로 적어야 한다.
            if (typeof node.value === "number") {
              judge(String(node.raw), `${node.value}px`, whole, (name) => `"${variable(name)}"`, false);
              return;
            }
            if (typeof node.value !== "string") return;
            // 따옴표 안쪽만 본다.
            for (const length of findLengths(sourceCode.getText(node).slice(1, -1))) {
              const start = node.range[0] + 1 + length.index;
              const end = start + length.text.length;
              const where = {
                loc: { start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) },
                range: /** @type {[number, number]} */ ([start, end]),
              };
              judge(length.text, length.text, where, variable, false);
            }
          },
        },
      );
    },
  };
}
