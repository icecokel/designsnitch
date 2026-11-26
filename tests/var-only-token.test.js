import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import { run } from "../src/cli.js";
import { loadConfig } from "../src/config.js";
import { tempProject } from "./temp-project.js";

// Tailwind v4 는 @theme 안의 변수로만 클래스를 만든다. :root 에 선언한 --color-x 는 변수로는 있어도 bg-x 클래스는 없다.
const TOKENS = [
  '@import "tailwindcss";',
  ":root {",
  "  --color-review: #123456;",
  "  --color-both: #abcdef;",
  "  --radius-card: 12px;",
  "  --text-body: 14px;",
  "}",
  "@theme {",
  "  --color-brand: #3b82f6;",
  "  --color-both-theme: #abcdef;",
  "  --radius-box: 8px;",
  "}",
  "",
].join("\n");

const SOURCE = [
  "export const A = () => (",
  '  <p className="bg-[#123456] text-[#3B82F6] border-[#abcdef] bg-[#12345680] rounded-[12px] rounded-[8px] text-[14px]"',
  '    style={{ color: "#123456", borderRadius: 12 }} />',
  ");",
  "",
].join("\n");

const CSS = ".a {\n  color: #123456;\n  @apply bg-[#123456] rounded-[12px];\n}\n";

function project() {
  return tempProject({
    "designsnitch.config.json": JSON.stringify({ tokens: "app/globals.css" }),
    "app/globals.css": TOKENS,
    "src/a.jsx": SOURCE,
    "src/a.css": CSS,
  });
}

const brief = (violations, file) =>
  violations.filter((v) => v.file === file).map((v) => [v.found, v.action, v.candidates.join("|")]);

describe("@theme 밖에 선언한 토큰", () => {
  it("클래스가 없으므로 클래스 자리에서는 변수 형태를 후보로 내고 사람에게 묻는다", async () => {
    const cwd = project();
    const { violations, decisions } = await check({ cwd, config: loadConfig(cwd) });

    expect(brief(violations, "src/a.jsx")).toEqual([
      ["bg-[#123456]", "ask", "bg-(--color-review)"],
      // @theme 의 토큰은 클래스가 있다
      ["text-[#3B82F6]", "replace", "text-brand"],
      // 같은 값의 토큰이 @theme 에도 있으면 그쪽 클래스를 쓴다
      ["border-[#abcdef]", "replace", "border-both-theme"],
      ["bg-[#12345680]", "ask", "bg-(--color-review)/50"],
      ["rounded-[12px]", "ask", "rounded-(--radius-card)"],
      ["rounded-[8px]", "replace", "rounded-box"],
      ["text-[14px]", "ask", "text-(length:--text-body)"],
      // 스타일의 값은 var() 로 쓰므로 어디에 선언했든 같다
      ["#123456", "replace", "var(--color-review)"],
      ["12", "replace", '"var(--radius-card)"'],
    ]);
    const reasons = Object.fromEntries(decisions.map((d) => [d.subject, d.reasons]));
    expect(reasons["#123456"]).toEqual(["no-class"]);
    expect(reasons["rounded-[12px]"]).toEqual(["no-class"]);
  });

  it("@apply 도 같다. 선언의 값은 var() 로 바꾼다", async () => {
    const cwd = project();
    const { violations } = await check({ cwd, config: loadConfig(cwd) });

    expect(brief(violations, "src/a.css")).toEqual([
      ["#123456", "replace", "var(--color-review)"],
      ["bg-[#123456]", "ask", "bg-(--color-review)"],
      ["rounded-[12px]", "ask", "rounded-(--radius-card)"],
    ]);
  });

  it("--fix 는 없는 클래스로 바꾸지 않는다", async () => {
    const cwd = project();
    await run(["check", "--fix"], { cwd, stdout: { write() {} }, stderr: { write() {} } });

    const fixed = fs.readFileSync(path.join(cwd, "src/a.jsx"), "utf8");
    expect(fixed).toContain("bg-[#123456] text-brand border-both-theme bg-[#12345680] rounded-[12px] rounded-box text-[14px]");
    expect(fixed).not.toMatch(/bg-review|rounded-card|text-body/);
  });

  it("왜 클래스가 없는지 메시지로 알린다", async () => {
    const cwd = project();
    const { violations } = await check({ cwd, config: loadConfig(cwd), lang: "en" });

    expect(violations.find((v) => v.found === "bg-[#123456]").message).toBe(
      "bg-[#123456] has the same color as --color-review, but that token is declared outside @theme, so Tailwind makes no class for it. Candidate: bg-(--color-review). Declaring it in @theme gives it a class.",
    );
  });
});
