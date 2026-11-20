import { findArbitraryColors, tokenToClass } from "../core/classes.js";
import { normalizeHex } from "../core/color.js";
import { loadTokens } from "./load-tokens.js";
import { ruleMessages, suggestClasses, TEXT } from "./suggest.js";
import { visitStrings } from "./visit-strings.js";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "Use the token instead of writing its color as a hex value" },
    hasSuggestions: true,
    schema: [],
    messages: { useToken: TEXT, replace: TEXT, tokensConfig: TEXT },
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
    const { colors } = tokens;

    return visitStrings(context, findArbitraryColors, (found, { loc, range }) => {
      const tokenNames = colors.get(normalizeHex(found.value));
      if (!tokenNames) return;
      const classes = tokenNames.map((name) => tokenToClass(found.utility, name));
      context.report({
        loc,
        messageId: "useToken",
        data: {
          text: m.useToken({
            found: found.text,
            tokens: tokenNames.join(", "),
            candidates: classes.join(", "),
          }),
        },
        suggest: suggestClasses(range, classes, m),
      });
    });
  },
};
