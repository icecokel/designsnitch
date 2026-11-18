# designsnitch

English | [한국어](./README.ko.md)

designsnitch finds the places where UI code departs from your project's design system and tells you what to use instead. It is built for code written by AI agents, which often looks right but quietly skips your tokens and shared components.

It has three parts.

| Part | What it does |
| --- | --- |
| Check engine | Parses the code and finds violations with their locations and replacement candidates. |
| CLI | `designsnitch check` runs the check, and `designsnitch colors` lists the colors the code uses. Both print a readable report or JSON. |
| Agent skills | Tell an AI agent when to run the CLI, what to fix, and what to ask a person about. |

It supports **React/Next.js projects that use Tailwind CSS v4**.

> **Status:** MVP (0.1.x). CLI messages are in Korean for now. The JSON output carries the same information in language-neutral fields.

## Why

UI code written by an AI agent usually looks fine at a glance and is slightly off when you look closely.

- The primary color is hard-coded as `bg-[#3B82F6]` instead of the token, so that spot keeps its color when the theme changes.
- A button color is almost the primary color, but not quite.
- Spacing that should be `p-4` is written as `p-[15px]` or `p-[18px]`.
- The design system has a `Button`, but the code builds a new one from `<button>`, a little shorter and without a focus style.

These differences are hard to catch by eye in review. designsnitch finds them by analyzing the code.

## What it catches

Severity follows one rule.

| Severity | Meaning |
| --- | --- |
| **Error** | The design system has a token or component for this, and the code did not use it. Even if the screen looks the same today, this code will not follow when the design system changes. |
| **Warning** | The design system has no matching token. A person has to decide whether a new value is really needed or it is a mistake. |

| Rule | Severity | What it catches |
| --- | --- | --- |
| `color-use-token` | Error | A hex color that has a token, written as an arbitrary value (`bg-[#3B82F6]`) |
| `color-unknown` | Warning | A hex color with no matching token |
| `scale-use-token` | Error | A spacing, font size or radius value that is on the scale, written as an arbitrary value (`p-[16px]`) |
| `scale-unknown` | Warning | A spacing, font size or radius value that is not on the scale |
| `use-ds-component` | Error | A raw tag such as `<button>` used outside the design system directory, when a shared component replaces it |

Every error comes with the class or component to use instead. `scale-unknown` comes with the nearest values on the scale.

## Quick start

```sh
npm install --save-dev designsnitch
```

Node.js 22 or later is required.

Create `designsnitch.config.json` in the project root. If you use the [agent skills](#agent-skills), the agent reads the repository and writes this file for you.

```json
{
  "tokens": "./app/globals.css",
  "components": {
    "path": "./components/ui",
    "replaces": {
      "button": ["SolidButton", "IconButton"],
      "input": "Input",
      "dialog": "Dialog"
    }
  }
}
```

Then run the check.

```sh
npx designsnitch check                      # the whole project
npx designsnitch check src/PayButton.tsx    # some files only
npx designsnitch check --format json        # for CI and AI agents
```

## Starting without tokens

Some projects have no color tokens yet: colors are written straight into the code. `designsnitch colors` lists the colors the code uses, so you can turn them into tokens. It works without a config file.

```sh
npx designsnitch colors
npx designsnitch colors --format json
```

```
코드에서 쓰는 색: hex 5개, 기본 팔레트 1개 (사용 10곳, 파일 1개 검사)

hex 색
  #3a11d8  3곳  파일 1개  bg 2, 문자열 1
  #484646  2곳  파일 1개  text 2
  #ffffff  2곳  파일 1개  bg 1, text 1
  #484645  1곳  파일 1개  text 1
  #e2e1e5  1곳  파일 1개  border 1

Tailwind 기본 팔레트
  gray-700  1곳  파일 1개  text 1
```

| Part of the output | Meaning |
| --- | --- |
| `hex 색` (hex colors) | Hex colors, most used first, with the number of uses (`곳`) and files (`파일`). |
| `bg 2`, `text 1` | Uses per Tailwind utility. `bg-[#3a11d8]` counts under `bg`. |
| `문자열 1` (strings) | Strings that are a hex color on their own, such as inline styles and chart options. |
| `Tailwind 기본 팔레트` (default palette) | Colors from Tailwind's default palette used by name, such as `text-gray-700`. |

When a config file exists, each color also shows the tokens that already have that value (`토큰: --color-brand`), or `토큰 없음` when there is none. The JSON output has the same data plus a few example locations per color.

The [`designsnitch-palette` skill](#agent-skills) uses this output to propose tokens, and writes them after you approve.

## Configuration

| Field | Description |
| --- | --- |
| `tokens` | The CSS file that defines the tokens. Required. |
| `components.path` | The directory that holds the design system components. Raw tags are allowed inside it. |
| `components.replaces` | Raw tags and the components that replace them. Use an array when several components replace one tag. |

Without `components`, the component check is skipped. Use `--config <file>` to read a config file from another path.

These variables are read from the token CSS.

| Variable | Used for | When missing |
| --- | --- | --- |
| `--color-*` | Colors. The value must be a hex color, or a `var()` that leads to one. | Every hex color becomes a warning |
| `--spacing` | The spacing unit | Tailwind's default, `0.25rem`, is used |
| `--radius-*` | Radius | Radius is not checked |
| `--text-*` | Font size | Font size is not checked |

Both of these shapes work.

```css
/* Values directly in @theme */
@theme {
  --color-primary-500: #3B82F6;
  --radius-md: 0.375rem;
  --text-sm: 0.875rem;
}

/* Values in :root, referenced from @theme */
:root {
  --primary-500: #3B82F6;
}
@theme {
  --color-primary-500: var(--primary-500);
}
```

## Output

```
디자인 시스템: 색 토큰 2개, radius 토큰 2개, 폰트 크기 토큰 2개, 컴포넌트 2개

src/PayButton.tsx
  5:6  오류  <button> 대신 디자인 시스템 컴포넌트를 사용하세요: Button (./components/ui)  (use-ds-component)
  7:10  오류  rounded-[6px]의 값은 radius 토큰에 있습니다. 대신 사용: rounded-md  (scale-use-token)
  7:24  오류  px-[16px]의 값은 간격 스케일에 있습니다. 대신 사용: px-4  (scale-use-token)
  7:34  경고  py-[7px]의 값은 간격 스케일에 없습니다. 가까운 값: py-1.5 (6px), py-2 (8px)  (scale-unknown)
  7:55  오류  bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500  (color-use-token)
  8:26  경고  bg-[#3B82F5]의 색은 토큰에 없습니다.  (color-unknown)

오류 4개, 경고 2개 (파일 3개 검사)
```

The first line shows how many tokens and components were read from the config. A wrong path shows up here as a zero. If no color token could be read, a line starting with `주의:` (notice) explains why. `오류` means error and `경고` means warning.

`--format json` prints the same result as structured data.

```json
{
  "designSystem": {
    "colorTokens": 2,
    "radiusTokens": 2,
    "textTokens": 2,
    "components": 2,
    "replacedTags": 2
  },
  "problems": [],
  "summary": { "files": 3, "errors": 4, "warnings": 2 },
  "violations": [
    {
      "file": "src/PayButton.tsx",
      "line": 7,
      "column": 55,
      "endLine": 7,
      "endColumn": 67,
      "rule": "color-use-token",
      "severity": "error",
      "message": "bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500",
      "found": "bg-[#3B82F6]",
      "candidates": ["bg-primary-500"]
    }
  ]
}
```

| Field | Content |
| --- | --- |
| `designSystem` | How many tokens and components were read from the config |
| `problems` | Config problems that make the result unreliable. Empty when everything is fine. |
| `violations[].found` | The offending piece of code |
| `violations[].candidates` | The classes or components to use instead. Empty when there are none. |

| Exit code | Meaning |
| --- | --- |
| 0 | No errors (warnings alone still exit 0) |
| 1 | Errors found |
| 2 | Could not run (missing config file, token CSS or component directory, or bad arguments) |

The check does not depend on the project's ESLint config. It reads `.js`, `.jsx`, `.ts` and `.tsx` files and skips `node_modules`, `.next`, `dist`, `build`, `out` and `coverage`.

## Exceptions

Mark intentional exceptions with a comment.

```tsx
{/* eslint-disable-next-line designsnitch/color-unknown -- campaign-only color */}
<p className="text-[#FF00AA]">Campaign</p>
```

## Agent skills

The skills are in the `skills/` directory of the package. Copy them into your agent's skill directory. For Claude Code:

```sh
mkdir -p .claude/skills
cp -r node_modules/designsnitch/skills/* .claude/skills/
```

Each skill does one job.

| Skill | When the agent uses it | What it does |
| --- | --- | --- |
| `designsnitch-check` | After changing UI code | Runs the check, fixes the errors that have exactly one candidate, and shows a person the rest. |
| `designsnitch-setup` | When the config file is missing | Finds the token CSS and the shared component directory, writes `designsnitch.config.json`, and verifies what was read. |
| `designsnitch-palette` | When the project has no color tokens | Collects the colors in use with `designsnitch colors`, proposes tokens, and writes them after a person approves. |
| `designsnitch-eslint` | When the project uses ESLint | Adds the same rules to the ESLint flat config. Asks first if the project already has errors. |

The skills share a few rules. The agent does not pick one of several candidates on its own, does not silence a rule to make the check pass, and does not change an existing config file or token without asking. The config file and the tokens are the standard the code is judged against.

## ESLint

The same rules can run inside your project's ESLint, so violations show up in the editor and in the lint step you already have. The ESLint config reads `designsnitch.config.json`, so the standard is written in one place.

```js
// eslint.config.js
import designsnitch from "designsnitch";
import designSystem from "./designsnitch.config.json" with { type: "json" };

export default [
  // ...your existing config
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { designsnitch },
    settings: { designsnitch: designSystem },
    rules: {
      // error: the design system has a token or component for this, and it was not used
      "designsnitch/color-use-token": "error",
      "designsnitch/scale-use-token": "error",
      "designsnitch/use-ds-component": "error",
      // warn: the value is not in the design system, so a person has to decide
      "designsnitch/color-unknown": "warn",
      "designsnitch/scale-unknown": "warn",
    },
  },
];
```

The same set of rules is available as `designsnitch.configs.recommended`. In a project that already has many violations, the error-level rules will make the existing lint step fail, so run `designsnitch check` first to see how many there are. Replacement candidates appear as ESLint suggestions, which editors show as quick fixes.

## Scope

- **Where it looks:** string literals and template literals in the code. This covers `className` and the arguments of `cn()`, `clsx()` and `cva()`. Comments are ignored.
- **Spacing:** padding, margin, gap and space utilities only. Sizing utilities such as `w-[320px]` are not checked.
- **Spacing scale:** multiples of half the spacing unit (`p-0.5`, `p-1.5`, `p-4`) and `p-px` count as on the scale.
- **Units:** `px` and `rem` only. `1rem` is treated as 16px.
- **Themes:** when a token has different values per theme, all of them count as that token's value.
- **Fixes:** designsnitch reports candidates and never rewrites code by itself, even when there is only one candidate.

### Not supported yet

- Colors that are not hex (`rgb()`, `hsl()`, `oklch()`)
- Values from Tailwind's default theme. Only the values written in the project's token CSS are read.
- Tailwind v3 (`tailwind.config.js`)
- The nearest token for a color that has none
- Inline styles, `.css` files and CSS Modules
- Comparing a hand-made component's styles with the design system component
- A command that installs the skill

Comparing a screen with a design file such as Figma is out of scope. The standard is the design system alone.

## How it works

The split between a skill and a tool that does the work follows Modern Web Guidance by the Chrome team. The CLI makes the verdicts, and the skills only decide when the agent calls the CLI and what it does with the result. People and AI use the same rules and the same results.

| Layer | Location | What it does |
| --- | --- | --- |
| Core | `src/core` | Reads the token CSS into a value-to-token table, finds arbitrary-value classes in strings, and compares values with the scale. Does not depend on ESLint. |
| Rules | `src/rules` | Find strings and JSX tags in the AST, ask the core, and report violations with candidates. Written as ESLint rules. |
| Check engine | `src/check.js` | Runs the rules on a project and turns the results into a list of violations. Uses ESLint internally to parse and walk the code. |
| CLI | `src/cli.js` | Reads arguments and the config file, calls the engine, and prints the result. |
| Skills | `skills/` | Instructions for the agent, one skill per job. |

## Development

```sh
npm install
npm test
```

### Releasing

Merging into `main` does not publish anything. Pushing a version tag makes GitHub Actions run the tests and publish to npm.

```sh
npm version patch        # bumps package.json, commits, and creates a tag such as v0.1.1
git push --follow-tags   # pushing the commit and the tag starts the release
```

The release stops if the tag and the version in `package.json` differ, or if the tagged commit is not on `main`.

## License

[MIT](./LICENSE)
