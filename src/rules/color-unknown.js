import { findArbitraryColors } from "../core/classes.js";
import { normalizeColor } from "../core/color.js";
import { loadTokens } from "./load-tokens.js";
import { ruleMessages, TEXT } from "./suggest.js";
import { visitStrings } from "./visit-strings.js";
import { mergeVisitors, visitInlineStyleColors } from "./visit-style.js";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: { description: "Report hex colors that have no matching token" },
    schema: [],
    messages: { unknown: TEXT },
  },
  create(context) {
    let tokens;
    try {
      tokens = loadTokens(context.settings, context.cwd);
    } catch {
      // 토큰 설정 문제는 color-use-token 에서만 보고한다.
      return {};
    }
    const m = ruleMessages(context);
    const { colors } = tokens;

    function report(found, { loc }) {
      if (colors.has(normalizeColor(found.value))) return;
      context.report({ loc, messageId: "unknown", data: { text: m.unknownColor({ found: found.text }) } });
    }

    return mergeVisitors(visitStrings(context, findArbitraryColors, report), visitInlineStyleColors(context, report));
  },
};
