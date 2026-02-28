# GSD: Cleanup

## Description
Archive phase directories from completed milestones into `.planning/milestones/v{X.Y}-phases/`. Use when `.planning/phases/` has accumulated directories from past milestones.

## Trigger
`/gsd:cleanup`

## Instructions

```
name: gsd:cleanup
description: Archive accumulated phase directories from completed milestones
```

### Objective
Archive phase directories from completed milestones into `.planning/milestones/v{X.Y}-phases/`.

Use when `.planning/phases/` has accumulated directories from past milestones.

### Execution Context
Loads workflow from `workflows/cleanup.md`.

### Process
Follow the cleanup workflow.
Identify completed milestones, show a dry-run summary, and archive on confirmation.
