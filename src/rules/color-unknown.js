import { findArbitraryColors } from "../core/classes.js";
import { lookupColor } from "../core/tokens.js";
import { definesTokens, loadTokens } from "./load-tokens.js";
import { ruleSettings } from "./settings.js";
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
      tokens = loadTokens(ruleSettings(context), context.cwd);
    } catch {
      // 토큰 설정 문제는 color-use-token 에서만 보고한다.
      return {};
    }
    if (definesTokens(tokens, context.filename)) return {};
    const m = ruleMessages(context);
    const { colors } = tokens;

    function report(found, { loc }) {
      // 반투명한 색도 불투명한 색에 토큰이 있으면 color-use-token 이 맡는다.
      if (lookupColor(colors, found.value).names.length > 0) return;
      context.report({ loc, messageId: "unknown", data: { text: m.unknownColor({ found: found.text }) } });
    }

    return mergeVisitors(visitStrings(context, findArbitraryColors, report), visitInlineStyleColors(context, report));
  },
};
