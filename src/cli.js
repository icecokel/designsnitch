import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { check } from "./check.js";
import { collectColors } from "./colors.js";
import { CONFIG_FILE, loadConfig } from "./config.js";
import { formatColorsText, formatText } from "./format.js";
import { runHook } from "./hook.js";
import { install } from "./install.js";
import { loadTokens } from "./rules/load-tokens.js";

const USAGE = `사용법: designsnitch <명령> [경로...] [--format text|json] [--config 파일]

명령
  check     UI 코드가 디자인 시스템을 따르는지 검사합니다.
  colors    코드에서 쓰는 색을 모아 보여줍니다. 설정 파일이 없어도 됩니다.
  hook      코딩 에이전트의 훅에서 부릅니다. 방금 고친 파일에 오류가 있으면 2로 끝납니다.
  install   스킬과 에이전트 훅을 프로젝트(.claude)에 설치합니다.

옵션
  경로        볼 파일이나 디렉터리 (기본: 현재 디렉터리)
  --format    출력 형식. text(기본) 또는 json
  --config    설정 파일 경로 (기본: designsnitch.config.json)

check 의 종료 코드: 0 오류 없음, 1 오류 있음, 2 실행하지 못함
`;

const json = (result) => `${JSON.stringify(result, null, 2)}\n`;

// 명령은 내보낼 글과 종료 코드를 돌려준다.
const COMMANDS = {
  async check({ cwd, paths, configPath, format }) {
    const result = await check({ cwd, config: loadConfig(cwd, configPath), paths });
    return {
      stdout: format === "json" ? json(result) : formatText(result),
      exitCode: result.summary.errors > 0 ? 1 : 0,
    };
  },

  // 설정 파일은 선택이다. 있으면 색마다 이미 있는 토큰을 붙인다.
  async colors({ cwd, paths, configPath, format }) {
    const hasConfig = configPath !== undefined || fs.existsSync(path.resolve(cwd, CONFIG_FILE));
    const tokens = hasConfig
      ? loadTokens({ designsnitch: loadConfig(cwd, configPath) }, cwd).colors
      : undefined;
    const result = await collectColors({ cwd, paths, tokens });
    return { stdout: format === "json" ? json(result) : formatColorsText(result), exitCode: 0 };
  },

  hook({ cwd, configPath, stdin }) {
    return runHook({ cwd, input: stdin, configPath });
  },

  install({ cwd }) {
    return install({ cwd });
  },
};

/**
 * @param {string[]} argv 명령 이름부터 시작하는 인자 (process.argv.slice(2))
 * @param {{ cwd: string, stdin?: string, stdout: { write(chunk: string): unknown }, stderr: { write(chunk: string): unknown } }} io
 *   stdin 은 이미 읽어 둔 표준 입력이다. hook 명령만 쓴다
 * @returns {Promise<number>} 종료 코드
 */
export async function run(argv, { cwd, stdin, stdout, stderr }) {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        format: { type: "string", default: "text" },
        config: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    stderr.write(`${error.message}\n\n${USAGE}`);
    return 2;
  }

  if (args.values.help) {
    stdout.write(USAGE);
    return 0;
  }

  const [name, ...paths] = args.positionals;
  const command = Object.hasOwn(COMMANDS, name ?? "") ? COMMANDS[name] : undefined;
  const { format } = args.values;
  if (!command || !["text", "json"].includes(format)) {
    stderr.write(USAGE);
    return 2;
  }

  let outcome;
  try {
    outcome = await command({
      cwd,
      paths: paths.length > 0 ? paths : undefined,
      configPath: args.values.config,
      format,
      stdin,
    });
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 2;
  }

  if (outcome.stdout) stdout.write(outcome.stdout);
  if (outcome.stderr) stderr.write(outcome.stderr);
  return outcome.exitCode;
}
