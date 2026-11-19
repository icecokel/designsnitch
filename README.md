# designsnitch

English | [한국어](./README.ko.md)

designsnitch helps keep a UI codebase manageable and consistent when the project has no design system, or has one in name only. It is built for code written by AI agents, which produce plausible UI quickly and scatter colors, spacing and components across screens as they go.

It works inside the code, with no designer or Figma file required.

1. **Establish a standard.** It collects the values the code already uses so you can turn them into tokens.
2. **Keep to it.** It checks new code against that standard and tells you what to use instead.
3. **Clean up.** It helps bring code that has already drifted back to the standard.

Deciding what the standard is stays with the developer. The tool's job is to bring what is needed to make that decision.

It has four parts.

| Part | What it is for |
| --- | --- |
| CLI | A tool for the AI agent. It collects the colors in use, checks code, and says what to do with each violation. |
| Agent skills | Tell an AI agent how to set the project up, when to run the CLI, what to fix, and what to ask a person about. |
| ESLint plugin | Blocks and warns. The same rules show up as errors and warnings in the editor and in the lint step. |
| Agent hook | Blocks while the code is being written. The agent is told about errors after each edit and cannot finish while errors it can fix remain. |

It supports **React/Next.js projects that use Tailwind CSS v4**.

> **Status:** MVP (0.1.x). CLI messages are in Korean for now. The JSON output carries the same information in language-neutral fields.

## Why

UI code written by an AI agent usually looks fine at a glance and is slightly off when you look closely.

- The primary color is hard-coded as `bg-[#3B82F6]` instead of the token, so that spot keeps its color when the theme changes.
- A button color is almost the primary color, but not quite.
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
| `color-use-token` | Error | A hex color that has a token, written as an arbitrary value (`bg-[#3B82F6]`) or in a CSS declaration (`color: #3B82F6`) |
| `color-unknown` | Warning | A hex color with no matching token |
| `use-ds-component` | Error | A raw tag such as `<button>` used outside the design system directory, when a shared component replaces it |

Every error comes with what to use instead: a class or component in JS and TS files, and `var(--token)` in CSS files.

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
| `CSS 2` | Uses in CSS declarations. The JSON output breaks these down by property. |
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

This is what is read from the token CSS.

| Variable | Used for | When missing |
| --- | --- | --- |
| `--color-*` | Colors. The value must be a hex color, or a `var()` that leads to one. | Every hex color becomes a warning |

Both of these shapes work.

```css
/* Values directly in @theme */
@theme {
  --color-primary-500: #3B82F6;
  --color-surface: #ffffff;
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
디자인 시스템: 색 토큰 2개, 컴포넌트 2개

src/PayButton.tsx
  5:6  오류  <button> 대신 디자인 시스템 컴포넌트를 사용하세요: Button (./components/ui)  (use-ds-component)
  7:55  오류  bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500  (color-use-token)
  8:26  경고  bg-[#3B82F5]의 색은 토큰에 없습니다.  (color-unknown)

오류 2개, 경고 1개 (파일 3개 검사)
바로 바꿀 수 있는 것 2건, 사람이 정해야 하는 것 1건
```

The first line shows how many tokens and components were read from the config. A wrong path shows up here as a zero. If no color token could be read, a line starting with `주의:` (notice) explains why. `오류` means error and `경고` means warning. The last line says how many violations can be replaced right away (`바로 바꿀 수 있는 것`) and how many need a person's decision (`사람이 정해야 하는 것`).

`--format json` prints the same result as structured data.

```json
{
  "designSystem": { "colorTokens": 2, "components": 2, "replacedTags": 2 },
  "problems": [],
  "next": [
    "action이 replace인 2건은 found를 candidates의 값으로 바꾸세요.",
    "action이 ask인 1건은 바꾸지 말고 사용자에게 물으세요. ...",
    "고친 뒤 같은 명령을 다시 실행하세요."
  ],
  "summary": { "files": 3, "errors": 2, "warnings": 1 },
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
      "candidates": ["bg-primary-500"],
      "action": "replace"
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
| `violations[].action` | How to handle the violation. `replace`: an error with exactly one candidate, so replace `found` with it. `ask`: a person has to decide (several candidates, or a color with no token). `repair`: the file could not be parsed. |
| `next` | What an agent should do with this result, in order |

| Exit code | Meaning |
| --- | --- |
| 0 | No errors (warnings alone still exit 0) |
| 1 | Errors found |
| 2 | Could not run (missing config file, token CSS or component directory, or bad arguments) |

The check does not depend on the project's ESLint config. It reads `.js`, `.jsx`, `.ts`, `.tsx` and `.css` files and skips `node_modules`, `.next`, `dist`, `build`, `out` and `coverage`.

## Exceptions

Mark intentional exceptions with a comment.

```tsx
{/* eslint-disable-next-line designsnitch/color-unknown -- campaign-only color */}
<p className="text-[#FF00AA]">Campaign</p>
```

In a CSS file, put this comment on the line before the declaration.

```css
.campaign {
  /* designsnitch-disable-next-line -- campaign-only color */
  color: #FF00AA;
}
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
| `designsnitch-check` | After changing UI code | Runs the check, replaces what can be replaced, and asks a person about the rest with the facts needed to decide. |
| `designsnitch-setup` | When the config file is missing | Finds the token CSS and the shared component directory in the codebase, writes `designsnitch.config.json`, verifies what was read, and then wires the ESLint plugin and the agent hook. |
| `designsnitch-palette` | When the project has no color tokens | Collects the colors in use with `designsnitch colors`, proposes tokens, and writes them after a person approves. |
| `designsnitch-hooks` | As part of setup | Registers `designsnitch hook` with the coding agent, so it is told about errors after each edit and cannot finish while fixable errors remain. |
| `designsnitch-eslint` | As part of setup | Puts the rules into the project's ESLint, and installs ESLint if the project has none. Asks first if the project already has errors. |

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
      "designsnitch/use-ds-component": "error",
      // warn: the value is not in the design system, so a person has to decide
      "designsnitch/color-unknown": "warn",
    },
  },
];
```

The same set of rules is available as `designsnitch.configs.recommended`. In a project that already has many violations, the error-level rules will make the existing lint step fail, so run `designsnitch check` first to see how many there are. Replacement candidates appear as ESLint suggestions, which editors show as quick fixes. CSS files are checked by the CLI only, not through ESLint.

## Blocking violations

The CLI and the skills put an AI agent in a position to do the right thing. Blocking is done in two other places.

| Where | When it catches a violation | How |
| --- | --- | --- |
| ESLint plugin | In the editor and in the lint step | Errors fail the lint step. Run lint in CI and require it to pass, and nothing with an error can be merged. |
| Agent hook | While the agent is writing code | `designsnitch hook` runs after each edit and before the agent finishes. |

### Agent hook

A skill is advice that an agent may not follow. A hook is run by the agent's runtime every time. For Claude Code, put this in `.claude/settings.json`.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command", "command": "npx designsnitch hook" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "npx designsnitch hook" }]
      }
    ]
  }
}
```

`designsnitch hook` checks only the files the agent just changed.

- After an edit, if the file has errors, the agent receives them along with what to do next.
- When the agent is about to finish, it is stopped if errors it can fix itself remain. Errors that need a person's decision do not stop it, because it has to stop in order to ask.
- Warnings never block, and violations in files the agent did not touch are left alone.

The command reads an optional JSON object from stdin (`tool_input.file_path`, `hook_event_name`, `stop_hook_active`), exits with 2 and writes to stderr when it blocks, and falls back to the files git reports as changed when no file is given. Other agents with command hooks that follow these conventions can use it too. The `designsnitch-hooks` skill sets this up.

### Tailwind's default palette

designsnitch does not flag default palette classes such as `bg-blue-500`. If the project should only use its own tokens, Tailwind v4 can remove the default palette, and then those classes stop working at all.

```css
@theme {
  --color-*: initial;
  --color-primary-500: #3B82F6;
}
```

## Scope

- **Where it looks in JS and TS:** string literals and template literals. This covers `className` and the arguments of `cn()`, `clsx()` and `cva()`. Comments are ignored.
- **Where it looks in CSS:** hex colors in declaration values, in `.css` files including CSS Modules. Declarations that define a variable (`--name: ...`) are skipped, since that is where tokens are defined. Only colors are checked in CSS for now.
- **Themes:** when a token has different values per theme, all of them count as that token's value.
- **Fixes:** designsnitch reports candidates and never rewrites code by itself, even when there is only one candidate.

### Not supported yet

- Colors that are not hex (`rgb()`, `hsl()`, `oklch()`)
- Values from Tailwind's default theme. Only the values written in the project's token CSS are read.
- Tailwind v3 (`tailwind.config.js`)
- The nearest token for a color that has none
- Inline styles
- SCSS and other preprocessors
- Spacing, font size and radius. They were left out of this version on purpose.
- Classes inside `@apply`
- Comparing a hand-made component's styles with the design system component
- A command that installs the skills and the hook

Comparing a screen with a design file such as Figma is out of scope. The standard is the design system alone.

## How it works

The split between a skill and a tool that does the work follows Modern Web Guidance by the Chrome team. The CLI makes the verdicts, and the skills only decide when the agent calls the CLI and what it does with the result. People and AI use the same rules and the same results.

| Layer | Location | What it does |
| --- | --- | --- |
| Core | `src/core` | Reads the token CSS into a value-to-token table, and finds color classes and values in strings and CSS. Does not depend on ESLint. |
| Rules | `src/rules` | Find strings and JSX tags in the AST, ask the core, and report violations with candidates. Written as ESLint rules. |
| Check engine | `src/check.js` | Runs the rules on a project and turns the results into a list of violations. Uses ESLint internally to parse and walk the code. |
| CLI | `src/cli.js` | Reads arguments and the config file, calls the engine, and prints the result. |
| Hook | `src/hook.js` | Checks the files an agent just changed and decides whether to block. |
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
