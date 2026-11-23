import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.js";
import plugin from "../src/index.js";
import { tempProject } from "./temp-project.js";

const SKILLS = [
  "designsnitch-check",
  "designsnitch-eslint",
  "designsnitch-hooks",
  "designsnitch-palette",
  "designsnitch-setup",
];
const HOOK = { type: "command", command: "npx designsnitch hook" };

async function install(cwd, ...args) {
  let stdout = "";
  let stderr = "";
  const exitCode = await run(["install", ...args], {
    cwd,
    stdout: { write: (chunk) => (stdout += chunk) },
    stderr: { write: (chunk) => (stderr += chunk) },
  });
  return { exitCode, stdout, stderr };
}
const readSettings = (cwd) => JSON.parse(fs.readFileSync(path.join(cwd, ".claude/settings.json"), "utf8"));

describe("designsnitch install", () => {
  it("스킬을 .claude/skills 에 복사하고 훅을 .claude/settings.json 에 등록한다", async () => {
    const cwd = tempProject({ "package.json": `{ "devDependencies": { "designsnitch": "^0.2.0" } }` });
    const { exitCode, stderr } = await install(cwd);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(fs.readdirSync(path.join(cwd, ".claude/skills")).sort()).toEqual(SKILLS);
    for (const skill of SKILLS) {
      const copied = fs.readFileSync(path.join(cwd, ".claude/skills", skill, "SKILL.md"), "utf8");
      expect(copied).toBe(fs.readFileSync(path.resolve("skills", skill, "SKILL.md"), "utf8"));
    }
    expect(readSettings(cwd)).toEqual({
      hooks: {
        PostToolUse: [{ matcher: "Edit|Write|MultiEdit", hooks: [HOOK] }],
        Stop: [{ hooks: [HOOK] }],
        SessionStart: [{ hooks: [HOOK] }],
      },
    });
  });

  it("무엇을 했는지와 다음에 할 일을 알려준다", async () => {
    const cwd = tempProject({ "package.json": `{ "devDependencies": { "designsnitch": "^0.2.0" } }` });
    const { stdout } = await install(cwd);
    expect(stdout).toBe(
      [
        "스킬 5개를 .claude/skills 에 복사했습니다.",
        "훅을 .claude/settings.json 에 등록했습니다.",
        "",
        "다음에 할 일",
        "- 코딩 에이전트에게 \"이 프로젝트에 designsnitch를 설정해 줘\"라고 요청하세요. 토큰 CSS와 공용 컴포넌트를 찾아 designsnitch.config.json 을 만들고 ESLint에 규칙을 넣습니다.",
        "",
      ].join("\n"),
    );
  });

  it("설정 파일이 이미 있으면 설정을 요청하라는 안내를 하지 않는다", async () => {
    const cwd = tempProject({
      "package.json": `{ "devDependencies": { "designsnitch": "^0.2.0" } }`,
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
    });
    const { stdout } = await install(cwd);
    expect(stdout).not.toContain("다음에 할 일");
  });

  it("프로젝트에 설치되어 있지 않으면 먼저 설치하라고 알린다", async () => {
    const { stdout } = await install(tempProject({ "package.json": `{}` }));
    expect(stdout).toContain("- 훅이 매번 빠르게 돌도록 프로젝트에 설치하세요: npm install --save-dev designsnitch");
  });

  it("이미 있는 설정과 다른 훅을 그대로 둔다", async () => {
    const existing = {
      permissions: { allow: ["Bash(npm test)"] },
      hooks: {
        PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo done" }] }],
        SessionStart: [{ hooks: [{ type: "command", command: "echo hi" }] }],
      },
    };
    const cwd = tempProject({ ".claude/settings.json": JSON.stringify(existing) });
    await install(cwd);
    expect(readSettings(cwd)).toEqual({
      permissions: existing.permissions,
      hooks: {
        PostToolUse: [...existing.hooks.PostToolUse, { matcher: "Edit|Write|MultiEdit", hooks: [HOOK] }],
        SessionStart: [...existing.hooks.SessionStart, { hooks: [HOOK] }],
        Stop: [{ hooks: [HOOK] }],
      },
    });
  });

  it("두 번 실행해도 훅이 중복되지 않고, 스킬은 최신으로 덮어쓴다", async () => {
    const cwd = tempProject({});
    await install(cwd);
    fs.writeFileSync(path.join(cwd, ".claude/skills/designsnitch-check/SKILL.md"), "예전 내용");
    const { stdout } = await install(cwd);

    const settings = readSettings(cwd);
    expect(settings.hooks.PostToolUse).toHaveLength(1);
    expect(settings.hooks.Stop).toHaveLength(1);
    expect(stdout).toContain("훅은 이미 .claude/settings.json 에 등록되어 있습니다.");
    expect(fs.readFileSync(path.join(cwd, ".claude/skills/designsnitch-check/SKILL.md"), "utf8")).toContain(
      "name: designsnitch-check",
    );
  });

  it("사용자가 만든 다른 스킬은 건드리지 않는다", async () => {
    const cwd = tempProject({ ".claude/skills/my-skill/SKILL.md": "내 스킬" });
    await install(cwd);
    expect(fs.readFileSync(path.join(cwd, ".claude/skills/my-skill/SKILL.md"), "utf8")).toBe("내 스킬");
  });

  it("settings.json 이 깨져 있으면 아무것도 바꾸지 않고 2로 끝난다", async () => {
    const cwd = tempProject({ ".claude/settings.json": `{ "hooks": ` });
    const { exitCode, stderr } = await install(cwd);
    expect(exitCode).toBe(2);
    expect(stderr).toContain(".claude/settings.json");
    expect(fs.readFileSync(path.join(cwd, ".claude/settings.json"), "utf8")).toBe(`{ "hooks": `);
    expect(fs.existsSync(path.join(cwd, ".claude/skills"))).toBe(false);
  });
});

describe("designsnitch install --agent codex", () => {
  const CODEX_HOOK = { type: "command", command: "npx designsnitch hook", timeout: 60 };
  const readHooks = (cwd) => JSON.parse(fs.readFileSync(path.join(cwd, ".codex/hooks.json"), "utf8"));
  const readGemini = (cwd) => JSON.parse(fs.readFileSync(path.join(cwd, ".gemini/settings.json"), "utf8"));
  const installed = `{ "devDependencies": { "designsnitch": "^0.3.0" } }`;

  it("스킬을 .agents/skills 에 복사하고 훅을 .codex/hooks.json 에 등록한다", async () => {
    const cwd = tempProject({ "package.json": installed });
    const { exitCode, stdout, stderr } = await install(cwd, "--agent", "codex");

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(fs.readdirSync(path.join(cwd, ".agents/skills")).sort()).toEqual(SKILLS);
    expect(readHooks(cwd)).toEqual({
      hooks: {
        PostToolUse: [{ matcher: "apply_patch", hooks: [CODEX_HOOK] }],
        Stop: [{ hooks: [CODEX_HOOK] }],
        SessionStart: [{ hooks: [CODEX_HOOK] }],
      },
    });
    expect(fs.existsSync(path.join(cwd, ".claude"))).toBe(false);
    expect(stdout).toBe(
      [
        "스킬 5개를 .agents/skills 에 복사했습니다.",
        "훅을 .codex/hooks.json 에 등록했습니다.",
        "",
        "다음에 할 일",
        "- Codex는 신뢰한 프로젝트에서, 사용자가 승인한 훅만 실행합니다. 이 프로젝트에서 Codex를 열고 프로젝트 신뢰와 훅 승인을 요청받으면 승인하세요.",
        "- 코딩 에이전트에게 \"이 프로젝트에 designsnitch를 설정해 줘\"라고 요청하세요. 토큰 CSS와 공용 컴포넌트를 찾아 designsnitch.config.json 을 만들고 ESLint에 규칙을 넣습니다.",
        "",
      ].join("\n"),
    );
  });

  it("이미 있는 Codex 훅을 그대로 두고, 두 번 실행해도 중복되지 않는다", async () => {
    const existing = { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo guard" }] }] } };
    const cwd = tempProject({ "package.json": installed, ".codex/hooks.json": JSON.stringify(existing) });
    await install(cwd, "--agent", "codex");
    const { stdout } = await install(cwd, "--agent", "codex");

    const hooks = readHooks(cwd).hooks;
    expect(hooks.PreToolUse).toEqual(existing.hooks.PreToolUse);
    expect(hooks.PostToolUse).toHaveLength(1);
    expect(hooks.Stop).toHaveLength(1);
    expect(stdout).toContain("훅은 이미 .codex/hooks.json 에 등록되어 있습니다.");
    // 이미 등록된 뒤에는 승인 안내를 다시 하지 않는다.
    expect(stdout).not.toContain("Codex는 신뢰한 프로젝트에서");
  });

  it("--agent all 은 Claude Code, Codex, Gemini CLI, Grok Build 에 모두 설치한다", async () => {
    const cwd = tempProject({ "package.json": installed });
    const { stdout } = await install(cwd, "--agent", "all");
    expect(fs.readdirSync(path.join(cwd, ".claude/skills")).sort()).toEqual(SKILLS);
    expect(fs.readdirSync(path.join(cwd, ".agents/skills")).sort()).toEqual(SKILLS);
    expect(readSettings(cwd).hooks.Stop).toEqual([{ hooks: [HOOK] }]);
    expect(readHooks(cwd).hooks.Stop).toEqual([{ hooks: [CODEX_HOOK] }]);
    expect(Object.keys(readGemini(cwd).hooks)).toEqual(["AfterTool", "AfterAgent", "SessionStart"]);
    // Grok Build 는 세션 시작 이벤트를 문서에서 확인하지 못해 등록하지 않는다.
    expect(Object.keys(JSON.parse(fs.readFileSync(path.join(cwd, ".grok/hooks/designsnitch.json"), "utf8")).hooks)).toEqual(["PostToolUse", "Stop"]);
    expect(fs.existsSync(path.join(cwd, ".grok/hooks/designsnitch.json"))).toBe(true);
    // Codex 와 Gemini CLI 는 같은 .agents/skills 를 읽으므로 한 번만 복사한다.
    expect(stdout.split("\n").slice(0, 7)).toEqual([
      "스킬 5개를 .claude/skills 에 복사했습니다.",
      "훅을 .claude/settings.json 에 등록했습니다.",
      "스킬 5개를 .agents/skills 에 복사했습니다.",
      "훅을 .codex/hooks.json 에 등록했습니다.",
      "훅을 .gemini/settings.json 에 등록했습니다.",
      "스킬 5개를 .grok/skills 에 복사했습니다.",
      "훅을 .grok/hooks/designsnitch.json 에 등록했습니다.",
    ]);
  });

  it("--agent 를 주지 않으면 Claude Code 에만 설치한다", async () => {
    const cwd = tempProject({ "package.json": installed });
    await install(cwd);
    expect(fs.existsSync(path.join(cwd, ".claude/skills"))).toBe(true);
    expect(fs.existsSync(path.join(cwd, ".agents"))).toBe(false);
    expect(fs.existsSync(path.join(cwd, ".codex"))).toBe(false);
  });

  it("모르는 에이전트를 주면 사용법을 알리고 아무것도 설치하지 않는다", async () => {
    const cwd = tempProject({ "package.json": installed });
    const { exitCode, stderr } = await install(cwd, "--agent", "cursor");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("--agent claude|codex|gemini|grok|all");
    expect(fs.existsSync(path.join(cwd, ".claude"))).toBe(false);
  });

  it("영어로도 안내한다", async () => {
    const { stdout } = await install(tempProject({ "package.json": installed }), "--agent", "codex", "--lang", "en");
    expect(stdout).toContain("Copied 5 skills to .agents/skills.");
    expect(stdout).toContain("Registered the hook in .codex/hooks.json.");
    expect(stdout).toContain(
      "- Codex runs project hooks only in a trusted project, and only hooks you have approved. Open Codex in this project and approve the project and the hook when it asks.",
    );
  });
});

describe("designsnitch install --agent gemini", () => {
  const GEMINI_HOOK = { name: "designsnitch", type: "command", command: "npx designsnitch hook", timeout: 60000 };
  const readGemini = (cwd) => JSON.parse(fs.readFileSync(path.join(cwd, ".gemini/settings.json"), "utf8"));
  const installed = `{ "devDependencies": { "designsnitch": "^0.3.0" } }`;

  it("스킬을 .agents/skills 에 복사하고 훅을 .gemini/settings.json 에 등록한다", async () => {
    const cwd = tempProject({ "package.json": installed });
    const { exitCode, stdout, stderr } = await install(cwd, "--agent", "gemini");

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(fs.readdirSync(path.join(cwd, ".agents/skills")).sort()).toEqual(SKILLS);
    expect(readGemini(cwd)).toEqual({
      hooks: {
        AfterTool: [{ matcher: "write_file|replace", hooks: [GEMINI_HOOK] }],
        AfterAgent: [{ hooks: [GEMINI_HOOK] }],
        SessionStart: [{ hooks: [GEMINI_HOOK] }],
      },
    });
    expect(stdout).toBe(
      [
        "스킬 5개를 .agents/skills 에 복사했습니다.",
        "훅을 .gemini/settings.json 에 등록했습니다.",
        "",
        "다음에 할 일",
        "- Gemini CLI는 프로젝트에 새 훅이 생기면 실행하기 전에 경고합니다. 이 프로젝트에서 Gemini CLI를 열고 훅을 허용하세요. 폴더 신뢰 기능을 켜 두었다면 이 폴더도 신뢰해야 합니다.",
        "- 코딩 에이전트에게 \"이 프로젝트에 designsnitch를 설정해 줘\"라고 요청하세요. 토큰 CSS와 공용 컴포넌트를 찾아 designsnitch.config.json 을 만들고 ESLint에 규칙을 넣습니다.",
        "",
      ].join("\n"),
    );
  });

  it("이미 있는 Gemini 설정과 다른 훅을 그대로 두고, 두 번 실행해도 중복되지 않는다", async () => {
    const existing = {
      model: { name: "gemini-pro" },
      hooks: { BeforeTool: [{ matcher: "run_shell_command", hooks: [{ type: "command", command: "echo guard" }] }] },
    };
    const cwd = tempProject({ "package.json": installed, ".gemini/settings.json": JSON.stringify(existing) });
    await install(cwd, "--agent", "gemini");
    const { stdout } = await install(cwd, "--agent", "gemini");

    const settings = readGemini(cwd);
    expect(settings.model).toEqual(existing.model);
    expect(settings.hooks.BeforeTool).toEqual(existing.hooks.BeforeTool);
    expect(settings.hooks.AfterTool).toHaveLength(1);
    expect(settings.hooks.AfterAgent).toHaveLength(1);
    expect(stdout).toContain("훅은 이미 .gemini/settings.json 에 등록되어 있습니다.");
  });

  it("영어로도 안내한다", async () => {
    const { stdout } = await install(tempProject({ "package.json": installed }), "--agent", "gemini", "--lang", "en");
    expect(stdout).toContain(
      "- Gemini CLI warns before it runs a new project hook. Open Gemini CLI in this project and allow the hook. If you have turned on folder trust, trust this folder too.",
    );
  });
});

describe("designsnitch install --agent grok", () => {
  const GROK_HOOK = { type: "command", command: "npx designsnitch hook", timeout: 60 };
  const readGrok = (cwd) => JSON.parse(fs.readFileSync(path.join(cwd, ".grok/hooks/designsnitch.json"), "utf8"));
  const installed = `{ "devDependencies": { "designsnitch": "^0.3.0" } }`;

  it("스킬을 .grok/skills 에 복사하고 훅을 .grok/hooks/designsnitch.json 에 등록한다", async () => {
    const cwd = tempProject({ "package.json": installed });
    const { exitCode, stdout, stderr } = await install(cwd, "--agent", "grok");

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(fs.readdirSync(path.join(cwd, ".grok/skills")).sort()).toEqual(SKILLS);
    expect(readGrok(cwd)).toEqual({
      hooks: {
        PostToolUse: [{ matcher: "Edit|Write|MultiEdit", hooks: [GROK_HOOK] }],
        Stop: [{ hooks: [GROK_HOOK] }],
      },
    });
    expect(stdout).toBe(
      [
        "스킬 5개를 .grok/skills 에 복사했습니다.",
        "훅을 .grok/hooks/designsnitch.json 에 등록했습니다.",
        "",
        "다음에 할 일",
        "- Grok Build는 신뢰한 프로젝트의 훅만 실행합니다. 이 프로젝트에서 Grok Build를 열고 /hooks-trust 로 신뢰하거나 --trust 로 시작하세요.",
        "- 코딩 에이전트에게 \"이 프로젝트에 designsnitch를 설정해 줘\"라고 요청하세요. 토큰 CSS와 공용 컴포넌트를 찾아 designsnitch.config.json 을 만들고 ESLint에 규칙을 넣습니다.",
        "",
      ].join("\n"),
    );
  });

  it("두 번 실행해도 중복되지 않고, 같은 폴더의 다른 훅 파일은 건드리지 않는다", async () => {
    const other = { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo guard" }] }] } };
    const cwd = tempProject({ "package.json": installed, ".grok/hooks/safety.json": JSON.stringify(other) });
    await install(cwd, "--agent", "grok");
    const { stdout } = await install(cwd, "--agent", "grok");

    expect(readGrok(cwd).hooks.PostToolUse).toHaveLength(1);
    expect(readGrok(cwd).hooks.Stop).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(cwd, ".grok/hooks/safety.json"), "utf8"))).toEqual(other);
    expect(stdout).toContain("훅은 이미 .grok/hooks/designsnitch.json 에 등록되어 있습니다.");
  });

  it("영어로도 안내한다", async () => {
    const { stdout } = await install(tempProject({ "package.json": installed }), "--agent", "grok", "--lang", "en");
    expect(stdout).toContain(
      "- Grok Build runs project hooks only in a trusted project. Open Grok Build in this project and trust it with /hooks-trust, or start it with --trust.",
    );
  });
});

describe("버전", () => {
  it("플러그인의 버전은 package.json 과 같다", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
    expect(plugin.meta.version).toBe(pkg.version);
  });
});
