import path from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import { run } from "../src/cli.js";
import { collectColors } from "../src/colors.js";
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
    // 파일 수에는 토큰 CSS(app/globals.css)도 들어간다.
    expect(stdout).toContain("오류 3개, 경고 0개 (파일 4개 검사)");
  });

  it("경로를 주면 그 안만 검사하고, 위반이 없으면 0으로 끝난다", async () => {
    const { exitCode, stdout } = await runCli(["check", "components"]);
    expect(stdout).toBe(
      "디자인 시스템: 색 토큰 3개, 컴포넌트 1개\n\n" +
        "위반이 없습니다. (파일 1개 검사)\n",
    );
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
    for (const argv of [["lint"], ["constructor"], ["check", "--format", "xml"], []]) {
      const { exitCode, stderr } = await runCli(argv);
      expect(stderr).toContain("사용법: designsnitch <명령>");
      expect(exitCode).toBe(2);
    }
  });

  it("--help 는 사용법을 보여주고 0으로 끝난다", async () => {
    const { exitCode, stdout } = await runCli(["--help"]);
    expect(stdout).toContain("사용법: designsnitch <명령>");
    expect(exitCode).toBe(0);
  });
});

describe("designsnitch colors", () => {
  const files = {
    "src/Card.jsx": `export const Card = () => <div className="bg-[#3B82F6] text-[#FFF] bg-blue-500" style={{ color: "#3B82F6" }} />;`,
  };

  it("설정 파일이 없어도 코드에서 쓰는 색을 보여주고 0으로 끝난다", async () => {
    const cwd = tempProject(files);
    const { exitCode, stdout, stderr } = await runCli(["colors"], cwd);
    expect(stdout).toBe(
      [
        "코드에서 쓰는 색: hex 2개, 기본 팔레트 1개 (사용 4곳, 파일 1개 검사)",
        "",
        "hex 색",
        "  #3b82f6  2곳  파일 1개  bg 1, 문자열 1",
        "  #ffffff  1곳  파일 1개  text 1",
        "",
        "Tailwind 기본 팔레트",
        "  blue-500  1곳  파일 1개  bg 1",
        "",
      ].join("\n"),
    );
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
  });

  it("--format json 은 수집 결과를 JSON 으로 낸다", async () => {
    const cwd = tempProject(files);
    const { stdout } = await runCli(["colors", "--format", "json"], cwd);
    expect(JSON.parse(stdout)).toEqual(await collectColors({ cwd }));
  });

  it("설정 파일이 있으면 색마다 이미 있는 토큰을 알려준다", async () => {
    const cwd = tempProject({
      ...files,
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-primary: #3B82F6; --color-brand: #3b82f6; }`,
    });
    const { stdout } = await runCli(["colors"], cwd);
    expect(stdout).toContain("  #3b82f6  2곳  파일 1개  bg 1, 문자열 1  토큰: --color-primary, --color-brand");
    expect(stdout).toContain("  #ffffff  1곳  파일 1개  text 1  토큰 없음");
  });

  it("CSS 에서 쓴 횟수를 함께 보여준다", async () => {
    const cwd = tempProject({ ...files, "src/card.css": `.card { color: #3B82F6; border-color: #3b82f6; }` });
    const { stdout } = await runCli(["colors"], cwd);
    expect(stdout).toContain("  #3b82f6  4곳  파일 2개  bg 1, 문자열 1, CSS 2");
  });

  it("경로를 주면 그 안만 본다", async () => {
    const cwd = tempProject({ ...files, "lib/x.js": `export const c = "bg-[#000000]";` });
    const { stdout } = await runCli(["colors", "lib", "--format", "json"], cwd);
    expect(JSON.parse(stdout).colors.map((c) => c.color)).toEqual(["#000000"]);
  });

  it("색이 없으면 없다고 알린다", async () => {
    const cwd = tempProject({ "src/a.js": `export const a = 1;` });
    const { stdout } = await runCli(["colors"], cwd);
    expect(stdout).toBe("코드에서 색을 찾지 못했습니다. (파일 1개 검사)\n");
  });

  it("--config 로 지정한 파일이 없으면 2로 끝난다", async () => {
    const { exitCode, stderr } = await runCli(["colors", "--config", "nope.json"], tempProject(files));
    expect(stderr).toContain("설정 파일이 없습니다");
    expect(exitCode).toBe(2);
  });
});
