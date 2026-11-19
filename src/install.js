import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_FILE } from "./config.js";
import { messages } from "./messages.js";

const SKILLS_DIR = fileURLToPath(new URL("../skills", import.meta.url));
const HOOK_COMMAND = "npx designsnitch hook";

/**
 * 에이전트마다 스킬을 읽는 곳과 훅을 등록하는 파일이 다르다. 훅의 형식은 같다.
 * 훅은 파일을 고친 직후와 작업을 끝내려 할 때 실행한다.
 */
const AGENTS = {
  claude: {
    skillsDir: ".claude/skills",
    hooksFile: ".claude/settings.json",
    editTools: "Edit|Write|MultiEdit",
    hook: { type: "command", command: HOOK_COMMAND },
    needsApproval: false,
  },
  codex: {
    skillsDir: ".agents/skills",
    hooksFile: ".codex/hooks.json",
    // Codex 는 셸 명령으로도 파일을 고친다. 그런 수정은 Stop 훅이 git 에서 바뀐 파일을 보고 잡는다.
    editTools: "apply_patch",
    hook: { type: "command", command: HOOK_COMMAND, timeout: 60 },
    // Codex 는 신뢰한 프로젝트에서, 사용자가 승인한 훅만 실행한다.
    needsApproval: true,
  },
};

export const AGENT_CHOICES = [...Object.keys(AGENTS), "all"];

/**
 * 프로젝트에 스킬과 에이전트 훅을 설치한다.
 * 여러 번 실행해도 된다. 스킬은 최신으로 덮어쓰고, 훅은 없을 때만 더한다.
 * @param {{ cwd: string, lang?: "en" | "ko", agent?: "claude" | "codex" | "all" }} options
 * @returns {{ stdout: string, exitCode: 0 }}
 * @throws {Error} 훅을 등록할 파일을 읽을 수 없을 때. 이때는 아무것도 바꾸지 않는다
 */
export function install({ cwd, lang, agent = "claude" }) {
  const m = messages(lang);
  const targets = (agent === "all" ? Object.keys(AGENTS) : [agent]).map((name) => AGENTS[name]);

  // 훅 파일이 깨져 있으면 아무것도 건드리기 전에 멈춘다.
  const settings = new Map(
    targets.map((target) => [target, readJson(path.join(cwd, target.hooksFile), m)]),
  );

  const skills = fs.readdirSync(SKILLS_DIR).filter((name) => !name.startsWith("."));
  const lines = [];
  const steps = [];

  for (const target of targets) {
    for (const skill of skills) {
      fs.cpSync(path.join(SKILLS_DIR, skill), path.join(cwd, target.skillsDir, skill), { recursive: true });
    }

    const file = path.join(cwd, target.hooksFile);
    const added = addHooks(settings.get(target), target);
    if (added) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(settings.get(target), null, 2)}\n`);
    }

    lines.push(
      m.skillsCopied({ n: skills.length, dir: target.skillsDir }),
      added ? m.hookRegistered({ file: target.hooksFile }) : m.hookAlready({ file: target.hooksFile }),
    );
    if (added && target.needsApproval) steps.push(m.codexTrust());
  }

  if (!isInstalled(cwd)) steps.push(m.installPackage());
  if (!fs.existsSync(path.join(cwd, CONFIG_FILE))) steps.push(m.askAgent({ configFile: CONFIG_FILE }));

  if (steps.length > 0) lines.push("", m.nextTitle, ...steps.map((step) => `- ${step}`));
  lines.push("");
  return { stdout: lines.join("\n"), exitCode: 0 };
}

function readJson(file, m) {
  if (!fs.existsSync(file)) return {};
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  } catch {
    // 아래에서 같은 오류로 알린다.
  }
  throw new Error(m.settingsUnreadable({ file }));
}

/** 훅이 없는 이벤트에만 더한다. 하나라도 더했으면 true. */
function addHooks(settings, target) {
  const entries = {
    PostToolUse: { matcher: target.editTools, hooks: [target.hook] },
    Stop: { hooks: [target.hook] },
  };
  settings.hooks ??= {};
  let added = false;
  for (const [event, entry] of Object.entries(entries)) {
    const existing = (settings.hooks[event] ??= []);
    const registered = existing.some((item) =>
      item.hooks?.some((hook) => hook.command?.includes("designsnitch hook")),
    );
    if (!registered) {
      existing.push(structuredClone(entry));
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
