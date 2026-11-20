import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { check, nextSteps } from "./check.js";
import { CONFIG_FILE, loadConfig } from "./config.js";
import { messages, resolveLang } from "./messages.js";

const CHECKABLE = /\.(?:[cm]?[jt]s|[jt]sx|css)$/;
// Claude Code, Codex 는 Stop, Gemini CLI 는 AfterAgent 가 "작업을 끝내려 할 때"다.
const STOP_EVENTS = new Set(["Stop", "SubagentStop", "AfterAgent"]);

/**
 * 코딩 에이전트의 훅에서 부르는 검사. 에이전트가 방금 고친 파일만 본다.
 *
 * - 파일을 고친 직후: HEAD 대비 새 오류가 있으면 종료 코드 2와 함께 stderr 로 알린다.
 * - 작업을 끝내려 할 때(Stop): 에이전트가 스스로 고칠 수 있는 새 오류가 남아 있으면 2로 막는다.
 *   사람이 정해야 하는 오류만 남았으면 막지 않는다. 물어보려면 멈춰야 하기 때문이다.
 * - 경고는 막지 않는다. 설정 파일이 없는 프로젝트에서는 아무것도 하지 않는다.
 *
 * @param {object} options
 * @param {string} options.cwd 프로젝트 디렉터리
 * @param {string} [options.input] 훅이 stdin 으로 준 JSON. 비어 있거나 JSON 이 아니어도 된다
 * @param {string} [options.configPath]
 * @param {"en" | "ko"} [options.lang] 없으면 설정의 lang, 환경 변수, 영어 순으로 정한다
 * @returns {Promise<{ stderr: string, exitCode: 0 | 2 }>}
 */
export async function runHook({ cwd, input = "", configPath = CONFIG_FILE, lang }) {
  const pass = { stderr: "", exitCode: 0 };
  const event = parse(input);
  // Claude Code, Codex, Gemini CLI 는 snake_case, Grok Build 는 camelCase 로 보낸다.
  const eventName = event.hook_event_name ?? event.hookEventName;
  const toolInput = event.tool_input ?? event.toolInput;
  const stopping = STOP_EVENTS.has(eventName);

  // 이미 한 번 막아서 에이전트가 고치는 중이면 다시 막지 않는다.
  if (stopping && (event.stop_hook_active ?? event.stopHookActive)) return pass;
  if (!fs.existsSync(path.resolve(cwd, configPath))) return pass;

  const edited = toolInput?.file_path ?? toolInput?.filePath;
  const files = (typeof edited === "string" ? [edited] : changedFiles(cwd))
    .map((file) => path.resolve(cwd, file))
    .filter((file) => isInside(cwd, file) && CHECKABLE.test(file) && fs.existsSync(file))
    .map((file) => path.relative(cwd, file));
  if (files.length === 0) return pass;

  const canBlock = (v) => v.severity === "error" && (!stopping || v.action !== "ask");
  let result;
  let errors;
  try {
    const config = loadConfig(cwd, configPath, resolveLang(lang));
    lang = resolveLang(lang, config.lang);
    result = await check({ cwd, config, paths: files, lang });
    if (!result.violations.some(canBlock)) return pass;

    const baseline = countViolations(await checkHead({ cwd, config, files, lang }));
    const current = countViolations(result.violations);
    errors = result.violations.filter((v) => {
      const key = violationKey(v);
      return v.severity === "error" && current.get(key) > (baseline.get(key) ?? 0);
    });
  } catch (error) {
    return { stderr: `${error.message}\n`, exitCode: 2 };
  }

  if (!errors.some(canBlock)) return pass;

  const m = messages(lang);
  const lines = [
    m.hookHeader(errors.length),
    "",
    ...errors.map((v) => `${v.file}:${v.line}:${v.column}  ${v.message}  [${v.action}]`),
    "",
    m.nextTitle,
    ...nextSteps(result.designSystem, errors, lang).map((step) => `- ${step}`),
    "",
  ];
  return { stderr: lines.join("\n"), exitCode: 2 };
}

async function checkHead({ cwd, config, files, lang }) {
  let temp;
  const paths = [];
  try {
    for (const file of files) {
      const gitPath = file.split(path.sep).join("/");
      // HEAD 나 파일이 없으면 기준선에 위반이 없다.
      const source = gitOutput(cwd, ["show", `HEAD:./${gitPath}`], { maxBuffer: Infinity });
      if (source === undefined) continue;

      temp ??= fs.mkdtempSync(path.join(os.tmpdir(), "designsnitch-head-"));
      const target = path.join(temp, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, source);
      paths.push(file);
    }
    if (paths.length === 0) return [];

    const baselineConfig = { ...config, tokens: path.resolve(cwd, config.tokens) };
    if (config.components) {
      baselineConfig.components = { ...config.components, path: path.resolve(cwd, config.components.path) };
    }
    const result = await check({ cwd: temp, config: baselineConfig, paths, lang });
    return result.violations;
  } finally {
    if (temp) fs.rmSync(temp, { recursive: true, force: true });
  }
}

function violationKey({ file, rule, found }) {
  return JSON.stringify([file, rule, found]);
}

function countViolations(violations) {
  const counts = new Map();
  for (const violation of violations) {
    const key = violationKey(violation);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function parse(input) {
  try {
    const value = JSON.parse(input);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function isInside(cwd, file) {
  const relative = path.relative(cwd, file);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function gitOutput(cwd, args, options) {
  try {
    return execFileSync("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      ...options,
    });
  } catch {
    return undefined;
  }
}

/** git 작업 폴더에서 바뀌었거나 새로 생긴 파일. git 저장소가 아니면 빈 배열. */
function changedFiles(cwd) {
  const output = gitOutput(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { encoding: "utf8" });
  if (!output) return [];
  const files = [];
  const entries = output.split("\0").filter(Boolean);
  for (let i = 0; i < entries.length; i += 1) {
    const status = entries[i].slice(0, 2);
    const file = entries[i].slice(3);
    // 이름이 바뀐 항목은 바로 다음에 예전 경로가 따라온다.
    if (status[0] === "R" || status[0] === "C") i += 1;
    if (!status.includes("D")) files.push(file);
  }
  return files;
}
