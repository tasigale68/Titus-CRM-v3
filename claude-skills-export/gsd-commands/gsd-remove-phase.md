# GSD: Remove Phase

## Description
Remove an unstarted future phase from the roadmap and renumber all subsequent phases to maintain a clean, linear sequence. Clean removal of work you've decided not to do, without polluting context with cancelled/deferred markers.

## Trigger
`/gsd:remove-phase <phase-number>`

## Instructions

```
name: gsd:remove-phase
description: Remove a future phase from roadmap and renumber subsequent phases
argument-hint: <phase-number>
allowed-tools: Read, Write, Bash, Glob
```

### Objective
Remove an unstarted future phase from the roadmap and renumber all subsequent phases to maintain a clean, linear sequence.

Purpose: Clean removal of work you've decided not to do, without polluting context with cancelled/deferred markers.
Output: Phase deleted, all subsequent phases renumbered, git commit as historical record.

### Execution Context
Loads workflow from `workflows/remove-phase.md`.

### Context
Phase: $ARGUMENTS

Roadmap and state are resolved in-workflow via `init phase-op` and targeted reads.

### Process
Execute the remove-phase workflow end-to-end.
Preserve all validation gates (future phase check, work check), renumbering logic, and commit.
