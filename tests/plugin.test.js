import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import designsnitch from "../src/index.js";

describe("플러그인", () => {
  it("recommended 설정은 토큰이 있는데 안 쓴 것을 오류로, 토큰에 없는 값을 경고로 보고한다", async () => {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        designsnitch.configs.recommended,
        {
          files: ["**/*.jsx"],
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          settings: {
            designsnitch: {
              tokens: "tests/fixtures/tokens.css",
              components: { path: "components/ui", replaces: { button: "Button" } },
            },
          },
        },
      ],
    });

    const code = `
      export function PayButton() {
        return (
          <button className="bg-[#3B82F6] text-[#3B82F5] p-[16px] rounded-[5px]">
            결제
          </button>
        );
      }
    `;
    const [result] = await eslint.lintText(code, { filePath: "PayButton.jsx" });

    expect(
      result.messages.map(({ ruleId, severity }) => ({ ruleId, severity })),
    ).toEqual([
      { ruleId: "designsnitch/use-ds-component", severity: 2 },
      { ruleId: "designsnitch/color-use-token", severity: 2 },
      { ruleId: "designsnitch/color-unknown", severity: 1 },
      { ruleId: "designsnitch/scale-use-token", severity: 2 },
      { ruleId: "designsnitch/scale-unknown", severity: 1 },
    ]);
  });
});
