# GSD: Add Phase

## Description
Add a new integer phase to the end of the current milestone in the roadmap. Handles phase number calculation (next sequential integer), directory creation with slug generation, roadmap structure updates, and STATE.md roadmap evolution tracking.

## Trigger
`/gsd:add-phase <description>`

## Instructions

```
name: gsd:add-phase
description: Add phase to end of current milestone in roadmap
argument-hint: <description>
allowed-tools: Read, Write, Bash
```

### Objective
Add a new integer phase to the end of the current milestone in the roadmap.

Routes to the add-phase workflow which handles:
- Phase number calculation (next sequential integer)
- Directory creation with slug generation
- Roadmap structure updates
- STATE.md roadmap evolution tracking

### Execution Context
Loads workflow from `workflows/add-phase.md`.

### Context
Arguments: $ARGUMENTS (phase description)

Roadmap and state are resolved in-workflow via `init phase-op` and targeted tool calls.

### Process
**Follow the add-phase workflow** from the add-phase workflow file.

The workflow handles all logic including:
1. Argument parsing and validation
2. Roadmap existence checking
3. Current milestone identification
4. Next phase number calculation (ignoring decimals)
5. Slug generation from description
6. Phase directory creation
7. Roadmap entry insertion
8. STATE.md updates
