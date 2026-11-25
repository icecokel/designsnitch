import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import designsnitch from "../src/index.js";
import { tempProject } from "./temp-project.js";

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
      // 토큰 CSS 에 --radius-* 가 있으므로, 거기 없는 5px 를 알린다. 간격(p-[16px])은 보지 않는다.
      { ruleId: "designsnitch/radius-unknown", severity: 1 },
    ]);
  });

  it.each([
    ["settings.designsnitch.root 가 있으면 그 디렉터리의 토큰과 컴포넌트를 기준으로 검사한다", true, "--color-nested"],
    ["settings.designsnitch.root 가 없으면 ESLint 의 cwd 를 기준으로 검사한다", false, "--color-cwd"],
  ])("%s", async (_name, useRoot, token) => {
    const component = `export const Button = () => <button />;`;
    const cwd = tempProject({
      "tokens.css": `@theme { --color-cwd: #fff; }`,
      "design/tokens.css": `@theme { --color-nested: #fff; }`,
      "ui/Button.jsx": component,
      "design/ui/Button.jsx": component,
      "src/Card.jsx": `export const Card = () => <div className="bg-[#fff]" />;`,
    });
    const eslint = new ESLint({
      cwd,
      overrideConfigFile: true,
      overrideConfig: [
        designsnitch.configs.recommended,
        {
          files: ["**/*.jsx"],
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          settings: {
            designsnitch: {
              ...(useRoot ? { root: path.join(cwd, "design") } : {}),
              tokens: "tokens.css",
              components: { path: "ui", replaces: { button: "Button" } },
            },
          },
        },
      ],
    });
    const results = await eslint.lintFiles(["ui/Button.jsx", "design/ui/Button.jsx", "src/Card.jsx"]);
    const messages = Object.fromEntries(results.map((result) => [
      path.relative(cwd, result.filePath).split(path.sep).join("/"),
      result.messages,
    ]));

    expect(messages[useRoot ? "design/ui/Button.jsx" : "ui/Button.jsx"]).toEqual([]);
    expect(messages[useRoot ? "ui/Button.jsx" : "design/ui/Button.jsx"]).toMatchObject([
      { ruleId: "designsnitch/use-ds-component" },
    ]);
    expect(messages["src/Card.jsx"]).toMatchObject([
      { ruleId: "designsnitch/color-use-token", message: expect.stringContaining(token) },
    ]);
  });

  it("색, 공용 컴포넌트, radius, 글자 크기를 검사하고 간격은 검사하지 않는다", () => {
    expect(Object.keys(designsnitch.rules).sort()).toEqual([
      "color-unknown",
      "color-use-token",
      "font-size-unknown",
      "font-size-use-token",
      "radius-unknown",
      "radius-use-token",
      "use-ds-component",
    ]);
  });
});
