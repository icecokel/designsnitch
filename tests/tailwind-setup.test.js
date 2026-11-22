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

describe("@config 로 불러오는 JavaScript 설정", () => {
  const tailwindColors = {
    "node_modules/tailwindcss/package.json": JSON.stringify({ name: "tailwindcss", version: "4.3.5", exports: { "./theme.css": "./theme.css", "./colors": "./colors.js" } }),
    "node_modules/tailwindcss/colors.js": `module.exports = { red: { 500: "#fb2c36" } };`,
    "node_modules/tailwindcss/theme.css": `@theme default { --color-slate-500: oklch(55.4% 0.046 257.417); --color-white: #fff; }`,
  };

  it("extend.colors 의 색을 클래스 후보로 낸다. CSS 변수가 없으므로 var() 후보로는 쓰지 않는다", async () => {
    const cwd = tempProject({
      ...config,
      ...tailwindColors,
      "app/globals.css": `@import "tailwindcss";\n@config "../tailwind.config.js";\n@theme { --color-own: #111111; --color-both: #777777; }`,
      "preset.js": `module.exports = { theme: { extend: { colors: { preset: "#010203" } } } };`,
      "tailwind.config.js": `module.exports = {
        presets: [require("./preset.js")],
        theme: { extend: { colors: ({ colors }) => ({
          brand: { DEFAULT: "#ff5a1f", 500: "#aa3300", deep: { 900: "#220000" } },
          lightBlue: "rgb(0 170 255)",
          fn: colors.red[500],
          both: "#888888",
          skipped: "rgb(var(--x) / <alpha-value>)",
        }) } },
      };`,
      "src/A.jsx": `export const A = () => <div className="bg-[#ff5a1f] text-[#aa3300] border-[#220000] bg-[#00aaff] bg-[#fb2c36] bg-[#010203] bg-[#888888] bg-[#777777]" style={{ color: "#ff5a1f" }} />;`,
      "src/a.css": `.a { color: #aa3300; background: #111111; }`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });

    expect(result.problems).toEqual([]);
    expect(result.designSystem.colorTokens).toBe(8);
    expect(result.violations.map((v) => [v.found, v.rule, v.candidates])).toEqual([
      ["#111111", "color-use-token", ["var(--color-own)"]],
      ["bg-[#ff5a1f]", "color-use-token", ["bg-brand"]],
      ["text-[#aa3300]", "color-use-token", ["text-brand-500"]],
      ["border-[#220000]", "color-use-token", ["border-brand-deep-900"]],
      ["bg-[#00aaff]", "color-use-token", ["bg-lightBlue"]],
      ["bg-[#fb2c36]", "color-use-token", ["bg-fn"]],
      ["bg-[#010203]", "color-use-token", ["bg-preset"]],
      ["bg-[#888888]", "color-unknown", []], // CSS 의 --color-both 가 이긴다
      ["bg-[#777777]", "color-use-token", ["bg-both"]],
    ]);
  });

  it("theme.colors 는 기본 팔레트를 대체한다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "app/globals.css", "palette": "tailwind" }`,
      ...tailwindColors,
      "app/globals.css": `@import "tailwindcss";\n@config "../tailwind.config.mjs";`,
      "tailwind.config.mjs": `export default { theme: { colors: { ink: "#101010" } } };`,
      "src/A.jsx": `export const A = () => <div className="bg-[#62748e] text-[#101010]" />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    expect(result.designSystem).toMatchObject({ colorTokens: 1, paletteColors: 0 });
    expect(result.violations.map((v) => [v.found, v.rule, v.candidates])).toEqual([
      ["bg-[#62748e]", "color-unknown", []],
      ["text-[#101010]", "color-use-token", ["text-ink"]],
    ]);
  });

  it("설정을 불러오지 못하면 problems 로 알리고 나머지 검사는 계속한다", async () => {
    const cwd = tempProject({
      ...config,
      "app/globals.css": `@config "../tailwind.config.js";\n@theme { --color-own: #111111; }`,
      "tailwind.config.js": `module.exports = require("not-installed-plugin");`,
      "src/A.jsx": `export const A = () => <div className="bg-[#111111]" />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatch(/^Could not load the Tailwind config .*tailwind\.config\.js: .*not-installed-plugin/);
    expect(result.violations.map((v) => v.candidates)).toEqual([["bg-own"]]);
  });

  it("설정 파일이 바뀌면 다시 읽는다", () => {
    const cwd = tempProject({
      ...config,
      "app/globals.css": `@config "../tailwind.config.js";`,
      "tailwind.config.js": `module.exports = { theme: { extend: { colors: { a: "#111111" } } } };`,
    });
    expect([...loadTokens(settings(cwd), cwd).colors.keys()]).toEqual(["#111111"]);
    const file = path.join(cwd, "tailwind.config.js");
    fs.writeFileSync(file, `module.exports = { theme: { extend: { colors: { a: "#222222" } } } };`);
    fs.utimesSync(file, new Date(), new Date(Date.now() + 5000));
    expect([...loadTokens(settings(cwd), cwd).colors.keys()]).toEqual(["#222222"]);
  });
});
