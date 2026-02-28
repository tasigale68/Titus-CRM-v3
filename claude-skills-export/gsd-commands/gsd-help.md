# GSD: Help

## Description
Display the complete GSD command reference. Output ONLY the reference content. Do NOT add project-specific analysis, git status, file context, next-step suggestions, or any commentary beyond the reference.

## Trigger
`/gsd:help`

## Instructions

```
name: gsd:help
description: Show available GSD commands and usage guide
```

### Objective
Display the complete GSD command reference.

Output ONLY the reference content below. Do NOT add:
- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference

### Execution Context
Loads workflow from `workflows/help.md`.

### Process
Output the complete GSD command reference from the help workflow.
Display the reference content directly -- no additions or modifications.
