import { findArbitraryColors } from "../core/classes.js";
import { normalizeHex } from "../core/color.js";
import { loadTokens } from "./load-tokens.js";
import { ruleMessages, TEXT } from "./suggest.js";
import { visitStrings } from "./visit-strings.js";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: { description: "Report hex colors that have no matching token" },
    schema: [],
    messages: { unknown: TEXT },
  },
  create(context) {
    const m = ruleMessages(context);
    const { colors } = loadTokens(context.settings, context.cwd);

    return visitStrings(context, findArbitraryColors, (found, { loc }) => {
      if (colors.has(normalizeHex(found.value))) return;
      context.report({
        loc,
        messageId: "unknown",
        data: { text: m.unknownColor({ found: found.text }) },
      });
    });
  },
};
