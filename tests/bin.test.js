import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tempProject } from "./temp-project.js";

const bin = path.resolve("bin/designsnitch.js");

describe("bin/designsnitch.js", () => {
  it("출력을 받는 쪽이 먼저 닫아도(| head) 오류 없이 끝난다", () => {
    // 파이프 버퍼보다 큰 출력이 나오도록 위반을 많이 만든다.
    const lines = Array.from({ length: 3000 }, (_, i) => `  "bg-[#12${String(i).padStart(4, "0")}]",`);
    const cwd = tempProject({
      "designsnitch.config.json": `{ "tokens": "tokens.css" }`,
      "tokens.css": `@theme { --color-primary: #3B82F6; }`,
      "src/many.js": `export const classes = [\n${lines.join("\n")}\n];\n`,
    });

    const result = spawnSync("sh", ["-c", `node "${bin}" check | head -1`], {
      cwd,
      encoding: "utf8",
    });

    expect(result.stdout).toBe(
      "디자인 시스템: 색 토큰 1개, 컴포넌트 설정 없음\n",
    );
    expect(result.stderr).toBe("");
  });

  it("종료 코드를 그대로 돌려준다", () => {
    const cwd = tempProject({});
    const result = spawnSync("node", [bin, "check"], { cwd, encoding: "utf8" });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("설정 파일이 없습니다");
  });
});
