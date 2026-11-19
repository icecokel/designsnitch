import fs from "node:fs";
import path from "node:path";

/** 검사하지 않는 디렉터리 이름. JS 와 CSS 에 똑같이 적용한다. */
export const IGNORED_DIRS = ["node_modules", ".git", ".next", "dist", "build", "out", "coverage"];

/**
 * 검사할 경로를 스크립트용(ESLint 에 넘길 것)과 CSS 파일 목록으로 나눈다.
 * 디렉터리는 양쪽 모두에 해당하고, .css 파일은 CSS 쪽에만 해당한다.
 * @param {string} cwd
 * @param {string[]} paths cwd 기준 경로
 * @returns {{ scriptPaths: string[], cssFiles: string[] }} cssFiles 는 cwd 기준의 슬래시 경로, 이름순
 */
export function splitPaths(cwd, paths) {
  const scriptPaths = [];
  const cssFiles = new Set();

  for (const given of paths) {
    const absolute = path.resolve(cwd, given);
    const stat = fs.statSync(absolute, { throwIfNoEntry: false });
    if (stat?.isDirectory()) {
      scriptPaths.push(given);
      for (const file of walkCss(absolute)) cssFiles.add(toRelative(cwd, file));
    } else if (absolute.endsWith(".css")) {
      if (stat) cssFiles.add(toRelative(cwd, absolute));
    } else {
      scriptPaths.push(given);
    }
  }
  return { scriptPaths, cssFiles: [...cssFiles].sort((a, b) => a.localeCompare(b)) };
}

function* walkCss(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.includes(entry.name)) yield* walkCss(full);
    } else if (entry.name.endsWith(".css")) {
      yield full;
    }
  }
}

function toRelative(cwd, file) {
  return path.relative(cwd, file).split(path.sep).join("/");
}
