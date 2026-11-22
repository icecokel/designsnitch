import { findArbitraryColors, tokenToClass } from "../core/classes.js";
import { normalizeColor } from "../core/color.js";
import { cssColorPrefixes, selectColorTokens, tokenVar, utilityColorPrefixes } from "../core/tokens.js";
import { loadTokens } from "./load-tokens.js";
import { ruleMessages, suggestClasses, TEXT } from "./suggest.js";
import { visitStrings } from "./visit-strings.js";
import { mergeVisitors, visitInlineStyleColors } from "./visit-style.js";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "Use the token instead of writing its color as a hex value" },
    hasSuggestions: true,
    schema: [],
    messages: { useToken: TEXT, useTokenThemed: TEXT, replace: TEXT, tokensConfig: TEXT },
  },
  create(context) {
    let tokens;
    try {
      tokens = loadTokens(context.settings, context.cwd);
    } catch (error) {
      return {
        Program(node) {
          context.report({ node, messageId: "tokensConfig", data: { text: error.message } });
        },
      };
    }
    const m = ruleMessages(context);
    const { colors, themed, prefer, classOnly } = tokens;

    function report(found, { loc, range }, tokenNames, candidates) {
      const messageId = tokenNames.some((name) => themed.has(name)) ? "useTokenThemed" : "useToken";
      context.report({
        loc,
        messageId,
        data: {
          text: m[messageId]({ found: found.text, tokens: tokenNames.join(", "), candidates: candidates.join(", ") }),
        },
        suggest: suggestClasses(range, candidates, m),
      });
    }

    return mergeVisitors(
      visitStrings(context, findArbitraryColors, (found, where) => {
        const names = colors.get(normalizeColor(found.value));
        if (!names) return;
        const tokenNames = selectColorTokens(names, prefer, utilityColorPrefixes(found.utility));
        report(found, where, tokenNames, tokenNames.map((name) => tokenToClass(found.utility, name)));
      }),
      // 인라인 스타일은 클래스가 아니라 var(--토큰) 으로 바꾼다. Tailwind 는 소스에서 쓴 var() 의 변수를 내보낸다.
      visitInlineStyleColors(context, (found, where) => {
        // 클래스로만 쓸 수 있는 토큰은 스타일 값을 대신할 수 없다.
        const names = (colors.get(normalizeColor(found.value)) ?? []).filter((name) => !classOnly.has(name));
        if (names.length === 0) return;
        const tokenNames = selectColorTokens(names, prefer, cssColorPrefixes(found.property));
        report(found, where, tokenNames, tokenNames.map((name) => tokenVar(name, tokens.prefix)));
      }),
    );
  },
};
