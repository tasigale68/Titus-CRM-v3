# GSD: Add Tests

## Description
Generate unit and E2E tests for a completed phase, using its SUMMARY.md, CONTEXT.md, and VERIFICATION.md as specifications. Analyzes implementation files, classifies them into TDD (unit), E2E (browser), or Skip categories, presents a test plan for user approval, then generates tests following RED-GREEN conventions.

## Trigger
`/gsd:add-tests <phase> [additional instructions]`

Examples:
- `/gsd:add-tests 12`
- `/gsd:add-tests 12 focus on edge cases in the pricing module`

## Instructions

```
name: gsd:add-tests
description: Generate tests for a completed phase based on UAT criteria and implementation
argument-hint: "<phase> [additional instructions]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
```

### Objective
Generate unit and E2E tests for a completed phase, using its SUMMARY.md, CONTEXT.md, and VERIFICATION.md as specifications.

Analyzes implementation files, classifies them into TDD (unit), E2E (browser), or Skip categories, presents a test plan for user approval, then generates tests following RED-GREEN conventions.

Output: Test files committed with message `test(phase-{N}): add unit and E2E tests from add-tests command`

### Execution Context
Loads workflow from `workflows/add-tests.md`.

### Context
Phase: $ARGUMENTS

Reads:
- `.planning/STATE.md`
- `.planning/ROADMAP.md`

### Process
Execute the add-tests workflow end-to-end.
Preserve all workflow gates (classification approval, test plan approval, RED-GREEN verification, gap reporting).
