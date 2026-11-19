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

async function install(cwd) {
  let stdout = "";
  let stderr = "";
  const exitCode = await run(["install"], {
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
        SessionStart: existing.hooks.SessionStart,
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

describe("버전", () => {
  it("플러그인의 버전은 package.json 과 같다", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
    expect(plugin.meta.version).toBe(pkg.version);
  });
});
