---
name: designsnitch-palette
description: Create color tokens for a React/Next.js + Tailwind project that has none or too few, based on the colors its code already uses. Use when a project has no color tokens or palette, when `designsnitch check` reports that no color token could be read, when most colors in the code have no token (many color-unknown warnings), or when the user asks to derive a color palette or color tokens from existing code.
---

# designsnitch-palette

Some projects have no color tokens: colors are written straight into the code as `bg-[#3B82F6]`, `text-gray-700` or `style={{ color: "#3B82F6" }}`. designsnitch has nothing to check such code against. Others have a few tokens, while most colors in the code have none, and every one of those is a warning. This skill turns the colors the code already uses into a set of tokens, or fills the gaps next to the tokens that exist.

The CLI collects the colors. You analyze them and propose tokens. The user decides. Nothing is written before the user approves, because the tokens become the standard all UI code is judged against.

## 1. Collect the colors

```sh
npx designsnitch colors --format json
```

This works without a config file. Pass paths to limit it to part of the project.

```json
{
  "summary": { "files": 420, "colors": 215, "paletteColors": 12, "uses": 1999 },
  "colors": [
    {
      "color": "#484646",
      "uses": 176,
      "files": 53,
      "utilities": { "text": 137, "border": 7 },
      "literals": 32,
      "properties": { "color": 4 },
      "examples": [{ "file": "src/app/page.tsx", "line": 12 }]
    }
  ],
  "palette": [
    {
      "name": "gray-700",
      "uses": 14,
      "files": 6,
      "utilities": { "text": 14 },
      "examples": [{ "file": "src/app/page.tsx", "line": 30 }]
    }
  ]
}
```

- `colors` are hex colors, most used first. `utilities` counts uses per Tailwind utility (`bg-[#484646]` counts under `bg`). `literals` counts strings that are a hex color on their own, such as inline styles and chart options. `properties` counts uses per CSS property in `.css` files.
- `palette` are colors from Tailwind's default palette used by name, such as `text-gray-700`.
- `examples` gives a few locations, each in a different file. Open them when you need to see how a color is used.
- If a config file exists, each color also has `tokens`: the tokens that already have this value. Colors with a non-empty `tokens` are already covered. Work on the rest. A color one step away from an existing token is a near duplicate of that token (see below), not a new color.

## 2. Analyze

Go through `colors` from the top and sort each color into one of these.

**A color of its own.** It is used often and nothing close to it is used more. It gets a token.

**A near duplicate.** Its value is almost the same as a more used color, a few steps apart in one or two channels, such as `#3B82F5` next to `#3B82F6`. These are usually the same intended color written from memory. Group it under the more used color. Do not decide the merge yourself: merging changes what is rendered.

**The long tail.** It is used once or twice. Do not give it a token by default. List these for the user.

**A scattered palette.** Sometimes most colors are long tail: dozens of grays, each used once or twice and each a little different, such as `#929b93`, `#8e978f` and `#919a92`. This is common in code an AI wrote one screen at a time. Proposing tokens only for the few colors used most covers almost nothing. Group the colors instead: put colors that look the same at a glance in one group, and treat each group as one color with the summed uses. If an existing token sits in a group, the group belongs to that token. Then sort the groups as above. Tell the user that merging a group changes what is rendered by a small amount, show the spread of each group (its lightest and darkest value), and let them decide group by group.

Then work out what each color of its own is for. `utilities` and `properties` show this.

| Mostly used with | Likely role |
| --- | --- |
| `text`, or the `color` property | Text color |
| `border`, `divide`, `ring`, `outline`, or `border` properties | Border or outline |
| `bg`, or `background` properties | Background or surface |
| A mix, or mostly `literals` | A general color such as a brand or chart color. Open the examples to see. |

For `palette`, note which default palette colors the project relies on. If they carry most of the color uses, the default palette is the project's standard already. Do not copy palette colors into new hex tokens: that changes nothing on screen and doubles the names. Propose `"palette": "tailwind"` in `designsnitch.config.json` instead, and limit new tokens to colors outside the palette. If the palette is a minor part, whether it belongs to the design system is the user's call, so include it in the proposal as a question.

## 3. Propose

Show the user a proposal before writing anything.

| Token | Value | Uses | Role | Would absorb |
| --- | --- | --- | --- | --- |
| `--color-text-primary` | `#484646` | 176 | Body text | `#484645` (3 uses) |
| `--color-border-default` | `#e2e1e5` | 79 | Borders | |

Naming:

- If the project already has tokens, CSS variables or a naming habit, follow it. New tokens sit next to the existing ones and use the same pattern.
- Otherwise name a color by its role when it has a clear one (`--color-text-primary`, `--color-border-default`, `--color-surface`), and by a scale when it is a general color (`--color-primary-500`, `--color-neutral-200`).
- Every token starts with `--color-`. Tailwind turns `--color-text-primary` into classes such as `text-text-primary` and `bg-text-primary`.
- Do not reuse a name from Tailwind's default palette, such as `--color-blue-500`, unless the user wants to override that color.

With the table, tell the user:

- How much the proposed tokens cover: the share of all uses, for example "12 tokens cover 81% of uses". If the share is small, say why, and check whether the colors are scattered (see above) before handing over a proposal that covers little.
- The near duplicates you want to merge, each with both values and their use counts.
- The long tail you left out.
- The default palette colors in use, and the question of whether to keep them.

Ask the user to confirm or change the names, the merges and what to leave out. Keep the set small. A palette with a token for every color in the code is not a palette.

## 4. Write the tokens

After the user approves, add the tokens to the CSS file that imports Tailwind (`@import "tailwindcss"`), inside `@theme`. Add to the existing `@theme` block if there is one.

```css
@theme {
  --color-text-primary: #484646;
  --color-border-default: #e2e1e5;
}
```

Write the values as hex. designsnitch reads hex values and `var()` references to hex values, and nothing else.

If the project uses Tailwind v3 (a `tailwind.config.js` and no `@theme`), stop and tell the user: designsnitch does not read v3 config yet.

## 5. Point the config at the tokens

`designsnitch.config.json` must have `tokens` set to that CSS file. If the config file does not exist, follow the `designsnitch-setup` skill.

## 6. Verify

```sh
npx designsnitch check --format json
npx designsnitch colors
```

- `designSystem.colorTokens` in the check result should equal the number of tokens you wrote, and `problems` should be empty.
- In the `colors` output, each color you made a token for should now list that token.

## 7. Hand over

Tell the user what the first check found. Every place that writes a tokenized color as a hex class or in a CSS declaration is now a `color-use-token` error, with the token class or `var(--token)` as its candidate. Replacing them is the job of the `designsnitch-check` skill. On a whole project this can be a large change, so ask the user whether to do it now and for which part of the project.

Two kinds of use stay as they are:

- Near duplicates the user chose to merge still have their old value in the code. They show up as `color-unknown` warnings. Replacing them changes what is rendered, so do it only for the merges the user approved.
- Hex colors in strings other than classes and inline styles, such as theme objects, and default palette classes are not flagged by the check. The check counts the former in `unchecked`.

## What not to do

- Do not write tokens before the user approves the proposal.
- Do not invent colors that are not in the code, and do not adjust values to make a tidier scale.
- Do not merge near duplicates or drop colors on your own.
- Do not rename or remove tokens that already exist.
