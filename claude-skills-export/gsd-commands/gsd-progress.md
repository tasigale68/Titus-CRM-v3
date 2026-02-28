# GSD: Progress

## Description
Check project progress, summarize recent work and what's ahead, then intelligently route to the next action -- either executing an existing plan or creating the next one. Provides situational awareness before continuing work.

## Trigger
`/gsd:progress`

## Instructions

```
name: gsd:progress
description: Check project progress, show context, and route to next action (execute or plan)
allowed-tools: Read, Bash, Grep, Glob, SlashCommand
```

### Objective
Check project progress, summarize recent work and what's ahead, then intelligently route to the next action - either executing an existing plan or creating the next one.

Provides situational awareness before continuing work.

### Execution Context
Loads workflow from `workflows/progress.md`.

### Process
Execute the progress workflow end-to-end.
Preserve all routing logic (Routes A through F) and edge case handling.
