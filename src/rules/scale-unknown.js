import { findArbitraryLengths } from "../core/classes.js";
import { matchScale } from "../core/scale.js";
import { loadTokens } from "./load-tokens.js";
import { SCALE_LABELS } from "./scale-labels.js";
import { REPLACE_MESSAGES, suggestClasses } from "./suggest.js";
import { visitStrings } from "./visit-strings.js";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: { description: "스케일에 없는 간격, 폰트 크기, radius를 쓰면 알린다" },
    hasSuggestions: true,
    schema: [],
    messages: {
      ...REPLACE_MESSAGES,
      unknown: "{{found}}의 값은 {{scale}}에 없습니다. 가까운 값: {{nearest}}",
    },
  },
  create(context) {
    const { scale } = loadTokens(context.settings, context.cwd);

    return visitStrings(context, findArbitraryLengths, (found, { loc, range }) => {
      const match = matchScale(found.utility, found.px, scale);
      if (!match?.nearest) return;
      context.report({
        loc,
        messageId: "unknown",
        data: {
          found: found.text,
          scale: SCALE_LABELS[match.kind],
          nearest: match.nearest
            .map(({ className, px }) => `${className} (${px}px)`)
            .join(", "),
        },
        suggest: suggestClasses(
          range,
          match.nearest.map(({ className }) => className),
        ),
      });
    });
  },
};
