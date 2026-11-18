---
name: designsnitch-check
description: After creating or editing UI code in a React/Next.js + Tailwind project, check it against the project's design system (tokens and shared components) and fix what is off. Use when you have changed components, pages, className values or styles, or when the user asks for a design system check.
---

# designsnitch-check

After you change UI code, run the design system check before you finish. The CLI makes the verdicts. This document tells you when to run it and what to do with the results.

## 1. Run the check

Pass the files you changed. Without paths, the whole project is checked.

```sh
npx designsnitch check src/features/checkout/PayButton.tsx --format json
```

The exit code is 0 (no errors), 1 (errors found), or 2 (could not run). On 2, read the message on stderr. If the config file `designsnitch.config.json` is missing, follow the `designsnitch-setup` skill first, then come back.

## 2. Read the result

```json
{
  "designSystem": {
    "colorTokens": 175,
    "radiusTokens": 4,
    "textTokens": 0,
    "components": 4,
    "replacedTags": 2
  },
  "problems": [],
  "summary": { "files": 1, "errors": 2, "warnings": 1 },
  "violations": [
    {
      "file": "src/features/checkout/PayButton.tsx",
      "line": 7,
      "column": 28,
      "endLine": 7,
      "endColumn": 40,
      "rule": "color-use-token",
      "severity": "error",
      "message": "bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500",
      "found": "bg-[#3B82F6]",
      "candidates": ["bg-primary-500"]
    }
  ]
}
```

- `designSystem` counts the tokens and components read from the config.
- A non-empty `problems` means the config is broken and the results cannot be trusted. Tell the user before fixing any violation. If the problem is that no color token could be read and the project really has no color tokens, the `designsnitch-palette` skill covers creating them.
- `found` is the offending piece of code. `candidates` lists the classes or components to use instead.
- `severity` `error` means the design system has something for this and it was not used. `warning` means the value is not in the design system.
- `message` is written in Korean. You do not need to parse it: `rule`, `found` and `candidates` carry the same information.

| `rule` | Severity | Meaning |
| --- | --- | --- |
| `color-use-token` | error | A hex color that has a token was written as an arbitrary value. |
| `color-unknown` | warning | A hex color with no matching token. |
| `scale-use-token` | error | A spacing, font size or radius value that is on the scale was written as an arbitrary value. |
| `scale-unknown` | warning | A spacing, font size or radius value that is not on the scale. `candidates` holds the nearest values. |
| `use-ds-component` | error | A raw tag was used outside the design system directory although a shared component replaces it. |
| `parse-error` | error | The file could not be parsed. |

## 3. Fix

Fix only the violations whose replacement is certain.

| Situation | What to do |
| --- | --- |
| `error` with exactly one candidate | Replace `found` with that candidate. |
| `error` with two or more candidates | Do not change it. Show the user the candidates and where the code is used (the background of what, the text color of what) and let them choose. |
| `warning` | Do not change it. Whether a new value is really needed or it is a mistake is the user's call. Show the nearest candidates if there are any. |
| `rule` is `parse-error` | Fix the syntax error first, then check again. |

For `use-ds-component`, renaming the tag is not enough. Read the design system component file to learn its props, add the import, and remove className values that duplicate styles the component already has.

## 4. Check again

After fixing, run the same command again. Stop when the only items left are waiting on the user's decision.

## 5. Report

Report what you fixed and what you left, separately. For each item you left, give the file and line, the candidates, and why you left it.

## What not to do

- Do not edit `designsnitch.config.json` or the token CSS to make the check pass. They are the standard the code is judged against. If one of them seems wrong, explain why and ask the user.
- Do not add `eslint-disable` comments, lower a rule's severity, or turn a rule off to make the check pass. If an exception seems necessary, ask the user.
- Do not pick one of several candidates on your own.
