import { findArbitraryColors, tokenToClass } from "../core/classes.js";
import { normalizeHex } from "../core/color.js";
import { selectColorTokens, utilityColorPrefixes } from "../core/tokens.js";
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
    const { colors, themed, prefer } = tokens;

    return visitStrings(context, findArbitraryColors, (found, { loc, range }) => {
      const names = colors.get(normalizeHex(found.value));
      if (!names) return;
      const tokenNames = selectColorTokens(names, prefer, utilityColorPrefixes(found.utility));
      const classes = tokenNames.map((name) => tokenToClass(found.utility, name));
      const messageId = tokenNames.some((name) => themed.has(name)) ? "useTokenThemed" : "useToken";
      context.report({
        loc,
        messageId,
        data: {
          text: m[messageId]({
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
