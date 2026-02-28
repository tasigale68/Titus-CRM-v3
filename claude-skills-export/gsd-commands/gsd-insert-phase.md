# GSD: Insert Phase

## Description
Insert a decimal phase for urgent work discovered mid-milestone that must be completed between existing integer phases. Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence of planned phases while accommodating urgent insertions.

## Trigger
`/gsd:insert-phase <after> <description>`

## Instructions

```
name: gsd:insert-phase
description: Insert urgent work as decimal phase (e.g., 72.1) between existing phases
argument-hint: <after> <description>
allowed-tools: Read, Write, Bash
```

### Objective
Insert a decimal phase for urgent work discovered mid-milestone that must be completed between existing integer phases.

Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence of planned phases while accommodating urgent insertions.

Purpose: Handle urgent work discovered during execution without renumbering entire roadmap.

### Execution Context
Loads workflow from `workflows/insert-phase.md`.

### Context
Arguments: $ARGUMENTS (format: <after-phase-number> <description>)

Roadmap and state are resolved in-workflow via `init phase-op` and targeted tool calls.

### Process
Execute the insert-phase workflow end-to-end.
Preserve all validation gates (argument parsing, phase verification, decimal calculation, roadmap updates).
