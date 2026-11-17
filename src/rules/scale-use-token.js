import { findArbitraryLengths } from "../core/classes.js";
import { matchScale } from "../core/scale.js";
import { loadTokens } from "./load-tokens.js";
import { SCALE_LABELS } from "./scale-labels.js";
import { REPLACE_MESSAGES, suggestClasses } from "./suggest.js";
import { visitStrings } from "./visit-strings.js";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "스케일에 있는 간격, 폰트 크기, radius를 임의 값으로 쓰지 않는다" },
    hasSuggestions: true,
    schema: [],
    messages: {
      ...REPLACE_MESSAGES,
      useToken: "{{found}}의 값은 {{scale}}에 있습니다. 대신 사용: {{classes}}",
    },
  },
  create(context) {
    const { scale } = loadTokens(context.settings, context.cwd);

    return visitStrings(context, findArbitraryLengths, (found, { loc, range }) => {
      const match = matchScale(found.utility, found.px, scale);
      if (!match?.exact) return;
      context.report({
        loc,
        messageId: "useToken",
        data: {
          found: found.text,
          scale: SCALE_LABELS[match.kind],
          classes: match.exact.join(", "),
        },
        suggest: suggestClasses(range, match.exact),
      });
    });
  },
};
