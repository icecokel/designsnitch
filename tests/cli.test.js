import path from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import { run } from "../src/cli.js";
import { loadConfig } from "../src/config.js";
import { tempProject } from "./temp-project.js";

const project = path.resolve("tests/fixtures/project");

async function runCli(argv, cwd = project) {
  let stdout = "";
  let stderr = "";
  const exitCode = await run(argv, {
    cwd,
    stdout: { write: (chunk) => (stdout += chunk) },
    stderr: { write: (chunk) => (stderr += chunk) },
  });
  return { exitCode, stdout, stderr };
}

describe("designsnitch check", () => {
  it("--format json 은 검사 결과를 JSON 으로 내고, 오류가 있으면 1로 끝난다", async () => {
    const { exitCode, stdout, stderr } = await runCli(["check", "--format", "json"]);

    expect(JSON.parse(stdout)).toEqual(
      await check({ cwd: project, config: loadConfig(project) }),
    );
    expect(stderr).toBe("");
    expect(exitCode).toBe(1);
  });

  it("기본 출력은 사람이 읽는 형식이다", async () => {
    const { stdout } = await runCli(["check"]);
    expect(stdout).toContain("src/PayButton.tsx\n  5:6  오류  <button> 대신");
    expect(stdout).toContain("오류 3개, 경고 1개 (파일 3개 검사)");
  });

  it("경로를 주면 그 안만 검사하고, 위반이 없으면 0으로 끝난다", async () => {
    const { exitCode, stdout } = await runCli(["check", "components"]);
    expect(stdout).toBe("위반이 없습니다. (파일 1개 검사)\n");
    expect(exitCode).toBe(0);
  });

  it("경고만 있으면 0으로 끝난다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-primary: #3B82F6; }`,
      "src/Card.jsx": `export const Card = () => <div className="bg-[#123456]" />;`,
    });
    const { exitCode, stdout } = await runCli(["check"], cwd);
    expect(stdout).toContain("오류 0개, 경고 1개");
    expect(exitCode).toBe(0);
  });

  it("--config 로 다른 설정 파일을 쓸 수 있다", async () => {
    const cwd = tempProject({
      "config/ds.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-primary: #3B82F6; }`,
      "src/Card.jsx": `export const Card = () => <div className="bg-[#3B82F6]" />;`,
    });
    const { exitCode } = await runCli(["check", "--config", "config/ds.json"], cwd);
    expect(exitCode).toBe(1);
  });
});

describe("잘못 쓴 경우", () => {
  it("설정 파일이 없으면 이유를 알리고 2로 끝난다", async () => {
    const { exitCode, stdout, stderr } = await runCli(["check"], tempProject({}));
    expect(stderr).toContain("설정 파일이 없습니다");
    expect(stdout).toBe("");
    expect(exitCode).toBe(2);
  });

  it("토큰 CSS 가 없으면 이유를 알리고 2로 끝난다", async () => {
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "missing.css" }`,
      "src/Card.jsx": `export const Card = () => <div />;`,
    });
    const { exitCode, stderr } = await runCli(["check"], cwd);
    expect(stderr).toContain("토큰 CSS 파일을 찾을 수 없습니다");
    expect(exitCode).toBe(2);
  });

  it("모르는 명령이나 형식이면 사용법을 알리고 2로 끝난다", async () => {
    for (const argv of [["lint"], ["check", "--format", "xml"], []]) {
      const { exitCode, stderr } = await runCli(argv);
      expect(stderr).toContain("사용법: designsnitch check");
      expect(exitCode).toBe(2);
    }
  });

  it("--help 는 사용법을 보여주고 0으로 끝난다", async () => {
    const { exitCode, stdout } = await runCli(["--help"]);
    expect(stdout).toContain("사용법: designsnitch check");
    expect(exitCode).toBe(0);
  });
});
