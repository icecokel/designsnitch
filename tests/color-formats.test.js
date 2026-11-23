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
      code: `<div className="bg-[rgb(1,2,3)] text-[rgba(1,2,3,0.5)]" />`,
      errors: [
        { message: "bg-[rgb(1,2,3)]의 색은 토큰에 없습니다." },
        { message: "text-[rgba(1,2,3,0.5)]의 색은 토큰에 없습니다." },
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

describe("@apply 안의 클래스", () => {
  it("CSS 의 @apply 에 쓴 임의 값 색을 찾고, 토큰 클래스를 후보로 낸다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-brand: #3B82F6; }`,
      "src/a.css": `.btn {\n  @apply px-4 bg-[#3B82F6] hover:text-[#123456];\n}`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });

    expect(result.violations.map((v) => [v.line, v.column, v.endColumn, v.found, v.rule, v.candidates, v.action])).toEqual([
      [2, 15, 27, "bg-[#3B82F6]", "color-use-token", ["bg-brand"], "replace"],
      [2, 34, 48, "text-[#123456]", "color-unknown", [], "ask"],
    ]);
    expect(result.violations[0].message).toBe("bg-[#3B82F6] has the same color as --color-brand. Use instead: bg-brand");

    const colors = await collectColors({ cwd });
    expect(colors.colors.map(({ color, utilities }) => [color, utilities])).toEqual([
      ["#3b82f6", { bg: 1 }],
      ["#123456", { text: 1 }],
    ]);
  });
});

describe("이름으로 적은 색", () => {
  it("색 속성의 CSS 선언, 인라인 스타일, 임의 값 클래스에서 찾는다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-surface: white; }`,
      "src/a.css": `.a { color: white; border: 1px solid red; white-space: nowrap; transition: color 1s; font-family: Tan; content: "red"; --local: gold; --mixed: 1px red; }`,
      "src/A.jsx": `export const A = () => <div className="bg-[white] text-[tomato]" title="red" style={{ color: "white", borderTop: "1px solid red", display: "block" }} />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });

    expect(result.violations.map((v) => [v.file, v.found, v.rule, v.candidates])).toEqual([
      ["src/a.css", "white", "color-use-token", ["var(--color-surface)"]],
      ["src/a.css", "red", "color-unknown", []],
      ["src/a.css", "gold", "color-unknown", []],
      ["src/A.jsx", "bg-[white]", "color-use-token", ["bg-surface"]],
      ["src/A.jsx", "text-[tomato]", "color-unknown", []],
      ["src/A.jsx", "white", "color-use-token", ["var(--color-surface)"]],
      ["src/A.jsx", "red", "color-unknown", []],
    ]);
    expect(result.unchecked).toEqual({ colors: 0, files: 0 });

    const colors = await collectColors({ cwd });
    expect(Object.fromEntries(colors.colors.map(({ color, uses }) => [color, uses]))).toEqual({
      "#ffffff": 4, // tokens.css 의 선언도 센다. 설정 없이 모으기 때문이다
      "#ff0000": 1, // 인라인 스타일의 긴 문자열 속 색은 colors 가 아직 세지 않는다
      "#ffd700": 1,
      "#ff6347": 1,
    });
  });
});

describe("클래스로만 쓸 수 있는 토큰", () => {
  it("JS 설정의 색을 CSS 선언이나 인라인 스타일에 직접 쓰면 후보 없이 알린다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "app.css" }`,
      "app.css": `@config "./tailwind.config.js";`,
      "tailwind.config.js": `module.exports = { theme: { extend: { colors: { brand: "#ff5a1f" } } } };`,
      "src/a.css": `.a { color: #ff5a1f; }`,
      "src/A.jsx": `export const A = () => <div style={{ color: "#ff5a1f" }} />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });

    expect(result.violations.map((v) => [v.file, v.rule, v.severity, v.candidates, v.action])).toEqual([
      ["src/a.css", "color-use-token", "error", [], "ask"],
      ["src/A.jsx", "color-use-token", "error", [], "ask"],
    ]);
    expect(result.violations[0].message).toBe(
      "#ff5a1f has the same color as --color-brand, but Tailwind makes no CSS variable for that token, so there is no var() to use here.",
    );
    expect(result.decisions).toMatchObject([{ subject: "#ff5a1f", uses: 2, reasons: ["class-only-token"] }]);
  });
});

describe("반투명한 색", () => {
  it("불투명한 색에 토큰이 있으면 그 토큰에 불투명도를 준 후보를 내고, 사람이 정하게 한다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-brand: #3B82F6; --color-black: #000; }`,
      "src/a.css": `.a { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); color: #12345680; }`,
      "src/A.jsx": `export const A = () => <div className="bg-[#3B82F680] text-[rgb(59_130_246/25%)]" style={{ borderColor: "rgb(59 130 246 / 0.5)" }} />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });

    expect(result.violations.map((v) => [v.found, v.rule, v.severity, v.action, v.candidates])).toEqual([
      ["rgba(0, 0, 0, 0.1)", "color-use-token", "error", "ask", ["color-mix(in srgb, var(--color-black) 10%, transparent)"]],
      ["#12345680", "color-unknown", "warning", "ask", []],
      ["bg-[#3B82F680]", "color-use-token", "error", "ask", ["bg-brand/50"]],
      ["text-[rgb(59_130_246/25%)]", "color-use-token", "error", "ask", ["text-brand/25"]],
      ["rgb(59 130 246 / 0.5)", "color-use-token", "error", "ask", ["color-mix(in srgb, var(--color-brand) 50%, transparent)"]],
    ]);
    expect(result.violations[2].message).toBe("bg-[#3B82F680] is --color-brand at 50% opacity. Use instead: bg-brand/50");
    expect(result.decisions.map((d) => [d.subject, d.reasons])).toEqual([
      ["#0000001a", ["translucent"]],
      ["#12345680", ["no-token"]],
      ["#3b82f680", ["translucent"]],
      ["#3b82f640", ["translucent"]],
      ["#3b82f680", ["translucent"]], // 인라인 스타일. 후보가 클래스가 아니라서 따로 묻는다
    ]);
  });
});

describe("JSX style 속성 밖의 색", () => {
  const base = {
    "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
    "tokens.css": `@theme { --color-brand: #3B82F6; --color-white: #fff; }`,
  };
  const run = async (file, code) => {
    const cwd = tempProject({ ...base, [file]: code });
    return check({ cwd, config: loadConfig(cwd), lang: "en" });
  };
  const brief = (result) => result.violations.map((v) => [v.found, v.rule, v.action, v.candidates]);

  it("CSSProperties 타입의 객체는 인라인 스타일처럼 검사한다", async () => {
    const result = await run(
      "src/a.tsx",
      `import type { CSSProperties } from "react";
const typed: CSSProperties = { color: "#3B82F6", backgroundColor: "white", border: "1px solid #123456" };
const cast = { fill: "#3B82F6" } as React.CSSProperties;
export const use = [typed, cast];`,
    );
    expect(brief(result)).toEqual([
      ["#3B82F6", "color-use-token", "replace", ["var(--color-brand)"]],
      ["white", "color-use-token", "replace", ["var(--color-white)"]],
      ["#123456", "color-unknown", "ask", []],
      ["#3B82F6", "color-use-token", "replace", ["var(--color-brand)"]],
    ]);
    expect(result.unchecked).toEqual({ colors: 0, files: 0 });
  });

  it("변수 이름이 style 로 끝난다는 것만으로는 스타일로 보지 않는다. 차트 설정 묶음일 수 있다", async () => {
    const result = await run(
      "src/b.tsx",
      `const VARIANT_STYLES = { model: { containerClassName: "p-4", lineWidth: 3, guideLineColor: "#3B82F6" } };
const cardStyle = { color: "#3B82F6" };
export const Chart = () => <Line guide={VARIANT_STYLES.model.guideLineColor} style={cardStyle} />;`,
    );
    expect(brief(result)).toEqual([
      ["#3B82F6", "color-use-token", "ask", ["var(--color-brand)"]],
      ["#3B82F6", "color-use-token", "ask", ["var(--color-brand)"]],
    ]);
    expect(result.decisions[0].reasons).toEqual(["not-a-style"]);
  });

  it("색을 받는 이름의 속성과 JSX 속성(차트 옵션, SVG)은 잡되, var() 가 통하는지 알 수 없으니 사람이 정하게 한다", async () => {
    const result = await run(
      "src/chart.jsx",
      `const data = { datasets: [{ backgroundColor: "#3B82F6", borderColor: "#123456", pointHoverBackgroundColor: "#3B82F6" }] };
export const Chart = () => <Line data={data} stroke="#3B82F6" fill={"#fff"} color="red" title="#3B82F6" />;`,
    );
    expect(brief(result)).toEqual([
      ["#3B82F6", "color-use-token", "ask", ["var(--color-brand)"]],
      ["#123456", "color-unknown", "ask", []],
      ["#3B82F6", "color-use-token", "ask", ["var(--color-brand)"]],
      ["#3B82F6", "color-use-token", "ask", ["var(--color-brand)"]],
      ["#fff", "color-use-token", "ask", ["var(--color-white)"]],
    ]);
    expect(result.violations[0].message).toBe(
      "#3B82F6 has the same color as --color-brand. It is not in a style, so check that var() works where this value is used. Candidate: var(--color-brand)",
    );
    expect(result.decisions[0]).toMatchObject({ subject: "#3b82f6", uses: 3, reasons: ["not-a-style"] });
    // title 의 값은 색을 받는 속성이 아니라서 세기만 한다. color="red" 는 색 이름인지 변형 이름인지 알 수 없어 건드리지 않는다.
    expect(result.unchecked).toEqual({ colors: 1, files: 1 });
  });

  it("색을 받는 이름이 아닌 키와 배열의 색은 여전히 세기만 한다", async () => {
    const result = await run("src/theme.js", `export const theme = { primary: "#3B82F6", series: ["#3B82F6", "#123456"] };`);
    expect(brief(result)).toEqual([]);
    expect(result.unchecked).toEqual({ colors: 3, files: 1 });
  });
});

describe("완전히 투명한 값", () => {
  it("알파가 0 인 색은 색을 쓴 것이 아니므로 찾지 않는다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-white: #fff; }`,
      "src/a.css": `.a { background: linear-gradient(rgba(255, 255, 255, 0.0), rgba(255, 255, 255, 0.004)); color: #12345600; border-color: rgb(1 2 3 / 0%); }`,
      "src/A.jsx": `export const A = () => <div className="bg-[#fff0] text-[rgba(9,9,9,0)]" style={{ color: "rgba(255, 255, 255, 0)" }} />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    // 0.004 처럼 0 은 아니지만 반올림하면 0% 가 되는 값은 1% 로 알린다.
    expect(result.violations.map((v) => [v.found, v.candidates])).toEqual([
      ["rgba(255, 255, 255, 0.004)", ["color-mix(in srgb, var(--color-white) 1%, transparent)"]],
    ]);
    const colors = await collectColors({ cwd });
    // tokens.css 의 #fff 선언도 센다. 설정 없이 모으기 때문이다.
    expect(colors.colors.map((c) => c.color).sort()).toEqual(["#ffffff", "#ffffff01"]);
  });
});
