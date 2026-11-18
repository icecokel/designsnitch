---
name: designsnitch-eslint
description: Add the designsnitch rules to a project's ESLint flat config so design system violations show up in the editor and in the existing lint step. Use when the user asks to enforce the design system through ESLint or lint, or after designsnitch has been set up in a project that uses ESLint.
---

# designsnitch-eslint

The rules that `designsnitch check` runs can also run inside the project's own ESLint. Then violations show up in the editor while typing, and in the lint step people already run.

## 1. Check that it applies

Do this only when all of these hold.

- The project uses ESLint with a flat config (`eslint.config.js`, `.mjs` or `.ts`). If the project has no ESLint, do not install it for this: the CLI is enough. If it uses a legacy `.eslintrc`, leave it alone and tell the user the rules need a flat config.
- `designsnitch.config.json` exists. If it does not, follow the `designsnitch-setup` skill first.
- `designsnitch` is installed in the project (`npm install --save-dev designsnitch`).
- The ESLint config does not already have `designsnitch/` rules.

## 2. Count the existing violations

```sh
npx designsnitch check --format json
```

Look at `summary.errors`. Error-level rules make the project's lint step fail on every existing violation. If there are existing errors, tell the user how many and ask before adding the rules.

## 3. Add the rules

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
      "designsnitch/scale-use-token": "error",
      "designsnitch/use-ds-component": "error",
      // warn: the value is not in the design system, so a person has to decide
      "designsnitch/color-unknown": "warn",
      "designsnitch/scale-unknown": "warn",
    },
  },
];
```

Keep these severities. They follow one rule: it is an error when the design system already has the answer, and a warning when it does not. If the user wants a softer start, that is their decision to make.

## 4. Verify

Run the project's lint command and confirm that the `designsnitch/` rules report the same violations as `npx designsnitch check`.

## What not to do

- Do not lower an error to a warning, or turn a rule off, to make lint pass.
- Do not remove or rewrite the project's existing ESLint config.
- Do not convert a legacy `.eslintrc` to a flat config as part of this.
