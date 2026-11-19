import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_FILE } from "./config.js";
import { messages } from "./messages.js";

const SKILLS_DIR = fileURLToPath(new URL("../skills", import.meta.url));
const SETTINGS_FILE = ".claude/settings.json";
const HOOK_COMMAND = "npx designsnitch hook";
// 파일을 고친 직후와 작업을 끝내려 할 때 훅을 실행한다.
const HOOK_ENTRIES = {
  PostToolUse: { matcher: "Edit|Write|MultiEdit", hooks: [{ type: "command", command: HOOK_COMMAND }] },
  Stop: { hooks: [{ type: "command", command: HOOK_COMMAND }] },
};

/**
 * 프로젝트에 스킬과 에이전트 훅을 설치한다. Claude Code 의 위치(.claude)에 맞춘다.
 * 여러 번 실행해도 된다. 스킬은 최신으로 덮어쓰고, 훅은 없을 때만 더한다.
 * @param {{ cwd: string, lang?: "en" | "ko" }} options
 * @returns {{ stdout: string, exitCode: 0 }}
 * @throws {Error} .claude/settings.json 을 읽을 수 없을 때. 이때는 아무것도 바꾸지 않는다
 */
export function install({ cwd, lang }) {
  const m = messages(lang);
  const settingsPath = path.join(cwd, SETTINGS_FILE);
  // 설정 파일이 깨져 있으면 아무것도 건드리기 전에 멈춘다.
  const settings = readSettings(settingsPath, m);

  const skills = fs.readdirSync(SKILLS_DIR).filter((name) => !name.startsWith("."));
  for (const skill of skills) {
    fs.cpSync(path.join(SKILLS_DIR, skill), path.join(cwd, ".claude/skills", skill), { recursive: true });
  }

  const added = addHooks(settings);
  if (added) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  }

  const steps = [];
  if (!isInstalled(cwd)) steps.push(m.installPackage());
  if (!fs.existsSync(path.join(cwd, CONFIG_FILE))) steps.push(m.askAgent({ configFile: CONFIG_FILE }));

  const lines = [
    m.skillsCopied(skills.length),
    added ? m.hookRegistered({ file: SETTINGS_FILE }) : m.hookAlready({ file: SETTINGS_FILE }),
    ...(steps.length > 0 ? ["", m.nextTitle, ...steps.map((step) => `- ${step}`)] : []),
    "",
  ];
  return { stdout: lines.join("\n"), exitCode: 0 };
}

function readSettings(file, m) {
  if (!fs.existsSync(file)) return {};
  try {
    const settings = JSON.parse(fs.readFileSync(file, "utf8"));
    if (settings && typeof settings === "object" && !Array.isArray(settings)) return settings;
  } catch {
    // 아래에서 같은 오류로 알린다.
  }
  throw new Error(m.settingsUnreadable({ file }));
}

/** 훅이 없는 이벤트에만 더한다. 하나라도 더했으면 true. */
function addHooks(settings) {
  settings.hooks ??= {};
  let added = false;
  for (const [event, entry] of Object.entries(HOOK_ENTRIES)) {
    const entries = (settings.hooks[event] ??= []);
    const registered = entries.some((existing) =>
      existing.hooks?.some((hook) => hook.command?.includes("designsnitch hook")),
    );
    if (!registered) {
      entries.push(structuredClone(entry));
      added = true;
    }
  }
  return added;
}

function isInstalled(cwd) {
  if (fs.existsSync(path.join(cwd, "node_modules/designsnitch"))) return true;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
    return Boolean(pkg.dependencies?.designsnitch ?? pkg.devDependencies?.designsnitch);
  } catch {
    return false;
  }
}
