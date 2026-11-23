# designsnitch

English | [Korean](./README.ko.md)

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

It supports **React/Next.js projects that use Tailwind CSS v4**. Tailwind v3 projects are checked too, with fewer candidates (see [Tailwind v3](#tailwind-v3)).

> **Status:** MVP (0.5.x). It checks colors and shared components for now. Spacing, font size and radius are not checked yet (see [Scope](#scope)). Messages are in English by default and can be switched to Korean. See [Language](#language).

## Getting started

```sh
npm install --save-dev designsnitch
npx designsnitch install
```

The second command installs the agent skills and registers the agent hook. Node.js 20.19 or later is required.

| Agent | Command | Skills go to | Hook goes to |
| --- | --- | --- | --- |
| Claude Code | `npx designsnitch install` | `.claude/skills` | `.claude/settings.json` |
| Codex | `npx designsnitch install --agent codex` | `.agents/skills` | `.codex/hooks.json` |
| Gemini CLI | `npx designsnitch install --agent gemini` | `.agents/skills` | `.gemini/settings.json` |
| Grok Build | `npx designsnitch install --agent grok` | `.grok/skills` | `.grok/hooks/designsnitch.json` |
| All of them | `npx designsnitch install --agent all` | | |

Codex, Gemini CLI and Grok Build run a new project hook only after you approve or trust it. Open the agent in the project and approve when it asks. In Grok Build, use `/hooks-trust` or start it with `--trust`.

| Agent | How the hook was checked |
| --- | --- |
| Claude Code | Run with the real agent. It wrote a hex color, was told by the hook, and switched to the token class. |
| Codex | Run with the real agent. Same result. |
| Gemini CLI | **Not tested.** Built from the official Gemini CLI documentation. |
| Grok Build | **Not tested.** Built from the official xAI documentation. See the note under [Agent hook](#agent-hook). |

The skills follow the open Agent Skills format, so any agent that supports it can use them. The standard installer puts them where each agent looks: `npx skills add icecokel/designsnitch`. It installs the skills only, not the hook.

Then ask your coding agent:

> Set up designsnitch in this project.

The agent follows the `designsnitch-setup` skill and does the rest.

1. It checks that the project is supported.
2. It finds the token CSS and the shared component directory, and writes `designsnitch.config.json`.
3. If the project has no color tokens, it collects the colors the code uses and proposes tokens. Nothing is written until you approve.
4. It puts the rules into ESLint, installing ESLint if the project has none.
5. It shows you what it chose and what the first check found.

From then on:

- The agent is told about errors right after it edits a file, and cannot finish while errors it can fix remain.
- Errors fail the lint step, and show up in the editor.
- `npx designsnitch check` reports where the code stands at any time.

To do any of this without an agent, see [Setting up by hand](#setting-up-by-hand).

## Why

When there is no standard, every screen makes its own choices. An AI agent makes them quickly and plausibly, and they add up.

- The same blue is `#3B82F6` on one screen and `#3B82F5` on another.
- A color is written by hand in a hundred places, so changing the brand color or adding dark mode means finding every one of them.
- Each screen builds its own button from `<button>`, each a little different, some without a focus style.

The result is a codebase that is hard to manage and a product that is hard to keep consistent. And with no standard, there is nothing to check new code against. designsnitch helps you set a standard from what the code already does, and then holds new code to it.

## What it catches

Severity follows one rule.

| Severity | Meaning |
| --- | --- |
| **Error** | The design system has a token or component for this, and the code did not use it. Even if the screen looks the same today, this code will not follow when the design system changes. |
| **Warning** | The design system has no matching token. A person has to decide whether a new value is really needed or it is a mistake. |

| Rule | Severity | What it catches |
| --- | --- | --- |
| `color-use-token` | Error | A color that has a token, written by hand as an arbitrary value (`bg-[#3B82F6]`), in an inline style (`style={{ color: "#3B82F6" }}`), in a CSS declaration (`color: #3B82F6`) or in `@apply` |
| `color-unknown` | Warning | A color written by hand with no matching token |
| `use-ds-component` | Error | A raw tag such as `<button>` used outside the design system directory, when a shared component replaces it |

A color written by hand is a hex color, a color function with literal numbers (`rgb()`, `hsl()`, `oklch()`), or a color name such as `white`. Notation does not matter: `#3B82F6`, `rgb(59 130 246)` and `hsl(217 91% 60%)` are the same color to the check.

Every error comes with what to use instead: a class or component in JS and TS files, and `var(--token)` in inline styles and CSS files. Tailwind v4 outputs a theme variable when the source uses it with `var()`, so `var(--token)` in an inline style renders the same color.

## Commands

| Command | What it does |
| --- | --- |
| `designsnitch install` | Copies the skills and registers the agent hook in the project. `--agent claude` (default), `codex`, `gemini`, `grok` or `all`. |
| `designsnitch colors` | Lists the colors the code uses. Works without a config file. |
| `designsnitch check` | Checks code against the standard and says what to do with each violation. |
| `designsnitch hook` | Called from the agent's hook. Checks the files the agent just changed. |

`check` and `colors` take paths, `--format json`, and `--config <file>`. Every command takes `--lang en|ko`.

## Setting up by hand

```sh
npm install --save-dev designsnitch
```

Create `designsnitch.config.json` in the project root.

```json
{
  "tokens": "./app/globals.css",
  "components": {
    "path": "./components/ui",
    "replaces": {
      "button": ["SolidButton", "IconButton"],
      "input": { "component": "Input", "when": { "type": ["text", "email", null] } },
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

The fields are described in [Configuration](#configuration). To block violations, add the rules to [ESLint](#eslint) and register the [agent hook](#agent-hook).

## Starting without tokens

Some projects have no color tokens yet: colors are written straight into the code. `designsnitch colors` lists the colors the code uses, so you can turn them into tokens. It works without a config file.

```sh
npx designsnitch colors
npx designsnitch colors --format json
```

```
Colors used in the code: 5 hex, 1 from the default palette (10 uses, 1 file checked)

Hex colors
  #3a11d8  3 uses  1 file  bg 2, string 1
  #484646  2 uses  1 file  text 2
  #ffffff  2 uses  1 file  bg 1, text 1
  #484645  1 use  1 file  text 1
  #e2e1e5  1 use  1 file  border 1

Tailwind default palette
  gray-700  1 use  1 file  text 1
```

| Part of the output | Meaning |
| --- | --- |
| `Hex colors` | Hex colors, most used first, with the number of uses and files. |
| `bg 2`, `text 1` | Uses per Tailwind utility. `bg-[#3a11d8]` counts under `bg`. |
| `string 1` | Strings that are a color on their own, such as inline styles and chart options. |
| `CSS 2` | Uses in CSS declarations. The JSON output breaks these down by property. |
| `Tailwind default palette` | Colors from Tailwind's default palette used by name, such as `text-gray-700`. |

When a config file exists, each color also shows the tokens that already have that value (`token: --color-brand`), or `no token` when there is none. The JSON output has the same data plus a few example locations per color.

The [`designsnitch-palette` skill](#agent-skills) uses this output to propose tokens, and writes them after you approve.

## Configuration

| Field | Description |
| --- | --- |
| `tokens` | The CSS file that defines the tokens. Required. Either a path, or an object with `file` and the optional `exclude` and `prefer` (see below). |
| `components.path` | The directory that holds the design system components. Raw tags are allowed inside it. |
| `components.replaces` | Raw tags and the components that replace them. Use an array when several components replace one tag. Use `{ "component": ..., "when": { ... } }` when a component covers only some variants of the tag (see below). |
| `palette` | `"tailwind"` to use Tailwind's default palette as part of the standard (see [Tailwind's default palette](#tailwinds-default-palette)). |
| `lang` | The language of the messages: `en` (default) or `ko`. |

Without `components`, the component check is skipped. Use `--config <file>` to read a config file from another path. Paths in the config file are relative to the directory of the config file.

When several tokens share one value, every hex color with that value has several candidates, and each one needs a person's decision. The object form of `tokens` settles this once, in the config.

```json
"tokens": {
  "file": "app/globals.css",
  "exclude": ["--color-legacy-*"],
  "prefer": ["--color-brand-"]
}
```

- `exclude` drops tokens from the standard: exact names, or a prefix ending in `*`. A color that only an excluded token has counts as a color with no token. Other tokens can still refer to an excluded one with `var()`.
- `prefer` lists token prefixes in order. When the first prefix that matches leaves exactly one candidate, that candidate is the only one, and the error can be replaced right away. When it leaves several, they are all kept and a person decides.

A shared component often covers only some variants of a tag. An `Input` component may cover text fields but not `<input type="file">`. `when` lists the attribute values the component covers. `null` means the attribute is absent.

```json
"input": { "component": "Input", "when": { "type": ["text", "email", null] } }
```

- `<input type="file">` is not reported, because the component does not cover it.
- `<input type="text">` and `<input>` are reported as errors to move to the component (`migrate`).
- `<input type={kind}>` and `<input {...props}>` are reported, but marked `ask`: the value is only known at runtime, or a spread may override it, so replacing is not known to be safe.

This is what is read from the token CSS.

| Variable | Used for | When missing |
| --- | --- | --- |
| `--color-*` | Colors. The value must be a hex, `rgb()`, `hsl()` or `oklch()` color, or a `var()` that leads to one. | Every color written by hand becomes a warning |

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

Tokens are also read from where Tailwind itself reads them.

- **Imported CSS.** If the token CSS imports other CSS files (`@import "../brand/theme.css"`, or a package), their `@theme` tokens are read too.
- **A prefix.** With `@import "tailwindcss" prefix(tw)`, Tailwind names its CSS variables `--tw-color-*`, so `var()` candidates are written that way. Class candidates replace only the part after `tw:`.
- **A JavaScript config.** With `@config "./tailwind.config.js"`, colors in `theme.extend.colors` (and in presets) become tokens, and `theme.colors` replaces the default palette, as Tailwind v4 does. These colors exist only as classes: Tailwind makes no CSS variable for them. Writing one by hand in an inline style or a CSS declaration is still reported as an error, with no candidate, and a person decides what to do. Loading the config runs it, so what it requires must be installed. If it cannot be loaded, the result says so in `problems`.

### Tailwind v3

A v3 project keeps its colors in `tailwind.config.js`, and its CSS starts with `@tailwind base`. Point `tokens` at the CSS file as usual: when it uses `@tailwind`, the `tailwind.config.js` (or `.cjs`, `.mjs`, `.ts`) next to `designsnitch.config.json` is read. You can also point `tokens` straight at the config file. `"palette": "tailwind"` reads the v3 palette from `tailwindcss/colors`.

v3 makes no CSS variables for its colors, so every token is class-only: arbitrary color classes get token classes as candidates, and colors written by hand in CSS declarations and inline styles are reported without a candidate.

## Language

Messages are in English by default. To read them in Korean, set `"lang": "ko"` in `designsnitch.config.json`, set the environment variable `DESIGNSNITCH_LANG=ko`, or pass `--lang ko`. When more than one is given, `--lang` wins, then the config file, then the environment variable.

The ESLint plugin reads the same `lang` from its settings. Rule names, the layout of the output and the JSON field names are the same in both languages.

## Output

```
Design system: 2 color tokens, 2 components

src/PayButton.tsx
  5:6  error  Use a design system component instead of <button>: Button (./components/ui)  (use-ds-component)
  7:55  error  bg-[#3B82F6] has the same color as --color-primary-500. Use instead: bg-primary-500  (color-use-token)
  8:26  warning  The color of bg-[#3B82F5] is not in the tokens.  (color-unknown)

2 errors, 1 warning (3 files checked)
1 can be replaced right away, 1 to move to a component, 1 needs a person's decision (1 decision)
```

The first line shows how many tokens and components were read from the config. A wrong path shows up here as a zero. If no color token could be read, a line starting with `Note:` explains why. The last line says how many violations can be replaced right away, how many are tags to move to a component, how many need a person's decision, and how many separate questions those come down to.

`--format json` prints the same result as structured data. This example has one violation of each kind, and leaves the rest out.

```json
{
  "designSystem": { "colorTokens": 4, "components": 1, "replacedTags": 1 },
  "problems": [],
  "next": [
    "action \"replace\" (1): replace found with the value in candidates.",
    "action \"migrate\" (1): replace the tag with the component in candidates. Read that component first: add the import, pass on the props it accepts, and drop className values it already applies. If it cannot do what the tag did, ask the user instead.",
    "Before making changes, ask the user about the 2 entries in decisions. Include how often each comes up, the candidates, and the reasons for asking.",
    "After fixing, run the same command again."
  ],
  "summary": { "files": 1, "errors": 4, "warnings": 1 },
  "violations": [
    {
      "file": "src/PayButton.tsx",
      "line": 3,
      "column": 24,
      "endLine": 3,
      "endColumn": 36,
      "rule": "color-use-token",
      "severity": "error",
      "message": "bg-[#3B82F6] has the same color as --color-brand-500. Use instead: bg-brand-500",
      "found": "bg-[#3B82F6]",
      "candidates": ["bg-brand-500"],
      "recommended": "bg-brand-500",
      "action": "replace"
    },
    {
      "file": "src/PayButton.tsx",
      "line": 3,
      "column": 37,
      "endLine": 3,
      "endColumn": 51,
      "rule": "color-use-token",
      "severity": "error",
      "message": "text-[#484646] has the same color as --color-text-primary, --color-neutral-30. Use instead: text-text-primary, text-neutral-30",
      "found": "text-[#484646]",
      "candidates": ["text-text-primary", "text-neutral-30"],
      "recommended": "text-text-primary",
      "action": "ask"
    }
  ],
  "decisions": [
    {
      "id": "decision-1",
      "rule": "color-use-token",
      "subject": "#484646",
      "uses": 2,
      "files": 1,
      "locations": [
        { "file": "src/PayButton.tsx", "line": 3, "column": 37 },
        { "file": "src/PayButton.tsx", "line": 4, "column": 24 }
      ],
      "candidates": ["text-text-primary", "text-neutral-30"],
      "recommended": "text-text-primary",
      "reasons": ["multiple-candidates"]
    },
    {
      "id": "decision-2",
      "rule": "color-unknown",
      "subject": "#3b82f5",
      "uses": 1,
      "files": 1,
      "locations": [{ "file": "src/PayButton.tsx", "line": 4, "column": 39 }],
      "candidates": [],
      "recommended": null,
      "reasons": ["no-token"]
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
| `violations[].recommended` | The candidate that fits how the color is used: a `text-` class gets the token named for text, a border gets the one named for borders. Only set when exactly one candidate fits, and only a suggestion: an `ask` stays an `ask`. For `replace` and `migrate`, it is the candidate. |
| `violations[].action` | How to handle the violation. `replace`: replacing `found` with the only candidate keeps the screen and the behavior the same. Only color errors get this. `migrate`: a raw tag with exactly one design system component to move to. The tool cannot tell whether the component passes on the same props or renders the same default styles, so read the component first, then move the tag's props and drop classes the component already applies. The agent can do this itself, so the hook treats it like `replace`. `ask`: a person has to decide: several candidates, a color with no token, a token whose value differs between themes, or a component whose props are dynamic or spread. `repair`: the file could not be parsed. |
| `decisions` | The `ask` violations grouped into questions: one per color or tag with the same candidates. Each has how often it comes up (`uses`, `files`), up to five `locations`, the `candidates`, a `recommended` candidate when every location agrees, and the `reasons` a person has to decide: `multiple-candidates`, `no-token`, `themed-token`, `class-only-token` or `dynamic-props`. Most used first. |
| `next` | What an agent should do with this result, in order |
| `unchecked` | Colors in other strings that were not checked (`colors`), and how many files they are in (`files`). The text output adds a line when there are any. |

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

`npx designsnitch install` copies the skills into `.claude/skills` for Claude Code, into `.agents/skills` for Codex and Gemini CLI with `--agent codex` or `--agent gemini`, and into `.grok/skills` for Grok Build with `--agent grok`. Run it again after upgrading the package to get the current versions. The skills are in the `skills/` directory of the package if you want to copy them somewhere else.

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

Paths in the settings are resolved from ESLint's working directory. If `designsnitch.config.json` is not next to `eslint.config.js`, as in a monorepo, add the directory the paths are relative to: `settings: { designsnitch: { ...designSystem, root: "apps/web" } }`.

The same set of rules is available as `designsnitch.configs.recommended`. In a project that already has many violations, the error-level rules will make the existing lint step fail, so run `designsnitch check` first to see how many there are. Replacement candidates appear as ESLint suggestions, which editors show as quick fixes. CSS files are checked by the CLI only, not through ESLint.

## Blocking violations

The CLI and the skills put an AI agent in a position to do the right thing. Blocking is done in two other places.

| Where | When it catches a violation | How |
| --- | --- | --- |
| ESLint plugin | In the editor and in the lint step | Errors fail the lint step. Run lint in CI and require it to pass, and nothing with an error can be merged. |
| Agent hook | While the agent is writing code | `designsnitch hook` runs after each edit and before the agent finishes. |

### Agent hook

A skill is advice that an agent may not follow. A hook is run by the agent's runtime every time. `npx designsnitch install` registers it for Claude Code. This is what it adds to `.claude/settings.json`.

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
    ],
    "SessionStart": [
      {
        "hooks": [{ "type": "command", "command": "npx designsnitch hook" }]
      }
    ]
  }
}
```

`designsnitch hook` checks only the files the agent just changed, and blocks only errors the change added.

- It compares each file with its version in git `HEAD`. An error counts as new when there are more of it (the same rule and the same code) than in `HEAD`. Errors that were already there do not block, even if lines moved. A file that is not in `HEAD` yet has only new errors.
- After an edit, if the file has new errors, the agent receives them along with what to do next.
- When the agent is about to finish, it is stopped if new errors remain that it can fix with the same screen and behavior (`replace`, and files that could not be parsed). Errors that need a person's decision (`ask`) do not stop it, because it has to stop in order to ask. Tags to move to a component (`migrate`) do not stop it either: the tool cannot tell whether the component behaves the same, so it reports them after the edit and leaves the call to the agent and the user.
- Errors that were in the working tree before the session started do not count as new, even when they are not committed. The hook notes them when the session starts (`SessionStart`). Without that event, it notes them at the first edit of the session, for every changed file except the one just edited. This needs the session id the agent sends.
- Warnings never block, and files the agent did not touch are left alone.
- Outside a git repository, or before the first commit, every error in the changed files counts.

For Codex, `npx designsnitch install --agent codex` writes the same hooks to `.codex/hooks.json`, with `apply_patch` as the matcher. Codex often edits files with shell commands, which that matcher does not see. Those edits are caught when Codex is about to finish, because the hook then checks every file git reports as changed.

For Gemini CLI, `npx designsnitch install --agent gemini` writes the hooks to `.gemini/settings.json` under Gemini CLI's own event names: `AfterTool` for `write_file` and `replace`, and `AfterAgent` for when it is about to answer, where exit code 2 makes it try again with the errors as feedback. This follows the official Gemini CLI documentation and has not been tested with Gemini CLI.

For Grok Build, `npx designsnitch install --agent grok` writes `.grok/hooks/designsnitch.json` with `PostToolUse` and `Stop`, following the official xAI documentation. It has not been tested with Grok Build, and one point is uncertain: the documentation calls `PreToolUse` the only blocking event and does not say what exit code 2 does after a tool or at the end of a turn. Grok Build may therefore report the errors without stopping the agent. Grok Build also reads Claude Code's `.claude/settings.json`, so with `--agent all` the hook can run twice in Grok Build. That is harmless.

The command reads an optional JSON object from stdin (`tool_input.file_path`, `hook_event_name`, `stop_hook_active`, or the same fields in camelCase as Grok Build sends them), exits with 2 and writes to stderr when it blocks, and falls back to the files git reports as changed when no file is given. Other agents with command hooks that follow these conventions can use it too. The `designsnitch-hooks` skill sets this up.

### Tailwind's default palette

Many projects use Tailwind's default palette (`bg-slate-100`, `text-indigo-600`) as their standard. Set `"palette": "tailwind"` to make it part of the standard.

```json
{ "tokens": "app/globals.css", "palette": "tailwind" }
```

- The palette is read from the `tailwindcss/theme.css` installed in the project, found from the token CSS, so it always matches the installed version. This needs Tailwind CSS v4 (4.0 or later). With v3, or when tailwindcss cannot be found, the check stops and says which. Tested against 4.0.0, 4.1.0, 4.2.0, 4.3.0 and 4.3.5: no color changed value between them, and 4.2.0 added the `mauve`, `olive`, `mist` and `taupe` scales.
- A hex color with the same value as a palette color is an error, with the palette class as its candidate: `bg-[#62748e]` → `bg-slate-500`. Tailwind v4 writes the palette in `oklch()`, and it is converted to hex for the comparison. Palette colors outside sRGB have no hex value that renders the same, so they match only the same `oklch()` value.
- A token in the project's token CSS with the same name as a palette color replaces it, in hex or in `oklch()`, as in Tailwind's own example of overriding a color.
- Namespaces the project clears are left out, as Tailwind documents: `--color-*: initial` removes the whole palette, `--color-lime-*: initial` removes one scale, and `--*: initial` removes the whole default theme.
- `exclude` and `prefer` in `tokens` apply to palette colors too.
- The palette counts as tokens, so a project with no tokens of its own is not reported as having none.

Without `palette`, designsnitch does not flag default palette classes, and does not compare hex colors with them. If the project should use only its own tokens, Tailwind v4 can remove the default palette, and then those classes stop working at all.

```css
@theme {
  --color-*: initial;
  --color-primary-500: #3B82F6;
}
```

## Scope

- **Where it looks in JS and TS:** arbitrary color classes in string literals and template literals, which covers `className` and the arguments of `cn()`, `clsx()` and `cva()`, and colors written as strings in a JSX `style` object, including the branches of `a ? "#fff" : "#000"` and `x || "#fff"`. Comments are ignored. Colors in other strings, such as theme objects and chart options, are not checked: their purpose cannot be told from the code. The check counts them in `unchecked` so that you know they are there, and `designsnitch colors` lists them.
- **Where it looks in CSS:** colors in declaration values and arbitrary color classes in `@apply`, in `.css` files including CSS Modules. In the token CSS, declarations that define a variable (`--name: ...`) are skipped, since that is where tokens are defined. In every other CSS file they are checked like any other declaration. Only colors are checked in CSS for now.
- **Themes:** when a token has different values per theme, all of them count as that token's value. Replacing a color with such a token changes the color in the other themes, so those errors are marked `ask`.
- **Fixes:** designsnitch reports candidates and never rewrites code by itself, even when there is only one candidate.

### Not supported yet

These are detected, but not matched to a token:

- Translucent colors (`#3B82F680`, `rgb(0 0 0 / 50%)`) are reported as colors with no token, even when the opaque color has one.
- Colors a Tailwind plugin adds are not known as tokens, so writing one by hand is reported as a color with no token.
- `hwb()`, `lab()`, `lch()`, `oklab()` and `color()` values, and `oklch()` colors outside sRGB, match only a token written with the same value: no hex color renders the same.
- Color names are read in color properties (`color`, `background`, `border`, ...), in arbitrary classes (`bg-[white]`), and as a whole custom property value. Elsewhere a word such as `red` is not taken for a color.

These are not checked:

- Values from Tailwind's default theme other than the color palette
- The nearest token for a color that has none
- Style objects outside a JSX `style` attribute, such as `const style = { color: "#fff" }`
- SCSS and other preprocessors
- Spacing, font size and radius. They were left out of this version on purpose.
- Comparing a hand-made component's styles with the design system component
- Installing the hook for agents other than Claude Code, Codex, Gemini CLI and Grok Build

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
