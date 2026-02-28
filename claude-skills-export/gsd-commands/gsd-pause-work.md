# GSD: Pause Work

## Description
Create `.continue-here.md` handoff file to preserve complete work state across sessions. Handles current phase detection from recent files, complete state gathering (position, completed work, remaining work, decisions, blockers), handoff file creation with all context sections, git commit as WIP, and resume instructions.

## Trigger
`/gsd:pause-work`

## Instructions

```
name: gsd:pause-work
description: Create context handoff when pausing work mid-phase
allowed-tools: Read, Write, Bash
```

### Objective
Create `.continue-here.md` handoff file to preserve complete work state across sessions.

Routes to the pause-work workflow which handles:
- Current phase detection from recent files
- Complete state gathering (position, completed work, remaining work, decisions, blockers)
- Handoff file creation with all context sections
- Git commit as WIP
- Resume instructions

### Execution Context
Loads workflow from `workflows/pause-work.md`.

### Context
State and phase progress are gathered in-workflow with targeted reads.

### Process
**Follow the pause-work workflow**.

The workflow handles all logic including:
1. Phase directory detection
2. State gathering with user clarifications
3. Handoff file writing with timestamp
4. Git commit
5. Confirmation with resume instructions
