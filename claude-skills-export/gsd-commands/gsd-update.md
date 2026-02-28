# GSD: Update

## Description
Check for GSD updates, install if available, and display what changed. Handles version detection, npm version checking, changelog fetching and display, user confirmation with clean install warning, update execution, and cache clearing.

## Trigger
`/gsd:update`

## Instructions

```
name: gsd:update
description: Update GSD to latest version with changelog display
allowed-tools: Bash, AskUserQuestion
```

### Objective
Check for GSD updates, install if available, and display what changed.

Routes to the update workflow which handles:
- Version detection (local vs global installation)
- npm version checking
- Changelog fetching and display
- User confirmation with clean install warning
- Update execution and cache clearing
- Restart reminder

### Execution Context
Loads workflow from `workflows/update.md`.

### Process
**Follow the update workflow**.

The workflow handles all logic including:
1. Installed version detection (local/global)
2. Latest version checking via npm
3. Version comparison
4. Changelog fetching and extraction
5. Clean install warning display
6. User confirmation
7. Update execution
8. Cache clearing
