import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.js";
import { tempProject } from "./temp-project.js";

const base = {
  "designsnitch.config.json": JSON.stringify({
    tokens: "tokens.css",
    components: { path: "ui", replaces: { button: ["SolidButton", "GhostButton"] } },
  }),
  "tokens.css": `@theme { --color-primary: #3B82F6; }`,
  "ui/solid-button.tsx": `export const SolidButton = () => null;`,
};
const REPLACE = `export const A = () => <div className="bg-[#3B82F6]" />;`; // 후보 1개인 오류
const ASK = `export const B = () => <button>확인</button>;`; // 후보 2개인 오류
const WARN = `export const C = () => <div className="bg-[#123456]" />;`; // 경고
const CLEAN = `export const D = () => <div className="bg-primary" />;`;

async function hook(cwd, payload) {
  let stdout = "";
  let stderr = "";
  const exitCode = await run(["hook"], {
    cwd,
    stdin: payload === undefined ? "" : JSON.stringify(payload),
    stdout: { write: (chunk) => (stdout += chunk) },
    stderr: { write: (chunk) => (stderr += chunk) },
  });
  return { exitCode, stdout, stderr };
}

function git(cwd, ...args) {
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, stdio: "pipe" });
}

describe("designsnitch hook: 파일을 고친 직후", () => {
  const edited = (file) => ({ hook_event_name: "PostToolUse", tool_input: { file_path: file } });

  it("고친 파일에 오류가 있으면 2로 끝나고, 무엇을 어떻게 고칠지 stderr 로 알린다", async () => {
    const cwd = tempProject({ ...base, "src/a.tsx": REPLACE });
    const { exitCode, stdout, stderr } = await hook(cwd, edited(path.join(cwd, "src/a.tsx")));

    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toBe(
      [
        "designsnitch: 방금 고친 파일에 디자인 시스템 오류가 1건 있습니다.",
        "",
        "src/a.tsx:1:40  bg-[#3B82F6]의 색은 토큰 --color-primary의 값입니다. 대신 사용: bg-primary  [replace]",
        "",
        "다음에 할 일",
        "- action이 replace인 1건은 found를 candidates의 값으로 바꾸세요.",
        "- 고친 뒤 같은 명령을 다시 실행하세요.",
        "",
      ].join("\n"),
    );
  });

  it("사람이 정해야 하는 오류도 알린다", async () => {
    const cwd = tempProject({ ...base, "src/b.tsx": ASK });
    const { exitCode, stderr } = await hook(cwd, edited("src/b.tsx"));
    expect(exitCode).toBe(2);
    expect(stderr).toContain("[ask]");
    expect(stderr).toContain("사용자에게 물으세요");
  });

  it("오류가 없으면(경고만 있어도) 조용히 0으로 끝난다", async () => {
    const cwd = tempProject({ ...base, "src/c.tsx": WARN, "src/d.tsx": CLEAN });
    for (const file of ["src/c.tsx", "src/d.tsx"]) {
      expect(await hook(cwd, edited(file))).toEqual({ exitCode: 0, stdout: "", stderr: "" });
    }
  });

  it("검사 대상이 아닌 파일이나 프로젝트 밖의 파일은 넘어간다", async () => {
    const cwd = tempProject({ ...base, "README.md": "bg-[#3B82F6]" });
    for (const file of ["README.md", "/etc/hosts", "src/missing.tsx"]) {
      expect((await hook(cwd, edited(file))).exitCode).toBe(0);
    }
  });

  it("설정 파일이 없는 프로젝트에서는 아무것도 하지 않는다", async () => {
    const cwd = tempProject({ "src/a.tsx": REPLACE });
    expect(await hook(cwd, edited("src/a.tsx"))).toEqual({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("토큰 CSS 가 깨져 있으면 그 사실을 알리고 2로 끝난다", async () => {
    const cwd = tempProject({ ...base, "tokens.css": `.x { color: red`, "src/a.tsx": REPLACE });
    const { exitCode, stderr } = await hook(cwd, edited("src/a.tsx"));
    expect(exitCode).toBe(2);
    expect(stderr).toContain("토큰 CSS를 읽을 수 없습니다");
  });
});

describe("designsnitch hook: 고친 파일을 알려주지 않을 때", () => {
  function repo(committed, changed) {
    const cwd = tempProject({ ...base, ...committed });
    git(cwd, "init", "-q");
    git(cwd, "add", "-A");
    git(cwd, "commit", "-q", "-m", "init");
    for (const [name, content] of Object.entries(changed)) {
      fs.mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
      fs.writeFileSync(path.join(cwd, name), content);
    }
    return cwd;
  }

  it("git 에서 바뀐 파일만 검사한다. 이미 커밋된 예전 위반은 건드리지 않는다", async () => {
    const cwd = repo({ "src/legacy.tsx": REPLACE }, { "src/new.tsx": REPLACE, "src/edited.css": `.a { color: #3B82F6; }` });
    const { exitCode, stderr } = await hook(cwd, { hook_event_name: "PostToolUse" });
    expect(exitCode).toBe(2);
    expect(stderr).toContain("src/new.tsx:1:40");
    expect(stderr).toContain("src/edited.css:1:13");
    expect(stderr).not.toContain("legacy.tsx");
  });

  it("바뀐 파일이 없거나 git 저장소가 아니면 0으로 끝난다", async () => {
    expect((await hook(repo({ "src/legacy.tsx": REPLACE }, {}), {})).exitCode).toBe(0);
    expect((await hook(tempProject({ ...base, "src/a.tsx": REPLACE }), {})).exitCode).toBe(0);
  });

  it("입력이 비어 있거나 JSON 이 아니어도 동작한다", async () => {
    const cwd = repo({}, { "src/new.tsx": REPLACE });
    expect((await hook(cwd, undefined)).exitCode).toBe(2);
    const raw = await run(["hook"], { cwd, stdin: "not json", stdout: { write() {} }, stderr: { write() {} } });
    expect(raw).toBe(2);
  });
});

describe("designsnitch hook: 작업을 끝내려 할 때 (Stop)", () => {
  function repo(changed) {
    const cwd = tempProject(base);
    git(cwd, "init", "-q");
    git(cwd, "add", "-A");
    git(cwd, "commit", "-q", "-m", "init");
    for (const [name, content] of Object.entries(changed)) {
      fs.mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
      fs.writeFileSync(path.join(cwd, name), content);
    }
    return cwd;
  }

  it("스스로 고칠 수 있는 오류가 남아 있으면 끝내지 못하게 한다", async () => {
    const { exitCode, stderr } = await hook(repo({ "src/a.tsx": REPLACE }), { hook_event_name: "Stop" });
    expect(exitCode).toBe(2);
    expect(stderr).toContain("[replace]");
  });

  it("사람이 정해야 하는 오류만 남았으면 끝낼 수 있게 한다. 물어보려면 멈춰야 하기 때문이다", async () => {
    const result = await hook(repo({ "src/b.tsx": ASK }), { hook_event_name: "Stop" });
    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("이미 한 번 막았으면(stop_hook_active) 다시 막지 않는다", async () => {
    const result = await hook(repo({ "src/a.tsx": REPLACE }), { hook_event_name: "Stop", stop_hook_active: true });
    expect(result.exitCode).toBe(0);
  });
});

describe("designsnitch hook: Gemini CLI", () => {
  function repo(changed) {
    const cwd = tempProject(base);
    git(cwd, "init", "-q");
    git(cwd, "add", "-A");
    git(cwd, "commit", "-q", "-m", "init");
    for (const [name, content] of Object.entries(changed)) {
      fs.mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
      fs.writeFileSync(path.join(cwd, name), content);
    }
    return cwd;
  }

  it("AfterAgent 는 작업을 끝내려 할 때로 보고, 스스로 고칠 수 있는 오류가 남아 있으면 막는다", async () => {
    const { exitCode, stderr } = await hook(repo({ "src/a.tsx": REPLACE }), { hook_event_name: "AfterAgent", stop_hook_active: false });
    expect(exitCode).toBe(2);
    expect(stderr).toContain("[replace]");
  });

  it("AfterAgent 에서 사람이 정해야 하는 오류만 남았으면 막지 않는다", async () => {
    const result = await hook(repo({ "src/b.tsx": ASK }), { hook_event_name: "AfterAgent" });
    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("AfterAgent 에서 이미 다시 시도하는 중이면(stop_hook_active) 막지 않는다", async () => {
    const result = await hook(repo({ "src/a.tsx": REPLACE }), { hook_event_name: "AfterAgent", stop_hook_active: true });
    expect(result.exitCode).toBe(0);
  });

  it("AfterTool 은 파일을 고친 직후로 본다. 고친 파일을 모르면 git 에서 바뀐 파일을 본다", async () => {
    const cwd = repo({ "src/a.tsx": REPLACE });
    const { exitCode, stderr } = await hook(cwd, { hook_event_name: "AfterTool", tool_name: "write_file", tool_input: { content: "..." } });
    expect(exitCode).toBe(2);
    expect(stderr).toContain("src/a.tsx:1:40");
  });
});

describe("designsnitch hook: Grok Build (camelCase 입력)", () => {
  function repo(changed) {
    const cwd = tempProject(base);
    git(cwd, "init", "-q");
    git(cwd, "add", "-A");
    git(cwd, "commit", "-q", "-m", "init");
    for (const [name, content] of Object.entries(changed)) {
      fs.mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
      fs.writeFileSync(path.join(cwd, name), content);
    }
    return cwd;
  }

  it("hookEventName 과 toolInput.file_path 를 알아듣는다", async () => {
    const cwd = repo({ "src/a.tsx": REPLACE, "src/c.tsx": REPLACE });
    const { exitCode, stderr } = await hook(cwd, { hookEventName: "PostToolUse", toolName: "Edit", toolInput: { file_path: "src/a.tsx" } });
    expect(exitCode).toBe(2);
    expect(stderr).toContain("src/a.tsx:1:40");
    // 고친 파일이 주어졌으므로 다른 파일은 보지 않는다.
    expect(stderr).not.toContain("src/c.tsx");
  });

  it("hookEventName 이 Stop 이면 작업을 끝내려 할 때로 본다", async () => {
    expect((await hook(repo({ "src/b.tsx": ASK }), { hookEventName: "Stop" })).exitCode).toBe(0);
    expect((await hook(repo({ "src/a.tsx": REPLACE }), { hookEventName: "Stop" })).exitCode).toBe(2);
  });
});

