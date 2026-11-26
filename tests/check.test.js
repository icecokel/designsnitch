import path from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import { loadConfig } from "../src/config.js";
import { formatText } from "../src/format.js";
import { tempProject } from "./temp-project.js";

const cwd = path.resolve("tests/fixtures/project");

describe("check", () => {
  it("프로젝트를 검사해서 위반 목록과 요약을 돌려준다", async () => {
    const result = await check({ cwd, config: loadConfig(cwd) });

    expect(result.designSystem).toEqual({ colorTokens: 3, paletteColors: 0, components: 1, replacedTags: 1 });
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
        recommended: "Button",
        action: "migrate",
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
        recommended: "bg-primary-500",
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
        recommended: null,
        action: "ask",
      },
    ]);
  });

  it("경로를 주면 그 안만 검사한다", async () => {
    const result = await check({ cwd, config: loadConfig(cwd), paths: ["components"] });
    expect(result).toMatchObject({
      summary: { files: 1, errors: 0, warnings: 0 },
      violations: [],
      decisions: [],
    });
  });

  it("컴포넌트로 옮기기는 정적 조건이 맞을 때만 가능하고 동적 속성과 spread 는 확인을 요청한다", async () => {
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

    expect(result.designSystem).toEqual({ colorTokens: 1, paletteColors: 0, components: 6, replacedTags: 4 });
    expect(result.violations.map(({ line, severity, action, candidates }) => [line, severity, action, candidates])).toEqual([
      [2, "error", "migrate", ["InputCell"]],
      [3, "error", "migrate", ["InputCell"]],
      [4, "error", "ask", ["InputCell"]],
      [5, "error", "ask", ["InputCell"]],
      [6, "error", "migrate", ["Button"]],
      [7, "error", "ask", ["Button"]],
      [8, "error", "ask", ["Dialog", "AlertDialog"]],
      [9, "error", "ask", ["Select", "Listbox"]],
      [10, "error", "migrate", ["InputCell"]],
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
    expect(result.designSystem).toEqual({ colorTokens: 1, paletteColors: 0, components: 0, replacedTags: 0 });
  });

  it("색 토큰을 하나도 읽지 못하면 problems 로 알린다", async () => {
    const result = await checkProject({
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-primary: color-mix(in srgb, red, blue); }`,
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
        recommended: "var(--color-surface)",
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
        recommended: null,
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
        recommended: null,
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

describe("토큰 범위와 선호", () => {
  const checkProject = (tokens, files) => {
    const cwd = tempProject({
      "designsnitch.config.json": JSON.stringify({ tokens: { file: "tokens.css", ...tokens } }),
      ...files,
    });
    return check({ cwd, config: loadConfig(cwd) });
  };

  it("역할에 맞는 후보를 먼저 보여 주고 하나일 때만 추천하며 ask 로 유지한다", async () => {
    const result = await checkProject({}, {
      "tokens.css": `@theme {
        --color-brand: #abc; --color-border-main: #abc; --color-text-main: #abc;
        --color-background: #abc; --color-surface-raised: #abc; --color-bg-main: #abc;
      }`,
      "src/a.tsx": `<div className="text-[#abc] border-t-[#abc] ring-offset-[#abc] outline-[#abc] divide-[#abc] bg-[#abc]" />;`,
      "src/b.css": `.card { COLOR: #abc; border-top-color: #abc; background-color: #abc; box-shadow: 0 0 #abc; }`,
    });
    const violations = result.violations.map(({ candidates, recommended, action }) => [candidates, recommended, action]);
    const names = ["brand", "border-main", "text-main", "background", "surface-raised", "bg-main"];
    const ordered = (first) => [...first, ...names.filter((name) => !first.includes(name))];
    const js = (utility, first) => ordered(first).map((name) => `${utility}-${name}`);
    const css = (first) => ordered(first).map((name) => `var(--color-${name})`);
    const bg = ["background", "surface-raised", "bg-main"];
    expect(violations).toEqual([
      [js("text", ["text-main"]), "text-text-main", "ask"],
      ...["border-t", "ring-offset", "outline", "divide"].map((utility) =>
        [js(utility, ["border-main"]), `${utility}-border-main`, "ask"]),
      [js("bg", bg), null, "ask"],
      [css(["text-main"]), "var(--color-text-main)", "ask"],
      [css(["border-main"]), "var(--color-border-main)", "ask"],
      [css(bg), null, "ask"],
      [css([]), null, "ask"],
    ]);
  });

  it("우선 접두어가 고른 후보만 남기고 제외된 색은 토큰이 없는 것으로 본다", async () => {
    const result = await checkProject({
      exclude: ["--color-chart-*"],
      prefer: ["--color-chart-", "--color-border-", "--color-text-"],
    }, {
      "tokens.css": `@theme {
        --color-text-main: #abc; --color-border-main: #abc; --color-chart-a: #abc; --color-chart-b: #def;
      }`,
      "src/a.tsx": `<div className="text-[#abc] text-[#def]" />;`,
      "src/b.css": `.card { color: #abc; background: #def; }`,
    });
    expect(result.designSystem.colorTokens).toBe(2);
    expect(result.violations.map(({ rule, candidates, recommended, action }) =>
      [rule, candidates, recommended, action])).toEqual([
      ["color-use-token", ["text-border-main"], "text-border-main", "replace"],
      ["color-unknown", [], null, "ask"],
      ["color-use-token", ["var(--color-border-main)"], "var(--color-border-main)", "replace"],
      ["color-unknown", [], null, "ask"],
    ]);
  });

  it("첫 선호 접두어에 후보가 여럿이면 역할로 정렬하고 선택은 사용자에게 맡긴다", async () => {
    const result = await checkProject({ prefer: ["--color-text-", "--color-brand"] }, {
      "tokens.css": `@theme { --color-brand: #abc; --color-text-main: #abc; --color-text-muted: #abc; }`,
      "src/a.tsx": `<div className="text-[#abc]" />;`,
    });
    expect(result.violations[0]).toMatchObject({
      action: "ask",
      candidates: ["text-text-main", "text-text-muted", "text-brand"],
      recommended: null,
    });
  });

  it("선호 후보가 테마별 토큰이면 추천해도 ask 로 유지한다", async () => {
    const result = await checkProject({ prefer: ["--color-surface"] }, {
      "tokens.css": `
        @theme { --color-surface: #abc; --color-brand: #abc; }
        .dark { --color-surface: #111; }
      `,
      "src/a.tsx": `<div className="bg-[#abc]" />;`,
      "src/b.css": `.card { background: #abc; }`,
    });
    expect(result.violations).toMatchObject([
      { action: "ask", candidates: ["bg-surface"], recommended: "bg-surface" },
      { action: "ask", candidates: ["var(--color-surface)"], recommended: "var(--color-surface)" },
    ]);
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
      "action이 replace인 1건은 npx designsnitch check --fix 로 고치세요. found를 후보로 바꿉니다. 경로를 주면 그 파일만 고칩니다.",
      "변경하기 전에 decisions의 2건을 사용자에게 물으세요. 사용 횟수와 후보, 확인이 필요한 이유를 함께 알려 주세요.",
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
    expect(result.decisions).toMatchObject([{ subject: "#3b82f6", reasons: ["no-token"] }]);
  });
});

describe("사용자 결정 (decisions)", () => {
  const checkProject = (files, replaces) => {
    const cwd = tempProject({
      "designsnitch.config.json": JSON.stringify({
        tokens: "tokens.css",
        ...(replaces && { components: { path: "ui", replaces } }),
      }),
      "ui/index.tsx": "export {};",
      "tokens.css": "@theme { --color-primary: #3b82f6; }",
      ...files,
    });
    return check({ cwd, config: loadConfig(cwd) });
  };

  it("색과 태그별로 ask 를 묶어 사용 횟수, 파일 수, 위치 다섯 개와 이유를 보여 준다", async () => {
    const result = await checkProject({
      "src/a.tsx": [
        "<input type={kind} />;",
        '"bg-[#FFF]";',
        '"text-[#ffffff]";',
        '"border-[#FfF]";',
        '"fill-[#FFFFFF]";',
        '"ring-[#fff]";',
        '"text-[#3b82f6]";',
      ].join("\n"),
      "src/b.tsx": '<input {...props} />;\n"text-[#fff]";',
      "src/c.css": ".card { color: #FFFFFF; }",
      "src/d.tsx": "<div",
    }, { input: { component: ["Input", "SearchInput"], when: { type: ["text"] } } });
    expect(result.decisions).toEqual([
      {
        id: "decision-1",
        rule: "color-unknown",
        subject: "#ffffff",
        uses: 7,
        files: 3,
        locations: [2, 3, 4, 5, 6].map((line) => ({ file: "src/a.tsx", line, column: 2 })),
        candidates: [],
        recommended: null,
        reasons: ["no-token"],
      },
      {
        id: "decision-2",
        rule: "use-ds-component",
        subject: "<input>",
        uses: 2,
        files: 2,
        locations: [
          { file: "src/a.tsx", line: 1, column: 2 },
          { file: "src/b.tsx", line: 1, column: 2 },
        ],
        candidates: ["Input", "SearchInput"],
        recommended: null,
        reasons: ["multiple-candidates", "dynamic-props"],
      },
    ]);
    expect(result.next).toContain("변경하기 전에 decisions의 2건을 사용자에게 물으세요. 사용 횟수와 후보, 확인이 필요한 이유를 함께 알려 주세요.");
    expect(formatText(result)).toContain("사람이 정해야 하는 것 9건 (결정 2개)");
  });

  it("후보가 같으면 역할별 순서와 관계없이 묶고 모든 위치에서 추천이 같을 때만 추천한다", async () => {
    const result = await checkProject({
      "tokens.css": `
        @theme { --color-text-main: #abc; --color-border-main: #abc; --color-surface: #eee; }
        .dark { --color-surface: #111; }
      `,
      "src/a.css": ".card { color: #ABC; border-color: #aabbcc; background: #eee; }",
      "src/b.tsx": '"text-[#abc] text-[#AABBCC] bg-[#abc] bg-[#eee]";',
    });
    expect(result.decisions.map(({ subject, uses, candidates, recommended, reasons }) =>
      [subject, uses, candidates, recommended, reasons])).toEqual([
      ["#aabbcc", 2, ["var(--color-text-main)", "var(--color-border-main)"], null, ["multiple-candidates"]],
      ["#aabbcc", 2, ["text-text-main", "text-border-main"], "text-text-main", ["multiple-candidates"]],
      ["#eeeeee", 1, ["var(--color-surface)"], "var(--color-surface)", ["themed-token"]],
      ["#aabbcc", 1, ["bg-text-main", "bg-border-main"], null, ["multiple-candidates"]],
      ["#eeeeee", 1, ["bg-surface"], "bg-surface", ["themed-token"]],
    ]);
  });

  it("알파가 있는 짧은 hex 도 펼쳐 같은 색의 결정을 묶는다", async () => {
    const result = await checkProject({
      "src/a.tsx": '"bg-[#ABCD] text-[#aabbccdd]";',
      "src/b.css": ".card { color: #aBcD; }",
    });
    expect(result.decisions).toMatchObject([
      { subject: "#aabbccdd", uses: 3, files: 2, reasons: ["no-token"] },
    ]);
  });
});

describe("검사하지 못한 색", () => {
  it("클래스와 인라인 스타일 밖의 문자열에 있는 색을 센다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-primary: #3B82F6; }`,
      "src/theme.ts": `export const theme = { primary: "#3B82F6", bg: "#fff", shadow: "0 0 0 1px #000" };`,
      "src/Card.jsx": `export const Card = () => <div className="bg-[#3B82F6]" style={{ color: "#3B82F6" }} />;`,
      "src/Link.jsx": `export const Link = () => <a href="#top" className="bg-primary">Top</a>;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd) });

    expect(result.unchecked).toEqual({ colors: 3, files: 1 });
    expect(formatText(result, "en")).toContain(
      "Not checked: 3 colors in other strings in 1 file, such as theme objects and chart options. `designsnitch colors` lists them.",
    );
  });

  it("없으면 0 이고 문장도 붙이지 않는다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-primary: #3B82F6; }`,
      "src/Card.jsx": `export const Card = () => <div className="bg-primary" />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd) });

    expect(result.unchecked).toEqual({ colors: 0, files: 0 });
    expect(formatText(result, "en")).not.toContain("Not checked");
  });
});

describe("컴포넌트로 옮기기", () => {
  it("후보 컴포넌트가 하나인 raw 태그는 replace 가 아니라 migrate 다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": JSON.stringify({
        tokens: "tokens.css",
        components: { path: "ui", replaces: { button: "Button" } },
      }),
      "tokens.css": `@theme { --color-primary: #3B82F6; }`,
      "ui/Button.jsx": `export const Button = (props) => <button {...props} />;`,
      "src/Pay.jsx": `export const Pay = () => <button onClick={pay} className="bg-[#3B82F6]">Pay</button>;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });

    expect(result.violations.map((v) => [v.rule, v.action, v.recommended])).toEqual([
      ["use-ds-component", "migrate", "Button"],
      ["color-use-token", "replace", "bg-primary"],
    ]);
    expect(result.next).toEqual([
      'action "replace" (1): run npx designsnitch check --fix, which replaces found with the candidate. Add paths to fix only those files.',
      'action "migrate" (1): replace the tag with the component in candidates. Read that component first: add the import, pass on the props it accepts, and drop className values it already applies. If it cannot do what the tag did or would change how it looks, do not change the component to make it fit: leave the tag and ask the user.',
      "After fixing, run the same command again.",
    ]);
    expect(formatText(result, "en")).toContain(
      "1 can be replaced right away, 1 to move to a component, 0 need a person's decision (0 decisions)",
    );
  });
});

describe("Tailwind 기본 팔레트를 기준으로 쓰기 (palette: tailwind)", () => {
  const tailwind = {
    "node_modules/tailwindcss/package.json": JSON.stringify({
      name: "tailwindcss",
      exports: { "./theme.css": "./theme.css" },
    }),
    "node_modules/tailwindcss/theme.css": `@theme default {
  --color-slate-500: oklch(55.4% 0.046 257.417);
  --color-indigo-600: oklch(51.1% 0.262 276.966);
  --color-lime-400: oklch(84.1% 0.238 128.85);
  --color-white: #fff;
}`,
    "package.json": `{ "name": "app" }`,
  };

  it("팔레트 색을 hex 로 쓰면 팔레트 클래스로 바꾸라는 오류다. 팔레트 클래스는 문제가 아니다", async () => {
    const cwd = tempProject({
      ...tailwind,
      "designsnitch.config.json": `{ "tokens": "app/globals.css", "palette": "tailwind" }`,
      "app/globals.css": `@import "tailwindcss";`,
      "src/Card.jsx": `export const Card = () => <div className="bg-[#62748e] text-slate-500 border-[#123456]" />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });

    expect(result.designSystem).toMatchObject({ colorTokens: 0, paletteColors: 4 });
    expect(result.problems).toEqual([]);
    expect(result.violations.map((v) => [v.found, v.rule, v.action, v.candidates])).toEqual([
      ["bg-[#62748e]", "color-use-token", "replace", ["bg-slate-500"]],
      ["border-[#123456]", "color-unknown", "ask", []],
    ]);
    expect(formatText(result, "en")).toContain("Design system: 0 color tokens and the Tailwind palette (4 colors)");
  });

  it("sRGB 밖의 팔레트 색은 hex 와 맞추지 않고 같은 oklch 값과만 맞춘다", async () => {
    const cwd = tempProject({
      ...tailwind,
      "designsnitch.config.json": `{ "tokens": "app/globals.css", "palette": "tailwind" }`,
      "app/globals.css": `@import "tailwindcss";`,
      "src/Card.jsx": `export const Card = () => <div className="bg-[#9ae600] text-[oklch(0.841_0.238_128.85)]" />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    expect(result.violations.map((v) => [v.rule, v.candidates])).toEqual([
      ["color-unknown", []],
      ["color-use-token", ["text-lime-400"]],
    ]);
  });

  it("프로젝트가 같은 이름의 토큰을 정의하면 프로젝트 값을 쓴다", async () => {
    const cwd = tempProject({
      ...tailwind,
      "designsnitch.config.json": `{ "tokens": "app/globals.css", "palette": "tailwind" }`,
      "app/globals.css": `@theme { --color-slate-500: #111111; }`,
      "src/Card.jsx": `export const Card = () => <div className="bg-[#111111] text-[#62748e]" />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    expect(result.designSystem).toMatchObject({ colorTokens: 1, paletteColors: 3 });
    expect(result.violations.map((v) => [v.found, v.rule])).toEqual([
      ["bg-[#111111]", "color-use-token"],
      ["text-[#62748e]", "color-unknown"],
    ]);
  });

  it("tailwindcss 를 찾지 못하면 실행하지 못한다고 알린다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "app/globals.css", "palette": "tailwind" }`,
      "app/globals.css": `@import "tailwindcss";`,
      "src/Card.jsx": `export const Card = () => <div />;`,
    });
    await expect(check({ cwd, config: loadConfig(cwd), lang: "en" })).rejects.toThrow(
      /"palette": "tailwind".*tailwindcss/,
    );
  });

  // 공식 문서의 설정법: https://tailwindcss.com/docs/colors, https://tailwindcss.com/docs/theme
  it.each([
    ["--color-*: initial 은 팔레트 전체를 없앤다", "--color-*: initial;", 0],
    ["--*: initial 은 테마 전체를 없앤다", "--*: initial;", 0],
    ["--color-slate-*: initial 은 그 계열만 없앤다", "--color-slate-*: initial;", 3],
  ])("%s", async (_name, reset, paletteColors) => {
    const cwd = tempProject({
      ...tailwind,
      "designsnitch.config.json": `{ "tokens": "app/globals.css", "palette": "tailwind" }`,
      "app/globals.css": `@import "tailwindcss";\n@theme { ${reset} --color-brand: #3B82F6; }`,
      "src/Card.jsx": `export const Card = () => <div className="bg-[#62748e] text-[#3B82F6]" />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    expect(result.designSystem).toMatchObject({ colorTokens: 1, paletteColors });
    expect(result.violations.map((v) => [v.found, v.rule, v.candidates])).toEqual([
      ["bg-[#62748e]", "color-unknown", []],
      ["text-[#3B82F6]", "color-use-token", ["text-brand"]],
    ]);
  });

  it("기본색을 oklch 로 덮어쓰면 프로젝트 값을 쓴다", async () => {
    const cwd = tempProject({
      ...tailwind,
      "designsnitch.config.json": `{ "tokens": "app/globals.css", "palette": "tailwind" }`,
      "app/globals.css": `@import "tailwindcss";\n@theme { --color-slate-500: oklch(51.1% 0.262 276.966); }`,
      "src/Card.jsx": `export const Card = () => <div className="bg-[#62748e] text-[#4f39f6]" />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    expect(result.violations.map((v) => [v.found, v.rule, v.candidates])).toEqual([
      ["bg-[#62748e]", "color-unknown", []],
      ["text-[#4f39f6]", "color-use-token", ["text-slate-500", "text-indigo-600"]],
    ]);
  });

  it("palette 값은 tailwind 만 받는다", () => {
    const cwd = tempProject({ "designsnitch.config.json": `{ "tokens": "a.css", "palette": "material" }` });
    expect(() => loadConfig(cwd, undefined, "en")).toThrow(/"palette"/);
  });
});
