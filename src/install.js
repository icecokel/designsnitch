import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_FILE } from "./config.js";
import { messages } from "./messages.js";

const SKILLS_DIR = fileURLToPath(new URL("../skills", import.meta.url));
const HOOK_COMMAND = "npx designsnitch hook";

/**
 * 에이전트마다 스킬을 읽는 곳, 훅을 등록하는 파일, 이벤트 이름이 다르다.
 * 훅이 하는 일(표준 입력의 JSON 을 읽고, 막을 때 종료 코드 2와 stderr)은 같다.
 * editEvent 는 파일을 고친 직후, stopEvent 는 작업을 끝내려 할 때다.
 * startEvent 는 세션이 시작될 때다. 그때 이미 있던 위반을 적어 두어, 이번 작업이 만든 위반만 막는다.
 * 문서에서 이 이벤트를 확인하지 못한 에이전트에는 등록하지 않는다. 없어도 첫 수정 때 대신 적는다.
 */
const AGENTS = {
  claude: {
    skillsDir: ".claude/skills",
    hooksFile: ".claude/settings.json",
    editEvent: "PostToolUse",
    stopEvent: "Stop",
    startEvent: "SessionStart",
    editTools: "Edit|Write|MultiEdit",
    hook: { type: "command", command: HOOK_COMMAND },
    approval: null,
    // 색 수집은 읽기만 하고, 검사는 --fix 를 줄 때만 화면이 같은 교체를 한다. 허용해 두지 않으면 에이전트가 스킬대로 실행하려다 승인을 기다리며 멈춘다.
    allow: ["Bash(npx designsnitch check *)", "Bash(npx designsnitch colors *)", "Bash(npx designsnitch sizes *)"],
  },
  codex: {
    skillsDir: ".agents/skills",
    hooksFile: ".codex/hooks.json",
    editEvent: "PostToolUse",
    stopEvent: "Stop",
    startEvent: "SessionStart",
    // Codex 는 셸 명령으로도 파일을 고친다. 그런 수정은 Stop 훅이 git 에서 바뀐 파일을 보고 잡는다.
    editTools: "apply_patch",
    hook: { type: "command", command: HOOK_COMMAND, timeout: 60 },
    // 신뢰한 프로젝트에서, 사용자가 승인한 훅만 실행한다.
    approval: "codexTrust",
  },
  // geminicli.com 의 공식 문서 기준. timeout 은 밀리초다.
  gemini: {
    skillsDir: ".agents/skills",
    hooksFile: ".gemini/settings.json",
    editEvent: "AfterTool",
    stopEvent: "AfterAgent",
    startEvent: "SessionStart",
    editTools: "write_file|replace",
    hook: { name: "designsnitch", type: "command", command: HOOK_COMMAND, timeout: 60000 },
    // 새 프로젝트 훅은 실행하기 전에 경고하고 허용을 받는다.
    approval: "geminiTrust",
  },
  // docs.x.ai 의 공식 문서 기준. 훅은 .grok/hooks/*.json 어느 파일에 둬도 된다. timeout 은 초다.
  // Claude Code 의 도구 이름(Edit, Write)은 Grok 의 도구로 자동으로 연결된다고 문서에 적혀 있다.
  grok: {
    skillsDir: ".grok/skills",
    hooksFile: ".grok/hooks/designsnitch.json",
    editEvent: "PostToolUse",
    stopEvent: "Stop",
    editTools: "Edit|Write|MultiEdit",
    hook: { type: "command", command: HOOK_COMMAND, timeout: 60 },
    // 신뢰한 프로젝트의 훅만 실행한다(/hooks-trust 또는 --trust).
    approval: "grokTrust",
  },
};

export const AGENT_CHOICES = [...Object.keys(AGENTS), "all"];

/**
 * 프로젝트에 스킬과 에이전트 훅을 설치한다.
 * 여러 번 실행해도 된다. 스킬은 최신으로 덮어쓰고, 훅은 없을 때만 더한다.
 * @param {{ cwd: string, lang?: "en" | "ko", agent?: "claude" | "codex" | "gemini" | "grok" | "all" }} options
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

  const copiedTo = new Set();
  for (const target of targets) {
    // Codex 와 Gemini CLI 는 같은 .agents/skills 를 읽는다. 한 번만 복사한다.
    if (!copiedTo.has(target.skillsDir)) {
      copiedTo.add(target.skillsDir);
      for (const skill of skills) {
        fs.cpSync(path.join(SKILLS_DIR, skill), path.join(cwd, target.skillsDir, skill), { recursive: true });
      }
      lines.push(m.skillsCopied({ n: skills.length, dir: target.skillsDir }));
    }

    const file = path.join(cwd, target.hooksFile);
    const added = addHooks(settings.get(target), target);
    const allowed = target.allow ? addPermissions(settings.get(target), target.allow) : false;
    if (added || allowed) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(settings.get(target), null, 2)}\n`);
    }

    lines.push(added ? m.hookRegistered({ file: target.hooksFile }) : m.hookAlready({ file: target.hooksFile }));
    if (allowed) lines.push(m.commandsAllowed({ file: target.hooksFile }));
    if (added && target.approval) steps.push(m[target.approval]());
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

/**
 * 검사 명령을 권한 허용 목록에 더한다. 이미 있거나 더 넓게 허용돼 있으면 그대로 둔다. 더했으면 true.
 * @param {Record<string, any>} settings
 * @param {string[]} rules
 */
function addPermissions(settings, rules) {
  const existing = settings.permissions?.allow;
  const current = Array.isArray(existing) ? existing : [];
  // 예: Bash(npx designsnitch *), Bash(npx designsnitch:*), Bash(npx *)
  const covered = current.some((rule) => /^Bash\(npx(?: designsnitch)?\s*[:\s]?\*\)$/.test(rule));
  const missing = covered ? [] : rules.filter((rule) => !current.includes(rule));
  if (missing.length === 0) return false;
  settings.permissions = { ...settings.permissions, allow: [...current, ...missing] };
  return true;
}

/** 훅이 없는 이벤트에만 더한다. 하나라도 더했으면 true. */
function addHooks(settings, target) {
  const entries = {
    [target.editEvent]: { matcher: target.editTools, hooks: [target.hook] },
    [target.stopEvent]: { hooks: [target.hook] },
    ...(target.startEvent ? { [target.startEvent]: { hooks: [target.hook] } } : {}),
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
