# GSD: Quick

## Description
Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking). Quick mode is the same system with a shorter path: spawns gsd-planner (quick mode) + gsd-executor(s). Quick tasks live in `.planning/quick/` separate from planned phases. Updates STATE.md "Quick Tasks Completed" table (NOT ROADMAP.md).

## Trigger
`/gsd:quick [--full]`

**Default:** Skips research, plan-checker, verifier. Use when you know exactly what to do.
**`--full` flag:** Enables plan-checking (max 2 iterations) and post-execution verification. Use when you want quality guarantees without full milestone ceremony.

## Instructions

```
name: gsd:quick
description: Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents
argument-hint: "[--full]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
```

### Objective
Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking).

Quick mode is the same system with a shorter path:
- Spawns gsd-planner (quick mode) + gsd-executor(s)
- Quick tasks live in `.planning/quick/` separate from planned phases
- Updates STATE.md "Quick Tasks Completed" table (NOT ROADMAP.md)

**Default:** Skips research, plan-checker, verifier. Use when you know exactly what to do.

**`--full` flag:** Enables plan-checking (max 2 iterations) and post-execution verification. Use when you want quality guarantees without full milestone ceremony.

### Execution Context
Loads workflow from `workflows/quick.md`.

### Context
$ARGUMENTS

Context files are resolved inside the workflow (`init quick`) and delegated via `<files_to_read>` blocks.

### Process
Execute the quick workflow end-to-end.
Preserve all workflow gates (validation, task description, planning, execution, state updates, commits).
