import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { formatText } from "../src/format.js";
import { tempProject } from "./temp-project.js";

it("Node 주 버전이 22 이상이면 실행할 수 있다", async () => {
  const { isSupportedNodeVersion } = await import("../bin/designsnitch.js");

  expect(isSupportedNodeVersion("20.19.0")).toBe(false);
  expect(isSupportedNodeVersion("21.7.3")).toBe(false);
  expect(isSupportedNodeVersion("22.0.0")).toBe(true);
  expect(isSupportedNodeVersion("24.0.0")).toBe(true);
});

it("Node 22 미만에서는 CLI를 불러오기 전에 선택한 언어로 알리고 2로 끝난다", () => {
  const cwd = tempProject({
    "package.json": '{ "type": "module" }',
    "bin/designsnitch.js": fs.readFileSync(new URL("../bin/designsnitch.js", import.meta.url)),
    "src/messages.js": fs.readFileSync(new URL("../src/messages.js", import.meta.url)),
  });
  const bin = path.join(cwd, "designsnitch");
  fs.symlinkSync("bin/designsnitch.js", bin);
  const overrideVersion = `data:text/javascript,${encodeURIComponent(
    'Object.defineProperty(process.versions, "node", { value: "20.19.0" });',
  )}`;

  // CLI 파일이 없어도 버전 안내까지는 실행되어야 한다.
  const run = (...args) =>
    spawnSync(process.execPath, ["--import", overrideVersion, bin, "check", ...args], {
      cwd,
      encoding: "utf8",
    });

  for (const [args, message] of [
    [[], "Node.js 22 이상이 필요합니다(현재 버전: 20.19.0).\n"],
    [["--lang", "en"], "Node.js 22 or later is required (current version: 20.19.0).\n"],
    [["--lang=en"], "Node.js 22 or later is required (current version: 20.19.0).\n"],
  ]) {
    const result = run(...args);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(message);
  }
});

it("Map.groupBy 없이 파일과 위반을 처음 나온 순서대로 묶는다", () => {
  const groupBy = Object.getOwnPropertyDescriptor(Map, "groupBy");
  Object.defineProperty(Map, "groupBy", { configurable: true, value: undefined });
  let output;
  try {
    output = formatText({
      designSystem: { colorTokens: 1, components: 0 },
      problems: [],
      summary: { files: 2, errors: 3, warnings: 0 },
      violations: [
        { file: "z.js", line: 2, column: 1, severity: "error", message: "첫 번째", rule: "color-use-token" },
        { file: "a.js", line: 3, column: 1, severity: "error", message: "두 번째", rule: "color-use-token" },
        { file: "z.js", line: 1, column: 1, severity: "error", message: "세 번째", rule: "color-use-token" },
      ],
    });
  } finally {
    if (groupBy) Object.defineProperty(Map, "groupBy", groupBy);
    else delete Map.groupBy;
  }

  expect(output.split("\n").slice(2, 8)).toEqual([
    "z.js",
    "  2:1  오류  첫 번째  (color-use-token)",
    "  1:1  오류  세 번째  (color-use-token)",
    "",
    "a.js",
    "  3:1  오류  두 번째  (color-use-token)",
  ]);
});
