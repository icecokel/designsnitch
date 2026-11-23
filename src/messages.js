/**
 * 사람과 에이전트가 읽는 문장을 한곳에 모은다. 영어가 기본이고 한국어를 고를 수 있다.
 * 규칙 이름, JSON 필드 이름, 출력의 구조는 언어와 무관하다.
 */

export const LANGS = ["en", "ko"];

/** @returns {lang is "en" | "ko"} */
export const isLang = (lang) => LANGS.includes(lang);

/**
 * 쓸 언어를 정한다. 앞의 것이 우선한다: 직접 준 값, 환경 변수 DESIGNSNITCH_LANG, 영어.
 * @param {...unknown} candidates 우선순위 순서의 후보. 알 수 없는 값은 건너뛴다
 * @returns {"en" | "ko"}
 */
export function resolveLang(...candidates) {
  return [...candidates, process.env.DESIGNSNITCH_LANG, "en"].find(isLang);
}

/** @param {"en" | "ko"} [lang] */
export function messages(lang) {
  return resolveLang(lang) === "ko" ? ko : en;
}

const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// "1 needs", "2 need"
const needs = (n) => (n === 1 ? "needs" : "need");

const en = {
  // 규칙
  useToken: ({ found, tokens, candidates }) =>
    `${found} has the same color as ${tokens}. Use instead: ${candidates}`,
  useTokenThemed: ({ found, tokens, candidates }) =>
    `${found} has the same color as ${tokens}. Candidates: ${candidates}. ` +
    "A candidate token has different values across themes. Using it can change the color in another theme.",
  useTokenAlpha: ({ found, tokens, opacity, candidates }) =>
    `${found} is ${tokens} at ${opacity}% opacity. Use instead: ${candidates}`,
  useTokenData: ({ found, tokens, candidates }) =>
    `${found} has the same color as ${tokens}. It is not in a style, so check that var() works where this value is used. Candidate: ${candidates}`,
  useTokenClassOnly: ({ found, tokens }) =>
    `${found} has the same color as ${tokens}, but Tailwind makes no CSS variable for that token, so there is no var() to use here.`,
  unknownColor: ({ found }) => `The color of ${found} is not in the tokens.`,
  unknownCssColor: ({ value }) => `The color ${value} is not in the tokens.`,
  useComponent: ({ tag, component, path }) =>
    `Use a design system component instead of <${tag}>: ${component} (${path})`,
  useComponentAsk: ({ tag, component, path, dynamicAttribute }) => {
    const reason = dynamicAttribute === undefined
      ? "The element has spread attributes."
      : `The "${dynamicAttribute}" attribute has a dynamic value.`;
    return `Check whether <${tag}> can be replaced with ${component} (${path}). ${reason}`;
  },
  replaceWith: ({ className }) => `Replace with ${className}`,

  // 실행하지 못했을 때
  nodeVersionUnsupported: ({ minimum, version }) =>
    `Node.js ${minimum} or later is required (current version: ${version}).`,
  tokensSettingMissing: () =>
    "designsnitch: set settings.designsnitch.tokens to the path of the token CSS file.",
  invalidTokenSetting: ({ field, file }) => {
    const details = {
      "tokens.file": "a non-empty token CSS file path",
      "tokens.exclude": "an array of non-empty token names or patterns with a trailing *",
      "tokens.prefer": "an array of non-empty token name prefixes without wildcards",
    };
    return `"${field}" must be ${details[field]}.${file ? ` (${file})` : ""}`;
  },
  tokensFileMissing: ({ file }) => `designsnitch: token CSS file not found: ${file}`,
  tokensUnreadable: ({ file, line, column, reason }) =>
    `designsnitch: could not read the token CSS: ${file}:${line}:${column} ${reason}`,
  componentsDirMissing: ({ dir }) => `Design system component directory not found: ${dir}`,
  configMissing: ({ file, example }) =>
    `Config file not found: ${file}\n` +
    `Create it with content like this. The designsnitch-setup skill can write it by reading the repository.\n${example}`,
  configUnreadable: ({ file, reason }) => `Could not read the config file: ${file}\n${reason}`,
  configNoTokens: ({ file }) =>
    `The config file has no "tokens" (the path of the token CSS file): ${file}`,
  configNoComponentsPath: ({ file }) =>
    `The config file has no "components.path" (the design system component directory): ${file}`,
  configNoReplaces: ({ file }) =>
    `The config file has no "components.replaces" (raw tags and the components that replace them): ${file}`,
  configBadReplace: ({ tag, file }) =>
    `"components.replaces.${tag}" in the config file must be a component name, an array of names, or an object with a "component" field: ${file}`,
  configBadReplaceComponent: ({ tag, file }) =>
    `"components.replaces.${tag}.component" in the config file must be a component name or a non-empty array of names: ${file}`,
  configBadWhen: ({ tag, file }) =>
    `"components.replaces.${tag}.when" in the config file must be an object mapping attributes to allowed values: ${file}`,
  configBadWhenValues: ({ tag, attribute, file }) =>
    `"components.replaces.${tag}.when.${attribute}" in the config file must be an array of strings or null values: ${file}`,
  configBadLang: ({ file }) => `"lang" in the config file must be "en" or "ko": ${file}`,
  configBadPalette: ({ file }) => `"palette" in the config file must be "tailwind": ${file}`,
  tailwindConfigFailed: ({ file, reason }) =>
    `Could not load the Tailwind config ${file}: ${reason}. Colors defined there are not known, so they are reported as "not in the tokens".`,
  paletteMissing: ({ root }) =>
    `The config sets "palette": "tailwind", but tailwindcss could not be found from ${root}. Install the project's dependencies, or remove "palette".`,
  settingsUnreadable: ({ file }) => `Could not read ${file}. Fix the JSON and run again.`,

  // check
  noColorTokens: ({ tokens }) =>
    `No color token could be read from ${tokens}. ` +
    "A --color-* variable is read when its value is a hex, rgb(), hsl() or oklch() color, or a var() that leads to one. " +
    'Until then every color written by hand is reported as "not in the tokens".',
  nextNoTokens: () =>
    "There are no color tokens, so there is nothing to judge colors against. Before fixing any color, collect the colors in use with `designsnitch colors` and decide the tokens.",
  nextRepair: (n) => `action "repair" (${n}): fix the syntax error in that file first.`,
  nextReplace: (n) => `action "replace" (${n}): replace found with the value in candidates.`,
  nextMigrate: (n) =>
    `action "migrate" (${n}): replace the tag with the component in candidates. Read that component first: add the import, pass on the props it accepts, and drop className values it already applies. If it cannot do what the tag did or would change how it looks, do not change the component to make it fit: leave the tag and ask the user.`,
  nextAsk: (n) =>
    `Before making changes, ask the user about the ${count(n, "entry", "entries")} in decisions. Include how often each comes up, the candidates, and the reasons for asking.`,
  hookNextAsk: (n) =>
    `action "ask" (${n}): do not change these. Ask the user, and include how often and for what each color is used, which \`designsnitch colors\` shows.`,
  nextRerun: () => "After fixing, run the same command again.",
  nextNone: () => "No violations.",

  // 사람용 출력
  designSystem: ({ colorTokens, paletteColors = 0, components }) =>
    `Design system: ${count(colorTokens, "color token")}` +
    (paletteColors > 0 ? ` and the Tailwind palette (${count(paletteColors, "color")})` : "") +
    ", " +
    (components > 0 ? count(components, "component") : "no components configured"),
  notice: (problem) => `Note: ${problem}`,
  severity: { error: "error", warning: "warning" },
  summary: ({ errors, warnings, files }) =>
    `${count(errors, "error")}, ${count(warnings, "warning")} (${count(files, "file")} checked)`,
  actions: ({ replace, migrate = 0, ask, repair, decisions }) =>
    [
      `${replace} can be replaced right away`,
      ...(migrate > 0 ? [`${migrate} to move to a component`] : []),
      `${ask} ${needs(ask)} a person's decision (${count(decisions, "decision")})`,
      ...(repair > 0 ? [`${repair} ${needs(repair)} a syntax fix`] : []),
    ].join(", "),
  noViolations: ({ files }) => `No violations. (${count(files, "file")} checked)`,
  unchecked: ({ colors, files }) =>
    `Not checked: ${count(colors, "color")} in other strings in ${count(files, "file")}, such as theme objects and chart options. \`designsnitch colors\` lists them.`,

  // colors
  colorsNone: ({ files }) => `No colors found in the code. (${count(files, "file")} checked)`,
  colorsSummary: ({ colors, paletteColors, uses, files }) =>
    `Colors used in the code: ${colors} hex, ${paletteColors} from the default palette (${count(uses, "use")}, ${count(files, "file")} checked)`,
  hexTitle: "Hex colors",
  paletteTitle: "Tailwind default palette",
  usage: ({ uses, files }) => `${count(uses, "use")}  ${count(files, "file")}`,
  literals: (n) => `string ${n}`,
  css: (n) => `CSS ${n}`,
  tokenNote: (tokens) => (tokens.length > 0 ? `token: ${tokens.join(", ")}` : "no token"),

  // hook
  hookHeader: (n) => `designsnitch: ${count(n, "design system error")} in the files you just changed.`,
  nextTitle: "What to do next",

  // install
  skillsCopied: ({ n, dir }) => `Copied ${count(n, "skill")} to ${dir}.`,
  hookRegistered: ({ file }) => `Registered the hook in ${file}.`,
  hookAlready: ({ file }) => `The hook is already registered in ${file}.`,
  codexTrust: () =>
    "Codex runs project hooks only in a trusted project, and only hooks you have approved. Open Codex in this project and approve the project and the hook when it asks.",
  geminiTrust: () =>
    "Gemini CLI warns before it runs a new project hook. Open Gemini CLI in this project and allow the hook. If you have turned on folder trust, trust this folder too.",
  grokTrust: () =>
    "Grok Build runs project hooks only in a trusted project. Open Grok Build in this project and trust it with /hooks-trust, or start it with --trust.",
  installPackage: () =>
    "Install the package in the project so the hook runs quickly every time: npm install --save-dev designsnitch",
  askAgent: ({ configFile }) =>
    `Ask your coding agent: "Set up designsnitch in this project." It finds the token CSS and the shared components, writes ${configFile}, and puts the rules into ESLint.`,

  cliUsage: `Usage: designsnitch <command> [paths...] [--format text|json] [--config file] [--lang en|ko]

Commands
  check     Checks that UI code follows the design system.
  colors    Lists the colors the code uses. Works without a config file.
  hook      Called from a coding agent's hook. Exits with 2 when a file just changed has errors.
  install   Installs the skills and the agent hook into the project.

Options
  paths       Files or directories to look at (default: the current directory)
  --format    Output format: text (default) or json
  --config    Path of the config file (default: designsnitch.config.json)
  --lang      Language of the messages: en (default) or ko
  --agent     For install, the agent to install for: --agent claude|codex|gemini|grok|all (default: claude)

Exit codes of check: 0 no errors, 1 errors found, 2 could not run
`,
};

const ko = {
  useToken: ({ found, tokens, candidates }) =>
    `${found}의 색은 토큰 ${tokens}의 값입니다. 대신 사용: ${candidates}`,
  useTokenThemed: ({ found, tokens, candidates }) =>
    `${found}의 색은 토큰 ${tokens}의 값입니다. 후보: ${candidates}. ` +
    "후보 중 테마마다 값이 다른 토큰이 있어 그 토큰으로 바꾸면 다른 테마에서 색이 바뀔 수 있습니다.",
  useTokenAlpha: ({ found, tokens, opacity, candidates }) =>
    `${found}의 색은 토큰 ${tokens}에 불투명도 ${opacity}%를 준 값입니다. 대신 사용: ${candidates}`,
  useTokenData: ({ found, tokens, candidates }) =>
    `${found}의 색은 토큰 ${tokens}의 값입니다. 스타일이 아닌 자리라서, 이 값을 쓰는 곳에서 var()가 통하는지 확인해야 합니다. 후보: ${candidates}`,
  useTokenClassOnly: ({ found, tokens }) =>
    `${found}의 색은 토큰 ${tokens}의 값이지만, Tailwind가 이 토큰의 CSS 변수를 만들지 않아서 여기에 쓸 var()가 없습니다.`,
  unknownColor: ({ found }) => `${found}의 색은 토큰에 없습니다.`,
  unknownCssColor: ({ value }) => `${value}의 색은 토큰에 없습니다.`,
  useComponent: ({ tag, component, path }) =>
    `<${tag}> 대신 디자인 시스템 컴포넌트를 사용하세요: ${component} (${path})`,
  useComponentAsk: ({ tag, component, path, dynamicAttribute }) => {
    const reason = dynamicAttribute === undefined
      ? "요소에 spread 속성이 있습니다."
      : `"${dynamicAttribute}" 속성 값이 동적입니다.`;
    return `<${tag}>를 ${component} (${path})로 바꿀 수 있는지 확인하세요. ${reason}`;
  },
  replaceWith: ({ className }) => `${className}(으)로 바꾸기`,

  nodeVersionUnsupported: ({ minimum, version }) =>
    `Node.js ${minimum} 이상이 필요합니다(현재 버전: ${version}).`,
  tokensSettingMissing: () =>
    "designsnitch: settings.designsnitch.tokens 에 토큰 CSS 파일 경로를 설정하세요.",
  invalidTokenSetting: ({ field, file }) => {
    const details = {
      "tokens.file": "비어 있지 않은 토큰 CSS 파일 경로를 입력하세요",
      "tokens.exclude": "비어 있지 않은 토큰 이름이나 끝에 *가 있는 패턴을 배열로 입력하세요",
      "tokens.prefer": "와일드카드가 없는 토큰 이름 접두어를 배열로 입력하세요",
    };
    return `"${field}"에 ${details[field]}.${file ? ` (${file})` : ""}`;
  },
  tokensFileMissing: ({ file }) => `designsnitch: 토큰 CSS 파일을 찾을 수 없습니다: ${file}`,
  tokensUnreadable: ({ file, line, column, reason }) =>
    `designsnitch: 토큰 CSS를 읽을 수 없습니다: ${file}:${line}:${column} ${reason}`,
  componentsDirMissing: ({ dir }) => `디자인 시스템 컴포넌트 경로를 찾을 수 없습니다: ${dir}`,
  configMissing: ({ file, example }) =>
    `설정 파일이 없습니다: ${file}\n` +
    `다음과 같은 내용으로 만드세요. designsnitch-setup 스킬을 따르면 저장소를 읽어서 만들 수 있습니다.\n${example}`,
  configUnreadable: ({ file, reason }) => `설정 파일을 읽을 수 없습니다: ${file}\n${reason}`,
  configNoTokens: ({ file }) => `설정 파일에 "tokens"(토큰 CSS 파일 경로)가 없습니다: ${file}`,
  configNoComponentsPath: ({ file }) =>
    `설정 파일의 "components.path"(디자인 시스템 컴포넌트 경로)가 없습니다: ${file}`,
  configNoReplaces: ({ file }) =>
    `설정 파일의 "components.replaces"(raw 태그와 대체 컴포넌트)가 없습니다: ${file}`,
  configBadReplace: ({ tag, file }) =>
    `설정 파일의 "components.replaces.${tag}"는 컴포넌트 이름, 이름의 배열 또는 "component" 필드가 있는 객체여야 합니다: ${file}`,
  configBadReplaceComponent: ({ tag, file }) =>
    `설정 파일의 "components.replaces.${tag}.component"는 컴포넌트 이름 또는 이름이 하나 이상 담긴 배열이어야 합니다: ${file}`,
  configBadWhen: ({ tag, file }) =>
    `설정 파일의 "components.replaces.${tag}.when"은 속성별 허용 값을 지정하는 객체여야 합니다: ${file}`,
  configBadWhenValues: ({ tag, attribute, file }) =>
    `설정 파일의 "components.replaces.${tag}.when.${attribute}"는 문자열 또는 null을 담은 배열이어야 합니다: ${file}`,
  configBadLang: ({ file }) => `설정 파일의 "lang"은 "en"이나 "ko"여야 합니다: ${file}`,
  configBadPalette: ({ file }) => `설정 파일의 "palette"는 "tailwind"여야 합니다: ${file}`,
  tailwindConfigFailed: ({ file, reason }) =>
    `Tailwind 설정을 불러오지 못했습니다: ${file}: ${reason}. 거기에 정의된 색을 알 수 없어서 "토큰에 없음"으로 나옵니다.`,
  paletteMissing: ({ root }) =>
    `설정에 "palette": "tailwind"가 있지만 ${root}에서 tailwindcss를 찾지 못했습니다. 프로젝트의 의존성을 설치하거나 "palette"를 지우세요.`,
  settingsUnreadable: ({ file }) => `${file} 을 읽을 수 없습니다. JSON 형식을 고친 뒤 다시 실행하세요.`,

  noColorTokens: ({ tokens }) =>
    `색 토큰을 하나도 읽지 못했습니다: ${tokens}. ` +
    "--color-* 변수의 값이 hex, rgb(), hsl(), oklch() 색이거나, var()로 그런 값을 가리켜야 읽을 수 있습니다. " +
    '지금은 직접 쓴 색이 모두 "토큰에 없음" 경고로 나옵니다.',
  nextNoTokens: () =>
    "색 토큰이 없어서 색을 판정할 기준이 없습니다. 색을 고치기 전에 `designsnitch colors`로 쓰이는 색을 모아 토큰부터 정하세요.",
  nextRepair: (n) => `action이 repair인 ${n}건은 그 파일의 문법 오류부터 고치세요.`,
  nextReplace: (n) => `action이 replace인 ${n}건은 found를 candidates의 값으로 바꾸세요.`,
  nextMigrate: (n) =>
    `action이 migrate인 ${n}건은 태그를 candidates의 컴포넌트로 바꾸세요. 먼저 그 컴포넌트를 읽고, import를 더하고, 컴포넌트가 받는 props를 넘기고, 컴포넌트가 이미 주는 className은 지우세요. 태그가 하던 일을 컴포넌트가 못 하거나 모양이 달라지면, 컴포넌트를 고쳐서 맞추지 말고 태그를 그대로 둔 채 사용자에게 물으세요.`,
  nextAsk: (n) =>
    `변경하기 전에 decisions의 ${n}건을 사용자에게 물으세요. 사용 횟수와 후보, 확인이 필요한 이유를 함께 알려 주세요.`,
  hookNextAsk: (n) =>
    `action이 ask인 ${n}건은 바꾸지 말고 사용자에게 물으세요. 물을 때는 \`designsnitch colors\`로 그 색이 몇 곳에서 어떻게 쓰이는지 확인해서 근거로 함께 주세요.`,
  nextRerun: () => "고친 뒤 같은 명령을 다시 실행하세요.",
  nextNone: () => "위반이 없습니다.",

  designSystem: ({ colorTokens, paletteColors = 0, components }) =>
    `디자인 시스템: 색 토큰 ${colorTokens}개` +
    (paletteColors > 0 ? `와 Tailwind 기본 팔레트(색 ${paletteColors}개)` : "") +
    ", " +
    (components > 0 ? `컴포넌트 ${components}개` : "컴포넌트 설정 없음"),
  notice: (problem) => `주의: ${problem}`,
  severity: { error: "오류", warning: "경고" },
  summary: ({ errors, warnings, files }) =>
    `오류 ${errors}개, 경고 ${warnings}개 (파일 ${files}개 검사)`,
  actions: ({ replace, migrate = 0, ask, repair, decisions }) =>
    [
      `바로 바꿀 수 있는 것 ${replace}건`,
      ...(migrate > 0 ? [`컴포넌트로 옮길 것 ${migrate}건`] : []),
      `사람이 정해야 하는 것 ${ask}건 (결정 ${decisions}개)`,
      ...(repair > 0 ? [`문법을 고쳐야 하는 것 ${repair}건`] : []),
    ].join(", "),
  noViolations: ({ files }) => `위반이 없습니다. (파일 ${files}개 검사)`,
  unchecked: ({ colors, files }) =>
    `검사하지 못함: 테마 객체나 차트 옵션 같은 다른 문자열에 색 ${colors}개 (파일 ${files}개). \`designsnitch colors\`로 볼 수 있습니다.`,

  colorsNone: ({ files }) => `코드에서 색을 찾지 못했습니다. (파일 ${files}개 검사)`,
  colorsSummary: ({ colors, paletteColors, uses, files }) =>
    `코드에서 쓰는 색: hex ${colors}개, 기본 팔레트 ${paletteColors}개 (사용 ${uses}곳, 파일 ${files}개 검사)`,
  hexTitle: "hex 색",
  paletteTitle: "Tailwind 기본 팔레트",
  usage: ({ uses, files }) => `${uses}곳  파일 ${files}개`,
  literals: (n) => `문자열 ${n}`,
  css: (n) => `CSS ${n}`,
  tokenNote: (tokens) => (tokens.length > 0 ? `토큰: ${tokens.join(", ")}` : "토큰 없음"),

  hookHeader: (n) => `designsnitch: 방금 고친 파일에 디자인 시스템 오류가 ${n}건 있습니다.`,
  nextTitle: "다음에 할 일",

  skillsCopied: ({ n, dir }) => `스킬 ${n}개를 ${dir} 에 복사했습니다.`,
  hookRegistered: ({ file }) => `훅을 ${file} 에 등록했습니다.`,
  hookAlready: ({ file }) => `훅은 이미 ${file} 에 등록되어 있습니다.`,
  codexTrust: () =>
    "Codex는 신뢰한 프로젝트에서, 사용자가 승인한 훅만 실행합니다. 이 프로젝트에서 Codex를 열고 프로젝트 신뢰와 훅 승인을 요청받으면 승인하세요.",
  geminiTrust: () =>
    "Gemini CLI는 프로젝트에 새 훅이 생기면 실행하기 전에 경고합니다. 이 프로젝트에서 Gemini CLI를 열고 훅을 허용하세요. 폴더 신뢰 기능을 켜 두었다면 이 폴더도 신뢰해야 합니다.",
  grokTrust: () =>
    "Grok Build는 신뢰한 프로젝트의 훅만 실행합니다. 이 프로젝트에서 Grok Build를 열고 /hooks-trust 로 신뢰하거나 --trust 로 시작하세요.",
  installPackage: () =>
    "훅이 매번 빠르게 돌도록 프로젝트에 설치하세요: npm install --save-dev designsnitch",
  askAgent: ({ configFile }) =>
    `코딩 에이전트에게 "이 프로젝트에 designsnitch를 설정해 줘"라고 요청하세요. 토큰 CSS와 공용 컴포넌트를 찾아 ${configFile} 을 만들고 ESLint에 규칙을 넣습니다.`,

  cliUsage: `사용법: designsnitch <명령> [경로...] [--format text|json] [--config 파일] [--lang en|ko]

명령
  check     UI 코드가 디자인 시스템을 따르는지 검사합니다.
  colors    코드에서 쓰는 색을 모아 보여줍니다. 설정 파일이 없어도 됩니다.
  hook      코딩 에이전트의 훅에서 부릅니다. 방금 고친 파일에 오류가 있으면 2로 끝납니다.
  install   스킬과 에이전트 훅을 프로젝트에 설치합니다.

옵션
  경로        볼 파일이나 디렉터리 (기본: 현재 디렉터리)
  --format    출력 형식. text(기본) 또는 json
  --config    설정 파일 경로 (기본: designsnitch.config.json)
  --lang      메시지의 언어. en(기본) 또는 ko
  --agent     install 에서 설치할 에이전트. --agent claude|codex|gemini|grok|all (기본: claude)

check 의 종료 코드: 0 오류 없음, 1 오류 있음, 2 실행하지 못함
`,
};
