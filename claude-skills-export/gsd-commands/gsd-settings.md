# GSD: Settings

## Description
Interactive configuration of GSD workflow agents and model profile via multi-question prompt. Configure workflow toggles for model, research, plan_check, verifier, and branching.

## Trigger
`/gsd:settings`

## Instructions

```
name: gsd:settings
description: Configure GSD workflow toggles and model profile
allowed-tools: Read, Write, Bash, AskUserQuestion
```

### Objective
Interactive configuration of GSD workflow agents and model profile via multi-question prompt.

Routes to the settings workflow which handles:
- Config existence ensuring
- Current settings reading and parsing
- Interactive 5-question prompt (model, research, plan_check, verifier, branching)
- Config merging and writing
- Confirmation display with quick command references

### Execution Context
Loads workflow from `workflows/settings.md`.

### Process
**Follow the settings workflow**.

The workflow handles all logic including:
1. Config file creation with defaults if missing
2. Current config reading
3. Interactive settings presentation with pre-selection
4. Answer parsing and config merging
5. File writing
6. Confirmation display
