# GSD: Audit Milestone

## Description
Verify milestone achieved its definition of done. Check requirements coverage, cross-phase integration, and end-to-end flows. Reads existing VERIFICATION.md files (phases already verified during execute-phase), aggregates tech debt and deferred gaps, then spawns integration checker for cross-phase wiring.

## Trigger
`/gsd:audit-milestone [version]`

## Instructions

```
name: gsd:audit-milestone
description: Audit milestone completion against original intent before archiving
argument-hint: "[version]"
allowed-tools: Read, Glob, Grep, Bash, Task, Write
```

### Objective
Verify milestone achieved its definition of done. Check requirements coverage, cross-phase integration, and end-to-end flows.

**This command IS the orchestrator.** Reads existing VERIFICATION.md files (phases already verified during execute-phase), aggregates tech debt and deferred gaps, then spawns integration checker for cross-phase wiring.

### Execution Context
Loads workflow from `workflows/audit-milestone.md`.

### Context
Version: $ARGUMENTS (optional -- defaults to current milestone)

Core planning files are resolved in-workflow (`init milestone-op`) and loaded only as needed.

**Completed Work:**
- Glob: `.planning/phases/*/*-SUMMARY.md`
- Glob: `.planning/phases/*/*-VERIFICATION.md`

### Process
Execute the audit-milestone workflow end-to-end.
Preserve all workflow gates (scope determination, verification reading, integration check, requirements coverage, routing).
