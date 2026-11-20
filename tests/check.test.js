import path from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import { loadConfig } from "../src/config.js";
import { tempProject } from "./temp-project.js";

const cwd = path.resolve("tests/fixtures/project");

describe("check", () => {
  it("프로젝트를 검사해서 위반 목록과 요약을 돌려준다", async () => {
    const result = await check({ cwd, config: loadConfig(cwd) });

    expect(result.designSystem).toEqual({ colorTokens: 3, components: 1, replacedTags: 1 });
    expect(result.problems).toEqual([]);
    // tsx 3개와 토큰 CSS(app/globals.css) 1개
    expect(result.summary).toEqual({ files: 4, errors: 3, warnings: 0 });
    expect(result.violations).toEqual([
      {
        file: "src/PayButton.tsx",
        line: 5,
        column: 6,
        endLine: 5,
        endColumn: 12,
        rule: "use-ds-component",
        severity: "error",
        message: "<button> 대신 디자인 시스템 컴포넌트를 사용하세요: Button (./components/ui)",
        found: "button",
        candidates: ["Button"],
        action: "replace",
      },
      {
        file: "src/PayButton.tsx",
        line: 5,
        column: 24,
        endLine: 5,
        endColumn: 36,
        rule: "color-use-token",
        severity: "error",
        message:
          "bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500",
        found: "bg-[#3B82F6]",
        candidates: ["bg-primary-500"],
        action: "replace",
      },
      {
        file: "src/PayButton.tsx",
        line: 5,
        column: 37,
        endLine: 5,
        endColumn: 48,
        rule: "color-use-token",
        severity: "error",
        message:
          "text-[#FFF]의 색은 토큰 --color-white, --color-surface의 값입니다. 대신 사용: text-white, text-surface",
        found: "text-[#FFF]",
        candidates: ["text-white", "text-surface"],
        action: "ask",
      },
    ]);
  });

  it("경로를 주면 그 안만 검사한다", async () => {
    const result = await check({ cwd, config: loadConfig(cwd), paths: ["components"] });
    expect(result).toMatchObject({
      summary: { files: 1, errors: 0, warnings: 0 },
      violations: [],
    });
  });

  it("컴포넌트 교체는 정적 조건이 맞을 때만 가능하고 동적 속성과 spread 는 확인을 요청한다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": JSON.stringify({
        tokens: "tokens.css",
        components: {
          path: "ui",
          replaces: {
            input: { component: "InputCell", when: { type: ["text", "number", null] } },
            button: "Button",
            dialog: ["Dialog", "AlertDialog"],
            select: { component: ["Select", "Listbox"] },
          },
        },
      }),
      "tokens.css": `@theme { --color-primary: #3B82F6; }`,
      "ui/input.tsx": `export const InputCell = () => <input />;`,
      "src/form.tsx": [
        `<input type="file" />;`,
        `<input type="text" />;`,
        `<input />;`,
        `<input type={x} />;`,
        `<input type="range" {...props} />;`,
        `<button onClick={pay} />;`,
        `<button {...props} />;`,
        `<dialog />;`,
        `<select />;`,
        `<input type={"number"} />;`,
        `<input type />;`,
      ].join("\n"),
    });
    const result = await check({ cwd, config: loadConfig(cwd) });

    expect(result.designSystem).toEqual({ colorTokens: 1, components: 6, replacedTags: 4 });
    expect(result.violations.map(({ line, severity, action, candidates }) => [line, severity, action, candidates])).toEqual([
      [2, "error", "replace", ["InputCell"]],
      [3, "error", "replace", ["InputCell"]],
      [4, "error", "ask", ["InputCell"]],
      [5, "error", "ask", ["InputCell"]],
      [6, "error", "replace", ["Button"]],
      [7, "error", "ask", ["Button"]],
      [8, "error", "ask", ["Dialog", "AlertDialog"]],
      [9, "error", "ask", ["Select", "Listbox"]],
      [10, "error", "replace", ["InputCell"]],
    ]);
    expect(result.violations[2].message).toContain('"type" 속성 값이 동적');
    expect(result.violations[3].message).toContain("spread 속성");
    expect(result.violations[5].message).toContain("spread 속성");
  });
});

describe("프로젝트 코드에 있는 주석과 문법 오류", () => {
  const base = {
    "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
    "tokens.css": `@theme { --color-primary: #3B82F6; }`,
  };
  const checkProject = (files) => {
    const cwd = tempProject({ ...base, ...files });
    return check({ cwd, config: loadConfig(cwd) });
  };

  it("다른 플러그인 규칙용 eslint-disable 주석은 문제 삼지 않는다", async () => {
    const result = await checkProject({
      "src/Legacy.tsx": [
        `// eslint-disable-next-line react-hooks/exhaustive-deps`,
        `export const Legacy = () => <div className="p-4" />;`,
        `/* eslint-disable @next/next/no-img-element */`,
      ].join("\n"),
    });
    // Legacy.tsx 와 tokens.css
    expect(result).toMatchObject({ summary: { files: 2, errors: 0, warnings: 0 }, violations: [] });
  });

  it("eslint-disable 주석으로 예외를 둔 줄은 보고하지 않는다", async () => {
    const result = await checkProject({
      "src/Campaign.tsx": [
        `export const Campaign = () => (`,
        `  <div>`,
        `    {/* eslint-disable-next-line designsnitch/color-unknown -- 캠페인 전용 색 */}`,
        `    <p className="text-[#FF00AA]" />`,
        `    <p className="text-[#FF00AB]" />`,
        `  </div>`,
        `);`,
      ].join("\n"),
    });
    expect(result.violations.map(({ line, found }) => ({ line, found }))).toEqual([
      { line: 5, found: "text-[#FF00AB]" },
    ]);
  });

  it("파싱하지 못한 파일은 parse-error 로 보고한다", async () => {
    const result = await checkProject({ "src/Broken.tsx": `export const Broken = () => <div` });
    expect(result.summary).toEqual({ files: 2, errors: 1, warnings: 0 });
    expect(result.violations[0]).toMatchObject({
      file: "src/Broken.tsx",
      rule: "parse-error",
      severity: "error",
      found: "",
      candidates: [],
      action: "repair",
    });
  });
});

describe("설정을 읽은 결과", () => {
  const checkProject = (files) => {
    const cwd = tempProject(files);
    return check({ cwd, config: loadConfig(cwd) });
  };

  it("대체 컴포넌트가 여러 개면 모두 후보로 돌려준다", async () => {
    const result = await checkProject({
      "designsnitch.config.json": JSON.stringify({
        tokens: "tokens.css",
        components: {
          path: "ui",
          replaces: { button: ["SolidButton", "GlassButton"], input: "Input" },
        },
      }),
      "tokens.css": `@theme { --color-primary: #3B82F6; }`,
      "ui/solid-button.tsx": `export const SolidButton = () => <button />;`,
      "src/Pay.tsx": `export const Pay = () => <button>결제</button>;`,
    });
    expect(result.designSystem).toMatchObject({ components: 3, replacedTags: 2 });
    expect(result.violations).toMatchObject([
      { rule: "use-ds-component", found: "button", candidates: ["SolidButton", "GlassButton"] },
    ]);
  });

  it("components 설정이 없으면 컴포넌트 수는 0이다", async () => {
    const result = await checkProject({
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-primary: #3B82F6; --text-sm: 0.875rem; }`,
    });
    expect(result.designSystem).toEqual({ colorTokens: 1, components: 0, replacedTags: 0 });
  });

  it("색 토큰을 하나도 읽지 못하면 problems 로 알린다", async () => {
    const result = await checkProject({
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-primary: oklch(0.6 0.2 250); }`,
      "src/Card.tsx": `export const Card = () => <div className="bg-[#3B82F6]" />;`,
    });
    expect(result.designSystem.colorTokens).toBe(0);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain("색 토큰을 하나도 읽지 못했습니다");
    expect(result.problems[0]).toContain("tokens.css");
  });

  it("디자인 시스템 컴포넌트 경로가 없으면 검사하지 않고 알린다", async () => {
    await expect(
      checkProject({
        "designsnitch.config.json": JSON.stringify({
          tokens: "tokens.css",
          components: { path: "components/ui", replaces: { button: "Button" } },
        }),
        "tokens.css": `@theme { --color-primary: #3B82F6; }`,
      }),
    ).rejects.toThrow("components/ui");
  });
});

describe("CSS 파일", () => {
  const base = {
    "designsnitch.config.json": `{ "tokens": "app/globals.css" }`,
    "app/globals.css": [
      `@import "tailwindcss";`,
      `:root { --primary-500: #3B82F6; }`,
      `@theme { --color-primary-500: var(--primary-500); --color-brand: #3b82f6; --color-surface: #ffffff; }`,
      `body { color: #FFF; }`,
    ].join("\n"),
  };
  const checkProject = (files, paths) => {
    const cwd = tempProject({ ...base, ...files });
    return check({ cwd, config: loadConfig(cwd), paths });
  };

  it("토큰이 있는 색은 var() 후보와 함께 오류로, 없는 색은 경고로 보고한다", async () => {
    const result = await checkProject({
      "src/card.module.css": [".card {", "  color: #3B82F6;", "  border: 1px solid #3B82F5;", "}"].join("\n"),
    });

    expect(result.summary).toEqual({ files: 2, errors: 2, warnings: 1 });
    expect(result.violations).toEqual([
      {
        file: "app/globals.css",
        line: 4,
        column: 15,
        endLine: 4,
        endColumn: 19,
        rule: "color-use-token",
        severity: "error",
        message: "#FFF의 색은 토큰 --color-surface의 값입니다. 대신 사용: var(--color-surface)",
        found: "#FFF",
        candidates: ["var(--color-surface)"],
        action: "replace",
      },
      {
        file: "src/card.module.css",
        line: 2,
        column: 10,
        endLine: 2,
        endColumn: 17,
        rule: "color-use-token",
        severity: "error",
        message:
          "#3B82F6의 색은 토큰 --color-primary-500, --color-brand의 값입니다. 대신 사용: var(--color-primary-500), var(--color-brand)",
        found: "#3B82F6",
        candidates: ["var(--color-primary-500)", "var(--color-brand)"],
        action: "ask",
      },
      {
        file: "src/card.module.css",
        line: 3,
        column: 21,
        endLine: 3,
        endColumn: 28,
        rule: "color-unknown",
        severity: "warning",
        message: "#3B82F5의 색은 토큰에 없습니다.",
        found: "#3B82F5",
        candidates: [],
        action: "ask",
      },
    ]);
  });

  it("토큰 CSS 밖의 사용자 정의 속성에 있는 색을 검사한다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": '{ "tokens": "./tokens.css" }',
      "tokens.css": `@theme { --color-a: #fff; }`,
      "src/tokens.css": `.card { --brand: #ff00aa; --white: #fff; }`,
    });
    const result = await check({ cwd, config: loadConfig(cwd) });

    expect(result.summary).toEqual({ files: 2, errors: 1, warnings: 1 });
    expect(result.violations).toMatchObject([
      { file: "src/tokens.css", rule: "color-unknown", severity: "warning", found: "#ff00aa", candidates: [] },
      { file: "src/tokens.css", rule: "color-use-token", severity: "error", found: "#fff", candidates: ["var(--color-a)"] },
    ]);
  });

  it("JS 와 CSS 의 위반을 파일 순서대로 함께 돌려준다", async () => {
    const result = await checkProject({
      "src/b.css": `.b { color: #123456; }`,
      "src/a.tsx": `export const A = () => <div className="bg-[#123456]" />;`,
    });
    expect(result.summary.files).toBe(3);
    expect(result.violations.map(({ file, found }) => ({ file, found }))).toEqual([
      { file: "app/globals.css", found: "#FFF" },
      { file: "src/a.tsx", found: "bg-[#123456]" },
      { file: "src/b.css", found: "#123456" },
    ]);
  });

  it("CSS 파일을 직접 지정하면 그 파일만 검사한다", async () => {
    const result = await checkProject(
      { "src/b.css": `.b { color: #123456; }`, "src/a.tsx": `export const a = "bg-[#123456]";` },
      ["src/b.css"],
    );
    expect(result.summary.files).toBe(1);
    expect(result.violations.map((v) => v.file)).toEqual(["src/b.css"]);
  });

  it("node_modules 와 빌드 결과물의 CSS 는 보지 않는다", async () => {
    const result = await checkProject({
      "node_modules/pkg/style.css": `.x { color: #123456; }`,
      "dist/out.css": `.x { color: #123456; }`,
      ".next/static/a.css": `.x { color: #123456; }`,
    });
    expect(result.violations.map((v) => v.file)).toEqual(["app/globals.css"]);
  });

  it("주석으로 예외를 둔 선언은 보고하지 않는다", async () => {
    const result = await checkProject({
      "src/c.css": `.c {\n  /* designsnitch-disable-next-line */\n  color: #FF00AA;\n  background: #FF00AB;\n}`,
    });
    expect(result.violations.filter((v) => v.file === "src/c.css").map((v) => v.found)).toEqual(["#FF00AB"]);
  });

  it("읽지 못한 CSS 파일은 parse-error 로 보고한다", async () => {
    const result = await checkProject({ "src/broken.css": `.a { color: red` + "\n" + `.b {{ }` });
    expect(result.violations.find((v) => v.file === "src/broken.css")).toMatchObject({
      rule: "parse-error",
      severity: "error",
      found: "",
      candidates: [],
      action: "repair",
    });
  });
});

it("JS·TS 와 CSS 에서 테마별 토큰 후보가 있으면 오류 등급으로 확인을 요청한다", async () => {
  const cwd = tempProject({
    "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
    "tokens.css": `
      :root { --surface: #fff; --fixed: #abc; }
      .dark { --surface: #111827; --fixed: #AABBCC; }
      @theme { --color-surface: var(--surface); --color-fixed: var(--fixed); --color-white: #fff; }
    `,
    "src/a.tsx": `<div className="bg-[#111827] text-[#ABC] border-[#fff]" />;`,
    "src/b.css": `.card { background: #111827; color: #ABC; border-color: #fff; }`,
  });
  const result = await check({ cwd, config: loadConfig(cwd) });

  expect(result.summary).toEqual({ files: 3, errors: 6, warnings: 0 });
  expect(result.violations.map(({ found, action, candidates }) => [found, action, candidates])).toEqual([
    ["bg-[#111827]", "ask", ["bg-surface"]],
    ["text-[#ABC]", "replace", ["text-fixed"]],
    ["border-[#fff]", "ask", ["border-surface", "border-white"]],
    ["#111827", "ask", ["var(--color-surface)"]],
    ["#ABC", "replace", ["var(--color-fixed)"]],
    ["#fff", "ask", ["var(--color-surface)", "var(--color-white)"]],
  ]);
  const themedHint = "그 토큰으로 바꾸면 다른 테마에서 색이 바뀔 수 있습니다.";
  for (const i of [0, 2, 3, 5]) expect(result.violations[i].message).toContain(themedHint);
  for (const i of [1, 4]) expect(result.violations[i].message).toContain("대신 사용:");
});

describe("다음에 할 일 (next)", () => {
  const base = {
    "designsnitch.config.json": JSON.stringify({
      tokens: "tokens.css",
      components: { path: "ui", replaces: { button: ["SolidButton", "GhostButton"] } },
    }),
    "tokens.css": `@theme { --color-primary: #3B82F6; }`,
    "ui/solid-button.tsx": `export const SolidButton = () => null;`,
  };
  const checkProject = (files, overrides = {}) => {
    const cwd = tempProject({ ...base, ...overrides, ...files });
    return check({ cwd, config: loadConfig(cwd) });
  };

  it("위반이 없으면 할 일이 없다고 알린다", async () => {
    const result = await checkProject({ "src/a.tsx": `export const A = () => <div className="bg-primary" />;` });
    expect(result.next).toEqual(["위반이 없습니다."]);
  });

  it("바로 바꿀 것, 사람에게 물을 것, 문법을 고칠 것을 나눠서 순서대로 알린다", async () => {
    const result = await checkProject({
      "src/a.tsx": `export const A = () => <button className="bg-[#3B82F6] text-[#123456]" />;`,
      "src/broken.tsx": `export const B = () => <div`,
    });
    expect(result.violations.map(({ rule, action }) => `${rule}:${action}`)).toEqual([
      "use-ds-component:ask",
      "color-use-token:replace",
      "color-unknown:ask",
      "parse-error:repair",
    ]);
    expect(result.next).toEqual([
      "action이 repair인 1건은 그 파일의 문법 오류부터 고치세요.",
      "action이 replace인 1건은 found를 candidates의 값으로 바꾸세요.",
      "action이 ask인 2건은 바꾸지 말고 사용자에게 물으세요. 물을 때는 `designsnitch colors`로 그 색이 몇 곳에서 어떻게 쓰이는지 확인해서 근거로 함께 주세요.",
      "고친 뒤 같은 명령을 다시 실행하세요.",
    ]);
  });

  it("색 토큰이 없으면 색을 고치기 전에 토큰부터 정하라고 알린다", async () => {
    const result = await checkProject(
      { "src/a.tsx": `export const A = () => <div className="bg-[#3B82F6]" />;` },
      { "tokens.css": `@import "tailwindcss";` },
    );
    // 토큰이 없으면 색을 하나씩 묻는 것은 의미가 없다. 토큰을 정하는 일 하나만 남긴다.
    expect(result.next).toEqual([
      "색 토큰이 없어서 색을 판정할 기준이 없습니다. 색을 고치기 전에 `designsnitch colors`로 쓰이는 색을 모아 토큰부터 정하세요.",
    ]);
  });
});
