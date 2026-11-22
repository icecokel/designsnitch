import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import { run } from "../src/cli.js";
import { collectColors } from "../src/colors.js";
import { loadConfig } from "../src/config.js";
import { loadTokens } from "../src/rules/load-tokens.js";
import { tempProject } from "./temp-project.js";

const config = { "designsnitch.config.json": `{ "tokens": "app/globals.css" }` };
const settings = (cwd) => ({ designsnitch: loadConfig(cwd) });

describe("토큰 CSS 가 @import 하는 파일", () => {
  it("상대 경로와 패키지의 CSS 를 따라가 토큰을 읽고, 그 파일들의 변수 선언은 검사하지 않는다", async () => {
    const cwd = tempProject({
      ...config,
      "app/globals.css": `@import "tailwindcss";\n@import "../brand/theme.css";\n@import "@acme/tokens/colors.css" layer(theme);\n@import url("https://example.com/x.css");\n@theme { --color-own: #111111; }`,
      "brand/theme.css": `@import "./more.css";\n@theme { --color-lagoon: #0e7490; }`,
      "brand/more.css": `@import "./theme.css";\n:root { --raw: #222222; }\n@theme { --color-more: var(--raw); }`,
      "node_modules/@acme/tokens/package.json": `{ "name": "@acme/tokens" }`,
      "node_modules/@acme/tokens/colors.css": `@theme { --color-acme: #333333; }`,
      "src/a.css": `.a { color: #0e7490; background: #222222; border-color: #333333; }`,
    });
    const tokens = loadTokens(settings(cwd), cwd);
    expect([...tokens.colors.values()].flat().sort()).toEqual(["--color-acme", "--color-lagoon", "--color-more", "--color-own"]);
    expect([...tokens.files].map((file) => path.relative(cwd, file)).sort()).toEqual([
      "app/globals.css",
      "brand/more.css",
      "brand/theme.css",
      "node_modules/@acme/tokens/colors.css",
    ]);

    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    expect(result.violations.map((v) => [v.file, v.found, v.candidates])).toEqual([
      ["src/a.css", "#0e7490", ["var(--color-lagoon)"]],
      ["src/a.css", "#222222", ["var(--color-more)"]],
      ["src/a.css", "#333333", ["var(--color-acme)"]],
    ]);
    const colors = await collectColors({ cwd, tokens: tokens.colors, tokenFiles: tokens.files });
    expect(colors.colors.map((c) => c.color)).toEqual(["#0e7490", "#222222", "#333333"]);
  });

  it("import 한 파일이 바뀌면 다시 읽는다", () => {
    const cwd = tempProject({
      ...config,
      "app/globals.css": `@import "./theme.css";`,
      "app/theme.css": `@theme { --color-a: #111111; }`,
    });
    expect([...loadTokens(settings(cwd), cwd).colors.keys()]).toEqual(["#111111"]);
    const file = path.join(cwd, "app/theme.css");
    fs.writeFileSync(file, `@theme { --color-a: #222222; }`);
    fs.utimesSync(file, new Date(), new Date(Date.now() + 5000));
    expect([...loadTokens(settings(cwd), cwd).colors.keys()]).toEqual(["#222222"]);
  });

  it("import 한 파일이 깨져 있으면 그 파일을 알려 준다", () => {
    const cwd = tempProject({
      ...config,
      "app/globals.css": `@import "./theme.css";`,
      "app/theme.css": `@theme { --color-a: #111111;`,
    });
    expect(() => loadTokens(settings(cwd), cwd)).toThrow(/app\/theme\.css:1:1/);
  });
});

describe("Tailwind 접두어 (prefix)", () => {
  it("var() 후보에 접두어를 붙인다. 클래스 후보는 접두어 뒤의 부분만 바꾸므로 그대로다", async () => {
    const cwd = tempProject({
      ...config,
      "app/globals.css": `@import "tailwindcss" prefix(tw);\n@theme { --color-brand: #3B82F6; }`,
      "src/A.jsx": `export const A = () => <div className="tw:hover:bg-[#3B82F6]" style={{ color: "#3B82F6" }} />;`,
      "src/a.css": `.a { color: #3B82F6; }`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    expect(result.violations.map((v) => [v.found, v.candidates, v.recommended])).toEqual([
      ["#3B82F6", ["var(--tw-color-brand)"], "var(--tw-color-brand)"],
      ["bg-[#3B82F6]", ["bg-brand"], "bg-brand"],
      ["#3B82F6", ["var(--tw-color-brand)"], "var(--tw-color-brand)"],
    ]);
    expect(result.violations[0].message).toBe("#3B82F6 has the same color as --color-brand. Use instead: var(--tw-color-brand)");
  });

  it("colors 명령도 import 한 토큰 파일을 건너뛴다", async () => {
    const cwd = tempProject({
      ...config,
      "app/globals.css": `@import "./theme.css";`,
      "app/theme.css": `:root { --raw: #111111; }\n@theme { --color-a: var(--raw); }`,
      "src/a.css": `.a { color: #111111; }`,
    });
    let stdout = "";
    await run(["colors", "--format", "json"], { cwd, stdout: { write: (c) => (stdout += c) }, stderr: { write() {} } });
    expect(JSON.parse(stdout).colors.map((c) => [c.color, c.uses, c.tokens])).toEqual([["#111111", 1, ["--color-a"]]]);
  });
});
