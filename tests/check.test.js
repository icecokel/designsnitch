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
      },
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
    });
  });
});
