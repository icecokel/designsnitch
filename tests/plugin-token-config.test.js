import fs from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import { expect, it, vi } from "vitest";
import designsnitch from "../src/index.js";
import { loadTokens } from "../src/rules/load-tokens.js";
import { tempProject } from "./temp-project.js";

it("토큰 설정 없이 두 파일을 검사해도 파일마다 Program에 한 번 보고하고 다른 규칙은 실행한다", async () => {
  const cwd = tempProject({
    "src/a.js": 'export const color = "bg-[#123456]";\ndebugger;\n',
    "src/b.js": 'export const color = "bg-[#abcdef]";\ndebugger;\n',
  });
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [designsnitch.configs.recommended, { rules: { "no-debugger": "error" } }],
  });

  const results = await eslint.lintFiles(["src/a.js", "src/b.js"]);

  expect(results.map(({ filePath }) => path.relative(cwd, filePath)).sort()).toEqual([
    path.join("src", "a.js"),
    path.join("src", "b.js"),
  ]);
  for (const { messages } of results) {
    expect(messages).toMatchObject([
      {
        ruleId: "designsnitch/color-use-token",
        messageId: "tokensConfig",
        line: 1,
        column: 1,
        message: "designsnitch: settings.designsnitch.tokens 에 토큰 CSS 파일 경로를 설정하세요.",
      },
      { ruleId: "no-debugger", line: 2 },
    ]);
  }
});

it.each([
  ["토큰 CSS가 없으면", "missing.css", "토큰 CSS 파일을 찾을 수 없습니다"],
  ["토큰 CSS 경로를 읽을 수 없으면", "directory.css", "토큰 CSS를 읽을 수 없습니다"],
  ["토큰 CSS의 문법이 깨지면", "broken.css", "토큰 CSS를 읽을 수 없습니다"],
])("%s 이유를 한 번만 보고한다", async (_, tokens, reason) => {
  const cwd = tempProject({
    "src/a.js": 'export const color = "bg-[#123456]";\n',
    "directory.css/file": "",
    "broken.css": ".a { color: red",
  });
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [designsnitch.configs.recommended, { settings: { designsnitch: { tokens } } }],
  });

  const [{ messages }] = await eslint.lintFiles(["src/a.js"]);

  expect(messages).toMatchObject([
    { ruleId: "designsnitch/color-use-token", messageId: "tokensConfig", message: expect.stringContaining(reason) },
  ]);
  expect(messages[0].message).toContain(path.join(cwd, tokens));
});

it("토큰 CSS 경로에 접근할 권한이 없으면 읽을 수 없는 이유를 알려준다", () => {
  const settings = { designsnitch: { tokens: "tokens.css" } };
  const stat = vi.spyOn(fs, "readFileSync").mockImplementationOnce(() => {
    throw Object.assign(new Error("EACCES"), { code: "EACCES" });
  });

  try {
    expect(() => loadTokens(settings, process.cwd())).toThrow(/토큰 CSS를 읽을 수 없습니다: .*tokens\.css:1:1 EACCES/);
  } finally {
    stat.mockRestore();
  }
});

it("ESLint 제안은 역할 순서대로 나오고 선호 접두어가 한 후보를 고르면 그 제안만 나온다", async () => {
  const cwd = tempProject({
    "tokens.css": "@theme { --color-brand: #abc; --color-text-main: #abc; --color-chart-a: #abc; }",
    "src/a.js": 'export const color = "text-[#abc]";',
  });
  const lint = async (tokens) => {
    const eslint = new ESLint({
      cwd,
      overrideConfigFile: true,
      overrideConfig: [designsnitch.configs.recommended, { settings: { designsnitch: { tokens } } }],
    });
    const [{ messages }] = await eslint.lintFiles(["src/a.js"]);
    return messages;
  };

  const tokens = { file: "tokens.css", exclude: ["--color-chart-*"] };
  const [sorted] = await lint(tokens);
  expect(sorted.suggestions.map(({ fix }) => fix.text)).toEqual(["text-text-main", "text-brand"]);
  const [preferred] = await lint({ ...tokens, prefer: ["--color-chart-", "--color-brand", "--color-text-"] });
  expect(preferred.suggestions.map(({ fix }) => fix.text)).toEqual(["text-brand"]);
  const [invalid] = await lint({ ...tokens, exclude: ["--color-*-chart"] });
  expect(invalid.message).toContain('"tokens.exclude"');
});
