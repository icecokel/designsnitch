---
name: designsnitch-setup
description: Create designsnitch.config.json for a React/Next.js + Tailwind project by finding its token CSS and shared component directory. Use when `designsnitch check` reports that the config file is missing, or when the user asks to set up designsnitch in a project.
---

# designsnitch-setup

`designsnitch check` needs `designsnitch.config.json` in the project root. It tells the CLI where the design system lives. Read the repository and write this file.

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

## 6. Show the user

Show the config file and say which CSS file and directory you chose, along with the counts from `designSystem` and the number of errors and warnings the first check found.

If the project uses ESLint, mention that the `designsnitch-eslint` skill can add the same rules to it.

## What not to do

- Do not guess paths or component names you could not find in the repository.
- Do not change an existing config file without asking.
- Do not start fixing violations as part of setup.
