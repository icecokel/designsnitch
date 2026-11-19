---
name: designsnitch-hooks
description: Register designsnitch as a hook of the coding agent (Claude Code, Codex, Gemini CLI or Grok Build), so the agent is told about design system errors right after it edits a file and cannot finish while errors it can fix remain. Use as part of setting up designsnitch, or when the user asks to make AI-written code follow the design system automatically.
---

# designsnitch-hooks

A skill is advice: an agent may or may not follow it. A hook is run by the agent's own runtime, so it happens every time. This skill registers `designsnitch hook` as a hook, which makes the design system check part of how the agent works in this project.

`designsnitch.config.json` must exist first. If it does not, follow the `designsnitch-setup` skill. Without a config file the hook does nothing.

## What the hook does

`npx designsnitch hook` checks only the files the agent just changed.

| When it runs | What happens |
| --- | --- |
| Right after the agent edits a file | If that file has errors, the agent receives them with what to do next. |
| When the agent is about to finish | If errors the agent can fix itself remain in the changed files, the agent is not allowed to finish. |

- Warnings never block.
- Errors that need a person's decision (`ask`) are reported after an edit, but do not stop the agent from finishing. The agent has to stop in order to ask.
- Violations that were already in files the agent did not touch are left alone.

## 1. Register the hook in Claude Code

Run the installer. It adds the hook to `.claude/settings.json`, keeps any hooks and settings that are already there, and can be run again safely.

```sh
npx designsnitch install
```

It also copies the designsnitch skills into `.claude/skills`, replacing older copies of them.

If you need to do it by hand, this is what it adds to `.claude/settings.json`.

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

`.claude/settings.json` is shared with the team through git, so the hook applies to everyone who uses Claude Code in this project. If the user wants the hook only for themselves, do not run the installer: add the entries above to `.claude/settings.local.json` by hand.

## 2. Register the hook in Codex

```sh
npx designsnitch install --agent codex
```

It adds the hook to `.codex/hooks.json` and copies the skills into `.agents/skills`. Use `--agent all` to set up every supported agent together.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "apply_patch",
        "hooks": [{ "type": "command", "command": "npx designsnitch hook", "timeout": 60 }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "npx designsnitch hook", "timeout": 60 }]
      }
    ]
  }
}
```

Two things are different in Codex. Tell the user about both.

- **The hook does not run until the user approves it.** Codex runs project hooks only in a project the user has trusted, and only hooks the user has approved. You cannot do this for them. Ask the user to open Codex in the project and approve when it asks.
- **Codex often edits files with shell commands, which the `apply_patch` matcher does not see.** Those edits are still caught when Codex is about to finish: the `Stop` hook checks every file git reports as changed.

## 3. Register the hook in Gemini CLI

```sh
npx designsnitch install --agent gemini
```

It adds the hook to `.gemini/settings.json` and copies the skills into `.agents/skills`, which Gemini CLI reads as workspace skills. Gemini CLI uses different event names, and its `timeout` is in milliseconds.

```json
{
  "hooks": {
    "AfterTool": [
      {
        "matcher": "write_file|replace",
        "hooks": [{ "name": "designsnitch", "type": "command", "command": "npx designsnitch hook", "timeout": 60000 }]
      }
    ],
    "AfterAgent": [
      {
        "hooks": [{ "name": "designsnitch", "type": "command", "command": "npx designsnitch hook", "timeout": 60000 }]
      }
    ]
  }
}
```

- `AfterTool` runs after `write_file` or `replace`. Exit code 2 replaces the tool's result with the errors, and the turn continues.
- `AfterAgent` runs when Gemini CLI is about to answer. Exit code 2 rejects the answer and makes it try again with the errors as feedback. `stop_hook_active` keeps it from looping.

Tell the user that Gemini CLI warns before it runs a new project hook, and that they need to allow it. If they have turned on folder trust, they also need to trust the folder. This setup follows the official Gemini CLI documentation and has not been tested with Gemini CLI. If the user reports that the hook does not fire, check that the installed Gemini CLI version supports hooks.

## 4. Register the hook in Grok Build

```sh
npx designsnitch install --agent grok
```

It writes `.grok/hooks/designsnitch.json` with the same `PostToolUse` and `Stop` hooks as Claude Code (`timeout` in seconds), and copies the skills into `.grok/skills`. Grok Build sends the hook its input in camelCase (`hookEventName`, `toolInput`), which `designsnitch hook` understands.

Tell the user two things.

- **The hook does not run until the project is trusted.** Ask the user to run `/hooks-trust` in Grok Build, or to start it with `--trust`.
- **Grok Build may report the errors without stopping.** Its documentation calls `PreToolUse` the only blocking event and does not say what exit code 2 does after a tool or at the end of a turn. This setup follows the official xAI documentation and has not been tested with Grok Build.

## 5. Other agents

`designsnitch hook` does not depend on a particular agent. It reads an optional JSON object from stdin:

- `tool_input.file_path`: the file that was just edited. Without it, the files that git reports as changed are checked.
- `hook_event_name` (or `hookEventName`): `Stop`, `SubagentStop` or `AfterAgent` means the agent is about to finish.
- `stop_hook_active`: when true, the hook does not block again.

It exits with 2 and writes what to fix to stderr when it blocks, and exits with 0 otherwise. If the agent in use supports command hooks with these conventions, register the same command there. Check that agent's hook documentation for the file and the event names, and tell the user if you could not confirm that it works.

## 6. Verify

Make the hook fire once.

1. Pick a source file and add a class that uses a tokenized color as a hex value, such as `bg-[#3B82F6]` when a token has that value.
2. Run the hook by hand with the same input the agent would send.

```sh
echo '{"hook_event_name":"PostToolUse","tool_input":{"file_path":"src/app/page.tsx"}}' | npx designsnitch hook; echo "exit: $?"
```

It should print the error and exit with 2.

3. Undo the test change and run it again. It should print nothing and exit with 0.

## 7. Tell the user

Say which file you changed and what the hook will now do. Mention that it only looks at files the agent changes, so existing violations elsewhere stay until someone cleans them up with the `designsnitch-check` skill.

## What not to do

- Do not remove or rewrite hooks that are already registered.
- Do not register the hook when there is no `designsnitch.config.json`.
- Do not work around the hook when it blocks you. Fix what it reports, or ask the user about the items marked `ask`.
