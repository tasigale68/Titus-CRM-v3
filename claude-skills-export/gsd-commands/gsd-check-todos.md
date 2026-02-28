# GSD: Check Todos

## Description
List all pending todos, allow selection, load full context for the selected todo, and route to appropriate action. Supports area filtering, interactive selection with full context loading, roadmap correlation checking, and action routing (work now, add to phase, brainstorm, create phase).

## Trigger
`/gsd:check-todos [area filter]`

## Instructions

```
name: gsd:check-todos
description: List pending todos and select one to work on
argument-hint: [area filter]
allowed-tools: Read, Write, Bash, AskUserQuestion
```

### Objective
List all pending todos, allow selection, load full context for the selected todo, and route to appropriate action.

Routes to the check-todos workflow which handles:
- Todo counting and listing with area filtering
- Interactive selection with full context loading
- Roadmap correlation checking
- Action routing (work now, add to phase, brainstorm, create phase)
- STATE.md updates and git commits

### Execution Context
Loads workflow from `workflows/check-todos.md`.

### Context
Arguments: $ARGUMENTS (optional area filter)

Todo state and roadmap correlation are loaded in-workflow using `init todos` and targeted reads.

### Process
**Follow the check-todos workflow**.

The workflow handles all logic including:
1. Todo existence checking
2. Area filtering
3. Interactive listing and selection
4. Full context loading with file summaries
5. Roadmap correlation checking
6. Action offering and execution
7. STATE.md updates
8. Git commits
