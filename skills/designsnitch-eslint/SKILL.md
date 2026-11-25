---
name: designsnitch-eslint
description: Put the designsnitch rules into a project's ESLint so design system violations are reported as errors and warnings in the editor and in the lint step. Installs ESLint when the project has none. Use as the last step of setting up designsnitch, or when the user asks to enforce the design system through ESLint or lint.
---

# designsnitch-eslint

The ESLint plugin is how designsnitch blocks and warns. `designsnitch check` tells an AI agent what to fix. The plugin is what makes a violation show up in the editor and fail the lint step. Setting up designsnitch is not finished until the rules run in ESLint.

`designsnitch.config.json` must exist first. If it does not, follow the `designsnitch-setup` skill.

## 1. Find out what the project has

| The project has | Do |
| --- | --- |
| A flat config (`eslint.config.js`, `.mjs` or `.ts`) that already has `designsnitch/` rules | Nothing. Go to step 5 and verify. |
| A flat config without `designsnitch/` rules | Step 3A |
| No ESLint at all | Step 3B |
| oxlint instead of ESLint (`.oxlintrc.json` or `oxlint.config.ts`) | Step 3C |
| A legacy config (`.eslintrc*`) | Stop. Tell the user the rules need a flat config and that converting the project's config is their decision. |

## 2. Count the existing violations

```sh
npx designsnitch check --format json
```

Look at `summary.errors`. Error-level rules make the lint step fail on every existing violation.

If there are existing errors, ask the user before adding the rules. Give them what they need to decide:

- How many errors there are, by rule, and in how many files.
- What happens if the rules are added now: the lint step fails until those are fixed.
- How many of the errors have exactly one candidate, since those can be fixed mechanically with the `designsnitch-check` skill.
- Your recommendation. Usually: fix the mechanical ones first, then add the rules.

## 3A. Add the rules to an existing config

Install the package if it is not a dependency yet.

```sh
npm install --save-dev designsnitch
```

Add one entry to the end of the exported array. Keep everything that is already there.

```js
// eslint.config.js
import designsnitch from "designsnitch";
import designSystem from "./designsnitch.config.json" with { type: "json" };

export default [
  // ...the project's existing config stays as it is
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { designsnitch },
    // Reuse the CLI's config so the standard is written in one place.
    settings: { designsnitch: designSystem },
    rules: {
      // error: the design system has a token or component for this, and it was not used
      "designsnitch/color-use-token": "error",
      "designsnitch/use-ds-component": "error",
      // warn: the color is not in the design system, so a person has to decide
      "designsnitch/color-unknown": "warn",
    },
  },
];
```

## 3B. Install ESLint when the project has none

```sh
npm install --save-dev eslint typescript-eslint designsnitch
```

Create `eslint.config.js` with only what designsnitch needs. Do not add other rule sets: which other lint rules the project wants is not yours to decide.

```js
// eslint.config.js
import designsnitch from "designsnitch";
import tseslint from "typescript-eslint";
import designSystem from "./designsnitch.config.json" with { type: "json" };

export default [
  { ignores: ["node_modules/**", ".next/**", "dist/**", "build/**", "out/**", "coverage/**"] },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { designsnitch },
    settings: { designsnitch: designSystem },
    rules: {
      "designsnitch/color-use-token": "error",
      "designsnitch/use-ds-component": "error",
      "designsnitch/color-unknown": "warn",
    },
  },
];
```

Paths in `designsnitch.config.json` are relative to the config file. ESLint resolves them from its own working directory, so this works when both files sit in the project root. If the config file is somewhere else, as in a monorepo where ESLint runs from the repository root, add the directory the paths are relative to: `settings: { designsnitch: { ...designSystem, root: "apps/web" } }`. The same applies to 3A.

If `package.json` has `"type": "module"`, name the file `eslint.config.js`. Otherwise name it `eslint.config.mjs`.

Add a lint script if the project has none.

```json
{ "scripts": { "lint": "eslint ." } }
```

## 3C. Add the rules to oxlint

oxlint runs the same plugin as a JS plugin. Install the package (`npm install --save-dev designsnitch`) and merge this into `.oxlintrc.json`, keeping what is already there.

```json
{
  "jsPlugins": ["designsnitch"],
  "rules": {
    "designsnitch/color-use-token": "error",
    "designsnitch/use-ds-component": "error",
    "designsnitch/color-unknown": "warn"
  }
}
```

Do not add `settings`: without `settings.designsnitch`, the plugin reads `designsnitch.config.json` from the working directory. Tell the user that oxlint calls JS plugins alpha, and that `oxlint --fix-suggestions` must not be used with these rules, because it applies the first candidate even where a person has to choose.

## 4. Keep the severities

They follow one rule: it is an error when the design system already has the answer, and a warning when it does not. Errors block. Warnings ask a person to decide. If the user wants a softer start, that is their decision to make.

## 5. Verify

Run the project's lint command.

- The `designsnitch/` rules should report the same violations in JS and TS files as `npx designsnitch check`.
- CSS files are checked by the CLI only. Violations in `.css` files will not appear in the lint output.

Tell the user what was installed and changed, and how many errors and warnings the lint step reports now.

## What not to do

- Do not lower an error to a warning, or turn a rule off, to make lint pass.
- Do not remove or rewrite the project's existing ESLint config.
- Do not convert a legacy `.eslintrc` to a flat config as part of this.
- Do not add lint rules other than the `designsnitch/` ones.
