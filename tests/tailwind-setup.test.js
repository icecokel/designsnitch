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

  it("extend.colors 의 색을 클래스 후보로 낸다. CSS 변수가 없으므로 var() 후보는 내지 않는다", async () => {
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
      ["#aa3300", "color-use-token", []], // JS 설정의 색은 CSS 변수가 없어 후보 없이 알린다
      ["#111111", "color-use-token", ["var(--color-own)"]],
      ["bg-[#ff5a1f]", "color-use-token", ["bg-brand"]],
      ["text-[#aa3300]", "color-use-token", ["text-brand-500"]],
      ["border-[#220000]", "color-use-token", ["border-brand-deep-900"]],
      ["bg-[#00aaff]", "color-use-token", ["bg-lightBlue"]],
      ["bg-[#fb2c36]", "color-use-token", ["bg-fn"]],
      ["bg-[#010203]", "color-use-token", ["bg-preset"]],
      ["bg-[#888888]", "color-unknown", []], // CSS 의 --color-both 가 이긴다
      ["bg-[#777777]", "color-use-token", ["bg-both"]],
      ["#ff5a1f", "color-use-token", []],
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

describe("심볼릭 링크 경로", () => {
  it("설정 파일을 링크된 경로로 가리켜도 토큰 CSS 의 변수 선언은 검사하지 않는다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "app/globals.css" }`,
      "app/globals.css": `:root { --raw: #111111; }\n@theme { --color-a: var(--raw); }`,
    });
    const link = `${cwd}-link`;
    fs.symlinkSync(cwd, link);
    let stdout = "";
    const io = { cwd, stdout: { write: (c) => (stdout += c) }, stderr: { write() {} } };
    await run(["check", "--config", path.join(link, "designsnitch.config.json"), "--format", "json"], io);
    expect(JSON.parse(stdout).violations).toEqual([]);
    stdout = "";
    await run(["colors", "--config", path.join(link, "designsnitch.config.json"), "--format", "json"], io);
    expect(JSON.parse(stdout).colors).toEqual([]);
  });
});

describe("Tailwind v3", () => {
  const v3 = {
    "node_modules/tailwindcss/package.json": JSON.stringify({ name: "tailwindcss", version: "3.4.19" }),
    "node_modules/tailwindcss/colors.js": `module.exports = {
      inherit: "inherit", transparent: "transparent", white: "#fff",
      slate: { 500: "#64748b" },
      get lightBlue() { throw new Error("deprecated alias must not be read"); },
    };`,
    "app/globals.css": `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n:root { --radius: 4px; }`,
    "tailwind.config.js": `module.exports = { content: [], theme: { extend: { colors: { brand: { 500: "#ff5a1f" } } } } };`,
    "src/A.jsx": `export const A = () => <div className="bg-[#ff5a1f] text-[#64748b] border-[#123456]" />;`,
  };

  it("@tailwind 를 쓰는 CSS 면 프로젝트 루트의 tailwind.config 를 찾아 색을 읽는다", async () => {
    const cwd = tempProject({ ...config, ...v3 });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    expect(result.problems).toEqual([]);
    expect(result.designSystem).toMatchObject({ colorTokens: 1, paletteColors: 0 });
    expect(result.violations.map((v) => [v.found, v.rule, v.candidates])).toEqual([
      ["bg-[#ff5a1f]", "color-use-token", ["bg-brand-500"]],
      ["text-[#64748b]", "color-unknown", []],
      ["border-[#123456]", "color-unknown", []],
    ]);
  });

  it("토큰을 정의하는 tailwind.config 안의 색은 검사하지 못한 색으로 세지 않는다", async () => {
    const cwd = tempProject({ ...config, ...v3, "src/theme.js": `export const chart = { line: "#abcdef" };` });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    expect(result.unchecked).toEqual({ colors: 1, files: 1 });
    const tokens = loadTokens(settings(cwd), cwd);
    const colors = await collectColors({ cwd, tokens: tokens.colors, tokenFiles: tokens.files });
    expect(colors.colors.map((c) => c.color).sort()).toEqual(["#123456", "#64748b", "#abcdef", "#ff5a1f"]);
  });

  it("토큰을 정의하는 tailwind.config 의 색은 위반으로 잡지 않는다. 키 이름이 background, border 여도 마찬가지다", async () => {
    const cwd = tempProject({
      ...config,
      ...v3,
      "tailwind.config.js": `module.exports = { content: [], theme: { extend: { colors: { background: "#f7f8f5", border: "#e5e9e4", brand: { 500: "#ff5a1f" } } } } };`,
      "src/A.jsx": `export const A = () => <div className="bg-[#f7f8f5]" />;`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    expect(result.violations.map((v) => [v.file, v.found, v.candidates])).toEqual([["src/A.jsx", "bg-[#f7f8f5]", ["bg-background"]]]);

    // ESLint 플러그인으로 돌려도 같다.
    const { ESLint } = await import("eslint");
    const { default: plugin } = await import("../src/index.js");
    const eslint = new ESLint({
      cwd,
      overrideConfigFile: true,
      overrideConfig: [{ ...plugin.configs.recommended, files: ["**/*.{js,jsx}"], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } }, settings: { designsnitch: { tokens: "app/globals.css" } } }],
    });
    const [configResult] = await eslint.lintFiles(["tailwind.config.js"]);
    expect(configResult.messages).toEqual([]);
  });

  it("tokens 에 tailwind.config 를 직접 적어도 되고, palette 는 tailwindcss/colors 에서 읽는다", async () => {
    const cwd = tempProject({
      ...v3,
      "designsnitch.config.json": `{ "tokens": "tailwind.config.js", "palette": "tailwind" }`,
      "src/a.css": `.a { color: #64748b; }`,
    });
    const result = await check({ cwd, config: loadConfig(cwd), lang: "en" });
    expect(result.designSystem).toMatchObject({ colorTokens: 1, paletteColors: 2 });
    expect(result.violations.map((v) => [v.found, v.rule, v.candidates])).toEqual([
      ["#64748b", "color-use-token", []], // v3 에는 CSS 변수가 없다
      ["bg-[#ff5a1f]", "color-use-token", ["bg-brand-500"]],
      ["text-[#64748b]", "color-use-token", ["text-slate-500"]],
      ["border-[#123456]", "color-unknown", []],
    ]);
  });

  it("tokens 에 적은 설정을 불러오지 못하면 실행하지 못한다고 알린다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "tailwind.config.js" }`,
      "tailwind.config.js": `module.exports = require("not-installed-plugin");`,
    });
    await expect(check({ cwd, config: loadConfig(cwd), lang: "en" })).rejects.toThrow(/Could not load the Tailwind config .*not-installed-plugin/);
  });
});
