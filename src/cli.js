import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { check } from "./check.js";
import { collectColors } from "./colors.js";
import { CONFIG_FILE, loadConfig } from "./config.js";
import { formatColorsText, formatText } from "./format.js";
import { runHook } from "./hook.js";
import { AGENT_CHOICES, install } from "./install.js";
import { isLang, messages, resolveLang } from "./messages.js";
import { loadTokens } from "./rules/load-tokens.js";

const json = (result) => `${JSON.stringify(result, null, 2)}\n`;

// 명령은 내보낼 글과 종료 코드를 돌려준다. flagLang 은 --lang 으로 준 언어다(없으면 undefined).
const COMMANDS = {
  async check({ cwd, paths, configPath, format, flagLang }) {
    const config = loadConfig(cwd, configPath, resolveLang(flagLang));
    const lang = resolveLang(flagLang, config.lang);
    const result = await check({ cwd, config, paths, lang });
    return {
      stdout: format === "json" ? json(result) : formatText(result, lang),
      exitCode: result.summary.errors > 0 ? 1 : 0,
    };
  },

  // 설정 파일은 선택이다. 있으면 색마다 이미 있는 토큰을 붙인다.
  async colors({ cwd, paths, configPath, format, flagLang }) {
    const hasConfig = configPath !== undefined || fs.existsSync(path.resolve(cwd, CONFIG_FILE));
    const config = hasConfig ? loadConfig(cwd, configPath, resolveLang(flagLang)) : undefined;
    const lang = resolveLang(flagLang, config?.lang);
    const tokens = config ? loadTokens({ designsnitch: { ...config, lang } }, cwd) : undefined;
    const result = await collectColors({ cwd, paths, tokens: tokens?.colors, tokenFiles: tokens?.files });
    return { stdout: format === "json" ? json(result) : formatColorsText(result, lang), exitCode: 0 };
  },

  hook({ cwd, configPath, stdin, flagLang }) {
    return runHook({ cwd, input: stdin, configPath, lang: flagLang });
  },

  install({ cwd, flagLang, agent }) {
    return install({ cwd, lang: resolveLang(flagLang), agent });
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
        lang: { type: "string" },
        agent: { type: "string", default: "claude" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    stderr.write(`${error.message}\n\n${messages().cliUsage}`);
    return 2;
  }

  const flagLang = args.values.lang;
  const usage = messages(resolveLang(flagLang)).cliUsage;

  if (args.values.help) {
    stdout.write(usage);
    return 0;
  }

  const [name, ...paths] = args.positionals;
  const command = Object.hasOwn(COMMANDS, name ?? "") ? COMMANDS[name] : undefined;
  const { format } = args.values;
  const validLang = flagLang === undefined || isLang(flagLang);
  const { agent } = args.values;
  if (!command || !["text", "json"].includes(format) || !validLang || !AGENT_CHOICES.includes(agent)) {
    stderr.write(usage);
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
      flagLang,
      agent,
    });
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 2;
  }

  if (outcome.stdout) stdout.write(outcome.stdout);
  if (outcome.stderr) stderr.write(outcome.stderr);
  return outcome.exitCode;
}
