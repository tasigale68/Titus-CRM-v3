# GSD: New Project

## Description
Initialize a new project through unified flow: questioning -> research (optional) -> requirements -> roadmap. Creates PROJECT.md (project context), config.json (workflow preferences), research/ (domain research), REQUIREMENTS.md (scoped requirements), ROADMAP.md (phase structure), and STATE.md (project memory).

## Trigger
`/gsd:new-project [--auto]`

Flags:
- `--auto` -- Automatic mode. After config questions, runs research -> requirements -> roadmap without further interaction. Expects idea document via @ reference.

## Instructions

```
name: gsd:new-project
description: Initialize a new project with deep context gathering and PROJECT.md
argument-hint: "[--auto]"
allowed-tools: Read, Bash, Write, Task, AskUserQuestion
```

### Objective
Initialize a new project through unified flow: questioning -> research (optional) -> requirements -> roadmap.

**Creates:**
- `.planning/PROJECT.md` -- project context
- `.planning/config.json` -- workflow preferences
- `.planning/research/` -- domain research (optional)
- `.planning/REQUIREMENTS.md` -- scoped requirements
- `.planning/ROADMAP.md` -- phase structure
- `.planning/STATE.md` -- project memory

**After this command:** Run `/gsd:plan-phase 1` to start execution.

### Execution Context
Loads:
- `workflows/new-project.md`
- `references/questioning.md`
- `references/ui-brand.md`
- `templates/project.md`
- `templates/requirements.md`

### Process
Execute the new-project workflow end-to-end.
Preserve all workflow gates (validation, approvals, commits, routing).
