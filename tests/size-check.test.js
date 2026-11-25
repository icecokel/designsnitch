import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import { run } from "../src/cli.js";
import { loadConfig } from "../src/config.js";
import { tempProject } from "./temp-project.js";

const TOKENS = [
  '@import "tailwindcss";',
  "@theme {",
  "  --color-primary: #3b82f6;",
  "  --radius-card: 12px;",
  "  --radius-lg: 0.5rem;",
  "  --text-body: 14px;",
  "  --text-body--line-height: 20px;",
  "}",
  "",
].join("\n");

const SOURCE = [
  "export const A = () => (",
  "  <div>",
  '    <p className="rounded-[12px] rounded-t-[8px] rounded-[7px]" />',
  '    <p className="text-[14px] text-[15px]" />',
  '    <p style={{ borderRadius: 12, fontSize: "14px", padding: "13px", borderTopLeftRadius: "0.5rem" }} />',
  "  </div>",
  ");",
  "",
].join("\n");

const CSS = ".card {\n  border-radius: 12px 12px 0 0;\n  font-size: 14px;\n  font-size: 0.875rem;\n  padding: 13px;\n  @apply rounded-[12px] text-[14px];\n}\n";

function project(tokens = TOKENS) {
  return tempProject({
    "designsnitch.config.json": JSON.stringify({ tokens: "app/globals.css", lang: "ko" }),
    "app/globals.css": tokens,
    "src/a.jsx": SOURCE,
    "src/card.css": CSS,
  });
}

const brief = (violations, file) =>
  violations.filter((v) => v.file === file).map((v) => [v.rule, v.found, v.action, v.candidates.join("|")]);

describe("radius 와 글자 크기 검사", () => {
  it("JS 에서 토큰과 같은 값은 오류, 토큰에 없는 값은 경고로 알린다", async () => {
    const cwd = project();
    const { violations } = await check({ cwd, config: loadConfig(cwd) });

    expect(brief(violations, "src/a.jsx")).toEqual([
      ["radius-use-token", "rounded-[12px]", "replace", "rounded-card"],
      // rem 토큰과 px 값은 환산해야 같다
      ["radius-use-token", "rounded-t-[8px]", "ask", "rounded-t-lg"],
      ["radius-unknown", "rounded-[7px]", "ask", ""],
      // 글자 크기 클래스는 줄 높이도 정하므로 묻는다
      ["font-size-use-token", "text-[14px]", "ask", "text-body"],
      ["font-size-unknown", "text-[15px]", "ask", ""],
      ["radius-use-token", "12", "replace", '"var(--radius-card)"'],
      ["font-size-use-token", "14px", "replace", "var(--text-body)"],
      ["radius-use-token", "0.5rem", "replace", "var(--radius-lg)"],
    ]);
  });

  it("CSS 선언과 @apply 도 같은 기준으로 본다", async () => {
    const cwd = project();
    const { violations, decisions } = await check({ cwd, config: loadConfig(cwd) });

    expect(brief(violations, "src/card.css")).toEqual([
      ["radius-use-token", "12px", "replace", "var(--radius-card)"],
      ["radius-use-token", "12px", "replace", "var(--radius-card)"],
      ["font-size-use-token", "14px", "replace", "var(--text-body)"],
      // 14px 토큰과 값은 같지만 단위가 다르다
      ["font-size-use-token", "0.875rem", "ask", "var(--text-body)"],
      ["radius-use-token", "rounded-[12px]", "replace", "rounded-card"],
      ["font-size-use-token", "text-[14px]", "ask", "text-body"],
    ]);
    const reasons = Object.fromEntries(decisions.map((d) => [`${d.rule} ${d.subject}`, d.reasons]));
    expect(reasons["radius-use-token rounded-t-[8px]"]).toEqual(["unit-conversion"]);
    expect(reasons["font-size-use-token text-[14px]"]).toEqual(["line-height"]);
    expect(reasons["radius-unknown rounded-[7px]"]).toEqual(["no-token"]);
  });

  it("그 종류의 토큰이 없으면 아무것도 알리지 않는다", async () => {
    const cwd = project('@import "tailwindcss";\n@theme {\n  --color-primary: #3b82f6;\n}\n');
    const { violations } = await check({ cwd, config: loadConfig(cwd) });

    expect(violations).toEqual([]);
  });

  it("--fix 는 같은 단위의 같은 값만 고친다", async () => {
    const cwd = project();
    let stdout = "";
    await run(["check", "--fix", "--format", "json"], { cwd, stdout: { write: (c) => (stdout += c) }, stderr: { write() {} } });

    expect(JSON.parse(stdout).fixed).toBe(8);
    expect(fs.readFileSync(path.join(cwd, "src/a.jsx"), "utf8")).toBe(
      SOURCE.replace("rounded-[12px]", "rounded-card")
        .replace("borderRadius: 12,", 'borderRadius: "var(--radius-card)",')
        .replace('fontSize: "14px"', 'fontSize: "var(--text-body)"')
        .replace('"0.5rem"', '"var(--radius-lg)"'),
    );
    expect(fs.readFileSync(path.join(cwd, "src/card.css"), "utf8")).toBe(
      ".card {\n  border-radius: var(--radius-card) var(--radius-card) 0 0;\n  font-size: var(--text-body);\n  font-size: 0.875rem;\n  padding: 13px;\n  @apply rounded-card text-[14px];\n}\n",
    );
  });
});

describe("designsnitch sizes", () => {
  const runCli = async (argv, cwd) => {
    let stdout = "";
    const exitCode = await run(argv, { cwd, stdout: { write: (c) => (stdout += c) }, stderr: { write() {} } });
    return { stdout, exitCode };
  };

  it("설정 파일이 없어도 직접 쓴 크기를 종류별로, 많이 쓴 순서로 보여준다", async () => {
    const cwd = tempProject({ "src/a.jsx": SOURCE, "src/card.css": CSS });
    const { stdout, exitCode } = await runCli(["sizes", "--lang", "ko"], cwd);

    expect(stdout).toBe(
      [
        "직접 쓴 크기: 글자 크기 3종, radius 4종, 간격 1종 (사용 16곳, 파일 2개 검사)",
        "",
        "글자 크기",
        "  14px  4곳  파일 2개  클래스 2, 스타일 1, CSS 1",
        // 같은 횟수면 작은 값부터. 0.875rem 은 14px 다
        "  0.875rem  1곳  파일 1개  CSS 1",
        "  15px  1곳  파일 1개  클래스 1",
        "",
        "radius",
        "  12px  5곳  파일 2개  클래스 2, 스타일 1, CSS 2",
        "  7px  1곳  파일 1개  클래스 1",
        "  0.5rem  1곳  파일 1개  스타일 1",
        "  8px  1곳  파일 1개  클래스 1",
        "",
        "간격 (모으기만 하고 검사하지 않음)",
        "  13px  2곳  파일 2개  스타일 1, CSS 1",
        "",
      ].join("\n"),
    );
    expect(exitCode).toBe(0);
  });

  it("설정 파일이 있으면 값마다 같은 값의 토큰을 붙인다", async () => {
    const cwd = project();
    const { stdout } = await runCli(["sizes", "--format", "json"], cwd);
    const result = JSON.parse(stdout);

    expect(result.radii.map(({ value, tokens }) => [value, tokens])).toEqual([
      ["12px", ["--radius-card"]],
      ["7px", []],
      ["0.5rem", ["--radius-lg"]],
      ["8px", ["--radius-lg"]],
    ]);
    expect(result.spacing[0]).not.toHaveProperty("tokens");
  });
});
