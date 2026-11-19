#!/usr/bin/env node
import { run } from "../src/cli.js";

// 출력을 받는 쪽이 먼저 닫으면(예: `designsnitch check | head`) 조용히 끝낸다.
process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit();
  throw error;
});

const argv = process.argv.slice(2);

process.exitCode = await run(argv, {
  cwd: process.cwd(),
  // hook 명령은 에이전트가 표준 입력으로 주는 JSON 을 읽는다.
  stdin: argv[0] === "hook" && !process.stdin.isTTY ? await readStdin() : undefined,
  stdout: process.stdout,
  stderr: process.stderr,
});

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
