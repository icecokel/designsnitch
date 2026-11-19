---
name: designsnitch-hooks
description: Register designsnitch as a hook of the coding agent, so the agent is told about design system errors right after it edits a file and cannot finish while errors it can fix remain. Use as part of setting up designsnitch, or when the user asks to make AI-written code follow the design system automatically.
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

Add this to `.claude/settings.json` in the project root. Create the file if it does not exist. If it already has a `hooks` section, add these entries to it and keep the existing ones.

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

`.claude/settings.json` is shared with the team through git. Use `.claude/settings.local.json` instead if the user wants the hook only for themselves.

## 2. Other agents

`designsnitch hook` does not depend on Claude Code. It reads an optional JSON object from stdin:

- `tool_input.file_path`: the file that was just edited. Without it, the files that git reports as changed are checked.
- `hook_event_name`: `Stop` or `SubagentStop` means the agent is about to finish.
- `stop_hook_active`: when true, the hook does not block again.

It exits with 2 and writes what to fix to stderr when it blocks, and exits with 0 otherwise. If the agent in use supports command hooks with these conventions, register the same command there. Check that agent's hook documentation for the file and the event names, and tell the user if you could not confirm that it works.

## 3. Verify

Make the hook fire once.

1. Pick a source file and add a class that uses a tokenized color as a hex value, such as `bg-[#3B82F6]` when a token has that value.
2. Run the hook by hand with the same input the agent would send.

```sh
echo '{"hook_event_name":"PostToolUse","tool_input":{"file_path":"src/app/page.tsx"}}' | npx designsnitch hook; echo "exit: $?"
```

It should print the error and exit with 2.

3. Undo the test change and run it again. It should print nothing and exit with 0.

## 4. Tell the user

Say which file you changed and what the hook will now do. Mention that it only looks at files the agent changes, so existing violations elsewhere stay until someone cleans them up with the `designsnitch-check` skill.

## What not to do

- Do not remove or rewrite hooks that are already registered.
- Do not register the hook when there is no `designsnitch.config.json`.
- Do not work around the hook when it blocks you. Fix what it reports, or ask the user about the items marked `ask`.
