# GSD: Health

## Description
Diagnose `.planning/` directory health and optionally repair issues. Validates directory integrity and reports actionable issues. Checks for missing files, invalid configurations, inconsistent state, and orphaned plans.

## Trigger
`/gsd:health [--repair]`

## Instructions

```
name: gsd:health
description: Diagnose planning directory health and optionally repair issues
argument-hint: [--repair]
allowed-tools: Read, Bash, Write, AskUserQuestion
```

### Objective
Validate `.planning/` directory integrity and report actionable issues. Checks for missing files, invalid configurations, inconsistent state, and orphaned plans.

### Execution Context
Loads workflow from `workflows/health.md`.

### Process
Execute the health workflow end-to-end.
Parse --repair flag from arguments and pass to workflow.
