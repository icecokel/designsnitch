---
name: designsnitch-check
description: After creating or editing UI code in a React/Next.js + Tailwind project, check it against the project's design system (color tokens and shared components) and fix what is off. Use when you have changed components, pages, className values or styles, or when the user asks for a design system check or cleanup.
---

# designsnitch-check

After you change UI code, run the design system check before you finish. The CLI makes the verdicts and tells you what to do with each one. This document covers how to act on that, and how to ask the user when a decision is theirs.

## 1. Run the check

Pass the files you changed. Without paths, the whole project is checked.

```sh
npx designsnitch check src/features/checkout/PayButton.tsx --format json
```

The exit code is 0 (no errors), 1 (errors found), or 2 (could not run). On 2, read the message on stderr.

- The config file `designsnitch.config.json` is missing: follow the `designsnitch-setup` skill first, then come back.
- The token CSS could not be read: the message names the file, line and column. Fix that syntax error first. Nothing can be judged while the standard itself is broken.

## 2. Read the result

```json
{
  "designSystem": { "colorTokens": 175, "components": 4, "replacedTags": 2 },
  "problems": [],
  "next": [
    "action \"replace\" (1): run npx designsnitch check --fix, which replaces found with the candidate. Add paths to fix only those files.",
    "Before making changes, ask the user about the 1 entry in decisions. Include how often each comes up, the candidates, and the reasons for asking.",
    "After fixing, run the same command again."
  ],
  "summary": { "files": 2, "errors": 3, "warnings": 0 },
  "violations": [
    {
      "file": "src/features/checkout/PayButton.tsx",
      "line": 7,
      "column": 28,
      "endLine": 7,
      "endColumn": 40,
      "rule": "color-use-token",
      "severity": "error",
      "message": "bg-[#3B82F6] has the same color as --color-primary-500. Use instead: bg-primary-500",
      "found": "bg-[#3B82F6]",
      "candidates": ["bg-primary-500"],
      "recommended": "bg-primary-500",
      "action": "replace"
    }
  ],
  "decisions": [
    {
      "id": "decision-1",
      "rule": "color-use-token",
      "subject": "#484646",
      "uses": 2,
      "files": 2,
      "locations": [
        { "file": "src/features/checkout/PayButton.tsx", "line": 9, "column": 14 },
        { "file": "src/features/checkout/Summary.tsx", "line": 4, "column": 20 }
      ],
      "candidates": ["text-text-primary", "text-neutral-30"],
      "recommended": "text-text-primary",
      "reasons": ["multiple-candidates"]
    }
  ]
}
```

- `next` lists what to do, in order. `next` and `message` are sentences, in English or in Korean depending on the project's `lang` setting. The fields below carry the same information, so you never need to parse them.
- `action` says how to handle each violation. Section 3 covers each value.
- `found` is the offending piece of code. `candidates` lists what to use instead: classes or components in JS and TS files, and `var(--token)` in inline styles and `.css` files. In a Tailwind v3 project, which has no CSS variables for its colors, the candidate in a `.css` file is `theme("colors.token")`: Tailwind turns it into the same value when it builds the CSS.
- `recommended` is the candidate whose token is named for how the color is used here, such as the text token for a `text-` class. It is a suggestion to put in front of the user, not permission to replace.
- `decisions` groups every `ask` violation into questions: one per color or tag with the same candidates, most used first. Each has `uses`, `files`, up to five `locations`, the `candidates`, a `recommended` candidate when all locations agree, and `reasons` (`multiple-candidates`, `no-token`, `themed-token`, `translucent`, `not-a-style`, `class-only-token`, `dynamic-props`, `unit-conversion`, `line-height`). `unit-conversion` means the value equals the token only after converting px and rem, which differs when the browser font size is not 16px. `line-height` means a font size class may also set the line height, so the text can move. `no-class` means the token is declared outside `@theme`, so Tailwind has no class named after it: the candidate points at the variable (`bg-(--color-brand)`), and the other choice is to move the token into `@theme`. Ask the user which. Ask the user about decisions, not about single violations.
- `unchecked` counts colors in other strings, such as theme objects and chart options, that the check could not judge. They are not violations. If the count is large and those strings feed the UI, mention it to the user: `npx designsnitch colors` lists them.
- `designSystem` counts the tokens and components read from the config. `paletteColors` is the number of Tailwind default palette colors in the standard, when the config has `"palette": "tailwind"`. `colorTokens` 0 means the project has no color tokens that can be read: follow the `designsnitch-palette` skill to establish them before touching any color.
- A non-empty `problems` means the config is broken and the results cannot be trusted. Tell the user before fixing anything.

| `rule` | Severity | Meaning |
| --- | --- | --- |
| `color-use-token` | error | A color that has a token was written by hand (hex, a color function such as `rgb()`, or a color name such as `white`): as an arbitrary value, in an inline style, in a CSS declaration or in `@apply`. |
| `color-unknown` | warning | A color written by hand with no matching token. |
| `use-ds-component` | error | A raw tag was used outside the design system directory although a shared component replaces it. |
| `radius-use-token` | error | A radius that a `--radius-*` token has was written by hand (`rounded-[12px]`, `borderRadius: 12`, `border-radius: 12px`). |
| `radius-unknown` | warning | A radius written by hand that no token has. |
| `font-size-use-token` | error | A font size that a `--text-*` token has was written by hand (`text-[14px]`, `fontSize`, `font-size`). |
| `font-size-unknown` | warning | A font size written by hand that no token has. |
| `parse-error` | error | The file could not be parsed. |

## 3. Act on each violation

| `action` | What it means | What to do |
| --- | --- | --- |
| `replace` | A color, radius or font size error whose only candidate keeps the screen and the behavior the same. | Run `npx designsnitch check --fix` (add paths to limit it to the files you are working on). It replaces every `replace` violation and reports what is left. Do not replace them one by one by hand. |
| `migrate` | A raw tag with exactly one design system component to move to. Whether the component behaves like the tag is not known. | Read the component, then move the tag to it as described below. If the component does not cover this use, leave the tag and ask the user as described below. The hook does not force this one. |
| `ask` | A person has to decide: several candidates, a color that has no token, a token whose value differs between themes, a translucent color (the candidate rounds its opacity), a color in a property that is not a style (such as chart options, where `var()` may not work: read how the value is used before replacing), a token that exists only as a class (no CSS variable to use in a style or a CSS declaration), or a component whose props are dynamic or spread. `message` says which. | Do not change it. Ask the user as described in section 4. |
| `repair` | The file could not be parsed. | Fix the syntax error, then check again. |

For `migrate`, replacing means more than renaming the tag. Read the design system component file to learn its props, add the import, pass on the tag's props the component accepts, and remove className values that duplicate styles the component already has. Check that event handlers such as `onClick` and attributes such as `type` still reach the rendered element.

Often the component does not cover the use: it cannot pass on something the tag needs, or moving to it would change how the element looks, such as a text-sized `Button` for a small square icon button. Then there are three ways out, and choosing between them is the user's call, because two of them change the standard.

- Extend the component: a new variant, size or prop. This changes a shared component that other screens use.
- Narrow the rule: a `when` condition in `designsnitch.config.json`, so that this kind of tag is no longer expected to use the component.
- Keep this tag as an exception, with a disable comment that says why.

Leave the tag as it is, and ask. Say what the component lacks, show the place, and recommend one of the three. Do not add a variant to a design system component on your own to make the check pass, even when the result would look the same.

## 4. Ask so the user can decide

Deciding is the user's job. Your job is to make the decision easy. Do not hand over a bare list of violations. Take the questions from `decisions`, most used first. For each one, give:

1. **What has to be decided**, in one sentence.
2. **The facts.** `uses`, `files` and `locations` say how often and where. For a color, run `npx designsnitch colors --format json` to see what it is used for (text, background, border) and which tokens are close to it. Open one or two of the locations if the use is unclear.
3. **What each choice changes.** Say whether the screen will look different, and how many places would be edited.
4. **Your recommendation and why.** Start from `recommended` when it is set, and say why it fits.

`decisions` already groups the same question. Thirty uses of one unknown color are one decision, not thirty.

If many decisions are the same choice between two token families, for example `--color-brand-500` and `--color-blue-500` every time, the config can settle it once. Tell the user that `prefer` in the `tokens` setting of `designsnitch.config.json` would pick the family, and ask before changing the config.

If most decisions are `no-token`, the project is missing tokens rather than making mistakes. Suggest the `designsnitch-palette` skill instead of asking about each color.

An example for an error with several candidates:

> `text-[#484646]` matches two tokens: `--color-text-primary` and `--color-neutral-30`. It appears 137 times, almost always as body text (`text-`). Either token renders the same color today, so nothing changes on screen. They will diverge if the neutral scale is ever retuned. I recommend `text-text-primary`, because the use is text and that token is named for it. Shall I replace all 137?

An example for a color with no token:

> `#3B82F5` is used 3 times, all as a button background. It is one step away from `--color-primary-500` (`#3B82F6`), which is used 88 times, so it is probably a typo. Replacing it changes the color by an amount the eye cannot see. I recommend replacing the 3 with `bg-primary-500`. If it is a separate color on purpose, it needs its own token.

## 5. Check again

After fixing, run the same command again. Stop when the only items left are waiting on the user's decision.

## 6. Report

Report what you fixed and what you left, separately. For what you left, use the form from section 4.

## What not to do

- Do not edit `designsnitch.config.json`, the token CSS or the design system components to make the check pass. They are the standard the code is judged against. If one of them seems wrong or incomplete, explain why and ask the user.
- Do not add `eslint-disable` or `designsnitch-disable-next-line` comments, lower a rule's severity, or turn a rule off to make the check pass. If an exception seems necessary, ask the user.
- Do not pick one of several candidates on your own.
- Do not change how the tokens are declared, such as turning `@theme` into `@theme static`, to make a `var(--token)` candidate work. Tailwind outputs a theme variable as soon as a class, a style or a CSS file uses it. A variable missing from the compiled CSS before the replacement is expected.
