import path from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import { loadConfig } from "../src/config.js";
import { tempProject } from "./temp-project.js";

const cwd = path.resolve("tests/fixtures/project");

describe("check", () => {
  it("프로젝트를 검사해서 위반 목록과 요약을 돌려준다", async () => {
    const result = await check({ cwd, config: loadConfig(cwd) });

    expect(result.designSystem).toEqual({
      colorTokens: 3,
      radiusTokens: 1,
      textTokens: 0,
      components: 1,
      replacedTags: 1,
    });
    expect(result.problems).toEqual([]);
    expect(result.summary).toEqual({ files: 3, errors: 3, warnings: 1 });
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
      {
        file: "src/PayButton.tsx",
        line: 5,
        column: 49,
        endLine: 5,
        endColumn: 57,
        rule: "scale-unknown",
        severity: "warning",
        message: "p-[15px]의 값은 간격 스케일에 없습니다. 가까운 값: p-3.5 (14px), p-4 (16px)",
        found: "p-[15px]",
        candidates: ["p-3.5", "p-4"],
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
    expect(result).toMatchObject({ summary: { files: 1, errors: 0, warnings: 0 }, violations: [] });
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
    expect(result.summary).toEqual({ files: 1, errors: 1, warnings: 0 });
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
    expect(result.designSystem).toEqual({
      colorTokens: 1,
      radiusTokens: 0,
      textTokens: 1,
      components: 0,
      replacedTags: 0,
    });
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
