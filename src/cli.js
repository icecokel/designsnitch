import { parseArgs } from "node:util";
import { check } from "./check.js";
import { loadConfig } from "./config.js";
import { formatText } from "./format.js";

const USAGE = `사용법: designsnitch check [경로...] [--format text|json] [--config 파일]

프로젝트의 UI 코드가 디자인 시스템을 따르는지 검사합니다.

  경로        검사할 파일이나 디렉터리 (기본: 현재 디렉터리)
  --format    출력 형식. text(기본) 또는 json
  --config    설정 파일 경로 (기본: designsnitch.config.json)

종료 코드: 0 오류 없음, 1 오류 있음, 2 실행하지 못함
`;

const FORMATS = {
  text: formatText,
  json: (result) => `${JSON.stringify(result, null, 2)}\n`,
};

/**
 * @param {string[]} argv 명령 이름부터 시작하는 인자 (process.argv.slice(2))
 * @param {{ cwd: string, stdout: { write(chunk: string): unknown }, stderr: { write(chunk: string): unknown } }} io
 * @returns {Promise<number>} 종료 코드
 */
export async function run(argv, { cwd, stdout, stderr }) {
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

  const [command, ...paths] = args.positionals;
  const format = FORMATS[args.values.format];
  if (command !== "check" || !format) {
    stderr.write(USAGE);
    return 2;
  }

  let result;
  try {
    const config = loadConfig(cwd, args.values.config);
    result = await check({ cwd, config, paths: paths.length > 0 ? paths : undefined });
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 2;
  }

  stdout.write(format(result));
  return result.summary.errors > 0 ? 1 : 0;
}
