# GSD: Verify Work

## Description
Validate built features through conversational UAT (User Acceptance Testing) with persistent state. Confirms what Claude built actually works from user's perspective. One test at a time, plain text responses, no interrogation. When issues are found, automatically diagnoses, plans fixes, and prepares for execution.

## Trigger
`/gsd:verify-work [phase number, e.g., '4']`

## Instructions

```
name: gsd:verify-work
description: Validate built features through conversational UAT
argument-hint: "[phase number, e.g., '4']"
allowed-tools: Read, Bash, Glob, Grep, Edit, Write, Task
```

### Objective
Validate built features through conversational testing with persistent state.

Purpose: Confirm what Claude built actually works from user's perspective. One test at a time, plain text responses, no interrogation. When issues are found, automatically diagnose, plan fixes, and prepare for execution.

Output: {phase_num}-UAT.md tracking all test results. If issues found: diagnosed gaps, verified fix plans ready for /gsd:execute-phase

### Execution Context
Loads:
- `workflows/verify-work.md`
- `templates/UAT.md`

### Context
Phase: $ARGUMENTS (optional)
- If provided: Test specific phase (e.g., "4")
- If not provided: Check for active sessions or prompt for phase

Context files are resolved inside the workflow (`init verify-work`) and delegated via `<files_to_read>` blocks.

### Process
Execute the verify-work workflow end-to-end.
Preserve all workflow gates (session management, test presentation, diagnosis, fix planning, routing).
