# GSD: Plan Milestone Gaps

## Description
Create all phases necessary to close gaps identified by `/gsd:audit-milestone`. Reads MILESTONE-AUDIT.md, groups gaps into logical phases, creates phase entries in ROADMAP.md, and offers to plan each phase. One command creates all fix phases -- no manual `/gsd:add-phase` per gap.

## Trigger
`/gsd:plan-milestone-gaps`

## Instructions

```
name: gsd:plan-milestone-gaps
description: Create phases to close all gaps identified by milestone audit
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
```

### Objective
Create all phases necessary to close gaps identified by `/gsd:audit-milestone`.

Reads MILESTONE-AUDIT.md, groups gaps into logical phases, creates phase entries in ROADMAP.md, and offers to plan each phase.

One command creates all fix phases -- no manual `/gsd:add-phase` per gap.

### Execution Context
Loads workflow from `workflows/plan-milestone-gaps.md`.

### Context
**Audit results:**
Glob: `.planning/v*-MILESTONE-AUDIT.md` (use most recent)

Original intent and current planning state are loaded on demand inside the workflow.

### Process
Execute the plan-milestone-gaps workflow end-to-end.
Preserve all workflow gates (audit loading, prioritization, phase grouping, user confirmation, roadmap updates).
