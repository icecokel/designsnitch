import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { check } from "../src/check.js";
import { loadConfig } from "../src/config.js";
import { tempProject } from "./temp-project.js";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const oxlint = path.join(repo, "node_modules", ".bin", "oxlint");

function runOxlint(cwd, files) {
  try {
    return JSON.parse(execFileSync(oxlint, ["--format", "json", ...files], { cwd, encoding: "utf8" }));
  } catch (error) {
    // 오류가 있으면 oxlint 가 0 이 아닌 코드로 끝난다. 결과는 표준 출력에 있다.
    return JSON.parse(error.stdout);
  }
}

it("oxlint 의 JS 플러그인으로 돌려도 CLI 와 같은 곳을 같은 규칙으로 잡는다", async () => {
  const cwd = tempProject({
    "designsnitch.config.json": JSON.stringify({
      tokens: "tokens.css",
      components: { path: "src/ui", replaces: { button: "Button" } },
    }),
    "tokens.css": "@theme {\n  --color-primary: #3b82f6;\n}\n",
    // settings 를 적지 않는다. 플러그인이 designsnitch.config.json 을 읽는다.
    ".oxlintrc.json": JSON.stringify({
      jsPlugins: [path.join(repo, "src", "index.js")],
      plugins: [],
      categories: { correctness: "off" },
      rules: {
        "designsnitch/color-use-token": "error",
        "designsnitch/color-unknown": "warn",
        "designsnitch/use-ds-component": "error",
      },
    }),
    "src/ui/button.tsx": "export const Button = (props: object) => <button {...props} />;\n",
    "src/a.tsx": [
      'const card = cva("bg-[#3B82F6]", { variants: { tone: { x: "text-[color:#3b82f6]" } } });',
      "export const A = ({ on }: { on: boolean }) => (",
      "  <div>",
      '    <p className={cn("p-2", on && "bg-[#3B82F6]")} />',
      '    <p className={`p-2 ${on ? "border-[#3B82F6]" : ""}`} />',
      '    <p className="bg-[#3B82F5]" style={{ color: "#3B82F6" }} />',
      "    <button>x</button>",
      "  </div>",
      ");",
      "",
    ].join("\n"),
  });

  const { diagnostics } = runOxlint(cwd, ["src"]);
  const fromOxlint = diagnostics
    .map(({ code, filename, labels }) => {
      const { line, column } = labels[0].span;
      return `${filename}:${line}:${column} ${code.replace(/^designsnitch\((.+)\)$/, "$1")}`;
    })
    .sort();

  const { violations } = await check({ cwd, config: loadConfig(cwd) });
  const fromCli = violations.map(({ file, line, column, rule }) => `${file}:${line}:${column} ${rule}`).sort();

  expect(fromCli).toHaveLength(7);
  expect(fromOxlint).toEqual(fromCli);
});
