import { RuleTester } from "eslint";
import { afterAll, describe, it } from "vitest";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

export const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: {
    designsnitch: { tokens: "tests/fixtures/tokens.css" },
  },
});
