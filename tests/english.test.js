import { spawnSync } from "node:child_process";
import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.js";
import designsnitch from "../src/index.js";
import { tempProject } from "./temp-project.js";

const bin = path.resolve("bin/designsnitch.js");
const project = {
  "designsnitch.config.json": JSON.stringify({
    tokens: "tokens.css",
    components: { path: "ui", replaces: { button: ["SolidButton", "GhostButton"] } },
  }),
  "tokens.css": `@theme { --color-primary: #3B82F6; }\n.card { color: #3B82F6; }`,
  "ui/solid-button.tsx": `export const SolidButton = () => null;`,
  "src/a.tsx": `export const A = () => <button className="bg-[#3B82F6] text-[#123456]" />;`,
};

async function cli(argv, cwd, stdin) {
  let stdout = "";
  let stderr = "";
  const exitCode = await run(argv, {
    cwd,
    stdin,
    stdout: { write: (chunk) => (stdout += chunk) },
    stderr: { write: (chunk) => (stderr += chunk) },
  });
  return { exitCode, stdout, stderr };
}

describe("영어 출력 (--lang en)", () => {
  it("check 의 사람용 출력", async () => {
    const { stdout } = await cli(["check", "--lang", "en"], tempProject(project));
    expect(stdout).toBe(
      [
        "Design system: 1 color token, 2 components",
        "",
        "src/a.tsx",
        "  1:25  error  Use a design system component instead of <button>: SolidButton, GhostButton (ui)  (use-ds-component)",
        "  1:43  error  bg-[#3B82F6] has the same color as --color-primary. Use instead: bg-primary  (color-use-token)",
        "  1:56  warning  The color of text-[#123456] is not in the tokens.  (color-unknown)",
        "",
        "tokens.css",
        "  2:16  error  #3B82F6 has the same color as --color-primary. Use instead: var(--color-primary)  (color-use-token)",
        "",
        "3 errors, 1 warning (3 files checked)",
        "2 can be replaced right away, 2 need a person's decision (2 decisions)",
        "",
      ].join("\n"),
    );
  });

  it("check 의 next", async () => {
    const cwd = tempProject({ ...project, "src/b.css": ".card { color: #123456; }" });
    const { stdout } = await cli(["check", "--lang", "en", "--format", "json"], cwd);
    const { next, decisions } = JSON.parse(stdout);
    expect(decisions).toMatchObject([
      { subject: "#123456", uses: 2 },
      { subject: "<button>", uses: 1 },
    ]);
    expect(next).toEqual([
      'action "replace" (2): replace found with the value in candidates.',
      "Before making changes, ask the user about the 2 entries in decisions. Include how often each comes up, the candidates, and the reasons for asking.",
      "After fixing, run the same command again.",
    ]);
  });

  it("컴포넌트 교체를 확인해야 하는 이유를 영어로 알린다", async () => {
    const cwd = tempProject({
      ...project,
      "designsnitch.config.json": JSON.stringify({
        tokens: "tokens.css",
        components: { path: "ui", replaces: { input: { component: "InputCell", when: { type: ["text"] } } } },
      }),
      "src/a.tsx": `<input type={kind} />;\n<input {...props} />;`,
    });
    const { stdout } = await cli(["check", "src/a.tsx", "--lang", "en", "--format", "json"], cwd);
    const { violations } = JSON.parse(stdout);
    expect(violations.map(({ action }) => action)).toEqual(["ask", "ask"]);
    expect(violations[0].message).toContain('The "type" attribute has a dynamic value.');
    expect(violations[1].message).toContain("The element has spread attributes.");
  });

  it("테마별 토큰으로 교체할 때 색이 바뀔 수 있음을 영어로 알린다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `:root { --color-surface: #fff; } .dark { --color-surface: #000; }`,
      "src/a.tsx": `<div className="bg-[#fff]" />;`,
      "src/b.css": `.card { background: #fff; }`,
    });
    const { stdout } = await cli(["check", "--lang", "en", "--format", "json"], cwd);
    const { violations } = JSON.parse(stdout);
    expect(violations.map(({ action }) => action)).toEqual(["ask", "ask"]);
    for (const { message } of violations) {
      expect(message).toContain("Using it can change the color in another theme.");
    }
  });

  it("위반이 없을 때와 색 토큰이 없을 때", async () => {
    const clean = tempProject({ ...project, "tokens.css": `@theme { --color-primary: #3B82F6; }`, "src/a.tsx": `export const a = 1;` });
    expect((await cli(["check", "--lang", "en"], clean)).stdout).toBe(
      "Design system: 1 color token, 2 components\n\nNo violations. (3 files checked)\n",
    );

    const noTokens = tempProject({ "designsnitch.config.json": `{ "tokens": "t.css" }`, "t.css": `.a { margin: 0; }`, "src/a.js": `export const a = "bg-[#123456]";` });
    const { stdout } = await cli(["check", "--lang", "en", "--format", "json"], noTokens);
    const result = JSON.parse(stdout);
    expect(result.problems).toEqual([
      'No color token could be read from t.css. A --color-* variable is read when its value is a hex color, an oklch() color inside sRGB, or a var() that leads to one. Until then every hex color is reported as "not in the tokens".',
    ]);
    expect(result.next).toEqual([
      "There are no color tokens, so there is nothing to judge colors against. Before fixing any color, collect the colors in use with `designsnitch colors` and decide the tokens.",
    ]);
    expect((await cli(["check", "--lang", "en"], noTokens)).stdout.split("\n").slice(0, 2)).toEqual([
      "Design system: 0 color tokens, no components configured",
      `Note: ${result.problems[0]}`,
    ]);
  });

  it("colors", async () => {
    const { stdout } = await cli(["colors", "--lang", "en"], tempProject({ ...project, "src/b.js": `export const c = "#123456"; export const d = "text-gray-700";` }));
    expect(stdout).toBe(
      [
        "Colors used in the code: 2 hex, 1 from the default palette (5 uses, 4 files checked)",
        "",
        "Hex colors",
        "  #123456  2 uses  2 files  text 1, string 1  no token",
        "  #3b82f6  2 uses  2 files  bg 1, CSS 1  token: --color-primary",
        "",
        "Tailwind default palette",
        "  gray-700  1 use  1 file  text 1",
        "",
      ].join("\n"),
    );
    expect((await cli(["colors", "--lang", "en"], tempProject({ "a.js": "export const a = 1;" }))).stdout).toBe(
      "No colors found in the code. (1 file checked)\n",
    );
  });

  it("hook", async () => {
    const { exitCode, stderr } = await cli(
      ["hook", "--lang", "en"],
      tempProject(project),
      JSON.stringify({ hook_event_name: "PostToolUse", tool_input: { file_path: "tokens.css" } }),
    );
    expect(exitCode).toBe(2);
    expect(stderr).toBe(
      [
        "designsnitch: 1 design system error in the files you just changed.",
        "",
        "tokens.css:2:16  #3B82F6 has the same color as --color-primary. Use instead: var(--color-primary)  [replace]",
        "",
        "What to do next",
        '- action "replace" (1): replace found with the value in candidates.',
        "- After fixing, run the same command again.",
        "",
      ].join("\n"),
    );
  });

  it("install", async () => {
    const { stdout } = await cli(["install", "--lang", "en"], tempProject({ "package.json": "{}" }));
    expect(stdout).toBe(
      [
        "Copied 5 skills to .claude/skills.",
        "Registered the hook in .claude/settings.json.",
        "",
        "What to do next",
        "- Install the package in the project so the hook runs quickly every time: npm install --save-dev designsnitch",
        '- Ask your coding agent: "Set up designsnitch in this project." It finds the token CSS and the shared components, writes designsnitch.config.json, and puts the rules into ESLint.',
        "",
      ].join("\n"),
    );
  });

  it("실행하지 못했을 때의 메시지와 사용법", async () => {
    const missing = await cli(["check", "--lang", "en"], tempProject({}));
    expect(missing.exitCode).toBe(2);
    expect(missing.stderr).toMatch(/^Config file not found: .*designsnitch\.config\.json\nCreate it with content like this\. The designsnitch-setup skill can write it by reading the repository\.\n/);

    const broken = await cli(["check", "--lang", "en"], tempProject({ "designsnitch.config.json": `{ "tokens": "t.css" }`, "t.css": `.a { color: red` }));
    expect(broken.stderr).toMatch(/^designsnitch: could not read the token CSS: .*t\.css:1:1 Unclosed block\n$/);

    const usage = await cli(["--help", "--lang", "en"], tempProject({}));
    expect(usage.stdout).toContain("Usage: designsnitch <command> [paths...] [--format text|json] [--config file] [--lang en|ko]");
    expect(usage.stdout).toContain("check     Checks that UI code follows the design system.");
  });
});

describe("언어를 정하는 방법", () => {
  it("아무것도 정하지 않으면 영어다", () => {
    const env = { ...process.env };
    delete env.DESIGNSNITCH_LANG;
    const result = spawnSync("node", [bin, "check"], { cwd: tempProject(project), encoding: "utf8", env });
    expect(result.stdout.split("\n")[0]).toBe("Design system: 1 color token, 2 components");
  });

  it("환경 변수, 설정 파일의 lang, --lang 순으로 뒤의 것이 이긴다", async () => {
    // 테스트 환경은 DESIGNSNITCH_LANG=ko 다.
    const first = (out) => out.stdout.split("\n")[0];
    expect(first(await cli(["check"], tempProject(project)))).toBe("디자인 시스템: 색 토큰 1개, 컴포넌트 2개");

    const english = { ...project, "designsnitch.config.json": JSON.stringify({ ...JSON.parse(project["designsnitch.config.json"]), lang: "en" }) };
    expect(first(await cli(["check"], tempProject(english)))).toBe("Design system: 1 color token, 2 components");
    expect(first(await cli(["check", "--lang", "ko"], tempProject(english)))).toBe("디자인 시스템: 색 토큰 1개, 컴포넌트 2개");
  });

  it("모르는 언어를 주면 사용법을 알리고 2로 끝난다", async () => {
    const { exitCode, stderr } = await cli(["check", "--lang", "fr"], tempProject(project));
    expect(exitCode).toBe(2);
    expect(stderr).toContain("--lang");
  });

  it("설정 파일의 lang 이 en, ko 가 아니면 알려준다", async () => {
    const cwd = tempProject({ "designsnitch.config.json": `{ "tokens": "t.css", "lang": "fr" }`, "t.css": "" });
    const { exitCode, stderr } = await cli(["check"], cwd);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('"lang"');
  });
});

describe("ESLint 플러그인의 언어", () => {
  const lint = async (settings) => {
    const cwd = tempProject(project);
    const eslint = new ESLint({
      cwd,
      overrideConfigFile: true,
      overrideConfig: [
        designsnitch.configs.recommended,
        { files: ["**/*.jsx"], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } }, settings: { designsnitch: settings } },
      ],
    });
    const [result] = await eslint.lintText(`export const A = () => <div className="bg-[#3B82F6]" />;`, { filePath: path.join(cwd, "src/x.jsx") });
    return result.messages[0];
  };

  it("settings.designsnitch.lang 으로 정한다", async () => {
    const english = await lint({ tokens: "tokens.css", lang: "en" });
    expect(english.message).toBe("bg-[#3B82F6] has the same color as --color-primary. Use instead: bg-primary");
    expect(english.suggestions[0].desc).toBe("Replace with bg-primary");

    const korean = await lint({ tokens: "tokens.css", lang: "ko" });
    expect(korean.message).toBe("bg-[#3B82F6]의 색은 토큰 --color-primary의 값입니다. 대신 사용: bg-primary");
    expect(korean.suggestions[0].desc).toBe("bg-primary(으)로 바꾸기");
  });
});
