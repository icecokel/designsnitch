import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import { collectColors } from "../src/colors.js";
import { loadConfig } from "../src/config.js";
import colorUnknown from "../src/rules/color-unknown.js";
import colorUseToken from "../src/rules/color-use-token.js";
import { ruleTester } from "./rule-tester.js";
import { tempProject } from "./temp-project.js";

ruleTester.run("color-use-token (hex 가 아닌 표기)", colorUseToken, {
  valid: [{ name: "값을 읽을 수 없는 색 함수", code: `<div className="bg-[rgb(var(--x))]" />` }],
  invalid: [
    {
      name: "rgb() 임의 값",
      code: `<div className="bg-[rgb(59,130,246)]" />`,
      errors: [
        {
          message: "bg-[rgb(59,130,246)]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500",
          suggestions: [{ desc: "bg-primary-500(으)로 바꾸기", output: `<div className="bg-primary-500" />` }],
        },
      ],
    },
    {
      name: "hsl() 임의 값과 인라인 스타일의 rgb()",
      code: `<div className="text-[hsl(0_0%_100%)]" style={{ color: "rgb(59 130 246)" }} />`,
      errors: [
        {
          message:
            "text-[hsl(0_0%_100%)]의 색은 토큰 --color-white, --color-surface의 값입니다. 대신 사용: text-white, text-surface",
          suggestions: 2,
        },
        {
          message: "rgb(59 130 246)의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: var(--color-primary-500)",
          suggestions: [
            {
              desc: "var(--color-primary-500)(으)로 바꾸기",
              output: `<div className="text-[hsl(0_0%_100%)]" style={{ color: "var(--color-primary-500)" }} />`,
            },
          ],
        },
      ],
    },
  ],
});

ruleTester.run("color-unknown (hex 가 아닌 표기)", colorUnknown, {
  valid: [],
  invalid: [
    {
      name: "토큰에 없는 rgb() 와 반투명 색",
      code: `<div className="bg-[rgb(1,2,3)] text-[rgba(59,130,246,0.5)]" />`,
      errors: [
        { message: "bg-[rgb(1,2,3)]의 색은 토큰에 없습니다." },
        { message: "text-[rgba(59,130,246,0.5)]의 색은 토큰에 없습니다." },
      ],
    },
  ],
});

describe("hex 가 아닌 색 표기", () => {
  const base = { "designsnitch.config.json": `{ "tokens": "tokens.css" }` };

  it("rgb(), hsl(), oklch() 로 적은 토큰을 읽고, CSS 선언의 같은 색을 찾는다", async () => {
    const cwd = tempProject({
      ...base,
      "tokens.css": `@theme {
  --color-brand: rgb(59 130 246);
  --color-ink: hsl(0, 0%, 0%);
  --color-wide: oklch(84.1% 0.238 128.85);
}`,
      "src/a.css": `.a { color: #3b82f6; border: 1px solid rgb(0, 0, 0); background: oklch(84.1% 0.238 128.85); outline-color: rgb(1 2 3 / 50%); }`,
      "src/A.jsx": `export const A = () => <div className="bg-[oklch(84.1%_0.238_128.85)]" />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });

    expect(result.designSystem.colorTokens).toBe(3);
    expect(result.violations.map((v) => [v.found, v.rule, v.candidates])).toEqual([
      ["#3b82f6", "color-use-token", ["var(--color-brand)"]],
      ["rgb(0, 0, 0)", "color-use-token", ["var(--color-ink)"]],
      ["oklch(84.1% 0.238 128.85)", "color-use-token", ["var(--color-wide)"]],
      ["rgb(1 2 3 / 50%)", "color-unknown", []],
      ["bg-[oklch(84.1%_0.238_128.85)]", "color-use-token", ["bg-wide"]],
    ]);
  });

  it("colors 는 표기가 달라도 같은 색을 하나로 센다", async () => {
    const cwd = tempProject({
      "src/A.jsx": `export const A = () => <div className="bg-[#3B82F6] text-[rgb(59,130,246)]" style={{ color: "rgb(59, 130, 246)" }} />;`,
      "src/a.css": `.a { color: hsl(0 0% 100%); }`,
    });
    const result = await collectColors({ cwd });
    expect(result.colors.map(({ color, uses }) => [color, uses])).toEqual([
      ["#3b82f6", 3],
      ["#ffffff", 1],
    ]);
  });
});
