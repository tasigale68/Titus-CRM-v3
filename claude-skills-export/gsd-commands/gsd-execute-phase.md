# GSD: Execute Phase

## Description
Execute all plans in a phase using wave-based parallel execution. Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads the full execute-plan context and handles its own plan. Context budget: ~15% orchestrator, 100% fresh per subagent.

## Trigger
`/gsd:execute-phase <phase-number> [--gaps-only]`

## Instructions

```
name: gsd:execute-phase
description: Execute all plans in a phase with wave-based parallelization
argument-hint: "<phase-number> [--gaps-only]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, TodoWrite, AskUserQuestion
```

### Objective
Execute all plans in a phase using wave-based parallel execution.

Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads the full execute-plan context and handles its own plan.

Context budget: ~15% orchestrator, 100% fresh per subagent.

### Execution Context
Loads:
- `workflows/execute-phase.md`
- `references/ui-brand.md`

### Context
Phase: $ARGUMENTS

**Flags:**
- `--gaps-only` -- Execute only gap closure plans (plans with `gap_closure: true` in frontmatter). Use after verify-work creates fix plans.

Context files are resolved inside the workflow via `gsd-tools init execute-phase` and per-subagent `<files_to_read>` blocks.

### Process
Execute the execute-phase workflow end-to-end.
Preserve all workflow gates (wave execution, checkpoint handling, verification, state updates, routing).
