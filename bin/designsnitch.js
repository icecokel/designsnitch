#!/usr/bin/env node

const MINIMUM_NODE_MAJOR = 22;

/** @param {string} version process.versions.node 와 같은 형식의 버전 */
export function isSupportedNodeVersion(version) {
  return Number(version.split(".", 1)[0]) >= MINIMUM_NODE_MAJOR;
}

const version = process.versions.node;
const supported = isSupportedNodeVersion(version);
if (await isEntrypoint()) await main();

async function isEntrypoint() {
  const entry = process.argv[1];
  if (!entry) return false;
  // 설치된 실행 파일은 심볼릭 링크일 수 있다.
  const { existsSync, realpathSync } = await import("node:fs");
  return existsSync(entry) && realpathSync(entry) === realpathSync(new URL(import.meta.url));
}

async function main() {
  const argv = process.argv.slice(2);
  if (!supported) {
    let flagLang;
    for (const [index, arg] of argv.entries()) {
      if (arg === "--") break;
      if (arg === "--lang") flagLang = argv[index + 1];
      else if (arg.startsWith("--lang=")) flagLang = arg.slice("--lang=".length);
    }
    const { messages, resolveLang } = await import("../src/messages.js");
    const message = messages(resolveLang(flagLang)).nodeVersionUnsupported;
    process.stderr.write(`${message({ minimum: MINIMUM_NODE_MAJOR, version })}\n`);
    process.exitCode = 2;
    return;
  }

  // 출력을 받는 쪽이 먼저 닫으면(예: `designsnitch check | head`) 조용히 끝낸다.
  process.stdout.on("error", (error) => {
    if (error.code === "EPIPE") process.exit();
    throw error;
  });

  const { run } = await import("../src/cli.js");
  process.exitCode = await run(argv, {
    cwd: process.cwd(),
    // hook 명령은 에이전트가 표준 입력으로 주는 JSON 을 읽는다.
    stdin: argv[0] === "hook" && !process.stdin.isTTY ? await readStdin() : undefined,
    stdout: process.stdout,
    stderr: process.stderr,
  });
}

// 입력이 끝나지 않는 환경에서도 멈추지 않도록 잠깐만 기다린다.
function readStdin(timeoutMs = 2000) {
  return new Promise((resolve) => {
    let data = "";
    const done = () => {
      process.stdin.pause();
      resolve(data);
    };
    const timer = setTimeout(done, timeoutMs);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => {
      clearTimeout(timer);
      done();
    });
    process.stdin.on("error", () => {
      clearTimeout(timer);
      done();
    });
  });
}
