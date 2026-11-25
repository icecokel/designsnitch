import fs from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.js";
import designsnitch from "../src/index.js";
import { tempProject } from "./temp-project.js";

const TOKENS = [
  '@import "tailwindcss";',
  "@theme {",
  "  --color-primary: #3b82f6;",
  "  --color-text-primary: #484646;",
  "  --color-neutral-30: #484646;",
  "  --color-surface: #ffffff;",
  "}",
  "@media (prefers-color-scheme: dark) {",
  "  :root { --color-surface: #111111; }",
  "}",
  "",
].join("\n");

const SOURCE = [
  "export const A = ({ on }) => (",
  "  <div>",
  '    <p className={cn("p-2", on && "bg-[#3B82F6]")} style={{ color: "#3B82F6" }} />',
  '    <p className="md:text-[#3B82F6]/80" />',
  // 후보가 둘이라 사람이 골라야 한다
  '    <p className="text-[#484646]" />',
  // 반투명
  '    <p className="bg-[#3B82F680]" />',
  // 테마마다 값이 다른 토큰
  '    <p className="bg-[#ffffff]" />',
  // 스타일이 아닌 자리
  '    <Chart backgroundColor="#3B82F6" />',
  // 토큰이 없는 색
  '    <p className="bg-[#123456]" />',
  "  </div>",
  ");",
  "",
].join("\n");

const FIXED = SOURCE.replace('"bg-[#3B82F6]")', '"bg-primary")')
  .replace('color: "#3B82F6"', 'color: "var(--color-primary)"')
  .replace("md:text-[#3B82F6]/80", "md:text-primary/80");

function project(extra = {}) {
  return tempProject({
    "designsnitch.config.json": JSON.stringify({ tokens: "app/globals.css" }),
    "app/globals.css": TOKENS,
    "src/a.jsx": SOURCE,
    ...extra,
  });
}

async function runCli(argv, cwd) {
  let stdout = "";
  let stderr = "";
  const exitCode = await run(argv, {
    cwd,
    stdout: { write: (chunk) => (stdout += chunk) },
    stderr: { write: (chunk) => (stderr += chunk) },
  });
  return { exitCode, stdout, stderr };
}

describe("ESLint --fix", () => {
  it("바꿔도 화면이 같은 것(replace)만 고치고, 사람이 정해야 하는 것은 그대로 둔다", async () => {
    const cwd = project();
    const eslint = new ESLint({
      cwd,
      fix: true,
      overrideConfigFile: true,
      overrideConfig: [
        { files: ["**/*.jsx"], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } },
        designsnitch.configs.recommended,
      ],
    });

    const [result] = await eslint.lintFiles(["src/a.jsx"]);

    expect(result.output).toBe(FIXED);
    // 남은 것: 후보 둘, 반투명, 테마 토큰, 스타일이 아닌 자리, 토큰 없는 색
    expect(result.messages).toHaveLength(5);
  });
});

describe("designsnitch check --fix", () => {
  it("JS 와 CSS 의 replace 를 고치고, 고친 수와 남은 위반을 알린다", async () => {
    const cwd = project({
      "src/card.css": ".card {\n  color: #3B82F6;\n  border-color: #484646;\n  @apply bg-[#3B82F6];\n}\n",
    });

    const { stdout, exitCode } = await runCli(["check", "--fix", "--format", "json"], cwd);
    const result = JSON.parse(stdout);

    expect(fs.readFileSync(path.join(cwd, "src/a.jsx"), "utf8")).toBe(FIXED);
    expect(fs.readFileSync(path.join(cwd, "src/card.css"), "utf8")).toBe(
      ".card {\n  color: var(--color-primary);\n  border-color: #484646;\n  @apply bg-primary;\n}\n",
    );
    expect(result.fixed).toBe(5);
    expect(result.violations.filter((v) => v.action === "replace")).toEqual([]);
    expect(result.violations.map((v) => v.action)).toEqual(["ask", "ask", "ask", "ask", "ask", "ask"]);
    // 사람이 정해야 하는 오류가 남아 있으므로 1
    expect(exitCode).toBe(1);
  });

  it("경로를 주면 그 안만 고친다", async () => {
    const cwd = project({ "src/b.jsx": 'export const B = () => <p className="bg-[#3B82F6]" />;\n' });

    await runCli(["check", "--fix", "src/b.jsx"], cwd);

    expect(fs.readFileSync(path.join(cwd, "src/b.jsx"), "utf8")).toBe(
      'export const B = () => <p className="bg-primary" />;\n',
    );
    expect(fs.readFileSync(path.join(cwd, "src/a.jsx"), "utf8")).toBe(SOURCE);
  });

  it("텍스트 출력은 고친 수를 먼저 알린다", async () => {
    const cwd = project();

    const { stdout } = await runCli(["check", "--fix", "--lang", "ko"], cwd);

    expect(stdout.split("\n")[0]).toBe("바꿔도 화면이 같은 3곳을 토큰으로 고쳤습니다.");
  });

  it("--fix 없이는 파일을 바꾸지 않고, 결과에 fixed 도 없다", async () => {
    const cwd = project();

    const { stdout } = await runCli(["check", "--format", "json"], cwd);

    expect(fs.readFileSync(path.join(cwd, "src/a.jsx"), "utf8")).toBe(SOURCE);
    expect(JSON.parse(stdout)).not.toHaveProperty("fixed");
  });
});
