import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import postcss from "postcss";
import { invalidTokenField, tokenSettings } from "../config.js";
import { parseColorTokenData, parsePaletteColors } from "../core/tokens.js";
import { parseSizeTokens } from "../core/size.js";
import { messages, resolveLang } from "../messages.js";
import { flattenColors, loadConfigColors } from "./tailwind-config.js";

/**
 * @typedef {object} Tokens
 * @property {Map<string, string[]>} colors 색 값 → 토큰 이름들
 * @property {Set<string>} themed 테마마다 값이 다른 토큰 이름들
 * @property {string[]} prefer 먼저 적용할 토큰 접두어
 * @property {Set<string>} paletteNames 기본 팔레트에서 온 토큰 이름들. palette 설정이 없으면 비어 있다
 * @property {Set<string>} files 토큰을 읽은 파일들의 절대 경로. 토큰 CSS, 그것이 @import 한 CSS, Tailwind JavaScript 설정
 * @property {string | null} prefix Tailwind 접두어. @import "tailwindcss" prefix(tw) 의 tw
 * @property {Set<string>} classOnly 클래스로만 쓸 수 있는 토큰 이름들. JavaScript 설정의 색에는 CSS 변수가 없다
 * @property {string[]} problems 토큰을 다 읽지 못하게 만든 문제. 예: 불러오지 못한 JavaScript 설정
 * @property {Map<string, string[]>} themePaths Tailwind v3 에서 CSS 변수가 없는 토큰의 설정 키 경로.
 *   v3 의 CSS 에서는 theme("colors.brand.500") 으로 그 값을 쓸 수 있다. v3 가 아니면 비어 있다
 */

/**
 * 이 파일이 토큰을 정의하는 JavaScript 설정인지. 그 안의 색은 토큰의 값이지 직접 쓴 색이 아니다.
 * @param {Tokens} tokens
 * @param {string} filename 절대 경로
 */
export function definesTokens(tokens, filename) {
  if (tokens.files.has(filename)) return true;
  try {
    return tokens.files.has(fs.realpathSync(filename));
  } catch {
    return false;
  }
}

/** @typedef {ReturnType<typeof parseColorTokenData> & Pick<Tokens, "files" | "prefix" | "classOnly" | "problems" | "themePaths"> & { tailwindV3: boolean }} ProjectTokens */

/** @type {Map<string, { deps: [string, number][], tokens: ProjectTokens }>} */
const cache = new Map();
/** @type {Map<string, { mtimeMs: number, result: { palette: Map<string, string>, classOnly: boolean, paths: Map<string, string[]> } }>} */
const paletteCache = new Map();

/**
 * settings.designsnitch.tokens 에 적힌 CSS를 읽어 토큰을 돌려준다.
 * 파일이 바뀌지 않았으면 다시 읽지 않는다.
 * @returns {Tokens}
 */
export function loadTokens(settings, cwd) {
  const m = messages(resolveLang(settings?.designsnitch?.lang));
  const tokens = settings?.designsnitch?.tokens;
  const invalidField = invalidTokenField(tokens);
  if (invalidField === "tokens") throw new Error(m.tokensSettingMissing());
  if (invalidField) throw new Error(m.invalidTokenSetting({ field: invalidField }));

  const { file: tokensPath, exclude = [], prefer = [] } = tokenSettings(tokens);
  const root = path.resolve(cwd, settings?.designsnitch?.root ?? ".");
  const file = path.resolve(root, tokensPath);
  const project = readProjectTokens(file, root, exclude, m);
  const { files, prefix, classOnly, problems, themePaths, sizes } = project;
  const shared = { prefer, files, prefix, classOnly, problems, themePaths, sizes };
  if (settings?.designsnitch?.palette !== "tailwind") {
    return { colors: project.colors, themed: project.themed, paletteNames: new Set(), ...shared };
  }
  return { ...shared, ...withPalette(project, readTailwindPalette(file, m), exclude) };
}

/** @returns {ProjectTokens} */
function readProjectTokens(file, root, exclude, m) {
  const key = JSON.stringify([file, exclude]);
  const cached = cache.get(key);
  if (cached && cached.deps.every(([dep, mtimeMs]) => mtimeOf(dep) === mtimeMs)) return cached.tokens;

  // tokens 에 tailwind.config.js 같은 JavaScript 설정을 직접 적은 경우. Tailwind v3 프로젝트가 그렇다.
  const isConfig = JS_FILE.test(file);
  const sources = [];
  const configFiles = isConfig ? [file] : [];
  let prefix = null;
  let usesV3Directives = false;
  let current = file;
  try {
    if (isConfig && !fs.existsSync(file)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    // 토큰 CSS 가 @import 한 CSS 도 토큰을 정의할 수 있다. 예: @import "../brand/theme.css"
    const visit = (cssFile) => {
      if (sources.some(([seen]) => seen === cssFile)) return;
      current = cssFile;
      const css = fs.readFileSync(cssFile, "utf8");
      const entry = [cssFile, css];
      sources.push(entry);
      const sheet = postcss.parse(css, { from: cssFile });
      sheet.walkAtRules("tailwind", () => {
        usesV3Directives = true;
      });
      sheet.walkAtRules("config", (rule) => {
        const spec = /^["']([^"']+)["']/.exec(rule.params)?.[1];
        if (spec) configFiles.push(path.resolve(path.dirname(cssFile), spec));
      });
      sheet.walkAtRules("import", (rule) => {
        const spec = /^(?:url\(\s*)?["']([^"']+)["']/.exec(rule.params)?.[1];
        if (!spec) return;
        if (spec === "tailwindcss") {
          prefix = /\bprefix\(\s*([\w-]+)\s*\)/.exec(rule.params)?.[1] ?? prefix;
          return;
        }
        // Tailwind 자신의 CSS 는 palette 설정이 맡는다.
        if (spec.startsWith("tailwindcss/") || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(spec)) return;
        const imported = resolveImport(cssFile, spec);
        if (imported) visit(imported);
      });
      current = cssFile;
    };
    if (!isConfig) visit(file);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      throw new Error(m.tokensFileMissing({ file: current }));
    }
    // 기준이 되는 파일이 깨져 있으면 무엇도 판정할 수 없다. 어디가 깨졌는지 알려준다.
    throw new Error(
      m.tokensUnreadable({
        file: current,
        line: error.line ?? 1,
        column: error.column ?? 1,
        reason: error.reason ?? error.message,
      }),
    );
  }

  // Tailwind v3 는 @config 없이 프로젝트 루트의 tailwind.config 를 읽는다. @tailwind 지시어가 v3 의 표시다.
  if (usesV3Directives && configFiles.length === 0) {
    const found = V3_CONFIG_NAMES.map((name) => path.join(root, name)).find((candidate) => fs.existsSync(candidate));
    if (found) configFiles.push(found);
  }

  // import 된 파일의 선언이 먼저 오도록 뒤집어 합친다. 순서는 결과에 영향을 주지 않지만 읽기 쉽다.
  const allCss = sources.map(([, css]) => css).reverse().join("\n");
  const parsed = parseColorTokenData(allCss, exclude);
  const { classOnly, problems, paths } = addConfigColors(parsed, configFiles, exclude, m);
  // theme() 은 Tailwind v3 의 CSS 에서 쓰는 방법이다. v4 에서는 권하지 않는 함수라 후보로 내지 않는다.
  const tailwindV3 = usesV3Directives || isConfig;
  const themePaths = tailwindV3 ? paths : new Map();
  // 기준으로 적은 설정을 못 읽으면 판정할 것이 없다. @config 로 딸려 온 설정이면 알리기만 하고 계속한다.
  if (isConfig && problems.length > 0) throw new Error(problems[0]);
  // 링크된 경로로 들어와도 같은 파일로 알아보도록 실제 경로로 적어 둔다.
  const deps = [...sources.map(([cssFile]) => cssFile), ...configFiles];
  const files = new Set(deps.filter((dep) => fs.existsSync(dep)).map((dep) => fs.realpathSync(dep)));
  // 크기 토큰은 Tailwind v4 의 @theme 에서만 읽는다.
  const sizes = parseSizeTokens(tailwindV3 ? "" : allCss);
  const tokens = { ...parsed, files, prefix, classOnly, problems, themePaths, tailwindV3, sizes };
  cache.set(key, { deps: deps.map((dep) => [dep, mtimeOf(dep)]), tokens });
  return tokens;
}

const JS_FILE = /\.[cm]?[jt]s$/;
const V3_CONFIG_NAMES = ["tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs", "tailwind.config.ts"];

/**
 * @config 로 불러온 JavaScript 설정의 색을 CSS 에서 읽은 토큰에 더한다. 같은 이름이면 CSS 가 이긴다.
 * @param {ReturnType<typeof parseColorTokenData>} parsed 여기에 더한다
 */
function addConfigColors(parsed, configFiles, exclude, m) {
  const classOnly = new Set();
  const problems = [];
  const paths = new Map();
  const excluded = (name) => exclude.some((p) => (p.endsWith("*") ? name.startsWith(p.slice(0, -1)) : name === p));
  for (const file of configFiles) {
    let config;
    try {
      config = loadConfigColors(file);
    } catch (error) {
      problems.push(m.tailwindConfigFailed({ file, reason: error.message.split("\n")[0] }));
      continue;
    }
    if (config.replacesPalette) parsed.resets.push("--color-*");
    for (const [name, color] of config.colors) {
      if (parsed.names.has(name) || excluded(name)) continue;
      parsed.names.add(name);
      classOnly.add(name);
      paths.set(name, config.paths.get(name));
      parsed.colors.set(color, [...(parsed.colors.get(color) ?? []), name]);
    }
  }
  return { classOnly, problems, paths };
}

function mtimeOf(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return -1;
  }
}

/** @import 의 경로를 파일로 푼다. CSS 처럼 상대 경로를 먼저 보고, 없으면 패키지에서 찾는다. 못 찾으면 null. */
function resolveImport(fromFile, spec) {
  const relative = path.resolve(path.dirname(fromFile), spec);
  if (fs.existsSync(relative) && fs.statSync(relative).isFile()) return relative;
  if (spec.startsWith(".") || spec.startsWith("/")) return null;
  try {
    return createRequire(fromFile).resolve(spec);
  } catch {
    return null;
  }
}

/**
 * 프로젝트에 설치된 tailwindcss 의 theme.css 에서 기본 팔레트를 읽는다.
 * 토큰 CSS 가 tailwindcss 를 불러오는 파일이므로, 그 위치에서 찾는다.
 */
function readTailwindPalette(tokensFile, m) {
  const require = createRequire(tokensFile);
  let file;
  let classOnly = false;
  try {
    file = require.resolve("tailwindcss/theme.css");
  } catch {
    // v3 에는 theme.css 가 없다. 팔레트는 tailwindcss/colors 에 있고, CSS 변수가 없어 클래스로만 쓴다.
    try {
      file = require.resolve("tailwindcss/colors");
      classOnly = true;
    } catch {
      throw new Error(m.paletteMissing({ root: path.dirname(tokensFile) }));
    }
  }
  const { mtimeMs } = fs.statSync(file);
  const cached = paletteCache.get(file);
  if (cached?.mtimeMs === mtimeMs) return cached.result;
  let palette;
  const paths = new Map();
  if (classOnly) {
    const module = require(file);
    palette = flattenColors(module.default ?? module, new Map(), paths);
  } else {
    palette = parsePaletteColors(fs.readFileSync(file, "utf8"));
  }
  const result = { palette, classOnly, paths };
  paletteCache.set(file, { mtimeMs, result });
  return result;
}

/**
 * 프로젝트 토큰 뒤에 팔레트 색을 더한다. 다음 색은 뺀다.
 * - 프로젝트가 같은 이름을 다시 정의한 색 (값을 읽지 못했어도 기본값은 더 이상 쓰이지 않는다)
 * - 프로젝트가 --color-*: initial, --*: initial 같은 선언으로 비운 네임스페이스의 색
 * - exclude 에 걸린 색
 * @param {ProjectTokens} project
 * @param {{ palette: Map<string, string>, classOnly: boolean, paths: Map<string, string[]> }} tailwind
 *   classOnly 면 팔레트 색에 CSS 변수가 없다 (v3). 그때 paths 에 theme() 으로 가리킬 키 경로가 있다
 * @param {string[]} exclude
 */
function withPalette(project, { palette, classOnly: paletteIsClassOnly, paths }, exclude) {
  const matches = (name, pattern) => (pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern);
  const excluded = (name) => [...exclude, ...project.resets].some((pattern) => matches(name, pattern));
  const colors = new Map([...project.colors].map(([hex, names]) => [hex, [...names]]));
  const paletteNames = new Set();
  for (const [name, hex] of palette) {
    if (project.names.has(name) || excluded(name)) continue;
    paletteNames.add(name);
    colors.set(hex, [...(colors.get(hex) ?? []), name]);
  }
  if (!paletteIsClassOnly) return { colors, themed: project.themed, paletteNames, classOnly: project.classOnly };
  const classOnly = new Set([...project.classOnly, ...paletteNames]);
  const themePaths = new Map(project.themePaths);
  for (const name of paletteNames) themePaths.set(name, paths.get(name));
  return { colors, themed: project.themed, paletteNames, classOnly, themePaths };
}
