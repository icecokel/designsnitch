import { findArbitraryColors } from "../core/classes.js";
import { normalizeHex } from "../core/color.js";
import { loadTokens } from "./load-tokens.js";
import { visitStrings } from "./visit-strings.js";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: { description: "토큰에 없는 색을 hex로 쓰면 알린다" },
    schema: [],
    messages: {
      unknown: "{{found}}의 색은 토큰에 없습니다.",
    },
  },
  create(context) {
    const { colors } = loadTokens(context.settings, context.cwd);

    return visitStrings(context, findArbitraryColors, (found, { loc }) => {
      if (colors.has(normalizeHex(found.value))) return;
      context.report({ loc, messageId: "unknown", data: { found: found.text } });
    });
  },
};
