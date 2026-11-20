---
name: designsnitch-setup
description: Set up designsnitch in a React/Next.js + Tailwind project. Finds the token CSS and the shared component directory in the codebase, writes designsnitch.config.json, and wires the rules into ESLint. Use when `designsnitch check` reports that the config file is missing, or when the user asks to set up designsnitch in a project.
---

# designsnitch-setup

designsnitch needs to know where the project's design system lives. Read the codebase, write that down in `designsnitch.config.json`, and then make the ESLint plugin use it. The CLI and the plugin read the same file.

Only create the file when it is missing. If it already exists and seems wrong, explain why and ask the user before changing it: this file is the standard the code is judged against.

## 0. Check that the project is supported, and install the package

designsnitch supports React or Next.js projects that use Tailwind CSS v4. Look at `package.json` and the global CSS file.

- Tailwind v4 has `tailwindcss` version 4 in `package.json` and `@import "tailwindcss"` in a CSS file.
- If the project uses Tailwind v3 (a `tailwind.config.js` with a `theme` section and no `@theme` in CSS), or does not use Tailwind or React at all, stop and tell the user that designsnitch does not support it yet.

Then make sure the package is a dependency of the project. The commands below and the agent hook both run `npx designsnitch`, which should use the project's own copy.

```sh
npm install --save-dev designsnitch
```

## 1. Find the token CSS

It is the CSS file with an `@theme` block or `--color-*` variables, usually `app/globals.css` or `src/app/globals.css`. If you cannot tell which CSS file is the right one, ask the user.

designsnitch reads a variable as a color token only when its name starts with `--color-` and its value is a hex color or a `var()` that leads to one. Two cases need a decision before you go on.

**The project has no color variables at all.** There are no color tokens yet. Follow the `designsnitch-palette` skill to create them from the colors the code already uses, then continue here.

**The project has color variables under other names**, such as `--ink` or `--brand` in `:root`. These are the project's tokens, but designsnitch cannot see them. Do not create a second set of tokens next to them. Propose to the user that the existing variables be exposed as tokens by referencing them from `@theme`:

```css
@theme {
  --color-ink: var(--ink);
  --color-brand: var(--brand);
}
```

Tell the user what this changes: the values stay where they are, Tailwind gains classes such as `text-ink` and `bg-brand`, and designsnitch can then tell when code writes those colors by hand. This edits the token CSS, so make the change only after the user agrees.

## 2. Find the shared component directory

It is where basic UI components such as buttons and inputs live, usually `components/ui`.

If the project has no such directory, leave `components` out of the config. The component check is then skipped.

## 3. List the raw tags each component replaces

Read the files in that directory and find the components whose root element is a raw tag such as `button`, `input`, `select`, `textarea` or `dialog`. Use the exported component names. If several components replace the same tag, list them all.

Leave out components that only happen to contain a raw tag deep inside, such as a modal that has a close button. List the components a developer should reach for instead of writing the tag.

Check which variants of the tag each component covers. An `Input` built for text fields does not replace `<input type="file">`, `<input type="range">` or a checkbox. When a component covers only some variants, write it with `when`, listing the attribute values it covers (`null` means the attribute is absent). Read the component's props and its root element to decide. If you cannot tell, leave `when` out and tell the user which variants you were unsure about.

```json
"input": { "component": "Input", "when": { "type": ["text", "email", "password", null] } }
```

## 4. Write the file

```json
{
  "tokens": "./src/app/globals.css",
  "components": {
    "path": "./src/components/ui",
    "replaces": {
      "button": ["SolidButton", "GlassButton", "IconButton"],
      "input": { "component": "Input", "when": { "type": ["text", "email", "password", null] } }
    }
  }
}
```

Paths are relative to the project root.

Messages are in English by default. If the user works in Korean, add `"lang": "ko"` to the file so that the CLI, the ESLint plugin and the hook speak Korean.

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
- Do not edit the token CSS without the user's agreement.
- Do not change an existing config file without asking.
- Do not start fixing violations as part of setup.
