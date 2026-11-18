#!/usr/bin/env node
import { run } from "../src/cli.js";

// 출력을 받는 쪽이 먼저 닫으면(예: `designsnitch check | head`) 조용히 끝낸다.
process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit();
  throw error;
});

process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
});
