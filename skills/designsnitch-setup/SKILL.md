---
name: designsnitch-setup
description: Set up designsnitch in a React/Next.js + Tailwind project. Finds the token CSS and the shared component directory in the codebase, writes designsnitch.config.json, and wires the rules into ESLint. Use when `designsnitch check` reports that the config file is missing, or when the user asks to set up designsnitch in a project.
---

# designsnitch-setup

designsnitch needs to know where the project's design system lives. Read the codebase, write that down in `designsnitch.config.json`, and then make the ESLint plugin use it. The CLI and the plugin read the same file.

Only create the file when it is missing. If it already exists and seems wrong, explain why and ask the user before changing it: this file is the standard the code is judged against.

## 1. Find the token CSS

It is the CSS file with an `@theme` block or `--color-*` variables, usually `app/globals.css` or `src/app/globals.css`.

If no CSS file defines `--color-*` variables, the project has no color tokens yet. Follow the `designsnitch-palette` skill to create them from the colors the code already uses, then continue here. If you cannot tell which CSS file is the right one, ask the user.

## 2. Find the shared component directory

It is where basic UI components such as buttons and inputs live, usually `components/ui`.

If the project has no such directory, leave `components` out of the config. The component check is then skipped.

## 3. List the raw tags each component replaces

Read the files in that directory and find the components whose root element is a raw tag such as `button`, `input`, `select`, `textarea` or `dialog`. Use the exported component names. If several components replace the same tag, list them all.

Leave out components that only happen to contain a raw tag deep inside, such as a modal that has a close button. List the components a developer should reach for instead of writing the tag.

## 4. Write the file

```json
{
  "tokens": "./src/app/globals.css",
  "components": {
    "path": "./src/components/ui",
    "replaces": {
      "button": ["SolidButton", "GlassButton", "IconButton"],
      "input": "Input"
    }
  }
}
```

Paths are relative to the project root.

## 5. Verify

```sh
npx designsnitch check --format json
```

Look at `designSystem` and `problems` in the result.

- `designSystem.colorTokens` should match the number of `--color-*` tokens in the CSS. A 0 means the path is wrong or the tokens are in a format that cannot be read (only hex values and `var()` references to hex values are read).
- `designSystem.components` should match the number of components you listed.
- `problems` should be empty.
- Exit code 2 with a message about a missing path means a path in the config is wrong.

Fix the config until these hold. Ignore the violations for now: fixing them is the job of the `designsnitch-check` skill.

## 6. Wire the ESLint plugin

Follow the `designsnitch-eslint` skill now. It puts the rules into the project's ESLint, and installs ESLint if the project has none. Setup is not finished until this is done: the config file alone does not block anything.

## 7. Register the agent hook

Follow the `designsnitch-hooks` skill. The hook tells the coding agent about errors right after it edits a file, and keeps it from finishing while errors it can fix remain. The ESLint plugin blocks at lint time. The hook blocks while the code is being written.

## 8. Show the user

Show the config file and say which CSS file and directory you chose, and why. Give the counts from `designSystem`, the number of errors and warnings the first check found, and what was added to ESLint and to the agent's hooks.

If you were unsure about a choice, say so and give the alternative. For example, if two directories both look like the shared component directory, name both and say why you picked one.

## What not to do

- Do not guess paths or component names you could not find in the repository.
- Do not change an existing config file without asking.
- Do not start fixing violations as part of setup.
