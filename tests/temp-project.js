import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** 주어진 파일들로 임시 프로젝트를 만들고 그 경로를 돌려준다. */
export function tempProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "designsnitch-"));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  return fs.realpathSync(dir);
}
