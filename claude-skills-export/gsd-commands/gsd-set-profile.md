# GSD: Set Profile

## Description
Switch the model profile used by GSD agents. Controls which Claude model each agent uses, balancing quality vs token spend. Profiles: quality, balanced, budget.

## Trigger
`/gsd:set-profile <profile>`

## Instructions

```
name: gsd:set-profile
description: Switch model profile for GSD agents (quality/balanced/budget)
argument-hint: <profile>
allowed-tools: Read, Write, Bash
```

### Objective
Switch the model profile used by GSD agents. Controls which Claude model each agent uses, balancing quality vs token spend.

Routes to the set-profile workflow which handles:
- Argument validation (quality/balanced/budget)
- Config file creation if missing
- Profile update in config.json
- Confirmation with model table display

### Execution Context
Loads workflow from `workflows/set-profile.md`.

### Process
**Follow the set-profile workflow**.

The workflow handles all logic including:
1. Profile argument validation
2. Config file ensuring
3. Config reading and updating
4. Model table generation from MODEL_PROFILES
5. Confirmation display
