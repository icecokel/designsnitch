import { findArbitraryColors, tokenToClass } from "../core/classes.js";
import { normalizeHex } from "../core/color.js";
import { loadTokens } from "./load-tokens.js";
import { REPLACE_MESSAGES, suggestClasses } from "./suggest.js";
import { visitStrings } from "./visit-strings.js";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "토큰이 있는 색을 hex로 쓰지 않는다" },
    hasSuggestions: true,
    schema: [],
    messages: {
      ...REPLACE_MESSAGES,
      useToken: "{{found}}의 색은 토큰 {{tokens}}의 값입니다. 대신 사용: {{classes}}",
    },
  },
  create(context) {
    const { colors } = loadTokens(context.settings, context.cwd);

    return visitStrings(context, findArbitraryColors, (found, { loc, range }) => {
      const tokenNames = colors.get(normalizeHex(found.value));
      if (!tokenNames) return;
      const classes = tokenNames.map((name) => tokenToClass(found.utility, name));
      context.report({
        loc,
        messageId: "useToken",
        data: {
          found: found.text,
          tokens: tokenNames.join(", "),
          classes: classes.join(", "),
        },
        suggest: suggestClasses(range, classes),
      });
    });
  },
};
